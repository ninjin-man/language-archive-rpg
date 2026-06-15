/* ════ EXPLORE & DUNGEON MAP ════ */
/* ════ EXPLORE ════ */
function renderExp(){
  renderDungeonRecords();
  const grid=document.getElementById('dg');
  const TC={beginner:'#4de0a0',fire:'#e07030',merchant:'#c8a84b'};
  grid.innerHTML=DD.map(d=>{
    const kn=d.words.filter(w=>gst(w)!=='unknown').length;
    const pct=Math.round(kn/d.words.length*100);
    const col=TC[d.theme]||'var(--gold)';
    const wchips=d.words.slice(0,6).map(w=>{const k=gst(w)!=='unknown';
      return `<span class="dc2-wc" style="border-color:${k?col+'88':'var(--b0)'};color:${k?col:'var(--t2)'};background:${k?col+'11':'transparent'}">${k?w:'???'}</span>`;
    }).join('');
    return `<div class="dc2" onclick="openDmap('${d.id}')">
      <div class="dc2-acc" style="background:${col}"></div>
      <div class="dc2-b">
        <div class="dc2-n" style="color:${col}">${d.name}</div>
        <div class="dc2-d">${d.desc}</div>
        <div class="dc2-tags"><span class="dtag">CEFR ${d.difficulty}</span><span class="dtag">⏱ ${d.sessionLength}</span><span class="dtag">推奨: ${d.recommended}</span></div>
        <div class="dc2-ww">${wchips}</div>
        <div class="dc2-p">
          <div class="dc2-pl"><span>単語習得</span><span>${kn}/${d.words.length}</span></div>
          <div class="dc2-pb"><div class="dc2-pf" style="width:${pct}%;background:${col}"></div></div>
        </div>
        <button class="dc2-btn" style="background:linear-gradient(180deg,${col}cc,${col}77);color:#fff;border:1px solid ${col}44">▶ ダンジョンへ</button>
      </div>
    </div>`;
  }).join('');
  renderRelics();
}

// ダンジョン記録 (Phase7 item6): 最高到達階・総探索回数・討伐数
function renderDungeonRecords(){
  const el=document.getElementById('dungeon-records');
  if(!el)return;
  const r=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
  el.innerHTML=`
    <div class="dr-card"><div class="dr-icon">🏔️</div><div class="dr-label">最高到達階</div><div class="dr-val">B${r.maxFloor}F</div></div>
    <div class="dr-card"><div class="dr-icon">🚪</div><div class="dr-label">総探索回数</div><div class="dr-val">${r.totalRuns}</div></div>
    <div class="dr-card"><div class="dr-icon">⚔️</div><div class="dr-label">討伐数</div><div class="dr-val">${r.kills}</div></div>`;
}

/* ════════════════════════════════════════════════
   DUNGEON MAP — 10 floors, random BSP generation
════════════════════════════════════════════════ */
const GW=11,GH=11;  // grid size per floor
const CELL={WALL:0,FLOOR:1,PLAYER:2,CHEST:3,EVENT:4,EXIT:5,ENEMY:6,STAIRS_UP:7,STAIRS_DOWN:8,FOG:9,CHEST_GOLD:10};

