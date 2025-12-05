import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const qrDataParam = urlParams.get('data');

// DOM Elements
const classNameEl = document.getElementById('className');
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const scanUploadBtn = document.getElementById('scanUploadBtn');
const clearUploadBtn = document.getElementById('clearUploadBtn');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');

let currentUser = null;

// Check jsQR library
if (!window.jsQR) {
  console.error('jsQR library not found!');
  setTimeout(() => {
    alert('QR Scanner library not loaded. Please refresh the page.');
  }, 1000);
}

// Authentication check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  
  const teacherId = urlParams.get('teacherId');
  const dept = urlParams.get('dept');
  const classId = urlParams.get('classId');
  
  if (teacherId && dept && classId) {
    await loadClassInfo(teacherId, dept, classId);
  }
  
  // Process QR data if passed in URL
  if (qrDataParam) {
    await processQRCode(qrDataParam);
  }
});

// Load class information
async function loadClassInfo(teacherId, dept, classId) {
  try {
    const classRef = ref(db, `classes/${teacherId}/${dept}/${classId}`);
    const snapshot = await get(classRef);
    
    if (snapshot.exists()) {
      const classData = snapshot.val();
      classNameEl.textContent = `${classData.sectionName} - ${classData.subjectName}`;
    } else {
      classNameEl.textContent = 'Class not found';
    }
  } catch (error) {
    console.error('Error loading class info:', error);
    showStatus('Error loading class information', 'error');
  }
}

/* ========================================
   UPLOAD FUNCTIONALITY
======================================== */

uploadBox.addEventListener('click', () => fileInput.click());

uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.classList.remove('dragover');
  
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleFileUpload(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFileUpload(file);
  }
});

function handleFileUpload(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    uploadBox.style.display = 'none';
    previewContainer.style.display = 'block';
  };
  
  reader.readAsDataURL(file);
}

scanUploadBtn.addEventListener('click', async () => {
  if (!window.jsQR) {
    showStatus('QR Scanner library not loaded. Please refresh the page.', 'error');
    return;
  }
  
  showLoading();
  
  try {
    const img = new Image();
    img.src = previewImage.src;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    // Create canvas with improved sizing
    const canvas = document.createElement('canvas');
    const maxSize = 1200;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else {
        width = (width / height) * maxSize;
        height = maxSize;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, width, height);
    
    // Try multiple detection strategies
    let code = null;
    
    // Strategy 1: Normal scan
    console.log('Attempt 1: Normal scan...');
    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    
    // Strategy 2: Enhanced contrast
    if (!code) {
      console.log('Attempt 2: Enhanced contrast...');
      const enhanced = enhanceContrast(imageData);
      code = window.jsQR(enhanced.data, enhanced.width, enhanced.height, {
        inversionAttempts: "attemptBoth",
      });
    }
    
    // Strategy 3: Different scaling
    if (!code) {
      console.log('Attempt 3: Trying different scale...');
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = width * 1.5;
      scaledCanvas.height = height * 1.5;
      const scaledCtx = scaledCanvas.getContext('2d');
      scaledCtx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height);
      
      const scaledData = scaledCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
      code = window.jsQR(scaledData.data, scaledData.width, scaledData.height, {
        inversionAttempts: "attemptBoth",
      });
    }
    
    hideLoading();
    
    if (code) {
      console.log('✅ QR Code detected:', code.data);
      await processQRCode(code.data);
    } else {
      console.error('❌ No QR code found after all attempts');
      showStatus('No QR code found. Please ensure the QR code is clear, well-lit, and fully visible in the image.', 'error');
    }
  } catch (error) {
    hideLoading();
    console.error('Error scanning image:', error);
    showStatus('Error scanning QR code: ' + error.message, 'error');
  }
});

