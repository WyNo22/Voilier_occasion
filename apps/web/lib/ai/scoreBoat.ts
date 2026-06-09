import type { BoatListing, SearchQuery, Equipment } from "@voilierscope/types"

interface ScoreBreakdown {
  total: number
  priceScore: number
  lengthScore: number
  yearScore: number
  equipmentScore: number
  conditionScore: number
  locationScore: number
}

/**
 * Score a boat listing against a search query (0-100)
 */
export function scoreBoat(listing: BoatListing, query: SearchQuery): ScoreBreakdown {
  let priceScore = 100
  let lengthScore = 100
  let yearScore = 100
  let equipmentScore = 50 // default
  let conditionScore = 70 // default
  let locationScore = 60 // default

  // Price scoring
  if (listing.price) {
    if (query.maxPrice && listing.price > query.maxPrice) {
      const overBy = (listing.price - query.maxPrice) / query.maxPrice
      priceScore = Math.max(0, 100 - overBy * 150)
    } else if (query.minPrice && listing.price < query.minPrice) {
      const underBy = (query.minPrice - listing.price) / query.minPrice
      priceScore = Math.max(40, 100 - underBy * 100)
    } else if (query.maxPrice) {
      // Within budget — bonus for being under
      const ratio = listing.price / query.maxPrice
      priceScore = ratio < 0.8 ? 100 : 90
    }
  }

  // Length scoring
  if (listing.lengthM) {
    if (query.minLength && listing.lengthM < query.minLength) {
      const under = (query.minLength - listing.lengthM) / query.minLength
      lengthScore = Math.max(0, 100 - under * 200)
    } else if (query.maxLength && listing.lengthM > query.maxLength) {
      const over = (listing.lengthM - query.maxLength) / query.maxLength
      lengthScore = Math.max(0, 100 - over * 200)
    }
  }

  // Year scoring
  if (listing.year) {
    const age = new Date().getFullYear() - listing.year
    if (query.minYear && listing.year < query.minYear) {
      yearScore = Math.max(0, 100 - (query.minYear - listing.year) * 10)
    } else if (age > 30) {
      yearScore = 40
    } else if (age > 20) {
      yearScore = 60
    } else if (age > 10) {
      yearScore = 80
    } else {
      yearScore = 95
    }
  }

  // Equipment scoring based on query
  if (query.equipment && listing.equipment) {
    const eq = listing.equipment as Equipment
    const requestedEquipment = query.equipment
    let matched = 0

    for (const item of requestedEquipment) {
      if (
        (item === "dessalinisateur" && eq.waterMaker) ||
        (item === "panneaux_solaires" && eq.solarPanels) ||
        (item === "pilote_automatique" && eq.autopilot) ||
        (item === "ais" && eq.ais) ||
        (item === "radar" && eq.radar)
      ) {
        matched++
      }
    }
    equipmentScore = requestedEquipment.length > 0
      ? Math.round((matched / requestedEquipment.length) * 100)
      : 70
  } else if (listing.equipment) {
    // Score based on completeness
    const eq = listing.equipment as Equipment
    const keys = Object.keys(eq)
    const trueCount = keys.filter((k) => eq[k as keyof Equipment]).length
    equipmentScore = Math.min(100, 40 + trueCount * 5)
  }

  // Condition scoring
  const condition = (listing.condition || "").toLowerCase()
  if (condition.includes("excellent") || condition.includes("neuf")) conditionScore = 95
  else if (condition.includes("très bon")) conditionScore = 85
  else if (condition.includes("bon")) conditionScore = 70
  else if (condition.includes("entretenu")) conditionScore = 65
  else conditionScore = 55

  // Location scoring
  if (query.region && listing.location) {
    const loc = listing.location.toLowerCase()
    const region = query.region.toLowerCase()
    if (
      (region === "méditerranée" && (loc.includes("marseille") || loc.includes("toulon") || loc.includes("nice") || loc.includes("montpellier") || loc.includes("var") || loc.includes("hérault") || loc.includes("espagne") || loc.includes("italie"))) ||
      (region === "bretagne" && (loc.includes("brest") || loc.includes("lorient") || loc.includes("saint-malo") || loc.includes("finistère") || loc.includes("morbihan") || loc.includes("bretagne"))) ||
      (region === "atlantique" && (loc.includes("la rochelle") || loc.includes("bordeaux") || loc.includes("nantes") || loc.includes("charente")))
    ) {
      locationScore = 95
    } else if (query.location && listing.location.toLowerCase().includes(query.location.toLowerCase())) {
      locationScore = 90
    }
  }

  // Weighted total
  const total = Math.round(
    priceScore * 0.25 +
    yearScore * 0.15 +
    lengthScore * 0.15 +
    equipmentScore * 0.2 +
    conditionScore * 0.15 +
    locationScore * 0.1
  )

  return {
    total: Math.max(0, Math.min(100, total)),
    priceScore: Math.round(priceScore),
    lengthScore: Math.round(lengthScore),
    yearScore: Math.round(yearScore),
    equipmentScore: Math.round(equipmentScore),
    conditionScore: Math.round(conditionScore),
    locationScore: Math.round(locationScore),
  }
}

export function getScoreColor(score: number): string {
  if (score >= 85) return "#22c55e"
  if (score >= 70) return "#84cc16"
  if (score >= 55) return "#eab308"
  return "#ef4444"
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent"
  if (score >= 70) return "Bon"
  if (score >= 55) return "Moyen"
  return "Faible"
}
