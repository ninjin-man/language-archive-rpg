/* ════ STATE & SAVE/LOAD ════ */
const KEY='arc_v4';
let S={screen:'arc',job:'novice',unlockedJobs:['novice'],exp:0,ap:0,gold:0,relics:[],
  aexp:0,stats:{atk:0,hp:0,spd:0,def:0,regen:0},wlv:{},skills:[],equippedSkills:[null,null,null],
  dungeonRecords:{maxFloor:0,totalRuns:0,kills:0},
  level:1,lvExp:0,inventory:[], // Phase10-12: 持ち物・レベルアップ(ローグライクコアループ)
  dex:{items:{},monsters:{}},   // Phase20: 図鑑基盤(アイテム/モンスターの発見フラグ)
  gridPos:null,                 // PhaseA: スフィア盤のカーソル位置(単語名)
  worldPos:null,fromWorld:false,// PhaseW1: オーバーワールド上のプレイヤー座標 / ダンジョン帰還先フラグ
  ws:{},cwrd:[],citem:[],clog:[],filt:'all',off:{x:0,y:0},
  settings:{dpadVisible:true}}; // 操作設定: ダンジョンの十字キー(Dpad)表示ON/OFF。OFFでもタップ移動は常時有効

// Word level helpers (単語進化システム)
function getWLv(word){return (S.wlv[word]||{lv:1,exp:0})}
function setWLv(word,data){S.wlv[word]=data}

function load(){
  try{const d=localStorage.getItem(KEY);if(d)S={...S,...JSON.parse(d)}}catch(e){}
  // Phase6: job roster changed — fall back to novice/empty list if old ids no longer exist
  if(!JD.find(j=>j.id===S.job))S.job='novice';
  S.unlockedJobs=(S.unlockedJobs||[]).filter(id=>JD.find(j=>j.id===id));
  if(!S.unlockedJobs.includes('novice'))S.unlockedJobs.push('novice');
  // Phase5: ensure 3 skill slots
  if(!Array.isArray(S.equippedSkills))S.equippedSkills=[null,null,null];
  while(S.equippedSkills.length<3)S.equippedSkills.push(null);
  // Phase5: backfill effects for skills created before Phase5
  (S.skills||[]).forEach(sk=>{ if(!sk.effects||!sk.effects.length)sk.effects=getSkillEffects4(sk) });
  // Phase5: clear equipped slots referencing skills that no longer exist
  S.equippedSkills=S.equippedSkills.map(id=>id&&(S.skills||[]).find(sk=>sk.id===id)?id:null);
  // Phase7: ensure dungeon records exist
  if(!S.dungeonRecords)S.dungeonRecords={maxFloor:0,totalRuns:0,kills:0};
  // Phase10-12: 旧セーブにレベル/持ち物/防御力・回復力ステータスが無い場合は補完
  if(S.level===undefined)S.level=1;
  if(S.lvExp===undefined)S.lvExp=0;
  if(!Array.isArray(S.inventory))S.inventory=[];
  if(!S.stats)S.stats={atk:0,hp:0,spd:0,def:0,regen:0};
  if(S.stats.def===undefined)S.stats.def=0;
  if(S.stats.regen===undefined)S.stats.regen=0;
  // Phase20: 旧セーブに図鑑データが無い場合は補完
  if(!S.dex)S.dex={items:{},monsters:{}};
  if(!S.dex.items)S.dex.items={};
  if(!S.dex.monsters)S.dex.monsters={};
  // 操作設定の補完(旧セーブにsettingsが無い場合)
  if(!S.settings)S.settings={};
  if(S.settings.dpadVisible===undefined)S.settings.dpadVisible=true;
  // Phase9: backfill Grammar Archive fields + pad words[] to 4 slots (noun,verb,adjective,adverb)
  (S.skills||[]).forEach(sk=>{
    if(sk.uses===undefined)sk.uses=1;
    if(sk.firstCreated===undefined)sk.firstCreated=Date.now();
    if(!sk.slots){
      // Old 2-word skills: assign by POS (best-effort) into the 4-slot structure
      const slots={noun:null,verb:null,adjective:null,adverb:null};
      (sk.words||[]).forEach(w=>{
        const p=WM[w]?.pos;
        if(p&&slots.hasOwnProperty(p)&&!slots[p])slots[p]=w;
      });
      sk.slots=slots;
    }
    if(!sk.rank)sk.rank=getSkillRank((sk.words||[]).filter(Boolean).length).key;
  });
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function gst(w){return(S.ws[w]||{}).st||'unknown'}
function gsi(w){return ST.indexOf(gst(w))}
function sst(w,s){if(!S.ws[w])S.ws[w]={};S.ws[w].st=s;if(s!=='unknown'&&!S.ws[w].at)S.ws[w].at=Date.now();save()}
function nd(){return WD.filter(w=>gst(w.word)!=='unknown').length}
