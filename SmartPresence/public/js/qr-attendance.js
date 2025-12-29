import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, set, update, onValue, get, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import QRCode from 'https://cdn.skypack.dev/qrcode';

let currentUser = null;
let department = "";
let classId = "";
let sessionId = "";
let timerInterval = null;
let sessionStartTime = null;
let timeLimit = 10; // minutes
let graceTime = 5; // minutes
let attendanceMode = "automatic"; // "automatic" or "faceRecognition"
let isPaused = false;
let pausedTimeRemaining = 0;

const timeLimitInput = document.getElementById("timeLimit");
const graceTimeInput = document.getElementById("graceTime");
const generateQRBtn = document.getElementById("generateQRBtn");
const qrCodeSection = document.getElementById("qrCodeSection");
const qrCodeCanvas = document.getElementById("qrCodeCanvas");
const timerDisplay = document.getElementById("timer");
const timerStatus = document.getElementById("timerStatus");
const shareQRBtn = document.getElementById("shareQRBtn");
const downloadQRBtn = document.getElementById("downloadQRBtn");
const stopSessionBtn = document.getElementById("stopSessionBtn");
const pauseSessionBtn = document.getElementById("pauseSessionBtn");
const attendanceList = document.getElementById("attendanceList");
const qrModeBadge = document.getElementById("qrModeBadge");

// Initialize buttons as DISABLED by default
shareQRBtn.disabled = true;
shareQRBtn.style.opacity = "0.5";
downloadQRBtn.disabled = true;
downloadQRBtn.style.opacity = "0.5";
pauseSessionBtn.disabled = true;
pauseSessionBtn.style.opacity = "0.5";
stopSessionBtn.disabled = true;
stopSessionBtn.style.opacity = "0.5";

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
department = urlParams.get('dept');
classId = urlParams.get('classId');

// Check for existing active session on page load
window.addEventListener('load', () => {
  const savedSession = localStorage.getItem('activeSession');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    
    // Check if session is for this class
    if (sessionData.department === department && sessionData.classId === classId) {
      // Restore session
      sessionId = sessionData.sessionId;
      sessionStartTime = sessionData.startTime;
      timeLimit = sessionData.timeLimit;
      graceTime = sessionData.graceTime;
      attendanceMode = sessionData.attendanceMode;
      isPaused = sessionData.isPaused || false;
      pausedTimeRemaining = sessionData.pausedTimeRemaining || 0;
      
      // Set input values
      timeLimitInput.value = timeLimit;
      graceTimeInput.value = graceTime;
      
      // Restore class name from localStorage
      if (sessionData.className) {
        document.getElementById("className").textContent = sessionData.className;
      }
      if (sessionData.classSchedule) {
        document.getElementById("classSchedule").textContent = sessionData.classSchedule;
      }
      
      // Regenerate QR Code (this will enable buttons)
      regenerateQRCode(sessionData);
    }
  }
  // If no saved session, buttons remain disabled
});

// Wait for authentication
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadClassInfo();
  } else {
    // Check if there's an active session before redirecting
    const savedSession = localStorage.getItem('activeSession');
    if (savedSession) {
      const sessionData = JSON.parse(savedSession);
      // If there's an active session for this class, don't redirect
      if (sessionData.department === department && sessionData.classId === classId) {
        showToast("You've been logged out, but the session will continue until it expires");
        return;
      }
    }
    // No active session, redirect to login
    window.location.href = "index.html";
  }
});

// Listen for attendance mode selection
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    // Remove active class from all cards
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked card
    card.classList.add('active');
    
    // Update attendance mode
    attendanceMode = card.dataset.mode;
  });
});

