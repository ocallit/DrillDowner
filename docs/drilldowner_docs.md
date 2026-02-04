# DrillDowner JavaScript Widget Documentation

## Overview

DrillDowner is a dependency-free ES6 JavaScript class that creates interactive, hierarchical data tables with drill-down functionality. It allows users to explore nested data by expanding and collapsing groups, switch to flat "ledger" views, with support for totals, custom formatting, and navigation controls.

**Current Version:** 1.1.13

## Constructor

### `new DrillDowner(container, dataArr, options = {})`

Creates a new DrillDowner instance and immediately renders it.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `container` | string \| DOM | CSS selector or DOM element for the main table container |
| `dataArr` | Array | Array of data objects to display |
| `options` | Object | Configuration options (see Options section) |

**Example:**

```javascript
const drillDowner = new DrillDowner('#my-table', data, {
    groupOrder: ["category", "subcategory"],
    columns: ["name", "status"],
    totals: ["amount"],
    colProperties: { /* column configurations */ }
});
```

**Note:** The constructor automatically calls `render()` after initialization.

---

## Options

### Core Configuration

#### `groupOrder` (Array)

Defines the hierarchical grouping columns in order from top-level to bottom-level.

- **Type:** Array of strings
- **Default:** `[]`
- **Example:** `["product", "color", "warehouse"]` creates Product → Color → Warehouse hierarchy

When empty and `ledger` is defined, the widget starts in ledger mode.

#### `columns` (Array)

Specifies which data columns to display as regular table columns (non-totals).

- **Type:** Array of strings
- **Default:** `[]`
- **Example:** `["status", "priority", "notes"]`

#### `totals` (Array)

Specifies which numeric columns to sum up and display as totals.

- **Type:** Array of strings
- **Default:** `[]`
- **Example:** `["quantity", "price", "weight"]`

#### `colProperties` (Object)

Defines display properties, formatters, and behavior for each column.

- **Type:** Object with column configurations
- **Default:** `{}`
- **Structure:** `{ columnName: { property: value, ... } }`

