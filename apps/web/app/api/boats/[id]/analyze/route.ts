import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getAllScrapers } from "@voilierscope/scrapers"
import type { BoatListing } from "@voilierscope/types"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const boatCache = new Map<string, BoatListing>()

async function getBoat(id: string): Promise<BoatListing | null> {
  if (boatCache.has(id)) return boatCache.get(id)!

  const scrapers = getAllScrapers()
  for (const scraper of scrapers) {
    try {
      const result = await scraper.search({ raw: "" })
      result.listings.forEach((l) => boatCache.set(l.id, l))
      if (boatCache.has(id)) return boatCache.get(id)!
    } catch {
      // ignore
    }
  }
  return null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const boat = await getBoat(params.id)

    if (!boat) {
      return NextResponse.json({ error: "Boat not found" }, { status: 404 })
    }

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "sk-ant-...") {
      // Return mock analysis
      return NextResponse.json({
        aiSummary: `Ce ${boat.brand || "voilier"} ${boat.model || ""} de ${boat.year || "année inconnue"} est en ${boat.condition || "bon état"}. Situé à ${boat.location || "localisation inconnue"}, il présente un bon rapport qualité-prix pour la navigation ${boat.hull === "catamaran" ? "en catamaran" : "en monocoque"}.`,
        questions: [
          "Quel est l'historique des réparations et révisions ?",
          "Les voiles sont-elles récentes et en bon état ?",
          "Le moteur a-t-il été révisé récemment ?",
          "Y a-t-il des défauts cachés ou travaux en cours ?",
          "Pourquoi vendez-vous le bateau ?",
          "Est-il possible de faire une contre-visite avec un expert ?",
        ],
      })
    }

    const prompt = `Analyse ce voilier d'occasion et génère:
1. Un résumé en 2-3 phrases en français sur le bateau
2. Une liste de 6 questions importantes à poser au vendeur

Bateau: ${boat.brand || ""} ${boat.model || ""} ${boat.year || ""}
Description: ${boat.description || "Non disponible"}
État déclaré: ${boat.condition || "Non précisé"}
Prix: ${boat.price ? `${boat.price}€` : "Non communiqué"}
Équipements: ${boat.equipment ? Object.entries(boat.equipment).filter(([, v]) => v).map(([k]) => k).join(", ") : "Non précisés"}

Réponds en JSON: {"aiSummary": "...", "questions": ["...", "...", "...", "...", "...", "..."]}`

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const content = message.content[0]
    if (content.type === "text") {
      const result = JSON.parse(content.text)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  } catch (error) {
    console.error("Error analyzing boat:", error)
    return NextResponse.json(
      { error: "Failed to analyze boat" },
      { status: 500 }
    )
  }
}
