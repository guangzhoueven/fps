// ============================================================================
// CONFIG — constants, defs, game state, settings
// ============================================================================
// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================
// Randomly placed buildings — generated at init
let ROOMS = [];
function generateRoomLayout(){
  const rooms = [];
  const minDist = 12; // minimum distance between room centers
  const attempts = 80;
  const range = 36; // wider spread
  for(let i=0; i<attempts && rooms.length < 7; i++){
    const x = (Math.random()-.5) * range * 2;
    const z = (Math.random()-.5) * range * 2;
    if(Math.sqrt(x*x+z*z) < 8) continue; // keep away from spawn
    let ok = true;
    for(const r of rooms){
      if(Math.sqrt((x-r.x)**2 + (z-r.z)**2) < minDist){ ok = false; break; }
    }
    if(ok) rooms.push({id: rooms.length, x, z, w:8, d:8});
  }
  if(rooms.length < 4){
    const fb = [{x:-14,z:-14},{x:14,z:-14},{x:-14,z:14},{x:14,z:14},{x:0,z:-22},{x:0,z:22},{x:-22,z:0},{x:22,z:0}];
    for(const f of fb){
      if(rooms.length >= 7) break;
      let ok = true;
      for(const r of rooms){ if(Math.sqrt((f.x-r.x)**2+(f.z-r.z)**2) < minDist){ ok=false; break; } }
      if(ok) rooms.push({id: rooms.length, x:f.x, z:f.z, w:8, d:8});
    }
  }
  ROOMS = rooms;
}

// ADS state
let adsActive = false;
let currentFOV = 75;
const BASE_FOV = 75;

// Sniper scope — magnification levels and per-level mouse sensitivity factor
const SCOPE_ZOOMS = [4, 8, 16];
const SCOPE_SENS = [0.5, 0.35, 0.22];
let scopeZoomIdx = 0;
function isScoped(){
  const sel = state.inventory[state.selectedSlot];
  return adsActive && !!sel && sel.type === 'sniper';
}
function fovForZoom(z){
  const base = (settings.fov || BASE_FOV) * Math.PI / 180;
  return 2 * Math.atan(Math.tan(base / 2) / z) * 180 / Math.PI;
}

const WEAPONS = {
  pistol:{id:'pistol',name:'pistol',icon:'🔫',damage:22,magSize:12,reserveMax:96,fireRate:0.28,reloadTime:1.0,spread:0.008,pellets:1,auto:false,range:60,recoil:0.012,price:0,color:0x4a4a4a},
  smg:{id:'smg',name:'smg',icon:'🔫',damage:16,magSize:30,reserveMax:240,fireRate:0.07,reloadTime:1.4,spread:0.025,pellets:1,auto:true,range:50,recoil:0.008,price:600,color:0x2a2a2a},
  shotgun:{id:'shotgun',name:'shotgun',icon:'💥',damage:14,magSize:6,reserveMax:48,fireRate:0.7,reloadTime:2.0,spread:0.09,pellets:8,auto:false,range:25,recoil:0.04,price:900,color:0x5a3a1a},
  rifle:{id:'rifle',name:'rifle',icon:'🪖',damage:28,magSize:30,reserveMax:210,fireRate:0.1,reloadTime:1.8,spread:0.014,pellets:1,auto:true,range:80,recoil:0.014,price:1400,color:0x3a3a2a},
  sniper:{id:'sniper',name:'sniper',icon:'🎯',damage:150,magSize:5,reserveMax:40,fireRate:1.2,reloadTime:2.6,spread:0.0,pellets:1,auto:false,range:200,recoil:0.05,price:2000,color:0x1a1a1a,zoom:25},
  rocket:{id:'rocket',name:'rocket',icon:'🚀',damage:200,magSize:1,reserveMax:12,fireRate:1.0,reloadTime:2.4,spread:0.0,pellets:1,auto:false,range:120,recoil:0.06,price:3000,color:0x3a2a1a,explosive:true},
  crossbow:{id:'crossbow',name:'crossbow',icon:'🏹',damage:85,magSize:1,reserveMax:20,fireRate:1.5,reloadTime:2.2,spread:0.0,pellets:1,auto:false,range:150,recoil:0.06,price:1600,color:0x7a5a3a,zoom:15,projectile:true},
  minigun:{id:'minigun',name:'minigun',icon:'⚙️',damage:12,magSize:100,reserveMax:500,fireRate:0.04,reloadTime:3.5,spread:0.04,pellets:1,auto:true,range:40,recoil:0.005,price:2500,color:0x333333,zoom:20},
  tesla:{id:'tesla',name:'tesla',icon:'⚡',damage:30,magSize:40,reserveMax:240,fireRate:0.16,reloadTime:1.6,spread:0.02,pellets:1,auto:true,range:45,recoil:0.014,price:2200,color:0x33ddff,chain:3,chainRange:7,chainFalloff:0.6},
  flamer:{id:'flamer',name:'flamer',icon:'🔥',damage:6,magSize:150,reserveMax:600,fireRate:0.05,reloadTime:2.2,spread:0.13,pellets:1,auto:true,range:9,recoil:0.004,price:1700,color:0xff7722,flamer:true,burn:{dps:14,dur:2.5}},
  ricochet:{id:'ricochet',name:'ricochet',icon:'🪃',damage:55,magSize:8,reserveMax:64,fireRate:0.45,reloadTime:1.8,spread:0.0,pellets:1,auto:false,range:90,recoil:0.03,price:2400,color:0x88ccff,bounce:2,bounceDamage:0.75},
};

