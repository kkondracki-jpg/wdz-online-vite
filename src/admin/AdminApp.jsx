/* WDZ Admin v1.1.0 – AdminApp.jsx
 * Migrated from wdz-admin-v1_0_1.html to Vite ES modules.
 * Zero logic changes – only import/export adaptation.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FM, FO, G_TASKS, C_RES, C_COMP, C_PLOT, C_MAP, C_BNB, STAGES, BNB_PRODUCTS } from "../game/constants.js";
import { ensureArray, toSlug } from "../utils/index.js";
import { calcScore, calcRelationScore } from "../game/scoring.js";
import { generateRoomCode } from "../firebase/config.js";
import { db, auth, firebase } from "./firebase-init.js";
import { jsPDF } from "jspdf";
import "jspdf-autotable";


/* ===== generateTrainerPDF – raport trenerski (PDF) ===== */
async function generateTrainerPDF(data) {
  var doc = new jsPDF({orientation: "portrait", unit: "mm", format: "a4"});
  var ML = 20, MR = 20, MT = 20, PW = 210 - 40, PAGE_H = 297, FOOTER_Y = 282, Y = MT;
  var COL = {
    primary:[132,37,4], dark:[76,19,15], gold:[212,168,83], text:[44,24,16],
    textDim:[107,90,74], white:[255,255,255], bg:[245,240,232], line:[212,196,168],
    green:[46,91,60], red:[192,64,48],
    families:{adams:[167,95,74],bennet:[114,96,114],clinton:[94,89,113],dexter:[91,118,116]}
  };
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
  var logoH=12;
  try{var lr=await fetch((data.imgBase||"img/")+"alegra_logotyp_kolorowy.png");if(lr.ok){var lb=await lr.blob();var l64=await new Promise(function(res){var rd=new FileReader();rd.onload=function(){res(rd.result);};rd.readAsDataURL(lb);});doc.addImage(l64,"PNG",ML,Y,30,0);}}catch(e){}
  setF("bold",20);setC(COL.dark);doc.text("Wschód Dzikiego Zachodu",ML+34,Y+logoH*0.65);
  Y+=logoH+4;
  setF("normal",11);setC(COL.textDim);doc.text("Raport z rozgrywki",ML,Y);Y+=10;
  doc.setDrawColor(COL.line[0],COL.line[1],COL.line[2]);doc.setFillColor(COL.bg[0],COL.bg[1],COL.bg[2]);
  var infoArr=["Kod: "+rc];if(meta.createdAt)infoArr.push("Data: "+new Date(meta.createdAt).toLocaleDateString("pl"));
  var infoArr2=[];if(meta.client)infoArr2.push("Klient: "+meta.client);if(meta.group)infoArr2.push("Grupa: "+meta.group);
  var boxH=infoArr2.length?18:12;doc.roundedRect(ML,Y,PW,boxH,2,2,"FD");
  setF("normal",11);setC(COL.text);doc.text(infoArr.join("     |     "),ML+4,Y+5);
  if(infoArr2.length)doc.text(infoArr2.join("     |     "),ML+4,Y+11);
  Y+=boxH+8;
  hd("Wyniki");
  if(ranked.length>0){setF("bold",12);setC(COL.green);doc.text("Zwycięzca: "+FM[ranked[0]].nom+" \u2013 "+Math.round(totals[ranked[0]]||0)+" pkt",ML,Y);Y+=8;}
  var rH=[["","Wynik","Zasoby\n/30","Kompetencje\n/25","Działka\n/10","Gotówka\n/25","Żyła\n/10","BnB","Relacje\n/20"]];
  var rR=ranked.map(function(f){var s=scores[f]||{};return[FM[f].nom,Math.round(totals[f]||0)+" pkt",s.resScore+" ("+(s.resPct||0)+"%)",s.compScore+" ("+(s.compPct||0)+"%)",s.plotScore||0,s.cashScore+" ("+(s.cash||0)+"$)",s.mapScore||0,s.bnb||0,relScores[f]||0];});
  doc.autoTable({startY:Y,head:rH,body:rR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:8},columnStyles:{0:{halign:"left",fontStyle:"bold"},1:{fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===0){var f=ranked[d2.row.index];if(f&&COL.families[f])d2.cell.styles.textColor=COL.families[f];}}});
  Y=doc.lastAutoTable.finalY+8;
  hd("Macierz handlu");
  var tradeTx=txs.filter(function(t){return t&&t.status==="accepted"&&FO.includes(t.from)&&FO.includes(t.to)&&(t.type==="sale"||t.type==="barter");});
  if(tradeTx.length>0){
    var mH=[["Od \\ Do"].concat(FO.map(function(f){return FM[f].nom;}))];
    var mR=FO.map(function(from){var cells=FO.map(function(to){if(from===to)return"\u2013";var it=0,ca=0;tradeTx.forEach(function(tx){if(tx.from===from&&tx.to===to){it+=(tx.offeredItems||tx.offerItems||[]).length;ca+=(tx.offeredCash||tx.offerCash||0);}if(tx.to===from&&tx.from===to){it+=(tx.requestItems||tx.responseItems||[]).length;ca+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0);}});if(it===0&&ca===0)return"\u2013";return(it>0?it+"k":"")+(it>0&&ca>0?" + ":"")+(ca>0?ca+"$":"");});return[FM[from].nom].concat(cells);});
    doc.autoTable({startY:Y,head:mH,body:mR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center",valign:"middle"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold",fontSize:9},columnStyles:{0:{halign:"left",fontStyle:"bold"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+4;bt("Legenda: k = liczba kart, $ = gotówka przekazana w transakcji",{size:8,color:COL.textDim});
  } else { bt("Brak zaakceptowanych transakcji."); }
  Y+=4;
  hd("Statystyki transakcji");
  var ps={};txs.forEach(function(t){if(!t||!t.from||!t.to||!FO.includes(t.from)||!FO.includes(t.to))return;if(t.type!=="sale"&&t.type!=="barter")return;var k=[t.from,t.to].sort().join("-");if(!ps[k])ps[k]={a:0,r:0};if(t.status==="accepted")ps[k].a++;else if(t.status==="rejected")ps[k].r++;});
  var pk=Object.keys(ps);
  if(pk.length>0){
    var pH=[["Para","Zaakceptowane","Odrzucone","Łącznie"]];
    var pR=pk.map(function(k){var p=k.split("-"),d=ps[k];return[FM[p[0]].nom+" \u2013 "+FM[p[1]].nom,d.a,d.r,d.a+d.r];});
    var ta=pk.reduce(function(s,k){return s+ps[k].a;},0),tr=pk.reduce(function(s,k){return s+ps[k].r;},0);
    pR.push(["RAZEM",ta,tr,ta+tr]);
    doc.autoTable({startY:Y,head:pH,body:pR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.row.index===pR.length-1)d2.cell.styles.fontStyle="bold";}});
    Y=doc.lastAutoTable.finalY+8;
  } else { bt("Brak transakcji."); Y+=4; }
  hd("Relacje");
  var anyRel=false;FO.forEach(function(rater){if(rels[rater])FO.forEach(function(rated){if(rater!==rated&&rels[rater][rated])anyRel=true;});});
  if(anyRel){
    var rlH=[["Od rodziny "+ARROW+"Dla rodziny","Partnerstwo","Zasady","Komunikacja","Suma /15"]];var rlR=[];
    FO.forEach(function(rater){FO.forEach(function(rated){if(rater===rated)return;var r=rels[rater]&&rels[rater][rated];if(!r)return;var tot=(r.partnership||0)+(r.rules||0)+(r.communication||0);rlR.push([FM[rater].nom+" "+ARROW+" "+FM[rated].nom,r.partnership||0,r.rules||0,r.communication||0,tot]);});});
    doc.autoTable({startY:Y,head:rlH,body:rlR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  } else { bt("Brak danych o relacjach."); Y+=4; }
  hd("Ślepy Los");
  var anyFate=false;
  FO.forEach(function(fId){var bfd=bf[fId];if(!bfd||!bfd.rolls)return;var rolls=(Array.isArray(bfd.rolls)?bfd.rolls:Object.values(bfd.rolls)).filter(function(r){return r&&r.resolved;});if(!rolls.length)return;anyFate=true;chk(12+rolls.length*6);setF("bold",10);setC(COL.families[fId]||COL.text);doc.text(FM[fId].nom+":",ML,Y);Y+=5;rolls.forEach(function(r){var ev=r.event||{};var eff=r.netEffectText||(ev.amount?(ev.amount>0?"+":"")+ev.amount+" $":"brak efektu");setF("normal",10);setC(COL.text);var ln="    Wynik "+(r.sum||"?")+" \u2013 "+(ev.text||"\u2013")+" "+ARROW+" "+eff;var wr=doc.splitTextToSize(ln,PW-8);doc.text(wr,ML+4,Y);Y+=wr.length*4.5;});Y+=3;});
  if(!anyFate){bt("Brak rzutów.");Y+=4;}
  if(data.bnbEnabled&&fd){
    hd("Biznes na Boku");
    var bH=[["Rodzina","Produkt","Sprzedano","Kupiono od innych"]];
    var bR=FO.map(function(fId){var items=(fd[fId]||{}).items||[];if(!Array.isArray(items))items=Object.values(items);var bnbAll=items.filter(function(i){return i.cat===C_BNB;});var prod=BNB_PRODUCTS[fId];var ownLeft=bnbAll.filter(function(i){return i.bnbOrigin===fId||i.name===prod.name;}).length;var sold=prod.qty-ownLeft;var bought=bnbAll.filter(function(i){return i.bnbOrigin!==fId&&i.name!==prod.name;}).length;return[FM[fId].nom,prod.shortName,sold+"/"+prod.qty,bought];});
    doc.autoTable({startY:Y,head:bH,body:bR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"},1:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  }
  if(data.mapEnabled&&fd){
    hd("Złotodajna Żyła");
    var mbc=data.mapBonusClaimed||{};var mw=null;FO.forEach(function(f){if(mbc[f])mw=f;});
    var zpH=[["Rodzina","Fragmenty mapy","Bonus pkt","Rozliczenie"]];
    var zpR=FO.map(function(fId){var items=(fd[fId]||{}).items||[];if(!Array.isArray(items))items=Object.values(items);var fs2={};items.forEach(function(i){if(i.cat===C_MAP)fs2[i.fragNr]=true;});var cnt=Object.keys(fs2).length;var sc=scores[fId]||{};var sett=mw===fId?"+300 $":(mw?"-100 $":"0 $");return[FM[fId].nom,cnt+"/4",sc.mapScore+"/10",sett];});
    doc.autoTable({startY:Y,head:zpH,body:zpR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},columnStyles:{0:{halign:"left"}},alternateRowStyles:{fillColor:[250,245,238]},didParseCell:function(d2){if(d2.section==="body"&&d2.column.index===3){var v=d2.cell.raw;if(v&&v.includes("+"))d2.cell.styles.textColor=COL.green;else if(v&&v.includes("-"))d2.cell.styles.textColor=COL.red;}}});
    Y=doc.lastAutoTable.finalY+4;
    if(mw)bt("Zwycięzca wyścigu: "+FM[mw].nom+" (premia 300 $, pozostali wpłacają 100 $)",{style:"bold",size:10});
    else bt("Brak zwycięzcy wyścigu \u2013 nikt nie zebrał kompletnej mapy lub remis.",{size:10,color:COL.textDim});
    Y+=4;
  }
  if(data.revEnabled&&revDuels.length>0){
    hd("Rewolwerowiec");
    var rvH=[["Nr","Wyzywający","Przeciwnik","Stawka","Zwycięzca"]];
    var rvR=revDuels.filter(function(d){return d;}).map(function(d,i){return[i+1,(FM[d.challenger]||{}).nom||"?",(FM[d.opponent]||{}).nom||"?",(d.bet||0)+" $",(FM[d.winner]||{}).nom||"?"];});
    doc.autoTable({startY:Y,head:rvH,body:rvR,margin:{left:ML,right:MR},styles:{font:FONT,fontSize:9,cellPadding:2,halign:"center"},headStyles:{fillColor:COL.dark,textColor:COL.white,fontStyle:"bold"},alternateRowStyles:{fillColor:[250,245,238]}});
    Y=doc.lastAutoTable.finalY+8;
  }
  var tp=doc.internal.getNumberOfPages();
  for(var p=1;p<=tp;p++){doc.setPage(p);setF("normal",8);setC(COL.textDim);doc.text("Strona "+p+" / "+tp,210-MR,FOOTER_Y+5,{align:"right"});doc.text("aleGRA Twórczy Rozwój \u2013 Wschód Dzikiego Zachodu\u00A9 Online",105,FOOTER_Y+5,{align:"center"});}
  var ds=meta.createdAt?new Date(meta.createdAt).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
  doc.save("wdz-raport-"+rc+"-"+ds+".pdf");
}


/* ===== STAŁE ===== */
const C = {
  bg:      "#1A0A08",
  panel:   "#2C1810",
  card:    "#3A2218",
  border:  "#5C3828",
  gold:    "#D4A853",
  goldDim: "#A07830",
  text:    "#F5F0E8",
  textDim: "#C4A880",
  textMut: "#8B6A50",
  red:     "#842504",
  redDark: "#4C130F",
  green:   "#3D6B4A",
  greenLt: "#5B9B6A",
};

/* ===== HELPERS ===== */
/* generateRoomCode, toSlug, ensureArray – imported from shared modules */

function formatDate(ts) {
  if (!ts) return "–";
  const d = new Date(ts);
  return d.toLocaleDateString("pl-PL", {day:"2-digit",month:"2-digit",year:"numeric"})
    + " " + d.toLocaleTimeString("pl-PL", {hour:"2-digit",minute:"2-digit"});
}

function statusLabel(status) {
  const map = {lobby:"Lobby", playing:"W toku", finished:"Zakończona", expired:"Wygasła"};
  return map[status] || status || "Nieznany";
}

function statusColor(status) {
  if (status === "playing")  return C.gold;
  if (status === "finished") return C.greenLt;
  if (status === "expired")  return C.textMut;
  return C.textDim;
}

/* ===== KOMPONENTY UI ===== */
function Btn({children, onClick, variant="primary", disabled, small, style={}}) {
  const variants = {
    primary:  {background:C.gold,    color:C.redDark, fontWeight:700},
    danger:   {background:C.red,     color:"#fff",    fontWeight:700},
    ghost:    {background:"transparent", color:C.textDim, border:"1px solid "+C.border},
    dark:     {background:C.panel,   color:C.textDim, border:"1px solid "+C.border},
  };
  const base = {
    padding: small ? "6px 14px" : "10px 22px",
    fontSize: small ? 13 : 15,
    borderRadius: 4,
    border: "none",
    letterSpacing: 0.3,
    transition: "opacity .15s",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    ...variants[variant],
    ...style,
  };
  return <button onClick={onClick} disabled={disabled} style={base}>{children}</button>;
}

function Card({children, style={}}) {
  return <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:8, padding:20, ...style}}>{children}</div>;
}

function Badge({children, color}) {
  return <span style={{background:color+"22", color, border:"1px solid "+color+"55", borderRadius:12, padding:"2px 10px", fontSize:12, fontWeight:700}}>{children}</span>;
}

function Input({label, value, onChange, type="text", placeholder, autoFocus, onKeyDown, disabled}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label && <label style={{fontSize:12,color:C.textMut,letterSpacing:1,textTransform:"uppercase"}}>{label}</label>}
      <input
        type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown} disabled={disabled}
        style={{background:C.panel, border:"1px solid "+C.border, borderRadius:4, padding:"10px 14px",
          color:C.text, fontSize:15, outline:"none", width:"100%"}}
      />
    </div>
  );
}

function ErrBox({msg}) {
  if (!msg) return null;
  return <div style={{background:"#5C150822",border:"1px solid #C06040",borderRadius:4,padding:"8px 14px",fontSize:13,color:"#E08060",marginTop:8}}>{msg}</div>;
}

