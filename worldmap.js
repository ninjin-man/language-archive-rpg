/* ════════════════════════════════════════════════════════════════════
   WORLD MAP — 「The Archive Atlas / 記憶の地図」  (Canvas実装)

   ── コンセプト ──
   プレイヤーは勉強しているのではなく「忘却の霧に沈んだ世界を修復している」。
   世界は語彙の20アーカイブカテゴリ(Elements/Monsters/Commerce…)が
   それぞれ1つの「リージョン(土地)」となって構成される。
   そのカテゴリの単語を発見・習熟するほど、土地を覆う霧が晴れ、
   カテゴリ固有の色と光が戻る。マスタリ平均 = その土地の「修復度(0〜1)」。

   ── 既存資産との接続(新データ不要) ──
     WD     : 単語マスター(各wordは archive フィールドを持つ)
     CCAT   : カテゴリ→色      (data.js)
     CICON  : カテゴリ→絵文字  (data.js)
     CJP    : カテゴリ→日本語名(data.js)
     DD     : ダンジョン定義(theme/words を持つ)
     gst/gsi: 単語のマスタリ状態取得 (save.js)
     ST     : ['unknown','discovered','learned','skilled','master']
     toast  : 通知 (ui.js)
   これらをそのまま読むだけで成立する。worldmap.js は他ファイルを改変しない。

   ── 描画 ──
   #wm-canvas に対し、ダンジョンのCanvasRendererと同じ思想で全描画。
   ・背景: 深宇宙グラデ + ゆっくり流れる星屑(修復が進むほど明るい)
   ・パス: カテゴリ間を結ぶ固定レイアウトの経路(両端が修復済みほど明るい)
   ・ノード: リージョン。霧(修復度が低い)→ 色と光が戻る(修復度が高い)
   ・アバター: 現在地ノード上。タップした隣接ノードへ補間移動(rAF)
   ・選択中ノード: そのカテゴリのダンジョン入口/修復度パネルを下部に表示

   ── 公開API ──
     WM_show()        : ワールドマップ画面を表示し描画開始
     WM_hide()        : 非表示(描画ループ停止)
     renderWorldMap() : 1フレーム再描画(状態変化時に外部から呼べる)
     WM_onEnterDungeon(dungeonId) : ダンジョン入口タップ時のフック
            (未定義ならデフォルトで toast。メインHTML側で上書き推奨)

   ── 読み込み順 ──
     data.js → save.js → ui.js → (dungeon系) → worldmap.js(このファイル)

   ── ロールバック ──
   このファイルを外し、ナビの「世界」ボタンと #wm-screen を消すだけで
   既存挙動に完全に戻る(他ファイルは無傷)。
════════════════════════════════════════════════════════════════════ */

const WMAP = {
  canvas:null, ctx:null,
  running:false, raf:null,
  nodes:[],          // [{cat,x,y, ...layout}]   x,y は仮想座標(0..1000)
  edges:[],          // [[catA,catB], ...]
  current:null,      // 現在地カテゴリ
  selected:null,     // 選択中カテゴリ
  avatar:{x:0,y:0},  // アバターの仮想座標(補間で動く)
  moveAnim:null,     // {fromX,fromY,toX,toY,start,dur}
  t0:Date.now(),     // 星屑アニメ用の基準時刻
};

/* ── カテゴリ → ダンジョン の対応(theme/words から導出) ──
   DD の各ダンジョンを、最も多く含む単語の archive カテゴリに割り当てる。
   さらに theme 名がカテゴリ名(小文字)を含む場合はそれを優先。 */
function wmDungeonsByCategory(){
  const map={}; // cat -> [dungeon,...]
  (typeof DD!=='undefined'?DD:[]).forEach(d=>{
    // 1) words から多数決でカテゴリを推定
    const tally={};
    (d.words||[]).forEach(w=>{
      const wd=(typeof WM!=='undefined')?WM[w]:null;
      if(wd&&wd.archive){tally[wd.archive]=(tally[wd.archive]||0)+1}
    });
    let best=null,bestN=-1;
    for(const c in tally){if(tally[c]>bestN){best=c;bestN=tally[c]}}
    // 2) theme がカテゴリ名に一致するなら優先
    const themeLc=(d.theme||'').toLowerCase();
    for(const c in CCAT){ if(themeLc&&c.toLowerCase()===themeLc){best=c;break} }
    if(!best)best='Exploration';
    (map[best]=map[best]||[]).push(d);
  });
  return map;
}

