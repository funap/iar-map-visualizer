// Application State
let appData = null; // Parsed map data { groups, totals }
let ewpData = null; // Parsed ewp project data { rootGroups, rootFiles, fileMap }
let activeGroupingMode = 'library'; // 'none' | 'library' | 'folder'
let activeRomAreaDisplayMode = 'single'; // 'single' | 'perArea'
let activeRamGroupingMode = 'library'; // 'none' | 'library' | 'folder'
let activeRamAreaDisplayMode = 'single'; // 'single' | 'perArea'
let mapFileName = '';
let ewpFileName = '';
let activeSortColumn = 'romSize';
let activeSortDesc = true;
let searchQuery = '';
let targetFlashBytes = 256 * 1024; // Default 256KB
let chartInstance = null;
let perAreaChartInstances = []; // [{ areaName, instance, dom, cardDom }]
let ramChartInstance = null;
let perRamAreaChartInstances = []; // [{ areaName, instance, dom, cardDom }]

// Color Palette for Libraries and Top Folders (ROM Treemap)
const PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
    '#06b6d4', '#14b8a6', '#f43f5e', '#a855f7', '#3b82f6'
];

// Color Palette for RAM Treemap (Emerald/Teal Theme)
const RAM_PALETTE = [
    '#10b981', '#14b8a6', '#06b6d4', '#22c55e', '#84cc16',
    '#059669', '#0d9488', '#0891b2', '#16a34a', '#34d399'
];

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initChart();
    lucide.createIcons();
});

function initDOM() {
    const dropzone = document.getElementById('dropzone');
    const miniDropzone = document.getElementById('dropzone-mini');
    const fileInput = document.getElementById('file-input');
    const ewpFileInput = document.getElementById('ewp-file-input');
    const uploadEwpBtn = document.getElementById('upload-ewp-btn');
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const flashBudgetInput = document.getElementById('flash-budget-input');
    const flashBudgetUnit = document.getElementById('flash-budget-unit');
    const searchInput = document.getElementById('search-input');
    
    // Grouping mode buttons
    const btnGroupNone = document.getElementById('group-mode-none');
    const btnGroupLibrary = document.getElementById('group-mode-library');
    const btnGroupFolder = document.getElementById('group-mode-folder');
    
    if (btnGroupNone) {
        btnGroupNone.addEventListener('click', () => setGroupingMode('none'));
    }
    if (btnGroupLibrary) {
        btnGroupLibrary.addEventListener('click', () => setGroupingMode('library'));
    }
    if (btnGroupFolder) {
        btnGroupFolder.addEventListener('click', () => {
            if (!ewpData) {
                if (ewpFileInput) ewpFileInput.click();
                return;
            }
            setGroupingMode('folder');
        });
    }

    // ROM Area Display mode buttons
    const btnAreaSingle = document.getElementById('area-display-single');
    const btnAreaPerArea = document.getElementById('area-display-per-area');

    if (btnAreaSingle) {
        btnAreaSingle.addEventListener('click', () => setRomAreaDisplayMode('single'));
    }
    if (btnAreaPerArea) {
        btnAreaPerArea.addEventListener('click', () => setRomAreaDisplayMode('perArea'));
    }

    // RAM Grouping mode buttons
    const btnRamGroupNone = document.getElementById('ram-group-mode-none');
    const btnRamGroupLibrary = document.getElementById('ram-group-mode-library');
    const btnRamGroupFolder = document.getElementById('ram-group-mode-folder');
    
    if (btnRamGroupNone) {
        btnRamGroupNone.addEventListener('click', () => setRamGroupingMode('none'));
    }
    if (btnRamGroupLibrary) {
        btnRamGroupLibrary.addEventListener('click', () => setRamGroupingMode('library'));
    }
    if (btnRamGroupFolder) {
        btnRamGroupFolder.addEventListener('click', () => {
            if (!ewpData) {
                if (ewpFileInput) ewpFileInput.click();
                return;
            }
            setRamGroupingMode('folder');
        });
    }

    // RAM Area Display mode buttons
    const btnRamAreaSingle = document.getElementById('ram-area-display-single');
    const btnRamAreaPerArea = document.getElementById('ram-area-display-per-area');

    if (btnRamAreaSingle) {
        btnRamAreaSingle.addEventListener('click', () => setRamAreaDisplayMode('single'));
    }
    if (btnRamAreaPerArea) {
        btnRamAreaPerArea.addEventListener('click', () => setRamAreaDisplayMode('perArea'));
    }

    // File inputs
    if (dropzone) dropzone.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => processFileList(e.target.files));
    if (ewpFileInput) {
        ewpFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            const ewpFile = files.find(f => f.name.toLowerCase().endsWith('.ewp'));
            if (!ewpFile) {
                if (files.length > 0) {
                    alert('Please select an IAR project file (.ewp).');
                }
                return;
            }
            readEwpFile(ewpFile, () => {
                if (appData) {
                    setGroupingMode('folder');
                    setRamGroupingMode('folder');
                }
            });
        });
    }
    if (uploadEwpBtn) uploadEwpBtn.addEventListener('click', () => ewpFileInput.click());

    // Drag & Drop for Main Dropzone
    if (dropzone) {
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
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFileList(e.dataTransfer.files);
            }
        });
    }

    // Drag & Drop for Mini Dropzone
    if (miniDropzone) {
        miniDropzone.addEventListener('click', () => fileInput.click());
        miniDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            miniDropzone.classList.add('dragover');
        });
        ['dragleave', 'drop'].forEach(eventName => {
            miniDropzone.addEventListener(eventName, () => {
                miniDropzone.classList.remove('dragover');
            });
        });
        miniDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFileList(e.dataTransfer.files);
            }
        });
    }
    
    // Load sample project data
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', loadSampleData);
    
    // Flash Budget Configurator
    const updateBudget = () => {
        const val = parseFloat(flashBudgetInput.value) || 0;
        const unit = flashBudgetUnit.value;
        const multiplier = unit === 'KB' ? 1024 : 1024 * 1024;
        targetFlashBytes = val * multiplier;
        updateBudgetMeter();
    };
    
    if (flashBudgetInput) flashBudgetInput.addEventListener('input', updateBudget);
    if (flashBudgetUnit) flashBudgetUnit.addEventListener('change', updateBudget);
    
    // Search Filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderTable();
        });
    }
    
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
        perAreaChartInstances.forEach(item => {
            if (item.instance) item.instance.resize();
        });
        if (ramChartInstance) {
            ramChartInstance.resize();
        }
        perRamAreaChartInstances.forEach(item => {
            if (item.instance) item.instance.resize();
        });
    });
}

