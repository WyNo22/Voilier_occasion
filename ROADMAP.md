# Architecture cible & Roadmap — VoilierScope

Ce document décrit où va le produit, comment intégrer le **vrai scraping**, et
comment fonctionne l'**agent de veille intelligent**. Il sert de référence
d'architecture pour toutes les contributions.

---

## 1. Architecture cible

```
                        ┌─────────────────────────────┐
                        │          apps/web            │
                        │  Next.js (UI + API publique) │
                        └───────────────┬─────────────┘
                                        │ Prisma
                        ┌───────────────▼─────────────┐
                        │        PostgreSQL            │
                        │  Boat · Mission · Alert ...  │
                        └───────────────▲─────────────┘
                                        │ Prisma
        ┌───────────────────────────────┴───────────────────────────┐
        │                    apps/worker (à créer)                   │
        │  - planificateur de missions (cron / BullMQ + Redis)       │
        │  - exécution des connecteurs                               │
        │  - détection d'opportunités → file d'alertes               │
        │  - envoi des notifications (email/telegram/discord/push)   │
        └───────────────────────────────┬───────────────────────────┘
                                        │
        ┌───────────────────────────────▼───────────────────────────┐
        │                     packages/core                          │
        │  normalisation · dédup · scoring explicable · matching     │
        └────────────────────────────────────────────────────────────┘
        ┌────────────────────────────────────────────────────────────┐
        │                    packages/scrapers                       │
        │   SourceConnector (discovery/detail/extract/normalize)     │
        └────────────────────────────────────────────────────────────┘
```

**Principe clé :** la logique métier (normalisation, scoring, dédup, matching)
vit dans `@voilierscope/core`, **sans dépendance réseau ni DB**, donc testable
et partagée entre le `web` (recherche à la demande) et le `worker` (veille).

---

## 2. Intégration du vrai scraping — pistes concrètes

Le scraping de places de marché grand public est un problème **juridique,
technique et opérationnel** autant que de code. Stratégie recommandée, par
ordre de préférence :

### 2.1 Privilégier les sources légitimes (recommandé)
- **APIs/flux officiels & partenaires.** Plusieurs places de marché nautiques
  (Band of Boats, YachtWorld/Boats Group, iNautia, Boat24) proposent des flux
  pro, exports XML, ou partenariats d'affiliation. C'est la voie *durable* et
  *légale*. → Démarcher en priorité, brancher un connecteur par flux.
- **Données structurées publiques.** Beaucoup de fiches exposent du
  JSON-LD `schema.org/Product`/`Vehicle` ou des balises Open Graph
  directement dans le HTML public. Extraction propre, peu fragile.
- **Sitemaps.** `sitemap.xml` permet une découverte d'URL respectueuse
  (vs. crawl agressif).

### 2.2 Scraping HTML responsable (sources sans API)
Pour les sources sans flux, encapsuler chaque source dans un **connecteur**
implémentant le contrat `SourceConnector` (voir §3). Bonnes pratiques :
- Respect de `robots.txt` et des `Crawl-delay`.
- Rate-limiting + backoff exponentiel + jitter (déjà amorcé dans `BaseScraper`).
- `User-Agent` honnête et identifiable, pas d'usurpation.
- Cache HTTP (ETag/Last-Modified) pour ne pas re-télécharger l'inchangé.
- Couche de parsing isolée et testée (fixtures HTML enregistrées).

### 2.3 Stack technique pour le scraping
- **HTTP léger** (`undici`/`fetch`) + parsing **`cheerio`** pour les pages
  statiques → rapide, peu coûteux. À privilégier.
- **Navigateur headless** (`playwright`) uniquement pour les sources rendues
  côté client. Coûteux → réserver aux cas nécessaires.
- **Anti-bot (DataDome, Cloudflare).** Sur Leboncoin / Facebook Marketplace,
  c'est un mur. Plutôt que de jouer au chat et à la souris (proxies
  résidentiels, fingerprinting — coûteux, fragile, juridiquement gris),
  **préférer une approche d'agrégateur partenaire** ou exclure ces sources du
  périmètre légal initial. ⚠️ Décision produit/légal à valider (voir
  questions bloquantes).
- **Files & planification.** `BullMQ` (Redis) pour distribuer les jobs de
  scrape, gérer retries, concurrence par domaine, et alimenter le worker de
  veille.

### 2.4 Pipeline d'extraction
```
SourceConnector.discover(query)   → liste d'URLs/identifiants
SourceConnector.fetchDetail(ref)  → HTML/JSON brut
SourceConnector.extract(raw)      → RawListing (champs source)
core.normalize(RawListing)        → BoatListing (schéma unifié, unités SI/EUR)
core.dedupKey(BoatListing)        → clé de fusion (URL/texte/specs)
prisma.boat.upsert(...)           → persistance + PriceHistory
core.score(BoatListing, mission)  → scores + justification
```

L'IA (Claude) intervient pour **l'extraction sémantique** des champs durs à
parser (équipements cités en texte libre, état, travaux à prévoir) — avec
mise en cache par hash de description pour maîtriser le coût.

---

## 3. Contrat de connecteur (`SourceConnector`)

