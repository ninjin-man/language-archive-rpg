/* ════════════════════════════════════════════════
   CANVAS RENDERER — 描画層(Canvas実装)
   dungeon-renderer.js(DomRenderer)と同じメソッド名を持つCanvasRendererを定義し、
   ファイル末尾で Renderer=CanvasRenderer に差し替える。
   dungeon.js / dungeon-renderer.js は無改造(非破壊)。

   ── 方針 ──
   グリッド表示(renderGrid/updatePlayerSprite/getCellMetrics)だけをCanvasに置き換え、
   それ以外(HUD/ミニマップ/ログ/モーダル開閉/階段確認/イベント選択)は
   DomRendererにそのまま委譲する(Object.assignでスプレッドし、必要なメソッドだけ上書き)。

   renderGrid(cells,actionBtn) で渡される cells は DOM向けにHTML文字列化されている
   (player-sprite divやditem-badge spanを含む)ため、Canvasでは使わずパースもしない。
   代わりに DM.floors[DM.floor] のグリッド/敵/アイテム/部屋データを直接読み、
   DomRenderer.renderGrid と同じ分類ロジック(T/iconsマッピング・輝度計算式)を
   このファイル内で独立に再現する。actionBtnだけはそのまま受け取って#dm-actに反映する。

   ── 読み込み順 ──
   dungeon-renderer.js → dungeon.js → canvas-renderer.js(このファイル)
   このファイルはDM/CELL/GW・GH/VW・VH/DM_LIGHT_MIN/DM_LIGHT_FALLOFF/getItemDef/
   SPRITE_COLS等、dungeon.js側のグローバルをそのまま参照する。

   ── ロールバック ──
   万一表示が崩れた場合は、本ファイル最終行の「Renderer=CanvasRenderer;」を
   削除/コメントアウトするだけでDOM版に戻る(dungeon.js/dungeon-renderer.jsは無傷)。

   ── 部屋一括可視化(Canvas限定のボーナス、風来のシレン方式) ──
   プレイヤーが部屋の矩形内にいる間、その部屋全体(壁の輪郭含む)を一括で
   霧晴らし・フル輝度にする。explored Setへの追加のみで、DOM版にも自動的に
   恩恵がある(セーブ対象外の実行時状態なので安全)。
════════════════════════════════════════════════ */

const CR = { canvas:null, ctx:null, playerImg:null, tileImgs:{} };

function crGetCanvas(){
  if (CR.canvas) return CR.canvas;
  CR.canvas = document.getElementById('dm-canvas');
  if (CR.canvas) CR.ctx = CR.canvas.getContext('2d');
  return CR.canvas;
}
function crLoadImage(src){
  const img = new Image();
  img.onload = () => { if (typeof Renderer!=='undefined' && Renderer===CanvasRenderer) crDraw(); };
  img.src = src;
  return img;
}
function crGetPlayerImg(){
  if (!CR.playerImg) CR.playerImg = crLoadImage('assets/sprites/player_sheet.png');
  return CR.playerImg;
}
function crGetTileImg(name){
  if (!CR.tileImgs[name]) CR.tileImgs[name] = crLoadImage(`assets/tiles/${name}.png`);
  return CR.tileImgs[name];
}
function crImgReady(img){ return !!img && img.complete && img.naturalWidth>0; }

const CR_COL = {
  floor1:'#454d6e', floor2:'#363c58',
  wall1:'#0a0c16',  wall2:'#04050a',
  fog1:'#0c0e18',   fog2:'#070811',
  cyan:'#4dc8e0', gold:'#c8a84b', violet:'#8a6dfa',
  green:'#4de0a0', rose:'#e05c7a', amber:'#e0982a',
  text:'#f0ead8'
};

