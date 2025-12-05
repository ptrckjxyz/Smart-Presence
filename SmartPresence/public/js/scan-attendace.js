import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Get QR data from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const qrDataParam = urlParams.get('data');

// DOM Elements
const statusContainer = document.getElementById('statusContainer');
const statusIcon = document.getElementById('statusIcon');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const classInfo = document.getElementById('classInfo');
const loadingScreen = document.getElementById('loadingScreen');
const actionButton = document.getElementById('actionButton');

let currentUser = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `login.html?returnUrl=${returnUrl}`;
    return;
  }
  
  currentUser = user;
  
  if (!qrDataParam) {
    showError('Invalid QR Code', 'No attendance data found. Please scan a valid QR code.');
    return;
  }
  
  await processAttendance();
});

// Process attendance automatically
async function processAttendance() {
  try {
    showLoading('Processing attendance...');
    
    let qrData;
    try {
      const decodedData = decodeURIComponent(qrDataParam);
      console.log('Decoded QR data:', decodedData);
      qrData = JSON.parse(decodedData);
      console.log('Parsed QR data:', qrData);
    } catch (parseError) {
      console.error('QR Parse error:', parseError);
      throw new Error('Invalid QR code format - could not parse data');
    }
    
    // Validate QR code structure
    if (!qrData.teacherId || !qrData.classId || !qrData.department || !qrData.sessionId) {
      console.error('Missing fields in QR data:', qrData);
      throw new Error('Invalid QR code: missing required information');
    }
    
    if (qrData.type !== 'attendance') {
      throw new Error('This is not an attendance QR code');
    }
    
    // ✅ CHECK IF FACE RECOGNITION QR - REDIRECT TO UNIVERSAL PAGE
    if (qrData.mode === 'faceRecognition') {
      console.log('🎭 Face Recognition QR detected, redirecting...');
      showLoading('Face Recognition Required - Redirecting...');
      
      // Redirect to universal face recognition page
      setTimeout(() => {
        window.location.href = `face-recognition.html?data=${qrDataParam}`;
      }, 1500);
      return;
    }
    
    const { teacherId, classId, department, sessionId } = qrData;
    
    console.log('Looking up session:', { teacherId, department, classId, sessionId });
    
    // Load class information
    const classRef = ref(db, `classes/${teacherId}/${department}/${classId}`);
    const classSnap = await get(classRef);
    
    if (!classSnap.exists()) {
      throw new Error('Class not found');
    }
    
    const classData = classSnap.val();
    console.log('Class data loaded:', classData);
    
    // Check if student is enrolled
    const studentRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}`);
    const studentSnap = await get(studentRef);
    
    if (!studentSnap.exists()) {
      throw new Error('You are not enrolled in this class');
    }
    
    const studentData = studentSnap.val();
    console.log('Student data loaded:', studentData);
    
    if (!studentData.name && !studentData.studentNumber) {
      throw new Error('Student profile is incomplete. Please update your profile.');
    }
    
    // Check session validity
    const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
    const sessionSnap = await get(sessionRef);
    
    if (!sessionSnap.exists()) {
      console.error('Session not found at path:', `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
      throw new Error('Attendance session not found');
    }
    
    const sessionData = sessionSnap.val();
    console.log('Session data loaded:', sessionData);
    
    if (!sessionData.active) {
      throw new Error('This attendance session has ended');
    }
    
    if (!sessionData.startTime || typeof sessionData.startTime !== 'number') {
      console.error('Invalid session startTime:', sessionData.startTime);
      throw new Error('Session configuration error - invalid start time');
    }
    
    // Calculate status
    const now = Date.now();
    const sessionStart = sessionData.startTime;
    const timeLimit = sessionData.timeLimit || 10;
    const graceTime = sessionData.graceTime || 5;
    const timeLimitMs = timeLimit * 60 * 1000;
    const totalTimeMs = (timeLimit + graceTime) * 60 * 1000;
    const elapsed = now - sessionStart;
    
    console.log('Time calculation:', {
      now, sessionStart, elapsed,
      elapsedMinutes: elapsed / 60000,
      timeLimit, graceTime
    });
    
    if (elapsed > totalTimeMs) {
      const minutesElapsed = Math.floor(elapsed / 60000);
      throw new Error(`Attendance window has closed. Session started ${minutesElapsed} minutes ago.`);
    }
    
    const status = elapsed <= timeLimitMs ? 'present' : 'late';
    console.log('Attendance status:', status);
    
    // Check if already marked
    const attendeeRef = ref(db, 
      `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees/${currentUser.uid}`
    );
    const attendeeSnap = await get(attendeeRef);
    
    if (attendeeSnap.exists()) {
      const existingData = attendeeSnap.val();
      console.log('Student already marked attendance:', existingData);
      showAlreadyMarked(classData, existingData);
      return;
    }
    
    // Mark attendance
    const attendanceData = {
      name: studentData.name || 'Unknown Student',
      studentNumber: studentData.studentNumber || currentUser.uid,
      scanTime: now,
      status: status,
      faceVerified: false,
      method: 'qr_scan'
    };
    
    console.log('Marking attendance:', attendanceData);
    await set(attendeeRef, attendanceData);
    
    console.log('✅ Attendance marked successfully');
    showSuccess(classData, status);
    
  } catch (error) {
    console.error('Error processing attendance:', error);
    showError('Attendance Failed', error.message || 'An error occurred while marking attendance.');
  }
}

