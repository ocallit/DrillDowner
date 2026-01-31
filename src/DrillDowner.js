class DrillDowner {
    constructor(container, dataArr, options = {}) {
        // Handle container as either DOM element or selector string
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.dataArr = dataArr;

        // Default options
        this.options = Object.assign({
            columns: [],
            totals: [],
            colProperties: {},
            groupOrder: [],
            groupOrderCombinations: null,
            ledger: [], // Now expected to be an Array of objects, or null
            idPrefix: 'drillDowner' + Math.random().toString(36).slice(2) + '_',
            azBarSelector: null,
            controlsSelector: null,
            showGrandTotals: true,
        }, options);

        // Normalize 'ledger' to array if a single object was passed (backward compatibility)
        if (this.options.ledger && !Array.isArray(this.options.ledger)) {
            this.options.ledger = [this.options.ledger];
        }
        // Ensure it is an array
        this.options.ledger = this.options.ledger || [];

        // Initialize State
        // If initialized with no groups but we have ledgers, select the first one.
        if (this.options.groupOrder.length === 0 && this.options.ledger.length > 0) {
            this.activeLedgerIndex = 0;
        } else {
            this.activeLedgerIndex = -1; // -1 indicates Standard Grouping Mode
        }

        this.options.totals = this.options.totals || [];
        this.options.columns = this.options.columns || [];

        // Save default columns to restore them when switching back from Ledger mode
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

        // Calculate grand totals
        this.grandTotals = this._calculateGrandTotals();
        this._onDrillClick = this._onDrillClick.bind(this);
        this._onAZClick = this._onAZClick.bind(this);
        this.render();
    }

    // ---------- Public Methods ----------
    collapseToLevel(level = 0) {
        if(!this.container) return this;

        // Guard: if in Ledger Mode (no grouping), collapse does nothing
        if(!this.options.groupOrder || this.options.groupOrder.length === 0) {
            this._updateBreadcrumbArrows(0);
            return this;
        }

        if(isNaN(level) || level == null || level < 0) level = 0;

        const maxLevel = this.options.groupOrder.length - 1;
        if(level > maxLevel) level = maxLevel;

        const table = this.container.querySelector('table.drillDowner_table');
        if(!table) {
            this._updateBreadcrumbArrows(level);
            return this;
        }

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const lvl = +row.getAttribute('data-level');
            if(lvl > level) row.style.display = 'none';
            else row.style.display = '';

            const drillIcons = row.querySelectorAll('.drillDowner_drill_icon');
            drillIcons.forEach(icon => {
                icon.classList.remove('drillDowner_drill_expanded');
                icon.classList.add('drillDowner_drill_collapsed');
            });
        });

        this._updateBreadcrumbArrows(level);
        return this;
    }

    collapseAll() { this.collapseToLevel(0); return this;}
    expandAll() { this.collapseToLevel(this.options.groupOrder.length - 1); return this;}

    changeGroupOrder(newOrder) {
        // Restoration Logic:
        // If we are currently in a Ledger Mode (index != -1), restore the standard columns.
        // If we are already in Standard Mode (index == -1), do NOT touch the columns.
        // This preserves any manual column changes the user might have made.
        if (this.activeLedgerIndex !== -1) {
            this.options.columns = [...this._defaultColumns];
            this.activeLedgerIndex = -1;
        }

        this.options.groupOrder = newOrder;
        this.render();
        return this;
    }

    destroy() {
        if(this.controls) {
            this.controls = this._removeAllEventListeners(this.controls);
            this.controls.innerHTML = '';
        }
        if(this.azBar) {
            this.azBar = this._removeAllEventListeners(this.azBar);
            this.azBar.innerHTML = '';
        }
        if(this.table) this.table = this._removeAllEventListeners(this.table);
        this.container.innerHTML = '';
    }

    render() {
        // Recalculate grand totals
        this.grandTotals = this._calculateGrandTotals();

        // --- SYNC COLUMNS BASED ON MODE ---
        // Only enforce columns if we are explicitly in Ledger Mode.
        // In Standard Mode, we respect whatever is currently in this.options.columns.
        if (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0 && this.options.ledger[this.activeLedgerIndex]) {
            const activeLedger = this.options.ledger[this.activeLedgerIndex];
            if (activeLedger.cols) {
                this.options.columns = activeLedger.cols;
            }
        }

        // Ensure index is reset if groupOrder was populated externally (e.g. manual override without using changeGroupOrder)
        if (this.options.groupOrder.length > 0) {
            this.activeLedgerIndex = -1;
        }

        // Clean up
        if(this.controls) this.controls = this._removeAllEventListeners(this.controls);
        if(this.azBar) this.azBar = this._removeAllEventListeners(this.azBar);
        if(this.table) this.table = this._removeAllEventListeners(this.table);

        this._renderControls();
        this._renderAZBar();
        this._renderTable();

        if(this.options.groupOrder.length > 0) {
            this.collapseToLevel(0);
        }
    }

    getTable() { return this.container.querySelector('table.drillDowner_table'); }

    // ---------- Rendering ----------
    _renderControls() {
        if(!this.controls) return;
        const idPrefix = this.options.idPrefix;
        const breadcrumbElements = [];

        // Breadcrumbs
        if (this.options.groupOrder.length > 0) {
            this.options.groupOrder.forEach((col, index) => {
                const label = this._getColLabel(col);
                const icon = this._getGroupIcon(col);
                breadcrumbElements.push(`
                <button type="button" class="drillDowner_breadcrumb_item" data-level="${index}">
                    <span>${icon} ${label}</span>
                </button>`);

                if(index < this.options.groupOrder.length - 1) {
                    const nextLabel = this._getColLabel(this.options.groupOrder[index + 1]);
                    breadcrumbElements.push(`
                    <button type="button" class="drillDowner_breadcrumb_arrow drillDowner_collapsed"
                         data-arrow-level="${index}"
                         title="Click to expand to ${nextLabel} level">
                        <span class="drillDowner_arrow_icon">▶</span>
                    </button>`);
                }
            });
        } else if (this.activeLedgerIndex >= 0 && this.options.ledger[this.activeLedgerIndex]) {
            // Show Ledger Label in breadcrumb area
            const ledgerLabel = this.options.ledger[this.activeLedgerIndex].label;
            breadcrumbElements.push(`<span class="drillDowner_breadcrumb_item" style="cursor:default"><b>${ledgerLabel}</b></span>`);
        }

        const breadcrumbHTML = breadcrumbElements.join('');
        let selectOptions = '';
        let showGroupingControls = true;

        // 1. Group Permutations / Combinations
        if(this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combination, index) => {
                const labels = combination.map(col => this._getColLabel(col));
                selectOptions += `<option value="${index}">${labels.join(' → ')}</option>`;
            });
        } else {
            // Default Permutations Logic
            const groupCount = this.options.groupOrder.length;
            // If groupCount is 0 (Ledger Mode active), we rely on ledger options below to populate select
            // If groupCount > 0, we generate permutations
            if(groupCount > 0) {
                if(groupCount === 2) {
                    const labels = this.options.groupOrder.map(col => this._getColLabel(col));
                    selectOptions = `
                    <option value="0,1">${labels[0]} → ${labels[1]}</option>
                    <option value="1,0">${labels[1]} → ${labels[0]}</option>`;
                } else if(groupCount === 3) {
                    const labels = this.options.groupOrder.map(col => this._getColLabel(col));
                    selectOptions = `
                    <option value="0,1,2">${labels[0]} → ${labels[1]} → ${labels[2]}</option>
                    <option value="0,2,1">${labels[0]} → ${labels[2]} → ${labels[1]}</option>
                    <option value="1,0,2">${labels[1]} → ${labels[0]} → ${labels[2]}</option>
                    <option value="1,2,0">${labels[1]} → ${labels[2]} → ${labels[0]}</option>
                    <option value="2,0,1">${labels[2]} → ${labels[0]} → ${labels[1]}</option>
                    <option value="2,1,0">${labels[2]} → ${labels[1]} → ${labels[0]}</option>`;
                } else if (groupCount > 1) {
                    const allPermutations = this._generatePermutations(groupCount);
                    const limitedPermutations = allPermutations.slice(0, 9);
                    const labels = this.options.groupOrder.map(col => this._getColLabel(col));
                    limitedPermutations.forEach(perm => {
                        const permLabels = perm.map(i => labels[i]);
                        const permValue = perm.join(',');
                        selectOptions += `<option value="${permValue}">${permLabels.join(' → ')}</option>`;
                    });
                }
            }
        }

        // 2. Add Ledger Options
        if (this.options.ledger.length > 0) {
            this.options.ledger.forEach((led, idx) => {
                const isSelected = (this.activeLedgerIndex === idx) ? 'selected' : '';
                // Value format: __LEDGER_0__, __LEDGER_1__
                selectOptions += `<option value="__LEDGER_${idx}__" ${isSelected}>${led.label}</option>`;
            });
        }

        // Logic to decide whether to hide controls
        if (this.options.groupOrder.length === 0 && this.options.ledger.length === 0) {
            showGroupingControls = false;
        }
        if (this.options.groupOrder.length === 1 && this.options.ledger.length === 0) {
            showGroupingControls = false;
        }

        const groupingControlsHTML = showGroupingControls ? `
        <div class="drillDowner_grouping_controls">
            <div class="drillDowner_control_group">
                <span class="drillDowner_control_label">Group by:</span>
                <select class="drillDowner_modern_select" id="${idPrefix}grouporder">
                    ${selectOptions}
                </select>
            </div>
        </div>` : '';

        this.controls.innerHTML = `
        <div class="drillDowner_controls_container">
            <div class="drillDowner_breadcrumb_nav">${breadcrumbHTML}</div>
            ${groupingControlsHTML}
        </div>`;

        // Breadcrumb Events
        const breadcrumbItems = this.controls.querySelectorAll('.drillDowner_breadcrumb_item');
        breadcrumbItems.forEach(item => {
            if(!item.dataset.level) return;
            item.addEventListener('click', (e) => this.collapseToLevel(parseInt(e.currentTarget.dataset.level)));
        });

        // Arrow Events
        const breadcrumbArrows = this.controls.querySelectorAll('.drillDowner_breadcrumb_arrow');
        breadcrumbArrows.forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                const arrowLevel = parseInt(e.currentTarget.dataset.arrowLevel);
                const isExpanded = e.currentTarget.classList.contains('drillDowner_expanded');
                this.collapseToLevel(isExpanded ? arrowLevel : arrowLevel + 1);
            });
        });

        // Select Event
        if(showGroupingControls) {
            const groupOrderSelect = this.controls.querySelector('#' + idPrefix + 'grouporder');
            if (groupOrderSelect) {
                groupOrderSelect.addEventListener('change', (e) => {
                    const val = e.target.value;

                    if (val.startsWith('__LEDGER_')) {
                        // Switch to Specific Ledger
                        const idx = parseInt(val.replace('__LEDGER_', '').replace('__', ''));
                        this.options.groupOrder = [];
                        this.activeLedgerIndex = idx;
                        this.render();
                    } else {
                        // Switch to Standard Grouping
                        // We do NOT set activeLedgerIndex = -1 here manually.
                        // We rely on changeGroupOrder to detect the state and restore columns.

                        if (this.options.groupOrderCombinations) {
                            const selectedIndex = parseInt(val);
                            if (selectedIndex >= 0 && selectedIndex < this.options.groupOrderCombinations.length) {
                                this.changeGroupOrder(this.options.groupOrderCombinations[selectedIndex]);
                            }
                        } else {
                            // Fallback permutation logic
                            const indices = val.split(',').map(i => parseInt(i));
                            if(this.options.groupOrder.length > 0) {
                                const newOrder = indices.map(i => this.options.groupOrder[i]);
                                this.changeGroupOrder(newOrder);
                            }
                        }
                    }
                });
            }
        }

        this._updateBreadcrumbArrows(0);
    }

    _updateBreadcrumbArrows(level = 0) {
        if(!this.controls || this.options.groupOrder.length === 0) return;
        const arrows = this.controls.querySelectorAll('.drillDowner_breadcrumb_arrow');
        arrows.forEach((arrow, index) => {
            const targetLevel = index + 1;
            if(targetLevel < this.options.groupOrder.length) {
                const nextLabel = this._getColLabel(this.options.groupOrder[targetLevel]);
                arrow.classList.remove('drillDowner_expanded', 'drillDowner_collapsed');
                if(level >= targetLevel) {
                    arrow.classList.add('drillDowner_expanded');
                    arrow.setAttribute('title', `Collapsa a ${nextLabel} level`);
                } else {
                    arrow.classList.add('drillDowner_collapsed');
                    arrow.setAttribute('title', `Expande a ${nextLabel} level`);
                }
            }
        });
    }

    _generatePermutations(n) {
        if(n <= 1) return n === 0 ? [] : [[0]];
        const result = [];
        const arr = Array.from({length: n}, (_, i) => i);
        function permute(arr, start = 0) {
            if(start === arr.length - 1) { result.push([...arr]); return; }
            for (let i = start; i < arr.length; i++) {
                [arr[start], arr[i]] = [arr[i], arr[start]];
                permute(arr, start + 1);
                [arr[start], arr[i]] = [arr[i], arr[start]];
            }
        }
        permute(arr);
        return result;
    }

    _renderAZBar() {
        if(!this.azBar) return;
        // Ledger mode: clear AZ bar
        if (this.options.groupOrder.length === 0) {
            this.azBar.innerHTML = '';
            return;
        }
        const groupCol = this._getGroupCol(0);
        const presentLetters = new Set(this.dataArr.map(x => (x[groupCol]||"")[0]?.toUpperCase()));
        let html = '';
        for (let i = 65; i <= 90; i++) {
            const ch = String.fromCharCode(i);
            const anchorId = `${this.options.idPrefix}az${ch}`;
            if(presentLetters.has(ch)) {
                html += `<div><a href="#${anchorId}" class="drillDowner_az_link ${this.options.idPrefix}az_link">${ch}</a></div>`;
            } else {
                html += `<div class="drillDowner_az_dimmed">${ch}</div>`;
            }
        }
        this.azBar = this._removeAllEventListeners(this.azBar);
        this.azBar.innerHTML = html;
        const azLinks = this.azBar.querySelectorAll('.' + this.options.idPrefix + 'az_link');
        azLinks.forEach(link => link.addEventListener('click', this._onAZClick));
    }

    _renderTable() {
        this.container.innerHTML = '';
        const groupCols = this.options.groupOrder.length > 0 ? ["Item"] : ["#"];

        // Headers
        const totalHeaders = this.options.totals.map(totalCol => {
            const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');
            if(subTotalBy) {
                const mainLabel = this._getColLabel(totalCol);
                const subLabel = this._getColLabel(subTotalBy);
                return `${mainLabel} (${subLabel})`;
            } else return this._getColLabel(totalCol);
        });

        const columnHeaders = this.options.columns.map(col => this._getColLabel(col));
        const allHeaders = [...groupCols, ...totalHeaders, ...columnHeaders];

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        allHeaders.forEach((headerLabel, index) => {
            let headerClass = '';
            let headerContent = headerLabel;
            if(index === 0) {
            } else if(index <= this.options.totals.length) {
                const totalCol = this.options.totals[index - 1];
                headerClass = this._getColLabelClass(totalCol);
                if(this.options.showGrandTotals) {
                    const grandTotalFormatted = this._formatGrandTotal(totalCol);
                    headerContent = `${headerLabel}<br><small>${grandTotalFormatted}</small>`;
                    headerClass += " drillDownerThTotal";
                }
            } else {
                const col = this.options.columns[index - this.options.totals.length - 1];
                headerClass = this._getColLabelClass(col);
            }
            const th = document.createElement('th');
            th.className = headerClass;
            th.innerHTML = headerContent;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Body
        const rows = [];
        this.azAnchoredLetters = new Set();
        const tbody = document.createElement('tbody');

        // --- STRATEGY BRANCHING ---
        if (this.options.groupOrder.length === 0 && this.activeLedgerIndex >= 0 && this.options.ledger[this.activeLedgerIndex]) {
            // LEDGER MODE
            const config = this.options.ledger[this.activeLedgerIndex];
            this._sortAsc(this.dataArr, config.sort);
            this._buildNoGroupRows(this.dataArr, rows);
        } else {
            // GROUPED MODE
            this._sortAsc(this.dataArr, this.options.groupOrder);
            this._buildFlatRows(this.dataArr, this.options.groupOrder, 0, {}, rows);
        }

        rows.forEach(row => tbody.appendChild(row));

        // Footer
        let tfoot = null;
        if(this.options.showGrandTotals) {
            tfoot = document.createElement('tfoot');
            const footerRow = document.createElement('tr');
            allHeaders.forEach((headerLabel, index) => {
                let footerClass, footerContent;
                if(index === 0) {
                    footerContent = '<b>Total</b>';
                    footerClass = " drillDowner_right";
                } else if(index <= this.options.totals.length) {
                    const totalCol = this.options.totals[index - 1];
                    footerClass = this._getColLabelClass(totalCol) + ' drillDowner_num drillDownerTfootTotal';
                    footerContent = `${this._formatGrandTotal(totalCol)}`;
                } else {
                    const col = this.options.columns[index - this.options.totals.length - 1];
                    footerClass = this._getColLabelClass(col);
                    footerContent = '';
                }
                const td = document.createElement('td');
                td.className = footerClass;
                td.innerHTML = footerContent;
                footerRow.appendChild(td);
            });
            tfoot.appendChild(footerRow);
        }

        const table = document.createElement('table');
        table.className = 'drillDowner_table';
        table.appendChild(thead);
        table.appendChild(tbody);
        if(this.options.showGrandTotals && tfoot) table.appendChild(tfoot);

        this.container.appendChild(table);
        table.querySelectorAll('.' + this.options.idPrefix + 'drill_icon')
            .forEach(icon => icon.addEventListener('click', this._onDrillClick));
        this.table = table;
    }

    _buildNoGroupRows(dataArr, rows) {
        dataArr.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = index % 2 === 1 ? 'drillDowner_even' : '';
            const tdName = document.createElement('td');
            tdName.innerHTML = `<span class="drillDowner_indent_0">${index + 1}</span>`;
            tr.appendChild(tdName);
            this._appendDataCells(tr, item, null, true);
            rows.push(tr);
        });
    }

    _buildFlatRows(dataArr, groupOrder, level, parentKeys, rows) {
        if(level >= groupOrder.length) return;
        const groupCol = this._getGroupCol(level);
        const groupKey = this._getGroupKey(level);

        const grouped = {};
        dataArr.forEach(item => {
            const val = item[groupCol];
            if(!(val in grouped)) grouped[val] = [];
            grouped[val].push(item);
        });

        Object.keys(grouped).forEach((key, i) => {
            const groupData = grouped[key];
            const keyParts = groupOrder.slice(0, level + 1).map((col, idx) => {
                return parentKeys[col] || (idx === level ? key : "");
            });
            const rowId = this.options.idPrefix + "row_" + keyParts.join("_").replace(/\s/g, "_");
            const parentId = level === 0 ? "" : this.options.idPrefix + "row_" + groupOrder.slice(0, level).map((col) => parentKeys[col]).join("_").replace(/\s/g, "_");

            const tr = document.createElement('tr');
            tr.id = rowId;
            tr.setAttribute("data-level", level);
            tr.setAttribute("data-parent", parentId);
            tr.classList.add("drillDowner_row_" + groupKey);
            if(i % 2 === 1) tr.classList.add('drillDowner_even');
            if(i === 0) tr.classList.add('drillDowner_first_group');

            let anchorHtml = '';
            if(level === 0) {
                const keyString = key == null ? '' : String(key);
                if(keyString.length > 0) {
                    const firstLetter = keyString.charAt(0).toUpperCase();
                    if(!this.azAnchoredLetters.has(firstLetter)) {
                        const anchorId = this.options.idPrefix + "az" + firstLetter;
                        anchorHtml = `<span id="${anchorId}" class="drillDowner_az_anchor"></span>`;
                        this.azAnchoredLetters.add(firstLetter);
                    }
                }
            }

            let icon = '';
            if(level < groupOrder.length - 1) {
                icon = `<span class="${this.options.idPrefix}drill_icon drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${level}"></span>`;
            }
            let label;
            if(level === 0) label = `<span class="drillDowner_indent_${level}">${icon}<b>${key}</b></span>`;
            else label = `<span class="drillDowner_indent_${level}">${icon}${key}</span>`;

            const firstCell = document.createElement('td');
            firstCell.innerHTML = anchorHtml + label;
            tr.appendChild(firstCell);

            const isLeaf = (level === groupOrder.length - 1) && (groupData.length === 1);
            const representativeItem = groupData.length > 0 ? groupData[0] : {};

            this._appendDataCells(tr, representativeItem, groupData, isLeaf);
            rows.push(tr);

            if(level < groupOrder.length - 1) {
                this._buildFlatRows(groupData, groupOrder, level + 1, {...parentKeys, [groupCol]: key}, rows);
            }
        });
    }

    _appendDataCells(tr, item, groupData = null, isLeaf = false) {
        // Totals
        this.options.totals.forEach(totalCol => {
            const decimals = this._getColDecimals(totalCol);
            const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');
            const td = document.createElement('td');
            td.className = 'drillDowner_num';

            if(groupData) {
                if(!subTotalBy) {
                    const sum = groupData.reduce((a, b) => a + (Number( b[totalCol]) || 0), 0);
                    td.innerHTML = DrillDowner.formatNumber(sum, decimals);
                } else {
                    const subtotals = {};
                    groupData.forEach(row => {
                        const k = row[subTotalBy];
                        if(row[totalCol] != null && k !== null) {
                            subtotals[k] = (Number( subtotals[k]) || 0) + Number( row[totalCol]);
                        }
                    });
                    td.innerHTML = Object.entries(subtotals)
                        .map(([sub, val]) => DrillDowner.formatNumber(val, decimals) + " " + sub)
                        .join(', ') || '-';
                }
            } else {
                const val = Number(item[totalCol]) || 0;
                td.innerHTML = DrillDowner.formatNumber(val, decimals);
            }
            tr.appendChild(td);
        });

        // Data Columns
        this.options.columns.forEach(col => {
            const togglesUp = this._getColTogglesUp(col);
            const cellClass = this._getColClass(col);
            const formatter = this._getColFormatter(col);
            const td = document.createElement('td');
            td.className = cellClass;

            if(groupData && togglesUp) {
                const uniqueValues = new Set();
                for (const row of groupData) {
                    let val = (col in row) ? row[col] : '';
                    if(formatter) val = formatter(val, row);
                    if(val && val !== "") uniqueValues.add(val);
                }
                td.innerHTML = Array.from(uniqueValues).join(', ');
            } else {
                if(!groupData || isLeaf) {
                    let val = (col in item) ? item[col] : '';
                    if(formatter) val = formatter(val, item);
                    td.innerHTML = val;
                } else td.innerHTML = '';
            }
            tr.appendChild(td);
        });
    }

    _onDrillClick(e) {
        const icon = e.target;
        const thisRowId = icon.dataset.rowid;
        const thisLevel = +icon.dataset.level;
        const table = icon.closest('table');
        const allRows = table.querySelectorAll('tbody tr');

        if(icon.classList.contains('drillDowner_drill_collapsed')) {
            icon.classList.remove('drillDowner_drill_collapsed');
            icon.classList.add('drillDowner_drill_expanded');
            this._setChildrenVisible(thisRowId, thisLevel, true, allRows);
        } else {
            icon.classList.remove('drillDowner_drill_expanded');
            icon.classList.add('drillDowner_drill_collapsed');
            this._setChildrenVisible(thisRowId, thisLevel, false, allRows);
        }
    }

    _setChildrenVisible(parentId, parentLevel, visible, allRows) {
        allRows.forEach(row => {
            if(row.getAttribute('data-parent') === parentId) {
                if(visible) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                    row.querySelectorAll('.drillDowner_drill_icon').forEach(icon => {
                        icon.classList.remove('drillDowner_drill_expanded');
                        icon.classList.add('drillDowner_drill_collapsed');
                    });
                    this._setChildrenVisible(row.id, +row.getAttribute('data-level'), false, allRows);
                }
            }
        });
    }

    _onAZClick() { setTimeout(function(){ window.scrollBy(0, -30); }, 1); }

    static formatNumber(n, decimals) {
        if (n === '' || n === null) return '';
        if(isNaN(n)) return n;
        return Number(n).toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
    }

    _sortAsc(arr, keys) {
        if(!keys || keys.length === 0) return arr;
        const cmp = this._natSort;
        arr.sort((a, b) => {
            for (let key of keys) {
                const aa = (a[key] ?? '').toString();
                const bb = (b[key] ?? '').toString();
                const result = cmp(aa, bb);
                if (result !== 0) return result;
            }
            return 0;
        });
        return arr;
    }

    _calculateGrandTotals() {
        const grandTotals = {};
        this.options.totals.forEach(totalCol => {
            const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');
            if (!subTotalBy) {
                grandTotals[totalCol] = this.dataArr.reduce((sum, row) => sum + (row[totalCol] || 0), 0);
            } else {
                const subtotals = {};
                this.dataArr.forEach(row => {
                    const key = row[subTotalBy];
                    if (row[totalCol] != null && key !== null) {
                        subtotals[key] = (subtotals[key] || 0) + row[totalCol];
                    }
                });
                grandTotals[totalCol] = subtotals;
            }
        });
        return grandTotals;
    }

    _formatGrandTotal(totalCol) {
        const decimals = this._getColDecimals(totalCol);
        const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');
        const grandTotal = this.grandTotals[totalCol];
        if (!subTotalBy) return DrillDowner.formatNumber(grandTotal, decimals);
        else {
            const formatted = Object.entries(grandTotal)
                .map(([sub, val]) => DrillDowner.formatNumber(val, decimals) + " " + sub)
                .join('<br>');
            return formatted || '-';
        }
    }

    _getColProperty(col, property, fallback = null) {
        if(this.options.colProperties[col] && this.options.colProperties[col][property] !== undefined)
            return this.options.colProperties[col][property];
        return fallback;
    }
    _getColDecimals(col) {return this._getColProperty(col, 'decimals', 2);}
    _getColLabel(col) {return this._getColProperty(col, 'label', col.charAt(0).toUpperCase() + col.slice(1));}
    _getGroupIcon(col) {return this._getColProperty(col,    'icon', '');}
    _getColClass(col) {return this._getColProperty(col, 'class', '');}
    _getColLabelClass(col) {return this._getColProperty(col, 'labelClass', '');}
    _getColKey(col) {return this._getColProperty(col, 'key', col);}
    _getColTogglesUp(col) {return this._getColProperty(col, 'togglesUp', false);}
    _getColFormatter(col) {return this._getColProperty(col, 'formatter', null);}
    _getGroupCol(level) {return this.options.groupOrder[level];}
    _getGroupKey(level) {return this._getColKey(this._getGroupCol(level));}

    _removeAllEventListeners(element) {
        if (!element) return;
        const clone = element.cloneNode(true);
        if (element.parentNode) {
            element.parentNode.replaceChild(clone, element);
            return clone;
        }
        return element;
    }
}