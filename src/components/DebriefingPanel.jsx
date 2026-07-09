/* WDZ Online – components/DebriefingPanel.jsx */
import { FM, FO, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS, STAGES } from "../game/constants.js";
import Chart from "chart.js/auto";
import { calcScore, calcRelationScore, fmtItems, buildView } from "../game/scoring.js";
import { IMG_BASE, toSlug, imgUrl, mapImgUrl, getRevImg, ensureArray } from "../utils/index.js";
import { btnS, InfoPopup, StarRating, TaskHeader } from "./ui.jsx";
import { ResourceCard, CompCard, NoteCard } from "./cards.jsx";
import { PlotDisplay } from "./PlotDisplay.jsx";
import { MapTracker } from "./MapTracker.jsx";
import { BnbTab } from "./BnbTab.jsx";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

export function DebriefingPanel({viewMode,familyId,fd,txs,blindFate,relations,revDuels,debriefFullAccess,debriefTab,setDebriefTab,readOnly,debriefNotes,setDebriefNotes,debriefUnlocked,setDebriefUnlocked,setDebriefFullAccess,showMsg,mapEnabled,bnbEnabled,biznesNaBoku,fateEnabled,plotPenalties,onArchive,mapBonusClaimed}){
  const [publicView,setPublicView]=useState(false);
  const [selectedFamily,setSelectedFamily]=useState("adams");
  const barChartRef=useRef(null);
  const radarChartRef=useRef(null);
  const barChartInst=useRef(null);
  const radarChartInst=useRef(null);
  
  const isSheriff=viewMode==="sheriff";
  const showNotes=isSheriff&&!publicView;
  const activeFamily=isSheriff?selectedFamily:familyId;
  
  const F=["adams","bennet","clinton","dexter"];
  const FN={adams:"Adamsowie",bennet:"Bennetowie",clinton:"Clintonowie",dexter:"Dexterowie"};
  const FC={adams:"#A75F4A",bennet:"#726072",clinton:"#5E5971",dexter:"#5B7674"};
  const ALL_CATS=["zasoby","kompetencje","gotowka","dzialka","mapa","relacje"];
  const CATS=mapEnabled?ALL_CATS:ALL_CATS.filter(c=>c!=="mapa");
  const CATS_LABEL={zasoby:"Zasoby",kompetencje:"Kompetencje",gotowka:"Gotówka",dzialka:"Działka",mapa:"Złotodajna Żyła",relacje:"Relacje"};
  const CATS_MAX={zasoby:30,kompetencje:25,gotowka:25,dzialka:10,mapa:10,relacje:20};
  const PAIRS=["adams-bennet","adams-clinton","adams-dexter","bennet-clinton","bennet-dexter","clinton-dexter"];
  
  const TASKS={
    adams:{name:"Saloon",zasoby:[{id:"stara-destylarnia",name:"Stara Destylarnia",pct:30},{id:"pianino",name:"Pianino",pct:20},{id:"kredens",name:"Kredens",pct:20},{id:"debowa-beczka",name:"Dębowa Beczka",pct:10},{id:"talia-kart",name:"Talia Kart",pct:10},{id:"mosiezny-zyrandol",name:"Mosiężny Żyrandol",pct:5},{id:"zeliwny-kociolek",name:"Żeliwny Kociołek",pct:5}],kompetencje:[{id:"organizowanie-turniejow-pokera",name:"Organizowanie Turniejów Pokera",pct:43},{id:"pedzenie-szkockiej-whisky",name:"Pędzenie Szkockiej Whisky",pct:27},{id:"prowadzenie-kuchni-zbiorowej",name:"Prowadzenie Kuchni Zbiorowej",pct:18},{id:"przechowywanie-piwa",name:"Przechowywanie Piwa",pct:12}]},
    bennet:{name:"Zakład Pogrzebowy",zasoby:[{id:"zestaw-narzedzi",name:"Zestaw Narzędzi",pct:30},{id:"czarny-material",name:"Czarny Materiał",pct:20},{id:"drewniany-wozek",name:"Drewniany Wózek",pct:20},{id:"szpadel",name:"Szpadel",pct:10},{id:"dluto-do-kamienia",name:"Dłuto do Kamienia",pct:10},{id:"zestaw-wizazysty",name:"Zestaw Wizażysty",pct:5},{id:"podest-dla-mowcy",name:"Podest dla Mówcy",pct:5}],kompetencje:[{id:"podstawy-stolarstwa",name:"Podstawy Stolarstwa",pct:43},{id:"sztuka-balsamowania",name:"Sztuka Balsamowania",pct:27},{id:"podstawy-makijazu-posmiertnego",name:"Podstawy Makijażu Pośmiertnego",pct:18},{id:"wyglaszanie-mow-pogrzebowych",name:"Wygłaszanie Mów Pogrzebowych",pct:12}]},
    clinton:{name:"Bank",zasoby:[{id:"sejf",name:"Sejf",pct:30},{id:"liczydlo",name:"Liczydło",pct:20},{id:"karabin",name:"Karabin",pct:20},{id:"stalowe-drzwi",name:"Stalowe Drzwi",pct:10},{id:"kasetka",name:"Kasetka",pct:10},{id:"lupa",name:"Lupa",pct:5},{id:"waga-jubilerska",name:"Waga Jubilerska",pct:5}],kompetencje:[{id:"zapewnienie-bezpieczenstwa",name:"Zapewnienie Bezpieczeństwa",pct:43},{id:"obsluga-zamka-szyfrowego",name:"Obsługa Zamka Szyfrowego",pct:27},{id:"biegla-obsluga-liczydla",name:"Biegła Obsługa Liczydła",pct:18},{id:"ocena-wartosci-samorodkow",name:"Ocena Wartości Samorodków",pct:12}]},
    dexter:{name:"Ranczo",zasoby:[{id:"lasso",name:"Lasso",pct:30},{id:"siodlo",name:"Siodło",pct:20},{id:"colt-navy-1857",name:"Colt Navy 1857",pct:20},{id:"wysokie-buty",name:"Wysokie Buty",pct:10},{id:"manierka",name:"Manierka",pct:10},{id:"kapelusz",name:"Kapelusz",pct:5},{id:"pas-z-kabura",name:"Pas z Kaburą",pct:5}],kompetencje:[{id:"poslugiwanie-sie-lassem",name:"Posługiwanie się Lassem",pct:43},{id:"leczenie-chorob-bydla",name:"Leczenie Chorób Bydła",pct:27},{id:"szybkostrzelnosc-i-celnosc-oka",name:"Szybkostrzelność i Celność Oka",pct:18},{id:"odnajdywanie-zrodel-wody",name:"Odnajdywanie Źródeł Wody",pct:12}]}
  };
  const STARTING_RES={
    adams:["debowa-beczka","mosiezny-zyrandol","zeliwny-kociolek","zestaw-narzedzi","karabin","siodlo","lupa","waga-jubilerska","zestaw-skalpeli","zakraplacz"],
    bennet:["lasso","czarny-material","pianino","colt-navy-1857","wysokie-buty","telegraf","zestaw-stempli","tygiel"],
    clinton:["stara-destylarnia","kredens","drewniany-wozek","stalowe-drzwi","kasetka","szpadel","stojacy-zegar","wigwam"],
    dexter:["sejf","liczydlo","talia-kart","manierka","dluto-do-kamienia","kapelusz","pas-z-kabura","zestaw-wizazysty","podest-dla-mowcy","30-letnia-whisky"]
  };
  const STARTING_COMP={
    adams:["podstawy-stolarstwa","obsluga-zamka-szyfrowego","odnajdywanie-zrodel-wody","szybkostrzelnosc-i-celnosc-oka","pisanie-kaligraficzne"],
    bennet:["zapewnienie-bezpieczenstwa","leczenie-chorob-bydla","przechowywanie-piwa","biegla-obsluga-liczydla","zabawianie-gosci-na-imprezach"],
    clinton:["pedzenie-szkockiej-whisky","prowadzenie-kuchni-zbiorowej","podstawy-makijazu-posmiertnego","poslugiwanie-sie-lassem","leczenie-ran-postrzalowych"],
    dexter:["organizowanie-turniejow-pokera","sztuka-balsamowania","ocena-wartosci-samorodkow","wyglaszanie-mow-pogrzebowych","cechowanie-metali-szlachetnych"]
  };
  const ZMYLKI_RES=["zestaw-skalpeli","zakraplacz","telegraf","zestaw-stempli","tygiel","stojacy-zegar","wigwam","30-letnia-whisky"];
  const ZMYLKI_COMP=["pisanie-kaligraficzne","zabawianie-gosci-na-imprezach","leczenie-ran-postrzalowych","cechowanie-metali-szlachetnych"];
  
  function calcScores(){
    var scores={};
    F.forEach(f=>{
      var sc=calcScore(f,fd,plotPenalties,biznesNaBoku,bnbEnabled,blindFate,mapEnabled,mapBonusClaimed);
      var relPts=Math.round(calcRelationScore(f,relations));
      scores[f]={zasoby:sc.resScore,kompetencje:sc.compScore,gotowka:sc.cashScore,dzialka:sc.plotScore,mapa:sc.mapScore,relacje:relPts,bnb:sc.bnb};
    });
    return scores;
  }
  var scores=calcScores();
  function tot(f){return CATS.reduce((s,c)=>s+(scores[f][c]||0),0)+(scores[f].bnb||0);}
  
  function calcTxPerPhase(){
    var result={adams:[0,0,0,0,0,0,0,0,0],bennet:[0,0,0,0,0,0,0,0,0],clinton:[0,0,0,0,0,0,0,0,0],dexter:[0,0,0,0,0,0,0,0,0]};
    txs.forEach((tx,i)=>{
      var phase=tx.phase!==undefined?tx.phase:Math.min(8,Math.floor(i/(txs.length/9)));
      if(tx.from&&result[tx.from])result[tx.from][phase]++;
      if(tx.to&&result[tx.to])result[tx.to][phase]++;
    });
    return result;
  }
  
  function calcTradeMatrix(){
    var result={};
    PAIRS.forEach(p=>{result[p]={c:0,v:0};});
    txs.forEach(tx=>{
      if(tx.status!=="accepted")return;
      if(tx.type!=="sale"&&tx.type!=="barter")return;
      var pair=[tx.from,tx.to].sort().join("-");
      if(result[pair]){
        result[pair].c++;
        if(tx.type==="sale") result[pair].v+=(tx.price||0);
        else result[pair].v+=((tx.offeredCash||0)+(tx.responseCash||0));
      }
    });
    return result;
  }
  
  function hmColor(n){
    if(n===0)return"#F0EBE0";if(n===1)return"#F5E0A0";if(n<=3)return"#E8C060";if(n===4)return"#D4A853";return"#8B5E20";
  }
  
  function updateNote(key,val){if(setDebriefNotes)setDebriefNotes(n=>({...n,[key]:val}));}
  function updateFamilyNote(fam,val){if(setDebriefNotes)setDebriefNotes(n=>({...n,rodziny:{...n.rodziny,[fam]:val}}));}
  
  var ranked=[...F].sort((a,b)=>tot(b)-tot(a));
  var txPerPhase=calcTxPerPhase();
  var tradeMatrix=calcTradeMatrix();
  
  useEffect(()=>{
    if(debriefTab!=="wyniki"||!barChartRef.current||(viewMode==="player"&&!debriefFullAccess))return;
    if(barChartInst.current)barChartInst.current.destroy();
    var ctx=barChartRef.current.getContext("2d");
    barChartInst.current=new Chart(ctx,{
      type:"bar",
      data:{labels:F.map(f=>FN[f]),datasets:[
        {label:"Biznes",data:F.map(f=>{var s=scores[f];return (s.zasoby||0)+(s.kompetencje||0)+(s.gotowka||0)+(s.dzialka||0)+(s.mapa||0)+(s.bnb||0);}),backgroundColor:"#7B8854",borderWidth:0},
        {label:"Relacje",data:F.map(f=>scores[f].relacje||0),backgroundColor:"#B83B3B",borderWidth:0}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{stacked:true,ticks:{display:false}},y:{stacked:true,min:0,max:120,ticks:{stepSize:10}}}}
    });
    return ()=>{if(barChartInst.current)barChartInst.current.destroy();};
  },[debriefTab,debriefFullAccess,JSON.stringify(scores)]);
  
  useEffect(()=>{
    if(debriefTab!=="profil"||!radarChartRef.current||(viewMode==="player"&&!debriefFullAccess))return;
    if(radarChartInst.current)radarChartInst.current.destroy();
    var ctx=radarChartRef.current.getContext("2d");
    radarChartInst.current=new Chart(ctx,{
      type:"radar",
      data:{labels:CATS.map(c=>CATS_LABEL[c]),datasets:F.map(f=>({label:FN[f],data:CATS.map(c=>Math.round(((scores[f][c]||0)/CATS_MAX[c])*100)),borderColor:FC[f],backgroundColor:FC[f]+"40",borderWidth:2}))},
      options:{responsive:true,maintainAspectRatio:false,scales:{r:{suggestedMin:0,max:100,ticks:{stepSize:20,font:{size:14}},pointLabels:{font:{size:16,weight:500}}}},plugins:{legend:{position:"bottom",labels:{font:{size:14}}}}}
    });
    return ()=>{if(radarChartInst.current)radarChartInst.current.destroy();};
  },[debriefTab,debriefFullAccess,JSON.stringify(scores)]);
  
  // Render zadań dla wybranej rodziny
  function renderFamilyTasks(fId){
    var fam=fd[fId]||{};var items=fam.items||[];var task=TASKS[fId];var cash=fam.cash!=null?fam.cash:600;
    var myResIds=items.filter(i=>i.cat==="res").map(r=>toSlug(r.name));
    var myCompIds=items.filter(i=>i.cat==="comp").map(c=>toSlug(c.name));
    var myPlots=items.filter(i=>i.cat==="plot");
    var myMaps=items.filter(i=>i.cat==="map");
    var uniqueMapCount=[...new Set(myMaps.map(m=>m.fragNr))].length;
    var hasCorrectPlot=myPlots.some(p=>p.plotNr===FM[fId].tPlot);
    
    var resPct=task.zasoby.reduce((s,z)=>s+(myResIds.includes(z.id)?z.pct:0),0);
    var resPctBase=resPct;
    // BnB cards
    var bnbCards=items.filter(i=>i.cat===C_BNB);
    var bnbKurier=bnbCards.filter(i=>i.effect==="res4").length;
    var bnbMikstura=bnbCards.filter(i=>i.effect==="comp4").length;
    var bnbObligacje=bnbCards.filter(i=>i.effect==="cash20").length;
    var bnbKwatera=bnbCards.filter(i=>i.effect==="point1").length;
    var bnbKurierBonus=0, bnbMiksturaBonus=0;
    if(bnbEnabled){
      if(resPct>=100){bnbKurierBonus=bnbKurier;}
      else{resPct=Math.min(100, resPct+bnbKurier*4);}
    }
    // Kara za Ślepy Los (loss_resources) – identycznie jak w calcScore
    var resLossPenalty=0;
    var myFateRolls=(blindFate[fId]&&blindFate[fId].rolls)?ensureArray(blindFate[fId].rolls):[];
    myFateRolls.forEach(function(roll){
      if(roll&&roll.resolved&&roll.event&&roll.event.type==="loss_resources"){
        var p=roll.policyUsed===100?0:roll.policyUsed===50?5:10;
        resLossPenalty+=p;
      }
    });
    resPct=Math.max(0,resPct-resLossPenalty);
    var resPts=Math.round((resPct/100)*30);
    var compPct=task.kompetencje.reduce((s,k)=>s+(myCompIds.includes(k.id)?k.pct:0),0);
    if(bnbEnabled){
      if(compPct>=100){bnbMiksturaBonus=bnbMikstura;}
      else{compPct=Math.min(100, compPct+bnbMikstura*4);}
    }
    var compPts=Math.round((compPct/100)*25);
    var cashForScore=bnbEnabled?cash*(1+bnbObligacje*0.2):cash;
    var cashPts=Math.round((cashForScore/600)*25);
    var plotPts=hasCorrectPlot?10:0;
    var mapClaimed=!!(mapBonusClaimed&&mapBonusClaimed[fId]);
    var mapPts=mapEnabled?Math.min(10, uniqueMapCount*2 + (mapClaimed&&uniqueMapCount===4?2:0)):0;
    var bnbPts=bnbEnabled?(bnbKwatera+bnbKurierBonus+bnbMiksturaBonus):0;
    var relPts=Math.round(calcRelationScore(fId, relations));
    var totalPts=resPts+compPts+cashPts+plotPts+mapPts+bnbPts+relPts;
    
    var mapWinner=null;
    if(mapEnabled&&mapBonusClaimed){F.forEach(function(f){if(mapBonusClaimed[f])mapWinner=f;});}
    var gotMapBonus=mapEnabled&&mapWinner===fId;
    var lostToWinner=mapEnabled&&mapWinner&&mapWinner!==fId?mapWinner:null;
    
    var myFate=blindFate[fId]||{};
    var fateResults=[];
    [1,2].forEach(round=>{
      var roll=myFate["roll"+round];var policies=myFate["policies"+round]||[];
      if(roll!==undefined){fateResults.push({round,roll,policies,effect:myFate["effect"+round]||"",desc:myFate["desc"+round]||""});}
    });
    
    // Blind Fate balance – cash effects + resource penalty
    var fateBilans=0;
    var fateResPenalty=0;
    ensureArray(myFate.rolls||[]).forEach(function(roll){
      if(!roll||!roll.resolved||!roll.event) return;
      if(roll.event.type==="loss_resources"){
        var pen=roll.policyUsed===100?0:roll.policyUsed===50?5:10;
        fateResPenalty+=pen;
      } else {
        fateBilans+=(roll.netEffect||0);
      }
    });
    // Map settlement
    var mapSettlement=mapEnabled?(mapWinner===fId?300:(mapWinner?-100:0)):0;
    // BnB card counts by origin
    var bnbCounts={adams:0,bennet:0,clinton:0,dexter:0};
    items.filter(i=>i.cat===C_BNB).forEach(function(i){if(i.bnbOrigin)bnbCounts[i.bnbOrigin]++;});
    // Plot deed logic
    var deedPlotNr=null;
    if(hasCorrectPlot){deedPlotNr=FM[fId].tPlot;}
    else if(myPlots.length>0){deedPlotNr=myPlots[myPlots.length-1].plotNr;}
    // Polish plural
    function fragForm(n){if(n===1)return"fragment";var m10=n%10,m100=n%100;if(m10>=2&&m10<=4&&(m100<12||m100>14))return"fragmenty";return"fragmentów";}
    // Styles
    var akaS={fontFamily:"'Aka Posse',serif",fontSize:"13.42px",color:"#5B7674"};
    var akaNeg={fontFamily:"'Aka Posse',serif",fontSize:"13.42px",color:"#5B7674"};
    function renderCard(id,cat,has,pct){
      return(<div key={id} style={{filter:has?"none":"saturate(0.3)",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <img src={IMG_BASE+cat+"_"+id+".png"} style={{width:"100%",height:"auto",display:"block"}} alt={id}/>
        <div style={{fontSize:11,textAlign:"center",marginTop:1,color:"#5C4A3A",fontWeight:600}}>Waga: {pct}%</div>
      </div>);
    }
    var totalCards=task.zasoby.length+task.kompetencje.length;
    var totalGaps=(task.zasoby.length-1)+(task.kompetencje.length-1)+2;
    var cardG=8;
    var cardW=Math.floor((1140-totalGaps*cardG)/totalCards);

    return(<div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_1-zadania.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>

      {/* PRZYCISKI RODZIN – 3px nad linią menu */}
      {isSheriff&&<div style={{position:"absolute",right:30,top:0,height:157,display:"flex",alignItems:"flex-end",gap:3}}>
        {FO.map(function(f){
          var isAct=f===fId;
          return(<img key={f} src={IMG_BASE+"wyn_r-"+f+".png"}
            onClick={function(){setSelectedFamily(f);}}
            style={{width:65,height:"auto",cursor:"pointer",
              filter:isAct?"none":"saturate(0.3)",
              border:"none",
              boxSizing:"border-box"}}
            alt={FM[f].nom}/>);
        })}
      </div>}

      {/* PRZYCISKI MENU */}
      {tabMenu}

      {/* WYNIK */}
      <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",
        fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>
        Uzyskany wynik: {totalPts} pkt
      </div>

      {/* LOGO RODZINY */}
      <img src={IMG_BASE+"wyn_logo-"+fId+".png"} style={{position:"absolute",left:1100,top:225,transform:"translate(-50%,-50%)"}} alt={FM[fId].nom}/>

      {/* WYNIKI ZADA\u0143 y=370 baseline */}
      <div style={{...akaS,position:"absolute",left:98,top:370}}>{resPct}% = {resPts} pkt{resLossPenalty>0&&<span style={{color:"#C04030",fontSize:"11px"}}> (kara ŚL: -{resLossPenalty}%)</span>}</div>
      <div style={{...akaS,position:"absolute",left:329,top:370}}>{compPct}% = {compPts} pkt</div>
      <div style={{...akaS,position:"absolute",left:556,top:370}}>{bnbObligacje>0?Math.round(cashForScore):cash} $ = {cashPts} pkt{bnbObligacje>0&&<span style={{fontSize:"11px",color:"#6B5A4A"}}> (×{(1+bnbObligacje*0.2).toFixed(1)})</span>}</div>
      <div style={{...(plotPts===0?akaNeg:akaS),position:"absolute",left:779.2,top:370}}>{plotPts} pkt</div>
      <div style={{...akaS,position:"absolute",left:1006,top:370}}>{relPts} pkt</div>

      {/* KARTY ZASOB\u00D3W + KOMPETENCJI y=423.5 */}
      <div style={{position:"absolute",left:30,top:423.5,right:30,display:"flex",alignItems:"flex-start"}}>
        <div style={{display:"flex",gap:cardG}}>
          {task.zasoby.map(z=>(<div key={z.id} style={{width:cardW}}>{renderCard(z.id,"res",myResIds.includes(z.id),z.pct)}</div>))}
        </div>
        <div style={{width:2,background:"#D6AB78",alignSelf:"stretch",margin:"0 "+(cardG-1)+"px"}}/>
        <div style={{display:"flex",gap:cardG}}>
          {task.kompetencje.map(k=>(<div key={k.id} style={{width:cardW}}>{renderCard(k.id,"comp",myCompIds.includes(k.id),k.pct)}</div>))}
        </div>
      </div>

      {/* AKT W\u0141ASNO\u015ACI y=553 */}
      <div style={{position:"absolute",left:25,top:553}}>
        {deedPlotNr!==null&&<div style={{position:"relative",width:390.5,height:243}}>
          <img src={IMG_BASE+"dzialka_"+deedPlotNr+".png"} style={{width:390.5,height:243,display:"block"}} alt={"Dzia\u0142ka "+deedPlotNr}/>
          <div style={{position:"absolute",left:"45.91%",bottom:"23%",fontFamily:"'Aka Posse',sans-serif",fontSize:13,color:"#925C24"}}>{"rodziny "+FM[fId].gen.toUpperCase()}</div>
          {!hasCorrectPlot&&<img src={IMG_BASE+"realizacja_50-dol.png"} style={{position:"absolute",left:0,top:0,width:"100%",height:"100%"}} alt="-50 $"/>}
        </div>}
        {deedPlotNr===null&&<img src={IMG_BASE+"realizacja_50-dol.png"} style={{width:390.5,height:243,display:"block"}} alt="-50 $"/>}
      </div>

      {/* \u015ALEPY LOS bilans y=607 */}
      {fateEnabled&&<div style={{...((fateBilans<0||fateResPenalty>0)?akaNeg:akaS),position:"absolute",left:490.5,top:607}}>{fateBilans!==0&&<span>Bilans: {fateBilans>=0?"+":""}{fateBilans} $</span>}{fateBilans!==0&&fateResPenalty>0&&<span>, </span>}{fateResPenalty>0&&<span style={{color:"#C04030"}}>utrata {fateResPenalty}% zasobów</span>}{fateBilans===0&&fateResPenalty===0&&<span>Bilans: +0 $</span>}</div>}

      {/* BnB liczniki y=637 */}
      {bnbEnabled&&<React.Fragment>
        {(function(){
          var myBnb=items.filter(i=>i.cat===C_BNB);
          var nKurier=myBnb.filter(i=>i.effect==="res4").length;
          var nMikstura=myBnb.filter(i=>i.effect==="comp4").length;
          var nObligacje=myBnb.filter(i=>i.effect==="cash20").length;
          var nKwatera=myBnb.filter(i=>i.effect==="point1").length;
          var resBase=resPctBase||resPct;
          var compBase=compPct;
          var zBoost=0,kBoost=0,kurierPts=0,miksturaPts=0;
          if(resBase>=100){kurierPts=nKurier;}else{zBoost=Math.min(100-resBase,nKurier*4);}
          if(compBase>=100){miksturaPts=nMikstura;}else{kBoost=Math.min(100-compBase,nMikstura*4);}
          var cashMult=nObligacje*20;
          var totalPts=nKwatera+kurierPts+miksturaPts;
          var parts=[];
          if(zBoost>0)parts.push("Z./"+zBoost+"%");
          if(kBoost>0)parts.push("K./"+kBoost+"%");
          if(cashMult>0)parts.push("$/↑"+cashMult+"%");
          if(totalPts>0)parts.push(totalPts+" pkt");
          var txt=parts.length>0?parts.join(" | "):"brak efektów";
          return <div style={{...akaS,position:"absolute",left:872.5,top:607,fontSize:13}}>Efekty: {txt}</div>;
        })()}
        {FO.map(function(origin,idx){
          var isOwn=origin===fId;
          var cnt=bnbCounts[origin];
          var col=cnt===0?"#A89070":isOwn?"#8B7355":"#2E5B3C";
          var xs=[867.5,952,1045,1121];
          return <div key={origin} style={{...akaS,position:"absolute",left:xs[idx],top:637,color:col}}>× {cnt}</div>;
        })}
      </React.Fragment>}
      {!bnbEnabled&&<React.Fragment>
        <div style={{...akaS,position:"absolute",left:872.5,top:607}}>Dodatek niewłączony do gry</div>
        <div style={{...akaS,position:"absolute",left:867.5,top:637}}>× 0</div>
        <div style={{...akaS,position:"absolute",left:952,top:637}}>× 0</div>
        <div style={{...akaS,position:"absolute",left:1045,top:637}}>× 0</div>
        <div style={{...akaS,position:"absolute",left:1121,top:637}}>× 0</div>
      </React.Fragment>}

      {/* Z\u0141OTODAJNA \u017BY\u0141A teksty */}
      {mapEnabled&&<React.Fragment>
        <div style={{...akaS,position:"absolute",left:490.5,top:740}}>{uniqueMapCount} {fragForm(uniqueMapCount)} = {mapPts} pkt</div>
        <div style={{...(mapSettlement<0?akaNeg:akaS),position:"absolute",left:490.5,top:758.5}}>Rozliczenie: {mapSettlement>0?"+":""}{mapSettlement} $</div>
      </React.Fragment>}
      {!mapEnabled&&<React.Fragment>
        <div style={{...akaS,position:"absolute",left:490.5,top:740}}>Dodatek niewłączony do gry</div>
        <div style={{...akaS,position:"absolute",left:490.5,top:758.5}}>Rozliczenie: 0 $</div>
      </React.Fragment>}

      {/* KARTY Z\u0141OTODAJNEJ \u017BY\u0141Y y=803 */}
      {mapEnabled&&<div style={{position:"absolute",left:30,top:803,display:"flex",gap:3}}>
        {[5,4,3,2,1].map(fragNr=>{
          var hasIt=myMaps.some(m=>m.fragNr===fragNr);
          return(<div key={fragNr} style={{width:118,height:118,filter:hasIt?"none":"saturate(0.3)"}}>
            <img src={IMG_BASE+"map_fragment-"+fragNr+".png"} style={{width:"100%",height:"100%",display:"block",objectFit:"contain"}} alt={"Fragment "+fragNr}/>
          </div>);
        })}
      </div>}
      {!mapEnabled&&<div style={{position:"absolute",left:30,top:803,display:"flex",gap:3}}>
        <div style={{width:118,height:118}}><img src={IMG_BASE+"zloto_5.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"contain"}} alt="Złoto 5"/></div>
        {[1,2,3,4].map(n=>(<div key={n} style={{width:118,height:118}}><img src={IMG_BASE+"zloto_1-4.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"contain"}} alt={"Złoto "+n}/></div>))}
      </div>}

    </div>);
  }
  
  // Render stanów magazynowych dla wybranej rodziny
  function renderFamilyStock(fId){
    var fam=fd[fId]||{};var items=fam.items||[];var task=TASKS[fId];
    var myResIds=items.filter(function(i){return i.cat==="res";}).map(function(r){return toSlug(r.name);});
    var myCompIds=items.filter(function(i){return i.cat==="comp";}).map(function(c){return toSlug(c.name);});
    
    var col1Res=STARTING_RES[fId].filter(function(sid){return myResIds.includes(sid)&&!task.zasoby.some(function(z){return z.id===sid;});});
    var col1Comp=STARTING_COMP[fId].filter(function(cid){return myCompIds.includes(cid)&&!task.kompetencje.some(function(k){return k.id===cid;});});
    var col1All=col1Res.map(function(sid){return{slug:sid,cat:"res"};}).concat(col1Comp.map(function(cid){return{slug:cid,cat:"comp"};}));
    
    var boughtNotNeeded=items.filter(function(i){return(i.cat==="res"||i.cat==="comp")&&!STARTING_RES[fId].includes(toSlug(i.name))&&!STARTING_COMP[fId].includes(toSlug(i.name));}).filter(function(i){
      var slug=toSlug(i.name);return !(i.cat==="res"?task.zasoby.some(function(z){return z.id===slug;}):task.kompetencje.some(function(k){return k.id===slug;}));
    });
    var col2All=boughtNotNeeded.map(function(i){return{slug:toSlug(i.name),cat:i.cat};});
    
    var G=6,ML=30,CW=(1140-11*G)/11;
    var CH=100.5,ROW1=350,ROW2=350+CH+G;
    
    function cx(i,col){return col===1?ML+i*(CW+G):ML+6*(CW+G)+G+1+i*(CW+G);}
    var sepX=ML+6*(CW+G);
    
    function card(slug,cat,x,y){
      var isZ=cat==="res"?ZMYLKI_RES.includes(slug):ZMYLKI_COMP.includes(slug);
      return React.createElement("div",{key:slug+"-"+x+"-"+y,style:{position:"absolute",left:x,top:y,width:CW,height:CH,borderRadius:8,overflow:"hidden"}},
        React.createElement("img",{src:IMG_BASE+cat+"_"+slug+".png",style:{width:"100%",height:"100%",objectFit:"contain",display:"block"},alt:slug}),
        isZ?React.createElement("div",{style:{position:"absolute",left:0,top:0,right:0,bottom:0,background:"rgba(200,50,50,0.2)",pointerEvents:"none"}}):null
      );
    }
    
    var cards=[];
    col1All.forEach(function(o,i){var row=i<6?ROW1:ROW2;var slot=i<6?i:i-6;cards.push(card(o.slug,o.cat,cx(slot,1),row));});
    col2All.forEach(function(o,i){var row=i<5?ROW1:ROW2;var slot=i<5?i:i-5;cards.push(card(o.slug,o.cat,cx(slot,2),row));});
    
    cards.push(React.createElement("div",{key:"sep",style:{position:"absolute",left:sepX,top:ROW1,width:1,height:CH*2+G,background:"#805531"}}));
    
    return React.createElement(React.Fragment,null,cards);
  }
  
  // Pod-zakładki rodzin (dla szeryfa)
  function FamilySubTabs(){
    return(<div style={{display:"flex",gap:2,marginBottom:12}}>
      {F.map(f=>{
        var act=selectedFamily===f;
        return <div key={f} onClick={()=>setSelectedFamily(f)} style={{padding:"5px 12px",fontSize:12,fontWeight:act?700:400,background:act?FC[f]:"#E8E0D0",color:act?"#fff":"#5C4A3A",cursor:"pointer",borderRadius:4}}>{FN[f]}</div>;
      })}
    </div>);
  }
  
  var TABS=isSheriff||debriefFullAccess?
    [["zadania","Realizacja\nzadań"],["ewaluacja","Ewaluacja\nrozgrywki"],["wyniki","Wyniki\nkońcowe"],["magazyn","Stany\nmagazynowe"],["profil","Profil\nrodzin"],["rytm","Rytm\nrozgrywki"],["handel","Macierz\nhandlu"],["relacje","Budowanie\nrelacji"]]:
    [["zadania","Realizacja\nzadań"],["ewaluacja","Ewaluacja\nrozgrywki"]];

  var tabMenu=React.createElement(React.Fragment,null,
    <div key="tab-line" style={{position:"absolute",left:30,right:30,top:161,height:1,background:"#805531"}}/>,
    TABS.map(function(tab,idx){
      var tid=tab[0],tlabel=tab[1];var isAct=debriefTab===tid;var btnLeft=30+idx*(100+2);
      return(<div key={tid} onClick={function(){setDebriefTab(tid);}}
        style={{position:"absolute",left:btnLeft,top:120,width:100,height:40,cursor:"pointer",
          backgroundImage:"url("+IMG_BASE+(isAct?"wyn_zad-p_aktywny.png":"wyn_zad-p_nieaktywny.png")+")",backgroundSize:"100% 100%",
          display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <span style={{fontSize:14,fontWeight:isAct?700:400,color:isAct?"#fff":"#4C130F",lineHeight:1.2,whiteSpace:"pre-line"}}>{tlabel}</span>
      </div>);
    })
  );
  
  var canvasTab=true;
  
  return(<div style={{position:"relative",background:canvasTab?"transparent":"#fff",backgroundImage:canvasTab?"none":"url("+IMG_BASE+"tlo_uniwersalne.png)",backgroundSize:"cover",backgroundPosition:"center",padding:canvasTab?0:16,borderRadius:6}}>

    {/* Udostępnij wynik / pozostałe – na tle obrazka, tylko w zadania+ewaluacja */}
    {isSheriff&&!readOnly&&(debriefTab==="zadania"||debriefTab==="ewaluacja")&&<div style={{position:"absolute",right:20,top:25,zIndex:10}}>
      {!debriefUnlocked&&<button onClick={()=>{setDebriefUnlocked(true);if(showMsg)showMsg("Wyniki udostępnione graczom","success");}} style={{padding:"10px 24px",fontSize:14,fontFamily:"'Alegreya Sans', sans-serif",fontWeight:500,background:"url("+IMG_BASE+"wynik_przycisk-1.png) center/contain no-repeat",color:"#F8E7CC",border:"none",borderRadius:0,cursor:"pointer",minWidth:180,minHeight:44}}>Udostępnij wynik</button>}
      {debriefUnlocked&&!debriefFullAccess&&<button onClick={()=>{setDebriefFullAccess(true);if(showMsg)showMsg("Wszystkie zak\u0142adki udost\u0119pnione","success");}} style={{padding:"10px 24px",fontSize:14,fontFamily:"'Alegreya Sans', sans-serif",fontWeight:500,background:"url("+IMG_BASE+"wynik_przycisk-2.png) center/contain no-repeat",color:"#3A1F10",border:"none",borderRadius:0,cursor:"pointer",minWidth:180,minHeight:44}}>Udostępnij pozostałe</button>}
    </div>}
    
    
    {/* === REALIZACJA ZADAŃ === */}
    {debriefTab==="zadania"&&<div>
      {renderFamilyTasks(activeFamily)}
    </div>}
    
    {/* === EWALUACJA === */}
    {debriefTab==="ewaluacja"&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_2-ewaluacja.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>

        {/* LINIA MENU y=160 */}

        {tabMenu}

        {/* NAGŁÓWEK */}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",
          fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>
          Pytania pomocnicze do ewaluacji
        </div>

      </div>
    </div>}
    
    {/* === WYNIKI KOŃCOWE === */}
    {debriefTab==="wyniki"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_3-wyniki.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>

        {/* LINIA MENU y=160 */}

        {tabMenu}

        {/* NAGŁÓWEK */}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",
          fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>
          Wyniki końcowe
        </div>

        {/* KARTY RANKINGOWE – stała kolejność: Adams, Bennet, Clinton, Dexter */}
        <div style={{position:"absolute",left:30,right:30,top:300,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {F.map((f)=>{
            var pts=tot(f);var isMe=!isSheriff&&f===familyId;
            var place=ranked.indexOf(f)+1;
            return <div key={f} style={{borderRadius:6,padding:"10px 12px",background:FC[f],border:isMe?"3px solid #D4A853":"3px solid transparent"}}>
              <div style={{fontSize:26,fontWeight:900,color:"rgba(255,255,255,0.95)"}}>{place}. miejsce</div>
              <div style={{fontSize:21,fontWeight:900,color:"#fff"}}>{pts} pkt</div>
              <div style={{fontFamily:"'Aka Posse',Georgia,serif",fontSize:15,color:"rgba(255,255,255,0.95)",marginTop:2}}>{FN[f]}</div>
            </div>;
          })}
        </div>

        {/* WYKRES */}
        <div style={{position:"absolute",left:30,right:30,top:410,height:340}}><canvas ref={barChartRef}></canvas></div>

        {/* BREAKDOWN POD WYKRESEM */}
        <div style={{position:"absolute",left:30,right:30,top:760,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {F.map(f=>{
            var s=scores[f]||{};
            return <div key={f} style={{fontSize:12,color:"#5C4A3A",lineHeight:1.6}}>
              <div>Zasoby: <b>{s.zasoby||0}</b> pkt</div>
              <div>Kompetencje: <b>{s.kompetencje||0}</b> pkt</div>
              <div>Gotówka: <b>{s.gotowka||0}</b> pkt</div>
              <div>Działka: <b>{s.dzialka||0}</b> pkt</div>
              {mapEnabled&&<div>Złotodajna Żyła: <b>{s.mapa||0}</b> pkt</div>}
              {bnbEnabled&&<div>Biznes na boku: <b>{s.bnb||0}</b> pkt</div>}
              <div>Relacje: <b>{s.relacje||0}</b> pkt</div>
            </div>;
          })}
        </div>

      </div>
    </div>}
    
    {/* === STANY MAGAZYNOWE === */}
    {debriefTab==="magazyn"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_4-magazyn.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
        {tabMenu}
        {/* PRZYCISKI RODZIN */}
        {isSheriff&&<div style={{position:"absolute",right:30,top:0,height:157,display:"flex",alignItems:"flex-end",gap:3}}>
          {FO.map(function(f){
            var isAct=f===activeFamily;
            return(<img key={f} src={IMG_BASE+"wyn_r-"+f+".png"}
              onClick={function(){setSelectedFamily(f);}}
              style={{width:65,height:"auto",cursor:"pointer",filter:isAct?"none":"saturate(0.3)",border:"none",boxSizing:"border-box"}}
              alt={FM[f].nom}/>);
          })}
        </div>}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>Stany magazynowe</div>
        <img src={IMG_BASE+"wyn_logo-"+activeFamily+".png"} style={{position:"absolute",left:1100,top:225,transform:"translate(-50%,-50%)"}} alt={FM[activeFamily].nom}/>
        {renderFamilyStock(activeFamily)}
      </div>
    </div>}
    
    {/* === PROFIL RODZIN === */}
    {debriefTab==="profil"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_5-profil.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
        {tabMenu}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>Profil rodzin</div>
        <div style={{position:"absolute",left:0,right:0,top:323,bottom:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:600,height:500}}><canvas ref={radarChartRef}></canvas></div>
        </div>
      </div>
    </div>}
    
    {/* === RYTM ROZGRYWKI === */}
    {debriefTab==="rytm"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_6-rytm.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
        {tabMenu}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>Rytm rozgrywki</div>
        <div style={{position:"absolute",left:30,right:30,top:300,bottom:30,overflow:"auto",display:"flex",flexDirection:"column",alignItems:"center"}}>
          <table style={{borderCollapse:"separate",borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{padding:8,background:"transparent",border:"none",width:80}}></th>
                <th colSpan={3} style={{padding:"8px 4px",textAlign:"center",border:"1px solid #D4C4A8",fontSize:16,fontWeight:700,color:"#842504",background:"#F0E8D4"}}>Faza 1</th>
                <th colSpan={3} style={{padding:"8px 4px",textAlign:"center",border:"1px solid #D4C4A8",fontSize:16,fontWeight:700,color:"#842504",background:"#F0E8D4"}}>Faza 2</th>
                <th colSpan={3} style={{padding:"8px 4px",textAlign:"center",border:"1px solid #D4C4A8",fontSize:16,fontWeight:700,color:"#842504",background:"#F0E8D4"}}>Faza 3</th>
              </tr>
              <tr>
                <th style={{padding:4,background:"transparent",border:"none"}}></th>
                {[1,2,3,1,2,3,1,2,3].map((t,i)=><th key={i} style={{padding:"6px 10px",textAlign:"center",border:"1px solid #D4C4A8",fontSize:13,fontWeight:600,color:"#5C4A3A",background:"#F0E8D4"}}>Tura {t}</th>)}
              </tr>
            </thead>
            <tbody>
              {F.map(f=><tr key={f}>
                <td style={{padding:"4px 10px",background:"transparent",border:"none",textAlign:"center",verticalAlign:"middle"}}>
                  <img src={IMG_BASE+"wyn_r-"+f+".png"} style={{width:60,height:"auto",display:"block",margin:"0 auto"}} alt={FN[f]}/>
                </td>
                {txPerPhase[f].map((n,i)=>{
                  var isHighlight=!isSheriff&&f===familyId;
                  return <td key={i} style={{padding:"8px 14px",textAlign:"center",border:"1px solid #D4C4A8",background:isHighlight?hmColor(n):hmColor(n),fontWeight:n>0?700:400,fontSize:18}}>{n}</td>;
                })}
              </tr>)}
            </tbody>
          </table>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:16,alignItems:"center",justifyContent:"center",fontSize:14,color:"#5C4A3A"}}>
            <span style={{fontWeight:600}}>Liczba transakcji:</span>
            {[[0,"#F0EBE0"],[1,"#F5E0A0"],["2\u20133","#E8C060"],[4,"#D4A853"],["5+","#8B5E20"]].map(([l,c])=><span key={l} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:20,height:14,borderRadius:2,background:c,border:"0.5px solid #ccc"}}></span>{l}</span>)}
          </div>
        </div>
      </div>
    </div>}
    
    {/* === MACIERZ HANDLU === */}
    {debriefTab==="handel"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_7-macierz.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
        {tabMenu}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>Macierz handlu</div>
        <div style={{position:"absolute",left:30,right:30,top:300,bottom:30,overflow:"auto",display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
          <table style={{borderCollapse:"separate",borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{padding:8,background:"transparent",border:"none",width:80}}></th>
                {F.map(f=><th key={f} style={{padding:"8px 12px",background:"transparent",border:"none",textAlign:"center",verticalAlign:"middle"}}>
                  <img src={IMG_BASE+"wyn_r-"+f+".png"} style={{width:70,height:"auto",display:"block",margin:"0 auto"}} alt={FN[f]}/>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {F.map(from=><tr key={from}>
                <td style={{padding:"8px 12px",background:"transparent",border:"none",textAlign:"center",verticalAlign:"middle"}}>
                  <img src={IMG_BASE+"wyn_r-"+from+".png"} style={{width:70,height:"auto",display:"block",margin:"0 auto"}} alt={FN[from]}/>
                </td>
                {F.map(to=>{
                  if(from===to)return <td key={to} style={{width:150,height:70,boxSizing:"border-box",padding:"12px 16px",border:"1px solid #D4C4A8",background:"#E8E0D0",textAlign:"center",verticalAlign:"middle",fontSize:22}}>{"\u2013"}</td>;
                  var pair=[from,to].sort().join("-");
                  var d=tradeMatrix[pair]||{c:0,v:0};
                  var isHighlight=!isSheriff&&(from===familyId||to===familyId);
                  return <td key={to} style={{width:150,height:70,boxSizing:"border-box",padding:"12px 16px",border:"1px solid #D4C4A8",background:isHighlight?"#FFF8E7":"#fff",textAlign:"center",verticalAlign:"middle",fontSize:18,color:"#5C4A3A",lineHeight:1.4}}>
                    <div style={{fontWeight:700}}>{d.c} transakcji</div>
                    <div>{d.v} $</div>
                  </td>;
                })}
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>}
    
    {/* === RELACJE === */}
    {debriefTab==="relacje"&&(isSheriff||debriefFullAccess)&&<div>
      <div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"wynik_8-relacje.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
        {tabMenu}
        <div style={{position:"absolute",left:600,top:225,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:"40.45px",color:"#D7B56D",whiteSpace:"nowrap"}}>Budowanie relacji</div>
        <div style={{position:"absolute",left:30,right:30,top:300,bottom:30,overflow:"auto",display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
          <table style={{borderCollapse:"separate",borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{padding:8,background:"transparent",border:"none",width:80}}></th>
                {F.map(f=><th key={f} style={{padding:"8px 12px",background:"transparent",border:"none",textAlign:"center",verticalAlign:"middle"}}>
                  <img src={IMG_BASE+"wyn_r-"+f+".png"} style={{width:70,height:"auto",display:"block",margin:"0 auto"}} alt={FN[f]}/>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {F.map(from=><tr key={from}>
                <td style={{padding:"8px 12px",background:"transparent",border:"none",textAlign:"center",verticalAlign:"middle"}}>
                  <img src={IMG_BASE+"wyn_r-"+from+".png"} style={{width:70,height:"auto",display:"block",margin:"0 auto"}} alt={FN[from]}/>
                </td>
                {F.map(to=>{
                  if(from===to)return <td key={to} style={{width:150,height:70,boxSizing:"border-box",padding:"12px 16px",border:"1px solid #D4C4A8",background:"#E8E0D0",textAlign:"center",verticalAlign:"middle",fontSize:22}}>{"\u2013"}</td>;
                  var r=relations&&relations[from]&&relations[from][to];
                  var val=r?Math.round(((r.partnership||0)+(r.rules||0)+(r.communication||0))/3):0;
                  var stars="\u2605".repeat(val)+"\u2606".repeat(5-val);
                  var isHighlight=!isSheriff&&from===familyId;
                  return <td key={to} style={{width:150,height:70,boxSizing:"border-box",padding:"12px 16px",border:"1px solid #D4C4A8",background:isHighlight?"#FFF8E7":"#fff",textAlign:"center",verticalAlign:"middle",color:"#D4A853",fontSize:22,letterSpacing:2}}>{stars}</td>;
                })}
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>}
    
  </div>);
}


