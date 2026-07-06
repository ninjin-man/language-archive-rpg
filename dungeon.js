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
// Phase25: 描画層(Renderer)はdungeon-renderer.jsに分離した。index.htmlでこのファイルより先に読み込むこと。
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
      playerHp:maxHp,playerMaxHp:maxHp,battleDiscoverBonus:0,anim:{dir:'down',frame:'idle'},
      satiety:100,maxSatiety:100,poison:0,hungerWarned:0}; // UX1a: 満腹度(シレン式)と毒状態。ラン毎にリセット
  Renderer.openDungeonView(d.name);
  // Phase7: ダンジョン記録 — 総探索回数をカウント
  S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
  S.dungeonRecords.totalRuns++;
  save();
  generateFloor(1);
  loadFloor(1);
  dmRender();
  dmBindGridTap();          // タップ移動ハンドラを保証(初回開始時)
  dmBindActionButtons();    // UX1b: A/Bボタンのタッチ即応結線(pointerdown)
  dmApplyDpadVisibility();  // 保存済みのDpad表示設定を反映
}
function closeDmap(reason){
  reason=reason||'manual'; // 'manual'(✕ボタン撤退) | 'death'(HP0帰還) | 'clear'(最深部到達)
  Renderer.closeDungeonView();
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
  // ワールドマップ経由で入った場合はフィールドへ帰還。そうでなければ探索タブのAtlasを再開。
  if(typeof S!=='undefined'&&S.fromWorld&&typeof enterWorld==='function'){
    enterWorld();
  } else if(typeof WM_show==='function'){
    WM_show(); // The Archive Atlas: ダンジョンから帰還したら世界地図の描画ループを再開
  }
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
  // Chests: 廃止。Goldは床に直接落ちている(ドロップ)ため宝箱は不要。
  // Events
  // Events: 廃止(Phase26)。石碑イベント(❓)はテンポを損なうため生成しない。
  // 関連ハンドラ(showEventChoice/resolveEventChoice)はEVENTセルが存在しないため呼ばれない。
  // for(let i=0;i<2;i++)place(CELL.EVENT);
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
  const itemDensity=f<5?0.5:f<10?0.6:0.7; // Phase26.1: 低層50% / 中層60% / 高層70%(浅い階でも装備等に遭遇しやすく底上げ)
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
      const drop=pickItemDrop(f,placedTypes);
      if(!drop||!drop.id)continue;
      placedTypes[drop.id]=(placedTypes[drop.id]||0)+1;
      items.push({x:cell.x,y:cell.y,id:drop.id,meta:drop.meta});
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
        const drop=pickItemDrop(f,{});
        if(drop&&drop.id)items.push({x:cell.x,y:cell.y,id:drop.id,meta:drop.meta});
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
  // ════ UX1b: 罠(シレン式) — 床に隠された罠を階数に応じて2〜5個配置 ════
  // 種類: トゲ(HP減)/毒(UX1aの毒に接続)/腹減り(UX1aの満腹度に接続)。
  // 罠は踏むと発動して可視化され、以後も残り続ける(シレン準拠)。Aの素振りで正面1マスを事前発見できる。
  const traps=[];
  const trapDefs=[
    {type:'spike', icon:'⚙', name:'トゲの罠'},
    {type:'poison',icon:'☠', name:'毒の罠'},
    {type:'hunger',icon:'🍽', name:'腹減りの罠'},
  ];
  const trapCount=Math.min(5,2+Math.floor(f/4));
  let trapGuard=0;
  while(traps.length<trapCount&&trapGuard++<300){
    const tx=1+Math.floor(Math.random()*(GW-2)), ty=1+Math.floor(Math.random()*(GH-2));
    if(g[ty][tx]!==CELL.FLOOR)continue;
    if(tx===px&&ty===py)continue;
    if(traps.some(t=>t.x===tx&&t.y===ty))continue;
    if((items||[]).some(it=>it.x===tx&&it.y===ty))continue;
    const def=trapDefs[Math.floor(Math.random()*trapDefs.length)];
    traps.push({x:tx,y:ty,type:def.type,icon:def.icon,name:def.name,revealed:false});
  }
  // ════ UX1d: 店(よろず屋) — B2と以降3の倍数階に商人を配置 ════
  // 開始部屋以外の部屋の床に立つ。接触すると売買画面(ターン非消費=シレン準拠の安全時間)。
  let merchant=null;
  if(f===2||(f>2&&f%3===0)){
    const startRoom=rooms.find(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h);
    const cand=rooms.filter(r=>r!==startRoom);
    if(cand.length){
      const room=cand[Math.floor(Math.random()*cand.length)];
      let mGuard=0,mx=-1,my=-1;
      while(mGuard++<60){
        const tx=room.x+Math.floor(Math.random()*room.w), ty=room.y+Math.floor(Math.random()*room.h);
        if(g[ty][tx]!==CELL.FLOOR)continue;
        if(traps.some(t=>t.x===tx&&t.y===ty))continue;
        if((items||[]).some(it=>it.x===tx&&it.y===ty))continue;
        mx=tx;my=ty;break;
      }
      if(mx>=0)merchant={x:mx,y:my,stock:shopBuildStock(f)};
    }
  }
  DM.floors[f]={grid:g,playerPos:{x:px,y:py},explored,enemies,items,stairsDownPos,stairsUpPos,rooms,restCells,traps,merchant};
}
// アイテム生成テーブル(Phase18の部屋限定生成 + Phase21のバランス調整値 + Phase23の新アイテム + Phase26のリワード刷新)
// 改修(Phase26): 戻り値を id文字列 から {id,meta} オブジェクトに変更し、装備のレアリティや
//   欠片のダンジョンIDといった「床ドロップ固有の付帯情報」を持てるようにした。
//   既存の薬草・パン等(metaなし)は {id} だけを返す。呼び出し側は both を受け付ける。
// アイテム比率(Phase26.1: 装備が見つかりやすいよう調整): アーカイブの欠片10% / お金16% / 鉱石12% / 装備20% / 残り(消費アイテム)42%
function pickItemDrop(floor,placedTypes){
  // ── カテゴリ抽選(各カテゴリの出現比率) ──
  const r=Math.random()*100;
  if(r<10)return {id:'archive_shard',meta:{dungeonId:DM.dungeon?.id}};           // 10% 欠片
  if(r<26)return {id:'gold_pile',meta:{amount:rollFloorGold(floor)}};            // 16% お金
  if(r<38)return {id:pickOre(floor)};                                            // 12% 鉱石
  if(r<58)return {id:pickEquip(),meta:{rarity:rollEquipRarity(floor)}};          // 20% 装備
  // ── 残り42%: 従来の消費アイテム(薬草中心) ──
  const table=[{id:'herb',w:70},{id:'bread',w:22}]; // UX1a: 満腹度導入でパンの価値上昇→比重10→22
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
  return {id:weighted[Math.floor(Math.random()*weighted.length)]};
}
// 床のお金パイル1個ぶんのGold量(階層が深いほど多い)
function rollFloorGold(floor){return 8+Math.floor(Math.random()*(8+floor*4))}
// 鉱石の種類抽選(深層ほど高価値の鉱石が出やすい)
function pickOre(floor){
  const table=[{id:'ore_iron',w:60}];
  if(floor>=4)table.push({id:'ore_crystal',w:25});
  if(floor>=7)table.push({id:'ore_gold',w:Math.min(40,10+floor)});
  const weighted=[];table.forEach(t=>{for(let i=0;i<t.w;i++)weighted.push(t.id)});
  return weighted[Math.floor(Math.random()*weighted.length)];
}
// 装備のスロット&種類抽選
function pickEquip(){
  const slots=Object.keys(EQUIP_BY_SLOT);
  const slot=slots[Math.floor(Math.random()*slots.length)];
  const pool=EQUIP_BY_SLOT[slot];
  return pool[Math.floor(Math.random()*pool.length)];
}
// 装備レアリティ抽選(フロアティアのrarityWeightを流用して深層ほど高レアになりやすい)
function rollEquipRarity(floor){
  const tier=getFloorTier(floor||1);
  const weighted=[];
  RKEYS.forEach(rk=>{
    const w=tier.rarityWeight[rk]||0;
    for(let i=0;i<w;i++)weighted.push(rk);
  });
  if(!weighted.length)return 'common';
  return weighted[Math.floor(Math.random()*weighted.length)];
}

