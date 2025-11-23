import { auth, db } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ==============================
// 🚨 Access Control
// ==============================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const category = sessionStorage.getItem("category");
  if (category !== "teacher") {
    alert("Unauthorized access!");
    window.location.href = "index.html";
  }
});

// ==============================
// 🪪 Session Data
// ==============================
const teacherId = sessionStorage.getItem("userId");
const teacherName = sessionStorage.getItem("name");

// ==============================
// 👩‍🏫 Elements
// ==============================
const logoutBtn = document.getElementById("logoutBtn");
const teacherNameEl = document.getElementById("teacherName");

if (teacherNameEl) teacherNameEl.textContent = teacherName || "Teacher";

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
      sessionStorage.clear();
      window.location.href = "index.html";
    });
  });
}

// ==============================
// 📊 Dashboard Summary
// ==============================
function loadDashboardSummary() {
  if (!teacherId) return;

  const classesRef = ref(db, `classes/${teacherId}`);

  onValue(classesRef, (snapshot) => {
    let studentCount = 0;
    let subjectCount = 0;

    if (snapshot.exists()) {
      snapshot.forEach((deptSnap) => {
        deptSnap.forEach((classSnap) => {
          const classData = classSnap.val();

          // Count subjects
          if (classData.subjectName) subjectCount++;

          // Count students
          if (classData.students) {
            studentCount += Object.keys(classData.students).length;
          }
        });
      });
    }

    document.querySelector(".accent-yellow .placeholder").textContent = studentCount;
    document.querySelector(".accent-orange .placeholder").textContent = subjectCount;
    document.querySelector(".accent-green .placeholder").textContent = "0"; // You have no schedules yet
  });
}


// ==============================
// 🕒 Logs
// ==============================
function loadLogs() {
  if (!teacherId) return;

  const logsRef = ref(db, `attendanceLogs/${teacherId}`);
  const logsTableBody = document.getElementById("logsTableBody");

  onValue(logsRef, (snapshot) => {
    logsTableBody.innerHTML = "";
    if (!snapshot.exists()) {
      logsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No logs available</td></tr>`;
      return;
    }

    const logs = Object.values(snapshot.val()).reverse();
    logs.forEach((log) => {
      logsTableBody.insertAdjacentHTML(
        "beforeend",
        `
          <tr>
            <td>${log.date || "-"}</td>
            <td>${log.subject || "-"}</td>
            <td>${log.present || 0}</td>
            <td>${log.absent || 0}</td>
            <td>${log.late || 0}</td>
          </tr>
        `
      );
    });
  });
}

if (teacherId) {
  loadDashboardSummary();
  loadLogs();
}