// Load class information
function loadClassInfo() {
  const classRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}`);
  onValue(classRef, (snapshot) => {
    if (snapshot.exists()) {
      const classData = snapshot.val();
      const className = `${classData.sectionName} - ${classData.subjectName}`;
      document.getElementById("className").textContent = className;
      
      // Load schedule if exists
      let scheduleText = "";
      if (classData.schedule) {
        const schedules = Object.values(classData.schedule);
        scheduleText = `Schedule: ${schedules.map(s => 
          `${s.day} ${s.startTime}-${s.endTime}`
        ).join(", ")}`;
        document.getElementById("classSchedule").textContent = scheduleText;
      }
      
      // Update localStorage with class info
      const savedSession = localStorage.getItem('activeSession');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        sessionData.className = className;
        sessionData.classSchedule = scheduleText;
        localStorage.setItem('activeSession', JSON.stringify(sessionData));
      }
    }
  });
}

// Regenerate QR Code from saved session
function regenerateQRCode(sessionData) {
  // Generate QR Code data
  const qrData = {
    teacherId: sessionData.teacherId,
    department: sessionData.department,
    classId: sessionData.classId,
    sessionId: sessionData.sessionId,
    mode: sessionData.attendanceMode,
    type: "attendance"
  };
  
  // ✅ FIXED: Use correct filename
  let studentUrl;
  if (sessionData.attendanceMode === "faceRecognition") {
    studentUrl = `https://${window.location.host}/face-recognition.html?data=${encodeURIComponent(JSON.stringify(qrData))}`;
    qrModeBadge.textContent = "Face Recognition Mode";
    qrModeBadge.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  } else {
    studentUrl = `https://${window.location.host}/scan-attendance.html?data=${encodeURIComponent(JSON.stringify(qrData))}`;
    qrModeBadge.textContent = "Automatic Mode";
    qrModeBadge.style.background = "linear-gradient(135deg, #0f4c3a 0%, #1a5c47 100%)";
  }
  
  // Generate QR Code
  QRCode.toCanvas(qrCodeCanvas, studentUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: sessionData.attendanceMode === "faceRecognition" ? "#667eea" : "#0f4c3a",
      light: "#ffffff"
    }
  }, (error) => {
    if (error) {
      console.error("❌ QR Code generation error:", error);
      showToast("Error generating QR code");
      return;
    }
    
    console.log("✅ QR Code regenerated successfully");
    
    // ✅ QR Code generated successfully - NOW enable buttons
    qrCodeSection.classList.remove("hidden");
    attendanceList.classList.remove("hidden");
    generateQRBtn.disabled = true;
    generateQRBtn.style.opacity = "0.5";
    
    // Enable action buttons ONLY after successful generation
    shareQRBtn.disabled = false;
    shareQRBtn.style.opacity = "1";
    downloadQRBtn.disabled = false;
    downloadQRBtn.style.opacity = "1";
    stopSessionBtn.disabled = false;
    stopSessionBtn.style.opacity = "1";
    pauseSessionBtn.disabled = false;
    pauseSessionBtn.style.opacity = "1";
    
    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - sessionData.startTime) / 1000);
    const totalSeconds = (sessionData.timeLimit + sessionData.graceTime) * 60;
    
    if (elapsed < totalSeconds) {
      // Start timer from where it left off
      if (sessionData.isPaused) {
        // Show paused state
        updateTimerDisplay(sessionData.pausedTimeRemaining);
        pauseSessionBtn.textContent = "▶ Resume";
        timerStatus.textContent = "Session Paused";
        document.querySelector(".status-dot").className = "status-dot grace";
      } else {
        startTimer(elapsed);
      }
      // Listen for attendance
      listenForAttendance();
      showToast("Session restored successfully!");
    } else {
      // Session expired
      endSession();
    }
  });
}

