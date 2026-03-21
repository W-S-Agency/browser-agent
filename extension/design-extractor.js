// Design Extractor Module
// Extracts design tokens from web pages for 2P Builder pipeline
// Colors, typography, spacing → Tailwind config

class DesignExtractor {

  /**
   * Full design audit of a section or page
   * Returns colors, typography, spacing, border radius
   */
  async extractDesign(tabId, selector) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const scope = sel ? document.querySelector(sel) : document.body;
        if (!scope) throw new Error(`Element not found: ${sel}`);

        const styles = new Map();
        const colors = new Set();
        const bgColors = new Set();
        const fonts = new Map();
        const spacings = new Set();
        const radii = new Set();

        // Walk all elements in scope
        const elements = [scope, ...scope.querySelectorAll('*')];

        for (const el of elements) {
          const cs = getComputedStyle(el);

          // Colors
          if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)') colors.add(cs.color);
          if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgColors.add(cs.backgroundColor);
          if (cs.borderColor && cs.borderColor !== 'rgba(0, 0, 0, 0)') colors.add(cs.borderColor);

          // Typography
          const fontKey = `${cs.fontFamily}|${cs.fontWeight}|${cs.fontSize}|${cs.lineHeight}`;
          if (!fonts.has(fontKey)) {
            fonts.set(fontKey, {
              fontFamily: cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
              fontWeight: cs.fontWeight,
              fontSize: cs.fontSize,
              lineHeight: cs.lineHeight,
              letterSpacing: cs.letterSpacing,
              textTransform: cs.textTransform !== 'none' ? cs.textTransform : undefined,
              element: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || undefined
            });
          }

          // Spacing
          if (cs.padding !== '0px') spacings.add(`padding:${cs.padding}`);
          if (cs.margin !== '0px') spacings.add(`margin:${cs.margin}`);
          if (cs.gap && cs.gap !== 'normal') spacings.add(`gap:${cs.gap}`);

