// js/dashboard-admin.js
import { db } from './firebase.js';
import { ref, onValue, update, remove, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const verifyRequests = document.getElementById('verifyRequests');
const verifyRequestsTeacher = document.getElementById('verifyRequestsTeacher');
const verifyRequestsStudent = document.getElementById('verifyRequestsStudent');
const verifiedRequestsTeacher = document.getElementById('verifiedRequestsTeacher');
const verifiedRequestsStudent = document.getElementById('verifiedRequestsStudent');
const excuseLettersContainer = document.getElementById('excuseLettersContainer');

console.log("✅ Admin dashboard script loaded, db =", db);

/* ========================================
   MODAL FUNCTIONS FOR VERIFICATION/VERIFIED TABLES WITH PAGINATION
======================================== */

// Pagination state
let verifyCurrentPage = 1;
let verifyTotalPages = 1;
let verifyAllRows = [];
const ROWS_PER_PAGE = 5;

function displayVerifyPage() {
  const start = (verifyCurrentPage - 1) * ROWS_PER_PAGE;
  const end = start + ROWS_PER_PAGE;
  
  // Hide all rows then show only the current page
  verifyAllRows.forEach((row, idx) => {
    row.classList.toggle('hidden', idx < start || idx >= end);
  });
  
  // Update page info and button states
  document.getElementById('verifyPageInfo').textContent = `Page ${verifyCurrentPage} of ${verifyTotalPages}`;
  document.getElementById('verifyPrevBtn').disabled = verifyCurrentPage === 1;
  document.getElementById('verifyNextBtn').disabled = verifyCurrentPage === verifyTotalPages;
}

function verifyPrevPage() {
  if (verifyCurrentPage > 1) {
    verifyCurrentPage--;
    displayVerifyPage();
  }
}

function verifyNextPage() {
  if (verifyCurrentPage < verifyTotalPages) {
    verifyCurrentPage++;
    displayVerifyPage();
  }
}

function openVerificationModal(category) {
  const modal = document.getElementById('verificationRequestsModal');
  const title = document.getElementById('verificationModalTitle');
  const tbody = document.getElementById('verificationModalBody');
  
  title.textContent = category === 'teacher' ? 'Teacher Verification Requests' : 'Student Verification Requests';
  
  // Copy table data to modal
  const sourceTable = category === 'teacher' ? 
    document.getElementById('verifyTableTeacher') : 
    document.getElementById('verifyTableStudent');
  
  const sourceTbody = sourceTable.querySelector('tbody');
  tbody.innerHTML = sourceTbody.innerHTML;
  
  // Setup pagination
  verifyAllRows = Array.from(tbody.querySelectorAll('tr'));
  verifyTotalPages = Math.ceil(verifyAllRows.length / ROWS_PER_PAGE) || 1;
  verifyCurrentPage = 1;
  displayVerifyPage();
  
  // Reattach event listeners to modal buttons
  attachVerificationModalListeners();
  
  modal.classList.add('show');
  setupModalOverlayListeners();
}

function closeVerificationModal() {
  const modal = document.getElementById('verificationRequestsModal');
  modal.classList.remove('show');
}

// Pagination state for verified users
let verifiedCurrentPage = 1;
let verifiedTotalPages = 1;
let verifiedAllRows = [];

function displayVerifiedPage() {
  const start = (verifiedCurrentPage - 1) * ROWS_PER_PAGE;
  const end = start + ROWS_PER_PAGE;
  
  // Hide all rows then show only the current page
  verifiedAllRows.forEach((row, idx) => {
    row.classList.toggle('hidden', idx < start || idx >= end);
  });
  
  // Update page info and button states
  document.getElementById('verifiedPageInfo').textContent = `Page ${verifiedCurrentPage} of ${verifiedTotalPages}`;
  document.getElementById('verifiedPrevBtn').disabled = verifiedCurrentPage === 1;
  document.getElementById('verifiedNextBtn').disabled = verifiedCurrentPage === verifiedTotalPages;
}

function verifiedPrevPage() {
  if (verifiedCurrentPage > 1) {
    verifiedCurrentPage--;
    displayVerifiedPage();
  }
}

function verifiedNextPage() {
  if (verifiedCurrentPage < verifiedTotalPages) {
    verifiedCurrentPage++;
    displayVerifiedPage();
  }
}

function openVerifiedModal(category) {
  const modal = document.getElementById('verifiedUsersModal');
  const title = document.getElementById('verifiedModalTitle');
  const tbody = document.getElementById('verifiedModalBody');
  
  title.textContent = category === 'teacher' ? 'Verified Teachers' : 'Verified Students';
  
  // Copy table data to modal
  const sourceTable = category === 'teacher' ? 
    document.getElementById('verifiedTableTeacher') : 
    document.getElementById('verifiedTableStudent');
  
  const sourceTbody = sourceTable.querySelector('tbody');
  tbody.innerHTML = sourceTbody.innerHTML;
  
  // Setup pagination
  verifiedAllRows = Array.from(tbody.querySelectorAll('tr'));
  verifiedTotalPages = Math.ceil(verifiedAllRows.length / ROWS_PER_PAGE) || 1;
  verifiedCurrentPage = 1;
  displayVerifiedPage();
  
  // Reattach event listeners to modal buttons
  attachVerifiedModalListeners();
  
  modal.classList.add('show');
  setupModalOverlayListeners();
}

function closeVerifiedModal() {
  const modal = document.getElementById('verifiedUsersModal');
  modal.classList.remove('show');
}

/* ========================================
   MODAL BUTTON EVENT LISTENER ATTACHMENT
======================================== */

function attachVerificationModalListeners() {
  // Attach approve button listeners
  document.querySelectorAll('#verificationModalBody .approve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const uid = btn.dataset.uid;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();

          const hasFaceDescriptor = userData.faceDescriptor && 
                                    Array.isArray(userData.faceDescriptor) && 
                                    userData.faceDescriptor.length === 128;

          const approved = await showApproveModal(userData, !hasFaceDescriptor);
          if (!approved) return;

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
            faceDescriptor: userData.faceDescriptor || null,
            category: userData.category || 'unknown',
            verificationStatus: 'verified',
            verified: true,
            verifiedAt: new Date().toISOString(),
            approvedBy: auth.currentUser?.email || 'admin'
          };

          await set(ref(db, `verifiedUsers/${uid}`), verifiedUserData);
          await remove(requestRef);
          await update(ref(db, `users/${uid}`), {
            verificationStatus: 'verified',
            verified: true,
            verifiedAt: new Date().toISOString()
          });

          showToast('✅ User approved and verified!', 'success');
          closeVerificationModal();
        }
      } catch (error) {
        console.error('❌ Approval error:', error);
        showToast('Error approving user', 'error');
      }
    });
  });

  // Attach decline button listeners
  document.querySelectorAll('#verificationModalBody .decline-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const uid = btn.dataset.uid;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          const declined = await showDeclineModal(userData);
          if (!declined) return;

          await remove(requestRef);
          showToast('❌ Verification request declined', 'info');
          closeVerificationModal();
        }
      } catch (error) {
        console.error('❌ Decline error:', error);
        showToast('Error declining request', 'error');
      }
    });
  });

  // Attach view ID and view face links
  document.querySelectorAll('#verificationModalBody .view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = link.dataset.idUrl;
      if (url) await showViewIDModal(url);
    });
  });

  document.querySelectorAll('#verificationModalBody .view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = link.dataset.faceUrl;
      if (url) await showViewFaceModal(url);
    });
  });
}

