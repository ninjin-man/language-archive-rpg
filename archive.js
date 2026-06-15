/* ════ ARCHIVE: LAYOUT, RENDERING, TOOLTIP, DETAIL PANEL ════ */
/* ════ ARCHIVE LAYOUT — Grid, grouped by category ════ */
let AL={},selW=null,panOn=false;
function cc(c){return CCAT[c]||'#8090a0'}
function getWords(){return S.filt==='all'?WD:WD.filter(w=>w.archive===S.filt)}

const CELL_W=58,CELL_H=58;  // grid cell size (enlarged for bigger nodes — 改修C)
const PAD_X=24,PAD_Y=20;
const ROW_GAP=38; // extra gap between category rows
const HEADER_H=22;

function computeLayout(){
  const wrap=document.getElementById('arc-wrap');
  const W=wrap.offsetWidth||900;
  AL={};
  const z=arcZoom||1;
  const cw=CELL_W*z,ch=CELL_H*z,rg=ROW_GAP*z,hh=HEADER_H*z;
  const cols=Math.max(3,Math.floor((W-PAD_X*2)/cw));

  if(S.filt==='all'){
    const cats=[...new Set(WD.map(w=>w.archive))];
    let y=PAD_Y;
    cats.forEach(cat=>{
      const ws=WD.filter(w=>w.archive===cat);
      y+=hh;
      ws.forEach((w,i)=>{
        const col=i%cols, row=Math.floor(i/cols);
        AL[w.word]={
          x:PAD_X+col*cw+cw/2,
          y:y+row*ch+ch/2,
          cat, headerY:y-hh/2, headerX:PAD_X
        };
      });
      const rows=Math.ceil(ws.length/cols);
      y+=rows*ch+rg;
    });
    AL.__totalH=y;
  } else {
    const words=getWords();
    let y=PAD_Y+hh;
    words.forEach((w,i)=>{
      const col=i%cols, row=Math.floor(i/cols);
      AL[w.word]={x:PAD_X+col*cw+cw/2,y:y+row*ch+ch/2,cat:w.archive};
    });
    const rows=Math.ceil(words.length/cols);
    AL.__totalH=y+rows*ch+PAD_Y;
  }
}

function renderArc(){
  computeLayout();
  renderEdges();
  renderNodes();
  renderCatList();
  updateHdr();
}

function renderEdges(){
  const svg=document.getElementById('arc-svg');
  const wrap=document.getElementById('arc-wrap');
  const W=wrap.offsetWidth;
  const H=Math.max(wrap.offsetHeight,AL.__totalH||0);
  svg.setAttribute('width',W);svg.setAttribute('height',H);
  const words=getWords();
  const wset=new Set(words.map(w=>w.word));
  const drawn=new Set();
  let mk='';

  // Category section headers + divider lines
  if(S.filt==='all'){
    const cats=[...new Set(words.map(w=>w.archive))];
    const seen=new Set();
    cats.forEach(cat=>{
      const cw=words.filter(w=>w.archive===cat);if(!cw.length)return;
      const p=AL[cw[0].word];if(!p)return;
      const col=cc(cat);
      const kn=cw.filter(w=>gst(w.word)!=='unknown').length;
      mk+=`<line x1="${p.headerX}" y1="${p.headerY+10}" x2="${W-PAD_X}" y2="${p.headerY+10}" stroke="${col}" stroke-width="1" opacity="0.25"/>`;
      mk+=`<text x="${p.headerX}" y="${p.headerY+2}" fill="${col}" font-size="10" font-weight="700" letter-spacing="2">${CICON[cat]||''} ${CJP[cat]||cat.toUpperCase()}</text>`;
      mk+=`<text x="${W-PAD_X}" y="${p.headerY+2}" fill="${col}" font-size="9" font-weight="700" text-anchor="end" opacity="0.7">${kn}/${cw.length}</text>`;
    });
  }

  // Edges: gentle curves, only drawn when at least one endpoint is visible on screen
  words.forEach(w=>{
    const src=AL[w.word];if(!src)return;
    [
      ...(w.relations.related||[]).map(t=>({t,tp:'r'})),
      ...(w.relations.synonyms||[]).map(t=>({t,tp:'s'})),
      ...(w.relations.opposites||[]).map(t=>({t,tp:'o'})),
    ].forEach(({t,tp})=>{
      if(!wset.has(t))return;
      const key=[w.word,t].sort().join('|');
      if(drawn.has(key))return;drawn.add(key);
      const tgt=AL[t];if(!tgt)return;
      const sk=gst(w.word)!=='unknown',tk=gst(t)!=='unknown';
      const vis=sk&&tk;
      const sameCat=WM[t]?.archive===w.archive;
      // Only draw same-category edges (cross-category lines clutter the grid view)
      if(!sameCat)return;
      let stroke='#12162a',op=0.15,width=.8,dash='';
      if(vis){
        if(tp==='s'){stroke=cc(w.archive);op=.6;width=1.3}
        else if(tp==='o'){stroke='#5a1228';op=.45;width=1}
        else{stroke=cc(w.archive)+'55';op=.45;width=1}
      } else{dash='1.5 4';op=.08}
      const mx=(src.x+tgt.x)/2,my=(src.y+tgt.y)/2;
      const dx=tgt.x-src.x,dy=tgt.y-src.y;
      const len=Math.sqrt(dx*dx+dy*dy)||1;
      const curve=Math.min(len*.2,14);
      const cpx=mx+(-dy/len)*curve;
      const cpy=my+(dx/len)*curve;
      mk+=`<path d="M${src.x},${src.y} Q${cpx},${cpy} ${tgt.x},${tgt.y}" stroke="${stroke}" stroke-width="${width}" opacity="${op}" fill="none" stroke-dasharray="${dash}"/>`;
    });
  });

  svg.innerHTML=mk;
}

