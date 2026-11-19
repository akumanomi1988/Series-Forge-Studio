# AGENTS.md — SERIES FORGE: Motor procedural de series 2D/2.5D dirigido por IA mediante MCP

> **Versión:** 1.0 · **Fecha:** 2026-11-19 · **Estado:** especificación maestra implementable, NO software ya construido.
> **Idioma de producto:** español, con arquitectura multilingüe.
> **Entorno objetivo:** Windows 10/11, Node.js LTS, TypeScript, ejecución local, sin Docker, sin servicios cloud obligatorios.
> **Misión del agente:** implementar el software descrito aquí, probarlo con artefactos verificables y documentar cada capacidad terminada. No detenerse en planes, documentación o ejemplos simulados.

## 0. Orden inequívoca de ejecución

Actúa como CTO/arquitecto senior, ingeniero de gráficos 2D, rigging/animación, sonido, síntesis de voz, narrativa serializada y desarrollador de MCP. Construye una aplicación REAL denominada provisionalmente **Series Forge**. Debe permitir que un cliente MCP invoque **`episode.produce_from_synopsis`** y obtenga, tras un proceso local reanudable, un episodio audiovisual completo: personajes procedurales consistentes, actuaciones, diálogos con voces estables y lip-sync, objetos, escenarios, sonido, música, montaje, MP4, subtítulos y proyecto editable.

**No interpretar una sinopsis como una petición de clips inconexos, imágenes IA, diapositivas ni vídeos repetitivos.** Debe existir causalidad espacial y narrativa, actores coherentes, puesta en escena, continuidad, interacción física e interpretación. Todos los assets visuales maestros son geometría, vectores, shaders, rigs, generadores o código parametrizado; no imágenes estáticas generadas por IA como sustituto del rig. Las texturas de caché generadas a partir de los masters procedurales están permitidas como optimización.

**Instrucciones de trabajo:**
1. Antes de tocar código, inspecciona el repositorio y herramientas instaladas, si existen. Conserva código válido; no reescribas por defecto. Revisa este archivo íntegramente y crea `docs/IMPLEMENTATION_STATUS.md` con brechas reales.
2. Implementa vertical slices ejecutables. Para cada funcionalidad, añade tests, previsualización o archivo reproducible. No declares COMPLETO algo que solo tenga interfaces, mocks o pseudocódigo.
3. Sin Docker, Blender obligatorio, GitHub Actions, servicios de pago obligatorios ni modelos de imagen para dibujar fotogramas. No ejecutar pipelines remotos que consuman minutos. Dependencias locales, en directorios del proyecto siempre que sea posible.
4. Usa el gestor de paquetes y el sistema de ficheros real. Si falla una dependencia, ofrece fallback implementado y registra la degradación en el reporte: **nunca simules éxito**.
5. Exponlo como servidor MCP por `stdio` y CLI local; si incorporas UI, debe ser React web servida en `127.0.0.1` con puerto configurable. Los clientes MCP deben acceder a las mismas operaciones del core.
6. Planifica recursos por segmento y guarda resultados parciales. Prioriza una demostración que funcione de verdad sobre una base de código demasiado grande.
7. Al terminar cada iteración: pruebas, instrucciones Windows reproducibles, artefactos de demostración, limitaciones, siguiente bloque prioritario. No efectuar push, PR, deploy ni ejecutar CI externo salvo orden expresa.

## 1. Resultado esperado y alcance

**Entrada humana mínima:**
> «Serie de aventuras cómicas. Un robot cobarde y una robot ingeniera intentan escapar de una fábrica descontrolada. Episodio 1: una llave abre el único ascensor, pero la fábrica intenta impedirlo. Español de España, 8 minutos, 16:9.»

**Salida automatizada:**
- Universo/serie (`series-bible.json`): premisa, género, reglas, tono, estilo visual y sonoro, línea temporal, canon, localidades y restricciones.
- Personajes persistentes: ficha, construcción procedural reproducible, rig/poses, expresiones, gestos, voz bloqueada, relaciones, conocimientos, metas, estados físicos y emocionales.
- Fábrica de escenarios y props procedurales y reutilizables, con superficies, anclajes, dimensiones y reglas de interacción.
- Guion estructurado: actos, secuencias, beats, escenas, planos, continuidad y diálogos con intención dramática.
- Voz TTS *por personaje*, interpretación y timing real del audio, alineación de palabras y visemas de boca.
- Actuación corporal y facial: locomoción, mirada, intención, manipulación de props, gestos, pose y reacción.
- Música original programática o derivada de instrumentos/algoritmos legalmente aptos, SFX procedurales, ambiente, mezcla, paneo y ducking.
- Composición cinematográfica: shots, cámaras, capas, cortes, transiciones, iluminación estilizada, efectos y subtítulos.
- Render segmentado en MP4 H.264 + WAV master + SRT + miniatura + manifiesto + proyecto editable + informe de QA.
- Continuidad persistida para capítulos posteriores, con *commit narrativo* solo después de aprobar el resultado.

**Objetivos de operación:** 1920×1080, 30 FPS, audio estéreo a 48 kHz, duración solicitada configurable de 30 segundos a 15 minutos; 8–15 minutos es una **meta de producción**, no una capacidad presupuesta desde el primer commit. La calidad debe verificarse en pruebas de 45–90 s antes de ampliar duración. Previsualización 540p/720p y render final 1080p.

**Fuera del alcance inicial:** físicas 3D completas, motion capture, streaming de episodios en vivo, aprendizaje/entrenamiento de voces, generación fotográfica de vídeo, reproducción de personajes de franquicias protegidas, automatización de publicación en terceros, y edición colaborativa SaaS. Arquitectura con interfaces para añadirlos más adelante.

## 2. Decisión tecnológica: referencia inicial, sustituible solo con prueba A/B

