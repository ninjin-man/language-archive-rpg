/* ════ PLAYER COMBAT STATS ════
   改修(MVPローグライク化アップデート): 戦闘モーダル・攻撃ボタン・戦闘確認画面を廃止。
   戦闘はダンジョン内の接触攻撃(dungeon.js: dmContactAttack/dmEnemyTurn)に統合された。
   ここにはダンジョン側からも参照される基礎ステータス計算のみを残す。 */
const PLAYER_BASE_HP=20;
const PLAYER_BASE_ATK=3;

function getPlayerMaxHp(){
  return PLAYER_BASE_HP+(S.stats?.hp||0);
}
// ATK includes permanent stat growth + Warrior job bonus (ATK +20%)
function getPlayerAtk(){
  const base=PLAYER_BASE_ATK+(S.stats?.atk||0);
  return Math.round(base*(1+getJobBonus('atk')));
}
