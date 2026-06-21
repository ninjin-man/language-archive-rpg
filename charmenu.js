/* ════ 持ち物・能力・レベルアップ (Phase10-16: ローグライクコアループ) ════
   メニューは画面右上に常時表示(ヘッダー内 & ダンジョン内の2箇所から開ける、同じUIを共有)。
   「探索 → 戦闘 → 回復 → 成長 → 次の探索」のループを構成する中核システム。 */
const INV_MAX_SLOTS=20; // 所持枠: 20固定(Phase16)
const STACK_MAX=10;     // スタック上限: 同種10個まで1枠(Phase16)

/* ── 持ち物データ操作 ──
   同じアイテムでもスタック上限(10)を超えると別スロットに分かれる(例: 薬草×10 + 薬草×5 = 2枠)。
   そのため以降の使用/設置はid指定ではなく「どのスロットか(配列インデックス)」で個別に扱う。
   Phase26: 床ドロップ固有情報(meta: 装備レアリティ・欠片のダンジョンID等)を持つアイテムは、
   metaが完全一致する場合のみスタックする(レアリティ違いの装備などは別枠になる)。 */
function metaEq(a,b){
  if(!a&&!b)return true;
  if(!a||!b)return false;
  return JSON.stringify(a)===JSON.stringify(b);
}
function addItem(id,n=1,meta=null){
  if(!Array.isArray(S.inventory))S.inventory=[];
  registerDexItem(id); // Phase20: 初回入手で図鑑に登録(取得が成功するかどうかに関わらず「発見」した事実は記録する)
  // 既存スタックに空きがあれば詰める(metaが一致するスロットのみ)
  const slot=S.inventory.find(s=>s.id===id&&s.count<STACK_MAX&&metaEq(s.meta,meta));
  if(slot){
    const add=Math.min(STACK_MAX-slot.count,n);
    slot.count+=add;n-=add;
  }
  if(n<=0){save();return true}
  // 新規スロットが必要だが空きが無い(Phase16: 所持がいっぱい)
  if(S.inventory.length>=INV_MAX_SLOTS)return false;
  const newSlot={id,count:Math.min(STACK_MAX,n)};
  if(meta)newSlot.meta=meta;
  S.inventory.push(newSlot);
  save();return true;
}
// Phase20: 図鑑基盤 — アイテムを初発見した時に登録する(以後は何もしない)
function registerDexItem(id){
  if(!S.dex)S.dex={items:{},monsters:{}};
  if(S.dex.items[id])return;
  S.dex.items[id]=true;save();
  const def=getItemDef(id);
  toast(`📘 図鑑に登録: ${def?def.jp:id}`,'g');
}
// Phase20: 図鑑基盤 — モンスターを初撃破した時に登録する(以後は何もしない)
function registerDexMonster(id){
  if(!S.dex)S.dex={items:{},monsters:{}};
  if(S.dex.monsters[id])return;
  S.dex.monsters[id]=true;save();
  const def=ENEMIES.find(e=>e.id===id);
  toast(`📘 図鑑に登録: ${def?def.jp:id}`,'g');
}
// スロット(配列インデックス)を直接操作して取り除く。countを省略すると丸ごと取り除く(置く用)
function removeItemAt(idx,n){
  const slot=S.inventory[idx];
  if(!slot)return null;
  const removed=n===undefined?slot.count:Math.min(n,slot.count);
  slot.count-=removed;
  if(slot.count<=0)S.inventory.splice(idx,1);
  save();
  return removed;
}

/* ── アイテム使用 (Phase13) ──
   ダンジョン内であれば効果適用後に1ターン経過させ、敵ターン・自然回復判定を実行する。
   町(ダンジョン外)ではHPの概念が無いため、使用しても効果は発生しない。 */
