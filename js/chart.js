/**
 * ECharts Treemap Rendering Engine & Helpers for IAR Map Visualizer
 */

// Color Palette for Libraries and Top Folders (ROM Treemap)
const ROM_PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
    '#06b6d4', '#14b8a6', '#f43f5e', '#a855f7', '#3b82f6'
];

// Color Palette for RAM Treemap (Emerald/Teal Theme)
const RAM_PALETTE = [
    '#10b981', '#14b8a6', '#06b6d4', '#22c55e', '#84cc16',
    '#059669', '#0d9488', '#0891b2', '#16a34a', '#34d399'
];

/**
 * Builds ECharts Option object for Treemap
 * @param {Array} data Treemap hierarchy nodes
 * @param {string} metric 'rom' | 'ram'
 * @param {string} groupingMode 'none' | 'library' | 'folder'
 * @returns {Object} ECharts Option Configuration
 */
function renderTreemapOption(data, metric = 'rom', groupingMode = 'library') {
    const isRam = metric === 'ram';
    const primaryColor = isRam ? '#10b981' : '#3b82f6';
    const highlightColor = isRam ? '#34d399' : '#a78bfa';
    const shareColor = isRam ? '#34d399' : '#f472b6';
    const breadcrumbBg = isRam ? '#064e3b' : '#1e293b';
    const breadcrumbBorder = isRam ? '#047857' : '#334155';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function (info) {
                const nodeData = info.data;
                if (!nodeData) return info.name;
                
                const percentText = isRam 
                    ? (nodeData.percentage || nodeData.ramPercentage || 0).toFixed(2)
                    : (nodeData.romPercentage || nodeData.percentage || 0).toFixed(2);
                
                if (nodeData.roCode !== undefined) {
                    let groupLabel = 'Group/Library:';
                    let groupVal = nodeData.group || 'Unknown';
                    if (groupingMode === 'folder') {
                        groupLabel = 'EWARM Folder:';
                        groupVal = nodeData.folderPath || groupVal;
                    } else if (groupingMode === 'none') {
                        groupLabel = isRam ? 'RAM Area:' : 'ROM Area:';
                        groupVal = isRam ? (nodeData.ramArea || nodeData.romArea || 'Unknown') : (nodeData.romArea || 'Unknown');
                    }

                    if (isRam) {
                        return `
                            <div style="font-family: Inter, sans-serif; padding: 4px;">
                                <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${nodeData.name}</div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">${groupLabel}</span>
                                    <span style="font-weight: 500; color: #fff;">${groupVal}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">RAM (RW Data):</span>
                                    <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(nodeData.rwData)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total ROM:</span>
                                    <span style="font-weight: 500; color: #a78bfa;">${formatBytes(nodeData.romSize)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                    <span style="color: #94a3b8;">RAM Share:</span>
                                    <span style="font-weight: 600; color: ${shareColor};">${percentText}%</span>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div style="font-family: Inter, sans-serif; padding: 4px;">
                                <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${nodeData.name}</div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">${groupLabel}</span>
                                    <span style="font-weight: 500; color: #fff;">${groupVal}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total ROM:</span>
                                    <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(nodeData.romSize)}</span>
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
                                    <span style="font-weight: 600; color: ${shareColor};">${percentText}%</span>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    let catLabel = 'Group:';
                    if (groupingMode === 'folder') catLabel = 'Folder:';

                    const totalLabel = isRam ? 'Total RAM:' : 'Total ROM:';

                    return `
                        <div style="font-family: Inter, sans-serif; padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${catLabel} ${nodeData.name}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">${totalLabel}</span>
                                <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(nodeData.value)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">Items:</span>
                                <span style="font-weight: 500; color: #fff;">${nodeData.children ? nodeData.children.length : 0}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px;">
                                <span style="color: #94a3b8;">${isRam ? 'RAM Share:' : 'ROM Share:'}</span>
                                <span style="font-weight: 600; color: ${shareColor};">${percentText}%</span>
                            </div>
                        </div>
                    `;
                }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: primaryColor,
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
                    color: breadcrumbBg,
                    borderColor: breadcrumbBorder,
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

/**
 * Disposes list of chart instances safely
 * @param {Array} instancesList Array of { instance, dom }
 * @param {ResizeObserver|null} observer 
 */
function disposeChartInstances(instancesList, observer) {
    instancesList.forEach(item => {
        if (observer && item.dom) {
            observer.unobserve(item.dom);
        }
        if (item.instance) {
            item.instance.dispose();
        }
    });
    return [];
}

/**
 * Render RAM Address Placement Grid (0x1000 Page View)
 * @param {Object} parsedData Result from parseMapFile
 */
function renderRamAddressGrid(parsedData) {
    const rowsContainer = document.getElementById("ram-grid-rows");
    if (!rowsContainer) return;

    rowsContainer.innerHTML = "";

    // 1. Collect all modules with rwData > 0
    const ramModules = [];
    if (parsedData && parsedData.groups) {
        Object.values(parsedData.groups).forEach(grp => {
            if (grp.modules) {
                grp.modules.forEach(mod => {
                    if (mod.rwData > 0) {
                        ramModules.push(mod);
                    }
                });
            }
        });
    }

    if (ramModules.length === 0) {
        rowsContainer.innerHTML = `
            <div class="no-data-overlay" style="padding: 2rem;">
                <i data-lucide="layers" class="no-data-icon"></i>
                <p>No RAM (RW Data) modules found in map file.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // 2. Identify all 0x1000 page bases containing at least one module
    const activePageBasesSet = new Set();
    ramModules.forEach(mod => {
        const start = mod.ramAddress || 0x20000000;
        const end = start + mod.rwData;
        const firstPage = Math.floor(start / 0x1000) * 0x1000;
        const lastPage = Math.floor(Math.max(start, end - 1) / 0x1000) * 0x1000;
        for (let p = firstPage; p <= lastPage; p += 0x1000) {
            activePageBasesSet.add(p);
        }
    });

    const activePageBases = Array.from(activePageBasesSet).sort((a, b) => a - b);

    // Build color map for libraries/groups
    const groupColorMap = {};
    let colorIdx = 0;
    ramModules.forEach(mod => {
        const grpKey = mod.group || 'Default';
        if (!groupColorMap[grpKey]) {
            groupColorMap[grpKey] = RAM_PALETTE[colorIdx % RAM_PALETTE.length];
            colorIdx++;
        }
    });

    // Ensure floating tooltip popup element exists
    let tooltipEl = document.getElementById("ram-grid-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "ram-grid-tooltip";
        tooltipEl.className = "ram-grid-tooltip-popup";
        document.body.appendChild(tooltipEl);
    }

    const formatHex = (num) => "0x" + num.toString(16).padStart(8, '0').toUpperCase().replace(/(.{4})(.{4})/, "$1'$2");

    // 3. Render active 0x1000 page rows and insert gap dividers for non-contiguous unused ranges
    for (let i = 0; i < activePageBases.length; i++) {
        const pageBase = activePageBases[i];

        // Insert gap divider row if there is an address jump between active pages
        if (i > 0) {
            const prevPageBase = activePageBases[i - 1];
            if (pageBase > prevPageBase + 0x1000) {
                const gapStart = prevPageBase + 0x1000;
                const gapEnd = pageBase - 1;
                const gapSizeBytes = gapEnd - gapStart + 1;

                const gapEl = document.createElement("div");
                gapEl.className = "ram-grid-gap-row";
                gapEl.innerHTML = `&ctdot; ${formatHex(gapStart)} &ndash; ${formatHex(gapEnd)} Unused RAM Address Gap (${formatBytes(gapSizeBytes)}) &ctdot;`;
                rowsContainer.appendChild(gapEl);
            }
        }

        const pageEnd = pageBase + 0x0FFF;

        // Find modules overlapping with this 4KB page
        const pageModules = [];
        ramModules.forEach(mod => {
            const modStart = mod.ramAddress || 0x20000000;
            const modEnd = modStart + mod.rwData;

            if (modStart <= pageEnd && modEnd > pageBase) {
                pageModules.push({
                    module: mod,
                    modStart,
                    modEnd,
                    startOffset: Math.max(0, modStart - pageBase),
                    endOffset: Math.min(4096, modEnd - pageBase)
                });
            }
        });

        // Sort overlapping modules by offset
        pageModules.sort((a, b) => a.startOffset - b.startOffset);

        // Build list of contiguous slots (modules + unused spaces) for 0x0000 to 0x0FFF
        const slots = [];
        let currentOffset = 0;

        pageModules.forEach(pm => {
            if (pm.startOffset > currentOffset) {
                // Gap / Unused slot
                slots.push({
                    type: 'unused',
                    startOffset: currentOffset,
                    endOffset: pm.startOffset,
                    bytes: pm.startOffset - currentOffset
                });
            }

            slots.push({
                type: 'module',
                module: pm.module,
                modStart: pm.modStart,
                modEnd: pm.modEnd,
                startOffset: pm.startOffset,
                endOffset: pm.endOffset,
                bytes: pm.endOffset - pm.startOffset
            });

            currentOffset = Math.max(currentOffset, pm.endOffset);
        });

        if (currentOffset < 4096) {
            slots.push({
                type: 'unused',
                startOffset: currentOffset,
                endOffset: 4096,
                bytes: 4096 - currentOffset
            });
        }

        // Construct HTML Row
        const rowEl = document.createElement("div");
        rowEl.className = "ram-grid-row";

        const labelEl = document.createElement("div");
        labelEl.className = "ram-grid-row-label";
        labelEl.textContent = formatHex(pageBase);
        rowEl.appendChild(labelEl);

        const trackEl = document.createElement("div");
        trackEl.className = "ram-grid-track";

        slots.forEach(slot => {
            const blockEl = document.createElement("div");
            const widthPct = ((slot.endOffset - slot.startOffset) / 4096) * 100;
            blockEl.style.width = `${widthPct}%`;

            if (slot.type === 'module') {
                blockEl.className = "ram-grid-block";
                const bgColor = groupColorMap[slot.module.group || 'Default'] || '#10b981';
                blockEl.style.background = bgColor;
                blockEl.textContent = slot.module.name;

                // Tooltip events
                blockEl.addEventListener("mouseenter", (e) => {
                    const startAddrHex = formatHex(slot.modStart);
                    const endAddrHex = formatHex(slot.modEnd - 1);
                    const percentOfPage = ((slot.bytes / 4096) * 100).toFixed(1);
                    
                    tooltipEl.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; color: #34d399;">
                            ${slot.module.name}
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Group / Library:</span>
                            <span style="font-weight: 500;">${slot.module.group || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">RAM Address Range:</span>
                            <span style="font-family: monospace; color: #6ee7b7;">${startAddrHex} – ${endAddrHex}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Module RW Data Size:</span>
                            <span style="font-weight: 600; color: #fff;">${formatBytes(slot.module.rwData)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px;">
                            <span style="color: #94a3b8;">Page Share (4KB):</span>
                            <span style="font-weight: 600; color: #a78bfa;">${percentOfPage}%</span>
                        </div>
                    `;
                    tooltipEl.style.display = "block";
                });
            } else {
                blockEl.className = "ram-grid-block unused";
                blockEl.textContent = widthPct > 8 ? "Unused" : "";

                blockEl.addEventListener("mouseenter", (e) => {
                    const startAddrHex = formatHex(pageBase + slot.startOffset);
                    const endAddrHex = formatHex(pageBase + slot.endOffset - 1);

                    tooltipEl.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; color: #94a3b8;">
                            Unused RAM Space (Empty)
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Address Range:</span>
                            <span style="font-family: monospace; color: #cbd5e1;">${startAddrHex} – ${endAddrHex}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px;">
                            <span style="color: #94a3b8;">Available Free Size:</span>
                            <span style="font-weight: 600; color: #94a3b8;">${formatBytes(slot.bytes)}</span>
                        </div>
                    `;
                    tooltipEl.style.display = "block";
                });
            }

            blockEl.addEventListener("mousemove", (e) => {
                tooltipEl.style.left = (e.clientX + 14) + "px";
                tooltipEl.style.top = (e.clientY + 14) + "px";
            });

            blockEl.addEventListener("mouseleave", () => {
                tooltipEl.style.display = "none";
            });

            trackEl.appendChild(blockEl);
        });

        rowEl.appendChild(trackEl);
        rowsContainer.appendChild(rowEl);
    }
}
