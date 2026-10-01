// ============================================================================
// ENEMIES — Enemy class & AI
// ============================================================================
// ============================================================================
// ENEMIES
// ============================================================================
let enemies = [];
let bossRef = null;
let bossKills = 0;
// Scratch objects for hot per-enemy paths (avoid per-frame allocations)
const _losDir = new THREE.Vector3();
const _losTarget = new THREE.Vector3();
const _losRC = new THREE.Raycaster();
const _mvBox = new THREE.Box3();
const _burnOff = new THREE.Vector3();

// Per-kind visuals — kept out of the constructor hot path
function enemyGeo(kind, s){
  switch(kind){
    case 'boss': return new THREE.IcosahedronGeometry(s,1);
    case 'brute': return new THREE.DodecahedronGeometry(s,0);
    case 'phantom': return new THREE.IcosahedronGeometry(s,0);
    case 'tank': return new THREE.IcosahedronGeometry(s,1);
    case 'bomber': return new THREE.IcosahedronGeometry(s,0);
    case 'splitter': return new THREE.DodecahedronGeometry(s,1);
    case 'swarmling': return new THREE.OctahedronGeometry(s,0);
    case 'jumper': return new THREE.TetrahedronGeometry(s*1.3,0);
    default: return new THREE.SphereGeometry(s,12,12);
  }
}
const FLAT_SHADE_KINDS = ['brute','boss','tank','bomber','splitter','jumper','swarmling'];
function enemyEyeColor(kind){
  if(kind==='boss') return 0xff3333;
  if(kind==='phantom') return 0x88ccff;
  if(kind==='tank') return 0x44ff44;
  if(kind==='healer') return 0x66ffcc;
  if(kind==='bomber') return 0xffcc33;
  if(kind==='jumper') return 0xff99dd;
  return 0xffff44;
}