| Responsabilidad | Tecnología / estrategia | Motivo y restricción |
|---|---|---|
| Código, esquemas y servicios | TypeScript estricto, Node.js LTS, Zod, monorepo npm workspaces | Un solo lenguaje y tipado extremo a extremo |
| MCP | `@modelcontextprotocol/server` v2, `serveStdio` | SDK oficial vigente en nov. 2026; NO copiar APIs v1 sin confirmar |
| Escena, personajes, GPU | PixiJS 8 + jerarquía propia de bones/IK/deformación | Composición 2D rápida, sprites/vector caches, shaders |
| Assets fuente | Definiciones paramétricas SVG/paths + generadores TS + shaders | Creación procedimental, variación semilla, versionado, exportación |
| Integración vídeo | Remotion + React para timeline/renders; adaptador Pixi *frame-driven* | Integración determinista con la composición |
| Exportación y mezcla | FFmpeg y `@remotion/renderer` cuando proceda | Segmentos, códecs, QA de medios, ensamblado |
| Narrativa persistente | SQLite mediante adaptador/repositorio, JSON schema en archivos | Canon, relaciones, historia, versiones, jobs; portable |
| Música programática | Motor `AudioGraph` y Tone.js offline si supera prueba de determinismo | Composición algorítmica, capas y eventos musicales |
| SFX | Sintetizador DSP local + event presets + espacialización | Biblioteca de efectos única, parametrizada y programable |
| TTS principal | Adaptador local Qwen3-TTS para interpretación, si hardware suficiente | Voces expresivas y español; no prometer rendimiento sin benchmark |
| TTS ligero/fallback | Kokoro ONNX / voz española licenciada, más fallback Piper | CPU/VRAM limitadas y ejecución sin red tras instalación |
| Visemas | Rhubarb Lip Sync + alineación temporal con transcripción | Archivo JSON temporizado; adaptador a mouth rig |
| Editor | React/TypeScript + Pixi viewport + timeline editable | Inspeccionar y reparar escenas sin regenerar todo |
| Test | Vitest, Playwright local, ffprobe, snapshots de frames y perceptual checks | Validar código, audio, lipsync, estabilidad y media |

**Licencias:** guardar en manifest de cada modelo, voz, soundfont, icono, binario o dependencia `license`, `source`, `version`, `commercialAllowed` y `attributionRequired`. Rechazar el uso en salida comercial de fuentes con licencia no verificada. Remotion tiene condiciones específicas para uso comercial según dimensión del equipo y producto; verificar el alcance antes de SaaS/servicio de render. Qwen3-TTS y Kokoro tienen modelos/licencias individuales; comprobar cada artefacto. FFmpeg puede distribuirse bajo LGPL o GPL dependiendo de la compilación.

**Nota técnica crítica:** PixiJS no debe usar su `Ticker` de tiempo real como fuente de verdad para renderizar vídeo. En cada fotograma Remotion pasa `frame` y `fps` al motor puro `evaluateShotAtFrame()`, que calcula pose, cámara, sprites y efectos de forma determinista. Después se solicita explícitamente el render de ese estado. No depender de `requestAnimationFrame` ni del orden en el que Chromium visite frames. Resolver cargas asíncronas con barreras antes de capturar cada frame. Validar que el adaptador Canvas↔Remotion captura correctamente los píxeles en exportación real; si el motor de captura resulta incompatible, aislar el renderer con una interfaz y usar frames PNG/pipe + FFmpeg como fallback, sin tocar el formato de escenas.

## 3. Principios de diseño innegociables

1. **Assets procedurales first.** Cada entidad tiene fuente editable paramétrica (`generatorId`, `generatorVersion`, `params`, `seed`). Ningún asset maestro depende de un PNG de IA.
2. **Identidad estable.** `seriesId`, `characterId`, `sceneId`, `propId`, `voiceId` y `assetId` no cambian por regeneración. Versionado por revisión y hash de contenido.
3. **IA diseña; runtime ejecuta.** Un LLM crea `EpisodePlan`, no un programa arbitrario que ejecutamos a ciegas. No se invoca IA durante el render por frame.
4. **Contrato de timeline unificado.** Las unidades son **frames enteros** para imagen y **muestras enteras** para audio; la conversión es explícita. Nunca confiar en duraciones inventadas de TTS.
5. **Narrativa causal.** Cada acto, beat y escena tiene objetivos, obstáculos, acciones, resultado y cambios de mundo. Sin montajes decorativos que no cuentan nada.
6. **Continuidad transaccional.** Separar `canon_before`, `proposed_delta` y `canon_committed`. No actualizar el canon de la serie por un render fallido o un ensayo.
7. **Herramientas pequeñas + una herramienta compuesta.** MCP ofrece operaciones controlables, pero también `episode.produce_from_synopsis` de extremo a extremo para un agente con prompt corto.
8. **Recuperación/observabilidad.** Los trabajos largos tienen estado, progreso, etapa, logs, checkpoints, cancelación y reanudación. Idempotencia por `requestKey`.
9. **Sin dependencias de assets ajenos por defecto.** No descargar fotos, personajes ni músicas sin solicitud y licencia verificada. Textos, voces y sonidos propios/procedurales.
10. **Calidad visual, no solo técnica.** No aceptar un vídeo que decodifique bien pero parezca una presentación de figuras inmóviles. La QA debe demostrar actuación, acciones y puesta en escena.

## 4. Arquitectura y límites de módulos

```text
CLIENTE IA (Claude / ChatGPT / Codex / otro compatible)
                 │ MCP JSON-RPC, stdio
                 ▼
  packages/mcp-server  ─────── packages/cli ─────── apps/editor
                 │                     │                  │
                 └──────────┬──────────┴──────────────────┘
                            ▼
                   packages/application
  Director / Story Planner / Continuity / Jobs / Scene Compiler
        │                │               │               │
        ▼                ▼               ▼               ▼
 packages/domain   packages/assets  packages/audio   packages/render
   DSL + reglas     generadores      TTS/SFX/Music     Pixi + Remotion
        │                │               │               │
        └────────────────┴───────────────┴───────────────┘
                            ▼
                     packages/storage
            SQLite + CAS de archivos + revisiones
                            │
                workspace/series/<seriesId>/...
```

- `domain`: tipos inmutables, validaciones de invariantes, matemática de rigs, interpoladores, contratos DSL, narrativa.
- `assets`: generadores puros de rigs, partes vectoriales, props, sets, variaciones y efectos.
- `audio`: proveedores de voces, voces por personaje, caché, ajustes de duración, alineación, score, SFX, mezcla.
- `render`: evaluador frame-by-frame, cámaras, capas, render local, segmentación, FFmpeg, medición y thumbnails.
- `application`: casos de uso, estados, comandos, planificador, jobs, cache invalidation, QA, continuidad.
- `mcp-server`: expone operaciones con esquemas explícitos, descripciones útiles para LLM y manejo estructurado de errores.
- `cli`: las mismas operaciones sin MCP; útil para tests y recuperación.
- `editor`: biblioteca, fichas, historia, viewport de escena, timeline, propiedades, inspección y rerender.
- `storage`: repositorios versionados, snapshots, transacciones, locks, registros, manifiestos, licencias.

No crear microservicios ni colas cloud para la primera versión. Un proceso local (o worker hijo para render/TTS) y trabajos persistentes en SQLite bastan. Diseñar interfaces para mover workers a varias máquinas en el futuro.

## 5. Biblioteca de assets procedurales: contratos y capacidades

### 5.1 AssetDefinition y catálogo

