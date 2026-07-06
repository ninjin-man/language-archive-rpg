/* ════════════════════════════════════════════════════════════════
   SPHERE GRID — FF10-style archive board (Phase A)
   Single-SVG renderer: deterministic layout, viewBox pan/zoom,
   cursor with adjacency-only movement, walk-to-discover.
   Replaces the old archive.js grid entirely.
   Depends on: data.js (WD,WM,CCAT,CICON,CJP,ST,ST_JP,RCOL,RLBL,EVOLUTION,
   WLV_CAP,WEXP_PER_LV), save.js (gst,gsi,getWLv,nd,save,S), ui.js (discover,startWQ).
════════════════════════════════════════════════════════════════ */

const SG = {
  NODE_R: 16,        // node circle radius (world units)
  RING_STEP: 54,     // radial gap between concentric rings inside a cluster
  PER_RING: 6,       // nodes per concentric ring
  svgNS: 'http://www.w3.org/2000/svg',
  pos: {},           // word -> {x,y}
  clusters: {},      // cat  -> {x,y,r,count,words[]}
  adj: {},           // word -> Set(neighbour words)
  bridges: [],       // [{a,b,catA,catB,gate}]  cross-cluster links (gate=ゲートノードID)
  gates: {},         // gateId -> {a,b,x,y,stat:{k,v,icon,lbl},cost}  UX3: FF10式ロックノード
  catColor: {},      // cat -> hex
  built: false,
  vb: null,          // current viewBox {x,y,w,h}
  contentBox: null,  // {minX,minY,w,h} of all nodes
  sel: null,         // selected word
  _drag: null,
  _pinch: null,
};

/* ── deterministic layout build (runs once) ── */
function sgBuild() {
  if (SG.built) return;
  const cats = [...new Set(WD.map(w => w.archive))];
  // colour per category from existing tokens
  cats.forEach(c => { SG.catColor[c] = (typeof CCAT !== 'undefined' && CCAT[c]) || '#8090a0'; });

  // size + order clusters (biggest first, deterministic tiebreak by name)
  const sized = cats.map(cat => ({
    cat, words: WD.filter(w => w.archive === cat)
  })).sort((a, b) => b.words.length - a.words.length || a.cat.localeCompare(b.cat));

  const clusterRadius = n => {
    if (n <= 1) return SG.NODE_R + 6;
    const rings = Math.ceil((n - 1) / SG.PER_RING);
    return rings * SG.RING_STEP + SG.NODE_R + 8;
  };
  const N = sized.length;
  const maxCR = Math.max(...sized.map(s => clusterRadius(s.words.length)));
  const bigR = Math.max(360, (maxCR * 2 * N) / (2 * Math.PI) * 1.15);

  sized.forEach((s, i) => {
    const ang = (2 * Math.PI * i) / N - Math.PI / 2;
    const cx = Math.round(Math.cos(ang) * bigR);
    const cy = Math.round(Math.sin(ang) * bigR);
    SG.clusters[s.cat] = { x: cx, y: cy, r: clusterRadius(s.words.length), count: s.words.length, words: s.words.map(w => w.word) };
    // place words on concentric rings (centre first)
    s.words.forEach((w, idx) => {
      if (idx === 0) { SG.pos[w.word] = { x: cx, y: cy }; return; }
      const k = idx - 1, ring = Math.floor(k / SG.PER_RING) + 1, slot = k % SG.PER_RING;
      const a = (2 * Math.PI * slot) / SG.PER_RING + ring * 0.4, r = ring * SG.RING_STEP;
      SG.pos[w.word] = { x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r) };
    });
  });

  // intra-cluster adjacency: connect each node to its 3 nearest same-cluster neighbours
  cats.forEach(c => SG.clusters[c].words.forEach(w => { SG.adj[w] = SG.adj[w] || new Set(); }));
  cats.forEach(c => {
    const ws = SG.clusters[c].words;
    ws.forEach(w => {
      const near = ws.filter(o => o !== w)
        .map(o => ({ o, d: Math.hypot(SG.pos[w].x - SG.pos[o].x, SG.pos[w].y - SG.pos[o].y) }))
        .sort((a, b) => a.d - b.d).slice(0, 3);
      near.forEach(({ o }) => { SG.adj[w].add(o); SG.adj[o].add(w); });
    });
  });

  // cross-cluster bridges: rank category pairs by shared relations, link nearest node pair.
  const catOf = {}; WD.forEach(w => catOf[w.word] = w.archive);
  const pairScore = {};
  WD.forEach(w => {
    [...(w.relations.related || []), ...(w.relations.synonyms || []), ...(w.relations.opposites || [])]
      .forEach(t => {
        const tc = catOf[t];
        if (tc && tc !== w.archive) {
          const k = [w.archive, tc].sort().join('|');
          pairScore[k] = (pairScore[k] || 0) + 1;
        }
      });
  });
  // connect graph: take pairs in descending strength until every cluster is reachable, plus a few extra
  const ranked = Object.entries(pairScore).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const reach = {}; cats.forEach(c => reach[c] = new Set([c]));
  const merge = (a, b) => { const u = new Set([...reach[a], ...reach[b]]); u.forEach(c => reach[c] = u); };
  ranked.forEach(k => {
    const [a, b] = k.split('|');
    const isBridge = reach[a] !== reach[b];          // needed for connectivity
    const strong = pairScore[k] >= 4;                // or simply a strong link → nicer board
    if (!isBridge && !strong) return;
    // nearest cross-cluster node pair
    const wa = SG.clusters[a].words, wb = SG.clusters[b].words;
    let best = null;
    wa.forEach(x => wb.forEach(y => {
      const d = Math.hypot(SG.pos[x].x - SG.pos[y].x, SG.pos[x].y - SG.pos[y].y);
      if (!best || d < best.d) best = { x, y, d };
    }));
    if (best) {
      // UX3: ブリッジ中点にゲートノード(ステータスノード)を挿入。
      // a-b 直結ではなく a-gate-b とし、ゲート起動(記憶の球を消費)しないと渡れない = FF10式ロック。
      const gid = '@g' + SG.bridges.length;
      const gx = Math.round((SG.pos[best.x].x + SG.pos[best.y].x) / 2);
      const gy = Math.round((SG.pos[best.x].y + SG.pos[best.y].y) / 2);
      const SG_STATS = [
        { k: 'hp',    v: 5, icon: '❤', lbl: 'HP +5' },
        { k: 'atk',   v: 1, icon: '⚔', lbl: 'ATK +1' },
        { k: 'def',   v: 1, icon: '🛡', lbl: 'DEF +1' },
        { k: 'regen', v: 1, icon: '✚', lbl: 'REGEN +1' },
      ];
      const stat = SG_STATS[SG.bridges.length % SG_STATS.length];
      SG.pos[gid] = { x: gx, y: gy };
      SG.gates[gid] = { a: best.x, b: best.y, stat: stat, cost: 2 };
      SG.adj[gid] = new Set([best.x, best.y]);
      SG.adj[best.x].add(gid); SG.adj[best.y].add(gid);
      SG.bridges.push({ a: best.x, b: best.y, catA: a, catB: b, gate: gid });
      if (isBridge) merge(a, b);
    }
  });

  // content bounding box
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  Object.values(SG.pos).forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const m = 60;
  SG.contentBox = { minX: minX - m, minY: minY - m, w: (maxX - minX) + m * 2, h: (maxY - minY) + m * 2 };
  SG.built = true;
}

