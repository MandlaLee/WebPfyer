import { PRESETS, getPreset } from './presets.js';
import { analyzeImage, decodeImage, outputSizes, renderCanvas, canvasToWebP, supportsWebP } from './image.js';
import { createZip } from './zip.js';
import { buildPictureMarkup } from './html.js';

const $ = selector => document.querySelector(selector);
const els = {
  fileInput: $('#fileInput'), heroChooseBtn: $('#heroChooseBtn'), dropZone: $('#dropZone'), queue: $('#queue'),
  queueSummary: $('#queueSummary'), clearBtn: $('#clearBtn'), presetSelect: $('#presetSelect'), presetHint: $('#presetHint'),
  qualityRange: $('#qualityRange'), qualityOutput: $('#qualityOutput'), qualityControls: $('#qualityControls'),
  targetControls: $('#targetControls'), targetSize: $('#targetSize'), responsiveToggle: $('#responsiveToggle'),
  noUpscaleToggle: $('#noUpscaleToggle'), transparencyToggle: $('#transparencyToggle'), filenameInput: $('#filenameInput'),
  customControls: $('#customControls'), customWidth: $('#customWidth'), customHeight: $('#customHeight'), fitMode: $('#fitMode'),
  convertBtn: $('#convertBtn'), progressWrap: $('#progressWrap'), progressBar: $('#progressBar'), progressText: $('#progressText'),
  resultsSection: $('#resultsSection'), results: $('#results'), downloadAllBtn: $('#downloadAllBtn'),
  htmlOutput: $('#htmlOutput'), copyHtmlBtn: $('#copyHtmlBtn'), altTextInput: $('#altTextInput'), assetPathInput: $('#assetPathInput'),
  heroMarkupToggle: $('#heroMarkupToggle'), clearBtn: $('#clearBtn'), themeBtn: $('#themeBtn'), installBtn: $('#installBtn'),
  toastRegion: $('#toastRegion'), onboardingDialog: $('#onboardingDialog'), dontShowAgain: $('#dontShowAgain')
};

const state = { items: [], results: [], compressionMode: 'quality', busy: false, installPrompt: null };
const ACCEPTED = new Set(['image/png','image/jpeg','image/webp','image/bmp','image/gif']);
const MAX_FILES = 30;

init();

async function init() {
  initTheme();
  bindEvents();
  updatePresetUI();
  if (!(await supportsWebP())) {
    toast('This browser cannot encode WebP files. Please use a current Chrome, Edge, Firefox or Safari.', 'error', 9000);
    els.convertBtn.disabled = true;
  }
  registerPWA();
  if (!localStorage.getItem('webpfyer:onboarding-seen')) setTimeout(() => els.onboardingDialog.showModal(), 550);
}

function bindEvents() {
  els.heroChooseBtn.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', event => { addFiles([...event.target.files]); event.target.value = ''; });
  ['dragenter','dragover'].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.add('is-dragging'); }));
  ['dragleave','drop'].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.remove('is-dragging'); }));
  els.dropZone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));
  document.addEventListener('paste', event => {
    const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'));
    if (files.length) { event.preventDefault(); addFiles(files); }
  });
  els.clearBtn.addEventListener('click', clearAll);
  els.presetSelect.addEventListener('change', updatePresetUI);
  els.qualityRange.addEventListener('input', () => els.qualityOutput.textContent = els.qualityRange.value);
  document.querySelectorAll('.segment').forEach(button => button.addEventListener('click', () => setCompressionMode(button.dataset.mode)));
  els.convertBtn.addEventListener('click', convertAll);
  els.downloadAllBtn.addEventListener('click', downloadAll);
  els.copyHtmlBtn.addEventListener('click', copyHtml);
  [els.altTextInput, els.assetPathInput, els.heroMarkupToggle].forEach(el => el.addEventListener('input', updateMarkup));
  els.themeBtn.addEventListener('click', toggleTheme);
  els.installBtn.addEventListener('click', installApp);
  els.onboardingDialog.addEventListener('close', () => {
    if (els.dontShowAgain.checked || els.onboardingDialog.returnValue === 'start') localStorage.setItem('webpfyer:onboarding-seen','1');
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.installPrompt = event; els.installBtn.hidden = false; });
  window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; state.installPrompt = null; toast('WebPfyer was installed.', 'success'); });
}

