// Mars sky: butterscotch dust sky, darker zenith, and the real Mars quirk: a BLUE halo around a low sun
// (fine dust forward-scatters blue). HDR values so the sun disc blooms. Also an env-map tint helper.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export function createSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir }, horizon: { value: new THREE.Color(0xf28f57) }, zenith: { value: new THREE.Color(0x573326) }, halo: { value: new THREE.Color(0x8cb8f2) }, ground: { value: new THREE.Color(0.42, 0.22, 0.13) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position,1.0)).xyz, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 sunDir, horizon, zenith, halo, ground; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.4));
        c = mix(c, ground, smoothstep(0.0, -0.08, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += halo * pow(s, 24.0) * 0.35 + halo * pow(s, 5.0) * 0.03;      // blue forward-scatter halo
        c += vec3(1.0, 0.85, 0.7) * pow(s, 4.0) * 0.12 * (1.0 - clamp(h * 2.0, 0.0, 1.0)); // warm horizon glow
        c *= mix(1.0, 0.6, smoothstep(0.02, 0.5, h)); // darker upper sky: through ACES the old values washed out tall portrait frames
        c += vec3(1.0, 0.97, 0.92) * smoothstep(0.9993, 0.9997, s) * 6.0;   // sun disc (HDR -> bloom)
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat); m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

/** Load an HDRI, tint it toward Mars (Earth desert sky -> rust), prefilter with PMREM for IBL. */
export async function loadEnv(renderer, url, tint = [1.25, 0.78, 0.55]) {
  const loader = new RGBELoader().setDataType(THREE.FloatType);
  const tex = await loader.loadAsync(url);
  const d = tex.image.data; // RGBA float
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = (l * 0.6 + d[i] * 0.4) * tint[0]; d[i + 1] = (l * 0.6 + d[i + 1] * 0.4) * tint[1]; d[i + 2] = (l * 0.6 + d[i + 2] * 0.4) * tint[2]; }
  // re-pack as HalfFloat: float32 textures aren't filterable on many mobile GPUs (and SwiftShader) -> black/NaN IBL
  const h = new Uint16Array(d.length); for (let i = 0; i < d.length; i++) h[i] = THREE.DataUtils.toHalfFloat(Math.min(d[i], 60000));
  const ht = new THREE.DataTexture(h, tex.image.width, tex.image.height, THREE.RGBAFormat, THREE.HalfFloatType);
  ht.mapping = THREE.EquirectangularReflectionMapping; ht.colorSpace = THREE.LinearSRGBColorSpace; ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.generateMipmaps = false; ht.flipY = true; ht.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(ht).texture; tex.dispose(); ht.dispose(); pm.dispose();
  return env;
}