class Enemy {
  constructor(x, z, kind, wave){
    this.def = ENEMY_DEFS[kind];
    const diffCfg = DIFFICULTIES[difficulty];
    const hpScale = (1 + (wave-1)*0.08) * diffCfg.enemyHpMult;
    this.hp = Math.round(this.def.hp * hpScale);
    this.maxHp = this.hp;
    this.alive = true;
    this.size = this.def.size;
    this.state = 'WANDER';
    this.visionBlockedTime = 0;
    this.wanderTimer = 1 + Math.random()*2;
    this.wanderTarget = {x:x+(Math.random()-.5)*10, z:z+(Math.random()-.5)*10};
    this.lastSeenPos = null;
    this.attackCooldown = 0;
    this._losFrame = 0;
    // A* navigation — pick the nav grid matching this enemy's footprint
    const footprint = this.def.size * 0.9;
    this.navGrid = footprint <= 0.45 ? navGrids[0] : (footprint <= 0.9 ? navGrids[1] : navGrids[2]);
    this.path = null; this.pathIndex = 0;
    this.repathTimer = 0.3 + Math.random() * 0.4;
    this._leapT = 0; this._leapCd = 0.6 + Math.random();
    const geo = enemyGeo(kind, this.def.size);
    const mat = new THREE.MeshStandardMaterial({color:this.def.color,roughness:.5,emissive:this.def.color,emissiveIntensity:.15,flatShading:FLAT_SHADE_KINDS.includes(kind),transparent:kind==='phantom',opacity:kind==='phantom'?0.72:1.0});
    this.mesh = new THREE.Mesh(geo, mat);
    this._origEmissive = this.def.color;
    this.mesh.position.set(x, this.def.size+0.1, z);
    this.mesh.userData.enemyRef = this;
    scene.add(this.mesh);
    if(kind !== 'boss'){
      const barCanvas = document.createElement('canvas'); barCanvas.width=64; barCanvas.height=8;
      this.barCtx = barCanvas.getContext('2d');
      const barTex = new THREE.CanvasTexture(barCanvas);
      const barSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:barTex,depthTest:false}));
      barSprite.scale.set(1.0, 0.13, 1); barSprite.position.set(0, this.def.size+0.55, 0);
      barSprite.raycast = function(){}; // HP bar never intercepts rays (perf + avoids false headshots)
      this.barSprite = barSprite; this.mesh.add(barSprite);
    }
    // Eyes
    const eyeColor = enemyEyeColor(kind);
    const eyeMat = new THREE.MeshBasicMaterial({color: eyeColor, transparent:kind==='phantom', opacity:0.9});
    if(kind !== 'boss'){
      const eg = new THREE.SphereGeometry(this.def.size*0.18, 6, 6);
      const le = new THREE.Mesh(eg, eyeMat); le.position.set(-this.def.size*0.35, this.def.size*0.4, this.def.size*0.85); this.mesh.add(le);
      const re = new THREE.Mesh(eg, eyeMat); re.position.set(this.def.size*0.35, this.def.size*0.4, this.def.size*0.85); this.mesh.add(re);
    } else {
      for(let i=0;i<5;i++){ const a=(i/5)*Math.PI*2; const e=new THREE.Mesh(new THREE.SphereGeometry(this.def.size*0.12,8,8), eyeMat); e.position.set(Math.cos(a)*this.def.size*0.6, this.def.size*0.3, Math.sin(a)*this.def.size*0.6); this.mesh.add(e); }
    }
  }
  update(dt, allEnemies){
    if(!this.alive) return;
    if(this.dying){ 
      this.dyingTimer -= dt; 
      this.mesh.position.y -= dt*2.5;
      this.mesh.position.y = Math.max(0, this.mesh.position.y);
      this.mesh.rotation.x += this.dyingRotSpeed.x*dt; 
      this.mesh.rotation.z += this.dyingRotSpeed.z*dt; 
      if(this.dyingTimer <= 0) { this.alive = false; scene.remove(this.mesh); }
      return;
    }
    // Hit flash restore (replaces one setTimeout per bullet hit)
    if(this._flashing){
      this._flashTimer -= dt;
      if(this._flashTimer <= 0){ this._flashing = false; const m=this.mesh.material; if(m && m.emissive) m.emissive.setHex(this._origEmissive); }
    }
    // Flamethrower burn — damage over time without hit-flash spam
    if(this._burnT > 0){
      this._burnT -= dt;
      this._burnAcc = (this._burnAcc||0) + dt;
      if(this._burnAcc >= 0.25){
        this._burnAcc -= 0.25;
        spawnSpark(this.mesh.position.clone().add(_burnOff.set(0,this.def.size,0)), 0xff6622, 0.12);
        this.hp -= this._burnDps * 0.25;
        this._lastHpDrawn = -1;
        if(this.hp <= 0){ this._burnT = 0; this.die(false); return; }
      }
    }
    const px=camera.position.x, pz=camera.position.z;
    const dx=px-this.mesh.position.x, dz=pz-this.mesh.position.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.attackCooldown -= dt;
    // Bomber: rush into melee range and detonate
    if(this.def.bomb && dist < 1.7){ this.takeDamage(this.hp, false); return; }
    // Bomber tick — faster pulse as it closes in (telegraph)
    if(this.def.bomb) this.mesh.scale.setScalar(1 + Math.sin(clock.elapsedTime * (dist<6?9:5)) * 0.1);
    const attackRange = this.def.attackRange || 1.6;
    const diffCfg = DIFFICULTIES[difficulty];
    // LOS raycast staggered every ~0.12-0.22s per enemy (was 2 identical raycasts every frame)
    this._losTimer = (this._losTimer || 0) - dt;
    if(this._losTimer <= 0){
      this._losTimer = 0.12 + Math.random()*0.1;
      _losTarget.set(px, 1.6, pz);
      this._losBlockedCached = this.losBlocked(this.mesh.position, _losTarget);
    }
    const hasLOS = !this._losBlockedCached;
    if(this.def.ranged && !this.def.support && dist < (this.def.attackRange||16) && this.attackCooldown <= 0 && hasLOS){
      this.attackCooldown = this.def.attackCooldown || 1.8;
      const from = this.mesh.position.clone(); from.y += this.def.size*0.5;
      spawnEnemyProjectile(from, camera.position.clone(), this.def.damage * diffCfg.enemyDmgMult);
    } else if(!this.def.ranged && dist < attackRange && this.attackCooldown <= 0 && hasLOS){
      this.attackCooldown = this.def.attackCooldown || 1.0;
      takeDamage(this.def.damage * diffCfg.enemyDmgMult, this.mesh.position);
    }
    // Healer: pulse green healing into wounded allies (and itself)
    if(this.def.support){
      this._healTimer = (this._healTimer||0) - dt;
      if(this._healTimer <= 0){
        this._healTimer = this.def.healRate;
        let best = null, bestD = this.def.healRange;
        for(const e of enemies){
          if(e === this || !e.alive || e.dying) continue;
          const d = e.mesh.position.distanceTo(this.mesh.position);
          if(d < bestD && e.hp < e.maxHp){ best = e; bestD = d; }
        }
        const target = best || (this.hp < this.maxHp ? this : null);
        if(target){
          target.hp = Math.min(target.maxHp, target.hp + this.def.heal);
          target._lastHpDrawn = -1;
          for(let i=0;i<5;i++) spawnSpark(target.mesh.position.clone(), 0x55ffcc, 0.1);
        }
      }
    }
    const hasVision = dist < 22 && hasLOS;
    if(hasVision){
      this.state='PURSUE'; this.lastSeenPos={x:px,z:pz}; this.visionBlockedTime=0;
      if(this._alertTimer<=0 && allEnemies){
        for(const other of allEnemies){
          if(other===this||!other.alive||other.state==='PURSUE') continue;
          if(this.mesh.position.distanceTo(other.mesh.position)<8){other.state='ALERT';other.lastSeenPos={x:px,z:pz};other.visionBlockedTime=0;}
        }
        this._alertTimer=2;
      }
      if(this._alertTimer>0) this._alertTimer-=dt;
    } else {
      // Lost sight: keep chasing via A* for a while before giving up
      this.visionBlockedTime+=dt;
      if(this.state==='PURSUE'&&this.visionBlockedTime>6) this.state='LOST';
      if(this.state==='ALERT'&&this.visionBlockedTime>8) this.state='WANDER';
      if(this.state==='LOST'&&this.visionBlockedTime>12) this.state='WANDER';
      // Wandering enemies periodically pick up the player's trail (they can hear them)
      if(this.state==='WANDER'){
        this._wanderTime=(this._wanderTime||0)+dt;
        if(this._wanderTime>2.5){ this._wanderTime=0; this.state='LOST'; this.visionBlockedTime=0; this.lastSeenPos={x:px,z:pz}; }
      }
    }
    let speed = this.def.speed * diffCfg.enemySpeedMult;
    // Jumper: wind up, then hop forward in a burst
    if(this.def.leap){
      if(this._leapT > 0){ this._leapT -= dt; speed *= 3.0; }
      else {
        this._leapCd -= dt;
        if(this._leapCd <= 0 && (this.state==='PURSUE'||this.state==='LOST') && dist > 2.5){
          this._leapT = this.def.leap; this._leapCd = this.def.leapCd;
        }
      }
    }
    if(this.state==='PURSUE'||this.state==='LOST'||this.state==='ALERT'){
      // --- B* pathing: head for the player's real position when LOS is broken or we're wedged ---
      const oldX=this.mesh.position.x, oldZ=this.mesh.position.z;
      let usedPath = false;
      const stuckNow = (this._stuckTimer||0) > 0.35;
      if(!hasVision || stuckNow){
        if(stuckNow && this.repathTimer > 0.15) this.repathTimer = 0.15; // repath soon, but rate-limited
        this.repathTimer -= dt;
        if(this.repathTimer <= 0 || (!this.path && !this._pathFailed)){
          this.repathTimer = 0.45 + Math.random()*0.3;
          this.computePathTo(px, pz);
        }
      } else if(this.path){ this.path = null; } // clear path while we can beeline
      if(this.path && this.pathIndex < this.path.length){
        const wp = this.path[this.pathIndex];
        const wdx = wp.x - this.mesh.position.x, wdz = wp.z - this.mesh.position.z;
        const wl = Math.sqrt(wdx*wdx + wdz*wdz) + 0.001;
        if(wl < 0.6){ this.pathIndex++; }
        else { usedPath = true; this.move(wdx/wl, wdz/wl, speed*dt); }
        if(this.pathIndex >= this.path.length) this.path = null;
      }
      if(!usedPath){
        const target = this.lastSeenPos || {x:px,z:pz};
        const tdx=target.x-this.mesh.position.x, tdz=target.z-this.mesh.position.z;
        const tlen=Math.sqrt(tdx*tdx+tdz*tdz)+0.001;
        let flank=0;
        if(this.state==='PURSUE'&&allEnemies){
          const nearby=allEnemies.filter(e=>e!==this&&e.alive&&e.state==='PURSUE'&&e.mesh.position.distanceTo(this.mesh.position)<8).length;
          if(nearby>0){ flank=(this._flankDir||(Math.random()<0.5?1:-1))*(1.2+nearby*0.6); this._flankDir=flank>0?1:-1; }
        }
        const perpX=-tdz/tlen, perpZ=tdx/tlen;
        const ax=tdx/tlen+perpX*flank*0.4, az=tdz/tlen+perpZ*flank*0.4;
        const al=Math.sqrt(ax*ax+az*az)+0.001;
        if(this.def.ranged){
          if(dist<6) this.move(-ax/al,-az/al,speed*.8*dt);
          else if(dist>12) this.move(ax/al,az/al,speed*.8*dt);
          else{ const sx=perpX*(Math.sin(clock.elapsedTime*.7+this.mesh.position.x)>0?1:-1), sz=perpZ*(Math.sin(clock.elapsedTime*.7+this.mesh.position.x)>0?1:-1); this.move(sx,sz,speed*.5*dt); }
        } else if(dist>attackRange*.8){
          this.move(ax/al,az/al,speed*dt);
        } else { const cx=-tdz/tlen, cz=tdx/tlen; this.move(cx,cz,speed*.6*dt); }
      }
      // Stuck detection: repath handled above; give up entirely only if still wedged
      const moved=Math.abs(oldX-this.mesh.position.x)+Math.abs(oldZ-this.mesh.position.z);
      if(moved<0.01){ this._stuckTimer=(this._stuckTimer||0)+dt; }
      else{ this._stuckTimer=0; this._pathFailed=false; }
      if(this._stuckTimer>1.6){ this.state='WANDER'; this._stuckTimer=0; this.lastSeenPos=null; this.path=null; }
    } else {
      this.wanderTimer-=dt;
      if(this.wanderTimer<=0){this.wanderTarget={x:this.mesh.position.x+(Math.random()-.5)*20,z:this.mesh.position.z+(Math.random()-.5)*20};this.wanderTimer=1.2+Math.random()*1.8;}
      const wdx=this.wanderTarget.x-this.mesh.position.x, wdz=this.wanderTarget.z-this.mesh.position.z;
      const wl=Math.sqrt(wdx*wdx+wdz*wdz)+0.001;
      this.move(wdx/wl,wdz/wl,speed*.7*dt);
    }
    let hopY = 0;
    if(this.def.leap && this._leapT > 0) hopY = Math.sin((1 - this._leapT/this.def.leap) * Math.PI) * 0.9;
    this.mesh.position.y = this.def.size + 0.1 + Math.sin(clock.elapsedTime*4)*0.08 + hopY;
    if(this.def.kind==='boss'){ this.mesh.rotation.x += dt*0.5; this.mesh.rotation.z += dt*0.3; }
    this.updateHpBar();
  }
  // B* path to a world position; null path → caller falls back to direct steering
  computePathTo(tx, tz){
    this.path = null; this._pathFailed = false;
    if(!navReady || !this.navGrid) return;
    const grid = this.navGrid;
    const sIdx = findNearestOpenCell(grid, navIdxOf(this.mesh.position.x, this.mesh.position.z));
    const gIdx = findNearestOpenCell(grid, navIdxOf(tx, tz));
    if(sIdx < 0 || gIdx < 0 || sIdx === gIdx) return;
    const p = bstar(grid, sIdx, gIdx, 2500);
    if(p){ this.path = p; this.pathIndex = 0; }
    else this._pathFailed = true; // don't retry every frame when no route exists
  }
  move(ndx, ndz, step){
    const eSize = this.size*0.9;
    const nx = this.mesh.position.x + ndx*step, nz = this.mesh.position.z + ndz*step;
    // Full move
    _mvBox.min.set(nx-eSize+0.02, 0, nz-eSize+0.02);
    _mvBox.max.set(nx+eSize-0.02, 1.5, nz+eSize-0.02);
    let blocked = false;
    for(const col of wallColliders){ if(col && _mvBox.intersectsBox(col)){ blocked = true; break; } }
    if(!blocked){ this.mesh.position.x = nx; this.mesh.position.z = nz; return; }
    // Axis slide: try X-only then Z-only so enemies grind along walls toward waypoints
    _mvBox.min.set(nx-eSize+0.02, 0, this.mesh.position.z-eSize+0.02);
    _mvBox.max.set(nx+eSize-0.02, 1.5, this.mesh.position.z+eSize-0.02);
    blocked = false;
    for(const col of wallColliders){ if(col && _mvBox.intersectsBox(col)){ blocked = true; break; } }
    if(!blocked){ this.mesh.position.x = nx; return; }
    _mvBox.min.set(this.mesh.position.x-eSize+0.02, 0, nz-eSize+0.02);
    _mvBox.max.set(this.mesh.position.x+eSize-0.02, 1.5, nz+eSize-0.02);
    blocked = false;
    for(const col of wallColliders){ if(col && _mvBox.intersectsBox(col)){ blocked = true; break; } }
    if(!blocked){ this.mesh.position.z = nz; }
  }
  losBlocked(from, to){
    _losDir.subVectors(to, from);
    const len = Math.min(_losDir.length(), 18); _losDir.normalize();
    _losRC.set(from, _losDir, 0, len);
    return _losRC.intersectObjects(wallMeshes, false).length > 0;
  }
  applyBurn(dps, dur){
    if(!this.alive || this.dying) return;
    this._burnDps = Math.max(this._burnDps || 0, dps);
    this._burnT = Math.max(this._burnT || 0, dur);
  }
  takeDamage(dmg, headshot){
    if(!this.alive || this.dying) return;
    this.hp -= dmg;
    const mat = this.mesh.material;
    if(mat.emissive && !this._flashing){ this._flashing = true; this._flashTimer = 0.06; mat.emissive.setHex(0xffffff); }
    if(this.hp <= 0) this.die(headshot);
  }
  die(headshot){
    if(!this.alive || this.dying) return; // dying — never re-enter (tank explosion used to recurse infinitely)
    // Start ragdoll death animation instead of immediate removal
    this.dying = true; this.dyingTimer = 0.5; this.dyingStartY = this.mesh.position.y; this.dyingRotSpeed = {x:(Math.random()-0.5)*4, z:(Math.random()-0.5)*4};
    state.enemiesAlive = Math.max(0, state.enemiesAlive - 1); state.stats.kills++;
    // Achievement: First Blood
    if(state.stats.kills === 1) unlockAchievement('first_blood');
    // Kill streak tracking
    killStreakCount++; killStreakTimer = 3.0;
    if(killStreakCount >= 12 && lastKillStreakAnnounced < 4){ lastKillStreakAnnounced = 4; showKillStreak(I18n.t('killstreak.godlike')); }
    else if(killStreakCount >= 8 && lastKillStreakAnnounced < 3){ lastKillStreakAnnounced = 3; showKillStreak(I18n.t('killstreak.unstoppable')); }
    else if(killStreakCount >= 5 && lastKillStreakAnnounced < 2){ lastKillStreakAnnounced = 2; showKillStreak(I18n.t('killstreak.rampage')); }
    else if(killStreakCount >= 3 && lastKillStreakAnnounced < 1){ lastKillStreakAnnounced = 1; showKillStreak(I18n.t('killstreak.tripleKill')); }
    if(headshot) state.stats.headshots++;
    // Track wave headshots for achievement
    state.waveHeadshots++;
    state.combo++; state.comboTimer = 4.0 * (1 + comboBoost);
    if(state.combo > state.stats.bestCombo) state.stats.bestCombo = state.combo;
    const comboMult = 1 + Math.min(state.combo-1, 9) * 0.1;
    const diffCfg = DIFFICULTIES[difficulty];
    const gained = Math.round(this.def.scoreValue * comboMult * (headshot?1.5:1) * diffCfg.scoreMult);
    state.score += gained;
    state.credits += Math.round(this.def.scoreValue * 0.3);
    spawnScorePopup(this.mesh.position.clone(), headshot?`+${gained} HS`:`+${gained}`, headshot?'#fbbf24':'#ff8844');
    spawnBlood(this.mesh.position, this.def.color, this.def.size);
    const dropRoll = Math.random();
    // Tank explosion on death
    if(this.def.kind === 'tank'){
      const pos = this.mesh.position.clone();
      const expMesh = new THREE.Mesh(new THREE.SphereGeometry(3.5,20,20), new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));
      expMesh.position.copy(pos); scene.add(expMesh);
      explosions.push({mesh:expMesh, time:0, maxTime:.8});
      const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5,16,16), new THREE.MeshBasicMaterial({color:0xffff44,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));
      coreMesh.position.copy(pos); scene.add(coreMesh);
      explosions.push({mesh:coreMesh, time:0, maxTime:.4});
      const flashLight = new THREE.PointLight(0xff8800,20,25,1.5); flashLight.position.copy(pos); scene.add(flashLight);
      setTimeout(()=>{ if(flashLight.parent) scene.remove(flashLight); }, 400);
      const radius = 4.5;
      for(const en of enemies){ if(en !== this && en.alive && !en.dying && pos.distanceTo(en.mesh.position) < radius){ en.takeDamage(80 * damageMult, false); } }
      for(const other of explosiveBarrels){ if(!other.exploded && pos.distanceTo(other.pos) < radius){ setTimeout(()=>detonateBarrel(other), 80); } }
      if(pos.distanceTo(camera.position) < 3.5){ takeDamage(40, pos); }
      audio.explosion(); addShake(1.0);
      for(let i=0;i<15;i++) spawnSpark(pos.clone(), i%3===0?0xffff00:i%3===1?0xff6600:0xff3300, 0.18+Math.random()*0.18);
    }
    // Bomber detonation — chain-kills other bombers (die() re-entry is guarded above)
    if(this.def.bomb && !this._exploded){
      this._exploded = true;
      const pos = this.mesh.position.clone();
      const expMesh = new THREE.Mesh(new THREE.SphereGeometry(2.4,16,16), new THREE.MeshBasicMaterial({color:0xff7722,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));
      expMesh.position.copy(pos); scene.add(expMesh);
      explosions.push({mesh:expMesh, time:0, maxTime:.55});
      const bCore = new THREE.Mesh(new THREE.SphereGeometry(1.0,12,12), new THREE.MeshBasicMaterial({color:0xffff66,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));
      bCore.position.copy(pos); scene.add(bCore);
      explosions.push({mesh:bCore, time:0, maxTime:.3});
      const bLight = new THREE.PointLight(0xff8800,16,18,1.5); bLight.position.copy(pos); scene.add(bLight);
      setTimeout(()=>{ if(bLight.parent) scene.remove(bLight); }, 300);
      const bRadius = 4;
      // Scale with enemy HP so bombers chain-kill each other at any difficulty
      const bDmg = 120 * (DIFFICULTIES[difficulty]?.enemyHpMult || 1);
      for(const en of enemies){ if(en !== this && en.alive && !en.dying && pos.distanceTo(en.mesh.position) < bRadius){ en.takeDamage(bDmg, false); } }
      for(const other of explosiveBarrels){ if(!other.exploded && pos.distanceTo(other.pos) < bRadius){ setTimeout(()=>detonateBarrel(other), 60); } }
      const bDist = pos.distanceTo(camera.position);
      if(bDist < bRadius) takeDamage(Math.max(8, Math.round(55 * (1 - bDist/bRadius*0.55))), pos);
      audio.explosion(); addShake(0.7);
      for(let i=0;i<12;i++) spawnSpark(pos.clone(), i%2?0xff8800:0xffcc44, 0.14+Math.random()*0.14);
    }
    if(this.def.kind === 'boss'){
      state.score += 1000; state.credits += 500; bossKills++;
      spawnPickup(this.mesh.position.x, this.mesh.position.z, 'medkit');
      spawnPickup(this.mesh.position.x+1, this.mesh.position.z, 'ammo');
      spawnPowerup(this.mesh.position.x-1, this.mesh.position.z);
      audio.bossDeath(); state.bossActive=false; bossRef=null;
      toast(I18n.t('toast.bossDefeated'),'success'); addShake(1.2);
    } else if(dropRoll < 0.2+luckBoost){ spawnPickup(this.mesh.position.x, this.mesh.position.z, 'medkit'); }
    else if(dropRoll < 0.35+luckBoost){ spawnPickup(this.mesh.position.x, this.mesh.position.z, 'ammo'); }
    else if(dropRoll < 0.50+luckBoost){ spawnPickup(this.mesh.position.x, this.mesh.position.z, 'grenade_black'); }
    else if(dropRoll < 0.57+luckBoost){ spawnPowerup(this.mesh.position.x, this.mesh.position.z); }
    audio.enemyDeath();
    // Splitter: burst into swarmlings before the wave-complete check below
    if(this.def.split){
      for(let i=0;i<this.def.split;i++){
        const child = new Enemy(
          this.mesh.position.x + (Math.random()-.5)*1.8,
          this.mesh.position.z + (Math.random()-.5)*1.8,
          'swarmling', state.wave
        );
        // Nudge out of geometry so babies never spawn inside a wall
        for(let t=0;t<5;t++){
          const cb = new THREE.Box3(
            new THREE.Vector3(child.mesh.position.x-child.size, 0, child.mesh.position.z-child.size),
            new THREE.Vector3(child.mesh.position.x+child.size, 1.2, child.mesh.position.z+child.size)
          );
          let stuck = false;
          for(const col of wallColliders){ if(col && cb.intersectsBox(col)){ stuck = true; break; } }
          if(!stuck) break;
          child.mesh.position.set(this.mesh.position.x+(Math.random()-.5)*3, child.def.size+0.1, this.mesh.position.z+(Math.random()-.5)*3);
        }
        enemies.push(child);
        state.enemiesAlive++; state.enemiesTotal++;
      }
      for(let i=0;i<8;i++) spawnSpark(this.mesh.position.clone(), 0x88ff55, 0.12+Math.random()*0.1);
    }
    // Only complete wave when all enemies have spawned AND all are dead
    if(state.enemiesAlive <= 0 && spawnQueue.length === 0 && enemies.filter(e=>e.alive && !e.dying).length === 0 && waveActive) completeWave();
  }
  updateHpBar(){
    if(!this.barCtx || !this.barSprite) return;
    // Redraw the bar canvas only when HP actually changed (was every frame per enemy)
    if(this._lastHpDrawn === this.hp) return;
    this._lastHpDrawn = this.hp;
    const ctx=this.barCtx, w=64, h=8;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,0,w,h);
    const ratio = Math.max(0, this.hp/this.maxHp);
    ctx.fillStyle = ratio>0.5?'#44cc44':ratio>0.25?'#cccc44':'#cc4444';
    ctx.fillRect(1,1,Math.max(0,(w-2)*ratio),h-2);
    this.barSprite.material.map.needsUpdate = true;
  }
}

// spawnEnemyProjectile defined below (pooled version) — duplicate removed
