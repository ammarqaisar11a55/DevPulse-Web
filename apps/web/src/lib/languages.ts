const DISPLAY_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  typescriptreact: 'TypeScript (React)',
  javascript: 'JavaScript',
  javascriptreact: 'JavaScript (React)',
  python: 'Python',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  'c#': 'C#',
  java: 'Java',
  kotlin: 'Kotlin',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  dart: 'Dart',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  sql: 'SQL',
  shellscript: 'Shell',
  dockerfile: 'Dockerfile',
  vue: 'Vue',
  svelte: 'Svelte',
  prisma: 'Prisma',
};

/** Human-readable name for a VS Code language identifier. */
export function languageName(id: string | null | undefined) {
  if (!id) return 'Unknown';
  return DISPLAY_NAMES[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export const COMMON_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'cpp',
  'c',
  'csharp',
  'java',
  'go',
  'rust',
  'kotlin',
  'swift',
  'php',
  'ruby',
  'dart',
];
