/**
 * Design-tokens v2 — formatters.
 *
 * Pure transforms over the raw output of the extension's `extract_design` +
 * `extract_palette` commands. No browser/CDP here — fully unit-testable.
 * Produces three skill-ready artifacts in one go:
 *   - DTCG   : W3C Design Tokens Community Group JSON (Figma / Tokens Studio / build tools)
 *   - Tailwind: v4 `@theme` CSS + a v3 `theme.extend` config object
 *   - DESIGN.md: human/AI-readable design-system doc (for 2p-builder / AI codegen)
 */

// ---- shapes of the raw extraction (see extension/design-extractor.js) -------
export interface PaletteResult {
  palette?: Array<{ hex: string; count: number; hsl: { h: number; s: number; l: number } }>;
  categorized?: {
    primary?: string | null;
    secondary?: string | null;
    background?: string[];
    text?: string[];
    accent?: string[];
    neutral?: string[];
  };
  total?: number;
}
export interface DesignResult {
  typography?: {
    headings?: Array<{ fontFamily: string; fontWeight: string; fontSize: string; lineHeight: string }>;
    body?: Array<{ fontFamily: string; fontWeight: string; fontSize: string; lineHeight: string }>;
    allFontFamilies?: string[];
  };
  spacing?: { unique?: string[] };
  borderRadius?: string[];
  scope?: string;
}

// ---- helpers ----------------------------------------------------------------
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, l: 0 };
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Map a lightness (0-100) to the nearest Tailwind-style scale step.
function lightnessToStep(l: number): number {
  if (l >= 95) return 50;
  if (l >= 88) return 100;
  if (l >= 78) return 200;
  if (l >= 66) return 300;
  if (l >= 54) return 400;
  if (l >= 44) return 500;
  if (l >= 34) return 600;
  if (l >= 24) return 700;
  if (l >= 14) return 800;
  return 900;
}

