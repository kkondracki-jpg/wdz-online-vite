/* WDZ Online – scoring/index.js
 * Scoring logic used by game, admin, and monitor.
 */
import { FM, FO, C_RES, C_COMP, C_PLOT, C_MAP, C_BNB } from "../constants/index.js";
import { ensureArray } from "../utils/index.js";

export function calcScore(fId, fd, bf, bnbEnabled, mapEnabled, mapBonusClaimed) {
  var f = FM[fId], d = fd[fId], items = d.items;
  var bnbCards = items.filter(function(i){ return i.cat === C_BNB; });
  var bnbKurier   = bnbCards.filter(function(i){ return i.effect === "res4"; }).length;
  var bnbMikstura = bnbCards.filter(function(i){ return i.effect === "comp4"; }).length;
  var bnbObligacje= bnbCards.filter(function(i){ return i.effect === "cash20"; }).length;
  var bnbKwatera  = bnbCards.filter(function(i){ return i.effect === "point1"; }).length;

  // Resources
  var resItems = items.filter(function(i){ return i.cat === C_RES && !i.blind && i.forBiz === f.biz; });
  var resPct = resItems.reduce(function(s,i){ return s + i.weight; }, 0);
  var bnbKurierBonus = 0;
  if(bnbEnabled) {
    if(resPct >= 100) { bnbKurierBonus = bnbKurier; }
    else { resPct = Math.min(100, resPct + bnbKurier * 4); }
  }
  // BlindFate loss_resources penalty
  if(bf && bf[fId] && bf[fId].rolls) {
    ensureArray(bf[fId].rolls).forEach(function(roll) {
      if(roll && roll.resolved && roll.event && roll.event.type === "loss_resources") {
        var penalty = roll.policyUsed === 100 ? 0 : roll.policyUsed === 50 ? 5 : 10;
        resPct = Math.max(0, resPct - penalty);
      }
    });
  }
  var resScore = (resPct / 100) * 30;

  // Competencies
  var compItems = items.filter(function(i){ return i.cat === C_COMP && !i.blind && i.forBiz === f.biz; });
  var compPct = compItems.reduce(function(s,i){ return s + i.weight; }, 0);
  var bnbMiksturaBonus = 0;
  if(bnbEnabled) {
    if(compPct >= 100) { bnbMiksturaBonus = bnbMikstura; }
    else { compPct = Math.min(100, compPct + bnbMikstura * 4); }
  }
  var compScore = (compPct / 100) * 25;

  // Plot
  var plotItem = items.find(function(i){ return i.cat === C_PLOT; });
  var plotOk = plotItem && plotItem.plotNr === f.tPlot;
  var plotScore = plotOk ? 10 : 0;

  // Cash
  var cashForScore = bnbEnabled ? d.cash * (1 + bnbObligacje * 0.2) : d.cash;
  var cashScore = ((cashForScore - 600) / 600) * 25;

  // Map
  var uniqueFrags = [];
  var fragSet = {};
  items.forEach(function(i){ if(i.cat === C_MAP && !fragSet[i.fragNr]) { fragSet[i.fragNr] = true; uniqueFrags.push(i.fragNr); }});
  var mapScore = mapEnabled ? Math.min(10, uniqueFrags.length * 2 + ((mapBonusClaimed && mapBonusClaimed[fId] && uniqueFrags.length === 4) ? 2 : 0)) : 0;

  // BnB bonus
  var bnb = bnbEnabled ? (bnbKwatera + bnbKurierBonus + bnbMiksturaBonus) : 0;

  var bizTotal = resScore + compScore + plotScore + cashScore + mapScore + bnb;

  return {
    resPct: resPct, resScore: Math.round(resScore),
    compPct: compPct, compScore: Math.round(compScore),
    plotOk: plotOk, plotScore: plotScore,
    cash: d.cash, cashForScore: Math.round(cashForScore), cashScore: Math.round(cashScore),
    mapScore: mapScore, bnb: bnb,
    bnbKurier: bnbKurier, bnbMikstura: bnbMikstura, bnbObligacje: bnbObligacje, bnbKwatera: bnbKwatera,
    bizTotal: Math.round(bizTotal)
  };
}

export function calcRelationScore(fId, relations) {
  if(!relations) return 0;
  var totalStars = 0;
  FO.forEach(function(rater) {
    if(rater === fId) return;
    var r = relations[rater];
    if(!r || !r[fId]) return;
    var rat = r[fId];
    totalStars += (rat.partnership || 0) + (rat.rules || 0) + (rat.communication || 0);
  });
  return Math.round((totalStars / 45) * 20 * 10) / 10;
}
