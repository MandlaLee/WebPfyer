export const PRESETS = {
  auto: { label: 'Auto', widths: [1920, 1280, 960], quality: 80, hint: 'Analyzes each image and selects photo or graphic settings automatically.' },
  hero: { label: 'Website hero', widths: [1920, 1280, 960], quality: 80, hint: 'Responsive hero variants: 1920px, 1280px and 960px wide.' },
  page: { label: 'Page image', widths: [1600, 1200, 800], quality: 80, hint: 'Balanced section images for desktop, tablet and mobile.' },
  card: { label: 'Card image', widths: [800, 600, 400], quality: 80, hint: 'Compact files for grids, cards and listing pages.' },
  thumbnail: { label: 'Thumbnail', sizes: [{ width: 640, height: 360 }, { width: 320, height: 180 }], quality: 78, fit: 'cover', hint: '16:9 thumbnail outputs at 640×360 and 320×180.' },
  blog: { label: 'Blog image', widths: [1200, 800], quality: 80, hint: 'Content-friendly images for articles and guides.' },
  product: { label: 'Product image', sizes: [{ width: 1200, height: 1200 }, { width: 800, height: 800 }, { width: 400, height: 400 }], quality: 84, fit: 'contain', hint: 'Square contain-mode images that do not crop the product.' },
  logo: { label: 'Logo / transparent graphic', widths: [1200, 800, 400], quality: 100, lossless: true, hint: 'Maximum-quality output with transparency preserved and no upscaling.' },
  social: { label: 'Social image', sizes: [{ width: 1080, height: 1350 }], quality: 86, fit: 'cover', hint: 'Instagram portrait output at 1080×1350.' },
  custom: { label: 'Custom', widths: [1200], quality: 80, hint: 'Choose your own dimensions and fit mode.' }
};

export function getPreset(name) {
  return PRESETS[name] || PRESETS.auto;
}
