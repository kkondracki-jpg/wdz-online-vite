/* WDZ Online – components/ui.jsx */
import { IMG_BASE } from "../utils/index.js";
import React, { useState } from "react";

export function ConnectionIndicator({online}){
  return(<div style={{position:"fixed",bottom:8,left:8,zIndex:999,display:"flex",alignItems:"center",gap:5,background:online?"rgba(46,91,60,0.9)":"rgba(139,37,0,0.9)",color:"#fff",padding:"4px 10px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
    <div style={{width:8,height:8,borderRadius:"50%",background:online?"#90EE90":"#FF6B6B",boxShadow:online?"0 0 4px #90EE90":"0 0 4px #FF6B6B"}}/>
    {online?"Połączono":"Brak połączenia"}
  </div>);
}

export function StarRating({value, onChange, disabled}) {
  return (<div style={{display:"inline-flex",gap:2}}>
    {[1,2,3,4,5].map(n=>(
      <span key={n} onClick={()=>!disabled&&onChange&&onChange(n)} style={{cursor:disabled?"default":"pointer",fontSize:20,color:n<=value?"#D4A853":"#A89070",transition:"color 0.15s",userSelect:"none"}}>{n<=value?"★":"\u2606"}</span>
    ))}
  </div>);
}

export function btnS(v,dis) {
  var b={padding:"10px 18px",borderRadius:"4px",border:"none",fontSize:"14px",fontWeight:700,cursor:dis?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"0.3px",transition:"all 0.15s",opacity:dis?0.5:1};
  var m={primary:{background:"#D4A853",color:"#4C130F"},success:{background:"#5B7674",color:"#fff"},danger:{background:"#842504",color:"#fff"},barter:{background:"#5E5971",color:"#fff"},sheriff:{background:"#B14A2A",color:"#fff"},fate:{background:"#842504",color:"#fff"},warning:{background:"#C07820",color:"#fff"},secondary:{background:"#8B7355",color:"#fff"}};
  return Object.assign({},b,m[v]||{background:"#E8E0D0",color:"#2C1810"});
}

export function InfoPopup({title, children, wide, icon}) {
  const [open, setOpen] = useState(false);
  var iconFile = (icon||"ikona_instrukcje")+".png";
  return (<>
    <img onClick={()=>setOpen(true)} src={IMG_BASE+iconFile} style={{width:22,height:22,cursor:"pointer",marginLeft:8,verticalAlign:"middle",userSelect:"none",flexShrink:0}} alt="?"/>
    {open&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setOpen(false)}>
      {wide?<div style={{position:"relative",maxWidth:"90vw",maxHeight:"80vh"}} onClick={e=>e.stopPropagation()}>
        <div onClick={()=>setOpen(false)} style={{position:"absolute",top:-12,right:-12,width:28,height:28,borderRadius:"50%",background:"#4C130F",color:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,fontWeight:700,lineHeight:1,boxShadow:"0 2px 8px rgba(0,0,0,0.4)",zIndex:1}}>✕</div>
        <div style={{maxWidth:"90vw",maxHeight:"80vh",overflow:"hidden"}}>{children}</div>
      </div>
      :<div style={{background:"#FFF",borderRadius:8,padding:24,maxWidth:520,width:"90%",maxHeight:"80vh",overflowY:"auto",position:"relative",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        <div onClick={()=>setOpen(false)} style={{position:"absolute",top:10,right:14,cursor:"pointer",fontSize:22,color:"#8B7355",fontWeight:700,lineHeight:1}}>✕</div>
        {title&&<div style={{fontSize:18,fontWeight:700,color:"#842504",marginBottom:12,paddingRight:30}} className="wt">{title}</div>}
        <div style={{fontSize:14,lineHeight:1.7,color:"#2C1810"}}>{children}</div>
      </div>}
    </div>}
  </>);
}

export function TaskHeader({imgName, fallbackText}) {
  const [imgOk, setImgOk] = useState(true);
  return (<div style={{marginBottom:6}}>
    {imgOk 
      ? <img src={IMG_BASE+imgName+".png"} style={{width:"100%",height:"auto",display:"block"}} alt={fallbackText} onError={()=>setImgOk(false)}/>
      : <div style={{fontSize:24,fontWeight:700,letterSpacing:"1.5px",color:"#842504",borderBottom:"2px solid #842504",paddingBottom:4,textAlign:"center"}} className="wt">{fallbackText}</div>
    }
  </div>);
}
