import { createConnectorContext, getAllRealConnectors } from "@voilierscope/scrapers"
import { createBrowserContext } from "./browser"
import { runDueMissions } from "./missions"

/**
 * Agent de veille autonome. Tourne en continu (sur un serveur / une machine
 * allumée), exécute les missions dues à intervalle régulier, détecte les
 * opportunités et crée les alertes — sans aucune intervention humaine.
 *
 * Configuration (env) :
 *   DATABASE_URL            (requis) base Postgres
 *   WORKER_INTERVAL_MIN     intervalle entre deux passes (défaut 15 min)
 *   SCRAPER_USE_BROWSER=1   utilise un vrai navigateur (sites anti-HTTP simple)
 *   SCRAPER_PROXY           proxy optionnel (rate-limit / géo)
 */
const INTERVAL_MS = (parseInt(process.env.WORKER_INTERVAL_MIN || "15", 10) || 15) * 60_000

let stopping = false

async function tick(): Promise<void> {
  const useBrowser = process.env.SCRAPER_USE_BROWSER === "1"
  const connectors = getAllRealConnectors()
  const browserCtx = useBrowser ? await createBrowserContext(2000) : undefined
  const ctx = browserCtx ?? createConnectorContext({ politeDelayMs: 1500, maxRetries: 3 })

  const start = Date.now()
  try {
    const { missions, alerts } = await runDueMissions(connectors, ctx)
    const secs = ((Date.now() - start) / 1000).toFixed(1)
    if (missions > 0) {
      console.log(`[${new Date().toISOString()}] ✅ ${missions} mission(s) traitée(s), ${alerts} alerte(s) créée(s) en ${secs}s`)
    } else {
      console.log(`[${new Date().toISOString()}] — aucune mission due`)
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ⛔ Passe en échec:`, err instanceof Error ? err.message : err)
  } finally {
    if (browserCtx) await browserCtx.close()
  }
}

async function loop(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("⛔ DATABASE_URL manquant — le worker a besoin d'une base Postgres.")
    process.exitCode = 1
    return
  }

  console.log(
    `🤖 Agent de veille VoilierScope démarré — passe toutes les ${INTERVAL_MS / 60000} min` +
      `${process.env.SCRAPER_USE_BROWSER === "1" ? " (navigateur réel)" : ""}`
  )

  // Boucle à setTimeout récursif : évite tout chevauchement de passes.
  // eslint-disable-next-line no-unmodified-loop-condition
  while (!stopping) {
    await tick()
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }
}

function shutdown() {
  console.log("\n🛑 Arrêt de l'agent de veille…")
  stopping = true
  setTimeout(() => process.exit(0), 500)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

loop().finally(async () => {
  const { prisma } = await import("@voilierscope/database")
  await prisma.$disconnect()
})
