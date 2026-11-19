# AGENTS — Series Forge Studio (v0.5)

Punto de entrada para Claude Code, Codex, OpenCode y cualquier agente que trabaje en este repositorio.

Series Forge Studio es un **estudio audiovisual local, file-first, sin LLM integrado**. Tú (el agente) escribes **datos** (JSON/Markdown) en `workspace/<proyecto>/`; el motor los convierte en un episodio con imagen 3D toon, voces en español, lip-sync, efectos, música y subtítulos, y la web local (`npm start`) muestra los cambios en vivo.

Lee, en este orden: `docs/GUIDE.md` (uso y flujo de agente), `docs/FORMATS.md` (formatos exactos), `docs/ARCHITECTURE.md` (motor) y `docs/IMPLEMENTATION_STATUS.md` (qué está verificado y qué no). `docs/history/` contiene especificaciones antiguas: son contexto, no el estado actual.

## Si te piden producir algo desde una sinopsis

1. Consulta lo existente: `npm run studio -- list characters|props|environments|episodes|animations|expressions|sounds|music <proyecto>` y `npm run studio -- story status <proyecto>`. **Reutiliza** personajes, escenarios, objetos y animaciones; no dupliques identidades.
2. Crea solo lo necesario con `npm run studio -- new …` y edita sus archivos (proporciones, ropa, voz, fichas). Proyecto nuevo: `npm run studio -- new project <id> "<Nombre>"`.
3. Escribe `episodes/<ep>/sinopsis.md`, `guion.md`, `story.json` y una `scene.json` por escena. Encadena el tiempo con `after`/`with` sobre los ids de diálogo: las duraciones reales salen del TTS.
4. `npm run studio -- validate <proyecto>` hasta 0 errores (esquemas, referencias, continuidad: un personaje no puede usar información que aún no conoce).
5. Revisa imágenes: `npm run studio -- preview character <proyecto> <id>` y `preview scene <proyecto> <ep> <sc>` (PNG en `generated/preview/`). Míralas.
6. Produce: `npm run studio -- produce <proyecto> <ep> [--draft]`. Lee `output/validation-report.json` y los fotogramas de `output/storyboard/`. Corrige y repite.
7. Tras aprobación humana: `npm run studio -- story confirm <proyecto> <ep>`. Nunca edites a mano hechos confirmados del canon (usa `story amend` con motivo).

**No** escribas componentes React ni código por escena, ni modifiques el motor para una petición de contenido («ponle barba», «que se siente», «nueva animación»): todo eso son datos.

## Si te piden desarrollar el motor

- Código TypeScript en `src/` (Node 24 ejecuta `.ts` directamente; solo sintaxis borrable: nada de `enum`, `namespace` ni propiedades de parámetro). El navegador usa el mismo código vía `npm run build` (esbuild).
- Antes y después de cambiar código: `npm run typecheck` y `npm test` (las pruebas con GPU/Chrome, FFmpeg y voces OneCore se omiten si faltan).
- Cualquier cambio que afecte a píxeles debe verificarse **visualmente** (`preview`, storyboard, fotogramas del MP4) y con `validate episode`. No declares una capacidad terminada sin prueba reproducible.
- Cambios de formato: nueva `schemaVersion` + migración en `src/engine/schema.ts`/`src/pipeline/project.ts`; nunca destruyas archivos del usuario.
- La evaluación debe seguir siendo pura en el tiempo (`pose(t)` sin estado acumulado). Mantén `tests/engine.test.ts` (determinismo, IK, pies sin deslizar, límites articulares).

## Restricciones del proyecto

Windows local; sin Docker; sin GitHub Actions ni CI remota; sin servicios cloud ni claves obligatorias; dependencias instaladas en el proyecto; assets visuales 100 % procedurales; voces/música/SFX con licencia declarada (`license` en cada archivo); servidor solo en 127.0.0.1. No hagas push, PRs ni Actions salvo orden explícita.

## Mapa rápido

| Necesito… | Dónde |
|---|---|
| Comandos | `npm run studio -- help` |
| Formatos | `docs/FORMATS.md`, `src/engine/schema.ts` |
| Biblioteca de animaciones/expresiones/sonidos | `library/` (datos; se regenera con `node scripts/generate-library.ts`) |
| Piloto de referencia | `examples/projects/el-ultimo-turno` (`npm run studio -- init pilot`) |
| Motor de pose / director / cámara | `src/engine/` |
| Render Three.js | `src/render/` |
| Audio (TTS, alineación, mezcla) | `src/audio/` |
| Producción, QA, historia, CLI, servidor | `src/pipeline/`, `src/cli/`, `src/server/` |
| Editor web | `ui/` |
| Código legado v0.1–v0.4 (conservado) | `src/*.mjs`, `public/*.js` (`npm run legacy`, `npm run legacy-v04`, `npm run render:legacy`) |
