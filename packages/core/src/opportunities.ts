import type { BoatListing } from "@voilierscope/types"

/**
 * Détection d'opportunités pour l'agent de veille, et priorisation des
 * alertes. Logique pure : prend un état (annonce, historique, segment) et
 * en déduit des événements notifiables — sans réseau ni DB.
 */

export type AlertPriority = "critique" | "important" | "faible"

export type OpportunityType =
  | "nouvelle_annonce"
  | "baisse_prix"
  | "sous_cotee"
  | "excellent_score"
  | "rare"

export interface Opportunity {
  type: OpportunityType
  priority: AlertPriority
  /** Message court prêt pour une notification. */
  message: string
  /** Données chiffrées utiles (ex: %baisse, score). */
  meta: Record<string, number>
}

export interface PricePoint {
  price: number
  date: Date
}

export interface SegmentStats {
  /** Prix médian d'annonces comparables (même segment marque/modèle/taille). */
  medianPrice: number
  /** Nombre d'annonces dans le segment (pour juger la rareté). */
  sampleSize: number
}

/** Médiane d'une série de nombres. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

/**
 * Détecte une baisse de prix significative depuis le dernier point connu.
 * Seuil par défaut : 3 % (filtre le bruit d'arrondi).
 */
export function detectPriceDrop(
  current: number,
  history: PricePoint[],
  minDropPct = 0.03
): Opportunity | null {
  if (history.length === 0) return null
  const last = [...history].sort((a, b) => b.date.getTime() - a.date.getTime())[0]!
  if (current >= last.price) return null
  const dropPct = (last.price - current) / last.price
  if (dropPct < minDropPct) return null

  const pct = Math.round(dropPct * 100)
  return {
    type: "baisse_prix",
    priority: pct >= 10 ? "critique" : pct >= 5 ? "important" : "faible",
    message: `Baisse de prix de ${pct} % (${last.price.toLocaleString("fr-FR")} € → ${current.toLocaleString("fr-FR")} €).`,
    meta: { dropPct: pct, from: last.price, to: current },
  }
}

/**
 * Détecte une annonce sous-cotée par rapport à la médiane de son segment.
 * Seuil par défaut : 15 % sous la médiane, sur un segment d'au moins 4 annonces.
 */
export function detectUndervalued(
  listing: BoatListing,
  segment: SegmentStats,
  minDiscount = 0.15
): Opportunity | null {
  if (!listing.price || segment.sampleSize < 4 || segment.medianPrice <= 0) return null
  const discount = (segment.medianPrice - listing.price) / segment.medianPrice
  if (discount < minDiscount) return null

  const pct = Math.round(discount * 100)
  return {
    type: "sous_cotee",
    priority: pct >= 25 ? "critique" : "important",
    message: `${pct} % sous la médiane du segment (${segment.medianPrice.toLocaleString("fr-FR")} €).`,
    meta: { discountPct: pct, median: segment.medianPrice, price: listing.price },
  }
}

/** Opportunité « excellent score » pour une annonce très adéquate. */
export function detectExcellentScore(score: number): Opportunity | null {
  if (score < 90) return null
  return {
    type: "excellent_score",
    priority: score >= 95 ? "critique" : "important",
    message: `Correspondance ${score} % avec votre recherche.`,
    meta: { score },
  }
}

/** Opportunité « annonce rare » quand le segment est très peu fourni. */
export function detectRarity(segment: SegmentStats): Opportunity | null {
  if (segment.sampleSize > 2) return null
  return {
    type: "rare",
    priority: "important",
    message:
      segment.sampleSize <= 1
        ? "Modèle rare : seule annonce de ce type actuellement détectée."
        : "Modèle peu fréquent sur le marché.",
    meta: { sampleSize: segment.sampleSize },
  }
}

const PRIORITY_RANK: Record<AlertPriority, number> = {
  critique: 3,
  important: 2,
  faible: 1,
}

/** Priorité la plus élevée parmi une liste d'opportunités. */
export function highestPriority(opportunities: Opportunity[]): AlertPriority | null {
  if (opportunities.length === 0) return null
  return opportunities.reduce<AlertPriority>(
    (best, o) => (PRIORITY_RANK[o.priority] > PRIORITY_RANK[best] ? o.priority : best),
    "faible"
  )
}

/** Une alerte critique/importante part tout de suite ; le reste va au digest. */
export function shouldNotifyImmediately(priority: AlertPriority): boolean {
  return priority === "critique" || priority === "important"
}
