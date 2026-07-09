/* ════════════════════════════════════════════════════════════════════
   BATTLE ENCOUNTER — エンカウント式ターン制戦闘 (試作 / 相性・敵AI版)

   ── 設計の核 ──
   「単語の意味を読むこと」が、そのまま戦術判断になる状態を作る。

   1. 相性 = 対義語。 敵は属性を纏う。その属性の"対義語"の技を撃つと弱点2倍。
      → プレイヤーは「敵はWater属性 → 反対の意味は…Fire！」と考える。
        その思考が対義語の学習そのもの。暗記表は作らない。
      BE_OPPOSITE は archive_relations.json (5319エッジ) から、
      ゲーム内100語で両端が成立する対義関係だけを抽出した実データ。
      473KBのJSONはロードせず、必要な16ペアだけを埋め込んでいる。

   2. 敵AI = 予告して読ませる。 溜め(charge)/構え(guard)/通常。
      次の行動が頭上に予告される。予告があるから"読める"。
      溜め中の敵に弱点技を当てるとブレイク(溜め解除+追撃+敵1ターン休み)。
      → 相性と行動パターンがここで噛み合う。「今Fireで潰せ」という緊張。

   3. 閃き = 使い込むと進化。 同じ技をBE_EVOLVE_USES回使うと戦闘中に進化。
      進化先が未発見なら discover() = 盤の単語解放と直結。

   ── 技(単語)になるのは ──
   ・対義グラフに乗っている属性語(18種)のうち発見済みのもの → 弱点を突ける
   ・進化系列(Fire→Flame→Blaze→Inferno等)に乗っているもの → 使い込むと育つ
   両者は重なる(Fire系は属性かつ進化系列)。発見が進むほど技が増える。

   ── 本編の作法 ──
   バニラJS・グローバル関数・フラット構造・600行制限。ES6 classは使わない。
   data.js は一切変更しない。ENEMIES/EVOLUTION/WM/cc を読むだけ。
════════════════════════════════════════════════════════════════════ */

/* ════ 調整パラメータ ════ */
const BE_EVOLVE_USES  = 3;    // 同じ技を何回使うと進化(閃き)するか
const BE_WEAK_MULT    = 2.0;  // 弱点(対義語)を突いたときの倍率
const BE_RESIST_MULT  = 0.5;  // 同属性(効きにくい)の倍率
const BE_CHARGE_MULT  = 2.2;  // 敵の溜め攻撃の倍率
const BE_CHARGE_TAKEN = 1.4;  // 溜め中の敵が受けるダメージ倍率(無防備)
const BE_GUARD_CUT    = 0.4;  // 構え中の敵が受けるダメージ倍率
const BE_BREAK_BONUS  = 1.5;  // ブレイク(溜め潰し)成功時の追加倍率
const BE_ENEMY_FLOOR  = 3;    // 敵ステータスのスケール基準(試作は固定)

const BE_RARITY_MULT = { common:1.0, uncommon:1.15, rare:1.3, epic:1.45, legendary:1.6 };

/* ════ 対義グラフ(実データから抽出。archive_relations.json由来) ════
   ゲーム内100語で両端が成立する対義関係のみ。商業語(Buy/Sell)は戦闘外なので除外。 */
const BE_OPPOSITE = {
  Attack:['Defend'],
  Cold:['Heat'],
  Dark:['Light'],
  Day:['Night'],
  Defend:['Attack'],
  Earth:['Sky'],
  Fire:['Water','Ice','Snow'],
  Flame:['Water'],
  Heat:['Ice','Cold','Snow'],
  Ice:['Fire','Heat','Inferno'],
  Inferno:['Ice','Water'],
  Light:['Dark','Night'],
  Moon:['Sun'],
  Night:['Day','Light'],
  Sky:['Earth'],
  Snow:['Heat','Fire'],
  Sun:['Moon'],
  Water:['Fire','Flame','Inferno'],
};

/* ════ 敵に属性を纏わせる ════
   敵の名前(Slime等)自体は対義語を持たないため、属性を1つ割り当てる。
   属性は必ず BE_OPPOSITE のキーにする(＝対義語で突ける)。 */