function loadFloor(f){
  if(!DM.floors[f])generateFloor(f);
  DM.floor=f;DM.pending=null;
  Renderer.setFloorLabel(`B${f}F`);
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
  Renderer.showFloorFlash(`B${f}F`);
}
// Phase22: レアアイテム(上薬草)取得時に画面中央へ「★発見★」を表示
function showRareFind(){
  Renderer.showRareFind();
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
  Renderer.updatePlayerSprite(spritePos(DM.anim.dir,DM.anim.frame));
}
let _dmWalkTimer=null;
const DM_WALK_FRAMES=['walk1','walk2','walk3','walk4'];
const DM_WALK_FRAME_MS=90;
/* ════ 斜め移動対応(8方向) ════
   - 移動方向(dir)は up/down/left/right に加え upleft/upright/downleft/downright を扱う。
   - プレイヤースプライトシートは4方向(down/up/left/right)分しかコマが無いため、
     斜め方向は見た目上もっとも近い水平方向(left/right)へ寄せて表示する。 */
const DM_DIR_DELTA={
  up:[0,-1], down:[0,1], left:[-1,0], right:[1,0],
  upleft:[-1,-1], upright:[1,-1], downleft:[-1,1], downright:[1,1],
};
const DM_SPRITE_DIR_MAP={
  up:'up', down:'down', left:'left', right:'right',
  upleft:'left', upright:'right', downleft:'left', downright:'right',
};
function dmPlayWalkAnim(dir){
  DM.anim.dir=DM_SPRITE_DIR_MAP[dir]||dir;
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
  DM.anim.dir=DM_SPRITE_DIR_MAP[dir]||dir;
  if(_dmWalkTimer){clearInterval(_dmWalkTimer);_dmWalkTimer=null}
  DM.anim.frame='attack';
  dmUpdatePlayerSprite();
  setTimeout(()=>{
    if(DM.anim.frame==='attack')DM.anim.frame='idle';
    dmUpdatePlayerSprite();
  },DM_ATTACK_ANIM_MS);
}
function dmRender(){
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p,enemies,items}=fl;
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
  const enemyAt={};
  (enemies||[]).forEach(e=>{if(e.curHp>0)enemyAt[`${e.x},${e.y}`]=e});
  const itemsAt={};
  (items||[]).forEach(it=>{
    const k=`${it.x},${it.y}`;
    (itemsAt[k]=itemsAt[k]||[]).push(it);
  });
  const ox=p.x-Math.floor(VW/2);
  const oy=p.y-Math.floor(VH/2);
  const cells=[];
  for(let vy=0;vy<VH;vy++)for(let vx=0;vx<VW;vx++){
    const mx=ox+vx,my=oy+vy;
    if(mx<0||mx>=GW||my<0||my>=GH){cells.push({outOfBounds:true});continue}
    const key=`${mx},${my}`;
    const fog=!explored.has(key)&&g[my][mx]!==CELL.PLAYER;
    if(fog){cells.push({fog:true});continue}
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
      const hpPct=enemy.hp?Math.max(0,Math.round(enemy.curHp/enemy.hp*100)):0;
      ico=`<div class="ehp"><div class="ehp-fill" style="width:${hpPct}%"></div></div>${enemy.icon||'👾'}`;
    }
    const dist=Math.sqrt((mx-p.x)**2+(my-p.y)**2);
    const bright=Math.max(DM_LIGHT_MIN,1-dist*DM_LIGHT_FALLOFF).toFixed(2);
    cells.push({cls,icon:ico,bright});
  }
  // Aボタンは常に"A"表示で固定する(宝箱・階段などpending状態でもラベル/色を変えない)。
  // テキストが長いとボタンからはみ出し操作性を損なうため。pendingの内容はログ側で伝える。
  const actionBtn={text:'A',bg:'',color:''};
  Renderer.renderGrid(cells,actionBtn);
  dmRenderMinimap();
  dmRenderTraps(); // UX1b: 発見済み罠のオーバーレイ(レンダラー非依存)
  dmUpdateHud();
}