async function addFiles(files) {
  if (state.busy) return;
  const remaining = MAX_FILES - state.items.length;
  if (remaining <= 0) return toast(`A maximum of ${MAX_FILES} images can be processed at once.`, 'error');
  const valid = files.filter(file => ACCEPTED.has(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)).slice(0, remaining);
  const rejected = files.length - valid.length;
  if (rejected) toast(`${rejected} unsupported or excess file${rejected === 1 ? ' was' : 's were'} skipped.`, 'error');
  if (!valid.length) return;

  const total = valid.reduce((sum,file) => sum + file.size,0);
  if (total > 300 * 1024 * 1024) toast('This batch is very large and may use significant browser memory.', 'error', 7000);

  for (const file of valid) {
    const item = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, file, url: URL.createObjectURL(file), analysis: null, status: 'Analyzing…', result: null };
    state.items.push(item);
    renderQueue();
    try {
      item.analysis = await analyzeImage(file);
      item.status = 'Ready';
    } catch (error) {
      item.status = 'Unsupported';
      item.error = error.message;
    }
    renderQueue();
  }
  updateControls();
  document.querySelector('#converter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQueue() {
  els.queue.innerHTML = state.items.map(item => {
    const a = item.analysis;
    const meta = a ? `${a.width}×${a.height} · ${formatBytes(item.file.size)}` : `${formatBytes(item.file.size)} · ${item.status}`;
    const category = a ? `<span class="badge">${escapeHtml(a.category)}</span>` : '';
    return `<article class="queue-item" data-id="${item.id}">
      <img class="queue-thumb" src="${item.url}" alt="">
      <div class="queue-info"><strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong><div class="queue-meta"><span>${meta}</span>${category}</div></div>
      <button class="remove-item" type="button" aria-label="Remove ${escapeHtml(item.file.name)}">×</button>
    </article>`;
  }).join('');
  els.queue.querySelectorAll('.remove-item').forEach(button => button.addEventListener('click', () => removeItem(button.closest('.queue-item').dataset.id)));
  const ready = state.items.filter(item => item.analysis && !item.error).length;
  els.queueSummary.textContent = state.items.length ? `${state.items.length} image${state.items.length === 1 ? '' : 's'} · ${ready} ready` : 'No files selected';
}

function removeItem(id) {
  const index = state.items.findIndex(item => item.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(state.items[index].url);
  revokeResult(state.items[index].result);
  state.items.splice(index,1);
  renderQueue();
  updateControls();
}

function clearAll() {
  state.items.forEach(item => { URL.revokeObjectURL(item.url); revokeResult(item.result); });
  state.items = [];
  state.results = [];
  els.results.innerHTML = '';
  els.resultsSection.hidden = true;
  renderQueue();
  updateControls();
}

function updateControls() {
  const ready = state.items.some(item => item.analysis && !item.error);
  els.convertBtn.disabled = !ready || state.busy;
  els.clearBtn.disabled = !state.items.length || state.busy;
}

function updatePresetUI() {
  const preset = getPreset(els.presetSelect.value);
  els.presetHint.textContent = preset.hint;
  els.qualityRange.value = preset.quality;
  els.qualityOutput.textContent = preset.quality;
  els.customControls.hidden = els.presetSelect.value !== 'custom';
  if (els.presetSelect.value === 'logo') els.transparencyToggle.checked = true;
}

function setCompressionMode(mode) {
  state.compressionMode = mode;
  document.querySelectorAll('.segment').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  els.qualityControls.hidden = mode !== 'quality';
  els.targetControls.hidden = mode !== 'target';
}

async function convertAll() {
  if (state.busy) return;
  const readyItems = state.items.filter(item => item.analysis && !item.error);
  if (!readyItems.length) return;
  state.busy = true;
  updateControls();
  els.progressWrap.hidden = false;
  state.results.forEach(revokeResult);
  state.results = [];

  try {
    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      setProgress(i / readyItems.length, `Processing ${i + 1} of ${readyItems.length}: ${item.file.name}`);
      try {
        const result = await convertItem(item, i, readyItems.length);
        item.result = result;
        state.results.push(result);
      } catch (error) {
        toast(`${item.file.name}: ${error.message}`, 'error', 7000);
      }
      await nextFrame();
    }
    setProgress(1, `Finished ${state.results.length} image${state.results.length === 1 ? '' : 's'}.`);
    renderResults();
    els.resultsSection.hidden = !state.results.length;
    if (state.results.length) {
      updateMarkup();
      els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Image optimization complete.', 'success');
    }
  } finally {
    state.busy = false;
    updateControls();
    setTimeout(() => { els.progressWrap.hidden = true; }, 1200);
  }
}

