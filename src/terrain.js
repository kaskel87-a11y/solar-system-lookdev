// PBR Mars terrain: heightfield (fbm + ridged mesas + crater + texture displacement), per-vertex splat weights,
// and a MeshStandardMaterial patched with onBeforeCompile for 3-4 layer splatting (regolith / sand / rock / gravel),
// anti-tiling (two scales + macro variation), triplanar rock on cliffs (med/high), world-space normal mapping.
import * as THREE from 'three';

// ---------- 2D simplex noise (Stefan Gustavson, public domain) ----------
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512); const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (x, y) => {
    const s0 = (x + y) * F2, i = Math.floor(x + s0), j = Math.floor(y + s0), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255; let n = 0;
    const c = (gx, gy, xx, yy) => { let tt = 0.5 - xx * xx - yy * yy; if (tt < 0) return 0; tt *= tt; const q = g[gx]; return tt * tt * (q[0] * xx + q[1] * yy); };
    n += c(p[ii + p[jj]] & 7, 0, x0, y0); n += c(p[ii + i1 + p[jj + j1]] & 7, 0, x1, y1); n += c(p[ii + 1 + p[jj + 1]] & 7, 0, x2, y2);
    return 70 * n;
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createHeight(dispImg) {
  const n1 = makeNoise(7), n2 = makeNoise(31), n3 = makeNoise(77);
  // displacement texture (Poly Haven rock_face_03 disp, 512px) sampled bilinearly, tiled every 28 m
  let D = null, DW = 0;
  if (dispImg) { const c = document.createElement('canvas'); c.width = c.height = DW = dispImg.width; const g = c.getContext('2d'); g.drawImage(dispImg, 0, 0); const d = g.getImageData(0, 0, DW, DW).data; D = new Float32Array(DW * DW); for (let i = 0; i < D.length; i++) D[i] = d[i * 4] / 255; }
  const disp = (x, z) => {
    if (!D) return 0; const u = ((x / 28) % 1 + 1) % 1 * DW, v = ((z / 28) % 1 + 1) % 1 * DW;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, a = D[(y0 % DW) * DW + x0 % DW], b = D[(y0 % DW) * DW + (x0 + 1) % DW], c = D[((y0 + 1) % DW) * DW + x0 % DW], d = D[((y0 + 1) % DW) * DW + (x0 + 1) % DW];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  const rockMask = (x, z) => smooth(0.05, 0.45, n2(x / 90 + 3, z / 90 - 7));
  function base(x, z) {
    let h = 0, a = 1, f = 1 / 160;
    for (let o = 0; o < 5; o++) { h += n1(x * f, z * f) * a; a *= 0.5; f *= 2.05; }
    h *= 6;
    const r = 1 - Math.abs(n3(x / 520, z / 520)); // ridged mesas, mostly far away
    const far = smooth(220, 600, Math.hypot(x, z));
    // flat-topped mesas with eroded, terraced flanks (smoothstep plateau) instead of noise spikes
    const mesa = smooth(0.62, 0.74, r + n1(x / 90, z / 90) * 0.06);
    const terr = Math.floor(mesa * 4) / 4 * 0.25 + mesa * 0.75;
    h += terr * 75 * far + far * 14 * (n2(x / 300, z / 300) + 0.6);
    // crater to the north-east
    const cd = Math.hypot(x - 150, z + 110) / 55; h += cd < 1 ? (cd * cd - 1) * 9 + 2 : 2 * Math.exp(-Math.pow((cd - 1) / 0.35, 2));
    // dune ripples in low areas
    h += Math.sin((x * 0.8 + z * 0.35) / 3.1 + n2(x / 40, z / 40) * 3) * 0.18 * smooth(2, -4, h);
    return h;
  }
  function height(x, z) {
    let h = base(x, z);
    h += (disp(x, z) - 0.5) * 1.6 * rockMask(x, z); // real texture displacement on rocky patches
    const r = Math.hypot(x + 2, z + 8); const pad = 0.4;
    const hCol = THREE.MathUtils.lerp(pad + (h - pad) * 0.06, h, smooth(34, 70, r)); // flattened colony ground
    // dead-flat street corridor (road + sidewalks sit exactly on it, nothing pokes through)
    const st = smooth(12, 8.5, Math.abs(x)) * smooth(-74, -63, z) * smooth(22, 15, z);
    return THREE.MathUtils.lerp(hCol, pad, st);
  }
  return { height, rockMask, n1, n2 };
}

function splatAt(H, x, z, h, ny) {
  // returns [sand, rock, gravel]; regolith = remainder
  const steep = smooth(0.93, 0.72, ny);
  const rock = Math.min(1, steep + H.rockMask(x, z) * 0.35 * smooth(0.98, 0.9, ny));
  const sand = (1 - rock) * smooth(1.5, -3.5, h + H.n2(x / 25, z / 25) * 2.5) * 0.95;
  const pad = smooth(46, 26, Math.hypot(x + 2, z + 8));
  const gravel = (1 - rock) * Math.max(pad * 0.85, smooth(0.35, 0.7, H.n1(x / 35 + 9, z / 35)) * 0.6) * (1 - sand * 0.6);
  return [sand, rock, gravel];
}

/** Square near patch (size x size, seg) or far ring (radial grid). Both share the height function. */
export function buildTerrainGeo(H, { size = 320, seg = 200, ring = null } = {}) {
  let pos, idx = [];
  if (!ring) {
    const N = seg + 1, st = size / seg; pos = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j * N + i) * 3, x = -size / 2 + i * st, z = -size / 2 + j * st; pos[k] = x; pos[k + 1] = H.height(x, z); pos[k + 2] = z; }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
  } else {
    const [r0, r1, nr, na] = ring; pos = new Float32Array((nr + 1) * na * 3);
    for (let j = 0; j <= nr; j++) { const r = r0 * Math.pow(r1 / r0, j / nr); for (let i = 0; i < na; i++) { const a = i / na * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, k = (j * na + i) * 3; pos[k] = x; pos[k + 1] = H.height(x, z) - (j === 0 ? 0.6 : 0); pos[k + 2] = z; } }
    for (let j = 0; j < nr; j++) for (let i = 0; i < na; i++) { const a = j * na + i, b = j * na + (i + 1) % na, c = a + na, d = b + na; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nor = g.attributes.normal, cnt = nor.count, spl = new Float32Array(cnt * 3);
  for (let v = 0; v < cnt; v++) { const s = splatAt(H, pos[v * 3], pos[v * 3 + 2], pos[v * 3 + 1], nor.getY(v)); spl[v * 3] = s[0]; spl[v * 3 + 1] = s[1]; spl[v * 3 + 2] = s[2]; }
  g.setAttribute('splat', new THREE.BufferAttribute(spl, 3));
  g.computeBoundingSphere();
  return g;
}

/** layers: { regolith, sand, rock, gravel } each { diff, nor, arm } textures (RepeatWrapping). */
export function terrainMaterial(layers, macro, tier) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const U = {
    tRegD: { value: layers.regolith.diff }, tRegN: { value: layers.regolith.nor }, tRegA: { value: layers.regolith.arm },
    tSandD: { value: layers.sand.diff }, tSandN: { value: layers.sand.nor }, tSandA: { value: layers.sand.arm },
    tRockD: { value: layers.rock.diff }, tRockN: { value: layers.rock.nor }, tRockA: { value: layers.rock.arm },
    tGravD: { value: layers.gravel ? layers.gravel.diff : layers.regolith.diff },
    tMacro: { value: macro },
    uTint: { value: new THREE.Color(1.08, 0.72, 0.52) }, // pushes Earth-desert scans toward Mars iron-oxide
  };
  m.userData.uniforms = U;
  m.defines = { TRIPLANAR: tier.triplanar ? 1 : 0, GRAVEL: tier.gravelLayer ? 1 : 0 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 splat; varying vec3 vSplat; varying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSplat; varying vec3 vWP; varying vec3 vWN;
uniform sampler2D tRegD, tRegN, tRegA, tSandD, tSandN, tSandA, tRockD, tRockN, tRockA, tGravD, tMacro; uniform vec3 uTint;
vec3 unpackN(vec4 t) { return t.xyz * 2.0 - 1.0; }
// sample a planar (XZ) layer at two scales, blend by distance to kill tiling
vec4 dual(sampler2D t, vec2 uv, float k) { return mix(texture2D(t, uv), texture2D(t, uv * 0.23 + 0.37), k); }
`)
      .replace('#include <map_fragment>', `
float camD = length(vWP - cameraPosition);
float farK = smoothstep(12.0, 70.0, camD);
vec2 uvR = vWP.xz / 3.2, uvS = vWP.xz / 4.5, uvK = vWP.xz / 6.0, uvG = vWP.xz / 2.6;
vec3 wSpl = clamp(vSplat, 0.0, 1.0);
float wSand = wSpl.x, wRock = wSpl.y, wGrav = GRAVEL == 1 ? wSpl.z : 0.0;
float macroV = texture2D(tMacro, vWP.xz / 140.0).r * 0.6 + texture2D(tMacro, vWP.xz / 37.0).g * 0.4;
// height-ish blend sharpening using macro noise so layer edges break up naturally
wSand = smoothstep(0.0, 1.0, clamp(wSand * 1.4 + (macroV - 0.5) * 0.6, 0.0, 1.0));
wRock = smoothstep(0.0, 1.0, clamp(wRock * 1.3 + (macroV - 0.5) * 0.5, 0.0, 1.0));
float wReg = max(0.0, 1.0 - wSand - wRock - wGrav);
float wsum = wReg + wSand + wRock + wGrav; wReg /= wsum; wSand /= wsum; wRock /= wsum; wGrav /= wsum;
vec3 aReg = dual(tRegD, uvR, farK).rgb, aSand = dual(tSandD, uvS, farK).rgb, aGrav = dual(tGravD, uvG, farK).rgb;
vec4 armReg = dual(tRegA, uvR, farK), armSand = dual(tSandA, uvS, farK);
vec3 nReg = unpackN(dual(tRegN, uvR, farK)), nSand = unpackN(dual(tSandN, uvS, farK));
vec3 aRock, nRockW; vec4 armRock;
#if TRIPLANAR == 1
  vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec2 ux = vWP.zy / 6.0, uy = uvK, uz = vWP.xy / 6.0;
  aRock = texture2D(tRockD, ux).rgb * bw.x + texture2D(tRockD, uy).rgb * bw.y + texture2D(tRockD, uz).rgb * bw.z;
  armRock = texture2D(tRockA, ux) * bw.x + texture2D(tRockA, uy) * bw.y + texture2D(tRockA, uz) * bw.z;
  vec3 tnx = unpackN(texture2D(tRockN, ux)), tny = unpackN(texture2D(tRockN, uy)), tnz = unpackN(texture2D(tRockN, uz));
  // whiteout-style reoriented normals per projection
  vec3 nx = vec3(0.0, tnx.y, tnx.x) * sign(vWN.x); vec3 ny = vec3(tny.x, 0.0, tny.y); vec3 nz = vec3(tnz.x, tnz.y, 0.0);
  nRockW = normalize(vWN + nx * bw.x + ny * bw.y + nz * bw.z);
#else
  aRock = dual(tRockD, uvK, farK).rgb; armRock = dual(tRockA, uvK, farK);
  vec3 tr = unpackN(dual(tRockN, uvK, farK)); nRockW = normalize(vWN + vec3(tr.x, 0.0, -tr.y));
#endif
vec3 alb = aReg * wReg + aSand * wSand + aRock * wRock + aGrav * wGrav;
alb *= uTint * mix(0.78, 1.18, macroV);
vec4 armT = armReg * wReg + armSand * wSand + armRock * wRock + vec4(armReg.r, 0.9, 0.0, 1.0) * wGrav;
diffuseColor.rgb *= alb * mix(1.0, armT.r, 0.7);
`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(armT.g * 1.05, 0.55, 1.0);')
      .replace('#include <normal_fragment_maps>', `
// planar layers: tangent frame = world X / -Z on a heightfield
vec3 nPlan = normalize(vWN + vec3(nReg.x, 0.0, -nReg.y) * wReg * 1.1 + vec3(nSand.x, 0.0, -nSand.y) * wSand * 0.8);
vec3 nW = normalize(mix(nPlan, nRockW, wRock));
normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
`);
  };
  m.customProgramCacheKey = () => 'terrain' + m.defines.TRIPLANAR + m.defines.GRAVEL;
  return m;
}

/** Tileable value-noise RGBA texture for macro variation (generated, no download). */
export function macroTexture(size = 256) {
  const n = makeNoise(5), n2 = makeNoise(9), d = new Uint8Array(size * size * 4);
  const tile = (f, x, y) => { // tileable via 4-corner blend
    const u = x / size, v = y / size, a = f(x / 32, y / 32), b = f((x - size) / 32, y / 32), c = f(x / 32, (y - size) / 32), e = f((x - size) / 32, (y - size) / 32);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4; d[i] = (tile(n, x, y) * 0.5 + 0.5) * 255; d[i + 1] = (tile(n2, x * 2 % size, y * 2 % size) * 0.5 + 0.5) * 255; d[i + 2] = 128; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