/* ── そのカテゴリの修復度(0..1) ──
   カテゴリに属する全単語のマスタリ index(0..4) の平均を 4 で割った値。
   単語が存在しないカテゴリは 0。 */
function wmCategoryRepair(cat){
  let sum=0,n=0;
  (typeof WD!=='undefined'?WD:[]).forEach(w=>{
    if(w.archive===cat){ sum+=(typeof gsi==='function'?gsi(w.word):0); n++; }
  });
  if(!n)return 0;
  return Math.max(0,Math.min(1, sum/(n*4)));
}
function wmCategoryStats(cat){
  let total=0,discovered=0,mastered=0;
  (typeof WD!=='undefined'?WD:[]).forEach(w=>{
    if(w.archive!==cat)return;
    total++;
    const i=(typeof gsi==='function')?gsi(w.word):0;
    if(i>=1)discovered++;
    if(i>=4)mastered++;
  });
  return {total,discovered,mastered,repair:wmCategoryRepair(cat)};
}

/* ── 決定論ハッシュ(カテゴリ名→数値)。レイアウトの再現性のため ── */
function wmHash(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0)/4294967295; // 0..1
}

/* ── ノード/エッジのレイアウト構築 ──
   実在カテゴリ(WDに1語以上 or DDに紐づく)のみを配置。
   行(row)ごとに並べた“層状”レイアウト。各カテゴリは決定論的に左右へ散らす。
   エッジは「隣接行のノードを近い順に1〜2本接続」+「同行の隣を弱接続」。 */
function wmBuildLayout(){
  // 実在カテゴリを収集(WDに登場するものを採用、登場順を保つ)
  const seen=new Set(), cats=[];
  (typeof WD!=='undefined'?WD:[]).forEach(w=>{ if(w.archive&&!seen.has(w.archive)){seen.add(w.archive);cats.push(w.archive)} });
  // ダンジョン由来のカテゴリも漏れなく追加
  const dmap=wmDungeonsByCategory();
  Object.keys(dmap).forEach(c=>{ if(!seen.has(c)){seen.add(c);cats.push(c)} });

  // 層状配置: 1行あたり最大3カテゴリ。仮想座標系 0..1000(正方)。
  const perRow=3;
  const rows=Math.ceil(cats.length/perRow);
  const VS=1000;
  const marginY=120, rowGap=(VS-marginY*2)/Math.max(1,rows-1||1);
  WMAP.nodes=[];
  cats.forEach((cat,idx)=>{
    const row=Math.floor(idx/perRow);
    const col=idx%perRow;
    const inRow=Math.min(perRow, cats.length-row*perRow);
    const spanX=760, baseX=(VS-spanX)/2;
    const colGap = inRow>1 ? spanX/(inRow-1) : 0;
    let x = inRow>1 ? baseX+col*colGap : VS/2;
    // 決定論的に左右へ少し散らして“手描き感”を出す
    const jitter=(wmHash(cat)-0.5)*90;
    x=Math.max(90,Math.min(VS-90,x+jitter));
    const y= rows>1 ? marginY+row*rowGap : VS/2;
    WMAP.nodes.push({cat,x,y,row,col});
  });

  // エッジ: 隣接行間を最近傍で結ぶ
  WMAP.edges=[];
  const byRow={};
  WMAP.nodes.forEach(n=>{ (byRow[n.row]=byRow[n.row]||[]).push(n) });
  const rowKeys=Object.keys(byRow).map(Number).sort((a,b)=>a-b);
  for(let r=0;r<rowKeys.length-1;r++){
    const cur=byRow[rowKeys[r]], nxt=byRow[rowKeys[r+1]];
    cur.forEach(a=>{
      // 次行で最も近いノードへ1本、2番目に近いノードへ条件付きで1本
      const sorted=nxt.slice().sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));
      if(sorted[0])WMAP.edges.push([a.cat,sorted[0].cat]);
      if(sorted[1]&&wmHash(a.cat+sorted[1].cat)>0.55)WMAP.edges.push([a.cat,sorted[1].cat]);
    });
    // 次行ノードが上行から1本も来ない孤立を防ぐ
    nxt.forEach(b=>{
      const has=WMAP.edges.some(e=>e[1]===b.cat||e[0]===b.cat);
      if(!has){
        const near=cur.slice().sort((p,q)=>Math.hypot(p.x-b.x,p.y-b.y)-Math.hypot(q.x-b.x,q.y-b.y))[0];
        if(near)WMAP.edges.push([near.cat,b.cat]);
      }
    });
  }
  // 同行内の隣接(弱い横道)
  rowKeys.forEach(rk=>{
    const arr=byRow[rk].slice().sort((a,b)=>a.x-b.x);
    for(let i=0;i<arr.length-1;i++){
      if(wmHash(arr[i].cat+arr[i+1].cat+'h')>0.5)WMAP.edges.push([arr[i].cat,arr[i+1].cat]);
    }
  });

  // 重複エッジ除去
  const ekey=e=>[e[0],e[1]].sort().join('|');
  const eseen=new Set(); WMAP.edges=WMAP.edges.filter(e=>{const k=ekey(e);if(eseen.has(k))return false;eseen.add(k);return true});

  // 現在地: セーブ済みがあれば復元、無ければ最も修復が進んだ(=なじみのある)カテゴリ
  let startCat=(typeof S!=='undefined'&&S.wmCurrent)?S.wmCurrent:null;
  if(!startCat||!WMAP.nodes.find(n=>n.cat===startCat)){
    let best=WMAP.nodes[0]?WMAP.nodes[0].cat:null, bestR=-1;
    WMAP.nodes.forEach(n=>{const r=wmCategoryRepair(n.cat);if(r>bestR){bestR=r;best=n.cat}});
    startCat=best;
  }
  WMAP.current=startCat;
  const cn=WMAP.nodes.find(n=>n.cat===startCat);
  if(cn){WMAP.avatar.x=cn.x;WMAP.avatar.y=cn.y}
  WMAP.selected=startCat;
}

