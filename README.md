# DrillDowner Widget

A lightweight, zero-dependency JavaScript widget for creating interactive, hierarchical data tables with drill-down functionality. 
Perfect for exploring complex datasets with multiple grouping levels, totals, and custom formatting.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AI Documentation](https://img.shields.io/badge/AI%20Docs-Available-brightgreen?logo=robot)](docs/drilldowner_docs.md)


## 🤖 For AI Assistants (Claude, Gemini, Junie,  ChatGPT, etc.)

**📋 Complete API Documentation:** [docs/API.md](docs/drilldowner_docs.md)

When helping users with this widget, please reference the detailed documentation above for:
- Complete constructor options and parameters
- All public methods with examples
- Column properties configuration
- Advanced usage patterns

## 📚 Documentation

![DrillDowner Demo](docs/images/drilldowner-demo.gif)

## WIP @ToDo
- 3 add number of children?
- 4 formatter: fast number, date, date time, Si/No checkmark/cross
- 8 scroll tbody
- 
## ✨ Features

- **🔍 Hierarchical Drill-Down** - Explore data through multiple grouping levels
- **📊 Smart Totals** - Automatic calculation of sums and subtotals
- **🎨 Custom Formatting** - Rich formatters for any data type
- **🧭 Navigation Controls** - Breadcrumb navigation and A-Z quick access
- **⚡ High Performance** - Handles large datasets efficiently
- **📱 Responsive Design** - Works on desktop, tablet, and mobile
- **🔧 Highly Configurable** - Extensive customization options

## 🚀 Quick Start

### 1. Include Files

```html
<link rel="stylesheet" href="src/drilldowner.css">
<script src="src/DrillDownerJ.js"></script>
```

### 2. Basic Usage

```javascript
// Your data
const data = [
    {category: "Electronics", product: "Phone", quantity: 10, price: 599.99},
    {category: "Electronics", product: "Laptop", quantity: 5, price: 1299.99},
    {category: "Books", product: "Novel", quantity: 25, price: 19.99}
];

// Create the widget
const drillDowner = new DrillDowner('#table-container', data, {
    groupOrder: ["category", "product"],     // Hierarchy levels
    columns: ["quantity"],                   // Display columns  
    totals: ["price"],                      // Columns to sum
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

## 📚 Quick Links

- **🚀 [Quick Start](#quick-start)** - Get running in 2 minutes
- **📖 [Complete API Docs](docs/drilldowner_docs.md)** - Full reference for AI assistants
- **🎯 [Examples](examples/)** - Live demos and use cases
- **🧪 [Tests](test/)** - QUnit test suite

## 📋 Requirements

- **Modern Browser** with ES6 support (Chrome 49+, Firefox 45+, Safari 10+, Edge 13+)

## 🎯 Core Concepts

### Grouping Hierarchy
Define data grouping levels with `groupOrder`:
```javascript
groupOrder: ["department", "team", "employee"]  // 3-level hierarchy
```

### Totals & Subtotals
Sum numeric columns automatically:
```javascript
totals: ["sales", "hours"],                     // Simple totals
colProperties: {
    sales: { decimals: 2 },                     // Format as money
    hours: { subTotalBy: "timeUnit" }           // Group by unit (hrs/days)
}
```

### Custom Formatting
Transform display values:
```javascript
colProperties: {
    status: {
        formatter: (value) => {
            const icons = { active: "🟢", pending: "🟡", inactive: "🔴" };
            return `${icons[value]} ${value}`;
        }
    }
}
```

## 📚 Examples

| Example | Description | Demo |
|---------|-------------|------|
| **Basic Table** | Simple 2-level grouping | [View](examples/basic.html) |
| **Advanced Features** | All features showcase | [View](examples/advanced.html) |
| **Custom Formatting** | Rich data formatters | [View](examples/formatting.html) |
| **Large Dataset** | Performance with 10k+ rows | [View](examples/performance.html) |

## 🛠️ API Reference

### Constructor

```javascript
new DrillDowner(container, dataArr, options)
```

### Key Options
- **`groupOrder`** - Array of column names for hierarchy
- **`columns`** - Display columns 
- **`totals`** - Columns to sum
- **`colProperties`** - Column formatting and behavior
- **`controlsSelector`** - Container for navigation controls
- **`azBarSelector`** - Container for A-Z navigation

### Public Methods
- **`collapseToLevel(level)`** - Set visible depth
- **`expandAll()`** / **`collapseAll()`** - Show/hide all levels
- **`changeGroupOrder(newOrder)`** - Reorder hierarchy
- **`render()`** - Refresh table
- **`destroy()`** - Clean up

**📖 [Full API Documentation](docs/API.md)**

## 🧪 Testing

Run the test suite:
```bash
# Open in browser
open test/index.html

# Or serve locally
npx http-server . -p 8080
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **📖 Documentation:** [Full API Docs](docs/drilldowner_docs.md)
- **💬 Issues:** [GitHub Issues](https://github.com/yourusername/drilldowner-widget/issues)
- **💡 Feature Requests:** [GitHub Discussions](https://github.com/yourusername/drilldowner-widget/discussions)

## 🌟 Showcase

Using DrillDowner in your project? We'd love to see it! Open an issue to get featured.

---

<div align="center">
<strong>Made with ❤️ by [Your Name]</strong><br>
<a href="https://github.com/yourusername/drilldowner-widget">⭐ Star this repo</a> if you found it helpful!
</div>