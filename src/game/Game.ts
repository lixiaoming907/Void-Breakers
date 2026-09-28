import * as THREE from 'three';
import { InputController, type InputFrame } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { BulletPool } from '../entities/Bullet';
import { Effects } from '../entities/Effects';
import { EnemyManager, type Enemy, type EnemyKind } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { PickupManager, type PickupKind } from '../entities/Pickup';
import { ARENA, PLAYER, WAVES } from './constants';
import {
  applyUpgrade,
  defaultSecondaryStats,
  defaultStats,
  rollUpgradeChoices,
  UPGRADES,
  type PlayerStats,
  type UpgradeId,
} from './Upgrades';
import { SecondarySystem } from '../entities/Secondary';
import { Arena } from '../systems/Arena';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { Hud, type GameState, type HudSnapshot } from '../systems/Hud';
import { PostFX } from '../systems/PostFX';
import { WaveSystem } from '../systems/WaveSystem';
import { createSeededRandom, range, type SeededRandom } from '../utils/random';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 160);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly enemies = new EnemyManager();
  private readonly bullets = new BulletPool();
  private readonly pickups = new PickupManager();
  private readonly effects = new Effects();
  private readonly arena = new Arena();
  private readonly waves = new WaveSystem();
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly raycaster = new THREE.Raycaster();
  private postfx!: PostFX;

  private readonly inputFrame: InputFrame = {
    move: new THREE.Vector2(),
    aimScreen: new THREE.Vector2(),
    firing: false,
    dash: false,
    pausePressed: false,
    confirmPressed: false,
    anyKeyPressed: false,
  };

  private readonly loop = new Loop(
    (delta, elapsed) => this.update(delta, elapsed),
    () => this.render(),
  );

  private readonly tuning = {
    cameraLag: 0.12,
    exposure: 1.22,
    maxDpr: 2,
  };

  private state: GameState = 'menu';
  private frame = 0;
  private score = 0;
  private highScore = 0;
  private combo = 0;
  private comboTimer = 0;
  private elapsed = 0;
  private banner = '准备出击';
  private bannerSub = '按 Enter 或点击开始';
  private hitStop = 0;
  private rng: SeededRandom = createSeededRandom(1337);
  private pausedForScreenshot = false;
  private reducedMotion = false;
  private ambientTime = 0;

  private stats: PlayerStats = defaultStats();
  private secondaryStats = defaultSecondaryStats();
  private readonly secondaries = new SecondarySystem(defaultSecondaryStats());
  private upgradeCounts = new Map<UpgradeId, number>();
  private pendingChoices: UpgradeId[] = [];
  private selectedChoice = 0;
  private upgradesTaken = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;

    const stick = this.getEl('#touch-stick');
    const knob = this.getEl('#touch-knob');
    const dashButton = this.getEl('#dash-button');
    const fireButton = this.getEl('#fire-button');
    this.input = new InputController(canvas, stick, knob, dashButton, fireButton);

    try {
      this.highScore = Number(localStorage.getItem('voidbreakers-high') || 0) || 0;
    } catch {
      this.highScore = 0;
    }

    this.createScene();
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.player.setStats(this.stats);
    this.cameraRig.snapTo(this.player.group.position);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.syncPostSize();
    this.installTestHooks();
    this.publishDiagnostics();
    this.hud.update(this.snapshot(), 0);
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    this.player.dispose();
    this.enemies.dispose();
    this.bullets.dispose();
    this.pickups.dispose();
    this.effects.dispose();
    this.arena.dispose();
    this.secondaries.dispose();
    this.postfx.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    if (this.pausedForScreenshot) {
      this.publishDiagnostics();
      return;
    }

    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.syncPostSize();
    this.input.readFrame(this.inputFrame);
    this.audio.unlock();

    if (this.inputFrame.pausePressed && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing';
      this.banner = this.state === 'paused' ? '已暂停' : '继续作战';
      this.bannerSub = this.state === 'paused' ? '按 Esc / P 继续' : '';
    }

    if (this.state === 'menu') {
      if (this.inputFrame.confirmPressed || this.inputFrame.anyKeyPressed) {
        this.startRun();
      }
      this.arena.update(delta, elapsed);
      this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag, elapsed);
      this.postfx.update(delta);
      this.hud.update(this.snapshot(), delta);
      this.publishDiagnostics();
      return;
    }

    if (this.state === 'upgrade') {
      this.handleUpgradeInput();
      this.effects.update(delta);
      this.arena.update(delta * 0.35, elapsed);
      this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag, elapsed);
      this.postfx.update(delta);
      this.hud.update(this.snapshot(), delta);
      this.publishDiagnostics();
      return;
    }

    if (this.state === 'paused') {
      this.hud.update(this.snapshot(), delta);
      this.publishDiagnostics();
      return;
    }

    if (this.state === 'gameover') {
      if (this.inputFrame.confirmPressed) this.startRun();
      this.effects.update(delta);
      this.arena.update(delta * 0.5, elapsed);
      this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag, elapsed);
      this.postfx.update(delta);
      this.hud.update(this.snapshot(), delta);
      this.publishDiagnostics();
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop -= delta;
      const slow = delta * 0.15;
      this.arena.update(slow, elapsed);
      this.effects.update(slow);
      this.postfx.update(slow);
      this.cameraRig.update(slow, this.player.group.position, this.tuning.cameraLag, elapsed);
      this.hud.update(this.snapshot(), delta);
      this.publishDiagnostics();
      return;
    }

    this.elapsed += delta;
    this.ambientTime += this.reducedMotion ? 0 : delta;
    this.player.update(delta, this.reducedMotion ? 0 : elapsed, this.inputFrame, this.camera, this.raycaster, ARENA);

    if (this.inputFrame.firing && this.player.canFire()) {
      this.player.consumeFire();
      this.fireWeapon();
    }

    const enemyPos = this.enemies.enemies
      .filter((e) => e.alive)
      .map((e) => ({ x: e.group.position.x, z: e.group.position.z, radius: e.radius }));
    this.bullets.update(delta, enemyPos.map((e) => ({ x: e.x, z: e.z })));
    this.enemies.update(delta, this.reducedMotion ? 0 : elapsed, this.player.group.position);

    // secondaries
    const secEvents = this.secondaries.update(
      delta,
      elapsed,
      this.player.group.position,
      this.player.group.rotation.y,
      enemyPos,
    );
    for (const hit of secEvents.orbitHits) {
      for (const enemy of this.enemies.enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.group.position.x - hit.x, enemy.group.position.z - hit.z) < enemy.radius + 0.2) {
          this.damageEnemy(enemy, hit.damage, false);
        }
      }
    }
    if (secEvents.missiles) {
      const m = secEvents.missiles;
      for (let i = 0; i < m.count; i++) {
        const angle = (i / m.count) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        this.bullets.firePlayer({
          origin: new THREE.Vector3(m.x, 0.45, m.z),
          direction: dir,
          damage: m.damage * this.stats.damageMult,
          speed: 12,
          weapon: 'homing',
          multishot: 0,
          pierce: 0,
          explosive: this.stats.explosive,
          crit: false,
          weaponMultishot: 0,
          weaponDamageMult: 1,
          weaponRateHint: 1,
          weaponPierce: 0,
          weaponExtra: 0,
          weaponTurn: 1.6,
          weaponLife: 1,
        });
      }
      this.audio.shoot();
    }
    for (const nova of secEvents.novas) {
      this.effects.shockwave(new THREE.Vector3(nova.x, 0, nova.z), '#00f5d4', nova.radius * 0.85, 0.4);
      this.cameraRig.addShake(0.2);
      this.postfx.pulse(1.05);
      for (const enemy of this.enemies.enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.group.position.x - nova.x, enemy.group.position.z - nova.z);
        if (d <= nova.radius) {
          this.damageEnemy(enemy, nova.damage * this.stats.damageMult * (1 - d / nova.radius * 0.35), false);
        }
      }
    }
    for (const shot of secEvents.turretShots) {
      const dir = new THREE.Vector3(shot.tx - shot.x, 0, shot.tz - shot.z);
      if (dir.lengthSq() < 0.001) continue;
      this.bullets.firePlayer({
        origin: new THREE.Vector3(shot.x, 0.4, shot.z),
        direction: dir,
        damage: shot.damage * this.stats.damageMult,
        speed: 20,
        weapon: 'pulse',
        multishot: 0,
        pierce: 0,
        explosive: false,
        crit: false,
        weaponMultishot: 0,
        weaponDamageMult: 1,
        weaponRateHint: 1,
        weaponPierce: 0,
        weaponExtra: 0,
        weaponTurn: 1,
        weaponLife: 1,
      });
    }

    this.pickups.update(delta, this.reducedMotion ? 0 : elapsed);
    this.effects.update(delta);
    this.arena.update(delta, this.ambientTime);
    this.postfx.update(delta);

    const waveReady = this.waves.update(delta, (kind) => this.spawnEnemy(kind));
    if (waveReady && this.enemies.aliveCount === 0 && this.waves.pendingSpawns === 0) {
      if (this.waves.currentWave > 0) {
        this.enterUpgradePhase();
      } else {
        this.waves.startImmediately();
        this.hud.showBanner('第 1 波', '开始作战');
      }
    }

    this.handleCollisions(delta);
    this.enemies.removeDead();

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag, elapsed);

    if (!this.player.state.alive) {
      this.state = 'gameover';
      this.audio.gameOver();
      this.effects.explosion(this.player.group.position.clone().setY(0.6), '#00e5ff', 1.8);
      this.cameraRig.addShake(1.2);
      this.postfx.pulse(1.5);
      this.banner = '任务失败';
      this.bannerSub = '按 Enter 再来一局';
    }

    this.hud.update(this.snapshot(), delta);
    this.publishDiagnostics();
  }

  private render(): void {
    this.postfx.render();
  }

  private syncPostSize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr);
    this.postfx.setSize(w, h, dpr);
  }

  private fireWeapon(): void {
    const origin = this.player.group.position.clone();
    origin.y = 0.42;
    const dir = this.player.aimWorld.clone().sub(this.player.group.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();
    // spawn just outside the thin shield / player hull so shots never "stick" on self
    origin.addScaledVector(dir, 0.95);

    const crit = this.rng() < this.stats.critChance;
    const damage =
      PLAYER.bulletDamage * this.stats.damageMult * (crit ? this.stats.critDamageMult : 1);

    const s = this.stats;
    let weaponDamageMult = 1;
    let weaponMultishot = 0;
    let weaponExtra = 0;
    let weaponPierce = 0;
    let weaponTurn = 1;
    let weaponLife = 1;

    switch (s.weapon) {
      case 'pulse':
        weaponDamageMult = s.pulseDmg;
        weaponMultishot = s.pulseExtra;
        break;
      case 'scatter':
        weaponDamageMult = s.scatterClose;
        weaponExtra = s.scatterPellets;
        weaponPierce = s.scatterPierce;
        break;
      case 'homing':
        weaponDamageMult = s.homingDmg;
        weaponMultishot = s.homingSalvo;
        weaponTurn = s.homingTurn;
        break;
      case 'plasma':
        weaponDamageMult = s.plasmaDmg;
        weaponTurn = s.plasmaRadius;
        weaponExtra = s.plasmaChain;
        break;
      case 'railgun':
        weaponDamageMult = s.railDmg;
        weaponPierce = s.railPierce;
        break;
      case 'flak':
        weaponDamageMult = s.flakDmg;
        weaponExtra = s.flakCluster;
        weaponLife = s.flakLife;
        break;
      default:
        break;
    }

    this.bullets.firePlayer({
      origin,
      direction: dir,
      damage,
      speed: PLAYER.bulletSpeed * s.bulletSpeedMult,
      weapon: s.weapon,
      // global multishot ALWAYS applies after weapon swap
      multishot: s.multishotBonus,
      pierce: s.pierceBonus,
      explosive: s.explosive || s.weapon === 'plasma',
      crit,
      weaponMultishot,
      weaponDamageMult,
      weaponRateHint: 1,
      weaponPierce,
      weaponExtra,
      weaponTurn,
      weaponLife,
    });

    this.audio.shoot();
    this.effects.burst(origin, crit ? '#fee440' : '#7df9ff', 3, 2.5, 0.65);
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#070d1c');
    this.scene.fog = new THREE.Fog('#0a1528', 36, 100);

    const hemi = new THREE.HemisphereLight('#b8d4ff', '#142038', 1.7);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#e8f2ff', 2.9);
    key.position.set(-12, 20, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 55;
    key.shadow.camera.left = -22;
    key.shadow.camera.right = 22;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    this.scene.add(key);

    // Cyberpunk neon fill lights (cool + magenta rim)
    const fillCyan = new THREE.PointLight('#1de0ff', 90, 50, 1.7);
    fillCyan.position.set(-14, 6, -6);
    this.scene.add(fillCyan);

    const fillMagenta = new THREE.PointLight('#f15bb5', 70, 48, 1.8);
    fillMagenta.position.set(14, 7, 8);
    this.scene.add(fillMagenta);

    const rim = new THREE.PointLight('#7b2dff', 55, 42, 1.9);
    rim.position.set(0, 9, 0);
    this.scene.add(rim);

    this.scene.add(this.arena.group);
    this.scene.add(this.player.group);
    this.scene.add(this.enemies.group);
    this.scene.add(this.bullets.group);
    this.scene.add(this.pickups.group);
    this.scene.add(this.effects.group);
    this.scene.add(this.secondaries.group);
  }

  private spawnEnemy(kind: EnemyKind, at?: THREE.Vector3): void {
    if (at) {
      const p = at.clone();
      p.y = 0;
      p.x = THREE.MathUtils.clamp(p.x, -ARENA.halfWidth + 1, ARENA.halfWidth - 1);
      p.z = THREE.MathUtils.clamp(p.z, -ARENA.halfDepth + 1, ARENA.halfDepth - 1);
      this.enemies.spawn(kind, p);
      return;
    }
    const side = this.rng();
    let x = 0;
    let z = 0;
    const margin = WAVES.spawnMargin;
    if (side < 0.25) {
      x = range(this.rng, -ARENA.halfWidth + margin, ARENA.halfWidth - margin);
      z = -ARENA.halfDepth + margin;
    } else if (side < 0.5) {
      x = range(this.rng, -ARENA.halfWidth + margin, ARENA.halfWidth - margin);
      z = ARENA.halfDepth - margin;
    } else if (side < 0.75) {
      x = -ARENA.halfWidth + margin;
      z = range(this.rng, -ARENA.halfDepth + margin, ARENA.halfDepth - margin);
    } else {
      x = ARENA.halfWidth - margin;
      z = range(this.rng, -ARENA.halfDepth + margin, ARENA.halfDepth - margin);
    }

    const toPlayer = new THREE.Vector3().subVectors(
      this.player.group.position,
      new THREE.Vector3(x, 0, z),
    );
    if (toPlayer.length() < 5) {
      x = THREE.MathUtils.clamp(x + Math.sign(x || 1) * 4, -ARENA.halfWidth + 1, ARENA.halfWidth - 1);
    }

    this.enemies.spawn(kind, new THREE.Vector3(x, 0, z));
  }

  private handleCollisions(delta: number): void {
    const playerPos = this.player.group.position;
    const playerRadius = PLAYER.radius;

    for (const bullet of this.bullets.getPlayerBullets()) {
      if (bullet.spawnGrace > 0) continue;
      for (const enemy of this.enemies.enemies) {
        if (!enemy.alive) continue;
        const dx = bullet.mesh.position.x - enemy.group.position.x;
        const dz = bullet.mesh.position.z - enemy.group.position.z;
        const distSq = dx * dx + dz * dz;
        const hitRadius = enemy.radius + bullet.radius + 0.12;
        if (distSq <= hitRadius * hitRadius) {
          const killed = this.damageEnemy(enemy, bullet.damage, bullet.crit);
          this.effects.burst(
            bullet.mesh.position,
            bullet.crit ? '#fee440' : '#7df9ff',
            bullet.kind === 'player-plasma' ? 14 : 6,
            4,
            1,
          );

          if (bullet.explosive || bullet.kind === 'player-plasma') {
            this.explodeAt(bullet.mesh.position.clone(), bullet.damage * 0.65, enemy);
          }

          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            this.bullets.consume(bullet, bullet.split);
          }
          this.audio.hit();
          if (killed) void killed;
          break;
        }
      }
    }

    for (const bullet of this.bullets.getActive('enemy')) {
      const dx = bullet.mesh.position.x - playerPos.x;
      const dz = bullet.mesh.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= (playerRadius + 0.22) * (playerRadius + 0.22)) {
        bullet.active = false;
        bullet.mesh.visible = false;
        if (this.player.takeDamage(bullet.damage)) {
          this.audio.hurt();
          this.cameraRig.addShake(0.35);
          this.effects.burst(playerPos.clone().setY(0.5), '#ff4d6d', 10, 5, 1);
          this.combo = 0;
          if (this.player.state.shield <= 0) {
            this.effects.shockwave(playerPos, '#4cc9f0', 2.2, 0.35);
            this.postfx.pulse(1.2);
          }
        }
      }
    }

    for (const enemy of this.enemies.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.group.position.x - playerPos.x;
      const dz = enemy.group.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      const hitRadius = enemy.radius + playerRadius;
      if (distSq <= hitRadius * hitRadius) {
        if (enemy.kind === 'bomber') {
          // detonate on contact
          this.damageEnemy(enemy, 9999, false);
          this.player.takeDamage(enemy.damage);
          this.audio.hurt();
          this.cameraRig.addShake(0.7);
          this.effects.burst(playerPos.clone().setY(0.5), '#ff4d6d', 16, 7, 1.1);
          this.combo = 0;
          continue;
        }
        if (this.player.takeDamage(enemy.damage * 0.65)) {
          this.audio.hurt();
          this.cameraRig.addShake(0.45);
          this.effects.burst(playerPos.clone().setY(0.5), '#ff4d6d', 10, 5, 1);
          const push = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(3.2);
          this.player.velocity.add(push);
          if (this.player.state.shield <= 0) {
            this.effects.shockwave(playerPos, '#4cc9f0', 2.4, 0.35);
          }
        }
      }
    }

    for (const enemy of this.enemies.enemies) {
      if (!enemy.alive) continue;
      if (enemy.kind !== 'striker' && enemy.kind !== 'boss' && enemy.kind !== 'sniper') continue;
      enemy.fireTimer -= delta;
      if (enemy.fireTimer > 0) continue;
      enemy.fireTimer = enemy.fireCooldown * (0.85 + this.rng() * 0.3);
      const origin = enemy.group.position.clone().setY(0.55);
      const dir = playerPos.clone().sub(origin);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) continue;
      dir.normalize();
      const speed = enemy.kind === 'boss' ? 13 : enemy.kind === 'sniper' ? 20 : 11.5;
      this.bullets.spawnEnemy(origin, dir, enemy.damage, speed);
      if (enemy.kind === 'boss') {
        for (const angle of [-0.28, 0.28]) {
          const spread = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          this.bullets.spawnEnemy(origin, spread, enemy.damage * 0.7, speed * 0.92);
        }
      }
    }

    const magnet = this.stats.magnetRadius;
    for (const pickup of this.pickups.pickups) {
      if (!pickup.active) continue;
      const dx = pickup.group.position.x - playerPos.x;
      const dz = pickup.group.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < magnet * 1.8 && dist > 0.01) {
        // gentle pull
        pickup.group.position.x -= (dx / dist) * delta * 4;
        pickup.group.position.z -= (dz / dist) * delta * 4;
      }
      if (dx * dx + dz * dz <= magnet * magnet) {
        this.pickups.collect(pickup);
        this.applyPickup(pickup.kind);
      }
    }
  }

  private damageEnemy(enemy: Enemy, amount: number, crit: boolean): boolean {
    const killed = this.enemies.damage(enemy, amount);
    if (crit) this.effects.shockwave(enemy.group.position, '#fee440', 1.6, 0.25);
    if (killed) this.onEnemyKilled(enemy);
    return killed;
  }

  private explodeAt(position: THREE.Vector3, damage: number, source?: Enemy): void {
    this.effects.explosion(position, '#00f5d4', 1.1);
    this.cameraRig.addShake(0.28);
    this.postfx.pulse(1.15);
    for (const enemy of this.enemies.enemies) {
      if (!enemy.alive || enemy === source) continue;
      const d = enemy.group.position.distanceTo(position);
      if (d < 2.4) {
        const falloff = 1 - d / 2.4;
        this.damageEnemy(enemy, damage * falloff, false);
      }
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.combo += 1;
    this.comboTimer = 2.8;
    const comboMult = 1 + Math.floor(this.combo / 5) * 0.25;
    this.score += Math.floor(enemy.score * comboMult);
    this.audio.explode();
    this.effects.explosion(
      enemy.group.position.clone().setY(0.55),
      enemy.kind === 'boss' ? '#ff2e88' : '#ff4d6d',
      enemy.kind === 'boss' ? 2.0 : enemy.kind === 'swarm' ? 0.55 : 0.9,
    );
    this.cameraRig.addShake(enemy.kind === 'boss' ? 0.9 : enemy.kind === 'swarm' ? 0.08 : 0.18);
    this.hitStop = enemy.kind === 'boss' ? 0.1 : enemy.kind === 'swarm' ? 0.015 : 0.035;
    this.postfx.pulse(enemy.kind === 'boss' ? 1.25 : 1.0);

    if (this.stats.shieldOnKill > 0) {
      this.player.addShield(this.stats.shieldOnKill);
    }

    // splitter: spawn smaller chasers
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const offset = new THREE.Vector3((this.rng() - 0.5) * 1.4, 0, (this.rng() - 0.5) * 1.4);
        this.spawnEnemy('swarm', enemy.group.position.clone().add(offset));
      }
    }

    // bomber death is an AOE (also on contact — handled in collisions)
    if (enemy.kind === 'bomber') {
      this.explodeAt(enemy.group.position.clone(), enemy.damage * 0.85);
    }

    const roll = this.rng();
    const pos = enemy.group.position.clone();
    if (enemy.kind === 'boss') {
      this.spawnPickup('shield', pos);
      this.spawnPickup('rapid', pos.clone().add(new THREE.Vector3(1.2, 0, 0.6)));
      this.spawnPickup('health', pos.clone().add(new THREE.Vector3(-1.2, 0, -0.6)));
    } else if (roll < 0.1) {
      this.spawnPickup('health', pos);
    } else if (roll < 0.18) {
      this.spawnPickup('shield', pos);
    } else if (roll < 0.25) {
      this.spawnPickup('rapid', pos);
    } else if (roll < 0.42) {
      this.spawnPickup('score', pos);
    }
  }

  private spawnPickup(kind: PickupKind, position: THREE.Vector3): void {
    const p = position.clone();
    p.y = 0;
    p.x = THREE.MathUtils.clamp(p.x, -ARENA.halfWidth + 1, ARENA.halfWidth - 1);
    p.z = THREE.MathUtils.clamp(p.z, -ARENA.halfDepth + 1, ARENA.halfDepth - 1);
    this.pickups.spawn(kind, p);
    this.effects.shockwave(p, '#4cc9f0', 1.4, 0.3);
  }

  private applyPickup(kind: PickupKind): void {
    this.audio.pickup();
    this.hud.flashPickup();
    if (kind === 'health') {
      this.player.heal(28);
      this.banner = '装甲修复 +28';
    } else if (kind === 'shield') {
      this.player.addShield(35);
      this.banner = '能量护盾 +35';
    } else if (kind === 'rapid') {
      this.player.addRapid(8);
      this.banner = '急速射击 8s';
    } else {
      this.score += 250 + this.waves.currentWave * 20;
      this.banner = '能量核心 +分';
    }
    this.bannerSub = '';
    this.postfx.pulse(1.1);
  }

  private enterUpgradePhase(): void {
    this.score += 150 * this.waves.currentWave;
    this.player.heal(10);
    this.waves.requestNextWave();
    this.audio.wave();

    const preferWeapons = this.upgradesTaken < 3 || this.waves.currentWave <= 2;
    this.pendingChoices = rollUpgradeChoices(
      this.rng,
      this.upgradeCounts,
      this.waves.currentWave,
      this.stats.weapon,
      new Set(this.secondaries.owned.keys()),
      preferWeapons,
    );
    this.selectedChoice = 0;
    this.state = 'upgrade';
    this.banner = `第 ${this.waves.currentWave} 波完成`;
    this.bannerSub = '选择一项升级';
    this.hud.showBanner('升级选择', '1/2/3 或点击卡片');
    this.hud.setUpgradeChoices(this.pendingChoices.map((id) => UPGRADES[id]));
  }

  private handleUpgradeInput(): void {
    const frame = this.inputFrame;
    // 1/2/3 select card
    if (this.input.wasPressed('Digit1') && this.pendingChoices[0]) {
      this.applyChosenUpgrade(this.pendingChoices[0]);
      return;
    }
    if (this.input.wasPressed('Digit2') && this.pendingChoices[1]) {
      this.applyChosenUpgrade(this.pendingChoices[1]);
      return;
    }
    if (this.input.wasPressed('Digit3') && this.pendingChoices[2]) {
      this.applyChosenUpgrade(this.pendingChoices[2]);
      return;
    }

    if (frame.confirmPressed && this.pendingChoices[this.selectedChoice]) {
      this.applyChosenUpgrade(this.pendingChoices[this.selectedChoice]);
      return;
    }

    if (frame.move.x > 0.5) {
      this.selectedChoice = Math.min(this.pendingChoices.length - 1, this.selectedChoice + 1);
    }
    if (frame.move.x < -0.5) {
      this.selectedChoice = Math.max(0, this.selectedChoice - 1);
    }
    this.hud.highlightUpgrade(this.selectedChoice);
  }

  private applyChosenUpgrade(id: UpgradeId): void {
    const result = applyUpgrade(this.stats, this.secondaryStats, id, this.upgradeCounts);
    if (result.unlockedSecondary) {
      this.secondaries.unlock(result.unlockedSecondary);
    }
    this.secondaries.setStats(this.secondaryStats);
    this.player.setStats(this.stats);
    if (id === 'maxShield') this.player.addShield(22);
    if (id === 'maxHealth') this.player.heal(18);

    this.upgradesTaken += 1;
    this.pendingChoices = [];
    this.state = 'playing';
    this.audio.pickup();
    this.postfx.pulse(1.15);
    this.hud.clearUpgradeChoices();
    this.hud.showBanner(UPGRADES[id].name, UPGRADES[id].description);
    this.banner = UPGRADES[id].name;
    this.bannerSub = UPGRADES[id].description;
  }

  private startRun(): void {
    this.state = 'playing';
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.hitStop = 0;
    this.upgradesTaken = 0;
    this.stats = defaultStats();
    this.secondaryStats = defaultSecondaryStats();
    this.upgradeCounts = new Map();
    this.pendingChoices = [];
    this.rng = createSeededRandom(1337);
    this.player.reset();
    this.player.setStats(this.stats);
    this.secondaries.reset();
    this.secondaries.setStats(this.secondaryStats);
    this.enemies.clear();
    this.bullets.clear();
    this.pickups.clear();
    this.effects.clear();
    this.waves.reset();
    this.waves.startImmediately();
    this.banner = '第 1 波';
    this.bannerSub = '开始作战';
    this.hud.showBanner('出击', '消灭所有敌人');
    this.hud.clearUpgradeChoices();
    this.cameraRig.snapTo(this.player.group.position);
    this.postfx.setBloom(0.55, 0.42, 0.82);
  }

  private snapshot(): HudSnapshot {
    const s = this.player.state;
    return {
      health: s.health,
      maxHealth: s.maxHealth,
      shield: s.shield,
      maxShield: s.maxShield,
      score: this.score,
      combo: Math.max(1, this.combo),
      comboTimer: this.comboTimer,
      wave: this.waves.currentWave,
      waveLabel: this.waves.isBreak
        ? `下一波 ${this.waves.breakTimeLeft.toFixed(1)}s`
        : `第 ${this.waves.currentWave} 波`,
      enemiesLeft: this.enemies.aliveCount + this.waves.pendingSpawns,
      dashReady: this.player.getDashCooldownMax() > 0 ? 1 - s.dashCooldown / this.player.getDashCooldownMax() : 1,
      rapidTimer: s.rapidTimer,
      highScore: this.highScore,
      state: this.state,
      banner: this.banner,
      bannerSub: this.bannerSub,
      weapon: this.stats.weapon,
      upgradeCount: this.upgradesTaken,
      secondaries: Array.from(this.secondaries.owned.keys()),
    };
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.rng = createSeededRandom(value);
      },
      setState: (name: string) => {
        if (
          name !== 'active-play' &&
          name !== 'complete' &&
          name !== 'menu' &&
          name !== 'gameover' &&
          name !== 'upgrade' &&
          !name.startsWith('give:')
        ) {
          throw new Error(`Unknown test state: ${name}`);
        }
        if (name.startsWith('give:')) {
          const id = name.slice(5) as UpgradeId;
          this.applyUpgradeForTest(id);
          this.render();
          this.publishDiagnostics();
          return { state: name };
        }
        if (name === 'menu') {
          this.state = 'menu';
          this.player.reset();
          this.enemies.clear();
          this.bullets.clear();
        } else if (name === 'gameover') {
          this.startRun();
          this.player.state.alive = false;
          this.player.state.health = 0;
          this.state = 'gameover';
        } else if (name === 'upgrade') {
          this.startRun();
          this.enterUpgradePhase();
        } else {
          this.startRun();
          this.spawnEnemy('drone');
          this.spawnEnemy('drone');
          this.spawnEnemy('striker');
          this.spawnEnemy('tank');
          // give shield so VFX shows in screenshots
          this.player.addShield(40);
          if (name === 'complete') {
            this.spawnEnemy('boss');
            this.score = 2400;
            this.combo = 7;
            this.comboTimer = 2.5;
            this.player.addRapid(6);
            this.applyUpgradeForTest('plasma');
            this.player.addShield(35);
          }
        }
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
        if (enabled) this.player.stabilizeVisuals();
        this.render();
        this.publishDiagnostics();
      },
      hideDebugUi: () => {
        /* no debug gui in production */
      },
    };
  }

  private applyUpgradeForTest(id: UpgradeId): void {
    const result = applyUpgrade(this.stats, this.secondaryStats, id, this.upgradeCounts);
    if (result.unlockedSecondary) this.secondaries.unlock(result.unlockedSecondary);
    this.secondaries.setStats(this.secondaryStats);
    this.player.setStats(this.stats);
    this.upgradesTaken += 1;
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    const snap = this.snapshot();
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.score,
      wave: snap.wave,
      state: this.state,
      complete: this.state === 'gameover',
      enemies: this.enemies.aliveCount,
      bullets: this.bullets.getPlayerBullets().length,
      weapon: this.stats.weapon,
      upgrades: this.upgradesTaken,
      secondaries: Array.from(this.secondaries.owned.keys()).join(','),
      shield: this.player.state.shield,
      player: {
        position: {
          x: this.player.group.position.x,
          y: this.player.group.position.y,
          z: this.player.group.position.z,
        },
        health: this.player.state.health,
        speed: this.player.velocity.length(),
        yaw: this.player.group.rotation.y,
      },
      shieldWorld: {
        x: this.player.shieldFx.group.position.x,
        y: this.player.shieldFx.group.position.y,
        z: this.player.shieldFx.group.position.z,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr),
      },
    };

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('voidbreakers-high', String(this.highScore));
      } catch {
        /* ignore */
      }
    }
  }

  private getEl(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
  }
}
