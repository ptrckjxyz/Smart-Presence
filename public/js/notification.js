import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, onValue, set, get, push, update, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

let currentUser = null;
let userRole = null;
let notificationCheckInterval = null;
let allNotifications = [];

// Simple notifier wrapper: use showToast if available, otherwise fallback to alert
// Ensure a global showToast exists (fallback) so other pages can use toast notifications
if (typeof window.showToast !== 'function') {
  window.showToast = function(message, type) {
    let toast = document.querySelector('.global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'global-toast';
      document.body.appendChild(toast);
      const style = document.createElement('style');
      style.textContent = `
        .global-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%) translateY(100px); padding: 0.9rem 1.2rem; border-radius: 10px; color: #fff; font-weight:600; z-index:20000; opacity:0; transition: all .28s ease; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .global-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        .global-toast.success { background: #16a34a; }
        .global-toast.error { background: #dc2626; }
        .global-toast.info { background: #0ea5e9; }
        .global-toast.default { background: #1e293b; }
      `;
      document.head.appendChild(style);
    }
    toast.textContent = message;
    toast.className = 'global-toast show ' + (type || 'default');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  };
}

function notify(message, type) {
  if (typeof showToast === 'function') {
    try {
      showToast(message, type);
      return;
    } catch (e) {
      console.error('notify: showToast error', e);
    }
  }
  alert(message);
}

// Initialize notifications
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log('✅ User authenticated:', currentUser.uid);
    console.log('📧 User email:', currentUser.email);
    detectUserRole();
    
    cleanupOldNotificationRecords();
    setInterval(cleanupOldNotificationRecords, 24 * 60 * 60 * 1000);
  } else {
    console.log('❌ No user authenticated, redirecting to login');
    window.location.href = "login.html";
  }
});

// Detect if user is teacher or student
async function detectUserRole() {
  console.log('🔍 Detecting user role for:', currentUser.uid);
  const teacherRef = ref(db, `classes/${currentUser.uid}`);
  const teacherSnap = await get(teacherRef);
  
  if (teacherSnap.exists()) {
    userRole = 'teacher';
    console.log('👨‍🏫 User role: teacher');
  } else {
    userRole = 'student';
    console.log('👨‍🎓 User role: student');
  }
  
  initializeNotificationSystem();
}

// Initialize the notification system
function initializeNotificationSystem() {
  console.log('🚀 Initializing notification system...');
  console.log('📍 Current user ID:', currentUser.uid);
  console.log('📍 Notifications path:', `notifications/${currentUser.uid}`);
  loadNotifications();
  startNotificationScheduler();
  setupEventListeners();
}

