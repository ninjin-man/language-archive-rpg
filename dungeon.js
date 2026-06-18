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
const GW=24,GH=24;  // grid size per floor (Phase20.5: 11→24 ダンジョン大型化)
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

/* ════ 脱出の宝玉 (Phase24: 脱出マス廃止に伴う新システム) ════
   塔から脱出する力を持つ宝玉。一定階層への初到達時に自動獲得し、永続所持する(売却不可・使用不可)。
   ✕ボタン(closeDmap)で撤退する際、1個消費して安全に脱出できる。
   所持数0で撤退するとペナルティ付きの強制脱出になる(closeDmap内で判定)。 */
const ESCAPE_GEM_FLOORS=[5,10,15,20];
function checkEscapeGemAward(f){
  if(!ESCAPE_GEM_FLOORS.includes(f))return;
  DM.gemFloorsAwarded=DM.gemFloorsAwarded||new Set();
  if(DM.gemFloorsAwarded.has(f))return; // このラン中に既に獲得済みの階層は再付与しない
  DM.gemFloorsAwarded.add(f);
  S.escapeGems=(S.escapeGems||0)+1;save();
  const msg=`◇ 脱出の宝玉を手に入れた！(B${f}F到達、所持${S.escapeGems}個)`;
  dmLog(msg);
  toast(`◇ 脱出の宝玉 +1 (所持${S.escapeGems}個)`,'gr');
  dmUpdateHud();
}

let DM={
  dungeon:null,
  floor:1,   // current floor (1-20, Phase7)
  maxFloor:20,
  floors:{}, // floor -> {grid, playerPos, explored Set, enemies}
  steps:0,
  wordsFound:0,
  kills:0,
  log:[],
  pending:null,  // 'chest'|'event_choice'  (改修: 'enemy'はモーダル戦闘廃止により不要)
  playerHp:0,    // ダンジョン1回の探索を通じて持続するHP(MVPローグライク化アップデート)
  playerMaxHp:0,
  battleDiscoverBonus:0, // per-run discover bonus from battle wins (Phase8 item7)
  anim:{dir:'down',frame:'idle'} // Phase24: プレイヤースプライトの向き・現在フレーム
};

