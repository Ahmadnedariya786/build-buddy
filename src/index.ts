#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import dotenv from 'dotenv';
import pc from 'picocolors';

import { scanProject } from './scanner';
import { analyzeProjectWithDeepSeek } from './deepseek';
import {
  generateHumanReport,
  generateAgentPayload,
  writeOutputFiles,
  applyFixes,
  printTerminalSummary
} from './reporter';
import { BuddyCliOptions, FixApplicationResult } from './types';

// Load environment variables (.env)
dotenv.config();

/**
 * Creates a sample broken demo project for quick vibe-coder testing
 */
function scaffoldDemoProject(targetDir: string): void {
  const demoPath = path.resolve(targetDir, 'demo-app');
  if (!fs.existsSync(demoPath)) {
    fs.mkdirSync(demoPath, { recursive: true });
  }

  const packageJson = {
    name: 'vibe-todo-demo',
    version: '0.1.0',
    private: true,
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    }
  };

  const appCode = `// A vibe-coded To-Do component with hidden bugs!
import React, { useState } from 'react';

export function TodoApp() {
  const [todos, setTodos] = useState([]);
  
  // Bug 1: Typo in console.log
  conosle.log("Rendering TodoApp...");

  function handleAdd() {
    // Bug 2: Missing variable declaration before usage
    const userProfile = fetchProfile(userId);
    setTodos([...todos, { id: Date.now(), text: "New Task" }]);
  }

  function handleSave() {
    // Bug 3: Placeholder crash
    throw new Error("Not implemented");
  }

  return (
    <div className="container">
      <h1>My First Vibe App</h1>
      <button onClick={handleAdd}>Add Task</button>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
`;

  fs.writeFileSync(path.join(demoPath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');
  fs.writeFileSync(path.join(demoPath, 'App.jsx'), appCode, 'utf8');

  console.log(pc.green(`✨ Created demo project at: ${pc.bold(demoPath)}`));
  console.log(`Run ${pc.cyan(`npx build-buddy demo-app --mock`)} or ${pc.cyan(`npx build-buddy demo-app --mock --fix`)} to see Build Buddy work!`);
}

async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name('build-buddy')
    .description('The patient AI companion and agent-bridge for non-coders and vibe-coders.')
    .version('1.0.0')
    .argument('[directory]', 'Target project directory to inspect', '.')
    .option('-f, --fix', 'Automatically apply safe fixes to your project files', false)
    .option('-k, --key <apiKey>', 'DeepSeek API key (or set DEEPSEEK_API_KEY env var)')
    .option('-m, --model <model>', 'DeepSeek model to use (default: deepseek-chat)', 'deepseek-chat')
    .option('--mock', 'Run in test/mock mode without requiring an active DeepSeek API key', false)
    .option('--agent-only', 'Only generate the AI agent handoff file (.buddy-agent-fix.md)', false)
    .option('--dry-run', 'Preview fixes without writing modifications to disk', false)
    .option('--init-demo', 'Scaffold a broken demo app to experiment with Build Buddy', false)
    .option('-v, --verbose', 'Show detailed scan and file logs', false);

  program.parse(process.argv);

  const targetArg = program.args[0] || '.';
  const opts = program.opts();

  if (opts.initDemo) {
    scaffoldDemoProject(targetArg);
    return;
  }

  const cliOptions: BuddyCliOptions = {
    dir: targetArg,
    fix: opts.fix,
    key: opts.key,
    model: opts.model,
    mock: opts.mock,
    agentOnly: opts.agentOnly,
    dryRun: opts.dryRun,
    verbose: opts.verbose
  };

  const resolvedDir = path.resolve(cliOptions.dir);

  console.log('');
  console.log(pc.bold(pc.cyan('👋 Hi! I\'m Build Buddy — your patient AI helper.')));
  console.log(pc.dim('Scanning your project and finding every hidden hiccup...'));
  console.log('');

  // 1. Scan and read all files
  let overview;
  try {
    overview = await scanProject(resolvedDir);
  } catch (err: any) {
    console.error(pc.red(`❌ Oops! Couldn't scan "${resolvedDir}": ${err.message}`));
    console.log(pc.yellow('💡 Tip: Make sure you point Build Buddy to an existing project folder.'));
    process.exit(1);
  }

  if (overview.files.length === 0) {
    console.log(pc.yellow(`⚠️  No source code files found in "${resolvedDir}".`));
    console.log(`Tip: Run with ${pc.cyan('--init-demo')} to create a sample test project!`);
    return;
  }

  console.log(`🔍 Discovered ${pc.bold(overview.files.length.toString())} code files (${overview.totalLines} lines) in your ${pc.bold(overview.projectType)}.`);

  // 2. DeepSeek Harness Brain
  const hasKey = !!(cliOptions.key || process.env.DEEPSEEK_API_KEY);
  if (!hasKey && !cliOptions.mock) {
    console.log('');
    console.log(pc.yellow('💡 Note: No DEEPSEEK_API_KEY detected. Running in friendly --mock mode!'));
    console.log(pc.dim('To connect live DeepSeek AI: set DEEPSEEK_API_KEY=your_key or pass --key <key>\n'));
    cliOptions.mock = true;
  }

  console.log(`🧠 Consulting Build Buddy brain (${cliOptions.mock ? 'Mock Engine' : cliOptions.model})...`);

  let diagnosis;
  try {
    diagnosis = await analyzeProjectWithDeepSeek(overview, {
      apiKey: cliOptions.key,
      model: cliOptions.model,
      mock: cliOptions.mock
    });
  } catch (err: any) {
    console.error(pc.red(`❌ DeepSeek Brain encountered an issue: ${err.message}`));
    console.log(pc.yellow('Falling back to safe local mock analysis so your workflow is never interrupted...'));
    diagnosis = await analyzeProjectWithDeepSeek(overview, { mock: true });
  }

  // 3. Generate outputs
  const humanReport = generateHumanReport(diagnosis, overview);
  const agentPayload = generateAgentPayload(diagnosis, overview);

  if (!cliOptions.agentOnly) {
    writeOutputFiles(resolvedDir, humanReport, agentPayload);
  } else {
    const agentPath = path.join(resolvedDir, '.buddy-agent-fix.md');
    fs.writeFileSync(agentPath, agentPayload, 'utf8');
  }

  // 4. Auto-Fix Mode (--fix)
  let appliedFixes: FixApplicationResult | undefined;
  if (cliOptions.fix && diagnosis.issues.length > 0) {
    console.log(pc.cyan(`\n🛠️  Applying ${diagnosis.issues.length} safe fixes directly to your files...`));
    appliedFixes = applyFixes(resolvedDir, diagnosis.issues, cliOptions.dryRun);
  }

  // 5. Output Summary Card
  printTerminalSummary(diagnosis, overview, appliedFixes);
}

// Execute CLI
runCli().catch((err) => {
  console.error('');
  console.error(pc.bgRed(pc.white(' UNEXPECTED ERROR ')));
  console.error(pc.red(err.message || err));
  console.log(pc.yellow('\nDon\'t worry! Build Buddy is safe and your files were not harmed.'));
  process.exit(1);
});
