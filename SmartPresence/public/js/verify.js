// js/verify.js
import { auth, db } from './firebase.js';
import { ref, set, update, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const form = document.getElementById('verifyForm');
const statusMsg = document.getElementById('statusMessage');
const camera = document.getElementById('camera');
const snapshot = document.getElementById('snapshot');
const captureContainer = document.getElementById('captureContainer');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const nextStepBtn = document.getElementById('nextStepBtn');

let capturedImage = null;

/* -----------------------------
   INPUT VALIDATION (ADDED)
----------------------------- */
function setupValidation() {
  // Letters only fields
  ["surname", "firstname", "middlename"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/[^A-Za-z\s]/g, "");
      });
    }
  });

  // Numbers only fields
  ["age", "contact", "idNumber"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/[^0-9]/g, "");
      });
    }
  });

  // ID number limit 15 digits
  const idEl = document.getElementById("idNumber");
  if (idEl) {
    idEl.addEventListener("input", () => {
      if (idEl.value.length > 15) {
        idEl.value = idEl.value.slice(0, 15);
      }
    });
  }

  // Email must contain "@"
  const emailEl = document.getElementById("email");
  if (emailEl) {
    emailEl.addEventListener("input", () => {
      if (!emailEl.value.includes("@")) {
        emailEl.style.border = "1px solid red";
      } else {
        emailEl.style.border = "1px solid #ccc";
      }
    });
  }
}

// Run validation
setupValidation();

/* -----------------------------
   SHOW INLINE ERROR FUNCTION
----------------------------- */
function showError(el, message) {
  let errorEl = el.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains('inline-error')) {
    errorEl = document.createElement('div');
    errorEl.className = 'inline-error';
    errorEl.style.color = 'red';
    errorEl.style.fontSize = '0.85rem';
    errorEl.style.marginTop = '2px';
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

/* -----------------------------
   CONFIRMATION MODAL STEP
----------------------------- */
function createConfirmationModal() {
  const modal = document.createElement('div');
  modal.id = 'confirmationModal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <h2>🧐 Double Check Your Information</h2>
      <p>Please make sure all fields are correctly filled before proceeding to facial verification.</p>
      <div class="modal-buttons">
        <button id="cancelBtn" class="modal-btn cancel">Go Back</button>
        <button id="proceedBtn" class="modal-btn proceed">Proceed</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));

  modal.querySelector('#cancelBtn').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });

  modal.querySelector('#proceedBtn').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
    proceedToFacialStep();
  });
}

/* -----------------------------
   STEP 1 → STEP 2 TRANSITION
----------------------------- */
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
        el.style.border = '1px solid #ccc';
        clearError(el);
      }
    });

    // Email must contain "@"
    const emailEl = document.getElementById('email');
    if (!emailEl.value.includes("@")) {
      emailEl.style.border = "1px solid red";
      showError(emailEl, "Email must contain '@'.");
      valid = false;
    } else {
      clearError(emailEl);
    }

    // ID number 15 digits max
    const idEl = document.getElementById("idNumber");
    if (idEl.value.length === 0 || idEl.value.length > 15) {
      idEl.style.border = "1px solid red";
      showError(idEl, "ID Number must be numbers only and max 15 digits.");
      valid = false;
    } else {
      clearError(idEl);
    }

    // Upload required
    const docFile = document.getElementById('documentUpload').files[0];
    const docEl = document.getElementById('documentUpload');
    if (!docFile) {
      showError(docEl, "Please upload your ID document.");
      valid = false;
    } else {
      clearError(docEl);
    }

    if (!valid) return;

    createConfirmationModal();
  });
}

function proceedToFacialStep() {
  step1.style.display = 'none';
  step2.style.display = 'block';
  speak("Proceeding to facial verification. Please align your face within the circle.");
  startCamera();
}

/* -----------------------------
   FACE API SETUP
----------------------------- */
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/';
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
]).catch(err => {
  console.error("Model loading failed:", err);
  alert("⚠️ Face recognition models failed to load. Please refresh or check console.");
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    camera.srcObject = stream;
    camera.addEventListener('loadedmetadata', () => {
      camera.style.transform = 'scaleX(-1)';
      setTimeout(startFaceDetection, 500);
    });
  } catch (err) {
    console.error("Camera error:", err);
    alert("⚠️ Unable to access camera. Please check permissions.");
  }
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.pitch = 1.05;
  utter.rate = 1;
  speechSynthesis.speak(utter);
}

