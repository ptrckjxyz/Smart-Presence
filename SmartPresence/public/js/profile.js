// js/profile.js
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// DOM elements
const profileNameEl = document.getElementById("profileName");
const profileImageEl = document.getElementById("profileImage");
const logoutBtn = document.getElementById("logoutBtn");
const verifyBtn = document.getElementById("verifyBtn");

// Action buttons
const editInfoBtn = document.querySelector(".action-btn:nth-of-type(1)");
const changePassBtn = document.querySelector(".action-btn:nth-of-type(2)");
const rightPanel = document.querySelector(".right-panel");

// Initial placeholders
profileNameEl.textContent = "Loading...";
profileImageEl.textContent = "?";

// 🔐 Monitor auth state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    // Fetch user data from all possible paths
    const verifyRef = ref(db, `verificationRequests/${user.uid}`);
    const verifiedRef = ref(db, `verifiedUsers/${user.uid}`);
    const userRef = ref(db, `users/${user.uid}`);

    const [verifySnap, verifiedSnap, userSnap] = await Promise.all([
      get(verifyRef),
      get(verifiedRef),
      get(userRef),
    ]);

    const verifyData = verifySnap.exists() ? verifySnap.val() : {};
    const verifiedData = verifiedSnap.exists() ? verifiedSnap.val() : {};
    const userData = userSnap.exists() ? userSnap.val() : {};

    // Merge data (priority: verifiedUsers → verificationRequests → users)
    const data = { ...userData, ...verifyData, ...verifiedData };
    const firstname = data.firstname?.trim() || "";
    const surname = data.surname?.trim() || "";
    const fullName = `${firstname} ${surname}`.trim() || "Unnamed User";

    profileNameEl.textContent = fullName;
    profileImageEl.textContent = `${firstname.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?";

    // Determine verification status
    const verificationStatus = data.verificationStatus || "not_verified";

    // ⚡ NEW: Store verification status in sessionStorage for navigation.js
    sessionStorage.setItem("verified", verificationStatus === "verified" ? "true" : "false");

    // Configure verify button
    verifyBtn.disabled = false;
    verifyBtn.classList.remove("pending", "verified", "rejected");

    if (verificationStatus === "verified") {
      verifyBtn.textContent = "VERIFIED";
      verifyBtn.disabled = true;
      verifyBtn.classList.add("verified");
    } else if (verificationStatus === "pending") {
      verifyBtn.textContent = "VERIFICATION PENDING";
      verifyBtn.disabled = true;
      verifyBtn.classList.add("pending");
    } else if (verificationStatus === "rejected") {
      verifyBtn.textContent = "REJECTED - REVERIFY";
      verifyBtn.classList.add("rejected");
      verifyBtn.addEventListener("click", () => (window.location.href = "verify.html"));
    } else {
      verifyBtn.textContent = "VERIFY YOUR ACCOUNT";
      verifyBtn.addEventListener("click", () => (window.location.href = "verify.html"));
    }

    /* 📝 EDIT PERSONAL INFORMATION ---------------------------- */
    editInfoBtn.addEventListener("click", async () => {
      // 🚫 Block if not verified
      if (verificationStatus !== "verified") {
        const verifyModal = document.getElementById("verifyModal");
        if (verifyModal) {
          verifyModal.style.display = "flex";
        } else {
          showError("⚠️ You must verify your account before editing your personal information.");
        }
        return;
      }

      // ✅ Fetch verified user info only
      const verifiedSnap = await get(ref(db, `verifiedUsers/${user.uid}`));
      const info = verifiedSnap.exists() ? verifiedSnap.val() : {};

      rightPanel.innerHTML = `
        <h2 class="section-title">Edit Information</h2>
        <form id="editInfoForm" class="edit-info-form">
          <label>Surname</label>
          <input type="text" id="editSurname" value="${info.surname || ""}" required>

          <label>First Name</label>
          <input type="text" id="editFirstname" value="${info.firstname || ""}" required>

          <label>Middle Name</label>
          <input type="text" id="editMiddlename" value="${info.middlename || ""}">

          <label>Age</label>
          <input type="number" id="editAge" value="${info.age || ""}" required>

          <label>Address</label>
          <input type="text" id="editAddress" value="${info.address || ""}" required>

          <label>Email</label>
          <input type="email" id="editEmail" value="${info.email || ""}" required>

          <label>Contact</label>
          <input type="text" id="editContact" value="${info.contact || ""}" required>

          <label>ID Number</label>
          <input type="text" id="editIdNumber" value="${info.idNumber || ""}" required>

          <div class="form-buttons">
            <button type="submit" class="save-btn">Save Changes</button>
            <button type="button" class="cancel-btn">Cancel</button>
          </div>
        </form>
      `;

      rightPanel.querySelector(".cancel-btn").addEventListener("click", () => window.location.reload());

      const form = document.getElementById("editInfoForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedData = {
          surname: document.getElementById("editSurname").value.trim(),
          firstname: document.getElementById("editFirstname").value.trim(),
          middlename: document.getElementById("editMiddlename").value.trim(),
          age: document.getElementById("editAge").value.trim(),
          address: document.getElementById("editAddress").value.trim(),
          email: document.getElementById("editEmail").value.trim(),
          contact: document.getElementById("editContact").value.trim(),
          idNumber: document.getElementById("editIdNumber").value.trim(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await update(ref(db, `users/${user.uid}`), updatedData);
          await update(ref(db, `verifiedUsers/${user.uid}`), updatedData);
          showSuccess("Information updated successfully!", true);
        } catch (err) {
          console.error("Error updating info:", err);
          showError("Failed to update information. Please try again.");
        }
      });
    });

    /* 🔑 CHANGE PASSWORD ----------------------------- */
    changePassBtn.addEventListener("click", () => {
      rightPanel.innerHTML = `
        <h2 class="section-title">Change Password</h2>
        <form id="changePassForm" class="change-pass-form">
          <label>Current Password</label>
          <input type="password" id="currentPassword" required>

          <label>New Password</label>
          <input type="password" id="newPassword" required minlength="6">

          <label>Confirm New Password</label>
          <input type="password" id="confirmPassword" required minlength="6">

          <div class="form-buttons">
            <button type="submit" class="save-btn">Update Password</button>
            <button type="button" class="cancel-btn">Cancel</button>
          </div>
        </form>
      `;

      rightPanel.querySelector(".cancel-btn").addEventListener("click", () => window.location.reload());

      const form = document.getElementById("changePassForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPass = document.getElementById("currentPassword").value;
        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;

        if (newPass !== confirmPass) {
          showError("Passwords do not match!");
          return;
        }

        try {
          const cred = EmailAuthProvider.credential(user.email, currentPass);
          await reauthenticateWithCredential(user, cred);
          await updatePassword(user, newPass);
          showSuccess("Password updated successfully!", true);
        } catch (err) {
          console.error("Error updating password:", err);
          showError("Incorrect current password or session expired.");
        }
      });
    });

  } catch (error) {
    console.error("Error loading profile:", error);
    profileNameEl.textContent = "Error loading profile";
    profileImageEl.textContent = "?";
  }
});

/* 🎯 Reusable Modals for Success & Error --------------------- */
const successModal = document.getElementById("successModal");
const errorModal = document.getElementById("errorModal");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");
const successOkBtn = document.getElementById("successOkBtn");
const errorOkBtn = document.getElementById("errorOkBtn");

function showSuccess(message, reload = false) {
  successMessage.textContent = message;
  successModal.style.display = "flex";
  successOkBtn.onclick = () => {
    successModal.style.display = "none";
    if (reload) window.location.reload();
  };
}

function showError(message) {
  errorMessage.textContent = message;
  errorModal.style.display = "flex";
  errorOkBtn.onclick = () => (errorModal.style.display = "none");
}

/* 🚪 Logout (with confirmation modal) --------------------- */
const logoutModal = document.getElementById("logoutModal");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

logoutBtn.addEventListener("click", () => {
  logoutModal.style.display = "flex";
});

cancelLogout.addEventListener("click", () => {
  logoutModal.style.display = "none";
});

confirmLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
