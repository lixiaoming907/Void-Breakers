import * as THREE from 'three';
import { COLORS, PLAYER } from '../game/constants';
import { WEAPON_FIRE_RATE, type PlayerStats } from '../game/Upgrades';
import { ShieldBubble } from './ShieldBubble';

export type PlayerState = {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  rapidTimer: number;
  invulnTimer: number;
  dashTimer: number;
  dashCooldown: number;
  fireCooldown: number;
  alive: boolean;
};

export class Player {
  private static readonly LOCAL_ORIGIN = new THREE.Vector3(0, 0, 0);
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly aimWorld = new THREE.Vector3(0, 0, -1);
  readonly shieldFx = new ShieldBubble();
  readonly state: PlayerState = {
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    shield: 0,
    maxShield: 50,
    rapidTimer: 0,
    invulnTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    fireCooldown: 0,
    alive: true,
  };

  private readonly ship = new THREE.Group();
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.player,
    roughness: 0.35,
    metalness: 0.65,
    emissive: '#00a8c4',
    emissiveIntensity: 0.45,
  });
  private readonly accentMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.playerAccent,
    roughness: 0.4,
    metalness: 0.5,
    emissive: '#c4a020',
    emissiveIntensity: 0.4,
  });
  private readonly glassMaterial = new THREE.MeshStandardMaterial({
    color: '#7ad0e8',
    roughness: 0.2,
    metalness: 0.15,
    emissive: '#2088a8',
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.8,
  });
  private readonly thrusterMaterial = new THREE.MeshBasicMaterial({
    color: '#5ad0e8',
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  private readonly trailMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.player,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  private readonly bodyGeometry = new THREE.ConeGeometry(0.22, 0.72, 6);
  private readonly wingGeometry = new THREE.BoxGeometry(0.84, 0.05, 0.3);
  private readonly finGeometry = new THREE.BoxGeometry(0.055, 0.22, 0.3);
  private readonly canopyGeometry = new THREE.SphereGeometry(0.11, 10, 8);
  private readonly thrusterGeometry = new THREE.ConeGeometry(0.08, 0.3, 8, 1, true);
  private readonly trailGeometry = new THREE.ConeGeometry(0.11, 0.75, 8, 1, true);

  private thruster: THREE.Mesh;
  private trail: THREE.Mesh;
  private readonly move = new THREE.Vector2();
  private readonly targetVelocity = new THREE.Vector3();
  private readonly aimRay = new THREE.Vector3();
  private readonly planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private stats: PlayerStats | null = null;

  constructor() {
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.rotation.x = -Math.PI / 2;
    body.castShadow = true;
    body.position.y = 0.24;
    this.ship.add(body);

    const wingL = new THREE.Mesh(this.wingGeometry, this.bodyMaterial);
    wingL.position.set(-0.32, 0.22, 0.1);
    wingL.rotation.y = 0.18;
    wingL.castShadow = true;
    this.ship.add(wingL);

    const wingR = wingL.clone();
    wingR.position.x = 0.32;
    wingR.rotation.y = -0.18;
    this.ship.add(wingR);

    const finL = new THREE.Mesh(this.finGeometry, this.accentMaterial);
    finL.position.set(-0.15, 0.32, 0.22);
    this.ship.add(finL);

    const finR = finL.clone();
    finR.position.x = 0.15;
    this.ship.add(finR);

    const canopy = new THREE.Mesh(this.canopyGeometry, this.glassMaterial);
    canopy.position.set(0, 0.34, -0.06);
    canopy.scale.set(1, 0.7, 1.25);
    this.ship.add(canopy);

    this.thruster = new THREE.Mesh(this.thrusterGeometry, this.thrusterMaterial);
    this.thruster.position.set(0, 0.24, 0.46);
    this.thruster.rotation.x = Math.PI / 2;
    this.ship.add(this.thruster);

    this.trail = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
    this.trail.position.set(0, 0.2, 0.82);
    this.trail.rotation.x = Math.PI / 2;
    this.ship.add(this.trail);

    this.group.add(this.ship);
    this.group.add(this.shieldFx.group);
    this.group.position.set(0, 0, 2);
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
    this.state.maxHealth = PLAYER.maxHealth + stats.maxHealthBonus;
    this.state.maxShield = 50 + stats.maxShieldBonus;
  }

  update(
    delta: number,
    elapsed: number,
    input: { move: THREE.Vector2; aimScreen: THREE.Vector2; firing: boolean; dash: boolean },
    camera: THREE.Camera,
    raycaster: THREE.Raycaster,
    bounds: { halfWidth: number; halfDepth: number },
  ): void {
    const s = this.state;
    const stats = this.stats;
    if (!s.alive) {
      this.shieldFx.update(delta, elapsed, 0, Player.LOCAL_ORIGIN);
      return;
    }

    s.invulnTimer = Math.max(0, s.invulnTimer - delta);
    s.rapidTimer = Math.max(0, s.rapidTimer - delta);
    s.dashTimer = Math.max(0, s.dashTimer - delta);
    s.dashCooldown = Math.max(0, s.dashCooldown - delta);
    s.fireCooldown = Math.max(0, s.fireCooldown - delta);

    if (stats && stats.shieldRegenPerSec > 0 && s.shield < s.maxShield) {
      s.shield = Math.min(s.maxShield, s.shield + stats.shieldRegenPerSec * delta);
    }

    this.move.copy(input.move);
    const dashCd = PLAYER.dashCooldown * (stats?.dashCdMult ?? 1);
    const wantsDash = input.dash && s.dashCooldown <= 0;
    if (wantsDash) {
      s.dashTimer = PLAYER.dashDuration;
      s.dashCooldown = dashCd;
      s.invulnTimer = Math.max(s.invulnTimer, PLAYER.dashDuration + 0.12);
    }

    const speed = PLAYER.speed * (stats?.moveSpeedMult ?? 1);
    const dash = s.dashTimer > 0 ? PLAYER.dashMultiplier : 1;
    this.targetVelocity.set(this.move.x, 0, this.move.y).multiplyScalar(speed * dash);

    const smoothing = 1 - Math.exp(-PLAYER.acceleration * delta);
    this.velocity.lerp(this.targetVelocity, smoothing);
    this.group.position.addScaledVector(this.velocity, delta);

    this.group.position.x = THREE.MathUtils.clamp(
      this.group.position.x,
      -bounds.halfWidth + 0.9,
      bounds.halfWidth - 0.9,
    );
    this.group.position.z = THREE.MathUtils.clamp(
      this.group.position.z,
      -bounds.halfDepth + 0.9,
      bounds.halfDepth - 0.9,
    );

    raycaster.setFromCamera(input.aimScreen, camera);
    if (raycaster.ray.intersectPlane(this.planeY, this.aimWorld)) {
      this.aimRay.copy(this.aimWorld).sub(this.group.position);
      this.aimRay.y = 0;
      if (this.aimRay.lengthSq() > 0.001) {
        this.aimRay.normalize();
        const targetYaw = Math.atan2(this.aimRay.x, this.aimRay.z);
        // shortest-arc damp — plain damp wraps the long way across ±PI
        const yawDelta = Math.atan2(
          Math.sin(targetYaw - this.group.rotation.y),
          Math.cos(targetYaw - this.group.rotation.y),
        );
        this.group.rotation.y += yawDelta * (1 - Math.exp(-14 * delta));
      }
    }

    this.group.position.y = 0.08 + Math.sin(elapsed * 5.5) * 0.05;

    const speedFactor = THREE.MathUtils.clamp(this.velocity.length() / speed, 0, 1.6);
    this.thruster.scale.setScalar(0.75 + speedFactor * 0.55);
    this.thrusterMaterial.opacity = 0.28 + speedFactor * 0.28;
    this.trail.scale.set(0.7 + speedFactor * 0.5, 0.7 + speedFactor * 0.8, 0.7 + speedFactor * 0.5);
    this.trailMaterial.opacity = 0.05 + speedFactor * 0.12;

    const flash = s.invulnTimer > 0 && Math.floor(elapsed * 18) % 2 === 0;
    this.bodyMaterial.emissiveIntensity = flash ? 0.85 : 0.45;

    const shieldRatio = s.maxShield > 0 ? s.shield / s.maxShield : 0;
    // shield is a child of this.group — keep it at local origin (world pos would double-transform)
    this.shieldFx.update(delta, elapsed, shieldRatio, Player.LOCAL_ORIGIN);
  }

  canFire(): boolean {
    return this.state.alive && this.state.fireCooldown <= 0;
  }

  consumeFire(): void {
    const stats = this.stats;
    let fireMult = (stats?.fireRateMult ?? 1) * WEAPON_FIRE_RATE[stats?.weapon ?? 'pulse'];
    // weapon-specific rate buffs persist after swapping (they only boost that weapon)
    if (stats?.weapon === 'pulse') fireMult *= stats.pulseRate;
    if (stats?.weapon === 'railgun') fireMult *= stats.railRate;
    const base = this.state.rapidTimer > 0 ? PLAYER.rapidFireCooldown : PLAYER.fireCooldown;
    this.state.fireCooldown = base / Math.max(0.2, fireMult);
  }

  getDashCooldownMax(): number {
    return PLAYER.dashCooldown * (this.stats?.dashCdMult ?? 1);
  }

  takeDamage(amount: number): boolean {
    const s = this.state;
    if (!s.alive || s.invulnTimer > 0) return false;

    let remaining = amount;
    if (s.shield > 0) {
      const absorbed = Math.min(s.shield, remaining);
      s.shield -= absorbed;
      remaining -= absorbed;
      this.shieldFx.hit();
      if (s.shield <= 0.001) {
        s.shield = 0;
        this.shieldFx.hit();
      }
    }
    if (remaining > 0) s.health = Math.max(0, s.health - remaining);
    s.invulnTimer = PLAYER.invulnAfterHit;
    if (s.health <= 0) s.alive = false;
    return true;
  }

  heal(amount: number): void {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
  }

  addShield(amount: number): void {
    this.state.shield = Math.min(this.state.maxShield, this.state.shield + amount);
    this.shieldFx.hit();
  }

  addRapid(duration: number): void {
    this.state.rapidTimer = Math.max(this.state.rapidTimer, duration);
  }

  onShieldDepletedCheck(): boolean {
    return this.state.shield <= 0;
  }

  reset(): void {
    const s = this.state;
    s.health = s.maxHealth;
    s.shield = 0;
    s.rapidTimer = 0;
    s.invulnTimer = 1.2;
    s.dashTimer = 0;
    s.dashCooldown = 0;
    s.fireCooldown = 0;
    s.alive = true;
    this.group.position.set(0, 0, 2);
    this.group.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.move.set(0, 0);
    this.targetVelocity.set(0, 0, 0);
    this.shieldFx.update(0.016, 0, 0, Player.LOCAL_ORIGIN);
  }

  stabilizeVisuals(): void {
    this.group.position.y = 0.08;
    this.thruster.scale.setScalar(1);
    this.trail.scale.setScalar(1);
  }

  dispose(): void {
    this.bodyGeometry.dispose();
    this.wingGeometry.dispose();
    this.finGeometry.dispose();
    this.canopyGeometry.dispose();
    this.thrusterGeometry.dispose();
    this.trailGeometry.dispose();
    this.bodyMaterial.dispose();
    this.accentMaterial.dispose();
    this.glassMaterial.dispose();
    this.thrusterMaterial.dispose();
    this.trailMaterial.dispose();
    this.shieldFx.dispose();
  }
}
