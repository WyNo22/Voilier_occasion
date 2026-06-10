import { describe, it, expect } from "vitest"
import type { BoatListing } from "@voilierscope/types"
import { canonicalUrl, specsKey, duplicateConfidence, dedupeListings } from "./dedup"

function boat(overrides: Partial<BoatListing>): BoatListing {
  return {
    id: "x-1",
    source: "x",
    title: "Boat",
    currency: "EUR",
    photos: [],
    url: "https://example.com/1",
    ...overrides,
  }
}

describe("canonicalUrl", () => {
  it("retire les paramètres de tracking et le slash final", () => {
    expect(canonicalUrl("https://Leboncoin.fr/annonce/1/?utm=x")).toBe("leboncoin.fr/annonce/1")
  })
})

describe("specsKey", () => {
  it("génère une clé pour des specs complètes", () => {
    expect(specsKey(boat({ brand: "Bénéteau", model: "First 31.7", year: 1998, lengthM: 9.5 }))).toBe(
      "bénéteau|first31.7|1998|9.5"
    )
  })

  it("retourne null si specs insuffisantes", () => {
    expect(specsKey(boat({ brand: "Bénéteau" }))).toBeNull()
  })
})

describe("duplicateConfidence", () => {
  it("détecte une URL identique", () => {
    const a = boat({ url: "https://x.fr/1?utm=a" })
    const b = boat({ url: "https://x.fr/1" })
    expect(duplicateConfidence(a, b)).toBe(1)
  })

  it("détecte un doublon par specs + prix proche", () => {
    const a = boat({ source: "leboncoin", url: "https://a/1", brand: "Amel", model: "54", year: 2010, lengthM: 16, price: 280000 })
    const b = boat({ source: "youboat", url: "https://b/2", brand: "Amel", model: "54", year: 2010, lengthM: 16, price: 285000 })
    expect(duplicateConfidence(a, b)).toBeGreaterThanOrEqual(0.9)
  })

  it("ne confond pas deux bateaux différents", () => {
    const a = boat({ url: "https://a/1", brand: "Amel", model: "54", year: 2010, lengthM: 16 })
    const b = boat({ url: "https://b/2", brand: "Bénéteau", model: "First", year: 1998, lengthM: 9.5 })
    expect(duplicateConfidence(a, b)).toBe(0)
  })
})

describe("dedupeListings", () => {
  it("fusionne les doublons multi-sources et agrège les sources", () => {
    const listings = [
      boat({ id: "leboncoin-1", source: "leboncoin", url: "https://a/1", brand: "Amel", model: "54", year: 2010, lengthM: 16, price: 285000 }),
      boat({ id: "youboat-2", source: "youboat", url: "https://b/2", brand: "Amel", model: "54", year: 2010, lengthM: 16, price: 280000 }),
      boat({ id: "x-3", source: "x", url: "https://c/3", brand: "Bénéteau", model: "First 31.7", year: 1998, lengthM: 9.5, price: 22000 }),
    ]
    const merged = dedupeListings(listings)
    expect(merged).toHaveLength(2)
    const amel = merged.find((m) => m.brand === "Amel")!
    expect(amel.sources.sort()).toEqual(["leboncoin", "youboat"])
    // garde le prix le plus bas
    expect(amel.price).toBe(280000)
  })
})
