/* WDZ Online – game/cards.js */
import { C_RES, C_COMP, C_NRES, C_NCOMP, C_PLOT, C_MAP, C_BNB, BNB_PRODUCTS } from "./constants.js";

let _i=0;
export const ci=()=>"c"+(++_i);
export const txId=()=>{var arr=new Uint8Array(8);crypto.getRandomValues(arr);return "tx_"+Array.from(arr,b=>b.toString(16).padStart(2,"0")).join("");};

export const R =(n,b,w,d)=>({id:ci(),name:n,cat:C_RES, forBiz:b,weight:w,desc:d||""});
export const RB=(n)=>      ({id:ci(),name:n,cat:C_RES, forBiz:null,weight:null,desc:"",blind:true});
export const K =(n,a,t,b,w)=>({id:ci(),name:n,cat:C_COMP,author:a,title:t,forBiz:b,weight:w});
export const KB=(n,a,t)=>    ({id:ci(),name:n,cat:C_COMP,author:a,title:t,forBiz:null,weight:null,blind:true});
export const NR=(n,b,w)=>({id:ci(),name:n,cat:C_NRES, forBiz:b,weight:w});
export const NK=(n,b,w)=>({id:ci(),name:n,cat:C_NCOMP,forBiz:b,weight:w});
export const PL=(nr)=>   ({id:ci(),name:"Działka nr "+nr,cat:C_PLOT,plotNr:nr});
export const MP=(nr)=>   ({id:ci(),name:"Kopia fragmentu mapy "+(nr===1?"Adamsów":nr===2?"Bennetów":nr===3?"Clintonów":"Dexterów"),cat:C_MAP,fragNr:nr});

export function makeBnbCards(fId){var p=BNB_PRODUCTS[fId];var cards=[];for(var i=0;i<p.qty;i++){cards.push({id:ci(),name:p.name,cat:C_BNB,bnbOrigin:fId,effect:p.effect,effectDesc:p.effectDesc});}return cards;}

