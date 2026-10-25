// Shared material helpers: PBR texture sets, grime/dust weathering patch, procedural buildings, neon signage, glass.
import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
const cache = new Map();
export function loadTex(url, srgb, aniso = 4) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((res, rej) => texLoader.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; res(t); }, undefined, rej));
  cache.set(url, p); return p;
}
/** PBR set from assets/textures/<name>/<name>_{diff,nor,arm}_<res>.jpg (Poly Haven CC0, re-encoded). */
export async function loadSet(name, res, aniso) {
  const b = `assets/textures/${name}/${name}_`;
  const [diff, nor, arm] = await Promise.all([loadTex(`${b}diff_${res}.jpg`, true, aniso), loadTex(`${b}nor_${res}.jpg`, false, aniso), loadTex(`${b}arm_${res}.jpg`, false, aniso)]);
  return { diff, nor, arm };
}
/** MeshStandardMaterial from a set; ARM packs AO (r) / roughness (g) / metal (b). World-scale repeats come from geometry UVs. */
export function pbr(set, o = {}) {
  return new THREE.MeshStandardMaterial({ map: set.diff, normalMap: set.nor, aoMap: set.arm, roughnessMap: set.arm, metalnessMap: set.arm, roughness: o.roughness ?? 1, metalness: o.metalness ?? 1, color: o.color ?? 0xffffff, normalScale: new THREE.Vector2(o.ns ?? 1, o.ns ?? 1), aoMapIntensity: 1 });
}

// ---------- weathering: Mars dust settles on up-facing surfaces + dirt creeps up from the ground ----------
// Works for normal and instanced meshes. This is what kills the clean "toy" look of stock CC0 sci-fi models.
export function weather(mat, opts = {}) {
  if (mat.userData.weathered) return mat; mat.userData.weathered = true;
  const U = { uDust: { value: new THREE.Color(opts.dust ?? 0xa8583a) }, uDustAmt: { value: opts.amount ?? 0.6 }, uDirtH: { value: opts.dirtHeight ?? 1.1 }, uGround: { value: opts.ground ?? 0 } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev && prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPw; varying vec3 vWNw;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      { vec4 wp4 = vec4(transformed, 1.0); vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4; wn = mat3(instanceMatrix) * wn;
        #endif
        #ifdef USE_SKINNING
          wp4 = vec4(transformed, 1.0);
        #endif
        vWPw = (modelMatrix * wp4).xyz; vWNw = normalize(mat3(modelMatrix) * wn); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
      varying vec3 vWPw; varying vec3 vWNw; uniform vec3 uDust; uniform float uDustAmt, uDirtH, uGround;
      float wh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float wn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(wh(i), wh(i+vec3(1,0,0)), f.x), mix(wh(i+vec3(0,1,0)), wh(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(wh(i+vec3(0,0,1)), wh(i+vec3(1,0,1)), f.x), mix(wh(i+vec3(0,1,1)), wh(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float wnz = wn3(vWPw * 1.7) * 0.6 + wn3(vWPw * 7.0) * 0.4;
      float dustUp = smoothstep(0.25, 0.9, vWNw.y) * smoothstep(0.35, 0.75, wnz + 0.15);
      float dirt = (1.0 - smoothstep(0.0, uDirtH, vWPw.y - uGround + (wnz - 0.5) * 0.6));
      float wAmt = clamp(max(dustUp, dirt * 0.85) * uDustAmt + wnz * 0.12 * uDustAmt, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, uDust * (0.75 + wnz * 0.4), wAmt);
      diffuseColor.rgb *= mix(1.0, 0.82 + wnz * 0.25, uDustAmt); // general grime / value breakup
      roughnessFactor = mix(roughnessFactor, 0.95, wAmt);`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - wAmt * 0.8;');
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '|weather';
  return mat;
}

/** Boxes with world-scaled UVs so tiled PBR textures keep real-world texel density on any building size. */
export function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  g.setAttribute('uv1', uv.clone());
  return g;
}

export function glassMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0x1a2228, metalness: 0, roughness: 0.06, transmission: 0, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.9 });
}

// ---------- neon ----------
export function neonTexture(text, color, { font = 'bold 120px "Arial Black", Impact, sans-serif', w = 1024, h = 256, script = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = script ? `italic bold ${Math.round(h * 0.5)}px "Brush Script MT", "Segoe Script", cursive` : font;
  // tube: thin bright core + coloured glow (bloom adds the rest)
  g.shadowColor = color; g.shadowBlur = h * 0.12; g.strokeStyle = color; g.lineWidth = h * 0.045; g.lineJoin = 'round';
  g.strokeText(text, w / 2, h / 2); g.shadowBlur = h * 0.04; g.strokeText(text, w / 2, h / 2);
  g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = h * 0.014; g.strokeText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Emissive sign plane; intensity > 1 pushes it into HDR so UnrealBloom picks it up after ACES. */
export function neonSign(text, color, width, opts = {}) {
  const tex = neonTexture(text, color, opts); const aspect = (opts.w ?? 1024) / (opts.h ?? 256);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(opts.intensity ?? 3.2, opts.intensity ?? 3.2, opts.intensity ?? 3.2), blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), m); mesh.renderOrder = 5; return mesh;
}
/** Fake light pool on the ground (cheap stand-in for a point light on phones). */
let poolTex = null;
export function lightPool(color, radius, intensity = 0.9) {
  if (!poolTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); poolTex = new THREE.CanvasTexture(c); }
  const m = new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 4; return mesh;
}
/** Emissive strip (window band, door frame, LED rail). */
export function emissiveStrip(w, h, color, k = 2.5) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), fog: false }));
}