const ENEMY_DEFS = {
  grunt:{kind:'grunt',name:'grunt',hp:50,damage:12,speed:2.2,size:0.4,color:0xcc3333,scoreValue:100,attackRange:1.6,attackCooldown:1.0},
  runner:{kind:'runner',name:'runner',hp:25,damage:8,speed:4.2,size:0.3,color:0xddaa22,scoreValue:80,attackRange:1.4,attackCooldown:0.7},
  brute:{kind:'brute',name:'brute',hp:220,damage:28,speed:1.4,size:0.7,color:0x8833aa,scoreValue:300,attackRange:2.0,attackCooldown:1.4},
  shooter:{kind:'shooter',name:'shooter',hp:45,damage:14,speed:1.8,size:0.4,color:0x22aacc,scoreValue:200,ranged:true,attackRange:18,attackCooldown:1.8},
  boss:{kind:'boss',name:'boss',hp:1800,damage:40,speed:1.2,size:1.4,color:0x661111,scoreValue:2500,attackRange:14,attackCooldown:1.2,ranged:true},
  phantom:{kind:'phantom',name:'phantom',hp:35,damage:8,speed:3.8,size:0.35,color:0x88ccff,scoreValue:150,attackRange:1.3,attackCooldown:0.6},
  tank:{kind:'tank',name:'tank',hp:500,damage:50,speed:0.9,size:0.9,color:0x446644,scoreValue:600,attackRange:3.0,attackCooldown:2.0},
  bomber:{kind:'bomber',name:'bomber',hp:55,damage:30,speed:3.0,size:0.36,color:0xff7722,scoreValue:180,attackRange:1.6,attackCooldown:1.0,bomb:true},
  splitter:{kind:'splitter',name:'splitter',hp:150,damage:16,speed:1.6,size:0.6,color:0x66bb44,scoreValue:260,attackRange:1.8,attackCooldown:1.1,split:2},
  swarmling:{kind:'swarmling',name:'swarmling',hp:16,damage:5,speed:4.6,size:0.2,color:0xaaee44,scoreValue:40,attackRange:1.0,attackCooldown:0.5},
  healer:{kind:'healer',name:'healer',hp:75,damage:6,speed:2.2,size:0.4,color:0x55eebb,scoreValue:240,attackRange:18,attackCooldown:1.8,ranged:true,support:true,heal:20,healRate:1.6,healRange:8},
  jumper:{kind:'jumper',name:'jumper',hp:50,damage:14,speed:2.6,size:0.34,color:0xff55aa,scoreValue:160,attackRange:1.5,attackCooldown:0.8,leap:0.4,leapCd:2.2},
};

const DIFFICULTIES = {
  normal:{enemyHpMult:1,enemyDmgMult:1,enemySpeedMult:1,spawnCountMult:1,scoreMult:1},
  hard:{enemyHpMult:1.4,enemyDmgMult:1.5,enemySpeedMult:1.15,spawnCountMult:1.25,scoreMult:1.5},
  nightmare:{enemyHpMult:2,enemyDmgMult:2.2,enemySpeedMult:1.3,spawnCountMult:1.5,scoreMult:2.5},
};

const POWERUP_DEFS = [
  {id:'speed',label:'speed',icon:'⚡',color:0x44ddff,duration:12},
  {id:'damage',label:'damage',icon:'🔥',color:0xff4422,duration:12},
  {id:'rapid',label:'rapid',icon:'🌀',color:0xffaa00,duration:10},
  {id:'shield',label:'shield',icon:'✨',color:0xffee88,duration:8},
];