/* ===== EKRAN LOGOWANIA ===== */
function LoginScreen({onLogin}) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [resetSent, setResetSent] = useState(false);

  function handleLogin() {
    if (!email.trim() || !password) { setError("Wpisz email i hasło."); return; }
    if (!auth) { setError("Brak połączenia z Firebase."); return; }
    setLoading(true); setError(null);
    auth.signInWithEmailAndPassword(email.trim(), password)
      .then(cred => {
        setLoading(false);
        // Weryfikacja roli owner w bazie
        db.ref("admins/" + cred.user.uid).once("value").then(snap => {
          if (snap.val() === true) {
            onLogin(cred.user);
          } else {
            auth.signOut();
            setError("To konto nie ma dostępu do panelu administracyjnego.");
          }
        });
      })
      .catch(e => {
        setLoading(false);
        var msg = "Błąd logowania.";
        if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential")
          msg = "Nieprawidłowy email lub hasło.";
        else if (e.code === "auth/invalid-email") msg = "Nieprawidłowy format adresu email.";
        else if (e.code === "auth/too-many-requests") msg = "Zbyt wiele prób. Spróbuj za chwilę.";
        setError(msg);
      });
  }

  function handleForgotPassword() {
    if (!email.trim()) { setError("Wpisz najpierw adres email."); return; }
    auth.sendPasswordResetEmail(email.trim())
      .then(() => { setResetSent(true); setError(null); })
      .catch(e => {
        if (e.code === "auth/user-not-found") setError("Nie znaleziono konta dla tego adresu.");
        else if (e.code === "auth/invalid-email") setError("Nieprawidłowy format adresu email.");
        else setError("Nie udało się wysłać linku resetującego.");
      });
  }

  return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#4C130F 0%,#300904 50%,#4C130F 100%)", padding:20}}>
      <div style={{width:"100%", maxWidth:560}}>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16}}>
          <img src="img/alegra_logotyp.png" alt="aleGRA" style={{height:120, width:"auto"}}/>
          <div style={{marginTop:22, textAlign:"center"}}>
            <div style={{fontSize:32, fontWeight:900, color:"#D4A853", letterSpacing:1, fontFamily:"'Alegreya Sans',sans-serif", lineHeight:1.1}}>Wschód Dzikiego Zachodu<sup style={{fontSize:16,fontWeight:400}}>©</sup> Online</div>
            <div style={{fontSize:14, color:"#C4B090", marginTop:2}}>Panel administracyjny</div>
          </div>
          <div style={{fontSize:13, color:"#8B7355", marginTop:10}}>v1.0.1</div>
        </div>

        <div style={{background:"#FDFAF4", border:"1px solid #D4C4A8", borderRadius:8, padding:20}}>
          <div style={{fontSize:20, fontWeight:700, color:"#2C1810", marginBottom:16, fontFamily:"'Alegreya Sans',sans-serif"}}>Zaloguj się</div>
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <div>
              <label style={{fontSize:12, color:"#8B7355", letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:4}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus
                onKeyDown={e=>{ if(e.key==="Enter") handleLogin(); }}
                style={{width:"100%", padding:"10px 14px", border:"1px solid #D4C4A8", borderRadius:4, fontSize:15, background:"#fff", color:"#2C1810", outline:"none"}}/>
            </div>
            <div>
              <label style={{fontSize:12, color:"#8B7355", letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:4}}>Hasło</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") handleLogin(); }}
                style={{width:"100%", padding:"10px 14px", border:"1px solid #D4C4A8", borderRadius:4, fontSize:15, background:"#fff", color:"#2C1810", outline:"none"}}/>
            </div>
            <button onClick={handleLogin} disabled={loading}
              style={{background:"#842504", color:"#fff", border:"none", borderRadius:4, padding:"12px 20px", fontSize:15, fontWeight:700, cursor:loading?"wait":"pointer", opacity:loading?0.7:1}}>
              {loading ? "Logowanie…" : "Zaloguj się"}
            </button>
            {resetSent
              ? <div style={{fontSize:13, color:"#3D6B4A", textAlign:"center"}}>Link resetujący wysłany na podany adres.</div>
              : <span onClick={handleForgotPassword} style={{fontSize:12, color:"#8B7355", cursor:"pointer",
                  textDecoration:"underline", textAlign:"center"}}>Zapomniałem hasła</span>
            }
            {error && <div style={{background:"#FEE", border:"1px solid #C88", borderRadius:4, padding:"8px 14px", fontSize:13, color:"#8B2500"}}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== WIDOK: LISTA ROZGRYWEK ===== */
function RoomsView({onOpenReport}) {
  const [rooms, setRooms]   = useState([]);
  const [tickets, setTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!db) return;
    // Load tickets to cross-reference sheriffCode (jednorazowy odczyt)
    db.ref("tickets").once("value").then(snap => {
      if(!snap.exists()){setTickets({});return;}
      var map={};
      snap.forEach(child => {
        var t=child.val();
        if(t.roomCode) map[t.roomCode] = t.sheriffCode || "";
      });
      setTickets(map);
    });
    var ref = db.ref("rooms");
    var cb = ref.on("value", snap => {
      setLoading(false);
      if (!snap.exists()) { setRooms([]); return; }
      var arr = [];
      snap.forEach(child => {
        var meta = child.val()?.meta || {};
        var players = child.val()?.players || {};
        var familyCount = ["adams","bennet","clinton","dexter"]
          .filter(f => players[f] && Object.keys(players[f]?.members||{}).length > 0).length;
        arr.push({
          code: child.key,
          status: meta.status || "unknown",
          created: meta.created,
          familyCount,
          sheriffOnline: players.sheriff?.connected === true,
        });
      });
      arr.sort((a,b) => (b.created||0) - (a.created||0));
      setRooms(arr);
    });
    return () => { ref.off("value", cb); };
  }, []);

  function deleteRoom(code) {
    setDeleting(code);
    db.ref("rooms/" + code).remove()
      .then(()=>setDeleting(null))
      .catch(e=>{setDeleting(null);alert("Błąd usuwania: "+e.message);});
  }

  function deleteAllRooms() {
    setConfirmClear(false);
    db.ref("rooms").remove()
      .catch(e=>alert("Błąd usuwania: "+e.message));
  }

  if (loading) return <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Ładowanie rozgrywek…</div>;
  if (rooms.length === 0) return (
    <div style={{color:C.textMut, padding:40, textAlign:"center"}}>
      Brak rozgrywek w bazie.
    </div>
  );

  return (
    <div>
      {/* Nagłówek z licznikiem i przyciskiem czyszczenia */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{fontSize:13, color:C.textMut}}>Łącznie: {rooms.length} rozgrywek</div>
        {confirmClear
          ? <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span style={{fontSize:13, color:C.textMut}}>Na pewno usunąć wszystkie?</span>
              <Btn small variant="danger" onClick={deleteAllRooms}>Tak, usuń wszystkie</Btn>
              <Btn small variant="ghost" onClick={()=>setConfirmClear(false)}>Anuluj</Btn>
            </div>
          : <Btn small variant="danger" onClick={()=>setConfirmClear(true)}>Usuń wszystkie rozgrywki</Btn>
        }
      </div>

      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {rooms.map(r => (
          <Card key={r.code} style={{display:"flex", alignItems:"center", gap:16, padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:180}}>
              <div style={{fontFamily:"monospace", fontSize:18, fontWeight:900, color:C.gold, letterSpacing:3}}>
                {tickets[r.code] || r.code}
              </div>
              <span onClick={()=>{navigator.clipboard.writeText(tickets[r.code]||r.code);}} style={{cursor:"pointer",fontSize:11,color:C.textMut,textDecoration:"underline"}}>kopiuj</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12, color:C.textMut}}>{formatDate(r.created)}</div>
            </div>
            <div style={{display:"flex", gap:10, alignItems:"center"}}>
              {r.sheriffOnline && <Badge color={C.gold}>Szeryf online</Badge>}
              <Badge color={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
              <span style={{fontSize:13, color:C.textDim}}>{r.familyCount}/4 rodzin</span>
              <Btn small variant="dark" onClick={()=>onOpenReport(r.code)}>Raport →</Btn>
              <Btn small variant="danger" disabled={deleting===r.code}
                onClick={e=>{e.stopPropagation();deleteRoom(r.code);}}>
                {deleting===r.code ? "…" : "Usuń"}
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== WIDOK: TRENERZY ===== */
function TrainersView({trainers, onSave, onDelete, onToggle}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState(null);

  function handleAdd() {
    if (!name.trim()) { setErr("Wpisz imię i nazwisko trenera."); return; }
    if (!email.trim()) { setErr("Wpisz adres email trenera."); return; }
    if (trainers.find(t => t.email.toLowerCase() === email.trim().toLowerCase())) { setErr("Trener z tym emailem już istnieje."); return; }
    setSaving(true); setErr(null);
    onSave({name: name.trim(), email: email.trim()}).then(() => {
      setSaving(false); setName(""); setEmail(""); setShowForm(false);
    }).catch(e => { setSaving(false); setErr(e.message); });
  }

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{fontSize:13, color:C.textMut}}>Łącznie: {trainers.length} trenerów</div>
        <Btn small onClick={() => { setShowForm(!showForm); setErr(null); }}>
          {showForm ? "Anuluj" : "+ Dodaj trenera"}
        </Btn>
      </div>

      {showForm && (
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:16, fontWeight:700, color:C.gold, marginBottom:14}}>Nowy trener</div>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <Input label="Imię i nazwisko" value={name} onChange={setName} autoFocus
              onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("trainer-email-input")?.focus(); }}/>
            <div>
              <label style={{fontSize:12,color:C.textMut,letterSpacing:1,textTransform:"uppercase",display:"block",marginBottom:5}}>Email</label>
              <input id="trainer-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") handleAdd(); }}
                style={{background:C.panel,border:"1px solid "+C.border,borderRadius:4,padding:"10px 14px",
                  color:C.text,fontSize:15,outline:"none",width:"100%"}}/>
            </div>
            <Btn onClick={handleAdd} disabled={saving}>{saving ? "Zapisuję…" : "Zapisz trenera"}</Btn>
            <ErrBox msg={err}/>
          </div>
        </Card>
      )}

      {trainers.length === 0 && (
        <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Brak trenerów. Dodaj pierwszego powyżej.</div>
      )}

      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {trainers.map(t => (
          <Card key={t.id} style={{display:"flex", alignItems:"center", gap:16, padding:"14px 18px"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, color:C.text, fontSize:16}}>{t.name}</div>
              <div style={{fontSize:13, color:C.textMut}}>{t.email}</div>
              <div style={{fontSize:11, color:C.textMut, marginTop:2}}>Dodano: {formatDate(t.createdAt)}</div>
            </div>
            <div style={{display:"flex", gap:10, alignItems:"center"}}>
              <Badge color={t.active ? C.greenLt : C.textMut}>{t.active ? "Aktywny" : "Nieaktywny"}</Badge>
              <Btn small variant="ghost" onClick={() => onToggle(t)}>
                {t.active ? "Dezaktywuj" : "Aktywuj"}
              </Btn>
              <Btn small variant="danger" onClick={() => { if(confirm("Usunąć trenera "+t.name+"?")) onDelete(t); }}>
                Usuń
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== WIDOK: BILETY ===== */
function TicketsView({trainers: allTrainers}) {
  const trainers = allTrainers.filter(t => t.active !== false);
  const [tickets, setTickets]   = useState([]);
  const [roomStatuses, setRoomStatuses] = useState({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selTrainer, setSelTrainer] = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState(null);
  const [generated, setGenerated] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  function loadTickets() {
    if (!db) return;
    db.ref("tickets").once("value").then(snap => {
      setLoading(false);
      var arr = [];
      if (snap.exists()) snap.forEach(c => arr.push({id:c.key,...c.val()}));
      arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      setTickets(arr);
    });
  }

  useEffect(() => {
    loadTickets();
    if (!db) return;
    var rRef = db.ref("rooms");
    var rCb = rRef.on("value", snap => {
      var map = {};
      if(snap.exists()) snap.forEach(c => {
        var meta = c.child("meta").val() || {};
        var gs = c.child("gameState").val();
        var status = meta.status || (gs && gs.gameStarted ? "playing" : "lobby");
        map[c.key] = status;
      });
      setRoomStatuses(map);
    });
    return () => { rRef.off("value", rCb); };
  }, [refreshKey]);

  function handleCreateTicket() {
    if (!selTrainer) { setErr("Wybierz trenera."); return; }
    setSaving(true); setErr(null); setGenerated(null);
    var ref = db.ref("tickets").push();
    var wdzCode = generateRoomCode();
    var ticketData = {
      trainerId: selTrainer,
      trainerName: trainers.find(t=>t.id===selTrainer)?.name || "",
      roomCode: wdzCode,
      sheriffCode: wdzCode,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    };
    ref.set(ticketData).then(() => {
      setSaving(false);
      setGenerated({id: ref.key, roomCode: wdzCode, sheriffCode: wdzCode});
      setSelTrainer("");
      setShowForm(false);
      loadTickets();
    }).catch(e => { setSaving(false); setErr("Błąd zapisu: " + e.message); });
  }

  function tStatus(t) {
    var rs = roomStatuses[t.roomCode];
    if (!rs) return "Aktywny";
    if (rs === "playing") return "W grze";
    if (rs === "finished" || rs === "archived") return "Zakończona";
    if (rs === "lobby") return "Lobby";
    return "Wykorzystany";
  }
  function tStatusColor(t) {
    var s = tStatus(t);
    if (s === "Aktywny") return C.greenLt;
    if (s === "W grze" || s === "Lobby") return C.gold;
    return C.textMut;
  }

  function deleteTicket(id) {
    setDeleting(id);
    db.ref("tickets/" + id).remove()
      .then(()=>{setDeleting(null);loadTickets();})
      .catch(e=>{setDeleting(null);alert("Błąd usuwania: "+e.message);});
  }
  function deleteAllTickets() {
    setConfirmClear(false);
    db.ref("tickets").remove().then(()=>loadTickets()).catch(e=>alert("Błąd usuwania: "+e.message));
  }

  // Group by trainer
  var grouped = {};
  tickets.forEach(t => {
    var tid = t.trainerId || "__none__";
    if (!grouped[tid]) grouped[tid] = {name: t.trainerName || "Nieprzypisany", tickets: []};
    grouped[tid].tickets.push(t);
  });
  var trainerIds = Object.keys(grouped).sort((a,b) => grouped[a].name.localeCompare(grouped[b].name));

  function summary(arr) {
    var active=0,inGame=0,done=0;
    arr.forEach(t=>{var s=tStatus(t);if(s==="Aktywny")active++;else if(s==="W grze"||s==="Lobby")inGame++;else done++;});
    return {total:arr.length,active,inGame,done};
  }
  var globalSum = summary(tickets);

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8}}>
        <div style={{fontSize:13, color:C.textMut}}>
          {tickets.length} biletów
          {globalSum.active > 0 && <span style={{color:C.greenLt}}> · {globalSum.active} aktywnych</span>}
          {globalSum.inGame > 0 && <span style={{color:C.gold}}> · {globalSum.inGame} w grze</span>}
          {globalSum.done > 0 && <span> · {globalSum.done} zakończonych</span>}
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          {tickets.length>0 && (confirmClear
            ? <>
                <span style={{fontSize:13, color:C.textMut}}>Na pewno usunąć wszystkie?</span>
                <Btn small variant="danger" onClick={deleteAllTickets}>Tak, usuń</Btn>
                <Btn small variant="ghost" onClick={()=>setConfirmClear(false)}>Anuluj</Btn>
              </>
            : <Btn small variant="danger" onClick={()=>setConfirmClear(true)}>Usuń wszystkie</Btn>
          )}
          <Btn small onClick={() => { setShowForm(!showForm); setErr(null); setGenerated(null); }}>
            {showForm ? "Anuluj" : "+ Utwórz bilet"}
          </Btn>
        </div>
      </div>

      {generated && (
        <Card style={{marginBottom:16, border:"1px solid "+C.greenLt}}>
          <div style={{fontSize:13, color:C.greenLt, fontWeight:700, marginBottom:10}}>✓ Bilet utworzony</div>
          <div>
            <div style={{fontSize:11, color:C.textMut, marginBottom:4, textTransform:"uppercase", letterSpacing:0.5}}>Kod Szeryfa (przekaż trenerowi)</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"monospace", fontSize:22, fontWeight:900, color:C.gold, letterSpacing:4,
                background:C.panel, padding:"8px 16px", borderRadius:4, display:"inline-block"}}>{generated.sheriffCode}</div>
              <span onClick={()=>{navigator.clipboard.writeText(generated.sheriffCode);}} style={{cursor:"pointer",fontSize:12,color:C.textMut,textDecoration:"underline"}}>kopiuj</span>
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:16, fontWeight:700, color:C.gold, marginBottom:14}}>Nowy bilet rozgrywki</div>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <div>
              <label style={{fontSize:12,color:C.textMut,letterSpacing:1,textTransform:"uppercase",display:"block",marginBottom:5}}>Trener ({trainers.length} dostępnych)</label>
              {trainers.length === 0 && <div style={{color:C.red,fontSize:13,padding:8}}>Brak aktywnych trenerów. Dodaj trenera w zakładce Trenerzy.</div>}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {trainers.map(t => (
                  <div key={t.id} onClick={()=>setSelTrainer(t.id)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                      background:selTrainer===t.id?"#4C130F":C.panel,
                      border:"2px solid "+(selTrainer===t.id?C.gold:C.border),
                      borderRadius:6,cursor:"pointer",transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(selTrainer===t.id?C.gold:C.textMut),
                      background:selTrainer===t.id?C.gold:"transparent",flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:selTrainer===t.id?C.gold:C.text,fontSize:15}}>{t.name}</div>
                      <div style={{fontSize:12,color:C.textMut}}>{t.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Btn onClick={handleCreateTicket} disabled={saving}>{saving ? "Tworzę…" : "Utwórz bilet"}</Btn>
            <ErrBox msg={err}/>
          </div>
        </Card>
      )}

      {loading && <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Ładowanie…</div>}
      {!loading && tickets.length === 0 && (
        <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Brak biletów. Utwórz pierwszy powyżej.</div>
      )}

      {trainerIds.map(tid => {
        var g = grouped[tid];
        var s = summary(g.tickets);
        return (
          <Card key={tid} style={{marginBottom:10, padding:0, overflow:"hidden"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"12px 18px", background:"#3C2820"}}>
              <div style={{display:"flex", alignItems:"center", gap:12}}>
                <span style={{fontSize:15, fontWeight:700, color:C.text}}>{g.name}</span>
                <span style={{fontSize:12, color:C.textMut}}>
                  {s.total} {s.total===1?"bilet":s.total<5?"bilety":"biletów"}
                </span>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                {s.active>0 && <span style={{fontSize:12,color:C.greenLt}}>● {s.active} aktywnych</span>}
                {s.inGame>0 && <span style={{fontSize:12,color:C.gold}}>● {s.inGame} w grze</span>}
                {s.done>0 && <span style={{fontSize:12,color:C.textMut}}>● {s.done} zakończonych</span>}
              </div>
            </div>
            <div style={{padding:"0 18px 12px"}}>
              {g.tickets.map(t => (
                <div key={t.id} style={{display:"flex", alignItems:"center", gap:14,
                  padding:"10px 0", borderTop:"1px solid "+C.border}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,minWidth:170}}>
                    <span style={{fontFamily:"monospace",fontSize:16,fontWeight:900,color:C.gold,letterSpacing:2}}>
                      {t.sheriffCode||"–"}
                    </span>
                    {t.sheriffCode&&<span onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(t.sheriffCode);}}
                      style={{cursor:"pointer",fontSize:11,color:C.textMut,textDecoration:"underline"}}>kopiuj</span>}
                  </div>
                  <div style={{flex:1,fontSize:12,color:C.textMut}}>
                    {formatDate(t.createdAt)}
                  </div>
                  <Badge color={tStatusColor(t)}>{tStatus(t)}</Badge>
                  <Btn small variant="danger" disabled={deleting===t.id}
                    onClick={(e)=>{e.stopPropagation();deleteTicket(t.id);}}>
                    {deleting===t.id ? "…" : "Usuń"}
                  </Btn>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ===== STAŁE GRY – z wdz-shared.js: FM, FO, G_TASKS, C_RES/COMP/PLOT/MAP/BNB, ensureArray, toSlug ===== */
const G_CATS_MAX = {zasoby:30,kompetencje:25,gotowka:25,dzialka:10,mapa:10,relacje:20};

function gFixFd(fd){
  if(!fd)return{};
  var r={};
  for(var k in fd) r[k]={cash:fd[k].cash!=null?fd[k].cash:0,items:ensureArray(fd[k].items)};
  return r;
}

function gCalcScores(fd, relations, plotPenalties, mapEnabled, bnbEnabled, blindFate, biznesNaBoku, mapBonusClaimed){
  var scores={};
  FO.forEach(f=>{
    var fam=fd[f]||{cash:0,items:[]};
    var items=fam.items||[];
    var task=G_TASKS[f];

    // Zasoby
    var resIds=items.filter(i=>i.cat===C_RES&&!i.blind).map(i=>toSlug(i.name));
    var resPct=task.zasoby.reduce((s,z)=>s+(resIds.includes(z.id)?z.pct:0),0);
    var bnbKurier=items.filter(i=>i.cat===C_BNB&&i.effect==="res4").length;
    var bnbKurierBonus=0;
    if(bnbEnabled){
      if(resPct>=100){bnbKurierBonus=bnbKurier;}
      else{resPct=Math.min(100,resPct+bnbKurier*4);}
    }
    if(blindFate&&blindFate[f]&&blindFate[f].rolls){
      ensureArray(blindFate[f].rolls).forEach(function(roll){
        if(roll.resolved&&roll.event&&roll.event.type==="loss_resources"){
          var pen=roll.policyUsed===100?0:roll.policyUsed===50?5:10;
          resPct=Math.max(0,resPct-pen);
        }
      });
    }
    var resScore=Math.round((resPct/100)*30);

    // Kompetencje
    var compIds=items.filter(i=>i.cat===C_COMP&&!i.blind).map(i=>toSlug(i.name));
    var compPct=task.kompetencje.reduce((s,k)=>s+(compIds.includes(k.id)?k.pct:0),0);
    var bnbMikstura=items.filter(i=>i.cat===C_BNB&&i.effect==="comp4").length;
    var bnbMiksturaBonus=0;
    if(bnbEnabled){
      if(compPct>=100){bnbMiksturaBonus=bnbMikstura;}
      else{compPct=Math.min(100,compPct+bnbMikstura*4);}
    }
    var compScore=Math.round((compPct/100)*25);

    // Gotówka (clamp -25..+25)
    var cash=fam.cash!=null?fam.cash:0;
    var bnbObligacje=items.filter(i=>i.cat===C_BNB&&i.effect==="cash20").length;
    var cashForScore=bnbEnabled?cash*(1+bnbObligacje*0.2):cash;
    var cashScore=Math.max(-25,Math.min(25,Math.round(((cashForScore-600)/600)*25)));

    // Działka
    var plotItem=items.find(i=>i.cat===C_PLOT);
    var plotOk=plotItem&&plotItem.plotNr===FM[f].tPlot;
    var plotScore=plotOk?10:0;

    // Mapa (z mapBonusClaimed)
    var uniqueFrags=new Set(items.filter(i=>i.cat===C_MAP).map(i=>i.fragNr||i.mapFrag)).size;
    var mbc=mapBonusClaimed||{};
    var mapScore=mapEnabled?Math.min(10, uniqueFrags*2 + ((mbc[f]&&uniqueFrags>=4)?2:0)):0;

    // Relacje
    var relScore=0;
    if(relations){
      var totalStars=0;
      FO.forEach(rater=>{
        if(rater===f) return;
        var r=relations[rater];
        if(!r||!r[f]) return;
        var ratings=r[f];
        totalStars+=(ratings.partnership||0)+(ratings.rules||0)+(ratings.communication||0);
      });
      relScore=Math.round((totalStars/45)*20*10)/10;
    }

    // BnB punkty
    var bnbKwatera=items.filter(i=>i.cat===C_BNB&&i.effect==="point1").length;
    var bnbPts=bnbEnabled?(bnbKwatera+bnbKurierBonus+bnbMiksturaBonus):((biznesNaBoku&&biznesNaBoku[f])||0);

    scores[f]={resPct,compPct,cash,
      zasoby:resScore,kompetencje:compScore,gotowka:cashScore,
      dzialka:plotScore,mapa:mapScore,relacje:Math.round(relScore),bnb:bnbPts};
    scores[f].total=["zasoby","kompetencje","gotowka","dzialka","mapa","relacje"].reduce((s,k)=>s+scores[f][k],0)+bnbPts;
  });
  return scores;
}

/* ===== buildReportData – jedno źródło danych dla ReportView (JSX) i raportów (TXT/PDF) ===== */
function buildReportData(raw){
  var fd=raw.fd||{}, txs=raw.txs||[], blindFate=raw.blindFate||{}, relations=raw.relations||{};
  var bnbEnabled=raw.bnbEnabled||false, mapEnabled=raw.mapEnabled!==false, fateEnabled=raw.fateEnabled||false;
  var revEnabled=raw.revEnabled||false, relationsUnlocked=raw.relationsUnlocked||false;
  var revDuels=raw.revDuels||[], plotPenalties=raw.plotPenalties||{}, biznesNaBoku=raw.biznesNaBoku||{};
  var mapBonusClaimed=raw.mapBonusClaimed||{}, sheriffCalls=raw.sheriffCalls||[], consultNotes=raw.consultNotes||{};
  var debriefNotes=raw.debriefNotes||{}, meta=raw.meta||{}, sessionInfo=raw.sessionInfo||{};

  // Scores
  var scores=gCalcScores(fd,relations,plotPenalties,mapEnabled,bnbEnabled,blindFate,biznesNaBoku,mapBonusClaimed);
  var ranked=[...FO].sort((a,b)=>(scores[b]||{total:0}).total-(scores[a]||{total:0}).total);

  // Tx stats
  var tradeTxs=txs.filter(t=>t&&t.status==="accepted"&&(t.type==="sale"||t.type==="barter")&&FO.includes(t.from)&&FO.includes(t.to));
  var txStats={total:txs.length,accepted:0,rejected:0,cancelled:0,pending:0,pairs:{}};
  txs.forEach(tx=>{
    if(!tx) return;
    if(tx.status==="accepted")txStats.accepted++;else if(tx.status==="rejected")txStats.rejected++;
    else if(tx.status==="cancelled")txStats.cancelled++;else if(tx.status==="pending")txStats.pending++;
    if(tx.from&&tx.to&&FO.includes(tx.from)&&FO.includes(tx.to)){
      var pair=[tx.from,tx.to].sort().join("-");
      if(!txStats.pairs[pair])txStats.pairs[pair]={accepted:0,rejected:0,cancelled:0,total:0};
      txStats.pairs[pair].total++;
      if(tx.status==="accepted")txStats.pairs[pair].accepted++;
      else if(tx.status==="rejected")txStats.pairs[pair].rejected++;
      else if(tx.status==="cancelled")txStats.pairs[pair].cancelled++;
    }
  });

  // Tx per turn (9 turns)
  var turnLabels=["F1T1","F1T2","F1T3","F2T1","F2T2","F2T3","F3T1","F3T2","F3T3"];
  var txPerTurn={};FO.forEach(f=>{txPerTurn[f]=[0,0,0,0,0,0,0,0,0];});
  tradeTxs.forEach(tx=>{
    var p=tx.phase;if(p===undefined||p===null)return;
    if(p>=0&&p<=8){
      if(tx.from&&txPerTurn[tx.from])txPerTurn[tx.from][p]++;
      if(tx.to&&txPerTurn[tx.to])txPerTurn[tx.to][p]++;
    }
  });

  // Trade matrix (pair counts + cash values)
  var tradeMatrix={};
  var PAIRS=["adams-bennet","adams-clinton","adams-dexter","bennet-clinton","bennet-dexter","clinton-dexter"];
  PAIRS.forEach(p=>{tradeMatrix[p]={c:0,v:0};});
  tradeTxs.forEach(tx=>{
    var pair=[tx.from,tx.to].sort().join("-");
    if(tradeMatrix[pair]){
      tradeMatrix[pair].c++;
      if(tx.type==="sale")tradeMatrix[pair].v+=(tx.price||0);
      else tradeMatrix[pair].v+=((tx.offeredCash||0)+(tx.responseCash||0));
    }
  });

  // Task completion per family
  var tasks={};
  FO.forEach(f=>{
    var fam=fd[f]||{cash:0,items:[]};var items=fam.items||[];var task=G_TASKS[f];var fm=FM[f];
    var resItems=items.filter(i=>i.cat===C_RES&&i.forBiz===fm.biz);
    var resPct=resItems.reduce((s,i)=>s+(i.weight||0),0);
    var compItems=items.filter(i=>i.cat===C_COMP&&i.forBiz===fm.biz);
    var compPct=compItems.reduce((s,i)=>s+(i.weight||0),0);
    var plots=items.filter(i=>i.cat===C_PLOT);
    var hasCorrectPlot=plots.some(i=>i.plotNr===fm.tPlot);
    tasks[f]={resOwned:resItems.length,resTotal:task.zasoby.length,resPct:resPct,
      compOwned:compItems.length,compTotal:task.kompetencje.length,compPct:compPct,
      hasCorrectPlot:hasCorrectPlot,plotNr:plots.length>0?plots[0].plotNr:null,targetPlot:fm.tPlot};
  });

  return {fd,txs,blindFate,relations,revDuels,plotPenalties,biznesNaBoku,mapBonusClaimed,
    bnbEnabled,mapEnabled,fateEnabled,revEnabled,relationsUnlocked,sheriffCalls,consultNotes,
    debriefNotes,meta,sessionInfo,scores,ranked,txStats,txPerTurn,turnLabels,tradeMatrix,tasks,tradeTxs};
}

/* ===== RAPORT ROZGRYWKI ===== */
function ReportView({roomCode, onClose}){
  const [data, setData]=useState(null);
  const [loading, setLoading]=useState(true);

  useEffect(()=>{
    if(!db||!roomCode) return;
    db.ref("rooms/"+roomCode).once("value").then(snap=>{
      setLoading(false);
      if(!snap.exists()){setData(null);return;}
      var v=snap.val()||{};
      var gs=v.gameState||{};
      var sp=v.sheriffPrivate||{};
      setData({
        meta:    v.meta||{},
        fd:      gFixFd(gs.fd),
        txs:     ensureArray(gs.txs),
        blindFate:    gs.blindFate||null,
        relations:    gs.relations||null,
        revDuels:     ensureArray(gs.revDuels),
        debriefNotes: sp.debriefNotes||{},
        plotPenalties:gs.plotPenalties||{},
        biznesNaBoku: sp.biznesNaBoku||{},
        consultNotes: sp.consultNotes||{},
        bnbEnabled:   gs.bnbEnabled||false,
        mapEnabled:   gs.mapEnabled!==false,
        mapBonusClaimed: gs.mapBonusClaimed||{},
        relationsUnlocked: gs.relationsUnlocked||false,
        revEnabled:   gs.revEnabled||false,
        fateEnabled:  gs.fateEnabled||false,
        sheriffCalls: ensureArray(gs.sheriffCalls||[]),
        stageIdx:     gs.stageIdx,
        sessionInfo:  v.sessionInfo||{},
      });
    });
  },[roomCode]);

  const reportData=useMemo(()=>{
    if(!data) return null;
    return buildReportData(data);
  },[data]);

  const scores=reportData?reportData.scores:null;
  const ranked=reportData?reportData.ranked:FO;

  /* --- helpers renderowania --- */
  function SectionHeader({title}){
    return <div style={{fontSize:18,fontWeight:700,color:C.gold,borderBottom:"1px solid "+C.border,
      paddingBottom:8,marginBottom:16,marginTop:28,letterSpacing:0.5}}>{title}</div>;
  }

  function FamHeader({fId}){
    const f=FM[fId];
    return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:f.col,flexShrink:0}}/>
      <span style={{fontWeight:700,color:C.text}}>{f.nom}</span>
      <span style={{fontSize:12,color:C.textMut}}>({f.biz})</span>
    </div>;
  }

  function Tbl({heads, rows}){
    return <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}>
        <thead>
          <tr>{heads.map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:i===0?"left":"center",
            background:C.panel,color:C.textMut,borderBottom:"1px solid "+C.border,fontWeight:600,
            fontSize:11,letterSpacing:0.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
        </thead>
        <tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:"1px solid "+C.border+"44"}}>
          {row.map((cell,ci)=><td key={ci} style={{padding:"7px 10px",textAlign:ci===0?"left":"center",
            color:C.text,verticalAlign:"middle"}}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </div>;
  }

  if(loading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMut}}>
      Ładowanie raportu…
    </div>
  );
  if(!data) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{color:C.textMut,marginBottom:16}}>Brak danych dla rozgrywki {roomCode}.</div>
        <Btn onClick={onClose} variant="ghost">← Wróć</Btn>
      </div>
    </div>
  );

  const {fd,txs,blindFate,relations,revDuels,debriefNotes,mapEnabled,bnbEnabled,revEnabled,fateEnabled,relationsUnlocked,sessionInfo}=data;

  /* --- METRYCZKA --- */
  function renderMetryczka(){
    const si=sessionInfo||{};
    const players={}; // pobrane wyżej przez fixFd – imiona uczestników z txs
    const hasInfo=si.klient||si.grupa||si.szeryf2;
    return <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:6,
      padding:"12px 18px",marginBottom:4,display:"flex",flexWrap:"wrap",gap:20}}>
      <div>
        <div style={{fontSize:11,color:C.textMut,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Kod rozgrywki</div>
        <div style={{fontFamily:"monospace",fontSize:18,fontWeight:900,color:C.gold,letterSpacing:3}}>{roomCode}</div>
      </div>
      <div>
        <div style={{fontSize:11,color:C.textMut,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Data</div>
        <div style={{fontSize:14,color:C.text}}>{formatDate(data.meta.created)}</div>
      </div>
      {si.klient&&<div>
        <div style={{fontSize:11,color:C.textMut,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Klient / organizacja</div>
        <div style={{fontSize:14,color:C.text}}>{si.klient}</div>
      </div>}
      {si.grupa&&<div>
        <div style={{fontSize:11,color:C.textMut,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Grupa</div>
        <div style={{fontSize:14,color:C.text}}>{si.grupa}</div>
      </div>}
      {si.szeryf2&&<div>
        <div style={{fontSize:11,color:C.textMut,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Drugi Szeryf</div>
        <div style={{fontSize:14,color:C.text}}>{si.szeryf2}</div>
      </div>}
    </div>;
  }

  /* --- SEKCJA: Wyniki końcowe --- */
  function renderWyniki(){
    if(!scores) return null;
    const cats=["zasoby","kompetencje","gotowka","dzialka","mapa","relacje","bnb"];
    const catLabels={zasoby:"Zasoby",kompetencje:"Komp.",gotowka:"Gotówka",dzialka:"Działka",mapa:"Żyła",relacje:"Relacje",bnb:"BnB"};
    return <>
      <SectionHeader title="Wyniki końcowe"/>
      {/* Ranking */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
        {ranked.map((f,i)=>{
          const s=scores[f]; const fm=FM[f];
          return <div key={f} style={{borderRadius:6,padding:"12px 14px",background:fm.col,border:"2px solid "+fm.col+"88"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:2}}>{i+1}. miejsce</div>
            <div style={{fontSize:24,fontWeight:900,color:"#fff"}}>{s.total} pkt</div>
            <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.95)",marginTop:2}}>{fm.nom}</div>
          </div>;
        })}
      </div>
      {/* Tabela szczegółowa */}
      <Tbl
        heads={["Rodzina",...cats.map(k=>catLabels[k]),"Suma"]}
        rows={FO.map(f=>{
          const s=scores[f]; const fm=FM[f];
          return [
            <span style={{color:fm.col,fontWeight:700}}>{fm.nom}</span>,
            ...cats.map(k=><span>{s[k]||0}{k!=="bnb"?<span style={{fontSize:10,color:C.textMut}}>/{G_CATS_MAX[k]||"–"}</span>:null}</span>),
            <span style={{fontWeight:700,color:C.gold}}>{s.total}</span>
          ];
        })}
      />
    </>;
  }

  /* --- SEKCJA: Realizacja zadań --- */
  function renderZadania(){
    return <>
      <SectionHeader title="Realizacja zadań"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {FO.map(f=>{
          const s=scores[f]; const fm=FM[f]; const task=G_TASKS[f];
          const fam=fd[f]||{items:[]};
          const resIds=(fam.items||[]).filter(i=>i.cat===C_RES&&!i.blind).map(i=>toSlug(i.name));
          const compIds=(fam.items||[]).filter(i=>i.cat===C_COMP&&!i.blind).map(i=>toSlug(i.name));
          return <div key={f} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:6,padding:14}}>
            <FamHeader fId={f}/>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12,color:C.textMut,marginBottom:4}}>Zasoby – {s.resPct}%</div>
              <div style={{background:C.bg,borderRadius:3,height:8,overflow:"hidden"}}>
                <div style={{width:s.resPct+"%",height:"100%",background:fm.col,transition:"width .3s"}}/>
              </div>
              <div style={{fontSize:11,color:C.textMut,marginTop:4}}>
                {task.zasoby.map(z=><span key={z.id} style={{marginRight:6,
                  color:resIds.includes(z.id)?C.greenLt:C.textMut,fontWeight:resIds.includes(z.id)?700:400}}>
                  {resIds.includes(z.id)?"✓":"✗"} {z.pct}%
                </span>)}
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:C.textMut,marginBottom:4}}>Kompetencje – {s.compPct}%</div>
              <div style={{background:C.bg,borderRadius:3,height:8,overflow:"hidden"}}>
                <div style={{width:s.compPct+"%",height:"100%",background:fm.col,transition:"width .3s"}}/>
              </div>
              <div style={{fontSize:11,color:C.textMut,marginTop:4}}>
                {task.kompetencje.map(k=><span key={k.id} style={{marginRight:6,
                  color:compIds.includes(k.id)?C.greenLt:C.textMut,fontWeight:compIds.includes(k.id)?700:400}}>
                  {compIds.includes(k.id)?"✓":"✗"} {k.pct}%
                </span>)}
              </div>
            </div>
          </div>;
        })}
      </div>
    </>;
  }

  /* --- SEKCJA: Stany magazynowe --- */
  function renderMagazyn(){
    return <>
      <SectionHeader title="Stany magazynowe"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {FO.map(f=>{
          const fam=fd[f]||{cash:0,items:[]};
          const items=fam.items||[];
          const resI=items.filter(i=>i.cat===C_RES);
          const compI=items.filter(i=>i.cat===C_COMP);
          const mapI=items.filter(i=>i.cat===C_MAP);
          const bnbI=items.filter(i=>i.cat===C_BNB);
          const fm=FM[f];
          return <div key={f} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:6,padding:14}}>
            <FamHeader fId={f}/>
            <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:8}}>{fam.cash} $</div>
            {resI.length>0&&<div style={{marginBottom:6}}>
              <div style={{fontSize:11,color:C.textMut,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5}}>Zasoby ({resI.length})</div>
              <div style={{fontSize:12,color:C.text}}>{resI.map(i=>i.name).join(", ")}</div>
            </div>}
            {compI.length>0&&<div style={{marginBottom:6}}>
              <div style={{fontSize:11,color:C.textMut,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5}}>Kompetencje ({compI.length})</div>
              <div style={{fontSize:12,color:C.text}}>{compI.map(i=>i.name).join(", ")}</div>
            </div>}
            {mapI.length>0&&<div style={{marginBottom:6}}>
              <div style={{fontSize:11,color:C.textMut,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5}}>Fragmenty mapy ({mapI.length})</div>
              <div style={{fontSize:12,color:C.text}}>{mapI.map(i=>i.name||("Fragment "+i.mapFrag)).join(", ")}</div>
            </div>}
            {bnbI.length>0&&<div>
              <div style={{fontSize:11,color:C.textMut,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5}}>BnB ({bnbI.length})</div>
              <div style={{fontSize:12,color:C.text}}>{bnbI.map(i=>i.name).join(", ")}</div>
            </div>}
          </div>;
        })}
      </div>
    </>;
  }

  /* --- SEKCJA: Rytm rozgrywki (tabela tur) --- */
  function renderRytm(){
    if(!reportData) return null;
    var txMatrix=reportData.txPerTurn;
    const fazy=reportData.turnLabels;
    return <>
      <SectionHeader title="Rytm rozgrywki – transakcje per tura"/>
      <Tbl
        heads={["Rodzina",...fazy,"Suma"]}
        rows={FO.map(f=>{
          const row=txMatrix[f]||Array(9).fill(0);
          const suma=row.reduce((s,v)=>s+v,0);
          return [
            <span style={{color:FM[f].col,fontWeight:700}}>{FM[f].nom}</span>,
            ...row.map(v=><span style={{color:v>0?C.text:C.textMut}}>{v||"–"}</span>),
            <span style={{fontWeight:700,color:C.gold}}>{suma}</span>
          ];
        })}
      />
    </>;
  }

  /* --- SEKCJA: Macierz handlu --- */
  function renderHandel(){
    if(!reportData) return null;
    var tm=reportData.tradeMatrix;
    return <>
      <SectionHeader title="Macierz handlu – liczba transakcji"/>
      <Tbl
        heads={["Rodzina",...FO.map(f=>FM[f].nom)]}
        rows={FO.map(a=>[
          <span style={{color:FM[a].col,fontWeight:700}}>{FM[a].nom}</span>,
          ...FO.map(b=>{
            if(a===b) return <span style={{color:C.textMut}}>–</span>;
            var pair=[a,b].sort().join("-");
            const d=tm[pair]||{c:0,v:0};
            return <span style={{color:d.c>0?C.gold:C.textMut,fontWeight:d.c>0?700:400}}>{d.c>0?d.c+"tx":"·"}{d.v>0?<span style={{fontSize:10,color:C.textDim}}> ({d.v}$)</span>:null}</span>;
          })
        ])}
      />
    </>;
  }

  /* --- SEKCJA: Relacje --- */
  function renderRelacje(){
    if(!relationsUnlocked||!relations) return null;
    return <>
      <SectionHeader title="Relacje między rodzinami"/>
      <Tbl
        heads={["Rodzina",...FO.map(f=>FM[f].nom),"Śr. otrzym."]}
        rows={FO.map(a=>{
          var totalReceived=0;var raterCount=0;
          const cells=FO.map(b=>{
            if(a===b) return <span style={{color:C.textMut}}>–</span>;
            // relations[b][a] = how b rates a (received by a from b)
            var r=relations[b]&&relations[b][a];
            if(!r) return <span style={{color:C.textMut}}>·</span>;
            var stars=(r.partnership||0)+(r.rules||0)+(r.communication||0);
            totalReceived+=stars;raterCount++;
            return <span style={{color:stars>10?C.greenLt:stars>5?C.gold:C.textMut,fontWeight:700}}>{stars}<span style={{fontSize:10,color:C.textMut}}>/15</span></span>;
          });
          var avg=raterCount>0?Math.round(totalReceived/raterCount*10)/10:0;
          return [<span style={{color:FM[a].col,fontWeight:700}}>{FM[a].nom}</span>,...cells,
            <span style={{fontWeight:700,color:C.gold}}>{avg}</span>];
        })}
      />
    </>;
  }

  /* --- SEKCJA: Historia transakcji --- */
  function renderTransakcje(){
    const acc=txs.filter(tx=>tx.status==="accepted");
    if(acc.length===0) return <>
      <SectionHeader title="Historia transakcji"/>
      <div style={{color:C.textMut,fontSize:13}}>Brak zaakceptowanych transakcji.</div>
    </>;
    return <>
      <SectionHeader title={"Historia transakcji ("+acc.length+")"}/>
      <div style={{maxHeight:400,overflowY:"auto",border:"1px solid "+C.border,borderRadius:6}}>
        {acc.map((tx,i)=>{
          const fromF=FM[tx.from]; const toF=FM[tx.to];
          const offItems=(tx.offeredItems||[]).map(i=>i.name||i.id).join(", ");
          const resItems=(tx.responseItems||[]).map(i=>i.name||i.id).join(", ");
          return <div key={i} style={{padding:"8px 14px",borderBottom:"1px solid "+C.border+"44",
            fontSize:12,display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{color:C.textMut,minWidth:20}}>{i+1}.</div>
            <div style={{flex:1}}>
              <span style={{color:fromF?.col,fontWeight:700}}>{fromF?.nom||tx.from}</span>
              <span style={{color:C.textMut}}> → </span>
              <span style={{color:toF?.col,fontWeight:700}}>{toF?.nom||tx.to}</span>
              {(offItems||tx.offeredCash>0)&&<span style={{color:C.textDim}}>: {[offItems,tx.offeredCash>0?tx.offeredCash+" $":""].filter(Boolean).join(" + ")}</span>}
              {(resItems||tx.responseCash>0)&&<span style={{color:C.textDim}}> ↔ {[resItems,tx.responseCash>0?tx.responseCash+" $":""].filter(Boolean).join(" + ")}</span>}
              {tx.type==="rev"&&<span style={{color:C.gold}}> [Rewolwerowiec {tx.amount}$]</span>}
            </div>
          </div>;
        })}
      </div>
    </>;
  }

  /* --- SEKCJA: Ślepy Los --- */
  function renderSlepyLos(){
    if(!fateEnabled||!blindFate) return null;
    const hasAny=FO.some(f=>blindFate[f]&&ensureArray(blindFate[f].rolls).length>0);
    if(!hasAny) return null;
    return <>
      <SectionHeader title="Ślepy Los"/>
      {FO.map(f=>{
        const bf=blindFate[f]; if(!bf) return null;
        const rolls=ensureArray(bf.rolls);
        if(rolls.length===0) return null;
        return <div key={f} style={{marginBottom:14,background:C.panel,border:"1px solid "+C.border,borderRadius:6,padding:12}}>
          <FamHeader fId={f}/>
          {rolls.map((r,i)=>{
            if(!r||!r.resolved) return null;
            var evText=r.event?r.event.text:"brak zdarzenia";
            var evType=r.event?r.event.type:null;
            var policyLabel=r.policyUsed===100?"polisa 100%":r.policyUsed===50?"polisa 50%":"brak polisy";
            var isLoss=evType==="loss"||evType==="loss_resources";
            var netText=r.netEffect!==undefined&&r.netEffect!==0?(r.netEffect>0?"+":"")+r.netEffect+(evType==="loss_resources"?"% zasobów":" $"):"";
            return <div key={i} style={{fontSize:12,color:isLoss?C.red:C.greenLt,marginBottom:2}}>
              Rzut {i+1}: {r.d1}+{r.d2}={r.sum} – {evText}{netText&&<span style={{fontWeight:700}}> ({netText})</span>}{r.policyUsed>0&&<span style={{color:C.gold}}> [{policyLabel}]</span>}
            </div>;
          })}
        </div>;
      })}
    </>;
  }

  /* --- SEKCJA: Rewolwerowiec --- */
  function renderRewolwerowiec(){
    if(!revEnabled||revDuels.length===0) return null;
    return <>
      <SectionHeader title={"Rewolwerowiec – historia duelów ("+revDuels.length+")"}/>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {revDuels.map((d,i)=>{
          const wF=FM[d.winner]; const lF=FM[d.loser];
          return <div key={i} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:6,
            padding:"8px 14px",fontSize:13,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{color:C.textMut,minWidth:20}}>{i+1}.</div>
            <div style={{flex:1}}>
              <span style={{color:wF?.col||C.gold,fontWeight:700}}>{wF?.nom||d.winner}</span>
              <span style={{color:C.greenLt}}> wygrywa </span>
              <span style={{color:C.gold,fontWeight:700}}>{d.amount}$</span>
              <span style={{color:C.textMut}}> od </span>
              <span style={{color:lF?.col||C.textDim,fontWeight:700}}>{lF?.nom||d.loser}</span>
              {d.field&&<span style={{color:C.textMut,fontSize:11}}> (pole: {d.field})</span>}
            </div>
          </div>;
        })}
      </div>
    </>;
  }

  /* --- SEKCJA: Notatki Szeryfa --- */
  function renderNotatki(){
    if(!debriefNotes) return null;
    const sections=[
      {key:"zadania",label:"Realizacja zadań"},
      {key:"ewaluacja",label:"Ewaluacja"},
      {key:"wyniki",label:"Wyniki"},
      {key:"magazyn",label:"Stany magazynowe"},
    ];
    const familyNotes=debriefNotes.rodziny||{};
    const hasAny=sections.some(s=>debriefNotes[s.key])||FO.some(f=>familyNotes[f]);
    if(!hasAny) return null;
    return <>
      <SectionHeader title="Notatki Szeryfa"/>
      {sections.map(s=>debriefNotes[s.key]&&<div key={s.key} style={{marginBottom:12}}>
        <div style={{fontSize:12,color:C.textMut,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{s.label}</div>
        <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:4,padding:"8px 12px",fontSize:13,color:C.text,whiteSpace:"pre-wrap"}}>{debriefNotes[s.key]}</div>
      </div>)}
      {FO.some(f=>familyNotes[f])&&<div>
        <div style={{fontSize:12,color:C.textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Obserwacje per rodzina</div>
        {FO.map(f=>familyNotes[f]&&<div key={f} style={{marginBottom:8}}>
          <div style={{fontSize:12,color:FM[f].col,fontWeight:700,marginBottom:3}}>{FM[f].nom}</div>
          <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:4,padding:"8px 12px",fontSize:13,color:C.text,whiteSpace:"pre-wrap"}}>{familyNotes[f]}</div>
        </div>)}
      </div>}
    </>;
  }

  return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      {/* HEADER RAPORTU */}
      <div style={{background:C.redDark,borderBottom:"2px solid "+C.border,padding:"0 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <img src="img/alegra_logotyp.png" alt="aleGRA" style={{height:36,width:"auto"}}/>
            <div style={{color:C.textMut,fontSize:13}}>Raport rozgrywki</div>
            <div style={{fontFamily:"monospace",fontSize:16,fontWeight:900,color:C.gold,letterSpacing:3}}>
              {roomCode}
            </div>
            <div style={{fontSize:12,color:C.textMut}}>{formatDate(data.meta.created)}</div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn small variant="ghost" onClick={()=>{
              if(!reportData) return;
              var rd=reportData;
              var pdfScores={},relSc={},tot={};
              FO.forEach(fId=>{
                var s=rd.scores[fId]||{};
                relSc[fId]=s.relacje||0;
                tot[fId]=s.total||0;
                pdfScores[fId]={resScore:s.zasoby||0,resPct:s.resPct||0,compScore:s.kompetencje||0,compPct:s.compPct||0,plotScore:s.dzialka||0,plotOk:s.dzialka>0,cashScore:s.gotowka||0,cash:s.cash||0,mapScore:s.mapa||0,bnb:s.bnb||0,bnbKurier:0,bnbMikstura:0,bnbObligacje:0,bnbKwatera:0,bizTotal:(s.total||0)-(s.relacje||0)};
              });
              var si=data.sessionInfo||{};
              generateTrainerPDF({
                roomCode:roomCode,imgBase:"img/",
                meta:{createdAt:data.meta.createdAt||data.meta.created||Date.now(),client:si.klient||"",group:si.grupa||""},
                fd:rd.fd,scores:pdfScores,relScores:relSc,totals:tot,
                txs:rd.txs,relations:rd.relations||{},blindFate:rd.blindFate||{},
                bnbEnabled:rd.bnbEnabled,mapEnabled:rd.mapEnabled,revEnabled:rd.revEnabled,
                mapBonusClaimed:rd.mapBonusClaimed||{},revDuels:rd.revDuels||[]
              }).catch(e=>{alert("Błąd PDF: "+e.message);});
            }}>📄 Raport z rozgrywki</Btn>
            <Btn small variant="ghost" onClick={()=>{
              if(!reportData) return;
              var rd=reportData;
              var gs={fd:rd.fd,txs:rd.txs,blindFate:rd.blindFate,relations:rd.relations,
                bnbEnabled:rd.bnbEnabled,bnbSettled:true,mapEnabled:rd.mapEnabled,revEnabled:rd.revEnabled,fateEnabled:rd.fateEnabled,
                revDuels:rd.revDuels,meta:rd.meta,sheriffCalls:rd.sheriffCalls||[],
                plotPenalties:rd.plotPenalties,mapBonusClaimed:rd.mapBonusClaimed,stageIdx:data.stageIdx,
                biznesNaBoku:rd.biznesNaBoku,consultations:{}};
              var report=generateReport(roomCode,gs,null,rd.scores,rd.txStats,{1:{total:0},2:{total:0},3:{total:0}},[],[],{},0,rd.consultNotes||{});
              if(report){var blob=new Blob([report],{type:"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="wdz-diagnostyczny-"+roomCode+"-"+new Date().toISOString().slice(0,10)+".txt";document.body.appendChild(a);a.click();document.body.removeChild(a);}
            }}>📋 Diagnostyczny</Btn>
            <Btn small variant="ghost" onClick={onClose}>← Wróć</Btn>
          </div>
        </div>
      </div>

      {/* TREŚĆ RAPORTU */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 24px"}}>
        {renderMetryczka()}
        {renderWyniki()}
        {renderZadania()}
        {renderMagazyn()}
        {renderRytm()}
        {renderHandel()}
        {renderRelacje()}
        {renderTransakcje()}
        {renderSlepyLos()}
        {renderRewolwerowiec()}
        {renderNotatki()}
      </div>
    </div>
  );
}

/* ===== WIDOK: STATYSTYKI ===== */
function StatsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    // Ładujemy równolegle: rooms, tickets, trainers
    Promise.all([
      db.ref("rooms").once("value"),
      db.ref("tickets").once("value"),
      db.ref("trainers").once("value"),
    ]).then(([roomsSnap, ticketsSnap, trainersSnap]) => {
      setLoading(false);

      // Rooms
      var rooms = [];
      if (roomsSnap.exists()) roomsSnap.forEach(c => {
        var m = c.val()?.meta || {};
        rooms.push({code: c.key, status: m.status||"unknown", created: m.created||0});
      });

      // Tickets – mapa roomCode → {trainerId, trainerName}
      var ticketMap = {};
      var tickets = [];
      if (ticketsSnap.exists()) ticketsSnap.forEach(c => {
        var t = {id: c.key, ...c.val()};
        tickets.push(t);
        if (t.roomCode) ticketMap[t.roomCode] = {trainerId: t.trainerId, trainerName: t.trainerName||"–"};
      });

      // Trainers
      var trainers = [];
      if (trainersSnap.exists()) trainersSnap.forEach(c => trainers.push({id: c.key, ...c.val()}));

      // Agregacja per trener
      var perTrainer = {};
      trainers.forEach(t => {
        perTrainer[t.id] = {name: t.name, email: t.email, active: t.active,
          total:0, finished:0, playing:0, lobby:0};
      });
      // owner bucket – rozgrywki bez biletu
      perTrainer["__owner__"] = {name:"aleGRA (własne)", email:"", active:true,
        total:0, finished:0, playing:0, lobby:0};

      rooms.forEach(r => {
        var tm = ticketMap[r.code];
        var bucket = (tm && perTrainer[tm.trainerId]) ? tm.trainerId : "__owner__";
        var b = perTrainer[bucket];
        b.total++;
        if (r.status === "finished") b.finished++;
        else if (r.status === "playing") b.playing++;
        else b.lobby++;
      });

      // Statystyki czasowe – ostatnie 30 dni
      var now = Date.now();
      var day30 = now - 30*24*60*60*1000;
      var day7  = now - 7*24*60*60*1000;
      var last30 = rooms.filter(r => r.created > day30).length;
      var last7  = rooms.filter(r => r.created > day7).length;

      var roomSet = {};
      rooms.forEach(r => { roomSet[r.code] = true; });

      setData({rooms, tickets, trainers, perTrainer, last30, last7,
        totalRooms: rooms.length,
        finished: rooms.filter(r=>r.status==="finished").length,
        playing:  rooms.filter(r=>r.status==="playing").length,
        totalTrainers: trainers.filter(t=>t.active).length,
        unusedTickets: tickets.filter(t=>!roomSet[t.roomCode]).length,
      });
    });
  }, [refreshKey]);

  if (loading) return <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Ładowanie statystyk…</div>;
  if (!data)   return <div style={{color:C.textMut, padding:40, textAlign:"center"}}>Brak danych.</div>;

  function StatBox({label, value, sub, color}) {
    return <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:8,
      padding:"18px 22px", flex:"1 1 140px"}}>
      <div style={{fontSize:11, color:C.textMut, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>{label}</div>
      <div style={{fontSize:32, fontWeight:900, color: color||C.gold, lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:12, color:C.textMut, marginTop:4}}>{sub}</div>}
    </div>;
  }

  const trainerRows = Object.entries(data.perTrainer)
    .filter(([id,v]) => v.total > 0 || id !== "__owner__")
    .sort((a,b) => b[1].total - a[1].total);

  return (
    <div>
      {/* KAFELKI OVERVIEW */}
      <div style={{display:"flex", justifyContent:"flex-end", marginBottom:12}}>
        <Btn small variant="ghost" onClick={()=>setRefreshKey(k=>k+1)}>↻ Odśwież</Btn>
      </div>
      <div style={{display:"flex", gap:12, flexWrap:"wrap", marginBottom:24}}>
        <StatBox label="Wszystkich rozgrywek" value={data.totalRooms}/>
        <StatBox label="Zakończonych" value={data.finished} color={C.greenLt}/>
        <StatBox label="W toku" value={data.playing} color={C.gold}/>
        <StatBox label="Ostatnie 7 dni" value={data.last7} sub={"ostatnie 30 dni: "+data.last30}/>
        <StatBox label="Aktywnych trenerów" value={data.totalTrainers}/>
        <StatBox label="Nieużytych biletów" value={data.unusedTickets} color={data.unusedTickets>0?C.gold:C.textMut}/>
      </div>

      {/* TABELA PER TRENER */}
      <Card>
        <div style={{fontSize:16, fontWeight:700, color:C.gold, marginBottom:16}}>Rozgrywki per trener</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse", width:"100%", fontSize:13}}>
            <thead>
              <tr>{["Trener","Email","Razem","Zakończone","W toku","Lobby"].map((h,i)=>(
                <th key={i} style={{padding:"6px 12px", textAlign:i<2?"left":"center",
                  background:C.panel, color:C.textMut, borderBottom:"1px solid "+C.border,
                  fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:"uppercase"}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {trainerRows.map(([id, t]) => (
                <tr key={id} style={{borderBottom:"1px solid "+C.border+"44"}}>
                  <td style={{padding:"8px 12px"}}>
                    <span style={{fontWeight:700, color: id==="__owner__"?C.gold:C.text}}>{t.name}</span>
                    {!t.active && <span style={{fontSize:11,color:C.textMut,marginLeft:6}}>(nieaktywny)</span>}
                  </td>
                  <td style={{padding:"8px 12px", color:C.textMut, fontSize:12}}>{t.email||"–"}</td>
                  <td style={{padding:"8px 12px", textAlign:"center", fontWeight:700, color:C.gold}}>{t.total}</td>
                  <td style={{padding:"8px 12px", textAlign:"center", color:C.greenLt}}>{t.finished||"–"}</td>
                  <td style={{padding:"8px 12px", textAlign:"center", color:C.gold}}>{t.playing||"–"}</td>
                  <td style={{padding:"8px 12px", textAlign:"center", color:C.textMut}}>{t.lobby||"–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* === AGREGACJA ROZGRYWEK === */}
      <GameAggregation finishedRooms={data.rooms.filter(r => r.status === "finished")} />
    </div>
  );
}

/* ===== AGREGACJA – wyniki z zakończonych rozgrywek ===== */
function GameAggregation({finishedRooms}) {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);

  function loadGames() {
    if(!db || finishedRooms.length === 0) return;
    setLoading(true);
    var promises = finishedRooms.map(r =>
      db.ref("rooms/" + r.code).once("value").then(snap => ({code: r.code, data: snap.val()}))
    );
    Promise.all(promises).then(results => {
      var games = [];
      results.forEach(({code, data}) => {
        if(!data || !data.gameState) return;
        var gs = data.gameState;
        var fd = gs.fd;
        if(!fd) return;
        // Fix fd
        var fixedFd = {};
        FO.forEach(fId => {
          fixedFd[fId] = {cash: fd[fId] && fd[fId].cash != null ? fd[fId].cash : 0, items: ensureArray(fd[fId] && fd[fId].items)};
        });
        // Calc scores
        var scores = {};
        FO.forEach(fId => {
          scores[fId] = gCalcScores(fixedFd, gs.relations, gs.plotPenalties, gs.mapEnabled !== false, gs.bnbEnabled, gs.blindFate, gs.biznesNaBoku, gs.mapBonusClaimed);
        });
        // Actually gCalcScores returns all families at once
        var allScores = gCalcScores(fixedFd, gs.relations, gs.plotPenalties, gs.mapEnabled !== false, gs.bnbEnabled, gs.blindFate, gs.biznesNaBoku, gs.mapBonusClaimed);
        var winner = null, maxTotal = -Infinity;
        FO.forEach(fId => {
          if(allScores[fId] && allScores[fId].total > maxTotal) { maxTotal = allScores[fId].total; winner = fId; }
        });
        var txs = gs.txs ? ensureArray(gs.txs) : [];
        var accepted = txs.filter(t => t && t.status === "accepted").length;
        var rejected = txs.filter(t => t && t.status === "rejected").length;
        var meta = data.meta || {};
        games.push({code, winner, scores: allScores, accepted, rejected, totalTx: txs.length,
          client: meta.client || "", group: meta.group || "", createdAt: meta.createdAt || meta.created || 0,
          bnbEnabled: gs.bnbEnabled, mapEnabled: gs.mapEnabled});
      });
      setGameData(games);
      setLoading(false);
    }).catch(e => { console.error("GameAggregation:", e); setLoading(false); });
  }

  function exportTxt() {
    if(!gameData) return;
    var lines = [];
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("  WDZ AGREGACJA ROZGRYWEK – " + new Date().toLocaleString("pl"));
    lines.push("  Liczba rozgrywek: " + gameData.length);
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("");

    // Win distribution
    var wins = {adams:0, bennet:0, clinton:0, dexter:0};
    gameData.forEach(g => { if(g.winner) wins[g.winner]++; });
    lines.push("ROZKŁAD ZWYCIĘSTW:");
    FO.forEach(fId => {
      var pct = gameData.length > 0 ? Math.round(wins[fId] / gameData.length * 100) : 0;
      lines.push("  " + FM[fId].nom.padEnd(14) + wins[fId] + " (" + pct + "%)");
    });
    lines.push("");

    // Average scores
    lines.push("ŚREDNIE WYNIKI:");
    var avgScores = {};
    FO.forEach(fId => {
      var totals = gameData.filter(g => g.scores[fId]).map(g => g.scores[fId].total);
      avgScores[fId] = totals.length > 0 ? Math.round(totals.reduce((s,v) => s+v, 0) / totals.length * 10) / 10 : 0;
      lines.push("  " + FM[fId].nom.padEnd(14) + avgScores[fId] + " pkt (z " + totals.length + " gier)");
    });
    lines.push("");

    // Transaction activity
    var avgTx = gameData.length > 0 ? Math.round(gameData.reduce((s,g) => s + g.totalTx, 0) / gameData.length * 10) / 10 : 0;
    var avgAccepted = gameData.length > 0 ? Math.round(gameData.reduce((s,g) => s + g.accepted, 0) / gameData.length * 10) / 10 : 0;
    lines.push("AKTYWNOŚĆ HANDLOWA (średnia per rozgrywka):");
    lines.push("  Transakcji:    " + avgTx);
    lines.push("  Zaakceptowanych: " + avgAccepted);
    lines.push("  Odrzuconych:     " + (avgTx > 0 ? Math.round((avgTx - avgAccepted) * 10) / 10 : 0));
    lines.push("");

    // Per-game details
    lines.push("SZCZEGÓŁY ROZGRYWEK:");
    lines.push("─".repeat(55));
    gameData.forEach(g => {
      lines.push(g.code + (g.client ? " | " + g.client : "") + (g.group ? " | " + g.group : ""));
      lines.push("  Zwycięzca: " + (g.winner ? FM[g.winner].nom : "–") + " (" + (g.scores[g.winner] ? g.scores[g.winner].total : "?") + " pkt)");
      FO.forEach(fId => {
        if(g.scores[fId]) lines.push("    " + FM[fId].nom.padEnd(14) + g.scores[fId].total + " pkt");
      });
      lines.push("  Transakcje: " + g.accepted + " zaakceptowanych / " + g.totalTx + " łącznie");
      lines.push("");
    });

    var text = lines.join("\n");
    var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wdz-agregacja-" + new Date().toISOString().slice(0,10) + ".txt";
    a.click();
  }

  if(finishedRooms.length === 0) return null;

  return (
    <Card style={{marginTop:24}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{fontSize:16, fontWeight:700, color:C.gold}}>Agregacja rozgrywek</div>
        <div style={{display:"flex", gap:8}}>
          {gameData && <Btn small variant="ghost" onClick={exportTxt}>📋 Eksport TXT</Btn>}
          <Btn small onClick={loadGames} disabled={loading}>{loading ? "Ładowanie…" : gameData ? "Odśwież" : "Załaduj dane (" + finishedRooms.length + " gier)"}</Btn>
        </div>
      </div>

      {!gameData && !loading && (
        <div style={{color:C.textMut, fontSize:13}}>
          Kliknij „Załaduj dane" aby pobrać wyniki z {finishedRooms.length} zakończonych rozgrywek.
        </div>
      )}

      {gameData && (() => {
        var wins = {adams:0, bennet:0, clinton:0, dexter:0};
        gameData.forEach(g => { if(g.winner) wins[g.winner]++; });
        var n = gameData.length;

        return (
          <div>
            {/* Win distribution */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13, fontWeight:700, color:C.textDim, marginBottom:8, letterSpacing:0.5}}>ROZKŁAD ZWYCIĘSTW</div>
              <div style={{display:"flex", gap:12}}>
                {FO.map(fId => {
                  var pct = n > 0 ? Math.round(wins[fId] / n * 100) : 0;
                  return (
                    <div key={fId} style={{flex:1, background:FM[fId].col+"22", border:"1px solid "+FM[fId].col+"55",
                      borderRadius:8, padding:12, textAlign:"center"}}>
                      <div style={{fontSize:28, fontWeight:900, color:FM[fId].col}}>{wins[fId]}</div>
                      <div style={{fontSize:12, color:C.textDim}}>{FM[fId].nom}</div>
                      <div style={{fontSize:11, color:C.textMut}}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average scores */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13, fontWeight:700, color:C.textDim, marginBottom:8, letterSpacing:0.5}}>ŚREDNIE WYNIKI</div>
              <div style={{display:"flex", gap:12}}>
                {FO.map(fId => {
                  var totals = gameData.filter(g => g.scores[fId]).map(g => g.scores[fId].total);
                  var avg = totals.length > 0 ? Math.round(totals.reduce((s,v) => s+v, 0) / totals.length * 10) / 10 : 0;
                  var cats = ["zasoby","kompetencje","gotowka","dzialka","mapa","relacje"];
                  return (
                    <div key={fId} style={{flex:1, background:C.card, border:"1px solid "+C.border, borderRadius:8, padding:12}}>
                      <div style={{fontWeight:700, color:FM[fId].col, fontSize:14, marginBottom:4}}>{FM[fId].nom}</div>
                      <div style={{fontSize:24, fontWeight:900, color:C.gold, marginBottom:4}}>{avg}</div>
                      <div style={{fontSize:11, color:C.textMut}}>pkt (śr. z {totals.length} gier)</div>
                      {cats.map(cat => {
                        var catAvg = gameData.filter(g => g.scores[fId]).map(g => g.scores[fId][cat] || 0);
                        var a = catAvg.length > 0 ? Math.round(catAvg.reduce((s,v) => s+v, 0) / catAvg.length * 10) / 10 : 0;
                        return <div key={cat} style={{fontSize:11, color:C.textMut, display:"flex", justifyContent:"space-between"}}>
                          <span>{cat}</span><span style={{color:C.textDim}}>{a}</span>
                        </div>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity metrics */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13, fontWeight:700, color:C.textDim, marginBottom:8, letterSpacing:0.5}}>AKTYWNOŚĆ HANDLOWA (średnia)</div>
              <div style={{display:"flex", gap:12}}>
                {[
                  {label:"Transakcji", val:Math.round(gameData.reduce((s,g) => s+g.totalTx, 0) / n * 10) / 10},
                  {label:"Zaakceptowanych", val:Math.round(gameData.reduce((s,g) => s+g.accepted, 0) / n * 10) / 10, col:C.greenLt},
                  {label:"Odrzuconych", val:Math.round(gameData.reduce((s,g) => s+g.rejected, 0) / n * 10) / 10, col:"#C04030"},
                ].map((m,i) => (
                  <div key={i} style={{flex:1, background:C.card, border:"1px solid "+C.border, borderRadius:8, padding:12, textAlign:"center"}}>
                    <div style={{fontSize:24, fontWeight:900, color:m.col||C.gold}}>{m.val}</div>
                    <div style={{fontSize:12, color:C.textMut}}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-game list */}
            <div>
              <div style={{fontSize:13, fontWeight:700, color:C.textDim, marginBottom:8, letterSpacing:0.5}}>LISTA ROZGRYWEK ({n})</div>
              <div style={{maxHeight:300, overflowY:"auto"}}>
                {gameData.map(g => (
                  <div key={g.code} style={{display:"flex", alignItems:"center", gap:12, padding:"8px 0",
                    borderBottom:"1px solid "+C.border+"44", fontSize:13}}>
                    <span style={{fontWeight:700, color:C.text, minWidth:110}}>{g.code}</span>
                    <span style={{color:g.winner ? FM[g.winner].col : C.textMut, fontWeight:700, minWidth:100}}>
                      {g.winner ? FM[g.winner].nom : "–"}
                    </span>
                    <span style={{color:C.textDim, minWidth:50}}>{g.scores[g.winner] ? g.scores[g.winner].total + " pkt" : ""}</span>
                    <span style={{color:C.textMut, flex:1, fontSize:12}}>{[g.client, g.group].filter(Boolean).join(" · ")}</span>
                    <span style={{color:C.textMut, fontSize:11}}>TX: {g.accepted}/{g.totalTx}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

/* ===== GŁÓWNA APLIKACJA ===== */

/* ================================================================
   WDZ MONITOR – osadzony w panelu admina
   Przeniesiony z wdz-monitor.html v0.4.0
   Read-only nasłuchiwacz Firebase z diagnostyką.
   ================================================================ */


const START_CASH = 600;
const EXPECTED_ITEMS = { adams:32, bennet:28, clinton:29, dexter:31 };
const TOTAL_ITEMS = 120;
const TOTAL_CASH = 2400;
const MAP_FRAGS_PER_FAMILY = 4;
const TOTAL_MAP_FRAGS = 16;
const TOTAL_PLOTS = 4;

/* ========== HELPERS ========== */
function fixFdFromFirebase(fd){
  if(!fd)return fd;
  var r={};
  for(var k in fd){r[k]={cash:fd[k].cash!=null?fd[k].cash:0,items:ensureArray(fd[k].items)};}
  return r;
}
function ts(){return new Date().toLocaleTimeString("pl",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}

/* ========== SOUND ALERT ========== */
var audioCtx = null;
function playAlertBeep() {
  try {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 880; osc.type = "square";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) { /* ignore audio errors */ }
}

/* ========== SCORE CALCULATOR – wrapper delegujący do kanonicznego calcScore ========== */
function monCalcScore(fId, fd, biznesNaBoku, bnbEnabled, blindFate, mapEnabled, mapBonusClaimed) {
  return calcScore(fId, fd, {}, biznesNaBoku, bnbEnabled, blindFate, mapEnabled, mapBonusClaimed);
}

/* ========== CHANGE DETECTION ========== */
function detectChanges(cur, prev) {
  var changes = [];
  if(!prev) return changes;
  // Stage change
  if(cur.stageIdx !== prev.stageIdx && cur.stageIdx != null) {
    var st = STAGES[cur.stageIdx];
    changes.push({sev:SEV.INFO, cat:"ETAP", msg:"Przejście do: " + (st ? st.label : "etap " + cur.stageIdx)});
  }
  // Game started
  if(cur.gameStarted && !prev.gameStarted) {
    changes.push({sev:SEV.INFO, cat:"GRA", msg:"Rozgrywka rozpoczęta"});
  }
  // Timer paused/resumed
  if(cur.timerPaused && !prev.timerPaused) {
    changes.push({sev:SEV.INFO, cat:"TIMER", msg:"Timer wstrzymany (pauza)"});
  }
  if(!cur.timerPaused && prev.timerPaused && cur.timerRunning) {
    changes.push({sev:SEV.INFO, cat:"TIMER", msg:"Timer wznowiony"});
  }
  // Mechanic toggles
  var mechs = [
    {key:"bnbEnabled", label:"Biznes na Boku"},
    {key:"fateEnabled", label:"Ślepy Los"},
    {key:"mapEnabled", label:"Złotodajna Żyła"},
    {key:"revEnabled", label:"Rewolwerowiec"},
    {key:"relationsUnlocked", label:"Relacje"},
  ];
  mechs.forEach(m => {
    if(cur[m.key] && !prev[m.key]) changes.push({sev:SEV.INFO, cat:"MECHANIKA", msg:m.label + " – aktywowany"});
  });
  // New transactions
  var curTxs = cur.txs ? ensureArray(cur.txs) : [];
  var prevTxs = prev.txs ? ensureArray(prev.txs) : [];
  if(curTxs.length > prevTxs.length) {
    var diff = curTxs.length - prevTxs.length;
    changes.push({sev:SEV.INFO, cat:"TRANSAKCJA", msg:"+" + diff + " now" + (diff > 1 ? "ych" : "a") + " transakcj" + (diff > 1 ? "i" : "a")});
  }
  // mapBonus claimed
  if(cur.mapBonusClaimed && prev.mapBonusClaimed) {
    FO.forEach(fId => {
      if(cur.mapBonusClaimed[fId] && !prev.mapBonusClaimed[fId]) {
        changes.push({sev:SEV.INFO, cat:"MAPA", msg:FM[fId].nom + " – odebrano premię za mapę (300 $)"});
      }
    });
  }
  // Debrief unlocked
  if(cur.debriefUnlocked && !prev.debriefUnlocked) {
    changes.push({sev:SEV.INFO, cat:"OMÓWIENIE", msg:"Wyniki udostępnione rodzinom"});
  }
  if(cur.debriefFullAccess && !prev.debriefFullAccess) {
    changes.push({sev:SEV.INFO, cat:"OMÓWIENIE", msg:"Pełny dostęp do wyników – wszystkie rodziny"});
  }
  return changes;
}

/* ========== SEVERITY LEVELS ========== */
const SEV = {INFO:"info", WARN:"warn", ERROR:"error"};
const SEV_LABEL = {info:"INFO", warn:"UWAGA", error:"BŁĄD"};
const SEV_COLOR = {info:"#6B8E6B", warn:"#D4A853", error:"#C04030"};
const SEV_BG    = {info:"#1A2A1A", warn:"#2A2210", error:"#2A1210"};

/* ========== ANOMALY DETECTION ENGINE ========== */
function runChecks(gameState, players, prevState) {
  var events = [];
  if(!gameState) return events;

  var fd = gameState.fd ? fixFdFromFirebase(gameState.fd) : null;
  var txs = gameState.txs ? ensureArray(gameState.txs) : [];

  // --- LAYER 1: Connection health ---
  if(players) {
    // Check sheriff presence
    if(!players.sheriff || !players.sheriff.connected) {
      events.push({sev:SEV.WARN, cat:"POŁĄCZENIE", msg:"Szeryf jest rozłączony"});
    }
    // Check family presence
    FO.forEach(fId => {
      var fp = players[fId];
      if(!fp || !fp.members || Object.keys(fp.members).length === 0) {
        if(gameState.gameStarted) {
          events.push({sev:SEV.WARN, cat:"POŁĄCZENIE", msg:FM[fId].nom + " – brak podłączonych graczy"});
        }
      }
    });
  }

  if(!fd) return events;

  // --- LAYER 2: State anomalies ---

  // 2a. Cash integrity
  var totalCash = 0;
  FO.forEach(fId => {
    var cash = fd[fId].cash;
    totalCash += cash;
    if(cash < 0) {
      events.push({sev:SEV.ERROR, cat:"GOTÓWKA", msg:FM[fId].nom + " – ujemna gotówka: " + cash + " $"});
    }
  });

  // 2b. Total cash conservation (accounting for blind fate events)
  var blindFate = gameState.blindFate || {};
  var fateDelta = 0;
  FO.forEach(fId => {
    var bf = blindFate[fId];
    if(bf && bf.rolls) {
      ensureArray(bf.rolls).forEach(roll => {
        if(roll && roll.resolved && roll.event) {
          if(roll.event.type === "loss" || roll.event.type === "gain") {
            var amt = roll.event.amount || 0;
            // Apply policy reduction for losses
            if(roll.event.type === "loss" && roll.policyUsed) {
              if(roll.policyUsed === 100) amt = 0;
              else if(roll.policyUsed === 50) amt = Math.round(amt / 2);
            }
            fateDelta += amt;
          }
          // Złoty Los (gain_policy): zysk = 2× cena polisy
          if(roll.event.type === "gain_policy") {
            var policyGain = roll.policyUsed === 100 ? 100 : roll.policyUsed === 50 ? 60 : 0;
            fateDelta += policyGain;
          }
        }
      });
    }
  });
  // Account for consultations (15$ each deducted from family cash)
  // consultations[fId] is an array – each entry = 1 sold consultation
  // Note: cancelled consultations (refunded) also remain in array; sheriffCalls tracks actual state
  var consultsCost = 0;
  var calls = gameState.sheriffCalls || [];
  if(Array.isArray(calls)) {
    calls.forEach(c => {
      if(c && c.status === "sold") consultsCost += 15;
      // "cancelled" after "sold" means refund already happened – no net cost
    });
  }
  // Fallback: count from consultations arrays if sheriffCalls not available
  if(consultsCost === 0) {
    var consultsObj = gameState.consultations || {};
    FO.forEach(fId => {
      var cArr = consultsObj[fId];
      if(cArr) consultsCost += ensureArray(cArr).length * 15;
    });
  }
  // Account for plot penalties (50$ each, deducted from family cash)
  var plotPens = gameState.plotPenalties || {};
  var penaltyCost = 0;
  FO.forEach(fId => { if(plotPens[fId]) penaltyCost += 50; });

  // Account for insurance policy costs (from blindFate rolls)
  var insuranceCost = 0;
  var bfData = gameState.blindFate || {};
  FO.forEach(fId => {
    if(bfData[fId] && bfData[fId].rolls) {
      ensureArray(bfData[fId].rolls).forEach(roll => {
        if(roll && roll.policyUsed === 100) insuranceCost += 50;
        else if(roll && roll.policyUsed === 50) insuranceCost += 30;
      });
    }
  });

  // Account for BnB settlement (300$ per family to supplier, minus 100$ bonus)
  var bnbSettleCost = 0;
  if(gameState.bnbSettled) {
    var txArr = gameState.txs ? ensureArray(gameState.txs) : [];
    txArr.forEach(tx => {
      if(tx && tx.type === "bnb_settle") bnbSettleCost += 300;
      if(tx && tx.type === "bnb_bonus") bnbSettleCost -= 100;
    });
  }

  // Account for map bonus (+300$ for winner, -100$ per loser = zero-sum)
  // Net effect on total cash pool is always 0
  var mapBonusCash = 0;

  var expectedCash = TOTAL_CASH + fateDelta - consultsCost - penaltyCost - insuranceCost - bnbSettleCost + mapBonusCash;
  if(Math.abs(totalCash - expectedCash) > 1) {
    events.push({sev:SEV.ERROR, cat:"GOTÓWKA",
      msg:"Suma gotówki (" + totalCash + " $) nie zgadza się z oczekiwaną (" + expectedCash + " $). Różnica: " + (totalCash - expectedCash) + " $"});
  }

  // 2c. Item count integrity
  var totalItems = 0;
  FO.forEach(fId => { totalItems += fd[fId].items.length; });
  // BnB cards can be added if bnbEnabled
  var bnbCardCount = 0;
  if(gameState.bnbEnabled) {
    FO.forEach(fId => { bnbCardCount += BNB_PRODUCTS[fId].qty; });
  }
  var expectedItems = TOTAL_ITEMS + bnbCardCount;
  var mbcObj = gameState.mapBonusClaimed || {};
  if(Object.keys(mbcObj).some(function(k){return mbcObj[k];})) expectedItems += 1;
  if(totalItems !== expectedItems) {
    events.push({sev:SEV.WARN, cat:"KARTY",
      msg:"Łączna liczba kart (" + totalItems + ") różni się od oczekiwanej (" + expectedItems + "). Różnica: " + (totalItems - expectedItems)});
  }

  // 2d. Pending transactions stuck too long
  var now = Date.now();
  txs.forEach(tx => {
    if(tx.status === "pending" && tx.ts) {
      var age = (now - tx.ts) / 1000;
      if(age > 120) {
        events.push({sev:SEV.ERROR, cat:"TRANSAKCJA",
          msg:"Transakcja " + (tx.id||"?").substring(0,10) + " utknęła w pending od " + Math.round(age) + "s (" + FM[tx.from]?.nom + " → " + FM[tx.to]?.nom + ")"});
      } else if(age > 60) {
        events.push({sev:SEV.WARN, cat:"TRANSAKCJA",
          msg:"Transakcja " + (tx.id||"?").substring(0,10) + " w pending od " + Math.round(age) + "s"});
      }
    }
  });

  // 2e. Duplicate map fragments per family (more unique frags than possible)
  var mbc = gameState.mapBonusClaimed || {};
  FO.forEach(fId => {
    var maps = fd[fId].items.filter(i => i.cat === C_MAP);
    var uniqueFrags = [...new Set(maps.map(m => m.fragNr))];
    var maxAllowed = mbc[fId] ? 5 : 4;
    if(uniqueFrags.length > maxAllowed) {
      events.push({sev:SEV.ERROR, cat:"MAPA", msg:FM[fId].nom + " – " + uniqueFrags.length + " unikalnych fragmentów mapy (max " + maxAllowed + ")"});
    }
  });

  // 2f. Multiple plots per family
  FO.forEach(fId => {
    var plots = fd[fId].items.filter(i => i.cat === C_PLOT);
    if(plots.length > 1) {
      events.push({sev:SEV.WARN, cat:"DZIAŁKA", msg:FM[fId].nom + " – posiada " + plots.length + (plots.length <= 4 ? " działki" : " działek")});
    }
    if(plots.length === 0 && gameState.gameStarted) {
      events.push({sev:SEV.WARN, cat:"DZIAŁKA", msg:FM[fId].nom + " – nie posiada żadnej działki"});
    }
  });

  // 2g. Stage/mechanic consistency
  if(gameState.bnbEnabled && !gameState.gameStarted) {
    events.push({sev:SEV.WARN, cat:"MECHANIKA", msg:"BnB włączone, ale gra nie została wystartowana"});
  }
  if(gameState.fateEnabled && !gameState.gameStarted) {
    events.push({sev:SEV.WARN, cat:"MECHANIKA", msg:"Ślepy Los włączony, ale gra nie została wystartowana"});
  }

  // 2h. mapBonusClaimed but cash didn't increase
  if(gameState.mapBonusClaimed && fd) {
    FO.forEach(fId => {
      if(gameState.mapBonusClaimed[fId]) {
        var uniqueFrags = [...new Set(fd[fId].items.filter(i => i.cat === C_MAP).map(m => m.fragNr))];
        if(uniqueFrags.length < 4) {
          events.push({sev:SEV.ERROR, cat:"MAPA",
            msg:FM[fId].nom + " – mapBonusClaimed=true, ale posiada tylko " + uniqueFrags.length + " unikalnych fragmentów"});
        }
      }
    });
  }

  // 2i. Blind fate rolling stuck
  if(blindFate) {
    FO.forEach(fId => {
      var bf = blindFate[fId];
      if(bf && bf.rolls) {
        ensureArray(bf.rolls).forEach((roll, idx) => {
          if(roll && roll.rolling === true) {
            events.push({sev:SEV.WARN, cat:"ŚLEPY LOS",
              msg:FM[fId].nom + " – rzut #" + (idx+1) + " utknął w animacji (rolling=true)"});
          }
        });
      }
    });
  }

  // 2j. Rewolwerowiec watchdog – active duels exceeding expected time
  if(gameState.revEnabled) {
    var revActive = gameState.revActive;
    if(revActive) {
      var duels = Array.isArray(revActive) ? revActive : (revActive === "__empty__" ? [] : Object.values(revActive));
      duels.forEach(function(duel) {
        if(duel && duel.timerPhase && duel.timerStartedAt && duel.timerDuration) {
          var elapsed = (Date.now() - duel.timerStartedAt) / 1000;
          if(elapsed > duel.timerDuration + 30) {
            events.push({sev:SEV.WARN, cat:"REWOLWEROWIEC",
              msg:"Pojedynek " + (duel.a||"?") + " vs " + (duel.b||"?") + " – timer przekroczony o " + Math.round(elapsed - duel.timerDuration) + "s"});
          }
        }
      });
    }
    // revCurrent (legacy single-duel) check
    var rc = gameState.revCurrent;
    if(rc && rc !== false && rc.timerPhase && rc.timerStartedAt && rc.timerDuration) {
      var rcElapsed = (Date.now() - rc.timerStartedAt) / 1000;
      if(rcElapsed > rc.timerDuration + 30) {
        events.push({sev:SEV.WARN, cat:"REWOLWEROWIEC",
          msg:"Aktywny pojedynek – timer przekroczony o " + Math.round(rcElapsed - rc.timerDuration) + "s"});
      }
    }
  }

  // 2k. BnB settlement consistency
  if(gameState.bnbEnabled && gameState.bnbSettled && fd) {
    // After settlement, check that no BnB cards remain "unsold" in original family
    // (settlement should have cleared unsold cards and added cash)
    // This is a soft check – just inform
    FO.forEach(fId => {
      var bnbOwn = fd[fId].items.filter(i => i.cat === C_BNB && i.bnbOrigin === fId);
      if(bnbOwn.length > 0) {
        events.push({sev:SEV.INFO, cat:"BNB",
          msg:FM[fId].nom + " – " + bnbOwn.length + " niesprzedanych produktów BnB po rozliczeniu"});
      }
    });
  }

  // 2l. Consultation consistency
  var consults = gameState.consultations || {};
  FO.forEach(fId => {
    var cArr = consults[fId];
    if(!cArr) return;
    var active = ensureArray(cArr).filter(c => c && c.status === "active");
    active.forEach(c => {
      if(c.questionsTotal && c.questionsUsed >= c.questionsTotal) {
        events.push({sev:SEV.INFO, cat:"KONSULTACJA",
          msg:FM[fId].nom + " – konsultacja wyczerpana (" + c.questionsUsed + "/" + c.questionsTotal + " pytań)"});
      }
    });
    // Multiple simultaneous active consultations is unusual
    if(active.length > 1) {
      events.push({sev:SEV.WARN, cat:"KONSULTACJA",
        msg:FM[fId].nom + " – " + active.length + " aktywne konsultacje jednocześnie"});
    }
  });
  // Cross-check: consultations cash accounting
  // Count total consultations sold (active or completed) and verify cash deductions
  var totalConsultsSold = 0;
  FO.forEach(fId => {
    var cArr = consults[fId];
    if(cArr) totalConsultsSold += ensureArray(cArr).length;
  });

  // If no issues found
  if(events.length === 0) {
    events.push({sev:SEV.INFO, cat:"SYSTEM", msg:"Brak wykrytych anomalii"});
  }

  return events;
}

/* ========== TRANSACTION STATS ========== */
function calcTxStats(txs) {
  if(!txs || txs.length === 0) return {total:0, accepted:0, rejected:0, cancelled:0, pending:0, pairs:{}};
  var stats = {total:txs.length, accepted:0, rejected:0, cancelled:0, pending:0, pairs:{}};
  txs.forEach(tx => {
    if(tx.status === "accepted") stats.accepted++;
    else if(tx.status === "rejected") stats.rejected++;
    else if(tx.status === "cancelled") stats.cancelled++;
    else if(tx.status === "pending") stats.pending++;
    // Track per-pair activity
    if(tx.from && tx.to) {
      var pair = [tx.from, tx.to].sort().join("-");
      if(!stats.pairs[pair]) stats.pairs[pair] = {accepted:0, rejected:0, cancelled:0, total:0};
      stats.pairs[pair].total++;
      if(tx.status === "accepted") stats.pairs[pair].accepted++;
      else if(tx.status === "rejected") stats.pairs[pair].rejected++;
      else if(tx.status === "cancelled") stats.pairs[pair].cancelled++;
    }
  });
  return stats;
}

/* ========== TRANSACTION PHASE BREAKDOWN ========== */
function calcPhaseStats(txs) {
  var phases = {1:{accepted:0,rejected:0,cancelled:0,total:0}, 2:{accepted:0,rejected:0,cancelled:0,total:0}, 3:{accepted:0,rejected:0,cancelled:0,total:0}};
  if(!txs) return phases;
  txs.forEach(tx => {
    var p = tx.phase;
    if(p >= 1 && p <= 3) {
      phases[p].total++;
      if(tx.status === "accepted") phases[p].accepted++;
      else if(tx.status === "rejected") phases[p].rejected++;
      else if(tx.status === "cancelled") phases[p].cancelled++;
    }
  });
  return phases;
}

/* ========== SESSION REPORT EXPORT ========== */
function fragName(nr) { return nr===1?"Adamsów":nr===2?"Bennetów":nr===3?"Clintonów":nr===4?"Dexterów":nr===5?"Szeryfa":"?"; }

function generateReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed, consultNotes) {
  var fd = gameState ? gameState.fd : null;
  var relData = gameState ? gameState.relations || {} : {};
  var lines = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  WDZ MONITOR – RAPORT DIAGNOSTYCZNY");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("Kod rozgrywki: " + roomCode);
  lines.push("Raport wygenerowany: " + new Date().toLocaleString("pl"));
  lines.push("Czas monitorowania: " + Math.floor(elapsed/3600) + "h " + Math.floor((elapsed%3600)/60) + "min");
  var st = gameState && gameState.stageIdx != null ? STAGES[gameState.stageIdx] : null;
  lines.push("Etap końcowy: " + (st ? st.label : "nieznany"));
  lines.push("");

  // META
  lines.push("── METADANE ──");
  var meta = (gameState && gameState.meta) || {};
  if(meta.client) lines.push("Klient: " + meta.client);
  if(meta.group) lines.push("Grupa: " + meta.group);
  if(meta.sheriffEmail) lines.push("Szeryf: " + meta.sheriffEmail);
  if(meta.sheriff2Email) lines.push("Szeryf 2: " + meta.sheriff2Email);
  if(meta.createdAt) lines.push("Utworzenie rozgrywki: " + new Date(meta.createdAt).toLocaleString("pl"));
  lines.push("");

  // CONFIG
  lines.push("── KONFIGURACJA ──");
  lines.push("Biznes na Boku: " + (gameState&&gameState.bnbEnabled ? "TAK" : "NIE"));
  lines.push("Ślepy Los: " + (gameState&&gameState.fateEnabled ? "TAK" : "NIE"));
  lines.push("Złotodajna Żyła: " + (gameState&&gameState.mapEnabled!==false ? "TAK" : "NIE"));
  lines.push("Rewolwerowiec: " + (gameState&&gameState.revEnabled ? "TAK (tryb: "+(gameState.revMode||"arena")+", maxBet: "+(gameState.revMaxBet||60)+"$)" : "NIE"));
  lines.push("");

  // WINNER + SCORES
  lines.push("── WYNIKI RODZIN ──");
  if(scores && fd) {
    var bestFam = null, bestPts = -999;
    FO.forEach(fId => {
      var relScore = calcRelationScore(fId, relData);
      var total = (scores[fId] ? scores[fId].bizTotal : 0) + relScore;
      if(total > bestPts) { bestPts = total; bestFam = fId; }
    });
    if(bestFam) lines.push("ZWYCIĘZCA: " + FM[bestFam].nom + " (" + Math.round(bestPts) + " pkt)");
    lines.push("");
    FO.forEach(fId => {
      var sc = scores[fId]; if(!sc) return;
      var relScore = calcRelationScore(fId, relData);
      var total = Math.round(sc.bizTotal + relScore);
      var f = FM[fId];
      lines.push(FM[fId].nom + ": " + total + " pkt");
      lines.push("  Zasoby: " + sc.resScore + "/30 (resPct=" + sc.resPct + "%)");
      lines.push("  Kompetencje: " + sc.compScore + "/25 (compPct=" + sc.compPct + "%)");
      lines.push("  Działka: " + sc.plotScore + "/10 (" + (sc.plotOk ? "właściwa nr "+f.tPlot : "niewłaściwa") + ")");
      var cashForScoreVal = gameState.bnbEnabled ? fd[fId].cash * (1 + (sc.bnbObligacje||0) * 0.2) : fd[fId].cash;
      lines.push("  Gotówka: " + sc.cashScore + "/25 (cash=" + fd[fId].cash + "$" + (sc.bnbObligacje>0 ? ", cashForScore=" + Math.round(cashForScoreVal) + "$ [×" + (1+sc.bnbObligacje*0.2) + " Obligacje]" : "") + ")");
      var uniqueFrags = ensureArray(fd[fId].items).filter(i=>i.cat===C_MAP);
      var fragNrs = [...new Set(uniqueFrags.map(i=>i.fragNr))];
      lines.push("  Złotodajna Żyła: " + sc.mapScore + "/10 (fragmenty: " + (fragNrs.length>0 ? fragNrs.map(fragName).join(", ") : "brak") + ")");
      lines.push("  BnB: " + sc.bnb + " pkt (Kwatera:" + (sc.bnbKwatera||0) + " Kurier:" + (sc.bnbKurier||0) + (sc.resPct>=100&&sc.bnbKurier>0?" [bonus]":" [%]") + " Mikstura:" + (sc.bnbMikstura||0) + (sc.compPct>=100&&sc.bnbMikstura>0?" [bonus]":" [%]") + " Obligacje:" + (sc.bnbObligacje||0) + ")");
      lines.push("  Relacje: " + relScore + "/20");
      lines.push("  bizTotal=" + sc.bizTotal + " + relacje=" + relScore + " = " + total);
      lines.push("");
    });
  }

  // INWENTARZ KART
  lines.push("── INWENTARZ KART (stan końcowy) ──");
  if(fd) {
    FO.forEach(fId => {
      var items = ensureArray(fd[fId].items);
      var f = FM[fId];
      lines.push(FM[fId].nom + " (" + items.length + " kart):");
      var res = items.filter(i=>i.cat===C_RES&&!i.blind);
      var comp = items.filter(i=>i.cat===C_COMP&&!i.blind);
      var nres = items.filter(i=>i.cat==="nres");
      var ncomp = items.filter(i=>i.cat==="ncomp");
      var plots = items.filter(i=>i.cat===C_PLOT);
      var maps = items.filter(i=>i.cat===C_MAP);
      var bnb = items.filter(i=>i.cat===C_BNB);
      if(res.length) lines.push("  Zasoby (" + res.length + "): " + res.map(i=>i.name+(i.forBiz===f.biz?" ✓":"")+(i.weight?" ["+i.weight+"%]":"")).join(", "));
      if(comp.length) lines.push("  Kompetencje (" + comp.length + "): " + comp.map(i=>i.name+(i.forBiz===f.biz?" ✓":"")+(i.weight?" ["+i.weight+"%]":"")).join(", "));
      if(nres.length) lines.push("  Notatki zasobów (" + nres.length + "): " + nres.map(i=>i.name).join(", "));
      if(ncomp.length) lines.push("  Notatki kompetencji (" + ncomp.length + "): " + ncomp.map(i=>i.name).join(", "));
      if(plots.length) lines.push("  Działki: " + plots.map(i=>"nr "+i.plotNr+(i.plotNr===f.tPlot?" ✓ (docelowa)":" ✗ (docelowa: "+f.tPlot+")")).join(", "));
      if(maps.length) lines.push("  Fragmenty mapy: " + [...new Set(maps.map(i=>i.fragNr))].map(fragName).join(", ") + " (kopii łącznie: "+maps.length+")");
      if(bnb.length) lines.push("  BnB: " + bnb.map(i=>i.name).join(", "));
    });
  }
  lines.push("");

  // BILANS GOTÓWKOWY
  lines.push("── BILANS GOTÓWKOWY ──");
  if(fd && gameState) {
    FO.forEach(fId => {
      var bal = ["600$ (start)"];
      var txArr = ensureArray(gameState.txs || []);
      var tradeIn=0, tradeOut=0;
      txArr.forEach(tx => {
        if(!tx||tx.status!=="accepted") return;
        if(tx.type==="sale"||tx.type==="barter") {
          if(tx.from===fId) tradeOut += (tx.offerCash||tx.offeredCash||0);
          if(tx.to===fId) tradeIn += (tx.offerCash||tx.offeredCash||0);
          if(tx.from===fId) tradeIn += (tx.requestCash||tx.responseCash||0);
          if(tx.to===fId) tradeOut += (tx.requestCash||tx.responseCash||0);
          // Sale: price flows from buyer(to) to seller(from)
          if(tx.type==="sale") {
            if(tx.from===fId) tradeIn += (tx.price||0);
            if(tx.to===fId) tradeOut += (tx.price||0);
          }
        }
      });
      if(tradeIn) bal.push("+ " + tradeIn + "$ przychody z handlu");
      if(tradeOut) bal.push("- " + tradeOut + "$ wydatki z handlu");
      var bf = (gameState.blindFate||{})[fId];
      if(bf&&bf.rolls) {
        ensureArray(bf.rolls).forEach(r => {
          if(!r||!r.resolved||!r.event) return;
          if(r.policyUsed===100) bal.push("- 50$ polisa 100%");
          else if(r.policyUsed===50) bal.push("- 30$ polisa 50%");
          if(r.netEffect && r.netEffect!==0) bal.push((r.netEffect>0?"+ ":"- ") + Math.abs(r.netEffect) + "$ Ślepy Los");
        });
      }
      var calls = ensureArray(gameState.sheriffCalls||[]).filter(c=>c&&c.fId===fId||c&&c.family===fId);
      var soldC = calls.filter(c=>c.status==="sold").length;
      if(soldC) bal.push("- " + (soldC*15) + "$ konsultacje ("+soldC+"×15$)");
      var penTx = txArr.filter(t=>t&&(t.type==="penalty"||t.type==="plot_cost")&&t.from===fId);
      if(penTx.length) bal.push("- 50$ dodatkowy koszt (działka)");
      var settleTx = txArr.filter(t=>t&&t.type==="bnb_settle"&&t.from===fId);
      var bonusTx = txArr.filter(t=>t&&t.type==="bnb_bonus"&&t.to===fId);
      if(settleTx.length) bal.push("- 300$ prowizja dla dostawcy BnB");
      if(bonusTx.length) bal.push("+ 100$ rabat od dostawcy");
      var mapTx = txArr.filter(t=>t&&t.type==="map_bonus");
      var isMapWinner = mapTx.some(t=>t.from===fId);
      var isMapLoser = mapTx.length>0 && !isMapWinner;
      if(isMapWinner) bal.push("+ 300$ premia za Złotodajną Żyłę");
      if(isMapLoser) bal.push("- 100$ koszt premii za Złotodajną Żyłę");
      bal.push("= " + fd[fId].cash + "$ (końcowa)");
      lines.push(FM[fId].nom + ": " + bal.join(" → "));
    });
  }
  lines.push("");

  // TRANSAKCJE
  lines.push("── TRANSAKCJE ──");
  if(txStats) {
    lines.push("Łącznie: " + txStats.total + " | Zaakceptowane: " + txStats.accepted + " | Odrzucone: " + txStats.rejected + " | Anulowane: " + txStats.cancelled);
    lines.push("Per faza:  I: " + phaseStats[1].total + "  II: " + phaseStats[2].total + "  III: " + phaseStats[3].total);
    if(Object.keys(txStats.pairs).length > 0) {
      lines.push("Per para:");
      Object.entries(txStats.pairs).forEach(([pair, data]) => {
        var parts = pair.split("-");
        var aLabel = FM[parts[0]] ? FM[parts[0]].gen : parts[0];
        var bLabel = FM[parts[1]] ? FM[parts[1]].gen : parts[1];
        lines.push("  " + aLabel + " – " + bLabel + ": " + data.total + " tx (✓" + data.accepted + " ✗" + data.rejected + " ⊘" + data.cancelled + ")");
      });
    }
  }
  lines.push("");

  // RYTM TRANSAKCJI PER TURA
  lines.push("── RYTM TRANSAKCJI PER TURA ──");
  var tradeTxForRhythm = txs.filter(t => t && t.status === "accepted" && (t.type === "sale" || t.type === "barter") && t.phase !== undefined && t.phase !== null);
  if(tradeTxForRhythm.length > 0 && fd) {
    var turnLabels = ["F1T1","F1T2","F1T3","F2T1","F2T2","F2T3","F3T1","F3T2","F3T3"];
    var txPerTurn = {};
    FO.forEach(fId => { txPerTurn[fId] = [0,0,0,0,0,0,0,0,0]; });
    tradeTxForRhythm.forEach(tx => {
      var p = tx.phase;
      if(p >= 0 && p <= 8) {
        if(tx.from && txPerTurn[tx.from]) txPerTurn[tx.from][p]++;
        if(tx.to && txPerTurn[tx.to]) txPerTurn[tx.to][p]++;
      }
    });
    lines.push("                 " + turnLabels.join("  "));
    FO.forEach(fId => {
      var name = (FM[fId].nom + "               ").slice(0, 16);
      lines.push(name + " " + txPerTurn[fId].map(n => String(n).padStart(4)).join("  "));
    });
  } else {
    lines.push("Brak danych (transakcje bez przypisanej tury).");
  }
  lines.push("");

  // REALIZACJA ZADAŃ
  lines.push("── REALIZACJA ZADAŃ ──");
  if(fd) {
    FO.forEach(fId => {
      var f = FM[fId];
      var items = fd[fId] ? fd[fId].items || [] : [];
      if(!Array.isArray(items)) items = Object.values(items);
      var task = G_TASKS[fId];
      var resItems = items.filter(i => i.cat === C_RES && i.forBiz === f.biz);
      var resPct = resItems.reduce((s, i) => s + (i.weight || 0), 0);
      var compItems = items.filter(i => i.cat === C_COMP && i.forBiz === f.biz);
      var compPct = compItems.reduce((s, i) => s + (i.weight || 0), 0);
      var plots = items.filter(i => i.cat === C_PLOT);
      var hasCorrect = plots.some(i => i.plotNr === f.tPlot);
      var plotLabel = hasCorrect ? "docelowa (nr " + f.tPlot + ")" : plots.length > 0 ? "startowa (nr " + plots[0].plotNr + ")" : "brak";
      lines.push(f.nom + ":");
      lines.push("  Zasoby:       " + resItems.length + "/" + task.zasoby.length + " kart (" + resPct + "% wagi)");
      lines.push("  Kompetencje:  " + compItems.length + "/" + task.kompetencje.length + " kart (" + compPct + "% wagi)");
      lines.push("  Działka:      " + plotLabel);
    });
  } else {
    lines.push("Brak danych fd.");
  }
  lines.push("");

  // ŚLEPY LOS
  lines.push("── ŚLEPY LOS ──");
  var bfData = gameState ? gameState.blindFate || {} : {};
  var anyFate = false;
  FO.forEach(fId => {
    var bf = bfData[fId];
    if(!bf || !bf.rolls) return;
    var rolls = ensureArray(bf.rolls).filter(r => r && r.resolved);
    if(rolls.length === 0) return;
    anyFate = true;
    lines.push(FM[fId].nom + ":");
    rolls.forEach(r => {
      var ev = r.event || {};
      var policyLabel = r.policyUsed === 100 ? " [polisa 100%]" : r.policyUsed === 50 ? " [polisa 50%]" : "";
      var effectText = r.netEffectText || (ev.amount ? (ev.amount > 0 ? "+" : "") + ev.amount + "$" : "brak efektu");
      lines.push("  🎲 " + (r.dice1||"?") + "+" + (r.dice2||"?") + "=" + (r.sum||"?") + "  " + (ev.text || "–") + "  → " + effectText + policyLabel);
    });
  });
  if(!anyFate) lines.push("Brak rzutów Ślepego Losu");
  lines.push("");

  // BnB
  lines.push("── BIZNES NA BOKU ──");
  if(gameState && gameState.bnbEnabled && fd) {
    FO.forEach(fId => {
      var items = ensureArray(fd[fId].items);
      var bnbAll = items.filter(i => i.cat === C_BNB);
      var ownProduct = BNB_PRODUCTS[fId];
      var ownCards = bnbAll.filter(i => i.bnbOrigin === fId || i.name === ownProduct.name);
      var boughtCards = bnbAll.filter(i => i.bnbOrigin !== fId && i.name !== ownProduct.name);
      var sold = ownProduct.qty - ownCards.length;
      lines.push(FM[fId].nom + " (" + ownProduct.shortName + "): własnych " + ownCards.length + "/" + ownProduct.qty + " | sprzedano " + sold + " | kupiono " + boughtCards.length);
      if(boughtCards.length > 0) {
        var byType = {};
        boughtCards.forEach(c => { byType[c.name] = (byType[c.name]||0) + 1; });
        Object.entries(byType).forEach(([name, cnt]) => { lines.push("    " + name + ": " + cnt); });
      }
    });
    if(gameState.bnbSettled) {
      lines.push("Rozliczenie z dostawcą: TAK");
    }
  } else { lines.push("BnB nieaktywny"); }
  lines.push("");

  // RELACJE
  lines.push("── RELACJE ──");
  var anyRel = false;
  FO.forEach(rater => {
    if(!relData[rater]) return;
    FO.forEach(rated => {
      if(rater === rated) return;
      var r = relData[rater] && relData[rater][rated];
      if(!r) return;
      anyRel = true;
      var total = (r.partnership || 0) + (r.rules || 0) + (r.communication || 0);
      lines.push("  " + FM[rater].nom + " → " + FM[rated].nom + ": " + total + "/15 (P:" + (r.partnership||0) + " Z:" + (r.rules||0) + " K:" + (r.communication||0) + ")");
    });
  });
  if(!anyRel) lines.push("Brak danych o relacjach");
  lines.push("");

  // MACIERZ HANDLU
  lines.push("── MACIERZ HANDLU ──");
  var txsAll = gameState && gameState.txs ? ensureArray(gameState.txs) : [];
  var acceptedTx = txsAll.filter(t => t && t.status === "accepted" && t.from && t.to && FO.includes(t.from) && FO.includes(t.to));
  if(acceptedTx.length > 0) {
    lines.push("Od \\ Do      | Adams    | Bennet   | Clinton  | Dexter");
    lines.push("─".repeat(65));
    FO.forEach(from => {
      var cells = FO.map(to => {
        if(from === to) return "   –    ";
        var items = 0, cash = 0;
        acceptedTx.forEach(tx => {
          if(tx.from===from && tx.to===to) { items+=ensureArray(tx.offerItems||tx.offeredItems).length; cash+=(tx.offerCash||tx.offeredCash||0); }
          if(tx.to===from && tx.from===to) { items+=ensureArray(tx.requestItems||tx.responseItems).length; cash+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0); }
        });
        if(items===0 && cash===0) return "   –    ";
        return (items>0?items+"k":"")+(items>0&&cash>0?"+":"")+(cash>0?cash+"$":"");
      });
      lines.push(FM[from].nom.padEnd(13) + " | " + cells.map(c=>c.padStart(8)).join(" | "));
    });
  } else { lines.push("Brak zaakceptowanych transakcji"); }
  lines.push("");

  // PEŁNA HISTORIA TRANSAKCJI
  lines.push("── PEŁNA HISTORIA TRANSAKCJI ──");
  var tradeTxAll = txsAll.filter(t => t && (t.type==="sale"||t.type==="barter") && FO.includes(t.from) && FO.includes(t.to));
  if(tradeTxAll.length > 0) {
    tradeTxAll.forEach((tx,idx) => {
      var sL = tx.status==="accepted"?"✓":tx.status==="rejected"?"✗":tx.status==="cancelled"?"⊘":tx.status;
      var tL = tx.type==="sale"?"SPRZEDAŻ":"BARTER";
      var ln2 = "  "+(idx+1)+". "+sL+" "+tL+": "+FM[tx.from].nom+" → "+FM[tx.to].nom;
      var offered = ensureArray(tx.offeredItems||tx.offerItems);
      var oC = tx.offeredCash||tx.offerCash||0;
      if(offered.length||oC) ln2+=" | Oferta: "+(offered.length?offered.length+"k":"")+(offered.length&&oC?"+":"")+(oC?oC+"$":"");
      if(tx.type==="sale"&&tx.price) ln2+=" | Cena: "+tx.price+"$";
      if(tx.type==="barter"){var resp=ensureArray(tx.responseItems||tx.requestItems);var rC=tx.responseCash||tx.requestCash||0;if(resp.length||rC) ln2+=" | Odp: "+(resp.length?resp.length+"k":"")+(resp.length&&rC?"+":"")+(rC?rC+"$":"");}
      lines.push(ln2);
      if(offered.length>0) lines.push("      Karty: "+offered.map(i=>typeof i==="string"?i:(i.name||i.id||"?")).join(", "));
    });
    lines.push("Łącznie: "+tradeTxAll.length+" transakcji handlowych");
  } else { lines.push("Brak transakcji handlowych"); }
  lines.push("");

  // REWOLWEROWIEC
  if(gameState && gameState.revEnabled) {
    lines.push("── REWOLWEROWIEC ──");
    var duels = ensureArray(gameState.revDuels || []);
    if(duels.length > 0) {
      duels.forEach((d,i) => { if(!d) return; lines.push("  Pojedynek " + (i+1) + ": " + (FM[d.challenger]||{}).nom + " vs " + (FM[d.opponent]||{}).nom + " | " + (d.bet||0) + "$ | Zwycięzca: " + ((FM[d.winner]||{}).nom||"?")); });
    } else { lines.push("Brak pojedynków"); }
    lines.push("");
  }

  // KONSULTACJE
  lines.push("── KONSULTACJE Z SZERYFEM ──");
  var calls = gameState ? gameState.sheriffCalls || [] : [];
  if(Array.isArray(calls) && calls.length > 0) {
    var soldCalls = calls.filter(c => c && c.status === "sold");
    lines.push("Sprzedane: " + soldCalls.length + " (" + (soldCalls.length*15) + "$)");
    soldCalls.forEach(c => { lines.push("  " + (FM[c.family||c.fId]||{nom:"?"}).nom + " – " + (c.topic||"")); });
  } else { lines.push("Brak konsultacji"); }
  lines.push("");

  // NOTATKI SZERYFA
  lines.push("── NOTATKI SZERYFA ──");
  var cn = consultNotes || {};
  var anyNotes = false;
  FO.forEach(fId => {
    if(cn[fId] && cn[fId].trim()) {
      anyNotes = true;
      lines.push(FM[fId].nom + ":");
      cn[fId].trim().split("\n").forEach(l => lines.push("  " + l));
    }
  });
  if(!anyNotes) lines.push("Brak notatek");
  lines.push("");

  // ANOMALIE
  lines.push("── ANOMALIE ──");
  var anomalies = eventLog.filter(ev => ev.sev >= SEV.WARN);
  if(anomalies.length > 0) {
    var anomByCat = {};
    anomalies.forEach(ev => { if(!anomByCat[ev.cat]) anomByCat[ev.cat]=[]; anomByCat[ev.cat].push(ev); });
    Object.entries(anomByCat).forEach(([cat, evts]) => {
      lines.push(cat + " (" + evts.length + "):");
      var unique = {}; evts.forEach(ev => { unique[ev.msg]=(unique[ev.msg]||0)+1; });
      Object.entries(unique).forEach(([msg, cnt]) => { lines.push("  " + (cnt>1?"("+cnt+"×) ":"") + msg); });
    });
  } else { lines.push("Brak anomalii"); }
  lines.push("");

  // TIMESTAMPY ETAPÓW
  lines.push("── ETAPY (czas trwania) ──");
  if(cashSnapshots.length > 1) {
    for(var si=1; si<cashSnapshots.length; si++) {
      var sSnap = cashSnapshots[si];
      var pSnap = cashSnapshots[si-1];
      var sId = STAGES[sSnap.stageIdx] ? STAGES[sSnap.stageIdx].id : "?";
      if(sSnap.ts && pSnap.ts) {
        var dur = Math.round((sSnap.ts - pSnap.ts)/1000);
        lines.push("  " + sId.padEnd(8) + dur + "s");
      }
    }
  }
  lines.push("");

  // TREND GOTÓWKI
  lines.push("── TREND GOTÓWKI ──");
  if(cashSnapshots.length > 0) {
    lines.push("Etap    | Adams  | Bennet | Clinton| Dexter | Δ Adams| Δ Benn.| Δ Clin.| Δ Dext.");
    cashSnapshots.forEach((snap, idx) => {
      var id = (STAGES[snap.stageIdx]?.id || "?").padEnd(7);
      var prev = idx > 0 ? cashSnapshots[idx-1].cash : null;
      var deltas = FO.map(f => { if(!prev) return "      "; var d=snap.cash[f]-prev[f]; return (d>=0?"+":"")+String(d).padStart(5); });
      lines.push(id + " | " + FO.map(f => String(snap.cash[f]).padStart(6)).join(" | ") + " | " + deltas.join(" | "));
    });
  }
  lines.push("");

  // POŁĄCZENIA
  lines.push("── POŁĄCZENIA ──");
  FO.forEach(fId => {
    var hist = connHistory[fId] || [];
    var disc = hist.filter(h => h.event === "disconnect").length;
    lines.push(FM[fId].nom + ": " + hist.length + (hist.length===1?" zdarzenie":hist.length>=2&&hist.length<=4?" zdarzenia":" zdarzeń") + ", " + disc + (disc===1?" rozłączenie":disc>=2&&disc<=4?" rozłączenia":" rozłączeń"));
  });
  lines.push("");

  // WERYFIKACJA
  lines.push("── WERYFIKACJA AUTOMATYCZNA ──");
  if(fd) {
    var totalCash = 0, totalItems = 0;
    FO.forEach(fId => { totalCash += fd[fId].cash; totalItems += ensureArray(fd[fId].items).length; });
    lines.push("Suma gotówki: " + totalCash + "$");
    lines.push("Suma kart: " + totalItems);
    if(scores) {
      var ok = true;
      FO.forEach(fId => {
        var sc = scores[fId]; if(!sc) return;
        var recalc = calcScore(fId, fd, {}, gameState.biznesNaBoku||{}, gameState.bnbEnabled, gameState.blindFate||{}, gameState.mapEnabled!==false, gameState.mapBonusClaimed||{});
        if(recalc.bizTotal !== sc.bizTotal) { lines.push("  ⚠ " + FM[fId].nom + ": bizTotal monitor=" + sc.bizTotal + " vs przeliczony=" + recalc.bizTotal); ok=false; }
      });
      if(ok) lines.push("Wyniki: ✅ zgodne z przeliczeniem");
    }
  }
  lines.push("");

  // DZIENNIK
  lines.push("── DZIENNIK (pełny – " + eventLog.length + " wpisów) ──");
  eventLog.forEach(ev => { lines.push("[" + ev.ts + "] " + SEV_LABEL[ev.sev] + " " + ev.cat + ": " + ev.msg); });

  return lines.join("\n");
}

/* ========== TRAINER REPORT (dla trenera – bez technikaliów) ========== */
function generateTrainerReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed) {
  var fd = gameState ? gameState.fd : null;
  var relData = gameState ? gameState.relations || {} : {};
  var lines = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  WSCHÓD DZIKIEGO ZACHODU – RAPORT DLA TRENERA");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("Kod rozgrywki: " + roomCode);
  var meta = (gameState && gameState.meta) || {};
  if(meta.createdAt) lines.push("Data rozgrywki: " + new Date(meta.createdAt).toLocaleDateString("pl"));
  if(meta.client) lines.push("Klient: " + meta.client);
  if(meta.group) lines.push("Grupa: " + meta.group);
  lines.push("");

  // WYNIKI
  lines.push("── WYNIKI ──");
  if(scores && fd) {
    var bestFam = null, bestPts = -999;
    FO.forEach(fId => {
      var relScore = calcRelationScore(fId, relData);
      var total = (scores[fId] ? scores[fId].bizTotal : 0) + relScore;
      if(total > bestPts) { bestPts = total; bestFam = fId; }
    });
    if(bestFam) lines.push("ZWYCIĘZCA: " + FM[bestFam].nom + " (" + Math.round(bestPts) + " pkt)");
    lines.push("");
    FO.forEach(fId => {
      var sc = scores[fId]; if(!sc) return;
      var relScore = calcRelationScore(fId, relData);
      var total = Math.round(sc.bizTotal + relScore);
      lines.push(FM[fId].nom + ": " + total + " pkt");
      lines.push("  Zasoby: " + sc.resScore + "/30 | Kompetencje: " + sc.compScore + "/25 | Działka: " + sc.plotScore + "/10 | Gotówka: " + sc.cashScore + "/25 (" + fd[fId].cash + "$) | Złotodajna Żyła: " + sc.mapScore + "/10" + (sc.bnb>0?" | BnB: "+sc.bnb:"") + " | Relacje: " + relScore + "/20");
    });
  }
  lines.push("");

  // TRANSAKCJE
  lines.push("── TRANSAKCJE ──");
  if(txStats) {
    lines.push("Łącznie: " + txStats.total + " | Zaakceptowane: " + txStats.accepted + " | Odrzucone: " + txStats.rejected);
    if(Object.keys(txStats.pairs).length > 0) {
      lines.push("Per para:");
      Object.entries(txStats.pairs).forEach(([pair, data]) => {
        var parts = pair.split("-");
        if(!FO.includes(parts[0])||!FO.includes(parts[1])) return;
        lines.push("  " + FM[parts[0]].gen + " – " + FM[parts[1]].gen + ": " + data.total + " tx (✓" + data.accepted + " ✗" + data.rejected + ")");
      });
    }
  }
  lines.push("");

  // RELACJE
  lines.push("── RELACJE ──");
  var anyRel = false;
  FO.forEach(rater => {
    if(!relData[rater]) return;
    FO.forEach(rated => {
      if(rater===rated) return;
      var r = relData[rater]&&relData[rater][rated]; if(!r) return;
      anyRel = true;
      var total = (r.partnership||0)+(r.rules||0)+(r.communication||0);
      lines.push("  " + FM[rater].nom + " → " + FM[rated].nom + ": " + total + "/15 (partnerstwo:" + (r.partnership||0) + " zasady:" + (r.rules||0) + " komunikacja:" + (r.communication||0) + ")");
    });
  });
  if(!anyRel) lines.push("Brak danych o relacjach");
  lines.push("");

  // ŚLEPY LOS
  lines.push("── ŚLEPY LOS ──");
  var bfData = gameState ? gameState.blindFate || {} : {};
  var anyFate = false;
  FO.forEach(fId => {
    var bf=bfData[fId]; if(!bf||!bf.rolls) return;
    var rolls=ensureArray(bf.rolls).filter(r=>r&&r.resolved); if(rolls.length===0) return;
    anyFate = true;
    lines.push(FM[fId].nom + ":");
    rolls.forEach(r => {
      var ev=r.event||{};
      var effectText = r.netEffectText || (ev.amount?(ev.amount>0?"+":"")+ev.amount+"$":"brak efektu");
      lines.push("  🎲 " + (r.sum||"?") + " – " + (ev.text||"–") + " → " + effectText);
    });
  });
  if(!anyFate) lines.push("Brak rzutów");
  lines.push("");

  // BnB
  if(gameState && gameState.bnbEnabled) {
    lines.push("── BIZNES NA BOKU ──");
    if(fd) FO.forEach(fId => {
      var items=ensureArray(fd[fId].items);
      var bnbAll=items.filter(i=>i.cat===C_BNB);
      var ownProduct=BNB_PRODUCTS[fId];
      var sold=ownProduct.qty-bnbAll.filter(i=>i.bnbOrigin===fId||i.name===ownProduct.name).length;
      var bought=bnbAll.filter(i=>i.bnbOrigin!==fId&&i.name!==ownProduct.name).length;
      lines.push("  " + FM[fId].nom + ": sprzedano " + sold + "/" + ownProduct.qty + " " + ownProduct.shortName + ", kupiono " + bought + " od innych");
    });
    lines.push("");
  }

  // MACIERZ HANDLU
  lines.push("── MACIERZ HANDLU ──");
  var txsAll = gameState&&gameState.txs ? ensureArray(gameState.txs) : [];
  var acceptedTx = txsAll.filter(t=>t&&t.status==="accepted"&&t.from&&t.to&&FO.includes(t.from)&&FO.includes(t.to));
  if(acceptedTx.length > 0) {
    lines.push("Od \\ Do      | Adams    | Bennet   | Clinton  | Dexter");
    lines.push("─".repeat(65));
    FO.forEach(from => {
      var cells=FO.map(to => {
        if(from===to) return "   –    ";
        var items=0,cash=0;
        acceptedTx.forEach(tx => {
          if(tx.from===from&&tx.to===to){items+=ensureArray(tx.offerItems||tx.offeredItems).length;cash+=(tx.offerCash||tx.offeredCash||0);}
          if(tx.to===from&&tx.from===to){items+=ensureArray(tx.requestItems||tx.responseItems).length;cash+=(tx.requestCash||tx.responseCash||0)+(tx.type==="sale"?(tx.price||0):0);}
        });
        if(items===0&&cash===0) return "   –    ";
        return (items>0?items+"k":"")+(items>0&&cash>0?"+":"")+(cash>0?cash+"$":"");
      });
      lines.push(FM[from].nom.padEnd(13)+" | "+cells.map(c=>c.padStart(8)).join(" | "));
    });
  } else { lines.push("Brak zaakceptowanych transakcji"); }
  lines.push("");

  // REWOLWEROWIEC
  if(gameState && gameState.revEnabled) {
    lines.push("── REWOLWEROWIEC ──");
    var duels=ensureArray(gameState.revDuels||[]);
    if(duels.length>0) { duels.forEach((d,i)=>{if(!d)return;lines.push("  Pojedynek "+(i+1)+": "+(FM[d.challenger]||{}).nom+" vs "+(FM[d.opponent]||{}).nom+" | "+(d.bet||0)+"$ | Zwycięzca: "+((FM[d.winner]||{}).nom||"?"));}); }
    else { lines.push("Brak pojedynków"); }
    lines.push("");
  }

  return lines.join("\n");
}

function downloadReport(text, roomCode, suffix) {
  var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "wdz-" + (suffix || "monitor") + "-" + roomCode + "-" + new Date().toISOString().slice(0,10) + ".txt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========== MAIN APP ========== */

function MonitorView({roomCode: propCode, onClose}) {
  const [roomCode, setRoomCode] = React.useState(propCode);
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [gameState, setGameState] = React.useState(null);
  const [players, setPlayers] = React.useState(null);
  const [eventLog, setEventLog] = React.useState([]);
  const [lastUpdate, setLastUpdate] = React.useState(null);
  const [updateCount, setUpdateCount] = React.useState(0);
  const prevStateRef = React.useRef(null);
  const listenersRef = React.useRef([]);
  // v0.2.0 additions
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [logFilter, setLogFilter] = React.useState("all"); // "all"|"warn"|"error"
  const [connHistory, setConnHistory] = React.useState({}); // {fId: [{ts, event:"connect"|"disconnect"}]}
  const prevPlayersRef = React.useRef(null);
  const [connectedAt, setConnectedAt] = React.useState(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [cashSnapshots, setCashSnapshots] = React.useState([]); // [{stageIdx, ts, cash:{adams:N,...}}]
  const pendingFirstSeen = React.useRef({}); // {txId: timestamp} – track when we first see a pending tx
  const [reactionTimes, setReactionTimes] = React.useState([]); // [{txId, from, to, duration, result}]
  const [txByPhase, setTxByPhase] = React.useState({1:0,2:0,3:0});
  const lastTxCount = React.useRef(0);

  function getPhase(idx) {
    if(idx==null) return 0;
    if(idx>=1&&idx<=6) return 1;
    if(idx>=7&&idx<=12) return 2;
    if(idx>=13) return 3;
    return 0;
  }

  // Cleanup listeners on disconnect
  function disconnectAll() {
    listenersRef.current.forEach(({ref, cb}) => ref.off("value", cb));
    listenersRef.current = [];
    setConnected(false);
    setGameState(null);
    setPlayers(null);
    setConnHistory({});
    setCashSnapshots([]);
    prevPlayersRef.current = null;
    addEvent(SEV.INFO, "SYSTEM", "Rozłączono z rozgrywką " + roomCode);
  }

  function addEvent(sev, cat, msg) {
    setEventLog(prev => [{ts:ts(), sev, cat, msg, key:Date.now()+Math.random()}, ...prev].slice(0, 500));
  }

  // Session elapsed timer
  React.useEffect(() => {
    if(!connectedAt) return;
    var iv = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [connectedAt]);

  // Connection tracking – detect connect/disconnect per family + sheriff
  React.useEffect(() => {
    if(!players) return;
    var prev = prevPlayersRef.current;
    prevPlayersRef.current = JSON.parse(JSON.stringify(players));
    if(!prev) return;

    // Sheriff
    var sheriffNow = players.sheriff && players.sheriff.connected;
    var sheriffPrev = prev.sheriff && prev.sheriff.connected;
    if(sheriffNow && !sheriffPrev) addEvent(SEV.INFO, "POŁĄCZENIE", "Szeryf ponownie online");
    if(!sheriffNow && sheriffPrev) addEvent(SEV.WARN, "POŁĄCZENIE", "Szeryf rozłączony");

    // Families
    FO.forEach(fId => {
      var nowMembers = (players[fId] && players[fId].members) ? Object.keys(players[fId].members).length : 0;
      var prevMembers = (prev[fId] && prev[fId].members) ? Object.keys(prev[fId].members).length : 0;
      if(nowMembers > 0 && prevMembers === 0) {
        addEvent(SEV.INFO, "POŁĄCZENIE", FM[fId].nom + " – gracze online (" + nowMembers + ")");
        setConnHistory(h => {var n={...h}; if(!n[fId])n[fId]=[]; n[fId]=[...n[fId],{ts:Date.now(),event:"connect"}]; return n;});
      }
      if(nowMembers === 0 && prevMembers > 0) {
        addEvent(SEV.WARN, "POŁĄCZENIE", FM[fId].nom + " – wszyscy gracze offline");
        setConnHistory(h => {var n={...h}; if(!n[fId])n[fId]=[]; n[fId]=[...n[fId],{ts:Date.now(),event:"disconnect"}]; return n;});
      }
      if(nowMembers > 0 && prevMembers > 0 && nowMembers !== prevMembers) {
        addEvent(SEV.INFO, "POŁĄCZENIE", FM[fId].nom + " – zmiana: " + prevMembers + " → " + nowMembers + " graczy");
      }
    });
  }, [players]);

  // Cash snapshots on stage change – forward-only, no undefined stages
  React.useEffect(() => {
    if(!gameState || !gameState.fd || gameState.stageIdx == null || gameState.stageIdx === undefined) return;
    var fd = gameState.fd;
    var cash = {};
    FO.forEach(fId => { cash[fId] = fd[fId] ? fd[fId].cash : 0; });
    setCashSnapshots(prev => {
      if(prev.length > 0 && prev[prev.length - 1].stageIdx >= gameState.stageIdx) return prev;
      return [...prev, {stageIdx: gameState.stageIdx, ts: Date.now(), cash}];
    });
  }, [gameState && gameState.stageIdx]);

  // Auto-connect on mount
  React.useEffect(() => {
    if(!propCode || !db) return;
    var code = propCode;
    setRoomCode(code);
    setError(null);

    db.ref("rooms/" + code + "/meta").once("value").then(snap => {
      if(!snap.exists()) { setError("Rozgrywka " + code + " nie istnieje"); return; }
      setConnected(true);
      setConnectedAt(Date.now());
      addEvent(SEV.INFO, "SYSTEM", "Podłączono do rozgrywki " + code);

      var gsRef = db.ref("rooms/" + code + "/gameState");
      var gsCb = gsRef.on("value", snap => {
        var s = snap.val();
        if(!s) return;
        if(s.fd) s.fd = fixFdFromFirebase(s.fd);
        if(s.txs) s.txs = ensureArray(s.txs);
        setGameState(prev => { prevStateRef.current = prev; return s; });
        setLastUpdate(new Date());
        setUpdateCount(c => c + 1);
      });
      listenersRef.current.push({ref:gsRef, cb:gsCb});

      var plRef = db.ref("rooms/" + code + "/players");
      var plCb = plRef.on("value", snap => { setPlayers(snap.val() || {}); });
      listenersRef.current.push({ref:plRef, cb:plCb});
    }).catch(e => { setError("Błąd połączenia: " + e.message); });

    return () => {
      listenersRef.current.forEach(({ref, cb}) => ref.off("value", cb));
      listenersRef.current = [];
    };
  }, [propCode]);

  // Run checks + change detection whenever gameState or players change
  React.useEffect(() => {
    if(!gameState) return;
    // Anomaly checks
    var checks = runChecks(gameState, players, prevStateRef.current);
    var hasError = false;
    checks.forEach(ev => {
      if(ev.sev !== SEV.INFO) {
        addEvent(ev.sev, ev.cat, ev.msg);
        if(ev.sev === SEV.ERROR) hasError = true;
      }
    });
    // Sound alert on error
    if(hasError && soundEnabled) playAlertBeep();
    // Change detection
    if(prevStateRef.current) {
      var changes = detectChanges(gameState, prevStateRef.current);
      changes.forEach(ev => addEvent(ev.sev, ev.cat, ev.msg));
    }
    // Reaction time tracking – track pending→resolved transitions
    var txs = gameState.txs ? ensureArray(gameState.txs) : [];
    var now = Date.now();
    // Phase-based transaction counting
    var curTxCount = txs.length;
    if(curTxCount > lastTxCount.current && gameState.stageIdx != null) {
      var newTx = curTxCount - lastTxCount.current;
      var phase = getPhase(gameState.stageIdx);
      if(phase > 0) setTxByPhase(prev => ({...prev, [phase]: prev[phase] + newTx}));
    }
    lastTxCount.current = curTxCount;
    txs.forEach(tx => {
      if(!tx.id) return;
      if(tx.status === "pending" || tx.status === "awaiting_response") {
        if(!pendingFirstSeen.current[tx.id]) pendingFirstSeen.current[tx.id] = now;
      }
      if((tx.status === "accepted" || tx.status === "rejected") && pendingFirstSeen.current[tx.id]) {
        var dur = (now - pendingFirstSeen.current[tx.id]) / 1000;
        delete pendingFirstSeen.current[tx.id];
        if(dur > 0.5) { // ignore sub-second (same update batch)
          setReactionTimes(prev => [...prev, {txId:tx.id, from:tx.from, to:tx.to, duration:Math.round(dur), result:tx.status}].slice(-100));
        }
      }
      if(tx.status === "cancelled" && pendingFirstSeen.current[tx.id]) {
        delete pendingFirstSeen.current[tx.id];
      }
    });
  }, [gameState, players]);

  // Current checks for display
  var currentChecks = React.useMemo(() => {
    if(!gameState) return [];
    return runChecks(gameState, players, prevStateRef.current);
  }, [gameState, players]);

  var txStats = React.useMemo(() => {
    if(!gameState || !gameState.txs) return null;
    return calcTxStats(ensureArray(gameState.txs));
  }, [gameState]);

  // Scores per family
  var scores = React.useMemo(() => {
    if(!gameState || !gameState.fd) return null;
    var fd = gameState.fd;
    var sc = {};
    FO.forEach(fId => {
      sc[fId] = monCalcScore(fId, fd, gameState.biznesNaBoku || {}, gameState.bnbEnabled, gameState.blindFate || {}, gameState.mapEnabled!==false, gameState.mapBonusClaimed || {});
    });
    return sc;
  }, [gameState]);

  // Filtered event log
  var filteredLog = React.useMemo(() => {
    if(logFilter === "all") return eventLog;
    if(logFilter === "warn") return eventLog.filter(e => e.sev === SEV.WARN || e.sev === SEV.ERROR);
    if(logFilter === "error") return eventLog.filter(e => e.sev === SEV.ERROR);
    return eventLog;
  }, [eventLog, logFilter]);

  // Phase breakdown – from monitor's own tracking
  var phaseStats = React.useMemo(() => {
    return {1:{total:txByPhase[1]},2:{total:txByPhase[2]},3:{total:txByPhase[3]}};
  }, [txByPhase]);

  // Reaction time stats
  var reactionStats = React.useMemo(() => {
    if(reactionTimes.length === 0) return null;
    var accepted = reactionTimes.filter(r => r.result === "accepted");
    var rejected = reactionTimes.filter(r => r.result === "rejected");
    var avgAll = reactionTimes.reduce((s, r) => s + r.duration, 0) / reactionTimes.length;
    var avgAcc = accepted.length > 0 ? accepted.reduce((s, r) => s + r.duration, 0) / accepted.length : 0;
    var avgRej = rejected.length > 0 ? rejected.reduce((s, r) => s + r.duration, 0) / rejected.length : 0;
    var maxTime = Math.max(...reactionTimes.map(r => r.duration));
    return {total:reactionTimes.length, avgAll:Math.round(avgAll), avgAcc:Math.round(avgAcc), avgRej:Math.round(avgRej), maxTime:Math.round(maxTime), accepted:accepted.length, rejected:rejected.length};
  }, [reactionTimes]);

  // Current stage info
  var curStage = gameState && gameState.stageIdx != null ? STAGES[gameState.stageIdx] : null;
  var elapsedStr = elapsed > 0 ? Math.floor(elapsed/3600) + ":" + String(Math.floor((elapsed%3600)/60)).padStart(2,"0") + ":" + String(elapsed%60).padStart(2,"0") : "0:00:00";

  // Styles
  var S = {
    page: {padding:0},
    header: {display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, borderBottom:"2px solid #842504", paddingBottom:16},
    title: {fontSize:28, color:"#D4A853", letterSpacing:1},
    badge: {fontSize:12, color:"#A89070", background:"#2C1810", padding:"4px 10px", borderRadius:4, border:"1px solid #3C2820"},
    connectBox: {background:"#2C1810", border:"1px solid #842504", borderRadius:8, padding:24, maxWidth:500, margin:"60px auto", textAlign:"center"},
    input: {background:"#1A0E08", border:"1px solid #5C3A2A", borderRadius:4, color:"#F5F0E8", padding:"10px 14px", fontSize:16, fontFamily:"'Alegreya Sans',sans-serif", width:"100%", marginBottom:12, textAlign:"center", letterSpacing:2},
    btn: {background:"#842504", color:"#F5F0E8", border:"none", borderRadius:4, padding:"10px 24px", fontSize:15, fontFamily:"'Alegreya Sans',sans-serif", fontWeight:700, cursor:"pointer", letterSpacing:1},
    btnSmall: {background:"#3C2820", color:"#D4A853", border:"1px solid #5C3A2A", borderRadius:4, padding:"6px 14px", fontSize:13, fontFamily:"'Alegreya Sans',sans-serif", cursor:"pointer"},
    grid: {display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20},
    card: {background:"#2C1810", border:"1px solid #3C2820", borderRadius:8, padding:16},
    cardTitle: {fontSize:15, fontWeight:700, color:"#D4A853", marginBottom:10, letterSpacing:0.5},
    familyRow: {display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #231810"},
    familyDot: (col, online) => ({width:10, height:10, borderRadius:"50%", background:online?col:"#4A3A30", border:"2px solid "+(online?col:"#5C4A40"), flexShrink:0}),
    feedItem: (sev) => ({display:"flex", gap:10, padding:"8px 12px", marginBottom:2, background:SEV_BG[sev], borderRadius:4, borderLeft:"3px solid "+SEV_COLOR[sev], fontSize:13}),
    feedTs: {color:"#7A6A5A", fontFamily:"monospace", fontSize:12, flexShrink:0, minWidth:65},
    feedCat: (sev) => ({color:SEV_COLOR[sev], fontWeight:700, fontSize:11, letterSpacing:0.5, flexShrink:0, minWidth:90}),
    feedMsg: {color:"#D0C8B8", flex:1},
    statusDot: (ok) => ({display:"inline-block", width:8, height:8, borderRadius:"50%", background:ok?"#6B8E6B":"#C04030", marginRight:6}),
    statNum: {fontSize:22, fontWeight:900, color:"#D4A853", lineHeight:1},
    statLabel: {fontSize:11, color:"#8A7A6A", letterSpacing:0.5},
  };

  /* ========== LOADING SCREEN ========== */
  if(!connected) {
    return (
      <div style={{padding:20, textAlign:"center"}}>
        <div style={{color:C.gold, fontSize:18, marginBottom:12}}>Łączenie z {propCode}…</div>
        {error && <div style={{color:"#C04030", fontSize:14, marginBottom:12}}>{error}</div>}
        <Btn small variant="ghost" onClick={onClose}>Wróć do listy</Btn>
      </div>
    );
  }

  /* ========== MAIN DASHBOARD ========== */
  var errorCount = currentChecks.filter(c => c.sev === SEV.ERROR).length;
  var warnCount = currentChecks.filter(c => c.sev === SEV.WARN).length;
  var allGood = errorCount === 0 && warnCount === 0;

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex", alignItems:"center", gap:16}}>
          <div className="wt" style={S.title}>WDZ Monitor</div>
          <span style={S.badge}>{roomCode}</span>
          {curStage && <span style={S.badge}>{curStage.label}</span>}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{fontSize:12, color:"#6A5A4A", textAlign:"right"}}>
            <div>Sesja: {elapsedStr}</div>
            <div>Odebrano: {updateCount} aktualizacji</div>
          </div>
          <button style={{...S.btnSmall, color:soundEnabled?"#8BC88B":"#7A6A5A"}} onClick={() => setSoundEnabled(s => !s)} title="Alert dźwiękowy">
            {soundEnabled ? "🔔" : "🔇"}
          </button>
          <button style={{...S.btnSmall}} onClick={() => {
            db.ref("rooms/"+roomCode+"/sheriffPrivate/consultNotes").once("value").then(snap => {
              var cn = snap.val() || {};
              try {
                var report = generateReport(roomCode, gameState, players, scores, txStats, phaseStats, eventLog, cashSnapshots, connHistory, elapsed, cn);
                if(!report || report.trim().length === 0) { alert("Raport jest pusty – brak danych do eksportu."); return; }
                downloadReport(report, roomCode, "diagnostyczny");
              } catch(e) { alert("Błąd generowania raportu: " + e.message); console.error("generateReport error:", e); }
            }).catch(e => { alert("Błąd: " + e.message); });
          }} title="Raport diagnostyczny">📋</button>
          <button style={S.btnSmall} onClick={() => {
            if(!gameState || !gameState.fd) { alert("Brak danych rozgrywki."); return; }
            var fd = gameState.fd;
            var sc = {};
            var relSc = {};
            var tot = {};
            FO.forEach(fId => {
              sc[fId] = monCalcScore(fId, fd, gameState.biznesNaBoku || {}, gameState.bnbEnabled, gameState.blindFate || {}, gameState.mapEnabled!==false, gameState.mapBonusClaimed || {});
              relSc[fId] = calcRelationScore(fId, gameState.relations || {});
              tot[fId] = Math.round(sc[fId].bizTotal + relSc[fId]);
            });
            Promise.all([
              db.ref("rooms/"+roomCode+"/sessionInfo").once("value").then(s=>s.val()||{}).catch(()=>({})),
              db.ref("rooms/"+roomCode+"/meta").once("value").then(s=>s.val()||{}).catch(()=>({}))
            ]).then(([si,mt]) => {
              generateTrainerPDF({
                roomCode: roomCode, imgBase: "img/",
                meta: {createdAt: mt.createdAt||mt.created||Date.now(), client: si.klient||"", group: si.grupa||""},
                fd: fd, scores: sc, relScores: relSc, totals: tot,
                txs: ensureArray(gameState.txs), relations: gameState.relations||{},
                blindFate: gameState.blindFate||{},
                bnbEnabled: !!gameState.bnbEnabled, mapEnabled: gameState.mapEnabled!==false,
                revEnabled: !!gameState.revEnabled,
                mapBonusClaimed: gameState.mapBonusClaimed||{},
                revDuels: ensureArray(gameState.revDuels||[])
              });
            }).catch(e => { alert("Błąd PDF: "+e.message); console.error(e); });
          }} title="Raport z rozgrywki (PDF)">📄</button>
          <Btn small variant="ghost" onClick={() => { disconnectAll(); if(onClose) onClose(); }}>← Wróć</Btn>
        </div>
      </div>

      {/* STATUS BANNER */}
      <div style={{
        background:allGood?"#1A2A1A":errorCount>0?"#2A1210":"#2A2210",
        border:"1px solid "+(allGood?"#3A5A3A":errorCount>0?"#5A2A20":"#5A4A20"),
        borderRadius:8, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:16
      }}>
        <div style={{fontSize:28}}>{allGood?"✓":errorCount>0?"✗":"⚠"}</div>
        <div>
          <div style={{fontSize:16, fontWeight:700, color:allGood?"#6B8E6B":errorCount>0?"#C04030":"#D4A853"}}>
            {allGood?"Wszystko w porządku":errorCount>0?errorCount+" błąd"+(errorCount>1?(errorCount<5?"y":"ów"):"")+" wykryt"+(errorCount>1?(errorCount<5?"e":"ych"):"y"):warnCount+" ostrzeżeni"+(warnCount>1?(warnCount<5?"a":"ń"):"e")}
          </div>
          <div style={{fontSize:12, color:"#8A7A6A"}}>
            {currentChecks.filter(c => c.sev !== SEV.INFO).map(c => c.msg).join(" · ") || "Brak wykrytych anomalii w bieżącym stanie gry."}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={S.grid}>

        {/* === FAMILIES STATUS === */}
        <div style={S.card}>
          <div style={S.cardTitle}>Rodziny</div>
          {FO.map(fId => {
            var f = FM[fId];
            var fp = players && players[fId];
            var memberCount = fp && fp.members ? Object.keys(fp.members).length : 0;
            var isOnline = memberCount > 0;
            var fd_f = gameState && gameState.fd ? gameState.fd[fId] : null;
            var cash = fd_f ? fd_f.cash : "–";
            var itemCount = fd_f ? fd_f.items.length : "–";
            return (
              <div key={fId} style={S.familyRow}>
                <div style={S.familyDot(f.col, isOnline)} />
                <div style={{flex:1}}>
                  <div style={{fontSize:14, fontWeight:700, color:f.col}}>{f.nom}</div>
                  <div style={{fontSize:11, color:"#7A6A5A"}}>
                    {isOnline ? memberCount + " gracz" + (memberCount > 1 ? (memberCount < 5 ? "y" : "ów") : "") : "offline"}
                    {fd_f && <span> · {cash} $ · {itemCount} kart</span>}
                  </div>
                </div>
                {fd_f && (() => {
                  var plots = fd_f.items.filter(i => i.cat === C_PLOT);
                  var plotOk = plots.length === 1 && plots[0].plotNr === f.tPlot;
                  var maps = [...new Set(fd_f.items.filter(i => i.cat === C_MAP).map(m => m.fragNr))].length;
                  return (
                    <div style={{display:"flex", gap:8, fontSize:11, color:"#7A6A5A"}}>
                      <span title="Działka" style={{color:plotOk?"#6B8E6B":plots.length>0?"#D4A853":"#8A7A6A"}}>◆{plots.length>0?plots[0].plotNr:"–"}</span>
                      <span title="Fragmenty mapy">🗺{maps}/4</span>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {/* Sheriff status */}
          <div style={{...S.familyRow, borderBottom:"none"}}>
            <div style={S.familyDot("#D4A853", players && players.sheriff && players.sheriff.connected)} />
            <div>
              <div style={{fontSize:14, fontWeight:700, color:"#D4A853"}}>Szeryf</div>
              <div style={{fontSize:11, color:"#7A6A5A"}}>
                {players && players.sheriff && players.sheriff.connected ? "online" : "offline"}
              </div>
            </div>
          </div>
        </div>

        {/* === GAME STATE === */}
        <div style={S.card}>
          <div style={S.cardTitle}>Stan rozgrywki</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
            <div>
              <div style={S.statNum}>{gameState && gameState.stageIdx != null ? gameState.stageIdx + 1 : "–"}</div>
              <div style={S.statLabel}>ETAP / {STAGES.length}</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.total : "–"}</div>
              <div style={S.statLabel}>TRANSAKCJI</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.accepted : "–"}</div>
              <div style={S.statLabel}>ZAAKCEPTOWANYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.rejected : "–"}</div>
              <div style={S.statLabel}>ODRZUCONYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.cancelled : "–"}</div>
              <div style={S.statLabel}>ANULOWANYCH</div>
            </div>
            <div>
              <div style={S.statNum}>{txStats ? txStats.pending : "–"}</div>
              <div style={S.statLabel}>OCZEKUJĄCYCH</div>
            </div>
          </div>
          {/* Mechanics status */}
          <div style={{marginTop:14, paddingTop:10, borderTop:"1px solid #3C2820", display:"flex", flexWrap:"wrap", gap:8}}>
            {[
              {label:"Gra", on:gameState?.gameStarted},
              {label:"Timer", on:gameState?.timerRunning},
              {label:"Pauza", on:gameState?.timerPaused},
              {label:"Żyła", on:gameState?.mapEnabled},
              {label:"Ślepy Los", on:gameState?.fateEnabled},
              {label:"BnB", on:gameState?.bnbEnabled},
              {label:"Rewolwerowiec", on:gameState?.revEnabled},
              {label:"Relacje", on:gameState?.relationsUnlocked},
            ].map(m => (
              <span key={m.label} style={{
                fontSize:11, padding:"3px 8px", borderRadius:3,
                background:m.on?"#1A3A1A":"#231810",
                color:m.on?"#8BC88B":"#5A4A3A",
                border:"1px solid "+(m.on?"#2A5A2A":"#3C2820")
              }}>
                {m.on?"●":"○"} {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* === TRANSACTION HEATMAP (per pair) === */}
      {txStats && Object.keys(txStats.pairs).length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Aktywność par negocjacyjnych</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8}}>
            {Object.entries(txStats.pairs).map(([pair, data]) => {
              var [a, b] = pair.split("-");
              var intensity = Math.min(1, data.total / 10);
              return (
                <div key={pair} style={{
                  background:"rgba(212,168,83," + (0.05 + intensity * 0.15) + ")",
                  border:"1px solid #3C2820", borderRadius:4, padding:"8px 10px"
                }}>
                  <div style={{fontSize:12, fontWeight:700, color:"#D0C8B8"}}>
                    {FM[a]?.gen} – {FM[b]?.gen}
                  </div>
                  <div style={{fontSize:11, color:"#8A7A6A", marginTop:2}}>
                    {data.total} tx · <span style={{color:"#6B8E6B"}}>{data.accepted}✓</span> · <span style={{color:"#C04030"}}>{data.rejected}✗</span> · <span style={{color:"#7A6A5A"}}>{data.cancelled}⊘</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === PHASE BREAKDOWN + REACTION TIMES === */}
      {txStats && txStats.total > 0 && (
        <div style={{...S.grid, marginBottom:20}}>
          {/* Phase breakdown */}
          <div style={S.card}>
            <div style={S.cardTitle}>Transakcje per faza</div>
            <div style={{display:"flex", gap:12}}>
              {[1,2,3].map(p => {
                var ps = phaseStats[p];
                var label = p===1?"FAZA I":p===2?"FAZA II":"FAZA III";
                var sublabel = p===1?"Informacyjna":p===2?"Transakcyjna":"Finałowa";
                var maxTotal = Math.max(1, ...([1,2,3].map(x => phaseStats[x].total)));
                var barH = Math.max(4, (ps.total / maxTotal) * 60);
                return (
                  <div key={p} style={{flex:1, textAlign:"center"}}>
                    <div style={{fontSize:12, fontWeight:700, color:"#D4A853"}}>{label}</div>
                    <div style={{fontSize:10, color:"#6A5A4A", marginBottom:6}}>{sublabel}</div>
                    <div style={{display:"flex", justifyContent:"center", alignItems:"flex-end", height:70, gap:3}}>
                      <div title="Zaakceptowane" style={{width:16, height:Math.max(2,(ps.accepted/Math.max(1,maxTotal))*60), background:"#6B8E6B", borderRadius:"2px 2px 0 0"}} />
                      <div title="Odrzucone" style={{width:16, height:Math.max(2,(ps.rejected/Math.max(1,maxTotal))*60), background:"#C04030", borderRadius:"2px 2px 0 0"}} />
                      <div title="Anulowane" style={{width:16, height:Math.max(2,(ps.cancelled/Math.max(1,maxTotal))*60), background:"#5A4A3A", borderRadius:"2px 2px 0 0"}} />
                    </div>
                    <div style={{fontSize:18, fontWeight:900, color:"#D4A853", marginTop:4}}>{ps.total}</div>
                    <div style={{fontSize:10, color:"#7A6A5A"}}>
                      <span style={{color:"#6B8E6B"}}>✓{ps.accepted}</span>{" "}
                      <span style={{color:"#C04030"}}>✗{ps.rejected}</span>{" "}
                      <span style={{color:"#5A4A3A"}}>⊘{ps.cancelled}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reaction times */}
          <div style={S.card}>
            <div style={S.cardTitle}>Czas reakcji na oferty</div>
            {reactionStats ? (
              <div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12}}>
                  <div>
                    <div style={S.statNum}>{reactionStats.avgAll}s</div>
                    <div style={S.statLabel}>ŚREDNI CZAS</div>
                  </div>
                  <div>
                    <div style={{...S.statNum, color:"#6B8E6B"}}>{reactionStats.avgAcc}s</div>
                    <div style={S.statLabel}>ŚR. AKCEPTACJA</div>
                  </div>
                  <div>
                    <div style={{...S.statNum, color:"#C04030"}}>{reactionStats.avgRej}s</div>
                    <div style={S.statLabel}>ŚR. ODRZUCENIE</div>
                  </div>
                </div>
                <div style={{fontSize:11, color:"#7A6A5A"}}>
                  Pomierzono: {reactionStats.total} transakcji · Max: {reactionStats.maxTime}s · ✓{reactionStats.accepted} ✗{reactionStats.rejected}
                </div>
                {/* Last 5 reaction times */}
                {reactionTimes.length > 0 && (
                  <div style={{marginTop:8, paddingTop:8, borderTop:"1px solid #3C2820"}}>
                    <div style={{fontSize:10, color:"#6A5A4A", marginBottom:4}}>Ostatnie pomiary:</div>
                    {reactionTimes.slice(-5).reverse().map((r, i) => (
                      <div key={i} style={{fontSize:11, color:"#8A7A6A", padding:"2px 0"}}>
                        <span style={{color:r.result==="accepted"?"#6B8E6B":"#C04030"}}>{r.result==="accepted"?"✓":"✗"}</span>
                        {" "}{FM[r.from]?.gen||"?"} → {FM[r.to]?.gen||"?"}: <span style={{color:"#D4A853", fontWeight:700}}>{r.duration}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{fontSize:13, color:"#5A4A3A", fontStyle:"italic"}}>
                Pomiar rozpocznie się po pierwszej transakcji w trybie pending.
              </div>
            )}
          </div>
        </div>
      )}

      {/* === CASH BARS + SCORING === */}
      {gameState && gameState.fd && (
        <div style={{...S.grid, marginBottom:20}}>
          {/* Cash visualization */}
          <div style={S.card}>
            <div style={S.cardTitle}>Gotówka</div>
            {FO.map(fId => {
              var cash = gameState.fd[fId] ? gameState.fd[fId].cash : 0;
              var maxCash = Math.max(100, ...FO.map(f => gameState.fd[f] ? gameState.fd[f].cash : 0));
              var pct = Math.max(0, (cash / maxCash) * 100);
              return (
                <div key={fId} style={{marginBottom:8}}>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:2}}>
                    <span style={{color:FM[fId].col, fontWeight:700}}>{FM[fId].gen}</span>
                    <span style={{color:"#D4A853", fontWeight:700}}>{cash} $</span>
                  </div>
                  <div style={{height:14, background:"#1A0E08", borderRadius:3, overflow:"hidden"}}>
                    <div style={{
                      height:"100%", borderRadius:3, transition:"width 0.5s",
                      width:pct+"%",
                      background:"linear-gradient(90deg, "+FM[fId].col+", "+FM[fId].col+"80)"
                    }} />
                  </div>
                </div>
              );
            })}
            {/* Cash snapshot trend (last 5) */}
            {cashSnapshots.length > 1 && (
              <div style={{marginTop:12, paddingTop:10, borderTop:"1px solid #3C2820"}}>
                <div style={{fontSize:11, color:"#7A6A5A", marginBottom:6}}>Trend gotówki per etap</div>
                <div style={{display:"flex", gap:4, overflowX:"auto"}}>
                  {cashSnapshots.slice(-8).map((snap, idx) => (
                    <div key={idx} style={{fontSize:10, color:"#6A5A4A", textAlign:"center", minWidth:45}}>
                      <div style={{fontWeight:700}}>{STAGES[snap.stageIdx]?.id || "?"}</div>
                      {FO.map(fId => (
                        <div key={fId} style={{color:FM[fId].col, fontSize:9}}>{snap.cash[fId]}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scoring preview */}
          <div style={S.card}>
            <div style={S.cardTitle}>Podgląd wyników (na żywo)</div>
            {scores && FO.map(fId => {
              var sc = scores[fId];
              return (
                <div key={fId} style={{marginBottom:10, paddingBottom:8, borderBottom:"1px solid #231810"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4}}>
                    <span style={{fontSize:14, fontWeight:700, color:FM[fId].col}}>{FM[fId].nom}</span>
                    <span style={{fontSize:20, fontWeight:900, color:"#D4A853"}}>{sc.bizTotal} pkt</span>
                  </div>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap", fontSize:10, color:"#8A7A6A"}}>
                    <span>Zasoby: {sc.resPct}% ({sc.resScore})</span>
                    <span>·</span>
                    <span>Kompetencje: {sc.compPct}% ({sc.compScore})</span>
                    <span>·</span>
                    <span style={{color:sc.plotOk?"#6B8E6B":"#C04030"}}>Działka: {sc.plotScore}</span>
                    <span>·</span>
                    <span style={{color:sc.cashScore<0?"#C04030":"#8A7A6A"}}>Gotówka: {sc.cashScore}</span>
                    <span>·</span>
                    <span>Mapa: {sc.mapScore}</span>
                    {sc.bnb > 0 && <span>· BnB: {sc.bnb}</span>}
                  </div>
                </div>
              );
            })}
            {!scores && <div style={{fontSize:13, color:"#5A4A3A", fontStyle:"italic"}}>Brak danych</div>}
          </div>
        </div>
      )}

      {/* === ŚLEPY LOS === */}
      {gameState && gameState.blindFate && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Ślepy Los</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            {FO.map(fId => {
              var bf = gameState.blindFate[fId];
              if(!bf || !bf.rolls) return null;
              var rolls = ensureArray(bf.rolls).filter(r => r && r.resolved);
              if(rolls.length === 0) return null;
              return (
                <div key={fId} style={{background:"#231810", borderRadius:6, padding:10, border:"1px solid "+FM[fId].col+"44"}}>
                  <div style={{fontWeight:700, color:FM[fId].col, marginBottom:6, fontSize:14}}>{FM[fId].nom}</div>
                  {rolls.map((r,i) => {
                    var ev = r.event || {};
                    var policyLabel = r.policyUsed === 100 ? " (polisa 100%)" : r.policyUsed === 50 ? " (polisa 50%)" : "";
                    return (
                      <div key={i} style={{fontSize:12, color:"#C0B8A0", marginBottom:4, display:"flex", gap:6}}>
                        <span style={{color:"#8A7A6A", fontFamily:"monospace", minWidth:36}}>🎲 {r.dice1||"?"}+{r.dice2||"?"}={r.sum||"?"}</span>
                        <span style={{flex:1}}>{ev.text || "–"}</span>
                        <span style={{color: ev.type==="gain"||ev.type==="gain_policy"?"#8BC88B":"#C04030", fontWeight:700, minWidth:50, textAlign:"right"}}>
                          {r.netEffectText || (ev.amount > 0 ? "+" : "") + (ev.amount || 0) + "$"}{policyLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {FO.every(fId => !gameState.blindFate[fId] || !ensureArray(gameState.blindFate[fId].rolls || []).some(r => r && r.resolved)) && (
            <div style={{fontSize:13, color:"#5A4A3A", fontStyle:"italic"}}>Brak rozstrzygniętych rzutów</div>
          )}
        </div>
      )}

      {/* === BIZNES NA BOKU === */}
      {gameState && gameState.bnbEnabled && gameState.fd && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Biznes na Boku – dystrybucja</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8}}>
            {FO.map(fId => {
              var items = (gameState.fd[fId] && gameState.fd[fId].items) ? ensureArray(gameState.fd[fId].items) : [];
              var bnbOwn = items.filter(i => i.cat === C_BNB && BNB_PRODUCTS[fId] && i.name === BNB_PRODUCTS[fId].name).length;
              var bnbBought = items.filter(i => i.cat === C_BNB && (!BNB_PRODUCTS[fId] || i.name !== BNB_PRODUCTS[fId].name)).length;
              var sold = BNB_PRODUCTS[fId] ? BNB_PRODUCTS[fId].qty - bnbOwn : 0;
              return (
                <div key={fId} style={{background:"#231810", borderRadius:6, padding:10, textAlign:"center", border:"1px solid "+FM[fId].col+"44"}}>
                  <div style={{fontWeight:700, color:FM[fId].col, fontSize:13, marginBottom:6}}>{FM[fId].nom}</div>
                  <div style={{fontSize:12, color:"#A89070", marginBottom:2}}>{BNB_PRODUCTS[fId] ? BNB_PRODUCTS[fId].shortName : "?"}</div>
                  <div style={{fontSize:11, color:"#8A7A6A"}}>
                    Sprzedano: <span style={{color:"#D4A853", fontWeight:700}}>{sold > 0 ? sold : 0}</span> / {BNB_PRODUCTS[fId] ? BNB_PRODUCTS[fId].qty : "?"}
                  </div>
                  <div style={{fontSize:11, color:"#8A7A6A"}}>
                    Kupiono od innych: <span style={{color:"#8BC88B", fontWeight:700}}>{bnbBought}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === RELACJE === */}
      {gameState && gameState.relations && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Relacje – informacja zwrotna</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
              <thead>
                <tr>
                  <th style={{padding:"6px 8px", textAlign:"left", color:"#8A7A6A", borderBottom:"1px solid #3C2820"}}>Od rodziny \u2193 / Dla rodziny \u2192</th>
                  {FO.map(fId => <th key={fId} style={{padding:"6px 8px", color:FM[fId].col, borderBottom:"1px solid #3C2820", textAlign:"center"}}>{FM[fId].nom}</th>)}
                </tr>
              </thead>
              <tbody>
                {FO.map(rater => (
                  <tr key={rater}>
                    <td style={{padding:"6px 8px", fontWeight:700, color:FM[rater].col, borderBottom:"1px solid #231810"}}>{FM[rater].nom}</td>
                    {FO.map(rated => {
                      if(rater === rated) return <td key={rated} style={{padding:"6px 8px", textAlign:"center", color:"#3C2820", borderBottom:"1px solid #231810"}}>–</td>;
                      var r = gameState.relations[rater] && gameState.relations[rater][rated];
                      if(!r) return <td key={rated} style={{padding:"6px 8px", textAlign:"center", color:"#5A4A3A", borderBottom:"1px solid #231810"}}>-</td>;
                      var total = (r.partnership || 0) + (r.rules || 0) + (r.communication || 0);
                      return (
                        <td key={rated} style={{padding:"6px 8px", textAlign:"center", borderBottom:"1px solid #231810"}}>
                          <span style={{color:"#D4A853", fontWeight:700}}>{total}</span>
                          <span style={{color:"#6A5A4A", fontSize:11}}>/15</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === MACIERZ HANDLU === */}
      {gameState && gameState.txs && (() => {
        var txs = ensureArray(gameState.txs).filter(t => t && t.status === "accepted");
        if(txs.length === 0) return null;
        var matrix = {};
        FO.forEach(a => { matrix[a] = {}; FO.forEach(b => { if(a!==b) matrix[a][b] = {cash:0, items:0}; }); });
        txs.forEach(tx => {
          if(!tx.from || !tx.to) return;
          if(tx.offerCash) matrix[tx.from][tx.to].cash += tx.offerCash;
          if(tx.requestCash) matrix[tx.to][tx.from].cash += tx.requestCash;
          if(tx.offerItems) matrix[tx.from][tx.to].items += ensureArray(tx.offerItems).length;
          if(tx.requestItems) matrix[tx.to][tx.from].items += ensureArray(tx.requestItems).length;
        });
        return (
          <div style={{...S.card, marginBottom:20}}>
            <div style={S.cardTitle}>Macierz handlu (zaakceptowane transakcje)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{padding:"6px 8px", textAlign:"left", color:"#8A7A6A", borderBottom:"1px solid #3C2820"}}>Od ↓ / Do →</th>
                    {FO.map(fId => <th key={fId} style={{padding:"6px 8px", color:FM[fId].col, borderBottom:"1px solid #3C2820", textAlign:"center"}}>{FM[fId].nom}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {FO.map(from => (
                    <tr key={from}>
                      <td style={{padding:"6px 8px", fontWeight:700, color:FM[from].col, borderBottom:"1px solid #231810"}}>{FM[from].nom}</td>
                      {FO.map(to => {
                        if(from === to) return <td key={to} style={{padding:"6px 8px", textAlign:"center", color:"#3C2820", borderBottom:"1px solid #231810"}}>–</td>;
                        var m = matrix[from][to];
                        return (
                          <td key={to} style={{padding:"6px 8px", textAlign:"center", borderBottom:"1px solid #231810"}}>
                            {m.items > 0 && <span style={{color:"#C0B8A0"}}>{m.items} kart</span>}
                            {m.items > 0 && m.cash > 0 && <span style={{color:"#5A4A3A"}}> + </span>}
                            {m.cash > 0 && <span style={{color:"#D4A853"}}>{m.cash}$</span>}
                            {m.items === 0 && m.cash === 0 && <span style={{color:"#3C2820"}}>–</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:11, color:"#6A5A4A", marginTop:8}}>Komórka: co rodzina (wiersz) przekazała rodzinie (kolumna)</div>
          </div>
        );
      })()}

      {/* === CONNECTION HISTORY === */}
      {Object.keys(connHistory).length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <div style={S.cardTitle}>Historia połączeń</div>
          <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
            {FO.map(fId => {
              var hist = connHistory[fId];
              if(!hist || hist.length === 0) return null;
              var disconnects = hist.filter(h => h.event === "disconnect").length;
              // Detect flickering: 3+ events in last 5 min
              var recent = hist.filter(h => Date.now() - h.ts < 300000).length;
              var flickering = recent >= 4;
              return (
                <div key={fId} style={{fontSize:12, padding:"6px 10px", background:"#231810", borderRadius:4, border:flickering?"1px solid #C04030":"1px solid #3C2820"}}>
                  <span style={{color:FM[fId].col, fontWeight:700}}>{FM[fId].gen}</span>
                  <span style={{color:"#7A6A5A"}}> · {hist.length} {hist.length===1?"zdarzenie":hist.length>=2&&hist.length<=4?"zdarzenia":"zdarzeń"} · {disconnects} {disconnects===1?"rozłączenie":disconnects>=2&&disconnects<=4?"rozłączenia":"rozłączeń"}</span>
                  {flickering && <span style={{color:"#C04030", fontWeight:700}}> · MIGOTANIE</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === EVENT LOG === */}
      <div style={{...S.card, maxHeight:450, display:"flex", flexDirection:"column"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <div style={S.cardTitle}>Dziennik zdarzeń</div>
            <span style={{fontSize:11, color:"#6A5A4A"}}>{filteredLog.length} / {eventLog.length}</span>
          </div>
          <div style={{display:"flex", gap:6}}>
            {[
              {key:"all", label:"Wszystko"},
              {key:"warn", label:"Uwagi+"},
              {key:"error", label:"Błędy"},
            ].map(f => (
              <button key={f.key} style={{...S.btnSmall, background:logFilter===f.key?"#5C3A2A":"#3C2820", fontSize:11, padding:"4px 10px"}} onClick={() => setLogFilter(f.key)}>{f.label}</button>
            ))}
            <button style={{...S.btnSmall, fontSize:11, padding:"4px 10px"}} onClick={() => setEventLog([])}>Wyczyść</button>
          </div>
        </div>
        <div style={{flex:1, overflowY:"auto", minHeight:0}}>
          {filteredLog.length === 0 && (
            <div style={{color:"#5A4A3A", fontSize:13, fontStyle:"italic", padding:8}}>
              {eventLog.length === 0 ? "Oczekiwanie na zdarzenia..." : "Brak zdarzeń dla wybranego filtru."}
            </div>
          )}
          {filteredLog.map(ev => (
            <div key={ev.key} style={S.feedItem(ev.sev)}>
              <span style={S.feedTs}>{ev.ts}</span>
              <span style={S.feedCat(ev.sev)}>{SEV_LABEL[ev.sev]}</span>
              <span style={{color:SEV_COLOR[ev.sev], fontSize:11, fontWeight:600, flexShrink:0, minWidth:85}}>{ev.cat}</span>
              <span style={S.feedMsg}>{ev.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{textAlign:"center", marginTop:20, paddingTop:12, borderTop:"1px solid #231810"}}>
        <span style={S.badge}>Monitor · read-only · {new Date().toLocaleDateString("pl")}</span>
      </div>
    </div>
  );
}


/* ===== MONITOR TAB – lista aktywnych rozgrywek + MonitorView ===== */
function MonitorTab() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function loadRooms() {
    if(!db) { setLoading(false); return; }
    setLoading(true);
    db.ref("rooms").once("value").then(snap => {
      var list = [];
      snap.forEach(child => {
        var val = child.val();
        var meta = val.meta || {};
        var gs = val.gameState || {};
        var status = meta.status || (gs.gameStarted ? "playing" : "lobby");
        list.push({
          code: child.key,
          status: status,
          stageIdx: gs.stageIdx || 0,
          stageLabel: gs.stageIdx != null && STAGES[gs.stageIdx] ? STAGES[gs.stageIdx].label : "–",
          createdAt: meta.createdAt || meta.created || 0,
          client: meta.client || "",
          group: meta.group || "",
        });
      });
      // Sort: playing first, then lobby, then finished, by createdAt desc
      var order = {playing:0, lobby:1, finished:2, expired:3};
      list.sort((a,b) => (order[a.status]||9) - (order[b.status]||9) || b.createdAt - a.createdAt);
      setRooms(list);
      setLoading(false);
    }).catch(e => { console.error("MonitorTab loadRooms:", e); setLoading(false); });
  }

  useEffect(() => { loadRooms(); }, [refreshKey]);

  // Auto-refresh every 30s
  useEffect(() => {
    var iv = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  if(selectedRoom) {
    return <MonitorView roomCode={selectedRoom} onClose={() => setSelectedRoom(null)} />;
  }

  var playing = rooms.filter(r => r.status === "playing");

  // Auto-connect: jeśli dokładnie 1 aktywna rozgrywka, podłącz automatycznie
  if(!loading && playing.length === 1 && !selectedRoom) {
    setTimeout(() => setSelectedRoom(playing[0].code), 0);
    return <div style={{textAlign:"center", padding:40, color:C.gold}}>Podłączanie do {playing[0].code}…</div>;
  }

  // Wiele aktywnych – pozwól wybrać (rzadki przypadek)
  if(!loading && playing.length > 1) {
    return (
      <div>
        <div style={{textAlign:"center", color:C.textMut, padding:40, fontSize:15}}>
          Wykryto {playing.length} aktywne rozgrywki. Wybierz jedną:
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:8, maxWidth:400, margin:"0 auto"}}>
          {playing.map(r => (
            <Btn key={r.code} onClick={() => setSelectedRoom(r.code)}>{r.code}</Btn>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Card><div style={{textAlign:"center", color:C.textMut, padding:40, fontSize:15}}>Oczekiwanie na rozgrywkę</div></Card>
    </div>
  );
}


function AdminApp() {
  const [user, setUser]   = useState(null);
  const [tab, setTab]     = useState("rooms");
  const [checking, setChecking] = useState(true);
  const [reportRoom, setReportRoom] = useState(null);
  const [trainers, setTrainers] = useState([]);

  useEffect(() => {
    if (!auth) { setChecking(false); return; }
    var unsub = auth.onAuthStateChanged(u => {
      if (u && u.email) {
        db.ref("admins/" + u.uid).once("value").then(snap => {
          setChecking(false);
          if (snap.val() === true) setUser(u);
          else { auth.signOut(); setUser(null); }
        }).catch(err => {
          // Network error – don't sign out, keep current state
          console.warn("[WDZ Admin] Admin check failed, keeping session:", err.message);
          setChecking(false);
        });
      } else {
        setChecking(false);
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  // ── Trenerzy: REST API odczyt (omija cache Firebase SDK) ──
  var DB_URL = "https://wdz-online-default-rtdb.firebaseio.com";

  function trainerKey(email) { return email.toLowerCase().replace(/[.#$\/\[\]@]/g, '_'); }

  function loadTrainers() {
    if (!auth.currentUser) return Promise.resolve([]);
    return auth.currentUser.getIdToken().then(function(token) {
      return fetch(DB_URL + "/trainers.json?auth=" + token);
    }).then(function(r) { return r.json(); }).then(function(data) {
      var arr = [];
      if (data && typeof data === "object") {
        Object.keys(data).forEach(function(k) { arr.push({id: k, ...data[k]}); });
      }
      arr.sort(function(a,b) { return (b.createdAt||0) - (a.createdAt||0); });
      setTrainers(arr);
      return arr;
    }).catch(function(e) { console.error("loadTrainers error:", e); return []; });
  }

  function saveTrainer(data) {
    var key = trainerKey(data.email);
    return db.ref("trainers/" + key).set({
      name: data.name, email: data.email, active: true, createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() { return loadTrainers(); });
  }

  function removeTrainer(trainer) {
    return db.ref("trainers/" + trainer.id).remove().then(function() { return loadTrainers(); });
  }

  function toggleTrainer(trainer) {
    return db.ref("trainers/" + trainer.id + "/active").set(!trainer.active).then(function() { return loadTrainers(); });
  }

  // Załaduj trenerów po zalogowaniu
  useEffect(() => {
    if (user) loadTrainers();
  }, [user]);

  if (checking) return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:C.bg, color:C.textMut, fontSize:16}}>Ładowanie…</div>
  );

  if (!user) return <LoginScreen onLogin={u => setUser(u)}/>;

  if (reportRoom) return <ReportView roomCode={reportRoom} onClose={()=>setReportRoom(null)}/>;

  const tabs = [
    {id:"rooms",    label:"Rozgrywki"},
    {id:"monitor",  label:"Monitor"},
    {id:"trainers", label:"Trenerzy"},
    {id:"tickets",  label:"Bilety"},
    {id:"stats",    label:"Statystyki"},
    {id:"simulator",label:"Symulator"},
  ];

  return (
    <div style={{minHeight:"100vh", background:C.bg}}>
      {/* HEADER */}
      <div style={{background:C.redDark, borderBottom:"2px solid "+C.border, padding:"0 24px"}}>
        <div style={{maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center",
          justifyContent:"space-between", height:56}}>
          <div style={{display:"flex", alignItems:"center", gap:16}}>
            <img src="img/alegra_logotyp.png" alt="aleGRA" style={{height:36, width:"auto"}}/>
            <div style={{color:C.textMut, fontSize:13}}>Panel WDZ <span style={{fontSize:11,opacity:0.6}}>v1.0.1</span></div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:16}}>
            <div style={{fontSize:13, color:C.textMut}}>{user.email}</div>
            <Btn small variant="ghost" onClick={() => auth.signOut()}>Wyloguj</Btn>
          </div>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{background:C.panel, borderBottom:"1px solid "+C.border}}>
        <div style={{maxWidth:1100, margin:"0 auto", display:"flex", gap:0}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => {
              if(t.id==="simulator"){ window.open("simulator.html","_blank"); return; }
              setTab(t.id); if(t.id==="tickets"||t.id==="trainers") loadTrainers();
            }} style={{
              padding:"14px 24px", fontSize:15, fontWeight: tab===t.id ? 700 : 400,
              color: tab===t.id ? C.gold : C.textDim,
              background:"transparent", border:"none",
              borderBottom: tab===t.id ? "2px solid "+C.gold : "2px solid transparent",
              fontFamily:"'Alegreya Sans',serif", cursor:"pointer", transition:"color .15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:1100, margin:"0 auto", padding:"24px 24px"}}>
        {tab === "rooms"    && <RoomsView onOpenReport={code=>setReportRoom(code)}/>}
        {tab === "monitor"  && <MonitorTab/>}
        {tab === "trainers" && <TrainersView trainers={trainers} onSave={saveTrainer} onDelete={removeTrainer} onToggle={toggleTrainer}/>}
        {tab === "tickets"  && <TicketsView trainers={trainers}/>}
        {tab === "stats"    && <StatsView/>}
      </div>
    </div>
  );
}

export { AdminApp };