// UI Functions
function showLoading(message) {
  loadingScreen.style.display = 'flex';
  statusContainer.style.display = 'none';
}

function showSuccess(classData, status) {
  loadingScreen.style.display = 'none';
  statusContainer.style.display = 'flex';
  statusContainer.className = 'status-container success';
  
  if (status === 'present') {
    statusIcon.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    `;
    statusTitle.textContent = 'Attendance Marked: PRESENT';
    statusMessage.textContent = 'You have successfully marked your attendance on time.';
  } else {
    statusIcon.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4m0 4h.01"/>
      </svg>
    `;
    statusTitle.textContent = 'Attendance Marked: LATE';
    statusMessage.textContent = 'Your attendance has been marked as late (grace period).';
    statusContainer.className = 'status-container warning';
  }
  
  classInfo.innerHTML = `
    <strong>Class:</strong> ${classData.sectionName} - ${classData.subjectName}<br>
    <strong>Time:</strong> ${new Date().toLocaleString()}
  `;
  classInfo.style.display = 'block';
  
  actionButton.textContent = 'Back to Classes';
  actionButton.style.display = 'inline-block';
  actionButton.onclick = () => window.location.href = 'classes-student.html';
}

function showAlreadyMarked(classData, existingData) {
  loadingScreen.style.display = 'none';
  statusContainer.style.display = 'flex';
  statusContainer.className = 'status-container info';
  
  statusIcon.innerHTML = `
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4m0-4h.01"/>
    </svg>
  `;
  
  statusTitle.textContent = 'Already Marked';
  statusMessage.textContent = 'You have already marked your attendance for this session.';
  
  const scanTime = new Date(existingData.scanTime);
  classInfo.innerHTML = `
    <strong>Class:</strong> ${classData.sectionName} - ${classData.subjectName}<br>
    <strong>Status:</strong> ${existingData.status.toUpperCase()}<br>
    <strong>Marked at:</strong> ${scanTime.toLocaleString()}
  `;
  classInfo.style.display = 'block';
  
  actionButton.textContent = 'Back to Classes';
  actionButton.style.display = 'inline-block';
  actionButton.onclick = () => window.location.href = 'classes-student.html';
}

function showError(title, message) {
  loadingScreen.style.display = 'none';
  statusContainer.style.display = 'flex';
  statusContainer.className = 'status-container error';
  
  statusIcon.innerHTML = `
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  `;
  
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  
  actionButton.textContent = 'Try Again';
  actionButton.style.display = 'inline-block';
  actionButton.onclick = () => window.location.href = 'qr-scanner-student.html';
}