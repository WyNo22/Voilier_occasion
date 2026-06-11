import { describe, it, expect } from "vitest"
import { normalizeListing } from "@voilierscope/core"
import { JsonLdConnector } from "./jsonld-connector"
import { REAL_SOURCE_CONFIGS } from "./index"

// Fixture fidèle à une fiche bandofboats réelle (JSON-LD Vehicle + offers).
const DETAIL = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Vehicle","sku":156471,"name":"LAGOON 450 F",
 "description":"Lagoon 450 F 2019 - Catamaran. Longueur : 13,96m. 4 cabines.",
 "brand":"LAGOON","model":"LAGOON 450 F","productionDate":2019,
 "image":"https://static.bandofboats.com/v3/x.jpg",
 "offers":{"@type":"Offer","url":"https://www.bandofboats.com/fr/bateaux-a-vendre/156471",
   "category":"sailing_boat / Voilier multicoque / Catamaran",
   "availableAtOrFrom":"Sud de la France","price":360000,"priceCurrency":"EUR"}}
</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Band of Boats"}</script>
</head><body></body></html>`

describe("connecteur bandofboats (calibré)", () => {
  const config = REAL_SOURCE_CONFIGS.find((c) => c.id === "bandofboats")!
  const connector = new JsonLdConnector(config)

  it("extrait une fiche réelle (Vehicle + offers.category/location + dimensions)", () => {
    const doc = {
      source: "bandofboats",
      externalId: "156471",
      url: "https://www.bandofboats.com/fr/bateaux-a-vendre/156471",
      contentType: "html" as const,
      body: DETAIL,
    }
    const raw = connector.extract(doc)
    expect(raw).not.toBeNull()

    const n = normalizeListing(raw!)
    expect(n.id).toBe("bandofboats-156471")
    expect(n.title).toBe("LAGOON 450 F")
    expect(n.brand).toBe("Lagoon")
    expect(n.year).toBe(2019)
    expect(n.price).toBe(360000)
    expect(n.category).toBe("voilier")
    expect(n.hull).toBe("catamaran") // depuis offers.category
    expect(n.location).toBe("Sud de la France") // depuis offers.availableAtOrFrom
    expect(n.lengthM).toBe(13.96) // depuis la description
  })

  it("extrait l'identifiant externe depuis l'URL", () => {
    expect(config.externalIdFromUrl!("https://www.bandofboats.com/fr/bateaux-a-vendre/156471")).toBe("156471")
  })
})
