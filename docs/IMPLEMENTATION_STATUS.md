# Estado verificado de la implementación — v0.5 (20/11/2026)

Equipo de verificación: Windows 10 Pro, NVIDIA GeForce GTX 660 Ti **2 GB** (el objetivo era 8 GB; se ha medido en un equipo más modesto), Chrome 142 (ANGLE/Direct3D11, WebGL2), Node 24.15, FFmpeg 8 (libx264, rubberband, ebur128), voces OneCore es-ES (Pablo, Laura, Helena).

Leyenda: ✅ hecho y probado (test automático y/o inspección de fotogramas/audio) · 🟡 hecho con limitaciones conocidas · ⏳ pendiente · ❌ fallido/no viable en este equipo.

## Pruebas automáticas

`npm test`: **68 pruebas, 67 superadas, 1 omitida** (crear un enlace simbólico requiere privilegios en este equipo); `npm run typecheck` sin errores. Suites:

| Suite | Cubre |
|---|---|
| `engine.test.ts` | spline/easing, IK de dos huesos (<1 mm), **pies apoyados sin deslizar (<4 mm/fotograma) y sobre el suelo**, límites articulares durante la marcha, **determinismo independiente del orden de fotogramas**, giro de 35° + mirada a otro personaje, coger objeto (la mano llega al agarre), sujetar, soltar y caída al suelo con foley, visemas/parpadeo, tiempos relativos |
| `project.test.ts` | carga del piloto, herencia de biblioteca, personaje y animaciones creados por un agente solo con archivos, validación estricta con mensajes, traversal y rutas no editables, symlinks, migración en memoria v1, compilación del piloto, `studio migrate` |
| `audio.test.ts` | G2P español, SFX/música deterministas y con licencia, BS.1770 (−20 LUFS medido en tono de referencia) y limitador, mezcla/ducking, **TTS OneCore real + alineación + lip-sync ≤ 60 ms + caché por voz** |
| `story.test.ts` | conocimiento no recibido → error, confirmación al canon (hechos, conocimiento, relaciones), protección retroactiva, amend y revert |
| `pipeline.test.ts` | **render real Chromium/WebGL + FFmpeg** (MP4 H.264/AAC/mov_text, WAV, SRT, metadata, storyboard) y **caché incremental** (re-render sin cambios = 0 fragmentos; cambiar las chispas invalida solo su plano) |
| `ui.test.ts` | **navegador real**: un agente edita `geometry.json` y el visor se actualiza sin recargar; escritura inválida → aviso y se conserva el último estado válido; personaje nuevo aparece en el explorador; guardado del editor con 409 por conflicto; historial de versiones y reversión |
| `providers.test.ts` | selección de motor por `alternatives`, entrega por emoción, protocolo Voicebox contra un servidor local (solo loopback), **síntesis Kokoro real en español** |
| `youtube.test.ts` | OAuth bucle local + PKCE (state falsificado rechazado), renovación del token, subida reanudable (reanuda desde el byte que dice el servidor), metadatos (privado, contenido sintético, no infantil) — contra un servidor local con el protocolo de Google |
| `direction.test.ts` | cobertura automática (plano en t=0, regla de 180°, sin *jump cuts* ni destellos, insertos), actuación automática, `until`, arreglista (determinista, cortinilla y remate), ritmo con música en primer plano |
| legado (`*.test.mjs`) | v0.1–v0.4 conservados (corregidas rutas Windows) |

## «Última ronda» ep. 1 «Punto dos» (proyecto nuevo)

Comedia romántica para adultos en un bar de cócteles: Vera (dueña, vestido rojo de satén con escote, piel y pelo con brillo) y Dani (arquitecto tímido). Biblia de la serie, sinopsis, tres actos, siembras/pagos y guion en `examples/projects/ultima-ronda`. Voces **Kokoro** (Vera: mezcla `ef_dora` + `af_nicole`, más grave y lenta; Dani: `em_santa`), cobertura y actuación automáticas, banda sonora automática (tema lounge, cama de bossa, cortinillas, música romántica y remate) y un apagón con vela.

