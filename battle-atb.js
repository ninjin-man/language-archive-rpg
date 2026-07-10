/* ════════════════════════════════════════════════════════════════════
   BATTLE ATB — アクティブタイムバトル版 (SO風の"待ちのない流れ")

   ── なぜATBなのか ──
   添付のSO(スターオーシャン)戦闘の面白さを分解すると3つある:
     (a) 間合いと踏み込み  (b) 攻撃の硬直と隙  (c) 待ちのない流れ
   このうち iPhoneのタッチで再現でき、かつ「単語を読む」時間を殺さないのは (c) だけ。
   (a)(b)を素朴に持ち込むと、プレイヤーは色と位置で判断するようになり
   単語が飾りになる = このゲームの核が死ぬ。

   そこで (c) だけを取り出す。それがATB。
   実際SOのリアルタイム戦闘は「ATBの待ち時間をゼロにしたもの」であり、
   ATBはSOの正統な祖先にあたる。

   ── ATBで何が変わるか ──
   ターン制: Fireを押す → 敵が殴る → Fireを押す (交互・待ちがある)
   ATB     : ゲージが溜まる → 好きな技を撃つ → また溜まる
             その間、敵のゲージも独立して進み続ける

   つまり「敵の溜めが完成する前に、自分のゲージを溜めて弱点技をぶつけられるか」
   という時間の競争になる。ブレイク(溜め潰し)がターン数でなく"秒"の緊張になり、
   「間に合え！」という感覚が生まれる。これがSOから継承すべき本質。

   ── 単語を読む時間は守る ──
   ゲージが溜まるまでの数秒、プレイヤーは技を選べる。
   さらに ATB_WAIT_MODE=true なら「技を選んでいる間は時間が止まる」(FFのウェイト式)。
   アクティブ/ウェイトは beAtbToggleWait() で切り替え可能。

   ── 既存資産の再利用 ──
   battle-encounter.js の純粋関数をそのまま使う(グローバル関数なので直接呼べる):
     beBuildMoves / beMovePower / beMoveColor / beAffinity / beDamage / beMakeEnemy
     BE_* 定数群 / BE_OPPOSITE / BE_ENEMY_ATTR / BE_ATTR_ICON
   ターン制版(battle-encounter.js)は無改変で温存し、比較できるようにしている。

   ── 本編の作法 ──
   バニラJS・グローバル関数・フラット構造・600行制限。ES6 classは使わない。
   時間進行は requestAnimationFrame (setIntervalはiOSのタブ復帰で破綻するため)。
════════════════════════════════════════════════════════════════════ */

/* ════ 戦闘モードの切替 ════
   'atb'  = このファイル(アクティブタイムバトル)
   'turn' = battle-encounter.js (ターン制)
   両方を残して比較できるようにしている。コンソールで BATTLE_MODE='turn' と
   書き換えれば、次の戦闘からターン制になる。 */
let BATTLE_MODE = 'atb';

/* ════ 時間設計(ミリ秒) ════
   速すぎると考える暇がなく、遅いと退屈になる。
   「敵が溜め始めてから発動するまでに、プレイヤーのゲージがぎりぎり1回満ちる」
   ように調整してある(溜め3500ms > プレイヤー2400ms)。これがブレイクの緊張を生む。 */
const ATB_PLAYER_FILL = 2400;  // プレイヤーのゲージが満ちるまで
const ATB_ENEMY_FILL  = 2800;  // 敵の通常行動サイクル(プレイヤーより少し遅い=有利)
const ATB_CHARGE_TIME = 3500;  // 敵が溜めを宣言してから発動するまで
const ATB_GUARD_TIME  = 2600;  // 敵の構えが解けるまで
const ATB_ACT_FREEZE  = 420;   // 行動演出中に時間を止める長さ

let ATB_WAIT_MODE = false;     // true=技選択中は時間が止まる(FFウェイト式)

/* ════ ランタイム状態 ════ */
let AB = {
  active:false, enemy:null,
  playerHp:0, playerMaxHp:0,
  moves:[], martial:{},
  pGauge:0,        // 0..1 プレイヤーのATBゲージ
  eGauge:0,        // 0..1 敵のATBゲージ
  eTimer:0,        // 溜め/構えの経過時間(ms)
  freeze:0,        // 演出で時間を止める残り(ms)
  raf:null, last:0,
  log:[], over:false,
};

