import * as cheerio from "cheerio"
import type { RawListingInput } from "@voilierscope/core"
import { parsePriceNumber, detectCurrency } from "@voilierscope/core"

/**
 * Extraction des données structurées d'une page d'annonce.
 *
 * Stratégie robuste et peu fragile : on lit en priorité le JSON-LD
 * (schema.org Product / Vehicle / Offer), présent sur une grande partie des
 * sites marchands, puis on complète avec les balises Open Graph. On évite de
 * dépendre de sélecteurs CSS spécifiques à chaque site, qui cassent au moindre
 * redesign.
 */

type Json = Record<string, unknown>

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

/** Aplati les @graph et tableaux pour obtenir tous les nœuds JSON-LD. */
function collectNodes(parsed: unknown): Json[] {
  const out: Json[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
    } else if (node && typeof node === "object") {
      const obj = node as Json
      out.push(obj)
      if ("@graph" in obj) visit(obj["@graph"])
    }
  }
  visit(parsed)
  return out
}

const LISTING_TYPES = new Set([
  "product",
  "individualproduct",
  "vehicle",
  "car",
  "boat",
  "offer",
])

function typeMatches(node: Json): boolean {
  const types = asArray(node["@type"]).map((t) => String(t).toLowerCase())
  if (types.some((t) => LISTING_TYPES.has(t))) return true
  // Nœud sans type explicite mais porteur d'une offre/prix : on l'accepte.
  return "offers" in node || "price" in node
}

function readOffer(node: Json): { price?: number; currency?: string } {
  const offers = asArray(node["offers"] as Json | Json[])[0]
  const priceRaw =
    (offers?.["price"] as string | number | undefined) ??
    (node["price"] as string | number | undefined)
  const currencyRaw =
    (offers?.["priceCurrency"] as string | undefined) ??
    (node["priceCurrency"] as string | undefined)

  let price: number | undefined
  if (typeof priceRaw === "number") price = Math.round(priceRaw)
  else if (typeof priceRaw === "string") price = parsePriceNumber(priceRaw)

  return { price, currency: currencyRaw }
}

function readBrand(node: Json): string | undefined {
  const brand = node["brand"] ?? node["manufacturer"]
  if (!brand) return undefined
  if (typeof brand === "string") return brand
  if (typeof brand === "object") return (brand as Json)["name"] as string | undefined
  return undefined
}

function readYear(node: Json): number | undefined {
  const candidates = [node["productionDate"], node["modelDate"], node["vehicleModelDate"], node["releaseDate"]]
  for (const c of candidates) {
    if (typeof c === "string" || typeof c === "number") {
      const m = String(c).match(/\d{4}/)
      if (m) return parseInt(m[0], 10)
    }
  }
  return undefined
}

function readImages(node: Json): string[] {
  const imgs = asArray(node["image"] as string | string[] | Json | Json[])
  return imgs
    .map((i) => (typeof i === "string" ? i : (i as Json)?.["url"]))
    .filter((u): u is string => typeof u === "string")
}

/** Cherche une dimension (longueur, largeur, tirant) dans additionalProperty. */
function readSpecs(node: Json): { lengthM?: number; beam?: number; draft?: number } {
  const props = asArray(node["additionalProperty"] as Json | Json[])
  const specs: { lengthM?: number; beam?: number; draft?: number } = {}
  for (const p of props) {
    const name = String(p["name"] ?? "").toLowerCase()
    const value = p["value"]
    const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."))
    if (Number.isNaN(num)) continue
    if (/longueur|length|loa|hors.?tout/.test(name)) specs.lengthM = num
    else if (/largeur|beam|width|bau/.test(name)) specs.beam = num
    else if (/tirant|draft|draught/.test(name)) specs.draft = num
  }
  return specs
}

/** Récupère le contenu d'une balise meta (Open Graph / name). */
function meta($: cheerio.CheerioAPI, key: string): string | undefined {
  return (
    $(`meta[property="${key}"]`).attr("content") ||
    $(`meta[name="${key}"]`).attr("content") ||
    undefined
  )
}

export interface ExtractResult extends Partial<RawListingInput> {
  /** Indique si des données structurées exploitables ont été trouvées. */
  found: boolean
}

/** Retourne le contenu brut des blocs JSON-LD (pour calibration). */
export function extractRawJsonLd(html: string): string[] {
  const $ = cheerio.load(html)
  const blocks: string[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim()
    if (raw) blocks.push(raw)
  })
  return blocks
}

/**
 * Extrait des dimensions (longueur, largeur, tirant d'eau) depuis un texte
 * libre français du type « Longueur : 14,99m, Largeur 7,98 m ». Utile en
 * complément quand le site ne fournit pas ces specs en structuré.
 */
