# AGENTS — SERIES FORGE STUDIO

> **DOCUMENTO OBLIGATORIO PARA CONTINUAR:** `docs/MASTER_IMPLEMENTATION_SPEC.md` es la fuente de verdad actualizada sobre producto, arquitectura, implementación, prioridades, contratos MCP y pruebas. **Léelo entero antes de cambiar código.** Compara después con `docs/IMPLEMENTATION_STATUS.md` (estado verificado), `README.md` (comandos actuales) y `docs/AGENTS_original.md` (referencia histórica). La misión es ejecutar P0→P1 y avanzar con código probado, no volver a redactar un plan.

**No se trata de un concepto: existe una versión ejecutable 0.1.** Revisa `README.md` y ejecuta `npm test` antes de modificarla. Existe también `docs/AGENTS_original.md`, con la especificación a largo plazo de motor audiovisual completo. **Preserva la implementación funcional**; no sustituyas el proyecto por documentación o una demo nueva.

## Qué está implementado

Servidor web Node sin dependencias, editor browser, assets SVG procedurales, poses simples, expresiones, modo charla local, adaptador LLM OpenAI-compatible opcional, personajes con fichas y voces configurables, entornos/objetos, relaciones y memoria, escenas, diálogo WebSpeech de preview, efectos WebAudio mínimos, servidor MCP por stdio, operación transaccional `episode_compile_plan`, exportación SVG y persistencia robusta con lock entre procesos.

## Qué NO está implementado

Rigs IK avanzados, auto-rigging de criaturas/personajes, motores 2.5D potentes, exportación MP4, alineación fonética auténtica, voces TTS almacenadas por personaje, actuación temporal precisa, música y SFX offline avanzados, montaje final completo y generación autónoma de un episodio de 15 minutos. No decir que está hecho sin pruebas audiovisuales.

## Instrucción al agente que recibe una sinopsis

1. Analiza la sinopsis y consulta `studio_get_state` para reutilizar personajes, props, escenarios y hechos existentes.
2. Diseña un plan JSON con las referencias lógicas `ref`, nombres, atributos, relaciones, escenas, diálogos y eventos; consulta `examples/episode-plan.json`.
3. Llama a `episode_compile_plan` para crear un **universo nuevo** de manera atómica. Para una serie ya existente, utiliza herramientas granulares para NO duplicar identidades.
4. Inspecciona todas las fichas y previsualizaciones usando `asset_get` y `asset_render_svg`.
5. Presenta el storyboard vectorial creado; declara la capacidad audiovisual pendiente, sin fingir MP4.

## Instrucción al agente de desarrollo

Objetivo: convertir esta base ejecutable en un **DCC audiovisual** (Digital Content Creation) conversacional, reutilizable, controlable por MCP y adecuado para producción 2D/2.5D comercial.

**Restricciones**: Windows local, Node/TS, sin Docker, sin pipelines de Actions o CI remota, sin dependencias gratuitas de licencia comercial dudosa, sin generadores de imágenes raster como fuente maestra y sin renderizar por IA cada frame. Reutilización de assets, determinismo y versionado.

**Prioridades de ejecución**:

1. Migrar paulatinamente UI a React/TS y viewport a PixiJS con rig/IK real, conservando los contratos de `src/core.mjs`, IDs, render vectorial y pruebas.
2. Implementar `AssetSchema` versionado, tipos explícitos, zod, generadores paramétricos más ricos, esqueleto con anchors, articulaciones, composición de ropas, skins y accesorios.
3. Incorporar interacciones espaciales actor↔objeto, estados de poses, agarres, físicas simplificadas, dirección de mirada, animación facial y retargeting de acciones.
4. Integrar TTS local offline con validación de licencia, fichero de audio por diálogo y voz estable por personaje, alineador de palabras/visemas y SFX/música originales proceduralmente.
5. Implementar Scene DSL y render determinista por frame con Remotion y FFmpeg, previsualización por escenas, caché segmentada y exportación MP4/WAV/SRT/metadata.
6. Director IA desde sinopsis con guion, actos, duración y chequeos de continuidad; no actualizar el canon narrativo hasta aprobación.
7. Sustituir el MCP manual por SDK oficial v2, conservando herramientas y contratos; añadir manejo de progreso/cancelación y recursos.

**Criterio de aceptación de cada capacidad:** código ejecutable + test + prueba audiovisual/visual reproducible. En toda entrega indica qué está hecho, probado, pendiente y fallido. No ejecutar pushes, PRs ni Actions salvo orden explícita.