// 全体俯瞰ミニマップ: 探索済みセルをドットで表示(画面左上に常設)
function dmRenderMinimap(){
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p,enemies}=fl;
  // Phase22: 敵の現在位置を素早く参照できるようマップ化(生存している敵のみ)
  const enemyAt={};
  (enemies||[]).forEach(e=>{if(e.curHp>0)enemyAt[`${e.x},${e.y}`]=true});
  const cells=[];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    let cls='dmm-fog';
    const key=`${x},${y}`;
    if(x===p.x&&y===p.y)cls='dmm-player';
    else if(explored.has(key)){
      if(enemyAt[key])cls='dmm-enemy';
      else if(g[y][x]===CELL.STAIRS_DOWN||g[y][x]===CELL.STAIRS_UP)cls='dmm-stairs';
      else cls=g[y][x]===CELL.WALL?'dmm-wall':'dmm-explored';
    }
    cells.push(cls);
  }
  Renderer.renderMinimap(cells);
}

// ダンジョン中も常時表示するHUD: 職業・EXP・所持品(語数/Gold/AP)・HPを同期
function dmUpdateHud(){
  const j=JD.find(j=>j.id===S.job);
  const pct=S.exp%100;
  const hpPct=DM.playerMaxHp?Math.max(0,Math.round(DM.playerHp/DM.playerMaxHp*100)):0;
  Renderer.updateHud({
    job: j?j.icon+' '+j.name:'🌱 Novice',
    expPct: pct,
    expLabel: `${pct}/100 EXP`,
    words: nd(),
    gold: S.gold||0,
    ap: S.ap||0,
    inv: `${(S.inventory||[]).length}/${INV_MAX_SLOTS}`,
    gems: S.escapeGems||0,
    hpPct,
    hpLow: hpPct<=25,
    hpLabel: `${Math.max(0,DM.playerHp)}/${DM.playerMaxHp}`,
  });
  // UX1a: 満腹度・毒はdm-vitalsのDOMを直接更新(両レンダラー非依存)
  const sat=(DM.satiety!==undefined)?DM.satiety:100;
  const sf=document.getElementById('dm-satfill'); if(sf){sf.style.width=sat+'%';sf.classList.toggle('low',sat<=20)}
  const stx=document.getElementById('dm-sattxt'); if(stx)stx.textContent=sat;
  const poi=document.getElementById('dm-poison'); if(poi)poi.style.display=(DM.poison>0)?'':'none';
}

function dmLog(msg){
  DM.log.unshift(msg);if(DM.log.length>10)DM.log.pop();
  Renderer.renderLog(DM.log);
}

