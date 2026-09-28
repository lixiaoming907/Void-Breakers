export {};

export type GameDiagnostics = {
  frame: number;
  elapsed: number;
  score: number;
  wave: number;
  state: string;
  complete: boolean;
  enemies: number;
  bullets?: number;
  weapon?: string;
  upgrades?: number;
  shield?: number;
  player: {
    position: { x: number; y: number; z: number };
    health: number;
    speed: number;
    yaw?: number;
  };
  shieldWorld?: { x: number; y: number; z: number };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
};

declare global {
  interface Window {
    __THREE_GAME_TEST_HOOKS__?: {
      seed: (value: number) => void;
      setState: (name: string) => { state: string };
      setPausedForScreenshot: (paused: boolean) => void;
      setReducedMotion: (enabled: boolean) => void;
      hideDebugUi: (hidden?: boolean) => void;
    };
    __THREE_GAME_DIAGNOSTICS__?: GameDiagnostics;
  }
}