Cada asset debe contar al menos con:
- `assetId`, `kind` (character|rig|expression|animation|location|prop|effect|sound|music|voice).
- `displayName`, `tags`, `styleId`, `generatorId`, `generatorVersion`, `params`, `seed`, `revision`, `hash`.
- `capabilities`, `dependencies[]`, `licenseInfo`, `previewPaths[]`, `createdAt`, `modifiedAt`.
- definición portable y serializable, sin funciones Javascript arbitrarias incrustadas en un documento procedente de la IA.
- generador en módulo TS **aprobado y testeado** que consume parámetros validados. Un LLM puede proponer código nuevo, pero debe incorporarse a una revisión del proyecto y pasar tests antes de ejecutar.

Todo asset soporta `create`, `get`, `list/search`, `update`, `clone_variant`, `preview`, `validate` y `archive`, expuestos vía aplicación/MCP. Los assets caché generados deben ser reconstruibles a partir de fuente+versión+semilla.

### 5.2 CharacterFactory: personaje vectorial complejo, no muñeco rígido

**Constructor parametrizable:** silueta, proporciones, cabeza, ojos, cejas, párpados, nariz, boca, cuello, tronco, brazos, manos/dedos simplificados, pelvis, piernas, pies, vestuario, pelo/casco, accesorios, materiales, paleta, outline, variaciones cromáticas y sombreado. Compatible con robots, humanos estilizados y criaturas bípedas; extensible a otras topologías.

**Rig canónico:** raíz, pelvis, columna (al menos 2 segmentos), cuello, cabeza, mandíbula/boca, ojos, hombros, brazos superior/inferior, muñecas, manos y agarres, muslos, rodillas, tobillos y pies. Bones y landmarks en coordenadas normalizadas. Restricciones anatómicas/artísticas por especie. Jerarquía con transformaciones 2D, interpolación por pose, skins vectoriales, mesh deformation donde haga falta, occlusion/z-order, giro lateral y vistas artísticas frontal, perfil y tres cuartos.

**Sistemas de movimiento:**
- FK y IK de dos segmentos / FABRIK; codos y rodillas con pole vector.
- root motion y locomoción (idle, walk, run, turn, stop, jump, fall, sit, stand, kneel).
- foot planting y detección de contacto con superficie; manos ligadas a handles de props.
- anticipación, follow-through, squash-and-stretch moderado, overlap, easings y arcos de acción.
- secondary motion: pelo, ropa y accesorios según curvas reproducibles.
- sistema de expresiones por capas: `neutral`, `joy`, `sadness`, `anger`, `fear`, `disgust`, `surprise`, `contempt`, intensidades 0..1 y mezclas, blink, gaze, pupil dilation, brows, posture, breathing, body tension.
- sistema de visemas como canal independiente del estado emocional; expresiones de labios y boca mezcladas con lip-sync.
- actions compuestas: `look_at`, `point_at`, `reach`, `grasp`, `hold`, `carry`, `put_down`, `push`, `pull`, `open`, `close`, `operate`, `react`, `speak`, `listen`, `interact`.
- prioridad de canales y blending (locomotion/bodyAction/face/emotion/lipSync/gaze/secondaryMotion) sin conflictos.

**Calidad mínima de un personaje principal:** al menos 3 vistas, 8 expresiones, 9 formas de boca o visemas, 12 acciones reutilizables y 3 objetos con agarres compatibles. No prometer calidad de animación tradicional dibujada a mano; desarrollar un estilo procedural atractivo, coherente y verificable.

### 5.3 PropFactory y SceneFactory

- Props con geometría procedural, escala y masa semántica, material, bounding box, colisionador 2D simplificado, ocupación, estado (`open/closed`, `held/free`, `damaged`, etc.), efectos y **puntos de anclaje** (`handle`, `pivot`, `socket`, `trigger`).
- Transformaciones y estados reversibles, por ejemplo una puerta abre por pivote y conserva su estado; una llave puede pasar del suelo a la mano de un actor, luego a una cerradura.
- Sets con capas `farBackground`, `background`, `middle`, `actors`, `foreground`, `effects`, puntos de entrada/salida, regiones transitables, superficies, profundidad y parallax.
- Conectar props y escenarios por interacciones declarativas, no por teletransporte visual. Añadir `blocking` para posiciones objetivo, líneas de mirada, proximidad y oclusión.
- Generadores de escenarios: fábrica, habitación, calle, parque, pasillo y taller como 5 plantillas de referencia; la biblioteca debe ser extensible, no limitada a esas plantillas.
- Cámara como asset: framing por personajes/objetos, position/zoom/rotation/shake, dolly/pan/zoom, safe areas, shot composition, depth cues y cambios controlados.
- Shaders/FX parametrizados: bloom suave, viñeta, blur, glow, ruido, humo, polvo, destellos, relámpago, rayos, vibración y color grading sin dependencia temporal no determinista.

### 5.4 AnimationFactory y catálogo

Un clip es independiente de un personaje concreto cuando sea posible. Definir `targets`, canales, keyframes, curves, duración, root motion, apoyos, restricciones, markers/contacts y `blendPolicy`. Retargeting entre rigs compatibles por roles de hueso y proporciones, validando que el destino soporta la acción.

Los eventos de interacción definen **precondición → acción visible → cambio de estado → postcondición**. `pick_up(key)` debe identificar llave, mano, trayecto de alcance y momento en que el objeto cambia de padre. Un fallo del mecanismo crea un error de compilación, no un salto silencioso de posición.

## 6. Ficha de personaje, memoria y continuidad

### 6.1 Modelado mínimo de Character

```json
{
  "characterId": "char_ari",
  "seriesId": "series_fabrica",
  "name": "Ari",
  "identity": {"role": "ingeniera", "ageBand": "adulta", "species": "robot", "appearanceSignature": "cuerpo cobre, visor azul, antena corta"},
  "psychology": {"traits": ["analítica", "impaciente", "protectora"], "values": ["lealtad"], "fears": ["perder a su equipo"], "desires": ["escapar de la fábrica"], "speechPatterns": ["frases breves", "sarcasmo contenido"]},
  "visual": {"assetId": "asset_ari", "rigId": "rig_robot_biped_v1", "paletteId": "palette_factory_v1", "revision": 1},
  "voice": {"voiceId": "voice_ari", "provider": "qwen3-tts-local", "modelVersion": "pinned-and-audited", "referenceAssetId": "voice_anchor_ari", "language": "es-ES", "defaultDelivery": {"rate": 1.0, "pitch": 1.0, "intensity": 0.6}},
  "story": {"backstory": "Diseñó parte del sistema de seguridad", "secrets": ["Conoce el código de emergencia"], "knowledge": ["sabe reparar ascensores"], "currentGoals": ["conseguir la llave"], "injuries": [], "inventory": []},
  "emotion": {"primary": "anxiety", "intensity": 0.35, "toward": "factory_control", "updatedAtBeat": "beat_000"},
  "relationships": [{"targetCharacterId": "char_boro", "type": "colleague", "trust": 0.75, "affection": 0.65, "conflict": 0.2, "historyEventIds": []}],
  "continuity": {"firstEpisodeId": "ep_001", "lastSeenEpisodeId": null, "version": 1}
}
```

