/* ════════════════════════════════════════════════════════════════════
   WORLD — オーバーワールド・フィールド画面 (Phase W2: カメラスクロール)

   ── 役割 ──
   起動時の全画面フィールド。プレイヤーをタイル単位で8方向に歩かせ、
   地点(ダンジョン/町)に接触で侵入。「☰」でタブUI(#root)を開く。

   ── W2の変更点 ──
   ・マップ定義を world-data.js (var WLD_OVERWORLD / WLD_LEGEND) に外部化。
   ・タイルサイズ固定 + 自キャラ中央固定のカメラスクロール。マップ端でクランプ。
   ・描画は可視範囲のみループ(32×32全描画を避けてiPhoneで軽量)。
   ・ダンジョン入口に加え町マーカー(type:'town')を複数配置。

   ── 設計の踏襲 ──
   ・dungeon.js の8方向移動・コーナーカット防止。
   ・Canvas直描き(iOSオフスクリーン転送不具合の回避)。
   ・getBoundingClientRect 0×0 の罠に rAF リトライ。

   ── 公開API ──
     enterWorld() / openMenuOverlay() / closeMenuOverlay()
     WORLD_show() / WORLD_hide()
════════════════════════════════════════════════════════════════════ */

/* タイル定義は world-data.js で定義済み(WLD_T/WLD_WALK/WLD_COL/WLD_LEGEND)。
   読み込み順の安全策として未定義時のみフォールバック定義する。 */
if(typeof WLD_T==='undefined'){ var WLD_T={GRASS:0,WATER:1,FOREST:2,MOUNT:3,ROAD:4,SAND:5}; }
if(typeof WLD_WALK==='undefined'){ var WLD_WALK={0:true,1:false,2:false,3:false,4:true,5:true}; }
if(typeof WLD_COL==='undefined'){ var WLD_COL={0:'#3f7a3a',1:'#2f6fb0',2:'#234d27',3:'#7d7264',4:'#c2a060',5:'#cdb87a'}; }

var WORLD = {
  canvas:null, ctx:null,
  running:false, raf:null,
  map:null,
  grid:null, GW:0, GH:0,
  spots:[],
  px:0, py:0,
  ppx:0, ppy:0,
  moving:false, mfx:0, mfy:0, mtx:0, mty:0, mstart:0, mdur:130,
  dir:'down',
  VIS:11,
  held:null, repTimer:null,
  inited:false,
  t0:Date.now(),
};

/* ════════ マップ構築(world-data.js から) ════════ */
function wldBuildMap(){
  var G=WORLD;
  var def=(typeof WLD_OVERWORLD!=='undefined')?WLD_OVERWORLD:null;
  if(!def){ wldBuildFallbackMap(); return; }
  G.map=def;
  var rows=def.rows;
  G.GH=rows.length; G.GW=rows[0].length;
  G.grid=[];
  for(var y=0;y<G.GH;y++){
    G.grid[y]=[];
    for(var x=0;x<G.GW;x++){
      var ch=rows[y][x];
      var t=(typeof WLD_LEGEND!=='undefined'&&WLD_LEGEND[ch]!==undefined)?WLD_LEGEND[ch]:WLD_T.GRASS;
      G.grid[y][x]=t;
    }
  }
  G.spots=(def.spots||[]).slice();
  if(typeof DD!=='undefined'){
    var placed={}; G.spots.forEach(function(s){ if(s.type==='dungeon')placed[s.id]=1; });
    DD.forEach(function(d){ if(!placed[d.id]&&typeof console!=='undefined')console.warn('[world] 未配置のダンジョン: '+d.id); });
  }
  var sp=(typeof S!=='undefined'&&S.worldPos)?S.worldPos:null;
  if(sp&&wldInBounds(sp.x,sp.y)&&wldWalkable(sp.x,sp.y)){ G.px=sp.x; G.py=sp.y; }
  else if(def.start&&wldWalkable(def.start.x,def.start.y)){ G.px=def.start.x; G.py=def.start.y; }
  else { var f=wldFindWalkable(); G.px=f.x; G.py=f.y; }
  G.ppx=G.px; G.ppy=G.py;
}
function wldBuildFallbackMap(){
  var G=WORLD; G.GW=12; G.GH=12; G.grid=[]; G.spots=[];
  for(var y=0;y<12;y++){ G.grid[y]=[]; for(var x=0;x<12;x++){ G.grid[y][x]=(x===0||y===0||x===11||y===11)?WLD_T.WATER:WLD_T.GRASS; } }
  var firstD=(typeof DD!=='undefined'&&DD[0])?DD[0]:null;
  G.spots.push({gx:6,gy:6,type:'dungeon',id:firstD?firstD.id:'d1',name:firstD?firstD.name:'ダンジョン',icon:'⚔'});
  G.px=4;G.py=8;G.ppx=4;G.ppy=8;
}
function wldInBounds(x,y){ return x>=0&&y>=0&&x<WORLD.GW&&y<WORLD.GH; }
function wldWalkable(x,y){
  if(!wldInBounds(x,y))return false;
  return WLD_WALK[WORLD.grid[y][x]]!==false;
}
function wldFindWalkable(){
  var G=WORLD;
  for(var y=0;y<G.GH;y++)for(var x=0;x<G.GW;x++){ if(wldWalkable(x,y))return{x:x,y:y}; }
  return {x:0,y:0};
}

