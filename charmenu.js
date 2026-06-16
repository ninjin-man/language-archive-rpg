/* ════ 持ち物・能力・レベルアップ (Phase10-13: ローグライクコアループ) ════
   メニューは画面右上に常時表示(ヘッダー内 & ダンジョン内の2箇所から開ける、同じUIを共有)。
   「探索 → 戦闘 → 回復 → 成長 → 次の探索」のループを構成する中核システム。 */
const INV_MAX_SLOTS=20;

/* ── 持ち物データ操作 ── */
function addItem(id,n=1){
  if(!Array.isArray(S.inventory))S.inventory=[];
  const slot=S.inventory.find(s=>s.id===id);
  if(slot){slot.count+=n;save();return true}
  if(S.inventory.length>=INV_MAX_SLOTS)return false; // 持ち物がいっぱい
  S.inventory.push({id,count:n});save();return true;
}
function removeItem(id,n=1){
  const slot=(S.inventory||[]).find(s=>s.id===id);
  if(!slot)return;
  slot.count-=n;
  if(slot.count<=0)S.inventory=S.inventory.filter(s=>s!==slot);
  save();
}

/* ── アイテム使用 (Phase13) ──
   ダンジョン内であれば効果適用後に1ターン経過させ、敵ターン・自然回復判定を実行する。
   町(ダンジョン外)ではHPの概念が無いため、使用しても効果は発生しない。 */
function useItem(id){
  const def=getItemDef(id);
  const slot=(S.inventory||[]).find(s=>s.id===id);
  if(!def||!slot)return;
  if(def.type==='consumable'&&def.effect?.hp){
    const inDungeon=!!(DM&&DM.dungeon);
    const maxHp=inDungeon?DM.playerMaxHp:getPlayerMaxHp();
    const curHp=inDungeon?DM.playerHp:maxHp;
    if(curHp>=maxHp){
      toast('💧 HPが満タンです','g');
      return;
    }
    removeItem(id,1);
    const heal=Math.min(def.effect.hp,maxHp-curHp);
    if(inDungeon){
      DM.playerHp=Math.min(DM.playerMaxHp,DM.playerHp+heal);
      closeCharMenu();
      dmLog(`🌿 ${def.jp}を使った！ HPが${heal}回復した`);
      dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),heal,'heal');
      dmRender();
      dmEnemyTurn(); // 使用も1ターンとして扱う(Phase13)
    }else{
      toast(`🌿 ${def.jp}を使った`,'g');
      renderInventory();
    }
  }
}
function dropItem(id){
  removeItem(id,1);
  toast('📦 アイテムを置いた','g');
  renderInventory();
}

/* ── レベルアップ (Phase12) ──
   ランダム成長は禁止。毎レベル固定で HP+10 / 攻撃力+2 / 防御力+1 / 回復力+1 。 */
const LV_EXP_BASE=50; // 次レベル必要経験値(MVP: 簡易固定値。後で階層に応じた曲線に調整可能)
function getLvExpNeed(level){return LV_EXP_BASE}
function gainLevelExp(amount){
  if(!amount||amount<=0)return;
  S.level=S.level||1;
  S.lvExp=(S.lvExp||0)+amount;
  let leveledUp=false,lastGains=null;
  while(S.lvExp>=getLvExpNeed(S.level)){
    S.lvExp-=getLvExpNeed(S.level);
    S.level++;
    S.stats=S.stats||{atk:0,hp:0,spd:0,def:0,regen:0};
    S.stats.hp=(S.stats.hp||0)+10;
    S.stats.atk=(S.stats.atk||0)+2;
    S.stats.def=(S.stats.def||0)+1;
    S.stats.regen=(S.stats.regen||0)+1;
    leveledUp=true;
    lastGains={level:S.level,hp:10,atk:2,def:1,regen:1};
  }
  save();
  if(leveledUp){
    // レベルアップ時はダンジョン内HPも上限に追従して全回復させる(気持ちよさ優先のMVP仕様)
    if(DM&&DM.dungeon){DM.playerMaxHp=getPlayerMaxHp();DM.playerHp=DM.playerMaxHp}
    showLevelUp(lastGains);
  }
  updateHdr();
}
// 画面中央に一定時間表示する非ブロッキングのレベルアップ演出
function showLevelUp(gains){
  if(!gains)return;
  const ov=document.getElementById('lvup-ov');
  if(!ov)return;
  document.getElementById('lvup-lv').textContent=`Lv ${gains.level}`;
  document.getElementById('lvup-gains').innerHTML=`
    <div class="lvup-row">HP +${gains.hp}</div>
    <div class="lvup-row">攻撃力 +${gains.atk}</div>
    <div class="lvup-row">防御力 +${gains.def}</div>
    <div class="lvup-row">回復力 +${gains.regen}</div>`;
  ov.classList.add('show');
  clearTimeout(ov._t);
  ov._t=setTimeout(()=>ov.classList.remove('show'),2200);
}