const PERKS = [
  {id:'fast_reload',name:'fast_reload',desc:'fast_reload_desc',icon:'⚡'},
  {id:'extra_hp',name:'extra_hp',desc:'extra_hp_desc',icon:'❤️'},
  {id:'extra_armor',name:'extra_armor',desc:'extra_armor_desc',icon:'🛡️'},
  {id:'more_damage',name:'more_damage',desc:'more_damage_desc',icon:'🔥'},
  {id:'faster_sprint',name:'faster_sprint',desc:'faster_sprint_desc',icon:'🏃'},
  {id:'extra_grenade',name:'extra_grenade',desc:'extra_grenade_desc',icon:'💣'},
  {id:'cheaper_shops',name:'cheaper_shops',desc:'cheaper_shops_desc',icon:'💰'},
  {id:'regen_boost',name:'regen_boost',desc:'regen_boost_desc',icon:'✨'},
  {id:'combo_master',name:'combo_master',desc:'combo_master_desc',icon:'🎯'},
  {id:'lucky_drops',name:'lucky_drops',desc:'lucky_drops_desc',icon:'🍀'},
];

const ACHIEVEMENTS = [
  {id:'first_blood', name:'first_blood', desc:'first_blood_desc', icon:'🩸'},
  {id:'headhunter', name:'headhunter', desc:'headhunter_desc', icon:'🎯'},
  {id:'demo_expert', name:'demo_expert', desc:'demo_expert_desc', icon:'💥'},
  {id:'untouchable', name:'untouchable', desc:'untouchable_desc', icon:'👻'},
  {id:'collector', name:'collector', desc:'collector_desc', icon:'🔫'},
];

function unlockAchievement(id){
  if(state.achievements[id]) return;
  const ach = ACHIEVEMENTS.find(a=>a.id===id); if(!ach) return;
  state.achievements[id] = true;
  toast(ach.icon + ' ' + I18n.t('achievement.unlocked') + ': ' + I18n.t('achievement.'+ach.name) + '!', 'success'); audio.powerup();
}

function getGameTips(){
  const tips = I18n.t('tips');
  return Array.isArray(tips) ? tips : [];
}
let currentTipIndex = 0;
let lastTipSwitchTime = 0;
let tipDisplayTime = 0;

const OBJECTIVES = [
  {id:'headshots',text:'headshots',icon:'🎯',reward:75,goal:3},
  {id:'no_damage',text:'no_damage',icon:'🛡️',reward:150,goal:1},
  {id:'kills',text:'kills',icon:'💀',reward:80,goal:8},
  {id:'combo_5',text:'combo_5',icon:'🔥',reward:100,goal:5},
  {id:'grenade_kill',text:'grenade_kill',icon:'💣',reward:90,goal:1},
  {id:'barrel_kill',text:'barrel_kill',icon:'🛢️',reward:120,goal:1},
];

// ============================================================================
// GAME STATE
// ============================================================================
let difficulty = 'normal';
const state = {
  hp:100, maxHp:100, armor:0, maxArmor:100, score:0, credits:0, wave:0,
  enemiesAlive:0, enemiesTotal:0, ammo:12, magSize:12, reserve:96,
  reloading:false, gameOver:false, selectedSlot:0, inventory:[], grenades:3,
  stamina:100, maxStamina:100, combo:0, comboTimer:0, bossActive:false,
  bossHp:0, bossMaxHp:0, bossName:'', waveCountdown:0, inShop:false,
  lowAmmo:false, sprinting:false, crouching:false,
  reloadProgress:{active:false,progress:0},
  stats:{kills:0,headshots:0,shotsFired:0,shotsHit:0,damageDealt:0,damageTaken:0,wavesSurvived:0,bestCombo:0},
  powerups:[], activePerks:[],
  achievements:{}, waveBarrelKills:0, waveHeadshots:0,
};

// Perk modifiers
let damageMult=1, moveSpeedMult=1, reloadSpeedMult=1, shopDiscount=0, regenBoost=0, comboBoost=0, luckBoost=0;

// Object pools for performance
let particlePool=[], tracerPool=[], projectilePool=[];

// Owned weapons & ammo
let ownedWeapons = new Set(['pistol']);
let lastFootstepTime = 0;
let weaponAmmo = {pistol:{mag:12,reserve:96}};
let medkitCount = 0;

// ============================================================================
// SETTINGS
// ============================================================================
const settings = { sensitivity: 1.0, fov: 75, volume: 0.5, shadows: false };
window.setDifficulty = function(d){ difficulty = d; document.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('active', b.dataset.d===d)); };