// 表示中のCanvasの実寸(CSSが決める。デスクトップ=固定px、モバイル≤430px=可変%)を
// そのまま読み取ってバッキングストアを合わせる。ブレークポイント値をJS側で持たない。
function crSetSize(){
  const c = crGetCanvas(); if (!c) return null;
  const rect = c.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (w<2 || h<2) return null; // 非表示中(レイアウト未確定)は描画スキップ
  const dpr = window.devicePixelRatio||1;
  if (c._cssW!==w || c._cssH!==h || c._dpr!==dpr){
    c.width = Math.round(w*dpr); c.height = Math.round(h*dpr);
    c._cssW=w; c._cssH=h; c._dpr=dpr;
  }
  return { w, h, dpr };
}

function crRoundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function crFillGrad(ctx,x,y,s,c1,c2){
  const grad = ctx.createLinearGradient(x,y,x+s,y+s);
  grad.addColorStop(0,c1); grad.addColorStop(1,c2);
  ctx.fillStyle = grad;
  crRoundRectPath(ctx,x,y,s,s,Math.max(2,s*0.16));
  ctx.fill();
}
function crFillRadial(ctx,x,y,s,col){
  const grad = ctx.createRadialGradient(x+s/2,y+s/2,0,x+s/2,y+s/2,s/1.4);
  grad.addColorStop(0,col+'88'); grad.addColorStop(1,col+'18');
  ctx.fillStyle = grad;
  crRoundRectPath(ctx,x,y,s,s,Math.max(2,s*0.16));
  ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.strokeRect(x+0.5,y+0.5,s-1,s-1);
}
// CSSの background:url(...) center/cover 相当(画像が未配置/未読込なら呼び出し元がフォールバックする)
function crCoverDraw(ctx,img,x,y,s){
  const iw=img.naturalWidth, ih=img.naturalHeight;
  const scale = Math.max(s/iw, s/ih);
  const dw=iw*scale, dh=ih*scale;
  ctx.save();
  crRoundRectPath(ctx,x,y,s,s,Math.max(2,s*0.16));
  ctx.clip();
  ctx.drawImage(img, x+(s-dw)/2, y+(s-dh)/2, dw, dh);
  ctx.restore();
}
// CSSの .dwa は wall.png の上に rgba(15,25,60,.55) の暗いオーバーレイを重ねている
// (linear-gradient(rgba(15,25,60,.55),rgba(15,25,60,.55)), url(wall.png), ...)。
// これが無いと壁画像が床画像(floor.png)と見分けがつきにくくなるため、Canvas側でも必ず再現する。
function crDrawWallTile(ctx,wallImg,px,py,cell){
  if (crImgReady(wallImg)){
    crCoverDraw(ctx,wallImg,px,py,cell);
    ctx.fillStyle='rgba(15,25,60,.55)';
    crRoundRectPath(ctx,px,py,cell,cell,Math.max(2,cell*0.16));
    ctx.fill();
  } else {
    crFillGrad(ctx,px,py,cell,CR_COL.wall1,CR_COL.wall2);
  }
}
// ctx.filterはiOS Safariでの対応状況が不安定なため使わず、黒の半透明オーバーレイで明度を近似する
function crDarken(ctx,x,y,s,bright){
  if (bright>=1) return;
  ctx.fillStyle = `rgba(0,0,0,${(1-bright).toFixed(2)})`;
  crRoundRectPath(ctx,x,y,s,s,Math.max(2,s*0.16));
  ctx.fill();
}

function crFindRoom(rooms, p){
  if (!rooms) return null;
  return rooms.find(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h) || null;
}
function crInRoom(room,x,y){
  if (!room) return false;
  return x>=room.x-1 && x<=room.x+room.w && y>=room.y-1 && y<=room.y+room.h;
}
function crRevealRoom(fl, room){
  if (!room) return;
  const x0=Math.max(0,room.x-1), x1=Math.min(GW-1,room.x+room.w);
  const y0=Math.max(0,room.y-1), y1=Math.min(GH-1,room.y+room.h);
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) fl.explored.add(`${x},${y}`);
}

