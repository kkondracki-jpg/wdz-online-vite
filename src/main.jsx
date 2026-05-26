/* WDZ Online v3.1.0 – Vite entry point */
import React from "react";
import ReactDOM from "react-dom/client";

// Firebase compat (preserves global firebase.* API)
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

// Chart.js
import Chart from "chart.js/auto";

// jsPDF – adapter for legacy window.jspdf.jsPDF access
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// Expose globals expected by legacy code
window.React = React;
window.ReactDOM = ReactDOM;
window.firebase = firebase;
window.Chart = Chart;
window.jspdf = { jsPDF };

// Styles
import "./styles/global.css";

// Anti-tampering (moved from inline script)
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});
console.log("%c⚠️ UWAGA", "font-size:28px;color:#C04030;font-weight:900");
console.log(
  "%cTo narzędzie jest przeznaczone dla programistów.\nManipulowanie danymi gry jest niedozwolone i może skutkować dyskwalifikacją.",
  "font-size:14px;color:#842504"
);

// Legacy app (self-rendering – calls ReactDOM.createRoot internally)
import "./legacy/WdzOnline.jsx";
