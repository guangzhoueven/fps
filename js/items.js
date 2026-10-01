// ============================================================================
// ITEMS — medkit, grenades, barrels, powerups, projectiles
// ============================================================================
// ============================================================================
// MEDKIT / GRENADE
// ============================================================================
function useMedkit(){
  const slot = state.inventory[state.selectedSlot];
  if(!slot || slot.type !== 'medkit') return;
  if(medkitCount <= 0){ audio.error(); toast(I18n.t('toast.noMedkits'),'warn'); return; }
  if(state.hp >= state.maxHp){ audio.error(); toast(I18n.t('toast.hpFull'),'warn'); return; }
  state.hp = Math.min(state.maxHp, state.hp + 50);
  medkitCount--; slot.count = medkitCount;
  audio.pickup(); toast(I18n.t('toast.healHp'),'success');
}
function throwGrenade(){
  if(state.grenades <= 0){ audio.error(); return; }
  state.grenades--;
  rebuildInventory();
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  dir.y = 0.25; dir.normalize();
  // Bigger, brighter grenade with trail
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22,10,10),
    new THREE.MeshStandardMaterial({color:0x335522,emissive:0x44cc22,emissiveIntensity:.5,roughness:.5})
  );
  // Red pulsing ring around grenade
  const ringGeo = new THREE.TorusGeometry(0.28, 0.04, 6, 12);
  const ringMat = new THREE.MeshBasicMaterial({color:0xff4400, transparent:true, opacity:.7, blending:THREE.AdditiveBlending});
  const ring = new THREE.Mesh(ringGeo, ringMat);
  mesh.add(ring);
  mesh.position.copy(camera.position);
  // Slight offset from camera
  const offset = new THREE.Vector3(0.3, -0.1, -0.6).applyQuaternion(camera.quaternion);
  mesh.position.add(offset);
  scene.add(mesh);
  // Trail: preallocated position buffer updated as a ring in updateGrenades
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40*3), 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({color:0xff6622, transparent:true, opacity:.6, blending:THREE.AdditiveBlending, depthWrite:false}));
  scene.add(trailLine);
  grenades.push({mesh, vel:dir.multiplyScalar(12), life:3.0, detonated:false, _pos:mesh.position.clone(), hasTrail:true, trail:trailLine, trailCount:0, ring:ring});
  audio.tone(300, 0.2, 'sine', 0.05, 150);
}
function detonateGrenade(g){
  g.detonated = true; scene.remove(g.mesh);
  if(g.trail){ scene.remove(g.trail); g.trail.geometry.dispose(); g.trail.material.dispose(); g.trail = null; }
  if(g.ring){ if(g.ring.geometry) g.ring.geometry.dispose(); if(g.ring.material) g.ring.material.dispose(); g.ring = null; }
  const idx = grenades.indexOf(g); if(idx>=0) grenades.splice(idx,1);
  // Bolt impact: deal damage at impact point
  if(g.isBolt){
    const pos = g.mesh ? g.mesh.position.clone() : (g._pos || camera.position.clone());
    for(const en of enemies){
      if(en.alive && pos.distanceTo(en.mesh.position) < 1.5){
        let dmg = 85 * damageMult; if(hasPowerup('damage')) dmg *= 2;
        en.takeDamage(dmg, false);
        state.stats.shotsHit++; state.stats.damageDealt += dmg;
        spawnSpark(pos, 0xff4400, 0.15);
        break;
      }
    }
    spawnSpark(pos, 0xffcc66, 0.1);
    spawnDecal(pos, new THREE.Vector3(0,1,0));
    return;
  }
  const pos = g._pos || camera.position.clone();
  // Big explosion sphere — low-poly for performance
  const expMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.0,8,8),
    new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:.9,blending:THREE.AdditiveBlending})
  );
  expMesh.position.copy(pos); scene.add(expMesh);
  explosions.push({mesh:expMesh, time:0, maxTime:.6});
  // Inner bright core
  const coreMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.0,6,6),
    new THREE.MeshBasicMaterial({color:0xffffaa,transparent:true,opacity:1,blending:THREE.AdditiveBlending})
  );
  coreMesh.position.copy(pos); scene.add(coreMesh);
  explosions.push({mesh:coreMesh, time:0, maxTime:.3});
  // Flash light
  const flashLight = new THREE.PointLight(0xff8800, 15, 20, 1.5);
  flashLight.position.copy(pos); scene.add(flashLight);
  setTimeout(()=>{ if(flashLight.parent) scene.remove(flashLight); }, 300);
  // Damage enemies
  for(const en of enemies){
    if(en.alive && pos.distanceTo(en.mesh.position) < 5.5){
      let dmg = 100; if(hasPowerup('damage')) dmg *= 2;
      const wasAlive = en.alive; en.takeDamage(dmg, false);
      if(wasAlive && !en.alive) waveGrenadeKill = true;
    }
  }
  if(pos.distanceTo(camera.position) < 4.5) takeDamage(35, pos);
  audio.explosion(); addShake(0.8);
  // Lots of sparks for visual impact
  for(let i=0;i<15;i++) spawnSpark(pos.clone(), i%3===0?0xffff00:i%3===1?0xff6600:0xff3300, 0.15+Math.random()*0.15);
}
function detonateBarrel(b){
  if(b.exploded) return; b.exploded = true; scene.remove(b.mesh);
  // Remove its collision + free the nav cells it occupied
  if(b.collider){ const ci = wallColliders.indexOf(b.collider); if(ci >= 0) wallColliders.splice(ci, 1); navUnblockBox(b.collider); }
  const wi = wallMeshes.indexOf(b.mesh); if(wi >= 0) wallMeshes.splice(wi, 1);
  const pos = b.pos.clone();
  const expMesh = new THREE.Mesh(new THREE.SphereGeometry(2.0,16,16), new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));
  expMesh.position.copy(pos); scene.add(expMesh);
  explosions.push({mesh:expMesh, time:0, maxTime:.6});
  const radius = 4.5;
  for(const en of enemies){
    if(en.alive && pos.distanceTo(en.mesh.position) < radius){
      const wasAlive = en.alive;
      en.takeDamage(120 * damageMult, false);
      if(wasAlive && !en.alive) { waveBarrelKill = true; state.waveBarrelKills++; }
    }
  }
  for(const other of explosiveBarrels){
    if(!other.exploded && pos.distanceTo(other.pos) < radius){
      setTimeout(()=>detonateBarrel(other), 80);
    }
  }
  if(pos.distanceTo(camera.position) < 3.5) takeDamage(30, pos);
  audio.explosion(); addShake(0.6);
  for(let i=0;i<15;i++) spawnSpark(pos.clone(), i%2?0xff4400:0xffaa00, 0.1+Math.random()*0.1);
}

