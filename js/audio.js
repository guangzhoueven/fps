// ============================================================================
// AUDIO — procedural WebAudio
// ============================================================================
// ============================================================================
// AUDIO (procedural WebAudio)
// ============================================================================
const audio = {
  ctx:null, master:null, noiseBuf:null,
  init(){ if(this.ctx)return; this.ctx=new(window.AudioContext||window.webkitAudioContext)(); this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination); const l=this.ctx.sampleRate; this.noiseBuf=this.ctx.createBuffer(1,l,this.ctx.sampleRate); const d=this.noiseBuf.getChannelData(0); for(let i=0;i<l;i++)d[i]=Math.random()*2-1; },
  resume(){ this.ctx?.resume(); },
  tone(f,d,t='sine',g=0.08,fe){ if(!this.ctx)return; const o=this.ctx.createOscillator(),gn=this.ctx.createGain(); o.type=t; o.frequency.setValueAtTime(f,this.ctx.currentTime); if(fe)o.frequency.exponentialRampToValueAtTime(fe,this.ctx.currentTime+d); gn.gain.setValueAtTime(g,this.ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001,this.ctx.currentTime+d); o.connect(gn); gn.connect(this.master); o.start(); o.stop(this.ctx.currentTime+d+0.02); },
  noise(d,g=0.15,ff=1000){ if(!this.ctx||!this.noiseBuf)return; const s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf; const gn=this.ctx.createGain(),f=this.ctx.createBiquadFilter(); f.frequency.value=ff; gn.gain.setValueAtTime(g,this.ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001,this.ctx.currentTime+d); s.connect(f); f.connect(gn); gn.connect(this.master); s.start(); s.stop(this.ctx.currentTime+d+0.02); },
  shoot(w){ const m={pistol:[220,.08,'square',.07,80],smg:[260,.05,'sawtooth',.05,100],shotgun:[120,.15,'sawtooth',.1,50],rifle:[180,.1,'square',.09,70],sniper:[150,.2,'sawtooth',.12,40],rocket:[80,.3,'sawtooth',.15,30],crossbow:[100,.25,'sine',.07,55],minigun:[300,.03,'sawtooth',.04,130],tesla:[880,.07,'sine',.05,140],flamer:[130,.07,'sawtooth',.11,70],ricochet:[440,.05,'square',.07,110]}; const p=m[w]||[200,.08,'square',.07,80]; this.tone(p[0],p[1],p[2],p[3],p[4]); this.noise(p[1]*.6,p[3]*1.2,p[4]*10); if(w==='crossbow') setTimeout(()=>this.noise(.15,.08,400),200); },
  reload(){ this.tone(400,.1,'sine',.05,300); setTimeout(()=>this.tone(300,.1,'sine',.05,200),150); },
  pickup(){ this.tone(600,.1,'sine',.06,900); setTimeout(()=>this.tone(900,.12,'sine',.06,1200),80); },
  door(){ this.tone(150,.2,'sine',.05,100); },
  explosion(){ this.tone(60,.6,'sawtooth',.18,20); this.noise(.6,.22,600); },
  hurt(){ this.tone(180,.15,'sawtooth',.08,80); },
  enemyDeath(){ this.tone(200,.2,'sawtooth',.06,60); },
  headshot(){ this.tone(880,.15,'square',.08,1200); setTimeout(()=>this.tone(660,.1,'square',.06,900),100); },
  hitmarker(){ this.tone(440,.04,'square',.03,600); },
  hitmarkerCrit(){ this.tone(660,.04,'square',.05,900); },
  waveStart(){ this.tone(440,.15,'sine',.08,660); setTimeout(()=>this.tone(660,.2,'sine',.08,880),150); },
  waveComplete(){ this.tone(523,.12,'sine',.07); setTimeout(()=>this.tone(659,.12,'sine',.07),120); setTimeout(()=>this.tone(784,.2,'sine',.08),240); },
  buy(){ this.tone(700,.08,'sine',.06,1000); setTimeout(()=>this.tone(1000,.1,'sine',.06,1300),70); },
  error(){ this.tone(200,.15,'sawtooth',.06,150); },
  powerup(){ this.tone(523,.1,'sine',.07,784); setTimeout(()=>this.tone(784,.12,'sine',.07,1046),100); setTimeout(()=>this.tone(1046,.15,'sine',.07,1318),200); },
  bossSpawn(){ this.tone(80,.5,'sawtooth',.15,40); setTimeout(()=>this.tone(60,.8,'sawtooth',.15,30),300); },
  bossDeath(){ for(let i=0;i<5;i++)setTimeout(()=>{this.tone(100-i*10,.3,'sawtooth',.12,30);this.noise(.3,.1,600);},i*200); },
  footstep(isRunning=false){
    if(isRunning){
      this.tone(110, 0.035, 'sine', 0.025, 70);
      this.noise(.04,.025, 500);
    } else {
      this.tone(80, 0.04, 'sine', 0.03, 40);
      this.noise(.05, .03, 400);
    }
  },
  empty(){ this.tone(800,.03,'square',.04); },
};
