/**
 * Parser for IAR Systems EWARM Linker Map Files
 */

/**
 * Escapes HTML special characters for safe DOM insertion.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Extracts numeric group ID suffix like ": [1]" from a group header.
 * @param {string} rawGroup
 * @returns {number|null}
 */
function extractGroupId(rawGroup) {
    if (!rawGroup) return null;
    const m = rawGroup.match(/:\s*\[(\d+)\]\s*$/);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Clean up the group name (library or directory path) to be short and readable.
 * E.g., "C:\Projects\App\Debug\Obj: [1]" -> "Obj"
 * E.g., "dl7M_tln.a: [4]" -> "dl7M_tln.a"
 * E.g., "command line/config:" -> "command line/config"
 * @param {string} rawGroup 
 * @returns {string}
 */
function cleanGroupName(rawGroup) {
    if (!rawGroup) return "Unknown Group";
    // Remove trailing group index suffix (e.g. ": [1]") or trailing colon
    let cleaned = rawGroup.replace(/:\s*\[\d+\]$/, "").replace(/:$/, "").trim();
    if (!cleaned) return "Unknown Group";

    const lower = cleaned.toLowerCase();
    if (lower === "command line" || lower === "command line/config" || lower === "linker created") {
        return cleaned;
    }

    // Split by both Windows backslash and Unix slash
    const parts = cleaned.split(/[/\\]/).filter(Boolean);
    const last = parts[parts.length - 1];
    return last || cleaned;
}

/**
 * Parses a hexadecimal string possibly containing IAR apostrophe separators (e.g., "0x800'0000").
 * @param {string} hexStr
 * @returns {number}
 */
function parseIarHex(hexStr) {
    if (!hexStr) return NaN;
    return parseInt(String(hexStr).replace(/^0[xX]/, "").replace(/'/g, ""), 16);
}

/**
 * Parses a decimal string possibly containing spaces, commas, or apostrophe separators.
 * @param {string} decStr
 * @returns {number}
 */
function parseIarInt(decStr) {
    if (!decStr) return 0;
    const cleaned = String(decStr).replace(/[\s,']/g, "");
    const val = parseInt(cleaned, 10);
    return isNaN(val) ? 0 : val;
}

/**
 * Parses the header line to map column positions dynamically.
 * @param {string} headerLine 
 * @returns {Array<string>}
 */
function parseHeaders(headerLine) {
    const lower = headerLine.toLowerCase();

    // Sort every (key, match) candidate strictly by match length descending so longer tokens
    // ("rw code", "ro data (abs)", etc.) always claim their span before short aliases ("code", "data").
    const candidates = [
        { key: "roCodeAbs", match: "ro code (abs)" },
        { key: "rwCodeAbs", match: "rw code (abs)" },
        { key: "roDataAbs", match: "ro data (abs)" },
        { key: "rwDataAbs", match: "rw data (abs)" },
        { key: "roCode", match: "code size" },
        { key: "roData", match: "const size" },
        { key: "rwData", match: "data size" },
        { key: "roCode", match: "ro code" },
        { key: "rwCode", match: "rw code" },
        { key: "roData", match: "ro data" },
        { key: "rwData", match: "rw data" },
        { key: "shared", match: "shared" },
        { key: "roData", match: "const" },
        { key: "roCode", match: "code" },
        { key: "roData", match: "ro d" },
        { key: "rwData", match: "rw d" },
        { key: "rwData", match: "data" }
    ].sort((a, b) => b.match.length - a.match.length);

    const isWordBoundary = (str, start, len) => {
        const before = start > 0 ? str[start - 1] : " ";
        const after = start + len < str.length ? str[start + len] : " ";
        return !/[a-z0-9_]/i.test(before) && !/[a-z0-9_]/i.test(after);
    };

    const occurrences = [];
    candidates.forEach(({ key, match }) => {
        let idx = lower.indexOf(match);
        while (idx !== -1) {
            const alreadyCovered = occurrences.some(
                o => !(idx + match.length <= o.start || idx >= o.start + o.matchLen)
            );
            if (!alreadyCovered && isWordBoundary(lower, idx, match.length)) {
                occurrences.push({ key, start: idx, matchLen: match.length });
            }
            idx = lower.indexOf(match, idx + 1);
        }
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
 * Formats an address with apostrophe grouping every 4 hex digits.
 * Supports 32-bit as well as wider (>8 hex digits) addresses.
 * @param {number} num
 * @returns {string}
 */
function formatHexAddress(num) {
    const safe = Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
    const rawHex = safe.toString(16).toUpperCase();
    const minLen = rawHex.length <= 8 ? 8 : Math.ceil(rawHex.length / 4) * 4;
    const padded = rawHex.padStart(minLen, '0');
    return "0x" + padded.replace(/\B(?=(\w{4})+(?!\w))/g, "'");
}

/**
 * Converts an address into a 0x2000'0000 (512MB) bounded Memory Area string.
 * @param {number|undefined} address 
 * @returns {string}
 */
function getRomAreaName(address) {
    if (address === undefined || address === null || isNaN(address) || address < 0) {
        return "0x0000'0000 - 0x1FFF'FFFF (Internal Flash / Code)";
    }
    const blockIdx = Math.floor(address / 0x20000000);
    const startAddr = blockIdx * 0x20000000;
    const endAddr = startAddr + 0x1FFFFFFF;

    const startHex = formatHexAddress(startAddr);
    const endHex = formatHexAddress(endAddr);

    let areaLabel = "Memory Area";
    if (blockIdx === 0) areaLabel = "Internal Flash / Code";
    else if (blockIdx === 1) areaLabel = "Internal SRAM";
    else if (blockIdx === 2) areaLabel = "Peripherals";
    else if (blockIdx === 3) areaLabel = "External Memory 1";
    else if (blockIdx === 4) areaLabel = "External Memory 2 (QSPI/OSPI)";
    else if (blockIdx === 5) areaLabel = "External Device 1";
    else if (blockIdx === 6) areaLabel = "External Memory 3 / SDRAM";
    else if (blockIdx === 7) areaLabel = "System Level";

    return `${startHex} - ${endHex} (${areaLabel})`;
}

/**
 * Extracts integer column tokens from the numeric slice of a MODULE SUMMARY row.
 * Supports spaces (e.g. "5 880"), apostrophes ("40'800"), and commas ("4,612").
 * @param {string} str
 * @param {number} baseOffset
 * @param {Array<Object>|null} numericSpans
 * @returns {Array<{value: number, start: number, end: number}>}
 */
function extractNumericTokens(str, baseOffset, numericSpans) {
    const tokens = [];
    // Split on >=2 spaces (or single space when not a thousands separator) while tracking exact string indices:
    let idx = 0;
    while (idx < str.length) {
        while (idx < str.length && /\s/.test(str[idx])) idx++;
        if (idx >= str.length) break;

        let end = idx;
        while (end < str.length) {
            if (str[end] === ' ') {
                // Single space continues token ONLY if followed by 3 digits and not 2 spaces
                if (end + 1 < str.length && str[end + 1] === ' ') {
                    break;
                }
                if (end + 4 <= str.length && /^\d{3}(?:\s|$)/.test(str.substring(end + 1, end + 5))) {
                    end += 4;
                    continue;
                }
                break;
            } else if (/\t/.test(str[end])) {
                break;
            }
            end++;
        }

        const slice = str.substring(idx, end);
        if (/^\d+(?:[', ]\d{3})*$/.test(slice) || /^\d+$/.test(slice)) {
            const absStart = baseOffset + idx;
            const absEnd = baseOffset + end;

            // Edge case: if two space-separated 3-digit numbers ended up separated by a single space
            // because column 1 overflowed left, split along intermediate span end if exact match exists.
            let didSplit = false;
            if (slice.includes(' ') && numericSpans && numericSpans.length >= 2) {
                for (let sIdx = 0; sIdx < numericSpans.length - 1; sIdx++) {
                    const boundaryEnd = numericSpans[sIdx].end;
                    const relSplit = boundaryEnd - absStart;
                    if (relSplit > 0 && relSplit < slice.length && slice[relSplit] === ' ') {
                        const leftPart = slice.substring(0, relSplit);
                        const rightPart = slice.substring(relSplit + 1);
                        if (/^\d+(?:[', ]\d{3})*$/.test(leftPart) && /^\d+(?:[', ]\d{3})*$/.test(rightPart)) {
                            tokens.push({ value: parseIarInt(leftPart), start: absStart, end: absStart + leftPart.length });
                            tokens.push({ value: parseIarInt(rightPart), start: absStart + relSplit + 1, end: absEnd });
                            didSplit = true;
                            break;
                        }
                    }
                }
            }

            if (!didSplit) {
                tokens.push({ value: parseIarInt(slice), start: absStart, end: absEnd });
            }
        }
        idx = end;
    }
    return tokens;
}

/**
 * Assigns extracted numeric tokens to header columns preserving left-to-right order,
 * avoiding fixed-substring digit truncation when values overflow column widths.
 * @param {Array<{value: number, start: number, end: number}>} tokens
 * @param {Array<string>} headers
 * @param {Array<Object>|null} columnSpans
 * @returns {Array<number>} Column index per token
 */
function assignTokensToColumns(tokens, headers, columnSpans) {
    const m = tokens.length;
    const n = headers.length;
    if (m === 0 || n === 0) return [];

    // Exact 1-to-1 count match cannot suffer column shift
    if (m === n) {
        return tokens.map((_, i) => i);
    }

    // If we lack column spans matching headers, fallback left-to-right
    if (!columnSpans || columnSpans.length - 1 < n) {
        return tokens.map((_, i) => Math.min(i, n - 1));
    }

    const colSpans = columnSpans.slice(1, 1 + n);
    if (m > n) {
        return tokens.slice(0, n).map((_, i) => i);
    }

    // Monotone minimum-cost DP matching token i to column j using right-aligned end positions
    const INF = 1e12;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(INF));
    const choice = Array.from({ length: m }, () => new Array(n).fill(-1));
    for (let j = 0; j <= n; j++) dp[m][j] = 0;

    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - (m - i); j >= 0; j--) {
            // Option 1: assign token i to column j
            const costTake = Math.abs(tokens[i].end - colSpans[j].end) + dp[i + 1][j + 1];
            // Option 2: skip column j
            const costSkip = dp[i][j + 1];
            if (costTake <= costSkip) {
                dp[i][j] = costTake;
                choice[i][j] = j;
            } else {
                dp[i][j] = costSkip;
                choice[i][j] = -1;
            }
        }
    }

    const result = new Array(m);
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (choice[i][j] === j) {
            result[i] = j;
            i++;
            j++;
        } else {
            j++;
        }
    }
    return result;
}

/**
 * Classifies an IAR PLACEMENT SUMMARY Kind string into ROM or RAM.
 * @param {string} kindLower
 * @returns {'rom'|'ram'|'other'}
 */
function classifyPlacementKind(kindLower) {
    if (kindLower === 'ro code' || kindLower === 'const' || kindLower === 'ro data' || kindLower === 'code') {
        return 'rom';
    }
    if (kindLower === 'inited' || kindLower === 'zero' || kindLower === 'uninit' || kindLower === 'rw code' || kindLower === 'rw data') {
        return 'ram';
    }
    return 'other';
}

/**
 * Parses the PLACEMENT SUMMARY section of an IAR ILINK map file.
 * Extracts ROM base addresses and per-section RAM intervals keyed by object name & group ID.
 * @param {Array<string>} lines
 * @returns {Object} Placement lookup maps
 */
function parsePlacementSummary(lines) {
    const byGroupAndName = new Map(); // `${groupId}:${lowerName}` -> entry
    const byName = new Map();         // lowerName -> entry
    const byLinkerSection = new Map(); // lowerSectionName -> entry (for individual Linker created child rows)

    function getOrCreateEntry(map, key) {
        if (!map.has(key)) {
            map.set(key, {
                romAddr: undefined,
                romNonZeroAddr: undefined,
                romSections: [],
                ramAddr: undefined,
                ramNonZeroAddr: undefined,
                ramSections: []
            });
        }
        return map.get(key);
    }

    function recordSection(objName, groupId, sectionName, kindLower, addrVal, sizeVal) {
        const lowerObj = objName.toLowerCase();
        const role = classifyPlacementKind(kindLower);
        if (role === 'other') return;

        const targets = [];
        if (groupId !== null && groupId !== undefined) {
            targets.push(getOrCreateEntry(byGroupAndName, `${groupId}:${lowerObj}`));
        }
        targets.push(getOrCreateEntry(byName, lowerObj));
        if (lowerObj === 'linker created' && sectionName) {
            targets.push(getOrCreateEntry(byLinkerSection, sectionName.toLowerCase()));
        }

        targets.forEach(entry => {
            if (role === 'ram') {
                if (entry.ramAddr === undefined || addrVal < entry.ramAddr) {
                    entry.ramAddr = addrVal;
                }
                if (sizeVal > 0 && (entry.ramNonZeroAddr === undefined || addrVal < entry.ramNonZeroAddr)) {
                    entry.ramNonZeroAddr = addrVal;
                }
                if (sizeVal > 0) {
                    entry.ramSections.push({
                        section: sectionName || "",
                        kind: kindLower,
                        address: addrVal,
                        size: sizeVal
                    });
                }
            } else if (role === 'rom') {
                if (entry.romAddr === undefined || addrVal < entry.romAddr) {
                    entry.romAddr = addrVal;
                }
                if (sizeVal > 0 && (entry.romNonZeroAddr === undefined || addrVal < entry.romNonZeroAddr)) {
                    entry.romNonZeroAddr = addrVal;
                }
                if (sizeVal > 0) {
                    entry.romSections.push({
                        section: sectionName || "",
                        kind: kindLower,
                        address: addrVal,
                        size: sizeVal
                    });
                }
            }
        });
    }

    let inPlacementSection = false;
    let inTable = false;
    let isLegacySampleTable = false;
    let pendingSectionName = null;

    const ilinkRowRegex = /^(.*?)\s+(ro\s+code|rw\s+code|ro\s+data|rw\s+data|const|inited|zero|uninit|absolute)\s+(0[xX][0-9a-fA-F']+)\s+(0[xX][0-9a-fA-F']+)(?:\s+(.*))?$/i;
    const ilinkWrappedContRegex = /^(ro\s+code|rw\s+code|ro\s+data|rw\s+data|const|inited|zero|uninit|absolute)\s+(0[xX][0-9a-fA-F']+)\s+(0[xX][0-9a-fA-F']+)(?:\s+(.*))?$/i;
    const sampleRowRegex = /^(0[xX][0-9a-fA-F']+)\s+(0[xX][0-9a-fA-F']+)\s+(ro\s+code|rw\s+code|ro\s+data|rw\s+data|code|const|inited|zero|uninit)\s+(.+)$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^\*\*\*\s+[A-Z]/.test(trimmed)) {
            if (trimmed.includes("PLACEMENT SUMMARY")) {
                inPlacementSection = true;
                inTable = false;
                pendingSectionName = null;
                continue;
            } else if (inPlacementSection) {
                break;
            }
        }

        if (!inPlacementSection) continue;
        if (!trimmed) continue;

        if (!inTable) {
            // Standard ILINK header: Section  Kind  Address  Size  Object
            if (/\bsection\b/i.test(trimmed) && /\bkind\b/i.test(trimmed) && /\baddress\b/i.test(trimmed) && /\bsize\b/i.test(trimmed)) {
                inTable = true;
                isLegacySampleTable = false;
                continue;
            }
            // Fallback/sample table header: Address  Size  Type  Object
            if (/^address\s+size\s+type\s+object/i.test(trimmed)) {
                inTable = true;
                isLegacySampleTable = true;
                continue;
            }
            continue;
        }

        // Skip separator row after header
        if (/^[-=\s]+$/.test(trimmed)) continue;

        if (isLegacySampleTable) {
            const sm = trimmed.match(sampleRowRegex);
            if (sm) {
                const addrVal = parseIarHex(sm[1]);
                const sizeVal = parseIarHex(sm[2]);
                const kindLower = sm[3].toLowerCase().replace(/\s+/g, " ");
                const objRaw = sm[4].trim();
                if (!isNaN(addrVal) && !isNaN(sizeVal)) {
                    recordSection(objRaw, null, "", kindLower, addrVal, sizeVal);
                }
            }
            continue;
        }

        // Check continuation of a wrapped section name line
        if (pendingSectionName) {
            const contMatch = trimmed.match(ilinkWrappedContRegex);
            if (contMatch) {
                const kindLower = contMatch[1].toLowerCase().replace(/\s+/g, " ");
                const addrVal = parseIarHex(contMatch[2]);
                const sizeVal = parseIarHex(contMatch[3]);
                const objStr = (contMatch[4] || "").trim();
                const sectionName = pendingSectionName;
                pendingSectionName = null;

                if (!isNaN(addrVal) && !isNaN(sizeVal)) {
                    const { objName, groupId } = normalizePlacementObject(objStr, sectionName);
                    if (objName) recordSection(objName, groupId, sectionName, kindLower, addrVal, sizeVal);
                }
                continue;
            }
            pendingSectionName = null;
        }

        const rowMatch = trimmed.match(ilinkRowRegex);
        if (rowMatch) {
            const sectionName = rowMatch[1].trim();
            const kindLower = rowMatch[2].toLowerCase().replace(/\s+/g, " ");
            const addrVal = parseIarHex(rowMatch[3]);
            const sizeVal = parseIarHex(rowMatch[4]);
            const objStr = (rowMatch[5] || "").trim();

            if (!isNaN(addrVal) && !isNaN(sizeVal)) {
                const { objName, groupId } = normalizePlacementObject(objStr, sectionName);
                if (objName) recordSection(objName, groupId, sectionName, kindLower, addrVal, sizeVal);
            }
            continue;
        }

        // Check if this is a single wrapped section name line (no hex address on it, not region/block summary)
        if (!/^"/.test(trimmed) && !/^-\s*0[xX]/.test(trimmed) && !/0[xX][0-9a-fA-F']+/.test(trimmed) && !trimmed.includes("<")) {
            pendingSectionName = trimmed;
        }
    }

    return { byGroupAndName, byName, byLinkerSection };
}

/**
 * Normalizes an Object column value from PLACEMENT SUMMARY.
 * @param {string} objStr
 * @param {string} sectionName
 * @returns {{objName: string|null, groupId: number|null}}
 */
function normalizePlacementObject(objStr, sectionName) {
    if (!objStr) {
        // CSTACK, HEAP, or Linker-created Initializer bytes often leave Object empty
        return { objName: "Linker created", groupId: null };
    }
    if (/^-\s*linker\s+created\s*-$/i.test(objStr) || /^<for\s+.*>$/i.test(objStr)) {
        return { objName: "Linker created", groupId: null };
    }
    if (/^<(?:init\s+)?block(?:\s+tail)?>$/i.test(objStr)) {
        return { objName: null, groupId: null };
    }
    const idMatch = objStr.match(/^(.*?)\s*\[(\d+)\]\s*$/);
    if (idMatch) {
        return { objName: idMatch[1].trim(), groupId: parseInt(idMatch[2], 10) };
    }
    return { objName: objStr, groupId: null };
}

/**
 * Builds unique display group names when distinct paths share the same final folder name
 * (e.g. C:\App\Debug\Obj vs C:\Boot\Debug\Obj).
 * @param {Array<{key: string, fullName: string, baseName: string, groupId: number|null}>} rawGroups
 */
function disambiguateGroupNames(rawGroups) {
    const counts = new Map();
    rawGroups.forEach(g => {
        counts.set(g.baseName, (counts.get(g.baseName) || 0) + 1);
    });

    const usedNames = new Set();
    rawGroups.forEach(g => {
        if (counts.get(g.baseName) === 1 && !usedNames.has(g.baseName)) {
            g.displayName = g.baseName;
            usedNames.add(g.displayName);
            return;
        }

        // Try expanding parent path segments backwards for directory paths
        const cleaned = g.fullName.replace(/:\s*\[\d+\]$/, "").replace(/:$/, "").trim();
        const parts = cleaned.split(/[/\\]/).filter(Boolean);
        let candidate = g.baseName;
        for (let depth = 2; depth <= parts.length; depth++) {
            const slice = parts.slice(parts.length - depth).join("/");
            const sameAtDepth = rawGroups.filter(other => {
                if (other === g) return false;
                const oc = other.fullName.replace(/:\s*\[\d+\]$/, "").replace(/:$/, "").trim();
                const op = oc.split(/[/\\]/).filter(Boolean);
                return op.slice(Math.max(0, op.length - depth)).join("/") === slice;
            });
            if (sameAtDepth.length === 0 && !usedNames.has(slice)) {
                candidate = slice;
                break;
            }
        }

        if (candidate === g.baseName || usedNames.has(candidate)) {
            candidate = g.groupId !== null ? `${g.baseName} [${g.groupId}]` : g.fullName;
        }
        while (usedNames.has(candidate)) {
            candidate = `${candidate}_`;
        }
        g.displayName = candidate;
        usedNames.add(candidate);
    });
}

/**
 * Parse an EWARM map file content and return module groups, address placements, and statistics.
 * @param {string} text 
 * @returns {Object} { groups, totals, grandTotal }
 */
function parseMapFile(text) {
    const lines = text.split(/\r?\n/);
    let inModuleSummary = false;
    let currentGroupFull = "System";
    let currentGroupId = null;

    // Collect groups keyed internally so colliding folder names (e.g. App/Obj vs Boot/Obj) never overwrite
    const rawGroupOrder = [];
    const rawGroupsMap = new Map();
    const getOrCreateRawGroup = (fullName, groupId, forceBaseName = null) => {
        const internalKey = `${fullName}::${groupId !== null ? groupId : 'none'}`;
        if (!rawGroupsMap.has(internalKey)) {
            const entry = {
                key: internalKey,
                fullName: fullName,
                baseName: forceBaseName || cleanGroupName(fullName),
                groupId: groupId,
                displayName: "",
                modules: []
            };
            rawGroupsMap.set(internalKey, entry);
            rawGroupOrder.push(entry);
        }
        return rawGroupsMap.get(internalKey);
    };

    let headers = [];
    let columnSpans = null;
    let parseSeparatorOnNextLine = false;
    let pendingModuleName = null;

    let totalRoCode = 0;
    let totalRwCode = 0;
    let totalRoData = 0;
    let totalRwData = 0;
    let totalRoCodeAbs = 0;
    let totalRwCodeAbs = 0;
    let totalRoDataAbs = 0;
    let totalRwDataAbs = 0;
    let grandTotal = null;

    // Build module to address / per-section mapping from PLACEMENT SUMMARY
    const placementData = parsePlacementSummary(lines);

    const resolvePlacementForModule = (modName, groupId, isLinkerCreated) => {
        const lowerObj = modName.toLowerCase();
        if (isLinkerCreated && lowerObj !== "linker created") {
            const bySec = placementData.byLinkerSection.get(lowerObj);
            if (bySec) return bySec;
        }
        if (groupId !== null && groupId !== undefined) {
            const exact = placementData.byGroupAndName.get(`${groupId}:${lowerObj}`);
            if (exact) return exact;
        }
        return placementData.byName.get(lowerObj) || null;
    };

    const appendModule = (targetGroupFull, targetGroupId, cleanedName, numbers, tokens, forceGroupBase = null, flags = {}) => {
        const moduleData = {
            name: cleanedName,
            group: "", // Filled after group disambiguation
            groupFull: targetGroupFull,
            groupId: targetGroupId,
            roCode: 0,
            rwCode: 0,
            roData: 0,
            rwData: 0,
            roCodeAbs: 0,
            rwCodeAbs: 0,
            roDataAbs: 0,
            rwDataAbs: 0,
            romSize: 0,
            ramSize: 0,
            isLinkerCreated: !!flags.isLinkerCreated,
            isGap: !!flags.isGap
        };

        if (headers.length > 0 && tokens && tokens.length > 0) {
            const colIndices = assignTokensToColumns(tokens, headers, columnSpans);
            for (let t = 0; t < tokens.length; t++) {
                const headerKey = headers[colIndices[t]];
                if (headerKey) {
                    moduleData[headerKey] = tokens[t].value;
                }
            }
        } else if (numbers && numbers.length > 0) {
            if (headers.length > 0) {
                headers.forEach((header, idx) => {
                    moduleData[header] = numbers[idx] || 0;
                });
            } else {
                moduleData.roCode = numbers[0] || 0;
                moduleData.roData = numbers[1] || 0;
                moduleData.rwData = numbers[2] || 0;
            }
        }

        moduleData.romSize = moduleData.roCode + moduleData.roData;
        moduleData.ramSize = moduleData.rwData + moduleData.rwCode;

        // Assign Address, per-section placements, and ROM/RAM Areas
        const placement = resolvePlacementForModule(cleanedName, targetGroupId, !!flags.isLinkerCreated);
        const romAddr = (placement && moduleData.romSize > 0)
            ? (placement.romNonZeroAddr !== undefined ? placement.romNonZeroAddr : placement.romAddr)
            : (placement && moduleData.romSize === 0 && placement.romNonZeroAddr === undefined ? placement.romAddr : undefined);
        const ramAddr = (placement && moduleData.ramSize > 0)
            ? (placement.ramNonZeroAddr !== undefined ? placement.ramNonZeroAddr : placement.ramAddr)
            : undefined;

        moduleData.address = romAddr !== undefined ? romAddr : 0x08000000;
        moduleData.hasExplicitRomAddr = romAddr !== undefined;
        moduleData.romSections = (placement && moduleData.romSize > 0) ? placement.romSections : [];
        moduleData.romArea = getRomAreaName(moduleData.address);

        if (ramAddr !== undefined && moduleData.ramSize > 0) {
            moduleData.ramAddress = ramAddr;
            moduleData.hasExplicitRamAddr = true;
            moduleData.ramSections = placement.ramSections;
        } else {
            moduleData.ramAddress = undefined;
            moduleData.hasExplicitRamAddr = false;
            moduleData.ramSections = [];
        }
        moduleData.ramArea = getRomAreaName(moduleData.ramAddress !== undefined ? moduleData.ramAddress : 0x20000000);

        if (moduleData.romSize > 0 || moduleData.ramSize > 0) {
            const grpEntry = getOrCreateRawGroup(targetGroupFull, targetGroupId, forceGroupBase);
            grpEntry.modules.push(moduleData);

            totalRoCode += moduleData.roCode;
            totalRwCode += moduleData.rwCode;
            totalRoData += moduleData.roData;
            totalRwData += moduleData.rwData;
            totalRoCodeAbs += moduleData.roCodeAbs;
            totalRwCodeAbs += moduleData.rwCodeAbs;
            totalRoDataAbs += moduleData.roDataAbs;
            totalRwDataAbs += moduleData.rwDataAbs;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect section headers (e.g. *** MODULE SUMMARY)
        if (/^\*\*\*\s+[A-Z]/.test(trimmed)) {
            if (trimmed.includes("MODULE SUMMARY")) {
                inModuleSummary = true;
                pendingModuleName = null;
                continue;
            } else if (inModuleSummary) {
                break; // Stop when hitting another section header
            }
        }

        if (!inModuleSummary) continue;

        // Match actual MODULE SUMMARY column header line strictly (never false-match e.g. "decode.o")
        const isColumnHeader =
            /\b(ro\s+code|rw\s+code|ro\s+data|rw\s+data|code\s+size|data\s+size)\b/i.test(trimmed) ||
            (/^module\s+/i.test(trimmed) && /\b(code|const|data)\b/i.test(trimmed));

        if (isColumnHeader) {
            headers = parseHeaders(line);
            parseSeparatorOnNextLine = true;
            pendingModuleName = null;
            continue;
        }

        // Handle Grand Total line (capture reference totals before stopping/skipping)
        if (/^grand\s+total\s*:/i.test(trimmed)) {
            pendingModuleName = null;
            const afterLabelIdx = line.indexOf(":") + 1;
            const numSpans = columnSpans ? columnSpans.slice(1) : null;
            const tokens = extractNumericTokens(line.substring(afterLabelIdx), afterLabelIdx, numSpans);
            if (headers.length > 0 && tokens.length > 0) {
                const gt = { roCode: 0, rwCode: 0, roData: 0, rwData: 0, roCodeAbs: 0, rwCodeAbs: 0, roDataAbs: 0, rwDataAbs: 0 };
                const colIndices = assignTokensToColumns(tokens, headers, columnSpans);
                tokens.forEach((tok, idx) => {
                    const key = headers[colIndices[idx]];
                    if (key) gt[key] = tok.value;
                });
                gt.romSize = gt.roCode + gt.roData;
                gt.ramSize = gt.rwData + gt.rwCode;
                grandTotal = gt;
            }
            continue;
        }

        // Skip separators and group Total lines
        if (trimmed.startsWith("---") || trimmed.startsWith("===") || /^total\s*:/i.test(trimmed)) {
            pendingModuleName = null;
            if (parseSeparatorOnNextLine && (trimmed.startsWith("---") || trimmed.startsWith("==="))) {
                columnSpans = parseColumnSpans(line);
                parseSeparatorOnNextLine = false;
            }
            continue;
        }

        if (trimmed === "") continue;

        const startsWithSpace = line.startsWith(" ") || line.startsWith("\t");

        if (startsWithSpace) {
            const numSpans = columnSpans && columnSpans.length >= 2 ? columnSpans.slice(1) : null;
            const col1Start = numSpans ? columnSpans[1].start : -1;

            let cleanedName = "";
            let tokens = [];

            if (col1Start > 0) {
                const leftPart = line.substring(0, col1Start);
                const leftTrimmed = leftPart.trim();

                if (!leftTrimmed) {
                    // Wrapped continuation line with numbers only
                    cleanedName = pendingModuleName || "";
                    tokens = extractNumericTokens(line, 0, numSpans);
                    pendingModuleName = null;
                } else {
                    // Check if the full line ends with a valid right-aligned numeric column block
                    // (handles overflowing col1 left-shift and long module names extending past col1Start)
                    let tailStartIdx = -1;

                    // Case A: number in column 1 overflowed left of col1Start
                    const overflowMatch = leftPart.match(/^(.*\S)\s{2,}(\d[\d', ]*[',]?)$/);
                    if (overflowMatch && /^(?:\d|[',]\d| \d{3})/.test(line.substring(col1Start))) {
                        cleanedName = overflowMatch[1].replace(/:$/, "").trim();
                        tailStartIdx = overflowMatch[1].length;
                    } else {
                        const rightPart = line.substring(col1Start);
                        if (/^\s*$/.test(rightPart)) {
                            // Wrapped long module name ending before col1Start with no numeric data
                            cleanedName = trimmed.replace(/:$/, "").trim();
                        } else if (/^[\s\d',]*$/.test(rightPart) && /\s$/.test(leftPart)) {
                            // Standard row: module name sits strictly left of col1Start, numeric zone begins at col1Start
                            cleanedName = leftTrimmed.replace(/:$/, "").trim();
                            tailStartIdx = col1Start;
                        } else {
                            // Long module name extending across/beyond col1Start, or single-space gap before overflowing col1
                            const lastSymMatch = line.match(/.*[^\s\d',]/);
                            if (lastSymMatch) {
                                const afterStart = lastSymMatch[0].length;
                                const afterSym = line.substring(afterStart);
                                const splitMatch = afterSym.match(/^(\S*)\s+(\d[\d', ]*)$/);
                                if (splitMatch) {
                                    cleanedName = line.substring(0, afterStart + splitMatch[1].length).replace(/:$/, "").trim();
                                    const numStart = line.length - splitMatch[2].length;
                                    const candTokens = extractNumericTokens(splitMatch[2], numStart, numSpans);
                                    if (candTokens.length > 0 && candTokens[candTokens.length - 1].end > col1Start) {
                                        tokens = candTokens;
                                    } else {
                                        cleanedName = trimmed.replace(/:$/, "").trim();
                                    }
                                } else {
                                    cleanedName = trimmed.replace(/:$/, "").trim();
                                }
                            } else {
                                cleanedName = trimmed.replace(/:$/, "").trim();
                            }
                        }
                    }

                    if (tailStartIdx >= 0) {
                        tokens = extractNumericTokens(line.substring(tailStartIdx), tailStartIdx, numSpans);
                    }
                    pendingModuleName = null;
                }
            } else {
                // Fallback without columnSpans
                const fallbackMatch = trimmed.match(/^([^\s].*?)\s+(\d[\d\s,']*)$/);
                if (fallbackMatch) {
                    cleanedName = fallbackMatch[1].replace(/:$/, "").trim();
                    const firstRel = line.indexOf(cleanedName);
                    const numZoneStart = firstRel + cleanedName.length;
                    tokens = extractNumericTokens(line.substring(numZoneStart), numZoneStart, numSpans);
                } else if (pendingModuleName && /^\d[\d\s,']*$/.test(trimmed)) {
                    cleanedName = pendingModuleName;
                    tokens = extractNumericTokens(line, 0, numSpans);
                    pendingModuleName = null;
                } else {
                    cleanedName = trimmed.replace(/:$/, "").trim();
                }
            }

            if (tokens.length === 0) {
                // Possible wrapped long module name waiting for numbers on the next line
                if (cleanedName && !/^total$/i.test(cleanedName) && !/^grand\s+total$/i.test(cleanedName)) {
                    pendingModuleName = cleanedName;
                }
                continue;
            }

            pendingModuleName = null;
            if (!cleanedName || /^total$/i.test(cleanedName) || /^grand\s+total$/i.test(cleanedName)) {
                continue;
            }

            const lowerCleaned = cleanedName.toLowerCase();
            const isGap = lowerCleaned === "gaps";
            const isLinkerRow = lowerCleaned === "linker created";
            const isCmdConfigRow = lowerCleaned === "command line/config" || /^command line(?:\s*\[\d+\])?$/.test(lowerCleaned);

            if (isGap || isLinkerRow) {
                appendModule(
                    "Linker created",
                    null,
                    isGap ? "Gaps" : "Linker created",
                    tokens.map(t => t.value),
                    tokens,
                    "Linker created",
                    { isLinkerCreated: true, isGap }
                );
            } else if (isCmdConfigRow) {
                appendModule(
                    cleanedName,
                    extractGroupId(line.trim()),
                    cleanedName,
                    tokens.map(t => t.value),
                    tokens,
                    cleanedName,
                    { isLinkerCreated: true, isGap: false }
                );
            } else {
                const isLinkerCreated = currentGroupFull.toLowerCase().startsWith("linker created");
                appendModule(
                    currentGroupFull,
                    currentGroupId,
                    cleanedName,
                    tokens.map(t => t.value),
                    tokens,
                    null,
                    { isLinkerCreated, isGap: false }
                );
            }
        } else if (!trimmed.startsWith("*") && !trimmed.startsWith("-") && !trimmed.startsWith("=")) {
            pendingModuleName = null;
            const numSpans = columnSpans && columnSpans.length >= 2 ? columnSpans.slice(1) : null;

            // Handle special unindented ILINK summary rows that carry numbers directly:
            // e.g. "Gaps                 4              3"
            // e.g. "Linker created      36   2'560" or "Linker created  16  16  9 216"
            // e.g. "command line/config: 4   0   0"
            const specialSingleLineMatch = line.match(/^(Gaps|Linker created|command line\/config:?|command line(?:\s*:\s*\[\d+\])?)(\s+)(.*)$/i);
            if (specialSingleLineMatch) {
                const rawLabel = specialSingleLineMatch[1];
                const prefixLen = rawLabel.length + specialSingleLineMatch[2].length;
                const rest = specialSingleLineMatch[3];
                const tokens = extractNumericTokens(rest, prefixLen, numSpans);

                if (tokens.length > 0) {
                    const cleanLabel = rawLabel.replace(/:\s*\[\d+\]$/, "").replace(/:$/, "").trim();
                    const lowerLabel = cleanLabel.toLowerCase();
                    if (lowerLabel === "gaps") {
                        appendModule("Linker created", null, "Gaps", tokens.map(t => t.value), tokens, "Linker created", { isLinkerCreated: true, isGap: true });
                    } else if (lowerLabel === "linker created") {
                        appendModule("Linker created", null, "Linker created", tokens.map(t => t.value), tokens, "Linker created", { isLinkerCreated: true });
                    } else {
                        const gid = extractGroupId(rawLabel);
                        appendModule(cleanLabel, gid, cleanLabel, tokens.map(t => t.value), tokens, cleanLabel, { isLinkerCreated: true });
                    }
                    continue;
                }
            }

            // Standard group header line (e.g. "rt7M_tl.a: [2]", "C:\Proj\Obj: [1]", "Linker created:")
            currentGroupFull = trimmed;
            currentGroupId = extractGroupId(trimmed);
            getOrCreateRawGroup(currentGroupFull, currentGroupId);
        }
    }

    // Remove empty groups before disambiguating names so unused "command line: [2]" doesn't pollute
    const nonEmptyGroups = rawGroupOrder.filter(g => g.modules.length > 0);
    disambiguateGroupNames(nonEmptyGroups);

    // Build final groups dictionary & assign disambiguated group display names + sequential fallback RAM addresses
    const groups = {};
    let maxExplicitRamEnd = 0;
    let hasAnyExplicitRam = false;

    nonEmptyGroups.forEach(grp => {
        grp.modules.forEach(mod => {
            if (mod.hasExplicitRamAddr && mod.ramSections && mod.ramSections.length > 0) {
                hasAnyExplicitRam = true;
                mod.ramSections.forEach(sec => {
                    const secEnd = sec.address + sec.size;
                    if (secEnd > maxExplicitRamEnd) maxExplicitRamEnd = secEnd;
                });
            } else if (mod.hasExplicitRamAddr && mod.ramAddress !== undefined) {
                hasAnyExplicitRam = true;
                const end = mod.ramAddress + mod.ramSize;
                if (end > maxExplicitRamEnd) maxExplicitRamEnd = end;
            }
        });
    });

    // Place fallback RAM modules (when a map omits PLACEMENT SUMMARY RAM entries) after any explicit RAM or at 0x20000000
    let currentFallbackRamAddr = hasAnyExplicitRam
        ? Math.ceil(maxExplicitRamEnd / 4) * 4
        : 0x20000000;

    nonEmptyGroups.forEach(grp => {
        grp.modules.forEach(mod => {
            mod.group = grp.displayName;
            if (!mod.hasExplicitRamAddr) {
                if (mod.ramSize > 0 && !(mod.isGap && hasAnyExplicitRam)) {
                    mod.ramAddress = currentFallbackRamAddr;
                    const alignedSize = Math.ceil(mod.ramSize / 4) * 4;
                    currentFallbackRamAddr += Math.max(alignedSize, 4);
                } else {
                    mod.ramAddress = hasAnyExplicitRam ? undefined : 0x20000000;
                }
            }
            mod.ramArea = getRomAreaName(mod.ramAddress !== undefined ? mod.ramAddress : 0x20000000);
        });

        groups[grp.displayName] = {
            name: grp.displayName,
            fullName: grp.fullName,
            groupId: grp.groupId,
            modules: grp.modules
        };
    });

    // Extract active build configuration path hints from map groups (e.g. "Debug", "Release")
    const pathHints = nonEmptyGroups.map(g => g.fullName);

    return {
        groups,
        pathHints,
        totals: {
            roCode: totalRoCode,
            rwCode: totalRwCode,
            roData: totalRoData,
            rwData: totalRwData,
            roCodeAbs: totalRoCodeAbs,
            rwCodeAbs: totalRwCodeAbs,
            roDataAbs: totalRoDataAbs,
            rwDataAbs: totalRwDataAbs,
            romSize: totalRoCode + totalRoData,
            ramSize: totalRwData + totalRwCode
        },
        grandTotal
    };
}

/**
 * Checks whether a file extension represents an IAR source or object/library file
 * (as opposed to headers/linker configs/docs included in .ewp groups).
 * @param {string} filename
 * @returns {boolean}
 */
function isCompilableEwpExtension(filename) {
    return /\.(?:c|cpp|cc|cxx|c\+\+|s|asm|s\d+|o|obj|a|lib)$/i.test(filename || "");
}

/**
 * Parses an IAR Embedded Workbench project (.ewp) XML file.
 * Returns a hierarchical folder structure containing files, configurations, and exclusion info.
 * @param {string} xmlText 
 * @returns {Object} { configurations, rootGroups, rootFiles, fileMap, fileEntries }
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

    const projectEl = xmlDoc.querySelector("project");
    if (!projectEl) {
        throw new Error("Invalid EWP file: <project> element not found.");
    }

    // Collect defined project configuration names (e.g., ["Debug", "Release"])
    const configurations = [];
    Array.from(projectEl.children).forEach(child => {
        if (child.tagName.toLowerCase() === "configuration") {
            const cNameEl = Array.from(child.children).find(c => c.tagName.toLowerCase() === "name");
            if (cNameEl && cNameEl.textContent.trim()) {
                configurations.push(cNameEl.textContent.trim());
            }
        }
    });

    const getExcludedConfigs = (el, inheritedExcluded) => {
        const excluded = new Set(inheritedExcluded || []);
        const exclEl = Array.from(el.children).find(c => c.tagName.toLowerCase() === "excluded");
        if (exclEl) {
            Array.from(exclEl.children).forEach(c => {
                if (c.tagName.toLowerCase() === "configuration" && c.textContent.trim()) {
                    excluded.add(c.textContent.trim());
                }
            });
        }
        return excluded;
    };

    const fileMap = new Map();     // stem (lowercase) -> Array<string> of non-universally-excluded folderPaths
    const fileEntries = new Map(); // stem (lowercase) -> Array<{ folderPath, filename, rawPath, isCompilable, excludedConfigs }>

    const addFileEntry = (rawPath, currentPath, inheritedExcluded, fileEl) => {
        const normPath = rawPath.replace(/\\/g, "/");
        const filename = normPath.split("/").pop() || rawPath;
        const stem = filename.replace(/\.[^/.]+$/, "").toLowerCase();
        const excludedConfigs = getExcludedConfigs(fileEl, inheritedExcluded);
        const isCompilable = isCompilableEwpExtension(filename);

        const entry = {
            rawPath,
            filename,
            stem,
            folderPath: currentPath,
            isCompilable,
            excludedConfigs
        };

        // Ignore files excluded in ALL known configurations
        const excludedInAll = configurations.length > 0 && configurations.every(cfg => excludedConfigs.has(cfg));
        if (!excludedInAll) {
            if (!fileEntries.has(stem)) fileEntries.set(stem, []);
            fileEntries.get(stem).push(entry);

            if (!fileMap.has(stem)) fileMap.set(stem, []);
            fileMap.get(stem).push(currentPath);
        }

        return entry;
    };

    function parseGroup(groupEl, parentPath, inheritedExcluded) {
        const nameEl = Array.from(groupEl.children).find(c => c.tagName.toLowerCase() === "name");
        const groupName = nameEl ? nameEl.textContent.trim() : "Unnamed Folder";
        const currentPath = parentPath ? `${parentPath}/${groupName}` : groupName;
        const groupExcluded = getExcludedConfigs(groupEl, inheritedExcluded);

        const subGroups = [];
        const files = [];

        Array.from(groupEl.children).forEach(child => {
            const tag = child.tagName.toLowerCase();
            if (tag === "group") {
                subGroups.push(parseGroup(child, currentPath, groupExcluded));
            } else if (tag === "file") {
                const fNameEl = Array.from(child.children).find(c => c.tagName.toLowerCase() === "name");
                if (fNameEl) {
                    const entry = addFileEntry(fNameEl.textContent.trim(), currentPath, groupExcluded, child);
                    files.push(entry);
                }
            }
        });

        return {
            name: groupName,
            path: currentPath,
            excludedConfigs: groupExcluded,
            groups: subGroups,
            files: files
        };
    }

    const rootGroups = [];
    const rootFiles = [];

    Array.from(projectEl.children).forEach(child => {
        const tag = child.tagName.toLowerCase();
        if (tag === "group") {
            rootGroups.push(parseGroup(child, "", new Set()));
        } else if (tag === "file") {
            const fNameEl = Array.from(child.children).find(c => c.tagName.toLowerCase() === "name");
            if (fNameEl) {
                rootFiles.push(addFileEntry(fNameEl.textContent.trim(), "Root", new Set(), child));
            }
        }
    });

    return {
        configurations,
        rootGroups,
        rootFiles,
        fileMap,
        fileEntries
    };
}

/**
 * Infers which EWP build configuration likely produced the parsed map file
 * by matching group directory paths (e.g. ...\Debug\Obj: [1] -> "Debug").
 * @param {Object|null} parsedEwpData
 * @param {Object|null} parsedMapData
 * @returns {string|null}
 */
function inferActiveEwpConfig(parsedEwpData, parsedMapData) {
    if (!parsedEwpData || !parsedEwpData.configurations || parsedEwpData.configurations.length === 0) return null;
    if (!parsedMapData || !parsedMapData.pathHints) return null;

    for (const cfg of parsedEwpData.configurations) {
        const lowerCfg = cfg.toLowerCase();
        const matched = parsedMapData.pathHints.some(hint => {
            const segments = hint.replace(/:\s*\[\d+\]$/, "").toLowerCase().split(/[/\\]/);
            return segments.includes(lowerCfg);
        });
        if (matched) return cfg;
    }
    return null;
}

/**
 * Resolves a module's EWARM folder path cleanly, handling multi-dot names (foo.bar.o),
 * CMake names (foo.c.o), header vs source disambiguation, and configuration exclusions.
 * @param {Object} moduleObj
 * @param {Object|null} parsedEwpData
 * @param {Object|null} parsedMapData
 * @param {string|null} [activeConfig]
 * @returns {string}
 */
function resolveModuleFolderPath(moduleObj, parsedEwpData, parsedMapData, activeConfig = null) {
    const fileEntries = parsedEwpData && parsedEwpData.fileEntries ? parsedEwpData.fileEntries : null;
    const fileMap = parsedEwpData && parsedEwpData.fileMap ? parsedEwpData.fileMap : null;

    const rawNoObj = moduleObj.name.replace(/\.o(?:bj)?$/i, "");
    const candidateStems = [rawNoObj.toLowerCase()];
    const strippedExt = rawNoObj.replace(/\.[^/.]+$/, "").toLowerCase();
    if (strippedExt && strippedExt !== candidateStems[0]) {
        candidateStems.push(strippedExt);
    }

    if (fileEntries) {
        for (const stem of candidateStems) {
            const entries = fileEntries.get(stem);
            if (!entries || entries.length === 0) continue;

            // Filter out files explicitly excluded in the active configuration
            let candidates = entries;
            if (activeConfig) {
                const activeCandidates = entries.filter(e => !e.excludedConfigs || !e.excludedConfigs.has(activeConfig));
                if (activeCandidates.length > 0) {
                    candidates = activeCandidates;
                } else {
                    // All matching entries are excluded in active config
                    continue;
                }
            }

            // Prefer compilable source/object extensions (.c, .cpp, .s, etc.) over header files (.h)
            const sourceCandidate = candidates.find(e => e.isCompilable);
            return (sourceCandidate || candidates[0]).folderPath;
        }
    } else if (fileMap) {
        for (const stem of candidateStems) {
            if (fileMap.has(stem) && fileMap.get(stem).length > 0) {
                return fileMap.get(stem)[0];
            }
        }
    }

    if (moduleObj.group && !/^obj(?:\s*\[\d+\])?$/i.test(moduleObj.group) && moduleObj.group !== "Unknown Group") {
        return `Libraries & System/${moduleObj.group}`;
    }
    return "Unassigned Modules";
}

/**
 * Flexible module tree builder for ECharts treemap.
 * @param {Object} parsedMapData { groups, totals }
 * @param {Object} [parsedEwpData] { rootGroups, rootFiles, fileMap, fileEntries }
 * @param {string} [groupingMode='library'] 'none' | 'library' | 'folder'
 * @param {string} [metric='rom'] 'rom' | 'ram'
 * @param {string} [targetRomArea=null] Filter to a specific Memory Area if provided
 * @returns {Array} ECharts treemap nodes hierarchy
 */
function buildModuleTree(parsedMapData, parsedEwpData, groupingMode = 'library', metric = 'rom', targetRomArea = null) {
    if (!parsedMapData || !parsedMapData.groups) return [];

    const globalRomTotal = parsedMapData.totals.romSize || 0;
    const globalRamTotal = parsedMapData.totals.ramSize !== undefined
        ? parsedMapData.totals.ramSize
        : (parsedMapData.totals.rwData || 0);
    const activeConfig = inferActiveEwpConfig(parsedEwpData, parsedMapData);

    // Collect filtered modules
    const modules = [];
    let areaTotal = 0;

    for (const grpName in parsedMapData.groups) {
        const groupObj = parsedMapData.groups[grpName];
        groupObj.modules.forEach(m => {
            const mArea = metric === 'ram' ? (m.ramArea || m.romArea) : m.romArea;
            if (targetRomArea && mArea !== targetRomArea) return;

            const ramBytes = m.ramSize !== undefined ? m.ramSize : ((m.rwData || 0) + (m.rwCode || 0));
            const mSize = metric === 'ram' ? ramBytes : m.romSize;
            if (mSize <= 0) return;

            const folderPath = resolveModuleFolderPath(m, parsedEwpData, parsedMapData, activeConfig);

            areaTotal += mSize;
            modules.push({
                ...m,
                rwCode: m.rwCode || 0,
                ramSize: ramBytes,
                mSize: mSize,
                folderPath: folderPath
            });
        });
    }

    if (modules.length === 0) return [];

    // Helper to create module leaf node for ECharts
    function createLeafNode(m) {
        return {
            id: `${m.group}::${m.name}`,
            name: m.name,
            value: m.mSize,
            roCode: m.roCode,
            rwCode: m.rwCode,
            roData: m.roData,
            rwData: m.rwData,
            romSize: m.romSize,
            ramSize: m.ramSize,
            percentage: areaTotal > 0 ? (m.mSize / areaTotal) * 100 : 0,
            romPercentage: globalRomTotal > 0 ? (m.romSize / globalRomTotal) * 100 : 0,
            ramPercentage: globalRamTotal > 0 ? (m.ramSize / globalRamTotal) * 100 : 0,
            group: m.group,
            romArea: m.romArea,
            ramArea: m.ramArea || m.romArea,
            folderPath: m.folderPath
        };
    }

    // MODE 1: NO GROUPING ('none')
    if (groupingMode === 'none') {
        return modules.map(m => createLeafNode(m));
    }

    // MODE 2: LIBRARY GROUPING ('library')
    if (groupingMode === 'library') {
        const groupMap = new Map();
        modules.forEach(m => {
            const grpKey = m.group || "Obj";
            if (!groupMap.has(grpKey)) {
                groupMap.set(grpKey, []);
            }
            groupMap.get(grpKey).push(m);
        });

        const result = [];
        groupMap.forEach((modList, grpKey) => {
            let grpSum = 0;
            let grpRomSum = 0;
            let grpRamSum = 0;
            const children = modList.map(m => {
                grpSum += m.mSize;
                grpRomSum += m.romSize;
                grpRamSum += m.ramSize;
                return createLeafNode(m);
            });

            if (grpSum > 0) {
                result.push({
                    id: grpKey,
                    name: grpKey,
                    value: grpSum,
                    percentage: areaTotal > 0 ? (grpSum / areaTotal) * 100 : 0,
                    romPercentage: globalRomTotal > 0 ? (grpRomSum / globalRomTotal) * 100 : 0,
                    ramPercentage: globalRamTotal > 0 ? (grpRamSum / globalRamTotal) * 100 : 0,
                    children: children
                });
            }
        });

        return result;
    }

    // MODE 3: EWARM FOLDER GROUPING ('folder')
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

    modules.forEach(m => {
        const pathParts = m.folderPath ? m.folderPath.split("/") : ["Unassigned Modules"];
        const targetNode = getOrCreateNode(pathParts);
        targetNode.modules.push(m);
    });

    function convertFolderNodesToEcharts(nodesMap) {
        const result = [];

        nodesMap.forEach(node => {
            let nodeSum = 0;
            let nodeRomSum = 0;
            let nodeRamSum = 0;
            const children = [];

            if (node.childrenMap.size > 0) {
                const childFolderNodes = convertFolderNodesToEcharts(node.childrenMap);
                childFolderNodes.forEach(c => {
                    nodeSum += c.value;
                    nodeRomSum += c.romSize || 0;
                    nodeRamSum += c.ramSize || 0;
                    children.push(c);
                });
            }

            node.modules.forEach(m => {
                nodeSum += m.mSize;
                nodeRomSum += m.romSize;
                nodeRamSum += m.ramSize;
                children.push(createLeafNode(m));
            });

            if (nodeSum > 0) {
                result.push({
                    id: node.fullPath,
                    name: node.name,
                    fullPath: node.fullPath,
                    value: nodeSum,
                    romSize: nodeRomSum,
                    ramSize: nodeRamSum,
                    percentage: areaTotal > 0 ? (nodeSum / areaTotal) * 100 : 0,
                    romPercentage: globalRomTotal > 0 ? (nodeRomSum / globalRomTotal) * 100 : 0,
                    ramPercentage: globalRamTotal > 0 ? (nodeRamSum / globalRamTotal) * 100 : 0,
                    children: children
                });
            }
        });

        return result;
    }

    return convertFolderNodesToEcharts(treeRoot);
}

if (typeof exports !== 'undefined') {
    exports.parseMapFile = parseMapFile;
    exports.cleanGroupName = cleanGroupName;
    exports.parseHeaders = parseHeaders;
    exports.parseEwpFile = parseEwpFile;
    exports.buildModuleTree = buildModuleTree;
    exports.getRomAreaName = getRomAreaName;
    exports.resolveModuleFolderPath = resolveModuleFolderPath;
    exports.inferActiveEwpConfig = inferActiveEwpConfig;
    exports.formatHexAddress = formatHexAddress;
    exports.escapeHtml = escapeHtml;
}