const BE_ENEMY_ATTR = {
  slime:'Water', bat:'Dark', goblin:'Earth', orc:'Fire',
  wolf:'Cold', skeleton:'Dark', zombie:'Dark', mage:'Light',
};
/* 属性の表示アイコン */
const BE_ATTR_ICON = {
  Fire:'🔥',Flame:'🔥',Inferno:'🔥',Water:'💧',Ice:'❄',Snow:'❄',Cold:'❄',
  Heat:'♨',Light:'☀',Dark:'🌑',Sun:'☀',Moon:'🌙',Day:'🌤',Night:'🌙',
  Earth:'⛰',Sky:'☁',Attack:'⚔',Defend:'🛡',
};

/* ════ ランタイム状態(戦闘ごとに作り直す。Sには保存しない) ════ */
let BE = {
  active:false, enemy:null,
  playerHp:0, playerMaxHp:0,
  moves:[], martial:{},
  busy:false, turn:0, log:[],
};

/* ════════════════════════════════════════════════
   技(単語)の準備
════════════════════════════════════════════════ */
/* 技になる単語 = 「対義グラフに乗る属性語」+「進化系列の起点」。いずれも発見済みのみ。
   進化先(Flame等)は、その進化元(Fire)を持っているなら技にしない(進化で手に入るため)。 */
function beBuildMoves() {
  if (typeof WM === 'undefined') return [];
  const has = w => (typeof gst === 'function') && gst(w) !== 'unknown' && !!WM[w];
  const EVO = (typeof EVOLUTION !== 'undefined') ? EVOLUTION : {};
  const evoTargets = new Set(Object.values(EVO));

  // (a) 属性語(対義を持つ) = 弱点を突ける技
  const attrs = Object.keys(BE_OPPOSITE).filter(has);
  // (b) 進化系列の起点 = 使い込むと育つ技
  const evoBases = Object.keys(EVO).filter(w => has(w) && !evoTargets.has(w));
  // (c) 系列の途中から入手した語(進化元を持たない進化先)も救済
  const evoOrphans = Object.values(EVO).filter(w =>
    has(w) && !Object.entries(EVO).some(([s,t]) => t===w && has(s)));

  let list = [...new Set([...attrs, ...evoBases, ...evoOrphans])].filter(w => {
    if (!evoTargets.has(w)) return true;           // 進化先でないなら採用
    const src = Object.entries(EVO).find(([s,t]) => t===w);
    return !(src && has(src[0]));                   // 進化元を持つなら技にしない
  });

  // フォールバック: 1つも無ければ発見済み単語から拾う
  if (!list.length && typeof WD !== 'undefined') {
    list = WD.filter(w => has(w.word)).slice(0,4).map(w => w.word);
  }
  return list.slice(0,8).map(word => ({ word, uses:0 }));
}

/* 技の威力(単語レアリティで係数化。ベースはプレイヤーATK) */
function beMovePower(word) {
  const w = (typeof WM !== 'undefined') ? WM[word] : null;
  const mult = (w && BE_RARITY_MULT[w.rarity]) || 1.0;
  const base = (typeof getPlayerAtk === 'function') ? getPlayerAtk() : 5;
  return Math.max(1, Math.round(base * mult));
}
function beMoveColor(word) {
  const w = (typeof WM !== 'undefined') ? WM[word] : null;
  return (w && typeof cc === 'function') ? cc(w.archive) : '#8a90a8';
}

/* ════ 相性判定 ════
   技(単語)が敵の属性の"対義語"なら弱点。同じ属性なら効きにくい。 */
function beAffinity(word, enemyAttr) {
  if (!enemyAttr) return { mult:1.0, kind:'normal' };
  const opps = BE_OPPOSITE[enemyAttr] || [];
  if (opps.includes(word)) return { mult:BE_WEAK_MULT, kind:'weak' };
  if (word === enemyAttr)  return { mult:BE_RESIST_MULT, kind:'resist' };
  return { mult:1.0, kind:'normal' };
}

