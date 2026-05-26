/* WDZ Online – hooks/index.js */
import { db, IS_LOCAL } from "../firebase/config.js";
import React, { useState, useEffect } from "react";
import firebase from "firebase/compat/app";

export function useConnectionStatus(){
  const [online,setOnline]=useState(!IS_LOCAL);
  useEffect(()=>{
    if(IS_LOCAL||!db) return;
    var ref=db.ref(".info/connected");
    var cb=ref.on("value",snap=>{setOnline(!!snap.val());});
    return()=>ref.off("value",cb);
  },[]);
  return online;
}

export function useServerTimeOffset(){
  const [offset,setOffset]=useState(0);
  useEffect(()=>{
    if(IS_LOCAL||!db) return;
    var ref=db.ref(".info/serverTimeOffset");
    var cb=ref.on("value",snap=>{setOffset(snap.val()||0);});
    return()=>ref.off("value",cb);
  },[]);
  return offset;
}

export function usePlayerHeartbeat(roomCode,familyId,playerId){
  useEffect(()=>{
    if(!roomCode||!familyId||!playerId||!db) return;
    var ref=db.ref("rooms/"+roomCode+"/players/"+familyId+"/members/"+playerId+"/lastSeen");
    ref.set(firebase.database.ServerValue.TIMESTAMP);
    var iv=setInterval(()=>{
      ref.set(firebase.database.ServerValue.TIMESTAMP);
    },30000);
    return()=>clearInterval(iv);
  },[roomCode,familyId,playerId]);
}
