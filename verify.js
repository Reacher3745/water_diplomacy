// node tests/verify.js : checks the engine against the project report and known nucleolus results
const E = require('./engine.js');
let fails = 0;
const close = (a, b, tol, msg) => { const ok = Math.abs(a - b) <= tol; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + msg + `: got ${a.toFixed(2)}, expected ${b}`); };
// 1. three-player hand example
const hg = {'1':0,'2':0,'3':0,'12':60,'13':40,'23':20,'123':90};
const n = E.nucleolus(['1','2','3'], hg), nn = E.nucleolus(['1','2','3'], hg, true);
[[n['1'],47.5],[n['2'],27.5],[n['3'],15]].forEach(([a,b],i)=>close(a,b,1e-6,'hand nucleolus x'+(i+1)));
[[nn['1'],60],[nn['2'],30],[nn['3'],0]].forEach(([a,b],i)=>close(a,b,1e-6,'hand normalized x'+(i+1)));
// 2. Talmud bankruptcy games (nucleolus = Talmud rule)
const want = {100:[33.33,33.33,33.33], 200:[50,75,75], 300:[50,100,150]};
for (const est of [100,200,300]) { const c={'1':100,'2':200,'3':300}, g={};
  E.subsets(['1','2','3']).forEach(S=>{ const out=['1','2','3'].filter(p=>!S.includes(p)).reduce((a,p)=>a+c[p],0); g[S.join('')]=Math.max(0,est-out); });
  const x=E.nucleolus(['1','2','3'],g); ['1','2','3'].forEach((p,i)=>close(x[p],want[est][i],0.01,`Talmud estate ${est} claimant ${p}`)); }
// 3. coalition worths, dry year, today's rights (report Table 5)
const t5 = {D:244.8,I:0,A:201.0,E:0,DI:285.1,DA:471.6,DE:306.1,IA:312.8,IE:0,AE:243.5,DIA:597.1,DIE:346.1,DAE:531.0,IAE:347.6,DIAE:650.5};
const g = E.game(E.scenario(E.BASE,'dry','today'));
for (const k in t5) close(g[k], t5[k], 0.06, 'v('+k+') dry, today');
// 4. nucleolus, dry year, today's rights (report Table 7)
const nu = E.nucleolus(E.SECTORS, g);
[['D',285.7],['I',71.9],['A',256.8],['E',36.2]].forEach(([s,b])=>close(nu[s],b,0.11,'nucleolus '+s+' dry, today'));
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed'); process.exit(fails ? 1 : 0);