/* ════ ZOOM (改修C) — recompute layout at scaled cell size, keeps scroll height correct ════ */
let arcZoom=1;
function zoomArc(delta){
  if(delta===0)arcZoom=1;
  else arcZoom=Math.min(1.6,Math.max(0.6,Math.round((arcZoom+delta)*100)/100));
  document.getElementById('arc-wrap').style.setProperty('--an-scale',arcZoom);
  renderArc();
}

/* ── NODE RENDERING — enlarged nodes with label + tooltip (改修C) ── */
function renderNodes(){
  hideTip(); // always clear any stuck tooltip before re-rendering nodes
  const con=document.getElementById('arc-nodes');
  const words=getWords();let html='';
  const trackedWord=getTrackedWord();
  words.forEach(w=>{
    const p=AL[w.word];if(!p)return;
    const si=gsi(w.word);
    const selCls=selW===w.word?' sel':'';
    const trackCls=(trackedWord&&w.word===trackedWord)?' tracked':'';
    const label=si===0?'???':w.word;
    html+=`<div class="an s${si}${selCls}${trackCls}" style="left:${p.x}px;top:${p.y}px"
      data-word="${w.word}"
      onclick="selNode('${w.word}')"
      onmouseenter="showTip(event,'${w.word}')"
      onmouseleave="hideTip()">
      <div class="an-dot">
        <span class="an-ico">${label}</span>
      </div>
    </div>`;
  });
  con.innerHTML=html;
  // Ensure scroll container is tall enough for full grid
  con.style.height=(AL.__totalH||600)+'px';
  document.getElementById('arc-svg').style.height=(AL.__totalH||600)+'px';
}

/* ── TOOLTIP — hover popup (replaces the need for text on node) ── */
const TIP=document.getElementById('arc-tip');
let tipTimer=null;
function showTip(e,word){
  const w=WM[word];if(!w)return;
  const si=gsi(word);
  const unk=si===0;
  const col=cc(w.archive);
  const rcol=RCOL[w.rarity]||'#6a7090';
  const mcols=['#1e2440','#4dc8e0','#1e5090','#c8a84b','#e0982a'];

  // Related words preview (known ones)
  const rel=(w.relations.related||[]).slice(0,4);
  const relHtml=rel.map(r=>{
    const k=gst(r)!=='unknown';
    return `<span class="${k?'tip-known':''}" style="color:${k?col:'#2a2e48'}">${k?r:'???'}</span>`;
  }).join(' · ');

  TIP.innerHTML=unk?`
    <div style="color:var(--t2);font-size:11px">❓ 未発見の単語</div>
    <div style="font-size:9px;color:var(--t3);margin-top:3px">発見するとアーカイブに追加</div>
  `:`
    <div class="tip-word" style="color:${rcol}">${word}</div>
    <div class="tip-jp">${w.meaning}</div>
    <div class="tip-row">
      <span class="tip-bdg tip-pos">${w.pos}</span>
      <span class="tip-bdg tip-cefr">${w.cefr}</span>
      <span class="tip-bdg tip-r-${w.rarity}">${RLBL[w.rarity]}</span>
      <span class="tip-bdg" style="background:${col}22;color:${col};font-size:8px">${CJP[w.archive]||w.archive}</span>
    </div>
    <div class="tip-status" style="color:${mcols[si]}">● ${ST_JP[si]}</div>
    ${rel.length?`<div class="tip-rels">関連語: ${relHtml}</div>`:''}
  `;

  // Position: follow cursor, avoid edges
  const pad=12;
  let tx=e.clientX+16,ty=e.clientY-8;
  TIP.style.display='block';
  TIP.classList.add('vis');
  requestAnimationFrame(()=>{
    const tw=TIP.offsetWidth,th=TIP.offsetHeight;
    const vw=window.innerWidth,vh=window.innerHeight;
    if(tx+tw>vw-pad)tx=e.clientX-tw-12;
    if(ty+th>vh-pad)ty=vh-th-pad;
    if(ty<pad)ty=pad;
    TIP.style.left=tx+'px';TIP.style.top=ty+'px';
  });
}
function hideTip(){
  TIP.classList.remove('vis');
  TIP.style.display='none';
}
// Global safety nets: clear stuck tooltip on scroll, resize, or tap outside a node
document.getElementById('arc-wrap').addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('click',e=>{ if(!e.target.closest('.an')) hideTip(); });
document.addEventListener('touchstart',e=>{ if(!e.target.closest('.an')) hideTip(); },{passive:true});