/* ════ RELICS (探索ループ改善) ════ */
// Each relic boosts the chance that a chest/event "bonus word" reward matches its keyword.
const RELICS=[
  {id:'ancient_tablet',name:'Ancient Tablet',jp:'古代の石板',keyword:'Ancient',desc:'Ancient系単語の発見率+5%',icon:'📜'},
  {id:'dragon_scale',name:'Dragon Scale',jp:'ドラゴンの鱗',keyword:'Dragon',desc:'Dragon系単語の発見率+5%',icon:'🐉'},
  {id:'fire_ember',name:'Fire Ember',jp:'火の残り火',keyword:'Fire',desc:'Fire系単語の発見率+5%',icon:'🔥'},
  {id:'merchant_coin',name:'Merchant Coin',jp:'商人のコイン',keyword:'Gold',desc:'Gold系単語の発見率+5%',icon:'🪙'},
];
function hasRelic(id){return (S.relics||[]).includes(id)}
function grantRelic(id){
  if(!S.relics)S.relics=[];
  if(S.relics.includes(id))return false;
  S.relics.push(id);save();return true;
}
// Persistent relic collection display (探索ループ改善)
function renderRelics(){
  const g=document.getElementById('relic-grid');
  if(!g)return;
  g.innerHTML=RELICS.map(r=>{
    const owned=hasRelic(r.id);
    return `<div class="relic-card ${owned?'owned':''}">
      <div class="relic-icon">${owned?r.icon:'❔'}</div>
      <div class="relic-name">${owned?r.jp:'???'}</div>
      <div class="relic-desc">${owned?r.desc:'未発見'}</div>
    </div>`;
  }).join('');
}
// Pick a "bonus word" from a dungeon's word pool, weighted by:
//  - relic keyword matches
//  - レア単語出現率 +N% (Dragon系スキル効果, Phase5): rare以上の単語の重みを加算
//  - フロア階層によるレアリティ傾向 (Phase7: FLOOR_TIERS)
function pickBonusWord(pool,floor){
  if(!pool.length)return null;
  const relics=(S.relics||[]).map(id=>RELICS.find(r=>r.id===id)).filter(Boolean);
  const rareBonus=getRareBonus();
  const tier=getFloorTier(floor||DM.floor||1);
  const weighted=[];
  pool.forEach(w=>{
    let weight=tier.rarityWeight[w.rarity]??1;
    relics.forEach(r=>{
      const hit = w.word.includes(r.keyword) || (w.relations.related||[]).includes(r.keyword) || (w.relations.synonyms||[]).includes(r.keyword);
      if(hit)weight+=0.5; // +5% relative boost per matching relic
    });
    if(rareBonus>0 && ['rare','epic','legendary'].includes(w.rarity)) weight+=rareBonus*2;
    for(let i=0;i<Math.round(Math.max(weight,0.1)*10);i++)weighted.push(w);
  });
  return weighted[Math.floor(Math.random()*weighted.length)];
}

let DM={
  dungeon:null,
  floor:1,   // current floor (1-20, Phase7)
  maxFloor:20,
  floors:{}, // floor -> {grid, playerPos, explored Set}
  steps:0,
  wordsFound:0,
  kills:0,
  log:[],
  pending:null,  // 'chest'|'event_choice'|'enemy'|'battle'
  battle:null,   // active battle state (Phase8)
  battleDiscoverBonus:0 // per-run discover bonus from battle wins (Phase8 item7)
};

function openDmap(id){
  const d=DD.find(d=>d.id===id);if(!d)return;
  DM={dungeon:d,floor:1,maxFloor:20,floors:{},steps:0,wordsFound:0,kills:0,log:[],pending:null,battle:null,battleDiscoverBonus:0};
  document.getElementById('dm-title').textContent=d.name;
  document.getElementById('dmov').classList.add('show');
  // Phase7: ダンジョン記録 — 総探索回数をカウント
  S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
  S.dungeonRecords.totalRuns++;
  save();
  generateFloor(1);
  loadFloor(1);
  dmRender();
}
function closeDmap(){
  document.getElementById('dmov').classList.remove('show');
  document.getElementById('event-ov')?.classList.remove('show');
  document.getElementById('battle-ov')?.classList.remove('show');
  // Phase7: ダンジョン記録 — 最高到達階を更新
  if(DM.dungeon){
    S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
    if(DM.floor>S.dungeonRecords.maxFloor)S.dungeonRecords.maxFloor=DM.floor;
    save();
  }
  renderExp();
}