/* ════════ Canvas寸法・カメラ ════════ */
function wldGetCanvas(){
  if(WORLD.canvas)return WORLD.canvas;
  WORLD.canvas=document.getElementById('world-canvas');
  if(WORLD.canvas)WORLD.ctx=WORLD.canvas.getContext('2d');
  return WORLD.canvas;
}
function wldSetSize(){
  var c=wldGetCanvas(); if(!c)return null;
  var rect=c.getBoundingClientRect();
  var w=Math.round(rect.width), h=Math.round(rect.height);
  if(w<2||h<2)return null;
  var dpr=window.devicePixelRatio||1;
  if(c._w!==w||c._h!==h||c._dpr!==dpr){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c._w=w;c._h=h;c._dpr=dpr}
  return {w:w,h:h,dpr:dpr};
}
function wldTileSize(w,h){
  var ts=Math.ceil(Math.min(w,h)/WORLD.VIS);
  return Math.max(18,ts);
}
function wldCamera(w,h,ts){
  var G=WORLD;
  var visX=w/ts, visY=h/ts;
  var camX=G.ppx-visX/2+0.5;
  var camY=G.ppy-visY/2+0.5;
  if(G.GW>visX) camX=Math.max(0,Math.min(G.GW-visX,camX)); else camX=(G.GW-visX)/2;
  if(G.GH>visY) camY=Math.max(0,Math.min(G.GH-visY,camY)); else camY=(G.GH-visY)/2;
  return {camX:camX,camY:camY,visX:visX,visY:visY};
}

/* ════════ 描画 ════════ */
function wldDraw(){
  var size=wldSetSize(); if(!size)return;
  var w=size.w,h=size.h,dpr=size.dpr,ctx=WORLD.ctx,G=WORLD;
  if(!G.grid)return;
  var ts=wldTileSize(w,h);
  var cam=wldCamera(w,h,ts);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#070a12'; ctx.fillRect(0,0,w,h);
  var x0=Math.floor(cam.camX)-1, y0=Math.floor(cam.camY)-1;
  var x1=Math.ceil(cam.camX+cam.visX)+1, y1=Math.ceil(cam.camY+cam.visY)+1;
  function sx(gx){ return Math.round((gx-cam.camX)*ts); }
  function sy(gy){ return Math.round((gy-cam.camY)*ts); }
  for(var gy=y0;gy<y1;gy++){
    if(gy<0||gy>=G.GH)continue;
    for(var gx=x0;gx<x1;gx++){
      if(gx<0||gx>=G.GW)continue;
      var t=G.grid[gy][gx];
      var px=sx(gx), py=sy(gy);
      ctx.fillStyle=WLD_COL[t]||'#333';
      ctx.fillRect(px,py,ts+1,ts+1);
      if(t===WLD_T.FOREST){
        ctx.fillStyle='#16401d';var r=Math.max(1,ts*0.16);
        ctx.beginPath();ctx.arc(px+ts*0.35,py+ts*0.4,r,0,7);ctx.arc(px+ts*0.65,py+ts*0.6,r,0,7);ctx.fill();
      }else if(t===WLD_T.MOUNT){
        ctx.fillStyle='#a89a86';
        ctx.beginPath();ctx.moveTo(px+ts*0.5,py+ts*0.22);ctx.lineTo(px+ts*0.82,py+ts*0.8);ctx.lineTo(px+ts*0.18,py+ts*0.8);ctx.closePath();ctx.fill();
      }else if(t===WLD_T.WATER){
        ctx.strokeStyle='rgba(255,255,255,0.10)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(px+ts*0.25,py+ts*0.6);ctx.lineTo(px+ts*0.55,py+ts*0.6);ctx.stroke();
      }
    }
  }
  var tnow=(Date.now()-G.t0)/1000;
  G.spots.forEach(function(s){
    if(s.gx<x0||s.gx>x1||s.gy<y0||s.gy>y1)return;
    var px=sx(s.gx)+ts/2, py=sy(s.gy)+ts/2;
    var isTown=s.type==='town';
    var pulse=0.5+0.5*Math.sin(tnow*2.4);
    ctx.globalAlpha=0.30+pulse*0.4;
    ctx.fillStyle=isTown?'#7fb0e0':'#c8a84b';
    ctx.beginPath();ctx.arc(px,py,ts*0.52,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.font=Math.max(11,Math.floor(ts*0.66))+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(s.icon||(isTown?'🏠':'⚔'),px,py+1);
  });
  var apx=sx(G.ppx)+ts/2, apy=sy(G.ppy)+ts/2;
  ctx.beginPath();ctx.arc(apx,apy,Math.max(8,ts*0.36),0,Math.PI*2);
  ctx.fillStyle='#fff7e0';ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#04060c';ctx.stroke();
  ctx.fillStyle='#04060c';ctx.font=Math.max(10,Math.floor(ts*0.42))+'px sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🧍',apx,apy+1);
}

