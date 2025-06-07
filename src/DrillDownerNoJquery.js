class DrillDownerNoJquery {
    constructor(container, dataArr, options = {}) {
        // Handle container as either DOM element or selector string
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.dataArr = dataArr;
        this.options = Object.assign({
            columns: [],
            totals: [],
            colProperties: {},
            groupOrder: [],
            groupOrderCombinations: null,
            idPrefix: 'drillDowner' + Math.random().toString(36).slice(2) + '_',
            azBarSelector: null,
            controlsSelector: null,
            showGrandTotals: true, // New option to control grand totals display
        }, options);
        this.totals = this.options.totals || [];
        this.columns = this.options.columns || [];
        this.colProperties = this.options.colProperties || {};
        this.azBar = this.options.azBarSelector ? (typeof this.options.azBarSelector === 'string' ? 
            document.querySelector(this.options.azBarSelector) : this.options.azBarSelector) : null;
        this.controls = this.options.controlsSelector ? (typeof this.options.controlsSelector === 'string' ? 
            document.querySelector(this.options.controlsSelector) : this.options.controlsSelector) : null;
        this._natSort = new Intl.Collator('es-MX', {
            sensitivity: 'base',   // case & accent insensitive
            numeric: true,         // "2" < "10"
            caseFirst: 'false'     // case-insensitive order
        }).compare;
        // Calculate grand totals
        this.grandTotals = this._calculateGrandTotals();

        this._onDrillClick = this._onDrillClick.bind(this);
        this._onAZClick = this._onAZClick.bind(this);

        this.render();
    }

    // ---------- Public Methods ----------
    collapseToLevel(level = 0) {
        if(isNaN(level) || level == null|| level < 0)
            level = 0;
        if(level >= this.options.groupOrder.length)
            level = this.options.groupOrder.length - 1;

        const table = this.container.querySelector('table.drillDowner_table');
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
    }

    collapseAll() { this.collapseToLevel(0); }

    expandAll() { this.collapseToLevel(this.options.groupOrder.length - 1); }

    changeGroupOrder(newOrder) {
        this.options.groupOrder = newOrder;
        this.render();
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
        // Recalculate grand totals when rendering (in case data changed)
        this.grandTotals = this._calculateGrandTotals();

        // Clean up existing elements and their event listeners before rendering
        if(this.controls) {
            this.controls = this._removeAllEventListeners(this.controls);
        }
        if(this.azBar) {
            this.azBar = this._removeAllEventListeners(this.azBar);
        }
        if(this.table) {
            this.table = this._removeAllEventListeners(this.table);
        }

        this._renderControls();
        this._renderAZBar();
        this._renderTable();
        this.collapseToLevel(0);
    }

    getTable() { return this.container.querySelector('table.drillDowner_table'); }

    // ---------- Rendering ----------
    _renderControls() {
        if(!this.controls) return;
        const idPrefix = this.options.idPrefix;

        const breadcrumbElements = [];

        this.options.groupOrder.forEach((col, index) => {
            const label = this._getColLabel(col);
            const icon = this._getGroupIcon(col);

            breadcrumbElements.push(`
            <button type="button" class="drillDowner_breadcrumb_item" data-level="${index}">
                <span>${icon} ${label}</span>
            </button>
        `);

            if(index < this.options.groupOrder.length - 1) {
                const nextLabel = this._getColLabel(this.options.groupOrder[index + 1]);
                breadcrumbElements.push(`
                <button type="button" class="drillDowner_breadcrumb_arrow drillDowner_collapsed"
                     data-arrow-level="${index}"
                     title="Click to expand to ${nextLabel} level">
                    <span class="drillDowner_arrow_icon">▶</span>
                </button>
            `);
            }
        });

        const breadcrumbHTML = breadcrumbElements.join('');

        let selectOptions = '';
        let showGroupingControls = true;

        if(this.options.groupOrderCombinations) {
            this.options.groupOrderCombinations.forEach((combination, index) => {
                const labels = combination.map(col => this._getColLabel(col));
                selectOptions += `<option value="${index}">${labels.join(' → ')}</option>`;
            });
        } else {
            const groupCount = this.options.groupOrder.length;

            if(groupCount === 0) {
                selectOptions = '<option value="">No grouping available</option>';
                showGroupingControls = false;
            } else if(groupCount === 1) {
                showGroupingControls = false;
            } else if(groupCount === 2) {
                const labels = this.options.groupOrder.map(col => this._getColLabel(col));
                selectOptions = `
                <option value="0,1">${labels[0]} → ${labels[1]}</option>
                <option value="1,0">${labels[1]} → ${labels[0]}</option>
            `;
            } else if(groupCount === 3) {
                const labels = this.options.groupOrder.map(col => this._getColLabel(col));
                selectOptions = `
                <option value="0,1,2">${labels[0]} → ${labels[1]} → ${labels[2]}</option>
                <option value="0,2,1">${labels[0]} → ${labels[2]} → ${labels[1]}</option>
                <option value="1,0,2">${labels[1]} → ${labels[0]} → ${labels[2]}</option>
                <option value="1,2,0">${labels[1]} → ${labels[2]} → ${labels[0]}</option>
                <option value="2,0,1">${labels[2]} → ${labels[0]} → ${labels[1]}</option>
                <option value="2,1,0">${labels[2]} → ${labels[1]} → ${labels[0]}</option>
            `;
            } else {
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

        const groupingControlsHTML = showGroupingControls ? `
        <div class="drillDowner_grouping_controls">
            <div class="drillDowner_control_group">
                <span class="drillDowner_control_label">Group by:</span>
                <select class="drillDowner_modern_select" id="${idPrefix}grouporder">
                    ${selectOptions}
                </select>
            </div>
        </div>
    ` : '';

        // Remove existing event listeners before changing innerHTML
        this.controls = this._removeAllEventListeners(this.controls);

        this.controls.innerHTML = `
        <div class="drillDowner_controls_container">
            <div class="drillDowner_breadcrumb_nav">
                ${breadcrumbHTML}
            </div>
            ${groupingControlsHTML}
        </div>
    `;

        // Add event listeners for breadcrumb items
        const breadcrumbItems = this.controls.querySelectorAll('.drillDowner_breadcrumb_item');
        breadcrumbItems.forEach(item => {
            item.addEventListener('click', (e) => {
                this.collapseToLevel(parseInt(e.currentTarget.dataset.level));
            });
        });

        // Add event listeners for breadcrumb arrows
        const breadcrumbArrows = this.controls.querySelectorAll('.drillDowner_breadcrumb_arrow');
        breadcrumbArrows.forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                const arrowLevel = parseInt(e.currentTarget.dataset.arrowLevel);
                const targetLevel = arrowLevel + 1;
                const isCurrentlyExpanded = e.currentTarget.classList.contains('drillDowner_expanded');

                if (isCurrentlyExpanded) {
                    this.collapseToLevel(arrowLevel);
                } else {
                    this.collapseToLevel(targetLevel);
                }
            });
        });

        // Add event listener for group order select
        if(showGroupingControls) {
            const groupOrderSelect = this.controls.querySelector('#' + idPrefix + 'grouporder');
            if (groupOrderSelect) {
                groupOrderSelect.addEventListener('change', (e) => {
                    if (this.options.groupOrderCombinations) {
                        const selectedIndex = parseInt(e.target.value);
                        if (selectedIndex >= 0 && selectedIndex < this.options.groupOrderCombinations.length) {
                            const newOrder = this.options.groupOrderCombinations[selectedIndex];
                            this.changeGroupOrder(newOrder);
                        }
                    } else {
                        const indices = e.target.value.split(',').map(i => parseInt(i));
                        const newOrder = indices.map(i => this.options.groupOrder[i]);
                        this.changeGroupOrder(newOrder);
                    }
                });
            }
        }

        this._updateBreadcrumbArrows(0);
    }

    _updateBreadcrumbArrows(level = 0) {
        if(!this.controls) return;

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
            if(start === arr.length - 1) {
                result.push([...arr]);
                return;
            }

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
        const groupCol = this._getGroupCol(0);
        const presentLetters = new Set(this.dataArr.map(x => (x[groupCol]||"")[0]?.toUpperCase()));
        let html = '';
        for (let i = 65; i <= 90; i++) {
            const ch = String.fromCharCode(i);
            if(presentLetters.has(ch)) {
                html += `<div><a href="#${this.options.idPrefix}az${ch}" class="drillDowner_az_link ${this.options.idPrefix}az_link">${ch}</a></div>`;
            } else {
                html += `<div class="drillDowner_az_dimmed">${ch}</div>`;
            }
        }

        // Remove existing event listeners before changing innerHTML
        this.azBar = this._removeAllEventListeners(this.azBar);

        this.azBar.innerHTML = html;

        // Add event listeners for AZ links
        const azLinks = this.azBar.querySelectorAll('.' + this.options.idPrefix + 'az_link');
        azLinks.forEach(link => {
            link.addEventListener('click', this._onAZClick);
        });
    }

    _renderTable() {
        this.container.innerHTML = '';
        const groupCols = ["Item"];

        // Build total headers using colProperties
        const totalHeaders = this.totals.map(totalCol => {
            const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');
            if(subTotalBy) {
                const mainLabel = this._getColLabel(totalCol);
                const subLabel = this._getColLabel(subTotalBy);
                return `${mainLabel} (${subLabel})`;
            } else {
                return this._getColLabel(totalCol);
            }
        });

        // Build column headers using colProperties
        const columnHeaders = this.columns.map(col => this._getColLabel(col));

        const allHeaders = [...groupCols, ...totalHeaders, ...columnHeaders];

        // ---- Build Header Row ----
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        allHeaders.forEach((headerLabel, index) => {
            let headerClass = '';
            let headerContent = headerLabel;

            if(index === 0) {
                // "Item" column - no special class, no grand total
            } else if(index <= this.totals.length) {
                // Total columns - add grand total in header if enabled
                const totalCol = this.totals[index - 1];
                headerClass = this._getColLabelClass(totalCol);

                if(this.options.showGrandTotals) {
                    const grandTotalFormatted = this._formatGrandTotal(totalCol);
                    headerContent = `${headerLabel}<br><small>${grandTotalFormatted}</small>`;
                    headerClass += " drillDownerThTotal";
                }
            } else {
                // Data columns
                const col = this.columns[index - this.totals.length - 1];
                headerClass = this._getColLabelClass(col);
            }

            const th = document.createElement('th');
            th.className = headerClass;
            th.innerHTML = headerContent;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        // ---- Build Table Body ----
        const rows = [];
        this._sortAsc(this.dataArr, this.options.groupOrder);
        this._buildFlatRows(this.dataArr, this.options.groupOrder, 0, {}, rows);
        const tbody = document.createElement('tbody');
        rows.forEach(row => tbody.appendChild(row));

        // ---- Build Footer Row (identical to header) ----
        let tfoot = null;
        if(this.options.showGrandTotals) {
            tfoot = document.createElement('tfoot');
            const footerRow = document.createElement('tr');

            allHeaders.forEach((headerLabel, index) => {
                let footerClass = '';
                let footerContent = '';

                if(index === 0) {
                    // "Item" column
                    footerContent = '<b>Total</b>';
                    footerClass += " drillDowner_right";
                } else if(index <= this.totals.length) {
                    // Total columns - show grand total
                    const totalCol = this.totals[index - 1];
                    footerClass = this._getColLabelClass(totalCol) + ' drillDowner_num drillDownerTfootTotal';
                    footerContent = `${this._formatGrandTotal(totalCol)}`;
                } else {
                    // Data columns - empty
                    const col = this.columns[index - this.totals.length - 1];
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

        // ---- Assemble Table ----
        const table = document.createElement('table');
        table.className = 'drillDowner_table';
        table.appendChild(thead);
        table.appendChild(tbody);

        if(this.options.showGrandTotals && tfoot) {
            table.appendChild(tfoot);
        }

        this.container.appendChild(table);

        // Add event listeners for drill icons
        const drillIcons = table.querySelectorAll('.' + this.options.idPrefix + 'drill_icon');
        drillIcons.forEach(icon => {
            icon.addEventListener('click', this._onDrillClick);
        });

        this.table = table;
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

        const groupKeys = Object.keys(grouped);
        groupKeys.forEach((key, i) => {
            const groupData = grouped[key];
            const keyParts = groupOrder.slice(0, level + 1).map((col, idx) => {
                return parentKeys[col] || (idx === level ? key : "");
            });
            const rowId = this.options.idPrefix + "row_" + keyParts.join("_").replace(/\s/g, "_");
            const parentId = level === 0 ? "" : this.options.idPrefix + "row_" + groupOrder.slice(0, level).map((col) => {
                return parentKeys[col];
            }).join("_").replace(/\s/g, "_");

            const tr = document.createElement('tr');
            tr.id = rowId;
            tr.setAttribute("data-level", level);
            tr.setAttribute("data-parent", parentId);
            tr.classList.add("drillDowner_row_" + groupKey);

            if(i % 2 === 1) tr.classList.add('drillDowner_even');
            if(i === 0) tr.classList.add('drillDowner_first_group');

            if(level === 0 && key.length > 0) {
                const firstLetter = key.charAt(0).toUpperCase();
                tr.id = this.options.idPrefix + "az" + firstLetter;
            }

            let icon = '';
            if(level < groupOrder.length - 1) {
                icon = `<span class="${this.options.idPrefix}drill_icon drillDowner_drill_icon drillDowner_drill_collapsed" data-rowid="${rowId}" data-level="${level}"></span>`;
            }
            let label;
            if(level === 0) label = `<span class="drillDowner_indent_${level}">${icon}<b>${key}</b></span>`;
            else label = `<span class="drillDowner_indent_${level}">${icon}${key}</span>`;

            const firstCell = document.createElement('td');
            firstCell.innerHTML = label;
            tr.appendChild(firstCell);

            // ---- Totals columns using colProperties ----
            this.totals.forEach(totalCol => {
                const decimals = this._getColDecimals(totalCol);
                const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');

                const td = document.createElement('td');
                td.className = 'drillDowner_num';

                if(!subTotalBy) {
                    const sum = groupData.reduce((a, b) => a + (b[totalCol] || 0), 0);
                    td.innerHTML = DrillDownerNoJquery.formatNumber(sum, decimals);
                } else {
                    const subtotals = {};
                    groupData.forEach(row => {
                        const k = row[subTotalBy];
                        if(row[totalCol] != null && k) {
                            subtotals[k] = (subtotals[k] || 0) + row[totalCol];
                        }
                    });
                    const str = Object.entries(subtotals)
                        .map(([sub, val]) => DrillDownerNoJquery.formatNumber(val, decimals) + " " + sub)
                        .join(', ') || '-';
                    td.innerHTML = str;
                }

                tr.appendChild(td);
            });

            // ---- Display columns using colProperties ----
            this.columns.forEach(col => {
                const togglesUp = this._getColTogglesUp(col);
                const cellClass = this._getColClass(col);
                const formatter = this._getColFormatter(col);

                const td = document.createElement('td');
                td.className = cellClass;

                if(togglesUp) {
                    const uniqueValues = new Set();
                    for (const row of groupData) {
                        let val = (col in row) ? row[col] : '';
                        if(formatter && typeof formatter === 'function') {
                            val = formatter(val, row);
                        }
                        if(val && val !== "") {
                            uniqueValues.add(val);
                        }
                    }
                    const displayValue = Array.from(uniqueValues).join(', ');
                    td.innerHTML = displayValue;
                } else {
                    if(level === groupOrder.length - 1 && groupData.length === 1) {
                        const item = groupData[0];
                        let val = (col in item) ? item[col] : '';
                        if(formatter && typeof formatter === 'function') {
                            val = formatter(val, item);
                        }
                        td.innerHTML = val;
                    } else {
                        td.innerHTML = '';
                    }
                }

                tr.appendChild(td);
            });

            rows.push(tr);

            if(level < groupOrder.length - 1) {
                this._buildFlatRows(groupData, groupOrder, level + 1, {...parentKeys, [groupCol]: key}, rows);
            }
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
                    const drillIcons = row.querySelectorAll('.drillDowner_drill_icon');
                    drillIcons.forEach(icon => {
                        icon.classList.remove('drillDowner_drill_expanded');
                        icon.classList.add('drillDowner_drill_collapsed');
                    });
                    this._setChildrenVisible(row.id, +row.getAttribute('data-level'), false, allRows);
                }
            }
        });
    }

    _onAZClick(e) {
        setTimeout(function(){
            window.scrollBy(0, -30);
        }, 1);
    }

    static formatNumber(n, decimals) {
        if(isNaN(n)) return n;
        return Number(n).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Sorts array in-place, ascending, by all keys in order.
     *
     * @param {Array<Object>} arr - Array of objects to sort
     * @param {Array<string>} keys - Properties to sort by (in order)
     * @returns {Array<Object>} The sorted array
     */
    _sortAsc(arr, keys) {
        const cmp = this._natSort;
        arr.sort((a, b) => {
            for (let key of keys) {
                const aa = (a[key] ?? '').toString();
                const bb = (b[key] ?? '').toString();
                const result = cmp(aa, bb);
                if (result !== 0) return result; // Ascending only
            }
            return 0; // All keys are equal
        });
        return arr;
    }

    _calculateGrandTotals() {
        const grandTotals = {};

        this.totals.forEach(totalCol => {
            const subTotalBy = this._getColProperty(totalCol, 'subTotalBy');

            if (!subTotalBy) {
                // Simple sum
                grandTotals[totalCol] = this.dataArr.reduce((sum, row) => sum + (row[totalCol] || 0), 0);
            } else {
                // Group by subTotalBy and sum within each group
                const subtotals = {};
                this.dataArr.forEach(row => {
                    const key = row[subTotalBy];
                    if (row[totalCol] != null && key) {
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

        if (!subTotalBy) {
            return DrillDownerNoJquery.formatNumber(grandTotal, decimals);
        } else {
            // Format subtotals
            const formattedSubtotals = Object.entries(grandTotal)
                .map(([sub, val]) => DrillDownerNoJquery.formatNumber(val, decimals) + " " + sub)
                .join('<br>');
            return formattedSubtotals || '-';
        }
    }

    // Helper methods to get properties from this.options.colProperties
    _getColProperty(col, property, fallback = null) {
        if(this.colProperties[col] && this.colProperties[col][property] !== undefined) {
            return this.colProperties[col][property];
        }
        return fallback;
    }

    _getColDecimals(col) {return this._getColProperty(col, 'decimals', 2);}
    _getColLabel(col) {return this._getColProperty(col, 'label', col.charAt(0).toUpperCase() + col.slice(1));}
    _getGroupIcon(col) {return this._getColProperty(col, 'icon', '');}
    _getColClass(col) {return this._getColProperty(col, 'class', '');}
    _getColLabelClass(col) {return this._getColProperty(col, 'labelClass', '');}
    _getColKey(col) {return this._getColProperty(col, 'key', col);}
    _getColTogglesUp(col) {return this._getColProperty(col, 'togglesUp', false);}
    _getColFormatter(col) {return this._getColProperty(col, 'formatter', null);}
    _getColSubTotalBy(col) {return this._getColProperty(col, 'subTotalBy', null);}
    _getGroupCol(level) {return this.options.groupOrder[level];}
    _getGroupLabel(level) {return this._getColLabel(this._getGroupCol(level));}
    _getGroupKey(level) {return this._getColKey(this._getGroupCol(level));}

    // Helper method to remove all event listeners from an element
    _removeAllEventListeners(element) {
        if (!element) return;

        // Create a clone of the element without event listeners
        const clone = element.cloneNode(true);

        // Replace the original element with the clone
        if (element.parentNode) {
            element.parentNode.replaceChild(clone, element);
            return clone;
        }

        return element;
    }
}