let chartResizeObserver = null;

function setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') return;

    chartResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                if (entry.target.id === 'treemap-chart') {
                    if (!chartInstance && appData) {
                        chartInstance = echarts.init(entry.target, 'dark', { renderer: 'canvas' });
                        chartInstance.setOption(renderTreemapOption(getChartData()), true);
                    }
                    if (chartInstance) chartInstance.resize();
                } else if (entry.target.id === 'ram-treemap-chart') {
                    if (!ramChartInstance && appData) {
                        ramChartInstance = echarts.init(entry.target, 'dark', { renderer: 'canvas' });
                        ramChartInstance.setOption(renderRamTreemapOption(getRamChartData()), true);
                    }
                    if (ramChartInstance) ramChartInstance.resize();
                } else {
                    const areaItem = perAreaChartInstances.find(item => item.dom === entry.target);
                    if (areaItem && areaItem.instance) {
                        areaItem.instance.resize();
                    }
                    const ramAreaItem = perRamAreaChartInstances.find(item => item.dom === entry.target);
                    if (ramAreaItem && ramAreaItem.instance) {
                        ramAreaItem.instance.resize();
                    }
                }
            }
        }
    });

    const romDom = document.getElementById('treemap-chart');
    if (romDom) chartResizeObserver.observe(romDom);

    const ramDom = document.getElementById('ram-treemap-chart');
    if (ramDom) chartResizeObserver.observe(ramDom);
}

function initChart() {
    setupResizeObserver();
    
    const chartDom = document.getElementById('treemap-chart');
    if (chartDom && chartDom.clientWidth > 0 && chartDom.clientHeight > 0) {
        chartInstance = echarts.init(chartDom, 'dark', { renderer: 'canvas' });
    }
    const ramChartDom = document.getElementById('ram-treemap-chart');
    if (ramChartDom && ramChartDom.clientWidth > 0 && ramChartDom.clientHeight > 0) {
        ramChartInstance = echarts.init(ramChartDom, 'dark', { renderer: 'canvas' });
    }
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
    return (num || 0).toLocaleString();
}