// Image enhancement helper
function enhanceContrast(imageData) {
  const data = new Uint8ClampedArray(imageData.data);
  const factor = 1.5;
  
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // Apply contrast
    const contrasted = ((gray / 255 - 0.5) * factor + 0.5) * 255;
    const value = Math.max(0, Math.min(255, contrasted));
    
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

clearUploadBtn.addEventListener('click', () => {
  previewImage.src = '';
  fileInput.value = '';
  uploadBox.style.display = 'block';
  previewContainer.style.display = 'none';
  hideStatus();
});

/* ========================================
   PROCESS QR CODE - WITH FACE RECOGNITION REDIRECT
======================================== */

async function processQRCode(qrDataString) {
  showLoading();
  
  try {
    let qrData;
    
    console.log('📥 Raw QR data:', qrDataString);
    
    // Parse QR code data (handle URL or direct JSON)
    if (qrDataString.includes('?data=')) {
      try {
        const url = new URL(qrDataString);
        const dataParam = url.searchParams.get('data');
        
        if (!dataParam) {
          throw new Error('No data parameter found in URL');
        }
        
        qrData = JSON.parse(decodeURIComponent(dataParam));
        console.log('✅ Parsed QR data from URL:', qrData);
        
      } catch (urlError) {
        console.error('URL parsing error:', urlError);
        throw new Error('Invalid QR code URL format');
      }
      
    } else {
      try {
        qrData = JSON.parse(qrDataString);
        console.log('✅ Parsed QR data as JSON:', qrData);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Invalid QR code format');
      }
    }
    
    // Validate QR code structure
    if (!qrData.teacherId || !qrData.classId || !qrData.department || !qrData.sessionId) {
      console.error('❌ Missing required fields:', qrData);
      throw new Error('Invalid QR code - missing required fields');
    }
    
    if (qrData.type !== 'attendance') {
      throw new Error('This is not an attendance QR code');
    }
    
    // 🔥 CHECK IF FACE RECOGNITION QR - REDIRECT IMMEDIATELY
    if (qrData.mode === 'faceRecognition') {
      console.log('🎭 Face Recognition QR detected - Redirecting...');
      hideLoading();
      showStatus('Face Recognition Required - Redirecting...', 'info');
      
      // Redirect to universal face recognition page
      setTimeout(() => {
        const dataString = encodeURIComponent(JSON.stringify(qrData));
        window.location.href = `face-recognition.html?data=${dataString}`;
      }, 1500);
      return;
    }
    
    // ✅ Continue with AUTOMATIC attendance (non-face recognition)
    console.log('📝 Processing automatic attendance...');
    await markAutomaticAttendance(qrData);
    
  } catch (error) {
    hideLoading();
    console.error('❌ Error processing QR code:', error);
    showStatus(error.message || 'Invalid QR code. Please try again.', 'error');
  }
}

// Mark automatic attendance (non-face recognition)
async function markAutomaticAttendance(qrData) {
  const { teacherId, classId, department, sessionId } = qrData;
  
  // Load class info
  await loadClassInfo(teacherId, department, classId);
  
  // Check enrollment
  const studentRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}`);
  const studentSnap = await get(studentRef);
  
  if (!studentSnap.exists()) {
    throw new Error('You are not enrolled in this class');
  }
  
  const studentData = studentSnap.val();
  
  // Check session validity
  const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
  const sessionSnap = await get(sessionRef);
  
  if (!sessionSnap.exists()) {
    throw new Error('Attendance session not found');
  }
  
  const sessionData = sessionSnap.val();
  
  if (!sessionData.active) {
    throw new Error('This attendance session has ended');
  }
  
  // Calculate status (present/late)
  const now = Date.now();
  const sessionStart = sessionData.startTime;
  const timeLimit = sessionData.timeLimit || 10;
  const graceTime = sessionData.graceTime || 5;
  const timeLimitMs = timeLimit * 60 * 1000;
  const totalTimeMs = (timeLimit + graceTime) * 60 * 1000;
  const elapsed = now - sessionStart;
  
  if (elapsed > totalTimeMs) {
    const minutesElapsed = Math.floor(elapsed / 60000);
    throw new Error(`Attendance window closed. Session started ${minutesElapsed} minutes ago.`);
  }
  
  const status = elapsed <= timeLimitMs ? 'present' : 'late';
  
  // Check if already marked
  const attendeeRef = ref(db, 
    `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees/${currentUser.uid}`
  );
  const attendeeSnap = await get(attendeeRef);
  
  if (attendeeSnap.exists()) {
    throw new Error('You have already marked your attendance for this session');
  }
  
  // Mark attendance
  await set(attendeeRef, {
    name: studentData.name || 'Unknown Student',
    studentNumber: studentData.studentNumber || currentUser.uid,
    scanTime: now,
    status: status,
    faceVerified: false,
    method: 'qr_scan'
  });
  
  hideLoading();
  
  if (status === 'present') {
    showStatus('✅ Attendance marked: PRESENT', 'success');
  } else {
    showStatus('⚠️ Attendance marked: LATE', 'warning');
  }
  
  // Redirect after 2 seconds
  setTimeout(() => {
    window.location.href = 'classes-student.html';
  }, 2000);
}

/* ========================================
   UTILITY FUNCTIONS
======================================== */

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type} show`;
}

function hideStatus() {
  statusMessage.className = 'status-message';
}

function showLoading() {
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}