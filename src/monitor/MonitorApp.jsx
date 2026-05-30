/* WDZ Monitor v1.1.0 – MonitorApp.jsx
 * Migrated from wdz-monitor-v1_0_0.html to Vite ES modules.
 * Zero logic changes – only import/export adaptation.
 */
import React from "react";
import { FM, FO, G_TASKS, C_RES, C_COMP, C_PLOT, C_MAP, C_BNB, STAGES, BNB_PRODUCTS } from "../game/constants.js";
import { ensureArray, toSlug } from "../utils/index.js";
import { calcScore, calcRelationScore } from "../game/scoring.js";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

import { db, auth, firebase } from "./firebase-init.js";

const VERSION = "1.1.0";

/* ========== GAME CONSTANTS – z wdz-shared.js: FM, FO, C_*, STAGES, BNB_PRODUCTS, PAIRINGS, ensureArray ========== */

const START_CASH = 600;
const EXPECTED_ITEMS = { adams:32, bennet:28, clinton:29, dexter:31 };
const TOTAL_ITEMS = 120;
const TOTAL_CASH = 2400;
const MAP_FRAGS_PER_FAMILY = 4;
const TOTAL_MAP_FRAGS = 16;
const TOTAL_PLOTS = 4;

/* ========== HELPERS ========== */
function fixFdFromFirebase(fd){
  if(!fd)return fd;
  var r={};
  for(var k in fd){r[k]={cash:fd[k].cash!=null?fd[k].cash:0,items:ensureArray(fd[k].items)};}
  return r;
}
function ts(){return new Date().toLocaleTimeString("pl",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}

/* ========== SOUND ALERT ========== */
var audioCtx = null;
function playAlertBeep() {
  try {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 880; osc.type = "square";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) { /* ignore audio errors */ }
}

/* ========== SCORE CALCULATOR – wrapper delegujący do kanonicznego calcScore ========== */
function monCalcScore(fId, fd, biznesNaBoku, bnbEnabled, blindFate, mapEnabled, mapBonusClaimed) {
  return calcScore(fId, fd, {}, biznesNaBoku, bnbEnabled, blindFate, mapEnabled, mapBonusClaimed);
}

/* ========== CHANGE DETECTION ========== */
function detectChanges(cur, prev) {
  var changes = [];
  if(!prev) return changes;
  // Stage change
  if(cur.stageIdx !== prev.stageIdx && cur.stageIdx != null) {
    var st = STAGES[cur.stageIdx];
    changes.push({sev:SEV.INFO, cat:"ETAP", msg:"Przejście do: " + (st ? st.label : "etap " + cur.stageIdx)});
  }
  // Game started
  if(cur.gameStarted && !prev.gameStarted) {
    changes.push({sev:SEV.INFO, cat:"GRA", msg:"Rozgrywka rozpoczęta"});
  }
  // Timer paused/resumed
  if(cur.timerPaused && !prev.timerPaused) {
    changes.push({sev:SEV.INFO, cat:"TIMER", msg:"Timer wstrzymany (pauza)"});
  }
  if(!cur.timerPaused && prev.timerPaused && cur.timerRunning) {
    changes.push({sev:SEV.INFO, cat:"TIMER", msg:"Timer wznowiony"});
  }
  // Mechanic toggles
  var mechs = [
    {key:"bnbEnabled", label:"Biznes na Boku"},
    {key:"fateEnabled", label:"Ślepy Los"},
    {key:"mapEnabled", label:"Złotodajna Żyła"},
    {key:"revEnabled", label:"Rewolwerowiec"},
    {key:"relationsUnlocked", label:"Relacje"},
  ];
  mechs.forEach(m => {
    if(cur[m.key] && !prev[m.key]) changes.push({sev:SEV.INFO, cat:"MECHANIKA", msg:m.label + " – aktywowany"});
  });
  // New transactions
  var curTxs = cur.txs ? ensureArray(cur.txs) : [];
  var prevTxs = prev.txs ? ensureArray(prev.txs) : [];
  if(curTxs.length > prevTxs.length) {
    var diff = curTxs.length - prevTxs.length;
    changes.push({sev:SEV.INFO, cat:"TRANSAKCJA", msg:"+" + diff + " now" + (diff > 1 ? "ych" : "a") + " transakcj" + (diff > 1 ? "i" : "a")});
  }
  // mapBonus claimed
  if(cur.mapBonusClaimed && prev.mapBonusClaimed) {
    FO.forEach(fId => {
      if(cur.mapBonusClaimed[fId] && !prev.mapBonusClaimed[fId]) {
        changes.push({sev:SEV.INFO, cat:"MAPA", msg:FM[fId].nom + " – odebrano premię za mapę (300 $)"});
      }
    });
  }
  // Debrief unlocked
  if(cur.debriefUnlocked && !prev.debriefUnlocked) {
    changes.push({sev:SEV.INFO, cat:"OMÓWIENIE", msg:"Wyniki udostępnione rodzinom"});
  }
  if(cur.debriefFullAccess && !prev.debriefFullAccess) {
    changes.push({sev:SEV.INFO, cat:"OMÓWIENIE", msg:"Pełny dostęp do wyników – wszystkie rodziny"});
  }
  return changes;
}

/* ========== SEVERITY LEVELS ========== */
const SEV = {INFO:"info", WARN:"warn", ERROR:"error"};
const SEV_LABEL = {info:"INFO", warn:"UWAGA", error:"BŁĄD"};
const SEV_COLOR = {info:"#6B8E6B", warn:"#D4A853", error:"#C04030"};
const SEV_BG    = {info:"#1A2A1A", warn:"#2A2210", error:"#2A1210"};

/* ========== ANOMALY DETECTION ENGINE ========== */
function runChecks(gameState, players, prevState) {
  var events = [];
  if(!gameState) return events;

  var fd = gameState.fd ? fixFdFromFirebase(gameState.fd) : null;
  var txs = gameState.txs ? ensureArray(gameState.txs) : [];

  // --- LAYER 1: Connection health ---
  if(players) {
    // Check sheriff presence
    if(!players.sheriff || !players.sheriff.connected) {
      events.push({sev:SEV.WARN, cat:"POŁĄCZENIE", msg:"Szeryf jest rozłączony"});
    }
    // Check family presence
    FO.forEach(fId => {
      var fp = players[fId];
      if(!fp || !fp.members || Object.keys(fp.members).length === 0) {
        if(gameState.gameStarted) {
          events.push({sev:SEV.WARN, cat:"POŁĄCZENIE", msg:FM[fId].nom + " – brak podłączonych graczy"});
        }
      }
    });
  }

  if(!fd) return events;

  // --- LAYER 2: State anomalies ---

  // 2a. Cash integrity
  var totalCash = 0;
  FO.forEach(fId => {
    var cash = fd[fId].cash;
    totalCash += cash;
    if(cash < 0) {
      events.push({sev:SEV.ERROR, cat:"GOTÓWKA", msg:FM[fId].nom + " – ujemna gotówka: " + cash + " $"});
    }
  });

  // 2b. Total cash conservation (accounting for blind fate events)
  var blindFate = gameState.blindFate || {};
  var fateDelta = 0;
  FO.forEach(fId => {
    var bf = blindFate[fId];
    if(bf && bf.rolls) {
      ensureArray(bf.rolls).forEach(roll => {
        if(roll && roll.resolved && roll.event) {
          if(roll.event.type === "loss" || roll.event.type === "gain") {
            var amt = roll.event.amount || 0;
            // Apply policy reduction for losses
            if(roll.event.type === "loss" && roll.policyUsed) {
              if(roll.policyUsed === 100) amt = 0;
              else if(roll.policyUsed === 50) amt = Math.round(amt / 2);
            }
            fateDelta += amt;
          }
        }
      });
    }
  });
  // Account for consultations (15$ each deducted from family cash)
  // consultations[fId] is an array – each entry = 1 sold consultation
  // Note: cancelled consultations (refunded) also remain in array; sheriffCalls tracks actual state
  var consultsCost = 0;
  // Also count from consultation transactions
  var consultTx = gameState.txs ? ensureArray(gameState.txs) : [];

  var calls = gameState.sheriffCalls || [];
  if(Array.isArray(calls)) {
    calls.forEach(c => {
      if(c && c.status === "sold") consultsCost += 15;
      // "cancelled" after "sold" means refund already happened – no net cost
    });
  }
  // Fallback: count from consultations arrays if sheriffCalls not available
  if(consultsCost === 0) {
    var consultsObj = gameState.consultations || {};
    FO.forEach(fId => {
      var cArr = consultsObj[fId];
      if(cArr) consultsCost += ensureArray(cArr).length * 15;
    });
  }
  // Account for plot penalties (50$ each, deducted from family cash)
  var plotPens = gameState.plotPenalties || {};
  var penaltyCost = 0;
  FO.forEach(fId => { if(plotPens[fId]) penaltyCost += 50; });

  // Account for insurance policy costs (from blindFate rolls)
  var insuranceCost = 0;
  var bfData = gameState.blindFate || {};
  FO.forEach(fId => {
    if(bfData[fId] && bfData[fId].rolls) {
      ensureArray(bfData[fId].rolls).forEach(roll => {
        if(roll && roll.policyUsed === 100) insuranceCost += 50;
        else if(roll && roll.policyUsed === 50) insuranceCost += 30;
      });
    }
  });

  // Account for BnB settlement (300$ per family to supplier, minus 100$ bonus)
  var bnbSettleCost = 0;
  if(gameState.bnbSettled) {
    var txArr = gameState.txs ? ensureArray(gameState.txs) : [];
    txArr.forEach(tx => {
      if(tx && tx.type === "bnb_settle") bnbSettleCost += 300;
      if(tx && tx.type === "bnb_bonus") bnbSettleCost -= 100;
    });
  }

  // Account for map bonus (+300$ for winner from bank, -100$ per loser)
  var mapBonusCash = 0;
  if(gameState.txs) {
    ensureArray(gameState.txs).forEach(tx => {
      if(tx && tx.type === "map_bonus") {
        if(tx.from === "bank") mapBonusCash += 300;
        else mapBonusCash -= 100;
      }
    });
  }

  var expectedCash = TOTAL_CASH + fateDelta - consultsCost - penaltyCost - insuranceCost - bnbSettleCost + mapBonusCash;
  if(Math.abs(totalCash - expectedCash) > 1) {
    events.push({sev:SEV.ERROR, cat:"GOTÓWKA",
      msg:"Suma gotówki (" + totalCash + " $) nie zgadza się z oczekiwaną (" + expectedCash + " $). Różnica: " + (totalCash - expectedCash) + " $"});
  }

  // 2c. Item count integrity
  var totalItems = 0;
  FO.forEach(fId => { totalItems += fd[fId].items.length; });
  // BnB cards can be added if bnbEnabled
  var bnbCardCount = 0;
  if(gameState.bnbEnabled) {
    FO.forEach(fId => { bnbCardCount += BNB_PRODUCTS[fId].qty; });
  }
  var expectedItems = TOTAL_ITEMS + bnbCardCount;
  // +1 for 5th map fragment if map bonus was claimed
  var mbcObj = gameState.mapBonusClaimed || {};
  if(Object.keys(mbcObj).some(function(k){return mbcObj[k];})) expectedItems += 1;
  if(totalItems !== expectedItems) {
    events.push({sev:SEV.WARN, cat:"KARTY",
      msg:"Łączna liczba kart (" + totalItems + ") różni się od oczekiwanej (" + expectedItems + "). Różnica: " + (totalItems - expectedItems)});
  }

  // 2d. Pending transactions stuck too long
  var now = Date.now();
  txs.forEach(tx => {
    if(tx.status === "pending" && tx.ts) {
      var age = (now - tx.ts) / 1000;
      if(age > 120) {
        events.push({sev:SEV.ERROR, cat:"TRANSAKCJA",
          msg:"Transakcja " + (tx.id||"?").substring(0,10) + " utknęła w pending od " + Math.round(age) + "s (" + FM[tx.from]?.nom + " → " + FM[tx.to]?.nom + ")"});
      } else if(age > 60) {
        events.push({sev:SEV.WARN, cat:"TRANSAKCJA",
          msg:"Transakcja " + (tx.id||"?").substring(0,10) + " w pending od " + Math.round(age) + "s"});
      }
    }
  });

  // 2e. Duplicate map fragments per family (more unique frags than possible)
  var mbc = gameState.mapBonusClaimed || {};
  FO.forEach(fId => {
    var maps = fd[fId].items.filter(i => i.cat === C_MAP);
    var uniqueFrags = [...new Set(maps.map(m => m.fragNr))];
    var maxAllowed = mbc[fId] ? 5 : 4;
    if(uniqueFrags.length > maxAllowed) {
      events.push({sev:SEV.ERROR, cat:"MAPA", msg:FM[fId].nom + " – " + uniqueFrags.length + " unikalnych fragmentów mapy (max " + maxAllowed + ")"});
    }
  });

  // 2f. Multiple plots per family
  FO.forEach(fId => {
    var plots = fd[fId].items.filter(i => i.cat === C_PLOT);
    if(plots.length > 1) {
      events.push({sev:SEV.WARN, cat:"DZIAŁKA", msg:FM[fId].nom + " – posiada " + plots.length + (plots.length <= 4 ? " działki" : " działek")});
    }
    if(plots.length === 0 && gameState.gameStarted) {
      events.push({sev:SEV.WARN, cat:"DZIAŁKA", msg:FM[fId].nom + " – nie posiada żadnej działki"});
    }
  });

  // 2g. Stage/mechanic consistency
  if(gameState.bnbEnabled && !gameState.gameStarted) {
    events.push({sev:SEV.WARN, cat:"MECHANIKA", msg:"BnB włączone, ale gra nie została wystartowana"});
  }
  if(gameState.fateEnabled && !gameState.gameStarted) {
    events.push({sev:SEV.WARN, cat:"MECHANIKA", msg:"Ślepy Los włączony, ale gra nie została wystartowana"});
  }

  // 2h. mapBonusClaimed but cash didn't increase
  if(gameState.mapBonusClaimed && fd) {
    FO.forEach(fId => {
      if(gameState.mapBonusClaimed[fId]) {
        var uniqueFrags = [...new Set(fd[fId].items.filter(i => i.cat === C_MAP).map(m => m.fragNr))];
        if(uniqueFrags.length < 4) {
          events.push({sev:SEV.ERROR, cat:"MAPA",
            msg:FM[fId].nom + " – mapBonusClaimed=true, ale posiada tylko " + uniqueFrags.length + " unikalnych fragmentów"});
        }
      }
    });
  }

  // 2i. Blind fate rolling stuck
  if(blindFate) {
    FO.forEach(fId => {
      var bf = blindFate[fId];
      if(bf && bf.rolls) {
        ensureArray(bf.rolls).forEach((roll, idx) => {
          if(roll && roll.rolling === true) {
            events.push({sev:SEV.WARN, cat:"ŚLEPY LOS",
              msg:FM[fId].nom + " – rzut #" + (idx+1) + " utknął w animacji (rolling=true)"});
          }
        });
      }
    });
  }

  // 2j. Rewolwerowiec watchdog – active duels exceeding expected time
  if(gameState.revEnabled) {
    var revActive = gameState.revActive;
    if(revActive) {
      var duels = Array.isArray(revActive) ? revActive : (revActive === "__empty__" ? [] : Object.values(revActive));
      duels.forEach(function(duel) {
        if(duel && duel.timerPhase && duel.timerStartedAt && duel.timerDuration) {
          var elapsed = (Date.now() - duel.timerStartedAt) / 1000;
          if(elapsed > duel.timerDuration + 30) {
            events.push({sev:SEV.WARN, cat:"REWOLWEROWIEC",
              msg:"Pojedynek " + (duel.a||"?") + " vs " + (duel.b||"?") + " – timer przekroczony o " + Math.round(elapsed - duel.timerDuration) + "s"});
          }
        }
      });
    }
    // revCurrent (legacy single-duel) check
    var rc = gameState.revCurrent;
    if(rc && rc !== false && rc.timerPhase && rc.timerStartedAt && rc.timerDuration) {
      var rcElapsed = (Date.now() - rc.timerStartedAt) / 1000;
      if(rcElapsed > rc.timerDuration + 30) {
        events.push({sev:SEV.WARN, cat:"REWOLWEROWIEC",
          msg:"Aktywny pojedynek – timer przekroczony o " + Math.round(rcElapsed - rc.timerDuration) + "s"});
      }
    }
  }

  // 2k. BnB settlement consistency
  if(gameState.bnbEnabled && gameState.bnbSettled && fd) {
    // After settlement, check that no BnB cards remain "unsold" in original family
    // (settlement should have cleared unsold cards and added cash)
    // This is a soft check – just inform
    FO.forEach(fId => {
      var bnbOwn = fd[fId].items.filter(i => i.cat === C_BNB && i.bnbOrigin === fId);
      if(bnbOwn.length > 0) {
        events.push({sev:SEV.INFO, cat:"BNB",
          msg:FM[fId].nom + " – " + bnbOwn.length + " niesprzedanych produktów BnB po rozliczeniu"});
      }
    });
  }

  // 2l. Consultation consistency
  var consults = gameState.consultations || {};
  FO.forEach(fId => {
    var cArr = consults[fId];
    if(!cArr) return;
    var active = ensureArray(cArr).filter(c => c && c.status === "active");
    active.forEach(c => {
      if(c.questionsTotal && c.questionsUsed >= c.questionsTotal) {
        events.push({sev:SEV.INFO, cat:"KONSULTACJA",
          msg:FM[fId].nom + " – konsultacja wyczerpana (" + c.questionsUsed + "/" + c.questionsTotal + " pytań)"});
      }
    });
    // Multiple simultaneous active consultations is unusual
    if(active.length > 1) {
      events.push({sev:SEV.WARN, cat:"KONSULTACJA",
        msg:FM[fId].nom + " – " + active.length + " aktywne konsultacje jednocześnie"});
    }
  });
  // Cross-check: consultations cash accounting
  // Count total consultations sold (active or completed) and verify cash deductions
  var totalConsultsSold = 0;
  FO.forEach(fId => {
    var cArr = consults[fId];
    if(cArr) totalConsultsSold += ensureArray(cArr).length;
  });

  // If no issues found
  if(events.length === 0) {
    events.push({sev:SEV.INFO, cat:"SYSTEM", msg:"Brak wykrytych anomalii"});
  }

  return events;
}

/* ========== TRANSACTION STATS ========== */
function calcTxStats(txs) {
  if(!txs || txs.length === 0) return {total:0, accepted:0, rejected:0, cancelled:0, pending:0, pairs:{}};
  var stats = {total:txs.length, accepted:0, rejected:0, cancelled:0, pending:0, pairs:{}};
  txs.forEach(tx => {
    if(tx.status === "accepted") stats.accepted++;
    else if(tx.status === "rejected") stats.rejected++;
    else if(tx.status === "cancelled") stats.cancelled++;
    else if(tx.status === "pending") stats.pending++;
    // Track per-pair activity
    if(tx.from && tx.to) {
      var pair = [tx.from, tx.to].sort().join("-");
      if(!stats.pairs[pair]) stats.pairs[pair] = {accepted:0, rejected:0, cancelled:0, total:0};
      stats.pairs[pair].total++;
      if(tx.status === "accepted") stats.pairs[pair].accepted++;
      else if(tx.status === "rejected") stats.pairs[pair].rejected++;
      else if(tx.status === "cancelled") stats.pairs[pair].cancelled++;
    }
  });
  return stats;
}

/* ========== TRANSACTION PHASE BREAKDOWN ========== */
function calcPhaseStats(txs) {
  var phases = {1:{accepted:0,rejected:0,cancelled:0,total:0}, 2:{accepted:0,rejected:0,cancelled:0,total:0}, 3:{accepted:0,rejected:0,cancelled:0,total:0}};
  if(!txs) return phases;
  txs.forEach(tx => {
    var p = tx.phase;
    if(p >= 1 && p <= 3) {
      phases[p].total++;
      if(tx.status === "accepted") phases[p].accepted++;
      else if(tx.status === "rejected") phases[p].rejected++;
      else if(tx.status === "cancelled") phases[p].cancelled++;
    }
  });
  return phases;
}

/* ========== SESSION REPORT EXPORT ========== */
function fragName(nr) { return nr===1?"Adamsów":nr===2?"Bennetów":nr===3?"Clintonów":nr===4?"Dexterów":nr===5?"Szeryfa":"?"; }

function generateReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed, consultNotes) {
  var fd = gameState ? gameState.fd : null;
  var relData = gameState ? gameState.relations || {} : {};

  // Normalizacja formatu scores – gCalcScores (zasoby/kompetencje) vs calcScore (resScore/compScore)
  if(scores) {
    var _ns = {};
    FO.forEach(function(fId) {
      var s = scores[fId]; if(!s) return;
      _ns[fId] = {
        resScore:   s.resScore  != null ? s.resScore  : (s.zasoby != null ? s.zasoby : 0),
        compScore:  s.compScore != null ? s.compScore : (s.kompetencje != null ? s.kompetencje : 0),
        cashScore:  s.cashScore != null ? s.cashScore : (s.gotowka != null ? s.gotowka : 0),
        plotScore:  s.plotScore != null ? s.plotScore : (s.dzialka != null ? s.dzialka : 0),
        mapScore:   s.mapScore  != null ? s.mapScore  : (s.mapa != null ? s.mapa : 0),
        bnb:        s.bnb || 0,
        bizTotal:   s.bizTotal  != null ? s.bizTotal  : (s.total != null ? s.total - (s.relacje||0) : 0),
        resPct:     s.resPct    != null ? s.resPct    : 0,
        compPct:    s.compPct   != null ? s.compPct   : 0,
        plotOk:     s.plotOk    != null ? s.plotOk    : (s.dzialka > 0),
        bnbObligacje: s.bnbObligacje || 0,
        bnbKwatera:   s.bnbKwatera || 0,
        bnbKurier:    s.bnbKurier || 0,
        bnbMikstura:  s.bnbMikstura || 0,
      };
    });
    scores = _ns;
  }
  var lines = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  WDZ MONITOR – RAPORT DIAGNOSTYCZNY");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("Kod rozgrywki: " + roomCode);
  lines.push("Raport wygenerowany: " + new Date().toLocaleString("pl"));
  lines.push("Czas monitorowania: " + Math.floor(elapsed/3600) + "h " + Math.floor((elapsed%3600)/60) + "min");
  var st = gameState && gameState.stageIdx != null ? STAGES[gameState.stageIdx] : null;
  lines.push("Etap końcowy: " + (st ? st.label : "nieznany"));
  lines.push("");

  // META
  lines.push("── METADANE ──");
  var meta = (gameState && gameState.meta) || {};
  if(meta.client) lines.push("Klient: " + meta.client);
  if(meta.group) lines.push("Grupa: " + meta.group);
  if(meta.sheriffEmail) lines.push("Szeryf: " + meta.sheriffEmail);
  if(meta.sheriff2Email) lines.push("Szeryf 2: " + meta.sheriff2Email);
  if(meta.createdAt) lines.push("Utworzenie rozgrywki: " + new Date(meta.createdAt).toLocaleString("pl"));
  lines.push("");

  // CONFIG
  lines.push("── KONFIGURACJA ──");
  lines.push("Biznes na Boku: " + (gameState&&gameState.bnbEnabled ? "TAK" : "NIE"));
  lines.push("Ślepy Los: " + (gameState&&gameState.fateEnabled ? "TAK" : "NIE"));
  lines.push("Złotodajna Żyła: " + (gameState&&gameState.mapEnabled!==false ? "TAK" : "NIE"));
  lines.push("Rewolwerowiec: " + (gameState&&gameState.revEnabled ? "TAK (tryb: "+(gameState.revMode||"arena")+", maxBet: "+(gameState.revMaxBet||60)+"$)" : "NIE"));
  lines.push("");

  // WINNER + SCORES
  lines.push("── WYNIKI RODZIN ──");
  if(scores && fd) {
    var bestFam = null, bestPts = -999;
    FO.forEach(fId => {
      var relScore = calcRelationScore(fId, relData);
      var total = (scores[fId] ? scores[fId].bizTotal : 0) + relScore;
      if(total > bestPts) { bestPts = total; bestFam = fId; }
    });
    if(bestFam) lines.push("ZWYCIĘZCA: " + FM[bestFam].nom + " (" + Math.round(bestPts) + " pkt)");
    lines.push("");
    FO.forEach(fId => {
      var sc = scores[fId]; if(!sc) return;
      var relScore = calcRelationScore(fId, relData);
      var total = Math.round(sc.bizTotal + relScore);
      var f = FM[fId];
      lines.push(FM[fId].nom + ": " + total + " pkt");
      lines.push("  Zasoby: " + sc.resScore + "/30 (resPct=" + sc.resPct + "%)");
      lines.push("  Kompetencje: " + sc.compScore + "/25 (compPct=" + sc.compPct + "%)");
      lines.push("  Działka: " + sc.plotScore + "/10 (" + (sc.plotOk ? "właściwa nr "+f.tPlot : "niewłaściwa") + ")");
      var cashForScoreVal = gameState.bnbEnabled ? fd[fId].cash * (1 + (sc.bnbObligacje||0) * 0.2) : fd[fId].cash;
      lines.push("  Gotówka: " + sc.cashScore + "/25 (cash=" + fd[fId].cash + "$" + (sc.bnbObligacje>0 ? ", cashForScore=" + Math.round(cashForScoreVal) + "$ [×" + (1+sc.bnbObligacje*0.2) + " Obligacje]" : "") + ")");
      var uniqueFrags = ensureArray(fd[fId].items).filter(i=>i.cat===C_MAP);
      var fragNrs = [...new Set(uniqueFrags.map(i=>i.fragNr))];
      lines.push("  Złotodajna Żyła: " + sc.mapScore + "/10 (fragmenty: " + (fragNrs.length>0 ? fragNrs.map(fragName).join(", ") : "brak") + ")");
      lines.push("  BnB: " + sc.bnb + " pkt (Kwatera:" + (sc.bnbKwatera||0) + " Kurier:" + (sc.bnbKurier||0) + (sc.resPct>=100&&sc.bnbKurier>0?" [bonus]":" [%]") + " Mikstura:" + (sc.bnbMikstura||0) + (sc.compPct>=100&&sc.bnbMikstura>0?" [bonus]":" [%]") + " Obligacje:" + (sc.bnbObligacje||0) + ")");
      lines.push("  Relacje: " + relScore + "/20");
      lines.push("  bizTotal=" + sc.bizTotal + " + relacje=" + relScore + " = " + total);
      lines.push("");
    });
  }

  // INWENTARZ KART
  lines.push("── INWENTARZ KART (stan końcowy) ──");
  if(fd) {
    FO.forEach(fId => {
      var items = ensureArray(fd[fId].items);
      var f = FM[fId];
      lines.push(FM[fId].nom + " (" + items.length + " kart):");
      var res = items.filter(i=>i.cat===C_RES&&!i.blind);
      var comp = items.filter(i=>i.cat===C_COMP&&!i.blind);
      var nres = items.filter(i=>i.cat==="nres");
      var ncomp = items.filter(i=>i.cat==="ncomp");
      var plots = items.filter(i=>i.cat===C_PLOT);
      var maps = items.filter(i=>i.cat===C_MAP);
      var bnb = items.filter(i=>i.cat===C_BNB);
      if(res.length) lines.push("  Zasoby (" + res.length + "): " + res.map(i=>i.name+(i.forBiz===f.biz?" ✓":"")+(i.weight?" ["+i.weight+"%]":"")).join(", "));
      if(comp.length) lines.push("  Kompetencje (" + comp.length + "): " + comp.map(i=>i.name+(i.forBiz===f.biz?" ✓":"")+(i.weight?" ["+i.weight+"%]":"")).join(", "));
      if(nres.length) lines.push("  Notatki zasobów (" + nres.length + "): " + nres.map(i=>i.name).join(", "));
      if(ncomp.length) lines.push("  Notatki kompetencji (" + ncomp.length + "): " + ncomp.map(i=>i.name).join(", "));
      if(plots.length) lines.push("  Działki: " + plots.map(i=>"nr "+i.plotNr+(i.plotNr===f.tPlot?" ✓ (docelowa)":" ✗ (docelowa: "+f.tPlot+")")).join(", "));
      if(maps.length) lines.push("  Fragmenty mapy: " + [...new Set(maps.map(i=>i.fragNr))].map(fragName).join(", ") + " (kopii łącznie: "+maps.length+")");
      if(bnb.length) lines.push("  BnB: " + bnb.map(i=>i.name).join(", "));
    });
  }
  lines.push("");

  // BILANS GOTÓWKOWY
  lines.push("── BILANS GOTÓWKOWY ──");
  if(fd && gameState) {
    FO.forEach(fId => {
      var bal = ["600$ (start)"];
      var txArr = ensureArray(gameState.txs || []);
      var tradeIn=0, tradeOut=0;
      txArr.forEach(tx => {
        if(!tx||tx.status!=="accepted") return;
        if(tx.type==="sale"||tx.type==="barter") {
          if(tx.from===fId) tradeOut += (tx.offerCash||tx.offeredCash||0);
          if(tx.to===fId) tradeIn += (tx.offerCash||tx.offeredCash||0);
          if(tx.from===fId) tradeIn += (tx.requestCash||tx.responseCash||0);
          if(tx.to===fId) tradeOut += (tx.requestCash||tx.responseCash||0);
          // Sale: price flows from buyer(to) to seller(from)
          if(tx.type==="sale") {
            if(tx.from===fId) tradeIn += (tx.price||0);
            if(tx.to===fId) tradeOut += (tx.price||0);
          }
        }
      });
      if(tradeIn) bal.push("+ " + tradeIn + "$ przychody z handlu");
      if(tradeOut) bal.push("- " + tradeOut + "$ wydatki z handlu");
      var bf = (gameState.blindFate||{})[fId];
      if(bf&&bf.rolls) {
        ensureArray(bf.rolls).forEach(r => {
          if(!r||!r.resolved||!r.event) return;
          if(r.policyUsed===100) bal.push("- 50$ polisa 100%");
          else if(r.policyUsed===50) bal.push("- 30$ polisa 50%");
          if(r.netEffect && r.netEffect!==0) bal.push((r.netEffect>0?"+ ":"- ") + Math.abs(r.netEffect) + "$ Ślepy Los");
        });
      }
      var calls = ensureArray(gameState.sheriffCalls||[]).filter(c=>c&&c.fId===fId||c&&c.family===fId);
      var soldC = calls.filter(c=>c.status==="sold").length;
      if(soldC) bal.push("- " + (soldC*15) + "$ konsultacje ("+soldC+"×15$)");
      var penTx = txArr.filter(t=>t&&(t.type==="penalty"||t.type==="plot_cost")&&t.from===fId);
      if(penTx.length) bal.push("- 50$ dodatkowy koszt (działka)");
      var settleTx = txArr.filter(t=>t&&t.type==="bnb_settle"&&t.from===fId);
      var bonusTx = txArr.filter(t=>t&&t.type==="bnb_bonus"&&t.to===fId);
      if(settleTx.length) bal.push("- 300$ prowizja dla dostawcy BnB");
      if(bonusTx.length) bal.push("+ 100$ rabat od dostawcy");
      var mapWinTx = txArr.filter(t=>t&&t.type==="map_bonus"&&t.to===fId&&t.from==="bank");
      var mapLoseTx = txArr.filter(t=>t&&t.type==="map_bonus"&&t.from===fId);
      if(mapWinTx.length) bal.push("+ 300$ premia za Złotodajną Żyłę");
      if(mapLoseTx.length) bal.push("- 100$ koszt premii za Złotodajną Żyłę");
      bal.push("= " + fd[fId].cash + "$ (końcowa)");
      lines.push(FM[fId].nom + ": " + bal.join(" → "));
    });
  }
  lines.push("");

  // TRANSAKCJE
  lines.push("── TRANSAKCJE ──");
  if(txStats) {
    lines.push("Łącznie: " + txStats.total + " | Zaakceptowane: " + txStats.accepted + " | Odrzucone: " + txStats.rejected + " | Anulowane: " + txStats.cancelled);
    lines.push("Per faza:  I: " + phaseStats[1].total + "  II: " + phaseStats[2].total + "  III: " + phaseStats[3].total);
    if(Object.keys(txStats.pairs).length > 0) {
      lines.push("Per para:");
      Object.entries(txStats.pairs).forEach(([pair, data]) => {
        var parts = pair.split("-");
        var aLabel = FM[parts[0]] ? FM[parts[0]].gen : parts[0];
        var bLabel = FM[parts[1]] ? FM[parts[1]].gen : parts[1];
        lines.push("  " + aLabel + " – " + bLabel + ": " + data.total + " tx (✓" + data.accepted + " ✗" + data.rejected + " ⊘" + data.cancelled + ")");
      });
    }
  }
  lines.push("");

  // RYTM TRANSAKCJI PER TURA
  lines.push("── RYTM TRANSAKCJI PER TURA ──");
  var turnLabels = ["F1T1","F1T2","F1T3","F2T1","F2T2","F2T3","F3T1","F3T2","F3T3"];
  var txPerTurn = null;
  var _txsAll = gameState && gameState.txs ? ensureArray(gameState.txs) : [];
  var tradeTxForRhythm = _txsAll.filter(t => t && t.status === "accepted" && (t.type === "sale" || t.type === "barter") && t.phase !== undefined && t.phase !== null);
  if(tradeTxForRhythm.length > 0 && fd) {
    txPerTurn = {};
    FO.forEach(fId => { txPerTurn[fId] = [0,0,0,0,0,0,0,0,0]; });
    tradeTxForRhythm.forEach(tx => {
      var p = tx.phase;
      if(p >= 0 && p <= 8) {
        if(tx.from && txPerTurn[tx.from]) txPerTurn[tx.from][p]++;
        if(tx.to && txPerTurn[tx.to]) txPerTurn[tx.to][p]++;
      }
    });
  }
  if(txPerTurn) {
    lines.push("                 " + turnLabels.join("  "));
    FO.forEach(fId => {
      var name = (FM[fId].nom + "               ").slice(0, 16);
      lines.push(name + " " + txPerTurn[fId].map(n => String(n).padStart(4)).join("  "));
    });
  } else {
    lines.push("Brak danych (transakcje bez przypisanej tury).");
  }
  lines.push("");

  // REALIZACJA ZADAŃ
  lines.push("── REALIZACJA ZADAŃ ──");
  if(fd) {
    FO.forEach(fId => {
      var f = FM[fId];
      var items = fd[fId] ? ensureArray(fd[fId].items) : [];
      var task = G_TASKS[fId];
      var resItems = items.filter(i => i.cat === C_RES && i.forBiz === f.biz);
      var resPct = resItems.reduce((s, i) => s + (i.weight || 0), 0);
      var compItems = items.filter(i => i.cat === C_COMP && i.forBiz === f.biz);
      var compPct = compItems.reduce((s, i) => s + (i.weight || 0), 0);
      var plots = items.filter(i => i.cat === C_PLOT);
      var hasCorrect = plots.some(i => i.plotNr === f.tPlot);
      var plotLabel = hasCorrect ? "docelowa (nr " + f.tPlot + ")" : plots.length > 0 ? "startowa (nr " + plots[0].plotNr + ")" : "brak";
      lines.push(f.nom + ":");
      lines.push("  Zasoby:       " + resItems.length + "/" + task.zasoby.length + " kart (" + resPct + "% wagi)");
      lines.push("  Kompetencje:  " + compItems.length + "/" + task.kompetencje.length + " kart (" + compPct + "% wagi)");
      lines.push("  Działka:      " + plotLabel);
    });
  } else {
    lines.push("Brak danych fd.");
  }
  lines.push("");

  // ŚLEPY LOS
  lines.push("── ŚLEPY LOS ──");
  var bfData = gameState ? gameState.blindFate || {} : {};
  var anyFate = false;
  FO.forEach(fId => {
    var bf = bfData[fId];
    if(!bf || !bf.rolls) return;
    var rolls = ensureArray(bf.rolls).filter(r => r && r.resolved);
    if(rolls.length === 0) return;
    anyFate = true;
    lines.push(FM[fId].nom + ":");
    rolls.forEach(r => {
      var ev = r.event || {};
      var policyLabel = r.policyUsed === 100 ? " [polisa 100%]" : r.policyUsed === 50 ? " [polisa 50%]" : "";
      var effectText = r.netEffectText || (ev.amount ? (ev.amount > 0 ? "+" : "") + ev.amount + "$" : "brak efektu");
      lines.push("  🎲 " + (r.dice1||"?") + "+" + (r.dice2||"?") + "=" + (r.sum||"?") + "  " + (ev.text || "–") + "  → " + effectText + policyLabel);
    });
  });
  if(!anyFate) lines.push("Brak rzutów Ślepego Losu");
  lines.push("");

  // BnB
  lines.push("── BIZNES NA BOKU ──");
  if(gameState && gameState.bnbEnabled && fd) {
    FO.forEach(fId => {
      var items = ensureArray(fd[fId].items);
      var bnbAll = items.filter(i => i.cat === C_BNB);
      var ownProduct = BNB_PRODUCTS[fId];
      var ownCards = bnbAll.filter(i => i.bnbOrigin === fId || i.name === ownProduct.name);
      var boughtCards = bnbAll.filter(i => i.bnbOrigin !== fId && i.name !== ownProduct.name);
      var sold = ownProduct.qty - ownCards.length;
      lines.push(FM[fId].nom + " (" + ownProduct.shortName + "): własnych " + ownCards.length + "/" + ownProduct.qty + " | sprzedano " + sold + " | kupiono " + boughtCards.length);
      if(boughtCards.length > 0) {
        var byType = {};
        boughtCards.forEach(c => { byType[c.name] = (byType[c.name]||0) + 1; });
        Object.entries(byType).forEach(([name, cnt]) => { lines.push("    " + name + ": " + cnt); });
      }
    });
    if(gameState.bnbSettled) {
      lines.push("Rozliczenie z dostawcą: TAK");
    }
  } else { lines.push("BnB nieaktywny"); }
  lines.push("");

  // RELACJE
  lines.push("── RELACJE ──");
  var anyRel = false;
  FO.forEach(rater => {
    if(!relData[rater]) return;
    FO.forEach(rated => {
      if(rater === rated) return;
      var r = relData[rater] && relData[rater][rated];
      if(!r) return;
      anyRel = true;
      var total = (r.partnership || 0) + (r.rules || 0) + (r.communication || 0);
      lines.push("  " + FM[rater].nom + " → " + FM[rated].nom + ": " + total + "/15 (P:" + (r.partnership||0) + " Z:" + (r.rules||0) + " K:" + (r.communication||0) + ")");
    });
  });
  if(!anyRel) lines.push("Brak danych o relacjach");
  lines.push("");

  // MACIERZ HANDLU
  lines.push("── MACIERZ HANDLU ──");
  var txsAll = gameState && gameState.txs ? ensureArray(gameState.txs) : [];
  var acceptedTx = txsAll.filter(t => t && t.status === "accepted" && t.from && t.to && FO.includes(t.from) && FO.includes(t.to));
  if(acceptedTx.length > 0) {
    lines.push("Od \\ Do      | Adams    | Bennet   | Clinton  | Dexter");
    lines.push("─".repeat(65));
    FO.forEach(from => {
      var cells = FO.map(to => {
        if(from === to) return "   –    ";
        var items = 0, cash = 0;
        acceptedTx.forEach(tx => {
          if(tx.from===from && tx.to===to) { items+=ensureArray(tx.offerItems||tx.offeredItems).length; cash+=(tx.offerCash||tx.offeredCash||0); }
          if(tx.to===from && tx.from===to) { items+=ensureArray(tx.requestItems||tx.responseItems).length; cash+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0); }
        });
        if(items===0 && cash===0) return "   –    ";
        return (items>0?items+"k":"")+(items>0&&cash>0?"+":"")+(cash>0?cash+"$":"");
      });
      lines.push(FM[from].nom.padEnd(13) + " | " + cells.map(c=>c.padStart(8)).join(" | "));
    });
  } else { lines.push("Brak zaakceptowanych transakcji"); }
  lines.push("");

  // PEŁNA HISTORIA TRANSAKCJI
  lines.push("── PEŁNA HISTORIA TRANSAKCJI ──");
  var tradeTxAll = txsAll.filter(t => t && (t.type==="sale"||t.type==="barter") && FO.includes(t.from) && FO.includes(t.to));
  if(tradeTxAll.length > 0) {
    tradeTxAll.forEach((tx,idx) => {
      var sL = tx.status==="accepted"?"✓":tx.status==="rejected"?"✗":tx.status==="cancelled"?"⊘":tx.status;
      var tL = tx.type==="sale"?"SPRZEDAŻ":"BARTER";
      var ln2 = "  "+(idx+1)+". "+sL+" "+tL+": "+FM[tx.from].nom+" → "+FM[tx.to].nom;
      var offered = ensureArray(tx.offeredItems||tx.offerItems);
      var oC = tx.offeredCash||tx.offerCash||0;
      if(offered.length||oC) ln2+=" | Oferta: "+(offered.length?offered.length+"k":"")+(offered.length&&oC?"+":"")+(oC?oC+"$":"");
      if(tx.type==="sale"&&tx.price) ln2+=" | Cena: "+tx.price+"$";
      if(tx.type==="barter"){var resp=ensureArray(tx.responseItems||tx.requestItems);var rC=tx.responseCash||tx.requestCash||0;if(resp.length||rC) ln2+=" | Odp: "+(resp.length?resp.length+"k":"")+(resp.length&&rC?"+":"")+(rC?rC+"$":"");}
      lines.push(ln2);
      if(offered.length>0) lines.push("      Karty: "+offered.map(i=>typeof i==="string"?i:(i.name||i.id||"?")).join(", "));
    });
    lines.push("Łącznie: "+tradeTxAll.length+" transakcji handlowych");
  } else { lines.push("Brak transakcji handlowych"); }
  lines.push("");

  // REWOLWEROWIEC
  if(gameState && gameState.revEnabled) {
    lines.push("── REWOLWEROWIEC ──");
    var duels = ensureArray(gameState.revDuels || []);
    if(duels.length > 0) {
      duels.forEach((d,i) => { if(!d) return; lines.push("  Pojedynek " + (i+1) + ": " + (FM[d.challenger]||{}).nom + " vs " + (FM[d.opponent]||{}).nom + " | " + (d.bet||0) + "$ | Zwycięzca: " + ((FM[d.winner]||{}).nom||"?")); });
    } else { lines.push("Brak pojedynków"); }
    lines.push("");
  }

  // KONSULTACJE
  lines.push("── KONSULTACJE Z SZERYFEM ──");
  var calls = gameState ? gameState.sheriffCalls || [] : [];
  if(Array.isArray(calls) && calls.length > 0) {
    var soldCalls = calls.filter(c => c && c.status === "sold");
    lines.push("Sprzedane: " + soldCalls.length + " (" + (soldCalls.length*15) + "$)");
    soldCalls.forEach(c => { lines.push("  " + (FM[c.family||c.fId]||{nom:"?"}).nom + " – " + (c.topic||"")); });
  } else { lines.push("Brak konsultacji"); }
  lines.push("");

  // NOTATKI SZERYFA
  lines.push("── NOTATKI SZERYFA ──");
  var cn = consultNotes || {};
  var anyNotes = false;
  FO.forEach(fId => {
    if(cn[fId] && cn[fId].trim()) {
      anyNotes = true;
      lines.push(FM[fId].nom + ":");
      cn[fId].trim().split("\n").forEach(l => lines.push("  " + l));
    }
  });
  if(!anyNotes) lines.push("Brak notatek");
  lines.push("");

  // ANOMALIE
  lines.push("── ANOMALIE ──");
  var anomalies = eventLog.filter(ev => ev.sev >= SEV.WARN);
  if(anomalies.length > 0) {
    var anomByCat = {};
    anomalies.forEach(ev => { if(!anomByCat[ev.cat]) anomByCat[ev.cat]=[]; anomByCat[ev.cat].push(ev); });
    Object.entries(anomByCat).forEach(([cat, evts]) => {
      lines.push(cat + " (" + evts.length + "):");
      var unique = {}; evts.forEach(ev => { unique[ev.msg]=(unique[ev.msg]||0)+1; });
      Object.entries(unique).forEach(([msg, cnt]) => { lines.push("  " + (cnt>1?"("+cnt+"×) ":"") + msg); });
    });
  } else { lines.push("Brak anomalii"); }
  lines.push("");

  // TIMESTAMPY ETAPÓW
  lines.push("── ETAPY (czas trwania) ──");
  if(cashSnapshots.length > 1) {
    for(var si=1; si<cashSnapshots.length; si++) {
      var sSnap = cashSnapshots[si];
      var pSnap = cashSnapshots[si-1];
      var sId = STAGES[sSnap.stageIdx] ? STAGES[sSnap.stageIdx].id : "?";
      if(sSnap.ts && pSnap.ts) {
        var dur = Math.round((sSnap.ts - pSnap.ts)/1000);
        lines.push("  " + sId.padEnd(8) + dur + "s");
      }
    }
  }
  lines.push("");

  // TREND GOTÓWKI
  lines.push("── TREND GOTÓWKI ──");
  if(cashSnapshots.length > 0) {
    lines.push("Etap    | Adams  | Bennet | Clinton| Dexter | Δ Adams| Δ Benn.| Δ Clin.| Δ Dext.");
    cashSnapshots.forEach((snap, idx) => {
      var id = (STAGES[snap.stageIdx]?.id || "?").padEnd(7);
      var prev = idx > 0 ? cashSnapshots[idx-1].cash : null;
      var deltas = FO.map(f => { if(!prev) return "      "; var d=snap.cash[f]-prev[f]; return (d>=0?"+":"")+String(d).padStart(5); });
      lines.push(id + " | " + FO.map(f => String(snap.cash[f]).padStart(6)).join(" | ") + " | " + deltas.join(" | "));
    });
  }
  lines.push("");

  // POŁĄCZENIA
  lines.push("── POŁĄCZENIA ──");
  FO.forEach(fId => {
    var hist = connHistory[fId] || [];
    var disc = hist.filter(h => h.event === "disconnect").length;
    lines.push(FM[fId].nom + ": " + hist.length + (hist.length===1?" zdarzenie":hist.length>=2&&hist.length<=4?" zdarzenia":" zdarzeń") + ", " + disc + (disc===1?" rozłączenie":disc>=2&&disc<=4?" rozłączenia":" rozłączeń"));
  });
  lines.push("");

  // WERYFIKACJA
  lines.push("── WERYFIKACJA AUTOMATYCZNA ──");
  if(fd) {
    var totalCash = 0, totalItems = 0;
    FO.forEach(fId => { totalCash += fd[fId].cash; totalItems += ensureArray(fd[fId].items).length; });
    lines.push("Suma gotówki: " + totalCash + "$");
    lines.push("Suma kart: " + totalItems);
    if(scores) {
      var ok = true;
      FO.forEach(fId => {
        var sc = scores[fId]; if(!sc) return;
        var recalc = calcScore(fId, fd, {}, gameState.biznesNaBoku||{}, gameState.bnbEnabled, gameState.blindFate||{}, gameState.mapEnabled!==false, gameState.mapBonusClaimed||{});
        if(recalc.bizTotal !== sc.bizTotal) { lines.push("  ⚠ " + FM[fId].nom + ": bizTotal monitor=" + sc.bizTotal + " vs przeliczony=" + recalc.bizTotal); ok=false; }
      });
      if(ok) lines.push("Wyniki: ✅ zgodne z przeliczeniem");
    }
  }
  lines.push("");

  // DZIENNIK
  lines.push("── DZIENNIK (pełny – " + eventLog.length + " wpisów) ──");
  eventLog.forEach(ev => { lines.push("[" + ev.ts + "] " + SEV_LABEL[ev.sev] + " " + ev.cat + ": " + ev.msg); });

  return lines.join("\n");
}

