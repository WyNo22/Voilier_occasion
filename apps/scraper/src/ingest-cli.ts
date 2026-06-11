import { createConnectorContext, getAllRealConnectors } from "@voilierscope/scrapers"
import type { SearchQuery } from "@voilierscope/types"
import { ingest } from "./ingest"
import { createBrowserContext } from "./browser"

/**
 * CLI d'ingestion réelle.
 *
 * Usage (depuis une machine au réseau ouvert, avec une DB Postgres lancée) :
 *   DATABASE_URL=... pnpm --filter @voilierscope/scraper ingest "voilier 10-12m"
 *
 * Sans argument, ingère un échantillon large. Les sources sont définies dans
 * `REAL_SOURCE_CONFIGS` (packages/scrapers) et calibrables sans toucher au code.
 */
async function main() {
  const args = process.argv.slice(2)
  const useBrowser = args.includes("--browser")
  const raw = args.filter((a) => !a.startsWith("--")).join(" ").trim() || "voilier occasion"
  const query: SearchQuery = { raw }

  console.log(`🚢 Ingestion VoilierScope — recherche: "${raw}"${useBrowser ? " (navigateur réel)" : ""}`)

  const connectors = getAllRealConnectors()
  console.log(
    connectors.length > 0
      ? `🔌 ${connectors.length} connecteurs réels: ${connectors.map((c) => `${c.id}[${c.kind}]`).join(", ")}`
      : "🔌 Aucun connecteur réel configuré (ajoute des flux dans FEED_SOURCE_CONFIGS)."
  )

  const browserCtx = useBrowser ? await createBrowserContext(2000) : undefined
  const ctx = browserCtx ?? createConnectorContext({ politeDelayMs: 1500, maxRetries: 3 })

  // Healthchecks (diagnostique anti-bot / réseau avant de lancer).
  for (const c of connectors) {
    const health = await c.healthcheck(ctx)
    console.log(`   ${health.ok ? "✅" : "⛔"} ${c.displayName} (${health.latencyMs ?? "?"}ms)${health.message ? ` — ${health.message}` : ""}`)
  }

  const start = Date.now()
  let stats
  try {
    stats = await ingest(query, connectors, ctx)
  } finally {
    if (browserCtx) await browserCtx.close()
  }
  const seconds = ((Date.now() - start) / 1000).toFixed(1)

  console.log("\n📊 Résultat de l'ingestion:")
  console.log(`   Découvertes : ${stats.discovered}`)
  console.log(`   Extraites   : ${stats.extracted}`)
  console.log(`   Uniques     : ${stats.unique}`)
  console.log(`   Créées      : ${stats.created}`)
  console.log(`   Mises à jour: ${stats.updated}`)
  console.log(`   Baisses prix: ${stats.priceDrops}`)
  console.log(`   Erreurs     : ${stats.errors}`)
  console.log(`   Durée       : ${seconds}s`)

  if (stats.extracted === 0) {
    console.log(
      "\n⚠️  Aucune annonce extraite. Causes probables :\n" +
        "   - sitemap/URL des sources à calibrer (voir REAL_SOURCE_CONFIGS)\n" +
        "   - anti-bot bloquant le fetch simple → un connecteur headless (Playwright) sera nécessaire\n" +
        "   - la source n'expose pas de JSON-LD/Open Graph sur ses fiches"
    )
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    const { prisma } = await import("@voilierscope/database")
    await prisma.$disconnect()
  })
