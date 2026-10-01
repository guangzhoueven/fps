// ============================================================================
// HUD — HUD, minimap, overlays, killfeed, crosshair
// ============================================================================
// ============================================================================
// HUD UPDATE
// ============================================================================
function pad(n, len=2){ return String(Math.max(0, Math.floor(n))).padStart(len, '0'); }
function toast(msg, variant='info'){
  const c = document.getElementById('toasts');
  const t = document.createElement('div'); t.className = 'toast ' + variant; t.textContent = msg;
  c.appendChild(t); setTimeout(()=>t.remove(), 3200);
}
// Toast with an action button (longer-lived)
function toastAction(msg, btnLabel, cb, variant='info'){
  const c = document.getElementById('toasts');
  const t = document.createElement('div'); t.className = 'toast toast-action ' + variant;
  const s = document.createElement('span'); s.textContent = msg;
  const b = document.createElement('button'); b.className = 'toast-act'; b.textContent = btnLabel;
  b.addEventListener('click', ()=>{ t.remove(); try{ cb(); }catch(e){} });
  t.appendChild(s); t.appendChild(b);
  c.appendChild(t); setTimeout(()=>t.remove(), 10000);
  return t;
}
// Minimap
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas ? mmCanvas.getContext('2d') : null;
const _MM_COLORS = {boss:'#ff2222', brute:'#aa44cc', shooter:'#22aacc', runner:'#ddaa22', bomber:'#ff7722', splitter:'#66bb44', healer:'#55eebb', jumper:'#ff55aa', swarmling:'#aaee44'};
const _MM_DEFAULT_COLOR = '#cc3333';
// Wall rects in world space — rebuilt only when wallMeshes changes
let _wallRects = null;
function _getWallRects(){
  if(_wallRects && _wallRects.length === wallMeshes.length) return _wallRects;
  const rects = [];
  for(const w of wallMeshes){
    if(!w.geometry.boundingBox) w.geometry.computeBoundingBox();
    const bb = w.geometry.boundingBox; if(!bb) continue;
    rects.push({x:(bb.min.x+bb.max.x)/2, z:(bb.min.z+bb.max.z)/2, w:bb.max.x-bb.min.x, h:bb.max.z-bb.min.z});
  }
  _wallRects = rects;
  return rects;
}
function drawMinimap(){
  if(!mmCtx) return;
  const W=150, sc=2.2, HALF=W/2, CULL2=130*130;
  const ox=HALF - camera.position.x*sc, oz=HALF - camera.position.z*sc;
  mmCtx.setTransform(1,0,0,1,0,0);
  mmCtx.clearRect(0,0,W,W);
  mmCtx.fillStyle='rgba(20,16,10,.5)'; mmCtx.fillRect(0,0,W,W);
  // World layer — rotates with view so the player arrow always points up
  mmCtx.save();
  mmCtx.translate(HALF, HALF);
  mmCtx.rotate(yaw);
  mmCtx.translate(-HALF, -HALF);
  // Grid — one path, one stroke
  mmCtx.strokeStyle='rgba(249,115,22,.06)'; mmCtx.lineWidth=1;
  mmCtx.beginPath();
  for(let i=0;i<=W;i+=20){ mmCtx.moveTo(i,0); mmCtx.lineTo(i,W); mmCtx.moveTo(0,i); mmCtx.lineTo(W,i); }
  mmCtx.stroke();
  // Rooms — one path, one stroke
  mmCtx.strokeStyle='rgba(249,115,22,.3)'; mmCtx.lineWidth=1.5;
  mmCtx.beginPath();
  for(const rm of ROOMS) mmCtx.rect(rm.x*sc+ox-rm.w*sc/2, rm.z*sc+oz-rm.d*sc/2, rm.w*sc, rm.d*sc);
  mmCtx.stroke();
  // Walls — one path, one fill
  mmCtx.fillStyle='rgba(180,150,100,.4)';
  mmCtx.beginPath();
  for(const r of _getWallRects()){
    const wx=r.x*sc+ox, wz=r.z*sc+oz;
    const dx=wx-HALF, dz=wz-HALF;
    if(dx*dx+dz*dz > CULL2) continue;
    const ww=r.w*sc, wh=r.h*sc;
    mmCtx.rect(wx-ww/2, wz-wh/2, ww>1?ww:1, wh>1?wh:1);
  }
  mmCtx.fill();
  // Pickups
  for(const pk of pickups){
    const px=pk.mesh.position.x*sc+ox, pz=pk.mesh.position.z*sc+oz;
    const dx=px-HALF, dz=pz-HALF;
    if(dx*dx+dz*dz > CULL2) continue;
    let color='#44cc44';
    if(pk.type==='ammo') color='#ff8800'; else if(pk.type==='grenade'||pk.type==='grenade_black') color='#66cc44'; else if(pk.type==='armor') color='#4488ff'; else if(pk.type==='crate') color='#daa520'; else if(pk.type==='powerup') color='#ff44ff';
    mmCtx.fillStyle=color; mmCtx.beginPath(); mmCtx.arc(px,pz,2.5,0,7); mmCtx.fill();
  }
  // Enemies
  for(const e of enemies){
    if(!e.alive) continue;
    const ex=e.mesh.position.x*sc+ox, ez=e.mesh.position.z*sc+oz;
    const dx=ex-HALF, dz=ez-HALF;
    if(dx*dx+dz*dz > CULL2) continue;
    mmCtx.fillStyle = _MM_COLORS[e.def.kind] || _MM_DEFAULT_COLOR;
    const r = e.def.kind==='boss'?5:e.def.kind==='brute'?3.5:2.5;
    mmCtx.beginPath(); mmCtx.arc(ex,ez,r,0,7); mmCtx.fill();
  }
  mmCtx.restore();
  // Player triangle — fixed, always pointing up (forward); cheap glow, no shadowBlur
  mmCtx.save(); mmCtx.translate(HALF,HALF);
  mmCtx.fillStyle='rgba(251,191,36,0.2)';
  mmCtx.beginPath(); mmCtx.arc(0,0,9,0,7); mmCtx.fill();
  mmCtx.fillStyle='#fbbf24';
  mmCtx.beginPath(); mmCtx.moveTo(0,-6); mmCtx.lineTo(-4,4); mmCtx.lineTo(0,2); mmCtx.lineTo(4,4); mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
  // Border
  mmCtx.strokeStyle='rgba(249,115,22,.3)'; mmCtx.lineWidth=1; mmCtx.strokeRect(.5,.5,W-1,W-1);
}

