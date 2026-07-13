export function buildPictureMarkup(result, options = {}) {
  if (!result?.variants?.length) return 'Convert an image to generate markup.';
  const path = normalizePath(options.path || 'assets/images/');
  const alt = escapeHtml(options.alt || '');
  const hero = options.hero !== false;
  const sorted = [...result.variants].sort((a, b) => a.width - b.width);
  const largest = sorted.at(-1);
  const smallest = sorted[0];
  const srcset = sorted.map(v => `      ${path}${v.filename} ${v.width}w`).join(',\n');
  const source = sorted.length > 1 ? `  <source\n    media="(max-width: 640px)"\n    srcset="${path}${smallest.filename}"\n  >\n\n` : '';
  const loading = hero ? '    fetchpriority="high"\n' : '    loading="lazy"\n';
  return `<picture>\n${source}  <img\n    src="${path}${largest.filename}"\n    srcset="\n${srcset}\n    "\n    sizes="100vw"\n    width="${largest.width}"\n    height="${largest.height}"\n    alt="${alt}"\n${loading}    decoding="async"\n  >\n</picture>`;
}

function normalizePath(path) { return path ? `${path.replace(/\\/g, '/').replace(/\/?$/, '/')}` : ''; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
