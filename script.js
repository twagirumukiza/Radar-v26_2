const $=s=>document.querySelector(s);
let gScore=0,gLevel=1,gLives=3,running=false,audioOn=true,audioCtx=null;
let objects=[],spawnTimer=null,raf=null,nextId=1,kills=0,spawned=0;
let sessionKills=0;
const RECORD_KEY="radar_v4_records";
const weaponKeys=["emp","cluster","blue","black","atomic","mine","decoy"];
const weaponLabels={emp:"ONDE EM",cluster:"SOUS-MUNITIONS",blue:"BOULE BLEUE",black:"ARME NOIRE",atomic:"ATOMIQUE",mine:"MINE MAGNÉTIQUE",decoy:"LEURRE"};
function emptyWeaponMap(){return{emp:0,cluster:0,blue:0,black:0,atomic:0,mine:0,decoy:0}}
function emptyRunStats(){return{
 kills:0,impacts:0,friendlyFire:0,manualShots:0,manualKills:0,playTimeMs:0,
 weaponShots:emptyWeaponMap(),weaponKills:emptyWeaponMap()
}}
let runStats=emptyRunStats();
let lastPlayTick=0;
function defaultModeRecords(){return{bestScore:0,bestLevel:1,totalKills:0,games:0,bestRun:null,lastRun:null}}
function normalizeModeRecords(g){
 const d=defaultModeRecords(),x=Object.assign(d,g||{});
 if(x.bestRun)x.bestRun=normalizeRunData(x.bestRun);
 if(x.lastRun)x.lastRun=normalizeRunData(x.lastRun);
 return x;
}
function defaultRecords(){return{bestScore:0,bestLevel:1,totalKills:0,games:0,bestRun:null,lastRun:null,manual:defaultModeRecords(),ai:defaultModeRecords(),hybrid:defaultModeRecords()}}
function runSnapshot(){return{
 score:gScore,level:gLevel,date:new Date().toISOString(),kills:runStats.kills,impacts:runStats.impacts,
 friendlyFire:runStats.friendlyFire,manualShots:runStats.manualShots,manualKills:runStats.manualKills,
 playTimeMs:Math.max(0,Math.round(runStats.playTimeMs||0)),
 weaponShots:{...runStats.weaponShots},weaponKills:{...runStats.weaponKills}
}}
function isValidRunData(d){
 if(!d||typeof d!=="object")return false;
 if(typeof d.score!=="number"||typeof d.level!=="number")return false;
 return !!d.weaponShots&&!!d.weaponKills;
}
function normalizeRunData(d){
 return Object.assign({},d,{playTimeMs:Number(d.playTimeMs)||0,
  weaponShots:Object.assign(emptyWeaponMap(),d.weaponShots||{}),
  weaponKills:Object.assign(emptyWeaponMap(),d.weaponKills||{})
 });
}
function downloadJSON(obj,filename){
 try{
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){}
}
function readJSONFile(file,cb){
 const reader=new FileReader();
 reader.onload=()=>{
  try{cb(JSON.parse(reader.result))}catch(e){alert("Fichier JSON invalide.")}
 };
 reader.onerror=()=>alert("Impossible de lire le fichier.");
 reader.readAsText(file);
}
function getRecords(){
 try{
  const raw=JSON.parse(localStorage.getItem(RECORD_KEY))||{};
  const r=Object.assign(defaultRecords(),raw);
  r.manual=normalizeModeRecords(raw.manual);r.ai=normalizeModeRecords(raw.ai);r.hybrid=normalizeModeRecords(raw.hybrid);
  return r;
 }catch(e){return defaultRecords()}
}
function saveRecords(r){try{localStorage.setItem(RECORD_KEY,JSON.stringify(r))}catch(e){}renderRecords()}
function totalMap(m){return weaponKeys.reduce((n,k)=>n+(Number(m&&m[k])||0),0)}
function formatPlayTime(ms){
 const total=Math.max(0,Math.floor((Number(ms)||0)/1000));
 const hh=Math.floor(total/3600),mm=Math.floor((total%3600)/60),ss=total%60;
 return hh?String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0"):String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0");
}
function renderRunBlock(prefix,run){
 const b=run||{},ws=b.weaponShots||emptyWeaponMap(),wk=b.weaponKills||emptyWeaponMap();
 $("#"+prefix+"Kills").textContent=b.kills||0;$("#"+prefix+"Impacts").textContent=b.impacts||0;
 $("#"+prefix+"FriendlyFire").textContent=b.friendlyFire||0;
 const timeEl=$("#"+prefix+"PlayTime");if(timeEl)timeEl.textContent=formatPlayTime(b.playTimeMs||0);
 const manualShots=b.manualShots||0,manualKills=b.manualKills||0;
 $("#"+prefix+"Accuracy").textContent=(manualShots?Math.round(manualKills/manualShots*100):0)+"%";
 weaponKeys.forEach(k=>{
  $("#"+prefix+"Shot"+k.charAt(0).toUpperCase()+k.slice(1)).textContent=ws[k]||0;
  $("#"+prefix+"Kill"+k.charAt(0).toUpperCase()+k.slice(1)).textContent=wk[k]||0;
 });
 $("#"+prefix+"KillManual").textContent=manualKills;
 const shots=totalMap(ws),weaponKills=totalMap(wk);
 $("#"+prefix+"ShotsTotal").textContent=shots;
 $("#"+prefix+"Efficiency").textContent=shots?(weaponKills/shots).toFixed(2):"0.00";
 let best="—",bestN=0;weaponKeys.forEach(k=>{if((wk[k]||0)>bestN){bestN=wk[k]||0;best=weaponLabels[k]}});
 $("#"+prefix+"BestWeapon").textContent=bestN?best+" ("+bestN+")":"—";
}
function renderRecords(){
 const r=getRecords();
 $("#bestScore").textContent=r.bestScore||0;$("#bestLevel").textContent=r.bestLevel||1;
 $("#lastScore").textContent=(r.lastRun&&r.lastRun.score)||0;$("#lastLevel").textContent=(r.lastRun&&r.lastRun.level)||1;
 $("#totalKills").textContent=r.totalKills||0;$("#gamesPlayed").textContent=r.games||0;
 renderRunBlock("record",r.bestRun);
 renderRunBlock("last",r.lastRun);
 renderModeRecords("manual",r.manual);
 renderModeRecords("ai",r.ai);
 renderModeRecords("hybrid",r.hybrid);
}

function renderModeRecords(prefix,g){
 g=normalizeModeRecords(g);
 const set=(id,v)=>{const e=$("#"+prefix+id);if(e)e.textContent=v};
 set("BestScore",g.bestScore||0);set("BestLevel",g.bestLevel||1);set("LastScore",(g.lastRun&&g.lastRun.score)||0);set("LastLevel",(g.lastRun&&g.lastRun.level)||1);
 set("TotalKills",g.totalKills||0);set("GamesPlayed",g.games||0);
 renderRunBlock(prefix+"Best",g.bestRun);renderRunBlock(prefix+"Last",g.lastRun);
}
function commitModeRecord(group,snap){
 group=normalizeModeRecords(group);
 const isNewBest=snap.score>group.bestScore || !group.bestRun;
 group.bestScore=Math.max(group.bestScore||0,snap.score||0);group.bestLevel=Math.max(group.bestLevel||1,snap.level||1);
 group.totalKills=(group.totalKills||0)+(snap.kills||0);group.games=(group.games||0)+1;
 if(isNewBest)group.bestRun=snap;group.lastRun=snap;return group;
}

function commitRecords(){
 const r=getRecords();
 const isNewBest=gScore>r.bestScore || !r.bestRun;
 r.bestScore=Math.max(r.bestScore||0,gScore);
 r.bestLevel=Math.max(r.bestLevel||1,gLevel);
 r.totalKills=(r.totalKills||0)+sessionKills;r.games=(r.games||0)+1;
 const snap=runSnapshot();
 snap.defenseMode=defenseMode;
 if(isNewBest)r.bestRun=snap;
 r.lastRun=snap;
 if(defenseMode==="manual")r.manual=commitModeRecord(r.manual,snap);
 else if(defenseMode==="ai")r.ai=commitModeRecord(r.ai,snap);
 else if(defenseMode==="hybrid")r.hybrid=commitModeRecord(r.hybrid,snap);
 sessionKills=0;saveRecords(r)
}
const cfg={
 easy:{speed:.030,spawn:1500,count:6},
 normal:{speed:.040,spawn:1200,count:8},
 hard:{speed:.052,spawn:900,count:10}
};
let arsenal={emp:0,cluster:0,blue:0,black:0,atomic:0,mine:0,decoy:0},used={emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false},projectiles=[];
let trainingMode=false,freeMode=false;
let scenarioMode=false,scenarioMission=null;
// V19 — pilotage de la défense : utilisateur, IA seule ou IA + utilisateur.
let defenseMode="manual",aiActing=false,lastAIAction=0;
let freeRules={
 cluster:{start:3,freq:3},blue:{start:4,freq:4},emp:{start:5,freq:5},black:{start:7,freq:7},atomic:{start:8,freq:8},mine:{start:5,freq:5},decoy:{start:4,freq:4}
};
const SAVE_KEY="radar_v14_active_game";
let lastPersist=0,restoringGame=false;

