# SERIES FORGE STUDIO

## Documento maestro de producto, arquitectura, implementación y continuidad para agentes de desarrollo

**Versión del documento:** 2.0 · **Fecha:** 19 de noviembre de 2026  
**Proyecto auditado:** `SeriesForge-Studio` v0.1.0 · **Idioma principal:** español · **Plataforma inicial:** Windows local  
**Estado:** especificación ejecutiva y técnica para continuar una base de código REAL. **NO** equivale a funcionalidades ya implementadas.  
**Auditoría realizada:** código fuente, README, AGENTS, ejemplos, ocho tests automatizados y contrato MCP; `npm test` 8/8 PASS en Node 22.16.0. No hay verificación visual integral del navegador ni exportación audiovisual funcional.

> **MISIÓN DEL AGENTE RECEPTOR.** Continuar el proyecto existente y convertirlo en una aplicación completa de creación de series de animación 2D/2.5D procedurales, con estudio visual, edición por chat, assets persistentes, canon narrativo, actuaciones y conversaciones, audio y vídeo final, y servidor MCP que permita producir una serie o un episodio desde una sinopsis. Implementar código y demostrarlo con pruebas y renders reales; no sustituir la aplicación por un mockup ni presentar planes como trabajo terminado.

---

## 0. Resumen de producto y experiencia final

**Series Forge Studio** es un DCC (*Digital Content Creation*) local orientado a series. Un usuario puede abrir un universo existente o crear uno nuevo y pedir por chat: «Crea un hombre de 40 años, alto, con barba, abrigo azul y expresión nerviosa». Aparece un **personaje procedural editable** en el escenario. El usuario continúa: «Hazlo más bajo, cambia el abrigo a rojo, dale una voz grave y una cicatriz; que tenga miedo a las alturas». La aplicación **edita la misma entidad**, con identidad y revisiones constantes, y conserva geometría, rig, vestuario, expresiones, voz y biografía. Se puede modificar lo mismo en el inspector y en un visor de manipulación directa.

Después el usuario puede pedir: «Crea una estación espacial abandonada, con una puerta automática y una caja de herramientas; coloca a Bruno junto a la puerta y haz que coja la llave mientras habla». La aplicación reutiliza personajes y objetos, configura las interacciones físicas, animaciones, cámaras, luces, efectos y sonido. Un agente MCP puede recibir: «Produce el episodio 2 de esta serie, de ocho minutos, a partir de esta sinopsis». El agente consulta canon, assets y herramientas, desarrolla guion/plan, anima, genera voces consistentes, mezcla, renderiza, verifica y entrega **MP4 + WAV + SRT + miniatura + proyecto editable + reporte QA**. No se recrea al personaje en cada fotograma, plano o episodio.

La ventaja de producto no es un chatbot ni un generador de GIFs: es un **universo audiovisual reutilizable y programable**, con coherencia visual, espacial, dramática y sonora a largo plazo. La IA decide *qué* debe ocurrir y modifica estructuras validadas. Un motor determinista ejecuta el *cómo*, sin consumir tokens por fotograma.

### 0.1 Principios no negociables

1. **Todo asset visual maestro es procedural.** Geometría vectorial, paths, mallas 2D, curvas, rigs, shaders y parámetros con semilla; rasterizarlo para caché está permitido. No reemplazar los personajes por imágenes generadas por IA en cada escena.
2. **Biblioteca persistente e identidad estable.** Un mismo `characterId` conserva apariencia, voz, historial y referencias. Cualquier mutación genera revisión y puede revertirse. Reutilización de escenas, assets, acciones, audio y efectos.
3. **Chat y UI modifican el mismo core.** No construir dos programas distintos: operaciones de interfaz, CLI y MCP comparten comandos, validaciones, transacciones y eventos.
4. **Narrativa persistente, causal y aprobable.** Fichas, relaciones, hechos, estados emocionales, propiedad de objetos, conocimiento y reglas del universo. Los cambios de canon solo se hacen efectivos después de validar/aceptar un episodio.
5. **Timebase exacta.** Imagen expresada en frames enteros; sonido en muestras de 48 kHz; conversiones explícitas. Un render del frame N siempre debe representar el mismo estado con la misma semilla y mismas revisiones.
6. **Local-first, Windows, sin Docker.** No depender de nube ni GPU de gran tamaño para las funciones esenciales. Los modelos de IA, TTS y proveedores remotos son adaptadores, no núcleo.
7. **Cumplimiento comercial por defecto.** Cada fuente externa (modelo, voz, sample, fuente tipográfica, textura, biblioteca) lleva licencia, versión y origen; bloquear distribuciones comerciales de origen no verificado.
8. **Calidad verificable, no demostraciones ficticias.** Para considerar completo un módulo: código ejecutable, tests y evidencia visual o audiovisual reproducible.
9. **Evitar sobrearquitectura.** Monolito modular TypeScript al principio, paquetes con fronteras limpias y contratos de dominio; sin microservicios ni distribuido hasta que exista necesidad probada.
10. **No ejecutar GitHub Actions, despliegues, PR, pushes ni servicios de pago sin una instrucción explícita.** Probar localmente para ahorrar coste de pipelines.

### 0.2 Objetivos de formato

- Versión inicial del piloto: 60–90 s, 16:9, 1920×1080, 30 FPS, estéreo 48 kHz, H.264/AAC y WAV master.
- Previsualización 540p/720p, navegación frame a frame y renders parciales.
- Objetivo posterior: episodios de 8–15 minutos, con varias localizaciones, personajes, diálogo, actuación, efectos, continuidad y producción por segmentos reanudable.
- Idioma inicial `es-ES`, con arquitectura multilingüe.
- Prioridad de experiencia: **usar chat para crear/modificar**, pero editar con inspector, viewport, rig editor, storyboard, timeline y audio mixer sin perder las modificaciones del chat.

---

## 1. Estado real del repositorio heredado

La aplicación recibida **sí funciona** como primera base local; sus limitaciones deben entenderse antes de refactorizar. No hay dependencias npm externas y se ejecuta con Node.js 20+.

### 1.1 Comandos confirmados

```powershell
cd C:\ruta\a\SeriesForge-Studio
node --version
npm test                       # 8/8 PASS en auditoría
npm start                      # abre http://127.0.0.1:4317
npm run mcp                    # MCP stdio
```

Desde Windows hay también `iniciar-estudio.cmd` e `iniciar-mcp.cmd`. Persistencia predeterminada: `data/studio.json`, sobreescribible con `STUDIO_DATA_DIR`. Por defecto el servidor escucha en `127.0.0.1:4317`, sin autenticación. El editor y MCP pueden compartir el mismo directorio de datos si se configura explícitamente.

### 1.2 Inventario de archivos y responsabilidades actuales

| Archivo | Función en v0.1 | Qué conservar / cómo evolucionarlo |
|---|---|---|
| `src/core.mjs` | Categorías, entidades, creación, patch whitelist, revisiones, guardado JSON con lock | Preservar identidades y semántica; extraer contratos y repositorios TS; migrar almacenamiento con compatibilidad |
| `src/chat.mjs` | Interpretación local de órdenes comunes y adaptador LLM opcional | Sustituir parser rudimentario por *intent → command → preview/commit*; mantener fallback local |
| `src/render.mjs` | Generador SVG de personaje, objeto, entorno y escena | Mantener como exportador vectorial/fallback y comparación de regresión; añadir runtime de rigs y PixiJS |
| `src/compile.mjs` | Compila `episode_compile_plan` y crea universo + escenas en transacción | Preservar contrato legado; versionar DSL y añadir compilador tipado, reuse/upsert y validación narrativa |
| `src/operations.mjs` | Catálogo de herramientas y despacho al core | Puerta de entrada para CLI, HTTP y MCP; separar DTO/schema y lógica de negocio |
| `src/mcp.mjs` | MCP JSON-RPC por stdio manual, conjunto limitado | Migrar al SDK oficial compatible, probando handshake y tools/call |
| `src/server.mjs` | Servidor HTTP local y endpoints de edición | Separar adaptador API del dominio, seguridad loopback, mantener endpoints durante migración |
| `public/index.html`, `app.js`, `style.css` | Editor HTML/CSS/JS con biblioteca, viewport, chat e inspector | Migración incremental a React + TypeScript y visor Pixi; no perder pantallas ni atajos |
| `data/studio.json` | Estado persistente versión 1, datos de ejemplo | Backup previo, migración versionada, no mezclar demos con universos reales |
| `examples/episode-plan.json` | Plan narrativo importable | Mantener fixture con tests de migración hacia DSL v2 |
| `tests/studio.test.mjs` | Ocho pruebas de regresión | Mantener ejecutables y ampliar; no borrar tests para hacer pasar CI |
| `docs/AGENTS_original.md` | Especificación extensa de motor audiovisual | Referencia histórica complementaria; este documento define el orden de ejecución actualizado |

### 1.3 Capacidades comprobadas / declaradas / ausentes

| Capacidad | Estado inicial | Evidencia o limitación |
|---|---|---|
| Alta/edición por chat de personajes | Funcional, acotada | Test real, comandos básicos en español, no conversación libre sin LLM |
| SVG de personajes, objetos, entornos y escenas | Funcional básico | Generadores deterministas por parámetros existentes; geometría simple |
| Fichas, atributos, voces configuradas, relaciones, recuerdos | Funcional básico | Persistencia JSON, relaciones, eventos; no simulador psicológico real |
| Interfaz visual con inspector, biblioteca y chat | Implementada | Endpoints comprobables, **sin prueba visual automatizada completa** |
| Plan de sinopsis → universo y storyboard | Funcional para `episode_compile_plan` | Transacción atómica para **crear universo nuevo**; no produce vídeo |
| Operaciones MCP por stdio | Funcionales parcialmente | `initialize`, `tools/list`, llamada de exportación; no SDK oficial completo |
| Rig articulado, IK, deformación, gestos complejos | **No implementado** | Poses SVG ilustrativas, no esqueleto ni IK real |
| Lip-sync fonético en español, TTS guardado | **No implementado** | Solo previsualización WebSpeech/WebAudio aproximada |
| Animación timeline multitrack + gestos físicos | **No implementado** | No existe evaluación frame-driven ni animaciones compuestas |
| Render MP4 con audio y música | **No implementado** | Sin renderer audiovisual real ni QA de vídeo |
| Editor React/Pixi y SQLite | **No implementado** | UI vanilla JS y JSON; futuro con migración compatibilidad |
| Director autónomo de 8–15 min | **No implementado** | Requiere runtime, guion, continuidad, jobs y QA |

### 1.4 Primera tarea obligatoria del agente