`npm run studio -- produce ultima-ronda ep-001` → **1920×1080, 24 fps, 121,9 s (2926 fotogramas), 38 planos (26 de cobertura automática y 12 insertos escritos), 38 líneas, 40 rótulos**; render 7,4 min en la GTX 660 Ti. Validación **superada**: diálogo −16,1 LUFS, mezcla −16,4 LUFS, pico −0,9 dBTP, líneas colocadas a 0 ms, paridad editor/exportación PSNR ≥ 44,1 dB, lip-sync global −20 ms con arranques de boca entre 50 y 10 ms antes del sonido, cierres ≤ 160 ms, boca abierta en silencios 0 %, ningún hueco sin diálogo fuera de la música (máx. 3,98 s cubierto por la cortinilla), diálogo en el 82 % del metraje. Revisado con fotogramas reales del MP4.

## Piloto «El último turno»

Guion en tres actos y cuatro escenas continuas (planteamiento con detonante, nudo con peor momento y giro, desenlace con clímax y *tag*), 41 líneas de diálogo, *setups/payoffs* («diez pasitos», «nada grave» → la deuda, «ajustando tornillos» → la solución, el café). Logline, sinopsis, estructura, escaleta y guion en `episodes/ep-001/sinopsis.md` y `guion.md`.

`npm run studio -- init pilot && npm run studio -- produce el-ultimo-turno ep-001` → `episodio.mp4` **1920×1080, 24 fps, 133,3 s (3199 fotogramas), 46 planos, H.264 + AAC 48 kHz estéreo + subtítulos mov_text (43 rótulos)**, `audio-master.wav`, `subtitulos.srt`, `metadata.json`, `storyboard/` y `validation-report.json` con **todas las comprobaciones superadas**:

- duración exacta, fotogramas = esperados, A/V ±3 ms; sin negros fuera de fundidos; todos los planos con detalle;
- paridad editor/exportación: PSNR mínimo 31,4 dB entre el fotograma de la Stage y el decodificado del MP4;
- diálogo −16,2 LUFS (anclado al diálogo), mezcla −15,0 LUFS, pico −1,0 dBTP; 41 líneas colocadas con desfase **0 ms** (correlación de forma de onda);
- ritmo (`pacing.deadAir`): ningún hueco sin diálogo > 2,35 s (media 0,63 s), diálogo en el 79 % del metraje;
- lip-sync: desfase global **−10 ms** (todas las líneas encadenadas); en cada arranque de voz la boca se abre entre **70 y 30 ms antes** del sonido (tolerancia: 87 ms tarde / 167 ms antes, ITU-R BT.1359 + 1 fotograma); cierres ≤ 240 ms; boca abierta en silencios largos 5,4 % del tiempo.

**Con voces Kokoro** (20/11/2026, las voces del piloto pasan a Kokoro; OneCore queda como alternativa): 122,9 s, 46 planos, validación superada (diálogo −16,0 LUFS, mezcla −15,3 LUFS, ningún hueco > 2,35 s, diálogo en el 77 % del metraje), con actuación automática y encuadre en tercios activos. Las cifras de arriba son del render con OneCore.

Voz: los motores de Windows insertan ~1 s entre frases; el TTS acorta los silencios internos a ≤ 0,36 s (0,5 s con «...», respeta `[pausa N]`) y reajusta las marcas de tiempo. El alineador a veces estiraba una palabra dentro de la pausa siguiente (boca moviéndose en silencio): `snapToSpeech` devuelve esos visemas a su palabra. Medido en 6 frases con pausas: desacuerdo voz/boca del 44,6 % al 27,7 %. La correlación de actividad por frase (`lagMs`) se conserva en el informe solo como dato: en frases cortas su curva es casi plana (p. ej. 0,51 en 0 ms frente a 0,56 en −250 ms) y no distingue desfases.

Contenido verificado viendo fotogramas reales del MP4: dos personajes procedurales distintos y reconocibles; taller reutilizable; robot articulado averiado (panel, cabeza, chispas, ojo parpadeante); dos voces españolas diferenciadas (Pablo −2,5 st con EQ grave; Laura); emociones (preocupación, miedo, nervios, enfado, ironía, sonrisa); entrar caminando por la puerta y detenerse; **giro corporal de 35°**; miradas automáticas entre personajes y a objetos; Bruno sujeta, esconde y deja caer el fusible (cae con rebotes y sonido metálico); Lara se acerca, lo recoge y lo muestra; planos generales, medios, primeros planos, contraplanos por encima del hombro, inserto; **encadenado** y fundidos; ambiente de taller, puerta, chispas, servo, pitidos, pasos, impactos; música procedural con ducking; subtítulos.

