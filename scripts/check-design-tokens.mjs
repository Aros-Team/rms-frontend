#!/usr/bin/env node
/**
 * Design-token gate.
 *
 * Scans Angular templates for the patterns the design-system migration closed:
 * PrimeNG legacy controls, palette/surface classes, manual dark variants, raw
 * hex values and numeric z-index. ESLint cannot express class-name rules, so
 * this is the machine-checkable half of docs/DESIGN.md section 11.1.
 *
 * The dev gallery is exempt: it deliberately renders legacy PrimeNG controls
 * side by side with the primitives (docs/DESIGN.md section 9.5).
 *
 * Usage: node scripts/check-design-tokens.mjs
 * Exit: 0 clean, 1 violations found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src', 'app');
const EXEMPT = [join(SRC, 'shared', 'ui', 'gallery')];

const RULES = [
  {
    id: 'legacy-control',
    re: /<\/?p-button\b|\bpInputText\b|\bpTextarea\b/g,
    message: 'use app-rms-button / app-rms-input / app-rms-textarea',
  },
  {
    id: 'surface-class',
    re: /\b(?:text|bg|border|ring|from|to|via)-surface-\d+\b/g,
    message: 'use the semantic rms-* utilities (text-rms-ink, bg-rms-surface...)',
  },
  {
    id: 'dark-variant',
    re: /\bdark:/g,
    message: 'tokens already switch with the theme; no dark: pair needed',
  },
  {
    id: 'palette-class',
    re: /\b(?:text|bg|border|ring|from|to|via|placeholder:text)-(?:red|green|blue|amber|emerald|orange|indigo|purple|pink|rose|teal|cyan|lime|violet|sky|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g,
    message: 'use a status/semantic token instead of the raw palette',
  },
  {
    id: 'legacy-primary',
    re: /\b(?:bg|border|text)-primary(?![-a-z])/g,
    message: 'use bg-rms-brand / border-rms-brand-text / text-rms-brand-text',
  },
  {
    id: 'raw-hex',
    re: /#[0-9a-fA-F]{6}\b/g,
    message: 'raw colours live only in src/styles/tokens.css',
  },
  {
    id: 'raw-z-index',
    re: /\bz-\[\s*\d/g,
    message: 'use the --rms-z-* layer tokens',
  },
];

function* templates(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (EXEMPT.some((exempt) => path.startsWith(exempt))) continue;
      yield* templates(path);
    } else if (entry.endsWith('.html')) {
      yield path;
    }
  }
}

const violations = [];
for (const file of templates(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        violations.push({
          file: relative(ROOT, file),
          line: index + 1,
          rule: rule.id,
          message: rule.message,
          text: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('design:check OK - no legacy controls, palette classes or raw values in templates.');
  process.exit(0);
}

console.error(`design:check failed with ${String(violations.length)} violation(s):\n`);
for (const violation of violations) {
  console.error(
    `  ${violation.file}:${String(violation.line)}  [${violation.rule}] ${violation.message}`,
  );
  console.error(`    ${violation.text}`);
}
console.error('\nSee docs/DESIGN.md section 11 (migration rules).');
process.exit(1);
