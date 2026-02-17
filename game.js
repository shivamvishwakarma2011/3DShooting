import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163/build/three.module.js';

const SAVE_KEY = '3d-shooting-arena-v3';

const ui = {
  mode: document.getElementById('mode'),
  difficulty: document.getElementById('difficulty'),
  restart: document.getElementById('restart'),
  saveV3: document.getElementById('saveV3'),
  status: document.getElementById('status'),
  timer: document.getElementById('timer'),
  teamScore: document.getElementById('teamScore'),
  score: document.getElementById('score'),
  kills: document.getElementById('kills'),
  deaths: document.getElementById('deaths'),
  scope: document.getElementById('scopeOverlay'),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d1c);
scene.fog = new THREE.Fog(0x090d1c, 70, 180);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xaccdff, 0x172038, 0.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(22, 36, 10);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  new THREE.MeshStandardMaterial({ color: 0x1a263f, roughness: 0.92, metalness: 0.06 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

for (let i = 0; i < 28; i++) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(4 + Math.random() * 4, 3 + Math.random() * 2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x202f53, roughness: 0.74, metalness: 0.16 })
  );
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.position.set((Math.random() - 0.5) * 130, 1.5 + Math.random(), (Math.random() - 0.5) * 130);
  wall.rotation.y = Math.random() * Math.PI;
  scene.add(wall);
}

const weapon = createDetailedGun();
const crosshair = makeCrosshair();
scene.add(weapon);
scene.add(crosshair);

const modes = {
  tdm: { label: 'TDM', friendlyFire: false },
  dm: { label: 'DM', friendlyFire: true },
  ffa: { label: 'FFA', friendlyFire: true },
};

const botProfiles = {
  rookie: { speed: 5.8, reaction: 1.5, aim: 0.32, fireRate: 1.2, hp: 65 },
  veteran: { speed: 8.1, reaction: 1.0, aim: 0.58, fireRate: 0.86, hp: 90 },
  pro: { speed: 10.8, reaction: 0.62, aim: 0.84, fireRate: 0.56, hp: 120 },
};

const state = {
  mode: 'tdm',
  perspective: 'first',
  scoped: false,
  health: 100,
  kills: 0,
  deaths: 0,
  score: 0,
  team: 'alpha',
  alphaPoints: 0,
  omegaPoints: 0,
  matchTime: 300,
  ended: false,
};

const player = {
  id: 'player',
  team: 'alpha',
  hp: 100,
  pos: new THREE.Vector3(0, 1.75, 8),
  respawnTimer: 0,
};

const bots = [];
const bullets = [];

const keys = new Set();
const pointer = { x: 0, y: 0, down: false };
const clock = new THREE.Clock();
let fireCooldown = 0;

loadSavedV3();
resetMatch();
animate();

window.addEventListener('resize', onResize);
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  pointer.x -= e.movementX * 0.0024;
  pointer.y -= e.movementY * 0.0024;
  pointer.y = THREE.MathUtils.clamp(pointer.y, -1.25, 1.3);
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) pointer.down = true;
  if (e.button === 2) {
    state.scoped = true;
    ui.scope.classList.add('on');
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) pointer.down = false;
  if (e.button === 2) {
    state.scoped = false;
    ui.scope.classList.remove('on');
  }
});

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'F3') {
    state.perspective = state.perspective === 'first' ? 'third' : 'first';
    announce(`Perspective: ${state.perspective.toUpperCase()}`);
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.code));

ui.mode.addEventListener('change', () => {
  state.mode = ui.mode.value;
  resetMatch();
});
ui.difficulty.addEventListener('change', resetMatch);
ui.restart.addEventListener('click', resetMatch);
ui.saveV3.addEventListener('click', saveV3);

function loadSavedV3() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    if (data.mode && modes[data.mode]) state.mode = data.mode;
    if (data.difficulty && botProfiles[data.difficulty]) ui.difficulty.value = data.difficulty;
    if (data.perspective === 'first' || data.perspective === 'third') state.perspective = data.perspective;
    ui.mode.value = state.mode;
    announce('Loaded V3 settings');
  } catch {
    announce('V3 save unavailable');
  }
}

