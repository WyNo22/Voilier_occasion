import type { BoatListing } from "@voilierscope/types"

/**
 * Déduplication d'annonces présentes sur plusieurs sources.
 *
 * Stratégie en cascade :
 *  1. URL identique (après nettoyage des paramètres de tracking).
 *  2. Empreinte « specs » : marque + modèle + année + longueur arrondie.
 *  3. (à venir) similarité texte/photos pour les cas sans specs structurées.
 */

/** Normalise une URL pour comparer deux annonces (retire query/trailing slash). */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ""
    u.hash = ""
    return `${u.host}${u.pathname}`.replace(/\/$/, "").toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

/**
 * Clé de fusion fondée sur les caractéristiques. Deux annonces de la même
 * coque (même marque/modèle/année/longueur) partagent cette clé même si elles
 * proviennent de sites différents. `null` si trop peu d'infos pour décider.
 */
export function specsKey(listing: BoatListing): string | null {
  const brand = listing.brand?.toLowerCase().trim()
  const model = listing.model?.toLowerCase().replace(/\s+/g, "")
  const year = listing.year
  const len = listing.lengthM !== undefined ? Math.round(listing.lengthM * 2) / 2 : undefined

  if (!brand || !model || !year) return null
  return `${brand}|${model}|${year}|${len ?? "?"}`
}

/** Score de confiance [0,1] que deux annonces désignent le même bateau. */
export function duplicateConfidence(a: BoatListing, b: BoatListing): number {
  if (canonicalUrl(a.url) === canonicalUrl(b.url)) return 1

  const ka = specsKey(a)
  const kb = specsKey(b)
  if (ka && kb && ka === kb) {
    // Specs identiques : conforter avec le prix s'il est proche.
    if (a.price && b.price) {
      const diff = Math.abs(a.price - b.price) / Math.max(a.price, b.price)
      return diff < 0.1 ? 0.95 : 0.8
    }
    return 0.85
  }
  return 0
}

export interface MergedListing extends BoatListing {
  /** Toutes les sources où l'annonce a été trouvée. */
  sources: string[]
  /** URLs par source. */
  duplicateUrls: string[]
}

/**
 * Fusionne les doublons d'une liste. Conserve l'annonce la plus complète
 * comme base et agrège les sources/URLs. Seuil de fusion par défaut : 0.8.
 */
export function dedupeListings(
  listings: BoatListing[],
  threshold = 0.8
): MergedListing[] {
  const merged: MergedListing[] = []

  for (const listing of listings) {
    const match = merged.find((m) => duplicateConfidence(m, listing) >= threshold)
    if (match) {
      if (!match.sources.includes(listing.source)) match.sources.push(listing.source)
      if (!match.duplicateUrls.includes(listing.url)) match.duplicateUrls.push(listing.url)
      // Garde le prix le plus bas (meilleure affaire) et complète les trous.
      if (listing.price && (!match.price || listing.price < match.price)) {
        match.price = listing.price
      }
      if (completeness(listing) > completeness(match)) {
        Object.assign(match, fillGaps(match, listing))
      }
    } else {
      merged.push({
        ...listing,
        sources: [listing.source],
        duplicateUrls: [listing.url],
      })
    }
  }

  return merged
}

/** Nombre de champs renseignés — proxy de complétude d'une annonce. */
function completeness(l: BoatListing): number {
  return Object.values(l).filter((v) => v !== undefined && v !== null && v !== "").length
}

/** Complète les champs manquants de `base` avec ceux de `extra`. */
function fillGaps(base: MergedListing, extra: BoatListing): Partial<BoatListing> {
  const out: Record<string, unknown> = {}
  const baseRecord = base as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(extra)) {
    const current = baseRecord[key]
    if ((current === undefined || current === null || current === "") && value != null) {
      out[key] = value
    }
  }
  return out as Partial<BoatListing>
}
