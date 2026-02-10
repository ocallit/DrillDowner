/* jshint esversion:11 */
class DrillDowner {
    static version = '1.1.20';

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
            azBarOrientation: 'vertical',
            controlsSelector: null,
            showGrandTotals: true,
            onLabelClick: null, // labelIno: (eventData) => void
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

        if (this.options.groupOrderCombinations) {
            for (let i = 0; i < this.options.groupOrderCombinations.length; i++) {
                if (this.options.groupOrderCombinations[i].join(',') === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        } else {
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === targetValue) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        }

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
        const maxLevel = this.options.groupOrder.length;
        if(level > maxLevel) level = maxLevel;

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

    collapseAll() { return this.collapseToLevel(0); }
    expandAll() { return this.collapseToLevel(this.options.groupOrder.length ); }

    // Label click
    _onTableClick(e) {
        if (typeof this.options.onLabelClick !== 'function') return;

        const labelSpan = e.target.closest('span[class*="drillDowner_indent_"]');
        if (!labelSpan) return;
        if (e.target.classList.contains('drillDowner_drill_icon')) return;

        const row = labelSpan.closest('tr');
        if (!row) return;

        // 1. Get the depth level (0 = Warehouse, 1 = Category, 2 = Product)
        const level = parseInt(row.getAttribute('data-level') || "0");

        // 2. Get the specific column name for this level (e.g., "Warehouse")
        // This is how the code knows "Main WH" belongs to "Warehouse"
        const clickedColumn = this.options.groupOrder[level];

        // 3. Get the full path of Values (e.g., ["Main WH", "Electronics"])
        const valuePath = this._getHierarchyForRow(row);

        // 4. Map Values to Columns to create a structured object
        // Result: { Warehouse: "Main WH", Category: "Electronics" }
        const pathMap = {};
        valuePath.forEach((val, index) => {
            const colName = this.options.groupOrder[index];
            pathMap[colName] = val;
        });

        const context = {
            label: labelSpan.innerText.trim(), // "Main WH"
            level: level,                      // 0
            column: clickedColumn,             // "Warehouse" <--- THE KEY LINK
            hierarchyValues: valuePath,        // ["Main WH"]
            hierarchyMap: pathMap,             // { Warehouse: "Main WH" }
            rowElement: row
        };

        this.options.onLabelClick(context);
    }

    _getHierarchyForRow(row) {
        const chain = [];
        let current = row;

        while (current) {
            // Extract text from the indented span
            const span = current.querySelector('span[class*="drillDowner_indent_"]');
            if (span) {
                // Clone to remove children (like the drill icon) to get just the text
                const clone = span.cloneNode(true);
                clone.querySelectorAll('.drillDowner_drill_icon').forEach(el => el.remove());
                chain.unshift(clone.innerText.trim());
            }

            // Move up to parent using internal data attribute
            const parentId = current.getAttribute('data-parent');
            if (!parentId || parentId.trim() === "") break;
            current = document.getElementById(parentId);
        }
        return chain;
    }

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
            if (activeLedger.cols) {
                // Filter out totals to avoid duplicate undefined text columns
                this.options.columns = activeLedger.cols.filter(c => !this.options.totals.includes(c));
            }
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
        if (this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combo, idx) => {
                optionsHtml += `<option value="${idx}">${combo.map(k => this._getColLabel(k)).join(' → ')}</option>`;
            });
        }
        else if (this.options.groupOrder.length > 0) {
            const perms = this._generatePermutations(this.options.groupOrder.length);
            perms.slice(0, 9).forEach(p => {
                const keys = p.map(i => this.options.groupOrder[i]);
                optionsHtml += `<option value="${keys.join(',')}">${keys.map(k => this._getColLabel(k)).join(' → ')}</option>`;
            });
        }

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
                this.options.columns = [...this._defaultColumns];

                if (this.options.groupOrderCombinations) {
                    if (/^\d+$/.test(val)) {
                        this.options.groupOrder = this.options.groupOrderCombinations[parseInt(val)];
                    } else {
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

        // --- LEDGER VIEW (FLAT) ---
        if (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0) {
            const led = this.options.ledger[this.activeLedgerIndex];

            // --- PASS 1: Calculate Running Balances in Chronological Order (Ascending) ---
            const calcKeys = (led.sort || []).map(k => k.startsWith('-') ? k.substring(1) : k);
            const calcList = [...this.dataArr];
            this._sortData(calcList, calcKeys);

            const runningTotals = {};
            // Check if any column has an initial balance to decide if we need the row later
            let hasInitialBalance = false;

            this.options.totals.forEach(col => {
                const props = this._getColProperty(col, 'balanceBehavior');
                const init = (props && typeof props.initialBalance === 'number') ? props.initialBalance : 0;
                runningTotals[col] = init;
                if(props && typeof props.initialBalance === 'number') hasInitialBalance = true;
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
                    }
                });
                balanceMap.set(item, itemOverrides);
            });

            // --- PASS 2: Render in Display Order ---
            this._sortData(this.dataArr, led.sort);

            // Determine if sort is Descending (starts with '-') to place Initial Balance at Bottom
            const isDescending = (led.sort && led.sort.length > 0 && led.sort[0].startsWith('-'));

            // --- Helper to Render Initial Balance Row ---
            const renderInitialRow = () => {
                const tr = tbody.insertRow();
                tr.className = 'drillDowner_initial_row'; // Styling hook
                tr.style.backgroundColor = '#fafafa'; // Light grey to distinguish
                tr.style.fontStyle = 'italic';

                tr.insertCell().innerHTML = ''; // Indent cell

                // Totals columns (Fill only those with Initial Balance)
                this.options.totals.forEach(col => {
                    const td = tr.insertCell();
                    td.className = 'drillDowner_num';
                    const props = this._getColProperty(col, 'balanceBehavior');
                    if (props && typeof props.initialBalance === 'number') {
                        const dec = this._getColDecimals(col);
                        const fmt = this._getColFormatter(col);
                        const val = props.initialBalance;
                        td.innerHTML = fmt ? fmt(val, {}) : DrillDowner.formatNumber(val, dec);
                    } else {
                        td.innerHTML = '';
                    }
                });

                // Regular columns (Label "Initial Balance" in first available)
                let labelSet = false;
                this.options.columns.forEach(col => {
                    const td = tr.insertCell();
                    td.className = this._getColClass(col);
                    if (!labelSet) {
                        td.innerHTML = 'Initial Balance';
                        labelSet = true;
                    } else {
                        td.innerHTML = '';
                    }
                });
            };

            // IF ASCENDING: Render Top
            if (hasInitialBalance && !isDescending) renderInitialRow();

            this.dataArr.forEach((item, idx) => {
                const tr = tbody.insertRow();
                if (idx % 2) tr.className = 'drillDowner_even';
                tr.insertCell().innerHTML = `<span class="drillDowner_indent_0">${idx + 1}</span>`;
                const rowOverrides = balanceMap.get(item) || {};
                this._appendDataCells(tr, item, null, true, rowOverrides);
            });

            // IF DESCENDING: Render Bottom (Just above Footer)
            if (hasInitialBalance && isDescending) renderInitialRow();

            // --- GROUPED VIEW (HIERARCHICAL) ---
        } else {
            this._sortData(this.dataArr, this.options.groupOrder);
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
        this.table.addEventListener('click', (e) => this._onTableClick(e));
    }

    _buildFlatRows(data, groupOrder, level, parents, rows, tbody) {
        if (level >= groupOrder.length) return;
        const col = groupOrder[level];
        const grouped = {};
        data.forEach(r => { (grouped[r[col]] = grouped[r[col]] || []).push(r); });

        Object.keys(grouped).forEach((key, i) => {
            const gData = grouped[key];
            const keys = groupOrder.slice(0, level + 1).map((c, idx) => idx === level ? key : parents[c]);
            const sanitizedKeys = keys.map((value) => this._sanitizeIdPart(value));
            const rowId = this.options.idPrefix + "row_" + sanitizedKeys.join("_");

            const tr = tbody.insertRow();
            tr.id = rowId;
            tr.setAttribute('data-level', level);
            tr.setAttribute('data-parent', level === 0 ? " " : this.options.idPrefix + "row_" + groupOrder.slice(0, level).map(c => this._sanitizeIdPart(parents[c])).join("_"));
            if (i % 2) tr.classList.add('drillDowner_even');
            if (i === 0) tr.classList.add('drillDowner_first_group');

            let anchor = " ";
            if (level === 0) {
                const char = String(key)[0]?.toUpperCase();
                if (char) anchor = `<span id="${this.options.idPrefix}az${this._sanitizeIdPart(char)}"></span>`;
            }

            const cell = tr.insertCell();
            const icon = (level < groupOrder.length) ? `<span class="drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${level}"></span>` : '';
            cell.innerHTML = `${anchor}<span class="drillDowner_indent_${level}">${icon}${level === 0 ? `<b>${key}</b>` : key}</span>`;

            this._appendDataCells(tr, gData[0], gData, false);

            this._buildFlatRows(gData, groupOrder, level + 1, {...parents, [col]: key}, rows, tbody);

            if (level === groupOrder.length - 1) {
                gData.forEach((item, idx) => {
                    const detailRow = tbody.insertRow();
                    detailRow.id = rowId + "_detail_" + idx;
                    detailRow.setAttribute('data-level', level + 1);
                    detailRow.setAttribute('data-parent', rowId);
                    if (idx % 2) detailRow.classList.add('drillDowner_even');

                    const indentCell = detailRow.insertCell();
                    indentCell.innerHTML = `<span class="drillDowner_indent_${level + 1}">${item[col]}</span>`;

                    this._appendDataCells(detailRow, item, null, true);
                });
            }
        });
    }

    _appendDataCells(tr, item, gData, isLeaf, overrides = {}) {
        this.options.totals.forEach(col => {
            const td = tr.insertCell();
            td.className = 'drillDowner_num';
            const dec = this._getColDecimals(col);
            const fmt = this._getColFormatter(col);

            if (gData) {
                // --- GROUPED VIEW ---
                const subBy = this._getColProperty(col, 'subTotalBy');
                if (!subBy) {
                    let val;
                    if (this._getColProperty(col, 'balanceBehavior')) {
                        val = gData.reduce((s, r) => s + this._calculateRowImpact(r, col), 0);
                    } else {
                        val = gData.reduce((s, r) => s + (Number(r[col]) || 0), 0);
                    }
                    td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                }
                else {
                    const sub = {};
                    gData.forEach(r => {
                        const v = this._getColProperty(col, 'balanceBehavior')
                            ? this._calculateRowImpact(r, col)
                            : Number(r[col]);
                        sub[r[subBy]] = (sub[r[subBy]] || 0) + v;
                    });
                    const val = Object.entries(sub).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join(', ') || '-';
                    td.innerHTML = fmt ? fmt(val, item) : val;
                }
            } else {
                // --- LEDGER VIEW ---
                let val;
                if (overrides && overrides.hasOwnProperty(col)) {
                    val = overrides[col];
                }
                else if (this._getColProperty(col, 'balanceBehavior')) {
                    val = this._calculateRowImpact(item, col);
                }
                else {
                    val = item[col];
                }
                td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
            }
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

    _getColProperty(c, p, f = null) { return this.options.colProperties[c]?.[p] ?? f; }
    _getColDecimals(c) { return this._getColProperty(c, 'decimals', 2); }
    _getColLabel(c) { return this._getColProperty(c, 'label', c.charAt(0).toUpperCase() + c.slice(1)); }
    _getGroupIcon(c) { return this._getColProperty(c, 'icon', ''); }
    _getColClass(c) { return this._getColProperty(c, 'class', ''); }
    _getColLabelClass(c) { return this._getColProperty(c, 'labelClass', ''); }
    _getColTogglesUp(c) { return this._getColProperty(c, 'togglesUp', false); }
    _getColFormatter(c) { return this._getColProperty(c, 'formatter', null); }
    _sanitizeIdPart(value) {
        return String(value ?? '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    _calculateRowImpact(row, colKey) {
        const props = this._getColProperty(colKey, 'balanceBehavior');
        if (!props) return Number(row[colKey]) || 0;
        let val = 0;
        if (Array.isArray(props.add)) {
            props.add.forEach(c => { val += (Number(row[c]) || 0); });
        }
        if (Array.isArray(props.subtract)) {
            props.subtract.forEach(c => { val -= (Number(row[c]) || 0); });
        }
        return val;
    }

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
            html += letters.has(c) ? `<div><a href="#${this.options.idPrefix}az${this._sanitizeIdPart(c)}" aria-label="Ir a la letra ${c}" class="drillDowner_az_link">${c}</a></div>` : `<div class="drillDowner_az_dimmed">${c}</div>`;
        }
        this.azBar.innerHTML = html;
        this.azBar.querySelectorAll('.drillDowner_az_link').forEach(a => a.onclick = () => this._onAZClick());
        this._applyAzBarOrientation();
    }

    _applyAzBarOrientation() {
        if (!this.azBar) return;
        this.azBar.classList.add('drillDowner_az_bar');

        const ori = (this.options.azBarOrientation || 'vertical').toLowerCase();
        const isH = (ori === 'horizontal' || ori === 'h' || ori === 'row');

        if (isH) {
            this.azBar.classList.add('drillDowner_az_bar_horizontal');
        } else {
            this.azBar.classList.remove('drillDowner_az_bar_horizontal');
        }
    }

    _calculateGrandTotals() {
        const t = {};
        this.options.totals.forEach(c => {
            const sub = this._getColProperty(c, 'subTotalBy');
            if (!sub) {
                const props = this._getColProperty(c, 'balanceBehavior');
                if (props) {
                    const startBal = (typeof props.initialBalance === 'number') ? props.initialBalance : 0;
                    t[c] = this.dataArr.reduce((s, r) => s + this._calculateRowImpact(r, c), startBal);
                } else {
                    t[c] = this.dataArr.reduce((s, r) => s + (Number(r[c]) || 0), 0);
                }
            } else {
                const res = {};
                this.dataArr.forEach(r => {
                    if (r[c] != null || this._getColProperty(c, 'balanceBehavior')) {
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
        if (typeof val !== 'object') return DrillDowner.formatNumber(val, dec);
        return Object.entries(val).map(([s, v]) => `${DrillDowner.formatNumber(v, dec)} ${s}`).join('<br>') || '-';
    }

    _sortData(arr, keys) {
        if(!keys?.length) return arr;
        return arr.sort((a, b) => {
            for (let k of keys) {
                const desc = k.startsWith('-');
                const key = desc ? k.substring(1) : k;
                const r = this._natSort(String(a[key]||""), String(b[key]||""));
                if (r !== 0) return desc ? -r : r;
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

    _generatePermutations(n, limit = 9) {
        const res = [];
        const p = (a, s = 0) => {
            if (res.length >= limit) return;
            if (s === a.length - 1) { res.push([...a]); return; }
            for (let i = s; i < a.length; i++) {
                [a[s], a[i]] = [a[i], a[s]];
                p(a, s + 1);
                [a[s], a[i]] = [a[i], a[s]];
                if (res.length >= limit) return;
            }
        };
        p(Array.from({length: n}, (_, i) => i));
        return res;
    }
}