// ============================================================================
// POWERUPS
// ============================================================================
let activePowerups = [];
function hasPowerup(id){ return activePowerups.some(p=>p.id===id); }
function activatePowerup(id, label, icon, duration){
  const existing = activePowerups.find(p=>p.id===id);
  if(existing) existing.remaining = Math.max(existing.remaining, duration);
  else activePowerups.push({id, label, icon, remaining: duration});
  audio.powerup(); toast(I18n.t('powerup.'+id) + ' ' + I18n.t('toast.activated'), 'success');
}
function updatePowerups(dt){
  for(let i=activePowerups.length-1; i>=0; i--){
    activePowerups[i].remaining -= dt;
    if(activePowerups[i].remaining <= 0) activePowerups.splice(i,1);
  }
  // state.powerups snapshot is rebuilt inside updateHUD (every HUD tick), not every frame
}

// ============================================================================
// GRENADES / PROJECTILES / DUST
// ============================================================================
let grenades = [];
const grenadeArcLine = null;

const _swAxes = ['x','y','z'];
const _swOut = {hit:false, t:1, point:new THREE.Vector3(), contact:new THREE.Vector3(), normal:new THREE.Vector3()};
const _gPrev = new THREE.Vector3(), _gNext = new THREE.Vector3();
const _prjPrev = new THREE.Vector3(), _prjNext = new THREE.Vector3();

function segBoxEntryT(box, a, b, pad){
  let tmin = 0, tmax = 1;
  for(let i=0;i<3;i++){
    const ax = _swAxes[i];
    const lo = box.min[ax] - pad, hi = box.max[ax] + pad;
    const d = b[ax] - a[ax], p = a[ax];
    if(d > -1e-9 && d < 1e-9){ if(p < lo || p > hi) return -1; continue; }
    let t1 = (lo - p)/d, t2 = (hi - p)/d;
    if(t1 > t2){ const s = t1; t1 = t2; t2 = s; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax) return -1;
  }
  return tmin;
}

