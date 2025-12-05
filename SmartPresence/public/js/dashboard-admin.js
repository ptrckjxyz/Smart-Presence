// js/dashboard-admin.js
import { db } from './firebase.js';
import { ref, onValue, update, remove, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const verifyRequests = document.getElementById('verifyRequests');
const excuseLettersContainer = document.getElementById('excuseLettersContainer');

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
      
      // ✨ NEW: Show indicator if face descriptor exists
      const hasDescriptor = data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128;
      const descriptorBadge = hasDescriptor 
        ? '<span style="color: green; font-size: 12px;">✓ Face Data</span>' 
        : '<span style="color: orange; font-size: 12px;">⚠ No Face Data</span>';
      
      row.innerHTML = `
        <td>${data.firstname || ''} ${data.surname || ''}</td>
        <td>${data.category || 'N/A'}</td>
        <td>${data.email || 'N/A'}</td>
        <td>${data.idNumber || 'N/A'}</td>
        <td><a href="${data.documentUrl}" target="_blank">View ID</a></td>
        <td>
          <a href="${data.facialImageUrl}" target="_blank">View Face</a><br>
          ${descriptorBadge}
        </td>
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

  // ✅ Approve user - ✨ UPDATED TO INCLUDE FACE DESCRIPTOR
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      if (!confirm('Approve this verification request?')) return;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();

          // ✨ CRITICAL: Validate face descriptor exists
          const hasFaceDescriptor = userData.faceDescriptor && 
                                    Array.isArray(userData.faceDescriptor) && 
                                    userData.faceDescriptor.length === 128;

          if (!hasFaceDescriptor) {
            const proceed = confirm(
              '⚠️ WARNING: This user has no face descriptor data!\n\n' +
              'They will NOT be able to use facial recognition attendance.\n\n' +
              'This may happen if they verified using an old version.\n\n' +
              'Do you still want to approve?'
            );
            if (!proceed) return;
          } else {
            console.log(`✅ Face descriptor found for ${userData.firstname} ${userData.surname} (128 dimensions)`);
          }

          // ✅ 1️⃣ Copy ALL data to verifiedUsers INCLUDING face descriptor
          const verifiedUserData = {
            surname: userData.surname,
            firstname: userData.firstname,
            middlename: userData.middlename || '',
            age: userData.age,
            address: userData.address,
            email: userData.email,
            contact: userData.contact,
            idNumber: userData.idNumber,
            documentUrl: userData.documentUrl,
            facialImageUrl: userData.facialImageUrl,
            faceDescriptor: userData.faceDescriptor || null, // ✨ CRITICAL: Include face descriptor
            category: userData.category || 'unknown',
            verificationStatus: 'verified',
            verified: true,
            verifiedAt: new Date().toISOString(),
            approvedBy: auth.currentUser?.email || 'admin'
          };

          await set(ref(db, `verifiedUsers/${uid}`), verifiedUserData);
          console.log(`📤 Saved to verifiedUsers/${uid} with face descriptor:`, 
                      hasFaceDescriptor ? '✅ Yes' : '❌ No');

          // ✅ 2️⃣ Remove from verificationRequests
          await remove(requestRef);

          // ✅ 3️⃣ Update users record
          await update(ref(db, `users/${uid}`), {
            verificationStatus: 'verified',
            verified: true,
            verifiedAt: new Date().toISOString()
          });

          alert(`✅ ${userData.firstname} ${userData.surname} approved successfully!\n\n` +
                `Face Recognition: ${hasFaceDescriptor ? '✅ Enabled' : '❌ Not available'}`);

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
          verified: false,
          rejectedAt: new Date().toISOString()
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

// 📋 Load excuse letters pending admin approval
function loadPendingExcuseLetters() {
  const excuseLettersRef = ref(db, 'excuseLetters');
  
  onValue(excuseLettersRef, (snapshot) => {
    if (!excuseLettersContainer) return;
    
    excuseLettersContainer.innerHTML = '';
    
    if (!snapshot.exists()) {
      excuseLettersContainer.innerHTML = '<div class="empty-state"><p>No excuse letters pending approval.</p></div>';
      return;
    }
    
    const letters = [];
    snapshot.forEach(childSnap => {
      const letter = childSnap.val();
      if (letter.status === 'pending_admin') {
        letters.push({
          id: childSnap.key,
          ...letter
        });
      }
    });
    
    if (letters.length === 0) {
      excuseLettersContainer.innerHTML = '<div class="empty-state"><p>No excuse letters pending approval.</p></div>';
      return;
    }
    
    // Sort by submission date (newest first)
    letters.sort((a, b) => b.submittedAt - a.submittedAt);
    
    letters.forEach(letter => {
      const card = document.createElement('div');
      card.className = 'excuse-card';
      
      const submittedDate = new Date(letter.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      card.innerHTML = `
        <div class="excuse-header">
          <div class="student-info">
            <h4>${letter.studentName}</h4>
            <p class="student-meta">Student #: ${letter.studentNumber}</p>
            <p class="student-meta">Class: ${letter.className}</p>
          </div>
          <span class="status-badge pending">Pending Admin</span>
        </div>
        
        <div class="excuse-details">
          <div class="detail-row">
            <span class="label">Excuse Date:</span>
            <span class="value">${letter.date}</span>
          </div>
          <div class="detail-row">
            <span class="label">Submitted:</span>
            <span class="value">${submittedDate}</span>
          </div>
          <div class="detail-row reason">
            <span class="label">Reason:</span>
            <p class="reason-text">${letter.reason}</p>
          </div>
        </div>
        
        <div class="excuse-actions">
          <button class="btn-view" data-letter-id="${letter.id}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            View Letter
          </button>
          <button class="btn-approve" data-letter-id="${letter.id}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 4L6 11.5 2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Approve
          </button>
          <button class="btn-reject" data-letter-id="${letter.id}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Reject
          </button>
        </div>
      `;
      
      excuseLettersContainer.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const letterId = e.target.closest('button').dataset.letterId;
        const letterRef = ref(db, `excuseLetters/${letterId}`);
        const snap = await get(letterRef);
        if (snap.exists()) {
          showLetterModal(snap.val());
        }
      });
    });
    
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const letterId = e.target.closest('button').dataset.letterId;
        if (confirm('Approve this excuse letter? It will be forwarded to the teacher.')) {
          await approveExcuseLetter(letterId);
        }
      });
    });
    
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const letterId = e.target.closest('button').dataset.letterId;
        const reason = prompt('Enter reason for rejection (optional):');
        if (reason !== null) {
          await rejectExcuseLetter(letterId, reason);
        }
      });
    });
  });
}

// Show letter in modal
function showLetterModal(letter) {
  let modal = document.getElementById('letterViewModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'letterViewModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box letter-modal">
        <h3>Excuse Letter</h3>
        <div class="letter-info">
          <p><strong>Student:</strong> ${letter.studentName}</p>
          <p><strong>Date:</strong> ${letter.date}</p>
          <p><strong>Reason:</strong> ${letter.reason}</p>
        </div>
        <div id="letterModalContent" class="letter-content"></div>
        <button id="closeLetterModal" class="btn-close">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    document.getElementById('closeLetterModal').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // Update info
  modal.querySelector('.letter-info').innerHTML = `
    <p><strong>Student:</strong> ${letter.studentName}</p>
    <p><strong>Date:</strong> ${letter.date}</p>
    <p><strong>Reason:</strong> ${letter.reason}</p>
  `;
  
  const content = document.getElementById('letterModalContent');
  
  if (letter.fileType && letter.fileType.startsWith('image/')) {
    content.innerHTML = `<img src="${letter.fileData}" alt="Excuse Letter">`;
  } else if (letter.fileType === 'application/pdf') {
    content.innerHTML = `<iframe src="${letter.fileData}"></iframe>`;
  } else {
    content.innerHTML = '<p class="no-preview">File preview not available.</p>';
  }
  
  modal.style.display = 'flex';
}

// Approve excuse letter (admin)
async function approveExcuseLetter(letterId) {
  const letterRef = ref(db, `excuseLetters/${letterId}`);
  
  await update(letterRef, {
    status: 'pending_teacher',
    adminApprovedAt: Date.now(),
    adminApprovedBy: auth.currentUser.uid
  });
  
  alert('✅ Excuse letter approved and forwarded to teacher!');
}

// Reject excuse letter (admin)
async function rejectExcuseLetter(letterId, reason) {
  const letterRef = ref(db, `excuseLetters/${letterId}`);
  
  await update(letterRef, {
    status: 'rejected_admin',
    rejectedAt: Date.now(),
    rejectedBy: auth.currentUser.uid,
    rejectionReason: reason || 'No reason provided'
  });
  
  alert('❌ Excuse letter rejected.');
}

// Logout functionality
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

/* ========================================
   OPTIONAL: ADD FACE DESCRIPTOR STATISTICS
======================================== */
function showFaceDescriptorStats() {
  const statsRef = ref(db, 'verifiedUsers');
  get(statsRef).then(snapshot => {
    if (snapshot.exists()) {
      let total = 0;
      let withDescriptor = 0;
      
      snapshot.forEach(childSnap => {
        total++;
        const data = childSnap.val();
        if (data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
          withDescriptor++;
        }
      });
      
      console.log(`📊 Face Recognition Stats: ${withDescriptor}/${total} users have face data (${Math.round(withDescriptor/total*100)}%)`);
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadPendingExcuseLetters();
  setTimeout(showFaceDescriptorStats, 2000);
});