function wmNode(cat){return WMAP.nodes.find(n=>n.cat===cat)}
function wmAreNeighbors(a,b){
  return WMAP.edges.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a));
}

/* ── キャンバスサイズ同期(CSSの実寸に合わせる。ブレークポイント値はJSに持たない) ── */
function wmGetCanvas(){
  if(WMAP.canvas)return WMAP.canvas;
  WMAP.canvas=document.getElementById('wm-canvas');
  if(WMAP.canvas)WMAP.ctx=WMAP.canvas.getContext('2d');
  return WMAP.canvas;
}
function wmSetSize(){
  const c=wmGetCanvas(); if(!c)return null;
  const rect=c.getBoundingClientRect();
  const w=Math.round(rect.width), h=Math.round(rect.height);
  if(w<2||h<2)return null;
  const dpr=window.devicePixelRatio||1;
  if(c._w!==w||c._h!==h||c._dpr!==dpr){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c._w=w;c._h=h;c._dpr=dpr}
  return {w,h,dpr};
}
// 仮想座標(0..1000) → 画面座標。アスペクト比を保ち中央フィット(contain)。
function wmProject(vx,vy,w,h){
  const s=Math.min(w,h)/1000;
  const ox=(w-1000*s)/2, oy=(h-1000*s)/2;
  return {x:ox+vx*s, y:oy+vy*s, s};
}
function wmUnproject(px,py,w,h){
  const s=Math.min(w,h)/1000;
  const ox=(w-1000*s)/2, oy=(h-1000*s)/2;
  return {x:(px-ox)/s, y:(py-oy)/s};
}

/* ── カラーユーティリティ ── */
function wmHexToRgb(hex){
  const m=hex.replace('#','');
  return {r:parseInt(m.slice(0,2),16),g:parseInt(m.slice(2,4),16),b:parseInt(m.slice(4,6),16)};
}
function wmMix(c1,c2,t){ // c1,c2:hex, t:0..1
  const a=wmHexToRgb(c1),b=wmHexToRgb(c2);
  const r=Math.round(a.r+(b.r-a.r)*t),g=Math.round(a.g+(b.g-a.g)*t),bb=Math.round(a.b+(b.b-a.b)*t);
  return `rgb(${r},${g},${bb})`;
}

