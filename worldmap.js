/* ════════════════════════════════════════════════════════════════════
   WORLD MAP — 「The Archive Atlas / 記憶の地図」 (タイルマップ版)

   ── 手法 ──
   SFC期RPG(FF/ドラクエ)やRPGツクールと同じ「タイルセット＋タイルマップ」方式。
   地形は数値の2次元配列(WMAP.grid)で表現し、各セルに地形タイプIDを持つ。
   タイルの見た目はコードで描画(矩形＋簡易ディテール)。
   将来 assets/world_tiles.png を用意すれば wmDrawTile() を差し替えるだけで
   ドット絵タイルへ移行できる(地形配列・ロジックはそのまま)。

   ── コンセプト ──
   プレイヤーは勉強でなく「忘却の霧に沈んだ世界を修復している」。
   世界は語彙の20アーカイブカテゴリ(元素/モンスター/商業…)がそれぞれ
   1つの「リージョン(地方)」となって地図を構成する。
   そのカテゴリの単語を習熟するほど、その地方の霧が晴れ地形に彩度と光が戻る。
   修復度0% = モノクロの霧、100% = 鮮やかな地形＋輝く拠点。

   ── 既存資産との接続(新データ不要) ──
     WD/WM:単語マスター  CCAT:色  CICON:絵文字  CJP:日本語名
     DD:ダンジョン定義   gsi/gst:マスタリ  ST:段階  openDmap:突入  toast:通知

   ── パフォーマンス(iPhone配慮) ──
   地形は静的なのでオフスクリーンCanvasに一度だけ描いてキャッシュ。
   毎フレームはキャッシュ転写＋動くもの(アバター/拠点の光)のみ。
   修復度が変化したら再キャッシュ。

   ── 公開API ──
     WM_show()/WM_hide()/renderWorldMap()/WM_enter(dungeonId)
════════════════════════════════════════════════════════════════════ */

var WT = { OCEAN:0, WATER:1, SAND:2, GRASS:3, FOREST:4, MOUNT:5, ROAD:6, TOWN:7, SNOW:8 };

var WMAP = {
  canvas:null, ctx:null,
  running:false, raf:null,
  grid:null, region:null,
  GW:18, GH:18,
  regions:[],
  current:null, selected:null,
  avatar:{x:0,y:0},
  moveAnim:null,
  t0:Date.now(),
};

/* ════════ 既存ロジック流用部 ════════ */
function wmDungeonsByCategory(){
  var map={};
  (typeof DD!=='undefined'?DD:[]).forEach(function(d){
    var tally={};
    (d.words||[]).forEach(function(w){
      var wd=(typeof WM!=='undefined')?WM[w]:null;
      if(wd&&wd.archive){tally[wd.archive]=(tally[wd.archive]||0)+1}
    });
    var best=null,bestN=-1;
    for(var c in tally){if(tally[c]>bestN){best=c;bestN=tally[c]}}
    var themeLc=(d.theme||'').toLowerCase();
    for(var cc in (typeof CCAT!=='undefined'?CCAT:{})){ if(themeLc&&cc.toLowerCase()===themeLc){best=cc;break} }
    if(!best)best='Exploration';
    (map[best]=map[best]||[]).push(d);
  });
  return map;
}
function wmCategoryRepair(cat){
  var sum=0,n=0;
  (typeof WD!=='undefined'?WD:[]).forEach(function(w){
    if(w.archive===cat){ sum+=(typeof gsi==='function'?gsi(w.word):0); n++; }
  });
  if(!n)return 0;
  return Math.max(0,Math.min(1, sum/(n*4)));
}
function wmCategoryStats(cat){
  var total=0,discovered=0,mastered=0;
  (typeof WD!=='undefined'?WD:[]).forEach(function(w){
    if(w.archive!==cat)return;
    total++;
    var i=(typeof gsi==='function')?gsi(w.word):0;
    if(i>=1)discovered++;
    if(i>=4)mastered++;
  });
  return {total:total,discovered:discovered,mastered:mastered,repair:wmCategoryRepair(cat)};
}
function wmHash(str){
  var h=2166136261;
  for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0)/4294967295;
}