/* ════ 敵の準備 ════ */
function beMakeEnemy(enemyId) {
  if (typeof ENEMIES === 'undefined') return null;
  const tpl = ENEMIES.find(e => e.id === enemyId) || ENEMIES[0];
  const f = BE_ENEMY_FLOOR;
  const hs = 1 + (f-1)*0.12, as = 1 + (f-1)*0.08;
  const hp = Math.max(1, Math.round(tpl.hp * hs));
  const atk = Math.max(1, Math.round((tpl.atk||1) * as));
  return {
    id:tpl.id, name:tpl.name, jp:tpl.jp, icon:tpl.icon, reward:tpl.reward,
    hp, curHp:hp, atk, def:tpl.def||0,
    attr: BE_ENEMY_ATTR[tpl.id] || null,
    state:'normal',    // 'normal' | 'charging' | 'guarding'
    intent:null,       // 次ターンの予告
  };
}

/* ════ 戦闘開始 ════ */
function beStart(enemyId) {
  const enemy = beMakeEnemy(enemyId);
  if (!enemy) { if (typeof toast==='function') toast('敵データが見つからない','r'); return; }
  const maxHp = (typeof getPlayerMaxHp==='function') ? getPlayerMaxHp() : 20;
  BE = { active:true, enemy, playerHp:maxHp, playerMaxHp:maxHp,
         moves:beBuildMoves(), martial:{}, busy:false, turn:0, log:[] };
  const ov = document.getElementById('be-ov');
  if (ov) ov.classList.add('show');
  const ai = enemy.attr ? `${BE_ATTR_ICON[enemy.attr]||''}${enemy.attr}` : '無属性';
  beLog(`⚔ ${enemy.jp||enemy.name} が現れた！（属性: ${ai}）`);
  if (enemy.attr) {
    const weak = (BE_OPPOSITE[enemy.attr]||[]).join('・');
    beLog(`💡 ${enemy.attr} の反対の意味の技が弱点だ（${weak}）`);
  }
  beDecideIntent();   // 初手の予告を立てる
  beRender();
}

/* ════════════════════════════════════════════════
   プレイヤーの攻撃
════════════════════════════════════════════════ */
function beUseMove(idx) {
  if (!BE.active || BE.busy) return;
  const mv = BE.moves[idx];
  if (!mv) return;
  BE.busy = true; BE.turn++;
  const e = BE.enemy;

  const aff = beAffinity(mv.word, e.attr);
  let dmg = Math.max(1, beMovePower(mv.word) - (e.def||0));
  dmg = Math.round(dmg * aff.mult);

  // 敵の状態で補正: 溜め中は無防備 / 構え中は硬い
  let broke = false;
  if (e.state === 'charging') {
    dmg = Math.round(dmg * BE_CHARGE_TAKEN);
    // 弱点技を溜め中に当てるとブレイク: 溜めを潰して追撃
    if (aff.kind === 'weak') { dmg = Math.round(dmg * BE_BREAK_BONUS); broke = true; }
  } else if (e.state === 'guarding') {
    dmg = Math.round(dmg * BE_GUARD_CUT);
  }
  dmg = Math.max(1, dmg);
  e.curHp = Math.max(0, e.curHp - dmg);

  let tag = '';
  if (aff.kind === 'weak')   tag = ' 🎯弱点！';
  if (aff.kind === 'resist') tag = ' 🛡効果は薄い…';
  beLog(`🗡 ${mv.word}！ ${dmg} ダメージ${tag}`);
  beFloat(dmg, 'enemy', aff.kind);

  if (broke) {
    e.state = 'normal'; e.intent = null;
    beLog(`💥 溜めを打ち砕いた！ ${e.jp||e.name}は体勢を崩した`);
  }

  // 戦闘熟練度 → 進化(閃き)
  BE.martial[mv.word] = (BE.martial[mv.word]||0) + 1;
  mv.uses = BE.martial[mv.word];
  const evolved = beCheckEvolve(mv, idx);

  beRender();

  if (e.curHp <= 0) { setTimeout(() => beWin(), evolved ? 900 : 350); return; }
  setTimeout(() => beEnemyTurn(broke), evolved ? 1100 : 480);
}

