# DrillDowner — API Reference

**Version 1.2.2 · Zero dependencies · ES6 · Vanilla JS**

---

## Mental Model

DrillDowner takes a **flat array of plain objects** and renders them as either an interactive hierarchical table or a flat sorted table, controlled by three arrays in `options`:

| Array | Role |
|-------|------|
| `groupOrder` | Columns that form the drill-down hierarchy (outermost first) |
| `totals` | Numeric columns summed at every group level and in the grand total |
| `columns` | Non-numeric display columns shown as-is (empty on group rows unless `togglesUp`) |

**Two rendering modes:**

| Mode | When | What renders |
|------|------|-------------|
| **Grouped** | `groupOrder` is non-empty | Collapsible hierarchy; subtotals per group |
| **Ledger** | `groupOrder` is `[]` and `ledger` is defined | Flat sorted table; one row per item |

Both modes share the same dropdown: `ledger` entries appear alongside grouping combinations.

**Column order in the rendered table:**
- **Grouped mode:** label column → `totals` columns → `columns` columns.
- **Ledger mode:** columns follow `led.cols`; any `totals` not in `cols` are appended at the end.

---

## Constructor

```javascript
const dd = new DrillDowner(container, dataArr, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `container` | `string \| Element` | CSS selector or DOM node. The `<table>` is rendered inside it. |
| `dataArr` | `Array` | Flat array of plain objects sharing the same keys. |
| `options` | `Object` | Configuration — all keys are optional. |

Rendering happens immediately. Store the returned instance to call methods later.

```javascript
// Always store the instance
const dd = new DrillDowner('#table', data, { groupOrder: ["region", "rep"] });
```

---

## Options

### `groupOrder` · `string[]` · default `[]`

The hierarchy, listed outermost-first. Each entry must be a key present in your data objects.

```javascript
groupOrder: ["region", "store", "product"]
// Renders: Region → Store → Product
// Totals roll up: product → store → region → grand total
```

When empty and `ledger` is also defined, the widget starts in ledger mode.

---

### `totals` · `string[]` · default `[]`

Keys whose values are numbers. Summed at every group level and in the grand total. Non-numeric values are treated as 0.

```javascript
totals: ["qty", "revenue", "cost"]
```

---

### `columns` · `string[]` · default `[]`

Keys shown as plain display cells — no summing. In grouped mode, group rows show an empty cell for these unless `togglesUp: true` is set in `colProperties`.

```javascript
columns: ["status", "notes", "sku"]
```

---

### `colProperties` · `Object` · default `{}`

Per-column display and behaviour configuration. Every sub-key is optional.

```javascript
colProperties: {
  revenue: {
    label:      "Revenue (USD)",  // Header text. Default: capitalised key name.
    icon:       "💰",             // Shown in breadcrumb nav at this grouping level.
    decimals:   2,                // Decimal places. Default: 2.
    class:      "text-right",     // CSS class on every data <td> for this column.
    labelClass: "col-header",     // CSS class on the <th> header cell.
    formatter:  (value, item) => `$${DrillDowner.formatNumber(value, 2)}`,
    renderer:   null,
    togglesUp:  false,
    subTotalBy: null,
    balanceBehavior: null,
  }
}
```

#### `formatter(value, item) → string`

Lightweight formatting hook.

- For a **`totals`** column in **grouped** mode: `value` is the **summed total for the group**, not the individual row value.
- For a **`columns`** column: `value` is the raw field value, or the comma-joined distinct values when `togglesUp: true`.
- `item` is `gData[0]` — the first data object in the group (useful to reference a sibling field).
- Returns an HTML string.
- Ignored when `renderer` is also set.

```javascript
revenue: { formatter: (value, item) => `$${DrillDowner.formatNumber(value, 2)}` }
status:  { formatter: (value, item) => `<span class="${item.statusCode}">${value}</span>` }
```

#### `renderer(item, level, dimension, groupOrder, options) → string`

Full cell override. Called for group rows, leaf rows, and ledger rows. Bypasses `formatter` and `togglesUp`.

- `item` is `gData[0]` for group rows, the individual data object for leaf/ledger rows.
- Returns an HTML string.
- **Priority:** `renderer` wins over `formatter` when both are set.

```javascript
product: {
  renderer: (item, level, dimension, groupOrder, options) => {
    if (level === groupOrder.length - 1)          // leaf row
      return `<a href="/products/${item.sku}">${item.productName}</a>`;
    return `<b>${item[dimension]}</b>`;            // group row
  }
}
```

#### `togglesUp` · `boolean` · default `false`

Only applies to `columns` entries in grouped mode. When `true`, group rows show the distinct values from all their children joined by `", "`. Silently ignored on `totals` columns and when `renderer` is set.

```javascript
status: {
  togglesUp: true,
  formatter: (value, item) =>
    value.split(', ').map(s => `<span class="badge">${s}</span>`).join(' ')
}
```

#### `subTotalBy` · `string|null` · default `null`

Only applies to `totals` columns. Groups the sum by the values of another field instead of showing one number.

```javascript
qty: { subTotalBy: "unit" }
// Group row shows: "500 m, 1,000 pcs"  (instead of a meaningless "1,500")
// grandTotals.qty becomes: { "m": 500, "pcs": 1000 }
```

#### `balanceBehavior` · `Object|null` · default `null`

Only applies to `totals` columns. Turns the column into a **running balance** computed from other fields. Most useful in ledger mode.

```javascript
balance: {
  label:    "Running Balance",
  decimals: 2,
  formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}`,
  balanceBehavior: {
    initialBalance: 1000.00,   // Optional starting value. Adds an "Initial Balance" row.
    add:      ["deposit"],     // Fields added to the running total.
    subtract: ["withdrawal"]   // Fields subtracted from the running total.
  }
}
```

