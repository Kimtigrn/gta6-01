// Drawing only: the city, every entity, the HUD with its minimap, and the menus.
// The camera shows a 1280x720 window of the world centred on the player (or
// drifting over downtown on the title screen). Everything is flat canvas shapes
// in a warm, sun-soaked palette — no image files, nothing to load.
import { CAR, CITY, FIELD, FONT, PALETTE, WORLD, rankFor } from './config.js';
import { districtAt } from './city.js';
import { objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { x: 16, y: FIELD.height - 176, w: 220, h: 160 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.hudPanel;
    roundRect(context, x, y, w, h, 10);
    context.fill();
  }

  function updateCamera(state, screen, time) {
    if (screen === SCREEN_TITLE) {
      camera.x = 1000 + Math.cos(time * 0.08) * 500;
      camera.y = 700 + Math.sin(time * 0.05) * 260;
    } else {
      camera.x = state.player.x;
      camera.y = state.player.y;
    }
    camera.x = Math.max(FIELD.width / 2, Math.min(WORLD.width - FIELD.width / 2, camera.x));
    camera.y = Math.max(FIELD.height / 2, Math.min(WORLD.height - FIELD.height / 2, camera.y));
  }

  /** Convert a logical screen point (0..1280, 0..720) to world coordinates. */
  function screenToWorld(sx, sy) {
    return { x: sx + camera.x - FIELD.width / 2, y: sy + camera.y - FIELD.height / 2 };
  }

  function drawCity(state) {
    const city = state.city;
    const camLeft = camera.x - FIELD.width / 2;
    const camTop = camera.y - FIELD.height / 2;
    // Grass base, beach and sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camLeft, camTop, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(camLeft, CITY.beachY, FIELD.width, Math.max(0, FIELD.height - (CITY.beachY - camTop)));
    context.fillStyle = PALETTE.sea;
    context.fillRect(camLeft, CITY.beachY + 34, FIELD.width, 400);
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(camLeft, CITY.beachY + 60, FIELD.width, 400);
    // Parks and trees.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      context.fillStyle = '#3f7a34';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5da244';
      context.beginPath();
      context.arc(tree.x - 2, tree.y - 2, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    // Roads: sidewalk, asphalt, centre dashes.
    for (const line of city.roads) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(line - CITY.roadWidth / 2 - CITY.sidewalk, camTop, CITY.roadWidth + CITY.sidewalk * 2, FIELD.height);
      context.fillRect(camLeft, line - CITY.roadWidth / 2 - CITY.sidewalk, FIELD.width, CITY.roadWidth + CITY.sidewalk * 2);
      context.fillStyle = PALETTE.road;
      context.fillRect(line - CITY.roadWidth / 2, camTop, CITY.roadWidth, FIELD.height);
      context.fillRect(camLeft, line - CITY.roadWidth / 2, FIELD.width, CITY.roadWidth);
      context.fillStyle = PALETTE.lane;
      for (let y = Math.floor(camTop / 44) * 44; y < camTop + FIELD.height; y += 44) {
        context.fillRect(line - 2, y, 4, 22);
      }
      for (let x = Math.floor(camLeft / 44) * 44; x < camLeft + FIELD.width; x += 44) {
        context.fillRect(x, line - 2, 22, 4);
      }
    }
    // Buildings: roof, wall edge and a skylight, shaded by height.
    for (const b of city.buildings) {
      context.fillStyle = PALETTE[b.roof];
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x, b.y + b.h - 8, b.w, 8);
      context.fillRect(b.x + b.w - 8, b.y, 8, b.h);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(b.x + 10, b.y + 10, Math.min(46, b.w - 20), Math.min(30, b.h - 20));
      if (b.height >= 3) {
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
      }
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(context, -halfL + 3, -halfW + 4, CAR.length, CAR.width, 7);
    context.fill();
    context.fillStyle = car.color;
    roundRect(context, -halfL, -halfW, CAR.length, CAR.width, 7);
    context.fill();
    context.fillStyle = 'rgba(20,28,38,0.85)';
    context.fillRect(-6, -halfW + 3, 16, CAR.width - 6);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(halfL - 5, -halfW + 4, 3, 5);
    context.fillRect(halfL - 5, halfW - 9, 3, 5);
    if (car.kind === 'police') {
      context.fillStyle = '#f2f2f2';
      context.fillRect(-halfL + 4, -halfW, 10, CAR.width);
      const flash = Math.floor(time * 4 + car.sirenPhase) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#2f7dff';
      context.fillRect(-2, -halfW + 2, 8, 6);
      context.fillStyle = flash ? '#2f7dff' : '#ff3b30';
      context.fillRect(-2, halfW - 8, 8, 6);
    }
    if (car.kind === 'mission') {
      context.strokeStyle = PALETTE.mission;
      context.lineWidth = 3;
      roundRect(context, -halfL - 4, -halfW - 4, CAR.length + 8, CAR.width + 8, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, skin, shirt, radius) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin;
    context.beginPath();
    context.arc(radius * 0.45, 0, radius * 0.55, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(state, screen, time) {
    drawCity(state);
    // Mission marker: a pulsing beam and diamond over the objective.
    const step = state.mission && state.mission.active
      ? (function missionStep() {
          const missions = state.mission;
          return missions;
        })() : null;
    void step;
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      context.fillStyle = 'rgba(255,159,28,0.25)';
      context.fillRect(marker.x - 8, marker.y - 130, 16, 130);
      context.save();
      context.translate(marker.x, marker.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.mission;
      const size = 16 * pulse;
      context.fillRect(-size / 2, -size / 2, size, size);
      context.restore();
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Pickups.
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob * 3) * 3;
      if (pickup.kind === 'cash') {
        context.fillStyle = PALETTE.money;
        context.beginPath();
        context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
        context.fill();
        text('$', pickup.x, pickup.y + bob + 5, 15, '#0e2a1a', 'center');
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#f2f2f2';
        context.fillRect(pickup.x - 11, pickup.y + bob - 11, 22, 22);
        context.fillStyle = '#e5534b';
        context.fillRect(pickup.x - 3, pickup.y + bob - 8, 6, 16);
        context.fillRect(pickup.x - 8, pickup.y + bob - 3, 16, 6);
      } else {
        context.fillStyle = '#e8d44d';
        context.fillRect(pickup.x - 9, pickup.y + bob - 9, 18, 18);
        context.fillStyle = '#3a3f47';
        context.fillRect(pickup.x - 5, pickup.y + bob - 2, 10, 4);
      }
    }
    // Cars.
    for (const car of state.cars) drawCar(car, time);
    // Pedestrians, officers, enemies.
    for (const ped of state.peds) {
      if (ped.alive) drawPerson(ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.radius);
    }
    for (const officer of state.officers) {
      if (!officer.alive) continue;
      drawPerson(officer.x, officer.y, officer.angle, '#e8b48a', '#2f6fd0', officer.radius);
      context.fillStyle = '#1d4f9c';
      context.fillRect(officer.x - 8, officer.y - 20, 16, 4);
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      drawPerson(enemy.x, enemy.y, enemy.angle, '#c98a5f', '#e5534b', enemy.radius);
      context.fillStyle = '#3a0d0d';
      context.fillRect(enemy.x - 14, enemy.y - 24, 28, 5);
      context.fillStyle = PALETTE.enemy;
      context.fillRect(enemy.x - 14, enemy.y - 24, 28 * Math.max(0, enemy.health / 100), 5);
    }
    // The player on foot.
    const player = state.player;
    if (!player.inCar) {
      const blink = player.hurtFlash > 0 && Math.floor(time * 12) % 2 === 0;
      if (!blink) {
        drawPerson(player.x, player.y, player.angle, '#e8b48a', '#ffd23f', player.radius);
        context.strokeStyle = '#222';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(player.x + Math.cos(player.angle) * 12, player.y + Math.sin(player.angle) * 12);
        context.lineTo(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26);
        context.stroke();
      }
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 3, 0, Math.PI * 2);
      context.stroke();
    }
    // Bullets and particles.
    context.fillStyle = '#ffe66d';
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function missionMarker(state) {
    if (!state.mission || !state.mission.active) return null;
    const missionList = state.mission;
    void missionList;
    // The step's target comes from the missions module via the world's stored step.
    return state.missionTarget ?? null;
  }

  function drawMinimap(state) {
    const { x, y, w, h } = MINIMAP;
    panel(x, y, w, h);
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    const mx = (wx) => x + wx * sx;
    const my = (wy) => y + wy * sy;
    context.strokeStyle = 'rgba(232,212,77,0.8)';
    context.lineWidth = 1;
    for (const line of state.city.roads) {
      context.beginPath();
      context.moveTo(mx(line), my(0));
      context.lineTo(mx(line), my(WORLD.height));
      context.stroke();
      context.beginPath();
      context.moveTo(mx(0), my(line));
      context.lineTo(mx(WORLD.width), my(line));
      context.stroke();
    }
    context.fillStyle = 'rgba(245,241,230,0.5)';
    for (const b of state.city.buildings) {
      context.fillRect(mx(b.x), my(b.y), Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    }
    context.fillStyle = '#2f7fa8';
    context.fillRect(x, my(CITY.beachY + 34), w, h - (CITY.beachY + 34) * sy);
    const marker = missionMarker(state);
    if (marker) {
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(mx(marker.x), my(marker.y), 5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#c9c2ae';
    for (const car of state.cars) {
      if (car.kind === 'traffic') context.fillRect(mx(car.x) - 1, my(car.y) - 1, 2, 2);
    }
    context.fillStyle = '#ff3b30';
    for (const car of state.cars) {
      if (car.kind === 'police') {
        context.beginPath();
        context.arc(mx(car.x), my(car.y), 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Player arrow.
    const player = state.player;
    context.save();
    context.translate(mx(player.x), my(player.y));
    context.rotate(player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    text('SOLMAR BAY', x + 6, y + h - 6, 11, PALETTE.muted, 'left');
  }

  function drawHud(state, time) {
    const player = state.player;
    // Top-left: cash, health, ammo, rank.
    panel(16, 14, 250, 96);
    text(`$${state.cash}`, 30, 46, 30, PALETTE.money, 'left');
    text(rankFor(state.cash), 150, 40, 16, PALETTE.text, 'left');
    context.fillStyle = '#3a0d0d';
    context.fillRect(30, 56, 180, 12);
    context.fillStyle = player.health > 30 ? '#7ed957' : '#e5534b';
    context.fillRect(30, 56, 180 * Math.max(0, player.health / 100), 12);
    text('HP', 216, 68, 13, PALETTE.text, 'left');
    text(player.inCar ? 'DRIVING' : `AMMO ${player.ammo}`, 30, 94, 16, PALETTE.text, 'left');
    if (player.inCar) {
      const car = state.cars.find((c) => c.id === player.carId);
      const speed = car ? Math.abs(Math.round(car.speed * 0.36)) : 0;
      text(`${speed} km/h`, 150, 94, 16, PALETTE.text, 'left');
    }
    // Top-right: wanted stars, clock, district.
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    panel(FIELD.width - 266, 14, 250, 96);
    text(stars, FIELD.width - 30, 46, 28, state.wanted > 0 ? PALETTE.wantedStar : '#5a6270', 'right');
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    const minutes = Math.floor(state.clockMinutes % 60);
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    text(clock, FIELD.width - 30, 72, 18, PALETTE.text, 'right');
    text(districtAt(player.x, player.y), FIELD.width - 30, 96, 15, PALETTE.muted, 'right');
    // Top-centre: mission objective and toast message.
    const objective = objectiveText(state.mission);
    const objWidth = Math.min(620, context.measureText ? 560 : 560);
    void objWidth;
    panel(FIELD.width / 2 - 280, 14, 560, 52);
    text(objective, FIELD.width / 2, 36, 17, PALETTE.text, 'center');
    text('M — mute · P — pause · E — enter/exit car', FIELD.width / 2, 56, 12, PALETTE.muted, 'center');
    if (state.messageTimer > 0 && state.message) {
      const alpha = Math.min(1, state.messageTimer);
      context.globalAlpha = alpha;
      panel(FIELD.width / 2 - 300, 76, 600, 34);
      text(state.message, FIELD.width / 2, 99, 16, '#ffd23f', 'center');
      context.globalAlpha = 1;
    }
    // Bottom-right: context hint.
    let hint = '';
    if (!player.inCar) {
      const near = state.cars.find((c) => Math.hypot(c.x - player.x, c.y - player.y) < 90);
      if (near) hint = 'E — get in the car';
      else hint = 'WASD — move · Mouse — aim · Click — shoot';
    } else {
      hint = 'WASD — drive · E — get out · Space — brake';
    }
    panel(FIELD.width - 330, FIELD.height - 44, 314, 30);
    text(hint, FIELD.width - 173, FIELD.height - 23, 14, PALETTE.text, 'center');
    drawMinimap(state);
    // Hurt vignette.
    if (player.hurtFlash > 0) {
      context.fillStyle = `rgba(229,83,75,${player.hurtFlash * 0.5})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    panel(x, y, width, height);
    text(title, FIELD.width / 2, y + 72, 52, accent ?? PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * 32, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, '#ffd23f', 'center');
  }

  function draw(state, screen, saveInfo, time) {
    updateCamera(state, screen, time);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.translate(-(camera.x - FIELD.width / 2), -(camera.y - FIELD.height / 2));
    drawWorld(state, screen, time);
    context.restore();
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10,18,26,0.35)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      const lines = [
        'An open-world crime story in the sun-soaked city of Solmar Bay.',
        'Steal cars, outrun the police, and run five jobs for fixer Mara Solano.',
        `You are Rio Vega, driver-for-hire. ${rankFor(state.cash)} — $${state.cash} so far.`,
        '',
        'WASD move / drive · Mouse aim · Click shoot · E enter a car · Shift sprint',
      ];
      drawPanel('SOLMAR BAY', lines, saveInfo ? 'Press Enter — continue your story' : 'Press Enter or click — start the story', '#ffd23f');
      return;
    }
    drawHud(state, time);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(10,18,26,0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('PAUSED', ['Your story waits where you left it.', 'Progress saves when a job is finished.'], 'Press P — resume · S — save now', PALETTE.text);
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(40,8,8,0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('FLATLINED', [`Rio went down in ${districtAt(state.player.x, state.player.y)}.`, `Cash kept: $${state.cash} · Jobs done: ${state.stats.missionsDone}`], 'Press Enter — wake up at St. Marina Hospital (-$100)', '#e5534b');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
