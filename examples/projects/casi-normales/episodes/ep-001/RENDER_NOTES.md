# Estado del piloto: listo para validación y render local

- 13 escenas, 285 intervenciones, 3048 palabras habladas, de ellas 1529 de narración (50.2 %).
- 146 planos especificados, 83 acciones, 8 identidades (incluye el doble técnico de voz de Nico, fuera de campo), 4 escenarios, música procedural y efectos.
- **OBJETIVO: ~20 min. Duración y calidad todavía sin validar con TTS Kokoro ni con un MP4 real.** Los tiempos de cámara son estimaciones; deben ajustarse después de `compile`.
- El nuevo universo está en `examples/projects/casi-normales`; solo se usan datos JSON/Markdown del programa. No se cambia código ni se pisa `ultima-ronda`.
- El libro de guion de este episodio se genera desde los diálogos definitivos de `scene.json`.

## Comprobaciones estructurales

- IDs de diálogo y de escena coherentes; 13/13 escenas definidas.
- 0 planos que apunten al actor técnico `nico-voz`.
- Recursos de decorado y objetos compartidos reutilizados; ambiente procedural `traffic` añadido para la calle.
- Pendiente ejecutar **validación real del programa**: `npm run studio -- validate casi-normales`.
- Pendiente previsualización real y QA audiovisual. No aprobar ni confirmar el canon todavía.

## Cómo finalizar en Windows

```powershell
git fetch origin
git switch content/piloto-la-peor-cita
npm install
npm run build
Copy-Item -Recurse examples/projects/casi-normales workspace/
npm run studio -- validate casi-normales
npm run studio -- preview character casi-normales nico
npm run studio -- preview character casi-normales vera
npm run studio -- preview scene casi-normales ep-001 sc-007
npm run studio -- compile episode casi-normales ep-001
npm run studio -- produce casi-normales ep-001 --draft
npm run studio -- validate episode casi-normales ep-001
```

Si pasa la QA del borrador, repetir `npm run studio -- produce casi-normales ep-001` sin `--draft` para exportación 1080p. Revisar planos, sincronía y duración antes de publicar.
