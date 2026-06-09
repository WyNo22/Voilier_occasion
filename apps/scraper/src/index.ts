import { getAllScrapers } from "@voilierscope/scrapers"
import type { SearchQuery } from "@voilierscope/types"

/**
 * VoilierScope Scraper Service
 * Orchestrates all scraper modules and aggregates results
 */
async function main() {
  console.log("🚢 VoilierScope Scraper Service starting...")

  const scrapers = getAllScrapers()
  console.log(`✅ Loaded ${scrapers.length} scrapers:`)
  scrapers.forEach((s) => console.log(`   - ${s.displayName} (${s.baseUrl})`))

  // Example search query
  const query: SearchQuery = {
    raw: "Voilier croisière hauturière 10-14m",
    minLength: 10,
    maxLength: 14,
    hullType: "monohull",
  }

  console.log(`\n🔍 Running test search: "${query.raw}"`)
  console.log("=" .repeat(60))

  let totalFound = 0

  await Promise.all(
    scrapers.map(async (scraper) => {
      const start = Date.now()
      try {
        const result = await scraper.search(query)
        const duration = Date.now() - start
        console.log(
          `✅ ${scraper.displayName}: ${result.listings.length} annonces trouvées (${duration}ms)`
        )
        totalFound += result.listings.length

        // Show first result from each platform
        if (result.listings.length > 0) {
          const first = result.listings[0]
          console.log(
            `   └── ${first.title} — ${first.price ? `${first.price.toLocaleString()}€` : "Prix ND"} — ${first.location || "Localisation inconnue"}`
          )
        }
      } catch (error) {
        const duration = Date.now() - start
        console.error(
          `❌ ${scraper.displayName}: Erreur (${duration}ms):`,
          error instanceof Error ? error.message : error
        )
      }
    })
  )

  console.log("=" .repeat(60))
  console.log(`\n📊 Total: ${totalFound} annonces trouvées sur ${scrapers.length} plateformes`)

  // Continuous scraping mode (if SCRAPER_INTERVAL is set)
  const interval = parseInt(process.env.SCRAPER_INTERVAL_MS || "0")
  if (interval > 0) {
    console.log(`\n⏱️  Mode continu: rafraîchissement toutes les ${interval / 1000}s`)
    setInterval(async () => {
      console.log(`\n🔄 Mise à jour des annonces... ${new Date().toISOString()}`)
      // In production, this would update the database
    }, interval)
  } else {
    console.log("\n✨ Scraper terminé. Démarrez avec SCRAPER_INTERVAL_MS=60000 pour le mode continu.")
    process.exit(0)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