1. Leer íntegramente `README.md`, `AGENTS.md`, `docs/AGENTS_original.md`, este documento, `examples/episode-plan.json`, los módulos `src/*.mjs` y todos los tests.
2. Ejecutar `npm test`; registrar entorno, resultado y hash/commit si hay repositorio Git. Inspeccionar datos de ejemplo sin mutarlos.
3. Ejecutar `npm start` y probar manualmente el flujo completo en Windows: crear Bruno, modificar su aspecto manteniendo ID, crear un escenario, crear objeto, colocar ambos, asociar relación, generar SVG, cerrar/reabrir y confirmar persistencia.
4. Ejecutar cliente MCP real (Inspector o equivalente) y verificar lectura + escritura, junto con editor abierto y mismo storage.
5. Crear `docs/IMPLEMENTATION_STATUS.md` y `docs/DECISIONS.md`. Marcar `DONE`, `PARTIAL`, `TODO`, `BLOCKED` con evidencia. No llamar DONE a funcionalidades previstas.
6. Hacer copia `data/backups/YYYYMMDD-HHMMSS-studio-v1.json` antes de cualquier migración de esquema. Si falta un backup, detener la migración destructiva.

---

## 2. Experiencia funcional: aplicación integrada (NO consola de comandos disfrazada)

### 2.1 Estructura principal de la interfaz

La interfaz futura tendrá un **workspace persistente de producción** con: barra lateral de universo/series/episodios y librería; viewport central WYSIWYG de rig/escena; timeline inferior; panel derecho alternable `Asistente / Inspector / Narrativa / Audio / Historial`; barra de control de cámara, selección, zoom, guías, snapping y preview; consola de jobs/notificaciones no invasiva. La UI actual es el punto de partida, no se debe eliminar la capacidad de editar mediante texto en favor de una timeline puramente manual.

**Modos de trabajo:**
- **Character Studio:** constructor por chat + parámetros + manipulación del rig; guardar variantes de apariencia y ropa; vistas frontal/perfil/3/4; probar voz, gestos, poses y lip-sync.
- **World Studio:** crear entornos multicapa, objetos interactivos y sistemas de iluminación/ambiente; editar anclajes, colisiones, profundidad y puntos de entrada/salida.
- **Story Studio:** biblia de serie, cronología, personajes, relaciones dirigidas, evolución emocional, conocimiento, continuidad y eventos; diffs antes de aprobar canon.
- **Scene/Animation Studio:** colocar actores y props, bloquear acciones en timeline, cámaras, expresiones, movimientos, interacción, planos y transiciones.
- **Audio Studio:** voz de personajes, diálogos, pronunciación, visemas, SFX, ambientes, música y mezcla.
- **Production Studio:** guion, storyboard, plan, jobs, previews, validación, render, exportación, historial de episodios y presets de calidad.

### 2.2 Conversación natural como mecanismo de edición

Flujo obligatorio: **mensaje → comprensión/plan de acciones → validación → preview/diff → commit → historial/deshacer**. El agente nunca debe sobrescribir atributos no mencionados ni recrear entidades sin petición. Resuelve referencias como «él», «el hombre de la izquierda» o «esa puerta» con el asset seleccionado y contexto explícito de escena; si hay ambigüedad real, propone candidatos y pregunta, no elige silenciosamente.

Ejemplos de órdenes y resultados:

| Orden | Operación esperada |
|---|---|
| «Crea un hombre de 35 años con pelo rizado y barba, chaqueta azul» | `characters.create` con `generator`, `seed`, rig, paleta, outfit, ficha mínima y revision 1 |
| «Hazlo más alto y ponle cicatriz en el ojo izquierdo» | `characters.patch` sobre **mismo ID**, patch mínimo, preview y revisión 2 |
| «Su voz es grave, habla rápido y está algo nervioso» | Modificar `voiceProfileId`, prosodia y comportamiento; reproducir demo |
| «Crea una cocina industrial, de noche, con tres puertas» | `environments.create` con layers, anchors, colisiones y entidades de puertas parametrizadas |
| «La llave abre la puerta 2; Bruno la coge de la mesa» | Regla de prop + timeline de `reach/grasp/carry/use`, eventos y estado de posesión coherente |
| «Bruno desconfía de Vera desde lo del episodio 2» | Relación bidireccional con perspectivas independientes, evento causal y referencia al episodio |
| «En el plano 4 la cámara se acerca y Bruno sonríe sin dejar de hablar» | Tracks simultáneos para cámara, cara, mirada, boca y voz |
| «Deshaz el cambio de peinado y mantén la barba» | Revertir operación concreta con revisión nueva, no revertir toda la ficha |
| «Haz el episodio siguiente a partir de esta sinopsis» | Consultar canon, diseñar plan, validar, renderizar y presentar propuesta de commit |

**Importante:** la respuesta conversacional no puede ser la fuente de verdad. El comando validado y su evento/revisión sí lo son. Mostrar la diferencia concreta antes de cambios destructivos o ambiguos. La UI debe permitir edición manual y por chat indistintamente, con vista previa consistente.

### 2.3 Controles mínimos por módulo

- Biblioteca: búsqueda, filtros, etiquetas, favoritos, variantes, dependencia, licencia, miniaturas y revisiones; duplicar como variante sin colisionar IDs; importar/exportar paquete portable.
- Viewport: selección de entidad y hueso, pivote, manipuladores, posiciones en unidades del mundo, snapping, zoom, guías, vista de anclajes y colisiones, overlays de IK y controles de cámara.
- Inspector: campos tipados, rangos, presets, restablecer, cambios multi-atributo atómicos, diff antes/después y validación inmediata.
- Timeline: tracks de actor/pose/mirada/facial/diálogo/objeto/cámara/luz/SFX/música; zoom, scrub por frame, clips, keyframes, curvas, capas y muting.
- Narrativa: grafo dirigido de relaciones, línea temporal de hechos, conocimientos por personaje, estados propuestos/confirmados y justificación de decisiones del director.
- Historial: undo/redo local + revisiones persistentes + recuperación tras cierre; los jobs deben referenciar snapshots inmutables de assets.
- Production: preview por plano/escena/episodio, cola y progreso de jobs, incidencias, coste/recursos y exportaciones verificadas.

---

## 3. Modelo de dominio canónico y reglas de persistencia

### 3.1 Entidades y vocabulario

`Workspace`, `Series`, `Season`, `Episode`, `Sequence`, `Scene`, `Shot`, `StoryBeat`, `Character`, `CharacterVariant`, `RigDefinition`, `AnimationClip`, `ExpressionPreset`, `VoiceProfile`, `Environment`, `SetVariant`, `Prop`, `InteractionDefinition`, `SoundAsset`, `MusicCue`, `Relationship`, `CharacterState`, `WorldState`, `StoryEvent`, `CanonSnapshot`, `AssetRevision`, `ProductionJob`, `RenderArtifact`, `LicenseRecord`.

Cada entidad editable tiene `id` inmutable, `schemaVersion`, `revision` incremental, `createdAt`, `updatedAt`, `seriesId` si aplica, `generatorId`, `generatorVersion`, `seed`, `parameters`, referencias versionadas, etiquetas, autor/origen, `contentHash` y procedencia/licencias donde corresponda. No todas las entidades necesitan rig (p. ej., un `StoryEvent`); usar tipos discriminados, no una tabla gigante arbitraria.

La **fuente de verdad** es el repositorio de entidades y eventos; SVG/PNG/previews, audio resintetizado y cachés son derivados. Un `characterId` apunta a una identidad estable, pero los renders de un episodio aprobado deben apuntar a revisiones fijadas (por ejemplo `char_bruno@rev12`) para que no cambien retroactivamente.

### 3.2 Character: ficha completa y estados diferenciados

**Identidad:** nombre, edad ficticia o rango, especie/arquetipo, pronombres si procede, biografía, origen, conocimientos, habilidades, limitaciones, metas, miedos, deseos, secretos, gustos, personalidad, patrones conversacionales. **Apariencia:** anatomía parametrizada, estatura y proporciones, piel/pelaje/metal, rostro, ojos, cejas, nariz, labios, cabello, barba, cicatrices, vestuario, accesorios, paletas y variantes. **Rig:** huesos, longitudes, pivotes, límites, constraints, attachments, deformadores, sockets de manos, puntos de mirada. **Actuación:** librería de acciones, idle, locomoción, gestos, expresiones, blink, postura, tics. **Voz:** perfil fijo, proveedor/modelo/licencia, sample rate, rango, idioma, diccionario de pronunciación, estilo/prosodia, fallback. **Historia:** recuerdos, relaciones, conocimientos, motivaciones y estado emocional contextual.

Separar explícitamente:
- `CharacterDefinition`: rasgos y modelo persistentes que no cambian por escena.
- `CharacterState`: localización, vestuario actual, postura, lesión, inventario, emoción actual, cansancio, conocimiento al momento t.
- `CharacterPerformance`: instrucciones por escena/shot (qué hace y dice), sin mutar el canon durante preview.
- `CharacterAppearanceVariant`: versión visible asociada al contexto (traje espacial, armadura rota) con trazabilidad a la definición base.

**Estados emocionales no son un único enum.** Usar vector acotado (`valence`, `arousal`, `dominance`, `confidence`, `trust`, `fear`) + etiquetas narrativas y causas/eventos; distinguir emoción momentánea de relación durable. La IA puede inferir *propuestas* emocionales, pero las transiciones deben justificarse y vincularse a eventos.

### 3.3 Relación y conocimiento

`Relationship(fromCharacterId,toCharacterId,kind,trust,affection,fear,respect,conflict,notes,effectiveAt,causedByEventIds)`. Las relaciones son **dirigidas**: Bruno puede confiar en Vera sin reciprocidad. Los estados por episodio son derivados de eventos y snapshots. Cada personaje tiene `KnownFact` con fecha/situación y fuente; el director no puede escribir diálogo que revele un secreto no aprendido, salvo marcarlo como revelación explícita y actualizar canon después.

### 3.4 Canon y secuencia transaccional

Mantener `canon_before` + `episode_proposed_delta` + `canon_committed`, con `baseCanonRevision`. Un episodio que falla audio, QA o revisión narrativa **no modifica** el canon. Al aprobar, aplicar delta mediante transacción optimista: si cambió `baseCanonRevision`, resolver conflicto o recompilar. Evitar «eventos globales» sin `seriesId`, y objetos teletransportados entre escenas sin evento de movimiento.

### 3.5 Persistencia inicial y migración

