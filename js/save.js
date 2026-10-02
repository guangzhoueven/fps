// ============================================================================
// SAVE — autosave to localStorage, export / import / clear, resume run
// ============================================================================
const SAVE_KEY = 'neonSiegeSave';
const PENDING_KEY = 'neonSiegeClear'; // sessionStorage — survives the reload back to the start page

const SaveGame = {
  // Soft-clear flag: data stays in localStorage until a new game starts,
  // so the "已清除数据" toast can Undo it
  pendingClear: false,

  loadRaw(){ try{ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; }catch(e){ return null; } },
  getRun(){ const d = this.loadRaw(); return (d && d.run && d.run.resumeWave) ? d.run : null; },

  // Snapshot everything except the run (run is managed separately so a plain
  // meta save never wipes an in-progress run)
  buildExport(){
    const prev = this.loadRaw() || {};
    return {
      v: 1,
      savedAt: Date.now(),
      lang: localStorage.getItem('gameLang') || 'zh',
      settings: Object.assign({}, settings),
      difficulty,
      achievements: Object.assign({}, state.achievements),
      run: prev.run || null,
    };
  },
  write(data){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(data)); }catch(e){} this.refreshContinueBtn(); },

  captureRun(){
    return {
      resumeWave: (typeof waveActive !== 'undefined' && waveActive) ? state.wave : state.wave + 1,
      credits: state.credits, score: state.score,
      hp: state.hp, maxHp: state.maxHp, armor: state.armor, maxArmor: state.maxArmor,
      grenades: state.grenades, medkitCount,
      ownedWeapons: [...ownedWeapons], weaponAmmo,
      selectedSlot: state.selectedSlot,
      damageMult, moveSpeedMult, reloadSpeedMult, shopDiscount, regenBoost, comboBoost, luckBoost,
      stats: Object.assign({}, state.stats),
      activePerks: state.activePerks,
      difficulty,
    };
  },
  // run === undefined → keep previous run; null → clear run; object → set run
  save(run){
    const d = this.buildExport();
    if(run !== undefined) d.run = run;
    this.write(d);
  },
  autoSave(){
    if(this._importing) return; // import reload in progress — never clobber the imported data
    if(typeof phase === 'undefined') return;
    if(phase !== 'playing' && phase !== 'paused') return;
    if(state.gameOver){ this.save(null); return; }
    this.save(this.captureRun());
  },
  clearRun(){ this.save(null); },

  // In-page confirm dialog instead of window.confirm()
  clearAll(){
    const o = document.getElementById('confirm-overlay');
    if(o) o.style.display = 'flex';
  },
  closeConfirm(){
    const o = document.getElementById('confirm-overlay');
    if(o) o.style.display = 'none';
  },
  confirmOpen(){
    const o = document.getElementById('confirm-overlay');
    return !!(o && o.style.display === 'flex');
  },
  confirmClear(){
    this.closeConfirm();
    this.pendingClear = true;
    try{ sessionStorage.setItem(PENDING_KEY, '1'); }catch(e){}
    location.reload(); // back to the start page — continue button stays hidden there
  },
  // Shown on the start page after the reload (needs i18n ready → called from initI18n)
  showClearedToast(){
    if(!this.pendingClear || this._clearedToastShown) return;
    this._clearedToastShown = true;
    toastAction(I18n.t('toast.dataCleared'), I18n.t('pause.undo'), ()=>{
      if(!this.pendingClear) return;
      this.pendingClear = false;
      this._clearedToastShown = false;
      try{ sessionStorage.removeItem(PENDING_KEY); }catch(e){}
      this.refreshContinueBtn();
    }, 'success');
  },
  // The real deletion — only runs when a brand-new game starts
  purge(){
    if(!this.pendingClear) return;
    this.pendingClear = false;
    this._clearedToastShown = false;
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    try{ sessionStorage.removeItem(PENDING_KEY); }catch(e){}
    document.querySelectorAll('.toast-action').forEach(t=>t.remove());
  },

  exportData(){
    this._download(JSON.stringify(this.buildExport(), null, 2));
  },
  // fps + timestamp, e.g. fps20260925-143055.json
  _filename(){
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `fps${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
  },
  _download(json){
    try{
      const blob = new Blob([json], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this._filename();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 2000);
      toast(I18n.t('toast.saveDownloaded'), 'success');
    }catch(e){ toast(I18n.t('toast.saveInvalid'), 'danger'); }
  },

  importData(){
    const inp = document.getElementById('save-file-input');
    if(inp){ inp.value = ''; inp.click(); }
  },
  _handleImport(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const d = JSON.parse(reader.result);
        if(!d || typeof d !== 'object' || d.v !== 1) throw new Error('bad save');
        // Sanitize imported values — a hand-edited save must not inject invalid settings
        const raw = (d.settings && typeof d.settings === 'object') ? d.settings : {};
        const clamp = (v, lo, hi, dflt) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : dflt;
        const st = {
          sensitivity: clamp(raw.sensitivity, 0.1, 5, settings.sensitivity),
          fov: clamp(raw.fov, 60, 110, settings.fov),
          volume: clamp(raw.volume, 0, 1, settings.volume),
          shadows: raw.shadows === true
        };
        const lang = (d.lang === 'zh' || d.lang === 'en') ? d.lang : null;
        const diff = (d.difficulty && Object.prototype.hasOwnProperty.call(DIFFICULTIES, d.difficulty)) ? d.difficulty : null;
        if(lang) localStorage.setItem('gameLang', lang);
        this.pendingClear = false;
        try{ sessionStorage.removeItem(PENDING_KEY); }catch(e){}
        this.write({
          v: 1, savedAt: Date.now(),
          lang: lang || 'zh',
          settings: st,
          difficulty: diff || difficulty,
          achievements: (d.achievements && typeof d.achievements === 'object') ? d.achievements : {},
          run: (d.run && typeof d.run === 'object') ? d.run : null,
        });
        this._importing = true; // the upcoming reload's pagehide autosave must not overwrite this
        toast(I18n.t('toast.saveImported'), 'success');
        setTimeout(()=>location.reload(), 700);
      }catch(e){ toast(I18n.t('toast.saveInvalid'), 'danger'); }
    };
    reader.readAsText(file);
  },

  refreshContinueBtn(){
    const el = document.getElementById('btn-continue');
    if(!el) return;
    const run = this.getRun();
    const show = !!run && !this.pendingClear;
    el.style.display = show ? '' : 'none';
    if(show) el.textContent = I18n.tf('menu.continue', run.resumeWave || 1);
  },

  init(){
    try{ if(sessionStorage.getItem(PENDING_KEY)) this.pendingClear = true; }catch(e){}
    const d = this.loadRaw();
    if(d){
      if(d.settings) Object.assign(settings, d.settings);
      if(d.achievements) Object.assign(state.achievements, d.achievements);
      if(d.difficulty && typeof setDifficulty === 'function') setDifficulty(d.difficulty);
    }
    this.refreshContinueBtn();
    const inp = document.getElementById('save-file-input');
    if(inp) inp.addEventListener('change', ()=>{ if(inp.files && inp.files[0]) this._handleImport(inp.files[0]); });
    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
    bind('pm-export', ()=>this.exportData());
    bind('pm-import', ()=>this.importData());
    bind('pm-clear', ()=>this.clearAll());
    bind('confirm-cancel', ()=>this.closeConfirm());
    bind('confirm-ok', ()=>this.confirmClear());
    const ov = document.getElementById('confirm-overlay');
    if(ov) ov.addEventListener('click', e=>{ if(e.target === ov) this.closeConfirm(); });
    // Autosave while playing / paused, plus safety nets on tab hide & close
    setInterval(()=>this.autoSave(), 10000);
    addEventListener('pagehide', ()=>this.autoSave());
    document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') this.autoSave(); });
    window.addEventListener('langchange', ()=>this.refreshContinueBtn());
  }
};

window.SaveGame = SaveGame;
SaveGame.init();
