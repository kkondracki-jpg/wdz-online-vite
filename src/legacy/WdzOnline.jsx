/* ========== MODULE IMPORTS ========== */
import { FM, FO, PAIRINGS, STAGES, PHASE_NAMES, AGENDA_ITEMS, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS, BLIND_FATE_EVENTS, getMeetingPartner } from "../game/constants.js";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { ci, txId, R, RB, K, KB, NR, NK, PL, MP, makeBnbCards, START } from "../game/cards.js";
import { buildView, calcScore, fmtItems, calcRelationScore } from "../game/scoring.js";
import { IMG_BASE, toSlug, imgUrl, mapImgUrl, REV_IMG_MAP, getRevImg, ensureArray, fixFdFromFirebase, revDuelToFB, revDuelFromFB, revActiveToFB, revActiveFromFB } from "../utils/index.js";
import { ConnectionIndicator, StarRating, btnS, InfoPopup, TaskHeader } from "../components/ui.jsx";
import { ResourceCard, CompCard, NoteCard } from "../components/cards.jsx";
import { PlotDisplay } from "../components/PlotDisplay.jsx";
import { BnbTab } from "../components/BnbTab.jsx";
import { TxDisplay } from "../components/TxDisplay.jsx";
import { MapFragImg, MapTracker } from "../components/MapTracker.jsx";
import { DiceSVG, DiceImg } from "../components/dice.jsx";
import { FateEventCard, BlindFateFamily } from "../components/BlindFate.jsx";
import { RewolwerowiecNew } from "../components/Revolver.jsx";
import { InstructionSlides } from "../components/InstructionSlides.jsx";
import { DebriefingPanel } from "../components/DebriefingPanel.jsx";
import { SheriffPlanningTab, SheriffPanel } from "../components/SheriffPanel.jsx";
import { IS_LOCAL, db, auth, fbApp, generateRoomCode, getOrCreatePlayerId, getUrlParams, buildFamilyLink, firebase } from "../firebase/config.js";
import { useConnectionStatus, useServerTimeOffset, usePlayerHeartbeat } from "../hooks/index.js";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

/* ========== OCHRONA OBRAZÓW ========== */
document.addEventListener("dragstart",function(e){if(e.target.tagName==="IMG")e.preventDefault();});

/* ========== CONNECTION INDICATOR ========== */

