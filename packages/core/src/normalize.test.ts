import { describe, it, expect } from "vitest"
import { normalizeListing, canonicalBrand } from "./normalize"

describe("canonicalBrand", () => {
  it("normalise les variantes de marque", () => {
    expect(canonicalBrand("beneteau")).toBe("Bénéteau")
    expect(canonicalBrand("BÉNÉTEAU")).toBe("Bénéteau")
    expect(canonicalBrand("ovni")).toBe("Alubat")
    expect(canonicalBrand("hallberg rassy")).toBe("Hallberg-Rassy")
  })

  it("laisse une marque inconnue telle quelle", () => {
    expect(canonicalBrand("Wauquiez")).toBe("Wauquiez")
  })
})

describe("normalizeListing", () => {
  it("dérive les mètres depuis les pieds et inversement", () => {
    const fromFeet = normalizeListing({
      source: "yachtworld",
      externalId: "42",
      url: "https://x/42",
      lengthFt: 30,
    })
    expect(fromFeet.lengthM).toBe(9.14)
    expect(fromFeet.lengthFt).toBe(30)

    const fromMeters = normalizeListing({
      source: "leboncoin",
      externalId: "7",
      url: "https://x/7",
      lengthM: 11.3,
    })
    expect(fromMeters.lengthFt).toBeCloseTo(37.07, 1)
  })

  it("convertit le prix en EUR", () => {
    const l = normalizeListing({
      source: "yachtworld",
      externalId: "1",
      url: "https://x/1",
      price: 100000,
      currency: "USD",
    })
    expect(l.price).toBe(92000)
    expect(l.currency).toBe("EUR")
  })

  it("normalise la coque et nettoie le texte", () => {
    const l = normalizeListing({
      source: "x",
      externalId: "1",
      url: "https://x/1",
      hull: "Catamaran",
      title: "  Lagoon   380  ",
    })
    expect(l.hull).toBe("catamaran")
    expect(l.title).toBe("Lagoon 380")
  })

  it("construit un id stable source-externalId", () => {
    const l = normalizeListing({ source: "leboncoin", externalId: "1001", url: "https://x/1" })
    expect(l.id).toBe("leboncoin-1001")
  })
})
