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

// SVG Icons
const icons = {
  error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zm0-6H7V4h2v2z"/></svg>',
  book: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/></svg>',
  camera: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10.5 3.5L9.879 2.257A1.5 1.5 0 008.543 1.5h-1.086a1.5 1.5 0 00-1.336.793L5.5 3.5H3.75A2.25 2.25 0 001.5 5.75v5.5A2.25 2.25 0 003.75 13.5h8.5a2.25 2.25 0 002.25-2.25v-5.5a2.25 2.25 0 00-2.25-2.25H10.5zM8 11.25a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 8.5V4a.5.5 0 00-1 0v5a.5.5 0 00.5.5h3.5a.5.5 0 000-1H9z"/></svg>',
  chart: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 14.25c0 .138.112.25.25.25H4v-6.5H1.5v6.25zm4.5.25h2.5v-9H6v9zm4 0h2.25a.25.25 0 00.25-.25V3.5H10v11zm4.5-10.5h-2V11h2V4z"/></svg>',
  save: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177L10.513 1.573a.25.25 0 00-.177-.073H3.75z"/></svg>',
  reload: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.705 8.005a.75.75 0 01.834.656 5.5 5.5 0 009.592 2.97l-1.204-1.204a.25.25 0 01.177-.427h3.646a.25.25 0 01.25.25v3.646a.25.25 0 01-.427.177l-1.38-1.38A7.001 7.001 0 011.05 8.84a.75.75 0 01.656-.834zM8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0114.95 7.16a.75.75 0 01-1.49.178A5.5 5.5 0 008 2.5z"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.9 1.5a1 1 0 00-1.8 0L.3 12.6a1 1 0 00.9 1.4h13.6a1 1 0 00.9-1.4L8.9 1.5zM9 13H7v-2h2v2zm0-3H7V5h2v5z"/></svg>',
  mask: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM5.75 7.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm4.5 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zM8 12.5c-1.657 0-3-1.119-3-2.5h6c0 1.381-1.343 2.5-3 2.5z"/></svg>',
  note: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.75C4 .784 4.784 0 5.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0114.25 16h-8.5A1.75 1.75 0 014 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177L11.513 1.573a.25.25 0 00-.177-.073H5.75z"/></svg>',
  hourglass: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.75 1.5a.75.75 0 00-.75.75v1c0 1.11.49 2.107 1.263 2.792A3.739 3.739 0 004.75 8c0 .927-.343 1.779-1.487 2.458A3.739 3.739 0 002 13.25v1c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75v-1a3.739 3.739 0 00-1.263-2.792A3.739 3.739 0 0011.25 8c0-.927.343-1.779 1.487-2.458A3.739 3.739 0 0014 2.75v-1a.75.75 0 00-.75-.75H2.75z"/></svg>'
};

// Check jsQR library
if (!window.jsQR) {
  console.log(icons.error + ' jsQR library not found!');
  setTimeout(() => {
    alert('QR Scanner library not loaded. Please refresh the page.');
  }, 1000);
} else {
  console.log(icons.check + ' jsQR library loaded successfully');
}

// Authentication check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log(icons.error + ' No user authenticated, redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  currentUser = user;
  console.log(icons.check + ' User authenticated:', currentUser.uid);
  
  const teacherId = urlParams.get('teacherId');
  const dept = urlParams.get('dept');
  const classId = urlParams.get('classId');
  
  if (teacherId && dept && classId) {
    console.log(icons.book + ' Loading class info:', { teacherId, dept, classId });
    await loadClassInfo(teacherId, dept, classId);
  }
  
  // Process QR data if passed in URL
  if (qrDataParam) {
    console.log(icons.search + ' QR data found in URL, processing...');
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
      console.log(icons.check + ' Class info loaded:', classData.sectionName);
    } else {
      classNameEl.textContent = 'Class not found';
      console.error(icons.error + ' Class not found in database');
    }
  } catch (error) {
    console.error(icons.error + ' Error loading class info:', error);
    showStatus('Error loading class information', 'error');
  }
}

