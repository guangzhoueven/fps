// ============================================================================
// MAIN — game loop, start, i18n glue
// ============================================================================
// MAIN LOOP
// ============================================================================
let phase = 'menu';
let grenadesArr = []; // alias
let _lastHudT = 0, _lastMmT = 0;

function setPhase(p){
  phase = p;
  document.body.classList.toggle('phase-menu', p === 'menu');
  document.body.classList.toggle('phase-playing', p === 'playing');
  document.body.classList.toggle('phase-paused', p === 'paused');
}
function uiOverlayOpen(){
  if(state.gameOver || state.inShop) return true;
  const perks = document.getElementById('perks');
  const shop = document.getElementById('shop');
  return (perks && perks.style.display === 'flex') || (shop && shop.style.display === 'flex');
}
let _wasLocked = false, _lockRetry = 0;
function requestGameLock(){
  if(phase !== 'playing') return;
  if(document.pointerLockElement === canvas){ _lockRetry = 0; return; }
  const onFail = ()=>{
    if(phase !== 'playing') return;
    if(++_lockRetry <= 10) setTimeout(requestGameLock, 400);
  };
  let p = null;
  try{ p = canvas.requestPointerLock(); }catch(e){ onFail(); return; }
  if(p && typeof p.then === 'function') p.then(()=>{ _lockRetry = 0; }).catch(onFail);
}
function pauseGame(){
  if(phase !== 'playing') return;
  setPhase('paused');
  mouseDown = false; adsActive = false;
  for(const k in keys) keys[k] = false;
  if(document.pointerLockElement === canvas) document.exitPointerLock();
  document.getElementById('pause-menu').style.display = 'flex';
  if(window.SaveGame) SaveGame.autoSave();
}
function resumeGame(){
  if(phase !== 'paused') return;
  audio.resume();
  // Resume immediately — don't gate gameplay on pointer lock succeeding
  setPhase('playing');
  document.getElementById('pause-menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  const mm = document.getElementById('minimap'); if(mm) mm.style.display = 'block';
  _lockRetry = 0;
  requestGameLock();
}
// Esc: pause/resume directly — don't rely only on pointerlockchange.
// Debounced so one Esc press isn't handled twice (keydown + lock-exit event).
let _escHandledAt = -1e9;
function _markEsc(){ _escHandledAt = performance.now(); }
addEventListener('keydown', e=>{
  if(e.code !== 'Escape') return;
  const now = performance.now();
  if(now - _escHandledAt < 450) return;
  if(phase === 'playing' && !uiOverlayOpen()){ _markEsc(); pauseGame(); }
  else if(phase === 'paused'){
    _markEsc();
    if(window.SaveGame && SaveGame.confirmOpen()){ SaveGame.closeConfirm(); return; }
    resumeGame();
  }
});

// Dynamic sky — dramatic day/dusk/night cycle (reuses one Color object per frame)
let skyDayPhase = Math.PI * 0.3;
const _skyColor = new THREE.Color();
function updateDynamicSky(dt){
  // Menu keeps the sky locked to the initial daytime look (start page always looks
  // the same); pause freezes it in place; only play advances the day cycle.
  if(phase === 'menu') skyDayPhase = Math.PI * 0.3;
  else if(phase !== 'paused') skyDayPhase += dt * 0.012;
  const t = skyDayPhase;
  const cycle = Math.sin(t);
  const r = 0.15 + Math.max(0, cycle) * 0.55 + 0.2;
  const g = 0.1 + Math.max(0, cycle*0.35) + 0.15;
  const b = 0.05 + Math.max(0, cycle) * 0.7 + 0.05;
  const skyColor = _skyColor.setRGB(r, g, b);
  scene.background = skyColor;
  scene.fog.color.copy(skyColor);
  scene.fog.density = 0.0005 + Math.max(0, cycle) * 0.0013;
  const brightness = Math.max(0.15, 2.5 + cycle * 2.3);
  sunLight.intensity = brightness;
  sunLight.color.setRGB(1.0, 0.85 + cycle*0.1, 0.4 + Math.max(0, -cycle)*0.6);
  ambientLight.intensity = Math.max(0.2, 1.8 + cycle * 1.5);
  ambientLight.color.copy(skyColor).multiplyScalar(0.7);
  hemiLight.intensity = Math.max(0.15, 1.2 + cycle * 1.0);
  hemiLight.color.copy(skyColor);
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  updateDynamicSky(dt);
  if(phase === 'playing' && !state.gameOver){
    // Overlay (shop/perks) open: freeze input so WASD/reload/grenade don't fire behind it
    if(uiOverlayOpen()){ for(const k in keys) keys[k] = false; mouseDown = false; adsActive = false; }
    gameTime += dt;
    if(waveCountdown > 0){
      waveCountdown -= dt; state.waveCountdown = Math.max(0, waveCountdown);
      showWaveAnnouncement();
      // Game tips during countdown
      const tipEl = document.getElementById('tip-text');
      tipDisplayTime += dt;
      if(tipDisplayTime >= 4){
        tipDisplayTime = 0;
        currentTipIndex = (currentTipIndex + 1) % getGameTips().length;
      }
      if(tipEl){
        tipEl.style.display = 'block';
        tipEl.textContent = '\uD83D\uDCA1 ' + (getGameTips()[currentTipIndex] || '');
      }
      if(waveCountdown <= 0){ hideWaveAnnouncement(); startNextWave(); }
    } else { hideWaveAnnouncement(); tipDisplayTime = 0; currentTipIndex = 0; const tipEl = document.getElementById('tip-text'); if(tipEl) tipEl.style.display = 'none'; }
    // Footstep audio
    const isMoving = (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']) && onGround;
    const footstepInterval = state.sprinting ? 0.22 : 0.35;
    if(isMoving){
      const now = performance.now() / 1000;
      if(now - lastFootstepTime > footstepInterval){
        audio.footstep(state.sprinting);
        lastFootstepTime = now;
      }
    }
    updatePlayer(dt);
    // ADS FOV lerp
    const sel = state.inventory[state.selectedSlot];
    const zoomW = WEAPONS[sel?.type]?.zoom || settings.fov || BASE_FOV;
    const targetFOV = adsActive ? zoomW : (settings.fov || BASE_FOV);
    currentFOV += (targetFOV - currentFOV) * Math.min(1, dt * 10);
    camera.fov = currentFOV;
    camera.updateProjectionMatrix();
    fireCooldown = Math.max(0, fireCooldown - dt);
    if(mouseDown){ if(sel && WEAPONS[sel.type]?.auto) fireWeapon(); }
    for(const en of enemies) en.update(dt, enemies);
    updateGrenades(dt); updateProjectiles(dt); updateParticles(dt); updateScorePopups(dt);
    processSpawns();
    updatePickups(time); updateDoors(dt); updateWeaponAnim(dt);
    updateComboAndRegen(dt); // handles combo/streak decay, noDamageTimer and regen (duplicated block removed — it made these tick 2x fast)
    updatePowerups(dt); updateSupplyDrops(dt); updateDust(dt);
    updateObjective();
    if(bossRef && bossRef.alive) state.bossHp = bossRef.hp;
    _hudFrame++;
    // Time-based throttles — frame-modulo gets more expensive on high-Hz displays
    if(time - _lastHudT >= 0.05){ _lastHudT = time; updateHUD(); updateCrosshairStyle(); } // ~20Hz
    if(time - _lastMmT >= 0.066){ _lastMmT = time; drawMinimap(); } // ~15Hz
  } else if(phase === 'menu'){
    updateCrosshairStyle();
    yaw += dt * 0.15;
    camera.position.x = Math.sin(time*0.2)*8; camera.position.z = Math.cos(time*0.2)*8;
    camera.position.y = 2 + Math.sin(time*0.3)*0.3;
    camera.rotation.y = yaw; camera.rotation.x = -0.1;
    updatePickups(time); updateDoors(dt); updateDust(dt);
  } else {
    updatePickups(time); updateDoors(dt); updateWeaponAnim(dt); updateScorePopups(dt); updateDust(dt);
  }
  renderer.render(scene, camera);
}

// ============================================================================
// START
// ============================================================================
document.getElementById('blocker').addEventListener('click', ()=> startGame(false));
const _continueBtn = document.getElementById('btn-continue');
if(_continueBtn) _continueBtn.addEventListener('click', e=>{ e.stopPropagation(); startGame(true); });
const _newGameBtn = document.getElementById('btn-new-game');
if(_newGameBtn) _newGameBtn.addEventListener('click', e=>{ e.stopPropagation(); startGame(false); });

function startGame(resume){
  audio.init(); audio.resume();
  // Apply persisted settings — they are saved/imported even though there is no settings UI
  if(audio.master && typeof settings.volume === 'number') audio.master.gain.value = settings.volume;
  if(renderer && renderer.shadowMap && !!renderer.shadowMap.enabled !== !!settings.shadows){
    renderer.shadowMap.enabled = !!settings.shadows;
    scene.traverse(o=>{ if(o.material){ const mats = Array.isArray(o.material) ? o.material : [o.material]; for(const m of mats) m.needsUpdate = true; } });
  }
  if(phase === 'menu' || state.gameOver){
    // New game after a soft-clear → this is when the data is really deleted
    if(!resume && window.SaveGame) SaveGame.purge();
    // Reset game
    state.hp=100; state.maxHp=100; state.armor=0; state.maxArmor=100; state.score=0; state.credits=0;
    state.wave=0; state.enemiesAlive=0; state.enemiesTotal=0; state.gameOver=false;
    state.grenades=3; state.stamina=100; state.combo=0; state.comboTimer=0;
    state.stats={kills:0,headshots:0,shotsFired:0,shotsHit:0,damageDealt:0,damageTaken:0,wavesSurvived:0,bestCombo:0};
    state.powerups=[]; state.activePerks=[];
    ownedWeapons = new Set(['pistol']);
    weaponAmmo = {pistol:{mag:12,reserve:96}};
    medkitCount = 0;
    damageMult=1; moveSpeedMult=1; reloadSpeedMult=1; shopDiscount=0; regenBoost=0; comboBoost=0; luckBoost=0;
    // Resume from save — override the fresh defaults with the saved run
    const run = (resume && window.SaveGame) ? SaveGame.getRun() : null;
    if(run){
      if(run.maxHp) state.maxHp = run.maxHp;
      if(typeof run.hp === 'number') state.hp = Math.min(run.hp, state.maxHp);
      if(run.maxArmor) state.maxArmor = run.maxArmor;
      if(typeof run.armor === 'number') state.armor = Math.min(run.armor, state.maxArmor);
      if(typeof run.score === 'number') state.score = run.score;
      if(typeof run.credits === 'number') state.credits = run.credits;
      if(typeof run.grenades === 'number') state.grenades = run.grenades;
      if(run.stats) state.stats = Object.assign({}, state.stats, run.stats);
      if(Array.isArray(run.activePerks)) state.activePerks = run.activePerks;
      if(run.ownedWeapons && run.ownedWeapons.length) ownedWeapons = new Set(run.ownedWeapons);
      if(run.weaponAmmo) weaponAmmo = run.weaponAmmo;
      if(typeof run.medkitCount === 'number') medkitCount = run.medkitCount;
      if(typeof run.selectedSlot === 'number') state.selectedSlot = run.selectedSlot;
      if(typeof run.damageMult === 'number') damageMult = run.damageMult;
      if(typeof run.moveSpeedMult === 'number') moveSpeedMult = run.moveSpeedMult;
      if(typeof run.reloadSpeedMult === 'number') reloadSpeedMult = run.reloadSpeedMult;
      if(typeof run.shopDiscount === 'number') shopDiscount = run.shopDiscount;
      if(typeof run.regenBoost === 'number') regenBoost = run.regenBoost;
      if(typeof run.comboBoost === 'number') comboBoost = run.comboBoost;
      if(typeof run.luckBoost === 'number') luckBoost = run.luckBoost;
      if(run.resumeWave) state.wave = Math.max(0, run.resumeWave - 1);
      toast(I18n.tf('toast.runResumed', run.resumeWave || 1), 'success');
    }
    // Reset doors
    for(const door of doors){
      // Random initial open/closed state
      const startOpen = Math.random() < 0.4; // 40% start open
      door.isOpen = startOpen;
      door.targetAngle = startOpen ? Math.PI/2 : 0;
      door.openAngle = door.targetAngle;
      door.group.rotation.y = door.targetAngle;
      syncDoorCollision(door);
    }
    // Clear entities (pooled meshes go back to their pools — hiding, not removing,
    // otherwise acquirePooledMesh can never hand them out again)
    for(const e of enemies){ scene.remove(e.mesh); e._disposeResources(); } enemies = [];
    for(const g of grenades){ scene.remove(g.mesh); if(g.trail){ scene.remove(g.trail); g.trail.geometry.dispose(); g.trail.material.dispose(); } } grenades = [];
    for(const p of pickups) scene.remove(p.mesh); pickups = [];
    for(const p of particles){ if(p.fromPool) p.mesh.visible=false; else scene.remove(p.mesh); } particles = [];
    for(const t of tracers){ if(t.fromPool) t.mesh.visible=false; else scene.remove(t.mesh); } tracers = [];
    for(const ex of explosions) scene.remove(ex.mesh); explosions = [];
    for(const sp of scorePopups){ scene.remove(sp.mesh); if(sp.pooled){ sp.mesh.visible=false; _textSpritePool.push(sp.mesh); } } scorePopups = [];
    for(const pr of projectiles){ if(pr.fromPool) pr.mesh.visible=false; else scene.remove(pr.mesh); } projectiles = [];
    bossRef = null;
    camera.position.set(0, 1.6, 0); yaw = 0; pitch = 0;
    rebuildInventory();
    // Re-spawn initial pickups
    const rp2 = [...ROOMS].filter(r=>r.id!==4);
    rp2.sort(()=>Math.random()-0.5);
    rp2.slice(0,3).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'medkit'));
    rp2.slice(3,5).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'ammo'));
    rp2.slice(5,7).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'grenade_black'));
    const crateRoom2 = rp2[7] || rp2[0];
    spawnSupplyCrate(crateRoom2.x, crateRoom2.z);
    setPhase('playing');
    document.getElementById('blocker').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    const mm = document.getElementById('minimap'); if(mm) mm.style.display = 'block';
    requestGameLock();
    startWaveCountdown(3);
  }
}

