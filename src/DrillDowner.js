/* jshint esversion:11 */
class DrillDowner {
    static version = '1.1.25';

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
            onLabelClick: null,
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

    collapseAll() {
        return this.collapseToLevel(0);
    }

    expandAll() {
        return this.collapseToLevel(this.options.groupOrder.length);
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
            isLeaf: level === level > this.options.groupOrder.length,
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
                // Filter out totals to avoid duplicate undefined text columns
                this.options.columns = activeLedger.cols.filter(c => !this.options.totals.includes(c));
            }
        }

        if(this.options.groupOrder.length > 0) this.activeLedgerIndex = -1;

        this._renderControls();
        this._renderAZBar();
        this._renderTable();

        if(this.options.groupOrder.length > 0) {
            this.collapseToLevel(0);
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
        }
    }

    _renderGroupingSelect(div) {
        if(div.querySelector('select')) return;

        let optionsHtml = '';
        if(this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combo, idx) => {
                optionsHtml += `<option value="${idx}">${combo.map(k => this._getColLabel(k)).join(' → ')}</option>`;
            });
        } else if(this.options.groupOrder.length > 0) {
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
            <label class="drillDowner_control_label">Group by:
            <select class="drillDowner_modern_select">${optionsHtml}</select>
            </label>
        </div>`;

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
            this.render();
        });
    }

    _renderBreadcrumbs(nav) {
        nav.innerHTML = '';
        const items = [];
        if(this.options.groupOrder.length > 0) {
            this.options.groupOrder.forEach((key, i) => {
                items.push(`<button type="button" class="drillDowner_breadcrumb_item" data-level="${i}">
                    <span>${this._getGroupIcon(key)} ${this._getColLabel(key)}</span>
                </button>`);
                if(i < this.options.groupOrder.length - 1) {
                    items.push(`<button type="button" class="drillDowner_breadcrumb_arrow drillDowner_collapsed" data-arrow-level="${i}">
                        <span class="drillDowner_arrow_icon">▶</span>
                    </button>`);
                }
            });
        } else if(this.activeLedgerIndex >= 0) {
            const label = this.options.ledger[this.activeLedgerIndex].label;
            items.push(`<span class="drillDowner_breadcrumb_item" style="cursor:default"><b>${label}</b></span>`);
        }
        nav.innerHTML = items.join('');

        nav.querySelectorAll('.drillDowner_breadcrumb_item').forEach(btn => {
            if(btn.dataset.level !== undefined) {
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
        if(!this.controls) return;
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
            if(i > 0 && i <= this.options.totals.length) {
                const col = this.options.totals[i - 1];
                th.className = this._getColLabelClass(col) + (this.options.showGrandTotals ? " drillDownerThTotal" : "");
                th.innerHTML = this.options.showGrandTotals ? `${h}<br><small>${this._formatGrandTotal(col)}</small>` : h;
            } else if(i > this.options.totals.length) {
                th.className = this._getColLabelClass(this.options.columns[i - this.options.totals.length - 1]);
                th.textContent = h;
            } else th.textContent = h;
            hr.appendChild(th);
        });

        const tbody = table.createTBody();

        // --- LEDGER VIEW (FLAT) ---
        if(this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0) {
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
                runningTotals[col] = (props && typeof props.initialBalance === 'number') ? props.initialBalance : 0;
                if(props && typeof props.initialBalance === 'number') hasInitialBalance = true;
            });

            const balanceMap = new Map();
            calcList.forEach(item => {
                const itemOverrides = {};
                this.options.totals.forEach(col => {
                    const props = this._getColProperty(col, 'balanceBehavior');
                    if(props) {
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
                tr.style.backgroundColor = '#fafafa'; // Light gray to distinguish
                tr.style.fontStyle = 'italic';

                tr.insertCell().innerHTML = ''; // Indent cell

                // Totals columns (Fill only those with Initial Balance)
                this.options.totals.forEach(col => {
                    const td = tr.insertCell();
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
                });

                // Regular columns (Label "Initial Balance" in first available)
                let labelSet = false;
                this.options.columns.forEach(col => {
                    const td = tr.insertCell();
                    td.className = this._getColClass(col);
                    if(!labelSet) {
                        td.innerHTML = 'Initial Balance';
                        labelSet = true;
                    } else {
                        td.innerHTML = '';
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
                this._appendDataCells(tr, item, null, true, rowOverrides);
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
                } else if(i <= this.options.totals.length) {
                    const col = this.options.totals[i - 1];
                    td.className = "drillDowner_num drillDownerTfootTotal " + this._getColLabelClass(col);
                    td.innerHTML = this._formatGrandTotal(col);
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
        const grouped = {};

        data.forEach((r) => {
            const key = r[col];
            (grouped[key] = grouped[key] || []).push(r);
        });

        Object.keys(grouped).forEach((key, i) => {
            const gData = grouped[key];

            const keys = groupOrder
                .slice(0, level + 1)
                .map((c, idx) => idx === level ? key : parents[c]);

            const rowId = this.options.idPrefix + "row_" + (this._idCounter++);

            // rows is now the path -> actual rowId map
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

            this._buildFlatRows(
                gData,
                groupOrder,
                level + 1,
                {...parents, [col]: key},
                rows,
                tbody
            );

            if(level === groupOrder.length - 1) {
                gData.forEach((item, idx) => {
                    const detailRowId = rowId + "_detail_" + idx;

                    const leafLabelColumn = this.options.leafLabelColumn || "";
                    const currentPath = leafLabelColumn
                        ? [...keys, item?.[leafLabelColumn] ?? ""]
                        : [...keys];

                    this._buildRow({
                        tbody: tbody,
                        rowId: detailRowId,
                        level: level + 1,
                        hierarchy: currentPath,
                        parentRowId: rowId,

                        item: item,
                        gData: null,

                        anchorHtml: " ",

                        addEvenClass: !!(idx % 2),
                        addFirstGroupClass: false
                    });
                });
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

                  anchorHtml = " ",
                  leafLabelColumn = null,
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
            anchorHtml: anchorHtml,
            leafLabelColumn: leafLabelColumn
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
            rowOverrides
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
                    leafLabelColumn = null
                }) {
        const groupOrder = this.options.groupOrder || [];

        // --- Invariants / single source of truth ---
        const isLeaf = level >= groupOrder.length;
        const showDrillIcon = !isLeaf;
        const showTotals = !isLeaf;

        // A dimension is ONLY a column in groupOrder.
        const dimension = isLeaf ? "" : (groupOrder[level] ?? "");

        // leafLabelColumn can come from arg or from options.
        const resolvedLeafLabelColumn =
            leafLabelColumn ?? this.options.leafLabelColumn ?? "";

        let label = "";
        let labelHtml = "";

        if(isLeaf) {
            // Leaf/detail row:
            // - never guess
            // - if no leafLabelColumn, leave blank
            if(resolvedLeafLabelColumn) {
                label = item?.[resolvedLeafLabelColumn] ?? "";
                labelHtml = String(label);
            } else {
                label = "";
                labelHtml = "";
            }
        } else {
            // Group/dimension row:
            // show the grouped key for the current dimension
            label = groupKey ?? "";
            labelHtml = (level === 0)
                ? `<b>${String(label)}</b>`
                : String(label);
        }

        // Totals belong to the row with the icon (group row)
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

            leafLabelColumn: resolvedLeafLabelColumn
        };
    }

    _buildFlatRowsOld(data, groupOrder, level, parents, rows, tbody) {
        if(level >= groupOrder.length) return;
        const col = groupOrder[level];
        const grouped = {};
        data.forEach(r => {
            (grouped[r[col]] = grouped[r[col]] || []).push(r);
        });

        Object.keys(grouped).forEach((key, i) => {
            const gData = grouped[key];
            const keys = groupOrder.slice(0, level + 1).map((c, idx) => idx === level ? key : parents[c]);
            const sanitizedKeys = keys.map((value) => this._sanitizeIdPart(value));
            //const rowId =  this.options.idPrefix + "row_" + (this._idCounter++); // sanitizedKeys.join("_");
            const rowId = this.options.idPrefix + "row_" + sanitizedKeys.join("_");

            const tr = tbody.insertRow();
            tr.id = rowId;
            tr.setAttribute('data-level', level);
            tr.setAttribute('data-dimension', col);
            tr.setAttribute('data-display-names', JSON.stringify(keys));
            tr.setAttribute('data-parent', level === 0 ? " " : this.options.idPrefix + "row_" + groupOrder.slice(0, level).map(c => this._sanitizeIdPart(parents[c])).join("_"));

            if(i % 2) tr.classList.add('drillDowner_even');
            if(i === 0) tr.classList.add('drillDowner_first_group');

            let anchor = " ";
            if(level === 0) {
                const char = String(key)[0]?.toUpperCase();
                if(char) anchor = `<span id="${this.options.idPrefix}az${this._sanitizeIdPart(char)}"></span>`;
            }

            const cell = tr.insertCell();
            const icon = (level < groupOrder.length) ? `<span class="drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${level}"></span><span class="drillDowner_child_count">${gData.length}</span> ` : '';
            cell.innerHTML = `${anchor}<span class="drillDowner_indent_${level}">${icon}${level === 0 ? `<b>${key}</b>` : key}</span>`;

            this._appendDataCells(tr, gData[0], gData, false);

            this._buildFlatRows(gData, groupOrder, level + 1, {...parents, [col]: key}, rows, tbody);

            if(level === groupOrder.length - 1) {
                gData.forEach((item, idx) => {
                    const detailRow = tbody.insertRow();
                    detailRow.id = rowId + "_detail_" + idx;
                    detailRow.setAttribute('data-level', level + 1);
                    detailRow.setAttribute('data-parent', rowId);
                    detailRow.setAttribute('data-dimension', col);
                    const currentPath = [...keys, item[col]];
                    detailRow.setAttribute('data-display-names', JSON.stringify(currentPath));
                    detailRow.setAttribute('data-hierarchy', JSON.stringify(currentPath));

                    if(idx % 2) detailRow.classList.add('drillDowner_even');

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

            if(gData) {
                // --- GROUPED VIEW ---
                const subBy = this._getColProperty(col, 'subTotalBy');
                if(!subBy) {
                    let val;
                    if(this._getColProperty(col, 'balanceBehavior')) {
                        val = gData.reduce((s, r) => s + this._calculateRowImpact(r, col), 0);
                    } else {
                        val = gData.reduce((s, r) => s + (Number(r[col]) || 0), 0);
                    }
                    td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
                } else {
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
                if(overrides && overrides.hasOwnProperty(col)) {
                    val = overrides[col];
                } else if(this._getColProperty(col, 'balanceBehavior')) {
                    val = this._calculateRowImpact(item, col);
                } else {
                    val = item[col];
                }
                td.innerHTML = fmt ? fmt(val, item) : DrillDowner.formatNumber(val, dec);
            }
        });
        this.options.columns.forEach(col => {
            const td = tr.insertCell();
            td.className = this._getColClass(col);
            let val = "";
            if(gData && this._getColTogglesUp(col)) val = Array.from(new Set(gData.map(r => r[col]))).join(', ');
            else if(!gData || isLeaf) val = item[col] ?? "";
            const fmt = this._getColFormatter(col);
            td.innerHTML = fmt ? fmt(val, item) : val;
        });
    }

    _getColProperty(c, p, defautValue = null) {
        return this.options.colProperties[c]?.[p] ?? defautValue;
    }

    _getColDecimals(c) {
        return this._getColProperty(c, 'decimals', 2);
    }

    _getColLabel(c) {
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
                    t[c] = this.dataArr.reduce((s, r) => s + (Number(r[c]) || 0), 0);
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
            groupOrder: this.options.groupOrder,
            requestedTotals: this.options.totals,
            requestedColumns: this.options.columns,
            requestDetails: {
                level: 0,
                expandingLevel: 0,
                groupingDimension: null,
                displayNames: [],
                rowId: null
            }
        };

        if(action === 'expand' && target) {
            const row = target.closest('tr');
            const level = parseInt(row.getAttribute('data-level') || 0);
            payload.requestDetails = {
                level: level,
                expandingLevel: level + 1,
                groupingDimension: row.getAttribute('data-dimension'),
                displayNames: this._getHierarchyForRow(row),
                rowId: row.id
            };
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

            payload.requestDetails.level = targetLevel;
            payload.requestDetails.expandingLevel = targetLevel;
            payload.requestDetails.groupingDimension = this.options.groupOrder[targetLevel];
        }
        return payload;
    }

    /**
     * Processes the server response and updates the DOM.
     * @param {Object} json - The JSON response from the server.
     */
    _fill(json) {
        // 1. Handle Business/Logic Errors (Status 200 but success: false)
        if(!json.success) {
            alert(json.error_message || "A server error occurred.");
            return;
        }

        const {data} = json;
        const {action, rows, level, displayNames, grandTotals} = data;

        // 2. Update Grand Totals if provided (usually for expandToLevel/change_grouping)
        if(grandTotals) {
            this.grandTotals = grandTotals;
        }

        if(action === 'expand') {
            // Find the specific parent row to inject children under
            const parentRow = this._findRowByHierarchy(displayNames);
            if(!parentRow) return;

            this._injectChildRows(parentRow, rows, level);
        } else if(action === 'expandToLevel' || action === 'change_grouping') {
            // Complete table refresh for the new level/dimension
            this.dataArr = rows; // Update local reference with the level's data
            this.render();

            // Ensure breadcrumbs reflect the target level
            this._updateBreadcrumbVisuals(level);
        }
    }

    /**
     * Add,inject rows from server after expand
     */
    _injectChildRows(parentRow, rows, parentLevel) {
        const tbody = this.table.tBodies[0];
        let lastInsertedRow = parentRow;

        const parentHierarchy = JSON.parse(
            parentRow.getAttribute('data-hierarchy') || "[]"
        );

        rows.forEach((rowData, idx) => {
            const currentLevel = parentLevel + 1;
            const isLeaf = currentLevel >= this.options.groupOrder.length;

            const dimensionKey = isLeaf
                ? this.options.groupOrder[parentLevel]
                : this.options.groupOrder[currentLevel];

            const label = rowData[dimensionKey];
            const rowId = this.options.idPrefix + "row_fetch_" + (this._idCounter++);
            const currentHierarchy = [...parentHierarchy, label];

            const tr = this._buildRow({
                tbody: tbody,
                insertAfterRow: lastInsertedRow,

                rowId: rowId,
                level: currentLevel,
                dimension: dimensionKey,
                hierarchy: currentHierarchy,
                parentRowId: parentRow.id,

                label: label,
                labelHtml: String(label),
                anchorHtml: " ",

                showDrillIcon: !isLeaf,
                childCount: null,
                isLeaf: isLeaf,

                item: rowData,
                gData: null,

                addEvenClass: !!(idx % 2),
                addFirstGroupClass: false
            });

            lastInsertedRow = tr;
        });

        const icon = parentRow.querySelector('.drillDowner_drill_icon');
        if(icon) {
            icon.classList.remove('drillDowner_drill_collapsed');
            icon.classList.add('drillDowner_drill_expanded');
        }
    }

    /* endregion: mode remote/fetch ________________________________________________________________________________ */

}
