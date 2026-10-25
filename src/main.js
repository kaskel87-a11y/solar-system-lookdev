// Solar System Explorer — v8 look-dev: Mars colony slice.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pickTier } from './quality.js';
import { createHeight, buildTerrainGeo, terrainMaterial, macroTexture } from './terrain.js';
import { createPost } from './post.js';
import { createSky, loadEnv } from './sky.js';
import { loadSet, pbr, weather, boxGeo, glassMat, neonSign, lightPool, emissiveStrip } from './materials.js';

const Q = new URLSearchParams(location.search);
const tier = pickTier();
const SHOT = Q.has('shot'), BENCH = Q.has('bench');
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (SHOT) document.body.classList.add('shot');
const status = (s) => { const el = document.getElementById('loading'); if (el) el.textContent = s; };

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !Q.has('noshadow'); renderer.shadowMap.type = tier.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);
const aniso = Math.min(tier.name === 'low' ? 4 : 8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 66 : 50, innerWidth / innerHeight, 0.15, 4000);

// golden-hour sun, low and to the left of the street so façades get raking light and long shadows
const sunDir = new THREE.Vector3(-0.32, 0.24, -0.92).normalize() // down the strip, ~14° up: backlit street, long shadows toward camera;
const sky = createSky(sunDir); scene.add(sky);
const sun = new THREE.DirectionalLight(0xffd2a1, 3.2) // ART.md Mars;
sun.castShadow = true; sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
const sc = sun.shadow.camera; sc.left = sc.bottom = -tier.shadowRange; sc.right = sc.top = tier.shadowRange; sc.near = 1; sc.far = 260;
sun.shadow.bias = Number(Q.get("sb") ?? -0.0005); sun.shadow.normalBias = Number(Q.get("snb") ?? 0.08); sun.shadow.radius = tier.shadowSoft ? 3 : 1;
scene.add(sun, sun.target);
const bounce = new THREE.HemisphereLight(0xe0a57e, 0x6b3821, 0.45); scene.add(bounce); // ART.md Mars sky/ground fill (0.3 proposed; 0.45 lifts shadowed foreground)

const H0 = { height: () => 0 };
let H = H0;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// boulders are instanced ~110x on high: use the mid LOD (5-8k tris) there, not the 15-23k desktop scans
const gl = (n) => loader.loadAsync(`assets/models/${tier.name === 'high' && n.includes('boulder') ? 'mid' : tier.modelDir}/${n}.glb`);
const ground = (x, z) => H.height(x, z);

// ---------- helpers ----------
const LOW = tier.name === 'low';
function prep(obj, { cast = true, receive = true, grime = 0.55, dirt = 1.0, small = false } = {}) {
  // low tier: small props don't cast (shadow pass would double their draw calls); big shapes still do
  if (LOW && small) cast = false;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = cast; o.receiveShadow = receive;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach((m) => { if (m.isMeshStandardMaterial && grime > 0) { m.envMapIntensity = 0.9; weather(m, { amount: grime, dirtHeight: dirt, ground: obj.position.y }); } });
  });
  return obj;
}
const blockers = []; // world XZ boxes the player can't walk through
function block(obj, pad = 0.2) { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); blockers.push({ x0: b.min.x - pad, x1: b.max.x + pad, z0: b.min.z - pad, z1: b.max.z + pad }); }
function place(obj, x, z, ry = 0, s = 1, dy = 0) { obj.position.set(x, ground(x, z) + dy, z); obj.rotation.y = ry; obj.scale.setScalar(s); scene.add(obj); return obj; }