function useItem(idx){
  const slot=S.inventory[idx];
  const def=slot&&getItemDef(slot.id);
  if(!slot||!def)return;
  if(def.type==='consumable'&&def.effect?.hp){
    const inDungeon=!!(DM&&DM.dungeon);
    const maxHp=inDungeon?DM.playerMaxHp:getPlayerMaxHp();
    const curHp=inDungeon?DM.playerHp:maxHp;
    if(curHp>=maxHp){
      toast('💧 HPが満タンです','g');
      return;
    }
    removeItemAt(idx,1);
    const heal=Math.min(def.effect.hp,maxHp-curHp);
    if(inDungeon){
      DM.playerHp=Math.min(DM.playerMaxHp,DM.playerHp+heal);
      closeCharMenu();
      dmLog(`${def.icon} ${def.jp}を使った！ HPが${heal}回復した`);
      dmShowFloatDamage(Math.floor(VW/2),Math.floor(VH/2),heal,'heal');
      dmRender();
      dmEnemyTurn(); // 使用も1ターンとして扱う(Phase13)
    }else{
      toast(`${def.icon} ${def.jp}を使った`,'g');
      renderInventory();
    }
  } else if(def.type==='consumable'&&def.effect?.fireDmg){
    useFireStone(idx,def); // Phase23: 火炎石
  } else if(def.type==='consumable'&&def.effect?.cure){
    // Phase23: 毒消し草 — 状態異常システムは未実装のため、現状は消費せず案内のみ
    toast('✨ 今は状態異常にかかっていない(状態異常システムは後日実装予定)','g');
  }
}
// Phase23: 火炎石 — ダンジョン内で隣接(8方向)する敵1体に固定ダメージを与える。
// 周囲に敵がいない場合は使用できない(消費しない)。使用も1ターンとして扱う。
function useFireStone(idx,def){
  if(!(DM&&DM.dungeon)){
    toast('🔥 ダンジョン内でのみ使える','g');
    return;
  }
  const fl=DM.floors[DM.floor];
  const p=fl&&fl.playerPos;
  if(!p)return;
  const target=(fl.enemies||[]).find(e=>e.curHp>0&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))===1);
  if(!target){
    toast('🔥 近くに敵がいない','g');
    return;
  }
  removeItemAt(idx,1);
  closeCharMenu();
  const dmg=def.effect.fireDmg;
  target.curHp=Math.max(0,target.curHp-dmg);
  dmLog(`🔥 ${def.jp}を使った！ ${target.jp||target.name}に${dmg}ダメージ`);
  dmShowFloatDamage(Math.floor(VW/2)+(target.x-p.x),Math.floor(VH/2)+(target.y-p.y),dmg,'fire');
  if(target.curHp<=0)dmKillEnemy(target);
  dmRender();
  dmEnemyTurn();
}
/* ── 置く(Drop) — Phase16 ──
   「捨てる」という表現は使わない。スロット内の個数を丸ごと床に設置し、その枠を空ける。
   ダンジョン内であればプレイヤーの位置に視覚的に重ねて配置される(同マス複数アイテム可)。 */
function doDropSlot(idx){
  const slot=S.inventory[idx];
  if(!slot)return null;
  const id=slot.id,count=slot.count,meta=slot.meta;
  removeItemAt(idx);
  if(DM&&DM.dungeon){
    const fl=DM.floors[DM.floor];
    if(fl)dmPlaceItemsOnFloor(id,count,fl.playerPos,meta);
  }
  return id;
}
function dropItem(idx){ // 通常の持ち物画面から「置く」を選んだ場合
  const id=doDropSlot(idx);
  const def=id&&getItemDef(id);
  toast(`📦 ${def?def.jp:'アイテム'}を床に置いた`,'g');
  renderInventory();
}

/* ── 所持がいっぱいの時のプロンプト (Phase16) ──
   フィールドでアイテムを踏んだが空きが無い場合、どれかを「置く」よう求める。 */