See [Column Properties](#column-properties-colproperties) section for details.

### Ledger Configuration

#### `ledger` (Array)

Defines flat table view configurations. When provided, users can switch between hierarchical grouping and flat ledger views via a dropdown.

- **Type:** Array of objects (or single object, auto-wrapped)
- **Default:** `[]`

Each ledger object has:

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Display name in dropdown |
| `cols` | Array | Columns to show in this view |
| `sort` | Array | Columns to sort by |

**Example:**

```javascript
ledger: [
    {
        label: "Global Inventory (Detailed)",
        cols: ["category", "brand", "product", "info"],
        sort: ["category", "product"]
    },
    {
        label: "Brand Overview (Simple)",
        cols: ["brand", "product", "info"],
        sort: ["brand", "product"]
    }
]
```

**Behavior:**
- If `groupOrder` is empty but `ledger` has entries, the widget starts in ledger mode (first ledger selected)
- Users can switch between grouping combinations and ledger views via the dropdown
- In ledger mode, `columns` is replaced by the ledger's `cols`
- Switching back to grouped mode restores the original `columns`

### Grouping Options

#### `groupOrderCombinations` (Array|null)

Predefined grouping combinations for the dropdown selector. When provided, only these combinations appear in the dropdown (instead of auto-generated permutations).

- **Type:** Array of arrays or null
- **Default:** `null`
- **Example:** `[["product", "color"], ["color", "product"], ["warehouse", "product"]]`

### UI Components

#### `controlsSelector` (string|null)

Container for breadcrumb navigation and grouping controls dropdown.

- **Type:** CSS selector string or null
- **Default:** `null`
- **Example:** `"#table-controls"`

#### `azBarSelector` (string|null)

Container for A-Z navigation bar (alphabet quick-jump). Only renders when `groupOrder` has at least one level.

- **Type:** CSS selector string or null
- **Default:** `null`
- **Example:** `"#alphabet-nav"`

### Display Options

#### `showGrandTotals` (boolean)

Controls whether grand totals appear in table headers and footer.

- **Type:** Boolean
- **Default:** `true`
- **Example:** `false` to hide grand totals

#### `idPrefix` (string)

Prefix for all DOM element IDs to avoid conflicts.

- **Type:** String
- **Default:** Auto-generated random string (`'drillDowner' + random + '_'`)
- **Note:** Usually auto-generated; override only if needed for specific DOM targeting

---

## Column Properties (`colProperties`)

Define behavior and appearance for each column.

### Display Properties

#### `label` (string)

Human-readable column header text.

- **Default:** Capitalized column name
- **Example:** `{ "qty": { label: "Quantity" } }`

#### `class` (string)

CSS class applied to data cells.

- **Default:** `""`
- **Example:** `{ "price": { class: "currency-cell" } }`

#### `labelClass` (string)

CSS class applied to header cells.

- **Default:** `""`
- **Example:** `{ "price": { labelClass: "currency-header" } }`

#### `icon` (string)

Icon displayed next to group labels in breadcrumbs.

- **Default:** `""`
- **Example:** `{ "category": { icon: "📁" } }`

### Numeric Formatting

#### `decimals` (number)

Number of decimal places for numeric formatting.

- **Default:** `2`
- **Example:** `{ "price": { decimals: 2 } }` → "1,234.56"

### Advanced Behavior

#### `togglesUp` (boolean)

When true, shows aggregated/combined values at group levels (comma-separated unique values from children).

- **Default:** `false`
- **Example:** `{ "status": { togglesUp: true } }` shows "Active, Pending" for groups containing both statuses
- colProperties.<col>.togglesUp = true makes that column “bubble up” to group rows, showing the distinct child values as a comma-separated list (instead of leaving the group cell blank).

#### `formatter` (function)

Custom function to format cell values.

- **Default:** `null`
- **Signature:** `(value, row) => string`
- **Parameters:**
  - `value` - The cell value (or aggregated values if `togglesUp` is true)
  - `row` - The first data row in the group (useful for accessing other columns)

**Example:**

```javascript
{
    "status": {
        formatter: function(value, row) {
            const statusMap = {
                "pending": "⏳ Pending",
                "active": "🔄 Active",
                "completed": "✅ Completed"
            };
            return statusMap[value] || value;
        }
    },
    "priority": {
        formatter: function(value, row) {
            return "★".repeat(value);
        }
    }
}
```

#### `subTotalBy` (string)

Groups totals by another column (for unit-based totals). The resulting total shows separate sums for each unit.

- **Default:** `null`
- **Example:** `{ "quantity": { subTotalBy: "unit" } }` → "150 Kg, 75 m"

#### `key` (string)

Alternative key name for internal operations.

- **Default:** Column name
- **Example:** `{ "cat": { key: "category" } }`

---

## Public Methods

### Navigation & Display Control

#### `collapseToLevel(level = 0)`

Collapses the table to show only the specified depth level.

- **Parameters:** `level` (number) - Target depth (0 = top level only)
- **Returns:** `this` (for method chaining)
- **Example:** `drillDowner.collapseToLevel(1)` shows first two levels

#### `collapseAll()`

Collapses table to show only top-level groups.

- **Returns:** `this`
- **Shorthand for:** `collapseToLevel(0)`

#### `expandAll()`

Expands table to show all levels.

- **Returns:** `this`
- **Shorthand for:** `collapseToLevel(maxLevel)`

### Configuration Changes

#### `changeGroupOrder(newOrder)`

Changes the grouping hierarchy and re-renders the table.

- **Parameters:** `newOrder` (Array) - New array of column names for grouping
- **Returns:** `this`
- **Behavior:**
  - If controls exist, updates the dropdown selection
  - If the new order doesn't exist in dropdown, adds it as a custom option
  - Triggers a change event and re-renders

**Example:**

```javascript
drillDowner.changeGroupOrder(["warehouse", "product", "color"]);
```

#### `render()`

Completely re-renders the entire table and controls.

- **Returns:** `void`
- **Use case:** After changing data or configuration properties
- **Note:** Automatically recalculates grand totals

**Example:**

```javascript
drillDowner.dataArr.push(newRecord);
drillDowner.render();
```

### Utility Methods

#### `getTable()`

Returns the native DOM element of the main table.

- **Returns:** DOM element
- **Example:** `const table = drillDowner.getTable();`

#### `destroy()`

Cleans up event handlers and empties all containers.

- **Returns:** `void`
- **Use case:** Before removing DrillDowner or creating a new instance
- **Important:** Always call before destroying the instance to prevent memory leaks

**Example:**

```javascript
drillDowner.destroy();
```

---

## Static Methods

### `DrillDowner.formatNumber(number, decimals)`

Formats numbers with locale-specific thousands separators (uses `en-US` locale).

- **Parameters:**
  - `number` (number) - Number to format
  - `decimals` (number) - Decimal places
- **Returns:** Formatted string (or original value if not a valid number)

**Example:**

```javascript
DrillDowner.formatNumber(1234.567, 2)  // → "1,234.57"
DrillDowner.formatNumber(1000000, 0)   // → "1,000,000"
```

---

## Static Properties

### `DrillDowner.version`

Current version string.

- **Type:** string
- **Value:** `'1.1.13'`

**Example:**

```javascript
console.log(DrillDowner.version);  // "1.1.13"
```

---

## Public Properties

### Data Properties

#### `dataArr` (Array)

The source data array.

- **Modifiable:** Yes (call `render()` after changes)

#### `grandTotals` (Object)

Calculated grand totals for all total columns. Updated automatically on `render()`.

- **Structure:** `{ columnName: totalValue }` or `{ columnName: { unit: subtotal } }` when using `subTotalBy`

### Configuration Properties

#### `options` (Object)

Current configuration options.

- **Modifiable:** Yes (call `render()` after changes)

#### `totals` (Array)

Reference to `options.totals`.

#### `columns` (Array)

Reference to `options.columns`.

#### `colProperties` (Object)

Reference to `options.colProperties`.

### UI Element References

#### `container` (DOM)

Main table container element.

#### `controls` (DOM|null)

Controls container element (if provided via `controlsSelector`).

#### `azBar` (DOM|null)

A-Z navigation bar element (if provided via `azBarSelector`).

#### `table` (DOM)

The actual table element (available after rendering).

---

## Usage Examples

### Basic Setup

```javascript
const data = [
    {category: "Electronics", product: "Phone", quantity: 10, price: 599.99},
    {category: "Electronics", product: "Laptop", quantity: 5, price: 1299.99},
    {category: "Books", product: "Novel", quantity: 25, price: 19.99}
];

const drillDowner = new DrillDowner('#table-container', data, {
    groupOrder: ["category", "product"],
    columns: ["quantity"],
    totals: ["price"],
    colProperties: {
        category: {label: "Category", icon: "📁"},
        product: {label: "Product Name"},
        quantity: {label: "Qty", decimals: 0},
        price: {label: "Price ($)", decimals: 2, class: "money"}
    }
});
```

### With Custom Formatting

```javascript
const drillDowner = new DrillDowner('#table', data, {
    groupOrder: ["department", "employee"],
    columns: ["status", "priority"],
    totals: ["hours"],
    colProperties: {
        status: {
            label: "Status",
            togglesUp: true,
            formatter: (value) => {
                const icons = {active: "🟢", inactive: "🔴", pending: "🟡"};
                return `${icons[value] || "⚫"} ${value}`;
            }
        },
        priority: {
            label: "Priority",
            formatter: (value) => "★".repeat(value)
        },
        hours: {
            label: "Work Hours",
            decimals: 1,
            subTotalBy: "timeUnit"
        }
    },
    controlsSelector: "#controls",
    azBarSelector: "#az-nav"
});
```

### With Ledger Mode

```javascript
const drillDowner = new DrillDowner('#table-container', data, {
    groupOrder: ["category", "brand", "product"],
    groupOrderCombinations: [
        ["category", "brand"],
        ["brand", "product"]
    ],
    columns: ["info"],
    totals: ["price", "quantity"],
    
    // Ledger views for flat table display
    ledger: [
        {
            label: "Global Inventory (Detailed)",
            cols: ["category", "brand", "product", "info"],
            sort: ["category", "product"]
        },
        {
            label: "Brand Overview (Simple)",
            cols: ["brand", "product", "info"],
            sort: ["brand", "product"]
        }
    ],
    
    controlsSelector: '#table-controls',
    azBarSelector: '#az-bar'
});
```

### Pure Ledger Mode (No Grouping)

```javascript
// Start directly in ledger mode with no hierarchical option
const drillDowner = new DrillDowner('#table-container', data, {
    groupOrder: [],  // Empty = pure ledger mode
    ledger: [
        { label: "By Product", cols: ["product", "info"], sort: ["product"] },
        { label: "By Color", cols: ["color", "info"], sort: ["color"] }
    ],
    totals: ["quantity"],
    controlsSelector: '#controls'
});
```

### Dynamic Updates

```javascript
// Change grouping
drillDowner.changeGroupOrder(["employee", "department"]);

// Modify data and refresh
drillDowner.dataArr.push(newRecord);
drillDowner.render();

// Navigate programmatically
drillDowner.expandAll();
drillDowner.collapseToLevel(1);

// Method chaining
drillDowner
    .changeGroupOrder(["warehouse", "product"])
    .expandAll();

// Cleanup when done
drillDowner.destroy();
```

---

## CSS Classes

The widget generates these CSS classes for styling:

### Table Structure

| Class | Element | Description |
|-------|---------|-------------|
| `.drillDowner_table` | `<table>` | Main table |
| `.drillDowner_even` | `<tr>` | Alternating row color |
| `.drillDowner_first_group` | `<tr>` | First row in a group |
| `.drillDowner_num` | `<td>` | Numeric cells |
| `.drillDownerThTotal` | `<th>` | Header cells with grand totals |
| `.drillDownerTfootTotal` | `<td>` | Footer total cells |

### Drill Icons

| Class | Description |
|-------|-------------|
| `.drillDowner_drill_icon` | Expand/collapse icon container |
| `.drillDowner_drill_collapsed` | Collapsed state (▶) |
| `.drillDowner_drill_expanded` | Expanded state (▼) |

### Indentation

| Class | Padding |
|-------|---------|
| `.drillDowner_indent_0` | 0 |
| `.drillDowner_indent_1` | 2em |
| `.drillDowner_indent_2` | 3em |
| `.drillDowner_indent_3` | 4em |
| `.drillDowner_indent_4` | 5em |
| `.drillDowner_indent_5` | 6em |

### Controls

| Class | Description |
|-------|-------------|
| `.drillDowner_controls_container` | Controls wrapper |
| `.drillDowner_breadcrumb_nav` | Breadcrumb container |
| `.drillDowner_breadcrumb_item` | Breadcrumb level buttons |
| `.drillDowner_breadcrumb_arrow` | Arrow between breadcrumbs |
| `.drillDowner_grouping_controls` | Dropdown container |
| `.drillDowner_modern_select` | Grouping dropdown |
| `.drillDowner_control_label` | "Group by:" label |

### A-Z Navigation

| Class | Description |
|-------|-------------|
| `.drillDowner_az_bar` | A-Z bar container |
| `.drillDowner_az_link` | Active letter link |
| `.drillDowner_az_dimmed` | Inactive letter |
| `.drillDowner_layout_container` | Flex container for AZ + table |

### Alignment Helpers

| Class | Description |
|-------|-------------|
| `.drillDowner_right` | Right-aligned text |
| `.drillDowner_center` | Center-aligned text |

---

## Browser Compatibility

- **ES6:** Uses modern JavaScript features (classes, arrow functions, template literals, etc.)
- **Browsers:** Modern browsers supporting ES6:
  - Chrome 49+
  - Firefox 45+
  - Safari 10+
  - Edge 13+
- **Intl.Collator:** Uses for natural sorting with `es-MX` locale (well-supported)
- **Intl.NumberFormat:** Uses for number formatting with `en-US` locale

---

## Notes

### Sorting

The widget uses `Intl.Collator` with the following configuration for natural sorting:

```javascript
new Intl.Collator('es-MX', {
    sensitivity: 'base',
    numeric: true,
    caseFirst: 'false'
})
```

This provides case-insensitive, number-aware sorting appropriate for Spanish text.

### Event Handling

The widget cleans up event listeners by cloning elements when re-rendering. Always call `destroy()` before removing the widget to ensure proper cleanup.

### Controls Persistence

The grouping dropdown is NOT recreated on `render()` calls—it persists to maintain user selection state. Only the breadcrumbs and table are refreshed.