function openDmap(id){
  const d=DD.find(d=>d.id===id);if(!d)return;
  const maxHp=getPlayerMaxHp();
  DM={dungeon:d,floor:1,maxFloor:20,floors:{},steps:0,wordsFound:0,kills:0,log:[],pending:null,
      playerHp:maxHp,playerMaxHp:maxHp,battleDiscoverBonus:0,anim:{dir:'down',frame:'idle'}};
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
function closeDmap(reason){
  reason=reason||'manual'; // 'manual'(✕ボタン撤退) | 'death'(HP0帰還) | 'clear'(最深部到達)
  document.getElementById('dmov').classList.remove('show');
  document.getElementById('event-ov')?.classList.remove('show');
  document.getElementById('stairs-ov')?.classList.remove('show');
  document.getElementById('char-menu-ov')?.classList.remove('show');
  // Phase7: ダンジョン記録 — 最高到達階を更新
  if(DM.dungeon){
    S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
    if(DM.floor>S.dungeonRecords.maxFloor)S.dungeonRecords.maxFloor=DM.floor;
    // Phase24: 脱出の宝玉判定 — 自発的撤退のみ対象(死亡帰還・最深部到達は対象外)
    if(reason==='manual'){
      if((S.escapeGems||0)>0){
        S.escapeGems--;
        toast(`◇ 脱出の宝玉を使って撤退した(残り${S.escapeGems}個)`,'gr');
      }else{
        const lost=Math.floor((S.gold||0)*0.3);
        S.gold=Math.max(0,(S.gold||0)-lost);
        toast(lost>0?`脱出の宝玉が無く、Gold ${lost} を落として強行脱出した…`:'脱出の宝玉が無いまま脱出した…','g');
      }
    }
    save();
  }
  renderExp();
}

/* BSP dungeon generation */
function generateFloor(f){
  const g=Array.from({length:GH},()=>Array(GW).fill(CELL.WALL));
  // Rooms via BSP-lite
  // Phase20.5: マップ拡張(11→24)に合わせ、分割の深さを3→8に拡張して部屋数を8〜15程度に増加。
  // 分割方向も「長い辺を優先」する方式に変更し、極端に偏った形の親領域でも有効に分割されるようにした
  // (通路の接続アルゴリズム自体は既存のまま変更していない)。部屋サイズも少しだけ拡大。
  const rooms=[];
  const tryRoom=(x1,y1,x2,y2,depth)=>{
    if(depth>8||(x2-x1)<5||(y2-y1)<4)return;
    const w=x2-x1,h=y2-y1;
    let split;
    if(h>w*1.25)split='h';
    else if(w>h*1.25)split='v';
    else split=Math.random()>.5?'h':'v';
    if(split==='h'&&h>7){
      const mid=y1+2+Math.floor(Math.random()*(h-4));
      tryRoom(x1,y1,x2,mid,depth+1);tryRoom(x1,mid,x2,y2,depth+1);
    } else if(split==='v'&&w>7){
      const mid=x1+2+Math.floor(Math.random()*(w-4));
      tryRoom(x1,y1,mid,y2,depth+1);tryRoom(mid,y1,x2,y2,depth+1);
    } else {
      // Carve room (Phase20.5: w 3-5→4-6, h 3-4→3-5 に拡大)
      const rw=Math.min(4+Math.floor(Math.random()*3),x2-x1-1);
      const rh=Math.min(3+Math.floor(Math.random()*3),y2-y1-1);
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
  // ── Phase23: 特殊部屋(room.type) ──
  // 将来の拡張(他のroom.typeの追加)を見据え、各部屋にtypeフィールドを持たせる。
  // 開始部屋は常にnormal。部屋数が十分な時のみ抽選で割り当て、同じ部屋が複数の特殊typeを兼ねないようにする。
  const startRoom=rooms[0];
  rooms.forEach(r=>{r.type='normal'});
  if(rooms.length>=4){
    const specialPool=rooms.filter(r=>r!==startRoom);
    const pickSpecial=()=>{
      if(!specialPool.length)return null;
      const i=Math.floor(Math.random()*specialPool.length);
      return specialPool.splice(i,1)[0];
    };
    if(Math.random()<0.7){const r=pickSpecial();if(r)r.type='treasure'} // 宝物庫: アイテム2〜4個
    if(Math.random()<0.6){const r=pickSpecial();if(r)r.type='monster'} // モンスター部屋: 敵4〜8体
    if(Math.random()<0.5){const r=pickSpecial();if(r)r.type='rest'}    // 休憩部屋: 自然回復2倍
  }
  // 特殊部屋のマスは通常の宝箱/イベント/雑魚配置の対象から除外する(専用ロジックで後から配置する)
  const specialCells=new Set();
  rooms.forEach(r=>{
    if(r.type==='normal')return;
    for(let dy=0;dy<r.h;dy++)for(let dx=0;dx<r.w;dx++)specialCells.add(`${r.x+dx},${r.y+dy}`);
  });
  const floorCells=[];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(g[y][x]===CELL.FLOOR)floorCells.push({x,y});
  const shuffle=arr=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
  const pool=shuffle([...floorCells]);
  // Player start: first room center
  const px=startRoom.x+Math.floor(startRoom.w/2),py=startRoom.y+Math.floor(startRoom.h/2);
  g[py][px]=CELL.PLAYER;
  // Features
  const targets=shuffle(pool.filter(c=>!(c.x===px&&c.y===py)&&!specialCells.has(`${c.x},${c.y}`)));
  let ti=0;
  const place=(type)=>{
    while(ti<targets.length){
      const{x,y}=targets[ti++];
      if(g[y][x]===CELL.FLOOR){g[y][x]=type;return true}
    }
    return false;
  };
  // Chests
  const nChests=f<5?2:3;
  for(let i=0;i<nChests;i++)place(CELL.CHEST);
  // Special chest (低確率: Gold or 単語の直接獲得) — 改修: 探索ループ改善
  if(Math.random()<0.15)place(CELL.CHEST_GOLD);
  // Events
  for(let i=0;i<2;i++)place(CELL.EVENT);
  // Enemies (Phase7: capped since maxFloor is now 20)
  // 改修(MVPローグライク化): 敵は静的セルではなく動的エンティティとして配置し、
  // 自律移動(敵AI)・接触攻撃の対象にする。床タイル自体は変更しない。
  const nE=Math.min(8,2+Math.floor(f/3)); // Phase20.5: マップ拡張に合わせ出現数を約1.5〜2倍に(旧: min(4,1+floor(f/5)))
  const enemies=[];
  for(let i=0;i<nE;i++){
    if(ti>=targets.length)break;
    const{x,y}=targets[ti++];
    const tpl=pickEnemyForFloor(f);
    enemies.push({...tpl,x,y,curHp:tpl.hp,state:'idle'});
  }
  // ── Phase17: 階段生成アルゴリズム改善 ──
  // 「通路で偶然見つかる」を防ぐため、階段は必ず部屋の中(通路上には絶対に生成しない)に配置する。
  // 開始部屋は除外。スタートから遠い部屋ほど優先される重み付けランダム選択(遠距離優先モード)。
  const roomFloorCells=room=>{
    const cells=[];
    for(let dy=0;dy<room.h;dy++)for(let dx=0;dx<room.w;dx++){
      const x=room.x+dx,y=room.y+dy;
      if(g[y]&&g[y][x]===CELL.FLOOR)cells.push({x,y});
    }
    return cells;
  };
  const pickWeightedRoom=exclude=>{
    const cands=rooms.filter(r=>r!==startRoom&&r!==exclude);
    if(!cands.length)return null;
    const sx=startRoom.x+startRoom.w/2,sy=startRoom.y+startRoom.h/2;
    const weighted=[];
    cands.forEach(r=>{
      const cx=r.x+r.w/2,cy=r.y+r.h/2;
      const dist=Math.hypot(cx-sx,cy-sy);
      const w=Math.max(1,Math.round(dist)); // 遠い部屋ほど重みが大きい = 選ばれやすい
      for(let i=0;i<w;i++)weighted.push(r);
    });
    return weighted[Math.floor(Math.random()*weighted.length)];
  };
  const placeInRoom=(room,type)=>{
    if(!room)return null;
    const cells=roomFloorCells(room);
    if(!cells.length)return null;
    const cell=cells[Math.floor(Math.random()*cells.length)];
    g[cell.y][cell.x]=type;return cell;
  };
  let stairsDownRoom=null,stairsDownPos=null,stairsUpPos=null;
  if(f<DM.maxFloor){
    stairsDownRoom=pickWeightedRoom(null);
    stairsDownPos=placeInRoom(stairsDownRoom,CELL.STAIRS_DOWN);
  }
  if(f>1){
    stairsUpPos=placeInRoom(pickWeightedRoom(stairsDownRoom),CELL.STAIRS_UP);
  }
  // Exit: 廃止(Phase24)。撤退は✕ボタン(closeDmap)に統合し、脱出の宝玉システムで管理する。
  // if(f===1||f===DM.maxFloor){place(CELL.EXIT)}

  // ── Phase18: アイテム生成ルール改善 ──
  // アイテムは部屋限定・通路には出現しない。階層が深いほど多くの部屋に生成(探索価値を底上げ)。
  // 開始位置と重ならないよう除外。同一部屋内での同種過剰生成を抑制しつつ、選ばれた部屋には必ず1個以上配置する。
  const itemDensity=f<5?0.3:f<10?0.45:0.6; // 低層30% / 中層45% / 高層60%の部屋に生成
  const items=[];
  rooms.forEach(room=>{
    if(room.type!=='normal')return; // Phase23: 特殊部屋は専用ロジックで内容を生成するため対象外
    if(Math.random()>=itemDensity)return;
    const cells=roomFloorCells(room).filter(c=>!(c.x===px&&c.y===py));
    if(!cells.length)return;
    const area=room.w*room.h;
    const maxN=area<=12?1:area<=20?2:3; // 小部屋1 / 中部屋1-2 / 大部屋1-3
    const n=Math.min(maxN===1?1:1+Math.floor(Math.random()*maxN),cells.length);
    const used=new Set();
    const placedTypes={};
    for(let i=0;i<n;i++){
      let cell,tries=0;
      do{cell=cells[Math.floor(Math.random()*cells.length)];tries++}
      while(used.has(`${cell.x},${cell.y}`)&&tries<10);
      if(used.has(`${cell.x},${cell.y}`))break;
      used.add(`${cell.x},${cell.y}`);
      const id=pickItemDrop(f,placedTypes);
      if(!id)continue;
      placedTypes[id]=(placedTypes[id]||0)+1;
      items.push({x:cell.x,y:cell.y,id});
    }
  });

  // ── Phase23: 特殊部屋の内容生成 ──
  // 宝物庫: アイテム2〜4個 / モンスター部屋: 敵4〜8体 / 休憩部屋: 何も置かず安全地帯として確保
  const restCells=new Set();
  rooms.forEach(room=>{
    if(room.type==='treasure'){
      const cells=roomFloorCells(room).filter(c=>!(c.x===px&&c.y===py));
      const n=Math.min(2+Math.floor(Math.random()*3),cells.length); // 2〜4個
      const used=new Set();
      for(let i=0;i<n;i++){
        let cell,tries=0;
        do{cell=cells[Math.floor(Math.random()*cells.length)];tries++}
        while(used.has(`${cell.x},${cell.y}`)&&tries<10);
        if(used.has(`${cell.x},${cell.y}`))break;
        used.add(`${cell.x},${cell.y}`);
        const id=pickItemDrop(f,{});
        if(id)items.push({x:cell.x,y:cell.y,id});
      }
    } else if(room.type==='monster'){
      const cells=roomFloorCells(room).filter(c=>!(c.x===px&&c.y===py));
      const n=Math.min(4+Math.floor(Math.random()*5),cells.length); // 4〜8体
      const used=new Set();
      for(let i=0;i<n;i++){
        let cell,tries=0;
        do{cell=cells[Math.floor(Math.random()*cells.length)];tries++}
        while(used.has(`${cell.x},${cell.y}`)&&tries<10);
        if(used.has(`${cell.x},${cell.y}`))break;
        used.add(`${cell.x},${cell.y}`);
        const tpl=pickEnemyForFloor(f);
        enemies.push({...tpl,x:cell.x,y:cell.y,curHp:tpl.hp,state:'idle'});
      }
    } else if(room.type==='rest'){
      roomFloorCells(room).forEach(c=>restCells.add(`${c.x},${c.y}`));
    }
  });

  // Fog of war: all cells start unexplored
  const explored=new Set();
  explored.add(`${px},${py}`);
  // Reveal 1-radius around start
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=px+dx,ny=py+dy;
    if(nx>=0&&nx<GW&&ny>=0&&ny<GH)explored.add(`${nx},${ny}`);
  }
  DM.floors[f]={grid:g,playerPos:{x:px,y:py},explored,enemies,items,stairsDownPos,stairsUpPos,rooms,restCells};
}
// アイテム生成テーブル(Phase18の部屋限定生成 + Phase21のバランス調整値 + Phase23の新アイテム)
// 薬草70% / 上薬草20%(B5F以降) / パン10%を基本とし、深層では大薬草・火炎石・毒消し草も追加で出現する。
// 同一部屋での同種過剰生成を抑制するため、既に2個以上置かれた種類は重みを下げる。
function pickItemDrop(floor,placedTypes){
  const table=[{id:'herb',w:70},{id:'bread',w:10}];
  if(floor>=5)table.push({id:'great_herb',w:20});
  if(floor>=3)table.push({id:'antidote',w:5});
  if(floor>=8)table.push({id:'fire_stone',w:12});
  if(floor>=10)table.push({id:'big_herb',w:8});
  const weighted=[];
  table.forEach(t=>{
    const penalty=(placedTypes[t.id]||0)>=2?0.3:1;
    const w=Math.max(1,Math.round(t.w*penalty));
    for(let i=0;i<w;i++)weighted.push(t.id);
  });
  return weighted[Math.floor(Math.random()*weighted.length)];
}

function loadFloor(f){
  if(!DM.floors[f])generateFloor(f);
  DM.floor=f;DM.pending=null;
  document.getElementById('dm-floor').textContent=`B${f}F`;
  dmLog(`B${f}F に到着した。`);
  showFloorFlash(f); // Phase22: 階段演出
  checkEscapeGemAward(f); // Phase24: 階層到達ボーナス(脱出の宝玉)
  if(f===DM.maxFloor){
    // Phase24: 脱出マス廃止に伴い、最深部到達=即クリアとする
    dmLog('🏆 最深部に到達した！ダンジョン完全制覇！');
    setTimeout(()=>{closeDmap('clear');toast('🏆 全20階クリア！完全制覇！','gr')},900);
  }
}
// Phase22: 階層移動時に画面中央へ「B{N}F」を表示してフェードアウトさせる
function showFloorFlash(f){
  const el=document.getElementById('floor-flash');
  if(!el)return;
  el.textContent=`B${f}F`;
  el.classList.remove('show');
  void el.offsetWidth; // リフローで再トリガー可能にする(連続階層移動でも毎回再生される)
  el.classList.add('show');
}
// Phase22: レアアイテム(上薬草)取得時に画面中央へ「★発見★」を表示
function showRareFind(){
  const el=document.getElementById('rare-flash');
  if(!el)return;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

// 不思議のダンジョン形式: 主人公中心のビューポート (VW x VH) をマップ側のオフセットで描画
// 改修(MVPローグライク化・マップ拡大): 7x7→9x9 に拡大し、不要UI削減で生まれた領域も活用
const VW=9,VH=9; // viewport size (odd: 中心セルが常にプレイヤー) — UI改善(マップ表示最大化): 13→9、セルをさらに大きく見せる
const DM_LIGHT_FALLOFF=0.22; // 視界ライティング: 中心から離れるほど暗くなる係数
const DM_LIGHT_MIN=0.5;      // 最低輝度(既踏破セルでも床と壁の判別を保つ)

/* ════ Phase24: プレイヤースプライトシート(player_sheet.png) ════
   1枚画像 6列(フレーム)×4行(方向)。列: idle,walk1,walk2,walk3,walk4,attack / 行: down,up,left,right
   画像未配置でも壊れないよう、CSS側で.player-spriteに単色のフォールバック背景を用意している。 */
const SPRITE_COLS=6,SPRITE_ROWS=4;
const SPRITE_DIR_ROW={down:0,up:1,left:2,right:3};
const SPRITE_FRAME_COL={idle:0,walk1:1,walk2:2,walk3:3,walk4:4,attack:5};
function spritePos(dir,frame){
  const col=SPRITE_FRAME_COL[frame]??0;
  const row=SPRITE_DIR_ROW[dir]??0;
  const x=col/(SPRITE_COLS-1)*100;
  const y=row/(SPRITE_ROWS-1)*100;
  return `${x}% ${y}%`;
}
// dmRenderでグリッド全体を再構築せず、プレイヤーアイコンの背景位置だけを書き換える(アニメーション再生用の軽量更新)
function dmUpdatePlayerSprite(){
  const el=document.querySelector('#dm-grid .player-sprite');
  if(el)el.style.backgroundPosition=spritePos(DM.anim.dir,DM.anim.frame);
}
let _dmWalkTimer=null;
const DM_WALK_FRAMES=['walk1','walk2','walk3','walk4'];
const DM_WALK_FRAME_MS=90;
function dmPlayWalkAnim(dir){
  DM.anim.dir=dir;
  if(_dmWalkTimer){clearInterval(_dmWalkTimer);_dmWalkTimer=null}
  let i=0;
  DM.anim.frame=DM_WALK_FRAMES[0];
  _dmWalkTimer=setInterval(()=>{
    i++;
    if(i>=DM_WALK_FRAMES.length){
      clearInterval(_dmWalkTimer);_dmWalkTimer=null;
      DM.anim.frame='idle';
    }else{
      DM.anim.frame=DM_WALK_FRAMES[i];
    }
    dmUpdatePlayerSprite();
  },DM_WALK_FRAME_MS);
}
const DM_ATTACK_ANIM_MS=220;
function dmPlayAttackAnim(dir){
  DM.anim.dir=dir;
  if(_dmWalkTimer){clearInterval(_dmWalkTimer);_dmWalkTimer=null}
  DM.anim.frame='attack';
  dmUpdatePlayerSprite();
  setTimeout(()=>{
    if(DM.anim.frame==='attack')DM.anim.frame='idle';
    dmUpdatePlayerSprite();
  },DM_ATTACK_ANIM_MS);
}
function dmRender(){
  const gc=document.getElementById('dm-grid');
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p,enemies,items}=fl;
  let html='';
  const T={
    [CELL.WALL]:'dwa',
    [CELL.FLOOR]:'dfl',
    [CELL.PLAYER]:'dpl',
    [CELL.CHEST]:'dch',
    [CELL.CHEST_GOLD]:'dch',
    [CELL.EVENT]:'dev',
    [CELL.EXIT]:'dex',
    [CELL.STAIRS_DOWN]:'dst2',
    [CELL.STAIRS_UP]:'dstu',
  };
  const icons={[CELL.PLAYER]:`<div class="player-sprite" style="background-position:${spritePos(DM.anim.dir,DM.anim.frame)}"></div>`,[CELL.CHEST]:'🎁',[CELL.CHEST_GOLD]:'💰',[CELL.EVENT]:'❓',[CELL.EXIT]:'🚪',[CELL.STAIRS_DOWN]:'↓',[CELL.STAIRS_UP]:'↑'};
  // 改修(MVPローグライク化): 敵は静的セルではなく動的エンティティとして座標上に重ねて描画する
  const enemyAt={};
  (enemies||[]).forEach(e=>{if(e.curHp>0)enemyAt[`${e.x},${e.y}`]=e});
  // 床アイテム(Phase16/18/19): 同マスに複数あれば重ねて表示(先頭のアイコン+個数バッジ)
  const itemsAt={};
  (items||[]).forEach(it=>{
    const k=`${it.x},${it.y}`;
    (itemsAt[k]=itemsAt[k]||[]).push(it);
  });
  // プレイヤーを中心(center)に置くためのマップ側オフセット
  const ox=p.x-Math.floor(VW/2);
  const oy=p.y-Math.floor(VH/2);
  for(let vy=0;vy<VH;vy++)for(let vx=0;vx<VW;vx++){
    const mx=ox+vx,my=oy+vy; // マップ座標
    // マップ範囲外: 壁タイルで補完
    if(mx<0||mx>=GW||my<0||my>=GH){html+=`<div class="dc dwa"></div>`;continue}
    const key=`${mx},${my}`;
    const fog=!explored.has(key)&&g[my][mx]!==CELL.PLAYER;
    if(fog){html+=`<div class="dc dfo"></div>`;continue}
    const t=g[my][mx];
    let cls=T[t]||'dfl';
    let ico=icons[t]||'';
    const stack=itemsAt[key];
    if(stack&&stack.length){
      const def=getItemDef(stack[0].id);
      cls='ditem';
      ico=(def?def.icon:'❔')+(stack.length>1?`<span class="ditem-badge">${stack.length}</span>`:'');
    }
    const enemy=enemyAt[key];
    if(enemy){
      cls='den';
      // Phase22: 敵頭上にHPバーを表示
      const hpPct=enemy.hp?Math.max(0,Math.round(enemy.curHp/enemy.hp*100)):0;
      ico=`<div class="ehp"><div class="ehp-fill" style="width:${hpPct}%"></div></div>${enemy.icon||'👾'}`;
    } // 敵が乗っているマスは敵を優先表示(アイテムより視認性を優先)
    // 視界ライティング: プレイヤーからの距離が遠い既踏破セルほど暗く表示
    const dist=Math.sqrt((mx-p.x)**2+(my-p.y)**2);
    const bright=Math.max(DM_LIGHT_MIN,1-dist*DM_LIGHT_FALLOFF).toFixed(2);
    html+=`<div class="dc ${cls}" style="filter:brightness(${bright})">${ico}</div>`;
  }
  gc.innerHTML=html;
  dmRenderMinimap();
  dmUpdateHud();
  // Action button state (改修: 'enemy'保留状態はモーダル戦闘廃止により削除)
  const ab=document.getElementById('dm-act');
  if(DM.pending==='event_choice'){
    ab.textContent='❓ 調べる';
    ab.style.background='linear-gradient(180deg,#b06aff,#8a6dfa)';
    ab.style.color='#fff';
  }else if(DM.pending==='chest'){
    ab.textContent='🎁 開ける';
    ab.style.background='linear-gradient(180deg,#e8c96a,#c8a84b)';
    ab.style.color='#04060c';
  }else if(DM.pending==='stairs_down'||DM.pending==='stairs_up'){
    ab.textContent=DM.pending==='stairs_down'?'↓ 進む':'↑ 戻る';
    ab.style.background='linear-gradient(180deg,#7ad0ff,#4ea8d8)';
    ab.style.color='#04060c';
  }else{
    ab.textContent='⚔';
    ab.style.background='';
    ab.style.color='';
  }
}

// 全体俯瞰ミニマップ: 探索済みセルをドットで表示(画面左上に常設)
function dmRenderMinimap(){
  const mm=document.getElementById('dm-minimap');
  if(!mm)return;
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p,enemies}=fl;
  // Phase22: 敵の現在位置を素早く参照できるようマップ化(生存している敵のみ)
  const enemyAt={};
  (enemies||[]).forEach(e=>{if(e.curHp>0)enemyAt[`${e.x},${e.y}`]=true});
  let html='';
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    let cls='dmm-fog';
    const key=`${x},${y}`;
    if(x===p.x&&y===p.y)cls='dmm-player';
    else if(explored.has(key)){
      if(enemyAt[key])cls='dmm-enemy';
      else if(g[y][x]===CELL.STAIRS_DOWN||g[y][x]===CELL.STAIRS_UP)cls='dmm-stairs';
      else cls=g[y][x]===CELL.WALL?'dmm-wall':'dmm-explored';
    }
    html+=`<div class="dmm ${cls}"></div>`;
  }
  mm.innerHTML=html;
}

