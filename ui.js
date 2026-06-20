/* ════ UI: HEADER, QUESTS, NAV, QUIZ, DISCOVERY CARD, TOAST, INIT ════ */
const AP_GAIN={common:5,uncommon:8,rare:12,epic:20,legendary:35};

/* ════ ARCHIVE EXP & WORD STAT GAIN (単語成長システム) ════ */
// Archive EXP awarded per discovery, scaled by rarity (仮値)
const AEXP_GAIN={common:5,uncommon:8,rare:12,epic:20,legendary:30};
// Base stat magnitude by rarity (仮値)
const STAT_BASE={common:2,uncommon:3,rare:4,epic:6,legendary:8};
// Returns {atk,hp,spd,label} — which stat(s) this word feeds, based on POS (品詞) + rarity + evolution tier
// Evolution multiplier: tier0=×1, tier1=×3, tier2=×5... (Fire ATK+2 -> Flame ATK+6 matches ×3, 仮値)
function getEvoMultiplier(word){
  const tier=EVO_TIER[word]||0;
  return 1+tier*2;
}
function getWordStatGain(word){
  const w=WM[word];if(!w)return{atk:0,hp:0,spd:0,label:''};
  const base=STAT_BASE[w.rarity]||2;
  const half=Math.max(1,Math.round(base/2));
  const mult=getEvoMultiplier(word);
  const g={atk:0,hp:0,spd:0};
  let label='';
  switch(w.pos){
    case 'noun':
      // 名詞 → HP / ATK寄り（idの偶奇で主軸を振り分け、ばらつきを出す）
      if(w.id%2===0){g.atk=base;label='ATK'}
      else{g.hp=base;label='HP'}
      break;
    case 'verb':
      // 動詞 → ATK / SPD寄り
      g.atk=half;g.spd=half;label='ATK・SPD';
      break;
    case 'adjective':
      // 形容詞 → 全体に小さく補正
      g.atk=1;g.hp=1;g.spd=1;label='ATK・HP・SPD';
      break;
    case 'adverb':
      // 副詞 → SPD寄り
      g.spd=base;label='SPD';
      break;
    default:
      g.atk=1;label='ATK';
  }
  g.atk*=mult;g.hp*=mult;g.spd*=mult;
  return {...g,label,mult};
}

/* ════ BUILD BONUS HELPERS (Phase5 skills + Phase6 jobs combined) ════ */
// Current job's bonus value if it matches the given bonusKey, else 0
function getJobBonus(bonusKey){
  const job=JD.find(j=>j.id===S.job);
  return (job&&job.bonusKey===bonusKey)?job.bonusVal:0;
}
// 探索EXP倍率 = 1 + skill('exp') (Mage job bonus does NOT affect this — see getAExpMultiplier)
function getExpMultiplier(){return 1+getBuildBonus('exp')}
// Archive EXP倍率 = 1 + skill('exp' reused as general boost is not appropriate; use dedicated none) + Mage job bonus
function getAExpMultiplier(){return 1+getJobBonus('aexp')}
// クイズ報酬倍率 (AP / Archive EXP on quiz-correct) = 1 + skill('quiz')
function getQuizMultiplier(){return 1+getBuildBonus('quiz')}
// Gold獲得倍率 = 1 + skill('gold')
function getGoldMultiplier(){return 1+getBuildBonus('gold')}
// 単語発見率ボーナス = skill('discover') + Scholar job bonus (確率系のため加算)
// 単語発見率ボーナス = skill('discover') + Scholar job bonus + 戦闘勝利による一時ボーナス(Phase8)
function getDiscoverBonus(){return getBuildBonus('discover')+getJobBonus('discover')+(DM?.battleDiscoverBonus||0)}
// レア単語出現率ボーナス = skill('rare')
function getRareBonus(){return getBuildBonus('rare')}

