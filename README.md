# DrillDowner

**Version 1.2.2 · Zero dependencies · ES6 · Vanilla JS**

DrillDowner turns a flat array of objects into an interactive drill-down table with collapsible hierarchy, subtotals, flexible grouping, and optional flat "ledger" views — all with no dependencies and no build step required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Quick Start

### 1. Include the files

```html
<link rel="stylesheet" href="dist/drilldowner.min.css">
<script src="dist/DrillDowner.min.js"></script>
```

Or use the source files during development:

```html
<link rel="stylesheet" href="src/drilldowner.css">
<script src="src/DrillDowner.js"></script>
```

### 2. Add containers

```html
<div id="controls"></div>
<div id="table"></div>
```

### 3. Initialise

```javascript
const data = [
  { category: "Electronics", brand: "Apple",   product: "iPhone 15",  qty: 12, price: 999 },
  { category: "Electronics", brand: "Samsung", product: "Galaxy S24", qty: 20, price: 849 },
  { category: "Clothing",    brand: "Nike",    product: "Air Max 90", qty: 50, price: 120 },
];

const dd = new DrillDowner('#table', data, {
  groupOrder: ["category", "brand", "product"],
  totals:     ["qty", "price"],
  colProperties: {
    qty:   { label: "Stock", decimals: 0 },
    price: { label: "Price", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` }
  },
  controlsSelector: "#controls"
});
```

That's it. The table renders immediately with collapsible rows and grand totals.

---

## Core Concepts

### Three arrays control everything

| Array | What it does |
|-------|-------------|
| `groupOrder` | Columns that form the hierarchy, outermost first |
| `totals` | Numeric columns summed at every group level |
| `columns` | Non-numeric display columns |

### Two rendering modes

| Mode | How to activate | What you get |
|------|-----------------|-------------|
| **Grouped** | `groupOrder` is non-empty | Collapsible hierarchy with subtotals |
| **Ledger** | `groupOrder: []` + `ledger` defined | Flat sorted table, one row per item |

Both modes can live in the same widget — switch via the dropdown.

### Per-column configuration

`colProperties` customises any column independently:

```javascript
colProperties: {
  revenue: {
    label:     "Revenue (USD)",
    decimals:  2,
    formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}`
  },
  status: {
    togglesUp: true,   // group rows show distinct child values
    formatter: (v) => v === "active" ? "✅ Active" : "⏳ Pending"
  }
}
```

---

## Features

- **Drill-down hierarchy** — expand / collapse any group level
- **Subtotals** roll up automatically at every level
- **Ledger mode** — flat sorted views with custom column order
- **Mixed-unit subtotals** via `subTotalBy` (e.g. "500 m, 1,000 pcs")
- **Running balance** column via `balanceBehavior` (bank-statement style)
- **Grouping dropdown** — switch between hierarchy permutations and ledger views
- **Breadcrumb navigation** — click to collapse to any level
- **A–Z quick-jump bar** — vertical or horizontal alphabet navigation
- **Custom formatters and renderers** per column
- **`onLabelClick` callback** — open sidebars, navigate, show detail panels
- **Remote / server-side** expansion via `remoteUrl`
- **Method chaining** — `dd.changeGroupOrder([...]).showToLevel(1)`
- **Static helpers** — `DrillDowner.formatNumber()`, `DrillDowner.formatDate()`

---

## Common Patterns

### Ledger with running balance

```javascript
const dd = new DrillDowner('#table', transactions, {
  groupOrder: [],
  ledger: [
    { label: "Chronological", cols: ["date", "desc", "deposit", "withdrawal", "balance"], sort: ["date"] },
    { label: "Newest First",  cols: ["date", "desc", "deposit", "withdrawal", "balance"], sort: ["-date"] }
  ],
  totals: ["deposit", "withdrawal", "balance"],
  colProperties: {
    date:    { formatter: DrillDowner.formatDate },
    balance: {
      balanceBehavior: { initialBalance: 1000, add: ["deposit"], subtract: ["withdrawal"] },
      formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}`
    }
  },
  controlsSelector: "#controls"
});
```

### Curated grouping combinations

```javascript
const dd = new DrillDowner('#table', data, {
  groupOrder: ["region", "rep", "customer"],
  groupOrderCombinations: [
    ["region", "rep"],
    ["rep", "customer"]
  ],
  totals: ["revenue"],
  controlsSelector: "#controls"
});
```

### React to label clicks

```javascript
const dd = new DrillDowner('#table', data, {
  groupOrder: ["department", "employee"],
  totals: ["hours"],
  onLabelClick: (ctx) => {
    if (ctx.isLeaf) showSidebar(ctx.hierarchyMap);
  }
});
```

### Dynamic data updates

```javascript
dd.dataArr.push(newRow);
dd.render();