/* ── cursor (player position on the board) ── */
function sgCursorWord() {
  sgBuild();
  if (S.gridPos && SG.pos[S.gridPos]) return S.gridPos;
  // default start: prefer a discovered word, else cluster centre of largest cluster
  const disc = WD.find(w => gst(w.word) !== 'unknown');
  const start = disc ? disc.word : Object.values(SG.clusters)[0].words[0];
  S.gridPos = start; save();
  return start;
}
function sgIsReachable(word) {
  const cur = sgCursorWord();
  return word === cur || (SG.adj[cur] && SG.adj[cur].has(word));
}

/* ── UX3: ゲート・記憶の球ヘルパー ── */
function sgIsGate(id) { return typeof id === 'string' && id.charAt(0) === '@'; }
function sgGateOn(id) { return !!(S.sgGates && S.sgGates[id]); }
function sgSpheres() { return S.spheres || 0; }
/* ── FF10化: スフィアレベル(移動力)と球種 ──
   Web調査による正仕様: 移動は未発動ノード1.0/発動済み0.25のS.Lv消費(既踏割引の読み替え)。
   S.Lvは敵撃破AP(10APで+1,上限99)。発動は「今いるマスか隣接マス」に対し移動せず行える。
   球種: 記憶の球=単語(アビリティスフィア相当)、力の球=攻防ゲート、命の球=HP/再生ゲート。 */
