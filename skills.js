/* ════ SKILL FORGE — 品詞コンボ・単語構文システム (Phase9) ════ */
// 4-slot picker state: noun/verb/adjective/adverb (空欄可、ただしnoun+verbは最低限必要)
let SKS4={noun:'',verb:'',adjective:'',adverb:''};
let SKTAB='forge'; // 'forge' | 'grammar'

function setSkillTab(tab){
  SKTAB=tab;
  document.getElementById('t-skf')?.classList.toggle('on',tab==='forge');
  document.getElementById('t-skg')?.classList.toggle('on',tab==='grammar');
  renderSkillLab();
}

// Pick a word into its POS-appropriate slot. Rejects mismatched POS (品詞チェック / Phase9 item2).
function pickSkillWord4(word){
  const pos=WM[word]?.pos;
  if(!pos||!SKS4.hasOwnProperty(pos))return; // POSスロットが存在しない品詞は選択不可
  // Toggle off if already selected
  if(SKS4[pos]===word){SKS4[pos]='';renderSkillLab();return}
  SKS4[pos]=word;
  renderSkillLab();
}
function clrSkillSlot4(pos){SKS4[pos]='';renderSkillLab()}

// Get the ordered list of non-empty selected words (for stats/effects/rarity calc)
function selectedWords4(){return [SKS4.noun,SKS4.verb,SKS4.adjective,SKS4.adverb].filter(Boolean)}

// Naming: simple concatenation, order = Adverb, Adjective, Noun, Verb (高度な命名規則は不要)
function combineSkillName4(slots){
  return [slots.adverb,slots.adjective,slots.noun,slots.verb].filter(Boolean).join(' ');
}

// Find an existing skill with the same word-set (order-independent), if any
function skillSetId(words){return [...words].sort().join('+')}
function findSkill4(words){
  const sid=skillSetId(words);
  return (S.skills||[]).find(s=>skillSetId((s.words||[]).filter(Boolean))===sid)||null;
}

// Combine word rarities -> skill rarity. Simple rule: highest of the selected words (仮ロジック).
function combineRarity4(words){
  let i=0;
  words.forEach(w=>{const r=WM[w]?.rarity||'common';i=Math.max(i,RRANK[r]??0)});
  return RKEYS[i];
}

// Combine per-word stat gains, then apply adjective/adverb performance modifiers (Phase9 item6/7)
function combineStats4(slots){
  const words=[slots.noun,slots.verb,slots.adjective,slots.adverb].filter(Boolean);
  let atk=0,hp=0,spd=0;
  words.forEach(w=>{const g=getWordStatGain(w);atk+=g.atk||0;hp+=g.hp||0;spd+=g.spd||0});
  // 形容詞ボーナス: ATK+50%など (Strong/Sharp系)
  const adjBonus=getAdjBonus(slots.adjective);
  if(adjBonus?.atkMult)atk=Math.round(atk*(1+adjBonus.atkMult));
  // 副詞ボーナス: SPD+50%など (Quickly/Swift系)
  const advBonus=getAdvBonus(slots.adverb);
  if(advBonus?.spdMult)spd=Math.round(spd*(1+advBonus.spdMult));
  return {atk,hp,spd};
}

/* ════ SKILL EFFECTS (Phase5引継ぎ + Phase9形容詞による効果量増加) ════ */
function getSkillEffects4(skill){
  const mag=SKILL_EFFECT_MAG[skill.rarity]||SKILL_EFFECT_MAG.common;
  const effects=[];
  const seenTypes=new Set();
  const words=(skill.words||[]).filter(Boolean);
  for(const word of words){
    for(const entry of SKILL_EFFECT_TABLE){
      if(seenTypes.has(entry.type))continue;
      if(entry.keywords.some(kw=>word.includes(kw))){
        let value=entry.unit==='%'?mag.pct:mag.flat;
        // Magic/Cold系形容詞: 効果量+50% (Phase9 item6)
        const adjBonus=getAdjBonus(skill.slots?.adjective);
        if(adjBonus?.effectMult && entry.unit==='%')value=value*(1+adjBonus.effectMult);
        effects.push({type:entry.type,label:entry.label,value,unit:entry.unit});
        seenTypes.add(entry.type);
      }
    }
  }
  return effects;
}
function formatEffect(e){
  return e.unit==='%' ? `${e.label} +${Math.round(e.value*100)}%` : `${e.label} +${e.value}`;
}