document.getElementById('pm-resume').addEventListener('click', resumeGame);

addEventListener('pointerlockchange', ()=>{
  const locked = document.pointerLockElement === canvas;
  if(locked){
    _wasLocked = true; _lockRetry = 0;
    if(phase === 'menu' || phase === 'paused') setPhase('playing');
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('blocker').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    const mm2 = document.getElementById('minimap'); if(mm2) mm2.style.display = 'block';
  } else {
    const hadLock = _wasLocked;
    _wasLocked = false;
    // Esc / alt-tab after an actual lock — pause
    if(phase === 'playing' && !uiOverlayOpen()){
      if(hadLock){ _markEsc(); pauseGame(); }
      else requestGameLock(); // stray unlock while lock request pending — keep retrying
    }
  }
});

addEventListener('pointerlockerror', ()=>{
  if(phase === 'playing' && !_wasLocked){
    if(++_lockRetry <= 10) setTimeout(requestGameLock, 400);
  }
});

// Window blur: pause if lock was lost, or if lock never engaged after resume
addEventListener('blur', ()=>{
  if(phase === 'playing' && document.pointerLockElement !== canvas && !uiOverlayOpen()) pauseGame();
});

// ============================================================================
// LANGUAGE SWITCH HANDLER
// ============================================================================
window.addEventListener('langchange', function() {
  invalidateHudCache();
  updateHUD();
  if(state.inShop) showShop();
  if(document.getElementById('perks') && document.getElementById('perks').style.display === 'flex') showPerkSelection();
  if(state.waveCountdown > 0) showWaveAnnouncement();
  if(wpStatsVisible){ wpStatsVisible = false; toggleWeaponStatsPanel(); } // force re-render in the new language (a plain toggle would hide it)
});

// ============================================================================
// I18N — Initialize & update HTML data-i18n elements
// ============================================================================
async function initI18n() {
  await I18n.init();
  updateAllI18nElements();
  updateLangButtons();
  if(window.SaveGame) SaveGame.refreshContinueBtn();
  if(window.SaveGame) SaveGame.showClearedToast();
  // Update game title
  document.title = I18n.t('title');
}

function updateAllI18nElements() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = I18n.t(key);
    if (text && text !== key) {
      if (el.tagName === 'INPUT' && el.type !== 'submit') {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    }
  });
}

function updateLangButtons() {
  const lang = I18n.getLang();
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

// Update language switcher buttons on lang change
window.addEventListener('langchange', function() {
  updateAllI18nElements();
  updateLangButtons();
  document.title = I18n.t('title');
});

// Start
initI18n().then(() => {
  generateRoomLayout();
  buildScene();
  buildNavGrids();
  spawnGroundDecorations();
  rebuildInventory();
  animate();
});
