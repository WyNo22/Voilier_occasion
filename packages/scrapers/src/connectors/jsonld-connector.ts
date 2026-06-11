import * as cheerio from "cheerio"
import type { RawListingInput } from "@voilierscope/core"
import type { SearchQuery, VehicleCategory } from "@voilierscope/types"
import type { ConnectorContext, ConnectorHealth, RawDocument, SourceConnector, SourceRef, SourceTransport } from "./types"
import { extractFromHtml } from "./extract-jsonld"

export interface JsonLdConnectorConfig {
  id: string
  displayName: string
  baseUrl: string
  /**
   * Découverte des annonces. Deux modes :
   *  - `sitemapUrl` : on lit un sitemap.xml et on garde les URLs d'annonces.
   *  - `buildSearchUrls` : construit des URLs de pages de résultats à parser.
   * Au moins un des deux doit être fourni.
   */
  sitemapUrl?: string
  /** Filtre les URLs du sitemap pour ne garder que les annonces. */
  listingUrlPattern?: RegExp
  /** Construit des URLs de pages de résultats à partir d'une recherche. */
  buildSearchUrls?: (query: SearchQuery) => string[]
  /** Sélecteur CSS des liens d'annonces sur une page de résultats. */
  listingLinkSelector?: string
  /** Nombre maximum d'annonces récupérées par recherche (politesse). */
  maxListings?: number
  /** Catégorie de véhicule par défaut des annonces de cette source. */
  category?: VehicleCategory
  /**
   * Transport dédié à cette source (sinon le transport du contexte est utilisé).
   * C'est ici qu'on branche un fetcher spécifique à une source protégée.
   */
  transport?: SourceTransport
  /** Extrait l'identifiant externe depuis une URL d'annonce. */
  externalIdFromUrl?: (url: string) => string
  /**
   * Extraction sur-mesure propre à la source (tableau de specs, localisation,
   * équipements en texte…). Ses valeurs définies complètent/écrasent celles
   * issues du JSON-LD/Open Graph. Optionnel.
   */
  customExtract?: (html: string, $: cheerio.CheerioAPI) => Partial<RawListingInput>
}

function defaultExternalId(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split("/").filter(Boolean).pop() || u.pathname
    const num = last.match(/\d{3,}/)
    return num ? num[0] : last
  } catch {
    return url
  }
}

/**
 * Connecteur générique fondé sur les données structurées (JSON-LD / Open
 * Graph). Réutilisable pour toute source qui publie ces données ; il suffit
 * de fournir une config. C'est la voie privilégiée : robuste et respectueuse.
 */
export class JsonLdConnector implements SourceConnector {
  readonly id: string
  readonly displayName: string
  readonly baseUrl: string
  readonly kind = "html" as const

  constructor(private readonly config: JsonLdConnectorConfig) {
    this.id = config.id
    this.displayName = config.displayName
    this.baseUrl = config.baseUrl
  }

  /** Récupère une URL via le transport dédié de la source, sinon celui du contexte. */
  private fetch(url: string, ctx: ConnectorContext): Promise<string> {
    return this.config.transport ? this.config.transport(url, ctx) : ctx.fetchText(url)
  }

  async discover(query: SearchQuery, ctx: ConnectorContext): Promise<SourceRef[]> {
    const max = this.config.maxListings ?? 30
    const urls = new Set<string>()

    if (this.config.sitemapUrl) {
      try {
        const xml = await this.fetch(this.config.sitemapUrl, ctx)
        const $ = cheerio.load(xml, { xmlMode: true })
        $("loc").each((_, el) => {
          const loc = $(el).text().trim()
          if (!loc) return
          if (!this.config.listingUrlPattern || this.config.listingUrlPattern.test(loc)) {
            urls.add(loc)
          }
        })
      } catch (err) {
        ctx.log("warn", `${this.id}: sitemap illisible`, err)
      }
    }

    if (this.config.buildSearchUrls && this.config.listingLinkSelector) {
      for (const searchUrl of this.config.buildSearchUrls(query)) {
        try {
          const html = await this.fetch(searchUrl, ctx)
          const $ = cheerio.load(html)
          $(this.config.listingLinkSelector).each((_, el) => {
            const href = $(el).attr("href")
            if (!href) return
            let abs: URL
            try {
              abs = new URL(href, this.baseUrl)
            } catch {
              return
            }
            abs.hash = "" // ignore les ancres (#gallery, #contact…)
            const clean = abs.toString()
            if (this.config.listingUrlPattern && !this.config.listingUrlPattern.test(clean)) return
            urls.add(clean)
          })
          await new Promise((r) => setTimeout(r, ctx.politeDelayMs))
        } catch (err) {
          ctx.log("warn", `${this.id}: page de résultats illisible (${searchUrl})`, err)
        }
      }
    }

    const idOf = this.config.externalIdFromUrl ?? defaultExternalId
    return Array.from(urls)
      .slice(0, max)
      .map((url) => ({ source: this.id, externalId: idOf(url), url }))
  }

  async fetchDetail(ref: SourceRef, ctx: ConnectorContext): Promise<RawDocument> {
    const body = await this.fetch(ref.url, ctx)
    return { source: ref.source, externalId: ref.externalId, url: ref.url, contentType: "html", body }
  }

  extract(doc: RawDocument): RawListingInput | null {
    const data = extractFromHtml(doc.body)

    // Extraction sur-mesure éventuelle, propre à la source.
    let custom: Partial<RawListingInput> = {}
    if (this.config.customExtract) {
      try {
        custom = this.config.customExtract(doc.body, cheerio.load(doc.body)) || {}
      } catch {
        custom = {}
      }
    }

    const title = custom.title ?? data.title
    if ((!data.found && Object.keys(custom).length === 0) || !title) return null

    // Les valeurs sur-mesure définies priment ; sinon on garde le JSON-LD/OG.
    const pick = <T>(a: T | undefined, b: T | undefined): T | undefined => (a !== undefined ? a : b)

    return {
      source: doc.source,
      externalId: doc.externalId,
      url: doc.url,
      category: this.config.category,
      title,
      price: pick(custom.price, data.price),
      currency: pick(custom.currency, data.currency),
      year: pick(custom.year, data.year),
      lengthM: pick(custom.lengthM, data.lengthM),
      beam: pick(custom.beam, data.beam),
      draft: pick(custom.draft, data.draft),
      brand: pick(custom.brand, data.brand),
      model: pick(custom.model, data.model),
      hull: pick(custom.hull, data.hull),
      location: pick(custom.location, data.location),
      description: pick(custom.description, data.description),
      photos: custom.photos ?? data.photos ?? [],
      equipment: pick(custom.equipment, data.equipment),
      engineBrand: pick(custom.engineBrand, data.engineBrand),
      enginePower: custom.enginePower,
      engineHours: custom.engineHours,
      cabins: custom.cabins,
      berths: custom.berths,
    }
  }

  async healthcheck(ctx: ConnectorContext): Promise<ConnectorHealth> {
    const start = Date.now()
    const ok = await ctx.fetchOk(this.baseUrl)
    return {
      id: this.id,
      ok,
      latencyMs: Date.now() - start,
      message: ok ? undefined : "injoignable (réseau ou anti-bot)",
    }
  }
}
