import * as THREE from 'three';
import { ARENA, COLORS } from '../game/constants';

/**
 * Cool, architectural cyberpunk city-void — deliberately NOT warm/spiky like enemies.
 * Palette: deep navy metal, cyan/magenta neon signage, purple crystal pylons.
 */
export class Arena {
  readonly group = new THREE.Group();
  private readonly stars: THREE.Points;
  private readonly grid: THREE.GridHelper;
  private readonly signs: THREE.Mesh[] = [];
  private readonly rain: THREE.Points;
  private rainPositions: Float32Array;

  constructor() {
    // Subtle distant dust only — no bright white "meteors" streaking overhead.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 70 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.35 + 8;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const c = new THREE.Color().setHSL(0.58, 0.35, 0.18 + Math.random() * 0.12);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.group.add(this.stars);

    // Floor — cool navy metal, never warm
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfWidth * 2 + 8, ARENA.halfDepth * 2 + 8, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#121a2e',
        roughness: 0.42,
        metalness: 0.78,
        emissive: '#0a1428',
        emissiveIntensity: 0.55,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    this.grid = new THREE.GridHelper(ARENA.halfWidth * 2, 32, new THREE.Color('#1de0ff'), new THREE.Color('#1a2740'));
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.42;
    this.grid.position.y = 0.02;
    this.group.add(this.grid);

    // Architecture: cool grey-blue building blocks around the arena
    const buildingMat = new THREE.MeshStandardMaterial({
      color: '#1b2438',
      roughness: 0.55,
      metalness: 0.7,
      emissive: '#0c1830',
      emissiveIntensity: 0.4,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#0e2a3a',
      roughness: 0.3,
      metalness: 0.85,
      emissive: '#1de0ff',
      emissiveIntensity: 0.9,
    });

    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingDefs: { x: number; z: number; w: number; h: number; d: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 4;
      const t = Math.floor(i / 4);
      let x = 0;
      let z = 0;
      // keep buildings well outside the large playfield
      if (side === 0) {
        x = -ARENA.halfWidth - 10 - t * 4;
        z = -18 + t * 12;
      } else if (side === 1) {
        x = ARENA.halfWidth + 10 + t * 4;
        z = -18 + t * 12;
      } else if (side === 2) {
        x = -24 + t * 16;
        z = -ARENA.halfDepth - 12 - t * 3;
      } else {
        x = -24 + t * 16;
        z = ARENA.halfDepth + 12 + t * 3;
      }
      const h = 2.4 + Math.random() * 3.6;
      buildingDefs.push({
        x,
        z,
        w: 2.8 + Math.random() * 2.8,
        h,
        d: 2.8 + Math.random() * 2.8,
      });
    }
    for (const b of buildingDefs) {
      const mesh = new THREE.Mesh(buildingGeo, buildingMat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.scale.set(b.w, b.h, b.d);
      // no castShadow: tall edge shadows used to wash over the arena
      mesh.receiveShadow = false;
      this.group.add(mesh);

      const trim = new THREE.Mesh(buildingGeo, trimMat);
      trim.position.set(b.x, b.h * 0.78, b.z);
      trim.scale.set(b.w * 1.02, 0.08, b.d * 1.02);
      this.group.add(trim);
    }

    // Holographic billboards (canvas textures)
    const signData = [
      { text: 'VOID//NET', color: '#1de0ff', x: -ARENA.halfWidth - 2.2, z: -2, ry: Math.PI / 2 },
      { text: 'NEON-7', color: '#f15bb5', x: ARENA.halfWidth + 2.2, z: 3, ry: -Math.PI / 2 },
      { text: 'SECTOR-09', color: '#c77dff', x: 0, z: -ARENA.halfDepth - 2.2, ry: 0 },
    ];
    for (const s of signData) {
      const tex = this.makeSignTexture(s.text, s.color);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), mat);
      mesh.position.set(s.x, 2.4, s.z);
      mesh.rotation.y = s.ry;
      this.signs.push(mesh);
      this.group.add(mesh);
    }

    // Purple crystal pylons removed — they blocked the combat read.

    // Neon floor guide rails
    const railMat = new THREE.MeshStandardMaterial({
      color: '#122033',
      roughness: 0.35,
      metalness: 0.85,
      emissive: '#1de0ff',
      emissiveIntensity: 0.75,
    });
    const longRail = new THREE.BoxGeometry(ARENA.halfWidth * 2 + 2.4, 0.28, 0.22);
    const shortRail = new THREE.BoxGeometry(0.22, 0.28, ARENA.halfDepth * 2 + 2.4);
    const rails = [
      new THREE.Mesh(longRail, railMat),
      new THREE.Mesh(longRail, railMat),
      new THREE.Mesh(shortRail, railMat),
      new THREE.Mesh(shortRail, railMat),
    ];
    rails[0].position.set(0, 0.14, -ARENA.halfDepth - 1);
    rails[1].position.set(0, 0.14, ARENA.halfDepth + 1);
    rails[2].position.set(-ARENA.halfWidth - 1, 0.14, 0);
    rails[3].position.set(ARENA.halfWidth + 1, 0.14, 0);
    for (const rail of rails) this.group.add(rail);

    // Center platform ring — cool cyan only
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.55, 64),
      new THREE.MeshBasicMaterial({
        color: '#1de0ff',
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);

    // Data rain covering the FULL arena (was stuck in a 40x32 center patch)
    const rainCount = 900;
    this.rainPositions = new Float32Array(rainCount * 3);
    const rainX = ARENA.halfWidth + 8;
    const rainZ = ARENA.halfDepth + 8;
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * rainX * 2;
      this.rainPositions[i * 3 + 1] = Math.random() * 16;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * rainZ * 2;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({
        color: '#5aa8d0',
        size: 0.06,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    this.group.add(this.rain);
  }

  private makeSignTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(8,16,32,0.15)';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 140);
    ctx.font = 'bold 64px "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillText(text, 256, 84);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  update(delta: number, elapsed: number): void {
    this.stars.rotation.y = elapsed * 0.004;
    this.grid.material.opacity = 0.32 + Math.sin(elapsed * 1.5) * 0.1;

    this.signs.forEach((sign, i) => {
      const mat = sign.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 + Math.sin(elapsed * 3 + i * 1.7) * 0.15;
    });

    // rain fall — wrap across full arena
    const pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const rainX = ARENA.halfWidth + 8;
    const rainZ = ARENA.halfDepth + 8;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= delta * 5.5;
      if (arr[i + 1] < 0) {
        arr[i + 1] = 14 + Math.random() * 4;
        arr[i] = (Math.random() - 0.5) * rainX * 2;
        arr[i + 2] = (Math.random() - 0.5) * rainZ * 2;
      }
    }
    pos.needsUpdate = true;
    void COLORS;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
