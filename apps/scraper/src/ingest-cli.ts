import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createConnectorContext, getAllRealConnectors } from "@voilierscope/scrapers"
import type { SearchQuery } from "@voilierscope/types"
import { ingest, collectListings } from "./ingest"
import { createBrowserContext } from "./browser"

/** Emplacement du snapshot lu par l'app web (sans base de données). */
function snapshotPath(): string {
  // apps/scraper → racine du repo (../..) → data/boats.json
  return process.env.BOATS_SNAPSHOT || resolve(process.cwd(), "..", "..", "data", "boats.json")
}

/**
 * CLI d'ingestion réelle.
 *
 * Usage (depuis une machine au réseau ouvert, avec une DB Postgres lancée) :
 *   DATABASE_URL=... pnpm --filter @voilierscope/scraper ingest "voilier 10-12m"
 *
 * Sans argument, ingère un échantillon large. Les sources sont définies dans
 * `REAL_SOURCE_CONFIGS` (packages/scrapers) et calibrables sans toucher au code.
 */
/** Lit un flag numérique (`--limit 12` ou `--limit=12`). Retourne aussi les tokens consommés. */
function numFlag(args: string[], name: string): { value?: number; consumed: Set<number> } {
  const consumed = new Set<number>()
  let value: number | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === `--${name}` && args[i + 1] && /^\d+$/.test(args[i + 1]!)) {
      value = parseInt(args[i + 1]!, 10)
      consumed.add(i).add(i + 1)
    } else if (a.startsWith(`--${name}=`)) {
      const n = parseInt(a.split("=")[1] || "", 10)
      if (!Number.isNaN(n)) value = n
      consumed.add(i)
    }
  }
  return { value, consumed }
}

async function main() {
  const args = process.argv.slice(2)
  const useBrowser = args.includes("--browser")
  const dryRun = args.includes("--dry-run")
  const limit = numFlag(args, "limit")
  const concurrency = numFlag(args, "concurrency")
  const consumed = new Set<number>([...limit.consumed, ...concurrency.consumed])
  const raw =
    args
      .filter((a, i) => !a.startsWith("--") && !consumed.has(i))
      .join(" ")
      .trim() || "voilier occasion"
  const query: SearchQuery = { raw }
  const collectOptions = { limit: limit.value, concurrency: concurrency.value }

  console.log(
    `🚢 ${dryRun ? "Dry-run" : "Ingestion"} VoilierScope — recherche: "${raw}"${useBrowser ? " (navigateur réel)" : ""}` +
      `${limit.value ? ` — limite ${limit.value}/source` : ""}`
  )

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

  // Mode dry-run : collecte + affiche, sans base de données.
  if (dryRun) {
    let result
    try {
      result = await collectListings(query, connectors, ctx, collectOptions)
    } finally {
      if (browserCtx) await browserCtx.close()
    }
    const secs = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\n🔎 ${result.listings.length} annonce(s) (${result.discovered} découvertes, ${result.errors} erreurs, ${secs}s) :\n`)
    for (const b of result.listings.slice(0, 30)) {
      const price = b.price ? `${b.price.toLocaleString("fr-FR")} €` : "prix ND"
      const len = b.lengthM ? `${b.lengthM}m` : "?m"
      console.log(`  • ${b.title} — ${price} — ${b.year ?? "?"} — ${len} — ${b.location ?? b.source}`)
    }

    // Écrit le snapshot lu par l'app web (mode sans base de données).
    if (result.listings.length > 0) {
      const out = snapshotPath()
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, JSON.stringify(result.listings, null, 2), "utf-8")
      console.log(`\n💾 Snapshot écrit : ${out}`)
      console.log("   → lance maintenant l'app : pnpm --filter @voilierscope/web dev")
      console.log("   → http://localhost:3000 affichera ces vraies annonces.")
    }
    return
  }

  let stats
  try {
    stats = await ingest(query, connectors, ctx, collectOptions)
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
