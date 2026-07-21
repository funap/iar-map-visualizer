// Application State
let appData = null; // Parsed map data { groups, totals }
let activeSortColumn = 'romSize';
let activeSortDesc = true;
let searchQuery = '';
let targetFlashBytes = 256 * 1024; // Default 256KB
let chartInstance = null;

// Color Palette for Libraries
const PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
    '#06b6d4', '#14b8a6', '#f43f5e', '#a855f7', '#3b82f6'
];

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initChart();
    lucide.createIcons();
});

function initDOM() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const flashBudgetInput = document.getElementById('flash-budget-input');
    const flashBudgetUnit = document.getElementById('flash-budget-unit');
    const searchInput = document.getElementById('search-input');
    
    // File inputs
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        });
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
    
    // Load sample map data
    loadSampleBtn.addEventListener('click', loadSampleData);
    
    // Flash Budget Configurator
    const updateBudget = () => {
        const val = parseFloat(flashBudgetInput.value) || 0;
        const unit = flashBudgetUnit.value;
        const multiplier = unit === 'KB' ? 1024 : 1024 * 1024;
        targetFlashBytes = val * multiplier;
        updateBudgetMeter();
    };
    
    flashBudgetInput.addEventListener('input', updateBudget);
    flashBudgetUnit.addEventListener('change', updateBudget);
    
    // Search Filter
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
    });
    
    // Table Headers Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (activeSortColumn === col) {
                activeSortDesc = !activeSortDesc;
            } else {
                activeSortColumn = col;
                activeSortDesc = true;
            }
            updateSortHeaders();
            renderTable();
        });
    });
    
    // Handle Window Resize
    window.addEventListener('resize', () => {
        if (chartInstance) {
            chartInstance.resize();
        }
    });
}

function initChart() {
    const chartDom = document.getElementById('treemap-chart');
    chartInstance = echarts.init(chartDom, 'dark', { renderer: 'canvas' });
}

