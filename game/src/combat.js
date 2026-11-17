// Combat: the player's pistol, enemy gunmen (rivals and guards spawned by
// missions), bullets, pickups (cash, health, ammo) and the particle bursts that
// sell every hit. Bullets are a fixed pool, so firing never allocates.
import { BULLET, PLAYER } from './config.js';

const POOL = 48;

/** A hostile gunman: {x, y, angle, health, radius, fireCooldown, kind, alive}. */
export function spawnEnemy(rng, x, y, kind) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2), health: 100, radius: 12,
    fireCooldown: rng.range(0.5, 1.4), kind: kind ?? 'rival', alive: true,
  };
}

export function createBullets() {
  const pool = [];
  for (let i = 0; i < POOL; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromPlayer: true });
  }
  return pool;
}

/** Fire one bullet from (x, y) along `angle`. Returns false when the pool is full. */
export function fireBullet(pool, x, y, angle, fromPlayer) {
  for (const bullet of pool) {
    if (bullet.active) continue;
    bullet.active = true;
    bullet.x = x + Math.cos(angle) * 18;
    bullet.y = y + Math.sin(angle) * 18;
    bullet.vx = Math.cos(angle) * BULLET.speed;
    bullet.vy = Math.sin(angle) * BULLET.speed;
    bullet.life = BULLET.life;
    bullet.fromPlayer = fromPlayer;
    return true;
  }
  return false;
}

/**
 * Advance bullets and test hits. `targets` are the things player bullets can hit
 * (enemies, officers, pedestrians); `playerHit` is called with damage when an
 * enemy bullet reaches the player. Returns the list of targets that were hit.
 */
export function stepBullets(pool, dt, targets, player, playerCar, onPlayerHit) {
  const hit = [];
  for (const bullet of pool) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.active = false; continue; }
    if (bullet.fromPlayer) {
      for (const target of targets) {
        if (!target.alive) continue;
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const r = (target.radius ?? 12) + 3;
        if (dx * dx + dy * dy < r * r) {
          bullet.active = false;
          target.health -= BULLET.damage;
          if (target.health <= 0) target.alive = false;
          hit.push(target);
          break;
        }
      }
      // Player bullets can also damage a police car they hit.
      if (bullet.active && playerCar) {
        const dx = playerCar.x - bullet.x;
        const dy = playerCar.y - bullet.y;
        if (dx * dx + dy * dy < 24 * 24) bullet.active = false;
      }
    } else {
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const r = player.radius + 3;
      if (dx * dx + dy * dy < r * r) {
        bullet.active = false;
        onPlayerHit(12);
      }
    }
  }
  return hit;
}

/** An enemy gunman walks toward the player and fires when in range. */
export function stepEnemy(enemy, player, dt, rng, pool) {
  if (!enemy.alive) return;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  enemy.angle = Math.atan2(dy, dx);
  if (dist > 220) {
    enemy.x += (dx / dist) * 150 * dt;
    enemy.y += (dy / dist) * 150 * dt;
  }
  enemy.fireCooldown -= dt;
  if (dist < 380 && enemy.fireCooldown <= 0) {
    enemy.fireCooldown = rng.range(0.8, 1.5);
    fireBullet(pool, enemy.x, enemy.y, enemy.angle + rng.range(-0.08, 0.08), false);
  }
}

export function createParticles() {
  return [];
}

/** A short-lived burst (impact sparks, muzzle flash, cash sparkle). */
export function burst(particles, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    particles.push({
      x, y, vx: Math.cos(angle) * speed * (0.4 + Math.random() * 0.6),
      vy: Math.sin(angle) * speed * (0.4 + Math.random() * 0.6),
      life: 0.45, maxLife: 0.45, color, size: 3 + Math.random() * 3,
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}

export function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/** A pickup on the ground: cash, health or ammo. */
export function makePickup(kind, x, y, value) {
  return { kind, x, y, value, radius: 14, bob: 0 };
}

export function stepPickups(pickups, dt) {
  for (const pickup of pickups) pickup.bob += dt;
}

export { PLAYER };