function processFileList(files) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    
    const ewpFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.ewp'));
    const mapFiles = fileArray.filter(f => !f.name.toLowerCase().endsWith('.ewp'));

    let pendingEwp = ewpFiles.length > 0 ? ewpFiles[0] : null;
    let pendingMap = mapFiles.length > 0 ? mapFiles[0] : null;

    if (pendingEwp) {
        readEwpFile(pendingEwp, () => {
            if (pendingMap) {
                readMapFile(pendingMap);
            } else if (appData) {
                setGroupingMode('folder');
            }
        });
    } else if (pendingMap) {
        readMapFile(pendingMap);
    }
}

function readEwpFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseEwpFile(e.target.result);
            ewpData = parsed;
            ewpFileName = file.name;
            updateFileBadges();
            if (callback) callback();
        } catch (err) {
            console.error(err);
            alert('Failed to parse .ewp file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function readMapFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseMapFile(e.target.result);
            const groupCount = Object.keys(parsed.groups).length;
            if (groupCount === 0) {
                alert('Could not find MODULE SUMMARY section or parse data in this map file.');
                return;
            }
            appData = parsed;
            mapFileName = file.name;
            updateFileBadges();
            onDataLoaded();
        } catch (err) {
            console.error(err);
            alert('An error occurred while parsing the map file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function setGroupingMode(mode) {
    activeGroupingMode = mode;
    const btnNone = document.getElementById('group-mode-none');
    const btnLib = document.getElementById('group-mode-library');
    const btnFold = document.getElementById('group-mode-folder');
    
    if (btnNone) btnNone.classList.toggle('active', mode === 'none');
    if (btnLib) btnLib.classList.toggle('active', mode === 'library');
    if (btnFold) btnFold.classList.toggle('active', mode === 'folder');

    const colHeader = document.querySelector('th[data-sort="group"]');
    if (colHeader) {
        if (mode === 'folder') colHeader.innerText = 'EWARM Folder';
        else if (mode === 'none') colHeader.innerText = 'ROM Area';
        else colHeader.innerText = 'Library/Group';
    }
    if (appData) {
        drawTreemap();
        drawRamTreemap();
        renderTable();
    }
}

function setRomAreaDisplayMode(mode) {
    activeRomAreaDisplayMode = mode;
    const btnSingle = document.getElementById('area-display-single');
    const btnPerArea = document.getElementById('area-display-per-area');
    
    if (btnSingle) btnSingle.classList.toggle('active', mode === 'single');
    if (btnPerArea) btnPerArea.classList.toggle('active', mode === 'perArea');

    if (appData) {
        drawTreemap();
        renderTable();
    }
}

function setRamGroupingMode(mode) {
    activeRamGroupingMode = mode;
    const btnNone = document.getElementById('ram-group-mode-none');
    const btnLib = document.getElementById('ram-group-mode-library');
    const btnFold = document.getElementById('ram-group-mode-folder');
    
    if (btnNone) btnNone.classList.toggle('active', mode === 'none');
    if (btnLib) btnLib.classList.toggle('active', mode === 'library');
    if (btnFold) btnFold.classList.toggle('active', mode === 'folder');

    if (appData) {
        drawRamTreemap();
    }
}

function setRamAreaDisplayMode(mode) {
    activeRamAreaDisplayMode = mode;
    const btnSingle = document.getElementById('ram-area-display-single');
    const btnPerArea = document.getElementById('ram-area-display-per-area');
    
    if (btnSingle) btnSingle.classList.toggle('active', mode === 'single');
    if (btnPerArea) btnPerArea.classList.toggle('active', mode === 'perArea');

    if (appData) {
        drawRamTreemap();
    }
}


function updateFileBadges() {
    const mapBadge = document.getElementById('map-file-badge');
    const ewpBadge = document.getElementById('ewp-file-badge');
    if (mapBadge) {
        mapBadge.innerText = mapFileName ? mapFileName : 'None';
        mapBadge.className = mapFileName ? 'file-badge loaded' : 'file-badge';
        mapBadge.title = mapFileName;
    }
    if (ewpBadge) {
        ewpBadge.innerText = ewpFileName ? ewpFileName : 'None';
        ewpBadge.className = ewpFileName ? 'file-badge loaded' : 'file-badge';
        ewpBadge.title = ewpFileName;
    }
}

// Built-in fallback sample data
const SAMPLE_MAP_FALLBACK = `###############################################################################
#
# IAR ELF Linker V8.50.1.245/W32 for ARM
# Copyright 2007-2020 IAR Systems AB.
#
###############################################################################

***************************************************************************
*** PLACEMENT SUMMARY ***

  "A1": place at address 0x08000000 { ro section .text, ro section .rodata };
  "A2": place at address 0x90000000 { ro section .qspi_text, ro section .qspi_rodata };

  Address       Size  Type    Object
  0x08000000   0x1204  code    display.o
  0x08001204   0x0936  code    main.o
  0x08001b3a   0x0914  code    motor.o
  0x0800244e   0x0450  code    sensor.o
  0x0800289e   0x030c  code    utils.o
  0x90000000  0x4500  code    wifi.o

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

const SAMPLE_EWP_FALLBACK = `<?xml version="1.0" encoding="iso-8859-1"?>
<project>
  <fileVersion>3</fileVersion>
  <configuration>
    <name>Debug</name>
  </configuration>
  <group>
    <name>Application</name>
    <group>
      <name>UI</name>
      <file>
        <name>$PROJ_DIR$\\display.c</name>
      </file>
    </group>
    <file>
      <name>$PROJ_DIR$\\main.c</name>
    </file>
    <file>
      <name>$PROJ_DIR$\\utils.c</name>
    </file>
  </group>
  <group>
    <name>Drivers</name>
    <file>
      <name>$PROJ_DIR$\\motor.c</name>
    </file>
    <file>
      <name>$PROJ_DIR$\\sensor.c</name>
    </file>
  </group>
  <group>
    <name>Connectivity</name>
    <file>
      <name>$PROJ_DIR$\\wifi.c</name>
    </file>
  </group>
</project>`;

// Fetch and load sample data (.map and .ewp)
async function loadSampleData() {
    try {
        let mapText = SAMPLE_MAP_FALLBACK;
        let ewpText = SAMPLE_EWP_FALLBACK;

        try {
            const mapRes = await fetch('./sample.map');
            if (mapRes.ok) mapText = await mapRes.text();
        } catch(e) {}

        try {
            const ewpRes = await fetch('./sample.ewp');
            if (ewpRes.ok) ewpText = await ewpRes.text();
        } catch(e) {}

        appData = parseMapFile(mapText);
        ewpData = parseEwpFile(ewpText);
        mapFileName = 'sample.map';
        ewpFileName = 'sample.ewp';
        updateFileBadges();
        setGroupingMode('folder');
        setRamGroupingMode('folder');
        onDataLoaded();
    } catch (err) {
        console.warn('Fetch failed, using built-in fallback sample data:', err);
        appData = parseMapFile(SAMPLE_MAP_FALLBACK);
        ewpData = parseEwpFile(SAMPLE_EWP_FALLBACK);
        mapFileName = 'sample.map';
        ewpFileName = 'sample.ewp';
        updateFileBadges();
        setGroupingMode('folder');
        setRamGroupingMode('folder');
        onDataLoaded();
    }
}

function onDataLoaded() {
    // Show dashboard panel, hide dropzone placeholder instructions
    document.getElementById('welcome-card').classList.add('hidden');
    document.getElementById('main-dashboard').classList.remove('hidden');
    
    updateKPIs();
    updateBudgetMeter();
    drawTreemap();
    drawRamTreemap();
    updateSortHeaders();
    renderTable();

    requestAnimationFrame(() => {
        if (chartInstance) chartInstance.resize();
        if (ramChartInstance) ramChartInstance.resize();
        perAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });
        perRamAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });

        setTimeout(() => {
            if (chartInstance) chartInstance.resize();
            if (ramChartInstance) ramChartInstance.resize();
            perAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });
            perRamAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });
        }, 150);
    });
    
    const panels = document.querySelectorAll('.animate-fade-in');
    panels.forEach(p => {
        p.style.animation = 'none';
        p.offsetHeight; /* trigger reflow */
        p.style.animation = null;
    });
}

function updateKPIs() {
    if (!appData) return;
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
    if (fill) {
        fill.style.width = `${percent}%`;
        fill.className = 'budget-bar-fill';
        if (percent > 90) {
            fill.classList.add('danger');
        } else if (percent > 75) {
            fill.classList.add('warning');
        }
    }
    
    document.getElementById('budget-percent').innerText = `${((romSize / targetFlashBytes) * 100).toFixed(1)}%`;
    document.getElementById('budget-fraction').innerText = `${formatBytes(romSize)} / ${formatBytes(targetFlashBytes)}`;
}

function getDistinctRomAreas() {
    if (!appData) return [];
    const areasSet = new Set();
    for (const grpName in appData.groups) {
        appData.groups[grpName].modules.forEach(m => {
            if (m.romSize > 0) {
                areasSet.add(m.romArea || getRomAreaName(m.address));
            }
        });
    }
    return Array.from(areasSet).sort();
}

function getDistinctRamAreas() {
    if (!appData) return [];
    const areasSet = new Set();
    for (const grpName in appData.groups) {
        appData.groups[grpName].modules.forEach(m => {
            if (m.rwData > 0) {
                areasSet.add(m.ramArea || m.romArea || getRomAreaName(m.ramAddress || m.address));
            }
        });
    }
    return Array.from(areasSet).sort();
}

function disposePerRamAreaCharts() {
    perRamAreaChartInstances.forEach(item => {
        if (chartResizeObserver && item.dom) {
            chartResizeObserver.unobserve(item.dom);
        }
        if (item.instance) {
            item.instance.dispose();
        }
    });
    perRamAreaChartInstances = [];
}

function disposePerAreaCharts() {
    perAreaChartInstances.forEach(item => {
        if (chartResizeObserver && item.dom) {
            chartResizeObserver.unobserve(item.dom);
        }
        if (item.instance) {
            item.instance.dispose();
        }
    });
    perAreaChartInstances = [];
}

function getChartData() {
    if (!appData) return [];
    const treeNodes = buildModuleTree(appData, ewpData, activeGroupingMode, 'rom', null);
    treeNodes.forEach((node, idx) => {
        if (!node.itemStyle) {
            node.itemStyle = {
                color: PALETTE[idx % PALETTE.length]
            };
        }
    });
    return treeNodes;
}

function renderTreemapOption(data) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function (info) {
                const nodeData = info.data;
                if (!nodeData) return info.name;
                
                const percentText = (nodeData.romPercentage || nodeData.percentage || 0).toFixed(2);
                
                if (nodeData.roCode !== undefined) {
                    let groupLabel = 'Group/Library:';
                    let groupVal = nodeData.group || 'Unknown';
                    if (activeGroupingMode === 'folder') {
                        groupLabel = 'EWARM Folder:';
                        groupVal = nodeData.folderPath || groupVal;
                    } else if (activeGroupingMode === 'none') {
                        groupLabel = 'ROM Area:';
                        groupVal = nodeData.romArea || 'Unknown';
                    }

                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">${groupLabel}</span>
                                <span style="font-weight: 500; color: #fff;">${groupVal}</span>
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
                    let catLabel = 'Group:';
                    if (activeGroupingMode === 'folder') catLabel = 'Folder:';

                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${catLabel} ${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Total ROM:</span>
                                <span style="font-weight: 600; color: #a78bfa;">${formatBytes(nodeData.value)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Items:</span>
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
            leafDepth: 1,
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
                },
                {
                    colorSaturation: [0.3, 0.5],
                    itemStyle: {
                        borderColor: '#1e293b',
                        borderWidth: 1,
                        gapWidth: 1
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
}

function drawTreemap() {
    const singleContainer = document.getElementById('treemap-chart');
    const multiContainer = document.getElementById('rom-area-treemaps-container');

    if (activeRomAreaDisplayMode === 'single') {
        if (singleContainer) singleContainer.classList.remove('hidden');
        if (multiContainer) multiContainer.classList.add('hidden');
        disposePerAreaCharts();

        if (!chartInstance && singleContainer && singleContainer.clientWidth > 0) {
            chartInstance = echarts.init(singleContainer, 'dark', { renderer: 'canvas' });
        }
        if (chartInstance) {
            const data = getChartData();
            chartInstance.setOption(renderTreemapOption(data), true);
            chartInstance.resize();
        }
    } else {
        if (singleContainer) singleContainer.classList.add('hidden');
        if (multiContainer) multiContainer.classList.remove('hidden');
        disposePerAreaCharts();

        if (!multiContainer || !appData) return;
        multiContainer.innerHTML = '';

        const romAreas = getDistinctRomAreas();
        let colorIdx = 0;

        romAreas.forEach((areaName, index) => {
            const areaTreeData = buildModuleTree(appData, ewpData, activeGroupingMode, 'rom', areaName);
            if (areaTreeData.length === 0) return;

            let areaSum = 0;
            const calcSum = (nodes) => {
                nodes.forEach(n => {
                    if (n.children && n.children.length > 0) calcSum(n.children);
                    else areaSum += (n.value || 0);
                });
            };
            calcSum(areaTreeData);

            const card = document.createElement('div');
            card.className = 'rom-area-card';
            card.id = `rom-area-card-${index}`;

            const header = document.createElement('div');
            header.className = 'rom-area-card-header';
            header.innerHTML = `
                <div class="rom-area-title">
                    <i data-lucide="cpu" style="width: 16px; height: 16px; stroke: var(--color-primary-light);"></i>
                    ${areaName}
                </div>
                <div class="rom-area-size">${formatBytes(areaSum)}</div>
            `;

            const chartDom = document.createElement('div');
            chartDom.className = 'rom-area-chart';
            chartDom.id = `rom-area-chart-${index}`;

            card.appendChild(header);
            card.appendChild(chartDom);
            multiContainer.appendChild(card);

            const color = PALETTE[colorIdx % PALETTE.length];
            colorIdx++;

            areaTreeData.forEach(n => {
                if (!n.itemStyle) {
                    n.itemStyle = { color: color };
                }
            });

            const instance = echarts.init(chartDom, 'dark', { renderer: 'canvas' });
            instance.setOption(renderTreemapOption(areaTreeData), true);
            perAreaChartInstances.push({ areaName, instance, dom: chartDom, cardDom: card });
            if (chartResizeObserver) chartResizeObserver.observe(chartDom);
        });

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

// Prepare hierarchical ECharts structure for RAM (RW Data)
function getRamChartData() {
    if (!appData) return [];
    const treeNodes = buildModuleTree(appData, ewpData, activeRamGroupingMode, 'ram', null);
    treeNodes.forEach((node, idx) => {
        if (!node.itemStyle) {
            node.itemStyle = {
                color: RAM_PALETTE[idx % RAM_PALETTE.length]
            };
        }
    });
    return treeNodes;
}

function renderRamTreemapOption(data) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function (info) {
                const nodeData = info.data;
                if (!nodeData) return info.name;
                
                const percentText = (nodeData.percentage || nodeData.ramPercentage || 0).toFixed(2);
                
                if (nodeData.roCode !== undefined) {
                    let groupLabel = 'Group/Library:';
                    let groupVal = nodeData.group || 'Unknown';
                    if (activeRamGroupingMode === 'folder') {
                        groupLabel = 'EWARM Folder:';
                        groupVal = nodeData.folderPath || groupVal;
                    } else if (activeRamGroupingMode === 'none') {
                        groupLabel = 'RAM Area:';
                        groupVal = nodeData.ramArea || nodeData.romArea || 'Unknown';
                    }

                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">${groupLabel}</span>
                                <span style="font-weight: 500; color: #fff;">${groupVal}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">RAM (RW Data):</span>
                                <span style="font-weight: 600; color: #34d399;">${formatBytes(nodeData.rwData)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Total ROM:</span>
                                <span style="font-weight: 500; color: #a78bfa;">${formatBytes(nodeData.romSize)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                <span style="color: #94a3b8;">RAM Share:</span>
                                <span style="font-weight: 600; color: #34d399;">${percentText}%</span>
                            </div>
                        </div>
                    `;
                } else {
                    let catLabel = 'Group:';
                    if (activeRamGroupingMode === 'folder') catLabel = 'Folder:';

                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${catLabel} ${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Total RAM:</span>
                                <span style="font-weight: 600; color: #34d399;">${formatBytes(nodeData.value)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Items:</span>
                                <span style="font-weight: 500; color: #fff;">${nodeData.children ? nodeData.children.length : 0}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                <span style="color: #94a3b8;">RAM Share:</span>
                                <span style="font-weight: 600; color: #34d399;">${percentText}%</span>
                            </div>
                        </div>
                    `;
                }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#10b981',
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
            leafDepth: 1,
            roam: 'moveAndZoom',
            nodeClick: 'zoomToNode',
            breadcrumb: {
                show: true,
                height: 32,
                bottom: 0,
                itemStyle: {
                    color: '#064e3b',
                    borderColor: '#047857',
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
                },
                {
                    colorSaturation: [0.3, 0.5],
                    itemStyle: {
                        borderColor: '#1e293b',
                        borderWidth: 1,
                        gapWidth: 1
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
}

function drawRamTreemap() {
    const singleContainer = document.getElementById('ram-treemap-chart');
    const multiContainer = document.getElementById('ram-area-treemaps-container');

    if (activeRamAreaDisplayMode === 'single') {
        if (singleContainer) singleContainer.classList.remove('hidden');
        if (multiContainer) multiContainer.classList.add('hidden');
        disposePerRamAreaCharts();

        if (!ramChartInstance && singleContainer && singleContainer.clientWidth > 0) {
            ramChartInstance = echarts.init(singleContainer, 'dark', { renderer: 'canvas' });
        }
        if (ramChartInstance) {
            const data = getRamChartData();
            ramChartInstance.setOption(renderRamTreemapOption(data), true);
            ramChartInstance.resize();
        }
    } else {
        if (singleContainer) singleContainer.classList.add('hidden');
        if (multiContainer) multiContainer.classList.remove('hidden');
        disposePerRamAreaCharts();

        if (!multiContainer || !appData) return;
        multiContainer.innerHTML = '';

        const ramAreas = getDistinctRamAreas();
        let colorIdx = 0;

        ramAreas.forEach((areaName, index) => {
            const areaTreeData = buildModuleTree(appData, ewpData, activeRamGroupingMode, 'ram', areaName);
            if (areaTreeData.length === 0) return;

            let areaSum = 0;
            const calcSum = (nodes) => {
                nodes.forEach(n => {
                    if (n.children && n.children.length > 0) calcSum(n.children);
                    else areaSum += (n.value || 0);
                });
            };
            calcSum(areaTreeData);

            const card = document.createElement('div');
            card.className = 'rom-area-card';
            card.id = `ram-area-card-${index}`;

            const header = document.createElement('div');
            header.className = 'rom-area-card-header';
            header.innerHTML = `
                <div class="rom-area-title" style="color: var(--color-success);">
                    <i data-lucide="layers" style="width: 16px; height: 16px; stroke: var(--color-success);"></i>
                    ${areaName}
                </div>
                <div class="rom-area-size" style="color: var(--color-success); background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2);">
                    ${formatBytes(areaSum)}
                </div>
            `;

            const chartDom = document.createElement('div');
            chartDom.className = 'rom-area-chart';
            chartDom.id = `ram-area-chart-${index}`;

            card.appendChild(header);
            card.appendChild(chartDom);
            multiContainer.appendChild(card);

            const color = RAM_PALETTE[colorIdx % RAM_PALETTE.length];
            colorIdx++;

            areaTreeData.forEach(n => {
                if (!n.itemStyle) {
                    n.itemStyle = { color: color };
                }
            });

            const instance = echarts.init(chartDom, 'dark', { renderer: 'canvas' });
            instance.setOption(renderRamTreemapOption(areaTreeData), true);
            perRamAreaChartInstances.push({ areaName, instance, dom: chartDom, cardDom: card });
            if (chartResizeObserver) chartResizeObserver.observe(chartDom);
        });

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

// Flat list of modules for sorting and rendering in table
function getFlatModules() {
    if (!appData) return [];
    const list = [];
    const romSizeTotal = appData.totals.romSize;
    const fileMap = ewpData ? ewpData.fileMap : null;
    
    for (const groupName in appData.groups) {
        appData.groups[groupName].modules.forEach(m => {
            const stem = m.name.replace(/\.o$/i, "").replace(/\.[^/.]+$/, "").toLowerCase();
            let folderPath = "";
            if (fileMap && fileMap.has(stem)) {
                folderPath = fileMap.get(stem)[0];
            } else {
                if (m.group && m.group !== "Obj" && m.group !== "Unknown Group") {
                    folderPath = `Libraries & System/${m.group}`;
                } else {
                    folderPath = "Unassigned Modules";
                }
            }
            
            let displayGroup = m.group;
            if (activeGroupingMode === 'folder') {
                displayGroup = folderPath;
            } else if (activeGroupingMode === 'none') {
                displayGroup = m.romArea;
            }

            list.push({
                ...m,
                folderPath: folderPath,
                displayGroup: displayGroup,
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
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let modules = getFlatModules();
    
    // Apply search filter
    if (searchQuery) {
        modules = modules.filter(m => 
            m.name.toLowerCase().includes(searchQuery) || 
            m.group.toLowerCase().includes(searchQuery) ||
            m.folderPath.toLowerCase().includes(searchQuery) ||
            (m.romArea && m.romArea.toLowerCase().includes(searchQuery))
        );
    }
    
    // Apply sorting
    modules.sort((a, b) => {
        let valA = activeSortColumn === 'group' ? a.displayGroup : a[activeSortColumn];
        let valB = activeSortColumn === 'group' ? b.displayGroup : b[activeSortColumn];
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = (valB || '').toLowerCase();
        }
        
        if (valA < valB) return activeSortDesc ? 1 : -1;
        if (valA > valB) return activeSortDesc ? -1 : 1;
        return 0;
    });
    
    // Render rows
    modules.forEach(m => {
        const tr = document.createElement('tr');
        const badgeText = m.displayGroup;
        
        tr.addEventListener('click', () => {
            zoomToModuleInChart(m.group, m.folderPath, m.name, m.romArea);
        });
        
        tr.innerHTML = `
            <td><span class="badge badge-library" title="${badgeText}">${badgeText}</span></td>
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

// Zoom treemap programmatically to a specific library, folder, or module
function zoomToModuleInChart(groupName, folderPath, moduleName, romArea) {
    let targetNodeId = groupName;
    if (activeGroupingMode === 'folder' && folderPath) {
        targetNodeId = folderPath.split('/')[0];
    } else if (activeGroupingMode === 'none') {
        targetNodeId = moduleName;
    }

    if (activeRomAreaDisplayMode === 'single') {
        if (chartInstance) {
            chartInstance.dispatchAction({
                type: 'treemapZoomToNode',
                targetNodeId: targetNodeId
            });
        }
        const singleDom = document.getElementById('treemap-chart');
        if (singleDom) singleDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        const targetArea = romArea || (appData ? getRomAreaName() : '');
        const areaMatch = perAreaChartInstances.find(item => item.areaName === targetArea);
        if (areaMatch) {
            areaMatch.instance.dispatchAction({
                type: 'treemapZoomToNode',
                targetNodeId: targetNodeId
            });
            if (areaMatch.cardDom) {
                areaMatch.cardDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    if (activeRamAreaDisplayMode === 'single') {
        if (ramChartInstance) {
            let ramTargetNodeId = groupName;
            if (activeRamGroupingMode === 'folder' && folderPath) {
                ramTargetNodeId = folderPath.split('/')[0];
            } else if (activeRamGroupingMode === 'none') {
                ramTargetNodeId = moduleName;
            }
            ramChartInstance.dispatchAction({
                type: 'treemapZoomToNode',
                targetNodeId: ramTargetNodeId
            });
        }
    } else {
        const targetArea = romArea || (appData ? getRomAreaName() : '');
        const areaMatch = perRamAreaChartInstances.find(item => item.areaName === targetArea);
        if (areaMatch) {
            let ramTargetNodeId = groupName;
            if (activeRamGroupingMode === 'folder' && folderPath) {
                ramTargetNodeId = folderPath.split('/')[0];
            } else if (activeRamGroupingMode === 'none') {
                ramTargetNodeId = moduleName;
            }
            areaMatch.instance.dispatchAction({
                type: 'treemapZoomToNode',
                targetNodeId: ramTargetNodeId
            });
            if (areaMatch.cardDom) {
                areaMatch.cardDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}


