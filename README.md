# Series Forge Studio — versión funcional 0.1

> **Continuidad del desarrollo (19/11/2026):** lee `docs/MASTER_IMPLEMENTATION_SPEC.md` para los requisitos completos y el plan ejecutable del motor de series; `docs/IMPLEMENTATION_STATUS.md` resume qué funciona realmente hoy. El documento maestro describe capacidades objetivo, **no** capacidades ya implementadas.

**Un estudio local de creación procedural para construir personajes, escenarios, objetos, escenas y canon narrativo por chat o mediante herramientas MCP.** No es todavía un generador final de episodios MP4.

## 1. Instalación en Windows

Requiere **Node.js 20+** (recomendado 22 LTS o posterior) y navegador moderno. No requiere Python, Docker, npm install, claves API, nube ni GPU.

1. Extrae el ZIP en una carpeta permanente, p. ej. `C:\\SeriesForge`.
2. Ejecuta `iniciar-estudio.cmd` o abre PowerShell en esa carpeta y ejecuta `npm start`.
3. En el navegador abre **http://127.0.0.1:4317**.
4. Puedes pulsar «Cargar universo de ejemplo» cuando la biblioteca está vacía. Es una opción de demostración, no datos obligatorios.

Tu biblioteca se guarda en `data/studio.json`. Las vistas SVG exportadas por MCP se guardan en `data/previews/`.

Comandos:

```powershell
npm start
npm test
npm run mcp
```

Node.js permite lanzar el proyecto sin descargar paquetes npm. El servidor se enlaza de forma predeterminada **solo a 127.0.0.1**. No lo expongas a Internet: no lleva autenticación de usuarios.

## 2. Uso del editor

- **Personajes**: escribe «Crea un hombre llamado Bruno con chaqueta roja y pelo negro», selecciónalo y después «Ponle gafas, hazlo más alto y feliz». El ID se conserva; cambia el asset original, con revisión e historial.
- **Entornos**: «Crea un laboratorio nocturno», «Cambia las paredes a verde». Son escenarios SVG procedurales.
- **Objetos**: «Crea una llave dorada» y después «Hazla más grande».
- **Inspector**: edita geometría, paleta, expresiones, poses, voz asignada, personalidad, objetivo, biografía, miedo, etc.
- **Narrativa**: registra recuerdos y relaciones entre personajes, con persistencia.
- **Escenas**: crea una escena y asocia personajes, escenario, objetos y diálogos; define gestos, expresiones y objetos sostenidos.
- **Reproducción**: «Escuchar escena» reproduce diálogos mediante `speechSynthesis` del navegador y aplica una aproximación visual de apertura/cierre de boca. Emite efectos de audio básicos por WebAudio. **No es TTS offline exportable ni sincronización fonética de producción.**

El chat en modo local es un **intérprete acotado de frases frecuentes**. Instrucciones más complejas requieren conectar un LLM: no confundir el intérprete local con un modelo creativo general.

## 3. Activar un LLM real para conversaciones libres

Se admite un endpoint **OpenAI Chat Completions compatible**, por ejemplo de LM Studio u Ollama instalado por separado. Inicia el servidor desde PowerShell:

```powershell
$env:STUDIO_LLM_URL = 'http://127.0.0.1:1234/v1/chat/completions'
$env:STUDIO_LLM_MODEL = 'tu-modelo-disponible-en-el-servidor'
npm start
```

Si tu proveedor requiere clave, configura `STUDIO_LLM_API_KEY` en el entorno, **nunca en el navegador**. Se solicita una acción JSON y se ejecuta únicamente si pertenece a una lista de operaciones admitidas. Pueden existir diferencias entre implementaciones de `response_format` de cada servidor local: ajustar adaptador si es necesario. **No se ha probado contra LM Studio/Ollama en esta entrega.**

Sin variables configuradas, el chat permanece en modo local.

## 4. Servidor MCP para modelos de IA

Ejecuta `npm run mcp`. Es un servidor **MCP JSON-RPC 2.0 por stdio**, implementado sin dependencias externas para que se pueda ejecutar sin instalación. Handshake (`initialize`), descubrimiento (`tools/list`) y llamadas (`tools/call`) están cubiertos por pruebas. El SDK oficial v2 es la migración recomendada al escalar la solución; esta implementación no es un SDK oficial completo ni soporta todas las capacidades de MCP.