/* ════ 進化(閃き) ════ */
function beCheckEvolve(mv, idx) {
  if (mv.uses < BE_EVOLVE_USES) return false;
  const next = (typeof EVOLUTION !== 'undefined') ? EVOLUTION[mv.word] : null;
  if (!next || (typeof WM !== 'undefined' && !WM[next])) {
    BE.martial[mv.word] = 0; mv.uses = 0; return false;  // 最終形は据え置き
  }
  const from = mv.word;
  const wasUnknown = (typeof gst==='function') && gst(next) === 'unknown';
  if (wasUnknown && typeof discover === 'function') discover(next, false);
  delete BE.martial[from];
  BE.martial[next] = 0;
  BE.moves[idx] = { word:next, uses:0 };
  beFlashEvolve(from, next, wasUnknown);
  return true;
}

/* ════════════════════════════════════════════════
   敵のターン（予告 → 実行 → 次の予告）
════════════════════════════════════════════════ */
/* 次に何をするか決めて予告する。HPが減るほど溜めを狙いやすくなる。 */
function beDecideIntent() {
  const e = BE.enemy;
  if (!e) return;
  const hpRatio = e.curHp / e.hp;
  const r = Math.random();
  const chargeP = hpRatio < 0.4 ? 0.42 : 0.26;   // 追い詰められるほど大技を狙う
  const guardP  = (e.def > 0 && hpRatio < 0.6) ? 0.20 : 0.10;
  if (r < chargeP)             e.intent = 'charge';
  else if (r < chargeP+guardP) e.intent = 'guard';
  else                         e.intent = 'attack';
}

function beEnemyTurn(skipTurn) {
  if (!BE.active) return;
  const e = BE.enemy;
  const def = (typeof getPlayerDef==='function') ? getPlayerDef() : 0;

  // ブレイクされた直後は敵の行動をスキップ(溜めを潰した見返り)
  if (skipTurn) {
    beLog(`😵 ${e.jp||e.name}は隙だらけだ！`);
    e.state = 'normal';
    beDecideIntent();
    BE.busy = false; beRender();
    return;
  }

  if (e.state === 'charging') {
    // 前ターンに溜めた → 大技が来る
    const dmg = Math.max(1, Math.round((e.atk||1) * BE_CHARGE_MULT) - def);
    BE.playerHp = Math.max(0, BE.playerHp - dmg);
    beLog(`💥 ${e.jp||e.name}の渾身の一撃！ ${dmg} ダメージ`);
    beFloat(dmg, 'player');
    e.state = 'normal';
  } else if (e.intent === 'charge') {
    e.state = 'charging';
    beLog(`⚡ ${e.jp||e.name}が力を溜めている…（今叩けば大ダメージ）`);
  } else if (e.intent === 'guard') {
    e.state = 'guarding';
    beLog(`🛡 ${e.jp||e.name}は身構えた（攻撃が通りにくい）`);
  } else {
    if (e.state === 'guarding') e.state = 'normal';
    const dmg = Math.max(1, (e.atk||1) - def);
    BE.playerHp = Math.max(0, BE.playerHp - dmg);
    beLog(`💢 ${e.jp||e.name}の攻撃！ ${dmg} ダメージ`);
    beFloat(dmg, 'player');
  }

  if (BE.playerHp <= 0) { beRender(); setTimeout(() => beLose(), 500); return; }
  // 次の行動を予告(溜め中は「次は大技」で確定)
  if (e.state === 'charging') e.intent = 'charge';
  else beDecideIntent();
  // busyを先に解除してから再描画。逆順にすると技ボタンがdisabledのまま固まる。
  BE.busy = false;
  beRender();
}