/* -----------------------------
   FACE DETECTION + CAPTURE
----------------------------- */
async function startFaceDetection() {
  const overlay = document.createElement('canvas');
  overlay.width = camera.videoWidth;
  overlay.height = camera.videoHeight;
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.borderRadius = '50%';
  overlay.style.pointerEvents = 'none';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  captureContainer.querySelector('.camera-frame').appendChild(overlay);

  const ctx = overlay.getContext('2d');
  let scanning = false;
  let lastInstruction = "";

  const detectionLoop = setInterval(async () => {
    const detection = await faceapi.detectSingleFace(camera, new faceapi.TinyFaceDetectorOptions());
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const cx = overlay.width / 2;
    const cy = overlay.height / 2;
    const radius = overlay.height * 0.35;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = scanning ? "rgba(0,255,0,0.9)" : "rgba(0,255,150,0.6)";
    ctx.lineWidth = 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = scanning ? 25 : 10;
    ctx.stroke();
    ctx.closePath();

    let instruction = "Align your face within the circle...";

    if (detection && !scanning) {
      const faceHeight = detection.box.height;

      if (faceHeight < 180) instruction = "Move closer to the camera.";
      else if (faceHeight > 280) instruction = "Move a little farther.";
      else {
        scanning = true;
        instruction = "Scanning your face, please stay still...";
        speak("Scanning your face now, please stay still.");

        startScanAnimation(ctx, overlay, async () => {
          clearInterval(detectionLoop);
          captureFace();
          speak("Facial verification complete.");
          showVerificationMessage(ctx, overlay, "✅ Verification Complete");

          statusMsg.textContent = "✅ Verification Complete! Submitting...";
          await new Promise(r => setTimeout(r, 1500));
          form.requestSubmit();
        });
      }
    }

    ctx.font = "18px Poppins";
    ctx.fillStyle = "#00FF99";
    ctx.textAlign = "center";
    ctx.fillText(instruction, cx, cy + radius + 30);

    if (instruction !== lastInstruction && !scanning) {
      speak(instruction);
      lastInstruction = instruction;
    }
  }, 100);
}

function startScanAnimation(ctx, overlay, onComplete) {
  let progress = 0;
  const radius = overlay.height * 0.35;
  const cx = overlay.width / 2;
  const cy = overlay.height / 2;

  const scan = setInterval(() => {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(0,255,0,0.9)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(0,255,0,0.8)";
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.closePath();

    const scanY = cy - radius + (progress * 2 * radius);
    const grad = ctx.createLinearGradient(0, scanY, 0, scanY + 15);
    grad.addColorStop(0, "rgba(0,255,0,0)");
    grad.addColorStop(0.5, "rgba(0,255,0,0.8)");
    grad.addColorStop(1, "rgba(0,255,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, scanY, radius * 2, 10);

    progress += 0.02;
    if (progress >= 1) {
      clearInterval(scan);
      onComplete();
    }
  }, 25);
}

function showVerificationMessage(ctx, overlay, message) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const cx = overlay.width / 2;
  const cy = overlay.height / 2;
  ctx.font = "22px Poppins";
  ctx.fillStyle = "#00FF66";
  ctx.textAlign = "center";
  ctx.fillText(message, cx, cy);
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
}

/* -----------------------------
   SUBMIT VERIFICATION
----------------------------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    statusMsg.textContent = "⚠️ You must be logged in.";
    return;
  }

  if (!capturedImage) {
    alert("Please complete face verification first.");
    return;
  }

  const docFile = document.getElementById('documentUpload').files[0];
  if (!docFile) {
    alert("Please upload a verification document.");
    return;
  }

  statusMsg.textContent = "⏳ Uploading files...";
  const cloudName = "drctbe4tj";
  const uploadPreset = "smartpresence_upload";

  const uploadToCloudinary = async (fileOrDataUrl) => {
    const formData = new FormData();
    formData.append("file", fileOrDataUrl);
    formData.append("upload_preset", uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, { method: "POST", body: formData });
    return await res.json();
  };

  const [docUpload, faceUpload] = await Promise.all([
    uploadToCloudinary(docFile),
    uploadToCloudinary(capturedImage)
  ]);

  // Get user data from Realtime DB
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
    category: userData.category || "unknown",
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  // Save request and mark user as pending
  await set(ref(db, `verificationRequests/${user.uid}`), formDataObj);
  await update(ref(db, `users/${user.uid}`), {
    verificationStatus: "pending",
    verified: false
  });

  statusMsg.textContent = "✅ Verification submitted successfully! Redirecting...";
  speak("Verification submitted successfully!");
  setTimeout(() => window.location.href = "profile.html", 3000);
});
