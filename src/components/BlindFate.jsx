/* WDZ Online – components/BlindFate.jsx */
import { FM, FO, BLIND_FATE_EVENTS } from "../game/constants.js";
import { IMG_BASE } from "../utils/index.js";
import { btnS, InfoPopup } from "./ui.jsx";
import { DiceSVG, DiceImg } from "./dice.jsx";
import React, { useState, useCallback, useRef, useEffect } from "react";

export function FateEventCard({sum, showEvent}) {
  const [imgOk,setImgOk]=useState(true);
  const [prevSrc,setPrevSrc]=useState(null);
  var ev=sum?BLIND_FATE_EVENTS[sum]:null;
  var fileName=showEvent&&sum?"los_"+String(sum).padStart(2,"0"):"los_01";
  var src=IMG_BASE+fileName+".png";
  // Track src changes for transition
  useEffect(()=>{if(showEvent&&sum){setPrevSrc(src);}},[showEvent,sum]);
  return (<div style={{width:"100%",height:"100%",borderRadius:6,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
    {imgOk&&<img src={src} style={{width:"100%",height:"100%",objectFit:"contain",display:"block",transition:"opacity 0.6s ease"}} alt={showEvent&&ev?ev.text:"Ślepy los"} onError={()=>setImgOk(false)}/>}
    {(!imgOk&&showEvent&&ev)&&<div style={{padding:16,textAlign:"center",width:"100%"}}>
      <div style={{fontSize:18,fontWeight:600,color:"#2C1810",lineHeight:1.5}}>{ev.text}</div>
      <div style={{fontSize:24,fontWeight:700,color:ev.amount>=0?"#2E5B3C":"#8B2500",marginTop:12}}>{ev.amount>=0?"+":""}{ev.amount} $</div>
    </div>}
    {(!imgOk&&!showEvent)&&<div style={{padding:24,textAlign:"center",color:"#51211B",fontSize:16,fontFamily:"'Aka Posse',serif"}}>Karta zakryta<br/><span style={{fontSize:12,color:"#A89070",fontStyle:"italic"}}>(oczekuje na losowanie)</span></div>}
  </div>);
}

/* ========== BLIND FATE FAMILY - 1200x604 LAYOUT ========== */
export function BlindFateFamily({fId, blindFate}) {
  var bf=blindFate[fId]||{}, policies=bf.policies||{p50:null,p100:null}, rolls=bf.rolls||[];
  var currentRollIdx=rolls.length>0?rolls.length-1:-1;
  var currentRoll=currentRollIdx>=0?rolls[currentRollIdx]:null;
  var showEvent=currentRoll&&currentRoll.resolved&&currentRoll.showCard;
  var activePolicy=currentRoll && !currentRoll.resolved ? currentRoll.policyUsed : null;
  const [bgOk,setBgOk]=useState(true);
  const [boardOk,setBoardOk]=useState(true);
  const [btnOk,setBtnOk]=useState(true);
  const [p50Ok,setP50Ok]=useState(true);
  const [p100Ok,setP100Ok]=useState(true);
  
  function fmtHistory(roll,idx){
    if(!roll.resolved)return null;
    var ev=BLIND_FATE_EVENTS[roll.sum];
    var polTxt=roll.policyUsed?" (polisa "+roll.policyUsed+"%)":"";
    var effectTxt="";
    if(roll.event&&roll.event.type==="loss_resources"){
      var pen=roll.policyUsed===100?0:roll.policyUsed===50?5:10;
      effectTxt=pen===0?"brak utraty zasobów":"utrata "+pen+"% zasobów";
    } else if(roll.netEffect!==undefined&&roll.netEffect!==null){
      effectTxt=roll.netEffect>=0?"+"+roll.netEffect+" $":roll.netEffect+" $";
    } else if(roll.event&&(roll.event.type==="loss"||roll.event.type==="gain")){
      effectTxt=(roll.event.amount>=0?"+":"")+roll.event.amount+" $";
    }
    return {idx:idx+1, dice:roll.dice1+"+"+roll.dice2+"="+roll.sum, text:ev?ev.text:"", effect:effectTxt, pol:polTxt};
  }
  
  var resolvedRolls = rolls.filter(r=>r.resolved).map((r,i)=>fmtHistory(r,i)).filter(Boolean);
  
  var showStaticDice = !currentRoll || (!currentRoll.rolling && !currentRoll.showDice && !currentRoll.showCard);
  var showRollingDice = currentRoll && currentRoll.rolling;
  var showResultDice = currentRoll && currentRoll.resolved && currentRoll.showDice && !currentRoll.showCard;
  var showSum = currentRoll && currentRoll.resolved && currentRoll.showCard;
  var showRollButton = currentRoll && currentRoll.diceReady && !currentRoll.resolved && !currentRoll.rolling;
  
  var staticD1 = 3, staticD2 = 4;
  var diceSize = 100;
  var diceGap = 10;
  
  // Policy status text
  function policyStatus(type){
    var st=policies[type];
    var isActive=(type==="p50"&&activePolicy===50)||(type==="p100"&&activePolicy===100);
    if(isActive)return "aktywna";
    if(st==="owned")return "w posiadaniu";
    if(st==="used")return "wykorzystana";
    return "nie wykupiona";
  }
  
  return (
    <div style={{width:1200,height:604,position:"relative",margin:"0 -16px"}}>
      {/* Background */}
      {bgOk && <img 
        src={IMG_BASE+"slepy-los_tlo.png"} 
        style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0}} 
        alt="" 
        onError={()=>setBgOk(false)}
      />}
      {!bgOk && <div style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",background:"linear-gradient(135deg,#4C130F 0%,#2A0A08 100%)",zIndex:0}}/>}
      
      {/* Content with padding 20px */}
      <div style={{position:"relative",zIndex:1,padding:20,width:"100%",height:"100%",boxSizing:"border-box"}}>
        {/* 3-column grid: 282 | 16gap | 564 | 16gap | 282 */}
        <div style={{display:"grid",gridTemplateColumns:"282px 564px 282px",gap:16,height:"100%"}}>
          
          {/* KOLUMNA 1 (lewa): polisy + historia */}
          <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
            
            {/* Polisa 50% */}
            <div style={{height:179,flexShrink:0,marginBottom:2,position:"relative"}}>
              {p50Ok && <img 
                src={IMG_BASE+"policy_50.png"} 
                style={{width:"100%",height:"100%",objectFit:"contain"}} 
                alt="Polisa 50%"
                onError={()=>setP50Ok(false)}
              />}
              {!p50Ok && <div style={{width:"100%",height:"100%",background:"#E8DCC8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Aka Posse',serif",fontSize:16,color:"#51211B"}}>polisa 50%</div>}
              <div style={{position:"absolute",left:"50%",bottom:"7%",transform:"translateX(-50%)",fontFamily:"'Aka Posse',serif",fontSize:18,color:"#000"}}>{policyStatus("p50")}</div>
            </div>
            
            {/* Polisa 100% */}
            <div style={{height:179,flexShrink:0,marginBottom:8,position:"relative"}}>
              {p100Ok && <img 
                src={IMG_BASE+"policy_100.png"} 
                style={{width:"100%",height:"100%",objectFit:"contain"}} 
                alt="Polisa 100%"
                onError={()=>setP100Ok(false)}
              />}
              {!p100Ok && <div style={{width:"100%",height:"100%",background:"#E8DCC8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Aka Posse',serif",fontSize:16,color:"#51211B"}}>polisa 100%</div>}
              <div style={{position:"absolute",left:"50%",bottom:"7%",transform:"translateX(-50%)",fontFamily:"'Aka Posse',serif",fontSize:18,color:"#000"}}>{policyStatus("p100")}</div>
            </div>
            
            {/* Historia - flex:1 wypełnia resztę */}
            <div style={{
              flex:1,
              background:"rgba(255,248,231,0.85)",
              padding:12,
              overflowY:"auto",
              minHeight:0
            }}>
              <div style={{fontSize:14,fontWeight:700,color:"#842504",marginBottom:8,fontFamily:"'Aka Posse',serif"}}>Historia losowań</div>
              {resolvedRolls.length===0 && <div style={{fontSize:14,color:"#A89070",fontStyle:"italic"}}>Brak losowań</div>}
              {resolvedRolls.map((h,i)=>(
                <div key={i} style={{fontSize:14,color:"#51211B",padding:"5px 0",borderBottom:"1px solid rgba(209,168,83,0.3)",lineHeight:1.5}}>
                  <b>Losowanie {h.idx}:</b> [{h.dice}] {h.effect}{h.pol}
                </div>
              ))}
            </div>
          </div>
          
          {/* KOLUMNA 2 (środek): plansza 564x564 */}
          <div style={{position:"relative",width:564,height:564}}>
            {boardOk && <img 
              src={IMG_BASE+"plansza_slepy-los.png"} 
              style={{width:"100%",height:"100%",objectFit:"contain"}} 
              alt="Plansza Ślepy Los"
              onError={()=>setBoardOk(false)}
            />}
            {!boardOk && <div style={{width:"100%",height:"100%",background:"rgba(76,19,15,0.8)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:"80%",height:"80%",border:"4px solid #842504",borderRadius:"50%"}}/>
            </div>}
            
            {/* Dice container - centered */}
            <div style={{
              position:"absolute",
              top:"50%",
              left:"50%",
              transform:"translate(-50%,-50%)",
              display:"flex",
              gap:diceGap,
              alignItems:"center",
              justifyContent:"center"
            }}>
              {showStaticDice && <>
                <DiceImg value={staticD1} variant="light" rolling={false} size={diceSize}/>
                <DiceImg value={staticD2} variant="dark" rolling={false} size={diceSize}/>
              </>}
              {showRollingDice && <>
                <DiceImg value={1} variant="light" rolling={true} size={diceSize}/>
                <DiceImg value={1} variant="dark" rolling={true} size={diceSize}/>
              </>}
              {showResultDice && <>
                <DiceImg value={currentRoll.dice1} variant="light" rolling={false} size={diceSize}/>
                <DiceImg value={currentRoll.dice2} variant="dark" rolling={false} size={diceSize}/>
              </>}
              {showSum && <div style={{textAlign:"center"}}>
                <div style={{fontSize:64,fontWeight:700,color:"#FFF",textShadow:"0 2px 8px rgba(0,0,0,0.5)",fontFamily:"'Aka Posse',serif"}}>{currentRoll.sum}</div>
                <div style={{fontSize:18,color:"#FFF8E7",marginTop:4}}>{currentRoll.dice1} + {currentRoll.dice2}</div>
                <div style={{marginTop:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#FFF",marginBottom:4}}>ROZLICZENIE:</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#FFF",textShadow:"0 2px 6px rgba(0,0,0,0.5)"}}>{currentRoll.netEffectText}</div>
                  {currentRoll.policyUsed&&currentRoll.event&&currentRoll.event.type!=="gain"&&currentRoll.event.type!=="gain_policy"&&
                    <div style={{fontSize:12,color:"#FFF8E7",marginTop:4}}>Polisa zmniejsza stratę o {currentRoll.policyUsed}%</div>}
                </div>
              </div>}
            </div>
            
            {/* Roll button */}
            {showRollButton && <div style={{
              position:"absolute",
              left:"50%",
              bottom:"calc(15% + 100px)",
              transform:"translateX(-50%)"
            }}>
              <div className="roll-btn-wrap" data-roll={fId+"-"+currentRollIdx}>
                {btnOk && <img 
                  src={IMG_BASE+"rzut_koscmi.png"} 
                  style={{height:40,width:"auto",display:"block",cursor:"pointer"}} 
                  alt="Rzuć kośćmi"
                  onError={()=>setBtnOk(false)}
                />}
                {!btnOk && <button data-roll={fId+"-"+currentRollIdx} style={{
                  fontSize:14,
                  padding:"10px 24px",
                  background:"#842504",
                  color:"#fff",
                  border:"none",
                  cursor:"pointer",
                  fontFamily:"inherit",
                  fontWeight:600
                }}>Rzuć kośćmi</button>}
              </div>
            </div>}
            
            {/* Waiting message */}
            {currentRoll&&!currentRoll.diceReady&&!currentRoll.resolved&&<div style={{
              position:"absolute",
              left:"50%",
              bottom:"10%",
              transform:"translateX(-50%)",
              background:"rgba(255,248,231,0.9)",
              padding:"8px 16px",
              fontSize:13,
              color:"#51211B",
              fontStyle:"italic"
            }}>Szeryf przygotowuje losowanie...</div>}
          </div>
          
          {/* KOLUMNA 3 (prawa): karta zdarzenia 282x564 */}
          <div style={{width:282,height:564}}>
            <FateEventCard sum={currentRoll?currentRoll.sum:null} showEvent={!!showEvent}/>
          </div>
          
        </div>
      </div>
    </div>
  );
}

