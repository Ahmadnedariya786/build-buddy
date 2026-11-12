export type IssueSeverity = 'critical' | 'warning' | 'syntax' | 'logical';

export interface ProjectFile {
  path: string;            // relative path (e.g. "src/App.tsx")
  absolutePath: string;    // full OS path
  extension: string;       // e.g. ".tsx"
  content: string;         // UTF-8 file content
  lineCount: number;
  sizeBytes: number;
}

export interface ProjectOverview {
  rootDir: string;
  projectType: string;
  totalFiles: number;
  totalLines: number;
  fileTree: string;
  dependencies?: Record<string, string>;
  files: ProjectFile[];
}

export interface ErrorIssue {
  id: string;
  file: string;
  line: number | string;
  severity: IssueSeverity;
  whatBroke: string;
  plainEnglish: string;    // 1 short sentence, 10yo level, 0 jargon, everyday metaphor
  whatChanged: string;     // clear description of what is modified
  originalSnippet: string; // code to replace
  fixedSnippet: string;    // replacement code
  fullFileContent?: string; // optional complete content of the fixed file
}

export interface DiagnosisResult {
  summary: string;
  issues: ErrorIssue[];
  checkInstruction: string; // 1 line telling the user how to check it works
  projectType: string;
  timestamp: string;
}

export interface BuddyCliOptions {
  dir: string;
  fix: boolean;
  key?: string;
  model?: string;
  mock: boolean;
  agentOnly: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export interface FixApplicationResult {
  appliedCount: number;
  failedCount: number;
  filesModified: string[];
  details: Array<{
    file: string;
    success: boolean;
    reason?: string;
  }>;
}
