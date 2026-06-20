/* ════ PLAYER COMBAT STATS ════
   改修(MVPローグライク化アップデート): 戦闘モーダル・攻撃ボタン・戦闘確認画面を廃止。
   戦闘はダンジョン内の接触攻撃(dungeon.js: dmContactAttack/dmEnemyTurn)に統合された。
   ここにはダンジョン側からも参照される基礎ステータス計算のみを残す。 */
const PLAYER_BASE_HP=20;
const PLAYER_BASE_ATK=3;
const PLAYER_BASE_DEF=0;   // Phase11/12: レベルアップでのみ成長する新規ステータス
const PLAYER_BASE_REGEN=1; // Phase14: 自然回復用ステータス。Lv1でも機能するよう基礎値を1に設定(レベルアップで追加成長)

/* ════ Phase26: 装備ボーナス ════
   S.equipment = {weapon, shield, accessory} (各 {id,rarity} または null)。
   装備の実効ステータス(getEquipStats)を合算して返す。 */
function getEquipBonus(stat){
  const eq=S.equipment||{};
  let sum=0;
  ['weapon','shield','accessory'].forEach(slot=>{
    const st=getEquipStats(eq[slot]);
    if(st[stat])sum+=st[stat];
  });
  return sum;
}

function getPlayerMaxHp(){
  return PLAYER_BASE_HP+(S.stats?.hp||0)+getEquipBonus('hp');
}
// ATK includes permanent stat growth + Warrior job bonus (ATK +20%) + 装備武器(Phase26)
function getPlayerAtk(){
  const base=PLAYER_BASE_ATK+(S.stats?.atk||0)+getEquipBonus('atk');
  return Math.round(base*(1+getJobBonus('atk')));
}
function getPlayerDef(){
  return PLAYER_BASE_DEF+(S.stats?.def||0)+getEquipBonus('def');
}
function getPlayerRegen(){
  return PLAYER_BASE_REGEN+(S.stats?.regen||0)+getEquipBonus('regen');
}