function discover(word,anim=true){
  if(gst(word)!=='unknown')return false;
  sst(word,'discovered');
  // 探索EXP +N% (Fire系スキル効果, Phase5)
  S.exp+=Math.round(ST_EXP[1]*getExpMultiplier());
  const w=WM[word];
  const apGain=AP_GAIN[w?.rarity]||5;
  S.ap=(S.ap||0)+apGain;
  // Archive EXP — fuels permanent player stat growth
  // 高レベル単語ほど効率上昇 + 進化単語(tier>0)は永続強化効率が高い (Phase3 item7)
  // + Mage職業ボーナス Archive EXP +20% (Phase6)
  const wlvBefore=getWLv(word).lv;
  const evoTier=EVO_TIER[word]||0;
  const lvBonus=1+(wlvBefore-1)*0.1;      // +10% per word level above 1
  const evoBonus=1+evoTier*0.3;           // +30% per evolution tier
  const aexpGain=Math.round((AEXP_GAIN[w?.rarity]||5)*lvBonus*evoBonus*getAExpMultiplier());
  S.aexp=(S.aexp||0)+aexpGain;
  // Word EXP / level-up / evolution (単語進化システム)
  const evoResult=gainWordExp(word);
  save();
  if(anim)showDisc(word,apGain,aexpGain,evoResult);
  updateHdr();checkJobs();return true;
}
function advance(word){
  const i=gsi(word);
  if(i>0&&i<ST.length-1){
    sst(word,ST[i+1]);
    // クイズ報酬 +N% (Water系スキル効果, Phase5)
    const expGain=Math.round(ST_EXP[i+1]*getQuizMultiplier());
    S.exp+=expGain;save();
    toast(`⭐ ${word} → ${ST_JP[i+1]}  +${expGain} EXP`,'g');
  }
  // Re-encountering a known word always grows its word level, even at max mastery (単語進化システム)
  if(i>0){
    const evoResult=gainWordExp(word);
    if(evoResult)announceEvolution(evoResult);
  }
  updateHdr();checkJobs();
  return i>0;
}

/* ════ WORD LEVEL / EVOLUTION CORE (Phase3) ════ */
// Adds +1 word EXP, handles level-up (cap WLV_CAP), and unlocks evolution target at cap.
// Returns {word, evolved:Word} if an evolution was just unlocked, else null.
function gainWordExp(word){
  const data=getWLv(word);
  if(data.lv>=WLV_CAP)return null; // already maxed, no further growth
  data.exp=(data.exp||0)+1;
  let leveledUp=false;
  while(data.exp>=WEXP_PER_LV && data.lv<WLV_CAP){
    data.exp-=WEXP_PER_LV;
    data.lv++;
    leveledUp=true;
  }
  if(data.lv>=WLV_CAP)data.exp=0; // no overflow display at cap
  setWLv(word,data);
  save();
  if(leveledUp && data.lv>=WLV_CAP){
    const evoTarget=EVOLUTION[word];
    if(evoTarget && WM[evoTarget] && gst(evoTarget)==='unknown'){
      discover(evoTarget,false); // register silently; announcement happens via evoResult
      return {word, evolved:evoTarget};
    }
  }
  return null;
}
// Shows a toast announcement for an evolution unlock (used when discover() can't show its own card)
function announceEvolution(evoResult){
  if(!evoResult)return;
  toast(`🌟 ${evoResult.word} Lv${WLV_CAP} → ${evoResult.evolved} 解放！`,'g');
}

