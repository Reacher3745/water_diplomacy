// ===== Game rules (no DOM) =====
const DELTA = 0.94, MAXR = 4;
const ALPHA = {cooperative:0.96, balanced:1.0, hardliner:1.03};
const META = {
  D:{name:'Drinking water', who:'Ahmedabad and Mehsana villages'},
  I:{name:'Industry', who:'Naroda, Odhav, Vatva and Narol estates'},
  A:{name:'Farmers', who:'Dharoi canal command'},
  E:{name:'River', who:'Sabarmati flow, through a river fund'}
};
const CAMPAIGN = [
  {type:'normal', narmadaOK:true,  title:'A middling monsoon', note:'Dharoi is a little over half full. A good year to learn how the table works.'},
  {type:'dry',    narmadaOK:true,  title:'Like September 2026', note:'Dharoi is near half full with no inflow coming. The Narmada canal is running, so the city’s fallback is covered.'},
  {type:'wet',    narmadaOK:true,  title:'A full reservoir', note:'Dharoi is close to 87% full, as it was in October 2024. Water is cheap this year.'},
  {type:'dry',    narmadaOK:false, title:'The stress test', note:'Dharoi is low and a basin-wide drought cuts the city’s Narmada supply by 10% for half the year. The city needs Dharoi again.'},
  {type:'normal', narmadaOK:true,  title:'Back to normal', note:'A middling monsoon again. Last chance to lift your score.'}
];
const gameCache = {};
function getGame(type, regime, narmadaOK){
  const k = type+'|'+regime+'|'+narmadaOK;
  if (!gameCache[k]){
    const sc = scenario(BASE, type, regime, {narmadaOK});
    const g = {}, plans = {};
    subsets(SECTORS).forEach(S=>{ const r = worth(S, sc); g[key(S)] = r.v; plans[key(S)] = r.plan; });
    gameCache[k] = {sc, g, plans};
  }
  return gameCache[k];
}
function newYear(cfg, regime, idx, opts={}){
  const G = getGame(cfg.type, regime, cfg.narmadaOK);
  const order = SECTORS.slice(idx % 4).concat(SECTORS.slice(0, idx % 4));
  return {cfg, regime, idx, sc:G.sc, g:G.g, plans:G.plans, U:[...SECTORS], deals:[], fails:0, round:1, turn:0, order, nc:{}, log:[],
          randomProposer: !!opts.randomProposer, rng: opts.rng || Math.random, pTurn:-1, curP:null};
}
function subNuc(Y, players, norm=false){
  const k = key(players)+(norm?'*':'');
  if (!Y.nc[k]) Y.nc[k] = nucleolus(players.slice().sort((a,b)=>SECTORS.indexOf(a)-SECTORS.indexOf(b)), Y.g, norm);
  return Y.nc[k];
}
const pot = (Y,S) => Math.pow(DELTA, Y.fails) * Y.g[key(S)];
function contValue(Y, i){
  const df = Math.pow(DELTA, Y.fails+1);
  if (Y.round >= MAXR || Y.U.length===1) return df * Y.g[i];
  return df * subNuc(Y, Y.U)[i];
}
// Proposer for the current turn. Random order (default, Okada 1996) avoids the fixed-rotation
// exclusion of the next proposer shown in report II; the draw is cached per turn.
function proposerOf(Y){
  if (Y.pTurn !== Y.turn || !Y.U.includes(Y.curP)){
    const live = Y.order.filter(s=>Y.U.includes(s));
    Y.curP = Y.randomProposer ? live[Math.floor(Y.rng()*live.length)] : live[Y.turn % live.length];
    Y.pTurn = Y.turn;
  }
  return Y.curP;
}
const up = v => Math.ceil(v*10 - 1e-9)/10;
function suggestSplit(Y, S, p, norm=false){
  const scale = Math.pow(DELTA, Y.fails), n = subNuc(Y, S, norm), x = {};
  S.forEach(j=>{ if (j!==p) x[j] = Math.round(n[j]*scale*10)/10; });
  x[p] = pot(Y,S) - S.filter(j=>j!==p).reduce((a,j)=>a+x[j],0);
  return x;
}
function botPropose(Y, p, pers){
  let best = null;
  subsets(Y.U).filter(S=>S.includes(p)).forEach(S=>{
    const ps = pot(Y,S); const x = {}; let give = 0;
    if (S.length>1){
      const nS = subNuc(Y,S), sc = Math.pow(DELTA, Y.fails);
      S.filter(j=>j!==p).forEach(j=>{
        const est = contValue(Y,j), nj = nS[j]*sc;
        const base = pers==='cooperative' ? Math.max(nj, est) : pers==='balanced' ? Math.max((nj+est)/2, est) : est;
        x[j] = up(base); give += x[j];
      });
    }
    x[p] = ps - give;
    const cand = {S, x, keep:x[p]};
    if (!best || cand.keep > best.keep + 0.5 || (Math.abs(cand.keep-best.keep)<=0.5 && S.length>best.S.length)) best = cand;
  });
  return {p, S:best.S, x:best.x};
}
function botAccepts(Y, j, xj, pers){ return xj >= ALPHA[pers]*contValue(Y,j) - 1e-6; }
function formDeal(Y, S, x, alone=false){
  Y.deals.push({S:[...S], x:{...x}, df:Math.pow(DELTA, Y.fails), alone});
  Y.U = Y.U.filter(s=>!S.includes(s));
}
function settle(Y){
  Y.U.slice().forEach(i=>formDeal(Y, [i], {[i]: Math.pow(DELTA, Y.fails)*Y.g[i]}, true));
  const P = BASE, x = {}, rows = {};
  Y.deals.forEach(d=>{
    const plan = Y.plans[key(d.S)];
    d.S.forEach(i=>{
      const f = plan[i].fresh, t = plan[i].treated, n = Y.sc.n[i];
      const use = B(i, n+f+P.q[i]*t, P) - P.c[i]*t;
      x[i] = d.x[i];
      rows[i] = {deal:key(d.S), alone:d.alone, fresh:f, treated:t, narmada:n, eff:n+f+P.q[i]*t, pay: d.x[i] - d.df*use};
    });
  });
  const vN = Y.g['DIAE'], got = SECTORS.reduce((a,i)=>a+x[i],0);
  const formedWorth = Y.deals.reduce((a,d)=>a+Y.g[key(d.S)],0);
  const nuc = subNuc(Y, SECTORS), nn = subNuc(Y, SECTORS, true); // fairness benchmarks: nucleolus only (Shapley is not core-stable here)
  const dfc = Math.pow(DELTA, Y.fails);
  const checks = subsets(SECTORS).map(S=>({k:key(S), worth:dfc*Y.g[key(S)], got:S.reduce((a,i)=>a+x[i],0)})).map(o=>({...o, ex:o.got-o.worth}));
  const score = {}; SECTORS.forEach(i=>score[i] = 100*x[i]/Math.max(nuc[i],1e-6));
  return {x, rows, vN, got, frag: vN-formedWorth, delay: formedWorth-got, nuc, nn, checks, score,
          eflow: rows.E.eff/P.d.E, fails:Y.fails, deals:Y.deals.map(d=>({k:key(d.S), alone:d.alone}))};
}
const expCache = {};
function councilShares(){
  ['today','reform'].forEach(r=>{ if(!expCache[r]){ const g = expectedGame(BASE, r); expCache[r] = {g, nuc:nucleolus(SECTORS, g)}; } });
  return expCache;
}
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function randomCampaign(seed){
  const r = mulberry32(seed), out = [];
  for (let k=0;k<5;k++){ const u=r(); const type = u<0.25?'wet':(u<0.70?'normal':'dry'); const cut = type==='dry' && r()<0.5;
    out.push({type, narmadaOK:!cut, title: type==='wet'?'A wet year':type==='normal'?'A normal year':(cut?'A dry year, Narmada cut':'A dry year'),
      note: type==='wet'?'Dharoi fills well. Water is cheap.':type==='normal'?'A middling monsoon.':(cut?'Dharoi is low and the city’s Narmada supply is cut for half the year.':'Dharoi is low, but the Narmada canal covers the city.')}); }
  return out;
}
if (typeof module!=='undefined') module.exports={DELTA,MAXR,ALPHA,META,CAMPAIGN,getGame,newYear,subNuc,pot,contValue,proposerOf,suggestSplit,botPropose,botAccepts,formDeal,settle,councilShares,randomCampaign};
