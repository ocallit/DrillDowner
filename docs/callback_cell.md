
/**
* cellRenderer(ctx, td) -> string | null
* - Return null/undefined: widget renders the cell using its default logic.
* - Return string/number: widget uses it as the inside HTML of the <td> (td.innerHTML = String(returned)).
* - You may always mutate td (class/attrs/title/dataset) regardless of return value.
    */
    const ctx = {
    // --- cell identity / value ---
    keyName: null,        // Column key for this cell ("cliente", "importe", etc.); null when the cell is not tied to a data column (index/label cells).
    rawValue: null,       // The raw underlying value before formatting (group key, sum, or leaf value), exactly what the widget would render from.
    level: 0,             // Group nesting level (0..N-1); use -1 for footer/grand-total rows.

// --- row identity ---
rowKind: "leaf",      // What this row represents: "leaf" (record), "group" (aggregate/subtotal), "grandTotal" (tfoot total row), "ledger" (ungrouped/indexed list style).

// --- cell role within the row ---
cellKind: "data",     // What this <td> is: "expander" (click-to-toggle), "label" (first column but no toggle), "total" (totals column), "data" (regular data column).

// --- grouping context ---
groupOrder: [],       // Current grouping order configured for the table (e.g. ["pais","ciudad"]); empty means ungrouped mode.
groupColName: null,   // Grouping column name for this row level (e.g. "pais" at level 0); null when not in grouped mode or not applicable.
groupKey: null,       // Group key value for this row level (e.g. "MX" for pais); null when not applicable.

// --- column configuration (only meaningful for cellKind: "data" or "total") ---
colProperties: object|null,  // The widget's per-column config object for keyName (from options.colProperties[keyName]) or null if none / not applicable.
colFormatter: null,   // The resolved formatter function for this keyName (or null); identical to what the widget would use by default.

// --- row data access ---
rowData: array|null,        // The full row object the widget is rendering for leaf rows (and for group rows it can be the "representative" item, e.g. first item in group).
groupRows: array|null,      // Array of leaf row objects inside this group row; null for leaf rows and grand-total rows.
};
