// js/verify.js - ENHANCED with Face Recognition UI matching face-recognition.js
import { auth, db } from './firebase.js';
import { ref, set, update, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const form = document.getElementById('verifyForm');
const statusMsg = document.getElementById('statusMessage');
const camera = document.getElementById('camera');
const overlay = document.getElementById('overlay');
const snapshot = document.getElementById('snapshot');
const captureContainer = document.getElementById('captureContainer');
const cameraInstruction = document.getElementById('cameraInstruction');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const nextStepBtn = document.getElementById('nextStepBtn');

let capturedImage = null;
let faceDescriptor = null;
let isScanning = false;

// Voice feedback variables
let lastVoiceCommand = "";
let lastVoiceTime = 0;
const voiceDelay = 2000;

/* ========================================
   VOICE FEEDBACK SYSTEM
======================================== */
function speak(text, force = false) {
  const now = Date.now();
  
  if (!force && text === lastVoiceCommand && (now - lastVoiceTime) < voiceDelay) {
    return;
  }
  
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.pitch = 1;
    utter.rate = 1;
    utter.volume = 1;
    
    speechSynthesis.speak(utter);
    
    lastVoiceCommand = text;
    lastVoiceTime = now;
    
    console.log(`🔊 Voice: ${text}`);
  }
}

/* ========================================
   BACKGROUND STATE MANAGEMENT
======================================== */
function setBackgroundState(state) {
  document.body.classList.remove('scanning-active', 'face-detected', 'face-analyzing', 'face-verified', 'face-error');
  
  if (state) {
    document.body.classList.add(state);
  }
}

function setCameraFrameState(state) {
  const cameraFrame = document.querySelector('.camera-frame');
  const scanGuide = document.querySelector('.scan-guide');
  
  if (cameraFrame) {
    cameraFrame.classList.remove('scanning', 'analyzing', 'verified', 'error');
    
    if (state) {
      cameraFrame.classList.add(state);
    }
  }
  
  if (scanGuide) {
    scanGuide.classList.remove('detecting', 'analyzing', 'verified', 'error');
    
    if (state) {
      if (state === 'scanning') {
        scanGuide.classList.add('detecting');
      } else {
        scanGuide.classList.add(state);
      }
    }
  }
}

/* ========================================
   INPUT VALIDATION
======================================== */
function setupValidation() {
  ["surname", "firstname", "middlename"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/[^A-Za-z\s]/g, "");
      });
    }
  });

  ["age", "contact", "idNumber"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/[^0-9]/g, "");
      });
    }
  });

  const idEl = document.getElementById("idNumber");
  if (idEl) {
    idEl.addEventListener("input", () => {
      if (idEl.value.length > 15) {
        idEl.value = idEl.value.slice(0, 15);
      }
    });
  }

  const emailEl = document.getElementById("email");
  if (emailEl) {
    emailEl.addEventListener("input", () => {
      if (!emailEl.value.includes("@")) {
        emailEl.style.border = "1px solid red";
      } else {
        emailEl.style.border = "1px solid #e0e0e0";
      }
    });
  }
}

setupValidation();

function showError(el, message) {
  let errorEl = el.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains('inline-error')) {
    errorEl = document.createElement('div');
    errorEl.className = 'inline-error';
    el.insertAdjacentElement('afterend', errorEl);
  }
  errorEl.textContent = message;
}

function clearError(el) {
  const errorEl = el.nextElementSibling;
  if (errorEl && errorEl.classList.contains('inline-error')) {
    errorEl.textContent = '';
  }
}

/* ========================================
   CONFIRMATION MODAL
======================================== */
function createConfirmationModal() {
  const modal = document.getElementById('confirmationModal');
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('show'));

  const cancelBtn = document.getElementById('cancelBtn');
  const proceedBtn = document.getElementById('proceedBtn');

  cancelBtn.onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
    speak('Review your information', true);
  };

  proceedBtn.onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
    proceedToFacialStep();
  };
}

/* ========================================
   STEP TRANSITION
======================================== */
if (nextStepBtn) {
  nextStepBtn.addEventListener('click', () => {
    const requiredFields = ['surname', 'firstname', 'age', 'address', 'email', 'contact', 'idNumber'];
    let valid = true;

    requiredFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.style.border = '1px solid red';
        showError(el, `${id} is required.`);
        valid = false;
      } else {
        el.style.border = '1px solid #e0e0e0';
        clearError(el);
      }
    });

    const emailEl = document.getElementById('email');
    if (!emailEl.value.includes("@")) {
      emailEl.style.border = "1px solid red";
      showError(emailEl, "Email must contain '@'.");
      valid = false;
    } else {
      clearError(emailEl);
    }

    const idEl = document.getElementById("idNumber");
    if (idEl.value.length === 0 || idEl.value.length > 15) {
      idEl.style.border = "1px solid red";
      showError(idEl, "ID Number must be numbers only and max 15 digits.");
      valid = false;
    } else {
      clearError(idEl);
    }

    const docFile = document.getElementById('documentUpload').files[0];
    const docEl = document.getElementById('documentUpload');
    if (!docFile) {
      showError(docEl, "Please upload your ID document.");
      valid = false;
    } else {
      clearError(docEl);
    }

    if (!valid) {
      speak('Please fill in all required fields', true);
      return;
    }

    createConfirmationModal();
  });
}

