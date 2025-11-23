// js/auth.js
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const loginForm = document.getElementById('loginForm');
const errorModal = document.getElementById('errorModal');
const errorMessageEl = document.getElementById('errorMessage');
const closeErrorBtn = document.getElementById('closeErrorBtn');

// 🔴 Define showError function outside
function showError(message) {
  // 🧠 Replace technical Firebase messages with friendly text
  let userFriendlyMessage = message;

  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
    userFriendlyMessage = "Wrong or invalid ID number or password.";
  } else if (message.includes("auth/user-not-found")) {
    userFriendlyMessage = "No account found with this ID number.";
  } else if (message.includes("auth/too-many-requests")) {
    userFriendlyMessage = "Too many failed attempts. Please try again later.";
  } else if (message.includes("auth/missing-password")) {
    userFriendlyMessage = "Please enter your password.";
  } else if (message.includes("auth/invalid-email")) {
    userFriendlyMessage = "Invalid ID number format.";
  }

  errorMessageEl.textContent = userFriendlyMessage;
  errorModal.style.display = "flex"; // or "block" depending on your CSS
}

closeErrorBtn.addEventListener('click', () => {
  errorModal.style.display = "none";
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idNumber = document.getElementById('idNumber').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!idNumber || !password) {
    showError("Please fill in all fields."); // use modal instead of alert
    return;
  }

  const fakeEmail = `${idNumber}@cvsu.edu`;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
    const user = userCredential.user;

    const snapshot = await get(child(ref(db), `users/${user.uid}`));
    if (!snapshot.exists()) {
      showError("No user data found in database.");
      return;
    }

    const data = snapshot.val();
    const { category, verified = false, firstname, surname } = data;

    sessionStorage.setItem("userId", user.uid);
    sessionStorage.setItem("category", category);
    sessionStorage.setItem("verified", verified);
    sessionStorage.setItem("name", `${firstname} ${surname}`);

    if (category === "teacher") {
      window.location.href = "dashboard-teacher.html";
    } else if (category === "student") {
      window.location.href = "dashboard-student.html";
    } else if (category === "admin") {
      window.location.href = "dashboard-admin.html";
    } else {
      showError("Unknown user category!");
    }

  } catch (error) {
    console.error(error);
    showError(error.message);
  }
});
