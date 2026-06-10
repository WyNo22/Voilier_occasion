import { describe, it, expect } from "vitest"
import {
  feetToMeters,
  metersToFeet,
  nauticalMilesToKm,
  knotsToKmh,
  toEur,
  detectCurrency,
  parsePriceNumber,
} from "./units"

describe("conversions d'unités", () => {
  it("convertit les pieds en mètres", () => {
    expect(feetToMeters(30)).toBe(9.14)
    expect(feetToMeters(0)).toBe(0)
  })

  it("convertit les mètres en pieds (réversible)", () => {
    expect(metersToFeet(9.14)).toBeCloseTo(29.99, 1)
  })

  it("convertit les milles nautiques en km", () => {
    expect(nauticalMilesToKm(100)).toBe(185.2)
  })

  it("convertit les nœuds en km/h", () => {
    expect(knotsToKmh(10)).toBe(18.52)
  })
})

describe("devises", () => {
  it("convertit USD vers EUR avec le taux de secours", () => {
    expect(toEur(1000, "USD")).toBe(920)
  })

  it("laisse l'EUR inchangé", () => {
    expect(toEur(58000, "EUR")).toBe(58000)
  })

  it("ne fabrique pas un prix faux pour une devise inconnue", () => {
    expect(toEur(1000, "JPY")).toBe(1000)
  })

  it("détecte la devise depuis un texte", () => {
    expect(detectCurrency("58 000 €")).toBe("EUR")
    expect(detectCurrency("$120,000")).toBe("USD")
    expect(detectCurrency("£90,000")).toBe("GBP")
    expect(detectCurrency("aucune")).toBeUndefined()
  })
})

describe("parsePriceNumber", () => {
  it("parse les formats à séparateurs de milliers", () => {
    expect(parsePriceNumber("58 000 €")).toBe(58000)
    expect(parsePriceNumber("€58.000")).toBe(58000)
    expect(parsePriceNumber("120,000")).toBe(120000)
  })

  it("parse les millions", () => {
    expect(parsePriceNumber("1.2M")).toBe(1200000)
  })

  it("retourne undefined si pas de nombre", () => {
    expect(parsePriceNumber("nous consulter")).toBeUndefined()
  })
})
