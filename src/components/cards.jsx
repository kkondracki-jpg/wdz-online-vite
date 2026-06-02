/* WDZ Online – components/cards.jsx */
import { FM, C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB } from "../game/constants.js";
import { IMG_BASE, toSlug, imgUrl } from "../utils/index.js";
import React, { useState } from "react";

export function ResourceCard({item, note, selected, onClick, compact, isSheriff, textOnly}) {
  var hasPin=!!note, isBl=item.blind;
  var resSrc=imgUrl("res",item.name);
  const [imgOk,setImgOk]=useState(true);

  // Przypinka – tylko gdy note istnieje (zasób docelowy + notatka dziadka)
  var stickyNote=hasPin?(<div className="sticky-note">
    <svg className="sticky-pin" viewBox="0 0 24 24" width="18" height="18">
      <circle cx="12" cy="8" r="6" fill="#8B4513"/>
      <circle cx="12" cy="8" r="4.5" fill="#CD853F"/>
      <circle cx="12" cy="6.5" r="2" fill="#DEB887"/>
      <ellipse cx="12" cy="10" rx="3" ry="1" fill="rgba(0,0,0,0.15)"/>
    </svg>
    <div className="sticky-body">
      <img src={IMG_BASE+"biz_"+toSlug(note.forBiz)+".png"} className="sticky-biz" alt={note.forBiz}/>
      <div className="sticky-pct wt">{note.weight}%</div>
    </div>
  </div>):null;

  if(imgOk && !compact && !textOnly) {
    return (<div onClick={onClick} className={"cw"+(selected?" sel":"")} style={{cursor:onClick?"pointer":"default"}}>
      <img src={resSrc} className="ci" alt={item.name} onError={()=>setImgOk(false)}/>
      {selected&&<div style={{position:"absolute",top:4,right:6,fontSize:14,color:"#D4A853",fontWeight:700,textShadow:"0 0 3px #fff"}}>V</div>}
      {stickyNote}
    </div>);
  }

  var borderCol=hasPin?"#90A868":"#C4B090";
  var bgCol=selected?"#FFF8E7":hasPin?"#F8FAF4":"#FDFAF4";
  return (<div onClick={onClick} style={{borderRadius:"5px",position:"relative",border:selected?"2px solid #D4A853":"1px solid "+borderCol,background:bgCol,cursor:onClick?"pointer":"default",transition:"all 0.15s",overflow:"hidden"}}>
    <div style={{padding:compact?"8px 10px":"10px 12px"}}>
      {selected&&<span style={{position:"absolute",top:4,right:6,fontSize:13,color:"#D4A853",fontWeight:700}}>V</span>}
      <div style={{fontSize:compact?13:14,fontWeight:600,lineHeight:1.3,paddingRight:selected?16:0}}>{item.name}</div>
      <div style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#A08050",marginTop:3}}>ZASÓB</div>
    </div>
    {hasPin&&<div style={{background:"#EEF2E6",borderTop:"1px dashed #B0C090",padding:compact?"4px 10px":"6px 12px",fontSize:14,color:"#5A6B40"}}><b>{note.forBiz}</b> – <b>{note.weight}%</b></div>}
  </div>);
}