Pasar gradualmente de JSON monolítico a **SQLite local con WAL**, `foreign_keys=ON`, migraciones versionadas, índices por `seriesId`, `assetId`, `revision`, `jobState`, `eventTime` y `entityId`. Mantener `/workspace/<series>/assets/`, `/episodes/`, `/renders/`, `/jobs/`, `/cache/`, `/models/`, `/exports/` para blobs y archivos grandes. Guardar rutas relativas y hashes; nunca meter vídeos/audio grandes en SQLite. Usar `content-addressed storage` para derivados e inmutabilidad por hash; limpieza de caché segura por referencias y cuotas.

**Migración segura desde v0.1:** lector `schemaVersion=1` → export/backup → validador → transformador v2 → verificación de conteos, IDs y relaciones → escritura nueva base → switch de adaptador con rollback. Mantener REST/MCP legado o un adaptador de compatibilidad hasta completar tests. Un `episode_compile_plan` antiguo no debe perder datos por campos que no existían entonces.

### 3.6 Contrato de comandos y eventos

Todos los cambios pasan por `CommandBus.execute({ commandId, idempotencyKey, expectedRevision, actor, operation, payload, dryRun })`. **No ejecutar el texto libre del modelo como código**. `dryRun` devuelve un diff y errores sin persistir. `commit` aplica una única transacción y genera `DomainEvent` con referencia al comando, entidad, revisión anterior/nueva y patches. Idempotencia evita duplicados por reintentos de MCP. Se deben poder aplicar *undo* o correcciones específicas sin borrar historia.

---
## 4. Character Studio: creación procedural de personajes de calidad

Este es el **principal diferenciador técnico** y la **primera vertical slice visual** a construir. Dibujar una silueta por SVG con cinco poses no cumple esta especificación.

### 4.1 Factory procedural reproducible

Interfaz propuesta:

```ts
interface ProceduralAsset<TParameters> {
  id: string;
  kind: 'character' | 'environment' | 'prop' | 'effect';
  schemaVersion: number;
  generatorId: string;           // p.ej. humanoid.vector.v2
  generatorVersion: string;
  seed: number;
  parameters: TParameters;
  revision: number;
  sourceLicense: LicenseRecord;
}

interface CharacterBuildResult {
  drawables: VectorLayer[];       // paths, shapes, meshes, material params
  rig: RigDefinition;
  appearanceSlots: SlotDefinition[];
  faceControls: FaceControlDefinition[];
  attachmentSockets: SocketDefinition[];
  bounds: AABB;
}
```

El primer generador **bípeda humanoide 2D estilizado** debe producir variaciones suficientemente distintivas: edad aparente, proporciones, complexión, rasgos de cara, pelo con capas, ropa, paletas y accesorios, sin pixel art ni spritesheet manual como fuente única. Añadir `robot` reutilizando un esqueleto similar; más tarde cuadrúpedos y criaturas con `RigTopology` extensible. El usuario puede elegir semilla y regenerar **solo una parte** (peinado) sin alterar cuerpo/voz/historia.

**Diseño gráfico recomendado:** estilo vectorial 2D estilizado con sombras, capas de oclusión y volumen aparente 2.5D; el estilo exacto debe ser un `StylePreset` editable a nivel de universo, no valores hardcoded. No prometer estética de estudio con el primer rig.

### 4.2 Estructura de rig

Nodos jerárquicos con pivote, transform local y world, coordenadas, Z-order, longitudes, límites y constraints. Esqueleto inicial: raíz, pelvis, torso, pecho, cuello, cabeza, hombros izquierdo/derecho, brazos, antebrazos, manos, muslos, piernas, pies, ojos, cejas, mandíbula/boca. Componentes visuales siguen esos huesos; capas de vestuario se adjuntan al rig con zonas y orden de oclusión. Evitar rotaciones que desgarren las costuras.

**Cinemática:** FK para animaciones predeterminadas; IK analítica de dos segmentos para brazos/piernas cuando encaje y FABRIK/CCD para cadenas más largas; límites anatómicos y poles para flexión de codos/rodillas; plantado de pies durante contactos; restricciones espaciales de manos al agarrar props; interpolación sin cambio brusco del codo. Las proporciones procedurales modifican también longitudes de rig, no solo `scale` global.

**Deformación:** inicialmente transformaciones de piezas vectoriales por articulación; después mallas deformables, skinning 2D, warp de tela, cabello secundario, separación de planos y sombra. Todas las deformaciones deben poder evaluarse desde `frame`, no depender de simulación incremental de tiempo real. Si hay física secundaria, precalcular y cachear por segmento con seed.

### 4.3 Expresividad facial y performance

Sistema de controles normalizados (`browRaiseL`, `browRaiseR`, `browFrown`, `eyeOpen`, `gazeX/Y`, `smile`, `jawOpen`, `mouthPucker`, `cheekRaise`, `headTilt`, `blink`) y presets combinables (alegría, enfado, miedo, sorpresa, tristeza, sarcasmo, concentración, confusión). Las expresiones tienen intensidades 0–1, no saltos discretos salvo intención artística. En un plano pueden coexistir alegría leve, ceja levantada, mirada a un objeto y visema para diálogo.

**Lip-sync:** separar shapes de boca de emociones y permitir mezcla compatible; los visemas predominan sobre apertura fonética mientras expresiones controlan comisuras y tensión. Blink y microgestos usan funciones temporales reproducibles y semilla estable.

### 4.4 Biblioteca de animaciones

`AnimationClip` independiente del personaje, enlazado a un `RigTopology` compatible. Primer conjunto: `idle`, `breathing`, `walk`, `run`, `turn`, `sit`, `stand`, `lookAt`, `point`, `wave`, `reach`, `grasp`, `carry`, `place`, `openDoor`, `react`, `nod`, `shakeHead`, `blink`, `speakGesture`. Cada clip define `durationFrames`, curvas, keyframes, loop, eventos de contacto, root motion y blend masks. Retarget por proporciones y offsets a huesos nombrados.

**Evaluación:** `evaluateCharacterAtFrame(characterRevision, performanceTracks, frame, fps, sceneContext): RigPose`. Componer base locomoción + upper-body gesture + facial + gaze + mouth; resolver conflictos por prioridad y máscaras, no ejecutar todos los clips sumando rotaciones sin control. Validar pie quieto en contacto, mano al socket de prop y límites articulares.

### 4.5 Pruebas de aceptación Character Studio

1. Crear un humano por texto con al menos ocho parámetros visuales, dos vestuarios y un accesorio; editar tres atributos sin cambiar ID ni parámetros no citados.
2. Previsualizar 8 expresiones, 9+ visemas, ojos y boca combinados, con reproducción a 30 FPS.
3. 10 segundos con caminar → detenerse → alcanzar → coger objeto → mirar y hablar, sin saltos de rig ni pérdida de objeto.
4. Cambiar proporciones de brazos y piernas y retarget de `walk/reach` sin deformaciones inaceptables; guardar clip reusable.
5. Renderizar exactamente el mismo estado con misma semilla/revisiones/frame; test de determinismo de estado y revisión visual de fotogramas.
6. Deshacer un cambio de rostro sin borrar eventos narrativos, voz, relaciones ni revisiones posteriores de otro campo.

---

## 5. World Studio: escenarios, objetos, efectos y física de interacción

### 5.1 Generador de entornos

`EnvironmentDefinition` compone zonas (`rooms/areas`), capas de profundidad (`background`, `midground`, `foreground`), geometrías vectoriales, materiales, luces estilizadas, sombras, reflejos opcionales, oclusión, puntos de acceso, nodos de navegación, elementos interactivos, anclajes y límites de cámara. Escenarios procedurales inicialmente: interior modular, calle/ciudad, bosque, laboratorio/fábrica, estación espacial. Cada seed genera un escenario reproducible; la IA puede decir «cambia solo la pared del fondo» sin regenerar muebles ni puertas.

**2.5D:** cámara ortográfica con escala/offset y parallax por plano; separaciones Z lógicas y proyección simplificada; usar profundidad coherente para que actores pasen *detrás* de mobiliario y *delante* de paredes. No se requiere pipeline 3D real. Variantes `día`, `noche`, `lluvia`, `alarma`, `apagón` deben ser capas de estado/iluminación, no copias completas del escenario.

### 5.2 PropFactory y contratos espaciales

Cada `Prop` tiene geometría paramétrica, tamaño, pivotes, colisión (AABB/polígono simple), orientación, `gripSockets` (puntos de agarre y mano válida), `placementSockets`, puntos de uso, estados finitos y acciones aceptadas. Ejemplos iniciales: llave, puerta, mesa, silla, taza, caja, libro, herramienta. Reglas: `pickupable`, `openable`, `lockable`, `usable`, `consumable`, `breakable`, `attachable`; no aplicar todas a todos los props.

**Ejemplo de máquina de estados:** puerta `closed/locked → unlocked → opening → open → closing`; transición por interacción concreta y evento con actor/llave. Un objeto sostenido pertenece temporalmente a `handSocket`, no está duplicado en el suelo. Para pasarlo a otro actor: `release` del primero + `grasp` del segundo, con posición de transición definida.

### 5.3 Sistema único de interacciones

`InteractionPlan(actorId, targetId, verb, targetSocket, startFrame, durationFrames, preconditions, postconditions, events)`. Compilador:

1. Validar proximidad o planificar recorrido a punto de acceso.
2. Mover actor/raíz según navegación y terminar estable.
3. Resolver IK de brazo/mano hacia socket objetivo.
4. Activar contacto/attach en frame exacto, actualizar escena.
5. Ejecutar cambio de estado del prop (`open`, `pickup`, `use`, `place`, etc.).
6. Emitir SFX/evento narrativo si corresponde y generar snapshot del estado final.

Asegurar consistencia entre física simplificada, dibujo y canon: la llave usada por un personaje debe aparecer en su mano, no en mesa y mano a la vez. Si la interacción falla por distancia/estado/bloqueo, devolver error planificable y sugerir corrección.

### 5.4 Animación de entorno y VFX

Efectos completamente parametrizados: polvo, humo, chispas, agua/lluvia, niebla, fuego estilizado, resplandor, pantalla holográfica, vibración de cámara, flash, luces de emergencia y motion blur donde proceda. Cada efecto es un generador con seed y `frame`; no usar `Math.random()` no sembrado durante render. Si usa GPU shaders, mantener fallback simplificado. El sonido del efecto se dispara por evento con timing explícito.

### 5.5 Validación de World Studio

Crear una fábrica nocturna con tres capas, dos puertas interactivas, una mesa y una llave; permitir mover, bloquear y abrir puerta, objeto detrás/delante de actor, parallax de cámara, lluvia y luces parpadeantes, sin incongruencias espaciales ni pérdida de estado al cerrar editor. Guardar la escena como plantilla reusable.

