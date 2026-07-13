export async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    } catch (_) { /* fallback below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error('This image could not be decoded by your browser.');
  }
}

export async function analyzeImage(file) {
  const decoded = await decodeImage(file);
  try {
    const sample = document.createElement('canvas');
    const scale = Math.min(1, 80 / Math.max(decoded.width, decoded.height));
    sample.width = Math.max(1, Math.round(decoded.width * scale));
    sample.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(decoded.source, 0, 0, sample.width, sample.height);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    let transparent = false;
    const colors = new Set();
    let changes = 0;
    let prev = null;
    for (let i = 0; i < pixels.length; i += 16) {
      const a = pixels[i + 3];
      if (a < 250) transparent = true;
      const key = `${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4},${a >> 5}`;
      colors.add(key);
      if (prev && prev !== key) changes++;
      prev = key;
    }
    const photoLike = colors.size > 120 || changes > 500;
    return {
      width: decoded.width,
      height: decoded.height,
      transparent,
      category: transparent && !photoLike ? 'Transparent graphic' : photoLike ? 'Photograph' : 'Screenshot / flat graphic'
    };
  } finally { decoded.close(); }
}

export function outputSizes(preset, sourceWidth, sourceHeight, options) {
  let requested;
  if (options.presetName === 'custom') {
    const width = Math.max(1, Number(options.customWidth) || sourceWidth);
    const height = Number(options.customHeight) || null;
    requested = [{ width, height, fit: options.fitMode || 'preserve' }];
  } else if (preset.sizes) {
    requested = preset.sizes.map(size => ({ ...size, fit: preset.fit || 'preserve' }));
  } else {
    requested = preset.widths.map(width => ({ width, height: null, fit: 'preserve' }));
  }

  if (!options.responsive) requested = [requested[0]];
  const seen = new Set();
  return requested.filter(size => {
    if (options.noUpscale && size.width > sourceWidth && (!size.height || size.height > sourceHeight)) return false;
    const key = `${size.width}x${size.height || 'auto'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(size => {
    if (!size.height || size.fit === 'preserve') {
      return { width: Math.min(size.width, options.noUpscale ? sourceWidth : size.width), height: null, fit: 'preserve' };
    }
    return size;
  });
}

export function renderCanvas(decoded, request, options = {}) {
  const srcW = decoded.width;
  const srcH = decoded.height;
  const fit = request.fit || 'preserve';
  let outW = Math.max(1, Math.round(request.width || srcW));
  let outH = request.height ? Math.max(1, Math.round(request.height)) : Math.max(1, Math.round(srcH * (outW / srcW)));

  if (fit === 'preserve') outH = Math.max(1, Math.round(srcH * (outW / srcW)));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { alpha: options.preserveTransparency !== false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!options.preserveTransparency) {
    ctx.fillStyle = options.background || '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }

  if (fit === 'cover') {
    const scale = Math.max(outW / srcW, outH / srcH);
    const sw = outW / scale;
    const sh = outH / scale;
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, outW, outH);
  } else if (fit === 'contain') {
    const scale = Math.min(outW / srcW, outH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    ctx.drawImage(decoded.source, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(decoded.source, 0, 0, outW, outH);
  }
  return canvas;
}

export async function canvasToWebP(canvas, { mode = 'quality', quality = 80, targetKB = 250, minQuality = 45 } = {}) {
  if (mode !== 'target') return toBlob(canvas, quality / 100);
  const target = targetKB * 1024;
  let low = minQuality / 100;
  let high = Math.min(1, Math.max(low, quality / 100));
  let best = await toBlob(canvas, high);
  if (best.size <= target) return best;

  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2;
    const blob = await toBlob(canvas, mid);
    if (blob.size > target) high = mid;
    else { best = blob; low = mid; }
  }
  if (best.size > target) best = await toBlob(canvas, minQuality / 100);
  return best;
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Your browser could not encode this image as WebP.')), 'image/webp', quality);
  });
}

export async function supportsWebP() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .8));
  return Boolean(blob && blob.type === 'image/webp');
}
