/** Resolved (compiled) scene timeline. Produced by director.ts, consumed by pose/scene evaluators.
 * Everything is absolute scene time in seconds; evaluation is a pure function of time. */
import type { Vec3 } from './math.ts';
import type { CameraSpec, Locomotion, ClipV2, ExpressionV2, PropGeometry, EnvironmentV2, CharacterGeometry } from './schema.ts';

export type TargetRef =
  | { kind: 'point'; position: Vec3 }
  | { kind: 'actor'; actor: string; bone: string }
  | { kind: 'prop'; prop: string; anchor?: string }
  | { kind: 'camera' }
  | { kind: 'bone'; bone: string; offset: Vec3 } // own body relative (offset in actor-yaw space, scaled by body)
  | { kind: 'blend'; from: TargetRef; to: TargetRef; start: number; end: number; ease?: string };

export interface Step { foot: 'left' | 'right'; start: number; end: number; from: Vec3; to: Vec3; yawFrom: number; yawTo: number; lift: number }
export interface RootSegment {
  start: number; end: number; kind: 'hold' | 'walk' | 'turn';
  from: Vec3; to: Vec3; yawFrom: number; yawTo: number;
  gait?: Locomotion; ease?: string;
}
export interface ClipInstance { clip: string; start: number; end: number; speed: number; fadeIn: number; fadeOut: number; loop: boolean; weight: number; target?: TargetRef; source?: string }
export interface LookInstance { start: number; end: number; target: TargetRef; mode: 'eyes' | 'head' | 'chest'; fade: number; source?: string }
export interface ExpressionInstance { start: number; end: number; expression: string; intensity: number; fade: number; source?: string }
export interface SpeechInstance { lineId: string; start: number; end: number; visemes: [number, string][]; text: string }
export interface HandInstance { hand: 'left' | 'right'; start: number; end: number; target: TargetRef; fadeIn: number; fadeOut: number; grip: number; source?: string }
export interface HipsInstance { start: number; end: number; offset: Vec3; spinePitch: number; fadeIn: number; fadeOut: number; source?: string }
export interface SitInstance { start: number; end: number; seat: Vec3; yawDeg: number; fadeIn: number; fadeOut: number }

export interface ActorTimeline {
  id: string; characterId: string; idleClip: string; baseExpression: string;
  root: RootSegment[]; steps: Step[];
  clips: ClipInstance[]; looks: LookInstance[]; expressions: ExpressionInstance[]; speech: SpeechInstance[];
  hands: HandInstance[]; hips: HipsInstance[]; sits: SitInstance[];
}
export type PropSegment =
  | { kind: 'static'; start: number; end: number; position: Vec3; yawDeg: number; rotationDeg?: Vec3 }
  | { kind: 'on'; start: number; end: number; prop: string; anchor: string; offset: Vec3; yawDeg: number }
  | { kind: 'held'; start: number; end: number; actor: string; hand: 'left' | 'right' }
  | { kind: 'fall'; start: number; end: number; actor: string; hand: 'left' | 'right'; floorY: number; seed: number; impacts: number[]; rest: Vec3; restRotationDeg: Vec3; restYaw: number };
export interface PropJointAnim { joint: string; start: number; end: number; fromDeg: number; toDeg: number; ease?: string }
export interface PropTimeline { id: string; propId: string; scale: number; segments: PropSegment[]; joints: PropJointAnim[] }
export interface EffectInstance { effect: 'sparks' | 'smoke' | 'flicker' | 'glow'; start: number; end: number; prop?: string; part?: string; position?: Vec3; intensity: number; seed: number }
export interface ResolvedShot { id: string; start: number; end: number; camera: CameraSpec; transitionIn?: { type: 'cut' | 'dissolve' | 'fade' | 'iris' | 'wipe'; durationSec: number } }
export interface AudioCue { id: string; kind: 'dialogue' | 'sfx' | 'ambience' | 'music'; sound: string; start: number; duration: number; gainDb: number; fadeIn: number; fadeOut: number; pan: number; duck: boolean; file?: string; actor?: string; text?: string; auto?: boolean }

export interface AssetLibrary {
  characters: Record<string, { geometry: CharacterGeometry; rigOffsets: Record<string, Vec3>; legacy?: unknown; clips: Record<string, ClipV2>; locomotion: Record<string, Locomotion>; expressions: Record<string, ExpressionV2> }>;
  props: Record<string, PropGeometry>;
  environments: Record<string, EnvironmentV2>;
}
export interface ResolvedScene {
  schemaVersion: 2; id: string; name: string; durationSec: number; environmentId: string | null;
  actors: ActorTimeline[]; props: PropTimeline[]; effects: EffectInstance[]; shots: ResolvedShot[]; audio: AudioCue[];
  subtitles: { start: number; end: number; actor: string; text: string; lineId: string }[];
  transitionOut?: { type: 'cut' | 'fade'; durationSec: number };
  warnings: string[];
}
