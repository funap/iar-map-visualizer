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
let chartResizeObserver = null;

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initChart();
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
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
    
    // ROM Grouping mode buttons
    const btnGroupNone = document.getElementById('group-mode-none');
    const btnGroupLibrary = document.getElementById('group-mode-library');
    const btnGroupFolder = document.getElementById('group-mode-folder');
    
    if (btnGroupNone) btnGroupNone.addEventListener('click', () => setGroupingMode('none'));
    if (btnGroupLibrary) btnGroupLibrary.addEventListener('click', () => setGroupingMode('library'));
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

    if (btnAreaSingle) btnAreaSingle.addEventListener('click', () => setRomAreaDisplayMode('single'));
    if (btnAreaPerArea) btnAreaPerArea.addEventListener('click', () => setRomAreaDisplayMode('perArea'));

    // RAM Grouping mode buttons
    const btnRamGroupNone = document.getElementById('ram-group-mode-none');
    const btnRamGroupLibrary = document.getElementById('ram-group-mode-library');
    const btnRamGroupFolder = document.getElementById('ram-group-mode-folder');
    
    if (btnRamGroupNone) btnRamGroupNone.addEventListener('click', () => setRamGroupingMode('none'));
    if (btnRamGroupLibrary) btnRamGroupLibrary.addEventListener('click', () => setRamGroupingMode('library'));
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

    if (btnRamAreaSingle) btnRamAreaSingle.addEventListener('click', () => setRamAreaDisplayMode('single'));
    if (btnRamAreaPerArea) btnRamAreaPerArea.addEventListener('click', () => setRamAreaDisplayMode('perArea'));

    // File inputs
    if (dropzone) dropzone.addEventListener('click', () => fileInput.click());
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            processFileList(e.target.files);
            e.target.value = '';
        });
    }
    // Load .ewp File Button (Strictly accepts ONLY .ewp files)
    if (uploadEwpBtn) {
        uploadEwpBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.ewp,.EWP';
            input.onchange = (e) => {
                const files = Array.from(e.target.files || []);
                const ewpFile = files.find(f => f.name.toLowerCase().endsWith('.ewp'));
                if (ewpFile) {
                    loadEwpFileOnly(ewpFile);
                } else if (files.length > 0) {
                    alert('Only IAR project files (.ewp) can be selected here. .map files are ignored.');
                }
            };
            input.click();
        });
    }

    if (ewpFileInput) {
        ewpFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            const ewpFile = files.find(f => f.name.toLowerCase().endsWith('.ewp'));
            if (ewpFile) {
                loadEwpFileOnly(ewpFile);
            }
            e.target.value = '';
        });
    }

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
    
    // Load sample project data button
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', loadSampleData);
    
    // Flash Budget Configurator
    const updateBudget = () => {
        const rawVal = parseFloat(flashBudgetInput.value);
        const val = Number.isFinite(rawVal) && rawVal > 0 ? rawVal : 0;
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
        if (chartInstance) chartInstance.resize();
        perAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });
        if (ramChartInstance) ramChartInstance.resize();
        perRamAreaChartInstances.forEach(item => { if (item.instance) item.instance.resize(); });
    });
}

function setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined' || typeof echarts === 'undefined') return;

    chartResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                if (entry.target.id === 'treemap-chart') {
                    if (!chartInstance && appData) {
                        chartInstance = echarts.init(entry.target, 'dark', { renderer: 'canvas' });
                        chartInstance.setOption(renderTreemapOption(getChartData('rom'), 'rom', activeGroupingMode), true);
                    }
                    if (chartInstance) chartInstance.resize();
                } else if (entry.target.id === 'ram-treemap-chart') {
                    if (!ramChartInstance && appData) {
                        ramChartInstance = echarts.init(entry.target, 'dark', { renderer: 'canvas' });
                        ramChartInstance.setOption(renderTreemapOption(getChartData('ram'), 'ram', activeRamGroupingMode), true);
                    }
                    if (ramChartInstance) ramChartInstance.resize();
                } else {
                    const areaItem = perAreaChartInstances.find(item => item.dom === entry.target);
                    if (areaItem && areaItem.instance) areaItem.instance.resize();
                    const ramAreaItem = perRamAreaChartInstances.find(item => item.dom === entry.target);
                    if (ramAreaItem && ramAreaItem.instance) ramAreaItem.instance.resize();
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
    if (typeof echarts === 'undefined') return;
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
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1) return `${parseFloat(bytes.toFixed(2))} B`;
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format number with commas
function formatNumber(num) {
    return (num || 0).toLocaleString();
}

