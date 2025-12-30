import { auth, db } from './firebase.js';
import { setCurrentClassId } from './attendance-methods.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, push, set, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const classList = document.getElementById("classList");
const studentPanel = document.getElementById("studentPanel");
const studentList = document.getElementById("studentList");
const panelTitle = document.getElementById("panelTitle");
const addClassBtn = document.getElementById("addClassBtn");
const asyncToggle = document.getElementById("asyncToggle");
const asyncSwitch = document.getElementById("asyncSwitch");

let currentUser = null;
let department = "";
let currentClassId = null;
let displayDates = [];
let isAsyncMode = false;
let currentExcusePage = 0;
const excusesPerPage = 5;

// 🧩 Detect department automatically
function detectDepartment() {
  const fileName = window.location.pathname.split("/").pop().split(".")[0];
  department = fileName.toUpperCase();
}
detectDepartment();

// Get default dates (last 7 days)
function getDefaultDates() {
  const dates = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

// ➕ Add class
addClassBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  
  const classPath = `classes/${currentUser.uid}/${department}`;
  const newClassRef = push(ref(db, classPath));
  const newClassData = {
    sectionName: "New Section",
    subjectName: "New Subject",
    createdBy: currentUser.uid,
    shareCode: newClassRef.key,
    department: department,
    students: {},
    schedule: {},
    customDates: {}
  };
  
  // Add default dates
  const defaultDates = getDefaultDates();
  defaultDates.forEach((date, index) => {
    newClassData.customDates[`date_${index}`] = date;
  });
  
  try {
    await set(newClassRef, newClassData);
  } catch (error) {
    console.error("Error creating class:", error);
  }
});

// 🔐 Wait for user authentication
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadTeacherClasses();
  } else {
    window.location.href = "index.html";
  }
});

// ===== EXCUSE LETTERS MODAL =====