// dungeon.js の dmRender() 内 T/icons マッピングと同じ対応関係(独立に再現)
const CR_TILE_ICON = {};
CR_TILE_ICON[CELL.CHEST]='🎁'; CR_TILE_ICON[CELL.CHEST_GOLD]='💰';
CR_TILE_ICON[CELL.EVENT]='❓'; CR_TILE_ICON[CELL.EXIT]='🚪';
CR_TILE_ICON[CELL.STAIRS_DOWN]='↓'; CR_TILE_ICON[CELL.STAIRS_UP]='↑';

// プレイヤースプライト(player_sheet.png, 6列×4行)を現在のDM.anim.dir/frameに従って描画。
// 画像未配置時はCSSの.player-sprite同様、単色のフォールバックを表示する。
function crDrawPlayer(ctx,px,py,cell){
  const img = crGetPlayerImg();
  if (crImgReady(img)){
    const dir = (DM.anim && DM.anim.dir) || 'down';
    const frame = (DM.anim && DM.anim.frame) || 'idle';
    const col = SPRITE_FRAME_COL[frame] ?? 0;
    const row = SPRITE_DIR_ROW[dir] ?? 0;
    const sw = img.naturalWidth/SPRITE_COLS, sh = img.naturalHeight/SPRITE_ROWS;
    const sx = col*sw, sy = row*sh;
    const dh = cell, dw = cell*(sw/sh); // CSSのheight:100%;width:auto;aspect-ratio相当
    const dx = px+(cell-dw)/2, dy = py;
    ctx.drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh);
  } else {
    ctx.fillStyle='rgba(77,200,224,.4)';
    crRoundRectPath(ctx,px+cell*0.22,py,cell*0.56,cell,Math.max(2,cell*0.16));
    ctx.fill();
  }
}