/* BSP dungeon generation */
function generateFloor(f){
  const g=Array.from({length:GH},()=>Array(GW).fill(CELL.WALL));
  // Rooms via BSP-lite
  const rooms=[];
  const tryRoom=(x1,y1,x2,y2,depth)=>{
    if(depth>3||(x2-x1)<4||(y2-y1)<4)return;
    const split=Math.random()>.5?'h':'v';
    if(split==='h'&&y2-y1>7){
      const mid=y1+2+Math.floor(Math.random()*(y2-y1-4));
      tryRoom(x1,y1,x2,mid,depth+1);tryRoom(x1,mid,x2,y2,depth+1);
    } else if(split==='v'&&x2-x1>7){
      const mid=x1+2+Math.floor(Math.random()*(x2-x1-4));
      tryRoom(x1,y1,mid,y2,depth+1);tryRoom(mid,y1,x2,y2,depth+1);
    } else {
      // Carve room
      const rw=Math.min(3+Math.floor(Math.random()*3),x2-x1-1);
      const rh=Math.min(3+Math.floor(Math.random()*2),y2-y1-1);
      const rx=x1+1+Math.floor(Math.random()*(x2-x1-rw-1));
      const ry=y1+1+Math.floor(Math.random()*(y2-y1-rh-1));
      rooms.push({x:rx,y:ry,w:rw,h:rh});
      for(let dy=0;dy<rh;dy++)for(let dx=0;dx<rw;dx++)g[ry+dy][rx+dx]=CELL.FLOOR;
    }
  };
  tryRoom(0,0,GW,GH,0);
  // Ensure at least 2 rooms; fallback
  if(rooms.length<2){
    [[2,2,4,3],[6,6,3,3]].forEach(([x,y,w,h])=>{
      rooms.push({x,y,w,h});
      for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)g[y+dy][x+dx]=CELL.FLOOR;
    });
  }
  // Connect rooms with L corridors
  for(let i=0;i<rooms.length-1;i++){
    const a=rooms[i],b=rooms[i+1];
    const ax=a.x+Math.floor(a.w/2),ay=a.y+Math.floor(a.h/2);
    const bx=b.x+Math.floor(b.w/2),by=b.y+Math.floor(b.h/2);
    // Horizontal then vertical
    const sx=Math.min(ax,bx),ex=Math.max(ax,bx);
    for(let x=sx;x<=ex;x++)if(g[ay][x]===CELL.WALL)g[ay][x]=CELL.FLOOR;
    const sy=Math.min(ay,by),ey=Math.max(ay,by);
    for(let y=sy;y<=ey;y++)if(g[y][bx]===CELL.WALL)g[y][bx]=CELL.FLOOR;
  }
  // Place features
  const floorCells=[];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(g[y][x]===CELL.FLOOR)floorCells.push({x,y});
  const shuffle=arr=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
  const pool=shuffle([...floorCells]);
  // Player start: first room center
  const startRoom=rooms[0];
  const px=startRoom.x+Math.floor(startRoom.w/2),py=startRoom.y+Math.floor(startRoom.h/2);
  g[py][px]=CELL.PLAYER;
  // Features
  const targets=shuffle(pool.filter(c=>!(c.x===px&&c.y===py)));
  let ti=0;
  const place=(type)=>{if(ti<targets.length){const{x,y}=targets[ti++];g[y][x]=type}};
  // Chests
  const nChests=f<5?2:3;
  for(let i=0;i<nChests;i++)place(CELL.CHEST);
  // Special chest (低確率: Gold or 単語の直接獲得) — 改修: 探索ループ改善
  if(Math.random()<0.15)place(CELL.CHEST_GOLD);
  // Events
  for(let i=0;i<2;i++)place(CELL.EVENT);
  // Enemies (Phase7: capped since maxFloor is now 20)
  const nE=Math.min(4,1+Math.floor(f/5));
  for(let i=0;i<nE;i++)place(CELL.ENEMY);
  // Stairs to next floor (if not last)
  if(f<DM.maxFloor){place(CELL.STAIRS_DOWN)}
  // Stairs back up (if not first floor) — backtrack option
  if(f>1){place(CELL.STAIRS_UP)}
  // Exit: floor 1 = retreat to town, floor 20 = final dungeon clear (Phase7)
  if(f===1||f===DM.maxFloor){place(CELL.EXIT)}

  // Fog of war: all cells start unexplored
  const explored=new Set();
  explored.add(`${px},${py}`);
  // Reveal 1-radius around start
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=px+dx,ny=py+dy;
    if(nx>=0&&nx<GW&&ny>=0&&ny<GH)explored.add(`${nx},${ny}`);
  }
  DM.floors[f]={grid:g,playerPos:{x:px,y:py},explored};
}

