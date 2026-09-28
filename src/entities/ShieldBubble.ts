import * as THREE from 'three';

/**
 * Thin translucent shield shell — deliberately NON-bloom, non-HDR.
 * Soft cool tint, almost invisible at high ratio, clearly gone at 0.
 */
export class ShieldBubble {
  readonly group = new THREE.Group();
  private readonly shell: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private flash = 0;
  private currentOpacity = 0;
  private enabled = true;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: '#7ec8e8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    const geo = new THREE.IcosahedronGeometry(1.05, 2);
    this.shell = new THREE.Mesh(geo, this.material);
    this.shell.position.y = 0.5;
    this.shell.scale.set(1.1, 0.95, 1.18);
    this.group.add(this.shell);

    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: '#9ad8f0',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    const ringGeo = new THREE.TorusGeometry(1.18, 0.018, 6, 40);
    this.ring = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.5;
    this.group.add(this.ring);

    this.group.visible = false;
  }

  update(
    delta: number,
    elapsed: number,
    shieldRatio: number,
    parentLocal: THREE.Vector3,
  ): void {
    this.group.position.copy(parentLocal);
    this.group.position.y = 0;

    this.flash = Math.max(0, this.flash - delta * 3.2);
    // thin film: max opacity ~0.18, never a glow ball
    const target = shieldRatio > 0.001 ? 0.08 + shieldRatio * 0.1 : 0;
    const rate = target > this.currentOpacity ? 7 : 5;
    this.currentOpacity = THREE.MathUtils.damp(this.currentOpacity, target, rate, delta);

    const visible = this.currentOpacity > 0.008;
    this.group.visible = visible && this.enabled;
    if (!this.group.visible) return;

    this.material.opacity = this.currentOpacity * (1 + this.flash * 0.7);
    this.ringMaterial.opacity = this.currentOpacity * 1.4 + this.flash * 0.12;

    const pulse = 1 + Math.sin(elapsed * 2.4) * 0.015 + this.flash * 0.04;
    this.shell.scale.set(1.1 * pulse, 0.95 * pulse, 1.18 * pulse);
    this.ring.rotation.z = elapsed * 0.35;
  }

  hit(): void {
    this.flash = 1;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.group.visible = false;
  }

  dispose(): void {
    this.shell.geometry.dispose();
    this.ring.geometry.dispose();
    this.material.dispose();
    this.ringMaterial.dispose();
  }
}