// ダンジョン中も常時表示するHUD: 職業・EXP・所持品(語数/Gold/AP)・HPを同期
function dmUpdateHud(){
  const j=JD.find(j=>j.id===S.job);
  const jobEl=document.getElementById('dmh-job');
  if(jobEl)jobEl.textContent=j?j.icon+' '+j.name:'🌱 Novice';
  const pct=S.exp%100;
  const ef=document.getElementById('dmh-ef');if(ef)ef.style.width=pct+'%';
  const el=document.getElementById('dmh-el');if(el)el.textContent=`${pct}/100 EXP`;
  const w=document.getElementById('dmh-w');if(w)w.textContent=nd();
  const gld=document.getElementById('dmh-g');if(gld)gld.textContent=S.gold||0;
  const ap=document.getElementById('dmh-ap');if(ap)ap.textContent=S.ap||0;
  const inv=document.getElementById('dmh-inv');if(inv)inv.textContent=`${(S.inventory||[]).length}/${INV_MAX_SLOTS}`;
  const gem=document.getElementById('dmh-gem');if(gem)gem.textContent=S.escapeGems||0;
  // HPバー(MVPローグライク化アップデート: 常時表示)
  const hpFill=document.getElementById('dm-hpfill2');
  const hpTxt=document.getElementById('dm-hptxt2');
  if(hpFill&&hpTxt){
    const hpPct=DM.playerMaxHp?Math.max(0,Math.round(DM.playerHp/DM.playerMaxHp*100)):0;
    hpFill.style.width=hpPct+'%';
    hpFill.style.background=hpPct<=25
      ?'linear-gradient(90deg,#c84b4b,#ff6a6a)'
      :'linear-gradient(90deg,var(--green),#7ae0a0)';
    hpTxt.textContent=`${Math.max(0,DM.playerHp)}/${DM.playerMaxHp}`;
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
  DM.anim.dir=dir; // Phase24: 移動・攻撃どちらでも向きを更新
  // 接触攻撃(MVPローグライク化): 移動先に生存中の敵がいれば、移動せず即攻撃してターンを消費する
  const enemyHere=(fl.enemies||[]).find(e=>e.curHp>0&&e.x===nx&&e.y===ny);
  if(enemyHere){
    dmContactAttack(enemyHere,dir);
    return;
  }
  // Move
  // 階段タイルは「降りる/上る」を選ばずに離れた場合も消えずに残るようにする(通常マスはFLOORに戻る)
  const leaving=(fl.stairsDownPos&&fl.stairsDownPos.x===p.x&&fl.stairsDownPos.y===p.y)?CELL.STAIRS_DOWN
    :(fl.stairsUpPos&&fl.stairsUpPos.x===p.x&&fl.stairsUpPos.y===p.y)?CELL.STAIRS_UP:CELL.FLOOR;
  g[p.y][p.x]=leaving;
  fl.playerPos={x:nx,y:ny};
  DM.steps++;
  // Reveal fog around new position
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const ex=nx+dx,ey=ny+dy;
    if(ex>=0&&ex<GW&&ey>=0&&ey<GH)explored.add(`${ex},${ey}`);
  }
  // Phase16/18/19: 床のアイテムを自動取得(プレイヤーが踏むと自動取得)
  if((fl.items||[]).some(it=>it.x===nx&&it.y===ny)){
    dmTryPickupItems(nx,ny);
    if(DM.pending==='inv_full')return; // 持ち物がいっぱい: ユーザーの選択待ち(このターンの残りは保留)
  }
  // Handle cell
  let msg='';
  if(dest===CELL.CHEST){
    msg='🎁 宝箱を発見！';DM.pending='chest';g[ny][nx]=CELL.PLAYER;
    setTimeout(()=>{if(DM.pending==='chest')dmResolvePending()},500);
  }else if(dest===CELL.CHEST_GOLD){
    g[ny][nx]=CELL.PLAYER;
    msg=openGoldChest();
  }else if(dest===CELL.EVENT){
    msg='❓ 古い石碑を見つけた…';DM.pending='event_choice';g[ny][nx]=CELL.PLAYER;
    setTimeout(()=>{if(DM.pending==='event_choice')dmResolvePending()},500);
  }else if(dest===CELL.STAIRS_DOWN){
    msg='↓ 下り階段を見つけた。';DM.pending='stairs_down';g[ny][nx]=CELL.PLAYER;
    setTimeout(()=>{if(DM.pending==='stairs_down')openStairsConfirm('down')},300);
  }else if(dest===CELL.STAIRS_UP&&DM.floor>1){
    msg='↑ 上り階段を見つけた。';DM.pending='stairs_up';g[ny][nx]=CELL.PLAYER;
    setTimeout(()=>{if(DM.pending==='stairs_up')openStairsConfirm('up')},300);
  }else{
    g[ny][nx]=CELL.PLAYER;
  }
  if(msg){dmLog(msg)}
  dmPlayWalkAnim(dir); // Phase24: 歩行アニメーション(walk1→4を再生してidleに戻る)
  dmRender();
  // 敵ターン制(MVPローグライク化): 移動も1ターンとして扱い、敵全体を行動させる
  dmEnemyTurn();
}

