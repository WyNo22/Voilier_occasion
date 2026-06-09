import { NextRequest } from "next/server"
import { parseSearchQuery } from "@/lib/ai/parseSearch"
import { scoreBoat } from "@/lib/ai/scoreBoat"
import { getAllScrapers } from "@voilierscope/scrapers"
import type { SearchProgress, BoatListing } from "@voilierscope/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function encodeSSE(data: SearchProgress): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get("q") || ""

  if (!rawQuery) {
    return new Response("Missing query parameter", { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: SearchProgress) => {
        try {
          controller.enqueue(encoder.encode(encodeSSE(data)))
        } catch {
          // Controller closed
        }
      }

      try {
        // Step 1: Parse the query
        send({
          type: "analysis",
          message: "Analyse de votre demande en cours...",
        })

        const parsedQuery = await parseSearchQuery(rawQuery)

        send({
          type: "analysis",
          message: `Recherche: ${rawQuery}`,
        })

        // Step 2: Run scrapers
        const scrapers = getAllScrapers()
        const allListings: BoatListing[] = []
        let totalFound = 0

        // Run all scrapers concurrently
        const scraperPromises = scrapers.map(async (scraper) => {
          // Signal platform start
          send({
            type: "platform_start",
            platform: scraper.name,
            message: `Recherche sur ${scraper.displayName}...`,
          })

          try {
            const result = await scraper.search(parsedQuery)

            // Score each listing
            const scoredListings = result.listings.map((listing) => {
              const scores = scoreBoat(listing, parsedQuery)
              return {
                ...listing,
                relevanceScore: listing.relevanceScore ?? scores.total,
              }
            })

            allListings.push(...scoredListings)
            totalFound += result.totalFound

            // Signal platform done
            send({
              type: "platform_done",
              platform: scraper.name,
              count: result.listings.length,
              total: totalFound,
              listings: scoredListings,
            })

            return scoredListings
          } catch (error) {
            console.error(`Error scraping ${scraper.name}:`, error)
            send({
              type: "platform_error",
              platform: scraper.name,
              error: error instanceof Error ? error.message : "Unknown error",
            })
            return []
          }
        })

        await Promise.all(scraperPromises)

        // Step 3: Sort and send complete
        const sortedListings = allListings.sort((a, b) =>
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        )

        send({
          type: "complete",
          total: totalFound,
          listings: sortedListings,
          message: `${totalFound} annonces trouvées`,
        })

        controller.close()
      } catch (error) {
        console.error("Stream error:", error)
        send({
          type: "complete",
          total: 0,
          listings: [],
          message: "Une erreur est survenue",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  })
}