function serializeObject(o){
 return {id:o.id,angle:o.angle,r:o.r,kind:o.kind,revealed:o.revealed,done:false,
         radialDir:o.radialDir||-1,bounceLeft:Math.max(0,(o.bounceUntil||0)-performance.now())};
}
function serializeProjectile(p){
 return {type:p.type,x:p.x,y:p.y,vx:p.vx,vy:p.vy,primary:!!p.primary,crossed:[...(p.crossed||[])]};
}
function persistGame(force=false){
 if(!running)return;
 const now=Date.now(); if(!force && now-lastPersist<300)return; lastPersist=now;
 const state={
  v:14,savedAt:now,
  gScore,gLevel,gLives,kills,spawned,nextId,sessionKills,
  trainingMode,freeMode,scenarioMode,audioOn,defenseMode,
  scenarioCampaign:scenarioMode&&typeof campaign!=="undefined"?campaign:null,scenarioMission:scenarioMode?scenarioMission:null,
  difficulty:$("#difficulty").value,
  arsenal:{...arsenal},used:{...used},
  freeRules:JSON.parse(JSON.stringify(freeRules)),
  runStats:JSON.parse(JSON.stringify(runStats)),
  objects:objects.filter(o=>!o.done).map(serializeObject),
  projectiles:projectiles.filter(p=>p.e&&p.e.isConnected).map(serializeProjectile),
  mines:mines.filter(m=>m.el&&m.el.isConnected&&m.state!=="gone").map(serializeMine),
  decoys:decoys.filter(d=>d.el&&d.el.isConnected).map(serializeDecoy)
 };
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){}
}
function clearSavedGame(){try{localStorage.removeItem(SAVE_KEY)}catch(e){}}
function getSavedGame(){
 try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY));
  return s&&s.v===14?s:null;
 }catch(e){return null}
}
function createRestoredObject(data){
 const radar=$("#radar"),el=document.createElement("button");
 el.className=data.revealed?(data.kind==="red"?"enemy":"contact-v4 "+data.kind):"contact-v4";
 el.setAttribute("aria-label","Contact radar");radar.appendChild(el);
 const item={id:data.id,el,angle:data.angle,r:data.r,last:performance.now(),kind:data.kind,
             revealed:!!data.revealed,done:false,radialDir:data.radialDir||-1,
             bounceUntil:performance.now()+(data.bounceLeft||0)};
 objects.push(item);
 el.addEventListener("pointerdown",ev=>{ev.preventDefault();shoot(item)});
 const px=50+Math.cos(item.angle)*item.r*100,py=50+Math.sin(item.angle)*item.r*100;
 el.style.left=px+"%";el.style.top=py+"%";
 return item;
}
function restoreSavedGame(){
 const s=getSavedGame(); if(!s)return false;
 restoringGame=true;
 clearTimeout(spawnTimer);cancelAnimationFrame(raf);clearObjects();
 projectiles.forEach(p=>p.e.remove());projectiles=[];
 clearMines();clearDecoys();
 gScore=s.gScore||0;gLevel=s.gLevel||1;gLives=Number.isFinite(s.gLives)?s.gLives:3;
 kills=s.kills||0;spawned=s.spawned||0;nextId=s.nextId||1;sessionKills=s.sessionKills||0;
 trainingMode=!!s.trainingMode;freeMode=!!s.freeMode;scenarioMode=!!s.scenarioMode;audioOn=s.audioOn!==false;
 if(scenarioMode&&s.scenarioCampaign){campaign=s.scenarioCampaign;scenarioMission=s.scenarioMission||buildMission(campaign.mission);document.body.classList.add("scenario-mode");saveCampaign();}
 defenseMode=["manual","ai","hybrid"].includes(s.defenseMode)?s.defenseMode:"manual";
 arsenal=Object.assign({emp:0,cluster:0,blue:0,black:0,atomic:0,mine:0,decoy:0},s.arsenal||{});
 used=Object.assign({emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false},s.used||{});
 if(s.freeRules)freeRules=s.freeRules;
 runStats=Object.assign(emptyRunStats(),s.runStats||{});
 runStats.weaponShots=Object.assign(emptyWeaponMap(),runStats.weaponShots||{});
 runStats.weaponKills=Object.assign(emptyWeaponMap(),runStats.weaponKills||{});
 runStats.playTimeMs=Number(runStats.playTimeMs)||0;lastPlayTick=performance.now();
 if(s.difficulty&&cfg[s.difficulty])$("#difficulty").value=s.difficulty;
 $("#sound").textContent=audioOn?"🔊":"🔇";
 document.body.classList.toggle("training-mode",trainingMode);
 $("#modeBadge").hidden=!(trainingMode||freeMode||scenarioMode);
 if(trainingMode)$("#modeBadge").textContent="ENTRAÎNEMENT";
 if(freeMode)$("#modeBadge").textContent="MODE LIBRE";
 if(scenarioMode){$("#modeBadge").textContent="SCÉNARIO STRATÉGIQUE";$("#commandLock").hidden=false;$("#commandLock").textContent="🔒 MODE VERROUILLÉ : "+(defenseMode==="manual"?"COMMANDANT MANUEL":defenseMode==="ai"?"COMMANDANT IA":"COMMANDEMENT CONJOINT");}
 $("#freeSettings").hidden=true;$("#home").hidden=true;$("#game").hidden=false;
 running=true;
 (s.objects||[]).forEach(createRestoredObject);
 (s.projectiles||[]).forEach(p=>addP(p.type,p.x,p.y,p.vx,p.vy,p.primary,p.crossed));
 (s.mines||[]).forEach(md=>{const m=addMine(md.ringIndex,md.ringR,md.angle,md.state);m.x=md.x;m.y=md.y;m.targetId=md.targetId;m.el.style.left=m.x+"%";m.el.style.top=m.y+"%";if(m.state==="hunt")m.el.classList.add("hunting")});
 (s.decoys||[]).forEach(dd=>addDecoy(dd.x,dd.y,dd.vx,dd.vy,dd.crossed));
 renderArsenal();renderDefenseMode();update();
 $("#status").textContent="PARTIE RESTAURÉE — NIVEAU "+gLevel;
 // Continue spawning only if this wave still has contacts to generate.
 clearTimeout(spawnTimer);
 if(spawned<target())spawnTimer=setTimeout(()=>{if(running)makeObject()},450);
 raf=requestAnimationFrame(loop);
 restoringGame=false;persistGame(true);
 return true;
}