// Build a {step: hex} scale from a list of hex colors (deduped, collisions bumped).
function buildScale(hexes: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<number>();
  const withL = hexes
    .filter((h) => /^#?[0-9a-f]{6}$/i.test(h))
    .map((h) => ({ hex: h.startsWith('#') ? h : `#${h}`, l: hexToHsl(h).l }))
    .sort((a, b) => b.l - a.l); // light → dark
  for (const c of withL) {
    let step = lightnessToStep(c.l);
    while (used.has(step) && step < 950) step += 50;
    if (used.has(step)) continue;
    used.add(step);
    out[String(step)] = c.hex.toLowerCase();
  }
  return out;
}

function px(strs: string[] | undefined): number[] {
  const nums = new Set<number>();
  for (const s of strs || []) {
    const matches = s.match(/(\d+(?:\.\d+)?)px/g) || [];
    for (const m of matches) {
      const v = parseFloat(m);
      if (v > 0) nums.add(v);
    }
  }
  return [...nums].sort((a, b) => a - b);
}

function firstFamily(fonts?: Array<{ fontFamily: string }>): string | null {
  return fonts && fonts.length ? fonts[0].fontFamily : null;
}

// ---- normalized intermediate model -----------------------------------------
interface TokenModel {
  colors: {
    primary?: string;
    secondary?: string;
    accent: string[];
    neutral: Record<string, string>;
    background: Record<string, string>;
    text: Record<string, string>;
  };
  fontFamily: { heading?: string; body?: string };
  typeScale: Array<{ name: string; size: number; weight: string; lineHeight: string }>;
  spacing: number[];
  borderRadius: string[];
}

function normalize(design: DesignResult, palette: PaletteResult): TokenModel {
  const cat = palette.categorized || {};
  const heads = design.typography?.headings || [];
  // type scale: dedup heading sizes (desc), name h1..hN
  const seen = new Set<number>();
  const typeScale: TokenModel['typeScale'] = [];
  let i = 1;
  for (const h of heads) {
    const size = parseFloat(h.fontSize);
    if (!size || seen.has(size)) continue;
    seen.add(size);
    typeScale.push({ name: `h${i++}`, size, weight: h.fontWeight, lineHeight: h.lineHeight });
    if (i > 6) break;
  }
  return {
    colors: {
      primary: cat.primary || undefined,
      secondary: cat.secondary || undefined,
      accent: (cat.accent || []).slice(0, 6),
      neutral: buildScale(cat.neutral || []),
      background: buildScale(cat.background || []),
      text: buildScale(cat.text || []),
    },
    fontFamily: {
      heading: firstFamily(heads) || undefined,
      body: firstFamily(design.typography?.body) || firstFamily(heads) || undefined,
    },
    typeScale,
    spacing: px(design.spacing?.unique).slice(0, 12),
    borderRadius: [...new Set((design.borderRadius || []).filter((r) => r && r !== '0px'))].slice(0, 10),
  };
}

// ---- DTCG (W3C Design Tokens) -----------------------------------------------
function toDTCG(m: TokenModel): any {
  const color: any = {};
  if (m.colors.primary) color.primary = { $type: 'color', $value: m.colors.primary };
  if (m.colors.secondary) color.secondary = { $type: 'color', $value: m.colors.secondary };
  m.colors.accent.forEach((hex, i) => { (color.accent ||= {})[String(i + 1)] = { $type: 'color', $value: hex }; });
  for (const [step, hex] of Object.entries(m.colors.neutral)) (color.neutral ||= {})[step] = { $type: 'color', $value: hex };
  for (const [step, hex] of Object.entries(m.colors.background)) (color.background ||= {})[step] = { $type: 'color', $value: hex };
  for (const [step, hex] of Object.entries(m.colors.text)) (color.text ||= {})[step] = { $type: 'color', $value: hex };

  const fontFamily: any = {};
  if (m.fontFamily.heading) fontFamily.heading = { $type: 'fontFamily', $value: m.fontFamily.heading };
  if (m.fontFamily.body) fontFamily.body = { $type: 'fontFamily', $value: m.fontFamily.body };

  const fontSize: any = {};
  for (const t of m.typeScale) fontSize[t.name] = { $type: 'dimension', $value: `${t.size}px` };

  const spacing: any = {};
  for (const v of m.spacing) spacing[String(v)] = { $type: 'dimension', $value: `${v}px` };

  const borderRadius: any = {};
  m.borderRadius.forEach((r, i) => { borderRadius[String(i + 1)] = { $type: 'dimension', $value: r }; });

  return { color, fontFamily, fontSize, spacing, borderRadius };
}

// Shared CSS custom-property pairs (used by both Tailwind v4 @theme and :root).
function cssVarPairs(m: TokenModel): Array<[string, string]> {
  const p: Array<[string, string]> = [];
  if (m.colors.primary) p.push(['--color-primary', m.colors.primary]);
  if (m.colors.secondary) p.push(['--color-secondary', m.colors.secondary]);
  m.colors.accent.forEach((h, i) => p.push([`--color-accent-${i + 1}`, h]));
  for (const [s, h] of Object.entries(m.colors.neutral)) p.push([`--color-neutral-${s}`, h]);
  for (const [s, h] of Object.entries(m.colors.background)) p.push([`--color-bg-${s}`, h]);
  for (const [s, h] of Object.entries(m.colors.text)) p.push([`--color-text-${s}`, h]);
  if (m.fontFamily.heading) p.push(['--font-heading', m.fontFamily.heading]);
  if (m.fontFamily.body) p.push(['--font-body', m.fontFamily.body]);
  for (const t of m.typeScale) p.push([`--text-${t.name}`, `${t.size}px`]);
  for (const v of m.spacing) p.push([`--spacing-${v}`, `${v}px`]);
  m.borderRadius.forEach((r, i) => p.push([`--radius-${i + 1}`, r]));
  return p;
}

// Standalone CSS variables (:root) — framework-agnostic export.
function toCssVars(m: TokenModel): string {
  return ':root {\n' + cssVarPairs(m).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n';
}

// ---- Tailwind v4 @theme + v3 config -----------------------------------------
function toTailwind(m: TokenModel): { css: string; config: any } {
  const css = '@theme {\n' + cssVarPairs(m).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';

  // v3 config object (theme.extend)
  const colors: any = {};
  if (m.colors.primary) colors.primary = m.colors.primary;
  if (m.colors.secondary) colors.secondary = m.colors.secondary;
  if (m.colors.accent.length) colors.accent = Object.fromEntries(m.colors.accent.map((h, i) => [String(i + 1), h]));
  if (Object.keys(m.colors.neutral).length) colors.neutral = m.colors.neutral;
  if (Object.keys(m.colors.background).length) colors.bg = m.colors.background;
  if (Object.keys(m.colors.text).length) colors.text = m.colors.text;
  const config = {
    theme: {
      extend: {
        colors,
        fontFamily: {
          ...(m.fontFamily.heading ? { heading: [m.fontFamily.heading] } : {}),
          ...(m.fontFamily.body ? { body: [m.fontFamily.body] } : {}),
        },
        fontSize: Object.fromEntries(m.typeScale.map((t) => [t.name, `${t.size}px`])),
        spacing: Object.fromEntries(m.spacing.map((v) => [String(v), `${v}px`])),
        borderRadius: Object.fromEntries(m.borderRadius.map((r, i) => [String(i + 1), r])),
      },
    },
  };
  return { css, config };
}

// ---- DESIGN.md --------------------------------------------------------------
function toDesignMd(m: TokenModel, meta: DesignMeta): string {
  const L: string[] = [];
  L.push(`# Design System${meta.title ? ` — ${meta.title}` : ''}`);
  if (meta.url) L.push(`\n> Extracted from ${meta.url}`);

  if (meta.logo || meta.favicon) {
    L.push('\n## Brand');
    if (meta.logo) L.push(`- **Logo:** ${meta.logo}`);
    if (meta.favicon) L.push(`- **Favicon:** ${meta.favicon}`);
  }

  L.push('\n## Colors');
  if (m.colors.primary) L.push(`- **Primary:** \`${m.colors.primary}\``);
  if (m.colors.secondary) L.push(`- **Secondary:** \`${m.colors.secondary}\``);
  if (m.colors.accent.length) L.push(`- **Accent:** ${m.colors.accent.map((h) => `\`${h}\``).join(', ')}`);
  const scaleLine = (label: string, sc: Record<string, string>) => {
    const keys = Object.keys(sc); if (!keys.length) return;
    L.push(`- **${label}:** ${keys.map((k) => `${k}=\`${sc[k]}\``).join(', ')}`);
  };
  scaleLine('Neutral', m.colors.neutral);
  scaleLine('Background', m.colors.background);
  scaleLine('Text', m.colors.text);

  L.push('\n## Typography');
  if (m.fontFamily.heading) L.push(`- **Heading font:** ${m.fontFamily.heading}`);
  if (m.fontFamily.body) L.push(`- **Body font:** ${m.fontFamily.body}`);
  if (m.typeScale.length) {
    L.push('\n| Token | Size | Weight | Line-height |');
    L.push('|-------|------|--------|-------------|');
    for (const t of m.typeScale) L.push(`| ${t.name} | ${t.size}px | ${t.weight} | ${t.lineHeight} |`);
  }

  L.push('\n## Spacing');
  L.push(m.spacing.length ? m.spacing.map((v) => `\`${v}px\``).join(' · ') : '_none detected_');

  L.push('\n## Border radius');
  L.push(m.borderRadius.length ? m.borderRadius.map((r) => `\`${r}\``).join(' · ') : '_none detected_');

  L.push('\n## Usage');
  L.push('- **Tailwind v4:** paste `tailwindCss` into your global stylesheet (`@theme { … }`).');
  L.push('- **Tailwind v3:** merge `tailwindConfig` into `tailwind.config.js` (`theme.extend`).');
  L.push('- **Framework-agnostic:** use `cssVars` (`:root { … }`).');
  L.push('- **Figma:** import `tokens.dtcg.json` via the **Tokens Studio** plugin (W3C DTCG → Figma Variables).');

  return L.join('\n') + '\n';
}

// ---- public entrypoint ------------------------------------------------------
export interface DesignMeta {
  url?: string;
  title?: string;
  logo?: string;
  favicon?: string;
}

export function buildDesignSystem(
  design: DesignResult,
  palette: PaletteResult,
  meta: DesignMeta = {}
) {
  const model = normalize(design || {}, palette || {});
  const tw = toTailwind(model);
  return {
    designMd: toDesignMd(model, meta),
    tokensDtcg: toDTCG(model),
    tailwindCss: tw.css,
    tailwindConfig: tw.config,
    cssVars: toCssVars(model),
    brand: { logo: meta.logo || null, favicon: meta.favicon || null },
    summary: {
      colors: {
        primary: model.colors.primary || null,
        secondary: model.colors.secondary || null,
        accent: model.colors.accent.length,
        neutral: Object.keys(model.colors.neutral).length,
        background: Object.keys(model.colors.background).length,
        text: Object.keys(model.colors.text).length,
      },
      fontFamilies: { heading: model.fontFamily.heading || null, body: model.fontFamily.body || null },
      typeScale: model.typeScale.length,
      spacing: model.spacing.length,
      borderRadius: model.borderRadius.length,
    },
  };
}
