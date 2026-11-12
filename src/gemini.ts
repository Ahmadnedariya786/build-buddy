import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectOverview, DiagnosisResult, ErrorIssue } from './types';

const SYSTEM_PROMPT = `You are "Build Buddy", a patient helper for people who have never coded (often called "vibe coders").
Your mission is to inspect the entire project, understand how all files connect, and find EVERY hidden bug, syntax error, broken import, missing variable, typo, or logical flaw—not just the first one!

CRITICAL INSTRUCTIONS:
1. COMPREHENSIVE SCAN: You must find EVERY error across all files (broken imports, missing components, undeclared variables, undefined functions, mismatched types, bad routing, unclosed tags, API mismatches). Never stop at the first error.
2. PLAIN ENGLISH EXPLANATION: For every error found, you MUST generate an explanation in plain English: exactly ONE short sentence that a ten-year-old would easily understand, with ZERO technical jargon, using an everyday comparison or metaphor (e.g. "It's like baking a cake where the recipe says 'add the blueberries', but we forgot to buy blueberries at the store.").
3. ACCURATE SNIPPETS:
   - "originalSnippet": Provide the exact lines of code (including 1-2 lines of surrounding context) that need to be replaced.
   - "fixedSnippet": Provide the exact corrected lines of code that cleanly replace the original snippet.
4. ONE-LINE VERIFICATION: Provide a single, crystal-clear line telling the user how to test that everything works (e.g. "Run \`npm run dev\` and click the login button to make sure it welcomes you with your name!").
5. RESPONSE FORMAT: You must return ONLY a valid, parseable JSON object matching this exact schema:
{
  "summary": "Warm, encouraging 2-sentence summary of the health of the project.",
  "checkInstruction": "One clear sentence telling the user how to check that the app is working.",
  "issues": [
    {
      "id": "issue-1",
      "file": "path/to/file.ext",
      "line": 42,
      "severity": "critical", // "critical" | "warning" | "syntax" | "logical"
      "whatBroke": "Brief clear summary of what is broken",
      "plainEnglish": "One short sentence a ten-year-old would understand, zero technical jargon, using an everyday comparison.",
      "whatChanged": "What is changed to fix this bug.",
      "originalSnippet": "exact code before",
      "fixedSnippet": "exact code after"
    }
  ]
}`;

/**
 * Builds the user prompt containing the project overview and all source files
 */
function buildUserPrompt(overview: ProjectOverview): string {
  let prompt = `PROJECT TYPE: ${overview.projectType}\n`;
  prompt += `TOTAL FILES: ${overview.totalFiles}\n`;
  prompt += `TOTAL LINES: ${overview.totalLines}\n\n`;

  prompt += `FILE STRUCTURE:\n${overview.fileTree}\n\n`;

  if (overview.dependencies && Object.keys(overview.dependencies).length > 0) {
    prompt += `DECLARED DEPENDENCIES:\n${JSON.stringify(overview.dependencies, null, 2)}\n\n`;
  }

  prompt += `=== PROJECT FILES CONTENT ===\n\n`;

  for (const file of overview.files) {
    prompt += `--- FILE: ${file.path} (${file.lineCount} lines) ---\n`;
    prompt += file.content;
    prompt += `\n\n`;
  }

  prompt += `=== END OF FILES ===\n\n`;
  prompt += `Analyze all files above. Find EVERY single bug, syntax flaw, broken import, or logical error. Output the JSON result now:`;

  return prompt;
}

/**
 * Safely parses JSON from AI response, stripping any markdown wrappers
 */
function extractAndParseJson(rawText: string): any {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  // Attempt direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract the first { ... } block
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonCandidate);
    }
    throw new Error('Could not parse a valid JSON response from Google Gemini API.');
  }
}

/**
 * Runs the Google Gemini API to analyze the project files
 */
export async function analyzeProjectWithGemini(
  overview: ProjectOverview,
  options: {
    apiKey?: string;
    model?: string;
    mock?: boolean;
  }
): Promise<DiagnosisResult> {
  if (options.mock) {
    return runMockDiagnosis(overview);
  }

  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      `Gemini API key is missing! Please set GEMINI_API_KEY in your .env file, pass --key <your-key>, or use --mock for demo mode.`
    );
  }

  const modelName = options.model || 'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  const userContent = buildUserPrompt(overview);
  const result = await generativeModel.generateContent(userContent);
  const content = result.response.text();

  if (!content) {
    throw new Error('Received an empty response from Google Gemini API.');
  }

  const parsed = extractAndParseJson(content);

  const issues: ErrorIssue[] = Array.isArray(parsed.issues)
    ? parsed.issues.map((item: any, idx: number) => ({
        id: item.id || `issue-${idx + 1}`,
        file: item.file || 'unknown',
        line: item.line || 1,
        severity: item.severity || 'warning',
        whatBroke: item.whatBroke || 'Error detected in code',
        plainEnglish: item.plainEnglish || 'A piece of the code is not fitting properly with the rest.',
        whatChanged: item.whatChanged || 'Fixed the code to resolve the error.',
        originalSnippet: item.originalSnippet || '',
        fixedSnippet: item.fixedSnippet || '',
        fullFileContent: item.fullFileContent
      }))
    : [];

  return {
    summary: parsed.summary || 'Build Buddy inspected your project and prepared fixes for the detected issues.',
    checkInstruction: parsed.checkInstruction || 'Run your build or dev command to verify everything works!',
    projectType: overview.projectType,
    timestamp: new Date().toISOString(),
    issues
  };
}

