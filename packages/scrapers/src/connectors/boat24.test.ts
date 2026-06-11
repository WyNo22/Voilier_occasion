import { describe, it, expect } from "vitest"
import { normalizeListing } from "@voilierscope/core"
import { parseDimensionsFromText } from "./extract-jsonld"
import { JsonLdConnector } from "./jsonld-connector"
import { REAL_SOURCE_CONFIGS } from "./index"

// Fixture fidèle à la structure réelle observée sur boat24 (schema.org/Vehicle
// dans un @graph, dimensions seulement dans la description).
const BOAT24_DETAIL = `<html><head>
<script type="application/ld+json">
{"@context":"http://schema.org","@graph":[{
  "@type":"Vehicle","sku":"670316","name":"Catana Ocean Class 50",
  "description":"Catamaran CATANA. Longueur : 14,99m Largeur : 7,98m Tirant d'eau 1,20 m. 3 cabines.",
  "productionDate":"2023",
  "image":"https://static.b24.co/fotos/xlarge/670316.jpg",
  "offers":[{"@type":"Offer","price":"1035000","priceCurrency":"EUR","url":"https://www.boat24.com/fr/voiliers/catana/catana-ocean-class-50/detail/670316/"}],
  "brand":{"@type":"Brand","name":"Catana"},
  "bodyType":"Catamaran","vehicleEngine":"YANMAR 2 x 57 cv"
}]}
</script></head><body></body></html>`

describe("parseDimensionsFromText", () => {
  it("lit longueur/largeur/tirant dans un texte français", () => {
    const d = parseDimensionsFromText("Longueur : 14,99m Largeur : 7,98m Tirant d'eau 1,20 m")
    expect(d.lengthM).toBe(14.99)
    expect(d.beam).toBe(7.98)
    expect(d.draft).toBe(1.2)
  })

  it("ignore les valeurs aberrantes", () => {
    expect(parseDimensionsFromText("Longueur : 9999 m").lengthM).toBeUndefined()
  })
})

describe("connecteur boat24 (calibré)", () => {
  const config = REAL_SOURCE_CONFIGS.find((c) => c.id === "boat24")!
  const connector = new JsonLdConnector(config)

  it("extrait une fiche réelle complète (Vehicle + dimensions description)", () => {
    const doc = {
      source: "boat24",
      externalId: "670316",
      url: "https://www.boat24.com/fr/voiliers/catana/catana-ocean-class-50/detail/670316/",
      contentType: "html" as const,
      body: BOAT24_DETAIL,
    }
    const raw = connector.extract(doc)
    expect(raw).not.toBeNull()

    const n = normalizeListing(raw!)
    expect(n.id).toBe("boat24-670316")
    expect(n.title).toBe("Catana Ocean Class 50")
    expect(n.brand).toBe("Catana")
    expect(n.year).toBe(2023)
    expect(n.price).toBe(1035000)
    expect(n.category).toBe("voilier")
    expect(n.hull).toBe("catamaran") // depuis bodyType
    expect(n.lengthM).toBe(14.99) // depuis la description
    expect(n.beam).toBe(7.98)
    expect(n.engineBrand).toContain("YANMAR")
  })

  it("configure la découverte par page de résultats", () => {
    expect(config.listingLinkSelector).toBeTruthy()
    expect(config.externalIdFromUrl!("https://www.boat24.com/fr/voiliers/x/y/detail/670316/")).toBe("670316")
  })
})
