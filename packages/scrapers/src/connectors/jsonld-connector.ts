import * as cheerio from "cheerio"
import type { RawListingInput } from "@voilierscope/core"
import type { SearchQuery } from "@voilierscope/types"
import type { ConnectorContext, ConnectorHealth, RawDocument, SourceConnector, SourceRef } from "./types"
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
  /** Extrait l'identifiant externe depuis une URL d'annonce. */
  externalIdFromUrl?: (url: string) => string
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

  async discover(query: SearchQuery, ctx: ConnectorContext): Promise<SourceRef[]> {
    const max = this.config.maxListings ?? 30
    const urls = new Set<string>()

    if (this.config.sitemapUrl) {
      try {
        const xml = await ctx.fetchText(this.config.sitemapUrl)
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
          const html = await ctx.fetchText(searchUrl)
          const $ = cheerio.load(html)
          $(this.config.listingLinkSelector).each((_, el) => {
            const href = $(el).attr("href")
            if (!href) return
            urls.add(new URL(href, this.baseUrl).toString())
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
    const body = await ctx.fetchText(ref.url)
    return { source: ref.source, externalId: ref.externalId, url: ref.url, contentType: "html", body }
  }

  extract(doc: RawDocument): RawListingInput | null {
    const data = extractFromHtml(doc.body)
    if (!data.found || !data.title) return null
    return {
      source: doc.source,
      externalId: doc.externalId,
      url: doc.url,
      title: data.title,
      price: data.price,
      currency: data.currency,
      year: data.year,
      lengthM: data.lengthM,
      beam: data.beam,
      draft: data.draft,
      brand: data.brand,
      model: data.model,
      description: data.description,
      photos: data.photos ?? [],
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