function dmv(dir){
  if(DM.pending)return;
  const fl=DM.floors[DM.floor];if(!fl)return;
  const {grid:g,explored,playerPos:p}=fl;
  const delta=DM_DIR_DELTA[dir];
  if(!delta)return;
  const nx=p.x+delta[0],ny=p.y+delta[1];
  if(ny<0||ny>=GH||nx<0||nx>=GW)return;
  const dest=g[ny][nx];
  if(dest===CELL.WALL)return;
  // 斜め移動: 両隣の直交マスのどちらかが壁なら、壁の角をすり抜けられないようにする
  if(delta[0]!==0&&delta[1]!==0){
    if(g[p.y][nx]===CELL.WALL||g[ny][p.x]===CELL.WALL)return;
  }
  DM.anim.dir=DM_SPRITE_DIR_MAP[dir]||dir; // Phase24: 移動・攻撃どちらでも向きを更新
  // UX1d: 商人に接触すると店が開く(移動せず、ターンも消費しない=シレン準拠の安全時間)
  if(fl.merchant&&fl.merchant.x===nx&&fl.merchant.y===ny){
    openShop();
    return;
  }
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
  // UX1b: 罠 — 移動確定後に踏み判定。罠は発動後も残り続ける(シレン準拠)ため、見えていても踏めば発動する
  const trapHere=(fl.traps||[]).find(t=>t.x===nx&&t.y===ny);
  if(trapHere){
    dmSpringTrap(trapHere);
    if(DM.playerHp<=0){dmRender();dmPlayerDown();return}
  }
  // Phase16/18/19: 床のアイテムを自動取得(プレイヤーが踏むと自動取得)
  if((fl.items||[]).some(it=>it.x===nx&&it.y===ny)){
    dmTryPickupItems(nx,ny);
    if(DM.pending==='inv_full')return; // 持ち物がいっぱい: ユーザーの選択待ち(このターンの残りは保留)
  }
  // Handle cell
  let msg='';
  if(dest===CELL.EVENT){
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

// 壁の角越しの斜め移動/攻撃を禁止する判定(true=斜めが壁で塞がれている)
function dmDiagonalBlocked(fl,x,y,dx,dy){
  if(dx===0||dy===0)return false;
  const wall=(ax,ay)=>(ax<0||ax>=GW||ay<0||ay>=GH||fl.grid[ay][ax]===CELL.WALL);
  return wall(x+dx,y)||wall(x,y+dy); // どちらかの直交セルが壁なら斜めは通さない
}
/* ════ UX1d: 店(よろず屋)システム ════
   価格はSHOP_PRICESに一元化(買値。売値は半額)。未識別品も定価で並ぶため、
   「渋い草が50G…毒消しの値段だ」というシレンの"値段識別"が自然発生する。
   UIは既存のキャラメニューオーバーレイ(char-menu-ov/cm-title/cm-body)を流用。 */
const SHOP_PRICES={
  herb:30, great_herb:80, big_herb:180, bread:60, antidote:50, fire_stone:100,
  ore_iron:40, ore_crystal:90, ore_gold:120,
  eq_sword:220, eq_axe:260, eq_spear:220, eq_shield:180, eq_armor:240, eq_ring:200, eq_amulet:200,
  escape_gem:300,
};
function shopPriceOf(id,meta){
  const base=SHOP_PRICES[id]; if(base===undefined)return null;
  // 装備はレアリティで価格スケール(実効値と同じEQUIP_RARITY_MULTを流用)
  if(meta&&meta.rarity&&typeof EQUIP_RARITY_MULT!=='undefined'&&EQUIP_RARITY_MULT[meta.rarity]){
    return Math.round(base*EQUIP_RARITY_MULT[meta.rarity]);
  }
  return base;
}
function shopSellPriceOf(id,meta){
  const p=shopPriceOf(id,meta);
  return p===null?null:Math.floor(p/2);
}
// 階層に応じた在庫3〜4品: 食料1(満腹度経済の生命線)+回復/道具+深層では装備or宝玉
function shopBuildStock(f){
  const stock=[];
  stock.push({id:'bread',price:shopPriceOf('bread')});
  const utilPool=f>=5?['great_herb','antidote','fire_stone','big_herb']:['herb','antidote','fire_stone'];
  const u1=utilPool[Math.floor(Math.random()*utilPool.length)];
  stock.push({id:u1,price:shopPriceOf(u1)});
  const u2pool=utilPool.filter(x=>x!==u1);
  if(u2pool.length&&Math.random()<0.7){
    const u2=u2pool[Math.floor(Math.random()*u2pool.length)];
    stock.push({id:u2,price:shopPriceOf(u2)});
  }
  if(f>=4&&Math.random()<0.6){
    const eq=pickEquip(); const meta={rarity:rollEquipRarity(f)};
    stock.push({id:eq,price:shopPriceOf(eq,meta),meta});
  }else if(f>=5&&Math.random()<0.5){
    stock.push({id:'escape_gem',price:shopPriceOf('escape_gem')});
  }
  return stock;
}
function shopDispName(entry){
  if(entry.id==='escape_gem')return '◇ 脱出の宝玉';
  const def=getItemDef(entry.id); if(!def)return entry.id;
  if(def.slot&&entry.meta)return equipDisplayName({id:entry.id,rarity:entry.meta.rarity});
  return (typeof dispItemName==='function')?dispItemName(def):`${def.icon} ${def.jp}`;
}
function openShop(){
  const fl=DM.floors[DM.floor]; if(!fl||!fl.merchant)return;
  document.getElementById('char-menu-ov').classList.add('show');
  renderShop();
}
function renderShop(){
  const fl=DM.floors[DM.floor]; if(!fl||!fl.merchant)return;
  document.getElementById('cm-title').textContent='🏪 よろず屋';
  const rows=fl.merchant.stock.map((e,i)=>{
    if(e.sold)return `<button class="evbtn" disabled>（売り切れ）</button>`;
    const afford=(S.gold||0)>=e.price;
    return `<button class="evbtn" ${afford?'':'disabled'} onclick="buyShopItem(${i})">${shopDispName(e)}　${e.price}G${afford?'':'（G不足）'}</button>`;
  }).join('');
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">所持金 🪙 ${S.gold||0} G</div>
    <div class="inv-list">${rows}</div>
    <div class="inv-detail-actions">
      <button class="cact secondary" onclick="renderShopSell()">売る（定価の半額）</button>
      <button class="evbtn cm-back" onclick="closeCharMenu()">店を出る</button>
    </div>`;
}
function buyShopItem(i){
  const fl=DM.floors[DM.floor]; if(!fl||!fl.merchant)return;
  const e=fl.merchant.stock[i];
  if(!e||e.sold)return;
  if((S.gold||0)<e.price){toast('🪙 お金が足りない','r');return}
  if(e.id==='escape_gem'){
    S.escapeGems=(S.escapeGems||0)+1;
  }else{
    if(!addItem(e.id,1,e.meta||null)){toast('🎒 持ち物がいっぱいだ','r');return}
  }
  S.gold-=e.price; e.sold=true; save();
  dmLog(`🏪 ${shopDispName(e)} を ${e.price}G で買った`);
  dmUpdateHud();
  renderShop();
}
function renderShopSell(){
  document.getElementById('cm-title').textContent='🏪 買い取り';
  const rows=(S.inventory||[]).map((slot,idx)=>{
    const def=getItemDef(slot.id); if(!def)return '';
    const p=shopSellPriceOf(slot.id,slot.meta);
    if(p===null)return ''; // 値段のつかない物(欠片等)は買い取らない
    const label=(typeof invSlotLabel==='function')?invSlotLabel(slot):def.jp;
    return `<button class="evbtn" onclick="sellShopItem(${idx})">${label} ×${slot.count}　→ ${p}G</button>`;
  }).filter(Boolean).join('');
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">所持金 🪙 ${S.gold||0} G</div>
    <div class="inv-list">${rows||'<div class="inv-empty">売れる物がない</div>'}</div>
    <div class="inv-detail-actions">
      <button class="evbtn cm-back" onclick="renderShop()">← 店頭に戻る</button>
    </div>`;
}
function sellShopItem(idx){
  const slot=S.inventory[idx]; if(!slot)return;
  const p=shopSellPriceOf(slot.id,slot.meta); if(p===null)return;
  const def=getItemDef(slot.id);
  removeItemAt(idx,1);
  S.gold=(S.gold||0)+p; save();
  dmLog(`🏪 ${def?def.jp:slot.id} を ${p}G で売った`);
  dmUpdateHud();
  renderShopSell();
}

/* ════ UX1c: 投擲(シレン式) ════
   向いている方向へ直線に投げる(最大10マス)。最初の敵に命中してダメージ(火炎石は15、他は3)。
   外れたら壁の手前の床に落ち、既存の床アイテムシステム(fl.items)で拾い直せる。投擲も1ターン。 */
function dmThrowItem(idx){
  if(!(DM&&DM.dungeon)){if(typeof toast==='function')toast('🏹 ダンジョン内でのみ投げられる','g');return}
  const slot=S.inventory[idx];
  const def=slot&&getItemDef(slot.id);
  if(!slot||!def)return;
  const fl=DM.floors[DM.floor]; if(!fl)return;
  const p=fl.playerPos;
  const facing=(DM.anim&&DM.anim.dir)||'down';
  const d=DM_DIR_DELTA[facing]||[0,1];
  const meta=slot.meta;
  removeItemAt(idx,1);
  if(typeof closeCharMenu==='function')closeCharMenu();
  if(typeof dmPlayAttackAnim==='function')dmPlayAttackAnim(facing);
  let x=p.x,y=p.y,hit=null;
  for(let i=0;i<10;i++){
    const nx=x+d[0],ny=y+d[1];
    if(nx<0||ny<0||nx>=GW||ny>=GH)break;
    if(fl.grid[ny][nx]===CELL.WALL)break;
    x=nx;y=ny;
    const en=(fl.enemies||[]).find(e=>e.curHp>0&&e.x===x&&e.y===y);
    if(en){hit=en;break}
  }
  if(hit){
    const dmg=def.effect&&def.effect.fireDmg?def.effect.fireDmg:3;
    hit.curHp=Math.max(0,hit.curHp-dmg);
    dmLog(`🏹 ${dispItemName(def)}を投げつけた！ ${hit.name}に${dmg}ダメージ`);
    dmShowFloatDamage(Math.floor(VW/2)+(hit.x-p.x),Math.floor(VH/2)+(hit.y-p.y),dmg,'enemy');
    if(hit.curHp<=0)dmKillEnemy(hit); // 既存の撃破フロー(報酬/図鑑)に合流
  }else if(x!==p.x||y!==p.y){
    fl.items=fl.items||[];
    fl.items.push(meta?{id:slot.id,x,y,meta}:{id:slot.id,x,y});
    dmLog(`🏹 ${dispItemName(def)}を投げた。床に落ちた`);
  }else{
    dmLog(`🏹 ${dispItemName(def)}を投げたが、壁に当たって砕け散った…`);
  }
  dmRender();
  dmEnemyTurn();
}

/* ════ UX1b: 罠システム(シレン式) ════ */
// 罠を発動する。効果適用+可視化+ログ。死亡判定は呼び出し側(dmv)で行う。
function dmSpringTrap(t){
  t.revealed=true;
  if(t.type==='spike'){
    const dmg=3+Math.floor(DM.floor/2);
    DM.playerHp=Math.max(0,DM.playerHp-dmg);
    dmLog(`⚙ トゲの罠を踏んだ！ ${dmg}ダメージ`);
    dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),dmg,'player');
  }else if(t.type==='poison'){
    if(DM.poison<=0){DM.poison=8;dmLog('☠ 毒の罠を踏んだ！ 毒におかされた(8ターン)')}
    else dmLog('☠ 毒の罠を踏んだが、すでに毒におかされている');
  }else if(t.type==='hunger'){
    DM.satiety=Math.max(0,(DM.satiety??100)-20);
    dmLog(`🍽 腹減りの罠を踏んだ！ 満腹度が20減った(${DM.satiety})`);
  }
}
// 発見済みの罠と商人をDOMオーバーレイに描画(レンダラー非依存: getCellMetricsで座標変換)
function dmRenderTraps(){
  const layer=document.getElementById('dm-trap-layer'); if(!layer)return;
  const fl=DM.floors[DM.floor];
  if(!fl){layer.innerHTML='';return}
  const p=fl.playerPos, ox=p.x-Math.floor(VW/2), oy=p.y-Math.floor(VH/2);
  const m=Renderer.getCellMetrics();
  let html='';
  (fl.traps||[]).forEach(t=>{
    if(!t.revealed)return;
    const vx=t.x-ox, vy=t.y-oy;
    if(vx<0||vx>=VW||vy<0||vy>=VH)return;
    if(vx===Math.floor(VW/2)&&vy===Math.floor(VH/2))return; // プレイヤーの足元はスプライトを優先
    const x=m.padLeft+vx*(m.cw+m.gap), y=m.padTop+vy*(m.cw+m.gap);
    html+=`<span class="dm-trap" style="left:${x}px;top:${y}px;width:${m.cw}px;height:${m.cw}px;font-size:${Math.floor(m.cw*0.5)}px">${t.icon}</span>`;
  });
  // UX1d: 商人(探索済みセルにいる時だけ見える)
  if(fl.merchant&&fl.explored.has(`${fl.merchant.x},${fl.merchant.y}`)){
    const vx=fl.merchant.x-ox, vy=fl.merchant.y-oy;
    if(vx>=0&&vx<VW&&vy>=0&&vy<VH){
      const x=m.padLeft+vx*(m.cw+m.gap), y=m.padTop+vy*(m.cw+m.gap);
      html+=`<span class="dm-trap" style="left:${x}px;top:${y}px;width:${m.cw}px;height:${m.cw}px;font-size:${Math.floor(m.cw*0.68)}px;color:#ffd870;text-shadow:0 0 8px rgba(255,216,112,.8)">🏪</span>`;
    }
  }
  layer.innerHTML=html;
}