function renderCatList(){
  const list=document.getElementById('cat-list');
  const cats=[...new Set(WD.map(w=>w.archive))].sort();
  const total=WD.length,known=nd();
  let html=`<div class="ci ${S.filt==='all'?'on':''}" onclick="setFilt('all')">
    <div class="ci-dot" style="background:var(--gold)"></div>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between">
        <span class="ci-name">すべて</span>
        <span class="ci-pct">${Math.round(known/total*100)}%</span>
      </div>
      <div class="ci-bar"><div class="ci-bar-f" style="width:${Math.round(known/total*100)}%;background:var(--gold)"></div></div>
    </div>
  </div>`;
  cats.forEach(cat=>{
    const tot=WD.filter(w=>w.archive===cat).length;
    const kn=WD.filter(w=>w.archive===cat&&gst(w.word)!=='unknown').length;
    const pct=Math.round(kn/tot*100);
    const col=cc(cat);
    html+=`<div class="ci ${S.filt===cat?'on':''}" onclick="setFilt('${cat}')">
      <div class="ci-dot" style="background:${col}"></div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between">
          <span class="ci-name">${CICON[cat]||'📌'} ${CJP[cat]||cat}</span>
          <span class="ci-pct" style="color:${col}">${pct}%</span>
        </div>
        <div class="ci-bar"><div class="ci-bar-f" style="width:${pct}%;background:${col}"></div></div>
      </div>
    </div>`;
  });
  list.innerHTML=html;
}
function setFilt(cat){S.filt=cat;selW=null;closeDet();hideTip();renderArc();document.getElementById('arc-wrap').scrollTop=0}