const WM_COL={
  void1:'#0a0c12', void2:'#0f1220',
  fog:'#1a2030',
  path0:'#151e35', path1:'#2a4080',
  text:'#e8eaf0', dim:'#445070',
  gold:'#c8a84b',
};

/* ── 描画本体 ── */
function wmDraw(){
  const size=wmSetSize(); if(!size)return;
  const {w,h,dpr}=size;
  const ctx=WMAP.ctx;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  // 全体の世界修復度(背景の明るさに反映)
  let gsum=0; WMAP.nodes.forEach(n=>gsum+=wmCategoryRepair(n.cat));
  const worldRepair=WMAP.nodes.length?gsum/WMAP.nodes.length:0;

  // 背景: 深宇宙グラデ
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0, wmMix(WM_COL.void1,'#10152a',worldRepair*0.5));
  bg.addColorStop(1, WM_COL.void2);
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

  // 星屑(修復が進むほど数と明るさが増す)。決定論配置 + ゆっくり明滅。
  const tnow=(Date.now()-WMAP.t0)/1000;
  const starN=Math.round(40+worldRepair*80);
  for(let i=0;i<starN;i++){
    const sx=wmHash('sx'+i)*w, sy=wmHash('sy'+i)*h;
    const tw=0.5+0.5*Math.sin(tnow*0.6+i);
    ctx.globalAlpha=(0.15+0.4*worldRepair)*tw;
    ctx.fillStyle=i%7===0?WM_COL.gold:'#9fb0d8';
    ctx.fillRect(sx,sy,1.5,1.5);
  }
  ctx.globalAlpha=1;

  // パス(エッジ)
  WMAP.edges.forEach(e=>{
    const a=wmNode(e[0]),b=wmNode(e[1]); if(!a||!b)return;
    const ra=wmCategoryRepair(a.cat), rb=wmCategoryRepair(b.cat);
    const lit=Math.min(ra,rb); // 両端が修復されるほど道が明るい
    const pa=wmProject(a.x,a.y,w,h), pb=wmProject(b.x,b.y,w,h);
    ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y);
    ctx.strokeStyle=wmMix(WM_COL.path0,WM_COL.path1,lit);
    ctx.lineWidth=1+lit*2.5;
    if(lit<0.15){ctx.setLineDash([5,4])}else{ctx.setLineDash([])}
    ctx.globalAlpha=0.35+lit*0.55;
    ctx.stroke();
  });
  ctx.setLineDash([]); ctx.globalAlpha=1;

  // ノード(リージョン)
  // 小画面では p.s が小さくなり文字やノードが潰れるため、各サイズに下限(px)を設ける。
  WMAP.nodes.forEach(n=>{
    const p=wmProject(n.x,n.y,w,h);
    const repair=wmCategoryRepair(n.cat);
    const baseR=Math.max(18, p.s*46);               // ノード半径: 最小18px
    const iconPx=Math.max(13, Math.round(baseR*0.95)); // 絵文字: 最小13px
    const namePx=Math.max(11, Math.round(p.s*22));     // 土地名: 最小11px
    const gapName=Math.max(14, p.s*20);                // 名前の縦オフセット
    const catCol=(typeof CCAT!=='undefined'&&CCAT[n.cat])?CCAT[n.cat]:'#6a7090';
    const isCur=n.cat===WMAP.current;
    const isSel=n.cat===WMAP.selected;

    // 修復オーラ(光) — 修復度が高いほど大きく明るい
    if(repair>0.02){
      const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,baseR*(1.4+repair*1.4));
      grad.addColorStop(0, catCol+ (repair>0.5?'55':'33'));
      grad.addColorStop(1, catCol+'00');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(p.x,p.y,baseR*(1.4+repair*1.4),0,Math.PI*2); ctx.fill();
    }

    // 土地の円本体: 霧(暗) → カテゴリ色 へ修復度で補間
    const body=wmMix(WM_COL.fog,catCol,repair);
    ctx.beginPath(); ctx.arc(p.x,p.y,baseR,0,Math.PI*2);
    ctx.fillStyle=body; ctx.globalAlpha=0.92; ctx.fill(); ctx.globalAlpha=1;

    // 霧のベール(修復度が低いほど濃い半透明グレーを上掛け)
    if(repair<1){
      ctx.beginPath(); ctx.arc(p.x,p.y,baseR,0,Math.PI*2);
      ctx.fillStyle=`rgba(10,12,20,${((1-repair)*0.6).toFixed(2)})`; ctx.fill();
    }

    // 枠
    ctx.beginPath(); ctx.arc(p.x,p.y,baseR,0,Math.PI*2);
    ctx.lineWidth=isSel?3:(isCur?2.5:1.5);
    ctx.strokeStyle=isSel?WM_COL.gold:(repair>0.5?catCol:WM_COL.dim);
    ctx.stroke();

    // アイコン(絵文字)。霧が濃いと薄く。
    const icon=(typeof CICON!=='undefined'&&CICON[n.cat])?CICON[n.cat]:'❔';
    ctx.globalAlpha=0.35+repair*0.65;
    ctx.font=`${iconPx}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(repair<0.05?'？':icon, p.x, p.y+1);
    ctx.globalAlpha=1;

    // 土地名(日本語)
    const jp=(typeof CJP!=='undefined'&&CJP[n.cat])?CJP[n.cat]:n.cat;
    ctx.font=`${namePx}px 'Segoe UI',system-ui,sans-serif`;
    ctx.fillStyle=repair>0.05?WM_COL.text:WM_COL.dim;
    ctx.fillText(jp, p.x, p.y+baseR+gapName);

    // 修復度バー(土地の下)
    const bw=baseR*1.8, bh=Math.max(3, p.s*5);
    const bx=p.x-bw/2, by=p.y+baseR+gapName+Math.max(8,p.s*10);
    ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=catCol; ctx.fillRect(bx,by,bw*repair,bh);
  });

  // アバター(現在地マーカー) — 移動補間を反映。小画面でも見える最小サイズを確保。
  const ap=wmProject(WMAP.avatar.x,WMAP.avatar.y,w,h);
  const avR=Math.max(9, ap.s*11), avRing=Math.max(13, ap.s*16);
  const avIcon=Math.max(11, Math.round(ap.s*14));
  const pulse=0.5+0.5*Math.sin(tnow*3);
  ctx.beginPath(); ctx.arc(ap.x,ap.y,avRing+pulse*4,0,Math.PI*2);
  ctx.strokeStyle=WM_COL.gold; ctx.globalAlpha=0.4+pulse*0.4; ctx.lineWidth=2; ctx.stroke();
  ctx.globalAlpha=1;
  ctx.beginPath(); ctx.arc(ap.x,ap.y,avR,0,Math.PI*2);
  ctx.fillStyle='#fff7e0'; ctx.fill();
  ctx.fillStyle='#04060c'; ctx.font=`${avIcon}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🧭', ap.x, ap.y+1);
}