/* ════ UX1b: B ボタン(待機/キャンセル/長押しで足踏み回復) ════ */
function dmb(){
  if(!dmIsOverlayOpen())return;
  // シレンのB=キャンセル: 階段の確認中は「やめる」として働く
  if(DM.pending==='stairs_down'||DM.pending==='stairs_up'){dmCancelStairs();return}
  if(DM.pending)return; // その他の選択待ち中は誤爆させない
  dmWait();
}
// 足踏み回復(B長押し): HP全快/毒/空腹/敵接近/選択待ちで自動停止する
function dmRestStop(msg){
  if(DM._restTimer){clearInterval(DM._restTimer);DM._restTimer=null;if(msg)dmLog(msg)}
  if(DM._restHold){clearTimeout(DM._restHold);DM._restHold=null}
}
function dmRestTick(){
  if(!dmIsOverlayOpen()||DM.pending){dmRestStop();return}
  if(DM.playerHp>=DM.playerMaxHp){dmRestStop('✨ HPが全快した');return}
  if(DM.poison>0){dmRestStop('☠ 毒のままでは休めない');return}
  if((DM.satiety??100)<=20){dmRestStop('🍖 空腹で休んでいられない');return}
  const fl=DM.floors[DM.floor], p=fl&&fl.playerPos;
  if(fl&&p&&(fl.enemies||[]).some(e=>e.curHp>0&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=DM_DETECT_RANGE)){
    dmRestStop('👀 敵の気配で目が覚めた！');return
  }
  dmWait();
}
// A/Bボタンのタッチ即応結線(pointerdown+preventDefault)。onclickの遅延・二重発火を排除する
function dmBindActionButtons(){
  const a=document.getElementById('dm-act'), b=document.getElementById('dm-b');
  if(a&&!a._bound){
    a._bound=true;
    a.addEventListener('pointerdown',e=>{e.preventDefault();dma()});
  }
  if(b&&!b._bound){
    b._bound=true;
    b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      b._long=false;
      DM._restHold=setTimeout(()=>{
        b._long=true;DM._restHold=null;
        dmLog('💤 足踏みして回復する…(指を離すと止まる)');
        DM._restTimer=setInterval(dmRestTick,150);
      },450);
    });
    const up=()=>{
      if(DM._restHold){clearTimeout(DM._restHold);DM._restHold=null}
      if(DM._restTimer){clearInterval(DM._restTimer);DM._restTimer=null}
      else if(!b._long){dmb()}
      b._long=false;
    };
    b.addEventListener('pointerup',up);
    b.addEventListener('pointercancel',up);
    b.addEventListener('pointerleave',up);
  }
}

