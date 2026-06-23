/**
 * gen-tools-doc.mjs — generate TOOLS.md from the authoritative tool definitions.
 *
 * Source of truth is mcp-server/src/tools.ts (compiled to dist/tools.js).
 * Categories are derived from the `// === Name ===` markers in the source.
 *
 * Run:  npm run docs:tools   (from mcp-server/)
 * Output: <repo-root>/TOOLS.md  — do not edit by hand; regenerate instead.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTools } from '../dist/tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpDir = join(__dirname, '..'); // mcp-server/
const repoRoot = join(mcpDir, '..'); // repo root
const pkg = JSON.parse(readFileSync(join(mcpDir, 'package.json'), 'utf8'));

// 1) Map tool name -> category from the source comments (first occurrence wins,
//    so the definition block in createTools() takes precedence over any later
//    duplicate markers elsewhere in the file).
const srcLines = readFileSync(join(mcpDir, 'src', 'tools.ts'), 'utf8').split(/\r?\n/);
const categoryOf = new Map();
let current = 'Uncategorized';
for (const line of srcLines) {
  const cat = line.match(/\/\/\s*===\s*(.+?)\s*===/);
  if (cat) {
    current = cat[1].trim();
    continue;
  }
  const name = line.match(/name:\s*['"]([a-z_]+)['"]/);
  if (name && !categoryOf.has(name[1])) categoryOf.set(name[1], current);
}

// 2) Authoritative tool list (name, description, inputSchema) from the build.
const tools = createTools();

// 3) Group, preserving category order of first appearance.
const order = [];
const groups = new Map();
for (const t of tools) {
  const cat = categoryOf.get(t.name) || 'Uncategorized';
  if (!groups.has(cat)) {
    groups.set(cat, []);
    order.push(cat);
  }
  groups.get(cat).push(t);
}

// 4) Render Markdown.
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
const anchor = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const out = [];
out.push('# Browser Agent — MCP Tools Reference');
out.push('');
out.push('> ⚙️ **Auto-generated — do not edit by hand.** Regenerate with `npm run docs:tools` (from `mcp-server/`).');
out.push(`> Source of truth: \`mcp-server/src/tools.ts\`. Package \`${pkg.name}\` v${pkg.version} · **${tools.length} tools** in ${order.length} categories.`);
out.push('');
out.push('## Categories');
out.push('');
for (const cat of order) {
  out.push(`- [${cat}](#${anchor(cat)}) — ${groups.get(cat).length}`);
}
out.push('');

for (const cat of order) {
  out.push(`## ${cat}`);
  out.push('');
  for (const t of groups.get(cat)) {
    out.push(`### \`${t.name}\``);
    out.push('');
    out.push(cell(t.description));
    out.push('');
    const props = t.inputSchema?.properties ?? {};
    const required = new Set(t.inputSchema?.required ?? []);
    const keys = Object.keys(props);
    if (keys.length) {
      out.push('| Param | Type | Required | Description |');
      out.push('|-------|------|----------|-------------|');
      for (const k of keys) {
        const p = props[k] ?? {};
        let type = p.type ?? '';
        if (p.enum) type = `enum(${p.enum.map((e) => String(e)).join(' \\| ')})`;
        out.push(`| \`${k}\` | ${type || '—'} | ${required.has(k) ? 'yes' : 'no'} | ${cell(p.description)} |`);
      }
    } else {
      out.push('_No parameters._');
    }
    out.push('');
  }
}

writeFileSync(join(repoRoot, 'TOOLS.md'), out.join('\n').replace(/\n+$/, '') + '\n', 'utf8');
console.log(`TOOLS.md written: ${tools.length} tools, ${order.length} categories, v${pkg.version}`);
