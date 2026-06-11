import { prisma, Prisma } from "@voilierscope/database"
import { explainScore, detectExcellentScore, type AlertPriority } from "@voilierscope/core"
import type { ConnectorContext, SourceConnector } from "@voilierscope/scrapers"
import type { BoatListing, SearchQuery, VehicleCategory } from "@voilierscope/types"
import { ingest } from "./ingest"

/**
 * Exécution autonome des missions de veille : pour chaque mission due, on
 * ingère les annonces réelles, on (re)calcule les correspondances, on détecte
 * les opportunités et on crée les alertes — sans intervention humaine.
 */

const FREQUENCY_MS: Record<string, number> = {
  HOURLY: 3_600_000,
  EVERY_6H: 21_600_000,
  DAILY: 86_400_000,
  WEEKLY: 604_800_000,
}

const PRIORITY_TO_DB: Record<AlertPriority, "CRITIQUE" | "IMPORTANT" | "FAIBLE"> = {
  critique: "CRITIQUE",
  important: "IMPORTANT",
  faible: "FAIBLE",
}

function nextRunAt(frequency: string): Date {
  return new Date(Date.now() + (FREQUENCY_MS[frequency] ?? FREQUENCY_MS.DAILY!))
}

/** Construit le filtre Prisma d'une mission depuis sa requête structurée. */
function buildWhere(query: SearchQuery): Prisma.BoatWhereInput {
  const where: Prisma.BoatWhereInput = { status: { not: "REMOVED" } }
  if (query.category) where.category = query.category
  if (query.minPrice || query.maxPrice) {
    where.price = { ...(query.minPrice ? { gte: query.minPrice } : {}), ...(query.maxPrice ? { lte: query.maxPrice } : {}) }
  }
  if (query.minLength || query.maxLength) {
    where.lengthM = { ...(query.minLength ? { gte: query.minLength } : {}), ...(query.maxLength ? { lte: query.maxLength } : {}) }
  }
  if (query.minYear || query.maxYear) {
    where.year = { ...(query.minYear ? { gte: query.minYear } : {}), ...(query.maxYear ? { lte: query.maxYear } : {}) }
  }
  if (query.hullType) where.hull = query.hullType
  if (query.brand) where.brand = { contains: query.brand, mode: "insensitive" }
  return where
}

// Ligne Boat (sous-ensemble) → BoatListing pour le scoring.
type BoatRow = {
  id: string
  source: string
  category: string
  title: string
  url: string
  price: number | null
  year: number | null
  lengthM: number | null
  brand: string | null
  model: string | null
  hull: string | null
  location: string | null
  condition: string | null
  equipment: unknown
  status: string
}

function rowToListing(row: BoatRow): BoatListing {
  return {
    id: row.id,
    source: row.source,
    category: row.category as VehicleCategory,
    title: row.title,
    url: row.url,
    currency: "EUR",
    price: row.price ?? undefined,
    year: row.year ?? undefined,
    lengthM: row.lengthM ?? undefined,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    hull: (row.hull as BoatListing["hull"]) ?? undefined,
    location: row.location ?? undefined,
    condition: row.condition ?? undefined,
    equipment: (row.equipment as BoatListing["equipment"]) ?? undefined,
    photos: [],
  }
}

interface MissionRecord {
  id: string
  userId: string
  filters: unknown
  frequency: string
}

/** Exécute une mission : ingestion + scoring + alertes. */
export async function runMission(
  mission: MissionRecord,
  connectors: SourceConnector[],
  ctx: ConnectorContext
): Promise<{ analyzed: number; alerts: number }> {
  const query = (mission.filters ?? { raw: "" }) as SearchQuery
  const run = await prisma.missionRun.create({ data: { missionId: mission.id } })
  const startedAt = Date.now()

  let analyzed = 0
  let alertsCreated = 0
  let error: string | undefined

  try {
    // 1) Ingestion réelle (persiste les annonces + historique de prix).
    const stats = await ingest(query, connectors, ctx)

    // 2) Correspondances de la mission dans la base.
    const rows = (await prisma.boat.findMany({
      where: buildWhere(query),
      take: 100,
      orderBy: { lastSeenAt: "desc" },
    })) as unknown as BoatRow[]
    analyzed = rows.length

    for (const row of rows) {
      const listing = rowToListing(row)
      const explained = explainScore(listing, query)

      const match = await prisma.missionMatch.upsert({
        where: { missionId_boatId: { missionId: mission.id, boatId: row.id } },
        create: {
          missionId: mission.id,
          boatId: row.id,
          matchScore: explained.total,
          factors: explained.factors as unknown as Prisma.InputJsonValue,
          summary: explained.summary,
        },
        update: { matchScore: explained.total, summary: explained.summary },
        select: { id: true, notified: true },
      })

      // 3) Opportunités → alertes (une fois par correspondance).
      if (match.notified) continue
      const excellent = detectExcellentScore(explained.total)
      const priceDropped = row.status === "PRICE_DROPPED"

      let priority: AlertPriority | null = null
      let type = ""
      let message = ""
      if (excellent) {
        priority = excellent.priority
        type = excellent.type
        message = excellent.message
      } else if (priceDropped) {
        priority = "important"
        type = "baisse_prix"
        message = "Baisse de prix sur une annonce correspondant à votre mission."
      }

      if (priority) {
        await prisma.alert.create({
          data: {
            userId: mission.userId,
            missionId: mission.id,
            boatId: row.id,
            type,
            priority: PRIORITY_TO_DB[priority],
            message,
          },
        })
        await prisma.missionMatch.update({ where: { id: match.id }, data: { notified: true } })
        alertsCreated++
      }
    }

    await prisma.missionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        analyzed,
        newCount: stats.created,
        updatedCount: stats.updated,
        durationMs: Date.now() - startedAt,
      },
    })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    ctx.log("error", `Mission ${mission.id} en échec`, err)
    await prisma.missionRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), durationMs: Date.now() - startedAt, error },
    })
  }

  // 4) Replanifie la mission.
  await prisma.mission.update({
    where: { id: mission.id },
    data: { lastRunAt: new Date(), nextRunAt: nextRunAt(mission.frequency) },
  })

  return { analyzed, alerts: alertsCreated }
}

/** Exécute toutes les missions actives dont l'échéance est atteinte. */
export async function runDueMissions(
  connectors: SourceConnector[],
  ctx: ConnectorContext
): Promise<{ missions: number; alerts: number }> {
  const now = new Date()
  const due = (await prisma.mission.findMany({
    where: { active: true, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
    select: { id: true, userId: true, filters: true, frequency: true },
  })) as unknown as MissionRecord[]

  let alerts = 0
  for (const mission of due) {
    const res = await runMission(mission, connectors, ctx)
    alerts += res.alerts
  }
  return { missions: due.length, alerts }
}
