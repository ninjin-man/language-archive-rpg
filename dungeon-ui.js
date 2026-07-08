/* ════════════════════════════════════════════════════════════════════
   DUNGEON UI — 描画・HUD・演出 (R1構造分割 3/3)
   読込順: dungeon-core.js → dungeon-play.js → dungeon-ui.js
   ── 責務 ──
   ・dmRender/ミニマップ/HUD(HP・満腹度・毒)/ログ/フロートダメージ
   ・スプライトアニメ(歩行/攻撃)・罠/商人オーバーレイ
   ・Dパッド表示切替、closeDmapラッパー(帰還先分岐の後段処理)
   ※末尾の const _origCloseDmap=closeDmap はロード時にcoreの定義を
     キャプチャするため、本ファイルは必ず最後に読み込むこと。
════════════════════════════════════════════════════════════════════ */
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
function dmShowFloatDamage(vx,vy,amount,kind){
  const m=Renderer.getCellMetrics();
  const x=m.padLeft+vx*(m.cw+m.gap)+m.cw/2;
  const y=m.padTop+vy*(m.cw+m.gap)+m.cw*0.25;
  const text=(kind==='heal'?'+':kind==='enemy'?'⚔':kind==='fire'?'🔥':'')+Math.abs(amount);
  Renderer.showFloatDamage(x,y,text,kind);
}

// プレイヤーのHPが0になった際の処理: ダンジョンから帰還する(獲得済みアーカイブ/Gold等は保持)
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