// Format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString();
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        try {
            const parsed = parseMapFile(text);
            
            // Validate if we actually parsed anything
            const groupCount = Object.keys(parsed.groups).length;
            if (groupCount === 0) {
                alert('Could not find MODULE SUMMARY section or parse data in this map file. Please check EWARM settings and ensure "linker map file" was generated.');
                return;
            }
            
            appData = parsed;
            onDataLoaded();
        } catch (err) {
            console.error(err);
            alert('An error occurred while parsing the map file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Fallback sample map data in case fetch fails (e.g. running on file:// protocol)
const SAMPLE_MAP_FALLBACK = `###############################################################################
#
# IAR ELF Linker V8.50.1.245/W32 for ARM
# Copyright 2007-2020 IAR Systems AB.
#
###############################################################################

***************************************************************************
*** MODULE SUMMARY ***

Module                      ro code    ro data    rw data
------                      -------    -------    -------
command line/config:              4          0          0
---------------------------------------------------------------------------
Total:                            4          0          0

C:\\Projects\\EmbeddedApp\\Debug\\Obj: [1]
  display.o                   4,612     12,864         64
  main.o                      2,358        288         16
  motor.o                     2,320         12          4
  sensor.o                    1,104         48          8
  utils.o                       780         24          0
  wifi.o                     17,664      4,800        256
---------------------------------------------------------------------------
Total:                       28,838     18,036        348

rt7M_tl.a: [2]
  aeabi_readwrite.o              24          0          0
  memcpy.o                       88          0          0
  memset.o                       44          0          0
  rt_toc.o                      120          8          0
---------------------------------------------------------------------------
Total:                          276          8          0

m7M_tls.a: [3]
  addsub.o                      416          0          0
  fpinit.o                       64          0          0
  muldiv.o                      544          0          0
---------------------------------------------------------------------------
Total:                        1,024          0          0

dl7M_tln.a: [4]
  abort.o                         8          0          0
  exit.o                         12          4          0
  xpnd.o                        140          0          0
  yvals.o                         0         44          0
---------------------------------------------------------------------------
Total:                          160         48          0

Linker created:
  initializer bytes               0        348          0
  vtable                          0        128          0
---------------------------------------------------------------------------
Total:                            0        476          0

Grand Total:                 30,302     18,568        348`;

// Fetch and load sample.map
async function loadSampleData() {
    try {
        const response = await fetch('./sample.map');
        if (!response.ok) {
            throw new Error('Fetch status not OK');
        }
        const text = await response.text();
        const parsed = parseMapFile(text);
        appData = parsed;
        onDataLoaded();
    } catch (err) {
        console.warn('Fetch failed, using built-in fallback sample data:', err);
        const parsed = parseMapFile(SAMPLE_MAP_FALLBACK);
        appData = parsed;
        onDataLoaded();
    }
}

function onDataLoaded() {
    // Show dashboard panel, hide dropzone placeholder instructions
    document.getElementById('welcome-card').classList.add('hidden');
    document.getElementById('main-dashboard').classList.remove('hidden');
    
    // Force resize after the browser completes the layout and rendering cycle
    setTimeout(() => {
        if (chartInstance) {
            chartInstance.resize();
        }
    }, 50);
    
    // Update KPI panels
    updateKPIs();
    
    // Update Budget meter
    updateBudgetMeter();
    
    // Build and Draw Treemap
    drawTreemap();
    
    // Sort columns and draw table
    updateSortHeaders();
    renderTable();
    
    // Re-trigger animations
    const panels = document.querySelectorAll('.animate-fade-in');
    panels.forEach(p => {
        p.style.animation = 'none';
        p.offsetHeight; /* trigger reflow */
        p.style.animation = null;
    });
}

function updateKPIs() {
    const romSize = appData.totals.romSize;
    const roCode = appData.totals.roCode;
    const roData = appData.totals.roData;
    const rwData = appData.totals.rwData;
    
    document.getElementById('kpi-rom').innerText = formatBytes(romSize);
    document.getElementById('kpi-rom-bytes').innerText = `${formatNumber(romSize)} B`;
    
    document.getElementById('kpi-code').innerText = formatBytes(roCode);
    const codePercent = romSize > 0 ? ((roCode / romSize) * 100).toFixed(1) : 0;
    document.getElementById('kpi-code-sub').innerText = `${codePercent}% of ROM`;
    
    document.getElementById('kpi-data').innerText = formatBytes(roData);
    const dataPercent = romSize > 0 ? ((roData / romSize) * 100).toFixed(1) : 0;
    document.getElementById('kpi-data-sub').innerText = `${dataPercent}% of ROM`;
    
    document.getElementById('kpi-ram').innerText = formatBytes(rwData);
    document.getElementById('kpi-ram-sub').innerText = `${formatNumber(rwData)} bytes used`;
}

function updateBudgetMeter() {
    if (!appData) return;
    
    const romSize = appData.totals.romSize;
    const percent = Math.min((romSize / targetFlashBytes) * 100, 100);
    
    const fill = document.getElementById('budget-fill');
    fill.style.width = `${percent}%`;
    
    // Update colors based on occupancy threshold
    fill.className = 'budget-bar-fill';
    if (percent > 90) {
        fill.classList.add('danger');
    } else if (percent > 75) {
        fill.classList.add('warning');
    }
    
    document.getElementById('budget-percent').innerText = `${((romSize / targetFlashBytes) * 100).toFixed(1)}%`;
    document.getElementById('budget-fraction').innerText = `${formatBytes(romSize)} / ${formatBytes(targetFlashBytes)}`;
}

// Prepare hierarchical ECharts structure
function getChartData() {
    const romSizeTotal = appData.totals.romSize;
    const chartNodes = [];
    
    let colorIndex = 0;
    
    for (const groupName in appData.groups) {
        const groupObj = appData.groups[groupName];
        
        let groupRomSum = 0;
        const children = [];
        
        groupObj.modules.forEach(m => {
            groupRomSum += m.romSize;
            
            // Leaf node format
            children.push({
                name: m.name,
                value: m.romSize,
                roCode: m.roCode,
                roData: m.roData,
                rwData: m.rwData,
                romSize: m.romSize,
                romPercentage: romSizeTotal > 0 ? (m.romSize / romSizeTotal) * 100 : 0,
                group: groupName
            });
        });
        
        // Skip groups that don't consume ROM space
        if (groupRomSum === 0) continue;
        
        // Parent Library Node format
        const color = PALETTE[colorIndex % PALETTE.length];
        colorIndex++;
        
        chartNodes.push({
            name: groupName,
            value: groupRomSum,
            romPercentage: romSizeTotal > 0 ? (groupRomSum / romSizeTotal) * 100 : 0,
            children: children,
            itemStyle: {
                color: color
            }
        });
    }
    
    return chartNodes;
}

function drawTreemap() {
    const data = getChartData();
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function (info) {
                const nodeData = info.data;
                if (!nodeData) return info.name;
                
                const percentText = nodeData.romPercentage.toFixed(2);
                
                // If it is a leaf (object module file)
                if (nodeData.roCode !== undefined) {
                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Group:</span>
                                <span style="font-weight: 500; color: #fff;">${nodeData.group}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Total ROM:</span>
                                <span style="font-weight: 600; color: #a78bfa;">${formatBytes(nodeData.romSize)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px; padding-left: 8px;">
                                <span style="color: #64748b;">↳ RO Code:</span>
                                <span style="font-weight: 500; color: #f8fafc;">${formatBytes(nodeData.roCode)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 6px; padding-left: 8px;">
                                <span style="color: #64748b;">↳ RO Data:</span>
                                <span style="font-weight: 500; color: #f8fafc;">${formatBytes(nodeData.roData)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">RAM (RW Data):</span>
                                <span style="font-weight: 500; color: #34d399;">${formatBytes(nodeData.rwData)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                <span style="color: #94a3b8;">ROM Share:</span>
                                <span style="font-weight: 600; color: #f472b6;">${percentText}%</span>
                            </div>
                        </div>
                    `;
                } else {
                    // Parent library node
                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Group: ${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Total ROM:</span>
                                <span style="font-weight: 600; color: #a78bfa;">${formatBytes(nodeData.value)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Modules:</span>
                                <span style="font-weight: 500; color: #fff;">${nodeData.children ? nodeData.children.length : 0}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                <span style="color: #94a3b8;">ROM Share:</span>
                                <span style="font-weight: 600; color: #f472b6;">${percentText}%</span>
                            </div>
                        </div>
                    `;
                }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            textStyle: {
                color: '#f8fafc'
            }
        },
        series: [{
            type: 'treemap',
            left: 0,
            right: 0,
            top: 0,
            bottom: 36,
            data: data,
            leafDepth: 1, // Drill down support (click to inspect individual .o)
            roam: 'moveAndZoom',
            nodeClick: 'zoomToNode',
            breadcrumb: {
                show: true,
                height: 32,
                bottom: 0,
                itemStyle: {
                    color: '#1e293b',
                    borderColor: '#334155',
                    borderWidth: 1,
                    textStyle: {
                        color: '#f8fafc',
                        fontFamily: 'Inter',
                        fontSize: 11
                    }
                }
            },
            levels: [
                {
                    itemStyle: {
                        borderColor: '#0f172a',
                        borderWidth: 4,
                        gapWidth: 4
                    }
                },
                {
                    colorSaturation: [0.35, 0.6],
                    itemStyle: {
                        borderColor: '#111827',
                        borderWidth: 2,
                        gapWidth: 2
                    }
                }
            ],
            label: {
                show: true,
                formatter: function(params) {
                    return `${params.name}\n${formatBytes(params.value)}`;
                },
                fontFamily: 'Inter',
                fontSize: 11,
                color: '#ffffff',
                lineHeight: 14
            }
        }]
    };
    
    chartInstance.setOption(option);
}

// Flat list of modules for sorting and rendering in the table
function getFlatModules() {
    const list = [];
    const romSizeTotal = appData.totals.romSize;
    
    for (const groupName in appData.groups) {
        appData.groups[groupName].modules.forEach(m => {
            list.push({
                ...m,
                romPercentage: romSizeTotal > 0 ? (m.romSize / romSizeTotal) * 100 : 0
            });
        });
    }
    
    return list;
}

function updateSortHeaders() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sort-active', 'sort-asc');
        const col = th.getAttribute('data-sort');
        if (col === activeSortColumn) {
            th.classList.add('sort-active');
            if (!activeSortDesc) {
                th.classList.add('sort-asc');
            }
        }
    });
}

function renderTable() {
    if (!appData) return;
    
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    let modules = getFlatModules();
    
    // Apply search filter
    if (searchQuery) {
        modules = modules.filter(m => 
            m.name.toLowerCase().includes(searchQuery) || 
            m.group.toLowerCase().includes(searchQuery)
        );
    }
    
    // Apply sorting
    modules.sort((a, b) => {
        let valA = a[activeSortColumn];
        let valB = b[activeSortColumn];
        
        // Handle string sorting (case insensitive)
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return activeSortDesc ? 1 : -1;
        if (valA > valB) return activeSortDesc ? -1 : 1;
        return 0;
    });
    
    // Render rows
    modules.forEach(m => {
        const tr = document.createElement('tr');
        
        // Zoom to module when row is clicked
        tr.addEventListener('click', () => {
            zoomToModuleInChart(m.group, m.name);
        });
        
        tr.innerHTML = `
            <td><span class="badge badge-library">${m.group}</span></td>
            <td class="col-mono" style="font-weight: 500;">${m.name}</td>
            <td class="col-mono" align="right">${formatNumber(m.roCode)}</td>
            <td class="col-mono" align="right">${formatNumber(m.roData)}</td>
            <td class="col-mono" align="right">${formatNumber(m.rwData)}</td>
            <td class="col-mono" align="right" style="font-weight: 600; color: #a78bfa;">${formatNumber(m.romSize)}</td>
            <td class="col-mono" align="right" style="font-weight: 600; color: #f472b6;">${m.romPercentage.toFixed(2)}%</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Zoom treemap programmatically to a specific library or module
function zoomToModuleInChart(groupName, moduleName) {
    if (!chartInstance) return;
    
    // ECharts treemap drill-down dispatching can be done via action
    // We can zoom to a path: [LibraryName, ModuleName]
    chartInstance.dispatchAction({
        type: 'treemapZoomToNode',
        // ECharts locates nodes by their index paths or matching name path
        targetNodeId: groupName
    });
    
    // Scroll the chart view into focus
    document.getElementById('treemap-chart').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
