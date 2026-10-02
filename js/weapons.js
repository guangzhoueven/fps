// ============================================================================
// WEAPONS — view model, inventory, fire, reload, anim
// ============================================================================
// ============================================================================
// WEAPON VIEW MODEL
// ============================================================================
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
weaponGroup.position.set(0.26, -0.22, -0.5);
let weaponParts = [];
const muzzleFlash = new THREE.PointLight(0xffcc66, 0, 15, 1.8);
weaponGroup.add(muzzleFlash);
const muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:muzzleTex(),transparent:true,blending:THREE.AdditiveBlending,depthTest:false}));
muzzleSprite.scale.set(0.4,0.4,1); muzzleSprite.visible=false; weaponGroup.add(muzzleSprite);
let muzzleFlashTimer=0, weaponRecoil=0, weaponReloadAnim=0, weaponSwapAnim=0;
let swayX=0, swayY=0, mouseDeltaX=0, mouseDeltaY=0;
let originalWeaponPosX = 0.26, originalWeaponPosY = -0.22, originalWeaponPosZ = -0.5;

function updateWeaponMesh(){
  for(const p of weaponParts){ weaponGroup.remove(p); if(p.geometry)p.geometry.dispose(); if(p.material)p.material.dispose(); }
  weaponParts = [];
  const sel = state.inventory[state.selectedSlot];
  if(!sel) return;
  const w = WEAPONS[sel.type];
  if(!w) return;
  const metalMat = new THREE.MeshStandardMaterial({color:w.color,roughness:.45,metalness:.7});
  const darkMat = new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.6,metalness:.5});
  const gripMat = new THREE.MeshStandardMaterial({color:0x2a1a0a,roughness:.85,metalness:.1});
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);weaponGroup.add(m);weaponParts.push(m);};
  let muzzleZ=-0.4;
  switch(w.id){
    case 'pistol': add(new THREE.BoxGeometry(0.07,0.07,0.22),metalMat,0,0,-0.11); add(new THREE.BoxGeometry(0.06,0.05,0.12),darkMat,0,-0.06,-0.04); add(new THREE.BoxGeometry(0.055,0.12,0.06),gripMat,0,-0.1,0.05,0.25); add(new THREE.CylinderGeometry(0.018,0.018,0.06,8),darkMat,0,0.005,-0.24,Math.PI/2); muzzleZ=-0.28; break;
    case 'smg': add(new THREE.BoxGeometry(0.07,0.08,0.3),metalMat,0,0,-0.15); add(new THREE.BoxGeometry(0.04,0.16,0.05),darkMat,0,-0.12,-0.06); add(new THREE.BoxGeometry(0.05,0.1,0.05),gripMat,0,-0.09,0.04,0.2); add(new THREE.BoxGeometry(0.04,0.05,0.14),darkMat,0,-0.01,0.1); add(new THREE.CylinderGeometry(0.015,0.015,0.1,8),metalMat,0,0.005,-0.32,Math.PI/2); muzzleZ=-0.38; break;
    case 'shotgun': add(new THREE.CylinderGeometry(0.025,0.025,0.4,10),metalMat,-0.02,0.01,-0.18,Math.PI/2); add(new THREE.CylinderGeometry(0.025,0.025,0.4,10),metalMat,0.02,0.01,-0.18,Math.PI/2); add(new THREE.BoxGeometry(0.08,0.07,0.14),darkMat,0,-0.04,-0.1); add(new THREE.BoxGeometry(0.05,0.06,0.06),gripMat,0,-0.08,0.04,0.2); add(new THREE.BoxGeometry(0.05,0.08,0.16),gripMat,0,-0.02,0.12); muzzleZ=-0.4; break;
    case 'rifle': add(new THREE.BoxGeometry(0.07,0.08,0.36),metalMat,0,0,-0.16); add(new THREE.BoxGeometry(0.04,0.14,0.06),darkMat,0,-0.1,-0.08); add(new THREE.BoxGeometry(0.05,0.1,0.05),gripMat,0,-0.08,0.03,0.2); add(new THREE.BoxGeometry(0.05,0.07,0.16),gripMat,0,-0.01,0.12); add(new THREE.CylinderGeometry(0.014,0.014,0.12,8),metalMat,0,0.02,-0.36,Math.PI/2); add(new THREE.BoxGeometry(0.02,0.03,0.08),darkMat,0,0.06,-0.14); muzzleZ=-0.44; break;
    case 'sniper': add(new THREE.BoxGeometry(0.06,0.07,0.3),metalMat,0,0,-0.14); add(new THREE.CylinderGeometry(0.012,0.012,0.5,8),metalMat,0,0.01,-0.35,Math.PI/2); add(new THREE.CylinderGeometry(0.035,0.035,0.14,12),darkMat,0,0.09,-0.12,Math.PI/2); add(new THREE.CylinderGeometry(0.02,0.02,0.04,8),darkMat,0,0.09,-0.19); add(new THREE.BoxGeometry(0.05,0.1,0.18),gripMat,0,-0.02,0.1); add(new THREE.BoxGeometry(0.04,0.08,0.04),darkMat,0,-0.08,-0.2); muzzleZ=-0.62; break;
    case 'rocket': add(new THREE.CylinderGeometry(0.07,0.07,0.5,12),metalMat,0,0,-0.2,Math.PI/2); add(new THREE.ConeGeometry(0.075,0.12,12),darkMat,0,0,-0.5,Math.PI/2); add(new THREE.BoxGeometry(0.05,0.1,0.06),gripMat,0,-0.09,0,0.2); add(new THREE.BoxGeometry(0.03,0.04,0.1),darkMat,0,0.08,-0.05); muzzleZ=-0.56; break;
    case 'crossbow': add(new THREE.BoxGeometry(0.05,0.12,0.5),metalMat,0,0.02,-0.22); add(new THREE.CylinderGeometry(0.015,0.015,0.35,8),darkMat,0,0.06,-0.1,0); add(new THREE.BoxGeometry(0.06,0.06,0.14),gripMat,0,-0.04,0.04,0.2); add(new THREE.CylinderGeometry(0.012,0.012,0.25,8),metalMat,0,0.02,-0.48,Math.PI/2); muzzleZ=-0.6; break;
    case 'minigun': add(new THREE.CylinderGeometry(0.05,0.05,0.5,10),metalMat,0,0,-0.22,Math.PI/2); for(let b=0;b<3;b++){add(new THREE.CylinderGeometry(0.025,0.025,0.12,6),darkMat,0,0,-0.08+b*0.08,Math.PI/2);} add(new THREE.BoxGeometry(0.06,0.06,0.1),gripMat,0,-0.06,0.05,0.15); add(new THREE.BoxGeometry(0.04,0.05,0.14),gripMat,0,-0.02,0.1); muzzleZ=-0.5; break;
    case 'tesla': add(new THREE.BoxGeometry(0.08,0.09,0.3),metalMat,0,0,-0.15); for(let i=0;i<3;i++) add(new THREE.CylinderGeometry(0.032,0.032,0.1,8),darkMat,0,0.02,-0.06-i*0.08,Math.PI/2); add(new THREE.SphereGeometry(0.04,8,8),new THREE.MeshStandardMaterial({color:0x33ddff,emissive:0x33ddff,emissiveIntensity:1.6,roughness:.3}),0,0.02,-0.37); add(new THREE.BoxGeometry(0.05,0.12,0.06),gripMat,0,-0.1,0.05,0.25); muzzleZ=-0.4; break;
    case 'flamer': add(new THREE.CylinderGeometry(0.055,0.055,0.28,10),metalMat,0.035,0.03,-0.13,Math.PI/2); add(new THREE.CylinderGeometry(0.02,0.05,0.24,8),darkMat,0,-0.01,-0.3,Math.PI/2); add(new THREE.BoxGeometry(0.07,0.1,0.16),darkMat,0,-0.03,0.03); add(new THREE.BoxGeometry(0.05,0.12,0.06),gripMat,0,-0.1,0.07,0.25); muzzleZ=-0.42; break;
    case 'ricochet': add(new THREE.BoxGeometry(0.07,0.08,0.32),metalMat,0,0,-0.16); add(new THREE.CylinderGeometry(0.02,0.02,0.2,8),darkMat,-0.028,0.02,-0.3,Math.PI/2); add(new THREE.CylinderGeometry(0.02,0.02,0.2,8),darkMat,0.028,0.02,-0.3,Math.PI/2); add(new THREE.BoxGeometry(0.05,0.12,0.06),gripMat,0,-0.1,0.05,0.25); muzzleZ=-0.4; break;
  }
  muzzleFlash.position.set(0,0,muzzleZ);
  muzzleSprite.position.set(0,0,muzzleZ-0.02);
  weaponGroup.userData.muzzleZ = muzzleZ;
}