async function showExcuseLettersModal() {
  currentExcusePage = 0; // Reset to first page
  let modal = document.getElementById("excuseLettersModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "excuseLettersModal";
    modal.classList.add("modal-overlay");
    modal.innerHTML = `
      <div class="excuse-letters-modal">
        <div class="excuse-modal-header">
          <div>
            <h4>Excuse Letters</h4>
            <p class="excuse-subtitle">Review and manage student excuse submissions</p>
          </div>
          <button id="closeExcuseLetters" class="close-modal-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="excuse-filters">
          <button class="filter-excuse-btn active" data-status="pending_teacher">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Pending</span>
          </button>
          <button class="filter-excuse-btn" data-status="approved">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span>Approved</span>
          </button>
          <button class="filter-excuse-btn" data-status="rejected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>Rejected</span>
          </button>
          <button class="filter-excuse-btn" data-status="all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <span>All</span>
          </button>
        </div>
        <div id="excuseLettersList" class="excuse-letters-container"></div>
        <div class="excuse-pagination">
          <button id="prevExcusePage" class="pagination-btn" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Previous
          </button>
          <span id="excusePageInfo" class="page-info">Page 1 of 1</span>
          <button id="nextExcusePage" class="pagination-btn" disabled>
            Next
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
    
    // Add filter button listeners
    modal.querySelectorAll('.filter-excuse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentExcusePage = 0; // Reset pagination when changing filters
        modal.querySelectorAll('.filter-excuse-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadExcuseLetters(modal, btn.dataset.status);
      });
    });
  }

  modal.classList.add("show");
  modal.style.display = "flex";

  const closeBtn = modal.querySelector("#closeExcuseLetters");
  closeBtn.onclick = () => hideModal(modal);

  // Load excuse letters
  loadExcuseLetters(modal, 'pending_teacher');
}

// Update the loadExcuseLetters function with SVG icons instead of emojis

async function loadExcuseLetters(modal, filterStatus = 'pending_teacher') {
  const excuseRef = ref(db, 'excuseLetters');
  const snapshot = await get(excuseRef);
  const excuseList = modal.querySelector('#excuseLettersList');
  
  if (!snapshot.exists()) {
    excuseList.innerHTML = "<p style='text-align: center; color: #6b7280; padding: 40px;'>No excuse letters submitted yet.</p>";
    updatePagination([], 0);
    return;
  }
  
  const excuseLetters = [];
  snapshot.forEach(childSnap => {
    const excuseData = childSnap.val();
    if (excuseData.teacherId === currentUser.uid) {
      if (filterStatus === 'all' || excuseData.status === filterStatus) {
        excuseLetters.push({
          id: childSnap.key,
          ...excuseData
        });
      }
    }
  });
  
  excuseLetters.sort((a, b) => b.submittedAt - a.submittedAt);
  
  if (excuseLetters.length === 0) {
    excuseList.innerHTML = `<p style='text-align: center; color: #6b7280; padding: 40px;'>No ${filterStatus === 'all' ? '' : filterStatus.replace('_', ' ')} excuse letters.</p>`;
    updatePagination([], 0);
    return;
  }
  
  const startIdx = currentExcusePage * excusesPerPage;
  const endIdx = startIdx + excusesPerPage;
  const paginatedLetters = excuseLetters.slice(startIdx, endIdx);
  
  excuseList.innerHTML = paginatedLetters.map(excuse => {
    const statusColor = {
      'pending_teacher': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444'
    }[excuse.status] || '#6b7280';
    
    const statusText = {
      'pending_teacher': 'Pending',
      'approved': 'Approved',
      'rejected': 'Rejected'
    }[excuse.status] || excuse.status;
    
    const submittedDate = new Date(excuse.submittedAt).toLocaleString();
    const initials = excuse.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    return `
      <div class="excuse-compact-card" data-excuse-id="${excuse.id}">
        <div class="excuse-main-content">
          <div class="excuse-left-section">
            <div class="student-avatar-compact">${initials}</div>
            <div class="excuse-details">
              <h5 class="student-name-compact">${excuse.studentName}</h5>
              <div class="excuse-meta">
                <span class="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                  ${excuse.className}
                </span>
                <span class="meta-divider">•</span>
                <span class="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  ${excuse.studentNumber}
                </span>
              </div>
              <div class="excuse-info-compact">
                <span class="info-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  ${excuse.date}
                </span>
                <span class="meta-divider">•</span>
                <span class="info-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ${submittedDate}
                </span>
              </div>
              <div class="excuse-reason-preview">
                <strong>Reason:</strong> ${excuse.reason.length > 100 ? excuse.reason.substring(0, 100) + '...' : excuse.reason}
              </div>
            </div>
          </div>
          
          <div class="excuse-right-section">
            <span class="status-badge-compact" style="background: ${statusColor}; color: white;">
              ${statusText}
            </span>
            <button class="view-details-btn" onclick="showExcuseDetail('${excuse.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Details
            </button>
            ${excuse.status === 'pending_teacher' ? `
              <div class="quick-actions">
                <button class="quick-approve-btn" onclick="event.stopPropagation(); approveExcuseLetter('${excuse.id}', '${excuse.studentId}', '${excuse.classId}', '${excuse.department}', '${excuse.date}')" title="Approve">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </button>
                <button class="quick-reject-btn" onclick="event.stopPropagation(); rejectExcuseLetter('${excuse.id}')" title="Reject">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${excuse.status !== 'pending_teacher' ? `
          <div class="excuse-status-footer">
            ${excuse.status === 'approved' ? `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span style="color: #10b981;">
                Approved on ${new Date(excuse.teacherApprovedAt).toLocaleString()}
              </span>
            ` : `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              <span style="color: #ef4444;">
                Rejected on ${new Date(excuse.teacherRejectedAt || excuse.teacherApprovedAt).toLocaleString()}
                ${excuse.rejectionReason ? `<span class="rejection-note">- ${excuse.rejectionReason}</span>` : ''}
              </span>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  updatePagination(excuseLetters, excuseLetters.length);
  
  excuseList.querySelectorAll('.excuse-compact-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const excuseId = card.dataset.excuseId;
      showExcuseDetail(excuseId);
    });
  });
}

// Make sure hideModal is accessible globally
window.hideModal = function(modal) {
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
};

function updatePagination(allLetters, totalCount) {
  const modal = document.getElementById("excuseLettersModal");
  if (!modal) return;
  
  const prevBtn = modal.querySelector('#prevExcusePage');
  const nextBtn = modal.querySelector('#nextExcusePage');
  const pageInfo = modal.querySelector('#excusePageInfo');
  
  const totalPages = Math.ceil(totalCount / excusesPerPage);
  const currentPage = currentExcusePage + 1;
  
  pageInfo.textContent = `Page ${totalCount > 0 ? currentPage : 0} of ${totalPages || 1}`;
  
  prevBtn.disabled = currentExcusePage === 0;
  nextBtn.disabled = currentExcusePage >= totalPages - 1 || totalCount === 0;
  
  prevBtn.onclick = () => {
    if (currentExcusePage > 0) {
      currentExcusePage--;
      const activeFilter = modal.querySelector('.filter-excuse-btn.active');
      loadExcuseLetters(modal, activeFilter.dataset.status);
    }
  };
  
  nextBtn.onclick = () => {
    if (currentExcusePage < totalPages - 1) {
      currentExcusePage++;
      const activeFilter = modal.querySelector('.filter-excuse-btn.active');
      loadExcuseLetters(modal, activeFilter.dataset.status);
    }
  };
}

window.showExcuseDetail = async function(excuseId) {
  const excuseRef = ref(db, `excuseLetters/${excuseId}`);
  const snapshot = await get(excuseRef);
  
  if (!snapshot.exists()) {
    alert('Excuse letter not found');
    return;
  }
  
  const excuse = snapshot.val();
  
  let detailModal = document.getElementById('excuseDetailModal');
  
  if (!detailModal) {
    detailModal = document.createElement('div');
    detailModal.id = 'excuseDetailModal';
    detailModal.classList.add('modal-overlay');
    document.body.appendChild(detailModal);
    
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        hideModal(detailModal);
      }
    });
  }
  
  const statusColor = {
    'pending_teacher': '#f59e0b',
    'approved': '#10b981',
    'rejected': '#ef4444'
  }[excuse.status] || '#6b7280';
  
  const statusText = {
    'pending_teacher': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected'
  }[excuse.status] || excuse.status;
  
  detailModal.innerHTML = `
    <div class="modal-box excuse-detail-modal">
      <div class="detail-header">
        <h4>Excuse Letter Details</h4>
        <button class="close-detail-btn" onclick="hideModal(document.getElementById('excuseDetailModal'))">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="detail-body">
        <div class="detail-section">
          <h5>Student Information</h5>
          <p><strong>Name:</strong> ${excuse.studentName}</p>
          <p><strong>Student Number:</strong> ${excuse.studentNumber}</p>
          <p><strong>Class:</strong> ${excuse.className}</p>
        </div>
        
        <div class="detail-section">
          <h5>Absence Details</h5>
          <p><strong>Date of Absence:</strong> ${excuse.date}</p>
          <p><strong>Submitted:</strong> ${new Date(excuse.submittedAt).toLocaleString()}</p>
        </div>
        
        <div class="detail-section">
          <h5>Reason for Absence</h5>
          <div class="reason-full">${excuse.reason}</div>
        </div>
        
        <div class="detail-section">
          <h5>Attached Document</h5>
          ${excuse.fileType.startsWith('image/') ? 
            `<img src="${excuse.fileData}" class="detail-image" onclick="window.open('${excuse.fileData}', '_blank')">` :
            `<a href="${excuse.fileData}" download="${excuse.fileName}" class="detail-download">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download ${excuse.fileName}
            </a>`
          }
        </div>
        
        <div class="detail-section">
          <h5>Status</h5>
          <span class="status-badge-compact" style="background: ${statusColor}; color: white;">
            ${statusText}
          </span>
          ${excuse.status === 'approved' ? `
            <p style="margin-top: 10px; color: #10b981;">
              Approved on ${new Date(excuse.teacherApprovedAt).toLocaleString()}
            </p>
          ` : ''}
          ${excuse.status === 'rejected' ? `
            <p style="margin-top: 10px; color: #ef4444;">
              Rejected on ${new Date(excuse.teacherRejectedAt || excuse.teacherApprovedAt).toLocaleString()}
              ${excuse.rejectionReason ? `<br><strong>Reason:</strong> ${excuse.rejectionReason}` : ''}
            </p>
          ` : ''}
        </div>
      </div>
      
      ${excuse.status === 'pending_teacher' ? `
        <div class="detail-actions">
          <button class="approve-btn-detail" onclick="approveExcuseLetter('${excuseId}', '${excuse.studentId}', '${excuse.classId}', '${excuse.department}', '${excuse.date}'); hideModal(document.getElementById('excuseDetailModal'));">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Approve
          </button>
          <button class="reject-btn-detail" onclick="rejectExcuseLetter('${excuseId}'); hideModal(document.getElementById('excuseDetailModal'));">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            Reject
          </button>
        </div>
      ` : ''}
    </div>
  `;
  
  detailModal.classList.add('show');
  detailModal.style.display = 'flex';
};

window.approveExcuseLetter = async function(excuseId, studentId, classId, dept, date) {
  if (!confirm('Approve this excuse letter? The student will be marked as Excused for this date.')) {
    return;
  }
  
  try {
    await update(ref(db, `excuseLetters/${excuseId}`), {
      status: 'approved',
      teacherApprovedAt: Date.now(),
      teacherApprovedBy: currentUser.uid
    });
    
    const attendanceRef = ref(db, 
      `attendance/${currentUser.uid}/${dept}/${classId}/${date}/${studentId}`
    );
    await set(attendanceRef, {
      status: 'excused',
      timestamp: Date.now(),
      date: date,
      excuseLetterId: excuseId,
      approvedBy: currentUser.uid
    });
    
    const notificationRef = push(ref(db, `notifications/${studentId}`));
    await set(notificationRef, {
      title: 'Excuse Letter Approved',
      message: `Your excuse letter for ${date} has been approved. You have been marked as Excused.`,
      type: 'excuse_approved',
      timestamp: Date.now(),
      read: false,
      excuseId: excuseId
    });
    
    showToast('Excuse letter approved! Student marked as Excused.');
    
    const modal = document.getElementById("excuseLettersModal");
    const activeFilter = modal.querySelector('.filter-excuse-btn.active');
    loadExcuseLetters(modal, activeFilter.dataset.status);
    
  } catch (error) {
    console.error('Error approving excuse letter:', error);
    alert('Failed to approve excuse letter. Please try again.');
  }
};

window.rejectExcuseLetter = async function(excuseId) {
  const reason = prompt('Enter reason for rejection (optional):');
  
  if (reason === null) return;
  
  try {
    const excuseRef = ref(db, `excuseLetters/${excuseId}`);
    const excuseSnap = await get(excuseRef);
    const excuseData = excuseSnap.val();
    
    await update(excuseRef, {
      status: 'rejected',
      teacherRejectedAt: Date.now(),
      rejectionReason: reason || 'No reason provided',
      rejectedBy: currentUser.uid
    });
    
    const attendanceRef = ref(db, 
      `attendance/${currentUser.uid}/${excuseData.department}/${excuseData.classId}/${excuseData.date}/${excuseData.studentId}`
    );
    await set(attendanceRef, {
      status: 'absent',
      timestamp: Date.now(),
      date: excuseData.date,
      excuseLetterId: excuseId,
      rejectedBy: currentUser.uid,
      rejectionReason: reason || 'No reason provided'
    });
    
    const notificationRef = push(ref(db, `notifications/${excuseData.studentId}`));
    await set(notificationRef, {
      title: 'Excuse Letter Rejected',
      message: `Your excuse letter for ${excuseData.date} has been rejected and you have been marked as Absent. Reason: ${reason || 'No reason provided'}`,
      type: 'excuse_rejected',
      timestamp: Date.now(),
      read: false,
      excuseId: excuseId
    });
    
    showToast('Excuse letter rejected. Student marked as Absent.');
    
    const modal = document.getElementById("excuseLettersModal");
    const activeFilter = modal.querySelector('.filter-excuse-btn.active');
    loadExcuseLetters(modal, activeFilter.dataset.status);
    
  } catch (error) {
    console.error('Error rejecting excuse letter:', error);
    alert('Failed to reject excuse letter. Please try again.');
  }
};

// ===== REST OF THE CODE CONTINUES BELOW =====
// (I'll continue in the next part due to length limits)

// 📦 Load all classes
function loadTeacherClasses() {
  const classesRef = ref(db, `classes/${currentUser.uid}/${department}`);
  onValue(classesRef, (snapshot) => {
    classList.innerHTML = "";
    
    if (!snapshot.exists()) {
      console.log("No classes found");
      return;
    }
    
    snapshot.forEach(childSnap => {
      const classData = childSnap.val();
      renderClassItem(childSnap.key, classData.sectionName, classData.subjectName);
    });
    // Signal that class list content has been rendered so the entering animation can finish
    if (window.markContentReady) window.markContentReady();
  });
}

// 🎨 Render class in sidebar
function renderClassItem(classId, sectionName, subjectName, shareCode) {
  const item = document.createElement("div");
  item.classList.add("class-item");
  item.innerHTML = `
    <div class="class-info">
      <strong class="section-name">${sectionName || "Unnamed Section"}</strong><br>
      <small class="subject-name">${subjectName || "No Subject"}</small><br>
    </div>
    <div class="class-menu">
      <button class="menu-btn">⋮</button>
      <div class="menu-dropdown hidden">
        <button class="edit-btn">Edit</button>
        <button class="schedule-btn">Set Schedule</button>
        <button class="excuse-letters-btn">Excuse Letters</button>
        <button class="delete-btn">Delete</button>
        <button class="share-btn">Share</button>
      </div>
    </div>
  `;

  const menuBtn = item.querySelector(".menu-btn");
  const dropdown = item.querySelector(".menu-dropdown");
  const editBtn = item.querySelector(".edit-btn");
  const scheduleBtn = item.querySelector(".schedule-btn");
  const excuseLettersBtn = item.querySelector(".excuse-letters-btn");
  const deleteBtn = item.querySelector(".delete-btn");
  const shareBtn = item.querySelector(".share-btn");

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".menu-dropdown").forEach(menu => {
      if (menu !== dropdown) menu.classList.add("hidden");
    });
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => dropdown.classList.add("hidden"));

  editBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    const sectionEl = item.querySelector(".section-name");
    const subjectEl = item.querySelector(".subject-name");

    if (item.querySelector(".inline-input")) return;

    const originalSection = sectionEl.textContent.trim();
    const originalSubject = subjectEl.textContent.trim();

    const sectionInput = document.createElement("input");
    sectionInput.value = originalSection;
    sectionInput.classList.add("inline-input");

    const subjectInput = document.createElement("input");
    subjectInput.value = originalSubject;
    subjectInput.classList.add("inline-input");

    sectionEl.replaceWith(sectionInput);
    subjectEl.replaceWith(subjectInput);

    const actions = document.createElement("div");
    actions.classList.add("inline-actions");
    actions.innerHTML = `
      <button class="save-btn">Save</button>
      <button class="cancel-edit-btn">Cancel</button>
    `;
    const oldActions = item.querySelector(".inline-actions");
    if (oldActions) oldActions.remove();
    item.appendChild(actions);

    actions.querySelector(".save-btn").addEventListener("click", async () => {
      const updatedSection = sectionInput.value.trim() || originalSection;
      const updatedSubject = subjectInput.value.trim() || originalSubject;

      await update(ref(db, `classes/${currentUser.uid}/${department}/${classId}`), {
        sectionName: updatedSection,
        subjectName: updatedSubject
      });

      const newSection = document.createElement("strong");
      newSection.classList.add("section-name");
      newSection.textContent = updatedSection;

      const newSubject = document.createElement("small");
      newSubject.classList.add("subject-name");
      newSubject.textContent = updatedSubject;

      sectionInput.replaceWith(newSection);
      subjectInput.replaceWith(newSubject);
      actions.remove();
    });

    actions.querySelector(".cancel-edit-btn").addEventListener("click", () => {
      const revertSection = document.createElement("strong");
      revertSection.classList.add("section-name");
      revertSection.textContent = originalSection;

      const revertSubject = document.createElement("small");
      revertSubject.classList.add("subject-name");
      revertSubject.textContent = originalSubject;

      sectionInput.replaceWith(revertSection);
      subjectInput.replaceWith(revertSubject);
      actions.remove();
    });
  });

  scheduleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    showScheduleModal(classId, sectionName, subjectName);
  });

  excuseLettersBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    showExcuseLettersModal();
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    showDeleteModal(classId, item);
  });

  shareBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    
    // Generate a short code (8 characters from the classId)
    const shortCode = classId.substring(1, 9).toLowerCase();
    const shareUrl = `${window.location.origin}/?join=${shortCode}`;
    
    // Get class name for the share text
    const classRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}`);
    const classSnap = await get(classRef);
    const classData = classSnap.val();
    const className = `${classData.sectionName} - ${classData.subjectName}`;
    
    // Create the share text
    const shareText = `Join my class: ${className}\nClass Code: ${classId}\n${shareUrl}`;
    
    navigator.clipboard.writeText(shareText);
    showToast("Link & Code copied!");
    dropdown.classList.add("hidden");
  });

  item.addEventListener("click", () => {
    document.querySelectorAll(".class-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    openStudentList(classId, sectionName, subjectName);
  });

  classList.appendChild(item);
}

// 📅 Schedule Modal
function showScheduleModal(classId, sectionName, subjectName) {
  let modal = document.getElementById("scheduleModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "scheduleModal";
    modal.classList.add("modal-overlay");
    modal.innerHTML = `
      <div class="modal-box schedule-modal">
        <h4>Set Schedule - ${sectionName}</h4>
        <p>${subjectName}</p>
        <div id="scheduleList"></div>
        <button id="addScheduleBtn" class="add-schedule-btn">+ Add Schedule</button>
        <div class="modal-actions">
          <button id="closeSchedule" class="cancel-btn">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
  } else {
    modal.querySelector("h4").textContent = `Set Schedule - ${sectionName}`;
    modal.querySelector("p").textContent = subjectName;
  }

  modal.classList.add("show");
  modal.style.display = "flex";

  const scheduleList = modal.querySelector("#scheduleList");
  const addScheduleBtn = modal.querySelector("#addScheduleBtn");
  const closeBtn = modal.querySelector("#closeSchedule");

  loadSchedules(classId, scheduleList);

  addScheduleBtn.onclick = () => addScheduleRow(classId, scheduleList);
  closeBtn.onclick = () => hideModal(modal);
}

function loadSchedules(classId, container) {
  const scheduleRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule`);
  onValue(scheduleRef, (snapshot) => {
    container.innerHTML = "";
    if (snapshot.exists()) {
      snapshot.forEach(childSnap => {
        const schedData = childSnap.val();
        renderScheduleRow(classId, container, childSnap.key, schedData.day, schedData.startTime, schedData.endTime);
      });
    } else {
      container.innerHTML = "<p class='no-schedule'>No schedule set yet.</p>";
    }
  });
}

function addScheduleRow(classId, container) {
  const scheduleRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule`);
  const newScheduleRef = push(scheduleRef);
  
  set(newScheduleRef, {
    day: "Monday",
    startTime: "08:00",
    endTime: "09:00"
  });
}

function renderScheduleRow(classId, container, scheduleId, day, startTime, endTime) {
  const row = document.createElement("div");
  row.classList.add("schedule-row");
  row.innerHTML = `
    <select class="day-select">
      <option value="Monday" ${day === "Monday" ? "selected" : ""}>Monday</option>
      <option value="Tuesday" ${day === "Tuesday" ? "selected" : ""}>Tuesday</option>
      <option value="Wednesday" ${day === "Wednesday" ? "selected" : ""}>Wednesday</option>
      <option value="Thursday" ${day === "Thursday" ? "selected" : ""}>Thursday</option>
      <option value="Friday" ${day === "Friday" ? "selected" : ""}>Friday</option>
      <option value="Saturday" ${day === "Saturday" ? "selected" : ""}>Saturday</option>
      <option value="Sunday" ${day === "Sunday" ? "selected" : ""}>Sunday</option>
    </select>
    <input type="time" class="time-input" value="${startTime}">
    <span>to</span>
    <input type="time" class="time-input" value="${endTime}">
    <button class="delete-schedule-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  const daySelect = row.querySelector(".day-select");
  const startInput = row.querySelectorAll(".time-input")[0];
  const endInput = row.querySelectorAll(".time-input")[1];
  const deleteBtn = row.querySelector(".delete-schedule-btn");

  daySelect.addEventListener("change", () => {
    update(ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule/${scheduleId}`), {
      day: daySelect.value
    });
  });

  startInput.addEventListener("change", () => {
    update(ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule/${scheduleId}`), {
      startTime: startInput.value
    });
  });

  endInput.addEventListener("change", () => {
    update(ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule/${scheduleId}`), {
      endTime: endInput.value
    });
  });

  deleteBtn.addEventListener("click", async () => {
    await remove(ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule/${scheduleId}`));
  });

  container.appendChild(row);
}