function proceedToFacialStep() {
  step1.style.display = 'none';
  step2.style.display = 'block';
  speak("Proceeding to facial verification. Please position your face within the guide.", true);
  startCamera();
}

/* ========================================
   FACE API SETUP
======================================== */
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/';

Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
]).then(() => {
  console.log("✅ All face recognition models loaded successfully");
}).catch(err => {
  console.error("❌ Model loading failed:", err);
  alert("⚠️ Face recognition models failed to load. Please refresh or check console.");
});

/* ========================================
   CAMERA CONTROLS
======================================== */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 }, 
        height: { ideal: 480 },
        facingMode: 'user'
      } 
    });
    
    camera.srcObject = stream;
    
    await new Promise((resolve) => {
      camera.onloadedmetadata = () => {
        camera.play();
        resolve();
      };
    });

    overlay.width = camera.videoWidth;
    overlay.height = camera.videoHeight;
    
    setBackgroundState('scanning-active');
    setCameraFrameState('scanning');
    
    speak('Camera started. Position your face in the guide.', true);
    setTimeout(() => startFaceDetection(), 500);
    
  } catch (err) {
    console.error("Camera error:", err);
    alert("⚠️ Unable to access camera. Please check permissions.");
    speak('Camera access denied. Please check permissions.', true);
  }
}

/* ========================================
   ENHANCED FACE DETECTION WITH VOICE (MATCHING FACE-RECOGNITION.JS)
======================================== */
async function startFaceDetection() {
  isScanning = true;
  const ctx = overlay.getContext('2d');
  
  let lastInstruction = "";
  let instructionClass = "";
  let scanningFace = false;
  let stableFrames = 0;
  const requiredStableFrames = 5;

  const detectionLoop = async () => {
    if (!isScanning) return;

    try {
      const detection = await faceapi
        .detectSingleFace(camera, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const cx = overlay.width / 2;
      const cy = overlay.height / 2;
      const radius = overlay.height * 0.35;

      let instruction = "Position your face within the circle";
      let newInstructionClass = "";

      if (detection && !scanningFace) {
        const box = detection.detection.box;
        
        // Draw face bounding box
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw corner brackets
        const bracketSize = 20;
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 3;
        
        // Top-left
        ctx.beginPath();
        ctx.moveTo(box.x + bracketSize, box.y);
        ctx.lineTo(box.x, box.y);
        ctx.lineTo(box.x, box.y + bracketSize);
        ctx.stroke();
        
        // Top-right
        ctx.beginPath();
        ctx.moveTo(box.x + box.width - bracketSize, box.y);
        ctx.lineTo(box.x + box.width, box.y);
        ctx.lineTo(box.x + box.width, box.y + bracketSize);
        ctx.stroke();
        
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(box.x, box.y + box.height - bracketSize);
        ctx.lineTo(box.x, box.y + box.height);
        ctx.lineTo(box.x + bracketSize, box.y + box.height);
        ctx.stroke();
        
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(box.x + box.width, box.y + box.height - bracketSize);
        ctx.lineTo(box.x + box.width, box.y + box.height);
        ctx.lineTo(box.x + box.width - bracketSize, box.y + box.height);
        ctx.stroke();

        const faceHeight = box.height;
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;

        const distFromCenterX = Math.abs(faceCenterX - cx);
        const distFromCenterY = Math.abs(faceCenterY - cy);

        setBackgroundState('face-detected');
        setCameraFrameState('scanning');

        if (faceHeight < 150) {
          instruction = "Move closer to the camera";
          newInstructionClass = "warning";
          speakInstruction('Please move closer');
          stableFrames = 0;
        } else if (faceHeight > 320) {
          instruction = "Move back from the camera";
          newInstructionClass = "warning";
          speakInstruction('Please move back');
          stableFrames = 0;
        } else if (distFromCenterX > 80) {
          if (faceCenterX < cx) {
            instruction = "Move slightly to your right";
            newInstructionClass = "warning";
            speakInstruction('Move to your right');
          } else {
            instruction = "Move slightly to your left";
            newInstructionClass = "warning";
            speakInstruction('Move to your left');
          }
          stableFrames = 0;
        } else if (distFromCenterY > 80) {
          if (faceCenterY < cy) {
            instruction = "Move down a bit";
            newInstructionClass = "warning";
            speakInstruction('Move down');
          } else {
            instruction = "Move up a bit";
            newInstructionClass = "warning";
            speakInstruction('Move up');
          }
          stableFrames = 0;
        } else {
          // Face is well positioned
          stableFrames++;
          
          if (stableFrames >= requiredStableFrames) {
            scanningFace = true;
            instruction = "Perfect! Scanning your face now...";
            newInstructionClass = "success";
            speakInstruction("Perfect position. Scanning now.", true);
            
            setBackgroundState('face-analyzing');
            setCameraFrameState('analyzing');

            faceDescriptor = Array.from(detection.descriptor);
            console.log("✅ Face descriptor extracted:", faceDescriptor.length, "dimensions");

            captureFace();
            
            setBackgroundState('face-verified');
            setCameraFrameState('verified');
            speakInstruction("Facial verification complete.", true);
            
            statusMsg.textContent = "✅ Face verified! Submitting your information...";

            await new Promise(r => setTimeout(r, 1500));
            form.requestSubmit();
          } else {
            instruction = "Hold still...";
            newInstructionClass = "success";
          }
        }
      } else if (!detection) {
        scanningFace = false;
        stableFrames = 0;
        setBackgroundState('scanning-active');
        setCameraFrameState('scanning');
      }

      if (instruction !== lastInstruction) {
        cameraInstruction.textContent = instruction;
        cameraInstruction.className = `camera-instruction ${newInstructionClass}`;
        lastInstruction = instruction;
        instructionClass = newInstructionClass;
      }

      if (isScanning && !scanningFace) {
        requestAnimationFrame(detectionLoop);
      }

    } catch (error) {
      console.error('Detection error:', error);
      if (isScanning) {
        requestAnimationFrame(detectionLoop);
      }
    }
  };

  detectionLoop();
}

function speakInstruction(text, force = false) {
  const now = Date.now();
  
  if (!force && text === lastVoiceCommand && (now - lastVoiceTime) < voiceDelay) {
    return;
  }
  
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    speechSynthesis.speak(utterance);
    
    lastVoiceCommand = text;
    lastVoiceTime = now;
  }
}

