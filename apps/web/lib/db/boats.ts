import type { BoatListing, SearchQuery } from "@voilierscope/types"

/**
 * Accès lecture aux annonces persistées. Conçu pour être **sans risque** :
 *  - si `DATABASE_URL` n'est pas défini, on ne touche pas à Prisma et on
 *    retourne un tableau vide → l'app retombe sur les données de démo.
 *  - toute erreur DB est avalée et journalisée → jamais de page cassée.
 *
 * L'import de Prisma est dynamique pour que le mode démo (sans DB) ne charge
 * jamais le client.
 */
export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

interface BoatRow {
  id: string
  source: string
  category: string
  externalId: string
  url: string
  title: string
  price: number | null
  currency: string
  year: number | null
  lengthM: number | null
  lengthFt: number | null
  beam: number | null
  draft: number | null
  brand: string | null
  model: string | null
  hull: string | null
  location: string | null
  description: string | null
  photos: string[]
  equipment: unknown
  condition: string | null
  liveaboardScore: number | null
  coastalScore: number | null
  blueWaterScore: number | null
}

function rowToListing(row: BoatRow): BoatListing {
  return {
    id: row.id,
    source: row.source,
    category: row.category as BoatListing["category"],
    title: row.title,
    price: row.price ?? undefined,
    currency: row.currency,
    year: row.year ?? undefined,
    lengthM: row.lengthM ?? undefined,
    lengthFt: row.lengthFt ?? undefined,
    beam: row.beam ?? undefined,
    draft: row.draft ?? undefined,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    hull: (row.hull as BoatListing["hull"]) ?? undefined,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    photos: row.photos ?? [],
    url: row.url,
    condition: row.condition ?? undefined,
    equipment: (row.equipment as BoatListing["equipment"]) ?? undefined,
    liveaboardScore: row.liveaboardScore ?? undefined,
    cruisingScore: row.coastalScore ?? undefined,
    blueWaterScore: row.blueWaterScore ?? undefined,
  }
}

/**
 * Recherche les annonces persistées correspondant grossièrement à la requête.
 * Le scoring fin (et explicable) est appliqué par l'appelant via core.
 * Retourne `[]` si la DB n'est pas configurée ou en cas d'erreur.
 */
export async function searchBoatsInDb(query: SearchQuery, limit = 100): Promise<BoatListing[]> {
  if (!isDbConfigured()) return []
  try {
    const { prisma } = await import("@voilierscope/database")

    const where: Record<string, unknown> = { status: { not: "REMOVED" } }
    if (query.minPrice || query.maxPrice) {
      where.price = {
        ...(query.minPrice ? { gte: query.minPrice } : {}),
        ...(query.maxPrice ? { lte: query.maxPrice } : {}),
      }
    }
    if (query.minLength || query.maxLength) {
      where.lengthM = {
        ...(query.minLength ? { gte: query.minLength } : {}),
        ...(query.maxLength ? { lte: query.maxLength } : {}),
      }
    }
    if (query.minYear || query.maxYear) {
      where.year = {
        ...(query.minYear ? { gte: query.minYear } : {}),
        ...(query.maxYear ? { lte: query.maxYear } : {}),
      }
    }
    if (query.category) where.category = query.category
    if (query.hullType) where.hull = query.hullType
    if (query.brand) where.brand = { contains: query.brand, mode: "insensitive" }

    const rows = (await prisma.boat.findMany({
      where,
      take: limit,
      orderBy: { lastSeenAt: "desc" },
    })) as unknown as BoatRow[]

    return rows.map(rowToListing)
  } catch (err) {
    console.error("searchBoatsInDb: lecture DB échouée, repli sur la démo", err)
    return []
  }
}

/** Récupère une annonce persistée par id. `null` si DB absente ou introuvable. */
export async function getBoatFromDb(id: string): Promise<BoatListing | null> {
  if (!isDbConfigured()) return null
  try {
    const { prisma } = await import("@voilierscope/database")
    const row = (await prisma.boat.findUnique({ where: { id } })) as unknown as BoatRow | null
    return row ? rowToListing(row) : null
  } catch (err) {
    console.error("getBoatFromDb: lecture DB échouée", err)
    return null
  }
}
