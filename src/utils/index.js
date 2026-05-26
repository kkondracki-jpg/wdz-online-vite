/* WDZ Online – utils/index.js */

export const IMG_BASE = "img/";

export function toSlug(s){return s.toLowerCase().replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z').replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');}
export function imgUrl(prefix,name){return IMG_BASE+prefix+'_'+toSlug(name)+'.png';}
export function mapImgUrl(n){return IMG_BASE+'map_fragment-'+n+'.png';}

export const REV_IMG_MAP = {POJEDYNEK:"Rew_1-POJEDYNEK.png",DOMINACJA:"Rew_3-DOMINACJA.png",PRZEWAGA:"Rew_2-PRZEWAGA.png",WYGRANA:"Rew_4-WYGRANA.png",NABOJ_ZNACZNIK:"Rew_5-Naboj-znacznik.png",NABOJ_AMMO:"Rew_6-Naboj-amunicja.png"};
export function getRevImg(key){return REV_IMG_MAP[key]?IMG_BASE+REV_IMG_MAP[key]:null;}

/* ========== FIREBASE ARRAY HELPERS ========== */
export function ensureArray(v){if(!v)return[];if(Array.isArray(v))return v;return Object.values(v);}
export function fixFdFromFirebase(fd){
  if(!fd)return fd;
  var r={};
  for(var k in fd){
    r[k]=Object.assign({},fd[k],{cash:fd[k].cash!=null?fd[k].cash:0,items:ensureArray(fd[k].items)});
  }
  return r;
}

export function revDuelToFB(rc){
  if(!rc) return false;
  return {...rc,
    rounds:rc.rounds&&rc.rounds.length?rc.rounds:"__empty__",
    shotsA:rc.shotsA===null?"__null__":rc.shotsA,
    shotsB:rc.shotsB===null?"__null__":rc.shotsB,
    winner:rc.winner===null?"__null__":rc.winner,
    winField:rc.winField===null?"__null__":rc.winField,
    timerPhase:rc.timerPhase===null?"__null__":rc.timerPhase||"__null__",
    timerStartedAt:rc.timerStartedAt||0,
    timerDuration:rc.timerDuration||0
  };
}
export function revDuelFromFB(rc){
  if(!rc||rc===false) return null;
  return {...rc,
    rounds:rc.rounds==="__empty__"?[]:ensureArray(rc.rounds||[]),
    shotsA:rc.shotsA==="__null__"?null:rc.shotsA,
    shotsB:rc.shotsB==="__null__"?null:rc.shotsB,
    winner:rc.winner==="__null__"?null:rc.winner,
    winField:rc.winField==="__null__"?null:rc.winField,
    timerPhase:rc.timerPhase==="__null__"?null:rc.timerPhase||null,
    timerStartedAt:rc.timerStartedAt||0,
    timerDuration:rc.timerDuration||0
  };
}
export function revActiveToFB(arr){
  if(!arr||!arr.length)return "__empty__";
  return arr.map(d=>revDuelToFB(d));
}
export function revActiveFromFB(val){
  if(!val||val==="__empty__")return [];
  var arr=Array.isArray(val)?val:Object.values(val);
  return arr.map(d=>revDuelFromFB(d)).filter(Boolean);
}
