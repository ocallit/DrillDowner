# DrillDowner JavaScript Widget Documentation

## Overview
DrillDowner is a powerful ES6 JavaScript class that creates interactive, hierarchical data tables with drill-down functionality. It allows users to explore nested data by expanding and collapsing groups, with support for totals, custom formatting, and navigation controls.

## Constructor

### `new DrillDowner(container, dataArr, options = {})`

Creates a new DrillDowner instance and immediately renders it.

**Parameters:**
- `container` (string|DOM) - CSS selector or DOM object for the main table container
- `dataArr` (Array) - Array of data objects to display
- `options` (Object) - Configuration options (see Options section)

**Example:**

```javascript
const drillDowner = new DrillDowner('#my-table', data, {
    groupOrder: ["category", "subcategory"],
    columns: ["name", "status"],
    totals: ["amount"],
    colProperties: { /* column configurations */}
});
```

## Options

### Core Configuration

#### `groupOrder` (Array)
- **Type:** Array of strings
- **Default:** `[]`
- **Purpose:** Defines the hierarchical grouping columns in order from top-level to bottom-level
- **Example:** `["product", "color", "warehouse"]` creates Product > Color > Warehouse hierarchy

#### `columns` (Array)
- **Type:** Array of strings  
- **Default:** `[]`
- **Purpose:** Specifies which data columns to display as regular table columns
- **Example:** `["status", "priority", "notes"]`

#### `totals` (Array)
- **Type:** Array of strings
- **Default:** `[]`
- **Purpose:** Specifies which numeric columns to sum up and display as totals
- **Example:** `["quantity", "price", "weight"]`

#### `colProperties` (Object)
- **Type:** Object with column configurations
- **Default:** `{}`
- **Purpose:** Defines display properties, formatters, and behavior for each column
- **Structure:** `{ columnName: { property: value, ... } }`

### UI Components

#### `azBarSelector` (string|null)
- **Type:** CSS selector string or null
- **Default:** `null`
- **Purpose:** Container for A-Z navigation bar (alphabet quick-jump)
- **Example:** `"#alphabet-nav"`

#### `controlsSelector` (string|null)
- **Type:** CSS selector string or null
- **Default:** `null`
- **Purpose:** Container for breadcrumb navigation and grouping controls
- **Example:** `"#table-controls"`

### Advanced Options

#### `groupOrderCombinations` (Array|null)
- **Type:** Array of arrays or null
- **Default:** `null`
- **Purpose:** Predefined grouping combinations for the dropdown selector
- **Example:** `[["product", "color"], ["color", "product"], ["warehouse", "product"]]`

#### `showGrandTotals` (boolean)
- **Type:** Boolean
- **Default:** `true`
- **Purpose:** Controls whether grand totals appear in table headers and footer
- **Example:** `false` to hide grand totals

#### `idPrefix` (string)
- **Type:** String
- **Default:** Auto-generated random string
- **Purpose:** Prefix for all DOM element IDs to avoid conflicts
- **Note:** Usually auto-generated; override only if needed

## Column Properties (`colProperties`)

Define behavior and appearance for each column:

### Display Properties

#### `label` (string)
- **Purpose:** Human-readable column header text
- **Default:** Capitalized column name
- **Example:** `{ "qty": { label: "Quantity" } }`

#### `class` (string)
- **Purpose:** CSS class for data cells
- **Default:** `""`
- **Example:** `{ "price": { class: "currency-cell" } }`

#### `labelClass` (string)
- **Purpose:** CSS class for header cells
- **Default:** `""`
- **Example:** `{ "price": { labelClass: "currency-header" } }`

### Numeric Formatting

#### `decimals` (number)
- **Purpose:** Number of decimal places for numeric formatting
- **Default:** `2`
- **Example:** `{ "price": { decimals: 2 } }` → "1,234.56"

### Advanced Behavior

#### `togglesUp` (boolean)
- **Purpose:** Whether to show aggregated/combined values at group levels
- **Default:** `false`
- **Example:** `{ "status": { togglesUp: true } }` shows "Active, Pending" for groups

#### `formatter` (function)
- **Purpose:** Custom function to format cell values
- **Default:** `null`
- **Signature:** `(value, row) => string`
- **Example:**
```javascript
{
    "status": {
        formatter: function(value, row) {
            return value === "active" ? "✅ Active" : "⏸️ Inactive";
        }
    }
}
```

#### `subTotalBy` (string)
- **Purpose:** Groups totals by another column (for unit-based totals)
- **Default:** `null`
- **Example:** `{ "quantity": { subTotalBy: "unit" } }` → "150 Kg, 75 m"

