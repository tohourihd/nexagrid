# NexaGrid v2.2

Librairie JavaScript de tableau de données professionnel — inspirée de AG Grid et Tabulator.  
Zéro dépendance obligatoire · Bootstrap 5 injecté automatiquement · Chart.js optionnel.

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
11. [Pagination & Infinite scroll](#pagination--infinite-scroll)
12. [Vues](#vues)
13. [Graphiques](#graphiques)
14. [Fonctionnalités utilisateur](#fonctionnalités-utilisateur)
15. [API publique complète](#api-publique-complète)
16. [Événements](#événements)
17. [Thèmes](#thèmes)

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
<link rel="stylesheet" href="nexagrid.css">

<!-- 2. Chart.js (optionnel — pour les graphiques) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>

<!-- 3. NexaGrid JS -->
<script src="nexagrid.js"></script>
```

> Bootstrap 5 est **injecté automatiquement** par NexaGrid (CDN). Pas besoin de l'inclure manuellement.

---

## Instanciation

```html
<!-- La taille est contrôlée par VOS styles, pas par la librairie -->
<div id="myGrid" style="height: 500px"></div>
```

```js
// Style Tabulator
const grid = new NexaGrid('#myGrid', options);

// Style AG Grid
const grid = NexaGrid.createGrid(document.getElementById('myGrid'), options);
```

---

## Options complètes

```js
const grid = new NexaGrid('#myGrid', {

  // ── Général
  title:   'Mon tableau',   // titre affiché dans la toolbar
  height:  null,            // null = votre CSS contrôle la taille
                            // ou '500px' pour forcer une hauteur

  // ── Colonnes & données
  columns:       [],        // définitions de colonnes (voir §Colonnes)
  data:          null,      // tableau initial de données
  treeChildField:'children',// nom de la propriété enfants pour le tree

  // ── Fonctionnalités
  showFilters:  true,       // ligne de filtres visible au départ
  showToolbar:  true,       // barre d'outils
  showStatus:   true,       // barre de statut
  showAggRow:   true,       // ligne TOTAL en bas
  editable:     true,       // édition inline globale (double-clic)
  rowDrag:      true,       // poignée de réordonnancement
  rowPin:       true,       // épinglage de lignes
  multiSort:    true,       // tri multi-colonnes (Shift+clic)
  cfEnabled:    false,      // formatage conditionnel au départ

  // ── Groupement
  groupBy:      null,       // champ de groupement initial

  // ── Layout
  layout: 'fitDataFill',    // voir §Layout system

  // ── Pagination & Infinite scroll
  paginationPosition: 'bottom', // 'top' | 'bottom' | 'both' | false
  totalCount:   0,              // total côté serveur (0 = auto)
  onLoadMore:   null,           // callback infinite scroll

  // ── Loader de démarrage
  loader: {
    title:       'MON APP',
    subtitle:    'Chargement…',
    steps:       ['Connexion…', 'Données…', 'Prêt !'],
    duration:    2000,          // durée totale en ms
    accentColor: '#1e6dc5',
  },
  // Pour désactiver le loader : loader: false

  // ── Graphiques
  graph: {
    kpis:     [],     // KPIs affichés en haut des graphiques
    sections: [],     // sections personnalisées (voir §Graphiques)
  },

  // ── Événements (voir §Événements)
  onRowClick:         null,
  onRowDblClick:      null,
  onCellClick:        null,
  onCellValueChanged: null,
  onSelectionChanged: null,
  onFilterChanged:    null,
  onSortChanged:      null,
  onRowMoved:         null,
  onRowPinned:        null,
  onDataLoaded:       null,
  onReady:            null,
});
```

---

## Colonnes

```js
columns: [
  {
    // ── Identification
    field:       'solde',           // nom de la propriété dans vos données (obligatoire)
    id:          'solde',           // alias de field

    // ── Affichage
    headerName:  'Solde',           // texte de l'en-tête
    title:       'Solde',           // alias headerName
    group:       'Montants',        // groupe d'en-tête (2 niveaux)
    width:       120,               // largeur en px
    minWidth:    40,                // largeur minimale au redimensionnement

    // ── Type & format
    type:        'num',             // voir §Types de colonnes
    decimals:    2,                 // décimales pour type:'num'
    badgeColors: {                  // couleurs pour type:'badge'
      'Validé': 'green',
      'Rejeté': 'red',
    },

    // ── Comportement
    frozen:      false,             // colonne gelée à gauche
    pinned:      'left',            // alias frozen (style AG Grid)
    visible:     true,              // visible au départ
    hide:        false,             // alias !visible
    editable:    true,              // édition inline double-clic
    sortable:    true,              // tri au clic sur l'en-tête
    noSort:      false,             // alias !sortable

    // ── Filtre
    filter:      'num',             // voir §Filtres typés
    noFilter:    false,             // désactiver le filtre

    // ── Agrégation (ligne TOTAL)
    aggFunc:     'sum',             // 'sum' | 'avg' | 'min' | 'max' | 'count'
                                    // auto: 'sum' si type:'num'

    // ── Colonne calculée
    formula:     (row) => row.a * row.b,  // voir §Colonnes calculées

    // ── Formatteur personnalisé
    formatter:   ({ value, row, col }) => {
      // Retourne une string ou un HTMLElement
      return value > 0 ? `+${value}` : String(value);
    },

    // ── Tooltip
    tooltip:      true,             // tooltip au survol de la cellule
    tooltipField: 'note',           // utiliser un autre champ pour le tooltip

    // ── Formatage conditionnel
    cf:           true,             // participe au CF (vert/orange/rouge)
  }
]
```

---

## Types de colonnes

| `type`       | Rendu                          | Filtre auto   |
|--------------|-------------------------------|---------------|
| `text`       | Texte brut                    | Texte contient |
| `num`        | Nombre formaté, aligné droite, vert/rouge | Opérateur + number |
| `date`       | Date (dd/mm/yyyy ou iso)      | Sélecteur date |
| `badge`      | Badge coloré arrondi          | Select dropdown |
| `boolean`    | ✓ ou —                        | Select dropdown |
| `progress`   | Barre de progression + %      | Texte          |
| `spark`      | Mini-graphique sparkline      | *(désactivé)*  |

Aliases acceptés : `number`, `numeric`, `currency`, `float`, `int` → `num` · `datetime` → `date` · `bool` → `boolean` · `tag` → `badge` · `sparkline` → `spark`

---

## Filtres typés

Le widget de filtre s'adapte automatiquement au type de la colonne.  
Vous pouvez le forcer avec la propriété `filter:` :

```js
// Filtre texte (défaut pour type:'text')
{ field:'entity', filter:'text' }

// Filtre numérique : select opérateur (=, !=, >, >=, <, <=) + input number
// (pas de texte possible dans le champ)
{ field:'solde', type:'num' }          // auto
{ field:'solde', filter:'number' }     // explicite

// Filtre date : <input type="date"> natif
{ field:'date', type:'date' }          // auto
{ field:'date', filter:'date' }        // explicite

// Filtre plage de dates : deux inputs "du → au"
{ field:'echeance', filter:'dateRange' }

// Filtre select : dropdown des valeurs uniques
{ field:'statut', type:'badge' }       // auto
{ field:'ccy',    filter:'select' }    // forcer sur un type text

// Désactiver le filtre sur une colonne
{ field:'spark',  filter: false }
```

**Programmer un filtre depuis le code :**

```js
// Filtre texte
grid.setFilter('entity', 'CORP-FR');

// Filtre numérique avec opérateur
grid.setFilter('solde', null, { type:'num', op:'<', value:-10000 });

// Filtre date
grid.setFilter('date', null, { type:'date', value:'2024-03-15' });

// Filtre plage de dates
grid.setFilter('echeance', null, { type:'dateRange', from:'2024-01-01', to:'2024-06-30' });

// Filtre select
grid.setFilter('statut', 'Validé', { type:'select', value:'Validé' });

// Effacer un filtre
grid.clearFilters();

// Lire les filtres actifs
const filters = grid.getFilters();
// → { solde: { type:'num', op:'<', value:'-10000' }, ... }
```

---

## Colonnes calculées

Une colonne calculée reçoit `formula: (row) => valeur`. Elle est **recalculée à chaque rendu**, jamais stockée dans la donnée.

```js
columns: [
  { field:'debit',  type:'num', aggFunc:'sum' },
  { field:'credit', type:'num', aggFunc:'sum' },
  { field:'taux',   type:'num', decimals:4 },

  // Colonne calculée numérique
  {
    field:      'solde_eur',
    headerName: 'Solde EUR',
    type:       'num',
    decimals:   2,
    aggFunc:    'sum',        // les formules participent aux totaux
    editable:   false,
    formula:    (row) => {
      const solde = parseFloat(row.solde) || 0;
      const taux  = parseFloat(row.taux)  || 1;
      return row.ccy === 'EUR' ? solde : Math.round(solde / taux * 100) / 100;
    }
  },

  // Colonne calculée badge
  {
    field:      'risque',
    headerName: 'Risque',
    type:       'badge',
    editable:   false,
    formula:    (row) => {
      const couv = parseFloat(row.couv) || 0;
      if (couv > 70) return 'Faible';
      if (couv > 35) return 'Moyen';
      return 'Élevé';
    },
    badgeColors: { 'Faible':'green', 'Moyen':'orange', 'Élevé':'red' }
  },

  // Colonne calculée texte
  {
    field:      'label_complet',
    headerName: 'Label',
    type:       'text',
    formula:    (row) => `${row.ref} — ${row.entity} (${row.ccy})`
  },

  // Jours restants avant échéance
  {
    field:      'jours',
    headerName: 'J. restants',
    type:       'num',
    decimals:   0,
    formula:    (row) => {
      if (!row.echeance) return null;
      const [d, m, y] = String(row.echeance).split('/');
      return Math.round((new Date(`${y}-${m}-${d}`) - Date.now()) / 86400000);
    }
  },
]
```

---

## Tree / données arborescentes

Ajoutez une propriété `children` dans vos objets. NexaGrid détecte la hiérarchie automatiquement.

```js
const data = [
  {
    ref:    'GRP-EUR',
    entity: 'Zone EUR',
    solde:  750000,
    ccy:    'EUR',

    children: [
      {
        ref:    'CORP-FR',
        entity: 'CORP-FR',
        solde:  500000,

        children: [
          { ref:'TRF-0001', entity:'CORP-FR', debit:200000, solde:-200000, statut:'Validé' },
          { ref:'TRF-0002', entity:'CORP-FR', credit:300000, solde:300000, statut:'En cours' },
        ]
      },
      {
        ref:    'CORP-DE',
        entity: 'CORP-DE',
        solde:  250000,

        children: [
          { ref:'TRF-0003', entity:'CORP-DE', credit:250000, solde:250000, statut:'Validé' },
        ]
      }
    ]
  },
  {
    ref:    'GRP-USD',
    entity: 'Zone USD',
    solde:  -150000,
    ccy:    'USD',
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
                                // changez si votre propriété a un autre nom
});
```

**Comportement :**
- `▾` / `▸` — plier / déplier au clic
- Indentation automatique : 14 px par niveau de profondeur
- Nœuds feuilles (sans `children`) → indicateur `·`
- Tri et filtres s'appliquent sur les lignes visibles
- Profondeur illimitée

**État initial :**
```js
{ ref:'GRP-USD', _expanded: false, children:[...] }  // replié
{ ref:'GRP-EUR', _expanded: true,  children:[...] }  // déplié (défaut)
```

---

## Groupement

```js
// À l'instanciation
const grid = new NexaGrid('#myGrid', {
  groupBy: 'ccy',   // champ de groupement au démarrage
  columns: [
    // Les colonnes avec aggFunc affichent leurs sous-totaux dans le groupe
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

// Via le bouton toolbar "⊞ Grouper"
// → groupe automatiquement sur la première colonne text/badge visible
```

Chaque groupe affiche : **valeur du champ · nombre de lignes · sous-totaux** des colonnes `aggFunc:'sum'`.

---

## Layout system

Contrôle comment les colonnes remplissent la largeur disponible.

```js
const grid = new NexaGrid('#myGrid', {
  layout: 'fitDataFill',  // défaut
});

// Changer dynamiquement
grid.setLayout('fitColumns');
```

| Valeur | Comportement |
|--------|-------------|
| `fitDataFill` | Colonnes s'adaptent au contenu, le tableau remplit la largeur *(défaut)* |
| `fitData` | Colonnes s'adaptent au contenu, pas d'étirement |
| `fitColumns` | Toutes les colonnes se partagent proportionnellement la largeur disponible |
| `fitDataStretch` | Comme `fitDataFill` mais étire la dernière colonne libre |

---

## Pagination & Infinite scroll

### Pagination simple

```js
const grid = new NexaGrid('#myGrid', {
  paginationPosition: 'bottom',  // 'top' | 'bottom' | 'both' | false
  totalCount: 1000,              // total côté serveur
  data: premieres50Lignes,
});
```

La barre de pagination affiche `50 / 1 000 lignes` avec une barre de progression.

### Infinite scroll

```js
const grid = new NexaGrid('#myGrid', {
  paginationPosition: 'bottom',
  totalCount: 1000,
  data: premieres50Lignes,

  onLoadMore: (info, grid) => {
    // Déclenché quand l'utilisateur atteint le bas des données chargées
    // info.loadedCount → lignes actuellement dans la grille
    // info.totalCount  → total serveur
    // info.page        → numéro de page approximatif

    // 1. Afficher un message pendant le chargement
    grid.setLoadMoreMessage('⏳ Chargement…');

    // 2. Appel API
    fetch(`/api/data?offset=${info.loadedCount}&limit=50`)
      .then(r => r.json())
      .then(newRows => {
        // 3. Ajouter les lignes (déverrouille aussi le scroll)
        grid.appendData(newRows);

        // 4. Mettre à jour le message
        const total = info.loadedCount + newRows.length;
        if (total >= info.totalCount) {
          grid.setLoadMoreMessage('✓ Toutes les données sont chargées');
        } else {
          grid.setLoadMoreMessage(`${total} / ${info.totalCount} lignes`);
        }
      })
      .catch(() => {
        grid.setLoadMoreMessage('❌ Erreur de chargement');
        grid.unlockLoadMore();  // permettre une nouvelle tentative
      });
  },
});

// Méthodes liées
grid.setTotalCount(1000);         // mettre à jour le total serveur
grid.setLoadMoreMessage('…');     // message dans la barre de pagination
grid.unlockLoadMore();            // déverrouiller le scroll (si pas via appendData)
```

---

## Vues

Une vue est un snapshot de l'état complet : filtres, tris, colonnes visibles/largeurs, groupement, formatage conditionnel.

```js
// Sauvegarder la vue courante
grid.saveView('Ma vue Q4');

// Charger une vue
grid.loadView('Ma vue Q4');

// Lister les vues
const noms = grid.getViews();  // ['Ma vue Q4', 'Validés', ...]

// Ouvrir la modal de gestion des vues
grid.openViewsModal();  // (idem que le bouton ◈ Vues)

// Créer des vues programmatiquement dans onReady
onReady: (grid) => {
  // Configurer l'état...
  grid.setSort('solde', 'desc');
  grid._cfEnabled = true;
  // ...puis sauvegarder
  grid.saveView('Solde décroissant + CF');

  // Remettre à zéro
  grid.clearAll();

  // Pré-charger une vue au démarrage
  grid.loadView('Solde décroissant + CF');
}
```

**Ce que mémorise une vue :**
- Filtres actifs (type, valeur, opérateur)
- Tris (champ, direction, priorité)
- Groupement (activé, champ)
- Formatage conditionnel (activé/désactivé)
- État de chaque colonne (visible, largeur, gelée)

---

## Graphiques

Les graphiques s'ouvrent sur les **lignes sélectionnées**. Sélectionnez des lignes (Ctrl+clic) puis `grid.openChart()` ou clic droit → Graphiques.

### Configuration des KPIs

```js
graph: {
  kpis: [
    { label:'Total Débit',  field:'debit',  fn:'sum' },
    { label:'Total Crédit', field:'credit', fn:'sum' },
    { label:'Solde Net',    field:'solde',  fn:'sum' },
    { label:'Couv. Moy.',   field:'couv',   fn:'avg', suffix:'%' },
    { label:'Nb opérations', field:'solde', fn:'count' },
    { label:'Débit max',    field:'debit',  fn:'max' },
  ],
  // fn: 'sum' | 'avg' | 'min' | 'max' | 'count'
}
```

### Sections auto-générées

Sans `sections:`, NexaGrid génère automatiquement :
- **Vue d'ensemble** — bar chart des colonnes numériques + line chart
- **Par catégorie** — doughnut + bar par chaque colonne badge/text
- **Tableau** — tableau des lignes sélectionnées

### Sections personnalisées

```js
graph: {
  kpis: [...],

  sections: [
    // ─── Chaque section = un onglet dans la modal ─────────
    {
      title: 'Évolution',
      icon:  '📈',
      // build(panel, rows) :
      //   panel → div dans lequel vous injectez votre contenu
      //   rows  → lignes SÉLECTIONNÉES dans la grille
      build: (panel, rows) => {
        const labels = rows.map(r => r.date);
        const data   = rows.map(r => parseFloat(r.solde) || 0);

        const canvas = document.createElement('canvas');
        canvas.style.height = '250px';
        panel.appendChild(canvas);

        new Chart(canvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label:           'Solde',
              data,
              borderColor:     '#1e6dc5',
              backgroundColor: 'rgba(30,109,197,0.08)',
              tension:         0.3,
              fill:            true,
            }]
          },
          options: {
            responsive:          true,
            maintainAspectRatio: false,
          }
        });
      }
    },

    // ─── Section HTML libre ──────────────────────────────
    {
      title: 'Résumé',
      icon:  '📋',
      build: (panel, rows) => {
        const totalDebit  = rows.reduce((s,r) => s + (parseFloat(r.debit)  || 0), 0);
        const totalCredit = rows.reduce((s,r) => s + (parseFloat(r.credit) || 0), 0);
        const fmt = n => n.toLocaleString('fr-FR') + ' €';

        panel.innerHTML = `
          <div style="padding:16px">
            <p><strong>Lignes sélectionnées :</strong> ${rows.length}</p>
            <p><strong>Total débit :</strong> ${fmt(totalDebit)}</p>
            <p><strong>Total crédit :</strong> ${fmt(totalCredit)}</p>
            <p><strong>Solde net :</strong> ${fmt(totalCredit - totalDebit)}</p>
          </div>`;
      }
    },
  ]
}
```

---

## Fonctionnalités utilisateur

### Copier-coller depuis Excel

Automatique. Aucune configuration.

1. Copiez un tableau dans Excel / Google Sheets / LibreOffice (`Ctrl+C`)
2. Cliquez la cellule cible dans NexaGrid
3. `Ctrl+V` — les données se collent en remplissant les cellules éditables à partir de la cellule cliquée

Le format TSV (tab-separated) est reconnu automatiquement. Les cellules modifiées flashent en bleu.

### Édition en masse (bulk edit)

Sélectionnez des lignes (Ctrl+clic) → **clic droit → Édition en masse** → choisissez le champ et la valeur → Appliquer.

```js
// API programmatique
grid.bulkEdit('statut', 'Validé');           // sur les lignes sélectionnées
grid.bulkEdit('statut', 'Archivé', false);   // sur toutes les lignes
```

### Drag & drop des colonnes

Glissez un en-tête de colonne vers la gauche ou la droite pour le repositionner. Les colonnes gelées ne peuvent pas être déplacées. Une indication `⠿` apparaît au survol.

### Comparaison de lignes

Sélectionnez 2 à 6 lignes (Ctrl+clic) → **clic droit → Comparer**. Une modal affiche un tableau croisé avec les différences surlignées en jaune.

```js
// API
grid.compareRows();  // ouvre la modal sur les lignes sélectionnées
```

### Épinglage de lignes

Cliquez 📌 sur une ligne pour l'épingler en haut du tableau. Elle reste visible même en filtrant ou triant.

### Menu contextuel (clic droit)

Disponible sur toutes les lignes :
- Fixer / Libérer la ligne
- Voir le détail (expand panel)
- Éditer la cellule
- Édition en masse
- Comparer les lignes
- Afficher les graphiques
- Copier (Ctrl+C)
- Sélectionner tout
- Trier croissant / décroissant
- Fixer / Libérer la colonne
- Masquer la colonne
- Supprimer la ligne

### Redimensionnement des colonnes

Glissez le bord droit d'un en-tête de colonne pour la redimensionner.

### Tri

- **Clic** sur un en-tête : tri croissant / décroissant
- **Shift+clic** : ajouter au tri multi-colonnes (priorité numérotée)

### Sélection

- **Clic** : sélection simple
- **Ctrl+clic** : multi-sélection
- **Shift+clic** : sélection en plage
- **Checkbox** (colonne sel) : sélection individuelle
- **Checkbox en-tête** : sélectionner / désélectionner tout

### Édition inline

Double-clic sur une cellule éditable (`editable: true`) pour l'éditer.  
`Entrée` pour valider, `Échap` pour annuler.  
Les cellules modifiées affichent un point orange (marqueur dirty).

---

## API publique complète

### Données

```js
// Remplacer toutes les données (supporte le tree)
grid.setData(data)

// Ajouter des lignes à la fin (infinite scroll)
grid.appendData(data)

// Ajouter une ligne à une position optionnelle
const row = grid.addRow(data, index?)

// Supprimer des lignes
grid.deleteRow(ngId)               // par ID interne
grid.deleteRow([ngId1, ngId2])     // par tableau d'IDs
grid.deleteRow(row => row.montant < 0)  // par prédicat
grid.deleteSelectedRows()

// Mettre à jour une ligne
grid.updateRow(ngId, { statut: 'Validé' })
grid.updateRow(row => row.ref === 'TRF-001', { statut: 'Validé' })

// Récupérer les données
grid.getAllData()          // toutes les lignes (nettoyées)
grid.getData()             // alias getAllData()
grid.getFilteredData()     // après filtres + tris actifs
grid.getSelectedRows()     // lignes sélectionnées
grid.getDirtyRows()        // lignes modifiées (+ _dirtyFields)
grid.getTotalCount()       // total (serverTotal || rows.length)

// Valeur d'une cellule
grid.getCellValue(rowId, 'champ')
grid.setCellValue(rowId, 'champ', valeur)

// Nettoyer les marqueurs dirty
grid.clearDirty()
```

### Sélection

```js
grid.selectAll()
grid.deselectAll()
grid.selectRow(ngId)
grid.deselectRow(ngId)
grid.getSelectedRows()     // tableau des lignes sélectionnées
```

### Filtres

```js
grid.setFilter('champ', valeur)
grid.setFilter('solde', null, { type:'num', op:'<', value:-10000 })
grid.setFilter('ech',   null, { type:'dateRange', from:'2024-01-01', to:'2024-06-30' })
grid.clearFilters()
grid.getFilters()          // objet des filtres actifs
```

### Tri

```js
grid.setSort('champ', 'asc')      // tri simple (remplace les tris existants)
grid.addSort('champ', 'desc')     // ajouter au multi-tri
grid.clearSort()
grid.getSort()                    // [{ field, dir }]
```

### Colonnes

```js
grid.showColumn('champ')
grid.hideColumn('champ')
grid.setColumnWidth('champ', 150)
grid.setColumnPinned('champ', 'left')  // geler à gauche
grid.setColumnPinned('champ', false)   // dégeler
grid.getColumnDefs()                   // définitions actuelles
grid.setColumns(nouvellesDefs)         // remplacer toutes les colonnes
grid.toggleColPanel()                  // ouvrir/fermer le panneau colonnes
```

### Groupement

```js
grid.setGroupBy('ccy')
grid.clearGroupBy()
grid.toggleGrouping()      // (bouton toolbar)
```

### Statistiques

```js
// Totaux sur les colonnes aggFunc:'sum'
grid.getTotals()
// → { solde: { sum, avg, min, max, count }, debit: {...} }

// Sur des champs spécifiques
grid.getTotals(['debit', 'credit'])

// Somme d'un seul champ
grid.getTotal('solde')    // nombre
```

### Export

```js
grid.exportCSV()                     // toutes les lignes filtrées
grid.exportCSV('mon-fichier')        // nom de fichier personnalisé
grid.exportCSV(null, true)           // sélection seulement
grid.exportJSON()
grid.exportJSON('mon-fichier')
grid.copySelected()                  // copie TSV dans le presse-papier
```

### Vues

```js
grid.saveView('Nom de la vue')
grid.loadView('Nom de la vue')
grid.getViews()                      // ['Vue 1', 'Vue 2', ...]
grid.openViewsModal()                // ouvrir la modal
```

### Édition en masse

```js
grid.bulkEdit('statut', 'Validé')           // sur les lignes sélectionnées
grid.bulkEdit('statut', 'Archivé', false)   // sur toutes les lignes
```

### Comparaison

```js
grid.compareRows()    // ouvre la modal (nécessite 2+ lignes sélectionnées)
```

### Graphiques

```js
grid.openChart()      // ouvrir la modal graphiques
grid.closeChart()
```

### Layout

```js
grid.setLayout('fitDataFill')
grid.setLayout('fitColumns')
grid.setLayout('fitData')
grid.setLayout('fitDataStretch')
```

### Formatage conditionnel

```js
grid.toggleCF()       // activer/désactiver (bouton toolbar)
// Activé sur les colonnes avec cf: true
// Vert (#d4edda) si valeur > 100 000
// Orange (#fff3cd) si valeur entre 0 et 100 000
// Rouge (#fde8e7) si valeur < 0
```

### Thèmes

```js
grid.setTheme('dark')         // thème sombre
grid.setTheme('compact')      // lignes plus petites
grid.setTheme('spreadsheet')  // en-tête vert (style Excel)
// Revenir au défaut : recharger la page ou réinstancier
```

Les thèmes modifient les variables CSS `--ng-*` sur le conteneur.

### Loader (chargement données)

```js
grid.showLoader('Connexion API…')  // overlay de chargement
grid.hideLoader()
```

### Pagination

```js
grid.setTotalCount(1000)                           // total serveur
grid.setLoadMoreMessage('500 / 1000 chargées')     // message pagination
grid.unlockLoadMore()                              // débloquer le scroll
```

### Divers

```js
grid.refresh()     // re-render complet
grid.clearAll()    // réinitialiser filtres, tris, sélections, pins
grid.destroy()     // détruire la grille et nettoyer le DOM
```

---

## Événements

```js
const grid = new NexaGrid('#myGrid', {

  onRowClick: ({ row, event }) => {
    // Déclenché au clic sur une ligne
    console.log(row.ref);
  },

  onRowDblClick: ({ row, event }) => {
    // Déclenché au double-clic (ouvre aussi le panel de détail)
  },

  onCellClick: ({ row, field, value, event }) => {
    // Déclenché au clic sur une cellule
  },

  onCellValueChanged: ({ row, field, oldValue, newValue }) => {
    // Déclenché après chaque modification de cellule
    // (édition inline, bulk edit, paste depuis Excel, setCellValue)
    fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ id: row.id, field, value: newValue })
    });
  },

  onSelectionChanged: (selectedRows) => {
    // Déclenché à chaque changement de sélection
    console.log(selectedRows.length, 'lignes sélectionnées');
  },

  onFilterChanged: (filters) => {
    // Déclenché à chaque changement de filtre
    console.log(Object.keys(filters).length, 'filtres actifs');
  },

  onSortChanged: (sorts) => {
    // Déclenché à chaque changement de tri
    // sorts = [{ field:'solde', dir:'desc' }, ...]
  },

  onRowMoved: ({ row, fromIndex, toIndex }) => {
    // Déclenché après un drag & drop de ligne
  },

  onRowPinned: ({ row, pinned }) => {
    // Déclenché quand une ligne est épinglée/détachée
  },

  onDataLoaded: (rows) => {
    // Déclenché après chaque setData()
    console.log(rows.length, 'lignes chargées');
  },

  onLoadMore: (info, grid) => {
    // Déclenché quand le scroll atteint le bas (infinite scroll)
    // info.loadedCount, info.totalCount, info.page
  },

  onReady: (grid) => {
    // Déclenché une fois la grille initialisée et le loader terminé
    console.log('Grille prête');
  },
});
```

---

## Thèmes

NexaGrid utilise des variables CSS `--ng-*` pour les couleurs. Vous pouvez les surcharger dans votre propre CSS :

```css
/* Dans votre feuille de style */
#myGrid {
  --ng-accent:      #e74c3c;   /* couleur principale */
  --ng-header-bg:   #2c3e50;   /* fond des en-têtes */
  --ng-toolbar-bg:  #2c3e50;   /* fond de la toolbar */
  --ng-row-h:       30px;      /* hauteur des lignes */
  --ng-header-h:    34px;      /* hauteur des en-têtes */
}
```

### Variables disponibles

| Variable | Défaut | Description |
|----------|--------|-------------|
| `--ng-accent` | `#1e6dc5` | Couleur principale |
| `--ng-header-bg` | `#1c2e4a` | Fond en-tête groupe |
| `--ng-header-bg2` | `#243a5e` | Fond en-tête colonnes |
| `--ng-header-text` | `#e8edf5` | Texte en-tête |
| `--ng-toolbar-bg` | `#2a3f5f` | Fond toolbar |
| `--ng-row-even` | `#ffffff` | Fond lignes paires |
| `--ng-row-odd` | `#f7f8fa` | Fond lignes impaires |
| `--ng-row-hover` | `#deeaf7` | Fond ligne au survol |
| `--ng-row-selected` | `#ccdff5` | Fond ligne sélectionnée |
| `--ng-positive` | `#1a6e3d` | Couleur valeurs positives |
| `--ng-negative` | `#c0392b` | Couleur valeurs négatives |
| `--ng-font` | `'Segoe UI','Calibri'` | Police |
| `--ng-font-mono` | `'Consolas'` | Police monospace |
| `--ng-row-h` | `26px` | Hauteur des lignes |
| `--ng-header-h` | `30px` | Hauteur des en-têtes |
| `--ng-filter-h` | `32px` | Hauteur de la ligne filtres |

---

## Intégration dans un template

NexaGrid remplit son conteneur. C'est **votre CSS** qui contrôle la taille.

```html
<!-- Option 1 : hauteur fixe -->
<div id="myGrid" style="height: 500px; width: 100%"></div>

<!-- Option 2 : flex (recommandé dans un layout) -->
<div style="display:flex; flex-direction:column; height:100vh">
  <header style="height:52px">…</header>
  <div id="myGrid" style="flex:1; min-height:0"></div>
</div>

<!-- Option 3 : via les options -->
<div id="myGrid"></div>
<script>
  new NexaGrid('#myGrid', { height: '600px', ... });
</script>
```

> `min-height: 0` est essentiel quand vous utilisez `flex: 1` pour éviter le débordement.

---

*NexaGrid v2.2 — MIT License*