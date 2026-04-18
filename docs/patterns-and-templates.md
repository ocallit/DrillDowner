# DrillDowner — Patterns & Templates for AI Agents

**Target audience: AI coding assistants (Claude Code, Claude, etc.)**
**Version: 1.2.7**

This document provides copy-paste-ready patterns for the most common DrillDowner integration scenarios. Every snippet is complete and working. Read the pattern that matches the user's situation, adapt the column names, and ship it.

---

## Before You Write Any Code — The Decision Checklist

Answer these four questions from the user's data:

1. **What are the natural grouping columns?** (categories, regions, departments, dates) → `groupOrder`
2. **Which columns hold numbers to sum?** (revenue, qty, hours, amount) → `totals`
3. **Which columns are labels/text to display?** (status, notes, description) → `columns`
4. **Does a flat row-by-row view make sense?** (ledger, log, statement) → `ledger`

Then pick the matching pattern below.

---

## Core Rules (Never Break These)

```
NEVER pre-aggregate data before passing to DrillDowner.
NEVER build DOM manually (createElement, innerHTML for tables, etc.).
NEVER pre-compute running balances or net values.
ALWAYS pass the flat raw array directly.
ALWAYS store the instance: const dd = new DrillDowner(...)
ALWAYS call dd.destroy() before re-initializing on the same container.
```

---

## Pattern 1 — Vanilla JS: Minimal Grouped Table

**Use when:** You have a hierarchy and just need it to render. No controls, no extras.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="dist/drilldowner.min.css">
  <script src="dist/DrillDowner.min.js"></script>
