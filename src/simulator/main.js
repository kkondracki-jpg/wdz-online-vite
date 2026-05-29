/* WDZ Online – simulator/main.js
 * Symulator testowy – moduł Vite.
 * Importy z src/game/ zamiast zduplikowanych stałych.
 */
import { FM, FO, PAIRINGS, STAGES, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS, G_TASKS, BLIND_FATE_EVENTS, getMeetingPartner } from "../game/constants.js";
import { calcScore, calcRelationScore } from "../game/scoring.js";
import { toSlug } from "../utils/index.js";

/* Firebase compat loaded via CDN in simulator.html – accessed as window.firebase */
var WDZ_FIREBASE_CONFIG = {
  apiKey:"AIzaSyC0h2oqWeC4LUvTZ7n7y1Fte6kxIl-VTac",
  authDomain:"wdz-online.firebaseapp.com",
  databaseURL:"https://wdz-online-default-rtdb.firebaseio.com",
  projectId:"wdz-online",
  storageBucket:"wdz-online.firebasestorage.app",
  messagingSenderId:"1034809779367",
  appId:"1:1034809779367:web:d913232cf95f2ede3c2782"
};

/* Wrapper – kanoniczny calcScore (8 params) z sygnaturą symulatora (6 params) */
function simCalcScore(fId, fd, bf, bnbEnabled, mapEnabled, mapBonusClaimed) {
  return calcScore(fId, fd, {}, {}, bnbEnabled, bf, mapEnabled, mapBonusClaimed);
}

