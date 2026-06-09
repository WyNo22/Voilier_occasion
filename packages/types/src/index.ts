export interface Equipment {
  autopilot?: boolean
  windlass?: boolean
  radar?: boolean
  ais?: boolean
  solarPanels?: boolean
  waterMaker?: boolean
  generator?: boolean
  heating?: boolean
  dinghy?: boolean
  electricWinches?: boolean
  bowThruster?: boolean
  vhf?: boolean
  chartplotter?: boolean
  depthSounder?: boolean
  windInstruments?: boolean
  lifeRaft?: boolean
  epirb?: boolean
  sprayhood?: boolean
  bimini?: boolean
  furlingHeadsail?: boolean
  furlingMainsail?: boolean
  batteryMonitor?: boolean
  inverter?: boolean
}

export interface BoatListing {
  id: string
  source: string
  title: string
  price?: number
  currency: string
  year?: number
  lengthM?: number
  lengthFt?: number
  beam?: number
  draft?: number
  displacement?: number
  sailArea?: number
  engineBrand?: string
  engineHours?: number
  enginePower?: number
  cabins?: number
  berths?: number
  brand?: string
  model?: string
  hull?: "monohull" | "catamaran" | "trimaran"
  location?: string
  latitude?: number
  longitude?: number
  description?: string
  photos: string[]
  url: string
  condition?: string
  equipment?: Equipment
  aiSummary?: string
  relevanceScore?: number
  liveaboardScore?: number
  cruisingScore?: number
  blueWaterScore?: number
  scrapedAt?: Date
}

export interface SearchQuery {
  raw: string
  minPrice?: number
  maxPrice?: number
  minLength?: number
  maxLength?: number
  minYear?: number
  maxYear?: number
  location?: string
  region?: string
  hullType?: "monohull" | "catamaran" | "trimaran"
  brand?: string
  model?: string
  usage?: string[]
  equipment?: string[]
  sortBy?: "price_asc" | "price_desc" | "year_desc" | "length_asc" | "score_desc"
}

export interface ScraperResult {
  source: string
  listings: BoatListing[]
  totalFound: number
  scrapedAt: Date
  durationMs: number
  error?: string
}

export interface SearchProgress {
  type:
    | "platform_start"
    | "platform_done"
    | "platform_error"
    | "analysis"
    | "result_batch"
    | "complete"
  platform?: string
  count?: number
  total?: number
  listings?: BoatListing[]
  message?: string
  error?: string
}

export interface PlatformStatus {
  name: string
  displayName: string
  status: "pending" | "loading" | "done" | "error"
  count?: number
  error?: string
}

export const PLATFORMS: { id: string; displayName: string; url: string }[] = [
  { id: "leboncoin", displayName: "Leboncoin", url: "leboncoin.fr" },
  { id: "facebook", displayName: "Facebook Marketplace", url: "facebook.com" },
  { id: "bandofboats", displayName: "Band of Boats", url: "bandofboats.com" },
  { id: "youboat", displayName: "Youboat", url: "youboat.fr" },
  { id: "yachtworld", displayName: "YachtWorld", url: "yachtworld.com" },
  { id: "boat24", displayName: "Boat24", url: "boat24.com" },
  { id: "inautia", displayName: "iNautia", url: "inautia.com" },
]

export const SCORE_LABELS = {
  excellent: { min: 85, label: "Excellent", color: "#22c55e" },
  good: { min: 70, label: "Bon", color: "#84cc16" },
  average: { min: 55, label: "Moyen", color: "#eab308" },
  poor: { min: 0, label: "Faible", color: "#ef4444" },
}

export function getScoreCategory(score: number) {
  if (score >= 85) return SCORE_LABELS.excellent
  if (score >= 70) return SCORE_LABELS.good
  if (score >= 55) return SCORE_LABELS.average
  return SCORE_LABELS.poor
}