Configura una entrada en el cliente MCP (ejemplo de sintaxis tipo Claude Desktop, sustituyendo la ruta):

```json
{
  "mcpServers": {
    "series-forge": {
      "command": "node",
      "args": ["C:\\SeriesForge\\src\\mcp.mjs"],
      "env": {"STUDIO_DATA_DIR":"C:\\SeriesForge\\data"}
    }
  }
}
```

Para que editor y MCP compartan biblioteca, ambos deben apuntar al mismo `data/`: si los ejecutas desde ubicaciones diferentes, configura también `STUDIO_DATA_DIR` en el proceso del editor. La escritura usa un bloqueo de archivo para evitar pérdida de cambios entre procesos en una misma máquina.

Herramientas implementadas: `studio_status`, `studio_get_state`, `studio_chat`, `asset_list`, `asset_get`, `character_create`, `environment_create`, `object_create`, `series_create`, `scene_create`, `asset_patch`, `character_relationship`, `story_event_add`, `scene_add_actor`, `scene_add_object`, `scene_set_actor`, `scene_add_dialogue`, `asset_render_svg`, `episode_compile_plan`.

### Creación de un universo desde una sinopsis

El modelo lee una sinopsis y redacta un `plan` como `examples/episode-plan.json`. Después llama a **`episode_compile_plan`** con `{ "plan": <contenido JSON> }`.

Este comando crea en una operación atómica:

1. Serie y biblia narrativa.
2. Fichas persistentes de personajes con voces parametrizadas y relaciones.
3. Entornos y objetos SVG procedurales reutilizables.
4. Escenas con actores, posiciones, expresiones, poses, objetos y diálogos.
5. Memorias y acontecimientos del universo.

Responde con los IDs reales generados y un mapa `ref → id`. Si falla una referencia, no guarda partes del plan. Los assets están inmediatamente disponibles en la interfaz web.

**Limitación:** `episode_compile_plan` produce una biblia y storyboard vectorial editable, *no un vídeo final*. El diseño no invoca IA por fotograma. La IA decide el plan; el motor ejecuta las definiciones.

## 5. Comprobación reproducible

```powershell
npm test
```

Las pruebas abarcan persistencia, edición por chat, SVG, relaciones y eventos, bloqueo de cambios entre procesos, exportación, protocolo MCP y compilación atómica del plan narrativo.

## 6. Arquitectura presente y siguiente evolución

```text
 apps/editor (public/ HTML+CSS+ESM sin build, v0.1)
         │ HTTP local
         ▼
  src/server.mjs ───── src/mcp.mjs (stdio)
         │                    │
         └──── src/operations.mjs
                       │
  ┌─────────┬──────────┼───────────┐
  │         │          │           │
  ▼         ▼          ▼           ▼
core.mjs  chat.mjs  render.mjs  compile.mjs
  │
  ▼
 data/studio.json (archivo atomic + lock)
```

Esta primera versión usa **SVG y módulos JS nativos** para poder ejecutarse hoy sin dependencias. NO afirma implementar todavía React, PixiJS, Remotion, SQLite, un rig IK real o TTS exportable. El archivo `AGENTS.md` contiene la hoja de ruta priorizada de integración con esas tecnologías.

### Prioridad para la siguiente iteración

1. Motor gráfico TS/PixiJS 8 y rigs articulados con IK real, control por huesos, deformación y gestos reutilizables.
2. Editor React/TypeScript con manipulación directa, timeline por escena, undo/redo e inspector paramétrico.
3. TTS por personaje con voces estables, archivo audio real, alineación palabra/fonema/visema, SFX/música y mezcla offline.
4. Renderer determinista por frame (Pixi+Remotion/FFmpeg) con exportación de escenas y compilación MP4.
5. Director generativo por sinopsis, evaluación narrativa, revisión y canon transaccional por episodio.
6. Pruebas visuales reales, benchmark 60–90 segundos y luego escalado a 8–15 minutos.

**Seguridad:** los agentes solo pueden editar campos admitidos. Los SVG escapan texto y validan los colores. No hay ejecución de scripts aportados por el LLM ni carga de archivos externos en render SVG. La aplicación web es monousuario, local y no apta para exposición pública ni explotación multiusuario sin autenticación y otros controles.
