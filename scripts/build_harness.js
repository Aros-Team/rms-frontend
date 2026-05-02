#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const TEMPLATES = {
  'activities.json': JSON.stringify({
    project: '{project_name}',
    description: '{description}',
    activities: []
  }, null, 2),
  'progress/current.md': `# Current Session

## Activity
- ID:
- Name:
- Type:
- Status:

## Tasks
- Current:
- Pending:

## Plan

## Notes

## Blockers

---
`,
  'progress/history.md': `# Session History

---
`
};

function initProject(projectName, description) {
  console.log(`Initializing project structure: ${projectName}`);

  fs.mkdirSync(path.join(PROJECT_ROOT, 'progress'), { recursive: true });
  fs.mkdirSync(path.join(PROJECT_ROOT, 'progress', 'explore'), { recursive: true });

  const activitiesPath = path.join(PROJECT_ROOT, 'activities.json');
  if (!fs.existsSync(activitiesPath)) {
    const content = JSON.stringify({
      project: projectName,
      description: description,
      activities: []
    }, null, 2);
    fs.writeFileSync(activitiesPath, content);
    console.log('Created activities.json');
  } else {
    console.log('activities.json already exists');
  }

  const currentMdPath = path.join(PROJECT_ROOT, 'progress', 'current.md');
  if (!fs.existsSync(currentMdPath)) {
    fs.writeFileSync(currentMdPath, TEMPLATES['progress/current.md']);
    console.log('Created progress/current.md');
  } else {
    console.log('progress/current.md already exists');
  }

  const historyMdPath = path.join(PROJECT_ROOT, 'progress', 'history.md');
  if (!fs.existsSync(historyMdPath)) {
    fs.writeFileSync(historyMdPath, TEMPLATES['progress/history.md']);
    console.log('Created progress/history.md');
  } else {
    console.log('progress/history.md already exists');
  }

  console.log('Project initialization complete.');
}

const args = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
const projectName = args[0] || pkg.name || 'Untitled Project';
const description = args[1] || pkg.description || 'Project activities and progress tracking';
initProject(projectName, description);