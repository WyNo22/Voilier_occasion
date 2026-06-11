import { JsonLdConnector, type JsonLdConnectorConfig } from "./jsonld-connector"
import { FeedConnector, type FeedConnectorConfig } from "./feed"
import { parseDimensionsFromText, extractRawJsonLd } from "./extract-jsonld"
import type { RawListingInput } from "@voilierscope/core"
import type { SourceConnector } from "./types"

/** Trouve le nœud JSON-LD de type Vehicle/Product dans une page. */
function findVehicleNode(html: string): Record<string, unknown> | null {
  for (const raw of extractRawJsonLd(html)) {
    try {
      const node = JSON.parse(raw)
      const type = String(node["@type"] ?? "").toLowerCase()
      if (type === "vehicle" || type === "product") return node
    } catch {
      /* bloc invalide */
    }
  }
  return null
}

/** Extraction sur-mesure bandofboats : coque, localisation, dimensions. */
function bandofboatsExtract(html: string): Partial<RawListingInput> {
  const out: Partial<RawListingInput> = {}
  const descMatch = html.match(/"description"\s*:\s*"([\s\S]*?)"\s*,\s*"/)
  if (descMatch?.[1]) Object.assign(out, parseDimensionsFromText(descMatch[1]))

  const node = findVehicleNode(html)
  const offers = node?.["offers"] as Record<string, unknown> | undefined
  if (offers) {
    const cat = String(offers["category"] ?? "")
    if (/catamaran|multicoque/i.test(cat)) out.hull = "catamaran"
    else if (/trimaran/i.test(cat)) out.hull = "trimaran"
    else if (/monocoque|voilier|sailing/i.test(cat)) out.hull = "monohull"
    if (typeof offers["availableAtOrFrom"] === "string") out.location = offers["availableAtOrFrom"] as string
  }
  return out
}

export * from "./types"
export * from "./http"
export * from "./extract-jsonld"
export { JsonLdConnector, type JsonLdConnectorConfig } from "./jsonld-connector"
export {
  FeedConnector,
  parseFeedItems,
  applyFeedMap,
  type FeedConnectorConfig,
  type FeedFieldMap,
} from "./feed"

/**
 * Configurations des sources réelles fondées sur JSON-LD / sitemap.
 *
 * ⚠️ À CALIBRER SUR MACHINE OUVERTE : les `sitemapUrl` et
 * `listingUrlPattern` ci-dessous sont des points de départ raisonnables mais
 * doivent être vérifiés sur le site réel (ils ne sont pas joignables depuis
 * l'environnement cloud à allowlist). Ajuster une fois la page chargée :
 *  1. ouvrir une fiche d'annonce, vérifier la présence de JSON-LD
 *     (`<script type="application/ld+json">`) — sinon, l'Open Graph prend le
 *     relais automatiquement.
 *  2. récupérer l'URL du sitemap (souvent /sitemap.xml ou /robots.txt → Sitemap:).
 *  3. ajuster le motif d'URL des annonces.
 */
export const REAL_SOURCE_CONFIGS: JsonLdConnectorConfig[] = [
  {
    // ✅ Calibré sur le site réel (JSON-LD schema.org/Vehicle + navigateur).
    // À lancer avec --browser (boat24 refuse le HTTP simple, OK via Chrome/Edge).
    id: "boat24",
    displayName: "Boat24",
    baseUrl: "https://www.boat24.com",
    // Découverte : liens /detail/<id> sur les pages de résultats par catégorie.
    buildSearchUrls: (query) => {
      if (query.category === "bateau_moteur") return ["https://www.boat24.com/fr/bateaux-a-moteur/"]
      return ["https://www.boat24.com/fr/voiliers/"]
    },
    listingLinkSelector: 'a[href*="/detail/"]',
    listingUrlPattern: /\/detail\/\d+\/?$/,
    externalIdFromUrl: (url) => url.match(/\/detail\/(\d+)/)?.[1] ?? url,
    category: "voilier",
    maxListings: 30,
    // Longueur/largeur ne sont pas en JSON-LD chez boat24 : on les lit dans la
    // description (« Longueur : 14,99m, Largeur 7,98m »).
    customExtract: (html) => {
      const descMatch = html.match(/"description"\s*:\s*"([\s\S]*?)"\s*,\s*"/)
      const desc = descMatch ? descMatch[1] : html
      return parseDimensionsFromText(desc)
    },
  },
  {
    // ✅ Calibré (JSON-LD schema.org/Vehicle, fiches accessibles via navigateur).
    id: "bandofboats",
    displayName: "Band of Boats",
    baseUrl: "https://www.bandofboats.com",
    buildSearchUrls: (query) => {
      if (query.category === "bateau_moteur")
        return ["https://www.bandofboats.com/fr/types-de-bateaux/bateau-a-moteur"]
      return ["https://www.bandofboats.com/fr/types-de-bateaux/voilier"]
    },
    listingLinkSelector: 'a[href*="/bateaux-a-vendre/"]',
    listingUrlPattern: /\/bateaux-a-vendre\/\d+$/,
    externalIdFromUrl: (url) => url.match(/\/bateaux-a-vendre\/(\d+)/)?.[1] ?? url,
    category: "voilier",
    maxListings: 30,
    customExtract: (html) => bandofboatsExtract(html),
  },
  {
    id: "youboat",
    displayName: "Youboat",
    baseUrl: "https://www.youboat.fr",
    sitemapUrl: "https://www.youboat.fr/sitemap.xml",
    listingUrlPattern: /\/(annonce|bateau|voilier)/i,
    maxListings: 30,
  },
  {
    id: "inautia",
    displayName: "iNautia",
    baseUrl: "https://www.inautia.com",
    sitemapUrl: "https://www.inautia.com/sitemap.xml",
    listingUrlPattern: /\/(occasion|boat|barco|bateau)/i,
    maxListings: 30,
  },
]

/** Instancie les connecteurs HTML réels à partir des configurations. */
export function getRealConnectors(): SourceConnector[] {
  return REAL_SOURCE_CONFIGS.map((c) => new JsonLdConnector(c))
}

/**
 * Configurations des **flux de données** (la voie privilégiée pour la largeur
 * d'inventaire : légale, stable, sans anti-bot).
 *
 * Vide par défaut — à remplir avec les flux réels de courtiers/partenaires.
 * Exemple type d'un flux XML de courtier :
 *
 *   {
 *     id: "courtier-untel",
 *     displayName: "Courtier Untel",
 *     baseUrl: "https://courtier-untel.fr",
 *     format: "xml",
 *     itemSelector: "boat",                 // élément répété
 *     feedUrls: ["https://courtier-untel.fr/export/boats.xml"],
 *     category: "voilier",
 *     map: {                                // champ canonique → élément XML
 *       externalId: "id", title: "name", brand: "make", model: "model",
 *       year: "buildYear", price: "priceEUR", lengthM: "lengthMeters",
 *       url: "link", photos: "photo", description: "description",
 *     },
 *   }
 *
 * Pour un flux JSON : `format: "json"`, `itemsPath: "data.listings"`, et les
 * specs de `map` deviennent des chemins pointés ("attributes.length").
 */
export const FEED_SOURCE_CONFIGS: FeedConnectorConfig[] = []

/** Instancie les connecteurs de flux à partir des configurations. */
export function getFeedConnectors(): SourceConnector[] {
  return FEED_SOURCE_CONFIGS.map((c) => new FeedConnector(c))
}

/** Tous les connecteurs réels (flux + HTML). */
export function getAllRealConnectors(): SourceConnector[] {
  return [...getFeedConnectors(), ...getRealConnectors()]
}