// ============================================================================
// INVENTORY
// ============================================================================
function rebuildInventory(){
  const prevType = state.inventory[state.selectedSlot] ? state.inventory[state.selectedSlot].type : null;
  const inv = [];
  for(const id of ['pistol','smg','shotgun','rifle','sniper','rocket','crossbow','minigun','tesla','flamer','ricochet']){
    if(ownedWeapons.has(id)){ const w=WEAPONS[id]; inv.push({type:id,icon:w.icon,label:w.name}); }
  }
  inv.push({type:'grenade',icon:'💣',label:'grenade',count:state.grenades});
  inv.push({type:'medkit',icon:'💊',label:'medkit',count:medkitCount});
  inv.push({type:'flashlight',icon:'🔦',label:'flashlight'});
  while(inv.length < 8) inv.push({type:'',icon:'—',label:''});
  state.inventory = inv;
  if(state.selectedSlot >= inv.length) state.selectedSlot = 0;
  // Keep the same ITEM selected — the fixed weapon order shifts every slot after a purchase
  if(prevType){ const idx = inv.findIndex(s => s && s.type === prevType); if(idx >= 0) state.selectedSlot = idx; }
  updateWeaponMesh();
  updateAmmoState();
}
function selectSlot(idx){
  const len = state.inventory.length;
  if(len===0) return;
  idx = ((idx%len)+len)%len;
  if(idx !== state.selectedSlot) weaponSwapAnim = 1;
  state.selectedSlot = idx;
  if(reloadTimeout){ clearTimeout(reloadTimeout); reloadTimeout=null; state.reloading=false; }
  updateWeaponMesh(); updateAmmoState();
}
function updateAmmoState(){
  const sel = state.inventory[state.selectedSlot];
  if(!sel || !WEAPONS[sel.type]){ state.ammo=0; state.magSize=0; state.reserve=0; state.lowAmmo=false; return; }
  const w = WEAPONS[sel.type];
  const a = weaponAmmo[w.id] || {mag:0,reserve:0};
  state.ammo = a.mag; state.magSize = w.magSize; state.reserve = a.reserve;
  state.lowAmmo = a.mag > 0 && a.mag <= Math.ceil(w.magSize * 0.25);
}

