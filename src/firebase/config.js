/* WDZ Online – firebase/config.js */
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: "AIzaSyC0h2oqWeC4LUvTZ7n7y1Fte6kxIl-VTac",
  authDomain: "wdz-online.firebaseapp.com",
  databaseURL: "https://wdz-online-default-rtdb.firebaseio.com",
  projectId: "wdz-online",
  storageBucket: "wdz-online.firebasestorage.app",
  messagingSenderId: "1034809779367",
  appId: "1:1034809779367:web:d913232cf95f2ede3c2782"
};

export const IS_LOCAL = window.location.protocol === "file:";
export { firebase };
export var fbApp = null;
export var db = null;
export var auth = null;

if(!IS_LOCAL && typeof firebase !== "undefined"){
  fbApp = firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  auth = firebase.auth();
  auth.signInAnonymously().catch(function(e){ console.warn("[WDZ] Auth failed:", e.message); });
}

export function generateRoomCode(){
  var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code="WDZ-";
  var arr=new Uint8Array(6);
  crypto.getRandomValues(arr);
  for(var i=0;i<6;i++) code+=chars[arr[i]%chars.length];
  return code;
}

export function getOrCreatePlayerId(){
  var key="wdz_player_id";
  var id=sessionStorage.getItem(key);
  if(!id){
    var arr=new Uint8Array(8);
    crypto.getRandomValues(arr);
    id=Array.from(arr).map(b=>b.toString(16).padStart(2,"0")).join("");
    sessionStorage.setItem(key,id);
  }
  return id;
}

export function getUrlParams(){
  var p=new URLSearchParams(window.location.search);
  var s=p.get("s")||p.get("session")||"";
  var f=p.get("f")||p.get("family")||"";
  return{sessionCode:s.toUpperCase(),familyId:f.toLowerCase()};
}

export function buildFamilyLink(roomCode,familyId){
  var base=window.location.origin+window.location.pathname;
  return base+"?s="+roomCode+"&f="+familyId;
}