function sgSlv() { return Math.round((S.slv || 0) * 100) / 100; }
function sgMoveCost(id) { return sgNodeLit(id) ? 0.25 : 1.0; }
function sgGateSphere(g) {
  return (g.stat.k === 'atk' || g.stat.k === 'def')
    ? { key: 'sphP', icon: '⚔', name: '力の球' }
    : { key: 'sphL', icon: '❤', name: '命の球' };
}
// 発動: 今いるマスか隣接マスに対して、移動せずに球を消費して行う(FF10正仕様)
function sgActivateNode(word) {
  if (!sgIsReachable(word)) { if (typeof toast === 'function') toast('隣接したマスしか発動できない', 'r'); return; }
  if (sgNodeLit(word)) return;
  if (sgIsGate(word)) {
    const g = SG.gates[word]; if (!g) return;
    const sp = sgGateSphere(g);
    if ((S[sp.key] || 0) < g.cost) { if (typeof toast === 'function') toast(`${sp.icon}${sp.name}が足りない（必要${g.cost}・敵がドロップする）`, 'r'); return; }
    S[sp.key] -= g.cost;
    if (!S.sgGates) S.sgGates = {};
    S.sgGates[word] = 1;
    if (!S.stats) S.stats = {};
    S.stats[g.stat.k] = (S.stats[g.stat.k] || 0) + g.stat.v;
    save();
    sgActFx(word);
    if (typeof toast === 'function') toast(`⭐ ロック解除！ ${g.stat.lbl}`, 'g');
    if (typeof updateHdr === 'function') updateHdr();
  } else {
    if (sgSpheres() < 1) { if (typeof toast === 'function') toast('🔮記憶の球が足りない（クイズ正解/敵ドロップで獲得）', 'r'); return; }
    S.spheres -= 1;
    save();
    discover(word);
    sgActFx(word);
  }
  sgDraw(); sgUpdateHdr(); sgShowDetail(word);
}
// 移動: S.Lvを消費して隣接マスへ(未発動1.0/発動済み0.25)。未発動ゲート=ロックは通れない
function sgMoveTo(word) {
  const cur = sgCursorWord();
  if (word === cur || !sgIsReachable(word)) return;
  if (sgIsGate(word) && !sgGateOn(word)) { if (typeof toast === 'function') toast('🔒 ロックを発動(解除)しないと通れない', 'r'); return; }
  const cost = sgMoveCost(word);
  if (sgSlv() < cost) { if (typeof toast === 'function') toast(`🔷S.Lvが足りない（必要${cost}・敵を倒してAPを稼ごう）`, 'r'); return; }
  S.slv = Math.round(((S.slv || 0) - cost) * 100) / 100;
  S.gridPos = word; save();
  sgPanTo(word);
  sgDraw(); sgUpdateHdr(); sgShowDetail(word);
}
// ノードの「点灯」状態(ゲートは起動済み、単語は発見済み)
function sgNodeLit(id) { return sgIsGate(id) ? sgGateOn(id) : gst(id) !== 'unknown'; }
// ノードの所属カテゴリ色(ゲートは金)
function sgNodeCol(id) {
  if (sgIsGate(id)) return '#c8a84b';
  const w = WM[id]; return w ? SG.catColor[w.archive] : '#8090a0';
}
// 起動演出: ノード位置に一時的な拡大円を出す(軽量: CSSアニメ→自動remove)
function sgActFx(id) {
  const p = SG.pos[id]; if (!p) return;
  const g = document.getElementById('sg-cursor'); if (!g) return;
  const c = document.createElementNS(SG.svgNS, 'circle');
  c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', SG.NODE_R);
  c.setAttribute('class', 'sg-actfx');
  g.appendChild(c);
  setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 750);
}

/* ── viewBox helpers ── */
function sgGetSvg() { return document.getElementById('sg-svg'); }
function sgApplyVB() {
  const svg = sgGetSvg(); if (!svg || !SG.vb) return;
  svg.setAttribute('viewBox', `${SG.vb.x} ${SG.vb.y} ${SG.vb.w} ${SG.vb.h}`);
}
function sgInitView() {
  const svg = sgGetSvg(); if (!svg) return false;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;   // layout not ready yet — caller should retry
  const aspect = rect.width / rect.height;
  // frame on the cursor, zoomed in (FFX shows a local area, not the whole board)
  const cur = sgCursorWord(), p = SG.pos[cur];
  const viewW = 520, viewH = viewW / aspect;
  SG.vb = { x: p.x - viewW / 2, y: p.y - viewH / 2, w: viewW, h: viewH };
  sgApplyVB();
  return true;
}
function sgClampZoom(w) {
  const min = 260, max = Math.max(SG.contentBox.w, SG.contentBox.h) * 1.4;
  return Math.min(max, Math.max(min, w));
}

/* ── main render (called by go('arc') via renderArc) ── */
function renderArc() {
  sgBuild();
  const host = document.getElementById('sg-host');
  if (!host) return;
  if (!sgGetSvg()) {
    host.innerHTML =
      `<svg id="sg-svg" xmlns="${SG.svgNS}" preserveAspectRatio="xMidYMid meet">
         <g id="sg-paths"></g><g id="sg-bridges"></g><g id="sg-nodes"></g><g id="sg-labels"></g><g id="sg-cursor"></g>
       </svg>`;
    sgBindPanZoom();
  }
  if (!SG.vb && !sgInitView()) {
    // SVG hasn't been laid out yet (e.g. first paint before CSS/flex sizing settles).
    // Retry next frame instead of drawing with a broken viewBox.
    requestAnimationFrame(() => { if (S.screen === 'arc') renderArc(); });
    return;
  }
  sgDraw();
  sgRenderMini();
  sgUpdateHdr();
}