/* ════════ マップ生成 ════════ */
function wmCollectCategories(){
  var seen={}, cats=[];
  (typeof WD!=='undefined'?WD:[]).forEach(function(w){ if(w.archive&&!seen[w.archive]){seen[w.archive]=1;cats.push(w.archive)} });
  var dmap=wmDungeonsByCategory();
  Object.keys(dmap).forEach(function(c){ if(!seen[c]){seen[c]=1;cats.push(c)} });
  return cats;
}
function wmBiomeFor(cat){
  var lc=(cat||'').toLowerCase();
  if(/fire|element|volcan|forge/.test(lc))return 'volcanic';
  if(/water|ocean|sea|aqua/.test(lc))return 'coast';
  if(/nature|forest|plant|wood/.test(lc))return 'forest';
  if(/ice|snow|frost|cold/.test(lc))return 'snow';
  if(/monster|dark|undead|demon/.test(lc))return 'wasteland';
  if(/desert|sand|commerce|trade/.test(lc))return 'desert';
  if(/mount|rock|material|mineral|mining/.test(lc))return 'mountain';
  return wmHash(cat)>0.5?'plain':'forest';
}
function wmTerrainFromBiome(biome, n, bd){
  var edge = bd>16;
  switch(biome){
    case 'coast':    return edge&&n<0.5?WT.SAND:(n<0.25?WT.WATER:WT.GRASS);
    case 'forest':   return n<0.55?WT.FOREST:(n<0.7?WT.GRASS:(edge?WT.WATER:WT.GRASS));
    case 'mountain': return n<0.5?WT.MOUNT:(n<0.7?WT.GRASS:WT.FOREST);
    case 'snow':     return n<0.6?WT.SNOW:(n<0.8?WT.MOUNT:WT.SNOW);
    case 'desert':   return n<0.7?WT.SAND:(n<0.85?WT.GRASS:WT.MOUNT);
    case 'volcanic': return n<0.45?WT.MOUNT:(n<0.6?WT.SAND:WT.GRASS);
    case 'wasteland':return n<0.4?WT.MOUNT:(n<0.6?WT.SAND:WT.GRASS);
    case 'plain':
    default:         return n<0.65?WT.GRASS:(n<0.8?WT.FOREST:WT.GRASS);
  }
}
function wmBuildLayout(){
  var cats=wmCollectCategories();
  var GW=WMAP.GW, GH=WMAP.GH;
  var perRow=3;
  var rows=Math.ceil(cats.length/perRow);
  WMAP.regions=[];
  var marginX=2, marginY=2;
  var usableW=GW-marginX*2, usableH=GH-marginY*2;
  cats.forEach(function(cat,idx){
    var row=Math.floor(idx/perRow);
    var col=idx%perRow;
    var inRow=Math.min(perRow, cats.length-row*perRow);
    var cx=Math.round(marginX + (inRow>1 ? usableW*(col/(inRow-1)) : usableW/2));
    var cy=Math.round(marginY + (rows>1 ? usableH*(row/(rows-1)) : usableH/2));
    var jx=Math.round((wmHash(cat+'x')-0.5)*2);
    var jy=Math.round((wmHash(cat+'y')-0.5)*2);
    WMAP.regions.push({
      cat:cat,
      cx:Math.max(marginX,Math.min(GW-1-marginX,cx+jx)),
      cy:Math.max(marginY,Math.min(GH-1-marginY,cy+jy)),
      biome:wmBiomeFor(cat),
    });
  });
  WMAP.grid=[]; WMAP.region=[];
  for(var y=0;y<GH;y++){ WMAP.grid[y]=[]; WMAP.region[y]=[]; for(var x=0;x<GW;x++){ WMAP.grid[y][x]=WT.OCEAN; WMAP.region[y][x]=null; } }
  for(var yy=0;yy<GH;yy++)for(var xx=0;xx<GW;xx++){
    if(xx===0||yy===0||xx===GW-1||yy===GH-1){ WMAP.grid[yy][xx]=WT.OCEAN; continue; }
    var best=null,bd=1e9;
    WMAP.regions.forEach(function(r){ var d=(r.cx-xx)*(r.cx-xx)+(r.cy-yy)*(r.cy-yy); if(d<bd){bd=d;best=r} });
    if(!best){ WMAP.grid[yy][xx]=WT.OCEAN; continue; }
    WMAP.region[yy][xx]=best.cat;
    var n=wmHash(best.cat+':'+xx+','+yy);
    WMAP.grid[yy][xx]=wmTerrainFromBiome(best.biome, n, bd);
  }
  WMAP.regions.forEach(function(r){ if(WMAP.grid[r.cy]&&WMAP.grid[r.cy][r.cx]!==undefined)WMAP.grid[r.cy][r.cx]=WT.TOWN; });
  wmConnectRoads();
  var startCat=(typeof S!=='undefined'&&S.wmCurrent)?S.wmCurrent:null;
  if(!startCat||!WMAP.regions.find(function(r){return r.cat===startCat})){
    var b=WMAP.regions[0]?WMAP.regions[0].cat:null, bestR=-1;
    WMAP.regions.forEach(function(r){var v=wmCategoryRepair(r.cat);if(v>bestR){bestR=v;b=r.cat}});
    startCat=b;
  }
  WMAP.current=startCat; WMAP.selected=startCat;
  var cr=WMAP.regions.find(function(r){return r.cat===startCat});
  if(cr){WMAP.avatar.x=cr.cx;WMAP.avatar.y=cr.cy;}
  /* 地形は直接描画方式 */
}
function wmConnectRoads(){
  var rs=WMAP.regions;
  for(var i=0;i<rs.length;i++){
    var best=null,bd=1e9;
    for(var j=0;j<rs.length;j++){ if(i===j)continue; var d=(rs[i].cx-rs[j].cx)*(rs[i].cx-rs[j].cx)+(rs[i].cy-rs[j].cy)*(rs[i].cy-rs[j].cy); if(d<bd){bd=d;best=rs[j]} }
    if(best)wmDrawRoadBetween(rs[i],best);
    var b2=null,bd2=1e9;
    for(var k=0;k<rs.length;k++){ if(k===i||rs[k]===best)continue; var d2=(rs[i].cx-rs[k].cx)*(rs[i].cx-rs[k].cx)+(rs[i].cy-rs[k].cy)*(rs[i].cy-rs[k].cy); if(d2<bd2){bd2=d2;b2=rs[k]} }
    if(b2&&wmHash(rs[i].cat+b2.cat)>0.6)wmDrawRoadBetween(rs[i],b2);
  }
}
function wmDrawRoadBetween(a,b){
  var x=a.cx,y=a.cy;
  function put(x,y){ if(WMAP.grid[y]&&WMAP.grid[y][x]!==undefined){ var t=WMAP.grid[y][x]; if(t!==WT.TOWN&&t!==WT.OCEAN&&t!==WT.WATER)WMAP.grid[y][x]=WT.ROAD; } }
  while(x!==b.cx){ x+=x<b.cx?1:-1; put(x,y); }
  while(y!==b.cy){ y+=y<b.cy?1:-1; put(x,y); }
}
function wmAreNeighbors(a,b){
  if(a===b)return false;
  var GW=WMAP.GW,GH=WMAP.GH;
  for(var y=1;y<GH-1;y++)for(var x=1;x<GW-1;x++){
    if(WMAP.region[y][x]!==a)continue;
    var nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var i=0;i<nb.length;i++){ var dx=nb[i][0],dy=nb[i][1]; if(WMAP.region[y+dy]&&WMAP.region[y+dy][x+dx]===b)return true; }
  }
  return false;
}
function wmRegion(cat){return WMAP.regions.find(function(r){return r.cat===cat})}