function openInvFullPrompt(){
  document.getElementById('char-menu-ov').classList.add('show');
  document.getElementById('cm-title').textContent='所持がいっぱいです';
  const slots=S.inventory||[];
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">どれかを置いてください</div>
    <div class="inv-list">${slots.map((s,i)=>{
      const def=getItemDef(s.id);if(!def)return'';
      return `<div class="inv-full-row">
        <span class="inv-full-name">${invSlotLabel(s)} ×${s.count}</span>
        <button class="cact small" onclick="resolveInvFullDrop(${i})">置く</button>
      </div>`;
    }).join('')}</div>
    <button class="evbtn cm-back" onclick="cancelInvFullPrompt()">キャンセル</button>`;
}
function resolveInvFullDrop(idx){
  doDropSlot(idx);
  closeCharMenu();
  DM.pending=null;
  const pos=DM.pendingPickup;DM.pendingPickup=null;
  if(pos)dmTryPickupItems(pos.x,pos.y); // 空いた枠で元のアイテムの取得を再試行
  if(!DM.pending){ // 取得が完了していれば、保留にしていた分のターンを処理する
    dmRender();
    dmEnemyTurn();
  }
}
function cancelInvFullPrompt(){
  closeCharMenu();
  DM.pending=null;
  DM.pendingPickup=null;
  dmRender();
  dmEnemyTurn(); // キャンセルしても、その場に来た移動自体のターンは経過させる
}

/* ── レベルアップ (Phase12) ──
   ランダム成長は禁止。毎レベル固定で HP+10 / 攻撃力+2 / 防御力+1 / 回復力+1 。 */
// Phase21: レベルアップ必要経験値テーブル(index 0 = Lv1→2 の必要量)
const LV_EXP_TABLE=[10,25,50,80,120,170,230];
function getLvExpNeed(level){
  if(level<=LV_EXP_TABLE.length)return LV_EXP_TABLE[level-1];
  // テーブルを超えるレベルは最後の増分(230-170=60)を引き継いで延長する(目安値)
  const step=LV_EXP_TABLE[LV_EXP_TABLE.length-1]-LV_EXP_TABLE[LV_EXP_TABLE.length-2];
  return LV_EXP_TABLE[LV_EXP_TABLE.length-1]+step*(level-LV_EXP_TABLE.length);
}
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
    <button class="evbtn" onclick="renderEquip()">⚔️ 装備</button>
    <button class="evbtn" onclick="renderStatus()">💪 能力</button>
    <button class="evbtn" onclick="renderDex()">📘 図鑑</button>
    <button class="evbtn" onclick="closeCharMenu()">✕ 閉じる</button>`;
}
function renderInventory(){
  document.getElementById('cm-title').textContent='持ち物';
  const slots=S.inventory||[];
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">持ち物 ${slots.length} / ${INV_MAX_SLOTS}</div>
    <div class="inv-list">${slots.length?slots.map((s,i)=>{
      const def=getItemDef(s.id);if(!def)return'';
      return `<button class="evbtn" onclick="renderItemDetail(${i})">${invSlotLabel(s)} ×${s.count}</button>`;
    }).join(''):'<div class="inv-empty">何も持っていない</div>'}</div>
    <button class="evbtn cm-back" onclick="renderCharMenuRoot()">← 戻る</button>`;
}
// スロットの表示ラベル。装備はレアリティ付き、その他は通常名。
function invSlotLabel(slot){
  const def=getItemDef(slot.id);if(!def)return '';
  if(def.slot)return equipDisplayName({id:slot.id,rarity:slot.meta?.rarity});
  return `${def.icon} ${def.jp}`;
}
function renderItemDetail(idx){
  const slot=S.inventory[idx];
  const def=slot&&getItemDef(slot.id);
  if(!slot||!def){renderInventory();return}
  document.getElementById('cm-title').textContent=invSlotLabel(slot).replace(/^[^\s]+\s/,'');
  let actions='';
  if(def.slot){
    // 装備品: 実効ステータスを表示し「装備する」
    const st=getEquipStats({id:slot.id,rarity:slot.meta?.rarity});
    const statLabel=Object.entries(st).map(([k,v])=>`${EQ_STAT_JP[k]||k} +${v}`).join(' / ');
    actions=`
      <div class="inv-detail-count">${statLabel}</div>
      <div class="inv-detail-actions">
        <button class="cact" onclick="equipFromSlot(${idx})">装備する</button>
        <button class="cact secondary" onclick="dropItem(${idx})">置く</button>
        <button class="evbtn cm-back" onclick="renderInventory()">戻る</button>
      </div>`;
  }else if(def.type==='shard'){
    // アーカイブの欠片: 「解読する」(消費して単語を発見)
    actions=`
      <div class="inv-detail-actions">
        <button class="cact" onclick="decodeShard(${idx})">🔮 解読する</button>
        <button class="cact secondary" onclick="dropItem(${idx})">置く</button>
        <button class="evbtn cm-back" onclick="renderInventory()">戻る</button>
      </div>`;
  }else if(def.type==='material'){
    // 鉱石: クラフト素材(現状は保持のみ)。使用不可。
    actions=`
      <div class="inv-detail-count">クラフト素材として保持中</div>
      <div class="inv-detail-actions">
        <button class="cact secondary" onclick="dropItem(${idx})">置く</button>
        <button class="evbtn cm-back" onclick="renderInventory()">戻る</button>
      </div>`;
  }else{
    actions=`
      <div class="inv-detail-actions">
        <button class="cact" onclick="useItem(${idx})">使う</button>
        <button class="cact secondary" onclick="dropItem(${idx})">置く</button>
        <button class="evbtn cm-back" onclick="renderInventory()">戻る</button>
      </div>`;
  }
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-detail-desc">${def.desc}</div>
    <div class="inv-detail-count">所持数: ×${slot.count}</div>
    ${actions}`;
}
const EQ_STAT_JP={atk:'攻撃力',def:'防御力',regen:'回復力',hp:'最大HP'};