/* ========== RAPORT Z ROZGRYWKI (PDF) ========== */
function generateTrainerReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed) {
  var fd = gameState ? gameState.fd : null;
  var relData = gameState ? gameState.relations || {} : {};
  var lines = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  WSCHÓD DZIKIEGO ZACHODU – RAPORT DLA TRENERA");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("Kod rozgrywki: " + roomCode);
  var meta = (gameState && gameState.meta) || {};
  if(meta.createdAt) lines.push("Data rozgrywki: " + new Date(meta.createdAt).toLocaleDateString("pl"));
  if(meta.client) lines.push("Klient: " + meta.client);
  if(meta.group) lines.push("Grupa: " + meta.group);
  lines.push("");

  // WYNIKI
  lines.push("── WYNIKI ──");
  if(scores && fd) {
    var bestFam = null, bestPts = -999;
    FO.forEach(fId => {
      var relScore = calcRelationScore(fId, relData);
      var total = (scores[fId] ? scores[fId].bizTotal : 0) + relScore;
      if(total > bestPts) { bestPts = total; bestFam = fId; }
    });
    if(bestFam) lines.push("ZWYCIĘZCA: " + FM[bestFam].nom + " (" + Math.round(bestPts) + " pkt)");
    lines.push("");
    FO.forEach(fId => {
      var sc = scores[fId]; if(!sc) return;
      var relScore = calcRelationScore(fId, relData);
      var total = Math.round(sc.bizTotal + relScore);
      lines.push(FM[fId].nom + ": " + total + " pkt");
      lines.push("  Zasoby: " + sc.resScore + "/30 | Kompetencje: " + sc.compScore + "/25 | Działka: " + sc.plotScore + "/10 | Gotówka: " + sc.cashScore + "/25 (" + fd[fId].cash + "$) | Złotodajna Żyła: " + sc.mapScore + "/10" + (sc.bnb>0?" | BnB: "+sc.bnb:"") + " | Relacje: " + relScore + "/20");
    });
  }
  lines.push("");

  // TRANSAKCJE
  lines.push("── TRANSAKCJE ──");
  if(txStats) {
    lines.push("Łącznie: " + txStats.total + " | Zaakceptowane: " + txStats.accepted + " | Odrzucone: " + txStats.rejected);
    if(Object.keys(txStats.pairs).length > 0) {
      lines.push("Per para:");
      Object.entries(txStats.pairs).forEach(([pair, data]) => {
        var parts = pair.split("-");
        if(!FO.includes(parts[0])||!FO.includes(parts[1])) return;
        lines.push("  " + FM[parts[0]].gen + " – " + FM[parts[1]].gen + ": " + data.total + " tx (✓" + data.accepted + " ✗" + data.rejected + ")");
      });
    }
  }
  lines.push("");

  // RELACJE
  lines.push("── RELACJE ──");
  var anyRel = false;
  FO.forEach(rater => {
    if(!relData[rater]) return;
    FO.forEach(rated => {
      if(rater===rated) return;
      var r = relData[rater]&&relData[rater][rated]; if(!r) return;
      anyRel = true;
      var total = (r.partnership||0)+(r.rules||0)+(r.communication||0);
      lines.push("  " + FM[rater].nom + " → " + FM[rated].nom + ": " + total + "/15 (partnerstwo:" + (r.partnership||0) + " zasady:" + (r.rules||0) + " komunikacja:" + (r.communication||0) + ")");
    });
  });
  if(!anyRel) lines.push("Brak danych o relacjach");
  lines.push("");

  // ŚLEPY LOS
  lines.push("── ŚLEPY LOS ──");
  var bfData = gameState ? gameState.blindFate || {} : {};
  var anyFate = false;
  FO.forEach(fId => {
    var bf=bfData[fId]; if(!bf||!bf.rolls) return;
    var rolls=ensureArray(bf.rolls).filter(r=>r&&r.resolved); if(rolls.length===0) return;
    anyFate = true;
    lines.push(FM[fId].nom + ":");
    rolls.forEach(r => {
      var ev=r.event||{};
      var effectText = r.netEffectText || (ev.amount?(ev.amount>0?"+":"")+ev.amount+"$":"brak efektu");
      lines.push("  🎲 " + (r.sum||"?") + " – " + (ev.text||"–") + " → " + effectText);
    });
  });
  if(!anyFate) lines.push("Brak rzutów");
  lines.push("");

  // BnB
  if(gameState && gameState.bnbEnabled) {
    lines.push("── BIZNES NA BOKU ──");
    if(fd) FO.forEach(fId => {
      var items=ensureArray(fd[fId].items);
      var bnbAll=items.filter(i=>i.cat===C_BNB);
      var ownProduct=BNB_PRODUCTS[fId];
      var sold=ownProduct.qty-bnbAll.filter(i=>i.bnbOrigin===fId||i.name===ownProduct.name).length;
      var bought=bnbAll.filter(i=>i.bnbOrigin!==fId&&i.name!==ownProduct.name).length;
      lines.push("  " + FM[fId].nom + ": sprzedano " + sold + "/" + ownProduct.qty + " " + ownProduct.shortName + ", kupiono " + bought + " od innych");
    });
    lines.push("");
  }

  // MACIERZ HANDLU
  lines.push("── MACIERZ HANDLU ──");
  var txsAll = gameState&&gameState.txs ? ensureArray(gameState.txs) : [];
  var acceptedTx = txsAll.filter(t=>t&&t.status==="accepted"&&t.from&&t.to&&FO.includes(t.from)&&FO.includes(t.to));
  if(acceptedTx.length > 0) {
    lines.push("Od \\ Do      | Adams    | Bennet   | Clinton  | Dexter");
    lines.push("─".repeat(65));
    FO.forEach(from => {
      var cells=FO.map(to => {
        if(from===to) return "   –    ";
        var items=0,cash=0;
        acceptedTx.forEach(tx => {
          if(tx.from===from&&tx.to===to){items+=ensureArray(tx.offerItems||tx.offeredItems).length;cash+=(tx.offerCash||tx.offeredCash||0);}
          if(tx.to===from&&tx.from===to){items+=ensureArray(tx.requestItems||tx.responseItems).length;cash+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0);}
        });
        if(items===0&&cash===0) return "   –    ";
        return (items>0?items+"k":"")+(items>0&&cash>0?"+":"")+(cash>0?cash+"$":"");
      });
      lines.push(FM[from].nom.padEnd(13)+" | "+cells.map(c=>c.padStart(8)).join(" | "));
    });
  } else { lines.push("Brak zaakceptowanych transakcji"); }
  lines.push("");

  // REWOLWEROWIEC
  if(gameState && gameState.revEnabled) {
    lines.push("── REWOLWEROWIEC ──");
    var duels=ensureArray(gameState.revDuels||[]);
    if(duels.length>0) { duels.forEach((d,i)=>{if(!d)return;lines.push("  Pojedynek "+(i+1)+": "+(FM[d.challenger]||{}).nom+" vs "+(FM[d.opponent]||{}).nom+" | "+(d.bet||0)+"$ | Zwycięzca: "+((FM[d.winner]||{}).nom||"?"));}); }
    else { lines.push("Brak pojedynków"); }
    lines.push("");
  }

  return lines.join("\n");
}

