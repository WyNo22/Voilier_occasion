import type { RawListingInput } from "@voilierscope/core"
import type { SearchQuery } from "@voilierscope/types"

/**
 * Contrat unique de toutes les sources de données. Chaque connecteur est
 * interchangeable : il découvre des annonces, récupère leur détail, et en
 * extrait des champs canoniques. La normalisation finale (unités, devises)
 * est faite par `@voilierscope/core`, jamais par le connecteur.
 */
export interface SourceConnector {
  readonly id: string
  readonly displayName: string
  readonly baseUrl: string
  readonly kind: "api" | "html" | "headless" | "mock"

  /** Découvre les annonces correspondant à une recherche (URLs/identifiants). */
  discover(query: SearchQuery, ctx: ConnectorContext): Promise<SourceRef[]>

  /** Récupère le contenu brut d'une annonce. */
  fetchDetail(ref: SourceRef, ctx: ConnectorContext): Promise<RawDocument>

  /** Extrait les champs canoniques depuis le brut. Fonction pure et testable. */
  extract(doc: RawDocument): RawListingInput | null

  /** Vérifie la disponibilité de la source. */
  healthcheck(ctx: ConnectorContext): Promise<ConnectorHealth>
}

/** Référence vers une annonce à récupérer. */
export interface SourceRef {
  source: string
  externalId: string
  url: string
}

/** Document brut récupéré (HTML ou JSON), à passer à `extract`. */
export interface RawDocument {
  source: string
  externalId: string
  url: string
  contentType: "html" | "json"
  body: string
}

export interface ConnectorHealth {
  id: string
  ok: boolean
  message?: string
  latencyMs?: number
}

/** Dépendances injectées (HTTP, logger) — facilite le test et le mock. */
export interface ConnectorContext {
  fetchText: (url: string, init?: RequestInit) => Promise<string>
  fetchOk: (url: string) => Promise<boolean>
  log: (level: "info" | "warn" | "error", msg: string, meta?: unknown) => void
  /** Délai mini entre deux requêtes vers la même source (politesse). */
  politeDelayMs: number
}