// Generate QR Code
generateQRBtn.addEventListener("click", async () => {
  timeLimit = parseInt(timeLimitInput.value);
  graceTime = parseInt(graceTimeInput.value);
  
  // Generate unique session ID
  sessionId = `session_${Date.now()}`;
  sessionStartTime = Date.now();
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Get class name for storage
  const className = document.getElementById("className").textContent;
  const classSchedule = document.getElementById("classSchedule").textContent;
  
  // ✅ AUTO-ADD TODAY'S DATE TO CLASS CUSTOM DATES
  try {
    const classRef = ref(db, `classes/${currentUser.uid}/${department}/${classId}`);
    const classSnap = await get(classRef);
    
    if (classSnap.exists()) {
      const classData = classSnap.val();
      const customDates = classData.customDates || {};
      
      // Check if today's date already exists
      const dateExists = Object.values(customDates).includes(today);
      
      if (!dateExists) {
        // Find next available key
        let dateIndex = 0;
        while (customDates[`date_${dateIndex}`]) {
          dateIndex++;
        }
        
        // Add today's date
        await update(ref(db, `classes/${currentUser.uid}/${department}/${classId}/customDates`), {
          [`date_${dateIndex}`]: today
        });
        
        console.log(`✅ Added today's date (${today}) to class dates`);
        showToast(`Today's date (${today}) added to attendance dates`);
      } else {
        console.log(`ℹ️ Today's date (${today}) already exists in class dates`);
      }
    }
  } catch (error) {
    console.error("❌ Error adding today's date:", error);
    // Continue anyway - don't block QR generation
  }
  
  // Store session data in localStorage for persistence
  localStorage.setItem('activeSession', JSON.stringify({
    sessionId,
    teacherId: currentUser.uid,
    department,
    classId,
    timeLimit,
    graceTime,
    attendanceMode,
    startTime: sessionStartTime,
    className,
    classSchedule,
    isPaused: false,
    pausedTimeRemaining: 0
  }));
  
  // Create session in database
  const sessionRef = ref(db, `attendance_sessions/${currentUser.uid}/${department}/${classId}/${sessionId}`);
  await set(sessionRef, {
    startTime: Date.now(),
    timeLimit: timeLimit,
    graceTime: graceTime,
    active: true,
    mode: attendanceMode,
    attendees: {},
    date: today // Store the date with the session
  });
  
  // Generate QR Code data with teacher and class info
  const qrData = {
    teacherId: currentUser.uid,
    department: department,
    classId: classId,
    sessionId: sessionId,
    mode: attendanceMode,
    type: "attendance",
    date: today // Include date in QR data
  };
  
  // ✅ FIXED: Use correct filename for face recognition
  // ✅ BOTH MODES NOW GO TO scan-attendance.html
const studentUrl = `https://${window.location.host}/scan-attendance.html?data=${encodeURIComponent(JSON.stringify(qrData))}`;

// Update badge styling based on mode
if (attendanceMode === "faceRecognition") {
  qrModeBadge.textContent = "Face Recognition Mode";
  qrModeBadge.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
} else {
  qrModeBadge.textContent = "Automatic Mode";
  qrModeBadge.style.background = "linear-gradient(135deg, #0f4c3a 0%, #1a5c47 100%)";
}
  
  console.log("🔗 Generated QR URL:", studentUrl);
  console.log("📅 Session date:", today);
  
  // Generate QR Code using imported module
  QRCode.toCanvas(qrCodeCanvas, studentUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: attendanceMode === "faceRecognition" ? "#667eea" : "#0f4c3a",
      light: "#ffffff"
    }
  }, (error) => {
    if (error) {
      console.error("❌ QR Code generation error:", error);
      showToast("Error generating QR code");
      return;
    }
    
    console.log("✅ QR Code generated successfully");
    
    // ✅ QR Code generated successfully - NOW enable buttons
    qrCodeSection.classList.remove("hidden");
    attendanceList.classList.remove("hidden");
    generateQRBtn.disabled = true;
    generateQRBtn.style.opacity = "0.5";
    
    // Enable action buttons ONLY after successful generation
    shareQRBtn.disabled = false;
    shareQRBtn.style.opacity = "1";
    downloadQRBtn.disabled = false;
    downloadQRBtn.style.opacity = "1";
    stopSessionBtn.disabled = false;
    stopSessionBtn.style.opacity = "1";
    pauseSessionBtn.disabled = false;
    pauseSessionBtn.style.opacity = "1";
    
    // Start timer
    startTimer();
    
    // Listen for attendance
    listenForAttendance();
    
    showToast(`QR Code generated! Mode: ${attendanceMode === "faceRecognition" ? "Face Recognition" : "Automatic"} | Date: ${today}`);
  });
});

