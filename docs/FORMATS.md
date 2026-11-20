# Formatos de datos (v2) — referencia para agentes

Todo es JSON/Markdown editable dentro de `workspace/<proyecto>/`. Los esquemas exactos (zod, estrictos: un campo desconocido es un error) están en `src/engine/schema.ts`. Ejecuta `npm run studio -- validate <proyecto>` después de escribir archivos: imprime la ruta y el campo de cada error.

Convenciones: metros, **Y arriba**, el personaje mira a **+Z**, su **izquierda es +X**, ángulos en **grados**. IDs: `[a-z0-9][a-z0-9_-]*`, estables e independientes del nombre visible. Tiempos en segundos de la escena.

```text
workspace/<proyecto>/
  project.json                       { schemaVersion:2, id, name, language, fps }
  characters/<id>/  manifest.json geometry.json rig.json voice.json relaciones.json *.md
                    animations/*.json   expressions/*.json      (opcionales: heredan de la biblioteca)
  props/<id>/       manifest.json geometry.json descripcion.md
  environments/<id>/ manifest.json environment.json descripcion.md
  animations/humanoid/*.json         clips propios del proyecto (sobrescriben la biblioteca)
  expressions/humanoid/*.json
  audio/sfx/*.json  audio/music/*.json  (sobrescriben/añaden a library/audio)
  story/canon.json canon.md timeline.json history/
  episodes/<id>/ episode.json sinopsis.md guion.md story.json scenes/sc-001/scene.json
                 generated/ (regenerable)  output/ (entregables)
```

Herencia de animaciones y expresiones: `library/humanoid/` → `<proyecto>/animations|expressions/humanoid/` → `characters/<id>/animations|expressions/`. Un archivo con el mismo nombre sobrescribe al anterior **solo para ese ámbito**.

## Personaje

`manifest.json`: `{ "schemaVersion": 2, "id": "bruno", "type": "character", "name": "Bruno Castell", "rigType": "humanoid" }` (campos extra permitidos: edad, tags…).

`geometry.json` (generador `humanoid-toon`, todo paramétrico; omitir un campo = valor por defecto):

| bloque | campos |
|---|---|
| `body` | `height` (m), `headScale`, `headWidth`, `jaw` 0–1, `shoulderWidth`, `hipWidth`, `torsoScale`, `legScale`, `armScale`, `armThickness`, `legThickness`, `chestDepth`, `belly` 0–1, `chest` 0–1, `neckLength`, `footSize`, `handSize`, `skinColor` |
| `face` | `eyeSize`, `eyeSpacing`, `eyeHeight`, `irisColor`, `eyeShape` (round/almond/narrow), `browThickness`, `browColor`, `noseShape` (button/round/pointy/long/wide), `noseSize`, `mouthWidth`, `lipColor`, `earSize`, `blush` |
| `hair` | `style` (short, spiky, bob, ponytail, bun, long, curly, mohawk, bald, buzz, sidepart), `color`, `volume` |
| `beard` | `style` (none, stubble, full, goatee, mustache, chinstrap), `color` |
| `outfit` | `top.type` (tshirt, longsleeve, jacket, hoodie, vest, overalls, labcoat, tanktop, dress) + `color`/`secondaryColor`; `bottom.type` (pants, shorts, skirt) + `color`; `shoes.type` (sneakers, boots, shoes, sandals) + `color`/`soleColor`; `gloves.color` |
| `accessories[]` | `type` (goggles, glasses, toolbelt, cap, beanie, headset, scarf, badge, apron, watch, earrings, bandana, backpack), `color`, `secondaryColor`, `position` |
| `parts[]` | primitivas extra (`box/sphere/capsule/cylinder/cone/torus/roundedBox`) pegadas a un hueso (`bone`) o a `headGroup` |
| `outlineWidth` | grosor del contorno toon (m) |

`rig.json`: `{ "schemaVersion":2, "type":"humanoid", "template":"humanoid-v2", "boneOffsets": { "<hueso>": [dx,dy,dz] } }`. Huesos: `root hips spine chest neck head left|rightShoulder left|rightUpperArm left|rightLowerArm left|rightHand left|rightThigh left|rightShin left|rightFoot left|rightToe`. El esqueleto se deriva de `body`; los límites articulares están en `src/engine/humanoid.ts` (`JOINT_LIMITS`).