async function convertItem(item, index, count) {
  const selectedName = els.presetSelect.value;
  let preset = getPreset(selectedName);
  let presetName = selectedName;
  let quality = Number(els.qualityRange.value);

  if (selectedName === 'auto') {
    if (item.analysis.category === 'Transparent graphic') { preset = PRESETS.logo; presetName = 'logo'; quality = 100; }
    else if (item.analysis.category === 'Screenshot / flat graphic') { preset = PRESETS.page; presetName = 'page'; quality = Math.max(88, quality); }
    else { preset = PRESETS.page; presetName = 'page'; }
  }

  const options = {
    presetName,
    responsive: els.responsiveToggle.checked,
    noUpscale: els.noUpscaleToggle.checked,
    preserveTransparency: els.transparencyToggle.checked,
    customWidth: els.customWidth.value,
    customHeight: els.customHeight.value,
    fitMode: els.fitMode.value
  };
  let sizes = outputSizes(preset, item.analysis.width, item.analysis.height, options);
  if (!sizes.length) sizes = [{ width: item.analysis.width, height: null, fit: 'preserve' }];
  const decoded = await decodeImage(item.file);
  const base = makeBaseName(els.filenameInput.value || stripExtension(item.file.name), count > 1 && els.filenameInput.value ? index + 1 : null);
  const variants = [];

  try {
    for (const request of sizes) {
      const canvas = renderCanvas(decoded, request, { preserveTransparency: options.preserveTransparency && item.analysis.transparent });
      const blob = await canvasToWebP(canvas, {
        mode: state.compressionMode,
        quality,
        targetKB: Number(els.targetSize.value) || 250,
        minQuality: 45
      });
      const dimensions = sizes.length > 1 ? `-${canvas.width}${request.height ? `x${canvas.height}` : ''}` : '';
      const filename = `${base}${dimensions}.webp`;
      variants.push({ filename, blob, width: canvas.width, height: canvas.height, size: blob.size, url: URL.createObjectURL(blob) });
      canvas.width = canvas.height = 1;
      await nextFrame();
    }
  } finally { decoded.close(); }

  const totalOutput = variants.reduce((sum,v) => sum + v.size,0);
  return {
    id: item.id,
    originalName: item.file.name,
    originalSize: item.file.size,
    originalWidth: item.analysis.width,
    originalHeight: item.analysis.height,
    category: item.analysis.category,
    base,
    variants,
    totalOutput,
    savings: Math.max(0, 1 - totalOutput / item.file.size)
  };
}

function renderResults() {
  els.results.innerHTML = state.results.map(result => {
    const preview = [...result.variants].sort((a,b) => b.width - a.width)[0];
    const variantRows = result.variants.map((v, i) => `<div class="variant-row"><span>${v.width}×${v.height}</span><span>${formatBytes(v.size)}</span><button type="button" data-result="${result.id}" data-variant="${i}">Download</button></div>`).join('');
    return `<article class="result-card panel">
      <div class="result-preview"><img src="${preview.url}" alt="Preview of ${escapeHtml(result.originalName)}"><span class="result-savings">${formatPercent(result.savings)} saved</span></div>
      <div class="result-body"><h3 title="${escapeHtml(result.originalName)}">${escapeHtml(result.originalName)}</h3>
        <div class="result-summary"><span>${formatBytes(result.originalSize)} original</span><span>${formatBytes(result.totalOutput)} output</span></div>
        <div class="variants">${variantRows}</div>
      </div>
    </article>`;
  }).join('');
  els.results.querySelectorAll('[data-variant]').forEach(button => button.addEventListener('click', () => {
    const result = state.results.find(r => r.id === button.dataset.result);
    const variant = result?.variants[Number(button.dataset.variant)];
    if (variant) downloadBlob(variant.blob, variant.filename);
  }));
}

