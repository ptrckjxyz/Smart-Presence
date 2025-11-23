import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, push, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const classList = document.getElementById("classList");
const studentPanel = document.getElementById("studentPanel");
const studentList = document.getElementById("studentList");
const panelTitle = document.getElementById("panelTitle");
const addClassBtn = document.getElementById("addClassBtn");

let currentUser = null;
let department = "";

// 🧩 Detect department automatically (filename = ICT.html, BSED.html, etc.)
function detectDepartment() {
  const fileName = window.location.pathname.split("/").pop().split(".")[0];
  department = fileName.toUpperCase();
}
detectDepartment();

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
    students: {}
  };
  
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
// ... rest of your code stays exactly the same
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
        <button class="delete-btn">Delete</button>
        <button class="share-btn">Share</button>
      </div>
    </div>
  `;

  const menuBtn = item.querySelector(".menu-btn");
  const dropdown = item.querySelector(".menu-dropdown");
  const editBtn = item.querySelector(".edit-btn");
  const deleteBtn = item.querySelector(".delete-btn");
  const shareBtn = item.querySelector(".share-btn");

  // 🔽 Toggle dropdown
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".menu-dropdown").forEach(menu => {
      if (menu !== dropdown) menu.classList.add("hidden");
    });
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => dropdown.classList.add("hidden"));

  // ✏️ Inline Edit
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

    // ✅ SAVE
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

    // ❌ CANCEL
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

  // 🗑️ Delete
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    showDeleteModal(classId, item);
  });

  // 📤 Share
  shareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/classes-student.html?dept=${department}&class=${classId}&teacher=${currentUser.uid}`;
    const classCode = classId;
    navigator.clipboard.writeText(`Link: ${shareUrl}\nClass Code: ${classCode}`);
    showToast("Link & Code copied!");
    dropdown.classList.add("hidden");
  });

  // 📋 Open student list
  item.addEventListener("click", () => {
    document.querySelectorAll(".class-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    openStudentList(classId, sectionName, subjectName);
  });

  classList.appendChild(item);
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

// Toast
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

// 👩‍🏫 Student list
function openStudentList(classId, sectionName, subjectName) {
  studentPanel.classList.remove("hidden");
  studentPanel.classList.add("visible");
  panelTitle.innerHTML = `
  <div class="panel-main-title">${sectionName || "Section"} - ${subjectName || "Subject"}</div>
  <div class="panel-class-code">Class Code: ${classId}</div>
`;
  studentList.innerHTML = "<p>Loading students...</p>";

  const studentsRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}/students`);
  onValue(studentsRef, (snapshot) => {
    if (snapshot.exists()) {
      studentList.innerHTML = "";
      snapshot.forEach(childSnap => {
        const student = childSnap.val();
        const row = document.createElement("div");
        row.classList.add("student-row");
        row.innerHTML = `
          <span>${student.name || "Unnamed Student"}</span>
          <div class="attendance-status">
            <label><input type="radio" name="status-${childSnap.key}" value="present"> Present</label>
            <label><input type="radio" name="status-${childSnap.key}" value="absent"> Absent</label>
            <label><input type="radio" name="status-${childSnap.key}" value="late"> Late</label>
            <label><input type="radio" name="status-${childSnap.key}" value="excused"> Excused</label>
          </div>
        `;
        studentList.appendChild(row);
      });
    } else {
      studentList.innerHTML = "<p>No students have joined this class yet.</p>";
    }
  });
}
 