/* ════════ Canvas寸法・座標 ════════ */
function wmGetCanvas(){
  if(WMAP.canvas)return WMAP.canvas;
  WMAP.canvas=document.getElementById('wm-canvas');
  if(WMAP.canvas)WMAP.ctx=WMAP.canvas.getContext('2d');
  return WMAP.canvas;
}
function wmSetSize(){
  var c=wmGetCanvas(); if(!c)return null;
  var rect=c.getBoundingClientRect();
  var w=Math.round(rect.width), h=Math.round(rect.height);
  if(w<2||h<2)return null;
  var dpr=window.devicePixelRatio||1;
  if(c._w!==w||c._h!==h||c._dpr!==dpr){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c._w=w;c._h=h;c._dpr=dpr}
  return {w:w,h:h,dpr:dpr};
}
function wmTileSize(w,h){ return Math.floor(Math.min(w/WMAP.GW, h/WMAP.GH)); }
function wmOrigin(w,h,ts){ return { ox:Math.floor((w-ts*WMAP.GW)/2), oy:Math.floor((h-ts*WMAP.GH)/2) }; }
function wmCellToPx(gx,gy,w,h){ var ts=wmTileSize(w,h); var o=wmOrigin(w,h,ts); return {x:o.ox+gx*ts, y:o.oy+gy*ts, ts:ts}; }
function wmPxToCell(px,py,w,h){ var ts=wmTileSize(w,h); var o=wmOrigin(w,h,ts); return {gx:Math.floor((px-o.ox)/ts), gy:Math.floor((py-o.oy)/ts)}; }

