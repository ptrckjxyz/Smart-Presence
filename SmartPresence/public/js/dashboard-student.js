import { db } from "./firebase.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ==============================
// 👁️ VIEW ALL LOGS MODAL FUNCTIONALITY
// ==============================
let allLogsData = [];
let currentLogsPage = 1;
const logsPerPage = 4;

function displayAllLogsModal(logs) {
  const allLogsTableBody = document.getElementById("allLogsTableBody");
  
  if (!allLogsTableBody) {
    console.error("❌ allLogsTableBody element not found!");
    return;
  }

  if (logs.length === 0) {
    allLogsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No attendance logs yet</td></tr>`;
    updateLogsPageInfo();
    return;
  }

  // Sort by date (newest first)
  const sortedLogs = [...logs].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });
  
  // Reset to page 1 when displaying modal
  currentLogsPage = 1;
  renderLogsPage(sortedLogs);
  
  // Show modal
  const modal = document.getElementById("allLogsModal");
  if (modal) {
    modal.classList.add("show");
    console.log("✅ Displayed all", sortedLogs.length, "logs in modal");
  }
}

function renderLogsPage(sortedLogs) {
  const allLogsTableBody = document.getElementById("allLogsTableBody");
  const startIdx = (currentLogsPage - 1) * logsPerPage;
  const endIdx = startIdx + logsPerPage;
  const logsToDisplay = sortedLogs.slice(startIdx, endIdx);
  
  // Clear table body
  allLogsTableBody.innerHTML = "";
  
  // Render logs for current page
  logsToDisplay.forEach((record) => {
    const status = record.status || "unknown";
    const statusColor = 
      status === "present" ? "#059669" :
      status === "late" ? "#d97706" :
      status === "absent" ? "#dc2626" :
      status === "excused" ? "#4f46e5" :
      "#6b7280";
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    let method = "Manual";
    if (record.method === "qr_scan") method = "QR Code";
    else if (record.method === "face_recognition") method = "Face Recognition";
    
    if (record.faceVerified) method += " ✓";
    if (record.pending) method += " (Pending)";
    
    let timeStr = "-";
    if (record.timestamp) {
      const time = new Date(record.timestamp);
      timeStr = time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    allLogsTableBody.insertAdjacentHTML(
      "beforeend",
      `
        <tr>
          <td>${record.date}</td>
          <td>${record.className}</td>
          <td><span style="
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            background: ${statusColor}15;
            color: ${statusColor};
          ">${displayStatus}</span></td>
          <td>${method}</td>
          <td>${timeStr}</td>
        </tr>
      `
    );
  });
  
  updateLogsPageInfo(sortedLogs);
  updateLogsButtonStates(sortedLogs);
}

function updateLogsPageInfo(sortedLogs) {
  const pageInfo = document.getElementById("logsPageInfo");
  if (!sortedLogs || sortedLogs.length === 0) {
    if (pageInfo) pageInfo.textContent = "No logs";
    return;
  }
  
  const totalPages = Math.ceil(sortedLogs.length / logsPerPage);
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentLogsPage} of ${totalPages}`;
  }
}

function updateLogsButtonStates(sortedLogs) {
  const prevBtn = document.getElementById("prevLogsBtn");
  const nextBtn = document.getElementById("nextLogsBtn");
  
  if (!sortedLogs || sortedLogs.length === 0) {
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }
  
  const totalPages = Math.ceil(sortedLogs.length / logsPerPage);
  
  if (prevBtn) prevBtn.disabled = currentLogsPage === 1;
  if (nextBtn) nextBtn.disabled = currentLogsPage === totalPages;
}

// Initialize modal functionality
document.addEventListener("DOMContentLoaded", () => {
  const viewAllLogsBtn = document.getElementById("viewAllLogsBtn");
  const closeLogsModal = document.getElementById("closeLogsModal");
  const allLogsModal = document.getElementById("allLogsModal");
  const prevLogsBtn = document.getElementById("prevLogsBtn");
  const nextLogsBtn = document.getElementById("nextLogsBtn");

  if (viewAllLogsBtn) {
    viewAllLogsBtn.addEventListener("click", () => {
      displayAllLogsModal(allLogsData);
    });
  }

  if (closeLogsModal) {
    closeLogsModal.addEventListener("click", () => {
      if (allLogsModal) {
        allLogsModal.classList.remove("show");
      }
    });
  }

  // Close modal when clicking outside
  if (allLogsModal) {
    allLogsModal.addEventListener("click", (e) => {
      if (e.target === allLogsModal) {
        allLogsModal.classList.remove("show");
      }
    });
  }

  // Pagination buttons
  if (prevLogsBtn) {
    prevLogsBtn.addEventListener("click", () => {
      if (currentLogsPage > 1) {
        currentLogsPage--;
        const sortedLogs = [...allLogsData].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        renderLogsPage(sortedLogs);
      }
    });
  }

  if (nextLogsBtn) {
    nextLogsBtn.addEventListener("click", () => {
      const sortedLogs = [...allLogsData].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
      const totalPages = Math.ceil(sortedLogs.length / logsPerPage);
      if (currentLogsPage < totalPages) {
        currentLogsPage++;
        renderLogsPage(sortedLogs);
      }
    });
  }
});

