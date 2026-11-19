# Series Forge Studio v0.3 — Exportación audiovisual incremental

## Qué está implementado

La v0.3 exporta un **animatic procedural** real, no el render final 3D toon. Genera MP4 con vídeo H.264, pista AAC y subtítulos SRT. Usa rig, geometría, keyframes, expresiones y beats de escena del workspace. La animación de la boca es aproximada: **no existe alineación fonética ni lip-sync de producción**.

El exportador es determinista por fotograma, divide el capítulo por escenas, utiliza un hash de dependencias para reutilizar clips no modificados y ensambla los fragmentos con FFmpeg. La web permite iniciar un render, ver su progreso y descargar MP4/SRT sin integrar ninguna API de modelos de IA.

## Requisitos

- Node.js 20 o superior; se recomienda Node.js 22.
- FFmpeg en PATH, compilado con decodificador `librsvg`, codificador `libx264` y AAC. Verifica `ffmpeg -decoders` y `ffmpeg -encoders`.
- Opcional para voces: Windows PowerShell 5.1, System.Speech y voz SAPI española instalada. `voice.json` define `voiceId` y `language`; la opción `--sapi` exige disponer realmente de la voz. **No se ha probado SAPI en Windows**.
- No requiere Docker, endpoints de IA, claves de API ni GitHub Actions.

## Cómo ejecutarlo

```powershell
git pull origin main
npm install
npm run demo
npm test
npm start
# Abrir http://127.0.0.1:4317

# Prueba pequeña:
npm run render -- demo-de-produccion piloto --width 320 --height 180 --fps 4 --max-seconds 3
# Exportación íntegra del episodio como animatic:
npm run render -- demo-de-produccion piloto --width 1920 --height 1080 --fps 24
# Voz local SAPI (solo Windows, si ya tienes una voz española instalada):
npm run render -- demo-de-produccion piloto --width 640 --height 360 --fps 12 --sapi
```

La salida se guarda bajo `workspace/<universo>/episodes/<episodio>/output/`: MP4, `subtitulos.srt`, `production.json` y `.render-cache/<hash>/clip.mp4`. El sistema utiliza archivos JSON/Markdown editables y la caché se invalida cuando cambian escena, personajes, animaciones, voces, props, escenario o renderizador.

El botón de previsualización de la web renderiza un máximo de 8 segundos a 640×360/12fps. El botón de capítulo completo solicita 1920×1080/24fps. La producción integral puede durar mucho y ocupar bastante espacio.

## Situación de los hitos

**Verificado localmente:** 22 pruebas automatizadas, generación de un MP4 H.264/AAC corto, salida SRT, caché de escena, API de trabajos y descubrimiento dinámico de animaciones y expresiones creadas por agentes.

**Aún pendiente:** render final de la misma escena Three.js que se ve en la web, IK biomecánico con agarres y contactos, creación de rigs de alta calidad, interacción física, voz expresiva con alineación fonética real, mezcla musical y efectos completos, editor avanzado de planos/timeline y validación editorial/operativa de un capítulo de 20 minutos. No afirmar que se han alcanzado sin entregables audiovisuales y pruebas verificables.

El flujo principal se mantiene: Claude Code/Codex/OpenCode editan recursos en `workspace/`; la web los observa, valida y muestra. MCP sigue siendo opcional.