/* ════ 開始 ════ */
function abStart(enemyId) {
  const baseHp = (typeof getPlayerMaxHp==='function') ? getPlayerMaxHp() : 20;
  const maxHp = Math.max(10, Math.round(baseHp * BE_PLAYER_HP_MUL));
  const enemy = beMakeEnemy(enemyId, maxHp);   // 相対スケーリングを再利用
  if (!enemy) { if (typeof toast==='function') toast('敵データが見つからない','r'); return; }

  AB = { active:true, enemy, playerHp:maxHp, playerMaxHp:maxHp,
         moves:beBuildMoves(), martial:{},
         pGauge:0, eGauge:0, eTimer:0, freeze:0, raf:null, last:0, log:[], over:false };

  const ov = document.getElementById('ab-ov');
  if (ov) ov.classList.add('show');
  const ai = enemy.attr ? `${BE_ATTR_ICON[enemy.attr]||''}${enemy.attr}` : '無属性';
  abLog(`⚔ ${enemy.jp||enemy.name} が現れた！（属性: ${ai}）`);
  if (enemy.attr) abLog(`💡 弱点: ${(BE_OPPOSITE[enemy.attr]||[]).join('・')}`);
  abLog(ATB_WAIT_MODE ? '⏸ ウェイト式（技を選ぶ間は時間が止まる）'
                      : '▶ アクティブ式（選んでいる間も敵は動く）');
  abDecideIntent();
  abRender();
  AB.last = performance.now();
  AB.raf = requestAnimationFrame(abLoop);
}

/* ════ メインループ(時間進行) ════ */
function abLoop(now) {
  if (!AB.active) return;
  let dt = now - AB.last;
  AB.last = now;
  if (dt > 100) dt = 100;   // タブ復帰などの巨大なdtを抑制

  if (AB.over) { AB.raf = requestAnimationFrame(abLoop); return; }

  // 演出中は時間を止める(閃きフラッシュ中に殴られない)
  if (AB.freeze > 0) { AB.freeze -= dt; abRender(); AB.raf = requestAnimationFrame(abLoop); return; }

  // ウェイト式: プレイヤーのゲージが満タン(=行動待ち)なら時間を止める
  const playerReady = AB.pGauge >= 1;
  const frozen = ATB_WAIT_MODE && playerReady;

  if (!frozen) {
    if (!playerReady) AB.pGauge = Math.min(1, AB.pGauge + dt / ATB_PLAYER_FILL);
    abEnemyTick(dt);
  }
  abRender();
  AB.raf = requestAnimationFrame(abLoop);
}

/* ════ 敵の時間進行 ════
   通常はゲージが満ちたら行動を決めて実行。
   溜め(charging)は eTimer が ATB_CHARGE_TIME に達したら大技が発動する。
   → プレイヤーはそれまでに自分のゲージを溜めて弱点技でブレイクを狙う。 */
function abEnemyTick(dt) {
  const e = AB.enemy;
  if (!e) return;

  if (e.state === 'charging') {
    AB.eTimer += dt;
    if (AB.eTimer >= ATB_CHARGE_TIME) {
      const def = (typeof getPlayerDef==='function') ? getPlayerDef() : 0;
      const dmg = Math.max(1, Math.round((e.atk||1) * BE_CHARGE_MULT) - def);
      AB.playerHp = Math.max(0, AB.playerHp - dmg);
      abLog(`💥 ${e.jp||e.name}の渾身の一撃！ ${dmg} ダメージ`);
      abFloat(dmg, 'player');
      e.state = 'normal'; AB.eTimer = 0; AB.eGauge = 0;
      AB.freeze = ATB_ACT_FREEZE;
      abDecideIntent();
      if (AB.playerHp <= 0) return abLose();
    }
    return;
  }

  if (e.state === 'guarding') {
    AB.eTimer += dt;
    if (AB.eTimer >= ATB_GUARD_TIME) {
      e.state = 'normal'; AB.eTimer = 0; AB.eGauge = 0;
      abLog(`🛡 ${e.jp||e.name}の構えが解けた`);
      abDecideIntent();
    }
    return;
  }

  // 通常: ゲージを進め、満ちたら intent を実行
  AB.eGauge = Math.min(1, AB.eGauge + dt / ATB_ENEMY_FILL);
  if (AB.eGauge >= 1) {
    AB.eGauge = 0;
    if (e.intent === 'charge') {
      e.state = 'charging'; AB.eTimer = 0;
      abLog(`⚡ ${e.jp||e.name}が力を溜め始めた…（弱点技で潰せ！）`);
    } else if (e.intent === 'guard') {
      e.state = 'guarding'; AB.eTimer = 0;
      abLog(`🛡 ${e.jp||e.name}は身構えた`);
    } else {
      const def = (typeof getPlayerDef==='function') ? getPlayerDef() : 0;
      const dmg = Math.max(1, (e.atk||1) - def);
      AB.playerHp = Math.max(0, AB.playerHp - dmg);
      abLog(`💢 ${e.jp||e.name}の攻撃！ ${dmg} ダメージ`);
      abFloat(dmg, 'player');
      AB.freeze = ATB_ACT_FREEZE;
      abDecideIntent();
      if (AB.playerHp <= 0) return abLose();
    }
  }
}

