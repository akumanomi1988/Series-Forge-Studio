# Registro de decisiones (ADR breve)

## 2026-11-19 · ADR-001 · Motor audiovisual y editor modular
**Decisión:** TypeScript/Node, PixiJS para render 2D/2.5D, rig procedural propio, Remotion para composición si supera prueba Pixi/canvas, FFmpeg como ensamblador/fallback. UI React gradual, MCP SDK v2, persistencia SQLite progresiva.
**Motivo:** assets procedurales reproducibles, control por chat y MCP, re-render por escena y coste predecible.
**Alternativas descartadas como fuente maestra:** imágenes IA por fotograma; Rive/Spine obligatorios; generación de episodios como un solo vídeo monolítico sin estados.
**Prueba obligatoria:** vídeo real de 5–10 segundos antes de comprometer la integración Pixi+Remotion.

## 2026-11-19 · ADR-002 · Priorizar Character Studio y continuidad
**Decisión:** primer resultado visible será personaje procedural rigged controlable por chat, expresión, animación e interacción; preservación de IDs y migración con backup.
**Motivo:** la calidad real depende del movimiento expresivo, no del número de pantallas ni de tool definitions.

## 2026-11-19 · ADR-003 · Español lip-sync multilingüe
**Decisión:** no usar Rhubarb como alineador primario de voz española, evaluar alineación fonética y modelo multilingüe y validarlo con WAV real.
**Motivo:** el reconocimiento de Rhubarb está orientado al inglés, según documentación oficial.

Nuevas decisiones técnicas deben registrar fecha, alternativas, trade-offs y evidencias.
