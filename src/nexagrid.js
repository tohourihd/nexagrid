/*!
 * NexaGrid v1.0 — Professional Data Grid Library
 * Dual-panel frozen scroll · ApexCharts · typed edit validation
 * row-count selector · inline edit overlay · server-side filter
 * tree styles · formula eager/lazy mode
 * License: MIT
 */
(function (global) {
  "use strict";

  const SYS = ["sel", "drag", "pin"];

  class NexaGrid {
    // ─────────────────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────────────────
    constructor(selector, options = {}) {
      this._opts = Object.assign({}, NexaGrid.defaults, options);
      this._uid = "ng_" + Math.random().toString(36).substr(2, 9);

      this._rawRows = [];
      this._rows = [];
      this._filters = {};
      this._sorts = [];
      this._cols = [];
      this._views = {};

      this._cfEnabled = false;
      this._groupEnabled = false;
      this._groupByField = this._opts.groupBy || null;
      this._filtersVis = this._opts.showFilters !== false;
      this._layout = this._opts.layout || "fitDataFill";
      this._pageSize = this._opts.pageSize || 25;

      this._lastClickIdx = null; // kept for compat
      this._lastClickRowId = null; // stable anchor for range selection
      this._dragSrc = null;
      this._colDragSrc = null;
      this._ctxRow = null;
      this._ctxCol = null;
      this._activeCharts = {};
      this._toastTimer = null;
      this._focusedCell = null;
      this._editOverlay = null;

      this._serverTotal = this._opts.totalCount || 0;
      this._loadMoreLocked = false;
      this._loadMoreMsg = "";
      this._currentPage = 0; // AG Grid-style pagination

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
        treeStyle: "default", // 'default' | 'lines' | 'folder'
        formulaMode: "lazy", // 'lazy' = compute on render | 'eager' = compute upfront
        serverSideFilter: false, // if true, onFilterChanged fires instead of client filter
        paginationPosition: "bottom", // 'top' | 'bottom' | 'both' | false
        pageSize: 25, // rows shown per page selector
        totalCount: 0,
        onLoadMore: null,
        toolbarHidden: [], // ['filters','group','cf','columns','views','chart','csv','json','search','reset']
        contextMenuHidden: [], // ['pin','detail','edit','bulkEdit','compare','chart','copy','selectAll','sortAsc','sortDesc','freezeCol','hideCol','deleteRow']
      };
    }

    // ─────────────────────────────────────────────────────────
    //  DEPS — ApexCharts + Bootstrap
    // ─────────────────────────────────────────────────────────
    _injectDeps(cb) {
      let pending = 0;
      const done = () => {
        if (--pending <= 0) cb();
      };

      // ApexCharts CSS
      if (!document.querySelector("#ng-apex-css")) {
        const l = document.createElement("link");
        l.id = "ng-apex-css";
        l.rel = "stylesheet";
        l.href =
          "https://cdn.jsdelivr.net/npm/apexcharts@3.45.2/dist/apexcharts.min.css";
        document.head.appendChild(l);
      }
      // ApexCharts JS
      if (
        typeof ApexCharts === "undefined" &&
        !document.querySelector("#ng-apex-js")
      ) {
        pending++;
        const s = document.createElement("script");
        s.id = "ng-apex-js";
        s.src =
          "https://cdn.jsdelivr.net/npm/apexcharts@3.45.2/dist/apexcharts.min.js";
        s.onload = done;
        s.onerror = done;
        document.head.appendChild(s);
      }
      // Bootstrap CSS
      if (!document.querySelector("#ng-bs-css")) {
        const l = document.createElement("link");
        l.id = "ng-bs-css";
        l.rel = "stylesheet";
        l.href =
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
        document.head.insertBefore(l, document.head.firstChild);
      }
      // Bootstrap JS
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

    // ─────────────────────────────────────────────────────────
    //  COLUMNS
    // ─────────────────────────────────────────────────────────
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
          _formula: c.formula || null,
          _badgeColors: c.badgeColors || null,
          _decimals: c.decimals !== undefined ? c.decimals : 2,
          _raw: c,
        });
      });
    }

    _resolveType(t) {
      if (!t) return "text";
      const m = {
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
      return m[String(t).toLowerCase()] || String(t).toLowerCase();
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

    // ─────────────────────────────────────────────────────────
    //  TREE DATA
    // ─────────────────────────────────────────────────────────
    _flattenTree(rows, depth = 0, parentId = null) {
      const result = [],
        cf = this._opts.treeChildField || "children";
      rows.forEach((raw) => {
        if (!raw._ngId) raw._ngId = this._newId();
        const row = this._prepareRow(raw, depth, parentId);
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
      const ns = !row._expanded;
      this._patchRawExpanded(row._ngId, ns, this._rawRows);
      this._rows = this._flattenTree(this._rawRows);
      this._renderBody();
    }

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

    // ─────────────────────────────────────────────────────────
    //  FORMULA — eager mode pre-computation
    // ─────────────────────────────────────────────────────────
    _applyFormulasEager() {
      if (this._opts.formulaMode !== "eager") return;
      const fCols = this._cols.filter((c) => typeof c._formula === "function");
      if (!fCols.length) return;
      this._rows.forEach((row) => {
        fCols.forEach((col) => {
          try {
            row["__f_" + col._id] = col._formula(row);
          } catch {
            row["__f_" + col._id] = "#ERR";
          }
        });
      });
    }

    // ─────────────────────────────────────────────────────────
    //  LAYOUT
    // ─────────────────────────────────────────────────────────
    _applyLayout() {
      // Layout applies to right panel (non-frozen) only
      const tbl = this._rightTableEl || this._tableEl;
      if (!tbl) return;
      const mainCols = this._getVisibleCols().filter((c) => !c._frozen);
      const layout = this._layout;
      const avail = (this._rightPaneEl || this._scrollEl)?.clientWidth || 800;

      if (layout === "fitColumns") {
        tbl.style.tableLayout = "fixed";
        tbl.style.width = "100%";
        tbl.style.minWidth = "";
        const total = mainCols.reduce((s, c) => s + c._width, 0),
          scale = avail / total;
        mainCols.forEach((c) => {
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
        const total = mainCols.reduce((s, c) => s + c._width, 0);
        if (avail > total) {
          const lf = [...mainCols].reverse().find((c) => !SYS.includes(c._id));
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

    _getFrozenWidth() {
      return this._getVisibleCols()
        .filter((c) => c._frozen)
        .reduce((s, c) => s + c._width, 0);
    }

    // ─────────────────────────────────────────────────────────
    //  DOM CONSTRUCTION
    // ─────────────────────────────────────────────────────────
    _buildDOM() {
      this._el.innerHTML = "";
      this._el.classList.add("ng-container");

      if (
        this._opts.paginationPosition === "top" ||
        this._opts.paginationPosition === "both"
      ) {
        this._pagTopEl = this._buildPaginationBar("top");
        this._el.appendChild(this._pagTopEl);
      }
      if (this._opts.showToolbar !== false) {
        this._toolbarEl = this._buildToolbar();
        this._el.appendChild(this._toolbarEl);
      }

      this._wrapperEl = document.createElement("div");
      this._wrapperEl.className = "ng-wrapper";
      this._el.appendChild(this._wrapperEl);

      // ── Dual-panel body ─────────────────────────────────────
      const bodyWrap = document.createElement("div");
      bodyWrap.className = "ng-body-wrap";
      this._wrapperEl.appendChild(bodyWrap);

      // Left panel — frozen columns
      this._leftPaneEl = document.createElement("div");
      this._leftPaneEl.className = "ng-left-pane";
      bodyWrap.appendChild(this._leftPaneEl);

      this._leftTableEl = document.createElement("table");
      this._leftTableEl.className = "ng-table ng-table-frozen";
      this._leftPaneEl.appendChild(this._leftTableEl);

      this._leftTheadEl = document.createElement("thead");
      this._leftTheadEl.className = "ng-thead";
      this._leftTableEl.appendChild(this._leftTheadEl);

      this._leftPinnedEl = document.createElement("tbody");
      this._leftPinnedEl.className = "ng-pinned-section ng-tbody";
      this._leftTableEl.appendChild(this._leftPinnedEl);

      this._leftTbodyEl = document.createElement("tbody");
      this._leftTbodyEl.className = "ng-tbody";
      this._leftTableEl.appendChild(this._leftTbodyEl);

      this._leftAggEl = document.createElement("tfoot");
      this._leftAggEl.className = "ng-agg-row";
      this._leftTableEl.appendChild(this._leftAggEl);

      // Right panel — non-frozen scrollable columns
      this._rightPaneEl = document.createElement("div");
      this._rightPaneEl.className = "ng-right-pane";
      bodyWrap.appendChild(this._rightPaneEl);

      this._rightTableEl = document.createElement("table");
      this._rightTableEl.className = "ng-table ng-table-main";
      if (!this._filtersVis)
        this._rightTableEl.classList.add("ng-filters-hidden");
      this._rightPaneEl.appendChild(this._rightTableEl);

      this._rightTheadEl = document.createElement("thead");
      this._rightTheadEl.className = "ng-thead";
      this._rightTableEl.appendChild(this._rightTheadEl);

      this._rightPinnedEl = document.createElement("tbody");
      this._rightPinnedEl.className = "ng-pinned-section ng-tbody";
      this._rightTableEl.appendChild(this._rightPinnedEl);

      this._rightTbodyEl = document.createElement("tbody");
      this._rightTbodyEl.className = "ng-tbody";
      this._rightTableEl.appendChild(this._rightTbodyEl);

      this._rightAggEl = document.createElement("tfoot");
      this._rightAggEl.className = "ng-agg-row";
      this._rightTableEl.appendChild(this._rightAggEl);

      // Infinite scroll sentinel on right panel
      this._sentinelEl = document.createElement("div");
      this._sentinelEl.className = "ng-scroll-sentinel";
      this._rightPaneEl.appendChild(this._sentinelEl);
      this._setupInfiniteScroll();

      // Bidirectional vertical scroll sync between panels
      let _syncLock = false;
      this._rightPaneEl.addEventListener("scroll", () => {
        if (_syncLock) return;
        _syncLock = true;
        this._leftPaneEl.scrollTop = this._rightPaneEl.scrollTop;
        _syncLock = false;
      });
      this._leftPaneEl.addEventListener("scroll", () => {
        if (_syncLock) return;
        _syncLock = true;
        this._rightPaneEl.scrollTop = this._leftPaneEl.scrollTop;
        _syncLock = false;
      });

      // Loading overlay
      this._loadingEl = document.createElement("div");
      this._loadingEl.className = "ng-loading";
      this._loadingEl.innerHTML =
        '<div class="ng-spinner"></div><span>Chargement…</span>';
      this._wrapperEl.appendChild(this._loadingEl);

      // Col panel
      this._colPanelEl = this._buildColPanel();
      this._wrapperEl.appendChild(this._colPanelEl);

      if (this._opts.showStatus !== false) {
        this._statusEl = this._buildStatus();
        this._el.appendChild(this._statusEl);
      }
      if (
        !this._opts.paginationPosition ||
        this._opts.paginationPosition === "bottom" ||
        this._opts.paginationPosition === "both"
      ) {
        this._pagBotEl = this._buildPaginationBar("bottom");
        this._el.appendChild(this._pagBotEl);
      }

      // Document-level
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
      this._viewsPanelEl = this._buildViewsPanel();
      document.body.appendChild(this._viewsPanelEl);
      this._viewsBsModalEl = this._buildViewsBsModal();
      document.body.appendChild(this._viewsBsModalEl);
      this._bulkModalEl = this._buildBulkModal();
      document.body.appendChild(this._bulkModalEl);
      this._compareModalEl = this._buildCompareModal();
      document.body.appendChild(this._compareModalEl);
      this._splashEl = this._buildSplash();
      this._el.appendChild(this._splashEl);

      document.addEventListener("click", (e) => {
        if (!this._ctxMenuEl.contains(e.target))
          this._ctxMenuEl.classList.remove("visible");
        if (
          !this._viewsPanelEl.contains(e.target) &&
          !e.target.closest('[data-ng-btn="views"]')
        )
          this._viewsPanelEl.classList.remove("open");
      });
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "c") this.copySelected();
        if (e.key === "Escape" && this._editOverlay)
          (this._editOverlay.remove(), (this._editOverlay = null));
      });
      this._el.addEventListener("paste", (e) => this._handlePaste(e));
      this._el.setAttribute("tabindex", "0");
    }

    // ─────────────────────────────────────────────────────────
    //  INFINITE SCROLL
    // ─────────────────────────────────────────────────────────
    _setupInfiniteScroll() {
      if (!this._opts.onLoadMore) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !this._loadMoreLocked)
            this._triggerLoadMore();
        },
        { root: this._rightPaneEl, threshold: 0.1 },
      );
      obs.observe(this._sentinelEl);
      this._sentinelObserver = obs;
    }

    _triggerLoadMore() {
      if (this._loadMoreLocked) return;
      if (this._serverTotal > 0 && this._rows.length >= this._serverTotal)
        return;
      this._loadMoreLocked = true;
      const info = {
        loadedCount: this._rows.length,
        totalCount: this._serverTotal,
        page: Math.ceil(this._rows.length / (this._pageSize || 50)),
      };
      try {
        this._opts.onLoadMore(info, this);
      } catch (e) {
        console.error("NexaGrid onLoadMore:", e);
        this._loadMoreLocked = false;
      }
    }

    unlockLoadMore() {
      this._loadMoreLocked = false;
      return this;
    }

    // ─────────────────────────────────────────────────────────
    //  PAGINATION BAR — AG Grid style with prev/next
    // ─────────────────────────────────────────────────────────
    _buildPaginationBar(pos) {
      const bar = document.createElement("div");
      bar.className = `ng-pagination ng-pagination-${pos}`;

      // Info: "Showing X–Y of Z"
      const info = document.createElement("span");
      info.className = "ng-pag-info";

      // Page size selector
      const szWrap = document.createElement("div");
      szWrap.className = "ng-pag-selector";
      const szLbl = document.createElement("span");
      szLbl.textContent = "Lignes/page : ";
      const szSel = document.createElement("select");
      szSel.className = "ng-pag-sel";
      [10, 25, 50, 100, 250, 500].forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        if (n === this._pageSize) o.selected = true;
        szSel.appendChild(o);
      });
      const allOpt = document.createElement("option");
      allOpt.value = 9999999;
      allOpt.textContent = "Tout";
      szSel.appendChild(allOpt);
      szSel.addEventListener("change", () => {
        this._pageSize = parseInt(szSel.value);
        this._currentPage = 0;
        this._el.querySelectorAll(".ng-pag-sel").forEach((s) => {
          if (s !== szSel) s.value = szSel.value;
        });
        this._opts.onPageSizeChanged &&
          this._opts.onPageSizeChanged(this._pageSize, this);
        this._renderBody();
      });
      szWrap.appendChild(szLbl);
      szWrap.appendChild(szSel);

      // Nav buttons
      const nav = document.createElement("div");
      nav.className = "ng-pag-nav";
      const mkBtn = (lbl, title, fn) => {
        const b = document.createElement("button");
        b.className = "ng-pag-btn";
        b.textContent = lbl;
        b.title = title;
        b.addEventListener("click", fn);
        return b;
      };
      const btnFirst = mkBtn("«", "Première page", () => this._goPage(0));
      const btnPrev = mkBtn("‹", "Page précédente", () =>
        this._goPage(this._currentPage - 1),
      );
      const pageInfo = document.createElement("span");
      pageInfo.className = "ng-pag-page-info";
      const btnNext = mkBtn("›", "Page suivante", () =>
        this._goPage(this._currentPage + 1),
      );
      const btnLast = mkBtn("»", "Dernière page", () =>
        this._goPage(this._totalPages() - 1),
      );
      nav.appendChild(btnFirst);
      nav.appendChild(btnPrev);
      nav.appendChild(pageInfo);
      nav.appendChild(btnNext);
      nav.appendChild(btnLast);

      // Infinite scroll message
      const msgEl = document.createElement("div");
      msgEl.className = "ng-pag-msg";

      bar.appendChild(info);
      bar.appendChild(szWrap);
      bar.appendChild(nav);
      bar.appendChild(msgEl);
      bar._refs = {
        info,
        pageInfo,
        btnFirst,
        btnPrev,
        btnNext,
        btnLast,
        szSel,
        msgEl,
      };
      return bar;
    }

    _totalPages() {
      const all = this._getAllFilteredSorted().length;
      return Math.max(1, Math.ceil(all / this._pageSize));
    }

    _goPage(page) {
      const total = this._totalPages();
      this._currentPage = Math.max(0, Math.min(page, total - 1));
      this._renderBody();
    }

    _updatePagination() {
      const allRows = this._getAllFilteredSorted();
      const total = this._serverTotal > 0 ? this._serverTotal : allRows.length;
      const loaded = this._rows.length;
      const totalPg = this._totalPages();
      const start = this._currentPage * this._pageSize;
      const end = Math.min(start + this._pageSize, allRows.length);
      const isInfinite = !!this._opts.onLoadMore;

      [this._pagTopEl, this._pagBotEl].forEach((el) => {
        if (!el || !el._refs) return;
        const {
          info,
          pageInfo,
          btnFirst,
          btnPrev,
          btnNext,
          btnLast,
          szSel,
          msgEl,
        } = el._refs;

        if (isInfinite) {
          // Infinite scroll mode: show progress
          const pct =
            total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
          info.innerHTML = `<b>${loaded.toLocaleString("fr-FR")}</b> / <b>${total.toLocaleString("fr-FR")}</b> lignes`;
          pageInfo.textContent = "";
          [btnFirst, btnPrev, btnNext, btnLast].forEach(
            (b) => (b.style.display = "none"),
          );
        } else {
          // Page mode
          const showStart = allRows.length ? start + 1 : 0;
          const showEnd = Math.min(end, allRows.length);
          const showTotal = allRows.length;
          info.innerHTML = `Lignes <b>${showStart.toLocaleString("fr-FR")}–${showEnd.toLocaleString("fr-FR")}</b> sur <b>${showTotal.toLocaleString("fr-FR")}</b>`;
          pageInfo.innerHTML = `Page <b>${this._currentPage + 1}</b> / <b>${totalPg}</b>`;
          [btnFirst, btnPrev, btnNext, btnLast].forEach(
            (b) => (b.style.display = ""),
          );
          btnFirst.disabled = this._currentPage === 0;
          btnPrev.disabled = this._currentPage === 0;
          btnNext.disabled = this._currentPage >= totalPg - 1;
          btnLast.disabled = this._currentPage >= totalPg - 1;
          btnFirst.classList.toggle("disabled", this._currentPage === 0);
          btnPrev.classList.toggle("disabled", this._currentPage === 0);
          btnNext.classList.toggle(
            "disabled",
            this._currentPage >= totalPg - 1,
          );
          btnLast.classList.toggle(
            "disabled",
            this._currentPage >= totalPg - 1,
          );
        }
        msgEl.textContent = this._loadMoreMsg;
      });
    }

    setLoadMoreMessage(msg) {
      this._loadMoreMsg = msg || "";
      this._updatePagination();
      return this;
    }

    // ─────────────────────────────────────────────────────────
    //  TOOLBAR
    // ─────────────────────────────────────────────────────────
    _buildToolbar() {
      const tb = document.createElement("div");
      tb.className = "ng-toolbar";
      const sep = () => {
        const s = document.createElement("div");
        s.className = "ng-toolbar-sep";
        return s;
      };
      // hidden: array of button ids to hide, e.g. ['filters','group','cf','views','chart','csv','json','reset','search']
      const hidden = this._opts.toolbarHidden || [];
      const show = (id) => !hidden.includes(id);
      const btn = (icon, lbl, fn, key) => {
        const b = document.createElement("button");
        b.className = "ng-btn";
        b.innerHTML = `${icon} ${lbl}`;
        if (key) b.dataset.ngBtn = key;
        b.addEventListener("click", fn);
        return b;
      };

      const t = document.createElement("span");
      t.className = "ng-toolbar-title";
      t.innerHTML = `<span class="ng-toolbar-diamond"></span>${this._opts.title}`;
      tb.appendChild(t);

      const leftBtns = [];
      if (show("filters")) {
        const bF = btn("⚡", "Filtres", () => this.toggleFilters(), "filters");
        if (this._filtersVis) bF.classList.add("active");
        leftBtns.push(bF);
      }
      if (show("group"))
        leftBtns.push(
          btn("⊞", "Grouper", () => this.toggleGrouping(), "group"),
        );
      if (show("cf"))
        leftBtns.push(btn("★", "Format", () => this.toggleCF(), "cf"));
      if (leftBtns.length) {
        tb.appendChild(sep());
        leftBtns.forEach((b) => tb.appendChild(b));
      }

      const midBtns = [];
      if (show("columns"))
        midBtns.push(btn("▤", "Colonnes", () => this.toggleColPanel()));
      if (show("views")) {
        const bV = btn("◈", "Vues", () => this._toggleViewsPanel(), "views");
        midBtns.push(bV);
      }
      if (show("chart"))
        midBtns.push(btn("📊", "Graphes", () => this._openChartConfigModal()));
      if (midBtns.length) {
        tb.appendChild(sep());
        midBtns.forEach((b) => tb.appendChild(b));
      }

      const expBtns = [];
      if (show("csv")) expBtns.push(btn("⬇", "CSV", () => this.exportCSV()));
      if (show("json")) expBtns.push(btn("⬇", "JSON", () => this.exportJSON()));
      if (expBtns.length) {
        tb.appendChild(sep());
        expBtns.forEach((b) => tb.appendChild(b));
      }

      const r = document.createElement("div");
      r.className = "ng-toolbar-right";
      if (show("search")) {
        this._searchEl = document.createElement("input");
        this._searchEl.className = "ng-search";
        this._searchEl.placeholder = "🔍  Recherche…";
        this._searchEl.addEventListener("input", () => this._renderBody());
        r.appendChild(this._searchEl);
      }
      if (show("reset")) {
        const rb = document.createElement("button");
        rb.className = "ng-btn";
        rb.textContent = "↺ Réinit.";
        rb.addEventListener("click", () => this.clearAll());
        r.appendChild(rb);
      }
      if (r.children.length) tb.appendChild(r);
      return tb;
    }

    // ─────────────────────────────────────────────────────────
    //  VIEWS PANEL + BOOTSTRAP MODAL
    // ─────────────────────────────────────────────────────────
    _buildViewsPanel() {
      const p = document.createElement("div");
      p.className = "ng-views-panel";
      p.innerHTML = `<div class="ng-views-panel-header">◈ Vues sauvegardées</div><div class="ng-views-list"></div><div class="ng-views-panel-footer"><button class="ng-btn-create-view">✚ Créer une vue</button></div>`;
      p.querySelector(".ng-btn-create-view").addEventListener("click", () => {
        p.classList.remove("open");
        this._openViewsBsModal();
      });
      return p;
    }

    _toggleViewsPanel() {
      const p = this._viewsPanelEl;
      if (p.classList.contains("open")) {
        p.classList.remove("open");
        return;
      }
      const btn = this._toolbarEl?.querySelector('[data-ng-btn="views"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        p.style.top = r.bottom + 4 + "px";
        p.style.left = r.left + "px";
      }
      this._refreshViewsPanel();
      p.classList.add("open");
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
        const bL = document.createElement("button");
        bL.className = "ng-view-btn-load";
        bL.textContent = "Charger";
        bL.addEventListener("click", () => {
          this.loadView(name);
          this._viewsPanelEl.classList.remove("open");
        });
        const bD = document.createElement("button");
        bD.className = "ng-view-btn-del";
        bD.textContent = "✕";
        bD.addEventListener("click", () => {
          delete this._views[name];
          this._refreshViewsPanel();
          this._toast(`Vue "${name}" supprimée`);
        });
        item.appendChild(dot);
        item.appendChild(lbl);
        item.appendChild(bL);
        item.appendChild(bD);
        list.appendChild(item);
      });
    }

    _buildViewsBsModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);"><div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;"><h5 class="modal-title" style="font-size:14px;font-weight:600;">◈ Créer une vue</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body" style="padding:20px 22px;"><div class="ng-bsm-section-title">Nom de la vue</div><input type="text" class="ng-bsm-input" placeholder="Ex: Solde décroissant, Validés Q4…" maxlength="60"><div class="ng-bsm-summary" style="margin-top:14px;"></div></div><div class="modal-footer" style="border-top:1px solid #dee2e6;padding:12px 18px;gap:8px;"><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annuler</button><button type="button" class="btn btn-sm ng-bsm-save-btn" style="background:#1e6dc5;color:#fff;border:none;">Sauvegarder</button></div></div></div>`;
      const inp = div.querySelector(".ng-bsm-input"),
        saveBtn = div.querySelector(".ng-bsm-save-btn");
      saveBtn.addEventListener("click", () => {
        const name = inp.value.trim();
        if (!name) {
          inp.focus();
          inp.style.borderColor = "#c0392b";
          return;
        }
        inp.style.borderColor = "";
        this.saveView(name);
        console.group(`✅ NexaGrid — Vue créée : "${name}"`);
        console.log("Filtres:", JSON.parse(JSON.stringify(this._filters)));
        console.log(
          "Tri:",
          this._sorts.map((s) => ({ champ: s._col, dir: s._dir })),
        );
        console.log("Groupement:", {
          activé: this._groupEnabled,
          champ: this._groupByField,
        });
        console.log("CF:", this._cfEnabled);
        console.log(
          "Colonnes:",
          this._cols
            .filter((c) => !SYS.includes(c._id))
            .map((c) => ({
              id: c._id,
              visible: c._visible,
              largeur: c._width,
              gelée: c._frozen,
            })),
        );
        console.log("Snapshot:", this._views[name]);
        console.groupEnd();
        this._toast(`Vue "${name}" sauvegardée`);
        this._refreshViewsPanel();
        inp.value = "";
        bootstrap.Modal.getInstance(div)?.hide();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveBtn.click();
      });
      div.addEventListener("show.bs.modal", () => {
        inp.value = "";
        inp.style.borderColor = "";
        div.querySelector(".ng-bsm-summary").innerHTML =
          this._buildViewSummary();
      });
      return div;
    }

    _openViewsBsModal() {
      const open = () =>
        bootstrap.Modal.getOrCreateInstance(this._viewsBsModalEl).show();
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

    _buildViewSummary() {
      const parts = [];
      const fKeys = Object.keys(this._filters);
      if (fKeys.length) {
        const fs = fKeys
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
        parts.push(`<span class="ng-bsm-tag">⚡ ${fs}</span>`);
      }
      if (this._sorts.length)
        parts.push(
          `<span class="ng-bsm-tag">↕ ${this._sorts.map((s) => s._col + " " + s._dir).join(", ")}</span>`,
        );
      if (this._groupEnabled && this._groupByField)
        parts.push(`<span class="ng-bsm-tag">⊞ ${this._groupByField}</span>`);
      if (this._cfEnabled)
        parts.push(`<span class="ng-bsm-tag">★ Format conditionnel</span>`);
      return parts.length
        ? `<div class="ng-bsm-summary-title">Ce qui sera mémorisé</div><div class="ng-bsm-tags">${parts.join("")}</div>`
        : `<div class="ng-bsm-summary-empty">État actuel (aucun filtre ni tri actif)</div>`;
    }

    _buildStatus() {
      const b = document.createElement("div");
      b.className = "ng-status";
      b.innerHTML = `<span>Lignes : <b data-ng-st="rows">0</b></span><span class="ng-status-sep">|</span><span>Sél. : <b data-ng-st="sel">0</b></span><span class="ng-status-sep">|</span><span><b data-ng-st="sum">—</b></span><span class="ng-status-sep">|</span><span>Filtres : <b data-ng-st="filters">0</b></span><span class="ng-status-sep">|</span><span>Tri : <b data-ng-st="sort">—</b></span>`;
      return b;
    }

    _buildCtxMenu() {
      const m = document.createElement("div");
      m.className = "ng-ctx-menu";
      // contextMenuHidden: array of action ids to hide, e.g. ['pin','detail','deleteRow','chart']
      const hidden = this._opts.contextMenuHidden || [];
      const show = (id) => !hidden.includes(id);
      const item = (ctx, icon, label, cls = "") =>
        show(ctx)
          ? `<div class="ng-ctx-item${cls ? " " + cls : ""}" data-ng-ctx="${ctx}">${icon} ${label}</div>`
          : "";
      const sep = () => '<div class="ng-ctx-sep"></div>';
      const label = (t) => `<div class="ng-ctx-label">${t}</div>`;

      // Build sections — hide section label+sep if all items in group are hidden
      const rowItems = [
        item("pin", "📌", "Fixer / Libérer"),
        item("detail", "🔍", "Voir le détail"),
        item("edit", "✏️", "Éditer la cellule"),
      ].filter(Boolean);
      const selItems = [
        item("bulkEdit", "✏️", "Édition en masse…"),
        item("compare", "⚖️", "Comparer les lignes"),
        item("chart", "📊", "Graphiques"),
        item("copy", "📋", "Copier"),
        item("selectAll", "☑", "Sélectionner tout"),
      ].filter(Boolean);
      const colItems = [
        item("sortAsc", "↑", "Trier croissant"),
        item("sortDesc", "↓", "Trier décroissant"),
        item("freezeCol", "📌", "Fixer la colonne"),
        item("hideCol", "👁", "Masquer"),
      ].filter(Boolean);
      const dangerItems = [
        item("deleteRow", "🗑", "Supprimer la ligne", "danger"),
      ].filter(Boolean);

      let html = "";
      if (rowItems.length) html += label("Ligne") + rowItems.join("");
      if (selItems.length)
        html +=
          (rowItems.length ? sep() : "") +
          label("Sélection") +
          selItems.join("");
      if (colItems.length)
        html +=
          (rowItems.length || selItems.length ? sep() : "") +
          label("Colonne") +
          colItems.join("");
      if (dangerItems.length) html += sep() + dangerItems.join("");
      m.innerHTML = html;
      m.querySelectorAll("[data-ng-ctx]").forEach((it) =>
        it.addEventListener("click", (e) => {
          e.stopPropagation();
          this._ctxAction(it.dataset.ngCtx);
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

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    _render() {
      this._buildHeaders();
      this._renderBody();
      this._refreshColPanel();
      this._updateStatus();
      requestAnimationFrame(() => this._applyLayout());
    }

    _getVisibleCols() {
      return this._cols.filter((c) => c._visible);
    }
    _frozenCols() {
      return this._getVisibleCols().filter((c) => c._frozen);
    }
    _mainCols() {
      return this._getVisibleCols().filter((c) => !c._frozen);
    }

    _getVisibleRows() {
      let rows = this._opts.serverSideFilter
        ? this._applySorts(this._rows.filter((r) => !r._pinned))
        : this._applyFilters(
            this._applySorts(this._rows.filter((r) => !r._pinned)),
          );
      // AG Grid-style pagination — only when NOT using infinite scroll
      if (
        this._opts.paginationMode === "page" ||
        (!this._opts.onLoadMore && this._pageSize < 9999999)
      ) {
        const start = this._currentPage * this._pageSize;
        rows = rows.slice(start, start + this._pageSize);
      }
      return rows;
    }

    _getAllFilteredSorted() {
      return this._opts.serverSideFilter
        ? this._applySorts(this._rows.filter((r) => !r._pinned))
        : this._applyFilters(
            this._applySorts(this._rows.filter((r) => !r._pinned)),
          );
    }

    // ─────────────────────────────────────────────────────────
    //  FILTERS (with server-side option)
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  BUILD HEADERS (dual panel)
    // ─────────────────────────────────────────────────────────
    _buildHeaders() {
      this._leftTheadEl.innerHTML = "";
      this._rightTheadEl.innerHTML = "";
      const frozenCols = this._frozenCols(),
        mainCols = this._mainCols();
      const hasGroups = this._getVisibleCols().some((c) => c._group);

      // Update left panel width
      this._leftPaneEl.style.width = this._getFrozenWidth() + "px";

      // ── Group row
      if (hasGroups) {
        this._leftTheadEl.appendChild(this._buildGroupHeaderRow(frozenCols));
        this._rightTheadEl.appendChild(this._buildGroupHeaderRow(mainCols));
      }

      // ── Col header row
      const leftColRow = document.createElement("tr");
      frozenCols.forEach((col) =>
        leftColRow.appendChild(this._buildTh(col, frozenCols)),
      );
      this._leftTheadEl.appendChild(leftColRow);

      const rightColRow = document.createElement("tr");
      mainCols.forEach((col) =>
        rightColRow.appendChild(this._buildTh(col, mainCols)),
      );
      this._rightTheadEl.appendChild(rightColRow);

      // ── Filter row
      this._leftTheadEl.appendChild(this._buildFilterRow(frozenCols));
      this._rightTheadEl.appendChild(this._buildFilterRow(mainCols));
    }

    _buildGroupHeaderRow(cols) {
      const row = document.createElement("tr");
      let i = 0;
      while (i < cols.length) {
        const g = cols[i]._group;
        let span = 1;
        while (i + span < cols.length && cols[i + span]._group === g) span++;
        const th = document.createElement("th");
        th.colSpan = span;
        th.className = "ng-th-group";
        th.textContent = g;
        row.appendChild(th);
        i += span;
      }
      return row;
    }

    _buildTh(col, siblingCols) {
      const th = document.createElement("th");
      th.className = "ng-th";
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
        return th;
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
          this._opts.onSortChanged && this._opts.onSortChanged(this.getSort());
        });
      }

      if (!SYS.includes(col._type)) {
        const rh = document.createElement("div");
        rh.className = "ng-resize-handle";
        rh.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const sx = e.clientX,
            sw = col._width;
          rh.classList.add("dragging");
          const mv = (ev) => {
            col._width = Math.max(col._minWidth || 40, sw + (ev.clientX - sx));
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

      // Column drag & drop (non-frozen only)
      if (!col._frozen && !SYS.includes(col._type)) {
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
          document
            .querySelectorAll(".ng-col-drag-over")
            .forEach((x) => x.classList.remove("ng-col-drag-over"));
        });
        th.addEventListener("dragover", (e) => {
          if (!this._colDragSrc || this._colDragSrc === col._id) return;
          e.preventDefault();
          document
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
          const si = this._cols.findIndex((c) => c._id === this._colDragSrc),
            di = this._cols.findIndex((c) => c._id === col._id);
          if (si < 0 || di < 0) return;
          const [mv] = this._cols.splice(si, 1);
          this._cols.splice(di, 0, mv);
          this._colDragSrc = null;
          this._render();
          this._toast(`Colonne "${mv._label}" déplacée`);
        });
      }

      th.appendChild(inner);
      return th;
    }

    _buildFilterRow(cols) {
      const fr = document.createElement("tr");
      cols.forEach((col) => {
        const td = document.createElement("td");
        td.className = "ng-filter-cell";
        td.style.width = col._width + "px";
        td.style.maxWidth = col._width + "px";
        if (!col._noFilter && col._filterType !== "none")
          td.appendChild(this._buildFilterWidget(col));
        fr.appendChild(td);
      });
      return fr;
    }

    // ─────────────────────────────────────────────────────────
    //  FILTER WIDGETS
    // ─────────────────────────────────────────────────────────
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

        if (this._opts.serverSideFilter) {
          // Server-side: fire callback instead of client filter
          this._opts.onFilterChanged &&
            this._opts.onFilterChanged(this.getFilters(), this);
          return;
        }
        this._renderBody();
        this._opts.onFilterChanged &&
          this._opts.onFilterChanged(this.getFilters(), this);
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

    // ─────────────────────────────────────────────────────────
    //  RENDER BODY (dual panel)
    // ─────────────────────────────────────────────────────────
    _renderBody() {
      [
        this._leftPinnedEl,
        this._leftTbodyEl,
        this._leftAggEl,
        this._rightPinnedEl,
        this._rightTbodyEl,
        this._rightAggEl,
      ].forEach((el) => (el.innerHTML = ""));

      const frozenCols = this._frozenCols(),
        mainCols = this._mainCols();
      const isTree = this._hasTreeData();
      const pinned = this._rows.filter((r) => r._pinned);
      const visible = this._getVisibleRows();
      const grouped = this._applyGrouping(visible);

      // Header checkbox
      [this._leftTheadEl, this._rightTheadEl].forEach((thead) => {
        const cb = thead.querySelector("[data-ng-sel-all]");
        if (!cb) return;
        const sc = visible.filter((r) => r._selected).length;
        cb.className =
          "ng-sel-cb" +
          (sc === visible.length && visible.length > 0
            ? " checked"
            : sc > 0
              ? " indeterminate"
              : "");
      });

      // Pinned rows
      pinned.forEach((row) => {
        const [lTr, rTr] = this._buildRowPair(
          row,
          [],
          frozenCols,
          mainCols,
          isTree,
        );
        this._leftPinnedEl.appendChild(lTr);
        this._rightPinnedEl.appendChild(rTr);
        if (row._detailOpen) {
          const dc = this._buildDetailCells(row, frozenCols, mainCols);
          this._leftPinnedEl.appendChild(dc[0]);
          this._rightPinnedEl.appendChild(dc[1]);
        }
      });
      [this._leftPinnedEl, this._rightPinnedEl].forEach(
        (el) => (el.style.display = pinned.length ? "" : "none"),
      );

      // Main rows
      grouped.forEach((row) => {
        if (row.__group) {
          const [lG, rG] = this._buildGroupRowPair(row, frozenCols, mainCols);
          this._leftTbodyEl.appendChild(lG);
          this._rightTbodyEl.appendChild(rG);
        } else {
          const [lTr, rTr] = this._buildRowPair(
            row,
            visible,
            frozenCols,
            mainCols,
            isTree,
          );
          this._leftTbodyEl.appendChild(lTr);
          this._rightTbodyEl.appendChild(rTr);
          if (row._detailOpen) {
            const dc = this._buildDetailCells(row, frozenCols, mainCols);
            this._leftTbodyEl.appendChild(dc[0]);
            this._rightTbodyEl.appendChild(dc[1]);
          }
        }
      });

      // Aggregation row
      if (this._opts.showAggRow !== false) {
        const firstId = this._cols.find(
          (c) => !SYS.includes(c._id) && c._visible,
        )?._id;
        const mkAggTr = (cols) => {
          const tr = document.createElement("tr");
          cols.forEach((col) => {
            const td = document.createElement("td");
            td.className = "ng-td";
            td.style.cssText = `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:${col._width}px;max-width:${col._width}px;`;
            if (col._id === firstId) {
              td.textContent = "TOTAL";
              td.style.fontWeight = "700";
            } else if (col._aggFunc === "sum") {
              const sum = visible.reduce(
                (s, r) => s + (parseFloat(r[col._id]) || 0),
                0,
              );
              td.classList.add("num");
              td.textContent = this._fmtNum(sum, col._decimals);
              if (sum < 0) td.style.color = "var(--ng-negative)";
            }
            tr.appendChild(td);
          });
          return tr;
        };
        this._leftAggEl.appendChild(mkAggTr(frozenCols));
        this._rightAggEl.appendChild(mkAggTr(mainCols));
      }

      this._updateStatus();
      this._updatePagination();
      requestAnimationFrame(() => this._applyLayout());
    }

    // ─────────────────────────────────────────────────────────
    //  BUILD ROW PAIR (left + right)
    // ─────────────────────────────────────────────────────────
    _buildRowPair(row, visibleRows, frozenCols, mainCols, isTree) {
      const lTr = document.createElement("tr"),
        rTr = document.createElement("tr");
      lTr.dataset.ngRowId = row._ngId;
      rTr.dataset.ngRowId = row._ngId;
      if (row._selected) {
        lTr.classList.add("selected");
        rTr.classList.add("selected");
      }
      if (row._pinned) {
        lTr.classList.add("ng-pinned");
        rTr.classList.add("ng-pinned");
      }
      // Tree depth visual distinction
      if ((row._depth || 0) > 0) {
        const depthCls = "ng-tree-child ng-tree-depth-" + row._depth;
        lTr.classList.add(...depthCls.split(" "));
        rTr.classList.add(...depthCls.split(" "));
        if (!row._hasChildren) {
          lTr.classList.add("ng-tree-leaf");
          rTr.classList.add("ng-tree-leaf");
        }
      } else if (row._hasChildren) {
        lTr.classList.add("ng-tree-parent");
        rTr.classList.add("ng-tree-parent");
      }

      frozenCols.forEach((col) =>
        lTr.appendChild(
          this._buildCell(col, row[col._id], row, isTree, frozenCols, mainCols),
        ),
      );
      mainCols.forEach((col) =>
        rTr.appendChild(
          this._buildCell(col, row[col._id], row, isTree, frozenCols, mainCols),
        ),
      );

      // Sync hover between both rows
      const syncHover = (add) => {
        this._el
          .querySelectorAll(`tr[data-ng-row-id="${row._ngId}"]`)
          .forEach((t) => t.classList.toggle("ng-row-hover", add));
      };
      [lTr, rTr].forEach((tr) => {
        tr.addEventListener("mouseenter", () => syncHover(true));
        tr.addEventListener("mouseleave", () => syncHover(false));
      });

      // Click handler
      const onClick = (e) => {
        if (
          ["ng-drag-handle", "ng-pin-cell", "ng-sel-cb", "ng-tree-toggle"].some(
            (c) => e.target.classList.contains(c),
          )
        )
          return;

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Range selection: find anchor and current row in the FULL sorted list
          // so it works across pages and regardless of current scroll position
          const allSorted = this._getAllFilteredSorted();
          const curIdx = allSorted.findIndex((r) => r._ngId === row._ngId);
          const anchorId = this._lastClickRowId;
          const anchorIdx = anchorId
            ? allSorted.findIndex((r) => r._ngId === anchorId)
            : -1;

          if (anchorIdx >= 0 && curIdx >= 0) {
            const from = Math.min(anchorIdx, curIdx);
            const to = Math.max(anchorIdx, curIdx);
            // Select the range; keep existing selections outside range
            allSorted.forEach((r, i) => {
              if (i >= from && i <= to) r._selected = true;
            });
          } else {
            // No anchor yet — just toggle this row and set anchor
            row._selected = !row._selected;
            this._lastClickRowId = row._ngId;
          }
        } else {
          // Simple click: clear all, select only this row, set new anchor
          this._rows.forEach((r) => (r._selected = false));
          row._selected = true;
          this._lastClickRowId = row._ngId;
        }
        this._updateStatus();
        this._renderBody();
        this._opts.onSelectionChanged &&
          this._opts.onSelectionChanged(this.getSelectedRows());
        this._opts.onRowClick &&
          this._opts.onRowClick({ row: this._cleanRow(row), event: e });
      };
      const onDbl = (e) => {
        row._detailOpen = !row._detailOpen;
        this._renderBody();
        this._opts.onRowDblClick &&
          this._opts.onRowDblClick({ row: this._cleanRow(row), event: e });
      };
      const onCtx = (e) => {
        e.preventDefault();
        this._ctxRow = row;
        this._ctxCol = e.target.closest("td")?.dataset?.ngCol;
        const m = this._ctxMenuEl;
        m.classList.add("visible");
        m.style.left = Math.min(e.clientX + 2, window.innerWidth - 200) + "px";
        m.style.top = Math.min(e.clientY + 2, window.innerHeight - 340) + "px";
      };
      [lTr, rTr].forEach((tr) => {
        tr.addEventListener("click", onClick);
        tr.addEventListener("dblclick", onDbl);
        tr.addEventListener("contextmenu", onCtx);
      });

      // Row drag & drop
      [lTr, rTr].forEach((tr) => {
        tr.draggable = true;
        tr.addEventListener("dragstart", () => {
          this._dragSrc = row._ngId;
          [lTr, rTr].forEach((t) => t.classList.add("dragging"));
        });
        tr.addEventListener("dragend", () => {
          [lTr, rTr].forEach((t) => t.classList.remove("dragging"));
          this._el
            .querySelectorAll(".drag-over")
            .forEach((e) => e.classList.remove("drag-over"));
        });
        tr.addEventListener("dragover", (e) => {
          e.preventDefault();
          this._el
            .querySelectorAll(".drag-over")
            .forEach((x) => x.classList.remove("drag-over"));
          [lTr, rTr].forEach((t) => t.classList.add("drag-over"));
        });
        tr.addEventListener("drop", () => {
          [lTr, rTr].forEach((t) => t.classList.remove("drag-over"));
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
      });

      return [lTr, rTr];
    }

    _buildGroupRowPair(grp, frozenCols, mainCols) {
      const mkGrpTr = (cols, spanAll) => {
        const tr = document.createElement("tr");
        tr.className = "ng-group-row";
        if (spanAll) {
          const td = document.createElement("td");
          td.colSpan = cols.length;
          const sum = Object.entries(grp.__totals || {})
            .map(([k, v]) => {
              const col = this._cols.find((c) => c._id === k);
              return `${col?._label || k}: <b>${this._fmtNum(v)}</b>`;
            })
            .join(" | ");
          td.innerHTML = `<span style="font-size:10px;background:#1c2e4a;color:#e8edf5;padding:2px 7px;border-radius:10px;margin-right:8px;">${grp.__key}</span>${grp.__count} ligne${grp.__count > 1 ? "s" : ""}  ${sum}`;
          tr.appendChild(td);
        } else {
          cols.forEach(() => {
            const td = document.createElement("td");
            tr.appendChild(td);
          });
        }
        return tr;
      };
      return [mkGrpTr(frozenCols, true), mkGrpTr(mainCols, false)];
    }

    _buildDetailCells(row, frozenCols, mainCols) {
      const mkDtl = (cols, spanAll) => {
        const tr = document.createElement("tr");
        tr.className = "ng-detail-row";
        if (spanAll) {
          const td = document.createElement("td");
          td.colSpan = cols.length;
          const fields = this._cols.filter(
            (c) => !SYS.includes(c._id) && c._visible,
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
        } else {
          cols.forEach(() => {
            const td = document.createElement("td");
            tr.appendChild(td);
          });
        }
        return tr;
      };
      // Detail content goes on RIGHT panel (non-frozen) only
      const showInFrozen = frozenCols.length === 0; // if no frozen cols, show in main
      return [mkDtl(frozenCols, showInFrozen), mkDtl(mainCols, !showInFrozen)];
    }

    // ─────────────────────────────────────────────────────────
    //  BUILD CELL
    // ─────────────────────────────────────────────────────────
    _buildCell(col, val, row, isTree, frozenCols, mainCols) {
      const td = document.createElement("td");
      td.className = "ng-td";
      td.style.overflow = "hidden";
      td.style.textOverflow = "ellipsis";
      td.style.whiteSpace = "nowrap";
      td.style.width = col._width + "px";
      td.style.maxWidth = col._width + "px";
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

      // Tree UI on first data column of the frozen panel
      const allDataCols = this._getVisibleCols().filter(
        (c) => !SYS.includes(c._id),
      );
      const firstDataCol = allDataCols[0];
      const isFirstFrozen =
        frozenCols.length > 0 &&
        frozenCols.find((c) => !SYS.includes(c._id))?._id === col._id;
      const isFirstMain =
        frozenCols.filter((c) => !SYS.includes(c._id)).length === 0 &&
        mainCols[0]?._id === col._id;
      const needsTree =
        isTree &&
        (isFirstFrozen ||
          (!frozenCols.filter((c) => !SYS.includes(c._id)).length &&
            isFirstMain));

      if (needsTree) {
        td.style.display = "flex";
        td.style.alignItems = "center";
        td.style.gap = "2px";
        const style = this._opts.treeStyle || "default";
        const depth = row._depth || 0;

        if (style === "lines") {
          // ASCII-style tree lines
          const lineWrap = document.createElement("span");
          lineWrap.style.cssText = `display:inline-flex;align-items:center;flex-shrink:0;font-family:monospace;color:var(--ng-text-muted);font-size:11px;`;
          for (let i = 0; i < depth; i++) {
            const line = document.createElement("span");
            line.textContent = i < depth - 1 ? "│  " : "";
            line.style.marginRight = "2px";
            lineWrap.appendChild(line);
          }
          if (depth > 0) {
            const branch = document.createElement("span");
            branch.textContent = row._hasChildren ? "├─ " : "└─ ";
            lineWrap.appendChild(branch);
          }
          td.appendChild(lineWrap);
        } else if (style === "folder") {
          const indent = document.createElement("span");
          indent.style.cssText = `display:inline-block;width:${depth * 16}px;flex-shrink:0;`;
          td.appendChild(indent);
          const icon = document.createElement("span");
          icon.style.cssText = "margin-right:4px;font-size:14px;flex-shrink:0;";
          icon.textContent = row._hasChildren
            ? row._expanded !== false
              ? "📂"
              : "📁"
            : "📄";
          td.appendChild(icon);
        } else {
          // Default: indent + arrow toggle
          const indent = document.createElement("span");
          indent.style.cssText = `display:inline-block;width:${depth * 14}px;flex-shrink:0;`;
          td.appendChild(indent);
        }

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
        } else if (this._opts.treeStyle === "default") {
          toggle.textContent = "·";
          toggle.style.opacity = "0.3";
          toggle.style.flexShrink = "0";
        }
        td.appendChild(toggle);
      }

      // Value
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
        if (needsTree) {
          const s = document.createElement("span");
          s.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;";
          s.textContent = rendered;
          td.appendChild(s);
        } else td.textContent = rendered;
      }

      if (col._editable && !col._formula) {
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
      // Formula — eager or lazy
      if (typeof col._formula === "function") {
        val =
          this._opts.formulaMode === "eager"
            ? (row["__f_" + col._id] ?? "#N/A")
            : (() => {
                try {
                  return col._formula(row);
                } catch {
                  return "#ERR";
                }
              })();
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
            Faible: "green",
            Moyen: "orange",
            Élevé: "red",
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

    _updateStatus() {
      if (!this._statusEl) return;
      const vis = this._getVisibleRows(),
        pin = this._rows.filter((r) => r._pinned);
      const nc = this._cols.find((c) => c._aggFunc === "sum" && c._visible);
      const sum = nc
        ? vis.reduce((s, r) => s + (parseFloat(r[nc._id]) || 0), 0)
        : null;
      this._setStatus(
        "rows",
        vis.length + (pin.length ? ` (+${pin.length} fixées)` : ""),
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

    // ─────────────────────────────────────────────────────────
    //  INLINE EDIT — absolute overlay + type validation
    // ─────────────────────────────────────────────────────────
    _startEdit(td, row, col) {
      if (this._editOverlay) {
        this._editOverlay.remove();
        this._editOverlay = null;
      }

      const rect = td.getBoundingClientRect();

      // Create overlay positioned exactly over the cell
      const overlay = document.createElement("div");
      overlay.className = "ng-edit-overlay";
      overlay.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:9999;display:flex;align-items:stretch;`;
      this._editOverlay = overlay;

      const inp = document.createElement("input");
      inp.className = "ng-edit-input";
      inp.type =
        col._type === "num" ? "number" : col._type === "date" ? "date" : "text";
      inp.step = "any";
      inp.style.textAlign = col._type === "num" ? "right" : "left";

      // Set current value
      const raw = row[col._id];
      if (col._type === "num") {
        const n = parseFloat(
          String(raw ?? "")
            .replace(/\s/g, "")
            .replace(",", "."),
        );
        inp.value = isNaN(n) ? "" : n;
      } else inp.value = raw ?? "";

      // Error tooltip
      const errTip = document.createElement("div");
      errTip.className = "ng-edit-error";
      errTip.style.display = "none";

      overlay.appendChild(inp);
      document.body.appendChild(overlay);
      document.body.appendChild(errTip);
      inp.focus();
      inp.select();

      // ── Type validation ──────────────────────────────────
      const validate = (v) => {
        if (v === "") return { ok: true };
        if (col._type === "num") {
          if (isNaN(parseFloat(v.replace(",", "."))))
            return { ok: false, msg: "Veuillez saisir un nombre valide" };
        }
        if (col._type === "date") {
          if (inp.type === "date" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v))
            return { ok: false, msg: "Format de date invalide (YYYY-MM-DD)" };
        }
        if (col._raw?.validate) {
          const r = col._raw.validate(v);
          if (r === false || typeof r === "string")
            return {
              ok: false,
              msg: typeof r === "string" ? r : "Valeur invalide",
            };
        }
        return { ok: true };
      };

      const showErr = (msg) => {
        inp.style.borderColor = "#c0392b";
        errTip.textContent = msg;
        const r2 = overlay.getBoundingClientRect();
        errTip.style.cssText = `position:fixed;left:${r2.left}px;top:${r2.bottom + 2}px;background:#c0392b;color:#fff;font-size:11px;padding:3px 8px;border-radius:3px;z-index:99999;white-space:nowrap;`;
        errTip.style.display = "block";
      };

      const hideErr = () => {
        inp.style.borderColor = "";
        errTip.style.display = "none";
      };

      const finish = (save) => {
        if (save) {
          const v = validate(inp.value);
          if (!v.ok) {
            showErr(v.msg);
            inp.focus();
            return;
          }
          const oldVal = row[col._id];
          const newVal =
            col._type === "num" && inp.value !== ""
              ? parseFloat(inp.value.replace(",", "."))
              : inp.value;
          if (String(newVal) !== String(oldVal)) {
            row[col._id] = newVal;
            if (!row._dirty) row._dirty = {};
            row._dirty[col._id] = true;
            this._opts.onCellValueChanged &&
              this._opts.onCellValueChanged({
                row: this._cleanRow(row),
                field: col._id,
                oldValue: oldVal,
                newValue: newVal,
              });
            this._toast("Cellule modifiée");
            this._renderBody();
          }
        }
        hideErr();
        overlay.remove();
        errTip.remove();
        this._editOverlay = null;
      };

      inp.addEventListener("input", hideErr);
      inp.addEventListener("blur", () =>
        setTimeout(() => {
          if (this._editOverlay === overlay) finish(true);
        }, 120),
      );
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
        if (e.key === "Tab") {
          e.preventDefault();
          finish(true); /* TODO: move to next */
        }
      });
      // Click outside closes
      const outsideClick = (e) => {
        if (!overlay.contains(e.target)) {
          finish(true);
          document.removeEventListener("mousedown", outsideClick);
        }
      };
      setTimeout(
        () => document.addEventListener("mousedown", outsideClick),
        10,
      );
    }

    // ─────────────────────────────────────────────────────────
    //  CONTEXT MENU
    // ─────────────────────────────────────────────────────────
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
          if (c && !SYS.includes(c._id)) {
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

    toggleColPanel() {
      this._colPanelEl.classList.toggle("open");
      this._refreshColPanel();
    }
    _refreshColPanel() {
      const list = this._colPanelEl.querySelector(".ng-col-panel-list");
      if (!list) return;
      list.innerHTML = "";
      this._cols
        .filter((c) => !SYS.includes(c._id))
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
            if (SYS.includes(col._id)) return;
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
      [this._leftTableEl, this._rightTableEl].forEach((t) => {
        if (t) t.classList.toggle("ng-filters-hidden", !this._filtersVis);
      });
      this._toolbarEl
        ?.querySelector('[data-ng-btn="filters"]')
        ?.classList.toggle("active", this._filtersVis);
    }
    toggleGrouping() {
      this._groupEnabled = !this._groupEnabled;
      if (this._groupEnabled && !this._groupByField) {
        const c = this._cols.find(
          (c) => !SYS.includes(c._id) && c._type !== "num" && c._visible,
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
    setLayout(l) {
      this._layout = l;
      this._applyLayout();
      return this;
    }

    // ─────────────────────────────────────────────────────────
    //  SPLASH LOADER
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  CHART CONFIG MODAL (Toolbar button: "📊 Graphes")
    //  Shows field selector (X-axis / Y-axis) then opens chart
    // ─────────────────────────────────────────────────────────
    _buildChartConfigModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width:560px">
        <div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);">
          <div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;">
            <h5 class="modal-title" style="font-size:14px;font-weight:600;">📊 Configurer le graphique</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="padding:0;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;min-height:300px;">
              <!-- X axis (categories) -->
              <div style="padding:16px;border-right:1px solid #dee2e6;">
                <div class="ng-bsm-section-title" style="margin-bottom:10px;color:#5a6a80;">
                  📐 Axe X — Catégories
                  <div style="font-size:10px;font-weight:400;margin-top:2px;color:#8090a8;">Texte, badge, date</div>
                </div>
                <div class="ng-cgm-xaxis"></div>
              </div>
              <!-- Y axis (series) -->
              <div style="padding:16px;">
                <div class="ng-bsm-section-title" style="margin-bottom:10px;color:#1e6dc5;">
                  📈 Axe Y — Valeurs
                  <div style="font-size:10px;font-weight:400;margin-top:2px;color:#8090a8;">Colonnes numériques</div>
                </div>
                <div class="ng-cgm-yaxis"></div>
              </div>
            </div>
            <!-- Chart type -->
            <div style="padding:12px 16px;border-top:1px solid #f0f2f5;background:#f8f9fb;display:flex;align-items:center;gap:12px;">
              <span style="font-size:11px;font-weight:700;color:#5a6a80;text-transform:uppercase;letter-spacing:.5px;">Type :</span>
              <div class="ng-cgm-types"></div>
            </div>
          </div>
          <div class="modal-footer" style="border-top:1px solid #dee2e6;padding:10px 18px;gap:8px;">
            <span class="ng-cgm-hint" style="font-size:11px;color:#8090a8;flex:1;">Sélectionnez des lignes dans le tableau avant d'ouvrir</span>
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annuler</button>
            <button type="button" class="btn btn-sm ng-cgm-open-btn" style="background:#1e6dc5;color:#fff;border:none;">Ouvrir les graphiques</button>
          </div>
        </div>
      </div>`;

      // State
      let selectedXField = null;
      let selectedYFields = [];
      let selectedType = "bar";

      const refresh = () => {
        // X axis fields
        const xContainer = div.querySelector(".ng-cgm-xaxis");
        xContainer.innerHTML = "";
        const xCols = this._cols.filter(
          (c) =>
            !SYS.includes(c._id) &&
            c._visible &&
            ["text", "badge", "date"].includes(c._type),
        );
        if (!xCols.length) {
          xContainer.innerHTML =
            '<div style="font-size:11px;color:#aaa;font-style:italic;">Aucun champ texte/date visible</div>';
        }
        xCols.forEach((col) => {
          const item = document.createElement("div");
          item.style.cssText =
            "display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;margin-bottom:2px;transition:background .1s;";
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "ng-cgm-x";
          radio.value = col._id;
          radio.style.accentColor = "#5a6a80";
          if (col._id === selectedXField) radio.checked = true;
          const lbl = document.createElement("span");
          lbl.style.cssText = "font-size:12px;";
          lbl.textContent = col._label;
          const typeBadge = document.createElement("span");
          typeBadge.style.cssText =
            "margin-left:auto;font-size:9px;background:#e8eaed;color:#5a6a80;padding:1px 5px;border-radius:8px;";
          typeBadge.textContent = col._type;
          radio.addEventListener("change", () => {
            selectedXField = col._id;
          });
          item.addEventListener(
            "mouseenter",
            () => (item.style.background = "#f0f4fa"),
          );
          item.addEventListener(
            "mouseleave",
            () => (item.style.background = ""),
          );
          item.addEventListener("click", () => {
            radio.checked = true;
            selectedXField = col._id;
          });
          item.appendChild(radio);
          item.appendChild(lbl);
          item.appendChild(typeBadge);
          xContainer.appendChild(item);
        });

        // Y axis fields
        const yContainer = div.querySelector(".ng-cgm-yaxis");
        yContainer.innerHTML = "";
        const yCols = this._cols.filter(
          (c) => !SYS.includes(c._id) && c._visible && c._type === "num",
        );
        if (!yCols.length) {
          yContainer.innerHTML =
            '<div style="font-size:11px;color:#aaa;font-style:italic;">Aucun champ numérique visible</div>';
        }
        yCols.forEach((col) => {
          const item = document.createElement("div");
          item.style.cssText =
            "display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;margin-bottom:2px;transition:background .1s;";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.value = col._id;
          cb.style.accentColor = "#1e6dc5";
          if (selectedYFields.includes(col._id)) cb.checked = true;
          const lbl = document.createElement("span");
          lbl.style.cssText = "font-size:12px;";
          lbl.textContent = col._label;
          if (col._aggFunc) {
            const agg = document.createElement("span");
            agg.style.cssText =
              "margin-left:auto;font-size:9px;background:#dbeafe;color:#1e5fa0;padding:1px 5px;border-radius:8px;";
            agg.textContent = col._aggFunc;
            item.appendChild(agg);
          }
          cb.addEventListener("change", () => {
            if (cb.checked) selectedYFields.push(col._id);
            else selectedYFields = selectedYFields.filter((f) => f !== col._id);
          });
          item.addEventListener(
            "mouseenter",
            () => (item.style.background = "#f0f4fa"),
          );
          item.addEventListener(
            "mouseleave",
            () => (item.style.background = ""),
          );
          item.addEventListener("click", (e) => {
            if (e.target !== cb) {
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event("change"));
            }
          });
          item.insertBefore(cb, item.firstChild);
          item.insertBefore(
            lbl,
            item.children[1] || item.firstChild.nextSibling,
          );
          yContainer.appendChild(item);
        });

        // Chart types
        const typesBar = div.querySelector(".ng-cgm-types");
        typesBar.innerHTML = "";
        const types = [
          { id: "bar", lbl: "Bar" },
          { id: "line", lbl: "Ligne" },
          { id: "area", lbl: "Aire" },
          { id: "donut", lbl: "Donut" },
          { id: "pie", lbl: "Pie" },
        ];
        types.forEach((tp) => {
          const b = document.createElement("button");
          b.style.cssText = `padding:3px 10px;font-size:11px;border:1px solid ${tp.id === selectedType ? "#1e6dc5" : "#d0d5de"};background:${tp.id === selectedType ? "#1e6dc5" : "#fff"};color:${tp.id === selectedType ? "#fff" : "#3a4a5e"};border-radius:3px;cursor:pointer;font-family:inherit;transition:all .1s;margin-right:4px;`;
          b.textContent = tp.lbl;
          b.addEventListener("click", () => {
            selectedType = tp.id;
            typesBar.querySelectorAll("button").forEach((x) => {
              x.style.background = "#fff";
              x.style.color = "#3a4a5e";
              x.style.borderColor = "#d0d5de";
            });
            b.style.background = "#1e6dc5";
            b.style.color = "#fff";
            b.style.borderColor = "#1e6dc5";
          });
          typesBar.appendChild(b);
        });
      };

      div.addEventListener("show.bs.modal", () => {
        // Defaults: first text col for X, first 2 num cols for Y
        const xCols = this._cols.filter(
          (c) =>
            !SYS.includes(c._id) &&
            c._visible &&
            ["text", "badge", "date"].includes(c._type),
        );
        const yCols = this._cols.filter(
          (c) => !SYS.includes(c._id) && c._visible && c._type === "num",
        );
        if (!selectedXField && xCols.length) selectedXField = xCols[0]._id;
        if (!selectedYFields.length && yCols.length)
          selectedYFields = yCols.slice(0, 2).map((c) => c._id);
        refresh();
      });

      div.querySelector(".ng-cgm-open-btn").addEventListener("click", () => {
        // Store chart config then open chart modal
        this._chartConfig = {
          xField: selectedXField,
          yFields: selectedYFields,
          chartType: selectedType,
        };
        bootstrap.Modal.getInstance(div)?.hide();
        // Select all rows if nothing selected
        if (!this._rows.filter((r) => r._selected).length)
          this._rows.forEach((r) => (r._selected = true));
        this._renderBody();
        setTimeout(() => this.openChart(), 50);
      });

      return div;
    }

    _openChartConfigModal() {
      if (!this._chartConfigModalEl) {
        this._chartConfigModalEl = this._buildChartConfigModal();
        document.body.appendChild(this._chartConfigModalEl);
      }
      const open = () =>
        bootstrap.Modal.getOrCreateInstance(this._chartConfigModalEl).show();
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

    // ─────────────────────────────────────────────────────────
    //  CHART MODAL — ApexCharts
    // ─────────────────────────────────────────────────────────
    _buildChartModal() {
      const o = document.createElement("div");
      o.className = "ng-chart-overlay";
      o.innerHTML = `<div class="ng-chart-modal"><div class="ng-chart-modal-header"><div class="ng-chart-modal-title">📊 Analyse — lignes sélectionnées <span class="ng-chart-badge ng-chart-sel-count">0 lignes</span></div><span class="ng-chart-close">✕</span></div><div class="ng-chart-inner"><div class="ng-chart-nav"></div><div class="ng-chart-content"></div></div><div class="ng-chart-footer"><button class="ng-btn-secondary ng-chart-csv-btn">📄 CSV sélection</button><button class="ng-btn-primary ng-chart-close-btn">Fermer</button></div></div>`;
      o.querySelector(".ng-chart-close").addEventListener("click", () =>
        this.closeChart(),
      );
      o.querySelector(".ng-chart-close-btn").addEventListener("click", () =>
        this.closeChart(),
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
      Object.values(this._activeCharts).forEach(
        (c) => c.destroy && c.destroy(),
      );
      this._activeCharts = {};
      setTimeout(() => this._buildAllCharts(sel), 40);
    }

    closeChart() {
      this._chartOverlay.classList.remove("open");
      Object.values(this._activeCharts).forEach(
        (c) => c.destroy && c.destroy(),
      );
      this._activeCharts = {};
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
            !SYS.includes(c._id) &&
            ["text", "badge"].includes(c._type) &&
            c._visible,
        )
        .filter((c) => {
          const v = [...new Set(rows.map((r) => r[c._id]))];
          return v.length > 1 && v.length <= 15;
        });
      const labelField = this._cols.find(
        (c) => !SYS.includes(c._id) && c._type === "text" && c._visible,
      );
      const kpis =
        graphOpts.kpis ||
        numCols
          .slice(0, 4)
          .map((c) => ({ label: c._label, field: c._id, fn: "sum" }));
      const self = this;

      // ── ApexCharts factory ───────────────────────────────
      const mkApex = (containerId, type, series, cats, opts = {}) => {
        const old = self._activeCharts[containerId];
        if (old && old.destroy) old.destroy();
        const el = content.querySelector("#" + containerId);
        if (!el) return;

        const isPie = type === "donut" || type === "pie";
        const cfg = {
          chart: {
            type,
            height: 210,
            fontFamily: "'Segoe UI',sans-serif",
            toolbar: { show: false },
            animations: { speed: 400 },
            background: "transparent",
          },
          series: isPie ? series[0].data : series,
          xaxis: { categories: cats, labels: { style: { fontSize: "10px" } } },
          yaxis: {
            labels: {
              formatter: (v) => self._fmtNum(v, 0),
              style: { fontSize: "10px" },
            },
          },
          colors: PAL,
          legend: {
            position: isPie ? "right" : "top",
            fontSize: "11px",
            markers: { size: 8 },
          },
          dataLabels: { enabled: isPie },
          stroke: {
            width: type === "line" || type === "area" ? 2 : 0,
            curve: "smooth",
          },
          fill: {
            type: type === "area" ? "gradient" : "solid",
            gradient: { opacityFrom: 0.4, opacityTo: 0.05 },
          },
          plotOptions: {
            bar: { borderRadius: 2, columnWidth: "65%" },
            pie: { donut: { size: "55%" } },
          },
          tooltip: {
            style: { fontSize: "11px" },
            y: {
              formatter: (v) => (typeof v === "number" ? self._fmtNum(v) : v),
            },
          },
          grid: { borderColor: "#f0f2f5", strokeDashArray: 3 },
          theme: { mode: "light" },
          ...opts,
        };
        if (isPie) {
          cfg.labels = cats;
          delete cfg.xaxis;
        }
        const chart = new ApexCharts(el, cfg);
        chart.render();
        self._activeCharts[containerId] = chart;
      };

      const mkCard = (id, title, types, buildFn, tableH, tableRows) => {
        const card = document.createElement("div");
        card.className = "ng-chart-card";
        const hdr = document.createElement("div");
        hdr.className = "ng-chart-card-header";
        const t = document.createElement("div");
        t.className = "ng-chart-card-title";
        t.textContent = title;
        const bar = document.createElement("div");
        bar.className = "ng-ct-bar";
        const allTypes = [...types, "📋"];
        let activeType = types[0];
        const wrap = document.createElement("div");
        wrap.className = "ng-canvas-wrap";
        const el = document.createElement("div");
        el.id = id;
        el.style.height = "210px";
        wrap.appendChild(el);
        const tblWrap = document.createElement("div");
        tblWrap.className = "ng-chart-tbl-wrap";
        if (tableH && tableRows) {
          const tbl = document.createElement("table");
          tbl.className = "ng-chart-data-tbl";
          const thead = tbl.createTHead();
          const hr = thead.insertRow();
          tableH.forEach((h) => {
            const x = document.createElement("th");
            x.textContent = h;
            hr.appendChild(x);
          });
          const tbody = tbl.createTBody();
          tableRows.forEach((r) => {
            const tr = tbody.insertRow();
            r.forEach((cell, i) => {
              const td = tr.insertCell();
              td.textContent = cell;
              const n = parseFloat(
                String(cell).replace(/\s/g, "").replace(",", "."),
              );
              if (!isNaN(n) && i > 0) {
                td.classList.add("num");
                if (n < 0) td.classList.add("neg");
                else if (n > 0) td.classList.add("pos");
              }
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
            if (tp !== "📋") buildFn(id, tp);
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

      // ── Apply chartConfig from modal if set ───────────────
      const cfg = this._chartConfig || {};
      const cfgXCol = cfg.xField
        ? self._cols.find((c) => c._id === cfg.xField)
        : null;
      const cfgYCols =
        cfg.yFields && cfg.yFields.length
          ? cfg.yFields
              .map((f) => self._cols.find((c) => c._id === f))
              .filter(Boolean)
          : null;
      const cfgChartType = cfg.chartType || null;
      const activeNumCols = cfgYCols || numCols;
      const activeLabelField = cfgXCol || labelField;
      const labels = rows.map((r) =>
        activeLabelField ? String(r[activeLabelField._id] || "") : r._ngId,
      );

      // ── Field selector (collapsible, shown at bottom of each auto section) ──
      const mkFieldSelector = (panel, curXId, curYIds, redrawFn) => {
        const wrap = document.createElement("div");
        wrap.style.cssText =
          "margin-top:14px;border:1px solid #e0e5ee;border-radius:5px;background:#f8f9fb;overflow:hidden;";
        const hdr = document.createElement("div");
        hdr.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:#edf2f8;cursor:pointer;user-select:none;font-size:11px;font-weight:600;color:#5a6a80;";
        hdr.innerHTML =
          '<span>⚙ Configurer les axes</span><span style="font-size:10px">▾</span>';
        const body = document.createElement("div");
        body.style.cssText = "display:none;grid-template-columns:1fr 1fr;";
        const xCols2 = self._cols.filter(
          (c) =>
            !SYS.includes(c._id) &&
            c._visible &&
            ["text", "badge", "date"].includes(c._type),
        );
        const yCols2 = self._cols.filter(
          (c) => !SYS.includes(c._id) && c._visible && c._type === "num",
        );
        let xSel = curXId || xCols2[0]?._id;
        const ySels = new Set(curYIds || []);
        const xPane = document.createElement("div");
        xPane.style.cssText =
          "padding:10px 12px;border-right:1px solid #e0e5ee;";
        xPane.innerHTML =
          '<div style="font-size:10px;font-weight:700;color:#5a6a80;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📐 Axe X</div>';
        xCols2.forEach((col) => {
          const lbl = document.createElement("label");
          lbl.style.cssText =
            "display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:2px 0;";
          const ri = document.createElement("input");
          ri.type = "radio";
          ri.name = "ngfx_" + panel.id;
          ri.value = col._id;
          ri.style.accentColor = "#5a6a80";
          if (col._id === xSel) ri.checked = true;
          ri.addEventListener("change", () => {
            xSel = col._id;
            redrawFn(xSel, [...ySels]);
          });
          lbl.appendChild(ri);
          lbl.appendChild(document.createTextNode(col._label));
          xPane.appendChild(lbl);
        });
        const yPane = document.createElement("div");
        yPane.style.cssText = "padding:10px 12px;";
        yPane.innerHTML =
          '<div style="font-size:10px;font-weight:700;color:#1e6dc5;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📈 Axe Y</div>';
        yCols2.forEach((col) => {
          const lbl = document.createElement("label");
          lbl.style.cssText =
            "display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:2px 0;";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.value = col._id;
          cb.style.accentColor = "#1e6dc5";
          if (ySels.has(col._id)) cb.checked = true;
          cb.addEventListener("change", () => {
            if (cb.checked) ySels.add(col._id);
            else ySels.delete(col._id);
            redrawFn(xSel, [...ySels]);
          });
          lbl.appendChild(cb);
          lbl.appendChild(document.createTextNode(col._label));
          yPane.appendChild(lbl);
        });
        body.appendChild(xPane);
        body.appendChild(yPane);
        hdr.addEventListener("click", () => {
          const open = body.style.display === "none";
          body.style.display = open ? "grid" : "none";
          hdr.querySelector("span:last-child").textContent = open ? "▴" : "▾";
        });
        wrap.appendChild(hdr);
        wrap.appendChild(body);
        panel.appendChild(wrap);
      };

      const sections = [];

      // ── Section Overview ────────────────────────────────
      // ─── Auto section: Vue d'ensemble ───────────────────────
      if (activeNumCols.length >= 1) {
        sections.push({
          title: "Vue d'ensemble",
          icon: "📊",
          build: (panel) => {
            panel.id = "ngp-ov-" + Math.random().toString(36).substr(2, 4);
            let axisX = activeLabelField?._id;
            let axisY = activeNumCols.map((c) => c._id);
            const drawOv = () => {
              const old = panel.querySelector(".ng-ov-g");
              if (old) old.remove();
              // Use a SINGLE card with ALL selected Y fields as series — no 2-series limit
              const g = document.createElement("div");
              g.className = "ng-ov-g";
              g.style.marginBottom = "0";
              const xc =
                self._cols.find((c) => c._id === axisX) || activeLabelField;
              const ycs = axisY
                .map((id) => self._cols.find((c) => c._id === id))
                .filter(Boolean);
              if (!ycs.length) return;
              const lbs = rows.map((r) =>
                xc ? String(r[xc._id] || "") : r._ngId,
              );
              // Build series for ALL Y columns
              const allSeries = ycs.map((c) => ({
                name: c._label,
                data: rows.map((r) => parseFloat(r[c._id]) || 0),
              }));
              const cardTitle = ycs.map((c) => c._label).join(" / ");
              const uid = Math.random().toString(36).substr(2, 4);
              const chartId = "ng_ov_" + uid;
              const tHeaders = [
                xc?._label || "ID",
                ...ycs.map((c) => c._label),
              ];
              const tRows = rows.map((r) => [
                xc ? r[xc._id] : "ID",
                ...ycs.map((c) => self._fmtNum(parseFloat(r[c._id]) || 0)),
              ]);
              const card = mkCard(
                chartId,
                cardTitle,
                ["bar", "line", "area", "donut", "pie"],
                (id, tp) => {
                  const isPie = tp === "donut" || tp === "pie";
                  if (isPie && ycs.length === 1) {
                    mkApex(id, tp, [{ data: allSeries[0].data }], lbs);
                  } else mkApex(id, tp, allSeries, lbs);
                },
                tHeaders,
                tRows,
              );
              card.style.marginBottom = "0";
              g.appendChild(card);
              // Chart always ABOVE the field selector wrapper
              const fselWrap = panel.querySelector(".ng-fsel-wrap");
              panel.insertBefore(g, fselWrap || null);
              setTimeout(() => {
                mkApex(chartId, "bar", allSeries, lbs);
              }, 30);
            };
            // Append field selector once, at the bottom — charts will be inserted before it
            mkFieldSelector(panel, axisX, axisY, (newX, newY) => {
              axisX = newX;
              axisY = [...newY];
              drawOv();
            });
            drawOv(); // draw chart AFTER selector is in DOM so insertBefore works correctly
          },
        });
      }

      // ─── Auto section: Par catégorie ─────────────────────────
      catCols.slice(0, 2).forEach((catCol, ci) => {
        sections.push({
          title: catCol._label,
          icon: ci === 0 ? "🔖" : "🌐",
          build: (panel) => {
            panel.id = "ngp-cat-" + catCol._id;
            const ncols2 = self._cols.filter(
              (c) => !SYS.includes(c._id) && c._visible && c._type === "num",
            );
            let axisY2 = activeNumCols[0]?._id || ncols2[0]?._id;
            const drawCat = () => {
              const old = panel.querySelector(".ng-cat-g");
              if (old) old.remove();
              const g = document.createElement("div");
              g.className = "ng-charts-grid-2 ng-cat-g";
              const keys = [...new Set(rows.map((r) => r[catCol._id]))];
              const counts = {};
              rows.forEach((r) => {
                const k = r[catCol._id] || "";
                counts[k] = (counts[k] || 0) + 1;
              });
              const uid = Math.random().toString(36).substr(2, 4);
              const cId = "ng_pie_" + catCol._id + "_" + uid;
              const card = mkCard(
                cId,
                "Répartition " + catCol._label,
                ["donut", "pie", "bar"],
                (id, tp) => {
                  if (tp === "bar")
                    mkApex(
                      id,
                      "bar",
                      [{ name: "Nb", data: Object.values(counts) }],
                      keys,
                    );
                  else mkApex(id, tp, [{ data: Object.values(counts) }], keys);
                },
                [catCol._label, "Nb"],
                keys.map((k) => [k, counts[k]]),
              );
              g.appendChild(card);
              const ncol = self._cols.find((c) => c._id === axisY2);
              if (ncol) {
                const sums = {};
                rows.forEach((r) => {
                  const k = r[catCol._id] || "";
                  sums[k] = (sums[k] || 0) + (parseFloat(r[ncol._id]) || 0);
                });
                const skeys = Object.keys(sums);
                const id2 = "ng_bc_" + catCol._id + "_" + uid;
                const card2 = mkCard(
                  id2,
                  ncol._label + " par " + catCol._label,
                  ["bar", "area", "line"],
                  (id, tp) =>
                    mkApex(
                      id,
                      tp,
                      [{ name: ncol._label, data: Object.values(sums) }],
                      skeys,
                    ),
                  [catCol._label, ncol._label],
                  skeys.map((k) => [k, self._fmtNum(sums[k])]),
                );
                g.appendChild(card2);
                setTimeout(() => {
                  mkApex(cId, "donut", [{ data: Object.values(counts) }], keys);
                  mkApex(
                    id2,
                    "bar",
                    [{ name: ncol._label, data: Object.values(sums) }],
                    skeys,
                  );
                }, 30);
              } else {
                setTimeout(
                  () =>
                    mkApex(
                      cId,
                      "donut",
                      [{ data: Object.values(counts) }],
                      keys,
                    ),
                  30,
                );
              }
              const fselWrap = panel.querySelector(".ng-cat-fsel");
              panel.insertBefore(g, fselWrap || null);
            };
            // Append Y-axis picker once at bottom, then draw chart above it
            // Compact Y-axis picker for category section
            const selWrap = document.createElement("div");
            selWrap.className = "ng-cat-fsel";
            selWrap.style.cssText =
              "margin-top:14px;border:1px solid #e0e5ee;border-radius:5px;background:#f8f9fb;overflow:hidden;";
            const hdr = document.createElement("div");
            hdr.style.cssText =
              "display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:#edf2f8;cursor:pointer;font-size:11px;font-weight:600;color:#5a6a80;user-select:none;";
            hdr.innerHTML =
              '<span>📈 Champ en ordonnée</span><span style="font-size:10px">▾</span>';
            const bdy = document.createElement("div");
            bdy.style.cssText =
              "display:none;padding:10px 12px;flex-wrap:wrap;gap:6px;";
            ncols2.forEach((col) => {
              const lbl = document.createElement("label");
              lbl.style.cssText =
                "display:inline-flex;align-items:center;gap:5px;font-size:11px;cursor:pointer;padding:3px 8px;border:1px solid #d0d5de;border-radius:10px;background:#fff;transition:all .1s;";
              const ri = document.createElement("input");
              ri.type = "radio";
              ri.name = "ngcaty_" + catCol._id + "_" + panel.id;
              ri.value = col._id;
              ri.style.accentColor = "#1e6dc5";
              if (col._id === axisY2) ri.checked = true;
              ri.addEventListener("change", () => {
                axisY2 = col._id;
                drawCat();
                lbl.style.background = "#dbeafe";
                lbl.style.borderColor = "#1e6dc5";
              });
              lbl.appendChild(ri);
              lbl.appendChild(document.createTextNode(" " + col._label));
              bdy.appendChild(lbl);
            });
            hdr.addEventListener("click", () => {
              const o = bdy.style.display === "none";
              bdy.style.display = o ? "flex" : "none";
              hdr.querySelector("span:last-child").textContent = o ? "▴" : "▾";
            });
            selWrap.appendChild(hdr);
            selWrap.appendChild(bdy);
            panel.appendChild(selWrap);
            drawCat(); // draw chart AFTER selector appended so insertBefore works
          },
        });
      });

      // ─── User-defined sections ────────────────────────────────
      // build(panel, rows, helpers) where helpers = {mkApex, mkCard, mkFieldSelector, PAL}
      if (graphOpts.sections && graphOpts.sections.length) {
        graphOpts.sections.forEach((sec) => {
          sections.push({
            title: sec.title || "Section",
            icon: sec.icon || "📊",
            build: (panel) => {
              try {
                sec.build(panel, rows, {
                  mkApex,
                  mkCard,
                  mkFieldSelector,
                  PAL,
                  self,
                });
              } catch (err) {
                panel.innerHTML =
                  '<div style="padding:20px;color:#c0392b;font-size:12px;">Erreur section "' +
                  sec.title +
                  '" : ' +
                  err.message +
                  "</div>";
                console.error("NexaGrid graph section error:", err);
              }
            },
          });
        });
      }

      // ─── Tableau ─────────────────────────────────────────────
      sections.push({
        title: "Tableau",
        icon: "📋",
        build: (panel) => {
          const visC = self._cols.filter(
            (c) => !SYS.includes(c._id) && c._visible,
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
                String(v).replace(/[\s]/g, "").replace(",", "."),
              );
              if (!isNaN(n) && col._type === "num") {
                td.classList.add("num");
                if (n < 0) td.classList.add("neg");
                else if (n > 0) td.classList.add("pos");
              }
            });
          });
          const wrap = document.createElement("div");
          wrap.className = "ng-chart-tbl-wrap visible";
          wrap.style.maxHeight = "440px";
          wrap.appendChild(tbl);
          panel.appendChild(wrap);
        },
      });

      // ─── Build nav (lazy panels) ──────────────────────────────
      sections.forEach((sec, idx) => {
        const ni = document.createElement("div");
        ni.className = "ng-chart-nav-item" + (idx === 0 ? " active" : "");
        ni.textContent = sec.icon + " " + sec.title;
        ni.addEventListener("click", () => {
          nav
            .querySelectorAll(".ng-chart-nav-item")
            .forEach((n) => n.classList.remove("active"));
          ni.classList.add("active");
          content
            .querySelectorAll(".ng-chart-panel")
            .forEach((p) => p.classList.remove("active"));
          let panel = content.querySelector("#ngps" + idx);
          if (!panel) {
            panel = document.createElement("div");
            panel.className = "ng-chart-panel active";
            panel.id = "ngps" + idx;
            content.appendChild(panel);
            sec.build(panel);
          } else {
            panel.classList.add("active");
          }
        });
        nav.appendChild(ni);
        if (idx === 0) {
          const panel = document.createElement("div");
          panel.className = "ng-chart-panel active";
          panel.id = "ngps0";
          content.appendChild(panel);
          sec.build(panel);
        }
      });

      // ─── KPIs ─────────────────────────────────────────────────
      const kpiPanel = content.querySelector("#ngps0");
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
          el.innerHTML =
            '<div class="ng-kpi-label">' +
            kpi.label +
            '</div><div class="ng-kpi-value ' +
            (val < 0 ? "neg" : val > 0 ? "pos" : "") +
            '">' +
            (kpi.fn === "count" ? val : this._fmtNum(val)) +
            (kpi.suffix || "") +
            "</div>";
          kpiRow.appendChild(el);
        });
        kpiPanel.insertBefore(kpiRow, kpiPanel.firstChild);
      }
    }

    // ─────────────────────────────────────────────────────────
    //  PASTE (Excel → NexaGrid)
    // ─────────────────────────────────────────────────────────
    _handlePaste(e) {
      const clip = e.clipboardData || window.clipboardData;
      const text = clip.getData("text");
      if (!text) return;
      e.preventDefault();
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trimEnd()
        .split("\n");
      const matrix = lines.map((l) =>
        l
          .split("\t")
          .map((c) =>
            c.startsWith('"') && c.endsWith('"')
              ? c.slice(1, -1).replace(/""/g, '"')
              : c,
          ),
      );
      if (!matrix.length) return;
      const visRows = this._getVisibleRows();
      const editCols = this._getVisibleCols().filter(
        (c) => c._editable && !c._formula,
      );
      if (!editCols.length) {
        this._toast("Aucune colonne éditable");
        return;
      }
      let startRow = 0,
        startCol = 0;
      if (this._focusedCell) {
        const ri = visRows.findIndex(
          (r) => r._ngId === this._focusedCell.rowId,
        );
        const ci = editCols.findIndex((c) => c._id === this._focusedCell.colId);
        if (ri >= 0) startRow = ri;
        if (ci >= 0) startCol = ci;
      }
      let count = 0;
      const changes = [];
      matrix.forEach((rowData, ri) => {
        const tr = visRows[startRow + ri];
        if (!tr) return;
        rowData.forEach((val, ci) => {
          const col = editCols[startCol + ci];
          if (!col) return;
          const old = tr[col._id];
          tr[col._id] = val;
          if (!tr._dirty) tr._dirty = {};
          tr._dirty[col._id] = true;
          changes.push({
            row: this._cleanRow(tr),
            field: col._id,
            oldValue: old,
            newValue: val,
          });
          count++;
        });
      });
      if (count) {
        changes.forEach(
          (c) =>
            this._opts.onCellValueChanged && this._opts.onCellValueChanged(c),
        );
        this._renderBody();
        this._toast(
          `✓ ${count} cellule${count > 1 ? "s" : ""} collée${count > 1 ? "s" : ""}`,
        );
        requestAnimationFrame(() => {
          const rows = new Set(changes.map((c) => c.row._ngId));
          rows.forEach((id) => {
            const tr = this._el.querySelector(`tr[data-ng-row-id="${id}"]`);
            if (tr) {
              changes
                .filter(
                  (c) => (c.row._ngId || c.row[Object.keys(c.row)[0]]) && tr,
                )
                .forEach((ch) => {
                  const cell = tr.querySelector(
                    `td[data-ng-col="${ch.field}"]`,
                  );
                  if (cell) {
                    cell.classList.remove("ng-pasted");
                    void cell.offsetWidth;
                    cell.classList.add("ng-pasted");
                    setTimeout(() => cell.classList.remove("ng-pasted"), 650);
                  }
                });
            }
          });
        });
      }
    }

    // ─────────────────────────────────────────────────────────
    //  BULK EDIT MODAL
    // ─────────────────────────────────────────────────────────
    _buildBulkModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);"><div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;"><h5 class="modal-title" style="font-size:14px;font-weight:600;">✏️ Édition en masse</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body" style="padding:20px 22px;"><div class="ng-bsm-section-title" style="margin-bottom:6px;">Lignes sélectionnées</div><div class="ng-bulk-count" style="font-size:22px;font-weight:700;color:#1c2e4a;margin-bottom:16px;">0 lignes</div><div class="ng-bsm-section-title" style="margin-bottom:6px;">Champ à modifier</div><select class="ng-bsm-input ng-bulk-field-sel" style="margin-bottom:14px;cursor:pointer;"></select><div class="ng-bsm-section-title" style="margin-bottom:6px;">Nouvelle valeur</div><input type="text" class="ng-bsm-input ng-bulk-value-inp" placeholder="Valeur à appliquer…"><div class="ng-bulk-preview" style="margin-top:12px;font-size:11px;color:#8090a8;"></div></div><div class="modal-footer" style="border-top:1px solid #dee2e6;padding:12px 18px;gap:8px;"><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annuler</button><button type="button" class="btn btn-sm ng-bulk-apply-btn" style="background:#1e6dc5;color:#fff;border:none;">Appliquer</button></div></div></div>`;
      const fieldSel = div.querySelector(".ng-bulk-field-sel"),
        valueInp = div.querySelector(".ng-bulk-value-inp"),
        applyBtn = div.querySelector(".ng-bulk-apply-btn"),
        preview = div.querySelector(".ng-bulk-preview");
      div.addEventListener("show.bs.modal", () => {
        const sel = this._rows.filter((r) => r._selected);
        div.querySelector(".ng-bulk-count").textContent =
          `${sel.length} ligne${sel.length > 1 ? "s" : ""}`;
        fieldSel.innerHTML = "";
        this._cols
          .filter((c) => c._editable && !c._formula && !SYS.includes(c._id))
          .forEach((col) => {
            const o = document.createElement("option");
            o.value = col._id;
            o.textContent = col._label;
            fieldSel.appendChild(o);
          });
        valueInp.value = "";
        preview.textContent = "";
        const ut = () => {
          const col = this._cols.find((c) => c._id === fieldSel.value);
          valueInp.type =
            col?._type === "num"
              ? "number"
              : col?._type === "date"
                ? "date"
                : "text";
          preview.textContent = `→ "${valueInp.value || "…"}" appliqué à ${sel.length} ligne${sel.length > 1 ? "s" : ""}`;
        };
        fieldSel.addEventListener("change", ut);
        valueInp.addEventListener("input", ut);
        ut();
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
        this._toast(`✓ "${col?._label || colId}" mis à jour (${count} lignes)`);
        console.group("✏️ Édition en masse");
        console.log(
          "Champ:",
          col?._label || colId,
          "| Valeur:",
          newVal,
          "| Lignes:",
          count,
        );
        console.groupEnd();
        bootstrap.Modal.getInstance(div)?.hide();
      });
      return div;
    }

    _openBulkModal() {
      const sel = this._rows.filter((r) => r._selected);
      if (!sel.length) {
        this._toast("Sélectionnez au moins une ligne");
        return;
      }
      const o = () =>
        bootstrap.Modal.getOrCreateInstance(this._bulkModalEl).show();
      if (typeof bootstrap !== "undefined") o();
      else {
        const t = setInterval(() => {
          if (typeof bootstrap !== "undefined") {
            clearInterval(t);
            o();
          }
        }, 80);
      }
    }

    bulkEdit(field, value, selOnly = true) {
      const rows = selOnly ? this._rows.filter((r) => r._selected) : this._rows;
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

    // ─────────────────────────────────────────────────────────
    //  COMPARE MODAL
    // ─────────────────────────────────────────────────────────
    _buildCompareModal() {
      const div = document.createElement("div");
      div.className = "modal fade";
      div.tabIndex = "-1";
      div.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-xl"><div class="modal-content" style="border:none;border-radius:6px;overflow:hidden;box-shadow:0 12px 48px rgba(10,20,50,0.28);"><div class="modal-header" style="background:#1c2e4a;color:#e8edf5;border:none;padding:12px 18px;"><h5 class="modal-title" style="font-size:14px;font-weight:600;">⚖️ Comparaison de lignes</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body ng-compare-body" style="padding:0;overflow:auto;max-height:70vh;"></div><div class="modal-footer" style="border-top:1px solid #dee2e6;padding:10px 18px;display:flex;align-items:center;gap:12px;"><label style="font-size:11px;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="ng-compare-diff-only" checked><span>Seulement les différences</span></label><button type="button" class="btn btn-sm btn-secondary ms-auto" data-bs-dismiss="modal">Fermer</button></div></div></div>`;
      const diffOnly = div.querySelector(".ng-compare-diff-only");
      const render = () => {
        const sel = this._rows.filter((r) => r._selected).slice(0, 6);
        if (sel.length < 2) {
          div.querySelector(".ng-compare-body").innerHTML =
            '<div style="padding:30px;text-align:center;color:#8090a8;">Sélectionnez 2 à 6 lignes (Ctrl+clic)</div>';
          return;
        }
        const cols = this._cols.filter(
          (c) => !SYS.includes(c._id) && c._visible,
        );
        const onlyDiff = diffOnly.checked;
        let html =
          '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:inherit;"><thead><tr><th style="background:#1c2e4a;color:#e8edf5;padding:8px 12px;font-size:11px;font-weight:600;text-align:left;position:sticky;top:0;z-index:2;white-space:nowrap;min-width:110px;">Champ</th>';
        sel.forEach((row, i) => {
          const ref = row[cols[0]?._id] || `Ligne ${i + 1}`;
          html += `<th style="background:#243a5e;color:#e8edf5;padding:8px 12px;font-size:11px;font-weight:600;text-align:center;position:sticky;top:0;z-index:2;white-space:nowrap;">${ref}</th>`;
        });
        html += "</tr></thead><tbody>";
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
          html += `<tr style="background:${diffBg};"><td style="padding:7px 12px;border-bottom:1px solid #eee;color:#5a6a80;font-weight:600;white-space:nowrap;">${col._label}</td>`;
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
            html += `<td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:center;${!allSame ? "font-weight:700;" : ""}${color ? `color:${color};` : ""}">${v}</td>`;
          });
          html += "</tr>";
        });
        const dc = cols.filter((col) => {
          const vals = sel.map((r) => String(r[col._id] ?? ""));
          return !vals.every((v) => v === vals[0]);
        }).length;
        html += `</tbody></table><div style="padding:10px 14px;background:#f0f4fa;font-size:11px;color:#5a6a80;border-top:1px solid #d0d5de;"><b>${dc}</b> champ${dc > 1 ? "s" : ""} différent${dc > 1 ? "s" : ""} sur <b>${cols.length}</b></div>`;
        div.querySelector(".ng-compare-body").innerHTML = html;
      };
      div.addEventListener("show.bs.modal", render);
      diffOnly.addEventListener("change", render);
      return div;
    }

    _openCompareModal() {
      const sel = this._rows.filter((r) => r._selected);
      if (sel.length < 2) {
        this._toast("Sélectionnez au moins 2 lignes (Ctrl+clic)");
        return;
      }
      const o = () =>
        bootstrap.Modal.getOrCreateInstance(this._compareModalEl).show();
      if (typeof bootstrap !== "undefined") o();
      else {
        const t = setInterval(() => {
          if (typeof bootstrap !== "undefined") {
            clearInterval(t);
            o();
          }
        }, 80);
      }
    }
    compareRows() {
      this._openCompareModal();
      return this;
    }

    // ─────────────────────────────────────────────────────────
    //  TOAST & TOOLTIP
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  PUBLIC API
    // ─────────────────────────────────────────────────────────
    setData(data = []) {
      this._rawRows = data;
      this._rows = [];
      this._rows = this._flattenTree(data);
      if (this._opts.formulaMode === "eager") this._applyFormulasEager();
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
      const nr = this._flattenTree(data);
      this._rows.push(...nr);
      this._rawRows.push(...data);
      if (this._opts.formulaMode === "eager") this._applyFormulasEager();
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
      const m = typeof pred === "function" ? pred : (r) => r._ngId === pred;
      this._rows.forEach((r) => {
        if (m(r)) Object.assign(r, data);
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
      this._buildHeaders();
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
      return this._cols.filter((c) => !SYS.includes(c._id)).map((c) => c._raw);
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
    exportCSV(filename, selOnly) {
      const rows = selOnly
        ? this._rows.filter((r) => r._selected)
        : this._applyFilters(this._applySorts(this._rows));
      const cols = this._cols.filter((c) => c._visible && !SYS.includes(c._id));
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
      const cols = this._cols.filter((c) => c._visible && !SYS.includes(c._id));
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
    openViewsModal() {
      this._openViewsBsModal();
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
      const t = {
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
      Object.entries(t[theme] || {}).forEach(([k, v]) =>
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
      Object.values(this._activeCharts).forEach(
        (c) => c.destroy && c.destroy(),
      );
      if (this._sentinelObserver) this._sentinelObserver.disconnect();
      if (this._editOverlay) this._editOverlay.remove();
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
    static createGrid(el, opts) {
      return new NexaGrid(el, opts);
    }
  }

  if (typeof module !== "undefined" && module.exports)
    module.exports = NexaGrid;
  else global.NexaGrid = NexaGrid;
})(typeof window !== "undefined" ? window : this);