export function parseDimensionsFromText(text: string): {
  lengthM?: number
  beam?: number
  draft?: number
} {
  if (!text) return {}
  const num = (re: RegExp): number | undefined => {
    const m = text.match(re)
    if (!m || !m[1]) return undefined
    const n = parseFloat(m[1].replace(",", "."))
    return Number.isNaN(n) || n <= 0 || n > 200 ? undefined : n
  }
  return {
    lengthM: num(/longueur[^0-9]{0,12}(\d{1,3}(?:[.,]\d{1,2})?)\s*m\b/i),
    beam: num(/largeur[^0-9]{0,12}(\d{1,2}(?:[.,]\d{1,2})?)\s*m\b/i),
    draft: num(/tirant[^0-9]{0,18}(\d{1,2}(?:[.,]\d{1,2})?)\s*m\b/i),
  }
}

/** Liste les liens internes correspondant à un motif (découverte d'annonces). */
export function extractLinks(html: string, baseUrl: string, pattern: RegExp): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      return
    }
    if (pattern.test(abs)) urls.add(abs)
  })
  return Array.from(urls)
}

/** Rapport de diagnostic d'une page, pour calibrer un connecteur. */
export interface PageDiagnosis {
  jsonLdBlocks: number
  jsonLdTypes: string[]
  ogTags: Record<string, string>
  extracted: ExtractResult
}

/**
 * Analyse une page et retourne ce qu'on peut en tirer : nombre de blocs
 * JSON-LD, leurs @type, les balises Open Graph présentes, et le résultat
 * d'extraction. Sert à la commande de calibration.
 */
export function diagnoseHtml(html: string): PageDiagnosis {
  const $ = cheerio.load(html)
  const types: string[] = []
  let blocks = 0
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    if (!raw.trim()) return
    blocks++
    try {
      collectNodes(JSON.parse(raw)).forEach((n) => {
        asArray(n["@type"]).forEach((t) => types.push(String(t)))
      })
    } catch {
      types.push("(JSON-LD invalide)")
    }
  })

  const ogTags: Record<string, string> = {}
  for (const key of [
    "og:title",
    "og:description",
    "og:image",
    "product:price:amount",
    "product:price:currency",
    "og:price:amount",
    "og:price:currency",
  ]) {
    const v = meta($, key)
    if (v) ogTags[key] = v
  }

  return {
    jsonLdBlocks: blocks,
    jsonLdTypes: Array.from(new Set(types)),
    ogTags,
    extracted: extractFromHtml(html),
  }
}

/**
 * Extrait les champs canoniques d'une page HTML d'annonce.
 * Retourne `found: false` si rien d'exploitable n'a été trouvé.
 */
export function extractFromHtml(html: string): ExtractResult {
  const $ = cheerio.load(html)

  // 1) JSON-LD
  let listingNode: Json | undefined
  $('script[type="application/ld+json"]').each((_, el) => {
    if (listingNode) return
    const raw = $(el).contents().text()
    if (!raw.trim()) return
    try {
      const parsed = JSON.parse(raw)
      const node = collectNodes(parsed).find(typeMatches)
      if (node) listingNode = node
    } catch {
      // JSON-LD malformé : on ignore ce bloc.
    }
  })

  const result: ExtractResult = { found: false, photos: [] }

  if (listingNode) {
    const { price, currency } = readOffer(listingNode)
    const specs = readSpecs(listingNode)
    result.found = true
    result.title = (listingNode["name"] as string) || undefined
    result.description = (listingNode["description"] as string) || undefined
    result.price = price
    result.currency = currency
    result.brand = readBrand(listingNode)
    result.model = (listingNode["model"] as string) || (listingNode["mpn"] as string) || undefined
    result.year = readYear(listingNode)
    result.photos = readImages(listingNode)
    result.lengthM = specs.lengthM
    result.beam = specs.beam
    result.draft = specs.draft
    // schema.org/Vehicle : type de coque et motorisation.
    if (typeof listingNode["bodyType"] === "string") result.hull = listingNode["bodyType"] as string
    if (typeof listingNode["vehicleEngine"] === "string") {
      result.engineBrand = listingNode["vehicleEngine"] as string
    }
  }

  // 2) Open Graph en complément (ne remplace jamais une valeur déjà trouvée)
  const ogTitle = meta($, "og:title")
  const ogDesc = meta($, "og:description")
  const ogImage = meta($, "og:image")
  const ogPriceAmount = meta($, "product:price:amount") || meta($, "og:price:amount")
  const ogPriceCurrency = meta($, "product:price:currency") || meta($, "og:price:currency")

  if (ogTitle && !result.title) {
    result.title = ogTitle
    result.found = true
  }
  if (ogDesc && !result.description) result.description = ogDesc
  if (ogImage && (!result.photos || result.photos.length === 0)) result.photos = [ogImage]
  if (ogPriceAmount && result.price === undefined) {
    result.price = parsePriceNumber(ogPriceAmount)
    result.found = true
  }
  if (ogPriceCurrency && !result.currency) result.currency = ogPriceCurrency

  // 3) Devise déduite du texte si toujours absente mais prix présent
  if (result.price !== undefined && !result.currency) {
    const priceText = $('[itemprop="price"], .price, .prix').first().text()
    result.currency = detectCurrency(priceText) ?? "EUR"
  }

  return result
}
