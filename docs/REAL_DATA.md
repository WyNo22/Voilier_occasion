# Brancher les vraies données (ingestion réelle)

Ce guide explique comment passer des données de démo aux **vraies annonces**
scrappées, persistées en base, et affichées dans l'app.

> ⚠️ Le scraping live ne fonctionne **pas** depuis l'environnement Claude Code
> sur le web (réseau en allowlist). Il faut l'exécuter **sur ta machine**, où
> internet est ouvert.

## Architecture du flux réel

```
connecteurs (JSON-LD/sitemap)  →  extract  →  core.normalize  →  core.dedupe
        →  Prisma upsert (Boat + PriceHistory)  →  l'app web lit la DB
```

Tant que la base est vide ou que `DATABASE_URL` n'est pas défini, l'app
retombe automatiquement sur les données de démo : **rien ne casse**.

## Étapes (sur ta machine)

### 1. Lancer la base de données
```bash
docker compose up -d postgres
```
(Postgres écoute sur `localhost:5432`, identifiants dans `docker-compose.yml`.)

### 2. Configurer l'environnement
Crée un fichier `.env` à la racine (voir `.env.example`) avec au minimum :
```
DATABASE_URL=postgresql://voilierscope:voilierscope_password@localhost:5432/voilierscope
```

### 3. Créer le schéma en base
```bash
pnpm --filter @voilierscope/database run db:generate
pnpm --filter @voilierscope/database run db:push
```

### 4. Lancer une ingestion réelle
```bash
DATABASE_URL=postgresql://voilierscope:voilierscope_password@localhost:5432/voilierscope \
  pnpm --filter @voilierscope/scraper ingest "voilier 10-12m"
```
La commande affiche un **healthcheck** de chaque source puis les statistiques
(découvertes / extraites / créées / baisses de prix).

### 5. Lancer l'app — elle sert maintenant les vraies données
```bash
DATABASE_URL=postgresql://voilierscope:voilierscope_password@localhost:5432/voilierscope \
  pnpm --filter @voilierscope/web dev
```
→ http://localhost:3000 — la recherche lit d'abord la base (annonces réelles),
et ne retombe sur la démo que si la base est vide.

## Flux de données (voie privilégiée pour la couverture large)

La façon la plus efficace et **légale** d'élargir l'inventaire n'est pas le
scraping HTML mais les **flux de courtiers/partenaires** (XML, RSS, JSON, API).
Beaucoup de courtiers exportent déjà leurs annonces vers plusieurs portails via
des flux standardisés.

Pour brancher un flux : ajoute une config dans `FEED_SOURCE_CONFIGS`
(`packages/scrapers/src/connectors/index.ts`). Le `FeedConnector` mappe chaque
entrée vers le schéma canonique de façon déclarative — exemple complet en
commentaire dans ce fichier. Aucune dépendance navigateur, pas d'anti-bot.

L'ingestion (`pnpm ingest`) combine automatiquement **flux + connecteurs HTML**
via `getAllRealConnectors()`.

### Crawl complet (DB = le site entier)

Par défaut, le crawl prend la 1re page de résultats. Pour **indexer tout le
site**, le connecteur parcourt les pages de résultats. Profondeur pilotée par
variables d'env (valables pour tous les connecteurs HTML) :

```
SCRAPER_MAX_PAGES=50        # nombre de pages de résultats à parcourir
SCRAPER_MAX_LISTINGS=10000  # plafond d'annonces par passe (sécurité)
```

Le crawl **s'arrête automatiquement** dès qu'une page n'apporte aucune nouvelle
annonce (fin de pagination, ou format d'URL de page incorrect).

> ⚠️ Le format d'URL de page par défaut est `?page=N`. Si une source utilise un
> autre format (ex: `/page-2`, `/p/2`), le crawl s'arrêtera à la page 1 :
> fournir alors `pagination.pageUrl` dans la config du connecteur. Pour trouver
> le format : sur le site, va en page 2 des résultats et regarde l'URL.

Le worker de veille peut crawler en profondeur (background, politesse de 1,5–2s
entre requêtes) pour maintenir l'index frais.

### Proxy (optionnel)
Pour router via un proxy (rate-limit / géo) que tu fournis légalement :
```
SCRAPER_PROXY="http://user:pass@host:port"
```
Pris en compte par le connecteur navigateur. Ce n'est pas une couche d'évasion
anti-bot — pour les sites à fort anti-bot (Leboncoin/Facebook), la voie est le
partenariat data, pas le contournement (voir ROADMAP.md §2).

## Calibrer les sources HTML

Les sources réelles sont définies dans
`packages/scrapers/src/connectors/index.ts` (`REAL_SOURCE_CONFIGS`). Pour
chaque source :

1. Ouvre une fiche d'annonce dans ton navigateur, affiche le code source,
   cherche `application/ld+json`. Si présent → le connecteur générique marche
   tel quel. Sinon, l'Open Graph (`og:title`, `product:price:amount`…) sert de
   secours automatique.
2. Trouve le sitemap : souvent `https://site/sitemap.xml`, ou indiqué dans
   `https://site/robots.txt` (ligne `Sitemap:`).
3. Ajuste `sitemapUrl` et `listingUrlPattern` dans la config.

### Si une source est protégée par un anti-bot (DataDome, Cloudflare)
Le `healthcheck` renverra `injoignable`. Deux options :
- **La contourner proprement** est fragile et juridiquement gris → déconseillé.
- Implémenter un connecteur **headless** (Playwright) pour cette source
  uniquement (le contrat `SourceConnector` est déjà prêt pour ça : il suffit
  d'une nouvelle classe à côté de `JsonLdConnector`).

La voie recommandée reste de **privilégier les sources à flux/partenaires ou
publiant du JSON-LD** (voir `ROADMAP.md` §2).

## Tests
Le moteur d'extraction et de normalisation est couvert par des tests
déterministes (fixtures HTML), exécutables partout :
```bash
pnpm test
```