function processFileList(files) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    
    const ewpFile = fileArray.find(f => f.name.toLowerCase().endsWith('.ewp'));
    const mapFile = fileArray.find(f => f.name.toLowerCase().endsWith('.map'))
        || fileArray.find(f => !f.name.toLowerCase().endsWith('.ewp'));

    // Case 1: Both .ewp and .map dropped/selected simultaneously
    if (ewpFile && mapFile) {
        readEwpFile(ewpFile, () => {
            readMapFile(mapFile, true);
        });
    } 
    // Case 2: Only .ewp file dropped/selected
    else if (ewpFile) {
        readEwpFile(ewpFile, () => {
            if (appData) {
                setGroupingMode('folder');
                setRamGroupingMode('folder');
            } else {
                // Prompt user to select .map file next only when no map is loaded yet
                promptForMapFileAfterEwp();
            }
        });
    } 
    // Case 3: Only .map file dropped/selected
    else if (mapFile) {
        readMapFile(mapFile);
    }
}

/**
 * Automatically triggers file selector to open .map file after .ewp file is loaded.
 */
function promptForMapFileAfterEwp() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.map,.MAP';
    input.onchange = (e) => {
        const files = Array.from(e.target.files || []);
        const mapFile = files.find(f => f.name.toLowerCase().endsWith('.map'))
            || files.find(f => !f.name.toLowerCase().endsWith('.ewp'));
        if (mapFile) {
            readMapFile(mapFile, !!ewpData);
        }
    };
    input.click();
}

/**
 * Dedicated function to load and apply an IAR project (.ewp) file only.
 * @param {File} file 
 */
