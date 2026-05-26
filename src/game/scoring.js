/* WDZ Online – game/scoring.js */
import { FM, FO, BNB_PRODUCTS, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB } from "./constants.js";

export function buildView(items, targetBiz) {
  var resources=items.filter(i=>i.cat===C_RES), comps=items.filter(i=>i.cat===C_COMP);
  var nRes=items.filter(i=>i.cat===C_NRES), nComp=items.filter(i=>i.cat===C_NCOMP);
  var plots=items.filter(i=>i.cat===C_PLOT), maps=items.filter(i=>i.cat===C_MAP);
  var mergedRes=resources.map(r=>{
    var m=(r.forBiz===targetBiz)?nRes.find(n=>n.name===r.name&&n.forBiz===r.forBiz):null;
    return {item:r, note:m||null};
  });
  var orphanNR=nRes;
  var mergedComp=comps.map(k=>{
    var m=(k.forBiz===targetBiz)?nComp.find(n=>n.name===k.name&&n.forBiz===k.forBiz):null;
    return {item:k, note:m||null};
  });
  var orphanNK=nComp;
  return {mergedRes, orphanNR, mergedComp, orphanNK, plots, maps};
}

export function calcScore(fId, fd, plotPenalties, biznesNaBoku, bnbEnabled, blindFate, mapEnabled, mapBonusClaimed) {
  var f=FM[fId], d=fd[fId], items=d.items;
  var bnbCards=items.filter(i=>i.cat===C_BNB);
  var bnbKurier=bnbCards.filter(i=>i.effect==="res4").length;
  var bnbMikstura=bnbCards.filter(i=>i.effect==="comp4").length;
  var bnbObligacje=bnbCards.filter(i=>i.effect==="cash20").length;
  var bnbKwatera=bnbCards.filter(i=>i.effect==="point1").length;
  var resItems=items.filter(i=>i.cat===C_RES&&!i.blind&&i.forBiz===f.biz);
  var resPct=resItems.reduce((s,i)=>s+i.weight,0);
  var bnbKurierBonus=0;
  if(bnbEnabled){
    if(resPct>=100){bnbKurierBonus=bnbKurier;}
    else{resPct=Math.min(100, resPct + bnbKurier*4);}
  }
  if(blindFate&&blindFate[fId]&&blindFate[fId].rolls){
    blindFate[fId].rolls.forEach(function(roll){
      if(roll.resolved&&roll.event&&roll.event.type==="loss_resources"){
        var penalty=roll.policyUsed===100?0:roll.policyUsed===50?5:10;
        resPct=Math.max(0,resPct-penalty);
      }
    });
  }
  var resScore=(resPct/100)*30;
  var compItems=items.filter(i=>i.cat===C_COMP&&!i.blind&&i.forBiz===f.biz);
  var compPct=compItems.reduce((s,i)=>s+i.weight,0);
  var bnbMiksturaBonus=0;
  if(bnbEnabled){
    if(compPct>=100){bnbMiksturaBonus=bnbMikstura;}
    else{compPct=Math.min(100, compPct + bnbMikstura*4);}
  }
  var compScore=(compPct/100)*25;
  var plotItem=items.find(i=>i.cat===C_PLOT);
  var plotOk=plotItem&&plotItem.plotNr===f.tPlot;
  var plotScore=plotOk?10:0;
  var cashBase=d.cash;
  var cashForScore=bnbEnabled?cashBase*(1+bnbObligacje*0.2):cashBase;
  var cashScore=Math.max(-25,Math.min(25,((cashForScore-600)/600)*25));
  var uniqueFrags=[...new Set(items.filter(i=>i.cat===C_MAP).map(m=>m.fragNr))];
  var mapScore=mapEnabled?Math.min(10, uniqueFrags.length*2 + ((mapBonusClaimed&&mapBonusClaimed[fId]&&uniqueFrags.length===4)?2:0)):0;
  var bnb=bnbEnabled?(bnbKwatera+bnbKurierBonus+bnbMiksturaBonus):((biznesNaBoku&&biznesNaBoku[fId])||0);
  var bizTotal=resScore+compScore+plotScore+cashScore+mapScore+bnb;
  return {resPct,resScore:Math.round(resScore),compPct,compScore:Math.round(compScore),plotOk,plotScore,cash:d.cash,cashForScore:Math.round(cashForScore),cashScore:Math.round(cashScore),mapScore,bnb,bnbKurier,bnbMikstura,bnbObligacje,bnbKwatera,bizTotal:Math.round(resScore+compScore+plotScore+cashScore+mapScore+bnb)};
}

export function fmtItems(items){
  if(!items||!items.length)return"";
  var regular=items.filter(i=>i.cat!==C_BNB).map(i=>(i.cat===C_NRES||i.cat===C_NCOMP)?i.name+" [inf.]":i.name);
  var bnb={};items.filter(i=>i.cat===C_BNB).forEach(i=>{bnb[i.bnbOrigin]=(bnb[i.bnbOrigin]||0)+1;});
  var bnbLabels=Object.keys(bnb).map(o=>BNB_PRODUCTS[o].shortName+" ×"+bnb[o]);
  return regular.concat(bnbLabels).join(", ");
}

export function calcRelationScore(fId, relations) {
  if(!relations) return 0;
  var totalStars=0;
  FO.forEach(rater=>{
    if(rater===fId) return;
    var r=relations[rater];
    if(!r||!r[fId]) return;
    var ratings=r[fId];
    totalStars+=(ratings.partnership||0)+(ratings.rules||0)+(ratings.communication||0);
  });
  return Math.round((totalStars/45)*20*10)/10;
}
