// ============================================================================
// INPUT — keyboard / mouse handlers
// ============================================================================
// ============================================================================
// INPUT
// ============================================================================
const keys = {};
let mouseDown = false, lastLeftClick = 0;
addEventListener('keydown', e=>{
  if(phase !== 'playing' || uiOverlayOpen()) return;
  keys[e.code] = true;
  if(state.gameOver || !waveActive && state.wave === 0) return;
  if(/^Digit[1-9]$/.test(e.code)) selectSlot(parseInt(e.code.replace('Digit',''))-1);
  else if(e.code==='KeyR') doReload();
  else if(e.code==='KeyE') handleInteraction();
  else if(e.code==='KeyF') toggleFlashlight();
  else if(e.code==='KeyQ') cycleWeapon(-1);
  else if(e.code==='KeyG') throwGrenade();
  else if(e.code==='Tab'){ e.preventDefault(); toggleWeaponStatsPanel(); }
});
addEventListener('keyup', e=>{ keys[e.code] = false; });
addEventListener('mousedown', e=>{
  if(state.gameOver) return;
  if(document.pointerLockElement !== canvas){
    // Click while playing but unlocked (e.g. lock failed after resume) — re-lock with user gesture
    if(phase === 'playing' && !uiOverlayOpen()) requestGameLock();
    return;
  }
  if(e.button === 0){ mouseDown = true; dispatchLeftClick(); }
  else if(e.button === 2) adsActive = true;
});
addEventListener('mouseup', e=>{ if(e.button===0) mouseDown=false; if(e.button===2) adsActive = false; });
addEventListener('mousemove', e=>{
  if(document.pointerLockElement !== canvas) return;
  const sens = settings.sensitivity * 0.0022;
  yaw -= e.movementX * sens; pitch -= e.movementY * sens;
  pitch = Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, pitch));
  mouseDeltaX += e.movementX; mouseDeltaY += e.movementY;
});
addEventListener('wheel', e=>{ if(document.pointerLockElement!==canvas) return; e.preventDefault(); selectSlot(state.selectedSlot + (e.deltaY>0?1:-1)); }, {passive:false});
addEventListener('contextmenu', e=>e.preventDefault());
addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function toggleFlashlight(){ flashlight.intensity = flashlight.intensity > 0 ? 0 : 12; }
function cycleWeapon(dir){
  const weaponSlots = [];
  for(let i=0;i<state.inventory.length;i++){ const s=state.inventory[i]; if(s && WEAPONS[s.type]) weaponSlots.push(i); }
  if(weaponSlots.length === 0) return;
  const curIdx = weaponSlots.indexOf(state.selectedSlot);
  if(curIdx === -1){ // current slot is a grenade/medkit/flashlight — land on the nearest edge weapon slot
    selectSlot(dir > 0 ? weaponSlots[0] : weaponSlots[weaponSlots.length - 1]);
    return;
  }
  selectSlot(weaponSlots[(curIdx+dir+weaponSlots.length) % weaponSlots.length]);
}
function handleInteraction(){
  for(let i=pickups.length-1; i>=0; i--){
    const pk = pickups[i], mp = pk.mesh.position;
    if(Math.sqrt((camera.position.x-mp.x)**2 + (camera.position.z-mp.z)**2) < 2.2){
      handlePickup(pk); scene.remove(pk.mesh); pickups.splice(i,1); return;
    }
  }
  toggleDoorNearPlayer();
}
function handlePickup(pk){
  if(pk.type==='medkit'){ medkitCount++; rebuildInventory(); audio.pickup(); toast(I18n.t('toast.pickedMedkit'),'success'); return true; }
  if(pk.type==='ammo'){ const sel=state.inventory[state.selectedSlot]; const w=sel?WEAPONS[sel.type]:null; if(w&&weaponAmmo[w.id]){ weaponAmmo[w.id].reserve = Math.min(w.reserveMax, weaponAmmo[w.id].reserve + 30); audio.pickup(); toast(I18n.t('toast.pickupAmmo'),'success'); updateAmmoState(); return true; } weaponAmmo.pistol.reserve = Math.min(WEAPONS.pistol.reserveMax, weaponAmmo.pistol.reserve + 30); audio.pickup(); updateAmmoState(); return true; }
  if(pk.type==='grenade' || pk.type==='grenade_black'){ state.grenades += 1; rebuildInventory(); audio.pickup(); toast(I18n.t('toast.pickupGrenade'),'success'); return true; }
  if(pk.type==='armor'){ state.armor = Math.min(state.maxArmor, state.armor + 50); audio.pickup(); toast(I18n.t('toast.pickupArmor'),'success'); return true; }
  if(pk.type==='crate'){
    // Golden supply crate: 2 medkits + 30 ammo + 2 grenades
    medkitCount += 2;
    const sel = state.inventory[state.selectedSlot];
    const w = sel ? WEAPONS[sel.type] : null;
    if(w && weaponAmmo[w.id]) weaponAmmo[w.id].reserve = Math.min(w.reserveMax, weaponAmmo[w.id].reserve + 30);
    else weaponAmmo.pistol.reserve = Math.min(WEAPONS.pistol.reserveMax, weaponAmmo.pistol.reserve + 30);
    state.grenades += 2;
    rebuildInventory(); updateAmmoState();
    audio.pickup(); audio.buy();
    toast(I18n.t('toast.supplyCrate'),'success');
    return true;
  }
  if(pk.type==='powerup' && pk.powerupId){ activatePowerup(pk.powerupId, pk.powerupLabel, pk.powerupIcon, pk.powerupDuration); return true; }
  return false;
}
// Weapon Stats Panel
let wpStatsVisible = false;
function toggleWeaponStatsPanel(){
  wpStatsVisible = !wpStatsVisible;
  const panel = document.getElementById('wp-stats');
  const content = document.getElementById('wp-content');
  if(!panel || !content) return;
  if(wpStatsVisible){
    // Build stats for all owned weapons
    const owned = ['pistol','smg','shotgun','rifle','sniper','rocket','crossbow','minigun','tesla','flamer','ricochet'].filter(id => ownedWeapons.has(id));
    let html = '';
    for(const id of owned){
      const w = WEAPONS[id];
      const ammo = weaponAmmo[id] || {mag:0, reserve:0};
      const isSelected = state.inventory[state.selectedSlot]?.type === id;
      const selStyle = isSelected ? 'border-left:3px solid #f97316;padding-left:8px;' : 'padding-left:11px;';
      html += `<div style="margin-bottom:12px;opacity:${isSelected?1:0.75}">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;${selStyle}">`;
      html += `<span style="font-size:14px;color:#fff;font-weight:700">${w.icon} ${I18n.t('weapon.'+w.id)}</span>`;
      html += `<span style="font-size:11px;color:#fbbf24">${ammo.mag}/${ammo.reserve}</span></div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:5px;">`;
html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.damage')}</span><br><span style="color:#f87171;font-size:12px">${Math.round(w.damage * damageMult)}</span></div>`;
      html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.fireRate')}</span><br><span style="color:#a5b4fc;font-size:12px">${(1/w.fireRate).toFixed(1)}/s</span></div>`;
      html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.mag')}</span><br><span style="color:#86efac;font-size:12px">${w.magSize}</span></div>`;
      html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.range')}</span><br><span style="color:#67e8f9;font-size:12px">${w.range}m</span></div>`;
      html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.type')}</span><br><span style="color:#c4b5fd;font-size:12px">${w.auto?I18n.t('ammo.fullAuto'):I18n.t('ammo.semiAuto')}</span></div>`;
      const effReload = w.reloadTime / (1 + (reloadSpeedMult - 1) * 0.5);
      html += `<div><span style="color:rgba(255,255,255,.4);font-size:10px">${I18n.t('weaponStats.reload')}</span><br><span style="color:#fcd34d;font-size:12px">${effReload.toFixed(2)}s</span></div>`;
      html += `</div></div>`;
    }
    content.innerHTML = html;
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function dispatchLeftClick(){
  if(state.gameOver) return;
  const now = performance.now(); if(now - lastLeftClick < 60) return; lastLeftClick = now;
  const sel = state.inventory[state.selectedSlot];
  // Empty slot (null or type===''): open/close nearest door within 3.0m
  if(!sel || sel.type === '' || !sel.type){ toggleDoorNearPlayer(3.0); return; }
  if(WEAPONS[sel.type]) fireWeapon();
  else if(sel.type==='grenade') throwGrenade();
  else if(sel.type==='medkit') useMedkit();
  else if(sel.type==='flashlight') toggleFlashlight();
}
