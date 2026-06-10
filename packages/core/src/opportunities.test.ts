import { describe, it, expect } from "vitest"
import type { BoatListing } from "@voilierscope/types"
import {
  median,
  detectPriceDrop,
  detectUndervalued,
  detectExcellentScore,
  detectRarity,
  highestPriority,
  shouldNotifyImmediately,
} from "./opportunities"

function boat(overrides: Partial<BoatListing>): BoatListing {
  return { id: "x-1", source: "x", title: "Boat", currency: "EUR", photos: [], url: "https://x/1", ...overrides }
}

describe("median", () => {
  it("calcule la médiane impaire et paire", () => {
    expect(median([10, 30, 20])).toBe(20)
    expect(median([10, 20, 30, 40])).toBe(25)
    expect(median([])).toBe(0)
  })
})

describe("detectPriceDrop", () => {
  const history = [
    { price: 60000, date: new Date("2026-05-01") },
    { price: 58000, date: new Date("2026-06-01") },
  ]

  it("détecte une baisse significative et la classe", () => {
    const opp = detectPriceDrop(50000, history)
    expect(opp).not.toBeNull()
    expect(opp!.type).toBe("baisse_prix")
    expect(opp!.priority).toBe("critique") // ~14%
  })

  it("ignore une micro-baisse sous le seuil", () => {
    expect(detectPriceDrop(57500, history)).toBeNull()
  })

  it("ignore une hausse", () => {
    expect(detectPriceDrop(59000, history)).toBeNull()
  })
})

describe("detectUndervalued", () => {
  it("détecte une annonce sous la médiane du segment", () => {
    const opp = detectUndervalued(boat({ price: 40000 }), { medianPrice: 55000, sampleSize: 6 })
    expect(opp).not.toBeNull()
    expect(opp!.type).toBe("sous_cotee")
  })

  it("ignore un segment trop petit", () => {
    expect(detectUndervalued(boat({ price: 40000 }), { medianPrice: 55000, sampleSize: 2 })).toBeNull()
  })
})

describe("detectExcellentScore & rarity", () => {
  it("alerte sur un score excellent", () => {
    expect(detectExcellentScore(96)!.priority).toBe("critique")
    expect(detectExcellentScore(80)).toBeNull()
  })

  it("alerte sur un modèle rare", () => {
    expect(detectRarity({ medianPrice: 0, sampleSize: 1 })).not.toBeNull()
    expect(detectRarity({ medianPrice: 0, sampleSize: 5 })).toBeNull()
  })
})

describe("priorisation", () => {
  it("retient la priorité la plus haute", () => {
    const opps = [detectExcellentScore(91)!, detectRarity({ medianPrice: 0, sampleSize: 1 })!]
    expect(highestPriority(opps)).toBe("important")
  })

  it("notifie immédiatement le critique et l'important", () => {
    expect(shouldNotifyImmediately("critique")).toBe(true)
    expect(shouldNotifyImmediately("important")).toBe(true)
    expect(shouldNotifyImmediately("faible")).toBe(false)
  })
})