/* ── アバター移動アニメーション ── */
function wmMoveTo(cat){
  const from=WMAP.nodes.find(n=>n.cat===WMAP.current);
  const to=WMAP.nodes.find(n=>n.cat===cat);
  if(!to)return;
  if(!from){ WMAP.current=cat; WMAP.avatar.x=to.x; WMAP.avatar.y=to.y; wmPersist(); return; }
  WMAP.moveAnim={fromX:from.x,fromY:from.y,toX:to.x,toY:to.y,start:Date.now(),dur:420,cat};
}
function wmEaseOut(t){return 1-Math.pow(1-t,3)}

function wmPersist(){
  if(typeof S!=='undefined'){ S.wmCurrent=WMAP.current; if(typeof save==='function')save(); }
}

/* ── メインループ ── */
function wmLoop(){
  if(!WMAP.running)return;
  // 移動補間の更新
  if(WMAP.moveAnim){
    const a=WMAP.moveAnim, t=Math.min(1,(Date.now()-a.start)/a.dur), e=wmEaseOut(t);
    WMAP.avatar.x=a.fromX+(a.toX-a.fromX)*e;
    WMAP.avatar.y=a.fromY+(a.toY-a.fromY)*e;
    if(t>=1){ WMAP.current=a.cat; WMAP.moveAnim=null; wmPersist(); wmRenderPanel(); }
  }
  wmDraw();
  WMAP.raf=requestAnimationFrame(wmLoop);
}