// Cached HUD element references — avoid ~30 getElementById calls per update
const HUD = {};
(function cacheHudEls(){
  const ids = ['s-score','s-credits','s-combo','w-num','w-host','wave-bar-fill','hp-val','hp-fill','ar-val','armor-fill','st-val','stam-fill','vignette','a-name','a-cur','a-res','a-extra','reload-bar','reload-bar-fill','hotbar','boss-bar','bb-name','bb-fill','objective','obj-text','obj-rw','obj-prog','obj-pn','obj-fill','powerups'];
  for(const id of ids) HUD[id] = document.getElementById(id);
})();
let _hbSig='', _puSig='', _ammoSig='', _objSig='';
function invLabel(s){
  if(!s || !s.type) return (s && s.label) || '';
  if(WEAPONS[s.type]) return I18n.t('weapon.' + s.type);
  return I18n.t('item.' + s.type);
}
function invalidateHudCache(){ _hbSig=''; _ammoSig=''; _objSig=''; _puSig=''; }
function updateHUD(){
  // Sync powerup snapshot here (every HUD tick) instead of every frame
  state.powerups = activePowerups.map(p=>({id:p.id, label:p.label, icon:p.icon, remaining:p.remaining}));
  // Stats
  HUD['s-score'].textContent = state.score.toLocaleString();
  HUD['s-credits'].textContent = state.credits;
  const comboMult = 1 + state.combo * 0.1;
  HUD['s-combo'].textContent = `×${comboMult.toFixed(2)}`;
  // Wave
  HUD['w-num'].textContent = pad(state.wave);
  HUD['w-host'].textContent = `${state.enemiesAlive}/${state.enemiesTotal}`;
  const killed = state.enemiesTotal - state.enemiesAlive;
  const frac = state.enemiesTotal > 0 ? killed / state.enemiesTotal : 0;
  HUD['wave-bar-fill'].style.width = `${frac*100}%`;
  // Vitals
  HUD['hp-val'].textContent = `${Math.ceil(state.hp)}/${state.maxHp}`;
  HUD['hp-fill'].style.width = `${(state.hp/state.maxHp)*100}%`;
  HUD['ar-val'].textContent = `${Math.ceil(state.armor)}/${state.maxArmor}`;
  HUD['armor-fill'].style.width = `${(state.armor/state.maxArmor)*100}%`;
  HUD['st-val'].textContent = Math.round(state.stamina);
  HUD['stam-fill'].style.width = `${(state.stamina/state.maxStamina)*100}%`;
  // Low HP vignette
  HUD['vignette'].style.display = (state.hp < 30 && state.hp > 0) ? 'block' : 'none';
  // Reload progress (computed before the ammo panel reads it)
  if(state.reloading && reloadDuration > 0){
    const elapsed = performance.now() - reloadStartTime;
    state.reloadProgress = {active:true, progress: Math.min(1, elapsed/reloadDuration)};
  } else {
    state.reloadProgress = {active:false, progress:0};
  }
  // Ammo panel — innerHTML only when state changes
  const sel = state.inventory[state.selectedSlot];
  const isWeapon = sel && WEAPONS[sel.type];
  const ammoSig = `${state.selectedSlot}|${state.reloading?1:0}|${state.ammo}|${state.reserve}|${sel?sel.type:''}|${sel&&sel.count!=null?sel.count:''}`;
  if(ammoSig !== _ammoSig){
    _ammoSig = ammoSig;
    HUD['a-name'].textContent = invLabel(sel) || '—';
    if(state.reloading){
      HUD['a-cur'].textContent = I18n.t('ammo.reloading');
      HUD['a-res'].textContent = '';
      HUD['a-extra'].innerHTML = '<div class="rl">' + I18n.t('ammo.reloading') + '</div>';
      HUD['reload-bar'].style.display = 'block';
    } else {
      HUD['reload-bar'].style.display = 'none';
      if(isWeapon){
        HUD['a-cur'].textContent = pad(state.ammo);
        HUD['a-res'].textContent = state.reserve;
        let extra = '';
        if(state.ammo === 0 && state.reserve > 0) extra = '<div class="empty">' + I18n.t('ammo.pressRToReload') + '</div>';
        else if(state.ammo === 0 && state.reserve === 0) extra = '<div class="empty">' + I18n.t('ammo.depleted') + '</div>';
        else if(state.lowAmmo) extra = '<div class="low">' + I18n.t('ammo.low') + '</div>';
        else extra = `<div style="font-size:9px;color:rgba(255,255,255,.4)">(${WEAPONS[sel.type].auto ? I18n.t('ammo.fullAuto') : I18n.t('ammo.semiAuto')})</div>`;
        HUD['a-extra'].innerHTML = extra;
      } else {
        HUD['a-cur'].textContent = sel&&sel.count!=null ? sel.count : 0;
        HUD['a-res'].textContent = '';
        HUD['a-extra'].innerHTML = '';
      }
    }
  }
  // Reload bar fill — cheap width update every tick
  HUD['reload-bar-fill'].style.width = `${state.reloadProgress.progress*100}%`;
  // Hotbar — rebuild only when contents/selection/counts change
  const hbSig = state.inventory.map((s,i)=>`${i}:${s.type}:${s.count!=null?s.count:''}:${i===state.selectedSlot?1:0}`).join('|');
  if(hbSig !== _hbSig){
    _hbSig = hbSig;
    const hb = HUD['hotbar']; hb.innerHTML = '';
    state.inventory.forEach((s, i)=>{
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === state.selectedSlot ? ' active' : '');
      let cs = s.count != null ? ` <span class="cnt">×${s.count}</span>` : '';
      slot.innerHTML = `<span class="icon">${s.icon||'—'}</span><span class="lbl">${invLabel(s)}${cs}</span><span class="num">${i+1}</span>`;
      hb.appendChild(slot);
    });
  }
  // Boss bar
  if(state.bossActive && bossRef && bossRef.alive){
    HUD['boss-bar'].style.display = 'block';
    HUD['bb-name'].textContent = I18n.t('enemy.' + state.bossName);
    HUD['bb-fill'].style.width = `${(bossRef.hp/bossRef.maxHp)*100}%`;
  } else {
    HUD['boss-bar'].style.display = 'none';
  }
  // Objective — innerHTML only on change
  const obj = state.objective;
  const objEl = HUD['objective'];
  if(obj){
    objEl.style.display = 'block';
    const os = `${obj.def.id}|${obj.completed?1:0}|${Math.min(obj.progress,obj.goal)}`;
    if(os !== _objSig){
      _objSig = os;
      objEl.classList.toggle('done', obj.completed);
      HUD['obj-text'].innerHTML = `${obj.def.icon} ${I18n.t('objective.'+obj.def.id)}`;
      HUD['obj-rw'].textContent = `+${obj.def.reward}🪙`;
    }
    if(obj.goal > 1 && !obj.completed){
      HUD['obj-prog'].style.display = 'block';
      HUD['obj-pn'].textContent = `${Math.min(obj.progress, obj.goal)}/${obj.goal}`;
      HUD['obj-fill'].style.width = `${Math.min(100, (obj.progress/obj.goal)*100)}%`;
    } else {
      HUD['obj-prog'].style.display = 'none';
    }
  } else { objEl.style.display = 'none'; _objSig=''; }
  // Powerups — rebuild only on change (0.25s granularity for the timer bar)
  const puSig = state.powerups.map(p=>`${p.id}:${Math.round(p.remaining*4)}`).join('|');
  if(puSig !== _puSig){
    _puSig = puSig;
    const puEl = HUD['powerups']; puEl.innerHTML = '';
    state.powerups.forEach(p=>{
      const div = document.createElement('div'); div.className = 'pu';
      div.style.borderColor = p.id==='speed'?'#44ddff':p.id==='damage'?'#ff4422':p.id==='rapid'?'#ffaa00':'#ffee88';
      div.innerHTML = `<span class="picon">${p.icon}</span><span>${I18n.t('powerup.'+p.id)}</span><span class="ptimer"><span class="ptimer-fill" style="width:${Math.max(0,p.remaining/12)*100}%;background:${div.style.borderColor}"></span></span>`;
      puEl.appendChild(div);
    });
  }
}

