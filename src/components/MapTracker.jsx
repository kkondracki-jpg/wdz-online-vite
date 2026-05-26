/* WDZ Online – components/MapTracker.jsx */
import { FM, C_MAP } from "../game/constants.js";
import { IMG_BASE, mapImgUrl } from "../utils/index.js";
import { btnS } from "./ui.jsx";
import React, { useState } from "react";

/* ========== MAP PUZZLE – FRAGMENT IMAGE ========== */
export function MapFragImg({n, size}) {
  const [imgOk,setImgOk]=useState(true);
  var s=size||120;
  return imgOk
    ?<img src={mapImgUrl(n)} style={{width:"100%",height:"auto",display:"block"}} alt={"Fragment "+n} onError={()=>setImgOk(false)}/>
    :<div style={{height:s,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#A09020",background:"#EDE8B0"}}>{n}</div>;
}

/* ========== MAP TRACKER (full width) ========== */
export function MapTracker({items, mapBonusClaimed, fId, mapLayout, setMapLayout, onClaim, readonly}) {
  const [dragOver,setDragOver]=useState(null);
  var frags=items.filter(i=>i.cat===C_MAP);
  var uniqueNrs=[...new Set(frags.map(f=>f.fragNr))];
  var myFrag=fId?FM[fId].mapFrag:null;
  var ownFragCount=myFrag?frags.filter(f=>f.fragNr===myFrag).length:0;
  var forSale=Math.max(0,ownFragCount-1); // -1 = oryginał niezbywalny
  var layout=(mapLayout&&fId&&mapLayout[fId])||[0,0,0,0];
  var claimed=!!(mapBonusClaimed&&fId&&mapBonusClaimed[fId]);
  var winnerFam=null;
  if(mapBonusClaimed){Object.keys(mapBonusClaimed).forEach(fk=>{if(mapBonusClaimed[fk])winnerFam=fk;});}
  var mapScore=Math.min(10, uniqueNrs.length*2 + (claimed&&uniqueNrs.length===4?2:0));
  // Validate layout: slots 0–3 must be [4,3,2,1]
  var isCorrect=layout[0]===4&&layout[1]===3&&layout[2]===2&&layout[3]===1;
  var allFour=layout.indexOf(0)<0&&[...new Set(layout)].length===4;
  var canClaim=allFour&&isCorrect&&!claimed&&!winnerFam&&fId&&!readonly;

  function handleDragStart(e,fromIdx){
    e.dataTransfer.setData("fromIdx",String(fromIdx));
  }
  function handleDragOver(e,toIdx){
    e.preventDefault();
    setDragOver(toIdx);
  }
  function handleDragLeave(e,toIdx){
    setDragOver(prev=>prev===toIdx?null:prev);
  }
  function handleDrop(e,toIdx){
    e.preventDefault();
    setDragOver(null);
    var fromIdx=parseInt(e.dataTransfer.getData("fromIdx"),10);
    if(isNaN(fromIdx)||fromIdx===toIdx)return;
    setMapLayout(prev=>{
      var lay=[...(prev[fId]||[0,0,0,0])];
      var tmp=lay[fromIdx];
      lay[fromIdx]=lay[toIdx];
      lay[toIdx]=tmp;
      return {...prev,[fId]:lay};
    });
  }

  return (<>
    {/* Nagłówek – obrazek */}
    <img src={IMG_BASE+"naglowek_zyla.png"} style={{maxWidth:820,width:"100%",height:"auto",display:"block",marginBottom:8,marginLeft:"auto",marginRight:"auto"}} alt="Złotodajna Żyła"/>
    {/* Status – czcionka jak Majątek */}
    <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:12,fontSize:18,color:"#51211B"}}>
      <span>Liczba punktów: <b>{mapScore}</b> <span style={{color:"#6B5A4A"}}>(max 10)</span></span>
      <span>Posiadane fragmenty mapy: <b>{uniqueNrs.length}/5</b></span>
      {fId&&<span>Fragmenty mapy na sprzedaż: <b>{forSale}/3</b></span>}
    </div>
    {/* === PLANSZA Z TŁEM (gracz) === */}
    {fId&&<div style={{position:"relative",width:1200,height:750,margin:"0 -16px",overflow:"hidden"}}>
      <img src={IMG_BASE+"zlotodajna_zyla_tlo.png"} style={{position:"absolute",width:1200,height:750,left:0,top:0,zIndex:0}} alt=""/>
      {/* Komunikat instrukcyjny – 2 wiersze */}
      {!claimed&&!readonly&&!winnerFam&&!canClaim&&
        <div style={{position:"absolute",left:600,top:671,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:20,color:"#51211B",textAlign:"center",zIndex:2,lineHeight:1.5,whiteSpace:"nowrap",width:"max-content"}}>
          <div>Ułóż z pomocą myszki fragmenty mapy we właściwej kolejności.</div>
          <div>Gdy pojawi się przycisk „ZATWIERDŹ" kliknij w niego, aby uzyskać premię.</div>
        </div>
      }
      {/* Slot szeryfa (slot 5) – pozycja 1, zablokowany */}
      <div style={{position:"absolute",left:33,top:393,width:222,height:222,zIndex:1,background:"transparent"}}>
        {claimed?<MapFragImg n={5}/>:<img src={IMG_BASE+"zloto_5.png"} style={{width:"100%",height:"auto",display:"block"}} alt="Fragment 5"/>}
      </div>
      {/* Sloty 0-3 – draggable */}
      {layout.map((fragNr,i)=>{
        var posX=[261,489,717,945][i];
        var isEmpty=fragNr===0;
        var isDragOver=dragOver===i;
        return <div key={i}
          draggable={!isEmpty&&!claimed&&!readonly}
          onDragStart={!isEmpty&&!claimed&&!readonly?e=>handleDragStart(e,i):null}
          onDragOver={!claimed&&!readonly?e=>handleDragOver(e,i):null}
          onDragLeave={!claimed&&!readonly?e=>handleDragLeave(e,i):null}
          onDrop={!claimed&&!readonly?e=>handleDrop(e,i):null}
          style={{position:"absolute",left:posX,top:393,width:222,height:222,zIndex:1,
            cursor:(!isEmpty&&!claimed&&!readonly)?"grab":"default",
            background:"transparent",
            outline:isDragOver?"3px solid #D4A853":"none",
            transition:"outline 0.15s"}}
        >
          {isEmpty&&<img src={IMG_BASE+"zloto_1-4.png"} style={{width:"100%",height:"auto",display:"block"}} alt="Pusty slot"/>}
          {!isEmpty&&<MapFragImg n={fragNr}/>}
        </div>;
      })}
      {/* Przycisk Zatwierdź – obrazek */}
      {canClaim&&<div style={{position:"absolute",left:600,top:671.5,transform:"translate(-50%,-50%)",zIndex:2,cursor:"pointer"}} onClick={()=>onClaim&&onClaim(fId)}>
        <img src={IMG_BASE+"zyla_zatwierdz.png"} style={{display:"block",height:"auto"}} alt="Zatwierdź"/>
      </div>}
      {/* Komunikat – zwycięzca */}
      {winnerFam&&winnerFam===fId&&
        <div style={{position:"absolute",left:600,top:671,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:20,textAlign:"center",zIndex:2,lineHeight:1.5,whiteSpace:"nowrap",width:"max-content"}}>
          <div style={{color:"#51211B"}}>Wszystkie fragmenty mapy jako pierwsza ułożyła rodzina {FM[winnerFam].gen}!</div>
          <div style={{color:"#2E7D32"}}>Gratulacje! Premia 300 $ trafia na konto Waszej rodziny!</div>
        </div>
      }
      {/* Komunikat – przegrani */}
      {winnerFam&&winnerFam!==fId&&
        <div style={{position:"absolute",left:600,top:671,transform:"translate(-50%,-50%)",fontFamily:"'Aka Posse',serif",fontSize:20,textAlign:"center",zIndex:2,lineHeight:1.5,whiteSpace:"nowrap",width:"max-content"}}>
          <div style={{color:"#51211B"}}>Wszystkie fragmenty mapy jako pierwsza ułożyła rodzina {FM[winnerFam].gen}!</div>
          <div style={{color:"#C00"}}>Premia 300 $ trafia do rodziny {FM[winnerFam].gen}. Wpłacacie 100 $ na rzecz zwycięzcy.</div>
        </div>
      }
    </div>}
    {/* Szeryf / widok bez fId – statyczny */}
    {!fId&&<div style={{display:"flex",gap:3,marginBottom:12}}>
      {[4,3,2,1].map(n=>{
        var have=uniqueNrs.indexOf(n)>=0;
        return <div key={n} style={{flex:1,overflow:"hidden",border:have?"none":"2px solid #D4C4A8",background:"transparent",opacity:have?1:0.3}}>
          <MapFragImg n={n}/>
        </div>;
      })}
      <div style={{flex:1,overflow:"hidden",border:winnerFam?"none":"3px solid #D4A853",background:"transparent",opacity:winnerFam?1:0.3}}>
        <MapFragImg n={5}/>
      </div>
    </div>}
    {/* Napis dla widoku szeryfa (bez fId) */}
    {!fId&&winnerFam&&<div style={{marginTop:6,padding:8,textAlign:"center"}}>
      <div style={{fontSize:18,fontWeight:700,color:"#842504",letterSpacing:"0.5px"}} className="wt">
        Wszystkie fragmenty mapy jako pierwsza ułożyła rodzina {FM[winnerFam].gen}!
      </div>
    </div>}
  </>);
}

