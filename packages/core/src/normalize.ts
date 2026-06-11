import type { BoatListing } from "@voilierscope/types"
import { feetToMeters, metersToFeet, toEur } from "./units"

/**
 * Entrée brute d'un connecteur, avant unification. Les champs peuvent être
 * exprimés dans n'importe quelle unité ; `normalizeListing` les ramène au
 * schéma canonique (`BoatListing`).
 */
export interface RawListingInput {
  source: string
  externalId: string
  url: string
  title?: string
  price?: number
  currency?: string
  lengthM?: number
  lengthFt?: number
  year?: number
  beam?: number
  draft?: number
  brand?: string
  model?: string
  hull?: string
  location?: string
  description?: string
  photos?: string[]
  condition?: string
  equipment?: BoatListing["equipment"]
  engineBrand?: string
  enginePower?: number
  engineHours?: number
  cabins?: number
  berths?: number
  [key: string]: unknown
}

/** Marques connues → graphie canonique (corrige casse/accents/variantes). */
const BRAND_CANONICAL: Record<string, string> = {
  beneteau: "Bénéteau",
  "bénéteau": "Bénéteau",
  jeanneau: "Jeanneau",
  dufour: "Dufour",
  bavaria: "Bavaria",
  hanse: "Hanse",
  amel: "Amel",
  alubat: "Alubat",
  ovni: "Alubat",
  "hallberg-rassy": "Hallberg-Rassy",
  "hallberg rassy": "Hallberg-Rassy",
  lagoon: "Lagoon",
  "fountaine pajot": "Fountaine Pajot",
  nauticat: "Nauticat",
}

export function canonicalBrand(brand?: string): string | undefined {
  if (!brand) return undefined
  const key = brand.toLowerCase().trim()
  return BRAND_CANONICAL[key] ?? brand.trim()
}

function normalizeHull(hull?: string): BoatListing["hull"] {
  if (!hull) return undefined
  const h = hull.toLowerCase()
  if (h.includes("cata")) return "catamaran"
  if (h.includes("tri")) return "trimaran"
  if (h.includes("mono") || h.includes("voilier") || h.includes("sail")) return "monohull"
  return undefined
}

function cleanText(text?: string): string | undefined {
  if (!text) return undefined
  return text.replace(/\s+/g, " ").trim() || undefined
}

/**
 * Convertit une entrée brute de connecteur en `BoatListing` canonique :
 * longueurs en mètres (+ pieds dérivés), prix en euros, marque/coque
 * normalisées, texte nettoyé.
 */
export function normalizeListing(
  raw: RawListingInput,
  rates?: Record<string, number>
): BoatListing {
  const lengthM =
    raw.lengthM ?? (raw.lengthFt !== undefined ? feetToMeters(raw.lengthFt) : undefined)
  const lengthFt =
    raw.lengthFt ?? (lengthM !== undefined ? metersToFeet(lengthM) : undefined)

  const currency = (raw.currency || "EUR").toUpperCase()
  const price =
    raw.price !== undefined ? toEur(raw.price, currency, rates) : undefined

  return {
    id: `${raw.source}-${raw.externalId}`,
    source: raw.source,
    title: cleanText(raw.title) || "Voilier sans titre",
    price,
    currency: "EUR",
    year: raw.year,
    lengthM,
    lengthFt,
    beam: raw.beam,
    draft: raw.draft,
    brand: canonicalBrand(raw.brand),
    model: cleanText(raw.model),
    hull: normalizeHull(raw.hull),
    location: cleanText(raw.location),
    description: cleanText(raw.description),
    photos: raw.photos ?? [],
    url: raw.url,
    condition: cleanText(raw.condition),
    equipment: raw.equipment,
    engineBrand: cleanText(raw.engineBrand),
    enginePower: raw.enginePower,
    engineHours: raw.engineHours,
    cabins: raw.cabins,
    berths: raw.berths,
    scrapedAt: new Date(),
  }
}
