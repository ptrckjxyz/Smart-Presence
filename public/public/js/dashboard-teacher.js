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
  // Update summary cards by ID
  const totalSubjectsEl = document.getElementById("totalSubjects");
  
  // Update by class selectors as fallback
  const yellowEl = document.querySelector(".accent-yellow .placeholder");
  const greenEl = document.querySelector(".accent-green .placeholder");
  const orangeEl = document.querySelector(".accent-orange .placeholder");

  if (yellowEl) yellowEl.textContent = students;
  if (totalSubjectsEl) totalSubjectsEl.textContent = subjects;
  if (greenEl) greenEl.textContent = schedules;
  if (orangeEl) orangeEl.textContent = schedules; // fallback for schedules

  // Update attendance overview
  const presentEl = document.getElementById("totalPresent");
  const absentEl = document.getElementById("totalAbsent");
  const lateEl = document.getElementById("totalLate");

  if (presentEl) presentEl.textContent = present;
  if (absentEl) absentEl.textContent = absent;
  if (lateEl) lateEl.textContent = late;

  // Update recent logs
  updateLogsTable(logs);
  
  // Update analytics
  updateAnalyticsChart(logs);
  updateAnalyticsSummary(logs);
  
  console.log("📊 Dashboard Updated - Students:", students, "Subjects:", subjects, "Schedules:", schedules);
  console.log("📊 Attendance - Present:", present, "Absent:", absent, "Late:", late);
}

// ==============================
// 📊 Update Analytics Chart
// ==============================
function updateAnalyticsChart(logsArray) {
  const chartCanvas = document.getElementById("attendanceChart");
  if (!chartCanvas) return;

  // Group logs by date and count attendance status
  const dateData = {};
  logsArray.forEach(log => {
    if (!dateData[log.date]) {
      dateData[log.date] = { present: 0, absent: 0, late: 0 };
    }
    dateData[log.date].present += log.present || 0;
    dateData[log.date].absent += log.absent || 0;
    dateData[log.date].late += log.late || 0;
  });

  // Sort dates and take last 7 days
  const sortedDates = Object.keys(dateData).sort().slice(-7);
  const presentData = sortedDates.map(date => dateData[date].present);
  const absentData = sortedDates.map(date => dateData[date].absent);
  const lateData = sortedDates.map(date => dateData[date].late);

  // Destroy existing chart if it exists
  if (window.attendanceChartInstance) {
    window.attendanceChartInstance.destroy();
  }

  // Create new chart
  window.attendanceChartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: sortedDates.length > 0 ? sortedDates : ['No Data'],
      datasets: [
        {
          label: 'Present',
          data: presentData,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#059669',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Absent',
          data: absentData,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#dc2626',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Late',
          data: lateData,
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#d97706',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 12, weight: '600' },
            color: '#1f2937',
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#ddd',
          borderWidth: 1,
          titleFont: { weight: 'bold' },
          padding: 10,
          displayColors: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#e5e7eb' },
          ticks: { color: '#6b7280', font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } }
        }
      }
    }
  });
}

// ==============================
// 📈 Update Analytics Summary
// ==============================
function updateAnalyticsSummary(logsArray) {
  if (logsArray.length === 0) {
    document.getElementById("weeklyAverage").textContent = "—";
    document.getElementById("activeClass").textContent = "—";
    document.getElementById("leastClass").textContent = "—";
    document.getElementById("perfectStudents").textContent = "—";
    return;
  }

  // Calculate weekly average
  const totalRecords = logsArray.length;
  const totalPresent = logsArray.reduce((sum, log) => sum + (log.present || 0), 0);
  const weeklyAverage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

  // Group by class name
  const classData = {};
  logsArray.forEach(log => {
    if (!classData[log.className]) {
      classData[log.className] = { present: 0, absent: 0, late: 0, total: 0 };
    }
    classData[log.className].present += log.present || 0;
    classData[log.className].absent += log.absent || 0;
    classData[log.className].late += log.late || 0;
    classData[log.className].total += (log.present || 0) + (log.absent || 0) + (log.late || 0);
  });

  // Find most active and least active classes
  let mostActiveClass = "—";
  let leastActiveClass = "—";
  let maxPresent = -1;
  let minPresent = Infinity;

  Object.entries(classData).forEach(([className, data]) => {
    if (data.present > maxPresent) {
      maxPresent = data.present;
      mostActiveClass = className;
    }
    if (data.present < minPresent && data.total > 0) {
      minPresent = data.present;
      leastActiveClass = className;
    }
  });

  // Count students with perfect attendance (never absent or late)
  let perfectCount = 0;
  const studentAttendance = {};
  logsArray.forEach(log => {
    if (!studentAttendance[log.className]) {
      studentAttendance[log.className] = { absent: 0, late: 0 };
    }
    studentAttendance[log.className].absent += log.absent || 0;
    studentAttendance[log.className].late += log.late || 0;
  });

  Object.values(studentAttendance).forEach(attendance => {
    if (attendance.absent === 0 && attendance.late === 0) {
      perfectCount++;
    }
  });

  // Update DOM
  document.getElementById("weeklyAverage").textContent = weeklyAverage + "%";
  document.getElementById("activeClass").textContent = mostActiveClass !== "—" ? mostActiveClass : "No data";
  document.getElementById("leastClass").textContent = leastActiveClass !== "—" ? leastActiveClass : "No data";
  document.getElementById("perfectStudents").textContent = Object.keys(studentAttendance).length > 0 ? Object.keys(studentAttendance).length : "—";
}


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