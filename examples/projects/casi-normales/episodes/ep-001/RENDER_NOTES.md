# Entrega del piloto — estado de producción

Guion y escenas listos para validación con el motor v0.5; no equivale a MP4 exportado.

- 13 escenas, 327 intervenciones y 4110 palabras dialogadas (incluida narración).
- Narrador en pasado, perfil técnico `nico-voz` posicionado fuera de cámara. Se necesitan cámaras manuales; la cobertura automática enfocaría al narrador.
- Los planos se distribuyen temporalmente por estimación, pero las duraciones reales dependen de Kokoro; al producir, comprobar encuadres, continuidad y voz.
- Sinopsis, guion, propuestas de canon, música procedural y personajes en archivos independientes.
- Se han respetado los formatos de `docs/FORMATS.md`; todavía debe ejecutarse `npm run studio -- validate casi-normales` en un equipo con el proyecto instalado, seguido de previsualización y `produce --draft`.
- No confirmar el canon antes de visualizar y aprobar el vídeo.

## Comandos
```powershell
Copy-Item -Recurse examples/projects/casi-normales workspace/
npm run studio -- validate casi-normales
npm run studio -- compile episode casi-normales ep-001
npm run studio -- preview scene casi-normales ep-001 sc-007
npm run studio -- produce casi-normales ep-001 --draft
npm run studio -- validate episode casi-normales ep-001
```
