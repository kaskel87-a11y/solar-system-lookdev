// Quality tiers. 'low' = phones (iPhone 12+ class), 'med' = tablets / weak laptops, 'high' = desktop GPUs.
// Pick with ?tier=low|med|high, otherwise auto: touch/small screen -> low, else high. The game can also step
// down at runtime (see INTEGRATION.md: FPS governor) by calling applyTier() with the next tier down.
export const TIERS = {
  low: {
    name: 'low', pixelRatioCap: 1.25, msaa: 0, shadowSize: 1024, shadowSoft: false, shadowRange: 34,
    ao: false, bloomScale: 0.5, grain: true, vignette: true, chroma: false,
    terrainSeg: 150, farSeg: 56, texRes: '1k', modelDir: 'phone', triplanar: false, gravelLayer: false,
    dust: 260, pointLights: 0, envRes: '1k', rocks: 40, props: 0.6,
  },
  med: {
    name: 'med', pixelRatioCap: 1.5, msaa: 0, shadowSize: 2048, shadowSoft: true, shadowRange: 40,
    ao: false, bloomScale: 0.75, grain: true, vignette: true, chroma: false,
    terrainSeg: 200, farSeg: 72, texRes: '1k', modelDir: 'phone', triplanar: true, gravelLayer: true,
    dust: 700, pointLights: 3, envRes: '1k', rocks: 70, props: 1,
  },
  high: {
    name: 'high', pixelRatioCap: 2, msaa: 4, shadowSize: 4096, shadowSoft: true, shadowRange: 46,
    ao: true, bloomScale: 1, grain: true, vignette: true, chroma: false,
    terrainSeg: 280, farSeg: 96, texRes: '2k', modelDir: 'desktop', triplanar: true, gravelLayer: true,
    dust: 1600, pointLights: 6, envRes: '2k', rocks: 110, props: 1,
  },
};
// Device class: anything phone/tablet-like is 'mobile' (-> low). Chrome iOS = CriOS, Firefox iOS = FxiOS, Edge iOS = EdgiOS;
// iPadOS (and iOS "Request Desktop Site") report a Macintosh UA but have multi-touch.
export function deviceClass() {
  const ua = navigator.userAgent || '', tp = navigator.maxTouchPoints || 0;
  const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const small = Math.min(screen.width, screen.height) <= 900;
  if (/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS|Android|Mobile/i.test(ua)) return { cls: 'mobile', why: 'mobile UA' };
  if (/Macintosh/i.test(ua) && tp > 1) return { cls: 'mobile', why: 'iPadOS/iOS desktop-mode UA + touch' };
  if (mm('(pointer: coarse)') && !mm('(any-pointer: fine)')) return { cls: 'mobile', why: 'coarse pointer' };
  if ((tp > 0 || 'ontouchstart' in window) && small) return { cls: 'mobile', why: 'touch + small screen' };
  return { cls: 'desktop', why: 'desktop' };
}
const KEY = 'ssx-lookdev-tier', DKEY = 'ssx-lookdev-downgrade';
export const LOWER = { high: 'med', med: 'low' };
/** auto tiers only: remember a lower tier for this browser session and reload */
export function downgrade(name) { try { sessionStorage.setItem(DKEY, name); } catch {} location.reload(); }
// Manual choices are remembered per device class, and only when the user tapped a tier button,
// so a 'high' picked on a laptop (or a stale value) never wins on a phone.
export function saveTier(name) { try { sessionStorage.removeItem(DKEY); localStorage.setItem(KEY, JSON.stringify({ tier: name, cls: deviceClass().cls, picked: true })); } catch {} }
export function pickTier() {
  const dc = deviceClass();
  const q = new URLSearchParams(location.search).get('tier');
  if (q && TIERS[q]) return { ...TIERS[q], reason: 'url' };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.picked && s.cls === dc.cls && TIERS[s.tier]) return { ...TIERS[s.tier], reason: 'saved' }; } catch {}
  // Real iPhone (Chrome iOS) data, Oct 25 2026: high 16 fps, med 60 (vsync cap), low 60 -> phones start on med.
  try { const d = sessionStorage.getItem(DKEY); if (d && TIERS[d]) return { ...TIERS[d], reason: 'auto-downgraded (fps)', auto: true }; } catch {}
  return { ...(dc.cls === 'mobile' ? TIERS.med : TIERS.high), reason: 'auto: ' + dc.why, auto: true };
}
