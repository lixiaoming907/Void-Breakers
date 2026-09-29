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
import { WaveSystem, playerDamageScale, waveStatScale } from '../systems/WaveSystem';
import { SpatialHash, FrameBudget } from '../systems/SpatialHash';
import { createSeededRandom, range, type SeededRandom } from '../utils/random';

// scratch vectors for hot paths — avoid per-frame GC
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fireOrigin = new THREE.Vector3();
const _fireDir = new THREE.Vector3();
const _enemyOrigin = new THREE.Vector3();
const _enemyDir = new THREE.Vector3();
const _spread = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 1, 0);
const _explodePos = new THREE.Vector3();
const _novaPos = new THREE.Vector3();

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
    // 2.0 + full-res bloom was the main GPU cost on mid-range GPUs
    maxDpr: 1.5,
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
  private readonly enemyGrid = new SpatialHash(3.5);
  private readonly queryBuf: number[] = [];
  private readonly explosionBudget = new FrameBudget(8);
  private explosionChain = 0;
  private upgradeCounts = new Map<UpgradeId, number>();
  private pendingChoices: UpgradeId[] = [];
  private selectedChoice = 0;
  private upgradesTaken = 0;

  // reused per-frame buffers (avoid GC in the hot update path)
  private readonly enemyPosBuf: { x: number; z: number; radius: number }[] = [];
  private enemyPosCount = 0;
  private secondaryIdsCache: string[] = [];
  private secondaryIdsDirty = true;
  private diagTick = 0;
  private cachedStatsBlock = '';
  private lastStatsHtml = '';

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
    this.publishDiagnostics(true);
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

    // rebuild shared enemy snapshot without allocating new arrays/objects
    this.enemyPosCount = 0;
    const enemyList = this.enemies.enemies;
    for (let i = 0; i < enemyList.length; i++) {
      const e = enemyList[i];
      if (!e.alive) continue;
      let slot = this.enemyPosBuf[this.enemyPosCount];
      if (!slot) {
        slot = { x: 0, z: 0, radius: 0 };
        this.enemyPosBuf.push(slot);
      }
      slot.x = e.group.position.x;
      slot.z = e.group.position.z;
      slot.radius = e.radius;
      this.enemyPosCount += 1;
    }
    if (this.enemyPosBuf.length > this.enemyPosCount) {
      this.enemyPosBuf.length = this.enemyPosCount;
    }

    // spatial hash once per frame — used by bullets, orbit blades, explosions
    this.enemyGrid.clear();
    for (let i = 0; i < enemyList.length; i++) {
      const e = enemyList[i];
      if (e.alive) this.enemyGrid.insert(i, e.group.position.x, e.group.position.z);
    }
    this.explosionBudget.reset();
    this.deathsThisFrame = 0;

    this.bullets.update(delta, this.enemyPosBuf);
    this.enemies.update(delta, this.reducedMotion ? 0 : elapsed, this.player.group.position);

    // secondaries
    const secEvents = this.secondaries.update(
      delta,
      elapsed,
      this.player.group.position,
      this.player.group.rotation.y,
      this.enemyPosBuf,
    );
    for (const hit of secEvents.orbitHits) {
      this.audio.secondary('orbit');
      const dmg = hit.damage * playerDamageScale(this.waves.currentWave);
      const candidates = this.enemyGrid.query(hit.x, hit.z, 1.2, this.queryBuf);
      for (let ci = 0; ci < candidates.length; ci++) {
        const enemy = enemyList[candidates[ci]];
        if (!enemy || !enemy.alive) continue;
        const dx = enemy.group.position.x - hit.x;
        const dz = enemy.group.position.z - hit.z;
        if (dx * dx + dz * dz < (enemy.radius + 0.2) * (enemy.radius + 0.2)) {
          this.damageEnemy(enemy, dmg, false);
        }
      }
    }
    if (secEvents.missiles) {
      const m = secEvents.missiles;
      for (let i = 0; i < m.count; i++) {
        const angle = (i / m.count) * Math.PI * 2;
        const dir = _dir.set(Math.cos(angle), 0, Math.sin(angle));
        this.bullets.firePlayer({
          origin: _origin.set(m.x, 0.45, m.z),
          direction: dir,
          damage: m.damage * this.stats.damageMult * playerDamageScale(this.waves.currentWave),
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
      this.audio.secondary('missile');
    }
    for (const nova of secEvents.novas) {
      this.audio.secondary('nova');
      this.effects.shockwave(_novaPos.set(nova.x, 0, nova.z), '#00f5d4', nova.radius * 0.85, 0.4);
      this.cameraRig.addShake(0.05);
      this.postfx.pulse(1.05);
      for (const enemy of this.enemies.enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.group.position.x - nova.x, enemy.group.position.z - nova.z);
        if (d <= nova.radius) {
          this.damageEnemy(
            enemy,
            nova.damage * this.stats.damageMult * playerDamageScale(this.waves.currentWave) * (1 - (d / nova.radius) * 0.35),
            false,
          );
        }
      }
    }
    for (const shot of secEvents.turretShots) {
      const dir = _dir.set(shot.tx - shot.x, 0, shot.tz - shot.z);
      if (dir.lengthSq() < 0.001) continue;
      this.audio.secondary('turret');
      this.bullets.firePlayer({
        origin: _origin.set(shot.x, 0.4, shot.z),
        direction: dir,
        damage: shot.damage * this.stats.damageMult * playerDamageScale(this.waves.currentWave),
        speed: 20,
        weapon: 'reflect',
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
      this.effects.explosion(_v1.copy(this.player.group.position).setY(0.6), '#00e5ff', 1.8);
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
    const origin = _fireOrigin.copy(this.player.group.position);
    origin.y = 0.5;
    const dir = _fireDir.copy(this.player.aimWorld).sub(this.player.group.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();
    origin.addScaledVector(dir, 0.85);

    const crit = this.rng() < this.stats.critChance;
    const damage =
      PLAYER.bulletDamage *
      this.stats.damageMult *
      playerDamageScale(this.waves.currentWave) *
      (crit ? this.stats.critDamageMult : 1);

    const s = this.stats;

    // ── 光矛：瞬间出光，无飞行过程 ──
    if (s.weapon === 'lance') {
      const width = s.lanceWidth;
      const beams = 1 + s.multishotBonus + (s.lanceWidth > 1.3 ? 1 : 0);
      const range = 48;
      for (let b = 0; b < Math.min(beams, 3); b++) {
        const lateral = (b - (Math.min(beams, 3) - 1) / 2) * 0.55 * width;
        const d = _dir.copy(dir);
        // slight lateral offset without rotating
        const ox = -dir.z * lateral;
        const oz = dir.x * lateral;
        const fromX = origin.x + ox;
        const fromZ = origin.z + oz;
        this.bullets.spawnLanceBeam(
          _origin.set(fromX, 0.5, fromZ),
          d,
          width,
          range,
        );
        // sample along the beam and damage enemies in the corridor
        const enemyList = this.enemies.enemies;
        for (const enemy of enemyList) {
          if (!enemy.alive) continue;
          const ex = enemy.group.position.x - fromX;
          const ez = enemy.group.position.z - fromZ;
          const along = ex * dir.x + ez * dir.z;
          if (along < 0 || along > range) continue;
          const side = Math.abs(ex * -dir.z + ez * dir.x);
          if (side <= enemy.radius + 0.35 * width) {
            this.damageEnemy(enemy, damage * s.lanceDmg * 1.65, crit, 0);
          }
        }
      }
      this.audio.shoot('lance');
      this.cameraRig.addShake(0.04);
      this.postfx.pulse(1.12);
      return;
    }

    let weaponDamageMult = 1;
    let weaponMultishot = 0;
    let weaponExtra = 0;
    let weaponPierce = 0;
    let weaponTurn = 1;
    let weaponLife = 1;

    switch (s.weapon) {
      case 'scatter':
        weaponDamageMult = s.scatterDmg;
        weaponExtra = s.scatterPellets;
        weaponPierce = s.scatterPierce;
        break;
      case 'homing':
        weaponDamageMult = s.homingDmg;
        weaponMultishot = s.homingSalvo;
        weaponTurn = s.homingTurn;
        break;
      case 'blackhole':
        weaponDamageMult = 1;
        weaponTurn = s.blackholeRadius;
        weaponExtra = s.blackholeGravity;
        weaponLife = s.blackholeDps;
        break;
      case 'missile':
        weaponDamageMult = s.missileBoomDmg;
        weaponTurn = s.missileBoomRadius;
        weaponExtra = s.missileBoomDmg;
        break;
      case 'reflect':
        weaponDamageMult = s.reflectDmg * s.reflectSpeed;
        weaponExtra = s.reflectBounce;
        weaponLife = s.reflectSpeed;
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
      multishot: s.multishotBonus,
      pierce: s.pierceBonus,
      explosive: s.explosive || s.weapon === 'missile',
      crit,
      weaponMultishot,
      weaponDamageMult,
      weaponRateHint: 1,
      weaponPierce,
      weaponExtra,
      weaponTurn,
      weaponLife,
    });

    this.audio.shoot(s.weapon);
    // no muzzle smoke
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#070d1c');
    this.scene.fog = new THREE.Fog('#0a1528', 36, 100);

    const hemi = new THREE.HemisphereLight('#b8d4ff', '#142038', 1.7);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#e8f2ff', 2.9);
    key.position.set(-12, 20, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
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
      _v3.set(at.x, 0, at.z);
      _v3.x = THREE.MathUtils.clamp(_v3.x, -ARENA.halfWidth + 1, ARENA.halfWidth - 1);
      _v3.z = THREE.MathUtils.clamp(_v3.z, -ARENA.halfDepth + 1, ARENA.halfDepth - 1);
      this.enemies.spawn(kind, _v3, waveStatScale(this.waves.currentWave));
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

    const toPlayer = _v1.subVectors(this.player.group.position, _v2.set(x, 0, z));
    if (toPlayer.length() < 5) {
      x = THREE.MathUtils.clamp(x + Math.sign(x || 1) * 4, -ARENA.halfWidth + 1, ARENA.halfWidth - 1);
    }

    this.enemies.spawn(kind, _v2.set(x, 0, z), waveStatScale(this.waves.currentWave));
  }

  private handleCollisions(delta: number): void {
    const playerPos = this.player.group.position;
    const playerRadius = PLAYER.radius;

    // spatial hash + explosion budget already rebuilt at the top of the playing update
    const enemyList = this.enemies.enemies;

    this.bullets.forEachPlayerBullet((bullet) => {
      if (bullet.spawnGrace > 0) return;

      // ── 黑洞：引力拉扯真实敌人 + 持续 AOE，不因碰撞消失 ──
      if (bullet.kind === 'player-blackhole') {
        const aoe = Math.max(bullet.aoe || 2.2, bullet.radius + 0.4);
        const gravity = bullet.gravity || 12;
        const pullRange = aoe * 4.5;
        const candidates = this.enemyGrid.query(bullet.mesh.position.x, bullet.mesh.position.z, pullRange, this.queryBuf);
        const tick = bullet.dps * delta;
        for (let ci = 0; ci < candidates.length; ci++) {
          const enemy = enemyList[candidates[ci]];
          if (!enemy || !enemy.alive) continue;
          const dx = bullet.mesh.position.x - enemy.group.position.x;
          const dz = bullet.mesh.position.z - enemy.group.position.z;
          const dist = Math.hypot(dx, dz);
          // 引力：把敌人往黑洞中心拉（真实 transform，不是快照）
          if (dist > 0.2 && dist < pullRange) {
            const strength = (gravity * delta) / Math.max(1.1, dist * 0.35);
            enemy.group.position.x += (dx / dist) * strength;
            enemy.group.position.z += (dz / dist) * strength;
          }
          if (dist <= aoe + enemy.radius) {
            this.damageEnemy(enemy, tick, false, 3);
          }
        }
        return;
      }

      const bx = bullet.mesh.position.x;
      const bz = bullet.mesh.position.z;
      const candidates = this.enemyGrid.query(bx, bz, 2.4, this.queryBuf);
      for (let ci = 0; ci < candidates.length; ci++) {
        const enemy = enemyList[candidates[ci]];
        if (!enemy || !enemy.alive) continue;
        const dx = bullet.mesh.position.x - enemy.group.position.x;
        const dz = bullet.mesh.position.z - enemy.group.position.z;
        const distSq = dx * dx + dz * dz;
        const hitRadius = enemy.radius + bullet.radius + 0.12;
        if (distSq <= hitRadius * hitRadius) {
          // ── 导弹：命中爆炸 ──
          if (bullet.kind === 'player-missile') {
            this.explodeAt(
              bullet.mesh.position,
              bullet.boomDamage || bullet.damage * 1.8,
              enemy,
              0,
              bullet.aoe || 2.1,
            );
            this.bullets.consume(bullet);
            this.audio.hit();
            return;
          }

          const killed = this.damageEnemy(enemy, bullet.damage, bullet.crit);
          // no impact smoke — only audio / score feedback

          if (bullet.explosive) {
            this.explodeAt(bullet.mesh.position, bullet.damage * 0.55, enemy, 0, 1.8);
          }

          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else if (bullet.bounces > 0 && bullet.kind === 'player-reflect') {
            let best: Enemy | null = null;
            let bestDistSq = 120;
            const near = this.enemyGrid.query(bx, bz, 11, this.queryBuf);
            for (let ni = 0; ni < near.length; ni++) {
              const e = enemyList[near[ni]];
              if (!e || !e.alive || e === enemy) continue;
              const ex = e.group.position.x - bx;
              const ez = e.group.position.z - bz;
              const dSq = ex * ex + ez * ez;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                best = e;
              }
            }
            if (
              best &&
              this.bullets.bounce(bullet, best.group.position, PLAYER.bulletSpeed * this.stats.bulletSpeedMult)
            ) {
              // keep flying
            } else {
              this.bullets.consume(bullet);
            }
          } else {
            this.bullets.consume(bullet);
          }
          this.audio.hit();
          if (killed) void killed;
          return;
        }
      }
    });

    for (const bullet of this.bullets.getActive('enemy')) {
      const dx = bullet.mesh.position.x - playerPos.x;
      const dz = bullet.mesh.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= (playerRadius + 0.22) * (playerRadius + 0.22)) {
        this.bullets.consume(bullet);
        if (this.player.takeDamage(bullet.damage)) {
          this.audio.hurt();
          this.cameraRig.addShake(0.12);
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
          this.cameraRig.addShake(0.22);
          this.effects.burst(_v1.copy(playerPos).setY(0.5), '#ff4d6d', 16, 7, 1.1);
          this.combo = 0;
          continue;
        }
        if (this.player.takeDamage(enemy.damage * 0.65)) {
          this.audio.hurt();
          this.cameraRig.addShake(0.15);
          this.effects.burst(_v1.copy(playerPos).setY(0.5), '#ff4d6d', 10, 5, 1);
          _v1.set(dx, 0, dz).normalize().multiplyScalar(3.2);
          this.player.velocity.add(_v1);
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
      const origin = _enemyOrigin.copy(enemy.group.position).setY(0.55);
      const dir = _enemyDir.copy(playerPos).sub(origin);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) continue;
      dir.normalize();
      const speed = enemy.kind === 'boss' ? 13 : enemy.kind === 'sniper' ? 20 : 11.5;
      this.bullets.spawnEnemy(origin, dir, enemy.damage, speed);
      if (enemy.kind === 'boss') {
        for (const angle of [-0.28, 0.28]) {
          const spread = _spread.copy(dir).applyAxisAngle(_axisY, angle);
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

  private damageEnemy(enemy: Enemy, amount: number, crit: boolean, chain = 0): boolean {
    const killed = this.enemies.damage(enemy, amount);
    if (crit) this.effects.shockwave(enemy.group.position, '#fee440', 1.6, 0.25);
    if (killed) this.onEnemyKilled(enemy, chain);
    return killed;
  }

  private explodeAt(
    position: THREE.Vector3,
    damage: number,
    source?: Enemy,
    chain = 0,
    radius = 2.5,
  ): void {
    if (chain > 2) return;
    if (this.explosionChain > 12) return;
    this.explosionChain += 1;

    const px = position.x;
    const pz = position.z;

    const canVfx = this.explosionBudget.trySpend(1);
    if (canVfx) {
      // missile boom: small smoke puff only (no full spark explosion)
      _v1.set(px, 0.25, pz);
      this.effects.burst(_v1, '#8a9aaa', 6, 2.2, 1.4);
      this.cameraRig.addShake(0.06);
      this.postfx.pulse(1.1);
    }

    const r = radius;
    const candidates = this.enemyGrid.query(px, pz, r, this.queryBuf);
    const enemyList = this.enemies.enemies;
    for (let i = 0; i < candidates.length; i++) {
      const enemy = enemyList[candidates[i]];
      if (!enemy || !enemy.alive || enemy === source) continue;
      const dx = enemy.group.position.x - px;
      const dz = enemy.group.position.z - pz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < r) {
        const falloff = 1 - (d / r) * 0.45;
        const killed = this.enemies.damage(enemy, damage * falloff);
        if (killed) this.onEnemyKilled(enemy, chain + 1);
      }
    }
    this.explosionChain = Math.max(0, this.explosionChain - 1);
  }

  private deathVfxBudget = 3;
  private deathsThisFrame = 0;

  private onEnemyKilled(enemy: Enemy, chain = 0): void {
    this.combo += 1;
    this.comboTimer = 2.8;
    const comboMult = 1 + Math.floor(this.combo / 5) * 0.35;
    this.score += Math.floor(enemy.score * comboMult * (1 + this.waves.currentWave * 0.04));

    this.deathsThisFrame += 1;
    const cheap = this.deathsThisFrame > this.deathVfxBudget;
    if (!cheap || enemy.kind === 'boss') {
      this.audio.explode(enemy.kind === 'boss');
    }
    // no death smoke/sparks — score & audio only (except boss pulse)
    if (enemy.kind === 'boss') {
      this.cameraRig.addShake(0.85);
      this.hitStop = 0.1;
      this.postfx.pulse(1.25);
    } else if (!cheap) {
      this.cameraRig.addShake(0.03);
    }

    if (this.stats.shieldOnKill > 0) {
      this.player.addShield(this.stats.shieldOnKill);
    }

    // splitter: spawn smaller chasers
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        _v2.set(enemy.group.position.x + (this.rng() - 0.5) * 1.4, 0, enemy.group.position.z + (this.rng() - 0.5) * 1.4);
        this.spawnEnemy('swarm', _v2);
      }
    }

    // bomber death is an AOE (also on contact — handled in collisions)
    if (enemy.kind === 'bomber' && chain < 2) {
      _explodePos.copy(enemy.group.position);
      this.explodeAt(_explodePos, enemy.damage * 0.75, enemy, chain + 1);
    }

    const roll = this.rng();
    const pos = _v1.copy(enemy.group.position);
    if (enemy.kind === 'boss') {
      this.spawnPickup('shield', pos);
      this.spawnPickup('rapid', _v2.copy(pos).add(_v3.set(1.2, 0, 0.6)));
      this.spawnPickup('health', _v2.copy(pos).add(_v3.set(-1.2, 0, -0.6)));
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
    const p = _v2.copy(position);
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
    this.secondaryIdsDirty = true;
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
    this.secondaryIdsDirty = true;
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
    if (this.secondaryIdsDirty) {
      this.secondaryIdsCache = Array.from(this.secondaries.owned.keys());
      this.secondaryIdsDirty = false;
    }
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
      secondaries: this.secondaryIdsCache,
      // pause panel only — avoid HTML string churn during play
      statsBlock: this.state === 'paused' ? this.buildStatsBlock() : undefined,
    };
  }

  private buildStatsBlock(): string {
    const s = this.player.state;
    const st = this.stats;
    // cheap dirty check — rebuild only when the rendered numbers change
    const key = `${Math.ceil(s.health)}|${s.maxHealth}|${Math.ceil(s.shield)}|${s.maxShield}|${st.damageMult}|${st.fireRateMult}|${st.moveSpeedMult}|${st.bulletSpeedMult}|${st.critChance}|${st.critDamageMult}|${st.multishotBonus}|${st.pierceBonus}|${st.shieldRegenPerSec}|${st.weapon}|${this.player.getDashCooldownMax()}`;
    if (key === this.cachedStatsBlock) {
      return this.lastStatsHtml;
    }
    this.cachedStatsBlock = key;
    const rows: [string, string][] = [
      ['装甲', `${Math.ceil(s.health)} / ${s.maxHealth}`],
      ['护盾', `${Math.ceil(s.shield)} / ${s.maxShield}`],
      ['伤害倍率', `×${st.damageMult.toFixed(2)}`],
      ['射速倍率', `×${st.fireRateMult.toFixed(2)}`],
      ['移速倍率', `×${st.moveSpeedMult.toFixed(2)}`],
      ['弹速倍率', `×${st.bulletSpeedMult.toFixed(2)}`],
      ['暴击率', `${Math.round(st.critChance * 100)}%`],
      ['暴击伤害', `×${st.critDamageMult.toFixed(2)}`],
      ['多重射击', `+${st.multishotBonus}`],
      ['穿透', `+${st.pierceBonus + (st.weapon === 'scatter' ? st.scatterPierce : 0)}`],
      ['护盾回充', `${st.shieldRegenPerSec.toFixed(1)}/s`],
      ['冲刺冷却', `${(this.player.getDashCooldownMax()).toFixed(2)}s`],
    ];
    let html = '';
    for (let i = 0; i < rows.length; i++) {
      html += `<div class="stat-row"><span>${rows[i][0]}</span><strong>${rows[i][1]}</strong></div>`;
    }
    this.lastStatsHtml = html;
    return html;
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
          this.publishDiagnostics(true);
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
            this.applyUpgradeForTest('missile');
            this.player.addShield(35);
          }
        }
        this.render();
        this.publishDiagnostics(true);
        return { state: name };
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
        if (enabled) this.player.stabilizeVisuals();
        this.render();
        this.publishDiagnostics(true);
      },
      hideDebugUi: () => {
        /* no debug gui in production */
      },
    };
  }

  private applyUpgradeForTest(id: UpgradeId): void {
    const result = applyUpgrade(this.stats, this.secondaryStats, id, this.upgradeCounts);
    if (result.unlockedSecondary) this.secondaries.unlock(result.unlockedSecondary);
    this.secondaryIdsDirty = true;
    this.secondaries.setStats(this.secondaryStats);
    this.player.setStats(this.stats);
    this.upgradesTaken += 1;
  }

  private publishDiagnostics(force = false): void {
    // throttle object churn — tests/smoke scripts call with force=true
    if (!force) {
      this.diagTick += 1;
      if (this.diagTick % 4 !== 0) return;
    }
    const info = this.renderer.info;
    const s = this.player.state;
    if (this.secondaryIdsDirty) {
      this.secondaryIdsCache = Array.from(this.secondaries.owned.keys());
      this.secondaryIdsDirty = false;
    }
    let secondaryJoin = '';
    for (let i = 0; i < this.secondaryIdsCache.length; i++) {
      if (i > 0) secondaryJoin += ',';
      secondaryJoin += this.secondaryIdsCache[i];
    }
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.score,
      wave: this.waves.currentWave,
      state: this.state,
      complete: this.state === 'gameover',
      enemies: this.enemies.aliveCount,
      bullets: this.bullets.activePlayerCount,
      weapon: this.stats.weapon,
      upgrades: this.upgradesTaken,
      secondaries: secondaryJoin,
      shield: s.shield,
      player: {
        position: {
          x: this.player.group.position.x,
          y: this.player.group.position.y,
          z: this.player.group.position.z,
        },
        health: s.health,
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
