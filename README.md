# Solar System Explorer: v8 look-dev preview

This is a standalone visual prototype (a Mars colony street) for the v8 "realistic" overhaul of [Solar System Explorer](https://kaskel87-a11y.github.io/solar-system/). It isn't the game, just a test slice to judge the look and the frame rate on real devices.

**Play:** https://kaskel87-a11y.github.io/solar-system-lookdev/

- **Phone:** left thumb is a walk stick, right thumb drags to look, double-tap on the right side toggles run. Touch devices start on the `low` tier.
- **Laptop:** WASD or the arrow keys walk, Shift runs, drag the mouse to look. Laptops start on `high`.
- **Top-right corner:** live FPS (green ≥30, yellow ≥20, red below that) and a low/med/high tier switcher.
- **URL flags:** `?tier=low|med|high`, `?bench=1&dur=10` (puts results in `window.__bench`), `?auto` (scripted walk), `?nopost`, `?noshadow`.

Static Three.js r169 build, no build step. All assets are CC0 or MIT; see [LICENSES.md](LICENSES.md).