async function main() {
  status('Loading terrain…');
  const dispImg = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'assets/textures/mars_rock/mars_rock_disp_512.jpg'; });
  H = createHeight(dispImg);
  const res = tier.texRes;
  const [regolith, sand, rock, gravel, concrete, corrugated, rust, metalP, shutter, grate] = await Promise.all(
    ['mars_regolith', 'mars_sand', 'mars_rock', 'mars_gravel', 'concrete', 'corrugated', 'rust', 'metal_panels', 'shutter', 'metal_grate'].map((n) => loadSet(n, res, aniso)));
  const macro = macroTexture(256);
  const tmat = terrainMaterial({ regolith, sand, rock, gravel }, macro, tier);
  const near = new THREE.Mesh(buildTerrainGeo(H, { size: 300, seg: tier.terrainSeg }), tmat); near.receiveShadow = true; scene.add(near);
  // far ring: starts under the near patch edge, log-spaced out to 2.2 km (mesas + crater rim on the horizon)
  const far = new THREE.Mesh(buildTerrainGeo(H, { ring: [140, 2200, Math.round(tier.farSeg / 2), tier.farSeg * 2] }), tmat); far.receiveShadow = true; scene.add(far);

  status('Lighting…');
  if (!Q.has('noenv')) scene.environment = await loadEnv(renderer, `assets/hdri/goegap_road_${tier.envRes}.hdr`);
  scene.environmentIntensity = 0.6; // ART.md says 0.8; 0.6 keeps shade deeper (more contrast)

  status('Building colony…');
  // ---- materials ----
  const mConcrete = weather(pbr(concrete, { metalness: 0 }), { amount: 0.5, dirtHeight: 1.6 });
  // street paving: same concrete, light dust only (wall dirt-height of 1.6 m made the whole road read as red carpet)
  const mRoad = weather(pbr(concrete, { metalness: 0, color: 0xb9aaa0 }), { amount: 0.28, dirtHeight: 0.0 });
  const mCorr = weather(pbr(corrugated, { ns: 0.7 }), { amount: 0.55, dirtHeight: 1.4 }); mCorr.map.anisotropy = mCorr.normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mRust = weather(pbr(rust), { amount: 0.35 });
  const mMetal = weather(pbr(metalP, { color: 0x9a9a9a }), { amount: 0.45 });
  const mShutter = weather(pbr(shutter), { amount: 0.4 });
  const mGrate = pbr(grate);
  const mGlass = glassMat();
  const mDark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.4 });

  const lights = []; const pools = []; const flickers = [];
  function neonAt(group, text, color, w, pos, rotY = 0, opts) { const s = neonSign(text, color, w, opts); s.position.copy(pos); s.rotation.y = rotY; group.add(s); return s; }
  function addLight(color, pos, intensity, dist) {
    if (lights.length < tier.pointLights) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.copy(pos); scene.add(l); lights.push(l); }
  }
  function pool(color, x, z, r, k) { const p = lightPool(color, r, k); p.position.set(x, ground(x, z) + 0.03, z); scene.add(p); pools.push(p); }

  // building factory: concrete or corrugated shell, parapet, roof clutter, door, window bands
  // collapse a building's static lit parts into one mesh per material (≈25 draws -> ≈7 per building, per pass)
  function mergeStatic(g) {
    g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); const buckets = new Map();
    g.children.slice().forEach((o) => { if (!o.isMesh || o.material.isMeshBasicMaterial || o.material.transparent || flickers.includes(o)) return;
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      ['uv1', 'uv2'].forEach((a) => { if (!geo.attributes[a] && geo.attributes.uv) geo.setAttribute(a, geo.attributes.uv.clone()); });
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const k = o.material.uuid + Object.keys(geo.attributes).sort().join(); (buckets.get(k) || buckets.set(k, { m: o.material, l: [] }).get(k)).l.push(geo); g.remove(o); });
    buckets.forEach(({ m, l }) => { const mg = mergeGeometries(l, false); if (!mg) return; const me = new THREE.Mesh(mg, m); me.castShadow = me.receiveShadow = true; g.add(me); });
  }
  function building({ x, z, w, h, d, ry = 0, mat, sign, signColor, signScript = false, door = 'shutter', windows = true, accent, flicker = false, spill = true }) {
    const g = new THREE.Group(); const y0 = ground(x, z);
    g.position.set(x, y0 - 0.15, z); g.rotation.y = ry;
    const shell = new THREE.Mesh(boxGeo(w, h, d, 2.5), mat); shell.position.y = h / 2; g.add(shell);
    const plinth = new THREE.Mesh(boxGeo(w + 0.3, 0.6, d + 0.3, 2), mConcrete); plinth.position.y = 0.3; g.add(plinth);
    const par = new THREE.Mesh(boxGeo(w + 0.2, 0.5, d + 0.2, 2), mConcrete); par.position.y = h + 0.25; g.add(par);
    const roofIn = new THREE.Mesh(boxGeo(w - 0.4, 0.3, d - 0.4, 3), mGrate); roofIn.position.y = h + 0.4; g.add(roofIn);
    // front = +z face of the group
    const fz = d / 2 + 0.02;
    if (door === 'shutter') { const s = new THREE.Mesh(boxGeo(3.2, 2.8, 0.12, 3.2), mShutter); s.position.set(-w * 0.22, 1.55, fz); g.add(s); }
    const dg = new THREE.Mesh(boxGeo(1.6, 2.4, 0.1, 1), mGlass); dg.position.set(w * 0.18, 1.35, fz); g.add(dg);
    const frame = emissiveStrip(1.8, 0.06, accent ?? signColor, 3); frame.position.set(w * 0.18, 2.62, fz + 0.03); g.add(frame);
    if (windows) for (let i = 0; i < 2; i++) { const win = new THREE.Mesh(boxGeo(w * 0.32, 0.9, 0.08, 1), mGlass); win.position.set(i ? w * 0.28 : -w * 0.28, h * 0.72, fz); g.add(win);
      const glow = emissiveStrip(w * 0.3, 0.8, i ? 0xffb070 : 0x9fd8ff, 0.35); glow.position.set(win.position.x, win.position.y, fz - 0.02); g.add(glow); }
    // awning / canopy (rusted sheet on metal struts)
    const aw = new THREE.Mesh(boxGeo(w * 0.7, 0.08, 1.8, 2), mRust); aw.position.set(0, 3.25, fz + 0.9); aw.rotation.x = 0.08; g.add(aw);
    if (sign) { const sp = new THREE.Vector3(0, h * 0.45 + 2.1, fz + 0.08); const sw = Math.min(w * 0.8, 9); const s = neonAt(g, sign, signColor, sw, sp, 0, { script: signScript, intensity: 4.2 });
      // sign backer: dark steel box with a lit edge, so the tubes read as a physical sign, not floating text
      const box = new THREE.Mesh(boxGeo(sw * 0.98, sw / 4 * 0.9, 0.25, 1.5), mMetal); box.position.set(sp.x, sp.y, fz + 0.1 - 0.17); g.add(box); if (flicker) flickers.push(s); }
    // roof clutter: water tank, vent boxes; vertical pipe runs; side AC boxes — silhouettes break the box read
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16), mRust); tank.position.set(-w * 0.25, h + 1.6, -d * 0.15); g.add(tank);
    for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(boxGeo(1.2, 0.8 + (i % 2) * 0.5, 1.0, 1.5), mMetal); v.position.set(w * (0.1 + i * 0.13), h + 0.9, d * (0.2 - i * 0.18)); g.add(v); }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.5, 6), mDark); ant.position.set(w * 0.4, h + 2.1, -d * 0.35); g.add(ant);
    [[-w / 2 + 0.25, 0.2], [w / 2 - 0.25, -0.2]].forEach(([px]) => { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, h, 8), mRust); pipe.position.set(px, h / 2, fz + 0.12); g.add(pipe); });
    for (let i = 0; i < 2; i++) { const ac = new THREE.Mesh(boxGeo(1.1, 0.8, 0.6, 1.2), mMetal); ac.position.set(-w * 0.42 + i * w * 0.84, h * (0.55 + i * 0.12), fz + 0.3); g.add(ac); }
    g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    mergeStatic(g);
    scene.add(g); g.updateMatrixWorld(true);
    { const c = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)), hx = c * w / 2 + sn * d / 2 + 0.4, hz = sn * w / 2 + c * d / 2 + 0.4; blockers.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz }); }
    // neon spill: real light (high/med) or ground pool (all tiers)
    const front = new THREE.Vector3(0, 0, fz + 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position);
    if (signColor && spill) { pool(signColor, front.x, front.z, 5, 0.4); addLight(signColor, new THREE.Vector3(front.x, y0 + 4.2, front.z), 30, 16); }
    return g;
  }

  // The "strip": two rows of buildings facing each other along -Z, the camera walks down it toward the sun.
  building({ x: -12, z: -22, w: 13, h: 7, d: 10, ry: Math.PI / 2, mat: mConcrete, sign: 'Velvet Airlock', signColor: '#ff2a8a', signScript: true, accent: '#8a3cff' });
  building({ x: 11, z: -24, w: 12, h: 5.2, d: 9, ry: -Math.PI / 2, mat: mCorr, sign: 'CANTINA', signColor: '#ff2a5a', accent: '#ffb060' });
  building({ x: -13, z: -40, w: 10, h: 9, d: 9, ry: Math.PI / 2, mat: mMetal, sign: "OZZIE'S IRON", signColor: '#ffb020', flicker: true });
  building({ x: 12, z: -42, w: 11, h: 6.5, d: 9, ry: -Math.PI / 2, mat: mConcrete, sign: 'FIRST JUNCTION TRUST', signColor: '#ffd040', door: 'glass' });
  building({ x: -11, z: -5, w: 9, h: 4.6, d: 8, ry: Math.PI / 2, mat: mCorr, sign: 'SUPPLY 24H', signColor: '#3cff8a', windows: false, spill: false });
  // fictional-brand billboard (ART.md §5) + Saltblood graffiti decals
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
  {
    const tex = canvasTex(1024, 384, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b0f0a'); gr.addColorStop(1, '#3a120c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff7a2a'; g.font = 'bold 120px Impact, "Arial Black", sans-serif'; g.textAlign = 'left'; g.fillText('DUST DEVIL', 40, 170);
      g.fillStyle = '#f2e6d8'; g.font = 'italic 46px Arial, sans-serif'; g.fillText('Now with 40% less regolith.', 44, 250);
      g.fillStyle = '#ffb020'; g.font = 'bold 34px Arial'; g.fillText('ENERGY • ARES JUNCTION', 44, 320);
      g.fillStyle = 'rgba(160,80,50,0.45)'; for (let i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1 + Math.random() * 3); // dust speckle
      const v = g.createLinearGradient(0, h * 0.6, 0, h); v.addColorStop(0, 'rgba(120,60,35,0)'); v.addColorStop(1, 'rgba(120,60,35,0.55)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    const bb = new THREE.Group(); const bx = 16, bz = -60; bb.position.set(bx, ground(bx, bz), bz); bb.rotation.y = -0.5;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.9, 0.9, 0.9), roughness: 0.7 })); board.position.y = 8; bb.add(board);
    const back = new THREE.Mesh(boxGeo(9.3, 3.7, 0.3, 2), mRust); back.position.set(0, 8, -0.17); bb.add(back);
    [-3, 3].forEach((px) => { const pole = new THREE.Mesh(boxGeo(0.35, 6.3, 0.35, 1), mMetal); pole.position.set(px, 3.15, -0.3); bb.add(pole); });
    bb.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(bb);
  }
  {
    const tag = canvasTex(512, 192, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#b01020'; g.font = 'italic bold 92px "Brush Script MT", "Segoe Script", cursive'; g.textAlign = 'center'; g.rotate(-0.05); g.fillText('SALTBLOOD', w / 2, h * 0.62);
      for (let i = 0; i < 14; i++) { const x = 60 + Math.random() * (w - 120); g.fillRect(x, h * 0.62, 3, 10 + Math.random() * 40); } });
    const mTag = new THREE.MeshStandardMaterial({ map: tag, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    const t1 = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), mTag); t1.position.set(-6.8, ground(-6.8, -26.5) + 1.5, -26.5); t1.rotation.y = Math.PI / 2; scene.add(t1);
    const t2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), mTag); t2.position.set(-8.3, ground(-8.3, -44) + 1.4, -44); t2.rotation.y = Math.PI / 2; scene.add(t2);
  }
  // sagging power/data cables strung across the strip (cheap, huge "lived-in" payoff)
  {
    const mCable = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const spans = [[-7, -17, 6.2, -19, 6.4], [-7, -25, 7.5, -27, 5.2], [-8.4, -36, 6.4, -40, 6.0], [-8.4, -44, 6.4, -46, 5.6], [-7, -20, 6.5, -30, 4.8]];
    spans.forEach(([x1, z1, x2, z2, y]) => { const a = new THREE.Vector3(x1, ground(x1, z1) + y, z1), b = new THREE.Vector3(x2, ground(x2, z2) + y - 0.4, z2); const m = a.clone().lerp(b, 0.5); m.y -= 1.1;
      const c = new THREE.QuadraticBezierCurve3(a, m, b); const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.025, 4), mCable); tube.castShadow = !LOW; scene.add(tube); });
  }
  // road surface: worn concrete slab down the middle
  { const road = new THREE.Mesh(boxGeo(9, 0.12, 80, 4), mRoad); road.position.set(0, ground(0, -20) - 0.02, -20); road.receiveShadow = true; scene.add(road); }
  // sidewalks + curbs both sides: covers the dark bare-regolith strip that read as a black hole in the portrait foreground
  [-1, 1].forEach((sd) => { const sw = new THREE.Mesh(boxGeo(2.8, 0.22, 80, 1.5), mRoad); sw.position.set(sd * 5.9, ground(sd * 5.9, -20) + 0.02, -20); sw.receiveShadow = true; scene.add(sw);
    const curb = new THREE.Mesh(boxGeo(0.18, 0.3, 80, 1), mMetal); curb.position.set(sd * 4.55, ground(sd * 4.55, -20) + 0.02, -20); curb.receiveShadow = true; scene.add(curb); });

  status('Loading models…');
  const names = ['mars-rover', 'off-road-4x4', 'container-home', 'habitat-dome', 'antenna-array', 'solar-panel-array', 'shipping-container-proz', 'jersey-barrier', 'ph_street_lamp_01', 'ph_barrel_03', 'ph_old_military_crate', 'ph_utility_box_01', 'ph_exterior_aircon_unit', 'ph_propane_tank', 'ph_old_tyre', 'sci-fi-crate', 'ph_namaqualand_boulder_02', 'ph_namaqualand_boulder_04', 'ph_namaqualand_boulder_05', 'char_player_survivor', 'char_npc_soldier', 'char_npc_hacker', 'char_npc_worker', 'power-generator', 'ph_concrete_road_barrier'];
  const M = {}; await Promise.all(names.map(async (n) => { try { M[n] = await gl(n); } catch (e) { console.warn('model fail', n, e); } }));
  const inst = (n) => SkeletonUtils.clone(M[n].scene);

  // vehicles (heavy grime: they live outside)
  block(place(prep(inst('mars-rover'), { grime: 0.75, dirt: 1.3 }), 4.8, -14, -0.35));
  block(place(prep(inst('off-road-4x4'), { grime: 0.65, dirt: 1.1 }), -4.2, -30, 2.9));
  // colony structures
  block(place(prep(inst('container-home'), { grime: 0.6 }), 24, -8, -Math.PI / 2));
  block(place(prep(inst('habitat-dome'), { grime: 0.55 }), -27, -14, 0.6));
  place(prep(inst('antenna-array'), { grime: 0.5, small: true }), -22, -52, 0.3, 1.6);
  for (let i = 0; i < (LOW ? 2 : 4); i++) place(prep(inst('solar-panel-array'), { grime: 0.7, small: true }), 26 + (i % 2) * 4.6, -32 - Math.floor(i / 2) * 2.6, 0);
  block(place(prep(inst('shipping-container-proz'), { grime: 0.7 }), 7.2, -55, 0.15));
  { const c2 = place(prep(inst('shipping-container-proz'), { grime: 0.7 }), 7.4, -55.2, 0.05, 1, 2.6); c2.position.y = ground(7.2, -55) + 2.59; }
  place(prep(inst('power-generator'), { grime: 0.6, small: true }), -6.4, -46, Math.PI / 2);
  // street furniture
  const lampPos = [[-4.8, -12], [4.8, -26], [-4.8, -36], [4.8, -48]];
  lampPos.forEach(([x, z], i) => { const l = place(prep(inst('ph_street_lamp_01'), { grime: 0.3, small: true }), x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, 1.25);
    pool('#ffc68a', x * 0.8, z, 4, 0.35); const bulb = emissiveStrip(0.35, 0.12, 0xffd6a0, 6); bulb.rotation.x = Math.PI / 2; bulb.position.set(x * 0.85, l.position.y + 4.6, z); scene.add(bulb); });
  [[3.6, -8, 0.1], [-3.4, -18, -0.2], [3.4, -34, 0.05]].forEach(([x, z, r]) => place(prep(inst('jersey-barrier'), { grime: 0.6, small: true }), x, z, Math.PI / 2 + r));
  [[-6.2, -16], [-6.6, -16.8], [6.4, -21], [-6.5, -27]].forEach(([x, z], i) => place(prep(inst('ph_barrel_03'), { grime: 0.3, small: true }), x, z, i));
  place(prep(inst('ph_old_military_crate'), { grime: 0.4, small: true }), 6.2, -29, 0.4); place(prep(inst('sci-fi-crate'), { grime: 0.7, small: true }), 6.6, -30.4, 1.2);
  place(prep(inst('ph_utility_box_01'), { grime: 0.3, small: true }), -6.0, -20.5, Math.PI / 2); place(prep(inst('ph_exterior_aircon_unit'), { grime: 0.3, small: true }), 5.55, -19.6, -Math.PI / 2, 1, 2.4);
  place(prep(inst('ph_propane_tank'), { grime: 0.3, small: true }), -6.1, -24.2, 0); place(prep(inst('ph_old_tyre'), { grime: 0.2, small: true }), 5.6, -16.4, 0.3, 1, 0.3).rotation.z = 0.2;
  [[2.2, -40], [-2.6, -44]].forEach(([x, z]) => place(prep(inst('ph_concrete_road_barrier'), { grime: 0.3, small: true }), x, z, 0.2));

  // boulders: instanced, scattered outside the pad, sunk into the ground
  const boulderNames = ['ph_namaqualand_boulder_02', 'ph_namaqualand_boulder_04', 'ph_namaqualand_boulder_05'];
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  boulderNames.forEach((bn, bi) => {
    let mesh = null; M[bn].scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return;
    const n = Math.round(tier.rocks / 3), im = new THREE.InstancedMesh(mesh.geometry, weather(mesh.material.clone(), { amount: 0.55, dust: 0x9c4a2c }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      let x, z; do { const a = rnd() * Math.PI * 2, r = 30 + Math.pow(rnd(), 0.7) * 120; x = Math.cos(a) * r - 2; z = Math.sin(a) * r - 8; } while (Math.abs(x) < 16 && z < 5 && z > -70);
      const sc = (0.6 + rnd() * rnd() * 3.2) * (bi === 1 ? 0.8 : 1.2);
      e.set(rnd() * 0.3, rnd() * 6.28, rnd() * 0.3); q.setFromEuler(e); p.set(x, ground(x, z) - 0.15 * sc, z); s.set(sc, sc * (0.7 + rnd() * 0.5), sc);
      im.setMatrixAt(i, m4.compose(p, q, s));
    }
    im.castShadow = !LOW; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  });

  // ---------- characters ----------
  const chars = [];
  function character(n, x, z, ry, clip, speed = 0) {
    const o = inst(n); const castC = !LOW || n === 'char_player_survivor'; o.traverse((c) => { if (c.isMesh) { c.castShadow = castC; c.receiveShadow = true; c.frustumCulled = false; if (c.material.isMeshStandardMaterial) { c.material.envMapIntensity = 0.8; weather(c.material, { amount: 0.25, dirtHeight: 0.35 }); } } });
    // exported rigs are 2.0 m tall centred on origin -> 1.8 m, feet on the ground
    const root = new THREE.Group(); o.scale.setScalar(0.9); o.position.y = 0.9; root.add(o);
    root.position.set(x, ground(x, z), z); root.rotation.y = ry; scene.add(root);
    const mixer = new THREE.AnimationMixer(o); const clipObj = M[n].animations.find((a) => a.name === clip) || M[n].animations[0];
    const act = mixer.clipAction(clipObj); act.play(); act.time = Math.random() * clipObj.duration;
    const acts = {}; M[n].animations.forEach((a) => { acts[a.name] = a; });
    const c = { root, mixer, speed, act, acts }; chars.push(c); return c;
  }
  const player = character('char_player_survivor', 0.6, -2, Math.PI, 'Walk', 1.45); window.__player = player.root;
  character('char_npc_soldier', -5.4, -19.4, Math.PI / 2 + 0.3, 'Idle');
  character('char_npc_hacker', 5.6, -27.6, -Math.PI / 2 - 0.4, 'Idle');
  if (!LOW) { character('char_npc_worker', 3.3, -15.4, -2.2, 'Idle'); character('char_npc_hacker', -6.6, -38.4, 1.2, 'Pistol aim'); } // ≤3 skinned on phones

  // ---------- dust ----------
  let dust;
  { const n = tier.dust, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,220,190,1)'); gr.addColorStop(1, 'rgba(255,220,190,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(c), color: 0xd89a70, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }));
    dust.frustumCulled = false; scene.add(dust); }

  // ---------- post ----------
  const post = createPost(renderer, scene, camera, tier);
  const A = post.atmo.uniforms; A.sunDir.value.copy(sunDir); A.fogColor.value.setRGB(0.78, 0.46, 0.3); A.sunColor.value.setRGB(1.05, 0.74, 0.5);
  A.fogColor.value.set(0xc98a62); // ART.md Mars fog
  A.density.value = 0.0018; A.heightFall.value = 0.045; A.groundY.value = -2; A.haze.value = 0.0016; // ≈ ART.md 0.0016/0.045 // denser than ART.md 0.0016 so the 300 m slice reads deep
  // ART.md: bloom day 0.45/0.5/1.2; dusk strip needs neon to pop, so use a middle value
  post.bloom.strength = 0.45; post.bloom.radius = 0.35; post.bloom.threshold = 1.6; // threshold above sky (≤1.2) so only sun disc + neon bloom
  const G = post.grade.uniforms; G.sat.value = 1.10; G.contrast.value = 1.08; G.gain.value.set(1.04, 1.0, 0.94); G.lift.value.set(0.012, 0.016, 0.022); G.vignette.value = tier.vignette ? 0.3 : 0; G.grain.value = tier.grain ? 0.035 : 0;
  if (Q.has('nobloom')) post.bloom.enabled = false; if (Q.has('noatmo')) post.atmo.enabled = false; if (Q.has('nograde')) post.grade.enabled = false;
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 66 : 50; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight); });

  // ---------- HUD ----------
  const hud = document.getElementById('hud');
  if (hud) hud.innerHTML = `<div id="fps">… fps</div><div class="tiers">${['low', 'med', 'high'].map((n) => `<button class="${n === tier.name ? 'on' : ''}" data-t="${n}">${n}</button>`).join('')}</div>`;
  hud?.querySelectorAll('button[data-t]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const u = new URL(location.href); u.searchParams.set('tier', b.dataset.t); location.href = u.toString(); }));
  const hint = document.getElementById('hint'); if (hint) { hint.textContent = TOUCH ? 'Left thumb: walk · right thumb: look · double-tap right: run' : 'WASD walk · Shift run · drag mouse to look'; setTimeout(() => hint.classList.add('fade'), 6000); }
  const fpsEl = document.getElementById('fps');

  // ---------- controls: touch stick (left half) + drag look (right half); WASD + mouse drag on desktop ----------
  const AUTO = SHOT || BENCH || Q.has('auto');
  const ctl = { mx: 0, mz: 0, yaw: Math.PI, pitch: 0.0, run: false, keys: {} };
  const stickEl = document.getElementById('stick'), knobEl = document.getElementById('knob');
  const touches = new Map(); let lastRightTap = 0;
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => {
    const left = e.pointerType === 'touch' && e.clientX < innerWidth * 0.5;
    touches.set(e.pointerId, { left, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
    if (left && stickEl) { stickEl.style.display = 'block'; stickEl.style.left = e.clientX - 55 + 'px'; stickEl.style.top = e.clientY - 55 + 'px'; knobEl.style.transform = 'translate(0px,0px)'; }
    if (!left && e.pointerType === 'touch') { const now = performance.now(); if (now - lastRightTap < 300) ctl.run = !ctl.run; lastRightTap = now; }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => { const t = touches.get(e.pointerId); if (!t) return;
    if (t.left) { let dx = e.clientX - t.x0, dy = e.clientY - t.y0; const l = Math.hypot(dx, dy), m = 45; if (l > m) { dx *= m / l; dy *= m / l; }
      ctl.mx = dx / m; ctl.mz = dy / m; if (knobEl) knobEl.style.transform = `translate(${dx}px,${dy}px)`; if (Math.hypot(ctl.mx, ctl.mz) < 0.15) ctl.mx = ctl.mz = 0; }
    else { const k = e.pointerType === 'touch' ? 0.006 : 0.004; ctl.yaw -= (e.clientX - t.x) * k; ctl.pitch = Math.max(-0.35, Math.min(0.5, ctl.pitch + (e.clientY - t.y) * k)); }
    t.x = e.clientX; t.y = e.clientY; });
  const up = (e) => { const t = touches.get(e.pointerId); if (t?.left) { ctl.mx = ctl.mz = 0; if (stickEl) stickEl.style.display = 'none'; } touches.delete(e.pointerId); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  addEventListener('keydown', (e) => { ctl.keys[e.code] = true; }); addEventListener('keyup', (e) => { ctl.keys[e.code] = false; });
  addEventListener('blur', () => { ctl.keys = {}; });
  let pX = 0.6, pZ = -2, pYaw = Math.PI, moveBlend = 0, curClip = 'Walk';
  function setClip(name) { if (name === curClip) return; const a = player.mixer.clipAction(player.acts[name]); a.reset().play(); player.act.crossFadeTo(a, 0.25, false); player.act = a; curClip = name; }
  function collide(x, z) { const r = 0.35; for (const b of blockers) { if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
      const dl = x - (b.x0 - r), dr = b.x1 + r - x, dn = z - (b.z0 - r), df = b.z1 + r - z, m = Math.min(dl, dr, dn, df);
      if (m === dl) x = b.x0 - r; else if (m === dr) x = b.x1 + r; else if (m === dn) z = b.z0 - r; else z = b.z1 + r; } }
    const rr = Math.hypot(x, z + 20); if (rr > 140) { x *= 140 / rr; z = -20 + (z + 20) * 140 / rr; } return [x, z]; }
  if (!AUTO) setClip('Idle');

  // ---------- loop ----------
  const clock = new THREE.Clock(); let t = Number(Q.get('t') ?? 0), frames = 0, acc = 0, fpsShown = 0;
  const camOff = new THREE.Vector3(); const look = new THREE.Vector3();
  const pathLen = 52; // player walks z = -2 .. -54 down the strip, then loops
  const camPos = new THREE.Vector3();
  function frame() {
    const dt = SHOT ? 1 / 30 : Math.min(clock.getDelta(), 0.1); t += dt;
    let px, pz; const portrait = innerWidth < innerHeight;
    if (AUTO) {
      pz = -2 - ((SHOT ? Number(Q.get('pz') ?? 6) : t * player.speed) % pathLen); px = 0.6 + Math.sin(pz * 0.15) * 0.4;
      player.root.position.set(px, ground(px, pz), pz);
      // third-person camera: over the right shoulder, slight low angle like GTA
      if (portrait) { camPos.set(px + 0.75, ground(px, pz) + 1.7, pz + 3.3); look.set(px - 0.2, ground(px, pz) + 1.2, pz - 12); } // portrait: aim lower -> more street, less bright sky
      else { camPos.set(px + 1.15, ground(px, pz) + 2.05, pz + 4.6); look.set(px - 0.35, ground(px, pz) + 1.35, pz - 10); }
    } else {
      const K = ctl.keys; let ix = ctl.mx, iz = ctl.mz;
      if (K.KeyW || K.ArrowUp) iz -= 1; if (K.KeyS || K.ArrowDown) iz += 1; if (K.KeyA || K.ArrowLeft) ix -= 1; if (K.KeyD || K.ArrowRight) ix += 1;
      const il = Math.min(1, Math.hypot(ix, iz)); const run = (K.ShiftLeft || K.ShiftRight || ctl.run) && il > 0.5;
      const fx = Math.sin(ctl.yaw), fz = Math.cos(ctl.yaw); // camera forward (yaw=PI looks down -z)
      if (il > 0.05) { const n = Math.hypot(ix, iz); const wx = (-iz * fx - ix * fz) / n, wz = (-iz * fz + ix * fx) / n;
        const sp = (run ? 4.2 : 1.6) * il; [pX, pZ] = collide(pX + wx * sp * dt, pZ + wz * sp * dt);
        const target = Math.atan2(wx, wz); let dYaw = target - pYaw; dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw)); pYaw += dYaw * Math.min(1, dt * 10); }
      setClip(il < 0.05 ? 'Idle' : run ? 'Run' : 'Walk');
      player.act.timeScale = il < 0.05 ? 1 : Math.max(0.6, il * (run ? 1 : 1.1));
      px = pX; pz = pZ; const gy = ground(px, pz);
      player.root.position.set(px, gy, pz); player.root.rotation.y = pYaw;
      // orbit camera behind/over the right shoulder; pull in if a wall is in the way
      const dist = portrait ? 3.4 : 4.6, h = (portrait ? 1.75 : 2.0) + ctl.pitch * 2.2, side = portrait ? 0.6 : 0.9;
      let cx = px - fx * dist - fz * side, cz = pz - fz * dist + fx * side;
      for (const b of blockers) if (cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1) { cx = px - fx * 1.4 - fz * 0.35; cz = pz - fz * 1.4 + fx * 0.35; break; }
      camPos.set(cx, Math.max(gy + h, ground(cx, cz) + 0.5), cz);
      look.set(px + fx * 10 - fz * side * 0.3, gy + (portrait ? 1.15 : 1.5) - ctl.pitch * 3.0, pz + fz * 10 + fx * side * 0.3);
    }
    chars.forEach((c) => c.mixer.update(dt));
    camera.position.copy(camPos); camera.lookAt(look);
    // shadow frustum follows the player (snapped to texels to avoid shimmer)
    const texel = (tier.shadowRange * 2) / tier.shadowSize; const fwdX = look.x - camPos.x, fwdZ = look.z - camPos.z, fl = Math.hypot(fwdX, fwdZ) || 1; const cx = Math.round((px + fwdX / fl * 12) / texel) * texel, cz = Math.round((pz + fwdZ / fl * 12) / texel) * texel;
    sun.target.position.set(cx, 0, cz); sun.position.set(cx + sunDir.x * 120, sunDir.y * 120, cz + sunDir.z * 120);
    sky.position.copy(camera.position);
    dust.position.copy(player.root.position).setY(ground(px, pz));
    dust.rotation.y = t * 0.02;
    flickers.forEach((f) => { const on = Math.sin(t * 31.0) + Math.sin(t * 7.3) > -1.2 || SHOT; f.material.color.setScalar(on ? 3.2 : 0.4); });
    renderer.info.reset();
    if (Q.has('nopost')) renderer.render(scene, camera); else { post.update(t); post.composer.render(dt); }
    frames++; acc += dt;
    if (!SHOT && acc > 0.5) { fpsShown = frames / acc; frames = 0; acc = 0; if (fpsEl) { fpsEl.textContent = `${fpsShown.toFixed(0)} fps · ${tier.name}`; fpsEl.style.color = fpsShown >= 30 ? '#4ade80' : fpsShown >= 20 ? '#facc15' : '#f87171'; } }
    window.__frameCount = (window.__frameCount || 0) + 1;
    if (!SHOT) requestAnimationFrame(frame);
  }
  document.getElementById('loading')?.remove();
  if (SHOT) {
    // deterministic stills: render a few frames (shadow/bloom warm-up), then flag ready
    for (let i = 0; i < 4; i++) frame();
    window.__ready = true; window.__scene = scene; window.__frame = frame; window.__sun = sun;
  } else { requestAnimationFrame(frame); window.__ready = true; }

  if (BENCH) {
    const dur = Number(Q.get('dur') ?? 8) * 1000;
    await new Promise((r) => setTimeout(r, 2500));
    const f0 = window.__frameCount, t0 = performance.now();
    await new Promise((r) => setTimeout(r, dur));
    const fps = (window.__frameCount - f0) / ((performance.now() - t0) / 1000);
    window.__bench = { tier: tier.name, fps: +fps.toFixed(1), draws: renderer.info.render.calls, tris: renderer.info.render.triangles, px: renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(), programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  }
}
main().catch((e) => { console.error(e); status('Error: ' + e.message); window.__error = String(e && e.stack || e); });
