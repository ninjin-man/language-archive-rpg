/* ════════════════════════════════════════════════════════════════════
   WORLD — オーバーワールド・フィールド画面 (Phase W1: 器の反転)

   ── 役割 ──
   起動時に最初に表示される全画面フィールド。プレイヤー(prota)を
   タイル単位で8方向に歩かせ、地点(ダンジョン入口等)に接触すると侵入する。
   「☰ メニュー」ボタンで従来のタブUI(#root)を呼び出す。

   ── 設計方針 ──
   ・最終目標はFF5/DQ5級のワールドマップ。本ファイルはその「器」。
   ・探索タブの Archive Atlas(worldmap.js / WMAP) とは別物。Atlasは温存。
   ・dungeon.js の8方向移動・衝突の考え方を踏襲(コーナーカット防止)。
   ・Canvas直描き(iOS Safariのオフスクリーン転送不具合を回避)。
   ・getBoundingClientRect()が0×0を返すiOS罠に rAF リトライで対処。
   ・W1ではテストマップ(コード内定義)で歩行〜侵入〜メニューを成立させる。
     W2で world.json によるタイルマップ外部化＋カメラスクロールへ拡張。

   ── 公開API ──
     enterWorld()         フィールドへ遷移し描画開始(起動時/ダンジョン帰還時)
     openMenuOverlay()    タブUI(#root)を前面に出す
     closeMenuOverlay()   タブUIを閉じてフィールドへ戻る
     WORLD_show()/WORLD_hide()  描画ループ制御
════════════════════════════════════════════════════════════════════ */

/* タイル種別 */
var WLD_T = { GRASS:0, WATER:1, FOREST:2, MOUNT:3, ROAD:4, SAND:5 };
/* 歩行可能か(falseは壁=進入不可) */
var WLD_WALK = {0:true,1:false,2:false,3:false,4:true,5:true};
var WLD_COL = {0:'#3f7a3a',1:'#2f6fb0',2:'#234d27',3:'#7d7264',4:'#c2a060',5:'#cdb87a'};

var WORLD = {
  canvas:null, ctx:null,
  running:false, raf:null,
  grid:null, GW:0, GH:0,
  px:0, py:0,            // プレイヤーのタイル座標
  ppx:0, ppy:0,          // 描画用ピクセル座標(補間)
  moving:false, mfx:0, mfy:0, mtx:0, mty:0, mstart:0, mdur:130,
  dir:'down',
  spots:[],              // {gx,gy,type:'dungeon',id,name}
  inited:false,
  t0:Date.now(),
};

/* W1テストマップ: 12×12。1=水(壁),2=森(壁),3=山(壁) は通れない。
   外周は水で囲み、中央付近にダンジョン入口を1つ置く。 */
function wldBuildTestMap(){
  var G=WORLD;
  var raw=[
    "111111111111",
    "100000000031",
    "104444444401",
    "104022200401",
    "104020D00401",
    "104020000401",
    "104444444401",
    "100000550001",
    "103000550001",
    "100000000021",
    "100000000001",
    "111111111111",
  ];
  G.GH=raw.length; G.GW=raw[0].length;
  G.grid=[]; G.spots=[];
  for(var y=0;y<G.GH;y++){
    G.grid[y]=[];
    for(var x=0;x<G.GW;x++){
      var ch=raw[y][x];
      if(ch==='D'){
        G.grid[y][x]=WLD_T.ROAD;
        // 最初のダンジョン定義を入口に紐付け(無ければidのみ)
        var firstD=(typeof DD!=='undefined'&&DD[0])?DD[0]:null;
        G.spots.push({gx:x,gy:y,type:'dungeon',id:firstD?firstD.id:'d1',name:firstD?firstD.name:'ダンジョン'});
      } else {
        G.grid[y][x]=parseInt(ch,10)||0;
      }
    }
  }
  // 開始位置(保存があれば復元、無ければ歩ける最初のマス)
  var sp=(typeof S!=='undefined'&&S.worldPos)?S.worldPos:null;
  if(sp&&wldWalkable(sp.x,sp.y)){ G.px=sp.x; G.py=sp.y; }
  else { G.px=4; G.py=8; }
  G.ppx=G.px; G.ppy=G.py;
}

function wldWalkable(x,y){
  var G=WORLD;
  if(x<0||y<0||x>=G.GW||y>=G.GH)return false;
  return WLD_WALK[G.grid[y][x]]!==false;
}

/* ════════ Canvas寸法・タイル ════════ */
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
function wldTileSize(w,h){ return Math.floor(Math.min(w/WORLD.GW, h/WORLD.GH)); }
function wldOrigin(w,h,ts){ return { ox:Math.floor((w-ts*WORLD.GW)/2), oy:Math.floor((h-ts*WORLD.GH)/2) }; }

