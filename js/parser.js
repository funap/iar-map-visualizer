/**
 * Parser for IAR Systems EWARM Linker Map Files
 */

/**
 * Clean up the group name (library or directory path) to be short and readable.
 * E.g., "C:\Projects\App\Debug\Obj: [1]" -> "Obj"
 * E.g., "dl7M_tln.a: [4]" -> "dl7M_tln.a"
 * @param {string} rawGroup 
 * @returns {string}
 */
function cleanGroupName(rawGroup) {
    // Remove trailing group index suffix (e.g. ": [1]") or trailing colon
    let cleaned = rawGroup.replace(/:\s*\[\d+\]$/, "").replace(/:$/, "").trim();
    if (!cleaned) return "Unknown Group";
    
    // Split by both Windows backslash and Unix slash
    const parts = cleaned.split(/[/\\]/);
    const last = parts[parts.length - 1];
    return last || cleaned;
}

/**
 * Parses the header line to map column positions dynamically.
 * @param {string} headerLine 
 * @returns {Array<string>}
 */
function parseHeaders(headerLine) {
    const lower = headerLine.toLowerCase();
    const headers = [];
    
    const patterns = [
        { key: "roCode", matches: ["ro code", "code size", "code"] },
        { key: "roData", matches: ["ro data", "const size", "const", "ro d"] },
        { key: "rwData", matches: ["rw data", "data size", "data", "rw d"] }
    ];
    
    const occurrences = [];
    patterns.forEach(p => {
        p.matches.forEach(m => {
            let idx = lower.indexOf(m);
            while (idx !== -1) {
                // Avoid overlapping matches (e.g. "ro code" matches both "ro code" and "code")
                const alreadyCovered = occurrences.some(o => o.start <= idx && idx + m.length <= o.start + o.matchLen);
                if (!alreadyCovered) {
                    occurrences.push({ key: p.key, start: idx, matchLen: m.length });
                }
                idx = lower.indexOf(m, idx + 1);
            }
        });
    });
    
    // Sort columns by their starting index in the header line
    occurrences.sort((a, b) => a.start - b.start);
    
    return occurrences.map(o => o.key);
}

/**
 * Parses the separator line (e.g. "------   -------  -------") to find column boundaries.
 * @param {string} separatorLine 
 * @returns {Array<Object>} Spans with start and end index
 */
function parseColumnSpans(separatorLine) {
    const spans = [];
    let inDash = false;
    let start = 0;
    for (let i = 0; i < separatorLine.length; i++) {
        const char = separatorLine[i];
        if (char === '-' || char === '=') {
            if (!inDash) {
                inDash = true;
                start = i;
            }
        } else {
            if (inDash) {
                inDash = false;
                spans.push({ start, end: i });
            }
        }
    }
    if (inDash) {
        spans.push({ start, end: separatorLine.length });
    }
    return spans;
}

/**
 * Parse an EWARM map file content and return module groups and statistics.
 * @param {string} text 
 * @returns {Object} { groups: { groupName: Array }, totals: { roCode, roData, rwData, romSize } }
 */
