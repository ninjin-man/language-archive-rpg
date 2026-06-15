/* ════ BATTLE SYSTEM (Phase8: 戦闘システム) ════ */
// Base player combat stats (S.stats.atk/hp are permanent bonuses from Phase2 archive growth)
const PLAYER_BASE_HP=20;
const PLAYER_BASE_ATK=3;

function getPlayerMaxHp(){
  const warriorBonus=1+getJobBonus('atk')*0; // HP itself isn't boosted by Warrior; kept for clarity
  return PLAYER_BASE_HP+(S.stats?.hp||0);
}
// ATK includes permanent stat growth + Warrior job bonus (ATK +20%)
function getPlayerAtk(){
  const base=PLAYER_BASE_ATK+(S.stats?.atk||0);
  return Math.round(base*(1+getJobBonus('atk')));
}

// Start a battle against an enemy appropriate for the current floor (Phase7 floor tiers apply)
function startBattle(){
  const enemy=pickEnemyForFloor(DM.floor);
  DM.battle={
    enemy:{...enemy,curHp:enemy.hp},
    playerHp:getPlayerMaxHp(),
    playerMaxHp:getPlayerMaxHp(),
    log:[`👾 ${enemy.icon} ${enemy.name} が現れた！`],
    over:false,
    result:null, // 'win'|'lose'
  };
  DM.pending=null;
  document.getElementById('dmov').classList.remove('show');
  renderBattle();
  document.getElementById('battle-ov').classList.add('show');
}

function battleLog(msg){
  DM.battle.log.unshift(msg);
  if(DM.battle.log.length>8)DM.battle.log.pop();
}

// Render the battle modal: enemy/player HP bars, equipped skill buttons, log
function renderBattle(){
  const b=DM.battle;if(!b)return;
  const e=b.enemy;
  const ehpPct=Math.max(0,Math.round(e.curHp/e.hp*100));
  const phpPct=Math.max(0,Math.round(b.playerHp/b.playerMaxHp*100));

  // Equipped skills as attack options
  const eq=(S.equippedSkills||[]).map(id=>id?(S.skills||[]).find(s=>s.id===id):null);
  const skillBtns=eq.map((sk,i)=>{
    if(!sk)return `<button class="batk-btn" disabled>Slot ${i+1}: 空欄</button>`;
    const atkAdd=sk.stats?.atk||0;
    return `<button class="batk-btn" ${b.over?'disabled':''} onclick="battleAttack('${sk.id}')">
      ${sk.name} <span class="batk-fx">(ATK+${atkAdd})</span>
    </button>`;
  }).join('');

  document.getElementById('battle-body').innerHTML=`
    <div class="bf-enemy">
      <div class="bf-name">${e.icon} ${e.name}</div>
      <div class="bf-hpbar"><div class="bf-hpfill enemy" style="width:${ehpPct}%"></div></div>
      <div class="bf-hptxt">${Math.max(0,e.curHp)} / ${e.hp} HP</div>
    </div>
    <div class="bf-player">
      <div class="bf-name">🧑 あなた</div>
      <div class="bf-hpbar"><div class="bf-hpfill player" style="width:${phpPct}%"></div></div>
      <div class="bf-hptxt">${Math.max(0,b.playerHp)} / ${b.playerMaxHp} HP</div>
    </div>
    <div class="bf-actions">
      <button class="batk-btn batk-basic" ${b.over?'disabled':''} onclick="battleAttack(null)">👊 攻撃 (ATK+0)</button>
      ${skillBtns}
    </div>
    <div class="bf-log">${b.log.map(l=>`<div class="bf-log-line">${l}</div>`).join('')}</div>
    ${b.over?`<button class="cact" onclick="closeBattle()">${b.result==='win'?'✓ 戦闘終了':'🏃 帰還する'}</button>`:''}
  `;
}

// Player attacks (optionally using an equipped skill for bonus ATK), then enemy counter-attacks.
// Damage formula (Phase8 item5): max(1, PlayerATK + SkillATK - EnemyDEF)
function battleAttack(skillId){
  const b=DM.battle;if(!b||b.over)return;
  const sk=skillId?(S.skills||[]).find(s=>s.id===skillId):null;
  const skillAtk=sk?.stats?.atk||0;
  const playerAtk=getPlayerAtk()+skillAtk;
  const dmgToEnemy=Math.max(1,playerAtk-(b.enemy.def||0));
  b.enemy.curHp-=dmgToEnemy;
  battleLog(`⚔ ${sk?sk.name:'攻撃'}！ ${b.enemy.name}に${dmgToEnemy}ダメージ`);

  if(b.enemy.curHp<=0){
    b.over=true;b.result='win';
    battleLog(`🎉 ${b.enemy.name}を倒した！`);
    onBattleWin(b.enemy);
    renderBattle();
    return;
  }

  // Enemy counter-attack
  const dmgToPlayer=Math.max(1,(b.enemy.atk||1)-Math.floor((S.stats?.hp||0)/10)); // HP育成は軽い防御として反映(仮値)
  b.playerHp-=dmgToPlayer;
  battleLog(`💢 ${b.enemy.name}の攻撃！ ${dmgToPlayer}ダメージを受けた`);

  if(b.playerHp<=0){
    b.over=true;b.result='lose';
    battleLog(`💀 倒れてしまった…ダンジョンから帰還する`);
    onBattleLose();
  }
  renderBattle();
}

// Victory rewards (Phase8 item7): Gold, Archive EXP, 単語発見率上昇(このダンジョン探索中のみ)
function onBattleWin(enemy){
  const goldGain=Math.round((enemy.reward?.gold||0)*getGoldMultiplier());
  const aexpGain=Math.round((enemy.reward?.aexp||0)*getAExpMultiplier());
  S.gold=(S.gold||0)+goldGain;
  S.aexp=(S.aexp||0)+aexpGain;
  // 討伐数を記録 (Phase7 item6)
  S.dungeonRecords=S.dungeonRecords||{maxFloor:0,totalRuns:0,kills:0};
  S.dungeonRecords.kills++;
  DM.kills=(DM.kills||0)+1;
  // 単語発見率上昇: このダンジョン探索中だけ+5%(プレイヤーレベルは追加しない、Phase8 item8)
  DM.battleDiscoverBonus=(DM.battleDiscoverBonus||0)+0.05;
  save();updateHdr();
  battleLog(`💰 +${goldGain} Gold / 📈 +${aexpGain} Archive EXP / 🔍 単語発見率+5%(このダンジョン探索中)`);
}

// Defeat (Phase8 item9): ダンジョンから帰還、獲得済み単語は保持、進行フロアのみ失う
function onBattleLose(){
  toast('💀 敗北…ダンジョンから帰還した','g');
}

function closeBattle(){
  document.getElementById('battle-ov').classList.remove('show');
  const b=DM.battle;
  if(b&&b.result==='lose'){
    // 進行フロアをリセットして帰還(獲得した単語/Gold/レリック等はSに保存済みのため保持される)
    DM.battle=null;
    closeDmap();
    return;
  }
  DM.battle=null;
  document.getElementById('dmov').classList.add('show');
  dmRender();
}