/* ════════ カラー ════════ */
function wmHexToRgb(hex){var m=hex.replace('#','');return {r:parseInt(m.slice(0,2),16),g:parseInt(m.slice(2,4),16),b:parseInt(m.slice(4,6),16)};}
function wmMix(c1,c2,t){var a=wmHexToRgb(c1),b=wmHexToRgb(c2);return 'rgb('+Math.round(a.r+(b.r-a.r)*t)+','+Math.round(a.g+(b.g-a.g)*t)+','+Math.round(a.b+(b.b-a.b)*t)+')';}
function wmDesat(hex,amt){var c=wmHexToRgb(hex);var g=Math.round(c.r*0.3+c.g*0.59+c.b*0.11);return 'rgb('+Math.round(c.r+(g-c.r)*amt)+','+Math.round(c.g+(g-c.g)*amt)+','+Math.round(c.b+(g-c.b)*amt)+')';}
var WT_COL={};
WT_COL[WT.OCEAN]='#1c3a6e';WT_COL[WT.WATER]='#2f6fb0';WT_COL[WT.SAND]='#d8c48a';
WT_COL[WT.GRASS]='#5a9e4b';WT_COL[WT.FOREST]='#2f6e38';WT_COL[WT.MOUNT]='#8a7d6b';
WT_COL[WT.ROAD]='#c2a060';WT_COL[WT.TOWN]='#b85c3c';WT_COL[WT.SNOW]='#dfe8f0';