/* ========================================
   UPLOAD FUNCTIONALITY
======================================== */

uploadBox.addEventListener('click', () => {
  console.log(icons.camera + ' Upload box clicked');
  fileInput.click();
});

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
    console.log(icons.camera + ' Image dropped:', file.name);
    handleFileUpload(file);
  } else {
    console.error(icons.error + ' Invalid file type dropped');
    showStatus('Please drop an image file', 'error');
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    console.log(icons.camera + ' Image selected:', file.name);
    handleFileUpload(file);
  }
});

function handleFileUpload(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    uploadBox.style.display = 'none';
    previewContainer.style.display = 'block';
    console.log(icons.check + ' Image preview loaded');
  };
  
  reader.onerror = (error) => {
    console.error(icons.error + ' Error reading file:', error);
    showStatus('Error loading image', 'error');
  };
  
  reader.readAsDataURL(file);
}

scanUploadBtn.addEventListener('click', async () => {
  if (!window.jsQR) {
    showStatus('QR Scanner library not loaded. Please refresh the page.', 'error');
    return;
  }
  
  console.log(icons.search + ' Starting QR code scan from image...');
  showLoading();
  
  try {
    const img = new Image();
    img.src = previewImage.src;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    console.log(icons.check + ' Image loaded for scanning:', img.width, 'x', img.height);
    
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
      console.log(icons.chart + ' Image resized to:', width, 'x', height);
    }
    
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, width, height);
    
    // Try multiple detection strategies
    let code = null;
    
    // Strategy 1: Normal scan
    console.log(icons.search + ' Attempt 1: Normal scan...');
    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    
    // Strategy 2: Enhanced contrast
    if (!code) {
      console.log(icons.search + ' Attempt 2: Enhanced contrast...');
      const enhanced = enhanceContrast(imageData);
      code = window.jsQR(enhanced.data, enhanced.width, enhanced.height, {
        inversionAttempts: "attemptBoth",
      });
    }
    
    // Strategy 3: Different scaling
    if (!code) {
      console.log(icons.search + ' Attempt 3: Trying different scale...');
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
    
    // Strategy 4: Try smaller scale
    if (!code) {
      console.log(icons.search + ' Attempt 4: Trying smaller scale...');
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = width * 0.7;
      smallCanvas.height = height * 0.7;
      const smallCtx = smallCanvas.getContext('2d');
      smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
      
      const smallData = smallCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
      code = window.jsQR(smallData.data, smallData.width, smallData.height, {
        inversionAttempts: "attemptBoth",
      });
    }
    
    hideLoading();
    
    if (code) {
      console.log(icons.check + ' QR Code detected:', code.data);
      await processQRCode(code.data);
    } else {
      console.error(icons.error + ' No QR code found after all attempts');
      showStatus('No QR code found. Please ensure the QR code is clear, well-lit, and fully visible in the image.', 'error');
    }
  } catch (error) {
    hideLoading();
    console.error(icons.error + ' Error scanning image:', error);
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
  console.log(icons.trash + ' Clearing uploaded image');
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
    
    console.log(icons.info + ' Raw QR data:', qrDataString);
    
    // Parse QR code data (handle URL or direct JSON)
    if (qrDataString.includes('?data=')) {
      try {
        const url = new URL(qrDataString);
        const dataParam = url.searchParams.get('data');
        
        if (!dataParam) {
          throw new Error('No data parameter found in URL');
        }
        
        qrData = JSON.parse(decodeURIComponent(dataParam));
        console.log(icons.check + ' Parsed QR data from URL:', qrData);
        
      } catch (urlError) {
        console.error(icons.error + ' URL parsing error:', urlError);
        throw new Error('Invalid QR code URL format');
      }
      
    } else {
      try {
        qrData = JSON.parse(qrDataString);
        console.log(icons.check + ' Parsed QR data as JSON:', qrData);
      } catch (jsonError) {
        console.error(icons.error + ' JSON parsing error:', jsonError);
        throw new Error('Invalid QR code format');
      }
    }
    
    // Validate QR code structure
    if (!qrData.teacherId || !qrData.classId || !qrData.department || !qrData.sessionId) {
      console.error(icons.error + ' Missing required fields:', qrData);
      throw new Error('Invalid QR code - missing required fields');
    }
    
    if (qrData.type !== 'attendance') {
      throw new Error('This is not an attendance QR code');
    }
    
    console.log(icons.check + ' QR code validated:', qrData);

    // CHECK IF FACE RECOGNITION QR
if (qrData.mode === 'faceRecognition') {
  console.log(icons.mask + ' Face Recognition QR detected');
  hideLoading();
  
  // Redirect to scan-attendance for auth check
  const dataString = encodeURIComponent(JSON.stringify(qrData));
  window.location.href = `scan-attendance.html?data=${dataString}`;
  return;
}
    
    // Continue with AUTOMATIC attendance (non-face recognition)
    console.log(icons.note + ' Processing automatic attendance...');
    await markAutomaticAttendance(qrData);
    
  } catch (error) {
    hideLoading();
    console.error(icons.error + ' Error processing QR code:', error);
    showStatus(error.message || 'Invalid QR code. Please try again.', 'error');
  }
}

