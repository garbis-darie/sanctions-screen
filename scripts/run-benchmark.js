#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { screen } from "../lib/screen.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function evaluateCase(testCase, threshold) {
  const result = screen(testCase.query, { threshold, include_explainability: true });
  const top = result.matches[0] ?? null;
  const predictedHit = result.hit;
  const expectedHit = Boolean(testCase.expected_hit);
  const idMatch =
    !expectedHit || !testCase.expected_entry_id
      ? true
      : Boolean(top && top.entry_id === testCase.expected_entry_id);

  return {
    query: testCase.query,
    expected_hit: expectedHit,
    predicted_hit: predictedHit,
    expected_entry_id: testCase.expected_entry_id ?? null,
    top_entry_id: top ? top.entry_id : null,
    top_score: top ? top.score : null,
    pass: predictedHit === expectedHit && idMatch,
    note: testCase.note ?? ""
  };
}

function toMarkdown(summary, rows, meta) {
  const header = [
    "# sanctions-screen benchmark",
    "",
    `Corpus: \`${meta.corpusPath}\``,
    `Threshold: \`${meta.threshold}\``,
    "",
    `- Total cases: **${summary.total_cases}**`,
    `- True positives: **${summary.tp}**`,
    `- False positives: **${summary.fp}**`,
    `- True negatives: **${summary.tn}**`,
    `- False negatives: **${summary.fn}**`,
    `- Precision: **${summary.precision}**`,
    `- Recall: **${summary.recall}**`,
    `- Accuracy: **${summary.accuracy}**`,
    "",
    "| Query | Expected | Predicted | Expected Entry | Top Entry | Top Score | Pass |",
    "|---|---:|---:|---|---|---:|---:|"
  ];

  const table = rows.map(
    (r) =>
      `| ${r.query} | ${r.expected_hit} | ${r.predicted_hit} | ${r.expected_entry_id ?? "-"} | ${r.top_entry_id ?? "-"} | ${r.top_score ?? "-"} | ${r.pass} |`
  );
  return [...header, ...table, ""].join("\n");
}

const args = parseArgs(process.argv);
const threshold = Number(args.threshold ?? 0.75);
const corpusPath = path.resolve(
  process.cwd(),
  args.corpus ?? "./benchmarks/corpus.json"
);
const outPath = path.resolve(
  process.cwd(),
  args.out ?? "./benchmarks/results.json"
);
const outMdPath = outPath.replace(/\.json$/i, ".md");

const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const rows = corpus.map((testCase) => evaluateCase(testCase, threshold));

let tp = 0;
let fp = 0;
let tn = 0;
let fn = 0;
for (const row of rows) {
  if (row.expected_hit && row.predicted_hit) tp += 1;
  if (!row.expected_hit && row.predicted_hit) fp += 1;
  if (!row.expected_hit && !row.predicted_hit) tn += 1;
  if (row.expected_hit && !row.predicted_hit) fn += 1;
}

const precision = tp + fp ? tp / (tp + fp) : 0;
const recall = tp + fn ? tp / (tp + fn) : 0;
const accuracy = rows.length ? (tp + tn) / rows.length : 0;

const summary = {
  total_cases: rows.length,
  tp,
  fp,
  tn,
  fn,
  precision: round(precision),
  recall: round(recall),
  accuracy: round(accuracy),
  generated_at: new Date().toISOString(),
  label: "Synthetic-benchmark"
};

const payload = { summary, rows };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
fs.writeFileSync(outMdPath, toMarkdown(summary, rows, { corpusPath, threshold }));

console.log(`Benchmark results: ${outPath}`);
console.log(`Benchmark report: ${outMdPath}`);
