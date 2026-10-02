// ============================================================================
// EFFECTS — particles, tracers, decals, dust, popups
// ============================================================================
// Particles / tracers / decals
let particles=[], tracers=[], explosions=[], projectiles=[], scorePopups=[];
// Shared geometries + grow-on-demand pool acquire (fallback meshes join the pool for reuse)
const _particleGeoShared = new THREE.SphereGeometry(0.08,4,4);
const _projectileGeoShared = new THREE.SphereGeometry(0.18,8,8);
const _tracerGeoShared = new THREE.CylinderGeometry(0.01,0.01,1,4);
function acquirePooledMesh(pool, geo, color){
  for(let i=0;i<pool.length;i++){ const m=pool[i]; if(!m.visible){ if(!m.parent) scene.add(m); return m; } }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
  m.visible=false; scene.add(m); pool.push(m);
  return m;
}
function showKillStreak(text){
  const el = document.getElementById('streak-msg');
  if(!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  setTimeout(()=>{ el.style.opacity = '0'; }, 2000);
}

function spawnSpark(pos, color, size){
  const mesh = acquirePooledMesh(particlePool, _particleGeoShared, 0xffffff);
  mesh.material.color.setHex(color);
  mesh.scale.setScalar(size/0.08);
  mesh.position.copy(pos); mesh.visible=true;
  particles.push({mesh, vx:(Math.random()-.5)*3, vy:Math.random()*2, vz:(Math.random()-.5)*3, life:.3, maxLife:.3, gravity:true, fromPool:true});
}
function spawnBlood(pos, color, size){
  for(let i=0;i<10;i++){
    const mesh = acquirePooledMesh(particlePool, _particleGeoShared, 0xffffff);
    mesh.material.color.setHex(color);
    mesh.scale.setScalar((size*0.14)/0.08);
    mesh.position.copy(pos); mesh.visible=true;
    particles.push({mesh, vx:(Math.random()-.5)*6, vy:Math.random()*4, vz:(Math.random()-.5)*6, life:.6, maxLife:.6, gravity:true, fromPool:true});
  }
}
// Flamethrower cone — pooled particles drifting forward, no gravity
const _flameV = new THREE.Vector3();
function spawnFlame(origin, dir, count){
  for(let i=0;i<count;i++){
    const mesh = acquirePooledMesh(particlePool, _particleGeoShared, 0xffffff);
    mesh.material.color.setHex(Math.random()<0.5 ? 0xff7722 : 0xffcc33);
    mesh.scale.setScalar((0.10 + Math.random()*0.12)/0.08);
    const d = 0.4 + i*1.1 + Math.random()*0.6;
    mesh.position.copy(origin).addScaledVector(dir, d);
    mesh.position.x += (Math.random()-.5)*0.5; mesh.position.y += (Math.random()-.5)*0.5; mesh.position.z += (Math.random()-.5)*0.5;
    mesh.visible = true;
    _flameV.copy(dir).multiplyScalar(2.5);
    particles.push({mesh, vx:_flameV.x+(Math.random()-.5)*1.5, vy:_flameV.y+1.2, vz:_flameV.z+(Math.random()-.5)*1.5,
      life:.3+Math.random()*.2, maxLife:.5, gravity:false, fromPool:true});
  }
}
// Chain-lightning arcs — fixed-point buffers reused from a small pool
const _LT_SEGS = 6, _LT_PTS = _LT_SEGS + 1;
const lightningPool = [];
let lightnings = [];
function spawnLightning(from, to){
  let line = null;
  for(const l of lightningPool){ if(!l.visible){ line = l; break; } }
  if(!line){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(_LT_PTS*3), 3));
    const mat = new THREE.LineBasicMaterial({color:0x88eeff, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false});
    line = new THREE.Line(geo, mat); line.frustumCulled = false; line.visible = false;
    scene.add(line); lightningPool.push(line);
  }
  const arr = line.geometry.attributes.position.array;
  for(let i=0;i<_LT_PTS;i++){
    const t = i/_LT_SEGS;
    let x = from.x + (to.x-from.x)*t, y = from.y + (to.y-from.y)*t, z = from.z + (to.z-from.z)*t;
    if(i>0 && i<_LT_SEGS){ x += (Math.random()-.5)*0.55; y += (Math.random()-.5)*0.55; z += (Math.random()-.5)*0.55; }
    arr[i*3]=x; arr[i*3+1]=y; arr[i*3+2]=z;
  }
  line.geometry.attributes.position.needsUpdate = true;
  line.visible = true; line.material.opacity = 1;
  lightnings.push({line, life:0.15, maxLife:0.15});
}
function updateLightnings(dt){
  for(let i=lightnings.length-1; i>=0; i--){
    const l = lightnings[i]; l.life -= dt;
    if(l.life <= 0){ l.line.visible = false; lightnings.splice(i,1); continue; }
    l.line.material.opacity = l.life / l.maxLife;
  }
}
const _tracerUp = new THREE.Vector3(0,1,0), _tracerDir = new THREE.Vector3();
function spawnTracer(from, to){
  // Pooled tracer mesh oriented/scaled via transform — writing individual vertices
  // of the shared cylinder used to corrupt geometry and break frustum culling.
  const mesh = acquirePooledMesh(tracerPool, _tracerGeoShared, 0xffdd66);
  _tracerDir.subVectors(to, from);
  const len = _tracerDir.length();
  if(len < 0.01){ mesh.visible = false; return; }
  mesh.position.copy(from).addScaledVector(_tracerDir, 0.5);
  mesh.quaternion.setFromUnitVectors(_tracerUp, _tracerDir.normalize());
  mesh.scale.set(1, len, 1);
  mesh.frustumCulled = false;
  mesh.visible = true;
  tracers.push({mesh, time:0, maxTime:.08, fromPool:true});
}
// Decals share one geometry/material; evicted ones are removed from scene
let _decalGeo = null, _decalMat = null;
const _decals = [];
const _decalLook = new THREE.Vector3();
function spawnDecal(pos, normal){
  if(!_decalGeo){
    _decalGeo = new THREE.CircleGeometry(0.06,8);
    _decalMat = new THREE.MeshBasicMaterial({color:0x1a1a1a,transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
  }
  const m = new THREE.Mesh(_decalGeo, _decalMat);
  m.position.copy(pos).addScaledVector(normal, 0.01);
  _decalLook.copy(pos).add(normal);
  m.lookAt(_decalLook);
  m.raycast = function(){}; // decals don't block bullets
  scene.add(m);
  _decals.push(m);
  if(_decals.length > 60){ const old = _decals.shift(); if(old.parent) scene.remove(old); }
}
// Floating text sprites — texture cache + sprite pool (was: new canvas+texture+sprite on every hit)
const _textTexCache = new Map();
const _textSpritePool = [];
function acquireTextSprite(text, color, font, cw, ch){
  const key = text + '|' + color + '|' + font;
  let tex = _textTexCache.get(key);
  if(!tex){
    const c = document.createElement('canvas'); c.width=cw; c.height=ch;
    const ctx = c.getContext('2d'); ctx.font=font; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.85)'; ctx.shadowBlur=5; ctx.fillStyle=color;
    ctx.fillText(text, cw/2, ch/2);
    tex = new THREE.CanvasTexture(c);
    _textTexCache.set(key, tex);
    if(_textTexCache.size > 384){ const oldest = _textTexCache.keys().next().value; const t = _textTexCache.get(oldest); _textTexCache.delete(oldest); if(t) t.dispose(); }
  }
  let sprite = _textSpritePool.pop();
  if(!sprite) sprite = new THREE.Sprite(new THREE.SpriteMaterial({transparent:true, depthTest:false}));
  sprite.material.map = tex;
  sprite.material.opacity = 1;
  sprite.visible = true;
  return sprite;
}
function spawnScorePopup(pos, text, color){
  const sprite = acquireTextSprite(text, color, 'bold 28px Arial', 128, 48);
  sprite.position.copy(pos); sprite.position.y += 1.2; sprite.scale.set(1.2,0.45,1);
  scene.add(sprite); scorePopups.push({mesh:sprite, life:1.2, maxLife:1.2, vy:1.5, pooled:true});
}
function spawnDamageNumber(pos, dmg, headshot){
  const sprite = acquireTextSprite(headshot?`${dmg}!`:`${dmg}`, headshot?'#fbbf24':'#ffffff', 'bold 24px Arial', 96, 40);
  sprite.position.copy(pos); sprite.scale.set(0.7,0.3,1);
  scene.add(sprite); scorePopups.push({mesh:sprite, life:.7, maxLife:.7, vy:2.2, pooled:true});
}

// Dust particles — atmospheric, varied colors
const dustCount = 80;
const dustPos = new Float32Array(dustCount*3);
const dustColors = new Float32Array(dustCount*3);
for(let i=0;i<dustCount;i++){
  dustPos[i*3]=(Math.random()-.5)*70; dustPos[i*3+1]=Math.random()*5; dustPos[i*3+2]=(Math.random()-.5)*70;
  // Color varies: warm gold-orange range
  dustColors[i*3]=0.8+Math.random()*0.2; dustColors[i*3+1]=0.55+Math.random()*0.3; dustColors[i*3+2]=0.2+Math.random()*0.2;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
const dustMat = new THREE.PointsMaterial({size:0.06, vertexColors:true, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false});
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);
let _dustFrame = 0;
let _hudFrame = 0;
function updateDust(dt){
  _dustFrame++;
  if(_dustFrame % 2 !== 0) return;
  const pos = dust.geometry.attributes.position;
  const arr = pos.array;
  for(let i=0;i<arr.length;i+=3){
    arr[i+1] += dt*0.25*(0.5+Math.sin(i*0.7)*0.5);
    if(arr[i+1]>5) arr[i+1]=0;
    arr[i] += Math.sin(clock.elapsedTime*0.3+i)*dt*0.08;
    arr[i+2] += Math.cos(clock.elapsedTime*0.3+i)*dt*0.06;
  }
  pos.needsUpdate = true;
}
function updateParticles(dt){
  for(let i=particles.length-1; i>=0; i--){
    const p = particles[i]; p.life -= dt;
    if(p.life <= 0){
      if(p.fromPool) p.mesh.visible=false; else scene.remove(p.mesh);
      particles.splice(i,1); continue;
    }
    if(p.gravity) p.vy -= 9.8*dt;
    p.mesh.position.x += p.vx*dt; p.mesh.position.y += p.vy*dt; p.mesh.position.z += p.vz*dt;
    p.mesh.material.opacity = p.life / p.maxLife;
  }
  for(let i=tracers.length-1; i>=0; i--){
    const t = tracers[i]; t.time += dt;
    if(t.time >= t.maxTime){ 
      if(t.fromPool) t.mesh.visible=false; else scene.remove(t.mesh); 
      tracers.splice(i,1); continue; 
    }
    t.mesh.material.opacity = 1 - t.time/t.maxTime;
  }
  for(let i=explosions.length-1; i>=0; i--){
    const ex = explosions[i]; ex.time += dt;
    if(ex.time >= ex.maxTime){ scene.remove(ex.mesh); explosions.splice(i,1); continue; }
    const p = ex.time/ex.maxTime, s = 1+p*3; ex.mesh.scale.set(s,s,s); ex.mesh.material.opacity = 1-p;
  }
  updateLightnings(dt);
}
function updateScorePopups(dt){
  for(let i=scorePopups.length-1; i>=0; i--){
    const p = scorePopups[i]; p.life -= dt;
    if(p.life <= 0){
      scene.remove(p.mesh);
      if(p.pooled){ p.mesh.visible=false; _textSpritePool.push(p.mesh); }
      scorePopups.splice(i,1); continue;
    }
    p.mesh.position.y += p.vy * dt; p.vy *= 0.96;
    p.mesh.material.opacity = Math.min(1, p.life/0.4);
  }
}