/* ════════ 地形描画 ════════ */
// 旧オフスクリーンキャッシュ方式は廃止し、地形は毎フレーム直接描画する。
// 互換のため wmInvalidateTerrain は残すが、直接描画では何もする必要がない(no-op)。
function wmInvalidateTerrain(){ /* no-op: 直接描画方式ではキャッシュが無いため不要 */ }
function wmDrawTile(ctx, t, px, py, ts, repair, region){
  var base=WT_COL[t]||'#444';
  if(region!==null && t!==WT.OCEAN){
    // 未修復(霧)でも地形のシルエットが分かるよう、彩度・明度の下げ幅に下限を残す。
    var desat=(1-repair)*0.7;
    base=wmDesat(base, desat);
    base=wmMix('#0a0c12', base, 0.42+repair*0.58);
  }
  ctx.fillStyle=base;
  ctx.fillRect(px,py,ts,ts);
  if(t===WT.FOREST){
    ctx.fillStyle=wmMix(base,'#16401d',0.5+repair*0.3);
    var r=Math.max(1,ts*0.16);
    ctx.beginPath();ctx.arc(px+ts*0.35,py+ts*0.4,r,0,7);ctx.arc(px+ts*0.65,py+ts*0.55,r,0,7);ctx.fill();
  }else if(t===WT.MOUNT){
    ctx.fillStyle=wmMix(base,'#ffffff',0.15*repair);
    ctx.beginPath();ctx.moveTo(px+ts*0.5,py+ts*0.2);ctx.lineTo(px+ts*0.8,py+ts*0.8);ctx.lineTo(px+ts*0.2,py+ts*0.8);ctx.closePath();ctx.fill();
  }else if(t===WT.WATER||t===WT.OCEAN){
    ctx.strokeStyle='rgba(255,255,255,0.10)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px+ts*0.2,py+ts*0.6);ctx.lineTo(px+ts*0.5,py+ts*0.6);ctx.stroke();
  }
}
// 地形をメインCanvasに直接描画する(オフスクリーンキャッシュは廃止)。
// iOS Safariで大きなオフスクリーンCanvasのdrawImageが空転送になる不具合を回避するため、
// 324マス程度なら毎フレーム直接描いても軽量(ダンジョン描画と同等オーダー)。
function wmDrawTerrain(ctx,w,h){
  var ts=wmTileSize(w,h); var o=wmOrigin(w,h,ts);
  ctx.fillStyle=WT_COL[WT.OCEAN]; ctx.fillRect(0,0,w,h);
  var repCache={};
  for(var gy=0;gy<WMAP.GH;gy++)for(var gx=0;gx<WMAP.GW;gx++){
    var t=WMAP.grid[gy][gx];
    var reg=WMAP.region[gy][gx];
    var rep=0; if(reg!==null){ rep=(repCache[reg]!==undefined)?repCache[reg]:(repCache[reg]=wmCategoryRepair(reg)); }
    wmDrawTile(ctx, t, o.ox+gx*ts, o.oy+gy*ts, ts, rep, reg);
  }
  WMAP.regions.forEach(function(r){
    var rep=(repCache[r.cat]!==undefined)?repCache[r.cat]:wmCategoryRepair(r.cat);
    var icon=(typeof CICON!=='undefined'&&CICON[r.cat])?CICON[r.cat]:'🏰';
    var px=o.ox+r.cx*ts, py=o.oy+r.cy*ts;
    ctx.globalAlpha=0.4+rep*0.6;
    ctx.font=Math.max(10,Math.floor(ts*0.8))+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(rep<0.05?'？':icon, px+ts/2, py+ts/2);
    ctx.globalAlpha=1;
  });
}

/* ════════ メイン描画 ════════ */
function wmDraw(){
  var size=wmSetSize(); if(!size)return;
  var w=size.w,h=size.h,dpr=size.dpr;
  var ctx=WMAP.ctx;
  if(!WMAP.grid)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  wmDrawTerrain(ctx,w,h); // 地形を直接描画
  var ts=wmTileSize(w,h); var o=wmOrigin(w,h,ts);
  var tnow=(Date.now()-WMAP.t0)/1000;
  if(WMAP.selected){
    var rsel=wmRegion(WMAP.selected);
    if(rsel){ var spx=o.ox+rsel.cx*ts,spy=o.oy+rsel.cy*ts;
      ctx.strokeStyle='#c8a84b'; ctx.lineWidth=2.5; ctx.strokeRect(spx+1,spy+1,ts-2,ts-2);
    }
  }
  WMAP.regions.forEach(function(r){
    var rep=wmCategoryRepair(r.cat);
    if(rep<=0.02)return;
    var px=o.ox+r.cx*ts+ts/2, py=o.oy+r.cy*ts+ts/2;
    var pulse=0.5+0.5*Math.sin(tnow*2+r.cx);
    var col=(typeof CCAT!=='undefined'&&CCAT[r.cat])?CCAT[r.cat]:'#c8a84b';
    var a1=Math.round(40+rep*pulse*120); if(a1>255)a1=255;
    var grad=ctx.createRadialGradient(px,py,0,px,py,ts*(0.7+rep));
    grad.addColorStop(0, col+(a1.toString(16).length<2?'0':'')+a1.toString(16));
    grad.addColorStop(1, col+'00');
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.arc(px,py,ts*(0.7+rep),0,Math.PI*2);ctx.fill();
  });
  var apx=o.ox+WMAP.avatar.x*ts+ts/2, apy=o.oy+WMAP.avatar.y*ts+ts/2;
  var pulse=0.5+0.5*Math.sin(tnow*3);
  ctx.beginPath();ctx.arc(apx,apy,ts*0.42+pulse*ts*0.08,0,Math.PI*2);
  ctx.strokeStyle='#c8a84b';ctx.globalAlpha=0.4+pulse*0.4;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;
  ctx.beginPath();ctx.arc(apx,apy,Math.max(7,ts*0.3),0,Math.PI*2);
  ctx.fillStyle='#fff7e0';ctx.fill();
  ctx.fillStyle='#04060c';ctx.font=Math.max(10,Math.floor(ts*0.38))+'px sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🧭',apx,apy+1);
}

