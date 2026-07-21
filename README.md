# IAR Map Visualizer

A modern, web-based, client-side utility to parse IAR Systems Embedded Workbench for ARM (EWARM) `.map` files and visualize their ROM (RO Code + RO Data) footprint as an interactive, zoomable treemap by compilation modules (`.o`) and libraries (`.a`).

👉 **Live Web Version:** [https://funap.github.io/iar-map-visualizer/](https://funap.github.io/iar-map-visualizer/)

---

## 🌟 Key Features

1. **Client-Side Processing (Privacy-First)**
   - All parsing and processing happen locally in your web browser. Your proprietary map files and source filenames are never uploaded to any server.

2. **Local Protocol Compatibility**
   - Built to avoid ES Module CORS restrictions when executing under the local file protocol (`file://`). You can run the application instantly by double-clicking `index.html` in Microsoft Edge, Google Chrome, Safari, or Firefox without launching a local web server.

3. **Robust EWARM Map Parsing**
   - **Thousands Separators**: Full compatibility with both single quotes (`'`) used in newer IAR compilers (e.g. `4'438`) and commas or spaces used in older versions.
   - **Fixed-Width Column Boundaries**: Dynamically scans header divider spans (e.g., `------  -------`) to locate column spans. This guarantees correct alignment even when specific modules contain blank columns (e.g., when a compiler-created module only contains RW RAM data but has no RO Code).
   - **Clean Results**: Automatic filtering of decorative borders, linker placeholders, and empty metadata group structures.

4. **Target Flash Memory Budgeting**
   - Input your microcontroller's Flash capacity (e.g., `256 KB` or `1 MB`) in the settings sidebar to view a real-time progress gauge representing your ROM occupancy percentage.

5. **Drill-Down Treemap (Powered by Apache ECharts)**
   - Displays a clean visual hierarchy: **All Modules ➔ Libraries / Folders ➔ Individual Object Files (`.o`)**.
   - Click on any library folder to drill down into its sub-modules, and use the breadcrumb navigation bar at the bottom to zoom back out.
   - Hover over segments to display precise details (RO Code, RO Data, total ROM, RW RAM, and percentage of total budget).

6. **Search & Sort Data Table**
   - Instantly filter the list of compiled modules using the live query search bar.
   - Click column headers to sort modules in ascending/descending order (e.g., sort by ROM size to find size outliers).
   - Click any table row to programmatically focus and zoom the Treemap view directly to its parent group node.

---

## 📁 Directory Structure

```
iar-map-visualizer/
├── index.html       # The main application entry UI
├── sample.map       # Realistic mockup EWARM map file for quick evaluation
├── APPV100.map      # Your custom STM32F429 project map file
├── css/
│   └── style.css    # Responsive theme styling and glassmorphism layouts
└── js/
    ├── parser.js    # Core EWARM map parser library
    └── app.js       # UI binder, ECharts controls, sorting table, and resize timer
```

---

## 🚀 How to Run

### Web Version
You can access the live web application directly at:
[https://funap.github.io/iar-map-visualizer/](https://funap.github.io/iar-map-visualizer/)

### Local Version
1. Open [index.html](file:///Users/af/workspace/iar-map-visualizer/index.html) in your favorite modern web browser.
2. Click **"Load Mock Sample"** (or **"Explore with Sample Map"**) to inspect the bundled sample data.
3. Drag and drop any of your local EWARM `.map` files into the designated zone to analyze your own builds.

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
