import type { BoatListing, Equipment, SearchQuery } from "@voilierscope/types"

/** Un facteur de score, avec sa contribution et une justification lisible. */
export interface ScoreFactor {
  key: string
  label: string
  score: number // 0-100
  weight: number // 0-1
  reason: string
}

export interface ExplainedScore {
  total: number // 0-100
  factors: ScoreFactor[]
  /** Justification synthétique en français, prête pour l'UI. */
  summary: string
}

/** Pondérations par défaut de l'adéquation à la requête. */
const WEIGHTS = {
  price: 0.25,
  year: 0.15,
  length: 0.15,
  equipment: 0.2,
  condition: 0.15,
  location: 0.1,
} as const

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function scorePrice(listing: BoatListing, q: SearchQuery): ScoreFactor {
  let score = 80
  let reason = "Prix non communiqué."
  if (listing.price != null) {
    if (q.maxPrice && listing.price > q.maxPrice) {
      const over = (listing.price - q.maxPrice) / q.maxPrice
      score = clamp(100 - over * 150)
      reason = `Dépasse le budget de ${Math.round(over * 100)} %.`
    } else if (q.minPrice && listing.price < q.minPrice) {
      score = 70
      reason = "Sous le budget minimum indiqué (méfiance possible)."
    } else if (q.maxPrice) {
      const ratio = listing.price / q.maxPrice
      score = ratio < 0.8 ? 100 : 90
      reason =
        ratio < 0.8
          ? `Bien dans le budget (${Math.round((1 - ratio) * 100)} % sous le plafond).`
          : "Dans le budget."
    } else {
      reason = "Prix renseigné, aucun budget cible fourni."
    }
  }
  return { key: "price", label: "Prix", score, weight: WEIGHTS.price, reason }
}

function scoreLength(listing: BoatListing, q: SearchQuery): ScoreFactor {
  let score = 85
  let reason = "Longueur non précisée."
  if (listing.lengthM != null) {
    score = 100
    reason = `${listing.lengthM} m, conforme à la recherche.`
    if (q.minLength && listing.lengthM < q.minLength) {
      const under = (q.minLength - listing.lengthM) / q.minLength
      score = clamp(100 - under * 200)
      reason = `Plus court que souhaité (${listing.lengthM} m < ${q.minLength} m).`
    } else if (q.maxLength && listing.lengthM > q.maxLength) {
      const over = (listing.lengthM - q.maxLength) / q.maxLength
      score = clamp(100 - over * 200)
      reason = `Plus long que souhaité (${listing.lengthM} m > ${q.maxLength} m).`
    }
  }
  return { key: "length", label: "Taille", score, weight: WEIGHTS.length, reason }
}

function scoreYear(listing: BoatListing, q: SearchQuery): ScoreFactor {
  let score = 80
  let reason = "Année inconnue."
  if (listing.year != null) {
    const age = new Date().getFullYear() - listing.year
    if (q.minYear && listing.year < q.minYear) {
      score = clamp(100 - (q.minYear - listing.year) * 10)
      reason = `Antérieur à ${q.minYear} (${listing.year}).`
    } else if (age > 30) {
      score = 40
      reason = `Bateau ancien (${listing.year}, ${age} ans).`
    } else if (age > 20) {
      score = 60
      reason = `${listing.year} (${age} ans).`
    } else if (age > 10) {
      score = 80
      reason = `${listing.year}, encore récent.`
    } else {
      score = 95
      reason = `${listing.year}, bateau récent.`
    }
  }
  return { key: "year", label: "Année", score, weight: WEIGHTS.year, reason }
}

const EQUIPMENT_ALIASES: Record<string, keyof Equipment> = {
  dessalinisateur: "waterMaker",
  panneaux_solaires: "solarPanels",
  pilote_automatique: "autopilot",
  ais: "ais",
  radar: "radar",
  guindeau: "windlass",
  chauffage: "heating",
  annexe: "dinghy",
}

function scoreEquipment(listing: BoatListing, q: SearchQuery): ScoreFactor {
  const eq = listing.equipment
  if (q.equipment && q.equipment.length > 0) {
    if (!eq) {
      return {
        key: "equipment",
        label: "Équipements",
        score: 30,
        weight: WEIGHTS.equipment,
        reason: "Équipements demandés non vérifiables sur l'annonce.",
      }
    }
    let matched = 0
    const missing: string[] = []
    for (const item of q.equipment) {
      const field = EQUIPMENT_ALIASES[item]
      if (field && eq[field]) matched++
      else missing.push(item.replace(/_/g, " "))
    }
    const score = clamp((matched / q.equipment.length) * 100)
    const reason =
      missing.length === 0
        ? "Tous les équipements demandés sont présents."
        : `Manque : ${missing.join(", ")}.`
    return { key: "equipment", label: "Équipements", score, weight: WEIGHTS.equipment, reason }
  }

  // Pas de demande explicite : on score la complétude générale.
  if (eq) {
    const trueCount = Object.values(eq).filter(Boolean).length
    const score = clamp(40 + trueCount * 5)
    return {
      key: "equipment",
      label: "Équipements",
      score,
      weight: WEIGHTS.equipment,
      reason: `${trueCount} équipements notables référencés.`,
    }
  }
  return {
    key: "equipment",
    label: "Équipements",
    score: 50,
    weight: WEIGHTS.equipment,
    reason: "Équipements non détaillés.",
  }
}

