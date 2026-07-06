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
if(typeof WLD_T==='undefined'){ var WLD_T={GRASS:0,WATER:1,FOREST:2,MOUNT:3,ROAD:4,SAND:5,HOUSE:6,FLOOR:7}; }
if(typeof WLD_WALK==='undefined'){ var WLD_WALK={0:true,1:false,2:false,3:false,4:true,5:true,6:false,7:true}; }
if(typeof WLD_COL==='undefined'){ var WLD_COL={0:'#3f7a3a',1:'#2f6fb0',2:'#234d27',3:'#7d7264',4:'#c2a060',5:'#cdb87a',6:'#6b4a34',7:'#b9a888'}; }

var WORLD = {
  canvas:null, ctx:null,
  running:false, raf:null,
  map:null, curMapId:'overworld',
  grid:null, GW:0, GH:0,
  spots:[],
  px:0, py:0,
  ppx:0, ppy:0,
  moving:false, mfx:0, mfy:0, mtx:0, mty:0, mstart:0, mdur:130,
  dir:'down',
  VIS:11,
  held:null, repTimer:null,
  talking:false, talkNpc:null, talkLine:0,
  inited:false,
  t0:Date.now(),
};

/* ════════ マップ構築(world-data.js から) ════════ */
/* mapId: 'overworld' / 'town_port' / 'town_west'。
   forceStart: {x,y} を渡すとその位置から開始(マップ間遷移の戻り先指定に使う)。 */
