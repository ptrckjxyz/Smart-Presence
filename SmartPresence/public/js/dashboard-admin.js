// js/dashboard-admin.js
import { db } from './firebase.js';
import { ref, onValue, update, remove, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


const verifyRequests = document.getElementById('verifyRequests');

console.log("✅ Admin dashboard script loaded, db =", db);

// 🔄 Listen to all verification requests
onValue(ref(db, 'verificationRequests'), (snapshot) => {
  verifyRequests.innerHTML = '';
  if (!snapshot.exists()) {
    verifyRequests.innerHTML = `<tr><td colspan="7">No pending verification requests.</td></tr>`;
    return;
  }

  const requests = snapshot.val();
  let found = false;

  Object.entries(requests).forEach(([reqId, data]) => {
    // normalize status field
    const status = data.status || data.verificationStatus || "pending";

    if (status === 'pending') {
      found = true;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${data.firstname || ''} ${data.surname || ''}</td>
        <td>${data.category || 'N/A'}</td>
        <td>${data.email || 'N/A'}</td>
        <td>${data.idNumber || 'N/A'}</td>
        <td><a href="${data.documentUrl}" target="_blank">View ID</a></td>
        <td><a href="${data.facialImageUrl}" target="_blank">View Face</a></td>
        <td>
          <button class="action-btn approve-btn" data-uid="${data.userUid || reqId}">Approve</button>
          <button class="action-btn decline-btn" data-uid="${data.userUid || reqId}">Decline</button>
        </td>
      `;
      verifyRequests.appendChild(row);
    }
  });

  if (!found) {
    verifyRequests.innerHTML = `<tr><td colspan="7">No pending verification requests.</td></tr>`;
  }

  // ✅ Approve user
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      if (!confirm('Approve this verification request?')) return;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();

          // ✅ 1️⃣ Copy data to verifiedUsers
          await set(ref(db, `verifiedUsers/${uid}`), {
            ...userData,
            verificationStatus: "verified",
            verifiedAt: new Date().toISOString(),
          });

          // ✅ 2️⃣ Update or remove from verificationRequests
          await remove(requestRef);

          // ✅ 3️⃣ (Optional) Update existing users record if you still keep one
          await update(ref(db, `users/${uid}`), {
            verificationStatus: "verified",
            verified: true,
          });

          alert('✅ User approved and moved to verifiedUsers!');
        } else {
          alert("⚠️ User data not found in verificationRequests.");
        }

      } catch (err) {
        console.error("Error approving user:", err);
        alert("⚠️ Failed to approve user. Check console for details.");
      }
    });
  });

  // ❌ Decline user
  document.querySelectorAll('.decline-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      if (!confirm('Are you sure you want to decline this verification?')) return;

      try {
        // 1️⃣ Update user record
        await update(ref(db, `users/${uid}`), {
          verificationStatus: "rejected",
          verified: false
        });

        // 2️⃣ Remove from verificationRequests
        await remove(ref(db, `verificationRequests/${uid}`));

        alert('❌ Verification declined.');
      } catch (err) {
        console.error("Error declining user:", err);
        alert("⚠️ Failed to decline user. Check console for details.");
      }
    });
  });
});
document.addEventListener("click", async (e) => {
  const logoutModal = document.getElementById("logoutModal");
  const confirmLogout = document.getElementById("confirmLogout");
  const cancelLogout = document.getElementById("cancelLogout");

  if (!logoutModal || !confirmLogout || !cancelLogout) return;

  // Open modal
  if (e.target.closest("#logoutBtn")) {
    logoutModal.style.display = "flex";
  }

  // Cancel logout
  if (e.target.closest("#cancelLogout")) {
    logoutModal.style.display = "none";
  }

  // Confirm logout
  if (e.target.closest("#confirmLogout")) {
    await signOut(auth);
    window.location.href = "index.html";
  }
});
