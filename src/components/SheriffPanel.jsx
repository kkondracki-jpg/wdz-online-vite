/* WDZ Online – components/SheriffPanel.jsx */
import { FM, FO, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS, STAGES, PHASE_NAMES, PAIRINGS, getMeetingPartner, BLIND_FATE_EVENTS } from "../game/constants.js";
import { calcScore, calcRelationScore, fmtItems, buildView } from "../game/scoring.js";
import { IMG_BASE, toSlug, imgUrl, mapImgUrl, getRevImg, ensureArray } from "../utils/index.js";
import { btnS, InfoPopup, StarRating, TaskHeader } from "./ui.jsx";
import { BlindFateFamily } from "./BlindFate.jsx";
import { RewolwerowiecNew } from "./Revolver.jsx";
import { DebriefingPanel } from "./DebriefingPanel.jsx";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

function buildFamilyLink(roomCode, fId) {
  var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/");
  return base + "?s=" + roomCode + "&f=" + fId;
}

export function SheriffPlanningTab({readOnly,roomCode,lobbyPlayers,gameStarted,setGameStarted,showMsg,db,mapEnabled,setMapEnabled,bnbEnabled,setBnbEnabled,activateBnb,devMode,setDevMode}){
  const [cpd,setCpd]=useState({});
  const [cpAll,setCpAll]=useState(false);
  const [sessionInfo,setSessionInfo]=useState({klient:"",grupa:"",szeryf2:""});

  useEffect(()=>{
    if(!db||!roomCode) return;
    db.ref("rooms/"+roomCode+"/sessionInfo").once("value").then(snap=>{
      if(snap.exists()) setSessionInfo(si=>({...si,...snap.val()}));
    });
  },[roomCode]);

  function saveSessionInfo(field,value){
    if(readOnly||!db) return;
    db.ref("rooms/"+roomCode+"/sessionInfo/"+field).set(value);
  }

  function getLobbyMembers(fId){var fd=lobbyPlayers[fId];if(!fd||!fd.members)return[];return Object.entries(fd.members).map(([id,m])=>({id,...m})).filter(m=>m.name);}
  function isOnlineMember(m){return m.lastSeen&&(Date.now()-m.lastSeen)<90000;}
  // P3-3: Feedback błędu clipboard
  function copyLnk(fId){var lnk=buildFamilyLink(roomCode,fId);navigator.clipboard.writeText(lnk).then(()=>{setCpd(p=>({...p,[fId]:true}));setTimeout(()=>setCpd(p=>({...p,[fId]:false})),2500);}).catch(()=>{showMsg("Błąd kopiowania – skopiuj ręcznie link z paska adresu");});}
  function copyAll(){var txt=FO.map(fId=>FM[fId].nom+": "+buildFamilyLink(roomCode,fId)).join("\n");navigator.clipboard.writeText(txt).then(()=>{setCpAll(true);setTimeout(()=>setCpAll(false),2500);}).catch(()=>{showMsg("Błąd kopiowania – skopiuj linki pojedynczo");});}
  var connFam=FO.filter(f=>{var fd=lobbyPlayers[f];if(!fd)return false;if(fd.members)return Object.keys(fd.members).length>0;return fd.connected;});
  var canStart=!readOnly&&connFam.length>0;

  return(<div style={{padding:0}}>
    {/* DANE ROZGRYWKI */}
    <div style={{background:"#FDFAF4",border:"1px solid #D4C4A8",padding:"12px 14px",marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"#8B7355",marginBottom:10}}>Dane rozgrywki:</div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 180px"}}>
          <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Klient / organizacja</div>
          <input value={sessionInfo.klient} disabled={readOnly}
            onChange={e=>setSessionInfo(si=>({...si,klient:e.target.value}))}
            onBlur={e=>saveSessionInfo("klient",e.target.value)}
            placeholder="np. Uniwersytet Merito"
            style={{width:"100%",padding:"6px 10px",border:"1px solid #D4C4A8",borderRadius:3,fontSize:13,fontFamily:"inherit",background:readOnly?"#F5F0E8":"#fff",color:"#2C1810"}}/>
        </div>
        <div style={{flex:"1 1 180px"}}>
          <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Informacje o grupie</div>
          <input value={sessionInfo.grupa} disabled={readOnly}
            onChange={e=>setSessionInfo(si=>({...si,grupa:e.target.value}))}
            onBlur={e=>saveSessionInfo("grupa",e.target.value)}
            placeholder="np. MBA 2025/26, grupa B"
            style={{width:"100%",padding:"6px 10px",border:"1px solid #D4C4A8",borderRadius:3,fontSize:13,fontFamily:"inherit",background:readOnly?"#F5F0E8":"#fff",color:"#2C1810"}}/>
        </div>
        <div style={{flex:"1 1 160px"}}>
          <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Drugi Szeryf</div>
          <input value={sessionInfo.szeryf2} disabled={readOnly}
            onChange={e=>setSessionInfo(si=>({...si,szeryf2:e.target.value}))}
            onBlur={e=>saveSessionInfo("szeryf2",e.target.value)}
            placeholder="Imię i nazwisko"
            style={{width:"100%",padding:"6px 10px",border:"1px solid #D4C4A8",borderRadius:3,fontSize:13,fontFamily:"inherit",background:readOnly?"#F5F0E8":"#fff",color:"#2C1810"}}/>
        </div>
      </div>
    </div>
    <div style={{display:"flex",gap:16,alignItems:"stretch"}}>
      {/* LEFT: linki */}
      <div style={{flex:"1 1 55%",minWidth:0}}>
        <div style={{background:"#FDFAF4",border:"1px solid #D4C4A8",padding:"12px 14px",height:"100%",boxSizing:"border-box"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#8B7355",marginBottom:8}}>Linki dla rodzin:</div>
          {FO.map(fId=>(
            <div key={fId} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#F5F0E8",marginBottom:5}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:FM[fId].col,flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:700,color:FM[fId].col,width:90,flexShrink:0}}>{FM[fId].nom}</span>
              <span style={{fontSize:11,fontFamily:"monospace",color:"#5C4A3A",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{buildFamilyLink(roomCode,fId)}</span>
              <button onClick={()=>copyLnk(fId)} style={{fontSize:11,padding:"3px 10px",border:"1px solid #C4B090",background:cpd[fId]?"#E8F5E9":"#fff",color:cpd[fId]?"#2E5B3C":"#5C4A3A",cursor:"pointer",flexShrink:0,minWidth:82,fontFamily:"inherit"}}>
                {cpd[fId]?"✓ skopiowano":"Kopiuj"}
              </button>
            </div>
          ))}
          <button onClick={copyAll} style={{width:"100%",padding:"8px",fontSize:13,marginTop:4,border:"1px solid #C4B090",background:cpAll?"#E8F5E9":"#F5F0E8",color:cpAll?"#2E5B3C":"#4C130F",cursor:"pointer",fontFamily:"inherit"}}>
            {cpAll?"✓ Skopiowano wszystkie linki":"Kopiuj wszystkie 4 linki naraz"}
          </button>
        </div>
      </div>
      {/* RIGHT: kto dołączył */}
      <div style={{flex:"1 1 40%",minWidth:0}}>
        <div style={{background:"#FDFAF4",border:"1px solid #D4C4A8",padding:"12px 14px",height:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#8B7355",marginBottom:8}}>Kto dołączył:</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {FO.map(fId=>{
              var members=getLobbyMembers(fId);var hasM=members.length>0;
              var onlCnt=members.filter(m=>isOnlineMember(m)).length;
              return(<div key={fId} style={{padding:"6px 10px",background:hasM?"#F0FAF0":"#F5F0E8",border:"1px solid "+(hasM?"#90C090":"#D4C4A8")}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:hasM?FM[fId].col:"#C4B090"}}/>
                  <span style={{fontSize:13,fontWeight:hasM?700:400,color:hasM?FM[fId].col:"#C4B090"}}>{FM[fId].nom}</span>
                  <span style={{fontSize:12,marginLeft:"auto",color:hasM?"#2E5B3C":"#C4B090"}}>{hasM?(onlCnt+" online"):"oczekiwanie..."}</span>
                </div>
              </div>);
            })}
          </div>
          {!gameStarted&&<button onClick={()=>{if(!readOnly){
            db.ref("rooms/"+roomCode+"/meta/status").set("playing");setGameStarted(true);showMsg("Gracze wpuszczeni! Rozgrywk\u0119 rozpocznij przyciskiem Start w zak\u0142adce Zarz\u0105dzanie.");
          }}} disabled={!canStart} style={{width:"100%",padding:"12px 20px",fontSize:13,fontFamily:"inherit",fontWeight:700,marginTop:10,background:canStart?"#2E5B3C":"#C4B090",color:"#fff",border:"none",cursor:canStart?"pointer":"not-allowed",opacity:canStart?1:0.6}}>
            {readOnly?"Tryb tylko do podgl\u0105du":connFam.length===4?"Wpuść graczy (wszyscy gotowi)":"Wpuść graczy ("+connFam.length+"/4 rodzin)"}
          </button>}
          {gameStarted&&<div style={{textAlign:"center",padding:"10px",marginTop:10,background:"#2E5B3C",fontSize:13,color:"#fff",fontWeight:700}}>✓ Gracze wpuszczeni</div>}
        </div>
      </div>
    </div>
    {!readOnly&&<div style={{marginTop:12,padding:"10px 14px",background:devMode?"#FFF3E0":"#FDFAF4",border:"1px solid "+(devMode?"#E8C060":"#D4C4A8"),borderRadius:4,display:"flex",alignItems:"center",gap:10}}>
      <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
        <input type="checkbox" checked={devMode} onChange={e=>{if(e.target.checked){if(confirm("Przejść w tryb testowy? Gracze uzyskają natychmiastowy dostęp do wszystkich włączonych mechanik i możliwość handlu z dowolną rodziną."))setDevMode(true);}else setDevMode(false);}} style={{width:16,height:16,accentColor:"#C04030",cursor:"pointer"}}/>
        <span style={{fontSize:13,color:devMode?"#C04030":"#5C4A3A",fontWeight:devMode?700:500}}>Tryb testowy</span>
      </label>
      {devMode&&<span style={{fontSize:12,color:"#C04030",fontStyle:"italic"}}>Gracze mają dostęp do wszystkich mechanik i handlują z dowolną rodziną</span>}
    </div>}
    {gameStarted&&!readOnly&&<div style={{marginTop:16,textAlign:"center",padding:"10px",background:"#2E5B3C",fontSize:13,color:"#fff",fontWeight:700,borderRadius:4}}>✓ Rozgrywka w toku</div>}
  </div>);
}

/* ========== SHERIFF PANEL ========== */
export function SheriffPanel({readOnly,fd,txs,consultations,setConsultations,consultNotes,setConsultNotes,setFd,showMsg,blindFate,setBlindFate,showResults,setShowResults,onViewFamily,plotPenalties,setPlotPenalties,setTxs,biznesNaBoku,setBiznesNaBoku,relations,relationsUnlocked,setRelationsUnlocked,gameStarted,stageIdx,stageDurations,setStageDurations,startStage,pauseTimer,resumeTimer,advanceStage,timerRunning,timerPaused,secondsLeft,manualMode,setManualMode,sheriffCalls,setSheriffCalls,bnbEnabled,setBnbEnabled,bnbSettled,activateBnb,settleBnb,fateEnabled,setFateEnabled,mapEnabled,setMapEnabled,revEnabled,setRevEnabled,revMaxBet,setRevMaxBet,revDuels,revCurrent,revNewDuel,revSetBet,revReveal,revSettle,revMode,setRevMode,revActive,setRevActive,revStartTournament,getRevTimer,revRevealDuel,revSettleDuel,mapBonusClaimed,devMode,setDevMode}) {
  var boxBg={background:"#fff",backgroundImage:"url("+IMG_BASE+"tlo_uniwersalne-2.png)",backgroundSize:"cover",backgroundPosition:"center"};
  function completeConsult(fId,idx){setConsultations(prev=>{var arr=(prev[fId]||[]).slice();arr[idx]={...arr[idx],questionsUsed:arr[idx].questionsUsed+1};return{...prev,[fId]:arr};});showMsg("Odnotowano pytanie rodziny "+FM[fId].gen);}
  function grantConsultation(fId){
    if(fd[fId].cash<15){showMsg("Rodzina "+FM[fId].gen+" nie ma 15 $!");return;}
    setFd(prev=>{var n={...prev};n[fId]={...n[fId],cash:n[fId].cash-15};return n;});
    setTxs(prev=>[{id:txId(),type:"consultation_sold",from:fId,to:"sheriff",status:"accepted",offeredItems:[],description:"Konsultacja z Szeryfem – 15 $"},...prev]);
    setConsultations(prev=>{var arr=(prev[fId]||[]).concat([{status:"active",questionsUsed:0,questionsTotal:3}]);return{...prev,[fId]:arr};});
    // Mark ONLY THE FIRST waiting call as sold (not all)
    setSheriffCalls(prev=>{var found=false;return prev.map(c=>{if(!found&&c.fId===fId&&c.status==="waiting"){found=true;return{...c,status:"sold"};}return c;});});
    showMsg("Konsultacja sprzedana (pobrano 15 $, 3 pytania)");
  }
  function cancelConsultation(callIdx){
    var call=sheriffCalls[callIdx];if(!call)return;
    if(call.status==="sold"){
      // Refund 15$
      setFd(prev=>{var n={...prev};n[call.fId]={...n[call.fId],cash:n[call.fId].cash+15};return n;});
      setTxs(prev=>[{id:txId(),type:"consultation_refund",from:"sheriff",to:call.fId,status:"accepted",offeredItems:[],description:"Anulowanie konsultacji – zwrot 15 $"},...prev]);
      showMsg("Konsultacja anulowana (zwrot 15 $ dla "+FM[call.fId].gen+")");
    }
    setSheriffCalls(prev=>prev.map((c,i)=>i===callIdx?{...c,status:"cancelled"}:c));
  }
  function dismissCall(callIdx){
    setSheriffCalls(prev=>prev.map((c,i)=>i===callIdx?{...c,status:"dismissed"}:c));
  }
  function undoPolicy(fId,type){
    var cost=type==="p50"?30:50;
    setFd(prev=>{var n={...prev};n[fId]={...n[fId],cash:n[fId].cash+cost};return n;});
    setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var pol={...(bf.policies||{p50:null,p100:null})};pol[type]=null;bf.policies=pol;n[fId]=bf;return n;});
    showMsg("Polisa "+(type==="p50"?"50%":"100%")+" cofnięta (zwrot "+cost+" $)");
  }
  function activatePolicy(fId,type){
    var cost=type==="p50"?30:50;
    if(fd[fId].cash<cost){showMsg("Za mało gotówki!");return;}
    setFd(prev=>{var n={...prev};n[fId]={...n[fId],cash:n[fId].cash-cost};return n;});
    setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var pol={...(bf.policies||{p50:null,p100:null})};pol[type]="owned";bf.policies=pol;n[fId]=bf;return n;});
    showMsg("Polisa "+(type==="p50"?"50%":"100%")+" wykupiona ("+cost+" $)");
  }
  function prepareRoll(fId,policyChoice){
    setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rolls=(bf.rolls||[]).slice();
      rolls.push({diceReady:true,dice1:null,dice2:null,sum:null,event:null,policyUsed:policyChoice,resolved:false,rolling:false,netEffect:null,netEffectText:"",showCard:false,showDice:false});
      bf.rolls=rolls;n[fId]=bf;return n;});
    showMsg("Losowanie przygotowane dla "+FM[fId].gen);
  }
  function clearCard(fId,rollIdx){
    setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rolls=(bf.rolls||[]).slice();rolls[rollIdx]={...rolls[rollIdx],showCard:false,showDice:false};bf.rolls=rolls;n[fId]=bf;return n;});
  }
  var allTx=txs.filter(t=>t.status==="accepted"&&t.type!=="fate"&&t.type!=="map_bonus"&&t.type!=="penalty"&&t.type!=="plot_cost"&&t.type!=="bnb_settle"&&t.type!=="bnb_bonus"&&t.type!=="revolver"&&t.type!=="consultation_sold"&&t.type!=="consultation_refund");
  var penaltyTx=txs.filter(t=>t.status==="accepted"&&(t.type==="penalty"||t.type==="plot_cost"));

  // Nr 17: Undo last transaction (sheriff only)
  const [undoConfirm,setUndoConfirm]=React.useState(false);
  function undoLastTx(){
    var last=allTx[0]; // newest first
    if(!last)return;
    // Reverse the transaction effects
    setFd(fd2=>{var n={...fd2};
      var f={...n[last.from],items:n[last.from].items.slice(),cash:n[last.from].cash};
      var t={...n[last.to],items:n[last.to].items.slice(),cash:n[last.to].cash};
      if(last.type==="sale"){
        t.items=t.items.filter(i=>!last.offeredItems.find(o=>o.id===i.id));
        f.items=f.items.concat(last.offeredItems);
        f.cash-=last.price;t.cash+=last.price;
      } else if(last.type==="barter"){
        t.items=t.items.filter(i=>!last.offeredItems.find(o=>o.id===i.id));
        f.items=f.items.concat(last.offeredItems);
        if(last.responseItems){
          f.items=f.items.filter(i=>!last.responseItems.find(r=>r.id===i.id));
          t.items=t.items.concat(last.responseItems);
        }
        if(last.offeredCash>0){f.cash+=last.offeredCash;t.cash-=last.offeredCash;}
        if(last.responseCash>0){t.cash+=last.responseCash;f.cash-=last.responseCash;}
      }
      n[last.from]=f;n[last.to]=t;return n;
    });
    setTxs(prev=>prev.map(t=>t.id===last.id?{...t,status:"undone"}:t));
    setUndoConfirm(false);
    showMsg("Cofnięto transakcję: "+(FM[last.from]||{nom:last.from}).nom+" → "+(FM[last.to]||{nom:last.to}).nom);
  }

  // === NEW: Mechanic tabs, consultation notes, alerts ===
  const [mechTab,setMechTab]=React.useState("fate");
  const [expandedNotes,setExpandedNotes]=React.useState({});
  const [alerts,setAlerts]=React.useState([]);
  const alertKeysRef=React.useRef(new Set());

  React.useEffect(()=>{
    var newA=[];
    function tryAdd(k,text,isAlarm){if(!alertKeysRef.current.has(k)){alertKeysRef.current.add(k);newA.push({key:k,text:text,isAlarm:!!isAlarm,ts:Date.now()});}}
    // Stage changes
    if(gameStarted&&stageIdx>=0&&stageIdx<STAGES.length){tryAdd("stage_"+stageIdx,STAGES[stageIdx].label,false);}
    // Rev: duel needs action
    revActive.forEach(d=>{
      if(d.shotsA!==null&&d.shotsB!==null&&d.status==="playing")tryAdd("rev_reveal_"+d.id,FM[d.familyA].nom+" vs "+FM[d.familyB].nom+" – czeka na odsłonięcie",true);
      if(d.status==="finished")tryAdd("rev_settle_"+d.id,FM[d.familyA].nom+" vs "+FM[d.familyB].nom+" – czeka na rozliczenie",true);
    });
    // Fate: not rolled
    if(fateEnabled){FO.forEach(fId=>{var bf=blindFate[fId]||{};if((bf.rolls||[]).length===0)tryAdd("fate_noroll_"+fId,FM[fId].nom+" – brak losowania Ślepego Losu",true);});}
    // Pending txs
    txs.filter(t=>t.status==="pending").forEach(t=>{tryAdd("pending_tx_"+t.id,"Oczekująca transakcja: "+FM[t.from].nom+" → "+FM[t.to].nom,true);});
    // Sheriff calls (Wezwij Szeryfa)
    sheriffCalls.filter(c=>c.status==="waiting").forEach(c=>{tryAdd("call_"+c.fId+"_"+c.ts,FM[c.fId].nom+" wzywa Szeryfa!",true);});
    if(newA.length>0)setAlerts(prev=>[...newA,...prev]);
  });

  // Consultation helpers (lifted from IIFE)
  function toggleNotes(fId){setExpandedNotes(prev=>({...prev,[fId]:!prev[fId]}));}
  var waiting=sheriffCalls.filter(c=>c.status==="waiting");
  function getFamilyWaiting(fId){return waiting.filter(c=>c.fId===fId);}
  function getFamilyConsults(fId){return consultations[fId]||[];}

  // Current pairs helper
  function getCurrentPairs(){
    if(!gameStarted||stageIdx<0||stageIdx>=STAGES.length)return null;
    var s=STAGES[stageIdx];if(s.type!=="turn"||s.pairingIdx===null)return null;
    return{pairs:PAIRINGS[s.pairingIdx],phase:s.phase,turn:s.id.slice(-1)};
  }
  function getNextPairs(){
    for(var ni=stageIdx+1;ni<STAGES.length;ni++){var s=STAGES[ni];if(s.type==="turn"&&s.pairingIdx!==null)return{pairs:PAIRINGS[s.pairingIdx],phase:s.phase,turn:s.id.slice(-1)};} return null;
  }
  var curPairs=getCurrentPairs(),nextPairs=getNextPairs();

  return (<div style={{padding:0}}>
    {/* === 1. PRZEBIEG ROZGRYWKI === */}
    <div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      <div style={{fontSize:20,fontWeight:700,color:"#842504",marginBottom:12}} className="wt">Przebieg rozgrywki</div>
      {readOnly?(<div>
        {timerRunning&&<div style={{fontSize:18,fontWeight:700,color:"#842504",fontFamily:"monospace",marginBottom:6}}>{Math.floor(secondsLeft/60)+":"+(secondsLeft%60<10?"0":"")+(secondsLeft%60)}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:4}}>
          {STAGES.map((s,idx)=>{var isCur=idx===stageIdx,isDone=idx<stageIdx;
            return(<div key={s.id} style={{padding:"4px 8px",borderRadius:3,fontSize:13,fontWeight:isCur?700:400,background:isCur?"#D4A853":isDone?"#E8F0E8":"#F5F2E8",color:isCur?"#2C1810":isDone?"#2E5B3C":"#A89070",border:isCur?"2px solid #8B6914":"1px solid transparent",opacity:isDone?0.6:1}}>
              {isCur&&"▶ "}{s.label} ({stageDurations[s.id]} min){isDone&&" ✓"}
            </div>);
          })}
        </div>
      </div>):
      !gameStarted||stageIdx<0?(<div>
        <div style={{fontSize:13,color:"#5C4A3A",marginBottom:10}}>Ustaw czasy trwania etapów (minuty), a następnie kliknij Start.</div>
        {(()=>{
          var grouped=[
            [{key:"PREP",label:"Przygotowanie",ids:["PREP"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8"},
             {key:"F1",label:"Tury Fazy I (wymiana informacji)",ids:["F1T1","F1T2","F1T3"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×3 tury"},
             {key:"KN1",label:"Faza I – Krótka narada",ids:["KN1A","KN1B"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×2"}],
            [{key:"NAR1",label:"Narada rodzinna 1",ids:["NAR1"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8"},
             {key:"F2",label:"Tury Fazy II (pierwsze transakcje)",ids:["F2T1","F2T2","F2T3"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×3 tury"},
             {key:"KN2",label:"Faza II – Krótka narada",ids:["KN2A","KN2B"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×2"}],
            [{key:"NAR2",label:"Narada rodzinna 2",ids:["NAR2"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8"},
             {key:"F3",label:"Tury Fazy III (finał)",ids:["F3T1","F3T2","F3T3"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×3 tury"},
             {key:"KN3",label:"Faza III – Krótka narada",ids:["KN3A","KN3B"],color:"#5C4A3A",bg:"#F0EBE0",border:"#D4C4A8",multi:"×2"}],
          ];
          function setGrouped(g,val){setStageDurations(prev=>{var n={...prev};g.ids.forEach(id=>{n[id]=val;});return n;});}
          return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {grouped.flat().map(g=>{var val=stageDurations[g.ids[0]];return(<div key={g.key} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",background:g.bg,borderRadius:4,border:"1px solid "+g.border}}>
              <span style={{fontSize:13,flex:1,fontWeight:600,color:g.color}}>{g.label}{g.multi?<span style={{fontSize:13,fontWeight:400,color:"#A89070",marginLeft:3}}>{g.multi}</span>:null}</span>
              <input type="number" min="1" max="120" value={val} onChange={e=>setGrouped(g,Math.max(1,Number(e.target.value)||1))} style={{width:45,padding:"3px 4px",border:"1px solid #D4C4A8",borderRadius:3,fontSize:13,fontWeight:700,fontFamily:"inherit",textAlign:"center"}}/>
              <span style={{fontSize:13,color:"#A89070"}}>min</span>
            </div>);})}
          </div>);
        })()}
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?0.6:1}}>
            <input type="checkbox" checked={mapEnabled} onChange={e=>!readOnly&&setMapEnabled(e.target.checked)} disabled={readOnly} style={{width:16,height:16,accentColor:"#8B7714",cursor:readOnly?"not-allowed":"pointer"}}/>
            <span style={{fontSize:13,color:"#5C4A3A",fontWeight:500}}>Złotodajna Żyła</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?0.6:1}}>
            <input type="checkbox" checked={bnbEnabled} onChange={e=>{if(!readOnly){if(e.target.checked)activateBnb();else setBnbEnabled(false);}}} disabled={readOnly} style={{width:16,height:16,accentColor:"#8B7714",cursor:readOnly?"not-allowed":"pointer"}}/>
            <span style={{fontSize:13,color:"#5C4A3A",fontWeight:500}}>Biznes na boku</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?0.6:1,marginLeft:16,padding:"4px 10px",background:devMode?"#FFF3E0":"transparent",borderRadius:4,border:devMode?"1px solid #E8C060":"1px solid transparent"}}>
            <input type="checkbox" checked={devMode} onChange={e=>{if(!readOnly){if(e.target.checked){if(confirm("Przejść w tryb testowy? Gracze uzyskają natychmiastowy dostęp do wszystkich włączonych mechanik i możliwość handlu z dowolną rodziną."))setDevMode(true);}else setDevMode(false);}}} disabled={readOnly} style={{width:16,height:16,accentColor:"#C04030",cursor:readOnly?"not-allowed":"pointer"}}/>
            <span style={{fontSize:13,color:devMode?"#C04030":"#A89070",fontWeight:devMode?700:500}}>Tryb testowy</span>
          </label>
          <button onClick={()=>{if(!readOnly){startStage(0);}}} disabled={readOnly} style={{padding:"8px 24px",fontSize:14,fontFamily:"inherit",fontWeight:700,background:readOnly?"#C4B090":"#2E5B3C",color:"#fff",border:"none",borderRadius:4,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?0.6:1,marginLeft:"auto"}}>
            Start rozgrywki
          </button>
        </div>
      </div>):(<div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <button style={btnS(manualMode?"success":"sheriff")} onClick={()=>setManualMode(!manualMode)}>{manualMode?"Przełącz na tryb auto":"Przełącz na tryb ręczny"}</button>
          {!manualMode&&timerRunning&&!timerPaused&&<button style={btnS("sheriff")} onClick={pauseTimer}>Pauza</button>}
          {!manualMode&&timerPaused&&<button style={btnS("success")} onClick={resumeTimer}>Wznów</button>}
          {!manualMode&&<button style={btnS("primary")} onClick={advanceStage}>{stageIdx<STAGES.length-1?"Następny etap →":"Zakończ"}</button>}
          {timerRunning&&<span style={{fontSize:18,fontWeight:700,color:"#842504",fontFamily:"monospace"}}>{Math.floor(secondsLeft/60)+":"+(secondsLeft%60<10?"0":"")+(secondsLeft%60)}</span>}
          <span style={{fontSize:13,color:"#A89070",fontStyle:"italic",marginLeft:8}}>Tryb: {manualMode?"ręczny":"automatyczny"}</span>
        </div>
        {(mapEnabled||bnbEnabled)&&<div style={{marginBottom:8,padding:"6px 10px",background:"#E8F5E8",border:"1px solid #90C090",borderRadius:4,fontSize:13,color:"#2E5B3C"}}>
          <span style={{fontWeight:700}}>Dodatki:</span>{" "}{mapEnabled&&<span style={{marginRight:10}}>{"✓"} Złotodajna Żyła</span>}{bnbEnabled&&<span>{"✓"} Biznes na boku</span>}
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:4}}>
          {STAGES.map((s,idx)=>{var isCur=idx===stageIdx,isDone=idx<stageIdx;
            return(<div key={s.id} onClick={manualMode?()=>{if(idx<stageIdx){if(!confirm("Cofni\u0119cie do wcze\u015Bniejszego etapu mo\u017Ce spowodowa\u0107 niespójno\u015Bci w danych gry. Kontynuowa\u0107?"))return;}startStage(idx);}:undefined} style={{padding:"4px 8px",borderRadius:3,fontSize:13,fontWeight:isCur?700:400,background:isCur?"#D4A853":isDone?"#E8F0E8":"#F5F2E8",color:isCur?"#2C1810":isDone?"#2E5B3C":"#A89070",border:isCur?"2px solid #8B6914":"1px solid transparent",opacity:isDone?0.6:1,cursor:manualMode?"pointer":"default"}}>
              {isCur&&"▶ "}{s.label} ({stageDurations[s.id]} min){isDone&&" ✓"}
            </div>);
          })}
        </div>
      </div>)}
    </div>

    {/* === 2. PANEL OPERACYJNY === */}
    {gameStarted&&<div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:"#842504",marginBottom:10}} className="wt">Panel operacyjny</div>
      <div style={{display:"flex",gap:16}}>
        {/* Left: Alerty feed */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"#5C4A3A",marginBottom:6}}>Alerty</div>
          <div style={{maxHeight:140,overflowY:"auto",border:"1px solid #E8E0D0",borderRadius:4,padding:6,background:"#FDFAF4"}}>
            {alerts.length===0&&<div style={{fontSize:13,color:"#A89070",fontStyle:"italic"}}>Brak alertów</div>}
            {alerts.map(a=><div key={a.key} style={{fontSize:13,color:a.isAlarm?"#8B2500":"#5C4A3A",padding:"3px 0",borderBottom:"1px solid #F0EBE0"}}>
              <span style={{fontSize:11,color:"#A89070",marginRight:6}}>{new Date(a.ts).toLocaleTimeString("pl",{hour:"2-digit",minute:"2-digit"})}</span>
              {a.isAlarm&&<span style={{color:"#8B2500",marginRight:4}}>{"⚠"}</span>}
              {a.text}
            </div>)}
          </div>
        </div>
        {/* Right: Adwersarze */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"#5C4A3A",marginBottom:6}}>Adwersarze</div>
          <div style={{border:"1px solid #E8E0D0",borderRadius:4,padding:8,background:"#FDFAF4"}}>
            {curPairs?(<div>
              <div style={{fontSize:12,color:"#A89070",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Aktualna tura</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
                {curPairs.pairs.map((p,i)=>(
                  <div key={i} style={{fontSize:15,fontWeight:700}}>
                    <span style={{color:FM[p[0]].col}}>{FM[p[0]].nom}</span>
                    <span style={{color:"#D4A853",margin:"0 6px"}}>{"↔"}</span>
                    <span style={{color:FM[p[1]].col}}>{FM[p[1]].nom}</span>
                  </div>
                ))}
              </div>
            </div>):<div style={{fontSize:13,color:"#A89070",fontStyle:"italic",marginBottom:8}}>Brak aktywnej tury handlowej</div>}
            {nextPairs&&<div>
              <div style={{fontSize:12,color:"#A89070",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Następna</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {nextPairs.pairs.map((p,i)=>(
                  <div key={i} style={{fontSize:13,fontWeight:600}}>
                    <span style={{color:FM[p[0]].col}}>{FM[p[0]].nom}</span>
                    <span style={{color:"#D4A853",margin:"0 4px"}}>{"↔"}</span>
                    <span style={{color:FM[p[1]].col}}>{FM[p[1]].nom}</span>
                  </div>
                ))}
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>}

    {/* === 3. KONSULTACJE === */}
    <div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:"#842504",marginBottom:10}} className="wt">Konsultacje</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {FO.map(fId=>{
          var f=FM[fId];
          var fWaiting=getFamilyWaiting(fId);
          var fConsults=getFamilyConsults(fId);
          var hasWaiting=fWaiting.length>0;
          return(<div key={fId} style={{background:hasWaiting?"#FFF0F0":"#FDFAF4",border:"2px solid "+f.col,borderRadius:6,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:700,color:f.col}} className="wt">{f.nom}</div>
              {hasWaiting&&<div style={{background:"#8B2500",color:"#fff",padding:"2px 8px",borderRadius:10,fontSize:12,fontWeight:600}}>
                {"\uD83D\uDD14"} {new Date(fWaiting[0].ts).toLocaleTimeString("pl",{hour:"2-digit",minute:"2-digit"})}
              </div>}
            </div>
            {hasWaiting&&<div style={{marginBottom:6}}>
              {fWaiting.map(call=>{var absIdx=sheriffCalls.indexOf(call);return(
                <div key={absIdx} style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button style={{...btnS("success"),fontSize:12,padding:"3px 8px"}} onClick={()=>!readOnly&&grantConsultation(call.fId)}>Sprzedaj</button>
                  <button style={{fontSize:12,padding:"3px 6px",background:"#E8E0D0",color:"#5C4A3A",border:"1px solid #D4C4A8",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontWeight:600}} onClick={()=>!readOnly&&dismissCall(absIdx)}>Odrzuć</button>
                </div>
              );})}
            </div>}
            {fConsults.length===0&&!hasWaiting&&<div style={{fontSize:13,color:"#A89070",fontStyle:"italic",marginBottom:4}}>{"○"} brak wezwań</div>}
            {fConsults.map((c,idx)=>{
              var used=c.questionsUsed,total=c.questionsTotal,rem=total-used;
              var dots=[];for(var di=0;di<total;di++){dots.push(<span key={di} style={{color:di<used?"#842504":"#D4C4A8",fontSize:14}}>{di<used?"●":"○"}</span>);}
              return(<div key={idx} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#5C4A3A"}}>K{idx+1}:</span>
                <span style={{display:"flex",gap:1}}>{dots}</span>
                {rem>0?<button style={{fontSize:11,padding:"2px 6px",background:"#8B6914",color:"#fff",border:"none",borderRadius:3,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>!readOnly&&completeConsult(fId,idx)}>Odnotuj</button>
                :<span style={{fontSize:12,color:"#2E5B3C",fontWeight:600}}>{"✓"}</span>}
              </div>);
            })}
            <div style={{marginTop:6,borderTop:"1px solid #E8E0D0",paddingTop:4}}>
              <button onClick={()=>toggleNotes(fId)} style={{fontSize:11,padding:"2px 6px",background:"transparent",color:"#8B7355",border:"1px solid #D4C4A8",borderRadius:3,cursor:"pointer",fontFamily:"inherit"}}>
                {expandedNotes[fId]?"▼ notatki":"▶ notatki"}
              </button>
              {expandedNotes[fId]&&<textarea value={consultNotes[fId]||""} onChange={e=>{var v=e.target.value;setConsultNotes(prev=>({...prev,[fId]:v}));}} style={{width:"100%",minHeight:40,fontSize:12,fontFamily:"inherit",border:"1px solid #D4C4A8",borderRadius:4,padding:4,resize:"vertical",marginTop:4}} placeholder={"Notatki..."}/>}
            </div>
          </div>);
        })}
      </div>
    </div>

    {/* === 4. STATYSTYKI RODZIN === */}
    <div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:"#842504",marginBottom:10}} className="wt">Statystyki rodzin</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {FO.map(fId=>{var f=FM[fId],d=fd[fId],sc=calcScore(fId,fd,plotPenalties,biznesNaBoku,bnbEnabled,blindFate,mapEnabled,mapBonusClaimed);
          var plotI=d.items.find(i=>i.cat===C_PLOT),plotOk=plotI&&plotI.plotNr===f.tPlot;
          return (<div key={fId} style={{background:"#fff",border:"2px solid "+f.col,borderRadius:6,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:700,color:f.col}} className="wt">{f.nom}</div>
              <button style={{fontSize:12,padding:"2px 6px",background:f.col,color:"#fff",border:"none",borderRadius:3,cursor:"pointer",fontFamily:"inherit",fontWeight:600}} onClick={()=>onViewFamily(fId)}>Podgląd</button>
            </div>
            <div style={{fontSize:13,color:"#5C4A3A",lineHeight:1.7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>Gotówka: <b>{d.cash} $</b></span>
                <span>Dz. {plotI?plotI.plotNr:"–"} {plotOk?<span style={{color:"#2E5B3C"}}>{"✓"}</span>:<span style={{color:"#C06030"}}>cel:{f.tPlot}</span>}</span>
              </div>
              <div style={{padding:"3px 6px",background:"#F0EBE0",borderRadius:3,fontWeight:700,fontSize:13,textAlign:"center",marginTop:4}}>{sc.bizTotal} pkt (biz.) + {calcRelationScore(fId,relations)} pkt (rel.)</div>
            </div>
          </div>);
        })}
      </div>
    </div>

    {/* === 5. KSIĘGOWOŚĆ === */}
    <div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:18,fontWeight:700,color:"#842504"}} className="wt">Księgowość</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {!readOnly&&allTx.length>0&&!undoConfirm&&<button style={btnS("danger")} onClick={()=>setUndoConfirm(true)}>Cofnij ostatnią transakcję</button>}
          {!readOnly&&undoConfirm&&<div style={{display:"flex",gap:4,alignItems:"center",background:"#FEE",padding:"4px 8px",borderRadius:4,border:"1px solid #C88"}}>
            <span style={{fontSize:13,color:"#8B2500"}}>Cofnąć: {allTx[0]&&(FM[allTx[0].from].nom+"→"+FM[allTx[0].to].nom)}?</span>
            <button style={{...btnS("danger"),fontSize:13,padding:"3px 8px"}} onClick={undoLastTx}>Tak</button>
            <button style={{...btnS("primary"),fontSize:13,padding:"3px 8px"}} onClick={()=>setUndoConfirm(false)}>Nie</button>
          </div>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
      {FO.map(fId=>{
        var f=FM[fId];
        var fTx=allTx.filter(t=>t.from===fId||t.to===fId);
        var fPen=penaltyTx.filter(t=>t.from===fId);
        var fFate=txs.filter(t=>t.type==="fate"&&t.from===fId&&t.status==="accepted");
        var fMap=txs.filter(t=>t.type==="map_bonus"&&t.status==="accepted"&&(t.from===fId||(t.to==="all"&&t.from!==fId)));
        var fBnb=txs.filter(t=>(t.type==="bnb_settle"||t.type==="bnb_bonus")&&(t.from===fId||t.to===fId)&&t.status==="accepted");
        var fRev=txs.filter(t=>t.type==="revolver"&&(t.from===fId||t.to===fId)&&t.status==="accepted");
        var fCancelled=txs.filter(t=>t.status==="cancelled"&&(t.type==="sale"||t.type==="barter")&&(t.from===fId||t.to===fId));
        var hasAny=fTx.length>0||fPen.length>0||fFate.length>0||fMap.length>0||fBnb.length>0||fRev.length>0||fCancelled.length>0;
        return(<div key={fId} style={{background:"#fff",border:"2px solid "+f.col,borderRadius:6,padding:10}}>
          <div style={{fontSize:13,fontWeight:700,color:f.col,marginBottom:6}} className="wt">{f.nom}</div>
          <div style={{height:264,overflowY:"auto"}}>
          {!hasAny&&<div style={{fontSize:13,color:"#A89070",fontStyle:"italic"}}>Brak wpisów</div>}
          {fTx.map(tx=>{
            var isFrom=tx.from===fId,other=FM[isFrom?tx.to:tx.from];
            return(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#5C4A3A"}}>
              <b style={{color:tx.type==="sale"?"#8B7355":"#4A3B6B"}}>{tx.type==="sale"?(isFrom?"Sprzedaż":"Zakup"):"Barter"}</b> {isFrom?"→":"←"} {other.nom}
              {tx.type==="sale"&&<span>: {fmtItems(tx.offeredItems)} za {tx.price} $</span>}
              {tx.type==="barter"&&<span>: {fmtItems(tx.offeredItems)} {"↔"} {fmtItems(tx.responseItems)}</span>}
            </div>);
          })}
          {fFate.map(tx=>(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#2E5B3C"}}><b>{"Ślepy los:"}</b> {tx.description}</div>))}
          {fMap.map(tx=>(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#8B7714"}}><b>Mapa:</b> {tx.from===fId?"Bonus 300 $ (kompletna mapa)":"Opłata 100 $ (mapa "+(FM[tx.from]||{gen:tx.from}).gen+")"}</div>))}
          {fBnb.map(tx=>(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#8B7714"}}><b>BnB:</b> {tx.description}</div>))}
          {fRev.map(tx=>{var isWin=tx.to===fId;return(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#8B2500"}}><b>Rewolwerowiec:</b> {isWin?"Wygrana":"Przegrana"} {tx.amount} $ ({tx.field}) {isWin?"← "+(FM[tx.from]||{nom:tx.from}).nom:"→ "+(FM[tx.to]||{nom:tx.to}).nom}</div>);})}
          {fPen.map(tx=>(<div key={tx.id} style={{padding:"4px 0",fontSize:13,color:"#8B2500"}}><b>Działka:</b> {tx.description}</div>))}
          {fCancelled.map(tx=>{var isFrom=tx.from===fId,other=FM[isFrom?tx.to:tx.from];return(<div key={tx.id} style={{padding:"4px 0",borderBottom:"1px solid #F0EBE0",fontSize:13,color:"#8B2500",fontStyle:"italic"}}>
            <b>ANULOWANA:</b> {tx.type==="sale"?(isFrom?"Sprzedaż":"Zakup"):"Barter"} {isFrom?"→":"←"} {other.nom}
            {tx.type==="sale"&&<span>: {fmtItems(tx.offeredItems)} za {tx.price} $</span>}
            {tx.cancelReason&&<span> ({tx.cancelReason})</span>}
          </div>);})}
          </div>
        </div>);
      })}
      </div>
    </div>

    {/* === 6. MECHANIKI === */}
    <div style={{...boxBg,border:"1px solid #D4C4A8",borderRadius:6,padding:14,marginBottom:16}}>
      {/* Unlock/lock buttons row */}
      {!readOnly&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <button style={btnS(fateEnabled?"danger":"success")} onClick={()=>{setFateEnabled(!fateEnabled);showMsg(fateEnabled?"Ślepy los – zablokowany":"Ślepy los – odblokowany");}}>{fateEnabled?"Zablokuj ŚLEPY LOS":"Odblokuj ŚLEPY LOS"}</button>
        {!revEnabled?<button style={btnS("success")} onClick={()=>setRevEnabled(true)}>Odblokuj REWOLWEROWIEC</button>
        :revActive.length===0&&<button style={btnS("danger")} onClick={()=>setRevEnabled(false)}>Zablokuj REWOLWEROWIEC</button>}
        {!relationsUnlocked?<button style={btnS("success")} onClick={()=>setRelationsUnlocked(true)}>Odblokuj RELACJE</button>
        :<button style={btnS("danger")} onClick={()=>{if(window.confirm("Na pewno zablokować zakładkę BUDOWANIE RELACJI dla wszystkich graczy?"))setRelationsUnlocked(false);}}>Zablokuj RELACJE</button>}
      </div>}
      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:"2px solid #842504",marginBottom:12}}>
        {[{id:"fate",label:"Ślepy Los",enabled:fateEnabled},{id:"rev",label:"Rewolwerowiec",enabled:revEnabled},{id:"rel",label:"Relacje",enabled:relationsUnlocked},{id:"bnb",label:"Biznes na boku",enabled:bnbEnabled}].map(tab=>(
          <button key={tab.id} onClick={()=>tab.enabled&&setMechTab(tab.id)} style={{padding:"8px 16px",fontSize:14,fontWeight:mechTab===tab.id?700:500,color:mechTab===tab.id?"#fff":tab.enabled?"#842504":"#C4B090",background:mechTab===tab.id?"#842504":"transparent",border:"none",borderRadius:"6px 6px 0 0",cursor:tab.enabled?"pointer":"not-allowed",fontFamily:"inherit",opacity:tab.enabled?1:0.5}}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab content: Ślepy Los */}
      {mechTab==="fate"&&(fateEnabled?<div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:"#842504",marginBottom:8}} className="wt">{"Ślepy los – kontrola"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
            {FO.map(fId=>{var f=FM[fId],bf=blindFate[fId]||{},pol=bf.policies||{p50:null,p100:null},rolls=bf.rolls||[];
              var rollsDone=rolls.filter(r=>r.resolved).length,rollsPending=rolls.filter(r=>!r.resolved).length;
              var avPol=[];if(pol.p50==="owned")avPol.push({l:"50%",v:50});if(pol.p100==="owned")avPol.push({l:"100%",v:100});
              return (<div key={fId} style={{background:"#FFF8E7",border:"1px solid "+f.col,borderRadius:5,padding:10}}>
                <div style={{fontSize:13,fontWeight:700,color:f.col,marginBottom:6}} className="wt">{f.nom}</div>
                <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                  <button style={{...btnS("fate"),fontSize:13,padding:"3px 8px",opacity:pol.p50?0.4:1}} onClick={()=>!readOnly&&activatePolicy(fId,"p50")} disabled={readOnly||!!pol.p50}>Polisa 50% (30$)</button>
                  {pol.p50==="owned"&&<button style={{fontSize:13,padding:"3px 8px",background:"#C09090",color:"#fff",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontWeight:600}} onClick={()=>!readOnly&&undoPolicy(fId,"p50")}>Cofnij 50%</button>}
                  <button style={{...btnS("fate"),fontSize:13,padding:"3px 8px",opacity:pol.p100?0.4:1}} onClick={()=>!readOnly&&activatePolicy(fId,"p100")} disabled={readOnly||!!pol.p100}>Polisa 100% (50$)</button>
                  {pol.p100==="owned"&&<button style={{fontSize:13,padding:"3px 8px",background:"#C09090",color:"#fff",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontWeight:600}} onClick={()=>!readOnly&&undoPolicy(fId,"p100")}>Cofnij 100%</button>}
                </div>
                {rollsPending===0&&rollsDone<2&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button style={{...btnS("fate"),fontSize:13,padding:"3px 8px"}} onClick={()=>!readOnly&&prepareRoll(fId,null)}>Bez polisy</button>
                  {avPol.map(ap=><button key={ap.v} style={{...btnS("fate"),fontSize:13,padding:"3px 8px"}} onClick={()=>!readOnly&&prepareRoll(fId,ap.v)}>Z polisą {ap.l}</button>)}
                </div>}
                {rolls.map((roll,idx)=>(<div key={idx} style={{fontSize:13,color:"#5C4A3A",marginTop:4,padding:4,background:"#FFF8E7",borderRadius:3}}>
                  <b>Rzut {idx+1}:</b> {roll.resolved?<span>{roll.dice1}+{roll.dice2}={roll.sum} &rarr; {roll.netEffectText}{roll.showCard&&<button style={{fontSize:13,padding:"1px 4px",marginLeft:4,cursor:"pointer",background:"#E8E0D0",border:"1px solid #C4B090",borderRadius:2,fontFamily:"inherit"}} onClick={()=>!readOnly&&clearCard(fId,idx)}>Ukryj</button>}</span>:<span style={{fontStyle:"italic"}}>oczekuje...</span>}
                </div>))}
              </div>);
            })}
          </div>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:"#842504",marginBottom:8}} className="wt">{"Ślepy los – historia zbiorcza"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {FO.map(fId=>{var f=FM[fId],bf=blindFate[fId]||{},pol=bf.policies||{p50:null,p100:null},rolls=(bf.rolls||[]).filter(r=>r.resolved);
            return (<div key={fId} style={{background:"#fff",border:"2px solid "+f.col,borderRadius:6,padding:10}}>
              <div style={{fontSize:13,fontWeight:700,color:f.col,marginBottom:6}} className="wt">{f.nom}</div>
              <div style={{fontSize:13,color:"#5C4A3A",marginBottom:4}}>
                <b>Polisy:</b>{" "}
                {pol.p50==="owned"?"50% w posiadaniu":pol.p50==="used"?"50% wykorzystana":"50% –"}{" | "}
                {pol.p100==="owned"?"100% w posiadaniu":pol.p100==="used"?"100% wykorzystana":"100% –"}
              </div>
              {rolls.length>0?<div style={{fontSize:13,color:"#5C4A3A"}}>
                <b>Losowania:</b>
                {rolls.map((r,i)=>(<div key={i} style={{padding:"3px 0",borderBottom:i<rolls.length-1?"1px dotted #E0D8E8":"none"}}>
                  Rzut {i+1}: {r.dice1}+{r.dice2}={r.sum} – <i>{r.event.text}</i> {"→"} <b style={{color:r.netEffect>=0?"#2E5B3C":"#8B2500"}}>{r.netEffectText}</b>{r.policyUsed?" (polisa "+r.policyUsed+"%)":""}
                </div>))}
              </div>:<div style={{fontSize:13,color:"#A89070",fontStyle:"italic"}}>Brak losowań</div>}
            </div>);
          })}
          </div>
        </div>
      </div>:<div style={{padding:20,textAlign:"center",color:"#A89070",fontSize:14,fontStyle:"italic"}}>{"Ślepy Los jest zablokowany"}</div>)}

      {/* Tab content: Rewolwerowiec */}
      {mechTab==="rev"&&(revEnabled?<div>
        {!readOnly&&<div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:4,alignItems:"center",background:"#fff",border:"1px solid #842504",borderRadius:6,overflow:"hidden"}}>
            {["arena","tournament"].map(m=><button key={m} style={{padding:"6px 14px",fontSize:13,fontWeight:700,border:"none",cursor:revActive.length>0?"not-allowed":"pointer",background:revMode===m?"#842504":"transparent",color:revMode===m?"#fff":"#842504",opacity:revActive.length>0&&revMode!==m?0.4:1}} onClick={()=>{if(revActive.length===0)setRevMode(m);}} disabled={revActive.length>0}>{m==="arena"?"Arena":"Turniej"}</button>)}
          </div>
          <label style={{fontSize:13,color:"#5C4A3A"}}>Max stawka ($):</label>
          <input type="number" min={1} step={1} value={revMaxBet} onChange={e=>setRevMaxBet(Math.max(1,parseInt(e.target.value)||1))} style={{width:70,padding:4,borderRadius:4,border:"1px solid #842504",fontSize:13}} disabled={revActive.length>0}/>
        </div>}
        {revMode==="arena"&&revActive.length===0&&!readOnly&&<div>
          <div style={{fontSize:13,fontWeight:600,color:"#5C4A3A",marginBottom:6}}>Wybierz parę do pojedynku:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {FO.map((a,ai)=>FO.slice(ai+1).map(b=>{
              var played=revDuels.some(d=>(d.familyA===a&&d.familyB===b)||(d.familyA===b&&d.familyB===a));
              return(<button key={a+b} style={{...btnS(played?"secondary":"warning",false),fontSize:13,opacity:played?0.5:1}} onClick={()=>{if(!played)revNewDuel(a,b);}} disabled={played} title={played?"Już rozegrano":""}>{FM[a].nom} vs {FM[b].nom}{played?" ✓":""}</button>);
            }))}
          </div>
        </div>}
        {revMode==="arena"&&revCurrent&&revCurrent.status==="betting"&&!readOnly&&<div style={{background:"#fff",border:"1px solid #842504",borderRadius:6,padding:12,marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:"#8B2500",marginBottom:8}} className="wt">{FM[revCurrent.familyA].nom} vs {FM[revCurrent.familyB].nom}</div>
          <div style={{fontSize:13,color:"#5C4A3A",marginBottom:6}}>Ustalcie stawkę (max {revMaxBet} $):</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="number" id="revBetInput" min={1} max={revMaxBet} step={1} defaultValue={Math.min(30,revMaxBet)} style={{width:80,padding:4,borderRadius:4,border:"1px solid #842504",fontSize:13}}/>
            <button style={btnS("success")} onClick={()=>{var v=parseInt(document.getElementById("revBetInput").value)||0;if(v<1||v>revMaxBet){showMsg("Stawka musi wynosić od 1 do "+revMaxBet+" $");return;}revSetBet(v);}}>Zatwierdź stawkę</button>
            <button style={btnS("danger")} onClick={()=>setRevActive(prev=>prev.filter((_,i)=>i!==0))}>Anuluj</button>
          </div>
        </div>}
        {revMode==="tournament"&&revActive.length===0&&!readOnly&&(()=>{
          var allPairs=[];FO.forEach((a,ai)=>FO.slice(ai+1).forEach(b=>{var played=revDuels.some(d=>(d.familyA===a&&d.familyB===b)||(d.familyA===b&&d.familyB===a));allPairs.push({a,b,played});}));
          var combos=[];
          for(var i=0;i<allPairs.length;i++){for(var j=i+1;j<allPairs.length;j++){var p1=allPairs[i],p2=allPairs[j];var fams=new Set([p1.a,p1.b,p2.a,p2.b]);if(fams.size===4&&!p1.played&&!p2.played)combos.push([p1,p2]);}}
          return(<div>
            <div style={{fontSize:13,fontWeight:600,color:"#5C4A3A",marginBottom:6}}>Wybierz sparowanie turnieju (2 pary, 4 rodziny):</div>
            {combos.length===0&&<div style={{fontSize:13,color:"#A89070",fontStyle:"italic"}}>Brak dostępnych sparowań – wszystkie możliwe pary zostały już rozegrane.</div>}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {combos.map((combo,ci2)=>{var [p1,p2]=combo;return(<div key={ci2} style={{display:"flex",gap:8,alignItems:"center",background:"#fff",border:"1px solid #D4C4A8",borderRadius:6,padding:"8px 12px"}}>
                <div style={{flex:1,fontSize:13}}><b style={{color:FM[p1.a].col}}>{FM[p1.a].nom}</b> vs <b style={{color:FM[p1.b].col}}>{FM[p1.b].nom}</b></div>
                <div style={{fontSize:13,color:"#8B7355"}}>+</div>
                <div style={{flex:1,fontSize:13}}><b style={{color:FM[p2.a].col}}>{FM[p2.a].nom}</b> vs <b style={{color:FM[p2.b].col}}>{FM[p2.b].nom}</b></div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input type="number" id={"tBet"+ci2} min={1} max={revMaxBet} step={1} defaultValue={Math.min(30,revMaxBet)} style={{width:70,padding:4,borderRadius:4,border:"1px solid #842504",fontSize:13}}/>
                  <span style={{fontSize:11,color:"#8B7355"}}>$</span>
                  <button style={btnS("success")} onClick={()=>{var v=parseInt(document.getElementById("tBet"+ci2).value)||0;if(v<1||v>revMaxBet){showMsg("Stawka od 1 do "+revMaxBet+" $");return;}revStartTournament([p1.a,p1.b],[p2.a,p2.b],v);}}>Startuj turniej</button>
                </div>
              </div>);})}
            </div>
          </div>);
        })()}
        {revActive.filter(d=>d.status!=="betting").length>0&&<div style={{display:"grid",gridTemplateColumns:revActive.filter(d=>d.status!=="betting").length>1?"1fr 1fr":"1fr",gap:12,marginTop:8}}>
          {revActive.filter(d=>d.status!=="betting").map(duel=>{
            var dt=getRevTimer(duel.id);
            return(<div key={duel.id} style={{background:"#fff",border:"1px solid #842504",borderRadius:6,padding:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#8B2500",marginBottom:4}} className="wt">{FM[duel.familyA].nom} vs {FM[duel.familyB].nom} {"–"} stawka: {duel.bet} $</div>
              {duel.status==="playing"&&<div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:13,color:FM[duel.familyA].col}}><b>{FM[duel.familyA].nom}</b>: {duel.ammoA} szt. {duel.shotsA!==null?"(✓ gotowy)":"(czeka...)"}</div>
                  <div style={{fontSize:13,color:FM[duel.familyB].col}}><b>{FM[duel.familyB].nom}</b>: {duel.ammoB} szt. {duel.shotsB!==null?"(✓ gotowy)":"(czeka...)"}</div>
                </div>
                <div style={{display:"flex",gap:2,marginBottom:8,alignItems:"stretch"}}>
                  {["WYGRANA","DOMINACJA","PRZEWAGA","POJEDYNEK","PRZEWAGA","DOMINACJA","WYGRANA"].map((label,idx)=>{
                    var pos=idx-3,isBullet=duel.bulletPos===pos;
                    var img=getRevImg(label==="POJEDYNEK"?"POJEDYNEK":label==="PRZEWAGA"?"PRZEWAGA":label==="DOMINACJA"?"DOMINACJA":"WYGRANA");
                    return(<div key={idx} style={{flex:1,border:"2px solid "+(isBullet?"#8B2500":"#D4C4A8"),borderRadius:4,textAlign:"center",position:"relative",overflow:"hidden",minHeight:50}}>
                      {img&&<img src={img} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt={label}/>}
                      {!img&&<div style={{padding:"8px 4px"}}><div style={{fontSize:13,fontWeight:700,color:"#8B7355",textTransform:"uppercase"}}>{label}</div></div>}
                      {isBullet&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,50%)"}}>
                        {getRevImg("NABOJ_ZNACZNIK")?<img src={getRevImg("NABOJ_ZNACZNIK")} style={{height:28,filter:"drop-shadow(0 2px 3px rgba(0,0,0,0.5))"}} alt="nabój"/>:<div style={{fontSize:18}}>{"●"}</div>}
                      </div>}
                    </div>);
                  })}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  {[["A",duel.familyA,duel.ammoA],["B",duel.familyB,duel.ammoB]].map(([side,fam,ammo])=>{
                    var col=FM[fam].col;var ammoImg=getRevImg("NABOJ_AMMO");var rows=[];
                    for(var r=0;r<5;r++){var cols2=[];for(var c=0;c<10;c++){var idx2=r*10+c;var alive=idx2<ammo;cols2.push(ammoImg?<div key={c} style={{width:8,height:16,transition:"all 0.3s",opacity:alive?1:0.15}}><img src={ammoImg} style={{width:8,height:16,objectFit:"contain"}} alt=""/></div>:<div key={c} style={{width:8,height:16,borderRadius:2,background:alive?col:"#E8E0D0",border:"1px solid "+(alive?"rgba(0,0,0,0.15)":"#D4C4A8"),opacity:alive?1:0.3}}/>);}rows.push(<div key={r} style={{display:"flex",gap:1,marginBottom:1}}>{cols2}</div>);}
                    return(<div key={side}><div style={{fontSize:11,fontWeight:700,color:col,marginBottom:2}}>{FM[fam].nom}: {ammo}/50</div>{rows}</div>);
                  })}
                </div>
                {(duel.rounds||[]).length>0&&<div style={{fontSize:12,color:"#8B7355",marginBottom:4}}>
                  {(duel.rounds||[]).map((r,i)=><span key={i} style={{marginRight:6}}>R{i+1}: {r.shotsA} vs {r.shotsB} {"→"} {r.winner==="A"?"←":r.winner==="B"?"→":"="}</span>)}
                </div>}
                {duel.shotsA!==null&&duel.shotsB!==null&&<button style={{...btnS("warning"),fontSize:12}} onClick={()=>!readOnly&&revRevealDuel(duel.id)}>Odsłoń strzały</button>}
                {duel.timerPhase&&dt>0&&<div style={{fontSize:14,fontWeight:700,color:dt<=5?"#8B2500":"#842504",textAlign:"center",padding:"4px 0",fontFamily:"monospace"}}>
                  {duel.timerPhase==="declaration"?"Deklaracja: ":"Odsłonięcie: "}{dt}s
                </div>}
              </div>}
              {duel.status==="finished"&&<div style={{background:"#FFF0EC",border:"1px solid #8B2500",borderRadius:4,padding:10,marginTop:4}}>
                <div style={{fontSize:14,fontWeight:700,color:"#842504",marginBottom:4}} className="wt">Koniec!</div>
                <div style={{fontSize:13,color:"#5C4A3A",marginBottom:4}}>{duel.winner?<span>Wygrywa: <b style={{color:FM[duel.winner].col}}>{FM[duel.winner].nom}</b> ({duel.winField})</span>:<span>Remis!</span>}</div>
                {duel.winner&&<div style={{fontSize:12,color:"#5C4A3A",marginBottom:6}}>Transfer: {Math.round(duel.bet*(duel.winField==="wygrana"?1:duel.winField==="dominacja"?2/3:1/3))} $</div>}
                <button style={{...btnS("success"),fontSize:12}} onClick={()=>!readOnly&&revSettleDuel(duel.id)}>Rozlicz</button>
              </div>}
            </div>);
          })}
        </div>}
        {revMode==="tournament"&&revActive.length>0&&revActive.every(d=>d.status==="finished")&&<div style={{textAlign:"center",marginTop:10}}>
          <button style={btnS("success")} onClick={()=>{if(!readOnly)revActive.forEach(d=>revSettleDuel(d.id));}}>Rozlicz oba pojedynki</button>
        </div>}
        {(revDuels||[]).length>0&&<div style={{marginTop:12}}>
          <div style={{fontSize:13,fontWeight:600,color:"#5C4A3A",marginBottom:4}}>Historia pojedynków:</div>
          {revDuels.map(d=>{var wN=d.winner?FM[d.winner].nom:"Remis";return(
            <div key={d.id} style={{fontSize:13,color:"#5C4A3A",padding:"3px 0",borderBottom:"1px dotted #D4C4A8"}}>{FM[d.familyA].nom} vs {FM[d.familyB].nom} {"–"} <b>{wN}</b> ({d.winField}, {d.rounds.length} rund, stawka {d.bet} $)</div>
          );})}
        </div>}
      </div>:<div style={{padding:20,textAlign:"center",color:"#A89070",fontSize:14,fontStyle:"italic"}}>Rewolwerowiec jest zablokowany</div>)}

      {/* Tab content: Relacje */}
      {mechTab==="rel"&&(relationsUnlocked?<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {FO.map(fId=>{var f=FM[fId];var relS=calcRelationScore(fId,relations);
          return (<div key={fId} style={{background:"#fff",border:"1px solid "+f.col,borderRadius:5,padding:8}}>
            <div style={{fontSize:13,fontWeight:700,color:f.col,marginBottom:4}} className="wt">{f.nom}</div>
            <div style={{fontSize:13,color:"#5C4A3A"}}>Otrzymane: <b>{relS} pkt</b></div>
            {FO.filter(r=>r!==fId).map(rater=>{var r=relations[rater]&&relations[rater][fId];
              return (<div key={rater} style={{fontSize:13,color:"#8B7355",marginTop:2}}>od {FM[rater].gen}: {r?(r.partnership||0)+"+"+(r.rules||0)+"+"+(r.communication||0)+"="+(((r.partnership||0)+(r.rules||0)+(r.communication||0)))+"★":"–"}</div>);
            })}
          </div>);
        })}
      </div>:<div style={{padding:20,textAlign:"center",color:"#A89070",fontSize:14,fontStyle:"italic"}}>Budowanie relacji jest zablokowane</div>)}

      {/* Tab content: BnB */}
      {mechTab==="bnb"&&(bnbEnabled?<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:700,color:bnbSettled?"#2E5B3C":"#8B7714",padding:"3px 10px",background:bnbSettled?"#E8F5E8":"#FFF8E7",borderRadius:4,border:"1px solid "+(bnbSettled?"#90C090":"#D4C870")}}>{bnbSettled?"Rozliczono":"Aktywny"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {FO.map(fId=>{
            var f=FM[fId],p=BNB_PRODUCTS[fId];
            var ownCards=fd[fId].items.filter(i=>i.cat===C_BNB&&i.bnbOrigin===fId);
            var soldCount=p.qty-ownCards.length;
            var soldAll=ownCards.length===0;
            var boughtCards=fd[fId].items.filter(i=>i.cat===C_BNB&&i.bnbOrigin!==fId);
            var boughtGrouped={};boughtCards.forEach(i=>{if(!boughtGrouped[i.bnbOrigin])boughtGrouped[i.bnbOrigin]=0;boughtGrouped[i.bnbOrigin]++;});
            var SHERIFF_PLURAL={adams:"butelek",bennet:"kwater",clinton:"polis",dexter:"voucher\u00F3w"};
            return(<div key={fId} style={{background:"#fff",border:"2px solid "+f.col,borderRadius:6,padding:10}}>
              <div style={{fontSize:13,fontWeight:700,color:f.col,marginBottom:6}} className="wt">{f.nom}</div>
              <div style={{fontSize:13,color:"#5C4A3A",marginBottom:6}}><b>Produkt na sprzeda\u017C:</b> {p.name}</div>
              <div style={{display:"flex",gap:12,marginBottom:6}}>
                <div style={{fontSize:13,color:"#5C4A3A"}}>
                  Stan: <b style={{color:soldAll?"#2E5B3C":"#8B7355"}}>{ownCards.length}/{p.qty}</b>
                  <span style={{marginLeft:4,fontSize:13,color:"#A89070"}}>(sprzedano {soldCount})</span>
                </div>
              </div>
              {soldAll&&<div style={{fontSize:13,color:"#2E5B3C",fontWeight:600,marginBottom:4}}>Sprzedano wszystko {"–"} bonifikata 100 $</div>}
              {<div style={{borderTop:"1px solid #E0D8E8",paddingTop:4,marginTop:4}}>
                <div style={{fontSize:13,fontWeight:700,color:"#A89070",marginBottom:2}}>Zakupione produkty:</div>
                {FO.filter(o=>o!==fId).map(o=><div key={o} style={{fontSize:13,color:"#5C4A3A"}}>{BNB_PRODUCTS[o].shortName}: {boughtGrouped[o]||0} {SHERIFF_PLURAL[o]}</div>)}
              </div>}
            </div>);
          })}
        </div>
        {bnbSettled&&<div style={{marginTop:10,padding:8,background:"#E8F5E8",border:"1px solid #90C090",borderRadius:4,fontSize:13,color:"#2E5B3C",textAlign:"center",fontWeight:600}}>Rozliczenie końcowe przeprowadzone {"–"} prowizje pobrane</div>}
      </div>:<div style={{padding:20,textAlign:"center",color:"#A89070",fontSize:14,fontStyle:"italic"}}>Biznes na boku nie jest aktywny</div>)}
    </div>

  </div>);
}