// ============================================================================
// WEAPON FIRE
// ============================================================================
let fireCooldown=0, reloadTimeout=null, reloadStartTime=0, reloadDuration=0;
// Persistent raycast target list — refreshed once per shot instead of per pellet
let _fireTargets = [];
const _fireRC = new THREE.Raycaster();
const _hitN = new THREE.Vector3();   // hit face normal in WORLD space (face.normal is local — ground is rotated)
const _upN = new THREE.Vector3(0, 1, 0);

function fireWeapon(){
  const sel = state.inventory[state.selectedSlot];
  if(!sel) return;
  const w = WEAPONS[sel.type];
  if(!w || state.reloading) return;
  const ammo = weaponAmmo[w.id];
  if(!ammo || ammo.mag<=0){ if(!audio._emptyT || performance.now()-audio._emptyT > 150){ audio._emptyT = performance.now(); audio.empty(); } if(ammo&&ammo.reserve>0) doReload(); return; }
  const rapid = hasPowerup('rapid');
  const effRate = rapid ? w.fireRate*0.4 : w.fireRate;
  if(fireCooldown > 0) return;
  ammo.mag--; fireCooldown = effRate;
  state.stats.shotsFired += w.pellets;
  pitch += w.recoil * (rapid?0.7:1);
  pitch = Math.min(pitch, Math.PI/2-0.1);
  weaponRecoil = 1;
  addShake(w.recoil * 0.4);
  muzzleFlashTimer = 0.06;
  muzzleFlash.color.setHex(w.explosive ? 0xff4400 : 0xffaa33);
  audio.shoot(w.id);
  camera.updateMatrixWorld();
  _fireTargets.length = 0;
  for(const wm of wallMeshes) _fireTargets.push(wm);
  for(const en of enemies) if(en.alive && !en.dying) _fireTargets.push(en.mesh);
  for(const b of explosiveBarrels) if(!b.exploded) _fireTargets.push(b.mesh);
  for(let p=0;p<w.pellets;p++) fireRay(w);
  updateAmmoState();
}
function fireRay(w){
  const spreadScale = adsActive ? 1 : 2;
  const ndc = new THREE.Vector2((Math.random()-.5)*w.spread*spreadScale, (Math.random()-.5)*w.spread*spreadScale);
  _fireRC.setFromCamera(ndc, camera);
  if(w.explosive){ spawnRocket(_fireRC.ray.direction.clone()); return; }
  if(w.projectile){ spawnBolt(_fireRC.ray.direction.clone()); return; }
  if(w.bounce){ fireRayBounce(w, ndc); return; }
  const hits = _fireRC.intersectObjects(_fireTargets, true);
  let endPoint = null;
  for(const hit of hits){
    if(hit.distance > w.range) continue;
    // Skip weapon group children
    let p = hit.object; let own=false;
    while(p){ if(p===weaponGroup||p===camera){own=true;break;} p=p.parent; }
    if(own) continue;
    endPoint = hit.point.clone();
    // Check enemyRef on hit object OR its parent chain (eyes/hpbar are children)
    let enemyRef = hit.object.userData.enemyRef;
    if(!enemyRef){
      let pp = hit.object.parent;
      while(pp && !enemyRef){ enemyRef = pp.userData.enemyRef; pp = pp.parent; }
    }
    if(enemyRef && enemyRef.alive && !enemyRef.dying){
      const headshot = hit.point.y > enemyRef.mesh.position.y + enemyRef.size * 0.45;
      let dmg = w.damage * damageMult;
      if(hasPowerup('damage')) dmg *= 2;
      if(headshot) dmg *= 2.2;
      const killed = enemyRef.takeDamage(dmg, headshot);
      if(w.burn) enemyRef.applyBurn(w.burn.dps, w.burn.dur);
      if(w.chain) chainLightning(hit.point, enemyRef, w, dmg);
      state.stats.shotsHit++; state.stats.damageDealt += dmg;
      spawnSpark(hit.point, 0xff4400, 0.15);
      spawnDamageNumber(hit.point.clone(), Math.round(dmg), headshot);
      showHitmarker(headshot, killed);
      break;
    }
    // Explosive barrel?
    if(hit.object.userData.explosiveBarrel){
      const barrel = explosiveBarrels.find(b=>b.mesh===hit.object && !b.exploded);
      if(barrel){ detonateBarrel(barrel); break; }
    }
    spawnSpark(hit.point, 0xffcc66, 0.1);
    spawnDecal(hit.point, hit.face ? _hitN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld) : _upN);
    break;
  }
  if(!endPoint) endPoint = _fireRC.ray.origin.clone().add(_fireRC.ray.direction.clone().multiplyScalar(w.range));
  if(w.flamer) spawnFlame(getMuzzlePos(), _fireRC.ray.direction, 5);
  spawnTracer(getMuzzlePos(), endPoint);
}
// Tesla arc — jumps from the struck enemy to nearby ones with damage falloff
function chainLightning(from, first, w, baseDmg){
  const visited = new Set([first]);
  let src = from.clone(), dmg = baseDmg * (w.chainFalloff || 0.6);
  let remaining = w.chain;
  while(remaining > 0){
    let best = null, bestD = w.chainRange;
    for(const e of enemies.slice()){ // snapshot — a kill can spawn splitter children mid-loop
      if(!e.alive || e.dying || visited.has(e)) continue;
      const d = e.mesh.position.distanceTo(src);
      if(d < bestD){ bestD = d; best = e; }
    }
    if(!best) break;
    const tgt = best.mesh.position.clone();
    spawnLightning(src, tgt);
    best.takeDamage(dmg, false);
    spawnSpark(tgt, 0x66ddff, 0.14);
    visited.add(best); src = tgt; dmg *= (w.chainFalloff || 0.6); remaining--;
  }
}
// Ricochet round — reflects off surfaces (world-space normal) and keeps going
const _bounceRC = new THREE.Raycaster();
const _bounceN = new THREE.Vector3();
const _bounceNM = new THREE.Matrix3();
function fireRayBounce(w, ndc){
  _bounceRC.setFromCamera(ndc, camera);
  const pts = [getMuzzlePos().clone()];
  let dmg = w.damage * damageMult;
  if(hasPowerup('damage')) dmg *= 2;
  const dir = _bounceRC.ray.direction.clone();
  const origin = _bounceRC.ray.origin.clone();
  let left = w.range, endPoint = null, bounces = 0;
  while(true){
    _bounceRC.set(origin, dir);
    _bounceRC.near = 0; _bounceRC.far = left;
    const hits = _bounceRC.intersectObjects(_fireTargets, true);
    let hit = null;
    for(const h of hits){
      let p = h.object, own = false;
      while(p){ if(p===weaponGroup||p===camera){own=true;break;} p=p.parent; }
      if(own) continue;
      hit = h; break;
    }
    if(!hit){ endPoint = origin.clone().addScaledVector(dir, left); break; }
    pts.push(hit.point.clone());
    let enemyRef = hit.object.userData.enemyRef;
    if(!enemyRef){ let pp = hit.object.parent; while(pp && !enemyRef){ enemyRef = pp.userData.enemyRef; pp = pp.parent; } }
    if(enemyRef && enemyRef.alive && !enemyRef.dying){
      const headshot = hit.point.y > enemyRef.mesh.position.y + enemyRef.size * 0.45;
      let d = dmg * (headshot ? 2.2 : 1);
      const killed = enemyRef.takeDamage(d, headshot);
      state.stats.shotsHit++; state.stats.damageDealt += d;
      spawnSpark(hit.point, 0xff4400, 0.15);
      spawnDamageNumber(hit.point.clone(), Math.round(d), headshot);
      showHitmarker(headshot, killed);
      endPoint = hit.point.clone();
      break;
    }
    if(hit.object.userData.explosiveBarrel){
      const barrel = explosiveBarrels.find(b=>b.mesh===hit.object && !b.exploded);
      if(barrel){ detonateBarrel(barrel); endPoint = hit.point.clone(); break; }
    }
    spawnSpark(hit.point, 0xaaddff, 0.1);
    spawnDecal(hit.point, hit.face ? _hitN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld) : _upN);
    if(bounces >= w.bounce || !hit.face){ endPoint = hit.point.clone(); break; }
    // Reflect the ray about the surface normal in world space
    _bounceNM.getNormalMatrix(hit.object.matrixWorld);
    _bounceN.copy(hit.face.normal).applyMatrix3(_bounceNM).normalize();
    const into = dir.dot(_bounceN);
    if(into >= -0.02){ endPoint = hit.point.clone(); break; } // grazing — let it slide out
    dir.addScaledVector(_bounceN, -2*into).normalize();
    origin.copy(hit.point).addScaledVector(_bounceN, 0.03);
    left -= hit.distance;
    if(left <= 0.5){ endPoint = origin.clone(); break; }
    dmg *= (w.bounceDamage || 0.75);
    bounces++;
  }
  if(!endPoint) endPoint = origin.clone().addScaledVector(dir, left);
  for(let i=0;i<pts.length-1;i++) spawnTracer(pts[i], pts[i+1]);
  if(pts[pts.length-1] !== endPoint) spawnTracer(pts[pts.length-1], endPoint);
}
const _muzzleV = new THREE.Vector3();
function getMuzzlePos(){ _muzzleV.set(0,0, weaponGroup.userData.muzzleZ !== undefined ? weaponGroup.userData.muzzleZ : -0.32); weaponGroup.localToWorld(_muzzleV); return _muzzleV; }
function spawnRocket(dir){
  const start = getMuzzlePos();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1,0.3,4,8), new THREE.MeshStandardMaterial({color:0x444422,emissive:0xff6600,emissiveIntensity:.8}));
  mesh.position.copy(start); mesh.lookAt(start.clone().add(dir)); mesh.rotateX(Math.PI/2);
  scene.add(mesh);
  grenades.push({mesh, vel:dir.multiplyScalar(28), life:4.0, detonated:false, isRocket:true, _pos:start.clone()});
}
function spawnBolt(dir){
  const start = getMuzzlePos();
  const boltMat = new THREE.MeshStandardMaterial({color:0x7a5a3a,emissive:0x5a3a1a,emissiveIntensity:.4,roughness:.4,metalness:.7});
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.5,6), boltMat);
  mesh.position.copy(start);
  mesh.lookAt(start.clone().add(dir));
  mesh.rotateX(Math.PI/2);
  scene.add(mesh);
  grenades.push({mesh, vel:dir.multiplyScalar(60), life:3.0, detonated:false, isRocket:true, isBolt:true, _pos:start.clone(), boltDir:dir.clone(), boltStart:start.clone()});
}
// ============================================================================
// RELOAD
// ============================================================================
function doReload(){
  const sel = state.inventory[state.selectedSlot];
  if(!sel) return;
  const w = WEAPONS[sel.type];
  if(!w) return;
  const ammo = weaponAmmo[w.id];
  if(!ammo || state.reloading || ammo.mag===w.magSize || ammo.reserve<=0) return;
  state.reloading = true; weaponReloadAnim = 1; audio.reload();
  const rt = (hasPowerup('rapid') ? w.reloadTime*0.6 : w.reloadTime) / (1 + (reloadSpeedMult-1)*0.5);
  reloadStartTime = performance.now(); reloadDuration = rt * 1000;
  reloadTimeout = setTimeout(()=>{
    const needed = w.magSize - ammo.mag;
    const avail = Math.min(needed, ammo.reserve);
    ammo.mag += avail; ammo.reserve -= avail;
    state.reloading = false; reloadTimeout = null;
    updateAmmoState();
  }, rt * 1000);
}

