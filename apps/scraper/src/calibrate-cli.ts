import {
  fetchTextWithRetry,
  findSitemapsViaRobots,
  diagnoseHtml,
  extractRawJsonLd,
  extractLinks,
  findListingCandidates,
  extractNextData,
} from "@voilierscope/scrapers"
import { createBrowserContext } from "./browser"

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
/**
 * Sonde une source en UNE commande : depuis une page de catégorie/résultats,
 * trouve les annonces, en ouvre une, et rapporte tout (anti-bot ? découverte ?
 * champs JSON-LD ?). Suffit à calibrer un nouveau connecteur.
 */
async function probe(pageUrl: string, useBrowser: boolean): Promise<void> {
  console.log(`🛰️  Sonde de ${pageUrl}${useBrowser ? " (navigateur réel)" : ""}\n`)
  const ctx = useBrowser ? await createBrowserContext() : undefined
  const fetchText = ctx ? ctx.fetchText : (u: string) => fetchTextWithRetry(u, { maxRetries: 2 })

  try {
    // 1) Page de résultats → liens d'annonces.
    let listHtml: string
    try {
      listHtml = await fetchText(pageUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("PLAYWRIGHT_BROWSER_MISSING")) {
        console.error("⛔ Navigateur non installé. (ce n'est PAS un blocage du site)")
      } else if (!useBrowser) {
        console.error(`⛔ HTTP simple refusé (${msg}). Réessaie avec --browser.`)
      } else {
        console.error(`⛔ Page illisible même via navigateur (${msg}) → anti-bot probable.`)
      }
      process.exitCode = 1
      return
    }

    const links = findListingCandidates(listHtml, pageUrl)
    console.log(`Découverte : ${links.length} lien(s) d'annonce détecté(s).`)
    links.slice(0, 5).forEach((l) => console.log(`  • ${l}`))
    if (links.length === 0) {
      console.log("\n⚠️  Aucun lien d'annonce reconnu. Es-tu bien sur une page de RÉSULTATS")
      console.log("   (liste d'annonces), pas une fiche ? Sinon colle-moi le HTML d'un lien")
      console.log("   d'annonce et je règle le sélecteur de découverte pour ce site.")
      return
    }

    // 2) Ouvre la 1re annonce → diagnostic + JSON-LD brut.
    const sample = links[0]!
    console.log(`\n🔎 Échantillon : ${sample}\n`)
    let detailHtml: string
    try {
      detailHtml = await fetchText(sample)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`⛔ Fiche illisible (${msg}).`)
      console.error(
        "\nLa découverte fonctionne mais les fiches sont protégées (anti-bot sur le détail).\n" +
          "→ Source à traiter par flux/partenariat, ou via ton module de transport dédié."
      )
      return
    }
    const d = diagnoseHtml(detailHtml)
    console.log(`Types JSON-LD      : ${d.jsonLdTypes.join(", ") || "(aucun)"}`)
    console.log(`Balises Open Graph : ${Object.keys(d.ogTags).join(", ") || "(aucune)"}`)
    console.log(`__NEXT_DATA__      : ${d.nextData ? `présent (clés: ${d.nextDataKeys.join(", ")})` : "absent"}`)
    const e = d.extracted
    const show = (k: string, v: unknown) => console.log(`  ${k.padEnd(10)}: ${v === undefined || v === "" ? "—" : v}`)
    show("found", e.found)
    show("title", e.title)
    show("brand", e.brand)
    show("year", e.year)
    show("price", e.price)
    show("lengthM", e.lengthM)
    console.log(`\n📦 JSON-LD brut de l'échantillon :`)
    extractRawJsonLd(detailHtml).forEach((b, i) => {
      console.log(`----- bloc ${i + 1} -----`)
      try {
        console.log(JSON.stringify(JSON.parse(b), null, 2).slice(0, 4000))
      } catch {
        console.log(b.slice(0, 2000))
      }
    })
  } finally {
    if (ctx) await ctx.close()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const sitemapsMode = args.includes("--sitemaps")
  const useBrowser = args.includes("--browser")
  const dumpMode = args.includes("--dump")
  const linksMode = args.includes("--links")
  const probeMode = args.includes("--probe")
  const url = args.find((a) => a.startsWith("http"))

  if (!url) {
    console.error("Fournis une URL. Ex: calibrate https://site/annonce/123")
    process.exitCode = 1
    return
  }

  if (probeMode) {
    await probe(url, useBrowser)
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

  console.log(`🔎 Diagnostic de ${url}${useBrowser ? " (navigateur réel)" : ""}\n`)
  let html: string
  let closeBrowser: (() => Promise<void>) | undefined
  try {
    if (useBrowser) {
      const ctx = await createBrowserContext()
      closeBrowser = ctx.close
      html = await ctx.fetchText(url)
    } else {
      html = await fetchTextWithRetry(url, { maxRetries: 2, timeoutMs: 20000 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    // Cas 1 : navigateur pas installé (pas un blocage du site).
    if (msg.includes("PLAYWRIGHT_BROWSER_MISSING")) {
      console.error("⛔ Navigateur non installé (ce n'est PAS un blocage du site).")
      console.error("\nInstalle-le une seule fois puis relance :")
      console.error("  pnpm exec playwright install chromium")
      process.exitCode = 1
      return
    }

    console.error("⛔ Récupération impossible:", msg)
    if (!useBrowser) {
      console.error(
        "\nSi c'est un 403/timeout : la source refuse le HTTP simple. Réessaie avec un vrai\n" +
          "navigateur :  pnpm --filter @voilierscope/scraper calibrate --browser \"<url>\"\n" +
          "(prérequis une seule fois : pnpm exec playwright install chromium)"
      )
    } else {
      console.error(
        "\nMême via navigateur réel, la page n'a pas pu être lue. Si c'est un 403/redirection\n" +
          "vers un défi, c'est un anti-bot (DataDome/captcha) → source à traiter par partenariat."
      )
    }
    process.exitCode = 1
    return
  } finally {
    if (closeBrowser) await closeBrowser()
  }

  // Mode --dump : affiche le JSON-LD brut + le JSON embarqué __NEXT_DATA__.
  if (dumpMode) {
    const blocks = extractRawJsonLd(html)
    console.log(`📦 ${blocks.length} bloc(s) JSON-LD brut(s) :\n`)
    blocks.forEach((b, i) => {
      console.log(`----- bloc ${i + 1} -----`)
      try {
        console.log(JSON.stringify(JSON.parse(b), null, 2))
      } catch {
        console.log(b)
      }
    })

    const nextData = extractNextData(html)
    if (nextData) {
      console.log(`\n📦 __NEXT_DATA__ (JSON embarqué — souvent toutes les annonces de la page) :`)
      const json = JSON.stringify(nextData, null, 2)
      console.log(json.length > 12000 ? json.slice(0, 12000) + "\n…(tronqué)" : json)
    }
    return
  }

  // Mode --links : liste les URLs d'annonces (pour calibrer la découverte).
  if (linksMode) {
    const links = extractLinks(html, url, /\/detail\/\d+/i)
    console.log(`🔗 ${links.length} lien(s) d'annonce (motif /detail/<id>) :\n`)
    links.slice(0, 25).forEach((l) => console.log(`  ${l}`))
    if (links.length === 0) {
      console.log("Aucun lien /detail/ trouvé sur cette page. Colle-moi l'URL d'une page")
      console.log("de résultats de recherche du site et je règle le sélecteur de découverte.")
    }
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