function freeDue(name){
 const r=freeRules[name];return gLevel>=r.start && (gLevel-r.start)%r.freq===0;
}
function readFreeRules(){
 const val=id=>Math.max(1,Math.min(99,parseInt($("#"+id).value,10)||1));
 freeRules={
  cluster:{start:val("freeClusterStart"),freq:val("freeClusterFreq")},
  blue:{start:val("freeBlueStart"),freq:val("freeBlueFreq")},
  emp:{start:val("freeEmpStart"),freq:val("freeEmpFreq")},
  black:{start:val("freeBlackStart"),freq:val("freeBlackFreq")},
  atomic:{start:val("freeAtomicStart"),freq:val("freeAtomicFreq")},
  mine:{start:val("freeMineStart"),freq:val("freeMineFreq")},
  decoy:{start:val("freeDecoyStart"),freq:val("freeDecoyFreq")}
 };
}
function freeRegen(name){
 const r=freeRules[name];
 if(gLevel<r.start)return Math.round(Math.max(0,(gLevel-1)/(Math.max(1,r.start-1))*100));
 return Math.round(((gLevel-r.start)%r.freq)/r.freq*100);
}
function regenPercent(step){
 if(trainingMode)return 100;
 // Level 1 is the starting point: progress is based on completed gLevel transitions.
 return Math.min(100,Math.round((((gLevel-1)%step)/step)*100));
}
function setRegen(name,pct){
 const bar=$("#"+name+"Regen"),txt=$("#"+name+"Pct"),btn=$("#weapon"+name.charAt(0).toUpperCase()+name.slice(1));
 if(bar)bar.style.width=pct+"%";if(txt)txt.textContent=trainingMode?"∞":pct+"%";
 if(btn)btn.classList.toggle("ready",pct>=100);
}
function renderDefenseMode(){
 const aiBtn=$("#aiDefense"),hybridBtn=$("#hybridDefense"),box=document.querySelector(".arsenal");
 if(!aiBtn||!hybridBtn||!box)return;
 aiBtn.classList.toggle("active",defenseMode==="ai");
 hybridBtn.classList.toggle("active",defenseMode==="hybrid");
 box.classList.toggle("ai-locked",defenseMode==="ai");
 aiBtn.setAttribute("aria-pressed",defenseMode==="ai");hybridBtn.setAttribute("aria-pressed",defenseMode==="hybrid");
}
function setDefenseMode(mode){
 if(scenarioMode&&running)return;
 defenseMode=(defenseMode===mode)?"manual":mode;
 renderDefenseMode();renderArsenal();persistGame(true);
 $("#status").textContent=defenseMode==="ai"?"IA AUX COMMANDES — ARSENAL VERROUILLÉ POUR L’UTILISATEUR":defenseMode==="hybrid"?"DÉFENSE PARTAGÉE — IA + UTILISATEUR":"DÉFENSE MANUELLE";
 tone(defenseMode==="manual"?440:780,.09,.025,"triangle");
}
function aiCanUse(name){return trainingMode || ((arsenal[name]||0)>0 && (scenarioMode || !used[name]));}
function aiDefenseStep(now){
 if(!running||defenseMode==="manual"||now-lastAIAction<260)return;
 lastAIAction=now;
 const reds=objects.filter(o=>!o.done&&o.revealed&&o.kind==="red").sort((a,b)=>a.r-b.r);
 if(!reds.length)return;
 aiActing=true;
 try{
  // L'IA conserve les armes rares pour les vagues chargées et privilégie la menace la plus proche du centre.
  const critical=reds.filter(o=>o.r<.18).length,near=reds.filter(o=>o.r<.28).length;
  if((reds.length>=6||critical>=3)&&aiCanUse("atomic")){useAtomic();return}
  if((reds.length>=5||critical>=3)&&aiCanUse("emp")){useEMP();return}
  if((reds.length>=4||near>=3)&&aiCanUse("mine")){useMine();return}
  if((reds.length>=4||near>=3)&&aiCanUse("decoy")){useDecoy();return}
  if((reds.length>=3||critical>=2)&&aiCanUse("black")){useBlack();return}
  if((reds.length>=3||critical>=2)&&aiCanUse("cluster")){useCluster();return}
  if((reds.length>=2||critical>=1)&&aiCanUse("blue")){useBlue();return}
  shoot(reds[0]);
 }finally{aiActing=false}
}
function renderArsenal(){
  if(trainingMode){
    empCount.textContent="∞";clusterCount.textContent="∞";blueCount.textContent="∞";
    weaponEmp.disabled=!running;weaponCluster.disabled=!running;weaponBlue.disabled=!running;
  }else{
    empCount.textContent=arsenal.emp;clusterCount.textContent=arsenal.cluster;blueCount.textContent=arsenal.blue;
    weaponEmp.disabled=!running||!arsenal.emp||(!scenarioMode&&used.emp);
    weaponCluster.disabled=!running||!arsenal.cluster||(!scenarioMode&&used.cluster);
    weaponBlue.disabled=!running||!arsenal.blue||(!scenarioMode&&used.blue);
  }

  setRegen("emp",trainingMode?100:(freeMode?freeRegen("emp"):regenPercent(5)));
  setRegen("cluster",trainingMode?100:(freeMode?freeRegen("cluster"):regenPercent(3)));
  setRegen("blue",trainingMode?100:(freeMode?freeRegen("blue"):regenPercent(4)));

  blackCount.textContent=trainingMode?"∞":arsenal.black;
  atomicCount.textContent=trainingMode?"∞":arsenal.atomic;
  weaponBlack.disabled=!running||(!trainingMode&&(!arsenal.black||(!scenarioMode&&used.black)));
  weaponAtomic.disabled=!running||(!trainingMode&&(!arsenal.atomic||(!scenarioMode&&used.atomic)));
  setRegen("black",trainingMode?100:(freeMode?freeRegen("black"):regenPercent(7)));
  setRegen("atomic",trainingMode?100:(freeMode?freeRegen("atomic"):regenPercent(8)));

  mineCount.textContent=trainingMode?"∞":arsenal.mine;
  weaponMine.disabled=!running||(!trainingMode&&(!arsenal.mine||(!scenarioMode&&used.mine)));
  setRegen("mine",trainingMode?100:(freeMode?freeRegen("mine"):regenPercent(5)));

  decoyCount.textContent=trainingMode?"∞":arsenal.decoy;
  weaponDecoy.disabled=!running||(!trainingMode&&(!arsenal.decoy||(!scenarioMode&&used.decoy)));
  setRegen("decoy",trainingMode?100:(freeMode?freeRegen("decoy"):regenPercent(4)));
}
function awardWeapons(){
 if(scenarioMode){used={emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false};renderArsenal();return;}
 // IMPORTANT: stock is NEVER reset here. Only the "used this level" locks reset.
 if(trainingMode){
   used={emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false};
   renderArsenal(); return;
 }
 const won=[];
 const give=(name,label)=>{ arsenal[name]=(arsenal[name]||0)+1; won.push(label); };

 if(freeMode){
   if(freeDue("cluster")) give("cluster","SOUS-MUNITIONS");
   if(freeDue("blue")) give("blue","BOULE BLEUE");
   if(freeDue("emp")) give("emp","ONDE EM");
   if(freeDue("black")) give("black","ARME NOIRE");
   if(freeDue("atomic")) give("atomic","ATOMIQUE");
   if(freeDue("mine")) give("mine","MINE MAGNÉTIQUE");
   if(freeDue("decoy")) give("decoy","LEURRE");
 }else{
   if(gLevel%3===0) give("cluster","SOUS-MUNITIONS");
   if(gLevel%4===0) give("blue","BOULE BLEUE");
   if(gLevel%5===0) give("emp","ONDE EM");
   if(gLevel%7===0) give("black","ARME NOIRE");
   if(gLevel%8===0) give("atomic","ATOMIQUE");
   if(gLevel%5===0) give("mine","MINE MAGNÉTIQUE");
   if(gLevel%4===0) give("decoy","LEURRE");
 }
 // One use of each weapon TYPE per level; inventory itself remains accumulated.
 used={emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false};
 renderArsenal();
 if(won.length){
   $("#status").textContent="ARME GAGNÉE : "+won.join(" + ");
   tone(1050,.16,.04,"square");
 }
}
function boom(x,y,c="#ff555d"){let e=document.createElement("i");e.className="weapon-boom";e.style.left=x+"%";e.style.top=y+"%";e.style.color=c;$("#radar").appendChild(e);setTimeout(()=>e.remove(),420)}
function weaponKill(o,x,y,source="unknown"){if(o.done||o.kind!=="red")return;gScore+=10+gLevel*2;kills++;sessionKills++;runStats.kills++;if(runStats.weaponKills[source]!==undefined)runStats.weaponKills[source]++;boom(x,y);removeObj(o);o.el.remove();tone(920,.07,.04,"square");update();checkLevel()}
function useEMP(){if(weaponEmp.disabled)return;runStats.weaponShots.emp++;persistGame(true);if(!trainingMode){arsenal.emp--;if(!scenarioMode)used.emp=true;}renderArsenal();let e=document.createElement("i");e.className="emp-wave";$("#radar").appendChild(e);tone(260,.5,.05);setTimeout(()=>[...objects].forEach(o=>{if(o.kind==="red"&&!o.done)weaponKill(o,parseFloat(o.el.style.left),parseFloat(o.el.style.top),"emp")}),450);setTimeout(()=>e.remove(),1150)}
function addP(type,x,y,vx,vy,primary=false,crossed=null){
 if(projectiles.length>=220)return;
 const e=document.createElement("i");
 e.className="projectile "+type;
 e.style.left=x+"%";e.style.top=y+"%";
 $("#radar").appendChild(e);
 projectiles.push({type,x,y,vx,vy,e,last:performance.now(),primary,crossed:new Set(crossed||[])});
}
function useCluster(){if(weaponCluster.disabled)return;runStats.weaponShots.cluster++;persistGame(true);if(!trainingMode){arsenal.cluster--;if(!scenarioMode)used.cluster=true;}renderArsenal();[[0,-.16],[0,.16],[-.16,0],[.16,0]].forEach(v=>addP("purple",50,50,v[0],v[1],true));tone(520,.14,.04)}
function useBlue(){if(weaponBlue.disabled)return;runStats.weaponShots.blue++;persistGame(true);if(!trainingMode){arsenal.blue--;if(!scenarioMode)used.blue=true;}renderArsenal();let a=Math.random()*Math.PI*2;addP("blue",50,50,Math.cos(a)*.13,Math.sin(a)*.13);tone(720,.14,.04)}
function rmP(p){projectiles=projectiles.filter(q=>q!==p);p.e.remove()}
function useBlack(){
 if(weaponBlack.disabled)return;runStats.weaponShots.black++;persistGame(true);
 if(!trainingMode){arsenal.black--;if(!scenarioMode)used.black=true}renderArsenal();
 let a=Math.random()*Math.PI*2;addP("black",50,50,Math.cos(a)*.125,Math.sin(a)*.125);
 tone(190,.18,.045,"square");$("#status").textContent="ARME NOIRE DÉPLOYÉE";
}
function useAtomic(){
 if(weaponAtomic.disabled)return;runStats.weaponShots.atomic++;persistGame(true);
 if(!trainingMode){arsenal.atomic--;if(!scenarioMode)used.atomic=true}renderArsenal();
 let a=Math.random()*Math.PI*2;addP("atomic",50,50,Math.cos(a)*.115,Math.sin(a)*.115);
 tone(1120,.18,.035);$("#status").textContent="ATOMIQUE DÉPLOYÉE";
}
function atomicBlast(p){
 const wave=document.createElement("i");wave.className="atomic-wave";wave.style.left=p.x+"%";wave.style.top=p.y+"%";$("#radar").appendChild(wave);
 const originX=p.x,originY=p.y,start=performance.now(),duration=900,maxR=58;
 tone(115,.55,.065,"sawtooth");
 function blast(t){
  const rr=Math.min(maxR,(t-start)/duration*maxR);
  [...objects].forEach(o=>{
   if(o.done||o.kind!=="red"||o.atomicMarked)return;
   const x=parseFloat(o.el.style.left),y=parseFloat(o.el.style.top);
   const d=Math.hypot(x-originX,y-originY);
   if(d<=rr+2){o.atomicMarked=true;weaponKill(o,x,y,"atomic")}
  });
  if(t-start<duration)requestAnimationFrame(blast);else wave.remove()
 }
 requestAnimationFrame(blast);
}
let mines=[],nextMineId=1;
// 2 mines dans le 1er cercle, 4 dans le 2e, 6 dans le 3e, 8 sur le pourtour = 20 mines au total.
const MINE_RINGS=[{r:.125,count:2},{r:.25,count:4},{r:.375,count:6},{r:.485,count:8}];
const MINE_DETECT=.035,MINE_BLAST=7,MINE_HUNT_SPEED=48;
function addMine(ringIndex,ringR,angle,state){
 const e=document.createElement("i");e.className="mine";$("#radar").appendChild(e);
 const dir=ringIndex%2===0?1:-1,angularSpeed=(.32-ringIndex*.025)*dir;
 const m={id:nextMineId++,ringIndex,ringR,angle,angularSpeed,state:state||"patrol",targetId:null,el:e,last:performance.now(),exploding:false};
 m.x=50+Math.cos(angle)*ringR*100;m.y=50+Math.sin(angle)*ringR*100;
 e.style.left=m.x+"%";e.style.top=m.y+"%";
 mines.push(m);return m;
}
function deployMines(){
 MINE_RINGS.forEach((ring,idx)=>{
  for(let i=0;i<ring.count;i++){
   const angle=(i/ring.count)*Math.PI*2+Math.random()*.35;
   addMine(idx,ring.r,angle);
  }
 });
}
function removeMine(m){m.state="gone";mines=mines.filter(q=>q!==m);if(m.el)m.el.remove()}
function explodeMine(m,x,y){
 if(m.exploding||m.state==="gone")return;m.exploding=true;
 boom(x,y,"#7fe9ff");tone(230,.1,.05,"square");
 [...objects].forEach(o=>{
  if(o.done||o.kind!=="red")return;
  const ox=parseFloat(o.el.style.left),oy=parseFloat(o.el.style.top);
  if(Math.hypot(ox-x,oy-y)<=MINE_BLAST)weaponKill(o,ox,oy,"mine");
 });
 mines.slice().forEach(mm=>{
  if(mm===m||mm.exploding||mm.state==="gone")return;
  if(Math.hypot(mm.x-x,mm.y-y)<=MINE_BLAST)explodeMine(mm,mm.x,mm.y);
 });
 removeMine(m);
}
function detectRedInRings(){
 objects.forEach(o=>{
  if(o.done||o.kind!=="red"||!o.revealed)return;
  MINE_RINGS.forEach((ring,idx)=>{
   if(Math.abs(o.r-ring.r)<MINE_DETECT){
    mines.forEach(m=>{if(m.ringIndex===idx&&m.state==="patrol"){m.state="hunt";m.targetId=o.id}});
   }
  });
 });
}
function updateMines(now){
 mines.slice().forEach(m=>{
  if(m.exploding||m.state==="gone")return;
  const dt=Math.min(.05,(now-m.last)/1000);m.last=now;
  if(m.state==="hunt"){
   const target=objects.find(o=>o.id===m.targetId&&!o.done);
   if(!target){m.state="patrol";m.angle=Math.atan2((m.y-50)/100,(m.x-50)/100);return}
   const tx=parseFloat(target.el.style.left),ty=parseFloat(target.el.style.top);
   const dx=tx-m.x,dy=ty-m.y,dist=Math.hypot(dx,dy)||.0001;
   if(dist<3){explodeMine(m,tx,ty);return}
   m.x+=dx/dist*MINE_HUNT_SPEED*dt;m.y+=dy/dist*MINE_HUNT_SPEED*dt;
   m.el.classList.add("hunting");
  }else{
   m.angle+=m.angularSpeed*dt;
   m.x=50+Math.cos(m.angle)*m.ringR*100;m.y=50+Math.sin(m.angle)*m.ringR*100;
   m.el.classList.remove("hunting");
  }
  m.el.style.left=m.x+"%";m.el.style.top=m.y+"%";
 });
 detectRedInRings();
}
function useMine(){
 if(weaponMine.disabled)return;runStats.weaponShots.mine++;persistGame(true);
 if(!trainingMode){arsenal.mine--;if(!scenarioMode)used.mine=true}renderArsenal();
 deployMines();
 tone(260,.16,.045,"square");$("#status").textContent="20 MINES MAGNÉTIQUES DÉPLOYÉES";
}
function clearMines(){mines.forEach(m=>m.el.remove());mines=[]}
function serializeMine(m){return{ringIndex:m.ringIndex,ringR:m.ringR,angle:m.angle,x:m.x,y:m.y,state:m.state,targetId:m.targetId}}