</head>
<body>
  <div id="table"></div>

  <script>
    const data = [
      { region: "North", rep: "Alice", product: "Widget A", revenue: 5000, units: 10 },
      { region: "North", rep: "Alice", product: "Widget B", revenue: 3000, units:  6 },
      { region: "North", rep: "Bob",   product: "Widget A", revenue: 4500, units:  9 },
      { region: "South", rep: "Carol", product: "Widget B", revenue: 7200, units: 14 },
    ];

    const dd = new DrillDowner('#table', data, {
      groupOrder: ["region", "rep", "product"],
      totals:     ["revenue", "units"],
      colProperties: {
        region:  { label: "Region" },
        rep:     { label: "Sales Rep" },
        product: { label: "Product" },
        revenue: { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
        units:   { label: "Units",   decimals: 0 },
      }
    });
  </script>
</body>
</html>
```

---

## Pattern 2 — Vanilla JS: Standard Setup (Controls + A-Z Bar)

**Use when:** You want the grouping dropdown, breadcrumb navigation, and alphabet jump bar.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="dist/drilldowner.min.css">
  <script src="dist/DrillDowner.min.js"></script>
</head>
<body>
  <!-- Controls: breadcrumb + grouping dropdown -->
  <div id="controls"></div>

  <!-- A-Z bar + table side by side -->
  <div style="display:flex; gap:16px;">
    <div id="az-bar"></div>
    <div id="table" style="flex:1;"></div>
  </div>

  <script>
    const data = [
      { region: "North", rep: "Alice", product: "Widget A", revenue: 5000, units: 10, status: "Active" },
      { region: "North", rep: "Alice", product: "Widget B", revenue: 3000, units:  6, status: "Pending" },
      { region: "North", rep: "Bob",   product: "Widget A", revenue: 4500, units:  9, status: "Active" },
      { region: "South", rep: "Carol", product: "Widget B", revenue: 7200, units: 14, status: "Active" },
    ];

    const dd = new DrillDowner('#table', data, {
      groupOrder: ["region", "rep", "product"],
      totals:     ["revenue", "units"],
      columns:    ["status"],

      colProperties: {
        region:  { label: "Region",    icon: "🌎" },
        rep:     { label: "Sales Rep", icon: "👤" },
        product: { label: "Product" },
        revenue: { label: "Revenue",   formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
        units:   { label: "Units",     decimals: 0 },
        status:  { label: "Status",    togglesUp: true },  // group rows show "Active, Pending"
      },

      controlsSelector: "#controls",
      azBarSelector:    "#az-bar",
      azBarOrientation: "vertical",   // "horizontal" also works
    });
  </script>
</body>
</html>
```

---

## Pattern 3 — Vanilla JS: Data Array Changed (Refresh Without Re-init)

**Use when:** The data updates (API poll, user action adds a row, filter changes result set) but the widget stays on the page and you want to keep the current grouping selection.

```javascript
// --- Initial setup ---
const dd = new DrillDowner('#table', initialData, {
  groupOrder: ["region", "rep"],
  totals:     ["revenue"],
  controlsSelector: "#controls",
});

// --- Case A: Add one row ---
dd.dataArr.push({ region: "East", rep: "Dan", revenue: 2800 });
dd.render();  // recalculates totals, rebuilds table, preserves dropdown selection

// --- Case B: Replace the whole dataset (e.g. after fetch) ---
async function refreshData() {
  const fresh = await fetch('/api/sales').then(r => r.json());
  dd.dataArr = fresh;
  dd.render();
}

// --- Case C: Modify options AND data together ---
dd.options.showGrandTotals = false;
dd.dataArr = filteredData;
dd.render();

// --- Case D: Change grouping programmatically ---
dd.changeGroupOrder(["rep", "region"]);          // updates dropdown + re-renders
dd.changeGroupOrder(["rep", "region"]).showToLevel(1);  // chain: change + collapse to level 1
```

**Key rule:** `render()` preserves the dropdown selection. The controls dropdown is **not** rebuilt on `render()` — only the table is.

---

## Pattern 4 — Vanilla JS: Re-initialize With Different Options

**Use when:** You need to fundamentally change the configuration — different columns, different groupOrder structure, or a completely different dataset. `render()` is not enough; you need a new instance.

```javascript
let dd = null;

function initDrillDowner(data, options) {
  // Always destroy the previous instance before re-initializing on the same container.
  if (dd) {
    dd.destroy();
    dd = null;
  }
  dd = new DrillDowner('#table', data, options);
}

// --- First init ---
initDrillDowner(salesData, {
  groupOrder: ["region", "rep"],
  totals:     ["revenue"],
  controlsSelector: "#controls",
});

// --- Later: completely different config ---
initDrillDowner(inventoryData, {
  groupOrder: ["warehouse", "category", "product"],
  totals:     ["qty", "value"],
  columns:    ["sku"],
  controlsSelector: "#controls",  // same container — destroy() cleaned it up
});
```

**When to use `destroy()` + `new` vs just `render()`:**

| Situation | Use |
|-----------|-----|
| Same columns, new data | `dd.dataArr = newData; dd.render()` |
| Same columns, changed options (format, label, etc.) | `dd.options.X = y; dd.render()` |
| Different `groupOrder` | `dd.changeGroupOrder(newOrder)` |
| Completely different columns or `totals`/`columns` arrays | `dd.destroy(); dd = new DrillDowner(...)` |

---

## Pattern 5 — Vanilla JS: Ledger-Only (No Hierarchy)

**Use when:** The data has no meaningful hierarchy — it's a log, statement, or list.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="dist/drilldowner.min.css">
  <script src="dist/DrillDowner.min.js"></script>
</head>
<body>
  <div id="controls"></div>
  <div id="table"></div>

  <script>
    const transactions = [
      { date: "2024-03-01", description: "Salary",       deposit: 4500, withdrawal:    0 },
      { date: "2024-03-05", description: "Rent",         deposit:    0, withdrawal: 1800 },
      { date: "2024-03-12", description: "Groceries",    deposit:    0, withdrawal:  220 },
      { date: "2024-03-18", description: "Freelance",    deposit: 1200, withdrawal:    0 },
      { date: "2024-03-25", description: "Utilities",    deposit:    0, withdrawal:  145 },
    ];

    const dd = new DrillDowner('#table', transactions, {
      groupOrder: [],   // empty → starts in ledger mode

      totals: ["deposit", "withdrawal", "balance"],

      ledger: [
        {
          label: "Chronological",
          cols:  ["date", "description", "deposit", "withdrawal", "balance"],
          sort:  ["date"]    // ascending: oldest first
        },
        {
          label: "Newest First",
          cols:  ["date", "description", "deposit", "withdrawal", "balance"],
          sort:  ["-date"]   // descending: newest first
        },
        {
          // calcSort/viewSort: accumulate balance oldest→newest, display newest→oldest
          label:    "Latest First (correct running balance)",
          cols:     ["date", "description", "deposit", "withdrawal", "balance"],
          calcSort: ["date"],   // accumulation order
          viewSort: ["-date"],  // display order
        },
      ],

      colProperties: {
        date:        { label: "Date",       formatter: DrillDowner.formatDate },
        description: { label: "Description" },
        deposit:     { label: "Deposit",    decimals: 2,
                       formatter: (v) => v ? `$${DrillDowner.formatNumber(v, 2)}` : "" },
        withdrawal:  { label: "Withdrawal", decimals: 2,
                       formatter: (v) => v ? `$${DrillDowner.formatNumber(v, 2)}` : "" },
        balance: {
          label: "Balance",
          decimals: 2,
          formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}`,
          balanceBehavior: {
            initialBalance: 1000,     // starting balance; inserts an "Initial Balance" row
            add:      ["deposit"],
            subtract: ["withdrawal"],
          },
        },
      },

      controlsSelector: "#controls",
    });
  </script>
</body>
</html>
```

---

## Pattern 6 — Vanilla JS: Grouped + Ledger Views in One Widget

**Use when:** You want both a hierarchy view AND a flat list, selectable from the same dropdown.

```javascript
const dd = new DrillDowner('#table', salesData, {
  groupOrder: ["region", "rep", "customer"],

  // Curated grouping combinations — omit for auto-generated permutations
  groupOrderCombinations: [
    ["region", "rep", "customer"],
    ["rep", "customer"],
    ["region", "customer"],
  ],

  totals:  ["revenue", "units"],
  columns: ["status"],

  // Ledger views appear at the bottom of the dropdown
  ledger: [
    { label: "All Transactions", cols: ["date", "customer", "rep", "revenue"], sort: ["-date"] },
    { label: "By Revenue",       cols: ["customer", "rep", "revenue", "units"], sort: ["-revenue"] },
  ],

  colProperties: {
    region:   { label: "Region",    icon: "🌎" },
    rep:      { label: "Sales Rep" },
    customer: { label: "Customer" },
    status:   { label: "Status", togglesUp: true },
    revenue:  { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
    units:    { label: "Units",   decimals: 0 },
    date:     { label: "Date",    formatter: DrillDowner.formatDate },
  },

  controlsSelector: "#controls",
  azBarSelector:    "#az-bar",
});
```

---

## Pattern 7 — Vue 3 (Composition API): Basic Integration

**Use when:** Building a Vue 3 app and want to drop DrillDowner into a component.

DrillDowner is not a Vue component — it's a vanilla JS class. Mount it with `onMounted`, target the container ref, and call `destroy()` in `onUnmounted`.

```vue
<!-- DrillDownerWidget.vue -->
<template>
  <div>
    <div ref="controlsEl"></div>
    <div ref="tableEl"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  data: { type: Array, required: true },
})

const tableEl    = ref(null)
const controlsEl = ref(null)
let dd = null

onMounted(() => {
  dd = new DrillDowner(tableEl.value, props.data, {
    groupOrder: ["region", "rep", "product"],
    totals:     ["revenue", "units"],
    columns:    ["status"],
    colProperties: {
      region:  { label: "Region",    icon: "🌎" },
      rep:     { label: "Sales Rep" },
      product: { label: "Product" },
      status:  { label: "Status", togglesUp: true },
      revenue: { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
      units:   { label: "Units",   decimals: 0 },
    },
    controlsSelector: controlsEl.value,
  })
})

onUnmounted(() => {
  dd?.destroy()
})
</script>
```

**Usage:**
```vue
<DrillDownerWidget :data="salesRows" />
```

Make sure `DrillDowner.min.js` and `drilldowner.min.css` are loaded globally (e.g. in `index.html` or `main.js`).

---

## Pattern 8 — Vue 3: Data Array Changed (Reactive Refresh)

**Use when:** The `data` prop or a reactive data source changes and the table needs to update.

```vue
<!-- DrillDownerWidget.vue -->
<template>
  <div>
    <div ref="controlsEl"></div>
    <div ref="tableEl"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  data: { type: Array, required: true },
})

const tableEl    = ref(null)
const controlsEl = ref(null)
let dd = null

const OPTIONS = {
  groupOrder: ["region", "rep", "product"],
  totals:     ["revenue", "units"],
  colProperties: {
    revenue: { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
    units:   { label: "Units",   decimals: 0 },
  },
  // controlsSelector assigned after mount (see onMounted)
}

onMounted(() => {
  dd = new DrillDowner(tableEl.value, props.data, {
    ...OPTIONS,
    controlsSelector: controlsEl.value,
  })
})

// Watch the prop — replace the live array and re-render.
// This keeps the dropdown selection intact.
watch(
  () => props.data,
  (newData) => {
    if (!dd) return
    dd.dataArr = newData
    dd.render()
  }
)

onUnmounted(() => {
  dd?.destroy()
})
</script>
```

---

## Pattern 9 — Vue 3: Re-initialize With Different Options

**Use when:** The column configuration itself changes (e.g. user switches between different report types that have different columns).

```vue
<!-- ConfigurableDrillDowner.vue -->
<template>
  <div>
    <div ref="controlsEl"></div>
    <div ref="tableEl"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  data:    { type: Array,  required: true },
  options: { type: Object, required: true },   // full DrillDowner options object
})

const tableEl    = ref(null)
const controlsEl = ref(null)
let dd = null

function init() {
  // destroy() clears the containers so new instance starts clean
  dd?.destroy()
  dd = new DrillDowner(tableEl.value, props.data, {
    ...props.options,
    controlsSelector: controlsEl.value,
  })
}

onMounted(init)

// Re-initialize when options change (different columns, groupOrder, etc.)
watch(() => props.options, init, { deep: true })

// Just refresh when only data changes
watch(() => props.data, (newData) => {
  if (!dd) return
  dd.dataArr = newData
  dd.render()
})

onUnmounted(() => {
  dd?.destroy()
})
</script>
```

**Usage — switch between two completely different report configs:**
```vue
<script setup>
const salesOptions = {
  groupOrder: ["region", "rep"],
  totals: ["revenue"],
}

const inventoryOptions = {
  groupOrder: ["warehouse", "product"],
  totals: ["qty"],
}

const activeOptions = ref(salesOptions)
const activeData    = ref(salesRows)
</script>

<template>
  <button @click="activeOptions = salesOptions; activeData = salesRows">Sales</button>
  <button @click="activeOptions = inventoryOptions; activeData = inventoryRows">Inventory</button>
  <ConfigurableDrillDowner :data="activeData" :options="activeOptions" />
</template>
```

---

## Pattern 10 — React: Basic Integration

**Use when:** Building a React app. DrillDowner is not a React component — it's a vanilla JS class. Use `useRef` for the container and `useEffect` for lifecycle.

```jsx
// DrillDownerWidget.jsx
import { useRef, useEffect } from 'react'

export function DrillDownerWidget({ data }) {
  const tableRef    = useRef(null)
  const controlsRef = useRef(null)
  const ddRef       = useRef(null)

  useEffect(() => {
    ddRef.current = new DrillDowner(tableRef.current, data, {
      groupOrder: ["region", "rep", "product"],
      totals:     ["revenue", "units"],
      columns:    ["status"],
      colProperties: {
        region:  { label: "Region",    icon: "🌎" },
        rep:     { label: "Sales Rep" },
        product: { label: "Product" },
        status:  { label: "Status", togglesUp: true },
        revenue: { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
        units:   { label: "Units",   decimals: 0 },
      },
      controlsSelector: controlsRef.current,
    })

    return () => {
      ddRef.current?.destroy()
    }
  }, [])   // empty deps: init once on mount, destroy on unmount

  return (
    <div>
      <div ref={controlsRef}></div>
      <div ref={tableRef}></div>
    </div>
  )
}
```

**Usage:**
```jsx
<DrillDownerWidget data={salesRows} />
```

Load `DrillDowner.min.js` and `drilldowner.min.css` in your `index.html` or import the CSS in your entry file.

---

## Pattern 11 — React: Data Array Changed (Refresh Without Re-init)

**Use when:** `data` prop changes and you want the table to update while keeping the current grouping dropdown selection.

```jsx
// DrillDownerWidget.jsx
import { useRef, useEffect } from 'react'

export function DrillDownerWidget({ data }) {
  const tableRef    = useRef(null)
  const controlsRef = useRef(null)
  const ddRef       = useRef(null)

  // Init once
  useEffect(() => {
    ddRef.current = new DrillDowner(tableRef.current, data, {
      groupOrder: ["region", "rep", "product"],
      totals:     ["revenue", "units"],
      colProperties: {
        revenue: { label: "Revenue", formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` },
        units:   { label: "Units",   decimals: 0 },
      },
      controlsSelector: controlsRef.current,
    })
    return () => ddRef.current?.destroy()
  }, [])

  // On data change: replace array + re-render (preserves dropdown selection)
  useEffect(() => {
    if (!ddRef.current) return
    ddRef.current.dataArr = data
    ddRef.current.render()
  }, [data])

  return (
    <div>
      <div ref={controlsRef}></div>
      <div ref={tableRef}></div>
    </div>
  )
}
```

---

## Pattern 12 — React: Re-initialize With Different Options

**Use when:** The configuration itself changes — not just the data, but the columns, groupOrder, or other structural options.

```jsx
// ConfigurableDrillDowner.jsx
import { useRef, useEffect } from 'react'

