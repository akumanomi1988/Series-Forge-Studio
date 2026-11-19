# Series Forge Studio v0.4 — Three.js shared viewport and deterministic export

## What has actually been implemented

The interactive editor and headless Chromium now use the **same** `public/viewport.js` Three.js renderer. They also share the pure, absolute-time scene evaluator in `public/scene-runtime.js`, imported by the Node workspace evaluator. This removes the previous divergence between browser scene playback and SVG animation evaluation.

A new Chromium DevTools Protocol (CDP) capture session opens a restricted, read-only, loopback HTTP server and drives the viewport to exact time `frame / fps`. Each captured PNG is passed to FFmpeg, which encodes an H.264/AAC segment. The existing scene-by-scene cache, subtitles and concat system remain in place. The legacy SVG animatic renderer is retained explicitly as `--renderer svg`, rather than pretending it matches the 3D image.

The runtime shares actor position, yaw, head yaw, clip selection, clip start, expressions, speaking state, camera position/target and orthographic size. Assets are still file-first, editable with Claude/Codex/OpenCode directly. No agent CLI, API key or Docker is required for rendering.

## Windows prerequisites

- Node.js 22 or newer recommended (`node --version`).
- `npm install` (installs `three`, referenced in `package.json`). A compatible package version must provide both `build/three.module.js` and `build/three.core.js`.
- Chrome, Chromium or Microsoft Edge installed locally. If auto-detection fails, configure `SERIES_FORGE_CHROMIUM` to point to its executable.
- FFmpeg in PATH with H.264 encoder (`libx264`) and AAC encoder. `librsvg` is needed **only** for the SVG fallback.
- No GPU required if a compatible software WebGL backend is available; use `SERIES_FORGE_SWIFTSHADER=1` only when necessary, at a substantial performance cost. Browser corporate policies may block localhost and cannot be bypassed by this app.

## Commands

```powershell
npm install
npm run demo
npm test
npm start
# In a separate terminal, or without the editor running:
npm run render -- demo-de-produccion piloto --renderer three --width 640 --height 360 --fps 12 --max-seconds 5
# Legacy storyboard-quality mode:
npm run render -- demo-de-produccion piloto --renderer svg --width 640 --height 360 --fps 12 --max-seconds 5
```

The web export action defaults to Three.js; the command line also defaults to Three.js. SVG remains explicitly selectable. Frame times are absolute and repeatable independent of playback frame rate.

## Implementation details

- `public/scene-runtime.js`: pure scene evaluation; it never executes code embedded in assets.
- `public/viewport.js`: shared camera, bones, animation clips, expressions and world transforms.
- `public/render.html` / `public/render.js`: restricted Chromium entrypoint.
- `src/browser-render.mjs`: runs local read-only asset server, launches Chrome/Edge, captures PNGs through CDP and closes resources.
- `src/export-episode.mjs`: chooses `three` or `svg`, uses cache per scene, encodes clips with FFmpeg and assembles the MP4.
- `src/studio-server.mjs`: supplies both halves of the Three.js module (`three.module.js`, `three.core.js`) to the editor, and exposes the render job API.

Frames can be resumed after interruption, and temporary frame files are removed after a successful scene render. Cache hashes include renderer selection and shared renderer source code. The exported MP4 currently has a silent AAC track unless optional SAPI voices are enabled on Windows. The simulated talking mouth is NOT phoneme-accurate lip-sync.

## Verification boundary

Automated tests cover deterministic scene evaluation and previous SVG exports. **Full 3D WebGL frame capture and visual parity have NOT been verified on this container**: the package `three` is not available in the offline npm cache and the provided Chromium installation blocks loopback with a browser policy. These are environment restrictions, not evidence of successful WebGL capture. Run the command above on a normal Windows machine and inspect the MP4 before claiming final parity. No production-grade IK, phonetic lip-sync, professional TTS, 20-minute end-to-end benchmark or music mixing is complete.

## Next acceptance tests (mandatory on Windows)

1. Install dependencies with `npm install`; confirm `/vendor/three.module.js` and `/vendor/three.core.js` both return HTTP 200.
2. Launch `npm start`; select the pilot scene in Studio and confirm no browser-console import/WebGL errors.
3. Export a 5-second Three.js preview; confirm H.264/AAC with `ffprobe` and at least two visibly different action frames.
4. Compare deterministic frame at t=2.0s in viewport and MP4: camera position, actor orientation, animation and emotion must match, allowing only codec/pixel differences.
5. Modify a single character clip via Claude, reload Studio, export again, verify only its dependent scene cache changes and no unrelated scene is rerendered.
6. Benchmark one 3-minute scene and a stitched 20-minute episode at 1080p/24fps; measure memory, storage, recovery and final continuity. Do not mark a 20-minute episode done until fully rendered and reviewed.
