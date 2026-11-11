// ===== Interface =====
const S = { phase:'setup', ctl:{D:'bot',I:'bot',A:'human',E:'bot'}, pers:{D:'balanced',I:'hardliner',A:'balanced',E:'cooperative'},
  advisor:true, campaign:'story', seed:2026, randomProposer:true, rng:null, speed:650, plan:CAMPAIGN, idx:0, regime:'today', Y:null, history:[], pending:null, compose:null, council:null, result:null, gaugeKey:'' };
let resume = null;
const wait = () => new Promise(r => resume = r);
const act = v => { const r = resume; resume = null; if (r) r(v); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fm = v => (Math.round(v*10)/10).toFixed(1);
const rs = v => 'Rs\u00A0' + fm(v) + '\u00A0cr';
const nm = s => META[s].name;
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0,-1).join(', ') + ' and ' + a[a.length-1];
const chip = s => `<span class="chip" style="--c:var(--${s})">${nm(s)}</span>`;
const grp = k => listJoin(k.split('').map(nm));
const TYPE = {wet:'Wet', normal:'Normal', dry:'Dry'};
const PERS = {cooperative:'Cooperative', balanced:'Balanced', hardliner:'Hardliner'};
const $ = id => document.getElementById(id);

// ---------- reservoir gauge ----------
function gaugeSVG(cfg, regime){
  const sc = scenario(BASE, cfg.type, regime, {narmadaOK: cfg.narmadaOK});
  const live = BASE.years[cfg.type].live, gross = live + BASE.dead, FULL = 813.14;
  const top = 34, h = 356, x0 = 18, w = 104, yv = v => top + h*(1 - v/FULL);
  const bands = [{k:'dead', from:0, to:BASE.dead, fill:'var(--dead)', label:'Dead storage', amt:BASE.dead}];
  let base = BASE.dead;
  ['D','I','E','A'].forEach(s => { const a = sc.w[s]; if (a > 0.05){ bands.push({k:s, from:base, to:base+a, fill:`var(--${s})`, label:nm(s)+' right', amt:a}); base += a; } });
  bands.push({k:'evap', from:base, to:gross, fill:'url(#hatch)', label:'Lost to evaporation', amt:gross-base});
  let rects = '', labels = []; 
  bands.forEach(b => { rects += `<rect x="${x0}" y="${yv(b.to)}" width="${w}" height="${Math.max(yv(b.from)-yv(b.to),0)}" fill="${b.fill}"/>`; labels.push({y:(yv(b.from)+yv(b.to))/2, b}); });
  labels.sort((a,b)=>b.y-a.y); for (let i=1;i<labels.length;i++) if (labels[i-1].y - labels[i].y < 34) labels[i].y = labels[i-1].y - 34;
  const lab = labels.map(l => `<line x1="${x0+w}" y1="${(yv(l.b.from)+yv(l.b.to))/2}" x2="${x0+w+12}" y2="${l.y}" class="lead"/>
      <text x="${x0+w+16}" y="${l.y-3}" class="gl">${l.b.label}</text><text x="${x0+w+16}" y="${l.y+12}" class="gv">${fm(l.b.amt)} MCM</text>`).join('');
  const pct = 100*gross/FULL;
  return `<svg viewBox="0 0 260 410" role="img" aria-label="Dharoi storage ${fm(gross)} MCM, ${fm(pct)} percent of design capacity">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--water)" stroke-width="2"/></pattern></defs>
    <text x="${x0}" y="16" class="gt">Dharoi, ${fm(pct)}% full</text>
    <rect x="${x0}" y="${top}" width="${w}" height="${h}" class="tank"/>
    <line x1="${x0-6}" y1="${top}" x2="${x0+w+6}" y2="${top}" class="full"/><text x="${x0+w+10}" y="${top+4}" class="gv">Design full, 813 MCM</text>
    <g class="rise">${rects}</g>${lab}
    <line x1="${x0-6}" y1="${yv(gross)}" x2="${x0+w}" y2="${yv(gross)}" class="level"/>
  </svg>
  <dl class="facts">
    <div><dt>Usable this year</dt><dd>${fm(sc.usable)} MCM</dd></div>
    <div><dt>Total demand</dt><dd>${fm(BASE.d.D+BASE.d.I+BASE.d.A+BASE.d.E)} MCM</dd></div>
    <div><dt>Treated wastewater</dt><dd>${fm(sc.T)} MCM, owned by the city</dd></div>
    <div><dt>Narmada fallback</dt><dd>${cfg.narmadaOK ? 'Covers the city' : 'Cut: city short by 27.9 MCM'}</dd></div>
    <div><dt>Rights</dt><dd>${regime==='today' ? 'Today’s (irrigation first)' : 'Reformed'}</dd></div>
  </dl>`;
}
function yearsStrip(){
  const items = [];
  for (let k=0;k<5;k++){
    if (k===3) items.push(`<li class="council ${S.council && S.council.done ? 'done':''}">Council${S.council && S.council.done ? (S.council.passed?': reform':': no change') : ''}</li>`);
    const cfg = S.plan[k], seen = S.phase!=='setup' && k <= S.idx, cur = S.phase!=='setup' && S.phase!=='final' && k===S.idx;
    items.push(`<li class="${cur?'cur':''} ${seen && !cur?'done':''}" ${cur?'aria-current="step"':''}><span>Year ${k+1}</span><b>${seen ? TYPE[cfg.type] + (cfg.narmadaOK?'':', canal cut') : 'Not yet'}</b></li>`);
  }
  return items.join('');
}
// ---------- seats ----------
function seatsTable(){
  const Y = S.Y, df = Math.pow(DELTA, Y.fails);
  const status = s => { const d = Y.deals.find(d=>d.S.includes(s)); if (!d) return '<span class="st open">At the table</span>';
    return d.alone ? `<span class="st alone">On its own, ${rs(d.x[s])}</span>` : `<span class="st deal">In a deal, ${rs(d.x[s])}</span>`; };
  return `<table class="seats"><thead><tr><th scope="col">Sector</th><th scope="col">Played by</th><th scope="col" class="n">Right</th><th scope="col" class="n">Worth alone now</th><th scope="col">Status</th></tr></thead><tbody>
  ${SECTORS.map(s => `<tr><th scope="row">${chip(s)}<small>${META[s].who}</small></th><td>${S.ctl[s]==='human'?'<b>You</b>':'Bot, '+PERS[S.pers[s]].toLowerCase()}</td>
   <td class="n">${fm(Y.sc.w[s])} MCM</td><td class="n">${rs(df*Y.g[s])}</td><td>${status(s)}</td></tr>`).join('')}</tbody></table>`;
}
function logView(){
  const Y = S.Y; if (!Y.log.length) return '';
  const line = e => {
    if (e.t==='prop'){ const others = e.S.filter(j=>j!==e.p); return `<b>${nm(e.p)}</b> proposes a deal with ${listJoin(others.map(nm))}. Shares: ${e.S.map(j=>`${nm(j)} ${rs(e.x[j])}`).join(', ')}.`; }
    if (e.t==='acc') return `${nm(e.j)} accepts.`;
    if (e.t==='rej') return `<span class="neg">${nm(e.j)} rejects.</span>`;
    if (e.t==='deal') return `<b>Deal signed</b> by ${grp(e.k)}.`;
    if (e.t==='fail') return `<span class="neg">Session ${e.n} ends without agreement.</span> Every group’s value falls by 6%.`;
    if (e.t==='alone') return `${nm(e.p)} leaves the table and uses only its own right, worth ${rs(e.v)}.`;
    if (e.t==='session') return `<span class="sess">Session ${e.n}</span>`;
    return '';
  };
  return `<h3>Minutes of the meeting</h3><ol class="log" id="log">${Y.log.map(e=>`<li class="${e.t}">${line(e)}</li>`).join('')}</ol>`;
}
// ---------- composer ----------
function defaultOffers(Y, members, p){
  if (members.length===1) return {};
  const x = S.advisor ? suggestSplit(Y, members, p) : null, out = {};
  members.filter(j=>j!==p).forEach(j => out[j] = x ? x[j] : Math.round(Math.pow(DELTA,Y.fails)*Y.g[j]*10)/10);
  return out;
}
function composeShares(){
  const c = S.compose, Y = S.Y, x = {}; let given = 0;
  c.members.filter(j=>j!==c.p).forEach(j => { x[j] = +c.offers[j] || 0; given += x[j]; });
  x[c.p] = pot(Y, c.members) - given; return x;
}
function composeSummary(){
  const c = S.compose, Y = S.Y, x = composeShares(), df = Math.pow(DELTA,Y.fails);
  const bad = c.members.some(j => x[j] < -1e-9);
  let html = `<p class="share">Your share: <b class="${x[c.p]<0?'neg':''}">${rs(x[c.p])}</b> of ${rs(pot(Y,c.members))}</p>`;
  if (S.advisor && c.members.length>1){
    const warn = subsets(c.members).filter(T=>T.length<c.members.length).map(T=>({T, got:T.reduce((a,j)=>a+x[j],0), worth:df*Y.g[key(T)]})).filter(o=>o.got < o.worth-0.05).sort((a,b)=>(a.got-a.worth)-(b.got-b.worth));
    html += warn.length ? `<div class="advice warn"><p>Inside this deal, some groups would do better on their own:</p><ul>${warn.slice(0,4).map(o=>`<li>${listJoin(o.T.map(nm))}: ${rs(o.worth)} alone, ${rs(o.got)} here</li>`).join('')}</ul></div>`
                        : `<div class="advice ok"><p>No group inside this deal would do better on its own. The split is in the core of this group’s game.</p></div>`;
  }
  html += `<div class="row"><button class="primary" data-act="propose" ${bad?'disabled':''}>Propose this deal</button>
     <button data-act="alone">Leave the table and keep ${rs(pot(Y,[c.p]))}</button></div>${bad?'<p class="neg">Shares cannot be negative. Lower an offer or add members.</p>':''}`;
  return html;
}
function composerView(){
  const c = S.compose, Y = S.Y;
  const others = c.members.filter(j=>j!==c.p);
  return `<div class="panel you"><h3>${nm(c.p)}, it is your turn to propose</h3>
   <p>Choose who is in the deal, then offer each of them a share of the group’s worth. You keep the rest. Everyone you name must accept.</p>
   <fieldset class="members"><legend>Who is in the deal</legend>${Y.U.map(s=>`<label><input type="checkbox" data-member="${s}" ${c.members.includes(s)?'checked':''} ${s===c.p?'disabled':''}> ${nm(s)}</label>`).join('')}</fieldset>
   ${others.length ? `<table class="offers"><thead><tr><th scope="col">Member</th><th scope="col" class="n">Your offer (Rs cr)</th><th scope="col" class="n">Worth alone now</th>${S.advisor?'<th scope="col" class="n">Expects if this session fails</th>':''}</tr></thead><tbody>
   ${others.map(j=>{ const e = contValue(Y,j); const lo = S.advisor && (+c.offers[j]||0) < e - 0.05;
     return `<tr><th scope="row">${chip(j)}${S.ctl[j]==='bot'?`<small>${PERS[S.pers[j]]} bot</small>`:'<small>Another player</small>'}</th>
     <td class="n"><input type="number" step="0.1" min="0" inputmode="decimal" data-offer="${j}" value="${fm(+c.offers[j]||0)}" aria-label="Offer to ${nm(j)}"></td>
     <td class="n">${rs(Math.pow(DELTA,Y.fails)*Y.g[j])}</td>${S.advisor?`<td class="n ${lo?'neg':''}">${rs(e)}${lo?'<small>likely to reject</small>':''}</td>`:''}</tr>`; }).join('')}</tbody></table>
   ${S.advisor?`<div class="row"><button data-act="fill-nuc">Use the nucleolus split</button><button data-act="fill-nn">Use the normalized nucleolus split</button></div>`:''}` : '<p>You have named nobody else. Add members, or leave the table.</p>'}
   <div id="compose-summary">${composeSummary()}</div></div>`;
}
function respondView(){
  const {j, prop} = S.pending, Y = S.Y;
  return `<div class="panel you"><h3>${nm(j)}, ${nm(prop.p)} has made you an offer</h3>
   <p>The deal includes ${listJoin(prop.S.map(nm))}. Its worth this session is ${rs(pot(Y,prop.S))}.</p>
   <table class="offers"><tbody>${prop.S.map(s=>`<tr class="${s===j?'me':''}"><th scope="row">${chip(s)}</th><td class="n">${rs(prop.x[s])}</td></tr>`).join('')}</tbody></table>
   ${S.advisor?`<div class="advice"><p>If you reject, this session fails and everything shrinks by 6%. Your expected share next session is about <b>${rs(contValue(Y,j))}</b>. Alone you are worth ${rs(Math.pow(DELTA,Y.fails)*Y.g[j])} now.</p></div>`:''}
   <div class="row"><button class="primary" data-act="accept">Accept ${rs(prop.x[j])}</button><button data-act="reject">Reject</button></div></div>`;
}
// ---------- stage views ----------
function setupView(){
  return `<div class="intro"><h2>Who gets the Sabarmati this year?</h2>
  <p>Four sectors draw on Dharoi reservoir: the city’s drinking water, the industrial estates, the canal farmers and the river itself. In a dry year their demands are about twice what the reservoir can give. Today the farmers hold almost all of the water by right, industry and the river hold none, and the city owns the treated wastewater that could replace fresh water on farms.</p>
  <p>Over five monsoons you negotiate at the Dharoi table. A deal that pools water and pays people for moving it creates value for everyone, but only if the group agrees on how to split it, and every failed session costs money.</p>
  <details><summary>How a year works</summary><ol>
    <li>The monsoon fills Dharoi. Each sector’s right is its slice of the usable water, shown in the reservoir on the left.</li>
    <li>The table meets for up to four sessions. In each one, a sector drawn at random proposes a deal: who is in, and how the group’s worth is shared.</li>
    <li>Everyone named in the deal must accept. One rejection ends the session, and every group’s worth shrinks by 6%: crops are sown late and the reservoir keeps evaporating.</li>
    <li>A deal sends water wherever its last cubic metre is worth the most. Shares are paid as money, so a farmer can be paid to release water.</li>
    <li>Anyone still without a deal after four sessions uses only their own right.</li>
    <li>Your score is your share divided by your nucleolus share, the fair benchmark from the project report. 100 is par.</li>
    <li>Before year 4, a council votes on reformed rights: industry’s 1998 partnership restored and a flow right for the river. Three of four votes pass it.</li>
  </ol></details></div>
  <h3>Seats</h3>
  <table class="seats setup"><thead><tr><th scope="col">Sector</th><th scope="col">Played by</th><th scope="col">Bot style</th></tr></thead><tbody>
  ${SECTORS.map(s=>`<tr><th scope="row">${chip(s)}<small>${META[s].who}</small></th>
    <td><select data-ctl="${s}" aria-label="Who plays ${nm(s)}"><option value="human" ${S.ctl[s]==='human'?'selected':''}>A person</option><option value="bot" ${S.ctl[s]==='bot'?'selected':''}>A bot</option></select></td>
    <td><select data-pers="${s}" aria-label="Bot style for ${nm(s)}">${Object.keys(PERS).map(p=>`<option value="${p}" ${S.pers[s]===p?'selected':''}>${PERS[p]}</option>`).join('')}</select></td></tr>`).join('')}
  </tbody></table>
  <p class="note">Several people can share one screen: each person plays a seat and takes the controls when the game names their sector. Cooperative bots offer fair shares and accept slightly less than they expect. Hardliners offer the minimum and want slightly more.</p>
  <fieldset class="opts"><legend>Monsoons</legend>
    <label><input type="radio" name="camp" value="story" ${S.campaign==='story'?'checked':''}> The 2026 story: five set years, including the dry September of 2026 and a stress test</label>
    <label><input type="radio" name="camp" value="random" ${S.campaign==='random'?'checked':''}> Random monsoons (wet 25%, normal 45%, dry 30%). Seed for monsoons and proposer draws: <input type="number" id="seed" value="${S.seed}" aria-label="Random seed"></label>
  </fieldset>
  <fieldset class="opts"><legend>Help</legend>
    <label><input type="checkbox" id="adv" ${S.advisor?'checked':''}> Show the advisor: what each side expects, the nucleolus split, and which groups would walk out</label>
    <label>Proposer each session <select id="order"><option value="random" ${S.randomProposer?'selected':''}>Drawn at random (recommended)</option><option value="fixed" ${S.randomProposer?'':'selected'}>Fixed rotation</option></select></label>
    <label>Bot pace <select id="pace"><option value="650">Readable</option><option value="200">Quick</option><option value="1200">Slow, for a projector</option></select></label>
  </fieldset>
  <div class="row"><button class="primary big" data-act="start">Start year 1</button></div>`;
}
function revealView(){
  const Y = S.Y, cfg = Y.cfg, alone = SECTORS.reduce((a,s)=>a+Y.g[s],0);
  return `<h2>Year ${S.idx+1}: ${cfg.title}</h2><p class="lead">${cfg.note}</p>
   <dl class="big3"><div><dt>Worth if all four cooperate</dt><dd>${rs(Y.g.DIAE)}</dd></div>
   <div><dt>Worth if each goes alone</dt><dd>${rs(alone)}</dd></div>
   <div><dt>Gain from cooperating</dt><dd>${rs(Y.g.DIAE-alone)}</dd></div></dl>
   ${seatsTable()}
   <p>${nm(proposerOf(Y))} ${Y.randomProposer ? 'was drawn to propose first this year.' : 'proposes first this year.'}</p>
   <div class="row"><button class="primary big" data-act="go">Open the table</button></div>`;
}
function tableView(){
  const Y = S.Y, pd = S.pending; let action = '';
  if (pd){
    if (pd.kind==='compose') action = composerView();
    else if (pd.kind==='respond') action = respondView();
    else action = `<p class="thinking" role="status">${pd.prop ? `${nm(pd.p)} is weighing the offer…` : `${nm(pd.p)} is drafting a proposal…`}</p>`;
  }
  return `<h2>Year ${S.idx+1}, session ${Math.min(Y.round,MAXR)} of ${MAXR}</h2>
   <p class="lead">${Y.fails ? `After ${Y.fails} failed session${Y.fails>1?'s':''}, every group is worth ${fm(100*Math.pow(DELTA,Y.fails))}% of what it was.` : 'No time lost yet.'} The full table is worth ${rs(pot(Y,SECTORS))} right now.</p>
   ${seatsTable()}${action}${logView()}`;
}
function waterBars(R){
  return `<div class="bars">${SECTORS.map(s=>{ const r = R.rows[s], d = BASE.d[s];
    const seg = [[r.narmada,'nar','Narmada'],[r.fresh,'fr','Dharoi fresh'],[BASE.q[s]*r.treated,'tr','Treated wastewater']].filter(a=>a[0]>0.05);
    const tot = seg.reduce((a,b)=>a+b[0],0);
    return `<div class="bar"><span class="bl">${nm(s)}</span><span class="track" style="--c:var(--${s})">${seg.map(a=>`<i class="${a[1]}" style="width:${Math.min(100,100*a[0]/d)}%" title="${a[2]}: ${fm(a[0])} MCM"></i>`).join('')}</span>
    <span class="bv">${fm(100*tot/d)}% of ${fm(d)} MCM</span></div>`; }).join('')}
    <p class="key"><i class="nar"></i> Narmada <i class="fr"></i> Dharoi fresh <i class="tr"></i> Treated wastewater, in fresh-water equivalent</p></div>`;
}
function settleView(){
  const R = S.result, Y = S.Y, last = S.idx===4;
  const short = R.checks.filter(c=>c.ex < -0.05).sort((a,b)=>a.ex-b.ex);
  const deals = R.deals.map(d=>d.alone ? `${nm(d.k)} went alone` : `${grp(d.k)} signed a deal`);
  return `<h2>Year ${S.idx+1} settled</h2>
   <p class="lead">The basin made <b>${rs(R.got)}</b> out of a possible ${rs(R.vN)}. ${listJoin(deals)}.</p>
   <dl class="big3"><div><dt>Captured</dt><dd>${fm(100*R.got/R.vN)}%</dd></div>
   <div><dt>Lost to separate deals</dt><dd>${rs(Math.max(R.frag,0))}</dd></div>
   <div><dt>Lost to deadlock</dt><dd>${rs(Math.max(R.delay,0))}</dd></div></dl>
   <h3>Who got what</h3>
   <table class="result"><thead><tr><th scope="col">Sector</th><th scope="col" class="n">Share</th><th scope="col" class="n">Nucleolus</th><th scope="col" class="n">Normalized nucleolus</th><th scope="col" class="n">Score</th><th scope="col" class="n">Money moved</th></tr></thead><tbody>
   ${SECTORS.map(s=>`<tr><th scope="row">${chip(s)}${S.ctl[s]==='human'?'<small>You</small>':''}</th><td class="n">${rs(R.x[s])}</td><td class="n">${rs(R.nuc[s])}</td><td class="n">${rs(R.nn[s])}</td>
     <td class="n"><b class="${R.score[s]<95?'neg':R.score[s]>105?'pos':''}">${Math.round(R.score[s])}</b></td>
     <td class="n">${Math.abs(R.rows[s].pay)<0.05?'None':(R.rows[s].pay>0?'Receives ':'Pays ')+rs(Math.abs(R.rows[s].pay))}</td></tr>`).join('')}</tbody></table>
   <p class="note">Money moved is each sector’s share minus the value of the water it actually used. It is how a farmer gets paid for releasing water, and why the payments in each deal add up to zero.</p>
   <h3>Where the water went</h3>${waterBars(R)}
   <p class="note">The river received ${fm(100*R.eflow)}% of its flow need this year.</p>
   <h3>Would anyone have walked out?</h3>
   ${short.length ? `<p>These groups could have secured more by acting together on their own than they received:</p><ul class="block">${short.slice(0,5).map(c=>`<li><b>${grp(c.k)}</b> could secure ${rs(c.worth)} together and received ${rs(c.got)} (short by ${rs(-c.ex)}).</li>`).join('')}</ul>
     <p class="note">An outcome with no such group is in the core. The nucleolus is the core point that keeps the least satisfied group as satisfied as possible.</p>`
     : `<p>No group could have done better on its own. This outcome is in the core.</p>`}
   <div class="row"><button class="primary big" data-act="go">${last ? 'See the final results' : (S.idx===2 && S.regime==='today' ? 'Go to the council' : 'Start year '+(S.idx+2))}</button></div>`;
}
function councilView(){
  const C = S.council;
  if (!C) return `<h2>The council is meeting</h2><p class="thinking" role="status">Working out what each sector can expect over many years…</p>`;
  const rows = SECTORS.map(s=>`<tr><th scope="row">${chip(s)}</th><td class="n">${rs(C.c.today.nuc[s])}</td><td class="n">${rs(C.c.reform.nuc[s])}</td><td class="n ${C.c.reform.nuc[s]>C.c.today.nuc[s]?'pos':'neg'}">${C.c.reform.nuc[s]>C.c.today.nuc[s]?'+':''}${fm(C.c.reform.nuc[s]-C.c.today.nuc[s])}</td>
    <td>${C.votes[s]===undefined?'Waiting':(C.votes[s]?'Yes':'No')}</td></tr>`).join('');
  let action = '';
  if (C.voter) action = `<div class="panel you"><h3>${nm(C.voter)}, how do you vote?</h3><div class="row"><button class="primary" data-act="vote-yes">Vote yes</button><button data-act="vote-no">Vote no</button></div></div>`;
  else if (C.done) action = `<p class="lead">${C.passed ? '<b>The reform passes.</b> From year 4, industry holds 25 MCM and the river holds 10% of usable storage.' : '<b>The reform fails.</b> Today’s rights stay in place.'}</p><div class="row"><button class="primary big" data-act="go">Start year 4</button></div>`;
  return `<h2>Council: should rights be reformed?</h2>
   <p class="lead">The proposal restores industry’s 25 MCM partnership, cancelled in 1998, and gives the river a right to 10% of usable storage. Farmers keep the rest.</p>
   <p>Reform does not change where a single cubic metre goes in a full deal, because the deal always moves water to its most valuable use. It changes who has to pay whom. The table shows each sector’s long-run fair share, the nucleolus of the game averaged over wet, normal and dry years.</p>
   <table class="result"><thead><tr><th scope="col">Sector</th><th scope="col" class="n">Today’s rights</th><th scope="col" class="n">Reformed</th><th scope="col" class="n">Change</th><th scope="col">Vote</th></tr></thead><tbody>${rows}</tbody></table>
   ${action}`;
}
function finalView(){
  const H = S.history, tot = {}, nuc = {}, sc = {};
  SECTORS.forEach(s=>{ tot[s]=H.reduce((a,h)=>a+h.R.x[s],0); nuc[s]=H.reduce((a,h)=>a+h.R.nuc[s],0); sc[s]=100*tot[s]/nuc[s]; });
  const got = H.reduce((a,h)=>a+h.R.got,0), vN = H.reduce((a,h)=>a+h.R.vN,0), ef = H.reduce((a,h)=>a+h.R.eflow,0)/H.length;
  const ranked = [...SECTORS].sort((a,b)=>sc[b]-sc[a]);
  return `<h2>Five monsoons later</h2>
   <p class="lead">The basin captured ${fm(100*got/vN)}% of what full cooperation could have made, ${rs(got)} of ${rs(vN)}. The river received ${fm(100*ef)}% of its flow need on average.</p>
   <table class="result"><thead><tr><th scope="col">Sector</th>${H.map((h,k)=>`<th scope="col" class="n">Y${k+1} ${TYPE[h.cfg.type]}</th>`).join('')}<th scope="col" class="n">Total</th><th scope="col" class="n">Score</th></tr></thead><tbody>
   ${ranked.map(s=>`<tr><th scope="row">${chip(s)}${S.ctl[s]==='human'?'<small>You</small>':''}</th>${H.map(h=>`<td class="n">${fm(h.R.x[s])}</td>`).join('')}<td class="n">${rs(tot[s])}</td><td class="n"><b>${Math.round(sc[s])}</b></td></tr>`).join('')}
   <tr class="sum"><th scope="row">Basin</th>${H.map(h=>`<td class="n">${fm(100*h.R.got/h.R.vN)}%</td>`).join('')}<td class="n">${rs(got)}</td><td></td></tr></tbody></table>
   <p class="note">Scores compare each total with the sum of that sector’s nucleolus shares. Shares are in Rs crore.</p>
   <h3>Questions for the debrief</h3><ol class="qs">
    <li>Which year lost the most value, and was it lost to deadlock or to separate deals?</li>
    <li>Was any signed deal outside the core? Which group could have walked out, and why did it not?</li>
    <li>The council changed rights but not where water went. Who paid for the river’s flow before and after the vote?</li>
    <li>Proposers tend to score above 100. What does that say about who sets the agenda in a real basin?</li>
    <li>Under today’s rights, industry and the river own no Dharoi water. How did they still end up with water, and what did it cost them?</li>
   </ol>
   <div class="row"><button class="primary big" data-act="again">Play again</button></div>`;
}
// ---------- render ----------
function render(){
  $('years').innerHTML = yearsStrip();
  const cfg = S.Y ? S.Y.cfg : CAMPAIGN[1], regime = S.Y ? S.Y.regime : 'today';
  const gk = cfg.type+cfg.narmadaOK+regime+S.idx+(S.Y?'y':'s');
  $('gauge').innerHTML = gaugeSVG(cfg, regime);
  $('gauge').classList.toggle('animate', gk !== S.gaugeKey); S.gaugeKey = gk;
  const st = $('stage');
  st.innerHTML = S.phase==='setup' ? setupView() : S.phase==='computing' ? '<p class="thinking" role="status">Filling the reservoir and pricing every possible deal…</p>'
    : S.phase==='reveal' ? revealView() : S.phase==='table' ? tableView() : S.phase==='settle' ? settleView() : S.phase==='council' ? councilView() : finalView();
  const lg = $('log'); if (lg) lg.scrollTop = lg.scrollHeight;
  const first = st.querySelector('.panel.you button.primary, .panel.you input');
  if (first && S.focusNext){ first.focus({preventScroll:false}); S.focusNext = false; }
}
// ---------- flow ----------
async function play(){
  S.plan = S.campaign==='story' ? CAMPAIGN : randomCampaign(S.seed);
  S.regime = 'today'; S.history = []; S.council = null; S.Y = null; S.rng = mulberry32(S.campaign==='random' ? S.seed*7919 + 17 : (Date.now() & 0x7fffffff));
  for (S.idx=0; S.idx<5; S.idx++){
    if (S.idx===3 && S.regime==='today') await council();
    await runYear();
  }
  S.idx = 4; S.phase = 'final'; render(); window.scrollTo({top:0});
}
async function council(){
  S.phase = 'council'; S.council = null; render(); await sleep(40);
  const c = councilShares(), votes = {};
  S.council = {c, votes, done:false, voter:null};
  SECTORS.forEach(s=>{ if (S.ctl[s]==='bot') votes[s] = c.reform.nuc[s] > c.today.nuc[s] + 0.5; });
  for (const s of SECTORS) if (S.ctl[s]==='human'){ S.council.voter = s; S.focusNext = true; render(); votes[s] = await wait(); }
  S.council.voter = null; S.council.passed = SECTORS.filter(s=>votes[s]).length >= 3; S.council.done = true;
  if (S.council.passed) S.regime = 'reform';
  render(); await wait();
}
async function runYear(){
  S.phase = 'computing'; S.Y = null; render(); await sleep(40);
  const Y = newYear(S.plan[S.idx], S.regime, S.idx, {randomProposer:S.randomProposer, rng:S.rng}); S.Y = Y; subNuc(Y, SECTORS); subNuc(Y, SECTORS, true);
  S.phase = 'reveal'; render(); window.scrollTo({top:0}); await wait();
  S.phase = 'table'; let lastSession = 0;
  while (Y.U.length > 1 && Y.round <= MAXR){
    if (Y.round !== lastSession){ Y.log.push({t:'session', n:Y.round}); lastSession = Y.round; }
    const p = proposerOf(Y); let prop;
    if (S.ctl[p]==='human'){ S.compose = {p, members:[...Y.U]}; S.compose.offers = defaultOffers(Y, S.compose.members, p); S.pending = {kind:'compose', p}; S.focusNext = true; render(); prop = await wait(); S.compose = null; }
    else { S.pending = {kind:'thinking', p}; render(); await sleep(S.speed); prop = botPropose(Y, p, S.pers[p]); }
    if (prop.S.length===1){ formDeal(Y, prop.S, prop.x, true); Y.log.push({t:'alone', p, v:prop.x[p]}); Y.turn++; continue; }
    Y.log.push({t:'prop', p:prop.p, S:prop.S, x:prop.x});
    let ok = true;
    for (const j of prop.S.filter(j=>j!==prop.p)){
      let acc;
      if (S.ctl[j]==='human'){ S.pending = {kind:'respond', j, prop}; S.focusNext = true; render(); acc = await wait(); }
      else { S.pending = {kind:'thinking', p:j, prop}; render(); await sleep(S.speed*0.6); acc = botAccepts(Y, j, prop.x[j], S.pers[j]); }
      Y.log.push({t: acc?'acc':'rej', j});
      if (!acc){ ok = false; break; }
    }
    if (ok){ formDeal(Y, prop.S, prop.x); Y.log.push({t:'deal', k:key(prop.S)}); }
    else { Y.fails++; Y.log.push({t:'fail', n:Y.round}); }
    Y.round++; Y.turn++;
  }
  S.pending = null; S.result = settle(Y);
  S.history.push({cfg:Y.cfg, regime:Y.regime, R:S.result});
  S.phase = 'settle'; render(); await wait();
}
// ---------- events ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (a==='start'){
    SECTORS.forEach(s=>{ S.ctl[s] = document.querySelector(`[data-ctl="${s}"]`).value; S.pers[s] = document.querySelector(`[data-pers="${s}"]`).value; });
    S.campaign = document.querySelector('input[name="camp"]:checked').value; S.seed = parseInt($('seed').value,10) || 2026;
    S.advisor = $('adv').checked; S.speed = parseInt($('pace').value,10); S.randomProposer = $('order').value==='random'; play(); return;
  }
  if (a==='go') return act(true);
  if (a==='accept') return act(true);
  if (a==='reject') return act(false);
  if (a==='vote-yes') return act(true);
  if (a==='vote-no') return act(false);
  if (a==='again'){ S.phase = 'setup'; S.Y = null; S.council = null; S.history = []; render(); return; }
  if (a==='alone'){ const p = S.compose.p; return act({p, S:[p], x:{[p]:pot(S.Y,[p])}}); }
  if (a==='propose'){ const c = S.compose; return act({p:c.p, S:[...c.members], x:composeShares()}); }
  if (a==='fill-nuc' || a==='fill-nn'){ const c = S.compose, x = suggestSplit(S.Y, c.members, c.p, a==='fill-nn');
    c.members.filter(j=>j!==c.p).forEach(j=>c.offers[j]=x[j]); render(); }
});
document.addEventListener('change', e => {
  const m = e.target.dataset && e.target.dataset.member; if (!m || !S.compose) return;
  const c = S.compose; c.members = e.target.checked ? [...c.members, m] : c.members.filter(s=>s!==m);
  c.members.sort((a,b)=>SECTORS.indexOf(a)-SECTORS.indexOf(b)); c.offers = defaultOffers(S.Y, c.members, c.p); render();
});
document.addEventListener('input', e => {
  const j = e.target.dataset && e.target.dataset.offer; if (!j || !S.compose) return;
  S.compose.offers[j] = parseFloat(e.target.value) || 0; $('compose-summary').innerHTML = composeSummary();
  const cell = e.target.closest('tr').querySelector('td:last-child'); 
  if (S.advisor){ const ev = contValue(S.Y,j), lo = S.compose.offers[j] < ev - 0.05; cell.className = 'n'+(lo?' neg':''); cell.innerHTML = rs(ev)+(lo?'<small>likely to reject</small>':''); }
});
render();