/* ════ HEADER ════ */
function updateHdr(){
  const n=nd();
  document.getElementById('hw').textContent=n;
  document.getElementById('hx').textContent=S.exp;
  document.getElementById('hap').textContent=S.ap||0;
  document.getElementById('hgold').textContent=S.gold||0;
  const st=S.stats||{atk:0,hp:0,spd:0};
  const statTotal=(st.atk||0)+(st.hp||0)+(st.spd||0);
  const hstat=document.getElementById('hstat');
  if(hstat){
    hstat.textContent=statTotal;
    hstat.parentElement.title=`ATK ${st.atk||0} / HP ${st.hp||0} / SPD ${st.spd||0}`;
  }
  // Phase16: 持ち物の所持数(常時表示)
  const hinv=document.getElementById('h-inv');
  if(hinv)hinv.textContent=`${(S.inventory||[]).length}/${INV_MAX_SLOTS}`;
  const j=JD.find(j=>j.id===S.job);
  document.getElementById('hj').textContent=j?j.icon+' '+j.name:'🌱 Novice';
  const pct=S.exp%100;
  document.getElementById('ef').style.width=pct+'%';
  document.getElementById('el').textContent=`${pct}/100 EXP`;
  const rp=Math.round(n/WD.length*100);
  document.getElementById('rpct').textContent=rp+'%';
  document.getElementById('rfil').style.width=rp+'%';
  const cs=document.getElementById('cs');
  if(cs)cs.innerHTML=`
    <div class="cr"><span>単語クラフト</span><b>${S.cwrd.length}/${WR.length}</b></div>
    <div class="cr"><span>アイテムクラフト</span><b>${S.citem.length}/${IR.length}</b></div>
    <div class="cr"><span>職業</span><b>${S.unlockedJobs.length}/${JD.length}</b></div>`;
  renderQuests();
}

/* ════ QUEST SYSTEM (改修A) ════ */
// Goal generators: each returns {label, done, target} or null if not applicable
function buildQuestPool(){
  const goals=[];
  // 1. Discover a specific nearby word — pick an undiscovered word related to something already known
  const knownWords=WD.filter(w=>gst(w.word)!=='unknown');
  let nextWord=null;
  for(const kw of knownWords){
    const cand=(kw.relations.related||[]).find(r=>WM[r]&&gst(r)==='unknown');
    if(cand){nextWord=cand;break}
  }
  if(!nextWord){
    const anyUnknown=WD.find(w=>gst(w.word)==='unknown');
    if(anyUnknown)nextWord=anyUnknown.word;
  }
  if(nextWord){
    goals.push({label:`${nextWord} を発見する`,done:gst(nextWord)!=='unknown'});
  }
  // 2. Collect N words total (next multiple-of-5 milestone)
  const n=nd();
  const target=Math.ceil((n+1)/5)*5;
  goals.push({label:`単語を${target}個収集する`,done:n>=target,progress:`${n}/${target}`});
  // 3. Craft next undiscovered word recipe
  const nextRecipe=WR.find(r=>!S.cwrd.includes(r.result));
  if(nextRecipe){
    goals.push({label:`${nextRecipe.result} をクラフトする`,done:S.cwrd.includes(nextRecipe.result)});
  }
  // 4. Unlock next job
  const nextJob=JD.find(j=>!S.unlockedJobs.includes(j.id)&&!j.always);
  if(nextJob){
    const jp=jobProgress(nextJob);
    goals.push({label:`${nextJob.name} を解放する`,done:S.unlockedJobs.includes(nextJob.id),progress:`${jp.current}/${jp.target}`});
  }
  // 5. Advance a word's mastery (next learned-or-above target)
  const advCand=knownWords.find(w=>gsi(w.word)>0&&gsi(w.word)<ST.length-1);
  if(advCand){
    const si=gsi(advCand.word);
    goals.push({label:`${advCand.word} を${ST_JP[si+1]}にする`,done:gsi(advCand.word)>si});
  }
  return goals.slice(0,3);
}
function renderQuests(){
  const el=document.getElementById('qb-list');
  if(!el)return;
  const goals=buildQuestPool();
  el.innerHTML=goals.map(g=>`
    <div class="qb-item ${g.done?'done':''}">
      <span class="qb-box">${g.done?'✓':''}</span>
      <span>${g.label}${g.progress?` (${g.progress})`:''}</span>
    </div>`).join('');
}
// Returns the word targeted by the "discover X" quest goal, for Archive highlight (改修C)
function getTrackedWord(){
  const knownWords=WD.filter(w=>gst(w.word)!=='unknown');
  for(const kw of knownWords){
    const cand=(kw.relations.related||[]).find(r=>WM[r]&&gst(r)==='unknown');
    if(cand)return cand;
  }
  const anyUnknown=WD.find(w=>gst(w.word)==='unknown');
  return anyUnknown?anyUnknown.word:null;
}
// Count discovered words matching a POS (品詞別発見数)
function countByPos(pos){return WD.filter(w=>w.pos===pos&&gst(w.word)!=='unknown').length}
// Job unlock progress: {current, target} for display
function jobProgress(job){
  if(job.unlock.type==='always')return{current:1,target:1};
  if(job.unlock.type==='pos')return{current:countByPos(job.unlock.pos),target:job.unlock.count};
  if(job.unlock.type==='registered')return{current:nd(),target:job.unlock.count};
  return{current:0,target:1};
}
function jobUnlockMet(job){
  const p=jobProgress(job);
  return p.current>=p.target;
}
function checkJobs(){
  JD.forEach(job=>{
    if(S.unlockedJobs.includes(job.id))return;
    if(job.unlock.type==='always'){S.unlockedJobs.push(job.id);return}
    if(jobUnlockMet(job)){
      S.unlockedJobs.push(job.id);
      toast(`🏆 職業解放: ${job.icon} ${job.name}!`,'g');
      save();if(S.screen==='job')renderJobs();
    }
  });
}

