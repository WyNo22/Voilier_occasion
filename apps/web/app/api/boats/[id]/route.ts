import { NextRequest, NextResponse } from "next/server"
import { getAllScrapers } from "@voilierscope/scrapers"
import { getBoatFromDb } from "@/lib/db/boats"
import type { BoatListing } from "@voilierscope/types"

// In-memory cache for demo
const boatCache = new Map<string, BoatListing>()

async function getAllListings(): Promise<BoatListing[]> {
  if (boatCache.size > 0) {
    return Array.from(boatCache.values())
  }

  const scrapers = getAllScrapers()
  const allListings: BoatListing[] = []

  await Promise.all(
    scrapers.map(async (scraper) => {
      try {
        const result = await scraper.search({ raw: "" })
        allListings.push(...result.listings)
        result.listings.forEach((l) => boatCache.set(l.id, l))
      } catch {
        // ignore
      }
    })
  )

  return allListings
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Real data first: try the database.
    const dbBoat = await getBoatFromDb(id)
    if (dbBoat) {
      return NextResponse.json({ boat: dbBoat })
    }

    // Check cache (demo data)
    if (boatCache.has(id)) {
      return NextResponse.json({ boat: boatCache.get(id) })
    }

    // Load all listings to populate cache
    await getAllListings()

    if (boatCache.has(id)) {
      return NextResponse.json({ boat: boatCache.get(id) })
    }

    return NextResponse.json({ error: "Boat not found" }, { status: 404 })
  } catch (error) {
    console.error("Error fetching boat:", error)
    return NextResponse.json(
      { error: "Failed to fetch boat" },
      { status: 500 }
    )
  }
}