function dma(){
  dmResolvePending();
}

/* ════ 接触攻撃・敵ターン制・敵AI (MVPローグライク化アップデート) ════
   - 戦闘モーダルを廃止し、移動先に敵がいれば即攻撃してダメージをフロート表示する
   - プレイヤーの行動(移動・攻撃)1回ごとに、生存中の敵全体が1回行動する(隣接→攻撃、索敵範囲内→追跡、それ以外→ランダム移動)
════════════════════════════════════════════════ */
const DM_DETECT_RANGE=5; // 索敵範囲(マス, Chebyshev距離)

// 敵に接触攻撃を行い、結果をフローティングダメージ・ログで即時表示する(モーダル禁止)
function dmContactAttack(enemy,dir){
  dmPlayAttackAnim(dir); // Phase24: 攻撃アニメーション(短時間attackフレーム表示)
  const playerAtk=getPlayerAtk();
  const dmg=Math.max(1,playerAtk-(enemy.def||0));
  enemy.curHp-=dmg;
  const ddx=dir==='left'?-1:dir==='right'?1:0;
  const ddy=dir==='up'?-1:dir==='down'?1:0;
  dmShowFloatDamage(Math.floor(VW/2)+ddx,Math.floor(VH/2)+ddy,dmg,'enemy');
  dmLog(`⚔ ${enemy.name}に${dmg}ダメージ！`);
  if(enemy.curHp<=0){
    dmKillEnemy(enemy);
  }
  dmRender();
  if(DM.pending==='inv_full')return; // 持ち物がいっぱい: ユーザーの選択待ち(ターン処理は保留)
  dmEnemyTurn();
}

