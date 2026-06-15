/* ════ CRAFT ════ */
let CT='word',CS=['',''];
function setCT(tab){CT=tab;CS=['',''];document.getElementById('t-wc').classList.toggle('on',tab==='word');document.getElementById('t-ic').classList.toggle('on',tab==='item');renderCft()}
function renderCft(){
  const recipes=CT==='word'?WR:IR;const disc=CT==='word'?S.cwrd:S.citem;
  const known=WD.filter(w=>gst(w.word)!=='unknown').map(w=>w.word);
  const [a,b]=CS;
  let res=null;
  if(a&&b)res=recipes.find(r=>(r.ingredients[0]===a&&r.ingredients[1]===b)||(r.ingredients[0]===b&&r.ingredients[1]===a))||null;
  const sH=(i)=>{const w=CS[i];return`<div class="csl ${w?'f':''}" onclick="clrSlot(${i})">${w?`<div style="font-size:12px;font-weight:700;color:var(--violet)">${w}</div><div style="font-size:7px;color:var(--t2);margin-top:2px">タップで消去</div>`:`<div>スロット ${i+1}</div>`}</div>`};
  const rH=()=>{if(!a||!b)return`<div class="crs"><div style="font-size:20px;opacity:.2">?</div></div>`;if(res){const k2=disc.includes(res.result);return`<div class="crs r"><div style="font-size:11px;font-weight:700">${res.result}</div>${k2?'<div style="font-size:7px;color:var(--t2)">既知</div>':'<div style="font-size:8px;color:var(--gold)">新発見!</div>'}</div>`}return`<div class="crs"><div style="font-size:10px;color:var(--rose)">レシピなし</div></div>`};

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
      <div style="margin-top:9px"><button class="cact" onclick="doCraft()" ${!res?'disabled':''}>${CT==='word'?'✨ 単語をクラフト':'⚒️ アイテムをクラフト'}</button>
        ${res?.hint?`<div style="font-size:9px;color:var(--t2);margin-top:4px">💡 ${res.hint}</div>`:''}</div></div>
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
  const recipe=recipes.find(r=>(r.ingredients[0]===a&&r.ingredients[1]===b)||(r.ingredients[0]===b&&r.ingredients[1]===a));
  if(!recipe)return;
  if(!disc.includes(recipe.result)){
    disc.push(recipe.result);S.clog.push({a,b,result:recipe.result,type:CT});S.exp+=20;
    showCraftAnim(a,b,recipe.result,()=>{
      if(CT==='word'&&WM[recipe.result])discover(recipe.result);
      else toast(`✨ ${recipe.result} 作成！`,'g');
      save();updateHdr();renderCft();
    });
  }else{toast(`${recipe.result} は既知`)}
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
