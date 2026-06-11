import { prisma, Prisma } from "@voilierscope/database"
import {
  normalizeListing,
  dedupeListings,
  specsKey,
  blueWaterScore,
  liveaboardScore,
  coastalScore,
  type MergedListing,
} from "@voilierscope/core"
import type { ConnectorContext, SourceConnector } from "@voilierscope/scrapers"
import type { BoatListing, SearchQuery } from "@voilierscope/types"

export interface IngestStats {
  discovered: number
  extracted: number
  unique: number
  created: number
  updated: number
  priceDrops: number
  errors: number
}

export interface CollectResult {
  listings: MergedListing[]
  discovered: number
  extracted: number
  errors: number
}

export interface CollectOptions {
  /** Nombre de fiches récupérées en parallèle (défaut 4). */
  concurrency?: number
  /** Nombre maximum de fiches par source (utile pour un test rapide). */
  limit?: number
}

/** Exécute `fn` sur les items avec une concurrence limitée (pool de workers). */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const size = Math.max(1, Math.min(limit, items.length))
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx]!)
    }
  })
  await Promise.all(workers)
}

/**
 * Collecte sans persistance : découvre, récupère (en parallèle), extrait,
 * normalise et déduplique. Utilisé par l'ingestion et le mode dry-run.
 */
export async function collectListings(
  query: SearchQuery,
  connectors: SourceConnector[],
  ctx: ConnectorContext,
  options: CollectOptions = {}
): Promise<CollectResult> {
  const concurrency = options.concurrency ?? 4
  let discovered = 0
  let extracted = 0
  let errors = 0
  const collected: BoatListing[] = []

  for (const connector of connectors) {
    let refs
    try {
      refs = await connector.discover(query, ctx)
    } catch (err) {
      ctx.log("error", `${connector.id}: découverte échouée`, err)
      errors++
      continue
    }
    if (options.limit) refs = refs.slice(0, options.limit)
    discovered += refs.length

    // Récupération des fiches en parallèle (pool borné) → bien plus rapide.
    await mapPool(refs, concurrency, async (ref) => {
      try {
        const doc = await connector.fetchDetail(ref, ctx)
        const raw = connector.extract(doc)
        if (raw) {
          collected.push(normalizeListing(raw))
          extracted++
        }
      } catch (err) {
        ctx.log("warn", `${connector.id}: échec sur ${ref.url}`, err)
        errors++
      }
    })
  }

  return { listings: dedupeListings(collected), discovered, extracted, errors }
}

function externalIdOf(id: string, source: string): string {
  const prefix = `${source}-`
  return id.startsWith(prefix) ? id.slice(prefix.length) : id
}

/**
 * Exécute la collecte sur un ensemble de connecteurs, normalise et déduplique
 * via `@voilierscope/core`, puis persiste dans la base (upsert + historique de
 * prix). Retourne des statistiques d'exécution.
 */
export async function ingest(
  query: SearchQuery,
  connectors: SourceConnector[],
  ctx: ConnectorContext,
  options: CollectOptions = {}
): Promise<IngestStats> {
  const collected = await collectListings(query, connectors, ctx, options)
  const stats: IngestStats = {
    discovered: collected.discovered,
    extracted: collected.extracted,
    unique: collected.listings.length,
    created: 0,
    updated: 0,
    priceDrops: 0,
    errors: collected.errors,
  }

  for (const boat of collected.listings) {
    try {
      const result = await persistBoat(boat)
      if (result === "created") stats.created++
      else stats.updated++
      if (result === "price_drop") stats.priceDrops++
    } catch (err) {
      ctx.log("error", `Persistance échouée pour ${boat.url}`, err)
      stats.errors++
    }
  }

  return stats
}

type PersistResult = "created" | "updated" | "price_drop"

/** Upsert d'une annonce + tenue de l'historique de prix. */
async function persistBoat(boat: MergedListing): Promise<PersistResult> {
  const externalId = externalIdOf(boat.id, boat.source)
  const existing = await prisma.boat.findUnique({
    where: { source_externalId: { source: boat.source, externalId } },
    select: { id: true, price: true },
  })

  const common = {
    category: boat.category ?? "voilier",
    url: boat.url,
    title: boat.title,
    price: boat.price ?? null,
    currency: boat.currency,
    year: boat.year ?? null,
    lengthM: boat.lengthM ?? null,
    lengthFt: boat.lengthFt ?? null,
    beam: boat.beam ?? null,
    draft: boat.draft ?? null,
    brand: boat.brand ?? null,
    model: boat.model ?? null,
    hull: boat.hull ?? null,
    location: boat.location ?? null,
    description: boat.description ?? null,
    photos: boat.photos,
    equipment: (boat.equipment ?? undefined) as Prisma.InputJsonValue | undefined,
    condition: boat.condition ?? null,
    blueWaterScore: blueWaterScore(boat),
    liveaboardScore: liveaboardScore(boat),
    coastalScore: coastalScore(boat),
    dedupKey: specsKey(boat),
    mergedFrom: boat.duplicateUrls,
    lastSeenAt: new Date(),
  }

  const priceDropped =
    existing?.price != null && boat.price != null && boat.price < existing.price

  const saved = await prisma.boat.upsert({
    where: { source_externalId: { source: boat.source, externalId } },
    create: { source: boat.source, externalId, ...common },
    update: { ...common, status: priceDropped ? "PRICE_DROPPED" : "ACTIVE" },
    select: { id: true },
  })

  // Historique de prix : à la création, ou quand le prix change.
  if (boat.price != null && (!existing || existing.price !== boat.price)) {
    await prisma.priceHistory.create({ data: { boatId: saved.id, price: boat.price } })
  }

  if (!existing) return "created"
  return priceDropped ? "price_drop" : "updated"
}
