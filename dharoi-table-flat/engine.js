// ===== Sabarmati game engine (pure JS, no deps) =====
const SECTORS = ['D','I','A','E'];
const BASE = {
  p: {D:6.0, I:5.0, A:1.2, E:2.0},
  q: {D:0.0, I:0.85, A:0.90, E:0.50},
  c: {D:0.0, I:2.0, A:0.20, E:0.10},
  d: {D:62.297+27.937, I:55.0, A:380.0, E:2.4*31.536},
  T: 150, dead: 67.51, evap: 0.12, narmadaCut: 27.937, drink: 62.297,
  years: {
    wet:    {live: 709.18-67.51, narmada:true,  prob:0.25},
    normal: {live: ((709.18-67.51)+(421.44-67.51))/2, narmada:true, prob:0.45},
    dry:    {live: 421.44-67.51, narmada:false, prob:0.30},
  }
};
function B(i, y, P){ const p=P.p[i], d=P.d[i]; const z=Math.min(Math.max(y,0),d); return p*z - p*z*z/(2*d); }
function dB(i, y, P){ const p=P.p[i], d=P.d[i]; return y>=d?0:(y<=0?p:p*(1-y/d)); }
// project onto {x>=0, sum x <= C}
function projCap(x, C){
  const y=x.map(v=>Math.max(v,0)); const s=y.reduce((a,b)=>a+b,0);
  if (s<=C) return y;
  const u=[...x].sort((a,b)=>b-a); let cs=0, th=0;
  for (let k=0;k<u.length;k++){ cs+=u[k]; const t=(cs-C)/(k+1); if (k===u.length-1 || u[k+1]<=t){ th=t; break; } }
  return x.map(v=>Math.max(v-th,0));
}
// scenario -> concrete params
function scenario(P, yearKey, regime, opts={}){
  const Y=P.years[yearKey]; const evap = opts.evap ?? P.evap;
  const usable = Y.live*(1-evap);
  const narmada = (opts.narmadaOK ?? Y.narmada) ? P.narmadaCut : 0;
  const w={D:P.drink, I:0, E:0};
  if (regime==='reform'){ w.I=25; w.E=0.10*usable; }
  w.A = Math.max(usable - w.D - w.I - w.E, 0);
  return {usable, n:{D:narmada, I:0, A:0, E:0}, w, T: opts.T ?? P.T, P};
}
// coalition worth via FISTA on (f,t); returns value and plan
function worth(S, sc){
  const P=sc.P; const F=S.reduce((a,i)=>a+sc.w[i],0);
  const Tc = S.includes('D') ? sc.T : 0;
  const tu = S.filter(i=>P.q[i]>0 && Tc>0);
  const nf=S.length, nt=tu.length;
  const obj=(f,t)=>{ let v=0; S.forEach((i,k)=>{ const ti=tu.indexOf(i); const tt= ti>=0?t[ti]:0; v+=B(i, sc.n[i]+f[k]+P.q[i]*tt, P)-P.c[i]*tt; }); return v; };
  const grad=(f,t)=>{ const gf=new Array(nf).fill(0), gt=new Array(nt).fill(0);
    S.forEach((i,k)=>{ const ti=tu.indexOf(i); const tt=ti>=0?t[ti]:0; const m=dB(i, sc.n[i]+f[k]+P.q[i]*tt, P); gf[k]=m; if(ti>=0) gt[ti]=P.q[i]*m-P.c[i]; });
    return [gf,gt]; };
  let L=0; S.forEach(i=>{ L=Math.max(L, P.p[i]/P.d[i]*(1+P.q[i]**2)); }); const step=1/(L*1.05);
  let f=new Array(nf).fill(F/Math.max(nf,1)), t=new Array(nt).fill(Tc/Math.max(nt,1));
  f=projCap(f,F); t=nt?projCap(t,Tc):t;
  let yf=[...f], yt=[...t], th=1;
  for (let it=0; it<2000; it++){
    const [gf,gt]=grad(yf,yt);
    const nfv=projCap(yf.map((v,k)=>v+step*gf[k]),F);
    const ntv=nt?projCap(yt.map((v,k)=>v+step*gt[k]),Tc):[];
    const th2=(1+Math.sqrt(1+4*th*th))/2, mom=(th-1)/th2;
    yf=nfv.map((v,k)=>v+mom*(v-f[k])); yt=ntv.map((v,k)=>v+mom*(v-t[k]));
    // restart if objective decreased
    if (obj(nfv,ntv)<obj(f,t)) { yf=[...nfv]; yt=[...ntv]; th=1; } else th=th2;
    f=nfv; t=ntv;
  }
  const plan={}; S.forEach((i,k)=>{ const ti=tu.indexOf(i); plan[i]={fresh:f[k], treated: ti>=0?t[ti]:0}; });
  return {v: obj(f,t), plan};
}
function subsets(players){ const out=[]; const n=players.length; for(let m=1;m<(1<<n);m++){ out.push(players.filter((_,k)=>m&(1<<k))); } return out; }
const key=S=>[...S].sort((a,b)=>SECTORS.indexOf(a)-SECTORS.indexOf(b)).join('');
function game(sc, players=SECTORS){ const g={}; subsets(players).forEach(S=>{ g[key(S)]=worth(S,sc).v; }); return g; }
function expectedGame(P, regime, opts={}){
  const g={}; for (const y of Object.keys(P.years)){ const gy=game(scenario(P,y,regime,opts)); for(const k in gy) g[k]=(g[k]||0)+P.years[y].prob*gy[k]; } return g; }

