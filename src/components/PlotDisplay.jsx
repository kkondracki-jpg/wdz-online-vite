/* WDZ Online – components/PlotDisplay.jsx */
import { FM } from "../game/constants.js";
import { IMG_BASE, mapImgUrl } from "../utils/index.js";
import React, { useState, useRef, useEffect } from "react";

export function PlotDisplay({plots, familyId, plotOk}) {
  var f=FM[familyId];
  const [displayedPlotNr,setDisplayedPlotNr]=useState(null);
  const prevPlotNrsRef=useRef(new Set());
  const containerRef=useRef(null);
  const [cw,setCw]=useState(800);
  useEffect(function(){
    function measure(){if(containerRef.current){setCw(containerRef.current.offsetWidth);}}
    measure();
    window.addEventListener("resize",measure);
    return function(){window.removeEventListener("resize",measure);};
  },[]);
  useEffect(function(){
    var currentNrs=new Set(plots.map(function(p){return p.plotNr;}));
    var prevNrs=prevPlotNrsRef.current;
    var newNrs=Array.from(currentNrs).filter(function(nr){return !prevNrs.has(nr);});
    if(newNrs.length>0){setDisplayedPlotNr(newNrs[newNrs.length-1]);}
    else if(displayedPlotNr!==null&&!currentNrs.has(displayedPlotNr)&&plots.length>0){setDisplayedPlotNr(plots[0].plotNr);}
    else if(displayedPlotNr===null&&plots.length>0){setDisplayedPlotNr(plots[0].plotNr);}
    prevPlotNrsRef.current=currentNrs;
  },[plots]);
  if(plots.length===0||displayedPlotNr===null) return null;
  var hasPlot=function(nr){return plots.some(function(p){return p.plotNr===nr;});};
  var SEAL_TOP={1:"23.43%",4:"42.32%",6:"61.11%",20:"80%"};
  var bottomText=plotOk
    ?"Pozyskali\u015Bcie dzia\u0142k\u0119 nr "+f.tPlot+", kt\u00F3ra najlepiej nadaje si\u0119 do prowadzenia Waszego biznesu."
    :"UWAGA! Pozostaj\u0105c na niew\u0142a\u015Bciwej dzia\u0142ce ponosicie na koniec gry dodatkowy koszt w wysoko\u015Bci 50 $.";
  var sc=cw/1200;
  return (<div ref={containerRef} style={{width:"100%",marginBottom:12}}>
    <div style={{display:"flex",gap:"0.42%"}}>
      <div style={{position:"relative",width:"66.25%",paddingBottom:"41.25%"}}>
        <img src={IMG_BASE+"dzialka_tlo-1.png"} style={{position:"absolute",left:0,top:0,width:"100%",height:"100%"}} alt=""/>
        <img src={IMG_BASE+"dzialka_"+displayedPlotNr+".png"} style={{position:"absolute",left:0,top:0,width:"100%",height:"100%"}} alt={"Dzia\u0142ka "+displayedPlotNr}/>
        <div style={{position:"absolute",left:"45.91%",bottom:"23%",fontFamily:"'Aka Posse',sans-serif",fontSize:26.51*sc,color:"#925C24"}}>{"rodziny "+f.gen.toUpperCase()}</div>
      </div>
      <div style={{position:"relative",width:"33.33%",paddingBottom:"41.25%"}}>
        <img src={IMG_BASE+"dzialka_tlo-2.png"} style={{position:"absolute",left:0,top:0,width:"100%",height:"100%"}} alt=""/>
        {[1,4,6,20].map(function(nr){
          if(!hasPlot(nr)) return null;
          var isActive=nr!==displayedPlotNr;
          return (<img key={nr} src={IMG_BASE+"dzialka_pieczec_"+(isActive?"aktywna":"nieaktywna")+".png"}
            style={{position:"absolute",left:"50%",top:SEAL_TOP[nr],width:"14.25%",height:"10.91%",transform:"translate(-50%,-50%)",cursor:isActive?"pointer":"default"}}
            onClick={isActive?function(){setDisplayedPlotNr(nr);}:undefined}
            alt={(isActive?"Poka\u017C":"Wy\u015Bwietlana")+" dzia\u0142ka nr "+nr}/>);
        })}
      </div>
    </div>
    <div style={{position:"relative",width:"100%",marginTop:"0.42%",paddingBottom:"6.67%"}}>
      <img src={IMG_BASE+"dzialka_tlo-3.png"} style={{position:"absolute",left:0,top:0,width:"100%",height:"100%"}} alt=""/>
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:500,fontSize:22.63*sc,color:"#51211B",whiteSpace:"nowrap"}}>{bottomText}</span>
      </div>
    </div>
  </div>);
}

