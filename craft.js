/* ════ CRAFT ════ */
// カテゴリ(archive)名 → 色。data.js の CCAT を参照。未知カテゴリは安全な既定色を返す。
function cc(archive){return (typeof CCAT!=='undefined'&&CCAT[archive])||'#8090a0'}
let CT='word',CS=['',''];

/* ── UX2: SO式クラフト(実験・失敗・成功率・品質) ──
   ・未発見の組み合わせは調合するまで結果が分からない(ネタバレ排除)
   ・調合費15G(Gold経済のシンク)。レシピ不一致=失敗、一致でも成功率85%〜
   ・成功率は素材単語の習熟度(learned/skilled/master)とEngineerジョブで上昇
     = 語彙を深く学ぶほど調合が上手くなる(学習ループとの直結)
   ・品質: 習熟度合計で 通常/✨高品質/🌟傑作。傑作は記憶の球+1(UX3経済へ還流)
   ・不一致で失敗したペアは記録(上限200)し「✗」表示で再浪費を防ぐ */
const CRAFT_FEE=15;
function craftKey(a,b){return [a,b].sort().join('|')}
function craftTried(a,b){return (S.craftTried||[]).includes(craftKey(a,b))}
function craftRecordTried(a,b){
  if(!S.craftTried)S.craftTried=[];
  const k=craftKey(a,b);
  if(!S.craftTried.includes(k)){
    S.craftTried.push(k);
    if(S.craftTried.length>200)S.craftTried.shift(); // セーブ肥大防止
  }
}
function craftSuccessRate(a,b){
  let r=0.85;
  [a,b].forEach(w=>{
    const si=(typeof gsi==='function')?gsi(w):1;
    if(si>=4)r+=0.07;else if(si>=3)r+=0.05;else if(si>=2)r+=0.03;
  });
  const j=(typeof JD!=='undefined')?JD.find(x=>x.id===S.job):null;
  if(j&&/engineer/i.test((j.id||'')+(j.name||'')))r+=0.05;
  return Math.min(0.99,r);
}
function craftQuality(a,b){
  const q=((typeof gsi==='function')?gsi(a):1)+((typeof gsi==='function')?gsi(b):1);
  if(q>=6&&Math.random()<0.5)return 'master';
  if(q>=4&&Math.random()<0.6)return 'fine';
  return 'normal';
}
function setCT(tab){CT=tab;CS=['',''];document.getElementById('t-wc').classList.toggle('on',tab==='word');document.getElementById('t-ic').classList.toggle('on',tab==='item');renderCft()}
function renderCft(){
  const recipes=CT==='word'?WR:IR;const disc=CT==='word'?S.cwrd:S.citem;
  const known=WD.filter(w=>gst(w.word)!=='unknown').map(w=>w.word);
  const [a,b]=CS;
  let res=null;
  if(a&&b)res=recipes.find(r=>(r.ingredients[0]===a&&r.ingredients[1]===b)||(r.ingredients[0]===b&&r.ingredients[1]===a))||null;
  const sH=(i)=>{const w=CS[i];return`<div class="csl ${w?'f':''}" onclick="clrSlot(${i})">${w?`<div style="font-size:12px;font-weight:700;color:var(--violet)">${w}</div><div style="font-size:7px;color:var(--t2);margin-top:2px">タップで消去</div>`:`<div>スロット ${i+1}</div>`}</div>`};
  const rH=()=>{
    if(!a||!b)return`<div class="crs"><div style="font-size:20px;opacity:.2">?</div></div>`;
    // UX2: 発見済みレシピのみ結果を表示。未発見は調合するまで分からない(SO式)
    if(res&&disc.includes(res.result)){
      return`<div class="crs r"><div style="font-size:11px;font-weight:700">${res.result}</div><div style="font-size:7px;color:var(--t2)">既知</div></div>`;
    }
    if(!res&&craftTried(a,b)){
      return`<div class="crs"><div style="font-size:10px;color:var(--rose)">✗ 何も生まれない</div><div style="font-size:7px;color:var(--t2)">試行済み</div></div>`;
    }
    return`<div class="crs"><div style="font-size:15px;color:var(--gold);font-weight:700">？？？</div><div style="font-size:7px;color:var(--t2)">調合で確かめよう</div></div>`;
  };

  // ── Recipe Encyclopedia (改修D) — every recipe shown; unknown ingredients/results masked as ??? ──
  const encRows=recipes.map(r=>{
    const found=disc.includes(r.result);
    const ingHtml=r.ingredients.map(ing=>{
      const k=found||gst(ing)!=='unknown';
      const col=k&&WM[ing]?cc(WM[ing].archive):null;
      return `<span class="enc-ing ${k?'k':'u'}" ${col?`style="color:${col}"`:''}>${k?ing:'???'}</span>`;
    }).join(' <span class="enc-plus">+</span> ');
    const resHtml=found?`<span class="enc-res k">${r.result}</span>`:`<span class="enc-res u">???</span>`;
    return `<div class="enc-row ${found?'found':''}">
      <span class="enc-status">${found?'✓':'　'}</span>
      <span class="enc-formula">${ingHtml} <span class="enc-eq">=</span> ${resHtml}</span>
      ${found&&r.hint?'':(r.hint&&!found?`<span class="enc-hint">💡 ${r.hint}</span>`:'')}
    </div>`;
  });
  const foundCount=recipes.filter(r=>disc.includes(r.result)).length;

  document.getElementById('cft-body').innerHTML=`
    <div class="cws"><div class="csls">${sH(0)}<div class="cop">+</div>${sH(1)}<div class="cop">=</div>${rH()}</div>
      <div style="margin-top:9px"><button class="cact" onclick="doCraft()" ${(!a||!b)?'disabled':''}>⚗️ 調合する (${CRAFT_FEE}G)</button>
        <div style="font-size:9px;color:var(--t2);margin-top:4px">所持 🪙${S.gold||0}G ／ 腕前(成功率) ${a&&b?Math.round(craftSuccessRate(a,b)*100)+'%':'--'}</div>
        ${res&&disc.includes(res.result)&&res.hint?`<div style="font-size:9px;color:var(--t2);margin-top:4px">💡 ${res.hint}</div>`:''}</div></div>
    <div class="cinv"><div class="cinv-t">${CT==='word'?'発見済み単語':'素材'} (${known.length})</div>
      <div class="wg">${known.length?known.map(w=>`<div class="wch ${CS.includes(w)?'on':''}" onclick="pickW('${w}')">${w}</div>`).join(''):'<div style="color:var(--t2);font-size:10px">ダンジョンで単語を発見しよう！</div>'}</div></div>
    <div class="enc" style="margin-top:10px">
      <div class="cinv-t">レシピ図鑑 (${foundCount}/${recipes.length})</div>
      <div class="enc-list">${encRows.join('')}</div>
    </div>`;
}
function pickW(w){if(CS[0]===w||CS[1]===w)return;if(!CS[0])CS[0]=w;else if(!CS[1])CS[1]=w;else{CS[0]=CS[1];CS[1]=w}renderCft()}
function clrSlot(i){CS[i]='';renderCft()}
function doCraft(){
  const recipes=CT==='word'?WR:IR;const disc=CT==='word'?S.cwrd:S.citem;
  const [a,b]=CS;
  if(!a||!b)return;
  // UX2: 調合費(Gold経済のシンク)。成否問わず消費=SOの素材リスクに相当
  if((S.gold||0)<CRAFT_FEE){toast(`🪙 調合には${CRAFT_FEE}Gかかる(所持${S.gold||0}G)`,'r');return}
  S.gold-=CRAFT_FEE;
  const recipe=recipes.find(r=>(r.ingredients[0]===a&&r.ingredients[1]===b)||(r.ingredients[0]===b&&r.ingredients[1]===a));
  if(!recipe){
    // 不一致: 失敗として記録(✗マーカーで再浪費を防ぐ)
    craftRecordTried(a,b);
    save();updateHdr();
    toast('💥 失敗… 何も生まれなかった','r');
    CS=['',''];renderCft();return;
  }
  // 一致: 成功率判定(習熟度・ジョブで上昇)
  if(Math.random()>craftSuccessRate(a,b)){
    save();updateHdr();
    toast('💦 失敗… だが確かな手応えがあった…！','gr'); // 正解ペアだけに出るSO的フィードバック
    CS=['',''];renderCft();return;
  }
  const quality=craftQuality(a,b);
  if(!disc.includes(recipe.result)){
    // 新発見: 品質でEXPスケール、傑作は記憶の球+1(UX3経済へ還流)
    disc.push(recipe.result);S.clog.push({a,b,result:recipe.result,type:CT});
    S.exp+=quality==='master'?50:quality==='fine'?30:20;
    if(quality==='master')S.spheres=(S.spheres||0)+1;
    showCraftAnim(a,b,recipe.result,()=>{
      if(CT==='word'&&WM[recipe.result])discover(recipe.result);
      else toast(`✨ ${recipe.result} 作成！`,'g');
      if(quality==='master')toast('🌟 傑作！ 記憶の球+1','g');
      else if(quality==='fine')toast('✨ 高品質！ EXPボーナス','g');
      save();updateHdr();renderCft();
    });
  }else{
    S.exp+=2;save();updateHdr();
    toast(`⚗️ ${recipe.result} を再調合した (+2 EXP)`,'g');
    renderCft();
  }
  CS=['',''];
}
function showCraftAnim(a,b,result,cb){
  const el=document.getElementById('craft-anim'),rw=WM[result];
  document.getElementById('ca-a').textContent=a;document.getElementById('ca-b').textContent=b;
  document.getElementById('ca-r').textContent=result;
  document.getElementById('ca-r').style.color=rw?RCOL[rw.rarity]||'var(--gold)':'var(--gold)';
  document.getElementById('ca-jp').textContent=rw?rw.meaning:'';
  el.classList.add('show');setTimeout(()=>{el.classList.remove('show');if(cb)cb()},1550);
}