El audio de `referenceAssetId` debe ser una voz original permitida que el sistema genera/selecciona y conserva. **No clonar voces reales sin autorización.** No basta almacenar `"voz masculina grave"`: hay que persistir un identificador/modelo/ajustes reproducibles y verificar semejanza acústica cuando el proveedor lo permita.

### 6.2 StoryBible / Timeline / EmotionalState

- `WorldRules`: lo físicamente posible en el universo, época, geografía, tecnología, estilo, estado de lugares y objetos.
- `Characters`: biografía inmutable + atributos mutables versionados.
- `RelationshipEdge`: relación dirigida A→B, confianza, afecto, rivalidad, miedo, deuda, últimos eventos significativos; permitir asimetría.
- `KnowledgeFact`: cada personaje conoce o ignora hechos concretos; un personaje no puede revelar un secreto que nunca aprendió.
- `Event`: episodio, escena, beat, timestamp, agentes, objeto y efecto comprobable en mundo, inventario o relación.
- `CharacterState`: ubicación, postura, vestuario/daños, inventario, emoción, motivación, objetivos, fatiga, heridas, conocimiento.
- `EpisodeArc`: conflicto central, revelaciones, decisión, consecuencias, cliffhanger opcional; arco estacional separado.
- `ContinuitySnapshot`: antes/después de episodio, con cambios propuestos, diferencias, conflictos, aprobación y commit.

**Motor de emociones:** no generar sentimientos aleatorios con cada frase. El planificador propone cambios emocionales motivados por eventos (`stimulus`, `appraisal`, `delta`, `duration`, `target`) y éstos afectan voz, postura, gesto, prosodia, ritmo, mirada y toma de decisiones. El estado puede relajarse con el paso de escenas y variar según relaciones, sin olvidar acontecimientos relevantes.

**Política de canon:** un episodio en borrador genera `proposedWorldDelta`; pasa validación de causalidad y coherencia y requiere confirmación del flujo de publicación/aceptación para ser `committed`. Se puede reabrir episodio sin corromper capítulos posteriores. Bloquear o ramificar si se intenta cambiar una escena con dependencias canónicas.

## 7. El idioma intermedio que la IA debe escribir: `EpisodePlan` (DSL)

No confiar en descripción libre en tiempo de render. Crear un esquema Zod + JSON Schema exportable. Los nombres siguientes son contratos conceptuales a concretar y versionar como `schemaVersion: 1`.

```json
{
  "schemaVersion": 1,
  "episodeId": "ep_001",
  "seriesId": "series_fabrica",
  "synopsis": "Ari y Boro buscan la llave del ascensor mientras una fábrica se rebela",
  "language": "es-ES",
  "styleId": "style_vector_comedy_v1",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "targetDurationFrames": 14400,
  "seed": 10383,
  "arc": {"goal": "llegar al ascensor", "obstacle": "la seguridad activa bloquea el acceso", "stakes": "quedar atrapados", "resolution": "Ari descubre una ruta secundaria"},
  "beats": [{"beatId": "b1", "purpose": "establecer el peligro", "cause": "alarma", "consequence": "corren hacia el taller"}],
  "scenes": [
    {
      "sceneId": "s1",
      "locationId": "set_factory_workshop",
      "durationFrames": 2700,
      "characters": ["char_ari", "char_boro"],
      "props": ["prop_key", "prop_door"],
      "startingStateRef": "canon_ep001_start",
      "shots": [
        {
          "shotId": "s1_sh01",
          "startFrame": 0,
          "durationFrames": 450,
          "camera": {"preset": "medium_two_shot", "targetCharacterIds": ["char_ari", "char_boro"], "keyframes": []},
          "blocking": [{"characterId": "char_ari", "position": [0.35, 0.8]}, {"characterId": "char_boro", "position": [0.68, 0.8]}],
          "actions": [
            {"actionId": "a1", "actorId": "char_ari", "type": "look_at", "startFrame": 0, "durationFrames": 90, "params": {"targetId": "prop_key"}},
            {"actionId": "a2", "actorId": "char_ari", "type": "pick_up", "startFrame": 95, "durationFrames": 75, "params": {"propId": "prop_key", "hand": "right"}}
          ],
          "dialogue": [
            {"lineId": "d1", "actorId": "char_ari", "text": "La llave está aquí. ¡Corre!", "intent": "urgency", "emotion": "fear", "intensity": 0.7, "startFrame": 180, "audioAssetId": null, "visemeTrackId": null}
          ],
          "audioEvents": [{"eventId": "fx1", "kind": "sfx", "presetId": "factory_alarm", "startFrame": 0, "gainDb": -15}],
          "effects": [{"kind": "warning_flash", "startFrame": 0, "durationFrames": 450, "params": {"intensity": 0.25}}],
          "stateDelta": [{"op": "set_prop_parent", "propId": "prop_key", "parentId": "char_ari/right_hand", "atFrame": 170}]
        }
      ]
    }
  ],
  "continuity": {"initialSnapshotId": "canon_ep001_start", "proposedDeltaId": "delta_ep001"}
}
```

**Ejemplo orientativo, no marcarlo como producido.** En implementación, dividir `DialogueDraft` (antes del TTS) de `DialogueTimed` (audio real, marcas de tiempo y lip-sync). Las duraciones del ejemplo son placeholders de planificación; el compilador recompone shot timings usando la duración real del TTS antes de renderizar y valida que ningún evento exceda su clip, que no haya huecos no intencionales y que sumas de escena/plano/episodio concuerden. Marcar esquema de posiciones (`normalizedWorldCoordinates` o pixels) explícitamente; nunca mezclar ambos.

### 7.1 Compilación

```
Synopsis → SeriesBible/CanonQuery → EpisodeOutline → DramaticBeats
→ SceneScript → ShotPlan → Narration/Dialogue Draft
→ TTS real → Align words/visemes → durations actualizadas
→ Blocking + Animations + PropInteractions + AudioEvents
→ Validación de invariantes → CompiledTimeline determinista
→ Preview → QA → RenderFinal → Verificación → ProposedCanonCommit
```

La IA puede inspeccionar errores concretos y corregir un único beat, shot o activo sin replanificar el universo. El director debe evaluar *causa, objetivo, acción, reacción, resultado* de cada escena; evitar monólogos estáticos si existe acción visual útil.

## 8. Motor de voz, expresividad y lip-sync

