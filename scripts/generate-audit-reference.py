"""Regenerate independent numeric fixtures; optional tooling, not an app dependency.
Requires Python 3, numpy and scipy. Normal npm tests read the committed JSON
and need none of these Python packages. See docs/FORMULA_AUDIT.md.
"""
import json, math, random, statistics, scipy, scipy.stats as st, numpy as np
from decimal import Decimal, ROUND_HALF_UP, ROUND_UP, ROUND_DOWN
rng=random.Random(20261018)
cases=[]
def add(name,args,expected,rtol=1e-8,atol=1e-12):
 if isinstance(expected,np.ndarray):expected=expected.tolist()
 cases.append(dict(name=name,args=args,expected=expected,rtol=rtol,atol=atol))
for z in [-35,-20,-10,-8,-3,-1,0,1,3,8,10]:
 for sd,mean in [(1,0),(3,20)]:
  for cumulative in [True,False]:
   x=mean+z*sd
   add('NORM.DIST',dict(x=x,mean=mean,sd=sd,cumulative=cumulative),float(st.norm.cdf(z) if cumulative else st.norm.pdf(z)/sd),atol=0)
  add('WF.PROBABILITY',dict(x=mean+z*sd,mean=mean,standardDeviation=sd,mode='cumulative probability'),float(st.norm.cdf(z)),atol=0)
for p in [1e-100,1e-30,1e-10,.001,.01,.25,.5,.75,.99,1-1e-10]:
 add('NORM.INV',dict(probability=p,mean=12,sd=3),float(st.norm.ppf(p,loc=12,scale=3)),rtol=1e-10)
for n in [5,20,100,1000,10000]:
 for p in [.01,.3,.5,.99]:
  for k in [0,int(n*p),min(n,int(n*p+math.sqrt(n*p*(1-p))))]:
   for cumulative in [False,True]:
    exp=float(st.binom.cdf(k,n,p) if cumulative else st.binom.pmf(k,n,p))
    add('BINOM.DIST',dict(successes=k,trials=n,probability=p,cumulative=cumulative),exp,rtol=2e-7,atol=0)
for mu in [.01,1,10,100,1000,10000]:
 for k in [0,int(mu),int(mu+2*math.sqrt(mu))]:
  for cumulative in [False,True]:
   add('POISSON.DIST',dict(x=k,mean=mu,cumulative=cumulative),float(st.poisson.cdf(k,mu) if cumulative else st.poisson.pmf(k,mu)),rtol=2e-7,atol=0)
for i in range(12):
 a=[rng.uniform(-30,90) for _ in range(4+i)]
 b=[rng.uniform(-20,80) for _ in range(4+i)]
 for name,expected in [('MEDIAN',statistics.median(a)),('STDEV.S',statistics.stdev(a)),('STDEV.P',statistics.pstdev(a)),('VAR.S',statistics.variance(a)),('VAR.P',statistics.pvariance(a)),('SKEW',float(st.skew(a,bias=False))),('KURT',float(st.kurtosis(a,bias=False)))]:add(name,dict(data=a),expected)
 for name,expected in [('CORREL',float(st.pearsonr(a,b).statistic)),('COVARIANCE.S',float(np.cov(a,b,ddof=1)[0,1])),('COVARIANCE.P',float(np.cov(a,b,ddof=0)[0,1]))]:add(name,dict(x=a,y=b),expected)
 for type in [1,2,3]:
  v=st.ttest_rel(a,b) if type==1 else st.ttest_ind(a,b,equal_var=type==2)
  for tails in [1,2]:add('T.TEST',dict(array1=a,array2=b,type=type,tails=tails),float(v.pvalue*(tails/2)),rtol=2e-7)
 for alpha in [.1,.05,.01]:add('CONFIDENCE.T',dict(alpha=alpha,sd=3,size=len(a)),float(st.t.ppf(1-alpha/2,len(a)-1)*3/math.sqrt(len(a))),rtol=2e-7)
 for k in [.1,.5,.9]:add('PERCENTILE.INC',dict(data=a,k=k),float(np.quantile(a,k)))