// ---------- small dense two-phase simplex: max c.x, rows {a, type:'<='|'>='|'=', b}, x>=0 ----------
function simplex(c, rows){
  const n=c.length; const m=rows.length;
  // normalise rhs >= 0
  const R=rows.map(r=>{ if(r.b<0){ return {a:r.a.map(v=>-v), b:-r.b, type: r.type==='<='?'>=':(r.type==='>='?'<=':'=')}; } return {a:[...r.a], b:r.b, type:r.type}; });
  let ns=0, na=0; R.forEach(r=>{ if(r.type!=='=') ns++; if(r.type!=='<=') na++; });
  const N=n+ns+na; const T=[]; const basis=[]; let si=n, ai=n+ns; const art=[];
  R.forEach((r,ri)=>{ const row=new Array(N+1).fill(0); r.a.forEach((v,j)=>row[j]=v); row[N]=r.b;
    if(r.type==='<='){ row[si]=1; basis.push(si); si++; }
    else if(r.type==='>='){ row[si]=-1; si++; row[ai]=1; basis.push(ai); art.push(ai); ai++; }
    else { row[ai]=1; basis.push(ai); art.push(ai); ai++; }
    T.push(row); });
  const EPS=1e-9;
  function pivot(r,col){ const pv=T[r][col]; for(let j=0;j<=N;j++) T[r][j]/=pv; for(let i=0;i<m;i++) if(i!==r){ const f=T[i][col]; if(Math.abs(f)>0) for(let j=0;j<=N;j++) T[i][j]-=f*T[r][j]; } basis[r]=col; }
  function run(cost, allowed){
    for(let iter=0; iter<5000; iter++){
      // reduced costs z_j - c_j for max problem
      let enter=-1;
      for(let j=0;j<N;j++){ if(!allowed[j]) continue; let z=0; for(let i=0;i<m;i++) z+=cost[basis[i]]*T[i][j]; const rc=cost[j]-z; if(rc>EPS){ enter=j; break; } } // Bland
      if(enter<0) return 'opt';
      let leave=-1, best=Infinity;
      for(let i=0;i<m;i++){ if(T[i][enter]>EPS){ const ratio=T[i][N]/T[i][enter]; if(ratio<best-1e-12 || (Math.abs(ratio-best)<=1e-12 && basis[i]<basis[leave])){ best=ratio; leave=i; } } }
      if(leave<0) return 'unbounded';
      pivot(leave,enter);
    }
    return 'iter';
  }
  const allowAll=new Array(N).fill(true);
  if(na>0){ const c1=new Array(N).fill(0); art.forEach(j=>c1[j]=-1); run(c1, allowAll);
    let inf=0; for(let i=0;i<m;i++) if(art.includes(basis[i])) inf+=T[i][N]; if(inf>1e-7) return {status:'infeasible'};
    // drive artificials out
    for(let i=0;i<m;i++) if(art.includes(basis[i])){ for(let j=0;j<n+ns;j++) if(Math.abs(T[i][j])>1e-9){ pivot(i,j); break; } } }
  const allowed=new Array(N).fill(true); art.forEach(j=>allowed[j]=false);
  const c2=new Array(N).fill(0); c.forEach((v,j)=>c2[j]=v);
  const st=run(c2, allowed); if(st!=='opt') return {status:st};
  const x=new Array(n).fill(0); for(let i=0;i<m;i++) if(basis[i]<n) x[basis[i]]=T[i][N];
  return {status:'opt', x, value: c.reduce((a,v,j)=>a+v*x[j],0)};
}
// ---------- nucleolus (lexicographic, robust tight-set detection) ----------
// players: array; g: {key: v}; normalized: relative excess e/v(S)
function nucleolus(players, g, normalized=false){
  const n=players.length; const all=key(players); const vN=g[all];
  if(n===1) return {[players[0]]:vN};
  const coal=subsets(players).filter(S=>S.length<n);
  const SHIFT=1e4; // x_i = xs_i - SHIFT so vars >=0; eps = es - SHIFT
  const inc=S=>players.map(p=>S.includes(p)?1:0);
  let active=coal.map(S=>key(S)); const fixed={}; const hard=[]; // for normalized with v<=0
  if(normalized){ active=active.filter(k=>{ if(g[k]<=1e-9){ hard.push(k); return false;} return true; }); }
  const rowsBase=()=>{ const rows=[]; // efficiency
    rows.push({a:[...players.map(()=>1),0], type:'=', b: vN + n*SHIFT});
    hard.forEach(k=>{ const S=k.split(''); rows.push({a:[...inc(S),0], type:'>=', b: S.length*SHIFT}); });
    for(const k in fixed){ const S=k.split(''); const sc= normalized? g[k]:1; // x(S)-v(S) = e*sc
      rows.push({a:[...inc(S),0], type:'=', b: g[k]+fixed[k]*sc + S.length*SHIFT}); }
    return rows; };
  const excessRow=(k, epsCoef)=>{ const S=k.split(''); const sc= normalized? g[k]:1;
    // x(S) - v(S) - eps*sc >= 0 ; with shifts: sum xs - |S|SHIFT - v - (es-SHIFT)sc >=0
    return {a:[...inc(S), -sc], type:'>=', b: g[k] + S.length*SHIFT - SHIFT*sc}; };
  let x=null;
  for(let round=0; round<2*coal.length && active.length; round++){
    const rows=rowsBase(); active.forEach(k=>rows.push(excessRow(k)));
    rows.push({a:[...players.map(()=>0),1], type:'<=', b:2*SHIFT});
    const r=simplex([...players.map(()=>0),1], rows); if(r.status!=='opt') throw new Error('nucleolus LP '+r.status);
    const eps=r.x[n]-SHIFT; x=r.x.slice(0,n).map(v=>v-SHIFT);
    // which active coalitions are tight in every optimum
    const newly=[];
    for(const k of active){ const S=k.split(''); const sc=normalized? g[k]:1;
      const rows2=rowsBase(); active.forEach(k2=>{ const S2=k2.split(''); const sc2=normalized?g[k2]:1; rows2.push({a:[...inc(S2),0], type:'>=', b:g[k2]+eps*sc2+S2.length*SHIFT}); });
      const r2=simplex([...inc(S),0], rows2); if(r2.status!=='opt') throw new Error('tight LP '+r2.status);
      const maxEx=(r2.value - S.length*SHIFT - g[k])/sc; if(maxEx<=eps+1e-7) newly.push(k); }
    newly.forEach(k=>{ fixed[k]=eps; }); active=active.filter(k=>!newly.includes(k));
    // stop when fixed coalitions pin x (rank n-1 plus efficiency)
    if(rankOf(Object.keys(fixed).map(k=>inc(k.split(''))).concat([players.map(()=>1)]))>=n) break;
  }
  const out={}; players.forEach((p,k)=>out[p]=x[k]); return out;
}
function rankOf(M){ const A=M.map(r=>[...r]); let rk=0; const cols=A[0]?A[0].length:0;
  for(let c=0;c<cols && rk<A.length;c++){ let piv=-1; for(let r=rk;r<A.length;r++) if(Math.abs(A[r][c])>1e-9){piv=r;break;} if(piv<0) continue; [A[rk],A[piv]]=[A[piv],A[rk]];
    for(let r=0;r<A.length;r++) if(r!==rk){ const f=A[r][c]/A[rk][c]; for(let j=c;j<cols;j++) A[r][j]-=f*A[rk][j]; } rk++; } return rk; }
function shapley(players, g){ const n=players.length; const fact=k=>k<=1?1:k*fact(k-1); const out={};
  players.forEach(i=>{ let s=0; subsets(players).forEach(S=>{ if(!S.includes(i)) return; const R=S.filter(j=>j!==i); const vR=R.length?g[key(R)]:0; s+=fact(S.length-1)*fact(n-S.length)/fact(n)*(g[key(S)]-vR); }); out[i]=s; }); return out; }
function blocking(players, g, x){ return subsets(players).filter(S=>S.length<players.length).map(S=>({k:key(S), ex: S.reduce((a,i)=>a+(x[i]||0),0)-g[key(S)]})).filter(o=>o.ex< -1e-6).sort((a,b)=>a.ex-b.ex); }
if (typeof module!=='undefined') module.exports={SECTORS,BASE,B,worth,scenario,game,expectedGame,simplex,nucleolus,shapley,blocking,subsets,key};
