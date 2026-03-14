/**
 * Sanctions Screening Engine
 *
 * Fuzzy name matching against consolidated sanctions lists (OFAC, EU, UN).
 * Uses Levenshtein distance + phonetic normalisation for robust matching
 * across transliterations, aliases, and partial names.
 */

// ── Mock consolidated sanctions list ─────────────────────────────────────
// In production, this would be loaded from OFAC SDN, EU consolidated list,
// and UN Security Council sanctions data feeds.
const SANCTIONS_LIST = [
  { id: 'OFAC-12345', name: 'Viktor Bout',           aliases: ['Victor But', 'Viktor Butt'], list: 'OFAC-SDN', jurisdiction: 'US', program: 'SDGT',      entity_type: 'individual' },
  { id: 'OFAC-67890', name: 'Hydra Market',           aliases: ['Hydra Marketplace'],          list: 'OFAC-SDN', jurisdiction: 'US', program: 'CYBER2',    entity_type: 'entity' },
  { id: 'EU-2022-001', name: 'Garantex Europe OU',    aliases: ['Garantex'],                   list: 'EU-CFSP',  jurisdiction: 'EU', program: 'RUSSIA',    entity_type: 'entity' },
  { id: 'UN-6908',    name: 'Al-Qaida',               aliases: ['Al-Qaeda', 'Al Qaida'],       list: 'UN-1267',  jurisdiction: 'UN', program: '1267/1989', entity_type: 'entity' },
  { id: 'OFAC-11111', name: 'Tornado Cash',           aliases: ['Tornado.cash'],               list: 'OFAC-SDN', jurisdiction: 'US', program: 'CYBER2',    entity_type: 'entity' },
  { id: 'EU-2023-047', name: 'Suex OTC',              aliases: ['Suex'],                       list: 'EU-CFSP',  jurisdiction: 'EU', program: 'RUSSIA',    entity_type: 'entity' },
  { id: 'OFAC-22222', name: 'Lazarus Group',          aliases: ['HIDDEN COBRA', 'APT38'],      list: 'OFAC-SDN', jurisdiction: 'US', program: 'DPRK',      entity_type: 'entity' },
  { id: 'UN-7200',    name: 'Islamic State of Iraq',  aliases: ['ISIS', 'ISIL', 'Daesh'],      list: 'UN-1267',  jurisdiction: 'UN', program: '1267/1989', entity_type: 'entity' },
];

// ── String normalisation ─────────────────────────────────────────────────

/**
 * Normalises a name for comparison: lowercase, strip diacritics,
 * collapse whitespace, remove common prefixes/suffixes.
 */
export function normalise(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')        // non-alphanumeric → space
    .replace(/\b(the|al|el|de|du|von|van|bin|ibn)\b/g, '') // common particles
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Levenshtein distance ─────────────────────────────────────────────────

/**
 * Computes edit distance between two strings.
 * Used to score fuzzy matches.
 */
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Returns a similarity score between 0 and 1 (1 = exact match).
 */
export function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ── Screening engine ─────────────────────────────────────────────────────

/**
 * @typedef {Object} ScreeningResult
 * @property {string}  query          - Original input name
 * @property {boolean} hit            - Whether any match exceeds the threshold
 * @property {Array}   matches        - Sorted matches above threshold
 * @property {number}  scanned        - Number of list entries scanned
 * @property {string}  screened_at    - ISO timestamp
 */

/**
 * Screens a name against the consolidated sanctions list.
 *
 * @param {string} query         - Name or alias to screen
 * @param {Object} [options]
 * @param {number} [options.threshold=0.75]      - Minimum similarity score (0–1)
 * @param {string} [options.jurisdiction]        - Filter by jurisdiction (US, EU, UN)
 * @param {string} [options.entity_type]         - Filter by entity type (individual, entity)
 * @param {Array}  [options.list]                - Custom sanctions list (defaults to built-in)
 * @returns {ScreeningResult}
 */
export function screen(query, options = {}) {
  const {
    threshold    = 0.75,
    jurisdiction = null,
    entity_type  = null,
    list         = SANCTIONS_LIST,
  } = options;

  const normQuery = normalise(query);
  const matches   = [];

  for (const entry of list) {
    // Apply jurisdiction filter
    if (jurisdiction && entry.jurisdiction !== jurisdiction) continue;
    // Apply entity type filter
    if (entity_type && entry.entity_type !== entity_type) continue;

    // Check primary name
    const nameScore = similarity(normQuery, normalise(entry.name));

    // Check all aliases and take best score
    const aliasScores = (entry.aliases || []).map(
      alias => similarity(normQuery, normalise(alias))
    );
    const bestAliasScore = aliasScores.length > 0 ? Math.max(...aliasScores) : 0;
    const bestScore      = Math.max(nameScore, bestAliasScore);
    const matchedOn      = bestAliasScore > nameScore ? 'alias' : 'primary_name';

    if (bestScore >= threshold) {
      matches.push({
        entry_id:    entry.id,
        name:        entry.name,
        list_source: entry.list,
        jurisdiction: entry.jurisdiction,
        program:     entry.program,
        entity_type: entry.entity_type,
        score:       Math.round(bestScore * 1000) / 1000,
        matched_on:  matchedOn,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return {
    query,
    hit:        matches.length > 0,
    matches,
    scanned:    list.length,
    screened_at: new Date().toISOString(),
  };
}

/**
 * Batch screen multiple names. Returns an array of ScreeningResults.
 *
 * @param {string[]} names
 * @param {Object}   [options]  - Same options as screen()
 * @returns {ScreeningResult[]}
 */
export function batchScreen(names, options = {}) {
  return names.map(name => screen(name, options));
}

export { SANCTIONS_LIST };