          // Border radius
          if (cs.borderRadius !== '0px') radii.add(cs.borderRadius);
        }

        // Helper: convert CSS color to hex
        function cssToHex(cssColor) {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = cssColor;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          if (a === 0) return null;
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }

        // Convert colors to hex
        const textColors = [...colors].map(cssToHex).filter(Boolean);
        const backgroundColors = [...bgColors].map(cssToHex).filter(Boolean);
        const allColors = [...new Set([...textColors, ...backgroundColors])];

        // Categorize typography by heading vs body
        const fontEntries = [...fonts.values()];
        const headingFonts = fontEntries.filter(f =>
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(f.element) ||
          f.role === 'heading' ||
          parseInt(f.fontSize) > 20
        );
        const bodyFonts = fontEntries.filter(f =>
          !['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(f.element) &&
          f.role !== 'heading' &&
          parseInt(f.fontSize) <= 20
        );

        return {
          colors: {
            text: [...new Set(textColors)],
            background: [...new Set(backgroundColors)],
            all: allColors
          },
          typography: {
            headings: headingFonts.sort((a, b) => parseInt(b.fontSize) - parseInt(a.fontSize)),
            body: bodyFonts.sort((a, b) => parseInt(b.fontSize) - parseInt(a.fontSize)).slice(0, 5),
            allFontFamilies: [...new Set(fontEntries.map(f => f.fontFamily))]
          },
          spacing: {
            unique: [...spacings].slice(0, 20)
          },
          borderRadius: [...radii],
          scope: sel || 'body'
        };
      },
      args: [selector || null]
    });

    return result[0].result;
  }

  /**
   * Extract color palette and generate Tailwind config fragment
   */
  async extractPalette(tabId) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const colorMap = new Map(); // hex -> count

        function cssToHex(cssColor) {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = cssColor;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          if (a === 0) return null;
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }

        function hexToHSL(hex) {
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          if (max === min) { h = s = 0; }
          else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
          }
          return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
        }

        // Scan all elements
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const cs = getComputedStyle(el);
          const props = [cs.color, cs.backgroundColor, cs.borderColor, cs.outlineColor];
          for (const prop of props) {
            const hex = cssToHex(prop);
            if (hex && hex !== '#000000') {
              colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
            }
          }
        }

        // Sort by frequency
        const sorted = [...colorMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([hex, count]) => ({ hex, count, hsl: hexToHSL(hex) }));

        // Categorize
        const categorized = {
          primary: null,
          secondary: null,
          background: [],
          text: [],
          accent: [],
          neutral: []
        };

        for (const color of sorted) {
          const { l, s } = color.hsl;
          if (l > 90) {
            categorized.background.push(color.hex);
          } else if (l < 15) {
            categorized.text.push(color.hex);
          } else if (s > 50 && !categorized.primary) {
            categorized.primary = color.hex;
          } else if (s > 50 && !categorized.secondary) {
            categorized.secondary = color.hex;
          } else if (s > 30) {
            categorized.accent.push(color.hex);
          } else {
            categorized.neutral.push(color.hex);
          }
        }

        // Generate Tailwind config
        const tailwindColors = {};
        if (categorized.primary) tailwindColors.primary = { DEFAULT: categorized.primary };
        if (categorized.secondary) tailwindColors.secondary = { DEFAULT: categorized.secondary };
        if (categorized.accent.length > 0) tailwindColors.accent = { DEFAULT: categorized.accent[0] };
        if (categorized.background.length > 0) tailwindColors.background = categorized.background[0];
        if (categorized.text.length > 0) tailwindColors.foreground = categorized.text[0];

        return {
          palette: sorted.slice(0, 20),
          categorized,
          tailwindConfig: {
            theme: {
              extend: {
                colors: tailwindColors
              }
            }
          },
          total: colorMap.size
        };
      }
    });

    return result[0].result;
  }

  /**
   * Extract a section's HTML + computed styles for reproduction
   */
  async extractSection(tabId, selector) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);

        // Get outer HTML
        const html = el.outerHTML;

        // Get computed styles of the section root
        const cs = getComputedStyle(el);
        const rootStyles = {
          display: cs.display,
          flexDirection: cs.flexDirection,
          justifyContent: cs.justifyContent,
          alignItems: cs.alignItems,
          gap: cs.gap,
          padding: cs.padding,
          margin: cs.margin,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          fontFamily: cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
          fontSize: cs.fontSize,
          maxWidth: cs.maxWidth,
          borderRadius: cs.borderRadius,
          position: cs.position
        };

        // Find all images
        const images = [...el.querySelectorAll('img')].map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight
        }));

        // Find all links
        const links = [...el.querySelectorAll('a')].map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 100)
        }));

        // Describe structure
        const children = [...el.children].map(child => {
          const childCs = getComputedStyle(child);
          return {
            tag: child.tagName.toLowerCase(),
            class: child.className?.substring?.(0, 100),
            display: childCs.display,
            text: child.textContent?.trim()?.substring(0, 50)
          };
        });

        return {
          html: html.substring(0, 50000), // Limit size
          rootStyles,
          images,
          links,
          structure: children,
          dimensions: {
            width: el.offsetWidth,
            height: el.offsetHeight
          }
        };
      },
      args: [selector]
    });

    return result[0].result;
  }

  /**
   * Extract SEO data from the page
   */
  async extractSEO(tabId) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getMeta = (name) => {
          const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return el?.content || null;
        };

        // Headings
        const headings = {};
        for (let i = 1; i <= 6; i++) {
          const els = document.querySelectorAll(`h${i}`);
          if (els.length > 0) {
            headings[`h${i}`] = [...els].map(el => el.textContent.trim().substring(0, 200));
          }
        }

        // Images without alt
        const images = [...document.querySelectorAll('img')];
        const imagesWithoutAlt = images.filter(img => !img.alt || img.alt.trim() === '');

        // Structured data (JSON-LD)
        const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map(el => {
            try { return JSON.parse(el.textContent); } catch { return null; }
          })
          .filter(Boolean);

        // Internal vs external links
        const links = [...document.querySelectorAll('a[href]')];
        const hostname = window.location.hostname;
        const internalLinks = links.filter(a => {
          try { return new URL(a.href).hostname === hostname; } catch { return false; }
        });
        const externalLinks = links.filter(a => {
          try { return new URL(a.href).hostname !== hostname; } catch { return false; }
        });

        return {
          title: document.title,
          description: getMeta('description'),
          keywords: getMeta('keywords'),
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          robots: getMeta('robots'),
          openGraph: {
            title: getMeta('og:title'),
            description: getMeta('og:description'),
            image: getMeta('og:image'),
            url: getMeta('og:url'),
            type: getMeta('og:type'),
            siteName: getMeta('og:site_name')
          },
          twitter: {
            card: getMeta('twitter:card'),
            title: getMeta('twitter:title'),
            description: getMeta('twitter:description'),
            image: getMeta('twitter:image')
          },
          headings,
          structuredData: jsonLd,
          links: {
            internal: internalLinks.length,
            external: externalLinks.length,
            total: links.length
          },
          images: {
            total: images.length,
            withoutAlt: imagesWithoutAlt.length,
            missingAlt: imagesWithoutAlt.map(img => img.src).slice(0, 10)
          },
          lang: document.documentElement.lang,
          charset: document.characterSet,
          viewport: getMeta('viewport')
        };
      }
    });

    return result[0].result;
  }
}

// Export singleton
const designExtractor = new DesignExtractor();