function dma(){
  if(DM.pending){dmResolvePending();return} // 宝箱/イベント/階段の確定を優先
  if(!dmIsOverlayOpen())return;
  const fl=DM.floors[DM.floor]; if(!fl)return;
  const p=fl.playerPos;
  // 隣接する敵を探して攻撃(向いている方向を優先)。斜めは壁の角がある場合は対象外。
  const facing=(DM.anim&&DM.anim.dir)||'down';
  const order=[facing,'up','down','left','right','upleft','upright','downleft','downright'];
  let target=null,tdir=null;
  for(const dir of order){
    const d=DM_DIR_DELTA[dir]; if(!d)continue;
    if(dmDiagonalBlocked(fl,p.x,p.y,d[0],d[1]))continue;
    const ex=p.x+d[0], ey=p.y+d[1];
    const en=(fl.enemies||[]).find(e=>e.curHp>0&&e.x===ex&&e.y===ey);
    if(en){target=en;tdir=dir;break}
  }
  if(target){dmContactAttack(target,tdir)}
  else{
    // UX1b: 素振り — ターンを消費し、向いている方向1マスの隠された罠を発見できる(シレン文法)
    const fd=DM_DIR_DELTA[facing]||[0,1];
    const fx=p.x+fd[0], fy=p.y+fd[1];
    const hidden=(fl.traps||[]).find(t=>t.x===fx&&t.y===fy&&!t.revealed);
    if(typeof dmPlayAttackAnim==='function')dmPlayAttackAnim(facing);
    if(hidden){
      hidden.revealed=true;
      dmLog(`🗡 素振りで ${hidden.icon} ${hidden.name} を発見した！`);
    }else{
      dmLog('🗡 素振りをした');
    }
    dmEnemyTurn(); // 素振りも1ターン(シレン準拠)
  }
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
  const ddxy=DM_DIR_DELTA[dir]||[0,0];
  const ddx=ddxy[0],ddy=ddxy[1];
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
  // ドロップは敵がいた床マスに生成する(占有マスなら隣接へずらす)。自動取得はせず床に残す(シレン式)。
  let dropMsg='';
  const drops=fl?rollEnemyDrops(enemy):[];
  drops.forEach(id=>{
    if(fl)dmDropOnFloor(fl,id,enemy.x,enemy.y);
    const def=getItemDef(id);
    if(def)dropMsg+=` ${dispItemName(def)}がドロップした！`;
  });
  save();updateHdr();
  dmLog(`🎉 ${enemy.name}を倒した！ 💰+${goldGain} Gold / 📈+${aexpGain} Archive EXP${dropMsg}`);
  // 自動取得は廃止(風来のシレン式)。ドロップは床に残り、プレイヤーが踏むと取得される。
}

