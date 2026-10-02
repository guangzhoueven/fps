// ============================================================================
// PLAYER — movement, damage, combat feedback
// ============================================================================
// ============================================================================
// PLAYER
// ============================================================================
const playerVel = new THREE.Vector3();
let onGround = true, crouching = false, eyeHeight = 1.6;
const baseEye=1.6, crouchEye=1.0, GRAVITY=-18, JUMP=7.5;
let noDamageTimer=0, killStreakCount=0, killStreakTimer=0, lastKillStreakAnnounced=0, bestStreak=0, waveStartTime=0;
let reviveGuard=0; // invincibility seconds after revive
let shakeMag=0;
// Scratch objects for the per-frame player loop (zero allocations in steady state)
const _pfwd = new THREE.Vector3(), _prgt = new THREE.Vector3(), _pmove = new THREE.Vector3();
const _pnew = new THREE.Vector3(), _ptmp = new THREE.Vector3();
const _pbb = new THREE.Box3(), _pbb2 = new THREE.Box3();
const _psize = new THREE.Vector3();
const _shakeOff = new THREE.Vector3(); // last frame's shake offset — removed before each move so shake never drifts the real position
function playerHits(bb, checkCeiling){
  for(let i=0;i<wallColliders.length;i++){ const c = wallColliders[i]; if(c && bb.intersectsBox(c)) return true; }
  if(checkCeiling){
    for(let i=0;i<roofSlabs.length;i++){ const s = roofSlabs[i]; if(s && bb.intersectsBox(s)) return true; }
  }
  return false;
}
function updatePlayer(dt){
  if(state.gameOver) return;
  dt = Math.min(dt, 0.05);
  camera.position.sub(_shakeOff); _shakeOff.set(0,0,0);
  if(reviveGuard > 0) reviveGuard = Math.max(0, reviveGuard - dt);
  const sprinting = keys['ShiftLeft'] && state.stamina>0 && !crouching && (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']);
  crouching = !!keys['KeyC']; // C — Ctrl collides with browser shortcuts (Ctrl+W closes the tab)
  state.sprinting = sprinting; state.crouching = crouching;
  const targetEye = crouching ? crouchEye : baseEye;
  eyeHeight += (targetEye - eyeHeight) * Math.min(1, dt*12);
  const speedBoost = hasPowerup('speed') ? 1.5 : 1;
  const baseSpeed = (crouching?2.2:sprinting?8:5) * speedBoost * moveSpeedMult;
  if(sprinting) state.stamina = Math.max(0, state.stamina - dt*25);
  else state.stamina = Math.min(state.maxStamina, state.stamina + dt*15);
  _pfwd.set(-Math.sin(yaw),0,-Math.cos(yaw));
  _prgt.set(Math.cos(yaw),0,-Math.sin(yaw));
  _pmove.set(0,0,0);
  if(keys['KeyW']) _pmove.add(_pfwd); if(keys['KeyS']) _pmove.sub(_pfwd);
  if(keys['KeyA']) _pmove.sub(_prgt); if(keys['KeyD']) _pmove.add(_prgt);
  if(_pmove.lengthSq()>0) _pmove.normalize();
  playerVel.x = _pmove.x * baseSpeed; playerVel.z = _pmove.z * baseSpeed;
  playerVel.y += GRAVITY * dt;
  if(onGround && keys['Space']){ playerVel.y = JUMP; onGround = false; }
  const pSize = crouching?0.2:0.25, pHeight = crouching?1.2:1.6;
  _psize.set(pSize*2, pHeight, pSize*2);
  const newPos = _pnew.copy(camera.position);
  newPos.x += playerVel.x * dt; newPos.z += playerVel.z * dt; newPos.y += playerVel.y * dt;
  if(playerVel.y > 0){
    _pbb.setFromCenterAndSize(newPos, _psize);
    for(let i=0;i<roofSlabs.length;i++){
      const s = roofSlabs[i];
      if(s && _pbb.intersectsBox(s)){ playerVel.y = 0; newPos.y = camera.position.y; break; }
    }
  }

  // Platform standing — check if player is above a platform (rock/container/wall/roof)
  let platformTop = 0;
  if(playerVel.y <= 0){ // only when falling
    for(const p of platforms){
      if(newPos.x >= p.box.min.x - 0.2 && newPos.x <= p.box.max.x + 0.2 &&
         newPos.z >= p.box.min.z - 0.2 && newPos.z <= p.box.max.z + 0.2){
        const topY = p.top + eyeHeight;
        // Player lands on platform if feet are at or below top, and within step-up reach above the platform
        if(newPos.y <= topY + 0.15 && newPos.y - eyeHeight >= p.top - (p.stepUp || 2.6)){
          platformTop = Math.max(platformTop, topY);
        }
      }
    }
  }
  // Ground or platform
  const groundY = Math.max(eyeHeight, platformTop);
  if(newPos.y < groundY){ newPos.y = groundY; playerVel.y = 0; onGround = true; }
  else if(platformTop === 0 && newPos.y < eyeHeight){ newPos.y = eyeHeight; playerVel.y = 0; onGround = true; }

  const rising = playerVel.y > 0;
  _pbb.setFromCenterAndSize(newPos, _psize);
  if(playerHits(_pbb, rising)){
    // Try X axis only
    _ptmp.set(camera.position.x+playerVel.x*dt, newPos.y, camera.position.z);
    _pbb2.setFromCenterAndSize(_ptmp, _psize);
    if(!playerHits(_pbb2, rising)){ camera.position.x = _ptmp.x; camera.position.y = newPos.y; }
    // Try Z axis only
    else {
      _ptmp.set(camera.position.x, newPos.y, camera.position.z+playerVel.z*dt);
      _pbb2.setFromCenterAndSize(_ptmp, _psize);
      if(!playerHits(_pbb2, rising)){ camera.position.z = _ptmp.z; camera.position.y = newPos.y; }
    }
  } else { camera.position.copy(newPos); }
  camera.rotation.y = yaw; camera.rotation.x = pitch;
  if(shakeMag > 0.001){
    _shakeOff.set((Math.random()-.5)*shakeMag, (Math.random()-.5)*shakeMag, (Math.random()-.5)*shakeMag);
    camera.position.add(_shakeOff);
    shakeMag *= 0.85;
  }
}
function takeDamage(amount, sourcePos){
  if(state.gameOver || reviveGuard > 0 || hasPowerup('shield')) return;
  noDamageTimer = 0;
  if(sourcePos) showDamageDirection(sourcePos);
  let remaining = amount;
  if(state.armor > 0){ const absorbed = Math.min(state.armor, amount*0.6); state.armor -= absorbed; remaining -= absorbed; }
  state.hp -= remaining; state.stats.damageTaken += amount;
  audio.hurt(); // No screen shake — player can stand on platforms safely
  if(state.hp <= 0){ state.hp = 0; triggerGameOver(); }
}

// Hit marker display
let hitmarkerTimeout = null;
function showHitmarker(headshot, kill){
  const hm = document.getElementById('hitmarker');
  if(!hm) return;
  if(hitmarkerTimeout){ clearTimeout(hitmarkerTimeout); hm.className = ''; void hm.offsetWidth; }
  hm.className = kill ? 'kill' : headshot ? 'hs' : 'hit';
  if(kill){ audio.headshot(); }
  else if(headshot){ audio.hitmarkerCrit(); }
  else { audio.hitmarker(); }
  hitmarkerTimeout = setTimeout(()=>{ hm.className = ''; }, 300);
}

function showKillBadge(text){
  const el = document.getElementById('kill-badge');
  if(!el) return;
  el.textContent = text;
  el.className = 'show';
  setTimeout(()=>{ el.className = ''; }, 900);
}

function showDamageDirection(fromPos){
  const el = document.getElementById('dmg-dir');
  if(!el) return;
  const dir = fromPos.clone().sub(camera.position);
  dir.y = 0; dir.normalize();
  // Convert world direction to screen angle
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  fwd.y = 0; fwd.normalize();
  const angle = Math.atan2(dir.x, dir.z) - Math.atan2(fwd.x, fwd.z);
  const deg = (angle * 180 / Math.PI + 360) % 360;
  el.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
  el.innerHTML = '<div class="dmg-arc"></div>';
  setTimeout(()=>{ el.innerHTML = ''; }, 600);
}

function triggerGameOver(){ state.gameOver = true; if(window.SaveGame) SaveGame.clearRun(); document.exitPointerLock(); showGameOver(); }
function revivePlayer(){
  if(!state.gameOver) return;
  state.gameOver = false;
  state.hp = state.maxHp;
  state.armor = state.maxArmor;
  reviveGuard = 5; // 5s invincibility — time to get away from the swarm
  document.getElementById('game-over').style.display = 'none';
  setPhase('playing');
  document.getElementById('hud').style.display = 'block';
  const mm = document.getElementById('minimap'); if(mm) mm.style.display = 'block';
  requestGameLock();
  if(window.SaveGame) SaveGame.autoSave();
  toast(I18n.t('toast.revived'), 'success');
}
function addShake(mag){ shakeMag = Math.max(shakeMag, mag); }