// 📅 Date Management Modal
function showDateManagementModal(classId) {
  let modal = document.getElementById("dateMgmtModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "dateMgmtModal";
    modal.classList.add("modal-overlay");
    modal.innerHTML = `
      <div class="modal-box date-mgmt-modal">
        <h4>Manage Attendance Dates</h4>
        <p>Add, edit, or remove dates for attendance tracking</p>
        <div id="dateManagementList"></div>
        <button id="addDateBtn" class="add-date-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Add Date
        </button>
        <div class="modal-actions">
          <button id="closeDateMgmt" class="cancel-btn">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
  }

  modal.classList.add("show");
  modal.style.display = "flex";

  const dateList = modal.querySelector("#dateManagementList");
  const addDateBtn = modal.querySelector("#addDateBtn");
  const closeBtn = modal.querySelector("#closeDateMgmt");

  loadCustomDates(classId, dateList);

  addDateBtn.onclick = () => addCustomDate(classId);
  closeBtn.onclick = () => {
    hideModal(modal);
    const activeClass = document.querySelector('.class-item.active');
    if (activeClass) {
      const sectionName = activeClass.querySelector('.section-name').textContent;
      const subjectName = activeClass.querySelector('.subject-name').textContent;
      openStudentList(classId, sectionName, subjectName);
    }
  };
}

function loadCustomDates(classId, container) {
  const datesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`);
  onValue(datesRef, (snapshot) => {
    container.innerHTML = "";
    if (snapshot.exists()) {
      const dates = [];
      snapshot.forEach(childSnap => {
        dates.push({
          key: childSnap.key,
          value: childSnap.val()
        });
      });
      
      dates.sort((a, b) => new Date(a.value) - new Date(b.value));
      
      dates.forEach(dateItem => {
        renderDateRow(classId, container, dateItem.key, dateItem.value);
      });
    } else {
      container.innerHTML = "<p class='no-dates'>No dates configured. Add dates to track attendance.</p>";
    }
  }, { onlyOnce: true });
}

