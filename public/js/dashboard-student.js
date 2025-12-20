import { db } from "./firebase.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

  // Show only recent 10 records
  const recentRecords = records.slice(0, 10);

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