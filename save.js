/* ════ STATE & SAVE/LOAD ════ */
const KEY='arc_v4';
let S={screen:'arc',job:'novice',unlockedJobs:['novice'],exp:0,ap:0,gold:0,relics:[],
  aexp:0,stats:{atk:0,hp:0,spd:0},wlv:{},skills:[],equippedSkills:[null,null,null],
  dungeonRecords:{maxFloor:0,totalRuns:0,kills:0},
  ws:{},cwrd:[],citem:[],clog:[],filt:'all',off:{x:0,y:0}};

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
  (S.skills||[]).forEach(sk=>{ if(!sk.effects||!sk.effects.length)sk.effects=getSkillEffects(sk) });
  // Phase5: clear equipped slots referencing skills that no longer exist
  S.equippedSkills=S.equippedSkills.map(id=>id&&(S.skills||[]).find(sk=>sk.id===id)?id:null);
  // Phase7: ensure dungeon records exist
  if(!S.dungeonRecords)S.dungeonRecords={maxFloor:0,totalRuns:0,kills:0};
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