/* ════ SKILL GENERATION (Phase9) ════ */
function generateSkill(){
  const slots={...SKS4};
  const words=[slots.noun,slots.verb,slots.adjective,slots.adverb].filter(Boolean);
  // 最低限 名詞+動詞 が必要 (Phase4からの最小構成を継承)
  if(!slots.noun||!slots.verb)return;
  const existing=findSkill4(words);
  if(existing){
    existing.uses=(existing.uses||0)+1;
    save();
    toast(`${existing.name} は既に発見済み (使用回数 ${existing.uses})`);
    renderSkillLab();
    return;
  }
  const skill={
    id:'sk_'+Date.now()+'_'+Math.floor(Math.random()*1000),
    name:combineSkillName4(slots),
    words,
    slots,
    rarity:combineRarity4(words),
    rank:getSkillRank(words.length).key,
    element:getElement(words),
    actionType:getAction(words),
    effects:[], // filled below
    uses:1,
    firstCreated:Date.now(),
    // 将来実装用（今回未使用）
    level:1,exp:0,cooldown:0,manaCost:0,
  };
  skill.stats=combineStats4(slots);
  skill.effects=getSkillEffects4(skill);
  if(!S.skills)S.skills=[];
  S.skills.push(skill);
  save();
  toast(`✨ 新スキル「${skill.name}」生成！ (${getSkillRank(words.length).jp})`,'g');
  SKS4={noun:'',verb:'',adjective:'',adverb:''};
  renderSkillLab();
}