/* ════════ 移動アニメ ════════ */
function wmMoveTo(cat){
  var from=wmRegion(WMAP.current);
  var to=wmRegion(cat);
  if(!to)return;
  if(!from){ WMAP.current=cat; WMAP.avatar.x=to.cx; WMAP.avatar.y=to.cy; wmPersist(); return; }
  WMAP.moveAnim={fromX:from.cx,fromY:from.cy,toX:to.cx,toY:to.cy,start:Date.now(),dur:480,cat:cat};
}
function wmEaseOut(t){return 1-Math.pow(1-t,3)}
function wmPersist(){ if(typeof S!=='undefined'){ S.wmCurrent=WMAP.current; if(typeof save==='function')save(); } }

/* ════════ メインループ ════════ */
function wmLoop(){
  if(!WMAP.running)return;
  if(WMAP.moveAnim){
    var a=WMAP.moveAnim,t=Math.min(1,(Date.now()-a.start)/a.dur),e=wmEaseOut(t);
    WMAP.avatar.x=a.fromX+(a.toX-a.fromX)*e;
    WMAP.avatar.y=a.fromY+(a.toY-a.fromY)*e;
    if(t>=1){ WMAP.current=a.cat; WMAP.moveAnim=null; wmPersist(); wmRenderPanel(); }
  }
  wmDraw();
  WMAP.raf=requestAnimationFrame(wmLoop);
}

/* ════════ タップ処理 ════════ */
function wmHandleTap(clientX,clientY){
  var c=wmGetCanvas(); if(!c||!WMAP.grid)return;
  var rect=c.getBoundingClientRect();
  var px=clientX-rect.left, py=clientY-rect.top, w=rect.width, h=rect.height;
  var cell=wmPxToCell(px,py,w,h);
  var gx=cell.gx, gy=cell.gy;
  if(gx<0||gy<0||gx>=WMAP.GW||gy>=WMAP.GH)return;
  var cat=WMAP.region[gy] ? WMAP.region[gy][gx] : null;
  var nearTown=null,nd=1e9;
  WMAP.regions.forEach(function(r){ var d=(r.cx-gx)*(r.cx-gx)+(r.cy-gy)*(r.cy-gy); if(d<=2&&d<nd){nd=d;nearTown=r} });
  if(nearTown)cat=nearTown.cat;
  if(!cat)return;
  if(cat===WMAP.current){ WMAP.selected=cat; wmRenderPanel(); return; }
  if(wmAreNeighbors(WMAP.current,cat)){ WMAP.selected=cat; wmMoveTo(cat); wmRenderPanel(); }
  else { WMAP.selected=cat; wmRenderPanel(true); }
}