function attachVerifiedModalListeners() {
  // Attach unverify button listeners
  document.querySelectorAll('#verifiedModalBody .unverify-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const uid = btn.dataset.uid;

      try {
        // Fetch user data from database to get user details for modal
        const verifiedRef = ref(db, `verifiedUsers/${uid}`);
        const snapshot = await get(verifiedRef);

        if (!snapshot.exists()) {
          showToast('User not found', 'error');
          return;
        }

        const userData = snapshot.val();

        // Show unverify confirmation modal with user details
        const confirmed = await showUnverifyModal(userData);
        if (!confirmed) return;

        // Proceed with unverification
        await remove(verifiedRef);
        await remove(ref(db, `verificationRequests/${uid}`));
        await update(ref(db, `users/${uid}`), {
          verificationStatus: 'unverified',
          verified: false,
          unverifiedAt: new Date().toISOString()
        });

        showToast(`✅ ${userData.firstname} ${userData.surname} verification removed. They must resubmit verification.`, 'info');
        closeVerifiedModal();
      } catch (error) {
        console.error('❌ Unverify error:', error);
        showToast('Error unverifying user', 'error');
      }
    });
  });

  // Attach view ID and view face links
  document.querySelectorAll('#verifiedModalBody .view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = link.dataset.idUrl;
      if (url) await showViewIDModal(url);
    });
  });

  document.querySelectorAll('#verifiedModalBody .view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = link.dataset.faceUrl;
      if (url) await showViewFaceModal(url);
    });
  });
}

