# ACTUALIZACIÓN v0.3

El exportador animatic SVG/MP4 y SRT está implementado. Las limitaciones y próximos hitos se describen en `docs/VIDEO_EXPORT_V03.md`. Los apartados siguientes describen el estado histórico v0.2 y no deben interpretarse como el estado actual del exportador.

# SERIES FORGE STUDIO — Especificación ejecutable file-first (v0.2)

**Estado:** arquitectura acordada e implementada parcialmente. **No** afirma que exista un motor capaz de producir por sí solo 20 minutos de animación cinematográfica. Fuente prioritaria para el flujo de trabajo, por delante del antiguo documento `MASTER_IMPLEMENTATION_SPEC.md` (conservado como referencia histórica).

## 1. Objetivo del producto

Un agente externo (Claude Code, Codex u OpenCode) trabaja directamente en el repositorio y crea los assets de un universo de animación en `workspace/<universo>/`. La aplicación web local observa esos archivos, los valida, los muestra y permite editarlos. No configura modelos ni URL, no gestiona autenticación de proveedores, y el servidor MCP existente es opcional (legado).

El producto final debe servir para crear series 2D con personajes de geometría 3D procedural y sombreado toon (2.5D), escenarios y objetos reutilizables, roles narrativos, memoria de relaciones, rigging/IK, expresiones, movimiento, guion, diálogos, voces, lip-sync, música, efectos, cámaras, continuidad y render de episodios hasta 20 minutos.

## 2. Contrato de almacenamiento

```text
workspace/<universo>/
  universe.json
  characters/<id>/
    manifest.json             # ID estable, nombre, renderer, defaults
    aspecto.md                # Descripción visual narrativa
    biografia.md              # Hechos de historia y antecedentes
    personalidad.md
    gustos.md
    relaciones.json           # Relaciones canónicas por characterId
    voice.json                # Perfil de voz; síntesis aún no implementada
    rig.json                  # Jerarquía de huesos, pivotes (Y up)
    geometry.json             # Partes primitivas por hueso, tamaños y colores
    animations/{idle,walk,...}.json   # Keyframes declarativos
    expressions/{neutral,surprised,...}.json # Expresiones/facial
  environments/<id>/manifest.json,environment.json,descripcion.md
  props/<id>/manifest.json,geometry.json,descripcion.md
  episodes/<id>/
    manifest.json,sinopsis.md,guion.md
    scenes/sc-001/scene.json,dialogue.json
    scenes/sc-002/...
```

La carpeta `workspace/` está ignorada en Git. Los datos del usuario **no se publican** por defecto. Los ejemplos se generan con `npm run demo` y pueden copiarse al universo correspondiente. El agente nunca debe modificar código de render para una simple instrucción como «ponle barba a Bruno»; modifica la geometría y fichas del asset correspondiente.

### Formato y unidades

- Coordenadas: **Y vertical, +Z hacia delante, metros**. En personajes, `rig.json` define huesos jerárquicos con `position: [x,y,z]`.
- `geometry.json`: `parts[]` con `id`, `bone`, `primitive` (`box|sphere|capsule|cylinder`), `size`, `position` y `color` hex.
- `animations/*.json`: `schemaVersion:1`, `id`, `duration` en segundos, `loop`, `tracks` con `target: 'bone.rotation.x'` y `keys: [[tiempo,grados], ...]`.
- `expressions/*.json`: `mouthScaleY`, `eyeScaleY`, `browAngleDeg` (las cejas están reservadas para un rig facial posterior).
- `scene.json`: `durationSec`, `environmentId`, `actors[]` con `position`, `yawDeg` y `headYawDeg`, `props[]`, `camera`, `beats[]`.
- `beats`: `type=dialogue|action|camera|effect`, `startSec`, `endSec`; una acción puede especificar `fromPosition`, `toPosition`, `fromYawDeg`, `yawDeg`, `animation`, `expression`.
- Los IDs son slugs estables y no nombres de visualización. Los personajes pueden girarse a 35° sin nuevas imágenes: el mismo rig se rota respecto a Y.
- Siempre crear animaciones **solo cuando sean necesarias**. Preservar compatibilidad con el archivo original.

## 3. Flujo operativo

1. `npm install` para instalar Three.js (única dependencia runtime en esta versión).
2. `npm start` y abrir http://127.0.0.1:4317.
3. `npm run demo` para generar un universo de prueba con Bruno, Lara, Taller, Silla, Piloto y escena temporizada.
4. Abrir el proyecto con Claude/Codex/OpenCode; pedir que cree o modifique archivos en `workspace/<universo>/`.
5. El navegador recibe eventos por `GET /api/changes?project=...` (SSE), recarga el catálogo y rerenderiza sin reiniciar; conserva ediciones locales no guardadas.
6. El inspector edita Markdown/JSON y guarda con `expectedHash` para detectar colisiones con cambios del agente.
7. La timeline y la escena pueden definir acciones y diálogos. `npm run plan -- <universo> <episodio>` construye un manifiesto reproducible por escena con hashes de dependencias.

