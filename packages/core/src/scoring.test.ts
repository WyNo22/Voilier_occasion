import { describe, it, expect } from "vitest"
import type { BoatListing, SearchQuery } from "@voilierscope/types"
import { explainScore, blueWaterScore, liveaboardScore, coastalScore } from "./scoring"

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

describe("explainScore", () => {
  it("retourne un total borné et des facteurs justifiés", () => {
    const listing = boat({ price: 45000, year: 2015, lengthM: 11, condition: "Très bon état" })
    const query: SearchQuery = { raw: "voilier 11m 50k", maxPrice: 50000, minLength: 10, maxLength: 12 }
    const result = explainScore(listing, query)

    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(result.factors).toHaveLength(6)
    expect(result.summary).toBeTruthy()
    expect(result.factors.every((f) => f.reason.length > 0)).toBe(true)
  })

  it("pénalise un dépassement de budget et l'explique", () => {
    const listing = boat({ price: 100000, year: 2015, lengthM: 11 })
    const query: SearchQuery = { raw: "x", maxPrice: 50000 }
    const result = explainScore(listing, query)
    const price = result.factors.find((f) => f.key === "price")!
    expect(price.score).toBeLessThan(60)
    expect(price.reason).toContain("budget")
  })

  it("signale les équipements manquants demandés", () => {
    const listing = boat({ equipment: { solarPanels: true } })
    const query: SearchQuery = { raw: "x", equipment: ["dessalinisateur", "panneaux_solaires"] }
    const result = explainScore(listing, query)
    const eq = result.factors.find((f) => f.key === "equipment")!
    expect(eq.score).toBe(50) // 1/2 présent
    expect(eq.reason.toLowerCase()).toContain("manque")
  })
})

describe("scores d'usage", () => {
  it("note haut un bateau de grande croisière bien équipé", () => {
    const bluewater = boat({
      lengthM: 16,
      equipment: {
        waterMaker: true, solarPanels: true, generator: true, inverter: true, batteryMonitor: true,
        lifeRaft: true, epirb: true, radar: true, ais: true, autopilot: true,
      },
    })
    expect(blueWaterScore(bluewater)).toBeGreaterThan(85)
  })

  it("note bas un petit côtier dépouillé en hauturier", () => {
    const coastalBoat = boat({ lengthM: 9.5, equipment: { vhf: true, depthSounder: true } })
    expect(blueWaterScore(coastalBoat)).toBeLessThan(50)
  })

  it("calcule des scores vie à bord et côtier bornés", () => {
    const l = boat({ lengthM: 12, beam: 4, berths: 6, equipment: { heating: true, chartplotter: true, vhf: true } })
    expect(liveaboardScore(l)).toBeGreaterThanOrEqual(0)
    expect(liveaboardScore(l)).toBeLessThanOrEqual(100)
    expect(coastalScore(l)).toBeGreaterThanOrEqual(0)
    expect(coastalScore(l)).toBeLessThanOrEqual(100)
  })
})
