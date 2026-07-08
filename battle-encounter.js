/* ════════════════════════════════════════════════════════════════════
   BATTLE ENCOUNTER — エンカウント式ターン制戦闘 (試作 / コア検証版)

   ── この試作で検証したいこと ──
   「単語技を使い込む → 戦闘の最中に進化を閃く」瞬間が、"勉強させられてる"
   ではなく "成長した！嬉しい" と感じられるか。この一点だけを最小構成で確かめる。

   ── コア設計 ──
   ・1対1ターン制。プレイヤー vs 敵1体。
   ・技 = 習得済みの「進化系列に乗っている単語」(data.jsのEVOLUTION)。
     新しいマスタデータは作らない。Fireを覚えていれば"Fire技"が使える。
   ・同じ技を BE_EVOLVE_USES 回使うと、戦闘中にその場で次の単語へ進化し、
     上位技として即座に使えるようになる(閃き演出つき)。
     進化語が未発見なら discover() を呼ぶ = 盤(sphere-grid)の単語解放と直結。
   ・戦闘熟練度(使用回数)は戦闘ごとにリセット(BEに持つ。Sには保存しない)。
     → 毎戦かならず閃きが起こり、「閃きの快感」を確実に検証できる。

   ── あえて入れていないもの(次段階) ──
   属性相性 / 欠片で新単語解放の詳細 / 複数敵 / パーティ(ミリー相当) /
   SO風リアルタイム操作。試作のノイズになるため今回は作らない。

   ── 本編の作法 ──
   バニラJS・グローバル関数・フラット構造・600行制限。ES6 classは使わない。
   既存資産を最大限流用: getPlayerAtk/getPlayerMaxHp/getPlayerDef(battle.js)、
   ENEMIES/EVOLUTION/WM/cc/RCOL/RLBL(data.js)、discover/advance/updateHdr(ui.js)、
   getGoldMultiplier/getAExpMultiplier(ui.js)。

   ── 起動 ──
   ワールドマップの敵シンボル接触から beStart(enemyId) が呼ばれる(world.js側で配線)。
   独立オーバーレイ(#be-ov)を index.html に追加して表示する。
════════════════════════════════════════════════════════════════════ */

/* ════ 調整パラメータ ════ */
const BE_EVOLVE_USES = 3;        // 同じ技を何回使うと進化(閃き)するか
const BE_RARITY_MULT = {         // 技の威力: 単語レアリティ係数
  common:1.0, uncommon:1.15, rare:1.3, epic:1.45, legendary:1.6
};
const BE_ENEMY_FLOOR = 3;        // 敵ステータスのスケール基準(試作は固定)

/* ════ ランタイム状態(戦闘ごとに作り直す。Sには保存しない) ════ */
let BE = {
  active:false,
  enemy:null,        // {id,name,jp,icon,hp,curHp,atk,def,rarity,reward}
  playerHp:0, playerMaxHp:0,
  moves:[],          // [{word, uses}]  現在使える単語技
  martial:{},        // word -> このバトル中の使用回数(進化トリガー)
  busy:false,        // 演出中の多重入力防止
  turn:0,
  log:[],
};

/* ════ 技(単語)の準備 ════
   習得済みで、かつ進化系列に「乗っている」単語(進化元 or 進化先)を技にする。
   系列の途中まで習得済みなら、一番若い(進化前)の段から始める =「使い込んで育てる」余地を作る。 */
function beBuildMoves() {
  if (typeof WD === 'undefined' || typeof EVOLUTION === 'undefined') return [];
  // 進化系列に関与する全単語(元と先の両方)
  const inChain = new Set();
  Object.entries(EVOLUTION).forEach(([src, tgt]) => { inChain.add(src); inChain.add(tgt); });
  // 習得済み(discovered以上)かつ系列に乗っている単語
  const owned = WD.filter(w => inChain.has(w.word) && typeof gst === 'function' && gst(w.word) !== 'unknown')
    .map(w => w.word);
  // 系列の「先」に当たる単語は技リストから除外し、進化元だけを技にする
  //  (例: Fire/Flame両方を習得済みでも、技は"Fire"1つ。使い込むとFlameへ進化する)
  const targets = new Set(Object.values(EVOLUTION));
  let bases = owned.filter(w => !targets.has(w));
  // 進化元を持たない習得済み系列語(= 系列の途中から入手した語)も救済して技にする
  owned.forEach(w => {
    const isBase = !targets.has(w);
    const srcOwned = Object.entries(EVOLUTION).some(([s, t]) => t === w && owned.includes(s));
    if (!isBase && !srcOwned && !bases.includes(w)) bases.push(w);
  });
  // 系列に乗っている技が1つも無い場合のフォールバック: 習得済み単語から最大4つ拾う
  if (!bases.length) {
    bases = WD.filter(w => typeof gst === 'function' && gst(w.word) !== 'unknown')
      .slice(0, 4).map(w => w.word);
  }
  // 重複除去 + 最大6技
  bases = [...new Set(bases)].slice(0, 6);
  return bases.map(word => ({ word, uses: 0 }));
}