**Two-pass computation:**
1. Sort chronologically (ascending, ignoring `-` sort prefix). Accumulate balance row-by-row.
2. Re-sort for display order (respecting `-` prefix for descending). Render with pre-computed balances.

The balance column does **not** read `item[colKey]` from the data. DrillDowner computes it entirely from the `add`/`subtract` fields.

> **Required:** The balance column must be in `totals`, not `columns`.

---

### `ledger` · `LedgerEntry[]` · default `[]`

Defines flat table views. Each entry adds one option to the grouping dropdown. A single object is auto-wrapped in an array.

```javascript
ledger: [
  {
    label: "All Transactions",                       // Dropdown label
    cols:  ["date", "description", "amount"],        // Column order for this view
    sort:  ["date"]                                  // Sort keys; prefix "-" for descending
  },
  {
    label: "Newest First",
    cols:  ["date", "description", "amount"],
    sort:  ["-date"]
  }
]
```

- `cols` controls column order. Any `totals` not in `cols` are appended at the end.
- Top-level `columns` is ignored in ledger mode.
- Set `groupOrder: []` to start in ledger mode (first ledger entry shown on load).

---

### `groupOrderCombinations` · `Array[]|null` · default `null`

Fixed list of grouping combinations for the dropdown instead of auto-generated permutations (capped at 9).

```javascript
groupOrderCombinations: [
  ["region", "store"],
  ["store", "region"],
  ["region", "product"]
]
```

When `null`, DrillDowner auto-generates permutations of `groupOrder`.

---

### `controlsSelector` · `string|Element|null` · default `null`

Container element for the breadcrumb navigation and grouping dropdown. Without this, no controls render.

```javascript
controlsSelector: "#table-controls"
```

The dropdown is built **once** and not re-created on subsequent `render()` calls — the user's selection is preserved across data refreshes.

---

### `azBarSelector` · `string|Element|null` · default `null`

Container for the A–Z quick-jump bar. Active letters (present in the first character of the top-level group) render as clickable anchors; the rest are dimmed.

Only rendered when `groupOrder` is non-empty. Cleared automatically when switching to ledger mode.

```javascript
azBarSelector:    "#az-nav"
azBarOrientation: "horizontal"   // "vertical" (default) | "horizontal" | "h" | "row"
```

`"horizontal"` (and aliases `"h"`, `"row"`) adds the CSS class `drillDowner_az_bar_horizontal`.

---

### `showGrandTotals` · `boolean` · default `true`

Shows or hides the grand total sub-values in `<thead>` and the `<tfoot>` row.

---

### `onLabelClick` · `Function|null` · default `null`

Callback fired when a user clicks the text label of a group or leaf row (not the drill icon).

```javascript
onLabelClick: (ctx) => {
  ctx.label           // string  — visible text of the clicked row
  ctx.level           // number  — 0 = outermost group
  ctx.column          // string  — groupOrder key at this level
  ctx.isLeaf          // boolean — true when level > groupOrder.length - 1
  ctx.hierarchyValues // Array   — ["West", "Alice"] root-to-node path
  ctx.hierarchyMap    // Object  — { region: "West", rep: "Alice" }
  ctx.groupOrder      // Array   — snapshot of current groupOrder
  ctx.rowElement      // Element — the <tr> DOM node
  ctx.options         // Object  — the full options object
}
```

---

### `leafRenderer` · `Function|null` · default `null`