export function ConfigurableDrillDowner({ data, options }) {
  const tableRef    = useRef(null)
  const controlsRef = useRef(null)
  const ddRef       = useRef(null)

  // Re-initialize whenever options change
  useEffect(() => {
    ddRef.current?.destroy()

    ddRef.current = new DrillDowner(tableRef.current, data, {
      ...options,
      controlsSelector: controlsRef.current,
    })

    return () => ddRef.current?.destroy()
  }, [options])   // options identity change triggers full re-init

  // Data-only change: just refresh
  useEffect(() => {
    if (!ddRef.current) return
    ddRef.current.dataArr = data
    ddRef.current.render()
  }, [data])

  return (
    <div>
      <div ref={controlsRef}></div>
      <div ref={tableRef}></div>
    </div>
  )
}
```

**Usage — toggle between two configs:**
```jsx
function ReportsPage() {
  const [mode, setMode] = useState('sales')

  const salesOptions = useMemo(() => ({
    groupOrder: ["region", "rep"],
    totals: ["revenue"],
    colProperties: { revenue: { formatter: (v) => `$${DrillDowner.formatNumber(v, 2)}` } }
  }), [])

  const inventoryOptions = useMemo(() => ({
    groupOrder: ["warehouse", "product"],
    totals: ["qty"],
    colProperties: { qty: { decimals: 0 } }
  }), [])

  const activeOptions = mode === 'sales' ? salesOptions : inventoryOptions
  const activeData    = mode === 'sales' ? salesRows    : inventoryRows

  return (
    <>
      <button onClick={() => setMode('sales')}>Sales</button>
      <button onClick={() => setMode('inventory')}>Inventory</button>
      <ConfigurableDrillDowner data={activeData} options={activeOptions} />
    </>
  )
}
```

> **Important:** Use `useMemo` (or define options outside the component) so the options object reference only changes when you actually mean to re-initialize. A new object on every render would cause a re-init loop.

---

## Scenario Reference

### Running Balance / P&L (Net = Income − Expenses)

```javascript
// In totals: include the balance column
totals: ["income", "expense", "net"],

