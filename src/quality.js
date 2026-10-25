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
export function pickTier() {
  const q = new URLSearchParams(location.search).get('tier');
  if (q && TIERS[q]) return TIERS[q];
  // touch-first devices (phones, tablets) -> low; laptops/desktops with a mouse -> high
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = /iPhone|iPad|iPod|Android|CriOS/i.test(navigator.userAgent) || (coarse && navigator.maxTouchPoints > 0);
  return mobile ? TIERS.low : TIERS.high;
}