function addCustomDate(classId) {
  const datesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`);
  const newDateRef = push(datesRef);
  const today = new Date().toISOString().split('T')[0];
  
  set(newDateRef, today).then(() => {
    loadCustomDates(classId, document.querySelector("#dateManagementList"));
  });
}

function renderDateRow(classId, container, dateKey, dateValue) {
  const row = document.createElement("div");
  row.classList.add("date-mgmt-row");
  row.innerHTML = `
    <input type="date" class="date-mgmt-input" value="${dateValue}">
    <button class="delete-date-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  const dateInput = row.querySelector(".date-mgmt-input");
  const deleteBtn = row.querySelector(".delete-date-btn");

  dateInput.addEventListener("change", async () => {
    await update(ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`), {
      [dateKey]: dateInput.value
    });
    showToast("Date updated");
  });

  deleteBtn.addEventListener("click", async () => {
    await remove(ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates/${dateKey}`));
    row.remove();
    showToast("Date removed");
    
    const remainingRows = container.querySelectorAll('.date-mgmt-row');
    if (remainingRows.length === 0) {
      container.innerHTML = "<p class='no-dates'>No dates configured. Add dates to track attendance.</p>";
    }
  });

  container.appendChild(row);
}

function showDeleteModal(classId, item) {
  let modal = document.getElementById("deleteModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "deleteModal";
    modal.classList.add("modal-overlay");
    modal.innerHTML = `
      <div class="modal-box">
        <h4>Delete Class</h4>
        <p>Are you sure you want to delete this class?</p>
        <div class="modal-actions">
          <button id="cancelDelete" class="cancel-btn">Cancel</button>
          <button id="confirmDelete" class="confirm-btn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
  }

  modal.classList.add("show");
  modal.style.display = "flex";

  const cancelBtn = modal.querySelector("#cancelDelete");
  const confirmBtn = modal.querySelector("#confirmDelete");

  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    hideModal(modal);
  };

  confirmBtn.onclick = async (e) => {
    e.stopPropagation();
    await remove(ref(db, `classes/${currentUser.uid}/${department}/${classId}`));
    item.remove();
    hideModal(modal);
  };
}

function hideModal(modal) {
  modal.classList.remove("show");
  modal.style.display = "none";
}

function showToast(message = "Link copied!") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

async function markAllStudentsAsAsync(classId, date) {
  const studentsRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/students`);
  const snapshot = await get(studentsRef);
  
  if (snapshot.exists()) {
    const promises = [];
    snapshot.forEach(childSnap => {
      const studentId = childSnap.key;
      const attendanceRef = ref(db, 
        `attendance/${currentUser.uid}/${department}/${classId}/${date}/${studentId}`
      );
      promises.push(set(attendanceRef, {
        status: 'async',
        timestamp: Date.now(),
        date: date
      }));
    });
    await Promise.all(promises);
  }
}