/* ════ RENDER: SKILL FORGE ════ */
function renderSkillLab(){
  if(SKTAB==='grammar'){renderGrammarArchive();return}

  const known=WD.filter(w=>gst(w.word)!=='unknown');
  const slots=SKS4;
  const selWords=selectedWords4();
  const existing=(slots.noun&&slots.verb)?findSkill4(selWords):null;

  // 4 slot boxes, one per POS
  const slotHtml=SKILL_SLOTS.map(s=>{
    const w=slots[s.pos];
    return `<div class="csl ${w?'f':''}" onclick="${w?`clrSkillSlot4('${s.pos}')`:''}">
      <div style="font-size:8px;color:var(--t2);letter-spacing:.08em">${s.icon} ${s.jp}</div>
      ${w?`<div style="font-size:12px;font-weight:700;color:var(--violet);margin-top:2px">${w}</div><div style="font-size:7px;color:var(--t2);margin-top:2px">タップで消去</div>`
          :`<div style="font-size:9px;color:var(--t3);margin-top:6px">${s.label}${s.pos==='noun'||s.pos==='verb'?'(必須)':'(任意)'}</div>`}
    </div>`;
  }).join('');

  // Result preview
  let rH='';
  if(!slots.noun||!slots.verb){
    rH=`<div class="crs"><div style="font-size:9px;color:var(--t2);padding:4px">Noun + Verb<br>は必須です</div></div>`;
  }else{
    const name=combineSkillName4(slots);
    if(existing){
      rH=`<div class="crs r"><div style="font-size:11px;font-weight:700">${name}</div><div style="font-size:7px;color:var(--t2)">既知 (${existing.uses||1}回)</div></div>`;
    }else{
      const rarity=combineRarity4(selWords);
      const rank=getSkillRank(selWords.length);
      rH=`<div class="crs r"><div style="font-size:11px;font-weight:700">${name}</div><div style="font-size:8px;color:${RCOL[rarity]}">${RLBL[rarity]} ・ ${rank.jp}</div></div>`;
    }
  }

  // Preview stats/effects/bonuses for not-yet-generated combo
  let previewHtml='';
  if(slots.noun&&slots.verb&&!existing){
    const stats=combineStats4(slots);
    const parts=[];
    if(stats.atk)parts.push(`ATK +${stats.atk}`);
    if(stats.hp)parts.push(`HP +${stats.hp}`);
    if(stats.spd)parts.push(`SPD +${stats.spd}`);
    previewHtml=`<div style="font-size:9px;color:var(--t2);margin-top:6px">${parts.length?parts.join(' / '):'ステータス補正なし'}</div>`;

    const previewSkill={rarity:combineRarity4(selWords),words:selWords,slots};
    const fx=getSkillEffects4(previewSkill);
    if(fx.length)previewHtml+=`<div style="font-size:9px;color:var(--green);margin-top:3px">${fx.map(formatEffect).join(' / ')}</div>`;

    // 品詞ボーナス表示 (属性/行動タイプ/形容詞/副詞)
    const bonusLine=[];
    const el=getElement(selWords);if(el)bonusLine.push(`${el.icon}${el.element}属性`);
    const ac=getAction(selWords);if(ac)bonusLine.push(`${ac.icon}${ac.action}`);
    const ab=getAdjBonus(slots.adjective);if(ab)bonusLine.push(`💎${ab.jp}`);
    const vb=getAdvBonus(slots.adverb);if(vb)bonusLine.push(`🌀${vb.jp}`);
    if(bonusLine.length)previewHtml+=`<div style="font-size:9px;color:var(--violet);margin-top:3px">${bonusLine.join(' / ')}</div>`;
  }

  // Word picker grouped by POS, each only fillable into its matching slot
  const wordPickerHtml=SKILL_SLOTS.map(s=>{
    const words=known.filter(w=>w.pos===s.pos).map(w=>w.word);
    if(!words.length){
      return `<div class="skp-group"><div class="skp-label">${s.icon} ${s.jp} (${s.role})</div>
        <div style="color:var(--t2);font-size:9px;padding:4px 0">対応する単語がまだありません</div></div>`;
    }
    return `<div class="skp-group"><div class="skp-label">${s.icon} ${s.jp} (${s.role})</div>
      <div class="wg">${words.map(w=>`<div class="wch ${slots[s.pos]===w?'on':''}" onclick="pickSkillWord4('${w}')">${w}</div>`).join('')}</div>
    </div>`;
  }).join('');

  // Skill Archive list
  const skills=S.skills||[];
  const archiveHtml=skills.length?skills.map(sk=>{
    const statParts=[];
    if(sk.stats.atk)statParts.push(`ATK+${sk.stats.atk}`);
    if(sk.stats.hp)statParts.push(`HP+${sk.stats.hp}`);
    if(sk.stats.spd)statParts.push(`SPD+${sk.stats.spd}`);
    const equippedSlot=(S.equippedSkills||[]).indexOf(sk.id);
    const rank=getSkillRank((sk.words||[]).filter(Boolean).length);
    return `<div class="sk-row" onclick="showSkillDet('${sk.id}')">
      <span class="sk-rdot" style="background:${RCOL[sk.rarity]}"></span>
      <span class="sk-name">${sk.name}${equippedSlot>=0?` <span class="sk-eq">装備中</span>`:''}<span class="sk-rank">${rank.jp}</span></span>
      <span class="sk-stats">${statParts.join(' ')}</span>
      <span class="sk-rlbl" style="color:${RCOL[sk.rarity]}">${RLBL[sk.rarity]}</span>
    </div>`;
  }).join(''):'<div style="color:var(--t2);font-size:10px">まだスキルがありません。Noun+Verbを選んで生成しよう！</div>';

  // Skill Slots (3 active slots)
  const eq=S.equippedSkills||[null,null,null];
  const slotsHtml=[0,1,2].map(i=>{
    const sk=eq[i]?(S.skills||[]).find(s=>s.id===eq[i]):null;
    if(sk){
      return `<div class="skslot filled" style="border-color:${RCOL[sk.rarity]}" onclick="unequipSkill(${i})">
        <div class="skslot-name" style="color:${RCOL[sk.rarity]}">${sk.name}</div>
        <div class="skslot-fx">${(sk.effects||[]).map(formatEffect).join(' / ')||'効果なし'}</div>
        <div class="skslot-clear">タップで外す</div>
      </div>`;
    }
    return `<div class="skslot">Skill Slot ${i+1}<div class="skslot-empty">空欄</div></div>`;
  }).join('');

  // Active build bonus summary
  const totals=getActiveBuildBonus();
  const totalKeys=Object.keys(totals);
  const bonusHtml=totalKeys.length
    ? totalKeys.map(k=>`<div class="bb-row">${formatEffect(totals[k])}</div>`).join('')
    : '<div style="color:var(--t2);font-size:10px">スキルを装備すると探索ボーナスが付与されます</div>';

  const canGenerate=slots.noun&&slots.verb&&!existing;

  document.getElementById('skill-body').innerHTML=`
    <div class="cws">
      <div class="csls sk4">${slotHtml}</div>
      <div style="text-align:center;margin-top:8px">${rH}</div>
      ${previewHtml}
      <div style="margin-top:9px"><button class="cact" onclick="generateSkill()" ${canGenerate?'':'disabled'}>🔥 Generate Skill</button></div>
    </div>
    <div class="cinv" style="margin-bottom:10px">
      <div class="cinv-t">Skill Slots</div>
      <div class="skslots">${slotsHtml}</div>
      <div class="cinv-t" style="margin-top:10px">Skill Bonus (探索適用中)</div>
      <div class="bb-list">${bonusHtml}</div>
    </div>
    <div class="cinv">${wordPickerHtml}</div>
    <div class="enc" style="margin-top:10px">
      <div class="cinv-t">Skill Archive (${skills.length})</div>
      <div class="sk-list">${archiveHtml}</div>
    </div>
    <div id="skill-det" class="skill-det" style="display:none"></div>`;
}

