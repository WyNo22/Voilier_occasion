import * as cheerio from "cheerio"
import type { RawListingInput } from "@voilierscope/core"
import { parsePriceNumber } from "@voilierscope/core"
import type { SearchQuery, VehicleCategory } from "@voilierscope/types"
import type { ConnectorContext, ConnectorHealth, RawDocument, SourceConnector, SourceRef } from "./types"

/**
 * Connecteur générique pour les **flux de données** (XML/RSS, JSON, API de
 * courtiers). C'est la voie privilégiée pour la couverture large : légale,
 * stable, et sans anti-bot. Chaque entrée du flux est déjà structurée — on la
 * mappe vers le schéma canonique via une configuration déclarative.
 */

type FieldSpec = string | ((item: unknown) => unknown)

/** Mappe les champs canoniques vers un chemin (JSON) / nom d'élément (XML). */
export type FeedFieldMap = {
  [K in keyof RawListingInput]?: FieldSpec
}

export interface FeedConnectorConfig {
  id: string
  displayName: string
  baseUrl: string
  format: "xml" | "json"
  /** URLs du flux (statique ou dérivé de la recherche). */
  feedUrls: string[] | ((query: SearchQuery) => string[])
  /** XML : nom de l'élément répété (ex: "item", "boat", "advert"). */
  itemSelector?: string
  /** JSON : chemin vers le tableau d'items (ex: "data.listings"). */
  itemsPath?: string
  /** Mapping déclaratif champ → chemin/élément. */
  map: FeedFieldMap
  /** Catégorie par défaut des annonces de ce flux. */
  category?: VehicleCategory
  maxItems?: number
}

/** Champs numériques à coercer depuis une chaîne. */
const NUMERIC_FIELDS = new Set([
  "year",
  "lengthM",
  "lengthFt",
  "beam",
  "draft",
  "enginePower",
  "engineHours",
  "cabins",
  "berths",
])

/** Navigue un objet via un chemin pointé ("a.b.c"). */
function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** Extrait les items d'un corps de flux (XML ou JSON) sous forme d'objets plats. */
export function parseFeedItems(
  body: string,
  config: Pick<FeedConnectorConfig, "format" | "itemSelector" | "itemsPath">
): Record<string, unknown>[] {
  if (config.format === "json") {
    const parsed = JSON.parse(body)
    const arr = config.itemsPath ? getByPath(parsed, config.itemsPath) : parsed
    return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
  }

  // XML : chaque élément répété → record {tag: value | value[]}.
  const $ = cheerio.load(body, { xmlMode: true })
  const selector = config.itemSelector || "item"
  const items: Record<string, unknown>[] = []
  $(selector).each((_, el) => {
    const record: Record<string, unknown> = {}
    $(el)
      .children()
      .each((__, child) => {
        const tag = child.tagName || (child as { name?: string }).name || ""
        if (!tag) return
        const text = $(child).text().trim()
        const existing = record[tag]
        if (existing === undefined) record[tag] = text
        else if (Array.isArray(existing)) (existing as string[]).push(text)
        else record[tag] = [existing as string, text]
      })
    items.push(record)
  })
  return items
}

function coerce(field: string, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined
  if (field === "price") return parsePriceNumber(String(value))
  if (field === "photos") return Array.isArray(value) ? value : [String(value)]
  if (NUMERIC_FIELDS.has(field)) {
    const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."))
    return Number.isNaN(n) ? undefined : n
  }
  return typeof value === "string" ? value : value
}

/** Applique un mapping déclaratif à un item de flux → champs canoniques. */
export function applyFeedMap(item: Record<string, unknown>, map: FeedFieldMap): Partial<RawListingInput> {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(map)) {
    if (!spec) continue
    const raw = typeof spec === "function" ? spec(item) : getByPath(item, spec) ?? item[spec]
    const value = coerce(field, raw)
    if (value !== undefined) out[field] = value
  }
  return out as Partial<RawListingInput>
}

export class FeedConnector implements SourceConnector {
  readonly id: string
  readonly displayName: string
  readonly baseUrl: string
  readonly kind = "api" as const

  /** Items récupérés au discover, indexés par externalId (évite un 2e fetch). */
  private cache = new Map<string, Record<string, unknown>>()

  constructor(private readonly config: FeedConnectorConfig) {
    this.id = config.id
    this.displayName = config.displayName
    this.baseUrl = config.baseUrl
  }

  private feedUrls(query: SearchQuery): string[] {
    return typeof this.config.feedUrls === "function"
      ? this.config.feedUrls(query)
      : this.config.feedUrls
  }

  private externalIdOf(item: Record<string, unknown>, mapped: Partial<RawListingInput>): string {
    if (mapped.externalId) return String(mapped.externalId)
    const guid = item.guid ?? item.id ?? mapped.url
    if (guid) return String(guid).replace(/[^a-zA-Z0-9_-]/g, "").slice(-40) || String(guid)
    return Math.random().toString(36).slice(2)
  }

  async discover(query: SearchQuery, ctx: ConnectorContext): Promise<SourceRef[]> {
    const max = this.config.maxItems ?? 200
    const refs: SourceRef[] = []
    this.cache.clear()

    for (const url of this.feedUrls(query)) {
      try {
        const body = await ctx.fetchText(url)
        const items = parseFeedItems(body, this.config)
        for (const item of items) {
          const mapped = applyFeedMap(item, this.config.map)
          const externalId = this.externalIdOf(item, mapped)
          const listingUrl = mapped.url ? String(mapped.url) : `${this.baseUrl}#${externalId}`
          this.cache.set(externalId, item)
          refs.push({ source: this.id, externalId, url: listingUrl })
          if (refs.length >= max) break
        }
        await new Promise((r) => setTimeout(r, ctx.politeDelayMs))
      } catch (err) {
        ctx.log("warn", `${this.id}: flux illisible (${url})`, err)
      }
      if (refs.length >= max) break
    }
    return refs
  }

  async fetchDetail(ref: SourceRef, _ctx: ConnectorContext): Promise<RawDocument> {
    // Le flux contient déjà les données : pas de second appel réseau.
    const item = this.cache.get(ref.externalId) ?? {}
    return {
      source: ref.source,
      externalId: ref.externalId,
      url: ref.url,
      contentType: "json",
      body: JSON.stringify(item),
    }
  }

  extract(doc: RawDocument): RawListingInput | null {
    let item: Record<string, unknown>
    try {
      item = JSON.parse(doc.body)
    } catch {
      return null
    }
    const mapped = applyFeedMap(item, this.config.map)
    if (!mapped.title) return null
    return {
      source: doc.source,
      externalId: doc.externalId,
      url: doc.url,
      category: this.config.category,
      ...mapped,
    }
  }

  async healthcheck(ctx: ConnectorContext): Promise<ConnectorHealth> {
    const start = Date.now()
    const urls = this.feedUrls({ raw: "" })
    const ok = urls.length > 0 ? await ctx.fetchOk(urls[0]!) : false
    return {
      id: this.id,
      ok,
      latencyMs: Date.now() - start,
      message: ok ? undefined : "flux injoignable",
    }
  }
}
