/* WDZ Online – components/InstructionSlides.jsx */
import { FM, FO, BNB_PRODUCTS } from "../game/constants.js";
import { IMG_BASE, toSlug } from "../utils/index.js";
import { btnS } from "./ui.jsx";
import React, { useState, useEffect } from "react";

const INSTRUCTION_DATA = {
  adams: {
    familyName: "Adamsów", familyNom: "Adamsowie", business: "Saloon", businessAdj: "niż Saloon",
    firstOpponent: "Bennetów",
    storyParagraph: 'Adamsowie od pokoleń zajmują się gastronomią i rozrywką. Wasz dziadek, jeszcze na starym kontynencie, prowadził słynną oberżę &bdquo;Pod Roztańczonym Prosiakiem&rdquo;. Stworzycie tu <strong>Saloon</strong>, który dostarczy uciechy miejscowym i przyjezdnym.',
    plotFull: 'Wasza rodzina posiada prawo własności do działki <strong>Nr 6</strong> w centralnym punkcie miasta. Problem w tym, że tuż obok powstał kościół i cmentarz. Stawianie Saloonu naprzeciw świętego przybytku nie licuje z przyzwoitością, widok grobów za oknem jest mało krzepiący, a sąsiedztwo siedziby szeryfa może odstraszać klientów.',
    plotAdvice: '<strong>Najlepszym wyjściem jest pozyskanie innej działki, która uwolni Was od kłopotliwego sąsiedztwa.</strong> W związku z planami gorzelniczymi potrzebujecie też sąsiedztwa jeziora, dającego dostęp do świeżej wody. Pozostanie na działce nr 6 wiąże się z dodatkowymi kosztami dowożenia wody w wysokości <strong>50 $</strong> – rozliczanymi na koniec gry.',
    plotPopup: '<strong>DZIAŁKA Nr 6 – max 10 pkt</strong><br>Posiadacie działkę nr 6, obok kościoła, cmentarza i siedziby szeryfa. Niedobra lokalizacja na Saloon. Potrzebujecie sąsiedztwa jeziora – dostęp do świeżej wody jest niezbędny do planów gorzelniczych.<br><strong>Pozyskajcie lepszą działkę w drodze negocjacji.</strong> Pozostanie na nr 6 oznacza dodatkowe koszty: <strong>50 $</strong> na koniec gry.<br>Działkę można kupić, sprzedać lub wymienić barterem.',
    bnbStory: 'Trafia się okazja dodatkowego zarobku – mały &bdquo;biznes na boku&rdquo;. Nawiązał z Wami kontakt przedstawiciel firmy Doktor Geist. Zaproponował, byście na barze, obok butelek z whisky, postawili jeszcze jedną – zawierającą nowy i bardzo obiecujący produkt.',
    bnbProduct: 'Cudowna mikstura na rozum Doktora Geista',
    bnbDesc: 'szczyt osiągnięć rodzącego się przemysłu farmaceutycznego. W cudowny sposób wspomaga uczenie się u nawet najbardziej opornych.',
    bnbEffect: 'Jeden flakon zastępuje brakujący <strong>4% kompetencji</strong> lub zwiększa końcowy wynik o <strong>1 punkt</strong>.',
    bnbQuantity: '10 flakonów', bnbValue: '300 $',
    goodLuck: 'Niech fortuna sprzyja rodzinie Adamsów!'
  },
  bennet: {
    familyName: "Bennetów", familyNom: "Bennetowie", business: "Zakład Pogrzebowy", businessAdj: "niż pogrzebowy",
    firstOpponent: "Adamsów",
    storyParagraph: 'Bennetowie od pokoleń zajmują się ostatnią posługą. Wasz dziadek prowadził szanowany dom pogrzebowy w jednym z większych miast wschodniego wybrzeża. Stworzycie tu <strong>Zakład Pogrzebowy</strong>, który zapewni mieszkańcom godne pożegnanie bliskich.',
    plotFull: 'Wasza rodzina posiada prawo własności do działki <strong>Nr 4</strong>. Kupiliście ją &bdquo;w ciemno&rdquo;, uznając, że dla zakładu pogrzebowego lokalizacja ma drugorzędne znaczenie. Tymczasem w czasie Waszej podróży w miasteczku powstał kościół, a za nim cmentarz. To zmienia sytuację – bliskość miejsca ostatecznego spoczynku klientów to dla Was czysta oszczędność.',
    plotAdvice: '<strong>Najlepszym wyjściem jest pozyskanie działki w pobliżu kościoła i cmentarza.</strong> Pozostanie na działce nr 4 wiąże się z dodatkowymi kosztami transportu zwłok w wysokości <strong>50 $</strong> – rozliczanymi na koniec gry.',
    plotPopup: '<strong>DZIAŁKA Nr 4 – max 10 pkt</strong><br>Kupiliście działkę &bdquo;w ciemno&rdquo;. W międzyczasie w miasteczku powstał kościół i cmentarz – ich bliskość to dla zakładu pogrzebowego czysta oszczędność.<br><strong>Pozyskajcie działkę bliżej kościoła i cmentarza.</strong> Pozostanie na nr 4 oznacza dodatkowe koszty transportu zwłok: <strong>50 $</strong> na koniec gry.<br>Działkę można kupić, sprzedać lub wymienić barterem.',
    bnbStory: 'Trafia się okazja dodatkowego zarobku – mały &bdquo;biznes na boku&rdquo;. Nawiązał z Wami kontakt lokalny pośrednik nieruchomości reprezentujący ratusz. Zaproponował, byście swoim klientom – tym jeszcze żyjącym, oczywiście – składali dodatkową, nadzwyczaj atrakcyjną ofertę.',
    bnbProduct: 'Kwatera dla Obywatela',
    bnbDesc: 'promowana przez lokalne władze akcja sprzedaży rodzinnych kwater na cmentarzu. Kup dla siebie grób, a zacieśnisz związek z miasteczkiem, aż po kres swych dni.',
    bnbEffect: 'Jedna kwatera zwiększa końcowy wynik o <strong>1 punkt</strong>.',
    bnbQuantity: '10 kwater', bnbValue: '300 $',
    goodLuck: 'Niech fortuna sprzyja rodzinie Bennetów!'
  },
  clinton: {
    familyName: "Clintonów", familyNom: "Clintonowie", business: "Bank", businessAdj: "niż bankowy",
    firstOpponent: "Dexterów",
    storyParagraph: 'Clintonowie od pokoleń związani są z finansami. Wasz dziadek prowadził kantory wymiany walut i cieszył się opinią człowieka, któremu można powierzyć każdy grosz. Stworzycie tu <strong>Bank</strong>, który zapewni mieszkańcom bezpieczeństwo finansowe.',
    plotFull: 'Wasza rodzina posiada prawo własności do działki <strong>Nr 20</strong>. Kupiliście ją &bdquo;w ciemno&rdquo;, nie znając topografii miasteczka. Okazało się, że działka jest przy wjeździe – to idealne warunki dla bandytów planujących napady na banki. W Waszej branży kluczową wartością jest bezpieczeństwo.',
    plotAdvice: '<strong>Najlepszą lokalizacją dla banku jest działka naprzeciw biura Szeryfa – szybka reakcja w razie kłopotów.</strong> Liczy się też centrum miasteczka. Pozostanie na działce nr 20 wiąże się z dodatkowymi kosztami tablic i ulotek reklamowych w wysokości <strong>50 $</strong> – rozliczanymi na koniec gry.',
    plotPopup: '<strong>DZIAŁKA Nr 20 – max 10 pkt</strong><br>Działka przy wjeździe – idealne warunki dla bandytów. Bank potrzebuje bezpieczeństwa i bliskości Szeryfa.<br><strong>Pozyskajcie działkę naprzeciw biura Szeryfa, w centrum.</strong> Pozostanie na nr 20 oznacza dodatkowe koszty tablic i ulotek reklamowych: <strong>50 $</strong> na koniec gry.<br>Działkę można kupić, sprzedać lub wymienić barterem.',
    bnbStory: 'Trafia się okazja dodatkowego zarobku – mały &bdquo;biznes na boku&rdquo;. Nawiązał z Wami kontakt nowojorski bank Limon Sisters. Zaproponował, byście sprzedawali nowy, bardzo obiecujący produkt finansowy.',
    bnbProduct: 'Obligacje Limon Sisters',
    bnbDesc: 'produkt finansowy opracowany specjalnie dla przedsiębiorców. Doskonała inwestycja, która pomnaża to, co wypracowałeś prowadząc swój biznes.',
    bnbEffect: 'Jedna obligacja zwiększa stan kasy na koniec gry o <strong>20%</strong>.',
    bnbQuantity: '4 obligacje', bnbValue: '300 $',
    goodLuck: 'Niech fortuna sprzyja rodzinie Clintonów!'
  },
  dexter: {
    familyName: "Dexterów", familyNom: "Dexterowie", business: "Ranczo", businessAdj: "niż rancho",
    firstOpponent: "Clintonów",
    storyParagraph: 'Dexterowie od pokoleń zajmują się hodowlą bydła i uprawą ziemi. Wasz dziadek prowadził jedno z większych ranch na wschodnim wybrzeżu. Stworzycie tu <strong>Ranczo</strong>, które zapewni miasteczku świeże mięso i skóry.',
    plotFull: 'Wasza rodzina posiada prawo własności do działki <strong>Nr 1</strong>. Kupiliście ją z uwagi na tereny zielone w sąsiedztwie, idealne do wypasu bydła. Po przybyciu na miejsce spotkała Was jednak niemiła niespodzianka – zamiast zieleni zastaliście jezioro i piach wokół skalnych wzgórz.',
    plotAdvice: '<strong>Alternatywą jest pozyskanie działki przy wjeździe do miasta, która zapewni bliskość prerii i umożliwi wypas bydła.</strong> Bardzo pożądane jest też sąsiedztwo kuźni. Pozostanie na działce nr 1 wiąże się z dodatkowymi kosztami transportu paszy w wysokości <strong>50 $</strong> – rozliczanymi na koniec gry.',
    plotPopup: '<strong>DZIAŁKA Nr 1 – max 10 pkt</strong><br>Kupiliście działkę licząc na tereny zielone – zastaliście jezioro i piach. Ranczo potrzebuje bliskości prerii i sąsiedztwa kuźni.<br><strong>Pozyskajcie działkę przy wjeździe do miasta.</strong> Pozostanie na nr 1 oznacza dodatkowe koszty transportu paszy: <strong>50 $</strong> na koniec gry.<br>Działkę można kupić, sprzedać lub wymienić barterem.',
    bnbStory: 'Trafia się okazja dodatkowego zarobku – mały &bdquo;biznes na boku&rdquo;. Nawiązał z Wami kontakt właściciel firmy Kurier Preriowy. Zaproponował, byście sprzedawali vouchery na nową, bardzo obiecującą usługę dla przedsiębiorców.',
    bnbProduct: 'Voucher Kuriera Preriowego',
    bnbDesc: 'uniezależnia przedsiębiorcę od zakupów na lokalnym rynku. Pozwala sprowadzać dobra z różnych stron kraju. Żadna bariera nie zatrzyma kuriera.',
    bnbEffect: 'Jeden voucher zastępuje <strong>4% brakujących zasobów</strong> lub zwiększa końcowy wynik o <strong>1 punkt</strong>.',
    bnbQuantity: '10 voucherów', bnbValue: '300 $',
    goodLuck: 'Niech fortuna sprzyja rodzinie Dexterów!'
  }
};