/* ════ 勝敗 ════ */
function beWin() {
  const e = BE.enemy;
  const gMul = (typeof getGoldMultiplier==='function') ? getGoldMultiplier() : 1;
  const aMul = (typeof getAExpMultiplier==='function') ? getAExpMultiplier() : 1;
  const gold = Math.round((e.reward && e.reward.gold || 0) * gMul);
  const aexp = Math.round((e.reward && e.reward.aexp || 0) * aMul);
  if (typeof S !== 'undefined') {
    S.gold = (S.gold||0) + gold;
    S.aexp = (S.aexp||0) + aexp;
    if (typeof addItem==='function' && Math.random() < 0.6) {
      const dgId = (typeof DD!=='undefined' && DD[0]) ? DD[0].id : null;
      addItem('archive_shard', 1, dgId ? {dungeonId:dgId} : null);
      beLog('🔮 アーカイブの欠片を手に入れた！');
    }
    if (typeof registerDexMonster==='function') registerDexMonster(e.id);
    if (typeof save==='function') save();
  }
  beLog(`🎉 ${e.jp||e.name}を倒した！ 💰+${gold} / 📈+${aexp}`);
  if (typeof updateHdr==='function') updateHdr();
  beShowResult(true);
}
function beLose() { beLog('💀 倒れてしまった…（試作のためペナルティなし）'); beShowResult(false); }

function beEnd() {
  BE.active = false;
  const ov = document.getElementById('be-ov');
  if (ov) ov.classList.remove('show');
  const res = document.getElementById('be-result');
  if (res) res.classList.remove('show');
  if (typeof WORLD_show==='function' && typeof WORLD!=='undefined' && WORLD.grid) WORLD_show();
}

/* ════════════════════════════════════════════════
   描画・演出
════════════════════════════════════════════════ */
function beRender() {
  const e = BE.enemy;
  if (!e) return;
  const $ = id => document.getElementById(id);

  if ($('be-enemy-icon')) $('be-enemy-icon').textContent = e.icon || '👾';
  if ($('be-enemy-name')) {
    const at = e.attr ? ` ${BE_ATTR_ICON[e.attr]||''}${e.attr}` : '';
    $('be-enemy-name').textContent = `${e.jp||e.name} (${e.name})${at}`;
  }
  const eHpPct = e.hp ? Math.max(0, Math.round(e.curHp/e.hp*100)) : 0;
  if ($('be-enemy-hpfill')) $('be-enemy-hpfill').style.width = eHpPct + '%';
  if ($('be-enemy-hptxt')) $('be-enemy-hptxt').textContent = `${e.curHp}/${e.hp}`;

  // 敵の予告バッジ(読ませるための情報。これが無いと理不尽になる)
  const badge = $('be-intent');
  if (badge) {
    let txt = '', cls = 'be-intent';
    if (e.state === 'charging')      { txt = '⚡ 溜め中 — 次は大技！ 今が好機'; cls += ' charging'; }
    else if (e.state === 'guarding') { txt = '🛡 構え中 — 攻撃が通りにくい';    cls += ' guarding'; }
    else if (e.intent === 'charge')  { txt = '⚡ 力を溜めようとしている';        cls += ' warn'; }
    else if (e.intent === 'guard')   { txt = '🛡 身構えようとしている';          cls += ' warn'; }
    else                             { txt = '💢 攻撃してくる';                  cls += ' normal'; }
    badge.textContent = txt; badge.className = cls;
  }

  const pPct = BE.playerMaxHp ? Math.max(0, Math.round(BE.playerHp/BE.playerMaxHp*100)) : 0;
  if ($('be-player-hpfill')) {
    $('be-player-hpfill').style.width = pPct + '%';
    $('be-player-hpfill').classList.toggle('low', pPct <= 25);
  }
  if ($('be-player-hptxt')) $('be-player-hptxt').textContent = `${BE.playerHp}/${BE.playerMaxHp}`;

  // 技ボタン(弱点なら表示威力も光る)
  const list = $('be-moves');
  if (list) {
    list.innerHTML = BE.moves.map((mv,i) => {
      const col = beMoveColor(mv.word);
      const w = (typeof WM!=='undefined') ? WM[mv.word] : null;
      const aff = beAffinity(mv.word, e.attr);
      const base = Math.max(1, beMovePower(mv.word) - (e.def||0));
      const pow = Math.max(1, Math.round(base * aff.mult));
      const affTag = aff.kind==='weak'   ? ` <span class="be-aff weak">🎯</span>`
                   : aff.kind==='resist' ? ` <span class="be-aff resist">🛡</span>` : '';
      const canEvo = (typeof EVOLUTION!=='undefined') && EVOLUTION[mv.word] && WM && WM[EVOLUTION[mv.word]];
      const uses = mv.uses||0;
      const pct = canEvo ? Math.min(100, Math.round(uses/BE_EVOLVE_USES*100)) : 0;
      const evo = canEvo
        ? `<div class="be-move-evo"><div class="be-move-evobar"><div class="be-move-evofill" style="width:${pct}%;background:${col}"></div></div><span>閃き ${Math.max(0,BE_EVOLVE_USES-uses)}</span></div>`
        : `<div class="be-move-evo be-move-evomax">極</div>`;
      return `<button class="be-move${aff.kind==='weak'?' weak':''}" style="border-color:${col}44" onclick="beUseMove(${i})" ${BE.busy?'disabled':''}>
        <div class="be-move-top">
          <span class="be-move-word" style="color:${col}">${mv.word}</span>
          <span class="be-move-pow">⚔${pow}${affTag}</span>
        </div>
        <div class="be-move-mean">${w?w.meaning:''}</div>
        ${evo}
      </button>`;
    }).join('');
  }
  beRenderLog();
}