Top-level override for leaf-row label cells. Takes priority over `colProperties[dimension].renderer` at the leaf level. Does **not** apply to non-leaf group rows.

```javascript
// Signature
leafRenderer: (item, level, dimension, groupOrder, options) => htmlString

// Example
leafRenderer: (item) => `<a href="/detail/${item.id}">${item.name}</a>`
```

---

### `remoteUrl` · `string|null` · default `null`

Enables server-side drill-down. When set, drill interactions POST JSON to this URL instead of expanding local data.

**Request sent by DrillDowner:**
```json
{
  "action": "expand | expandToLevel | change_grouping",
  "data": {
    "level": 1,
    "expandingLevel": 2,
    "groupingDimension": "store",
    "displayNames": ["West", "Oakland"],
    "rowId": "drillDowner_abc_row_7",
    "groupOrder": ["region", "store", "product"],
    "requestedTotals": ["revenue"],
    "requestedColumns": ["status"]
  }
}
```

**Response expected from server:**
```json
{
  "success": true,
  "data": {
    "action": "expand",
    "rows": [],
    "level": 1,
    "rowId": "drillDowner_abc_row_7",
    "grandTotals": { "revenue": 125000 }
  }
}
```

On failure: `{ "success": false, "error_message": "..." }` — DrillDowner calls `alert()`.

| `action` sent | When |
|---------------|------|
| `"change_grouping"` | Dropdown changes or initial render |
| `"expandToLevel"` | `showToLevel()`, breadcrumb click |
| `"expand"` | User clicks a drill icon |

---

### `idPrefix` · `string` · default auto-generated

Prefix for all DOM element IDs. Auto-generated as `"drillDowner" + randomString + "_"`. Override only when you need predictable IDs or are running two instances on the same page.

---

### `onGroupOrderChange` · `Function|null` · default `null`

Defined in the constructor defaults but **never called** by the current code. Do not use.

---

## Public Methods

All methods except `render()` and `destroy()` return `this` and are chainable.

### `showToLevel(level)` → `this`

Show rows to the given depth; collapse everything deeper.

- `0` → only outermost group rows
- `groupOrder.length` → everything visible (same as `expandAll()`)
- Values out of range are clamped. `NaN` and negatives clamp to `0`.
- No effect when `groupOrder` is empty.

```javascript
dd.showToLevel(1);
```

### `collapseAll()` → `this`

Shorthand for `showToLevel(0)`.

### `expandAll()` → `this`

Shorthand for `showToLevel(groupOrder.length)`.

### `changeGroupOrder(newOrder)` → `this`

Changes the active grouping and re-renders.

- With `controlsSelector`: updates the dropdown selection (adds a new option if the combination is not already listed) and fires the `change` event.
- Without `controlsSelector`: sets `options.groupOrder` directly and calls `render()`.

```javascript
dd.changeGroupOrder(["store", "region"]);
```

### `render()` → `void`

Full re-render. Recalculates `grandTotals`, rebuilds the table, resets to collapsed state. The dropdown and its current selection are preserved.

```javascript
dd.dataArr.push(newRow);
dd.render();
```

### `getTable()` → `Element`

Returns the `<table>` DOM element.

### `destroy()` → `void`

Empties all containers and removes event listeners. Call before re-initialising DrillDowner on the same container.

```javascript
dd.destroy();
const dd2 = new DrillDowner('#table', newData, newOptions);
```

---

## Public Properties

| Property | Type | Notes |
|----------|------|-------|
| `dataArr` | `Array` | Live data array. Mutate then call `render()`. |
| `grandTotals` | `Object` | `{ col: number }` for plain totals; `{ col: { unit: number } }` for `subTotalBy`; ends-balance for `balanceBehavior`. Updated every `render()`. |
| `options` | `Object` | Merged options. Writable — modify then call `render()`. |
| `container` | `Element` | Main container DOM element. |
| `table` | `Element` | The `<table>` element. Available after construction. |
| `controls` | `Element\|null` | Controls container, or `null`. |
| `azBar` | `Element\|null` | A-Z bar container, or `null`. |

---

## Static Utilities

### `DrillDowner.formatNumber(n, decimals)` → `string`

Comma-separated thousands formatting.

```javascript
DrillDowner.formatNumber(1234567.8, 2)  // → "1,234,567.80"
DrillDowner.formatNumber(1000, 0)        // → "1,000"
DrillDowner.formatNumber(null, 2)        // → ""
```

### `DrillDowner.formatDate(value, includeTime)` → `string`

Formats a date as `DD/MMM/YY`, optionally appending `HH:mm`.

