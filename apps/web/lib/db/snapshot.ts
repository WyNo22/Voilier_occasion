import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { BoatListing, SearchQuery } from "@voilierscope/types"

/**
 * Source de données « snapshot » : un fichier `data/boats.json` produit par
 * l'ingestion en mode dry-run. Permet d'afficher de **vraies annonces** dans
 * l'app **sans base de données** (idéal pour tester l'interface).
 *
 * Ordre de priorité dans l'app : base Postgres → snapshot → données de démo.
 */
function snapshotPath(): string {
  // apps/web → racine du repo (../..) → data/boats.json
  return process.env.BOATS_SNAPSHOT || resolve(process.cwd(), "..", "..", "data", "boats.json")
}

let cache: { mtime: number; listings: BoatListing[] } | null = null

/** Charge le snapshot (avec petit cache), [] s'il est absent ou invalide. */
export function loadSnapshot(): BoatListing[] {
  try {
    const path = snapshotPath()
    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as BoatListing[]) : []
  } catch {
    return []
  }
}

/** Filtre en mémoire le snapshot selon la requête (prix/taille/année/marque/catégorie). */
export function searchSnapshot(query: SearchQuery): BoatListing[] {
  const all = loadSnapshot()
  if (all.length === 0) return []

  return all.filter((b) => {
    if (query.category && b.category && b.category !== query.category) return false
    if (query.minPrice && b.price != null && b.price < query.minPrice) return false
    if (query.maxPrice && b.price != null && b.price > query.maxPrice) return false
    if (query.minLength && b.lengthM != null && b.lengthM < query.minLength) return false
    if (query.maxLength && b.lengthM != null && b.lengthM > query.maxLength) return false
    if (query.minYear && b.year != null && b.year < query.minYear) return false
    if (query.maxYear && b.year != null && b.year > query.maxYear) return false
    if (query.hullType && b.hull && b.hull !== query.hullType) return false
    if (query.brand && b.brand && !b.brand.toLowerCase().includes(query.brand.toLowerCase())) return false
    return true
  })
}

/** Récupère une annonce du snapshot par id. */
export function getSnapshotBoat(id: string): BoatListing | null {
  return loadSnapshot().find((b) => b.id === id) ?? null
}