// ── Phase19: ドロップシステム ──
// 敵レアリティ別のドロップ確率テーブル(初期値はスライム=common を基準に設定)
const DROP_TABLES={
  common:   [{id:'herb',w:20},{id:'great_herb',w:5}],
  uncommon: [{id:'herb',w:25},{id:'great_herb',w:8},{id:'antidote',w:3}],
  rare:     [{id:'herb',w:25},{id:'great_herb',w:12},{id:'bread',w:5},{id:'fire_stone',w:6},{id:'antidote',w:4}],
  legendary:[{id:'herb',w:20},{id:'great_herb',w:20},{id:'bread',w:10},{id:'fire_stone',w:10},{id:'big_herb',w:8}],
};
// 1体につき最大2回のドロップ判定(重複可・何も出ない場合あり)
function rollEnemyDrops(enemy){
  const table=DROP_TABLES[enemy.rarity]||DROP_TABLES.common;
  const drops=[];
  for(let i=0;i<2;i++){
    const r=Math.random()*100;
    let acc=0,picked=null;
    for(const t of table){acc+=t.w;if(r<acc){picked=t.id;break}}
    if(picked)drops.push(picked);
  }
  return drops;
}

// 敵を撃破した際の報酬処理(旧onBattleWinを接触攻撃用に移植)
function dmKillEnemy(enemy){
  const fl=DM.floors[DM.floor];
  if(fl&&fl.enemies)fl.enemies=fl.enemies.filter(e=>e!==enemy);
  registerDexMonster(enemy.id); // Phase20: 初撃破で図鑑に登録
  const goldGain=Math.round((enemy.reward?.gold||0)*getGoldMultiplier());
  const aexpGain=Math.round((enemy.reward?.aexp||0)*getAExpMultiplier());
  S.gold=(S.gold||0)+goldGain;
  S.aexp=(S.aexp||0)+aexpGain;
  S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
  S.dungeonRecords.kills++;
  DM.kills=(DM.kills||0)+1;
  // 単語発見率上昇: このダンジョン探索中だけ+5%(プレイヤーレベルは追加しない、Phase8 item8)
  DM.battleDiscoverBonus=(DM.battleDiscoverBonus||0)+0.05;
  // Phase12: 敵撃破でレベルアップ用経験値を取得(Archive EXPと同額を流用、固定成長)
  gainLevelExp(aexpGain);
  // Phase19: ドロップは即時フィールド(プレイヤーの足元)に生成し、その場で自動取得を試みる
  // (ドロップ取得自体はターンを消費しない。所持上限ならPhase16の「置く」プロンプトに繋がる)
  let dropMsg='';
  const drops=fl?rollEnemyDrops(enemy):[];
  drops.forEach(id=>{
    if(fl)dmPlaceItemsOnFloor(id,1,fl.playerPos);
    const def=getItemDef(id);
    if(def)dropMsg+=` ${def.icon}${def.jp}がドロップした！`;
  });
  save();updateHdr();
  dmLog(`🎉 ${enemy.name}を倒した！ 💰+${goldGain} Gold / 📈+${aexpGain} Archive EXP${dropMsg}`);
  if(drops.length&&fl)dmTryPickupItems(fl.playerPos.x,fl.playerPos.y);
}

