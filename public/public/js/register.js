// js/register.js
import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// DOM Elements
const registerForm = document.getElementById('registerForm');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const errorMessageEl = document.getElementById('errorMessage');
const closeSuccessBtn = document.getElementById('closeSuccessBtn');
const closeErrorBtn = document.getElementById('closeErrorBtn');

// ⭐ LIVE INPUT RESTRICTIONS (ADDED ONLY WHAT YOU NEEDED)
document.getElementById('surname').addEventListener('input', function () {
  this.value = this.value.replace(/[^A-Za-z]/g, '');
});

document.getElementById('firstname').addEventListener('input', function () {
  this.value = this.value.replace(/[^A-Za-z]/g, '');
});

document.getElementById('idNumber').addEventListener('input', function () {
  this.value = this.value.replace(/[^0-9]/g, '').slice(0, 15);
});

// 📝 Handle registration
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const category = document.getElementById('category').value;
  const surname = document.getElementById('surname').value.trim();
  const firstname = document.getElementById('firstname').value.trim();
  const idNumber = document.getElementById('idNumber').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  // VALIDATIONS (EXACTLY WHAT YOU REQUESTED)
  if (!/^[A-Za-z]+$/.test(surname)) {
    showError("Surname can contain letters only.");
    return;
  }

  if (!/^[A-Za-z]+$/.test(firstname)) {
    showError("First name can contain letters only.");
    return;
  }

  if (!/^[0-9]+$/.test(idNumber)) {
    showError("ID number must contain numbers only.");
    return;
  }

  if (idNumber.length > 15) {
    showError("ID number cannot exceed 15 digits.");
    return;
  }

  // Basic validation
  if (!category || !surname || !firstname || !idNumber || !password || !confirmPassword) {
    showError("Please fill in all fields.");
    return;
  }

  if (category.toLowerCase() === "admin") {
    showError("Admin accounts cannot be registered here.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match!");
    return;
  }

  // Firebase Auth requires an email, so we use a fake one based on ID number
  const fakeEmail = `${idNumber}@cvsu.edu`;

  try {
    // ✅ Create the user account
    const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
    const user = userCredential.user;

    // ✅ Save user record in Realtime Database
    await set(ref(db, 'users/' + user.uid), {
      category,
      surname,
      firstname,
      idNumber,
      verificationStatus: "not_verified",
      createdAt: new Date().toISOString()
    });

    // ✅ Show success modal
    successModal.style.display = "flex";

  } catch (error) {
    console.error(error);
    showError(error.message);
  }
});

// 🔴 Show error modal
function showError(message) {
  let userFriendlyMessage = message;

  if (message.includes("auth/email-already-in-use")) {
    userFriendlyMessage = "This ID number is already registered.";
  } else if (message.includes("auth/invalid-email")) {
    userFriendlyMessage = "Invalid ID number format.";
  } else if (message.includes("auth/weak-password")) {
    userFriendlyMessage = "Password must be at least 6 characters long.";
  } else if (message.includes("auth/missing-password")) {
    userFriendlyMessage = "Please enter your password.";
  } else if (message.includes("auth/network-request-failed")) {
    userFriendlyMessage = "Network error. Please check your internet connection.";
  } else if (message.includes("auth/internal-error")) {
    userFriendlyMessage = "Something went wrong. Please try again later.";
  }

  errorMessageEl.textContent = userFriendlyMessage;
  errorModal.style.display = "flex";
}

// ✅ Close modals
closeSuccessBtn.addEventListener('click', () => {
  successModal.style.display = "none";
  window.location.href = "index.html";
});

closeErrorBtn.addEventListener('click', () => {
  errorModal.style.display = "none";
});