/* 次の行動を決める(HPが減るほど溜めを狙う) */
function abDecideIntent() {
  const e = AB.enemy;
  if (!e) return;
  const hpR = e.curHp / e.hp;
  const r = Math.random();
  const chargeP = hpR < 0.4 ? 0.42 : 0.28;
  const guardP  = (e.def > 0 && hpR < 0.6) ? 0.18 : 0.08;
  if (r < chargeP)             e.intent = 'charge';
  else if (r < chargeP+guardP) e.intent = 'guard';
  else                         e.intent = 'attack';
}

/* ════ プレイヤーの行動(ゲージ満タンでのみ発動) ════ */
function abUseMove(idx) {
  if (!AB.active || AB.over || AB.pGauge < 1) return;
  const mv = AB.moves[idx];
  if (!mv) return;
  const e = AB.enemy;

  const res = beDamage(mv.word, e);   // 相性+DEF軽減を再利用
  const aff = res.aff;
  let dmg = res.dmg;

  // 敵の状態補正 + ブレイク判定
  let broke = false;
  if (e.state === 'charging') {
    dmg = Math.round(dmg * BE_CHARGE_TAKEN);
    if (aff.kind === 'weak') { dmg = Math.round(dmg * BE_BREAK_BONUS); broke = true; }
  } else if (e.state === 'guarding') {
    dmg = Math.round(dmg * BE_GUARD_CUT);
  }
  dmg = Math.max(1, dmg);
  e.curHp = Math.max(0, e.curHp - dmg);

  let tag = '';
  if (aff.kind === 'weak')   tag = ' 🎯弱点！';
  if (aff.kind === 'resist') tag = ' 🛡効果は薄い…';
  abLog(`🗡 ${mv.word}！ ${dmg} ダメージ${tag}`);
  abFloat(dmg, 'enemy', aff.kind);

  if (broke) {
    // 溜めを間に合って潰した = ATBの主役となる瞬間
    e.state = 'normal'; AB.eTimer = 0; AB.eGauge = 0;
    abLog(`💥 溜めを打ち砕いた！ ${e.jp||e.name}は体勢を崩した`);
    abDecideIntent();
  }

  // 戦闘熟練度 → 進化(閃き)
  AB.martial[mv.word] = (AB.martial[mv.word]||0) + 1;
  mv.uses = AB.martial[mv.word];
  const evolved = abCheckEvolve(mv, idx);

  // ゲージを消費。演出中は時間を止める
  AB.pGauge = 0;
  AB.freeze = evolved ? 1200 : ATB_ACT_FREEZE;

  abRender();
  if (e.curHp <= 0) { setTimeout(() => abWin(), evolved ? 900 : 320); }
}

/* ════ 進化(閃き) ════ ターン制版と同じ思想。演出関数は共有する。 */
function abCheckEvolve(mv, idx) {
  if (mv.uses < BE_EVOLVE_USES) return false;
  const next = (typeof EVOLUTION !== 'undefined') ? EVOLUTION[mv.word] : null;
  if (!next || (typeof WM !== 'undefined' && !WM[next])) {
    AB.martial[mv.word] = 0; mv.uses = 0; return false;
  }
  const from = mv.word;
  const wasUnknown = (typeof gst==='function') && gst(next) === 'unknown';
  if (wasUnknown && typeof discover === 'function') discover(next, false);
  delete AB.martial[from];
  AB.martial[next] = 0;
  AB.moves[idx] = { word:next, uses:0 };
  abFlashEvolve(from, next, wasUnknown);
  return true;
}