async function loadStudentStats() {
  const studentId = sessionStorage.getItem("userId");
  if (!studentId) {
    console.error("No student ID found in sessionStorage");
    return;
  }

  try {
    // Initialize placeholders (attendance features can be added later)
    let totalSubjects = 0;
    let absences = 0;
    let lates = 0;
    let totalPresent = 0;

    const classesRef = ref(db, "classes");
    const snapshot = await get(classesRef);

    if (snapshot.exists()) {

      onValue(ref(db, "classes"), (snapshot) => {
        let totalSubjectsCount = 0;

        snapshot.forEach(teacherSnap => {
          teacherSnap.forEach(deptSnap => {
            deptSnap.forEach(classSnap => {

              const classData = classSnap.val();

              // check if this class has this student
              if (classData.students && classData.students[studentId]) {
                totalSubjectsCount++;
              }

            });
          });
        });

        document.getElementById("totalSubjects").textContent = totalSubjectsCount;
      });

    }

    // Load attendance data - only for classes the student is enrolled in
    const allAttendanceRecords = [];
    
    // First, get all classes the student is enrolled in
    const enrolledClasses = [];
    
    snapshot.forEach(teacherSnap => {
      const teacherId = teacherSnap.key;
      teacherSnap.forEach(deptSnap => {
        const deptKey = deptSnap.key;
        deptSnap.forEach(classSnap => {
          const classId = classSnap.key;
          const classData = classSnap.val();
          
          if (classData.students && classData.students[studentId]) {
            enrolledClasses.push({
              teacherId,
              deptKey,
              classId,
              className: `${classData.sectionName || "Unknown"} - ${classData.subjectName || "Unknown"}`
            });
          }
        });
      });
    });

    // Now fetch attendance for each enrolled class
    for (const classInfo of enrolledClasses) {
      const { teacherId, deptKey, classId, className } = classInfo;
      
      try {
        // Check finalized attendance
        const attendanceRef = ref(db, `attendance/${teacherId}/${deptKey}/${classId}`);
        const attendanceSnap = await get(attendanceRef);
        
        if (attendanceSnap.exists()) {
          attendanceSnap.forEach(dateSnap => {
            const date = dateSnap.key;
            const dateData = dateSnap.val();
            
            if (dateData[studentId]) {
              const record = dateData[studentId];
              const status = record.status || "unknown";
              
              // Count statuses
              if (status === "late") lates++;
              else if (status === "absent") absences++;
              else if (status === "present") totalPresent++;
              
              allAttendanceRecords.push({
                date,
                status,
                timestamp: record.timestamp,
                method: record.method || "manual",
                faceVerified: record.faceVerified || false,
                className,
                teacherId,
                deptKey,
                classId
              });
            }
          });
        }
        
        // Check active sessions
        const sessionsRef = ref(db, `attendance_sessions/${teacherId}/${deptKey}/${classId}`);
        const sessionsSnap = await get(sessionsRef);
        
        if (sessionsSnap.exists()) {
          const today = new Date().toISOString().split('T')[0];
          
          sessionsSnap.forEach(sessionSnap => {
            const sessionData = sessionSnap.val();
            
            if (sessionData.attendees && sessionData.attendees[studentId]) {
              const attendeeData = sessionData.attendees[studentId];
              
              // Check if not already in finalized records for today
              const alreadyRecorded = allAttendanceRecords.some(
                r => r.date === today && 
                     r.teacherId === teacherId && 
                     r.classId === classId
              );
              
              if (!alreadyRecorded) {
                const status = attendeeData.status || "present";
                
                if (status === "late") lates++;
                else if (status === "present") totalPresent++;
                
                allAttendanceRecords.push({
                  date: today,
                  status,
                  timestamp: attendeeData.scanTime || attendeeData.timestamp,
                  method: attendeeData.method || "qr_scan",
                  faceVerified: attendeeData.faceVerified || false,
                  className,
                  teacherId,
                  deptKey,
                  classId,
                  pending: true
                });
              }
            }
          });
        }
      } catch (err) {
        console.error(`Error loading attendance for class ${classId}:`, err);
        // Continue with other classes even if one fails
      }
    }

    // Update stats
    document.getElementById("totalAbsences").textContent = absences;
    document.getElementById("totalLates").textContent = lates;
    
    // Calculate attendance rate
    const totalRecords = totalPresent + absences + lates;
    const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
    document.getElementById("attendanceRate").textContent = attendanceRate + "%";

    // Store all logs for modal
    allLogsData = allAttendanceRecords;

    // Display attendance logs
    displayAttendanceLogs(allAttendanceRecords);

  } catch (error) {
    console.error("Error loading student dashboard:", error);
  }
}

function displayAttendanceLogs(records) {
  const tbody = document.getElementById("logsTableBody");
  
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No attendance records yet</td></tr>`;
    return;
  }

  // Sort by date (newest first)
  records.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  // Show only recent 4 records
  const recentRecords = records.slice(0, 4);

  // Build table rows
  tbody.innerHTML = recentRecords.map(record => {
    const status = record.status || "unknown";
    const statusColor = 
      status === "present" ? "#059669" :
      status === "late" ? "#d97706" :
      status === "absent" ? "#dc2626" :
      status === "excused" ? "#4f46e5" :
      "#6b7280";
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Format method
    let method = "Manual";
    if (record.method === "qr_scan") method = "QR Code";
    else if (record.method === "face_recognition") method = "Face Recognition";
    
    if (record.faceVerified) method += " ✓";
    if (record.pending) method += " (Pending)";
    
    // Format time
    let timeStr = "-";
    if (record.timestamp) {
      const time = new Date(record.timestamp);
      timeStr = time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    return `
      <tr>
        <td>${record.date}</td>
        <td>${record.className}</td>
        <td><span style="
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          background: ${statusColor}15;
          color: ${statusColor};
        ">${displayStatus}</span></td>
        <td>${method}</td>
        <td>${timeStr}</td>
      </tr>
    `;
  }).join('');
}

// Load stats when the page loads

loadStudentStats();