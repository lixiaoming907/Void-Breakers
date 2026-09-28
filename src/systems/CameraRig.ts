import * as THREE from 'three';

export class CameraRig {
  private readonly idealOffset = new THREE.Vector3(0, 24, 19);
  private readonly lookOffset = new THREE.Vector3(0, 0, -1.2);
  private readonly currentLook = new THREE.Vector3();
  private shake = 0;
  private shakeSeed = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.camera.position.copy(this.idealOffset);
    this.camera.lookAt(0, 0, 0);
    this.currentLook.set(0, 0, 0);
  }

  snapTo(target: THREE.Vector3): void {
    this.camera.position.copy(target).add(this.idealOffset);
    this.currentLook.copy(target).add(this.lookOffset);
    this.camera.lookAt(this.currentLook);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(delta: number, target: THREE.Vector3, lag: number, elapsed: number): void {
    const desired = target.clone().add(this.idealOffset);
    const t = 1 - Math.exp(-lag * delta * 60);
    this.camera.position.lerp(desired, t);

    const lookTarget = target.clone().add(this.lookOffset);
    this.currentLook.lerp(lookTarget, t);

    this.shake = Math.max(0, this.shake - delta * 2.8);
    this.shakeSeed += delta * 40;
    const shakeAmp = this.shake * 0.28;
    const ox = Math.sin(this.shakeSeed * 1.7) * shakeAmp;
    const oy = Math.cos(this.shakeSeed * 2.3) * shakeAmp * 0.6;
    const oz = Math.sin(this.shakeSeed * 1.1) * shakeAmp * 0.5;

    this.camera.position.x += ox;
    this.camera.position.y += oy;
    this.camera.position.z += oz;
    this.camera.lookAt(this.currentLook);

    // Subtle FOV pulse with speed feel
    const targetFov = 48 + this.shake * 4;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, delta);
    this.camera.updateProjectionMatrix();
    void elapsed;
  }
}