/* ════════ 移動 ════════ */
var WLD_DIRS={ up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],
  upleft:[-1,-1],upright:[1,-1],downleft:[-1,1],downright:[1,1] };
function wldMove(dir){
  var G=WORLD;
  if(G.moving)return;
  var d=WLD_DIRS[dir]; if(!d)return;
  G.dir=dir;
  var nx=G.px+d[0], ny=G.py+d[1];
  if(!wldWalkable(nx,ny))return;
  if(d[0]!==0&&d[1]!==0){
    if(!wldWalkable(G.px+d[0],G.py)||!wldWalkable(G.px,G.py+d[1]))return;
  }
  G.mfx=G.px;G.mfy=G.py;G.mtx=nx;G.mty=ny;G.mstart=Date.now();G.moving=true;
}
function wldEase(t){return 1-Math.pow(1-t,2)}
function wldArrive(){
  var G=WORLD;
  var fromX=G.mfx, fromY=G.mfy;   // 進入元(手前マス)
  G.px=G.mtx;G.py=G.mty;G.ppx=G.px;G.ppy=G.py;G.moving=false;
  var hit=G.spots.find(function(s){return s.gx===G.px&&s.gy===G.py;});
  if(hit){ wldEnterSpot(hit,fromX,fromY); }
  else if(typeof S!=='undefined'){ S.worldPos={x:G.px,y:G.py}; if(typeof save==='function')save(); }
}
function wldEnterSpot(spot,fromX,fromY){
  if(spot.type==='dungeon'){
    // 復帰時に入口上で再侵入しないよう、手前マスを保存位置にする(DQ/FF標準)。
    if(typeof S!=='undefined'){
      var back=(fromX!==undefined&&wldWalkable(fromX,fromY))?{x:fromX,y:fromY}:{x:spot.gx,y:spot.gy};
      S.worldPos=back; S.fromWorld=true;
      if(typeof save==='function')save();
    }
    WORLD_hide();
    if(typeof openDmap==='function')openDmap(spot.id);
    else if(typeof toast==='function')toast('入口: '+spot.name,'g');
  }else if(spot.type==='town'){
    if(typeof S!=='undefined'){ S.worldPos={x:spot.gx,y:spot.gy}; if(typeof save==='function')save(); }
    if(typeof toast==='function')toast('🏠 '+(spot.name||'町')+'（準備中）','gr');
  }
}

/* ════════ メインループ ════════ */
function wldLoop(){
  var G=WORLD;
  if(!G.running)return;
  if(G.moving){
    var t=Math.min(1,(Date.now()-G.mstart)/G.mdur),e=wldEase(t);
    G.ppx=G.mfx+(G.mtx-G.mfx)*e;
    G.ppy=G.mfy+(G.mty-G.mfy)*e;
    if(t>=1)wldArrive();
  }
  wldDraw();
  G.raf=requestAnimationFrame(wldLoop);
}