// Make modal functions globally accessible for onclick handlers
window.openVerificationModal = openVerificationModal;
window.closeVerificationModal = closeVerificationModal;
window.openVerifiedModal = openVerifiedModal;
window.closeVerifiedModal = closeVerifiedModal;
window.verifyPrevPage = verifyPrevPage;
window.verifyNextPage = verifyNextPage;
window.verifiedPrevPage = verifiedPrevPage;
window.verifiedNextPage = verifiedNextPage;

/* ========================================
   MODAL UTILITY FUNCTIONS
======================================== */

// Close modal when clicking overlay
function setupModalOverlayListeners() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.closest('.modal').style.display = 'none';
      }
    });
  });
}

// Show toast notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Show Approve Modal with optional warning
function showApproveModal(userData, hasWarning = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById('approveModal');
    const titleEl = document.getElementById('approveTitle');
    const messageEl = document.getElementById('approveMessage');
    const warningEl = document.getElementById('approveWarning');
    const confirmBtn = document.getElementById('confirmApprove');
    const cancelBtn = document.getElementById('cancelApprove');

    // Set content
    titleEl.textContent = `Approve ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname} will be approved and added to verified users.`;
    warningEl.style.display = hasWarning ? 'block' : 'none';

    // Show modal
    modal.style.display = 'flex';

    // Handle confirm
    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show Decline Modal
function showDeclineModal(userData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('declineModal');
    const titleEl = document.getElementById('declineTitle');
    const messageEl = document.getElementById('declineMessage');
    const confirmBtn = document.getElementById('confirmDecline');
    const cancelBtn = document.getElementById('cancelDecline');

    // Set content
    titleEl.textContent = `Decline ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname}'s verification request will be rejected.`;

    // Show modal
    modal.style.display = 'flex';

    // Handle confirm
    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show Reject Letter Modal
function showRejectLetterModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('rejectLetterModal');
    const reasonInput = document.getElementById('rejectionReason');
    const confirmBtn = document.getElementById('confirmReject');
    const cancelBtn = document.getElementById('cancelReject');

    // Clear input
    reasonInput.value = '';

    // Show modal
    modal.style.display = 'flex';

    // Handle confirm
    const handleConfirm = () => {
      const reason = reasonInput.value.trim();
      modal.style.display = 'none';
      cleanup();
      resolve(reason);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(null);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show Approve Letter Modal
function showApproveLetterModal(studentName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('approveLetterModal');
    const confirmBtn = document.getElementById('confirmApproveLetter');
    const cancelBtn = document.getElementById('cancelApproveLetter');

    // Show modal
    modal.style.display = 'flex';

    // Handle confirm
    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show View Face Modal
function showViewFaceModal(faceUrl) {
  return new Promise((resolve) => {
    const modal = document.getElementById('viewFaceModal');
    const confirmBtn = document.getElementById('confirmViewFace');
    const cancelBtn = document.getElementById('cancelViewFace');

    // Show modal with proper z-index layering
    modal.classList.add('show');

    // Handle confirm
    const handleConfirm = () => {
      modal.classList.remove('show');
      cleanup();
      window.open(faceUrl, '_blank');
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show View ID Modal
function showViewIDModal(idUrl) {
  return new Promise((resolve) => {
    const modal = document.getElementById('viewIDModal');
    const confirmBtn = document.getElementById('confirmViewID');
    const cancelBtn = document.getElementById('cancelViewID');

    // Show modal with proper z-index layering
    modal.classList.add('show');

    // Handle confirm
    const handleConfirm = () => {
      modal.classList.remove('show');
      cleanup();
      window.open(idUrl, '_blank');
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// Show Unverify Modal
function showUnverifyModal(userData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('unverifyModal');
    const titleEl = document.getElementById('unverifyTitle');
    const messageEl = document.getElementById('unverifyMessage');
    const confirmBtn = document.getElementById('confirmUnverify');
    const cancelBtn = document.getElementById('cancelUnverify');

    // Set content
    titleEl.textContent = `Remove Verification for ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname} will need to go through the verification process again from the start.`;

    // Show modal
    modal.style.display = 'flex';

    // Handle confirm
    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

/* ======================================== */

// 🔄 Listen to all verification requests
// 🔄 Listen to all verification requests and separate by category
onValue(ref(db, 'verificationRequests'), (snapshot) => {
  // Clear both containers
  verifyRequestsTeacher.innerHTML = '';
  verifyRequestsStudent.innerHTML = '';
  
  if (!snapshot.exists()) {
    verifyRequestsTeacher.innerHTML = `<tr><td colspan="6">No pending teacher verifications.</td></tr>`;
    verifyRequestsStudent.innerHTML = `<tr><td colspan="6">No pending student verifications.</td></tr>`;
    return;
  }

  const requests = snapshot.val();
  let foundTeacher = false;
  let foundStudent = false;

  Object.entries(requests).forEach(([reqId, data]) => {
    // normalize status field
    const status = data.status || data.verificationStatus || "pending";

    if (status === 'pending') {
      const category = data.category || 'unknown';
      const isTeacher = category.toLowerCase() === 'teacher';
      
      if (isTeacher) foundTeacher = true;
      else foundStudent = true;

      const row = document.createElement('tr');
      
      // ✨ Show indicator if face descriptor exists
      const hasDescriptor = data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128;
      const descriptorBadge = hasDescriptor 
        ? '<span style="color: green; font-size: 12px;">✓ Face Data</span>' 
        : '<span style="color: orange; font-size: 12px;">⚠ No Face Data</span>';
      
      row.innerHTML = `
        <td>${data.firstname || ''} ${data.surname || ''}</td>
        <td>${data.email || 'N/A'}</td>
        <td>${data.idNumber || 'N/A'}</td>
        <td><a href="#" class="view-id-link" data-id-url="${data.documentUrl}">View ID</a></td>
        <td>
          <a href="#" class="view-face-link" data-face-url="${data.facialImageUrl}">View Face</a><br>
          ${descriptorBadge}
        </td>
        <td>
          <button class="action-btn approve-btn" data-uid="${data.userUid || reqId}">Approve</button>
          <button class="action-btn decline-btn" data-uid="${data.userUid || reqId}">Decline</button>
        </td>
      `;
      
      // Append to appropriate container
      if (isTeacher) {
        verifyRequestsTeacher.appendChild(row);
      } else {
        verifyRequestsStudent.appendChild(row);
      }
    }
  });

  // Show "no pending" messages if empty
  if (!foundTeacher) {
    verifyRequestsTeacher.innerHTML = `<tr><td colspan="6">No pending teacher verifications.</td></tr>`;
  }
  if (!foundStudent) {
    verifyRequestsStudent.innerHTML = `<tr><td colspan="6">No pending student verifications.</td></tr>`;
  }

  // ✅ View ID - Show modal before opening link
  document.querySelectorAll('.view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const idUrl = link.dataset.idUrl;
      await showViewIDModal(idUrl);
    });
  });

  // ✅ View Face - Show modal before opening link
  document.querySelectorAll('.view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const faceUrl = link.dataset.faceUrl;
      await showViewFaceModal(faceUrl);
    });
  });

  // ✅ Approve user - ✨ UPDATED TO INCLUDE FACE DESCRIPTOR
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();

          // ✨ CRITICAL: Validate face descriptor exists
          const hasFaceDescriptor = userData.faceDescriptor && 
                                    Array.isArray(userData.faceDescriptor) && 
                                    userData.faceDescriptor.length === 128;

          // Show modal with optional warning
          const approved = await showApproveModal(userData, !hasFaceDescriptor);
          if (!approved) return;

          if (!hasFaceDescriptor) {
            console.log(`⚠️ No face descriptor for ${userData.firstname} ${userData.surname}`);
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

          showToast(`✅ ${userData.firstname} ${userData.surname} approved successfully! Face Recognition: ${hasFaceDescriptor ? '✅ Enabled' : '❌ Not available'}`);

        } else {
          showToast("⚠️ User data not found in verificationRequests.");
        }

      } catch (err) {
        console.error("Error approving user:", err);
        showToast("⚠️ Failed to approve user. Check console for details.");
      }
    });
  });

  // ❌ Decline user
  document.querySelectorAll('.decline-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;

      try {
        // Get user data for modal
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (!snapshot.exists()) {
          showToast("⚠️ User data not found.");
          return;
        }

        const userData = snapshot.val();

        // Show decline modal
        const declined = await showDeclineModal(userData);
        if (!declined) return;

        // 1️⃣ Update user record
        await update(ref(db, `users/${uid}`), {
          verificationStatus: "rejected",
          verified: false,
          rejectedAt: new Date().toISOString()
        });

        // 2️⃣ Remove from verificationRequests
        await remove(requestRef);

        showToast('❌ Verification declined.');
      } catch (err) {
        console.error("Error declining user:", err);
        showToast("⚠️ Failed to decline user. Check console for details.");
      }
    });
  });
});

