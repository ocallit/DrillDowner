class DrillDowner {
    static version = '1.1.13';

    constructor(container, dataArr, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.dataArr = dataArr;

        this.options = Object.assign({
            columns: [],
            totals: [],
            colProperties: {},
            groupOrder: [],
            groupOrderCombinations: null,
            ledger: [],
            idPrefix: 'drillDowner' + Math.random().toString(36).slice(2) + '_',
            azBarSelector: null,
            controlsSelector: null,
            showGrandTotals: true,
        }, options);

        if (this.options.ledger && !Array.isArray(this.options.ledger)) {
            this.options.ledger = [this.options.ledger];
        }
        this.options.ledger = this.options.ledger || [];

        if (this.options.groupOrder.length === 0 && this.options.ledger.length > 0) {
            this.activeLedgerIndex = 0;
        } else {
            this.activeLedgerIndex = -1;
        }

        this.options.totals = this.options.totals || [];
        this.options.columns = this.options.columns || [];
        this._defaultColumns = [...this.options.columns];
        this.options.colProperties = this.options.colProperties || {};

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
        this._onDrillClick = this._onDrillClick.bind(this);
        this._onAZClick = this._onAZClick.bind(this);

        this.render();
    }

    // ---------- Public Methods ----------
    getTable() {
        return this.table;
    }

    changeGroupOrder(newOrder) {
        if (!this.controls) {
            this.options.groupOrder = newOrder;
            this.render();
            return this;
        }

        const select = this.controls.querySelector('select.drillDowner_modern_select');
        if (!select) return this;

        const targetValue = newOrder.join(',');
        let found = false;

        // If using groupOrderCombinations, first check if newOrder matches any combination
        if (this.options.groupOrderCombinations) {
            for (let i = 0; i < this.options.groupOrderCombinations.length; i++) {
                if (this.options.groupOrderCombinations[i].join(',') === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        } else {
            // Search by key-string value
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        }

        // Add custom order if it doesn't exist
        if (!found) {
            const label = newOrder.map(col => this._getColLabel(col)).join(' → ');
            select.add(new Option(label, targetValue));
            select.value = targetValue;
        }

        select.dispatchEvent(new Event('change'));
        return this;
    }

    collapseToLevel(level = 0) {
        if(!this.container) return this;
        if(!this.options.groupOrder || this.options.groupOrder.length === 0) return this;

        if(isNaN(level) || level == null || level < 0) level = 0;
        const maxLevel = this.options.groupOrder.length - 1;
        if(level > maxLevel) level = maxLevel;

        const table = this.container.querySelector('table.drillDowner_table');
        if(!table) return this;

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const lvl = +row.getAttribute('data-level');
            row.style.display = (lvl > level) ? 'none' : '';

            const drillIcons = row.querySelectorAll('.drillDowner_drill_icon');
            drillIcons.forEach(icon => {
                icon.classList.remove('drillDowner_drill_expanded');
                icon.classList.add('drillDowner_drill_collapsed');
            });
        });

        this._updateBreadcrumbVisuals(level);
        return this;
    }

    collapseAll() { return this.collapseToLevel(0); }
    expandAll() { return this.collapseToLevel(this.options.groupOrder.length - 1); }

    destroy() {
        if(this.controls) this.controls.innerHTML = '';
        if(this.azBar) {
            this.azBar = this._removeAllEventListeners(this.azBar);
            this.azBar.innerHTML = '';
        }
        if(this.table) this.table = this._removeAllEventListeners(this.table);
        this.container.innerHTML = '';
    }

    render() {
        this.grandTotals = this._calculateGrandTotals();

        if (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0 && this.options.ledger[this.activeLedgerIndex]) {
            const activeLedger = this.options.ledger[this.activeLedgerIndex];
            if (activeLedger.cols) this.options.columns = activeLedger.cols;
        }

        if (this.options.groupOrder.length > 0) this.activeLedgerIndex = -1;

        if(this.azBar) this.azBar = this._removeAllEventListeners(this.azBar);
        if(this.table) this.table = this._removeAllEventListeners(this.table);

        this._renderControls();
        this._renderAZBar();
        this._renderTable();

        if(this.options.groupOrder.length > 0) {
            this.collapseToLevel(0);
        }
    }

    // ---------- Internal Logic ----------

    _renderControls() {
        if (!this.controls) return;

        let container = this.controls.querySelector('.drillDowner_controls_container');
        if (!container) {
            this.controls.innerHTML = `
                <div class="drillDowner_controls_container">
                    <div class="drillDowner_breadcrumb_nav"></div>
                    <div class="drillDowner_grouping_controls"></div>
                </div>`;
            container = this.controls.querySelector('.drillDowner_controls_container');

            this._renderGroupingSelect(container.querySelector('.drillDowner_grouping_controls'));
            this._renderBreadcrumbs(container.querySelector('.drillDowner_breadcrumb_nav'));
        }
    }

    _renderGroupingSelect(div) {
        if (div.querySelector('select')) return;

        let optionsHtml = '';
        // 1. Handle Combinations
        if (this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combo, idx) => {
                optionsHtml += `<option value="${idx}">${combo.map(k => this._getColLabel(k)).join(' → ')}</option>`;
            });
        }
        // 2. Handle Permutations
        else if (this.options.groupOrder.length > 0) {
            const perms = this._generatePermutations(this.options.groupOrder.length);
            perms.slice(0, 9).forEach(p => {
                const keys = p.map(i => this.options.groupOrder[i]);
                optionsHtml += `<option value="${keys.join(',')}">${keys.map(k => this._getColLabel(k)).join(' → ')}</option>`;
            });
        }

        // 3. Handle Ledgers
        this.options.ledger.forEach((l, i) => {
            optionsHtml += `<option value="__LEDGER_${i}__">${l.label}</option>`;
        });

        div.innerHTML = `<div class="drillDowner_control_group">
            <span class="drillDowner_control_label">Group by:</span>
            <select class="drillDowner_modern_select">${optionsHtml}</select>
        </div>`;

        div.querySelector('select').addEventListener('change', (e) => {
            const val = e.target.value;
            if (val.startsWith('__LEDGER_')) {
                this.activeLedgerIndex = parseInt(val.replace('__LEDGER_', ''));
                this.options.groupOrder = [];
            } else {
                this.activeLedgerIndex = -1;
                // Recover original columns if returning from Ledger
                this.options.columns = [...this._defaultColumns];

                if (this.options.groupOrderCombinations) {
                    // Check if value is an index (digits only) or a key-string
                    if (/^\d+$/.test(val)) {
                        this.options.groupOrder = this.options.groupOrderCombinations[parseInt(val)];
                    } else {
                        // Custom order added via changeGroupOrder - parse as key-string
                        this.options.groupOrder = val.split(',');
                    }
                } else {
                    this.options.groupOrder = val.split(',');
                }
            }

            this._renderBreadcrumbs(this.controls.querySelector('.drillDowner_breadcrumb_nav'));
            this.render();
        });
    }

    _renderBreadcrumbs(nav) {
        nav.innerHTML = '';
        const items = [];
        if (this.options.groupOrder.length > 0) {
            this.options.groupOrder.forEach((key, i) => {
                items.push(`<button type="button" class="drillDowner_breadcrumb_item" data-level="${i}">
                    <span>${this._getGroupIcon(key)} ${this._getColLabel(key)}</span>
                </button>`);
                if (i < this.options.groupOrder.length - 1) {
                    items.push(`<button type="button" class="drillDowner_breadcrumb_arrow drillDowner_collapsed" data-arrow-level="${i}">
                        <span class="drillDowner_arrow_icon">▶</span>
                    </button>`);
                }
            });
        } else if (this.activeLedgerIndex >= 0) {
            const label = this.options.ledger[this.activeLedgerIndex].label;
            items.push(`<span class="drillDowner_breadcrumb_item" style="cursor:default"><b>${label}</b></span>`);
        }
        nav.innerHTML = items.join('');

        nav.querySelectorAll('.drillDowner_breadcrumb_item').forEach(btn => {
            if (btn.dataset.level !== undefined) {
                btn.onclick = () => this.collapseToLevel(parseInt(btn.dataset.level));
            }
        });
        nav.querySelectorAll('.drillDowner_breadcrumb_arrow').forEach(btn => {
            btn.onclick = () => {
                const lvl = parseInt(btn.dataset.arrowLevel);
                this.collapseToLevel(btn.classList.contains('drillDowner_expanded') ? lvl : lvl + 1);
            };
        });
    }

    _updateBreadcrumbVisuals(level) {
        if (!this.controls) return;
        this.controls.querySelectorAll('.drillDowner_breadcrumb_arrow').forEach((arrow, i) => {
            const isExpanded = i < level;
            arrow.classList.toggle('drillDowner_expanded', isExpanded);
            arrow.classList.toggle('drillDowner_collapsed', !isExpanded);
        });
    }

    // ---------- Table Rendering ----------

    _renderTable() {
        this.container.innerHTML = '';
        const groupCols = this.options.groupOrder.length > 0 ? ["Item"] : ["#"];
        const totalHeaders = this.options.totals.map(c => this._getColLabel(c));
        const columnHeaders = this.options.columns.map(c => this._getColLabel(c));
        const allHeaders = [...groupCols, ...totalHeaders, ...columnHeaders];

        const table = document.createElement('table');
        table.className = 'drillDowner_table';
        const thead = table.createTHead();
        const hr = thead.insertRow();
        allHeaders.forEach((h, i) => {
            const th = document.createElement('th');
            if (i > 0 && i <= this.options.totals.length) {
                const col = this.options.totals[i-1];
                th.className = this._getColLabelClass(col) + (this.options.showGrandTotals ? " drillDownerThTotal" : "");
                th.innerHTML = this.options.showGrandTotals ? `${h}<br><small>${this._formatGrandTotal(col)}</small>` : h;
            } else if (i > this.options.totals.length) {
                th.className = this._getColLabelClass(this.options.columns[i - this.options.totals.length - 1]);
                th.textContent = h;
            } else th.textContent = h;
            hr.appendChild(th);
        });

        const tbody = table.createTBody();
        if (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0) {
            const led = this.options.ledger[this.activeLedgerIndex];
            this._sortAsc(this.dataArr, led.sort).forEach((item, idx) => {
                const tr = tbody.insertRow();
                if (idx % 2) tr.className = 'drillDowner_even';
                tr.insertCell().innerHTML = `<span class="drillDowner_indent_0">${idx + 1}</span>`;
                this._appendDataCells(tr, item, null, true);
            });
        } else {
            this._sortAsc(this.dataArr, this.options.groupOrder);
            this._buildFlatRows(this.dataArr, this.options.groupOrder, 0, {}, [], tbody);
        }

        if (this.options.showGrandTotals) {
            const tf = table.createTFoot();
            const tr = tf.insertRow();
            allHeaders.forEach((_, i) => {
                const td = tr.insertCell();
                if (i === 0) { td.innerHTML = '<b>Total</b>'; td.className = "drillDowner_right"; }
                else if (i <= this.options.totals.length) {
                    const col = this.options.totals[i-1];
                    td.className = "drillDowner_num drillDownerTfootTotal " + this._getColLabelClass(col);
                    td.innerHTML = this._formatGrandTotal(col);
                }
            });
        }
        this.container.appendChild(table);
        this.table = table;
        table.querySelectorAll('.drillDowner_drill_icon').forEach(i => i.onclick = (e) => this._onDrillClick(e));
    }

    _buildFlatRows(data, groupOrder, level, parents, rows, tbody) {
        if (level >= groupOrder.length) return;
        const col = groupOrder[level];
        const grouped = {};
        data.forEach(r => { (grouped[r[col]] = grouped[r[col]] || []).push(r); });

        Object.keys(grouped).forEach((key, i) => {
            const gData = grouped[key];
            const keys = groupOrder.slice(0, level + 1).map((c, idx) => idx === level ? key : parents[c]);
            const rowId = this.options.idPrefix + "row_" + keys.join("_").replace(/\s/g, "_");

            const tr = tbody.insertRow();
            tr.id = rowId;
            tr.setAttribute('data-level', level);
            tr.setAttribute('data-parent', level === 0 ? "" : this.options.idPrefix + "row_" + groupOrder.slice(0, level).map(c => parents[c]).join("_").replace(/\s/g, "_"));
            if (i % 2) tr.classList.add('drillDowner_even');
            if (i === 0) tr.classList.add('drillDowner_first_group');

            let anchor = "";
            if (level === 0) {
                const char = String(key)[0]?.toUpperCase();
                if (char) anchor = `<span id="${this.options.idPrefix}az${char}"></span>`;
            }

            const cell = tr.insertCell();
            const icon = (level < groupOrder.length - 1) ? `<span class="drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${level}"></span>` : '';
            cell.innerHTML = `${anchor}<span class="drillDowner_indent_${level}">${icon}${level === 0 ? `<b>${key}</b>` : key}</span>`;

            this._appendDataCells(tr, gData[0], gData, (level === groupOrder.length - 1));
            this._buildFlatRows(gData, groupOrder, level + 1, {...parents, [col]: key}, rows, tbody);
        });
    }

    _appendDataCells(tr, item, gData, isLeaf) {
        this.options.totals.forEach(col => {
            const td = tr.insertCell();
            td.className = 'drillDowner_num';
            const dec = this._getColDecimals(col);
            if (gData) {
                const subBy = this._getColProperty(col, 'subTotalBy');
                if (!subBy) td.textContent = DrillDowner.formatNumber(gData.reduce((s, r) => s + (Number(r[col]) || 0), 0), dec);
                else {
                    const sub = {};
                    gData.forEach(r => { sub[r[subBy]] = (sub[r[subBy]] || 0) + Number(r[col]); });
                    td.innerHTML = Object.entries(sub).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join(', ') || '-';
                }
            } else td.textContent = DrillDowner.formatNumber(item[col], dec);
        });
        this.options.columns.forEach(col => {
            const td = tr.insertCell();
            td.className = this._getColClass(col);
            let val = "";
            if (gData && this._getColTogglesUp(col)) val = Array.from(new Set(gData.map(r => r[col]))).join(', ');
            else if (!gData || isLeaf) val = item[col];
            const fmt = this._getColFormatter(col);
            td.innerHTML = fmt ? fmt(val, item) : val;
        });
    }

    // ---------- Helpers ----------

    _getColProperty(c, p, f = null) { return this.options.colProperties[c]?.[p] ?? f; }
    _getColDecimals(c) { return this._getColProperty(c, 'decimals', 2); }
    _getColLabel(c) { return this._getColProperty(c, 'label', c.charAt(0).toUpperCase() + c.slice(1)); }
    _getGroupIcon(c) { return this._getColProperty(c, 'icon', ''); }
    _getColClass(c) { return this._getColProperty(c, 'class', ''); }
    _getColLabelClass(c) { return this._getColProperty(c, 'labelClass', ''); }
    _getColTogglesUp(c) { return this._getColProperty(c, 'togglesUp', false); }
    _getColFormatter(c) { return this._getColProperty(c, 'formatter', null); }

    _onDrillClick(e) {
        const icon = e.target;
        const rowId = icon.dataset.rowid;
        const expanded = icon.classList.contains('drillDowner_drill_expanded');
        icon.classList.toggle('drillDowner_drill_expanded', !expanded);
        icon.classList.toggle('drillDowner_drill_collapsed', expanded);

        const setVisible = (pId, vis) => {
            this.table.querySelectorAll(`tr[data-parent="${pId}"]`).forEach(r => {
                r.style.display = vis ? '' : 'none';
                if (!vis) {
                    const i = r.querySelector('.drillDowner_drill_icon');
                    if (i) { i.classList.remove('drillDowner_drill_expanded'); i.classList.add('drillDowner_drill_collapsed'); }
                    setVisible(r.id, false);
                }
            });
        };
        setVisible(rowId, !expanded);
    }

    _onAZClick() { setTimeout(() => window.scrollBy(0, -30), 1); }

    _renderAZBar() {
        if(!this.azBar || this.options.groupOrder.length === 0) { if(this.azBar) this.azBar.innerHTML = ''; return; }
        const col = this.options.groupOrder[0];
        const letters = new Set(this.dataArr.map(x => String(x[col]||"")[0]?.toUpperCase()));
        let html = '';
        for (let i = 65; i <= 90; i++) {
            const c = String.fromCharCode(i);
            html += letters.has(c) ? `<div><a href="#${this.options.idPrefix}az${c}" aria-label="Ir a la letra ${c}" class="drillDowner_az_link">${c}</a></div>` : `<div class="drillDowner_az_dimmed">${c}</div>`;
        }
        this.azBar.innerHTML = html;
        this.azBar.querySelectorAll('.drillDowner_az_link').forEach(a => a.onclick = () => this._onAZClick());
    }

    _calculateGrandTotals() {
        const t = {};
        this.options.totals.forEach(c => {
            const sub = this._getColProperty(c, 'subTotalBy');
            if (!sub) t[c] = this.dataArr.reduce((s, r) => s + (Number(r[c]) || 0), 0);
            else {
                const res = {};
                this.dataArr.forEach(r => { if (r[c] != null) res[r[sub]] = (res[r[sub]] || 0) + Number(r[c]); });
                t[c] = res;
            }
        });
        return t;
    }

    _formatGrandTotal(c) {
        const val = this.grandTotals[c], dec = this._getColDecimals(c);
        if (typeof val !== 'object') return DrillDowner.formatNumber(val, dec);
        return Object.entries(val).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join('<br>') || '-';
    }

    _sortAsc(arr, keys) {
        if(!keys?.length) return arr;
        return arr.sort((a, b) => {
            for (let k of keys) {
                const r = this._natSort(String(a[k]||""), String(b[k]||""));
                if (r !== 0) return r;
            } return 0;
        });
    }

    static formatNumber(n, d) {
        if (n == null || isNaN(n) || n === '') return n || '';
        return Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
    }

    _removeAllEventListeners(el) {
        if (!el) return el;
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        return clone;
    }

    _generatePermutations(n) {
        const res = [];
        const p = (a, s = 0) => {
            if (s === a.length - 1) { res.push([...a]); return; }
            for (let i = s; i < a.length; i++) {
                [a[s], a[i]] = [a[i], a[s]]; p(a, s + 1); [a[s], a[i]] = [a[i], a[s]];
            }
        };
        p(Array.from({length: n}, (_, i) => i));
        return res;
    }
}
