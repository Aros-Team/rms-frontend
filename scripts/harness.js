#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

let exitCode = 0;

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const NC = '\x1b[0m';

const ok = (msg) => console.log(`${GREEN}[OK]${NC}    ${msg}`);
const warn = (msg) => console.log(`${YELLOW}[WARN]${NC}  ${msg}`);
const fail = (msg) => { console.log(`${RED}[FAIL]${NC}  ${msg}`); exitCode = 1; };

console.log('── 1. Environment Check ─────────────────────────────');

if (!commandExists('node')) {
  fail('node is not installed');
  process.exit(1);
}
ok(`node -> ${execSync('node --version', { encoding: 'utf8' }).trim()}`);

if (!commandExists('npm')) {
  fail('npm is not installed');
  process.exit(1);
}
ok(`npm -> ${execSync('npm --version', { encoding: 'utf8' }).trim()}`);

console.log('\n── 2. Base Harness Files ─────────────────────────────');

const baseFiles = [
  'AGENTS.md',
  'activities.json',
  'progress/current.md',
  'progress/history.md',
  'docs/architecture.md',
  'docs/conventions.md',
  'docs/verification.md',
  'docs/CHECKPOINTS.md',
];

for (const f of baseFiles) {
  const filePath = path.join(PROJECT_ROOT, f);
  if (!fs.existsSync(filePath)) {
    fail(`Missing base file: ${f}`);
  } else {
    ok(`Exists ${f}`);
  }
}

console.log('\n── 3. Validating activities.json ────────────────────');

try {
  const data = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'activities.json'), 'utf8'));
  const validStatuses = new Set(['pending', 'in_progress', 'done', 'blocked']);
  const validTypes = new Set(['fix', 'feat', 'chore']);
  const inProgress = data.activities.filter(a => a.status === 'in_progress');

  if (inProgress.length > 1) {
    fail(`Found ${inProgress.length} activities in in_progress (max 1)`);
    exitCode = 1;
  }

  for (const a of data.activities) {
    if (a.status === 'done' && a.tasks && a.tasks.some(t => t.status !== 'done')) {
      warn(`Activity ${a.id} is done but has tasks not done`);
    }
  }

  for (const a of inProgress) {
    if (!a.tasks || !a.tasks.some(t => t.status === 'in_progress')) {
      warn(`Activity ${a.id} is in_progress but no task is in_progress`);
    }
  }

  let hasInvalid = false;
  for (const a of data.activities) {
    if (!validStatuses.has(a.status)) {
      fail(`Invalid status in activity ${a.id}: ${a.status}`);
      hasInvalid = true;
    }
    if (a.type && !validTypes.has(a.type)) {
      fail(`Invalid type in activity ${a.id}: ${a.type} (must be fix, feat, or chore)`);
      hasInvalid = true;
    }
    if (a.tasks && Array.isArray(a.tasks)) {
      const validTaskStatuses = new Set(['pending', 'in_progress', 'done', 'blocked']);
      const validAgents = new Set(['implementer', 'reviewer']);
      for (const t of a.tasks) {
        if (!t.id || !t.description) {
          fail(`Task missing id or description in activity ${a.id}`);
          hasInvalid = true;
        }
        if (t.status && !validTaskStatuses.has(t.status)) {
          fail(`Invalid task status in activity ${a.id}: ${t.status}`);
          hasInvalid = true;
        }
        if (t.agent && !validAgents.has(t.agent)) {
          fail(`Invalid task agent in activity ${a.id}: ${t.agent} (must be implementer or reviewer)`);
          hasInvalid = true;
        }
      }
    }
  }

  if (!hasInvalid) {
    ok(`activities.json valid (${data.activities.length} activities)`);
  }
} catch (e) {
  fail(`activities.json invalid: ${e.message}`);
  exitCode = 1;
}

console.log('\n── 4. Code Quality ───────────────────────────────────');

if (fs.existsSync(path.join(PROJECT_ROOT, 'tsconfig.json'))) {
  try {
    execSync('npm run lint:check', { stdio: 'inherit', cwd: PROJECT_ROOT });
    ok('Lint passed');
  } catch {
    fail('Lint errors found');
    exitCode = 1;
  }
} else {
  warn('tsconfig.json not found, skipping lint');
}

console.log('\n── 5. Compilation ─────────────────────────────────────');

if (fs.existsSync(path.join(PROJECT_ROOT, 'angular.json'))) {
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: PROJECT_ROOT });
    ok('Build succeeded');
  } catch {
    fail('Build failed');
    exitCode = 1;
  }
} else {
  warn('angular.json not found, skipping build');
}

console.log('\n── 6. Running Tests ───────────────────────────────────');

if (fs.existsSync(path.join(PROJECT_ROOT, 'tests'))) {
  try {
    execSync('npx vitest run', { stdio: 'inherit', cwd: PROJECT_ROOT });
    ok('All tests pass');
  } catch {
    fail('Some tests are broken');
    exitCode = 1;
  }
} else {
  warn('tests/ folder does not exist yet');
}

console.log('\n── 7. Summary ─────────────────────────────────────────');

if (exitCode === 0) {
  ok('Environment ready. You can start working.');
} else {
  fail('Environment NOT ready. Resolve errors before advancing.');
}

process.exit(exitCode);

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}