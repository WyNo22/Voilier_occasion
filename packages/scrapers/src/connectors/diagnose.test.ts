import { describe, it, expect } from "vitest"
import * as cheerio from "cheerio"
import { diagnoseHtml } from "./extract-jsonld"
import { JsonLdConnector } from "./jsonld-connector"
import type { ConnectorContext } from "./types"

const HTML = `<html><head>
<meta property="og:title" content="Sun Odyssey 379" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Sun Odyssey 379",
 "offers":{"@type":"Offer","price":"95000","priceCurrency":"EUR"}}
</script></head>
<body><table class="specs"><tr><td>Cabines</td><td>3</td></tr></table></body></html>`

describe("diagnoseHtml", () => {
  it("rapporte les blocs JSON-LD, types, OG et champs extraits", () => {
    const d = diagnoseHtml(HTML)
    expect(d.jsonLdBlocks).toBe(1)
    expect(d.jsonLdTypes).toContain("Product")
    expect(d.ogTags["og:title"]).toBe("Sun Odyssey 379")
    expect(d.extracted.found).toBe(true)
    expect(d.extracted.price).toBe(95000)
  })
})

describe("JsonLdConnector.customExtract", () => {
  const connector = new JsonLdConnector({
    id: "demo",
    displayName: "Demo",
    baseUrl: "https://demo.test",
    customExtract: (_html, $: cheerio.CheerioAPI) => {
      // Lit le nombre de cabines depuis le tableau de specs propre au site.
      const out: { cabins?: number } = {}
      $("table.specs tr").each((_, tr) => {
        const cells = $(tr).find("td")
        if ($(cells[0]).text().toLowerCase().includes("cabines")) {
          out.cabins = parseInt($(cells[1]).text(), 10)
        }
      })
      return out
    },
  })

  it("complète l'extraction générique avec des champs sur-mesure", () => {
    const doc = { source: "demo", externalId: "1", url: "https://demo.test/1", contentType: "html" as const, body: HTML }
    const raw = connector.extract(doc)
    expect(raw).not.toBeNull()
    expect(raw!.title).toBe("Sun Odyssey 379")
    expect(raw!.price).toBe(95000) // du JSON-LD
    expect(raw!.cabins).toBe(3) // du customExtract
  })
})
