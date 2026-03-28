/*!
 * NexaGrid v1.0.0 — Professional Data Grid Library
 * Bootstrap views modal · typed filters · layout · tree · pagination · infinite scroll
 * License: MIT
 */
(function (global) {
  "use strict";

  class NexaGrid {
    // ────────────────────────────────────────────────────────
    //  CONSTRUCTOR
    // ────────────────────────────────────────────────────────
    constructor(selector, options = {}) {
      this._opts = Object.assign({}, NexaGrid.defaults, options);
      this._uid = "ng_" + Math.random().toString(36).substr(2, 9);

      // Data state
      this._rawRows = [];
      this._rows = [];
      this._filters = {};
      this._sorts = [];
      this._cols = [];
      this._views = {};

      // UI state
      this._cfEnabled = false;
      this._groupEnabled = false;
      this._groupByField = this._opts.groupBy || null;
      this._filtersVis = this._opts.showFilters !== false;
      this._layout = this._opts.layout || "fitDataFill";

      // Interaction state
      this._lastClickIdx = null;
      this._dragSrc = null;
      this._colDragSrc = null; // column drag & drop
      this._ctxRow = null;
      this._ctxCol = null;
      this._activeCharts = {};
      this._toastTimer = null;
      this._focusedCell = null; // {rowId, colId} for Excel paste target

      // Pagination / infinite scroll
      this._serverTotal = this._opts.totalCount || 0;
      this._loadMoreLocked = false;
      this._loadMoreMsg = "";

      // Mount
      this._el =
        typeof selector === "string"
          ? document.querySelector(selector)
          : selector;
      if (!this._el)
        throw new Error(`NexaGrid: element not found: ${selector}`);
      if (this._opts.height) this._el.style.height = this._opts.height;

      this._injectDeps(() => {
        this._normalizeColumns();
        this._buildDOM();
        if (this._opts.data) this.setData(this._opts.data);
        else this._render();
        if (this._opts.loader !== false) {
          this._runLoader(
            typeof this._opts.loader === "object" ? this._opts.loader : {},
            () => this._opts.onReady && this._opts.onReady(this),
          );
        } else {
          this._opts.onReady && this._opts.onReady(this);
        }
      });
    }

    static get defaults() {
      return {
        title: "NexaGrid",
        height: null,
        showFilters: true,
        showToolbar: true,
        showStatus: true,
        showAggRow: true,
        editable: true,
        rowDrag: true,
        rowPin: true,
        multiSort: true,
        cfEnabled: false,
        groupBy: null,
        layout: "fitDataFill",
        data: null,
        columns: [],
        loader: {},
        graph: {},
        views: [],
        treeChildField: "children",
        // Pagination
        paginationPosition: "bottom", // 'top' | 'bottom' | 'both' | false
        totalCount: 0, // total server-side records
        onLoadMore: null, // callback(info) when scroll bottom reached
      };
    }

    // ────────────────────────────────────────────────────────
    //  DEPENDENCY INJECTION
    // ────────────────────────────────────────────────────────
    _injectDeps(cb) {
      let pending = 0;
      const done = () => {
        if (--pending <= 0) cb();
      };

      // Chart.js
      if (typeof Chart === "undefined") {
        pending++;
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
        s.onload = done;
        s.onerror = done;
        document.head.appendChild(s);
      }

      // Bootstrap 5 CSS (inserted before other styles so NexaGrid CSS wins)
      if (!document.querySelector("#ng-bs-css")) {
        const link = document.createElement("link");
        link.id = "ng-bs-css";
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
        document.head.insertBefore(link, document.head.firstChild);
      }

      // Bootstrap 5 JS
      if (
        typeof bootstrap === "undefined" &&
        !document.querySelector("#ng-bs-js")
      ) {
        pending++;
        const s = document.createElement("script");
        s.id = "ng-bs-js";
        s.src =
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";
        s.onload = done;
        s.onerror = done;
        document.head.appendChild(s);
      }

      if (pending === 0) cb();
    }

    // ────────────────────────────────────────────────────────
    //  COLUMNS
    // ────────────────────────────────────────────────────────
    _normalizeColumns() {
      const user = this._opts.columns || [];
      this._cols = [];
      this._cols.push({
        _id: "sel",
        _label: "",
        _group: "",
        _width: 28,
        _type: "sel",
        _frozen: true,
        _visible: true,
        _noSort: true,
        _noFilter: true,
      });
      if (this._opts.rowDrag)
        this._cols.push({
          _id: "drag",
          _label: "",
          _group: "",
          _width: 24,
          _type: "drag",
          _frozen: true,
          _visible: true,
          _noSort: true,
          _noFilter: true,
        });
      if (this._opts.rowPin)
        this._cols.push({
          _id: "pin",
          _label: "",
          _group: "",
          _width: 24,
          _type: "pin",
          _frozen: true,
          _visible: true,
          _noSort: true,
          _noFilter: true,
        });
      user.forEach((c, i) => {
        const type = this._resolveType(c.type);
        this._cols.push({
          _id: c.field || c.id || `col_${i}`,
          _label: c.headerName || c.title || c.label || c.field || `Col ${i}`,
          _group: c.group || c.headerGroup || "",
          _width: c.width || 120,
          _minWidth: c.minWidth || 40,
          _type: type,
          _filterType: this._resolveFilterType(c, type),
          _frozen:
            c.pinned === "left" || c.pinned === true || c.frozen === true,
          _visible: c.visible !== false && c.hide !== true,
          _editable:
            c.editable !== undefined
              ? c.editable
              : this._opts.editable &&
                !["badge", "progress", "spark", "boolean"].includes(type),
          _noSort: c.sortable === false || c.noSort === true,
          _noFilter: c.filter === false || c.noFilter === true,
          _cf: c.cf || c.conditionalFormat || false,
          _tooltip: c.tooltip || false,
          _tooltipField: c.tooltipField || null,
          _aggFunc: c.aggFunc || (type === "num" ? "sum" : null),
          _formatter: c.formatter || c.valueFormatter || null,
          _formula: c.formula || null, // (row) => value
          _badgeColors: c.badgeColors || null,
          _decimals: c.decimals !== undefined ? c.decimals : 2,
          _raw: c,
        });
      });
    }

    _resolveType(t) {
      if (!t) return "text";
      const map = {
        number: "num",
        numeric: "num",
        currency: "num",
        float: "num",
        int: "num",
        integer: "num",
        date: "date",
        datetime: "date",
        boolean: "boolean",
        bool: "boolean",
        badge: "badge",
        tag: "badge",
        progress: "progress",
        spark: "spark",
        sparkline: "spark",
        text: "text",
        string: "text",
      };
      return map[String(t).toLowerCase()] || String(t).toLowerCase();
    }

    _resolveFilterType(c, type) {
      if (c.filter === "dateRange") return "dateRange";
      if (c.filter === "date") return "date";
      if (c.filter === "number") return "num";
      if (c.filter === "select") return "select";
      if (c.filter === false) return "none";
      if (type === "num") return "num";
      if (type === "date") return "date";
      if (type === "boolean" || type === "badge") return "select";
      return "text";
    }

    // ────────────────────────────────────────────────────────
    //  TREE DATA
    // ────────────────────────────────────────────────────────
    _flattenTree(rows, depth = 0, parentId = null) {
      const result = [];
      const cf = this._opts.treeChildField || "children";
      rows.forEach((raw) => {
        // Assign a STABLE _ngId directly on the raw object so every
        // re-flatten call reuses the same id instead of generating a new one.
        if (!raw._ngId) raw._ngId = this._newId();

        const row = this._prepareRow(raw, depth, parentId);

        // Restore mutable UI states from the previous flat list so that
        // selections, pins and dirty flags survive a re-flatten.
        const prev =
          this._rows && this._rows.find((r) => r._ngId === raw._ngId);
        if (prev) {
          row._pinned = prev._pinned;
          row._selected = prev._selected;
          row._detailOpen = prev._detailOpen;
          if (prev._dirty) row._dirty = prev._dirty;
        }

        const children = raw[cf];
        row._hasChildren = !!(children && children.length);
        row._rawChildren = children || [];
        result.push(row);

        if (row._hasChildren && row._expanded !== false)
          result.push(...this._flattenTree(children, depth + 1, raw._ngId));
      });
      return result;
    }

    _toggleTree(row) {
      const newState = !row._expanded;
      // Write the new expanded state BACK onto the raw row so the next
      // _flattenTree call reads the correct value instead of defaulting to true.
      this._patchRawExpanded(row._ngId, newState, this._rawRows);
      this._rows = this._flattenTree(this._rawRows);
      this._renderBody();
    }

    // Walk the raw tree recursively and set _expanded on the matching node.
    _patchRawExpanded(ngId, expanded, rows) {
      const cf = this._opts.treeChildField || "children";
      for (const raw of rows) {
        if (raw._ngId === ngId) {
          raw._expanded = expanded;
          return true;
        }
        if (raw[cf] && this._patchRawExpanded(ngId, expanded, raw[cf]))
          return true;
      }
      return false;
    }

    _hasTreeData() {
      return this._rows.some((r) => r._hasChildren || r._depth > 0);
    }

    // ────────────────────────────────────────────────────────
    //  LAYOUT
    // ────────────────────────────────────────────────────────
    _applyLayout() {
      const tbl = this._tableEl,
        vcols = this._getVisibleCols(),
        layout = this._layout;
      if (layout === "fitColumns") {
        tbl.style.tableLayout = "fixed";
        tbl.style.width = "100%";
        tbl.style.minWidth = "";
        const avail = this._scrollEl.clientWidth || 800;
        const total = vcols.reduce((s, c) => s + c._width, 0),
          scale = avail / total;
        vcols.forEach((c) => {
          const w = Math.max(c._minWidth || 40, Math.round(c._width * scale));
          tbl.querySelectorAll(`[data-ng-col="${c._id}"]`).forEach((el) => {
            el.style.width = w + "px";
            el.style.maxWidth = w + "px";
          });
        });
      } else if (layout === "fitData") {
        tbl.style.tableLayout = "auto";
        tbl.style.width = "max-content";
        tbl.style.minWidth = "";
      } else if (layout === "fitDataStretch") {
        tbl.style.tableLayout = "fixed";
        tbl.style.width = "100%";
        tbl.style.minWidth = "100%";
        const avail = this._scrollEl.clientWidth || 800,
          total = vcols.reduce((s, c) => s + c._width, 0);
        if (avail > total) {
          const lf = [...vcols]
            .reverse()
            .find((c) => !c._frozen && !["sel", "drag", "pin"].includes(c._id));
          if (lf) {
            const w = lf._width + (avail - total);
            tbl.querySelectorAll(`[data-ng-col="${lf._id}"]`).forEach((el) => {
              el.style.width = w + "px";
              el.style.maxWidth = w + "px";
            });
          }
        }
      } else {
        // fitDataFill (default)
        tbl.style.tableLayout = "auto";
        tbl.style.width = "max-content";
        tbl.style.minWidth = "100%";
      }
    }

    // ────────────────────────────────────────────────────────
    //  DOM CONSTRUCTION
    // ────────────────────────────────────────────────────────
    _buildDOM() {
      this._el.innerHTML = "";
      this._el.classList.add("ng-container");

      // Pagination TOP
      if (
        this._opts.paginationPosition === "top" ||
        this._opts.paginationPosition === "both"
      ) {
        this._pagTopEl = this._buildPaginationBar("top");
        this._el.appendChild(this._pagTopEl);
      }

      // Toolbar
      if (this._opts.showToolbar !== false) {
        this._toolbarEl = this._buildToolbar();
        this._el.appendChild(this._toolbarEl);
      }

      // Wrapper + scroll + table
      this._wrapperEl = document.createElement("div");
      this._wrapperEl.className = "ng-wrapper";
      this._el.appendChild(this._wrapperEl);

      this._scrollEl = document.createElement("div");
      this._scrollEl.className = "ng-scroll";
      this._wrapperEl.appendChild(this._scrollEl);

      this._tableEl = document.createElement("table");
      this._tableEl.className = "ng-table";
      if (!this._filtersVis) this._tableEl.classList.add("ng-filters-hidden");
      this._scrollEl.appendChild(this._tableEl);

      this._theadEl = document.createElement("thead");
      this._theadEl.className = "ng-thead";
      this._tableEl.appendChild(this._theadEl);

      this._pinnedSection = document.createElement("tbody");
      this._pinnedSection.className = "ng-pinned-section ng-tbody";
      this._tableEl.appendChild(this._pinnedSection);

      this._tbodyEl = document.createElement("tbody");
      this._tbodyEl.className = "ng-tbody";
      this._tableEl.appendChild(this._tbodyEl);

      this._aggRowEl = document.createElement("tfoot");
      this._aggRowEl.className = "ng-agg-row";
      this._tableEl.appendChild(this._aggRowEl);

      // Infinite scroll sentinel (invisible div at bottom of scroll)
      this._sentinelEl = document.createElement("div");
      this._sentinelEl.className = "ng-scroll-sentinel";
      this._scrollEl.appendChild(this._sentinelEl);
      this._setupInfiniteScroll();

      // Loading overlay
      this._loadingEl = document.createElement("div");
      this._loadingEl.className = "ng-loading";
      this._loadingEl.innerHTML =
        '<div class="ng-spinner"></div><span>Chargement…</span>';
      this._wrapperEl.appendChild(this._loadingEl);

      // Col panel
      this._colPanelEl = this._buildColPanel();
      this._wrapperEl.appendChild(this._colPanelEl);

      // Status bar
      if (this._opts.showStatus !== false) {
        this._statusEl = this._buildStatus();
        this._el.appendChild(this._statusEl);
      }

      // Pagination BOTTOM
      if (
        !this._opts.paginationPosition ||
        this._opts.paginationPosition === "bottom" ||
        this._opts.paginationPosition === "both"
      ) {
        this._pagBotEl = this._buildPaginationBar("bottom");
        this._el.appendChild(this._pagBotEl);
      }

      // Document-level elements
      this._ctxMenuEl = this._buildCtxMenu();
      document.body.appendChild(this._ctxMenuEl);

      this._tooltipEl = document.createElement("div");
      this._tooltipEl.className = "ng-tooltip";
      document.body.appendChild(this._tooltipEl);

      this._toastEl = document.createElement("div");
      this._toastEl.className = "ng-toast";
      document.body.appendChild(this._toastEl);

      this._chartOverlay = this._buildChartModal();
      document.body.appendChild(this._chartOverlay);

      // Views dropdown panel (appended to body, positioned via JS)
      this._viewsPanelEl = this._buildViewsPanel();
      document.body.appendChild(this._viewsPanelEl);

      // Views Bootstrap modal (for creating a view)
      this._viewsBsModalEl = this._buildViewsBsModal();
      document.body.appendChild(this._viewsBsModalEl);

      // Splash loader
      this._splashEl = this._buildSplash();
      this._el.appendChild(this._splashEl);

      // Frozen shadow on scroll
      this._scrollEl.addEventListener("scroll", () => {
        const scrolled = this._scrollEl.scrollLeft > 0;
        this._tableEl
          .querySelectorAll(".ng-frozen-shadow")
          .forEach(
            (el) =>
              (el.style.boxShadow = scrolled
                ? "4px 0 6px -2px rgba(0,0,0,0.14)"
                : "none"),
          );
      });

      // Close menus on outside click
      document.addEventListener("click", (e) => {
        if (!this._ctxMenuEl.contains(e.target))
          this._ctxMenuEl.classList.remove("visible");
        if (
          !this._viewsPanelEl.contains(e.target) &&
          !e.target.closest(`[data-ng-btn="views"]`)
        )
          this._viewsPanelEl.classList.remove("open");
      });

      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "c") this.copySelected();
      });

      // ── Excel paste (Ctrl+V)
      this._el.addEventListener("paste", (e) => this._handlePaste(e));
      this._el.setAttribute("tabindex", "0"); // make container focusable

      // ── Bulk edit modal
      this._bulkModalEl = this._buildBulkModal();
      document.body.appendChild(this._bulkModalEl);

      // ── Compare rows modal
      this._compareModalEl = this._buildCompareModal();
      document.body.appendChild(this._compareModalEl);
    }

    // ────────────────────────────────────────────────────────
    //  INFINITE SCROLL
    // ────────────────────────────────────────────────────────
    _setupInfiniteScroll() {
      if (!this._opts.onLoadMore) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !this._loadMoreLocked) {
            this._triggerLoadMore();
          }
        },
        { root: this._scrollEl, threshold: 0.1 },
      );
      observer.observe(this._sentinelEl);
      this._sentinelObserver = observer;
    }

    _triggerLoadMore() {
      if (this._loadMoreLocked) return;
      if (this._serverTotal > 0 && this._rows.length >= this._serverTotal)
        return; // all loaded
      this._loadMoreLocked = true;
      const info = {
        loadedCount: this._rows.length,
        totalCount: this._serverTotal,
        page: Math.ceil(this._rows.length / (this._opts.paginationSize || 50)),
      };
      try {
        this._opts.onLoadMore(info, this);
      } catch (e) {
        console.error("NexaGrid onLoadMore error:", e);
        this._loadMoreLocked = false;
      }
    }

    /** Called by user in onLoadMore callback to signal completion */
    unlockLoadMore() {
      this._loadMoreLocked = false;
      return this;
    }

    // ────────────────────────────────────────────────────────
    //  PAGINATION BAR
    // ────────────────────────────────────────────────────────
    _buildPaginationBar(pos) {
      const bar = document.createElement("div");
      bar.className = `ng-pagination ng-pagination-${pos}`;
      bar.innerHTML = `
      <div class="ng-pag-left">
        <span class="ng-pag-count">0 / 0 lignes</span>
        <div class="ng-pag-bar"><div class="ng-pag-fill" style="width:0%"></div></div>
      </div>
      <div class="ng-pag-msg"></div>`;
      return bar;
    }

    _updatePagination() {
      const loaded = this._rows.length;
      const total = this._serverTotal || loaded;
      const pct =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
      const str =
        total > 0
          ? `<b>${loaded.toLocaleString("fr-FR")}</b> / <b>${total.toLocaleString("fr-FR")}</b> lignes`
          : `<b>${loaded.toLocaleString("fr-FR")}</b> lignes`;

      [this._pagTopEl, this._pagBotEl].forEach((el) => {
        if (!el) return;
        el.querySelector(".ng-pag-count").innerHTML = str;
        el.querySelector(".ng-pag-fill").style.width = pct + "%";
        el.querySelector(".ng-pag-msg").textContent = this._loadMoreMsg;
      });
    }

    /** Display a custom message in the pagination bar (e.g. from onLoadMore callback) */
    setLoadMoreMessage(msg) {
      this._loadMoreMsg = msg || "";
      this._updatePagination();
      return this;
    }

    // ────────────────────────────────────────────────────────
    //  TOOLBAR
    // ────────────────────────────────────────────────────────
    _buildToolbar() {
      const tb = document.createElement("div");
      tb.className = "ng-toolbar";
      const sep = () => {
        const s = document.createElement("div");
        s.className = "ng-toolbar-sep";
        return s;
      };
      const btn = (icon, label, onClick, key) => {
        const b = document.createElement("button");
        b.className = "ng-btn";
        b.innerHTML = `${icon} ${label}`;
        if (key) b.dataset.ngBtn = key;
        b.addEventListener("click", onClick);
        return b;
      };
      const title = document.createElement("span");
      title.className = "ng-toolbar-title";
      title.innerHTML = `<span class="ng-toolbar-diamond"></span>${this._opts.title}`;
      tb.appendChild(title);
      tb.appendChild(sep());
      const btnF = btn("⚡", "Filtres", () => this.toggleFilters(), "filters");
      if (this._filtersVis) btnF.classList.add("active");
      tb.appendChild(btnF);
      tb.appendChild(btn("⊞", "Grouper", () => this.toggleGrouping(), "group"));
      tb.appendChild(btn("★", "Format", () => this.toggleCF(), "cf"));
      tb.appendChild(sep());
      tb.appendChild(btn("▤", "Colonnes", () => this.toggleColPanel()));
      // Views button — opens the dropdown panel
      const btnViews = btn(
        "◈",
        "Vues",
        () => this._toggleViewsPanel(),
        "views",
      );
      tb.appendChild(btnViews);
      tb.appendChild(sep());
      tb.appendChild(btn("⬇", "CSV", () => this.exportCSV()));
      tb.appendChild(btn("⬇", "JSON", () => this.exportJSON()));
      const right = document.createElement("div");
      right.className = "ng-toolbar-right";
      this._searchEl = document.createElement("input");
      this._searchEl.className = "ng-search";
      this._searchEl.placeholder = "🔍  Recherche…";
      this._searchEl.addEventListener("input", () => this._renderBody());
      right.appendChild(this._searchEl);
      const r = document.createElement("button");
      r.className = "ng-btn";
      r.textContent = "↺ Réinit.";
      r.addEventListener("click", () => this.clearAll());
      right.appendChild(r);
      tb.appendChild(right);
      return tb;
    }

    // ────────────────────────────────────────────────────────
    //  VIEWS DROPDOWN PANEL
    //  Positioned fixed relative to the toolbar button
    // ────────────────────────────────────────────────────────
    _buildViewsPanel() {
      const panel = document.createElement("div");
      panel.className = "ng-views-panel";
      panel.innerHTML = `
      <div class="ng-views-panel-header">◈ Vues sauvegardées</div>
      <div class="ng-views-list"></div>
      <div class="ng-views-panel-footer">
        <button class="ng-btn-create-view">✚ Créer une vue</button>
      </div>`;
      // "Créer une vue" button opens Bootstrap modal
      panel
        .querySelector(".ng-btn-create-view")
        .addEventListener("click", () => {
          panel.classList.remove("open");
          this._openViewsBsModal();
        });
      return panel;
    }

    _toggleViewsPanel() {
      const panel = this._viewsPanelEl;
      if (panel.classList.contains("open")) {
        panel.classList.remove("open");
        return;
      }
      // Position the panel below the "Vues" button
      const btn = this._toolbarEl.querySelector('[data-ng-btn="views"]');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        panel.style.top = rect.bottom + 4 + "px";
        panel.style.left = rect.left + "px";
      }
      this._refreshViewsPanel();
      panel.classList.add("open");
    }

    _refreshViewsPanel() {
      const list = this._viewsPanelEl.querySelector(".ng-views-list");
      list.innerHTML = "";
      const keys = Object.keys(this._views);
      if (!keys.length) {
        list.innerHTML =
          '<div class="ng-views-empty">Aucune vue sauvegardée</div>';
        return;
      }
      keys.forEach((name) => {
        const item = document.createElement("div");
        item.className = "ng-view-item";
        const dot = document.createElement("span");
        dot.className = "ng-view-dot";
        const lbl = document.createElement("span");
        lbl.className = "ng-view-name";
        lbl.textContent = name;
        const btnLoad = document.createElement("button");
        btnLoad.className = "ng-view-btn-load";
        btnLoad.textContent = "Charger";
        btnLoad.addEventListener("click", () => {
          this.loadView(name);
          this._viewsPanelEl.classList.remove("open");
        });
        const btnDel = document.createElement("button");
        btnDel.className = "ng-view-btn-del";
        btnDel.textContent = "✕";
        btnDel.addEventListener("click", () => {
          delete this._views[name];
          this._refreshViewsPanel();
          this._toast(`Vue "${name}" supprimée`);
        });
        item.appendChild(dot);
        item.appendChild(lbl);
        item.appendChild(btnLoad);
        item.appendChild(btnDel);
        list.appendChild(item);
      });
    }

    // ────────────────────────────────────────────────────────
    //  VIEWS — BOOTSTRAP MODAL (create new view)
    // ────────────────────────────────────────────────────────
    _buildViewsBsModal() {
      const div = document.createElement("div");
      div.id = this._uid + "_bsModal";
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.setAttribute("aria-hidden", "true");
      div.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);">
          <div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;">
            <h5 class="modal-title" style="font-size:14px;font-weight:600;letter-spacing:0.3px;">◈ Créer une vue</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body" style="padding:20px 22px;">
            <div class="ng-bsm-section-title">Nom de la vue</div>
            <input type="text" class="ng-bsm-input" placeholder="Ex: Solde décroissant, Validés Q4…" maxlength="60">
            <div class="ng-bsm-summary"></div>
          </div>
          <div class="modal-footer" style="border-top:1px solid #dee2e6;padding:12px 18px;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annuler</button>
            <button type="button" class="btn btn-sm ng-bsm-save-btn" style="background:#1e6dc5;color:#fff;border:none;">Sauvegarder</button>
          </div>
        </div>
      </div>`;

      const saveBtn = div.querySelector(".ng-bsm-save-btn");
      const input = div.querySelector(".ng-bsm-input");

      saveBtn.addEventListener("click", () => {
        const name = input.value.trim();
        if (!name) {
          input.focus();
          input.style.borderColor = "#c0392b";
          return;
        }
        input.style.borderColor = "";
        this.saveView(name);
        // Log view details
        console.group(`✅ NexaGrid — Vue créée : "${name}"`);
        console.log(
          "Filtres actifs :",
          JSON.parse(JSON.stringify(this._filters)),
        );
        console.log(
          "Tri :",
          this._sorts.map((s) => ({ champ: s._col, direction: s._dir })),
        );
        console.log("Groupement :", {
          activé: this._groupEnabled,
          champ: this._groupByField,
        });
        console.log("Format conditionnel :", this._cfEnabled);
        console.log(
          "Colonnes :",
          this._cols
            .filter((c) => !["sel", "drag", "pin"].includes(c._id))
            .map((c) => ({
              id: c._id,
              visible: c._visible,
              largeur: c._width,
              figée: c._frozen,
            })),
        );
        console.log("Snapshot complet :", this._views[name]);
        console.groupEnd();
        this._toast(`Vue "${name}" sauvegardée`);
        this._refreshViewsPanel();
        input.value = "";
        // Hide BS modal
        const modal = bootstrap.Modal.getInstance(div);
        if (modal) modal.hide();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveBtn.click();
      });

      // Update summary when modal opens
      div.addEventListener("show.bs.modal", () => {
        input.value = "";
        input.style.borderColor = "";
        div.querySelector(".ng-bsm-summary").innerHTML =
          this._buildViewSummary();
      });

      return div;
    }

    _openViewsBsModal() {
      const el = this._viewsBsModalEl;
      const open = () => {
        const modal = bootstrap.Modal.getOrCreateInstance(el);
        modal.show();
      };
      if (typeof bootstrap !== "undefined") open();
      else {
        // BS might not be loaded yet — retry
        const t = setInterval(() => {
          if (typeof bootstrap !== "undefined") {
            clearInterval(t);
            open();
          }
        }, 80);
      }
    }

    _buildViewSummary() {
      const fKeys = Object.keys(this._filters);
      const parts = [];
      if (fKeys.length) {
        const fStr = fKeys
          .map((k) => {
            const f = this._filters[k],
              col = this._cols.find((c) => c._id === k);
            const lbl = col?._label || k;
            if (f.type === "dateRange")
              return `${lbl}: ${f.from || "?"} → ${f.to || "?"}`;
            if (f.type === "num") return `${lbl} ${f.op || "="} ${f.value}`;
            return `${lbl}: "${f.value}"`;
          })
          .join(", ");
        parts.push(`<span class="ng-bsm-tag">⚡ Filtres : ${fStr}</span>`);
      }
      if (this._sorts.length)
        parts.push(
          `<span class="ng-bsm-tag">↕ Tri : ${this._sorts.map((s) => s._col + " " + s._dir).join(", ")}</span>`,
        );
      if (this._groupEnabled && this._groupByField)
        parts.push(
          `<span class="ng-bsm-tag">⊞ Groupe : ${this._groupByField}</span>`,
        );
      if (this._cfEnabled)
        parts.push(`<span class="ng-bsm-tag">★ Format conditionnel</span>`);
      const hidden = this._cols.filter(
        (c) => !["sel", "drag", "pin"].includes(c._id) && !c._visible,
      );
      if (hidden.length)
        parts.push(
          `<span class="ng-bsm-tag">👁 ${hidden.length} colonne${hidden.length > 1 ? "s" : ""} masquée${hidden.length > 1 ? "s" : ""}</span>`,
        );
      return parts.length
        ? `<div class="ng-bsm-summary-title">Ce qui sera mémorisé</div><div class="ng-bsm-tags">${parts.join("")}</div>`
        : `<div class="ng-bsm-summary-empty">État actuel (aucun filtre ni tri actif)</div>`;
    }

    // ────────────────────────────────────────────────────────
    //  STATUS BAR
    // ────────────────────────────────────────────────────────
    _buildStatus() {
      const bar = document.createElement("div");
      bar.className = "ng-status";
      bar.innerHTML = `<span>Lignes : <b data-ng-st="rows">0</b></span><span class="ng-status-sep">|</span><span>Sél. : <b data-ng-st="sel">0</b></span><span class="ng-status-sep">|</span><span><b data-ng-st="sum">—</b></span><span class="ng-status-sep">|</span><span>Filtres : <b data-ng-st="filters">0</b></span><span class="ng-status-sep">|</span><span>Tri : <b data-ng-st="sort">—</b></span>`;
      return bar;
    }

    _buildCtxMenu() {
      const m = document.createElement("div");
      m.className = "ng-ctx-menu";
      m.innerHTML = `
      <div class="ng-ctx-label">Ligne</div>
      <div class="ng-ctx-item" data-ng-ctx="pin">📌 Fixer / Libérer</div>
      <div class="ng-ctx-item" data-ng-ctx="detail">🔍 Voir le détail</div>
      <div class="ng-ctx-item" data-ng-ctx="edit">✏️ Éditer la cellule</div>
      <div class="ng-ctx-sep"></div>
      <div class="ng-ctx-label">Sélection</div>
      <div class="ng-ctx-item" data-ng-ctx="bulkEdit">✏️ Édition en masse…</div>
      <div class="ng-ctx-item" data-ng-ctx="compare">⚖️ Comparer les lignes</div>
      <div class="ng-ctx-item" data-ng-ctx="chart">📊 Graphiques</div>
      <div class="ng-ctx-item" data-ng-ctx="copy">📋 Copier</div>
      <div class="ng-ctx-item" data-ng-ctx="selectAll">☑ Sélectionner tout</div>
      <div class="ng-ctx-sep"></div>
      <div class="ng-ctx-label">Colonne</div>
      <div class="ng-ctx-item" data-ng-ctx="sortAsc">↑ Trier croissant</div>
      <div class="ng-ctx-item" data-ng-ctx="sortDesc">↓ Trier décroissant</div>
      <div class="ng-ctx-item" data-ng-ctx="freezeCol">📌 Fixer la colonne</div>
      <div class="ng-ctx-item" data-ng-ctx="hideCol">👁 Masquer</div>
      <div class="ng-ctx-sep"></div>
      <div class="ng-ctx-item danger" data-ng-ctx="deleteRow">🗑 Supprimer la ligne</div>`;
      m.querySelectorAll("[data-ng-ctx]").forEach((item) =>
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          this._ctxAction(item.dataset.ngCtx);
        }),
      );
      return m;
    }

    _buildColPanel() {
      const p = document.createElement("div");
      p.className = "ng-col-panel";
      p.innerHTML = `<div class="ng-col-panel-header">Colonnes <span class="ng-col-panel-close">✕</span></div><div class="ng-col-panel-list"></div>`;
      p.querySelector(".ng-col-panel-close").addEventListener("click", () =>
        p.classList.remove("open"),
      );
      return p;
    }

    // ────────────────────────────────────────────────────────
    //  RENDER
    // ────────────────────────────────────────────────────────
    _render() {
      this._buildHeader();
      this._renderBody();
      this._refreshColPanel();
      this._updateStatus();
      requestAnimationFrame(() => this._applyLayout());
    }

    _getVisibleCols() {
      return this._cols.filter((c) => c._visible);
    }

    _getFrozenOffsets() {
      const o = {};
      let left = 0;
      this._getVisibleCols().forEach((c) => {
        if (c._frozen) {
          o[c._id] = left;
          left += c._width;
        }
      });
      return o;
    }

    _getLastFrozenId() {
      let last = null;
      this._getVisibleCols().forEach((c) => {
        if (c._frozen) last = c._id;
      });
      return last;
    }

    _getVisibleRows() {
      return this._applyFilters(
        this._applySorts(this._rows.filter((r) => !r._pinned)),
      );
    }

    // ────────────────────────────────────────────────────────
    //  TYPED FILTERS
    // ────────────────────────────────────────────────────────
    _applyFilters(rows) {
      let r = rows.filter((row) =>
        Object.entries(this._filters).every(([field, fObj]) => {
          if (!fObj) return true;
          const raw = row[field];
          if (fObj.type === "num") {
            if (fObj.value === "" || fObj.value == null) return true;
            const n = parseFloat(
                String(raw ?? "")
                  .replace(/\s/g, "")
                  .replace(",", "."),
              ),
              fv = parseFloat(fObj.value);
            if (isNaN(n) || isNaN(fv)) return true;
            switch (fObj.op || "=") {
              case "=":
                return n === fv;
              case "!=":
                return n !== fv;
              case ">":
                return n > fv;
              case ">=":
                return n >= fv;
              case "<":
                return n < fv;
              case "<=":
                return n <= fv;
              default:
                return true;
            }
          }
          if (fObj.type === "date") {
            if (!fObj.value) return true;
            return this._toISO(raw) === fObj.value;
          }
          if (fObj.type === "dateRange") {
            const d = this._toISO(raw);
            if (!d) return true;
            const from = fObj.from || "",
              to = fObj.to || "";
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
          }
          if (fObj.type === "select") {
            if (!fObj.value) return true;
            return String(raw ?? "") === fObj.value;
          }
          return String(raw ?? "")
            .toLowerCase()
            .includes(String(fObj.value ?? "").toLowerCase());
        }),
      );
      const gs = this._searchEl
        ? this._searchEl.value.trim().toLowerCase()
        : "";
      if (gs)
        r = r.filter((row) =>
          Object.values(row).some((v) => String(v).toLowerCase().includes(gs)),
        );
      return r;
    }

    _toISO(val) {
      if (!val) return "";
      const s = String(val);
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      return s;
    }

    _applySorts(rows) {
      if (!this._sorts.length) return rows;
      return [...rows].sort((a, b) => {
        for (const { _col, _dir } of this._sorts) {
          let av = a[_col] ?? "",
            bv = b[_col] ?? "";
          const ai = parseFloat(
              String(av).replace(/\s/g, "").replace(",", "."),
            ),
            bi = parseFloat(String(bv).replace(/\s/g, "").replace(",", "."));
          const cmp =
            !isNaN(ai) && !isNaN(bi)
              ? ai - bi
              : String(av).localeCompare(String(bv), "fr");
          if (cmp !== 0) return _dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }

    _applyGrouping(rows) {
      if (!this._groupEnabled || !this._groupByField) return rows;
      const field = this._groupByField,
        groups = {};
      rows.forEach((r) => {
        const k = r[field] ?? "—";
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      });
      const out = [];
      Object.entries(groups).forEach(([key, grpRows]) => {
        const totals = {};
        this._cols
          .filter((c) => c._aggFunc === "sum")
          .forEach(
            (c) =>
              (totals[c._id] = grpRows.reduce(
                (s, r) => s + (parseFloat(r[c._id]) || 0),
                0,
              )),
          );
        out.push({
          __group: true,
          __key: key,
          __count: grpRows.length,
          __totals: totals,
        });
        out.push(...grpRows);
      });
      return out;
    }

    // ────────────────────────────────────────────────────────
    //  HEADER
    // ────────────────────────────────────────────────────────
    _buildHeader() {
      this._theadEl.innerHTML = "";
      const vcols = this._getVisibleCols(),
        offsets = this._getFrozenOffsets(),
        lastFrz = this._getLastFrozenId();
      const hasGroups = vcols.some((c) => c._group);

      if (hasGroups) {
        const gr = document.createElement("tr");
        let i = 0;
        while (i < vcols.length) {
          const g = vcols[i]._group;
          let span = 1;
          while (i + span < vcols.length && vcols[i + span]._group === g)
            span++;
          const th = document.createElement("th");
          th.colSpan = span;
          th.className = "ng-th-group";
          if (vcols[i]._frozen) {
            th.classList.add("ng-frozen");
            th.style.left = (offsets[vcols[i]._id] || 0) + "px";
            if (vcols.slice(i, i + span).some((c) => c._id === lastFrz))
              th.classList.add("ng-frozen-shadow");
          }
          th.textContent = g;
          gr.appendChild(th);
          i += span;
        }
        this._theadEl.appendChild(gr);
      }

      const colRow = document.createElement("tr");
      vcols.forEach((col) => {
        const th = document.createElement("th");
        th.className = "ng-th";
        if (col._frozen) {
          th.classList.add("ng-frozen");
          th.style.left = (offsets[col._id] || 0) + "px";
        }
        if (col._id === lastFrz) th.classList.add("ng-frozen-shadow");
        th.style.width = col._width + "px";
        th.style.maxWidth = col._width + "px";
        th.style.minWidth = (col._minWidth || col._width) + "px";
        th.dataset.ngCol = col._id;

        if (col._type === "sel") {
          th.classList.add("sel-cell");
          const cb = document.createElement("div");
          cb.className = "ng-sel-cb";
          cb.dataset.ngSelAll = "1";
          cb.addEventListener("click", () => {
            const vis = this._getVisibleRows();
            const all = vis.every((r) => r._selected);
            vis.forEach((r) => (r._selected = !all));
            this._updateStatus();
            this._renderBody();
            this._opts.onSelectionChanged &&
              this._opts.onSelectionChanged(this.getSelectedRows());
          });
          th.appendChild(cb);
          colRow.appendChild(th);
          return;
        }

        const inner = document.createElement("div");
        inner.className = "ng-th-inner";
        const lbl = document.createElement("span");
        lbl.className = "ng-th-label";
        lbl.textContent = col._label;
        inner.appendChild(lbl);

        if (!col._noSort) {
          const si = this._sorts.find((s) => s._col === col._id);
          if (si) {
            const ic = document.createElement("span");
            ic.className = "ng-sort-icon";
            ic.textContent = si._dir === "asc" ? "▲" : "▼";
            inner.appendChild(ic);
            if (this._sorts.length > 1) {
              const p = document.createElement("span");
              p.className = "ng-sort-priority";
              p.textContent = this._sorts.indexOf(si) + 1;
              inner.appendChild(p);
            }
            th.classList.add(si._dir === "asc" ? "sorted-asc" : "sorted-desc");
          }
          th.addEventListener("click", (e) => {
            if (e.target.classList.contains("ng-resize-handle")) return;
            const ex = this._sorts.find((s) => s._col === col._id);
            if (e.shiftKey && this._opts.multiSort !== false) {
              if (ex) ex._dir = ex._dir === "asc" ? "desc" : "asc";
              else this._sorts.push({ _col: col._id, _dir: "asc" });
            } else {
              this._sorts = [
                {
                  _col: col._id,
                  _dir:
                    ex && this._sorts.length === 1
                      ? ex._dir === "asc"
                        ? "desc"
                        : "asc"
                      : "asc",
                },
              ];
            }
            this._render();
            this._opts.onSortChanged &&
              this._opts.onSortChanged(this.getSort());
          });
        }

        if (!["drag", "pin", "sel"].includes(col._type)) {
          const rh = document.createElement("div");
          rh.className = "ng-resize-handle";
          rh.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const sx = e.clientX,
              sw = col._width;
            rh.classList.add("dragging");
            const mv = (ev) => {
              col._width = Math.max(
                col._minWidth || 40,
                sw + (ev.clientX - sx),
              );
              this._render();
            };
            const up = () => {
              rh.classList.remove("dragging");
              document.removeEventListener("mousemove", mv);
              document.removeEventListener("mouseup", up);
            };
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
          });
          th.appendChild(rh);
        }

        // ── Column drag & drop reorder (non-frozen cols only)
        if (!col._frozen && !["drag", "pin", "sel"].includes(col._type)) {
          th.draggable = true;
          th.classList.add("ng-th-draggable");
          th.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            this._colDragSrc = col._id;
            th.classList.add("ng-col-dragging");
            e.dataTransfer.effectAllowed = "move";
          });
          th.addEventListener("dragend", () => {
            th.classList.remove("ng-col-dragging");
            this._theadEl
              .querySelectorAll(".ng-col-drag-over")
              .forEach((x) => x.classList.remove("ng-col-drag-over"));
          });
          th.addEventListener("dragover", (e) => {
            if (
              !this._colDragSrc ||
              this._colDragSrc === col._id ||
              col._frozen
            )
              return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            this._theadEl
              .querySelectorAll(".ng-col-drag-over")
              .forEach((x) => x.classList.remove("ng-col-drag-over"));
            th.classList.add("ng-col-drag-over");
          });
          th.addEventListener("dragleave", () =>
            th.classList.remove("ng-col-drag-over"),
          );
          th.addEventListener("drop", (e) => {
            e.stopPropagation();
            e.preventDefault();
            th.classList.remove("ng-col-drag-over");
            if (!this._colDragSrc || this._colDragSrc === col._id) return;
            const srcIdx = this._cols.findIndex(
              (c) => c._id === this._colDragSrc,
            );
            const dstIdx = this._cols.findIndex((c) => c._id === col._id);
            if (srcIdx < 0 || dstIdx < 0) return;
            const [moved] = this._cols.splice(srcIdx, 1);
            this._cols.splice(dstIdx, 0, moved);
            this._colDragSrc = null;
            this._render();
            this._toast(`Colonne "${moved._label}" déplacée`);
          });
        }

        th.appendChild(inner);
        colRow.appendChild(th);
      });
      this._theadEl.appendChild(colRow);

      // Filter row
      const fr = document.createElement("tr");
      vcols.forEach((col) => {
        const td = document.createElement("td");
        td.className = "ng-filter-cell";
        if (col._frozen) {
          td.classList.add("ng-frozen");
          td.style.left = (offsets[col._id] || 0) + "px";
        }
        if (col._id === lastFrz) td.classList.add("ng-frozen-shadow");
        td.style.width = col._width + "px";
        td.style.maxWidth = col._width + "px";
        if (!col._noFilter && col._filterType !== "none")
          td.appendChild(this._buildFilterWidget(col));
        fr.appendChild(td);
      });
      this._theadEl.appendChild(fr);
    }

    // ────────────────────────────────────────────────────────
    //  FILTER WIDGETS
    // ────────────────────────────────────────────────────────
    _buildFilterWidget(col) {
      const fObj = this._filters[col._id] || {};
      const wrap = document.createElement("div");
      wrap.className = "ng-filter-wrap";
      const emit = (patch) => {
        const next = Object.assign(
          { type: col._filterType },
          this._filters[col._id] || {},
          patch,
        );
        let empty = false;
        if (next.type === "dateRange") empty = !next.from && !next.to;
        else if (next.type === "num")
          empty = next.value === "" || next.value == null;
        else if (next.type === "date") empty = !next.value;
        else if (next.type === "select") empty = !next.value;
        else empty = !next.value;
        if (empty) delete this._filters[col._id];
        else this._filters[col._id] = next;
        this._renderBody();
        this._opts.onFilterChanged &&
          this._opts.onFilterChanged(this.getFilters());
      };
      if (col._filterType === "num") {
        const op = document.createElement("select");
        op.className = "ng-filter-op-sel";
        ["=", "!=", ">", ">=", "<", "<="].forEach((o) => {
          const x = document.createElement("option");
          x.value = o;
          x.textContent = o;
          if ((fObj.op || "=") === o) x.selected = true;
          op.appendChild(x);
        });
        const inp = document.createElement("input");
        inp.type = "number";
        inp.className = "ng-filter-input ng-filter-num";
        inp.placeholder = "0";
        inp.value = fObj.value ?? "";
        inp.step = "any";
        op.addEventListener("change", () =>
          emit({ op: op.value, value: inp.value }),
        );
        inp.addEventListener("input", () =>
          emit({ op: op.value, value: inp.value }),
        );
        wrap.appendChild(op);
        wrap.appendChild(inp);
        return wrap;
      }
      if (col._filterType === "date") {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.className = "ng-filter-input ng-filter-date";
        inp.value = fObj.value ?? "";
        inp.addEventListener("change", () => emit({ value: inp.value }));
        wrap.appendChild(inp);
        return wrap;
      }
      if (col._filterType === "dateRange") {
        const from = document.createElement("input");
        from.type = "date";
        from.className = "ng-filter-input ng-filter-date ng-filter-dr";
        from.value = fObj.from ?? "";
        const sep = document.createElement("span");
        sep.className = "ng-filter-dr-sep";
        sep.textContent = "→";
        const to = document.createElement("input");
        to.type = "date";
        to.className = "ng-filter-input ng-filter-date ng-filter-dr";
        to.value = fObj.to ?? "";
        from.addEventListener("change", () =>
          emit({ from: from.value, to: to.value }),
        );
        to.addEventListener("change", () =>
          emit({ from: from.value, to: to.value }),
        );
        wrap.appendChild(from);
        wrap.appendChild(sep);
        wrap.appendChild(to);
        return wrap;
      }
      if (col._filterType === "select") {
        const sel = document.createElement("select");
        sel.className = "ng-filter-input ng-filter-select";
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "— Tous";
        sel.appendChild(all);
        const vals = [
          ...new Set(
            this._rows
              .map((r) => r[col._id])
              .filter((v) => v != null && v !== ""),
          ),
        ].sort();
        vals.forEach((v) => {
          const o = document.createElement("option");
          o.value = v;
          o.textContent = v;
          if (fObj.value === v) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", () => emit({ value: sel.value }));
        wrap.appendChild(sel);
        return wrap;
      }
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "ng-filter-input";
      inp.placeholder = col._label;
      inp.value = fObj.value ?? "";
      inp.addEventListener("input", () => emit({ value: inp.value }));
      wrap.appendChild(inp);
      return wrap;
    }

    // ────────────────────────────────────────────────────────
    //  RENDER BODY
    // ────────────────────────────────────────────────────────
    _renderBody() {
      this._pinnedSection.innerHTML = "";
      this._tbodyEl.innerHTML = "";
      this._aggRowEl.innerHTML = "";
      const vcols = this._getVisibleCols(),
        offsets = this._getFrozenOffsets(),
        lastFrz = this._getLastFrozenId();
      const isTree = this._hasTreeData();
      const pinned = this._rows.filter((r) => r._pinned),
        visible = this._getVisibleRows(),
        grouped = this._applyGrouping(visible);

      const hcb = this._theadEl.querySelector("[data-ng-sel-all]");
      if (hcb) {
        const sc = visible.filter((r) => r._selected).length;
        hcb.className =
          "ng-sel-cb" +
          (sc === visible.length && visible.length > 0
            ? " checked"
            : sc > 0
              ? " indeterminate"
              : "");
      }

      pinned.forEach((row) => {
        this._pinnedSection.appendChild(
          this._buildRow(row, [], vcols, offsets, lastFrz, isTree),
        );
        if (row._detailOpen)
          this._pinnedSection.appendChild(
            this._buildDetailRow(row, vcols.length),
          );
      });
      this._pinnedSection.style.display = pinned.length ? "" : "none";

      grouped.forEach((row) => {
        if (row.__group)
          this._tbodyEl.appendChild(this._buildGroupRow(row, vcols.length));
        else {
          this._tbodyEl.appendChild(
            this._buildRow(row, visible, vcols, offsets, lastFrz, isTree),
          );
          if (row._detailOpen)
            this._tbodyEl.appendChild(this._buildDetailRow(row, vcols.length));
        }
      });

      // Aggregation row
      if (this._opts.showAggRow !== false) {
        const aggTr = document.createElement("tr");
        const firstId = this._cols.find(
          (c) => !["sel", "drag", "pin"].includes(c._id) && c._visible,
        )?._id;
        vcols.forEach((col) => {
          const td = document.createElement("td");
          td.className = "ng-td";
          td.style.cssText = `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:${col._width}px;max-width:${col._width}px;`;
          if (col._frozen) {
            td.classList.add("ng-frozen");
            td.style.left = (offsets[col._id] || 0) + "px";
          }
          if (col._id === lastFrz) td.classList.add("ng-frozen-shadow");
          if (col._id === firstId) {
            td.textContent = "TOTAL";
            td.style.fontWeight = "700";
          } else if (col._aggFunc === "sum") {
            const sum = visible.reduce((s, r) => {
              const v =
                typeof col._formula === "function"
                  ? col._formula(r)
                  : r[col._id];
              return s + (parseFloat(v) || 0);
            }, 0);
            td.classList.add("num");
            td.textContent = this._fmtNum(sum, col._decimals);
            if (sum < 0) td.style.color = "var(--ng-negative)";
          }
          aggTr.appendChild(td);
        });
        this._aggRowEl.appendChild(aggTr);
      }

      this._updateStatus();
      this._updatePagination();
      requestAnimationFrame(() => this._applyLayout());
    }

    // ────────────────────────────────────────────────────────
    //  BUILD ROW
    // ────────────────────────────────────────────────────────
    _buildRow(row, visibleRows, vcols, offsets, lastFrz, isTree) {
      const tr = document.createElement("tr");
      tr.dataset.ngRowId = row._ngId;
      if (row._selected) tr.classList.add("selected");
      if (row._pinned) tr.classList.add("ng-pinned");
      vcols.forEach((col) =>
        tr.appendChild(
          this._buildCell(
            col,
            row[col._id],
            row,
            offsets,
            lastFrz,
            isTree,
            vcols,
          ),
        ),
      );

      tr.addEventListener("click", (e) => {
        if (
          ["ng-drag-handle", "ng-pin-cell", "ng-sel-cb", "ng-tree-toggle"].some(
            (c) => e.target.classList.contains(c),
          )
        )
          return;
        const idx = visibleRows.indexOf(row);
        if (e.shiftKey && this._lastClickIdx !== null && idx >= 0) {
          const from = Math.min(this._lastClickIdx, idx),
            to = Math.max(this._lastClickIdx, idx);
          visibleRows.forEach((r, i) => {
            if (i >= from && i <= to) r._selected = true;
          });
        } else if (e.ctrlKey || e.metaKey) {
          row._selected = !row._selected;
          this._lastClickIdx = idx;
        } else {
          this._rows.forEach((r) => (r._selected = false));
          row._selected = true;
          this._lastClickIdx = idx;
        }
        this._updateStatus();
        this._renderBody();
        this._opts.onSelectionChanged &&
          this._opts.onSelectionChanged(this.getSelectedRows());
        this._opts.onRowClick &&
          this._opts.onRowClick({ row: this._cleanRow(row), event: e });
      });
      tr.addEventListener("dblclick", (e) => {
        row._detailOpen = !row._detailOpen;
        this._renderBody();
        this._opts.onRowDblClick &&
          this._opts.onRowDblClick({ row: this._cleanRow(row), event: e });
      });
      tr.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._ctxRow = row;
        this._ctxCol = e.target.closest("td")?.dataset?.ngCol;
        const m = this._ctxMenuEl;
        m.classList.add("visible");
        m.style.left = Math.min(e.clientX + 2, window.innerWidth - 200) + "px";
        m.style.top = Math.min(e.clientY + 2, window.innerHeight - 340) + "px";
      });
      tr.draggable = true;
      tr.addEventListener("dragstart", () => {
        this._dragSrc = row._ngId;
        tr.classList.add("dragging");
      });
      tr.addEventListener("dragend", () => {
        tr.classList.remove("dragging");
        document
          .querySelectorAll(".drag-over")
          .forEach((e) => e.classList.remove("drag-over"));
      });
      tr.addEventListener("dragover", (e) => {
        e.preventDefault();
        document
          .querySelectorAll(".drag-over")
          .forEach((x) => x.classList.remove("drag-over"));
        tr.classList.add("drag-over");
      });
      tr.addEventListener("drop", () => {
        tr.classList.remove("drag-over");
        if (!this._dragSrc || this._dragSrc === row._ngId) return;
        const fi = this._rows.findIndex((r) => r._ngId === this._dragSrc),
          ti = this._rows.findIndex((r) => r._ngId === row._ngId);
        if (fi < 0 || ti < 0) return;
        const [moved] = this._rows.splice(fi, 1);
        this._rows.splice(ti, 0, moved);
        this._dragSrc = null;
        this._renderBody();
        this._opts.onRowMoved &&
          this._opts.onRowMoved({
            row: this._cleanRow(moved),
            fromIndex: fi,
            toIndex: ti,
          });
      });
      return tr;
    }

    // ────────────────────────────────────────────────────────
    //  BUILD CELL
    // ────────────────────────────────────────────────────────
    _buildCell(col, val, row, offsets, lastFrz, isTree, vcols) {
      const td = document.createElement("td");
      td.className = "ng-td";
      td.style.overflow = "hidden";
      td.style.textOverflow = "ellipsis";
      td.style.whiteSpace = "nowrap";
      td.style.width = col._width + "px";
      td.style.maxWidth = col._width + "px";
      if (col._frozen) {
        td.classList.add("ng-frozen");
        td.style.left = (offsets[col._id] || 0) + "px";
      }
      if (col._id === lastFrz) td.classList.add("ng-frozen-shadow");
      td.dataset.ngCol = col._id;

      if (col._type === "sel") {
        td.classList.add("sel-cell");
        const cb = document.createElement("div");
        cb.className = "ng-sel-cb" + (row._selected ? " checked" : "");
        cb.addEventListener("click", (e) => {
          e.stopPropagation();
          row._selected = !row._selected;
          this._updateStatus();
          this._renderBody();
          this._opts.onSelectionChanged &&
            this._opts.onSelectionChanged(this.getSelectedRows());
        });
        td.appendChild(cb);
        return td;
      }
      if (col._type === "drag") {
        const h = document.createElement("div");
        h.className = "ng-drag-handle";
        h.innerHTML = "⠿";
        td.appendChild(h);
        return td;
      }
      if (col._type === "pin") {
        const p = document.createElement("div");
        p.className = "ng-pin-cell";
        p.textContent = "📌";
        p.addEventListener("click", (e) => {
          e.stopPropagation();
          row._pinned = !row._pinned;
          this._renderBody();
          this._opts.onRowPinned &&
            this._opts.onRowPinned({
              row: this._cleanRow(row),
              pinned: row._pinned,
            });
          this._toast(row._pinned ? "Ligne fixée" : "Ligne libérée");
        });
        td.appendChild(p);
        return td;
      }

      if (row._dirty?.[col._id]) td.classList.add("dirty");
      const cfCls = this._cfClass(col, val);
      if (cfCls) td.classList.add(cfCls);

      const firstDataId = vcols.find(
        (c) => !["sel", "drag", "pin"].includes(c._id),
      )?._id;
      const needsTreeUI = isTree && col._id === firstDataId;

      if (needsTreeUI) {
        td.style.display = "flex";
        td.style.alignItems = "center";
        td.style.gap = "1px";
        const indent = document.createElement("span");
        indent.style.cssText = `display:inline-block;width:${(row._depth || 0) * 14}px;flex-shrink:0;`;
        td.appendChild(indent);
        const toggle = document.createElement("span");
        toggle.className = "ng-tree-toggle";
        if (row._hasChildren) {
          toggle.textContent = row._expanded !== false ? "▾" : "▸";
          toggle.style.cursor = "pointer";
          toggle.style.flexShrink = "0";
          toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            this._toggleTree(row);
          });
        } else {
          toggle.textContent = "·";
          toggle.style.opacity = "0.3";
          toggle.style.flexShrink = "0";
        }
        td.appendChild(toggle);
      }

      const rendered = this._renderValue(col, val, row);
      if (rendered instanceof HTMLElement) {
        rendered.style.flexShrink = "1";
        rendered.style.overflow = "hidden";
        td.appendChild(rendered);
      } else {
        if (col._type === "num") {
          td.classList.add("num");
          const n = parseFloat(
            String(val ?? "")
              .replace(/\s/g, "")
              .replace(",", "."),
          );
          if (!isNaN(n)) td.classList.add(n < 0 ? "neg" : n > 0 ? "pos" : "");
        }
        if (needsTreeUI) {
          const s = document.createElement("span");
          s.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;";
          s.textContent = rendered;
          td.appendChild(s);
        } else td.textContent = rendered;
      }

      if (col._editable) {
        td.classList.add("editable-cell");
        td.addEventListener("dblclick", () => this._startEdit(td, row, col));
      }
      if (col._tooltip) {
        const tip = col._tooltipField ? row[col._tooltipField] : val;
        if (tip) {
          td.addEventListener("mouseenter", (e) => this._showTooltip(e, tip));
          td.addEventListener("mouseleave", () => this._hideTooltip());
        }
      }
      td.addEventListener("click", (e) => {
        this._focusedCell = { rowId: row._ngId, colId: col._id };
        this._opts.onCellClick &&
          this._opts.onCellClick({
            row: this._cleanRow(row),
            field: col._id,
            value: val,
            event: e,
          });
      });
      return td;
    }

    _renderValue(col, val, row) {
      // ── Formula column: compute value on the fly
      if (typeof col._formula === "function") {
        try {
          val = col._formula(row);
        } catch (e) {
          val = "#ERR";
        }
      }
      if (typeof col._formatter === "function") {
        const r = col._formatter({ value: val, row, col: col._raw });
        return r instanceof HTMLElement ? r : r != null ? String(r) : "";
      }
      const v = val ?? "";
      switch (col._type) {
        case "num": {
          if (v === "" || v == null) return "";
          const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
          return isNaN(n) ? String(v) : this._fmtNum(n, col._decimals);
        }
        case "badge": {
          const el = document.createElement("span");
          const AUTO = {
            Validé: "green",
            Rejeté: "red",
            Brouillon: "gray",
            "En cours": "blue",
            Clôturé: "orange",
            Virement: "blue",
            Prêt: "green",
            Emprunt: "red",
            Swap: "orange",
            Couverture: "blue",
            Dépôt: "gray",
            Groupe: "gray",
          };
          const cls =
            (col._badgeColors && col._badgeColors[v]) || AUTO[v] || "gray";
          el.className = `ng-badge ng-badge-${cls}`;
          el.textContent = v;
          return el;
        }
        case "progress": {
          const n = parseFloat(v) || 0;
          const wrap = document.createElement("div");
          wrap.className = "ng-progress-wrap";
          wrap.style.width = "100%";
          wrap.style.overflow = "hidden";
          const bar = document.createElement("div");
          bar.className = "ng-progress-bar";
          const fill = document.createElement("div");
          fill.className = "ng-progress-fill";
          fill.style.width = Math.min(100, Math.max(0, n)) + "%";
          fill.style.background =
            n > 70 ? "#1a6e3d" : n > 40 ? "#b35c00" : "#c0392b";
          bar.appendChild(fill);
          wrap.appendChild(bar);
          const lbl = document.createElement("span");
          lbl.style.cssText = "font-size:10px;min-width:28px;flex-shrink:0;";
          lbl.textContent = n + "%";
          wrap.appendChild(lbl);
          return wrap;
        }
        case "spark": {
          if (!Array.isArray(v)) return "";
          const wrap = document.createElement("div");
          wrap.className = "ng-spark-wrap";
          const c = document.createElement("canvas");
          c.width = 80;
          c.height = 22;
          c.style.cssText = "width:80px;height:22px;flex-shrink:0;";
          const ctx2 = c.getContext("2d");
          const mn = Math.min(...v),
            mx = Math.max(...v),
            rng = mx - mn || 1;
          const pts = v.map((vv, i) => ({
            x: 2 + i * (76 / (v.length - 1)),
            y: 20 - ((vv - mn) / rng) * 18,
          }));
          ctx2.beginPath();
          ctx2.moveTo(pts[0].x, pts[0].y);
          pts.slice(1).forEach((p) => ctx2.lineTo(p.x, p.y));
          ctx2.strokeStyle = "#1e6dc5";
          ctx2.lineWidth = 1.5;
          ctx2.stroke();
          const last = pts[pts.length - 1];
          ctx2.beginPath();
          ctx2.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
          ctx2.fillStyle = v[v.length - 1] >= 0 ? "#1a6e3d" : "#c0392b";
          ctx2.fill();
          wrap.appendChild(c);
          return wrap;
        }
        case "boolean":
          return v ? "✓" : "—";
        default:
          return v != null ? String(v) : "";
      }
    }

    _cfClass(col, val) {
      if (!this._cfEnabled || !col._cf) return "";
      const n = parseFloat(
        String(val ?? "")
          .replace(/\s/g, "")
          .replace(",", "."),
      );
      if (isNaN(n)) return "";
      return n > 100000 ? "ng-cf-high" : n < 0 ? "ng-cf-low" : "ng-cf-med";
    }

    _buildGroupRow(grp, colCount) {
      const tr = document.createElement("tr");
      tr.className = "ng-group-row";
      const td = document.createElement("td");
      td.colSpan = colCount;
      const sumStr = Object.entries(grp.__totals || {})
        .map(([k, v]) => {
          const col = this._cols.find((c) => c._id === k);
          return `${col?._label || k}: <b>${this._fmtNum(v)}</b>`;
        })
        .join(" | ");
      td.innerHTML = `<span style="font-size:10px;background:#1c2e4a;color:#e8edf5;padding:2px 7px;border-radius:10px;margin-right:8px;">${grp.__key}</span>${grp.__count} ligne${grp.__count > 1 ? "s" : ""}  ${sumStr}`;
      tr.appendChild(td);
      return tr;
    }

    _buildDetailRow(row, colCount) {
      const tr = document.createElement("tr");
      tr.className = "ng-detail-row";
      const td = document.createElement("td");
      td.colSpan = colCount;
      const fields = this._cols.filter(
        (c) => !["sel", "drag", "pin"].includes(c._id) && c._visible,
      );
      const d = document.createElement("div");
      d.className = "ng-detail-content";
      const title = document.createElement("div");
      title.className = "ng-detail-title";
      title.textContent = `Détail — ${row[fields[0]?._id] || row._ngId}`;
      d.appendChild(title);
      const grid = document.createElement("div");
      grid.className = "ng-detail-grid";
      fields.forEach((col) => {
        const item = document.createElement("div");
        item.className = "ng-detail-field";
        item.innerHTML = `<label>${col._label}</label><span>${row[col._id] ?? "—"}</span>`;
        grid.appendChild(item);
      });
      d.appendChild(grid);
      td.appendChild(d);
      tr.appendChild(td);
      return tr;
    }

    // ────────────────────────────────────────────────────────
    //  STATUS
    // ────────────────────────────────────────────────────────
    _updateStatus() {
      if (!this._statusEl) return;
      const visible = this._getVisibleRows(),
        pinned = this._rows.filter((r) => r._pinned);
      const nc = this._cols.find((c) => c._aggFunc === "sum" && c._visible);
      const sum = nc
        ? visible.reduce((s, r) => s + (parseFloat(r[nc._id]) || 0), 0)
        : null;
      this._setStatus(
        "rows",
        visible.length + (pinned.length ? ` (+${pinned.length} fixées)` : ""),
      );
      this._setStatus("sel", this._rows.filter((r) => r._selected).length);
      this._setStatus("sum", nc ? `${nc._label} : ${this._fmtNum(sum)}` : "—");
      this._setStatus("filters", Object.keys(this._filters).length);
      this._setStatus(
        "sort",
        this._sorts.length
          ? this._sorts.map((s) => `${s._col} ${s._dir}`).join(", ")
          : "—",
      );
    }
    _setStatus(k, v) {
      const el = this._statusEl?.querySelector(`[data-ng-st="${k}"]`);
      if (el) el.textContent = v;
    }

    // ────────────────────────────────────────────────────────
    //  EDITING
    // ────────────────────────────────────────────────────────
    _startEdit(td, row, col) {
      td.classList.add("editing-active");
      td.style.overflow = "visible";
      const old = td.textContent;
      td.textContent = "";
      const inp = document.createElement("input");
      inp.type =
        col._type === "num" ? "number" : col._type === "date" ? "date" : "text";
      inp.value = old;
      inp.step = "any";
      inp.style.textAlign = col._type === "num" ? "right" : "left";
      td.appendChild(inp);
      inp.focus();
      inp.select();
      const finish = (save) => {
        td.classList.remove("editing-active");
        td.style.overflow = "hidden";
        if (save && inp.value !== old) {
          const oldVal = row[col._id];
          row[col._id] = inp.value;
          if (!row._dirty) row._dirty = {};
          row._dirty[col._id] = true;
          this._opts.onCellValueChanged &&
            this._opts.onCellValueChanged({
              row: this._cleanRow(row),
              field: col._id,
              oldValue: oldVal,
              newValue: inp.value,
            });
          this._toast("Cellule modifiée");
        }
        this._renderBody();
      };
      inp.addEventListener("blur", () => finish(true));
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      });
    }

    // ────────────────────────────────────────────────────────
    //  CONTEXT MENU
    // ────────────────────────────────────────────────────────
    _ctxAction(action) {
      this._ctxMenuEl.classList.remove("visible");
      const row = this._ctxRow,
        colId = this._ctxCol;
      switch (action) {
        case "pin":
          if (!row) return;
          row._pinned = !row._pinned;
          this._renderBody();
          this._toast(row._pinned ? "Ligne fixée" : "Ligne libérée");
          break;
        case "detail":
          if (!row) return;
          row._detailOpen = !row._detailOpen;
          this._renderBody();
          break;
        case "edit": {
          if (!row || !colId) return;
          const td = this._el.querySelector(`td[data-ng-col="${colId}"]`);
          const c = this._cols.find((c) => c._id === colId);
          if (td && c?._editable) this._startEdit(td, row, c);
          break;
        }
        case "chart": {
          if (!this._rows.filter((r) => r._selected).length && row) {
            row._selected = true;
            this._renderBody();
          }
          this.openChart();
          break;
        }
        case "copy":
          this.copySelected();
          break;
        case "selectAll":
          this._rows.forEach((r) => (r._selected = true));
          this._updateStatus();
          this._renderBody();
          break;
        case "sortAsc":
          this._sorts = [{ _col: colId, _dir: "asc" }];
          this._render();
          break;
        case "sortDesc":
          this._sorts = [{ _col: colId, _dir: "desc" }];
          this._render();
          break;
        case "hideCol": {
          const c = this._cols.find((c) => c._id === colId);
          if (c) {
            c._visible = false;
            this._render();
          }
          break;
        }
        case "freezeCol": {
          const c = this._cols.find((c) => c._id === colId);
          if (c && !["sel", "drag", "pin"].includes(c._id)) {
            c._frozen = !c._frozen;
            if (c._frozen) {
              const idx = this._cols.indexOf(c);
              this._cols.splice(idx, 1);
              const li = this._cols.reduce((a, c, i) => (c._frozen ? i : a), 2);
              this._cols.splice(li + 1, 0, c);
            }
            this._render();
            this._toast(
              c._frozen ? `"${c._label}" fixée` : `"${c._label}" libérée`,
            );
          }
          break;
        }
        case "deleteRow": {
          if (!row) return;
          this._rows = this._rows.filter((r) => r._ngId !== row._ngId);
          this._render();
          this._toast("Ligne supprimée");
          break;
        }
        case "bulkEdit": {
          const sel = this._rows.filter((r) => r._selected);
          if (!sel.length && row) {
            row._selected = true;
            this._renderBody();
          }
          this._openBulkModal();
          break;
        }
        case "compare": {
          const sel = this._rows.filter((r) => r._selected);
          if (sel.length < 2 && row) {
            row._selected = true;
            this._renderBody();
          }
          this._openCompareModal();
          break;
        }
      }
    }

    // ────────────────────────────────────────────────────────
    //  COL PANEL & TOGGLES
    // ────────────────────────────────────────────────────────
    toggleColPanel() {
      this._colPanelEl.classList.toggle("open");
      this._refreshColPanel();
    }
    _refreshColPanel() {
      const list = this._colPanelEl.querySelector(".ng-col-panel-list");
      if (!list) return;
      list.innerHTML = "";
      this._cols
        .filter((c) => !["sel", "drag", "pin"].includes(c._id))
        .forEach((col) => {
          const item = document.createElement("div");
          item.className = "ng-col-panel-item";
          const left = document.createElement("div");
          left.style.cssText = "display:flex;align-items:center;gap:8px;";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = col._visible;
          cb.addEventListener("change", () => {
            col._visible = cb.checked;
            this._render();
          });
          const lbl = document.createElement("span");
          lbl.textContent = col._label;
          left.appendChild(cb);
          left.appendChild(lbl);
          const pin = document.createElement("button");
          pin.className = "ng-col-pin-btn";
          pin.textContent = "📌";
          pin.style.opacity = col._frozen ? "1" : "0.3";
          pin.addEventListener("click", (e) => {
            e.stopPropagation();
            if (["sel", "drag", "pin"].includes(col._id)) return;
            col._frozen = !col._frozen;
            if (col._frozen) {
              const idx = this._cols.indexOf(col);
              this._cols.splice(idx, 1);
              const li = this._cols.reduce((a, c, i) => (c._frozen ? i : a), 2);
              this._cols.splice(li + 1, 0, col);
            }
            this._render();
            this._refreshColPanel();
          });
          item.appendChild(left);
          item.appendChild(pin);
          list.appendChild(item);
        });
    }
    toggleFilters() {
      this._filtersVis = !this._filtersVis;
      this._tableEl.classList.toggle("ng-filters-hidden", !this._filtersVis);
      this._toolbarEl
        ?.querySelector('[data-ng-btn="filters"]')
        ?.classList.toggle("active", this._filtersVis);
    }
    toggleGrouping() {
      this._groupEnabled = !this._groupEnabled;
      if (this._groupEnabled && !this._groupByField) {
        const c = this._cols.find(
          (c) =>
            !["sel", "drag", "pin"].includes(c._id) &&
            c._type !== "num" &&
            c._visible,
        );
        this._groupByField = c?._id || null;
      }
      this._toolbarEl
        ?.querySelector('[data-ng-btn="group"]')
        ?.classList.toggle("active", this._groupEnabled);
      this._renderBody();
    }
    toggleCF() {
      this._cfEnabled = !this._cfEnabled;
      this._toolbarEl
        ?.querySelector('[data-ng-btn="cf"]')
        ?.classList.toggle("active", this._cfEnabled);
      this._renderBody();
    }
    setLayout(layout) {
      this._layout = layout;
      this._applyLayout();
      return this;
    }

    // ────────────────────────────────────────────────────────
    //  SPLASH
    // ────────────────────────────────────────────────────────
    _buildSplash() {
      const s = document.createElement("div");
      s.className = "ng-splash hidden";
      s.innerHTML = `<div class="ng-splash-card"><div class="ng-splash-logo"><div class="ng-splash-diamond"></div><div><div class="ng-splash-logo-text">NEXAGRID</div><div class="ng-splash-logo-sub">Advanced Grid Library</div></div></div><div class="ng-splash-track"><div class="ng-splash-fill"></div></div><div class="ng-splash-msg"></div><div class="ng-splash-dots"></div></div>`;
      return s;
    }
    _runLoader(cfg, onReady) {
      const s = this._splashEl;
      const def = {
        title: this._opts.title || "NEXAGRID",
        subtitle: "Advanced Grid Library",
        steps: ["Initialisation…", "Chargement…", "Rendu…", "Prêt !"],
        duration: 1800,
        accentColor: "#1e6dc5",
      };
      const c = Object.assign({}, def, cfg);
      s.querySelector(".ng-splash-logo-text").textContent = c.title;
      s.querySelector(".ng-splash-logo-sub").textContent = c.subtitle;
      s.querySelector(".ng-splash-diamond").style.background = c.accentColor;
      const fill = s.querySelector(".ng-splash-fill");
      fill.style.background = c.accentColor;
      const dotsEl = s.querySelector(".ng-splash-dots");
      dotsEl.innerHTML = "";
      c.steps.forEach(() => {
        const d = document.createElement("div");
        d.className = "ng-splash-dot";
        dotsEl.appendChild(d);
      });
      const dots = dotsEl.querySelectorAll(".ng-splash-dot"),
        msg = s.querySelector(".ng-splash-msg");
      const total = c.steps.length,
        stepDur = c.duration / total;
      let cur = 0;
      s.classList.remove("hidden");
      fill.style.width = "0%";
      if (dots[0]) dots[0].classList.add("active");
      const next = () => {
        if (cur >= total) {
          setTimeout(() => {
            s.classList.add("hidden");
            onReady && onReady();
          }, 120);
          return;
        }
        msg.style.opacity = "0";
        setTimeout(() => {
          msg.textContent = c.steps[cur];
          msg.style.opacity = "1";
          fill.style.width = Math.round(((cur + 1) / total) * 100) + "%";
          if (dots[cur]) {
            dots[cur].classList.remove("active");
            dots[cur].classList.add("done");
          }
          if (dots[cur + 1]) dots[cur + 1].classList.add("active");
          cur++;
          setTimeout(next, stepDur);
        }, 100);
      };
      setTimeout(next, 300);
    }

    // ────────────────────────────────────────────────────────
    //  CHART MODAL (unchanged engine)
    // ────────────────────────────────────────────────────────
    _buildChartModal() {
      const o = document.createElement("div");
      o.className = "ng-chart-overlay";
      o.innerHTML = `<div class="ng-chart-modal"><div class="ng-chart-modal-header"><div class="ng-chart-modal-title">📊 Analyse — lignes sélectionnées <span class="ng-chart-badge ng-chart-sel-count">0 lignes</span></div><span class="ng-chart-close">✕</span></div><div class="ng-chart-inner"><div class="ng-chart-nav"></div><div class="ng-chart-content"></div></div><div class="ng-chart-footer"><button class="ng-btn-secondary ng-chart-png-btn">💾 PNG</button><button class="ng-btn-secondary ng-chart-csv-btn">📄 CSV</button><button class="ng-btn-primary ng-chart-close-btn">Fermer</button></div></div>`;
      o.querySelector(".ng-chart-close").addEventListener("click", () =>
        this.closeChart(),
      );
      o.querySelector(".ng-chart-close-btn").addEventListener("click", () =>
        this.closeChart(),
      );
      o.querySelector(".ng-chart-png-btn").addEventListener("click", () =>
        this._exportChartPNG(),
      );
      o.querySelector(".ng-chart-csv-btn").addEventListener("click", () =>
        this.exportCSV(null, true),
      );
      o.addEventListener("click", (e) => {
        if (e.target === o) this.closeChart();
      });
      return o;
    }

    openChart() {
      const sel = this._rows.filter((r) => r._selected);
      if (!sel.length) {
        this._toast("Sélectionnez au moins une ligne");
        return;
      }
      this._chartOverlay.querySelector(".ng-chart-sel-count").textContent =
        `${sel.length} ligne${sel.length > 1 ? "s" : ""}`;
      this._chartOverlay.classList.add("open");
      Object.keys(this._activeCharts).forEach((id) => {
        this._activeCharts[id].destroy();
        delete this._activeCharts[id];
      });
      setTimeout(() => this._buildAllCharts(sel), 40);
    }
    closeChart() {
      this._chartOverlay.classList.remove("open");
      Object.keys(this._activeCharts).forEach((id) => {
        this._activeCharts[id].destroy();
        delete this._activeCharts[id];
      });
      const nav = this._chartOverlay.querySelector(".ng-chart-nav"),
        con = this._chartOverlay.querySelector(".ng-chart-content");
      if (nav) nav.innerHTML = "";
      if (con) con.innerHTML = "";
    }

    _buildAllCharts(rows) {
      const nav = this._chartOverlay.querySelector(".ng-chart-nav"),
        content = this._chartOverlay.querySelector(".ng-chart-content");
      nav.innerHTML = "";
      content.innerHTML = "";
      const PAL = [
        "#1e6dc5",
        "#1a6e3d",
        "#c0392b",
        "#b35c00",
        "#6b48c8",
        "#0d8a7a",
        "#b8306a",
        "#6a7d96",
      ];
      const graphOpts = this._opts.graph || {};
      const numCols = this._cols.filter(
        (c) => c._aggFunc === "sum" && c._visible,
      );
      const catCols = this._cols
        .filter(
          (c) =>
            !["sel", "drag", "pin"].includes(c._id) &&
            ["text", "badge"].includes(c._type) &&
            c._visible,
        )
        .filter((c) => {
          const v = [...new Set(rows.map((r) => r[c._id]))];
          return v.length > 1 && v.length <= 15;
        });
      const labelField = this._cols.find(
        (c) =>
          !["sel", "drag", "pin"].includes(c._id) &&
          c._type === "text" &&
          c._visible,
      );
      const kpis =
        graphOpts.kpis ||
        numCols
          .slice(0, 4)
          .map((c) => ({ label: c._label, field: c._id, fn: "sum" }));
      const self = this;
      const mkCjs = (id, type, data, opts = {}) => {
        const old = self._activeCharts[id];
        if (old) {
          old.destroy();
          delete self._activeCharts[id];
        }
        const canvas = self._chartOverlay.querySelector("#" + id);
        if (!canvas) return;
        self._activeCharts[id] = new Chart(canvas, {
          type,
          data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  font: { family: "'Segoe UI',sans-serif", size: 11 },
                  boxWidth: 12,
                },
                position:
                  type === "pie" || type === "doughnut" ? "right" : "top",
              },
              tooltip: {
                bodyFont: {
                  family: "'Consolas','Courier New',monospace",
                  size: 11,
                },
              },
            },
            indexAxis: opts.indexAxis || "x",
            scales:
              type === "pie" || type === "doughnut"
                ? undefined
                : {
                    x: { ticks: { font: { size: 10 } } },
                    y: {
                      ticks: {
                        font: { size: 10 },
                        callback: (v) => self._fmtNum(v, 0),
                      },
                    },
                  },
          },
        });
      };
      const mkCard = (id, title, icon, types, bFn, tH, tR) => {
        const card = document.createElement("div");
        card.className = "ng-chart-card";
        const hdr = document.createElement("div");
        hdr.className = "ng-chart-card-header";
        const t = document.createElement("div");
        t.className = "ng-chart-card-title";
        t.textContent = `${icon} ${title}`;
        const bar = document.createElement("div");
        bar.className = "ng-ct-bar";
        const allTypes = [...types, "📋"];
        let activeType = types[0];
        const wrap = document.createElement("div");
        wrap.className = "ng-canvas-wrap";
        const canvas = document.createElement("canvas");
        canvas.id = id;
        wrap.appendChild(canvas);
        const tblWrap = document.createElement("div");
        tblWrap.className = "ng-chart-tbl-wrap";
        tblWrap.id = "tbl-" + id;
        if (tH && tR) {
          const tbl = document.createElement("table");
          tbl.className = "ng-chart-data-tbl";
          const th2 = tbl.createTHead();
          const hr = th2.insertRow();
          tH.forEach((h) => {
            const x = document.createElement("th");
            x.textContent = h;
            hr.appendChild(x);
          });
          const tb2 = tbl.createTBody();
          tR.forEach((r) => {
            const tr = tb2.insertRow();
            r.forEach((cell, i) => {
              const td = tr.insertCell();
              td.textContent = cell;
              const n = parseFloat(
                String(cell).replace(/\s/g, "").replace(",", "."),
              );
              if (!isNaN(n) && i > 0) {
                td.classList.add("num");
if (n < 0) td.classList.add("neg");
                else if (n > 0) td.classList.add("pos");              }
            });
          });
          tblWrap.appendChild(tbl);
        }
        allTypes.forEach((tp) => {
          const btn = document.createElement("button");
          btn.className = "ng-ct-btn" + (tp === activeType ? " active" : "");
          btn.textContent = tp;
          btn.addEventListener("click", () => {
            bar
              .querySelectorAll(".ng-ct-btn")
              .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            activeType = tp;
            wrap.style.display = tp === "📋" ? "none" : "block";
            tblWrap.classList.toggle("visible", tp === "📋");
            if (tp !== "📋") {
              const ct =
                {
                  Bar: "bar",
                  Ligne: "line",
                  Aire: "line",
                  Doughnut: "doughnut",
                  Pie: "pie",
                  "H-Bar": "bar",
                }[tp] || "bar";
              bFn(id, ct, tp);
            }
          });
          bar.appendChild(btn);
        });
        hdr.appendChild(t);
        hdr.appendChild(bar);
        card.appendChild(hdr);
        card.appendChild(wrap);
        card.appendChild(tblWrap);
        return card;
      };
      const labels = rows.map((r) =>
        labelField ? r[labelField._id] : r._ngId,
      );
      const sections = [];
      if (numCols.length >= 1) {
        sections.push({
          title: "Vue d'ensemble",
          icon: "📊",
          build: (panel) => {
            const grid = document.createElement("div");
            grid.className = "ng-charts-grid-2";
            const c1 = numCols[0],
              c2 = numCols[1] || numCols[0];
            const card = mkCard(
              `nc_${c1._id}_${c2._id}`,
              `${c1._label}/${c2._label}`,
              "📊",
              ["Bar", "Ligne", "H-Bar"],
              (id, type, tp) =>
                mkCjs(
                  id,
                  type,
                  {
                    labels,
                    datasets: [
                      {
                        label: c1._label,
                        data: rows.map((r) => parseFloat(r[c1._id]) || 0),
                        backgroundColor: "rgba(192,57,43,0.75)",
                        borderColor: "#c0392b",
                        borderWidth: 1,
                      },
                      {
                        label: c2._label,
                        data: rows.map((r) => parseFloat(r[c2._id]) || 0),
                        backgroundColor: "rgba(26,110,61,0.75)",
                        borderColor: "#1a6e3d",
                        borderWidth: 1,
                      },
                    ],
                  },
                  { indexAxis: tp === "H-Bar" ? "y" : "x" },
                ),
              [labelField?._label || "", c1._label, c2._label],
              rows.map((r) => [
                labelField ? r[labelField._id] : "",
                self._fmtNum(parseFloat(r[c1._id]) || 0),
                self._fmtNum(parseFloat(r[c2._id]) || 0),
              ]),
            );
            grid.appendChild(card);
            const c3 = numCols[2] || numCols[0];
            const d3 = rows.map((r) => parseFloat(r[c3._id]) || 0);
            const card2 = mkCard(
              `nc_l_${c3._id}`,
              c3._label,
              "📈",
              ["Ligne", "Bar", "Aire"],
              (id, type, tp) =>
                mkCjs(id, type, {
                  labels,
                  datasets: [
                    {
                      label: c3._label,
                      data: d3,
                      borderColor: "#1e6dc5",
                      backgroundColor: "rgba(30,109,197,0.12)",
                      tension: 0.3,
                      pointRadius: 3,
                    },
                  ],
                }),
              [labelField?._label || "", c3._label],
              rows.map((r) => [
                labelField ? r[labelField._id] : "",
                self._fmtNum(parseFloat(r[c3._id]) || 0),
              ]),
            );
            grid.appendChild(card2);
            panel.appendChild(grid);
            setTimeout(() => {
              mkCjs(`nc_${c1._id}_${c2._id}`, "bar", {
                labels,
                datasets: [
                  {
                    label: c1._label,
                    data: rows.map((r) => parseFloat(r[c1._id]) || 0),
                    backgroundColor: "rgba(192,57,43,0.75)",
                    borderColor: "#c0392b",
                    borderWidth: 1,
                  },
                  {
                    label: c2._label,
                    data: rows.map((r) => parseFloat(r[c2._id]) || 0),
                    backgroundColor: "rgba(26,110,61,0.75)",
                    borderColor: "#1a6e3d",
                    borderWidth: 1,
                  },
                ],
              });
              mkCjs(`nc_l_${c3._id}`, "line", {
                labels,
                datasets: [
                  {
                    label: c3._label,
                    data: d3,
                    borderColor: "#1e6dc5",
                    backgroundColor: "rgba(30,109,197,0.12)",
                    tension: 0.3,
                    pointRadius: 3,
                  },
                ],
              });
            }, 30);
          },
        });
      }
      catCols.slice(0, 2).forEach((catCol, ci) => {
        const keys = [...new Set(rows.map((r) => r[catCol._id]))];
        const counts = {};
        rows.forEach((r) => {
          counts[r[catCol._id]] = (counts[r[catCol._id]] || 0) + 1;
        });
        const PAL2 = [
          "#1e6dc5",
          "#1a6e3d",
          "#c0392b",
          "#b35c00",
          "#6b48c8",
          "#0d8a7a",
          "#b8306a",
          "#6a7d96",
        ];
        const colors = keys.map((k, i) => PAL2[i % PAL2.length]);
        sections.push({
          title: catCol._label,
          icon: ci === 0 ? "🔖" : "🌐",
          build: (panel) => {
            const grid = document.createElement("div");
            grid.className = "ng-charts-grid-2";
            const cId = `nc_p_${catCol._id}`;
            const card = mkCard(
              cId,
              `Répartition ${catCol._label}`,
              "🥧",
              ["Doughnut", "Pie", "Bar"],
              (id, type, tp) =>
                mkCjs(
                  id,
                  type === "Bar" ? "bar" : type.toLowerCase(),
                  type === "Bar"
                    ? {
                        labels: keys,
                        datasets: [
                          {
                            label: "Nb",
                            data: Object.values(counts),
                            backgroundColor: colors,
                            borderWidth: 0,
                          },
                        ],
                      }
                    : {
                        labels: keys,
                        datasets: [
                          {
                            data: Object.values(counts),
                            backgroundColor: colors,
                            borderWidth: 2,
                            borderColor: "#fff",
                          },
                        ],
                      },
                  { cutout: type === "Doughnut" ? "55%" : undefined },
                ),
              [catCol._label, "Nb"],
              keys.map((k) => [k, counts[k]]),
            );
            grid.appendChild(card);
            if (numCols.length) {
              const nc = numCols[0];
              const sums = {};
              rows.forEach((r) => {
                sums[r[catCol._id]] =
                  (sums[r[catCol._id]] || 0) + (parseFloat(r[nc._id]) || 0);
              });
              const skeys = Object.keys(sums);
              const card2 = mkCard(
                `nc_b_${catCol._id}`,
                `${nc._label} par ${catCol._label}`,
                "📊",
                ["Bar", "H-Bar"],
                (id, type, tp) =>
                  mkCjs(
                    id,
                    "bar",
                    {
                      labels: skeys,
                      datasets: [
                        {
                          label: nc._label,
                          data: Object.values(sums),
                          backgroundColor: skeys.map(
                            (k, i) =>
                              colors[keys.indexOf(k)] || PAL[i % PAL.length],
                          ),
                          borderWidth: 0,
                        },
                      ],
                    },
                    { indexAxis: tp === "H-Bar" ? "y" : "x" },
                  ),
                [catCol._label, nc._label],
                skeys.map((k) => [k, self._fmtNum(sums[k])]),
              );
              grid.appendChild(card2);
              setTimeout(() => {
                mkCjs(
                  cId,
                  "doughnut",
                  {
                    labels: keys,
                    datasets: [
                      {
                        data: Object.values(counts),
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: "#fff",
                      },
                    ],
                  },
                  { cutout: "55%" },
                );
                mkCjs(
                  `nc_b_${catCol._id}`,
                  "bar",
                  {
                    labels: skeys,
                    datasets: [
                      {
                        label: nc._label,
                        data: Object.values(sums),
                        backgroundColor: skeys.map(
                          (k, i) =>
                            colors[keys.indexOf(k)] || PAL[i % PAL.length],
                        ),
                        borderWidth: 0,
                      },
                    ],
                  },
                  { indexAxis: "y" },
                );
              }, 30);
            } else {
              setTimeout(
                () =>
                  mkCjs(
                    cId,
                    "doughnut",
                    {
                      labels: keys,
                      datasets: [
                        {
                          data: Object.values(counts),
                          backgroundColor: colors,
                          borderWidth: 2,
                          borderColor: "#fff",
                        },
                      ],
                    },
                    { cutout: "55%" },
                  ),
                30,
              );
            }
            panel.appendChild(grid);
          },
        });
      });
      sections.push({
        title: "Tableau",
        icon: "📋",
        build: (panel) => {
          const visC = self._cols.filter(
            (c) => !["sel", "drag", "pin"].includes(c._id) && c._visible,
          );
          const tbl = document.createElement("table");
          tbl.className = "ng-chart-data-tbl";
          const th2 = tbl.createTHead();
          const hr = th2.insertRow();
          visC.forEach((c) => {
            const x = document.createElement("th");
            x.textContent = c._label;
            hr.appendChild(x);
          });
          const tb2 = tbl.createTBody();
          rows.forEach((r) => {
            const tr = tb2.insertRow();
            visC.forEach((col) => {
              const td = tr.insertCell();
              const v = r[col._id] ?? "";
              td.textContent = typeof v === "object" ? JSON.stringify(v) : v;
              const n = parseFloat(
                String(v).replace(/\s/g, "").replace(",", "."),
              );
              if (!isNaN(n) && col._type === "num") {
                td.classList.add("num");
if (n < 0) td.classList.add("neg");
                else if (n > 0) td.classList.add("pos");              }
            });
          });
          const wrap = document.createElement("div");
          wrap.className = "ng-chart-tbl-wrap visible";
          wrap.style.maxHeight = "440px";
          wrap.appendChild(tbl);
          panel.appendChild(wrap);
        },
      });
      sections.forEach((sec, idx) => {
        const ni = document.createElement("div");
        ni.className = "ng-chart-nav-item" + (idx === 0 ? " active" : "");
        ni.textContent = `${sec.icon} ${sec.title}`;
        ni.addEventListener("click", () => {
          nav
            .querySelectorAll(".ng-chart-nav-item")
            .forEach((n) => n.classList.remove("active"));
          ni.classList.add("active");
          content
            .querySelectorAll(".ng-chart-panel")
            .forEach((p) => p.classList.remove("active"));
          let panel = content.querySelector(`#ngp-${idx}`);
          if (!panel) {
            panel = document.createElement("div");
            panel.className = "ng-chart-panel active";
            panel.id = `ngp-${idx}`;
            content.appendChild(panel);
            sec.build(panel);
          } else panel.classList.add("active");
        });
        nav.appendChild(ni);
        if (idx === 0) {
          const panel = document.createElement("div");
          panel.className = "ng-chart-panel active";
          panel.id = "ngp-0";
          content.appendChild(panel);
          sec.build(panel);
        }
      });
      const kpiPanel = content.querySelector("#ngp-0");
      if (kpiPanel && kpis.length) {
        const kpiRow = document.createElement("div");
        kpiRow.className = "ng-kpi-row";
        kpis.forEach((kpi) => {
          const vals = rows.map((r) => parseFloat(r[kpi.field]) || 0);
          let val;
          switch (kpi.fn) {
            case "avg":
              val = vals.length
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : 0;
              break;
            case "min":
              val = Math.min(...vals);
              break;
            case "max":
              val = Math.max(...vals);
              break;
            case "count":
              val = rows.length;
              break;
            default:
              val = vals.reduce((a, b) => a + b, 0);
          }
          const el = document.createElement("div");
          el.className = "ng-kpi";
          el.innerHTML = `<div class="ng-kpi-label">${kpi.label}</div><div class="ng-kpi-value ${val < 0 ? "neg" : val > 0 ? "pos" : ""}">${kpi.fn === "count" ? val : this._fmtNum(val)}${kpi.suffix || ""}</div>`;
          kpiRow.appendChild(el);
        });
        kpiPanel.insertBefore(kpiRow, kpiPanel.firstChild);
      }
    }
    _exportChartPNG() {
      const c = this._chartOverlay.querySelector(
        ".ng-chart-panel.active canvas",
      );
      if (!c) {
        this._toast("Aucun graphique actif");
        return;
      }
      const a = document.createElement("a");
      a.download = "nexagrid-chart.png";
      a.href = c.toDataURL("image/png");
      a.click();
      this._toast("Graphique exporté");
    }

    // ────────────────────────────────────────────────────────
    //  FEATURE: EXCEL PASTE  (Ctrl+V)
    // ────────────────────────────────────────────────────────
    _handlePaste(e) {
      const clip = e.clipboardData || window.clipboardData;
      const text = clip.getData("text");
      if (!text) return;
      e.preventDefault();

      // Parse TSV (tab-separated from Excel/Sheets)
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trimEnd()
        .split("\n");
      const matrix = lines.map((l) =>
        l.split("	").map((c) => {
          // Strip surrounding quotes from quoted cells
          return c.startsWith('"') && c.endsWith('"')
            ? c.slice(1, -1).replace(/""/g, '"')
            : c;
        }),
      );
      if (!matrix.length) return;

      // Determine start cell: focused cell or first visible editable
      const visRows = this._getVisibleRows();
      const editCols = this._getVisibleCols().filter((c) => c._editable);
      if (!editCols.length) {
        this._toast("Aucune colonne éditable");
        return;
      }

      let startRowIdx = 0,
        startColIdx = 0;
      if (this._focusedCell) {
        const ri = visRows.findIndex(
          (r) => r._ngId === this._focusedCell.rowId,
        );
        const ci = editCols.findIndex((c) => c._id === this._focusedCell.colId);
        if (ri >= 0) startRowIdx = ri;
        if (ci >= 0) startColIdx = ci;
      }

      let cellsModified = 0;
      const changes = [];
      matrix.forEach((rowData, ri) => {
        const targetRow = visRows[startRowIdx + ri];
        if (!targetRow) return;
        rowData.forEach((cellVal, ci) => {
          const targetCol = editCols[startColIdx + ci];
          if (!targetCol) return;
          const old = targetRow[targetCol._id];
          targetRow[targetCol._id] = cellVal;
          if (!targetRow._dirty) targetRow._dirty = {};
          targetRow._dirty[targetCol._id] = true;
          changes.push({
            row: this._cleanRow(targetRow),
            field: targetCol._id,
            oldValue: old,
            newValue: cellVal,
          });
          cellsModified++;
        });
      });
      if (cellsModified) {
        changes.forEach(
          (c) =>
            this._opts.onCellValueChanged && this._opts.onCellValueChanged(c),
        );
        this._renderBody();
        this._toast(
          `✓ ${cellsModified} cellule${cellsModified > 1 ? "s" : ""} collée${cellsModified > 1 ? "s" : ""} depuis le presse-papier`,
        );
        // Flash animation on pasted cells
        requestAnimationFrame(() => {
          const affectedRows = new Set(changes.map((c) => c.row._ngId || ""));
          affectedRows.forEach((ngId) => {
            if (!ngId) return;
            const tr = this._tbodyEl.querySelector(
              `tr[data-ng-row-id="${ngId}"]`,
            );
            if (!tr) return;
            changes
              .filter((c) => (c.row._ngId || "") === ngId)
              .forEach((ch) => {
                const cell = tr.querySelector(`td[data-ng-col="${ch.field}"]`);
                if (cell) {
                  cell.classList.remove("ng-pasted");
                  void cell.offsetWidth;
                  cell.classList.add("ng-pasted");
                  setTimeout(() => cell.classList.remove("ng-pasted"), 650);
                }
              });
          });
        });
      }
    }

    // ────────────────────────────────────────────────────────
    //  FEATURE: BULK EDIT MODAL
    // ────────────────────────────────────────────────────────
    _buildBulkModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);">
          <div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;">
            <h5 class="modal-title" style="font-size:14px;font-weight:600;">✏️ Édition en masse</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="padding:20px 22px;">
            <div class="ng-bsm-section-title" style="margin-bottom:6px;">Lignes sélectionnées</div>
            <div class="ng-bulk-count" style="font-size:22px;font-weight:700;color:#1c2e4a;margin-bottom:16px;">0 lignes</div>
            <div class="ng-bsm-section-title" style="margin-bottom:6px;">Champ à modifier</div>
            <select class="ng-bsm-input ng-bulk-field-sel" style="margin-bottom:14px;cursor:pointer;"></select>
            <div class="ng-bsm-section-title" style="margin-bottom:6px;">Nouvelle valeur</div>
            <input type="text" class="ng-bsm-input ng-bulk-value-inp" placeholder="Valeur à appliquer…">
            <div class="ng-bulk-preview" style="margin-top:12px;font-size:11px;color:#8090a8;"></div>
          </div>
          <div class="modal-footer" style="border-top:1px solid #dee2e6;padding:12px 18px;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annuler</button>
            <button type="button" class="btn btn-sm ng-bulk-apply-btn" style="background:#1e6dc5;color:#fff;border:none;">Appliquer à toutes</button>
          </div>
        </div>
      </div>`;

      const fieldSel = div.querySelector(".ng-bulk-field-sel");
      const valueInp = div.querySelector(".ng-bulk-value-inp");
      const applyBtn = div.querySelector(".ng-bulk-apply-btn");
      const preview = div.querySelector(".ng-bulk-preview");

      // Refresh UI when modal opens
      div.addEventListener("show.bs.modal", () => {
        const sel = this._rows.filter((r) => r._selected);
        div.querySelector(".ng-bulk-count").textContent =
          `${sel.length} ligne${sel.length > 1 ? "s" : ""}`;
        fieldSel.innerHTML = "";
        this._cols
          .filter((c) => c._editable && !["sel", "drag", "pin"].includes(c._id))
          .forEach((col) => {
            const o = document.createElement("option");
            o.value = col._id;
            o.textContent = col._label;
            fieldSel.appendChild(o);
          });
        valueInp.value = "";
        preview.textContent = "";
        // Adjust input type based on col type
        const updateType = () => {
          const col = this._cols.find((c) => c._id === fieldSel.value);
          valueInp.type =
            col?._type === "num"
              ? "number"
              : col?._type === "date"
                ? "date"
                : "text";
          preview.textContent = `→ "${valueInp.value || "…"}" sera appliqué à ${sel.length} ligne${sel.length > 1 ? "s" : ""}`;
        };
        fieldSel.addEventListener("change", updateType);
        valueInp.addEventListener("input", () => {
          const sel2 = this._rows.filter((r) => r._selected);
          preview.textContent = `→ "${valueInp.value || "…"}" sera appliqué à ${sel2.length} ligne${sel2.length > 1 ? "s" : ""}`;
        });
        updateType();
      });

      applyBtn.addEventListener("click", () => {
        const colId = fieldSel.value,
          newVal = valueInp.value;
        if (!colId) return;
        const col = this._cols.find((c) => c._id === colId);
        const sel = this._rows.filter((r) => r._selected);
        let count = 0;
        sel.forEach((row) => {
          const old = row[colId];
          row[colId] = newVal;
          if (!row._dirty) row._dirty = {};
          row._dirty[colId] = true;
          this._opts.onCellValueChanged &&
            this._opts.onCellValueChanged({
              row: this._cleanRow(row),
              field: colId,
              oldValue: old,
              newValue: newVal,
            });
          count++;
        });
        this._renderBody();
        this._toast(
          `✓ "${col?._label || colId}" mis à jour sur ${count} ligne${count > 1 ? "s" : ""}`,
        );
        console.group(`✏️ NexaGrid — Édition en masse`);
        console.log(
          "Champ:",
          col?._label || colId,
          "| Valeur:",
          newVal,
          "| Lignes modifiées:",
          count,
        );
        console.log(
          "Lignes:",
          sel.map((r) => this._cleanRow(r)),
        );
        console.groupEnd();
        const modal = bootstrap.Modal.getInstance(div);
        if (modal) modal.hide();
      });

      return div;
    }

    _openBulkModal() {
      const sel = this._rows.filter((r) => r._selected);
      if (!sel.length) {
        this._toast("Sélectionnez au moins une ligne (Ctrl+clic)");
        return;
      }
      const open = () =>
        bootstrap.Modal.getOrCreateInstance(this._bulkModalEl).show();
      if (typeof bootstrap !== "undefined") open();
      else {
        const t = setInterval(() => {
          if (typeof bootstrap !== "undefined") {
            clearInterval(t);
            open();
          }
        }, 80);
      }
    }

    /** Public API: bulk set a field on selected or all rows */
    bulkEdit(field, value, selectionOnly = true) {
      const rows = selectionOnly
        ? this._rows.filter((r) => r._selected)
        : this._rows;
      const col = this._cols.find((c) => c._id === field);
      rows.forEach((row) => {
        const old = row[field];
        row[field] = value;
        if (!row._dirty) row._dirty = {};
        row._dirty[field] = true;
        this._opts.onCellValueChanged &&
          this._opts.onCellValueChanged({
            row: this._cleanRow(row),
            field,
            oldValue: old,
            newValue: value,
          });
      });
      this._renderBody();
      this._toast(
        `✓ "${col?._label || field}" → "${value}" (${rows.length} lignes)`,
      );
      return this;
    }

    // ────────────────────────────────────────────────────────
    //  FEATURE: COMPARE ROWS MODAL
    // ────────────────────────────────────────────────────────
    _buildCompareModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);">
          <div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;">
            <h5 class="modal-title" style="font-size:14px;font-weight:600;">⚖️ Comparaison de lignes</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body ng-compare-body" style="padding:0;overflow:auto;max-height:70vh;"></div>
          <div class="modal-footer" style="border-top:1px solid #dee2e6;padding:10px 18px;display:flex;align-items:center;gap:12px;">
            <label style="font-size:11px;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" class="ng-compare-diff-only" checked>
              <span>Afficher seulement les différences</span>
            </label>
            <button type="button" class="btn btn-sm btn-secondary ms-auto" data-bs-dismiss="modal">Fermer</button>
          </div>
        </div>
      </div>`;

      const diffOnly = div.querySelector(".ng-compare-diff-only");
      const renderTable = () => {
        const sel = this._rows.filter((r) => r._selected).slice(0, 6); // max 6 rows
        if (sel.length < 2) {
          div.querySelector(".ng-compare-body").innerHTML =
            '<div style="padding:30px;text-align:center;color:#8090a8;">Sélectionnez 2 à 6 lignes à comparer (Ctrl+clic)</div>';
          return;
        }
        const cols = this._cols.filter(
          (c) => !["sel", "drag", "pin"].includes(c._id) && c._visible,
        );
        const onlyDiff = diffOnly.checked;
        let html =
          '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:inherit;">';
        // Header
        html +=
          '<thead><tr><th style="background:#1c2e4a;color:#e8edf5;padding:8px 12px;font-size:11px;font-weight:600;text-align:left;position:sticky;top:0;z-index:2;white-space:nowrap;min-width:110px;">Champ</th>';
        sel.forEach((row, i) => {
          const ref = row[cols[0]?._id] || `Ligne ${i + 1}`;
          html += `<th style="background:#243a5e;color:#e8edf5;padding:8px 12px;font-size:11px;font-weight:600;text-align:center;position:sticky;top:0;z-index:2;white-space:nowrap;">${ref}</th>`;
        });
        html += "</tr></thead><tbody>";
        // Rows
        cols.forEach((col, ci) => {
          const vals = sel.map((row) => {
            if (typeof col._formula === "function") {
              try {
                return col._formula(row);
              } catch {
                return "#ERR";
              }
            }
            return row[col._id] ?? "—";
          });
          const allSame = vals.every((v) => String(v) === String(vals[0]));
          if (onlyDiff && allSame) return;
          const bg = ci % 2 === 0 ? "#fff" : "#f8f9fb";
          const diffBg = !allSame ? "rgba(255,200,0,0.10)" : bg;
          html += `<tr style="background:${diffBg};">`;
          html += `<td style="padding:7px 12px;border-bottom:1px solid #eee;color:#5a6a80;font-weight:600;white-space:nowrap;">${col._label}</td>`;
          vals.forEach((v) => {
            const n = parseFloat(
              String(v).replace(/\s/g, "").replace(",", "."),
            );
            const color = !isNaN(n)
              ? n < 0
                ? "#c0392b"
                : n > 0
                  ? "#1a6e3d"
                  : ""
              : "";
            const bold = !allSame ? "font-weight:700;" : "";
            html += `<td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:center;${bold}${color ? `color:${color};` : ""}">${v}</td>`;
          });
          html += "</tr>";
        });
        html += "</tbody></table>";
        // Summary
        const diffCount = cols.filter((col) => {
          const vals = sel.map((r) => String(r[col._id] ?? ""));
          return !vals.every((v) => v === vals[0]);
        }).length;
        html += `<div style="padding:10px 14px;background:#f0f4fa;font-size:11px;color:#5a6a80;border-top:1px solid #d0d5de;">
        <b>${diffCount}</b> champ${diffCount > 1 ? "s" : ""} différent${diffCount > 1 ? "s" : ""} sur <b>${cols.length}</b> — <b>${sel.length}</b> lignes comparées
      </div>`;
        div.querySelector(".ng-compare-body").innerHTML = html;
      };

      div.addEventListener("show.bs.modal", renderTable);
      diffOnly.addEventListener("change", renderTable);
      return div;
    }

    _openCompareModal() {
      const sel = this._rows.filter((r) => r._selected);
      if (sel.length < 2) {
        this._toast("Sélectionnez au moins 2 lignes (Ctrl+clic)");
        return;
      }
      const open = () =>
        bootstrap.Modal.getOrCreateInstance(this._compareModalEl).show();
      if (typeof bootstrap !== "undefined") open();
      else {
        const t = setInterval(() => {
          if (typeof bootstrap !== "undefined") {
            clearInterval(t);
            open();
          }
        }, 80);
      }
    }

    /** Public API: open compare modal */
    compareRows() {
      this._openCompareModal();
      return this;
    }

    // ────────────────────────────────────────────────────────
    //  TOAST & TOOLTIP
    // ────────────────────────────────────────────────────────
    _toast(msg) {
      this._toastEl.textContent = msg;
      this._toastEl.classList.add("show");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(
        () => this._toastEl.classList.remove("show"),
        2400,
      );
    }
    _showTooltip(e, msg) {
      this._tooltipEl.textContent = msg;
      this._tooltipEl.style.display = "block";
      this._tooltipEl.style.left = e.clientX + 12 + "px";
      this._tooltipEl.style.top = e.clientY - 4 + "px";
    }
    _hideTooltip() {
      this._tooltipEl.style.display = "none";
    }

    // ────────────────────────────────────────────────────────
    //  HELPERS
    // ────────────────────────────────────────────────────────
    _fmtNum(n, dec = 2) {
      return Number(n).toLocaleString("fr-FR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    }
    _newId() {
      return "r" + Math.random().toString(36).substr(2, 9);
    }
    _prepareRow(raw, depth = 0, parentId = null) {
      const row = Object.assign({}, raw);
      delete row[this._opts.treeChildField || "children"];
      if (!row._ngId) row._ngId = this._newId();
      if (row._pinned === undefined) row._pinned = false;
      if (row._selected === undefined) row._selected = false;
      if (row._detailOpen === undefined) row._detailOpen = false;
      row._depth = depth;
      row._parentId = parentId;
      row._expanded = raw._expanded !== undefined ? raw._expanded : true;
      return row;
    }
    _cleanRow(row) {
      const {
        _ngId,
        _pinned,
        _selected,
        _detailOpen,
        _dirty,
        _depth,
        _parentId,
        _expanded,
        _hasChildren,
        _rawChildren,
        ...rest
      } = row;
      return rest;
    }

    // ────────────────────────────────────────────────────────
    //  PUBLIC API
    // ────────────────────────────────────────────────────────
    setData(data = []) {
      this._rawRows = data;
      this._rows = []; // reset before flatten so stale states don't leak into fresh data
      this._rows = this._flattenTree(data);
      this._loadMoreLocked = false;
      this._render();
      this._opts.onDataLoaded &&
        this._opts.onDataLoaded(this._rows.map((r) => this._cleanRow(r)));
      return this;
    }
    setColumns(cols) {
      this._opts.columns = cols;
      this._normalizeColumns();
      this._render();
      return this;
    }
    appendData(data = []) {
      if (!data.length) return this;
      const newRows = this._flattenTree(data);
      this._rows.push(...newRows);
      this._rawRows.push(...data);
      this._loadMoreLocked = false;
      this._renderBody();
      this._updatePagination();
      return this;
    }
    addRow(data, index) {
      const row = this._prepareRow(data);
      if (index !== undefined) this._rows.splice(index, 0, row);
      else this._rows.push(row);
      this._render();
      return row;
    }
    deleteRow(pred) {
      if (Array.isArray(pred))
        this._rows = this._rows.filter((r) => !pred.includes(r._ngId));
      else if (typeof pred === "function")
        this._rows = this._rows.filter((r) => !pred(r));
      else this._rows = this._rows.filter((r) => r._ngId !== pred);
      this._render();
      return this;
    }
    deleteSelectedRows() {
      this._rows = this._rows.filter((r) => !r._selected);
      this._render();
      return this;
    }
    updateRow(pred, data) {
      const match = typeof pred === "function" ? pred : (r) => r._ngId === pred;
      this._rows.forEach((r) => {
        if (match(r)) Object.assign(r, data);
      });
      this._renderBody();
      return this;
    }
    getAllData() {
      return this._rows.map((r) => this._cleanRow(r));
    }
    getData() {
      return this.getAllData();
    }
    getFilteredData() {
      return this._applyFilters(
        this._applySorts(this._rows.filter((r) => !r._pinned)),
      ).map((r) => this._cleanRow(r));
    }
    getSelectedRows() {
      return this._rows
        .filter((r) => r._selected)
        .map((r) => this._cleanRow(r));
    }
    getDirtyRows() {
      return this._rows
        .filter((r) => r._dirty && Object.keys(r._dirty).length)
        .map((r) => ({
          ...this._cleanRow(r),
          _dirtyFields: Object.keys(r._dirty),
        }));
    }
    clearDirty() {
      this._rows.forEach((r) => delete r._dirty);
      this._renderBody();
      return this;
    }
    getTotalCount() {
      return this._serverTotal || this._rows.length;
    }
    setTotalCount(n) {
      this._serverTotal = n;
      this._updatePagination();
      return this;
    }
    selectAll() {
      this._getVisibleRows().forEach((r) => (r._selected = true));
      this._updateStatus();
      this._renderBody();
      return this;
    }
    deselectAll() {
      this._rows.forEach((r) => (r._selected = false));
      this._updateStatus();
      this._renderBody();
      return this;
    }
    selectRow(id) {
      const r = this._rows.find((r) => r._ngId === id);
      if (r) r._selected = true;
      this._updateStatus();
      this._renderBody();
      return this;
    }
    deselectRow(id) {
      const r = this._rows.find((r) => r._ngId === id);
      if (r) r._selected = false;
      this._updateStatus();
      this._renderBody();
      return this;
    }
    setFilter(field, value, opts = {}) {
      this._filters[field] = Object.assign(
        { type: opts.type || "text", value },
        opts,
      );
      this._renderBody();
      return this;
    }
    clearFilters() {
      this._filters = {};
      this._buildHeader();
      this._renderBody();
      return this;
    }
    getFilters() {
      return { ...this._filters };
    }
    setSort(field, dir = "asc") {
      this._sorts = [{ _col: field, _dir: dir }];
      this._render();
      return this;
    }
    addSort(field, dir = "asc") {
      this._sorts = this._sorts.filter((s) => s._col !== field);
      this._sorts.push({ _col: field, _dir: dir });
      this._render();
      return this;
    }
    clearSort() {
      this._sorts = [];
      this._render();
      return this;
    }
    getSort() {
      return this._sorts.map((s) => ({ field: s._col, dir: s._dir }));
    }
    showColumn(field) {
      const c = this._cols.find((c) => c._id === field);
      if (c) {
        c._visible = true;
        this._render();
      }
      return this;
    }
    hideColumn(field) {
      const c = this._cols.find((c) => c._id === field);
      if (c) {
        c._visible = false;
        this._render();
      }
      return this;
    }
    setColumnWidth(field, w) {
      const c = this._cols.find((c) => c._id === field);
      if (c) {
        c._width = w;
        this._render();
      }
      return this;
    }
    setColumnPinned(field, side) {
      const c = this._cols.find((c) => c._id === field);
      if (c) {
        c._frozen = !!side;
        this._render();
      }
      return this;
    }
    getColumnDefs() {
      return this._cols
        .filter((c) => !["sel", "drag", "pin"].includes(c._id))
        .map((c) => c._raw);
    }
    getCellValue(rowId, field) {
      const r = this._rows.find((r) => r._ngId === rowId);
      return r ? r[field] : undefined;
    }
    setCellValue(rowId, field, value) {
      const r = this._rows.find((r) => r._ngId === rowId);
      if (r) {
        r[field] = value;
        if (!r._dirty) r._dirty = {};
        r._dirty[field] = true;
        this._renderBody();
      }
      return this;
    }
    getTotals(fields) {
      const rows = this._getVisibleRows();
      const cols = fields
        ? this._cols.filter((c) => fields.includes(c._id))
        : this._cols.filter((c) => c._aggFunc === "sum");
      const res = {};
      cols.forEach((c) => {
        const ns = rows.map((r) => parseFloat(r[c._id]) || 0);
        res[c._id] = {
          sum: ns.reduce((a, b) => a + b, 0),
          avg: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0,
          min: Math.min(...ns),
          max: Math.max(...ns),
          count: ns.length,
        };
      });
      return res;
    }
    getTotal(field) {
      return this._getVisibleRows().reduce(
        (s, r) => s + (parseFloat(r[field]) || 0),
        0,
      );
    }
    exportCSV(filename, selectionOnly) {
      const rows = selectionOnly
        ? this._rows.filter((r) => r._selected)
        : this._applyFilters(this._applySorts(this._rows));
      const cols = this._cols.filter(
        (c) => c._visible && !["sel", "drag", "pin"].includes(c._id),
      );
      const csv =
        "\uFEFF" +
        cols.map((c) => `"${c._label}"`).join(",") +
        "\n" +
        rows
          .map((r) => cols.map((c) => `"${r[c._id] ?? ""}"`).join(","))
          .join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = (filename || "nexagrid-export") + ".csv";
      a.click();
      this._toast("CSV téléchargé");
      return this;
    }
    exportJSON(filename) {
      const a = document.createElement("a");
      a.href =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(this.getAllData(), null, 2));
      a.download = (filename || "nexagrid-export") + ".json";
      a.click();
      this._toast("JSON téléchargé");
      return this;
    }
    copySelected() {
      const sel = this._rows.filter((r) => r._selected);
      if (!sel.length) return;
      const cols = this._cols.filter(
        (c) => c._visible && !["sel", "drag", "pin"].includes(c._id),
      );
      const txt = [
        cols.map((c) => c._label).join("\t"),
        ...sel.map((r) => cols.map((c) => r[c._id] ?? "").join("\t")),
      ].join("\n");
      navigator.clipboard
        ?.writeText(txt)
        .then(() => this._toast("Copié dans le presse-papier"));
      return this;
    }
    saveView(name) {
      this._views[name] = {
        filters: JSON.parse(JSON.stringify(this._filters)),
        sorts: [...this._sorts],
        groupEnabled: this._groupEnabled,
        groupByField: this._groupByField,
        cfEnabled: this._cfEnabled,
        colState: this._cols.map((c) => ({
          _id: c._id,
          _visible: c._visible,
          _width: c._width,
          _frozen: c._frozen,
        })),
      };
      return this;
    }
    loadView(name) {
      const v = this._views[name];
      if (!v) return this;
      this._filters = JSON.parse(JSON.stringify(v.filters));
      this._sorts = [...v.sorts];
      this._groupEnabled = v.groupEnabled;
      this._groupByField = v.groupByField;
      this._cfEnabled = v.cfEnabled;
      v.colState.forEach((cs) => {
        const c = this._cols.find((c) => c._id === cs._id);
        if (c) Object.assign(c, cs);
      });
      this._render();
      this._toast(`Vue "${name}" chargée`);
      return this;
    }
    getViews() {
      return Object.keys(this._views);
    }
    setGroupBy(field) {
      this._groupByField = field;
      this._groupEnabled = !!field;
      this._renderBody();
      return this;
    }
    clearGroupBy() {
      this._groupEnabled = false;
      this._groupByField = null;
      this._renderBody();
      return this;
    }
    setTheme(theme) {
      const themes = {
        dark: {
          "--ng-bg": "#1a1f2e",
          "--ng-surface": "#222838",
          "--ng-header-bg": "#111827",
          "--ng-header-bg2": "#1c2537",
          "--ng-row-even": "#222838",
          "--ng-row-odd": "#1f2535",
          "--ng-row-hover": "#2a3348",
          "--ng-row-selected": "#1e3a5f",
          "--ng-text": "#c8d8ef",
          "--ng-text-muted": "#7a90b0",
          "--ng-border": "#2f3d54",
          "--ng-border-strong": "#3a4e6a",
          "--ng-filter-bg": "#1e2840",
          "--ng-toolbar-bg": "#111827",
          "--ng-status-bg": "#111827",
        },
        compact: { "--ng-row-h": "20px", "--ng-header-h": "24px" },
        spreadsheet: {
          "--ng-header-bg": "#217346",
          "--ng-header-bg2": "#217346",
          "--ng-accent": "#217346",
          "--ng-toolbar-bg": "#217346",
        },
      };
      Object.entries(themes[theme] || {}).forEach(([k, v]) =>
        this._el.style.setProperty(k, v),
      );
      return this;
    }
    showLoader(text = "Chargement…") {
      this._loadingEl.querySelector("span").textContent = text;
      this._loadingEl.classList.add("visible");
      return this;
    }
    hideLoader() {
      this._loadingEl.classList.remove("visible");
      return this;
    }
    refresh() {
      this._render();
      return this;
    }
    clearAll() {
      this._filters = {};
      this._sorts = [];
      if (this._searchEl) this._searchEl.value = "";
      this._rows.forEach((r) => {
        r._selected = false;
        r._pinned = false;
        r._detailOpen = false;
      });
      this._loadMoreMsg = "";
      this._render();
      this._toast("Réinitialisé");
      return this;
    }
    destroy() {
      Object.keys(this._activeCharts).forEach((id) =>
        this._activeCharts[id].destroy(),
      );
      if (this._sentinelObserver) this._sentinelObserver.disconnect();
      [
        this._ctxMenuEl,
        this._tooltipEl,
        this._toastEl,
        this._chartOverlay,
        this._viewsPanelEl,
        this._viewsBsModalEl,
        this._bulkModalEl,
        this._compareModalEl,
      ].forEach((el) => {
        if (el?.parentNode) el.parentNode.removeChild(el);
      });
      this._el.innerHTML = "";
      this._el.classList.remove("ng-container");
    }
    static createGrid(element, options) {
      return new NexaGrid(element, options);
    }
  }

  if (typeof module !== "undefined" && module.exports)
    module.exports = NexaGrid;
  else global.NexaGrid = NexaGrid;
})(typeof window !== "undefined" ? window : this);
