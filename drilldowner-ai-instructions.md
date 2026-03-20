# AI Instructions for DrillDowner.js

**CRITICAL DIRECTIVE:** Before generating any code using `DrillDowner`, you MUST read `docs/drilldowner_docs.md` to understand the configuration schema. Do not guess the API.

When writing, refactoring, or modifying code that uses `DrillDowner.js`, you MUST adhere strictly to the following rules. DrillDowner is a declarative, configuration-driven UI component designed to consume flat arrays of data (like raw SQL result sets) and handle aggregation, grouping, and rendering natively.

## Core Directives (CRITICAL)

1. **NO Manual DOM Manipulation:** Do not write custom `document.createElement`, string template literals for tables, or custom click event listeners to expand/collapse rows. The `new DrillDowner()` instance handles 100% of the UI rendering and DOM interaction.
2. **NO Pre-Aggregation in JS:** Do not use `Array.reduce`, `Array.map`, or custom grouping loops to pre-calculate sums, differences, or grouped hierarchies before passing data to the instance. Pass the flat dataset directly.
3. **Use Native Math (`balanceBehavior`):** To calculate running balances, Net values, or P&L (e.g., Income - Expense), use `colProperties.balanceBehavior`. Do not compute these values manually in the data array.
4. **Configuration Over Code:** All features must be defined exclusively within the DrillDowner options object.

## Configuration Schema Reference

When initializing `new DrillDowner('#selector', dataArray, { options })`, utilize these native properties:

* **`groupOrder`** `[Array of Strings]`: Defines the default hierarchical drill-down order (e.g., `["Store", "Year-Month", "Type"]`).
* **`groupOrderCombinations`** `[Array of Arrays]`: Defines the alternative grouping paths for the built-in UI dropdown.
* **`totals`** `[Array of Strings]`: Declares numeric columns that DrillDowner will automatically aggregate (sum) across all group levels.
* **`columns`** `[Array of Strings]`: Declares standard text/data columns to display at the leaf level.
* **`ledger`** `[Array of Objects]`: Defines flat, non-grouped ledger views. 
  * Schema: `{ label: "String", cols: ["col1", "col2"], sort: ["-col1"] }`
* **`controlsSelector` & `azBarSelector`** `[Strings]`: CSS selectors pointing to empty `<div>` elements where DrillDowner should inject its native dropdowns, breadcrumbs, and A-Z indexers.

## `colProperties` Dictionary

Use the `colProperties` object for formatting, styling, and complex column behaviors:

* `label` (String): The display name of the column header.
* `icon` (String): An emoji or string to prepend to the label.
* `formatter` (Function): Format numbers natively. Example: `(v) => '$' + DrillDowner.formatNumber(v, 2)`.
* `balanceBehavior` (Object): Automatically aggregates columns using native math based on other fields.
  * Schema: `{ initialBalance: 0, add: ["Income_Col"], subtract: ["Expense_Col"] }`

## Strictly Enforced Boilerplate Pattern

```javascript
// 1. Data remains flat
const flatData = [ ... ]; 

// 2. Initialization is purely configuration-based
const myDrill = new DrillDowner('#table-container', flatData, {
    groupOrder: ["Region", "Store"],
    totals: ["Sales", "Expenses", "NetProfit"],
    columns: ["Notes"],
    ledger: [
        { label: "Ledger Mode", cols: ["Region", "Store", "Sales", "Expenses", "NetProfit"], sort: ["Region"] }
    ],
    controlsSelector: '#controls',
    colProperties: {
        "NetProfit": {
            label: "Net Profit",
            // Do NOT calculate this manually; use balanceBehavior
            balanceBehavior: { add: ["Sales"], subtract: ["Expenses"] },
            formatter: (v) => DrillDowner.formatNumber(v, 2)
        }
    }
});	