async function removeAllAsyncAttendance(classId, date) {
  const attendanceRef = ref(db, 
    `attendance/${currentUser.uid}/${department}/${classId}/${date}`
  );
  const snapshot = await get(attendanceRef);
  
  if (snapshot.exists()) {
    const promises = [];
    snapshot.forEach(childSnap => {
      const attendanceData = childSnap.val();
      // Only remove if status is 'async'
      if (attendanceData.status === 'async') {
        promises.push(remove(ref(db, 
          `attendance/${currentUser.uid}/${department}/${classId}/${date}/${childSnap.key}`
        )));
      }
    });
    await Promise.all(promises);
    console.log(`✅ Removed all AC marks for ${date}`);
  }
}

function openStudentList(classId, sectionName, subjectName) {
  currentClassId = classId;
  setCurrentClassId(classId);
  studentPanel.classList.remove("hidden");
  studentPanel.classList.add("visible");
  
  const datesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`);
  onValue(datesRef, (dateSnapshot) => {
    if (dateSnapshot.exists()) {
      const dates = [];
      dateSnapshot.forEach(childSnap => {
        dates.push(childSnap.val());
      });
      displayDates = dates.sort((a, b) => new Date(a) - new Date(b));
    } else {
      displayDates = getDefaultDates();
      const datesObj = {};
      displayDates.forEach((date, index) => {
        datesObj[`date_${index}`] = date;
      });
      update(ref(db, `classes/${currentUser.uid}/${department}/${classId}`), {
        customDates: datesObj
      });
    }
    
    const scheduleRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/schedule`);
    onValue(scheduleRef, (schedSnapshot) => {
      let scheduleText = "";
      if (schedSnapshot.exists()) {
        const schedules = [];
        schedSnapshot.forEach(childSnap => {
          const sched = childSnap.val();
          schedules.push(`${sched.day} ${sched.startTime}-${sched.endTime}`);
        });
        scheduleText = schedules.join(", ");
      }
      
      panelTitle.innerHTML = `
        <div class="panel-main-title">${sectionName || "Section"} - ${subjectName || "Subject"}</div>
        ${scheduleText ? `<div class="panel-schedule">${scheduleText}</div>` : ''}
        <div class="panel-class-code">Class Code: ${classId}</div>
      `;
    });

    asyncToggle.classList.remove("hidden");
    
    const today = new Date().toISOString().split('T')[0];
    const asyncDatesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates`);
    onValue(asyncDatesRef, (asyncSnapshot) => {
      if (asyncSnapshot.exists() && asyncSnapshot.hasChild(today)) {
        asyncSwitch.checked = true;
        isAsyncMode = true;
      } else {
        asyncSwitch.checked = false;
        isAsyncMode = false;
      }
    }, { onlyOnce: true });
    
    asyncSwitch.onchange = (e) => {
      isAsyncMode = e.target.checked;
      if (isAsyncMode) {
        showAsyncDatePicker(classId);
      }
    };

    studentList.innerHTML = `<p>Loading students...</p>`;

    const studentsRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/students`);
    onValue(studentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const studentsArray = [];
        snapshot.forEach(childSnap => {
          const studentData = childSnap.val();
          
          const userRef = ref(db, `users/${childSnap.key}`);
          onValue(userRef, (userSnap) => {
            if (userSnap.exists()) {
              const userData = userSnap.val();
              const surname = userData.surname || "";
              const firstname = userData.firstname || "";
              const idNumber = userData.idNumber || "N/A";
              
              studentsArray.push({
                id: childSnap.key,
                displayName: `${surname}, ${firstname}`,
                sortKey: surname.toLowerCase(),
                idNumber: idNumber
              });

              studentsArray.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
              renderStudentList(studentsArray, classId);
            }
          }, { onlyOnce: true });
        });
      } else {
        studentList.innerHTML = "<p class='no-students'>No students have joined this class yet.</p>";
      }
    });
  });
}

