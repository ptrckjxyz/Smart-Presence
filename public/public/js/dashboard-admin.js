// js/dashboard-admin.js
import { db } from './firebase.js';
import { ref, onValue, update, remove, get, set, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const verifyRequests = document.getElementById('verifyRequests');
const verifyRequestsTeacher = document.getElementById('verifyRequestsTeacher');
const verifyRequestsStudent = document.getElementById('verifyRequestsStudent');
const verifiedRequestsTeacher = document.getElementById('verifiedRequestsTeacher');
const verifiedRequestsStudent = document.getElementById('verifiedRequestsStudent');

console.log("✅ Admin dashboard script loaded, db =", db);

/* ========================================
   NOTIFICATION HELPER FUNCTIONS
======================================== */

// Send notification to user
async function sendNotificationToUser(userId, title, message, type, extraData = {}) {
  try {
    const notificationRef = push(ref(db, `notifications/${userId}`));
    await set(notificationRef, {
      title: title,
      message: message,
      type: type,
      timestamp: Date.now(),
      read: false,
      ...extraData
    });
    console.log(`✅ Notification sent to user ${userId}: ${title}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
}

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
  
  verifyAllRows.forEach((row, idx) => {
    row.classList.toggle('hidden', idx < start || idx >= end);
  });
  
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
  
  const sourceTable = category === 'teacher' ? 
    document.getElementById('verifyTableTeacher') : 
    document.getElementById('verifyTableStudent');
  
  const sourceTbody = sourceTable.querySelector('tbody');
  tbody.innerHTML = sourceTbody.innerHTML;
  
  verifyAllRows = Array.from(tbody.querySelectorAll('tr'));
  verifyTotalPages = Math.ceil(verifyAllRows.length / ROWS_PER_PAGE) || 1;
  verifyCurrentPage = 1;
  displayVerifyPage();
  
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
  
  verifiedAllRows.forEach((row, idx) => {
    row.classList.toggle('hidden', idx < start || idx >= end);
  });
  
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
  
  const sourceTable = category === 'teacher' ? 
    document.getElementById('verifiedTableTeacher') : 
    document.getElementById('verifiedTableStudent');
  
  const sourceTbody = sourceTable.querySelector('tbody');
  tbody.innerHTML = sourceTbody.innerHTML;
  
  verifiedAllRows = Array.from(tbody.querySelectorAll('tr'));
  verifiedTotalPages = Math.ceil(verifiedAllRows.length / ROWS_PER_PAGE) || 1;
  verifiedCurrentPage = 1;
  displayVerifiedPage();
  
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

          // Send notification to user
          await sendNotificationToUser(
            uid,
            '✅ Account Verified!',
            `Congratulations! Your ${userData.category} account has been approved and verified by the admin. You now have full access to all features.`,
            'verification_approved',
            {
              category: userData.category,
              verifiedAt: new Date().toISOString()
            }
          );

          showToast('✅ User approved and verified!', 'success');
          closeVerificationModal();
        }
      } catch (error) {
        console.error('❌ Approval error:', error);
        showToast('Error approving user', 'error');
      }
    });
  });

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
          
          // Send notification to user
          await sendNotificationToUser(
            uid,
            '❌ Verification Declined',
            `Your ${userData.category} verification request has been declined by the admin. Please contact support for more information or resubmit your verification with correct documents.`,
            'verification_declined',
            {
              category: userData.category,
              declinedAt: new Date().toISOString()
            }
          );

          showToast('❌ Verification request declined', 'info');
          closeVerificationModal();
        }
      } catch (error) {
        console.error('❌ Decline error:', error);
        showToast('Error declining request', 'error');
      }
    });
  });

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
  document.querySelectorAll('#verifiedModalBody .unverify-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const uid = btn.dataset.uid;

      try {
        const verifiedRef = ref(db, `verifiedUsers/${uid}`);
        const snapshot = await get(verifiedRef);

        if (!snapshot.exists()) {
          showToast('User not found', 'error');
          return;
        }

        const userData = snapshot.val();

        const confirmed = await showUnverifyModal(userData);
        if (!confirmed) return;

        await remove(verifiedRef);
        await remove(ref(db, `verificationRequests/${uid}`));
        await update(ref(db, `users/${uid}`), {
          verificationStatus: 'unverified',
          verified: false,
          unverifiedAt: new Date().toISOString()
        });

        // Send notification to user
        await sendNotificationToUser(
          uid,
          '⚠️ Account Verification Removed',
          `Your ${userData.category} account verification has been removed by the admin. You will need to go through the verification process again to regain full access. Please resubmit your verification documents.`,
          'verification_removed',
          {
            category: userData.category,
            unverifiedAt: new Date().toISOString()
          }
        );

        showToast(`✅ ${userData.firstname} ${userData.surname} verification removed. They must resubmit verification.`, 'info');
        closeVerifiedModal();
      } catch (error) {
        console.error('❌ Unverify error:', error);
        showToast('Error unverifying user', 'error');
      }
    });
  });

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

function setupModalOverlayListeners() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.closest('.modal').style.display = 'none';
      }
    });
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

function showApproveModal(userData, hasWarning = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById('approveModal');
    const titleEl = document.getElementById('approveTitle');
    const messageEl = document.getElementById('approveMessage');
    const warningEl = document.getElementById('approveWarning');
    const confirmBtn = document.getElementById('confirmApprove');
    const cancelBtn = document.getElementById('cancelApprove');

    titleEl.textContent = `Approve ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname} will be approved and added to verified users.`;
    warningEl.style.display = hasWarning ? 'block' : 'none';

    modal.style.display = 'flex';

    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function showDeclineModal(userData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('declineModal');
    const titleEl = document.getElementById('declineTitle');
    const messageEl = document.getElementById('declineMessage');
    const confirmBtn = document.getElementById('confirmDecline');
    const cancelBtn = document.getElementById('cancelDecline');

    titleEl.textContent = `Decline ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname}'s verification request will be rejected.`;

    modal.style.display = 'flex';

    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function showViewFaceModal(faceUrl) {
  return new Promise((resolve) => {
    const modal = document.getElementById('viewFaceModal');
    const confirmBtn = document.getElementById('confirmViewFace');
    const cancelBtn = document.getElementById('cancelViewFace');

    modal.classList.add('show');

    const handleConfirm = () => {
      modal.classList.remove('show');
      cleanup();
      window.open(faceUrl, '_blank');
      resolve(true);
    };

    const handleCancel = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function showViewIDModal(idUrl) {
  return new Promise((resolve) => {
    const modal = document.getElementById('viewIDModal');
    const confirmBtn = document.getElementById('confirmViewID');
    const cancelBtn = document.getElementById('cancelViewID');

    modal.classList.add('show');

    const handleConfirm = () => {
      modal.classList.remove('show');
      cleanup();
      window.open(idUrl, '_blank');
      resolve(true);
    };

    const handleCancel = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function showUnverifyModal(userData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('unverifyModal');
    const titleEl = document.getElementById('unverifyTitle');
    const messageEl = document.getElementById('unverifyMessage');
    const confirmBtn = document.getElementById('confirmUnverify');
    const cancelBtn = document.getElementById('cancelUnverify');

    titleEl.textContent = `Remove Verification for ${userData.firstname || 'User'}?`;
    messageEl.textContent = `${userData.firstname} ${userData.surname} will need to go through the verification process again from the start.`;

    modal.style.display = 'flex';

    const handleConfirm = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

/* ========================================
   VERIFICATION REQUESTS LISTENER
======================================== */

onValue(ref(db, 'verificationRequests'), (snapshot) => {
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
    const status = data.status || data.verificationStatus || "pending";

    if (status === 'pending') {
      const category = data.category || 'unknown';
      const isTeacher = category.toLowerCase() === 'teacher';
      
      if (isTeacher) foundTeacher = true;
      else foundStudent = true;

      const row = document.createElement('tr');
      
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
      
      if (isTeacher) {
        verifyRequestsTeacher.appendChild(row);
      } else {
        verifyRequestsStudent.appendChild(row);
      }
    }
  });

  if (!foundTeacher) {
    verifyRequestsTeacher.innerHTML = `<tr><td colspan="6">No pending teacher verifications.</td></tr>`;
  }
  if (!foundStudent) {
    verifyRequestsStudent.innerHTML = `<tr><td colspan="6">No pending student verifications.</td></tr>`;
  }

  document.querySelectorAll('.view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const idUrl = link.dataset.idUrl;
      await showViewIDModal(idUrl);
    });
  });

  document.querySelectorAll('.view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const faceUrl = link.dataset.faceUrl;
      await showViewFaceModal(faceUrl);
    });
  });

  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
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

          if (!hasFaceDescriptor) {
            console.log(`⚠️ No face descriptor for ${userData.firstname} ${userData.surname}`);
          } else {
            console.log(`✅ Face descriptor found for ${userData.firstname} ${userData.surname} (128 dimensions)`);
          }

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
          console.log(`📤 Saved to verifiedUsers/${uid} with face descriptor:`, 
                      hasFaceDescriptor ? '✅ Yes' : '❌ No');

          await remove(requestRef);

          await update(ref(db, `users/${uid}`), {
            verificationStatus: 'verified',
            verified: true,
            verifiedAt: new Date().toISOString()
          });

          // Send notification to user
          await sendNotificationToUser(
            uid,
            '✅ Account Verified!',
            `Congratulations! Your ${userData.category} account has been approved and verified by the admin. You now have full access to all features.`,
            'verification_approved',
            {
              category: userData.category,
              verifiedAt: new Date().toISOString()
            }
          );

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

  document.querySelectorAll('.decline-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;

      try {
        const requestRef = ref(db, `verificationRequests/${uid}`);
        const snapshot = await get(requestRef);

        if (!snapshot.exists()) {
          showToast("⚠️ User data not found.");
          return;
        }

        const userData = snapshot.val();

        const declined = await showDeclineModal(userData);
        if (!declined) return;

        await update(ref(db, `users/${uid}`), {
          verificationStatus: "rejected",
          verified: false,
          rejectedAt: new Date().toISOString()
        });

        await remove(requestRef);

        // Send notification to user
        await sendNotificationToUser(
          uid,
          '❌ Verification Declined',
          `Your ${userData.category} verification request has been declined by the admin. Please contact support for more information or resubmit your verification with correct documents.`,
          'verification_declined',
          {
            category: userData.category,
            declinedAt: new Date().toISOString()
          }
        );

        showToast('❌ Verification declined.');
      } catch (err) {
        console.error("Error declining user:", err);
        showToast("⚠️ Failed to decline user. Check console for details.");
      }
    });
  });
});