let decoys=[];
const DECOY_CIRCLES=[12.5,25,37.5],DECOY_SPEED=.105,DECOY_ATTRACT=1.9;
function addDecoy(x=50,y=50,vx=0,vy=0,crossed=null){
 if(decoys.length>=128)return null;
 const e=document.createElement("i");e.className="decoy";$("#radar").appendChild(e);
 const d={x,y,vx,vy,e,last:performance.now(),crossed:new Set(crossed||[]),bounceUntil:0};
 e.style.left=x+"%";e.style.top=y+"%";decoys.push(d);return d;
}
function removeDecoy(d){decoys=decoys.filter(q=>q!==d);if(d.e)d.e.remove()}
function clearDecoys(){decoys.forEach(d=>d.e&&d.e.remove());decoys=[]}
function serializeDecoy(d){return{x:d.x,y:d.y,vx:d.vx,vy:d.vy,crossed:[...(d.crossed||[])]}}
function deployDecoys(){
 for(let i=0;i<8;i++){const a=i*Math.PI/4;addDecoy(50,50,Math.cos(a)*DECOY_SPEED,Math.sin(a)*DECOY_SPEED)}
}
function useDecoy(){
 if(weaponDecoy.disabled)return;runStats.weaponShots.decoy++;persistGame(true);
 if(!trainingMode){arsenal.decoy--;if(!scenarioMode)used.decoy=true}renderArsenal();deployDecoys();
 tone(870,.12,.035,"triangle");setTimeout(()=>tone(1180,.1,.025,"triangle"),90);$("#status").textContent="8 LEURRES TURQUOISE DÉPLOYÉS";
}
function attractRedsToDecoys(dt){
 if(!decoys.length)return;
 objects.forEach(o=>{
  if(o.done||o.kind!=="red")return;
  const ox=50+Math.cos(o.angle)*o.r*100,oy=50+Math.sin(o.angle)*o.r*100;
  let best=null,bd=Infinity;
  decoys.forEach(d=>{const q=(d.x-ox)**2+(d.y-oy)**2;if(q<bd){bd=q;best=d}});
  if(!best)return;
  const desired=Math.atan2(best.y-50,best.x-50),delta=Math.atan2(Math.sin(desired-o.angle),Math.cos(desired-o.angle));
  o.angle+=Math.max(-DECOY_ATTRACT*dt,Math.min(DECOY_ATTRACT*dt,delta));
 });
}
function bounceDecoyFriend(d,o,now){
 if(now<(d.bounceUntil||0)||now<(o.bounceUntil||0))return;
 const ox=parseFloat(o.el.style.left),oy=parseFloat(o.el.style.top),dx=d.x-ox,dy=d.y-oy,dist=Math.hypot(dx,dy)||.001;
 if(dist>3.2)return;
 const nx=dx/dist,ny=dy/dist,dot=d.vx*nx+d.vy*ny;d.vx-=2*dot*nx;d.vy-=2*dot*ny;
 o.radialDir=(o.radialDir||-1)*-1;o.angle+=.16*(dx>=0?1:-1);d.x+=nx*.9;d.y+=ny*.9;
 d.bounceUntil=o.bounceUntil=now+320;tone(560,.045,.014,"triangle");
}
function updateDecoys(now){
 [...decoys].forEach(d=>{
  if(!d.e||!d.e.isConnected)return;
  const dt=Math.min(.04,(now-d.last)/1000);d.last=now;
  d.x+=d.vx*dt*100;d.y+=d.vy*dt*100;const rr=Math.hypot(d.x-50,d.y-50);
  if(rr>48){const nx=(d.x-50)/rr,ny=(d.y-50)/rr,dot=d.vx*nx+d.vy*ny;d.vx-=2*dot*nx;d.vy-=2*dot*ny;d.x=50+nx*47;d.y=50+ny*47;tone(700,.025,.008,"triangle")}
  d.e.style.left=d.x+"%";d.e.style.top=d.y+"%";
  for(const o of [...objects]){
   if(o.done)continue;const ox=parseFloat(o.el.style.left),oy=parseFloat(o.el.style.top);if(!Number.isFinite(ox)||Math.hypot(d.x-ox,d.y-oy)>3.1)continue;
   if(o.kind==="red"){
    boom(d.x,d.y,"#32ffe6");weaponKill(o,ox,oy,"decoy");removeDecoy(d);tone(1080,.07,.03,"square");break;
   }
   if(o.kind==="yellow")bounceDecoyFriend(d,o,now);
  }
 });
}
function updateP(now){
 const circles=[12.5,25,37.5];
 [...projectiles].forEach(p=>{
  if(!p.e.isConnected)return;
  let dt=Math.min(40,now-p.last)/1000;p.last=now;
  let oldR=Math.hypot(p.x-50,p.y-50);
  p.x+=p.vx*dt*100;p.y+=p.vy*dt*100;
  let rr=Math.hypot(p.x-50,p.y-50);

  circles.forEach((cr,idx)=>{
   if(oldR<cr&&rr>=cr&&!p.crossed.has(idx)){
    p.crossed.add(idx);
    let base=Math.atan2(p.vy,p.vx),speed=Math.hypot(p.vx,p.vy);
    if(p.type==="purple"){
     [-.72,-.25,.25].forEach(off=>{let a=base+off+(Math.random()-.5)*.14;addP("purple",p.x,p.y,Math.cos(a)*speed,Math.sin(a)*speed,false,[...p.crossed])});
     tone(610,.035,.012)
    }else if(p.type==="blue"||p.type==="atomic"){
     let a=base+(Math.random()<.5?1:-1)*(.42+Math.random()*.22);
     addP(p.type,p.x,p.y,Math.cos(a)*speed,Math.sin(a)*speed,false,[...p.crossed]);
     tone(p.type==="atomic"?1080:790,.04,.014)
    }else if(p.type==="black"){
     // Parent + 2 children = triple.
     [-.48,.48].forEach(off=>{let a=base+off+(Math.random()-.5)*.12;addP("black",p.x,p.y,Math.cos(a)*speed,Math.sin(a)*speed,false,[...p.crossed])});
     tone(220,.04,.015,"square")
    }
   }
  });

  if(p.type==="purple"){
   if(rr>49){rmP(p);return}
  }else if(rr>48){
   let nx=(p.x-50)/rr,ny=(p.y-50)/rr,d=p.vx*nx+p.vy*ny;
   p.vx-=2*d*nx;p.vy-=2*d*ny;p.x=50+nx*47;p.y=50+ny*47;
   tone(p.type==="black"?180:390,.035,.01)
  }

  p.e.style.left=p.x+"%";p.e.style.top=p.y+"%";
  for(let o of [...objects]){
   if(o.done)continue;
   let ox=parseFloat(o.el.style.left),oy=parseFloat(o.el.style.top);
   if((p.x-ox)**2+(p.y-oy)**2<8){
    if(o.kind==="red"){
     if(p.type==="atomic"){atomicBlast(p);rmP(p);break}
     weaponKill(o,p.x,p.y,p.type);rmP(p);break
    }else if(p.type==="blue"||p.type==="black"||p.type==="atomic"){
     // Defensive projectiles rebound on non-red contacts.
     p.vx=-p.vx;p.vy=-p.vy;
     o.angle+=.25*(Math.random()<.5?-1:1);
     tone(460,.04,.012);break
    }
   }
  }
 })
}

