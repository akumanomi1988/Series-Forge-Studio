# CONTINUIDAD v0.3 (leer primero)

La base file-first sigue siendo el contrato principal. La versión v0.3 incorpora exportación **animatic SVG → FFmpeg MP4**, SRT, audio AAC (silencio predeterminado, SAPI opcional solo Windows), caché y trabajos web; NO es aún el renderer cinematográfico final. Lee `docs/VIDEO_EXPORT_V03.md` antes de modificar el exportador. Mantén la API en loopback, el uso de agentes CLI externos y evita Docker/GitHub Actions. No afirmes calidad profesional, voces verificadas en Windows, lip-sync fonético o 20 minutos validados.

# AGENTS.md — SERIES FORGE STUDIO (dirección v0.2 file-first)

## Misión

Desarrolla un estudio local de producción de series animadas 2D/2.5D, con personajes/entornos/objetos **procedurales y reutilizables**, guion, continuidad, escenas, cámaras, voces, música, lip-sync y exportación de episodios de hasta 20 minutos.

**Cambio de arquitectura obligatorio:** el usuario trabaja desde **Claude Code, Codex u OpenCode ya instalados en su PC**. Los agentes **escriben archivos JSON/Markdown en `workspace/<universo>/`**; el editor en `localhost:4317` observa esos archivos y muestra los cambios. No implementar un gestor de modelos, selector de harness ni configuración de endpoints de IA como dependencia principal. El MCP legado es opcional.

Lee íntegramente `docs/FILE_FIRST_STUDIO.md`, luego `README.md` y `docs/IMPLEMENTATION_STATUS.md`. `docs/MASTER_IMPLEMENTATION_SPEC.md` es referencia histórica y sus decisiones incompatibles quedan reemplazadas por la presente arquitectura. Ejecuta `npm test` antes y después de tocar código.

## Implementación existente

- `src/workspace.mjs`: modelo file-first, formatos declarativos, plantillas de humanos, creación de carpetas, validación de animaciones/escenas, lectura/escritura con hash y observación.
- `src/studio-server.mjs`: API web local, SSE, importador de assets legados y servidor de Three.js local.
- `public/studio.html`, `studio.js`, `studio.css`: explorador, visor, edición JSON/MD, escenas/diálogos y timeline básica.
- `public/viewport.js`: Three.js toon procedural; bones articulados, yaw, cabeza independiente, clips `idle/walk`, expresión y escena.
- `src/production.mjs`: **plan de producción y hashes, NO renderizador de MP4**.
- `scripts/demo.mjs`: ejemplo Bruno/Lara y escena de 45 s.
- `src/server.mjs`, `src/core.mjs`, `public/index.html`: editor v0.1 legado, sin borrar.

## Regla de desarrollo

1. Modifica el formato de assets solo mediante versionado y migraciones, preservando IDs y proyectos previos.
2. Crear una animación no debe requerir cambiar el motor de render; usar `animations/<nombre>.json` y `rig.json`.
3. En el modelo 3D el eje Y es vertical y los ángulos humanos se expresan en grados; el motor transforma a radianes internamente.
4. Separar fuente editable (JSON/MD), caché compilable (GLB opcional), previsualización y exportación audiovisual.
5. La calidad artística y biomecánica debe verificarse visualmente, no solo en tests unitarios.
6. Antes de ampliar a 20 min, completar el piloto de 30 segundos con movimiento, expresiones, diálogos y audio reales.
7. Evitar Docker, pipelines GitHub Actions, servicios cloud de pago y dependencias innecesarias. Nunca añadir claves al repositorio.
8. Preferir TypeScript para módulos nuevos amplios; los módulos v0.2 iniciales usan ESM de Node para mantener la migración acotada.
9. Informar con precisión: hoy **NO** hay IK, TTS real, lip-sync fonético, producción de MP4 ni capítulos terminados.
10. Entregar código probado, pasos de reproducción, imágenes/vídeo de prueba cuando proceda y documentación del resultado, no solo planes.

## Tarea recomendada a continuación

Conseguir un piloto renderizable real: humanoides 3D toon de calidad, IK en pies/manos, acciones semánticas (caminar, girar, sentarse, coger objeto), cámara editada, diálogos en español con TTS, alineación de visemas y MP4 de 30 segundos. Usar el código actual y no reconstruir otro proyecto desde cero.