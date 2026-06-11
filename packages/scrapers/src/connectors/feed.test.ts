import { describe, it, expect } from "vitest"
import { normalizeListing } from "@voilierscope/core"
import { parseFeedItems, applyFeedMap, FeedConnector } from "./feed"
import type { ConnectorContext } from "./types"

const XML_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<listings>
  <boat>
    <id>A-100</id>
    <name>Dufour 460 Grand Large</name>
    <make>Dufour</make>
    <model>460 GL</model>
    <buildYear>2018</buildYear>
    <priceEUR>295000</priceEUR>
    <lengthMeters>14.15</lengthMeters>
    <link>https://courtier.example/bateau/A-100</link>
    <photo>https://cdn/a1.jpg</photo>
    <photo>https://cdn/a2.jpg</photo>
  </boat>
  <boat>
    <id>A-101</id>
    <name>Bavaria Cruiser 46</name>
    <make>Bavaria</make>
    <buildYear>2016</buildYear>
    <priceEUR>189000</priceEUR>
    <lengthMeters>14.27</lengthMeters>
    <link>https://courtier.example/bateau/A-101</link>
  </boat>
</listings>`

const JSON_FEED = JSON.stringify({
  data: {
    listings: [
      {
        ref: "J-1",
        title: "Beneteau Oceanis 46.1",
        brand: "beneteau",
        year: 2020,
        price: 320000,
        loa: 14.6,
        permalink: "https://api.example/listing/J-1",
        images: ["https://cdn/j1.jpg"],
      },
    ],
  },
})

const xmlMap = {
  externalId: "id",
  title: "name",
  brand: "make",
  model: "model",
  year: "buildYear",
  price: "priceEUR",
  lengthM: "lengthMeters",
  url: "link",
  photos: "photo",
}

describe("parseFeedItems", () => {
  it("parse un flux XML en items plats (photos multiples → tableau)", () => {
    const items = parseFeedItems(XML_FEED, { format: "xml", itemSelector: "boat" })
    expect(items).toHaveLength(2)
    expect(items[0]!.name).toBe("Dufour 460 Grand Large")
    expect(items[0]!.photo).toEqual(["https://cdn/a1.jpg", "https://cdn/a2.jpg"])
  })

  it("parse un flux JSON via itemsPath", () => {
    const items = parseFeedItems(JSON_FEED, { format: "json", itemsPath: "data.listings" })
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe("Beneteau Oceanis 46.1")
  })
})

describe("applyFeedMap", () => {
  it("mappe et coerce les champs (prix, année, longueur)", () => {
    const items = parseFeedItems(XML_FEED, { format: "xml", itemSelector: "boat" })
    const mapped = applyFeedMap(items[0]!, xmlMap)
    expect(mapped.title).toBe("Dufour 460 Grand Large")
    expect(mapped.year).toBe(2018)
    expect(mapped.price).toBe(295000)
    expect(mapped.lengthM).toBe(14.15)
    expect(mapped.photos).toEqual(["https://cdn/a1.jpg", "https://cdn/a2.jpg"])
  })

  it("supporte une spec fonction pour les cas complexes", () => {
    const mapped = applyFeedMap({ a: { b: 5 } }, { cabins: (item) => (item as { a: { b: number } }).a.b })
    expect(mapped.cabins).toBe(5)
  })
})

function mockContext(pages: Record<string, string>): ConnectorContext {
  return {
    fetchText: async (url) => {
      const key = Object.keys(pages).find((k) => url.includes(k))
      if (!key) throw new Error(`404 ${url}`)
      return pages[key]!
    },
    fetchOk: async () => true,
    log: () => {},
    politeDelayMs: 0,
  }
}

describe("FeedConnector", () => {
  const connector = new FeedConnector({
    id: "courtier-x",
    displayName: "Courtier X",
    baseUrl: "https://courtier.example",
    format: "xml",
    itemSelector: "boat",
    feedUrls: ["https://courtier.example/feed.xml"],
    map: xmlMap,
    category: "voilier",
  })

  it("découvre les annonces depuis le flux sans 2e appel réseau", async () => {
    const ctx = mockContext({ "feed.xml": XML_FEED })
    const refs = await connector.discover({ raw: "" }, ctx)
    expect(refs).toHaveLength(2)
    expect(refs[0]!.externalId).toBe("A-100")

    const doc = await connector.fetchDetail(refs[0]!, ctx)
    const raw = connector.extract(doc)
    expect(raw).not.toBeNull()

    const normalized = normalizeListing(raw!)
    expect(normalized.id).toBe("courtier-x-A-100")
    expect(normalized.brand).toBe("Dufour")
    expect(normalized.category).toBe("voilier")
    expect(normalized.price).toBe(295000)
    expect(normalized.lengthM).toBe(14.15)
  })
})