async function saveAttendance(studentId, date, status) {
  const attendanceRef = ref(db, 
    `attendance/${currentUser.uid}/${department}/${currentClassId}/${date}/${studentId}`
  );
  
  await set(attendanceRef, {
    status: status,
    timestamp: Date.now(),
    date: date
  });
  
  console.log(`✅ Saved ${status} for student ${studentId} on ${date}`);
}

function renderStudentList(studentsArray, classId) {
  studentList.innerHTML = `
    <div class="attendance-grid">
      <div class="grid-header">
        <div class="header-student-info">
          <span class="header-number">#</span>
          <span class="header-name">Name</span>
          <span class="header-id">Student Number</span>
        </div>
        <div class="header-dates">
          ${displayDates.map(date => {
            const dateObj = new Date(date);
            const monthDay = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
            return `<div class="date-header" data-date="${date}">${monthDay}</div>`;
          }).join('')}
          <button class="edit-dates-btn" id="editDatesBtn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.333 2a1.886 1.886 0 1 1 2.667 2.667L4.667 14 1.333 14.667l.667-3.334L11.333 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Edit
          </button>
        </div>
      </div>
    </div>
  `;
  
  const editDatesBtn = studentList.querySelector('#editDatesBtn');
  editDatesBtn.addEventListener('click', () => {
    showDateManagementModal(classId);
  });
  
  const grid = studentList.querySelector('.attendance-grid');
  
  const asyncDatesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates`);
  onValue(asyncDatesRef, (asyncSnapshot) => {
    const asyncDates = {};
    if (asyncSnapshot.exists()) {
      asyncSnapshot.forEach(child => {
        asyncDates[child.key] = true;
      });
    }
    
    displayDates.forEach(date => {
      const header = grid.querySelector(`.date-header[data-date="${date}"]`);
      if (header && asyncDates[date]) {
        header.classList.add('async-date');
        header.title = 'Asynchronous Class';
      }
    });
  });
  
  studentsArray.forEach((student, index) => {
    const row = document.createElement("div");
    row.classList.add("student-grid-row");
    
    const studentInfo = `
      <div class="grid-student-info">
        <span class="student-number">${index + 1}.</span>
        <span class="student-name">${student.displayName}</span>
        <span class="student-id">${student.idNumber}</span>
      </div>
    `;
    
    const dateCells = displayDates.map(date => {
      return `<div class="date-cell" data-student="${student.id}" data-date="${date}">-</div>`;
    }).join('');
    
    row.innerHTML = studentInfo + `<div class="grid-dates">${dateCells}</div>`;
    
    displayDates.forEach(date => {
      const attendanceRef = ref(db, 
        `attendance/${currentUser.uid}/${department}/${classId}/${date}/${student.id}`
      );
      
      onValue(attendanceRef, (snapshot) => {
        const cell = row.querySelector(`.date-cell[data-student="${student.id}"][data-date="${date}"]`);
        if (cell) {
          if (snapshot.exists()) {
            const attendanceData = snapshot.val();
            const status = attendanceData.status;
            
            const statusMap = {
              'present': 'P',
              'absent': 'A',
              'late': 'L',
              'excused': 'E',
              'async': 'AC'
            };
            
            cell.textContent = statusMap[status] || '-';
            cell.classList.remove('status-present', 'status-absent', 'status-late', 'status-excused', 'status-async', 'qr-scanned');
            cell.classList.add(`status-${status}`);
            
            if (attendanceData.scannedViaQR) {
              cell.classList.add('qr-scanned');
              cell.title = `${status} (Scanned via QR)`;
            }
          } else {
            cell.textContent = '-';
            cell.className = 'date-cell';
          }
          
          cell.addEventListener('click', () => {
            showStatusMenu(cell, student.id, date);
          });
        }
      });
    });
    
    grid.appendChild(row);
  });
}

function showStatusMenu(cell, studentId, date) {
  const existingMenu = document.querySelector('.status-menu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.classList.add('status-menu');
  menu.innerHTML = `
    <button data-status="present">P - Present</button>
    <button data-status="absent">A - Absent</button>
    <button data-status="late">L - Late</button>
    <button data-status="excused">E - Excused</button>
    <button data-status="async">AC - Async</button>
  `;
  
  const rect = cell.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;
  
  document.body.appendChild(menu);
  
  menu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const status = e.target.dataset.status;
      await saveAttendance(studentId, date, status);
      menu.remove();
      showToast(`Marked as ${status}`);
    });
  });
  
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== cell) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 10);
}

// Add this function to send notifications to all students when async mode is enabled
async function notifyStudentsAboutAsync(classId, date, isAsync) {
  try {
    // Get class data
    const classRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}`);
    const classSnap = await get(classRef);
    
    if (!classSnap.exists()) return;
    
    const classData = classSnap.val();
    const className = `${classData.sectionName} - ${classData.subjectName}`;
    
    // Get all students in the class
    const studentsRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/students`);
    const studentsSnap = await get(studentsRef);
    
    if (!studentsSnap.exists()) return;
    
    // Send notification to each student
    const notificationPromises = [];
    
    studentsSnap.forEach(studentSnap => {
      const studentId = studentSnap.key;
      const notificationRef = push(ref(db, `notifications/${studentId}`));
      
      let title, message;
      
      if (isAsync) {
        title = 'Class Changed to Asynchronous';
        message = `${className} on ${date} has been changed to asynchronous class. You have been marked as AC (Async).`;
      } else {
        title = 'Asynchronous Class Cancelled';
        message = `${className} on ${date} is no longer asynchronous. Regular attendance will be taken.`;
      }
      
      const notificationPromise = set(notificationRef, {
        title: title,
        message: message,
        type: 'class_async',
        classId: classId,
        className: className,
        date: date,
        department: department,
        teacherId: currentUser.uid,
        timestamp: Date.now(),
        read: false
      });
      
      notificationPromises.push(notificationPromise);
    });
    
    await Promise.all(notificationPromises);
    console.log(`✅ Sent async notifications to ${notificationPromises.length} students`);
    
  } catch (error) {
    console.error('Error sending async notifications:', error);
  }
}

// Update the showAsyncDatePicker function to include notifications
function showAsyncDatePicker(classId) {
  let modal = document.getElementById("asyncModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "asyncModal";
    modal.classList.add("modal-overlay");
    modal.innerHTML = `
      <div class="modal-box async-modal">
        <h4>Select Async Date</h4>
        <p>Choose which date is asynchronous class</p>
        <div id="asyncDateList"></div>
        <div class="modal-actions">
          <button id="closeAsync" class="cancel-btn">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideModal(modal);
        asyncSwitch.checked = false;
        isAsyncMode = false;
      }
    });
  }

  modal.classList.add("show");
  modal.style.display = "flex";

  const dateList = modal.querySelector("#asyncDateList");
  const closeBtn = modal.querySelector("#closeAsync");

  // Load async dates once and attach listeners properly
  loadAsyncDates(classId, dateList);

  closeBtn.onclick = () => {
    hideModal(modal);
    asyncSwitch.checked = false;
    isAsyncMode = false;
  };
}

