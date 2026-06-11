import type { ConnectorContext } from "./types"

export interface HttpClientOptions {
  userAgent?: string
  timeoutMs?: number
  maxRetries?: number
  politeDelayMs?: number
}

const DEFAULT_UA =
  "VoilierScopeBot/1.0 (+https://voilierscope.app/bot; agrégateur d'annonces nautiques)"

/** Attente simple. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Récupère une URL en texte, avec timeout, retries à backoff exponentiel +
 * jitter, et User-Agent identifiable. Les erreurs 4xx (hors 429) ne sont pas
 * réessayées — inutile d'insister sur un not-found/forbidden.
 */
export async function fetchTextWithRetry(
  url: string,
  opts: HttpClientOptions = {},
  init: RequestInit = {}
): Promise<string> {
  const { userAgent = DEFAULT_UA, timeoutMs = 15000, maxRetries = 3 } = opts

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          ...(init.headers || {}),
        },
      })
      clearTimeout(timer)

      if (res.ok) return await res.text()

      // 4xx non réessayables (sauf 429 = rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`HTTP ${res.status} sur ${url}`)
      }
      lastError = new Error(`HTTP ${res.status} sur ${url}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      // Erreur 4xx définitive : on arrête.
      if (err instanceof Error && /HTTP 4\d\d/.test(err.message) && !err.message.includes("429")) {
        throw err
      }
    }

    if (attempt < maxRetries) {
      const backoff = 2 ** attempt * 500
      const jitter = Math.random() * 300
      await sleep(backoff + jitter)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Échec de récupération de ${url}`)
}

/** Indique si une URL répond en 2xx (pour les healthchecks). */
export async function isReachable(url: string, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal })
    clearTimeout(timer)
    return res.ok || res.status === 405 // certains serveurs refusent HEAD
  } catch {
    clearTimeout(timer)
    return false
  }
}

/**
 * Découvre les URLs de sitemap déclarées dans le robots.txt d'un domaine.
 * Respecte la convention `Sitemap: <url>`. Retourne [] si robots.txt absent.
 */
export async function findSitemapsViaRobots(
  baseUrl: string,
  opts: HttpClientOptions = {}
): Promise<string[]> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString()
    const txt = await fetchTextWithRetry(robotsUrl, { ...opts, maxRetries: 1 })
    return txt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^sitemap:/i.test(line))
      .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Construit un contexte de connecteur prêt à l'emploi (HTTP réel + logger). */
export function createConnectorContext(opts: HttpClientOptions = {}): ConnectorContext {
  return {
    fetchText: (url, init) => fetchTextWithRetry(url, opts, init),
    fetchOk: (url) => isReachable(url, opts.timeoutMs),
    log: (level, msg, meta) => {
      const line = `[${level.toUpperCase()}] ${msg}`
      if (level === "error") console.error(line, meta ?? "")
      else if (level === "warn") console.warn(line, meta ?? "")
      else console.log(line, meta ?? "")
    },
    politeDelayMs: opts.politeDelayMs ?? 1000,
  }
}
