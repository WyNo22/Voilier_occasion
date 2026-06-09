import { NextRequest, NextResponse } from "next/server"
import { parseSearchQuery } from "@/lib/ai/parseSearch"

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const parsed = await parseSearchQuery(query)

    return NextResponse.json({ success: true, query: parsed })
  } catch (error) {
    console.error("Error parsing search:", error)
    return NextResponse.json(
      { error: "Failed to parse search query" },
      { status: 500 }
    )
  }
}
