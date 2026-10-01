// ============================================================================
// WAVES — wave flow, objectives, regen, supply drops
// ============================================================================
// ============================================================================
// WAVES
// ============================================================================
let waveCountdown=0, waveActive=false, supplyDropTimer=35;
let spawnQueue=[]; // pending spawns {at,x,z,kind} — drained each frame, pauses while dead
let currentObjective=null, waveStartHp=100, waveStartHeadshots=0, waveStartKills=0, waveGrenadeKill=false, waveBarrelKill=false;
let excludedObjectives=[];

function startWaveCountdown(sec){ waveCountdown=sec; state.waveCountdown=sec; waveActive=false; audio.waveStart(); }
function startNextWave(){
  state.wave++;
  waveStartTime = clock.elapsedTime; // Track wave start for untouchable achievement
  state.waveHeadshots = 0; state.waveBarrelKills = 0; // Reset wave stats
  const isBoss = state.wave % 5 === 0;
  const diffCfg = DIFFICULTIES[difficulty];
  const baseCount = isBoss ? Math.floor((6+Math.floor(state.wave/5)*2)*1.8) : Math.floor((8+state.wave*3)*1.8);
  const count = Math.round(baseCount * diffCfg.spawnCountMult);
  // Clear any leftover enemies from previous wave
  for(const e of enemies) if(e.mesh.parent) scene.remove(e.mesh);
  enemies = [];
  for(const p of projectiles) scene.remove(p.mesh);
  projectiles = [];
  state.enemiesTotal = count + (isBoss?1:0);
  state.enemiesAlive = 0;
  waveActive = true; waveCountdown = 0; state.waveCountdown = 0;
  assignObjective();
  if(isBoss){ audio.bossSpawn(); spawnBoss(); showBossIntro(); toast(I18n.tf('toast.bossWave', state.wave), 'danger'); }
  else toast(I18n.tf('toast.waveIncoming', state.wave), 'warn');
  // Queue spawns — processed every frame by processSpawns() so the displayed
  // total always equals the number actually spawned (pauses while dead, resumes on revive)
  spawnQueue = [];
  for(let i=0;i<count;i++){
    let sx, sz;
    // 75% spawn in open outdoor areas, 25% near rooms
    if(Math.random() < 0.25){
      const spawnRoom = ROOMS[Math.floor(Math.random()*ROOMS.length)];
      const angle=Math.random()*Math.PI*2, radius=2+Math.random()*3;
      sx = spawnRoom.x + radius*Math.cos(angle);
      sz = spawnRoom.z + radius*Math.sin(angle);
    } else {
      const angle=Math.random()*Math.PI*2, radius=8+Math.random()*28;
      sx = radius*Math.cos(angle);
      sz = radius*Math.sin(angle);
    }
    // Wave-gated roster: each kind keeps its share of the roll at every wave
    // where it is unlocked (skipped kinds no longer inflate the ones below them)
    let kind='grunt'; const r=Math.random();
    const bands = [];
    if(state.wave>=7) bands.push(['tank',0.10]);
    if(state.wave>=6) bands.push(['shooter',0.08]);
    if(state.wave>=4) bands.push(['brute',0.12]);
    if(state.wave>=2) bands.push(['phantom',0.15]);
    if(state.wave>=3) bands.push(['runner',0.10]);
    if(state.wave>=6) bands.push(['bomber',0.07]);   // suicide rusher, chain detonates
    if(state.wave>=5) bands.push(['healer',0.06]);   // heals the pack, kite it down
    if(state.wave>=4) bands.push(['splitter',0.09]); // bursts into swarmlings
    if(state.wave>=3) bands.push(['jumper',0.08]);   // leaps at you in bursts
    let roll=0;
    for(const [k,p] of bands){ roll+=p; if(r<roll){ kind=k; break; } }
    spawnQueue.push({ at: clock.elapsedTime + i*0.25, sx, sz, kind });
  }
}
// Drain due spawns — called from the animate loop while playing
function processSpawns(){
  if(state.gameOver) return; // wait out death — remaining spawns resume after revive
  while(spawnQueue.length && spawnQueue[0].at <= clock.elapsedTime){
    const s = spawnQueue.shift();
    const e = new Enemy(s.sx, s.sz, s.kind, state.wave);
    enemies.push(e);
    // If enemy spawned inside a wall, reposition
    let attempts2 = 0;
    while(attempts2 < 5){
      const eBB = new THREE.Box3(new THREE.Vector3(e.mesh.position.x-e.size, 0, e.mesh.position.z-e.size), new THREE.Vector3(e.mesh.position.x+e.size, 1.5, e.mesh.position.z+e.size));
      let stuck = false;
      for(const col of wallColliders){ if(col && eBB.intersectsBox(col)){ stuck = true; break; } }
      if(!stuck) break;
      const a2 = Math.random()*Math.PI*2, r2 = 2+Math.random()*3;
      e.mesh.position.x = s.sx + r2*Math.cos(a2);
      e.mesh.position.z = s.sz + r2*Math.sin(a2);
      attempts2++;
    }
    state.enemiesAlive++;
  }
}
function spawnBoss(){
  const boss = new Enemy(0, 14, 'boss', state.wave);
  enemies.push(boss); bossRef = boss;
  state.enemiesAlive++;
  state.bossActive = true; state.bossHp = boss.hp; state.bossMaxHp = boss.maxHp; state.bossName = boss.def.name;
  addShake(1.5);
}
function completeWave(){
  waveActive = false;
  state.stats.wavesSurvived = state.wave;
  state.credits += 100 + state.wave * 25;
  audio.waveComplete();
  toast(I18n.tf('toast.waveCleared', state.wave, 100+state.wave*25), 'success');
  // Achievement checks at wave completion
  if(state.waveHeadshots >= 10) unlockAchievement('headhunter');
  if(state.waveBarrelKills >= 5) unlockAchievement('demo_expert');
  // Check untouchable: no damage this wave
  const waveDuration = clock.elapsedTime - waveStartTime;
  if(noDamageTimer >= waveDuration) unlockAchievement('untouchable');
  // Check weapons collector achievement
  const allWeaponIds = ['pistol','smg','shotgun','rifle','sniper','rocket','crossbow','minigun','tesla','flamer','ricochet'];
  if(allWeaponIds.every(id => ownedWeapons.has(id))) unlockAchievement('collector');
  // Reset wave tracking
  state.waveHeadshots = 0; state.waveBarrelKills = 0; waveStartTime = clock.elapsedTime;
  // Clean up dead enemies from array
  enemies = enemies.filter(e => e.alive);
  // Remove leftover enemy meshes (safety)
  for(const e of enemies){ if(!e.alive && e.mesh.parent) scene.remove(e.mesh); }
  enemies = enemies.filter(e => e.alive);
  // Clear projectiles
  for(const p of projectiles) scene.remove(p.mesh);
  projectiles = [];
  evaluateObjective();
  if(window.SaveGame) SaveGame.autoSave();
  setTimeout(()=>{
    // Show perks even if player died on the winning frame; only skip if truly not in a valid game
    if(state.gameOver) showShop();
    else showPerkSelection();
  }, 1500);
}