`voice.json`:
```json
{ "schemaVersion": 2, "provider": "windows-onecore", "voice": "Microsoft Pablo", "language": "es-ES",
  "rate": 0.96, "pitchSemitones": -2.5, "formantPreserve": true, "gainDb": 0,
  "eq": { "lowDb": 2.5, "midDb": 0, "highDb": -1.5 }, "emotionProsody": true,
  "license": { "id": "windows-onecore-voices", "commercialUse": "unknown", "notes": "…" } }
```
Proveedores: `windows-onecore` (voces OneCore instaladas: `npm run studio -- voices`), `windows-sapi`, `piper` (binario local en `tools/piper` o `SERIES_FORGE_PIPER`, `voice` = ruta o nombre del `.onnx`), `silent` (solo pruebas). `commercialUse: "restricted"` bloquea la síntesis.

## Animaciones

Clip de keyframes (`animations/<id>.json`):
```json
{ "schemaVersion": 2, "id": "saludo", "duration": 1.8, "loop": false, "layer": "arms",
  "tracks": [ { "bone": "rightUpperArm", "property": "rotation", "keys": [ { "t": 0, "v": [0,0,-6] }, { "t": 0.3, "v": [-20,0,-135], "ease": "easeOut" } ] },
              { "bone": "hips", "property": "position", "keys": [ { "t": 0, "v": [0,0,0] } ] } ],
  "ik": [ { "chain": "rightArm", "target": { "bone": "head", "offset": [0,0.02,0.16], "space": "bone" }, "weight": [[0,0],[0.5,1]] } ],
  "contacts": [ { "foot": "both", "from": 0, "to": 0.36 } ], "grip": { "right": 0.8 }, "face": [ { "param": "mouthSmile", "keys": [ { "t": 0, "v": 0.5 } ] } ] }
```
- `rotation`: grados Euler XYZ relativos a la pose de reposo (brazos colgando). Brazos/piernas: X **negativo** = hacia delante; codo dobla con X negativo, rodilla con X positivo; columna X positivo = inclinarse hacia delante; Y positivo = girar a su izquierda.
- `position`: desplazamiento en metros (útil en `hips`; las piernas se resuelven por IK y los pies quedan apoyados).
- `ease`: `spline` (Catmull-Rom, por defecto), `linear`, `step`, `smooth`, `easeIn`, `easeOut`, `easeInOut`, `back`, `bounce`.
- `layer`: `full`, `upper`, `lower`, `arms`, `head`, `additive` (o `mask` explícita).
- `ik.target` sin `bone` y `space: "actor"`: apunta al `target` de la acción `play` (señalar).
- `contacts`: cuándo los pies están apoyados (fuera de contacto, la pierna sigue el clip: saltos).

Locomoción paramétrica (`walk`, `run`, `sneak`, `walk-tired`, `walk-brisk`…):
```json
{ "schemaVersion": 2, "id": "walk-cojo", "kind": "locomotion", "gait": "limp", "speed": 0.9, "strideScale": 0.8,
  "stepHeight": 0.07, "bob": 0.04, "sway": 0.035, "hipYawDeg": 4, "armSwingDeg": 14, "elbowBendDeg": 20, "leanDeg": 6, "crouch": 0.03 }
```
El motor planifica pasos, apoyos sin deslizamiento (IK), balanceo de pelvis, brazos y giros.

## Expresiones

```json
{ "schemaVersion": 2, "id": "enfado-contenido",
  "face": { "browAngleL": -0.7, "browAngleR": -0.7, "lidUpperL": 0.3, "lidUpperR": 0.3, "mouthSmile": -0.4, "mouthPress": 0.5 },
  "posture": { "chest": [3, 0, 0] }, "clip": "laugh-body", "blinkRate": 1.5 }
```
Parámetros faciales: `browRaiseL/R`, `browAngleL/R` (+ interior arriba / − interior abajo), `lidUpperL/R` (0 abierto…1 cerrado), `lidLowerL/R`, `eyeScale`, `pupilScale`, `mouthOpen`, `mouthWide`, `mouthSmile`, `mouthRound`, `mouthAsym`, `teethShow`, `mouthPress`, `cheekRaise`, `headTiltDeg`, `headNodDeg`. El lip-sync se mezcla encima: los visemas controlan apertura/forma y la expresión conserva cejas, ojos y sonrisa.