// Replace all data
dd.dataArr = await fetch('/api/data').then(r => r.json());
dd.render();

// Method chaining
dd.changeGroupOrder(["product", "region"]).showToLevel(1);
```

---

## API Summary

### Constructor

```javascript
const dd = new DrillDowner(container, dataArr, options)
```

`container` — CSS selector string or DOM element
`dataArr` — flat array of plain objects
`options` — all keys optional (see [full API docs](docs/drilldowner_docs.md))

### Key options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `groupOrder` | `string[]` | `[]` | Hierarchy columns, outermost first |
| `totals` | `string[]` | `[]` | Columns to sum |
| `columns` | `string[]` | `[]` | Display-only columns |
| `colProperties` | `Object` | `{}` | Per-column label, formatter, renderer, etc. |
| `ledger` | `Array` | `[]` | Flat-view definitions |
| `groupOrderCombinations` | `Array[]|null` | `null` | Fixed dropdown combinations |
| `controlsSelector` | `string|null` | `null` | Container for breadcrumbs + dropdown |
| `azBarSelector` | `string|null` | `null` | Container for A–Z bar |
| `azBarOrientation` | `string` | `"vertical"` | `"vertical"` or `"horizontal"` |
| `showGrandTotals` | `boolean` | `true` | Show/hide grand totals |
| `onLabelClick` | `Function|null` | `null` | Click callback on label cells |
| `leafRenderer` | `Function|null` | `null` | Override leaf-row label HTML |
| `remoteUrl` | `string|null` | `null` | Server-side expansion endpoint |

### Public methods

| Method | Returns | Description |
|--------|---------|-------------|
| `showToLevel(level)` | `this` | Expand to given depth; collapse deeper rows |
| `collapseAll()` | `this` | Collapse to top level |
| `expandAll()` | `this` | Expand all levels |
| `changeGroupOrder(newOrder)` | `this` | Change hierarchy and re-render |
| `render()` | `void` | Full re-render (recalculates totals) |
| `getTable()` | `Element` | Returns the `<table>` DOM node |
| `destroy()` | `void` | Remove event listeners, empty containers |

### Static utilities

| Method | Description |
|--------|-------------|
| `DrillDowner.formatNumber(n, decimals)` | `1234567.8, 2` → `"1,234,567.80"` |
| `DrillDowner.formatDate(value, includeTime)` | `"2024-03-15"` → `"15/Mar/24"` |
| `DrillDowner.version` | `"1.2.2"` |

### Public properties

| Property | Type | Notes |
|----------|------|-------|
| `dataArr` | `Array` | Live data — mutate then call `render()` |
| `grandTotals` | `Object` | Computed totals updated on every `render()` |
| `options` | `Object` | Merged options — writable |
| `container` | `Element` | Main container |
| `table` | `Element` | The `<table>` element |
| `controls` | `Element|null` | Controls container |
| `azBar` | `Element|null` | A-Z bar container |

---

## Documentation

- **[Full API Reference](docs/drilldowner_docs.md)** — all options, colProperties, methods, CSS classes, and examples
- **[Class Diagram](docs/class_diagram.md)** — Mermaid class diagram with options and callback signatures
- **[Examples](examples/)** — runnable HTML demos

---

## Browser Compatibility

ES6 required. Tested in:

- Chrome 49+
- Firefox 45+
- Safari 10+
- Edge 13+

Uses `Intl.Collator` (for natural sort with `es-MX` locale) and `Intl.NumberFormat` (`en-US`).

---

## Testing

Open `test/drilldowner_tests.html` in a browser, or serve locally:

```bash
npx http-server . -p 8080
# then open http://localhost:8080/test/drilldowner_tests.html
```

---

## License

MIT — see [LICENSE](LICENSE).

---

**Made with care by Pepe Santos**