function loadFloor(f){
  if(!DM.floors[f])generateFloor(f);
  DM.floor=f;DM.pending=null;
  document.getElementById('dm-floor').textContent=`B${f}F`;
  document.getElementById('dm-f').textContent=`B${f}F`;
  dmLog(`B${f}F に到着した。`);
  const bar=document.getElementById('dm-floor-fill');
  if(bar)bar.style.width=Math.round(f/DM.maxFloor*100)+'%';
  const lbl=document.getElementById('dm-floor-label');
  if(lbl)lbl.textContent=`深度 ${f}F / ${DM.maxFloor}F`;
}

function dmRender(){
  const gc=document.getElementById('dm-grid');
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored}=fl;
  gc.style.gridTemplateColumns=`repeat(${GW},27px)`;
  let html='';
  const T={
    [CELL.WALL]:'dwa',
    [CELL.FLOOR]:'dfl',
    [CELL.PLAYER]:'dpl',
    [CELL.CHEST]:'dch',
    [CELL.CHEST_GOLD]:'dch',
    [CELL.EVENT]:'dev',
    [CELL.EXIT]:'dex',
    [CELL.ENEMY]:'den',
    [CELL.STAIRS_DOWN]:'dst2',
    [CELL.STAIRS_UP]:'dstu',
  };
  const icons={[CELL.PLAYER]:'●',[CELL.CHEST]:'🎁',[CELL.CHEST_GOLD]:'💰',[CELL.EVENT]:'❓',[CELL.EXIT]:'🚪',[CELL.ENEMY]:'👾',[CELL.STAIRS_DOWN]:'↓',[CELL.STAIRS_UP]:'↑'};
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const key=`${x},${y}`;
    const fog=!explored.has(key)&&g[y][x]!==CELL.PLAYER;
    if(fog){html+=`<div class="dc dfo"></div>`;continue}
    const t=g[y][x];
    const cls=T[t]||'dfl';
    const ico=icons[t]||'';
    html+=`<div class="dc ${cls}">${ico}</div>`;
  }
  gc.innerHTML=html;
  document.getElementById('dm-s').textContent=DM.steps;
  document.getElementById('dm-w').textContent=DM.wordsFound;
  // Action button state
  const ab=document.getElementById('dm-act');
  if(DM.pending==='event_choice'){
    ab.textContent='❓ 調べる';
    ab.style.background='linear-gradient(180deg,#b06aff,#8a6dfa)';
    ab.style.color='#fff';
  }else if(DM.pending==='enemy'){
    ab.textContent='⚔ Battle!';
    ab.style.background='linear-gradient(180deg,#ff6a6a,#c84b4b)';
    ab.style.color='#fff';
  }else{
    ab.textContent=DM.pending?'⚔ Quiz!':'⚔';
    ab.style.background=DM.pending?'linear-gradient(180deg,#e8c96a,#c8a84b)':'';
    ab.style.color=DM.pending?'#04060c':'';
  }
}

function dmLog(msg){
  DM.log.unshift(msg);if(DM.log.length>10)DM.log.pop();
  const el=document.getElementById('dm-log');
  if(el)el.innerHTML=DM.log.map(l=>`<div class="dm-log-line">${l}</div>`).join('');
}