/* ════ 勝敗・終了 ════ */
function abWin() {
  if (AB.over) return;
  AB.over = true;
  const e = AB.enemy;
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
      abLog('🔮 アーカイブの欠片を手に入れた！');
    }
    if (typeof registerDexMonster==='function') registerDexMonster(e.id);
    if (typeof save==='function') save();
  }
  abLog(`🎉 ${e.jp||e.name}を倒した！ 💰+${gold} / 📈+${aexp}`);
  if (typeof updateHdr==='function') updateHdr();
  abShowResult(true);
}
function abLose() {
  if (AB.over) return;
  AB.over = true;
  abLog('💀 倒れてしまった…（試作のためペナルティなし）');
  abShowResult(false);
}
function abShowResult(win) {
  const res = document.getElementById('ab-result');
  if (!res) return abEnd();
  const t = document.getElementById('ab-result-title');
  if (t) {
    t.textContent = win ? '⚔ BATTLE WON' : '× BATTLE LOST';
    t.className = 'be-result-title ' + (win ? 'win' : 'lose');
  }
  res.classList.add('show');
}
function abEnd() {
  AB.active = false;
  if (AB.raf) { cancelAnimationFrame(AB.raf); AB.raf = null; }
  const ov = document.getElementById('ab-ov');
  if (ov) ov.classList.remove('show');
  const res = document.getElementById('ab-result');
  if (res) res.classList.remove('show');
  if (typeof WORLD_show==='function' && typeof WORLD!=='undefined' && WORLD.grid) WORLD_show();
}

/* ウェイト/アクティブの切り替え(戦闘中でも可) */
function abToggleWait() {
  ATB_WAIT_MODE = !ATB_WAIT_MODE;
  abLog(ATB_WAIT_MODE ? '⏸ ウェイト式に切替（選ぶ間は時間が止まる）'
                      : '▶ アクティブ式に切替（選ぶ間も敵は動く）');
  abRender();
}

