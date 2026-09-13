export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Renderer = 'webgl2' | 'webgpu';
export type Scene = 'Daylight' | 'Golden hour' | 'Storm' | 'Backlit' | 'Overcast' | 'Silver lining';

/** Every option is optional; only the canvas argument is required. */
export interface CloudOptions {
  renderer?: Renderer;
  scene?: Scene;
  animate?: boolean;
  speed?: number;
  time?: number;
  width?: number;
  height?: number;
  pixelRatio?: number;
  resolution?: number;
  maxPixels?: number;
  yaw?: number;
  pitch?: number;
  distance?: number;
  fov?: number;
  target?: Vec3;
  offset?: Vec2;
  scale?: Vec3;
  density?: number;
  coverage?: number;
  softness?: number;
  baseHeight?: number;
  baseSoftness?: number;
  blend?: number;
  noiseScale?: number;
  billow?: number;
  erosion?: number;
  detail?: number;
  turbulence?: number;
  seed?: number;
  lightDirection?: Vec3;
  sunIntensity?: number;
  lightColor?: Vec3;
  cloudColor?: Vec3;
  shadowColor?: Vec3;
  ambient?: number;
  ambientGradient?: number;
  absorption?: number;
  shadowStrength?: number;
  scattering?: number;
  anisotropy?: number;
  powder?: number;
  silverLining?: number;
  exposure?: number;
  skyTop?: Vec3;
  skyBottom?: Vec3;
  skyGradient?: number;
  sunGlow?: number;
  transparent?: boolean;
  opacity?: number;
  wind?: Vec3;
  steps?: number;
  lightSteps?: number;
  lightDistance?: number;
  jitter?: number;
  onRender?: (time: number, deltaSeconds: number) => Partial<CloudState> | void;
  onError?: (error: Error) => void;
}
export type CloudState = Required<Omit<CloudOptions, 'onRender' | 'onError'>>;
export interface CloudMemory {
  /** Procedural shape data within cpu; do not add it to total again. */
  shapeBytes: number;
  cpu: number;
  gpu: number;
  surface: number;
  total: number;
  estimated: true;
}
export interface Cloud {
  readonly backend: Renderer;
  /** Uncompressed UTF-8 shader source bytes for the active renderer. */
  readonly sourceBytes: number;
  readonly options: CloudState;
  readonly stats: { frames: number; time: number; width: number; height: number };
  readonly memory: CloudMemory;
  update(patch: Partial<CloudState>): void;
  /** Poke or scatter the cloud. Coordinates and movement are fractions of canvas size. */
  disturb(x: number, y: number, deltaX?: number, deltaY?: number): void;
  render(time?: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
export const scenes: { name: Scene; values: Partial<CloudState> }[];
export function defaultOptions(): CloudState;
export default function createCloud(canvas: HTMLCanvasElement, options?: CloudOptions): Promise<Cloud>;
