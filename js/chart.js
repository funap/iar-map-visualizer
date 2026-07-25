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
