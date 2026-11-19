# Arquitectura técnica (v0.5)

Series Forge Studio es una aplicación **local, file-first y sin LLM integrado**. Los agentes externos (Claude Code, Codex, OpenCode) y la web editan los mismos archivos; el motor los convierte en vídeo de forma determinista.

```text
 workspace/<proyecto>/*.json|md ──► src/pipeline/project.ts  (carga, valida con zod, migra v1 en memoria, hereda biblioteca)
                                       │
          ┌────────────────────────────┼──────────────────────────────┐
          ▼                            ▼                              ▼
  src/engine/director.ts      src/audio/tts.ts + align.ts      src/pipeline/story.ts
  scene.json ──► timeline      voz offline ──► WAV + visemas     canon / conocimiento / relaciones
  resuelto (tiempo absoluto)          │
          │◄──────── duraciones reales y visemas ─┘
          ▼
  src/engine/pose.ts  (pose(t) pura: clips, capas, locomoción, IK, mirada, cara, objetos)
  src/engine/camera.ts (encuadres, movimientos, oclusión, colisión con paredes)
          │
          ▼
  src/render/stage.ts  (Three.js toon: personajes, objetos, escenarios, efectos, transiciones)
     ├── editor web (ui/*.tsx, React) ─────────────── mismo bundle, misma Stage
     └── exportación (src/pipeline/chrome.ts: Chrome/Edge headless + WebGL GPU)
                    │ RGBA crudo por loopback
                    ▼
            FFmpeg (libx264) por fragmento de plano ──► caché por hash ──► concat
  src/audio/mixer.ts: diálogo + foley + ambientes + música, ducking, BS.1770, limitador ──► audio-master.wav
            mux MP4 (H.264 + AAC 48 kHz + subtítulos mov_text) + SRT + metadata + storyboard
  src/pipeline/validate.ts ──► validation-report.json
```

## Módulos

| Ruta | Responsabilidad |
|---|---|
| `src/engine/schema.ts` | Esquemas versionados (zod) de todos los archivos, migraciones v1→v2. |
| `src/engine/humanoid.ts` | Esqueleto humanoid-v2 derivado de proporciones; límites articulares; máscaras de capas. |
| `src/engine/clip.ts` | Muestreo de keyframes (spline Catmull-Rom y curvas de easing). |
| `src/engine/pose.ts` | `RigInstance`, `evaluateActor` (capas, aditivos, locomoción, solver de pelvis, IK de dos huesos con eje de bisagra, look-at repartido, manos), `SceneEvaluator` (objetos sujetos/caídos, cabezas, dirección de la cara). |
| `src/engine/director.ts` | Resuelve `at/after/with`, planifica pasos, giros, rodeos y puntos de aproximación sin colisión, interacciones (coger, soltar con física balística, dar, sentarse), miradas automáticas, foley, subtítulos. |
| `src/engine/face.ts` | Mezcla de expresiones, visemas españoles con coarticulación, parpadeo determinista. |
| `src/engine/camera.ts` | Cámaras de plano: encuadres cinematográficos, movimientos, handheld, oclusión y colisión. |
| `src/render/*` | Materiales toon + contorno de casco invertido, personaje con skinning procedural y rig facial, generadores de objetos y escenarios, `Stage`. |
| `src/audio/*` | WAV, fonética española (G2P), alineador Viterbi, TTS con caché, síntesis procedural de SFX/música, mezclador y sonoridad. |
| `src/pipeline/*` | Carga de proyecto, episodio (compilación, render, audio, mux), validación QA, historia, preview, scaffolding, host de Chromium. |
| `src/cli/studio.ts` | Contrato CLI para agentes. |
| `src/server/studio-server.ts` | Servidor web local (127.0.0.1), SSE, escrituras validadas y atómicas, trabajos de render. |
| `ui/` | Editor React/TypeScript empaquetado con esbuild (`npm run build`). |
| `library/` | Biblioteca compartida: clips humanoides, locomociones, expresiones, SFX y música procedurales (datos). |

TypeScript se ejecuta directamente con Node 24 (*type stripping*, solo sintaxis borrable); el navegador recibe el mismo código empaquetado por esbuild. `npm run typecheck` ejecuta `tsc`.

## Determinismo

- Todo el estado visual es `f(archivos, t)`: no hay integración por `deltaTime`. Los parpadeos, chispas, ruido de cámara y variaciones usan hashes deterministas.
- La evaluación de pose en `t` es idéntica sea cual sea el orden de los fotogramas (test `estado en t es independiente del orden de evaluación`).
- Los objetos que caen usan una solución balística analítica a partir de la pose de la mano en el instante de soltar.

## Caché e invalidación

- **Voz**: `generated/audio/voices/<hash>.wav|json`, hash de (texto, perfil de voz, emoción, intensidad, indicación, versión del TTS).
- **Vídeo**: cada plano se divide en fragmentos de ≤ 240 fotogramas. Su hash incluye la **huella del estado por fotograma** (poses de todos los huesos, cara, objetos, cámara, transiciones), los efectos activos, los archivos de geometría implicados, el código del motor/render y los ajustes. Cambiar una frase o una animación solo invalida los fragmentos cuyos píxeles cambian. Los fragmentos se publican de forma atómica: una ejecución interrumpida se reanuda donde quedó.
- **Audio**: mezcla por escena cacheada por hash de sus pistas.

## Rendimiento medido (GTX 660 Ti 2 GB, Chrome 142, Windows 10)

- 640×360: ~40–50 fps de render; 1920×1080: ~7–11 fps (WebGL2/ANGLE D3D11).
- Memoria del proceso Node durante el render: 160–230 MB; el navegador se reutiliza entre planos.
- Ver `docs/IMPLEMENTATION_STATUS.md` para la prueba de 20 minutos.

## Seguridad

- Servidor solo en `127.0.0.1`, comprobación de `Host` y `Origin`, rutas editables por lista blanca, sin enlaces simbólicos ni `..`, tamaño máximo de cuerpo, escrituras atómicas con hash esperado (409 en conflicto).
- Los assets son datos declarativos: nunca se ejecuta código de los archivos del proyecto.
- Procesos hijos (FFmpeg, PowerShell, Chrome) con argumentos separados, sin shell; el host de render usa un token aleatorio y un perfil temporal.