/* ════════ 入力結線 ════════ */
function wldStopHold(){
  WORLD.held=null;
  if(WORLD.repTimer){clearInterval(WORLD.repTimer);WORLD.repTimer=null;}
}
function wldBindControls(){
  function startHold(dir){
    WORLD.held=dir; wldMove(dir);
    if(WORLD.repTimer)clearInterval(WORLD.repTimer);
    WORLD.repTimer=setInterval(function(){ if(WORLD.held&&WORLD.running)wldMove(WORLD.held); },140);
  }
  function endHold(){ wldStopHold(); }
  document.querySelectorAll('#world-dpad [data-wdir]').forEach(function(b){
    var dir=b.getAttribute('data-wdir');
    b.addEventListener('touchstart',function(e){e.preventDefault();startHold(dir);},{passive:false});
    b.addEventListener('touchend',function(e){e.preventDefault();endHold();},{passive:false});
    b.addEventListener('touchcancel',function(e){endHold();},{passive:false});
    b.addEventListener('mousedown',function(e){e.preventDefault();startHold(dir);});
    b.addEventListener('mouseup',endHold);
    b.addEventListener('mouseleave',endHold);
  });
  window.addEventListener('keydown',function(e){
    if(!WORLD.running)return;
    var m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
    if(m){e.preventDefault();wldMove(m);}
  });
}

/* ════════ メニューオーバーレイ(タブUI #root の開閉) ════════ */
function openMenuOverlay(){
  document.body.classList.add('menu-open');
  if(typeof updateHdr==='function')updateHdr();
  if(typeof checkJobs==='function')checkJobs();
  var scr=(typeof S!=='undefined'&&S.screen)?S.screen:'arc';
  if(typeof go==='function')go(scr);
}
function closeMenuOverlay(){
  document.body.classList.remove('menu-open');
  if(typeof WM_hide==='function')WM_hide();
  enterWorld();
}

/* ════════ フィールドへ遷移 ════════ */
function enterWorld(){
  document.body.classList.remove('menu-open');
  document.body.classList.add('world-active');
  if(typeof S!=='undefined'){S.fromWorld=false;if(typeof save==='function')save();}
  WORLD_show();
}

/* ════════ ループ制御 ════════ */
function WORLD_show(){
  if(!WORLD.grid)wldBuildMap();
  // 直前の移動アニメ・長押しが残っていてもクリーンに開始する(ダンジョン帰還時の固まり防止)
  WORLD.moving=false;
  if(typeof wldStopHold==='function')wldStopHold();
  // セーブ位置を現在地として反映(手前マスに戻す処理が効くように)
  if(typeof S!=='undefined'&&S.worldPos&&wldInBounds(S.worldPos.x,S.worldPos.y)&&wldWalkable(S.worldPos.x,S.worldPos.y)){
    WORLD.px=S.worldPos.x; WORLD.py=S.worldPos.y; WORLD.ppx=WORLD.px; WORLD.ppy=WORLD.py;
  }
  WORLD.running=true; WORLD.t0=Date.now();
  var tries=0;
  (function ready(){
    var c=wldGetCanvas();
    var r=c?c.getBoundingClientRect():null;
    if(r&&r.width>2&&r.height>2){ if(!WORLD.raf)wldLoop(); }
    else if(tries++<30){ requestAnimationFrame(ready); }
    else if(!WORLD.raf){ wldLoop(); }
  })();
}
function WORLD_hide(){
  WORLD.running=false;
  WORLD.moving=false;           // 移動アニメ中断(入口侵入時の途中状態を残さない)
  if(typeof wldStopHold==='function')wldStopHold(); // 長押し連続移動を停止
  if(WORLD.raf){cancelAnimationFrame(WORLD.raf);WORLD.raf=null;}
}

/* ════════ 初期化 ════════ */
function wldInit(){
  if(WORLD.inited)return; WORLD.inited=true;
  wldBindControls();
  var onResize=function(){ if(WORLD.running)wldDraw(); };
  window.addEventListener('resize',onResize);
  window.addEventListener('orientationchange',function(){setTimeout(onResize,120);});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',onResize);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wldInit);
else wldInit();

/* ════════ ブート ════════ */
/* 全scriptが定義済みになる最後のファイルでゲームを起動する。
   ui.js の init() はここまで実行を遅延させてある(enterWorld等の前方参照を回避)。 */
if(typeof init==='function')init();