function saveV3() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    mode: state.mode,
    difficulty: ui.difficulty.value,
    perspective: state.perspective,
  }));
  announce('V3 saved');
}

function resetMatch() {
  for (const bot of bots) scene.remove(bot.mesh);
  for (const bullet of bullets) scene.remove(bullet.mesh);
  bots.length = 0;
  bullets.length = 0;

  state.health = 100;
  state.kills = 0;
  state.deaths = 0;
  state.score = 0;
  state.alphaPoints = 0;
  state.omegaPoints = 0;
  state.matchTime = 300;
  state.ended = false;

  player.pos.set(0, 1.75, 8);
  player.hp = 100;
  player.respawnTimer = 0;

  const profile = botProfiles[ui.difficulty.value];
  for (let i = 0; i < 10; i++) {
    const team = state.mode === 'ffa' ? `solo-${i}` : i % 2 === 0 ? 'alpha' : 'omega';
    bots.push(spawnBot(i, team, profile));
  }

  announce(`${modes[state.mode].label} V3 live with ${ui.difficulty.value.toUpperCase()} bots`);
}

function spawnBot(id, team, profile) {
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.62, 1.3, 4, 12),
    new THREE.MeshStandardMaterial({ color: team.startsWith('solo') ? 0x9d73ff : team === 'alpha' ? 0x4f7cff : 0xff5a71 })
  );
  body.castShadow = true;

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.18, 0.2),
    new THREE.MeshStandardMaterial({ emissive: 0x55d6ff, color: 0x22303f })
  );
  visor.position.set(0, 0.72, 0.51);

  mesh.add(body);
  mesh.add(visor);
  mesh.position.set((Math.random() - 0.5) * 90, 1.5, (Math.random() - 0.5) * 90);
  scene.add(mesh);

  return {
    id,
    team,
    mesh,
    hp: profile.hp,
    profile,
    fireAt: Math.random(),
    moveNoise: new THREE.Vector3(),
    respawnTimer: 0,
  };
}

function createDetailedGun() {
  const gun = new THREE.Group();
  const matDark = new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.38, metalness: 0.6 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x76839d, roughness: 0.2, metalness: 0.9 });
  const matGrip = new THREE.MeshStandardMaterial({ color: 0x191b20, roughness: 0.82, metalness: 0.2 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 1.3), matDark);
  receiver.position.set(0.22, -0.2, -0.4);
  gun.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 1.5, 16), matSteel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.21, -0.2, -1.15);
  gun.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.11, 16), matSteel);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.21, -0.2, -1.93);
  gun.add(muzzle);

  const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.74, 18), matDark);
  scopeBody.rotation.x = Math.PI / 2;
  scopeBody.position.set(0.2, 0.03, -0.53);
  gun.add(scopeBody);

  const scopeLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 24),
    new THREE.MeshStandardMaterial({ color: 0x113c4c, emissive: 0x3de6ff, emissiveIntensity: 0.35 })
  );
  scopeLens.position.set(0.2, 0.03, -0.19);
  gun.add(scopeLens);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.9), matSteel);
  rail.position.set(0.2, -0.03, -0.45);
  gun.add(rail);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.19), matDark);
  mag.position.set(0.2, -0.48, -0.36);
  gun.add(mag);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.14), matGrip);
  grip.position.set(0.2, -0.51, 0.03);
  grip.rotation.x = 0.28;
  gun.add(grip);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.68), matDark);
  stock.position.set(0.2, -0.2, 0.58);
  gun.add(stock);

  return gun;
}

function makeCrosshair() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xd0ecff });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.001), material));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.001), material));
  return group;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (!state.ended) {
    state.matchTime = Math.max(0, state.matchTime - dt);
    if (state.matchTime === 0) endMatch();
  }

  fireCooldown -= dt;
  updatePlayer(dt);
  updateBots(dt);
  updateBullets(dt);
  updateUI();

  renderer.render(scene, camera);
}

