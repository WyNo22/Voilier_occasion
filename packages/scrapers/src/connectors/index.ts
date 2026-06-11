import { JsonLdConnector, type JsonLdConnectorConfig } from "./jsonld-connector"
import type { SourceConnector } from "./types"

export * from "./types"
export * from "./http"
export * from "./extract-jsonld"
export { JsonLdConnector, type JsonLdConnectorConfig } from "./jsonld-connector"

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
    id: "bandofboats",
    displayName: "Band of Boats",
    baseUrl: "https://www.bandofboats.com",
    sitemapUrl: "https://www.bandofboats.com/sitemap.xml",
    listingUrlPattern: /\/(boat|bateau|annonce|listing)s?\//i,
    maxListings: 30,
  },
  {
    id: "boat24",
    displayName: "Boat24",
    baseUrl: "https://www.boat24.com",
    sitemapUrl: "https://www.boat24.com/sitemap.xml",
    listingUrlPattern: /\/(boat|sailing|voilier)s?\//i,
    maxListings: 30,
  },
]

/** Instancie les connecteurs réels à partir des configurations. */
export function getRealConnectors(): SourceConnector[] {
  return REAL_SOURCE_CONFIGS.map((c) => new JsonLdConnector(c))
}
