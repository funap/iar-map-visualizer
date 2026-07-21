# IAR Map Visualizer

English | [日本語](README_ja.md)

A web-based tool designed to parse linker map files (.map) and project files (.ewp) from IAR Embedded Workbench for ARM (EWARM), visually analyzing ROM (RO Code / RO Data) and RAM (RW Data) memory consumption.

## Overview

In embedded system development, this tool provides an intuitive way to understand memory occupancy across compiled modules and libraries relative to your microcontroller's Flash capacity. All parsing and visualization are executed locally within your web browser—no code or map files are ever transmitted to external servers.

## Key Features

- Interactive Treemap Visualization
  Visualizes memory consumption for modules and libraries proportionally by area. Supports click-to-drill-down and hierarchical navigation.

- EWARM Virtual Folder Support
  Loading an .ewp project file alongside the .map file enables grouping by your IDE virtual project folder structure.

- Flexible Grouping Modes
  Switch between build output grouping (libraries and modules) and EWARM project folder grouping with a single click.

- Flash Memory Budget Tracking
  Specify your target microcontroller Flash capacity (in KB or MB) to view real-time utilization percentages and remaining memory gauges.

- Module Details Table with Search and Sorting
  Displays RO Code, RO Data, and RW Data per object module. Supports live searching and column sorting. Clicking a table row programmatically zooms the treemap to the selected item.

- 100% Client-Side Processing
  All data processing runs directly inside the browser, allowing offline execution by opening index.html locally without a web server.

## Usage

1. Open index.html in a web browser or access the web version.
2. Drag and drop your EWARM .map and .ewp files into the dropzone (multiple files can be dropped simultaneously).
3. Analyze memory distribution in the Treemap view. Use the EWARM Folders and Library / Group buttons to switch grouping views.
4. Set your target microcontroller Flash capacity in the sidebar to update the progress meter.

## System Requirements

- Modern web browsers such as Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari.

## License

MIT License