async function downloadAll() {
  if (!state.results.length) return;
  els.downloadAllBtn.disabled = true;
  els.downloadAllBtn.textContent = 'Building ZIP…';
  try {
    const entries = [];
    for (const result of state.results) {
      result.variants.forEach(variant => entries.push({ name: `webpfyer-output/images/${variant.filename}`, blob: variant.blob }));
      entries.push({ name: `webpfyer-output/snippets/${result.base}.html`, blob: new Blob([buildPictureMarkup(result, { path: 'assets/images/', alt: '', hero: true })], { type: 'text/html' }) });
    }
    const report = {
      generatedBy: 'WebPfyer',
      generatedAt: new Date().toISOString(),
      images: state.results.map(result => ({ original: result.originalName, originalBytes: result.originalSize, outputBytes: result.totalOutput, savingsPercent: Number((result.savings * 100).toFixed(2)), variants: result.variants.map(v => ({ filename: v.filename, width: v.width, height: v.height, bytes: v.size })) }))
    };
    entries.push({ name: 'webpfyer-output/report.json', blob: new Blob([JSON.stringify(report,null,2)], { type: 'application/json' }) });
    const zip = await createZip(entries);
    downloadBlob(zip, 'webpfyer-output.zip');
    toast('ZIP download prepared.', 'success');
  } catch (error) { toast(`ZIP creation failed: ${error.message}`, 'error', 7000); }
  finally { els.downloadAllBtn.disabled = false; els.downloadAllBtn.textContent = 'Download all as ZIP'; }
}

function updateMarkup() {
  const result = state.results[0];
  els.htmlOutput.textContent = buildPictureMarkup(result, { alt: els.altTextInput.value, path: els.assetPathInput.value, hero: els.heroMarkupToggle.checked });
}

async function copyHtml() {
  try { await navigator.clipboard.writeText(els.htmlOutput.textContent); toast('HTML copied to clipboard.', 'success'); }
  catch (_) { toast('Clipboard access failed. Select the code and copy it manually.', 'error'); }
}

function setProgress(value, text) { els.progressBar.style.width = `${Math.round(value * 100)}%`; els.progressText.textContent = text; }
function nextFrame() { return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); }
function stripExtension(name) { return name.replace(/\.[^.]+$/, ''); }
function makeBaseName(value, index) {
  let slug = String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
  if (!slug) slug = 'webpfyer-image';
  return index ? `${slug}-${String(index).padStart(2,'0')}` : slug;
}
function formatBytes(bytes) { if (!Number.isFinite(bytes) || bytes === 0) return '0 B'; const units=['B','KB','MB','GB']; const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024))); return `${(bytes/1024**i).toFixed(i ? 1 : 0)} ${units[i]}`; }
function formatPercent(value) { return `${Math.max(0,value*100).toFixed(value > .1 ? 1 : 0)}%`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function downloadBlob(blob, filename) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
function revokeResult(result) { result?.variants?.forEach(v => URL.revokeObjectURL(v.url)); }
function toast(message, type='success', duration=3800) { const node=document.createElement('div'); node.className=`toast ${type}`; node.textContent=message; els.toastRegion.append(node); setTimeout(()=>node.remove(),duration); }

function initTheme() {
  const saved = localStorage.getItem('webpfyer:theme');
  const theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  els.themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
}
function toggleTheme() { const next=document.documentElement.dataset.theme==='dark'?'light':'dark'; document.documentElement.dataset.theme=next; localStorage.setItem('webpfyer:theme',next); els.themeBtn.textContent=next==='dark'?'☀':'☾'; }
async function installApp() { if (!state.installPrompt) return; state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt=null; els.installBtn.hidden=true; }
function registerPWA() { if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(() => {}); }