/* 技の威力(単語レアリティで係数化。ベースはプレイヤーATK) */
function beMovePower(word) {
  const w = (typeof WM !== 'undefined') ? WM[word] : null;
  const mult = (w && BE_RARITY_MULT[w.rarity]) || 1.0;
  const base = (typeof getPlayerAtk === 'function') ? getPlayerAtk() : 5;
  return Math.max(1, Math.round(base * mult));
}
/* 技の表示色(カテゴリ色) */
function beMoveColor(word) {
  const w = (typeof WM !== 'undefined') ? WM[word] : null;
  return (w && typeof cc === 'function') ? cc(w.archive) : '#8a90a8';
}

/* ════ 敵の準備 ════ */
function beMakeEnemy(enemyId) {
  if (typeof ENEMIES === 'undefined') return null;
  const tpl = ENEMIES.find(e => e.id === enemyId) || ENEMIES[0];
  // 階層スケール(data.jsのdmScaleEnemyと同じ式。無ければ素の値)
  const f = BE_ENEMY_FLOOR;
  const hs = 1 + (f - 1) * 0.12, as = 1 + (f - 1) * 0.08;
  const hp = Math.max(1, Math.round(tpl.hp * hs));
  const atk = Math.max(1, Math.round((tpl.atk || 1) * as));
  return { ...tpl, hp, curHp: hp, atk, def: tpl.def || 0 };
}

/* ════ 戦闘開始 ════ */
function beStart(enemyId) {
  const enemy = beMakeEnemy(enemyId);
  if (!enemy) { if (typeof toast === 'function') toast('敵データが見つからない', 'r'); return; }
  const maxHp = (typeof getPlayerMaxHp === 'function') ? getPlayerMaxHp() : 20;
  BE = {
    active: true, enemy,
    playerHp: maxHp, playerMaxHp: maxHp,
    moves: beBuildMoves(), martial: {},
    busy: false, turn: 0, log: [],
  };
  document.getElementById('be-ov').classList.add('show');
  beLog(`⚔ ${enemy.jp || enemy.name} が現れた！`);
  beLog('技(単語)を選んで攻撃しよう。同じ技を使い込むと…？');
  beRender();
}

/* ════ プレイヤーの攻撃(技=単語をタップ) ════ */
function beUseMove(idx) {
  if (!BE.active || BE.busy) return;
  const mv = BE.moves[idx];
  if (!mv) return;
  BE.busy = true;
  BE.turn++;

  // ダメージ計算
  const dmg = Math.max(1, beMovePower(mv.word) - (BE.enemy.def || 0));
  BE.enemy.curHp = Math.max(0, BE.enemy.curHp - dmg);
  beLog(`🗡 ${mv.word} ！ ${BE.enemy.jp || BE.enemy.name}に ${dmg} ダメージ`);
  beFloat(dmg, 'enemy');

  // 戦闘熟練度を加算 → 進化(閃き)判定
  BE.martial[mv.word] = (BE.martial[mv.word] || 0) + 1;
  mv.uses = BE.martial[mv.word];
  const evolved = beCheckEvolve(mv, idx);

  beRender();

  // 敵撃破チェック
  if (BE.enemy.curHp <= 0) {
    setTimeout(() => beWin(), evolved ? 900 : 350);
    return;
  }
  // 敵の反撃(閃き演出があった場合は少し待つ)
  setTimeout(() => beEnemyTurn(), evolved ? 1100 : 450);
}

/* ════ 進化(閃き) 判定 ════
   同じ技を BE_EVOLVE_USES 回使ったら、EVOLUTIONの次段へ進化。
   ・技リストのその枠を進化先の単語に置き換える
   ・進化先が未発見なら discover()(= 盤の単語解放と直結)
   ・使用回数はリセット(次の進化に向けてまた使い込める)
   戻り値: 進化が起きたら true */