// ============================================================
// UTILS
// ============================================================
let _i=0;
function ci(){return"sc"+(++_i);}
function txId(){return"tx_"+Math.random().toString(36).slice(2,12);}
function genRoomCode(){var c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",r="WDZ-";for(var i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r;}
const R=(n,b,w,d)=>({id:ci(),name:n,cat:C_RES,forBiz:b,weight:w,desc:d||""});
const RB=(n)=>({id:ci(),name:n,cat:C_RES,forBiz:null,weight:null,desc:"",blind:true});
const K=(n,a,t,b,w)=>({id:ci(),name:n,cat:C_COMP,author:a,title:t,forBiz:b,weight:w});
const KB=(n,a,t)=>({id:ci(),name:n,cat:C_COMP,author:a,title:t,forBiz:null,weight:null,blind:true});
const NR=(n,b,w)=>({id:ci(),name:n,cat:C_NRES,forBiz:b,weight:w});
const NK=(n,b,w)=>({id:ci(),name:n,cat:C_NCOMP,forBiz:b,weight:w});
const PL=(nr)=>({id:ci(),name:"Działka nr "+nr,cat:C_PLOT,plotNr:nr});
const MP=(nr)=>({id:ci(),name:"Fragment mapy "+(nr===1?"Adamsów":nr===2?"Bennetów":nr===3?"Clintonów":"Dexterów"),cat:C_MAP,fragNr:nr});

function genStart(){
  _i=0;
  return{
    adams:{cash:600,items:[R("Dębowa Beczka","Saloon",10),R("Mosiężny Żyrandol","Saloon",5),R("Żeliwny Kociołek","Saloon",5),R("Zestaw Narzędzi","Zakład Pogrzebowy",30),R("Karabin","Bank",20),R("Siodło","Ranczo",20),RB("Zestaw Skalpeli"),RB("Zakraplacz"),R("Lupa","Bank",5),R("Waga Jubilerska","Bank",5),NR("Lasso","Ranczo",30),NR("Colt Navy 1857","Ranczo",20),NR("Drewniany Wózek","Zakład Pogrzebowy",20),NR("Dębowa Beczka","Saloon",10),NR("Mosiężny Żyrandol","Saloon",5),NR("Żeliwny Kociołek","Saloon",5),NR("Zestaw Wizażysty","Zakład Pogrzebowy",5),NR("Podest dla Mówcy","Zakład Pogrzebowy",5),KB("Pisanie Kaligraficzne","Zeno Scribbler","Pisz z charakterem"),K("Podstawy Stolarstwa","Cleef Handyman","Twoja pierwsza sosnowa jesionka","Zakład Pogrzebowy",43),K("Obsługa Zamka Szyfrowego","Stan Safebreaker","Sejf bez tajemnic","Bank",27),K("Odnajdywanie Źródeł Wody","Harry Wizard","Wahadełko i różdżka","Ranczo",12),K("Szybkostrzelność i Celność Oka","Jack Bully","Wyznaj sobie cel","Ranczo",18),NK("Wygłaszanie Mów Pogrzebowych","Zakład Pogrzebowy",12),NK("Biegła Obsługa Liczydła","Bank",18),NK("Leczenie Chorób Bydła","Ranczo",27),NK("Podstawy Stolarstwa","Zakład Pogrzebowy",43),PL(6),MP(1),MP(1),MP(1),MP(1)]},
    bennet:{cash:600,items:[R("Lasso","Ranczo",30),R("Czarny Materiał","Zakład Pogrzebowy",20),R("Pianino","Saloon",20),R("Colt Navy 1857","Ranczo",20),RB("Telegraf"),R("Wysokie Buty","Ranczo",10),RB("Zestaw Stempli"),RB("Tygiel"),NR("Sejf","Bank",30),NR("Czarny Materiał","Zakład Pogrzebowy",20),NR("Liczydło","Bank",20),NR("Siodło","Ranczo",20),NR("Lupa","Bank",5),NR("Waga Jubilerska","Bank",5),K("Zapewnienie Bezpieczeństwa","Jeremy Magnum","Bankowe Zabezpieczenia","Bank",43),K("Leczenie Chorób Bydła","Anatolij Bykow","Weterynaria","Ranczo",27),K("Przechowywanie Piwa","Jack Screwdriver","Zawsze świeże","Saloon",12),KB("Zabawianie Gości na Imprezach","Jackie Zany","Heja, heja"),K("Biegła Obsługa Liczydła","Samuel Zweimal","Liczydło zaawansowany","Bank",18),NK("Przechowywanie Piwa","Saloon",12),NK("Szybkostrzelność i Celność Oka","Ranczo",18),NK("Pędzenie Szkockiej Whisky","Saloon",27),NK("Zapewnienie Bezpieczeństwa","Bank",43),PL(4),MP(2),MP(2),MP(2),MP(2)]},
    clinton:{cash:600,items:[R("Stara Destylarnia","Saloon",30),R("Kredens","Saloon",20),R("Drewniany Wózek","Zakład Pogrzebowy",20),RB("Stojący Zegar"),R("Stalowe Drzwi","Bank",10),R("Kasetka","Bank",10),R("Szpadel","Zakład Pogrzebowy",10),RB("Wigwam"),NR("Talia Kart","Saloon",10),NR("Pianino","Saloon",20),NR("Dłuto do Kamienia","Zakład Pogrzebowy",10),NR("Zestaw Narzędzi","Zakład Pogrzebowy",30),NR("Stalowe Drzwi","Bank",10),NR("Kasetka","Bank",10),NR("Wysokie Buty","Ranczo",10),K("Pędzenie Szkockiej Whisky","Ian McMoonshiner","Jak pędzili nasi dziadowie?","Saloon",27),K("Prowadzenie Kuchni Zbiorowej","Lucyna Ćwierciakiewiczowa","365 Obiadów","Saloon",18),K("Podstawy Makijażu Pośmiertnego","Jean Paul Magicien","Martwy jak żywy","Zakład Pogrzebowy",18),K("Posługiwanie się Lassem","Tom Incredible","Być jak Buffalo Bill","Ranczo",43),KB("Leczenie Ran Postrzałowych","Jonah Stapler","Kula nie wybiera"),NK("Sztuka Balsamowania","Zakład Pogrzebowy",27),NK("Prowadzenie Kuchni Zbiorowej","Saloon",18),NK("Odnajdywanie Źródeł Wody","Ranczo",12),NK("Posługiwanie się Lassem","Ranczo",43),PL(20),MP(3),MP(3),MP(3),MP(3)]},
    dexter:{cash:600,items:[R("Sejf","Bank",30),R("Liczydło","Bank",20),RB("30-letnia Whisky"),R("Talia Kart","Saloon",10),R("Manierka","Ranczo",10),R("Dłuto do Kamienia","Zakład Pogrzebowy",10),R("Kapelusz","Ranczo",5),R("Pas z Kaburą","Ranczo",5),R("Zestaw Wizażysty","Zakład Pogrzebowy",5),R("Podest dla Mówcy","Zakład Pogrzebowy",5),NR("Stara Destylarnia","Saloon",30),NR("Karabin","Bank",20),NR("Kredens","Saloon",20),NR("Manierka","Ranczo",10),NR("Szpadel","Zakład Pogrzebowy",10),NR("Kapelusz","Ranczo",5),NR("Pas z Kaburą","Ranczo",5),K("Organizowanie Turniejów Pokera","Paul Gambler","Poker Ekstremalny","Saloon",43),KB("Cechowanie Metali Szlachetnych","Tony Marker","Normy probiercze"),K("Sztuka Balsamowania","Jozef de Balsamo","Balsamowanie Stosowane","Zakład Pogrzebowy",27),K("Ocena Wartości Samorodków","Frederic Goldfinger","Nie wszystko złoto","Bank",12),K("Wygłaszanie Mów Pogrzebowych","Johan Schwätzer","364 Mowy","Zakład Pogrzebowy",12),NK("Ocena Wartości Samorodków","Bank",12),NK("Podstawy Makijażu Pośmiertnego","Zakład Pogrzebowy",18),NK("Obsługa Zamka Szyfrowego","Bank",27),NK("Organizowanie Turniejów Pokera","Saloon",43),PL(1),MP(4),MP(4),MP(4),MP(4)]},
  };
}

function makeBnb(fId){var p=BNB_PRODUCTS[fId],cards=[];for(var i=0;i<p.qty;i++)cards.push({id:ci(),name:p.name,cat:C_BNB,bnbOrigin:fId,effect:p.effect,effectDesc:p.effectDesc});return cards;}


function validateAndApplyTx(fd,tx){
  var s=fd[tx.from],b=fd[tx.to];
  if(tx.type==="sale"){
    if(tx.offeredItems.some(oi=>!s.items.find(si=>si.id===oi.id)))return{ok:false,error:"Brak kart u sprzedawcy"};
    if(b.cash<tx.price)return{ok:false,error:"Brak gotówki"};
    var inFrag=tx.offeredItems.filter(i=>i.cat===C_MAP).map(i=>i.fragNr);
    if(inFrag.length){var ex=new Set(b.items.filter(i=>i.cat===C_MAP).map(i=>i.fragNr));if(inFrag.some(n=>ex.has(n)))return{ok:false,error:"Duplikat mapy"};}
  }
  if(tx.type==="barter"){
    if(tx.offeredItems.some(oi=>!s.items.find(si=>si.id===oi.id)))return{ok:false,error:"Brak kart from"};
    if(tx.responseItems&&tx.responseItems.some(ri=>!b.items.find(bi=>bi.id===ri.id)))return{ok:false,error:"Brak kart to"};
    if(tx.offeredCash>0&&s.cash<tx.offeredCash)return{ok:false,error:"Brak kasy from"};
    if(tx.responseCash>0&&b.cash<tx.responseCash)return{ok:false,error:"Brak kasy to"};
  }
  var n={};FO.forEach(k=>{n[k]={items:fd[k].items.slice(),cash:fd[k].cash};});
  var f=n[tx.from],t=n[tx.to];
  if(tx.type==="sale"){
    f.items=f.items.filter(i=>!tx.offeredItems.find(o=>o.id===i.id));t.items=t.items.concat(tx.offeredItems);f.cash+=tx.price;t.cash-=tx.price;
  }else{
    f.items=f.items.filter(i=>!tx.offeredItems.find(o=>o.id===i.id));t.items=t.items.concat(tx.offeredItems);
    if(tx.responseItems){t.items=t.items.filter(i=>!tx.responseItems.find(r=>r.id===i.id));f.items=f.items.concat(tx.responseItems);}
    if(tx.offeredCash>0){f.cash-=tx.offeredCash;t.cash+=tx.offeredCash;}
    if(tx.responseCash>0){t.cash-=tx.responseCash;f.cash+=tx.responseCash;}
  }
  return{ok:true,newFd:n};
}

// calcScore, toSlug, G_TASKS – from wdz-shared.js

// ============================================================
// PERSONALITY PROFILES
// ============================================================
var PROFILES={
  rational:  {name:"Racjonalny",  tradeChance:0.95, priceMultBuy:1.0, priceMultSell:1.0, acceptThreshold:80, policyBudget:0.5, duelChance:0.3},
  aggressive:{name:"Agresywny",   tradeChance:0.98, priceMultBuy:1.3, priceMultSell:0.6, acceptThreshold:120,policyBudget:0.2, duelChance:0.7},
  cautious:  {name:"Zachowawczy", tradeChance:0.80, priceMultBuy:0.7, priceMultSell:1.3, acceptThreshold:50, policyBudget:0.8, duelChance:0.1},
  gambler:   {name:"Hazardzista", tradeChance:0.99, priceMultBuy:1.1, priceMultSell:0.8, acceptThreshold:100,policyBudget:0.1, duelChance:0.9},
};
var ALL_PROFILE_KEYS=["rational","aggressive","cautious","gambler"];
var botPersonalities={};

function getPersonality(fId){return botPersonalities[fId]||PROFILES.rational;}

function initPersonalities(){
  FO.forEach(fId=>{
    var sel=document.getElementById("pers_"+fId);
    var val=sel?sel.value:"random";
    if(val==="random") val=ALL_PROFILE_KEYS[Math.floor(Math.random()*ALL_PROFILE_KEYS.length)];
    botPersonalities[fId]=PROFILES[val]||PROFILES.rational;
  });
}

// ============================================================
// INSURANCE – boty kupują polisy Ślepego Losu
// ============================================================
function botBuyPolicy(fId,fd){
  var pers=getPersonality(fId);
  var cash=fd[fId].cash;
  // Polisa 100% = 50$, 50% = 30$ (zgodnie ze specyfikacją)
  if(cash>=50 && Math.random()<pers.policyBudget){
    fd[fId].cash-=50;
    return 100;
  }
  if(cash>=30 && Math.random()<pers.policyBudget*0.8){
    fd[fId].cash-=30;
    return 50;
  }
  return 0;
}

// ============================================================
// TASKS VALIDATION – uses toSlug + G_TASKS from wdz-shared.js
// ============================================================

function validateTasksConsistency(fd,scores){
  var issues=[];
  FO.forEach(fId=>{
    var items=(fd[fId]&&fd[fId].items)||[];
    var task=G_TASKS[fId];
    var f=FM[fId];
    // Raw resource % from TASKS (by slug matching)
    var resSlug=items.filter(i=>i.cat===C_RES&&!i.blind).map(i=>toSlug(i.name));
    var taskResPct=task.zasoby.reduce((s,z)=>s+(resSlug.includes(z.id)?z.pct:0),0);
    // Raw resource % from R() card weights (same filter as calcScore, before BnB/blindFate)
    var rawResPct=items.filter(i=>i.cat===C_RES&&!i.blind&&i.forBiz===f.biz).reduce((s,i)=>s+(i.weight||0),0);
    if(Math.abs(taskResPct-rawResPct)>0){
      issues.push(FM[fId].nom+": TASKS zasoby="+taskResPct+"% vs R() karty="+rawResPct+"%");
    }
    // Raw competency %
    var compSlug=items.filter(i=>i.cat===C_COMP&&!i.blind).map(i=>toSlug(i.name));
    var taskCompPct=task.kompetencje.reduce((s,k)=>s+(compSlug.includes(k.id)?k.pct:0),0);
    var rawCompPct=items.filter(i=>i.cat===C_COMP&&!i.blind&&i.forBiz===f.biz).reduce((s,i)=>s+(i.weight||0),0);
    if(Math.abs(taskCompPct-rawCompPct)>0){
      issues.push(FM[fId].nom+": TASKS kompetencje="+taskCompPct+"% vs R() karty="+rawCompPct+"%");
    }
  });
  return issues;
}

// ============================================================
// REWOLWEROWIEC – symulacja pojedynków
// ============================================================
function simDuels(fd,pairingIdx,duelsLog,log){
  var pairs=PAIRINGS[pairingIdx];
  var duelsThisTurn=[];
  pairs.forEach(function(pair){
    var a=pair[0],b=pair[1];
    var persA=getPersonality(a),persB=getPersonality(b);
    // Obie strony muszą chcieć walczyć
    if(Math.random()>persA.duelChance||Math.random()>persB.duelChance) return;
    // Ustal stawkę: 20-60$, zależy od agresywności
    var maxBet=Math.min(fd[a].cash,fd[b].cash,60);
    if(maxBet<20) return; // za mało kasy
    var bet=Math.max(20,Math.round(maxBet*(0.3+Math.random()*0.5)));
    bet=Math.min(bet,fd[a].cash,fd[b].cash);
    // Losuj wyniki: każdy rzuca "kość" 1-6, wyższy wygrywa, remis = powtórka
    var wA,wB,tries=0;
    do{wA=Math.floor(Math.random()*6)+1;wB=Math.floor(Math.random()*6)+1;tries++;}while(wA===wB&&tries<5);
    if(wA===wB) return; // 5 remisów – bez rozstrzygnięcia
    var winner=wA>wB?a:b, loser=wA>wB?b:a;
    fd[winner].cash+=bet; fd[loser].cash-=bet;
    var duel={winner:winner,loser:loser,bet:bet,rollW:wA>wB?wA:wB,rollL:wA>wB?wB:wA};
    duelsThisTurn.push(duel);
    duelsLog.push(duel);
    log("sheriff","🔫 "+FM[winner].nom+" ("+duel.rollW+") pokonał "+FM[loser].nom+" ("+duel.rollL+") – stawka "+bet+"$");
  });
  return duelsThisTurn;
}

// ============================================================
// CARD FLOW TRACKING – śledzenie przepływu kart
// ============================================================
var cardFlowLog=[];

function trackCardFlow(tx,phase){
  if(tx.status!=="accepted") return;
  (tx.offeredItems||[]).forEach(function(item){
    cardFlowLog.push({name:item.name,cat:item.cat,from:tx.from,to:tx.to,phase:phase,forBiz:item.forBiz||null,weight:item.weight||0});
  });
  (tx.responseItems||[]).forEach(function(item){
    cardFlowLog.push({name:item.name,cat:item.cat,from:tx.to,to:tx.from,phase:phase,forBiz:item.forBiz||null,weight:item.weight||0});
  });
}

function renderCardFlow(){
  var panel=document.getElementById("flowPanel");
  if(cardFlowLog.length===0){panel.style.display="none";return;}
  panel.style.display="block";

  // Agregacja per karta: ile razy wymieniona, trasa, końcowy właściciel
  var cardMap={};
  cardFlowLog.forEach(function(e){
    var key=e.name+"|"+e.cat;
    if(!cardMap[key]) cardMap[key]={name:e.name,cat:e.cat,forBiz:e.forBiz,weight:e.weight,moves:[],owners:new Set()};
    cardMap[key].moves.push({from:e.from,to:e.to,phase:e.phase});
    cardMap[key].owners.add(e.from);cardMap[key].owners.add(e.to);
  });

  var catLabel={res:"Zasób",comp:"Kompetencja",nres:"Notatka Z.",ncomp:"Notatka K.",plot:"Działka",map:"Żyła",bnb:"BnB"};
  var entries=Object.values(cardMap).sort(function(a,b){return b.moves.length-a.moves.length;});

  var html='<table class="score-table" style="font-size:12px"><thead><tr><th>Karta</th><th>Typ</th><th>Dla biznesu</th><th>Waga</th><th>Wymiany</th><th>Trasa</th></tr></thead><tbody>';
  entries.forEach(function(c){
    var route=c.moves.map(function(m){return FM[m.from].gen+"→"+FM[m.to].gen;}).join(", ");
    var bizCol=c.forBiz?'<span style="color:#842504">'+c.forBiz+'</span>':'–';
    html+='<tr><td style="font-weight:700">'+c.name+'</td><td>'+(catLabel[c.cat]||c.cat)+'</td><td>'+bizCol+'</td><td>'+(c.weight||'–')+'</td><td style="text-align:center;font-weight:700">'+c.moves.length+'</td><td style="font-size:11px;color:#8B7355">'+route+'</td></tr>';
  });
  html+='</tbody></table>';

  // Statystyki
  var totalMoves=cardFlowLog.length;
  var stuck=entries.filter(function(c){return c.moves.length===0;}).length;
  var hotCards=entries.filter(function(c){return c.moves.length>=3;});
  html+='<div style="margin-top:8px;font-size:12px;color:#8B7355">Łącznie: '+totalMoves+' transferów kart | '+entries.length+' unikalnych kart w obrocie';
  if(hotCards.length>0) html+=' | Najczęściej wymieniane: '+hotCards.map(function(c){return c.name+" ("+c.moves.length+"×)";}).join(", ");
  html+='</div>';

  document.getElementById("flowBody").innerHTML=html;
}

// ============================================================
// RELACJE – boty oceniają partnerów
// ============================================================
function simRelations(fd,stats){
  var relations={};
  FO.forEach(function(rater){
    relations[rater]={};
    var pers=getPersonality(rater);
    FO.forEach(function(rated){
      if(rater===rated) return;
      var s=stats[rater]||{prop:0,acc:0,rej:0};
      var sP=stats[rated]||{prop:0,acc:0,rej:0};
      // Partnership: based on acceptance rate with this partner
      var totalWith=s.acc+s.rej+sP.acc+sP.rej;
      var accWith=s.acc+sP.acc;
      var partnershipBase=totalWith>0?accWith/totalWith:0.5;
      var partnership=Math.max(1,Math.min(5,Math.round(partnershipBase*5+Math.random()-0.5)));
      // Rules: personality-driven (cautious rates high, aggressive rates low)
      var rulesBase=pers===PROFILES.cautious?4.2:pers===PROFILES.aggressive?2.8:pers===PROFILES.gambler?3.0:3.5;
      var rules=Math.max(1,Math.min(5,Math.round(rulesBase+Math.random()*1.5-0.75)));
      // Communication: based on trade volume
      var commBase=totalWith>6?4:totalWith>3?3:2;
      var communication=Math.max(1,Math.min(5,Math.round(commBase+Math.random()-0.5)));
      relations[rater][rated]={partnership:partnership,rules:rules,communication:communication};
    });
  });
  return relations;
}

// calcRelationScore – from wdz-shared.js

// ============================================================
// STRATEGY v2 – agresywna, celowa wymiana
// ============================================================

// Czy karta jest POTRZEBNA danej rodzinie?
function isNeeded(item,fId){
  var f=FM[fId],items=null; // items not available here, pure item check
  if(item.cat===C_RES&&!item.blind&&item.forBiz===f.biz)return true;
  if(item.cat===C_COMP&&!item.blind&&item.forBiz===f.biz)return true;
  if(item.cat===C_NRES&&item.forBiz===f.biz)return true;
  if(item.cat===C_NCOMP&&item.forBiz===f.biz)return true;
  if(item.cat===C_PLOT&&item.plotNr===f.tPlot)return true;
  if(item.cat===C_MAP&&item.fragNr!==f.mapFrag)return true; // obce fragmenty mapy
  if(item.cat===C_BNB&&item.bnbOrigin!==fId)return true; // cudze BnB
  return false;
}

// Czy karta jest ZBĘDNA (do oddania)?
function isDisposable(item,fId,myItems){
  var f=FM[fId];
  // Nigdy nie oddawaj: zasobów/kompetencji do swojego biznesu, docelowej działki
  if(item.cat===C_RES&&!item.blind&&item.forBiz===f.biz)return false;
  if(item.cat===C_COMP&&!item.blind&&item.forBiz===f.biz)return false;
  if(item.cat===C_PLOT&&item.plotNr===f.tPlot)return false;
  // Nie oddawaj notatek do własnego biznesu
  if((item.cat===C_NRES||item.cat===C_NCOMP)&&item.forBiz===f.biz)return false;
  // Zachowaj 1 kopię własnego fragmentu mapy
  if(item.cat===C_MAP&&item.fragNr===f.mapFrag){
    var copies=myItems.filter(i=>i.cat===C_MAP&&i.fragNr===f.mapFrag).length;
    return copies>1; // oddaj tylko duplikaty
  }
  // Zachowaj obce fragmenty mapy (potrzebne do kompletu) – ale duplikaty oddaj
  if(item.cat===C_MAP){
    var copiesOfThis=myItems.filter(i=>i.cat===C_MAP&&i.fragNr===item.fragNr).length;
    return copiesOfThis>1;
  }
  // Reszta jest zbędna: cudze zasoby, kompetencje, notatki, ślepe karty, zła działka, własne BnB
  return true;
}

// Wycena karty (do ustalania cen)
function cardPrice(item,fId){
  if(item.cat===C_PLOT)return 80;
  if(item.cat===C_MAP)return 40;
  if(item.cat===C_RES&&!item.blind)return item.weight*2;
  if(item.cat===C_COMP&&!item.blind)return item.weight*2;
  if(item.cat===C_NRES||item.cat===C_NCOMP)return item.weight*1.5;
  if(item.cat===C_BNB)return 25;
  if(item.blind)return 20;
  return 15;
}

// Zbierz karty do oddania (posortowane: najgorsze dla mnie na początku)
function getDisposable(fId,fd){
  var my=fd[fId].items;
  return my.filter(i=>isDisposable(i,fId,my)).sort((a,b)=>cardPrice(a,fId)-cardPrice(b,fId));
}

// Czego potrzebuję od partnera?
function whatINeedFromPartner(fId,partnerId,fd){
  var f=FM[fId],pItems=fd[partnerId].items,myItems=fd[fId].items;
  var needs=[];
  // Zasoby do mojego biznesu (których nie mam)
  var myResNames=new Set(myItems.filter(i=>i.cat===C_RES&&i.forBiz===f.biz).map(i=>i.name));
  pItems.filter(i=>i.cat===C_RES&&!i.blind&&i.forBiz===f.biz&&!myResNames.has(i.name)).forEach(i=>needs.push({item:i,priority:3}));
  // Kompetencje do mojego biznesu
  var myCompNames=new Set(myItems.filter(i=>i.cat===C_COMP&&i.forBiz===f.biz).map(i=>i.name));
  pItems.filter(i=>i.cat===C_COMP&&!i.blind&&i.forBiz===f.biz&&!myCompNames.has(i.name)).forEach(i=>needs.push({item:i,priority:3}));
  // Docelowa działka
  if(!myItems.find(i=>i.cat===C_PLOT&&i.plotNr===f.tPlot)){
    var plotItem=pItems.find(i=>i.cat===C_PLOT&&i.plotNr===f.tPlot);
    if(plotItem)needs.push({item:plotItem,priority:5});
  }
  // Brakujące fragmenty mapy
  var myFrags=new Set(myItems.filter(i=>i.cat===C_MAP).map(i=>i.fragNr));
  pItems.filter(i=>i.cat===C_MAP&&!myFrags.has(i.fragNr)).forEach(i=>{
    if(!needs.find(n=>n.item.cat===C_MAP&&n.item.fragNr===i.fragNr))needs.push({item:i,priority:4});
  });
  // Notatki do mojego biznesu
  pItems.filter(i=>(i.cat===C_NRES||i.cat===C_NCOMP)&&i.forBiz===f.biz).forEach(i=>needs.push({item:i,priority:2}));
  // BnB (cudze)
  pItems.filter(i=>i.cat===C_BNB&&i.bnbOrigin!==fId&&isDisposable(i,partnerId,pItems)).forEach(i=>needs.push({item:i,priority:1}));
  return needs.sort((a,b)=>b.priority-a.priority);
}

// Generuj propozycję handlową
function genProposal(fId,partner,fd,phase){
  var disposable=getDisposable(fId,fd);
  var needs=whatINeedFromPartner(fId,partner,fd);
  if(!disposable.length&&!needs.length)return null;
  var pers=getPersonality(fId);
  if(Math.random()>pers.tradeChance)return null;
  var pBiz=FM[partner].biz,pPlot=FM[partner].tPlot;

  // === BARTER (preferowany – wymiana 1:1 lub N:N) ===
  if(needs.length>0&&disposable.length>0){
    // Wybierz 1-3 potrzebne karty od partnera
    var wantItems=needs.slice(0,Math.min(3,needs.length)).map(n=>n.item);
    // Wybierz karty do oddania: priorytetyzuj to co partner potrzebuje
    var giveItems=[];
    var givePool=[...disposable];
    for(var wi of wantItems){
      // Szukaj w moim pool karty pasującej do partnera
      var bestIdx=givePool.findIndex(g=>
        (g.cat===C_RES&&!g.blind&&g.forBiz===pBiz)||
        (g.cat===C_COMP&&!g.blind&&g.forBiz===pBiz)||
        (g.cat===C_PLOT&&g.plotNr===pPlot)||
        (g.cat===C_MAP)||
        (g.cat===C_NRES&&g.forBiz===pBiz)||
        (g.cat===C_NCOMP&&g.forBiz===pBiz)
      );
      if(bestIdx>=0){giveItems.push(givePool.splice(bestIdx,1)[0]);}
      else if(givePool.length){giveItems.push(givePool.shift());}
    }
    if(!giveItems.length&&fd[fId].cash>=30){
      // Jeśli nic do oddania – zaproponuj kasę
      return{type:"sale_buy",items:wantItems,price:wantItems.reduce((s,i)=>s+Math.round(cardPrice(i,fId)*0.8),0)};
    }
    if(giveItems.length){
      var cashDiff=0;
      var giveVal=giveItems.reduce((s,i)=>s+cardPrice(i,fId),0);
      var wantVal=wantItems.reduce((s,i)=>s+cardPrice(i,fId),0);
      if(wantVal>giveVal+20)cashDiff=Math.min(Math.round((wantVal-giveVal)*0.5),fd[fId].cash);
      return{type:"barter",items:giveItems,wantItems:wantItems,cash:cashDiff};
    }
  }

  // === SPRZEDAŻ (karty które partner potrzebuje) ===
  if(disposable.length>0){
    var forPartner=disposable.filter(i=>
      (i.cat===C_RES&&!i.blind&&i.forBiz===pBiz)||
      (i.cat===C_COMP&&!i.blind&&i.forBiz===pBiz)||
      (i.cat===C_PLOT&&i.plotNr===pPlot)||
      (i.cat===C_MAP)||
      (i.cat===C_NRES&&i.forBiz===pBiz)||
      (i.cat===C_NCOMP&&i.forBiz===pBiz)||
      (i.cat===C_BNB&&i.bnbOrigin===fId)
    );
    if(forPartner.length){
      var sellItems=forPartner.slice(0,Math.min(3,forPartner.length));
      var price=sellItems.reduce((s,i)=>s+Math.round(cardPrice(i,fId)*0.7*getPersonality(fId).priceMultSell),0);
      return{type:"sale",items:sellItems,price:Math.max(10,price)};
    }
    // Sprzedaj cokolwiek tanio
    var sellAny=disposable.slice(0,2);
    return{type:"sale",items:sellAny,price:Math.max(10,sellAny.reduce((s,i)=>s+10,0))};
  }

  // === KUPNO (potrzebuję ale nie mam co dać) ===
  if(needs.length>0&&fd[fId].cash>=50){
    var buyItems=needs.slice(0,2).map(n=>n.item);
    return{type:"sale_buy",items:buyItems,price:buyItems.reduce((s,i)=>s+Math.round(cardPrice(i,fId)*0.9),0)};
  }

  return null;
}

// Ocena oferty sprzedaży
function evalSale(fId,offer,fd){
  if(fd[fId].cash<offer.price)return{accept:false,reason:"Brak kasy"};
  var pers=getPersonality(fId);
  var usefulCount=offer.offeredItems.filter(i=>isNeeded(i,fId)).length;
  if(usefulCount>0&&offer.price<=pers.acceptThreshold)return{accept:true,reason:"Potrzebuję "+usefulCount+" kart"};
  if(usefulCount>0&&offer.price<=usefulCount*Math.round(80*pers.priceMultBuy))return{accept:true,reason:"Dobra cena za "+usefulCount+" kart"};
  if(offer.price<=20)return{accept:true,reason:"Tanio"};
  return{accept:false,reason:"Nie potrzebuję / za drogo"};
}

// Kontr-oferta na barter: daj to co partner potrzebuje
function selectResp(fId,fd){
  var disposable=getDisposable(fId,fd);
  if(!disposable.length)return{items:[],cash:Math.min(40,fd[fId].cash)};
  // Daj 1-3 karty
  var give=disposable.slice(0,Math.min(3,disposable.length));
  return{items:give,cash:0};
}

// Ocena barteru – fId to ZAWSZE tx.from (proponent)
function evalBarter(fId,tx){
  // Proponent ocenia kontr-ofertę od partnera
  var myGain=tx.responseItems?tx.responseItems.filter(i=>isNeeded(i,fId)).length:0; // co dostaję od partnera
  var myLoss=tx.offeredItems.filter(i=>isNeeded(i,fId)).length; // co oddaję (powinno być 0 bo oddaję zbędne)
  if(myGain>0&&myLoss===0)return{accept:true,reason:"Zyskuję "+myGain+" potrzebnych kart"};
  if(myGain>myLoss)return{accept:true,reason:"Bilans: +"+myGain+" -"+myLoss};
  if(myGain>0)return{accept:true,reason:"Coś zyskuję"};
  return{accept:false,reason:"Nic nie zyskuję"};
}

// ============================================================
// UI
// ============================================================
var logEl=document.getElementById("logArea");
var running=false;

function addLog(actor,msg){
  var cls=actor;
  logEl.innerHTML+='<span class="'+cls+'">['+actor.toUpperCase().padEnd(8," ")+']</span> '+escHtml(msg)+'\n';
  logEl.scrollTop=logEl.scrollHeight;
}
function escHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function showStatus(text,type){
  var el=document.getElementById("statusBar");
  el.textContent=text;el.className="status "+type;el.style.display="block";
}

function showScores(scores){
  var panel=document.getElementById("resultsPanel");panel.style.display="block";
  var body=document.getElementById("scoreBody");body.innerHTML="";
  var colors={adams:"#A75F4A",bennet:"#726072",clinton:"#5E5971",dexter:"#5B7674"};
  FO.forEach(fId=>{
    var s=scores[fId];
    var total=s.totalFinal||s.bizTotal;
    var w=Math.max(2,Math.round(Math.max(0,total)*2));
    body.innerHTML+='<tr><td style="font-weight:700;color:'+colors[fId]+'">'+FM[fId].nom+'</td><td><b>'+total+'</b></td><td>'+s.resPct+'%</td><td>'+s.compPct+'%</td><td>'+(s.plotOk?'✓':'✗')+'</td><td>'+s.cash+'$</td><td>'+s.mapScore+'</td><td>'+(s.relacje!=null?s.relacje:'–')+'</td><td><div class="score-bar" style="width:'+w+'px;background:'+colors[fId]+'"></div></td></tr>';
  });
}

function renderDuels(duels){
  if(!duels||duels.length===0){document.getElementById("duelPanel").style.display="none";return;}
  var panel=document.getElementById("duelPanel");panel.style.display="block";
  var html='<table class="score-table" style="font-size:12px"><thead><tr><th>#</th><th>Zwycięzca</th><th>Przegrany</th><th>Stawka</th><th>Rzuty</th></tr></thead><tbody>';
  duels.forEach(function(d,i){
    html+='<tr><td>'+(i+1)+'</td><td style="font-weight:700;color:'+FM[d.winner].col+'">'+FM[d.winner].nom+'</td><td style="color:'+FM[d.loser].col+'">'+FM[d.loser].nom+'</td><td style="font-weight:700">'+d.bet+'$</td><td>'+d.rollW+' vs '+d.rollL+'</td></tr>';
  });
  html+='</tbody></table>';
  // Podsumowanie
  var winStats={};FO.forEach(f=>{winStats[f]={wins:0,losses:0,netCash:0};});
  duels.forEach(function(d){
    winStats[d.winner].wins++;winStats[d.winner].netCash+=d.bet;
    winStats[d.loser].losses++;winStats[d.loser].netCash-=d.bet;
  });
  html+='<div style="margin-top:8px;font-size:12px;color:#8B7355">';
  var summParts=[];
  FO.forEach(function(f){
    var ws=winStats[f];
    summParts.push(FM[f].gen+": "+ws.wins+"W "+(ws.netCash>=0?"+":"")+ws.netCash+"$");
  });
  html+=summParts.join(" | ")+"</div>";
  document.getElementById("duelBody").innerHTML=html;
}

function renderFateDetails(bf){
  var panel=document.getElementById("fatePanel");
  if(!bf||!FO.some(function(f){return bf[f]&&bf[f].rolls&&bf[f].rolls.length>0;})){panel.style.display="none";return;}
  panel.style.display="block";
  var html='<table class="score-table" style="font-size:12px"><thead><tr><th>Rodzina</th><th>Narada</th><th>Kości</th><th>Zdarzenie</th><th>Polisa</th><th>Efekt</th></tr></thead><tbody>';
  FO.forEach(function(f){
    var rolls=bf[f]?bf[f].rolls:[];
    if(!rolls||rolls.length===0) return;
    rolls.forEach(function(r,i){
      if(!r||!r.resolved) return;
      var evText=r.event?r.event.text:"brak zdarzenia";
      var polText=r.policyUsed>0?"polisa "+r.policyUsed+"%":"brak";
      var effText=r.netEffectText||"";
      if(!effText&&r.netEffect!==undefined&&r.netEffect!==0) effText=(r.netEffect>0?"+":"")+r.netEffect+"$";
      if(!effText) effText="–";
      var isLoss=r.event&&(r.event.type==="loss"||r.event.type==="loss_resources");
      html+='<tr><td style="font-weight:700;color:'+FM[f].col+'">'+FM[f].nom+'</td><td>NAR'+(i+1)+'</td><td>'+(r.dice1||r.d1||"?")+"+"+( r.dice2||r.d2||"?")+"="+r.sum+'</td><td>'+evText+'</td><td style="color:#D4A853">'+polText+'</td><td style="color:'+(isLoss?"#C04030":"#8BC88B")+'">'+effText+'</td></tr>';
    });
  });
  html+='</tbody></table>';
  var totalCashEffect=0,totalResPenalty=0,policiesBought=0;
  FO.forEach(function(f){
    if(!bf[f]||!bf[f].rolls) return;
    bf[f].rolls.forEach(function(r){
      if(!r||!r.resolved) return;
      if(r.event&&(r.event.type==="loss"||r.event.type==="gain")) totalCashEffect+=(r.netEffect||0);
      if(r.event&&r.event.type==="loss_resources"){var pen=r.policyUsed===100?0:r.policyUsed===50?5:10;totalResPenalty+=pen;}
      if(r.policyUsed>0) policiesBought++;
    });
  });
  html+='<div style="margin-top:8px;font-size:12px;color:#8B7355">Bilans gotówkowy: '+(totalCashEffect>=0?"+":"")+totalCashEffect+'$ | Utrata zasobów: '+totalResPenalty+'% | Polisy kupione: '+policiesBought+'</div>';
  document.getElementById("fateBody").innerHTML=html;
}

// ============================================================
// LOCAL SIMULATOR
// ============================================================
function runLocal(){
  if(running)return;running=true;
  logEl.innerHTML="";
  document.getElementById("resultsPanel").style.display="none";
  document.getElementById("mcPanel").style.display="none";
  document.getElementById("flowPanel").style.display="none";
  document.getElementById("duelPanel").style.display="none";
  document.getElementById("fatePanel").style.display="none";
  document.getElementById("roomInfo").style.display="none";
  document.getElementById("btnLocal").disabled=true;
  document.getElementById("btnFirebase").disabled=true;
  document.getElementById("btnMC").disabled=true;
  showStatus("Symulacja lokalna w toku...","running");

  var mode=document.getElementById("mode").value;
  var opts={bnb:document.getElementById("bnb").checked,fate:document.getElementById("fate").checked,map:document.getElementById("map").checked,rev:document.getElementById("rev").checked};
  initPersonalities();

  setTimeout(function(){
    try{
      var result=runLocalSim(mode,opts,false);
      showScores(result.scores);
      renderCardFlow();
      if(result.duels&&result.duels.length>0) renderDuels(result.duels);
      if(result.bf) renderFateDetails(result.bf);
      // TASKS validation
      var taskIssues=validateTasksConsistency(result.fd,result.scores);
      var valHtml="";
      if(taskIssues.length===0) valHtml='<span class="validation-ok">✓ TASKS-calcScore spójne</span>';
      else valHtml='<span class="validation-fail">✗ Rozbieżności TASKS vs calcScore:</span><br>'+taskIssues.join("<br>");
      document.getElementById("validationInfo").innerHTML=
        "Transakcje: <b>"+result.txStats.total+"</b> ("+result.txStats.acc+" zaakceptowanych) | Gotówka: <b>"+result.totalCash+"$</b> | Czas: <b>"+result.elapsed+"ms</b><br>"+valHtml;
      if(result.anomalies.length===0)showStatus("✅ PASS – brak anomalii ("+result.elapsed+"ms)","pass");
      else showStatus("❌ FAIL – "+result.anomalies.length+" anomalii","fail");
    }catch(e){
      addLog("error","CRASH: "+e.message);
      showStatus("❌ CRASH: "+e.message,"fail");
    }
    running=false;
    document.getElementById("btnLocal").disabled=false;
    document.getElementById("btnFirebase").disabled=false;
    document.getElementById("btnMC").disabled=false;
  },50);
}

function runLocalSim(mode,opts,silent){
  var t0=performance.now();
  var fd=genStart(),txs=[],bf={},bnbE=false,mapE=opts.map,revE=opts.rev||false;
  var anomalies=[];
  var rounds=(mode==="stress"?5:mode==="realistic"?3:2);
  var stats={};FO.forEach(fId=>{stats[fId]={prop:0,acc:0,rej:0,bartS:0,bartA:0};});
  var duelsLog=[];
  cardFlowLog=[];
  var log=silent?function(){}:addLog;

  log("system","Tryb: "+mode.toUpperCase()+" | BnB:"+opts.bnb+" Fate:"+opts.fate+" Map:"+opts.map+" Rundy:"+rounds);
  if(!silent) FO.forEach(fId=>{log("system","  "+FM[fId].nom+": "+getPersonality(fId).name);});

  function botAct(fId,pIdx,phase){
    var partner=getMeetingPartner(fId,pIdx);if(!partner)return;
    // Respond to offers
    txs.forEach(tx=>{
      if(tx.type==="sale"&&tx.status==="pending"&&tx.to===fId){
        var ev=evalSale(fId,tx,fd);
        if(ev.accept){log(fId,"✅ Akceptuję od "+FM[tx.from].nom+": "+ev.reason);var r=validateAndApplyTx(fd,tx);if(r.ok){fd=r.newFd;tx.status="accepted";stats[fId].acc++;}else{tx.status="rejected";stats[fId].rej++;}}
        else{log(fId,"❌ Odrzucam od "+FM[tx.from].nom+": "+ev.reason);tx.status="rejected";stats[fId].rej++;}
      }
      // Partner evaluates pre-defined barter (proponent specified wantItems)
      if(tx.type==="barter"&&tx.status==="pending_partner"&&tx.to===fId){
        var iGet=tx.offeredItems.filter(i=>isNeeded(i,fId)).length;
        var iLose=tx.responseItems?tx.responseItems.filter(i=>isNeeded(i,fId)).length:0;
        var cashNet=(tx.offeredCash||0)-(tx.responseCash||0);
        if(iGet>0&&iLose===0){
          var r3=validateAndApplyTx(fd,tx);if(r3.ok){fd=r3.newFd;tx.status="accepted";stats[fId].acc++;log(fId,"✅ Barter od "+FM[tx.from].nom+": dostaję "+iGet+" potrzebnych kart");}else{tx.status="rejected";}
        }else if(iGet>=iLose&&cashNet>=0){
          var r3=validateAndApplyTx(fd,tx);if(r3.ok){fd=r3.newFd;tx.status="accepted";stats[fId].acc++;log(fId,"✅ Barter od "+FM[tx.from].nom+": korzystna wymiana");}else{tx.status="rejected";}
        }else{
          tx.status="rejected";stats[fId].rej++;log(fId,"❌ Odrzucam barter od "+FM[tx.from].nom+": niekorzystna wymiana (tracę "+iLose+" potrzebnych)");
        }
      }
      if(tx.type==="barter"&&tx.status==="awaiting_response"&&tx.to===fId){
        var resp=selectResp(fId,fd);
        if(resp.items.length||resp.cash){tx.responseItems=resp.items;tx.responseCash=resp.cash;tx.status="pending";log(fId,"📤 Kontr-oferta → "+FM[tx.from].nom+": "+resp.items.map(i=>i.name).join(", "));}
        else{tx.status="rejected";stats[fId].rej++;}
      }
      if(tx.type==="barter"&&tx.status==="pending"&&tx.from===fId&&tx.responseItems){
        var ev2=evalBarter(fId,tx);
        if(ev2.accept){var r2=validateAndApplyTx(fd,tx);if(r2.ok){fd=r2.newFd;tx.status="accepted";stats[fId].bartA++;log(fId,"✅ Barter z "+FM[tx.to].nom+": "+ev2.reason);}else{tx.status="rejected";}}
        else{tx.status="rejected";stats[fId].rej++;}
      }
    });
    // Propose
    var prop=genProposal(fId,partner,fd,phase);
    if(!prop)return;
    if(prop.type==="sale"){
      txs.push({id:txId(),type:"sale",from:fId,to:partner,offeredItems:prop.items,price:prop.price,status:"pending"});
      log(fId,"📤 Sprzedaż → "+FM[partner].nom+": "+prop.items.map(i=>i.name).join(", ")+" za "+prop.price+"$");
      stats[fId].prop++;
    }else if(prop.type==="sale_buy"){
      // Chcę KUPIĆ od partnera – składam ofertę kupna (= sprzedaż z partnera do mnie)
      txs.push({id:txId(),type:"sale",from:partner,to:fId,offeredItems:prop.items,price:prop.price,status:"pending"});
      log(fId,"💰 Kupuję od "+FM[partner].nom+": "+prop.items.map(i=>i.name).join(", ")+" za "+prop.price+"$");
      stats[fId].prop++;
    }else{
      // Barter: oferuję swoje items, chcę partnera items
      var tx={id:txId(),type:"barter",from:fId,to:partner,offeredItems:prop.items,offeredCash:prop.cash||0,responseItems:null,responseCash:0,status:"awaiting_response"};
      if(prop.wantItems){tx.responseItems=prop.wantItems;tx.responseCash=0;tx.status="pending_partner";}
      txs.push(tx);
      log(fId,"📤 Barter → "+FM[partner].nom+": daję ["+prop.items.map(i=>i.name).join(", ")+"]"+(prop.wantItems?" za ["+prop.wantItems.map(i=>i.name).join(", ")+"]":""));
      stats[fId].bartS++;
    }
  }

  for(var idx=0;idx<STAGES.length;idx++){
    var stage=STAGES[idx];
    // Cancel pending
    txs.forEach(t=>{if(t.status==="pending"||t.status==="awaiting_response"||t.status==="pending_partner"){t.status="cancelled";}});
    log("sheriff","▶️ ["+idx+"/"+String(STAGES.length-1)+"] "+stage.label);

    if(stage.type==="turn"){
      var pairs=PAIRINGS[stage.pairingIdx];
      log("system","  Pary: "+pairs.map(p=>p.map(f=>FM[f].nom).join(" ↔ ")).join("  |  "));
      var txBefore=txs.length;
      for(var r=0;r<rounds;r++){
        var shuffled=FO.slice().sort(()=>Math.random()-0.5);
        shuffled.forEach(fId=>botAct(fId,stage.pairingIdx,stage.phase));
        shuffled.reverse().forEach(fId=>botAct(fId,stage.pairingIdx,stage.phase));
      }
      // Track card flow for newly accepted transactions
      for(var ti=txBefore;ti<txs.length;ti++){
        if(txs[ti].status==="accepted") trackCardFlow(txs[ti],stage.phase);
      }
      // Rewolwerowiec – duele po handlu
      if(revE){
        simDuels(fd,stage.pairingIdx,duelsLog,log);
      }
    }
    if(stage.type==="narada"){
      if(stage.id==="NAR1"&&opts.bnb){
        log("sheriff","💼 Biznes na Boku – aktywacja");
        FO.forEach(fId=>{fd[fId].items=fd[fId].items.concat(makeBnb(fId));});
        bnbE=true;
      }
      if((stage.id==="NAR1"||stage.id==="NAR2")&&opts.fate){
        FO.forEach(fId=>{
          var policyUsed=botBuyPolicy(fId,fd);
          if(policyUsed>0) log("sheriff","🛡 "+FM[fId].nom+" kupił polisę "+policyUsed+"% ("+getPersonality(fId).name+")");
          var d1=Math.floor(Math.random()*6)+1,d2=Math.floor(Math.random()*6)+1,sum=d1+d2;
          var ev=BLIND_FATE_EVENTS[sum]||null;
          if(!bf[fId])bf[fId]={rolls:[]};
          var netEffect=0;
          if(ev&&(ev.type==="loss"||ev.type==="gain")){
            var amt=ev.amount;
            if(ev.type==="loss"&&policyUsed===100) amt=0;
            else if(ev.type==="loss"&&policyUsed===50) amt=Math.round(amt/2);
            var cashBefore=fd[fId].cash;
            fd[fId].cash=fd[fId].cash+amt;
            netEffect=fd[fId].cash-cashBefore; // actual delta
          }
          if(ev&&ev.type==="gain_policy"){
            // Złoty Los: zysk = 2× cena polisy (50$ → +100$, 30$ → +60$, brak → 0$)
            var policyGain=policyUsed===100?100:policyUsed===50?60:0;
            fd[fId].cash+=policyGain;
            netEffect=policyGain;
          }
          if(ev&&ev.type==="loss_resources"){
            var pen=policyUsed===100?0:policyUsed===50?5:10;
            netEffect=-pen;
          }
          var netEffectText="";
          if(ev&&ev.type==="loss_resources"){var pen=policyUsed===100?0:policyUsed===50?5:10;netEffectText=pen===0?"brak utraty zasobów":"utrata "+pen+"% zasobów";}
          else if(ev&&ev.type==="gain_policy"){netEffectText=netEffect>0?"+"+netEffect+" $":"0 $ (brak polisy)";}
          else if(netEffect!==0){netEffectText=(netEffect>=0?"+":"")+netEffect+" $";}
          bf[fId].rolls.push({dice1:d1,dice2:d2,sum:sum,event:ev,resolved:true,policyUsed:policyUsed,netEffect:netEffect,netEffectText:netEffectText});
          if(ev) log("sheriff","🎲 "+FM[fId].nom+": "+d1+"+"+d2+"="+sum+" → "+ev.text+(netEffect!==0?" ("+(netEffect>0?"+":"")+netEffect+(ev.type==="loss_resources"?"% zasobów":"$")+")":"")+(policyUsed>0?" [polisa "+policyUsed+"%]":""));
          else log("sheriff","🎲 "+FM[fId].nom+": "+d1+"+"+d2+"="+sum+" → brak zdarzenia");
        });
      }
    }
  }

  // BnB settlement (rozliczenie z dostawcą)
  var bnbSettleCost=0;
  if(bnbE){
    FO.forEach(fId=>{
      var ownCards=fd[fId].items.filter(i=>i.cat===C_BNB&&i.bnbOrigin===fId);
      var soldAll=ownCards.length===0;
      var cost=300;
      var bonus=soldAll?100:0;
      var netCost=Math.min(cost-bonus,fd[fId].cash);
      fd[fId].cash-=netCost;
      bnbSettleCost+=netCost;
      txs.push({id:ci(),type:"bnb_settle",from:fId,to:"dostawca",status:"accepted",offeredItems:[],description:"Opłata dla dostawcy – 300 $"});
      if(soldAll) txs.push({id:ci(),type:"bnb_bonus",from:"dostawca",to:fId,status:"accepted",offeredItems:[],description:"Rabat od dostawcy – 100 $"});
      log("sheriff","💰 "+FM[fId].nom+": rozliczenie BnB – "+(cost-bonus)+"$ "+(soldAll?"(rabat 100$)":""));
    });
  }

  // Map bonus auto-claim (300$ za komplet 4 fragmentów – tylko pierwsza rodzina)
  var mapBonusCost=0;
  var mapBonusClaimed={};
  if(mapE){
    // Znajdź pierwszą rodzinę z kompletem 4 fragmentów (symulacja wyścigu)
    var mapWinner=null;
    FO.forEach(fId=>{
      if(mapWinner) return;
      var uniqueFrags=new Set(fd[fId].items.filter(i=>i.cat===C_MAP).map(i=>i.fragNr));
      if(uniqueFrags.size>=4) mapWinner=fId;
    });
    if(mapWinner){
      mapBonusClaimed[mapWinner]=true;
      // Zwycięzca: +300$, piąty fragment
      fd[mapWinner].cash+=300;
      fd[mapWinner].items.push({id:ci(),name:"Piąty fragment mapy",cat:C_MAP,fragNr:5});
      mapBonusCost+=300;
      txs.push({id:ci(),type:"map_bonus",from:"bank",to:mapWinner,status:"accepted",offeredItems:[],description:"Premia za komplet mapy – 300 $"});
      log("sheriff","🗺️ "+FM[mapWinner].nom+": premia za Złotodajną Żyłę – +300$, piąty fragment!");
      // Pozostałe rodziny: -100$ każda
      FO.forEach(fId=>{
        if(fId===mapWinner) return;
        fd[fId].cash-=100;
        mapBonusCost-=100;
        txs.push({id:ci(),type:"map_bonus",from:fId,to:mapWinner,status:"accepted",offeredItems:[],description:"Koszt premii za Złotodajną Żyłę dla "+FM[mapWinner].gen+" – -100 $"});
      });
      log("sheriff","🗺️ Pozostałe rodziny: -100$ za premię "+FM[mapWinner].gen);
    }
  }

  // Plot penalty (50$ za złą działkę)
  var plotPenaltyCost=0;
  FO.forEach(fId=>{
    var f=FM[fId];
    var plotItem=fd[fId].items.find(i=>i.cat===C_PLOT);
    var plotOk=plotItem&&plotItem.plotNr===f.tPlot;
    if(!plotOk){
      var penalty=Math.min(50,fd[fId].cash);
      fd[fId].cash-=penalty;
      plotPenaltyCost+=penalty;
      txs.push({id:ci(),type:"plot_cost",from:fId,to:"sheriff",status:"accepted",offeredItems:[],description:"Dodatkowy koszt 50 $ – niewłaściwa działka"});
      log("sheriff","⚖️ "+FM[fId].nom+": dodatkowy koszt 50$ – "+(plotItem?"działkę nr "+plotItem.plotNr+" (potrzebna: "+f.tPlot+")":"brak działki"));
    }
  });

  // Scores + Relations
  var relData=simRelations(fd,stats);
  var scores={};FO.forEach(fId=>{
    scores[fId]=simCalcScore(fId,fd,bf,bnbE,mapE,mapBonusClaimed);
    scores[fId].relacje=calcRelationScore(fId,relData);
    scores[fId].totalFinal=Math.round(scores[fId].bizTotal+scores[fId].relacje);
  });

  // Validation
  var totalCash=FO.reduce((s,fId)=>s+fd[fId].cash,0);
  // fateDelta = actual applied cash effects (netEffect), NOT original event amounts
  var fateDelta=0;
  var policyCost=0;
  FO.forEach(fId=>{
    if(bf[fId]&&bf[fId].rolls) bf[fId].rolls.forEach(r=>{
      if(r.event&&(r.event.type==="loss"||r.event.type==="gain")) fateDelta+=(r.netEffect!==undefined?r.netEffect:r.event.amount);
      // Track insurance cost: policyUsed>0 means bot paid for insurance
      if(r.policyUsed===100) policyCost+=50;
      else if(r.policyUsed===50) policyCost+=30;
    });
  });
  var expectedCash=2400+fateDelta-policyCost-bnbSettleCost+mapBonusCost-plotPenaltyCost;
  log("system","Gotówka: suma="+totalCash+"$ (oczekiwana≈"+expectedCash+"$"+(policyCost>0?" polisy:"+policyCost+"$":"")+")");

  var txStats={total:txs.length,acc:0,rej:0,can:0};txs.forEach(t=>{if(t.status==="accepted")txStats.acc++;else if(t.status==="rejected")txStats.rej++;else if(t.status==="cancelled")txStats.can++;});
  log("system","Transakcje: "+txStats.total+" total | "+txStats.acc+" akc | "+txStats.rej+" odrz | "+txStats.can+" anul");

  for(var nr=1;nr<=4;nr++){var cnt=0;FO.forEach(fId=>{cnt+=fd[fId].items.filter(i=>i.cat===C_MAP&&i.fragNr===nr).length;});if(cnt!==4){anomalies.push("Mapa #"+nr+": "+cnt+" kopii");log("error","Fragment mapy #"+nr+": "+cnt+" kopii!");}}

  FO.forEach(fId=>{if(scores[fId].cash<0){anomalies.push(FM[fId].nom+": ujemna kasa");log("error",FM[fId].nom+": ujemna gotówka!");}});

  if(Math.abs(totalCash-expectedCash)>1){anomalies.push("Rozbieżność gotówki: "+totalCash+"$ vs oczekiwane "+expectedCash+"$");log("warn","Rozbieżność gotówki: "+totalCash+"$ vs "+expectedCash+"$");}

  log("system","── Statystyki botów ──");
  FO.forEach(fId=>{var s=stats[fId];log(fId,FM[fId].nom+": Sprzed:"+s.prop+" Akc:"+s.acc+" Odrz:"+s.rej+" Bart→:"+s.bartS+" Bart✓:"+s.bartA);});

  var elapsed=Math.round(performance.now()-t0);
  log("system","Czas: "+elapsed+"ms");

  if(!silent) document.getElementById("validationInfo").innerHTML="Transakcje: <b>"+txStats.total+"</b> ("+txStats.acc+" zaakceptowanych) | Gotówka: <b>"+totalCash+"$</b> | Czas: <b>"+elapsed+"ms</b>"+(duelsLog.length>0?" | Pojedynki: <b>"+duelsLog.length+"</b>":"");

  return{scores:scores,anomalies:anomalies,elapsed:elapsed,fd:fd,totalCash:totalCash,txStats:txStats,bf:bf,duels:duelsLog,relations:relData};
}

// ============================================================
// MONTE CARLO
// ============================================================
function runMC(){
  if(running)return;running=true;
  logEl.innerHTML="";
  document.getElementById("resultsPanel").style.display="none";
  document.getElementById("mcPanel").style.display="none";
  document.getElementById("flowPanel").style.display="none";
  document.getElementById("duelPanel").style.display="none";
  document.getElementById("fatePanel").style.display="none";
  document.getElementById("roomInfo").style.display="none";
  document.getElementById("btnLocal").disabled=true;
  document.getElementById("btnFirebase").disabled=true;
  document.getElementById("btnMC").disabled=true;
  var N=parseInt(document.getElementById("mcRuns").value)||50;
  N=Math.max(2,Math.min(500,N));
  showStatus("Monte Carlo – 0/"+N+"...","running");
  var mode=document.getElementById("mode").value;
  var opts={bnb:document.getElementById("bnb").checked,fate:document.getElementById("fate").checked,map:document.getElementById("map").checked,rev:document.getElementById("rev").checked};

  var agg={};FO.forEach(fId=>{agg[fId]={totals:[],res:[],comp:[],cash:[],plot:[],map:[],bnb:[],wins:0};});
  var totalAnomalies=0,totalTaskIssues=0,totalElapsed=0;

  var i=0;
  function step(){
    if(i>=N){finishMC(agg,N,totalAnomalies,totalTaskIssues,totalElapsed);return;}
    initPersonalities();
    var result=runLocalSim(mode,opts,true);
    FO.forEach(fId=>{
      var s=result.scores[fId];
      agg[fId].totals.push(s.totalFinal||s.bizTotal);
      agg[fId].res.push(s.resPct);
      agg[fId].comp.push(s.compPct);
      agg[fId].cash.push(s.cashScore);
    });
    var best=null,bestScore=-999;
    FO.forEach(fId=>{var t=result.scores[fId].totalFinal||result.scores[fId].bizTotal;if(t>bestScore){bestScore=t;best=fId;}});
    if(best)agg[best].wins++;
    totalAnomalies+=result.anomalies.length;
    totalTaskIssues+=validateTasksConsistency(result.fd,result.scores).length;
    totalElapsed+=result.elapsed;
    i++;
    if(i%5===0||i===N) showStatus("Monte Carlo – "+i+"/"+N+"...","running");
    if(i%5===0) setTimeout(step,0); else step();
  }
  setTimeout(step,50);
}

function finishMC(agg,N,totalAnomalies,totalTaskIssues,totalElapsed){
  running=false;
  document.getElementById("btnLocal").disabled=false;
  document.getElementById("btnFirebase").disabled=false;
  document.getElementById("btnMC").disabled=false;
  function median(arr){var s=[...arr].sort((a,b)=>a-b);var m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2);}
  function avg(arr){return arr.length?Math.round(arr.reduce((s,v)=>s+v,0)/arr.length*10)/10:0;}
  function stdev(arr){var a=avg(arr);return arr.length>1?Math.round(Math.sqrt(arr.reduce((s,v)=>s+(v-a)**2,0)/(arr.length-1))*10)/10:0;}

  var panel=document.getElementById("mcPanel");panel.style.display="block";
  document.getElementById("mcN").textContent=N;

  var winsHtml='<div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">';
  var maxWins=Math.max(1,...FO.map(f=>agg[f].wins));
  FO.forEach(fId=>{
    var pct=Math.round(agg[fId].wins/N*100);
    var w=Math.max(6,Math.round(agg[fId].wins/maxWins*100));
    winsHtml+='<div style="text-align:center"><div style="font-size:11px;color:#8B7355">'+FM[fId].nom+'</div><div class="mc-bar" style="width:'+w+'px;background:'+FM[fId].col+'"></div><div style="font-size:18px;font-weight:900;color:'+FM[fId].col+'">'+pct+'%</div><div style="font-size:10px;color:#8B7355">'+agg[fId].wins+'/'+N+'</div></div>';
  });
  winsHtml+='</div>';
  document.getElementById("mcWins").innerHTML='<div style="font-size:13px;font-weight:700;color:#5C4A3A;margin-bottom:6px">Rozkład zwycięstw</div>'+winsHtml;

  var body=document.getElementById("mcBody");body.innerHTML="";
  FO.forEach(fId=>{
    var a=agg[fId];
    var mn=Math.min(...a.totals),mx=Math.max(...a.totals),av=avg(a.totals),md=median(a.totals),sd=stdev(a.totals);
    var barW=Math.max(6,Math.round(Math.max(0,av)*1.5));
    body.innerHTML+='<tr><td style="color:'+FM[fId].col+'">'+FM[fId].nom+'</td><td><b>'+av+'</b> <span style="font-size:10px;color:#8B7355">±'+sd+'</span></td><td>'+mn+'</td><td>'+mx+'</td><td>'+md+'</td><td>'+avg(a.res)+'%</td><td>'+avg(a.comp)+'%</td><td>'+avg(a.cash)+'</td><td style="font-weight:700;color:'+FM[fId].col+'">'+a.wins+'</td><td><div class="mc-bar" style="width:'+barW+'px;background:'+FM[fId].col+'"></div></td></tr>';
  });

  var valHtml='<div style="font-size:12px;color:#8B7355">Czas: '+Math.round(totalElapsed)+'ms (śr. '+Math.round(totalElapsed/N)+'ms/run)';
  if(totalAnomalies>0) valHtml+=' | <span class="validation-fail">Anomalie: '+totalAnomalies+'</span>';
  else valHtml+=' | <span class="validation-ok">0 anomalii</span>';
  if(totalTaskIssues>0) valHtml+=' | <span class="validation-fail">Rozbieżności TASKS: '+totalTaskIssues+'</span>';
  else valHtml+=' | <span class="validation-ok">TASKS spójne</span>';
  valHtml+='</div>';
  document.getElementById("mcValidation").innerHTML=valHtml;

  showStatus("✅ Monte Carlo – "+N+" symulacji zakończonych","pass");
  addLog("system","Monte Carlo: "+N+" symulacji | "+totalAnomalies+" anomalii | "+Math.round(totalElapsed)+"ms");
  FO.forEach(fId=>{addLog(fId,FM[fId].nom+": śr="+avg(agg[fId].totals)+" min="+Math.min(...agg[fId].totals)+" max="+Math.max(...agg[fId].totals)+" wygrane="+agg[fId].wins+"/"+N);});

  // Export button
  document.getElementById("mcExport").onclick=function(){
    var mode=document.getElementById("mode").value;
    var opts={bnb:document.getElementById("bnb").checked,fate:document.getElementById("fate").checked,map:document.getElementById("map").checked,rev:document.getElementById("rev").checked};
    var lines=[];
    lines.push("═══════════════════════════════════════════════");
    lines.push("  WDZ SYMULATOR – RAPORT MONTE CARLO");
    lines.push("═══════════════════════════════════════════════");
    lines.push("Data: "+new Date().toLocaleString("pl"));
    lines.push("Symulacji: "+N+" | Tryb: "+mode+" | BnB:"+(opts.bnb?"TAK":"NIE")+" | ŚL:"+(opts.fate?"TAK":"NIE")+" | Żyła:"+(opts.map?"TAK":"NIE")+" | Rev:"+(opts.rev?"TAK":"NIE"));
    lines.push("Czas: "+Math.round(totalElapsed)+"ms (śr. "+Math.round(totalElapsed/N)+"ms/run)");
    lines.push("Anomalie: "+totalAnomalies+" | TASKS: "+(totalTaskIssues===0?"spójne":"ROZBIEŻNOŚCI: "+totalTaskIssues));
    lines.push("");
    lines.push("── ROZKŁAD ZWYCIĘSTW ──");
    FO.forEach(fId=>{lines.push(FM[fId].nom+": "+agg[fId].wins+"/"+N+" ("+Math.round(agg[fId].wins/N*100)+"%)")});
    lines.push("");
    lines.push("── STATYSTYKI ──");
    lines.push("Rodzina      | Śr. pkt | ±SD   | Min | Max | Mediana | Śr.zas | Śr.komp | Śr.kasa | Wygrane");
    FO.forEach(fId=>{
      var a=agg[fId];var av=avg(a.totals);var sd=stdev(a.totals);var md=median(a.totals);
      lines.push(FM[fId].nom.padEnd(13)+"| "+String(av).padStart(7)+" | "+String(sd).padStart(5)+" | "+String(Math.min(...a.totals)).padStart(3)+" | "+String(Math.max(...a.totals)).padStart(3)+" | "+String(md).padStart(7)+" | "+String(avg(a.res)).padStart(5)+"% | "+String(avg(a.comp)).padStart(6)+"% | "+String(avg(a.cash)).padStart(7)+" | "+String(a.wins).padStart(7));
    });
    lines.push("");
    lines.push("Raport z WDZ Test Simulator v1.8.0");
    var blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
    var url=URL.createObjectURL(blob);var a=document.createElement("a");
    a.href=url;a.download="wdz-monte-carlo-"+N+"x-"+new Date().toISOString().slice(0,10)+".txt";
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  };
  document.getElementById("mcExport").style.display="inline-block";
}