colProperties: {
  net: {
    label: "Net",
    decimals: 2,
    formatter: (v) => {
      const color = v >= 0 ? 'green' : 'red'
      return `<span style="color:${color}">${DrillDowner.formatNumber(v, 2)}</span>`
    },
    balanceBehavior: {
      initialBalance: 0,     // omit if no starting balance
      add:      ["income"],
      subtract: ["expense"],
    },
  },
},
```

### Mixed Units (subTotalBy)

```javascript
// Data: { product: "Cable", qty: 500, unit: "m" }
//       { product: "Bolts", qty: 1000, unit: "pcs" }
colProperties: {
  qty: {
    label: "Quantity",
    decimals: 0,
    subTotalBy: "unit",   // group rows show "500 m, 1,000 pcs" instead of "1,500"
  }
}
```

### Label Click → Open Detail Panel

```javascript
onLabelClick: (ctx) => {
  // ctx.level      — 0 = outermost group, groupOrder.length-1 = deepest group
  // ctx.isLeaf     — true for the deepest-level items
  // ctx.hierarchyMap — { region: "North", rep: "Alice" }
  // ctx.label      — the visible text of the clicked row
  // ctx.rowElement — the <tr> DOM node

  if (ctx.isLeaf) {
    openDetailPanel(ctx.hierarchyMap)
  }
},
```

### Custom Leaf Row Label

```javascript
// leafRenderer applies only to leaf (deepest) rows.
// For group rows, use colProperties[dim].renderer instead.
leafRenderer: (item, level, dimension, groupOrder, options) => {
  return `<a href="/detail/${item.id}">${item.name}</a> <small>(${item.sku})</small>`
},
```

### Programmatic Navigation (Chaining)

```javascript
dd.expandAll()
dd.collapseAll()
dd.showToLevel(1)                          // expand top 2 levels only
dd.changeGroupOrder(["rep", "region"])     // change hierarchy + re-render
dd.changeGroupOrder(["rep", "region"]).showToLevel(1)   // chain
```

### Read Computed Totals

```javascript
// After render():
console.log(dd.grandTotals.revenue)   // number (plain sum)
console.log(dd.grandTotals.qty)       // { "m": 750, "pcs": 1000 } when subTotalBy is set
```

---

## HTML Scaffold (Copy-Paste Start)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DrillDowner</title>
  <link rel="stylesheet" href="dist/drilldowner.min.css">
  <script src="dist/DrillDowner.min.js"></script>
</head>
<body style="margin: 0 auto; padding: 0 1em; max-width: 1200px;">

  <div id="controls"></div>

  <div style="display:flex; gap:16px;">
    <div id="az-bar"></div>
    <div id="table" style="flex:1; overflow-x:auto;"></div>
  </div>

  <script>
    // Replace with real data
    const data = [ /* ... flat array of objects ... */ ]

    const dd = new DrillDowner('#table', data, {
      groupOrder: [/* "col1", "col2", ... */],
      totals:     [/* "numericCol", ... */],
      columns:    [/* "textCol", ... */],   // optional
      ledger:     [/* { label, cols, sort } */],  // optional

      colProperties: {
        // colKey: { label, icon, decimals, formatter, togglesUp, ... }
      },

      controlsSelector: "#controls",
      azBarSelector:    "#az-bar",   // remove if not needed
    })
  </script>
</body>
</html>
```

---

## Common Mistakes Cheat Sheet

| Mistake | Fix |
|---------|-----|
| `new DrillDowner(...)` without storing instance | `const dd = new DrillDowner(...)` |
| Re-initializing without `destroy()` | `dd.destroy(); dd = new DrillDowner(...)` |
| Pre-summing data before passing | Pass flat raw array; DrillDowner sums it |
| `balanceBehavior` column in `columns` instead of `totals` | Move it to `totals` |
| `togglesUp` on a `totals` column | `togglesUp` only works on `columns` entries |
| Expecting `formatter(value)` to receive raw row value for grouped totals | `value` is the **summed total** for the group, not the individual row |
| Building DOM manually alongside DrillDowner | Don't — DrillDowner owns the table DOM |
| React: defining options inline (new object every render) | Use `useMemo` or define outside component |
| Vue: not calling `dd?.destroy()` in `onUnmounted` | Always clean up in `onUnmounted` |
