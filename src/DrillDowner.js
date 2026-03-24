/* jshint esversion:11 */
class DrillDowner {
    static version = '1.2.4';

    constructor(container, dataArr, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.dataArr = dataArr;

        this.options = Object.assign({
            remoteUrl: null,
            columns: [],
            totals: [],
            colProperties: {},
            groupOrder: [],
            groupOrderCombinations: null,
            availableDimensions: null, // all groupable dim keys; enables parking area when set
            ledger: [],
            idPrefix: 'drillDowner' + Math.random().toString(36).slice(2) + '_',
            azBarSelector: null,
            azBarOrientation: 'vertical',
            controlsSelector: null,
            showGrandTotals: true,
            onLabelClick: null,
            leafRenderer: null, // parameters received: (item, level, dimension, groupOrder, options)
            onGroupOrderChange: null,
        }, options);

        if(this.options.ledger && !Array.isArray(this.options.ledger)) {
            this.options.ledger = [this.options.ledger];
        }
        this.options.ledger = this.options.ledger || [];

        if(this.options.groupOrder.length === 0 && this.options.ledger.length > 0) {
            this.activeLedgerIndex = 0;
        } else {
            this.activeLedgerIndex = -1;
        }

        this.options.totals = this.options.totals || [];
        this.options.columns = this.options.columns || [];
        this._defaultColumns = [...this.options.columns];
        this.options.colProperties = this.options.colProperties || {};

        // Parked-dimensions feature state
        this._parkedEnabled = new Set(); // keys of parked dims whose checkbox is checked (shown as columns)
        this._parkedOrder   = this.options.availableDimensions ? [...this.options.availableDimensions] : [];

        this.azBar = this.options.azBarSelector ? (typeof this.options.azBarSelector === 'string' ?
            document.querySelector(this.options.azBarSelector) : this.options.azBarSelector) : null;
        this.controls = this.options.controlsSelector ? (typeof this.options.controlsSelector === 'string' ?
            document.querySelector(this.options.controlsSelector) : this.options.controlsSelector) : null;

        this._natSort = new Intl.Collator('es-MX', {
            sensitivity: 'base',
            numeric: true,
            caseFirst: 'false'
        }).compare;

        this.grandTotals = this._calculateGrandTotals();

        this._boundOnTableClick = this._onTableClick.bind(this);
        this._onDrillClick = this._onDrillClick.bind(this);
        this._onAZClick = this._onAZClick.bind(this);

        this.render();
    }

    // ---------- Public Methods ----------
    getTable() {
        return this.table;
    }

    changeGroupOrder(newOrder) {
        if(!this.controls) {
            this.options.groupOrder = newOrder;
            this.render();
            return this;
        }
        const oldOrder = [...this.options.groupOrder];
        const select = this.controls.querySelector('select.drillDowner_modern_select');
        if(!select) return this;

        const targetValue = newOrder.join(',');
        let found = false;

        if(this.options.groupOrderCombinations) {
            for(let i = 0; i < this.options.groupOrderCombinations.length; i++) {
                if(this.options.groupOrderCombinations[i].join(',') === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        } else {
            for(let i = 0; i < select.options.length; i++) {
                if(select.options[i].value === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        }

        if(!found) {
            const label = newOrder.map(col => this._getColHeader(col)).join(' → ');
            select.add(new Option(label, targetValue));
            select.value = targetValue;
        }

        if(typeof this.options.onGroupOrderChange === 'function') {
            this.options.onGroupOrderChange(newOrder, oldOrder, this);
        }

        select.dispatchEvent(new Event('change'));
        return this;
    }

    showToLevel(level = 0) {
        if(!this.container) return this;
        if(!this.options.groupOrder || this.options.groupOrder.length === 0) return this;

        if(isNaN(level) || level == null || level < 0) level = 0;
        const maxLevel = this.options.groupOrder.length;
        if(level > maxLevel) level = maxLevel;

        if(this.options.remoteUrl) {
            this._remoteRequest('expandToLevel', level);
            return this;
        }

        const table = this.container.querySelector('table.drillDowner_table');
        if(!table) return this;

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const lvl = +row.getAttribute('data-level');

            row.style.display = (!isNaN(lvl) && lvl > level) ? 'none' : '';

            const drillIcons = row.querySelectorAll('.drillDowner_drill_icon');
            drillIcons.forEach(icon => {
                icon.classList.remove('drillDowner_drill_expanded');
                icon.classList.add('drillDowner_drill_collapsed');
            });
        });

        this._updateBreadcrumbVisuals(level);
        return this;
    }

    collapseAll() {
        if(this.options.remoteUrl) {
            this._remoteRequest('expandToLevel', 0);
            return this;
        }
        return this.showToLevel(0);
    }

    expandAll() {
        if(this.options.remoteUrl) {
            this._remoteRequest('expandToLevel', this.options.groupOrder.length);
            return this;
        }
        return this.showToLevel(this.options.groupOrder.length);
    }

    // Label click
    _onTableClick(e) {
        if(e.target.classList.contains('drillDowner_drill_icon')) {
            this._onDrillClick(e);
            return;
        }

        if(typeof this.options.onLabelClick !== 'function') return;

        const labelSpan = e.target.closest('span[class*="drillDowner_indent_"]');
        if(!labelSpan) return;
        if(e.target.classList.contains('drillDowner_drill_icon')) return;

        const row = labelSpan.closest('tr');
        if(!row) return;


        const level = parseInt(row.getAttribute('data-level') || "0");
        const valuePath = this._getHierarchyForRow(row);

        // Map Values to Columns to create a structured object
        // Result: { Warehouse: "Main WH", Category: "Electronics" }
        const pathMap = {};
        valuePath.forEach((val, index) => {
            const colName = this.options.groupOrder[index];
            pathMap[colName] = val;
        });

        const context = {
            label: labelSpan.innerText.trim(),
            level: level,
            column: this.options.groupOrder[level],
            isLeaf: level > this.options.groupOrder.length,
            hierarchyValues: valuePath,
            hierarchyMap: pathMap,
            groupOrder: [...this.options.groupOrder],
            rowElement: row,
            options: this.options
        };

        this.options.onLabelClick(context);
    }

    _getHierarchyForRow(row) {
        const chain = [];
        let current = row;

        while(current) {
            const span = current.querySelector('span[class*="drillDowner_indent_"]');
            if(span) {
                const clone = span.cloneNode(true);
                // Remove the icon AND the child count badge to get the clean raw text
                clone.querySelectorAll('.drillDowner_drill_icon, .drillDowner_child_count').forEach(el => el.remove());
                chain.unshift(clone.innerText.trim());
            }

            const parentId = current.getAttribute('data-parent');
            if(!parentId || parentId.trim() === "") break;
            current = document.getElementById(parentId);
        }
        return chain;
    }

    destroy() {
        if(this.controls) this.controls.innerHTML = '';
        if(this.azBar) this.azBar.innerHTML = '';

        if(this.table) {
            this.table.removeEventListener('click', this._boundOnTableClick);
        }
        this.container.innerHTML = '';
    }

    render() {
        this.grandTotals = this._calculateGrandTotals();

        if(this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0 && this.options.ledger[this.activeLedgerIndex]) {
            const activeLedger = this.options.ledger[this.activeLedgerIndex];
            if(activeLedger.cols) {
                this.options.columns = activeLedger.cols.filter(c => !this.options.totals.includes(c));
            }
        }

        if(this.options.groupOrder.length > 0) this.activeLedgerIndex = -1;

        this._renderControls();
        this._renderAZBar();

        if(this.options.remoteUrl && !this._isFilling) {
            this._remoteRequest('change_grouping');
            return;
        }

        this._renderTable();
        if(this.options.groupOrder.length > 0) {
            this.showToLevel(0);
        }
    }

    // ---------- Internal Logic ----------

    _renderControls() {
        if(!this.controls) return;

        let container = this.controls.querySelector('.drillDowner_controls_container');
        if(!container) {
            this.controls.innerHTML = `
                <div class="drillDowner_controls_container">
                    <div class="drillDowner_breadcrumb_nav"></div>
                    <div class="drillDowner_grouping_controls"></div>
                </div>`;
            container = this.controls.querySelector('.drillDowner_controls_container');

            this._renderGroupingSelect(container.querySelector('.drillDowner_grouping_controls'));
            this._renderBreadcrumbs(container.querySelector('.drillDowner_breadcrumb_nav'));
            this._renderParkingArea();
            this._setupDndOnControls(); // HTML5 DnD via delegation – attached once
        }
    }

    _renderGroupingSelect(div) {
        if(div.querySelector('select')) return;

        let optionsHtml = '';
        if(this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combo, idx) => {
                optionsHtml += `<option value="${idx}">${combo.map(k => this._getColHeader(k)).join(' → ')}</option>`;
            });
        } else if(this.options.groupOrder.length > 0) {
            const perms = this._generatePermutations(this.options.groupOrder.length);
            perms.slice(0, 9).forEach(p => {
                const keys = p.map(i => this.options.groupOrder[i]);
                optionsHtml += `<option value="${keys.join(',')}">${keys.map(k => this._getColHeader(k)).join(' → ')}</option>`;
            });
        }

        this.options.ledger.forEach((l, i) => {
            optionsHtml += `<option value="__LEDGER_${i}__">${l.label}</option>`;
        });

        div.innerHTML = `<div class="drillDowner_control_group">
            <label class="drillDowner_control_label">Group by:
            <select class="drillDowner_modern_select">${optionsHtml}</select>
            </label>
        </div>${this.options.availableDimensions ? '<div class="drillDowner_parking_area"></div>' : ''}`;

        div.querySelector('select').addEventListener('change', (e) => {
            const val = e.target.value;
            if(val.startsWith('__LEDGER_')) {
                this.activeLedgerIndex = parseInt(val.replace('__LEDGER_', ''));
                this.options.groupOrder = [];
            } else {
                this.activeLedgerIndex = -1;
                this.options.columns = [...this._defaultColumns];

                if(this.options.groupOrderCombinations) {
                    if(/^\d+$/.test(val)) {
                        this.options.groupOrder = this.options.groupOrderCombinations[parseInt(val)];
                    } else {
                        this.options.groupOrder = val.split(',');
                    }
                } else {
                    this.options.groupOrder = val.split(',');
                }
            }

            this._renderBreadcrumbs(this.controls.querySelector('.drillDowner_breadcrumb_nav'));
            this._renderParkingArea();
            this.render();
        });
    }