## Objetos (props)

```json
{ "schemaVersion": 2, "generator": "robot", "params": { "height": 1.1, "damaged": true, "color": "#c8ccd2" },
  "anchors": { "grip": { "position": [0, 0.03, 0] } }, "joints": {}, "material": "metal", "restHeight": 0.03 }
```
Generadores: `parts, robot, workbench, chair, stool, door, shelf, toolbox, crate, lamp, mug, wrench, component, monitor, console, barrel, plant, table, sofa, bed, pipe, tree, building, streetlamp, bench, fence, car`. Cada generador aporta anclajes (`grip`, `seat`, `top`, `handle`, `panel`, `eye`…) y articulaciones (`robot`: `head`, `armL`, `armR`, `panel`; `door`: `leaf`; `toolbox`: `lid`) que el archivo puede sobrescribir. `material` elige el foley de impacto (`impact-metal`, `impact-wood`…). Con `generator: "parts"` se construye cualquier objeto con primitivas; una parte con `pivot` gira con esa articulación.

## Escenario

`environment.json`: `kind` (`room`|`exterior`), `size` [ancho, alto, fondo], `floor` (`color`, `pattern`: tiles/planks/concrete/grass/asphalt/plain), `walls` (`color`, `trimColor`, `sides`, `panel`), `openings[]` (ventanas/puertas por pared con `offset`, `width`, `height`, `sill`, `glow`), `lights[]` (`key/fill/rim/point/spot`, `position`, `target`, `color`, `intensity`, `castShadow`, `flicker`), `ambient`, `fog`, `props[]` (objetos fijos del decorado con `id` propio, utilizables por las escenas), `decor[]` (poster, pipe, shelf-boxes, vent, sign, clock, pegboard). Las paredes son sólidas para la cámara.

## Escena (`episodes/<ep>/scenes/sc-NNN/scene.json`)

```json
{ "schemaVersion": 2, "id": "sc-001", "name": "…", "environmentId": "taller", "durationSec": "auto", "tailSec": 0.8, "autoLook": true,
  "actors":  [ { "id": "bruno", "characterId": "bruno", "position": [-0.55,0,-0.5], "yawDeg": 72, "expression": "worried", "idle": "idle" } ],
  "props":   [ { "id": "fusible", "propId": "fusible-nucleo", "heldBy": { "actor": "bruno", "hand": "right" } } ],
  "actions": [ … ], "dialogue": [ … ], "shots": [ … ], "sound": [ … ], "transitionOut": { "type": "fade", "durationSec": 0.6 } }
```

**Tiempo relativo** (en acciones, diálogos, planos y sonidos): `at` (absoluto) | `after: "<id>"` (al terminar) | `with: "<id>"` (al empezar), más `offset`. Un diálogo sin tiempo va detrás del anterior (+ su `pauseAfter`, 0,25 s por defecto: ritmo de conversación); una acción sin tiempo va detrás de la acción anterior del mismo actor. Las duraciones reales de voz salen del TTS, así que el montaje se ajusta solo.