/* ========== PDF TRAINER REPORT ========== */
async function generateTrainerPDF(data) {
  var doc = new jsPDF({orientation: "portrait", unit: "mm", format: "a4"});
  var ML = 20, MR = 20, MT = 20, PW = 210 - 40, PAGE_H = 297, FOOTER_Y = 282, Y = MT;
  var COL = {
    primary:[132,37,4], dark:[76,19,15], gold:[212,168,83], text:[44,24,16],
    textDim:[107,90,74], white:[255,255,255], bg:[245,240,232], line:[212,196,168],
    green:[46,91,60], red:[192,64,48],
    families:{adams:[167,95,74],bennet:[114,96,114],clinton:[94,89,113],dexter:[91,118,116]}
  };
  var fontLoaded = false;
  try {
    var fontBase = (data.imgBase||"img/").replace(/img\/$/, "fonts/");
    var resps = await Promise.all([fetch(fontBase+"alegreya-sans-400.ttf"),fetch(fontBase+"alegreya-sans-500.ttf")]);
    if(resps[0].ok && resps[1].ok){
      var bufs = await Promise.all(resps.map(function(r){return r.arrayBuffer();}));
      function ab2b64(buf){var bytes=new Uint8Array(buf),bin="",len=bytes.byteLength;for(var i=0;i<len;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin);}
      doc.addFileToVFS("AS-Reg.ttf",ab2b64(bufs[0]));doc.addFileToVFS("AS-Med.ttf",ab2b64(bufs[1]));
      doc.addFont("AS-Reg.ttf","AlegreyaSans","normal");doc.addFont("AS-Med.ttf","AlegreyaSans","bold");
      fontLoaded=true;
    }
  } catch(e){console.warn("[WDZ PDF] Font fallback:",e);}
  var FONT = fontLoaded ? "AlegreyaSans" : "helvetica";
  var ARROW = fontLoaded ? "\u2192" : " > ";
  function setF(style,size){doc.setFont(FONT,style||"normal");doc.setFontSize(size||11);}
  function setC(c){doc.setTextColor(c[0],c[1],c[2]);}
  function chk(n){if(Y+n>FOOTER_Y){doc.addPage();Y=MT;}}
  function hd(text){chk(14);Y+=4;setF("bold",13);setC(COL.primary);doc.text(text,ML,Y);Y+=2;doc.setDrawColor(COL.gold[0],COL.gold[1],COL.gold[2]);doc.setLineWidth(0.5);doc.line(ML,Y,ML+PW,Y);Y+=6;}
  function bt(text,opts){opts=opts||{};setF(opts.style||"normal",opts.size||11);setC(opts.color||COL.text);var ls=doc.splitTextToSize(text,opts.maxW||PW);chk(ls.length*5);doc.text(ls,opts.x||ML,Y);Y+=ls.length*5;}
  var rc=data.roomCode||"?",meta=data.meta||{},fd=data.fd||{},scores=data.scores||{},relScores=data.relScores||{},totals=data.totals||{},txs=data.txs||[],rels=data.relations||{},bf=data.blindFate||{},revDuels=data.revDuels||[];
  var ranked=FO.slice().sort(function(a,b){return(totals[b]||0)-(totals[a]||0);});
  try{var lr=await fetch((data.imgBase||"img/")+"alegra_logotyp_kolorowy.png");if(lr.ok){var lb=await lr.blob();var l64=await new Promise(function(res){var rd=new FileReader();rd.onload=function(){res(rd.result);};rd.readAsDataURL(lb);});doc.addImage(l64,"PNG",ML,Y,40,0);Y+=18;}}catch(e){}
  setF("bold",20);setC(COL.dark);doc.text("Wschód Dzikiego Zachodu",ML,Y);Y+=6;
  setF("normal",11);setC(COL.textDim);doc.text("Raport z rozgrywki",ML,Y);Y+=10;
  doc.setDrawColor(COL.line[0],COL.line[1],COL.line[2]);doc.setFillColor(COL.bg[0],COL.bg[1],COL.bg[2]);
  var infoArr=["Kod: "+rc];if(meta.createdAt)infoArr.push("Data: "+new Date(meta.createdAt).toLocaleDateString("pl"));
  var infoArr2=[];if(meta.client)infoArr2.push("Klient: "+meta.client);if(meta.group)infoArr2.push("Grupa: "+meta.group);
  var boxH=infoArr2.length?18:12;doc.roundedRect(ML,Y,PW,boxH,2,2,"FD");
  setF("normal",11);setC(COL.text);doc.text(infoArr.join("     |     "),ML+4,Y+5);
  if(infoArr2.length)doc.text(infoArr2.join("     |     "),ML+4,Y+11);
  Y+=boxH+8;
  hd("Wyniki");
  if(ranked.length>0){setF("bold",12);setC(COL.green);doc.text("Zwycięzca: "+FM[ranked[0]].nom+" – "+Math.round(totals[ranked[0]]||0)+" pkt",ML,Y);Y+=8;}
  var rH=[["","Wynik","Zasoby\n/30","Kompetencje\n/25","Działka\n/10","Gotówka\n/25","Żyła\n/10","BnB","Relacje\n/20"]];
  var rR=ranked.map(function(f){var s=scores[f]||{};return[FM[f].nom,Math.round(totals[f]||0)+" pkt",s.resScore+" ("+(s.resPct||0)+"%)",s.compScore+" ("+(s.compPct||0)+"%)",s.plotScore||0,s.cashScore+" ("+(s.cash||0)+"$)",s.mapScore||0,s.bnb||0,relScores[f]||0];});
  doc.autoTable({startY:Y,head:rH,body:rR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:8},columnStyles:{0:{halign:"left",fontStyle:"bold"},1:{fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===0){var f=ranked[d2.row.index];if(f&&COL.families[f])d2.cell.styles.textColor=COL.families[f];}}});
  Y=doc.lastAutoTable.finalY+8;
  hd("Macierz handlu");
  var tradeTx=txs.filter(function(t){return t&&t.status==="accepted"&&FO.includes(t.from)&&FO.includes(t.to)&&(t.type==="sale"||t.type==="barter");});
  if(tradeTx.length>0){var mH=[["Od \\ Do"].concat(FO.map(function(f){return FM[f].nom;}))];var mR=FO.map(function(from){var cells=FO.map(function(to){if(from===to)return"–";var it=0,ca=0;tradeTx.forEach(function(tx){if(tx.from===from&&tx.to===to){it+=(tx.offeredItems||tx.offerItems||[]).length;ca+=(tx.offeredCash||tx.offerCash||0);}if(tx.to===from&&tx.from===to){it+=(tx.requestItems||tx.responseItems||[]).length;ca+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0);}});if(it===0&&ca===0)return"–";return(it>0?it+"k":"")+(it>0&&ca>0?" + ":"")+(ca>0?ca+"$":"");});return[FM[from].nom].concat(cells);});doc.autoTable({startY:Y,head:mH,body:mR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:9},columnStyles:{0:{halign:"left",fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]}});Y=doc.lastAutoTable.finalY+4;bt("Legenda: k = liczba kart, $ = gotówka przekazana w transakcji",{size:8,color:COL.textDim});}else{bt("Brak zaakceptowanych transakcji.");}
  Y+=4;
  hd("Statystyki transakcji");
  var ps={};txs.forEach(function(t){if(!t||!t.from||!t.to||!FO.includes(t.from)||!FO.includes(t.to))return;if(t.type!=="sale"&&t.type!=="barter")return;var k=[t.from,t.to].sort().join("-");if(!ps[k])ps[k]={a:0,r:0};if(t.status==="accepted")ps[k].a++;else if(t.status==="rejected")ps[k].r++;});
  var pk=Object.keys(ps);
  if(pk.length>0){var pH=[["Para","Zaakceptowane","Odrzucone","Łącznie"]];var pR=pk.map(function(k){var p=k.split("-"),d=ps[k];return[FM[p[0]].nom+" – "+FM[p[1]].nom,d.a,d.r,d.a+d.r];});var ta=pk.reduce(function(s,k){return s+ps[k].a;},0),tr2=pk.reduce(function(s,k){return s+ps[k].r;},0);pR.push(["RAZEM",ta,tr2,ta+tr2]);doc.autoTable({startY:Y,head:pH,body:pR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.row.index===pR.length-1)d2.cell.styles.fontStyle="bold";}});Y=doc.lastAutoTable.finalY+8;}else{bt("Brak transakcji.");Y+=4;}
  hd("Relacje");
  var anyRel=false;FO.forEach(function(rater){if(rels[rater])FO.forEach(function(rated){if(rater!==rated&&rels[rater][rated])anyRel=true;});});
  if(anyRel){var rlH=[["Od rodziny "+ARROW+"Dla rodziny","Partnerstwo","Zasady","Komunikacja","Suma /15"]];var rlR=[];FO.forEach(function(rater){FO.forEach(function(rated){if(rater===rated)return;var r=rels[rater]&&rels[rater][rated];if(!r)return;var tot=(r.partnership||0)+(r.rules||0)+(r.communication||0);rlR.push([FM[rater].nom+" "+ARROW+" "+FM[rated].nom,r.partnership||0,r.rules||0,r.communication||0,tot]);});});doc.autoTable({startY:Y,head:rlH,body:rlR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});Y=doc.lastAutoTable.finalY+8;}else{bt("Brak danych o relacjach.");Y+=4;}
  hd("Ślepy Los");
  var anyFate=false;FO.forEach(function(fId){var bfd=bf[fId];if(!bfd||!bfd.rolls)return;var rolls=ensureArray(bfd.rolls).filter(function(r){return r&&r.resolved;});if(!rolls.length)return;anyFate=true;chk(12+rolls.length*6);setF("bold",10);setC(COL.families[fId]||COL.text);doc.text(FM[fId].nom+":",ML,Y);Y+=5;rolls.forEach(function(r){var ev=r.event||{};var eff=r.netEffectText||(ev.amount?(ev.amount>0?"+":"")+ev.amount+" $":"brak efektu");setF("normal",10);setC(COL.text);var ln="    Wynik "+(r.sum||"?")+" – "+(ev.text||"–")+" → "+eff;var wr=doc.splitTextToSize(ln,PW-8);doc.text(wr,ML+4,Y);Y+=wr.length*4.5;});Y+=3;});
  if(!anyFate){bt("Brak rzutów.");Y+=4;}
  if(data.bnbEnabled&&fd){hd("Biznes na Boku");var bH=[["Rodzina","Produkt","Sprzedano","Kupiono od innych"]];var bR=FO.map(function(fId){var items=ensureArray((fd[fId]||{}).items);var bnbAll=items.filter(function(i){return i.cat===C_BNB;});var prod=BNB_PRODUCTS[fId];var ownLeft=bnbAll.filter(function(i){return i.bnbOrigin===fId||i.name===prod.name;}).length;var sold=prod.qty-ownLeft;var bought=bnbAll.filter(function(i){return i.bnbOrigin!==fId&&i.name!==prod.name;}).length;return[FM[fId].nom,prod.shortName,sold+"/"+prod.qty,bought];});doc.autoTable({startY:Y,head:bH,body:bR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"},1:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});Y=doc.lastAutoTable.finalY+8;}
  if(data.mapEnabled&&fd){hd("Złotodajna Żyła");var mbc=data.mapBonusClaimed||{};var mw=null;FO.forEach(function(f){if(mbc[f])mw=f;});var zpH=[["Rodzina","Fragmenty mapy","Bonus pkt","Rozliczenie"]];var zpR=FO.map(function(fId){var items=ensureArray((fd[fId]||{}).items);var fs2={};items.forEach(function(i){if(i.cat===C_MAP)fs2[i.fragNr]=true;});var cnt=Object.keys(fs2).length;var sc=scores[fId]||{};var sett=mw===fId?"+300 $":(mw?"-100 $":"0 $");return[FM[fId].nom,cnt+"/4",sc.mapScore+"/10",sett];});doc.autoTable({startY:Y,head:zpH,body:zpR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===3){var v=d2.cell.raw;if(v&&v.includes("+"))d2.cell.styles.textColor=COL.green;else if(v&&v.includes("-"))d2.cell.styles.textColor=COL.red;}}});Y=doc.lastAutoTable.finalY+4;if(mw)bt("Zwycięzca wyścigu: "+FM[mw].nom+" (premia 300 $, pozostali wpłacają 100 $)",{style:"bold",size:10});else bt("Brak zwycięzcy wyścigu \u2013 nikt nie zebrał kompletnej mapy lub remis.",{size:10,color:COL.textDim});Y+=4;}
  if(data.revEnabled&&revDuels.length>0){hd("Rewolwerowiec");var rvH=[["Nr","Wyzywający","Przeciwnik","Stawka","Zwycięzca"]];var rvR=revDuels.filter(function(d){return d;}).map(function(d,i){return[i+1,(FM[d.challenger]||{}).nom||"?",(FM[d.opponent]||{}).nom||"?",(d.bet||0)+" $",(FM[d.winner]||{}).nom||"?"];});doc.autoTable({startY:Y,head:rvH,body:rvR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},alternateRowStyles:{fillColor:[250,245,238]}});Y=doc.lastAutoTable.finalY+8;}
  var tp=doc.internal.getNumberOfPages();for(var p=1;p<=tp;p++){doc.setPage(p);setF("normal",8);setC(COL.textDim);doc.text("Strona "+p+" / "+tp,210-MR,FOOTER_Y+5,{align:"right"});doc.text("aleGRA Twórczy Rozwój – Wschód Dzikiego Zachodu© Online",105,FOOTER_Y+5,{align:"center"});}
  var ds=meta.createdAt?new Date(meta.createdAt).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  doc.save("wdz-raport-"+rc+"-"+ds+".pdf");
}

