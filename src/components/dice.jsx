/* WDZ Online – components/dice.jsx */
import { IMG_BASE } from "../utils/index.js";
import React, { useState, useEffect } from "react";

/* SVG Dice - Western Style */
export function DiceSVG({value, variant, rolling, size}) {
  var sz = size || 120;
  var isLight = variant === "light";
  // Colors based on WDZ palette
  var bgGrad = isLight 
    ? {start:"#FFF8E7", end:"#E8DCC8"} 
    : {start:"#5C3D2E", end:"#3A2518"};
  var dotColor = isLight ? "#4C130F" : "#D4A853";
  var borderColor = isLight ? "#A89070" : "#2C1810";
  var shadowColor = isLight ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)";
  
  // Dot positions (percentage based)
  var dotPatterns = {
    1: [[50,50]],
    2: [[28,28],[72,72]],
    3: [[28,28],[50,50],[72,72]],
    4: [[28,28],[72,28],[28,72],[72,72]],
    5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]]
  };
  var dots = dotPatterns[value] || [];
  var dotR = sz * 0.09;
  var gradId = "diceGrad_"+variant+"_"+(value||0);
  
  return (
    <div className={"dice-svg-wrap"+(rolling?" rolling":"")} style={{width:sz,height:sz}}>
      <svg width={sz} height={sz} viewBox={"0 0 "+sz+" "+sz}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={bgGrad.start}/>
            <stop offset="100%" stopColor={bgGrad.end}/>
          </linearGradient>
          <filter id="diceShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor={shadowColor}/>
          </filter>
        </defs>
        <rect x="4" y="4" width={sz-8} height={sz-8} rx={sz*0.12} ry={sz*0.12} 
          fill={"url(#"+gradId+")"} stroke={borderColor} strokeWidth="2" filter="url(#diceShadow)"/>
        {dots.map((d,i) => (
          <circle key={i} cx={d[0]/100*sz} cy={d[1]/100*sz} r={dotR} fill={dotColor}>
            <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={(i*0.05)+"s"} fill="freeze"/>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* Dice component using PNG images */
export function DiceImg({value, variant, rolling, size}) {
  const [imgOk,setImgOk]=useState(true);
  var sz = size || 120;
  var isLight = variant === "light";
  var fileName = isLight ? "dice_light_" : "dice_dark_";
  var src = IMG_BASE + fileName + value + ".png";
  
  return (
    <div className={"dice-svg-wrap"+(rolling?" rolling":"")} style={{width:sz,height:sz}}>
      {imgOk && <img 
        src={src} 
        style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}} 
        alt={"Kość "+value}
        onError={()=>setImgOk(false)}
      />}
      {!imgOk && <DiceSVG value={value} variant={variant} rolling={false} size={sz}/>}
    </div>
  );
}

