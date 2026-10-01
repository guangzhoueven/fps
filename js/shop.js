// ============================================================================
// SHOP — shop & perks
// ============================================================================
// ============================================================================
// SHOP
// ============================================================================
window.leaveShop = function(){ state.inShop = false; document.getElementById('shop').style.display = 'none'; requestGameLock(); startWaveCountdown(3); };

function showShop(){
  state.inShop = true;
  document.exitPointerLock(); // free the cursor for shop clicks
  document.getElementById('shop-title').textContent = I18n.tf('shop.waveCleared', state.wave);
  document.getElementById('shop-credits').textContent = state.credits;
  const grid = document.getElementById('shop-grid'); grid.innerHTML = '';
  // Weapons for sale
  for(const id of ['smg','shotgun','rifle','sniper','rocket','crossbow','minigun']){
    const w = WEAPONS[id];
    if(ownedWeapons.has(id)) continue;
    const price = Math.round(w.price * (1 - shopDiscount));
    const item = document.createElement('div'); item.className = 'shop-item';
    item.innerHTML = `<div class="si">${w.icon}</div><div class="sn">${I18n.t('weapon.' + w.id)}</div><div class="sd">${I18n.t('shop.damage')} ${w.damage} \u2022 ${I18n.t('shop.mag')} ${w.magSize} • ${w.auto?I18n.t('ammo.fullAuto'):I18n.t('ammo.semiAuto')}</div><div class="sp">${price}🪙</div><button ${state.credits<price?'disabled':''} onclick="buyWeapon('${id}')">${I18n.t('shop.buy')}</button>`;
    grid.appendChild(item);
  }
  // Ammo refills
  for(const id of ['pistol','smg','shotgun','rifle','sniper','rocket','crossbow','minigun']){
    if(!ownedWeapons.has(id)) continue;
    const w = WEAPONS[id];
    const price = Math.round((w.price*0.25||100) * (1-shopDiscount));
    const item = document.createElement('div'); item.className = 'shop-item';
    item.innerHTML = `<div class="si">📦</div><div class="sn">${I18n.t('weapon.' + w.id)} ${I18n.t('shop.ammo')}</div><div class="sd">${I18n.t('shop.refillToMax')} (${w.reserveMax})</div><div class="sp">${price}🪙</div><button ${state.credits<price?'disabled':''} onclick="buyAmmo('${id}')">${I18n.t('shop.buy')}</button>`;
    grid.appendChild(item);
  }
  // Upgrades
  const upgrades = [
    ['upgrade_hp','❤️',I18n.t('shop.upgradeMaxHp'),I18n.t('shop.upgradeMaxHpDesc'),500],
    ['upgrade_armor','🛡️',I18n.t('shop.upgradeMaxArmor'),I18n.t('shop.upgradeMaxArmorDesc'),500],
    ['upgrade_speed','⚡',I18n.t('shop.upgradeSpeed'),I18n.t('shop.upgradeSpeedDesc'),700],
    ['upgrade_reload','🔄',I18n.t('shop.upgradeReload'),I18n.t('shop.upgradeReloadDesc'),800],
  ];
  for(const [uid,icon,name,desc,basePrice] of upgrades){
    const price = Math.round(basePrice * (1-shopDiscount));
    const item = document.createElement('div'); item.className = 'shop-item';
    item.innerHTML = `<div class="si">${icon}</div><div class="sn">${name}</div><div class="sd">${desc}</div><div class="sp">${price}🪙</div><button ${state.credits<price?'disabled':''} onclick="buyUpgrade('${uid}')">${I18n.t('shop.buy')}</button>`;
    grid.appendChild(item);
  }
  // Consumables
  const cons = [
    ['buy_medkit','💊',I18n.t('shop.medkit'),I18n.t('shop.medkitDesc'),150],
    ['buy_grenade','💣',I18n.t('shop.grenadex2'),I18n.t('shop.grenadex2Desc'),200],
    ['buy_armor','🦺',I18n.t('shop.armorPlate'),I18n.t('shop.armorPlateDesc'),250],
  ];
  for(const [uid,icon,name,desc,basePrice] of cons){
    const price = Math.round(basePrice * (1-shopDiscount));
    const item = document.createElement('div'); item.className = 'shop-item';
    item.innerHTML = `<div class="si">${icon}</div><div class="sn">${name}</div><div class="sd">${desc}</div><div class="sp">${price}🪙</div><button ${state.credits<price?'disabled':''} onclick="buyConsumable('${uid}')">${I18n.t('shop.buy')}</button>`;
    grid.appendChild(item);
  }
  document.getElementById('shop').style.display = 'flex';
}
window.buyWeapon = function(id){
  const w = WEAPONS[id]; const price = Math.round(w.price * (1-shopDiscount));
  if(state.credits < price) return;
  state.credits -= price; ownedWeapons.add(id); weaponAmmo[id] = {mag:w.magSize, reserve:w.reserveMax};
  rebuildInventory(); audio.buy(); showShop();
};
window.buyAmmo = function(id){
  const w = WEAPONS[id]; const price = Math.round((w.price*0.25||100) * (1-shopDiscount));
  if(state.credits < price) return;
  state.credits -= price; weaponAmmo[id].reserve += w.reserveMax; audio.buy(); showShop();
};
window.buyUpgrade = function(uid){
  const prices = {upgrade_hp:500, upgrade_armor:500, upgrade_speed:700, upgrade_reload:800};
  const price = Math.round(prices[uid] * (1-shopDiscount));
  if(state.credits < price) return;
  state.credits -= price;
  if(uid==='upgrade_hp'){ state.maxHp += 25; state.hp = state.maxHp; }
  else if(uid==='upgrade_armor'){ state.maxArmor += 25; state.armor = state.maxArmor; }
  else if(uid==='upgrade_speed') moveSpeedMult += 0.1;
  else if(uid==='upgrade_reload') reloadSpeedMult += 0.15;
  audio.buy(); showShop();
};
window.buyConsumable = function(uid){
  const prices = {buy_medkit:150, buy_grenade:200, buy_armor:250};
  const price = Math.round(prices[uid] * (1-shopDiscount));
  if(state.credits < price) return;
  state.credits -= price;
  if(uid==='buy_medkit'){ medkitCount++; rebuildInventory(); }
  else if(uid==='buy_grenade'){ state.grenades += 2; rebuildInventory(); }
  else if(uid==='buy_armor') state.armor = state.maxArmor;
  audio.buy(); showShop();
};