// Special chest: instantly grants Gold or a word (no quiz) — 改修: 探索ループ改善
// + Gold獲得量 +N% (Forge系スキル効果, Phase5) + 単語発見率 +N% (Magic系スキル/Scholar職業, Phase5/6)
function openGoldChest(){
  const d=DM.dungeon;
  const goldMult=getGoldMultiplier();
  // 単語発見率ボーナスにより「単語」結果の確率を上げる(基準50%)
  const wordChance=Math.min(0.9,0.5+getDiscoverBonus());
  if(Math.random()>=wordChance){
    const amt=Math.round((10+Math.floor(Math.random()*DM.floor*5))*goldMult);
    S.gold=(S.gold||0)+amt;save();updateHdr();
    return `💰 宝箱からGold ${amt} を手に入れた！`;
  } else {
    const pool=d.words.map(w=>WM[w]).filter(Boolean).filter(w=>gst(w.word)==='unknown');
    if(!pool.length){
      const amt=Math.round((10+Math.floor(Math.random()*DM.floor*5))*goldMult);
      S.gold=(S.gold||0)+amt;save();updateHdr();
      return `💰 宝箱からGold ${amt} を手に入れた！`;
    }
    const w=pickBonusWord(pool);
    if(w){discover(w.word);DM.wordsFound++}
    // スキル素材判定: SKILL_EFFECT_TABLEのキーワードに一致する単語は「スキル素材」として強調
    const isSkillMat=w&&SKILL_EFFECT_TABLE.some(e=>e.keywords.some(kw=>w.word.includes(kw)));
    return w?`💰 宝箱から単語「${w.word}」を発見！${isSkillMat?' ✨スキル素材として活用できそう！':''}`:'💰 宝箱から単語「?」を発見！';
  }
}

function dmv(dir){
  if(DM.pending)return;
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p}=fl;
  let nx=p.x,ny=p.y;
  if(dir==='up')ny--;else if(dir==='down')ny++;
  else if(dir==='left')nx--;else if(dir==='right')nx++;
  if(ny<0||ny>=GH||nx<0||nx>=GW)return;
  const dest=g[ny][nx];
  if(dest===CELL.WALL)return;
  // Move
  g[p.y][p.x]=CELL.FLOOR;
  fl.playerPos={x:nx,y:ny};
  DM.steps++;
  // Reveal fog around new position
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const ex=nx+dx,ey=ny+dy;
    if(ex>=0&&ex<GW&&ey>=0&&ey<GH)explored.add(`${ex},${ey}`);
  }
  // Handle cell
  let msg='';
  if(dest===CELL.CHEST){
    msg='🎁 宝箱を発見！';DM.pending='chest';g[ny][nx]=CELL.PLAYER;
  }else if(dest===CELL.CHEST_GOLD){
    g[ny][nx]=CELL.PLAYER;
    msg=openGoldChest();
  }else if(dest===CELL.EVENT){
    msg='❓ 古い石碑を見つけた…';DM.pending='event_choice';g[ny][nx]=CELL.PLAYER;
  }else if(dest===CELL.ENEMY){
    msg=`👾 敵が現れた！ (B${DM.floor}F)`;DM.pending='enemy';g[ny][nx]=CELL.PLAYER;
  }else if(dest===CELL.EXIT){
    if(DM.floor===DM.maxFloor){
      msg='🏆 最深部の出口！ダンジョン完全制覇！';g[ny][nx]=CELL.PLAYER;
      setTimeout(()=>{closeDmap();toast('🏆 全20階クリア！完全制覇！','g')},700);
    } else {
      msg='🚪 入口に戻る…';g[ny][nx]=CELL.PLAYER;
      setTimeout(()=>{closeDmap();toast(`B${DM.floor}Fまで到達して撤退`,'g')},600);
    }
  }else if(dest===CELL.STAIRS_DOWN){
    msg=`↓ 階段を下った。B${DM.floor+1}Fへ`;
    g[ny][nx]=CELL.PLAYER;
    setTimeout(()=>{loadFloor(DM.floor+1);dmRender()},300);
  }else if(dest===CELL.STAIRS_UP&&DM.floor>1){
    msg=`↑ 階段を上った。B${DM.floor-1}Fへ`;
    g[ny][nx]=CELL.PLAYER;
    // Return player to previous floor (restore its grid)
    setTimeout(()=>{loadFloor(DM.floor-1);dmRender()},300);
  }else{
    g[ny][nx]=CELL.PLAYER;
  }
  if(msg){document.getElementById('dm-msg').textContent=msg;dmLog(msg)}
  dmRender();
}

