/* ════════════════════════════════════════════════════════════════════
   DUNGEON CORE — 定数・状態・フロア生成・入退場 (R1構造分割 1/3)
   読込順: dungeon-core.js → dungeon-play.js → dungeon-ui.js
   ── 責務 ──
   ・共有定数(GW/GH/CELL/VW/VH/ライティング/スプライト/方向/索敵範囲)
   ・DMランタイム状態、openDmap/closeDmap、探索タブ(renderExp)・レリック
   ・フロア生成(generateFloor: 部屋/敵/宝箱/罠/商人配置)とドロップ抽選
   ── 分割規約 ──
   トップレベルのconst/let定義は本ファイルに集約(ロード順依存を1点化)。
   関数の相互呼び出しは実行時解決のため、play/ui内の関数を呼んでも安全。
════════════════════════════════════════════════════════════════════ */
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
  // UX#1: 賭け金の明示(倒れたら失う=シレンの緊張の前提をプレイヤーに教える)
  dmLog('⚠ 倒れると持ち物すべてとGoldの半分を失う。◇脱出の宝玉が保険になる');
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
/* ════ UX#3: 敵の階層スケーリング ════
   従来は出現テーブル(重み)のみ階層で変化し、敵のHP/ATKは全階固定だった
   =プレイヤーだけが成長する逆難易度曲線。スポーン時に階層倍率を適用して是正する。
   HP×(1+0.12(f-1)) / ATK×(1+0.08(f-1))。B10でHP約2.1倍・ATK約1.7倍。 */
function dmScaleEnemy(tpl,f){
  const hs=1+(f-1)*0.12, as=1+(f-1)*0.08;
  return {...tpl, hp:Math.max(1,Math.round(tpl.hp*hs)), atk:Math.max(1,Math.round((tpl.atk||1)*as))};
}

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
    const tpl=dmScaleEnemy(pickEnemyForFloor(f),f); // UX#3: 階層スケール適用
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
        const tpl=dmScaleEnemy(pickEnemyForFloor(f),f); // UX#3: 階層スケール適用
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
const DM_DIR_DELTA={
  up:[0,-1], down:[0,1], left:[-1,0], right:[1,0],
  upleft:[-1,-1], upright:[1,-1], downleft:[-1,1], downright:[1,1],
};
const DM_SPRITE_DIR_MAP={
  up:'up', down:'down', left:'left', right:'right',
  upleft:'left', upright:'right', downleft:'left', downright:'right',
};
const DM_DETECT_RANGE=5; // 索敵範囲(マス, Chebyshev距離)

// 敵に接触攻撃を行い、結果をフローティングダメージ・ログで即時表示する(モーダル禁止)