function wldBuildMap(mapId, forceStart){
  var G=WORLD;
  var maps=(typeof WORLD_MAPS!=='undefined')?WORLD_MAPS:null;
  var def=null;
  if(maps){ def = maps[mapId] || maps[G.curMapId] || maps.overworld; }
  if(!def && typeof WLD_OVERWORLD!=='undefined') def=WLD_OVERWORLD;
  if(!def){ wldBuildFallbackMap(); return; }
  G.map=def; G.curMapId=def.id;
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
  // NPCタイルは通り抜け不可(DQ式: 正面から話しかける)。grid上に壁フラグを重ねる。
  G._npcBlock={};
  G.spots.forEach(function(s){ if(s.type==='npc')G._npcBlock[s.gx+','+s.gy]=1; });
  // 未配置DDの警告はオーバーワールドのみ
  if(def.id==='overworld' && typeof DD!=='undefined'){
    var placed={}; G.spots.forEach(function(s){ if(s.type==='dungeon')placed[s.id]=1; });
    DD.forEach(function(d){ if(!placed[d.id]&&typeof console!=='undefined')console.warn('[world] 未配置のダンジョン: '+d.id); });
  }
  // 開始位置の決定: forceStart > セーブ(同一マップのみ) > def.start > 走査
  var start=null;
  if(forceStart && wldInBounds(forceStart.x,forceStart.y) && wldWalkable(forceStart.x,forceStart.y)) start=forceStart;
  if(!start){
    var sp=(typeof S!=='undefined'&&S.worldPos)?S.worldPos:null;
    var spMap=(sp&&sp.map)?sp.map:'overworld'; // 旧セーブ{x,y}はoverworld扱い(後方互換)
    if(sp&&spMap===def.id&&wldInBounds(sp.x,sp.y)&&wldWalkable(sp.x,sp.y)) start={x:sp.x,y:sp.y};
  }
  if(!start && def.start && wldWalkable(def.start.x,def.start.y)) start={x:def.start.x,y:def.start.y};
  if(!start){ var f=wldFindWalkable(); start={x:f.x,y:f.y}; }
  G.px=start.x; G.py=start.y; G.ppx=G.px; G.ppy=G.py;
}
function wldBuildFallbackMap(){
  var G=WORLD; G.GW=12; G.GH=12; G.grid=[]; G.spots=[]; G._npcBlock={}; G.curMapId='overworld';
  for(var y=0;y<12;y++){ G.grid[y]=[]; for(var x=0;x<12;x++){ G.grid[y][x]=(x===0||y===0||x===11||y===11)?WLD_T.WATER:WLD_T.GRASS; } }
  var firstD=(typeof DD!=='undefined'&&DD[0])?DD[0]:null;
  G.spots.push({gx:6,gy:6,type:'dungeon',id:firstD?firstD.id:'d1',name:firstD?firstD.name:'ダンジョン',icon:'⚔'});
  G.px=4;G.py=8;G.ppx=4;G.ppy=8;
}
function wldInBounds(x,y){ return x>=0&&y>=0&&x<WORLD.GW&&y<WORLD.GH; }
function wldWalkable(x,y){
  if(!wldInBounds(x,y))return false;
  if(WORLD._npcBlock&&WORLD._npcBlock[x+','+y])return false; // NPCは壁
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
      }else if(t===WLD_T.HOUSE){
        // 建物: 赤い三角屋根で家らしく
        ctx.fillStyle='#8a3b2e';
        ctx.beginPath();ctx.moveTo(px+ts*0.5,py+ts*0.12);ctx.lineTo(px+ts*0.92,py+ts*0.5);ctx.lineTo(px+ts*0.08,py+ts*0.5);ctx.closePath();ctx.fill();
        ctx.fillStyle='#3a2418';
        ctx.fillRect(px+ts*0.42,py+ts*0.62,ts*0.16,ts*0.28);
      }
    }
  }
  var tnow=(Date.now()-G.t0)/1000;
  G.spots.forEach(function(s){
    if(s.gx<x0||s.gx>x1||s.gy<y0||s.gy>y1)return;
    var px=sx(s.gx)+ts/2, py=sy(s.gy)+ts/2;
    if(s.type==='npc'){
      // NPCは脈動なし。足元に薄い影、頭上にアイコン。
      ctx.globalAlpha=0.25;ctx.fillStyle='#000';
      ctx.beginPath();ctx.ellipse(px,py+ts*0.32,ts*0.3,ts*0.14,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
      ctx.font=Math.max(12,Math.floor(ts*0.72))+'px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(s.icon||'🧍',px,py);
      return;
    }
    if(s.type==='exit'){
      ctx.fillStyle='rgba(20,24,40,0.55)';
      ctx.fillRect(sx(s.gx)+ts*0.15,sy(s.gy)+ts*0.15,ts*0.7,ts*0.7);
      ctx.font=Math.max(11,Math.floor(ts*0.6))+'px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('🚪',px,py);
      return;
    }
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
  if(G.talking)return;   // 会話中は移動しない
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
/* 位置保存: メモリ(S.worldPos)は毎歩更新、localStorage書込は1.5秒に1回まで。
   重要遷移(ダンジョン/マップ切替/メニュー/離脱)は wldFlushSave() で即時書込。 */
var WLD_SAVE_MIN_MS=1500;
function wldSavePos(x,y){
  if(typeof S==='undefined')return;
  S.worldPos={map:WORLD.curMapId,x:x,y:y};
  var now=Date.now();
  if(!WORLD._lastSave||now-WORLD._lastSave>=WLD_SAVE_MIN_MS){
    WORLD._lastSave=now;
    if(typeof save==='function')save();
  }else{
    WORLD._saveDirty=true;   // 後でflushする
  }
}
function wldFlushSave(){
  if(typeof S==='undefined')return;
  WORLD._lastSave=Date.now(); WORLD._saveDirty=false;
  if(typeof save==='function')save();
}
function wldArrive(){
  var G=WORLD;
  var fromX=G.mfx, fromY=G.mfy;   // 進入元(手前マス)
  G.px=G.mtx;G.py=G.mty;G.ppx=G.px;G.ppy=G.py;G.moving=false;
  var hit=G.spots.find(function(s){return s.gx===G.px&&s.gy===G.py;});
  if(hit){ wldEnterSpot(hit,fromX,fromY); return; }
  wldSavePos(G.px,G.py);
  // 押しっぱなし中は即座に次のタイルへ(スタッター除去: DQ/FFの滑らかな連続歩行)
  if(G.held)wldMove(G.held);
}
function wldEnterSpot(spot,fromX,fromY){
  if(spot.type==='dungeon'){
    // 復帰時に入口上で再侵入しないよう、手前マスを保存位置にする(DQ/FF標準)。
    if(typeof S!=='undefined'){
      var back=(fromX!==undefined&&wldWalkable(fromX,fromY))?{x:fromX,y:fromY}:{x:spot.gx,y:spot.gy};
      S.worldPos={map:WORLD.curMapId,x:back.x,y:back.y}; S.fromWorld=true;
      wldFlushSave();   // 重要遷移は即時書込
    }
    WORLD_hide();
    if(typeof openDmap==='function')openDmap(spot.id);
    else if(typeof toast==='function')toast('入口: '+spot.name,'g');
  }else if(spot.type==='town'){
    // フィールド→町マップへ。戻り先(町マーカーの手前マス)を控える。
    var back=(fromX!==undefined&&wldWalkable(fromX,fromY))?{x:fromX,y:fromY}:{x:spot.gx,y:spot.gy};
    WORLD._returnTo={map:WORLD.curMapId,x:back.x,y:back.y};
    wldChangeMap(spot.to||'town_port');
  }else if(spot.type==='exit'){
    // 町→フィールドへ。控えておいた戻り先(無ければoverworld start)に戻す。
    var ret=WORLD._returnTo||{map:'overworld'};
    WORLD._returnTo=null;
    wldChangeMap(ret.map||'overworld', (ret.x!==undefined)?{x:ret.x,y:ret.y}:null);
  }
}
/* マップ切替: ループを完全停止 → grid差し替え → 再開(プロジェクト版try/catchに依存しない) */
function wldChangeMap(mapId, forceStart){
  WORLD_hide();
  WORLD.talking=false; WORLD.talkNpc=null; WORLD.talkLine=0; wldHideDialog();
  wldBuildMap(mapId, forceStart);
  if(typeof S!=='undefined'){
    S.worldPos={map:WORLD.curMapId,x:WORLD.px,y:WORLD.py};
    S.fromWorld=false;
  }
  wldFlushSave();   // マップ切替は即時書込
  WORLD_show();
}

/* ════════ 会話(DQ式: 正面のNPCに話しかける) ════════ */
// 正面(向いている方向の1マス先)のNPCを返す。斜め向き時は直交方向もフォロー。
function wldFrontNpc(){
  var G=WORLD;
  var d=WLD_DIRS[G.dir]||[0,1];
  var fx=G.px+d[0], fy=G.py+d[1];
  var npc=G.spots.find(function(s){return s.type==='npc'&&s.gx===fx&&s.gy===fy;});
  if(!npc&&d[0]!==0&&d[1]!==0){
    npc=G.spots.find(function(s){return s.type==='npc'&&((s.gx===G.px+d[0]&&s.gy===G.py)||(s.gx===G.px&&s.gy===G.py+d[1]));});
  }
  return npc||null;
}
// 「しらべる/はなす」決定。移動していなければ正面1マスのNPCを探して会話開始。
function wldInteract(){
  var G=WORLD;
  if(G.talking){ wldAdvanceDialog(); return; }  // 会話中なら次の行へ
  if(G.moving)return;
  var npc=wldFrontNpc();
  if(npc)wldStartTalk(npc);
}
function wldStartTalk(npc){
  WORLD.talking=true; WORLD.talkNpc=npc; WORLD.talkLine=0;
  if(typeof wldStopHold==='function')wldStopHold(); // 移動入力を断つ
  wldRenderDialog();
}
function wldAdvanceDialog(){
  var G=WORLD; if(!G.talking||!G.talkNpc)return;
  G.talkLine++;
  var lines=G.talkNpc.lines||[];
  if(G.talkLine>=lines.length){ wldEndTalk(); }
  else { wldRenderDialog(); }
}
function wldEndTalk(){
  WORLD.talking=false; WORLD.talkNpc=null; WORLD.talkLine=0;
  wldHideDialog();
}
function wldRenderDialog(){
  var G=WORLD, npc=G.talkNpc; if(!npc)return;
  var box=document.getElementById('world-dialog'); if(!box)return;
  var lines=npc.lines||[''];
  var line=lines[Math.min(G.talkLine,lines.length-1)]||'';
  var more=(G.talkLine<lines.length-1);
  var nameHtml=npc.name?('<div class="wd-name">'+(npc.icon?npc.icon+' ':'')+npc.name+'</div>'):'';
  box.innerHTML=nameHtml+'<div class="wd-text">'+line+'</div>'+
    '<div class="wd-more">'+(more?'▼ タップで続き':'タップで閉じる')+'</div>';
  box.style.display='block';
}
function wldHideDialog(){
  var box=document.getElementById('world-dialog');
  if(box){ box.style.display='none'; box.innerHTML=''; }
}

/* ════════ メインループ ════════ */
// 「はなす」ボタンは正面にNPCがいる時だけ表示(押しても無反応、を無くす)。DOM更新は状態変化時のみ。
function wldUpdateTalkBtn(){
  var show=!WORLD.talking&&!WORLD.moving&&!!wldFrontNpc();
  if(WORLD._talkBtnShown===show)return;
  WORLD._talkBtnShown=show;
  var b=document.getElementById('world-talk-btn');
  if(b)b.classList.toggle('show',show);
}
function wldLoop(){
  var G=WORLD;
  if(!G.running){G.raf=null;return;}
  try{
    if(G.moving){
      var t=Math.min(1,(Date.now()-G.mstart)/G.mdur),e=wldEase(t);
      G.ppx=G.mfx+(G.mtx-G.mfx)*e;
      G.ppy=G.mfy+(G.mty-G.mfy)*e;
      if(t>=1)wldArrive();
    }
    wldUpdateTalkBtn();
    wldDraw();
  }catch(err){ /* 描画/到着処理で例外が出てもループは止めない(ダンジョン帰還時の固まり防止) */ }
  G.raf=requestAnimationFrame(wldLoop);
}

/* ════════ 入力結線 ════════ */
function wldStopHold(){
  WORLD.held=null;
  if(WORLD.repTimer){clearInterval(WORLD.repTimer);WORLD.repTimer=null;}
}
// 押し続けで連続移動(Dpad・マップタップ共通)。WORLD.held を見て一定間隔で移動する。
function wldStartHold(dir){
  if(WORLD.talking)return;
  WORLD.held=dir; wldMove(dir);
  if(WORLD.repTimer)clearInterval(WORLD.repTimer);
  WORLD.repTimer=setInterval(function(){ if(WORLD.held&&WORLD.running&&!WORLD.talking)wldMove(WORLD.held); },140);
}
// タップ位置(画面座標)→進行方向。プレイヤータイルとの相対位置から8方向を求める。
function wldScreenToDir(clientX,clientY){
  var c=wldGetCanvas(); if(!c)return null;
  var rect=c.getBoundingClientRect();
  if(rect.width<2||rect.height<2)return null;
  var ts=wldTileSize(rect.width,rect.height);
  var cam=wldCamera(rect.width,rect.height,ts);
  var gx=Math.floor(cam.camX+(clientX-rect.left)/ts);
  var gy=Math.floor(cam.camY+(clientY-rect.top)/ts);
  var sx=Math.sign(gx-WORLD.px), sy=Math.sign(gy-WORLD.py);
  if(sx===0&&sy===0)return null; // 自タイル=移動なし
  var map={'0,-1':'up','0,1':'down','-1,0':'left','1,0':'right',
    '-1,-1':'upleft','1,-1':'upright','-1,1':'downleft','1,1':'downright'};
  return map[sx+','+sy]||null;
}
function wldBindControls(){
  document.querySelectorAll('#world-dpad [data-wdir]').forEach(function(b){
    var dir=b.getAttribute('data-wdir');
    b.addEventListener('touchstart',function(e){e.preventDefault();wldStartHold(dir);},{passive:false});
    b.addEventListener('touchend',function(e){e.preventDefault();wldStopHold();},{passive:false});
    b.addEventListener('touchcancel',function(e){wldStopHold();},{passive:false});
    b.addEventListener('mousedown',function(e){e.preventDefault();wldStartHold(dir);});
    b.addEventListener('mouseup',wldStopHold);
    b.addEventListener('mouseleave',wldStopHold);
  });
  // マップタップ移動(連続/ドラッグ操舵)。Dpad表示ON/OFFに関わらず常に有効。
  var c=wldGetCanvas();
  if(c&&!c._tapBound){
    c._tapBound=true;
    var tapHeld=false;
    c.addEventListener('pointerdown',function(e){
      if(!WORLD.running)return;
      if(WORLD.talking){ e.preventDefault(); wldAdvanceDialog(); return; } // 会話中タップは行送り
      var dir=wldScreenToDir(e.clientX,e.clientY);
      if(!dir)return;
      e.preventDefault(); tapHeld=true; wldStartHold(dir);
    });
    c.addEventListener('pointermove',function(e){
      if(!tapHeld||WORLD.talking)return;
      var dir=wldScreenToDir(e.clientX,e.clientY);
      if(dir&&WORLD.held!==dir){ WORLD.held=dir; wldMove(dir); } // ドラッグで方向転換
    });
    var up=function(){ if(tapHeld){tapHeld=false; wldStopHold();} };
    c.addEventListener('pointerup',up);
    c.addEventListener('pointercancel',up);
    c.addEventListener('pointerleave',up);
  }
  // 会話ダイアログ: タップで行送り/閉じる
  var dlg=document.getElementById('world-dialog');
  if(dlg&&!dlg._bound){
    dlg._bound=true;
    dlg.addEventListener('click',function(e){ e.stopPropagation(); wldAdvanceDialog(); });
  }
  // 「はなす/しらべる」決定ボタン
  var talkBtn=document.getElementById('world-talk-btn');
  if(talkBtn&&!talkBtn._bound){
    talkBtn._bound=true;
    talkBtn.addEventListener('click',function(e){ e.preventDefault(); wldInteract(); });
  }
  window.addEventListener('keydown',function(e){
    if(!WORLD.running)return;
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); wldInteract(); return; }
    if(WORLD.talking)return;
    var m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
    if(m){e.preventDefault();wldMove(m);}
  });
}
// Dpad(十字キー)表示の切替。タップ移動は常時有効なのでOFFでもプレイ可能。設定はセーブに永続化。
function wldApplyDpadVisibility(){
  var on=!(typeof S!=='undefined'&&S.settings&&S.settings.dpadVisible===false);
  var dp=document.getElementById('world-dpad'); if(dp)dp.style.display=on?'':'none';
  var tg=document.getElementById('world-dpad-toggle'); if(tg)tg.classList.toggle('off',!on);
}
function wldToggleDpad(){
  if(typeof S==='undefined')return;
  if(!S.settings)S.settings={};
  S.settings.dpadVisible=(S.settings.dpadVisible===false); // false→true / (true・未設定)→false
  if(typeof save==='function')save();
  wldApplyDpadVisibility();
}

/* ════════ メニューオーバーレイ(タブUI #root の開閉) ════════ */
function openMenuOverlay(){
  document.body.classList.add('menu-open');
  WORLD_hide();                       // メニュー中は描画ループ停止(バッテリー節約)
  wldFlushSave();                     // 位置を即時保存
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
  if(typeof S!=='undefined')S.fromWorld=false;
  wldFlushSave();
  WORLD_show();
  // 初回だけ操作ヒント(一度きり)
  if(typeof S!=='undefined'){
    if(!S.flags)S.flags={};
    if(!S.flags.worldHint){
      S.flags.worldHint=1; wldFlushSave();
      if(typeof toast==='function'){
        toast('🏠のマークは町、🔥や🕳はダンジョン。乗ると入れます','gr');
        setTimeout(function(){ if(typeof toast==='function')toast('☰でメニュー、NPCの正面で「はなす」','gr'); },2600);
      }
    }
  }
}

/* ════════ ループ制御 ════════ */
function WORLD_show(){
  // 初回構築: セーブにマップIDがあればそのマップを開く(町で終了→再起動でも復元)
  if(!WORLD.grid){
    var sm=(typeof S!=='undefined'&&S.worldPos&&S.worldPos.map)?S.worldPos.map:'overworld';
    wldBuildMap(sm);
  }
  // 直前の移動アニメ・長押しが残っていてもクリーンに開始する(ダンジョン帰還時の固まり防止)
  WORLD.moving=false;
  WORLD.talking=false; WORLD.talkNpc=null; WORLD.talkLine=0; wldHideDialog();
  if(typeof wldStopHold==='function')wldStopHold();
  // セーブ位置を現在地として反映(同一マップのときのみ。別マップ遷移はwldBuildMapのforceStartで配置済み)
  if(typeof S!=='undefined'&&S.worldPos&&(S.worldPos.map||'overworld')===WORLD.curMapId
     &&wldInBounds(S.worldPos.x,S.worldPos.y)&&wldWalkable(S.worldPos.x,S.worldPos.y)){
    WORLD.px=S.worldPos.x; WORLD.py=S.worldPos.y; WORLD.ppx=WORLD.px; WORLD.ppy=WORLD.py;
  }
  WORLD.running=true; WORLD.t0=Date.now();
  if(typeof wldApplyDpadVisibility==='function')wldApplyDpadVisibility();
  // 既存のループが死んでいても確実に再始動できるよう、古いrafを破棄してから開始する
  if(WORLD.raf){cancelAnimationFrame(WORLD.raf);WORLD.raf=null;}
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
  // アプリ離脱/バックグラウンド移行時に未保存の位置を確実に書き込む(iOSはpagehideが確実)
  var flush=function(){ if(WORLD._saveDirty)wldFlushSave(); };
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden')flush(); });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wldInit);
else wldInit();

/* ════════ ブート ════════ */
/* 全scriptが定義済みになる最後のファイルでゲームを起動する。
   ui.js の init() はここまで実行を遅延させてある(enterWorld等の前方参照を回避)。 */
if(typeof init==='function')init();