function beCheckEvolve(mv, idx) {
  if (mv.uses < BE_EVOLVE_USES) return false;
  const next = (typeof EVOLUTION !== 'undefined') ? EVOLUTION[mv.word] : null;
  if (!next || (typeof WM !== 'undefined' && !WM[next])) {
    // これ以上進化しない(系列の最終段)。使用回数だけリセットして据え置き。
    BE.martial[mv.word] = 0; mv.uses = 0;
    return false;
  }
  const from = mv.word;
  // 未発見なら発見処理(盤の単語解放・EXP・図鑑などは既存discoverに委譲)
  const wasUnknown = (typeof gst === 'function') && gst(next) === 'unknown';
  if (wasUnknown && typeof discover === 'function') discover(next, false);
  // 技枠を進化先へ差し替え、熟練度リセット
  delete BE.martial[from];
  BE.martial[next] = 0;
  BE.moves[idx] = { word: next, uses: 0 };
  // 閃き演出(綴り+意味+進化を一緒に見せる = 答え合わせの祝福。クイズではない)
  beFlashEvolve(from, next, wasUnknown);
  return true;
}

/* ════ 敵のターン ════ */
function beEnemyTurn() {
  if (!BE.active) return;
  const e = BE.enemy;
  const def = (typeof getPlayerDef === 'function') ? getPlayerDef() : 0;
  const dmg = Math.max(1, (e.atk || 1) - def);
  BE.playerHp = Math.max(0, BE.playerHp - dmg);
  beLog(`💢 ${e.jp || e.name}の攻撃！ ${dmg} ダメージを受けた`);
  beFloat(dmg, 'player');
  if (BE.playerHp <= 0) { beRender(); setTimeout(() => beLose(), 500); return; }
  // busyを先に解除してから再描画する。逆順にすると技ボタンがdisabledのまま固まる。
  BE.busy = false;
  beRender();
}

/* ════ 勝敗 ════ */
function beWin() {
  const e = BE.enemy;
  const gMul = (typeof getGoldMultiplier === 'function') ? getGoldMultiplier() : 1;
  const aMul = (typeof getAExpMultiplier === 'function') ? getAExpMultiplier() : 1;
  const gold = Math.round((e.reward?.gold || 0) * gMul);
  const aexp = Math.round((e.reward?.aexp || 0) * aMul);
  if (typeof S !== 'undefined') {
    S.gold = (S.gold || 0) + gold;
    S.aexp = (S.aexp || 0) + aexp;
    // アーカイブの欠片ドロップ(集めると単語解放。既存のitem/decodeShardへ接続)
    if (typeof addItem === 'function' && Math.random() < 0.6) {
      const dgId = (typeof DD !== 'undefined' && DD[0]) ? DD[0].id : null;
      addItem('archive_shard', 1, dgId ? { dungeonId: dgId } : null);
      beLog('🔮 アーカイブの欠片を手に入れた！(集めると単語を解放できる)');
    }
    // 撃破記録・図鑑
    if (typeof registerDexMonster === 'function') registerDexMonster(e.id);
    if (typeof save === 'function') save();
  }
  beLog(`🎉 ${e.jp || e.name}を倒した！ 💰+${gold} / 📈+${aexp}`);
  if (typeof updateHdr === 'function') updateHdr();
  beShowResult(true);
}
function beLose() {
  beLog('💀 倒れてしまった…（試作のためペナルティなし）');
  beShowResult(false);
}

/* ════ 終了 → ワールドへ戻る ════ */
function beEnd() {
  BE.active = false;
  document.getElementById('be-ov').classList.remove('show');
  const res = document.getElementById('be-result');
  if (res) res.classList.remove('show');
  // ワールドマップの描画ループを再開(world.js)
  if (typeof WORLD_show === 'function' && typeof WORLD !== 'undefined' && WORLD.grid) {
    WORLD_show();
  }
}

