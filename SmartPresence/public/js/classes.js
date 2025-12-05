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
    window.location.href = "login.html";
  }
});

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
        <button class="delete-btn">Delete</button>
        <button class="share-btn">Share</button>
      </div>
    </div>
  `;

  const menuBtn = item.querySelector(".menu-btn");
  const dropdown = item.querySelector(".menu-dropdown");
  const editBtn = item.querySelector(".edit-btn");
  const scheduleBtn = item.querySelector(".schedule-btn");
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

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    showDeleteModal(classId, item);
  });

  shareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/classes-student.html?dept=${department}&class=${classId}&teacher=${currentUser.uid}`;
    const classCode = classId;
    navigator.clipboard.writeText(`Link: ${shareUrl}\nClass Code: ${classCode}`);
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
    // Reload student list to reflect changes
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
      
      // Sort dates chronologically
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
    
    // Check if no dates left
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

// Mark all students as async for a specific date
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

// 👩‍🏫 Student list
function openStudentList(classId, sectionName, subjectName) {
  currentClassId = classId;
  setCurrentClassId(classId);
  studentPanel.classList.remove("hidden");
  studentPanel.classList.add("visible");
  
  // Load custom dates from database
  const datesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`);
  onValue(datesRef, (dateSnapshot) => {
    if (dateSnapshot.exists()) {
      const dates = [];
      dateSnapshot.forEach(childSnap => {
        dates.push(childSnap.val());
      });
      // Sort dates chronologically
      displayDates = dates.sort((a, b) => new Date(a) - new Date(b));
    } else {
      // If no custom dates, create default ones
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

    // Show async toggle
    asyncToggle.classList.remove("hidden");
    
    // Check if async mode should be ON for today's date
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
    
    // Handle async switch toggle
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
  
  // Add event listener to edit dates button
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
      
      // Real-time listener (removed onlyOnce for automatic updates)
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
      }); // No { onlyOnce: true } for real-time updates
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

// Show date picker when async mode is ON
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

  const asyncDatesRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates`);
  onValue(asyncDatesRef, (asyncSnapshot) => {
    const asyncDates = {};
    if (asyncSnapshot.exists()) {
      asyncSnapshot.forEach(child => {
        asyncDates[child.key] = true;
      });
    }

    dateList.innerHTML = displayDates.map(date => {
      const dateObj = new Date(date);
      const formatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const isChecked = asyncDates[date] ? 'checked' : '';
      
      return `
        <label class="async-date-option">
          <input type="checkbox" value="${date}" ${isChecked}>
          <span>${formatted}</span>
        </label>
      `;
    }).join('');

    dateList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const date = e.target.value;
        const asyncDateRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/asyncDates/${date}`);
        
        if (e.target.checked) {
          await set(asyncDateRef, true);
          // Mark all students as AC for this date
          await markAllStudentsAsAsync(classId, date);
          showToast(`${date} marked as async - all students marked AC`);
        } else {
          await remove(asyncDateRef);
          showToast(`${date} unmarked`);
        }
      });
    });
  }, { onlyOnce: true });

  closeBtn.onclick = () => {
    hideModal(modal);
    asyncSwitch.checked = false;
    isAsyncMode = false;
  };
}