#### `icon` (string)
- **Purpose:** Icon to display next to group labels in breadcrumbs
- **Default:** `""`
- **Example:** `{ "category": { icon: "📁" } }`

#### `key` (string)
- **Purpose:** Alternative key name for internal operations
- **Default:** Column name
- **Example:** `{ "cat": { key: "category" } }`

## Public Methods

### Navigation & Display Control

#### `collapseToLevel(level = 0)`
- **Purpose:** Collapses the table to show only specified depth level
- **Parameters:** `level` (number) - Target depth (0 = top level only)
- **Example:** `drillDowner.collapseToLevel(1)` shows first two levels

#### `collapseAll()`
- **Purpose:** Collapses table to show only top-level groups
- **Shorthand for:** `collapseToLevel(0)`

#### `expandAll()`
- **Purpose:** Expands table to show all levels
- **Shorthand for:** `collapseToLevel(maxLevel)`

### Configuration Changes

#### `changeGroupOrder(newOrder)`
- **Purpose:** Changes the grouping hierarchy and re-renders the table
- **Parameters:** `newOrder` (Array) - New array of column names for grouping
- **Example:** `drillDowner.changeGroupOrder(["warehouse", "product", "color"])`

#### `render()`
- **Purpose:** Completely re-renders the entire table and controls
- **Use case:** After changing data or configuration properties
- **Note:** Automatically recalculates grand totals

### Utility Methods

#### `getTable()`
- **Purpose:** Returns jQuery object of the main table element
- **Returns:** jQuery object
- **Example:** `const $table = drillDowner.getTable()`

#### `destroy()`
- **Purpose:** Cleans up event handlers and empties all containers
- **Use case:** Before removing DrillDowner or creating a new instance
- **Important:** Always call before destroying the instance

### Static Methods

#### `DrillDowner.formatNumber(number, decimals)`
- **Purpose:** Formats numbers with locale-specific thousands separators
- **Parameters:** 
  - `number` (number) - Number to format
  - `decimals` (number) - Decimal places
- **Returns:** Formatted string
- **Example:** `DrillDowner.formatNumber(1234.567, 2)` → "1,234.57"

## Public Properties

### Data Properties

#### `dataArr` (Array)
- **Purpose:** The source data array
- **Modifiable:** Yes (call `render()` after changes)

#### `grandTotals` (Object)
- **Purpose:** Calculated grand totals for all total columns
- **Updated:** Automatically on `render()`
- **Structure:** `{ columnName: totalValue }` or `{ columnName: { unit: subtotal } }`

### Configuration Properties

#### `options` (Object)
- **Purpose:** Current configuration options
- **Modifiable:** Yes (call `render()` after changes)

#### `totals` (Array)
- **Purpose:** Current totals columns
- **Reference:** `options.totals`

#### `columns` (Array)
- **Purpose:** Current display columns  
- **Reference:** `options.columns`

#### `colProperties` (Object)
- **Purpose:** Current column properties
- **Reference:** `options.colProperties`

### UI Element References

#### `$container` (jQuery)
- **Purpose:** Main table container element

#### `$controls` (jQuery|null)
- **Purpose:** Controls container element (if provided)

#### `$azBar` (jQuery|null)
- **Purpose:** A-Z navigation bar element (if provided)

#### `$table` (jQuery)
- **Purpose:** The actual table element (available after rendering)

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

// Cleanup when done
drillDowner.destroy();
```

## CSS Classes

The widget generates these CSS classes for styling:

- `.drillDowner_table` - Main table
- `.drillDowner_drill_icon` - Expand/collapse icons
- `.drillDowner_drill_collapsed` / `.drillDowner_drill_expanded` - Icon states
- `.drillDowner_num` - Numeric cells
- `.drillDowner_indent_N` - Indentation levels (0-5)
- `.drillDowner_controls_container` - Controls wrapper
- `.drillDowner_breadcrumb_item` - Breadcrumb buttons
- `.drillDowner_az_bar` - A-Z navigation
- `.drillDownerThTotal` - Header cells with grand totals
- `.drillDownerTfootTotal` - Footer total cells

## Browser Compatibility

- **jQuery:** Requires jQuery 3.x
- **ES6:** Uses modern JavaScript features (classes, arrow functions, etc.)
- **Browsers:** Modern browsers supporting ES6 (Chrome 49+, Firefox 45+, Safari 10+, Edge 13+)
- **Intl.Collator:** Uses for natural sorting (well-supported)