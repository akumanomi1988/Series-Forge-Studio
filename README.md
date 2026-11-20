# Series Forge Studio

Estudio audiovisual **local y basado en archivos** para producir series de animación 2D/2.5D (3D con sombreado *toon*) desde agentes de programación como Claude Code, Codex u OpenCode. No integra ningún LLM: los agentes escriben JSON/Markdown y el motor produce el episodio.

**Estado (v0.5):** el piloto «El último turno» (64 s, 1920×1080, 24 fps) se genera de extremo a extremo con un comando y supera la validación automática. Detalle verificado, limitaciones y pendientes en [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

## Qué hace

- **Personajes procedurales** con esqueleto humanoide, skinning, ropa, pelo, barba, accesorios y rig facial (ojos con párpados y mirada, cejas, boca dinámica). Giro libre de cuerpo y cabeza en 3D.
- **Motor de animación determinista**: keyframes con curvas, capas y máscaras, aditivos, locomoción paramétrica con pasos planificados y pies apoyados (IK), IK de brazos, mirada repartida en columna/cuello/cabeza/ojos, coger/soltar/dar/sentarse, objetos que caen con física balística. `pose(t)` es pura.
- **Escenarios y objetos** generados (taller, robot, puertas que se abren, mobiliario, exteriores) con anclajes y articulaciones.
- **Dirección**: acciones y diálogos con tiempos relativos, cámaras por encuadre con regla de tercios, **cobertura automática** (plano/contraplano con regla de 180°, J-cuts, sin *jump cuts*), movimientos, transiciones, miradas automáticas y **actuación automática** (gestos según el texto y la emoción, reacciones de quien escucha).
- **Audio**: voces neuronales offline en español con **Kokoro** (local, Apache-2.0) o **Voicebox** (app local), seleccionables por proyecto, con mezclas de voz y entrega por emoción; también Windows OneCore/SAPI y Piper. Caché, prosodia por emoción, alineación fonética → visemas (lip-sync), foley automático, ambientes y música procedural con estilos (lounge, bossa, sitcom), melodía, cortinillas y remates, **banda sonora automática por episodio**, mezcla con ducking, −16 LUFS.
- **Producción**: render por fragmentos de plano en GPU (Chrome/Edge headless) → FFmpeg, caché por huella de estado (solo se re-renderiza lo que cambia), reanudación tras fallo, MP4 H.264/AAC con subtítulos, WAV maestro, SRT, metadata, storyboard y **informe de QA** (ffprobe, negros, sonoridad, sincronía de diálogo, lip-sync en cada arranque de voz, ritmo sin tiempos muertos, paridad editor/exportación).
- **Publicación**: conexión OAuth con tu canal de **YouTube** y subida reanudable (privada por defecto) desde la CLI o la web.
- **Historia**: canon, conocimiento por personaje, relaciones y cronología con propuestas por episodio y confirmación explícita.
- **Editor web** (React): explorador, visor 3D, inspector paramétrico, timeline multipista, guion con escucha de voz, historia y render. Se actualiza solo cuando un agente cambia archivos.

## Empezar

```powershell
npm install
npm run build
npm run studio -- init pilot
npm run studio -- produce el-ultimo-turno ep-001     # ≈ 2–4 min en una GPU modesta
npm start                                            # http://127.0.0.1:4317
```

Requisitos: Windows 10/11, Node.js ≥ 24, FFmpeg (libx264) en el PATH, Chrome o Edge, voces españolas de Windows. Ver [`docs/GUIDE.md`](docs/GUIDE.md).

## Comandos

```powershell
npm run studio -- help
npm run studio -- validate <proyecto>
npm run studio -- list characters <proyecto>
npm run studio -- preview character <proyecto> <id>
npm run studio -- compile episode <proyecto> <ep>
npm run studio -- render episode <proyecto> <ep> [--draft] [--max-seconds 10] [--scenes sc-001]
npm run studio -- validate episode <proyecto> <ep>
npm run studio -- produce <proyecto> <ep>
npm run studio -- story status|confirm|amend|revert <proyecto> …
npm run setup:kokoro                                 # voces Kokoro locales (una vez)
npm run studio -- youtube connect|upload <proyecto> <ep>
npm test            # pruebas (unitarias, integración con render real, navegador, TTS)
npm run typecheck
```

## Documentación

- [`AGENTS.md`](AGENTS.md) — instrucciones para agentes.
- [`docs/GUIDE.md`](docs/GUIDE.md) — instalación, editor, flujo de producción, añadir personajes y animaciones, pruebas.
- [`docs/FORMATS.md`](docs/FORMATS.md) — formatos de datos.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura, determinismo, caché, seguridad.
- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — estado verificado y limitaciones.
- `docs/history/` — documentos de versiones anteriores (v0.1–v0.4).

Las versiones anteriores siguen disponibles: `npm run legacy` (editor SVG v0.1 + MCP), `npm run legacy-v04` y `npm run render:legacy`.