- `value`: `Date` object, or string matching `YYYY-MM-DD` or `YYYYMMDD`, optionally with `T HH:MM`.
- `includeTime`: `boolean`, default `false`. Time is appended only when the input actually contains time components.
- Returns the original string unchanged if parsing fails.

```javascript
DrillDowner.formatDate("2024-03-15")                  // → "15/Mar/24"
DrillDowner.formatDate("2024-03-15T09:30:00", true)   // → "15/Mar/24 09:30"
DrillDowner.formatDate(new Date())                    // → "14/Mar/26"

// Use as a formatter:
colProperties: {
  orderDate: { formatter: DrillDowner.formatDate },
  updatedAt: { formatter: (v) => DrillDowner.formatDate(v, true) }
}
```

### `DrillDowner.version` → `"1.2.2"`

---

## CSS Classes Reference

### Table Structure

| Class | Applied to | Purpose |
|-------|-----------|---------|
| `.drillDowner_table` | `<table>` | Main table element |
| `.drillDowner_even` | `<tr>` | Alternating row striping |
| `.drillDowner_first_group` | `<tr>` | First row within each group |
| `.drillDowner_num` | `<td>` | Numeric / total cells |
| `.drillDowner_right` | any | Right-aligned text |
| `.drillDowner_center` | any | Centred text |

### Drill Icons

| Class | Purpose |
|-------|---------|
| `.drillDowner_drill_icon` | Expand / collapse clickable icon |
| `.drillDowner_drill_expanded` | Icon state: expanded (▼) |
| `.drillDowner_drill_collapsed` | Icon state: collapsed (▶) |
| `.drillDowner_child_count` | Item-count badge next to the icon |

### Indentation

| Class | Depth |
|-------|-------|
| `.drillDowner_indent_0` | Level 0 (outermost) |
| `.drillDowner_indent_1` | Level 1 |
| `.drillDowner_indent_2` | Level 2 |
| `.drillDowner_indent_3` | Level 3 |
| `.drillDowner_indent_4` | Level 4 |
| `.drillDowner_indent_5` | Level 5 |

### Grand Totals

| Class | Purpose |
|-------|---------|
| `.drillDownerThTotal` | `<th>` cells in the header that show column totals |
| `.drillDownerTfootTotal` | `<td>` cells in the footer grand total row |

### Controls

| Class | Purpose |
|-------|---------|
| `.drillDowner_controls_container` | Outer wrapper for breadcrumbs + dropdown |
| `.drillDowner_breadcrumb_nav` | Breadcrumb container |
| `.drillDowner_breadcrumb_item` | Individual breadcrumb `<button>` |
| `.drillDowner_breadcrumb_arrow` | Arrow `<button>` between breadcrumb items |
| `.drillDowner_grouping_controls` | Dropdown wrapper |
| `.drillDowner_modern_select` | The `<select>` element |
| `.drillDowner_control_label` | The "Group by:" label |
| `.drillDowner_initial_row` | The "Initial Balance" row from `balanceBehavior` |

### A-Z Bar

| Class | Purpose |
|-------|---------|
| `.drillDowner_az_bar` | A-Z bar container (always present) |
| `.drillDowner_az_bar_horizontal` | Added when `azBarOrientation` is horizontal |
| `.drillDowner_az_link` | `<a>` for letters present in data |
| `.drillDowner_az_dimmed` | `<span>` for letters not present in data |

---

## Common Mistakes

**`balanceBehavior` column in `columns` instead of `totals`**
The balance is only computed for columns in `totals`. In `columns` it just shows the raw data value (typically 0 or absent).

**`formatter` receiving raw row value for a grouped total**
`formatter(value, item)` for a `totals` column in grouped mode receives the **group sum**, not the individual row value.

**`togglesUp` on a `totals` column**
`togglesUp` only works on `columns` entries. On a `totals` column it is silently ignored.

**Not storing the instance**
```javascript
// Wrong — can't call methods later
new DrillDowner('#table', data, options);

// Correct
const dd = new DrillDowner('#table', data, options);
```

**Re-initialising without `destroy()`**
Old event listeners remain attached. Always call `dd.destroy()` before creating a new instance on the same container.

**Using `onGroupOrderChange`**
This option is declared in the constructor defaults but is never invoked by the library. Do not rely on it.

---

## Examples

### 1 — Basic drill-down

