# Informe de verificación 0.1 — 19 nov 2026

- `npm test`: 8/8 PASS.
- Prueba HTTP local: GET estado, POST chat para crear un personaje, POST chat para modificarlo, GET SVG válido como XML: PASS.
- Protocolo MCP `stdio`: initialize + tools/list: PASS. Llamada interna `asset_render_svg`: PASS.
- Importación de plan de episodio: relaciones y diálogos, referencias válidas y rollback si falla: PASS.
- Persistencia compartida: escritura concurrente desde dos instancias con bloqueo por archivo: PASS.
- Validación: colores SVG y rutas de modificación no permitidas rechazadas.
- **No se ha realizado una prueba visual end-to-end completa en navegador gráfico:** el entorno de prueba bloqueó la navegación automatizada local con `ERR_BLOCKED_BY_ADMINISTRATOR`. HTML/JS tienen validación sintáctica y los endpoints reales funcionan. Revisar manualmente en Windows antes de dar la UI por validada.
- No se ha evaluado la calidad del render final audiovisual, ya que la exportación MP4 y el TTS offline aún no están implementados.
