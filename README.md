# NexaGrid v1.0

Librairie JavaScript de tableau de données professionnel — inspirée de AG Grid et Tabulator.  
**Dual-panel frozen scroll · ApexCharts · Pagination AG Grid · Tree styles · Formules · Filtre server-side**

Zéro dépendance obligatoire · Bootstrap 5 + ApexCharts injectés automatiquement.

---

## Sommaire

1. [Installation](#installation)
2. [Instanciation](#instanciation)
3. [Options complètes](#options-complètes)
4. [Colonnes](#colonnes)
5. [Types de colonnes](#types-de-colonnes)
6. [Filtres typés](#filtres-typés)
7. [Colonnes calculées (formula)](#colonnes-calculées)
8. [Tree / données arborescentes](#tree--données-arborescentes)
9. [Groupement](#groupement)
10. [Layout system](#layout-system)
11. [Pagination AG Grid](#pagination-ag-grid)
12. [Infinite scroll](#infinite-scroll)
13. [Graphiques ApexCharts](#graphiques-apexcharts)
14. [Édition inline + validation](#édition-inline--validation)
15. [Fonctionnalités utilisateur](#fonctionnalités-utilisateur)
16. [Désactiver des éléments UI](#désactiver-des-éléments-ui)
17. [Sélection en plage](#sélection-en-plage)
18. [Vues](#vues)
19. [API publique complète](#api-publique-complète)
20. [Événements](#événements)
21. [Thèmes](#thèmes)
22. [Intégration dans un template](#intégration-dans-un-template)

---

## Installation

Copiez les 2 fichiers dans votre projet :

```
nexagrid.css
nexagrid.js
```

Dans votre HTML :

```html
<!-- 1. CSS NexaGrid -->
<link rel="stylesheet" href="nexagrid.css" />

<!-- 2. NexaGrid JS -->
<script src="nexagrid.js"></script>
```

> **Bootstrap 5** et **ApexCharts** sont injectés automatiquement par NexaGrid (CDN).  
> Pas besoin de les inclure manuellement.

---

## Instanciation

```html
<!-- La taille est contrôlée par VOS styles, pas par la librairie -->
<div id="myGrid" style="height: 500px"></div>
```

```js
// Style Tabulator
const grid = new NexaGrid("#myGrid", options);

// Style AG Grid
const grid = NexaGrid.createGrid(document.getElementById("myGrid"), options);
```

---

## Options complètes

```js
const grid = new NexaGrid("#myGrid", {
  // ── Général
  title: "Mon tableau", // titre affiché dans la toolbar
  height: null, // null = votre CSS contrôle la taille
  // ou '500px' pour forcer une hauteur

  // ── Colonnes & données
  columns: [], // définitions de colonnes (voir §Colonnes)
  data: null, // tableau initial de données
  treeChildField: "children", // nom de la propriété enfants pour le tree
  treeStyle: "default", // 'default' | 'lines' | 'folder'

  // ── Fonctionnalités
  showFilters: true, // ligne de filtres visible au départ
  showToolbar: true, // barre d'outils
  showStatus: true, // barre de statut
  showAggRow: true, // ligne TOTAL en bas
  editable: true, // édition inline globale (double-clic)
  rowDrag: true, // poignée de réordonnancement des lignes
  rowPin: true, // épinglage de lignes
  multiSort: true, // tri multi-colonnes (Shift+clic)
  cfEnabled: false, // formatage conditionnel au départ

  // ── Groupement
  groupBy: null, // champ de groupement initial

  // ── Layout
  layout: "fitDataFill", // voir §Layout system

  // ── Formules
  formulaMode: "lazy", // 'lazy' = calcul à chaque rendu (défaut)
  // 'eager' = calcul unique au chargement des données

  // ── Filtre server-side
  serverSideFilter: false, // true = onFilterChanged déclenché au lieu du filtre client

  // ── Pagination AG Grid
  paginationPosition: "bottom", // 'top' | 'bottom' | 'both' | false
  pageSize: 25, // lignes par page; sélecteur: 10/25/50/100/250/500/Tout

  // ── Infinite scroll
  totalCount: 0, // total côté serveur (0 = auto)
  onLoadMore: null, // callback infinite scroll (voir §Infinite scroll)

  // ── Personnalisation UI
  toolbarHidden: [], // boutons toolbar à masquer (voir §Désactiver des éléments UI)
  contextMenuHidden: [], // items du menu clic droit à masquer

  // ── Loader de démarrage
  loader: {
    title: "MON APP",
    subtitle: "Chargement…",
    steps: ["Connexion…", "Données…", "Prêt !"],
    duration: 2000, // durée totale en ms
    accentColor: "#1e6dc5",
  },
  // Pour désactiver le loader : loader: false

  // ── Graphiques ApexCharts
  graph: {
    kpis: [], // KPIs affichés en haut (voir §Graphiques)
    sections: [], // sections personnalisées
  },

  // ── Événements (voir §Événements)
  onRowClick: null,
  onRowDblClick: null,
  onCellClick: null,
  onCellValueChanged: null,
  onSelectionChanged: null,
  onFilterChanged: null, // reçoit (filters, grid) — 2e arg = instance
  onSortChanged: null,
  onRowMoved: null,
  onRowPinned: null,
  onDataLoaded: null,
  onReady: null,
  onLoadMore: null,
  onPageSizeChanged: null, // reçoit (pageSize, grid)
});
```

---

## Colonnes

```js
columns: [
  {
    // ── Identification
    field: "solde", // nom de la propriété dans vos données (obligatoire)
    id: "solde", // alias de field

    // ── Affichage
    headerName: "Solde", // texte de l'en-tête (alias : title, label)
    group: "Montants", // groupe d'en-tête (2 niveaux visuels)
    width: 120, // largeur en px
    minWidth: 40, // largeur minimale au redimensionnement

    // ── Type & format
    type: "num", // voir §Types de colonnes
    decimals: 2, // décimales pour type:'num'
    badgeColors: {
      // couleurs pour type:'badge'
      Validé: "green",
      Rejeté: "red",
      "En cours": "blue",
      Brouillon: "gray",
    },

    // ── Comportement
    frozen: false, // colonne gelée à gauche (alias : pinned:'left')
    visible: true, // visible au départ (alias : hide:false)
    editable: true, // édition inline double-clic
    sortable: true, // tri au clic sur l'en-tête (alias : noSort:false)

    // ── Filtre
    filter: "num", // voir §Filtres typés (false pour désactiver)

    // ── Agrégation (ligne TOTAL)
    aggFunc: "sum", // 'sum' | 'avg' | 'min' | 'max' | 'count'
    // auto : 'sum' si type:'num'

    // ── Colonne calculée
    formula: (row) => row.debit - row.credit, // voir §Colonnes calculées

    // ── Formatteur personnalisé
    formatter: ({ value, row, col }) => {
      // Retourne une string ou un HTMLElement
      return value > 0 ? `+${value} €` : `${value} €`;
    },

    // ── Tooltip
    tooltip: true, // tooltip au survol (valeur de la cellule)
    tooltipField: "note", // ou utiliser un autre champ pour le texte

    // ── Formatage conditionnel
    cf: true, // participe au CF (vert/orange/rouge)

    // ── Validation d'édition
    validate: (value) => {
      if (parseFloat(value) < 0) return "La valeur doit être positive";
      return true; // true = valide
    },
  },
];
```

---

## Types de colonnes

| `type`     | Rendu                                     | Filtre auto        |
| ---------- | ----------------------------------------- | ------------------ |
| `text`     | Texte brut                                | Texte contient     |
| `num`      | Nombre formaté, aligné droite, vert/rouge | Opérateur + number |
| `date`     | Date (dd/mm/yyyy ou iso)                  | Sélecteur date     |
| `badge`    | Badge coloré arrondi                      | Select dropdown    |
| `boolean`  | ✓ ou —                                    | Select dropdown    |
| `progress` | Barre de progression + %                  | Texte              |
| `spark`    | Mini-graphique sparkline                  | _(désactivé)_      |

Aliases acceptés : `number`, `numeric`, `currency`, `float`, `int` → `num` · `datetime` → `date` · `bool` → `boolean` · `tag` → `badge` · `sparkline` → `spark`

---

## Filtres typés

Le widget de filtre s'adapte automatiquement au type de la colonne.

```js
// Filtre texte (défaut pour type:'text')
{ field:'entity', filter:'text' }

// Filtre numérique : select opérateur (=, !=, >, >=, <, <=) + input number
{ field:'solde', type:'num' }           // auto
{ field:'solde', filter:'number' }      // explicite

// Filtre date : <input type="date"> natif
{ field:'date', type:'date' }           // auto
{ field:'date', filter:'date' }         // explicite

// Filtre plage de dates : deux inputs "du → au"
{ field:'echeance', filter:'dateRange' }

// Filtre select : dropdown des valeurs uniques
{ field:'statut', type:'badge' }        // auto
{ field:'ccy',    filter:'select' }     // forcer sur un type text

// Désactiver le filtre sur une colonne
{ field:'spark',  filter: false }
```

**Programmer un filtre depuis le code :**

```js
// Filtre texte
grid.setFilter("entity", "CORP-FR");

// Filtre numérique avec opérateur
grid.setFilter("solde", null, { type: "num", op: "<", value: -10000 });

// Filtre date exacte
grid.setFilter("date", null, { type: "date", value: "2024-03-15" });

// Filtre plage de dates
grid.setFilter("echeance", null, {
  type: "dateRange",
  from: "2024-01-01",
  to: "2024-06-30",
});

// Filtre select
grid.setFilter("statut", "Validé", { type: "select", value: "Validé" });

// Effacer tous les filtres
grid.clearFilters();

// Lire les filtres actifs
const filters = grid.getFilters();
// → { solde: { type:'num', op:'<', value:'-10000' }, ... }
```

### Filtre server-side

Quand `serverSideFilter: true`, NexaGrid ne filtre plus côté client.  
À chaque changement de filtre, `onFilterChanged` est déclenché pour que vous fassiez l'appel API.

```js
const grid = new NexaGrid("#myGrid", {
  serverSideFilter: true,

  onFilterChanged: (filters, grid) => {
    // filters = { statut: { type:'select', value:'Validé' }, ... }
    // grid = instance NexaGrid

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([field, f]) => {
      if (f.type === "num") params.set(field, `${f.op}${f.value}`);
      else if (f.type === "select") params.set(field, f.value);
      else params.set(field, f.value);
    });

    grid.showLoader("Filtrage…");
    fetch(`/api/data?${params}`)
      .then((r) => r.json())
      .then((data) => {
        grid.setData(data.rows);
        grid.setTotalCount(data.total);
        grid.hideLoader();
      });
  },
});
```

---

## Colonnes calculées

Une colonne calculée reçoit `formula: (row) => valeur`. Elle n'est **jamais stockée** dans la donnée.

```js
columns: [
  { field: "debit", type: "num", aggFunc: "sum" },
  { field: "credit", type: "num", aggFunc: "sum" },
  { field: "taux", type: "num", decimals: 4 },

  // ── Colonne numérique calculée
  {
    field: "solde_eur",
    headerName: "Solde EUR",
    type: "num",
    decimals: 2,
    aggFunc: "sum", // les formules participent aux totaux
    editable: false,
    formula: (row) => {
      const solde = parseFloat(row.solde) || 0;
      const taux = parseFloat(row.taux) || 1;
      return row.ccy === "EUR" ? solde : Math.round((solde / taux) * 100) / 100;
    },
  },

  // ── Badge calculé
  {
    field: "risque",
    headerName: "Risque",
    type: "badge",
    editable: false,
    formula: (row) => {
      const couv = parseFloat(row.couv) || 0;
      if (couv > 70) return "Faible";
      if (couv > 35) return "Moyen";
      return "Élevé";
    },
    badgeColors: { Faible: "green", Moyen: "orange", Élevé: "red" },
  },

  // ── Texte calculé
  {
    field: "label_complet",
    headerName: "Label",
    type: "text",
    formula: (row) => `${row.ref} — ${row.entity} (${row.ccy})`,
  },

  // ── Jours restants avant échéance
  {
    field: "jours",
    headerName: "J. restants",
    type: "num",
    decimals: 0,
    formula: (row) => {
      if (!row.echeance) return null;
      const [d, m, y] = String(row.echeance).split("/");
      return Math.round((new Date(`${y}-${m}-${d}`) - Date.now()) / 86400000);
    },
  },
];
```

**Mode eager** — calcul unique au chargement, plus performant sur gros volumes :

```js
const grid = new NexaGrid('#myGrid', {
  formulaMode: 'eager',   // toutes les formules calculées une fois à setData()
  columns: [...]
});
```

---

## Tree / données arborescentes

Ajoutez une propriété `children` dans vos objets. NexaGrid détecte la hiérarchie automatiquement.

```js
const data = [
  {
    ref: 'GRP-EUR', entity: 'Zone EUR', solde: 750000, ccy: 'EUR',
    children: [
      {
        ref: 'CORP-FR', entity: 'CORP-FR', solde: 500000,
        children: [
          { ref:'TRF-0001', entity:'CORP-FR', debit:200000, solde:-200000, statut:'Validé' },
          { ref:'TRF-0002', entity:'CORP-FR', credit:300000, solde:300000, statut:'En cours' },
        ]
      },
      {
        ref: 'CORP-DE', entity: 'CORP-DE', solde: 250000,
        children: [
          { ref:'TRF-0003', entity:'CORP-DE', credit:250000, solde:250000, statut:'Validé' },
        ]
      }
    ]
  },
  {
    ref: 'GRP-USD', entity: 'Zone USD', solde: -150000, ccy: 'USD',
    _expanded: false,   // replié par défaut au chargement
    children: [
      { ref:'TRF-0010', entity:'HQ-CH', debit:150000, solde:-150000, statut:'Validé' }
    ]
  }
];

const grid = new NexaGrid('#myGrid', {
  columns: [...],
  data,
  treeChildField: 'children',  // défaut : 'children'
  treeStyle:      'default',   // voir tableau ci-dessous
});
```

### Styles visuels du tree

| `treeStyle` | Rendu                                      |
| ----------- | ------------------------------------------ |
| `'default'` | Flèches ▾/▸ avec indentation en px         |
| `'lines'`   | Style ASCII `├─ └─ │`                      |
| `'folder'`  | Icônes 📂 (ouvert) 📁 (fermé) 📄 (feuille) |

### CSS automatique des enfants

NexaGrid applique automatiquement un style visuel distinct selon la profondeur :

```
Nœuds parents  → gras, bordure gauche bleue
depth-1        → fond légèrement teinté #f5f8fd, bordure bleue
depth-2        → bordure verte
depth-3        → bordure orange
depth-4+       → bordure violette
Feuilles       → fond clair #f9fbff, texte atténué
```

**Comportement :**

- `▾` / `▸` — plier / déplier au clic
- Indentation : 14 px par niveau de profondeur
- Tri et filtres s'appliquent sur les lignes visibles
- Profondeur illimitée

**État initial :**

```js
{ _expanded: false, children:[...] }  // replié au chargement
{ _expanded: true,  children:[...] }  // déplié (défaut si non spécifié)
```

---

## Groupement

```js
// À l'instanciation
const grid = new NexaGrid('#myGrid', {
  groupBy: 'ccy',
  columns: [
    { field:'solde', type:'num', aggFunc:'sum', decimals:2 },
    { field:'debit', type:'num', aggFunc:'sum', decimals:2 },
  ],
  data: [...],
});

// Dynamiquement
grid.setGroupBy('ccy');     // groupe par devise
grid.setGroupBy('statut');  // groupe par statut
grid.setGroupBy('entity');  // groupe par entité
grid.clearGroupBy();        // désactiver le groupement
grid.toggleGrouping();      // bouton toolbar ⊞ Grouper
```

Chaque groupe affiche : **valeur · nombre de lignes · sous-totaux** des colonnes `aggFunc:'sum'`.

---

## Layout system

```js
const grid = new NexaGrid("#myGrid", {
  layout: "fitDataFill", // défaut
});

grid.setLayout("fitColumns"); // changer dynamiquement
```

| Valeur           | Comportement                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `fitDataFill`    | Colonnes adaptées au contenu, tableau remplit la largeur _(défaut)_ |
| `fitData`        | Colonnes adaptées au contenu, pas d'étirement                       |
| `fitColumns`     | Colonnes réparties proportionnellement dans la largeur disponible   |
| `fitDataStretch` | Comme `fitDataFill` mais étire la dernière colonne libre            |

---

## Pagination AG Grid

La barre de pagination affiche les informations **à droite** avec des boutons de navigation style AG Grid.

```
  Lignes/page: [25▾]   « ‹  Page 1 / 40  ›  »   Lignes 1–25 sur 1 000
```

```js
const grid = new NexaGrid("#myGrid", {
  paginationPosition: "bottom", // 'top' | 'bottom' | 'both' | false
  pageSize: 25, // valeur initiale du sélecteur
  data: mesLignes,
});
```

**Sélecteur de taille de page** : 10 / 25 / 50 / 100 / 250 / 500 / Tout  
Quand la taille change, `onPageSizeChanged(pageSize, grid)` est déclenché.

**Navigation par API :**

```js
grid._goPage(0); // première page
grid._goPage(grid._totalPages() - 1); // dernière page
grid._goPage(4); // page 5 (index 0-based)
grid._totalPages(); // nombre total de pages
```

---

## Infinite scroll

En mode infinite scroll, la barre affiche la progression au lieu des boutons nav.

```js
const grid = new NexaGrid("#myGrid", {
  paginationPosition: "bottom",
  totalCount: 1000, // total côté serveur
  data: premieres50Lignes, // chargement initial

  onLoadMore: (info, grid) => {
    // Déclenché quand l'utilisateur atteint le bas des données chargées
    // info.loadedCount → lignes actuellement dans la grille
    // info.totalCount  → total serveur
    // info.page        → numéro de page approximatif

    grid.setLoadMoreMessage("⏳ Chargement de la page suivante…");

    fetch(`/api/data?offset=${info.loadedCount}&limit=50`)
      .then((r) => r.json())
      .then((newRows) => {
        // appendData() ajoute les lignes ET déverrouille le scroll
        grid.appendData(newRows);

        const loaded = info.loadedCount + newRows.length;
        if (loaded >= info.totalCount) {
          grid.setLoadMoreMessage(
            `✓ Toutes les ${info.totalCount} lignes chargées`,
          );
        } else {
          grid.setLoadMoreMessage(
            `${loaded.toLocaleString("fr-FR")} / ${info.totalCount.toLocaleString("fr-FR")} lignes`,
          );
        }
      })
      .catch(() => {
        grid.setLoadMoreMessage("❌ Erreur de chargement");
        grid.unlockLoadMore(); // permettre une nouvelle tentative
      });
  },
});

// API liée
grid.setTotalCount(1000);
grid.setLoadMoreMessage("…");
grid.unlockLoadMore();
grid.appendData(nouvelleLignes); // ajoute + déverrouille
```

---

## Graphiques ApexCharts

NexaGrid utilise **ApexCharts** (injecté automatiquement). Les graphiques s'ouvrent sur les lignes sélectionnées.

### Bouton 📊 Graphes dans la toolbar

Cliquer **📊 Graphes** ouvre une modal de configuration avec :

- **Axe X** — radio parmi les colonnes `text` / `badge` / `date`
- **Axe Y** — cases à cocher parmi les colonnes numériques (**nombre illimité de séries**)
- **Type de graphique** — Bar / Ligne / Aire / Donut / Pie

```js
// Ouvrir avec config prédéfinie
grid._chartConfig = {
  xField: "entity", // champ en abscisse
  yFields: ["debit", "credit", "solde"], // champs en ordonnée (illimité)
  chartType: "bar", // 'bar'|'line'|'area'|'donut'|'pie'
};
grid.openChart();
```

### Configuration des KPIs

```js
graph: {
  kpis: [
    { label:'Total Débit',   field:'debit',  fn:'sum' },
    { label:'Total Crédit',  field:'credit', fn:'sum' },
    { label:'Solde Net',     field:'solde',  fn:'sum' },
    { label:'Couverture',    field:'couv',   fn:'avg', suffix:'%' },
    { label:'Nb opérations', field:'solde',  fn:'count' },
    { label:'Max débit',     field:'debit',  fn:'max' },
  ],
  // fn: 'sum' | 'avg' | 'min' | 'max' | 'count'
}
```

### Sections auto-générées avec configurateur d'axes

Sans `sections:`, NexaGrid génère automatiquement :

- **Vue d'ensemble** — toutes les colonnes Y sélectionnées en séries
- **Par catégorie** — donut + bar par chaque colonne badge/text
- **Tableau** — données brutes des lignes sélectionnées

Chaque section auto comporte un **cadre ⚙ Configurer les axes** collapsible en bas :

```
┌─────────────────────────────────────────────────────┐
│ ⚙ Configurer les axes                            ▾  │
├──────────────────────┬──────────────────────────────┤
│ 📐 Axe X             │ 📈 Axe Y                     │
│ ○ Référence          │ ☑ Débit                      │
│ ● Entité             │ ☑ Crédit                     │
│ ○ Banque             │ ☑ Solde EUR                  │
│                      │ ☐ Taux FX                    │
└──────────────────────┴──────────────────────────────┘
```

Le graphique se met à jour **instantanément** à chaque changement.  
Le graphique est toujours positionné **au-dessus** du configurateur.

### Sections personnalisées

Les sections reçoivent `(panel, rows, helpers)` où `helpers` expose les utilitaires internes :

```js
graph: {
  kpis: [...],
  sections: [
    {
      title: 'Évolution',
      icon:  '📈',
      // panel   → div dans lequel injecter le contenu
      // rows    → lignes SÉLECTIONNÉES dans la grille
      // helpers → { mkApex, mkCard, mkFieldSelector, PAL, self }
      build: (panel, rows, { mkApex, mkCard }) => {
        const labels = rows.map(r => r.date || r.ref);
        const data   = rows.map(r => parseFloat(r.solde) || 0);

        // mkCard(id, titre, types[], buildFn, colonnesTable?, lignesTable?)
        const card = mkCard(
          'chart_evolution',          // id unique du div ApexCharts
          'Évolution du solde',       // titre de la card
          ['line', 'area', 'bar'],    // types disponibles (switcher)
          (id, type) => {             // appelé à chaque changement de type
            mkApex(id, type, [{ name:'Solde', data }], labels);
          },
          ['Date / Ref', 'Solde'],    // en-têtes du tableau de données
          rows.map(r => [r.date || r.ref, r.solde])
        );
        panel.appendChild(card);

        // Rendu initial du graphique
        setTimeout(() => mkApex('chart_evolution', 'line', [{ name:'Solde', data }], labels), 30);
      }
    },

    // ── Section avec deux graphiques côte à côte
    {
      title: 'Répartition',
      icon:  '🥧',
      build: (panel, rows, { mkApex, mkCard }) => {
        const grid2 = document.createElement('div');
        grid2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

        // Donut par statut
        const statuts = {};
        rows.forEach(r => { statuts[r.statut] = (statuts[r.statut] || 0) + 1; });
        const card1 = mkCard('ch_statut', 'Par statut', ['donut','pie','bar'],
          (id, tp) => {
            if (tp === 'bar') mkApex(id, 'bar', [{ name:'Nb', data:Object.values(statuts) }], Object.keys(statuts));
            else              mkApex(id, tp, [{ data:Object.values(statuts) }], Object.keys(statuts));
          }
        );

        // Bar par entité
        const parEntite = {};
        rows.forEach(r => { parEntite[r.entity] = (parEntite[r.entity] || 0) + (parseFloat(r.solde)||0); });
        const card2 = mkCard('ch_entite', 'Solde par entité', ['bar','line'],
          (id, tp) => mkApex(id, tp, [{ name:'Solde', data:Object.values(parEntite) }], Object.keys(parEntite))
        );

        grid2.appendChild(card1); grid2.appendChild(card2);
        panel.appendChild(grid2);
        setTimeout(() => {
          mkApex('ch_statut', 'donut', [{ data:Object.values(statuts) }], Object.keys(statuts));
          mkApex('ch_entite', 'bar', [{ name:'Solde', data:Object.values(parEntite) }], Object.keys(parEntite));
        }, 30);
      }
    },

    // ── Section HTML libre (pas de graphique)
    {
      title: 'Résumé',
      icon:  '📋',
      build: (panel, rows) => {
        const totalDebit  = rows.reduce((s,r) => s + (parseFloat(r.debit)  || 0), 0);
        const totalCredit = rows.reduce((s,r) => s + (parseFloat(r.credit) || 0), 0);
        const fmt = n => n.toLocaleString('fr-FR', { minimumFractionDigits:2 }) + ' €';

        panel.innerHTML = `
          <div style="padding:20px;font-size:13px;">
            <h6 style="margin-bottom:12px;">${rows.length} lignes sélectionnées</h6>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="background:#1c2e4a;color:#e8edf5;">
                <th style="padding:8px 12px;text-align:left;">Indicateur</th>
                <th style="padding:8px 12px;text-align:right;">Valeur</th>
              </tr>
              <tr>
                <td style="padding:7px 12px;border-bottom:1px solid #eee;">Total Débit</td>
                <td style="text-align:right;color:#c0392b;font-family:monospace;">${fmt(totalDebit)}</td>
              </tr>
              <tr>
                <td style="padding:7px 12px;border-bottom:1px solid #eee;">Total Crédit</td>
                <td style="text-align:right;color:#1a6e3d;font-family:monospace;">${fmt(totalCredit)}</td>
              </tr>
              <tr style="font-weight:700;background:#f0f4fa;">
                <td style="padding:7px 12px;">Solde Net</td>
                <td style="text-align:right;font-family:monospace;
                    color:${totalCredit-totalDebit>=0?'#1a6e3d':'#c0392b'}">
                  ${fmt(totalCredit - totalDebit)}
                </td>
              </tr>
            </table>
          </div>`;
      }
    },
  ]
}
```

---

## Édition inline + validation

Double-clic sur une cellule éditable → un **overlay se positionne exactement sur la cellule**.

**Règles intégrées :**

- Valeur vide ou identique à l'actuelle → **rien ne se passe**, pas de sauvegarde
- Type `num` + valeur non numérique → **message d'erreur rouge sous la cellule**
- Type `date` + format invalide → **message d'erreur rouge**
- La cellule ne se ferme pas tant que la valeur est invalide

**Validation personnalisée :**

```js
{
  field:    'taux',
  type:     'num',
  validate: (value) => {
    const n = parseFloat(value);
    if (n <= 0)   return 'Le taux doit être supérieur à 0';
    if (n > 100)  return 'Le taux ne peut dépasser 100';
    return true;  // true = valide, on enregistre
  }
}
```

**Raccourcis :**

- `Entrée` → valider et enregistrer
- `Échap` → annuler sans enregistrer
- Clic hors de la cellule → valider

---

## Fonctionnalités utilisateur

### Copier-coller depuis Excel

Automatique. Aucune configuration nécessaire.

1. Sélectionnez et copiez dans Excel / Google Sheets / LibreOffice (`Ctrl+C`)
2. Cliquez la **cellule cible** dans NexaGrid
3. `Ctrl+V` — les données se collent en remplissant les cellules éditables à partir de la cellule cliquée

Le format TSV (tab-separated) est reconnu automatiquement.  
Les cellules modifiées **flashent en bleu** pendant 650ms.

### Édition en masse (bulk edit)

Sélectionnez des lignes → **clic droit → Édition en masse** → choisissez le champ et la valeur → Appliquer.

La modal s'adapte automatiquement au type du champ (`number` pour `num`, `date` picker pour `date`, texte sinon).

```js
grid.bulkEdit("statut", "Validé"); // sur les lignes sélectionnées
grid.bulkEdit("statut", "Archivé", false); // sur toutes les lignes
```

### Drag & drop des colonnes

Glissez un en-tête de colonne non-gelée pour le repositionner.  
Une indication `⠿` apparaît à gauche du label au survol.  
Les colonnes gelées ne peuvent pas être déplacées par drag.

### Comparaison de lignes

Sélectionnez 2 à 6 lignes → **clic droit → Comparer les lignes**.  
Les valeurs différentes sont surlignées en jaune.  
Checkbox "Seulement les différences" pour ne voir que les champs qui divergent.

```js
grid.compareRows(); // ouvre la modal sur les lignes sélectionnées
```

### Épinglage de lignes

Cliquez 📌 sur une ligne pour l'épingler en haut du tableau.  
Elle reste visible même lors du filtrage ou du tri.

### Menu contextuel (clic droit)

Disponible sur toutes les lignes (voir §Désactiver des éléments UI pour masquer des items) :

**Ligne** · Fixer/Libérer · Voir le détail · Éditer la cellule  
**Sélection** · Édition en masse · Comparer · Graphiques · Copier · Sélectionner tout  
**Colonne** · Trier croissant · Trier décroissant · Fixer la colonne · Masquer  
**Danger** · Supprimer la ligne

### Redimensionnement des colonnes

Glissez le bord droit d'un en-tête de colonne pour la redimensionner librement.

### Tri

- **Clic** sur un en-tête : tri croissant / décroissant
- **Shift+clic** : ajouter au tri multi-colonnes (numéro de priorité affiché sur l'icône)

### Formatage conditionnel

Activez via le bouton **★ Format** dans la toolbar ou l'API :

```js
grid.toggleCF();

// Colonnes participantes : { cf: true }
// Vert    si valeur > 100 000
// Orange  si valeur entre 0 et 100 000
// Rouge   si valeur < 0
```

---

## Désactiver des éléments UI

### Boutons de la toolbar

```js
new NexaGrid("#myGrid", {
  toolbarHidden: ["group", "cf", "json", "reset"],
});
```

| Valeur      | Élément masqué               |
| ----------- | ---------------------------- |
| `'filters'` | Bouton ⚡ Filtres            |
| `'group'`   | Bouton ⊞ Grouper             |
| `'cf'`      | Bouton ★ Format conditionnel |
| `'columns'` | Bouton ▤ Colonnes            |
| `'views'`   | Bouton ◈ Vues                |
| `'chart'`   | Bouton 📊 Graphes            |
| `'csv'`     | Bouton ⬇ CSV                 |
| `'json'`    | Bouton ⬇ JSON                |
| `'search'`  | Champ 🔍 Recherche           |
| `'reset'`   | Bouton ↺ Réinit.             |

### Items du menu contextuel (clic droit)

```js
new NexaGrid("#myGrid", {
  contextMenuHidden: ["deleteRow", "compare", "bulkEdit", "freezeCol"],
});
```

| Valeur        | Élément masqué           |
| ------------- | ------------------------ |
| `'pin'`       | Fixer / Libérer la ligne |
| `'detail'`    | Voir le détail           |
| `'edit'`      | Éditer la cellule        |
| `'bulkEdit'`  | Édition en masse         |
| `'compare'`   | Comparer les lignes      |
| `'chart'`     | Graphiques               |
| `'copy'`      | Copier                   |
| `'selectAll'` | Sélectionner tout        |
| `'sortAsc'`   | Trier croissant          |
| `'sortDesc'`  | Trier décroissant        |
| `'freezeCol'` | Fixer la colonne         |
| `'hideCol'`   | Masquer la colonne       |
| `'deleteRow'` | Supprimer la ligne       |

Quand tous les items d'un groupe sont masqués, le label et le séparateur du groupe disparaissent automatiquement.

---

## Sélection en plage

La sélection en plage fonctionne entre lignes **distantes**, entre pages différentes, même après scroll.

| Geste                | Résultat                                                           |
| -------------------- | ------------------------------------------------------------------ |
| **Clic**             | Sélectionne uniquement cette ligne — devient la **nouvelle ancre** |
| **Ctrl+clic**        | Sélection en plage de l'ancre jusqu'à cette ligne                  |
| **Shift+clic**       | Idem — sélection en plage de l'ancre jusqu'à cette ligne           |
| **Checkbox**         | Sélection/désélection individuelle (sans modifier l'ancre)         |
| **Checkbox en-tête** | Sélectionner / désélectionner toutes les lignes visibles           |

**Exemple :**

```
1. Clic sur ligne 1   → ancre = ligne 1, sélection = {1}
2. Ctrl+clic ligne 5  → sélection = {1, 2, 3, 4, 5}
3. Ctrl+clic ligne 10 → sélection = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
4. Clic sur ligne 3   → reset, ancre = ligne 3, sélection = {3}
5. Ctrl+clic ligne 8  → sélection = {3, 4, 5, 6, 7, 8}
```

---

## Vues

Une vue est un snapshot de l'état complet : filtres, tris, colonnes visibles/largeurs, groupement, formatage conditionnel.

```js
grid.saveView("Ma vue Q4");
grid.loadView("Ma vue Q4");
const noms = grid.getViews(); // ['Ma vue Q4', 'Validés', 'H1 2024']
grid.openViewsModal(); // bouton ◈ Vues

// Créer des vues programmatiquement dans onReady
onReady: (grid) => {
  grid.setSort("solde", "desc");
  grid._cfEnabled = true;
  grid.saveView("📉 Solde décroissant + CF");

  grid.clearSort();
  grid._cfEnabled = false;
  grid.setFilter("statut", "Validé", { type: "select", value: "Validé" });
  grid.saveView("✅ Validés uniquement");

  grid.clearFilters();
  grid.setFilter("echeance", null, {
    type: "dateRange",
    from: "2024-01-01",
    to: "2024-06-30",
  });
  grid.saveView("📅 Échéances H1 2024");

  grid.clearAll(); // repartir d'un état propre
};
```

**Ce que mémorise une vue :**

- Filtres actifs (type, valeur, opérateur)
- Tris (champ, direction, priorité)
- Groupement (activé, champ)
- Formatage conditionnel (activé/désactivé)
- État de chaque colonne (visible, largeur, gelée)

---

## API publique complète

### Données

```js
grid.setData(data)                            // remplacer toutes les données (supporte le tree)
grid.appendData(data)                         // ajouter à la fin (infinite scroll)
const row = grid.addRow(data, index?)         // insérer une ligne
grid.deleteRow(ngId)                          // par ID interne
grid.deleteRow([ngId1, ngId2])               // par tableau d'IDs
grid.deleteRow(row => row.montant < 0)       // par prédicat
grid.deleteSelectedRows()
grid.updateRow(ngId, { statut: 'Validé' })
grid.updateRow(row => row.ref === 'X', data)
grid.getAllData()                              // toutes les lignes (nettoyées)
grid.getData()                                // alias getAllData()
grid.getFilteredData()                        // après filtres + tris actifs
grid.getSelectedRows()
grid.getDirtyRows()                           // lignes modifiées (+ _dirtyFields)
grid.getTotalCount()                          // serverTotal || rows.length
grid.getCellValue(rowId, 'champ')
grid.setCellValue(rowId, 'champ', valeur)
grid.clearDirty()
```

### Sélection

```js
grid.selectAll();
grid.deselectAll();
grid.selectRow(ngId);
grid.deselectRow(ngId);
grid.getSelectedRows();
```

### Filtres

```js
grid.setFilter("champ", valeur);
grid.setFilter("solde", null, { type: "num", op: "<", value: -10000 });
grid.setFilter("ech", null, {
  type: "dateRange",
  from: "2024-01-01",
  to: "2024-06-30",
});
grid.clearFilters();
grid.getFilters(); // → { solde: { type, op, value }, ... }
```

### Tri

```js
grid.setSort("champ", "asc"); // tri simple
grid.addSort("champ", "desc"); // ajouter au multi-tri
grid.clearSort();
grid.getSort(); // → [{ field:'solde', dir:'desc' }]
```

### Colonnes

```js
grid.showColumn("champ");
grid.hideColumn("champ");
grid.setColumnWidth("champ", 150);
grid.setColumnPinned("champ", "left"); // geler à gauche
grid.setColumnPinned("champ", false); // dégeler
grid.getColumnDefs();
grid.setColumns(nouvellesDefs);
grid.toggleColPanel();
```

### Groupement

```js
grid.setGroupBy("ccy");
grid.clearGroupBy();
grid.toggleGrouping();
```

### Statistiques

```js
grid.getTotals(); // { solde: { sum, avg, min, max, count }, ... }
grid.getTotals(["debit", "credit"]); // champs spécifiques
grid.getTotal("solde"); // somme directement
```

### Export

```js
grid.exportCSV(); // toutes les lignes filtrées
grid.exportCSV("mon-fichier"); // nom personnalisé
grid.exportCSV(null, true); // sélection seulement
grid.exportJSON();
grid.exportJSON("mon-fichier");
grid.copySelected(); // TSV dans le presse-papier
```

### Vues

```js
grid.saveView("Nom");
grid.loadView("Nom");
grid.getViews();
grid.openViewsModal();
```

### Édition en masse & comparaison

```js
grid.bulkEdit("statut", "Validé"); // lignes sélectionnées
grid.bulkEdit("statut", "Archivé", false); // toutes les lignes
grid.compareRows(); // nécessite 2+ lignes sélectionnées
```

### Graphiques

```js
grid.openChart();
grid.closeChart();

// Avec config prédéfinie
grid._chartConfig = {
  xField: "entity",
  yFields: ["debit", "credit"],
  chartType: "bar",
};
grid.openChart();
```

### Layout, thème, loader

```js
grid.setLayout("fitDataFill");
grid.setLayout("fitColumns");
grid.setLayout("fitData");
grid.setLayout("fitDataStretch");
grid.setTheme("dark");
grid.setTheme("compact");
grid.setTheme("spreadsheet");
grid.showLoader("Connexion API…");
grid.hideLoader();
```

### Pagination

```js
grid.setTotalCount(1000);
grid.setLoadMoreMessage("500 / 1000 lignes chargées");
grid.unlockLoadMore();
```

### Divers

```js
grid.refresh(); // re-render complet
grid.clearAll(); // réinitialiser filtres, tris, sélections, pins, recherche
grid.destroy(); // détruire la grille et nettoyer le DOM
```

---

## Événements

```js
const grid = new NexaGrid("#myGrid", {
  onRowClick: ({ row, event }) => {
    console.log("Clic sur :", row.ref);
  },

  onRowDblClick: ({ row, event }) => {
    // Ouvre aussi automatiquement le panel de détail
  },

  onCellClick: ({ row, field, value, event }) => {
    console.log(`${field} = ${value}`);
  },

  onCellValueChanged: ({ row, field, oldValue, newValue }) => {
    // Déclenché après : édition inline, bulk edit, paste Excel, setCellValue
    fetch("/api/save", {
      method: "POST",
      body: JSON.stringify({ id: row.id, field, value: newValue }),
    });
  },

  onSelectionChanged: (selectedRows) => {
    console.log(selectedRows.length, "lignes sélectionnées");
  },

  onFilterChanged: (filters, grid) => {
    // filters = { champ: { type, value, ... }, ... }
    // grid    = instance NexaGrid (utile pour serverSideFilter)
    console.log(Object.keys(filters).length, "filtres actifs");
  },

  onSortChanged: (sorts) => {
    // sorts = [{ field:'solde', dir:'desc' }, { field:'date', dir:'asc' }]
  },

  onRowMoved: ({ row, fromIndex, toIndex }) => {
    console.log(`Ligne ${row.ref} : ${fromIndex} → ${toIndex}`);
  },

  onRowPinned: ({ row, pinned }) => {
    console.log(`Ligne ${row.ref} ${pinned ? "épinglée" : "libérée"}`);
  },

  onDataLoaded: (rows) => {
    console.log(rows.length, "lignes chargées");
  },

  onLoadMore: (info, grid) => {
    // info.loadedCount, info.totalCount, info.page
  },

  onPageSizeChanged: (pageSize, grid) => {
    // Sauvegarder la préférence utilisateur
    localStorage.setItem("gridPageSize", pageSize);
  },

  onReady: (grid) => {
    console.log("NexaGrid prêt");
  },
});
```

---

## Thèmes

```js
grid.setTheme("dark"); // thème sombre
grid.setTheme("compact"); // lignes plus petites
grid.setTheme("spreadsheet"); // en-tête vert style Excel
```

Les thèmes modifient les variables CSS `--ng-*` sur le conteneur.

**Surcharger dans votre CSS :**

```css
#myGrid {
  --ng-accent: #e74c3c; /* couleur principale */
  --ng-header-bg: #2c3e50; /* fond des en-têtes */
  --ng-toolbar-bg: #2c3e50; /* fond de la toolbar */
  --ng-row-h: 30px; /* hauteur des lignes */
  --ng-header-h: 34px; /* hauteur des en-têtes */
}
```

### Variables disponibles

| Variable            | Défaut                     | Description                                      |
| ------------------- | -------------------------- | ------------------------------------------------ |
| `--ng-accent`       | `#1e6dc5`                  | Couleur principale (boutons, sélection, accents) |
| `--ng-header-bg`    | `#1c2e4a`                  | Fond en-tête groupes                             |
| `--ng-header-bg2`   | `#243a5e`                  | Fond en-tête colonnes                            |
| `--ng-header-text`  | `#e8edf5`                  | Texte des en-têtes                               |
| `--ng-toolbar-bg`   | `#2a3f5f`                  | Fond de la toolbar                               |
| `--ng-row-even`     | `#ffffff`                  | Fond lignes paires                               |
| `--ng-row-odd`      | `#f7f8fa`                  | Fond lignes impaires                             |
| `--ng-row-hover`    | `#deeaf7`                  | Fond ligne au survol                             |
| `--ng-row-selected` | `#ccdff5`                  | Fond ligne sélectionnée                          |
| `--ng-row-pinned`   | `#fffbee`                  | Fond ligne épinglée                              |
| `--ng-positive`     | `#1a6e3d`                  | Couleur valeurs positives                        |
| `--ng-negative`     | `#c0392b`                  | Couleur valeurs négatives                        |
| `--ng-warning`      | `#b35c00`                  | Couleur avertissements                           |
| `--ng-border`       | `#d0d5de`                  | Couleur bordures                                 |
| `--ng-font`         | `'Segoe UI','Calibri'`     | Police principale                                |
| `--ng-font-mono`    | `'Consolas','Courier New'` | Police monospace (nombres)                       |
| `--ng-row-h`        | `26px`                     | Hauteur des lignes                               |
| `--ng-header-h`     | `30px`                     | Hauteur des en-têtes                             |
| `--ng-filter-h`     | `32px`                     | Hauteur de la ligne filtres                      |

---

## Intégration dans un template

NexaGrid remplit son conteneur. C'est **votre CSS** qui contrôle la taille.

```html
<!-- Option 1 : hauteur fixe -->
<div id="myGrid" style="height: 500px; width: 100%"></div>

<!-- Option 2 : flex dans un layout (recommandé) -->
<div style="display:flex; flex-direction:column; height:100vh">
  <header style="height:52px">Barre de navigation</header>
  <main style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
    <div id="myGrid" style="flex:1; min-height:0"></div>
  </main>
</div>

<!-- Option 3 : forcer via les options -->
<div id="myGrid"></div>
<script>
  new NexaGrid('#myGrid', { height: '600px', columns:[...], data:[...] });
</script>
```

> `min-height: 0` est **essentiel** quand vous utilisez `flex: 1` pour éviter le débordement.

### Architecture dual-panel

NexaGrid utilise deux panneaux internes pour les colonnes gelées :

```
┌────────────────────────────────────────────────────────────────────┐
│ Toolbar                                                             │
├──────────────────────┬─────────────────────────────────────────────┤
│ PANNEAU GAUCHE       │ PANNEAU DROIT                                │
│ (colonnes frozen)    │ (colonnes normales)                          │
│                      │                                              │
│ scroll horizontal ✓  │ scroll horizontal ✓                          │
│ scroll vertical ✗    │ scroll vertical ✓                            │
│ (synced via JS)      │                                              │
│                      │                                              │
│ ←──scrollbar──→      │ ←────────scrollbar────────→                  │
├──────────────────────┴─────────────────────────────────────────────┤
│ Status bar                                                          │
├────────────────────────────────────────────────────────────────────┤
│ Pagination              [25▾]  « ‹  Page 1/40  › »   1–25/1 000   │
└────────────────────────────────────────────────────────────────────┘
```

- Le **panneau gauche** (colonnes `frozen:true`) a une scrollbar horizontale toujours visible de la même hauteur que le panneau droit — garantissant l'alignement des lignes.
- Le scroll vertical du panneau gauche est synchronisé **silencieusement** avec le panneau droit via JS (`scrollTop`).
- Le **panneau droit** gère son propre scroll horizontal + vertical indépendamment.

---

_NexaGrid v1.0 — MIT License_
