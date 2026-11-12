import * as fs from 'fs';
import * as path from 'path';
import pc from 'picocolors';
import { DiagnosisResult, ErrorIssue, FixApplicationResult, ProjectOverview } from './types';

/**
 * Generates the human-friendly BUDDY-REPORT.md
 */
export function generateHumanReport(diagnosis: DiagnosisResult, overview: ProjectOverview): string {
  const lines: string[] = [];

  lines.push(`# 🛠️ Build Buddy Report`);
  lines.push(`> *Your patient helper for building things without fear.*`);
  lines.push(``);
  lines.push(`- **Project Type:** ${overview.projectType}`);
  lines.push(`- **Scanned:** ${overview.totalFiles} files (${overview.totalLines} lines of code)`);
  lines.push(`- **Timestamp:** ${new Date(diagnosis.timestamp).toLocaleString()}`);
  lines.push(`- **Status:** Found ${diagnosis.issues.length} item${diagnosis.issues.length === 1 ? '' : 's'} to improve!`);
  lines.push(``);

  if (diagnosis.summary) {
    lines.push(`> 💡 **Summary:** ${diagnosis.summary}`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  if (diagnosis.issues.length === 0) {
    lines.push(`## 🎉 High Five! Everything Looks Pristine!`);
    lines.push(`Build Buddy scanned your entire project and didn't spot any broken imports, syntax errors, or logical bugs.`);
    lines.push(``);
  } else {
    lines.push(`## 📋 What We Found & How We Fixed It`);
    lines.push(``);

    diagnosis.issues.forEach((issue, index) => {
      const num = index + 1;
      const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'syntax' ? '🟡' : '🔵';

      lines.push(`### ${num}. ${issue.whatBroke}`);
      lines.push(`- 📍 **Where:** \`${issue.file}\` (around line ${issue.line}) ${severityIcon}`);
      lines.push(`- 🚨 **What broke:** ${issue.whatBroke}`);
      lines.push(`- 🧸 **In plain English:** ${issue.plainEnglish}`);
      lines.push(`- 🛠️ **What I changed:** ${issue.whatChanged}`);
      lines.push(``);

      if (issue.originalSnippet || issue.fixedSnippet) {
        lines.push(`**Code change:**`);
        lines.push(`\`\`\`diff`);
        if (issue.originalSnippet) {
          issue.originalSnippet.split('\n').forEach(l => lines.push(`- ${l}`));
        }
        if (issue.fixedSnippet) {
          issue.fixedSnippet.split('\n').forEach(l => lines.push(`+ ${l}`));
        }
        lines.push(`\`\`\``);
        lines.push(``);
      }

      lines.push(`---`);
      lines.push(``);
    });
  }

  lines.push(`## 🏁 How to Check It Works`);
  lines.push(`👉 **${diagnosis.checkInstruction}**`);
  lines.push(``);
  lines.push(`*Generated with love by [Build Buddy](https://github.com/vibe-coders/build-buddy)*`);

  return lines.join('\n');
}

/**
 * Generates the machine-readable and prompt-structured .buddy-agent-fix.md for AI Coding Agents
 */
export function generateAgentPayload(diagnosis: DiagnosisResult, overview: ProjectOverview): string {
  const lines: string[] = [];

  lines.push(`# 🤖 Build Buddy Agent Handoff Directive`);
  lines.push(``);
  lines.push(`> **NOTICE TO AI AGENT (Antigravity / Cursor / Windsurf / Cline / Copilot):**`);
  lines.push(`> You have been invoked to resolve issues identified by Build Buddy.`);
  lines.push(`> Please read the structured payload below and apply all required code changes with surgical precision.`);
  lines.push(``);

  lines.push(`## Metadata`);
  lines.push(`- **Target Directory:** \`${overview.rootDir}\``);
  lines.push(`- **Project Type:** ${overview.projectType}`);
  lines.push(`- **Total Issues Identified:** ${diagnosis.issues.length}`);
  lines.push(`- **Verification Command:** \`${diagnosis.checkInstruction}\``);
  lines.push(``);

  lines.push(`## Agent Instructions`);
  lines.push(`1. Examine each file listed below in the "Actions & Patches" section.`);
  lines.push(`2. Locate the "Original Code" snippet and replace it with the "Fixed Code" snippet.`);
  lines.push(`3. Ensure that surrounding indentation, exports, and imports remain intact.`);
  lines.push(`4. After applying the changes, run the verification step: \`${diagnosis.checkInstruction}\`.`);
  lines.push(``);

  lines.push(`## Machine-Readable Payload (JSON)`);
  lines.push(`\`\`\`json`);
  lines.push(JSON.stringify({
    projectType: overview.projectType,
    totalIssues: diagnosis.issues.length,
    checkInstruction: diagnosis.checkInstruction,
    issues: diagnosis.issues
  }, null, 2));
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`## Actions & Patches`);
  lines.push(``);

  diagnosis.issues.forEach((issue, idx) => {
    lines.push(`### Action ${idx + 1}: Fix in \`${issue.file}\``);
    lines.push(`- **Severity:** ${issue.severity}`);
    lines.push(`- **Target Line:** ${issue.line}`);
    lines.push(`- **Description:** ${issue.whatBroke}`);
    lines.push(`- **Fix Intent:** ${issue.whatChanged}`);
    lines.push(``);
    lines.push(`#### Before (Replace this):`);
    lines.push(`\`\`\`${path.extname(issue.file).replace('.', '') || 'text'}`);
    lines.push(issue.originalSnippet);
    lines.push(`\`\`\``);
    lines.push(``);
    lines.push(`#### After (With this):`);
    lines.push(`\`\`\`${path.extname(issue.file).replace('.', '') || 'text'}`);
    lines.push(issue.fixedSnippet);
    lines.push(`\`\`\``);
    lines.push(``);
  });

  return lines.join('\n');
}

/**
 * Saves both output files to the target directory
 */
export function writeOutputFiles(
  targetDir: string,
  humanReport: string,
  agentPayload: string
): { humanReportPath: string; agentPayloadPath: string } {
  const humanReportPath = path.join(targetDir, 'BUDDY-REPORT.md');
  const agentPayloadPath = path.join(targetDir, '.buddy-agent-fix.md');

  fs.writeFileSync(humanReportPath, humanReport, 'utf8');
  fs.writeFileSync(agentPayloadPath, agentPayload, 'utf8');

  return { humanReportPath, agentPayloadPath };
}

/**
 * Safely applies fixes directly to the project files when --fix flag is passed
 */
export function applyFixes(
  targetDir: string,
  issues: ErrorIssue[],
  dryRun = false
): FixApplicationResult {
  const modifiedFiles = new Set<string>();
  const details: FixApplicationResult['details'] = [];
  let appliedCount = 0;
  let failedCount = 0;

  // Group issues by file
  const fileIssuesMap = new Map<string, ErrorIssue[]>();
  for (const issue of issues) {
    const list = fileIssuesMap.get(issue.file) || [];
    list.push(issue);
    fileIssuesMap.set(issue.file, list);
  }

  for (const [relPath, fileIssues] of fileIssuesMap.entries()) {
    const absPath = path.resolve(targetDir, relPath);

    if (!fs.existsSync(absPath)) {
      failedCount += fileIssues.length;
      details.push({
        file: relPath,
        success: false,
        reason: `File not found on disk: ${absPath}`
      });
      continue;
    }

    try {
      let content = fs.readFileSync(absPath, 'utf8');
      const originalBackup = content;
      let fileModified = false;

      for (const issue of fileIssues) {
        if (!issue.originalSnippet || !issue.fixedSnippet) {
          failedCount++;
          details.push({
            file: relPath,
            success: false,
            reason: `Issue ${issue.id} has no replacement snippet.`
          });
          continue;
        }

        // Try exact match first
        if (content.includes(issue.originalSnippet)) {
          content = content.replace(issue.originalSnippet, issue.fixedSnippet);
          fileModified = true;
          appliedCount++;
          details.push({
            file: relPath,
            success: true
          });
        } else {
          // Normalize line endings (\r\n vs \n) and try again
          const normalizedContent = content.replace(/\r\n/g, '\n');
          const normalizedSnippet = issue.originalSnippet.replace(/\r\n/g, '\n');
          const normalizedFixed = issue.fixedSnippet.replace(/\r\n/g, '\n');

          if (normalizedContent.includes(normalizedSnippet)) {
            content = normalizedContent.replace(normalizedSnippet, normalizedFixed);
            fileModified = true;
            appliedCount++;
            details.push({
              file: relPath,
              success: true
            });
          } else {
            // Snippet could not be found directly (may have already been changed or line moved)
            failedCount++;
            details.push({
              file: relPath,
              success: false,
              reason: `Original snippet not found in ${relPath}. Handing off to AI agent in .buddy-agent-fix.md.`
            });
          }
        }
      }

      if (fileModified && !dryRun) {
        // Optional backup before modifying
        const backupDir = path.join(targetDir, '.buddy.bak');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const backupPath = path.join(backupDir, `${path.basename(relPath)}.${Date.now()}.bak`);
        fs.writeFileSync(backupPath, originalBackup, 'utf8');

        // Write new content
        fs.writeFileSync(absPath, content, 'utf8');
        modifiedFiles.add(relPath);
      }
    } catch (err: any) {
      failedCount += fileIssues.length;
      details.push({
        file: relPath,
        success: false,
        reason: err.message || 'File read/write error'
      });
    }
  }

  return {
    appliedCount,
    failedCount,
    filesModified: Array.from(modifiedFiles),
    details
  };
}

/**
 * Prints a gorgeous, non-coder friendly terminal card summary
 */
export function printTerminalSummary(
  diagnosis: DiagnosisResult,
  overview: ProjectOverview,
  appliedFixes?: FixApplicationResult
): void {
  console.log('');
  console.log(pc.bold(pc.cyan('╔══════════════════════════════════════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║                      🚀  BUILD BUDDY REPORT                          ║')));
  console.log(pc.bold(pc.cyan('╚══════════════════════════════════════════════════════════════════════╝')));
  console.log('');

  console.log(`  ${pc.bold('Project:')}      ${pc.magenta(overview.projectType)}`);
  console.log(`  ${pc.bold('Files Scanned:')} ${pc.yellow(overview.totalFiles.toString())} files (${overview.totalLines} lines)`);
  console.log(`  ${pc.bold('Issues Found:')}  ${diagnosis.issues.length === 0 ? pc.green('0 (Clean build!)') : pc.red(diagnosis.issues.length.toString())}`);
  console.log('');

  if (diagnosis.issues.length > 0) {
    console.log(pc.bold(pc.underline('  What Happened (In Plain English):')));
    console.log('');

    diagnosis.issues.forEach((issue, idx) => {
      const num = idx + 1;
      const tag = issue.severity === 'critical' ? pc.bgRed(pc.white(' CRITICAL ')) : pc.bgYellow(pc.black(' NOTICE '));
      console.log(`  ${pc.bold(`#${num}`)} ${tag} ${pc.bold(issue.file)} ${pc.dim(`(line ${issue.line})`)}`);
      console.log(`     🚨 ${pc.bold('What broke:')}  ${issue.whatBroke}`);
      console.log(`     🧸 ${pc.bold('Plain words:')} ${pc.green(issue.plainEnglish)}`);
      console.log(`     🛠️ ${pc.bold('The fix:')}      ${pc.cyan(issue.whatChanged)}`);
      console.log('');
    });
  }

  if (appliedFixes) {
    console.log(pc.bold(pc.underline('  Auto-Fix Status (--fix):')));
    console.log(`  ✅ Applied: ${pc.green(appliedFixes.appliedCount.toString())} safe fixes`);
    if (appliedFixes.failedCount > 0) {
      console.log(`  ⚠️  Manual/Agent review needed: ${pc.yellow(appliedFixes.failedCount.toString())} item(s)`);
    }
    if (appliedFixes.filesModified.length > 0) {
      console.log(`  📂 Modified files: ${appliedFixes.filesModified.map(f => pc.cyan(f)).join(', ')}`);
      console.log(`  🛡️  Safety backups created in ${pc.dim('.buddy.bak/')}`);
    }
    console.log('');
  }

  console.log(pc.bold(pc.yellow('  🏁 How to Check It Works:')));
  console.log(`  👉 ${pc.bold(pc.white(diagnosis.checkInstruction))}`);
  console.log('');

  console.log(pc.dim('  ────────────────────────────────────────────────────────────────────'));
  console.log(`  📄 Human Guide:    ${pc.cyan('BUDDY-REPORT.md')}`);
  console.log(`  🤖 Agent Handoff:  ${pc.magenta('.buddy-agent-fix.md')} (Ready for Antigravity, Cursor, Cline)`);
  console.log(pc.dim('  ────────────────────────────────────────────────────────────────────'));
  console.log('');
}
