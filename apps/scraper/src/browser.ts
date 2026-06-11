import type { ConnectorContext } from "@voilierscope/scrapers"

/**
 * Couche de récupération via navigateur réel (Playwright/Chromium).
 *
 * Beaucoup de sites d'annonces refusent un client HTTP simple (403) mais
 * s'ouvrent à un vrai navigateur. On charge donc la page comme le ferait un
 * utilisateur, puis on en extrait le HTML rendu.
 *
 * ⚠️ Aucune technique d'évasion (pas de stealth, pas de spoofing d'empreinte,
 * pas de résolution de captcha). Un Chromium standard, point. Si un site
 * oppose un vrai anti-bot avec défi, la récupération échouera proprement.
 *
 * Playwright est une dépendance optionnelle : importée dynamiquement pour ne
 * pas être requise par le mode HTTP simple.
 */

interface BrowserHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any
  fetchText: (url: string) => Promise<string>
  close: () => Promise<void>
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

async function launchBrowser(): Promise<BrowserHandle> {
  let chromium
  try {
    ;({ chromium } = await import("playwright"))
  } catch {
    throw new Error(
      "Playwright n'est pas installé. Lance:\n" +
        "  pnpm --filter @voilierscope/scraper install\n" +
        "  npx playwright install chromium"
    )
  }

  // Proxy optionnel (rate-limit / géo) : routage via un proxy que tu fournis.
  // Ex: SCRAPER_PROXY="http://user:pass@host:port". N'est PAS une couche
  // d'évasion anti-bot — juste un transport configurable.
  const proxyServer = process.env.SCRAPER_PROXY
  const proxy = proxyServer ? { server: proxyServer } : undefined

  // Chaîne de repli : Chromium fourni par Playwright → Chrome système →
  // Edge (toujours présent sur Windows). Évite tout téléchargement si un
  // navigateur est déjà installé sur la machine.
  const channelEnv = process.env.SCRAPER_BROWSER_CHANNEL // force un canal précis
  const attempts: Array<{ channel?: string; label: string }> = channelEnv
    ? [{ channel: channelEnv, label: channelEnv }]
    : [
        { channel: undefined, label: "chromium (Playwright)" },
        { channel: "chrome", label: "Chrome système" },
        { channel: "msedge", label: "Edge système" },
      ]

  let browser
  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      browser = await chromium.launch({ headless: true, proxy, channel: attempt.channel })
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!browser) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
    if (/Executable doesn't exist|playwright install|download new browsers|channel/i.test(msg)) {
      throw new Error(
        "PLAYWRIGHT_BROWSER_MISSING: aucun navigateur utilisable (ni Chromium Playwright, ni " +
          "Chrome, ni Edge). Installe-en un :\n  pnpm --filter @voilierscope/scraper exec playwright install chromium"
      )
    }
    throw lastErr instanceof Error ? lastErr : new Error(msg)
  }

  const context = await browser.newContext({
    userAgent: DEFAULT_UA,
    locale: "fr-FR",
    viewport: { width: 1366, height: 900 },
  })

  const fetchText = async (url: string): Promise<string> => {
    const page = await context.newPage()
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      if (res && res.status() >= 400) {
        throw new Error(`HTTP ${res.status()} sur ${url}`)
      }
      // Laisse le rendu/JS se stabiliser un court instant.
      await page.waitForTimeout(1200)
      return await page.content()
    } finally {
      await page.close()
    }
  }

  return {
    browser,
    fetchText,
    close: async () => {
      await context.close()
      await browser.close()
    },
  }
}

/**
 * Crée un contexte de connecteur adossé à un navigateur réel. Appeler `close()`
 * (exposé sur le retour) en fin d'utilisation pour libérer le navigateur.
 */
export async function createBrowserContext(
  politeDelayMs = 2000
): Promise<ConnectorContext & { close: () => Promise<void> }> {
  const handle = await launchBrowser()

  return {
    fetchText: (url) => handle.fetchText(url),
    fetchOk: async (url) => {
      try {
        await handle.fetchText(url)
        return true
      } catch {
        return false
      }
    },
    log: (level, msg, meta) => {
      const line = `[${level.toUpperCase()}] ${msg}`
      if (level === "error") console.error(line, meta ?? "")
      else if (level === "warn") console.warn(line, meta ?? "")
      else console.log(line, meta ?? "")
    },
    politeDelayMs,
    close: handle.close,
  }
}