Acciones (`type`):
| tipo | campos clave |
|---|---|
| `walk` | `actor`, `to`: `[x,0,z]` · `{prop, anchor, distance}` · `{actor, distance}`; `gait`, `speed`, `faceTo`. Evita atravesar a otros actores y rodea al que bloquea. |
| `turn` | `yawDeg` (absoluto) · `by` (relativo) · `towards` (objetivo); `durationSec` |
| `lookAt` | `target`: id de actor/objeto, `[x,y,z]`, `"camera"`; `mode`: eyes/head/chest; `durationSec` |
| `play` | `clip`, `durationSec`, `speed`, `loop`, `fadeIn/Out`, `weight`, `target` (para `point`) |
| `expression` | `expression`, `intensity`, `fade`, `durationSec` (sin duración: persiste hasta la siguiente) |
| `pickUp` / `drop` / `place` / `give` / `hold` | `prop`, `hand`; `hold.pose`: front/behind/raised/show/side; `place.on`; `give.to`. `drop` simula caída con rebotes y genera foley de impacto. |
| `sit` / `stand` | `prop` con anclaje `seat` |
| `propJoint` | `prop`, `joint`, `toDeg`, `fromDeg`, `durationSec`, `sound` (abrir puertas, cabeza del robot…) |
| `effect` | `effect`: sparks/smoke/flicker/glow/off; `prop`+`part` o `position`; `sound`. `off` apaga un aparato (sus luces y el brillo de la parte indicada, p. ej. `screen`) mientras dura; no alarga la escena, así que admite duraciones largas |

Diálogo: `{ "id", "actor", "text", "to", "emotion", "intensity", "direction", "gesture", "pauseAfter", "rate", "pitchSemitones", "knowledge": [hechos que debe conocer], "reveals": [hechos que revela] }`. `emotion` acepta ids o sinónimos españoles (enfado, alegría, ironía…). `direction` con «susurrando/en voz baja» o «gritando» modifica la prosodia. `[pausa 0.8]` dentro del texto inserta un silencio intencionado (no aparece en subtítulos); el resto de silencios internos de la voz se acortan a ≤ 0,36 s (0,5 s con «...»). Con `autoLook` el que escucha mira al que habla.

Planos: `{ "id", "at|after|with", "camera": {…}, "transitionIn": { "type": "cut|dissolve|fade|iris|wipe", "durationSec" } }`. Cámara `static` (`position`, `target`, `fov`) o por encuadre: `framing` = establishing/wide/full/medium/medium-close/close/extreme-close/two-shot/over-shoulder/insert con `subject`/`subjects`/`over`, `azimuthDeg`, `elevationDeg`, `side`, `track`, `move` (`push-in`, `pull-out`, `orbit`, `truck`, `crane`, `dolly` + `amount`), `handheld` 0–1. El encuadre usa la dirección real de la cara durante el plano, evita que otro actor o un objeto grande tape al sujeto y no atraviesa paredes.

Sonido: `{ "kind": "sfx|ambience|music", "sound": "<id>", "at|after|with", "durationSec", "gainDb", "fadeIn", "fadeOut", "pan" }`. Los pasos, agarres, impactos y crujidos se generan solos (foley automático).

## Episodio y sonido

`episode.json`: `{ "schemaVersion":2, "id", "type":"episode", "name", "number", "scenes": ["sc-001",…], "music": [SoundEvent con at global o with:"sc-002"], "render": { "width":1920, "height":1080, "fps":24, "sampleRate":48000, "loudnessLufs":-16 }, "status" }`.

`audio/sfx/<id>.json`: `{ "schemaVersion":2, "id", "kind":"sfx|ambience", "generator": metal-impact|footstep|door-creak|robot-beep|servo|sparks|workshop-hum|whoosh|click|thud|room-tone|rain|wind|birds|traffic|file, "params":{…}, "durationSec", "seed", "file", "license" }`. `audio/music/<id>.json`: compositor procedural (`tempo`, `key`, `mode`, `progression` en grados romanos, `instruments`: pad/bass/arp/pluck/drums/bell/lead) o `generator: "file"` con licencia declarada.

## Historia (Story Studio)

- `story/canon.json`: `facts[]` (`id`, `text`, `since`, `status: canon`, `amended[]`), `characters{}` (`knows[]`, `emotionalState`, `goals[]`, `arc[]`), `relationships[]` (`a`, `b`, `type`, `trust` −1…1, `history[]`), `confirmedEpisodes[]`, `integrity`.
- `episodes/<ep>/story.json`: propuestas del episodio (`facts`, `knowledge`, `relationships` con `trustDelta`, `emotionalStates`, `events`), `status: draft` hasta `studio story confirm`.
- Reglas comprobadas por `validate`: un personaje no usa (`knowledge`) un hecho antes de recibirlo; los `reveals` deben estar declarados; el canon confirmado no puede editarse a mano (usa `story amend` con motivo o `story revert`).
