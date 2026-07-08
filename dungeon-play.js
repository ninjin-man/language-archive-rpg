/* ════════════════════════════════════════════════════════════════════
   DUNGEON PLAY — 行動・戦闘・システム (R1構造分割 2/3)
   読込順: dungeon-core.js → dungeon-play.js → dungeon-ui.js
   ── 責務 ──
   ・移動(dmv)/入力(キー・Dパッド・グリッドタップ・リピート)
   ・A/B(dma/dmb/素振り/足踏み回復)・待機・接触攻撃・敵AI/ターン
   ・罠(発動)・投擲・店(SHOP_PRICES/売買)・拾得/ドロップ・満腹度/毒
   ・イベント選択・プレイヤーダウン
════════════════════════════════════════════════════════════════════ */
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
  // FF10化: 撃破AP → スフィアレベル(盤の移動力)。10APで+1、上限99(FF10準拠)。
  S.sap=(S.sap||0)+aexpGain;
  while(S.sap>=10&&(S.slv||0)<99){
    S.sap-=10;S.slv=(S.slv||0)+1;
    dmLog(`🔷 スフィアレベルが上がった！(S.Lv ${S.slv})`);
  }
  // FF10化: 球ドロップ(通常30%/レア以上50%)。種別: 記憶(単語)/力(攻防ゲート)/命(HP再生ゲート)
  const sphRate=(enemy.rarity==='rare'||enemy.rarity==='epic'||enemy.rarity==='legendary')?0.5:0.3;
  if(Math.random()<sphRate){
    const r3=Math.random();
    if(r3<0.34){S.spheres=(S.spheres||0)+1;dmLog('🔮 記憶の球を手に入れた！');}
    else if(r3<0.67){S.sphP=(S.sphP||0)+1;dmLog('⚔ 力の球を手に入れた！');}
    else{S.sphL=(S.sphL||0)+1;dmLog('❤ 命の球を手に入れた！');}
  }
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
  // UX#4: 満腹度 — 5ターンで1減(従来10)。1ラン≒250〜500ターンでほぼ枯渇する緊張設計に。
  // パンと店のパン在庫が初めて意味を持つ。自然回復は従来通り10ターン刻み(回復バランス不変)。
  if(DM.turnCount%5===0){
    if(DM.satiety>0){
      DM.satiety--;
      if(DM.satiety===30&&DM.hungerWarned<1){DM.hungerWarned=1;dmLog('🍖 お腹が空いてきた…')}
      else if(DM.satiety===10&&DM.hungerWarned<2){DM.hungerWarned=2;dmLog('🍖 空腹で力が出ない…！')}
      else if(DM.satiety===0){dmLog('☠ 飢えている！ HPが削られていく…')}
    }else{
      DM.playerHp=Math.max(0,DM.playerHp-2);
      dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),2,'player');
    }
  }
  if(DM.turnCount%10===0){
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
function dmPlayerDown(){
  // UX#1: 死の賭け金(シレンの核)。持ち物を全て失い、Goldは半分になる。
  // 装備中・記憶の球/S.Lv/宝玉/習得語は失わない(永続成長は守る)。
  // これにより満腹度/罠/毒/未識別/店/足踏み——全ての緊張装置が初めて「意味」を持ち、
  // 脱出の宝玉が「保険」として機能し始める(店の300G宝玉に買う価値が生まれる)。
  const lostItems=(S.inventory||[]).length;
  const lostGold=Math.floor((S.gold||0)/2);
  S.inventory=[];
  S.gold=(S.gold||0)-lostGold;
  save();
  if(typeof updateHdr==='function')updateHdr();
  toast(`💀 倒れてしまった… 持ち物${lostItems}枠と ${lostGold}G を失った`,'r');
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