1. Al crear un personaje asignar `VoiceProfile` único y estable. Guardar proveedor, modelo + revisión, voz/embedding o ancla autorizada, idioma, parámetros, pronunciaciones, muestras de comprobación, licencia y calidad medida.
2. Los diálogos contienen `actorId`, `text`, `emotion`, `intent`, `delivery`, pausas y respiraciones opcionales. Las emociones condicionan TTS cuando el motor las admita; si no, no afirmar que existe actuación emocional real.
3. Generar audio WAV por intervención; guardar por `(text+voiceProfileRevision+delivery+seed+modelVersion)` en caché content-addressed. Registrar duración REAL, tasa de muestras, picos, silencios y calidad.
4. Ejecutar alineación: cuando TTS facilite timestamps de fonemas/words, usarlos; si no, Rhubarb JSON + matching, con pruebas en español. Adaptor de visemas mapea códigos A–H/X u otras etiquetas a las formas de boca del rig. Interpolar sin movimientos excesivamente nerviosos.
5. Renderizar canales independientes de ojos/cejas, boca, respiración, postura y manos. Las emociones NO pueden sobrescribir la forma de boca necesaria para una sílaba.
6. Insertar pausas, miradas y escuchas entre líneas. Un actor que no habla debe poder reaccionar (microanimación de escucha, respiración y postura), no quedarse congelado.
7. Mezclar diálogo, ambiente, música y SFX en buses con volumen, sidechain/ducking, limitador, paneo y picos máximos parametrizables. Exportar stems opcionales y master 48 kHz. Verificar que no hay clipping ni diálogo inaudible.
8. Los sonidos también son assets: `audioGeneratorId`, `seed`, `parameters`, `durationSamples`, `licenseInfo`; por ejemplo pasos, alarma, engranajes, chispazos, golpes, apertura de puertas, risas y música incidental. Crear música procedural con temas/leimotivs por personaje y variaciones por escena; persistir progresiones/riffs/eventos en el catálogo.

**No asumir que Rhubarb resuelve por sí solo la expresividad o los fonemas españoles**: validar visemas con muestras conocidas y tener fallback de alineación fonética. No inferir una voz idéntica por usar solo un prompt de TTS: comprobar estabilidad del proveedor y si hace falta fijar un ancla/licencias.

## 9. Producción audiovisual completa

### Director de IA (orquestación)

`DirectorAgent` debe poder producir desde una sinopsis y los assets ya registrados:
- Recuperar canon y plantillas del universo existente.
- Crear universo y personajes procedurales **si no existen**, pero reutilizar los existentes por `characterId` y conflictos detectados.
- Elegir estructura narrativa (apertura, conflicto, escalada, clímax, cierre) sin forzar fórmula idéntica en todos los capítulos.
- Descomponer en escenas que muestren acciones observables; evitar planos repetidos y texto relleno.
- Proponer diálogos con voz propia de cada personaje y reacciones acordes a la relación/emoción.
- Elegir escenarios reutilizables y objetos coherentes; solicitar nuevos generadores solo si el catálogo carece de algo esencial.
- Construir shots con cambio de escala y ángulos motivado por acción. Garantizar continuidad de posiciones y eje.
- Generar audio, alinear y compilar a timeline. Emitir QA y reparar automáticamente errores mecánicos de bajo riesgo.
- Exponer al agente un resumen de progreso, decisiones, warnings, y outputs. Ante fallo: estado `PARTIAL` con error, no `COMPLETE`.

### Timeline y render

- `CompiledTimeline` es inmutable y tiene hash. Evaluador de plano es **función pura respecto a `(timeline, frame, assets versionados, seed)`**. La previsualización y render final deben coincidir en el mismo frame (salvo degradaciones de resolución documentadas).
- Precalcular layout/asset graphs, caches de geometría, TTS y audio. No recalcular por fotograma las geometrías costosas que no cambian.
- Render por escena o segmento reanudable; conservar manifest hash por segmento. Regenerar únicamente los afectados por cambios de dependencias.
- Evitar agotar RAM/VRAM: concurrencia local configurable con default conservador, backpressure, cache LRU, medir utilización y reintentar con batch menor.
- Durante render: las escenas usan `frame`, no `Date.now()`, `Math.random()` libre ni animaciones CSS de wall clock. PRNG seeded obligatorio.
- Audio mix por samples y sincronización frame→sample calculada sin drift; FFprobe verifica fps, duración, códecs, canales y posibles discontinuidades.
- Previews: stills clave, strip de frames, audio corto y vídeo de escena. Esquema de nombre y rutas reproducible.

## 10. MCP API: herramientas que el agente debe entender y poder llamar

**Implementar `tools/list` con descripción, esquemas de entrada/salida Zod/JSON Schema, ejemplos, side-effects y códigos de error.** Respuestas compactas. En trabajos de larga duración, devolver `jobId` y consultar estado; no mantener una llamada síncrona bloqueada durante minutos.

### Operaciones de alto nivel (requeridas)

| Tool | Entrada esencial | Salida / semántica |
|---|---|---|
| `system.inspect` | — | Dependencias, modelos, hardware, capacidad GPU, estado de licencias y rutas, readiness |
| `series.create` | title, synopsis, genre, style, language, seed | Crea universo, bible y estilo versionado |
| `series.get_bible` | seriesId | Resumen canon + ids; detalle bajo demanda |
| `series.get_continuity` | seriesId, episodeId? | Snapshot del canon y líneas argumentales abiertas |
| `series.set_canon` | seriesId, patch, expectedRevision | Mutación versionada validada; no sobrescribir sin control |
| `episode.produce_from_synopsis` | seriesId?, synopsis, title?, durationSeconds, language, renderPreset, requestKey, options | Job durable end-to-end; reutiliza universo; devuelve jobId/artifacts al terminar |
| `episode.get_plan` | episodeId | Actos, beats, escenas, planos, timing y warnings |
| `episode.update_plan` | episodeId, patch, expectedRevision | Cambia solo las partes solicitadas, invalida caché dependiente |
| `episode.compile` | episodeId, requestKey | DSL validada, timings reales, errores de continuidad/interacciones |
| `episode.preview` | episodeId, sceneIds?, quality, requestKey | Frames/stills/MP4 corto de preview y QA |
| `episode.render` | episodeId, preset, requestKey | Job de render completo, path y hashes |
| `episode.rerender_scene` | episodeId, sceneId, requestKey | Reconstruye solo escena y segmentos dependientes |
| `episode.verify` | episodeId | Reporte reproducible de artefactos/QA |
| `episode.commit_canon` | episodeId, expectedSeriesRevision | Aplica solo los deltas revisados tras aprobación |
| `jobs.get` | jobId | Estado, phase, progreso, logs, warnings, artefactos |
| `jobs.cancel` | jobId | Solicitud segura de cancelación |
| `jobs.resume` | jobId | Reanuda desde checkpoint real, idempotente |