Tiempo: render completo 1080p del piloto (133 s) ≈ 7,6 min en esta GPU (GTX 660 Ti); con caché, una re-exportación tras cambiar una escena solo renderiza los planos afectados. Reanudación verificada: un render 1080p interrumpido por un fallo reutilizó 14 de 22 fragmentos al relanzarlo.

## Estado por área

| Área | Estado | Notas |
|---|---|---|
| Estructura file-first, IDs estables, esquemas versionados, validación estricta, escrituras atómicas, conflictos por hash | ✅ | zod; migración v1→v2 en memoria y `studio migrate` |
| Historial de cambios y reversión de archivos | ✅ | `generated/history/` (editor y cambios de agentes detectados por el servidor), API y CLI |
| Actualización en vivo del editor (SSE), archivos incompletos | ✅ | debounce, se conserva el último estado válido |
| Personajes procedurales (cuerpo, cabeza, rasgos, pelo, barba, ropa, accesorios, toon + contorno) | ✅ 🟡 | calidad *prototipo toon*: la ropa es color/volumen sobre el cuerpo, no tela simulada; rasgos faciales rígidos sobre la cabeza (sin deformación de piel) |
| Esqueleto, skinning, IK brazos/piernas, pelvis, apoyos | ✅ | IK analítico de dos huesos con eje de bisagra; solver de pelvis |
| Giro libre de cuerpo/cabeza/ojos | ✅ | verificado 0/35/90/180/270° en hojas de giro |
| Expresiones (10 pedidas + sonrisa irónica, preocupación, asco, determinación) combinables con habla | ✅ | |
| Animaciones genéricas por rig (idle, walk, run, jump, crouch, point, pick-up, hold-object, sit, stand, turn…) heredables | ✅ | muestrario `episodes/muestrario` revisado fotograma a fotograma: saludar, correr, dar un objeto, saltar (pies y sombra separados del suelo), caminar, sentarse en el taburete y levantarse |
| Motor de animación declarativo: keyframes, curvas, capas, aditivos, IK en clips, contactos, root motion paramétrico, determinismo | ✅ | |
| Objetos con anclajes, articulaciones, agarres, caída física simplificada | ✅ | sin física de colisiones generales (no se pretende) |
| Escenarios procedurales (habitaciones con aberturas, luces, decoración; exteriores básicos) | ✅ 🟡 | exteriores menos trabajados que interiores |
| Cámaras: encuadres, movimientos, oclusión, paredes, transiciones | ✅ | |
| TTS offline español por personaje, caché, prosodia emocional, pausas | ✅ 🟡 | licencia comercial de las voces de Windows **sin confirmar** (`commercialUse: "unknown"`); adaptador Piper escrito pero **no probado** (no hay binario/modelo instalado) |
| Alineación fonética → visemas, mezcla con expresiones, comprobación de desfase | ✅ | G2P por reglas + Viterbi con anclas de palabra del motor TTS |
| SFX, ambientes y música procedurales; ducking; normalización; limitador | ✅ 🟡 | la música procedural es funcional y discreta, no comparable a una banda sonora compuesta |
| Story Studio (canon, conocimiento, relaciones, cronología, propuestas, confirmación, protección) | ✅ | |
| Editor web React (explorador, visor, gizmos, inspector paramétrico, timeline multipista con arrastre, guion con voz, historia, render) | ✅ 🟡 | sin deshacer/rehacer en memoria (hay historial de archivos); gizmos solo para la pose inicial de actores; edición de cámaras/acciones por JSON o arrastre de tiempo |
| CLI para agentes | ✅ | `npm run studio -- help` |
| Exportación MP4/WAV/SRT/metadata/storyboard/validación | ✅ | |
| Caché por huella de estado, reanudación | ✅ | |
| Producción de 20 minutos | ver abajo | |
| GLB/glTF compilado | ✅ | `studio export character|prop` → `compiled/<id>.glb` con mallas con skinning y esqueleto de 22 huesos (test de ida y vuelta con GLTFLoader); el render sigue generando la geometría desde los parámetros |
| Remotion | descartado | no aporta ventaja: la Stage de Three.js ya es determinista por fotograma y se captura directamente |
| Director IA dentro de la app | no se implementa por diseño | lo hacen agentes externos con el CLI y los formatos |

## Prueba de larga duración (20 minutos)