    _renderBreadcrumbs(nav) {
        nav.innerHTML = '';
        const items = [];
        // Draggable when: reordering (2+ active) OR parking area exists (can eject dims)
        const hasParking = !!this.options.availableDimensions;
        const isDraggable = this.options.groupOrder.length > 1 || (hasParking && this.options.groupOrder.length >= 1);

        if(this.options.groupOrder.length > 0) {
            this.options.groupOrder.forEach((key, i) => {
                items.push(`<button type="button" class="drillDowner_breadcrumb_item" data-level="${i}" data-dim="${key}"${isDraggable ? ' draggable="true"' : ''}>${isDraggable ? '<span class="drillDowner_drag_handle" aria-hidden="true"></span>' : ''}<span>${this._getGroupIcon(key)} ${this._getColHeader(key)}</span></button>`);
                if(i < this.options.groupOrder.length - 1) {
                    items.push(`<button type="button" class="drillDowner_breadcrumb_arrow drillDowner_collapsed" data-arrow-level="${i}">
                        <span class="drillDowner_arrow_icon">▶</span>
                    </button>`);
                }
            });
        } else if(this.activeLedgerIndex >= 0) {
            const label = this.options.ledger[this.activeLedgerIndex].label;
            items.push(`<span class="drillDowner_breadcrumb_item" style="cursor:default"><b>${label}</b></span>`);
        } else if(hasParking) {
            items.push(`<span class="drillDowner_nav_empty_hint">drag a dimension here to group</span>`);
        }
        nav.innerHTML = items.join('');

        nav.querySelectorAll('.drillDowner_breadcrumb_item').forEach(btn => {
            if(btn.dataset.level !== undefined) {
                btn.onclick = () => this.showToLevel(parseInt(btn.dataset.level));
            }
        });
        nav.querySelectorAll('.drillDowner_breadcrumb_arrow').forEach(btn => {
            btn.onclick = () => {
                const lvl = parseInt(btn.dataset.arrowLevel);
                this.showToLevel(btn.classList.contains('drillDowner_expanded') ? lvl : lvl + 1);
            };
        });

        if(isDraggable || hasParking) this._setupTouchOnDraggables(nav);
    }