// 🔄 Listen to verified users and display them separated by category
onValue(ref(db, 'verifiedUsers'), (snapshot) => {
  // Clear both containers
  verifiedRequestsTeacher.innerHTML = '';
  verifiedRequestsStudent.innerHTML = '';
  
  if (!snapshot.exists()) {
    verifiedRequestsTeacher.innerHTML = `<tr><td colspan="6">No verified teachers yet.</td></tr>`;
    verifiedRequestsStudent.innerHTML = `<tr><td colspan="6">No verified students yet.</td></tr>`;
    return;
  }

  const verifiedUsers = snapshot.val();
  let foundTeacher = false;
  let foundStudent = false;

  Object.entries(verifiedUsers).forEach(([uid, data]) => {
    const category = data.category || 'unknown';
    const isTeacher = category.toLowerCase() === 'teacher';
    
    if (isTeacher) foundTeacher = true;
    else foundStudent = true;

    const row = document.createElement('tr');
    
    // ✨ Show indicator if face descriptor exists
    const hasDescriptor = data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128;
    const descriptorBadge = hasDescriptor 
      ? '<span style="color: green; font-size: 12px;">✓ Face Data</span>' 
      : '<span style="color: orange; font-size: 12px;">⚠ No Face Data</span>';
    
    // Format verified date
    const verifiedDate = data.verifiedAt 
      ? new Date(data.verifiedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'N/A';
    
    row.innerHTML = `
      <td>${data.firstname || ''} ${data.surname || ''}</td>
      <td>${data.email || 'N/A'}</td>
      <td>${data.idNumber || 'N/A'}</td>
      <td><a href="#" class="view-id-link" data-id-url="${data.documentUrl}">View ID</a></td>
      <td>
        <a href="#" class="view-face-link" data-face-url="${data.facialImageUrl}">View Face</a><br>
        ${descriptorBadge}
      </td>
      <td>${verifiedDate}</td>
      <td>
        <button class="action-btn unverify-btn decline-action" data-uid="${uid}">Unverify</button>
      </td>
    `;
    
    // Store user data in row for later access
    row.dataset.userData = JSON.stringify(data);
    
    // Append to appropriate container
    if (isTeacher) {
      verifiedRequestsTeacher.appendChild(row);
    } else {
      verifiedRequestsStudent.appendChild(row);
    }
  });

  // Show "no verified" messages if empty
  if (!foundTeacher) {
    verifiedRequestsTeacher.innerHTML = `<tr><td colspan="7">No verified teachers yet.</td></tr>`;
  }
  if (!foundStudent) {
    verifiedRequestsStudent.innerHTML = `<tr><td colspan="7">No verified students yet.</td></tr>`;
  }

  // ✅ Unverify user - Remove verification and move back to start
  document.querySelectorAll('.unverify-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const row = btn.closest('tr');
      const userData = JSON.parse(row.dataset.userData);

      // Show unverify modal
      const confirmed = await showUnverifyModal(userData);
      if (!confirmed) return;

      try {
        // 1️⃣ Remove from verifiedUsers
        await remove(ref(db, `verifiedUsers/${uid}`));

        // 2️⃣ Remove from verificationRequests if exists
        await remove(ref(db, `verificationRequests/${uid}`));

        // 3️⃣ Update users record to reset verification status
        await update(ref(db, `users/${uid}`), {
          verificationStatus: "unverified",
          verified: false,
          unverifiedAt: new Date().toISOString()
        });

        showToast(`✅ ${userData.firstname} ${userData.surname} verification removed. They must resubmit verification.`);

      } catch (err) {
        console.error("Error unverifying user:", err);
        showToast("⚠️ Failed to remove verification. Check console for details.");
      }
    });
  });

  // ✅ View ID - Show modal before opening link
  document.querySelectorAll('.view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const idUrl = link.dataset.idUrl;
      await showViewIDModal(idUrl);
    });
  });

  // ✅ View Face - Show modal before opening link
  document.querySelectorAll('.view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const faceUrl = link.dataset.faceUrl;
      await showViewFaceModal(faceUrl);
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
      // start collapsed by default for a compact list view
      card.className = 'excuse-card collapsed';
      
      const submittedDate = new Date(letter.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const statusClass = (letter.status === 'pending_admin') ? 'pending' : (letter.status === 'rejected_admin' ? 'rejected' : 'approved');
      // User-facing label for the status — show clearer text
      const statusText = (letter.status === 'pending_admin') ? 'Pending Approval' : (letter.status === 'rejected_admin' ? 'Rejected' : 'Approved');

      card.innerHTML = `
        <div class="excuse-header" role="button" tabindex="0">
          <div class="student-info">
            <h4>${letter.studentName}</h4>
            <div class="compact-meta">
              <div class="meta-line">Student #: ${letter.studentNumber || 'N/A'}</div>
              <div class="meta-line">Class: ${letter.className || 'N/A'}</div>
              <div class="meta-line">ID: ${letter.studentNumber || 'N/A'}</div>
              <div class="meta-line">Submitted: ${submittedDate}</div>
              <div class="meta-line">Reason: ${letter.reason.length > 220 ? (letter.reason.substring(0,220) + '...') : letter.reason}</div>
            </div>
          </div>
          <span class="status-badge ${statusClass}">${statusText}</span>
          <span class="chevron" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
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
      
      // Keep the card collapsed initially (details / actions hidden)
      const detailsBlock = card.querySelector('.excuse-details');
      const actionsBlock = card.querySelector('.excuse-actions');
      if (detailsBlock) detailsBlock.style.maxHeight = '0';
      if (actionsBlock) actionsBlock.style.maxHeight = '0';

      excuseLettersContainer.appendChild(card);
    });
    
    // Add expand/collapse toggle for each card header
    document.querySelectorAll('.excuse-card').forEach(card => {
      const header = card.querySelector('.excuse-header');
      const details = card.querySelector('.excuse-details');
      const actions = card.querySelector('.excuse-actions');

      // make keyboard accessible
      header.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          header.click();
        }
      });

      header.addEventListener('click', async (e) => {
        // Avoid toggle when clicking interactive elements inside header
        if (e.target.closest('button')) return;

        const isExpanded = card.classList.toggle('expanded');
        card.classList.toggle('collapsed', !isExpanded);

        // Smoothly set maxHeight so transitions are animated and then scroll
        // into view once transition completes (robust across browsers / zoom).
        const setExpandedHeights = () => {
          if (isExpanded) {
            if (details) details.style.maxHeight = details.scrollHeight + 'px';
            if (actions) actions.style.maxHeight = actions.scrollHeight + 'px';
          } else {
            if (details) details.style.maxHeight = 0;
            if (actions) actions.style.maxHeight = 0;
          }
        };

        // Helper: wait for transitions on an array of elements (fallback timeout)
        const waitForTransitions = (elems = [], timeout = 450) => {
          return new Promise(resolve => {
            let remaining = elems.filter(Boolean).length;
            if (remaining === 0) return resolve();

            const handlers = [];
            elems.forEach(el => {
              if (!el) return;
              const onEnd = (ev) => {
                // only care about max-height or opacity transitions
                if (ev && ev.propertyName && (ev.propertyName.includes('max-height') || ev.propertyName.includes('opacity'))) {
                  el.removeEventListener('transitionend', onEnd);
                  remaining -= 1;
                  if (remaining <= 0) resolve();
                }
              };
              el.addEventListener('transitionend', onEnd);
              handlers.push({ el, onEnd });
            });

            // Fallback: if transitionend doesn't fire (browsers/resizing), resolve after timeout
            const id = setTimeout(() => {
              handlers.forEach(h => h.el.removeEventListener('transitionend', h.onEnd));
              resolve();
            }, timeout);
          });
        };

        // Helper: ensure the card is visible in the viewport - scroll if needed
        const ensureCardVisible = (cardEl) => {
          if (!cardEl || !cardEl.getBoundingClientRect) return;
          const rect = cardEl.getBoundingClientRect();
          const margin = 16; // small breathing room
          // If top is above viewport or bottom below viewport, scroll by the needed delta
          if (rect.top < margin) {
            window.scrollBy({ top: rect.top - margin, behavior: 'smooth' });
          } else if (rect.bottom > window.innerHeight - margin) {
            window.scrollBy({ top: rect.bottom - window.innerHeight + margin, behavior: 'smooth' });
          }
        };

        // Apply heights. First, nudge the viewport immediately so the header
        // isn't hidden (use rAF to give the browser a layout tick), then
        // wait for transitions (using computed durations) and re-check.
        setExpandedHeights();

        // Quick scroll to reduce perceived delay while height animates
        requestAnimationFrame(() => {
          // prefer scrollIntoView for consistent cross-browser behavior
          try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (err) { ensureCardVisible(card); }
        });

        // Compute a reasonable timeout from computed transition durations
        const computeTimeout = (el) => {
          if (!el) return 0;
          const cs = window.getComputedStyle(el);
          const durations = cs.transitionDuration.split(',').map(s => parseFloat(s) || 0);
          const delays = cs.transitionDelay.split(',').map(s => parseFloat(s) || 0);
          // pick the largest duration+delay (in seconds) and convert to ms
          const maxSec = Math.max(...durations.map((d, i) => d + (delays[i] || 0)));
          return Math.ceil(maxSec * 1000) + 60; // add small buffer
        };

        const timeout = Math.max(computeTimeout(details), computeTimeout(actions), 250);

        await waitForTransitions([details, actions], timeout);

        // Final alignment after transition finishes — ensure content is visible
        try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (err) { ensureCardVisible(card); }
      });
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
        const approved = await showApproveLetterModal();
        if (approved) {
          await approveExcuseLetter(letterId);
        }
      });
    });
    
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const letterId = e.target.closest('button').dataset.letterId;
        const reason = await showRejectLetterModal();
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
    // Create a modal wrapper that matches the site's admin modals
    modal = document.createElement('div');
    modal.id = 'letterViewModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content letter-modal">
        <h3>Excuse Letter</h3>
        <div class="letter-info">
          <p>Student: ${letter.studentName}</p>
          <p>Date: ${letter.date}</p>
          <p>Reason: ${letter.reason}</p>
        </div>
        <div id="letterModalContent" class="letter-content"></div>
        <button id="closeLetterModal" class="btn-close">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Close when clicking the overlay (the overlay is the first child)
    const overlayEl = modal.querySelector('.modal-overlay');
    if (overlayEl) {
      overlayEl.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    // Close via button
    modal.querySelector('#closeLetterModal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  }
  
  // Update info with per-line metadata
  const submitted = letter.submittedAt ? new Date(letter.submittedAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (letter.date || 'N/A');
  modal.querySelector('.letter-info').innerHTML = `
    <p>Student: ${letter.studentName || 'N/A'}</p>
    <p>Student #: ${letter.studentNumber || 'N/A'}</p>
    <p>Class: ${letter.className || 'N/A'}</p>
    <p>ID: ${letter.studentNumber || 'N/A'}</p>
    <p>Submitted: ${submitted}</p>
    <p>Reason: ${letter.reason || 'N/A'}</p>
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
  
  showToast('✅ Excuse letter approved and forwarded to teacher!');
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
  
  showToast('❌ Excuse letter rejected.');
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
  setupModalOverlayListeners(); // Enable modal overlay click-to-close
  setTimeout(showFaceDescriptorStats, 2000);
});