# Casi normales — La peor cita del mundo

Proyecto de contenido independiente para Series Forge Studio. **No sustituye** los ejemplos `ultima-ronda` ni `el-ultimo-turno`. Personajes, escenas, voces y decorados procedurales; 100 % datos JSON/Markdown, sin modificar código del motor.

## Activación
En Windows, desde la raíz del repositorio:
```powershell
Copy-Item -Recurse examples/projects/casi-normales workspace/
npm run studio -- validate casi-normales
npm run studio -- preview character casi-normales nico
npm run studio -- preview character casi-normales vera
npm run studio -- preview scene casi-normales ep-001 sc-001
npm run studio -- compile episode casi-normales ep-001
npm run studio -- produce casi-normales ep-001 --draft
```

*El personaje técnico `nico-voz` comparte voz con Nico y se ubica fuera de plano. Permite narración retrospectiva con el esquema actual; los planos del piloto son manuales para no enfocar al narrador. No cambiar el motor para eludir esta limitación.*
*El objetivo son ~20 minutos, sujeto a las duraciones reales de Kokoro; no se certifica duración ni render hasta ejecutar el pipeline y revisar la QA.*
*Para producción comercial, revisar licencias de cualquier perfil de voz personalizado.*
