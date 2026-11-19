# Guía de uso: agentes, editor y producción

## 1. Instalar y comprobar (Windows)

```powershell
git clone https://github.com/akumanomi1988/Series-Forge-Studio.git
cd Series-Forge-Studio
npm install          # three, react, zod, esbuild (todo local al proyecto)
npm run build        # bundles del editor y del capturador
npm test             # unitarias + integración (render real, TTS, navegador)
```

Requisitos: Node.js ≥ 24, FFmpeg con `libx264` en el PATH, Chrome o Edge (o `SERIES_FORGE_CHROMIUM=<ruta>`), voces españolas de Windows (Configuración → Hora e idioma → Voz; `npm run studio -- voices`). No hace falta Docker, cuentas, claves ni Internet después de instalar.

## 2. Producir el piloto

```powershell
npm run studio -- init pilot                       # copia examples/projects/el-ultimo-turno a workspace/
npm run studio -- produce el-ultimo-turno ep-001   # valida, sintetiza voces, renderiza 1080p, mezcla y verifica
```
Salida en `workspace/el-ultimo-turno/episodes/ep-001/output/`: `episodio.mp4`, `audio-master.wav`, `subtitulos.srt`, `metadata.json`, `storyboard/`, `validation-report.json`. Borrador rápido: añade `--draft` (640×360).

## 3. Editor web

`npm start` y abre http://127.0.0.1:4317.

- **Explorador**: personajes, escenarios, objetos, episodios y escenas, biblioteca de animaciones y sonidos.
- **Visor**: el mismo motor que la exportación. *Cámara final* (planos del guion) o *cámara libre* (orbitar). En una escena, selecciona un actor y usa ✥ / ⟲ para mover o girar su posición inicial: se guarda en `scene.json`.
- **Personaje**: deslizadores de cuerpo/cara, estilos de pelo, barba y ropa, colores; prueba giro del cuerpo, giro independiente de la cabeza, cualquier clip y expresión.
- **Timeline multipista**: cámara, diálogo, movimiento, animación, expresión, manos, efectos, ambiente y música. Arrastra un elemento con id para fijar su tiempo absoluto (`at`).
- **Guion**: edita texto, personaje, emoción, indicación y pausa de cada línea; ▶ sintetiza y reproduce la voz real.
- **Historia**: canon, propuestas del episodio, relaciones y conocimiento; *Confirmar en el canon*.
- **Render**: previsualización 360p o final 1080p, progreso en vivo, vídeo, storyboard y checklist de QA.
- **Inspector**: cualquier JSON/Markdown del recurso con guardado protegido por hash (Ctrl+S).

Si un agente guarda un archivo, la web se actualiza sola (SSE). Si el archivo queda inválido o a medio escribir, aparece un aviso y se conserva el último estado válido.

## 4. Flujo para un agente (sinopsis → episodio)

1. `npm run studio -- list characters <proyecto>` (y `props`, `environments`, `animations`, `expressions`, `sounds`, `music`) y `npm run studio -- story status <proyecto>`: reutiliza lo que existe.
2. Crea solo lo necesario: `npm run studio -- new character <proyecto> <id> "<Nombre>" [--from <id>]`, luego edita `geometry.json`, `voice.json` y las fichas `.md`. Igual con `new prop|environment|episode|scene`.
3. Escribe `episodes/<ep>/sinopsis.md`, `guion.md`, `story.json` y las escenas (`docs/FORMATS.md`). Usa `after`/`with` para encadenar acciones a los diálogos.
4. `npm run studio -- validate <proyecto>`: corrige todos los errores (incluida continuidad narrativa).
5. `npm run studio -- preview scene <proyecto> <ep> <sc>` y `preview character <proyecto> <id>`: revisa las imágenes PNG generadas.
6. `npm run studio -- produce <proyecto> <ep>` (o `render episode` + `validate episode`). Lee `validation-report.json` y los fotogramas del `storyboard/`.
7. Cuando el episodio esté aprobado: `npm run studio -- story confirm <proyecto> <ep>` para pasar sus hechos al canon.

**No generes componentes React ni código por escena**: escribe datos.

## 5. Añadir un personaje sin tocar el motor

```powershell
npm run studio -- new character el-ultimo-turno nico "Nico Ferrer"
```
Edita `characters/nico/geometry.json` (por ejemplo `"hair": {"style":"curly","color":"#7a3b12"}`, `"outfit": {"top": {"type":"hoodie","color":"#2e8b57"}}`, `"body": {"height":1.55}`) y `voice.json` (`"voice": "Microsoft Pablo", "pitchSemitones": 3`). Comprueba con `npm run studio -- preview character el-ultimo-turno nico`.

## 6. Crear una animación

Copia un clip de `library/humanoid/animations/` a `characters/<id>/animations/` (solo ese personaje), a `<proyecto>/animations/humanoid/` (todo el proyecto) o crea uno nuevo con el formato de `docs/FORMATS.md`. Úsalo con `{ "type": "play", "actor": "nico", "clip": "baile", "after": "l3" }`. Para un modo de andar propio, crea un JSON `kind: "locomotion"` y pásalo como `gait`.

## 7. Historial, migración y licencias

- Cada guardado del editor y cada cambio válido de un agente detectado por el servidor se guarda en `generated/history/`. `npm run studio -- history <proyecto> <ruta>` lista versiones y `npm run studio -- revert <proyecto> <ruta> <versión>` restaura (en el editor: desplegable *Historial…* del inspector).
- Proyectos de v0.2–v0.4: `npm run studio -- migrate <proyecto>` (deja copias `.v1.json`).
- `output/metadata.json` incluye un informe de licencias (voces, SFX, música). Las voces de Windows quedan marcadas `commercialUse: "unknown"`: revísalo antes de distribuir.

## 8. Pruebas

- `npm test`: todas las suites. Las que necesitan GPU/Chrome, FFmpeg o voces OneCore se omiten (skip) si faltan.
- `npm run typecheck`: TypeScript estricto.
- Prueba de 20 minutos: `node scripts/bench-long.ts el-ultimo-turno 20 ep-larga` y `npm run studio -- render episode el-ultimo-turno ep-larga` (≈ 1 h en una GTX 660 Ti); opcional `node scripts/gpu-monitor.ts gpu.csv`.