### Operaciones del catálogo/interpretación (requeridas)

| Tool | Contrato |
|---|---|
| `assets.search` | Query, kind, tags, page/limit: lista de ids/capabilities, no binarios gigantes |
| `assets.get` | id/revision: definición y referencias |
| `assets.preview` | id, pose/action?, preset: render preview |
| `characters.create` | seriesId, description, styleId?, seed: personaje procedural + rig + ficha |
| `characters.update` | characterId, patch, expectedRevision: cambio versionado |
| `characters.set_voice` | characterId, voiceProfileId, testLine: voz y muestra auditable |
| `characters.set_relationship` | pair, relation delta, reason, eventId: arista narrativa justificada |
| `characters.animate_preview` | characterId, actionName, expression, propId?, durationFrames: clip comprobable |
| `locations.create` | seriesId, description, styleId, seed: set procedural reusable |
| `props.create` | description, capabilities, anchors, styleId, seed: objeto procedural reutilizable |
| `animations.create` | targetRigCapabilities, actions, keyframes, contacts: clip reusable |
| `audio.preview_voice` | voiceId/characterId, text, delivery: audio real |
| `audio.preview_sound` | presetId, params, seed: WAV sintetizado |
| `quality.get_report` | jobId/episodeId: pass/fail/warnings y assets referenciados |

**Recursos MCP:** publicar `series://{seriesId}/bible`, `characters://{characterId}/card`, `episodes://{episodeId}/plan`, `jobs://{jobId}/status`, `assets://{assetId}/manifest` cuando el cliente soporte recursos. Los tool outputs deben incluir `schemaVersion`, ids, `revision`, rutas relativas a workspace y errores estructurados. Rechazar escritura fuera del workspace (`path traversal`) y ejecución de comandos arbitrarios expuesta por MCP.

**Ejemplo conceptual de invocación del agente:**

```json
{
  "tool": "episode.produce_from_synopsis",
  "arguments": {
    "seriesId": "series_fabrica",
    "title": "La última llave",
    "synopsis": "Ari y Boro intentan huir de la fábrica. Ari encuentra una llave, pero el ascensor se bloquea y Boro tiene que superar su miedo.",
    "durationSeconds": 480,
    "language": "es-ES",
    "renderPreset": "production_1080p30",
    "requestKey": "factory-s01e01-v1",
    "options": {"reuseKnownAssets": true, "allowCreateProceduralAssets": true, "audio": true, "subtitles": true, "qa": true}
  }
}
```

**Comportamiento esperado:** la llamada crea un job reanudable; `jobs.get` informa de cada fase; al finalizar, exporta MP4 con voces y SFX, SRT, manifiesto, ficha de continuidad y editables. El agente NO debe volver a generar manualmente los mismos assets ni entrar en un bucle de invocaciones redundantes.

## 11. Persistencia física, recursos y archivos

```text
series-forge/
  AGENTS.md                         # Esta especificación
  package.json                      # npm workspaces, sin Docker
  packages/
    domain/                         # modelos, DSL, math, invariantes
    assets/                         # factories procedurales
    animation/                      # rigs, IK, constraints, blending
    narrative/                      # bible, events, emotions, compiler
    audio/                          # TTS/visemas/composer/SFX/mix
    render/                         # Pixi + Remotion + FFmpeg
    storage/                        # SQLite, CAS, repos, jobs
    application/                    # use cases, director, pipeline
    mcp-server/                     # herramientas MCP v2 stdio
    cli/                            # CLI equivalente
  apps/editor/                      # React UI local
  templates/                         # estilos/rig archetypes/locaciones
  models/                            # modelos TTS locales auditados (gitignored)
  tools/                             # binarios locales FFmpeg, Rhubarb (gitignored)
  workspace/
    catalog/                         # SQLite, manifests, CAS
    series/<seriesId>/
      bible.json
      characters/<characterId>/card.json
      locations/<locationId>/manifest.json
      props/<propId>/manifest.json
      episodes/<episodeId>/
        synopsis.md
        outline.json
        script.json
        episode-plan.json
        compiled-timeline.json
        voice-clips/
        visemes/
        previews/
        segments/
        output/episode.mp4
        output/audio-master.wav
        output/subtitles.srt
        output/thumbnail.png
        output/metadata.json
        qa-report.json
        proposed-canon-delta.json
  tests/
  docs/IMPLEMENTATION_STATUS.md
  docs/LICENSES.md
```

Guardar hashes SHA-256 de inputs y salidas; invalidar caché desde dependencias concretas. SQLite con WAL para concurrencia de operaciones de lectura, escrituras transaccionales y locks de job. Guardar credenciales solo en variables de entorno/secret store, nunca en fichas ni commits. Rutas locales configurables por `SERIES_FORGE_WORKSPACE`.

**Gestión de revisiones:** personajes/assets pueden evolucionar sin destruir episodios anteriores. Cada episodio fija las revisiones exactas de character/voice/rig/set/prop/style para permitir reconstrucción. No actualizar un asset en producción y cambiar en silencio un vídeo histórico.

## 12. Interfaz visual para uso y corrección humana

- Biblioteca: buscar personajes, animaciones, escenarios, props, voces y sonidos; vista de capacidades y preview reproducible.
- Series bible: cronología, relaciones dirigidas (grafo), estado/objetivos/emociones, inventario, hechos y coherencia entre episodios.
- Personajes: inspector de cuerpo/rig, material/color, expresiones, mouth shapes, voz, actuaciones, historia y relaciones.
- Director de episodios: sinopsis editable, outline, guion, beats, escenas, shots, timeline, pistas de diálogo, gestos, SFX, música y FX.
- Editor de blocking: mover y rotar actors/props; establecer miradas, anclajes, trayectorias y keyframes, con snapping y undo/redo.
- Playback en navegador usando evaluador determinista de frames. Previsualización de voz/lip-sync. Panel de QA y logs del worker.
- Exportar/registrar JSON editable. Cambios humanos y de IA usan los mismos casos de uso y control de revisiones.

La UI no debe ser requisito para usar MCP. **Producción automática sin interfaz** y **edición posterior** son ambas funciones de primera clase.

## 13. Renderización y calidad cinematográfica

Estilo inicial recomendado: **serie 2D vectorial de autor**, con line art limpio, formas relativamente complejas, sombreado cel procedural, materiales y profundidades 2.5D. No venderlo como fotorealismo ni prometer resultados comparables a una animación de estudio sin evaluar referencias artísticas.

