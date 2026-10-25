// Post stack: Render (HDR, depth texture) -> Atmosphere (height fog + dust haze + sun in-scatter, HDR) ->
// [GTAO, high tier] -> Bloom (neon) -> Output (ACES filmic + sRGB) -> Grade (curves, split-tone, vignette, grain, CA).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    projInv: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, fogColor: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() },
    density: { value: 0.0016 }, heightFall: { value: 0.045 }, groundY: { value: 0 }, haze: { value: 0.0045 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform mat4 projInv, viewInv; uniform vec3 camPos, sunDir, fogColor, sunColor;
    uniform float density, heightFall, groundY, haze; varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      vec4 vp = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vp /= vp.w;
      vec3 wp = (viewInv * vp).xyz; vec3 ray = wp - camPos; float dist = length(ray); vec3 dir = ray / max(dist, 1e-4);
      if (d >= 0.99999) { dist = 2500.0; }
      // analytic exponential height fog (Quilez): integral of density * exp(-b * (y - groundY)) along the ray
      float b = heightFall, y0 = camPos.y - groundY;
      float k = b * dir.y;
      float fogInt = abs(k) < 1e-5 ? density * exp(-b * y0) * dist : density * exp(-b * y0) * (1.0 - exp(-k * dist)) / k;
      float fog = 1.0 - exp(-max(fogInt, 0.0) - haze * dist * 0.08); // + thin uniform dust haze
      bool isSky = d >= 0.99999;
      // sky pixels: tighter in-scatter lobe + less fog, otherwise the whole sun side of a tall portrait frame washes out
      float sunAmt = pow(max(dot(dir, sunDir), 0.0), isSky ? 28.0 : 10.0);
      vec3 fc = mix(fogColor, sunColor, sunAmt);
      if (isSky) fog *= 0.18; // sky dome already carries its own horizon haze
      gl_FragColor = vec4(mix(col.rgb, fc, clamp(fog, 0.0, 1.0)), col.a);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
    grain: { value: 0.045 }, vignette: { value: 0.32 }, chroma: { value: 0.0 }, sat: { value: 1.06 },
    lift: { value: new THREE.Vector3(0.012, 0.016, 0.022) }, gain: { value: new THREE.Vector3(1.03, 1.0, 0.95) }, contrast: { value: 1.08 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, chroma, sat, contrast; uniform vec2 res; uniform vec3 lift, gain; varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec3 col;
      if (chroma > 0.0) { vec2 off = c * chroma * r2; col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b); }
      else col = texture2D(tDiffuse, vUv).rgb;
      // grade in display space: contrast around mid grey, lift/gain (teal shadows, warm highlights), saturation
      col = (col - 0.5) * contrast + 0.5;
      col = col * gain + lift * (1.0 - col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat);
      col *= 1.0 - vignette * smoothstep(0.08, 0.55, r2 * 1.6);
      float n = hash(vUv * res + fract(time) * 100.0) - 0.5; col += n * grain * (1.0 - l * 0.6);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, tier) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier.msaa });
  rt.depthTexture = new THREE.DepthTexture(size.x, size.y); rt.depthTexture.type = THREE.UnsignedIntType;
  const composer = new EffectComposer(renderer, rt);
  // EffectComposer clones rt for the second buffer; give the clone its own depth texture too
  composer.renderTarget2.depthTexture = new THREE.DepthTexture(size.x, size.y); composer.renderTarget2.depthTexture.type = THREE.UnsignedIntType;
  composer.addPass(new RenderPass(scene, camera));
  const atmo = new ShaderPass(AtmosphereShader);
  const origRender = atmo.render.bind(atmo);
  atmo.render = (r, w, read, dt, mask) => { atmo.uniforms.tDepth.value = read.depthTexture; origRender(r, w, read, dt, mask); };
  composer.addPass(atmo);
  let gtao = null;
  if (tier.ao) {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.55, 1.15);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(Math.max(2, Math.round(w * tier.bloomScale)), Math.max(2, Math.round(h * tier.bloomScale)));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.grain.value = tier.grain ? 0.04 : 0; grade.uniforms.vignette.value = tier.vignette ? 0.34 : 0; grade.uniforms.chroma.value = tier.chroma ? 0.007 : 0;
  composer.addPass(grade);
  function update(t) {
    atmo.uniforms.projInv.value.copy(camera.projectionMatrixInverse); atmo.uniforms.viewInv.value.copy(camera.matrixWorld); atmo.uniforms.camPos.value.copy(camera.position);
    grade.uniforms.time.value = t; grade.uniforms.res.value.set(size.x, size.y);
  }
  function setSize(w, h) { composer.setSize(w, h); renderer.getDrawingBufferSize(size); }
  return { composer, atmo, bloom, gtao, grade, update, setSize };
}