// Objectives
function assignObjective(){
  const avail = OBJECTIVES.filter(o=>!excludedObjectives.includes(o.id));
  const pool = avail.length > 0 ? avail : OBJECTIVES;
  const def = pool[Math.floor(Math.random()*pool.length)];
  currentObjective = {def, progress:0, goal:def.goal, completed:false, failed:false};
  waveStartHp = state.hp; waveStartHeadshots = state.stats.headshots; waveStartKills = state.stats.kills;
  waveGrenadeKill = false; waveBarrelKill = false;
  toast(I18n.tf('toast.objectiveAssign', I18n.t('objective.'+def.id), def.reward), 'info');
}
function updateObjective(){
  if(!currentObjective || currentObjective.completed) return;
  const o = currentObjective, s = state.stats;
  switch(o.def.id){
    case 'headshots': o.progress = s.headshots - waveStartHeadshots; break;
    case 'kills': o.progress = s.kills - waveStartKills; break;
    case 'combo_5': if(state.combo >= 5) o.progress = 5; break;
    case 'grenade_kill': o.progress = waveGrenadeKill ? 1 : 0; break;
    case 'barrel_kill': o.progress = waveBarrelKill ? 1 : 0; break;
    case 'no_damage': o.progress = 0; break;
  }
  if(o.progress >= o.goal && !o.completed) o.completed = true;
  state.objective = {...o};
}
function evaluateObjective(){
  if(!currentObjective) return;
  const o = currentObjective;
  let completed = o.completed;
  if(o.def.id === 'no_damage') completed = state.hp >= waveStartHp;
  if(completed){
    state.credits += o.def.reward;
    toast(I18n.tf('toast.objectiveComplete', o.def.reward), 'success'); audio.buy();
    excludedObjectives = [o.def.id, ...excludedObjectives].slice(-3);
  } else {
    toast(I18n.tf('toast.objectiveFailed', I18n.t('objective.'+o.def.id)), 'warn');
    excludedObjectives = excludedObjectives.filter(id=>id!==o.def.id);
  }
  o.completed = completed; o.failed = !completed;
  state.objective = {...o};
  currentObjective = null;
}

function updateComboAndRegen(dt){
  if(state.comboTimer > 0){ state.comboTimer -= dt; if(state.comboTimer <= 0){ state.combo = 0; state.comboTimer = 0; } }
  if(killStreakTimer > 0){ killStreakTimer -= dt; if(killStreakTimer <= 0){ killStreakCount = 0; lastKillStreakAnnounced = 0; killStreakTimer = 0; } }
  noDamageTimer += dt;
  const regenThreshold = 5 / (1 + regenBoost);
  const regenRate = 6 * (1 + regenBoost);
  if(noDamageTimer > regenThreshold && state.hp < state.maxHp && !state.gameOver) state.hp = Math.min(state.maxHp, state.hp + dt * regenRate);
}
function updateSupplyDrops(dt){
  supplyDropTimer -= dt;
  if(supplyDropTimer <= 0){
    supplyDropTimer = 35;
    const rm = ROOMS[Math.floor(Math.random()*ROOMS.length)];
    const dx = rm.x+(Math.random()-.5)*3;
    const dz = rm.z+(Math.random()-.5)*3;
    spawnSupplyCrate(dx, dz);
    toast(I18n.t('toast.supplyDropped'),'info');
  }
}
