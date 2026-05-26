/* WDZ Online – components/Revolver.jsx */
import { FM, FO } from "../game/constants.js";
import { IMG_BASE, getRevImg } from "../utils/index.js";
import { btnS } from "./ui.jsx";
import React, { useState, useEffect, useRef, useMemo } from "react";

export function RewolwerowiecNew({rc,familyId,duelTimer,revSubmitShots,revDuels,getRevTimer}){
  var isPlayer=rc&&(rc.familyA===familyId||rc.familyB===familyId);
  var isA=rc&&rc.familyA===familyId;
  var myAmmo=rc?(isA?rc.ammoA:rc.ammoB):50;
  var myShots=rc?(isA?rc.shotsA:rc.shotsB):null;
  var oppShots=rc?(isA?rc.shotsB:rc.shotsA):null;
  var isActive=rc&&rc.status==="playing";
  var canInput=isActive&&myShots===null;
  var shotsDeclared=isActive&&myShots!==null;
  var isFinished=rc&&rc.status==="finished";
  
  // Timer po zakończeniu pojedynku (5s)
  var [postFinishTimer,setPostFinishTimer]=useState(0);
  var [showPostFinish,setShowPostFinish]=useState(false);
  
  useEffect(()=>{
    if(isFinished&&!showPostFinish){
      setPostFinishTimer(5);
      var interval=setInterval(()=>{
        setPostFinishTimer(t=>{
          if(t<=1){clearInterval(interval);setShowPostFinish(true);return 0;}
          return t-1;
        });
      },1000);
      return ()=>clearInterval(interval);
    }
    if(!isFinished&&!rc){setShowPostFinish(false);setPostFinishTimer(0);}
  },[isFinished,rc]);
  
  // Filtruj pojedynki danej rodziny
  var myDuels=(revDuels||[]).filter(d=>d.familyA===familyId||d.familyB===familyId);
  
  // Oblicz sumy
  var totalWon=0,totalLost=0;
  myDuels.forEach(d=>{
    var won=d.winner===familyId;
    var amt=Math.round(d.bet*(d.winField==="wygrana"?1:d.winField==="dominacja"?2/3:1/3));
    if(d.winner){
      if(won)totalWon+=amt;else totalLost+=amt;
    }
  });
  var balance=totalWon-totalLost;
  
  // Pozycje pól planszy (X) i mapowanie bulletPos
  var BOARD_FIELDS=[
    {x:105,pos:-3,img:"WYGRANA"},{x:270,pos:-2,img:"DOMINACJA"},{x:435,pos:-1,img:"PRZEWAGA"},
    {x:600,pos:0,img:"POJEDYNEK"},
    {x:765,pos:1,img:"PRZEWAGA"},{x:930,pos:2,img:"DOMINACJA"},{x:1095,pos:3,img:"WYGRANA"}
  ];
  
  // Stan inputu nabojów
  var [shotInput,setShotInput]=useState(1);
  var minShots=myAmmo>0?1:0; // Minimum 1 nabój, wyjątek gdy gracz ma 0 amunicji
  
  // Funkcja hold dla +/-
  var holdRef=useRef(null);
  function startHold(delta){
    if(!canInput)return;
    setShotInput(v=>Math.max(minShots,Math.min(myAmmo,v+delta)));
    holdRef.current=setInterval(()=>setShotInput(v=>Math.max(minShots,Math.min(myAmmo,v+delta))),120);
  }
  function stopHold(){if(holdRef.current){clearInterval(holdRef.current);holdRef.current=null;}}
  
  // Reset inputu gdy nowa runda
  useEffect(()=>{if(canInput)setShotInput(myAmmo>0?1:0);},[canInput,myAmmo]);
  
  // AmmoGrid dla nowego UI
  function AmmoGridNew({ammo}){
    var ammoImg=getRevImg("NABOJ_AMMO");
    var rows=[];
    for(var r=0;r<5;r++){
      var cols=[];
      for(var c=0;c<10;c++){
        var idx=r*10+c;var alive=idx<ammo;
        cols.push(ammoImg?
          <div key={c} style={{width:14,height:28,transition:"all 0.3s",opacity:alive?1:0.15}}><img src={ammoImg} style={{width:14,height:28,objectFit:"contain"}} alt=""/></div>
          :<div key={c} style={{width:14,height:28,borderRadius:3,background:alive?"#A75F4A":"#E8E0D0",border:"1px solid "+(alive?"rgba(0,0,0,0.2)":"#D4C4A8"),transition:"all 0.3s",opacity:alive?1:0.3}}/>
        );
      }
      rows.push(<div key={r} style={{display:"flex",gap:2,marginBottom:2}}>{cols}</div>);
    }
    return <div>{rows}</div>;
  }
  
  // Styl tekstu Aka Posse
  var akaStyle=function(px,color){return{fontFamily:"'Aka Posse',serif",fontSize:px,color:color||"#51211B",textTransform:"uppercase"};};
  
  return(
  <div style={{position:"relative",width:1200,height:770,margin:"0 -16px",overflow:"hidden"}}>
    {/* TŁO */}
    <img src={IMG_BASE+"Rew_0-background.png"} alt="" style={{position:"absolute",width:1200,height:770,left:0,top:0,zIndex:0}}/>
    
    {/* PLANSZA - 7 pól */}
    {BOARD_FIELDS.map((f,i)=>(
      <img key={i} src={getRevImg(f.img)} alt={f.img} style={{position:"absolute",left:f.x,bottom:500,width:160,height:160,zIndex:1,border:rc&&rc.bulletPos===f.pos?"3px solid #8B2500":"none",boxSizing:"border-box",transform:"translate(-50%,50%)"}}/>
    ))}
    
    {/* NABÓJ NA PLANSZY */}
    {rc&&rc.status!=="betting"&&(()=>{
      var bulletField=BOARD_FIELDS.find(f=>f.pos===rc.bulletPos);
      if(!bulletField)return null;
      return(
        <img src={getRevImg("NABOJ_ZNACZNIK")} alt="nabój" style={{position:"absolute",left:bulletField.x,bottom:500,width:50,height:50,zIndex:5,filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.5))",transition:"left 0.6s ease-in-out",transform:"translate(-50%,50%)"}}/>
      );
    })()}
    
    {/* SYMBOLE RODZIN */}
    {rc&&rc.status!=="betting"&&<>
      <img src={IMG_BASE+"rew_"+rc.familyA+".png"} alt={rc.familyA} style={{position:"absolute",left:105,bottom:644,width:100,zIndex:2,transform:"translate(-50%,50%)"}}/>
      <img src={IMG_BASE+"rew_"+rc.familyB+".png"} alt={rc.familyB} style={{position:"absolute",left:1095,bottom:644,width:100,zIndex:2,transform:"translate(-50%,50%)"}}/>
    </>}
    
    {/* LICZNIKI OBSTAWIONYCH NABOJÓW */}
    {rc&&rc.status!=="betting"&&<>
      <div style={{position:"absolute",left:203,bottom:648,zIndex:3,...akaStyle(36),textAlign:"center",transform:"translate(-50%,50%)"}}>
        {rc.status==="playing"&&rc.timerPhase==="declaration"?"0":rc.shotsA!==null?rc.shotsA:"0"}
      </div>
      <div style={{position:"absolute",left:997,bottom:648,zIndex:3,...akaStyle(36),textAlign:"center",transform:"translate(-50%,50%)"}}>
        {rc.status==="playing"&&rc.timerPhase==="declaration"?"0":rc.shotsB!==null?rc.shotsB:"0"}
      </div>
    </>}
    
    {/* STAWKA */}
    {rc&&rc.status!=="betting"&&(
      <div style={{position:"absolute",left:600,bottom:370,zIndex:3,...akaStyle(29),transform:"translate(-50%,50%)"}}>
        STAWKA: {rc.bet} $
      </div>
    )}
    
    {/* AMUNICJA - siatka */}
    <div style={{position:"absolute",left:149,bottom:230,zIndex:3,transform:"translate(-50%,50%)"}}>
      <AmmoGridNew ammo={rc?myAmmo:50}/>
    </div>
    
    {/* AMUNICJA - napis */}
    <div style={{position:"absolute",left:149,bottom:350,zIndex:3,...akaStyle(16),transform:"translate(-50%,50%)"}}>
      WASZA AMUNICJA: {rc?myAmmo:50}/50
    </div>
    
    {/* ZEGAR */}
    {rc&&isActive&&rc.timerPhase&&duelTimer>0&&(
      <div style={{position:"absolute",left:1052.5,bottom:202,zIndex:3,...akaStyle(38,"#D7B56D"),transform:"translate(-50%,50%)"}}>
        {duelTimer} S
      </div>
    )}
    
    {/* NAPISY CZASOWE */}
    {rc&&isActive&&rc.timerPhase&&duelTimer>0&&(
      <div style={{position:"absolute",left:1052.5,bottom:352,zIndex:3,...akaStyle(25),transform:"translate(-50%,50%)",whiteSpace:"nowrap"}}>
        {rc.timerPhase==="declaration"?"CZAS NA DECYZJĘ:":"KOLEJNA TURA ZA:"}
      </div>
    )}
    
    {/* WYBÓR NABOJÓW - przyciski i input */}
    <img src={IMG_BASE+"Rew_minus.png"} alt="-" style={{position:"absolute",left:360,bottom:210,width:50,height:50,zIndex:4,cursor:canInput?"pointer":"not-allowed",opacity:canInput?1:0.5,transform:"translate(-50%,50%)"}} onMouseDown={()=>startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={()=>startHold(-1)} onTouchEnd={stopHold}/>
    <div style={{position:"absolute",left:450,bottom:210,zIndex:4,width:80,textAlign:"center",transform:"translate(-50%,50%)",...akaStyle(49,shotsDeclared?"#C00000":"#51211B")}}>
      {canInput?shotInput:(myShots!==null?myShots:0)}
    </div>
    <img src={IMG_BASE+"Rew_plus.png"} alt="+" style={{position:"absolute",left:540,bottom:210,width:50,height:50,zIndex:4,cursor:canInput?"pointer":"not-allowed",opacity:canInput?1:0.5,transform:"translate(-50%,50%)"}} onMouseDown={()=>startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={()=>startHold(1)} onTouchEnd={stopHold}/>
    <img src={IMG_BASE+"Rew_zatwierdz.png"} alt="Zatwierdź" style={{position:"absolute",left:450,bottom:135,width:100,height:30.3,zIndex:4,transform:"translate(-50%,50%)",cursor:canInput?"pointer":"not-allowed",opacity:canInput?1:0.5}} onClick={()=>{if(canInput)revSubmitShots(familyId,shotInput);}}/>
    
    {/* POLE PRZEBIEGU ROZGRYWKI */}
    <div style={{position:"absolute",left:740,bottom:190,width:244,height:130,zIndex:3,background:"rgba(255,255,255,0.85)",border:"1px solid #51211B",borderRadius:4,overflow:"auto",padding:6,transform:"translate(-50%,50%)"}}>
      {/* Lista zakończonych pojedynków */}
      {myDuels.length>0&&<>
        {myDuels.map((d,i)=>{
          var won=d.winner===familyId;
          var opp=d.familyA===familyId?d.familyB:d.familyA;
          return(
            <div key={i} style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,marginBottom:2,color:won?"#2E5B3C":"#842504"}}>
              Pojedynek {i+1}: {won?"Wygrali":"Przegrali"} - {FM[opp].nom}, stawka: {d.bet} $
            </div>
          );
        })}
        <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,marginBottom:6,marginTop:4,color:"#51211B",borderTop:"1px solid #51211B",paddingTop:4}}>
          Wygrane: +{totalWon} $, przegrane: -{totalLost} $, bilans: {balance>=0?"+":""}{balance} $
        </div>
      </>}
      
      {/* Brak aktywnego pojedynku */}
      {!rc&&(
        <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,color:"#8B7355",fontStyle:"italic"}}>
          Oczekiwanie na rozpoczęcie pojedynku przez Szeryfa...
        </div>
      )}
      
      {/* Pojedynek w fazie betting */}
      {rc&&rc.status==="betting"&&(
        <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,color:"#8B7355",fontStyle:"italic"}}>
          Oczekiwanie na rozpoczęcie pojedynku przez Szeryfa...
        </div>
      )}
      
      {/* Aktywny pojedynek - rundy */}
      {rc&&rc.status!=="betting"&&<>
        {(rc.rounds||[]).map((r,i)=><React.Fragment key={i}>
          <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,marginBottom:2,color:"#51211B"}}>
            Oddano: {isA?r.shotsA:r.shotsB} strzałów
          </div>
          <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,marginBottom:4,color:(isA?(r.winner==="A"):(r.winner==="B"))?"#2E5B3C":r.winner==="draw"?"#8B7355":"#842504"}}>
            RUNDA {i+1}: {(isA?(r.winner==="A"):(r.winner==="B"))?"→ WYGRYWASZ":r.winner==="draw"?"= REMIS":"→ PRZEGRYWASZ"}
          </div>
        </React.Fragment>)}
        
        {/* Oczekiwanie na przeciwnika */}
        {shotsDeclared&&!isFinished&&(
          <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,color:"#8B7355",fontStyle:"italic"}}>
            Oddano: {myShots} strzałów – oczekiwanie na przeciwnika...
          </div>
        )}
        
        {/* Koniec pojedynku - zawsze widoczny gdy status=finished */}
        {isFinished&&<>
          <div style={{...akaStyle(16,"#8B2500"),marginTop:8}}>KONIEC POJEDYNKU!</div>
          {rc.winner&&<div style={{...akaStyle(16),color:FM[rc.winner].col}}>WYGRYWA: {FM[rc.winner].nom.toUpperCase()} ({rc.winField})</div>}
          {showPostFinish&&(
            <div style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:10,color:"#8B7355",fontStyle:"italic",marginTop:8}}>
              Oczekiwanie na rozpoczęcie kolejnego pojedynku...
            </div>
          )}
        </>}
      </>}
    </div>
    
  </div>);
}

