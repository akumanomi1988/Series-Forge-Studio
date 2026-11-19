> **Novedad v0.4:** el editor y el renderizador Three.js comparten `public/viewport.js` y `public/scene-runtime.js`. El comando `npm run render` usa por defecto `--renderer three` con Chromium/Edge/Chrome local; `--renderer svg` conserva el animatic anterior. Lee `docs/THREE_RENDER_PIPELINE_V04.md` para requisitos, limitaciones y pruebas pendientes.

# Series Forge Studio v0.3 — 19 de noviembre de 2026

**Novedad:** exportación de animatic MP4/SRT por FFmpeg, caché por escena, seguimiento desde la web y descubrimiento de clips creados por agentes. Consulta [docs/VIDEO_EXPORT_V03.md](docs/VIDEO_EXPORT_V03.md). El renderizador final 3D toon, IK avanzado, lip-sync fonético y episodios de 20 minutos comerciales aún están pendientes.

# Series Forge Studio v0.2 — Estudio de animación file-first

Aplicación **local para Windows** que muestra assets de personajes 3D-toon, escenarios y escenas generados por **Claude Code, Codex u OpenCode mediante archivos**, sin configurar modelos en el editor. El objetivo es producir series 2D/2.5D y capítulos de 20 minutos; esa capacidad final **aún no está implementada**.

## Ejecutar

```powershell
git clone https://github.com/akumanomi1988/Series-Forge-Studio.git
cd Series-Forge-Studio
npm install
npm run demo
npm start
```

Abrir **http://127.0.0.1:4317**. Se requiere **Node.js 22+** y navegador moderno con WebGL. Sin Docker, sin servidor LLM ni claves API. `npm install` descarga la dependencia **Three.js** para el visor 3D local; **no usa una CDN**.

Alternativamente usar `iniciar-estudio.cmd`. `npm test` ejecuta la suite de regresión. `npm run plan -- demo-de-produccion piloto` imprime el plan de producción del episodio, con hashes e invalidaciones futuras por escena.

## Flujo: agente externo + web

1. Abre la carpeta del repo con tu CLI habitual: `claude`, `codex` u `opencode`.
2. Pide «En `workspace/demo-de-produccion`, crea tres personajes, sus biografías y relaciones. Añade `animations/gesticular.json` y una escena con dos personajes girados 35°. Respeta `docs/FILE_FIRST_STUDIO.md`. No cambies el motor salvo necesidad real».
3. La web muestra los cambios automáticamente mediante eventos de filesystem y **Server-Sent Events**. No necesita conexión al agente.
4. Desde el inspector puedes seleccionar el archivo JSON/Markdown, editar y guardar; el guardado rechaza conflictos por hash.
5. Para personajes, el visor permite rotar cuerpo y cabeza por separado y probar las animaciones/expresiones que existan. Para capítulos, abrir una escena, añadir personajes y texto a la timeline.

**Archivos**: `workspace/<universo>/characters/<id>/{manifest.json,geometry.json,rig.json,animations/*.json,expressions/*.json,aspecto.md,personalidad.md,biografia.md,gustos.md,relaciones.json,voice.json}`. También existen `environments/`, `props/` y `episodes/` con sus escenas. Consulta `docs/FILE_FIRST_STUDIO.md` para el contrato completo.

Los universos en `workspace/` están ignorados en Git para no publicar por error tus guiones/personajes privados. Los propios archivos del ejemplo se crean ejecutando `npm run demo`.

## Funcionalidades implementadas

- Gestor de universos file-first, creación de recursos (personajes/entornos/props/capítulos), explorador, edición JSON/Markdown, revisión por hash.
- Geometría procedural simple con Three.js local, apariencia toon, huesos jerárquicos, orientación libre yaw, giro de cabeza, animaciones `idle/walk`, expresiones básicas.
- Escenas declarativas con actores/props/transformaciones, beats con tiempo de inicio/fin, diálogos como texto y previsualización temporal.
- Detección de cambios externos con SSE (si el navegador reconecta, los datos se recargan), validaciones básicas, protección frente a traversal y symlinks de recursos, importación parcial del prototipo anterior.
- `src/production.mjs`: recopilación de dependencias y hashes deterministas para render incremental posterior, sin crear aún vídeo final.

## No implementado todavía

- Editor completo de geometría/IK/rigging y vestuario, labios por fonemas, TTS exportable, mezcla de sonido, efectos avanzados, animación física, cámara multi-plano, guionizador automático ni exportación MP4 de episodios de 20 minutos.
- Exportación GLB, presets de animación compartidos, anclajes de objetos y animación avanzada de personajes. Los personajes actuales son primitivas estilizadas, no calidad televisiva.
- La herramienta de importación conserva personajes y otras entidades legadas, pero la migración de escenas antiguas exige revisión manual.

## Modo v0.1 conservado

En otra terminal Windows:

```powershell
$env:PORT=4318
npm run legacy
```

El editor original queda en http://127.0.0.1:4318, con datos almacenados en `data/studio.json`. Su chat local y MCP funcionan como antes; **no forman parte del nuevo flujo CLI file-first**. No se elimina la base anterior.

## Calidad y seguridad

El servidor escucha **solo en 127.0.0.1**. No exponer el puerto a Internet. Los agentes deben generar **JSON/Markdown declarativo**, no JS ejecutable. Hay protección de rutas permitidas y hash para conflictos en el editor, pero el sistema requiere endurecimiento adicional antes de uso multiusuario o distribuirlo como SaaS. Los cambios externos del CLI tienen que seguir las validaciones y convenciones documentadas.

**Documentación canónica:** `AGENTS.md`, `docs/FILE_FIRST_STUDIO.md` y `docs/IMPLEMENTATION_STATUS.md`. `docs/MASTER_IMPLEMENTATION_SPEC.md` se conserva solo como visión histórica anterior.
