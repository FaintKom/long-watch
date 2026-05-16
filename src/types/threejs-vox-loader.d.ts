declare module 'threejs-vox-loader' {
  import * as THREE from 'three';

  export interface VOXLoaderOptions {
    defaultMaterialOptions?: {
      flatShading?: boolean;
      roughness?: number;
      metalness?: number;
    };
    enableMetalness?: boolean;
    enableRoughness?: boolean;
    enableGlass?: boolean;
    enableEmissive?: boolean;
    lightIntensity?: number;
    lightDistance?: number;
    lightDecay?: number;
    useRectLights?: boolean;
  }

  export class VOXLoader extends THREE.Loader {
    constructor(options?: VOXLoaderOptions);
    load(
      url: string,
      onLoad: (voxScene: VOXScene) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (err: unknown) => void,
    ): void;
  }

  export class VOXScene extends THREE.Group {
    center(): void;
  }

  export class VOXSceneObject extends THREE.Group {}
}