function updateWeaponAnim(dt){
  if(weaponRecoil > 0) weaponRecoil = Math.max(0, weaponRecoil - dt*8);
  const recoilZ = weaponRecoil * 0.12, recoilRot = weaponRecoil * 0.3;
  if(weaponReloadAnim > 0) weaponReloadAnim = Math.max(0, weaponReloadAnim - dt / Math.max(0.05, reloadDuration / 1000)); // dip lasts exactly as long as the real reload
  const reloadDip = Math.sin(weaponReloadAnim * Math.PI) * 0.25;
  if(weaponSwapAnim > 0) weaponSwapAnim = Math.max(0, weaponSwapAnim - dt*3.5);
  const swapDip = weaponSwapAnim * 0.35, swapRot = weaponSwapAnim * 0.8;
  const moving = (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']) && onGround;
  const t = clock.elapsedTime;
  const bobFreq = state.sprinting ? 12 : 7;
  const bobAmp = moving ? (state.sprinting?0.018:0.01) : 0;
  const bobX = Math.sin(t*bobFreq) * bobAmp, bobY = Math.abs(Math.sin(t*bobFreq)) * bobAmp;
  swayX += (mouseDeltaX*0.0008 - swayX) * Math.min(1, dt*8);
  swayY += (mouseDeltaY*0.0008 - swayY) * Math.min(1, dt*8);
  mouseDeltaX *= 0.85; mouseDeltaY *= 0.85;
  // ADS: move weapon to center, reduce sway
  const adsTargetX = adsActive ? 0 : 0.26;
  const adsTargetY = adsActive ? -0.18 : -0.22;
  const adsTargetZ = adsActive ? -0.4 : -0.5;
  const adsFactor = adsActive ? 0.18 : 0.08;
  originalWeaponPosX += (adsTargetX - originalWeaponPosX) * Math.min(1, dt*10);
  originalWeaponPosY += (adsTargetY - originalWeaponPosY) * Math.min(1, dt*10);
  originalWeaponPosZ += (adsTargetZ - originalWeaponPosZ) * Math.min(1, dt*10);
  const swayMult = adsActive ? 0.3 : 1.0;
  weaponGroup.position.set(
    originalWeaponPosX + bobX + swayX * swayMult,
    originalWeaponPosY + bobY + reloadDip + swayY * swayMult - swapDip,
    originalWeaponPosZ + recoilZ + swapDip * 0.5
  );
  weaponGroup.rotation.x = recoilRot + reloadDip*1.5 - swayY*2*swayMult + swapRot;
  weaponGroup.rotation.z = -swayX*2*swayMult + swapRot*0.5;
  if(muzzleFlashTimer > 0){
    muzzleFlashTimer -= dt;
    const frac = muzzleFlashTimer / 0.06;
    muzzleFlash.intensity = frac * (12 + Math.random()*6);
    muzzleSprite.visible = true;
    muzzleSprite.scale.setScalar(0.32 + Math.random()*0.28);
    muzzleSprite.material.rotation = Math.random() * Math.PI;
  } else { muzzleFlash.intensity = 0; muzzleSprite.visible = false; }
}
