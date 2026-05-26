/* WDZ Online – game/constants.js */

export const FM = {
  adams:  {id:"adams",  nom:"Adamsowie",  gen:"Adamsów",  biz:"Saloon",            col:"#A75F4A", sPlot:6,  tPlot:1, mapFrag:1},
  bennet: {id:"bennet", nom:"Bennetowie", gen:"Bennetów", biz:"Zakład Pogrzebowy", col:"#726072", sPlot:4,  tPlot:6, mapFrag:2},
  clinton:{id:"clinton",nom:"Clintonowie",gen:"Clintonów",biz:"Bank",              col:"#5E5971", sPlot:20, tPlot:4, mapFrag:3},
  dexter: {id:"dexter", nom:"Dexterowie", gen:"Dexterów", biz:"Ranczo",            col:"#5B7674", sPlot:1,  tPlot:20,mapFrag:4},
};
export const FO = ["adams","bennet","clinton","dexter"];

export const PAIRINGS = [
  [["adams","bennet"],["clinton","dexter"]],
  [["adams","clinton"],["bennet","dexter"]],
  [["adams","dexter"],["bennet","clinton"]],
];

export const STAGES = [
  {id:"PREP", label:"Przygotowanie",               type:"prep",   defMin:60, pairingIdx:null, phase:null},
  {id:"F1T1", label:"Faza I – Tura 1",        type:"turn",   defMin:7,  pairingIdx:0,    phase:1},
  {id:"KN1A", label:"Faza I – Krótka narada 1", type:"kn", defMin:5, pairingIdx:null, phase:1},
  {id:"F1T2", label:"Faza I – Tura 2",        type:"turn",   defMin:7,  pairingIdx:1,    phase:1},
  {id:"KN1B", label:"Faza I – Krótka narada 2", type:"kn", defMin:5, pairingIdx:null, phase:1},
  {id:"F1T3", label:"Faza I – Tura 3",        type:"turn",   defMin:7,  pairingIdx:2,    phase:1},
  {id:"NAR1", label:"Narada rodzinna I",            type:"narada", defMin:15, pairingIdx:null, phase:null},
  {id:"F2T1", label:"Faza II – Tura 1",       type:"turn",   defMin:15, pairingIdx:0,    phase:2},
  {id:"KN2A", label:"Faza II – Krótka narada 1",type:"kn", defMin:5, pairingIdx:null, phase:2},
  {id:"F2T2", label:"Faza II – Tura 2",       type:"turn",   defMin:15, pairingIdx:1,    phase:2},
  {id:"KN2B", label:"Faza II – Krótka narada 2",type:"kn", defMin:5, pairingIdx:null, phase:2},
  {id:"F2T3", label:"Faza II – Tura 3",       type:"turn",   defMin:15, pairingIdx:2,    phase:2},
  {id:"NAR2", label:"Narada rodzinna II",           type:"narada", defMin:15, pairingIdx:null, phase:null},
  {id:"F3T1", label:"Faza III – Tura 1",      type:"turn",   defMin:5,  pairingIdx:0,    phase:3},
  {id:"KN3A", label:"Faza III – Krótka narada 1",type:"kn", defMin:5, pairingIdx:null, phase:3},
  {id:"F3T2", label:"Faza III – Tura 2",      type:"turn",   defMin:5,  pairingIdx:1,    phase:3},
  {id:"KN3B", label:"Faza III – Krótka narada 2",type:"kn", defMin:5, pairingIdx:null, phase:3},
  {id:"F3T3", label:"Faza III – Tura 3",      type:"turn",   defMin:5,  pairingIdx:2,    phase:3},
  {id:"END",  label:"Zakończenie rozgrywki",  type:"end",    defMin:0,  pairingIdx:null, phase:null},
];

export const PHASE_NAMES = {1:"WYMIANA INFORMACJI",2:"PIERWSZE TRANSAKCJE",3:"FINAŁ"};