```html
<div id="controls"></div>
<div id="table"></div>
<script>
const inventory = [
  { category: "Electronics", brand: "Apple",   product: "iPhone 15",  qty: 12, price: 999 },
  { category: "Electronics", brand: "Samsung", product: "Galaxy S24", qty: 20, price: 849 },
  { category: "Clothing",    brand: "Nike",    product: "Air Max 90", qty: 50, price: 120 },
];

const dd = new DrillDowner('#table', inventory, {
  groupOrder: ["category", "brand", "product"],
  totals:     ["qty", "price"],
  colProperties: {
    category: { label: "Category", icon: "📁" },
    brand:    { label: "Brand" },
    product:  { label: "Product" },
    qty:      { label: "In Stock", decimals: 0 },
    price:    { label: "Unit Price", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` }
  },
  controlsSelector: "#controls"
});
</script>
```

### 2 — Curated groupings + ledger + A-Z bar

```html
<div id="controls"></div>
<div id="az"></div>
<div id="table"></div>
<script>
const dd = new DrillDowner('#table', salesData, {
  groupOrder: ["region", "rep", "customer"],
  groupOrderCombinations: [
    ["region", "rep"],
    ["rep", "customer"],
    ["region", "customer"]
  ],
  totals:  ["revenue", "units"],
  columns: ["status"],
  colProperties: {
    status: {
      togglesUp: true,
      formatter: (v) => v.split(', ')
        .map(s => ({ active: '<span style="color:green">● Active</span>',
                     pending: '<span style="color:orange">● Pending</span>' }[s] || s))
        .join(' ')
    },
    revenue: { formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` }
  },
  ledger: [
    { label: "Transaction Log", cols: ["date", "customer", "rep", "revenue"], sort: ["-date"] }
  ],
  controlsSelector: "#controls",
  azBarSelector:    "#az",
  azBarOrientation: "horizontal"
});
</script>
```

### 3 — Bank statement (running balance)

```html
<div id="controls"></div>
<div id="table"></div>
<script>
const transactions = [
  { date: "2024-01-05", description: "Salary",    deposit: 3000, withdrawal: 0 },
  { date: "2024-01-08", description: "Rent",      deposit: 0,    withdrawal: 1200 },
  { date: "2024-02-05", description: "Salary",    deposit: 3000, withdrawal: 0 },
];

const dd = new DrillDowner('#table', transactions, {
  groupOrder: [],
  ledger: [
    { label: "Chronological", cols: ["date", "description", "deposit", "withdrawal", "balance"], sort: ["date"] },
    { label: "Newest First",  cols: ["date", "description", "deposit", "withdrawal", "balance"], sort: ["-date"] }
  ],
  totals: ["deposit", "withdrawal", "balance"],
  colProperties: {
    date:        { formatter: DrillDowner.formatDate },
    deposit:     { decimals: 2, formatter: (v) => v ? `$${DrillDowner.formatNumber(v, 2)}` : "" },
    withdrawal:  { decimals: 2, formatter: (v) => v ? `$${DrillDowner.formatNumber(v, 2)}` : "" },
    balance: {
      label: "Balance", decimals: 2,
      formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}`,
      balanceBehavior: { initialBalance: 1000, add: ["deposit"], subtract: ["withdrawal"] }
    }
  },
  controlsSelector: "#controls"
});
</script>
```

### 4 — Mixed units (`subTotalBy`)

```javascript
const stock = [
  { warehouse: "Main", product: "Cable", qty: 500, unit: "m"   },
  { warehouse: "Main", product: "Bolts", qty: 1000, unit: "pcs" },
  { warehouse: "East", product: "Cable", qty: 250, unit: "m"   },
];

const dd = new DrillDowner('#table', stock, {
  groupOrder: ["warehouse", "product"],
  totals:     ["qty"],
  colProperties: {
    qty: { label: "Quantity", decimals: 0, subTotalBy: "unit" }
    // "Main" row shows: "500 m, 1,000 pcs"
  }
});
```

### 5 — `onLabelClick` callback

```javascript
const dd = new DrillDowner('#table', data, {
  groupOrder: ["department", "employee"],
  totals: ["hours"],
  onLabelClick: (ctx) => {
    if (ctx.isLeaf) {
      showSidebar(ctx.hierarchyMap);
    }
  }
});
```

### 6 — Dynamic updates and chaining

```javascript
// Add data and refresh
dd.dataArr.push(newRow);
dd.render();

// Replace all data
dd.dataArr = await fetch('/api/sales').then(r => r.json());
dd.render();

// Programmatic navigation
dd.expandAll();
dd.showToLevel(1);
dd.collapseAll();

// Method chaining
dd.changeGroupOrder(["region", "product"]).showToLevel(1);

// Read computed totals
console.log(dd.grandTotals.revenue);           // number
console.log(dd.grandTotals.qty);               // { "m": 750, "pcs": 1000 } with subTotalBy

// Clean up
dd.destroy();
```
