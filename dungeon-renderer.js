/* ════════════════════════════════════════════════
   DUNGEON RENDERER — 描画層(DOM実装)
   dungeon.js(ゲームロジック)から分離。Renderer.xxx() という
   インターフェースを介して呼ばれる。CSS/HTML(index.html, style.css)に
   関わる変更はこのファイルだけで完結する。
   将来Canvas化する場合は、このファイルと同じメソッド名を持つ
   CanvasRenderer を別ファイルに用意し、最後の1行を
   'let Renderer=CanvasRenderer;' に変えるだけで差し替えられる。
   ※ index.html では dungeon.js より前に読み込むこと(Rendererの参照に必要)。
════════════════════════════════════════════════ */
/* ════ Phase25: 描画層の抽象化(DOM↔Canvas切替を見据えたRenderer分離) ════
   方針: ロジック側(dmRender, dmLog等)は「何を描くか」を計算してプレーンなデータにし、
   Renderer.xxx(data) を呼ぶだけにする。「どう描くか」(実際のDOM/Canvas操作)は
   DomRenderer側に閉じ込める。将来Canvas化する場合は、同じメソッド名を持つ
   CanvasRendererを作って Renderer=CanvasRenderer と差し替えるだけで良い。
   スコープ: ダンジョン画面(dmov)内の表示全体(グリッド/ミニマップ/HUD/ログ/階段確認/
   イベント選択)。キー入力やボタンのイベントバインディング(入力層)は対象外。 */
const DomRenderer={
  // ── ダンジョンビューの開閉 ──
  openDungeonView(title){
    document.getElementById('dm-title').textContent=title;
    document.getElementById('dmov').classList.add('show');
  },
  closeDungeonView(){
    document.getElementById('dmov').classList.remove('show');
    document.getElementById('event-ov')?.classList.remove('show');
    document.getElementById('stairs-ov')?.classList.remove('show');
    document.getElementById('char-menu-ov')?.classList.remove('show');
  },
  isDungeonViewOpen(){
    return !!document.getElementById('dmov')?.classList.contains('show');
  },
  // ── グリッド ──
  // cells: VW*VH個の {outOfBounds} | {fog} | {cls,icon,bright} の配列(描画順=左上→右下)
  // actionBtn: {text,bg,color}
  renderGrid(cells,actionBtn){
    const gc=document.getElementById('dm-grid');
    if(gc){
      gc.innerHTML=cells.map(c=>{
        if(c.outOfBounds)return `<div class="dc dwa"></div>`;
        if(c.fog)return `<div class="dc dfo"></div>`;
        return `<div class="dc ${c.cls}" style="filter:brightness(${c.bright})">${c.icon}</div>`;
      }).join('');
    }
    const ab=document.getElementById('dm-act');
    if(ab){
      ab.textContent=actionBtn.text;
      ab.style.background=actionBtn.bg;
      ab.style.color=actionBtn.color;
    }
  },
  updatePlayerSprite(bgPosition){
    const el=document.querySelector('#dm-grid .player-sprite');
    if(el)el.style.backgroundPosition=bgPosition;
  },
  // フローティングダメージ表示に必要なセル寸法(セル幅・gap・padding)を返す。
  // Canvas版ではCanvas自体の固定セルサイズから計算する形に置き換わる想定。
  getCellMetrics(){
    const frame=document.getElementById('dm-grid-frame');
    const grid=document.getElementById('dm-grid');
    if(!frame||!grid)return {cw:44,gap:2,padLeft:10,padTop:10};
    const cellEl=grid.querySelector('.dc');
    return {
      cw:cellEl?cellEl.offsetWidth:44,
      gap:parseFloat(getComputedStyle(grid).gap)||2,
      padLeft:parseFloat(getComputedStyle(frame).paddingLeft)||10,
      padTop:parseFloat(getComputedStyle(frame).paddingTop)||10,
    };
  },
  showFloatDamage(x,y,text,kind){
    const frame=document.getElementById('dm-grid-frame');
    if(!frame)return;
    const el=document.createElement('div');
    el.className='dmg-float '+(kind||'enemy');
    el.textContent=text;
    el.style.left=x+'px';
    el.style.top=y+'px';
    frame.appendChild(el);
    setTimeout(()=>el.remove(),900);
  },
  showFloorFlash(label){
    const el=document.getElementById('floor-flash');
    if(!el)return;
    el.textContent=label;
    el.classList.remove('show');
    void el.offsetWidth; // リフローで再トリガー可能にする(連続階層移動でも毎回再生される)
    el.classList.add('show');
  },
  showRareFind(){
    const el=document.getElementById('rare-flash');
    if(!el)return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  },
  // ── ミニマップ ──
  // cells: GW*GH個のCSSクラス名の配列
  renderMinimap(cells){
    const mm=document.getElementById('dm-minimap');
    if(!mm)return;
    mm.innerHTML=cells.map(cls=>`<div class="dmm ${cls}"></div>`).join('');
  },
  // ── HUD ──
  updateHud(data){
    const jobEl=document.getElementById('dmh-job');if(jobEl)jobEl.textContent=data.job;
    const ef=document.getElementById('dmh-ef');if(ef)ef.style.width=data.expPct+'%';
    const el=document.getElementById('dmh-el');if(el)el.textContent=data.expLabel;
    const w=document.getElementById('dmh-w');if(w)w.textContent=data.words;
    const gld=document.getElementById('dmh-g');if(gld)gld.textContent=data.gold;
    const ap=document.getElementById('dmh-ap');if(ap)ap.textContent=data.ap;
    const inv=document.getElementById('dmh-inv');if(inv)inv.textContent=data.inv;
    const gem=document.getElementById('dmh-gem');if(gem)gem.textContent=data.gems;
    const hpFill=document.getElementById('dm-hpfill2');
    const hpTxt=document.getElementById('dm-hptxt2');
    if(hpFill&&hpTxt){
      hpFill.style.width=data.hpPct+'%';
      hpFill.style.background=data.hpLow
        ?'linear-gradient(90deg,#c84b4b,#ff6a6a)'
        :'linear-gradient(90deg,var(--green),#7ae0a0)';
      hpTxt.textContent=data.hpLabel;
    }
  },
  setFloorLabel(text){
    const el=document.getElementById('dm-floor');
    if(el)el.textContent=text;
  },
  // ── ログ ──
  renderLog(lines){
    const el=document.getElementById('dm-log');
    if(el)el.innerHTML=lines.map(l=>`<div class="dm-log-line">${l}</div>`).join('');
  },
  // ── 階段確認モーダル ──
  showStairsConfirm(title,desc){
    document.getElementById('stairs-title').textContent=title;
    document.getElementById('stairs-desc').textContent=desc;
    document.getElementById('stairs-ov').classList.add('show');
  },
  hideStairsConfirm(){
    document.getElementById('stairs-ov').classList.remove('show');
  },
  // ── イベント選択モーダル ──
  showEventChoice(){
    const ov=document.getElementById('event-ov');
    if(ov)ov.classList.add('show');
  },
  hideEventChoice(){
    const ov=document.getElementById('event-ov');
    if(ov)ov.classList.remove('show');
  },
};
let Renderer=DomRenderer; // 将来: Renderer=CanvasRenderer; で差し替え可能