// ============================================================================
// WAVE ANNOUNCEMENT
// ============================================================================
function showWaveAnnouncement(){
  const el = document.getElementById('wave-announce');
  document.getElementById('wa-wave').textContent = I18n.tf('wave.nextWave', state.wave + 1);
  document.getElementById('wa-count').textContent = Math.ceil(state.waveCountdown);
  el.style.display = 'block';
}
function hideWaveAnnouncement(){ document.getElementById('wave-announce').style.display = 'none'; }

// ============================================================================
// BOSS INTRO
// ============================================================================
function showBossIntro(){
  const el = document.getElementById('boss-intro');
  document.getElementById('bi-name').textContent = I18n.t('enemy.' + state.bossName);
  el.style.display = 'flex';
  setTimeout(()=>el.style.display='none', 2600);
}

// ============================================================================
// GAME OVER
// ============================================================================
function showGameOver(){
  const el = document.getElementById('game-over');
  const acc = state.stats.shotsFired > 0 ? Math.round((state.stats.shotsHit/state.stats.shotsFired)*100) : 0;
  const stats = [
    [I18n.t('gameOver.waveReached'), state.wave], [I18n.t('gameOver.wavesSurvived'), state.stats.wavesSurvived],
    [I18n.t('gameOver.score'), state.score.toLocaleString()], [I18n.t('gameOver.kills'), state.stats.kills],
    [I18n.t('gameOver.headshots'), state.stats.headshots], [I18n.t('gameOver.accuracy'), `${acc}%`],
    [I18n.t('gameOver.damageDealt'), Math.round(state.stats.damageDealt).toLocaleString()],
    [I18n.t('gameOver.damageTaken'), Math.round(state.stats.damageTaken).toLocaleString()],
    [I18n.t('gameOver.bestCombo'), `×${state.stats.bestCombo}`],
  ];
  document.getElementById('go-stats').innerHTML = stats.map(([l,v])=>`<div class="go-stat"><div class="gl">${l}</div><div class="gv">${v}</div></div>`).join('');
  el.style.display = 'flex';
}

