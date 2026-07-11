#!/usr/bin/env node
/**
 * validateEditRoutes.js — guardrail against HALLUCINATED database APIs in per-collection edit routes.
 *
 * WHY THIS EXISTS (June 2026): a code-gen/agent batch produced 45 routes/edit/*.js that called a
 * NON-EXISTENT method — `const db = await sda.accessData(col, ctx); db.collection.updateOne(...)`.
 * secureDataAccess has NO accessData() method (it exports update()/delete()), so every save threw
 * "sda.accessData is not a function" => HTTP 500. node --check / esbuild could NOT catch it because the
 * call is syntactically valid; it only fails at runtime. This validator catches the whole class
 * DETERMINISTICALLY by checking every sda.<method>() call against the methods that actually exist on
 * SecureDataAccess, and by banning the known-bad fabricated patterns.
 *
 * Real persistence API (reference: routes/edit/medications.js, lab_results.js):
 *   const sda = getSecureDataAccess();
 *   await sda.update('<collection>', <filter>, { $set: {...}, $addToSet: {...} }, <context>);
 *
 * Run manually:  node apps/backend-api/scripts/validateEditRoutes.js
 * Wired into a PostToolUse(Edit|Write) hook + the edit-route checklist. Exit 1 on any violation.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EDIT_DIR = path.join(ROOT, 'routes', 'edit');
const SDA_FILE = path.join(ROOT, 'services', 'secureDataAccess.js');

// 1) Derive the REAL public methods of SecureDataAccess from its source (live — never hardcode).
const sdaSrc = fs.readFileSync(SDA_FILE, 'utf8');
const realMethods = new Set();
const methodRe = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;
let mm;
while ((mm = methodRe.exec(sdaSrc))) realMethods.add(mm[1]);
// drop constructor + JS control-flow keywords the cheap method regex can also match
['constructor', 'for', 'if', 'switch', 'while', 'catch', 'do', 'else', 'try', 'return', 'function'].forEach(k => realMethods.delete(k));

// 2) Known fabricated patterns that are always wrong inside an edit route.
const FORBIDDEN = [
  { re: /\.accessData\s*\(/, msg: 'fabricated API: .accessData() does not exist on secureDataAccess — use sda.update()' },
  { re: /\bdb\.collection\b/, msg: 'raw db.collection.* access is not allowed — persist via sda.update()/sda.delete()' },
];

// Strip comments so documentation that mentions a banned name does not false-positive.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = fs.readdirSync(EDIT_DIR).filter(f => f.endsWith('.js'));
const violations = [];

for (const f of files) {
  const code = stripComments(fs.readFileSync(path.join(EDIT_DIR, f), 'utf8'));

  for (const { re, msg } of FORBIDDEN) {
    if (re.test(code)) violations.push(`${f}: ${msg}`);
  }

  // Every sda.<method>() call must be a method that actually exists.
  const callRe = /\bsda\.(\w+)\s*\(/g;
  let cm;
  const bad = new Set();
  while ((cm = callRe.exec(code))) {
    if (!realMethods.has(cm[1])) bad.add(cm[1]);
  }
  for (const name of bad) {
    violations.push(`${f}: sda.${name}() is not a SecureDataAccess method`);
  }
}

if (violations.length) {
  console.error(`❌ Edit-route API validation FAILED — ${violations.length} violation(s):`);
  for (const v of violations) console.error('   - ' + v);
  console.error(`\nReal secureDataAccess methods: ${[...realMethods].sort().join(', ')}`);
  console.error('Fix: mirror routes/edit/lab_results.js (array editing) or medications.js (simple).');
  process.exit(1);
}

console.log(`✅ All ${files.length} edit routes use valid secureDataAccess APIs (methods: ${[...realMethods].sort().join(', ')}).`);
process.exit(0);