/* ========== LOBBY COMPONENT ========== */
function Lobby({onJoin}){
  const playerId=useMemo(()=>getOrCreatePlayerId(),[]);
  const urlParams=useMemo(()=>getUrlParams(),[]);
  const initMode=useMemo(()=>{
    if(urlParams.sessionCode&&/^WDZ-[A-HJ-NP-Z2-9]{6}$/.test(urlParams.sessionCode)&&FO.indexOf(urlParams.familyId)>=0) return "link_join";
    return null;
  },[]);
  const [mode,setMode]=useState(initMode);
  const [roomCode,setRoomCode]=useState(initMode==="link_join"?urlParams.sessionCode:"");
  const [joinCode,setJoinCode]=useState("");
  const [showCodeInput,setShowCodeInput]=useState(false);
  const [selectedRole,setSelectedRole]=useState(initMode==="link_join"?urlParams.familyId:null);
  const [playerName,setPlayerName]=useState("");
  const [nameSubmitted,setNameSubmitted]=useState(false);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(false);
  const [players,setPlayers]=useState({});
  const [sheriffEntryCode,setSheriffEntryCode]=useState("");
  const [sheriffEntryRole,setSheriffEntryRole]=useState(null); // null|"sheriff"|"sheriff2"|"owner"
  const [sheriffEmail,setSheriffEmail]=useState("");
  const [sheriffPassword,setSheriffPassword]=useState("");
  const [sheriffLoginLoading,setSheriffLoginLoading]=useState(false);
  const [sheriffLoginError,setSheriffLoginError]=useState(null);
  const [resetSent,setResetSent]=useState(false);
  const online=useConnectionStatus();

  // link_join: validate room exists
  useEffect(()=>{
    if(mode!=="link_join"||!db) return;
    db.ref("rooms/"+roomCode+"/meta").once("value").then(snap=>{
      if(!snap.exists()){setError("Rozgrywka "+roomCode+" nie istnieje. Sprawdź link.");setMode(null);}
      else if(snap.val().status==="archived"){setError("Ta rozgrywka została zarchiwizowana i nie jest już dostępna.");setMode(null);}
    }).catch(e=>{setError("Błąd połączenia: "+e.message);});
  },[]);

  // Listen to players in room
  useEffect(()=>{
    if(!roomCode||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/players");
    var cb=ref.on("value",snap=>{setPlayers(snap.val()||{});});
    return()=>ref.off("value",cb);
  },[roomCode]);

  // Register presence for Sheriff
  useEffect(()=>{
    if(!roomCode||selectedRole!=="sheriff"||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/players/sheriff");
    ref.update({connected:true,joinedAt:firebase.database.ServerValue.TIMESTAMP});
    ref.onDisconnect().update({connected:false});
    return()=>{ref.onDisconnect().cancel();};
  },[roomCode,selectedRole]);

  // Register presence for family member after name submitted
  useEffect(()=>{
    if(!roomCode||!selectedRole||selectedRole==="sheriff"||selectedRole==="sheriff2"||!nameSubmitted||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/players/"+selectedRole+"/members/"+playerId);
    ref.set({name:playerName,lastSeen:firebase.database.ServerValue.TIMESTAMP});
    ref.onDisconnect().remove();
    return()=>{ref.onDisconnect().cancel();};
  },[roomCode,selectedRole,nameSubmitted]);

  // Auto-transition for players when game starts
  useEffect(()=>{
    if(!roomCode||!selectedRole||selectedRole==="sheriff"||selectedRole==="sheriff2"||!nameSubmitted||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/meta/status");
    var cb=ref.on("value",snap=>{
      if(snap.val()==="playing"){ref.off("value",cb);onJoin(roomCode,selectedRole,playerId,playerName);}
    });
    return()=>ref.off("value",cb);
  },[roomCode,selectedRole,nameSubmitted]);

  // === SHERIFF ENTRY – WDZ code via ticket ===
  function handleSheriffEntry(role){
    var code=sheriffEntryCode.trim().toUpperCase();
    if(!code){setError("Wpisz kod z biletu.");return;}
    if(!/^WDZ-[A-HJ-NP-Z2-9]{6}$/.test(code)){setError("Nieprawidłowy format kodu (WDZ-XXXXXX).");return;}
    if(!db){setError("Brak połączenia z Firebase.");return;}
    if(!auth||!auth.currentUser){setError("Trwa uwierzytelnianie – spróbuj ponownie za chwilę.");return;}
    setLoading(true);setError(null);
    var roleKey=role==="sheriff2"?"sheriff2":"sheriff";
    db.ref("tickets").orderByChild("sheriffCode").equalTo(code).once("value").then(function(snap){
      if(!snap.exists()){setError("Nieprawidłowy kod. Skontaktuj się z organizatorem.");setLoading(false);return;}
      var foundRoomCode=null;
      snap.forEach(function(child){foundRoomCode=child.val().roomCode;});
      db.ref("rooms/"+foundRoomCode+"/meta").once("value").then(function(metaSnap){
        if(metaSnap.exists()){
          db.ref("rooms/"+foundRoomCode+"/players/"+roleKey).set({connected:true,rejoinedAt:firebase.database.ServerValue.TIMESTAMP});
          db.ref("rooms/"+foundRoomCode+"/players/"+roleKey).onDisconnect().update({connected:false});
          db.ref("rooms/"+foundRoomCode+"/roles/"+roleKey).set(auth.currentUser.uid).then(function(){
            setSheriffEntryRole(null);setRoomCode(foundRoomCode);setSelectedRole(roleKey);setLoading(false);
            onJoin(foundRoomCode,roleKey,null,null);
          }).catch(function(e){setError("Błąd zapisu roli: "+e.message);setLoading(false);});
        } else {
          if(role==="sheriff2"){setError("Rozgrywka jeszcze nie istnieje. Główny Szeryf musi ją utworzyć pierwszy.");setLoading(false);return;}
          db.ref("rooms/"+foundRoomCode+"/meta").transaction(function(current){
            if(current!==null)return;
            return{created:firebase.database.ServerValue.TIMESTAMP,status:"lobby"};
          },function(err2,committed2){
            if(err2||!committed2){setError(err2?"Błąd tworzenia rozgrywki: "+err2.message:"Rozgrywka z tym kodem już istnieje.");setLoading(false);return;}
            db.ref("rooms/"+foundRoomCode+"/roles/sheriff").set(auth.currentUser.uid).then(function(){
              db.ref("rooms/"+foundRoomCode+"/players/sheriff").set({connected:true,joinedAt:firebase.database.ServerValue.TIMESTAMP}).then(function(){
                setSheriffEntryRole(null);setRoomCode(foundRoomCode);setSelectedRole("sheriff");setMode("created");setLoading(false);
                db.ref("rooms/"+foundRoomCode+"/players/sheriff").onDisconnect().update({connected:false});
              }).catch(function(e){setError("Błąd: "+e.message);setLoading(false);});
            }).catch(function(e){setError("Błąd zapisu roli: "+e.message);setLoading(false);});
          });
        }
      }).catch(function(e){setError("Błąd połączenia: "+e.message);setLoading(false);});
    }).catch(function(e){setError("Błąd weryfikacji: "+e.message);setLoading(false);});
  }

  // === OWNER – email login for ticket-free games ===
  function handleOwnerSignIn(){
    if(!sheriffEmail.trim()||!sheriffPassword){setSheriffLoginError("Wpisz email i hasło.");return;}
    if(!auth){setSheriffLoginError("Brak połączenia z Firebase.");return;}
    setSheriffLoginLoading(true);setSheriffLoginError(null);
    auth.signInWithEmailAndPassword(sheriffEmail.trim(),sheriffPassword)
      .then(()=>{
        setSheriffLoginLoading(false);setSheriffPassword("");
        setSheriffEntryRole(null);
        handleCreate();
      })
      .catch(e=>{
        setSheriffLoginLoading(false);
        var msg="Błąd logowania.";
        if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential") msg="Nieprawidłowy email lub hasło.";
        else if(e.code==="auth/invalid-email") msg="Nieprawidłowy format adresu email.";
        else if(e.code==="auth/too-many-requests") msg="Zbyt wiele prób. Spróbuj ponownie za chwilę.";
        setSheriffLoginError(msg);
      });
  }

  function handleForgotPassword(){
    if(!sheriffEmail.trim()){setSheriffLoginError("Wpisz najpierw adres email.");return;}
    if(!auth){return;}
    auth.sendPasswordResetEmail(sheriffEmail.trim())
      .then(()=>{setResetSent(true);setSheriffLoginError(null);})
      .catch(e=>{
        var msg="Nie udało się wysłać linku resetującego.";
        if(e.code==="auth/user-not-found") msg="Nie znaleziono konta dla tego adresu email.";
        setSheriffLoginError(msg);
      });
  }

  function handleCreate(){
    if(!db){setError("Brak połączenia z Firebase. Otwórz grę z GitHub Pages.");return;}
    setLoading(true);setError(null);
    // P2-5 – atomowe tworzenie rozgrywki: transaction zamiast once+set (eliminuje TOCTOU)
    function tryCreate(attempt){
      if(attempt>5){setError("Nie udało się wygenerować unikalnego kodu. Spróbuj ponownie.");setLoading(false);return;}
      var code=generateRoomCode();
      db.ref("rooms/"+code+"/meta").transaction(function(current){
        if(current!==null) return; // rozgrywka już istnieje – abort, kolejna próba
        return {created:firebase.database.ServerValue.TIMESTAMP,status:"lobby"};
      },function(err,committed,snapshot){
        if(err){setError("Błąd tworzenia rozgrywki: "+err.message);setLoading(false);return;}
        if(!committed){tryCreate(attempt+1);return;} // kolizja – spróbuj ponownie
        // Sukces – dopisz pierwszego gracza (sheriff) i przełącz UI
        db.ref("rooms/"+code+"/players/sheriff").set({connected:true,joinedAt:firebase.database.ServerValue.TIMESTAMP}).then(function(){
          setRoomCode(code);setSelectedRole("sheriff");setMode("created");setLoading(false);
          db.ref("rooms/"+code+"/players/sheriff").onDisconnect().update({connected:false});
        }).catch(function(e){setError("Błąd dopisywania gracza: "+e.message);setLoading(false);});
      });
    }
    tryCreate(1);
  }

  function handleJoin(){
    if(!joinCode.trim()){setError("Wpisz kod rozgrywki");return;}
    var code=joinCode.trim().toUpperCase();
    if(!/^WDZ-[A-HJ-NP-Z2-9]{6}$/.test(code)){setError("Nieprawidłowy format kodu (WDZ-XXXXXX)");return;}
    if(!db){setError("Brak połączenia z Firebase.");return;}
    setLoading(true);setError(null);
    db.ref("rooms/"+code+"/meta").once("value").then(snap=>{
      if(!snap.exists()){setError("Rozgrywka "+code+" nie istnieje");setLoading(false);return;}
      if(snap.val().status==="archived"){setError("Ta rozgrywka została zarchiwizowana i nie jest już dostępna.");setLoading(false);return;}
      setRoomCode(code);setMode("joining");setLoading(false);
    }).catch(e=>{setError("Błąd połączenia: "+e.message);setLoading(false);});
  }

  function selectFamily(fId){setSelectedRole(fId);}

  function submitName(){
    var name=playerName.trim();
    if(!name){setError("Wpisz swoje imię lub pseudonim");return;}
    // P3-6 – normalizacja nazwy: jedno źródło prawdy dla wszystkich useEffectów presence/auto-join
    setPlayerName(name);
    setError(null);setNameSubmitted(true);
    db.ref("rooms/"+roomCode+"/meta/status").once("value").then(snap=>{
      var st=snap.val();
      if(st==="archived"){setError("Ta rozgrywka została zarchiwizowana i nie jest już dostępna.");setNameSubmitted(false);return;}
      if(st==="playing"){
        db.ref("rooms/"+roomCode+"/players/"+selectedRole+"/members/"+playerId)
          .set({name,lastSeen:firebase.database.ServerValue.TIMESTAMP})
          .then(()=>onJoin(roomCode,selectedRole,playerId,name));
      }
    });
  }

  function getFamilyMembers(fId){
    var fd=players[fId];if(!fd||!fd.members) return [];
    return Object.entries(fd.members).map(([id,m])=>({id,...m}));
  }
  function isOnline(m){return m.lastSeen&&(Date.now()-m.lastSeen)<90000;}

  var boxStyle={background:"#FDFAF4",border:"1px solid #D4C4A8",borderRadius:8,padding:20,marginBottom:16};
  var titleStyle={fontSize:20,fontWeight:700,color:"#2C1810",marginBottom:12,fontFamily:"'Alegreya Sans',sans-serif"};
  var errStyle={background:"#FEE",border:"1px solid #C88",borderRadius:4,padding:"8px 12px",marginTop:10,fontSize:13,color:"#8B2500"};

  return(<div style={{minHeight:"100vh",background:"linear-gradient(135deg,#4C130F 0%,#300904 50%,#4C130F 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <ConnectionIndicator online={online}/>
    <div style={{maxWidth:560,width:"100%"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:16}}>
        <img src="img/alegra_logotyp.png" alt="aleGRA" style={{height:120,width:"auto"}}/>
        <div style={{marginTop:22,textAlign:"center"}}>
          <div style={{fontSize:32,fontWeight:900,color:"#D4A853",letterSpacing:1,fontFamily:"'Alegreya Sans',sans-serif",lineHeight:1.1}} className="wt">Wschód Dzikiego Zachodu<sup style={{fontSize:16,fontWeight:400}}>©</sup> Online</div>
          <div style={{fontSize:14,color:"#C4B090",marginTop:2}}>Platforma Sieciowa</div>
        </div>
        <div style={{fontSize:13,color:"#8B7355",marginTop:10}}>v3.0.2</div>
      </div>

      {/* === INITIAL CHOICE === */}
      {!mode&&!sheriffEntryRole&&<div style={boxStyle}>
        <div style={titleStyle}>Utwórz rozgrywkę lub dołącz do gry</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={()=>{setSheriffEntryRole("sheriff");setSheriffEntryCode("");setError(null);}} disabled={loading} style={{...btnS("sheriff"),padding:"14px 20px",fontSize:16,width:"100%",textAlign:"center"}}>
            Wejdź jako Szeryf
          </button>
          <button onClick={()=>{setSheriffEntryRole("sheriff2");setSheriffEntryCode("");setError(null);}} style={{...btnS("default"),padding:"10px 20px",fontSize:14,width:"100%",textAlign:"center"}}>
            Dołącz jako Szeryf 2
          </button>
          {!showCodeInput&&<div style={{textAlign:"center",marginTop:2}}>
            <span onClick={()=>setShowCodeInput(true)} style={{fontSize:12,color:"#8B7355",cursor:"pointer",textDecoration:"underline"}}>Masz kod rozgrywki? Wpisz ręcznie</span>
          </div>}
          {showCodeInput&&<div style={{display:"flex",gap:8,marginTop:2}}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Kod rozgrywki (WDZ-XXXXXX)" style={{flex:1,padding:"12px 14px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:15,fontFamily:"monospace",letterSpacing:2,textTransform:"uppercase",background:"#fff"}} onKeyDown={e=>{if(e.key==="Enter")handleJoin();}}/>
            <button onClick={handleJoin} disabled={loading} style={{...btnS("primary"),padding:"12px 18px",fontSize:14}}>Dołącz</button>
          </div>}
          <div style={{textAlign:"center",marginTop:4}}>
            <span onClick={()=>{setSheriffEntryRole("owner");setSheriffLoginError(null);setResetSent(false);setError(null);}} style={{fontSize:11,color:"#8B7355",cursor:"pointer",textDecoration:"underline"}}>Rozgrywka aleGRA (bez biletu)</span>
          </div>
        </div>
        {error&&<div style={errStyle}>{error}</div>}
      </div>}

      {/* === SHERIFF / SHERIFF2 ENTRY – one code, auto create/rejoin === */}
      {sheriffEntryRole&&sheriffEntryRole!=="owner"&&<div style={boxStyle}>
        <div style={titleStyle}>{sheriffEntryRole==="sheriff2"?"Dołącz jako Szeryf 2":"Wejdź jako Szeryf"}</div>
        <div style={{fontSize:13,color:"#5C4A3A",marginBottom:14}}>Wpisz kod Szeryfa otrzymany od organizatora:</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input
            value={sheriffEntryCode}
            onChange={e=>setSheriffEntryCode(e.target.value.toUpperCase())}
            placeholder="WDZ-XXXXXX"
            style={{flex:1,padding:"12px 14px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:16,
              fontFamily:"monospace",letterSpacing:3,textTransform:"uppercase",background:"#fff"}}
            onKeyDown={e=>{if(e.key==="Enter")handleSheriffEntry(sheriffEntryRole);}}
            autoFocus
          />
          <button onClick={()=>handleSheriffEntry(sheriffEntryRole)} disabled={loading}
            style={{...btnS("sheriff"),padding:"12px 18px",fontSize:14}}>
            {loading?"…":"Wejdź"}
          </button>
        </div>
        {error&&<div style={errStyle}>{error}</div>}
        <button onClick={()=>{setSheriffEntryRole(null);setError(null);}}
          style={{...btnS("default"),fontSize:13,padding:"6px 14px",marginTop:4}}>← Wróć</button>
      </div>}

      {/* === OWNER LOGIN – ticket-free game === */}
      {sheriffEntryRole==="owner"&&<div style={boxStyle}>
        <div style={titleStyle}>Rozgrywka aleGRA (bez biletu)</div>
        <div style={{fontSize:13,color:"#5C4A3A",marginBottom:14}}>Zaloguj się kontem właściciela:</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="email" value={sheriffEmail} onChange={e=>{setSheriffEmail(e.target.value);setResetSent(false);}}
            placeholder="Adres email" style={{padding:"12px 14px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:14,background:"#fff"}}
            onKeyDown={e=>{if(e.key==="Enter")handleOwnerSignIn();}} autoFocus/>
          <input type="password" value={sheriffPassword} onChange={e=>setSheriffPassword(e.target.value)}
            placeholder="Hasło" style={{padding:"12px 14px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:14,background:"#fff"}}
            onKeyDown={e=>{if(e.key==="Enter")handleOwnerSignIn();}}/>
          <button onClick={handleOwnerSignIn} disabled={sheriffLoginLoading} style={{...btnS("sheriff"),padding:"12px 18px",fontSize:15}}>
            {sheriffLoginLoading?"Logowanie…":"Zaloguj się i utwórz rozgrywkę"}
          </button>
          {resetSent
            ?<div style={{fontSize:13,color:"#2A7A2A",textAlign:"center",marginTop:4}}>Link resetujący został wysłany.</div>
            :<span onClick={handleForgotPassword} style={{fontSize:12,color:"#8B7355",cursor:"pointer",textDecoration:"underline",textAlign:"center",marginTop:4}}>Zapomniałem hasła</span>
          }
        </div>
        {sheriffLoginError&&<div style={errStyle}>{sheriffLoginError}</div>}
        <button onClick={()=>{setSheriffEntryRole(null);setSheriffLoginError(null);setResetSent(false);}} style={{...btnS("default"),fontSize:13,padding:"6px 14px",marginTop:12}}>← Wróć</button>
      </div>}

      {/* === SHERIFF: ROOM CREATED – LINKS + LOBBY === */}
      {mode==="created"&&<div style={boxStyle}>
        <div style={titleStyle}>Rozgrywka utworzona</div>
        <div style={{background:"#4C130F",borderRadius:6,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:"#D4A853",fontWeight:700,letterSpacing:2,marginBottom:2}}>KOD ROZGRYWKI</div>
            <div style={{fontSize:26,fontWeight:900,color:"#F5F0E8",letterSpacing:4,fontFamily:"monospace"}}>{roomCode}</div>
          </div>
          <div style={{fontSize:12,color:"#C4B090",maxWidth:160,textAlign:"right"}}>Linki dla rodzin znajdziesz w panelu Szeryfa</div>
        </div>
        <button onClick={()=>onJoin(roomCode,selectedRole,null,null)} style={{...btnS("sheriff"),width:"100%",padding:"14px 20px",fontSize:16,textAlign:"center",marginBottom:10}}>
          Wejdź do panelu Szeryfa →
        </button>
        {error&&<div style={errStyle}>{error}</div>}
      </div>}

      {/* === PLAYER: SELECT FAMILY (manual code join) === */}
      {mode==="joining"&&!selectedRole&&<div style={boxStyle}>
        <div style={titleStyle}>Rozgrywka: {roomCode}</div>
        <div style={{fontSize:13,color:"#5C4A3A",marginBottom:14}}>Wybierz swoją rodzinę:</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {FO.map(fId=>{
            var mc=getFamilyMembers(fId).length;
            return(<button key={fId} onClick={()=>selectFamily(fId)} disabled={loading} style={{padding:"12px 16px",border:"2px solid "+FM[fId].col,borderRadius:6,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"inherit",fontSize:14}}>
              <div style={{width:14,height:14,borderRadius:"50%",background:FM[fId].col}}/>
              <span style={{fontWeight:700,color:FM[fId].col}}>{FM[fId].nom}</span>
              <span style={{fontSize:13,color:"#A89070"}}>– {FM[fId].biz}</span>
              {mc>0&&<span style={{marginLeft:"auto",fontSize:12,color:"#5B7A5B"}}>+{mc} graczy</span>}
            </button>);
          })}
        </div>
        {error&&<div style={errStyle}>{error}</div>}
      </div>}

      {/* === PLAYER: ENTER NAME === */}
      {(mode==="joining"||mode==="link_join")&&selectedRole&&!nameSubmitted&&<div style={boxStyle}>
        <div style={{background:FM[selectedRole].col,color:"#fff",borderRadius:6,padding:14,textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:22,fontWeight:700}} className="wt">{FM[selectedRole].nom}</div>
          <div style={{fontSize:13,opacity:0.8,marginTop:2}}>Rozgrywka: {roomCode}</div>
        </div>
        <div style={{fontSize:14,fontWeight:700,color:"#2C1810",marginBottom:8}}>Jak masz na imię?</div>
        <div style={{display:"flex",gap:8}}>
          <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Imię lub pseudonim" autoFocus style={{flex:1,padding:"12px 14px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:15,background:"#fff"}} onKeyDown={e=>{if(e.key==="Enter")submitName();}}/>
          <button onClick={submitName} style={{...btnS("primary"),padding:"12px 18px",fontSize:14}}>Dołącz</button>
        </div>
        {error&&<div style={errStyle}>{error}</div>}
      </div>}

      {/* === PLAYER: WAITING FOR GAME START === */}
      {(mode==="joining"||mode==="link_join")&&selectedRole&&nameSubmitted&&<div style={boxStyle}>
        <div style={{background:FM[selectedRole].col,color:"#fff",borderRadius:6,padding:14,textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:22,fontWeight:700}} className="wt">{FM[selectedRole].nom}</div>
          <div style={{fontSize:13,opacity:0.8,marginTop:2}}>Cześć, {playerName}!</div>
        </div>
        <div style={{fontSize:13,color:"#5C4A3A",marginBottom:8}}>Twoi współgracze z drużyny:</div>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
          {getFamilyMembers(selectedRole).map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:FM[selectedRole].col,fontWeight:m.id===playerId?700:400}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:isOnline(m)?FM[selectedRole].col:"#C4B090"}}/>
              {m.name}{m.id===playerId?" (Ty)":""}
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",padding:14,background:"#FFF8E7",borderRadius:6,border:"1px solid #D4C870"}}>
          <div style={{fontSize:13,color:"#8B7714",fontWeight:600}}>Oczekiwanie na start gry...</div>
          <div style={{fontSize:13,color:"#A89070",marginTop:4}}>Szeryf rozpocznie grę, gdy wszyscy będą gotowi</div>
        </div>
      </div>}

    </div>
  </div>);
}

/* ========== CARD IMAGES (loaded from img/ folder) ========== */

/* ========== AGENDA BAR ========== */
function AgendaBar({familyId,stageIdx}){
  var f=FM[familyId];
  var cur=stageIdx>=0&&stageIdx<AGENDA_ITEMS.length?stageIdx:-1;
  var GREYS={adams:"#E9CDC2",bennet:"#C0B8C0",clinton:"#CECDD4",dexter:"#CED6D5"};
  var GREY=GREYS[familyId]||"#E9CDC2",WHITE="#FFFFFF";
  var WT="'Aka Posse','Alegreya Sans',serif";
  function inPhase(ph){
    if(ph===1) return cur>=1&&cur<=5;
    if(ph===2) return cur>=7&&cur<=11;
    if(ph===3) return cur>=13&&cur<=17;
    return false;
  }
  function iCol(idx){return cur===idx?WHITE:GREY;}
  function iUnd(idx){return cur===idx;}
  function phCol(ph){return inPhase(ph)?WHITE:GREY;}
  function phUnd(ph){return inPhase(ph);}
  function pipeCol(ph){return inPhase(ph)?WHITE:GREY;}
  function arrCol(idx){return cur===idx?WHITE:GREY;}
  var fs=14;
  var sp=function(label,color,underline,key,bold){
    var baseStyle={color:color,fontFamily:WT,fontSize:fs,fontWeight:bold?700:400,whiteSpace:"nowrap"};
    if(underline){
      var trimmed=label.trim();
      var lead=label.slice(0,label.length-label.trimStart().length);
      var trail=label.slice(label.trimEnd().length);
      return <span key={key} style={baseStyle}>
        {lead?<span style={{textDecoration:"none"}}>{lead}</span>:null}
        <span style={{textDecoration:"underline"}}>{trimmed}</span>
        {trail?<span style={{textDecoration:"none"}}>{trail}</span>:null}
      </span>;
    }
    return <span key={key} style={{...baseStyle,textDecoration:"none"}}>{label}</span>;
  };
  var k=0,T=[];
  T.push(sp("Przygotowanie",iCol(0),iUnd(0),k++,false));
  T.push(sp(" | ",pipeCol(1),false,k++,false));
  T.push(sp("FAZA I: INFORMACYJNA",phCol(1),phUnd(1),k++,true));
  T.push(sp(" →",arrCol(1),false,k++,false));
  T.push(sp(" Tura 1",iCol(1),iUnd(1),k++,false));
  T.push(sp(" →",arrCol(2),false,k++,false));
  T.push(sp(" Odprawa",iCol(2),iUnd(2),k++,false));
  T.push(sp(" →",arrCol(3),false,k++,false));
  T.push(sp(" Tura 2",iCol(3),iUnd(3),k++,false));
  T.push(sp(" →",arrCol(4),false,k++,false));
  T.push(sp(" Odprawa",iCol(4),iUnd(4),k++,false));
  T.push(sp(" →",arrCol(5),false,k++,false));
  T.push(sp(" Tura 3",iCol(5),iUnd(5),k++,false));
  T.push(sp(" | ",pipeCol(1),false,k++,false));
  T.push(sp("Narada",iCol(6),iUnd(6),k++,false));
  T.push(sp(" | ",pipeCol(2),false,k++,false));
  T.push(sp("FAZA II: TRANSAKCYJNA",phCol(2),phUnd(2),k++,true));
  T.push(sp(" →",arrCol(7),false,k++,false));
  T.push(sp(" Tura 1",iCol(7),iUnd(7),k++,false));
  T.push(sp(" →",arrCol(8),false,k++,false));
  T.push(sp(" Odprawa",iCol(8),iUnd(8),k++,false));
  T.push(sp(" →",arrCol(9),false,k++,false));
  T.push(sp(" Tura 2",iCol(9),iUnd(9),k++,false));
  T.push(sp(" →",arrCol(10),false,k++,false));
  T.push(sp(" Odprawa",iCol(10),iUnd(10),k++,false));
  T.push(sp(" →",arrCol(11),false,k++,false));
  T.push(sp(" Tura 3",iCol(11),iUnd(11),k++,false));
  T.push(sp(" | ",pipeCol(2),false,k++,false));
  T.push(sp("Narada",iCol(12),iUnd(12),k++,false));
  T.push(sp(" | ",pipeCol(3),false,k++,false));
  T.push(sp("FAZA III: FINAŁOWA",phCol(3),phUnd(3),k++,true));
  T.push(sp(" →",arrCol(13),false,k++,false));
  T.push(sp(" Tura 1",iCol(13),iUnd(13),k++,false));
  T.push(sp(" →",arrCol(14),false,k++,false));
  T.push(sp(" Odprawa",iCol(14),iUnd(14),k++,false));
  T.push(sp(" →",arrCol(15),false,k++,false));
  T.push(sp(" Tura 2",iCol(15),iUnd(15),k++,false));
  T.push(sp(" →",arrCol(16),false,k++,false));
  T.push(sp(" Odprawa",iCol(16),iUnd(16),k++,false));
  T.push(sp(" →",arrCol(17),false,k++,false));
  T.push(sp(" Tura 3",iCol(17),iUnd(17),k++,false));
  T.push(sp(" | ",pipeCol(3),false,k++,false));
  T.push(sp("Omówienie",iCol(18),iUnd(18),k++,false));
  return(<div style={{background:f.col,padding:"2px 8px",overflow:"hidden"}}>
    <div style={{whiteSpace:"nowrap",overflow:"hidden",lineHeight:"22px",textAlign:"center"}}>{T}</div>
  </div>);
}

/* ========== FAMILY TIMER PANEL ========== */
function FamilyTimerPanel({familyId,stageIdx,secondsLeft,gameStarted,timerPaused}){
  var f=FM[familyId];
  var stage=stageIdx>=0&&stageIdx<STAGES.length?STAGES[stageIdx]:null;
  var partner=stage&&stage.type==="turn"&&stage.pairingIdx!==null?getMeetingPartner(familyId,stage.pairingIdx):null;
  var nextPartner=null;
  for(var i=stageIdx+1;i<STAGES.length;i++){if(STAGES[i].type==="turn"&&STAGES[i].pairingIdx!==null){nextPartner=getMeetingPartner(familyId,STAGES[i].pairingIdx);break;}}
  var mm=Math.floor(secondsLeft/60),ss=secondsLeft%60;
  var timeStr=(timerPaused?"(P) ":"")+mm+":"+(ss<10?"0":"")+ss;
  var stageLabel="";
  if(stage){
    if(stage.type==="turn") stageLabel="FAZA "+(stage.phase===1?"INFORMACYJNA":stage.phase===2?"TRANSAKCYJNA":"FINAŁOWA")+" · TURA "+stage.id.slice(-1);
    else if(stage.type==="kn") stageLabel="KRÓTKA NARADA";
    else if(stage.type==="narada") stageLabel="NARADA RODZINNA";
    else if(stage.type==="prep") stageLabel="PRZYGOTOWANIE";
    else if(stage.type==="end") stageLabel="ZAKOŃCZENIE";
  }
  var WT="'Aka Posse','Alegreya Sans',serif";
  return(<div style={{backgroundImage:"url(img/faza_rozgrywki.png)",backgroundSize:"100% 100%",backgroundRepeat:"no-repeat",aspectRatio:"700/400",width:"100%",padding:"20px 18px",marginBottom:16,textAlign:"center",boxSizing:"border-box"}}>
    {!gameStarted?(<div>
      <div style={{fontSize:48,color:"#fff",fontFamily:WT,letterSpacing:3,lineHeight:1}}>0:00</div>
      <div style={{fontSize:18,color:"rgba(255,255,255,0.8)",fontFamily:WT,marginTop:10,letterSpacing:"0.04em"}}>Oczekiwanie na start gry</div>
    </div>):(<div>
      <div style={{fontSize:48,color:"#fff",fontFamily:WT,letterSpacing:3,lineHeight:1}}>{timeStr}</div>
      <div style={{fontSize:18,color:"#fff",fontFamily:WT,marginTop:10,letterSpacing:"0.04em"}}>{stageLabel}</div>
      {partner&&<div style={{fontSize:18,color:"rgba(255,255,255,0.85)",fontFamily:WT,marginTop:6,letterSpacing:"0.04em"}}>Partner: {FM[partner].nom}</div>}
      {nextPartner&&<div style={{fontSize:15,color:"rgba(255,255,255,0.60)",fontFamily:WT,marginTop:10,letterSpacing:"0.04em"}}>Kolejna rozmowa: {FM[nextPartner].nom}</div>}
    </div>)}
  </div>);
}
/* ========== AUDIO: GUNSHOT SYNTHESIS ========== */
var _audioCtx=null;
function getAudioCtx(){if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();return _audioCtx;}
function playGunshots(count,interval){
  try{var ctx=getAudioCtx();if(ctx.state==="suspended")ctx.resume();
    for(var i=0;i<count;i++){(function(delay){setTimeout(function(){
      var buf=ctx.createBuffer(1,ctx.sampleRate*0.12,ctx.sampleRate);var d=buf.getChannelData(0);
      for(var j=0;j<d.length;j++)d[j]=(Math.random()*2-1)*Math.exp(-j/(ctx.sampleRate*0.015));
      var src=ctx.createBufferSource();src.buffer=buf;
      var gain=ctx.createGain();gain.gain.setValueAtTime(0.7,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.12);
      src.connect(gain);gain.connect(ctx.destination);src.start();
    },delay);})(i*interval);}
  }catch(e){console.warn("Audio:",e);}
}




/* ========== PDF TRAINER REPORT ========== */
async function generateTrainerPDF(data) {
  // jsPDF imported at module level
  var doc = new jsPDF({orientation: "portrait", unit: "mm", format: "a4"});
  var ML = 20, MR = 20, MT = 20, PW = 210 - 40, PAGE_H = 297, FOOTER_Y = 282, Y = MT;
  var COL = {
    primary:[132,37,4], dark:[76,19,15], gold:[212,168,83], text:[44,24,16],
    textDim:[107,90,74], white:[255,255,255], bg:[245,240,232], line:[212,196,168],
    green:[46,91,60], red:[192,64,48],
    families:{adams:[167,95,74],bennet:[114,96,114],clinton:[94,89,113],dexter:[91,118,116]}
  };
  // Font loading
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
  } catch(e){console.warn("[WDZ PDF] Font fallback to Helvetica:",e);}
  var FONT = fontLoaded ? "AlegreyaSans" : "helvetica";
  var ARROW = fontLoaded ? "\u2192" : " > ";
  function setF(style,size){doc.setFont(FONT,style||"normal");doc.setFontSize(size||11);}
  function setC(c){doc.setTextColor(c[0],c[1],c[2]);}
  function chk(n){if(Y+n>FOOTER_Y){doc.addPage();Y=MT;}}
  function hd(text){chk(14);Y+=4;setF("bold",13);setC(COL.primary);doc.text(text,ML,Y);Y+=2;doc.setDrawColor(COL.gold[0],COL.gold[1],COL.gold[2]);doc.setLineWidth(0.5);doc.line(ML,Y,ML+PW,Y);Y+=6;}
  function bt(text,opts){opts=opts||{};setF(opts.style||"normal",opts.size||11);setC(opts.color||COL.text);var ls=doc.splitTextToSize(text,opts.maxW||PW);chk(ls.length*5);doc.text(ls,opts.x||ML,Y);Y+=ls.length*5;}
  var rc=data.roomCode||"?",meta=data.meta||{},fd=data.fd||{},scores=data.scores||{},relScores=data.relScores||{},totals=data.totals||{},txs=data.txs||[],rels=data.relations||{},bf=data.blindFate||{},revDuels=data.revDuels||[];
  var ranked=FO.slice().sort(function(a,b){return(totals[b]||0)-(totals[a]||0);});
  // Logo + Title (one row: logo left, title right, vertically aligned)
  var logoH=12;
  try{var lr=await fetch((data.imgBase||"img/")+"alegra_logotyp_kolorowy.png");if(lr.ok){var lb=await lr.blob();var l64=await new Promise(function(res){var rd=new FileReader();rd.onload=function(){res(rd.result);};rd.readAsDataURL(lb);});doc.addImage(l64,"PNG",ML,Y,30,0);}}catch(e){}
  setF("bold",20);setC(COL.dark);doc.text("Wschód Dzikiego Zachodu",ML+34,Y+logoH*0.65);
  Y+=logoH+4;
  setF("normal",11);setC(COL.textDim);doc.text("Raport z rozgrywki",ML,Y);Y+=10;
  // Session info box
  doc.setDrawColor(COL.line[0],COL.line[1],COL.line[2]);doc.setFillColor(COL.bg[0],COL.bg[1],COL.bg[2]);
  var infoArr=["Kod: "+rc];if(meta.createdAt)infoArr.push("Data: "+new Date(meta.createdAt).toLocaleDateString("pl"));
  var infoArr2=[];if(meta.client)infoArr2.push("Klient: "+meta.client);if(meta.group)infoArr2.push("Grupa: "+meta.group);
  var boxH=infoArr2.length?18:12;doc.roundedRect(ML,Y,PW,boxH,2,2,"FD");
  setF("normal",11);setC(COL.text);doc.text(infoArr.join("     |     "),ML+4,Y+5);
  if(infoArr2.length)doc.text(infoArr2.join("     |     "),ML+4,Y+11);
  Y+=boxH+8;
  // 1. WYNIKI
  hd("Wyniki");
  if(ranked.length>0){setF("bold",12);setC(COL.green);doc.text("Zwycięzca: "+FM[ranked[0]].nom+" – "+Math.round(totals[ranked[0]]||0)+" pkt",ML,Y);Y+=8;}
  var rH=[["","Wynik","Zasoby\n/30","Kompetencje\n/25","Działka\n/10","Gotówka\n/25","Żyła\n/10","BnB","Relacje\n/20"]];
  var rR=ranked.map(function(f){var s=scores[f]||{};return[FM[f].nom,Math.round(totals[f]||0)+" pkt",s.resScore+" ("+(s.resPct||0)+"%)",s.compScore+" ("+(s.compPct||0)+"%)",s.plotScore||0,s.cashScore+" ("+(s.cash||0)+"$)",s.mapScore||0,s.bnb||0,relScores[f]||0];});
  doc.autoTable({startY:Y,head:rH,body:rR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:8},columnStyles:{0:{halign:"left",fontStyle:"bold"},1:{fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===0){var f=ranked[d2.row.index];if(f&&COL.families[f])d2.cell.styles.textColor=COL.families[f];}}});
  Y=doc.lastAutoTable.finalY+8;
  // 2. MACIERZ HANDLU
  hd("Macierz handlu");
  var tradeTx=txs.filter(function(t){return t&&t.status==="accepted"&&FO.includes(t.from)&&FO.includes(t.to)&&(t.type==="sale"||t.type==="barter");});
  if(tradeTx.length>0){
    var mH=[["Od \\ Do"].concat(FO.map(function(f){return FM[f].nom;}))];
    var mR=FO.map(function(from){var cells=FO.map(function(to){if(from===to)return"–";var it=0,ca=0;tradeTx.forEach(function(tx){if(tx.from===from&&tx.to===to){it+=(tx.offeredItems||tx.offerItems||[]).length;ca+=(tx.offeredCash||tx.offerCash||0);}if(tx.to===from&&tx.from===to){it+=(tx.requestItems||tx.responseItems||[]).length;ca+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0);}});if(it===0&&ca===0)return"–";return(it>0?it+"k":"")+(it>0&&ca>0?" + ":"")+(ca>0?ca+"$":"");});return[FM[from].nom].concat(cells);});
    doc.autoTable({startY:Y,head:mH,body:mR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:9},columnStyles:{0:{halign:"left",fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+4;bt("Legenda: k = liczba kart, $ = gotówka przekazana w transakcji",{size:8,color:COL.textDim});
  } else { bt("Brak zaakceptowanych transakcji."); }
  Y+=4;
  // 3. STATYSTYKI TX PER PARA
  hd("Statystyki transakcji");
  var ps={};txs.forEach(function(t){if(!t||!t.from||!t.to||!FO.includes(t.from)||!FO.includes(t.to))return;if(t.type!=="sale"&&t.type!=="barter")return;var k=[t.from,t.to].sort().join("-");if(!ps[k])ps[k]={a:0,r:0};if(t.status==="accepted")ps[k].a++;else if(t.status==="rejected")ps[k].r++;});
  var pk=Object.keys(ps);
  if(pk.length>0){
    var pH=[["Para","Zaakceptowane","Odrzucone","Łącznie"]];
    var pR=pk.map(function(k){var p=k.split("-"),d=ps[k];return[FM[p[0]].nom+" – "+FM[p[1]].nom,d.a,d.r,d.a+d.r];});
    var ta=pk.reduce(function(s,k){return s+ps[k].a;},0),tr=pk.reduce(function(s,k){return s+ps[k].r;},0);
    pR.push(["RAZEM",ta,tr,ta+tr]);
    doc.autoTable({startY:Y,head:pH,body:pR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.row.index===pR.length-1)d2.cell.styles.fontStyle="bold";}});
    Y=doc.lastAutoTable.finalY+8;
  } else { bt("Brak transakcji."); Y+=4; }
  // 4. RELACJE
  hd("Relacje");
  var anyRel=false;FO.forEach(function(rater){if(rels[rater])FO.forEach(function(rated){if(rater!==rated&&rels[rater][rated])anyRel=true;});});
  if(anyRel){
    var rlH=[["Od rodziny "+ARROW+"Dla rodziny","Partnerstwo","Zasady","Komunikacja","Suma /15"]];var rlR=[];
    FO.forEach(function(rater){FO.forEach(function(rated){if(rater===rated)return;var r=rels[rater]&&rels[rater][rated];if(!r)return;var tot=(r.partnership||0)+(r.rules||0)+(r.communication||0);rlR.push([FM[rater].nom+" "+ARROW+" "+FM[rated].nom,r.partnership||0,r.rules||0,r.communication||0,tot]);});});
    doc.autoTable({startY:Y,head:rlH,body:rlR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  } else { bt("Brak danych o relacjach."); Y+=4; }
  // 5. ŚLEPY LOS
  hd("Ślepy Los");
  var anyFate=false;
  FO.forEach(function(fId){var bfd=bf[fId];if(!bfd||!bfd.rolls)return;var rolls=(Array.isArray(bfd.rolls)?bfd.rolls:Object.values(bfd.rolls)).filter(function(r){return r&&r.resolved;});if(!rolls.length)return;anyFate=true;chk(12+rolls.length*6);setF("bold",10);setC(COL.families[fId]||COL.text);doc.text(FM[fId].nom+":",ML,Y);Y+=5;rolls.forEach(function(r){var ev=r.event||{};var eff=r.netEffectText||(ev.amount?(ev.amount>0?"+":"")+ev.amount+" $":"brak efektu");setF("normal",10);setC(COL.text);var ln="    Wynik "+(r.sum||"?")+" – "+(ev.text||"–")+" "+ARROW+" "+eff;var wr=doc.splitTextToSize(ln,PW-8);doc.text(wr,ML+4,Y);Y+=wr.length*4.5;});Y+=3;});
  if(!anyFate){bt("Brak rzutów.");Y+=4;}
  // 6. BnB
  if(data.bnbEnabled&&fd){
    hd("Biznes na Boku");
    var bH=[["Rodzina","Produkt","Sprzedano","Kupiono od innych"]];
    var bR=FO.map(function(fId){var items=(fd[fId]||{}).items||[];if(!Array.isArray(items))items=Object.values(items);var bnbAll=items.filter(function(i){return i.cat===C_BNB;});var prod=BNB_PRODUCTS[fId];var ownLeft=bnbAll.filter(function(i){return i.bnbOrigin===fId||i.name===prod.name;}).length;var sold=prod.qty-ownLeft;var bought=bnbAll.filter(function(i){return i.bnbOrigin!==fId&&i.name!==prod.name;}).length;return[FM[fId].nom,prod.shortName,sold+"/"+prod.qty,bought];});
    doc.autoTable({startY:Y,head:bH,body:bR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"},1:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  }
  // 7. Złotodajna Żyła
  if(data.mapEnabled&&fd){
    hd("Złotodajna Żyła");
    var mbc=data.mapBonusClaimed||{};var mw=null;FO.forEach(function(f){if(mbc[f])mw=f;});
    var zpH=[["Rodzina","Fragmenty mapy","Bonus pkt","Rozliczenie"]];
    var zpR=FO.map(function(fId){var items=(fd[fId]||{}).items||[];if(!Array.isArray(items))items=Object.values(items);var fs2={};items.forEach(function(i){if(i.cat===C_MAP)fs2[i.fragNr]=true;});var cnt=Object.keys(fs2).length;var sc=scores[fId]||{};var sett=mw===fId?"+300 $":(mw?"-100 $":"0 $");return[FM[fId].nom,cnt+"/4",sc.mapScore+"/10",sett];});
    doc.autoTable({startY:Y,head:zpH,body:zpR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===3){var v=d2.cell.raw;if(v&&v.includes("+"))d2.cell.styles.textColor=COL.green;else if(v&&v.includes("-"))d2.cell.styles.textColor=COL.red;}}});
    Y=doc.lastAutoTable.finalY+4;
    if(mw)bt("Zwycięzca wyścigu: "+FM[mw].nom+" (premia 300 $, pozostali wpłacają 100 $)",{style:"bold",size:10});
    else bt("Brak zwycięzcy wyścigu \u2013 nikt nie ułożył Złotodajnej Żyły lub remis.",{size:10,color:COL.textDim});
    Y+=4;
  }
  // 8. Rewolwerowiec
  if(data.revEnabled&&revDuels.length>0){
    hd("Rewolwerowiec");
    var rvH=[["Nr","Wyzywający","Przeciwnik","Stawka","Zwycięzca"]];
    var rvR=revDuels.filter(function(d){return d;}).map(function(d,i){return[i+1,(FM[d.challenger]||{}).nom||"?",(FM[d.opponent]||{}).nom||"?",(d.bet||0)+" $",(FM[d.winner]||{}).nom||"?"];});
    doc.autoTable({startY:Y,head:rvH,body:rvR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  }
  // Footer on all pages
  var tp=doc.internal.getNumberOfPages();
  for(var p=1;p<=tp;p++){doc.setPage(p);setF("normal",8);setC(COL.textDim);doc.text("Strona "+p+" / "+tp,210-MR,FOOTER_Y+5,{align:"right"});doc.text("aleGRA Twórczy Rozwój – Wschód Dzikiego Zachodu© Online",105,FOOTER_Y+5,{align:"center"});}
  // Save
  var ds=meta.createdAt?new Date(meta.createdAt).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  doc.save("wdz-raport-"+rc+"-"+ds+".pdf");
}

/* ========== STAR RATING ========== */

/* ========== PHASE INDEX HELPER ========== */
function getPhaseIndex(si){
  if(si<0||si>=STAGES.length)return -1;
  var s=STAGES[si];
  if(s.phase&&s.pairingIdx!==null)return(s.phase-1)*3+s.pairingIdx;
  for(var i=si;i>=0;i--){var ss=STAGES[i];if(ss.phase&&ss.pairingIdx!==null)return(ss.phase-1)*3+ss.pairingIdx;}
  return -1;
}

/* ========== MAIN APP ========== */
function App({roomCode,role,playerId,playerName}) {
  const isSheriff=role==="sheriff";
  const isSheriff2=role==="sheriff2";
  const isSheriffAny=isSheriff||isSheriff2;
  const myFamily=isSheriffAny?null:role;
  const online=useConnectionStatus();
  const serverTimeOffset=useServerTimeOffset();
  // Heartbeat for family players
  usePlayerHeartbeat(roomCode,myFamily,playerId);
  // T5 – unikalny ID sesji (dla blokady formularza TX)
  const sessionId=useRef(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  const [cf,setCf]=useState(isSheriffAny?"adams":(myFamily||"adams"));
  const [viewSheriff,setViewSheriff]=useState(isSheriffAny);
  const [sheriffViewFamily,setSheriffViewFamily]=useState(null);
  const [fd,setFd]=useState(()=>{
    // Only sheriff initializes game data; players receive from Firebase
    if(!isSheriffAny) return {adams:{cash:0,items:[]},bennet:{cash:0,items:[]},clinton:{cash:0,items:[]},dexter:{cash:0,items:[]}};
    var d={};FO.forEach(f=>{d[f]={cash:600,items:START[f].cards.slice()};});return d;
  });
  const [txs,setTxs]=useState([]);
  const [toast,setToast]=useState(null);
  const [consultations,setConsultations]=useState({});
  const [consultNotes,setConsultNotes]=useState({adams:"",bennet:"",clinton:"",dexter:""});
  const [blindFate,setBlindFate]=useState({});
  const [showResults,setShowResults]=useState(false);
  const [showP,setShowP]=useState(false);
  const [pMode,setPMode]=useState(null);
  const [pStep,setPStep]=useState(1);
  const [tFam,setTFam]=useState(null);
  const [selItems,setSelItems]=useState([]);
  const [price,setPrice]=useState(0);
  const [eCash,setECash]=useState(0);
  const [rTx,setRTx]=useState(null);
  const [activeTab,setActiveTab]=useState("tutorial");
  const [playerDebriefTab,setPlayerDebriefTab]=useState("zadania");
  const [sheriffDebriefTab,setSheriffDebriefTab]=useState("zadania");
  const [sheriffTab,setSheriffTab]=useState("game");
  const [sheriffGameSubTab,setSheriffGameSubTab]=useState("planning");
  const [sending,setSending]=useState(false);
  const [mapBonusClaimed,setMapBonusClaimed]=useState({});
  const [mapEnabled,setMapEnabled]=useState(false);
  const [mapLayout,setMapLayout]=useState({adams:[0,0,0,0],bennet:[0,0,0,0],clinton:[0,0,0,0],dexter:[0,0,0,0]});
  const [plotPenalties,setPlotPenalties]=useState({});
  const [relations,setRelations]=useState({});
  const [relationsUnlocked,setRelationsUnlocked]=useState(false);
  const [biznesNaBoku,setBiznesNaBoku]=useState({adams:0,bennet:0,clinton:0,dexter:0});
  const [bnbEnabled,setBnbEnabled]=useState(false);
  const [bnbSettled,setBnbSettled]=useState(false);
  const [fateEnabled,setFateEnabled]=useState(false);
  const [devMode,setDevMode]=useState(false);
  const [tutorialDone,setTutorialDone]=useState({});

  // === PANEL OMÓWIENIA STATE ===
  const [debriefUnlocked,setDebriefUnlocked]=useState(false);
  const [debriefFullAccess,setDebriefFullAccess]=useState(false);
  const [debriefNotes,setDebriefNotes]=useState({zadania:"",ewaluacja:"",wyniki:"",magazyn:"",profil:"",rytm:"",handel:"",relacje:"",rodziny:{adams:"",bennet:"",clinton:"",dexter:""}});
  const [debriefCorrectMode,setDebriefCorrectMode]=useState(false);

  // === REWOLWEROWIEC STATE ===
  const [revEnabled,setRevEnabled]=useState(false);
  const [revMaxBet,setRevMaxBet]=useState(60);
  const [revDuels,setRevDuels]=useState([]);
  const [revMode,setRevMode]=useState("arena"); // 'arena' | 'tournament'
  const [revActive,setRevActive]=useState([]); // array of active duels (max 1 arena, max 2 tournament)
  const REV_DECL_TIME=30, REV_REVEAL_TIME=10;
  // Compatibility layer – arena mode uses revActive[0] as revCurrent
  const revCurrent=revActive.length>0?revActive[0]:null;
  function setRevCurrent(valOrFn){
    setRevActive(prev=>{
      if(typeof valOrFn==="function"){
        var old=prev.length>0?prev[0]:null;
        var nv=valOrFn(old);
        if(nv===null)return prev.filter((_,i)=>i!==0);
        return prev.length>0?[nv,...prev.slice(1)]:[nv];
      } else {
        if(valOrFn===null)return prev.filter((_,i)=>i!==0);
        return prev.length>0?[valOrFn,...prev.slice(1)]:[valOrFn];
      }
    });
  }
  // Per-duel timers - wyliczane z timerStartedAt zapisanego w Firebase
  const revTimerRef=useRef(null);
  const [revTimerTick,setRevTimerTick]=useState(0); // force re-render every second
  function getRevTimer(duelId){
    var duel=revActive.find(d=>d.id===duelId);
    if(!duel||!duel.timerStartedAt||!duel.timerDuration) return -1;
    var now=Date.now()+serverTimeOffset;
    var elapsed=(now-duel.timerStartedAt)/1000;
    var remaining=Math.max(0,Math.round(duel.timerDuration-elapsed));
    return remaining;
  }
  // backward compat: revTimer = timer for first active duel
  const revTimer=revCurrent?getRevTimer(revCurrent.id):-1;
  // revCurrent shape: {id, familyA, familyB, bet:0, bulletPos:0, ammoA:50, ammoB:50, rounds:[], shotsA:null, shotsB:null, status:'betting'|'playing'|'reveal'|'finished', winner:null, winField:null, timerPhase:null|'declaration'|'reveal', timerStartedAt:0, timerDuration:0}
  function revNewDuel(fA,fB){setRevCurrent({id:ci(),familyA:fA,familyB:fB,bet:0,bulletPos:0,ammoA:50,ammoB:50,rounds:[],shotsA:null,shotsB:null,status:"betting",winner:null,winField:null,timerPhase:null,timerStartedAt:0,timerDuration:0});}
  function revSetBet(amt){
    var now=Date.now()+serverTimeOffset;
    setRevCurrent(c=>{if(!c)return c;return{...c,bet:amt,status:"playing",timerPhase:"declaration",timerStartedAt:now,timerDuration:REV_DECL_TIME};});
  }
  function revSubmitShots(fId,n){
    // Find the duel this family is part of and update shots
    setRevActive(prev=>prev.map(d=>{
      if(fId===d.familyA)return{...d,shotsA:n};
      if(fId===d.familyB)return{...d,shotsB:n};
      return d;
    }));
  }
  // Helper: update a specific duel in revActive by id
  function revUpdateDuel(duelId,fn){
    setRevActive(prev=>prev.map(d=>d.id===duelId?fn(d):d));
  }
  // Auto-reveal and start break timer when both shots are in (per duel)
  useEffect(()=>{
    var now=Date.now()+serverTimeOffset;
    revActive.forEach(d=>{
      if(d.status==="playing"&&d.shotsA!==null&&d.shotsB!==null&&d.timerPhase==="declaration"){
        // Both players submitted – immediately reveal and start break
        revRevealDuel(d.id);
      }
    });
  },[revActive.map(d=>d.id+"|"+d.shotsA+"|"+d.shotsB).join(","),serverTimeOffset]);  // Unified timer tick – forces re-render every second to update displayed timers
  useEffect(()=>{
    if(revTimerRef.current) clearInterval(revTimerRef.current);
    var anyRunning=revActive.some(d=>d.timerPhase&&d.timerStartedAt>0);
    if(!anyRunning) return;
    revTimerRef.current=setInterval(()=>{
      setRevTimerTick(t=>t+1); // force re-render
    },1000);
    return ()=>{if(revTimerRef.current)clearInterval(revTimerRef.current);};
  },[revActive.map(d=>d.id+"|"+d.timerPhase+"|"+d.timerStartedAt).join(",")]);
  // Timer expiry actions – per duel
  useEffect(()=>{
    var now=Date.now()+serverTimeOffset;
    revActive.forEach(d=>{
      var t=getRevTimer(d.id);
      if(t!==0)return;
      if(d.timerPhase==="declaration"){
        // Time's up – auto-fill 0 for missing shots, then reveal and start break
        var finalShotsA=d.shotsA===null?0:d.shotsA;
        var finalShotsB=d.shotsB===null?0:d.shotsB;
        revUpdateDuel(d.id,c=>({...c,shotsA:finalShotsA,shotsB:finalShotsB}));
        // revRevealDuel will be triggered by the useEffect watching shots
      } else if(d.timerPhase==="break"){
        // Break is over – start new declaration round
        revUpdateDuel(d.id,c=>({...c,timerPhase:"declaration",timerStartedAt:now,timerDuration:REV_DECL_TIME}));
      }
    });
  },[revTimerTick,revActive.map(d=>d.id+"|"+d.timerPhase+"|"+d.timerStartedAt).join(","),serverTimeOffset]);
  function revRevealDuel(duelId){
    var now=Date.now()+serverTimeOffset;
    revUpdateDuel(duelId,c=>{
      if(!c||c.shotsA===null||c.shotsB===null)return c;
      var sA=c.shotsA,sB=c.shotsB,newPos=c.bulletPos,aA=c.ammoA-sA,aB=c.ammoB-sB;
      if(sA>sB)newPos=Math.max(-3,c.bulletPos-1);else if(sB>sA)newPos=Math.min(3,c.bulletPos+1);
      var round={shotsA:sA,shotsB:sB,winner:sA>sB?"A":sB>sA?"B":"draw",bulletAfter:newPos};
      var rounds=[...(c.rounds||[]),round];var status="playing",winner=null,winField=null;
      var fields=["wygrana","dominacja","przewaga","pojedynek","przewaga","dominacja","wygrana"];
      winField=fields[newPos+3];
      if(Math.abs(newPos)===3){status="finished";winner=newPos<0?c.familyA:c.familyB;}
      else if(aA<=0&&aB<=0){status="finished";winner=newPos<0?c.familyA:newPos>0?c.familyB:null;}
      // After reveal: start break timer (10s) with result visible, shots reset to null
      var nextPhase=status==="finished"?null:"break";
      var nextTimerStart=status==="finished"?0:now;
      var nextTimerDur=status==="finished"?0:REV_REVEAL_TIME;
      return{...c,bulletPos:newPos,ammoA:aA,ammoB:aB,rounds:rounds,shotsA:null,shotsB:null,status:status,winner:winner,winField:winField,timerPhase:nextPhase,timerStartedAt:nextTimerStart,timerDuration:nextTimerDur};
    });
  }
  // backward compat wrapper
  function revReveal(){if(revCurrent)revRevealDuel(revCurrent.id);}
  // Restart declaration timer when new round begins (per duel)
  useEffect(()=>{
    var now=Date.now()+serverTimeOffset;
    revActive.forEach(d=>{
      if(d.status==="playing"&&d.timerPhase===null&&d.shotsA===null&&d.shotsB===null&&(d.rounds||[]).length>0){
        revUpdateDuel(d.id,c=>({...c,timerPhase:"declaration",timerStartedAt:now,timerDuration:REV_DECL_TIME}));
      }
    });
  },[revActive.map(d=>d.id+"|"+(d.rounds||[]).length+"|"+d.timerPhase).join(","),serverTimeOffset]);
  
  function revSettleDuel(duelId){
    var c=revActive.find(d=>d.id===duelId);
    if(!c||c.status!=="finished")return;
    var payFrac=c.winField==="wygrana"?1:c.winField==="dominacja"?2/3:c.winField==="przewaga"?1/3:0;
    var winAmt=Math.round(c.bet*payFrac);
    if(c.winner&&winAmt>0){var loser=c.winner===c.familyA?c.familyB:c.familyA;
      setFd(fd2=>{var n={...fd2};var actualWin=Math.min(winAmt,n[loser].cash);n[c.winner]={...n[c.winner],cash:n[c.winner].cash+actualWin};n[loser]={...n[loser],cash:n[loser].cash-actualWin};return n;});
      setTxs(p=>[...p,{id:ci(),type:"revolver",from:loser,to:c.winner,amount:winAmt,field:c.winField,status:"accepted",ts:Date.now()}]);
    }
    setRevDuels(d=>[...d,{...c,settled:true}]);
    setRevActive(prev=>prev.filter(d=>d.id!==duelId));
  }
  // backward compat wrapper
  function revSettle(){if(revCurrent)revSettleDuel(revCurrent.id);}

  // Tournament: start 2 duels simultaneously
  function revStartTournament(pair1,pair2,bet){
    var now=Date.now()+serverTimeOffset;
    var d1={id:ci(),familyA:pair1[0],familyB:pair1[1],bet:bet,bulletPos:0,ammoA:50,ammoB:50,rounds:[],shotsA:null,shotsB:null,status:"playing",winner:null,winField:null,timerPhase:"declaration",timerStartedAt:now,timerDuration:REV_DECL_TIME};
    var d2={id:ci(),familyA:pair2[0],familyB:pair2[1],bet:bet,bulletPos:0,ammoA:50,ammoB:50,rounds:[],shotsA:null,shotsB:null,status:"playing",winner:null,winField:null,timerPhase:"declaration",timerStartedAt:now,timerDuration:REV_DECL_TIME};
    setRevActive([d1,d2]);
  }

  // === SCHEDULE STATE ===
  const [gameStarted,setGameStarted]=useState(false);
  const [manualMode,setManualMode]=useState(false);
  const [stageIdx,setStageIdx]=useState(-1);
  const [stageDurations,setStageDurations]=useState(()=>{var d={};STAGES.forEach(s=>{d[s.id]=s.defMin;});return d;});
  const [secondsLeft,setSecondsLeft]=useState(0);
  const [timerRunning,setTimerRunning]=useState(false);
  const [timerPaused,setTimerPaused]=useState(false);
  const [gunshotFired,setGunshotFired]=useState(false);
  const timerRef=useRef(null);
  // S3 – serwer-based timer: przechowywane w Firebase, secondsLeft wyliczane lokalnie
  const [timerStartedAt,setTimerStartedAt]=useState(0);      // ms – kiedy bieżący okres startował
  const [timerDuration,setTimerDuration]=useState(0);        // sekundy – całkowity czas etapu
  const [timerPausedSecondsLeft,setTimerPausedSecondsLeft]=useState(null); // sekundy przy pauzie (null = nie zapauzowany)
  // === SHERIFF QUEUE ===
  const [sheriffCalls,setSheriffCalls]=useState([]);

  /* ========== FIREBASE SYNC ========== */
  const fbIncoming=useRef(false);
  const formOpen=useRef(false);
  const formStateRef=useRef({tFam:null,pStep:1});
  const rollingInProgress=useRef({});
  const activeTxLockRef=useRef(null);
  const diceRolling=useRef(false);
  const diceTimeouts=useRef([]);
  const syncTimer=useRef(null);
  const stateRef=useRef({});

  // Background – wspólne dla wszystkich paneli
  useEffect(()=>{
    document.body.style.backgroundImage="url('img/background_5.png')";
  },[]);

  // REL2 – gdy relacje zostaną zablokowane, przełącz aktywną zakładkę
  useEffect(()=>{
    var fallback=(devMode||tutorialDone[familyId])?"inv":"tutorial";
    if(!relationsUnlocked && activeTab==="rel") setActiveTab(fallback);
  },[relationsUnlocked]);

  // BnB – gdy BnB zostanie wyłączony, przełącz aktywną zakładkę
  useEffect(()=>{
    var fallback=(devMode||tutorialDone[familyId])?"inv":"tutorial";
    if(!bnbEnabled && activeTab==="bnb") setActiveTab(fallback);
  },[bnbEnabled]);

  // Tryb produkcyjny: po ukończeniu tutoriala (ekran 9) jednorazowe auto-przejście na Majątek
  const tutorialRedirectedRef=useRef({});
  useEffect(()=>{
    if(!devMode&&tutorialDone[familyId]&&activeTab==="tutorial"&&!tutorialRedirectedRef.current[familyId]){
      tutorialRedirectedRef.current[familyId]=true;
      setActiveTab("inv");
    }
  },[tutorialDone,familyId]);

  // T1 – synchronizuj formOpen z showP (formularz transakcji otwarty)
  useEffect(()=>{
    formOpen.current=showP;
    if(!showP)formOpen.current=false;
  },[showP]);

  // T2/T3 – synchronizuj formStateRef z tFam i pStep
  useEffect(()=>{formStateRef.current={tFam,pStep};},[tFam,pStep]);

  // S5 – cleanup dice timeoutów przy odmontowaniu komponentu
  useEffect(()=>{return()=>{diceTimeouts.current.forEach(t=>clearTimeout(t));};},[]);

  // Keep stateRef current (Firebase doesn't store null, use false as marker)
  useEffect(()=>{
    stateRef.current={fd,txs:txs.length?txs:[],consultations,consultNotes,blindFate,mapBonusClaimed,mapLayout,mapEnabled,plotPenalties,
      relations,relationsUnlocked,biznesNaBoku,bnbEnabled,bnbSettled,fateEnabled,showResults,
      debriefUnlocked,debriefFullAccess,debriefNotes,debriefCorrectMode,devMode,tutorialDone,
      revEnabled,revMaxBet,revMode,revDuels:revDuels.length?revDuels:[],revActive:revActiveToFB(revActive),revCurrent:revDuelToFB(revCurrent),
      gameStarted,stageIdx,stageDurations,
      timerRunning,timerPaused,timerStartedAt,timerDuration,timerPausedSecondsLeft,
      sheriffCalls:sheriffCalls.length?sheriffCalls:[]};
  });

  // S1 – śledzenie poprzedniego stanu do diff
  const prevSyncRef=useRef({});

  function syncToFB(immediate){
    if(!db||!roomCode||fbIncoming.current)return;
    if(syncTimer.current)clearTimeout(syncTimer.current);
    var doSync=function(){
      var cur=stateRef.current;
      var prev=prevSyncRef.current;
      var publicFields=["fd","txs","blindFate","mapEnabled","mapBonusClaimed","relations","relationsUnlocked",
        "plotPenalties","bnbEnabled","fateEnabled","showResults","debriefUnlocked","debriefFullAccess",
        "revEnabled","revMode","revDuels","revActive","revCurrent","devMode","tutorialDone",
        "gameStarted","stageIdx","stageDurations","timerRunning","timerPaused","timerStartedAt","timerDuration",
        "timerPausedSecondsLeft","sheriffCalls","consultations"];
      var privateFields=["consultNotes","biznesNaBoku",
        "bnbSettled","debriefNotes","debriefCorrectMode","revMaxBet"];
      var pubDiff={}, privDiff={};
      publicFields.forEach(function(k){
        if(JSON.stringify(cur[k])!==JSON.stringify(prev[k]))pubDiff[k]=cur[k]!==undefined?cur[k]:null;
      });
      // mapLayout – sync per-family to prevent cross-family overwrites
      var curML=cur.mapLayout||{};
      var prevML=prev.mapLayout||{};
      FO.forEach(function(f){
        if(JSON.stringify(curML[f])!==JSON.stringify(prevML[f])){
          pubDiff["mapLayout/"+f]=curML[f]||[0,0,0,0];
        }
      });
      privateFields.forEach(function(k){
        if(JSON.stringify(cur[k])!==JSON.stringify(prev[k]))privDiff[k]=cur[k]!==undefined?cur[k]:null;
      });
      var updates=[];
      if(Object.keys(pubDiff).length>0&&isSheriffAny){
        updates.push(db.ref("rooms/"+roomCode+"/gameState").update(pubDiff));
      }
      // Gracz: sync TYLKO txs i tutorialDone (reszta zastrzeżona dla Szeryfa)
      if(!isSheriffAny){
        var playerDiff={};
        if(pubDiff.txs!==undefined) playerDiff.txs=pubDiff.txs;
        if(pubDiff.tutorialDone!==undefined) playerDiff.tutorialDone=pubDiff.tutorialDone;
        if(Object.keys(playerDiff).length>0) updates.push(db.ref("rooms/"+roomCode+"/gameState").update(playerDiff));
      }
      if(Object.keys(privDiff).length>0&&isSheriffAny&&auth&&auth.currentUser){
        updates.push(db.ref("rooms/"+roomCode+"/sheriffPrivate").update(privDiff));
      }
      if(updates.length>0){
        Promise.all(updates).then(function(){
          var newPrev={...prev,...pubDiff,...privDiff};
          var ml=Object.assign({},prev.mapLayout||{});
          FO.forEach(function(f){
            var key="mapLayout/"+f;
            if(pubDiff[key]!==undefined){ml[f]=pubDiff[key];delete newPrev[key];}
          });
          newPrev.mapLayout=ml;
          prevSyncRef.current=newPrev;
        }).catch(function(err){
          console.error("syncToFB error:",err);
          showMsg("Błąd synchronizacji: "+(err.message||"nieznany błąd"));
        });
      }
    };
    if(immediate)doSync();
    else syncTimer.current=setTimeout(doSync,150);
  }

  // Initialize Firebase with game state (sheriff on first render)
  const fbInitDone=useRef(false);
  useEffect(()=>{
    if(!db||fbInitDone.current)return;
    if(isSheriff){
      // Check if room already has game data before syncing defaults
      db.ref("rooms/"+roomCode+"/meta/status").once("value").then(snap=>{
        var status=snap.val();
        fbInitDone.current=true;
        if(status==="playing"||status==="finished"){
          // Room already in progress or finished – don't overwrite, let listener load data
          console.log("[WDZ] Room status: "+status+" – skipping init sync, waiting for Firebase data");
        } else {
          // New room (lobby) – initialize game state in Firebase
          setTimeout(()=>syncToFB(true),200);
        }
      });
    }
    // Players: fbInitDone set to true after first Firebase data received (see listener below)
  },[]);

  // Listen to Firebase gameState
  useEffect(()=>{
    if(!db)return;
    var ref=db.ref("rooms/"+roomCode+"/gameState");
    var cb=ref.on("value",snap=>{
      var s=snap.val();
      if(!s)return;
      fbIncoming.current=true;
      if(s.fd)setFd(fixFdFromFirebase(s.fd));
      // P0-1 – merge listy transakcji po id
      if(s.txs){
        var remoteTxs=Array.isArray(s.txs)?s.txs:Object.values(s.txs);
        setTxs(function(local){
          var localArr=Array.isArray(local)?local:[];
          var localIds={};localArr.forEach(function(t){if(t&&t.id)localIds[t.id]=true;});
          var remoteOnly=remoteTxs.filter(function(t){return t&&t.id&&!localIds[t.id];});
          if(formOpen.current){
            return [...remoteOnly,...localArr];
          } else {
            var remoteIds={};remoteTxs.forEach(function(t){if(t&&t.id)remoteIds[t.id]=true;});
            var localOnly=localArr.filter(function(t){return t&&t.id&&!remoteIds[t.id];});
            return [...localOnly,...remoteTxs];
          }
        });
      } else if(!formOpen.current){
        setTxs([]);
      }
      if(s.blindFate){
        var fixedBF={...s.blindFate};
        FO.forEach(function(fId){
          if(fixedBF[fId]&&fixedBF[fId].rolls){
            var r=fixedBF[fId].rolls;
            if(!Array.isArray(r))fixedBF[fId].rolls=Object.values(r);
          }
        });
        setBlindFate(function(local){
          if(!diceRolling.current) return fixedBF;
          var rollingFids={};
          Object.keys(rollingInProgress.current||{}).forEach(function(k){
            if(rollingInProgress.current[k]){var fId=k.split("-")[0];rollingFids[fId]=true;}
          });
          var merged={...fixedBF};
          Object.keys(rollingFids).forEach(function(fId){
            if(local&&local[fId]) merged[fId]=local[fId];
          });
          return merged;
        });
      }
      if(s.mapEnabled!==undefined)setMapEnabled(s.mapEnabled);
      if(s.mapBonusClaimed)setMapBonusClaimed(s.mapBonusClaimed);else if(s.mapBonusClaimed===null)setMapBonusClaimed({});
      if(s.mapLayout)setMapLayout(function(prev){var n={};FO.forEach(function(f){n[f]=s.mapLayout[f]||prev[f]||[0,0,0,0];});return n;});
      if(s.plotPenalties)setPlotPenalties(s.plotPenalties);
      if(s.relations)setRelations(s.relations);
      if(s.relationsUnlocked!==undefined)setRelationsUnlocked(s.relationsUnlocked);
      if(s.bnbEnabled!==undefined)setBnbEnabled(s.bnbEnabled);
      if(s.fateEnabled!==undefined)setFateEnabled(s.fateEnabled);
      if(s.devMode!==undefined)setDevMode(s.devMode);
      if(s.tutorialDone)setTutorialDone(s.tutorialDone);
      // Gracz: wymuś tutorial jeśli nie ukończony
      if(!isSheriffAny&&!s.devMode&&(!s.tutorialDone||!s.tutorialDone[familyId])){
        setActiveTab("tutorial");
      }
      // Fallback: odczytaj instructionCompleted jeśli tutorialDone nie ma danych dla tej rodziny
      if(!s.tutorialDone||!s.tutorialDone[familyId]){
        db.ref("rooms/"+roomCode+"/instructionCompleted/"+familyId).once("value").then(function(icSnap){
          if(icSnap.val()===true)setTutorialDone(function(prev){return Object.assign({},prev,{[familyId]:true});});
        });
      }
      if(s.showResults!==undefined)setShowResults(s.showResults);
      if(s.debriefUnlocked!==undefined)setDebriefUnlocked(s.debriefUnlocked);
      if(s.debriefFullAccess!==undefined)setDebriefFullAccess(s.debriefFullAccess);
      if(s.revEnabled!==undefined)setRevEnabled(s.revEnabled);
      if(s.revDuels)setRevDuels(Array.isArray(s.revDuels)?s.revDuels:Object.values(s.revDuels));
      if(s.revMode)setRevMode(s.revMode);
      // Read revActive (new format) with backward compat for old revCurrent
      if(s.revActive!==undefined){
        setRevActive(revActiveFromFB(s.revActive));
      } else if(s.revCurrent!==undefined){
        var rc=revDuelFromFB(s.revCurrent);
        setRevActive(rc?[rc]:[]);
      }
      if(s.gameStarted!==undefined)setGameStarted(s.gameStarted);
      if(s.stageIdx!==undefined)setStageIdx(s.stageIdx);
      if(s.stageDurations)setStageDurations(s.stageDurations);
      if(s.timerRunning!==undefined)setTimerRunning(s.timerRunning);
      if(s.timerPaused!==undefined)setTimerPaused(s.timerPaused);
      // S3 – timer oparty na serwerze
      if(s.timerStartedAt!==undefined)setTimerStartedAt(s.timerStartedAt);
      if(s.timerDuration!==undefined)setTimerDuration(s.timerDuration);
      if(s.timerPausedSecondsLeft!==undefined)setTimerPausedSecondsLeft(s.timerPausedSecondsLeft);
      // backward compat: jeśli stare pole secondsLeft i brak nowych – użyj je
      if(s.secondsLeft!==undefined&&s.timerStartedAt===undefined)setSecondsLeft(s.secondsLeft);
      if(s.sheriffCalls){var sc=s.sheriffCalls;setSheriffCalls(Array.isArray(sc)?sc:Object.values(sc));}else setSheriffCalls([]);
      if(s.consultations)setConsultations(s.consultations);
      // Aktualizuj prevSyncRef dla pól odczytywanych z Firebase, żeby sync nie wykrył fałszywej zmiany
      if(s.mapBonusClaimed!==undefined)prevSyncRef.current=Object.assign({},prevSyncRef.current,{mapBonusClaimed:s.mapBonusClaimed||{}});
      if(s.mapLayout)prevSyncRef.current=Object.assign({},prevSyncRef.current,{mapLayout:s.mapLayout});
      if(!fbInitDone.current)fbInitDone.current=true;
      requestAnimationFrame(()=>{fbIncoming.current=false;});
    });
    return()=>ref.off("value",cb);
  },[roomCode]);

  // Listen to sheriffPrivate – only for Sheriff roles
  useEffect(()=>{
    if(!db||(!isSheriff&&!isSheriff2))return;
    var ref=db.ref("rooms/"+roomCode+"/sheriffPrivate");
    var cb=ref.on("value",snap=>{
      var s=snap.val();
      if(!s)return;
      fbIncoming.current=true;
      if(s.consultNotes)setConsultNotes(s.consultNotes);
      if(s.biznesNaBoku)setBiznesNaBoku(s.biznesNaBoku);
      if(s.bnbSettled!==undefined)setBnbSettled(s.bnbSettled);
      if(s.debriefNotes)setDebriefNotes(s.debriefNotes);
      if(s.debriefCorrectMode!==undefined)setDebriefCorrectMode(s.debriefCorrectMode);
      if(s.revMaxBet!==undefined)setRevMaxBet(s.revMaxBet);
      requestAnimationFrame(()=>{fbIncoming.current=false;});
    });
    return()=>ref.off("value",cb);
  },[roomCode,isSheriff,isSheriff2]);

  // Auto-sync: when local state changes, push to Firebase (debounced)
  useEffect(()=>{
    if(fbIncoming.current||!fbInitDone.current)return;
    syncToFB();
  },[fd,txs,consultations,consultNotes,blindFate,mapBonusClaimed,mapLayout,mapEnabled,plotPenalties,relations,relationsUnlocked,
    biznesNaBoku,bnbEnabled,bnbSettled,fateEnabled,devMode,tutorialDone,showResults,debriefUnlocked,debriefFullAccess,debriefNotes,debriefCorrectMode,
    revEnabled,revMaxBet,revMode,revDuels,
    revActive,gameStarted,stageIdx,stageDurations,timerRunning,timerPaused,timerStartedAt,timerDuration,timerPausedSecondsLeft,sheriffCalls]);

  const showMsg=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),3000);},[]);

  // === CARD LOCK (Nr 5) – check if card is in pending transaction ===
  function isCardLocked(cardId){
    return txs.some(t=>(t.status==="pending"||t.status==="awaiting_response")&&
      ((t.offeredItems&&t.offeredItems.some(i=>i.id===cardId))||
       (t.responseItems&&t.responseItems.some(i=>i.id===cardId))));
  }

  // === BROWSER DETECTION (Nr 7) ===
  const [browserWarning,setBrowserWarning]=useState(()=>{
    var ua=navigator.userAgent;
    var isChrome=/Chrome/.test(ua)&&!/Edg|OPR/.test(ua);
    return !isChrome;
  });

  // Prevent accidental tab close or browser back for all logged-in users
  useEffect(()=>{
    if(!roomCode) return;
    function h(e){e.preventDefault();e.returnValue="";}
    window.addEventListener("beforeunload",h);
    // Push a dummy history entry so browser back triggers popstate instead of navigating away
    window.history.pushState(null,"",window.location.href);
    function onBack(e){
      e.preventDefault();
      window.history.pushState(null,"",window.location.href);
      if(!window.confirm("Czy na pewno chcesz opuścić grę? Niezapisane zmiany mogą zostać utracone.")) return;
      window.removeEventListener("popstate",onBack);
      window.history.back();
    }
    window.addEventListener("popstate",onBack);
    return()=>{window.removeEventListener("beforeunload",h);window.removeEventListener("popstate",onBack);};
  },[roomCode]);

  // Register presence in room
  useEffect(()=>{
    if(!db) return;
    var roleKey=isSheriff?"sheriff":isSheriff2?"sheriff2":myFamily;
    var ref=db.ref("rooms/"+roomCode+"/players/"+roleKey);
    ref.update({connected:true,joinedAt:firebase.database.ServerValue.TIMESTAMP});
    ref.onDisconnect().update({connected:false});
    return()=>{ref.onDisconnect().cancel();};
  },[roomCode,role]);

  // Lobby players listener (for sheriff planning tab)
  const [lobbyPlayers,setLobbyPlayers]=useState({});
  useEffect(()=>{
    if(!isSheriffAny||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/players");
    var cb=ref.on("value",snap=>{setLobbyPlayers(snap.val()||{});});
    return()=>ref.off("value",cb);
  },[roomCode,isSheriffAny]);

  var familyId=viewSheriff&&sheriffViewFamily?sheriffViewFamily:cf;
  var familyData=fd[familyId];
  var familyView=useMemo(()=>buildView(familyData.items,FM[familyId].biz),[familyData.items,familyId]);
  var my=fd[cf];
  var familyTxs=txs.filter(t=>(t.from===familyId||t.to===familyId));
  var pendingCount=txs.filter(t=>(t.type==="sale"&&t.status==="pending"&&t.to===cf)||(t.type==="barter"&&t.status==="awaiting_response"&&t.to===cf)||(t.type==="barter"&&t.status==="pending"&&t.from===cf)).length;
  var myConsults=consultations[cf]||[];
  var myQLeft=myConsults.reduce((s,c)=>s+(c.questionsTotal-c.questionsUsed),0);
  var myQTotal=myConsults.reduce((s,c)=>s+c.questionsTotal,0);

  // Powiadomienia o zmianie statusu transakcji dla rodzin
  var prevTxStatusRef=useRef({});
  var txInitialLoadDone=useRef(false);
  useEffect(()=>{
    if(isSheriffAny)return;
    var prev=prevTxStatusRef.current;
    var next={};
    var isFirstLoad=!txInitialLoadDone.current;
    txs.forEach(function(t){
      if(!t||!t.id)return;
      next[t.id]=t.status;
      var oldStatus=prev[t.id];
      if(oldStatus===t.status)return;
      // Nowa transakcja (nie widziana wcześniej)
      if(!oldStatus){
        // Przy pierwszym renderze tylko rejestruj, nie powiadamiaj
        if(isFirstLoad)return;
        // Powiadom o nowej ofercie skierowanej do naszej rodziny
        if(t.to===cf&&(t.status==="pending"||t.status==="awaiting_response")){
          var fromName=FM[t.from]?FM[t.from].gen:t.from;
          showMsg("Nowa oferta od "+fromName+"!");
        }
        return;
      }
      var involves=(t.from===cf||t.to===cf);
      if(!involves)return;
      var partner=t.from===cf?t.to:t.from;
      var partnerName=FM[partner]?FM[partner].gen:partner;
      if(t.status==="accepted"&&oldStatus==="pending"){
        showMsg("Transakcja z rodziną "+partnerName+" została zaakceptowana!","success");
      } else if(t.status==="rejected"&&oldStatus==="pending"){
        showMsg("Transakcja z rodziną "+partnerName+" została odrzucona.");
      } else if(t.status==="cancelled"){
        showMsg("Transakcja z rodziną "+partnerName+" została anulowana.");
      }
    });
    prevTxStatusRef.current=next;
    if(isFirstLoad)txInitialLoadDone.current=true;
  },[txs]);

  // Auto-placement: sync mapLayout when items change
  useEffect(()=>{
    setMapLayout(prev=>{
      var next={...prev};
      FO.forEach(fId=>{
        var items=fd[fId].items;
        var owned=[...new Set(items.filter(i=>i.cat===C_MAP).map(i=>i.fragNr))];
        var layout=[...prev[fId]];
        // Remove slots whose fragment is no longer owned
        for(var i=0;i<4;i++){if(layout[i]!==0&&owned.indexOf(layout[i])<0)layout[i]=0;}
        // Add newly owned fragments to first free slot
        owned.forEach(nr=>{
          if(layout.indexOf(nr)>=0)return; // already on board
          var slot=layout.indexOf(0);
          if(slot>=0)layout[slot]=nr;
        });
        next[fId]=layout;
      });
      return next;
    });
  },[fd]);

  // claimMapBonus – wywoływana ręcznie przez gracza (przycisk Zatwierdź)
  // P1-3: pełna atomowość – flaga + cash 4 rodzin + wpis tx w jednej transakcji Firebase.
  //       Eliminuje przypadek "flaga ustawiona, ale brak skutków finansowych" przy zamknięciu karty po committed.
  //       Tx ma deterministyczne id "mb-"+fId – chroni przed duplikatami przy ewentualnym recovery.
  function claimMapBonus(fId){
    if(!mapEnabled) return;
    if(mapBonusClaimed[fId]) return;
    var anyWinner=Object.values(mapBonusClaimed).some(v=>v);
    if(anyWinner){showMsg("Premia Złotodajnej Żyły została już przyznana innej rodzinie!");return;}
    // Walidacja lokalna: czy rodzina ma 4 unikalne fragmenty?
    var localItems=stateRef.current.fd[fId]?stateRef.current.fd[fId].items:[];
    var localFrags=[...new Set(localItems.filter(function(i){return i.cat===C_MAP;}).map(function(i){return i.fragNr;}))];
    if(localFrags.length<4){showMsg("Nie posiadasz jeszcze wszystkich 4 fragmentów mapy!");return;}
    if(db){
      // Krok 1: atomowo ustaw flagę mapBonusClaimed (kto pierwszy)
      var mbcRef=db.ref("rooms/"+roomCode+"/gameState/mapBonusClaimed");
      mbcRef.transaction(function(mbc){
        if(!mbc) mbc={};
        if(Object.values(mbc).some(function(v){return v;})) return;
        mbc[fId]=true;
        return mbc;
      },function(err,committed){
        if(err){showMsg("Błąd zapisu: "+err.message);return;}
        if(!committed){showMsg("Premia Złotodajnej Żyły została już przyznana innej rodzinie!");return;}
        // Krok 2: transaction na fd – cash 4 rodzin
        var fdRef=db.ref("rooms/"+roomCode+"/gameState/fd");
        fdRef.transaction(function(fd){
          if(!fd) return fd;
          // Walidacja server-side: czy rodzina ma 4 unikalne fragmenty?
          var srvItems=fd[fId]&&fd[fId].items?fd[fId].items:[];
          var srvFrags=[];srvItems.forEach(function(i){if(i&&i.cat===C_MAP&&srvFrags.indexOf(i.fragNr)<0)srvFrags.push(i.fragNr);});
          if(srvFrags.length<4) return; // abort – brak kompletu
          FO.forEach(function(f){
            if(!fd[f]) return;
            var delta=f===fId?300:-100;
            var newCash=(fd[f].cash!=null?fd[f].cash:0)+delta;
            if(newCash<0) newCash=0;
            fd[f]=Object.assign({},fd[f],{cash:newCash});
          });
          return fd;
        },function(err2,committed2,snapshot){
          if(err2){
            // Rollback flagi mapBonusClaimed – transakcja fd nie powiodła się
            mbcRef.transaction(function(mbc){if(mbc&&mbc[fId]){mbc[fId]=false;return mbc;}return mbc;});
            setMapBonusClaimed(function(p){var n=Object.assign({},p);delete n[fId];return n;});
            showMsg("Błąd rozliczenia: "+err2.message);return;
          }
          if(committed2){
            var newFd=snapshot.val();
            fbIncoming.current=true;
            if(newFd)setFd(newFd);
            var mbTxId="mb-"+fId;
            setTxs(function(p){
              if(p.some(function(t){return t&&t.id===mbTxId;}))return p;
              return [{id:mbTxId,type:"map_bonus",from:fId,to:"all",status:"accepted",offeredItems:[]}].concat(p);
            });
            setMapBonusClaimed(function(p){return Object.assign({},p,{[fId]:true});});
            prevSyncRef.current=Object.assign({},prevSyncRef.current,{fd:newFd,mapBonusClaimed:Object.assign({},prevSyncRef.current.mapBonusClaimed||{},{[fId]:true})});
            setTimeout(function(){fbIncoming.current=false;},50);
            showMsg("Złotodajna Żyła – mapa zatwierdzona! Premia 300 $ przyznana!");
          } else {
            // Rollback flagi mapBonusClaimed – walidacja fragmentów nie przeszła
            mbcRef.transaction(function(mbc){if(mbc&&mbc[fId]){mbc[fId]=false;return mbc;}return mbc;});
            setMapBonusClaimed(function(p){var n=Object.assign({},p);delete n[fId];return n;});
            showMsg("Nie posiadasz jeszcze kompletu 4 fragmentów mapy!");
          }
        });
      });
    } else {
      // Brak Firebase (development) – lokalnie wszystko naraz.
      applyMapBonusLocally(fId);
    }
  }
  // Używana TYLKO w trybie offline (brak db) i jako fallback recovery przez szeryfa.
  // W normalnym trybie sieciowym – transaction wyżej obsługuje wszystko.
  function applyMapBonusLocally(fId){
    setMapBonusClaimed(prev=>({...prev,[fId]:true}));
    setFd(prev=>{
      var n={...prev};
      n[fId]={...n[fId],cash:n[fId].cash+300};
      FO.filter(f=>f!==fId).forEach(otherId=>{
        var delta=-100;
        if(n[otherId].cash+delta<0){delta=-n[otherId].cash;}
        n[otherId]={...n[otherId],cash:n[otherId].cash+delta};
      });
      return n;
    });
    var mbTxId="mb-"+fId;
    setTxs(prev=>{
      if(prev.some(function(t){return t&&t.id===mbTxId;})) return prev;
      return [{id:mbTxId,type:"map_bonus",from:fId,to:"all",status:"accepted",offeredItems:[]},...prev];
    });
    showMsg(FM[fId].nom+" ułożyli Złotodajną Żyłę! Premia 300 $!");
  }

  // === TIMER EFFECT – S3: secondsLeft wyliczane z timerStartedAt + serverTimeOffset ===
  useEffect(()=>{
    if(timerRunning&&!timerPaused){
      // Natychmiast przelicz przy zmianie stanu (np. po reconnect)
      if(timerPausedSecondsLeft!==null){
        setSecondsLeft(timerPausedSecondsLeft);
      } else if(timerStartedAt>0){
        var now=Date.now()+serverTimeOffset;
        var calc=Math.max(0,Math.round(timerDuration-(now-timerStartedAt)/1000));
        setSecondsLeft(calc);
      }
      timerRef.current=setInterval(()=>{
        setSecondsLeft(prev=>{
          // S3 – wylicz aktualną wartość z timerStartedAt + serverTimeOffset
          var now=Date.now()+serverTimeOffset;
          var sLeft=timerStartedAt>0?Math.max(0,Math.round(timerDuration-(now-timerStartedAt)/1000)):Math.max(0,prev-1);
          if(sLeft<=0){clearInterval(timerRef.current);setTimerRunning(false);
            playGunshots(5,200);showMsg("Czas minął!");return 0;}
          if(sLeft===6&&!gunshotFired){playGunshots(5,200);setGunshotFired(true);}
          return sLeft;
        });
      },1000);
      return()=>clearInterval(timerRef.current);
    }
    if(timerPaused&&timerPausedSecondsLeft!==null){
      setSecondsLeft(timerPausedSecondsLeft);
    }
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[timerRunning,timerPaused,timerStartedAt,timerDuration,timerPausedSecondsLeft,gunshotFired,serverTimeOffset]);

  function startStage(idx){
    if(idx<0||idx>=STAGES.length)return;
    // Reset przy starcie rozgrywki – przywróć stan początkowy
    if(idx===0){
      var d={};FO.forEach(f=>{d[f]={cash:600,items:START[f].cards.slice()};});
      if(bnbEnabled){FO.forEach(f=>{d[f].items=d[f].items.concat(makeBnbCards(f));});}
      setFd(d);setTxs([]);
      setConsultations({});setConsultNotes({adams:"",bennet:"",clinton:"",dexter:""});
      setBlindFate({});setPlotPenalties({});setRelations({});
      setMapBonusClaimed({});setMapLayout({adams:[0,0,0,0],bennet:[0,0,0,0],clinton:[0,0,0,0],dexter:[0,0,0,0]});
      setSheriffCalls([]);
      setTutorialDone({});tutorialRedirectedRef.current={};
      if(db&&roomCode)db.ref("rooms/"+roomCode+"/instructionCompleted").remove();
      if(bnbEnabled)setBnbSettled(false);
    }
    // Auto-cancel pending txs z poprzedniego etapu
    setTxs(prev=>{var changed=false;var n=prev.map(t=>{if(t.status==="pending"||t.status==="awaiting_response"){changed=true;return{...t,status:"cancelled",cancelReason:"Koniec tury"};}return t;});return changed?n:prev;});
    setStageIdx(idx);setGameStarted(true);
    var dur=stageDurations[STAGES[idx].id]*60;
    var now=Date.now()+serverTimeOffset; // S3: czas serwerowy
    setTimerDuration(dur);
    setTimerStartedAt(now);
    setTimerPausedSecondsLeft(null);
    setSecondsLeft(dur);
    setTimerPaused(false);setGunshotFired(false);
    if(dur>0){setTimerRunning(true);}else{setTimerRunning(false);}
    showMsg("Start: "+STAGES[idx].label);
  }
  function pauseTimer(){
    var now=Date.now()+serverTimeOffset; // S3: czas serwerowy
    var sLeft=timerStartedAt>0?Math.max(0,Math.round(timerDuration-(now-timerStartedAt)/1000)):secondsLeft;
    setTimerPausedSecondsLeft(sLeft);
    setTimerPaused(true);
    if(timerRef.current)clearInterval(timerRef.current);
    showMsg("Pauza");
  }
  function resumeTimer(){
    var now=Date.now()+serverTimeOffset; // S3: czas serwerowy
    var sLeft=timerPausedSecondsLeft!==null?timerPausedSecondsLeft:secondsLeft;
    // Przesuń timerStartedAt tak żeby secondsLeft się zgadzało
    setTimerStartedAt(now-(timerDuration-sLeft)*1000);
    setTimerPausedSecondsLeft(null);
    setTimerPaused(false);
    showMsg("Wznowiono");
  }
  function applyPlotPenalties(){
    FO.forEach(function(fId){
      if(plotPenalties[fId]) return;
      var f=FM[fId],d=fd[fId];if(!d)return;
      var plotI=d.items.find(function(i){return i.cat===C_PLOT;});
      var plotOk=plotI&&plotI.plotNr===f.tPlot;
      if(!plotOk){
        setFd(function(prev){var n={...prev};var newCash=Math.max(0,n[fId].cash-50);n[fId]={...n[fId],cash:newCash};return n;});
        setTxs(function(prev){return [{id:txId(),type:"plot_cost",from:fId,to:"sheriff",status:"accepted",offeredItems:[],
          description:"Dodatkowy koszt 50 $ wynikający z posiadania niewłaściwej działki (nr "+(plotI?plotI.plotNr:"?")+", docelowa: "+f.tPlot+")"},...prev];});
        setPlotPenalties(function(prev){return {...prev,[fId]:true};});
      }
    });
  }

  function advanceStage(){if(timerRef.current)clearInterval(timerRef.current);setTimerRunning(false);
    resetP(); // zamknij otwarty formularz
    if(stageIdx<STAGES.length-1)startStage(stageIdx+1);else{if(bnbEnabled&&!bnbSettled)settleBnb();applyPlotPenalties();showMsg("Rozgrywka zakończona!");}}

  // Trade partner & phase helpers
  var gameActive=stageIdx>=0;
  var curStage=gameActive?STAGES[stageIdx]:null;
  var isTradePhase=devMode||!gameActive||!!(curStage&&curStage.type==="turn"&&curStage.pairingIdx!==null);
  var tradePartner=(!devMode)&&gameActive&&curStage&&curStage.type==="turn"&&curStage.pairingIdx!==null?getMeetingPartner(cf,curStage.pairingIdx):null;

  function resetP(keepLock){
    setShowP(false);setPMode(null);setPStep(1);setTFam(null);setSelItems([]);setPrice(0);setECash(0);setRTx(null);setSending(false);
    // T5 – zwolnij blokadę formularza TX (chyba że keepLock=true)
    if(!keepLock&&db&&activeTxLockRef.current){
      var lk=activeTxLockRef.current;activeTxLockRef.current=null;
      db.ref("rooms/"+roomCode+"/"+lk).transaction(function(v){return v===sessionId.current?null:v;});
    }
  }
  // T5 – otwieranie formularza TX z blokadą per rodzina + meeting lock
  function openTxForm(mode,extra){
    // Blokada handlu poza turami (po starcie gry)
    if(gameActive&&!isTradePhase){showMsg("Handel jest możliwy tylko w trakcie tur handlowych!");return;}
    if(!db){resetP();setShowP(true);setPMode(mode);
      // Auto-assign partner w turze
      if(gameActive&&tradePartner&&mode!=="barter_response"){setTFam(tradePartner);setPStep(2);}
      if(extra)extra();return;}
    // Klucz blokady: spotkanie (posortowana para) lub rodzina (poza turą)
    var lockKey;
    if(tradePartner){var pair=[cf,tradePartner].sort();lockKey="txMeetLock/"+pair[0]+"_"+pair[1];}
    else{lockKey="txLock/"+cf;}
    db.ref("rooms/"+roomCode+"/"+lockKey).transaction(function(v){
      if(v&&v!==sessionId.current)return; // abort – ktoś inny ma blokadę
      return sessionId.current;
    },function(err,committed){
      if(!committed){showMsg(tradePartner?"Poczekaj \u2013 drugi uczestnik spotkania przygotowuje ofert\u0119!":"Formularz transakcji jest ju\u017C otwarty przez innego uczestnika tej rodziny!");return;}
      activeTxLockRef.current=lockKey;
      db.ref("rooms/"+roomCode+"/"+lockKey).onDisconnect().remove();
      resetP(true);setShowP(true);setPMode(mode);
      // Auto-assign partner w turze
      if(gameActive&&tradePartner&&mode!=="barter_response"){setTFam(tradePartner);setPStep(2);}
      if(extra)extra();
    });
  }
  function toggleItem(item){
    // Nr 5: prevent selecting locked cards
    if(isCardLocked(item.id)){showMsg("Karta \""+item.name+"\" jest zablokowana w innej transakcji!");return;}
    if(item.cat===C_BNB){
      // BnB: toggle all cards with same bnbOrigin as a group
      var hasAny=selItems.find(i=>i.bnbOrigin===item.bnbOrigin);
      if(hasAny) setSelItems(p=>p.filter(i=>i.bnbOrigin!==item.bnbOrigin));
      else setSelItems(p=>p.concat([item]));
    } else {
      setSelItems(p=>p.find(i=>i.id===item.id)?p.filter(i=>i.id!==item.id):p.concat([item]));
    }
  }
  // BnB quantity selection for transactions
  const [bnbQty,setBnbQty]=useState({});
  function setBnbSelQty(origin,qty){setBnbQty(prev=>({...prev,[origin]:qty}));}

  function activateBnb(){
    setFd(prev=>{var n={...prev};FO.forEach(fId=>{n[fId]={...n[fId],items:n[fId].items.concat(makeBnbCards(fId))};});return n;});
    setBnbEnabled(true);showMsg("Biznes na boku – odblokowany!");
  }
  function settleBnb(){
    if(bnbSettled)return;
    var newTxs=[];
    FO.forEach((fId,fi)=>{
      var p=BNB_PRODUCTS[fId];
      var ownCards=fd[fId].items.filter(i=>i.cat===C_BNB&&i.bnbOrigin===fId);
      var soldAll=ownCards.length===0;
      var cost=300; // ZAWSZE 300$ dla dostawcy
      var bonus=soldAll?100:0;
      setFd(prev=>{var n={...prev};
        // S4 – guard: nie zejdź poniżej 0
        var netCost=Math.min(cost-bonus,n[fId].cash);
        n[fId]={...n[fId],cash:n[fId].cash-netCost};return n;});
      // Wpis 1: Opłata dla dostawcy (zawsze)
      newTxs.push({id:txId(),type:"bnb_settle",from:fId,to:"dostawca",status:"accepted",offeredItems:[],
        description:"Opłata dla dostawcy – 300 $"});
      // Wpis 2: Rabat od dostawcy (tylko gdy sprzedano wszystko)
      if(soldAll){
        newTxs.push({id:txId(),type:"bnb_bonus",from:"dostawca",to:fId,status:"accepted",offeredItems:[],
          description:"Rabat od dostawcy – 100 $"});
      }
    });
    setTxs(prev=>[...newTxs,...prev]);
    setBnbSettled(true);showMsg("Biznes na boku – rozliczono!");
  }

  // P1-3: Opcjonalny parametr fdOverride dla walidacji na aktualnym stanie
  function validateMapDuplicate(targetFam, items, fdOverride) {
    var fdToUse = fdOverride || fd;
    var mapItems = items.filter(i => i.cat === C_MAP);
    if (mapItems.length === 0) return true;
    var targetMaps = fdToUse[targetFam].items.filter(i => i.cat === C_MAP);
    for (var mi of mapItems) {
      if (targetMaps.some(t => t.fragNr === mi.fragNr)) return false;
    }
    return true;
  }
  function submitSale(){if(!tFam||!selItems.length||price<=0)return;
    if(!validateMapDuplicate(tFam,selItems,stateRef.current.fd)){showMsg("Ta rodzina już posiada ten fragment mapy!");return;}
    var locked=selItems.filter(i=>isCardLocked(i.id));
    if(locked.length){showMsg("Karta \""+locked[0].name+"\" jest zablokowana w innej transakcji!");return;}
    // S2 – sprawdź duplikat
    var itemIds=selItems.map(i=>i.id).sort().join(",");
    var dup=txs.find(t=>t.type==="sale"&&t.from===cf&&t.to===tFam&&(t.status==="pending"||t.status==="awaiting_response")&&t.offeredItems.map(i=>i.id).sort().join(",")===itemIds);
    if(dup){showMsg("Taka oferta sprzedaży już oczekuje na odpowiedź!");return;}
    setTxs(p=>[{id:txId(),type:"sale",from:cf,to:tFam,offeredItems:selItems.slice(),price:Number(price),status:"pending"},...p]);setSending(true);resetP();showMsg("Oferta sprzedaży wysłana");}
  function submitBarter(){if(!tFam||!selItems.length)return;
    if(!validateMapDuplicate(tFam,selItems,stateRef.current.fd)){showMsg("Ta rodzina już posiada ten fragment mapy!");return;}
    var locked=selItems.filter(i=>isCardLocked(i.id));
    if(locked.length){showMsg("Karta \""+locked[0].name+"\" jest zablokowana w innej transakcji!");return;}
    // S2 – sprawdź duplikat
    var itemIds2=selItems.map(i=>i.id).sort().join(",");
    var dup2=txs.find(t=>t.type==="barter"&&t.from===cf&&t.to===tFam&&(t.status==="pending"||t.status==="awaiting_response")&&t.offeredItems.map(i=>i.id).sort().join(",")===itemIds2);
    if(dup2){showMsg("Taka propozycja barteru już oczekuje na odpowiedź!");return;}
    setTxs(p=>[{id:txId(),type:"barter",from:cf,to:tFam,offeredItems:selItems.slice(),offeredCash:Number(eCash)||0,responseItems:null,responseCash:0,status:"awaiting_response"},...p]);setSending(true);resetP();showMsg("Propozycja barteru wysłana");}
  function submitResponse(){if(!rTx||!selItems.length)return;setSending(true);setTxs(p=>p.map(t=>t.id!==rTx?t:{...t,responseItems:selItems.slice(),responseCash:Number(eCash)||0,status:"pending"}));resetP();showMsg("Kontr-oferta wysłana!");}
  // P1-3: Czysta funkcja walidacji i transferu transakcji (refaktor v1.24.1)
  // Zwraca {ok:true, newFd} lub {ok:false, error:"..."}
  function validateAndApplyTx(currentFd, tx) {
    var seller=currentFd[tx.from],buyer=currentFd[tx.to];
    if(tx.type==="sale"){
      var missing=tx.offeredItems.filter(oi=>!seller.items.find(si=>si.id===oi.id));
      if(missing.length)return{ok:false,error:"Błąd: sprzedawca nie posiada już tych kart!"};
      if(buyer.cash<tx.price)return{ok:false,error:"Błąd: kupujący nie ma wystarczającej gotówki ("+buyer.cash+" $ < "+tx.price+" $)!"};
    }
    if(tx.type==="barter"){
      var missingFrom=tx.offeredItems.filter(oi=>!seller.items.find(si=>si.id===oi.id));
      var missingTo=tx.responseItems?tx.responseItems.filter(ri=>!buyer.items.find(bi=>bi.id===ri.id)):[];
      if(missingFrom.length||missingTo.length)return{ok:false,error:"Błąd: jedna ze stron nie posiada już oferowanych kart!"};
      if(tx.offeredCash>0&&seller.cash<tx.offeredCash)return{ok:false,error:"Błąd: brak gotówki na dopłatę!"};
      if(tx.responseCash>0&&buyer.cash<tx.responseCash)return{ok:false,error:"Błąd: brak gotówki na dopłatę!"};
    }
    // MAP DUPLICATE CHECK
    if(tx.type==="sale"&&!validateMapDuplicate(tx.to,tx.offeredItems,currentFd))return{ok:false,error:"Błąd: kupujący już posiada ten fragment mapy!"};
    if(tx.type==="barter"){
      if(!validateMapDuplicate(tx.to,tx.offeredItems,currentFd))return{ok:false,error:"Błąd: jedna ze stron już posiada oferowany fragment mapy!"};
      if(tx.responseItems&&!validateMapDuplicate(tx.from,tx.responseItems,currentFd))return{ok:false,error:"Błąd: jedna ze stron już posiada oferowany fragment mapy!"};
    }
    // Walidacja OK – oblicz transfer na niemutowalnym snapshotcie
    var n={...currentFd};
    var f={...n[tx.from],items:n[tx.from].items.slice(),cash:n[tx.from].cash};
    var t={...n[tx.to],items:n[tx.to].items.slice(),cash:n[tx.to].cash};
    if(tx.type==="sale"){
      f.items=f.items.filter(i=>!tx.offeredItems.find(o=>o.id===i.id));t.items=t.items.concat(tx.offeredItems);f.cash+=tx.price;t.cash-=tx.price;
    }else{
      f.items=f.items.filter(i=>!tx.offeredItems.find(o=>o.id===i.id));t.items=t.items.concat(tx.offeredItems);
      t.items=t.items.filter(i=>!tx.responseItems.find(r=>r.id===i.id));f.items=f.items.concat(tx.responseItems);
      if(tx.offeredCash>0){f.cash-=tx.offeredCash;t.cash+=tx.offeredCash;}
      if(tx.responseCash>0){t.cash-=tx.responseCash;f.cash+=tx.responseCash;}
    }
    n[tx.from]=f;n[tx.to]=t;
    return{ok:true,newFd:n};
  }
  function acceptTx(txId){
    if(!db){
      var currentFd=stateRef.current.fd;
      var currentTxs=stateRef.current.txs||[];
      var tx=currentTxs.find(function(t){return t.id===txId;});
      if(!tx||tx.status==="accepted")return;
      var result=validateAndApplyTx(currentFd,tx);
      if(!result.ok){
        setTxs(function(p){return p.map(function(t){return t.id===txId?{...t,status:"rejected"}:t;});});
        showMsg(result.error);return;
      }
      setFd(result.newFd);
      setTxs(function(p){return p.map(function(t){return t.id===txId?{...t,status:"accepted",phase:getPhaseIndex(stageIdx)}:t;});});
      showMsg("Operacja zrealizowana!");
      return;
    }
    // Pobierz aktualny tx z serwera, potem transaction() tylko na fd
    var txRef=db.ref("rooms/"+roomCode+"/gameState/txs");
    txRef.once("value",function(txSnap){
      var serverTxs=txSnap.val();
      if(!serverTxs)return;
      var txArr=Array.isArray(serverTxs)?serverTxs:Object.values(serverTxs);
      var tx=null;
      for(var i=0;i<txArr.length;i++){if(txArr[i]&&txArr[i].id===txId){tx=txArr[i];break;}}
      if(!tx||tx.status==="accepted"){showMsg("Ta operacja została już zaakceptowana.");return;}
      var fdRef=db.ref("rooms/"+roomCode+"/gameState/fd");
      fdRef.transaction(function(fd){
        if(!fd)return fd;
        var result=validateAndApplyTx(fd,tx);
        if(!result.ok)return;
        return result.newFd;
      },function(err,committed,snapshot){
        if(err){showMsg("Błąd akceptacji: "+err.message);return;}
        if(!committed){
          showMsg("Operacja odrzucona – warunki transakcji nie są już spełnione.");
          setTxs(function(p){return p.map(function(t){return t.id===txId?{...t,status:"rejected"}:t;});});
          return;
        }
        var newFd=snapshot.val();
        fbIncoming.current=true;
        if(newFd)setFd(newFd);
        setTxs(function(p){return p.map(function(t){return t.id===txId?{...t,status:"accepted",phase:getPhaseIndex(stageIdx)}:t;});});
        prevSyncRef.current=Object.assign({},prevSyncRef.current,{fd:newFd});
        setTimeout(function(){fbIncoming.current=false;},50);
        showMsg("Operacja zrealizowana!");
      });
    });
  }
  function rejectTx(txId){setTxs(p=>p.map(t=>t.id===txId?{...t,status:"rejected"}:t));showMsg("Operacja odrzucona.");}

  function rollDice(fId,rollIdx){
    // P1 – blokada lokalna przed podwójnym kliknięciem
    var lockKey=fId+"-"+rollIdx;
    if(rollingInProgress.current[lockKey])return;
    rollingInProgress.current[lockKey]=true;

    // P5 – blokada Firebase przed równoczesnym rzutem dwóch szeryfów
    if(!db){_doRoll(fId,rollIdx,lockKey);return;}
    var lockRef=db.ref("rooms/"+roomCode+"/rollLock/"+lockKey);
    lockRef.transaction(function(current){
      if(current)return; // już zajęty – abort
      return sessionId.current;
    },function(err,committed){
      if(!committed){
        // Inny szeryf już rzuca – odblokuj lokalnie i wyjdź
        delete rollingInProgress.current[lockKey];
        showMsg("Rzut dla "+FM[fId].nom+" jest już w toku!");
        return;
      }
      lockRef.onDisconnect().remove();
      _doRoll(fId,rollIdx,lockKey,lockRef);
    });
  }

  function _doRoll(fId,rollIdx,lockKey,lockRef){

    // P4 – odczyt policyUsed z closure (stateRef) zamiast setter-hack
    var policyUsed=(stateRef.current.blindFate&&stateRef.current.blindFate[fId]&&stateRef.current.blindFate[fId].rolls&&stateRef.current.blindFate[fId].rolls[rollIdx])?stateRef.current.blindFate[fId].rolls[rollIdx].policyUsed||null:null;

    // P2 – flaga blokująca sync blindFate podczas animacji
    diceRolling.current=true;

    // Start rolling animation
    setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rolls=(bf.rolls||[]).slice();
      rolls[rollIdx]={...rolls[rollIdx],rolling:true};bf.rolls=rolls;n[fId]=bf;return n;});

    // After 2s animation, show dice result
    diceTimeouts.current.push(setTimeout(()=>{
      var diceArr=new Uint8Array(2);crypto.getRandomValues(diceArr);var d1=(diceArr[0]%6)+1,d2=(diceArr[1]%6)+1,sum=d1+d2;
      var ev=BLIND_FATE_EVENTS[sum];
      if(!ev){console.error("Brak zdarzenia dla sumy: "+sum);diceRolling.current=false;delete rollingInProgress.current[lockKey];if(lockRef)lockRef.remove();return;}
      setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rolls=(bf.rolls||[]).slice();
        var roll={...rolls[rollIdx]};
        roll.rolling=false;roll.dice1=d1;roll.dice2=d2;roll.sum=sum;roll.event=ev;roll.resolved=true;roll.showDice=true;roll.showCard=false;
        // P4 – użyj policyUsed z closure
        var pu=policyUsed,ne=0,net="";
        if(ev.type==="loss"){var base=ev.amount;if(pu===100)ne=0;else if(pu===50)ne=Math.round(base/2);else ne=base;net=ne===0?"0 $":ne+" $";}
        else if(ev.type==="loss_resources"){if(pu===100){ne=0;net="0% zasobów";}else if(pu===50){ne=-5;net="-5% zasobów";}else{ne=-10;net="-10% zasobów";}}
        else if(ev.type==="gain"){ne=ev.amount;net="+"+ev.amount+" $";}
        else if(ev.type==="gain_policy"){if(!pu){ne=0;net="0 $";}else{var pc=pu===50?30:50;ne=pc*2;net="+"+ne+" $";}}
        roll.netEffect=ne;roll.netEffectText=net;roll.policyUsed=policyUsed;
        rolls[rollIdx]=roll;bf.rolls=rolls;n[fId]=bf;return n;
      });

      // After 5s delay (dice result visible), show sum and event card
      diceTimeouts.current.push(setTimeout(()=>{
        setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rolls=(bf.rolls||[]).slice();
          rolls[rollIdx]={...rolls[rollIdx],showCard:true,showDice:false};bf.rolls=rolls;n[fId]=bf;return n;});

        var ev2=BLIND_FATE_EVENTS[sum];
        // P4 – oblicz netEffect z closure zamiast setter-hack
        var pu=policyUsed,ne=0,net="";
        if(ev2.type==="loss"){var base2=ev2.amount;if(pu===100)ne=0;else if(pu===50)ne=Math.round(base2/2);else ne=base2;net=ne===0?"0 $":ne+" $";}
        else if(ev2.type==="loss_resources"){if(pu===100){ne=0;net="0% zasobów";}else if(pu===50){ne=-5;net="-5% zasobów";}else{ne=-10;net="-10% zasobów";}}
        else if(ev2.type==="gain"){ne=ev2.amount;net="+"+ev2.amount+" $";}
        else if(ev2.type==="gain_policy"){if(!pu){ne=0;net="0 $";}else{var pc2=pu===50?30:50;ne=pc2*2;net="+"+ne+" $";}}

        // Zastosuj efekty finansowe i polisę
        if(ev2.type!=="loss_resources") setFd(fd3=>{var n={...fd3};n[fId]={...n[fId],cash:Math.max(0,n[fId].cash+ne)};return n;});
        if(policyUsed){
          setBlindFate(prev=>{var n={...prev};var bfn={...(prev[fId]||{})};
            var pol={...(bfn.policies||{})};
            if(policyUsed===50)pol.p50="used";if(policyUsed===100)pol.p100="used";
            bfn.policies=pol;return {...n,[fId]:bfn};});
        }
        var desc="Rzut ["+d1+"+"+d2+"="+sum+"] – "+(ev2?ev2.text:"")+" → "+net;
        if(policyUsed) desc+=" (polisa "+policyUsed+"%)";
        if(ev2&&ev2.type==="loss_resources") desc="Rzut ["+d1+"+"+d2+"="+sum+"] – utrata 10% zasobów na koniec rozgrywki"+(policyUsed?" (polisa "+policyUsed+"%)":"");
        setTxs(prev2=>[{id:txId(),type:"fate",from:fId,to:"sheriff",status:"accepted",offeredItems:[],description:desc},...prev2]);
        showMsg(FM[fId].nom+": "+ev2.text);

        // Auto-hide after 20s (sum visible), return to static dice + P1/P2 cleanup
        diceTimeouts.current.push(setTimeout(()=>{
          setBlindFate(prev=>{var n={...prev};var bf={...(n[fId]||{})};var rls=(bf.rolls||[]).slice();
            if(rls[rollIdx])rls[rollIdx]={...rls[rollIdx],showCard:false,showDice:false};
            bf.rolls=rls;n[fId]=bf;return n;});
          diceRolling.current=false;           // P2 – odblokuj sync
          delete rollingInProgress.current[lockKey]; // P1 – odblokuj rzut
          if(lockRef)lockRef.remove();         // P5 – zwolnij Firebase lock
        },20000));
      },2000));
    },2000));
  }

  var rootRef=React.useRef(null);
  // P2-2: Pusty dependency array – mount-once
  useEffect(()=>{var el=rootRef.current;if(!el)return;function h(e){var btn=e.target.closest("[data-roll]");if(!btn)return;var p=btn.getAttribute("data-roll").split("-");rollDice(p[0],parseInt(p[1]));}el.addEventListener("click",h);return()=>el.removeEventListener("click",h);},[]);

  return (<div ref={rootRef}>
    <ConnectionIndicator online={online}/>
    <div style={{background:"#4C130F",color:"#F5F0E8",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{fontSize:22,fontWeight:700,letterSpacing:"1px"}} className="wt">WSCHÓD DZIKIEGO ZACHODU</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontSize:13,color:"#C4B090",fontFamily:"monospace"}}>Rozgrywka: {roomCode}</div>
        <div style={{fontSize:13,background:"#D4A853",color:"#2C1810",padding:"3px 10px",borderRadius:3,fontWeight:600}}>v3.0.2</div>
      </div>
    </div>
    {isSheriffAny?(()=>{
      var curStage=stageIdx>=0&&stageIdx<STAGES.length?STAGES[stageIdx]:null;
      var totalSeconds=curStage?stageDurations[curStage.id]*60:0;
      var mm=Math.floor(secondsLeft/60),ss=secondsLeft%60;
      var timeStr=(curStage&&curStage.type!=="end")?(timerPaused?"(P) ":"")+mm+":"+(ss<10?"0":"")+ss:"0:00";
      var isLow=secondsLeft<=30&&!!curStage;var isCrit=secondsLeft<=10&&!!curStage;
      // Phase label
      var phaseLabel="";
      if(curStage){
        if(curStage.phase) phaseLabel="Faza "+(curStage.phase===1?"I":curStage.phase===2?"II":"III")+": "+PHASE_NAMES[curStage.phase];
        else if(curStage.type==="prep") phaseLabel="Przygotowanie";
        else if(curStage.type==="narada") phaseLabel="Narada rodzinna";
        else if(curStage.type==="end") phaseLabel="Zakończenie";
      }
      // Stage detail label
      var stageDetail="";
      if(curStage){
        if(curStage.type==="turn"){
          var tn=curStage.id.slice(-1); // "1","2","3"
          var pairs=curStage.pairingIdx!==null?PAIRINGS[curStage.pairingIdx]:null;
          var meetStr=pairs?pairs.map(p=>FM[p[0]].nom+" ↔ "+FM[p[1]].nom).join("   \u00b7   "):"";
          stageDetail="Tura "+tn+(meetStr?"   \u2022   "+meetStr:"");
        } else if(curStage.type==="kn"){
          var knN=curStage.id.slice(-1)==="A"?"1":"2";
          stageDetail="Odprawa "+knN;
        }
      }
      // Next turn info
      var nextTurnStage=null;
      for(var ni=stageIdx+1;ni<STAGES.length;ni++){if(STAGES[ni].type==="turn"){nextTurnStage=STAGES[ni];break;}}
      var nextStr="";
      if(nextTurnStage&&nextTurnStage.pairingIdx!==null){
        var np=PAIRINGS[nextTurnStage.pairingIdx];
        nextStr=np.map(p=>FM[p[0]].nom+" ↔ "+FM[p[1]].nom).join("   \u00b7   ");
      }
      return(<div style={{display:"flex",borderBottom:"2px solid #4C130F",overflowX:"auto",background:"rgba(0,0,0,0.18)",transition:"background 0.5s"}}>
        <div onClick={()=>{setViewSheriff(true);setSheriffViewFamily(null);}} style={{padding:"6px 16px",cursor:"pointer",fontWeight:viewSheriff?700:600,fontSize:14,background:viewSheriff?"rgba(139,105,20,0.85)":"rgba(255,255,255,0.12)",color:"#FFFFFF",borderBottom:viewSheriff?"3px solid #D4A853":"3px solid transparent",transition:"all 0.15s",whiteSpace:"nowrap",letterSpacing:"0.05em",display:"flex",alignItems:"center",flexShrink:0}} className="wt">
          SZERYF
        </div>
        {FO.map(fId=>{
          var act=!viewSheriff&&cf===fId,col=FM[fId].col;
          var FGREYS={adams:"#E9CDC2",bennet:"#C0B8C0",clinton:"#CECDD4",dexter:"#CED6D5"};
          var inactBg=FGREYS[fId]||"#E0D8D0";
          var lbFd=lobbyPlayers[fId];
          var lbMembers=lbFd&&lbFd.members?Object.entries(lbFd.members).map(([id,m])=>m.name||null).filter(Boolean):[];
          var lbCount=lbMembers.length;
          return (<div key={fId} onClick={()=>{setCf(fId);setViewSheriff(false);setSheriffViewFamily(null);setActiveTab("inv");}}
            style={{padding:"6px 16px 5px",cursor:"pointer",fontWeight:act?700:600,fontSize:14,background:act?col:inactBg,color:act?"#fff":col,borderBottom:act?"3px solid "+col:"3px solid transparent",transition:"all 0.15s",whiteSpace:"nowrap",flexShrink:0}} className="wt">
            {FM[fId].nom}
          </div>);
        })}
        {/* Timer section – #842504 bg, progress bar, starts right after Dexterowie */}
        <div style={{flex:1,position:"relative",overflow:"hidden",background:"#842504",borderLeft:"1px solid rgba(255,255,255,0.15)"}}>
          {curStage&&totalSeconds>0&&<div style={{position:"absolute",top:0,left:0,height:"100%",width:(((totalSeconds-secondsLeft)/totalSeconds)*100)+"%",background:"rgba(212,168,83,0.18)",transition:"width 1s linear",pointerEvents:"none"}}/>}
          <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",height:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,overflow:"hidden"}}>
              {phaseLabel&&<span style={{fontSize:13,color:"#D4A853",fontWeight:700,whiteSpace:"nowrap"}}>{phaseLabel}</span>}
              {stageDetail&&<span style={{fontSize:13,color:"#F5F0E8",whiteSpace:"nowrap"}}>{stageDetail}</span>}
              {!curStage&&<span style={{fontSize:13,color:"rgba(245,240,232,0.6)"}}>Oczekiwanie na start</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0,marginLeft:12}}>
              <div style={{fontSize:20,fontWeight:700,color:"#F5F0E8",fontFamily:"monospace",letterSpacing:2,lineHeight:1}}>{timeStr}</div>
              {timerPaused&&curStage&&<div style={{fontSize:11,color:"#D4A853",fontWeight:700}}>PAUZA</div>}
            </div>
          </div>
        </div>
      </div>);
    })():(<AgendaBar familyId={myFamily} stageIdx={stageIdx}/>)}
    {browserWarning&&<div style={{background:"#FFF3CD",border:"1px solid #D4A853",padding:"6px 14px",fontSize:13,color:"#664D03",textAlign:"center",display:"flex",justifyContent:"center",alignItems:"center",gap:8}}>
      Dla najlepszej jakości gry użyj przeglądarki Google Chrome
      <button onClick={()=>setBrowserWarning(false)} style={{fontSize:13,padding:"2px 8px",background:"#D4A853",color:"#fff",border:"none",borderRadius:3,cursor:"pointer",fontFamily:"inherit"}}>OK</button>
    </div>}
    
    {viewSheriff&&sheriffViewFamily&&<div style={{background:"#FFF3CD",border:"1px solid #D4A853",padding:"6px 14px",fontSize:13,color:"#664D03",textAlign:"center"}}>
      Podgląd panelu rodziny {FM[sheriffViewFamily].gen} <button style={{marginLeft:8,fontSize:13,padding:"2px 8px",cursor:"pointer",background:"#8B6914",color:"#fff",border:"none",borderRadius:3,fontFamily:"inherit"}} onClick={()=>setSheriffViewFamily(null)}>Wróć do panelu Szeryfa</button>
    </div>}
    {viewSheriff&&!sheriffViewFamily&&<div style={{maxWidth:1200,margin:"0 auto",padding:0}}>
      <div style={{display:"flex",gap:3,marginBottom:3,padding:"16px 16px 0 0",position:"relative",zIndex:2}}>
        {[["game","ROZGRYWKA"],["results","WYNIKI"]].map(([id,label])=>{
          var act=sheriffTab===id;
          return <div key={id} onClick={()=>setSheriffTab(id)} style={{width:148,height:40,cursor:"pointer",
            backgroundImage:"url("+IMG_BASE+(act?"szer_menu-aktywny.png":"szer_menu-nieaktywny.png")+")",
            backgroundSize:"148px 40px",backgroundRepeat:"no-repeat",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:act?"#F8E7CC":"#3A1F10"}} className="wt">
            <span style={{fontSize:"13.52px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</span>
          </div>;
        })}
      </div>
      <div style={{padding:0}}>

      {/* === ROZGRYWKA (Planowanie / Zarządzanie) === */}
      {sheriffTab==="game"&&(()=>{
        var GAME_TABS=[["planning","Planowanie"],["manage","Zarz\u0105dzanie"]];
        var subTabMenu=React.createElement(React.Fragment,null,
          GAME_TABS.map(function(tab,idx){
          var tid=tab[0],tlabel=tab[1];
          var isAct=sheriffGameSubTab===tid;
          var btnLeft=30+idx*(100+2);
          return(<div key={tid} onClick={function(){setSheriffGameSubTab(tid);}}
            style={{position:"absolute",left:btnLeft,top:120,width:100,height:40,cursor:"pointer",zIndex:3,
              backgroundImage:"url("+IMG_BASE+(isAct?"wyn_zad-p_aktywny.png":"wyn_zad-p_nieaktywny.png")+")",
              backgroundSize:"100% 100%",
              display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
            <span style={{fontSize:14,fontWeight:isAct?700:400,color:isAct?"#fff":"#4C130F",lineHeight:1.2,whiteSpace:"pre-line"}}>{tlabel}</span>
          </div>);
        }),
          <div key="menu-line" style={{position:"absolute",left:30,right:30,top:161,height:1,background:"#805531"}}/>
        );
        return(<div>

          {/* --- Planowanie --- */}
          {sheriffGameSubTab==="planning"&&<div style={{position:"relative",width:1200,height:950,backgroundImage:"url("+IMG_BASE+"szer_1-planowanie.png)",backgroundSize:"1200px 950px",margin:"0 auto",overflow:"hidden",marginBottom:30}}>
            {subTabMenu}
            <div style={{position:"absolute",left:30,right:30,top:193,bottom:30,overflowY:"auto"}}>
              <SheriffPlanningTab readOnly={isSheriff2} roomCode={roomCode} lobbyPlayers={lobbyPlayers} gameStarted={gameStarted} setGameStarted={setGameStarted} showMsg={showMsg} db={db} mapEnabled={mapEnabled} setMapEnabled={setMapEnabled} bnbEnabled={bnbEnabled} setBnbEnabled={setBnbEnabled} activateBnb={activateBnb} devMode={devMode} setDevMode={setDevMode}/>
            </div>
          </div>}

          {/* --- Zarządzanie --- */}
          {sheriffGameSubTab==="manage"&&<div style={{position:"relative",width:1200,margin:"0 auto",
            background:"url("+IMG_BASE+"szer_2-zarzadzanie.png) top left/1200px 950px no-repeat, url("+IMG_BASE+"szer_2-zarzadzanie-tlo.png) top left/1200px 950px repeat-y",
            minHeight:950,paddingBottom:30}}>
            {subTabMenu}
            {/* Raport z rozgrywki */}
            <div style={{position:"absolute",right:20,top:25,zIndex:10,display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={function(){
                var rc=new URLSearchParams(window.location.search).get("s")||"?";
                var sc={},relSc={},tot={};
                FO.forEach(function(fId){
                  sc[fId]=calcScore(fId,fd,plotPenalties,biznesNaBoku,bnbEnabled,blindFate,mapEnabled,mapBonusClaimed);
                  relSc[fId]=calcRelationScore(fId,relations);
                  tot[fId]=Math.round(sc[fId].bizTotal+relSc[fId]);
                });
                // Read sessionInfo from Firebase, then generate PDF
                var siPromise=db?db.ref("rooms/"+rc+"/sessionInfo").once("value").then(function(s){return s.val()||{};}).catch(function(){return {};}):Promise.resolve({});
                var metaPromise=db?db.ref("rooms/"+rc+"/meta").once("value").then(function(s){return s.val()||{};}).catch(function(){return {};}):Promise.resolve({});
                Promise.all([siPromise,metaPromise]).then(function(arr){
                  var si=arr[0],mt=arr[1];
                  generateTrainerPDF({
                    roomCode:rc, imgBase:IMG_BASE,
                    meta:{createdAt:mt.createdAt||Date.now(),client:si.klient||"",group:si.grupa||""},
                    fd:fd, scores:sc, relScores:relSc, totals:tot,
                    txs:txs, relations:relations, blindFate:blindFate,
                    bnbEnabled:bnbEnabled, mapEnabled:mapEnabled, revEnabled:revEnabled,
                    mapBonusClaimed:mapBonusClaimed, revDuels:Array.isArray(revDuels)?revDuels:[]
                  });
                }).catch(function(e){alert("Błąd generowania PDF: "+e.message);console.error(e);});
              }} style={{padding:"10px 24px",fontSize:14,fontFamily:"'Alegreya Sans', sans-serif",fontWeight:500,background:"url("+IMG_BASE+"wynik_przycisk-1.png) center/contain no-repeat",color:"#F8E7CC",border:"none",borderRadius:0,cursor:"pointer",minWidth:180,minHeight:44}}>Raport z rozgrywki</button>
              {stageIdx>=STAGES.length-1&&!isSheriff2&&<button onClick={()=>{if(window.confirm("Czy na pewno chcesz zarchiwizować rozgrywkę? Uczestnicy stracą dostęp.")){db.ref("rooms/"+roomCode+"/meta/status").set("archived").then(()=>{showMsg("Rozgrywka zarchiwizowana. Uczestnicy nie mogą już dołączyć.","success");}).catch(e=>{showMsg("Błąd archiwizacji: "+e.message);});}}} style={{padding:"10px 24px",fontSize:14,fontFamily:"'Alegreya Sans', sans-serif",fontWeight:500,background:"url("+IMG_BASE+"wynik_przycisk-1.png) center/contain no-repeat",color:"#F8E7CC",border:"none",borderRadius:0,cursor:"pointer",minWidth:180,minHeight:44}}>Archiwizuj rozgrywkę</button>}
            </div>
            <div style={{paddingTop:193,paddingLeft:30,paddingRight:30}}>
              <SheriffPanel readOnly={isSheriff2} fd={fd} txs={txs} consultations={consultations} setConsultations={setConsultations} consultNotes={consultNotes} setConsultNotes={setConsultNotes} setFd={setFd} showMsg={showMsg} blindFate={blindFate} setBlindFate={setBlindFate} showResults={showResults} setShowResults={setShowResults} onViewFamily={fId=>setSheriffViewFamily(fId)} plotPenalties={plotPenalties} setPlotPenalties={setPlotPenalties} setTxs={setTxs} biznesNaBoku={biznesNaBoku} setBiznesNaBoku={setBiznesNaBoku} relations={relations} relationsUnlocked={relationsUnlocked} setRelationsUnlocked={setRelationsUnlocked} gameStarted={gameStarted} stageIdx={stageIdx} stageDurations={stageDurations} setStageDurations={setStageDurations} startStage={startStage} pauseTimer={pauseTimer} resumeTimer={resumeTimer} advanceStage={advanceStage} timerRunning={timerRunning} timerPaused={timerPaused} secondsLeft={secondsLeft} manualMode={manualMode} setManualMode={setManualMode} sheriffCalls={sheriffCalls} setSheriffCalls={setSheriffCalls} bnbEnabled={bnbEnabled} setBnbEnabled={setBnbEnabled} bnbSettled={bnbSettled} activateBnb={activateBnb} settleBnb={settleBnb} fateEnabled={fateEnabled} setFateEnabled={setFateEnabled} mapEnabled={mapEnabled} setMapEnabled={setMapEnabled} revEnabled={revEnabled} setRevEnabled={setRevEnabled} revMaxBet={revMaxBet} setRevMaxBet={setRevMaxBet} revDuels={revDuels} revCurrent={revCurrent} revNewDuel={revNewDuel} revSetBet={revSetBet} revReveal={revReveal} revSettle={revSettle} revMode={revMode} setRevMode={setRevMode} revActive={revActive} setRevActive={setRevActive} revStartTournament={revStartTournament} getRevTimer={getRevTimer} revRevealDuel={revRevealDuel} revSettleDuel={revSettleDuel} mapBonusClaimed={mapBonusClaimed} devMode={devMode} setDevMode={setDevMode}/>
            </div>
          </div>}

        </div>);
      })()}

      {/* === WYNIKI === */}
      {sheriffTab==="results"&&<DebriefingPanel viewMode="sheriff" familyId={null} fd={fd} txs={txs} blindFate={blindFate} relations={relations} revDuels={revDuels} debriefFullAccess={debriefFullAccess} debriefTab={sheriffDebriefTab} setDebriefTab={setSheriffDebriefTab} readOnly={isSheriff2} debriefNotes={debriefNotes} setDebriefNotes={setDebriefNotes} debriefUnlocked={debriefUnlocked} setDebriefUnlocked={setDebriefUnlocked} setDebriefFullAccess={setDebriefFullAccess} showMsg={showMsg} mapEnabled={mapEnabled} bnbEnabled={bnbEnabled} biznesNaBoku={biznesNaBoku} fateEnabled={fateEnabled} plotPenalties={plotPenalties} mapBonusClaimed={mapBonusClaimed} onArchive={isSheriff2?null:()=>{db.ref("rooms/"+roomCode+"/meta/status").set("archived").then(()=>{showMsg("Rozgrywka zarchiwizowana. Uczestnicy nie mog\u0105 ju\u017C do\u0142\u0105czy\u0107.","success");}).catch(e=>{showMsg("B\u0142\u0105d archiwizacji: "+e.message);});}}/>}

      </div>
    </div>}

    {(!viewSheriff||sheriffViewFamily)&&(<div style={{maxWidth:1200,margin:"0 auto",padding:"16px 0"}}>
      {/* Belka główna rodziny z licznikiem gotówki */}
      <div style={{position:"relative",width:"100%"}}>
        <img src={IMG_BASE+"belka_"+familyId+".png"} style={{width:"100%",display:"block"}} alt=""/>
        <div style={{position:"absolute",left:"83.67%",top:"50%",transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',Georgia,serif",fontSize:42,fontWeight:700,color:"#D4A853",background:"transparent"}}>{familyData.cash} $</div>
      </div>
      {/* Belka menu */}
      <div style={{position:"relative",width:"100%",marginTop:8}}>
        <img src={IMG_BASE+"belka_menu.png"} style={{width:"100%",display:"block"}} alt=""/>
        {/* Menu wyśrodkowane: belka 1200x127.86, obramowanie 22px, więc środek w około 50% */}
        <div style={{position:"absolute",top:"50%",left:24,transform:"translateY(-50%)",display:"flex",alignItems:"center"}}>
          {[["tutorial","Witajcie w Kairoscity"],["inv","Majątek"],["bnb","Biznes na boku"],["map","Złotodajna Żyła"],["fate","Ślepy los"],["rev","Rewolwerowiec"],["rel","Budowanie relacji"],["results","Wyniki"]].map((t,idx,arr)=>{
            var act=activeTab===t[0];
            var myTutDone=!!(viewSheriff||devMode||tutorialDone[familyId]);
            // Tryb produkcyjny: zakładki ukryte do ukończenia tutoriala (ekran 9)
            if(!myTutDone&&t[0]!=="tutorial") return null;
            var hidden=(t[0]==="rev"&&!revEnabled)||(t[0]==="fate"&&!fateEnabled)||(t[0]==="map"&&!mapEnabled)||(t[0]==="bnb"&&!bnbEnabled);
            if(hidden) return null;
            var locked=(t[0]==="rel"&&!relationsUnlocked)||(t[0]==="results"&&!debriefUnlocked);
            if(locked) return null;
            var visibleItems=arr.filter(x=>{
              if(!myTutDone&&x[0]!=="tutorial") return false;
              if((x[0]==="rev"&&!revEnabled)||(x[0]==="fate"&&!fateEnabled)||(x[0]==="map"&&!mapEnabled)||(x[0]==="bnb"&&!bnbEnabled)) return false;
              if((x[0]==="rel"&&!relationsUnlocked)||(x[0]==="results"&&!debriefUnlocked)) return false;
              return true;
            });
            var isLast=visibleItems[visibleItems.length-1][0]===t[0];
            return <div key={t[0]} onClick={()=>setActiveTab(t[0])} style={{padding:"7px 12px",fontFamily:"'Aka Posse',Georgia,serif",fontSize:15,fontWeight:act?700:400,background:act?"rgba(212,168,83,0.25)":"transparent",color:act?"#fff":"#D4A853",cursor:"pointer",borderRight:isLast?"none":"1px solid rgba(212,168,83,0.4)"}}>{t[1]}</div>;
          })}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:(activeTab==="inv"||activeTab==="tutorial")?"1fr 360px":"1fr",gap:20,alignItems:"start",marginTop:12,padding:activeTab==="results"?0:"0 16px"}}>
        <div>
          {activeTab==="tutorial"&&<InstructionSlides key={familyId} familyId={familyId} roomCode={roomCode} db={db} bnbEnabled={bnbEnabled} mapEnabled={mapEnabled} onTutorialDone={(fId)=>setTutorialDone(prev=>({...prev,[fId]:true}))}/>}
          {activeTab==="inv"&&(()=>{
            var f=FM[familyId];
            // Resources for own biz
            var myRes=familyView.mergedRes.filter(({item})=>item.forBiz===f.biz&&!item.blind);
            var allNR=familyView.orphanNR;
            // Documented progress: resource + matching note both present
            var docResPct=myRes.reduce((s,{item})=>{var hasNote=allNR.some(n=>n.name===item.name&&n.forBiz===item.forBiz);return s+(hasNote?item.weight:0);},0);
            var resPoints=Math.round((docResPct/100)*30);
            // Competencies for own biz
            var myComp=familyView.mergedComp.filter(({item})=>item.forBiz===f.biz&&!item.blind);
            var allNK=familyView.orphanNK;
            var docCompPct=myComp.reduce((s,{item})=>{var hasNote=allNK.some(n=>n.name===item.name&&n.forBiz===item.forBiz);return s+(hasNote?item.weight:0);},0);
            var compPoints=Math.round((docCompPct/100)*25);
            // Plot
            var plotItem=familyView.plots.find(p=>p.plotNr===f.tPlot);
            var plotOk=!!plotItem;
            // Cash
            var cashVal=familyData.cash;
            var famBnbObligacje=familyData.items?familyData.items.filter(function(i){return i.cat===C_BNB&&i.effect==="cash20";}).length:0;
            var cashForScoreD=bnbEnabled?cashVal*(1+famBnbObligacje*0.2):cashVal;
            var cashPoints=Math.round(((cashForScoreD-600)/600)*25);
            var taskBg={padding:"8px 14px",marginBottom:10};
            return (<div key={familyId}>
            {/* --- ZASOBY --- */}
            <TaskHeader imgName="naglowek_zasoby" fallbackText="Pozyskanie zasobów do prowadzenia przedsiębiorstwa"/>
            <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:18,color:"#51211B"}}>
              <div style={{flex:1,display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
                <span>Udokumentowany postęp: <b>{docResPct}%</b></span>
                {bnbEnabled&&(()=>{var bnbKurier=familyData.items.filter(i=>i.cat===C_BNB&&i.effect==="res4").length;return bnbKurier>0?<span style={{color:"#8B7714"}}>Biznes na boku: <b>+{bnbKurier*4}%</b></span>:null;})()}
                <span>Liczba punktów: <b>{resPoints}</b> <span style={{color:"#6B5A4A"}}>(max 30)</span></span>
              </div>
              <InfoPopup title="ZASOBY – max 30 pkt" wide>
                <img src={IMG_BASE+"instrukcja_zasoby-"+familyId+".png"} style={{maxWidth:"90vw",maxHeight:"80vh",display:"block",borderRadius:4}} alt="Instrukcja – zasoby"/>
              </InfoPopup>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
              {familyView.mergedRes.map(({item,note})=><ResourceCard key={item.id} item={item} note={note} isSheriff={viewSheriff}/>)}
            </div>
            {familyView.orphanNR.length>0&&<div>
              <TaskHeader imgName="naglowek_info-zasoby" fallbackText="Notatki dziadka – informacje o zasobach"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:20}}>
                {familyView.orphanNR.map(n=><NoteCard key={n.id} item={n} type="res"/>)}
              </div>
            </div>}
            {/* --- KOMPETENCJE --- */}
            <TaskHeader imgName="naglowek_kompetencje" fallbackText="Pozyskanie kompetencji do prowadzenia przedsiębiorstwa"/>
            <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:18,color:"#51211B"}}>
              <div style={{flex:1,display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
                <span>Udokumentowany postęp: <b>{docCompPct}%</b></span>
                {bnbEnabled&&(()=>{var bnbMikstura=familyData.items.filter(i=>i.cat===C_BNB&&i.effect==="comp4").length;return bnbMikstura>0?<span style={{color:"#8B7714"}}>Biznes na boku: <b>+{bnbMikstura*4}%</b></span>:null;})()}
                <span>Liczba punktów: <b>{compPoints}</b> <span style={{color:"#6B5A4A"}}>(max 25)</span></span>
              </div>
              <InfoPopup title="KOMPETENCJE – max 25 pkt" wide>
                <img src={IMG_BASE+"instrukcja_kompetencje-"+familyId+".png"} style={{maxWidth:"90vw",maxHeight:"80vh",display:"block",borderRadius:4}} alt="Instrukcja – kompetencje"/>
              </InfoPopup>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
              {familyView.mergedComp.map(({item,note})=><CompCard key={item.id} item={item} note={note} isSheriff={viewSheriff}/>)}
            </div>
            {familyView.orphanNK.length>0&&<div>
              <TaskHeader imgName="naglowek_info-kompetencje" fallbackText="Notatki dziadka – informacje o kompetencjach"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:20}}>
                {familyView.orphanNK.map(n=><NoteCard key={n.id} item={n} type="comp"/>)}
              </div>
            </div>}
            {/* --- DZIAŁKI --- */}
            <TaskHeader imgName="naglowek_dzialka" fallbackText="Pozyskanie prawa własności do właściwej działki"/>
            <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:18,color:"#51211B"}}>
              <div style={{flex:1,display:"flex",gap:16,justifyContent:"center"}}>
                <span>Punkty: <b>{plotOk?10:0}</b> <span style={{color:"#6B5A4A"}}>(max 10)</span></span>
              </div>
              <InfoPopup title="Złotodajna Żyła" wide icon="ikona_mapa">
                <img src={IMG_BASE+"mapa_miasteczka.png"} style={{maxWidth:"90vw",maxHeight:"80vh",display:"block",borderRadius:4}} alt="Mapa miasteczka"/>
              </InfoPopup>
              <InfoPopup title="Zadanie 3: Działka" wide>
                <img src={IMG_BASE+"instrukcja_dzialka-"+familyId+".png"} style={{maxWidth:"90vw",maxHeight:"80vh",display:"block",borderRadius:4}} alt="Instrukcja – działka"/>
              </InfoPopup>
            </div>
            <PlotDisplay plots={familyView.plots} familyId={familyId} plotOk={plotOk}/>
            {/* --- GOTÓWKA --- */}
            <TaskHeader imgName="naglowek_gotowka" fallbackText="Pomnożenie gotówki"/>
            <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:18,color:"#51211B"}}>
              <div style={{flex:1,display:"flex",gap:16,justifyContent:"center"}}>
                <span>Posiadana gotówka: <b>{cashVal} $</b></span>
                <span>Punkty: <b>{cashPoints}</b> <span style={{color:"#6B5A4A"}}>(od −25 do 25)</span></span>
              </div>
              <InfoPopup title="Zadanie 4: Gotówka" wide>
                <img src={IMG_BASE+"instrukcja_gotowka.png"} style={{maxWidth:"90vw",maxHeight:"80vh",display:"block",borderRadius:4}} alt="Instrukcja – gotówka"/>
              </InfoPopup>
            </div>
            <img src={IMG_BASE+"kasa_punkty.png"} style={{width:"100%",height:"auto",display:"block",marginBottom:8}} alt="Kasa – punkty"/>
          </div>);
          })()}
          {activeTab==="map"&&<MapTracker items={familyData.items} mapBonusClaimed={mapBonusClaimed} fId={familyId} mapLayout={mapLayout} setMapLayout={setMapLayout} onClaim={claimMapBonus} readonly={!!(viewSheriff&&sheriffViewFamily)}/>}
          {activeTab==="bnb"&&bnbEnabled&&(()=>{
            var allBnb=familyData.items.filter(i=>i.cat===C_BNB);
            var forSale=allBnb.filter(i=>i.bnbOrigin===familyId);
            var myProduct=BNB_PRODUCTS[familyId];
            var sold=myProduct.qty-forSale.length;
            return(<BnbTab familyId={familyId} sold={sold} total={myProduct.qty} familyData={familyData}/>);
          })()}
          {activeTab==="fate"&&<BlindFateFamily fId={familyId} blindFate={blindFate}/>}
          {activeTab==="rel"&&relationsUnlocked&&(()=>{
            var CATS=[
              {key:"partnership",   label:"Partnerstwo",          desc:["Zespół dbał tylko o swoje interesy","Zespół dbał o interesy dwóch stron"]},
              {key:"rules",         label:"Przestrzeganie zasad", desc:["Zespół łamał lub omijał zasady","Zespół przestrzegał i dbał o zasady"]},
              {key:"communication", label:"Komunikacja",          desc:["W komunikacji z zespołem występowały duże trudności","Zespół komunikował się czytelnie i słuchał uważnie"]}
            ];
            var others=FO.filter(f=>f!==familyId);
            function setRating(target,cat,val){
              setRelations(prev=>{var n={...prev};if(!n[familyId])n[familyId]={};if(!n[familyId][target])n[familyId][target]={};n[familyId][target]={...n[familyId][target],[cat]:val};return n;});
            }
            function getRating(target,cat){return (relations[familyId]&&relations[familyId][target]&&relations[familyId][target][cat])||0;}
            return (<div>
              <img src={IMG_BASE+"rel_banner.png"} style={{width:"100%",height:"auto",display:"block",marginBottom:14}} alt="Budowanie relacji"/>
              {others.map(target=>{var f=FM[target];return (<div key={target} style={{position:"relative",marginBottom:10,padding:12}}>
                <img src={IMG_BASE+"rel_tlo_"+target+".png"} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0}} alt=""/>
                <div style={{position:"relative",zIndex:1}}>
                {CATS.map(cat=>(<div key={cat.key} style={{marginBottom:12}}>
                  <div style={{textAlign:"center",fontWeight:700,fontSize:18,color:"#842504",marginBottom:6}} className="wt">{cat.label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,textAlign:"right",fontSize:14,fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,color:"#51211B",lineHeight:1.4}}>{cat.desc[0]}</div>
                    <div style={{flex:"0 0 auto"}}><StarRating value={getRating(target,cat.key)} onChange={v=>setRating(target,cat.key,v)} disabled={viewSheriff}/></div>
                    <div style={{flex:1,textAlign:"left",fontSize:14,fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,color:"#51211B",lineHeight:1.4}}>{cat.desc[1]}</div>
                  </div>
                </div>))}
                </div>
              </div>);})}
            </div>);
          })()}
          {activeTab==="results"&&debriefUnlocked&&<DebriefingPanel viewMode="player" familyId={familyId} fd={fd} txs={txs} blindFate={blindFate} relations={relations} revDuels={revDuels} debriefFullAccess={debriefFullAccess} debriefTab={playerDebriefTab} setDebriefTab={setPlayerDebriefTab} readOnly={true} debriefNotes={{}} setDebriefNotes={null} debriefUnlocked={debriefUnlocked} setDebriefUnlocked={null} setDebriefFullAccess={null} showMsg={null} mapEnabled={mapEnabled} bnbEnabled={bnbEnabled} biznesNaBoku={biznesNaBoku} fateEnabled={fateEnabled} plotPenalties={plotPenalties} mapBonusClaimed={mapBonusClaimed}/>}
          {activeTab==="rev"&&revEnabled&&(()=>{
            var rc=revActive.find(d=>d.familyA===familyId||d.familyB===familyId)||revCurrent;
            var duelTimer=rc?getRevTimer(rc.id):-1;
            return <RewolwerowiecNew rc={rc} familyId={familyId} duelTimer={duelTimer} revSubmitShots={revSubmitShots} revDuels={revDuels} getRevTimer={getRevTimer}/>;
          })()}
        </div>
        {(activeTab==="inv"||activeTab==="tutorial")&&<div style={{position:"sticky",top:12,alignSelf:"start"}}>
          {/* Przyciski transakcji */}
          {!viewSheriff&&isTradePhase&&<div style={{display:"flex",gap:6,marginBottom:12}}>
            <img src={IMG_BASE+"przycisk_sprzedaz.png"} style={{width:177,height:50,cursor:"pointer",display:"block"}} alt="Sprzedaż" onClick={()=>openTxForm("sale")}/>
            <img src={IMG_BASE+"przycisk_barter.png"} style={{width:177,height:50,cursor:"pointer",display:"block"}} alt="Barter" onClick={()=>openTxForm("barter")}/>
          </div>}
          {!viewSheriff&&gameActive&&!isTradePhase&&<div style={{display:"flex",gap:6,marginBottom:12,opacity:0.35,pointerEvents:"none"}}>
            <img src={IMG_BASE+"przycisk_sprzedaz.png"} style={{width:177,height:50,display:"block",filter:"grayscale(1)"}} alt="Sprzedaż"/>
            <img src={IMG_BASE+"przycisk_barter.png"} style={{width:177,height:50,display:"block",filter:"grayscale(1)"}} alt="Barter"/>
          </div>}
          {!viewSheriff&&<div style={{marginBottom:16}}>
            {(()=>{var myWaiting=sheriffCalls.filter(c=>c.fId===cf&&c.status==="waiting");var hasWaiting=myWaiting.length>0;
              return(<div style={{position:"relative",width:360,cursor:hasWaiting?"not-allowed":"pointer",background:"transparent"}} onClick={()=>{
                  if(hasWaiting)return;
                  setSheriffCalls(prev=>[...prev,{fId:cf,status:"waiting",ts:Date.now()}]);
                  showMsg("Wezwano Szeryfa!");
                }}>
                <img src={IMG_BASE+"przycisk_wezwij-szeryfa.png"} style={{width:360,height:119,display:"block",filter:hasWaiting?"brightness(0.5) saturate(0.6)":"none",transition:"filter 0.2s"}} alt="Wezwij Szeryfa"/>
                <div style={{position:"absolute",left:"50%",bottom:45.4,transform:"translate(-50%, 50%)",fontFamily:"'Aka Posse',serif",fontSize:14,color:"#FEEAAE",whiteSpace:"nowrap"}}>
                  Konsultacje: {myQLeft}/{myQTotal}
                </div>
              </div>);
            })()}
          </div>}
          <FamilyTimerPanel familyId={familyId} stageIdx={stageIdx} secondsLeft={secondsLeft} gameStarted={gameStarted} timerPaused={timerPaused}/>
          <div style={{background:"#fff",backgroundImage:"url("+IMG_BASE+"tlo_uniwersalne.png)",backgroundSize:"cover",backgroundPosition:"center",borderRadius:6,border:"1px solid #D4C4A8",padding:14,maxHeight:400,overflowY:"auto"}}>
            <div style={{fontSize:24,fontWeight:700,letterSpacing:"1.5px",color:"#842504",marginBottom:10,borderBottom:"2px solid #842504",paddingBottom:4}} className="wt">Księgowość {pendingCount>0&&<span className="badge">{pendingCount}</span>}</div>
            {familyTxs.length===0?<div style={{textAlign:"center",padding:24,color:"#A89070",fontSize:13,fontStyle:"italic"}}>Brak wpisów</div>
            :familyTxs.map(t=><TxDisplay key={t.id} tx={t} cf={familyId} onAccept={acceptTx} onReject={rejectTx} onRespond={id=>openTxForm("barter_response",()=>setRTx(id))}/>)}
          </div>
        </div>}
      </div>
    </div>)}

    {showP&&(<div>
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(44,24,16,0.4)",zIndex:99}} onClick={resetP}/>
      <div style={{position:"fixed",top:0,right:0,width:420,height:"100vh",backgroundImage:"url("+IMG_BASE+"sprzedaz_tlo.png)",backgroundSize:"cover",backgroundPosition:"center bottom",backgroundRepeat:"no-repeat",backgroundColor:"#2C1810",boxShadow:"-4px 0 20px rgba(0,0,0,0.15)",zIndex:100,display:"flex",flexDirection:"column"}}>
        <div style={{background:"#D7B56D",color:"#fff",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #D7B56D"}}>
          <div style={{fontSize:15,fontWeight:700}}>
            {pMode==="sale"&&(pStep===1?"Sprzedaż: Komu?":pStep===2?"Sprzedaż: Co?":"Sprzedaż: Cena")}
            {pMode==="barter"&&(pStep===1?"Barter: Komu?":pStep===2?"Barter: Co oferujesz?":"Barter: Podsumowanie")}
            {pMode==="barter_response"&&"Kontr-oferta barterowa"}
          </div>
          <button style={{background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer"}} onClick={resetP}>X</button>
        </div>
        <div style={{padding:16,flex:1,overflowY:"auto"}}>
          {/* Auto-partner info */}
          {gameActive&&tradePartner&&tFam&&pMode!=="barter_response"&&<div style={{background:"rgba(255,255,255,0.85)",border:"2px solid "+FM[tFam].col,borderRadius:5,padding:"10px 14px",marginBottom:12,fontSize:14,fontWeight:700,color:FM[tFam].col}}>
            Kontrahent: {FM[tFam].nom} ({FM[tFam].biz})
          </div>}
          {(pMode==="sale"||pMode==="barter")&&pStep===1&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
            {FO.filter(f=>f!==cf).map(fId=>{var sel=tFam===fId,col=FM[fId].col;
              return <div key={fId} onClick={()=>setTFam(fId)} style={{padding:"10px 14px",border:sel?"2px solid "+col:"1px solid #D4C4A8",borderRadius:5,background:sel?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.7)",cursor:"pointer",fontWeight:sel?700:400,fontSize:14}}>{FM[fId].nom} ({FM[fId].biz})</div>;
            })}
          </div>}
          {(pMode==="sale"||pMode==="barter")&&pStep===2&&<div>
            <div style={{fontSize:15,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>{pMode==="sale"?"Wybierz towar":"Wybierz co oferujesz"}</div>
            <div style={{maxHeight:380,overflowY:"auto"}}>{(()=>{
              // Zbierz ID kart zaangażowanych w transakcje (pending, awaiting, accepted)
              var committedIds=new Set();
              txs.forEach(function(t){
                if(t.status==="rejected"||t.status==="cancelled")return;
                if(t.from===cf&&t.offeredItems)t.offeredItems.forEach(function(i){committedIds.add(i.id);});
                if(t.to===cf&&t.responseItems)t.responseItems.forEach(function(i){committedIds.add(i.id);});
              });
              var items=my.items.filter(item=>item.cat!==C_BNB&&!committedIds.has(item.id));
              var cats=[
                {cat:C_RES,   label:"Zasoby",                       col:"#A08050",bg:"#FDFAF4"},
                {cat:C_NRES,  label:"Notatki dziadka – zasoby",     col:"#A08050",bg:"#FFFCF6"},
                {cat:C_COMP,  label:"Kompetencje",                   col:"#6090B0",bg:"#F4F8FC"},
                {cat:C_NCOMP, label:"Notatki dziadka – kompetencje",col:"#6090B0",bg:"#F6F8FF"},
                {cat:C_PLOT,  label:"Działka",                       col:"#A08050",bg:"#FDFAF4"},
                {cat:C_MAP,   label:"Fragment mapy",                 col:"#A09020",bg:"#FFFDF0"},
              ];
              var hdrS={fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6,marginTop:10};
              return cats.map(({cat,label,col,bg})=>{
                var group=items.filter(i=>i.cat===cat);
                // Ukryj oryginał mapy – 1 kopia własnego fragmentu jest niezbywalna
                if(cat===C_MAP){
                  var ownFragNr=FM[cf].mapFrag;
                  var ownIdx=group.findIndex(i=>i.fragNr===ownFragNr);
                  if(ownIdx>=0)group=group.filter((_,idx)=>idx!==ownIdx);
                }
                if(!group.length)return null;
                return (<div key={cat}>
                  <div style={{...hdrS,color:"#fff"}}>{label}</div>
                  {group.map(item=>{var sel=!!selItems.find(i=>i.id===item.id);return <div key={item.id} style={{marginBottom:4}}>
                    {cat===C_RES&&<ResourceCard item={item} selected={sel} compact textOnly onClick={()=>toggleItem(item)} isSheriff={false}/>}
                    {cat===C_COMP&&<CompCard item={item} selected={sel} compact textOnly onClick={()=>toggleItem(item)} isSheriff={false}/>}
                    {cat===C_NRES&&<NoteCard item={item} selected={sel} type="res" textOnly onClick={()=>toggleItem(item)} txBg={bg}/>}
                    {cat===C_NCOMP&&<NoteCard item={item} selected={sel} type="comp" textOnly onClick={()=>toggleItem(item)} txBg={bg}/>}
                    {cat===C_PLOT&&<div onClick={()=>toggleItem(item)} style={{borderRadius:5,border:(sel?"2px solid #D4A853":"1px solid #C4B090"),background:sel?"#FFF8E7":bg,padding:"8px 10px",cursor:"pointer",position:"relative"}}>{sel&&<span style={{position:"absolute",top:4,right:6,fontSize:14,color:"#D4A853",fontWeight:700}}>V</span>}<div style={{fontSize:14,fontWeight:600}}>{item.name}</div><div style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#A08050",marginTop:2}}>DZIAŁKA</div></div>}
                    {cat===C_MAP&&<div onClick={()=>toggleItem(item)} style={{borderRadius:5,border:(sel?"2px solid #D4A853":"1px solid #D4C870"),background:sel?"#FFF8E7":bg,padding:"8px 10px",cursor:"pointer",position:"relative"}}>{sel&&<span style={{position:"absolute",top:4,right:6,fontSize:14,color:"#D4A853",fontWeight:700}}>V</span>}<div style={{fontSize:14,fontWeight:600}}>{item.name}</div><div style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#A09020",marginTop:2}}>FRAGMENT MAPY</div></div>}
                  </div>;})}
                </div>);
              });
            })()}
            {bnbEnabled&&(()=>{
              var bnbItems=my.items.filter(i=>i.cat===C_BNB);
              var grouped={};bnbItems.forEach(i=>{if(!grouped[i.bnbOrigin])grouped[i.bnbOrigin]=[];grouped[i.bnbOrigin].push(i);});
              if(Object.keys(grouped).length===0)return null;
              return(<div style={{marginTop:8,borderTop:"1px solid #D7B56D",paddingTop:8}}>
                <div style={{fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#fff",marginBottom:6}}>Biznes na boku</div>
                {Object.keys(grouped).map(origin=>{
                  var cards=grouped[origin],prod=BNB_PRODUCTS[origin];
                  var selCount=selItems.filter(i=>i.cat===C_BNB&&i.bnbOrigin===origin).length;
                  var isSel=selCount>0;
                  function setQty(q){
                    q=Math.max(0,Math.min(q,cards.length));
                    setSelItems(prev=>{
                      var without=prev.filter(i=>!(i.cat===C_BNB&&i.bnbOrigin===origin));
                      return without.concat(cards.slice(0,q));
                    });
                  }
                  return(<div key={origin} style={{padding:"8px 10px",marginBottom:4,borderRadius:5,border:(isSel?"2px solid #D4A853":"1px solid #D4C870"),background:isSel?"#FFF8E7":"#FFFDF0",cursor:"pointer"}} onClick={()=>{if(selCount===0)setQty(1);else setQty(0);}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:prod.color}}>{prod.name}</div>
                        <div style={{fontSize:13,color:"#8B7355"}}>{prod.effectDesc}</div>
                        <div style={{fontSize:13,color:"#A89070"}}>{origin===cf?"Twój produkt":"od "+FM[origin].gen} – dostępne: {cards.length}</div>
                      </div>
                      {isSel&&<div style={{display:"flex",alignItems:"center",gap:4}} onClick={e=>e.stopPropagation()}>
                        <button style={{width:22,height:22,border:"1px solid #D4C4A8",borderRadius:3,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}} onClick={()=>setQty(selCount-1)}>−</button>
                        <span style={{fontSize:13,fontWeight:700,minWidth:20,textAlign:"center"}}>{selCount}</span>
                        <button style={{width:22,height:22,border:"1px solid #D4C4A8",borderRadius:3,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}} onClick={()=>setQty(selCount+1)}>+</button>
                      </div>}
                    </div>
                  </div>);
                })}
              </div>);
            })()}
            </div>
            {pMode==="barter"&&<div style={{marginTop:10}}>
              <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>Dopłata ($)</div>
              <input type="number" min="0" max={my.cash} value={eCash} onChange={e=>setECash(Math.min(Number(e.target.value),my.cash))} style={{width:100,padding:"6px 10px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:14,fontWeight:700,fontFamily:"inherit"}}/>
            </div>}
          </div>}
          {pMode==="sale"&&pStep===3&&<div>
            <div style={{background:"#F0EBE0",padding:12,borderRadius:5,marginBottom:14,fontSize:13,lineHeight:1.5}}><b>Sprzedajesz rodzinie {FM[tFam].gen}:</b><br/>{fmtItems(selItems)}</div>
            <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:6}}>Cena ($)</div>
            <input type="number" min="1" value={price} onChange={e=>setPrice(Number(e.target.value))} style={{width:120,padding:"8px 12px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:20,fontWeight:700,fontFamily:"inherit"}}/>
          </div>}
          {pMode==="barter"&&pStep===3&&<div style={{background:"#F0EBE0",padding:12,borderRadius:5,fontSize:13,lineHeight:1.6}}>
            <b>Propozycja dla rodziny {FM[tFam].gen}:</b><br/>Oferujesz: {fmtItems(selItems)}{eCash>0?" + "+eCash+" $":""}<br/><i style={{color:"#8B7355"}}>Druga strona zaproponuje co daje w zamian.</i>
          </div>}
          {pMode==="barter_response"&&(()=>{var tx=txs.find(t=>t.id===rTx);if(!tx)return null;return <div>
            <div style={{background:"#F0EBE0",padding:10,borderRadius:5,marginBottom:12,fontSize:13,lineHeight:1.5}}><b>Rodzina {(FM[tx.from]||{gen:tx.from}).gen} oferuje:</b> {fmtItems(tx.offeredItems)}{tx.offeredCash>0?" + "+tx.offeredCash+" $":""}</div>
            <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:8}}>Co oferujesz w zamian?</div>
            <div style={{maxHeight:300,overflowY:"auto"}}>{(()=>{
              var committedIds2=new Set();
              txs.forEach(function(t){
                if(t.status==="rejected"||t.status==="cancelled")return;
                if(t.from===cf&&t.offeredItems)t.offeredItems.forEach(function(i){committedIds2.add(i.id);});
                if(t.to===cf&&t.responseItems)t.responseItems.forEach(function(i){committedIds2.add(i.id);});
              });
              var ownFragNr=FM[cf].mapFrag;
              var respItems=my.items.filter(item=>item.cat!==C_BNB&&!committedIds2.has(item.id)).filter((item,idx,arr)=>{
                if(item.cat!==C_MAP||item.fragNr!==ownFragNr)return true;
                // Ukryj oryginał – pierwszą kopię własnego fragmentu pomijamy
                var firstOwnIdx=arr.findIndex(i=>i.cat===C_MAP&&i.fragNr===ownFragNr);
                return idx!==firstOwnIdx;
              });
              return respItems.map(item=>{var sel=!!selItems.find(i=>i.id===item.id);return <div key={item.id} style={{marginBottom:4}}>
              {item.cat===C_RES&&<ResourceCard item={item} selected={sel} compact textOnly onClick={()=>toggleItem(item)} isSheriff={false}/>}
              {item.cat===C_COMP&&<CompCard item={item} selected={sel} compact textOnly onClick={()=>toggleItem(item)} isSheriff={false}/>}
              {item.cat===C_NRES&&<NoteCard item={item} selected={sel} type="res" textOnly onClick={()=>toggleItem(item)}/>}
              {item.cat===C_NCOMP&&<NoteCard item={item} selected={sel} type="comp" textOnly onClick={()=>toggleItem(item)}/>}
              {item.cat===C_PLOT&&<div onClick={()=>toggleItem(item)} style={{borderRadius:5,border:(sel?"2px solid #D4A853":"1px solid #C4B090"),background:sel?"#FFF8E7":"#FDFAF4",padding:"8px 10px",cursor:"pointer",position:"relative"}}>{sel&&<span style={{position:"absolute",top:4,right:6,fontSize:13,color:"#D4A853",fontWeight:700}}>V</span>}<div style={{fontSize:13,fontWeight:600}}>{item.name}</div><div style={{fontSize:13,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#A08050",marginTop:2}}>DZIAŁKA</div></div>}
              {item.cat===C_MAP&&<div onClick={()=>toggleItem(item)} style={{borderRadius:5,border:(sel?"2px solid #D4A853":"1px solid #D4C870"),background:sel?"#FFF8E7":"#FFFDF0",padding:"8px 10px",cursor:"pointer",position:"relative"}}>
                {sel&&<span style={{position:"absolute",top:4,right:6,fontSize:13,color:"#D4A853",fontWeight:700}}>V</span>}
                <div style={{fontSize:13,fontWeight:600}}>{item.name}</div>
                <div style={{fontSize:13,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#A09020",marginTop:2}}>FRAGMENT MAPY</div>
              </div>}
            </div>;})})()}
            {bnbEnabled&&(()=>{
              var bnbItems=my.items.filter(i=>i.cat===C_BNB);
              var grouped={};bnbItems.forEach(i=>{if(!grouped[i.bnbOrigin])grouped[i.bnbOrigin]=[];grouped[i.bnbOrigin].push(i);});
              if(Object.keys(grouped).length===0)return null;
              return(<div style={{marginTop:8,borderTop:"1px solid #D7B56D",paddingTop:8}}>
                <div style={{fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#fff",marginBottom:6}}>Biznes na boku</div>
                {Object.keys(grouped).map(origin=>{
                  var cards=grouped[origin],prod=BNB_PRODUCTS[origin];
                  var selCount=selItems.filter(i=>i.cat===C_BNB&&i.bnbOrigin===origin).length;
                  var isSel=selCount>0;
                  function setQty(q){
                    q=Math.max(0,Math.min(q,cards.length));
                    setSelItems(prev=>{
                      var without=prev.filter(i=>!(i.cat===C_BNB&&i.bnbOrigin===origin));
                      return without.concat(cards.slice(0,q));
                    });
                  }
                  return(<div key={origin} style={{padding:"8px 10px",marginBottom:4,borderRadius:5,border:(isSel?"2px solid #D4A853":"1px solid #D4C870"),background:isSel?"#FFF8E7":"#FFFDF0",cursor:"pointer"}} onClick={()=>{if(selCount===0)setQty(1);else setQty(0);}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:prod.color}}>{prod.name}</div>
                        <div style={{fontSize:13,color:"#8B7355"}}>{prod.effectDesc}</div>
                        <div style={{fontSize:13,color:"#A89070"}}>{origin===cf?"Twój produkt":"od "+FM[origin].gen} – dostępne: {cards.length}</div>
                      </div>
                      {isSel&&<div style={{display:"flex",alignItems:"center",gap:4}} onClick={e=>e.stopPropagation()}>
                        <button style={{width:22,height:22,border:"1px solid #D4C4A8",borderRadius:3,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}} onClick={()=>setQty(selCount-1)}>−</button>
                        <span style={{fontSize:13,fontWeight:700,minWidth:20,textAlign:"center"}}>{selCount}</span>
                        <button style={{width:22,height:22,border:"1px solid #D4C4A8",borderRadius:3,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}} onClick={()=>setQty(selCount+1)}>+</button>
                      </div>}
                    </div>
                  </div>);
                })}
              </div>);
            })()}
            </div>
            <div style={{marginTop:10}}><div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>Dopłata ($)</div>
            <input type="number" min="0" max={my.cash} value={eCash} onChange={e=>setECash(Math.min(Number(e.target.value),my.cash))} style={{width:100,padding:"6px 10px",border:"1px solid #D4C4A8",borderRadius:4,fontSize:14,fontWeight:700,fontFamily:"inherit"}}/></div>
          </div>;})()}
        </div>
        <div style={{padding:"14px 18px",borderTop:"1px solid #D7B56D",display:"flex",gap:8,justifyContent:"flex-end"}}>
          {(pMode==="sale"||pMode==="barter")&&pStep>1&&!(gameActive&&tradePartner&&pStep===2)&&<img src={IMG_BASE+"przycisk_wstecz.png"} alt="Wstecz" onClick={()=>setPStep(s=>s-1)} style={{height:36,width:"auto",cursor:"pointer",display:"block"}}/>}
          <div style={{flex:1}}/>
          {(pMode==="sale"||pMode==="barter")&&pStep<3&&<img src={IMG_BASE+"przycisk_dalej.png"} alt="Dalej" onClick={()=>{var fs=formStateRef.current;if(fs.pStep===1&&!fs.tFam)return;if(fs.pStep===2&&!selItems.length)return;setPStep(s=>s+1);}} style={{height:36,width:"auto",cursor:((pStep===1&&!tFam)||(pStep===2&&!selItems.length))?"not-allowed":"pointer",opacity:((pStep===1&&!tFam)||(pStep===2&&!selItems.length))?0.4:1,display:"block"}}/>}
          {pMode==="sale"&&pStep===3&&<div onClick={()=>{if(!(price<=0||sending))submitSale();}} style={{position:"relative",height:36,width:139,cursor:(price<=0||sending)?"not-allowed":"pointer",opacity:(price<=0||sending)?0.5:1,flexShrink:0}}>
            <img src={IMG_BASE+"przycisk_panel-sp.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"fill"}} alt=""/>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700,fontFamily:"'Aka Posse',Georgia,serif",letterSpacing:"0.5px"}}>{sending?"Wysyłanie…":"Wyślij ofertę"}</div>
          </div>}
          {pMode==="barter"&&pStep===3&&<div onClick={()=>{if(!sending)submitBarter();}} style={{position:"relative",height:36,width:139,cursor:sending?"not-allowed":"pointer",opacity:sending?0.5:1,flexShrink:0}}>
            <img src={IMG_BASE+"przycisk_panel-sp.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"fill"}} alt=""/>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700,fontFamily:"'Aka Posse',Georgia,serif",letterSpacing:"0.5px"}}>{sending?"Wysyłanie…":"Wyślij propozycję"}</div>
          </div>}
          {pMode==="barter_response"&&<div onClick={()=>{if(!(!selItems.length||sending))submitResponse();}} style={{position:"relative",height:36,width:139,cursor:(!selItems.length||sending)?"not-allowed":"pointer",opacity:(!selItems.length||sending)?0.5:1,flexShrink:0}}>
            <img src={IMG_BASE+"przycisk_panel-sp.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"fill"}} alt=""/>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,fontFamily:"'Aka Posse',Georgia,serif",letterSpacing:"0.5px"}}>{sending?"Wysyłanie…":"Wyślij kontr-ofertę"}</div>
          </div>}
        </div>
      </div>
    </div>)}
    {toast&&<div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#2E5B3C",color:"#fff",padding:"10px 20px",borderRadius:5,fontSize:14,fontWeight:600,zIndex:200,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>{toast}</div>}
  </div>);
}
/* ========== GAME WRAPPER – LOBBY → GAME ========== */
function ScaleWrapper({children}){
  const [zoom,setZoom]=useState(1);
  const BASE=1280;
  React.useEffect(()=>{
    function upd(){setZoom(window.innerWidth<BASE?window.innerWidth/BASE:1);}
    upd();window.addEventListener("resize",upd);
    return()=>window.removeEventListener("resize",upd);
  },[]);
  return <div style={{zoom}}>{children}</div>;
}

function GameWrapper(){
  const [gameInfo,setGameInfo]=useState(null); // {roomCode, role, playerId, playerName}

  function handleJoin(roomCode,role,playerId,playerName){
    var url=new URL(window.location);
    url.searchParams.delete("room");url.searchParams.delete("role"); // cleanup old params
    url.searchParams.set("s",roomCode);
    url.searchParams.set("f",role);
    window.history.replaceState({},"",url);
    setGameInfo({roomCode,role,playerId:playerId||null,playerName:playerName||null});
  }

  if(gameInfo){
    return <ScaleWrapper><App key={gameInfo.roomCode} roomCode={gameInfo.roomCode} role={gameInfo.role} playerId={gameInfo.playerId} playerName={gameInfo.playerName}/></ScaleWrapper>;
  }
  return <ScaleWrapper><Lobby onJoin={handleJoin}/></ScaleWrapper>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<GameWrapper/>);