/* ========== COMPETENCY CARD ========== */
export function CompCard({item, note, selected, onClick, compact, isSheriff, textOnly}) {
  var hasPin=!!note, isBl=item.blind;
  var compSrc=imgUrl("comp",item.name);
  const [imgOk,setImgOk]=useState(!textOnly);

  // Przypinka – tylko gdy note istnieje (kompetencja docelowa + notatka dziadka)
  var stickyNote=hasPin?(<div className="sticky-note">
    <svg className="sticky-pin" viewBox="0 0 24 24" width="18" height="18">
      <circle cx="12" cy="8" r="6" fill="#8B4513"/>
      <circle cx="12" cy="8" r="4.5" fill="#CD853F"/>
      <circle cx="12" cy="6.5" r="2" fill="#DEB887"/>
      <ellipse cx="12" cy="10" rx="3" ry="1" fill="rgba(0,0,0,0.15)"/>
    </svg>
    <div className="sticky-body">
      <img src={IMG_BASE+"biz_"+toSlug(note.forBiz)+".png"} className="sticky-biz" alt={note.forBiz}/>
      <div className="sticky-pct wt">{note.weight}%</div>
    </div>
  </div>):null;

  if(imgOk && !compact && !textOnly) {
    return (<div onClick={onClick} className={"cw"+(selected?" sel":"")} style={{cursor:onClick?"pointer":"default"}}>
      <img src={compSrc} className="ci" alt={item.name} onError={()=>setImgOk(false)}/>
      {selected&&<div style={{position:"absolute",top:4,right:6,fontSize:14,color:"#D4A853",fontWeight:700,textShadow:"0 0 3px #fff"}}>V</div>}
      {stickyNote}
    </div>);
  }
  var borderCol=hasPin?"#7090B8":"#A0B4C4";
  var bgCol=selected?"#FFF8E7":hasPin?"#F4F6FA":"#F4F8FC";
  return (<div onClick={onClick} style={{borderRadius:"5px",position:"relative",border:selected?"2px solid #D4A853":"1px solid "+borderCol,background:bgCol,cursor:onClick?"pointer":"default",transition:"all 0.15s",overflow:"hidden"}}>
    <div style={{padding:compact?"8px 10px":"10px 12px"}}>
      {selected&&<span style={{position:"absolute",top:4,right:6,fontSize:13,color:"#D4A853",fontWeight:700}}>V</span>}
      <div style={{fontSize:compact?13:14,fontWeight:600,lineHeight:1.3,paddingRight:selected?16:0}}>{item.name}</div>
      {!compact&&item.author&&<div style={{fontSize:14,color:"#6090B0",fontStyle:"italic",marginTop:2,lineHeight:1.2}}>
        {item.author}: {"\u201e"}{item.title}{"\u201d"}
      </div>}
      <div style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:"#6090B0",marginTop:3}}>KOMPETENCJA</div>
    </div>
    {hasPin&&<div style={{background:"#E4EAF4",borderTop:"1px dashed #90A8C8",padding:compact?"4px 10px":"6px 12px",fontSize:14,color:"#40506B"}}><b>{note.forBiz}</b> – <b>{note.weight}%</b></div>}
  </div>);
}

/* ========== NOTE CARD ========== */
export function NoteCard({item, selected, onClick, type, textOnly, txBg}) {
  var isR=type==="res";
  var src=isR?imgUrl("note-res",item.name):imgUrl("note-comp",item.name);
  const [imgOk,setImgOk]=useState(!textOnly);
  if(imgOk && !textOnly) {
    return (<div onClick={onClick} className={"cw"+(selected?" sel":"")} style={{cursor:onClick?"pointer":"default"}}>
      <img src={src} className="ci" alt={item.name} onError={()=>setImgOk(false)}/>
      {selected&&<div style={{position:"absolute",top:4,right:6,fontSize:14,color:"#D4A853",fontWeight:700,textShadow:"0 0 3px #fff"}}>V</div>}
    </div>);
  }
  var accent=isR?"#A08050":"#6090B0";
  var bg=selected?"#FFF8E7":txBg||(isR?"#FFFCF6":"#F6F8FF");
  var border=selected?"#D4A853":isR?"#D4B896":"#96A8D4";
  return (<div onClick={onClick} style={{borderRadius:"5px",border:(selected?"2px":"1px")+" solid "+border,background:bg,padding:"8px 10px",cursor:onClick?"pointer":"default",transition:"all 0.15s",position:"relative"}}>
    {selected&&<span style={{position:"absolute",top:4,right:6,fontSize:13,color:"#D4A853",fontWeight:700}}>V</span>}
    <div style={{fontSize:14,fontWeight:600,lineHeight:1.3}}>{item.name}</div>
    <div style={{fontSize:14,textTransform:"uppercase",letterSpacing:"1px",fontWeight:700,color:accent,marginTop:2}}>INFORMACJA</div>
    <div style={{fontSize:14,color:accent,marginTop:2}}>{item.forBiz} – {item.weight}%</div>
  </div>);
}