/**
 * Built-in mock diagnosis engine for testing, demonstrations, or offline development
 */
export function runMockDiagnosis(overview: ProjectOverview): DiagnosisResult {
  const issues: ErrorIssue[] = [];

  // Check if we can detect real common issues in the scanned files
  for (const file of overview.files) {
    const lines = file.content.split('\n');

    // Check for common typo: 'clg' or 'conosle.log' (skip comments and regex declarations)
    lines.forEach((line, idx) => {
      const isCommentOrRegex = /^\s*(\/\/|\/\*|\*)/.test(line) || line.includes('/conosle') || line.includes('conosle\\');
      if (!isCommentOrRegex && /conosle\.log\s*\(/.test(line)) {
        issues.push({
          id: `issue-${issues.length + 1}`,
          file: file.path,
          line: idx + 1,
          severity: 'syntax',
          whatBroke: 'Misspelled "console.log" as "conosle.log"',
          plainEnglish: "It's like telling your dog to 'fecht' the ball instead of 'fetch'—the computer has no idea what you mean!",
          whatChanged: 'Corrected "conosle.log" to the proper "console.log".',
          originalSnippet: line,
          fixedSnippet: line.replace('conosle.log', 'console.log')
        });
      }
    });

    // Check for unfinished placeholder crash calls (skip comments and generator strings)
    lines.forEach((line, idx) => {
      const isCommentOrCodeGen = /^\s*(\/\/|\/\*|\*)/.test(line) || line.includes('appCode') || line.includes('line.includes');
      if (!isCommentOrCodeGen && line.includes('throw new Error("Not implemented")')) {
        issues.push({
          id: `issue-${issues.length + 1}`,
          file: file.path,
          line: idx + 1,
          severity: 'logical',
          whatBroke: 'Unimplemented placeholder function',
          plainEnglish: "It's like ordering a pizza and opening the box only to find an empty cardboard plate with a note saying 'we'll cook this later'.",
          whatChanged: 'Replaced the crash trigger with a safe default return value.',
          originalSnippet: line,
          fixedSnippet: line.replace('throw new Error("Not implemented")', 'return { success: true, message: "Ready" };')
        });
      }
    });
  }

  // If no mock patterns matched, provide a rich, educational simulated suite representing real vibe-coding issues
  if (issues.length === 0) {
    const targetFile = overview.files[0]?.path || 'src/index.js';

    issues.push({
      id: 'issue-1',
      file: targetFile,
      line: 12,
      severity: 'critical',
      whatBroke: 'Missing variable declaration before usage',
      plainEnglish: "It's like trying to pour a glass of milk before taking the milk jug out of the fridge.",
      whatChanged: 'Added the missing variable definition with a safe default value so the program does not crash.',
      originalSnippet: 'const userProfile = fetchProfile(userId);',
      fixedSnippet: 'const userId = getActiveUserId() || "guest";\nconst userProfile = fetchProfile(userId);'
    });

    issues.push({
      id: 'issue-2',
      file: targetFile,
      line: 27,
      severity: 'logical',
      whatBroke: 'Button click handler misses error boundary catch',
      plainEnglish: "It's like riding a bicycle without brakes down a hill—if anything bumps you, there is no cushion to stop safely.",
      whatChanged: 'Wrapped the action in a gentle try-catch block so the user sees a friendly notification instead of a frozen screen.',
      originalSnippet: 'async function handleCheckout() {\n  await api.chargeCard();\n}',
      fixedSnippet: 'async function handleCheckout() {\n  try {\n    await api.chargeCard();\n  } catch (err) {\n    showFriendlyAlert("Oops! Card checkout paused. Please try again.");\n  }\n}'
    });

    issues.push({
      id: 'issue-3',
      file: targetFile,
      line: 35,
      severity: 'syntax',
      whatBroke: 'Unclosed quotation mark or missing semicolon',
      plainEnglish: "It's like ending a sentence without a period, so the computer thinks you are still talking forever.",
      whatChanged: 'Closed the open quote and added clean punctuation.',
      originalSnippet: 'const status = "pending',
      fixedSnippet: 'const status = "pending";'
    });
  }

  return {
    summary: `Build Buddy inspected ${overview.totalFiles} files across your ${overview.projectType} with Google Gemini and caught ${issues.length} hidden bumps! Everything is explained simply below.`,
    checkInstruction: overview.projectType.includes('Next') || overview.projectType.includes('Vite') || overview.projectType.includes('React')
      ? 'Run "npm run dev" and refresh your browser at http://localhost:3000 to see your fixes shine!'
      : 'Run "npm start" or "node ." in your terminal to see your program run without errors!',
    projectType: overview.projectType,
    timestamp: new Date().toISOString(),
    issues
  };
}
