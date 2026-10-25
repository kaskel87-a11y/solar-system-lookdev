# Asset licenses: Solar System Explorer v8 look-dev

Every third-party asset here is **CC0 (public domain)**. Code is MIT. Nothing is CC-BY, so the game has **no attribution obligations**; the credits below are a courtesy and an audit trail. Download date: 2026-10-25.

## 1. Poly Haven (CC0 1.0): https://polyhaven.com/license

### PBR texture sets → `textures/<name>/` (diff/nor(GL)/arm at 1k and 2k as JPG; disp at 512; ETC1S .ktx2 for diff+arm)

| Game name | Poly Haven asset |
|---|---|
| mars_regolith | [terrain_red_01](https://polyhaven.com/a/terrain_red_01) |
| mars_sand | [red_sand](https://polyhaven.com/a/red_sand) |
| mars_rock | [rock_face_03](https://polyhaven.com/a/rock_face_03) |
| mars_gravel | [rocky_terrain_03](https://polyhaven.com/a/rocky_terrain_03) |
| basalt | [dark_rock](https://polyhaven.com/a/dark_rock) |
| ice | [snow_02](https://polyhaven.com/a/snow_02) |
| metal_panels | [metal_plate](https://polyhaven.com/a/metal_plate) |
| rust | [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02) |
| concrete | [concrete_floor_worn_001](https://polyhaven.com/a/concrete_floor_worn_001) |
| corrugated | [corrugated_iron_02](https://polyhaven.com/a/corrugated_iron_02) |
| shutter | [painted_metal_shutter](https://polyhaven.com/a/painted_metal_shutter) |
| metal_grate | [metal_grate_rusty](https://polyhaven.com/a/metal_grate_rusty) |

Glass has no texture: it's procedural (`MeshPhysicalMaterial` in `ss-lookdev/src/materials.js`). Europa "ice" uses `snow_02` plus a lower roughness in-shader.

### HDRIs → `hdri/` (1k for phone, 2k for desktop; sources at 1k/2k in `src/hdri`)

- [goegap_road](https://polyhaven.com/a/goegap_road)
- [dry_cracked_lake](https://polyhaven.com/a/dry_cracked_lake)
- [kloppenheim_06_puresky](https://polyhaven.com/a/kloppenheim_06_puresky)
- [industrial_sunset_02_puresky](https://polyhaven.com/a/industrial_sunset_02_puresky)

### Models → `models/{phone,desktop}/ph_<name>.glb` (meshopt plus WebP, simplified)

- [namaqualand_boulder_02](https://polyhaven.com/a/namaqualand_boulder_02)
- [namaqualand_boulder_04](https://polyhaven.com/a/namaqualand_boulder_04)
- [namaqualand_boulder_05](https://polyhaven.com/a/namaqualand_boulder_05)
- [moon_rock_03](https://polyhaven.com/a/moon_rock_03)
- [old_military_crate](https://polyhaven.com/a/old_military_crate)
- [barrel_03](https://polyhaven.com/a/barrel_03)
- [metal_jerrycan](https://polyhaven.com/a/metal_jerrycan)
- [propane_tank](https://polyhaven.com/a/propane_tank)
- [street_lamp_01](https://polyhaven.com/a/street_lamp_01)
- [security_light](https://polyhaven.com/a/security_light)
- [utility_box_01](https://polyhaven.com/a/utility_box_01)
- [exterior_aircon_unit](https://polyhaven.com/a/exterior_aircon_unit)
- [concrete_road_barrier](https://polyhaven.com/a/concrete_road_barrier)
- [portable_generator](https://polyhaven.com/a/portable_generator)
- [old_tyre](https://polyhaven.com/a/old_tyre)
- [power_box_01](https://polyhaven.com/a/power_box_01)
- [portable_searchlight](https://polyhaven.com/a/portable_searchlight)
- [modular_industrial_pipes_01](https://polyhaven.com/a/modular_industrial_pipes_01)
- [rollershutter_door](https://polyhaven.com/a/rollershutter_door)
- [industrial_wall_lamp](https://polyhaven.com/a/industrial_wall_lamp)
- [plastic_crate_01](https://polyhaven.com/a/plastic_crate_01)

## 2. Grab3D (CC0 1.0): https://grab3d.com/license

"Every model on Grab3D is dedicated to the public domain under CC0 1.0 Universal… No attribution, no account, no fees." The licence page was checked on 2026-10-25. Their models start as AI drafts and are cleaned up in Blender. Grab3D waives only its own rights, the subjects are generic, and the Grab3D name may not be used to suggest endorsement.

Source GLBs are in `src/grab3d/`; the optimized copies are in `models/{phone,desktop}/<name>.glb`.

- 1990s-pickup-truck: https://grab3d.com/dl/1990s-pickup-truck/1990s-pickup-truck.glb
- airlock: https://grab3d.com/dl/airlock/airlock.glb
- antenna-array: https://grab3d.com/dl/antenna-array/antenna-array.glb
- container-home: https://grab3d.com/dl/container-home/container-home.glb
- dune-buggy: https://grab3d.com/dl/dune-buggy/dune-buggy.glb
- fuel-canister: https://grab3d.com/dl/fuel-canister/fuel-canister.glb
- habitat-dome: https://grab3d.com/dl/habitat-dome/habitat-dome.glb
- hover-car: https://grab3d.com/dl/hover-car/hover-car.glb
- jersey-barrier: https://grab3d.com/dl/jersey-barrier/jersey-barrier.glb
- landing-pad: https://grab3d.com/dl/landing-pad/landing-pad.glb
- mars-rover: https://grab3d.com/dl/mars-rover/mars-rover.glb
- off-road-4x4: https://grab3d.com/dl/off-road-4x4/off-road-4x4.glb
- power-generator: https://grab3d.com/dl/power-generator/power-generator.glb
- sci-fi-barrel: https://grab3d.com/dl/sci-fi-barrel/sci-fi-barrel.glb
- sci-fi-crate: https://grab3d.com/dl/sci-fi-crate/sci-fi-crate.glb
- sci-fi-door: https://grab3d.com/dl/sci-fi-door/sci-fi-door.glb
- sci-fi-lamp: https://grab3d.com/dl/sci-fi-lamp/sci-fi-lamp.glb
- shipping-container-proz: https://grab3d.com/dl/shipping-container-proz/shipping-container-proz.glb
- solar-panel-array: https://grab3d.com/dl/solar-panel-array/solar-panel-array.glb

## 3. Characters: Ara 3D Gen + MakeHuman + CMU mocap

- Generator: https://github.com/olatunde85/3d-gen, MIT licence (code only, which isn't shipped). It's cloned at `src/3d-gen`; the export scripts are `scripts/ss-export.ts` and `scripts/ss-ids.ts`.
- Body, skin and clothing data: MakeHuman assets, **CC0** (MakeHuman 1.x asset licence). The exported GLBs are our own output with no attribution required.
- Animation: CMU Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu). It's free to use, including commercially, in derived works such as games. The only restriction is that the raw mocap data can't be resold as a standalone product, which baking it into game characters doesn't do. A courtesy credit to CMU is customary and recommended.
- Outputs: `models/phone/char_{player_survivor,npc_soldier,npc_hacker,npc_worker}.glb` (about 0.56–0.83 MB each) plus desktop variants. Clips: Idle, Walk, Run, Punch, Pistol aim, Pistol fire, Rifle run, Hit reaction, Death (fall forward), Drive car, Jump.

## 4. Engine

- three.js r169 (MIT): `ss-lookdev/vendor/three`, identical to the game's vendored copy plus the addons (postprocessing, GLTFLoader, KTX2Loader, RGBELoader, meshopt decoder (MIT), basis transcoder (Apache-2.0), draco decoder (Apache-2.0)).
- Tooling, not shipped: gltf-transform (MIT), sharp (Apache-2.0), KTX-Software (Apache-2.0).

## 5. Gaps (nothing license-clean found without an account)

- **French bulldog (Frankie):** no CC0 rigged Frenchie is downloadable without login (Sketchfab and Meshy need accounts, and many have unclear terms). Keep the procedural dog from `models.js` and upgrade its materials (PBR fur-ish roughness, weathering at 0.25, helmet glass = `glassMat`). ART.md also wants him slightly cartoonish.
- **Spacesuit humans:** MakeHuman has no EVA suit. Characters wear street/wasteland outfits. Options are a procedural helmet and backpack attached to the head bone, or a commissioned/CC0 suit later. Grab3D `sci-fi-soldier` exists but at about 750k tris it's too heavy.
- **Sci-fi buildings:** the Grab3D kit is clean and white. Gritty buildings in the look-dev are procedural boxes with Poly Haven concrete/corrugated/rust/shutter/grate textures plus the `weather()` shader.

## LOD variants (derived, same licences)
- `models/phone/` = phone build, re-simplified by `tools/lite.sh`: vehicles/habitats/props to ~6k tris, boulders to ~700 tris (meshopt simplify, textures untouched).
- `models/mid/` = the previous phone build (pre-lite). Only the boulders are used from it (high tier). Derived works of the CC0 / MIT sources listed above; no new licence terms.