// ── Phase16/18/19: 床アイテムの取得・設置 ──
// 指定座標にある床アイテムを順に取得する。所持がいっぱいになった時点で「置く」プロンプトを表示して停止する
// (残りのアイテムは床に残り、次回踏んだ時/空きができた時に再試行される)。取得自体はターンを消費しない。
function dmTryPickupItems(x,y){
  const fl=DM.floors[DM.floor];if(!fl||!fl.items)return;
  const here=fl.items.filter(it=>it.x===x&&it.y===y);
  for(const it of here){
    const def=getItemDef(it.id);
    if(!def)continue;
    if(addItem(it.id,1)){
      fl.items=fl.items.filter(i=>i!==it);
      dmLog(`${def.icon} ${def.jp}を手に入れた！`);
      if(it.id==='great_herb')showRareFind(); // Phase22: レアアイテム演出
    }else{
      DM.pending='inv_full';
      DM.pendingPickup={x,y};
      openInvFullPrompt();
      return;
    }
  }
}
// プレイヤーの位置にアイテムをn個設置する(同マス複数アイテム可・視覚的に重ね表示される)
function dmPlaceItemsOnFloor(id,n,pos){
  const fl=DM.floors[DM.floor];
  if(!fl||!pos)return;
  if(!fl.items)fl.items=[];
  for(let i=0;i<n;i++)fl.items.push({x:pos.x,y:pos.y,id});
}

