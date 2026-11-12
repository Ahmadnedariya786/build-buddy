# 🛠️ Build Buddy

> **The patient AI companion and universal agent-bridge for non-coders and "vibe-coders".**  
> *"Your own agent in one small file."*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![DeepSeek](https://img.shields.io/badge/Powered%20By-DeepSeek%20Harness-blueviolet.svg)](https://deepseek.com)
[![AI Agents Ready](https://img.shields.io/badge/AI%20Agents-Antigravity%20%7C%20Cursor%20%7C%20Windsurf%20%7C%20Cline-orange.svg)](#agent-bridge)

---

## 💡 The Philosophy

When you're **"vibe coding"**—building web apps, prototypes, and tools with AI prompts, templates, or zero formal computer science training—traditional developer tools scream at you with terrifying terminal stack traces:
`TypeError: Cannot read properties of undefined (reading 'map') at chunk-324.js:42:18`.

**Build Buddy turns cryptic panic into friendly clarity.**

Build Buddy scans your entire project, maps out all code relationships, and feeds them into the **DeepSeek API Harness**. It catches **every** hidden bug, broken import, missing variable, or logical flaw (not just the first one) and produces:
1. **A Human Guide (`BUDDY-REPORT.md`)**: Written in plain English using everyday metaphors that a 10-year-old would understand—zero jargon.
2. **An AI Agent Handoff Payload (`.buddy-agent-fix.md`)**: A structured directive and unified diff that any coding AI agent (such as **Antigravity**, **Cursor**, **Windsurf**, or **Cline**) can ingest and execute autonomously.
3. **Auto-Fix Engine (`--fix`)**: Directly applies safe fixes to your code and creates safety backups.

---

## 🚀 Quickstart

Run directly using `npx` (no installation required):

```bash
# Scan and diagnose your current project
npx build-buddy

# Scan and automatically apply fixes
npx build-buddy --fix

# Try it instantly on a sample demo app without an API key
npx build-buddy --init-demo
npx build-buddy demo-app --mock --fix
```

---

## ⚙️ Configuration & DeepSeek API Key

Build Buddy connects directly to the official **DeepSeek API**:

```bash
# Option 1: Set in your environment or .env file
export DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
npx build-buddy

# Option 2: Pass as a command line flag
npx build-buddy --key sk-your-deepseek-api-key

# Option 3: Use DeepSeek Reasoner model (R1)
npx build-buddy --model deepseek-reasoner
```

> **Note:** If no API key is detected, Build Buddy automatically engages its **Mock Engine (`--mock`)** so you can test features and workflows without any setup barrier!

---

## 📋 CLI Options & Flags

| Flag | Shorthand | Description | Default |
|------|-----------|-------------|---------|
| `[directory]` | | Target directory to inspect | `.` (current folder) |
| `--fix` | `-f` | Automatically apply safe fixes to files | `false` |
| `--key <apiKey>` | `-k` | DeepSeek API key | `process.env.DEEPSEEK_API_KEY` |
| `--model <model>` | `-m` | DeepSeek model (`deepseek-chat` or `deepseek-reasoner`) | `deepseek-chat` |
| `--mock` | | Run in mock engine mode (works without API key) | `false` |
| `--agent-only` | | Generate only the AI agent handoff file | `false` |
| `--dry-run` | | Preview changes without modifying files | `false` |
| `--init-demo` | | Scaffold a broken demo app to experiment safely | `false` |
| `--version` | `-V` | Output version number | `1.0.0` |
| `--help` | `-h` | Display help screen | |

---

## 📂 Dual Output Architecture

When Build Buddy runs, it generates two synchronized companion files:

```
my-vibe-project/
├── src/
│   ├── App.jsx
│   └── ...
├── BUDDY-REPORT.md        👈 For YOU (Human plain English report)
└── .buddy-agent-fix.md    👈 For your AI Agent (Antigravity, Cursor, Cline)
```

### 1. `BUDDY-REPORT.md` (Human Report)
Every issue is explained with an everyday comparison, what changed, and how to verify:
```markdown
### 1. Misspelled "console.log" as "conosle.log"
- 📍 **Where:** `App.jsx` (around line 8)
- 🚨 **What broke:** Misspelled "console.log" as "conosle.log"
- 🧸 **In plain English:** It's like telling your dog to 'fecht' the ball instead of 'fetch'—the computer has no idea what you mean!
- 🛠️ **What I changed:** Corrected "conosle.log" to the proper "console.log".

## 🏁 How to Check It Works
👉 **Run "npm run dev" and refresh your browser at http://localhost:3000 to see your fixes shine!**
```

### 2. `.buddy-agent-fix.md` (Agent Handoff Payload)
Contains structured directives, JSON payloads, and exact before/after snippets tailored for AI Coding Agents:
```markdown
# 🤖 Build Buddy Agent Handoff Directive
> You have been invoked to resolve issues identified by Build Buddy.
> Apply all required code changes with surgical precision.

## Machine-Readable Payload (JSON)
{
  "projectType": "React Application",
  "issues": [ ... ]
}
```

---

## 🤝 Agent Handoff Workflows

### With Google Antigravity
1. Run `npx build-buddy` in your project terminal.
2. Tell Antigravity:  
   `"Please read .buddy-agent-fix.md and execute all recommended fixes."`
3. Antigravity reads the unified payload and applies the patches across your repository!

### With Cursor / Windsurf / Cline
In Composer or the AI chat panel:
> *"Implement the changes specified in `.buddy-agent-fix.md`."*

---

## 🏗️ Project Architecture

```
build-buddy/
├── bin/
│   └── build-buddy.js    # Executable CLI launcher
├── src/
│   ├── types.ts          # Core TypeScript data contracts & interfaces
│   ├── scanner.ts        # Smart recursive scanner (ignores noise, detects frameworks)
│   ├── deepseek.ts       # DeepSeek Harness integration & system prompt engine
│   ├── reporter.ts       # Dual markdown generator (BUDDY-REPORT & .buddy-agent-fix)
│   └── index.ts          # CLI argument parser & workflow coordinator
├── package.json
└── tsconfig.json
```

---

## 🛡️ Safety & Data Protection
- **No Overwrites Without Backup:** When `--fix` modifies files, it creates timestamped safety copies inside `.buddy.bak/`.
- **Token Efficiency:** Automatically ignores `node_modules`, `.git`, build outputs, binaries, and lock files.
- **Privacy Conscious:** Excludes `.env` and credential files from scans.

---

## 📄 License

MIT © [Build Buddy Contributors](https://github.com/vibe-coders/build-buddy)