function endMatch() {
  state.ended = true;
  if (state.mode === 'tdm') {
    const outcome = state.alphaPoints === state.omegaPoints ? 'DRAW' : state.alphaPoints > state.omegaPoints ? 'ALPHA WINS' : 'OMEGA WINS';
    announce(`Match Ended: ${outcome}`);
  } else {
    announce(`Match Ended: Your score ${state.score}`);
  }
}

function updatePlayer(dt) {
  if (player.respawnTimer > 0) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      player.hp = 100;
      state.health = 100;
      player.pos.set(0, 1.75, 8);
      announce('Respawned');
    }
  }

  camera.rotation.order = 'YXZ';
  camera.rotation.y = pointer.x;
  camera.rotation.x = pointer.y;

  const dir = new THREE.Vector3();
  const speed = keys.has('ShiftLeft') ? 18 : 12;
  if (keys.has('KeyW')) dir.z -= 1;
  if (keys.has('KeyS')) dir.z += 1;
  if (keys.has('KeyA')) dir.x -= 1;
  if (keys.has('KeyD')) dir.x += 1;

  if (dir.lengthSq() && player.hp > 0) {
    dir.normalize();
    const move = new THREE.Vector3(dir.x, 0, dir.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), pointer.x);
    player.pos.addScaledVector(move, speed * dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -100, 100);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -100, 100);
  }

  camera.position.copy(player.pos);

  const scopeFov = state.scoped ? 26 : 75;
  camera.fov = THREE.MathUtils.lerp(camera.fov, scopeFov, 0.18);
  camera.updateProjectionMatrix();

  if (state.perspective === 'first') {
    weapon.visible = true;
    crosshair.visible = true;
    weapon.position.copy(camera.position).add(new THREE.Vector3(0, -0.24, -0.45).applyEuler(camera.rotation));
    weapon.rotation.copy(camera.rotation);
  } else {
    weapon.visible = false;
    crosshair.visible = false;
    const pivot = player.pos.clone();
    const offset = new THREE.Vector3(0, 2.3, 6.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), pointer.x);
    camera.position.copy(pivot.clone().add(offset));
    camera.lookAt(pivot.x, 1.2, pivot.z);
  }

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  crosshair.position.copy(camera.position).add(forward.multiplyScalar(2));
  crosshair.quaternion.copy(camera.quaternion);

  if (pointer.down && fireCooldown <= 0 && player.hp > 0 && !state.ended) {
    fireBullet(camera.position.clone(), forward, 'player', player.team);
    fireCooldown = state.scoped ? 0.2 : 0.13;
  }
}

function updateBots(dt) {
  for (const bot of bots) {
    if (bot.respawnTimer > 0) {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        bot.hp = bot.profile.hp;
        bot.mesh.visible = true;
        bot.mesh.position.set((Math.random() - 0.5) * 90, 1.5, (Math.random() - 0.5) * 90);
      }
      continue;
    }

    const target = findTargetForBot(bot);
    if (!target) continue;

    const targetPos = target.kind === 'player' ? player.pos : target.bot.mesh.position;
    const toTarget = new THREE.Vector3().subVectors(targetPos, bot.mesh.position);
    const distance = toTarget.length();

    bot.moveNoise.set(Math.sin(performance.now() * 0.0003 + bot.id), 0, Math.cos(performance.now() * 0.00022 + bot.id));

    if (distance > 12) {
      bot.mesh.position.addScaledVector(toTarget.normalize().add(bot.moveNoise.multiplyScalar(0.22)).normalize(), bot.profile.speed * dt);
    } else {
      bot.mesh.position.addScaledVector(bot.moveNoise.normalize(), bot.profile.speed * 0.28 * dt);
    }

    bot.mesh.lookAt(targetPos.x, 1.5, targetPos.z);
    bot.fireAt -= dt;

    if (bot.fireAt <= 0 && distance < 75 && !state.ended) {
      const aimNoise = (1 - bot.profile.aim) * 0.2;
      const noisyDir = new THREE.Vector3(
        toTarget.x + (Math.random() - 0.5) * aimNoise * distance,
        toTarget.y + (Math.random() - 0.5) * aimNoise * distance,
        toTarget.z + (Math.random() - 0.5) * aimNoise * distance
      ).normalize();

      fireBullet(bot.mesh.position.clone().add(new THREE.Vector3(0, 0.62, 0)), noisyDir, `bot-${bot.id}`, bot.team);
      bot.fireAt = bot.profile.fireRate + Math.random() * bot.profile.reaction;
    }
  }
}

