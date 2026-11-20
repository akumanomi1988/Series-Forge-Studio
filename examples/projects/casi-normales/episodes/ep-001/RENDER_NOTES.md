# Producción pendiente de ejecución local

Capítulo completo guionizado y modelado como datos nativos de Series Forge Studio v0.5. No se ha renderizado un MP4 en este entorno.

- **13 escenas, 285 intervenciones, 3037 palabras habladas**, de las cuales 1518 (50 %) son narración retrospectiva.
- **Duración prevista:** ~20 minutos. El cálculo aproximado a partir de palabras y pausas es 21 min, **no es una medición del audio Kokoro**.
- Todos los planos son manuales para evitar que se muestre al actor técnico `nico-voz` (posicionado fuera de decorado). Voz igual que Nico protagonista.
- Por diseño, no se ha modificado ni el motor, ni el programa, ni los proyectos existentes.
- Los tiempos de cámara se han estimado sin TTS; al ejecutar `compile`, habrá que cotejar duración real, corregir los planos y revisar `storyboard` antes del render final.

## Reproducir en Windows
```powershell
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

Después de aprobar storyboard y voces, producir sin `--draft`. Requiere Kokoro local, Chrome/Edge y FFmpeg.