// Separate function to load and handle async dates
async function loadAsyncDates(classId, container) {
  const asyncDatesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates`);
  const asyncSnapshot = await get(asyncDatesRef);
  
  const asyncDates = {};
  if (asyncSnapshot.exists()) {
    asyncSnapshot.forEach(child => {
      asyncDates[child.key] = true;
    });
  }

  container.innerHTML = displayDates.map(date => {
    const dateObj = new Date(date);
    const formatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const isChecked = asyncDates[date] ? 'checked' : '';
    
    return `
      <label class="async-date-option">
        <input type="checkbox" value="${date}" ${isChecked} data-initial="${isChecked}">
        <span>${formatted}</span>
      </label>
    `;
  }).join('');

  // Attach event listeners only once
  container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const date = e.target.value;
      const isNowChecked = e.target.checked;
      const wasInitiallyChecked = e.target.dataset.initial === 'checked';
      
      // Only proceed if the state actually changed from initial
      if ((isNowChecked && !wasInitiallyChecked) || (!isNowChecked && wasInitiallyChecked)) {
        const asyncDateRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates/${date}`);
        
        if (isNowChecked) {
          await set(asyncDateRef, true);
          await markAllStudentsAsAsync(classId, date);
          
          // Send notifications to students
          await notifyStudentsAboutAsync(classId, date, true);
          
          showToast(`${date} marked as async - all students notified`);
        } else {
          await remove(asyncDateRef);

          await removeAllAsyncAttendance(classId, date);
    
          // Send notifications to students about cancellation
          await notifyStudentsAboutAsync(classId, date, false);
          
          showToast(`${date} unmarked - students notified`);
        }
        
        // Update the initial state
        e.target.dataset.initial = isNowChecked ? 'checked' : '';
      }
    });
  });
}