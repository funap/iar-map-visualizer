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
 * Escapes HTML if parser.js escapeHtml is not available in scope.
 * @param {*} value
 * @returns {string}
 */
function safeEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Formats hex address safely across 32-bit and wider address spaces.
 * @param {number} num
 * @returns {string}
 */
function safeFormatHex(num) {
    if (typeof formatHexAddress === 'function') return formatHexAddress(num);
    const safe = Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
    const rawHex = safe.toString(16).toUpperCase();
    const minLen = rawHex.length <= 8 ? 8 : Math.ceil(rawHex.length / 4) * 4;
    return "0x" + rawHex.padStart(minLen, '0').replace(/\B(?=(\w{4})+(?!\w))/g, "'");
}

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
                if (!nodeData) return safeEscapeHtml(info.name || '');

                // Use area-relative percentage when available (matches displayed chart in both Single and Split-by-Area modes)
                const rawPct = nodeData.percentage !== undefined
                    ? nodeData.percentage
                    : (isRam ? nodeData.ramPercentage : nodeData.romPercentage);
                const percentText = Number(rawPct || 0).toFixed(2);
                const safeName = safeEscapeHtml(nodeData.name || '');

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
                    const safeGroupVal = safeEscapeHtml(groupVal);
                    const rwCodeVal = nodeData.rwCode || 0;
                    const rwDataVal = nodeData.rwData || 0;
                    const ramBytes = nodeData.ramSize !== undefined ? nodeData.ramSize : (rwDataVal + rwCodeVal);
                    const rwCodeBreakdownHtml = rwCodeVal > 0 ? `
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px; padding-left: 8px;">
                                    <span style="color: #64748b;">↳ RW Data:</span>
                                    <span style="font-weight: 500; color: #f8fafc;">${formatBytes(rwDataVal)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 4px; padding-left: 8px;">
                                    <span style="color: #64748b;">↳ RW Code:</span>
                                    <span style="font-weight: 500; color: #f8fafc;">${formatBytes(rwCodeVal)}</span>
                                </div>` : '';

                    if (isRam) {
                        return `
                            <div style="font-family: Inter, sans-serif; padding: 4px;">
                                <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${safeName}</div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">${groupLabel}</span>
                                    <span style="font-weight: 500; color: #fff;">${safeGroupVal}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total RAM (RW):</span>
                                    <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(ramBytes)}</span>
                                </div>
                                ${rwCodeBreakdownHtml}
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total ROM:</span>
                                    <span style="font-weight: 500; color: #a78bfa;">${formatBytes(nodeData.romSize || 0)}</span>
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
                                <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${safeName}</div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">${groupLabel}</span>
                                    <span style="font-weight: 500; color: #fff;">${safeGroupVal}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total ROM:</span>
                                    <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(nodeData.romSize || 0)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px; padding-left: 8px;">
                                    <span style="color: #64748b;">↳ RO Code:</span>
                                    <span style="font-weight: 500; color: #f8fafc;">${formatBytes(nodeData.roCode || 0)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 6px; padding-left: 8px;">
                                    <span style="color: #64748b;">↳ RO Data:</span>
                                    <span style="font-weight: 500; color: #f8fafc;">${formatBytes(nodeData.roData || 0)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-bottom: 2px;">
                                    <span style="color: #94a3b8;">Total RAM (RW):</span>
                                    <span style="font-weight: 500; color: #34d399;">${formatBytes(ramBytes)}</span>
                                </div>
                                ${rwCodeBreakdownHtml}
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
                            <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${catLabel} ${safeName}</div>
                            <div style="display: flex; justify-content: space-between; gap: 20px; font-size: 12px; margin-bottom: 2px;">
                                <span style="color: #94a3b8;">${totalLabel}</span>
                                <span style="font-weight: 600; color: ${highlightColor};">${formatBytes(nodeData.value || 0)}</span>
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
                    return `${params.name || ''}\n${formatBytes(params.value || 0)}`;
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
 * Positions the floating RAM grid tooltip inside the viewport.
 * @param {HTMLElement} tooltipEl
 * @param {MouseEvent} e
 */
function positionRamTooltip(tooltipEl, e) {
    const pad = 12;
    let left = e.clientX + 14;
    let top = e.clientY + 14;
    const rect = tooltipEl.getBoundingClientRect();
    if (left + rect.width + pad > window.innerWidth) {
        left = Math.max(pad, e.clientX - rect.width - 14);
    }
    if (top + rect.height + pad > window.innerHeight) {
        top = Math.max(pad, e.clientY - rect.height - 14);
    }
    tooltipEl.style.left = left + "px";
    tooltipEl.style.top = top + "px";
}

/**
 * Render RAM Address Placement Grid (0x1000 Page View)
 * Uses exact per-section RAM intervals from PLACEMENT SUMMARY when available
 * and positions blocks absolutely by 4KB offset to align strictly with the ruler.
 * @param {Object} parsedData Result from parseMapFile
 */
function renderRamAddressGrid(parsedData) {
    const rowsContainer = document.getElementById("ram-grid-rows");
    if (!rowsContainer) return;

    rowsContainer.innerHTML = "";

    // 1. Collect per-section or fallback RAM segments for all RAM-consuming modules
    const ramModules = [];
    const ramSegments = [];
    const seenSegments = new Set();

    if (parsedData && parsedData.groups) {
        Object.values(parsedData.groups).forEach(grp => {
            if (grp.modules) {
                grp.modules.forEach(mod => {
                    const modRamBytes = mod.ramSize !== undefined ? mod.ramSize : ((mod.rwData || 0) + (mod.rwCode || 0));
                    if (modRamBytes <= 0) return;

                    ramModules.push(mod);

                    if (mod.ramSections && mod.ramSections.length > 0) {
                        mod.ramSections.forEach(sec => {
                            if (sec.size <= 0 || !Number.isFinite(sec.address)) return;
                            const dedupKey = mod.isLinkerCreated
                                ? `linker:${sec.address}:${sec.size}:${sec.section}`
                                : `${mod.groupFull || mod.group}:${mod.name}:${sec.address}:${sec.size}:${sec.section}`;
                            if (seenSegments.has(dedupKey)) return;
                            seenSegments.add(dedupKey);

                            ramSegments.push({
                                module: mod,
                                start: sec.address,
                                end: sec.address + sec.size,
                                segSize: sec.size,
                                sectionName: sec.section || "",
                                kind: sec.kind || ""
                            });
                        });
                    } else if (mod.ramAddress !== undefined && mod.ramAddress !== null && Number.isFinite(mod.ramAddress)) {
                        ramSegments.push({
                            module: mod,
                            start: mod.ramAddress,
                            end: mod.ramAddress + modRamBytes,
                            segSize: modRamBytes,
                            sectionName: "",
                            kind: ""
                        });
                    }
                });
            }
        });
    }

    if (ramModules.length === 0 || ramSegments.length === 0) {
        rowsContainer.innerHTML = `
            <div class="no-data-overlay" style="padding: 2rem;">
                <i data-lucide="layers" class="no-data-icon"></i>
                <p>No placed RAM (RW Data / RW Code) sections found in map file.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // 2. Identify all 0x1000 page bases containing at least one RAM segment
    const activePageBasesSet = new Set();
    ramSegments.forEach(seg => {
        const firstPage = Math.floor(seg.start / 0x1000) * 0x1000;
        const lastPage = Math.floor(Math.max(seg.start, seg.end - 1) / 0x1000) * 0x1000;
        // Guard against corrupt multi-hundred-MB spans freezing DOM rendering
        const maxPagesPerSeg = 4096;
        let pagesRendered = 0;
        for (let p = firstPage; p <= lastPage && pagesRendered < maxPagesPerSeg; p += 0x1000) {
            activePageBasesSet.add(p);
            pagesRendered++;
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
                gapEl.innerHTML = `&ctdot; ${safeFormatHex(gapStart)} &ndash; ${safeFormatHex(gapEnd)} Unused RAM Address Gap (${formatBytes(gapSizeBytes)}) &ctdot;`;
                rowsContainer.appendChild(gapEl);
            }
        }

        const pageEnd = pageBase + 0x0FFF;

        // Find RAM segments intersecting this 4KB page
        const pageSegments = [];
        ramSegments.forEach(seg => {
            if (seg.start <= pageEnd && seg.end > pageBase) {
                pageSegments.push({
                    module: seg.module,
                    segStart: seg.start,
                    segEnd: seg.end,
                    segSize: seg.segSize,
                    sectionName: seg.sectionName,
                    kind: seg.kind,
                    startOffset: Math.max(0, seg.start - pageBase),
                    endOffset: Math.min(4096, seg.end - pageBase)
                });
            }
        });

        pageSegments.sort((a, b) => (a.startOffset - b.startOffset) || (b.endOffset - a.endOffset));

        // Build union-complement unused intervals for [0, 4096) alongside all exact segment blocks
        const unusedSlots = [];
        let cursor = 0;
        pageSegments.forEach(ps => {
            if (ps.startOffset > cursor) {
                unusedSlots.push({
                    type: 'unused',
                    startOffset: cursor,
                    endOffset: ps.startOffset,
                    bytes: ps.startOffset - cursor
                });
            }
            cursor = Math.max(cursor, ps.endOffset);
        });
        if (cursor < 4096) {
            unusedSlots.push({
                type: 'unused',
                startOffset: cursor,
                endOffset: 4096,
                bytes: 4096 - cursor
            });
        }

        // Construct HTML Row
        const rowEl = document.createElement("div");
        rowEl.className = "ram-grid-row";

        const labelEl = document.createElement("div");
        labelEl.className = "ram-grid-row-label";
        labelEl.textContent = safeFormatHex(pageBase);
        rowEl.appendChild(labelEl);

        const trackEl = document.createElement("div");
        trackEl.className = "ram-grid-track";

        const appendSlotBlock = (slot) => {
            const blockEl = document.createElement("div");
            const leftPct = (slot.startOffset / 4096) * 100;
            const widthPct = ((slot.endOffset - slot.startOffset) / 4096) * 100;
            blockEl.style.left = `${leftPct}%`;
            blockEl.style.width = `${widthPct}%`;

            if (slot.type === 'module') {
                blockEl.className = "ram-grid-block";
                const bgColor = groupColorMap[slot.module.group || 'Default'] || '#10b981';
                blockEl.style.background = bgColor;

                const blockLabel = (slot.module.isLinkerCreated && slot.sectionName)
                    ? slot.sectionName
                    : slot.module.name;
                blockEl.textContent = widthPct > 2.5 ? blockLabel : "";

                blockEl.addEventListener("mouseenter", (e) => {
                    const startAddrHex = safeFormatHex(slot.segStart);
                    const endAddrHex = safeFormatHex(slot.segEnd - 1);
                    const slotBytes = slot.endOffset - slot.startOffset;
                    const percentOfPage = ((slotBytes / 4096) * 100).toFixed(1);
                    const modRamBytes = slot.module.ramSize !== undefined
                        ? slot.module.ramSize
                        : ((slot.module.rwData || 0) + (slot.module.rwCode || 0));

                    const safeModName = safeEscapeHtml(slot.module.name);
                    const safeGroup = safeEscapeHtml(slot.module.group || 'Unknown');
                    const safeSec = safeEscapeHtml(slot.sectionName || '');
                    const safeKind = safeEscapeHtml(slot.kind || '');

                    tooltipEl.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; color: #34d399;">
                            ${safeModName}${safeSec ? ` <span style="color: #94a3b8; font-weight: 500;">(${safeSec})</span>` : ''}
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Group / Library:</span>
                            <span style="font-weight: 500;">${safeGroup}</span>
                        </div>
                        ${safeKind ? `
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Section Kind:</span>
                            <span style="font-weight: 500; color: #cbd5e1;">${safeKind}</span>
                        </div>` : ''}
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Section Range:</span>
                            <span style="font-family: monospace; color: #6ee7b7;">${startAddrHex} – ${endAddrHex} (${formatBytes(slot.segSize)})</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                            <span style="color: #94a3b8;">Module Total RAM:</span>
                            <span style="font-weight: 600; color: #fff;">${formatBytes(modRamBytes)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 16px;">
                            <span style="color: #94a3b8;">Page Share (4KB):</span>
                            <span style="font-weight: 600; color: #a78bfa;">${percentOfPage}%</span>
                        </div>
                    `;
                    tooltipEl.style.display = "block";
                    positionRamTooltip(tooltipEl, e);
                });
            } else {
                blockEl.className = "ram-grid-block unused";
                blockEl.textContent = widthPct > 8 ? "Unused" : "";

                blockEl.addEventListener("mouseenter", (e) => {
                    const startAddrHex = safeFormatHex(pageBase + slot.startOffset);
                    const endAddrHex = safeFormatHex(pageBase + slot.endOffset - 1);

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
                    positionRamTooltip(tooltipEl, e);
                });
            }

            blockEl.addEventListener("mousemove", (e) => {
                positionRamTooltip(tooltipEl, e);
            });

            blockEl.addEventListener("mouseleave", () => {
                tooltipEl.style.display = "none";
            });

            trackEl.appendChild(blockEl);
        };

        // Append unused backdrop slots first, then section blocks on top
        unusedSlots.forEach(appendSlotBlock);
        pageSegments.forEach(ps => appendSlotBlock({
            type: 'module',
            module: ps.module,
            segStart: ps.segStart,
            segEnd: ps.segEnd,
            segSize: ps.segSize,
            sectionName: ps.sectionName,
            kind: ps.kind,
            startOffset: ps.startOffset,
            endOffset: ps.endOffset
        }));

        rowEl.appendChild(trackEl);
        rowsContainer.appendChild(rowEl);
    }
}
