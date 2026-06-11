import { describe, it, expect } from "vitest"
import { normalizeListing } from "@voilierscope/core"
import { JsonLdConnector } from "./jsonld-connector"
import type { ConnectorContext } from "./types"

const SITEMAP = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://demo.test/annonce/1001-oceanis</loc></url>
  <url><loc>https://demo.test/annonce/1002-sun-odyssey</loc></url>
  <url><loc>https://demo.test/page/a-propos</loc></url>
</urlset>`

const DETAIL = `<html><head>
<script type="application/ld+json">
{ "@context":"https://schema.org","@type":"Product","name":"Bénéteau Oceanis 373",
  "brand":"beneteau","model":"Oceanis 373","productionDate":"2005",
  "offers":{"@type":"Offer","price":"100000","priceCurrency":"USD"} }
</script></head><body></body></html>`

/** Contexte de test : sert les fixtures, pas de réseau réel. */
function mockContext(pages: Record<string, string>): ConnectorContext {
  return {
    fetchText: async (url) => {
      const match = Object.keys(pages).find((k) => url.includes(k))
      if (!match) throw new Error(`404 ${url}`)
      return pages[match]!
    },
    fetchOk: async () => true,
    log: () => {},
    politeDelayMs: 0,
  }
}

describe("JsonLdConnector", () => {
  const connector = new JsonLdConnector({
    id: "demo",
    displayName: "Demo",
    baseUrl: "https://demo.test",
    sitemapUrl: "https://demo.test/sitemap.xml",
    listingUrlPattern: /\/annonce\//,
  })

  it("découvre les annonces depuis le sitemap en filtrant les autres pages", async () => {
    const ctx = mockContext({ "sitemap.xml": SITEMAP })
    const refs = await connector.discover({ raw: "" }, ctx)
    expect(refs).toHaveLength(2)
    expect(refs[0]!.externalId).toBe("1001")
    expect(refs.every((r) => r.source === "demo")).toBe(true)
  })

  it("récupère et extrait une annonce, puis la normalise via core", async () => {
    const ctx = mockContext({ "1001-oceanis": DETAIL })
    const ref = { source: "demo", externalId: "1001", url: "https://demo.test/annonce/1001-oceanis" }
    const doc = await connector.fetchDetail(ref, ctx)
    const raw = connector.extract(doc)
    expect(raw).not.toBeNull()

    // Le connecteur extrait des champs bruts ; core normalise (USD → EUR, marque).
    const normalized = normalizeListing(raw!)
    expect(normalized.id).toBe("demo-1001")
    expect(normalized.brand).toBe("Bénéteau") // marque canonisée
    expect(normalized.currency).toBe("EUR")
    expect(normalized.price).toBe(92000) // 100000 USD → EUR
  })

  it("retourne null pour une page sans données structurées", async () => {
    const ctx = mockContext({ x: "<html><body>rien</body></html>" })
    const doc = await connector.fetchDetail({ source: "demo", externalId: "x", url: "https://demo.test/x" }, ctx)
    expect(connector.extract(doc)).toBeNull()
  })
})