/* ========================================
   VERIFIED USERS LISTENER
======================================== */

onValue(ref(db, 'verifiedUsers'), (snapshot) => {
  verifiedRequestsTeacher.innerHTML = '';
  verifiedRequestsStudent.innerHTML = '';
  
  if (!snapshot.exists()) {
    verifiedRequestsTeacher.innerHTML = `<tr><td colspan="7">No verified teachers yet.</td></tr>`;
    verifiedRequestsStudent.innerHTML = `<tr><td colspan="7">No verified students yet.</td></tr>`;
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
    
    const hasDescriptor = data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128;
    const descriptorBadge = hasDescriptor 
      ? '<span style="color: green; font-size: 12px;">✓ Face Data</span>' 
      : '<span style="color: orange; font-size: 12px;">⚠ No Face Data</span>';
    
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
    
    row.dataset.userData = JSON.stringify(data);
    
    if (isTeacher) {
      verifiedRequestsTeacher.appendChild(row);
    } else {
      verifiedRequestsStudent.appendChild(row);
    }
  });

  if (!foundTeacher) {
    verifiedRequestsTeacher.innerHTML = `<tr><td colspan="7">No verified teachers yet.</td></tr>`;
  }
  if (!foundStudent) {
    verifiedRequestsStudent.innerHTML = `<tr><td colspan="7">No verified students yet.</td></tr>`;
  }

  document.querySelectorAll('.unverify-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const row = btn.closest('tr');
      const userData = JSON.parse(row.dataset.userData);

      const confirmed = await showUnverifyModal(userData);
      if (!confirmed) return;

      try {
        await remove(ref(db, `verifiedUsers/${uid}`));
        await remove(ref(db, `verificationRequests/${uid}`));

        await update(ref(db, `users/${uid}`), {
          verificationStatus: "unverified",
          verified: false,
          unverifiedAt: new Date().toISOString()
        });

        // Send notification to user
        await sendNotificationToUser(
          uid,
          '⚠️ Account Verification Removed',
          `Your ${userData.category} account verification has been removed by the admin. You will need to go through the verification process again to regain full access. Please resubmit your verification documents.`,
          'verification_removed',
          {
            category: userData.category,
            unverifiedAt: new Date().toISOString()
          }
        );

        showToast(`✅ ${userData.firstname} ${userData.surname} verification removed. They must resubmit verification.`);

      } catch (err) {
        console.error("Error unverifying user:", err);
        showToast("⚠️ Failed to remove verification. Check console for details.");
      }
    });
  });

  document.querySelectorAll('.view-id-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const idUrl = link.dataset.idUrl;
      await showViewIDModal(idUrl);
    });
  });

  document.querySelectorAll('.view-face-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const faceUrl = link.dataset.faceUrl;
      await showViewFaceModal(faceUrl);
    });
  });
});

/* ========================================
   LOGOUT FUNCTIONALITY
======================================== */

document.addEventListener("click", async (e) => {
  const logoutModal = document.getElementById("logoutModal");
  const confirmLogout = document.getElementById("confirmLogout");
  const cancelLogout = document.getElementById("cancelLogout");

  if (!logoutModal || !confirmLogout || !cancelLogout) return;

  if (e.target.closest("#logoutBtn")) {
    logoutModal.style.display = "flex";
  }

  if (e.target.closest("#cancelLogout")) {
    logoutModal.style.display = "none";
  }

  if (e.target.closest("#confirmLogout")) {
    await signOut(auth);
    window.location.href = "index.html";
  }
});

/* ========================================
   FACE DESCRIPTOR STATISTICS
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

/* ========================================
   INITIALIZE
======================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupModalOverlayListeners();
  setTimeout(showFaceDescriptorStats, 2000);
});