function ctx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();return audioCtx}
function tone(f=500,d=.08,vol=.06,type="sine"){
 if(!audioOn)return;const a=ctx(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);
 o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.start();o.stop(a.currentTime+d)
}
function target(){return cfg[$("#difficulty").value].count+Math.floor((gLevel-1)*1.5)+(scenarioMode&&scenarioMission?scenarioMission.bonusContacts:0)}
function hearts(){
 const full=Math.floor(gLives),half=gLives-full;
 return "♥".repeat(full)+(half>=.5?"♡":"");
}
function update(){
 $("#score").textContent=gScore;$("#level").textContent=gLevel;$("#lives").textContent=hearts();
 $("#remaining").textContent=Math.max(0,target()-kills);
 $("#sweep").style.animationDuration=Math.max(1.45,4-gLevel*.10)+"s"
}
function announce(){
 let b=$(".level-banner");if(!b){b=document.createElement("div");b.className="level-banner";$("#radar").appendChild(b)}
 b.textContent="NIVEAU "+gLevel;b.classList.remove("show");void b.offsetWidth;b.classList.add("show");
 $("#status").textContent=gLevel>=3?"VAGUE "+gLevel+" — IDENTIFIEZ LES CONTACTS":"VAGUE "+gLevel+" — PROTÉGEZ LE CENTRE";
 tone(620,.12,.035);setTimeout(()=>tone(850,.13,.03),130)
}
function makeObject(){
 if(!running||spawned>=target())return;
 const radar=$("#radar"),el=document.createElement("button"),angle=Math.random()*Math.PI*2;
 // Levels 1-2: classic red enemies. Level 3+: some contacts turn green.
 let kind="red",revealed=true;
 if(gLevel>=3 && Math.random()<Math.min(.65,.35+(gLevel-3)*.035)){kind=Math.random()<.58?"red":"yellow";revealed=false}
 el.className=revealed?"enemy":"contact-v4";
 el.setAttribute("aria-label","Contact radar");radar.appendChild(el);
 const item={id:nextId++,el,angle,r:.485,last:performance.now(),kind,revealed,done:false,radialDir:-1,bounceUntil:0};
 objects.push(item);spawned++;
 el.addEventListener("pointerdown",ev=>{ev.preventDefault();shoot(item)});
 const base=cfg[$("#difficulty").value].spawn;
 spawnTimer=setTimeout(makeObject,Math.max(300,base-gLevel*65));persistGame(true)
}
function reveal(item){
 if(item.revealed||gLevel<3)return;
 // Must change no later than the second ring: reveal around outer/second-circle zone.
 item.revealed=true;item.el.className="contact-v4 "+item.kind;
 if(item.kind==="red")tone(760,.07,.025);
 else tone(520,.07,.018)
}
function removeObj(item){
 objects=objects.filter(x=>x!==item);item.done=true;
}
function shoot(item){
 if(defenseMode==="ai"&&!aiActing)return;
 if(!running||item.done||!item.el.isConnected)return;runStats.manualShots++;persistGame(true);
 if(!item.revealed){ // green: neutral, don't reward blind firing
   $("#status").textContent="CONTACT NON IDENTIFIÉ";tone(240,.08,.025);return;
 }
 if(item.kind==="yellow"){
   gLives=Math.max(0,gLives-.5);runStats.friendlyFire++;$("#status").textContent="AMI TOUCHÉ : −½ VIE";
   tone(125,.32,.075,"sawtooth");item.el.classList.add("vanish");removeObj(item);
   setTimeout(()=>item.el.remove(),330);update();if(gLives<=0)end();else checkLevel();return;
 }
 gScore+=10+gLevel*2;kills++;sessionKills++;runStats.kills++;runStats.manualKills++;$("#status").textContent="MENACE DÉTRUITE";
 tone(980,.06,.055,"square");item.el.classList.add("hit");removeObj(item);
 setTimeout(()=>item.el.remove(),170);update();checkLevel()
}
function redImpact(item){
 removeObj(item);item.el.remove();gLives=Math.max(0,gLives-1);runStats.impacts++;tone(105,.32,.09,"sawtooth");
 $("#radar").classList.remove("danger");void $("#radar").offsetWidth;$("#radar").classList.add("danger");
 $("#status").textContent="IMPACT AU CENTRE !";update();persistGame(true);if(gLives<=0)end();else checkLevel()
}
function yellowExit(item){
 removeObj(item);item.el.classList.add("vanish");$("#status").textContent="CONTACT AMI SORTI DE LA ZONE";
 tone(420,.08,.018);setTimeout(()=>item.el.remove(),330);persistGame(true);checkLevel()
}
function checkLevel(){
 if(spawned>=target() && objects.length===0){
   clearTimeout(spawnTimer);
   if(scenarioMode){completeScenarioMission();return;}
   gLevel++;kills=0;spawned=0;gScore+=50;awardWeapons();update();persistGame(true);
   setTimeout(()=>{if(running){announce();makeObject()}},900)
 }
}
function bounceContactPair(a,b,now){
 if(a.done||b.done||now<(a.bounceUntil||0)||now<(b.bounceUntil||0))return;
 const ca=a.revealed?a.kind:"green",cb=b.revealed?b.kind:"green";
 if(ca!=="red"&&cb!=="red"&&!(ca==="yellow"&&cb==="yellow"))return;
 const ax=parseFloat(a.el.style.left),ay=parseFloat(a.el.style.top),bx=parseFloat(b.el.style.left),by=parseFloat(b.el.style.top);
 if(!Number.isFinite(ax)||!Number.isFinite(bx))return;
 const dx=ax-bx,dy=ay-by;if(dx*dx+dy*dy>5.2)return;
 a.radialDir=(a.radialDir||-1)*-1;b.radialDir=(b.radialDir||-1)*-1;
 const turn=.12;a.angle+=turn*(dx>=0?1:-1);b.angle-=turn*(dx>=0?1:-1);
 a.bounceUntil=b.bounceUntil=now+420;tone(330,.045,.018);
}
function resolveContactCollisions(now){
 const active=objects.filter(o=>!o.done&&o.el.isConnected);
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)bounceContactPair(active[i],active[j],now);
}
function bounceProjectilePair(a,b,now){
 // Friendly weapon balls rebound off each other, except purple sub-munitions which pass through/split instead.
 if(a.type==="purple"||b.type==="purple")return;
 if(now<(a.bounceUntilP||0)||now<(b.bounceUntilP||0))return;
 if(!a.e.isConnected||!b.e.isConnected)return;
 const dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;
 if(d2>4.2)return;
 const dist=Math.sqrt(d2)||0.0001,nx=dx/dist,ny=dy/dist;
 // Elastic swap of velocity (equal-mass collision) plus a small separation push so the pair doesn't re-trigger immediately.
 const avx=a.vx,avy=a.vy;
 a.vx=b.vx;a.vy=b.vy;b.vx=avx;b.vy=avy;
 a.x+=nx*.7;a.y+=ny*.7;b.x-=nx*.7;b.y-=ny*.7;
 a.bounceUntilP=b.bounceUntilP=now+260;
 tone(600,.045,.015,"triangle")
}
function resolveProjectileCollisions(now){
 const active=projectiles.filter(p=>p.type!=="purple"&&p.e&&p.e.isConnected);
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)bounceProjectilePair(active[i],active[j],now);
}
function loop(now){
 if(!running)return;
 if(!lastPlayTick)lastPlayTick=now;
 runStats.playTimeMs=(runStats.playTimeMs||0)+Math.max(0,Math.min(1000,now-lastPlayTick));
 lastPlayTick=now;
 aiDefenseStep(now);
 updateP(now);
 resolveProjectileCollisions(now);
 updateMines(now);
 updateDecoys(now);
 const diff=cfg[$("#difficulty").value];
 attractRedsToDecoys(Math.min(.04,1/60));
 [...objects].forEach(x=>{
   if(x.done)return;
   const dt=Math.min(40,now-x.last);x.last=now;
   const factor=1+(gLevel-1)*.075;
   x.r+=x.radialDir*diff.speed*factor*(dt/1000);
   if(x.r>=.485){x.r=.485;x.radialDir=-1;}
   // Reveal green contacts by the second concentric circle at the latest.
   if(!x.revealed && x.r<=.365)reveal(x);
   const px=50+Math.cos(x.angle)*x.r*100,py=50+Math.sin(x.angle)*x.r*100;
   x.el.style.left=px+"%";x.el.style.top=py+"%";
   const scale=Math.max(.72,1.18-x.r*.65);x.el.style.width=(22*scale)+"px";x.el.style.height=(22*scale)+"px";
   // Yellow contacts disappear naturally at the last/inner circle; red continues to center.
   if(x.revealed && x.kind==="yellow" && x.r<=.125)yellowExit(x);
   else if(x.kind==="red" && x.r<=.025)redImpact(x)
 });
 resolveContactCollisions(now);persistGame(false);
 raf=requestAnimationFrame(loop)
}
function clearObjects(){objects.forEach(x=>x.el.remove());objects=[];clearTimeout(spawnTimer)}
function startGame(){
 scenarioMode=false;document.body.classList.remove("scenario-mode");
 trainingMode=false;freeMode=false;
 document.body.classList.remove("training-mode");
 $("#modeBadge").hidden=true;
 startGameCommon();
}
function startTraining(){
 scenarioMode=false;document.body.classList.remove("scenario-mode");
 $("#freeSettings").hidden=true;
 trainingMode=true;freeMode=false;
 document.body.classList.add("training-mode");
 $("#modeBadge").hidden=false;
 startGameCommon();
}
function startGameCommon(){
 defenseMode="manual";lastAIAction=0;renderDefenseMode();
 clearSavedGame();$("#freeSettings").hidden=true;
 ctx();gScore=0;gLevel=1;gLives=3;kills=0;spawned=0;sessionKills=0;runStats=emptyRunStats();lastPlayTick=performance.now();
 arsenal={emp:0,cluster:0,blue:0,black:0,atomic:0,mine:0,decoy:0};used={emp:false,cluster:false,blue:false,black:false,atomic:false,mine:false,decoy:false};
 projectiles.forEach(p=>p.e.remove());projectiles=[];clearMines();clearDecoys();
 running=true;clearObjects();renderArsenal();
 $("#home").hidden=true;$("#game").hidden=false;update();announce();
 setTimeout(()=>{if(running)makeObject()},700);raf=requestAnimationFrame(loop);persistGame(true)
}
function end(){
 if(!running)return;persistGame(true);running=false;clearSavedGame();if(!trainingMode)commitRecords();clearTimeout(spawnTimer);cancelAnimationFrame(raf);clearObjects();clearMines();clearDecoys();
 $("#finalScore").textContent=gScore;$("#finalLevel").textContent=gLevel;$("#over").showModal();tone(160,.5,.07,"sawtooth")
}
function goHome(){if(running&&!trainingMode)commitRecords();running=false;clearSavedGame();clearTimeout(spawnTimer);cancelAnimationFrame(raf);clearObjects();clearMines();clearDecoys();if($("#over").open)$("#over").close();$("#game").hidden=true;$("#home").hidden=false;$("#freeSettings").hidden=true;trainingMode=false;defenseMode="manual";renderDefenseMode();document.body.classList.remove("training-mode");$("#modeBadge").hidden=true}
$("#start").onclick=startGame;
$("#again").onclick=()=>{$("#over").close();startGame()};
$("#back").onclick=goHome;
$("#quit").onclick=()=>{if(!running||confirm("Quitter la partie en cours et revenir à l’accueil ?"))goHome()};
$("#sound").onclick=()=>{audioOn=!audioOn;$("#sound").textContent=audioOn?"🔊":"🔇";if(audioOn)ctx()};

renderRecords();
$("#recordsToggle").addEventListener("click",()=>$("#records").classList.toggle("closed"));
$("#resetRecords").addEventListener("click",()=>{
 if(confirm("Réinitialiser tous les records ?")){
   saveRecords(defaultRecords());
 }
});

// V15 — export / import / reset séparés pour le meilleur score et la dernière partie
$("#exportBestRun").addEventListener("click",()=>{
 const r=getRecords();
 if(!r.bestRun){alert("Aucun record à exporter pour le moment.");return}
 downloadJSON(r.bestRun,"radar_meilleur_score.json");
});
$("#exportLastRun").addEventListener("click",()=>{
 const r=getRecords();
 if(!r.lastRun){alert("Aucune partie jouée à exporter pour le moment.");return}
 downloadJSON(r.lastRun,"radar_derniere_partie.json");
});
$("#importBestRunBtn").addEventListener("click",()=>$("#importBestRunFile").click());
$("#importLastRunBtn").addEventListener("click",()=>$("#importLastRunFile").click());
$("#importBestRunFile").addEventListener("change",e=>{
 const file=e.target.files[0];if(!file)return;
 readJSONFile(file,data=>{
  if(!isValidRunData(data)){alert("Le fichier ne correspond pas au format attendu d'une partie.");return}
  if(!confirm("Remplacer le record du meilleur score par les données importées ?"))return;
  const r=getRecords();
  r.bestRun=normalizeRunData(data);
  r.bestScore=Math.max(r.bestScore||0,data.score||0);
  r.bestLevel=Math.max(r.bestLevel||1,data.level||1);
  saveRecords(r);
 });
 e.target.value="";
});
$("#importLastRunFile").addEventListener("change",e=>{
 const file=e.target.files[0];if(!file)return;
 readJSONFile(file,data=>{
  if(!isValidRunData(data)){alert("Le fichier ne correspond pas au format attendu d'une partie.");return}
  if(!confirm("Remplacer les statistiques de la dernière partie par les données importées ?"))return;
  const r=getRecords();
  r.lastRun=normalizeRunData(data);
  saveRecords(r);
 });
 e.target.value="";
});
$("#resetBestRun").addEventListener("click",()=>{
 if(!confirm("Réinitialiser uniquement le record du meilleur score ?"))return;
 const r=getRecords();
 r.bestRun=null;r.bestScore=0;r.bestLevel=1;
 saveRecords(r);
});
$("#resetLastRun").addEventListener("click",()=>{
 if(!confirm("Réinitialiser uniquement les statistiques de la dernière partie ?"))return;
 const r=getRecords();
 r.lastRun=null;
 saveRecords(r);
});