// ============================================================
// FIREBASE SIMULATOR
// ============================================================
var fbDb=null,fbRoom=null,fbStopped=false;

async function runFirebase(){
  if(running)return;running=true;fbStopped=false;
  logEl.innerHTML="";
  document.getElementById("resultsPanel").style.display="none";
  document.getElementById("btnLocal").disabled=true;
  document.getElementById("btnFirebase").disabled=true;
  document.getElementById("btnStop").disabled=false;
  showStatus("Symulacja Firebase – inicjalizacja...","running");

  var mode=document.getElementById("mode").value;
  var opts={bnb:document.getElementById("bnb").checked,fate:document.getElementById("fate").checked,map:document.getElementById("map").checked,rev:document.getElementById("rev").checked};
  var rounds=mode==="stress"?5:mode==="realistic"?3:2;
  var turnDelay=mode==="realistic"?3000:mode==="stress"?200:500;

  try{
    // Validate room code
    var inputCode=document.getElementById("fbRoomCode").value.trim().toUpperCase();
    if(!inputCode||!/^WDZ-[A-HJ-NP-Z2-9]{6}$/.test(inputCode)){
      addLog("error","Wpisz prawidłowy kod rozgrywki (WDZ-XXXXXX)");
      showStatus("❌ Nieprawidłowy kod","fail");
      throw new Error("stop");
    }
    fbRoom=inputCode;

    if(!fbDb){
      var app=window.firebase.initializeApp(WDZ_FIREBASE_CONFIG,"sim-"+Date.now());
      fbDb=window.firebase.database(app);
      addLog("system","Logowanie anonimowe...");
      await window.firebase.auth(app).signInAnonymously();
      addLog("system","Zalogowano");
    }

    addLog("sheriff","Łączenie z roomem: "+fbRoom);
    document.getElementById("roomCodeDisplay").textContent=fbRoom;
    document.getElementById("roomInfo").style.display="block";

    // Verify room exists
    var metaSnap=await fbDb.ref("rooms/"+fbRoom+"/meta").once("value");
    if(!metaSnap.exists()){
      addLog("error","Room "+fbRoom+" nie istnieje! Utwórz go najpierw w grze.");
      showStatus("❌ Room nie istnieje","fail");
      throw new Error("stop");
    }
    addLog("system","Room znaleziony ✓");

    // P0 Safety: check if room has existing game data
    var existingGs=await fbDb.ref("rooms/"+fbRoom+"/gameState").once("value");
    var meta=metaSnap.val();
    if(existingGs.exists() && (meta.status==="playing" || (existingGs.val().gameStarted))) {
      if(!confirm("⚠️ UWAGA: Rozgrywka "+fbRoom+" jest aktywna (status: "+(meta.status||"?")+").\n\nSymulator NADPISZE cały stan gry.\nTa operacja jest DESTRUKCYJNA i nieodwracalna.\n\nCzy na pewno kontynuować?")) {
        addLog("system","Anulowano – użytkownik przerwał.");
        showStatus("Anulowano","fail");
        throw new Error("stop");
      }
      addLog("warn","⚠️ Nadpisywanie aktywnej rozgrywki – potwierdzone przez użytkownika");
    }

    // Init game state (overwrite)
    var fd=genStart();
    var stageDurations={};STAGES.forEach(s=>{stageDurations[s.id]=s.defMin;});
    await fbDb.ref("rooms/"+fbRoom+"/gameState").set({fd:fd,txs:[],blindFate:{},mapBonusClaimed:{},mapLayout:{adams:[0,0,0,0],bennet:[0,0,0,0],clinton:[0,0,0,0],dexter:[0,0,0,0]},mapEnabled:opts.map,consultations:{},consultNotes:{adams:"",bennet:"",clinton:"",dexter:""},plotPenalties:{},relations:{},relationsUnlocked:false,biznesNaBoku:{},bnbEnabled:false,bnbSettled:false,fateEnabled:false,showResults:false,debriefUnlocked:false,debriefFullAccess:false,debriefCorrectMode:false,revEnabled:opts.rev,revMaxBet:60,revMode:"arena",revDuels:[],revActive:"__empty__",devMode:false,tutorialDone:{},gameStarted:false,stageIdx:-1,stageDurations:stageDurations,timerRunning:false,timerPaused:false,timerStartedAt:0,timerDuration:0,timerPausedSecondsLeft:null,sheriffCalls:[]});
    addLog("system","GameState zainicjalizowany");

    // Register bots as family players
    for(var fId of FO){
      await fbDb.ref("rooms/"+fbRoom+"/players/"+fId+"/members/sim_bot").set({name:FM[fId].nom+" Bot",lastSeen:window.firebase.database.ServerValue.TIMESTAMP});
    }
    addLog("system","Boty dołączyły");

    // Ensure status is "playing"
    await fbDb.ref("rooms/"+fbRoom+"/meta/status").set("playing");
    showStatus("Symulacja Firebase – "+fbRoom+" – boty handlują...","running");

    // Run stages
    var gsRef=fbDb.ref("rooms/"+fbRoom+"/gameState");
    var bnbE=false,bf={};

    for(var idx=0;idx<STAGES.length&&!fbStopped;idx++){
      var stage=STAGES[idx];
      addLog("sheriff","▶️ ["+idx+"/"+(STAGES.length-1)+"] "+stage.label);

      // Read current state from Firebase
      var gsSnap=await gsRef.once("value");var gs=gsSnap.val();
      fd=gs.fd||fd;
      var txs=toArr(gs.txs);

      // Cancel pending txs from PREVIOUS stage
      txs.forEach(t=>{if(t.status==="pending"||t.status==="awaiting_response"||t.status==="pending_partner"){t.status="cancelled";}});

      // Write stage change
      var now=Date.now();
      await gsRef.update({stageIdx:idx,gameStarted:true,timerDuration:stage.defMin*60,timerStartedAt:now,timerPausedSecondsLeft:null,timerPaused:false,timerRunning:stage.defMin>0,txs:txs});

      if(stage.type==="turn"){
        var pairs=PAIRINGS[stage.pairingIdx];
        addLog("system","  Pary: "+pairs.map(p=>p.map(f=>FM[f].nom).join(" ↔ ")).join("  |  "));

        for(var r=0;r<rounds&&!fbStopped;r++){
          // Re-read fresh state
          var snap2=await gsRef.once("value");var gs2=snap2.val();
          fd=gs2.fd;txs=toArr(gs2.txs);

          // === PASS 1: All bots propose ===
          for(var fi=0;fi<FO.length;fi++){
            var botId=FO[fi];
            var partner=getMeetingPartner(botId,stage.pairingIdx);if(!partner)continue;
            var prop=genProposal(botId,partner,fd,stage.phase);
            if(!prop)continue;
            if(prop.type==="sale"){
              txs.unshift({id:txId(),type:"sale",from:botId,to:partner,offeredItems:prop.items,price:prop.price,status:"pending"});
              addLog(botId,"📤 Sprzedaż → "+FM[partner].nom+": "+prop.items.map(i=>i.name).join(", ")+" za "+prop.price+"$");
            }else if(prop.type==="sale_buy"){
              txs.unshift({id:txId(),type:"sale",from:partner,to:botId,offeredItems:prop.items,price:prop.price,status:"pending"});
              addLog(botId,"💰 Kupuję od "+FM[partner].nom+": "+prop.items.map(i=>i.name).join(", ")+" za "+prop.price+"$");
            }else{
              var btx={id:txId(),type:"barter",from:botId,to:partner,offeredItems:prop.items,offeredCash:prop.cash||0,responseItems:null,responseCash:0,status:"awaiting_response"};
              if(prop.wantItems){btx.responseItems=prop.wantItems;btx.responseCash=0;btx.status="pending_partner";}
              txs.unshift(btx);
              addLog(botId,"📤 Barter → "+FM[partner].nom+": ["+prop.items.map(i=>i.name).join(", ")+"]"+(prop.wantItems?" za ["+prop.wantItems.map(i=>i.name).join(", ")+"]":""));
            }
          }

          // === PASS 2: All bots respond to pending offers ===
          for(var fi2=0;fi2<FO.length;fi2++){
            var botId2=FO[fi2];
            for(var ti=0;ti<txs.length;ti++){
              var tx=txs[ti];
              // Accept/reject sales TO me
              if(tx.type==="sale"&&tx.status==="pending"&&tx.to===botId2){
                var ev=evalSale(botId2,tx,fd);
                if(ev.accept){var vr=validateAndApplyTx(fd,tx);if(vr.ok){fd=vr.newFd;tx.status="accepted";addLog(botId2,"✅ Akceptuję od "+FM[tx.from].nom+": "+ev.reason);}else{tx.status="rejected";}}
                else{tx.status="rejected";addLog(botId2,"❌ Odrzucam od "+FM[tx.from].nom+": "+ev.reason);}
              }
              // Respond to barter awaiting my response
              if(tx.type==="barter"&&tx.status==="awaiting_response"&&tx.to===botId2){
                var resp=selectResp(botId2,fd);
                if(resp.items.length||resp.cash){tx.responseItems=resp.items;tx.responseCash=resp.cash;tx.status="pending";addLog(botId2,"📤 Kontr-oferta → "+FM[tx.from].nom+": "+resp.items.map(i=>i.name).join(", "));}
                else{tx.status="rejected";}
              }
              // Evaluate pre-defined barter (proponent specified wantItems)
              if(tx.type==="barter"&&tx.status==="pending_partner"&&tx.to===botId2){
                var iGet=tx.offeredItems.filter(i=>isNeeded(i,botId2)).length;
                var iLose=tx.responseItems?tx.responseItems.filter(i=>isNeeded(i,botId2)).length:0;
                if(iGet>0&&iLose===0){
                  var vr3=validateAndApplyTx(fd,tx);if(vr3.ok){fd=vr3.newFd;tx.status="accepted";addLog(botId2,"✅ Barter od "+FM[tx.from].nom+": dostaję "+iGet+" potrzebnych kart");}else{tx.status="rejected";}
                }else if(iGet>=iLose){
                  var vr3=validateAndApplyTx(fd,tx);if(vr3.ok){fd=vr3.newFd;tx.status="accepted";addLog(botId2,"✅ Barter od "+FM[tx.from].nom+": korzystna wymiana");}else{tx.status="rejected";}
                }else{tx.status="rejected";addLog(botId2,"❌ Odrzucam barter od "+FM[tx.from].nom);}
              }
            }
          }

          // === PASS 3: Original proposers accept/reject barter counter-offers ===
          for(var fi3=0;fi3<FO.length;fi3++){
            var botId3=FO[fi3];
            for(var ti2=0;ti2<txs.length;ti2++){
              var tx2=txs[ti2];
              if(tx2.type==="barter"&&tx2.status==="pending"&&tx2.from===botId3&&tx2.responseItems){
                var ev2=evalBarter(botId3,tx2);
                if(ev2.accept){var vr2=validateAndApplyTx(fd,tx2);if(vr2.ok){fd=vr2.newFd;tx2.status="accepted";addLog(botId3,"✅ Barter z "+FM[tx2.to].nom+": "+ev2.reason);}else{tx2.status="rejected";}}
                else{tx2.status="rejected";}
              }
            }
          }

          // === Write fully resolved state to Firebase ===
          await gsRef.update({fd:fd,txs:txs});
          addLog("system","  Firebase sync ✓ (akc: "+txs.filter(t=>t.status==="accepted").length+")");

          // === Rewolwerowiec – duele po handlu ===
          if(opts.rev){
            var duelsThisTurn=simDuels(fd,stage.pairingIdx,[],addLog);
            if(duelsThisTurn.length>0) await gsRef.update({fd:fd});
          }

          await sleep(turnDelay);
        }
      }

      if(stage.type==="narada"){
        if(stage.id==="NAR1"&&opts.bnb){
          addLog("sheriff","💼 Biznes na Boku");
          var fdSnap2=await gsRef.child("fd").once("value");fd=fdSnap2.val();
          FO.forEach(fId2=>{var items=toArr(fd[fId2].items);fd[fId2].items=items.concat(makeBnb(fId2));});
          await gsRef.update({fd:fd,bnbEnabled:true});bnbE=true;
        }
        if((stage.id==="NAR1"||stage.id==="NAR2")&&opts.fate){
          await gsRef.child("fateEnabled").set(true);
          var bfSnap=await gsRef.child("blindFate").once("value");bf=bfSnap.val()||{};
          var fdSnap3=await gsRef.child("fd").once("value");fd=fdSnap3.val();
          for(var fId3 of FO){
            var policyUsed3=botBuyPolicy(fId3,fd);
            if(policyUsed3>0) addLog("sheriff","🛡 "+FM[fId3].nom+" kupił polisę "+policyUsed3+"%");
            var d1=Math.floor(Math.random()*6)+1,d2=Math.floor(Math.random()*6)+1,sum=d1+d2;
            var ev3=BLIND_FATE_EVENTS[sum]||null;
            if(!bf[fId3])bf[fId3]={rolls:[]};if(!Array.isArray(bf[fId3].rolls))bf[fId3].rolls=bf[fId3].rolls?Object.values(bf[fId3].rolls):[];
            var netEffect3=0,netEffectText3="";
            if(ev3){
              if(ev3.type==="loss"){
                var amt3=ev3.amount;
                if(policyUsed3===100) amt3=0;
                else if(policyUsed3===50) amt3=Math.round(amt3/2);
                netEffect3=amt3;fd[fId3].cash=Math.max(0,fd[fId3].cash+amt3);
              } else if(ev3.type==="gain"){
                netEffect3=ev3.amount;fd[fId3].cash+=ev3.amount;
              } else if(ev3.type==="gain_policy"){
                var pGain3=policyUsed3===100?100:policyUsed3===50?60:0;
                fd[fId3].cash+=pGain3;netEffect3=pGain3;
                netEffectText3=pGain3>0?"+"+pGain3+" $":"0 $ (brak polisy)";
              } else if(ev3.type==="loss_resources"){
                var pen3=policyUsed3===100?0:policyUsed3===50?5:10;
                netEffectText3=pen3===0?"brak utraty zasobów":"utrata "+pen3+"% zasobów";
              }
              if(!netEffectText3&&netEffect3!==0) netEffectText3=(netEffect3>0?"+":"")+netEffect3+" $";
            }
            bf[fId3].rolls.push({dice1:d1,dice2:d2,sum:sum,event:ev3,resolved:true,policyUsed:policyUsed3,netEffect:netEffect3,netEffectText:netEffectText3});
            if(ev3) addLog("sheriff","🎲 "+FM[fId3].nom+": "+d1+"+"+d2+"="+sum+" → "+ev3.text+(netEffect3!==0?" ("+netEffect3+"$)":"")+(policyUsed3>0?" [polisa "+policyUsed3+"%]":""));
            else addLog("sheriff","🎲 "+FM[fId3].nom+": "+d1+"+"+d2+"="+sum);
          }
          await gsRef.update({blindFate:bf,fd:fd});
        }
        await sleep(turnDelay);
      }

      if(stage.type==="kn")await sleep(Math.round(turnDelay/2));
    }

    // Guard: if stopped, skip all finalization
    if(fbStopped) {
      addLog("system","⏹ Pominięto finalizację – symulacja zatrzymana");
      // Cleanup bots
      for(var cfId of FO) await fbDb.ref("rooms/"+fbRoom+"/players/"+cfId+"/members/sim_bot").remove();
      addLog("system","Boty usunięte z rozgrywki");
      throw new Error("stop");
    }

    // BnB settlement (rozliczenie z dostawcą)
    var finalSnap0=await gsRef.once("value");var gs0=finalSnap0.val();
    fd=gs0.fd;var txsFinal=toArr(gs0.txs);
    if(gs0.bnbEnabled){
      FO.forEach(fId5=>{
        var items5=toArr(fd[fId5].items);
        var ownCards=items5.filter(i=>i.cat===C_BNB&&i.bnbOrigin===fId5);
        var soldAll=ownCards.length===0;
        var cost=300,bonus=soldAll?100:0;
        var netCost=Math.min(cost-bonus,fd[fId5].cash);
        fd[fId5].cash-=netCost;
        txsFinal.push({id:"bnbs-"+fId5,type:"bnb_settle",from:fId5,to:"dostawca",status:"accepted",offeredItems:[],description:"Opłata dla dostawcy – 300 $"});
        if(soldAll) txsFinal.push({id:"bnbb-"+fId5,type:"bnb_bonus",from:"dostawca",to:fId5,status:"accepted",offeredItems:[],description:"Rabat od dostawcy – 100 $"});
        addLog("sheriff","💰 "+FM[fId5].nom+": rozliczenie BnB – "+(cost-bonus)+"$"+(soldAll?" (rabat 100$)":""));
      });
      await gsRef.update({fd:fd,txs:txsFinal,bnbSettled:true});
      addLog("system","BnB rozliczony z dostawcą");
    }

    // Relations (informacja zwrotna)
    var snapForRel=await gsRef.once("value");var gsForRel=snapForRel.val();
    fd=gsForRel.fd;
    var relStats={};FO.forEach(fId6=>{relStats[fId6]={prop:0,acc:0,rej:0,bartS:0,bartA:0};});
    toArr(gsForRel.txs).forEach(tx=>{
      if(!tx||!tx.from||!tx.to)return;
      if(relStats[tx.from])relStats[tx.from].prop++;
      if(tx.status==="accepted"&&relStats[tx.from])relStats[tx.from].acc++;
      if(tx.status==="rejected"&&relStats[tx.from])relStats[tx.from].rej++;
    });
    var relData=simRelations(fd,relStats);
    await gsRef.update({relations:relData,relationsUnlocked:true});
    addLog("system","Relacje wygenerowane i zapisane");

    // Map bonus auto-claim (300$ za komplet – tylko pierwsza rodzina)
    var snapMap=await gsRef.once("value");var gsMap=snapMap.val();
    fd=gsMap.fd;txsFinal=toArr(gsMap.txs);
    if(gsMap.mapEnabled){
      var mapChanged=false;
      var fbMapWinner=null;
      FO.forEach(fId7=>{
        if(fbMapWinner) return;
        var items7=toArr(fd[fId7].items);
        var uniqueFrags=new Set(items7.filter(i=>i.cat===C_MAP).map(i=>i.fragNr));
        if(uniqueFrags.size>=4) fbMapWinner=fId7;
      });
      if(fbMapWinner){
        // Zwycięzca: +300$, piąty fragment
        fd[fbMapWinner].cash+=300;
        var items_w=toArr(fd[fbMapWinner].items);
        items_w.push({id:"map-frag-5-"+fbMapWinner,name:"Piąty fragment mapy",cat:C_MAP,fragNr:5});
        fd[fbMapWinner].items=items_w;
        txsFinal.push({id:"mb-"+fbMapWinner,type:"map_bonus",from:"bank",to:fbMapWinner,status:"accepted",offeredItems:[],description:"Premia za komplet mapy – 300 $"});
        addLog("sheriff","🗺️ "+FM[fbMapWinner].nom+": premia za Złotodajną Żyłę – +300$, piąty fragment!");
        // Pozostałe: -100$ każda
        FO.forEach(fId7b=>{
          if(fId7b===fbMapWinner) return;
          fd[fId7b].cash-=100;
          txsFinal.push({id:"mb-cost-"+fId7b,type:"map_bonus",from:fId7b,to:fbMapWinner,status:"accepted",offeredItems:[],description:"Koszt premii za Złotodajną Żyłę – -100 $"});
        });
        addLog("sheriff","🗺️ Pozostałe rodziny: -100$ za premię "+FM[fbMapWinner].gen);
        mapChanged=true;
      }
      var fbMBC={};if(fbMapWinner)fbMBC[fbMapWinner]=true;
      // Set correct mapLayout for winner
      var fbMapLayout=gsMap.mapLayout||{adams:[0,0,0,0],bennet:[0,0,0,0],clinton:[0,0,0,0],dexter:[0,0,0,0]};
      if(fbMapWinner) fbMapLayout[fbMapWinner]=[4,3,2,1];
      if(mapChanged) await gsRef.update({fd:fd,txs:txsFinal,mapBonusClaimed:fbMBC,mapLayout:fbMapLayout});
    }

    // Plot penalty (50$ za złą działkę)
    var snapPlot=await gsRef.once("value");var gsPlot=snapPlot.val();
    fd=gsPlot.fd;txsFinal=toArr(gsPlot.txs);
    var plotChanged=false;
    FO.forEach(fId8=>{
      var f8=FM[fId8];
      var items8=toArr(fd[fId8].items);
      var plotItem=items8.find(i=>i.cat===C_PLOT);
      var plotOk=plotItem&&plotItem.plotNr===f8.tPlot;
      if(!plotOk){
        var penalty=Math.min(50,fd[fId8].cash);
        fd[fId8].cash-=penalty;
        txsFinal.push({id:"pp-"+fId8,type:"plot_cost",from:fId8,to:"sheriff",status:"accepted",offeredItems:[],description:"Dodatkowy koszt 50 $ – niewłaściwa działka"});
        addLog("sheriff","⚖️ "+FM[fId8].nom+": dodatkowy koszt 50$ – "+(plotItem?"działkę nr "+plotItem.plotNr:"brak działki"));
        plotChanged=true;
      }
    });
    if(plotChanged) await gsRef.update({fd:fd,txs:txsFinal});

    // Final scores
    var finalSnap=await gsRef.once("value");var finalGs=finalSnap.val();
    var scores={};FO.forEach(fId4=>{scores[fId4]=simCalcScore(fId4,finalGs.fd,finalGs.blindFate||{},finalGs.bnbEnabled,finalGs.mapEnabled,finalGs.mapBonusClaimed||{});});
    showScores(scores);
    addLog("system","🏁 Symulacja Firebase zakończona");
    // Set room as finished and cleanup bots
    await fbDb.ref("rooms/"+fbRoom+"/meta/status").set("finished");
    for(var cfId2 of FO) await fbDb.ref("rooms/"+fbRoom+"/players/"+cfId2+"/members/sim_bot").remove();
    addLog("system","Room "+fbRoom+" oznaczony jako finished, boty usunięte.");
    showStatus("✅ Firebase – zakończono (room: "+fbRoom+")","pass");

  }catch(e){
    if(e.message!=="stop"){addLog("error","CRASH: "+e.message);showStatus("❌ CRASH: "+e.message,"fail");}
  }

  running=false;
  document.getElementById("btnLocal").disabled=false;
  document.getElementById("btnFirebase").disabled=false;
  document.getElementById("btnMC").disabled=false;
  document.getElementById("btnStop").disabled=true;
}

function stopSim(){
  fbStopped=true;
  addLog("system","⏹ Zatrzymano przez użytkownika");
  showStatus("Zatrzymano","fail");
  running=false;
  document.getElementById("btnLocal").disabled=false;
  document.getElementById("btnFirebase").disabled=false;
  document.getElementById("btnMC").disabled=false;
  document.getElementById("btnStop").disabled=true;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function toArr(v){if(!v)return[];if(Array.isArray(v))return v;return Object.values(v);}


/* Expose functions for HTML onclick handlers */
window.runLocal = runLocal;
window.runMC = runMC;
window.stopSim = stopSim;
window.runFirebase = runFirebase;

/* URL param: ?room=WDZ-XXXXXX → pre-fill room code */
(function(){
  var params = new URLSearchParams(window.location.search);
  var room = params.get("room");
  if(room) {
    var el = document.getElementById("fbRoomCode");
    if(el) el.value = room.toUpperCase();
  }
})();