    // ── HTML5 DnD via event delegation – wired once on this.controls ──────────
    _setupDndOnControls() {
        if(!this.controls || this._dndListenersAttached) return;
        this._dndListenersAttached = true;
        const self = this;

        this.controls.addEventListener('dragstart', (e) => {
            const navBtn  = e.target.closest('.drillDowner_breadcrumb_item[data-level]');
            const parkBtn = e.target.closest('.drillDowner_parking_item[data-dim]');
            if(navBtn) {
                self._h5Zone = 'nav';
                self._h5Idx  = parseInt(navBtn.dataset.level);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `nav:${navBtn.dataset.level}`);
                setTimeout(() => navBtn.classList.add('drillDowner_dragging'), 0);
            } else if(parkBtn) {
                self._h5Zone = 'parking';
                self._h5Dim  = parkBtn.dataset.dim;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `parking:${parkBtn.dataset.dim}`);
                setTimeout(() => parkBtn.classList.add('drillDowner_dragging'), 0);
            }
        });

        this.controls.addEventListener('dragend', () => {
            self.controls.querySelectorAll('.drillDowner_dragging,.drillDowner_drag_over')
                .forEach(el => el.classList.remove('drillDowner_dragging', 'drillDowner_drag_over'));
            self._h5Zone = null;
        });

        this.controls.addEventListener('dragover', (e) => {
            if(!self._h5Zone) return;
            if(e.target.closest('.drillDowner_breadcrumb_item[data-level]') ||
               e.target.closest('.drillDowner_breadcrumb_nav') ||
               e.target.closest('.drillDowner_parking_area')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        this.controls.addEventListener('dragenter', (e) => {
            if(!self._h5Zone) return;
            self.controls.querySelectorAll('.drillDowner_drag_over')
                .forEach(el => el.classList.remove('drillDowner_drag_over'));

            const navBtn   = e.target.closest('.drillDowner_breadcrumb_item[data-level]');
            const parkItem = !navBtn && e.target.closest('.drillDowner_parking_item[data-dim]');
            const parkArea = !navBtn && !parkItem && e.target.closest('.drillDowner_parking_area');
            const navArea  = !navBtn && e.target.closest('.drillDowner_breadcrumb_nav');

            if(navBtn) {
                const isSelf = self._h5Zone === 'nav' && parseInt(navBtn.dataset.level) === self._h5Idx;
                if(!isSelf) navBtn.classList.add('drillDowner_drag_over');
            } else if(navArea && self._h5Zone === 'parking') {
                navArea.classList.add('drillDowner_drag_over');
            } else if(parkArea && self._h5Zone === 'nav') {
                parkArea.classList.add('drillDowner_drag_over');
            } else if(parkItem && self._h5Zone === 'parking' && parkItem.dataset.dim !== self._h5Dim) {
                parkItem.classList.add('drillDowner_drag_over');
            }
        });

        this.controls.addEventListener('dragleave', (e) => {
            const hi = e.target.closest('.drillDowner_drag_over');
            if(hi && !hi.contains(e.relatedTarget)) hi.classList.remove('drillDowner_drag_over');
        });

        this.controls.addEventListener('drop', (e) => {
            if(!self._h5Zone) return;
            e.preventDefault();
            self.controls.querySelectorAll('.drillDowner_dragging,.drillDowner_drag_over')
                .forEach(el => el.classList.remove('drillDowner_dragging', 'drillDowner_drag_over'));

            const navBtn   = e.target.closest('.drillDowner_breadcrumb_item[data-level]');
            const parkItem = !navBtn && e.target.closest('.drillDowner_parking_item[data-dim]');
            const parkArea = !navBtn && !parkItem && e.target.closest('.drillDowner_parking_area');
            const navArea  = !navBtn && e.target.closest('.drillDowner_breadcrumb_nav');

            if(self._h5Zone === 'nav') {
                const fromIdx = self._h5Idx;
                if(navBtn) {
                    const toIdx = parseInt(navBtn.dataset.level);
                    if(fromIdx !== toIdx)
                        self._applyNewGroupOrder(self._reorderArray(self.options.groupOrder, fromIdx, toIdx));
                } else if(parkArea || parkItem) {
                    // Drop on parking background or a parked item: remove from active grouping
                    const newOrder = [...self.options.groupOrder];
                    newOrder.splice(fromIdx, 1);
                    self._applyNewGroupOrder(newOrder);
                }
            } else if(self._h5Zone === 'parking') {
                const dim = self._h5Dim;
                if(navBtn) {
                    const toIdx = parseInt(navBtn.dataset.level);
                    const newOrder = [...self.options.groupOrder];
                    newOrder.splice(toIdx, 0, dim);
                    self._applyNewGroupOrder(newOrder);
                } else if(navArea) {
                    self._applyNewGroupOrder([...self.options.groupOrder, dim]);
                } else if(parkItem && parkItem.dataset.dim !== dim) {
                    // Reorder parked items
                    const toDim   = parkItem.dataset.dim;
                    const fromIdx = self._parkedOrder.indexOf(dim);
                    const toIdx   = self._parkedOrder.indexOf(toDim);
                    if(fromIdx !== -1 && toIdx !== -1) {
                        self._parkedOrder = self._reorderArray(self._parkedOrder, fromIdx, toIdx);
                        self._renderParkingArea();
                        if(self._parkedEnabled.has(dim) || self._parkedEnabled.has(toDim)) self.render();
                    }
                }
            }
            self._h5Zone = null;
        });
    }

    // ── Touch drag – per-element, handles cross-zone (nav ↔ parking) ────────
    _setupTouchOnDraggables(container) {
        const self = this;
        container.querySelectorAll('[draggable="true"]').forEach(el => {
            let ts = null;

            el.addEventListener('touchstart', (e) => {
                if(e.target.closest('input[type=checkbox]')) return; // let checkbox handle its own touch
                if(e.touches.length !== 1) return;
                const t = e.touches[0];
                ts = { startX: t.clientX, startY: t.clientY, dragging: false,
                       targetType: null, target: null };
            }, { passive: true });

            el.addEventListener('touchmove', (e) => {
                if(!ts) return;
                const t = e.touches[0];
                const dx = Math.abs(t.clientX - ts.startX), dy = Math.abs(t.clientY - ts.startY);
                if(!ts.dragging && (dx > 8 || dy > 8)) {
                    ts.dragging = true;
                    el.classList.add('drillDowner_dragging');
                }
                if(!ts.dragging) return;
                e.preventDefault();

                const pt       = document.elementFromPoint(t.clientX, t.clientY);
                const navBtn   = pt && pt.closest('.drillDowner_breadcrumb_item[data-level]');
                const parkItem = pt && !navBtn && pt.closest('.drillDowner_parking_item[data-dim]');
                const parkArea = pt && !navBtn && !parkItem && pt.closest('.drillDowner_parking_area');
                const navArea  = !navBtn && pt && pt.closest('.drillDowner_breadcrumb_nav');

                if(self.controls) self.controls.querySelectorAll('.drillDowner_drag_over')
                    .forEach(b => b.classList.remove('drillDowner_drag_over'));

                if(navBtn && navBtn !== el) {
                    navBtn.classList.add('drillDowner_drag_over');
                    ts.targetType = 'navBtn'; ts.target = navBtn;
                } else if(parkItem && parkItem !== el) {
                    parkItem.classList.add('drillDowner_drag_over');
                    ts.targetType = 'parkItem'; ts.target = parkItem;
                } else if(parkArea && !parkArea.contains(el)) {
                    parkArea.classList.add('drillDowner_drag_over');
                    ts.targetType = 'parkArea'; ts.target = parkArea;
                } else if(navArea && !navArea.contains(el)) {
                    navArea.classList.add('drillDowner_drag_over');
                    ts.targetType = 'navArea'; ts.target = navArea;
                } else {
                    ts.targetType = null; ts.target = null;
                }
            }, { passive: false });

            el.addEventListener('touchend', (e) => {
                if(!ts) return;
                const state = ts; ts = null;
                el.classList.remove('drillDowner_dragging');
                if(self.controls) self.controls.querySelectorAll('.drillDowner_drag_over')
                    .forEach(b => b.classList.remove('drillDowner_drag_over'));
                if(!state.dragging || !state.targetType) return;
                e.preventDefault();

                const isNavEl = !!el.closest('.drillDowner_breadcrumb_nav');
                if(isNavEl) {
                    const fromIdx = parseInt(el.dataset.level);
                    if(state.targetType === 'navBtn') {
                        const toIdx = parseInt(state.target.dataset.level);
                        if(fromIdx !== toIdx)
                            self._applyNewGroupOrder(self._reorderArray(self.options.groupOrder, fromIdx, toIdx));
                    } else if(state.targetType === 'parkArea' || state.targetType === 'parkItem') {
                        // Remove from active grouping (drop on parking zone)
                        const newOrder = [...self.options.groupOrder];
                        newOrder.splice(fromIdx, 1);
                        self._applyNewGroupOrder(newOrder);
                    }
                } else { // parking item
                    const dim = el.dataset.dim;
                    if(state.targetType === 'navBtn') {
                        const toIdx = parseInt(state.target.dataset.level);
                        const newOrder = [...self.options.groupOrder];
                        newOrder.splice(toIdx, 0, dim);
                        self._applyNewGroupOrder(newOrder);
                    } else if(state.targetType === 'navArea') {
                        self._applyNewGroupOrder([...self.options.groupOrder, dim]);
                    } else if(state.targetType === 'parkItem' && state.target.dataset.dim !== dim) {
                        // Reorder parked items
                        const toDim   = state.target.dataset.dim;
                        const fromIdx = self._parkedOrder.indexOf(dim);
                        const toIdx   = self._parkedOrder.indexOf(toDim);
                        if(fromIdx !== -1 && toIdx !== -1) {
                            self._parkedOrder = self._reorderArray(self._parkedOrder, fromIdx, toIdx);
                            self._renderParkingArea();
                            if(self._parkedEnabled.has(dim) || self._parkedEnabled.has(toDim)) self.render();
                        }
                    }
                }
            });

            el.addEventListener('touchcancel', () => {
                if(!ts) return; ts = null;
                el.classList.remove('drillDowner_dragging');
                if(self.controls) self.controls.querySelectorAll('.drillDowner_drag_over')
                    .forEach(b => b.classList.remove('drillDowner_drag_over'));
            });
        });
    }

    _reorderArray(arr, fromIdx, toIdx) {
        const result = [...arr];
        const [item] = result.splice(fromIdx, 1);
        result.splice(toIdx, 0, item);
        return result;
    }

    _applyNewGroupOrder(newOrder) {
        const oldOrder = [...this.options.groupOrder];
        this.options.groupOrder = newOrder;
        this.activeLedgerIndex = -1;
        this.options.columns = [...this._defaultColumns];

        // Sync the select box silently (no 'change' event – avoids double render)
        const select = this.controls && this.controls.querySelector('select.drillDowner_modern_select');
        if(select) {
            const targetValue = newOrder.join(',');
            let found = false;

            if(this.options.groupOrderCombinations) {
                for(let i = 0; i < this.options.groupOrderCombinations.length; i++) {
                    if(this.options.groupOrderCombinations[i].join(',') === targetValue) {
                        select.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
            }

            if(!found) {
                for(let i = 0; i < select.options.length; i++) {
                    if(select.options[i].value === targetValue) {
                        select.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
            }

            if(!found) {
                const label = newOrder.map(col => this._getColHeader(col)).join(' → ');
                select.add(new Option(label, targetValue));
                select.value = targetValue;
            }
        }

        if(typeof this.options.onGroupOrderChange === 'function')
            this.options.onGroupOrderChange(newOrder, oldOrder, this);

        // Re-render breadcrumbs, parking area, then table
        const nav = this.controls && this.controls.querySelector('.drillDowner_breadcrumb_nav');
        if(nav) this._renderBreadcrumbs(nav);
        this._renderParkingArea();
        this.render();
    }

    _updateBreadcrumbVisuals(level) {
        if(!this.controls) return;
        this.controls.querySelectorAll('.drillDowner_breadcrumb_arrow').forEach((arrow, i) => {
            const isExpanded = i < level;
            arrow.classList.toggle('drillDowner_expanded', isExpanded);
            arrow.classList.toggle('drillDowner_collapsed', !isExpanded);
        });
    }

    _getParkedDimensions() {
        if(!this.options.availableDimensions) return [];
        // Use _parkedOrder (user-arranged) as the authoritative sequence; filter to only those not active
        return this._parkedOrder.filter(d => !this.options.groupOrder.includes(d));
    }

    _renderParkingArea() {
        if(!this.options.availableDimensions || !this.controls) return;
        const div = this.controls.querySelector('.drillDowner_parking_area');
        if(!div) return;

        const parked = this._getParkedDimensions();
        if(parked.length === 0) {
            div.innerHTML = '<span class="drillDowner_parking_empty">drag here to remove from grouping</span>';
            return;
        }

        div.innerHTML = parked.map(key => {
            const checked = this._parkedEnabled.has(key) ? ' checked' : '';
            return `<div class="drillDowner_parking_item" data-dim="${key}" draggable="true">` +
                `<span class="drillDowner_drag_handle" aria-hidden="true"></span>` +
                `<input type="checkbox" class="drillDowner_parking_checkbox" data-dim="${key}"${checked} tabindex="-1" aria-label="${this._getColHeader(key)} as column">` +
                `<span>${this._getGroupIcon(key)} ${this._getColHeader(key)}</span>` +
                `</div>`;
        }).join('');

        // Checkbox toggle: add/remove from enabled set and re-render table
        div.querySelectorAll('.drillDowner_parking_checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const dim = e.target.dataset.dim;
                if(e.target.checked) this._parkedEnabled.add(dim);
                else this._parkedEnabled.delete(dim);
                this.render();
            });
            // Prevent accidental drag when user clicks the checkbox
            cb.addEventListener('mousedown', e => e.stopPropagation());
        });

        this._setupTouchOnDraggables(div);
    }

    // ---------- Table Rendering ----------

    _renderTable() {
        this.container.innerHTML = '';
        const groupCols = this.options.groupOrder.length > 0 ? ["Item"] : ["#"];
        const activeLed = (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0)
            ? this.options.ledger[this.activeLedgerIndex] : null;
        // Parked dimensions whose checkbox is checked appear as extra columns (in user-arranged order)
        const parkedActiveCols = this._getParkedDimensions().filter(d => this._parkedEnabled.has(d));
        const orderedCols = activeLed?.cols
            ? [...activeLed.cols, ...this.options.totals.filter(c => !activeLed.cols.includes(c))]
            : [...this.options.totals, ...this.options.columns, ...parkedActiveCols];
        const allHeaders = [...groupCols, ...orderedCols.map(c => this._getColHeader(c))];

        const table = document.createElement('table');
        table.className = 'drillDowner_table';
        const thead = table.createTHead();
        const hr = thead.insertRow();
        allHeaders.forEach((h, i) => {
            const th = document.createElement('th');
            if(i === 0) {
                th.textContent = h;
            } else {
                const col = orderedCols[i - 1];
                const isTotal = this.options.totals.includes(col);
                if(isTotal) {
                    th.className = this._getColLabelClass(col) + (this.options.showGrandTotals ? " drillDownerThTotal" : "");
                    th.innerHTML = this.options.showGrandTotals ? `${h}<br><small>${this._formatGrandTotal(col)}</small>` : h;
                } else {
                    th.className = this._getColLabelClass(col);
                    th.textContent = h;
                }
            }
            hr.appendChild(th);
        });

        const tbody = table.createTBody();

        // --- LEDGER VIEW (FLAT) ---
        if(this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0) {
            const led = this.options.ledger[this.activeLedgerIndex];
            const calcKeys = (led.sort || []).map(k => k.startsWith('-') ? k.substring(1) : k);

            const calcList = [...this.dataArr];
            this._sortData(this.dataArr, led.sort);

            const runningTotals = {};
            let hasInitialBalance = false;

            this.options.totals.forEach(col => {
                const props = this._getColProperty(col, 'balanceBehavior');
                if (props) {
                    runningTotals[col] = (typeof props.initialBalance === 'number') ? props.initialBalance : 0;
                    if (typeof props.initialBalance === 'number') hasInitialBalance = true;
                } else {
                    runningTotals[col] = 0;
                }
            });

            const balanceMap = new Map();

            calcList.forEach(item => {
                const itemOverrides = {};
                this.options.totals.forEach(col => {
                    const props = this._getColProperty(col, 'balanceBehavior');
                    if (props) {
                        const impact = this._calculateRowImpact(item, col);
                        runningTotals[col] += impact;
                        itemOverrides[col] = runningTotals[col];
                    } else {
                        // For normal totals without balanceBehavior, maybe accumulate them too?
                        // But for now, keep original behavior
                        itemOverrides[col] = item[col];
                    }
                });
                balanceMap.set(item, itemOverrides);
            });

            // --- PASS 2: Render in Display Order ---
            this._sortData(this.dataArr, led.sort);

            // Determine if sort is Descending (starts with '-') to place Initial Balance at Bottom
            const isDescending = (led.sort && led.sort.length > 0 && led.sort[0].startsWith('-'));

            // When descending, reverse within-key groups so the item with the highest running
            // balance (accumulated last in Pass 1) appears first within each same-key bucket.
            if(isDescending && calcKeys.length > 0) {
                const pk = calcKeys[0];
                let i = 0;
                while(i < this.dataArr.length) {
                    let j = i + 1;
                    while(j < this.dataArr.length &&
                    String(this.dataArr[j][pk] || '') === String(this.dataArr[i][pk] || '')) {
                        j++;
                    }
                    if(j - i > 1) this.dataArr.splice(i, j - i, ...this.dataArr.slice(i, j).reverse());
                    i = j;
                }
            }

            // --- Helper to Render Initial Balance Row ---
            const renderInitialRow = () => {
                const tr = tbody.insertRow();
                tr.className = 'drillDowner_initial_row'; // Styling hook
                tr.style.backgroundColor = '#fafafa'; // Light gray to distinguish
                tr.style.fontStyle = 'italic';

                tr.insertCell().innerHTML = ''; // Indent cell

                let labelSet = false;
                led.cols.forEach(col => {
                    const td = tr.insertCell();
                    const isTotal = this.options.totals.includes(col);
                    if(isTotal) {
                        td.className = 'drillDowner_num';
                        const props = this._getColProperty(col, 'balanceBehavior');
                        if(props && typeof props.initialBalance === 'number') {
                            const dec = this._getColDecimals(col);
                            const fmt = this._getColFormatter(col);
                            const val = props.initialBalance;
                            td.innerHTML = fmt ? fmt(val, {}) : DrillDowner.formatNumber(val, dec);
                        } else {
                            td.innerHTML = '';
                        }
                    } else {
                        td.className = this._getColClass(col);
                        if(!labelSet) {
                            td.innerHTML = 'Initial Balance';
                            labelSet = true;
                        } else {
                            td.innerHTML = '';
                        }
                    }
                });
            };

            // IF ASCENDING: Render Top
            if(hasInitialBalance && !isDescending) renderInitialRow();

            this.dataArr.forEach((item, idx) => {
                const tr = tbody.insertRow();
                if(idx % 2) tr.className = 'drillDowner_even';
                tr.insertCell().innerHTML = `<span class="drillDowner_indent_0">${idx + 1}</span>`;
                const rowOverrides = balanceMap.get(item) || {};
                this._appendDataCells(tr, item, null, true, rowOverrides, 0, led.cols);
            });

            // IF DESCENDING: Render Bottom (Just above Footer)
            if(hasInitialBalance && isDescending) renderInitialRow();

            // --- GROUPED VIEW (HIERARCHICAL) ---
        } else {
            this._sortData(this.dataArr, this.options.groupOrder);
            this._buildFlatRows(this.dataArr, this.options.groupOrder, 0, {}, [], tbody);
        }

        if(this.options.showGrandTotals) {
            const tf = table.createTFoot();
            const tr = tf.insertRow();
            allHeaders.forEach((_, i) => {
                const td = tr.insertCell();
                if(i === 0) {
                    td.innerHTML = '<b>Total</b>';
                    td.className = "drillDowner_right";
                } else {
                    const col = orderedCols[i - 1];
                    if(this.options.totals.includes(col)) {
                        td.className = "drillDowner_num drillDownerTfootTotal " + this._getColLabelClass(col);
                        td.innerHTML = this._formatGrandTotal(col);
                    }
                }
            });
        }
        this.container.appendChild(table);

        if(this.table)
            this.table.removeEventListener('click', this._boundOnTableClick);
        this.table = table;
        this.table.addEventListener('click', this._boundOnTableClick);

    }

    _idCounter = 1;

    _buildFlatRows(data, groupOrder, level, parents, rows, tbody) {
        if(level >= groupOrder.length) return;

        const col = groupOrder[level];
        const isLeafLevel = (level === groupOrder.length - 1);
        const grouped = {};

        data.forEach((r) => {
            let key = "";

            if(typeof col === "string" && col !== "") {
                key = r?.[col] ?? "";
            } else if(typeof col === "function") {
                key = col(r) ?? "";
            } else if(Array.isArray(col)) {
                key = col.map(c => r?.[c] ?? "").join(" &rarr; ");
            }


            (grouped[key] = grouped[key] || []).push(r);
        });

        Object.keys(grouped).forEach((key, i) => {
            const gData = grouped[key];

            const keys = groupOrder
                .slice(0, level + 1)
                .map((c, idx) => {
                    if(idx === level) return key;
                    return parents[c] ?? "";
                });

            const rowId = this.options.idPrefix + "row_" + (this._idCounter++);

            const pathKey = JSON.stringify(keys);
            const parentPathKey = JSON.stringify(keys.slice(0, -1));
            const parentRowId = (level === 0)
                ? " "
                : (rows[parentPathKey] || " ");

            rows[pathKey] = rowId;

            let anchorHtml = " ";
            if(level === 0) {
                const char = String(key)[0]?.toUpperCase();
                if(char) {
                    anchorHtml = `<span id="${this.options.idPrefix}az${this._sanitizeIdPart(char)}"></span>`;
                }
            }

            this._buildRow({
                tbody: tbody,
                rowId: rowId,
                level: level,
                hierarchy: keys,
                parentRowId: parentRowId,

                groupKey: key,
                item: gData[0],
                gData: gData,

                anchorHtml: anchorHtml,

                addEvenClass: !!(i % 2),
                addFirstGroupClass: (i === 0)
            });

            if(!isLeafLevel) {
                this._buildFlatRows(
                    gData,
                    groupOrder,
                    level + 1,
                    {...parents, [col]: key},
                    rows,
                    tbody
                );
            }
        });
    }

    _buildRow({
                  tbody,
                  insertAfterRow = null,

                  rowId,
                  level,
                  hierarchy = [],
                  parentRowId = " ",

                  groupKey = null,
                  item = null,
                  gData = null,

                  anchorHtml = " ", // html string with an id for azBar letter click

                  rowOverrides = {},

                  addEvenClass = false,
                  addFirstGroupClass = false
              }) {
        const rowSpec = this._getRowSpec({
            level: level,
            groupKey: groupKey,
            item: item,
            gData: gData,
            hierarchy: hierarchy,
            parentRowId: parentRowId,
            anchorHtml: anchorHtml,  // html string with an id for azBar letter click

        });

        const tr = insertAfterRow
            ? tbody.insertRow(insertAfterRow.sectionRowIndex + 1)
            : tbody.insertRow();

        tr.id = rowId;
        tr.setAttribute('data-level', rowSpec.level);
        tr.setAttribute('data-dimension', rowSpec.dimension);
        tr.setAttribute('data-parent', rowSpec.parentRowId);
        tr.setAttribute('data-hierarchy', JSON.stringify(rowSpec.hierarchy));

        if(addEvenClass) tr.classList.add('drillDowner_even');
        if(addFirstGroupClass) tr.classList.add('drillDowner_first_group');

        const cell = tr.insertCell();

        let iconHtml = '';
        if(rowSpec.showDrillIcon) {
            iconHtml =
                `<span class="drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${rowSpec.level}"></span>`;

            if(rowSpec.childCount !== null) {
                iconHtml += `<span class="drillDowner_child_count">${rowSpec.childCount}</span> `;
            }
        }

        cell.innerHTML =
            `${rowSpec.anchorHtml}<span class="drillDowner_indent_${rowSpec.level}">${iconHtml}${rowSpec.labelHtml}</span>`;

        this._appendDataCells(
            tr,
            item,
            gData,
            rowSpec.isLeaf,
            rowOverrides,
            rowSpec.level
        );

        return tr;
    }

    _getRowSpec({
                    level,
                    groupKey = null,
                    item = null,
                    gData = null,
                    hierarchy = [],
                    parentRowId = " ",
                    anchorHtml = " ",

                }) {
        const groupOrder = this.options.groupOrder || [];
        const lastLevel = groupOrder.length - 1;
        const isLeaf = (groupOrder.length > 0) && (level === lastLevel);
        const showDrillIcon = !isLeaf;
        const showTotals = true;

        const dimension = (typeof groupOrder[level] === "string")
            ? groupOrder[level]
            : "";

        let label = "";
        let labelHtml = "";

        if(isLeaf) {
            label = groupKey ?? "";
            const renderer = this.options.leafRenderer
                ?? this.options.colProperties[dimension]?.renderer
                ?? null;
            labelHtml = renderer
                ? renderer(item, level, dimension, groupOrder, this.options)
                : String(label);
        } else {
            label = groupKey ?? "";
            const renderer = this.options.colProperties[dimension]?.renderer ?? null;
            const defaultHtml = (level === 0) ? `<b>${String(label)}</b>` : String(label);
            labelHtml = renderer
                ? renderer(item, level, dimension, groupOrder, this.options)
                : defaultHtml;
        }

        const childCount = showDrillIcon && Array.isArray(gData)
            ? gData.length
            : null;

        return {
            level: level,
            isLeaf: isLeaf,
            showDrillIcon: showDrillIcon,
            showTotals: showTotals,

            dimension: dimension,
            label: label,
            labelHtml: labelHtml,

            childCount: childCount,

            hierarchy: hierarchy,
            parentRowId: parentRowId,
            anchorHtml: anchorHtml,


        };
    }


    _appendDataCells(tr, item, gData, isLeaf, overrides = {}, level = 0, ledgerCols = null) {
        if(ledgerCols) {
            // --- Render columns specified in ledger ---
            ledgerCols.forEach(col => {
                const td = tr.insertCell();
                const isTotal = this.options.totals.includes(col);
                if(isTotal) {
                    td.className = 'drillDowner_num';
                    try {
                        const dec = this._getColDecimals(col);
                        const fmt = this._getColFormatter(col);
                        let val;
                        if(overrides && overrides.hasOwnProperty(col)) {
                            val = overrides[col];
                        } else if(this._getColProperty(col, 'balanceBehavior')) {
                            val = this._calculateRowImpact(item, col);
                        } else {
                            val = item[col];
                        }
                        td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                    } catch(err) {
                        console.error(`DrillDowner: Error rendering total cell [${col}]`, err, item);
                        td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
                    }
                } else {
                    td.className = this._getColClass(col);
                    try {
                        const renderer = this.options.colProperties[col]?.renderer ?? null;
                        if(renderer) {
                            td.innerHTML = renderer(item, level, col, this.options.groupOrder, this.options);
                            return;
                        }
                        let val = item[col] ?? "";
                        const fmt = this._getColFormatter(col);
                        td.innerHTML = fmt ? fmt(val, item) : val;
                    } catch(er) {
                        console.error(`DrillDowner._appendDataCells: Error rendering [${col}]`, er, item);
                        td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
                    }
                }
            });

            // === FIX: Render extra totals (e.g. running balance columns) that were in orderedCols but not in ledger.cols ===
            const extraTotals = this.options.totals.filter(c => !ledgerCols.includes(c));
            extraTotals.forEach(col => {
                const td = tr.insertCell();
                td.className = 'drillDowner_num';
                try {
                    const dec = this._getColDecimals(col);
                    const fmt = this._getColFormatter(col);
                    let val;
                    if(overrides && overrides.hasOwnProperty(col)) {
                        val = overrides[col];
                    } else if(this._getColProperty(col, 'balanceBehavior')) {
                        val = this._calculateRowImpact(item, col);
                    } else {
                        val = item[col] || 0;
                    }
                    td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                } catch(err) {
                    console.error(`DrillDowner: Error rendering extra total [${col}]`, err, item);
                    td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
                }
            });
            return;
        }
        this.options.totals.forEach(col => {
            const td = tr.insertCell();
            td.className = 'drillDowner_num';
            try {
                const dec = this._getColDecimals(col);
                const fmt = this._getColFormatter(col);

                if(gData) {
                    // --- GROUPED VIEW ---
                    const subBy = this._getColProperty(col, 'subTotalBy');
                    if(!subBy) {
                        let val;
                        if(this._getColProperty(col, 'balanceBehavior')) {
                            val = gData.reduce((s, r) => s + this._calculateRowImpact(r, col), 0);
                        } else {
                            val = gData.reduce((s, r) => {
                                const v = Number(r[col]);
                                return s + (isFinite(v) ? v : 0);
                            }, 0);
                        }
                        td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                    } else {
                        const sub = {};
                        gData.forEach(r => {
                            const v = this._getColProperty(col, 'balanceBehavior')
                                ? this._calculateRowImpact(r, col)
                                : Number(r[col]);
                            sub[r[subBy]] = (sub[r[subBy]] || 0) + isFinite(v) ? v : 0;
                        });
                        const val = Object.entries(sub).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join(', ') || '-';
                        td.innerHTML = fmt ? fmt(val, item) : val;
                    }
                } else {
                    // --- LEDGER VIEW ---
                    let val;
                    if(overrides && overrides.hasOwnProperty(col)) {
                        val = overrides[col];
                    } else if(this._getColProperty(col, 'balanceBehavior')) {
                        val = this._calculateRowImpact(item, col);
                    } else {
                        val = item[col];
                    }
                    td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                }
            } catch(err) {
                console.error(`DrillDowner: Error rendering total cell [${col}]`, err, item);
                td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
            }
        });
        this.options.columns.forEach(col => {
            const td = tr.insertCell();
            td.className = this._getColClass(col);
            try {
                const renderer = this.options.colProperties[col]?.renderer ?? null;
                if(renderer) {
                    td.innerHTML = renderer(item, level, col, this.options.groupOrder, this.options);
                    return;
                }
                let val = "";
                if(gData && this._getColTogglesUp(col)) val = Array.from(new Set(gData.map(r => r[col]))).join(', ');
                else if(!gData || isLeaf) val = item[col] ?? "";
                const fmt = this._getColFormatter(col);
                td.innerHTML = fmt ? fmt(val, item) : val;
            } catch(er) {
                console.error(`DrillDowner._appendDataCells: Error rendering [${col}]`, er, item);
                td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
            }
        });

        // Render checked parked-dimension columns (in user-arranged order)
        const parkedActiveCols = this._getParkedDimensions().filter(d => this._parkedEnabled.has(d));
        parkedActiveCols.forEach(col => {
            const td = tr.insertCell();
            td.className = this._getColClass(col);
            try {
                const renderer = this.options.colProperties[col]?.renderer ?? null;
                if(renderer) {
                    td.innerHTML = renderer(item, level, col, this.options.groupOrder, this.options);
                    return;
                }
                let val = "";
                if(gData && this._getColTogglesUp(col)) val = Array.from(new Set(gData.map(r => r[col]))).join(', ');
                else if(!gData || isLeaf) val = item[col] ?? "";
                const fmt = this._getColFormatter(col);
                td.innerHTML = fmt ? fmt(val, item) : val;
            } catch(er) {
                console.error(`DrillDowner._appendDataCells: Error rendering parked col [${col}]`, er, item);
                td.innerHTML = '<span style="color:red" title="Render Error">⚠️</span>';
            }
        });
    }

    _getColProperty(c, p, defautValue = null) {
        return this.options.colProperties[c]?.[p] ?? defautValue;
    }

    _getColDecimals(c) {
        return this._getColProperty(c, 'decimals', 2);
    }

    _getColHeader(c) {
        return this._getColProperty(c, 'label', c.charAt(0).toUpperCase() + c.slice(1));
    }

    _getGroupIcon(c) {
        return this._getColProperty(c, 'icon', '');
    }

    _getColClass(c) {
        return this._getColProperty(c, 'class', '');
    }

    _getColLabelClass(c) {
        return this._getColProperty(c, 'labelClass', '');
    }

    _getColTogglesUp(c) {
        return this._getColProperty(c, 'togglesUp', false);
    }

    _getColFormatter(c) {
        return this._getColProperty(c, 'formatter', null);
    }

    _sanitizeIdPart(value) {
        return String(value ?? '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    _calculateRowImpact(row, colKey) {
        const props = this._getColProperty(colKey, 'balanceBehavior');
        if(!props) return Number(row[colKey]) || 0;
        let val = 0;
        if(Array.isArray(props.add)) {
            props.add.forEach(c => {
                val += (Number(row[c]) || 0);
            });
        }
        if(Array.isArray(props.subtract)) {
            props.subtract.forEach(c => {
                val -= (Number(row[c]) || 0);
            });
        }
        return val;
    }

    _onDrillClick(e) {
        const icon = e.target;
        const rowId = icon.dataset.rowid;
        const expanded = icon.classList.contains('drillDowner_drill_expanded');

        if(this.options.remoteUrl && !expanded) {
            this._remoteRequest('expand', icon);
            return;
        }

        icon.classList.toggle('drillDowner_drill_expanded', !expanded);
        icon.classList.toggle('drillDowner_drill_collapsed', expanded);

        const setVisible = (pId, vis) => {
            this.table.querySelectorAll(`tr[data-parent="${pId}"]`).forEach(r => {
                r.style.display = vis ? '' : 'none';
                if(!vis) {
                    const i = r.querySelector('.drillDowner_drill_icon');
                    if(i) {
                        i.classList.remove('drillDowner_drill_expanded');
                        i.classList.add('drillDowner_drill_collapsed');
                    }
                    setVisible(r.id, false);
                }
            });
        };
        setVisible(rowId, !expanded);
    }

    _onAZClick() {
        setTimeout(() => window.scrollBy(0, -30), 1);
    }

    _renderAZBar() {
        if(!this.azBar || this.options.groupOrder.length === 0) {
            if(this.azBar) this.azBar.innerHTML = '';
            return;
        }
        const col = this.options.groupOrder[0];
        const letters = new Set(this.dataArr.map(x => String(x[col] || "")[0]?.toUpperCase()));
        let html = '';
        for(let i = 65; i <= 90; i++) {
            const c = String.fromCharCode(i);
            html += letters.has(c) ? `<div><a href="#${this.options.idPrefix}az${this._sanitizeIdPart(c)}" aria-label="Ir a la letra ${c}" class="drillDowner_az_link">${c}</a></div>` : `<div class="drillDowner_az_dimmed">${c}</div>`;
        }
        this.azBar.innerHTML = html;
        this.azBar.querySelectorAll('.drillDowner_az_link').forEach(a => a.onclick = () => this._onAZClick());
        this._applyAzBarOrientation();
    }

    _applyAzBarOrientation() {
        if(!this.azBar) return;
        this.azBar.classList.add('drillDowner_az_bar');

        const ori = (this.options.azBarOrientation || 'vertical').toLowerCase();
        const isH = (ori === 'horizontal' || ori === 'h' || ori === 'row');

        if(isH) {
            this.azBar.classList.add('drillDowner_az_bar_horizontal');
        } else {
            this.azBar.classList.remove('drillDowner_az_bar_horizontal');
        }
    }

    _calculateGrandTotals() {
        const t = {};
        this.options.totals.forEach(c => {
            const sub = this._getColProperty(c, 'subTotalBy');
            if(!sub) {
                const props = this._getColProperty(c, 'balanceBehavior');
                if(props) {
                    const startBal = (typeof props.initialBalance === 'number') ? props.initialBalance : 0;
                    t[c] = this.dataArr.reduce((s, r) => s + this._calculateRowImpact(r, c), startBal);
                } else {
                    t[c] = this.dataArr.reduce((s, r) => {
                        const v = Number(r[c]);
                        return s + (isFinite(v) ? v : 0);
                    }, 0);
                }
            } else {
                const res = {};
                this.dataArr.forEach(r => {
                    if(r[c] != null || this._getColProperty(c, 'balanceBehavior')) {
                        const val = this._getColProperty(c, 'balanceBehavior')
                            ? this._calculateRowImpact(r, c)
                            : (Number(r[c]) || 0);
                        res[r[sub]] = (res[r[sub]] || 0) + val;
                    }
                });
                t[c] = res;
            }
        });
        return t;
    }

    _formatGrandTotal(c) {
        const val = this.grandTotals[c], dec = this._getColDecimals(c);
        if(typeof val !== 'object') return DrillDowner.formatNumber(val, dec);
        return Object.entries(val).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join('<br>') || '-';
    }

    _sortData(arr, keys) {
        if(!keys?.length) return arr;
        return arr.sort((a, b) => {
            for(let k of keys) {
                const desc = k.startsWith('-');
                const key = desc ? k.substring(1) : k;
                const r = this._natSort(String(a[key] || ""), String(b[key] || ""));
                if(r !== 0) return desc ? -r : r;
            }
            return 0;
        });
    }

    static formatNumber(n, d) {
        if(n == null || isNaN(n) || n === '') return n || '';
        let parts = Number(n).toFixed(d).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join('.');
    }

    static _SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    static formatDate(value, includeTime = false) {
        if(!value) return "";

        let y, m, d, h = 0, min = 0;
        let hasTime = false;

        if(value instanceof Date) {
            if(isNaN(value.getTime())) return "";
            y = value.getFullYear();
            m = value.getMonth();
            d = value.getDate();
            if(includeTime) {
                h = value.getHours();
                min = value.getMinutes();
                hasTime = true;
            }
        } else if(typeof value === 'string') {
            const match = value.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
            if(!match) return value; // Return raw string if regex fails

            y = parseInt(match[1], 10);
            m = parseInt(match[2], 10) - 1; // 0-indexed
            d = parseInt(match[3], 10);

            if(includeTime && match[4] && match[5]) {
                h = parseInt(match[4], 10);
                min = parseInt(match[5], 10);
                hasTime = true;
            }
        } else {
            return String(value);
        }

        // Fallback to '??' if month index is invalid (e.g., "0000-00-00")
        const MMM = DrillDowner._SHORT_MONTHS[m] || '??';

        // Fully inlined template literal for minimal footprint
        let result = `${String(d).padStart(2, '0')}/${MMM}/${String(y).slice(-2)}`;

        if(includeTime && hasTime) {
            result += ` ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        }

        return result;
    }

    _generatePermutations(n, limit = 9) {
        const res = [];
        const p = (a, s = 0) => {
            if(res.length >= limit) return;
            if(s === a.length - 1) {
                res.push([...a]);
                return;
            }
            for(let i = s; i < a.length; i++) {
                [a[s], a[i]] = [a[i], a[s]];
                p(a, s + 1);
                [a[s], a[i]] = [a[i], a[s]];
                if(res.length >= limit) return;
            }
        };
        p(Array.from({length: n}, (_, i) => i));
        return res;
    }

    /**
     * Finds a row based on the hierarchy array to avoid badly built ID issues
     */
    _findRowByHierarchy(displayNames) {
        const targetPath = JSON.stringify(displayNames);
        return Array.from(this.table.querySelectorAll('tr')).find(tr =>
            tr.getAttribute('data-hierarchy') === targetPath
        );
    }

    /* region: mode remote/fetch ___________________________________________________________________________________ */

    _getRequestPayload(action, target = null) {
        const payload = {
            action: action,

            data: {
                level: 0,
                expandingLevel: 0,
                groupingDimension: null,
                displayNames: [],
                rowId: null,
                groupOrder: this.options.groupOrder,
                requestedTotals: this.options.totals,
                requestedColumns: this.options.columns,
            }
        };

        if(action === 'expand' && target) {
            const row = target.closest('tr');
            const level = parseInt(row.getAttribute('data-level') || 0);
            Object.assign(payload.data, {                              // ← was payload.data =
                level: level,
                expandingLevel: level + 1,
                groupingDimension: row.getAttribute('data-dimension'),
                displayNames: JSON.parse(row.getAttribute('data-hierarchy') || '[]'), // ← raw values
                rowId: row.id
            });
        } else if(action === 'expandToLevel') {
            // Safe check for target and its dataset
            let targetLevel = 0;
            if(target) {
                if(target.dataset.level !== undefined) {
                    targetLevel = parseInt(target.dataset.level);
                } else if(target.dataset.arrowLevel !== undefined) {
                    const isExpanded = target.classList.contains('drillDowner_expanded');
                    const arrowLvl = parseInt(target.dataset.arrowLevel);
                    targetLevel = isExpanded ? arrowLvl : arrowLvl + 1;
                }
            }

            payload.data.level = targetLevel;
            payload.data.expandingLevel = targetLevel;
            payload.data.groupingDimension = this.options.groupOrder[targetLevel];
        }
        return payload;
    }

    _remoteRequest(action, target = null) {
        const payload = this._getRequestPayload(action, target);
        fetch(this.options.remoteUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(json => this._fill(json));
    }

    /**
     * Processes the server response and updates the DOM.
     * @param {Object} json - The JSON response from the server.
     */
    _fill(json) {
        if(!json.success) {
            alert(json.error_message || "A server error occurred.");
            return;
        }

        const {data} = json;
        const {action, rows, level, rowId, grandTotals} = data;

        if(grandTotals) {
            this.grandTotals = grandTotals;
        }

        if(action === 'expand') {
            const parentRow = document.getElementById(rowId);
            if(!parentRow) return;
            this._injectChildRows(parentRow, rows, level);
        } else if(action === 'expandToLevel' || action === 'change_grouping') {
            this.dataArr = rows;
            this._isFilling = true;
            try {
                this.render();
            } finally {
                this._isFilling = false;
            }
            this._updateBreadcrumbVisuals(level);
        }
    }

    /**
     * Add,inject rows from server after expand
     */
    _injectChildRows(parentRow, rows, parentLevel) {
        const tbody = this.table.tBodies[0];
        let lastInsertedRow = parentRow;
        const parentHierarchy = JSON.parse(parentRow.getAttribute('data-hierarchy') || '[]');
        const currentLevel = parentLevel + 1;
        const dimensionKey = this.options.groupOrder[currentLevel];

        rows.forEach((rowData, idx) => {
            const rowId = this.options.idPrefix + 'row_fetch_' + (this._idCounter++);
            const groupKey = rowData[dimensionKey];

            lastInsertedRow = this._buildRow({
                tbody,
                insertAfterRow: lastInsertedRow,
                rowId,
                level: currentLevel,
                hierarchy: [...parentHierarchy, groupKey],
                parentRowId: parentRow.id,
                groupKey,
                item: rowData,
                gData: null,
                anchorHtml: ' ',
                addEvenClass: !!(idx % 2),
                addFirstGroupClass: false
            });
        });

        const icon = parentRow.querySelector('.drillDowner_drill_icon');
        if(icon) {
            icon.classList.remove('drillDowner_drill_collapsed');
            icon.classList.add('drillDowner_drill_expanded');
        }
    }


    /* endregion: mode remote/fetch ________________________________________________________________________________ */

}
