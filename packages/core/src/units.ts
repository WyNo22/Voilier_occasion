/**
 * Conversions d'unités vers le système canonique de VoilierScope :
 * longueurs en mètres, prix en euros, distances en km, vitesses en km/h.
 *
 * Toutes les fonctions sont pures et arrondies de façon déterministe pour
 * rester testables et stables d'une exécution à l'autre.
 */

export const FEET_TO_METERS = 0.3048
export const NAUTICAL_MILE_TO_KM = 1.852
export const KNOT_TO_KMH = 1.852

/** Taux de change de secours (1 unité de devise → EUR). À rafraîchir via API en prod. */
export const FALLBACK_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.04,
}

function round(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function feetToMeters(feet: number): number {
  return round(feet * FEET_TO_METERS)
}

export function metersToFeet(meters: number): number {
  return round(meters / FEET_TO_METERS)
}

export function nauticalMilesToKm(nm: number): number {
  return round(nm * NAUTICAL_MILE_TO_KM)
}

export function knotsToKmh(knots: number): number {
  return round(knots * KNOT_TO_KMH)
}

/**
 * Convertit un montant vers l'euro. Devise inconnue → montant inchangé,
 * pour ne jamais fabriquer un prix faux silencieusement.
 */
export function toEur(
  amount: number,
  currency: string,
  rates: Record<string, number> = FALLBACK_RATES_TO_EUR
): number {
  const code = currency?.toUpperCase().trim()
  const rate = rates[code]
  if (rate === undefined) return Math.round(amount)
  return Math.round(amount * rate)
}

/** Devise détectée à partir d'un symbole ou code présent dans un texte. */
export function detectCurrency(raw: string): string | undefined {
  const s = raw.toLowerCase()
  if (s.includes("€") || /\beur\b/.test(s)) return "EUR"
  if (s.includes("$") || /\busd\b/.test(s)) return "USD"
  if (s.includes("£") || /\bgbp\b/.test(s)) return "GBP"
  if (/\bchf\b/.test(s)) return "CHF"
  return undefined
}

/**
 * Extrait un nombre depuis une chaîne de prix hétérogène
 * ("58 000 €", "58,000", "€58.000", "1.2M") → number en unité brute.
 */
export function parsePriceNumber(raw: string): number | undefined {
  if (!raw) return undefined
  const s = raw.replace(/\s| /g, "").toLowerCase()

  const millions = s.match(/([\d.,]+)\s*m(?:io|illion)?/)
  if (millions && millions[1]) {
    const n = parseFloat(millions[1].replace(",", "."))
    if (!Number.isNaN(n)) return Math.round(n * 1_000_000)
  }

  // Retire tout sauf chiffres/séparateurs puis enlève les séparateurs de
  // milliers (., , ou espace déjà ôté) en gardant un éventuel décimal.
  const digits = s.replace(/[^\d.,]/g, "")
  if (!digits) return undefined
  // Heuristique : si le dernier séparateur laisse 1-2 décimales, c'est un
  // décimal ; sinon ce sont des milliers.
  const normalized = digits.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? undefined : Math.round(n)
}