Reglas del director visual:
- Secuencias con intención visual. El diálogo no implica primer plano estático continuo: mostrar quien escucha, reacciones y acciones que hacen avanzar el conflicto.
- Definir paleta, proporciones, grosor de línea, sombras, movimiento de cámara y estilo de FX de la serie en un `StyleBible`; bloquearla por universo.
- Animaciones con anticipación, contacto, acción y recuperación; evitar teleportaciones, solapamiento de brazos, mirada sin objetivo y pies que patinan.
- Al intercambiar props, registrar grips/contactos/ownership y z-order. Detectar posiciones imposibles y corregir antes de render.
- Aplicar separación de planos, escenarios con dimensiones coherentes, iluminación artística consistente y capas de ambiente.
- Duración y ritmo variables según función dramática; sin bucles de 6–12 s usados como relleno para alcanzar minutos.
- Generar `ContactSheet` de frames representativos de cada escena y clip QC. Incluir comparación de identidad de personajes y composición visual.

**Detección de degradación:** congelación excesiva, baja entropía entre frames, loops repetidos, duplicación de diálogo, escenarios inconsistentes, props que desaparecen, colisiones indebidas, boca que no mueve, audio vacío, frames corruptos, subtítulos desfasados.

## 14. Máquina de estados de producción y recuperación

```text
NEW → CANON_LOADED → PLAN_READY → ASSETS_READY → SCRIPT_READY
→ VOICES_READY → TIMING_READY → ANIMATIONS_READY → AUDIO_MIX_READY
→ COMPILED → PREVIEWED → QA_PASSED → RENDERED → VERIFIED → COMPLETE
                       └─ QA_FAILED → REPAIRING → QA_PASSED
 Cualquier etapa → PARTIAL / FAILED / CANCELLED (con diagnósticos)
```

Cada etapa escribe checkpoint transaccional y outputs verificables. No repetir TTS ni geometrías si el hash coincide. El worker asigna presupuesto local de CPU, RAM, GPU y disco; si falta VRAM, bajar concurrencia/usar TTS CPU sin modificar silenciosamente el preset final. Retornar estimaciones de recursos *solo tras mediciones reales*, no cifras inventadas. Si un render es demasiado grande, dividir por shots/escenas y unir con cortes exactos.

## 15. Pruebas/criterios de aceptación objetivos

### MVP evaluable: episodio piloto de 60–90 segundos (OBLIGATORIO ANTES DE DECLARAR MOTOR FUNCIONAL)

Crear desde sinopsis **dos robots con identidad visual distinta y dos voces distintas**, un taller procedural, una puerta y una llave. En el vídeo deben verse:
1. Ambos personajes claramente distintos y estables a través de al menos **3 planos y 2 composiciones de cámara**.
2. Un personaje camina, mira la llave, la toma con agarre de mano y la lleva a la puerta. La llave conserva posición/ownership; mano y brazo llegan al objetivo con IK sin atravesarse de forma absurda.
3. Ambos hablan alternadamente, con lip-sync visible por visemas, ojos, expresiones y reacciones del interlocutor. Hay al menos dos emociones diferentes y una evolución justificada.
4. La puerta se abre mediante acción/cambio de estado; hay alarma, sonido de llave, pasos y banda sonora incidental generados/mezclados.
5. El mismo asset de personaje puede usarse en **una segunda escena** sin reconstruirse ni cambiar aspecto/voz.
6. Un `episode.rerender_scene` modifica un gesto/diálogo y deja intactos (mismo hash) los segmentos no afectados.
7. El MP4 y WAV abren, tienen audio real, 30 FPS, duración coherente, sin tramos negros/silencios accidentales; SRT coincide con los diálogos y tiempos.
8. Las definiciones de ambos personajes/escenario/props son trazables a fuentes procedurales y tienen revisiones/semillas reproducibles.
9. Ejecutar `episode.produce_from_synopsis` mediante **cliente MCP real** y vía CLI. Verificar `jobs.get` y recuperación desde checkpoint.
10. Después de QA, producir un segundo episodio corto a partir de otra sinopsis y demostrar que recuerdos, relaciones, objetos y voces siguen coherentes.