---

## 6. Story Studio: biblia, relaciones, dramaturgia y continuidad

### 6.1 Estructura narrativa

`SeriesBible` registra premisa, género, tono, reglas físicas/sociales, restricciones de historia, estilo, públicos, localizaciones, canon y límites (p. ej. «no existe teletransporte»). `EpisodeOutline` contiene logline, objetivos de capítulo, actos, secuencias, `StoryBeat` con objetivo → obstáculo → acción → resultado → cambio, escenas y planos. `CharacterArc` define deseos, necesidad dramática, conflicto y evolución a lo largo de episodios.

No admitir historias compuestas por escenas inconexas: cada escena debe describir **qué cambia** y cómo causa o prepara la siguiente. Antes de producir, el director ejecuta un validador narrativo que comprueba causalidad, cronología, acceso a información y coherencia física/emocional.

### 6.2 Contrato del director generativo

Orquestación por tareas estructuradas, sin confiar en un solo prompt enorme:

```text
Sinopsis + ajustes de producción
  → cargar bible / asset registry / canon_before
  → plan de actos y objetivos (StoryOutline)
  → beats con causalidad y timing objetivo
  → secuencias/escenas/plano/acciones/dialogue
  → detectar assets existentes y necesidades nuevas
  → proponer asset generation y cambios de identidad
  → validar disponibilidad, licencia y continuidad
  → TTS temporal preliminar de diálogos
  → recalcular duración en frames y blocking
  → compilar timeline, actuar, previsualizar
  → QA automática y revisión opcional
  → render final/mezcla/exportación
  → proponer delta de canon, commit solo tras aprobación
```

**Componente LLM:** usar un proveedor intercambiable (`LocalOpenAICompatible`, `RemoteAPI`, `ManualPlan`), políticas de límite de tokens, reintentos y validación JSON/schema, sin scripts arbitrarios. El agente puede iterar sobre *plans* y *assets*, no sobre cada fotograma.

### 6.3 Continuidad y reglas de conocimiento

Cada `StoryEvent` guarda `seriesId`, `episodeId`, tiempo de historia, personajes, localizaciones, inventario, cambios de relación, consecuencias, conocimiento adquirido y hechos verificables. Reconstruir `WorldState` mediante snapshots + eventos. Prohibido modificar el pasado aprobado silenciosamente. Reescribir un episodio implica rama/revisión o corrección explícita y recalcular dependencias posteriores.

Casos de test: personaje que pierde un brazo no lo recupera sin evento; dos personajes que se odian no se saludan como amigos sin reconciliación; una puerta bloqueada requiere llave o fuerza; nadie conoce un secreto antes de descubrirlo; tras un cambio de vestuario, escenas en ese mismo intervalo reflejan el estado correcto; voces no cambian entre capítulos.

### 6.4 Edición de canon mediante chat

Permitir solicitar «Bruno ahora sospecha de Vera, pero no conoce todavía su secreto». Mostrar diff en relación y `KnownFacts` y su alcance: ¿es estado general de serie o propuesta para el episodio 3? Si se refiere a ficción pasada ya aprobada, crear *retcon* explícito con advertencia de escenas afectadas y aprobación. Nunca tratar emociones como certeza inmutable sin causa.

---

## 7. Audio Studio: voces, lip-sync español, música y sonido

### 7.1 Perfil de voz por personaje

`VoiceProfile` versionado contiene `provider`, `modelId`, `voiceId`, `locale`, timbre/descripción, `pitch`, `rate`, rango expresivo, pronunciaciones personalizadas, licencia, capacidades y perfil de fallback. La **voz pertenece al personaje**, no a la escena, y las variaciones de emoción/velocidad son `VoicePerformance` por línea. El usuario puede crear un personaje sin tener TTS instalado y asignar voz más adelante; pero no declarar «voz lista para exportación» hasta sintetizar WAV real.

**Proveedores:** interfaz `TtsProvider.synthesize(input, voiceProfile, options): SpeechArtifact` con implementaciones locales opcionales: Kokoro ONNX / Piper (fallback ligero) y Qwen3-TTS si hardware/licencia/idioma lo permiten. Comparar calidad de `es-ES`, expresividad, velocidad y recursos mediante pruebas sobre hardware real. **No clonar voces de terceros sin derechos y consentimiento.** Mantener archivos y manifest de procedencia para redistribución comercial.

### 7.2 Pipeline preciso para diálogos

1. Producir texto de diálogo con `speechAct`, intención, emoción, ritmo, énfasis, pausas y pronunciación.
2. Sintetizar PCM/WAV persistente, normalizar sample rate a 48 kHz y registrar muestras exactas.
3. Obtener alineación palabra → segmento temporal y, cuando sea posible, fonema → intervalo. **Para español NO utilizar Rhubarb como fuente fonética principal**: su reconocimiento por voz está orientado al inglés; si se mantiene, solo como fallback aproximado o referencia. Evaluar alineadores multilingües (p. ej. WhisperX + alineador español o modelos de alineación forzada apropiados) y/o marcas fonéticas del TTS; validar precisión sobre audio real en español.
4. Transformar fonemas a visemas de rig (`silence`, `closed`, `open`, `wide`, `rounded`, `teeth`, `tongue`, etc.), con curvas de coarticulación y blending de emoción.
5. El audio WAV fija duración de línea; el vídeo adapta acción, pausas y lipsync con ese timing, no al revés.
6. Cachear por hash de `text + voiceRevision + providerVersion + prosody + pronunciation`; cambios de cámara/ropa no invalidan voz.
7. Crear SRT desde segmentos **medidos**, no estimados por número de palabras.

**QA lip-sync:** testear al menos 20 frases de español con plosivas, bilabiales, vocales abiertas/cerradas y silencios; inspeccionar frames representativos, desincronía audible y duración. No prometer precisión automática perfecta; permitir ajustar manualmente visemas y pausas en editor.

### 7.3 SFX y ambientes

`SoundEvent` disparado por escena/acción a muestras o frames, con selección de receta procedural DSP (pasos, clics, puertas, maquinaria, viento, impactos, beep, explosión estilizada), intensidad, distancia, paneo y variación por seed. `EnvironmentAudioBed` para ambiente continuo por lugar. Mantener biblioteca de sonidos *originales o con licencia verificable*, no depender de clips web con derechos inciertos. Alternativa: síntesis programática con osciladores/ruido filtrado/envolventes, luego WAV PCM cacheado.

### 7.4 Música

`MusicCue` con intención (tensión, humor, transición, clímax), tempo, compás, tonalidad, instrumentación, capas, dinámica y puntos de entrada/salida sincronizados con beats narrativos. Primer motor: música incidental procedural simple mediante síntesis/SoundFonts licenciados (Tone.js Offline si su render offline es fiable); no utilizar melodías protegidas ni reproducir música existente. Generación melódica coherente por tema de personaje/lugar, seed y variaciones, sin depender de IA por muestra.

### 7.5 Mezcla offline

Bus separado `dialogue`, `sfx`, `ambience`, `music`; normalización por stem, ducking de música bajo diálogos, panning, fades, reverberación ligera por localización, limitador y master stereo 48 kHz. Exportación de `audio-master.wav`, stems opcionales y AAC final; conservar transcripción por línea y licencias. El proyecto debe poder reproducir la mezcla parcial sin regenerar renders gráficos.

---

## 8. Animation/Scene DSL: contrato entre IA y motor

**No generar código TypeScript a demanda como formato principal de episodios.** El agente debe producir un JSON estricto y versionado, con IDs lógicos y referencias a entidades existentes; el compilador lo valida, completa defaults, reserva revisiones, resuelve dependencias y produce `CompiledTimeline`.

### 8.1 Núcleo de formato sugerido

```json
{
  "schemaVersion": 2,
  "episodeId": "ep_002",
  "seriesId": "series_fabrica",
  "baseCanonRevision": 8,
  "title": "La llave del ascensor",
  "synopsis": "Bruno y Vera buscan una salida antes de que cierre la fábrica.",
  "fps": 30,
  "resolution": {"width": 1920, "height": 1080},
  "targetDurationFrames": 1800,
  "stylePresetId": "style_vector_narrativo",
  "scenes": [{
    "id": "scene_01",
    "environment": {"id": "set_factory", "revision": 4},
    "startFrame": 0,
    "durationFrames": 420,
    "characters": [
      {"id": "char_bruno", "revision": 12, "spawnSocket": "entry_left"},
      {"id": "char_vera", "revision": 5, "spawnSocket": "desk_right"}
    ],
    "props": [{"id": "prop_key", "revision": 2, "initialState": "on_table"}],
    "shots": [{
      "id": "shot_001", "startFrame": 0, "durationFrames": 180,
      "cameraTrack": [{"frame": 0, "x": 0, "y": 0, "zoom": 1},
                      {"frame": 150, "x": 80, "y": -12, "zoom": 1.18}],
      "tracks": [
        {"target": "char_bruno", "channel": "body", "clips": [{"action": "walk", "startFrame": 6, "durationFrames": 54}]},
        {"target": "char_bruno", "channel": "expression", "clips": [{"preset": "anxious", "startFrame": 30, "durationFrames": 150, "intensity": 0.7}]},
        {"target": "char_bruno", "channel": "gaze", "clips": [{"lookAt": "prop_key", "startFrame": 72, "durationFrames": 80}]}
      ],
      "dialogues": [{"characterId": "char_bruno", "text": "Ahí está la llave.", "emotion": "fear", "startFrameHint": 80}],
      "interactions": [{"actorId": "char_vera", "targetId": "prop_key", "verb": "pickup", "startFrame": 96}],
      "soundEvents": [{"presetId": "sfx_metal_click", "startFrame": 128}],
      "storyBeats": ["Bruno encuentra la llave", "Vera la recoge"]
    }]
  }],
  "proposedCanonDelta": [
    {"type": "inventory.transfer", "propId": "prop_key", "to": "char_vera", "causedBy": "scene_01"}
  ]
}
```

*Ejemplo de contrato objetivo, no de formato implementado actualmente.* Los nombres de canales y events se versionan con Zod. No dejar campos arbitrarios ejecutables; extensiones mediante plugins registrados explícitamente y contratos tipados. Todos los `startFrame` son relativos al shot/scene según esquema; especificar de forma inequívoca y convertir a un timeline global compilado.

### 8.2 Compilación y detección de conflictos