/* ════ GRAMMAR ARCHIVE (Phase9 item9) ════ */
function renderGrammarArchive(){
  const skills=S.skills||[];
  const rows=skills.length?skills.map(sk=>{
    const slots=sk.slots||{};
    const posChips=SKILL_SLOTS.filter(s=>slots[s.pos]).map(s=>
      `<span class="ga-pos" title="${s.jp}">${s.icon}${slots[s.pos]}</span>`
    ).join('');
    const rank=getSkillRank((sk.words||[]).filter(Boolean).length);
    const date=new Date(sk.firstCreated||Date.now());
    const dateStr=`${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
    return `<div class="ga-row" onclick="showSkillDet('${sk.id}')">
      <div class="ga-top">
        <span class="ga-name" style="color:${RCOL[sk.rarity]}">${sk.name}</span>
        <span class="ga-rank">${rank.jp}</span>
      </div>
      <div class="ga-pos-list">${posChips}</div>
      <div class="ga-meta"><span>使用回数: ${sk.uses||1}</span><span>初回生成: ${dateStr}</span></div>
    </div>`;
  }).join(''):'<div style="color:var(--t2);font-size:10px">まだコンボがありません。Skill Forgeでスキルを生成しよう！</div>';

  document.getElementById('skill-body').innerHTML=`
    <div class="cinv">
      <div class="cinv-t">Grammar Archive — 品詞コンボ記録 (${skills.length})</div>
      <div class="ga-list">${rows}</div>
    </div>
    <div id="skill-det" class="skill-det" style="display:none"></div>`;
}

/* ════ SKILL DETAIL ════ */
function showSkillDet(id){
  const sk=(S.skills||[]).find(s=>s.id===id);
  const el=document.getElementById('skill-det');
  if(!sk||!el)return;
  const statParts=[];
  if(sk.stats.atk)statParts.push(`ATK +${sk.stats.atk}`);
  if(sk.stats.hp)statParts.push(`HP +${sk.stats.hp}`);
  if(sk.stats.spd)statParts.push(`SPD +${sk.stats.spd}`);
  const fxParts=(sk.effects||[]).map(formatEffect);
  const equippedSlot=(S.equippedSkills||[]).indexOf(sk.id);
  const slotBtns=[0,1,2].map(i=>{
    const occupied=S.equippedSkills?.[i];
    const isThis=equippedSlot===i;
    return `<button class="jbtn ${isThis?'sa':'ul'}" onclick="${isThis?`unequipSkill(${i})`:`equipSkill(${i},'${sk.id}')`}">
      ${isThis?`スロット${i+1}から外す`:`スロット${i+1}へ装備${occupied?'(上書き)':''}`}
    </button>`;
  }).join('');

  // 品詞ボーナス表示
  const bonusLine=[];
  if(sk.element)bonusLine.push(`${sk.element.icon} ${sk.element.element}属性`);
  if(sk.actionType)bonusLine.push(`${sk.actionType.icon} ${sk.actionType.action}`);
  const adjBonus=getAdjBonus(sk.slots?.adjective);if(adjBonus)bonusLine.push(`💎 ${adjBonus.jp}`);
  const advBonus=getAdvBonus(sk.slots?.adverb);if(advBonus)bonusLine.push(`🌀 ${advBonus.jp}`);

  // 学習表示: 使用単語ごとの品詞・意味 (Phase9 item10)
  const wordLearnHtml=SKILL_SLOTS.map(s=>{
    const w=sk.slots?.[s.pos];if(!w)return'';
    const wd=WM[w];if(!wd)return'';
    return `<div class="skd-word"><span class="skd-word-name">${w}</span><span class="skd-word-pos">${s.jp}</span><span class="skd-word-mean">${wd.meaning}</span></div>`;
  }).join('');

  const rank=getSkillRank((sk.words||[]).filter(Boolean).length);
  const date=new Date(sk.firstCreated||Date.now());
  const dateStr=`${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;

  el.style.display='block';
  el.innerHTML=`
    <div class="skd-close" onclick="closeSkillDet()">✕</div>
    <div class="skd-name" style="color:${RCOL[sk.rarity]}">${sk.name}</div>
    <div class="skd-rarity" style="color:${RCOL[sk.rarity]}">${RLBL[sk.rarity]} ・ ${rank.jp}</div>
    <div class="skd-sec"><div class="dst">使用単語と品詞</div>
      <div class="skd-words">${wordLearnHtml}</div>
    </div>
    ${bonusLine.length?`<div class="skd-sec"><div class="dst">品詞ボーナス</div>
      <div class="skd-stats" style="color:var(--violet)">${bonusLine.join(' / ')}</div>
    </div>`:''}
    <div class="skd-sec"><div class="dst">ステータス</div>
      <div class="skd-stats">${statParts.length?statParts.join(' / '):'なし'}</div>
    </div>
    <div class="skd-sec"><div class="dst">探索効果</div>
      <div class="skd-stats" style="color:var(--green)">${fxParts.length?fxParts.join(' / '):'なし'}</div>
    </div>
    <div class="skd-sec"><div class="dst">記録</div>
      <div class="skd-stats" style="color:var(--t2);font-size:10px;font-weight:400">使用回数: ${sk.uses||1} ・ 初回生成: ${dateStr}</div>
    </div>
    <div class="skd-sec"><div class="dst">装備</div>
      <div class="skd-equip">${slotBtns}</div>
    </div>`;
}
function closeSkillDet(){
  const el=document.getElementById('skill-det');
  if(el){el.style.display='none';el.innerHTML=''}
}

/* ════ SKILL SLOTS (Phase5: 探索ビルドシステム) ════ */
// Equip/unequip a skill into one of 3 active slots
function equipSkill(slotIdx,skillId){
  if(!S.equippedSkills)S.equippedSkills=[null,null,null];
  // If this skill is already equipped elsewhere, clear that slot first
  S.equippedSkills=S.equippedSkills.map((id,i)=>i!==slotIdx&&id===skillId?null:id);
  S.equippedSkills[slotIdx]=skillId;
  save();
  renderSkillLab();
  showSkillDet(skillId);
}
function unequipSkill(slotIdx){
  if(!S.equippedSkills)S.equippedSkills=[null,null,null];
  const id=S.equippedSkills[slotIdx];
  S.equippedSkills[slotIdx]=null;
  save();
  renderSkillLab();
  if(id)showSkillDet(id);
}
// Sum of active effects from all equipped skills, grouped by type
function getActiveBuildBonus(){
  const totals={};
  (S.equippedSkills||[]).forEach(id=>{
    if(!id)return;
    const sk=(S.skills||[]).find(s=>s.id===id);
    if(!sk)return;
    (sk.effects||[]).forEach(e=>{
      if(!totals[e.type])totals[e.type]={label:e.label,value:0,unit:e.unit};
      totals[e.type].value+=e.value;
    });
  });
  return totals;
}
// Convenience: get the total bonus value for a single effect type (0 if none equipped)
function getBuildBonus(type){
  const totals=getActiveBuildBonus();
  return totals[type]?totals[type].value:0;
}