function modeExport(mode,label){
 const r=getRecords(),g=normalizeModeRecords(r[mode]);
 if(!g.games&&!g.bestRun&&!g.lastRun){alert("Aucune statistique "+label+" à exporter.");return}
 downloadJSON({format:"radar-mode-records-v1",mode,exportedAt:new Date().toISOString(),records:g},"radar_stats_"+mode+".json");
}
function validModeGroup(g){return g&&typeof g==="object"&&typeof g.games==="number"&&typeof g.bestScore==="number"}
function importModeFile(mode,label,file){
 readJSONFile(file,data=>{
  const g=data&&data.records?data.records:data;
  if(!validModeGroup(g)){alert("Le fichier ne correspond pas aux statistiques "+label+" attendues.");return}
  if(!confirm("Remplacer toutes les statistiques "+label+" par les données importées ?"))return;
  const r=getRecords();r[mode]=normalizeModeRecords(g);saveRecords(r);
 });
}
[["manual","UTILISATEUR"],["ai","IA"],["hybrid","IA + UTILISATEUR"]].forEach(([mode,label])=>{
 const cap=mode.charAt(0).toUpperCase()+mode.slice(1);
 $("#export"+cap+"Stats").addEventListener("click",()=>modeExport(mode,label));
 $("#import"+cap+"StatsBtn").addEventListener("click",()=>$("#import"+cap+"StatsFile").click());
 $("#import"+cap+"StatsFile").addEventListener("change",e=>{const f=e.target.files[0];if(f)importModeFile(mode,label,f);e.target.value=""});
 $("#reset"+cap+"Stats").addEventListener("click",()=>{if(!confirm("Réinitialiser toutes les statistiques "+label+" ?"))return;const r=getRecords();r[mode]=defaultModeRecords();saveRecords(r)});
});

weaponEmp.addEventListener("click",useEMP);weaponCluster.addEventListener("click",useCluster);weaponBlue.addEventListener("click",useBlue);renderArsenal();



$("#trainingBtn").addEventListener("click",startTraining);

weaponBlack.addEventListener("click",useBlack);
weaponAtomic.addEventListener("click",useAtomic);
weaponMine.addEventListener("click",useMine);
weaponDecoy.addEventListener("click",useDecoy);

function startFree(){
 scenarioMode=false;document.body.classList.remove("scenario-mode");
 readFreeRules();trainingMode=false;freeMode=true;
 $("#freeSettings").hidden=true;document.body.classList.remove("training-mode");$("#modeBadge").hidden=false;$("#modeBadge").textContent="MODE LIBRE";
 startGameCommon();
}
$("#freeBtn").addEventListener("click",()=>{
 $("#freeSettings").hidden=!$("#freeSettings").hidden;
});
$("#launchFree").addEventListener("click",startFree);

window.addEventListener("beforeunload",()=>persistGame(true));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persistGame(true)});
window.addEventListener("pagehide",()=>persistGame(true));

// Restore automatically after a reload/F5. A deliberate Quit/Game Over clears the save.
setTimeout(()=>{if(getSavedGame())restoreSavedGame()},0);

// V19 — commandes IA de l’arsenal
$("#aiDefense").addEventListener("click",()=>setDefenseMode("ai"));
$("#hybridDefense").addEventListener("click",()=>setDefenseMode("hybrid"));
renderDefenseMode();

// ================= RADAR V26 — MODE SCÉNARIO STRATÉGIQUE =================
const SCENARIO_KEY="radar_v25_campaign";
const weaponPrices={blue:180,cluster:250,decoy:300,emp:400,mine:500,black:650,atomic:900};
const rankTable=[[1,"SANS GRADE",""],[2,"RECRUE",""],[3,"SOLDAT",""],[5,"CAPORAL",""],[8,"SERGENT",""],[12,"SERGENT-CHEF",""],[16,"ADJUDANT",""],[20,"ADJUDANT-CHEF",""],[25,"SOUS-LIEUTENANT",""],[30,"LIEUTENANT",""],[35,"CAPITAINE",""],[40,"COMMANDANT",""],[45,"LIEUTENANT-COLONEL",""],[50,"COLONEL",""],[60,"GÉNÉRAL DE BRIGADE","⭐"],[70,"GÉNÉRAL DE DIVISION","⭐⭐"],[80,"GÉNÉRAL DE CORPS D’ARMÉE","⭐⭐⭐"],[90,"GÉNÉRAL D’ARMÉE","⭐⭐⭐⭐"],[100,"CHEF D’ÉTAT-MAJOR","⭐⭐⭐⭐⭐"]];
let campaign=null,scenarioCommand="manual",missionStartStats=null;
function newCampaign(){return{format:"RADAR-V25-CAMPAIGN",version:25,mission:1,budget:1500,arsenal:{emp:1,cluster:2,blue:2,black:0,atomic:0,mine:1,decoy:1},medals:[],decorations:[],history:[],commandStats:{manual:0,ai:0,hybrid:0},intelSpent:0,weaponsSpent:0,created:new Date().toISOString()}}
function saveCampaign(){if(campaign)try{localStorage.setItem(SCENARIO_KEY,JSON.stringify(campaign))}catch(e){}}
function loadCampaign(){try{const c=JSON.parse(localStorage.getItem(SCENARIO_KEY));return c&&c.format==="RADAR-V25-CAMPAIGN"?c:null}catch(e){return null}}
function rankFor(n){let r=rankTable[0];rankTable.forEach(x=>{if(n>=x[0])r=x});return r}
function scenarioSeed(n){let x=(n*9301+49297)%233280;return()=>((x=(x*9301+49297)%233280)/233280)}
function buildMission(n){const rnd=scenarioSeed(n),phase=n%20===0?"BATAILLE MAJEURE":n>=15?"OFFENSIVE MAJEURE":n>=10?"ASSAUT":n>=5?"INCURSION":"ESCARMOUCHE";const events=["AUCUN","BROUILLAGE RADAR","PRÉSENCE CIVILE","ATTAQUE GROUPÉE","URGENCE OPÉRATIONNELLE","CONVOI À PROTÉGER"];return{format:"RADAR-V25-MISSION",version:25,id:"R25-"+String(n).padStart(3,"0")+"-"+Math.floor(rnd()*99999).toString(36).toUpperCase(),level:n,phase,bonusContacts:Math.floor(n/5)+(n%20===0?8:0),hostile:Math.round((55+Math.min(25,n*.3)+rnd()*8)),speed:Math.round((100+Math.min(80,n*.8))*100)/100,event:events[Math.floor(rnd()*events.length)],intel:0,created:new Date().toISOString()}}
function arsenalValue(a){return weaponKeys.reduce((sum,k)=>sum+(a[k]||0)*(weaponPrices[k]||0),0)}
function renderHQ(){if(!campaign)return;scenarioMission=scenarioMission&&scenarioMission.level===campaign.mission?scenarioMission:buildMission(campaign.mission);const r=rankFor(campaign.mission);$("#rankName").textContent=r[1];$("#rankStars").textContent=r[2]||"🎖️";$("#rankProgress").textContent="Mission "+campaign.mission+" / 100";$("#hqMission").textContent=campaign.mission+" — "+scenarioMission.phase;$("#hqBudget").textContent=campaign.budget.toLocaleString("fr-FR")+" C";$("#hqArsenalValue").textContent=arsenalValue(campaign.arsenal).toLocaleString("fr-FR")+" C";$("#hqMedals").textContent=campaign.medals.length;$("#hqSalute").textContent=campaign.mission>=60?"Mon Général, l’état-major attend votre décision.":campaign.mission>=25?"Mon Officier, voici la situation opérationnelle.":"Briefing de mission — préparez votre engagement.";$("#riskReport").textContent="Phase : "+scenarioMission.phase+". Risque "+(campaign.mission%20===0?"CRITIQUE":campaign.mission>=10?"ÉLEVÉ":"MODÉRÉ")+".";renderIntel();renderShop();renderCommandChoice();renderScenarioStats();renderCareer();renderOfficerReports();}
function renderIntel(){const m=scenarioMission,levels=[{c:100,n:"📡 Reconnaissance",d:m.intel>=1?`Contacts : environ ${target()+m.level} ± 5.`:"Nombre approximatif de contacts"},{c:200,n:"🛰️ Surveillance",d:m.intel>=2?`Présence hostile estimée : ${m.hostile-5}–${m.hostile+5} %.`:"Proportion probable de menaces"},{c:300,n:"🔎 Analyse tactique",d:m.intel>=3?`Dynamique : vitesse ${m.speed} %, ${m.phase.toLowerCase()}.`:"Vitesse et nature des menaces"},{c:500,n:"🧠 Renseignement complet",d:m.intel>=4?`Événement probable : ${m.event}. Fiabilité 88 %.`:"Événement spécial et analyse complète"}];$("#intelShop").innerHTML=levels.map((x,i)=>`<div class="shop-row"><div><b>${x.n}</b><small>${x.d}</small></div><span>${x.c} C</span><button data-intel="${i+1}" ${m.intel>=i+1?"disabled":""}>${m.intel>=i+1?"ACQUIS":"ACHETER"}</button></div>`).join("");$("#intelReport").textContent=m.intel?`Niveau de renseignement ${m.intel}/4 acquis. Fiabilité maximale : ${m.intel===4?"88 %":"partielle"}.`:"Aucun renseignement acheté : mission à l’aveugle.";document.querySelectorAll("[data-intel]").forEach(b=>b.onclick=()=>buyIntel(+b.dataset.intel));}
function buyIntel(level){if(level!==scenarioMission.intel+1){alert("Les renseignements s’achètent progressivement.");return}const costs=[0,100,200,300,500],c=costs[level];if(campaign.budget<c){alert("Budget insuffisant.");return}campaign.budget-=c;campaign.intelSpent+=c;scenarioMission.intel=level;saveCampaign();renderHQ();}
function renderShop(){$("#weaponShop").innerHTML=weaponKeys.map(k=>`<div class="shop-row"><div><b>${weaponLabels[k]}</b><small>Stock : ${campaign.arsenal[k]||0}</small></div><span>${weaponPrices[k]} C</span><button data-buy="${k}">+1</button></div>`).join("");$("#logisticsReport").textContent=`Budget ${campaign.budget.toLocaleString("fr-FR")} C · Arsenal ${arsenalValue(campaign.arsenal).toLocaleString("fr-FR")} C.`;document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buyWeapon(b.dataset.buy));}
function buyWeapon(k){const c=weaponPrices[k];if(campaign.budget<c){alert("Budget insuffisant.");return}campaign.budget-=c;campaign.weaponsSpent+=c;campaign.arsenal[k]=(campaign.arsenal[k]||0)+1;saveCampaign();renderHQ();}
function renderCommandChoice(){document.querySelectorAll("[data-command]").forEach(b=>b.classList.toggle("selected",b.dataset.command===scenarioCommand));$("#strategyReport").textContent=`Commandement prévu : ${scenarioCommand==="manual"?"MANUEL":scenarioCommand==="ai"?"IA":"CONJOINT"}. Ce choix sera verrouillé au lancement.`;}
document.querySelectorAll("[data-command]").forEach(b=>b.onclick=()=>{scenarioCommand=b.dataset.command;renderCommandChoice()});
function openScenario(){campaign=loadCampaign()||newCampaign();scenarioMission=buildMission(campaign.mission);scenarioCommand="manual";$("#home").hidden=true;$("#records").hidden=true;$("#scenarioHQ").hidden=false;renderHQ();}
function startScenarioMission(){scenarioMode=true;trainingMode=false;freeMode=false;document.body.classList.add("scenario-mode");defenseMode=scenarioCommand;$("#scenarioHQ").hidden=true;$("#game").hidden=false;$("#modeBadge").hidden=false;$("#modeBadge").textContent="SCÉNARIO STRATÉGIQUE — "+scenarioMission.phase;ctx();gScore=0;gLevel=campaign.mission;gLives=3;kills=0;spawned=0;sessionKills=0;runStats=emptyRunStats();lastPlayTick=performance.now();arsenal={...campaign.arsenal};used=emptyWeaponMap();projectiles.forEach(p=>p.e.remove());projectiles=[];clearMines();clearDecoys();clearObjects();running=true;lastAIAction=0;renderDefenseMode();renderArsenal();$("#commandLock").hidden=false;$("#commandLock").textContent="🔒 MODE VERROUILLÉ : "+(defenseMode==="manual"?"COMMANDANT MANUEL":defenseMode==="ai"?"COMMANDANT IA":"COMMANDEMENT CONJOINT");missionStartStats=JSON.parse(JSON.stringify(runStats));update();announce();setTimeout(()=>{if(running)makeObject()},700);raf=requestAnimationFrame(loop);saveCampaign();}
function completeScenarioMission(){if(!running)return;running=false;clearTimeout(spawnTimer);cancelAnimationFrame(raf);campaign.arsenal={...arsenal};const accuracy=runStats.manualShots?Math.round(runStats.manualKills/runStats.manualShots*100):0;const reward=250+campaign.mission*35+runStats.kills*15+(runStats.impacts===0?200:0)+(runStats.friendlyFire===0?150:0)+(accuracy>=90?100:0);campaign.budget+=reward;campaign.commandStats[defenseMode]=(campaign.commandStats[defenseMode]||0)+1;const medal={mission:campaign.mission,date:new Date().toISOString(),score:gScore,kills:runStats.kills,accuracy,reward,command:defenseMode,phase:scenarioMission.phase,event:scenarioMission.event,stats:JSON.parse(JSON.stringify(runStats))};campaign.medals.push(medal);campaign.history.push(medal);campaign.mission++;saveCampaign();clearObjects();clearMines();clearDecoys();$("#game").hidden=true;$("#commandLock").hidden=true;$("#scenarioHQ").hidden=false;scenarioMission=buildMission(campaign.mission);renderHQ();$("#debriefBox").hidden=false;$("#debriefText").innerHTML=`<p><b>MISSION ${medal.mission} RÉUSSIE — MÉDAILLE DE CAMPAGNE OBTENUE 🏅</b></p><p>Menaces neutralisées : ${medal.kills} · Précision : ${medal.accuracy}% · Récompense : +${medal.reward} C · Commandement : ${medal.command.toUpperCase()}</p>`;showMedal(medal);}
function showMedal(m){const e=document.createElement("div");e.className="medal-pop";e.innerHTML=`<div><div class="medal">🏅</div><h2>MÉDAILLE DE CAMPAGNE</h2><p>MISSION ${m.mission} — ${m.phase}</p><b>+${m.reward} CRÉDITS</b><p><button>CONTINUER LE DÉBRIEFING</button></p></div>`;document.body.appendChild(e);e.querySelector("button").onclick=()=>e.remove();}