export const AGENDA_ITEMS=[
  {idx:0,type:"prep",label:"PRZYGOTOWANIE"},
  {idx:1,type:"turn",label:"Tura 1",phase:1,phaseLabel:"FAZA INFORMACYJNA"},
  {idx:2,type:"kn",label:"Narada",phase:1},
  {idx:3,type:"turn",label:"Tura 2",phase:1},
  {idx:4,type:"kn",label:"Narada",phase:1},
  {idx:5,type:"turn",label:"Tura 3",phase:1},
  {idx:6,type:"narada",label:"Narada"},
  {idx:7,type:"turn",label:"Tura 1",phase:2,phaseLabel:"FAZA TRANSAKCYJNA"},
  {idx:8,type:"kn",label:"Narada",phase:2},
  {idx:9,type:"turn",label:"Tura 2",phase:2},
  {idx:10,type:"kn",label:"Narada",phase:2},
  {idx:11,type:"turn",label:"Tura 3",phase:2},
  {idx:12,type:"narada",label:"Narada"},
  {idx:13,type:"turn",label:"Tura 1",phase:3,phaseLabel:"FAZA FINAŁOWA"},
  {idx:14,type:"kn",label:"Narada",phase:3},
  {idx:15,type:"turn",label:"Tura 2",phase:3},
  {idx:16,type:"kn",label:"Narada",phase:3},
  {idx:17,type:"turn",label:"Tura 3",phase:3},
  {idx:18,type:"omow",label:"OMÓWIENIE"},
];

export const C_RES="res",C_COMP="comp",C_NRES="nres",C_NCOMP="ncomp",C_PLOT="plot",C_MAP="map",C_BNB="bnb";

export const BNB_PRODUCTS = {
  adams:  {name:"Mikstura Doktora Geista",  shortName:"Mikstura",   qty:10, unitCost:30, effect:"comp4",   effectDesc:"Zastępuje 4% kompetencji", color:"#A75F4A", imgSlug:"bnb_mikstura-doktora-geista"},
  bennet: {name:"Kwatera dla Obywatela",    shortName:"Kwatera",    qty:10, unitCost:30, effect:"point1",  effectDesc:"+1 pkt do wyniku",         color:"#726072", imgSlug:"bnb_kwatera-dla-obywatela"},
  clinton:{name:"Obligacje Limon Sisters",   shortName:"Obligacje",  qty:4,  unitCost:75, effect:"cash20",  effectDesc:"+20% kasy na koniec gry",  color:"#5E5971", imgSlug:"bnb_obligacje-limon-sisters"},
  dexter: {name:"Voucher Kuriera Preriowego",shortName:"Kurier",     qty:10, unitCost:30, effect:"res4",    effectDesc:"Zastępuje 4% zasobów",     color:"#5B7674", imgSlug:"bnb_voucher-kuriera-preriowego"},
};

export const BLIND_FATE_EVENTS = {
  2:  {text:"Zabłąkana płonąca strzała spowodowała pożar stodoły.", type:"loss", amount:-100},
  3:  {text:"Przez miasteczko przeszedł huragan Matylda.", type:"loss", amount:-80},
  4:  {text:"Jeden z Was miał pecha przy stoliku pokerowym.", type:"loss", amount:-50},
  5:  {text:"Wuj Tom, stary oszust, naciągnął Was na kasę.", type:"loss", amount:-50},
  6:  {text:"Otrzymaliście dywidendę z akcji Union Pacific.", type:"gain", amount:100},
  7:  {text:"Pobliski pułk kawalerii rekwiruje wam część zasobów.", type:"loss_resources", amount:-10},
  8:  {text:"Stado bizonów stratowało Waszą posesję.", type:"loss", amount:-80},
  9:  {text:"Wyciągnęliście \u201eZłoty Los\u201d w loterii ubezpieczyciela.", type:"gain_policy", amount:0},
  10: {text:"Miasto spustoszyła banda Dzikiego Joego.", type:"loss", amount:-50},
  11: {text:"Cena akcji Spirit Company spada do 2 centów.", type:"loss", amount:-100},
  12: {text:"Otrzymaliście spadek po cioci z Nowego Jorku.", type:"gain", amount:200},
};

export function getMeetingPartner(fId,pairingIdx){
  var pairs=PAIRINGS[pairingIdx];
  for(var p of pairs){if(p.includes(fId))return p.find(x=>x!==fId);}
  return null;
}