function beRenderLog() {
  const el = document.getElementById('be-log');
  if (el) el.innerHTML = BE.log.map(l => `<div class="be-log-line">${l}</div>`).join('');
}
function beLog(msg) { BE.log.unshift(msg); if (BE.log.length>8) BE.log.pop(); beRenderLog(); }

function beFloat(amount, kind, affKind) {
  const stage = document.getElementById('be-stage');
  if (!stage) return;
  const el = document.createElement('div');
  el.className = 'be-float ' + (kind||'enemy')
    + (affKind==='weak'?' weak':'') + (affKind==='resist'?' resist':'');
  el.textContent = amount;
  el.style.left = (kind==='player' ? 30 : 62) + '%';
  el.style.top  = (kind==='player' ? 62 : 26) + '%';
  stage.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

/* 閃き演出: 進化の瞬間に「綴り+意味+進化」を見せる。クイズではなく祝福。 */
function beFlashEvolve(from, to, wasUnknown) {
  const wFrom = (typeof WM!=='undefined') ? WM[from] : null;
  const wTo   = (typeof WM!=='undefined') ? WM[to]   : null;
  const fl = document.getElementById('be-flash');
  if (!fl) return;
  const col = beMoveColor(to);
  fl.innerHTML = `
    <div class="be-flash-eureka">⚡ 閃いた！</div>
    <div class="be-flash-chain">
      <span class="be-flash-from">${from}</span>
      <span class="be-flash-arrow">→</span>
      <span class="be-flash-to" style="color:${col}">${to}</span>
    </div>
    <div class="be-flash-mean">${wFrom?wFrom.meaning:''} → <b>${wTo?wTo.meaning:''}</b></div>
    ${wasUnknown ? `<div class="be-flash-new">✦ 新しい単語「${to}」を発見！ ✦</div>` : ''}`;
  fl.classList.remove('show'); void fl.offsetWidth; fl.classList.add('show');
  beLog(`⚡ ${from} を使い込み、${to} を閃いた！${wasUnknown?'（新発見）':''}`);
  setTimeout(() => fl.classList.remove('show'), wasUnknown ? 1900 : 1500);
}

function beShowResult(win) {
  BE.busy = true;
  const res = document.getElementById('be-result');
  if (!res) { beEnd(); return; }
  const t = document.getElementById('be-result-title');
  if (t) {
    t.textContent = win ? '⚔ BATTLE WON' : '× BATTLE LOST';
    t.className = 'be-result-title ' + (win ? 'win' : 'lose');
  }
  res.classList.add('show');
}