/* ════ NODE SELECT / DETAIL ════ */
function selNode(word){selW=word;renderNodes();showDet(word)}
function showDet(word){
  const w=WM[word];if(!w)return;
  const si=gsi(word);const unk=si===0;const col=cc(w.archive);
  const mc=['#18203a','#4dc8e0','#1e5090','#c8a84b','#e0982a'];
  document.getElementById('det-top').innerHTML=`
    <div class="det-wr">
      <div class="det-ico" style="border-color:${col};color:${col}">${unk?'❓':(PICO[w.pos]||'📌')}</div>
      <div><div class="det-w">${unk?'???':word}</div><div class="det-j">${unk?'未発見の単語':w.meaning}</div></div>
    </div>
    ${!unk?`<div class="bdgs">
      <span class="bdg bp">${w.pos}</span>
      <span class="bdg bc">${w.cefr}</span>
      <span class="bdg br${w.rarity[0]}">${RLBL[w.rarity]}</span>
      <span class="bdg" style="background:${col}22;color:${col}">${CJP[w.archive]||w.archive}</span>
    </div>`:''}`;
  const pct=si===0?0:Math.round(si/(ST.length-1)*100);
  let body=`<div class="ds">
    <div class="dst">習熟度</div>
    <div class="ms-r"><span style="color:var(--t1)">${ST_JP[si]}</span><span style="color:${mc[si]};font-weight:700">${si}/${ST.length-1}</span></div>
    <div class="ms-b"><div class="ms-f" style="width:${pct}%;background:${mc[si]}"></div></div>
  </div>`;
  if(!unk){
    // Word Level & Evolution (単語進化システム)
    const wlv=getWLv(word);
    const wlvPct=Math.round((wlv.exp||0)/WEXP_PER_LV*100);
    const atCap=wlv.lv>=WLV_CAP;
    body+=`<div class="ds"><div class="dst">単語レベル</div>
      <div class="ms-r"><span style="color:var(--t1)">${word} Lv${wlv.lv} (${wlv.lv}/${WLV_CAP})</span></div>
      ${atCap?`<div style="font-size:9px;color:var(--gold);margin-top:2px">MAX</div>`
        :`<div class="ms-r"><span style="font-size:9px;color:var(--t2)">EXP</span><span style="font-size:9px;color:var(--green)">${wlv.exp||0}/${WEXP_PER_LV}</span></div>
      <div class="ms-b"><div class="ms-f" style="width:${wlvPct}%;background:var(--green)"></div></div>`}
    </div>`;
    const evoTarget=EVOLUTION[word];
    if(evoTarget&&WM[evoTarget]){
      const evoDone=gst(evoTarget)!=='unknown';
      body+=`<div class="ds"><div class="dst">進化</div>
        <div class="evo-cond ${evoDone?'done':''}">${evoDone?`✓ ${evoTarget} 解放済み`:`Lv${WLV_CAP}で「${evoTarget}」解放`}</div>
      </div>`;
    }
    [{k:'related',l:'関連語',c:''},{k:'synonyms',l:'同義語',c:'sy'},{k:'opposites',l:'対義語',c:'op'},{k:'evolution',l:'派生形',c:'ev'},{k:'craft',l:'クラフト先 →',c:'cf'}]
    .forEach(s=>{
      const items=w.relations[s.k]||[];if(!items.length)return;
      body+=`<div class="ds"><div class="dst">${s.l}</div><div class="chips">`;
      items.forEach(item=>{const k=gst(item)!=='unknown';body+=`<span class="chip ${s.c} ${k?'k':''}" onclick="selNode('${item}')">${k?item:'???'}</span>`});
      body+=`</div></div>`;
    });
    // Synonym chain
    const sc=buildSC(word);
    if(sc.length>1){
      body+=`<div class="ds"><div class="dst">類義語チェーン</div><div class="sc">`;
      sc.forEach((sw,i)=>{
        const k=gst(sw)!=='unknown';
        body+=`<div class="sci">${i>0?'<span class="sca">↓</span>':''}<span class="scw ${k?'':'u'}">${k?sw:'???'}</span>${k&&WM[sw]?`<span style="font-size:8px;color:var(--t2);margin-left:3px">${WM[sw].meaning}</span>`:''}</div>`;
      });
      body+=`</div></div>`;
    }
    // Family progress
    const fm=WD.filter(fw=>fw.archive===w.archive);
    const fk=fm.filter(fw=>gst(fw.word)!=='unknown').length;
    body+=`<div class="ds"><div class="dst">${CJP[w.archive]||w.archive} ファミリー</div>
      <div style="font-size:8px;color:var(--t2);margin-bottom:3px">${fk}/${fm.length}</div>
      <div class="fb2">`;
    fm.forEach(fw=>{const fi=gsi(fw.word);const fok=fi>0;
      body+=`<div class="fbb" style="background:${fok?(fi>=3?col:'var(--m2)'):'var(--s4)'};border:1px solid ${fok?col+'44':'var(--b0)'}" title="${fok?fw.word:'???'}"></div>`;
    });
    body+=`</div></div>`;
    if(w.jobs?.length){body+=`<div class="ds"><div class="dst">職業</div><div class="chips">`;w.jobs.forEach(j=>{body+=`<span class="chip">${j}</span>`});body+=`</div></div>`}
    if(w.dungeons?.length){body+=`<div class="ds"><div class="dst">ダンジョン</div><div class="chips">`;w.dungeons.forEach(d=>{body+=`<span class="chip">${d}</span>`});body+=`</div></div>`}
  }
  document.getElementById('det-body').innerHTML=body;
  const ftr=document.getElementById('det-ftr');ftr.style.display='flex';
  const qb=document.getElementById('det-qb');
  if(unk){qb.textContent='🔍 発見する';qb.disabled=false;qb.onclick=()=>{discover(word);showDet(word);renderArc()}}
  else if(si>=ST.length-1){qb.textContent='✦ マスター';qb.disabled=true}
  else{qb.textContent='📝 Quiz +EXP';qb.disabled=false;qb.onclick=startWQ}
}
function closeDet(){selW=null;document.getElementById('det-top').innerHTML='<div style="text-align:center;padding:14px 0;color:var(--t2);font-size:10px">ノードを選択</div>';document.getElementById('det-body').innerHTML='';document.getElementById('det-ftr').style.display='none'}
function buildSC(word){
  const chain=[word];const vis=new Set([word]);let cur=word;
  for(let i=0;i<4;i++){const w=WM[cur];if(!w)break;const s=(w.relations.synonyms||[]).filter(s=>WM[s]&&!vis.has(s));if(!s.length)break;const nx=s.find(s=>gst(s)!=='unknown')||s[0];chain.push(nx);vis.add(nx);cur=nx}
  return chain.length>1?chain:[];
}

/* ════ SCROLL (native — replaces old transform-pan) ════ */
function initPan(){ /* no-op: arc-wrap now uses native overflow-y:auto scrolling */ }
