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
import type { SearchQuery } from "@voilierscope/types"

export interface IngestStats {
  discovered: number
  extracted: number
  unique: number
  created: number
  updated: number
  priceDrops: number
  errors: number
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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
  ctx: ConnectorContext
): Promise<IngestStats> {
  const stats: IngestStats = {
    discovered: 0,
    extracted: 0,
    unique: 0,
    created: 0,
    updated: 0,
    priceDrops: 0,
    errors: 0,
  }

  const collected = []

  for (const connector of connectors) {
    let refs
    try {
      refs = await connector.discover(query, ctx)
    } catch (err) {
      ctx.log("error", `${connector.id}: découverte échouée`, err)
      stats.errors++
      continue
    }
    stats.discovered += refs.length

    for (const ref of refs) {
      try {
        const doc = await connector.fetchDetail(ref, ctx)
        const raw = connector.extract(doc)
        if (raw) {
          collected.push(normalizeListing(raw))
          stats.extracted++
        }
        await delay(ctx.politeDelayMs)
      } catch (err) {
        ctx.log("warn", `${connector.id}: échec sur ${ref.url}`, err)
        stats.errors++
      }
    }
  }

  const deduped = dedupeListings(collected)
  stats.unique = deduped.length

  for (const boat of deduped) {
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