/* ── タップ処理(ノード選択 / 隣接なら移動) ── */
function wmHandleTap(clientX,clientY){
  const c=wmGetCanvas(); if(!c)return;
  const rect=c.getBoundingClientRect();
  const px=clientX-rect.left, py=clientY-rect.top;
  const w=rect.width, h=rect.height;
  // 最も近いノードを当たり判定。
  // 指タップを取りこぼさないよう、ヒット半径は「描画半径＋指の最小ターゲット」を確保する。
  // モバイルのアクセシビリティ指針(タップ標的 約44px)に合わせ、最低でも半径34pxは反応させる。
  const sProj=Math.min(w,h)/1000;
  const hitR=Math.max(34, sProj*52); // 画面が小さくても最小34pxは反応
  let hit=null,hitD=1e9;
  WMAP.nodes.forEach(n=>{
    const p=wmProject(n.x,n.y,w,h);
    const d=Math.hypot(px-p.x,py-p.y);
    if(d<hitR && d<hitD){hitD=d;hit=n}
  });
  if(!hit)return;
  if(hit.cat===WMAP.current){
    WMAP.selected=hit.cat; wmRenderPanel(); return;
  }
  if(wmAreNeighbors(WMAP.current,hit.cat)){
    WMAP.selected=hit.cat;
    wmMoveTo(hit.cat);
    wmRenderPanel();
  }else{
    // 隣接していない: 選択のみ(情報表示)。移動はできない旨を示す。
    WMAP.selected=hit.cat;
    wmRenderPanel(true);
  }
}

/* ── 下部情報パネル(選択中リージョン) ── */
function wmRenderPanel(notReachable){
  const panel=document.getElementById('wm-panel'); if(!panel)return;
  const cat=WMAP.selected; if(!cat){panel.innerHTML='';return}
  const st=wmCategoryStats(cat);
  const jp=(typeof CJP!=='undefined'&&CJP[cat])?CJP[cat]:cat;
  const icon=(typeof CICON!=='undefined'&&CICON[cat])?CICON[cat]:'❔';
  const catCol=(typeof CCAT!=='undefined'&&CCAT[cat])?CCAT[cat]:'#6a7090';
  const pct=Math.round(st.repair*100);
  const dmap=wmDungeonsByCategory();
  const dungeons=dmap[cat]||[];
  const here=cat===WMAP.current;

  let html='';
  html+=`<div class="wm-p-head">`;
  html+=`<span class="wm-p-icon" style="background:${catCol}22;border-color:${catCol}">${icon}</span>`;
  html+=`<div class="wm-p-title"><div class="wm-p-name">${jp}の地</div>`;
  html+=`<div class="wm-p-sub">${cat}　${here?'<b style="color:var(--accent-gold)">現在地</b>':(notReachable?'<span style="color:var(--text-dim)">（道が繋がっていない）</span>':'')}</div></div>`;
  html+=`</div>`;

  html+=`<div class="wm-p-bar"><div class="wm-p-bar-fill" style="width:${pct}%;background:${catCol}"></div></div>`;
  html+=`<div class="wm-p-stats">修復度 <b style="color:${catCol}">${pct}%</b>　・　発見 ${st.discovered}/${st.total}　・　マスター ${st.mastered}</div>`;

  if(dungeons.length){
    html+=`<div class="wm-p-dungeons">`;
    dungeons.forEach(d=>{
      const canEnter=here;
      html+=`<button class="wm-dn-btn${canEnter?'':' wm-dn-locked'}" `+
            `${canEnter?`onclick="WM_enter('${d.id}')"`:''}>`+
            `<span class="wm-dn-name">⚔ ${d.name}</span>`+
            `<span class="wm-dn-meta">${d.difficulty||''}　${d.sessionLength||''}</span>`+
            `</button>`;
    });
    html+=`</div>`;
    if(!here)html+=`<div class="wm-p-hint">この地へ移動すると挑戦できます（隣の土地をタップ）</div>`;
  }else{
    html+=`<div class="wm-p-hint">この地にはまだダンジョンが見つかっていない。語彙を集めて霧を晴らそう。</div>`;
  }
  panel.innerHTML=html;
}