**Importante:** `data/studio.json` del prototipo 0.1 no se borra. `npm run legacy` levanta el editor original en otro puerto (definir `PORT=4318`). Se incluye importación no destructiva de entidades al nuevo formato; las escenas 2D v0.1 requieren adaptación manual de geometría/cámaras.

## 4. Producción de 20 minutos: diseño de los próximos hitos

### P0 (implementado en v0.2)
Workspace file-first, JSON/Markdown, personajes con geometría y rig 3D procedural simple, rotaciones, animaciones `idle/walk`, expresiones básicas, escenas con actores y posiciones, preview 3D Three.js, inspector, SSE, edición de archivos con hash, migración base, render-plan determinista y pruebas de backend.

### P1 — Character Studio de calidad
- Editor de partes/rig con manipuladores reales, huesos, accesorios, ropa, piel, pelo, ojos, boca, cejas y sliders para deformación procedural.
- Rig humanoide y variantes de especie, pesos/skinning (glTF opcional), límites anatómicos, IK de brazos/piernas/pies, anclajes manos y pies. Presets de movimiento y blending con máscaras de huesos.
- Repositorio global de movimientos base (`assets/presets/humanoid/`) con variaciones por personaje para no duplicar clips.
- Pruebas visuales de frente, perfil, 35°, 90° y espalda; sin inversión de huesos ni clipping.

### P2 — World/Prop Studio e interacción
- Escenarios multicapas en 3D toon, iluminación, partículas, cámara ortográfica, materiales y atlas de estilos.
- Props con `gripPoints`, `seatPoints`, `doorHinges`, colisiones simples y eventos attach/detach al personaje.
- Director de acciones semánticas (caminar hasta, mirar a, recoger, sentarse, abrir, señalar) compila trayectorias y keyframes; no ejecutar cadenas arbitrarias como JavaScript.

### P3 — Story/Script Studio
- Canon persistente, relaciones, emoción, memoria, evolución de personajes, inventario y cronología verificables.
- Escaleta de 20 min -> escenas -> beats -> planos -> diálogos -> decisiones de actuación.
- Editor visual de guion con IDs y referencias estables; import/export Markdown y JSON. Cambios de canon transaccionales tras aprobar episodio.

### P4 — Audio profesional
- Motor TTS local con perfiles de voz persistentes por personaje, escucha previa y caché por frase/voz.
- Forzado/alineación de audio en español a fonemas/visemas; Rhubarb no es alineador principal de castellano.
- Lip-sync con habla/emoción/sorpresa simultáneas; respiración, pausas, interpretación. Música y efectos catalogados y licenciados, mezcla en pistas, normalización LUFS.

### P5 — Producción y exportación
- Renderer determinista `time -> pose de cada actor + cámara + luz + FX` (no animar solo por `deltaTime`).
- Render por plano con hashes de dependencias y caché; herramienta para retomar renders parciales.
- Composición con Remotion/Three y mezcla FFmpeg: vídeo MP4 1920x1080 24fps, WAV master, SRT, proyecto editable, metadata.
- Temporizador de episodio basado en audio realmente sintetizado; animatic verificable antes del render de los 28.800 fotogramas de un capítulo de 20min a 24fps.
- Control de calidad: labios, pies, coherencia, clipping, audio, imágenes negras y reproducibilidad por hash.

### P6 — Escalado y distribución
- Render por trabajadores locales con límites de RAM/VRAM, recuperación de errores, paralelismo controlado, presupuestos de disco.
- Librería de universos con portabilidad y validadores de versiones, políticas de licencias por asset y dependencias.
- Adaptador MCP opcional para agentes; mantener flujo de trabajo CLI sin exigencia de MCP.

## 5. Criterios de aceptación

- Claude crea cinco personajes en carpetas; aparecen sin reiniciar en el navegador; todos tienen geometría, rig, fichas narrativas y una única identidad persistente.
- El usuario cambia la nariz/ropa y la animación de Bruno directamente en JSON y el visor refleja los cambios. Una actualización inválida produce error visible sin corromper lo previamente guardado.
- Dos personajes pueden colocarse con `yawDeg:35` y `yawDeg:-35` y mirar en otra dirección moviendo la cabeza independientemente.
- Un episodio crea escenas y beats temporizados; `compileRenderPlan` verifica referencias y emite hashes para futuras renderizaciones incrementales.
- El render de 30s con giros, mirada, caminar, sentarse, diálogo español y MP4 **no se considera cumplido** hasta tener vídeo y audio reales comprobados.
- No declarar soporte final de 20min antes de demostrar animatic, render por planos y ensamblaje reproducible con benchmark de memoria/tiempo y QA de 20min.

## 6. Seguridad y concurrencia

- Servidor local solo 127.0.0.1 y comprobación de Host/Origin.
- Rutas restringidas a JSON/MD dentro de assets; bloquear rutas fuera del workspace y enlaces simbólicos.
- No renderizar HTML arbitrario ni ejecutar scripts creados por IA como plugins; JSON declarativo exclusivamente.
- Escrituras atómicas, hash de revisión para guardar desde web; documentar riesgo residual de concurrencia entre agentes que editan archivos sin lock.
- El `workspace/` no se publica en Git por defecto; no colocar secretos ni datos privados en fichas. Preservar backups antes de migraciones.