// 指定座標が敵の移動先として有効か(壁・プレイヤー・他の敵がいないか)を判定
function dmIsWalkable(fl,x,y){
  if(x<0||x>=GW||y<0||y>=GH)return false;
  if(fl.grid[y][x]===CELL.WALL)return false;
  if(fl.playerPos.x===x&&fl.playerPos.y===y)return false;
  if((fl.enemies||[]).some(e=>e.curHp>0&&e.x===x&&e.y===y))return false;
  return true;
}
// 発見状態の敵: プレイヤーへ1マス追跡移動
function dmMoveEnemyToward(e,p,fl){
  const dx=Math.sign(p.x-e.x),dy=Math.sign(p.y-e.y);
  const tryMoves=Math.abs(p.x-e.x)>=Math.abs(p.y-e.y)
    ?[[dx,dy],[dx,0],[0,dy]]
    :[[dx,dy],[0,dy],[dx,0]];
  for(const[mx,my]of tryMoves){
    if(mx===0&&my===0)continue;
    const nx=e.x+mx,ny=e.y+my;
    if(dmIsWalkable(fl,nx,ny)){e.x=nx;e.y=ny;return}
  }
}
// 未発見状態の敵: ランダム移動
function dmMoveEnemyRandom(e,fl){
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  const d=dirs[Math.floor(Math.random()*dirs.length)];
  const nx=e.x+d[0],ny=e.y+d[1];
  if(dmIsWalkable(fl,nx,ny)){e.x=nx;e.y=ny}
}
// 敵全体の1ターン分の行動を解決する: 隣接→攻撃、索敵範囲内→追跡、それ以外→ランダム移動
// 改修(Phase14/15): プレイヤーの行動1回ごとにここを通るため、ターン経過処理(自然回復等)もここで一括処理する
function dmEnemyTurn(){
  const fl=DM.floors[DM.floor];
  if(fl&&fl.enemies&&fl.enemies.length){
    const p=fl.playerPos;
    fl.enemies.forEach(e=>{
      if(e.curHp<=0)return;
      const dist=Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y));
      if(dist<=1){
        // 隣接: 攻撃(Phase11: 防御力ステータスを正式に適用)
        const dmg=Math.max(1,(e.atk||1)-getPlayerDef());
        DM.playerHp=Math.max(0,DM.playerHp-dmg);
        dmLog(`💢 ${e.name}の攻撃！ ${dmg}ダメージを受けた`);
        dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),dmg,'player');
        e.state='aggro';
        return;
      }
      if(dist<=DM_DETECT_RANGE+(e.detectBonus||0))e.state='aggro';
      if(e.state==='aggro')dmMoveEnemyToward(e,p,fl);
      else if(Math.random()<0.4)dmMoveEnemyRandom(e,fl);
    });
  }
  // ターン経過処理(Phase15): 自然回復判定。状態異常判定は未実装(将来拡張用のフック)
  DM.turnCount=(DM.turnCount||0)+1;
  if(DM.turnCount%10===0)dmNaturalRegen();
  dmRender();
  if(DM.playerHp<=0)dmPlayerDown();
}

// 自然回復(Phase14): プレイヤー行動10回毎に回復力ぶんHPが回復する。固定割合回復は禁止。
// HP30%以下では回復量2倍。Phase23: 休憩部屋(room.type==='rest')にいる間はさらに2倍(重複可)。
// 最大HPを超えない。ログ不要(フローティング表示のみ)。
function dmNaturalRegen(){
  if(!DM.dungeon||DM.playerHp<=0||DM.playerHp>=DM.playerMaxHp)return;
  const regen=getPlayerRegen();
  if(regen<=0)return;
  const lowHp=DM.playerHp<=DM.playerMaxHp*0.3;
  const fl=DM.floors[DM.floor];
  const inRest=!!(fl&&fl.restCells&&fl.playerPos&&fl.restCells.has(`${fl.playerPos.x},${fl.playerPos.y}`));
  const mult=(lowHp?2:1)*(inRest?2:1);
  const heal=Math.min(regen*mult,DM.playerMaxHp-DM.playerHp);
  if(heal<=0)return;
  DM.playerHp+=heal;
  dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),heal,'heal');
}

// 待機(Phase15): その場で1ターン経過する。移動しないが敵ターン・自然回復は通常通り処理する
function dmWait(){
  if(DM.pending)return;
  dmLog('🧘 待機した。');
  dmEnemyTurn();
}

// フローティングダメージ表示(風来のシレン方式): モーダルを出さず数値が上昇しながら消える
function dmShowFloatDamage(vx,vy,amount,kind){
  const frame=document.getElementById('dm-grid-frame');
  const grid=document.getElementById('dm-grid');
  if(!frame||!grid)return;
  const cellEl=grid.querySelector('.dc');
  const cw=cellEl?cellEl.offsetWidth:44;
  const gap=parseFloat(getComputedStyle(grid).gap)||2;
  const padLeft=parseFloat(getComputedStyle(frame).paddingLeft)||10;
  const padTop=parseFloat(getComputedStyle(frame).paddingTop)||10;
  const x=padLeft+vx*(cw+gap)+cw/2;
  const y=padTop+vy*(cw+gap)+cw*0.25;
  const el=document.createElement('div');
  el.className='dmg-float '+(kind||'enemy');
  el.textContent=(kind==='heal'?'+':kind==='enemy'?'⚔':kind==='fire'?'🔥':'')+Math.abs(amount);
  el.style.left=x+'px';
  el.style.top=y+'px';
  frame.appendChild(el);
  setTimeout(()=>el.remove(),900);
}

// プレイヤーのHPが0になった際の処理: ダンジョンから帰還する(獲得済みアーカイブ/Gold等は保持)
function dmPlayerDown(){
  toast('💀 倒れてしまった…ダンジョンから帰還した','g');
  closeDmap('death');
}

// 宝箱・イベントの保留状態を解決する(自動進行・手動ボタン共通処理)
// 改修(MVPローグライク化): 'enemy'保留状態は接触攻撃方式に統合されたため削除
function dmResolvePending(){
  if(!DM.pending)return;
  if(DM.pending==='event_choice'){
    showEventChoice();
    return;
  }
  if(DM.pending==='stairs_down'||DM.pending==='stairs_up'){
    openStairsConfirm(DM.pending==='stairs_down'?'down':'up');
    return;
  }
  // 通常チェスト: アーカイブ(単語)を直接発見させる
  // 改修(探索テンポ改善・強制クイズ廃止): 解答必須のクイズで進行を止めない。
  // discover()は既存のDISCOVERY CARDで報酬を提示するだけの非ブロッキングUIなので、
  // ダンジョン画面(dmov)はそのまま開いたままで良い。
  const d=DM.dungeon;
  const pool=d.words.map(w=>WM[w]).filter(Boolean);
  // 深い階層ほど複数アーカイブをまとめて入手(従来のクイズ2問仕様を踏襲)
  const n=DM.floor>=5?2:1;
  DM.pending=null;
  const found=[];
  for(let i=0;i<n;i++){
    const unknownPool=pool.filter(w=>gst(w.word)==='unknown'&&!found.includes(w.word));
    const w=pickBonusWord(unknownPool.length?unknownPool:pool);
    if(w&&gst(w.word)==='unknown'){discover(w.word);DM.wordsFound++;found.push(w.word)}
  }
  let msg;
  if(found.length){
    msg=`🎁 宝箱からアーカイブ「${found.join('」「')}」を発見！`;
  }else{
    const amt=Math.round((5+Math.floor(Math.random()*DM.floor*3))*getGoldMultiplier());
    S.gold=(S.gold||0)+amt;save();updateHdr();
    msg=`🎁 宝箱からGold ${amt} を見つけた。`;
  }
  dmLog(msg);
  dmRender();
}