/* ════════════════════════════════════════════════
   描画
════════════════════════════════════════════════ */
function abRender() {
  const e = AB.enemy;
  if (!e) return;
  const $ = id => document.getElementById(id);

  if ($('ab-enemy-icon')) $('ab-enemy-icon').textContent = e.icon || '👾';
  if ($('ab-enemy-name')) {
    const at = e.attr ? ` ${BE_ATTR_ICON[e.attr]||''}${e.attr}` : '';
    $('ab-enemy-name').textContent = `${e.jp||e.name} (${e.name})${at}`;
  }
  const eHpPct = e.hp ? Math.max(0, Math.round(e.curHp/e.hp*100)) : 0;
  if ($('ab-enemy-hpfill')) $('ab-enemy-hpfill').style.width = eHpPct + '%';
  if ($('ab-enemy-hptxt')) $('ab-enemy-hptxt').textContent = `${e.curHp}/${e.hp}`;

  // 敵のゲージ: 通常は行動までの進行、溜め中は"発動までの残り時間"を赤く見せる
  const eg = $('ab-enemy-gauge');
  if (eg) {
    let pct, cls;
    if (e.state === 'charging') { pct = Math.min(100, AB.eTimer/ATB_CHARGE_TIME*100); cls = 'ab-gauge-fill charge'; }
    else if (e.state === 'guarding') { pct = Math.min(100, AB.eTimer/ATB_GUARD_TIME*100); cls = 'ab-gauge-fill guard'; }
    else { pct = AB.eGauge*100; cls = 'ab-gauge-fill enemy'; }
    eg.style.width = pct + '%';
    eg.className = cls;
  }
  const et = $('ab-enemy-state');
  if (et) {
    let txt = '', cls = 'be-intent';
    if (e.state === 'charging')      { txt = '⚡ 溜め中！ 弱点技で潰せ'; cls += ' charging'; }
    else if (e.state === 'guarding') { txt = '🛡 構え中 — 攻撃が通りにくい'; cls += ' guarding'; }
    else if (e.intent === 'charge')  { txt = '⚡ 次は溜めてくる'; cls += ' warn'; }
    else if (e.intent === 'guard')   { txt = '🛡 次は身構える'; cls += ' warn'; }
    else                             { txt = '💢 次は攻撃'; cls += ' normal'; }
    et.textContent = txt; et.className = cls;
  }

  // プレイヤー
  const pPct = AB.playerMaxHp ? Math.max(0, Math.round(AB.playerHp/AB.playerMaxHp*100)) : 0;
  if ($('ab-player-hpfill')) {
    $('ab-player-hpfill').style.width = pPct + '%';
    $('ab-player-hpfill').classList.toggle('low', pPct <= 25);
  }
  if ($('ab-player-hptxt')) $('ab-player-hptxt').textContent = `${AB.playerHp}/${AB.playerMaxHp}`;

  // プレイヤーのATBゲージ(満タンで光る = 行動できる合図)
  const ready = AB.pGauge >= 1;
  const pg = $('ab-player-gauge');
  if (pg) { pg.style.width = (AB.pGauge*100) + '%'; pg.className = 'ab-gauge-fill player' + (ready?' ready':''); }
  const pl = $('ab-player-gauge-label');
  if (pl) pl.textContent = ready ? '⚡ READY' : 'ATB';

  // モード表示
  const mb = $('ab-mode');
  if (mb) mb.textContent = ATB_WAIT_MODE ? '⏸ WAIT' : '▶ ACTIVE';

  // 技ボタン(ゲージが満タンでないと押せない)
  const list = $('ab-moves');
  if (list) {
    list.innerHTML = AB.moves.map((mv,i) => {
      const col = beMoveColor(mv.word);
      const w = (typeof WM!=='undefined') ? WM[mv.word] : null;
      const res = beDamage(mv.word, e);
      const aff = res.aff, pow = res.dmg;
      const affTag = aff.kind==='weak'   ? ` <span class="be-aff weak">🎯</span>`
                   : aff.kind==='resist' ? ` <span class="be-aff resist">🛡</span>` : '';
      const canEvo = (typeof EVOLUTION!=='undefined') && EVOLUTION[mv.word] && WM && WM[EVOLUTION[mv.word]];
      const uses = mv.uses||0;
      const pct = canEvo ? Math.min(100, Math.round(uses/BE_EVOLVE_USES*100)) : 0;
      const evo = canEvo
        ? `<div class="be-move-evo"><div class="be-move-evobar"><div class="be-move-evofill" style="width:${pct}%;background:${col}"></div></div><span>閃き ${Math.max(0,BE_EVOLVE_USES-uses)}</span></div>`
        : `<div class="be-move-evo be-move-evomax">極</div>`;
      return `<button class="be-move${aff.kind==='weak'?' weak':''}" style="border-color:${col}44" onclick="abUseMove(${i})" ${ready?'':'disabled'}>
        <div class="be-move-top">
          <span class="be-move-word" style="color:${col}">${mv.word}</span>
          <span class="be-move-pow">⚔${pow}${affTag}</span>
        </div>
        <div class="be-move-mean">${w?w.meaning:''}</div>
        ${evo}
      </button>`;
    }).join('');
  }
  abRenderLog();
}

function abRenderLog() {
  const el = document.getElementById('ab-log');
  if (el) el.innerHTML = AB.log.map(l => `<div class="be-log-line">${l}</div>`).join('');
}
function abLog(msg) { AB.log.unshift(msg); if (AB.log.length>8) AB.log.pop(); abRenderLog(); }

function abFloat(amount, kind, affKind) {
  const stage = document.getElementById('ab-stage');
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

/* 閃き演出(ターン制版と同じ。クイズではなく祝福) */
function abFlashEvolve(from, to, wasUnknown) {
  const wFrom = (typeof WM!=='undefined') ? WM[from] : null;
  const wTo   = (typeof WM!=='undefined') ? WM[to]   : null;
  const fl = document.getElementById('ab-flash');
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
  abLog(`⚡ ${from} を使い込み、${to} を閃いた！${wasUnknown?'（新発見）':''}`);
  setTimeout(() => fl.classList.remove('show'), wasUnknown ? 1900 : 1500);
}

/* 読込確認(実機デバッグ用): コンソールに出れば battle-atb.js は読めている */
if (typeof console !== 'undefined') console.log('[battle-atb] loaded. BATTLE_MODE=' + BATTLE_MODE);
