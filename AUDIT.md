# Audit technique — VoilierScope

> État des lieux au démarrage de la phase « produit réel ».
> Rédigé avant toute modification fonctionnelle (commit `1fdeef9`).

## 1. Vue d'ensemble

VoilierScope est un monorepo **Turborepo + pnpm** structuré ainsi :

```
apps/
  web/        → Next.js 14 (App Router), UI premium, API routes
  scraper/    → service Node autonome (orchestration scrapers)
packages/
  types/      → contrats TypeScript partagés
  scrapers/   → connecteurs (actuellement 5 mocks)
  database/   → client Prisma + schéma PostgreSQL
```

L'expérience actuelle : l'utilisateur tape une requête en langage naturel →
elle est parsée par Claude Haiku (`parseSearch.ts`) → les scrapers mock
renvoient des annonces → un moteur de scoring les classe → le tout est streamé
en SSE vers une UI soignée (Framer Motion).

C'est un **prototype de démonstration abouti sur le plan visuel**, mais sans
socle produit (pas de persistance, pas de vraie collecte, pas d'utilisateurs).

## 2. Forces

- **UX/UI de très bon niveau.** Page d'accueil, recherche en direct (SSE),
  animations, score visuel. L'inspiration Linear/Vercel est tenue.
- **Architecture monorepo propre.** Séparation apps/packages correcte,
  contrats partagés dans `@voilierscope/types`, frontière nette.
- **Streaming temps réel déjà en place.** L'API `/api/search/stream` diffuse la
  progression plateforme par plateforme — exactement le comportement « voir
  l'agent travailler » demandé. C'est un acquis réutilisable.
- **Abstraction scraper existante.** `BaseScraper` impose un contrat
  `search()` + `normalize()`. Bonne base pour brancher du vrai scraping.
- **Fallback IA dégradé.** `parseSearch` fonctionne sans clé API (regex). Bon
  réflexe de robustesse.
- **Schéma Prisma déjà pensé** (Boat, PriceHistory, SearchSession) avec index.

## 3. Faiblesses

| # | Faiblesse | Impact |
|---|-----------|--------|
| F1 | **La base de données n'est jamais utilisée.** Aucune API route n'importe `@voilierscope/database`. Tout passe par des `Map` en mémoire. | Aucune persistance → veille/alertes/historique impossibles en l'état. |
| F2 | **Aucun vrai scraper.** Les 5 sources sont des tableaux statiques. | Le produit ne collecte rien de réel. |
| F3 | **Zéro test.** Aucun unit/integration/e2e. | Régressions invisibles, refonte risquée. |
| F4 | **Caches en mémoire par requête.** `boatCache` se reconstruit, non partagé entre routes/instances. | Incohérences, fuite mémoire, non scalable (serverless). |
| F5 | **Normalisation incomplète.** Seule la conversion pieds→m existe. Pas de devises, milles, nœuds, ni nettoyage texte. | Données hétérogènes une fois le vrai scraping branché. |
| F6 | **Scoring non expliqué et non pondéré par le besoin.** Le `ScoreBreakdown` est calculé mais l'UI n'affiche pas de justification ; pas de scores vie-à-bord/grande-croisière réels. | Promesse produit (« pourquoi ce bateau ») non tenue. |
| F7 | **Pas de déduplication.** Une annonce multi-sources apparaîtra en double. | Qualité des résultats. |
| F8 | **Détection de critères manquants absente.** Le parsing ne pose jamais de question de clarification. | Fonctionnalité « assistant » demandée non couverte. |
| F9 | **Secrets/clé API côté process sans garde-fou.** Pas de validation d'env, pas de rate-limit, CORS `*`. | Sécurité/coût avant ouverture publique. |
| F10 | **Pas d'observabilité.** `console.log` épars, aucun log structuré ni métrique. | Exploitation impossible en prod. |
| F11 | **Aucune notion d'utilisateur / mission / alerte.** | Coeur de la nouvelle vision (agent de veille) absent. |

## 4. Risques

- **R1 — Légal/anti-bot (élevé).** Le scraping réel de Leboncoin / Facebook
  Marketplace viole leurs CGU et déclenche des protections (DataDome, etc.).
  Risque juridique et technique majeur. *Stratégie de mitigation en §
  Roadmap.*
- **R2 — Coût LLM non maîtrisé.** Un appel Claude par requête/annonce sans
  cache ni quota peut exploser à l'échelle.
- **R3 — Dette si on empile des features sur les `Map` en mémoire.** Chaque
  jour sans persistance rend la migration plus douloureuse.
- **R4 — Qualité de données.** Sans normalisation/dedup robustes, le scoring
  et la veille produiront du bruit et perdront la confiance utilisateur.
- **R5 — Serverless + état.** Next.js sur Vercel = fonctions sans état ; toute
  logique « continue » (veille) doit vivre dans un worker dédié + queue.

## 5. Priorités (ordre d'exécution recommandé)

1. **P0 — Socle de données réel.** Brancher Prisma partout, supprimer les
   `Map`. Étendre le schéma (User, Mission, Alert, Snapshot).
2. **P0 — Bibliothèque `@voilierscope/core`** : normalisation (unités,
   devises), déduplication, scoring **explicable**, avec tests unitaires.
   → *C'est le cerveau réutilisable par le web ET le worker de veille.*
3. **P1 — Architecture de connecteurs** découplée (discovery / detail /
   extract / normalize / errors) + contrat pour vrai scraping.
4. **P1 — Agent de veille** : modèle de mission, exécution périodique,
   détection d'opportunités, file d'alertes, digest.
5. **P2 — Canaux d'alerte** (email, Telegram, Discord, push) + priorisation.
6. **P2 — Tests d'intégration & e2e**, observabilité (logs structurés,
   métriques), rate-limiting, validation d'env.
7. **P3 — Mémoire utilisateur / profil évolutif**, agent conversationnel par
   mission.

La phase courante livre **P0 + amorce P1** (voir `ROADMAP.md`).