// ============================================================================
// PERKS
// ============================================================================
function showPerkSelection(){
  const avail = PERKS.filter(p=>!state.activePerks.find(ap=>ap.id===p.id));
  const shuffled = [...avail].sort(()=>Math.random()-0.5).slice(0, 3);
  const grid = document.getElementById('perk-grid'); grid.innerHTML = '';
  shuffled.forEach(perk=>{
    const card = document.createElement('div'); card.className = 'perk-card';
    card.innerHTML = `<div class="pi">${perk.icon}</div><div class="pn">${I18n.t('perk.'+perk.id)}</div><div class="pd">${I18n.t('perk.'+perk.id+'_desc')}</div>`;
    card.onclick = ()=>pickPerk(perk);
    grid.appendChild(card);
  });
  document.getElementById('perk-sub').textContent = I18n.tf('perk.selectPerk', state.wave);
  document.getElementById('perks').style.display = 'flex';
  document.exitPointerLock(); // free the cursor — after display so uiOverlayOpen() sees it
}
window.skipPerk = function(){ document.getElementById('perks').style.display = 'none'; showShop(); };
function pickPerk(perk){
  document.getElementById('perks').style.display = 'none';
  state.activePerks.push(perk);
  switch(perk.id){
    case 'fast_reload': reloadSpeedMult += 0.25; break;
    case 'extra_hp': state.maxHp += 20; state.hp = state.maxHp; break;
    case 'extra_armor': state.maxArmor += 20; state.armor = state.maxArmor; break;
    case 'more_damage': damageMult += 0.15; break;
    case 'faster_sprint': moveSpeedMult += 0.2; break;
    case 'extra_grenade': state.grenades += 2; rebuildInventory(); break;
    case 'cheaper_shops': shopDiscount += 0.2; break;
    case 'regen_boost': regenBoost += 1; break;
    case 'combo_master': comboBoost += 0.5; break;
    case 'lucky_drops': luckBoost += 0.25; break;
  }
  audio.powerup(); toast(I18n.tf('toast.perkAcquired', I18n.t('perk.'+perk.id)), 'success');
  showShop();
}