// Returns the first surface hit along from->to (pad = projectile radius).
// _swOut is reused across calls — read it immediately, never keep a reference.
function sweepProjectiles(from, to, pad){
  const out = _swOut; out.hit = false; out.t = 1;
  let bestT = Infinity, bestBox = null;
  for(let i=0;i<wallColliders.length;i++){
    const c = wallColliders[i]; if(!c) continue;
    const t = segBoxEntryT(c, from, to, pad);
    if(t >= 0 && t < bestT){ bestT = t; bestBox = c; }
  }
  for(let i=0;i<solidSlabs.length;i++){
    const c = solidSlabs[i]; if(!c) continue;
    const t = segBoxEntryT(c, from, to, pad);
    if(t >= 0 && t < bestT){ bestT = t; bestBox = c; }
  }
  if(!bestBox) return out;
  out.hit = true; out.t = bestT;
  out.point.copy(from).lerp(to, bestT);
  let bestD = Infinity, axis = 1, sign = 1;
  for(let i=0;i<3;i++){
    const lo = bestBox.min[_swAxes[i]] - pad, hi = bestBox.max[_swAxes[i]] + pad;
    const v = out.point.getComponent(i);
    const dLo = v - lo, dHi = hi - v;
    if(dLo < bestD){ bestD = dLo; axis = i; sign = -1; }
    if(dHi < bestD){ bestD = dHi; axis = i; sign = 1; }
  }
  out.normal.set(0,0,0); out.normal.setComponent(axis, sign);
  const face = (sign > 0 ? bestBox.max[_swAxes[axis]] + pad : bestBox.min[_swAxes[axis]] - pad) + sign*0.02;
  out.point.setComponent(axis, face);
  out.contact.copy(out.point).addScaledVector(out.normal, -pad);
  return out;
}

function spawnEnemyProjectile(from, target, damage){
  const dir = target.clone().sub(from).normalize();
  const mesh = acquirePooledMesh(projectilePool, _projectileGeoShared, 0x44ddff);
  mesh.position.copy(from); mesh.visible=true;
  projectiles.push({mesh, vel:dir.multiplyScalar(14), life:3, damage, fromPool:true});
}
function updateGrenades(dt){
  for(let i=grenades.length-1; i>=0; i--){
    const g = grenades[i];
    if(g.detonated){ if(g.trail){ scene.remove(g.trail); g.trail.geometry.dispose(); if(g.ring)g.ring.geometry?.dispose(); } continue; }
    _gPrev.copy(g.mesh.position);
    g.vel.y -= (g.isRocket ? 2 : 9.8) * dt;
    _gNext.copy(_gPrev).addScaledVector(g.vel, dt);
    const hit = sweepProjectiles(_gPrev, _gNext, g.isRocket ? 0.15 : 0.22);
    if(hit.hit){
      g.mesh.position.copy(g.isRocket ? hit.contact : hit.point);
      g._pos.copy(g.mesh.position);
      if(g.isRocket){ detonateGrenade(g); continue; }
      const vn = g.vel.dot(hit.normal);
      if(vn < -0.5) g.vel.addScaledVector(hit.normal, -1.4 * vn);
      else if(vn < 0) g.vel.addScaledVector(hit.normal, -vn);
      g.vel.multiplyScalar(1 - Math.min(1, dt * 6));
    } else {
      g.mesh.position.copy(_gNext);
    }
    g._pos.copy(g.mesh.position);
    g.mesh.rotation.x += dt*5; g.mesh.rotation.y += dt*3;
    // Pulse ring
    if(g.ring){ const s = 0.8 + Math.sin(clock.elapsedTime*10)*0.3; g.ring.scale.setScalar(s); }
    // Update trail — preallocated ring buffer (was: dispose+recreate geometry every frame)
    if(g.hasTrail && g.trail){
      const attr = g.trail.geometry.attributes.position;
      const arr = attr.array;
      if(g.trailCount < 40){
        arr[g.trailCount*3] = g.mesh.position.x; arr[g.trailCount*3+1] = g.mesh.position.y; arr[g.trailCount*3+2] = g.mesh.position.z;
        g.trailCount++;
      } else {
        arr.copyWithin(0, 3);
        arr[117] = g.mesh.position.x; arr[118] = g.mesh.position.y; arr[119] = g.mesh.position.z;
      }
      g.trail.geometry.setDrawRange(0, g.trailCount);
      attr.needsUpdate = true;
      g.trail.material.opacity = 0.2 + (g.life/3.0)*0.5;
    }
    g.life -= dt;
    if(!g.isRocket && g.mesh.position.y < 0.15){ g.mesh.position.y = 0.15; g.vel.y *= -0.4; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    if(g.life <= 0) detonateGrenade(g);
  }
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1; i>=0; i--){
    const p = projectiles[i];
    _prjPrev.copy(p.mesh.position);
    _prjNext.copy(_prjPrev).addScaledVector(p.vel, dt);
    p.life -= dt;
    const hit = sweepProjectiles(_prjPrev, _prjNext, 0.18);
    p.mesh.position.copy(hit.hit ? hit.contact : _prjNext);
    if(p.mesh.position.distanceTo(camera.position) < 0.5){ takeDamage(p.damage, p.mesh.position);
      if(p.fromPool) p.mesh.visible=false; else scene.remove(p.mesh);
      projectiles.splice(i,1); continue; }
    if(hit.hit || p.life <= 0){
      spawnSpark(p.mesh.position, 0x44ddff, 0.1);
      if(p.fromPool) p.mesh.visible=false; else scene.remove(p.mesh);
      projectiles.splice(i,1); }
  }
}