/* ════════ 下部パネル ════════ */
function wmRenderPanel(notReachable){
  var panel=document.getElementById('wm-panel'); if(!panel)return;
  var cat=WMAP.selected; if(!cat){panel.innerHTML='';return}
  var st=wmCategoryStats(cat);
  var jp=(typeof CJP!=='undefined'&&CJP[cat])?CJP[cat]:cat;
  var icon=(typeof CICON!=='undefined'&&CICON[cat])?CICON[cat]:'🏰';
  var catCol=(typeof CCAT!=='undefined'&&CCAT[cat])?CCAT[cat]:'#6a7090';
  var pct=Math.round(st.repair*100);
  var dmap=wmDungeonsByCategory();
  var dungeons=dmap[cat]||[];
  var here=cat===WMAP.current;
  var html='';
  html+='<div class="wm-p-head">';
  html+='<span class="wm-p-icon" style="background:'+catCol+'22;border-color:'+catCol+'">'+icon+'</span>';
  html+='<div class="wm-p-title"><div class="wm-p-name">'+jp+'の地</div>';
  html+='<div class="wm-p-sub">'+cat+'　'+(here?'<b style="color:var(--accent-gold,#c8a84b)">現在地</b>':(notReachable?'<span style="color:var(--text-dim,#445070)">（道が繋がっていない）</span>':''))+'</div></div>';
  html+='</div>';
  html+='<div class="wm-p-bar"><div class="wm-p-bar-fill" style="width:'+pct+'%;background:'+catCol+'"></div></div>';
  html+='<div class="wm-p-stats">修復度 <b style="color:'+catCol+'">'+pct+'%</b>　・　発見 '+st.discovered+'/'+st.total+'　・　マスター '+st.mastered+'</div>';
  if(dungeons.length){
    html+='<div class="wm-p-dungeons">';
    dungeons.forEach(function(d){
      var canEnter=here;
      html+='<button class="wm-dn-btn'+(canEnter?'':' wm-dn-locked')+'" '+(canEnter?'onclick="WM_enter(\''+d.id+'\')"':'')+'>'+
            '<span class="wm-dn-name">⚔ '+(d.name||d.id)+'</span>'+
            '<span class="wm-dn-meta">'+(d.difficulty||'')+'　'+(d.sessionLength||'')+'</span></button>';
    });
    html+='</div>';
    if(!here)html+='<div class="wm-p-hint">この地へ移動すると挑戦できます（隣の土地をタップ）</div>';
  }else{
    html+='<div class="wm-p-hint">この地にはまだダンジョンが見つかっていない。語彙を集めて霧を晴らそう。</div>';
  }
  panel.innerHTML=html;
}

/* ════════ ダンジョン突入 ════════ */
function WM_enter(dungeonId){
  if(typeof openDmap==='function'){ WM_hide(); openDmap(dungeonId); return; }
  if(typeof WM_onEnterDungeon==='function'){ WM_hide(); WM_onEnterDungeon(dungeonId); return; }
  if(typeof toast==='function')toast('ダンジョン入口: '+dungeonId,'g');
  else alert('Enter dungeon: '+dungeonId);
}

/* ════════ 公開 ════════ */
function renderWorldMap(){ wmInvalidateTerrain(); wmDraw(); wmRenderPanel(WMAP.selected!==WMAP.current && !wmAreNeighbors(WMAP.current,WMAP.selected)); }
function WM_show(){
  if(!wmGetCanvas())return;
  if(!WMAP.grid)wmBuildLayout();
  WMAP.running=true; WMAP.t0=Date.now();
  wmInvalidateTerrain(); // 表示のたびにキャッシュを無効化し、現在の実寸で焼き直す
  wmRenderPanel();
  if(!WMAP.raf)wmLoop();
}
function WM_hide(){ WMAP.running=false; if(WMAP.raf){cancelAnimationFrame(WMAP.raf);WMAP.raf=null} }

/* ════════ イベント結線(モバイル対応) ════════ */
function wmInit(){
  var c=wmGetCanvas(); if(!c)return;
  var touchHandled=0, startX=0,startY=0,moved=false;
  var TAP_SLOP=12;
  c.addEventListener('touchstart', function(ev){ if(ev.touches&&ev.touches[0]){startX=ev.touches[0].clientX;startY=ev.touches[0].clientY;moved=false;} },{passive:true});
  c.addEventListener('touchmove', function(ev){ if(ev.touches&&ev.touches[0]){var dx=ev.touches[0].clientX-startX,dy=ev.touches[0].clientY-startY;if(Math.hypot(dx,dy)>TAP_SLOP)moved=true;} },{passive:true});
  c.addEventListener('touchend', function(ev){ touchHandled=Date.now(); if(moved)return; var t=ev.changedTouches&&ev.changedTouches[0]; if(t)wmHandleTap(t.clientX,t.clientY); },{passive:true});
  c.addEventListener('click', function(ev){ if(Date.now()-touchHandled<700)return; wmHandleTap(ev.clientX,ev.clientY); });
  var onResize=function(){ if(WMAP.running){ wmInvalidateTerrain(); wmDraw(); } };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', function(){setTimeout(onResize,120)});
  if(window.visualViewport)window.visualViewport.addEventListener('resize', onResize);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wmInit);
else wmInit();