function dma(){
  if(!DM.pending)return;
  if(DM.pending==='event_choice'){
    showEventChoice();
    return;
  }
  if(DM.pending==='enemy'){
    startBattle();
    return;
  }
  const d=DM.dungeon;
  const pool=d.words.map(w=>WM[w]).filter(Boolean);
  // On deeper floors, quiz 2 words
  const n=DM.floor>=5?2:1;
  const ws=pool.sort(()=>Math.random()-.5).slice(0,n);
  DM.pending=null;
  dmRender();
  QS={words:ws,idx:0,answered:false,score:0,dungeon:d,single:true,fromDungeon:true};
  document.getElementById('dmov').classList.remove('show'); // hide dungeon while quizzing
  openQ();showQ();
}

/* ════ RANDOM EVENT: 古い石碑 — 改修: 探索ループ改善 ════ */
function showEventChoice(){
  const ov=document.getElementById('event-ov');
  if(ov)ov.classList.add('show');
}
function closeEventChoice(){
  const ov=document.getElementById('event-ov');
  if(ov)ov.classList.remove('show');
  DM.pending=null;
  dmRender();
}
// choice: 'read'|'destroy'|'take'
function resolveEventChoice(choice){
  const d=DM.dungeon;
  const pool=d.words.map(w=>WM[w]).filter(Boolean);
  const unknownPool=pool.filter(w=>gst(w.word)==='unknown');
  let msg='';
  if(choice==='read'){
    // 読む: 単語を1つ直接発見（クイズなし）
    const w=pickBonusWord(unknownPool.length?unknownPool:pool);
    if(w&&gst(w.word)==='unknown'){discover(w.word);DM.wordsFound++;msg=`📖 石碑を読んで「${w.word}」を発見した！`}
    else{S.exp+=5;save();updateHdr();msg='📖 石碑を読んだが、知識は既に得ていた。(+5 EXP)'}
  }else if(choice==='destroy'){
    // 破壊: Goldを獲得、ただし低確率でレリック破損（何も起きない）
    if(Math.random()<0.5){
      const amt=Math.round((15+Math.floor(Math.random()*DM.floor*5))*getGoldMultiplier());
      S.gold=(S.gold||0)+amt;save();updateHdr();
      msg=`💥 石碑を破壊し、隙間からGold ${amt} を見つけた！`;
    }else{
      msg='💥 石碑を破壊したが、何も見つからなかった…';
    }
  }else if(choice==='take'){
    // 持ち帰る: 低確率でレリック獲得
    const candidates=RELICS.filter(r=>!hasRelic(r.id));
    if(candidates.length&&Math.random()<0.25){
      const r=candidates[Math.floor(Math.random()*candidates.length)];
      grantRelic(r.id);
      msg=`✨ 石碑を持ち帰った。レリック「${r.jp}」を入手！`;
      toast(`✨ レリック獲得: ${r.icon} ${r.jp}`,'g');
    }else{
      const amt=Math.round((5+Math.floor(Math.random()*DM.floor*3))*getGoldMultiplier());
      S.gold=(S.gold||0)+amt;save();updateHdr();
      msg=`📦 石碑を持ち帰り、売却してGold ${amt} を得た。`;
    }
  }
  closeEventChoice();
  if(msg){document.getElementById('dm-msg').textContent=msg;dmLog(msg)}
}