function captureFace() {
  const context = snapshot.getContext('2d');
  snapshot.width = camera.videoWidth;
  snapshot.height = camera.videoHeight;
  context.translate(snapshot.width, 0);
  context.scale(-1, 1);
  context.drawImage(camera, 0, 0, snapshot.width, snapshot.height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  capturedImage = snapshot.toDataURL('image/png');
  
  // Stop camera after capture
  isScanning = false;
  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }
}

/* ========================================
   FORM SUBMISSION
======================================== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    statusMsg.textContent = "⚠️ You must be logged in.";
    speak('You must be logged in', true);
    return;
  }

  if (!capturedImage) {
    alert("Please complete face verification first.");
    speak('Please complete face verification', true);
    return;
  }

  if (!faceDescriptor || faceDescriptor.length !== 128) {
    alert("❌ Face descriptor not properly captured. Please try again.");
    speak('Face capture failed. Please try again.', true);
    console.error("Invalid descriptor:", faceDescriptor);
    return;
  }

  const docFile = document.getElementById('documentUpload').files[0];
  if (!docFile) {
    alert("Please upload a verification document.");
    speak('Please upload verification document', true);
    return;
  }

  statusMsg.textContent = "⏳ Uploading files...";
  speak('Uploading your information', true);
  
  const cloudName = "drctbe4tj";
  const uploadPreset = "smartpresence_upload";

  const uploadToCloudinary = async (fileOrDataUrl) => {
    const formData = new FormData();
    formData.append("file", fileOrDataUrl);
    formData.append("upload_preset", uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, { 
      method: "POST", 
      body: formData 
    });
    return await res.json();
  };

  try {
    const [docUpload, faceUpload] = await Promise.all([
      uploadToCloudinary(docFile),
      uploadToCloudinary(capturedImage)
    ]);

    const userSnap = await get(ref(db, `users/${user.uid}`));
    const userData = userSnap.exists() ? userSnap.val() : {};

    const formDataObj = {
      surname: document.getElementById('surname').value,
      firstname: document.getElementById('firstname').value,
      middlename: document.getElementById('middlename').value,
      age: document.getElementById('age').value,
      address: document.getElementById('address').value,
      email: document.getElementById('email').value,
      contact: document.getElementById('contact').value,
      idNumber: document.getElementById('idNumber').value,
      documentUrl: docUpload.secure_url,
      facialImageUrl: faceUpload.secure_url,
      faceDescriptor: faceDescriptor,
      category: userData.category || "unknown",
      status: "pending",
      submittedAt: new Date().toISOString()
    };

    console.log("📤 Submitting with face descriptor:", faceDescriptor.length, "dimensions");

    await set(ref(db, `verificationRequests/${user.uid}`), formDataObj);
    await update(ref(db, `users/${user.uid}`), {
      verificationStatus: "pending",
      verified: false
    });

    statusMsg.textContent = "✅ Verification submitted successfully! Redirecting...";
    speak("Verification submitted successfully. Redirecting to your profile.", true);
    
    setTimeout(() => window.location.href = "profile.html", 3000);
  } catch (error) {
    console.error('Submission error:', error);
    statusMsg.textContent = "❌ Error submitting verification. Please try again.";
    speak('Submission failed. Please try again.', true);
  }
});