export const START = {
adams:{cards:[
  R("Dębowa Beczka","Saloon",10,"aby whiskey dojrzewała nabierając koloru"),
  R("Mosiężny Żyrandol","Saloon",5,"aby interes kręcił się do białego rana"),
  R("Żeliwny Kociołek","Saloon",5,"aby prócz gorzały była strawa"),
  R("Zestaw Narzędzi","Zakład Pogrzebowy",30,"aby strugać sosnowe jesionki"),
  R("Karabin","Bank",20,"aby zatrzymać tych, których inne środki nie zatrzymują"),
  R("Siodło","Ranczo",20,"aby zapewnić wygodę całodziennej jazdy"),
  RB("Zestaw Skalpeli"), RB("Zakraplacz"),
  R("Lupa","Bank",5,"aby oceniać jakość złotych samorodków"),
  R("Waga Jubilerska","Bank",5,"aby warzyć i wyceniać złote samorodki"),
  NR("Lasso","Ranczo",30), NR("Colt Navy 1857","Ranczo",20),
  NR("Drewniany Wózek","Zakład Pogrzebowy",20),
  NR("Dębowa Beczka","Saloon",10), NR("Mosiężny Żyrandol","Saloon",5),
  NR("Żeliwny Kociołek","Saloon",5), NR("Zestaw Wizażysty","Zakład Pogrzebowy",5),
  NR("Podest dla Mówcy","Zakład Pogrzebowy",5),
  KB("Pisanie Kaligraficzne","Zeno Scribbler","Pisz z charakterem"),
  K("Podstawy Stolarstwa","Cleef Handyman","Twoja pierwsza sosnowa jesionka","Zakład Pogrzebowy",43),
  K("Obsługa Zamka Szyfrowego","Stan Safebreaker","Sejf bez tajemnic","Bank",27),
  K("Odnajdywanie Źródeł Wody","Harry Wizard","Wahadełko i różdżka","Ranczo",12),
  K("Szybkostrzelność i Celność Oka","Jack Bully","Wyznacz sobie cel","Ranczo",18),
  NK("Wygłaszanie Mów Pogrzebowych","Zakład Pogrzebowy",12),
  NK("Biegła Obsługa Liczydła","Bank",18),
  NK("Leczenie Chorób Bydła","Ranczo",27),
  NK("Podstawy Stolarstwa","Zakład Pogrzebowy",43),
  PL(6), MP(1), MP(1), MP(1), MP(1),
]},
bennet:{cards:[
  R("Lasso","Ranczo",30,"aby chwytać bydło i dyscyplinować stado"),
  R("Czarny Materiał","Zakład Pogrzebowy",20,"aby nadać godny wygląd trumnom z wyższej półki"),
  R("Pianino","Saloon",20,"aby skoczne melodie zachęcały do zabawy"),
  R("Colt Navy 1857","Ranczo",20,"aby mieć ochronę przed niebezpieczeństwami prerii"),
  RB("Telegraf"),
  R("Wysokie Buty","Ranczo",10,"aby kowboj myślał o pracy, zamiast obolałych nogach"),
  RB("Zestaw Stempli"), RB("Tygiel"),
  NR("Sejf","Bank",30), NR("Czarny Materiał","Zakład Pogrzebowy",20),
  NR("Liczydło","Bank",20), NR("Siodło","Ranczo",20),
  NR("Lupa","Bank",5), NR("Waga Jubilerska","Bank",5),
  K("Zapewnienie Bezpieczeństwa","Jeremy Magnum","Bankowe Zabezpieczenia na miarę XIX w.","Bank",43),
  K("Leczenie Chorób Bydła","Anatolij Bykow","Weterynaria","Ranczo",27),
  K("Przechowywanie Piwa","Jack Screwdriver","Zawsze świeże, z białą pianką","Saloon",12),
  KB("Zabawianie Gości na Imprezach","Jackie Zany","Heja, heja, naśladujcie wodzireja"),
  K("Biegła Obsługa Liczydła","Samuel Zweimal","Liczydło – kurs zaawansowany","Bank",18),
  NK("Przechowywanie Piwa","Saloon",12),
  NK("Szybkostrzelność i Celność Oka","Ranczo",18),
  NK("Pędzenie Szkockiej Whisky","Saloon",27),
  NK("Zapewnienie Bezpieczeństwa","Bank",43),
  PL(4), MP(2), MP(2), MP(2), MP(2),
]},
clinton:{cards:[
  R("Stara Destylarnia","Saloon",30,"aby nigdy nie zabrakło tego, co zaspokaja pragnienia"),
  R("Kredens","Saloon",20,"aby alkohol i szkło zawsze były pod ręką"),
  R("Drewniany Wózek","Zakład Pogrzebowy",20,"aby powieźć klienta w jego ostatnią drogę"),
  RB("Stojący Zegar"),
  R("Stalowe Drzwi","Bank",10,"aby chronić przed nieproszonymi gośćmi"),
  R("Kasetka","Bank",10,"aby kasjer bilon miał pod ręką"),
  R("Szpadel","Zakład Pogrzebowy",10,"aby kopać równe i zgrabne groby"),
  RB("Wigwam"),
  NR("Talia Kart","Saloon",10), NR("Pianino","Saloon",20),
  NR("Dłuto do Kamienia","Zakład Pogrzebowy",10),
  NR("Zestaw Narzędzi","Zakład Pogrzebowy",30),
  NR("Stalowe Drzwi","Bank",10), NR("Kasetka","Bank",10),
  NR("Wysokie Buty","Ranczo",10),
  K("Pędzenie Szkockiej Whisky","Ian McMoonshiner","Jak pędzili nasi dziadowie?","Saloon",27),
  K("Prowadzenie Kuchni Zbiorowej","Lucyna Ćwierciakiewiczowa","365 Obiadów","Saloon",18),
  K("Podstawy Makijażu Pośmiertnego","Jean Paul Magicien","Martwy jak żywy","Zakład Pogrzebowy",18),
  K("Posługiwanie się Lassem","Tom Incredible","Być jak Buffalo Bill","Ranczo",43),
  KB("Leczenie Ran Postrzałowych","Jonah Stapler","Kula nie wybiera"),
  NK("Sztuka Balsamowania","Zakład Pogrzebowy",27),
  NK("Prowadzenie Kuchni Zbiorowej","Saloon",18),
  NK("Odnajdywanie Źródeł Wody","Ranczo",12),
  NK("Posługiwanie się Lassem","Ranczo",43),
  PL(20), MP(3), MP(3), MP(3), MP(3),
]},
dexter:{cards:[
  R("Sejf","Bank",30,"aby pieniądze były bezpieczne jak w banku"),
  R("Liczydło","Bank",20,"aby sprawnie sumować większe kwoty"),
  RB("30-letnia Whisky"),
  R("Talia Kart","Saloon",10,"aby przyciągać tych, których pociąga poker"),
  R("Manierka","Ranczo",10,"aby dotrzeć żywym do kolejnego wodopoju"),
  R("Dłuto do Kamienia","Zakład Pogrzebowy",10,"aby kamiennej płycie nadać kształt nagrobka"),
  R("Kapelusz","Ranczo",5,"aby uniknąć udaru na rozpalonej prerii"),
  R("Pas z Kaburą","Ranczo",5,"aby szybko dobywać colta, gdy trzeba"),
  R("Zestaw Wizażysty","Zakład Pogrzebowy",5,"aby rodzina cieszyła się ostatnim rumieńcem klienta"),
  R("Podest dla Mówcy","Zakład Pogrzebowy",5,"aby smutnym ceremoniom dodać powagi"),
  NR("Stara Destylarnia","Saloon",30), NR("Karabin","Bank",20),
  NR("Kredens","Saloon",20), NR("Manierka","Ranczo",10),
  NR("Szpadel","Zakład Pogrzebowy",10), NR("Kapelusz","Ranczo",5),
  NR("Pas z Kaburą","Ranczo",5),
  K("Organizowanie Turniejów Pokera","Paul Gambler","Poker Ekstremalny","Saloon",43),
  KB("Cechowanie Metali Szlachetnych","Tony Marker","Normy probiercze dla opornych"),
  K("Sztuka Balsamowania","Jozef de Balsamo","Balsamowanie Stosowane","Zakład Pogrzebowy",27),
  K("Ocena Wartości Samorodków","Frederic Goldfinger","Nie wszystko złoto co się świeci","Bank",12),
  K("Wygłaszanie Mów Pogrzebowych","Johan Chryzostom Schwätzer","364 Mowy na 364 Pogrzeby","Zakład Pogrzebowy",12),
  NK("Ocena Wartości Samorodków","Bank",12),
  NK("Podstawy Makijażu Pośmiertnego","Zakład Pogrzebowy",18),
  NK("Obsługa Zamka Szyfrowego","Bank",27),
  NK("Organizowanie Turniejów Pokera","Saloon",43),
  PL(1), MP(4), MP(4), MP(4), MP(4),
]},
};