function loadEwpFileOnly(file) {
    readEwpFile(file, () => {
        if (appData) {
            setGroupingMode('folder');
            setRamGroupingMode('folder');
        }
    });
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

function readMapFile(file, activateFolderMode = false) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseMapFile(e.target.result);
            const groupCount = Object.keys(parsed.groups).length;
            if (groupCount === 0) {
                alert('Could not find MODULE SUMMARY section or parse data in this map file.');
                return;
            }
            if (activateFolderMode) {
                syncGroupingModeUI('folder');
                syncRamGroupingModeUI('folder');
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

function syncGroupingModeUI(mode) {
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
}

function setGroupingMode(mode) {
    syncGroupingModeUI(mode);
    if (appData) {
        drawTreemap();
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

function syncRamGroupingModeUI(mode) {
    activeRamGroupingMode = mode;
    const btnNone = document.getElementById('ram-group-mode-none');
    const btnLib = document.getElementById('ram-group-mode-library');
    const btnFold = document.getElementById('ram-group-mode-folder');
    
    if (btnNone) btnNone.classList.toggle('active', mode === 'none');
    if (btnLib) btnLib.classList.toggle('active', mode === 'library');
    if (btnFold) btnFold.classList.toggle('active', mode === 'folder');
}

function setRamGroupingMode(mode) {
    syncRamGroupingModeUI(mode);
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
    renderRamAddressGrid(appData);
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
    const rwCode = appData.totals.rwCode || 0;
    const ramSize = appData.totals.ramSize !== undefined ? appData.totals.ramSize : (rwData + rwCode);
    
    document.getElementById('kpi-rom').innerText = formatBytes(romSize);
    document.getElementById('kpi-rom-bytes').innerText = `${formatNumber(romSize)} B`;
    
    document.getElementById('kpi-code').innerText = formatBytes(roCode);
    const codePercent = romSize > 0 ? ((roCode / romSize) * 100).toFixed(1) : '0';
    document.getElementById('kpi-code-sub').innerText = `${codePercent}% of ROM`;
    
    document.getElementById('kpi-data').innerText = formatBytes(roData);
    const dataPercent = romSize > 0 ? ((roData / romSize) * 100).toFixed(1) : '0';
    document.getElementById('kpi-data-sub').innerText = `${dataPercent}% of ROM`;
    
    document.getElementById('kpi-ram').innerText = formatBytes(ramSize);
    document.getElementById('kpi-ram-sub').innerText = rwCode > 0
        ? `${formatNumber(ramSize)} bytes (${formatNumber(rwData)} data + ${formatNumber(rwCode)} code)`
        : `${formatNumber(ramSize)} bytes used`;
}

function updateBudgetMeter() {
    if (!appData) return;
    
    const romSize = appData.totals.romSize;
    const validTarget = Number.isFinite(targetFlashBytes) && targetFlashBytes > 0;
    const rawPercent = validTarget ? (romSize / targetFlashBytes) * 100 : 0;
    const clampedPercent = validTarget ? Math.max(0, Math.min(rawPercent, 100)) : 0;
    
    const fill = document.getElementById('budget-fill');
    if (fill) {
        fill.style.width = `${clampedPercent}%`;
        fill.className = 'budget-bar-fill';
        if (validTarget) {
            if (rawPercent > 90) {
                fill.classList.add('danger');
            } else if (rawPercent > 75) {
                fill.classList.add('warning');
            }
        }
    }
    
    document.getElementById('budget-percent').innerText = validTarget ? `${rawPercent.toFixed(1)}%` : '—';
    document.getElementById('budget-fraction').innerText = `${formatBytes(romSize)} / ${validTarget ? formatBytes(targetFlashBytes) : '—'}`;
}

function getDistinctAreas(metric = 'rom') {
    if (!appData) return [];
    const areasSet = new Set();
    for (const grpName in appData.groups) {
        appData.groups[grpName].modules.forEach(m => {
            const ramBytes = m.ramSize !== undefined ? m.ramSize : ((m.rwData || 0) + (m.rwCode || 0));
            const mSize = metric === 'ram' ? ramBytes : m.romSize;
            if (mSize > 0) {
                const fallbackRamAddr = (m.ramAddress !== undefined && m.ramAddress !== null) ? m.ramAddress : m.address;
                const area = metric === 'ram' 
                    ? (m.ramArea || m.romArea || getRomAreaName(fallbackRamAddr))
                    : (m.romArea || getRomAreaName(m.address));
                areasSet.add(area);
            }
        });
    }
    return Array.from(areasSet).sort();
}

function getChartData(metric = 'rom') {
    if (!appData) return [];
    const grouping = metric === 'ram' ? activeRamGroupingMode : activeGroupingMode;
    const treeNodes = buildModuleTree(appData, ewpData, grouping, metric, null);
    const palette = metric === 'ram' ? RAM_PALETTE : ROM_PALETTE;
    
    treeNodes.forEach((node, idx) => {
        if (!node.itemStyle) {
            node.itemStyle = {
                color: palette[idx % palette.length]
            };
        }
    });
    return treeNodes;
}

// Unified renderer for ROM & RAM Treemaps
function drawTreemapView(metric = 'rom') {
    if (typeof echarts === 'undefined') return;
    const isRam = metric === 'ram';
    const singleContainer = document.getElementById(isRam ? 'ram-treemap-chart' : 'treemap-chart');
    const multiContainer = document.getElementById(isRam ? 'ram-area-treemaps-container' : 'rom-area-treemaps-container');
    const displayMode = isRam ? activeRamAreaDisplayMode : activeRomAreaDisplayMode;
    const groupingMode = isRam ? activeRamGroupingMode : activeGroupingMode;

    if (displayMode === 'single') {
        if (singleContainer) singleContainer.classList.remove('hidden');
        if (multiContainer) multiContainer.classList.add('hidden');
        
        if (isRam) {
            perRamAreaChartInstances = disposeChartInstances(perRamAreaChartInstances, chartResizeObserver);
            if (!ramChartInstance && singleContainer && singleContainer.clientWidth > 0) {
                ramChartInstance = echarts.init(singleContainer, 'dark', { renderer: 'canvas' });
            }
            if (ramChartInstance) {
                const data = getChartData('ram');
                ramChartInstance.setOption(renderTreemapOption(data, 'ram', groupingMode), true);
                ramChartInstance.resize();
            }
        } else {
            perAreaChartInstances = disposeChartInstances(perAreaChartInstances, chartResizeObserver);
            if (!chartInstance && singleContainer && singleContainer.clientWidth > 0) {
                chartInstance = echarts.init(singleContainer, 'dark', { renderer: 'canvas' });
            }
            if (chartInstance) {
                const data = getChartData('rom');
                chartInstance.setOption(renderTreemapOption(data, 'rom', groupingMode), true);
                chartInstance.resize();
            }
        }
    } else {
        if (singleContainer) singleContainer.classList.add('hidden');
        if (multiContainer) multiContainer.classList.remove('hidden');

        if (isRam) {
            perRamAreaChartInstances = disposeChartInstances(perRamAreaChartInstances, chartResizeObserver);
        } else {
            perAreaChartInstances = disposeChartInstances(perAreaChartInstances, chartResizeObserver);
        }

        if (!multiContainer || !appData) return;
        multiContainer.innerHTML = '';

        const areas = getDistinctAreas(metric);
        const palette = isRam ? RAM_PALETTE : ROM_PALETTE;
        let colorIdx = 0;

        areas.forEach((areaName, index) => {
            const areaTreeData = buildModuleTree(appData, ewpData, groupingMode, metric, areaName);
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
            card.id = isRam ? `ram-area-card-${index}` : `rom-area-card-${index}`;

            const safeAreaName = typeof escapeHtml === 'function' ? escapeHtml(areaName) : areaName;
            const header = document.createElement('div');
            header.className = 'rom-area-card-header';
            if (isRam) {
                header.innerHTML = `
                    <div class="rom-area-title" style="color: var(--color-success);">
                        <i data-lucide="layers" style="width: 16px; height: 16px; stroke: var(--color-success);"></i>
                        ${safeAreaName}
                    </div>
                    <div class="rom-area-size" style="color: var(--color-success); background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2);">
                        ${formatBytes(areaSum)}
                    </div>
                `;
            } else {
                header.innerHTML = `
                    <div class="rom-area-title">
                        <i data-lucide="cpu" style="width: 16px; height: 16px; stroke: var(--color-primary-light);"></i>
                        ${safeAreaName}
                    </div>
                    <div class="rom-area-size">${formatBytes(areaSum)}</div>
                `;
            }

            const chartDom = document.createElement('div');
            chartDom.className = 'rom-area-chart';
            chartDom.id = isRam ? `ram-area-chart-${index}` : `rom-area-chart-${index}`;

            card.appendChild(header);
            card.appendChild(chartDom);
            multiContainer.appendChild(card);

            const color = palette[colorIdx % palette.length];
            colorIdx++;

            areaTreeData.forEach(n => {
                if (!n.itemStyle) {
                    n.itemStyle = { color: color };
                }
            });

            const instance = echarts.init(chartDom, 'dark', { renderer: 'canvas' });
            instance.setOption(renderTreemapOption(areaTreeData, metric, groupingMode), true);
            
            const targetArray = isRam ? perRamAreaChartInstances : perAreaChartInstances;
            targetArray.push({ areaName, instance, dom: chartDom, cardDom: card });
            if (chartResizeObserver) chartResizeObserver.observe(chartDom);
        });

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

function drawTreemap() {
    drawTreemapView('rom');
}

function drawRamTreemap() {
    drawTreemapView('ram');
}

// Flat list of modules for sorting and rendering in table
function getFlatModules() {
    if (!appData) return [];
    const list = [];
    const romSizeTotal = appData.totals.romSize;
    const activeConfig = inferActiveEwpConfig(ewpData, appData);
    
    for (const groupName in appData.groups) {
        appData.groups[groupName].modules.forEach(m => {
            const folderPath = resolveModuleFolderPath(m, ewpData, appData, activeConfig);
            
            let displayGroup = m.group;
            if (activeGroupingMode === 'folder') {
                displayGroup = folderPath;
            } else if (activeGroupingMode === 'none') {
                displayGroup = m.romArea;
            }

            list.push({
                ...m,
                rwCode: m.rwCode || 0,
                ramSize: m.ramSize !== undefined ? m.ramSize : ((m.rwData || 0) + (m.rwCode || 0)),
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

    const hasRwCode = (appData.totals.rwCode || 0) > 0;
    const rwCodeTh = document.getElementById('th-rw-code');
    if (rwCodeTh) {
        rwCodeTh.classList.toggle('hidden', !hasRwCode);
    }
    if (!hasRwCode && activeSortColumn === 'rwCode') {
        activeSortColumn = 'romSize';
        activeSortDesc = true;
        updateSortHeaders();
    }
    
    let modules = getFlatModules();
    
    // Apply search filter
    if (searchQuery) {
        modules = modules.filter(m => 
            m.name.toLowerCase().includes(searchQuery) || 
            m.group.toLowerCase().includes(searchQuery) ||
            m.folderPath.toLowerCase().includes(searchQuery) ||
            (m.romArea && m.romArea.toLowerCase().includes(searchQuery)) ||
            (m.ramArea && m.ramArea.toLowerCase().includes(searchQuery))
        );
    }
    
    // Apply sorting
    modules.sort((a, b) => {
        let valA = activeSortColumn === 'group' ? a.displayGroup : a[activeSortColumn];
        let valB = activeSortColumn === 'group' ? b.displayGroup : b[activeSortColumn];
        
        if (typeof valA === 'string' || typeof valB === 'string') {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        } else {
            valA = valA !== undefined && valA !== null ? valA : 0;
            valB = valB !== undefined && valB !== null ? valB : 0;
        }
        
        if (valA < valB) return activeSortDesc ? 1 : -1;
        if (valA > valB) return activeSortDesc ? -1 : 1;
        return 0;
    });
    
    // Render rows
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (v) => String(v || '');
    modules.forEach(m => {
        const tr = document.createElement('tr');
        const safeBadge = esc(m.displayGroup);
        const safeName = esc(m.name);
        
        tr.addEventListener('click', () => {
            zoomToModuleInChart(m.group, m.folderPath, m.name, m.romArea, m.ramArea, m.romSize, m.ramSize);
        });
        
        tr.innerHTML = `
            <td><span class="badge badge-library" title="${safeBadge}">${safeBadge}</span></td>
            <td class="col-mono" style="font-weight: 500;">${safeName}</td>
            <td class="col-mono" align="right">${formatNumber(m.roCode)}</td>
            <td class="col-mono${hasRwCode ? '' : ' hidden'}" align="right">${formatNumber(m.rwCode || 0)}</td>
            <td class="col-mono" align="right">${formatNumber(m.roData)}</td>
            <td class="col-mono" align="right">${formatNumber(m.rwData)}</td>
            <td class="col-mono" align="right" style="font-weight: 600; color: #a78bfa;">${formatNumber(m.romSize)}</td>
            <td class="col-mono" align="right" style="font-weight: 600; color: #f472b6;">${m.romPercentage.toFixed(2)}%</td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Resolves the ECharts node id to zoom onto for a given grouping mode and module metadata.
 * @param {string} mode
 * @param {string} groupName
 * @param {string} folderPath
 * @param {string} moduleName
 * @returns {string}
 */
function getZoomTargetNodeId(mode, groupName, folderPath, moduleName) {
    if (mode === 'folder' && folderPath) {
        return folderPath;
    }
    if (mode === 'none') {
        return `${groupName}::${moduleName}`;
    }
    return groupName;
}

// Zoom treemap programmatically to a specific library, folder, or module
function zoomToModuleInChart(groupName, folderPath, moduleName, romArea, ramArea, romSize, ramSize) {
    const hasRom = (romSize === undefined || romSize > 0);
    const hasRam = (ramSize === undefined || ramSize > 0);
    let primaryScrollEl = null;

    if (hasRom) {
        const romTargetNodeId = getZoomTargetNodeId(activeGroupingMode, groupName, folderPath, moduleName);
        if (activeRomAreaDisplayMode === 'single') {
            if (chartInstance) {
                chartInstance.dispatchAction({
                    type: 'treemapZoomToNode',
                    targetNodeId: romTargetNodeId
                });
            }
            primaryScrollEl = document.getElementById('treemap-chart');
        } else {
            const targetRomArea = romArea || (appData ? getRomAreaName() : '');
            const areaMatch = perAreaChartInstances.find(item => item.areaName === targetRomArea);
            if (areaMatch) {
                areaMatch.instance.dispatchAction({
                    type: 'treemapZoomToNode',
                    targetNodeId: romTargetNodeId
                });
                if (areaMatch.cardDom) {
                    primaryScrollEl = areaMatch.cardDom;
                }
            }
        }
    }

    if (hasRam) {
        const ramTargetNodeId = getZoomTargetNodeId(activeRamGroupingMode, groupName, folderPath, moduleName);
        if (activeRamAreaDisplayMode === 'single') {
            if (ramChartInstance) {
                ramChartInstance.dispatchAction({
                    type: 'treemapZoomToNode',
                    targetNodeId: ramTargetNodeId
                });
            }
            if (!primaryScrollEl) {
                primaryScrollEl = document.getElementById('ram-treemap-chart');
            }
        } else {
            const targetRamArea = ramArea || romArea || (appData ? getRomAreaName(0x20000000) : '');
            const areaMatch = perRamAreaChartInstances.find(item => item.areaName === targetRamArea);
            if (areaMatch) {
                areaMatch.instance.dispatchAction({
                    type: 'treemapZoomToNode',
                    targetNodeId: ramTargetNodeId
                });
                if (!primaryScrollEl && areaMatch.cardDom) {
                    primaryScrollEl = areaMatch.cardDom;
                }
            }
        }
    }

    if (primaryScrollEl) {
        primaryScrollEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