// Load and display notifications
function loadNotifications() {
  console.log('📥 Loading notifications for user:', currentUser.uid);
  const notificationsRef = ref(db, `notifications/${currentUser.uid}`);
  
  get(notificationsRef).then(snapshot => {
    console.log('🔍 Direct read test - exists:', snapshot.exists());
    if (snapshot.exists()) {
      console.log('📦 Direct read data:', snapshot.val());
      console.log('📦 Number of notifications:', Object.keys(snapshot.val()).length);
    } else {
      console.log('⚠️ No data at path:', `notifications/${currentUser.uid}`);
    }
  }).catch(error => {
    console.error('❌ Direct read error:', error);
    console.error('❌ Error details:', error.code, error.message);
  });
  
  onValue(notificationsRef, (snapshot) => {
    console.log('📬 onValue triggered');
    console.log('📊 Snapshot exists:', snapshot.exists());
    
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.querySelector('.notification-count');
    
    if (!notificationList) {
      console.error('❌ notificationList element not found in DOM');
      return;
    }
    
    if (!snapshot.exists()) {
      console.log('📭 No notifications found for path:', `notifications/${currentUser.uid}`);
      notificationList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <h3>No Notifications Yet</h3>
          <p>You'll receive notifications for upcoming classes and important updates</p>
          <small style="color: #999; margin-top: 10px; display: block;">User ID: ${currentUser.uid}</small>
          <small style="color: #999; margin-top: 5px; display: block;">Role: ${userRole}</small>
        </div>
      `;
      if (notificationCount) {
        notificationCount.textContent = '0';
        notificationCount.style.display = 'none';
      }
      return;
    }
    
    const notifications = [];
    snapshot.forEach(childSnap => {
      const notifData = childSnap.val();
      console.log('📬 Notification found:', childSnap.key, notifData);
      notifications.push({
        id: childSnap.key,
        ...notifData
      });
    });
    
    console.log('📊 Total notifications:', notifications.length);
    
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    allNotifications = notifications;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    console.log('🔔 Unread count:', unreadCount);
    
    if (notificationCount) {
      notificationCount.textContent = unreadCount;
      notificationCount.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
    }
    
    renderNotifications(notifications);
  }, (error) => {
    console.error('❌ onValue error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  });
}

// Render notifications to the DOM
function renderNotifications(notifications) {
  const notificationList = document.getElementById('notificationList');
  const activeFilter = document.querySelector('.filter-btn.active');
  const activeFilterText = activeFilter ? activeFilter.textContent : 'All';
  
  console.log('🎨 Rendering notifications with filter:', activeFilterText);
  
  let filteredNotifications = notifications;
  
  if (activeFilterText === 'Unread') {
    filteredNotifications = notifications.filter(n => !n.read);
  } else if (activeFilterText === 'Read') {
    filteredNotifications = notifications.filter(n => n.read);
  }
  
  console.log('📊 Filtered notifications count:', filteredNotifications.length);
  
  if (filteredNotifications.length === 0) {
    notificationList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h3>No ${activeFilterText === 'All' ? '' : activeFilterText} Notifications</h3>
        <p>You're all caught up!</p>
      </div>
    `;
    return;
  }
  
  notificationList.innerHTML = filteredNotifications.map(notif => {
    const timeAgo = getTimeAgo(notif.timestamp);
    const iconType = getNotificationIcon(notif.type);
    const isRecent = (Date.now() - notif.timestamp) < 300000;
    
    // Special rendering for excuse letter notifications
    if (notif.type === 'excuse_letter' && userRole === 'teacher') {
      return renderExcuseLetterNotification(notif, timeAgo, iconType, isRecent);
    }
    
    return `
      <div class="notification-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
        <div class="notification-icon" data-type="${notif.type}">
          <i class="${iconType}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          <div class="notification-message">${notif.message}</div>
          <div class="notification-time" data-recent="${isRecent}">
            <i class="far fa-clock"></i>
            ${timeAgo}
          </div>
          <div class="notification-actions">
            ${!notif.read ? '<button class="primary" onclick="markAsRead(\'' + notif.id + '\')"><i class="fas fa-check"></i> Mark as Read</button>' : ''}
            <button class="secondary" onclick="deleteNotification(\'' + notif.id + '\')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('✅ Notifications rendered successfully');
  // Signal that notifications have been rendered so the page enter animation can finish
  if (window.markContentReady) window.markContentReady();
}

// Render excuse letter notification with special actions
function renderExcuseLetterNotification(notif, timeAgo, iconType, isRecent) {
  return `
    <div class="notification-item excuse-letter-notification ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
      <div class="notification-icon" data-type="${notif.type}">
        <i class="${iconType}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${notif.title}</div>
        <div class="notification-message">${notif.message}</div>
        <div class="notification-time" data-recent="${isRecent}">
          <i class="far fa-clock"></i>
          ${timeAgo}
        </div>
        <div class="notification-actions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          <button class="primary" onclick="viewExcuseLetterFromNotification('${notif.excuseId}')" style="background: #3b82f6;">
            <i class="fas fa-eye"></i> View Letter
          </button>
          <button class="success" onclick="approveExcuseFromNotification('${notif.excuseId}', '${notif.studentId}', '${notif.classId}', '${notif.department}', '${notif.id}')" style="background: #10b981; color: white;">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="danger" onclick="rejectExcuseFromNotification('${notif.excuseId}', '${notif.id}')" style="background: #ef4444; color: white;">
            <i class="fas fa-times"></i> Reject
          </button>
          <button class="secondary" onclick="deleteNotification('${notif.id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

// View excuse letter from notification
window.viewExcuseLetterFromNotification = async function(excuseId) {
  try {
    const excuseRef = ref(db, `excuseLetters/${excuseId}`);
    const excuseSnap = await get(excuseRef);
    
    if (!excuseSnap.exists()) {
      notify('Excuse letter not found.', 'error');
      return;
    }
    
    const excuse = excuseSnap.val();
    
    // Create modal
    let modal = document.getElementById('excuseLetterViewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'excuseLetterViewModal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      document.body.appendChild(modal);
    }
    
    const submittedDate = new Date(excuse.submittedAt).toLocaleString();
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1f2937;">Excuse Letter</h2>
          <button onclick="document.getElementById('excuseLetterViewModal').style.display='none'" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #374151;">Student:</p>
          <p style="margin: 0; color: #6b7280;">${excuse.studentName} (${excuse.studentNumber})</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #374151;">Class:</p>
          <p style="margin: 0; color: #6b7280;">${excuse.className}</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #374151;">Date of Absence:</p>
          <p style="margin: 0; color: #6b7280;">${excuse.date}</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #374151;">Reason:</p>
          <p style="margin: 0; color: #6b7280; white-space: pre-wrap;">${excuse.reason}</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Attached Document:</p>
          ${excuse.fileType.startsWith('image/') ? 
            `<img src="${excuse.fileData}" style="max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer;" onclick="window.open('${excuse.fileData}', '_blank')">` :
            `<a href="${excuse.fileData}" download="${excuse.fileName}" style="color: #3b82f6; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; padding: 10px 15px; background: #eff6ff; border-radius: 8px;">
              <i class="fas fa-file-pdf"></i> ${excuse.fileName}
            </a>`
          }
        </div>
        
        <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 13px;">Submitted: ${submittedDate}</p>
      </div>
    `;
    
    modal.style.display = 'flex';
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
  } catch (error) {
    console.error('Error viewing excuse letter:', error);
    notify('Failed to load excuse letter.', 'error');
  }
};

// Approve excuse from notification
// Pending context for modal-driven approve/reject
let pendingApprove = null;
let pendingReject = null;
let pendingDelete = null;

// Core approve action (moved from original function body)
async function approveExcuseAction(excuseId, studentId, classId, dept, notificationId) {
  try {
    // Get excuse letter data first to get all the correct information
    const excuseRef = ref(db, `excuseLetters/${excuseId}`);
    const excuseSnap = await get(excuseRef);
    
    if (!excuseSnap.exists()) {
      notify('Excuse letter not found.', 'error');
      return;
    }
    
    const excuseData = excuseSnap.val();
    
    console.log('📋 Excuse data:', excuseData);
    console.log('📍 Will mark attendance at:', `attendance/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/${excuseData.date}/${excuseData.studentId}`);
    
    // Check if the date exists in customDates, if not add it
    const customDatesRef = ref(db, `classes/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/customDates`);
    const datesSnap = await get(customDatesRef);
    
    let dateExists = false;
    if (datesSnap.exists()) {
      const dates = Object.values(datesSnap.val());
      dateExists = dates.includes(excuseData.date);
    }
    
    if (!dateExists) {
      console.log('📅 Date not found in customDates, adding:', excuseData.date);
      const newDateRef = push(customDatesRef);
      await set(newDateRef, excuseData.date);
      console.log('✅ Date added to customDates');
    } else {
      console.log('✅ Date already exists in customDates');
    }
    
    // Update excuse letter status
    await update(excuseRef, {
      status: 'approved',
      teacherApprovedAt: Date.now(),
      teacherApprovedBy: currentUser.uid
    });
    
    // Mark student as excused in attendance - USE TEACHER ID FROM EXCUSE DATA
    const attendanceRef = ref(db, 
      `attendance/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/${excuseData.date}/${excuseData.studentId}`
    );
    await set(attendanceRef, {
      status: 'excused',
      timestamp: Date.now(),
      date: excuseData.date,
      excuseLetterId: excuseId,
      approvedBy: currentUser.uid
    });
    
    console.log('✅ Attendance marked as excused');
    
    // Send notification to student
    const studentNotifRef = push(ref(db, `notifications/${excuseData.studentId}`));
    await set(studentNotifRef, {
      title: 'Excuse Letter Approved',
      message: `Your excuse letter for ${excuseData.date} has been approved. You have been marked as Excused.`,
      type: 'excuse_approved',
      timestamp: Date.now(),
      read: false,
      excuseId: excuseId
    });
    
    // Delete the teacher's notification
    await remove(ref(db, `notifications/${currentUser.uid}/${notificationId}`));
    
    notify('Excuse letter approved! Student marked as Excused. ' + (!dateExists ? 'Date has been added to the attendance calendar.' : ''), 'success');
    
  } catch (error) {
    console.error('Error approving excuse letter:', error);
    notify('Failed to approve excuse letter. Please try again.', 'error');
  }
}

// Show confirmation modal instead of native confirm
window.approveExcuseFromNotification = function(excuseId, studentId, classId, dept, notificationId) {
  pendingApprove = {excuseId, studentId, classId, dept, notificationId};
  const modal = document.getElementById('approveExcuseModal');
  if (modal) modal.style.display = 'flex';
};

// Reject excuse from notification
// Core reject action (moved from original function body)
async function rejectExcuseAction(excuseId, notificationId, reason) {
  try {
    // Get excuse letter data
    const excuseRef = ref(db, `excuseLetters/${excuseId}`);
    const excuseSnap = await get(excuseRef);
    
    if (!excuseSnap.exists()) {
      notify('Excuse letter not found.', 'error');
      return;
    }
    
    const excuseData = excuseSnap.val();
    
    console.log('📋 Excuse data:', excuseData);
    console.log('📍 Will mark attendance at:', `attendance/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/${excuseData.date}/${excuseData.studentId}`);
    
    // Check if the date exists in customDates, if not add it
    const customDatesRef = ref(db, `classes/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/customDates`);
    const datesSnap = await get(customDatesRef);
    
    let dateExists = false;
    if (datesSnap.exists()) {
      const dates = Object.values(datesSnap.val());
      dateExists = dates.includes(excuseData.date);
    }
    
    if (!dateExists) {
      console.log('📅 Date not found in customDates, adding:', excuseData.date);
      const newDateRef = push(customDatesRef);
      await set(newDateRef, excuseData.date);
      console.log('✅ Date added to customDates');
    } else {
      console.log('✅ Date already exists in customDates');
    }
    
    // Update excuse letter status
    await update(excuseRef, {
      status: 'rejected',
      teacherRejectedAt: Date.now(),
      rejectionReason: reason || 'No reason provided',
      rejectedBy: currentUser.uid
    });
    
    // Mark student as ABSENT when excuse letter is rejected - USE TEACHER ID FROM EXCUSE DATA
    const attendanceRef = ref(db, 
      `attendance/${excuseData.teacherId}/${excuseData.department}/${excuseData.classId}/${excuseData.date}/${excuseData.studentId}`
    );
    await set(attendanceRef, {
      status: 'absent',
      timestamp: Date.now(),
      date: excuseData.date,
      excuseLetterId: excuseId,
      rejectedBy: currentUser.uid,
      rejectionReason: reason || 'No reason provided'
    });
    
    console.log('✅ Attendance marked as absent');
    
    // Send notification to student
    const studentNotifRef = push(ref(db, `notifications/${excuseData.studentId}`));
    await set(studentNotifRef, {
      title: 'Excuse Letter Rejected',
      message: `Your excuse letter for ${excuseData.date} has been rejected and you have been marked as Absent. Reason: ${reason || 'No reason provided'}`,
      type: 'excuse_rejected',
      timestamp: Date.now(),
      read: false,
      excuseId: excuseId
    });
    
    // Delete the teacher's notification
    await remove(ref(db, `notifications/${currentUser.uid}/${notificationId}`));
    
    notify('Excuse letter rejected. Student marked as Absent. ' + (!dateExists ? 'Date has been added to the attendance calendar.' : ''), 'success');
    
  } catch (error) {
    console.error('Error rejecting excuse letter:', error);
    notify('Failed to reject excuse letter. Please try again.', 'error');
  }
}

// Show reject modal with reason input instead of prompt
window.rejectExcuseFromNotification = function(excuseId, notificationId) {
  pendingReject = {excuseId, notificationId};
  const modal = document.getElementById('rejectExcuseModal');
  const input = document.getElementById('rejectReasonInput');
  if (input) input.value = '';
  if (modal) modal.style.display = 'flex';
};

// Get notification icon based on type
function getNotificationIcon(type) {
  const icons = {
    'class_reminder': 'fas fa-clock',
    'class_starting': 'fas fa-play-circle',
    'class_soon': 'fas fa-exclamation-circle',
    'assignment': 'fas fa-clipboard-list',
    'grade': 'fas fa-graduation-cap',
    'attendance': 'fas fa-user-check',
    'system': 'fas fa-info-circle',
    'excuse_letter': 'fas fa-envelope',
    'excuse_approved': 'fas fa-check-circle',
    'excuse_rejected': 'fas fa-times-circle',
    'class_async': 'fas fa-laptop-house'
  };
  return icons[type] || 'fas fa-bell';
}

// Wire up modal confirm/cancel buttons for approve/reject
document.addEventListener('DOMContentLoaded', () => {
  const approveModal = document.getElementById('approveExcuseModal');
  const approveConfirm = document.getElementById('approveExcuseConfirm');
  const approveCancel = document.getElementById('approveExcuseCancel');

  const rejectModal = document.getElementById('rejectExcuseModal');
  const rejectConfirm = document.getElementById('rejectExcuseConfirm');
  const rejectCancel = document.getElementById('rejectExcuseCancel');
  const rejectInput = document.getElementById('rejectReasonInput');

  const deleteModal = document.getElementById('deleteNotificationModal');
  const deleteConfirm = document.getElementById('deleteNotificationConfirm');
  const deleteCancel = document.getElementById('deleteNotificationCancel');

  if (approveCancel && approveModal) approveCancel.addEventListener('click', () => approveModal.style.display = 'none');
  if (approveModal) approveModal.addEventListener('click', (e) => { if (e.target === approveModal) approveModal.style.display = 'none'; });

  if (rejectCancel && rejectModal) rejectCancel.addEventListener('click', () => rejectModal.style.display = 'none');
  if (rejectModal) rejectModal.addEventListener('click', (e) => { if (e.target === rejectModal) rejectModal.style.display = 'none'; });

  if (deleteCancel && deleteModal) deleteCancel.addEventListener('click', () => deleteModal.style.display = 'none');
  if (deleteModal) deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });

  if (approveConfirm) approveConfirm.addEventListener('click', async () => {
    if (!pendingApprove) return;
    const ctx = pendingApprove;
    pendingApprove = null;
    const modal = document.getElementById('approveExcuseModal');
    if (modal) modal.style.display = 'none';
    await approveExcuseAction(ctx.excuseId, ctx.studentId, ctx.classId, ctx.dept, ctx.notificationId);
  });

  if (rejectConfirm) rejectConfirm.addEventListener('click', async () => {
    if (!pendingReject) return;
    const ctx = pendingReject;
    pendingReject = null;
    const reason = rejectInput ? rejectInput.value.trim() : '';
    const modal = document.getElementById('rejectExcuseModal');
    if (modal) modal.style.display = 'none';
    await rejectExcuseAction(ctx.excuseId, ctx.notificationId, reason);
  });

  if (deleteConfirm) deleteConfirm.addEventListener('click', async () => {
    if (!pendingDelete) return;
    const ctx = pendingDelete;
    pendingDelete = null;
    const modal = document.getElementById('deleteNotificationModal');
    if (modal) modal.style.display = 'none';
    console.log('🗑️ Deleting notification:', ctx.notificationId);
    try {
      await remove(ref(db, `notifications/${currentUser.uid}/${ctx.notificationId}`));
      console.log('✅ Deleted successfully');
      // Optionally re-render notifications or rely on realtime listener
      loadNotifications();
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (approveModal && approveModal.style.display === 'flex') approveModal.style.display = 'none';
      if (rejectModal && rejectModal.style.display === 'flex') rejectModal.style.display = 'none';
      if (deleteModal && deleteModal.style.display === 'flex') deleteModal.style.display = 'none';
    }
  });
});

// Get time ago string
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

// Mark notification as read
window.markAsRead = async function(notificationId) {
  console.log('✅ Marking as read:', notificationId);
  try {
    await update(ref(db, `notifications/${currentUser.uid}/${notificationId}`), {
      read: true
    });
    console.log('✅ Marked as read successfully');
  } catch (error) {
    console.error('❌ Error marking as read:', error);
  }
};

// Delete notification
window.deleteNotification = function(notificationId) {
  // show modal and store context
  pendingDelete = { notificationId };
  const modal = document.getElementById('deleteNotificationModal');
  if (modal) modal.style.display = 'flex';
};

// Setup event listeners
function setupEventListeners() {
  const markAllBtn = document.querySelector('.mark-all-read');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      console.log('✅ Marking all as read');
      const notificationsRef = ref(db, `notifications/${currentUser.uid}`);
      const snapshot = await get(notificationsRef);
      
      if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach(childSnap => {
          updates[`${childSnap.key}/read`] = true;
        });
        await update(notificationsRef, updates);
        console.log('✅ All marked as read');
      }
    });
  }
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('🔍 Filter clicked:', btn.textContent);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNotifications(allNotifications);
    });
  });
}

// Start notification scheduler
function startNotificationScheduler() {
  console.log('⏰ Starting notification scheduler');
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
  
  checkAndScheduleNotifications();
  notificationCheckInterval = setInterval(() => {
    checkAndScheduleNotifications();
  }, 60000);
}

// Check and schedule notifications for upcoming classes
async function checkAndScheduleNotifications() {
  const now = new Date();
  const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  console.log(`📅 Checking schedules - Day: ${currentDay}, Time: ${currentTime}`);
  
  if (userRole === 'teacher') {
    await checkTeacherClasses(currentDay, currentTime, now);
  } else if (userRole === 'student') {
    await checkStudentClasses(currentDay, currentTime, now);
  }
}

// Check teacher's classes
async function checkTeacherClasses(currentDay, currentTime, now) {
  console.log('👨‍🏫 Checking teacher classes...');
  const classesRef = ref(db, `classes/${currentUser.uid}`);
  const snapshot = await get(classesRef);
  
  if (!snapshot.exists()) {
    console.log('📚 No classes found for teacher');
    return;
  }
  
  snapshot.forEach(deptSnap => {
    deptSnap.forEach(classSnap => {
      const classData = classSnap.val();
      const classId = classSnap.key;
      const department = deptSnap.key;
      
      if (classData.schedule) {
        Object.values(classData.schedule).forEach(schedule => {
          if (schedule.day === currentDay) {
            checkScheduleAndNotify(
              schedule,
              classData,
              classId,
              department,
              currentTime,
              now,
              'teacher'
            );
          }
        });
      }
    });
  });
}

// Check student's classes
async function checkStudentClasses(currentDay, currentTime, now) {
  console.log('👨‍🎓 Checking student classes...');
  const classesRef = ref(db, `classes`);
  const snapshot = await get(classesRef);
  
  if (!snapshot.exists()) return;
  
  snapshot.forEach(teacherSnap => {
    const teacherId = teacherSnap.key;
    
    teacherSnap.forEach(deptSnap => {
      const department = deptSnap.key;
      
      deptSnap.forEach(classSnap => {
        const classData = classSnap.val();
        const classId = classSnap.key;
        
        if (classData.students && classData.students[currentUser.uid]) {
          if (classData.schedule) {
            Object.values(classData.schedule).forEach(schedule => {
              if (schedule.day === currentDay) {
                checkScheduleAndNotify(
                  schedule,
                  classData,
                  classId,
                  department,
                  currentTime,
                  now,
                  'student',
                  teacherId
                );
              }
            });
          }
        }
      });
    });
  });
}

// Check schedule and send notifications
async function checkScheduleAndNotify(schedule, classData, classId, department, currentTime, now, role, teacherId = null) {
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const classStartTime = new Date(now);
  classStartTime.setHours(startHour, startMinute, 0, 0);
  
  const timeDiff = (classStartTime - now) / 1000 / 60;
  
  const notifications = [
    { minutes: 60, type: '1 hour', tolerance: 2 },
    { minutes: 30, type: '30 minutes', tolerance: 2 },
    { minutes: 10, type: '10 minutes', tolerance: 1 }
  ];
  
  for (const notif of notifications) {
    if (Math.abs(timeDiff - notif.minutes) <= notif.tolerance) {
      const notifKey = `${classId}_${schedule.day}_${notif.minutes}_${now.toDateString()}`;
      const sentRef = ref(db, `notification_sent/${currentUser.uid}/${notifKey}`);
      const sentSnap = await get(sentRef);
      
      if (!sentSnap.exists()) {
        await sendClassNotification(
          classData,
          schedule,
          notif.type,
          role,
          classId,
          department,
          teacherId
        );
        
        await set(sentRef, {
          sent: true,
          timestamp: Date.now()
        });
      }
    }
  }
}

// Send class notification
async function sendClassNotification(classData, schedule, timeBeforeClass, role, classId, department, teacherId = null) {
  const className = `${classData.sectionName} - ${classData.subjectName}`;
  const scheduleTime = `${schedule.startTime} - ${schedule.endTime}`;
  
  let title, message, type;
  
  if (timeBeforeClass === '1 hour') {
    title = `Class in 1 Hour`;
    message = `${className} starts at ${schedule.startTime}. Get ready!`;
    type = 'class_reminder';
  } else if (timeBeforeClass === '30 minutes') {
    title = `Class in 30 Minutes`;
    message = `${className} (${scheduleTime}). Prepare your materials.`;
    type = 'class_soon';
  } else if (timeBeforeClass === '10 minutes') {
    title = `Class Starting Soon!`;
    message = `${className} starts in 10 minutes (${schedule.startTime}). Head to class now!`;
    type = 'class_starting';
  }
  
  if (role === 'teacher') {
    message += ` | Department: ${department}`;
  }
  
  const notificationRef = push(ref(db, `notifications/${currentUser.uid}`));
  
  try {
    await set(notificationRef, {
      title: title,
      message: message,
      type: type,
      classId: classId,
      department: department,
      teacherId: teacherId,
      schedule: scheduleTime,
      timestamp: Date.now(),
      read: false
    });
    
    console.log(`✅ Notification sent: ${title} for ${className}`);
  } catch (error) {
    console.error(`❌ Error sending notification:`, error);
  }
}

// Clean up old notification_sent records
async function cleanupOldNotificationRecords() {
  console.log('🧹 Running cleanup of old notification records');
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const sentRef = ref(db, `notification_sent/${currentUser.uid}`);
  const snapshot = await get(sentRef);
  
  if (snapshot.exists()) {
    const updates = {};
    snapshot.forEach(childSnap => {
      const data = childSnap.val();
      if (data.timestamp < sevenDaysAgo) {
        updates[childSnap.key] = null;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await update(sentRef, updates);
      console.log(`🧹 Cleaned up ${Object.keys(updates).length} old notification records`);
    }
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
});