Chaque source est **interchangeable** et implémente :

```ts
interface SourceConnector {
  readonly id: string
  readonly displayName: string
  readonly baseUrl: string
  readonly kind: "api" | "html" | "headless" | "mock"

  discover(query: SearchQuery, ctx: ConnectorContext): Promise<SourceRef[]>
  fetchDetail(ref: SourceRef, ctx: ConnectorContext): Promise<RawListing>
  extract(raw: RawListing): NormalizedInput        // champs source → champs canoniques
  healthcheck(): Promise<ConnectorHealth>
}
```

- `discover` et `fetchDetail` gèrent réseau + erreurs (retry/backoff via
  `ConnectorContext`).
- `extract` est **pur** (testable sur fixtures).
- La normalisation finale (unités, devises) est centralisée dans `core`, pas
  dupliquée par connecteur.
- Un connecteur défaillant n'interrompt jamais une recherche (isolation
  d'erreur déjà présente dans `/api/search/stream`).

Les 5 mocks actuels seront migrés vers ce contrat ; ils restent utiles comme
sources de test déterministes et pour les e2e.

---

## 4. Agent de veille intelligent

### 4.1 Modèle de données (voir `schema.prisma`)
- `User` — compte + préférences de notification + profil évolutif (mémoire).
- `Mission` — nom, prompt, filtres structurés, fréquence, canaux, état.
- `MissionRun` — exécution datée (annonces vues/nouvelles/modifiées, durée).
- `Boat` — annonce canonique (déjà présent, enrichi).
- `MissionMatch` — lien Mission↔Boat avec scores + justification + statut.
- `PriceHistory` — déjà présent, alimente la détection de baisse.
- `Alert` — événement notifiable, priorité, canal, statut d'envoi.

### 4.2 Boucle de veille (worker)
```
pour chaque Mission due (selon fréquence) :
  run = créer MissionRun
  refs = connecteurs.discover(mission.filters)
  pour chaque ref nouvelle/modifiée :
     boat = pipeline d'extraction + normalisation
     upsert Boat + PriceHistory
     scores = core.score(boat, mission)
     classer l'événement (voir 4.3)
  détecter : nouvelles annonces, baisses de prix, annonces supprimées,
             sous-cotées (prix << médiane segment), rares
  produire Alert(s) priorisées
  clôturer run (stats)
```

### 4.3 Priorisation des alertes
| Priorité | Déclencheur | Action |
|----------|-------------|--------|
| **Critique** | match > 95 % **ou** prix < 85 % de la médiane du segment | notification immédiate |
| **Important** | match élevé (≥ 85 %) ou baisse de prix significative | notification rapide |
| **Faible** | simple correspondance | regroupé dans le digest quotidien |

### 4.4 Canaux & digest
- **Email** (transactionnel : Resend/Postmark) — alertes + digest matinal.
- **Telegram / Discord** — bots natifs (webhooks), idéal pour le temps réel.
- **Web Push** (VAPID) puis mobile plus tard.
- **Digest quotidien** : « Votre agent a analysé N annonces cette nuit » +
  Top 5 nouveautés, Top 5 affaires, évolution des prix du segment.

### 4.5 Mémoire utilisateur & scores de compatibilité
- Profil évolutif : pondérations apprises depuis les interactions (marques
  consultées, favoris, clics) stockées sur `User`.
- Scores par mission : `match`, `qualité bateau`, `valeur marché`,
  `vie à bord`, `grande croisière` → **recommandation IA** en langage naturel.

### 4.6 Agent conversationnel par mission
Chat ancré sur les données collectées de la mission (« montre-moi seulement
les bateaux avec dessalinisateur », « du nouveau depuis hier ? », « pourquoi
ce bateau est 1er ? »). Implémenté via tool-use Claude au-dessus de requêtes
Prisma filtrées par mission.

---

## 5. Découpage en phases

- **Phase 0 (en cours)** : audit, `@voilierscope/core` (normalisation + dédup
  + scoring explicable + tests), schéma étendu (User/Mission/Alert), contrat
  de connecteur. *Aucune dépendance externe requise → tout est testable.*
- **Phase 1** : persistance Prisma branchée dans le web, `apps/worker` +
  planificateur, premier vrai connecteur (source avec flux/JSON-LD).
- **Phase 2** : canaux d'alerte + digest, observabilité, rate-limit, e2e.
- **Phase 3** : mémoire utilisateur, agent conversationnel, mobile/push.

---

## 6. Décisions à valider (non bloquantes — hypothèses prises par défaut)

1. **Périmètre légal des sources.** Hypothèse retenue : démarrer sur sources
   à flux/partenaires + JSON-LD public ; exclure Leboncoin/Facebook du
   scraping agressif tant que le cadre légal n'est pas validé.
2. **Auth.** Hypothèse : email + magic link (sans mot de passe) à terme.
3. **Hébergement worker.** Hypothèse : worker Node persistant (Railway/Fly/VM)
   + Redis ; le web reste sur Vercel.
4. **Email provider.** Hypothèse : Resend.

Voir la fin de chaque session pour les questions bloquantes mises à jour.