// ============================================================================
// KILL FEED
// ============================================================================
function addKillFeed(text, icon){
  const kf = document.getElementById('killfeed');
  const e = document.createElement('div'); e.className = 'kf';
  e.innerHTML = `<span class="ki">${icon}</span><span class="kt">${text}</span>`;
  kf.appendChild(e);
  while(kf.children.length > 5) kf.removeChild(kf.firstChild);
  setTimeout(()=>{ if(e.parentElement) e.remove(); }, 5000);
}

// Crosshair style per weapon
function updateCrosshairStyle(){
  const ch = document.getElementById('crosshair');
  if(!ch) return;
  ch.className = '';
  const sel = state.inventory[state.selectedSlot];
  if(!sel){ ch.className='cr-pistol'; return; }
  if(sel.type === 'grenade'){ ch.className='cr-grenade'; if(adsActive) ch.classList.add('ads'); return; }
  if(sel.type === 'medkit'){ ch.className='cr-medkit'; return; }
  if(WEAPONS[sel.type]){
    const w = WEAPONS[sel.type];
    if(w.id === 'shotgun') ch.className = 'cr-shotgun';
    else if(w.id === 'sniper') ch.className = 'cr-sniper';
    else if(w.id === 'smg') ch.className = 'cr-smg';
    else if(w.id === 'rifle') ch.className = 'cr-rifle';
    else ch.className = 'cr-pistol';
  } else { ch.className = 'cr-pistol'; }
}