// Update timer display
function updateTimerDisplay(remaining) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Timer function with optional starting elapsed time
function startTimer(startElapsed = 0) {
  const totalSeconds = (timeLimit + graceTime) * 60;
  let elapsed = startElapsed;
  
  timerInterval = setInterval(() => {
    if (isPaused) return;
    
    elapsed++;
    const remaining = totalSeconds - elapsed;
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      endSession();
      return;
    }
    
    updateTimerDisplay(remaining);
    pausedTimeRemaining = remaining;
    
    // Update localStorage with current state
    updateSessionStorage();
    
    // Update status
    const onTimeSeconds = timeLimit * 60;
    const statusDot = document.querySelector(".status-dot");
    
    if (elapsed < onTimeSeconds) {
      timerStatus.textContent = "On Time Period";
      statusDot.className = "status-dot active";
      timerDisplay.className = "timer";
    } else {
      timerStatus.textContent = "Grace Period (Late)";
      statusDot.className = "status-dot grace";
      timerDisplay.className = "timer grace-period";
    }
  }, 1000);
}

// Update session storage
function updateSessionStorage() {
  const savedSession = localStorage.getItem('activeSession');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    sessionData.isPaused = isPaused;
    sessionData.pausedTimeRemaining = pausedTimeRemaining;
    localStorage.setItem('activeSession', JSON.stringify(sessionData));
  }
}

// Pause/Resume Session
pauseSessionBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  
  if (isPaused) {
    pauseSessionBtn.textContent = "▶ Resume";
    timerStatus.textContent = "Session Paused";
    document.querySelector(".status-dot").className = "status-dot grace";
    showToast("Session paused");
  } else {
    pauseSessionBtn.textContent = "⏸ Pause";
    const onTimeSeconds = timeLimit * 60;
    const totalSeconds = (timeLimit + graceTime) * 60;
    const elapsed = totalSeconds - pausedTimeRemaining;
    
    if (elapsed < onTimeSeconds) {
      timerStatus.textContent = "On Time Period";
      document.querySelector(".status-dot").className = "status-dot active";
    } else {
      timerStatus.textContent = "Grace Period (Late)";
      document.querySelector(".status-dot").className = "status-dot grace";
    }
    showToast("Session resumed");
  }
  
  updateSessionStorage();
});

