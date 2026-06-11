import { describe, it, expect } from "vitest"
import { extractFromHtml, findListingCandidates, extractNextData } from "./extract-jsonld"

// Fixture représentative : une fiche d'annonce avec JSON-LD schema.org/Product,
// telle qu'on en trouve sur de nombreux sites marchands.
const HTML_WITH_JSONLD = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta property="og:title" content="Bénéteau Oceanis 373 - 2005" />
  <meta property="og:image" content="https://cdn.example.com/og.jpg" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Bénéteau Oceanis 373",
    "description": "Voilier de croisière en très bon état, La Rochelle.",
    "brand": { "@type": "Brand", "name": "Bénéteau" },
    "model": "Oceanis 373",
    "productionDate": "2005",
    "image": [
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg"
    ],
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Longueur", "value": "11.3" },
      { "@type": "PropertyValue", "name": "Largeur (beam)", "value": "3.8" },
      { "@type": "PropertyValue", "name": "Tirant d'eau", "value": "1.75" }
    ],
    "offers": {
      "@type": "Offer",
      "price": "58000",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>
<body><h1>Bénéteau Oceanis 373</h1></body>
</html>`

const HTML_GRAPH_USD = `<html><head>
<script type="application/ld+json">
{ "@context":"https://schema.org", "@graph": [
  { "@type":"BreadcrumbList" },
  { "@type":"Vehicle", "name":"Jeanneau Sun Odyssey 45",
    "manufacturer":"Jeanneau", "modelDate":"2010-06-01",
    "image":"https://cdn/x.jpg",
    "offers": { "@type":"Offer", "price":128000, "priceCurrency":"USD" } }
]}
</script></head><body></body></html>`

const HTML_OG_ONLY = `<html><head>
<meta property="og:title" content="Dufour 36 Classic" />
<meta property="product:price:amount" content="35 000" />
<meta property="product:price:currency" content="EUR" />
<meta property="og:image" content="https://cdn/dufour.jpg" />
</head><body></body></html>`

const HTML_NOTHING = `<html><head><title>Page</title></head><body>Pas d'annonce</body></html>`

describe("extractFromHtml — JSON-LD", () => {
  it("extrait tous les champs d'un Product schema.org", () => {
    const r = extractFromHtml(HTML_WITH_JSONLD)
    expect(r.found).toBe(true)
    expect(r.title).toBe("Bénéteau Oceanis 373")
    expect(r.brand).toBe("Bénéteau")
    expect(r.model).toBe("Oceanis 373")
    expect(r.year).toBe(2005)
    expect(r.price).toBe(58000)
    expect(r.currency).toBe("EUR")
    expect(r.lengthM).toBe(11.3)
    expect(r.beam).toBe(3.8)
    expect(r.draft).toBe(1.75)
    expect(r.photos).toHaveLength(2)
  })

  it("gère un @graph et un type Vehicle avec prix numérique", () => {
    const r = extractFromHtml(HTML_GRAPH_USD)
    expect(r.found).toBe(true)
    expect(r.title).toBe("Jeanneau Sun Odyssey 45")
    expect(r.brand).toBe("Jeanneau")
    expect(r.year).toBe(2010)
    expect(r.price).toBe(128000)
    expect(r.currency).toBe("USD")
  })
})

describe("extractNextData", () => {
  it("parse le JSON embarqué __NEXT_DATA__ (technique liste de résultats)", () => {
    const html = `<html><body>
      <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"listings":[{"id":1,"title":"Voilier A"},{"id":2,"title":"Voilier B"}]}}}
      </script></body></html>`
    const data = extractNextData(html) as { props: { pageProps: { listings: unknown[] } } }
    expect(data).not.toBeNull()
    expect(data.props.pageProps.listings).toHaveLength(2)
  })

  it("retourne null sans __NEXT_DATA__", () => {
    expect(extractNextData("<html><body>rien</body></html>")).toBeNull()
  })
})

describe("findListingCandidates", () => {
  const RESULTS = `<html><body>
    <a href="https://www.youboat.com/fr/bateau/2018-lagoon-450-f-10180685/">A</a>
    <a href="/fr/bateaux-a-vendre/180545">B</a>
    <a href="https://static.cdn.com/images/180545/photo-123.jpg">image</a>
    <a href="/fr/voiliers/">catégorie</a>
    <a href="/assets/app-12345.js">script</a>
  </body></html>`

  it("garde les vraies annonces, exclut images/assets/CDN/catégories", () => {
    const links = findListingCandidates(RESULTS, "https://www.youboat.com/fr/bateaux/")
    expect(links).toContain("https://www.youboat.com/fr/bateau/2018-lagoon-450-f-10180685/")
    expect(links).toContain("https://www.youboat.com/fr/bateaux-a-vendre/180545")
    expect(links.some((l) => l.includes(".jpg") || l.includes(".js"))).toBe(false)
    expect(links.some((l) => l.endsWith("/voiliers/"))).toBe(false)
  })
})

describe("extractFromHtml — Open Graph fallback", () => {
  it("extrait depuis les balises OG quand il n'y a pas de JSON-LD", () => {
    const r = extractFromHtml(HTML_OG_ONLY)
    expect(r.found).toBe(true)
    expect(r.title).toBe("Dufour 36 Classic")
    expect(r.price).toBe(35000)
    expect(r.currency).toBe("EUR")
    expect(r.photos).toEqual(["https://cdn/dufour.jpg"])
  })

  it("retourne found:false sur une page sans données exploitables", () => {
    const r = extractFromHtml(HTML_NOTHING)
    expect(r.found).toBe(false)
  })

  it("ne plante pas sur un JSON-LD malformé", () => {
    const broken = `<html><head><script type="application/ld+json">{ bad json,, }</script>
      <meta property="og:title" content="Secours OG" /></head><body></body></html>`
    const r = extractFromHtml(broken)
    expect(r.found).toBe(true)
    expect(r.title).toBe("Secours OG")
  })
})
