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
  ['weapon','shield','armor','accessory'].forEach(slot=>{
    const st=getEquipStats(eq[slot]);
    if(st[stat])sum+=st[stat];
  });
  return sum;
}

/* ════ UX統合#2a: 語彙パッシブ — 覚えた言葉がそのまま力になる ════
   learned(習熟2)以上の語数がHPに、skilled(3+)がATKに、master(4)がDEFに直結。
   「単語を深く学ぶこと＝レベルアップ」という語学RPGの中核配線。 */
function getVocabBonus(stat){
  if(typeof WD==='undefined'||typeof gsi!=='function')return 0;
  let l=0,s=0,m=0;
  WD.forEach(w=>{const g=gsi(w.word);if(g>=2)l++;if(g>=3)s++;if(g>=4)m++;});
  if(stat==='hp')return l;                 // 習得語1つ = HP+1
  if(stat==='atk')return Math.floor(s/3);  // skilled 3語 = ATK+1
  if(stat==='def')return Math.floor(m/4);  // master 4語 = DEF+1
  return 0;
}
/* ════ UX統合#2b: 装備スキル — Skill Forgeの成果を戦闘力に接続 ════
   S.equippedSkills(skills.jsの既存装備UI)のstats{atk,hp}を合算する。
   これまで作ったスキルはどこにも参照されない死蔵だった。spdは将来の行動速度用に温存。 */
function getSkillBonus(stat){
  const ids=S.equippedSkills||[];let sum=0;
  ids.forEach(id=>{
    if(!id)return;
    const sk=(S.skills||[]).find(s=>s.id===id);
    if(sk&&sk.stats&&sk.stats[stat])sum+=sk.stats[stat];
  });
  return sum;
}

function getPlayerMaxHp(){
  return PLAYER_BASE_HP+(S.stats?.hp||0)+getEquipBonus('hp')+getVocabBonus('hp')+getSkillBonus('hp');
}
// ATK includes permanent stat growth + Warrior job bonus (ATK +20%) + 装備武器(Phase26) + 語彙/スキル(UX統合)
function getPlayerAtk(){
  const base=PLAYER_BASE_ATK+(S.stats?.atk||0)+getEquipBonus('atk')+getVocabBonus('atk')+getSkillBonus('atk');
  return Math.round(base*(1+getJobBonus('atk')));
}
function getPlayerDef(){
  return PLAYER_BASE_DEF+(S.stats?.def||0)+getEquipBonus('def')+getVocabBonus('def')+getSkillBonus('def');
}
function getPlayerRegen(){
  return PLAYER_BASE_REGEN+(S.stats?.regen||0)+getEquipBonus('regen');
}