function scoreCondition(listing: BoatListing): ScoreFactor {
  const c = (listing.condition || "").toLowerCase()
  let score = 55
  let reason = "État non précisé."
  if (c.includes("excellent") || c.includes("neuf")) {
    score = 95
    reason = "État déclaré excellent."
  } else if (c.includes("très bon")) {
    score = 85
    reason = "Très bon état déclaré."
  } else if (c.includes("bon")) {
    score = 70
    reason = "Bon état déclaré."
  } else if (c.includes("entretenu")) {
    score = 65
    reason = "Déclaré entretenu."
  }
  return { key: "condition", label: "État", score, weight: WEIGHTS.condition, reason }
}

const REGION_KEYWORDS: Record<string, string[]> = {
  "méditerranée": ["marseille", "toulon", "nice", "montpellier", "var", "hérault", "espagne", "italie"],
  bretagne: ["brest", "lorient", "saint-malo", "finistère", "morbihan", "bretagne"],
  atlantique: ["la rochelle", "bordeaux", "nantes", "charente", "vendée"],
}

function scoreLocation(listing: BoatListing, q: SearchQuery): ScoreFactor {
  let score = 60
  let reason = "Localisation neutre vis-à-vis de la recherche."
  const loc = listing.location?.toLowerCase()
  if (loc && q.region) {
    const keywords = REGION_KEYWORDS[q.region.toLowerCase()] || []
    if (keywords.some((k) => loc.includes(k))) {
      score = 95
      reason = `Situé dans la zone recherchée (${q.region}).`
    } else {
      score = 45
      reason = `Hors de la zone ${q.region}.`
    }
  } else if (loc && q.location && loc.includes(q.location.toLowerCase())) {
    score = 90
    reason = `Proche de ${q.location}.`
  }
  return { key: "location", label: "Localisation", score, weight: WEIGHTS.location, reason }
}

/**
 * Score d'adéquation explicable d'une annonce vis-à-vis d'une recherche.
 * Retourne le total pondéré ET la liste des facteurs avec justification.
 */
export function explainScore(listing: BoatListing, query: SearchQuery): ExplainedScore {
  const factors: ScoreFactor[] = [
    scorePrice(listing, query),
    scoreYear(listing, query),
    scoreLength(listing, query),
    scoreEquipment(listing, query),
    scoreCondition(listing),
    scoreLocation(listing, query),
  ]

  const total = clamp(factors.reduce((sum, f) => sum + f.score * f.weight, 0))

  // Résumé : on met en avant les 2 meilleurs et le pire facteur.
  const sorted = [...factors].sort((a, b) => b.score - a.score)
  const top = sorted.slice(0, 2).map((f) => f.reason)
  const worst = sorted[sorted.length - 1]
  const summaryParts = [...top]
  if (worst && worst.score < 60) summaryParts.push(`Point d'attention : ${worst.reason}`)

  return { total, factors, summary: summaryParts.join(" ") }
}

/* --------------------------------------------------------------------------
 * Scores d'usage : indépendants de la requête, ils qualifient l'aptitude
 * intrinsèque du bateau à un programme de navigation.
 * ------------------------------------------------------------------------ */

function eqScore(eq: Equipment | undefined, keys: (keyof Equipment)[]): number {
  if (!eq) return 0
  return keys.filter((k) => eq[k]).length / keys.length
}

/** Aptitude à la grande croisière / traversée hauturière (0-100). */
export function blueWaterScore(listing: BoatListing): number {
  const eq = listing.equipment
  const autonomy = eqScore(eq, ["waterMaker", "solarPanels", "generator", "inverter", "batteryMonitor"])
  const safety = eqScore(eq, ["lifeRaft", "epirb", "radar", "ais", "autopilot"])
  const sizeBonus = listing.lengthM ? Math.min(1, Math.max(0, (listing.lengthM - 9) / 6)) : 0.3
  return clamp((autonomy * 40 + safety * 40 + sizeBonus * 20))
}

/** Aptitude à la vie à bord / habitabilité (0-100). */
export function liveaboardScore(listing: BoatListing): number {
  const eq = listing.equipment
  const comfort = eqScore(eq, ["heating", "waterMaker", "generator", "inverter", "solarPanels"])
  const space =
    listing.berths != null ? Math.min(1, listing.berths / 8) : listing.cabins ? Math.min(1, listing.cabins / 4) : 0.4
  const beamBonus = listing.beam ? Math.min(1, Math.max(0, (listing.beam - 3) / 4)) : 0.3
  return clamp(comfort * 45 + space * 35 + beamBonus * 20)
}

/** Aptitude à la croisière côtière (0-100). */
export function coastalScore(listing: BoatListing): number {
  const eq = listing.equipment
  const nav = eqScore(eq, ["chartplotter", "depthSounder", "vhf", "autopilot", "windInstruments"])
  const ease = eqScore(eq, ["furlingHeadsail", "bowThruster", "electricWinches", "sprayhood"])
  return clamp(nav * 60 + ease * 40)
}