/* ════ 階段の確認選択肢: 次の階に行くかどうかをプレイヤーに選ばせる ════ */
function openStairsConfirm(dir){
  document.getElementById('stairs-title').textContent=dir==='down'?'↓ 下り階段':'↑ 上り階段';
  document.getElementById('stairs-desc').textContent=dir==='down'
    ?`B${DM.floor+1}Fへ進みますか？`
    :`B${DM.floor-1}Fへ戻りますか？`;
  document.getElementById('stairs-ov').classList.add('show');
}
function dmConfirmStairs(){
  const pending=DM.pending;
  document.getElementById('stairs-ov').classList.remove('show');
  DM.pending=null;
  if(pending==='stairs_down'){
    dmLog(`↓ 階段を下りた。B${DM.floor+1}Fへ`);
    loadFloor(DM.floor+1);
  }else if(pending==='stairs_up'){
    dmLog(`↑ 階段を上った。B${DM.floor-1}Fへ`);
    loadFloor(DM.floor-1);
  }
  dmRender();
}
function dmCancelStairs(){
  document.getElementById('stairs-ov').classList.remove('show');
  DM.pending=null;
  dmRender(); // 階段マスのまま留まる(次に踏んだ時に再度選択肢が出る)
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
  dmProcessQueue();
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
  if(msg){dmLog(msg)}
}

/* ════ キーボード操作: 連続入力(キーリピート)対応 ════
   - keydown/keyupで押下状態を管理し、複数キーの同時押し・切り替えに対応
   - 押し続けると 初回遅延(REPEAT_DELAY) 後から 一定間隔(REPEAT_INTERVAL) で移動を繰り返す
   - 移動完了直後にキューを処理することで、入力が無視されないようにする */
const DM_KEY_DIR={
  'ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right',
  'w':'up','s':'down','a':'left','d':'right',
  'W':'up','S':'down','A':'left','D':'right'
};
const DM_REPEAT_DELAY=250;   // 初回入力からリピート開始までの遅延(ms)
const DM_REPEAT_INTERVAL=120;// リピート間隔(ms)
const dmInput={
  keysDown:new Set(),   // 現在押下中のキー(方向)
  activeDir:null,       // リピート中の方向
  timer:null,           // setTimeout/setIntervalのID
  queue:[]              // 移動完了直後に処理する入力キュー
};
function dmIsOverlayOpen(){
  return document.getElementById('dmov')?.classList.contains('show');
}
function dmStopRepeat(){
  if(dmInput.timer){clearTimeout(dmInput.timer);clearInterval(dmInput.timer);dmInput.timer=null}
  dmInput.activeDir=null;
}
function dmStartRepeat(dir){
  dmInput.activeDir=dir;
  dmStopRepeatTimerOnly();
  // 初回遅延後にリピート開始
  dmInput.timer=setTimeout(()=>{
    if(dmInput.activeDir!==dir)return;
    dmInput.timer=setInterval(()=>{
      if(dmInput.activeDir!==dir||!dmIsOverlayOpen()){dmStopRepeat();return}
      dmQueueMove(dir);
    },DM_REPEAT_INTERVAL);
  },DM_REPEAT_DELAY);
}
function dmStopRepeatTimerOnly(){
  if(dmInput.timer){clearTimeout(dmInput.timer);clearInterval(dmInput.timer);dmInput.timer=null}
}
// 移動をキューに積み、現在処理中でなければ即時実行。
// dmv()自体は同期処理だが、setTimeoutを伴う遷移(階段・出口)中は
// pending/オーバーレイ状態を見て後続入力を取りこぼさないようにする
function dmQueueMove(dir){
  dmInput.queue.push(dir);
  dmProcessQueue();
}
function dmProcessQueue(){
  while(dmInput.queue.length){
    if(DM.pending)break; // イベント選択待ち等の間はキューを保留
    const dir=dmInput.queue.shift();
    dmv(dir);
  }
}
function dmHandleKeydown(e){
  if(!dmIsOverlayOpen())return;
  if(e.key===' '){ // 待機(Phase15推奨キー)
    e.preventDefault();
    dmWait();
    return;
  }
  const dir=DM_KEY_DIR[e.key];
  if(!dir)return;
  e.preventDefault();
  if(dmInput.keysDown.has(e.key))return; // 同キーのリピートイベントは無視(ブラウザ標準リピート対策)
  dmInput.keysDown.add(e.key);
  // 即時1マス移動
  dmQueueMove(dir);
  // 押し続けによる連続移動を開始
  dmStartRepeat(dir);
}
function dmHandleKeyup(e){
  const dir=DM_KEY_DIR[e.key];
  if(!dir)return;
  dmInput.keysDown.delete(e.key);
  if(dmInput.activeDir===dir){
    dmStopRepeat();
    // 他に押されているキー/ボタンがあれば、その方向のリピートに切り替える
    for(const k of dmInput.keysDown){
      const d=k.startsWith('btn:')?k.slice(4):DM_KEY_DIR[k];
      if(d){dmStartRepeat(d);break}
    }
  }
}
window.addEventListener('keydown',dmHandleKeydown);
window.addEventListener('keyup',dmHandleKeyup);

/* ════ 方向ボタン: タッチ/ポインター長押しで連続入力 ════
   キーボードと同じ keysDown / dmStartRepeat / dmStopRepeat を共有し、
   ボタン押下は 'btn:up' のような専用キーで管理する */
function dmBindDirButtons(){
  document.querySelectorAll('.dmb[data-dmdir]').forEach(btn=>{
    const dir=btn.getAttribute('data-dmdir');
    const key=`btn:${dir}`;
    const start=e=>{
      e.preventDefault();
      if(dmInput.keysDown.has(key))return;
      dmInput.keysDown.add(key);
      dmQueueMove(dir);
      dmStartRepeat(dir);
    };
    const end=e=>{
      e.preventDefault();
      dmInput.keysDown.delete(key);
      if(dmInput.activeDir===dir){
        dmStopRepeat();
        for(const k of dmInput.keysDown){
          const d=k.startsWith('btn:')?k.slice(4):DM_KEY_DIR[k];
          if(d){dmStartRepeat(d);break}
        }
      }
    };
    btn.addEventListener('pointerdown',start);
    btn.addEventListener('pointerup',end);
    btn.addEventListener('pointercancel',end);
    btn.addEventListener('pointerleave',end);
  });
}
document.addEventListener('DOMContentLoaded',dmBindDirButtons);

// オーバーレイを閉じた際は入力状態をリセット
const _origCloseDmap=closeDmap;
closeDmap=function(reason){
  dmInput.keysDown.clear();
  dmInput.queue.length=0;
  dmStopRepeat();
  _origCloseDmap(reason);
};