for i in range(8):
 m=np.array([[rng.randint(-10,10) for j in range(3)] for r in range(3)])
 add('MDETERM',dict(matrix=m.tolist()),float(np.linalg.det(m)))
 if np.linalg.det(m)!=0:add('MINVERSE',dict(matrix=m.tolist()),np.linalg.inv(m))
 add('MMULT',dict(matrix1=m.tolist(),matrix2=m.tolist()),m@m)
for text in ['1.005','-1.005','2.675','-2.675','0.07','-0.07','12345.6789','-12345.6789']:
 for digits in [-2,0,2,3]:
  for name,rounding in [('ROUND',ROUND_HALF_UP),('ROUNDUP',ROUND_UP),('ROUNDDOWN',ROUND_DOWN)]:
   expected=float(Decimal(text).quantize(Decimal(1).scaleb(-digits),rounding=rounding))
   add(name,dict(value=float(text),digits=digits),expected,rtol=1e-12)
# Annuity present values independently computed as sums of discounted payments.
for r in [-.05,0,.001,.05]:
 for n in [1,12,60]:
  for timing in [0,1]:
   pv=12500.;fv=2000.
   times=range(timing==0,n+(timing==0))
   annuity=sum((1+r)**(-t) for t in times)
   pmt=-(pv+fv/(1+r)**n)/annuity
   args=dict(rate=r,nper=n,pv=pv,fv=fv,type=timing)
   add('PMT',args,pmt)
   add('PV',dict(rate=r,nper=n,pmt=pmt,fv=fv,type=timing),pv)
   add('FV',dict(rate=r,nper=n,pmt=pmt,pv=pv,type=timing),fv)
   add('NPER',dict(rate=r,pmt=pmt,pv=pv,fv=fv,type=timing),n)
   add('RATE',dict(nper=n,pmt=pmt,pv=pv,fv=fv,type=timing,guess=r+.001),r,rtol=1e-7,atol=1e-9)
   # Interest is the negative outstanding balance before each end-of-period payment.
   balance=pv
   for per in range(1,n+1):
    interest=0 if timing and per==1 else -balance*r
    add('IPMT',dict(**args,per=per),interest,rtol=1e-7,atol=1e-8)
    add('PPMT',dict(**args,per=per),pmt-interest,rtol=1e-7,atol=1e-8)
    # Outstanding balance after this payment, with the advance-payment
    # schedule shifted one period relative to end-of-period payments.
    if timing: balance=pv*(1+r)**(per-1)+pmt*sum((1+r)**j for j in range(per))
    else: balance=balance*(1+r)+pmt
# Sign and timing IRR cases whose root follows from direct cash-flow evaluation.
from scipy.optimize import brentq
for values in [[-100,60,60],[-1000,0,500,700],[-100,0,0,200],[-1000,100,200,800]]:
 root=brentq(lambda r:sum(v/(1+r)**i for i,v in enumerate(values)),-.9,5,xtol=1e-14)
 add('IRR',dict(values=values),root)
 for rate in [0,.05,.2]: add('NPV',dict(values=values,rate=rate),sum(v/(1+rate)**(i+1) for i,v in enumerate(values)))
# Keep fixtures self-contained: Node test runs need no Python or SciPy installation.
output={'provenance':f'Independent references: Python statistics/decimal/math, NumPy {np.__version__}, SciPy {scipy.__version__} scipy.stats/scipy.optimize. Seed 20261018. No SheetPilot or Formula.js calculation code is used.', 'cases':cases}
with open('tests/fixtures/audit-reference.json','w') as f:json.dump(output,f,indent=2,allow_nan=False);f.write('\n')
print('Generated',len(cases),'independent reference cases for',len(set(c['name'] for c in cases)),'functions.')