function sgDraw() {
  const cur = sgCursorWord();
  const pathsG = document.getElementById('sg-paths');
  const bridgeG = document.getElementById('sg-bridges');
  const nodesG = document.getElementById('sg-nodes');
  const labelsG = document.getElementById('sg-labels');
  const cursorG = document.getElementById('sg-cursor');
  let paths = '', bridges = '', nodes = '', labels = '';

  // intra-cluster paths (ゲートIDが混ざるため WM 直アクセスを避けてヘルパー経由に)
  const drawn = new Set();
  Object.entries(SG.adj).forEach(([w, set]) => {
    set.forEach(o => {
      const key = [w, o].sort().join('|'); if (drawn.has(key)) return; drawn.add(key);
      const a = SG.pos[w], b = SG.pos[o]; if (!a || !b) return;
      const gateSide = sgIsGate(w) || sgIsGate(o);
      const sameCat = !gateSide && WM[w] && WM[o] && WM[w].archive === WM[o].archive;
      const lit = sgNodeLit(w) && sgNodeLit(o);
      const reach = sgIsReachable(w) || sgIsReachable(o);
      const col = lit ? sgNodeCol(sgIsGate(w) ? w : (sgIsGate(o) ? o : w)) : (reach ? '#5d6890' : '#384066');
      const op = lit ? 0.85 : (reach ? 0.65 : 0.45), wid = lit ? 3 : 2;
      const line = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="${wid}" opacity="${op}" stroke-linecap="round"${lit ? '' : ' stroke-dasharray="3 7"'}/>`;
      if (sameCat) paths += line; else bridges += line;
    });
  });

  // nodes + labels
  WD.forEach(w => {
    const p = SG.pos[w.word]; if (!p) return;
    const si = gsi(w.word), unk = si === 0;
    const col = SG.catColor[w.archive];
    const reachable = sgIsReachable(w.word);
    const isCur = w.word === cur;
    const sel = w.word === SG.sel;
    const mcol = ['#1c2236', '#4dc8e0', '#1e5090', '#c8a84b', '#e0982a'][si];
    const fill = unk ? (reachable ? '#181f38' : '#0e1322') : `${mcol}`;
    const ringOp = reachable ? 1 : (unk ? 0.85 : 0.85);
    // halo for skilled/master
    if (si >= 3) nodes += `<circle cx="${p.x}" cy="${p.y}" r="${SG.NODE_R + (si === 4 ? 11 : 7)}" fill="${mcol}" opacity="0.16"/>`;
    // reachable pulse ring
    if (reachable && !isCur) nodes += `<circle cx="${p.x}" cy="${p.y}" r="${SG.NODE_R + 5}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.5" class="sg-reach"/>`;
    nodes += `<g class="sg-node${reachable ? ' reach' : ''}" data-w="${w.word}" style="cursor:${reachable || !unk ? 'pointer' : 'default'}">
        <circle cx="${p.x}" cy="${p.y}" r="${SG.NODE_R}" fill="${fill}" fill-opacity="${unk ? 0.9 : 0.32}"
          stroke="${unk ? (reachable ? '#8a96c8' : '#454d78') : col}" stroke-width="${sel ? 4 : 2.5}" opacity="${ringOp}"/>
        ${unk ? `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="15" fill="${reachable ? '#c4cbe8' : '#6b7498'}" opacity="0.95">?</text>`
        : `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14">${CICON[w.archive] || '•'}</text>`}
      </g>`;
    // UX3: 到達可能な未知ノードには解放コスト(記憶の球1)のバッジ
    if (unk && reachable && !isCur) nodes += `<text x="${p.x + SG.NODE_R + 2}" y="${p.y - SG.NODE_R + 4}" font-size="11" opacity="0.9">🔮</text>`;
    if (!unk) labels += `<text x="${p.x}" y="${p.y + SG.NODE_R + 13}" text-anchor="middle" font-size="11" font-weight="700" fill="${col}" opacity="0.95">${w.word}</text>`;
  });

  // UX3: ゲートノード(FF10式ロック) — ひし形。未起動=🔒とコスト、起動済み=ステータスアイコンと発光
  Object.entries(SG.gates).forEach(([gid, g]) => {
    const p = SG.pos[gid]; if (!p) return;
    const on = sgGateOn(gid), reachable = sgIsReachable(gid), sel = gid === SG.sel;
    const R = SG.NODE_R + 1;
    if (on) nodes += `<circle cx="${p.x}" cy="${p.y}" r="${R + 9}" fill="#c8a84b" opacity="0.15"/>`;
    if (reachable && !on) nodes += `<circle cx="${p.x}" cy="${p.y}" r="${R + 6}" fill="none" stroke="#c8a84b" stroke-width="1.5" opacity="0.55" class="sg-reach"/>`;
    nodes += `<g class="sg-node${reachable ? ' reach' : ''}" data-w="${gid}" style="cursor:${reachable ? 'pointer' : 'default'}">
        <rect x="${p.x - R}" y="${p.y - R}" width="${R * 2}" height="${R * 2}" rx="4"
          transform="rotate(45 ${p.x} ${p.y})"
          fill="${on ? '#c8a84b' : (reachable ? '#241f10' : '#151208')}" fill-opacity="${on ? 0.35 : 0.95}"
          stroke="${on ? '#c8a84b' : (reachable ? '#a8904b' : '#4a3f22')}" stroke-width="${sel ? 4 : 2.5}"/>
        <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" fill="${on ? '#ffe9ad' : '#8a7a4a'}">${on ? g.stat.icon : '🔒'}</text>
      </g>`;
    if (!on && reachable) nodes += `<text x="${p.x}" y="${p.y + R + 16}" text-anchor="middle" font-size="10" fill="#c8a84b" opacity="0.9">🔮${g.cost}</text>`;
    if (on) labels += `<text x="${p.x}" y="${p.y + R + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#c8a84b" opacity="0.9">${g.stat.lbl}</text>`;
  });

  // UX3: クラスタラベル — 1語も発見していない領域は「???」(霧の先の欲望)、発見済みならカテゴリ名
  Object.entries(SG.clusters).forEach(([cat, cl]) => {
    const anyKnown = cl.words.some(w => gst(w) !== 'unknown');
    const name = anyKnown ? ((typeof CJP !== 'undefined' && CJP[cat]) || cat) : '？？？';
    const col = anyKnown ? SG.catColor[cat] : '#4a5478';
    labels += `<text x="${cl.x}" y="${cl.y - cl.r - 14}" text-anchor="middle" font-size="17" font-weight="800" fill="${col}" opacity="${anyKnown ? 0.85 : 0.6}"${anyKnown ? '' : ' letter-spacing="3"'}>${anyKnown ? (CICON[cat] || '') + ' ' + name : name}</text>`;
  });

  // cursor marker (FFX white pointer)
  const cp = SG.pos[cur];
  const cursor = `<circle cx="${cp.x}" cy="${cp.y}" r="${SG.NODE_R + 9}" fill="none" stroke="#f0ead8" stroke-width="2.5" opacity="0.9" class="sg-cursor-ring"/>
    <circle cx="${cp.x}" cy="${cp.y}" r="${SG.NODE_R + 14}" fill="none" stroke="#f0ead8" stroke-width="1" opacity="0.35"/>`;

  pathsG.innerHTML = paths; bridgeG.innerHTML = bridges;
  nodesG.innerHTML = nodes; labelsG.innerHTML = labels; cursorG.innerHTML = cursor;
}

/* ── interactions ── */
function sgTapNode(word) {
  // FF10方式: タップは「選択」のみ。移動(S.Lv消費)と発動(球消費)は詳細パネルの2ボタンで行う。
  // 誤タップによる即消費事故を防ぎ、「手前から隣を発動だけして進まない」S.Lv節約戦術を可能にする。
  SG.sel = word;
  sgDraw();
  sgUpdateHdr();
  sgShowDetail(word);
}

function sgPanTo(word) {
  const p = SG.pos[word]; if (!p || !SG.vb) return;
  // ease viewBox centre toward node
  const tx = p.x - SG.vb.w / 2, ty = p.y - SG.vb.h / 2;
  const steps = 12; let i = 0;
  const sx = SG.vb.x, sy = SG.vb.y;
  const anim = () => {
    i++; const t = i / steps, e = 1 - Math.pow(1 - t, 3);
    SG.vb.x = sx + (tx - sx) * e; SG.vb.y = sy + (ty - sy) * e;
    sgApplyVB();
    if (i < steps) requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

function sgBindPanZoom() {
  const svg = sgGetSvg(); if (!svg) return;
  const toWorld = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    return { x: SG.vb.x + ((cx - r.left) / r.width) * SG.vb.w, y: SG.vb.y + ((cy - r.top) / r.height) * SG.vb.h };
  };

  // node tap (pointerup without drag)
  let downAt = null, moved = false;
  svg.addEventListener('pointerdown', e => {
    downAt = { x: e.clientX, y: e.clientY }; moved = false;
    SG._drag = { sx: e.clientX, sy: e.clientY, vx: SG.vb.x, vy: SG.vb.y };
    svg.setPointerCapture?.(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!SG._drag) return;
    const dx = e.clientX - SG._drag.sx, dy = e.clientY - SG._drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    const r = svg.getBoundingClientRect();
    SG.vb.x = SG._drag.vx - dx * (SG.vb.w / r.width);
    SG.vb.y = SG._drag.vy - dy * (SG.vb.h / r.height);
    sgApplyVB();
  });
  svg.addEventListener('pointerup', e => {
    SG._drag = null;
    if (moved) return;
    const t = e.target.closest('.sg-node'); if (t) sgTapNode(t.getAttribute('data-w'));
  });
  svg.addEventListener('pointercancel', () => { SG._drag = null; });

  // wheel zoom (desktop)
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.12 : 0.89;
    const w0 = SG.vb.w, h0 = SG.vb.h;
    const nw = sgClampZoom(w0 * f), nh = nw * (h0 / w0);
    const pt = toWorld(e.clientX, e.clientY);
    SG.vb.x = pt.x - (pt.x - SG.vb.x) * (nw / w0);
    SG.vb.y = pt.y - (pt.y - SG.vb.y) * (nh / h0);
    SG.vb.w = nw; SG.vb.h = nh; sgApplyVB();
  }, { passive: false });

  // pinch zoom (touch)
  let pts = new Map();
  svg.addEventListener('touchstart', e => { for (const t of e.touches) pts.set(t.identifier, t); }, { passive: true });
  svg.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (SG._pinch) {
        const f = SG._pinch.dist / dist;
        const nw = sgClampZoom(SG.vb.w * f), nh = nw * (SG.vb.h / SG.vb.w);
        const mid = toWorld((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        SG.vb.x = mid.x - (mid.x - SG.vb.x) * (nw / SG.vb.w);
        SG.vb.y = mid.y - (mid.y - SG.vb.y) * (nh / SG.vb.h);
        SG.vb.w = nw; SG.vb.h = nh; sgApplyVB();
      }
      SG._pinch = { dist };
    }
  }, { passive: false });
  svg.addEventListener('touchend', e => { if (e.touches.length < 2) SG._pinch = null; }, { passive: true });
}

function sgZoom(dir) {
  if (!SG.vb) return;
  if (dir === 0) { sgInitView(); return; }
  const f = dir > 0 ? 0.8 : 1.25;
  const cx = SG.vb.x + SG.vb.w / 2, cy = SG.vb.y + SG.vb.h / 2;
  const nw = sgClampZoom(SG.vb.w * f), nh = nw * (SG.vb.h / SG.vb.w);
  SG.vb.x = cx - nw / 2; SG.vb.y = cy - nh / 2; SG.vb.w = nw; SG.vb.h = nh; sgApplyVB();
}
function sgRecenter() { sgPanTo(sgCursorWord()); }

/* ── detail panel (right sheet) ── */
/* FF10方式のフッター: [⚡発動(球)] と [👣移動(S.Lv)] の2ボタンを状況に応じて生成 */
function sgFtrHtml(word) {
  const cur = sgCursorWord();
  const reach = sgIsReachable(word);
  const lit = sgNodeLit(word);
  const isCur = word === cur;
  let html = '';
  if (!lit) {
    if (sgIsGate(word)) {
      const g = SG.gates[word], sp = sgGateSphere(g), have = S[sp.key] || 0;
      html += `<button class="btn btn-g" ${reach && have >= g.cost ? '' : 'disabled'} onclick="sgActivateNode('${word}')">⚡ ロック解除 ${sp.icon}×${g.cost}（所持${have}）</button>`;
    } else {
      html += `<button class="btn btn-g" ${reach && sgSpheres() >= 1 ? '' : 'disabled'} onclick="sgActivateNode('${word}')">⚡ 解放 🔮×1（所持${sgSpheres()}）</button>`;
    }
  } else if (!sgIsGate(word) && typeof gsi === 'function' && gsi(word) < ST.length - 1) {
    html += `<button class="btn btn-g" onclick="selW='${word}';if(typeof startWQ==='function')startWQ()">📝 クイズ +EXP</button>`;
  }
  if (!isCur) {
    const blocked = sgIsGate(word) && !sgGateOn(word);
    const cost = sgMoveCost(word);
    html += `<button class="btn" ${reach && !blocked && sgSlv() >= cost ? '' : 'disabled'} onclick="sgMoveTo('${word}')">👣 移動 🔷${cost}（残${sgSlv()}）</button>`;
  }
  return html || '<button class="btn" disabled>ここにいる</button>';
}
function sgShowDetail(word) {
  // UX3: ゲートノード専用パネル
  if (sgIsGate(word)) {
    const g = SG.gates[word]; if (!g) return;
    const on = sgGateOn(word);
    const sp = sgGateSphere(g);
    const top = document.getElementById('sg-det-top');
    top.innerHTML = `
      <div class="sgd-wr">
        <div class="sgd-ico" style="border-color:#c8a84b;color:#c8a84b">${on ? g.stat.icon : '🔒'}</div>
        <div><div class="sgd-w">${on ? 'ロック（解除済み）' : 'スフィアロック'}</div>
        <div class="sgd-j">${on ? g.stat.lbl + ' を獲得済み' : 'クラスタ間の道を封じる結界'}</div></div>
      </div>`;
    let body = `<div class="sgd-sec"><div class="sgd-lbl">効果</div>
      <div class="sgd-line" style="color:${on ? 'var(--green)' : 'var(--t1)'}">${on ? '✓ ' : ''}${g.stat.lbl}（永続ステータス）</div></div>`;
    if (!on) body += `<div class="sgd-sec"><div class="sgd-lbl">解除コスト</div>
      <div class="sgd-row"><span>${sp.icon} ${sp.name} ×${g.cost}</span><span style="color:${(S[sp.key] || 0) >= g.cost ? 'var(--green)' : 'var(--red,#e06060)'}">所持 ${S[sp.key] || 0}</span></div>
      <div class="sgd-line" style="font-size:11px;color:var(--t2)">${sp.name}はダンジョンの敵がドロップする</div></div>`;
    document.getElementById('sg-det-body').innerHTML = body;
    const ftr = document.getElementById('sg-det-ftr'); ftr.style.display = 'flex';
    ftr.innerHTML = sgFtrHtml(word);
    document.getElementById('sg-det').classList.add('open');
    document.getElementById('sg-backdrop').classList.add('show');
    return;
  }
  const w = WM[word]; if (!w) return;
  const si = gsi(word), unk = si === 0, col = SG.catColor[w.archive];
  const mc = ['#18203a', '#4dc8e0', '#1e5090', '#c8a84b', '#e0982a'];
  const cur = sgCursorWord();
  const top = document.getElementById('sg-det-top');
  top.innerHTML = `
    <div class="sgd-wr">
      <div class="sgd-ico" style="border-color:${col};color:${col}">${unk ? '？' : (CICON[w.archive] || '•')}</div>
      <div><div class="sgd-w">${unk ? '???' : word}</div><div class="sgd-j">${unk ? '未踏のノード' : w.meaning}</div></div>
    </div>
    ${!unk ? `<div class="sgd-bdgs">
      <span class="sgd-bdg">${w.pos}</span><span class="sgd-bdg">${w.cefr}</span>
      <span class="sgd-bdg" style="color:${RCOL[w.rarity]}">${RLBL[w.rarity]}</span>
      <span class="sgd-bdg" style="background:${col}22;color:${col}">${CJP[w.archive] || w.archive}</span>
    </div>` : ''}`;

  let body = '';
  if (unk) {
    const reach = sgIsReachable(word);
    body = `<div class="sgd-sec"><div class="sgd-lbl">状態</div>
      <div class="sgd-line">${reach ? '道はつながっている。🔮記憶の球1個で解放できる。' : 'まだ道がつながっていない。隣接ノードから辿ろう。'}</div></div>`;
  } else {
    const pct = Math.round(si / (ST.length - 1) * 100);
    body = `<div class="sgd-sec"><div class="sgd-lbl">習熟度</div>
      <div class="sgd-row"><span>${ST_JP[si]}</span><span style="color:${mc[si]};font-weight:700">${si}/${ST.length - 1}</span></div>
      <div class="sgd-bar"><div class="sgd-fill" style="width:${pct}%;background:${mc[si]}"></div></div></div>`;
    const wlv = getWLv(word), atCap = wlv.lv >= WLV_CAP, lp = Math.round((wlv.exp || 0) / WEXP_PER_LV * 100);
    body += `<div class="sgd-sec"><div class="sgd-lbl">単語レベル</div>
      <div class="sgd-row"><span>Lv${wlv.lv} / ${WLV_CAP}</span>${atCap ? '<span style="color:var(--gold)">MAX</span>' : `<span style="color:var(--green)">${wlv.exp || 0}/${WEXP_PER_LV}</span>`}</div>
      ${atCap ? '' : `<div class="sgd-bar"><div class="sgd-fill" style="width:${lp}%;background:var(--green)"></div></div>`}</div>`;
    const evo = (typeof EVOLUTION !== 'undefined') && EVOLUTION[word];
    if (evo && WM[evo]) {
      const done = gst(evo) !== 'unknown';
      body += `<div class="sgd-sec"><div class="sgd-lbl">進化</div><div class="sgd-line" style="color:${done ? 'var(--green)' : 'var(--t1)'}">${done ? `✓ ${evo} 解放済み` : `Lv${WLV_CAP}で「${evo}」へ`}</div></div>`;
    }
    [['related', '関連語'], ['synonyms', '同義語'], ['opposites', '対義語'], ['evolution', '派生形'], ['craft', 'クラフト先 →']].forEach(([k, l]) => {
      const items = w.relations[k] || []; if (!items.length) return;
      body += `<div class="sgd-sec"><div class="sgd-lbl">${l}</div><div class="sgd-chips">`;
      items.forEach(it => { const kn = gst(it) !== 'unknown'; body += `<span class="sgd-chip${kn ? ' k' : ''}"${kn && SG.pos[it] ? ` data-jump="${it}"` : ''}>${kn ? it : '???'}</span>`; });
      body += `</div></div>`;
    });
  }
  document.getElementById('sg-det-body').innerHTML = body;

  const ftr = document.getElementById('sg-det-ftr'); ftr.style.display = 'flex';
  // FF10方式: [⚡発動]と[👣移動]の2ボタン(移動と発動の分離)
  ftr.innerHTML = sgFtrHtml(word);
  // chip jump
  document.getElementById('sg-det-body').querySelectorAll('[data-jump]').forEach(el =>
    el.onclick = () => { const t = el.getAttribute('data-jump'); SG.sel = t; sgPanTo(t); sgDraw(); sgShowDetail(t); });

  document.getElementById('sg-det').classList.add('open');
  document.getElementById('sg-backdrop').classList.add('show');
}
function sgCloseDetail() {
  document.getElementById('sg-det').classList.remove('open');
  document.getElementById('sg-backdrop').classList.remove('show');
  SG.sel = null; sgDraw();
}

/* ── header / completion ── */
function sgUpdateHdr() {
  const total = WD.length, known = nd();
  const el = document.getElementById('sg-pct'); if (el) el.textContent = Math.round(known / total * 100) + '%';
  const bar = document.getElementById('sg-fill'); if (bar) bar.style.width = Math.round(known / total * 100) + '%';
  const cnt = document.getElementById('sg-count'); if (cnt) cnt.textContent = `${known} / ${total}`;
  const sph = document.getElementById('sg-sph'); if (sph) sph.textContent = `🔮${sgSpheres()}`;
  const slv = document.getElementById('sg-slv'); if (slv) slv.textContent = `🔷S.Lv ${sgSlv()}`;
  const sp2 = document.getElementById('sg-sphp'); if (sp2) sp2.textContent = `⚔${S.sphP || 0}`;
  const sp3 = document.getElementById('sg-sphl'); if (sp3) sp3.textContent = `❤${S.sphL || 0}`;
}

/* ── minimap of clusters ── */
function sgRenderMini() {
  const mini = document.getElementById('sg-mini'); if (!mini) return;
  const cats = Object.keys(SG.clusters);
  let html = '';
  cats.forEach(c => {
    const cl = SG.clusters[c];
    const known = cl.words.filter(w => gst(w) !== 'unknown').length;
    const pct = Math.round(known / cl.count * 100);
    const cur = sgCursorWord(), here = WM[cur] && WM[cur].archive === c;
    html += `<div class="sg-mini-row${here ? ' here' : ''}" data-cat="${c}">
      <span class="sg-mini-dot" style="background:${SG.catColor[c]}"></span>
      <span class="sg-mini-name">${CICON[c] || ''} ${CJP[c] || c}</span>
      <span class="sg-mini-pct" style="color:${SG.catColor[c]}">${pct}%</span></div>`;
  });
  mini.innerHTML = html;
  mini.querySelectorAll('.sg-mini-row').forEach(r => r.onclick = () => {
    const c = r.getAttribute('data-cat'); const centre = SG.clusters[c].words[0];
    sgPanTo(centre);
    document.getElementById('sg-mini-wrap')?.classList.remove('open');
    document.getElementById('sg-backdrop')?.classList.remove('show');
  });
}
function sgToggleMini() {
  const w = document.getElementById('sg-mini-wrap');
  const open = w.classList.toggle('open');
  document.getElementById('sg-backdrop').classList.toggle('show', open);
}

/* ════ COMPAT SHIMS — keep ui.js working after archive.js removal ════ */
// ui.js references these globals/functions from the old archive screen.
if (typeof selW === 'undefined') var selW = null;   // used by startWQ()
function renderNodes() { if (SG.built) sgDraw(); }  // ui.js calls after quiz to refresh nodes
function initPan() { /* no-op: sphere grid binds its own pan/zoom on first render */ }
