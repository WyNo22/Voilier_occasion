import Anthropic from "@anthropic-ai/sdk"
import type { SearchQuery } from "@voilierscope/types"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a French sailboat search query parser. Extract structured search parameters from natural language queries about used sailboats.

Parse the user's query and return a JSON object with these optional fields:
- category: one of "voilier" | "bateau_moteur" | "pneumatique" | "petit_bateau" | "moteur" | "remorque" | "jet_ski" | "peniche" (the type of marine vehicle)
- minPrice: number (minimum price in EUR)
- maxPrice: number (maximum price in EUR)
- minLength: number (minimum length in meters)
- maxLength: number (maximum length in meters)
- minYear: number (minimum year of manufacture)
- maxYear: number (maximum year of manufacture)
- location: string (location/region mentioned)
- region: string (broad region: "méditerranée", "bretagne", "atlantique", "pacifique", etc.)
- hullType: "monohull" | "catamaran" | "trimaran"
- brand: string (boat brand if mentioned)
- model: string (boat model if mentioned)
- usage: array of strings (e.g. ["grand_voyage", "croisière_côtière", "habitable", "traversée_atlantique"])
- equipment: array of strings (specific equipment requested e.g. ["dessalinisateur", "panneaux_solaires"])
- sortBy: "price_asc" | "price_desc" | "year_desc" | "length_asc" | "score_desc"

Rules:
- "k€" or "k" usually means thousands of euros
- "m" after a number usually means meters (length)
- Be generous in interpretation
- If a budget is mentioned as a range like "45-80k€", use both min and max
- Return ONLY valid JSON, no explanation

Examples:
Query: "Voilier 10m Méditerranée budget 45k€"
Response: {"maxPrice": 45000, "minLength": 9, "maxLength": 11, "region": "méditerranée", "hullType": "monohull"}

Query: "Catamaran traversée atlantique 80k€ avec dessalinisateur"
Response: {"maxPrice": 80000, "hullType": "catamaran", "usage": ["traversée_atlantique", "grand_voyage"], "equipment": ["dessalinisateur"]}

Query: "First 31.7 Bretagne moins de 30k"
Response: {"maxPrice": 30000, "brand": "Bénéteau", "model": "First 31.7", "region": "bretagne"}`

export async function parseSearchQuery(raw: string): Promise<SearchQuery> {
  // Return a basic query if no API key
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "sk-ant-...") {
    return parseQueryFallback(raw)
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: raw,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      return parseQueryFallback(raw)
    }

    const parsed = JSON.parse(content.text)
    return {
      raw,
      ...parsed,
    }
  } catch (error) {
    console.error("Error parsing search query with AI:", error)
    return parseQueryFallback(raw)
  }
}

/**
 * Fallback parser using regex/heuristics when AI is unavailable
 */
function parseQueryFallback(raw: string): SearchQuery {
  const query: SearchQuery = { raw }
  const lower = raw.toLowerCase()

  // Price extraction
  const priceMatch = lower.match(/(\d+)\s*k[€e]?/gi)
  if (priceMatch) {
    const prices = priceMatch.map((p) => parseInt(p.replace(/k[€e]?/i, "")) * 1000)
    if (prices.length >= 2) {
      query.minPrice = Math.min(...prices)
      query.maxPrice = Math.max(...prices)
    } else if (lower.includes("moins de") || lower.includes("max") || lower.includes("budget")) {
      query.maxPrice = prices[0]
    } else {
      query.maxPrice = prices[0]
    }
  }

  // Length extraction
  const lengthMatch = lower.match(/(\d+(?:\.\d+)?)\s*m(?:ètres?)?(?:\s|$)/i)
  if (lengthMatch) {
    const len = parseFloat(lengthMatch[1])
    query.minLength = len - 1
    query.maxLength = len + 1
  }

  // Vehicle category
  if (lower.includes("pneumatique") || lower.includes("semi-rigide") || lower.includes("annexe")) {
    query.category = "pneumatique"
  } else if (lower.includes("jet") || lower.includes("motomarine")) {
    query.category = "jet_ski"
  } else if (lower.includes("remorque")) {
    query.category = "remorque"
  } else if (lower.includes("moteur") && !lower.includes("bateau à moteur") && !lower.includes("bateaux à moteur")) {
    query.category = "moteur"
  } else if (lower.includes("bateau à moteur") || lower.includes("bateaux à moteur") || lower.includes("vedette")) {
    query.category = "bateau_moteur"
  } else if (lower.includes("voilier") || lower.includes("catamaran") || lower.includes("trimaran") || lower.includes("monocoque")) {
    query.category = "voilier"
  }

  // Hull type
  if (lower.includes("catamaran")) query.hullType = "catamaran"
  else if (lower.includes("trimaran")) query.hullType = "trimaran"
  else if (lower.includes("voilier") || lower.includes("monocoque")) query.hullType = "monohull"

  // Region detection
  if (lower.includes("méditerranée") || lower.includes("med ") || lower.includes("côte d'azur")) {
    query.region = "méditerranée"
  } else if (lower.includes("bretagne") || lower.includes("brest") || lower.includes("lorient")) {
    query.region = "bretagne"
  } else if (lower.includes("atlantique")) {
    query.region = "atlantique"
  } else if (lower.includes("antilles") || lower.includes("caraïbes")) {
    query.region = "antilles"
  }

  // Brand/model detection
  const brands = ["bénéteau", "beneteau", "jeanneau", "dufour", "bavaria", "hanse", "amel", "alubat", "ovni", "hallberg-rassy", "lagoon", "fountaine pajot"]
  for (const brand of brands) {
    if (lower.includes(brand)) {
      query.brand = brand.charAt(0).toUpperCase() + brand.slice(1)
      break
    }
  }

  // Usage
  const usage: string[] = []
  if (lower.includes("grand voyage") || lower.includes("hauturier")) usage.push("grand_voyage")
  if (lower.includes("atlantique")) usage.push("traversée_atlantique")
  if (lower.includes("habitable") || lower.includes("vivre à bord")) usage.push("habitable")
  if (lower.includes("croisière")) usage.push("croisière")
  if (usage.length > 0) query.usage = usage

  // Equipment
  const equipment: string[] = []
  if (lower.includes("dessalinisateur")) equipment.push("dessalinisateur")
  if (lower.includes("panneaux solaires") || lower.includes("solaire")) equipment.push("panneaux_solaires")
  if (lower.includes("pilote") || lower.includes("autopilot")) equipment.push("pilote_automatique")
  if (lower.includes("ais")) equipment.push("ais")
  if (lower.includes("radar")) equipment.push("radar")
  if (equipment.length > 0) query.equipment = equipment

  return query
}