function scenarioRunsByMode(mode){return (campaign&&campaign.history||[]).filter(x=>x.command===mode)}
function scenarioBest(runs){return runs.reduce((b,x)=>!b||Number(x.score||0)>Number(b.score||0)?x:b,null)}
function scenarioStatCard(mode,label){const runs=scenarioRunsByMode(mode),best=scenarioBest(runs),last=runs[runs.length-1];const fmt=x=>x?`Score ${x.score||0}<br><small>Niveau ${x.mission} · ${x.kills||0} détruites · ${x.accuracy||0}% précision</small>`:'—';return `<div class="scenario-stat-card"><h4>${label}</h4><div class="stat-pair"><div><small>🏆 MEILLEUR</small><b>${fmt(best)}</b></div><div><small>🕓 DERNIER</small><b>${fmt(last)}</b></div></div><p class="muted">Missions : ${runs.length} · Destructions : ${runs.reduce((n,x)=>n+(x.kills||0),0)}</p></div>`}
function renderScenarioStats(){const e=$("#scenarioStatsGrid");if(!e||!campaign)return;e.innerHTML=scenarioStatCard("manual","👤 UTILISATEUR")+scenarioStatCard("ai","🤖 IA")+scenarioStatCard("hybrid","👤 + 🤖 UTILISATEUR + IA")}
function renderCareer(){if(!campaign)return;const n=Math.min(100,campaign.mission),r=rankFor(n);let idx=rankTable.findIndex(x=>x[1]===r[1]);let next=rankTable[Math.min(rankTable.length-1,idx+1)];let pct=100;if(next!==r){pct=Math.max(0,Math.min(100,Math.round((n-r[0])/(next[0]-r[0])*100)))}$("#careerRank").textContent=(r[2]?r[2]+" ":"")+r[1];$("#careerNext").textContent=next===r?"Objectif atteint : Chef d’état-major":"Prochain grade : "+next[1]+" — niveau "+next[0];$("#careerPct").textContent=pct+"%";$("#careerBar").style.width=pct+"%";$("#rankRoad").innerHTML=rankTable.map(x=>`<div class="rank-node ${n>=x[0]?'done':''} ${x[1]===r[1]?'current':''}"><b>${x[2]||'◆'}</b><br>${x[1]}<br>Niv. ${x[0]}</div>`).join("")}
function bestWeaponText(){const h=campaign&&campaign.history||[];const totals={};weaponKeys.forEach(k=>totals[k]=0);h.forEach(m=>weaponKeys.forEach(k=>totals[k]+=(m.stats&&m.stats.weaponKills&&m.stats.weaponKills[k])||0));let k=weaponKeys.reduce((a,b)=>totals[b]>totals[a]?b:a,weaponKeys[0]);return totals[k]?weaponLabels[k]+" — "+totals[k]+" destructions":"Aucune donnée de combat"}
function renderOfficerReports(){if(!campaign)return;const last=campaign.history[campaign.history.length-1];const set=(id,t)=>{const e=$(id);if(e)e.textContent=t};set("#operationsReport",last?`Dernière mission : ${last.kills||0} menaces neutralisées, score ${last.score||0}.`:"Aucune mission achevée : préparation de la première opération.");set("#armamentReport","Arme la plus efficace en carrière : "+bestWeaponText());set("#cyberReport",scenarioMission.event==="BROUILLAGE RADAR"&&scenarioMission.intel>=4?"Brouillage radar confirmé.":"Systèmes : aucun brouillage confirmé.");set("#communicationsReport",`Commandement : ${scenarioCommand==='manual'?'MANUEL':scenarioCommand==='ai'?'IA':'CONJOINT'}.`);set("#technologyReport",last?`Précision dernière mission : ${last.accuracy||0} % · score ${last.score||0}.`:"Télémétrie : aucune mission enregistrée.");set("#dronesReport",last?`Appui IA enregistré : ${last.aiKills||0} neutralisation(s).`:"Appui : aucune donnée enregistrée.");set("#geopoliticsReport",`Mission ${campaign.mission}/100 · phase ${scenarioMission.phase}.`);set("#expertLogisticsReport",`Budget ${campaign.budget.toLocaleString('fr-FR')} C · total mobilisable ${(campaign.budget+arsenalValue(campaign.arsenal)).toLocaleString('fr-FR')} C.`);set("#medicalReport",last?`Contacts amis épargnés : ${last.friendlySaved??last.friendsSaved??'—'}.`:"Aucun bilan enregistré.");set("#specialOpsReport",`Risque ${campaign.mission%20===0?'CRITIQUE':campaign.mission>=10?'ÉLEVÉ':'MODÉRÉ'} · renseignement ${scenarioMission.intel}/4.`);}
const officerData={
 operations:{name:"Commandante A. Kone",role:"ANALYSTE DES OPÉRATIONS",img:"icons/officer-operations.jpg",speech:()=>{const m=campaign.history[campaign.history.length-1];return m?`Mission ${m.mission} : ${m.kills} menaces neutralisées, précision ${m.accuracy} %, score ${m.score}. La prochaine mission est la ${campaign.mission}.`:"Nous préparons votre première mission. Aucun résultat opérationnel n’est encore enregistré."}},
 risks:{name:"Colonel L. Wang",role:"ANALYSTE DES RISQUES",img:"icons/officer-risks.jpg",speech:()=>`Mission ${campaign.mission} : phase ${scenarioMission.phase}. Le risque est ${campaign.mission%20===0?'critique':campaign.mission>=10?'élevé':'modéré'}. L’évaluation évoluera avec les renseignements acquis.`},
 intel:{name:"Lieutenante M. Rodriguez",role:"OFFICIER DU RENSEIGNEMENT",img:"icons/officer-intel.jpg",speech:()=>scenarioMission.intel?`Nous disposons d’un renseignement de niveau ${scenarioMission.intel}/4. ${scenarioMission.intel>=2?'Présence hostile estimée autour de '+scenarioMission.hostile+' %.':''} ${scenarioMission.intel>=4?'Événement probable : '+scenarioMission.event+'.':''}`:"Vous partez actuellement à l’aveugle. Vous pouvez acheter progressivement du renseignement avant l’engagement."},
 logistics:{name:"Commandant J. Mbaye",role:"OFFICIER LOGISTIQUE",img:"icons/officer-logistics.jpg",speech:()=>`Budget disponible : ${campaign.budget.toLocaleString('fr-FR')} crédits. Valeur actuelle de l’arsenal : ${arsenalValue(campaign.arsenal).toLocaleString('fr-FR')} crédits. Dépenses armement cumulées : ${(campaign.weaponsSpent||0).toLocaleString('fr-FR')} crédits.`},
 armament:{name:"Capitaine E. Petrova",role:"ANALYSTE ARMEMENT",img:"icons/officer-armament.jpg",speech:()=>`Analyse de l’armement : ${bestWeaponText()}. Stock actuel : ${weaponKeys.map(k=>weaponLabels[k]+' ×'+(campaign.arsenal[k]||0)).join(', ')}.`},
 strategy:{name:"Lieutenant-colonel D. Lefebvre",role:"CONSEILLER STRATÉGIQUE",img:"icons/officer-strategy.jpg",speech:()=>`Commandement prévu : ${scenarioCommand==='manual'?'manuel':scenarioCommand==='ai'?'IA':'conjoint'}. ${scenarioMission.intel<2?'Je recommande d’envisager davantage de renseignement avant de fixer définitivement votre doctrine.':'Adaptez votre arsenal aux informations obtenues et conservez une réserve pour les missions suivantes.'}`},
 cyber:{name:"Capitaine A. Benali",role:"EXPERTE CYBERDÉFENSE",img:"icons/officer-benali.jpg",speech:()=>`Mission ${campaign.mission}. Niveau de renseignement ${scenarioMission.intel}/4. ${scenarioMission.event==='BROUILLAGE RADAR'?'Alerte : brouillage radar identifié dans les données de mission. Renforcez la vigilance sur l’identification des contacts.':'Aucun brouillage radar confirmé par les données actuellement acquises.'}`},
 communications:{name:"Commandant T. Okoro",role:"SPÉCIALISTE COMMUNICATIONS",img:"icons/officer-okoro.jpg",speech:()=>`Mission ${campaign.mission}. Mode de commandement sélectionné : ${scenarioCommand==='manual'?'MANUEL':scenarioCommand==='ai'?'IA':'CONJOINT'}. Doctrine IA : ${campaign.doctrine||document.querySelector("#aiDoctrine")?.value||'défensive'}. Ce choix sera verrouillé dès le lancement.`},
 technology:{name:"Lieutenante S. Park",role:"EXPERTE TECHNOLOGIES",img:"icons/officer-park.jpg",speech:()=>{const m=campaign.history[campaign.history.length-1];return m?`Télémétrie de la mission ${m.mission} : précision ${m.accuracy||0} %, score ${m.score||0}, ${m.kills||0} neutralisations. Ces valeurs proviennent du dernier rapport enregistré.`:`Aucune télémétrie de combat enregistrée. La première mission établira notre référence technique.`}},
 drones:{name:"Capitaine M. Ricci",role:"PILOTE DRONES",img:"icons/officer-ricci.jpg",speech:()=>{const m=campaign.history[campaign.history.length-1];return m?`Dernière mission enregistrée : ${m.kills||0} menaces neutralisées. Appui automatisé : ${m.aiKills||0} neutralisation(s) attribuée(s) à l’IA lorsqu’elles sont disponibles dans le rapport.`:`Aucune donnée d’appui automatisé n’est encore disponible.`}},
 geopolitics:{name:"Commandante R. Nair",role:"ANALYSTE GÉOPOLITIQUE",img:"icons/officer-nair.jpg",speech:()=>`Campagne : mission ${campaign.mission}/100, phase ${scenarioMission.phase}. Événement actuellement identifié : ${scenarioMission.intel>=4?(scenarioMission.event||'aucun'):'non révélé — renseignement insuffisant'}.`},
 expertlogistics:{name:"Colonel P. Moreau",role:"EXPERT LOGISTIQUE",img:"icons/officer-moreau.jpg",speech:()=>`Budget réel : ${campaign.budget.toLocaleString('fr-FR')} C. Arsenal : ${arsenalValue(campaign.arsenal).toLocaleString('fr-FR')} C. Total mobilisable : ${(campaign.budget+arsenalValue(campaign.arsenal)).toLocaleString('fr-FR')} C. Dépenses armement cumulées : ${(campaign.weaponsSpent||0).toLocaleString('fr-FR')} C.`},
 medical:{name:"Lieutenante J. Smith",role:"MÉDECIN MILITAIRE",img:"icons/officer-smith.jpg",speech:()=>{const m=campaign.history[campaign.history.length-1];return m?`Bilan de la mission ${m.mission} : ${m.friendlySaved??m.friendsSaved??'donnée non enregistrée'} contact(s) ami(s) épargné(s). Centre : ${m.centerIntact===true?'intact':m.centerIntact===false?'touché':'état non enregistré'}.`:`Aucun bilan médical/opérationnel n’est encore enregistré.`}},
 specialops:{name:"Commandant K. Diawara",role:"OPÉRATIONS SPÉCIALES",img:"icons/officer-diawara.jpg",speech:()=>`Mission ${campaign.mission}. Risque ${campaign.mission%20===0?'CRITIQUE':campaign.mission>=10?'ÉLEVÉ':'MODÉRÉ'}. Renseignement ${scenarioMission.intel}/4. Stock spécial disponible : ${weaponKeys.map(k=>weaponLabels[k]+' ×'+(campaign.arsenal[k]||0)).join(', ')}.`}
};
function openOfficer(key){const d=officerData[key];if(!d)return;$("#officerHD").src=d.img;$("#officerName").textContent=d.name;$("#officerRole").textContent=d.role;$("#officerSpeech").textContent=d.speech();$("#officerDialog").showModal()}
document.querySelectorAll(".officer-card").forEach(c=>c.addEventListener("click",()=>openOfficer(c.dataset.officer)));$("#closeOfficer").onclick=()=>$("#officerDialog").close();
function renderMedals(){const g=$("#medalGallery"),medals=campaign.medals||[],decos=campaign.decorations||[];$("#medalCareerSummary").textContent=`${rankFor(campaign.mission)[1]} · ${medals.length} médaille(s) de campagne · ${decos.length} décoration(s) exceptionnelle(s).`;if(!medals.length&&!decos.length){g.innerHTML='<div class="medal-empty">Aucune décoration pour le moment. Remportez votre première mission.</div>';return}g.innerHTML=decos.map(d=>`<div class="medal-item"><div class="medal-icon">🎖️</div><b>${d.name||'Décoration'}</b><small>${d.date?new Date(d.date).toLocaleDateString('fr-FR'):''}</small></div>`).join('')+medals.slice().reverse().map(m=>`<div class="medal-item"><div class="medal-icon">🏅</div><b>MISSION ${m.mission}</b><small>${m.phase}<br>Score ${m.score} · ${m.kills} détruites</small></div>`).join('')}
$("#openMedals").onclick=()=>{renderMedals();$("#medalsDialog").showModal()};$("#closeMedals").onclick=()=>$("#medalsDialog").close();

