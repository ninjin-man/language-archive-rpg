/* ════ PLAYER GROWTH (単語成長システム — 永続強化) ════ */
// Cost to raise a stat by 1, scaling with current value (仮値)
function statUpCost(cur){return 10+cur*5}
function renderPlayerStats(){
  const el=document.getElementById('player-stats');
  if(!el)return;
  const st=S.stats||{atk:0,hp:0,spd:0};
  const aexp=S.aexp||0;
  const rows=[
    {key:'atk',label:'ATK',icon:'⚔️',val:st.atk||0},
    {key:'hp',label:'HP',icon:'❤️',val:st.hp||0},
    {key:'spd',label:'SPD',icon:'💨',val:st.spd||0},
  ];
  el.innerHTML=`
    <div class="ps-aexp">📈 Archive EXP: <b>${aexp}</b></div>
    <div class="ps-grid">
      ${rows.map(r=>{
        const cost=statUpCost(r.val);
        const can=aexp>=cost;
        return `<div class="ps-card">
          <div class="ps-icon">${r.icon}</div>
          <div class="ps-label">${r.label}</div>
          <div class="ps-val">${r.val}</div>
          <button class="ps-btn" ${can?'':'disabled'} onclick="upgradeStat('${r.key}')">強化 (${cost})</button>
        </div>`;
      }).join('')}
    </div>`;
}
function upgradeStat(key){
  if(!S.stats)S.stats={atk:0,hp:0,spd:0};
  const cur=S.stats[key]||0;
  const cost=statUpCost(cur);
  if((S.aexp||0)<cost)return;
  S.aexp-=cost;
  S.stats[key]=cur+1;
  save();
  toast(`${key.toUpperCase()} +1 (永続強化)`,'g');
  renderPlayerStats();
}

/* ════ JOBS ════ */
function renderJobs(){
  renderPlayerStats();
  const g=document.getElementById('jg');
  g.innerHTML=JD.map(job=>{
    const ul=S.unlockedJobs.includes(job.id),ac=S.job===job.id;
    const jp=jobProgress(job);
    const allM=job.always||jp.current>=jp.target;
    const pct=jp.target?Math.min(100,Math.round(jp.current/jp.target*100)):100;
    const condLabel=job.unlock.type==='pos'
      ? `${PICO[job.unlock.pos]||''} ${job.unlock.pos}発見数`
      : job.unlock.type==='registered' ? '図鑑登録数' : '';
    return `<div class="jcard ${ul?'ul':''} ${ac?'ac':''}">
      ${ac?'<div class="abadge">● 装備中</div>':''}
      <div class="jt"><div class="ji">${job.icon}</div><div><div class="jn">${job.name}</div><div class="jtr">Tier ${job.tier}</div></div></div>
      <div class="jd">${job.desc}</div>
      <div class="jb">✦ ${job.bonus}</div>
      ${!job.always?`<div class="jr"><span style="font-size:8px;color:var(--t2)">${condLabel} (${jp.current}/${jp.target})</span></div>
      <div class="jpb"><div class="jpf" style="width:${pct}%"></div></div>`:''}
      ${!ul?`<button class="jbtn ul" ${!allM?'disabled':''} onclick="ulJob('${job.id}')">${allM?'解放する →':`あと${jp.target-jp.current}必要`}</button>`:''}
      ${ul&&!ac?`<button class="jbtn sa" onclick="setJob('${job.id}')">装備する</button>`:''}
    </div>`;
  }).join('');
}
function ulJob(id){if(!S.unlockedJobs.includes(id)){S.unlockedJobs.push(id);save()}setJob(id);renderJobs()}
function setJob(id){S.job=id;const j=JD.find(j=>j.id===id);toast(`${j.icon} ${j.name} に転職！`,'g');save();updateHdr();renderJobs()}