El compilador verifica: existencias/revisiones, assets licenciados, rig compatible con acción, actor presente en escena, espacio/oclusiones, poses y constraints, propiedad de props, diálogo asignado a actor, solapes de canales conflictivos, duración TTS conocida y tiempos no negativos. Un `ShotPlan` puede producir múltiples `RenderSegment`s pero no debe alterar el canon. Errores deben indicar `path` JSON, código, entidad e intento de reparación; nunca interpretar `undefined` como un personaje alternativo.

**Timing real:** el LLM propone beats y duración estimada; el compilador adapta timeline al WAV sintetizado y puede pedir un nuevo corte si la escena desborda. El cierre del plano tiene una política explícita: hold, cut, reflow, extend scene o error. No cortar frases para satisfacer una duración arbitraria sin consentimiento.

### 8.3 Evaluación por frame

```ts
interface CompiledFrameState {
  frame: number;
  actors: Array<{characterId: string; rigPose: RigPose; facial: FacialPose; z: number}>;
  props: Array<{propId: string; transform: Transform2D; state: string}>;
  camera: CameraState;
  effects: EffectState[];
  visualEvents: VisualEvent[];
}
function evaluateSceneAtFrame(scene: CompiledScene, frame: number): CompiledFrameState;
```

Sin `setInterval`, `requestAnimationFrame`, `Date.now()` o random no sembrado para decidir la pose final. La previsualización puede usar un ticker para avanzar *qué frame presentar*, pero `evaluateSceneAtFrame(120)` y `evaluateSceneAtFrame(120)` han de dar el mismo estado independientemente de qué otros frames se evaluaron. Eventos de audio se fijan por timeline; la evaluación gráfica no dispara nuevos sonidos al repetir un frame.

---

## 9. Motor gráfico, composición y exportación de vídeo

### 9.1 Stack decidido y frontera de responsabilidades

- **TypeScript + Node.js LTS:** contratos, repositorios, jobs, compilador, API, MCP, tools, lógica pura.
- **React + TypeScript:** interfaz de estudio; no es el motor de fotogramas.
- **PixiJS 8:** render del scene graph 2D/2.5D, geometría, mallas y filtros; animación evaluada desde estado puro.
- **Remotion:** composición temporal, montaje, subtítulos y salida audiovisual si la integración captura el canvas correctamente.
- **FFmpeg/ffprobe:** ensamblado, audio, transcodificación, inspección y QA de medios.
- **SQLite:** canon, revisiones, jobs, eventos y metadatos; assets grandes y caché en filesystem.
- **MCP SDK TypeScript v2 oficial:** API de herramientas del agente mediante stdio (y HTTP autenticado solo si hay necesidad).
- **TTS, alineación y DSP:** adaptadores separados, con fallback local, licencias verificadas.

No hacer de Rive el editor maestro ni depender de Spine/Live2D sin verificar licencias y automatización. Se puede ofrecer importador/adaptador, pero la fuente canónica de personajes será el rig procedural propio.

### 9.2 Experimento obligatorio antes de acoplar Pixi + Remotion

Construir **un clip mínimo real de 5–10 segundos**: humano rigged, cámara que se acerca, brazo que señala y círculo/objeto en movimiento, render a MP4. Dos rutas bajo interfaz `FrameRenderer`:

A. PixiJS en Chromium, evaluación explícita por frame y captura desde Remotion.
B. PixiJS en worker/headless Chromium o renderer de frames PNG → FFmpeg, con timeline y mezcla gestionados por composición superior.

Medir fidelidad, estabilidad de WebGL/Canvas, reproducibilidad, velocidad y consumo. Elegir tras prueba A/B. No afirmar que un `<canvas>` integrado por defecto se captura siempre correctamente: verificar un MP4 en disco y frames leídos con ffprobe/ffmpeg. Usar barreras para assets/shaders/preparación antes de capturar. Separar `IFrameRenderer`, `IAudioRenderer` y `IVideoAssembler` para cambiar la ruta sin rehacer rigs ni DSL.

### 9.3 Pipeline de salida

```text
Canonical Episode DSL (schema v2)
 → validate + compile (freeze asset revisions)
 → generate/cached WAV dialogue, SFX, music + timings
 → render segment frames [startFrame, endFrame)
 → encode scene/video segment + checksum + manifest
 → concat/mux segments + offline master audio
 → create SRT + thumbnail + metadata + editable project
 → ffprobe verify + sample screenshots/contact sheet + narrative QA
 → job COMPLETE (canon no aprobado todavía)
 → accept episode → atomic canon commit
```

**Segmentación:** dividir por shots/escenas o grupos estables de frames, checkpoint en cada segmento, reutilizar caches cuando cambie una sola línea/prop/cámara. Hash de dependencias de segmento: `scene DSL + asset revisions + renderer version + preset + seed + effects`. Reanudar tras apagón sin recomenzar la serie completa. No confundir cache de previews con render final.

### 9.4 Salidas obligatorias por episodio

```text
workspace/series/<seriesId>/episodes/<episodeId>/
  outline.json
  episode-plan.json
  compiled-timeline.json
  assets.lock.json
  audio/dialogue/*.wav
  audio/sfx/*.wav
  audio/music/*.wav
  renders/segments/*
  previews/*
  output/episode.mp4
  output/audio-master.wav
  output/subtitles.srt
  output/thumbnail.png
  output/metadata.json
  output/project.seriesforge.json
  output/license-manifest.json
  qa-report.json
  proposed-canon-delta.json
```

Metadatos en salida: resolución, fps, duración real, sample rate, códecs, hash, fecha, revisiones fijadas, licencias, costes de modelos usados y QA. No devolver una ruta inexistente como éxito.

### 9.5 Rendimiento local y coste

Objetivos de ingeniería: usar `asset cache`, renders parciales, CPU/GPU limitados por configuración, cola con 1 job grande por defecto, TTS por línea solo si cambia, snapshots inmutables, limpieza por LRU y trabajos reanudables. No usar un LLM durante generación de frames. Incluir `doctor` de GPU/VRAM/RAM/disco y benchmark en hardware del usuario antes de prometer tiempos de capítulos largos. No ofrecer estimaciones universales de render ni calidad sin mediciones.

---
## 10. MCP: control de alto nivel y herramientas finas para un agente de IA

El MCP es un **adaptador de aplicación**; no contiene lógica narrativa ni de generación. Web UI, CLI y MCP invocan exactamente el mismo `ApplicationService` y reciben resultados tipados. Los nombres legados de v0.1 pueden mantenerse como aliases durante migración, pero la API nueva debe emplear nombres semánticos consistentes.

### 10.1 Herramientas actuales que NO deben desaparecer

`studio_status`, `studio_get_state`, `studio_chat`, `asset_list`, `asset_get`, `character_create`, `environment_create`, `object_create`, `series_create`, `scene_create`, `asset_patch`, `character_relationship`, `story_event_add`, `scene_add_actor`, `scene_add_object`, `scene_set_actor`, `scene_add_dialogue`, `asset_render_svg`, `episode_compile_plan`.

Su compatibilidad actual es limitada y `episode_compile_plan` **crea una serie nueva**, no «continúa la existente». La evolución debe definir `reuseExisting`, `seriesId`, `expectedCanonRevision` y políticas explícitas para resolver/crear assets, sin duplicar el universo ni romper llamadas existentes.

### 10.2 Catálogo propuesto v2

| Dominio | Herramienta MCP | Resultado |
|---|---|---|
| Diagnóstico | `system.inspect`, `system.doctor` | Versión, capacidades reales, audio/GPU, dependencias y licencias |
| Proyecto | `workspace.open`, `workspace.snapshot`, `workspace.export` | Estado actual, snapshots, exportación portable |
| Universo | `series.create`, `series.get`, `series.update_bible`, `series.get_canon` | Biblia, estilo, reglas y revisiones de canon |
| Personajes | `characters.create`, `characters.get`, `characters.patch`, `characters.preview` | Ficha, rig, voz, revisiones, preview |
| Personajes | `characters.set_voice`, `characters.set_expression`, `characters.preview_animation` | Voz y actuación demostrables |
| Escenarios | `environments.create`, `environments.patch`, `environments.preview` | Set procedural, capas, anchors y variantes |
| Props | `props.create`, `props.patch`, `props.define_interaction` | Geometría y máquina de estados |
| Animaciones | `animations.create`, `animations.preview`, `animations.retarget` | Clip reusable, keyframes y rig compatible |
| Historia | `story.characters_relationships`, `story.add_event`, `story.validate_canon` | Relaciones, hechos y chequeos narrativos |
| Historia | `story.propose_canon_delta`, `story.commit_canon_delta` | Cambios narrativos separados, con aceptación explícita |
| Escenas | `scenes.create`, `scenes.place_actor`, `scenes.place_prop`, `scenes.add_action` | Blocking, poses, interacciones y timeline |
| Escenas | `scenes.add_dialogue`, `scenes.preview_shot` | Diálogos, lipsync y preview del plano |
| Audio | `audio.voices_list`, `audio.synthesize`, `audio.align`, `audio.mix_preview` | WAV y visemas medidos, mezcla offline |
| Episodio | `episodes.plan_from_synopsis`, `episodes.validate_plan` | Storyboard/DSL validado y estimación de recursos |
| Producción | `episodes.preview`, `episodes.produce_from_synopsis`, `episodes.render` | Job reanudable con archivos reales |
| QA | `episodes.verify`, `episodes.diff` | ffprobe, calidad narrativa/visual/sonora, diferencias |
| Jobs | `jobs.get`, `jobs.list`, `jobs.cancel`, `jobs.resume`, `jobs.artifacts` | Progreso, errores y salidas verificadas |

Usar `resources` MCP para fichas, catálogos, series, jobs y reportes y `prompts` MCP para workflows frecuentes si mejora la ergonomía. Mantener herramientas de alta granularidad para correcciones sin volver a producir todo un episodio. Exponer **resultados estructurados**, errores con códigos, relaciones padre-hijo y rutas relativas seguras.

### 10.3 Semántica de producción asíncrona

`episodes.produce_from_synopsis` crea un job y devuelve **rápidamente** `jobId` y un estado (`QUEUED`, `PLANNING`, `BUILDING_ASSETS`, `AUDIO`, `COMPILING`, `RENDERING`, `MIXING`, `VERIFYING`, `READY_FOR_APPROVAL`, `COMPLETE`, `PARTIAL`, `FAILED`, `CANCELLED`). El agente consulta `jobs.get` / recursos de progreso; `cancel` mantiene artefactos válidos. Cada fase tiene idempotencia y checkpoints. Un job que termina con plan pero sin MP4 debe marcarse `PARTIAL`, no `COMPLETE`.

Ejemplo de respuesta **objetivo** (no implementada):