// Mark automatic attendance (non-face recognition)
async function markAutomaticAttendance(qrData) {
  const { teacherId, classId, department, sessionId } = qrData;
  
  console.log(icons.book + ' Loading class and session data...');
  
  // Load class info
  await loadClassInfo(teacherId, department, classId);
  
  // Check enrollment
  const studentRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}`);
  const studentSnap = await get(studentRef);
  
  if (!studentSnap.exists()) {
    console.error(icons.error + ' Student not enrolled in class');
    throw new Error('You are not enrolled in this class');
  }
  
  const studentData = studentSnap.val();
  console.log(icons.check + ' Student enrolled:', studentData.name || studentData.studentNumber);
  
  // Check session validity
  const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
  const sessionSnap = await get(sessionRef);
  
  if (!sessionSnap.exists()) {
    console.error(icons.error + ' Session not found');
    throw new Error('Attendance session not found');
  }
  
  const sessionData = sessionSnap.val();
  console.log(icons.check + ' Session found:', sessionData);
  
  if (!sessionData.active) {
    console.error(icons.error + ' Session is not active');
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
  
  console.log(icons.clock + ' Time calculation:', {
    now,
    sessionStart,
    elapsed,
    elapsedMinutes: (elapsed / 60000).toFixed(2),
    timeLimit,
    graceTime
  });
  
  if (elapsed > totalTimeMs) {
    const minutesElapsed = Math.floor(elapsed / 60000);
    console.error(icons.error + ' Attendance window closed');
    throw new Error(`Attendance window closed. Session started ${minutesElapsed} minutes ago.`);
  }
  
  const status = elapsed <= timeLimitMs ? 'present' : 'late';
  console.log(icons.chart + ' Attendance status:', status);
  
  // Check if already marked
  const attendeeRef = ref(db, 
    `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees/${currentUser.uid}`
  );
  const attendeeSnap = await get(attendeeRef);
  
  if (attendeeSnap.exists()) {
    console.log(icons.info + ' Already marked attendance');
    throw new Error('You have already marked your attendance for this session');
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
  
  console.log(icons.save + ' Saving attendance:', attendanceData);
  await set(attendeeRef, attendanceData);
  
  console.log(icons.check + ' Attendance marked successfully!');
  hideLoading();
  
  if (status === 'present') {
    showStatus(icons.check + ' Attendance marked: PRESENT', 'success');
  } else {
    showStatus(icons.warning + ' Attendance marked: LATE', 'warning');
  }
  
  // Redirect after 2 seconds
  console.log(icons.reload + ' Redirecting to classes page...');
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
  console.log(icons.info + ` Status: [${type}] ${message}`);
}

function hideStatus() {
  statusMessage.className = 'status-message';
}

function showLoading() {
  loadingOverlay.style.display = 'flex';
  console.log(icons.hourglass + ' Loading overlay shown');
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
  console.log(icons.check + ' Loading overlay hidden');
}