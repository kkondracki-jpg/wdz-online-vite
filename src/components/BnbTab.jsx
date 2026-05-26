/* WDZ Online – components/BnbTab.jsx */
import { FM, FO, C_BNB, BNB_PRODUCTS } from "../game/constants.js";
import { IMG_BASE, toSlug } from "../utils/index.js";
import React, { useState } from "react";

export var BNB_SLOT_ORDER={
  adams:["bennet","clinton","dexter"],
  bennet:["adams","clinton","dexter"],
  clinton:["adams","bennet","dexter"],
  dexter:["adams","bennet","clinton"]
};
var BNB_PLURAL={adams:"flakon\u00F3w",bennet:"kwater",clinton:"obligacji",dexter:"voucher\u00F3w"};
export var BNB_SLOT_X=["8.08%","40.31%","72.58%"];
export function BnbTab({familyId, sold, total, familyData}) {
  var allBnb=familyData.items.filter(function(i){return i.cat===C_BNB;});
  var bought={};allBnb.filter(function(i){return i.bnbOrigin!==familyId;}).forEach(function(i){bought[i.bnbOrigin]=(bought[i.bnbOrigin]||0)+1;});
  var slots=BNB_SLOT_ORDER[familyId];
  return(<div style={{position:"relative",width:1200,margin:"0 -16px"}}>
    <img src={IMG_BASE+"bnb_tlo-"+familyId+".png"} style={{width:"100%",height:"auto",display:"block"}} alt="Biznes na boku"/>
    <div style={{position:"absolute",left:"16.33%",bottom:"17.25%",transform:"translate(-50%,50%)",fontFamily:"'Alegreya Sans',sans-serif",fontWeight:600,fontSize:26.17,color:"#5B7674"}}>{sold+"/"+total}</div>
    {slots.map(function(origin,idx){
      var count=bought[origin]||0;
      return(<div key={origin} style={{position:"absolute",left:BNB_SLOT_X[idx],bottom:"1.88%",fontSize:21.56,color:"#842504",whiteSpace:"nowrap"}}>
        <span style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:600}}>{"W posiadaniu: "}</span>
        <span style={{fontFamily:"'Alegreya Sans',sans-serif",fontWeight:400}}>{count+" "+BNB_PLURAL[origin]}</span>
      </div>);
    })}
  </div>);
}