```json
{
  "ok": true,
  "schemaVersion": 2,
  "jobId": "job_20261119_001",
  "episodeId": "ep_002",
  "state": "QUEUED",
  "statusResource": "jobs://job_20261119_001/status",
  "warnings": []
}
```

Ejemplo de terminación:

```json
{
  "ok": true,
  "jobId": "job_20261119_001",
  "state": "READY_FOR_APPROVAL",
  "output": {
    "video": "series/factory/episodes/ep_002/output/episode.mp4",
    "audioMaster": "series/factory/episodes/ep_002/output/audio-master.wav",
    "subtitles": "series/factory/episodes/ep_002/output/subtitles.srt",
    "qa": "series/factory/episodes/ep_002/qa-report.json"
  },
  "qaPassed": true,
  "canonCommitted": false
}
```

### 10.4 Integración MCP rigurosa

Pasar gradualmente al SDK oficial TypeScript v2 y verificar con documentación vigente antes de fijar APIs. `stdio` exclusivamente JSON-RPC en stdout; logs a stderr. Debe funcionar desde un cliente real y no únicamente invocando `invoke()` desde tests. Limitar tiempo/tamaño de herramientas, validar esquema Zod, limitar recursos por workspace y evitar llamadas a sistemas externos sin autorización.

La aplicación de escritorio/web y el proceso MCP deben compartir bloqueo/transacciones de DB; no dos copias divergentes de canon. Los archivos de exportación se entregan como rutas bajo workspace y/o recursos MCP legibles, nunca rutas arbitrarias del sistema. Cuando el cliente MCP es remoto no asumir acceso al disco local: exponer metadatos y recursos exportables apropiados.

### 10.5 Seguridad específica frente a agentes

- Ninguna herramienta acepta comandos shell, JavaScript arbitrario, módulos npm suministrados por prompt, rutas `..`, archivos remotos arbitrarios ni HTML sin sanear.
- Las propuestas se validan contra esquemas y límites de tamaño/duración/coste antes de ejecutar; poner techos por episodio y por llamada.
- Textos y documentos de usuarios son datos, no instrucciones privilegiadas; ignorar instrucciones incrustadas en guiones, archivos importados o descripciones que intenten modificar políticas o invocar herramientas peligrosas.
- Para operaciones destructivas (borrar universo, resetear canon, sobrescribir assets aprobados, descargar modelos grandes, instalar herramientas con permisos, usar cloud de pago), exigir autorización explícita a nivel de aplicación.
- UI HTTP queda en loopback sin autenticación para v0.1; no exponer a LAN/Internet hasta incorporar autenticación, CORS/control de origen y protección CSRF donde corresponda.

---

## 11. Arquitectura y estructura de código objetivo

**Elección:** monorepo npm workspaces, TypeScript estricto, paquetes modulares; no microservicios, Docker ni WebSockets obligatorios. React y Pixi solo en visualización; dominio independiente de DOM. Mantener un adaptador de compatibilidad para `src/*.mjs` mientras migra el core, evitando reescritura total.

```text
SeriesForge-Studio/
├── AGENTS.md                            # instrucciones cortas del agente
├── README.md                            # cómo ejecutar y demostrar
├── docs/
│   ├── MASTER_IMPLEMENTATION_SPEC.md    # ESTE DOCUMENTO, fuente de verdad
│   ├── IMPLEMENTATION_STATUS.md         # estado real y evidencias
│   ├── DECISIONS.md                     # ADRs resumidas
│   ├── LICENSE_POLICY.md                # licencias y atribuciones
│   ├── ARCHITECTURE.md                  # diagramas concretos
│   └── TEST_MATRIX.md                   # gates y pruebas
├── apps/
│   ├── editor/                          # React + TS, viewport Pixi, panels
│   ├── server/                          # HTTP localhost, API app services
│   ├── mcp/                             # MCP TypeScript SDK stdio
│   └── cli/                             # doctor, migrate, render, demo
├── packages/
│   ├── contracts/                       # Zod, tipos, DSL, eventos
│   ├── domain/                          # entidades, canon y reglas
│   ├── application/                     # commands, queries, transactions
│   ├── persistence/                     # SQLite repos + migration v1
│   ├── procedural/                      # asset factories vectoriales
│   ├── rig/                             # huesos, FK, IK, deformación
│   ├── animation/                       # tracks, clips, blend, constraints
│   ├── world/                           # escenarios, props, interacciones
│   ├── narrative/                       # story bible, knowledge, QA
│   ├── audio/                           # TTS, align, visemes, DSP, mixing
│   ├── compositor/                      # camera, scene graph, subtitles
│   ├── render/                           # Pixi adapter, Remotion, FFmpeg
│   ├── jobs/                            # cola, checkpoints, idempotencia
│   └── llm/                             # providers, prompts, plan validators
├── workspace/                           # datos de usuario (gitignored)
├── tools/                               # binarios locales descargados con control
├── models/                              # TTS/alignment (gitignored)
├── examples/                            # series/escenas/demo reproducibles
├── tests/                               # unit, integration, E2E, media
└── scripts/
    ├── setup-windows.ps1
    ├── doctor.ps1
    └── make-pilot.ps1
```

**Nota de migración:** esta es estructura objetivo, no se debe crear decenas de paquetes vacíos. Extraer primero `contracts/domain/application`, después `procedural/rig/render`, y añadir los demás **cuando exista código real y tests**. Mantener `src/` y `public/` operativos hasta que sus nuevas implementaciones pasen el mismo set de pruebas de regresión.

### 11.1 Límites arquitectónicos

`Domain` no importa Pixi, React, Remotion, FFmpeg, SDK MCP, HTTP ni proveedores de IA. `Application` define los casos de uso. `Infrastructure` implementa puertos `AssetRepository`, `CanonRepository`, `VoiceProvider`, `FrameRenderer`, `VideoAssembler`, `ObjectStore` y `LLMProvider`. El editor y MCP reciben DTOs, nunca modifican SQLite o filesystem por su cuenta. `Animation` opera sobre tipos de rig genéricos y `CompiledFrameState`; Pixi interpreta ese estado visual.

### 11.2 Revisión, caché y control de concurrencia

Revisiones incrementales y `expectedRevision` en todo `patch`. `RenderJob` apunta a un lockfile de revisiones. Modificaciones del usuario mientras se renderiza **no alteran** el episodio en curso. El contenido de una revisión se identifica por hash y se comprueba en lectura. SQLite con WAL permite lectura concurrente y un escritor ordenado; cola de comandos para evitar carreras entre chat/editor/MCP. No actualizar `studio.json` y SQLite en paralelo como fuentes de verdad sin un procedimiento transaccional de migración.

### 11.3 Observabilidad

Registrar `jobId`, `seriesId`, `episodeId`, fase, tiempos, consumo de RAM/VRAM, cache hits/misses, segundos de audio, imágenes/frames procesados, tamaño de archivos, errores con stack en logs locales y códigos estructurados en UI/MCP. Evitar registrar claves de proveedores o prompts privados por defecto. Exportar `diagnostics.zip` sin secretos para soporte.

---

## 12. Plan de ejecución real: prioridades y entregas independientes

**Regla:** entregar vertical slices ejecutables de punta a punta; no desarrollar primero 40 esquemas, 20 pantallas y cinco proveedores TTS sin lograr que un personaje articulado pueda caminar y hablar. Cada hito debe dejar el estudio funcionando.

| Etapa | Prioridad | Implementación concreta | Condición de salida |
|---|---|---|---|
| **P0 — Estabilizar v0.1** | Inmediata | Auditar, backup, docs de estado, test MCP/UI/HTTP, límites de seguridad, protección de datos, migraciones planeadas | 8 tests existentes pasan y flujos manuales documentados |
| **P1 — Contratos + rig procedural** | Máxima | TS strict, esquemas versionados, CharacterFactory avanzada, huesos, FK/IK, poses, expresiones, accesorios; visor Pixi mínimo | Personaje generado por chat conserva ID; caminar + alcanzar con IK visible |
| **P2 — Scene runtime y props** | Muy alta | Timeline determinista, cámara, escenario multicapa, socket de mano, puertas y objetos, render frame-driven y preview | Interacción coherente: entrar, coger llave, abrir puerta y reaccionar |
| **P3 — Primer MP4 mudo** | Muy alta | Spike Pixi+Remotion, fallback frames+FFmpeg, QA por ffprobe, caching | Clip real 5–10 s con personaje, cámara, objeto y efecto |
| **P4 — Audio real y boca** | Alta | TTS español local, perfil por personaje, WAV cacheado, alineación, visemas, SFX y mezcla | Clip 20–30 s dialogado con audio reproducible y boca acompasada |
| **P5 — Editor integrado** | Alta | React/TS gradual, chat→diff→commit, inspector, timeline, undo/redo, selección/rig edit, biblioteca | Crear/editar desde chat e inspector sin inconsistencias; guardar/cargar |
| **P6 — Narrativa/Director** | Alta | Canon, conocimiento, relaciones, beats, DSL v2, snapshots, plan desde sinopsis, validadores | Dos episodios consecutivos de prueba sin contradicciones de continuidad |
| **P7 — MCP v2 y jobs** | Alta | SDK oficial, API v2, producción reanudable, idempotencia, cancelación, recursos | Cliente MCP real crea/edita y produce clip; recuperación tras interrupción |
| **P8 — Piloto completo** | Gate de producto | 60–90 s, varios planos, 2 personajes, interacción, voz, música/SFX, subtítulos, QA y export | MP4+WAV+SRT+proyecto+reporte; revisión visual aprobada |
| **P9 — 3–5 min** | Optimización | Corrección de ritmo, caché incremental, escenas complejas, edición de voz, reparaciones de planos | Episodio 3–5 min sin glitches graves ni fallos al reanudar |
| **P10 — 8–15 min** | Objetivo final | Parallel render local acotado, act structure, continuidad robusta, memory/QA e instrumentación | Episodio de 8–15 min de calidad aceptable verificado, no solo compilado |

**Orden especial:** aunque P5 agrupe UI avanzada, el agente **debe mantener y mejorar una UI útil desde P1**. El creador de personajes por chat + visor es la primera funcionalidad demostrable al usuario. El experimento de MP4 P3 debe anticiparse si detecta un posible bloqueo técnico Pixi/Remotion; puede desarrollarse en paralelo, sin hipotecar contratos de dominio.

### 12.1 Primer sprint técnico que debe ejecutar el siguiente agente

**No es un pedido de diseñar un plan; es una instrucción de implementación.**