/* ════ Phase26: 装備システム ════
   S.equipment = {weapon, shield, accessory}。各スロットは {id,rarity} または null。
   装備すると getEquipBonus(battle.js)経由でステータスへ加算される。 */
const EQ_SLOTS=[
  {slot:'weapon',   label:'武器',       icon:'🗡️'},
  {slot:'shield',   label:'盾',         icon:'🛡️'},
  {slot:'accessory',label:'アクセサリー',icon:'💍'},
];
function renderEquip(){
  document.getElementById('cm-title').textContent='装備';
  const eq=S.equipment||{weapon:null,shield:null,accessory:null};
  const rows=EQ_SLOTS.map(s=>{
    const cur=eq[s.slot];
    const name=cur?equipDisplayName(cur):'なし';
    const st=cur?getEquipStats(cur):{};
    const statLabel=Object.entries(st).map(([k,v])=>`${EQ_STAT_JP[k]||k} +${v}`).join(' / ');
    return `<div class="eq-row">
      <div class="eq-slot-head"><span class="eq-slot-label">${s.icon} ${s.label}</span>
        ${cur?`<button class="cact small" onclick="unequipSlot('${s.slot}')">外す</button>`:''}</div>
      <div class="eq-cur ${cur?'on':''}">${name}${statLabel?` <span class="eq-stat">${statLabel}</span>`:''}</div>
      <button class="evbtn" onclick="renderEquipPick('${s.slot}')">＋ ${s.label}を選ぶ</button>
    </div>`;
  }).join('');
  // 装備合計ボーナスの要約
  const sum=['atk','def','regen','hp'].map(k=>{const v=getEquipBonus(k);return v?`${EQ_STAT_JP[k]} +${v}`:''}).filter(Boolean).join(' / ');
  document.getElementById('cm-body').innerHTML=`
    <div class="eq-list">${rows}</div>
    ${sum?`<div class="inv-cap">装備合計: ${sum}</div>`:''}
    <button class="evbtn cm-back" onclick="renderCharMenuRoot()">← 戻る</button>`;
}
// 指定スロットに装備可能な持ち物の一覧を表示
function renderEquipPick(slotName){
  const slots=S.inventory||[];
  const candidates=slots.map((s,i)=>({s,i})).filter(({s})=>{
    const def=getItemDef(s.id);return def&&def.slot===slotName;
  });
  const label=(EQ_SLOTS.find(e=>e.slot===slotName)||{}).label||slotName;
  document.getElementById('cm-title').textContent=`${label}を選ぶ`;
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-list">${candidates.length?candidates.map(({s,i})=>{
      const st=getEquipStats({id:s.id,rarity:s.meta?.rarity});
      const statLabel=Object.entries(st).map(([k,v])=>`${EQ_STAT_JP[k]||k}+${v}`).join(' ');
      return `<button class="evbtn" onclick="equipFromSlot(${i})">${invSlotLabel(s)} <span class="eq-stat">${statLabel}</span></button>`;
    }).join(''):'<div class="inv-empty">装備できる持ち物が無い</div>'}</div>
    <button class="evbtn cm-back" onclick="renderEquip()">← 戻る</button>`;
}
// 持ち物スロットidxの装備を装備する。既存装備があれば持ち物に戻す(入れ替え)。
function equipFromSlot(idx){
  const slot=S.inventory[idx];
  const def=slot&&getItemDef(slot.id);
  if(!slot||!def||!def.slot)return;
  if(!S.equipment)S.equipment={weapon:null,shield:null,accessory:null};
  const slotName=def.slot;
  const prev=S.equipment[slotName];
  // 入れ替えで旧装備を持ち物に戻せるか事前確認(枠不足で旧装備を失わないようにする)。
  // 装備するアイテムを1個外すとそのスロットが空く可能性があるため、その分を見込んで判定する。
  if(prev){
    const slotWillEmpty=slot.count===1;
    const freeAfter=(S.inventory.length-(slotWillEmpty?1:0));
    const canStack=S.inventory.some((s,i)=>i!==idx&&s.id===prev.id&&s.count<STACK_MAX&&metaEq(s.meta,{rarity:prev.rarity}));
    if(freeAfter>=INV_MAX_SLOTS && !canStack){
      toast('🎒 持ち物がいっぱいで装備を入れ替えられない','g');
      return;
    }
  }
  removeItemAt(idx,1);
  if(prev)addItem(prev.id,1,{rarity:prev.rarity});
  S.equipment[slotName]={id:slot.id,rarity:slot.meta?.rarity||'common'};
  save();
  // ダンジョン内でHP上限が変わる装備(護符)に追従
  if(DM&&DM.dungeon){DM.playerMaxHp=getPlayerMaxHp();if(DM.playerHp>DM.playerMaxHp)DM.playerHp=DM.playerMaxHp;if(typeof dmUpdateHud==='function')dmUpdateHud()}
  toast(`⚔️ ${equipDisplayName(S.equipment[slotName])}を装備した`,'g');
  renderEquip();
}
function unequipSlot(slotName){
  if(!S.equipment||!S.equipment[slotName])return;
  const cur=S.equipment[slotName];
  // 持ち物に空きが無ければ外せない
  if((S.inventory||[]).length>=INV_MAX_SLOTS){
    const willStack=(S.inventory||[]).some(s=>s.id===cur.id&&s.count<STACK_MAX&&metaEq(s.meta,{rarity:cur.rarity}));
    if(!willStack){toast('🎒 持ち物がいっぱいで外せない','g');return}
  }
  addItem(cur.id,1,{rarity:cur.rarity});
  S.equipment[slotName]=null;
  save();
  if(DM&&DM.dungeon){DM.playerMaxHp=getPlayerMaxHp();if(DM.playerHp>DM.playerMaxHp)DM.playerHp=DM.playerMaxHp;dmUpdateHud&&dmUpdateHud()}
  toast('装備を外した','g');
  renderEquip();
}

/* ════ Phase26: アーカイブの欠片の解読 ════
   欠片を1個消費し、meta.dungeonId のダンジョンに属する words から未発見の1語を発見する。
   ダンジョン外でも実行可能(集めた欠片を後でじっくり解読する想定)。
   対象ダンジョンの未発見語が無い場合は消費せず案内する。 */
function decodeShard(idx){
  const slot=S.inventory[idx];
  const def=slot&&getItemDef(slot.id);
  if(!slot||!def||def.type!=='shard')return;
  const dgId=slot.meta?.dungeonId;
  const dg=DD.find(d=>d.id===dgId)||DM?.dungeon;
  if(!dg){toast('🔮 この欠片の出所が分からない…','g');return}
  const pool=dg.words.map(w=>WM[w]).filter(Boolean).filter(w=>gst(w.word)==='unknown');
  if(!pool.length){
    toast(`🔮 ${dg.name}の言葉はすべて取り戻している`,'g');
    return;
  }
  // 欠片を1個消費
  removeItemAt(idx,1);
  const w=(typeof pickBonusWord==='function')?pickBonusWord(pool,DM?.floor||1):pool[Math.floor(Math.random()*pool.length)];
  if(w&&gst(w.word)==='unknown'){
    discover(w.word);
    if(DM&&DM.dungeon)DM.wordsFound=(DM.wordsFound||0)+1;
    toast(`🔮 欠片を解読し「${w.word}」を取り戻した！`,'g');
    if(DM&&DM.dungeon)dmLog&&dmLog(`🔮 アーカイブの欠片を解読し「${w.word}」を発見！`);
  }
  // 解読後、まだ欠片が残っていれば一覧に留まる
  if((S.inventory||[])[idx])renderItemDetail(idx);
  else renderInventory();
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

/* ── 図鑑 (Phase20: 図鑑基盤システム) ──
   将来のアーカイブ/単語図鑑/職業図鑑/世界資料などを見据えた共通基盤。
   今回はアイテム/モンスターの2カテゴリのみ。アーカイブはまだ表示しない。 */
function renderDex(){
  document.getElementById('cm-title').textContent='図鑑';
  const total=ITEMS.length+ENEMIES.length;
  const got=Object.keys(S.dex.items).length+Object.keys(S.dex.monsters).length;
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">収集率 ${got} / ${total}</div>
    <div class="inv-list">
      <button class="evbtn" onclick="renderDexCategory('items')">🎒 アイテム</button>
      <button class="evbtn" onclick="renderDexCategory('monsters')">👾 モンスター</button>
    </div>
    <button class="evbtn cm-back" onclick="renderCharMenuRoot()">← 戻る</button>`;
}
function renderDexCategory(cat){
  const isItem=cat==='items';
  const list=isItem?ITEMS:ENEMIES;
  const dexMap=isItem?S.dex.items:S.dex.monsters;
  document.getElementById('cm-title').textContent=isItem?'図鑑: アイテム':'図鑑: モンスター';
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-cap">${Object.keys(dexMap).length} / ${list.length}</div>
    <div class="inv-list">${list.map(e=>{
      const found=!!dexMap[e.id];
      const label=found?e.jp:'？？？';
      const icon=found?e.icon:'❔';
      return `<button class="evbtn" onclick="renderDexDetail('${cat}','${e.id}')">${icon} ${label}</button>`;
    }).join('')}</div>
    <button class="evbtn cm-back" onclick="renderDex()">← 戻る</button>`;
}
function renderDexDetail(cat,id){
  const isItem=cat==='items';
  const list=isItem?ITEMS:ENEMIES;
  const dexMap=isItem?S.dex.items:S.dex.monsters;
  const e=list.find(x=>x.id===id);
  if(!e){renderDexCategory(cat);return}
  const found=!!dexMap[id];
  document.getElementById('cm-title').textContent=found?e.jp:'？？？';
  document.getElementById('cm-body').innerHTML=`
    <div class="inv-detail-desc">${found?e.desc:'まだ発見していない。'}</div>
    <div class="inv-detail-count">${found?'発見済':'未発見'}</div>
    <button class="evbtn cm-back" onclick="renderDexCategory('${cat}')">戻る</button>`;
}