/* ── ダンジョン入口タップ → ダンジョン開始 ──
   このゲームの実際のダンジョン開始関数は openDmap(id)(dungeon.js)。
   ワールドマップから土地のダンジョン入口をタップしたら、描画ループを止めて
   openDmap を直接呼ぶ。openDmap が無い環境(切り離しテスト等)では
   WM_onEnterDungeon フック → toast の順にフォールバックする。 */
function WM_enter(dungeonId){
  if(typeof openDmap==='function'){ WM_hide(); openDmap(dungeonId); return; }
  if(typeof WM_onEnterDungeon==='function'){ WM_hide(); WM_onEnterDungeon(dungeonId); return; }
  if(typeof toast==='function')toast('ダンジョン入口: '+dungeonId,'g');
  else alert('Enter dungeon: '+dungeonId);
}

/* ── 公開: 1フレーム再描画(外部の状態変化時に呼ぶ) ── */
function renderWorldMap(){ wmDraw(); wmRenderPanel(WMAP.selected!==WMAP.current && !wmAreNeighbors(WMAP.current,WMAP.selected)); }

/* ── 公開: 表示/非表示 ── */
function WM_show(){
  if(!wmGetCanvas())return;
  if(!WMAP.nodes.length)wmBuildLayout();
  WMAP.running=true;
  WMAP.t0=Date.now();
  wmRenderPanel();
  if(!WMAP.raf)wmLoop();
}
function WM_hide(){
  WMAP.running=false;
  if(WMAP.raf){cancelAnimationFrame(WMAP.raf);WMAP.raf=null}
}

/* ── イベント結線(モバイル対応) ──
   方針:
   ・touch と click の二重発火を防ぐ。touchで処理したら直後の合成clickを無視する。
   ・touchstart→touchend の移動量が小さいときだけ「タップ」とみなす(スクロール/パン誤爆防止)。
   ・タップ標的が小さくならないよう、ヒット半径は wmHandleTap 側で最低34pxを保証。
   ・端末回転・アドレスバー伸縮で実寸が変わるため resize/orientationchange/visualViewport で再描画。 */
function wmInit(){
  const c=wmGetCanvas(); if(!c)return;

  let touchHandled=0;      // 直近にtouchで処理した時刻(合成click抑制用)
  let startX=0,startY=0,moved=false;
  const TAP_SLOP=12;       // この距離(px)以上動いたらタップではなくスクロール扱い

  c.addEventListener('touchstart', ev=>{
    if(ev.touches&&ev.touches[0]){ startX=ev.touches[0].clientX; startY=ev.touches[0].clientY; moved=false; }
  }, {passive:true});

  c.addEventListener('touchmove', ev=>{
    if(ev.touches&&ev.touches[0]){
      const dx=ev.touches[0].clientX-startX, dy=ev.touches[0].clientY-startY;
      if(Math.hypot(dx,dy)>TAP_SLOP)moved=true;
    }
  }, {passive:true});

  c.addEventListener('touchend', ev=>{
    touchHandled=Date.now();           // この後に来る合成clickを無視させる
    if(moved)return;                   // スクロール/パンだったらタップとして扱わない
    const t=ev.changedTouches&&ev.changedTouches[0];
    if(t)wmHandleTap(t.clientX,t.clientY);
  }, {passive:true});

  // マウス(デスクトップ)用。touch直後の合成clickは無視する。
  c.addEventListener('click', ev=>{
    if(Date.now()-touchHandled<700)return;
    wmHandleTap(ev.clientX,ev.clientY);
  });

  const onResize=()=>{ if(WMAP.running)wmDraw(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', ()=>{ setTimeout(onResize,120); });
  // iOS Safari: アドレスバー伸縮は visualViewport の resize で拾える
  if(window.visualViewport)window.visualViewport.addEventListener('resize', onResize);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wmInit);
else wmInit();