// ドロップ配置の可否判定: 壁/階段/イベント/既存アイテムがあるマスは「占有」とみなす
function dmCellOccupiedForDrop(fl,x,y){
  if(x<0||x>=GW||y<0||y>=GH)return true;
  const t=fl.grid[y][x];
  if(t===CELL.WALL)return true;
  if(t===CELL.STAIRS_DOWN||t===CELL.STAIRS_UP||t===CELL.EVENT)return true;
  if((fl.items||[]).some(it=>it.x===x&&it.y===y))return true; // 既存アイテムに重ねない
  return false;
}
// モンスターのドロップを床に配置する。指定マスが占有(アイテム/階段/イベント/壁)されていれば
// 隣接する空き床マスへずらして配置する(見つからなければ指定マスにそのまま置く)。
function dmDropOnFloor(fl,id,x,y,meta){
  if(!fl)return;
  if(!fl.items)fl.items=[];
  let tx=x,ty=y;
  if(dmCellOccupiedForDrop(fl,x,y)){
    const around=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
    for(const [dx,dy] of around){
      const nx=x+dx,ny=y+dy;
      if(!dmCellOccupiedForDrop(fl,nx,ny)){tx=nx;ty=ny;break}
    }
  }
  fl.items.push({x:tx,y:ty,id,meta});
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
    // Phase26: お金は持ち物枠を使わず即Goldに変換(取得確定・常に成功)
    if(def.type==='gold'){
      const amt=Math.round((it.meta?.amount||10)*getGoldMultiplier());
      S.gold=(S.gold||0)+amt;save();updateHdr();
      fl.items=fl.items.filter(i=>i!==it);
      dmLog(`💰 お金を拾った！ Gold +${amt}`);
      continue;
    }
    if(addItem(it.id,1,it.meta)){
      fl.items=fl.items.filter(i=>i!==it);
      // Phase26: 取得ログをカテゴリ別に最適化(装備はレアリティ名/欠片は専用文言)
      if(def.type==='weapon'||def.type==='shield'||def.type==='accessory'){
        dmLog(`${equipDisplayName({id:it.id,rarity:it.meta?.rarity})}を手に入れた！`);
        if(['rare','epic','legendary'].includes(it.meta?.rarity))showRareFind();
      }else if(def.type==='shard'){
        dmLog(`🔮 アーカイブの欠片を手に入れた！(解読で単語を発見できる)`);
        showRareFind();
      }else{
        dmLog(`${dispItemName(def)}を手に入れた！`);
        if(it.id==='great_herb')showRareFind(); // Phase22: レアアイテム演出
      }
    }else{
      // 持ち物がいっぱい(風来のシレン式): 一覧画面は出さず、アイテムは床に残してメッセージのみ表示する。
      // pendingを設定しないため移動は通常通り完了し(キャラ消失バグの回避)、ターンも進む。
      dmLog('🎒 持ち物がいっぱいだ！(足元にアイテムが残っている)');
      return; // 残りのアイテムも床に残す
    }
  }
}
// プレイヤーの位置にアイテムをn個設置する(同マス複数アイテム可・視覚的に重ね表示される)
// Phase26: meta(装備レアリティ・欠片のダンジョンID等)を保持したまま床に戻せるようにした
function dmPlaceItemsOnFloor(id,n,pos,meta){
  const fl=DM.floors[DM.floor];
  if(!fl||!pos)return;
  if(!fl.items)fl.items=[];
  for(let i=0;i<n;i++)fl.items.push({x:pos.x,y:pos.y,id,meta});
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
      const dx=p.x-e.x, dy=p.y-e.y;
      const adjacent=Math.max(Math.abs(dx),Math.abs(dy))===1;
      // 斜め隣接で壁の角がある場合は攻撃できない(プレイヤーの斜め移動制限と対称)
      if(adjacent&&!dmDiagonalBlocked(fl,e.x,e.y,dx,dy)){
        // 隣接: 攻撃(Phase11: 防御力ステータスを正式に適用)
        const dmg=Math.max(1,(e.atk||1)-getPlayerDef());
        DM.playerHp=Math.max(0,DM.playerHp-dmg);
        dmLog(`💢 ${e.name}の攻撃！ ${dmg}ダメージを受けた`);
        dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),dmg,'player');
        // UX1a: 毒付与(venom持ちの敵のみ、確率。重ねがけはしない)
        if(e.venom&&DM.poison<=0&&Math.random()<e.venom){
          DM.poison=8;
          dmLog(`☠ ${e.name}の毒をうけた！(8ターン)`);
        }
        e.state='aggro';
        return;
      }
      const dist=Math.max(Math.abs(dx),Math.abs(dy));
      if(dist<=DM_DETECT_RANGE+(e.detectBonus||0))e.state='aggro';
      if(e.state==='aggro')dmMoveEnemyToward(e,p,fl);
      else if(Math.random()<0.4)dmMoveEnemyRandom(e,fl);
    });
  }
  // ターン経過処理(Phase15/UX1a): 毒 → 満腹度 → 自然回復 の順に解決する
  DM.turnCount=(DM.turnCount||0)+1;
  // UX1a: 毒 — 毎ターンHP-1。切れたらログで知らせる
  if(DM.poison>0){
    DM.poison--;
    DM.playerHp=Math.max(0,DM.playerHp-1);
    dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),1,'player');
    if(DM.poison<=0)dmLog('✨ 毒が消えた');
  }
  if(DM.turnCount%10===0){
    // UX1a: 満腹度 — 10ターンで1減る。0になると飢えでHPが削られ、自然回復も止まる(シレン式)
    if(DM.satiety>0){
      DM.satiety--;
      if(DM.satiety===30&&DM.hungerWarned<1){DM.hungerWarned=1;dmLog('🍖 お腹が空いてきた…')}
      else if(DM.satiety===10&&DM.hungerWarned<2){DM.hungerWarned=2;dmLog('🍖 空腹で力が出ない…！')}
      else if(DM.satiety===0){dmLog('☠ 飢えている！ HPが削られていく…')}
    }else{
      DM.playerHp=Math.max(0,DM.playerHp-2);
      dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),2,'player');
    }
    // 自然回復は「満腹度が残っていて」「毒でない」ときだけ働く
    if(DM.satiety>0&&DM.poison<=0)dmNaturalRegen();
  }
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
  const m=Renderer.getCellMetrics();
  const x=m.padLeft+vx*(m.cw+m.gap)+m.cw/2;
  const y=m.padTop+vy*(m.cw+m.gap)+m.cw*0.25;
  const text=(kind==='heal'?'+':kind==='enemy'?'⚔':kind==='fire'?'🔥':'')+Math.abs(amount);
  Renderer.showFloatDamage(x,y,text,kind);
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
  // 宝箱は廃止したため、ここに来る pending は想定外。安全に解除して何もしない。
  DM.pending=null;
}

