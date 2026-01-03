// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzMnLQ7fJNXZe63fe3V_4FRTZ-DhRbVwg",
  authDomain: "smartpresence-26635.firebaseapp.com",
  databaseURL: "https://smartpresence-26635-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartpresence-26635",
  storageBucket: "smartpresence-26635.firebasestorage.app",
  messagingSenderId: "720308845057",
  appId: "1:720308845057:web:31c272a421a59d9f299e00"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };
