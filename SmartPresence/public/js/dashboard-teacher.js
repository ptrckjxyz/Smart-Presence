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

console.log("🔍 Teacher ID:", teacherId);

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
// 📊 Dashboard Summary & Attendance
// ==============================
function loadAllDashboardData() {
  if (!teacherId) {
    console.error("❌ No teacherId available");
    return;
  }

  console.log("📊 Loading all dashboard data...");
  
  let totalStudents = 0;
  let totalSubjects = 0;
  let totalSchedules = 0;
  
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;
  
  const logsByDateClass = [];
  const classNamesMap = {};

  // Read from classes path (which teacher already has access to)
  const classesRef = ref(db, `classes/${teacherId}`);

  onValue(classesRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.log("⚠️ No classes found");
      updateDashboardUI(0, 0, 0, 0, 0, 0, []);
      return;
    }

    console.log("✅ Classes data loaded");
    
    // Reset counters
    totalStudents = 0;
    totalSubjects = 0;
    totalSchedules = 0;
    totalPresent = 0;
    totalAbsent = 0;
    totalLate = 0;
    totalExcused = 0;
    logsByDateClass.length = 0;

    snapshot.forEach((deptSnap) => {
      const department = deptSnap.key;
      console.log(`  📁 Department: ${department}`);

      deptSnap.forEach((classSnap) => {
        const classId = classSnap.key;
        const classData = classSnap.val();
        
        // Store class names for logs
        classNamesMap[classId] = `${classData.sectionName || "Section"} - ${classData.subjectName || "Subject"}`;

        // Count subjects
        if (classData.subjectName) totalSubjects++;

        // Count students
        if (classData.students) {
          totalStudents += Object.keys(classData.students).length;
        }

        // Count schedules
        if (classData.schedule) {
          totalSchedules += Object.keys(classData.schedule).length;
        }

        // NOW READ ATTENDANCE FROM attendance/${teacherId}/${department}/${classId}
        const attendanceRef = ref(db, `attendance/${teacherId}/${department}/${classId}`);
        
        onValue(attendanceRef, (attendanceSnap) => {
          if (attendanceSnap.exists()) {
            console.log(`    ✅ Attendance found for class: ${classId}`);
            
            attendanceSnap.forEach((dateSnap) => {
              const date = dateSnap.key;
              
              let datePresent = 0;
              let dateAbsent = 0;
              let dateLate = 0;
              let dateExcused = 0;

              dateSnap.forEach((studentSnap) => {
                const record = studentSnap.val();
                const status = record.status;

                if (status === "present") {
                  totalPresent++;
                  datePresent++;
                } else if (status === "absent") {
                  totalAbsent++;
                  dateAbsent++;
                } else if (status === "late") {
                  totalLate++;
                  dateLate++;
                } else if (status === "excused") {
                  totalExcused++;
                  dateExcused++;
                }
              });

              // Add to logs
              logsByDateClass.push({
                date: date,
                classId: classId,
                className: classNamesMap[classId],
                present: datePresent,
                absent: dateAbsent,
                late: dateLate,
                excused: dateExcused
              });

              console.log(`      📅 ${date}: P:${datePresent} A:${dateAbsent} L:${dateLate}`);
            });
            
            // Update UI after processing each class
            updateDashboardUI(
              totalStudents,
              totalSubjects,
              totalSchedules,
              totalPresent,
              totalAbsent,
              totalLate,
              logsByDateClass
            );
          } else {
            console.log(`    ⚠️ No attendance for class: ${classId}`);
          }
        }, {
          onlyOnce: true
        });
      });
    });

    // Initial UI update with class counts
    updateDashboardUI(
      totalStudents,
      totalSubjects,
      totalSchedules,
      totalPresent,
      totalAbsent,
      totalLate,
      logsByDateClass
    );
    
    console.log("✅ Dashboard data loaded");
  });
}

// ==============================
// 🎨 Update Dashboard UI
// ==============================
function updateDashboardUI(students, subjects, schedules, present, absent, late, logs) {
  // Update summary cards
  const yellowEl = document.querySelector(".accent-yellow .placeholder");
  const orangeEl = document.querySelector(".accent-orange .placeholder");
  const greenEl = document.querySelector(".accent-green .placeholder");

  if (yellowEl) yellowEl.textContent = students;
  if (orangeEl) orangeEl.textContent = subjects;
  if (greenEl) greenEl.textContent = schedules;

  // Update attendance overview
  const presentEl = document.getElementById("totalPresent");
  const absentEl = document.getElementById("totalAbsent");
  const lateEl = document.getElementById("totalLate");

  if (presentEl) presentEl.textContent = present;
  if (absentEl) absentEl.textContent = absent;
  if (lateEl) lateEl.textContent = late;

  // Update recent logs
  updateLogsTable(logs);
  
  console.log("📊 Dashboard Updated - Students:", students, "Subjects:", subjects, "Schedules:", schedules);
  console.log("📊 Attendance - Present:", present, "Absent:", absent, "Late:", late);
}

// ==============================
// 🕒 Update Logs Table
// ==============================
function updateLogsTable(logsArray) {
  const logsTableBody = document.getElementById("logsTableBody");
  
  if (!logsTableBody) {
    console.error("❌ logsTableBody element not found!");
    return;
  }

  if (logsArray.length === 0) {
    logsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No attendance logs yet. Start marking attendance!</td></tr>`;
    return;
  }

  // Sort by date (newest first)
  logsArray.sort((a, b) => b.date.localeCompare(a.date));

  // Render top 10 logs
  logsTableBody.innerHTML = "";
  const recentLogs = logsArray.slice(0, 10);
  
  recentLogs.forEach((log) => {
    logsTableBody.insertAdjacentHTML(
      "beforeend",
      `
        <tr>
          <td>${log.date}</td>
          <td>${log.className}</td>
          <td>${log.present}</td>
          <td>${log.absent}</td>
          <td>${log.late}</td>
        </tr>
      `
    );
  });
  
  console.log("✅ Rendered", recentLogs.length, "logs");
}

// ==============================
// 🚀 Initialize Dashboard
// ==============================
if (teacherId) {
  console.log("🚀 Initializing dashboard...");
  loadAllDashboardData();
} else {
  console.error("❌ No teacherId found in sessionStorage!");
  alert("Session expired. Please login again.");
}