/* ── メニューUI: 持ち物 / 能力 (Phase10/11) ──
   オーバーレイ1つを共有し、内部のcm-bodyをJSで切り替える(画面右上の「☰」から常時アクセス可) */
function openCharMenu(){
  document.getElementById('char-menu-ov').classList.add('show');
  renderCharMenuRoot();
}
function closeCharMenu(){
  document.getElementById('char-menu-ov').classList.remove('show');
}
function renderCharMenuRoot(){
  document.getElementById('cm-title').textContent='メニュー';
  document.getElementById('cm-body').innerHTML=`
    <button class="evbtn" onclick="renderInventory()">🎒 持ち物</button>
    <button class="evbtn" onclick="renderStatus()">💪 能力</button>
    <button class="evbtn" onclick="closeCharMenu()">✕ 閉じる</button>`;
}
function renderInventory(){
  document.getElementById('cm-title').textContent='持ち物';
  const slots=S.inventory||[];
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">持ち物 ${slots.length} / ${INV_MAX_SLOTS}</div>
    <div class="inv-list">${slots.length?slots.map(s=>{
      const def=getItemDef(s.id);if(!def)return'';
      return `<button class="evbtn" onclick="renderItemDetail('${s.id}')">${def.icon} ${def.jp} ×${s.count}</button>`;
    }).join(''):'<div class="inv-empty">何も持っていない</div>'}</div>
    <button class="evbtn cm-back" onclick="renderCharMenuRoot()">← 戻る</button>`;
}
function renderItemDetail(id){
  const slot=(S.inventory||[]).find(s=>s.id===id);
  const def=getItemDef(id);
  if(!slot||!def){renderInventory();return}
  document.getElementById('cm-title').textContent=def.jp;
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-detail-desc">${def.desc}</div>
    <div class="inv-detail-count">所持数: ×${slot.count}</div>
    <div class="inv-detail-actions">
      <button class="cact" onclick="useItem('${id}')">使う</button>
      <button class="cact secondary" onclick="dropItem('${id}')">置く</button>
      <button class="evbtn cm-back" onclick="renderInventory()">戻る</button>
    </div>`;
}
function renderStatus(){
  document.getElementById('cm-title').textContent='能力';
  const inDungeon=!!(DM&&DM.dungeon);
  const maxHp=inDungeon?DM.playerMaxHp:getPlayerMaxHp();
  const curHp=inDungeon?DM.playerHp:maxHp;
  const lv=S.level||1;
  const exp=S.lvExp||0;
  const need=getLvExpNeed(lv);
  document.getElementById('cm-body').innerHTML=`
    <div class="stat-lv">Lv ${lv}</div>
    <div class="stat-row"><span>HP</span><span>${curHp} / ${maxHp}</span></div>
    <div class="stat-row"><span>攻撃力</span><span>${getPlayerAtk()}</span></div>
    <div class="stat-row"><span>防御力</span><span>${getPlayerDef()}</span></div>
    <div class="stat-row"><span>回復力</span><span>${getPlayerRegen()}</span></div>
    <div class="stat-row"><span>EXP</span><span>${exp} / ${need}</span></div>
    <button class="evbtn cm-back" onclick="renderCharMenuRoot()">← 戻る</button>`;
}
