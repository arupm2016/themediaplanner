export type Objective = 'Awareness'|'Traffic'|'Video views'|'Leads'|'Sales'|'App installs'|'Store visits';
export type Channel = {
  id:string; name:string; platform:string; objective:Objective; budget:number;
  cpm:number; ctr:number; cpc:number; cvr:number; frequency:number;
  videoShare:number; viewRate:number; leadRate:number; aov:number;
  margin:number; attributionShare:number; newCustomerShare:number; enabled:boolean;
};
export type Guardrails = {
  budgetTolerance:number; maxFrequency:number; minConversionBudget:number;
  maxChannelShare:number; preventOverAllocation:boolean; warnMissingTracking:boolean;
};
export const defaults:Channel[] = [
 {id:'meta',name:'Meta Ads',platform:'Meta',objective:'Awareness',budget:180000,cpm:210,ctr:1.9,cpc:11.05,cvr:2.2,frequency:3.2,videoShare:65,viewRate:28,leadRate:0,aov:1800,margin:42,attributionShare:75,newCustomerShare:65,enabled:true},
 {id:'google-search',name:'Google Search',platform:'Google Ads',objective:'Sales',budget:150000,cpm:0,ctr:6.8,cpc:22,cvr:4.2,frequency:1.2,videoShare:0,viewRate:0,leadRate:0,aov:2400,margin:45,attributionShare:90,newCustomerShare:70,enabled:true},
 {id:'youtube',name:'YouTube',platform:'Google Ads',objective:'Video views',budget:90000,cpm:95,ctr:0.35,cpc:0,cvr:0.7,frequency:2.6,videoShare:100,viewRate:30,leadRate:0,aov:1800,margin:42,attributionShare:45,newCustomerShare:45,enabled:true},
 {id:'amazon',name:'Amazon Ads',platform:'Amazon Ads',objective:'Sales',budget:80000,cpm:0,ctr:0.55,cpc:14,cvr:8.5,frequency:1,videoShare:0,viewRate:0,leadRate:0,aov:1600,margin:28,attributionShare:95,newCustomerShare:70,enabled:true},
 {id:'linkedin',name:'LinkedIn Ads',platform:'LinkedIn',objective:'Leads',budget:0,cpm:850,ctr:0.62,cpc:140,cvr:5.5,frequency:2.1,videoShare:20,viewRate:18,leadRate:65,aov:0,margin:0,attributionShare:70,newCustomerShare:60,enabled:false},
 {id:'programmatic',name:'Programmatic Display',platform:'DV360 / DSP',objective:'Awareness',budget:0,cpm:120,ctr:0.18,cpc:67,cvr:0.8,frequency:4,videoShare:10,viewRate:20,leadRate:0,aov:1800,margin:42,attributionShare:35,newCustomerShare:40,enabled:false}
];
export const guardrailDefaults:Guardrails={budgetTolerance:2,maxFrequency:5,minConversionBudget:10,maxChannelShare:65,preventOverAllocation:true,warnMissingTracking:true};
export const calc=(c:Channel)=>{
 const spend=Math.max(0,c.budget||0);
 // CPM-led channels (social, video, display): impressions first, then response from CTR.
 // CPC-led channels (search/commerce): clicks first, then derive impressions from CTR.
 const impressions=c.cpm>0?spend/c.cpm*1000:(c.cpc>0&&c.ctr>0?(spend/c.cpc)/(c.ctr/100):0);
 const clicks=c.cpm>0?impressions*c.ctr/100:(c.cpc>0?spend/c.cpc:impressions*c.ctr/100);
 const ctr=impressions?clicks/impressions*100:0;
 const videoStarts=impressions*c.videoShare/100;
 const videoViews=videoStarts*c.viewRate/100;
 const viewRate=videoStarts?videoViews/videoStarts*100:0;
 const leads=clicks*c.cvr/100*(c.objective==='Leads'?(c.leadRate/100||1):1);
 const conversions=c.objective==='Leads'?leads:clicks*c.cvr/100;
 const attributedConversions=conversions*c.attributionShare/100;
 const newCustomers=conversions*c.newCustomerShare/100;
 const revenue=attributedConversions*c.aov;
 const grossProfit=revenue*c.margin/100;
 const reach=impressions/Math.max(c.frequency,1);
 const cpmActual=impressions?spend/impressions*1000:0;
 const cpcActual=clicks?spend/clicks:0;
 const cpa=conversions?spend/conversions:0;
 const cac=newCustomers?spend/newCustomers:0;
 const cpv=videoViews?spend/videoViews:0;
 const roas=spend?revenue/spend:0;
 const breakEvenRoas=c.margin>0?100/c.margin:0;
 const roi=spend?(grossProfit-spend)/spend*100:0;
 return {spend,impressions,reach,frequency:c.frequency,clicks,ctr,cpc:cpcActual,cpm:cpmActual,videoStarts,videoViews,viewRate,cpv,leads,conversions,attributedConversions,newCustomers,cac,cpa,revenue,roas,grossProfit,breakEvenRoas,roi};
};
export const fmt=(n:number,d=0)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number.isFinite(n)?n:0);
export const inr=(n:number)=>'₹'+fmt(n);
export const pct=(n:number,d=1)=>fmt(n,d)+'%';
export const validate=(channels:Channel[],totalBudget:number,g:Guardrails)=>{
 const active=channels.filter(c=>c.enabled&&c.budget>0);
 const spend=active.reduce((s,c)=>s+c.budget,0);
 const warnings:string[]=[];
 if(g.preventOverAllocation&&spend>totalBudget*(1+g.budgetTolerance/100))warnings.push('Channel allocations exceed the approved campaign budget tolerance.');
 if(spend<totalBudget*(1-g.budgetTolerance/100))warnings.push('A portion of the approved budget remains unallocated.');
 active.forEach(c=>{
  if(c.frequency>g.maxFrequency)warnings.push(c.name+': planned frequency exceeds the configured cap.');
  if(c.budget/Math.max(spend,1)*100>g.maxChannelShare)warnings.push(c.name+': channel concentration exceeds the configured share limit.');
  if(c.objective==='Sales'&&c.budget<totalBudget*g.minConversionBudget/100)warnings.push(c.name+': conversion budget is below the configured minimum share.');
  if(c.cpm<=0&&c.cpc<=0)warnings.push(c.name+': add either CPM or CPC to calculate delivery.');
 });
 return {spend,remaining:totalBudget-spend,warnings,activeCount:active.length};
};
