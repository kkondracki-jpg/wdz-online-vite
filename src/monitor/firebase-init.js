/* WDZ Monitor – firebase-init.js
 * Separate Firebase app for monitor (anonymous auth).
 */
import { firebase } from "../firebase/config.js";

var WDZ_CONFIG = {
  apiKey: "AIzaSyC0h2oqWeC4LUvTZ7n7y1Fte6kxIl-VTac",
  authDomain: "wdz-online.firebaseapp.com",
  databaseURL: "https://wdz-online-default-rtdb.firebaseio.com",
  projectId: "wdz-online",
  storageBucket: "wdz-online.firebasestorage.app",
  messagingSenderId: "1034809779367",
  appId: "1:1034809779367:web:d913232cf95f2ede3c2782"
};

var monApp = firebase.initializeApp(WDZ_CONFIG, "wdz-monitor");
var db = monApp.database();
var auth = monApp.auth();
auth.signInAnonymously().catch(function(e) {
  console.warn("[Monitor] Auth failed:", e.message);
});

export { db, auth, firebase };
