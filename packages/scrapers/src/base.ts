import type { BoatListing, Equipment, ScraperResult, SearchQuery } from "@voilierscope/types"

export abstract class BaseScraper {
  abstract readonly name: string
  abstract readonly displayName: string
  abstract readonly baseUrl: string

  abstract search(query: SearchQuery): Promise<ScraperResult>

  protected normalize(raw: Record<string, unknown>): BoatListing {
    const lengthM = raw.lengthM as number | undefined
    const lengthFt = raw.lengthFt as number | undefined

    return {
      id: `${this.name}-${raw.externalId as string}`,
      source: this.name,
      title: (raw.title as string) || "Voilier sans titre",
      price: raw.price as number | undefined,
      currency: (raw.currency as string) || "EUR",
      year: raw.year as number | undefined,
      lengthM: lengthM || (lengthFt ? lengthFt * 0.3048 : undefined),
      lengthFt: lengthFt || (lengthM ? lengthM / 0.3048 : undefined),
      beam: raw.beam as number | undefined,
      draft: raw.draft as number | undefined,
      displacement: raw.displacement as number | undefined,
      sailArea: raw.sailArea as number | undefined,
      engineBrand: raw.engineBrand as string | undefined,
      engineHours: raw.engineHours as number | undefined,
      enginePower: raw.enginePower as number | undefined,
      cabins: raw.cabins as number | undefined,
      berths: raw.berths as number | undefined,
      brand: raw.brand as string | undefined,
      model: raw.model as string | undefined,
      hull: raw.hull as "monohull" | "catamaran" | "trimaran" | undefined,
      location: raw.location as string | undefined,
      latitude: raw.latitude as number | undefined,
      longitude: raw.longitude as number | undefined,
      description: raw.description as string | undefined,
      photos: (raw.photos as string[]) || [],
      url: raw.url as string,
      condition: raw.condition as string | undefined,
      equipment: raw.equipment as Equipment | undefined,
      scrapedAt: new Date(),
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  protected randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  protected matchesQuery(listing: BoatListing, query: SearchQuery): boolean {
    if (query.minPrice && listing.price && listing.price < query.minPrice) return false
    if (query.maxPrice && listing.price && listing.price > query.maxPrice) return false
    if (query.minLength && listing.lengthM && listing.lengthM < query.minLength) return false
    if (query.maxLength && listing.lengthM && listing.lengthM > query.maxLength) return false
    if (query.minYear && listing.year && listing.year < query.minYear) return false
    if (query.maxYear && listing.year && listing.year > query.maxYear) return false
    if (query.hullType && listing.hull && listing.hull !== query.hullType) return false
    if (query.brand && listing.brand && !listing.brand.toLowerCase().includes(query.brand.toLowerCase())) return false
    return true
  }
}
