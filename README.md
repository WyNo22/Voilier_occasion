# VoilierScope

**Le Skyscanner des voiliers d'occasion** — Moteur de recherche agrégé pour voiliers d'occasion avec analyse IA.

## Vue d'ensemble

VoilierScope est une application SaaS qui agrège les annonces de voiliers d'occasion depuis 15+ plateformes (Leboncoin, Band of Boats, YachtWorld, Facebook Marketplace, etc.) et utilise l'IA pour analyser, scorer et comparer les annonces selon vos critères.

### Fonctionnalités

- **Recherche en langage naturel** : Décrivez votre voilier idéal en français, l'IA parse la requête
- **Streaming en temps réel** : Regardez les résultats arriver en direct depuis chaque plateforme (SSE)
- **Score de correspondance** : Chaque annonce reçoit un score 0-100 basé sur vos critères
- **Analyse IA** : Résumé, extraction d'équipements, questions à poser au vendeur
- **Filtres avancés** : Budget, longueur, année, type de coque, équipements
- **Vue carte** : Localisation des bateaux sur carte interactive

## Stack technique

- **Monorepo** : pnpm workspaces + Turborepo
- **Frontend** : Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **UI** : shadcn/ui (Radix UI)
- **Base de données** : PostgreSQL + Prisma ORM
- **IA** : Claude claude-haiku-4-5-20251001 (Anthropic) pour le parsing et l'analyse
- **Streaming** : Server-Sent Events (SSE)
- **Infra** : Docker Compose

## Structure du projet

```
/
├── apps/
│   ├── web/                    # Next.js 14 frontend + API routes
│   └── scraper/                # Service d'orchestration des scrapers
├── packages/
│   ├── database/               # Prisma schema + client PostgreSQL
│   ├── types/                  # Types TypeScript partagés
│   └── scrapers/               # Modules scrapers (base + mocks)
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Démarrage rapide

### Prérequis

- Node.js >= 18
- pnpm >= 9
- Docker & Docker Compose

### Installation

```bash
# Cloner le repo
git clone <repo-url>
cd voilierscope

# Installer les dépendances
pnpm install

# Copier les variables d'environnement
cp .env.example .env
# Éditer .env et ajouter votre ANTHROPIC_API_KEY

# Démarrer PostgreSQL et Redis
docker-compose up postgres redis -d

# Générer le client Prisma
pnpm db:generate

# Pousser le schéma en base
pnpm db:push
```

### Développement

```bash
# Démarrer tous les services en développement
pnpm dev

# Ou démarrer uniquement le frontend
pnpm --filter @voilierscope/web dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

### Build de production

```bash
pnpm build
```

### Docker (production)

```bash
docker-compose up --build
```

## Variables d'environnement

Voir `.env.example` pour la liste complète. Variables essentielles :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `REDIS_URL` | URL Redis |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude) |

> **Note** : L'application fonctionne sans `ANTHROPIC_API_KEY` en mode dégradé (parser heuristique, pas d'analyse IA).

## API

### `POST /api/search`
Parse une requête en langage naturel.

```json
{ "query": "Voilier 10m Méditerranée 45k€" }
```

### `GET /api/search/stream?q=...`
SSE endpoint — stream les résultats de recherche en temps réel.

Events émis :
- `platform_start` — début de recherche sur une plateforme
- `platform_done` — résultats d'une plateforme disponibles
- `platform_error` — erreur sur une plateforme
- `complete` — recherche terminée, liste finale

### `GET /api/boats/[id]`
Détail d'une annonce.

### `POST /api/boats/[id]/analyze`
Déclenche l'analyse IA d'une annonce.

## Scrapers

Les scrapers sont dans `packages/scrapers/src/mock/`. Pour ajouter un nouveau scraper :

1. Créer `packages/scrapers/src/mock/mon-site.ts`
2. Étendre `BaseScraper`
3. Implémenter la méthode `search(query: SearchQuery)`
4. Exporter depuis `packages/scrapers/src/index.ts`

```typescript
import { BaseScraper } from "../base"

export class MonSiteScraper extends BaseScraper {
  readonly name = "mon-site"
  readonly displayName = "Mon Site"
  readonly baseUrl = "https://mon-site.fr"

  async search(query: SearchQuery): Promise<ScraperResult> {
    // Votre logique de scraping ici
  }
}
```

## Score de correspondance

Le score (0-100) est calculé par `apps/web/lib/ai/scoreBoat.ts` selon ces critères pondérés :

| Critère | Poids |
|---------|-------|
| Budget | 25% |
| Équipements | 20% |
| Longueur | 15% |
| Année | 15% |
| État | 15% |
| Localisation | 10% |

## Licence

MIT
