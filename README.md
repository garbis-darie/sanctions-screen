# sanctions-screen

Lightweight sanctions screening engine with fuzzy name matching against OFAC, EU, and UN consolidated lists.

## Evidence Labels

- `Synthetic-benchmark`: scoring and benchmark outputs use mock/synthetic corpus data.
- `Illustrative`: architecture and examples for screening workflow design.

## Decision Model Encoded Here

This repository demonstrates explainable screening support logic:

- normalize noisy names before matching
- compare query against primary names and aliases
- rank candidate matches by transparent scoring
- expose why a match was returned (distance, overlap, normalized values)
- separate "possible match" from "review-required escalation"

## What it does

Takes a name (individual or entity), normalises it (strips diacritics, removes common prefixes like _al-_, _von_, _bin_), and runs Levenshtein-distance fuzzy matching against a consolidated sanctions list spanning OFAC-SDN, EU-CFSP, and UN-1267.

Returns a scored hit list with match confidence, matched field (primary name vs. alias), originating list, jurisdiction, sanctions programme, and explainability metadata.

## Why it exists

Most VASP compliance teams rely on vendor black-box screening APIs. This repo demonstrates the core logic behind name-screening — useful for building internal pre-filters, understanding match scoring, or prototyping screening workflows before committing to a vendor.

## Core logic (`lib/screen.js`)

| Function | Purpose |
|---|---|
| `normalise(name)` | Lowercase, strip diacritics, remove common prefixes, collapse whitespace |
| `levenshtein(a, b)` | Classic DP edit-distance |
| `similarity(a, b)` | `1 - (editDistance / maxLength)` — returns 0–1 score |
| `tokenOverlap(a, b)` | Token-level overlap ratio for explainability context |
| `screen(query, options)` | Screen a single name against the list with configurable threshold, jurisdiction filter, and entity-type filter |
| `batchScreen(names, options)` | Screen multiple names in one call |

## Quick start

```js
import { screen, batchScreen } from './lib/screen.js';

// Single name — exact match
screen('Viktor Bout');
// → { hit: true, matches: [{ score: 1.0, list_source: 'OFAC-SDN', ... }] }

// Fuzzy match — typo tolerance
screen('Victor But', { threshold: 0.75 });
// → { hit: true, matches: [{ score: 0.818, matched_on: 'alias', ... }] }

// Jurisdiction filter
screen('Garantex', { jurisdiction: 'EU' });

// Batch screening
batchScreen(['Tornado Cash', 'Lazarus Group', 'John Smith']);
```

### Explainability output

Each match now includes:

- `matched_value` (exact candidate string that matched)
- `explainability.normalized_query`
- `explainability.normalized_candidate`
- `explainability.edit_distance`
- `explainability.token_overlap_ratio`
- `explainability.similarity`

## Configuration

| Option | Default | Description |
|---|---|---|
| `threshold` | `0.75` | Minimum similarity score (0–1) to count as a hit |
| `jurisdiction` | `null` | Filter by list jurisdiction: `'US'`, `'EU'`, `'UN'` |
| `entity_type` | `null` | Filter by type: `'individual'` or `'entity'` |
| `include_explainability` | `true` | Include explainability metadata per match |

## Covered lists

- **OFAC-SDN** — US Treasury Specially Designated Nationals
- **EU-CFSP** — EU Common Foreign & Security Policy sanctions
- **UN-1267** — UN Security Council consolidated list

> **Note:** The built-in list is a mock dataset for demonstration. In production, replace `SANCTIONS_LIST` with a feed from your consolidated list provider (e.g., Dow Jones, Refinitiv, OpenSanctions).

## Benchmark corpus and backtesting

Run deterministic benchmark tests:

```bash
npm run benchmark
```

Artifacts:
- `benchmarks/results.json`
- `benchmarks/results.md`

The benchmark corpus (`benchmarks/corpus.json`) includes:
- exact hits
- alias hits
- typo/transliteration cases
- expected non-hits

## Guardrails

- Synthetic corpus only; results are directional.
- This engine is decision support, not legal advice.
- Positive match output should route to analyst review and documented escalation policy.

## Roadmap

- [ ] Phonetic matching (Soundex / Metaphone) as secondary scoring layer
- [ ] REST API endpoint for real-time screening
- [ ] CSV/JSON bulk import for batch operations
- [ ] Configurable list loader (fetch from OpenSanctions API)
- [x] Match explainability metadata

## License

MIT