function downloadReport(text, roomCode, suffix) {
  var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "wdz-" + (suffix || "monitor") + "-" + roomCode + "-" + new Date().toISOString().slice(0,10) + ".txt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========== MAIN APP ========== */
function MonitorApp() {
  const [roomCode, setRoomCode] = React.useState("");
  const [inputCode, setInputCode] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [gameState, setGameState] = React.useState(null);
  const [players, setPlayers] = React.useState(null);
  const [eventLog, setEventLog] = React.useState([]);
  const [lastUpdate, setLastUpdate] = React.useState(null);
  const [updateCount, setUpdateCount] = React.useState(0);
  const prevStateRef = React.useRef(null);
  const listenersRef = React.useRef([]);
  // v0.2.0 additions
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [logFilter, setLogFilter] = React.useState("all"); // "all"|"warn"|"error"
  const [connHistory, setConnHistory] = React.useState({}); // {fId: [{ts, event:"connect"|"disconnect"}]}
  const prevPlayersRef = React.useRef(null);
  const [connectedAt, setConnectedAt] = React.useState(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [cashSnapshots, setCashSnapshots] = React.useState([]); // [{stageIdx, ts, cash:{adams:N,...}}]
  const pendingFirstSeen = React.useRef({}); // {txId: timestamp} – track when we first see a pending tx
  const [reactionTimes, setReactionTimes] = React.useState([]); // [{txId, from, to, duration, result}]
  const [txByPhase, setTxByPhase] = React.useState({1:0,2:0,3:0});
  const lastTxCount = React.useRef(0);

  function getPhase(idx) {
    if(idx==null) return 0;
    if(idx>=1&&idx<=6) return 1;
    if(idx>=7&&idx<=12) return 2;
    if(idx>=13) return 3;
    return 0;
  }

  // Cleanup listeners on disconnect
  function disconnectAll() {
    listenersRef.current.forEach(({ref, cb}) => ref.off("value", cb));
    listenersRef.current = [];
    setConnected(false);
    setGameState(null);
    setPlayers(null);
    setConnHistory({});
    setCashSnapshots([]);
    prevPlayersRef.current = null;
    addEvent(SEV.INFO, "SYSTEM", "Rozłączono z rozgrywką " + roomCode);
  }

  function addEvent(sev, cat, msg) {
    setEventLog(prev => [{ts:ts(), sev, cat, msg, key:Date.now()+Math.random()}, ...prev].slice(0, 500));
  }

  // Session elapsed timer
  React.useEffect(() => {
    if(!connectedAt) return;
    var iv = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [connectedAt]);

  // Connection tracking – detect connect/disconnect per family + sheriff
  React.useEffect(() => {
    if(!players) return;
    var prev = prevPlayersRef.current;
    prevPlayersRef.current = JSON.parse(JSON.stringify(players));
    if(!prev) return;

    // Sheriff
    var sheriffNow = players.sheriff && players.sheriff.connected;
    var sheriffPrev = prev.sheriff && prev.sheriff.connected;
    if(sheriffNow && !sheriffPrev) addEvent(SEV.INFO, "POŁĄCZENIE", "Szeryf ponownie online");
    if(!sheriffNow && sheriffPrev) addEvent(SEV.WARN, "POŁĄCZENIE", "Szeryf rozłączony");

    // Families
    FO.forEach(fId => {
      var nowMembers = (players[fId] && players[fId].members) ? Object.keys(players[fId].members).length : 0;
      var prevMembers = (prev[fId] && prev[fId].members) ? Object.keys(prev[fId].members).length : 0;
      if(nowMembers > 0 && prevMembers === 0) {
        addEvent(SEV.INFO, "POŁĄCZENIE", FM[fId].nom + " – gracze online (" + nowMembers + ")");
        setConnHistory(h => {var n={...h}; if(!n[fId])n[fId]=[]; n[fId]=[...n[fId],{ts:Date.now(),event:"connect"}]; return n;});
      }
      if(nowMembers === 0 && prevMembers > 0) {
        addEvent(SEV.WARN, "POŁĄCZENIE", FM[fId].nom + " – wszyscy gracze offline");
        setConnHistory(h => {var n={...h}; if(!n[fId])n[fId]=[]; n[fId]=[...n[fId],{ts:Date.now(),event:"disconnect"}]; return n;});
      }
      if(nowMembers > 0 && prevMembers > 0 && nowMembers !== prevMembers) {
        addEvent(SEV.INFO, "POŁĄCZENIE", FM[fId].nom + " – zmiana: " + prevMembers + " → " + nowMembers + " graczy");
      }
    });
  }, [players]);

  // Cash snapshots on stage change – forward-only, no undefined stages
  React.useEffect(() => {
    if(!gameState || !gameState.fd || gameState.stageIdx == null || gameState.stageIdx === undefined) return;
    var fd = gameState.fd;
    var cash = {};
    FO.forEach(fId => { cash[fId] = fd[fId] ? fd[fId].cash : 0; });
    setCashSnapshots(prev => {
      if(prev.length > 0 && prev[prev.length - 1].stageIdx >= gameState.stageIdx) return prev;
      return [...prev, {stageIdx: gameState.stageIdx, ts: Date.now(), cash}];
    });
  }, [gameState && gameState.stageIdx]);

  function handleConnect() {
    var code = inputCode.trim().toUpperCase();
    if(!/^WDZ-[A-HJ-NP-Z2-9]{4,6}$/.test(code)) {
      setError("Nieprawidłowy format kodu (WDZ-XXXX lub WDZ-XXXXXX)");
      return;
    }
    if(!db) { setError("Brak połączenia z Firebase"); return; }
    setError(null);

    // Check if room exists
    db.ref("rooms/" + code + "/meta").once("value").then(snap => {
      if(!snap.exists()) {
        setError("Rozgrywka " + code + " nie istnieje");
        return;
      }
      setRoomCode(code);
      setConnected(true);
      setConnectedAt(Date.now());
      addEvent(SEV.INFO, "SYSTEM", "Podłączono do rozgrywki " + code);

      // Listen to gameState (read-only)
      var gsRef = db.ref("rooms/" + code + "/gameState");
      var gsCb = gsRef.on("value", snap => {
        var s = snap.val();
        if(!s) return;
        // Fix fd from Firebase
        if(s.fd) s.fd = fixFdFromFirebase(s.fd);
        if(s.txs) s.txs = ensureArray(s.txs);
        setGameState(prev => {
          prevStateRef.current = prev;
          return s;
        });
        setLastUpdate(new Date());
        setUpdateCount(c => c + 1);
      });
      listenersRef.current.push({ref:gsRef, cb:gsCb});

      // Listen to players (read-only)
      var plRef = db.ref("rooms/" + code + "/players");
      var plCb = plRef.on("value", snap => {
        setPlayers(snap.val() || {});
      });
      listenersRef.current.push({ref:plRef, cb:plCb});
    }).catch(e => {
      setError("Błąd połączenia: " + e.message);
    });
  }

  // Run checks + change detection whenever gameState or players change
  React.useEffect(() => {
    if(!gameState) return;
    // Anomaly checks
    var checks = runChecks(gameState, players, prevStateRef.current);
    var hasError = false;
    checks.forEach(ev => {
      if(ev.sev !== SEV.INFO) {
        addEvent(ev.sev, ev.cat, ev.msg);
        if(ev.sev === SEV.ERROR) hasError = true;
      }
    });
    // Sound alert on error
    if(hasError && soundEnabled) playAlertBeep();
    // Change detection
    if(prevStateRef.current) {
      var changes = detectChanges(gameState, prevStateRef.current);
      changes.forEach(ev => addEvent(ev.sev, ev.cat, ev.msg));
    }
    // Reaction time tracking – track pending→resolved transitions
    var txs = gameState.txs ? ensureArray(gameState.txs) : [];
    var now = Date.now();
    // Phase-based transaction counting
    var curTxCount = txs.length;
    if(curTxCount > lastTxCount.current && gameState.stageIdx != null) {
      var newTx = curTxCount - lastTxCount.current;
      var phase = getPhase(gameState.stageIdx);
      if(phase > 0) setTxByPhase(prev => ({...prev, [phase]: prev[phase] + newTx}));
    }
    lastTxCount.current = curTxCount;
    txs.forEach(tx => {
      if(!tx.id) return;
      if(tx.status === "pending" || tx.status === "awaiting_response") {
        if(!pendingFirstSeen.current[tx.id]) pendingFirstSeen.current[tx.id] = now;
      }
      if((tx.status === "accepted" || tx.status === "rejected") && pendingFirstSeen.current[tx.id]) {
        var dur = (now - pendingFirstSeen.current[tx.id]) / 1000;
        delete pendingFirstSeen.current[tx.id];
        if(dur > 0.5) { // ignore sub-second (same update batch)
          setReactionTimes(prev => [...prev, {txId:tx.id, from:tx.from, to:tx.to, duration:Math.round(dur), result:tx.status}].slice(-100));
        }
      }
      if(tx.status === "cancelled" && pendingFirstSeen.current[tx.id]) {
        delete pendingFirstSeen.current[tx.id];
      }
    });
  }, [gameState, players]);

  // Current checks for display
  var currentChecks = React.useMemo(() => {
    if(!gameState) return [];
    return runChecks(gameState, players, prevStateRef.current);
  }, [gameState, players]);

  var txStats = React.useMemo(() => {
    if(!gameState || !gameState.txs) return null;
    return calcTxStats(ensureArray(gameState.txs));
  }, [gameState]);

  // Scores per family
  var scores = React.useMemo(() => {
    if(!gameState || !gameState.fd) return null;
    var fd = gameState.fd;
    var sc = {};
    FO.forEach(fId => {
      sc[fId] = monCalcScore(fId, fd, gameState.biznesNaBoku || {}, gameState.bnbEnabled, gameState.blindFate || {}, gameState.mapEnabled!==false, gameState.mapBonusClaimed || {});
    });
    return sc;
  }, [gameState]);

  // Filtered event log
  var filteredLog = React.useMemo(() => {
    if(logFilter === "all") return eventLog;
    if(logFilter === "warn") return eventLog.filter(e => e.sev === SEV.WARN || e.sev === SEV.ERROR);
    if(logFilter === "error") return eventLog.filter(e => e.sev === SEV.ERROR);
    return eventLog;
  }, [eventLog, logFilter]);

  // Phase breakdown – from monitor's own tracking
  var phaseStats = React.useMemo(() => {
    return {1:{total:txByPhase[1]},2:{total:txByPhase[2]},3:{total:txByPhase[3]}};
  }, [txByPhase]);

  // Reaction time stats
  var reactionStats = React.useMemo(() => {
    if(reactionTimes.length === 0) return null;
    var accepted = reactionTimes.filter(r => r.result === "accepted");
    var rejected = reactionTimes.filter(r => r.result === "rejected");
    var avgAll = reactionTimes.reduce((s, r) => s + r.duration, 0) / reactionTimes.length;
    var avgAcc = accepted.length > 0 ? accepted.reduce((s, r) => s + r.duration, 0) / accepted.length : 0;
    var avgRej = rejected.length > 0 ? rejected.reduce((s, r) => s + r.duration, 0) / rejected.length : 0;
    var maxTime = Math.max(...reactionTimes.map(r => r.duration));
    return {total:reactionTimes.length, avgAll:Math.round(avgAll), avgAcc:Math.round(avgAcc), avgRej:Math.round(avgRej), maxTime:Math.round(maxTime), accepted:accepted.length, rejected:rejected.length};
  }, [reactionTimes]);

  // Current stage info
  var curStage = gameState && gameState.stageIdx != null ? STAGES[gameState.stageIdx] : null;
  var elapsedStr = elapsed > 0 ? Math.floor(elapsed/3600) + ":" + String(Math.floor((elapsed%3600)/60)).padStart(2,"0") + ":" + String(elapsed%60).padStart(2,"0") : "0:00:00";

  // Styles
  var S = {
    page: {minHeight:"100vh", padding:20, maxWidth:1200, margin:"0 auto"},
    header: {display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, borderBottom:"2px solid #842504", paddingBottom:16},
    title: {fontSize:28, color:"#D4A853", letterSpacing:1, fontFamily:"'Alegreya Sans',sans-serif", fontWeight:700},
    badge: {fontSize:12, color:"#A89070", background:"#2C1810", padding:"4px 10px", borderRadius:4, border:"1px solid #3C2820"},
    connectBox: {background:"#2C1810", border:"1px solid #842504", borderRadius:8, padding:24, maxWidth:500, margin:"60px auto", textAlign:"center"},
    input: {background:"#1A0E08", border:"1px solid #5C3A2A", borderRadius:4, color:"#F5F0E8", padding:"10px 14px", fontSize:16, fontFamily:"'Alegreya Sans',sans-serif", width:"100%", marginBottom:12, textAlign:"center", letterSpacing:2},
    btn: {background:"#842504", color:"#F5F0E8", border:"none", borderRadius:4, padding:"10px 24px", fontSize:15, fontFamily:"'Alegreya Sans',sans-serif", fontWeight:700, cursor:"pointer", letterSpacing:1},
    btnSmall: {background:"#3C2820", color:"#D4A853", border:"1px solid #5C3A2A", borderRadius:4, padding:"6px 14px", fontSize:13, fontFamily:"'Alegreya Sans',sans-serif", cursor:"pointer"},
    grid: {display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20},
    card: {background:"#2C1810", border:"1px solid #3C2820", borderRadius:8, padding:16},
    cardTitle: {fontSize:15, fontWeight:700, color:"#D4A853", marginBottom:10, letterSpacing:0.5},
    familyRow: {display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #231810"},
    familyDot: (col, online) => ({width:10, height:10, borderRadius:"50%", background:online?col:"#4A3A30", border:"2px solid "+(online?col:"#5C4A40"), flexShrink:0}),
    feedItem: (sev) => ({display:"flex", gap:10, padding:"8px 12px", marginBottom:2, background:SEV_BG[sev], borderRadius:4, borderLeft:"3px solid "+SEV_COLOR[sev], fontSize:13}),
    feedTs: {color:"#7A6A5A", fontFamily:"monospace", fontSize:12, flexShrink:0, minWidth:65},
    feedCat: (sev) => ({color:SEV_COLOR[sev], fontWeight:700, fontSize:11, letterSpacing:0.5, flexShrink:0, minWidth:90}),
    feedMsg: {color:"#D0C8B8", flex:1},
    statusDot: (ok) => ({display:"inline-block", width:8, height:8, borderRadius:"50%", background:ok?"#6B8E6B":"#C04030", marginRight:6}),
    statNum: {fontSize:22, fontWeight:900, color:"#D4A853", lineHeight:1},
    statLabel: {fontSize:11, color:"#8A7A6A", letterSpacing:0.5},
  };

  /* ========== CONNECT SCREEN ========== */
  if(!connected) {
    return (
      <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"linear-gradient(135deg,#4C130F 0%,#300904 50%,#4C130F 100%)", padding:20}}>
        <div style={{maxWidth:560, width:"100%"}}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16}}>
            <img src="https://kkondracki-jpg.github.io/wdz-online/img/alegra_logotyp.png" alt="aleGRA" style={{height:120, width:"auto"}}/>
            <div style={{marginTop:22, textAlign:"center"}}>
              <div style={{fontSize:32, fontWeight:900, color:"#D4A853", letterSpacing:1, fontFamily:"'Alegreya Sans',sans-serif", lineHeight:1.1}}>Wschód Dzikiego Zachodu<sup style={{fontSize:16,fontWeight:400}}>©</sup> Online</div>
              <div style={{fontSize:14, color:"#C4B090", marginTop:2}}>Monitor diagnostyczny</div>
            </div>
            <div style={{fontSize:13, color:"#8B7355", marginTop:10}}>v{VERSION}</div>
          </div>
          <div style={{background:"#FDFAF4", border:"1px solid #D4C4A8", borderRadius:8, padding:24, maxWidth:500, margin:"40px auto", textAlign:"center"}}>
            <div style={{fontSize:20, fontWeight:700, color:"#2C1810", marginBottom:16, fontFamily:"'Alegreya Sans',sans-serif"}}>Podłącz się do rozgrywki</div>
            <input
              style={{background:"#fff", border:"1px solid #D4C4A8", borderRadius:4, color:"#2C1810", padding:"10px 14px", fontSize:16, fontFamily:"monospace", width:"100%", marginBottom:12, textAlign:"center", letterSpacing:3, outline:"none"}}
              placeholder="WDZ-XXXXXX"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleConnect()}
            />
            {error && <div style={{background:"#FEE", border:"1px solid #C88", borderRadius:4, padding:"8px 12px", color:"#8B2500", fontSize:13, marginBottom:12}}>{error}</div>}
            <button style={S.btn} onClick={handleConnect}>Podłącz</button>
            <div style={{fontSize:12, color:"#8B7355", marginTop:16}}>
              Monitor łączy się w trybie read-only – nie wpływa na stan gry.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========== MAIN DASHBOARD ========== */
  var errorCount = currentChecks.filter(c => c.sev === SEV.ERROR).length;
  var warnCount = currentChecks.filter(c => c.sev === SEV.WARN).length;
  var allGood = errorCount === 0 && warnCount === 0;

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex", alignItems:"center", gap:16}}>
          <div style={S.title}>WDZ Monitor</div>
          <span style={S.badge}>{roomCode}</span>
          {curStage && <span style={S.badge}>{curStage.label}</span>}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{fontSize:12, color:"#6A5A4A", textAlign:"right"}}>
            <div>Sesja: {elapsedStr}</div>
            <div>Odebrano: {updateCount} aktualizacji</div>
          </div>
          <button style={{...S.btnSmall, color:soundEnabled?"#8BC88B":"#7A6A5A"}} onClick={() => setSoundEnabled(s => !s)} title="Alert dźwiękowy">
            {soundEnabled ? "🔔" : "🔇"}
          </button>
          <button style={{...S.btnSmall}} onClick={() => {
            try {
              var report = generateReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed);
              if(!report || report.trim().length === 0) { alert("Raport jest pusty – brak danych do eksportu."); return; }
              downloadReport(report, roomCode, "diagnostyczny");
            } catch(e) { alert("Błąd generowania raportu: " + e.message); console.error("generateReport error:", e); }
          }} title="Raport diagnostyczny">📋</button>
          <button style={S.btnSmall} onClick={() => {
            if(!gameState || !gameState.fd) { alert("Brak danych rozgrywki."); return; }
            var fd = gameState.fd;
            var sc = {}, relSc = {}, tot = {};
            FO.forEach(fId => {
              sc[fId] = monCalcScore(fId, fd, gameState.biznesNaBoku||{}, gameState.bnbEnabled, gameState.blindFate||{}, gameState.mapEnabled!==false, gameState.mapBonusClaimed||{});
              relSc[fId] = calcRelationScore(fId, gameState.relations||{});
              tot[fId] = Math.round(sc[fId].bizTotal + relSc[fId]);
            });
            Promise.all([
              db.ref("rooms/"+roomCode+"/sessionInfo").once("value").then(s=>s.val()||{}).catch(()=>({})),
              db.ref("rooms/"+roomCode+"/meta").once("value").then(s=>s.val()||{}).catch(()=>({}))
            ]).then(([si,mt]) => {
              generateTrainerPDF({
                roomCode:roomCode, imgBase:"img/",
                meta:{createdAt:mt.createdAt||mt.created||Date.now(),client:si.klient||"",group:si.grupa||""},
                fd:fd, scores:sc, relScores:relSc, totals:tot,
                txs:ensureArray(gameState.txs), relations:gameState.relations||{},
                blindFate:gameState.blindFate||{},
                bnbEnabled:!!gameState.bnbEnabled, mapEnabled:gameState.mapEnabled!==false,
                revEnabled:!!gameState.revEnabled,
                mapBonusClaimed:gameState.mapBonusClaimed||{},
                revDuels:ensureArray(gameState.revDuels||[])
              });
            }).catch(e => { alert("Błąd PDF: "+e.message); console.error(e); });
          }} title="Raport z rozgrywki (PDF)">📄</button>
          <button style={S.btnSmall} onClick={disconnectAll}>Rozłącz</button>
        </div>
      </div>

      {/* STATUS BANNER */}
      <div style={{
        background:allGood?"#1A2A1A":errorCount>0?"#2A1210":"#2A2210",
        border:"1px solid "+(allGood?"#3A5A3A":errorCount>0?"#5A2A20":"#5A4A20"),
        borderRadius:8, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:16
      }}>
        <div style={{fontSize:28}}>{allGood?"✓":errorCount>0?"✗":"⚠"}</div>
        <div>
          <div style={{fontSize:16, fontWeight:700, color:allGood?"#6B8E6B":errorCount>0?"#C04030":"#D4A853"}}>
            {allGood?"Wszystko w porządku":errorCount>0?errorCount+" błąd"+(errorCount>1?(errorCount<5?"y":"ów"):"")+" wykryt"+(errorCount>1?(errorCount<5?"e":"ych"):"y"):warnCount+" ostrzeżeni"+(warnCount>1?(warnCount<5?"a":"ń"):"e")}
          </div>
          <div style={{fontSize:12, color:"#8A7A6A"}}>
            {currentChecks.filter(c => c.sev !== SEV.INFO).map(c => c.msg).join(" · ") || "Brak wykrytych anomalii w bieżącym stanie gry."}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={S.grid}>

        {/* === FAMILIES STATUS === */}
        <div style={S.card}>
          <div style={S.cardTitle}>Rodziny</div>
          {FO.map(fId => {
            var f = FM[fId];
            var fp = players && players[fId];
            var memberCount = fp && fp.members ? Object.keys(fp.members).length : 0;
            var isOnline = memberCount > 0;
            var fd_f = gameState && gameState.fd ? gameState.fd[fId] : null;
            var cash = fd_f ? fd_f.cash : "–";
            var itemCount = fd_f ? fd_f.items.length : "–";
            return (
              <div key={fId} style={S.familyRow}>
                <div style={S.familyDot(f.col, isOnline)} />
                <div style={{flex:1}}>
                  <div style={{fontSize:14, fontWeight:700, color:f.col}}>{f.nom}</div>
                  <div style={{fontSize:11, color:"#7A6A5A"}}>
                    {isOnline ? memberCount + " gracz" + (memberCount > 1 ? (memberCount < 5 ? "y" : "ów") : "") : "offline"}
                    {fd_f && <span> · {cash} $ · {itemCount} kart</span>}
                  </div>
                </div>
                {fd_f && (() => {
                  var plots = fd_f.items.filter(i => i.cat === C_PLOT);
                  var plotOk = plots.length === 1 && plots[0].plotNr === f.tPlot;
                  var maps = [...new Set(fd_f.items.filter(i => i.cat === C_MAP).map(m => m.fragNr))].length;
                  return (
                    <div style={{display:"flex", gap:8, fontSize:11, color:"#7A6A5A"}}>
                      <span title="Działka" style={{color:plotOk?"#6B8E6B":plots.length>0?"#D4A853":"#8A7A6A"}}>◆{plots.length>0?plots[0].plotNr:"–"}</span>
                      <span title="Fragmenty mapy">🗺{maps}/4</span>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {/* Sheriff status */}
          <div style={{...S.familyRow, borderBottom:"none"}}>
            <div style={S.familyDot("#D4A853", players && players.sheriff && players.sheriff.connected)} />
            <div>
              <div style={{fontSize:14, fontWeight:700, color:"#D4A853"}}>Szeryf</div>
              <div style={{fontSize:11, color:"#7A6A5A"}}>
                {players && players.sheriff && players.sheriff.connected ? "online" : "offline"}
              </div>
            </div>
          </div>
        </div>

        {/* === GAME STATE === */}
        <div style={S.card}>
          <div style={S.cardTitle}>Stan rozgrywki</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
            <div>
              <div style={S.statNum}>{gameState && gameState.stageIdx != null ? gameState.stageIdx + 1 : "–"}</div>
              <div style={S.statLabel}>ETAP / {STAGES.length}</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.total : "–"}</div>
              <div style={S.statLabel}>TRANSAKCJI</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.accepted : "–"}</div>
              <div style={S.statLabel}>ZAAKCEPTOWANYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.rejected : "–"}</div>
              <div style={S.statLabel}>ODRZUCONYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.cancelled : "–"}</div>
              <div style={S.statLabel}>ANULOWANYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.pending : "–"}</div>
              <div style={S.statLabel}>OCZEKUJĄCYCH</div>
            </div>
          </div>
          {/* Mechanics status */}
          <div style={{marginTop:14, paddingTop:10, borderTop:"1px solid #3C2820", display:"flex", flexWrap:"wrap", gap:8}}>
            {[
              {label:"Gra", on:gameState?.gameStarted},
              {label:"Timer", on:gameState?.timerRunning},
              {label:"Pauza", on:gameState?.timerPaused},
              {label:"Żyła", on:gameState?.mapEnabled},
              {label:"Ślepy Los", on:gameState?.fateEnabled},
              {label:"BnB", on:gameState?.bnbEnabled},
              {label:"Rewolwerowiec", on:gameState?.revEnabled},
              {label:"Relacje", on:gameState?.relationsUnlocked},
            ].map(m => (
              <span key={m.label} style={{
                fontSize:11, padding:"3px 8px", borderRadius:3,
                background:m.on?"#1A3A1A":"#231810",
                color:m.on?"#8BC88B":"#5A4A3A",
                border:"1px solid "+(m.on?"#2A5A2A":"#3C2820")
              }}>
                {m.on?"●":"○"} {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* === TRANSACTION HEATMAP (per pair) === */}
      {txStats && Object.keys(txStats.pairs).length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Aktywność par negocjacyjnych</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8}}>
            {Object.entries(txStats.pairs).map(([pair, data]) => {
              var [a, b] = pair.split("-");
              var intensity = Math.min(1, data.total / 10);
              return (
                <div key={pair} style={{
                  background:"rgba(212,168,83," + (0.05 + intensity * 0.15) + ")",
                  border:"1px solid #3C2820", borderRadius:4, padding:"8px 10px"
                }}>
                  <div style={{fontSize:12, fontWeight:700, color:"#D0C8B8"}}>
                    {FM[a]?.gen} – {FM[b]?.gen}
                  </div>
                  <div style={{fontSize:11, color:"#8A7A6A", marginTop:2}}>
                    {data.total} tx · <span style={{color:"#6B8E6B"}}>{data.accepted}✓</span> · <span style={{color:"#C04030"}}>{data.rejected}✗</span> · <span style={{color:"#7A6A5A"}}>{data.cancelled}⊘</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === PHASE BREAKDOWN + REACTION TIMES === */}
      {txStats && txStats.total > 0 && (
        <div style={{...S.grid, marginBottom:20}}>
          {/* Phase breakdown */}
          <div style={S.card}>
            <div style={S.cardTitle}>Transakcje per faza</div>
            <div style={{display:"flex", gap:12}}>
              {[1,2,3].map(p => {
                var ps = phaseStats[p];
                var label = p===1?"FAZA I":p===2?"FAZA II":"FAZA III";
                var sublabel = p===1?"Informacyjna":p===2?"Transakcyjna":"Finałowa";
                var maxTotal = Math.max(1, ...([1,2,3].map(x => phaseStats[x].total)));
                var barH = Math.max(4, (ps.total / maxTotal) * 60);
                return (
                  <div key={p} style={{flex:1, textAlign:"center"}}>
                    <div style={{fontSize:12, fontWeight:700, color:"#D4A853"}}>{label}</div>
                    <div style={{fontSize:10, color:"#6A5A4A", marginBottom:6}}>{sublabel}</div>
                    <div style={{display:"flex", justifyContent:"center", alignItems:"flex-end", height:70, gap:3}}>
                      <div title="Zaakceptowane" style={{width:16, height:Math.max(2,(ps.accepted/Math.max(1,maxTotal))*60), background:"#6B8E6B", borderRadius:"2px 2px 0 0"}} />
                      <div title="Odrzucone" style={{width:16, height:Math.max(2,(ps.rejected/Math.max(1,maxTotal))*60), background:"#C04030", borderRadius:"2px 2px 0 0"}} />
                      <div title="Anulowane" style={{width:16, height:Math.max(2,(ps.cancelled/Math.max(1,maxTotal))*60), background:"#5A4A3A", borderRadius:"2px 2px 0 0"}} />
                    </div>
                    <div style={{fontSize:18, fontWeight:900, color:"#D4A853", marginTop:4}}>{ps.total}</div>
                    <div style={{fontSize:10, color:"#7A6A5A"}}>
                      <span style={{color:"#6B8E6B"}}>✓{ps.accepted}</span>{" "}
                      <span style={{color:"#C04030"}}>✗{ps.rejected}</span>{" "}
                      <span style={{color:"#5A4A3A"}}>⊘{ps.cancelled}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reaction times */}
          <div style={S.card}>
            <div style={S.cardTitle}>Czas reakcji na oferty</div>
            {reactionStats ? (
              <div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12}}>
                  <div>
                    <div style={S.statNum}>{reactionStats.avgAll}s</div>
                    <div style={S.statLabel}>ŚREDNI CZAS</div>
                  </div>
                  <div>
                    <div style={{...S.statNum, color:"#6B8E6B"}}>{reactionStats.avgAcc}s</div>
                    <div style={S.statLabel}>ŚR. AKCEPTACJA</div>
                  </div>
                  <div>
                    <div style={{...S.statNum, color:"#C04030"}}>{reactionStats.avgRej}s</div>
                    <div style={S.statLabel}>ŚR. ODRZUCENIE</div>
                  </div>
                </div>
                <div style={{fontSize:11, color:"#7A6A5A"}}>
                  Pomierzono: {reactionStats.total} transakcji · Max: {reactionStats.maxTime}s · ✓{reactionStats.accepted} ✗{reactionStats.rejected}
                </div>
                {/* Last 5 reaction times */}
                {reactionTimes.length > 0 && (
                  <div style={{marginTop:8, paddingTop:8, borderTop:"1px solid #3C2820"}}>
                    <div style={{fontSize:10, color:"#6A5A4A", marginBottom:4}}>Ostatnie pomiary:</div>
                    {reactionTimes.slice(-5).reverse().map((r, i) => (
                      <div key={i} style={{fontSize:11, color:"#8A7A6A", padding:"2px 0"}}>
                        <span style={{color:r.result==="accepted"?"#6B8E6B":"#C04030"}}>{r.result==="accepted"?"✓":"✗"}</span>
                        {" "}{FM[r.from]?.gen||"?"} → {FM[r.to]?.gen||"?"}: <span style={{color:"#D4A853", fontWeight:700}}>{r.duration}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{fontSize:13, color:"#5A4A3A", fontStyle:"italic"}}>
                Pomiar rozpocznie się po pierwszej transakcji w trybie pending.
              </div>
            )}
          </div>
        </div>
      )}

      {/* === CASH BARS + SCORING === */}
      {gameState && gameState.fd && (
        <div style={{...S.grid, marginBottom:20}}>
          {/* Cash visualization */}
          <div style={S.card}>
            <div style={S.cardTitle}>Gotówka</div>
            {FO.map(fId => {
              var cash = gameState.fd[fId] ? gameState.fd[fId].cash : 0;
              var maxCash = Math.max(100, ...FO.map(f => gameState.fd[f] ? gameState.fd[f].cash : 0));
              var pct = Math.max(0, (cash / maxCash) * 100);
              return (
                <div key={fId} style={{marginBottom:8}}>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:2}}>
                    <span style={{color:FM[fId].col, fontWeight:700}}>{FM[fId].gen}</span>
                    <span style={{color:"#D4A853", fontWeight:700}}>{cash} $</span>
                  </div>
                  <div style={{height:14, background:"#1A0E08", borderRadius:3, overflow:"hidden"}}>
                    <div style={{
                      height:"100%", borderRadius:3, transition:"width 0.5s",
                      width:pct+"%",
                      background:"linear-gradient(90deg, "+FM[fId].col+", "+FM[fId].col+"80)"
                    }} />
                  </div>
                </div>
              );
            })}
            {/* Cash snapshot trend (last 5) */}
            {cashSnapshots.length > 1 && (
              <div style={{marginTop:12, paddingTop:10, borderTop:"1px solid #3C2820"}}>
                <div style={{fontSize:11, color:"#7A6A5A", marginBottom:6}}>Trend gotówki per etap</div>
                <div style={{display:"flex", gap:4, overflowX:"auto"}}>
                  {cashSnapshots.slice(-8).map((snap, idx) => (
                    <div key={idx} style={{fontSize:10, color:"#6A5A4A", textAlign:"center", minWidth:45}}>
                      <div style={{fontWeight:700}}>{STAGES[snap.stageIdx]?.id || "?"}</div>
                      {FO.map(fId => (
                        <div key={fId} style={{color:FM[fId].col, fontSize:9}}>{snap.cash[fId]}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scoring preview */}
          <div style={S.card}>
            <div style={S.cardTitle}>Podgląd wyników (na żywo)</div>
            {scores && FO.map(fId => {
              var sc = scores[fId];
              return (
                <div key={fId} style={{marginBottom:10, paddingBottom:8, borderBottom:"1px solid #231810"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4}}>
                    <span style={{fontSize:14, fontWeight:700, color:FM[fId].col}}>{FM[fId].nom}</span>
                    <span style={{fontSize:20, fontWeight:900, color:"#D4A853"}}>{sc.bizTotal} pkt</span>
                  </div>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap", fontSize:10, color:"#8A7A6A"}}>
                    <span>Zasoby: {sc.resPct}% ({sc.resScore})</span>
                    <span>·</span>
                    <span>Kompetencje: {sc.compPct}% ({sc.compScore})</span>
                    <span>·</span>
                    <span style={{color:sc.plotOk?"#6B8E6B":"#C04030"}}>Działka: {sc.plotScore}</span>
                    <span>·</span>
                    <span style={{color:sc.cashScore<0?"#C04030":"#8A7A6A"}}>Gotówka: {sc.cashScore}</span>
                    <span>·</span>
                    <span>Mapa: {sc.mapScore}</span>
                    {sc.bnb > 0 && <span>· BnB: {sc.bnb}</span>}
                  </div>
                </div>
              );
            })}
            {!scores && <div style={{fontSize:13, color:"#5A4A3A", fontStyle:"italic"}}>Brak danych</div>}
          </div>
        </div>
      )}

      {/* === CONNECTION HISTORY === */}
      {Object.keys(connHistory).length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Historia połączeń</div>
          <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
            {FO.map(fId => {
              var hist = connHistory[fId];
              if(!hist || hist.length === 0) return null;
              var disconnects = hist.filter(h => h.event === "disconnect").length;
              // Detect flickering: 3+ events in last 5 min
              var recent = hist.filter(h => Date.now() - h.ts < 300000).length;
              var flickering = recent >= 4;
              return (
                <div key={fId} style={{fontSize:12, padding:"6px 10px", background:"#231810", borderRadius:4, border:flickering?"1px solid #C04030":"1px solid #3C2820"}}>
                  <span style={{color:FM[fId].col, fontWeight:700}}>{FM[fId].gen}</span>
                  <span style={{color:"#7A6A5A"}}> · {hist.length} {hist.length===1?"zdarzenie":hist.length>=2&&hist.length<=4?"zdarzenia":"zdarzeń"} · {disconnects} {disconnects===1?"rozłączenie":disconnects>=2&&disconnects<=4?"rozłączenia":"rozłączeń"}</span>
                  {flickering && <span style={{color:"#C04030", fontWeight:700}}> · MIGOTANIE</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === EVENT LOG === */}
      <div style={{...S.card, maxHeight:450, display:"flex", flexDirection:"column"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <div style={S.cardTitle}>Dziennik zdarzeń</div>
            <span style={{fontSize:11, color:"#6A5A4A"}}>{filteredLog.length} / {eventLog.length}</span>
          </div>
          <div style={{display:"flex", gap:6}}>
            {[
              {key:"all", label:"Wszystko"},
              {key:"warn", label:"Uwagi+"},
              {key:"error", label:"Błędy"},
            ].map(f => (
              <button key={f.key} style={{...S.btnSmall, background:logFilter===f.key?"#5C3A2A":"#3C2820", fontSize:11, padding:"4px 10px"}} onClick={() => setLogFilter(f.key)}>{f.label}</button>
            ))}
            <button style={{...S.btnSmall, fontSize:11, padding:"4px 10px"}} onClick={() => setEventLog([])}>Wyczyść</button>
          </div>
        </div>
        <div style={{flex:1, overflowY:"auto", minHeight:0}}>
          {filteredLog.length === 0 && (
            <div style={{color:"#5A4A3A", fontSize:13, fontStyle:"italic", padding:8}}>
              {eventLog.length === 0 ? "Oczekiwanie na zdarzenia..." : "Brak zdarzeń dla wybranego filtru."}
            </div>
          )}
          {filteredLog.map(ev => (
            <div key={ev.key} style={S.feedItem(ev.sev)}>
              <span style={S.feedTs}>{ev.ts}</span>
              <span style={S.feedCat(ev.sev)}>{SEV_LABEL[ev.sev]}</span>
              <span style={{color:SEV_COLOR[ev.sev], fontSize:11, fontWeight:600, flexShrink:0, minWidth:85}}>{ev.cat}</span>
              <span style={S.feedMsg}>{ev.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{textAlign:"center", marginTop:20, paddingTop:12, borderTop:"1px solid #231810"}}>
        <span style={S.badge}>WDZ Monitor v{VERSION} · read-only · {new Date().toLocaleDateString("pl")}</span>
      </div>
    </div>
  );
}

export { MonitorApp };
