/* WDZ Online – constants/index.js
 * Jedno źródło prawdy: kategorie kart, rodziny, etapy, parowanie, kolory.
 * Importowany przez: gra, admin, monitor.
 */

// ── Kategorie kart ──
export const C_RES = "res";
export const C_COMP = "comp";
export const C_NRES = "nres";
export const C_NCOMP = "ncomp";
export const C_PLOT = "plot";
export const C_MAP = "map";
export const C_BNB = "bnb";

// ── Rodziny ──
export const FO = ["adams","bennet","clinton","dexter"];
export const FM = {
  adams:  {id:"adams",  nom:"Adamsowie",   gen:"Adamsów",    biz:"Saloon",             col:"#A75F4A", agCol:"#E9CDC2", sPlot:6,  tPlot:1,  mapFrag:1},
  bennet: {id:"bennet", nom:"Bennetowie",  gen:"Bennetów",   biz:"Zakład Pogrzebowy",  col:"#726072", agCol:"#C0B8C0", sPlot:4,  tPlot:6,  mapFrag:2},
  clinton:{id:"clinton",nom:"Clintonowie", gen:"Clintonów",  biz:"Bank",               col:"#5E5971", agCol:"#CECDD4", sPlot:20, tPlot:4,  mapFrag:3},
  dexter: {id:"dexter", nom:"Dexterowie",  gen:"Dexterów",   biz:"Ranczo",             col:"#5B7674", agCol:"#CED6D5", sPlot:1,  tPlot:20, mapFrag:4},
};

// ── Etapy ──
export const STAGES = [
  {id:"PREP",label:"Przygotowanie",type:"prep",defMin:60,pairingIdx:null,phase:null},
  {id:"F1T1",label:"Faza I – Tura 1",type:"turn",defMin:7,pairingIdx:0,phase:1},
  {id:"KN1A",label:"Faza I – Krótka narada 1",type:"kn",defMin:5,pairingIdx:null,phase:1},
  {id:"F1T2",label:"Faza I – Tura 2",type:"turn",defMin:7,pairingIdx:1,phase:1},
  {id:"KN1B",label:"Faza I – Krótka narada 2",type:"kn",defMin:5,pairingIdx:null,phase:1},
  {id:"F1T3",label:"Faza I – Tura 3",type:"turn",defMin:7,pairingIdx:2,phase:1},
  {id:"NAR1",label:"Narada rodzinna I",type:"narada",defMin:15,pairingIdx:null,phase:null},
  {id:"F2T1",label:"Faza II – Tura 1",type:"turn",defMin:15,pairingIdx:0,phase:2},
  {id:"KN2A",label:"Faza II – Krótka narada 1",type:"kn",defMin:5,pairingIdx:null,phase:2},
  {id:"F2T2",label:"Faza II – Tura 2",type:"turn",defMin:15,pairingIdx:1,phase:2},
  {id:"KN2B",label:"Faza II – Krótka narada 2",type:"kn",defMin:5,pairingIdx:null,phase:2},
  {id:"F2T3",label:"Faza II – Tura 3",type:"turn",defMin:15,pairingIdx:2,phase:2},
  {id:"NAR2",label:"Narada rodzinna II",type:"narada",defMin:15,pairingIdx:null,phase:null},
  {id:"F3T1",label:"Faza III – Tura 1",type:"turn",defMin:5,pairingIdx:0,phase:3},
  {id:"KN3A",label:"Faza III – Krótka narada 1",type:"kn",defMin:5,pairingIdx:null,phase:3},
  {id:"F3T2",label:"Faza III – Tura 2",type:"turn",defMin:5,pairingIdx:1,phase:3},
  {id:"KN3B",label:"Faza III – Krótka narada 2",type:"kn",defMin:5,pairingIdx:null,phase:3},
  {id:"F3T3",label:"Faza III – Tura 3",type:"turn",defMin:5,pairingIdx:2,phase:3},
  {id:"END",label:"Zakończenie rozgrywki",type:"end",defMin:0,pairingIdx:null,phase:null},
];

// ── Parowanie ──
export const PAIRINGS = [
  [["adams","bennet"],["clinton","dexter"]],
  [["adams","clinton"],["bennet","dexter"]],
  [["adams","dexter"],["bennet","clinton"]],
];