function exportCampaign(){downloadJSON(campaign,`RADAR-V25-campagne-mission-${campaign.mission}.json`)}
function exportScenarioMission(){downloadJSON(scenarioMission,`RADAR-V25-mission-${scenarioMission.level}-${scenarioMission.id}.json`)}
function makePdfReport(){const m=campaign.history[campaign.history.length-1];if(!m){alert("Terminez une mission pour générer un rapport.");return}const lines=["RADAR V26 - CENTRE DE COMMANDEMENT STRATEGIQUE","RAPPORT DE MISSION "+m.mission,"","Resultat : VICTOIRE","Phase : "+m.phase,"Commandement : "+m.command.toUpperCase(),"Menaces neutralisees : "+m.kills,"Precision : "+m.accuracy+" %","Impacts centre : "+m.stats.impacts,"Tirs amis : "+m.stats.friendlyFire,"Recompense : "+m.reward+" C","Budget actuel : "+campaign.budget+" C","Medaille : MEDAILLE DE CAMPAGNE - MISSION "+m.mission,"","RADAR V26 - by twagirumukiza"];downloadSimplePdf(lines,`RADAR-V25-rapport-mission-${m.mission}.pdf`)}
function downloadSimplePdf(lines,name){const esc=s=>String(s).replace(/[\\()]/g,"\\$&").replace(/[^\x20-\x7E]/g,"?");let y=790,content="BT /F1 12 Tf 50 810 Td ";lines.forEach((l,i)=>{content+=(i?`0 -22 Td `:"")+`(${esc(l)}) Tj `});content+="ET";const objs=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${content.length} >>\\nstream\\n${content}\\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];let pdf="%PDF-1.4\\n",offs=[0];objs.forEach((o,i)=>{offs.push(pdf.length);pdf+=`${i+1} 0 obj\\n${o}\\nendobj\\n`});const x=pdf.length;pdf+=`xref\\n0 ${objs.length+1}\\n0000000000 65535 f \\n`+offs.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n ").join("\\n")+`\\ntrailer << /Size ${objs.length+1} /Root 1 0 R >>\\nstartxref\\n${x}\\n%%EOF`;const blob=new Blob([pdf],{type:"application/pdf"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$("#scenarioBtn").onclick=openScenario;$("#launchScenario").onclick=startScenarioMission;$("#scenarioHome").onclick=()=>{$("#scenarioHQ").hidden=true;$("#home").hidden=false;$("#records").hidden=false};$("#exportCampaign").onclick=exportCampaign;$("#exportMission").onclick=exportScenarioMission;$("#downloadPdf").onclick=makePdfReport;$("#importCampaignBtn").onclick=()=>$("#importCampaignFile").click();$("#importMissionBtn").onclick=()=>$("#importMissionFile").click();$("#importCampaignFile").onchange=e=>{const f=e.target.files[0];if(!f)return;readJSONFile(f,d=>{if(d.format!=="RADAR-V25-CAMPAIGN"||d.version!==25){alert("Campagne V25 incompatible.");return}campaign=d;saveCampaign();scenarioMission=buildMission(campaign.mission);renderHQ();alert("Campagne V25 importée.")})};$("#importMissionFile").onchange=e=>{const f=e.target.files[0];if(!f)return;readJSONFile(f,d=>{if(d.format!=="RADAR-V25-MISSION"||d.version!==25){alert("Mission V25 incompatible.");return}scenarioMission=d;campaign.mission=d.level;renderHQ();alert("Mission V25 chargée. Préparez votre stratégie.")})};
