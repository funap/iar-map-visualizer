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
    let cleaned = rawGroup.replace(/:.*$/, "").trim();
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

if (typeof exports !== 'undefined') {
    exports.parseMapFile = parseMapFile;
    exports.cleanGroupName = cleanGroupName;
    exports.parseHeaders = parseHeaders;
}