### Quality gates de software

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` en local.
- Tests unitarios de rig FK/IK, límites articulares, curvas, visemas, composición de audio, continuidad, reglas de DSL y versionado.
- Tests de propiedades: `same inputs + same seed + same revision → same render state`; tolerancia de pixeles documentada por backend GPU.
- Tests de integración: TTS real con fallback, Rhubarb real, render con audio, FFprobe, SHA-256 y idempotencia.
- Test de canon: no recuperar brazo perdido, no conocer secreto no descubierto, no cambiar ubicación de prop sin evento, no cambiar voz entre escenas.
- Tests de seguridad: path traversal, parámetros fuera de rango, assets maliciosos, codificación/longitudes, operaciones fuera de workspace.
- End-to-end local con navegador/editor si existe. Ejecutar QA visual de cortes mediante contact sheets y reproducir clips reales.

**No se acepta como prueba:** capturas de un mockup, un JSON sin render, un MP4 sin voz si se pidió voz, una animación de figuras estáticas, assets hardcoded específicos del piloto no reutilizables, vídeo mudo con audio prometido, o test marcado `PASS` sin ejecutarse.

## 16. Desarrollo incremental con entregas verificables

### Fase A — Foundation (primero)
- Monorepo TS, MCP v2 stdio operativo, CLI, validación Zod, SQLite/CAS/jobs, scripts para Windows sin Docker, tests locales, licencia de dependencias.
- Primeros tool calls reales `system.inspect`, `series.create`, `characters.create`, `assets.get`, `jobs.get`. Resultados serializados/guardados, no solo respuestas generadas.

### Fase B — Render y Procedural Asset Core
- Pipelines puros `generator → vector/rig → Pixi graph → frame → MP4`; un rig bípeda con FK/IK, 8 expresiones y 9 visemas; animaciones reusable walk/idle/reach/grasp; 2 props con anchors; 1 set procedural; render determinista con segmentación.
- Verificar el problema Pixi/Remotion con un vídeo real de varios segundos, no asumir integración nativa.

### Fase C — Audio + actuación
- Voz estable por personaje (proveedor real), WAV persistente, Rhubarb alignment, mouth poses, SFX procedural, música incidental procedural, mezcla sincronizada, pruebas con diálogo español.

### Fase D — Director/Continuity + piloto
- Story bible, grafo de relaciones, eventos, emociones, scene DSL, planificador, compilador, alto nivel MCP `episode.produce_from_synopsis`, QA, piloto 60–90s y segundo corto con continuidad.

### Fase E — Editor + episodios crecientes
- React editor visual, revisiones de assets, blocking, timeline, rerender incremental y canal de correcciones por MCP; pasar pruebas 3–5 minutos con varias escenas, variedad de planos y memoria.

### Fase F — Producción extensa 8–15 min
- Planificación por actos, control de ritmo, uso de caches, render paralelo local con límites, recuperación, límites de recursos, benchmark en hardware real; QA de un episodio de 8–15 minutos. Sólo entonces llamar a la aplicación "apta para series completas".

**En cada fase:** detallar qué herramientas están implementadas, qué pruebas se han ejecutado y qué vídeo/artefactos demuestran la capacidad. Mantener un backlog claro; no empezar F antes de una prueba de calidad satisfactoria de D/E.

## 17. Instalación Windows y experiencia de desarrollo

Crear `scripts/setup-windows.ps1` idempotente que:
- compruebe Node.js LTS, npm, Git, FFmpeg/ffprobe, GPU/VRAM disponible, memoria, disco y soporte de Chromium/Remotion;
- prepare `tools/` para binarios locales y `models/` para TTS sin instalaciones globales cuando sea viable;
- valide hashes, fuentes y licencias de modelos, y requiera aceptación explícita antes de descargar modelos pesados;
- instale npm dependencies mediante lockfile, genere base local, cree sample y haga un smoke test;
- no invoque Docker, GitHub Actions ni servicios externos de pago.

Crear comandos/documentación (ajustar rutas y sintaxis a la implementación):

```powershell
npm ci
npm run doctor
npm run dev:mcp
npm run dev:editor
npm run test
npm run demo:pilot
npm run render -- --episode ep_001 --preset production_1080p30
```

En el README explicar **configuración MCP del cliente**: comando `node` al JS compilado del servidor, arguments, working directory, env paths locales. El servidor MCP stdio reserva stdout exclusivamente a JSON-RPC; logs a stderr. Compatibilidad con Claude/Codex/clientes MCP, sin asumir que ChatGPT tiene acceso a ese servidor local si no está conectado. Validar `tools/list` y al menos una llamada real desde un cliente MCP Inspector u otro cliente soportado.

## 18. Seguridad, cumplimiento y costes

- MCP `stdio` local primero; si se agrega HTTP, restringir a loopback, tokens y permisos. Nunca exponer por defecto un servicio público ni permitir ejecutar código/shell arbitrario desde prompts.
- Validar Zod, limits por duración/frames/asset count/tamaño, paths canonicalizados bajo workspace; proteger contra path traversal, desbordamientos y DoS por jobs concurrentes.
- Guardar logs sin prompts secretos, claves, archivos privados ni pistas de voz confidenciales; no incorporar TTS/capturas de voces de terceros sin derechos.
- Los assets y episodios deben poder exportarse con su procedencia/licencias; caso `commercialAllowed=false` bloquea render comercial hasta resolverlo.
- No hacer llamadas de IA por frame. Cachear prompts/planes, usar LLM sólo en diseño, revisión y reparación de DSL. Permitir elegir proveedor local o API, con presupuesto máximo opcional, sin acoplar el motor al proveedor.
- Medir uso de CPU/GPU/VRAM, duración de TTS, tiempo por frame, tamaño de archivos y tamaño de caché; la falta de cuota cloud no debe bloquear la producción local con assets/modelos instalados.
- No prometer calidad de estudio automáticamente: el objetivo es un sistema reproducible con control artístico, no una garantía de animación perfecta a partir de cualquier sinopsis.

## 19. Contratos de salida y respuesta al modelo

`episode.produce_from_synopsis` debe devolver inmediatamente algo equivalente a:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "episodeId": "ep_001",
  "jobId": "job_20261119_001",
  "state": "RUNNING",
  "phase": "CANON_LOADED",
  "statusResource": "jobs://job_20261119_001/status"
}
```

Cuando se complete, `jobs.get`/`episode.verify` deben informar:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "jobId": "job_20261119_001",
  "state": "COMPLETE",
  "episodeId": "ep_001",
  "output": {
    "video": "workspace/series/series_fabrica/episodes/ep_001/output/episode.mp4",
    "audioMaster": "workspace/series/series_fabrica/episodes/ep_001/output/audio-master.wav",
    "subtitles": "workspace/series/series_fabrica/episodes/ep_001/output/subtitles.srt",
    "manifest": "workspace/series/series_fabrica/episodes/ep_001/output/metadata.json",
    "qa": "workspace/series/series_fabrica/episodes/ep_001/qa-report.json"
  },
  "qaPassed": true,
  "canonCommitted": false,
  "warnings": []
}
```

**Ejemplos de contrato, no resultados de producción presentes.** Si falla TTS, render, QA o persistencia, nunca devolver `ok: true` con `COMPLETE` ni rutas inexistentes; devolver `PARTIAL`/`FAILED`, códigos de error, intentos y siguiente paso concreto. Diferenciar éxito de generación audiovisual y publicación del canon narrativo.

## 20. Prioridad inmediata al recibir este archivo

Implementa la **Fase A y la primera vertical slice B/C**, no solo las describas. Empieza por:
1. Auditar herramientas/entorno y crear repo/proyecto si no existe. Generar estructura, TS config, npm scripts y MCP server v2 real.
2. Implementar primero las operaciones `system.inspect`, `series.create`, `characters.create`, `characters.animate_preview`, `episode.preview`, `jobs.get` y motor procedural mínimo con dos personajes y un objeto.
3. Hacer la primera prueba de vídeo real (5–10 s) *sin audio* para demostrar que el mismo rig, escena, IK y Pixi+Remotion/FFmpeg realmente renderizan por frame en Windows.
4. Añadir voz real y visemas para generar el primer clip dialogado real, con estados emocionales.
5. Continuar automáticamente el piloto de 60–90 s, a menos que ocurra un bloqueo que requiera credenciales/licencia o decisión irreversible del usuario. Todo lo demás lo decide el agente siguiendo esta especificación.

Al terminar, reporta: archivos creados/cambiados, ejecutables probados, comando exacto de arranque, errores, características reales vs pendientes y rutas de vídeo/audios/previews verificados. **La misión final es producir capítulos completos desde una sinopsis mediante MCP y preservar el universo, voces, personajes, relaciones y assets entre capítulos.**

## 21. Referencias primarias para implementar (verificar APIs/condiciones al instalar)

- MCP TypeScript SDK v2: https://ts.sdk.modelcontextprotocol.io/v2/ y https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server
- Servidor MCP stdio v2: https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio
- PixiJS 8: https://pixijs.com/8.x/guides/
- Remotion: https://www.remotion.dev/docs/ y https://www.remotion.dev/docs/license/pricing
- Rhubarb Lip Sync: https://github.com/DanielSWolf/rhubarb-lip-sync
- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M
- Tone.js Offline: https://tonejs.github.io/docs/latest/functions/Offline.html
- FFmpeg: https://ffmpeg.org/

---

**FIN DE LA ESPECIFICACIÓN MAESTRA.** Este archivo es autocontenido: no necesita acceso a conversaciones anteriores para comprender el proyecto. Cualquier decisión futura que altere contratos, licencias o objetivos debe quedar registrada en `docs/DECISIONS.md` con fecha y justificación.