/* ════════════════════════════════════════════════
   描画・演出
════════════════════════════════════════════════ */
function beRender() {
  const e = BE.enemy;
  // 敵情報
  const eIcon = document.getElementById('be-enemy-icon'); if (eIcon) eIcon.textContent = e.icon || '👾';
  const eName = document.getElementById('be-enemy-name'); if (eName) eName.textContent = `${e.jp || e.name} (${e.name})`;
  const eHpPct = e.hp ? Math.max(0, Math.round(e.curHp / e.hp * 100)) : 0;
  const eFill = document.getElementById('be-enemy-hpfill'); if (eFill) eFill.style.width = eHpPct + '%';
  const eHpTxt = document.getElementById('be-enemy-hptxt'); if (eHpTxt) eHpTxt.textContent = `${e.curHp}/${e.hp}`;

  // プレイヤーHP
  const pPct = BE.playerMaxHp ? Math.max(0, Math.round(BE.playerHp / BE.playerMaxHp * 100)) : 0;
  const pFill = document.getElementById('be-player-hpfill');
  if (pFill) { pFill.style.width = pPct + '%'; pFill.classList.toggle('low', pPct <= 25); }
  const pTxt = document.getElementById('be-player-hptxt'); if (pTxt) pTxt.textContent = `${BE.playerHp}/${BE.playerMaxHp}`;

  // 技(単語)ボタン: 使用回数を進化ゲージとして可視化(あと何回で閃くか)
  const list = document.getElementById('be-moves');
  if (list) {
    list.innerHTML = BE.moves.map((mv, i) => {
      const col = beMoveColor(mv.word);
      const w = (typeof WM !== 'undefined') ? WM[mv.word] : null;
      const pow = beMovePower(mv.word);
      const canEvolve = (typeof EVOLUTION !== 'undefined') && EVOLUTION[mv.word] && WM && WM[EVOLUTION[mv.word]];
      const uses = mv.uses || 0;
      const gaugePct = canEvolve ? Math.min(100, Math.round(uses / BE_EVOLVE_USES * 100)) : 0;
      const evoHint = canEvolve
        ? `<div class="be-move-evo"><div class="be-move-evobar"><div class="be-move-evofill" style="width:${gaugePct}%;background:${col}"></div></div><span>閃きまで ${Math.max(0, BE_EVOLVE_USES - uses)}</span></div>`
        : `<div class="be-move-evo be-move-evomax">極 (最終形)</div>`;
      return `<button class="be-move" style="border-color:${col}44" onclick="beUseMove(${i})" ${BE.busy ? 'disabled' : ''}>
        <div class="be-move-top">
          <span class="be-move-word" style="color:${col}">${mv.word}</span>
          <span class="be-move-pow">⚔${pow}</span>
        </div>
        <div class="be-move-mean">${w ? w.meaning : ''}</div>
        ${evoHint}
      </button>`;
    }).join('');
  }
  beRenderLog();
}

function beRenderLog() {
  const el = document.getElementById('be-log');
  if (el) el.innerHTML = BE.log.map(l => `<div class="be-log-line">${l}</div>`).join('');
}
function beLog(msg) {
  BE.log.unshift(msg);
  if (BE.log.length > 8) BE.log.pop();
  beRenderLog();
}

/* フローティングダメージ(中央付近に一瞬表示。ダンジョンのdmShowFloatDamageの軽量版) */
function beFloat(amount, kind) {
  const stage = document.getElementById('be-stage');
  if (!stage) return;
  const el = document.createElement('div');
  el.className = 'be-float ' + (kind || 'enemy');
  el.textContent = (kind === 'heal' ? '+' : '') + amount;
  // 敵側は上、プレイヤー側は下に出す
  el.style.left = (kind === 'player' ? 30 : 62) + '%';
  el.style.top = (kind === 'player' ? 62 : 26) + '%';
  stage.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

/* 閃き演出: 進化の瞬間に「綴り+意味+進化」を中央にフラッシュ表示。
   クイズではなく"答え合わせの祝福"。ここが本試作の検証対象。 */
function beFlashEvolve(from, to, wasUnknown) {
  const wFrom = (typeof WM !== 'undefined') ? WM[from] : null;
  const wTo = (typeof WM !== 'undefined') ? WM[to] : null;
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
    <div class="be-flash-mean">${wFrom ? wFrom.meaning : ''} → <b>${wTo ? wTo.meaning : ''}</b></div>
    ${wasUnknown ? `<div class="be-flash-new">✦ 新しい単語「${to}」を発見！ ✦</div>` : ''}`;
  fl.classList.remove('show');
  void fl.offsetWidth; // リフローで再トリガー
  fl.classList.add('show');
  beLog(`⚡ ${from} を使い込み、${to} を閃いた！${wasUnknown ? '（新発見）' : ''}`);
  setTimeout(() => fl.classList.remove('show'), wasUnknown ? 1900 : 1500);
}

/* 勝敗リザルト */
function beShowResult(win) {
  BE.busy = true;
  const res = document.getElementById('be-result');
  if (!res) { beEnd(); return; }
  document.getElementById('be-result-title').textContent = win ? '⚔ BATTLE WON' : '× BATTLE LOST';
  document.getElementById('be-result-title').className = 'be-result-title ' + (win ? 'win' : 'lose');
  res.classList.add('show');
}