function parseMapFile(text) {
    const lines = text.split(/\r?\n/);
    let inModuleSummary = false;
    let currentGroupFull = "System";
    let currentGroup = "System";
    
    const groups = {};
    let headers = [];
    let columnSpans = null;
    let parseSeparatorOnNextLine = false;
    
    let totalRoCode = 0;
    let totalRoData = 0;
    let totalRwData = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Detect section headers (e.g. *** MODULE SUMMARY)
        if (/^\*\*\*\s+[A-Z]/.test(trimmed)) {
            if (trimmed.includes("MODULE SUMMARY")) {
                inModuleSummary = true;
                continue;
            } else if (inModuleSummary) {
                break; // Stop when hitting another section header
            }
        }
        
        if (!inModuleSummary) continue;
        
        // Find column header
        if (trimmed.toLowerCase().includes("ro code") || trimmed.toLowerCase().includes("ro data") || trimmed.toLowerCase().includes("rw data") || trimmed.toLowerCase().includes("code")) {
            headers = parseHeaders(line);
            parseSeparatorOnNextLine = true;
            continue;
        }
        
        // Skip separators, totals and empty lines
        if (trimmed.startsWith("---") || trimmed.startsWith("===") || trimmed.toLowerCase().startsWith("total:") || trimmed.toLowerCase().startsWith("grand total:")) {
            if (parseSeparatorOnNextLine && (trimmed.startsWith("---") || trimmed.startsWith("==="))) {
                columnSpans = parseColumnSpans(line);
                parseSeparatorOnNextLine = false;
            }
            continue;
        }
        
        if (trimmed === "") continue;
        
        const startsWithSpace = line.startsWith(" ") || line.startsWith("\t");
        
        if (startsWithSpace) {
            if (columnSpans && columnSpans.length >= 2) {
                // Fixed-width column parsing
                const nameLimit = columnSpans[1].start;
                const name = line.substring(0, nameLimit).trim();
                
                // Clean up trailing colon
                const cleanedName = name.replace(/:$/, "").trim();
                
                if (cleanedName.toLowerCase() === "total" || 
                    cleanedName.toLowerCase() === "grand total" || 
                    cleanedName.toLowerCase() === "gaps" || 
                    !cleanedName) {
                    continue;
                }
                
                const moduleData = {
                    name: cleanedName,
                    group: currentGroup,
                    groupFull: currentGroupFull,
                    roCode: 0,
                    roData: 0,
                    rwData: 0,
                    romSize: 0
                };
                
                for (let j = 1; j < columnSpans.length; j++) {
                    const start = columnSpans[j].start;
                    const end = (j + 1 < columnSpans.length) ? columnSpans[j+1].start : line.length;
                    const colValStr = line.substring(start, end).trim().replace(/[,']/g, "");
                    const val = parseInt(colValStr, 10) || 0;
                    
                    const headerKey = headers[j - 1];
                    if (headerKey) {
                        moduleData[headerKey] = val;
                    }
                }
                
                moduleData.romSize = moduleData.roCode + moduleData.roData;
                
                // Only include if it has non-zero memory consumption
                if (moduleData.romSize > 0 || moduleData.rwData > 0) {
                    if (!groups[currentGroup]) {
                        groups[currentGroup] = {
                            name: currentGroup,
                            fullName: currentGroupFull,
                            modules: []
                        };
                    }
                    groups[currentGroup].modules.push(moduleData);
                    
                    totalRoCode += moduleData.roCode;
                    totalRoData += moduleData.roData;
                    totalRwData += moduleData.rwData;
                }
            } else {
                // Fallback to regex parser
                const moduleMatch = trimmed.match(/^([^\s].*?)\s+(\d[\d\s,']*)$/);
                if (moduleMatch) {
                    const name = moduleMatch[1].trim();
                    const numbersStr = moduleMatch[2];
                    const cleanedName = name.replace(/:$/, "").trim();
                    
                    if (cleanedName.toLowerCase() === "total" || cleanedName.toLowerCase() === "grand total") {
                        continue;
                    }
                    
                    const numbers = numbersStr.split(/\s+/).map(n => parseInt(n.replace(/[,']/g, ""), 10) || 0);
                    
                    const moduleData = {
                        name: cleanedName,
                        group: currentGroup,
                        groupFull: currentGroupFull,
                        roCode: 0,
                        roData: 0,
                        rwData: 0,
                        romSize: 0
                    };
                    
                    if (headers.length > 0) {
                        headers.forEach((header, index) => {
                            const val = numbers[index] || 0;
                            moduleData[header] = val;
                        });
                    } else {
                        moduleData.roCode = numbers[0] || 0;
                        moduleData.roData = numbers[1] || 0;
                        moduleData.rwData = numbers[2] || 0;
                    }
                    
                    moduleData.romSize = moduleData.roCode + moduleData.roData;
                    
                    if (moduleData.romSize > 0 || moduleData.rwData > 0) {
                        if (!groups[currentGroup]) {
                            groups[currentGroup] = {
                                name: currentGroup,
                                fullName: currentGroupFull,
                                modules: []
                            };
                        }
                        groups[currentGroup].modules.push(moduleData);
                        
                        totalRoCode += moduleData.roCode;
                        totalRoData += moduleData.roData;
                        totalRwData += moduleData.rwData;
                    }
                }
            }
        } else if (!startsWithSpace && !trimmed.startsWith("*") && !trimmed.startsWith("-") && !trimmed.startsWith("=")) {
            // Group header line (e.g. "rt7M_tl.a: [2]")
            currentGroupFull = trimmed;
            currentGroup = cleanGroupName(trimmed);
            if (!groups[currentGroup]) {
                groups[currentGroup] = {
                    name: currentGroup,
                    fullName: currentGroupFull,
                    modules: []
                };
            }
        }
    }
    
    // Prune empty groups
    for (const groupName in groups) {
        if (!groups[groupName].modules || groups[groupName].modules.length === 0) {
            delete groups[groupName];
        }
    }
    
    return {
        groups,
        totals: {
            roCode: totalRoCode,
            roData: totalRoData,
            rwData: totalRwData,
            romSize: totalRoCode + totalRoData
        }
    };
}

/**
 * Parses an IAR Embedded Workbench project (.ewp) XML file.
 * Returns a hierarchical folder structure containing files and nested groups.
 * @param {string} xmlText 
 * @returns {Object} { rootGroups, rootFiles, fileMap }
 */
function parseEwpFile(xmlText) {
    let xmlDoc;
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            throw new Error("Invalid EWP file format: XML parsing failed.");
        }
    } else {
        throw new Error("DOMParser is not supported in this environment.");
    }

    const fileMap = new Map(); // stem (lowercase) -> Array of folderPaths e.g. "display" -> ["Application/UI"]

    function parseGroup(groupEl, parentPath) {
        const nameEl = Array.from(groupEl.children).find(c => c.tagName.toLowerCase() === "name");
        const groupName = nameEl ? nameEl.textContent.trim() : "Unnamed Folder";
        const currentPath = parentPath ? `${parentPath}/${groupName}` : groupName;

        const subGroups = [];
        const files = [];

        Array.from(groupEl.children).forEach(child => {
            const tag = child.tagName.toLowerCase();
            if (tag === "group") {
                subGroups.push(parseGroup(child, currentPath));
            } else if (tag === "file") {
                const fNameEl = Array.from(child.children).find(c => c.tagName.toLowerCase() === "name");
                if (fNameEl) {
                    const rawPath = fNameEl.textContent.trim();
                    const normPath = rawPath.replace(/\\/g, "/");
                    const filename = normPath.split("/").pop() || rawPath;
                    const stem = filename.replace(/\.[^/.]+$/, "").toLowerCase();

                    const fileObj = {
                        rawPath: rawPath,
                        filename: filename,
                        stem: stem,
                        folderPath: currentPath
                    };
                    files.push(fileObj);

                    if (!fileMap.has(stem)) {
                        fileMap.set(stem, []);
                    }
                    fileMap.get(stem).push(currentPath);
                }
            }
        });

        return {
            name: groupName,
            path: currentPath,
            groups: subGroups,
            files: files
        };
    }

    const projectEl = xmlDoc.querySelector("project");
    if (!projectEl) {
        throw new Error("Invalid EWP file: <project> element not found.");
    }

    const rootGroups = [];
    const rootFiles = [];

    Array.from(projectEl.children).forEach(child => {
        const tag = child.tagName.toLowerCase();
        if (tag === "group") {
            rootGroups.push(parseGroup(child, ""));
        } else if (tag === "file") {
            const fNameEl = Array.from(child.children).find(c => c.tagName.toLowerCase() === "name");
            if (fNameEl) {
                const rawPath = fNameEl.textContent.trim();
                const normPath = rawPath.replace(/\\/g, "/");
                const filename = normPath.split("/").pop() || rawPath;
                const stem = filename.replace(/\.[^/.]+$/, "").toLowerCase();

                rootFiles.push({
                    rawPath: rawPath,
                    filename: filename,
                    stem: stem,
                    folderPath: "Root"
                });

                if (!fileMap.has(stem)) {
                    fileMap.set(stem, []);
                }
                fileMap.get(stem).push("Root");
            }
        }
    });

    return {
        rootGroups,
        rootFiles,
        fileMap
    };
}

/**
 * Constructs a hierarchical tree structure for ECharts treemap from mapped folder paths.
 * @param {Object} parsedMapData { groups, totals }
 * @param {Object} parsedEwpData { rootGroups, rootFiles, fileMap }
 * @returns {Array} ECharts treemap nodes hierarchy
 */
function buildEwpFolderTree(parsedMapData, parsedEwpData) {
    if (!parsedMapData || !parsedMapData.groups) return [];
    
    const fileMap = parsedEwpData ? parsedEwpData.fileMap : new Map();
    
    const treeRoot = new Map();

    function getOrCreateNode(pathParts) {
        let currentLevel = treeRoot;
        let fullPath = "";
        let currentNode = null;

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            fullPath = fullPath ? `${fullPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                const newNode = {
                    name: part,
                    fullPath: fullPath,
                    childrenMap: new Map(),
                    modules: []
                };
                currentLevel.set(part, newNode);
            }
            currentNode = currentLevel.get(part);
            currentLevel = currentNode.childrenMap;
        }

        return currentNode;
    }

    const totalRom = parsedMapData.totals.romSize;

    for (const grpName in parsedMapData.groups) {
        const groupObj = parsedMapData.groups[grpName];
        groupObj.modules.forEach(m => {
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

            const pathParts = folderPath.split("/");
            const targetNode = getOrCreateNode(pathParts);
            targetNode.modules.push({
                ...m,
                folderPath: folderPath
            });
        });
    }

    function convertToEchartsNodes(nodesMap) {
        const result = [];

        nodesMap.forEach(node => {
            let nodeRomSum = 0;
            const children = [];

            if (node.childrenMap.size > 0) {
                const childFolderNodes = convertToEchartsNodes(node.childrenMap);
                childFolderNodes.forEach(c => {
                    nodeRomSum += c.value;
                    children.push(c);
                });
            }

            node.modules.forEach(m => {
                nodeRomSum += m.romSize;
                children.push({
                    name: m.name,
                    value: m.romSize,
                    roCode: m.roCode,
                    roData: m.roData,
                    rwData: m.rwData,
                    romSize: m.romSize,
                    romPercentage: totalRom > 0 ? (m.romSize / totalRom) * 100 : 0,
                    group: m.group,
                    folderPath: node.fullPath
                });
            });

            if (nodeRomSum > 0) {
                result.push({
                    name: node.name,
                    fullPath: node.fullPath,
                    value: nodeRomSum,
                    romPercentage: totalRom > 0 ? (nodeRomSum / totalRom) * 100 : 0,
                    children: children
                });
            }
        });

        return result;
    }

    return convertToEchartsNodes(treeRoot);
}

if (typeof exports !== 'undefined') {
    exports.parseMapFile = parseMapFile;
    exports.cleanGroupName = cleanGroupName;
    exports.parseHeaders = parseHeaders;
    exports.parseEwpFile = parseEwpFile;
    exports.buildEwpFolderTree = buildEwpFolderTree;
}