// Listen for student attendance in real-time
function listenForAttendance() {
  // Get session data from localStorage if currentUser is null
  const sessionData = JSON.parse(localStorage.getItem('activeSession') || '{}');
  const teacherId = currentUser ? currentUser.uid : sessionData.teacherId;
  
  const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees`);
  
  onValue(sessionRef, (snapshot) => {
    const studentList = document.getElementById("studentAttendanceList");
    const attendees = snapshot.val() || {};
    
    // Count statuses
    let presentCount = 0;
    let lateCount = 0;
    
    Object.values(attendees).forEach(attendee => {
      if (attendee.status === "present") presentCount++;
      if (attendee.status === "late") lateCount++;
    });
    
    document.getElementById("presentCount").textContent = presentCount;
    document.getElementById("lateCount").textContent = lateCount;
    
    // Render student rows
    studentList.innerHTML = "";
    Object.entries(attendees)
      .sort((a, b) => a[1].scanTime - b[1].scanTime) // Sort by scan time
      .forEach(([studentId, data]) => {
        const row = document.createElement("div");
        row.classList.add("student-row", data.status);
        
        const scanTime = new Date(data.scanTime);
        const timeStr = scanTime.toLocaleTimeString();
        
        // Add verification badge for face recognition mode
        const verificationBadge = data.faceVerified ? 
          '<span class="verification-badge">✓ Face Verified</span>' : '';
        
        row.innerHTML = `
          <span class="student-name">${data.name || data.studentNumber}</span>
          <span class="scan-time">${timeStr}</span>
          ${verificationBadge}
          <span class="status-badge ${data.status}">${data.status.toUpperCase()}</span>
        `;
        
        studentList.appendChild(row);
      });
  });
}

// Share QR Code as Image
shareQRBtn.addEventListener("click", async () => {
  // Check if QR code exists
  if (!qrCodeCanvas || qrCodeCanvas.width === 0) {
    showToast("Please generate a QR code first!");
    return;
  }
  
  const canvas = qrCodeCanvas;
  
  // Create a higher quality image with branding
  const enhancedCanvas = document.createElement('canvas');
  const ctx = enhancedCanvas.getContext('2d');
  
  // Set canvas size with padding for text
  enhancedCanvas.width = 400;
  enhancedCanvas.height = 480;
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, enhancedCanvas.width, enhancedCanvas.height);
  
  // Add title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CvSU Attendance', enhancedCanvas.width / 2, 40);
  
  // Add mode indicator
  ctx.font = '16px Arial';
  ctx.fillStyle = attendanceMode === "faceRecognition" ? "#667eea" : "#0f4c3a";
  ctx.fillText(
    attendanceMode === "faceRecognition" ? "Face Recognition Mode" : "Automatic Mode",
    enhancedCanvas.width / 2, 
    70
  );
  
  // Draw QR code
  ctx.drawImage(canvas, 50, 90, 300, 300);
  
  // Add footer text
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';
  ctx.fillText('Scan to mark attendance', enhancedCanvas.width / 2, 420);
  ctx.fillText(`Time Limit: ${timeLimit} min | Grace: ${graceTime} min`, enhancedCanvas.width / 2, 445);
  
  // Convert to blob and share
  enhancedCanvas.toBlob(async (blob) => {
    const file = new File([blob], "attendance-qr.png", { type: "image/png" });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Attendance QR Code",
          text: `Scan this QR code to mark your attendance (${attendanceMode === "faceRecognition" ? "Face Recognition" : "Automatic"} Mode)`,
          files: [file]
        });
        showToast("QR Code shared successfully!");
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Share failed:", error);
          fallbackShare();
        }
      }
    } else {
      fallbackShare();
    }
  });
});

function fallbackShare() {
  // Instead of copying link, just show a message
  showToast("Sharing not available. Use the download button to save the QR code.");
}

// Download QR Code as Image (used by the violet download button)
downloadQRBtn.addEventListener("click", () => {
  // Check if QR code exists
  if (!qrCodeCanvas || qrCodeCanvas.width === 0) {
    showToast("Please generate a QR code first!");
    return;
  }
  
  downloadEnhancedQRCode();
});

// Download QR Code as Image (reusable function)
function downloadEnhancedQRCode() {
  const canvas = qrCodeCanvas;
  
  // Create enhanced image with branding
  const enhancedCanvas = document.createElement('canvas');
  const ctx = enhancedCanvas.getContext('2d');
  
  // Set canvas size with padding
  enhancedCanvas.width = 400;
  enhancedCanvas.height = 480;
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, enhancedCanvas.width, enhancedCanvas.height);
  
  // Add title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CvSU Attendance', enhancedCanvas.width / 2, 40);
  
  // Add mode indicator
  ctx.font = '16px Arial';
  ctx.fillStyle = attendanceMode === "faceRecognition" ? "#667eea" : "#0f4c3a";
  ctx.fillText(
    attendanceMode === "faceRecognition" ? "Face Recognition Mode" : "Automatic Mode",
    enhancedCanvas.width / 2, 
    70
  );
  
  // Draw QR code
  ctx.drawImage(canvas, 50, 90, 300, 300);
  
  // Add footer text
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';
  ctx.fillText('Scan to mark attendance', enhancedCanvas.width / 2, 420);
  ctx.fillText(`Time Limit: ${timeLimit} min | Grace: ${graceTime} min`, enhancedCanvas.width / 2, 445);
  
  // Get current date/time for filename
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  // Download
  const url = enhancedCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `attendance-qr-${attendanceMode}-${dateStr}-${timeStr}.png`;
  link.href = url;
  link.click();
  showToast("QR Code image downloaded!");
}

// Stop Session
// Stop Session replaced with modal confirmation
const stopSessionModal = document.getElementById('stopSessionModal');
const stopConfirmBtn = document.getElementById('stopConfirmBtn');
const stopCancelBtn = document.getElementById('stopCancelBtn');

stopSessionBtn.addEventListener("click", () => {
  stopSessionModal.style.display = 'flex';
});

stopCancelBtn.addEventListener('click', () => {
  stopSessionModal.style.display = 'none';
});

// Close when clicking overlay
stopSessionModal.addEventListener('click', (e) => {
  if (e.target === stopSessionModal) stopSessionModal.style.display = 'none';
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stopSessionModal.style.display === 'flex') stopSessionModal.style.display = 'none';
});

stopConfirmBtn.addEventListener('click', async () => {
  stopSessionModal.style.display = 'none';
  await endSession();
  // Reload the page after ending session
  setTimeout(() => {
    window.location.reload();
  }, 1500);
});

// End session
async function endSession() {
  clearInterval(timerInterval);
  
  // Get session data from localStorage if currentUser is null
  const sessionData = JSON.parse(localStorage.getItem('activeSession') || '{}');
  const teacherId = currentUser ? currentUser.uid : sessionData.teacherId;
  
  // Mark session as inactive
  const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
  await update(sessionRef, {
    active: false,
    endTime: serverTimestamp()
  });
  
  // Mark remaining students as absent and save all attendance records
  await finalizeAttendance();
  
  // Clear localStorage
  localStorage.removeItem('activeSession');
  
  timerStatus.textContent = "Session Ended";
  document.querySelector(".status-dot").className = "status-dot expired";
  timerDisplay.className = "timer expired";
  timerDisplay.textContent = "00:00";
  
  // Disable pause button, keep stop button visible
  stopSessionBtn.textContent = "Session Ended";
  pauseSessionBtn.disabled = true;
  pauseSessionBtn.style.opacity = "0.5";
  
  showToast("Attendance session ended. Records saved. Reloading page...");
}

// Finalize attendance - mark absent students and save all records
async function finalizeAttendance() {
  try {
    const sessionData = JSON.parse(localStorage.getItem('activeSession') || '{}');
    const teacherId = currentUser ? currentUser.uid : sessionData.teacherId;
    
    const studentsRef = ref(db, `classes/${teacherId}/${department}/${classId}/students`);
    const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees`);
    
    const studentsSnapshot = await get(studentsRef);
    const sessionSnapshot = await get(sessionRef);
    
    const allStudents = studentsSnapshot.val() || {};
    const attendees = sessionSnapshot.val() || {};
    const today = new Date().toISOString().split('T')[0];
    
    let absentCount = 0;
    
    // Process all students
    for (const [studentId, studentData] of Object.entries(allStudents)) {
      const attendanceRef = ref(db, 
        `attendance/${teacherId}/${department}/${classId}/${today}/${studentId}`
      );
      
      if (attendees[studentId]) {
        // ✅ Student scanned (QR or Face) - save their status
        const attendeeData = attendees[studentId];
        
        await set(attendanceRef, {
          status: attendeeData.status, // "present" or "late"
          timestamp: attendeeData.scanTime,
          sessionId: sessionId,
          studentName: attendeeData.name,
          studentNumber: attendeeData.studentNumber,
          method: attendeeData.method || 'qr_scan', // 'qr_scan' or 'face_recognition'
          faceVerified: attendeeData.faceVerified || false,
          faceConfidence: attendeeData.faceConfidence || null,
          markedBy: "student" // Student marked their own attendance
        });
      } else {
        // ❌ Student didn't scan - mark as absent
        await set(attendanceRef, {
          status: "absent",
          timestamp: Date.now(),
          sessionId: sessionId,
          studentName: studentData.name,
          studentNumber: studentData.studentNumber,
          method: "auto-marked",
          markedBy: "system"
        });
        absentCount++;
      }
    }
    
    // Update absent count in UI
    document.getElementById("absentCount").textContent = absentCount;
    
    console.log('✅ Attendance finalized and saved to daily records');
    
  } catch (error) {
    console.error("❌ Error finalizing attendance:", error);
    showToast("Error saving attendance records");
  }
}

// Toast notification
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
    
    // Add toast styles if not in CSS
    const style = document.createElement('style');
    style.textContent = `
      .toast {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #1e293b;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 1000;
        font-weight: 500;
      }
      .toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(style);
  }
  
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}