/* ════ 階段の確認選択肢: 次の階に行くかどうかをプレイヤーに選ばせる ════ */
function openStairsConfirm(dir){
  const title=dir==='down'?'↓ 下り階段':'↑ 上り階段';
  const desc=dir==='down'?`B${DM.floor+1}Fへ進みますか？`:`B${DM.floor-1}Fへ戻りますか？`;
  Renderer.showStairsConfirm(title,desc);
}
function dmConfirmStairs(){
  const pending=DM.pending;
  Renderer.hideStairsConfirm();
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
  Renderer.hideStairsConfirm();
  DM.pending=null;
  dmRender(); // 階段マスのまま留まる(次に踏んだ時に再度選択肢が出る)
}

/* ════ RANDOM EVENT: 古い石碑 — 改修: 探索ループ改善 ════ */
function showEventChoice(){
  Renderer.showEventChoice();
}
function closeEventChoice(){
  Renderer.hideEventChoice();
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
  'W':'up','S':'down','A':'left','D':'right',
  'q':'upleft','e':'upright','z':'downleft','c':'downright',
  'Q':'upleft','E':'upright','Z':'downleft','C':'downright'
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
  return Renderer.isDungeonViewOpen();
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
  if(e.key==='Enter'){ e.preventDefault(); dma(); return; }   // UX1b: A=攻撃/決定
  if(e.key==='Escape'){ e.preventDefault(); dmb(); return; }  // UX1b: B=待機/キャンセル
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

/* ════ タップ移動(常時有効) ════
   方針: ダンジョングリッドのセルをタップしたら、プレイヤー(中心セル)からの相対方向を
   求めて dmQueueMove(dir) に流す。これにより移動・接触攻撃・敵ターンの既存処理を
   そのまま再利用できる(Albion/OSRS式のタップ移動)。
   - 隣接セル: その方向へ1マス移動/攻撃
   - 離れたセル: その方向へ1歩だけ寄せる(8方向のいずれか)
   - 自マス(中心)タップ: 待機(dmWait)
   Dpad表示ON/OFFに関わらず常に有効。Dpadは「押しっぱなしで連続移動」用の補助として残す。 */
const DM_STEP_TO_DIR={
  '0,-1':'up','0,1':'down','-1,0':'left','1,0':'right',
  '-1,-1':'upleft','1,-1':'upright','-1,1':'downleft','1,1':'downright',
};
function dmBindGridTap(){
  const frame=document.getElementById('dm-grid-frame');
  if(!frame||frame._tapBound)return;
  frame._tapBound=true;
  // タップ位置→方向を求める(表示中の描画要素の矩形から算出。CSSピクセルでdpr非依存)
  function dirFromEvent(e){
    if(e.target.closest('.dm-minimap-frame'))return undefined; // ミニマップは除外
    const canvas=document.getElementById('dm-canvas');
    const grid=document.getElementById('dm-grid');
    let el=(canvas&&canvas.offsetParent!==null)?canvas
          :(grid&&grid.offsetParent!==null)?grid:(canvas||grid);
    if(!el)return undefined;
    const rect=el.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return undefined;
    const relX=e.clientX-rect.left, relY=e.clientY-rect.top;
    if(relX<0||relY<0||relX>rect.width||relY>rect.height)return undefined;
    const vx=Math.floor(relX/(rect.width/VW)), vy=Math.floor(relY/(rect.height/VH));
    const cx=Math.floor(VW/2), cy=Math.floor(VH/2);
    const sx=Math.sign(vx-cx), sy=Math.sign(vy-cy);
    if(sx===0&&sy===0)return 'wait';
    return DM_STEP_TO_DIR[`${sx},${sy}`]||undefined;
  }
  let tapDir=null;
  const begin=e=>{
    if(!dmIsOverlayOpen()||DM.pending)return;
    const dir=dirFromEvent(e);
    if(!dir)return;
    e.preventDefault();
    if(dir==='wait'){dmWait();return} // 自マスタップ=待機(連続はしない)
    tapDir=dir;
    dmQueueMove(dir);     // 即時1歩
    dmStartRepeat(dir);   // 押し続けで連続移動
  };
  const steer=e=>{       // ドラッグで進行方向を変える
    if(tapDir===null)return;
    const dir=dirFromEvent(e);
    if(!dir||dir==='wait'||dir===tapDir)return;
    tapDir=dir;
    dmStopRepeat();
    dmQueueMove(dir);
    dmStartRepeat(dir);
  };
  const end=()=>{ if(tapDir!==null){tapDir=null;dmStopRepeat();} };
  frame.addEventListener('pointerdown',begin);
  frame.addEventListener('pointermove',steer);
  frame.addEventListener('pointerup',end);
  frame.addEventListener('pointercancel',end);
  frame.addEventListener('pointerleave',end);
}
document.addEventListener('DOMContentLoaded',dmBindGridTap);

/* ════ Dpad(十字キー)表示のON/OFF切替 ════
   表示制御のみ。タップ移動は常時有効なので、OFFにしてもプレイ可能で、
   その分マップ表示領域が広がる。設定はセーブに永続化される。 */
function dmApplyDpadVisibility(){
  const on=!!(S.settings&&S.settings.dpadVisible);
  const controls=document.querySelector('.dm-controls');
  if(controls)controls.style.display=on?'':'none';
  const tgl=document.getElementById('dm-dpad-toggle');
  if(tgl){tgl.style.opacity=on?'1':'0.45';}
}
function dmToggleDpad(){
  if(!S.settings)S.settings={};
  S.settings.dpadVisible=!S.settings.dpadVisible;
  save();
  dmApplyDpadVisibility();
  dmLog(S.settings.dpadVisible?'🎮 十字キーを表示しました。':'🎮 十字キーを隠しました(マップタップで移動)。');
}

// オーバーレイを閉じた際は入力状態をリセット
const _origCloseDmap=closeDmap;
closeDmap=function(reason){
  dmInput.keysDown.clear();
  dmInput.queue.length=0;
  dmStopRepeat();
  _origCloseDmap(reason);
};