/* ════ NAV ════ */
function go(name){
  S.screen=name;
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  document.getElementById('s-'+name).classList.add('on');
  document.querySelectorAll('.nb').forEach(b=>{if(b.getAttribute('onclick')?.includes("'"+name+"'"))b.classList.add('on')});
  // The Archive Atlas(世界地図): 探索タブを抜けたら描画ループを止める(他画面では不要な再描画を防ぐ)
  if(name!=='exp' && typeof WM_hide==='function')WM_hide();
  if(name==='arc')renderArc();
  else if(name==='exp'){renderExp();if(typeof WM_show==='function')WM_show();}
  else if(name==='cft')renderCft();
  else if(name==='skill')renderSkillLab();
  else if(name==='job')renderJobs();
}

/* ════ QUIZ ════ */
let QS={words:[],idx:0,answered:false,score:0,dungeon:null,single:false,fromDungeon:false};
function startWQ(){if(!selW)return;const w=WM[selW];if(!w)return;QS={words:[w],idx:0,answered:false,score:0,dungeon:null,single:true,fromDungeon:false};openQ();showQ()}
function openQ(){document.getElementById('quiz-ov').classList.add('on')}
function closeQ(){
  document.getElementById('quiz-ov').classList.remove('on');
  if(QS.score>0){S.exp+=QS.score*3;save();updateHdr();toast(`+${QS.score*3} EXP`,'g')}
  if(QS.fromDungeon){document.getElementById('dmov').classList.add('show');dmRender()}
  if(S.screen==='arc')renderArc();
  if(S.screen==='exp')renderExp();
}
function showQ(){
  const words=QS.words;
  document.getElementById('q-dots').innerHTML=words.map((w,i)=>`<div class="qdot ${i<QS.idx?'d':i===QS.idx?'c':''}"></div>`).join('');
  if(QS.idx>=words.length){
    document.getElementById('q-w').textContent='✅';
    document.getElementById('q-p').textContent=`スコア: ${QS.score}/${words.length}`;
    document.getElementById('q-ch').innerHTML='';
    document.getElementById('q-r').textContent='クリア!';document.getElementById('q-r').className='qr w';
    const nb=document.getElementById('q-nx');nb.textContent='終了 ✓';nb.disabled=false;nb.onclick=closeQ;return;
  }
  QS.answered=false;
  const w=words[QS.idx];
  document.getElementById('q-tit').textContent=QS.dungeon?QS.dungeon.name:'単語学習';
  document.getElementById('q-pr').textContent=`${QS.idx+1}/${words.length}`;
  document.getElementById('q-w').textContent=w.word;
  document.getElementById('q-w').style.color=RCOL[w.rarity]||'var(--gold)';
  document.getElementById('q-p').textContent=w.pos.toUpperCase();
  document.getElementById('q-r').textContent='';document.getElementById('q-r').className='qr';
  const nb=document.getElementById('q-nx');nb.disabled=true;nb.textContent='次へ →';nb.onclick=nextQ;
  const correct=w.meaning;
  const dist=WD.filter(x=>x.meaning&&x.meaning!==correct&&x.archive===w.archive).sort(()=>Math.random()-.5).slice(0,2).map(x=>x.meaning);
  const extra=WD.filter(x=>x.meaning&&x.meaning!==correct&&!dist.includes(x.meaning)).sort(()=>Math.random()-.5).slice(0,4-dist.length-1).map(x=>x.meaning);
  const ch=[correct,...dist,...extra].sort(()=>Math.random()-.5);
  document.getElementById('q-ch').innerHTML=ch.map(c=>`<button class="qc" onclick="ansQ(this,'${esc(c)}','${esc(correct)}')">${c}</button>`).join('');
}
function ansQ(btn,chosen,correct){
  if(QS.answered)return;QS.answered=true;
  document.querySelectorAll('.qc').forEach(b=>{b.disabled=true;if(b.textContent===correct)b.classList.add('ok')});
  const dots=document.getElementById('q-dots').querySelectorAll('.qdot');
  const w=QS.words[QS.idx];
  if(chosen===correct){
    btn.classList.add('ok');QS.score++;
    document.getElementById('q-r').textContent='✓ 正解！';document.getElementById('q-r').className='qr w';
    if(gst(w.word)==='unknown'){discover(w.word);DM.wordsFound++}else advance(w.word);
    if(dots[QS.idx])dots[QS.idx].className='qdot d';
  }else{
    btn.classList.add('ng');
    document.getElementById('q-r').textContent=`✗ 正解: ${correct}`;document.getElementById('q-r').className='qr l';
    discover(w.word,false);
    if(dots[QS.idx])dots[QS.idx].className='qdot f';
  }
  document.getElementById('q-nx').disabled=false;
  if(S.screen==='arc')renderNodes();
}
function nextQ(){QS.idx++;showQ()}
function esc(s){return(s||'').replace(/'/g,"&#39;")}

/* ════ DISCOVERY CARD (改修B) ════ */
let dtimer=null;
function showDisc(word,apGain=5,aexpGain=5,evoResult=null){
  const w=WM[word];if(!w)return;
  const ov=document.getElementById('disc-ov'),card=document.getElementById('dcard');
  const rc=RCOL[w.rarity]||'#6a7090';
  document.getElementById('dw').textContent=word;document.getElementById('dw').style.color=rc;
  document.getElementById('djp').textContent=w.meaning;
  document.getElementById('dc3').textContent=`${CICON[w.archive]||''} ${CJP[w.archive]||w.archive} · ${w.pos}`;
  document.getElementById('dr').textContent=RLBL[w.rarity];document.getElementById('dr').style.color=rc;
  document.getElementById('dn').textContent=w.rarity==='legendary'?'✦ レジェンダリー発見 ✦':'✦ 新しい単語を発見! ✦';
  card.className='dcard r-'+w.rarity;

  // Rewards row
  document.getElementById('d-rewards').innerHTML=`
    <div class="d-rwd exp">⭐ +${ST_EXP[1]} EXP</div>
    <div class="d-rwd ap">💠 +${apGain} AP</div>
    <div class="d-rwd aexp">📈 +${aexpGain} Archive EXP</div>`;

  // Stat-growth hint (単語成長システム)
  const sg=getWordStatGain(word);
  const statEl=document.getElementById('d-statgain');
  if(statEl)statEl.textContent=sg.label?`${sg.label}に関連する単語です`:'';

  // Newly-reachable items: related words now revealed, and word-craft recipes now completable
  const newRelated=(w.relations.related||[]).filter(r=>WM[r]&&gst(r)==='unknown');
  const newRecipes=WR.filter(r=>!S.cwrd.includes(r.result)&&r.ingredients.includes(word)
    &&r.ingredients.some(ing=>ing===word||gst(ing)!=='unknown'));
  const unlockEl=document.getElementById('d-unlocks');
  if(evoResult||newRelated.length||newRecipes.length){
    let html=`<div class="d-unlocks-title">新たな手がかり</div>`;
    if(evoResult)html+=`<div class="d-unlock-item d-evo">🌟 ${evoResult.word} Lv${WLV_CAP} → ${evoResult.evolved} 解放！</div>`;
    newRelated.slice(0,3).forEach(r=>{html+=`<div class="d-unlock-item">・${r}</div>`});
    newRecipes.slice(0,2).forEach(r=>{
      const other=r.ingredients.find(ing=>ing!==word);
      html+=`<div class="d-unlock-item">・${other} + ${word} → ${r.result} レシピ</div>`;
    });
    unlockEl.innerHTML=html;unlockEl.style.display='block';
  } else {
    unlockEl.style.display='none';
  }

  ov.classList.add('show');ov.style.pointerEvents='all';
  spawnP(w.rarity,rc);

  // Legendary: screen flash
  if(w.rarity==='legendary'){
    const fl=document.getElementById('legendary-flash');
    fl.classList.remove('go');
    requestAnimationFrame(()=>fl.classList.add('go'));
    setTimeout(()=>fl.classList.remove('go'),700);
  }

  if(dtimer)clearTimeout(dtimer);
  dtimer=setTimeout(hideDisc,w.rarity==='legendary'?3400:2400);
  ov.onclick=hideDisc;
}
function hideDisc(){const ov=document.getElementById('disc-ov');ov.classList.remove('show');ov.style.pointerEvents='none'}
function spawnP(rarity,col){
  const cv=document.getElementById('dparticles');const ctx=cv.getContext('2d');
  const W=cv.width=cv.offsetWidth||250,H=cv.height=cv.offsetHeight||190;
  const n=rarity==='legendary'?40:rarity==='epic'?28:rarity==='rare'?18:10;
  const pts=Array.from({length:n},()=>({x:W/2,y:H/2,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7-2,life:1,decay:Math.random()*.022+.014,size:Math.random()*4+2,col:rarity==='legendary'?['#e8c060','#e0982a','#fff'][Math.floor(Math.random()*3)]:col}));
  let fr=0;
  (function tick(){ctx.clearRect(0,0,W,H);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.life-=p.decay;if(p.life<=0)return;ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.col;ctx.beginPath();if(rarity==='legendary'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(fr*.05);for(let i=0;i<5;i++){ctx.lineTo(Math.cos(i*Math.PI*.4)*(p.size*1.5),Math.sin(i*Math.PI*.4)*(p.size*1.5));ctx.lineTo(Math.cos(i*Math.PI*.4+Math.PI*.2)*(p.size*.6),Math.sin(i*Math.PI*.4+Math.PI*.2)*(p.size*.6))}ctx.closePath();ctx.fill();ctx.restore()}else{ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.restore()});fr++;if(pts.some(p=>p.life>0))requestAnimationFrame(tick);else ctx.clearRect(0,0,W,H)})();
}

/* ════ TOAST ════ */
function toast(msg,type=''){const c=document.getElementById('toasts');const el=document.createElement('div');el.className='toast '+(type||'');el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),2350)}

/* ════ INIT ════ */
function init(){
  load();
  if(!S.unlockedJobs.includes('novice'))S.unlockedJobs.push('novice');
  ['Fire','Slime','Buy'].forEach(w=>{if(gst(w)==='unknown')sst(w,'discovered')});
  save();updateHdr();initPan();checkJobs();renderArc();
  window.addEventListener('resize',()=>{if(S.screen==='arc')renderArc()});
  document.querySelectorAll('.nb').forEach(b=>{if(b.getAttribute('onclick')?.includes("'arc'"))b.classList.add('on')});
}
init();
