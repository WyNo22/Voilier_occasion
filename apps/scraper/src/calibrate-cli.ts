import {
  fetchTextWithRetry,
  findSitemapsViaRobots,
  diagnoseHtml,
} from "@voilierscope/scrapers"

/**
 * Outil de calibration d'une source. À lancer sur une machine au réseau ouvert.
 *
 * Usage :
 *   # Diagnostic d'une fiche d'annonce (JSON-LD ? OG ? champs extraits ?)
 *   pnpm --filter @voilierscope/scraper calibrate https://www.boat24.com/.../annonce-123
 *
 *   # Découverte des sitemaps déclarés dans robots.txt d'un domaine
 *   pnpm --filter @voilierscope/scraper calibrate --sitemaps https://www.boat24.com
 *
 * Copie-colle la sortie : elle suffit à régler `REAL_SOURCE_CONFIGS`.
 */
async function main() {
  const args = process.argv.slice(2)
  const sitemapsMode = args.includes("--sitemaps")
  const url = args.find((a) => a.startsWith("http"))

  if (!url) {
    console.error("Fournis une URL. Ex: calibrate https://site/annonce/123")
    process.exitCode = 1
    return
  }

  if (sitemapsMode) {
    console.log(`🔎 Recherche des sitemaps via robots.txt sur ${url}\n`)
    const sitemaps = await findSitemapsViaRobots(url, { maxRetries: 1 })
    if (sitemaps.length === 0) {
      console.log("Aucun sitemap déclaré dans robots.txt (essaie /sitemap.xml directement).")
    } else {
      sitemaps.forEach((s) => console.log(`  • ${s}`))
    }
    return
  }

  console.log(`🔎 Diagnostic de ${url}\n`)
  let html: string
  try {
    html = await fetchTextWithRetry(url, { maxRetries: 2, timeoutMs: 20000 })
  } catch (err) {
    console.error("⛔ Récupération impossible:", err instanceof Error ? err.message : err)
    console.error(
      "\nSi c'est un 403/timeout, la source a probablement un anti-bot → un connecteur headless (Playwright) sera nécessaire pour celle-ci."
    )
    process.exitCode = 1
    return
  }

  const d = diagnoseHtml(html)
  console.log(`Taille HTML        : ${(html.length / 1024).toFixed(0)} Ko`)
  console.log(`Blocs JSON-LD      : ${d.jsonLdBlocks}`)
  console.log(`Types JSON-LD      : ${d.jsonLdTypes.join(", ") || "(aucun)"}`)
  console.log(`Balises Open Graph : ${Object.keys(d.ogTags).join(", ") || "(aucune)"}`)
  console.log(`\nChamps extraits par le moteur générique :`)
  const e = d.extracted
  const show = (label: string, v: unknown) =>
    console.log(`  ${label.padEnd(12)}: ${v === undefined || v === "" ? "—" : v}`)
  show("found", e.found)
  show("title", e.title)
  show("brand", e.brand)
  show("model", e.model)
  show("year", e.year)
  show("price", e.price)
  show("currency", e.currency)
  show("lengthM", e.lengthM)
  show("photos", e.photos?.length ? `${e.photos.length} image(s)` : "—")

  if (!e.found) {
    console.log(
      "\n⚠️  Rien d'exploitable en JSON-LD/OG. Il faudra une extraction sur-mesure\n" +
        "   (sélecteurs CSS du site) via le hook `customExtract`. Colle-moi un extrait\n" +
        "   du HTML autour du prix / des caractéristiques et je l'écris."
    )
  } else {
    console.log("\n✅ Source exploitable par le connecteur générique.")
    const missing = ["price", "year", "lengthM", "brand"].filter(
      (k) => (e as Record<string, unknown>)[k] === undefined
    )
    if (missing.length) {
      console.log(`   Champs manquants à compléter via customExtract : ${missing.join(", ")}`)
    }
  }
}

main()
