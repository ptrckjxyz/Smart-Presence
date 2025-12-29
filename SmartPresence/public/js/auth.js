// js/auth.js
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const loginForm = document.getElementById('loginForm');
const errorModal = document.getElementById('errorModal');
const errorMessageEl = document.getElementById('errorMessage');
const closeErrorBtn = document.getElementById('closeErrorBtn');

// Check if this is a join class link
const urlParams = new URLSearchParams(window.location.search);
const joinCode = urlParams.get('join');

// Load and display class info if join code exists
if (joinCode) {
  loadClassInfo(joinCode);
}

async function loadClassInfo(shortId) {
  try {
    const shortLinkRef = ref(db, `shortLinks/${shortId}`);
    const snapshot = await get(shortLinkRef);
    
    if (snapshot.exists()) {
      const linkData = snapshot.val();
      
      // Store class info for after login
      sessionStorage.setItem('pendingClassJoin', JSON.stringify({
        teacherId: linkData.teacherId,
        classId: linkData.classId,
        department: linkData.department,
        className: linkData.className
      }));
      
      // Update the page title and add message
      const loginSection = document.querySelector('.login-section');
      const h2 = loginSection.querySelector('h2');
      
      if (h2) {
        h2.textContent = `Join ${linkData.className}`;
        h2.style.fontSize = '1.5rem';
      }
      
      // Add class code display
      if (!loginSection.querySelector('.class-code-display')) {
        const classCodeDiv = document.createElement('div');
        classCodeDiv.className = 'class-code-display';
        classCodeDiv.innerHTML = `
          <span style="color: #6b7280; font-size: 0.85rem;">Class Code:</span>
          <span style="color: #667eea; font-weight: 600; font-size: 0.9rem; margin-left: 5px;">${linkData.classId}</span>
        `;
        classCodeDiv.style.cssText = 'text-align: center; margin-bottom: 15px; padding: 8px; background: #f3f4f6; border-radius: 8px;';
        h2.insertAdjacentElement('afterend', classCodeDiv);
      }
      
      // Add a subtitle message
      if (!loginSection.querySelector('.join-message')) {
        const message = document.createElement('p');
        message.className = 'join-message';
        message.textContent = 'Login or create an account to join this class';
        message.style.cssText = 'color: #6b7280; margin-bottom: 20px; text-align: center; font-size: 0.9rem;';
        const classCodeDisplay = loginSection.querySelector('.class-code-display');
        classCodeDisplay.insertAdjacentElement('afterend', message);
      }
    } else {
      showError('Invalid or expired class link. Please contact your teacher for a new link.');
    }
  } catch (error) {
    console.error('Error loading class info:', error);
  }
}

// 🔴 Define showError function
function showError(message) {
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
  errorModal.style.display = "flex";
}

closeErrorBtn.addEventListener('click', () => {
  errorModal.style.display = "none";
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idNumber = document.getElementById('idNumber').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!idNumber || !password) {
    showError("Please fill in all fields.");
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
    const { category, firstname, surname } = data;

    // Check verification status
    const verifiedSnapshot = await get(child(ref(db), `verifiedUsers/${user.uid}`));
    const verifyRequestSnapshot = await get(child(ref(db), `verificationRequests/${user.uid}`));
    
    let verificationStatus = "not_verified";
    
    if (verifiedSnapshot.exists()) {
      verificationStatus = verifiedSnapshot.val().verificationStatus || "not_verified";
    } else if (verifyRequestSnapshot.exists()) {
      verificationStatus = verifyRequestSnapshot.val().verificationStatus || "not_verified";
    }

    const isVerified = verificationStatus === "verified";

    // Store in sessionStorage
    sessionStorage.setItem("userId", user.uid);
    sessionStorage.setItem("category", category);
    sessionStorage.setItem("verified", isVerified ? "true" : "false");
    sessionStorage.setItem("name", `${firstname} ${surname}`);

    // ✅ CHECK FOR RETURN URL (from QR scan redirect)
    const returnUrl = urlParams.get('returnUrl');
    
    if (returnUrl && category === "student") {
      if (isVerified) {
        // User is verified, redirect back to scan page
        console.log('✅ Verified student, redirecting to:', returnUrl);
        
        // Show loading message
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        loadingOverlay.innerHTML = `
          <div style="background: white; padding: 30px 50px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
            <div style="font-weight: 600; font-size: 18px; color: #1f2937;">Marking your attendance...</div>
          </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        setTimeout(() => {
          window.location.href = decodeURIComponent(returnUrl);
        }, 1500);
        return;
      } else {
        // User needs verification
        sessionStorage.setItem('verificationMessage', 'Please verify your account before marking attendance.');
        sessionStorage.setItem('pendingReturnUrl', returnUrl);
        window.location.href = 'verification-pending.html';
        return;
      }
    }

    // Check if user came from a class join link
    const pendingJoin = sessionStorage.getItem('pendingClassJoin');
    
    if (pendingJoin && category === "student") {
      if (isVerified) {
        // User is verified, join the class
        const joinData = JSON.parse(pendingJoin);
        sessionStorage.removeItem('pendingClassJoin');
        
        // Show loading message
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        loadingOverlay.innerHTML = `
          <div style="background: white; padding: 30px 50px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">📚</div>
            <div style="font-weight: 600; font-size: 18px; color: #1f2937;">Joining ${joinData.className}...</div>
          </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        setTimeout(() => {
          window.location.href = `classes-student.html?dept=${joinData.department}&class=${joinData.classId}&teacher=${joinData.teacherId}`;
        }, 1500);
        return;
      } else {
        // User needs verification
        sessionStorage.setItem('verificationMessage', 'Please verify your account before joining a class.');
        window.location.href = 'profile.html';
        return;
      }
    }

    // Normal login flow - redirect based on category
    if (category === "teacher") {
      window.location.href = "dashboard-teacher.html";
    } else if (category === "student") {
      if (isVerified) {
        window.location.href = "dashboard-student.html";
      } else {
        window.location.href = "verification-pending.html";
      }
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