function crDraw(){
  const fl = DM.floors[DM.floor]; if (!fl) return;
  const size = crSetSize(); if (!size) return;
  const { w, h, dpr } = size;
  const ctx = CR.ctx;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.textAlign='center'; ctx.textBaseline='middle';

  const { grid:g, explored, playerPos:p, enemies, items, rooms } = fl;
  const currentRoom = crFindRoom(rooms, p);
  if (currentRoom) crRevealRoom(fl, currentRoom);

  const cell = w/VW; // 正方形キャンバス前提(width===height)
  const enemyAt={}; (enemies||[]).forEach(e=>{ if(e.curHp>0) enemyAt[`${e.x},${e.y}`]=e; });
  const itemsAt={}; (items||[]).forEach(it=>{ const k=`${it.x},${it.y}`; (itemsAt[k]=itemsAt[k]||[]).push(it); });

  const ox=p.x-Math.floor(VW/2), oy=p.y-Math.floor(VH/2);
  const floorImg=crGetTileImg('floor'), wallImg=crGetTileImg('wall'), stairsImg=crGetTileImg('stairs');

  for(let vy=0; vy<VH; vy++) for(let vx=0; vx<VW; vx++){
    const mx=ox+vx, my=oy+vy;
    const px=vx*cell, py=vy*cell;

    if (mx<0||mx>=GW||my<0||my>=GH){
      crDrawWallTile(ctx,wallImg,px,py,cell);
      continue;
    }
    const key=`${mx},${my}`;
    const fog = !explored.has(key) && g[my][mx]!==CELL.PLAYER;
    if (fog){
      ctx.globalAlpha=0.55;
      crFillGrad(ctx,px,py,cell,CR_COL.fog1,CR_COL.fog2);
      ctx.globalAlpha=1;
      continue;
    }
    const t=g[my][mx];
    const dist=Math.sqrt((mx-p.x)**2+(my-p.y)**2);
    const bright = crInRoom(currentRoom,mx,my) ? 1 : Math.max(DM_LIGHT_MIN,1-dist*DM_LIGHT_FALLOFF);

    // 背景タイル(画像があればcover表示、無ければグラデーションのフォールバック)
    if (t===CELL.WALL){
      crDrawWallTile(ctx,wallImg,px,py,cell);
    } else {
      if (crImgReady(floorImg)) crCoverDraw(ctx,floorImg,px,py,cell);
      else crFillGrad(ctx,px,py,cell,CR_COL.floor1,CR_COL.floor2);
    }

    const stack=itemsAt[key], enemy=enemyAt[key];
    ctx.font = Math.round(cell*0.55)+'px sans-serif';

    if (enemy){
      crFillRadial(ctx,px,py,cell,CR_COL.rose);
      ctx.fillStyle=CR_COL.text;
      ctx.fillText(enemy.icon||'👾', px+cell/2, py+cell/2+1);
      if (enemy.hp){
        const hpPct=Math.max(0,enemy.curHp/enemy.hp);
        ctx.fillStyle='rgba(0,0,0,.55)';
        ctx.fillRect(px+cell*0.1, py+1, cell*0.8, Math.max(2,cell*0.06));
        ctx.fillStyle='#ff8a5a';
        ctx.fillRect(px+cell*0.1, py+1, cell*0.8*hpPct, Math.max(2,cell*0.06));
      }
    } else if (stack && stack.length){
      crFillRadial(ctx,px,py,cell,CR_COL.green);
      const def=getItemDef(stack[0].id);
      ctx.fillStyle=CR_COL.text;
      ctx.fillText(def?def.icon:'❔', px+cell/2, py+cell/2);
      if (stack.length>1){
        ctx.fillStyle=CR_COL.gold;
        ctx.beginPath(); ctx.arc(px+cell-cell*0.16,py+cell-cell*0.16,cell*0.16,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#04060c';
        ctx.font=Math.round(cell*0.32)+'px sans-serif';
        ctx.fillText(String(stack.length), px+cell-cell*0.16, py+cell-cell*0.16);
      }
    } else if (t===CELL.PLAYER){
      crFillRadial(ctx,px,py,cell,CR_COL.cyan);
      crDrawPlayer(ctx,px,py,cell);
    } else if (t===CELL.STAIRS_DOWN || t===CELL.STAIRS_UP){
      if (crImgReady(stairsImg)) crCoverDraw(ctx,stairsImg,px,py,cell);
      crFillRadial(ctx,px,py,cell, t===CELL.STAIRS_DOWN?CR_COL.amber:CR_COL.cyan);
      ctx.fillStyle=CR_COL.text;
      ctx.fillText(CR_TILE_ICON[t], px+cell/2, py+cell/2);
    } else if (CR_TILE_ICON[t]){
      const col = (t===CELL.CHEST||t===CELL.CHEST_GOLD)?CR_COL.gold : t===CELL.EVENT?CR_COL.violet : CR_COL.green;
      crFillRadial(ctx,px,py,cell,col);
      ctx.fillStyle=CR_COL.text;
      ctx.fillText(CR_TILE_ICON[t], px+cell/2, py+cell/2);
    }

    crDarken(ctx,px,py,cell,bright);
  }
}

const CanvasRenderer = Object.assign({}, DomRenderer, {
  renderGrid(cells, actionBtn){
    const ab=document.getElementById('dm-act');
    if (ab){ ab.textContent=actionBtn.text; ab.style.background=actionBtn.bg; ab.style.color=actionBtn.color; }
    crDraw();
  },
  // 歩行/攻撃アニメーション中(90ms間隔)に呼ばれる。引数のbgPosition文字列は使わず、
  // DM.anim.dir/frameを直接読んで毎回フル再描画する(9x9=81セル程度なら十分軽量)。
  updatePlayerSprite(_bgPosition){
    crDraw();
  },
  getCellMetrics(){
    const frame=document.getElementById('dm-grid-frame');
    const canvas=crGetCanvas();
    if (!frame||!canvas) return {cw:44,gap:0,padLeft:10,padTop:10};
    const fr=frame.getBoundingClientRect(), cr=canvas.getBoundingClientRect();
    return { cw: cr.width/VW, gap:0, padLeft: cr.left-fr.left, padTop: cr.top-fr.top };
  },
});

window.addEventListener('resize', ()=>{ if (Renderer===CanvasRenderer) crDraw(); });

Renderer = CanvasRenderer; // ここでDOM版からCanvas版へ正式に切り替える(ロールバックはこの行を消すだけ)