/* ════════ 描画 ════════ */
function wldDraw(){
  var size=wldSetSize(); if(!size)return;
  var w=size.w,h=size.h,dpr=size.dpr,ctx=WORLD.ctx,G=WORLD;
  if(!G.grid)return;
  var ts=wldTileSize(w,h), o=wldOrigin(w,h,ts);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#070a12'; ctx.fillRect(0,0,w,h);
  // タイル
  for(var gy=0;gy<G.GH;gy++)for(var gx=0;gx<G.GW;gx++){
    var t=G.grid[gy][gx];
    var px=o.ox+gx*ts, py=o.oy+gy*ts;
    ctx.fillStyle=WLD_COL[t]||'#333';
    ctx.fillRect(px,py,ts,ts);
    if(t===WLD_T.FOREST){
      ctx.fillStyle='#16401d';var r=Math.max(1,ts*0.16);
      ctx.beginPath();ctx.arc(px+ts*0.35,py+ts*0.4,r,0,7);ctx.arc(px+ts*0.65,py+ts*0.6,r,0,7);ctx.fill();
    }else if(t===WLD_T.MOUNT){
      ctx.fillStyle='#a89a86';
      ctx.beginPath();ctx.moveTo(px+ts*0.5,py+ts*0.22);ctx.lineTo(px+ts*0.82,py+ts*0.8);ctx.lineTo(px+ts*0.18,py+ts*0.8);ctx.closePath();ctx.fill();
    }
  }
  // 地点(ダンジョン入口)
  var tnow=(Date.now()-G.t0)/1000;
  G.spots.forEach(function(s){
    var px=o.ox+s.gx*ts+ts/2, py=o.oy+s.gy*ts+ts/2;
    var pulse=0.5+0.5*Math.sin(tnow*2.4);
    ctx.globalAlpha=0.35+pulse*0.4;
    ctx.fillStyle='#c8a84b';
    ctx.beginPath();ctx.arc(px,py,ts*0.5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.font=Math.max(11,Math.floor(ts*0.7))+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('⚔',px,py+1);
  });
  // プレイヤー
  var apx=o.ox+G.ppx*ts+ts/2, apy=o.oy+G.ppy*ts+ts/2;
  ctx.beginPath();ctx.arc(apx,apy,Math.max(7,ts*0.34),0,Math.PI*2);
  ctx.fillStyle='#fff7e0';ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#04060c';ctx.stroke();
  ctx.fillStyle='#04060c';ctx.font=Math.max(10,Math.floor(ts*0.4))+'px sans-serif';
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
  // 斜め移動のコーナーカット防止(dungeon.js踏襲): 両隣のどちらかが壁なら斜め不可
  if(d[0]!==0&&d[1]!==0){
    if(!wldWalkable(G.px+d[0],G.py)||!wldWalkable(G.px,G.py+d[1]))return;
  }
  G.mfx=G.px;G.mfy=G.py;G.mtx=nx;G.mty=ny;G.mstart=Date.now();G.moving=true;
}
function wldEase(t){return 1-Math.pow(1-t,2)}
function wldArrive(){
  var G=WORLD;
  G.px=G.mtx;G.py=G.mty;G.ppx=G.px;G.ppy=G.py;G.moving=false;
  if(typeof S!=='undefined'){S.worldPos={x:G.px,y:G.py};if(typeof save==='function')save();}
  // 地点接触判定
  var hit=G.spots.find(function(s){return s.gx===G.px&&s.gy===G.py;});
  if(hit&&hit.type==='dungeon')wldEnterSpot(hit);
}
function wldEnterSpot(spot){
  // ダンジョンへ。帰還先がフィールドになるようフラグを立てる。
  if(typeof S!=='undefined'){S.fromWorld=true;if(typeof save==='function')save();}
  WORLD_hide();
  if(typeof openDmap==='function')openDmap(spot.id);
  else if(typeof toast==='function')toast('入口: '+spot.name,'g');
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
function wldBindControls(){
  // Dパッド(長押し連続移動対応)
  var held=null, repTimer=null;
  function startHold(dir){
    held=dir; wldMove(dir);
    if(repTimer)clearInterval(repTimer);
    repTimer=setInterval(function(){ if(held)wldMove(held); },150);
  }
  function endHold(){ held=null; if(repTimer){clearInterval(repTimer);repTimer=null;} }
  document.querySelectorAll('#world-dpad [data-wdir]').forEach(function(b){
    var dir=b.getAttribute('data-wdir');
    b.addEventListener('touchstart',function(e){e.preventDefault();startHold(dir);},{passive:false});
    b.addEventListener('touchend',function(e){e.preventDefault();endHold();},{passive:false});
    b.addEventListener('mousedown',function(e){e.preventDefault();startHold(dir);});
    b.addEventListener('mouseup',endHold);
    b.addEventListener('mouseleave',endHold);
  });
  // キーボード(PC確認用・将来用)
  window.addEventListener('keydown',function(e){
    if(!WORLD.running)return;
    var m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
    if(m){e.preventDefault();wldMove(m);}
  });
}

/* ════════ メニューオーバーレイ(タブUI #root の開閉) ════════ */
function openMenuOverlay(){
  document.body.classList.add('menu-open');
  // タブUIの中身を最新化(起動時は描画を遅延させ軽量起動するため、ここで初回描画)
  if(typeof updateHdr==='function')updateHdr();
  if(typeof checkJobs==='function')checkJobs();
  var scr=(typeof S!=='undefined'&&S.screen)?S.screen:'arc';
  if(typeof go==='function')go(scr);
}
function closeMenuOverlay(){
  document.body.classList.remove('menu-open');
  if(typeof WM_hide==='function')WM_hide(); // 探索タブAtlasの描画ループを止める
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
  if(!WORLD.grid)wldBuildTestMap();
  WORLD.running=true; WORLD.t0=Date.now();
  // iOS: init時 getBoundingClientRect が 0×0 を返すことがあるため rAF リトライ
  var tries=0;
  (function ready(){
    var c=wldGetCanvas();
    var r=c?c.getBoundingClientRect():null;
    if(r&&r.width>2&&r.height>2){ if(!WORLD.raf)wldLoop(); }
    else if(tries++<30){ requestAnimationFrame(ready); }
    else if(!WORLD.raf){ wldLoop(); }
  })();
}
function WORLD_hide(){ WORLD.running=false; if(WORLD.raf){cancelAnimationFrame(WORLD.raf);WORLD.raf=null;} }

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

