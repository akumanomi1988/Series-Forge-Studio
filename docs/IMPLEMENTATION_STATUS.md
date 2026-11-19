# Estado real — Series Forge Studio

## v0.2 (nuevo, file-first)

- Implementado: archivos por universo/asset, plantilla de personaje con `rig.json`, `geometry.json`, fichas narrativas, expresiones y clips; proyecto demo reproducible, inspector web, SSE, edición atómica con hash, rotación corporal Y y giro de cabeza independiente, entorno/props básicos y escena con timeline declarativa, compilación de plan de episodio, importación parcial, seguridad de rutas.
- Verificación local: ejecutar `npm test`, `npm run check`, `npm run demo`, `npm run plan -- demo-de-produccion piloto`.
- Visor 3D: requiere `npm install` para obtener Three.js; la previsualización WebGL de navegador debe verificarse en el equipo de destino. No afirmar verificación visual completa sin capturas reproducibles.
- Limitación: el ajuste de giro desde sliders del visor de personaje es previsualización temporal. Para persistir orientación en escenas, modificar `scene.json`.
- Pendiente: editor visual completo de rig/geometry, IK, skins, locomoción correcta con contactos, props con agarres, blender de animaciones, lipsync, voz, SFX, Remotion, MP4 y producción verificada de 20 min.

## v0.1 (legado, preservado)

- Editor SVG y almacén único `data/studio.json`; chat basado en reglas y endpoint LLM opcional; MCP stdio JSON-RPC; relaciones y narrativa; primera prueba de concepto.
- Se conserva accesible mediante `npm run legacy` en otro puerto. Los endpoints MCP originales siguen apuntando al almacenamiento v0.1, **no** al workspace file-first v0.2. No confundir.
- Migración v0.1 -> v0.2: crea una copia de entidades y preserva el archivo legado; las escenas y diálogos deben migrarse manualmente.