Episodio técnico generado con `node scripts/bench-long.ts el-ultimo-turno 20 ep-larga`: 20 escenas × 60 s, 160 líneas de diálogo con TTS real, caminatas, giros, gestos, recogidas y 180 planos, 1920×1080 a 24 fps (28 800 fotogramas). **No es una prueba de calidad narrativa.**

Resultados (verificados con `validate episode`, informe en `output/validation-report.json`):

| Medida | Resultado |
|---|---|
| Vídeo | H.264 1920×1080, **28 800 fotogramas exactos**, 1199,99 s; audio AAC 48 kHz 1200,00 s; 160 subtítulos |
| Tiempo de render | 50,8 min para 233 fragmentos (≈ 8,7 fps medios) + 27 fragmentos reutilizados de una ejecución interrumpida |
| Estabilidad | 0 reintentos tras introducir el reciclado del navegador (39 reciclados, cada ≈ 720 fotogramas); memoria del proceso Node ≤ 403 MB; memoria de GPU ≤ 1 428 / 2 048 MiB |
| Recuperación | ejecución detenida a mano a mitad → al relanzar se reutilizaron los 27 fragmentos completos y se descartaron los parciales |
| Caché | re-ejecución sin cambios: 260/260 fragmentos reutilizados, episodio reensamblado y remezclado en 84–104 s |
| Sincronía | 160 líneas colocadas con desfase 0 ms; lip-sync ≤ 50 ms; A/V 11 ms |
| Paridad editor/exportación | PSNR mínimo 43,2 dB en los 180 planos |
| Sonoridad | diálogo −16,0 LUFS (normalización anclada al diálogo), mezcla −21,7 LUFS integrados, pico −0,9 dBTP |
| Edición | la API del editor compila cualquier escena del episodio para el visor; la timeline muestra sus 9 planos |

Hallazgos corregidos gracias a esta prueba: bloqueos de Chromium tras ~1 000 fotogramas 1080p consecutivos (ahora se recicla el navegador y cada lote tiene un tiempo límite de 45 s), un fallo `EBUSY` en la ruta de reintento que ocultaba la causa, y una normalización de sonoridad que comprimía la voz en episodios con pocos diálogos (ahora compresor de diálogo + normalización anclada al diálogo).

## Limitaciones conocidas

- En algún plano con cámara de seguimiento baja un objeto grande puede tapar parcialmente la acción (piloto: Lara recoge el fusible tras el robot); el agente debe revisar el storyboard y ajustar el plano.
- El adaptador Piper está implementado pero no probado (no hay binario ni modelo de licencia verificada instalados).
- **Voicebox**: el cliente sigue la API documentada en el código de Voicebox (`GET /profiles`, `POST /generate/stream` con `instruct`) y está probado contra un servidor local que la imita, **no contra la app real** (no está instalada en el equipo de verificación; sus motores Qwen3-TTS necesitan GPU con CUDA moderno para ir a velocidad útil, esta GTX 660 Ti no sirve).
- **YouTube**: OAuth (bucle local + PKCE) y la subida reanudable están probados contra un servidor local con el mismo protocolo (incluido reanudar un fragmento a medias y renovar el token), **no contra Google**: no hay credenciales en el equipo. Los proyectos de API sin verificar por Google solo pueden subir vídeos privados.
- Kokoro en español tiene tres voces (una femenina); para más personajes se mezclan estilos (`ef_dora:0.8+af_nicole:0.2`) y se ajusta el tono. Kokoro no tiene control explícito de emoción: la emoción se aproxima con velocidad, tono, ganancia y mezcla de voz por emoción; Voicebox (Qwen) sí admite instrucciones de entrega.
- El borde del escote se calcula por píxel en el sombreador; las prendas siguen siendo regiones de color del mismo tubo (sin tela separada ni simulación).

- Estética «toon procedural»: personajes de cartón piedra estilizados, sin deformaciones faciales, sin pelo/tela con simulación secundaria, sin dedos animados individualmente (solo cierre de mano).
- La navegación de personajes evita a otros personajes, pero no a muebles (las rutas las decide el autor de la escena).
- La licencia comercial de las voces de Windows debe revisarla el usuario antes de distribuir; Piper (con modelos de licencia verificada) es la alternativa prevista.
- El rendimiento depende de la GPU: en una GTX 660 Ti, ~8–11 fps a 1080p.