// ── Ślepy Los ──
export const BLIND_FATE_EVENTS = {
  2:  {text:"Zabłąkana płonąca strzała spowodowała pożar stodoły.",type:"loss",amount:-100},
  3:  {text:"Przez miasteczko przeszedł huragan Matylda.",type:"loss",amount:-80},
  4:  {text:"Jeden z Was miał pecha przy stoliku pokerowym.",type:"loss",amount:-50},
  5:  {text:"Wuj Tom, stary oszust, naciągnął Was na kasę.",type:"loss",amount:-50},
  6:  {text:"Otrzymaliście dywidendę z akcji Union Pacific.",type:"gain",amount:100},
  7:  {text:"Pobliski pułk kawalerii rekwiruje wam część zasobów.",type:"loss_resources",amount:-10},
  8:  {text:"Stado bizonów stratowało Waszą posesję.",type:"loss",amount:-80},
  9:  {text:"Wyciągnęliście \u201eZłoty Los\u201d w loterii ubezpieczyciela.",type:"gain_policy",amount:0},
  10: {text:"Miasto spustoszyła banda Dzikiego Joego.",type:"loss",amount:-50},
  11: {text:"Cena akcji Spirit Company spada do 2 centów.",type:"loss",amount:-100},
  12: {text:"Otrzymaliście spadek po cioci z Nowego Jorku.",type:"gain",amount:200},
};

// ── Biznes na Boku ──
export const BNB_PRODUCTS = {
  adams:  {name:"Mikstura Doktora Geista",    shortName:"Mikstura",  qty:10, unitCost:30, effect:"comp4", effectDesc:"Zastępuje 4% kompetencji"},
  bennet: {name:"Kwatera dla Obywatela",       shortName:"Kwatera",   qty:10, unitCost:30, effect:"point1",effectDesc:"+1 pkt do wyniku"},
  clinton:{name:"Obligacje Limon Sisters",     shortName:"Obligacje", qty:4,  unitCost:75, effect:"cash20",effectDesc:"+20% kasy na koniec gry"},
  dexter: {name:"Voucher Kuriera Preriowego",  shortName:"Kurier",    qty:10, unitCost:30, effect:"res4",  effectDesc:"Zastępuje 4% zasobów"},
};

// ── TASKS – wagi zasobów i kompetencji ──
export const G_TASKS = {
  adams:{
    zasoby:[{id:"stara-destylarnia",pct:30},{id:"pianino",pct:20},{id:"kredens",pct:20},{id:"debowa-beczka",pct:10},{id:"talia-kart",pct:10},{id:"mosiezny-zyrandol",pct:5},{id:"zeliwny-kociolek",pct:5}],
    kompetencje:[{id:"organizowanie-turniejow-pokera",pct:43},{id:"pedzenie-szkockiej-whisky",pct:27},{id:"prowadzenie-kuchni-zbiorowej",pct:18},{id:"przechowywanie-piwa",pct:12}]
  },
  bennet:{
    zasoby:[{id:"zestaw-narzedzi",pct:30},{id:"czarny-material",pct:20},{id:"drewniany-wozek",pct:20},{id:"szpadel",pct:10},{id:"dluto-do-kamienia",pct:10},{id:"zestaw-wizazysty",pct:5},{id:"podest-dla-mowcy",pct:5}],
    kompetencje:[{id:"podstawy-stolarstwa",pct:43},{id:"sztuka-balsamowania",pct:27},{id:"podstawy-makijazu-posmiertnego",pct:18},{id:"wyglaszanie-mow-pogrzebowych",pct:12}]
  },
  clinton:{
    zasoby:[{id:"sejf",pct:30},{id:"liczydlo",pct:20},{id:"karabin",pct:20},{id:"stalowe-drzwi",pct:10},{id:"kasetka",pct:10},{id:"lupa",pct:5},{id:"waga-jubilerska",pct:5}],
    kompetencje:[{id:"zapewnienie-bezpieczenstwa",pct:43},{id:"obsluga-zamka-szyfrowego",pct:27},{id:"biegla-obsluga-liczydla",pct:18},{id:"ocena-wartosci-samorodkow",pct:12}]
  },
  dexter:{
    zasoby:[{id:"lasso",pct:30},{id:"siodlo",pct:20},{id:"colt-navy-1857",pct:20},{id:"wysokie-buty",pct:10},{id:"manierka",pct:10},{id:"kapelusz",pct:5},{id:"pas-z-kabura",pct:5}],
    kompetencje:[{id:"poslugiwanie-sie-lassem",pct:43},{id:"leczenie-chorob-bydla",pct:27},{id:"szybkostrzelnosc-i-celnosc-oka",pct:18},{id:"odnajdywanie-zrodel-wody",pct:12}]
  }
};

// ── Paleta kolorów ──
export const WDZ_COLORS = {
  primary:    "#842504",
  headerBar:  "#4C130F",
  gold:       "#D4A853",
  bg:         "#1A0E08",
  panel:      "#2C1810",
  border:     "#3C2820",
  text:       "#F5F0E8",
  textDim:    "#A89070",
  textMut:    "#8B7355",
  red:        "#C04030",
  greenLt:    "#8BC88B",
  greenDk:    "#2E5B3C",
};

// ── Limity punktowe ──
export const CATS_MAX = {zasoby:30,kompetencje:25,gotowka:25,dzialka:10,mapa:10,relacje:20};