function findTargetForBot(bot) {
  const possible = [];
  if (player.hp > 0 && isEnemy(bot.team, player.team)) {
    possible.push({ kind: 'player', distance: bot.mesh.position.distanceTo(player.pos) });
  }

  for (const other of bots) {
    if (other.id === bot.id || other.hp <= 0 || other.respawnTimer > 0) continue;
    if (!isEnemy(bot.team, other.team)) continue;
    possible.push({ kind: 'bot', bot: other, distance: bot.mesh.position.distanceTo(other.mesh.position) });
  }

  if (!possible.length) return null;
  possible.sort((a, b) => a.distance - b.distance);
  return possible[0];
}

function isEnemy(teamA, teamB) {
  if (state.mode === 'ffa') return teamA !== teamB;
  if (state.mode === 'tdm') return teamA !== teamB;
  return true;
}

function fireBullet(origin, direction, owner, ownerTeam) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: owner === 'player' ? 0x8bf8ff : 0xffb58b })
  );
  mesh.position.copy(origin);
  scene.add(mesh);

  bullets.push({
    owner,
    ownerTeam,
    mesh,
    velocity: direction.clone().normalize().multiplyScalar(82),
    ttl: 2,
  });
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);
    bullet.ttl -= dt;

    if (bullet.owner !== 'player' && player.hp > 0 && isEnemy(bullet.ownerTeam, player.team) && bullet.mesh.position.distanceTo(player.pos) < 1) {
      player.hp -= 15;
      state.health = Math.max(player.hp, 0);
      bullet.ttl = 0;
      if (player.hp <= 0) {
        player.hp = 0;
        state.deaths += 1;
        state.score = Math.max(0, state.score - 1);
        player.respawnTimer = 2;
        announce('Eliminated. Respawning...');
      }
    }

    for (const bot of bots) {
      if (bot.hp <= 0 || bot.respawnTimer > 0) continue;
      if (!isEnemy(bullet.ownerTeam, bot.team)) continue;
      if (bullet.mesh.position.distanceTo(bot.mesh.position) < 1.02) {
        bot.hp -= 42;
        bullet.ttl = 0;
        if (bot.hp <= 0) {
          onKill(bullet, bot);
          bot.hp = 0;
          bot.mesh.visible = false;
          bot.respawnTimer = 2.2;
        }
        break;
      }
    }

    if (bullet.ttl <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

function onKill(bullet, deadBot) {
  if (bullet.owner === 'player') {
    state.kills += 1;
    state.score += state.mode === 'tdm' ? 2 : 1;
  }

  if (state.mode === 'tdm') {
    if (bullet.ownerTeam === 'alpha') state.alphaPoints += 1;
    if (bullet.ownerTeam === 'omega') state.omegaPoints += 1;
  }

  if (state.mode !== 'tdm' && bullet.owner !== 'player') {
    // bots battle each other; kept for world activity in DM/FFA
  }

  if (deadBot.team === player.team && bullet.owner === 'player') {
    state.score = Math.max(0, state.score - 2);
  }
}

function updateUI() {
  ui.score.textContent = `Score: ${state.score} | HP: ${Math.max(0, Math.round(state.health))}`;
  ui.kills.textContent = `Kills: ${state.kills}`;
  ui.deaths.textContent = `Deaths: ${state.deaths}`;
  ui.teamScore.textContent = `Alpha ${state.alphaPoints} : ${state.omegaPoints} Omega`;
  ui.timer.textContent = `Time: ${formatTime(state.matchTime)}`;
}

function formatTime(seconds) {
  const total = Math.ceil(seconds);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function announce(message) {
  ui.status.textContent = message;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