1. Instalar/validar Node.js, npm, Git, FFmpeg/ffprobe y soporte GPU local sin Docker; crear `npm run doctor` con reporte reproducible. No descargar TTS pesados todavía.
2. Conservar ocho tests; introducir Vitest/TypeScript/Zod solo donde haya uso real; export/import fixture v0.1 y tests de migración.
3. Implementar modelo tipado `CharacterDefinitionV2`, `RigDefinition`, `RigPose`, `AnimationClip`, `AssetRevision` y tests de serialización y validación, sin alterar IDs actuales.
4. Crear un `HumanoidRigBuilder` procedural con pivotes, capas visuales, ropa y al menos FK + IK de brazo; visualizar en el editor (PixiJS). Mantener `SVG` como exportador de fallback; permitir elegir «nuevo rig» o transformar personaje legado preservando identidad.
5. Introducir `AnimationRuntime.evaluateAtFrame` y tres clips reproducibles: idle, caminar y alcanzar; unirlo a un prop sencillo con `gripSocket` y fijación de manos.
6. Extender conversación: «Crea Bruno...», «hazlo más alto...», «hazle coger la llave». Mostrar patch/diff y preview; garantizar que no se modifican biografía/voz si el usuario solo cambia peinado.
7. Renderizar un pequeño vídeo de prueba usando la ruta elegida y verificar salida con `ffprobe`; si no se logra, documentar bloqueo y conservar prueba de frames/PNG, sin declarar completada la fase.
8. Ejecutar QA, añadir vídeo/frames/imagenes reproducibles a `examples/` y actualizar `docs/IMPLEMENTATION_STATUS.md` con fecha, comandos, rutas y LIMITACIONES verificadas.

**Definition of Done sprint 1:** desde el editor y desde MCP puedo crear/modificar un personaje con rig 2D articulado, reproducir animación por frames y obtener evidencia visual real. No se permite cerrar el sprint con un modelado JSON sin viewport ni pruebas de movimiento.

### 12.2 Criterios de progreso cuantificables (no confundir objetivos con promesas)

- **P1:** 1 humanoide parametrizable, 1 robot variante, 2 outfits, 8 expresiones y pruebas rig IK. Probar visualmente al menos walk y reach.
- **P2:** 1 entorno con al menos 3 planos, 3 tipos de props, 2 interacciones y 2 movimientos de cámara.
- **P4:** 2 perfiles de voz estables, 20 frases es-ES con WAV, visemas y mezcla SFX.
- **P8:** >=2 personajes, >=1 entorno, >=3 props, >=3 planos, diálogo sincronizado, música/ambiente/SFX, continuidad verificable y archivos finales reales.
- **P10:** 8–15 min de metraje real y pruebas de reanudación, desincronía y canon, evaluadas en equipo local.

---

## 13. Plan de pruebas y Quality Gates

### 13.1 Software

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` ejecutados **localmente** y reproducibles con lockfile; no declarar PASS si no se ejecutan.
- Tests unitarios: generadores deterministas, seed/revisión, transformaciones, clamps de ángulos, FK/IK, blending de animación, constraints, capas/oclusiones, interpolación por frame, estados de props y validación Zod.
- Property-based: entrada válida → salida estable; repeated frame equality; mismo `seed+generatorVersion+params` → mismo `contentHash` (salvo metadata temporal fuera del hash); `expectedRevision` rechaza cambios obsoletos.
- Tests de integración: escena por chat/inspector/MCP termina con el mismo estado, persistencia de datos, SQLite migration, backups, audio y video, recuperación de jobs.
- E2E navegador local: crear personaje, modificar color, comprobar diff, undo, editar rig, escena, escuchar WAV y render preview; screenshots reales comparados con tolerancias documentadas.

### 13.2 QA audiovisual

- Verificar con `ffprobe`: duración, fps, width/height, codec, audio stream, sample rate; detectar archivos truncados/corruptos.
- Contact sheet de cortes, frames en 0/25/50/75/100 % y alrededor de interacciones; revisar pies flotando, clipping, objeto duplicado y solapes.
- Auditar audio: silencios no deseados, clipping, continuidad de ganancia, voces correctas, subtítulos alineados, SFX en puntos correctos, música no enmascara diálogo.
- Validar lipsync por muestras representativas; tolerancias acordadas por producto, medición automática acompañada de inspección humana. No confundir transcripción correcta con boca correcta.
- Canon: dos episodios con consecuencia persistida, inventario, conocimiento, voz, relaciones y lesiones, con *commit* solo tras aprobación.
- Medir tiempo por frame, tamaño de caché y memoria con proyectos pequeños/medianos; probar cancel/resume y fallo inducido de FFmpeg/TTS.

### 13.3 Seguridad/licencias

- Tests de paths fuera de workspace, `__proto__`, parámetros negativos/excesivos, XML/HTML injection, LLM malformed JSON, prompts hostiles, texturas no autorizadas, longitud de diálogos, bombs de frame count y trabajo concurrente excesivo.
- Tests de licencias: un `soundfont` sin `commercialAllowed` provoca bloqueo de exportación comercial, no warning ignorado. Generador procedural 100 % propio sin dependencias externas debe registrar origen interno.
- Test de red: no expuesto a LAN por defecto; stdout MCP limpio; claves API solo en backend.

### 13.4 Evidencia obligatoria para cada entrega

| Evidencia | Formato | Se considera suficiente si… |
|---|---|---|
| Tests | `npm test` + registro | Se ejecutó contra implementación real y no hay skips ocultos |
| Render visual | PNG/SVG/MP4 | Archivo existe, se abre y representa la funcionalidad requerida |
| Audio | WAV/MP3/MP4 | Se escucha voz/SFX reales, no solo `speechSynthesis` del navegador |
| MCP | Captura de `tools/list` y `tools/call` | Cliente externo real realiza la operación |
| Persistencia | Backup + reload | Los IDs, revisiones y relaciones se preservan |
| Narrativa | Canon before/delta/after | Transiciones causales y aprobadas sin contradicciones |
| Documentación | `IMPLEMENTATION_STATUS.md` | Estado honesto de DONE/PARTIAL/TODO/BLOCKED con evidencia |

---

## 14. Integración de IA y controles de calidad del director

La creatividad procede del modelo conectado al estudio, pero el proyecto no debe depender de un proveedor concreto, ni entrenar un modelo propio. `LLMProvider` intercambiable + prompts versionados + herramientas MCP tipadas + validación de salida. Planificador narrativo, diseñador de assets, bloqueador de escena, director de voz/gestos y revisor de continuidad pueden ser **roles lógicos del mismo agente**, no cinco servicios de IA residentes.

La IA debe construir un *plan de cambios* comprobable y reusable. Si no hay TTS o falta un asset, produce un diagnóstico y pregunta solo por decisiones irresolubles; puede usar presets o assets autorizados cuando estén disponibles. Mantener sistema de aprobación configurable: `auto` para previews/episdodios no comerciales y `manual` para canon, gastos, sustituciones destructivas y publicación comercial. Establecer presupuesto opcional de tokens/coste y resumen de consumo; cachear planificación repetida.

**Nunca usar generación por imagen a imagen como método de animación.** Si se decide ofrecer texturas auxiliares por IA, deben ser *opcionales* y no romper el contrato procedural ni la licencia comercial.

---

## 15. Dependencias, licencias y decisiones técnicas verificables

| Integración | Política de incorporación | Riesgo a gestionar |
|---|---|---|
| TypeScript/Node | LTS actual validado por `doctor`, lockfile, scripts PowerShell | Diferencias entorno Windows y versiones npm |
| PixiJS 8 | Adaptador separado y prueba de captura por frame | GPU/WebGL, shaders y diferencias de salida |
| Remotion | Integración solo tras test Pixi→MP4; verificar condiciones de licencia para comercialización/SaaS | Licencia variable según uso/tamaño/equipo |
| FFmpeg | Binario local hash verificado; documentar compilación/licencia/códecs | LGPL/GPL, distribución de ejecutables, códecs |
| MCP TypeScript SDK v2 | Usar docs oficiales y test con cliente real | Cambios de transporte/schemas durante migración |
| TTS local | Modelo elegido por prueba de voz española, expresión, velocidad, licencia | Calidad, RAM/VRAM y licencias por modelo/voz |
| Alineación español | Evaluar pipeline multilingüe, no dar por suficiente Rhubarb | Desincronización y fonemización real |
| Tone.js Offline/DSP | Usar para sintetizar y mezclar solo tras prueba offline | Diferencias entre navegador/Node; licencias de soundfonts |
| SQLite | Migración progresiva con backups/rollback | Pérdida de datos e incompatibilidad IDs |

Referencias técnicas de validación (consultadas el 19/11/2026; comprobar antes de instalar):

- MCP SDK v2: <https://ts.sdk.modelcontextprotocol.io/v2/>
- PixiJS v8: <https://pixijs.com/8.x/guides/>
- Remotion documentación: <https://www.remotion.dev/docs/>
- Remotion licencia/precios: <https://www.remotion.dev/docs/license/pricing>
- Render de `canvas` en Remotion: <https://www.remotion.dev/docs/client-side-rendering/how-it-works>
- FFmpeg: <https://ffmpeg.org/>
- Rhubarb y límites de idioma: <https://github.com/DanielSWolf/rhubarb-lip-sync>
- Qwen3-TTS: <https://github.com/QwenLM/Qwen3-TTS>
- Kokoro: <https://huggingface.co/hexgrad/Kokoro-82M>
- Tone.js: <https://tonejs.github.io/>

**Toda dependencia externa debe añadir `third-party-licenses.json`** con artefacto, `sourceUrl`, `license`, versión/hash, permiso comercial y atribución. Licencia de software no equivale necesariamente a licencia de pesos/modelo/voz/sample. No instalar ni distribuir assets ajenos sin verificación.

---

## 16. Seguridad operativa, instalación y mantenimiento

### 16.1 Windows y scripts

Crear `scripts/setup-windows.ps1` **idempotente** que compruebe `node`, `npm`, `git`, `ffmpeg`, `ffprobe`, GPU/VRAM, RAM, disco y Chromium, permita elegir ruta local de herramientas y preserve PATH del usuario sin instalar globalmente salvo consentimiento. `doctor` imprime disponibilidad, versiones, licencia detectada, codecs, capacidad de TTS y qué bloquea la producción. No descargar múltiples GB por defecto.

Comandos objetivo:

```powershell
npm ci
npm run doctor
npm run dev:editor
npm run dev:mcp
npm run test
npm run demo:character
npm run demo:pilot
npm run render -- --episode ep_002 --preset preview_720p30
npm run render -- --episode ep_002 --preset production_1080p30
```

Los scripts de objetivo solo deben anunciarse como funcionales cuando existan y se hayan probado. Para v0.1 usar los comandos reales de la sección 1.

### 16.2 Migraciones y versiones

Exportar snapshot anterior, hacer migración en base temporal, validar todas las referencias y comparar conteos/hashes, cambiar de modo atómico y conservar rollback. Idempotencia de migraciones y test para repetir dos veces sin duplicados. Cualquier cambio incompatible de API o DSL genera `schemaVersion` y adaptador; evitar sobrescritura silenciosa de escenas viejas.

### 16.3 Distribución comercial futura

El producto inicial es monousuario local. Si se transforma en SaaS: añadir auth/tenant isolation, colas distribuidas, object storage, costes GPU/CPU, billing, permisos y límites; **no** diseñar eso antes de resolver la calidad del motor. El ROI inicial está en una aplicación de estudio reproducible y comercializable; mantener portabilidad de los universos y exportación no cautiva.

---

## 17. Riesgos principales y mitigaciones

| Riesgo | Impacto | Mitigación prioritaria |
|---|---|---|
| Personajes demasiado simples | El vídeo parece diapositiva, no serie | Character Studio procedural con rig, deformación, gestualidad y pruebas visuales tempranas |
| Pixi + Remotion no produce frames fiables | Bloquea MP4 | Spike de 5–10 s y `FrameRenderer` alternativo PNG→FFmpeg |
| Voz española poco natural/lip-sync inexacto | Ruptura de calidad | Benchmark de 2 TTS, alineador español real y ajustes manuales de visemas |
| LLM crea historias incoherentes | Rompe canon y relaciones | StoryBeat causal, `KnownFacts`, validador, snapshots y delta aprobable |
| Modificar assets destruye episodios aprobados | Invalida reproducibilidad | Renders con revisiones fijadas y CAS |
| Regeneración reiterada consume IA | Coste y latencia | DSL determinista, caching por hash, IA solo en planificación/reparación |
| Escenas 15 min exceden RAM/VRAM/disco | Bloquea producción larga | Segmentos, límites, checkpoints, re-render incremental y doctor |
| Licencias de TTS/música/renderer | Riesgo comercial | Manifest de procedencia y gate de exportación comercial |
| Migración v0.1 rompe identificadores/escenas | Pérdida de universos | Backup, migrador, tests fixture y compatibilidad temporal |
| Demasiadas capas antes del primer clip real | Deuda y falsa sensación de avance | Orden P0–P4 y demos por hito con archivos audiovisuales |

---

## 18. Guion de prueba integral del producto terminado

Esta es la **prueba de aceptación final de producto**. El agente de desarrollo debe acercarse por hitos, no declarar superada la prueba sin la entrega de medios válidos.

1. Abrir el estudio vacío; desde chat, crear una serie cómica llamada «La Fábrica» con estilo 2D vectorial y reglas propias.
2. Crear **Bruno**, robot cobarde, voz grave en español, cuerpo angular, ojos grandes, mono naranja, historia y miedo a la oscuridad. Crear **Vera**, robot ingeniera, voz clara diferente, ojos pequeños, uniforme azul, personalidad pragmática. Editar ambos varias veces por chat y en inspector sin cambiar IDs.
3. Crear un laboratorio/fábrica con al menos tres capas, pasillo, mesa, puerta de ascensor con cerradura, luz de emergencia, ruido de máquinas. Crear llave y caja de herramientas con sockets y reglas de interacción.
4. Definir relación Bruno → Vera de admiración y desconfianza; Vera → Bruno de protección e impaciencia; escribir un hecho del episodio anterior que ambos recuerdan de manera diferente.
5. Pedir al agente MCP: «Episodio 1, 90 segundos. Buscan la llave, Bruno duda, Vera la coge, la puerta falla, discuten y finalmente la abren. Diálogos en es-ES y música de tensión cómica».
6. El sistema reutiliza personajes, genera `EpisodePlan`, valida reglas, crea storyboard y permite revisar/corregir planos desde la UI.
7. La previsualización muestra caminar, detenerse, alcanzar, coger llave, abrir puerta, mirar, reaccionar y hablar; props permanecen en el lugar correcto; las bocas se sincronizan con voz distinta y estable.
8. Renderizar MP4 final de 90 s con mezcla y SRT; comprobar con `ffprobe`, capturas, escucha y reporte QA. Canon aún no cambia.
9. Aprobar el episodio: aplicar deltas de canon, registrando que Vera posee la llave y Bruno aprendió que el ascensor funciona. Abrir un nuevo episodio y comprobar que nada se reinicia.
10. Cambiar la ropa de Bruno en la biblioteca después del episodio 1; reproducir el episodio 1 aprobado y comprobar que conserva la revisión original, mientras episodio 2 puede usar una variante nueva.
11. Repetir el mismo render a partir de lockfile/revisiones; obtener estado por frame reproducible y salidas comparables dentro de tolerancias de codificación definidas.
12. Pedir corrección «en el plano 3 haz que Vera parezca más preocupada y baja la música durante su frase»: re-renderizar solo segmentos afectados y remezclar sin reconstruir todo.

**La prueba no se satisface** con un vídeo de láminas fijas, personajes dibujados fotograma a fotograma por IA, TTS del navegador sin archivo de audio, objetos que aparecen teletransportados, un storyboard JSON presentado como episodio, o un reproductor vacío que simula progreso.

---

## 19. Protocolo de comunicación y rendición de cuentas del agente

Después de cada sesión de trabajo, actualizar `docs/IMPLEMENTATION_STATUS.md` y responder en este formato:

```text
ITERACIÓN / FECHA:
OBJETIVO:
CAMBIOS REALES:
  - archivos y módulos tocados
  - contratos y migraciones
