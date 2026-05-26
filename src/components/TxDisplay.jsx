/* WDZ Online – components/TxDisplay.jsx */
import { FM, FO, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS } from "../game/constants.js";
import { IMG_BASE, toSlug, imgUrl } from "../utils/index.js";
import { fmtItems } from "../game/scoring.js";
import { btnS } from "./ui.jsx";
import React, { useState } from "react";

export function TxDisplay({tx,cf,onAccept,onReject,onRespond}) {
  var isFrom=tx.from===cf,isTo=tx.to===cf;
  var other=FM[isFrom?tx.to:tx.from]?FM[isFrom?tx.to:tx.from].nom:"";

  // Map bonus
  if(tx.type==="map_bonus") {
    var isWinner=tx.from===cf;
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #D4C870",background:"#FFFDF0",marginBottom:8}}>
      <div style={{fontSize:13,fontWeight:700,color:"#8B7714"}}>
        {isWinner
          ? "BONUS 300 $ za zdobycie wszystkich fragmentów mapy"
          : "WYDATEK: 100 $ dla rodziny "+(FM[tx.from]||{gen:tx.from}).gen+", która jako pierwsza zdobyła wszystkie fragmenty mapy"}
      </div>
    </div>);
  }

  // Fate
  if(tx.type==="fate") {
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #D4C4A8",background:"#FFF8E7",marginBottom:8}}>
      <div style={{fontSize:13,color:"#2E5B3C"}}><b>Ślepy los</b> – {tx.description}</div>
    </div>);
  }

  // Plot cost (wrong plot, auto-applied)
  if(tx.type==="penalty"||tx.type==="plot_cost") {
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #C09090",background:"#FFF0F0",marginBottom:8}}>
      <div style={{fontSize:13,color:"#8B2500"}}><b>DODATKOWY KOSZT</b> – {tx.description}</div>
    </div>);
  }

  // BnB settlement
  if(tx.type==="bnb_settle") {
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #D4C870",background:"#FFF8E7",marginBottom:8}}>
      <div style={{fontSize:13,color:"#8B7714"}}><b>BIZNES NA BOKU</b> – {tx.description}</div>
    </div>);
  }

  if(tx.type==="bnb_bonus") {
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #90C090",background:"#E8F5E8",marginBottom:8}}>
      <div style={{fontSize:13,color:"#2E5B3C"}}><b>BIZNES NA BOKU</b> – {tx.description}</div>
    </div>);
  }

  // Rewolwerowiec
  if(tx.type==="revolver") {
    var isWin=tx.to===cf;
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #C08060",background:"#FFF5F0",marginBottom:8}}>
      <div style={{fontSize:13,color:"#8B2500"}}><b>REWOLWEROWIEC</b> – {isWin?"Wygrana":"Przegrana"}: {tx.amount} $ (pole: {tx.field}) {isWin?("od "+(FM[tx.from]||{gen:tx.from}).gen):("dla "+(FM[tx.to]||{gen:tx.to}).gen)}</div>
    </div>);
  }

  // Consultation
  if(tx.type==="consultation_sold"||tx.type==="consultation_refund") {
    var isSold=tx.type==="consultation_sold";
    return (<div style={{padding:12,borderRadius:5,border:"1px solid "+(isSold?"#A0A0C0":"#A0C0A0"),background:isSold?"#F0F0FF":"#F0FFF0",marginBottom:8}}>
      <div style={{fontSize:13,color:isSold?"#2C1810":"#3D6B4A"}}><b>KONSULTACJA</b> – {tx.description}</div>
    </div>);
  }

  // Cancelled
  if(tx.status==="cancelled") {
    var dirL2=tx.type==="sale"?(isFrom?"SPRZEDAŻ":"ZAKUP"):"BARTER";
    return (<div style={{padding:12,borderRadius:5,border:"1px solid #C09090",background:"#FFF0F0",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontSize:14,fontWeight:700,color:"#8B2500"}}>
          <span style={{textTransform:"uppercase",letterSpacing:"1px",marginRight:6}}>{dirL2}</span>
          {isFrom?"→ ":"← "}{other}
        </span>
        <span style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",padding:"2px 6px",borderRadius:3,background:"#8B2500",color:"#fff"}}>Anulowana</span>
      </div>
      <div style={{fontSize:13,color:"#8B2500",lineHeight:1.5}}>
        {tx.type==="sale"&&<div><b>Towar:</b> {fmtItems(tx.offeredItems)} – <b>Cena:</b> {tx.price} $</div>}
        {tx.type==="barter"&&<div><b>Oferta:</b> {fmtItems(tx.offeredItems)}{tx.offeredCash>0?" + "+tx.offeredCash+" $":""}</div>}
        {tx.cancelReason&&<div style={{fontSize:12,color:"#A06040",fontStyle:"italic",marginTop:2}}>{tx.cancelReason}</div>}
      </div>
    </div>);
  }

  var sLabel="",sBg="#D4A853";
  if(tx.type==="sale"){
    if(tx.status==="pending"&&isTo){sLabel="Do akceptacji";sBg="#D4A853";}
    else if(tx.status==="pending"&&isFrom){sLabel="Oczekuje";sBg="#D4A853";}
    else if(tx.status==="accepted"){sLabel="Zrealizowana";sBg="#2E5B3C";}
    else{sLabel="Odrzucona";sBg="#8B2500";}
  } else {
    if(tx.status==="awaiting_response"&&isTo){sLabel="Kontr-oferta";sBg="#4A3B6B";}
    else if(tx.status==="awaiting_response"&&isFrom){sLabel="Czeka na odpowiedź";sBg="#D4A853";}
    else if(tx.status==="pending"&&isFrom){sLabel="Do akceptacji";sBg="#D4A853";}
    else if(tx.status==="pending"&&isTo){sLabel="Oczekuje";sBg="#D4A853";}
    else if(tx.status==="accepted"){sLabel="Zrealizowana";sBg="#2E5B3C";}
    else{sLabel="Odrzucona";sBg="#8B2500";}
  }
  var bgC=tx.status==="accepted"?"#E8F5E8":tx.status==="rejected"?"#FFF0F0":"#FFF8E7";
  // Direction label: ZAKUP or SPRZEDAŻ or BARTER
  var dirLabel="";
  if(tx.type==="sale"&&isFrom) dirLabel="SPRZEDAŻ";
  else if(tx.type==="sale"&&isTo) dirLabel="ZAKUP";
  else dirLabel="BARTER";

  return (<div style={{padding:12,borderRadius:5,border:"1px solid "+(tx.status==="accepted"?"#90C090":tx.status==="rejected"?"#C09090":"#D4C4A8"),background:bgC,marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <span style={{fontSize:14,fontWeight:700}}>
        <span style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",color:tx.type==="sale"?"#8B7355":"#4A3B6B",marginRight:6}}>{dirLabel}</span>
        {isFrom?"→ ":"← "}{other}
      </span>
      <span style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",padding:"2px 6px",borderRadius:3,background:sBg,color:"#fff"}}>{sLabel}</span>
    </div>
    <div style={{fontSize:14,color:"#5C4A3A",lineHeight:1.5}}>
      {tx.type==="sale"&&<div><b>Towar:</b> {fmtItems(tx.offeredItems)}<br/><b>Cena:</b> {tx.price} $</div>}
      {tx.type==="barter"&&<div>
        <b>Rodzina {(FM[tx.from]||{gen:tx.from}).gen} oferuje:</b> {fmtItems(tx.offeredItems)}{tx.offeredCash>0?" + "+tx.offeredCash+" $":""}
        {tx.responseItems&&<div><b>Rodzina {(FM[tx.to]||{gen:tx.to}).gen} w zamian:</b> {fmtItems(tx.responseItems)}{tx.responseCash>0?" + "+tx.responseCash+" $":""}</div>}
      </div>}
    </div>
    {tx.type==="sale"&&tx.status==="pending"&&isTo&&<div style={{display:"flex",gap:6,marginTop:8}}>
      <button style={btnS("success")} onClick={()=>onAccept(tx.id)}>Kupuję</button>
      <button style={btnS("danger")} onClick={()=>onReject(tx.id)}>Odrzucam</button>
    </div>}
    {tx.type==="barter"&&tx.status==="awaiting_response"&&isTo&&<div style={{marginTop:8}}>
      <button style={btnS("barter")} onClick={()=>onRespond(tx.id)}>Złóż kontr-ofertę</button>
    </div>}
    {tx.type==="barter"&&tx.status==="pending"&&isFrom&&tx.responseItems&&<div style={{display:"flex",gap:6,marginTop:8}}>
      <button style={btnS("success")} onClick={()=>onAccept(tx.id)}>Akceptuję</button>
      <button style={btnS("danger")} onClick={()=>onReject(tx.id)}>Odrzucam</button>
    </div>}
  </div>);
}

