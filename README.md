# DrillDowner Widget

DrillDowner is a dependency-free ES6 JavaScript class that transforms flat data into interactive hierarchical tables with drill-down navigation, dynamic grouping/flat views, aggregated totals, and customizable formatting—all using native DOM APIs.

**Version:** 1.1.13

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AI Documentation](https://img.shields.io/badge/AI%20Docs-Available-brightgreen?logo=robot)](docs/drilldowner_docs.md)

## For AI Assistants (Claude, Gemini, Junie, ChatGPT, etc.)

**Complete API Documentation:** [docs/drilldowner_docs.md](docs/drilldowner_docs.md)

When helping users with this widget, please reference the detailed documentation above for:
- Complete constructor options and parameters
- All public methods with examples
- Column properties configuration
- Ledger mode for flat table views
- Advanced usage patterns

## Features

- **Hierarchical Drill-Down** - Explore data through multiple grouping levels
- **Ledger Mode** - Switch to flat table views with custom columns and sorting
- **Smart Totals** - Automatic calculation of sums and subtotals
- **Custom Formatting** - Rich formatters for any data type
- **Navigation Controls** - Breadcrumb navigation and A-Z quick access
- **High Performance** - Handles large datasets efficiently
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Highly Configurable** - Extensive customization options

## Quick Start

### 1. Include Files

```html
<link rel="stylesheet" href="src/drilldowner.css">
<script src="src/DrillDowner.js"></script>
```

### 2. Basic Usage

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
        category: {label: "Category"},
        product: {label: "Product Name"},
        quantity: {label: "Qty", decimals: 0},
        price: {label: "Price ($)", decimals: 2}
    }
});
```

### 3. HTML Structure

```html
<div id="controls"></div>    <!-- Navigation controls -->
<div id="table-container">   <!-- Main table -->
    <div id="az-bar"></div>  <!-- A-Z quick navigation -->
</div>
```

That's it! Your interactive drill-down table is ready.

## WIP / ToDo

- Add number of children indicator
- Formatter presets: fast number, date, datetime, Yes/No checkmark/cross
- Scrollable tbody

## Quick Links

- **[Complete API Docs](docs/drilldowner_docs.md)** - Full reference for AI assistants
- **[Examples](examples/)** - Live demos and use cases
- **[Tests](test/)** - QUnit test suite

## Requirements

- **Modern Browser** with ES6 support (Chrome 49+, Firefox 45+, Safari 10+, Edge 13+)

## Core Concepts

### Grouping Hierarchy

Define data grouping levels with `groupOrder`:

```javascript
groupOrder: ["department", "team", "employee"]  // 3-level hierarchy
```

### Ledger Mode (Flat Views)

Switch between hierarchical and flat table views:

```javascript
ledger: [
    {
        label: "Full Inventory",
        cols: ["category", "brand", "product"],
        sort: ["category", "product"]
    },
    {
        label: "By Brand",
        cols: ["brand", "product"],
        sort: ["brand"]
    }
]
```

### Totals & Subtotals

Sum numeric columns automatically:

```javascript
totals: ["sales", "hours"],
colProperties: {
    sales: { decimals: 2 },
    hours: { subTotalBy: "timeUnit" }  // Groups by unit (hrs/days)
}
```

### Custom Formatting

Transform display values:

```javascript
colProperties: {
    status: {
        formatter: function(value, row) {
            const icons = { active: "✅", pending: "⏳", inactive: "❌" };
            return `${icons[value] || "⚫"} ${value}`;
        }
    }
}
```

## API Reference

### Constructor

```javascript
new DrillDowner(container, dataArr, options)
```

### Key Options

| Option | Type | Description |
|--------|------|-------------|
| `groupOrder` | Array | Column names for hierarchy |
| `columns` | Array | Display columns |
| `totals` | Array | Columns to sum |
| `colProperties` | Object | Column formatting and behavior |
| `ledger` | Array | Flat view configurations |
| `groupOrderCombinations` | Array | Predefined grouping combinations |
| `controlsSelector` | string | Container for navigation controls |
| `azBarSelector` | string | Container for A-Z navigation |
| `showGrandTotals` | boolean | Show/hide grand totals (default: true) |

### Public Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `collapseToLevel(level)` | this | Set visible depth |
| `expandAll()` | this | Show all levels |
| `collapseAll()` | this | Collapse to top level |
| `changeGroupOrder(newOrder)` | this | Reorder hierarchy |
| `render()` | void | Refresh table |
| `getTable()` | DOM | Get table element |
| `destroy()` | void | Clean up |

**[Full API Documentation](docs/drilldowner_docs.md)**

## Testing

Run the test suite:

```bash
# Open in browser
open test/index.html

# Or serve locally
npx http-server . -p 8080
```

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [Full API Docs](docs/drilldowner_docs.md)
- **Issues:** [GitHub Issues](https://github.com/ocallit/DrillDowner/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/ocallit/DrillDowner/discussions)

## Showcase

Using DrillDowner in your project? We'd love to see it! Open an issue to get featured.

---

**Made with care by Pepe Santos**

[Star this repo](https://github.com/ocallit/DrillDowner) if you found it helpful!