export function InstructionSlides({familyId, roomCode, db, bnbEnabled, mapEnabled, onTutorialDone}) {
  const [page, setPage] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [allCompleted, setAllCompleted] = useState(false);
  const [rolesSubmitted, setRolesSubmitted] = useState(false);
  const [roles, setRoles] = useState({head:'',rep:'',acc:'',nestor:'',heart:''});
  const [roleSaving, setRoleSaving] = useState(false);
  const [tradeTab, setTradeTab] = useState("sale");
  const [interfejsZoom, setInterfejsZoom] = useState(false);
  const [slide3, setSlide3] = useState(0);
  const d = INSTRUCTION_DATA[familyId];

  useEffect(()=>{
    if(!db||!roomCode||!familyId) return;
    db.ref("rooms/"+roomCode+"/roles/"+familyId).once("value").then(snap=>{
      var v=snap.val();
      if(v&&typeof v==="object"){
        setRoles(prev=>({...prev,...v}));
        var reqKeys=["head","rep","acc"];
        if(reqKeys.every(k=>v[k]&&v[k].trim()!=="")) setRolesSubmitted(true);
      }
    });
    db.ref("rooms/"+roomCode+"/instructionCompleted/"+familyId).once("value").then(snap=>{
      if(snap.val()===true){setAllCompleted(true);setMaxVisited(8);if(onTutorialDone)onTutorialDone(familyId);}
    });
  },[familyId,roomCode]);

  // Track max visited page
  useEffect(()=>{
    if(page>maxVisited) setMaxVisited(page);
    if(page===8&&!allCompleted&&db&&roomCode){
      setAllCompleted(true);
      db.ref("rooms/"+roomCode+"/instructionCompleted/"+familyId).set(true);
      if(onTutorialDone) onTutorialDone(familyId);
    }
  },[page]);

  if(!d) return <div style={{padding:20,color:"#842504"}}>Brak danych instrukcji dla rodziny.</div>;

  const ROLE_DEFS = [
    {key:"head",   label:"GŁOWA RODZINY",       desc:"Zarządza zespołem, tworzy strategię, podejmuje kluczowe decyzje.", required:true, img:"role-glowa"},
    {key:"rep",    label:"REPREZENTANT RODZINY", desc:"Prowadzi rozmowy z innymi rodzinami, negocjuje warunki, buduje relacje.", required:true, img:"role-reprezentant"},
    {key:"acc",    label:"KSIĘGOWY RODZINY",     desc:"Obsługuje transakcje w aplikacji, obraca gotówką, ewidencjonuje zasoby i kontroluje czas.", required:true, img:"role-ksiegowy"},
    {key:"nestor", label:"NESTOR RODZINY",       desc:"Obserwuje przebieg rozmów, analizuje sytuacje, doradza i tworzy opcje rozwiązań.", required:false, img:"role-nestor"},
    {key:"heart",  label:"SERCE RODZINY",        desc:"Dba o ludzi i atmosferę w zespole. Łagodzi konflikty, motywuje w kryzysie.", required:false, img:"role-serce"}
  ];
  const requiredFilled = ROLE_DEFS.filter(r=>r.required).every(r=>roles[r.key].trim()!=="");

  function submitRoles(){
    if(!requiredFilled||roleSaving) return;
    setRoleSaving(true);
    db.ref("rooms/"+roomCode+"/roles/"+familyId).set(roles).then(()=>{
      setRolesSubmitted(true); setRoleSaving(false);
    }).catch(()=>setRoleSaving(false));
  }

  const canNext = page !== 3 || rolesSubmitted;
  const totalPages = 9;
  const hdr = (s,draft) => <div style={{padding:"8px 14px",marginBottom:10}}><div style={{fontSize:24,fontWeight:700,letterSpacing:"1.5px",color:"#842504",marginBottom:0,lineHeight:1.3,borderBottom:"2px solid #842504",paddingBottom:4,textAlign:"center"}} className="wt">{s}{draft&&<span style={{fontSize:13,fontWeight:400,fontStyle:"italic",color:"#A89070",marginLeft:8,letterSpacing:0}}>(wersja robocza)</span>}</div></div>;
  const para = s => <p style={{margin:"8px 0",lineHeight:1.7,fontSize:14}} dangerouslySetInnerHTML={{__html:s}}/>;
  const instrImg = name => {var src=IMG_BASE+name+".png"; return <img key={src} src={src} style={{width:"100%",height:"auto",display:"block",borderRadius:6}} alt=""/>;};
  function renderPage(){
    switch(page){
    case 0: return (<div>
      {instrImg("ekran_1_witamy1-"+familyId)}
    </div>);
    case 1: return (<div>
      <img src={IMG_BASE+"mapa_miasteczka.png"} style={{width:"100%",height:"auto",display:"block"}} alt="Mapa miasteczka"/>
    </div>);
    case 2: return (<div>
      {instrImg("ekran_2_witamy2-"+familyId)}
    </div>);
    case 3: return (<div>
      {instrImg("ekran_3-role")}
      <div style={{margin:"14px 0"}}>
        {ROLE_DEFS.map(r=>(<div key={r.key} style={{marginBottom:12,display:"flex",gap:10,alignItems:"stretch"}}>
          <img src={IMG_BASE+r.img+".png"} style={{width:140,display:"block",objectFit:"cover",alignSelf:"stretch",flexShrink:0,borderRadius:6}} alt=""/>
          <div style={{flex:1,padding:"10px 14px",background:"#F6E4C8",borderRadius:6,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontWeight:700,fontSize:20,color:"#4C130F",marginBottom:4,lineHeight:1.2}} className="wt">{r.label}{r.required&&<sup style={{fontSize:11,color:"#C00",marginLeft:2}}>*</sup>}</div>
            <div style={{fontSize:15,color:"#6B5B3E",marginBottom:8,lineHeight:1.5,fontWeight:500}}>{r.desc}</div>
            <input type="text" value={roles[r.key]} onChange={e=>{var v=e.target.value;setRoles(p=>({...p,[r.key]:v}));}} disabled={rolesSubmitted}
              placeholder="Imię uczestnika" style={{width:"100%",boxSizing:"border-box",padding:"6px 10px",border:"1px solid #C4B090",borderRadius:4,fontSize:14,fontFamily:"inherit",background:rolesSubmitted?"#E8E0D0":"#fff"}}/>
          </div>
        </div>))}
      </div>
      <div style={{textAlign:"center",marginTop:8}}>
        <div onClick={()=>{if(!rolesSubmitted&&requiredFilled&&!roleSaving)submitRoles();}} style={{position:"relative",display:"inline-block",width:340,height:60,cursor:(!rolesSubmitted&&requiredFilled&&!roleSaving)?"pointer":"default",opacity:(!rolesSubmitted&&!requiredFilled)?0.5:1}}>
          <img src={IMG_BASE+"przycisk_role.png"} style={{width:"100%",height:"100%",display:"block",objectFit:"fill"}} alt=""/>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,fontWeight:700,fontFamily:"'Aka Posse',Georgia,serif",letterSpacing:"0.5px"}}>{rolesSubmitted?"\u2713 Role zatwierdzone":roleSaving?"Zapisuję...":"Zatwierdź role"}</div>
        </div>
      </div>
      {!rolesSubmitted&&<div style={{fontSize:12,color:"#8B7355",marginTop:6,textAlign:"center"}}><sup>*</sup>Role wymagane: Głowa Rodziny, Przedstawiciel, Księgowy</div>}
    </div>);
    case 4: {
      const SLIDES_3=[
        {key:"ekran_5-cel",         label:"Cel"},
        {key:"ekran_5-zasoby",      label:"Zasoby"},
        {key:"ekran_5-kompetencje", label:"Kompetencje"},
        {key:"ekran_5-dzialka",     label:"Działka"},
        {key:"ekran_5-gotowka",     label:"Gotówka"},
        ...(bnbEnabled?[{key:"ekran_5-bnb",label:"Biznes na boku"}]:[]),
        ...(mapEnabled?[{key:"ekran_5-zyla",label:"Złotodajna żyła"}]:[]),
        {key:"ekran_5-los",         label:"Ślepy los"},
      ];
      const safeIdx=Math.min(slide3,SLIDES_3.length-1);
      const menuFont={fontFamily:"'Aka Posse',Georgia,serif",color:"#D4A853",cursor:"pointer",whiteSpace:"nowrap"};
      const menuFontSize=bnbEnabled?12:13;
      return (<div>
        {hdr("Wasze zadania",false)}
        <div style={{position:"relative",width:"100%",marginBottom:8}}>
          <img src={IMG_BASE+"menu_zadania.png"} style={{width:"100%",display:"block"}} alt=""/>
          <div style={{position:"absolute",top:"50%",left:0,right:0,transform:"translateY(-50%)",display:"flex",alignItems:"center",padding:"0 30px"}}>
            <div onClick={()=>{if(safeIdx>0)setSlide3(safeIdx-1);}} style={{...menuFont,fontSize:menuFontSize,opacity:safeIdx===0?0.4:1,cursor:safeIdx===0?"default":"pointer",marginRight:8}}>{"← Wstecz"}</div>
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {SLIDES_3.map((s,i)=>{
                var act=i===safeIdx;
                var isLast=i===SLIDES_3.length-1;
                return <div key={s.key} onClick={()=>setSlide3(i)} style={{...menuFont,fontSize:menuFontSize,padding:"4px 8px",fontWeight:act?700:400,color:act?"#F5ECD0":"#D4A853",background:act?"rgba(212,168,83,0.25)":"transparent",borderRight:isLast?"none":"1px solid rgba(212,168,83,0.4)"}}>{s.label}</div>;
              })}
            </div>
            <div onClick={()=>{if(safeIdx<SLIDES_3.length-1)setSlide3(safeIdx+1);}} style={{...menuFont,fontSize:menuFontSize,opacity:safeIdx===SLIDES_3.length-1?0.4:1,cursor:safeIdx===SLIDES_3.length-1?"default":"pointer",marginLeft:8}}>{"Dalej →"}</div>
          </div>
        </div>
        <img src={IMG_BASE+SLIDES_3[safeIdx].key+".png"} alt={SLIDES_3[safeIdx].label} style={{width:"100%",height:"auto",display:"block"}}/>
      </div>);
    }
    case 5: return (<div>
      {hdr("Przebieg rozgrywki",false)}
      <img src={IMG_BASE+"przebieg_rozgrywki-"+familyId+".png"} alt="Przebieg rozgrywki" style={{width:"100%",display:"block",borderRadius:4}}/>
    </div>);
    case 6: return (<div>
      {hdr("Interfejs gry",false)}
      <img src={IMG_BASE+"interfejs_"+familyId+".png"} alt="Interfejs gry" style={{width:"100%",height:"auto",display:"block",borderRadius:6,cursor:"pointer"}} onClick={()=>setInterfejsZoom(true)}/>
      {interfejsZoom&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setInterfejsZoom(false)}>
        <div style={{position:"relative",maxWidth:"95vw",maxHeight:"95vh"}} onClick={e=>e.stopPropagation()}>
          <div onClick={()=>setInterfejsZoom(false)} style={{position:"absolute",top:-12,right:-12,width:28,height:28,borderRadius:"50%",background:"#4C130F",color:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,fontWeight:700,lineHeight:1,boxShadow:"0 2px 8px rgba(0,0,0,0.4)",zIndex:1}}>✕</div>
          <img src={IMG_BASE+"interfejs_"+familyId+".png"} alt="Interfejs gry" style={{maxWidth:"95vw",maxHeight:"95vh",display:"block",borderRadius:6}}/>
        </div>
      </div>}
    </div>);
    case 7: return (<div>
      {hdr("Jak handlować",false)}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <img src={IMG_BASE+"przycisk_sprzedaz.png"} alt="Sprzedaż" onClick={()=>setTradeTab("sale")}
          style={{height:35,width:"auto",cursor:"pointer",display:"block",
            opacity:tradeTab==="sale"?1:0.5}}/>
        <img src={IMG_BASE+"przycisk_barter.png"} alt="Barter" onClick={()=>setTradeTab("barter")}
          style={{height:35,width:"auto",cursor:"pointer",display:"block",
            opacity:tradeTab==="barter"?1:0.5}}/>
      </div>
      {tradeTab==="sale"&&instrImg("instrukcja_sprzedaz")}
      {tradeTab==="barter"&&instrImg("instrukcja_barter")}
    </div>);
    case 8: return (<div>
      {instrImg("wdz_vintage")}
    </div>);
    default: return null;
    }
  }

  const PAGE_TITLES = ["Witamy","Złotodajna Żyła","Historia","Role","Zadania","Przebieg","Panel","Handel","Start!"];

  return (<div>
    <div style={{minHeight:300,marginBottom:16}}>{renderPage()}</div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #E8D9B8",paddingTop:12}}>
      <img src={IMG_BASE+"przycisk_wstecz.png"} alt="Wstecz" onClick={()=>{if(page>0)setPage(p=>p-1);}}
        style={{height:36,width:"auto",cursor:page===0?"not-allowed":"pointer",opacity:page===0?0.4:1,display:"block"}}/>
      <div style={{display:"flex",gap:6}}>
        {PAGE_TITLES.map((t,i)=>{
          var canGo=allCompleted?true:(i<=maxVisited||(i===maxVisited+1&&canNext));
          var visited=i<=maxVisited;
          return(<div key={i} onClick={()=>{if(canGo)setPage(i);}}
          style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:i===page?700:400,
            background:i===page?"#842504":visited?"#D4A853":"#E8E0D0",
            color:i===page?"#fff":visited?"#4C130F":"#B0A48C",
            cursor:canGo?"pointer":"default",
            transition:"all 0.2s"}}
          title={t}>{i+1}</div>);
        })}
      </div>
      <img src={IMG_BASE+"przycisk_dalej.png"} alt="Dalej" onClick={()=>{if(page<totalPages-1&&canNext)setPage(p=>p+1);}}
        style={{height:36,width:"auto",cursor:(page>=totalPages-1||!canNext)?"not-allowed":"pointer",opacity:(page>=totalPages-1||!canNext)?0.4:1,display:"block"}}/>
    </div>
  </div>);
}