FUNCIONALIDADES:
  - DONE (con evidencia)
  - PARTIAL (con límite concreto)
  - TODO
PRUEBAS EJECUTADAS:
  - comando → resultado
RENDERS/DEMOS:
  - rutas existentes y formato real
MCP:
  - tools probadas desde cliente externo
RIESGOS/BLOQUEOS:
  - qué falla y por qué
SIGUIENTE VERTICAL SLICE:
  - tareas concretas, en orden
```

No llamar trabajo en segundo plano. No usar GitHub Actions ni CI remota. Si una dependencia requiere licencia, datos de acceso o aprobación irreversible, indicar exactamente qué se necesita; si existe un fallback seguro, continuar por él y documentarlo. Cualquier afirmación de funcionamiento debe respaldarse con ejecución, archivo o inspección tangible.

---

## 20. Prompt único para entregar este proyecto a otro agente

> **Actúa como CTO, arquitecto de software senior, desarrollador TypeScript/React, ingeniero de rigs 2D, cineasta digital, especialista en TTS/lip-sync es-ES y experto en MCP. Estás situado en la raíz del proyecto SeriesForge-Studio. Lee íntegramente `docs/MASTER_IMPLEMENTATION_SPEC.md`, `AGENTS.md`, `README.md`, `docs/AGENTS_original.md`, `docs/VERIFICATION.md`, `examples/episode-plan.json` y el código existente. Ejecuta `npm test` y audita el estado real antes de modificarlo. Tu misión es IMPLEMENTAR, no únicamente planificar, una herramienta de estudio audiovisual completa: chat para crear/modificar personajes, rigs animables con expresiones, voz y lip-sync, objetos y escenarios procedurales reutilizables, interacción espacial, biblioteca de animaciones, canon narrativo y relaciones persistentes, editor integrado, producción por sinopsis desde MCP, render MP4/audio/subtítulos y QA. Respeta IDs actuales, migraciones, datos, interfaz y herramientas existentes. Windows local, sin Docker, sin GitHub Actions ni despliegues remotos, sin imágenes IA por fotograma. Prioriza P0 y P1, luego prueba temprana MP4 P3 sin omitir runtime P2. Entrega código real, pruebas locales, previews/renders verificables, documentación de estado y próximos pasos. No declares funcionalidades terminadas sin una prueba reproducible y no borres código funcional para sustituirlo por maquetas.**

---

## 21. Preguntas de producto no bloqueantes y defaults hasta nueva decisión

El agente puede continuar sin preguntar si usa estos defaults; documentará cambios en `DECISIONS.md`:

1. **Estilo visual inicial:** animación vectorial estilizada 2D con profundidad 2.5D, líneas y sombras limpias; presets intercambiables. No perseguir fotorrealismo.
2. **Usuarios iniciales:** un creador individual local en Windows, proyectos propios comerciales; sin colaboración cloud.
3. **Proveedores de IA:** local o API opcionales mediante adaptador. El software básico debe funcionar sin cuentas externas.
4. **Render:** 1080p 30 FPS 16:9; preview a 720p; duración piloto 90 s antes de 15 min.
5. **Idiomas y voces:** es-ES primero, con voces sintéticas licenciadas y perfiles estables.
6. **Revisión humana:** previsualización y aprobación de canon; render de demos automatizable sin autorización especial.
7. **Monetización:** diseñar para licencia desktop y eventual SaaS, sin asumir que el SaaS existe ahora.

**Decisiones que sí requieren autorización:** selección/distribución de un modelo o voz con licencia comercial dudosa; descargar modelos muy pesados si consumo significativo; publicar contenidos; borrar/reemplazar canon aprobado; instalar herramientas globales con permisos elevados; desplegar o utilizar servicios de pago.

---

## 22. Jerarquía documental y definición de éxito

1. **Este documento**: fuente principal para objetivo funcional, arquitectura, orden y pruebas.
2. `AGENTS.md`: instrucción corta al agente en raíz; debe apuntar aquí.
3. `README.md`: operaciones actuales y comandos reales verificables; no mezclar con comandos futuros.
4. `docs/IMPLEMENTATION_STATUS.md`: evidencia y estado más reciente; corrige cualquier tabla de progreso anticuada de esta especificación.
5. `docs/AGENTS_original.md`: origen histórico más amplio, consultar para matices no cubiertos aquí; si hay contradicción, registrar ADR y seguir este documento salvo mandato explícito del usuario.
6. Código + tests + renders verificados: verdad sobre la capacidad técnica efectiva; ningún texto puede sustituirlos.

**Éxito final:** el usuario abre un único estudio, crea y perfecciona personajes/entornos/objetos/historia mediante chat e inspector, conserva sus assets entre capítulos, pide a un agente conectado por MCP que produzca un capítulo de la serie y recibe audiovisual coherente, editable, reproducible, con voces/lip-sync/efectos/música y continuidad válida. Antes de conseguir ese flujo end-to-end, el proyecto permanece *en desarrollo* por mucho código o documentación que contenga.

**FIN DEL DOCUMENTO MAESTRO.**
