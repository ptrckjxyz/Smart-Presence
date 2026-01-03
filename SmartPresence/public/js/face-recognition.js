// js/face-recognition.js - Updated with 4 Departments (ITD, MD, FASD, TED)
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// DOM Elements
const camera = document.getElementById('camera');
const overlay = document.getElementById('overlay');
const snapshot = document.getElementById('snapshot');
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const cameraInstruction = document.getElementById('cameraInstruction');
const statusMessage = document.getElementById('statusMessage');
const cameraSection = document.getElementById('cameraSection');
const resultsSection = document.getElementById('resultsSection');
const successCard = document.getElementById('successCard');
const errorCard = document.getElementById('errorCard');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const classInfo = document.getElementById('classInfo');
const debugPanel = document.getElementById('debugPanel');
const debugInfo = document.getElementById('debugInfo');

// Global Variables
let stream = null;
let isScanning = false;
let detectionInterval = null;
let verifiedStudents = [];
let currentUser = null;
let userMode = null;
let qrData = null;
let authCheckTimeout = null;

// Voice feedback variables
let lastVoiceCommand = "";
let lastVoiceTime = 0;
const voiceDelay = 2000;

// Face API Models URL
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/';

/* ========================================
   VOICE FEEDBACK SYSTEM
======================================== */

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
        
        debug(`🔊 Voice: ${text}`);
    }
}

/* ========================================
   BACKGROUND STATE MANAGEMENT
======================================== */

function setBackgroundState(state) {
    document.body.classList.remove('scanning-active', 'face-detected', 'face-analyzing', 'face-verified', 'face-error');
    
    if (state) {
        document.body.classList.add(state);
        debug(`🎨 Background state: ${state}`);
    }
}

function setCameraFrameState(state) {
    const cameraFrame = document.querySelector('.camera-frame');
    const scanGuide = document.querySelector('.scan-guide');
    
    if (cameraFrame) {
        cameraFrame.classList.remove('scanning', 'analyzing', 'verified', 'error');
    }
    if (scanGuide) {
        scanGuide.classList.remove('detecting', 'analyzing', 'verified', 'error');
    }
    
    if (state) {
        if (cameraFrame) cameraFrame.classList.add(state);
        
        if (state === 'scanning' && scanGuide) {
            scanGuide.classList.add('detecting');
        } else if (scanGuide) {
            scanGuide.classList.add(state);
        }
        debug(`🎯 Camera frame state: ${state}`);
    }
}

/* ========================================
   INITIALIZATION
======================================== */

async function init() {
    try {
        showLoading('Checking authentication...');

        authCheckTimeout = setTimeout(() => {
            console.error('❌ Authentication timeout - Firebase not responding');
            hideLoading();
            showStatus('error', 'Connection timeout. Please check your internet connection.');
            speakInstruction('Connection error. Please check your internet and try again.', true);
        }, 10000);

        await checkAuth();
        clearTimeout(authCheckTimeout);

        const urlParams = new URLSearchParams(window.location.search);
        const qrDataParam = urlParams.get('data');
        
        if (qrDataParam) {
            userMode = 'student';
            qrData = JSON.parse(decodeURIComponent(qrDataParam));
            debug('🎓 STUDENT MODE - Processing QR attendance');
            debug(`Student: ${currentUser.email}`);
            
            await initStudentMode();
        } else {
            userMode = 'teacher';
            debug('👨‍🏫 TEACHER MODE - Manual face scanning');
            debug(`Teacher: ${currentUser.email}`);
            
            await initTeacherMode();
        }

        showLoading('Loading facial recognition models...');
        await loadFaceModels();

        showLoading('Loading student data...');
        await loadVerifiedStudents();

        hideLoading();
        showStatus('success', `Ready to scan. ${verifiedStudents.length} students loaded.`);
        speakInstruction('System ready. Click start scanning to begin.', true);

    } catch (error) {
        clearTimeout(authCheckTimeout);
        console.error('Initialization error:', error);
        hideLoading();
        showStatus('error', 'System initialization failed: ' + error.message);
        speakInstruction('System initialization failed. Please refresh the page.', true);
    }
}

async function checkAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.log('❌ Not authenticated, redirecting to login...');
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `index.html?returnUrl=${returnUrl}`;
                reject(new Error('Not authenticated'));
                return;
            }
            
            currentUser = user;
            console.log('✅ User authenticated:', currentUser.uid);
            debug(`Authenticated as: ${user.email}`);
            
            const urlParams = new URLSearchParams(window.location.search);
            const qrDataParam = urlParams.get('data');
            
            if (qrDataParam) {
                console.log('🎓 Student mode detected, checking verification...');
                
                const verifiedSnapshot = await get(ref(db, `verifiedUsers/${currentUser.uid}`));
                const verifyRequestSnapshot = await get(ref(db, `verificationRequests/${currentUser.uid}`));
                
                let verificationStatus = "not_verified";
                
                if (verifiedSnapshot.exists()) {
                    verificationStatus = verifiedSnapshot.val().verificationStatus || "not_verified";
                } else if (verifyRequestSnapshot.exists()) {
                    verificationStatus = verifyRequestSnapshot.val().verificationStatus || "not_verified";
                }
                
                const isVerified = verificationStatus === "verified";
                
                if (!isVerified) {
                    console.log('❌ User not verified, redirecting...');
                    sessionStorage.setItem('verificationMessage', 'Please verify your account before using face recognition attendance.');
                    sessionStorage.setItem('pendingReturnUrl', window.location.href);
                    window.location.href = 'profile.html';
                    reject(new Error('User not verified'));
                    return;
                }
                
                console.log('✅ User verified, proceeding...');
            }
            
            resolve(user);
        }, (error) => {
            console.error('❌ Auth error:', error);
            reject(error);
        });
    });
}

async function initTeacherMode() {
    const urlParams = new URLSearchParams(window.location.search);
    let department = urlParams.get('dept');
    const classId = urlParams.get('classId');

    if (!department || !classId) {
        throw new Error('Missing class information');
    }

    const departmentMap = {
        'IT': 'ITD',
        'ITD': 'ITD',
        'MD': 'MD',
        'FASD': 'FASD',
        'TED': 'TED'
    };

    const firebaseDept = departmentMap[department.toUpperCase()] || department;
    
    debug(`Loading class: ${department} -> ${firebaseDept} - ${classId}`);
    
    const classRef = ref(db, `classes/${currentUser.uid}/${firebaseDept}/${classId}`);
    const snapshot = await get(classRef);

    if (snapshot.exists()) {
        const classData = snapshot.val();
        classInfo.innerHTML = `
            <span class="class-name">${classData.sectionName} - ${classData.subjectName}</span>
            <span class="mode-badge teacher">Teacher Mode</span>
        `;
        debug('✅ Teacher mode initialized');
    } else {
        debug(`❌ Class not found at: classes/${currentUser.uid}/${firebaseDept}/${classId}`);
        
        const allClassesRef = ref(db, `classes/${currentUser.uid}/${firebaseDept}`);
        const allClassesSnap = await get(allClassesRef);
        
        if (allClassesSnap.exists()) {
            debug(`Available classes in ${firebaseDept}:`);
            Object.keys(allClassesSnap.val()).forEach(key => {
                debug(`  - ${key}`);
            });
        }
        
        throw new Error('Class not found');
    }
}

async function initStudentMode() {
    if (!qrData.teacherId || !qrData.classId || !qrData.department || !qrData.sessionId) {
        throw new Error('Invalid QR code data');
    }

    if (qrData.type !== 'attendance') {
        throw new Error('This is not an attendance QR code');
    }

    if (qrData.mode !== 'faceRecognition') {
        throw new Error('This QR code is not for face recognition mode');
    }

    debug(`Loading class from QR: ${qrData.department} - ${qrData.classId}`);
    
    const classRef = ref(db, `classes/${qrData.teacherId}/${qrData.department}/${qrData.classId}`);
    const snapshot = await get(classRef);

    if (!snapshot.exists()) {
        throw new Error('Class not found');
    }

    const classData = snapshot.val();
    
    const studentRef = ref(db, `classes/${qrData.teacherId}/${qrData.department}/${qrData.classId}/students/${currentUser.uid}`);
    const studentSnap = await get(studentRef);
    
    if (!studentSnap.exists()) {
        throw new Error('You are not enrolled in this class');
    }
    
    const sessionRef = ref(db, `attendance_sessions/${qrData.teacherId}/${qrData.department}/${qrData.classId}/${qrData.sessionId}`);
    const sessionSnap = await get(sessionRef);
    
    if (!sessionSnap.exists()) {
        throw new Error('Attendance session not found or has expired');
    }
    
    const sessionData = sessionSnap.val();
    
    if (!sessionData.active) {
        throw new Error('This attendance session has ended');
    }
    
    classInfo.innerHTML = `
        <span class="class-name">${classData.sectionName} - ${classData.subjectName}</span>
        <span class="mode-badge student">Student Self-Check</span>
    `;
    debug('✅ Student mode initialized');
}

async function loadFaceModels() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        debug('✅ Face models loaded successfully');
    } catch (error) {
        console.error('Error loading face models:', error);
        throw new Error('Failed to load facial recognition models');
    }
}

async function loadVerifiedStudents() {
    try {
        let studentsRef, teacherId, department, classId;

        if (userMode === 'teacher') {
            const urlParams = new URLSearchParams(window.location.search);
            let deptParam = urlParams.get('dept');
            classId = urlParams.get('classId');
            teacherId = currentUser.uid;
            
            const departmentMap = {
                'IT': 'ITD',
                'ITD': 'ITD',
                'MD': 'MD',
                'FASD': 'FASD',
                'TED': 'TED'
            };
            
            department = departmentMap[deptParam.toUpperCase()] || deptParam;
        } else {
            teacherId = qrData.teacherId;
            department = qrData.department;
            classId = qrData.classId;
        }

        studentsRef = ref(db, `classes/${teacherId}/${department}/${classId}/students`);
        const studentsSnap = await get(studentsRef);

        if (!studentsSnap.exists()) {
            throw new Error('No students enrolled in this class');
        }

        const students = studentsSnap.val();
        verifiedStudents = [];

        for (const [studentId, studentData] of Object.entries(students)) {
            try {
                const userRef = ref(db, `verifiedUsers/${studentId}`);
                const userSnap = await get(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.val();
                    
                    if (userData.faceDescriptor && 
                        (Array.isArray(userData.faceDescriptor) || typeof userData.faceDescriptor === 'object') &&
                        Object.keys(userData.faceDescriptor).length === 128) {
                        
                        verifiedStudents.push({
                            uid: studentId,
                            name: studentData.name || `${userData.firstname} ${userData.surname}`,
                            studentNumber: userData.idNumber || 'N/A',
                            faceDescriptor: userData.faceDescriptor,
                            email: userData.email || 'N/A'
                        });
                        
                        debug(`✅ Loaded face data for: ${userData.firstname} ${userData.surname} (${Object.keys(userData.faceDescriptor).length} dimensions)`);
                    } else {
                        debug(`⚠️ Warning: ${studentData.name} has invalid face descriptor (length: ${userData.faceDescriptor ? Object.keys(userData.faceDescriptor).length : 0})`);
                    }
                } else {
                    debug(`⚠️ Warning: User data not found for student ID: ${studentId}`);
                }
            } catch (error) {
                console.error(`Error loading face data for student ${studentId}:`, error);
            }
        }

        if (verifiedStudents.length === 0) {
            throw new Error('No students with facial data found.');
        }

        debug(`✅ Successfully loaded ${verifiedStudents.length} students with facial data`);

    } catch (error) {
        console.error('Error loading students:', error);
        throw error;
    }
}

/* ========================================
   CAMERA CONTROLS
======================================== */

async function startCamera() {
    try {
        showLoading('Starting camera...');
        speakInstruction('Starting camera');
        
        // ✅ FIX: Mobile-friendly camera constraints with fallback
        const constraints = {
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            console.warn('⚠️ Detailed constraints failed, trying simple mode:', err);
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        }

        camera.srcObject = stream;
        
        await new Promise((resolve, reject) => {
            camera.onloadedmetadata = () => {
                camera.play()
                    .then(resolve)
                    .catch(reject);
            };
            setTimeout(() => reject(new Error('Camera load timeout')), 5000);
        });

        overlay.width = camera.videoWidth;
        overlay.height = camera.videoHeight;

        hideLoading();
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-flex';
        
        setBackgroundState('scanning-active');
        setCameraFrameState('scanning');
        
        speakInstruction('Position your face within the circle', true);
        
        setTimeout(() => {
            startFaceDetection();
        }, 500);
        
    } catch (error) {
        console.error('Camera error:', error);
        hideLoading();
        showStatus('error', 'Unable to access camera. Please check permissions.');
        speakInstruction('Camera access denied. Please check permissions.', true);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

    isScanning = false;
    camera.srcObject = null;
    
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    startScanBtn.style.display = 'inline-flex';
    stopScanBtn.style.display = 'none';
    cameraInstruction.textContent = 'Camera stopped';
    
    setBackgroundState(null);
    setCameraFrameState(null);
}

/* ========================================
   FACE DETECTION & RECOGNITION
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

            if (detection) {
                const box = detection.detection.box;
                
                ctx.strokeStyle = "#00ff88";
                ctx.lineWidth = 2;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                const bracketSize = 20;
                ctx.strokeStyle = "#00ff88";
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                ctx.moveTo(box.x + bracketSize, box.y);
                ctx.lineTo(box.x, box.y);
                ctx.lineTo(box.x, box.y + bracketSize);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(box.x + box.width - bracketSize, box.y);
                ctx.lineTo(box.x + box.width, box.y);
                ctx.lineTo(box.x + box.width, box.y + bracketSize);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(box.x, box.y + box.height - bracketSize);
                ctx.lineTo(box.x, box.y + box.height);
                ctx.lineTo(box.x + bracketSize, box.y + box.height);
                ctx.stroke();
                
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
                    stableFrames++;
                    
                    if (stableFrames >= requiredStableFrames && !scanningFace) {
                        instruction = "Perfect! Scanning now...";
                        newInstructionClass = "success";
                        speakInstruction('Perfect position. Scanning now.', true);
                        
                        setBackgroundState('face-analyzing');
                        setCameraFrameState('analyzing');
                        
                        setTimeout(async () => {
                            await performFaceRecognition(detection);
                        }, 500);
                        
                        scanningFace = true;
                    } else if (!scanningFace) {
                        instruction = "Hold still...";
                        newInstructionClass = "success";
                    }
                }
            } else {
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

async function performFaceRecognition(detection) {
    isScanning = false;
    showLoading('Recognizing face...');

    try {
        // ✅ FIX: Validate detection quality
        const score = detection.detection.score;
        debug(`📊 Detection confidence: ${(score * 100).toFixed(1)}%`);
        
        if (score < 0.5) {
            throw new Error('Face detection quality too low. Please ensure good lighting and face the camera directly.');
        }
        
        const descriptor = detection.descriptor;
        
        debug(`📊 Current face descriptor: length=${descriptor.length}`);
        debug(`   Sample values: [${Array.from(descriptor).slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);
        
        const labeledDescriptors = verifiedStudents.map(student => {
            let descriptorArray;
            if (Array.isArray(student.faceDescriptor)) {
                descriptorArray = student.faceDescriptor;
            } else {
                descriptorArray = Object.values(student.faceDescriptor);
            }
            
            // ✅ FIX: Proper Float32Array conversion with validation
            const storedDescriptor = new Float32Array(
                descriptorArray.map(v => {
                    const num = parseFloat(v);
                    return isNaN(num) ? 0 : num;
                })
            );
            
            if (storedDescriptor.length !== 128) {
                debug(`⚠️ Invalid descriptor length for ${student.name}: ${storedDescriptor.length}`);
            }
            
            debug(`   Loading ${student.name}: ${storedDescriptor.length} dims`);
            
            return new faceapi.LabeledFaceDescriptors(
                student.uid,
                [storedDescriptor]
            );
        });

        // ✅ FIX: Adjusted threshold to 0.58 for better balance
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.58);
        const match = faceMatcher.findBestMatch(descriptor);

        debug(`🎯 Match result: ${match.label}`);
        debug(`   Distance: ${match.distance.toFixed(3)} (threshold: 0.58)`);
        debug(`   Confidence: ${((1 - match.distance) * 100).toFixed(1)}%`);
        
        // ✅ FIX: Log top 3 matches for debugging
        const allMatches = verifiedStudents.map(student => {
            const storedDesc = Array.isArray(student.faceDescriptor) 
                ? student.faceDescriptor 
                : Object.values(student.faceDescriptor);
            const distance = faceapi.euclideanDistance(descriptor, storedDesc);
            return { student, distance };
        }).sort((a, b) => a.distance - b.distance);
        
        debug(`📋 Top 3 closest matches:`);
        allMatches.slice(0, 3).forEach((item, idx) => {
            const conf = ((1 - item.distance) * 100).toFixed(1);
            debug(`   ${idx + 1}. ${item.student.name}: ${item.distance.toFixed(3)} (${conf}%)`);
        });

        if (match.label !== 'unknown') {
            const student = verifiedStudents.find(s => s.uid === match.label);
            const confidence = ((1 - match.distance) * 100).toFixed(1);
            
            debug(`✅ MATCH FOUND: ${student.name} with ${confidence}% confidence`);
            
            // ✅ FIX: Strict identity validation for student mode
            if (userMode === 'student' && student.uid !== currentUser.uid) {
                debug('❌ Face mismatch - not the logged-in student');
                debug(`   Detected: ${student.uid} (${student.name})`);
                debug(`   Expected: ${currentUser.uid} (${currentUser.email})`);
                setBackgroundState('face-error');
                setCameraFrameState('error');
                speakInstruction('Identity mismatch detected. Please scan your own face.', true);
                showErrorResult(`Face recognized as ${student.name}, but you are logged in as a different student. Please scan your own registered face.`);
                return;
            }
            
            try {
                // ✅ Record attendance
                await recordAttendance(student, confidence);
                setBackgroundState('face-verified');
                setCameraFrameState('verified');
                speakInstruction(`Face verified. Welcome ${student.name.split(' ')[0]}.`, true);
                showSuccessResult(student, confidence);
            } catch (attendanceError) {
                if (attendanceError.message.includes('already recorded') || 
                    attendanceError.message.includes('already marked') ||
                    attendanceError.message === 'ALREADY_MARKED') {
                    console.log('✅ Handling already marked attendance');
                    setBackgroundState('face-verified');
                    setCameraFrameState('verified');
                    speakInstruction(`Welcome back ${student.name.split(' ')[0]}. Your attendance is already recorded.`, true);
                    showAlreadyRecordedResult(student);
                } else {
                    throw attendanceError;
                }
            }
        } else {
            debug('❌ NO MATCH - Face not recognized');
            setBackgroundState('face-error');
            setCameraFrameState('error');
            speakInstruction('Face not recognized. Please try again.', true);
            showErrorResult('Face not recognized. Please try again or contact your instructor.');
        }

    } catch (error) {
        console.error('Recognition error:', error);
        setBackgroundState('face-error');
        setCameraFrameState('error');
        speakInstruction('Recognition error occurred. Please try again.', true);
        showErrorResult('Recognition failed: ' + error.message);
    } finally {
        hideLoading();
        stopCamera();
    }
}

/* ========================================
   ATTENDANCE RECORDING
======================================== */

async function recordAttendance(student, confidence) {
    try {
        let attendanceRef, attendanceData;
        const now = new Date();
        const timestamp = now.toISOString();

        if (userMode === 'teacher') {
            const dateKey = now.toISOString().split('T')[0];
            const urlParams = new URLSearchParams(window.location.search);
            let deptParam = urlParams.get('dept');
            const classId = urlParams.get('classId');
            
            const departmentMap = {
                'IT': 'ITD',
                'ITD': 'ITD',
                'MD': 'MD',
                'FASD': 'FASD',
                'TED': 'TED'
            };
            
            const department = departmentMap[deptParam.toUpperCase()] || deptParam;

            attendanceRef = ref(db, `attendance/${currentUser.uid}/${department}/${classId}/${dateKey}/${student.uid}`);
            
            const existingAttendance = await get(attendanceRef);
            if (existingAttendance.exists()) {
                throw new Error('Attendance already recorded for this student today');
            }

            attendanceData = {
                studentId: student.uid,
                studentName: student.name,
                studentNumber: student.studentNumber,
                status: 'present',
                method: 'facial-recognition',
                confidence: confidence,
                timestamp: timestamp,
                markedBy: currentUser.uid,
                markedByName: currentUser.email
            };

        } else {
            const { teacherId, classId, department, sessionId } = qrData;

            const sessionRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}`);
            const sessionSnap = await get(sessionRef);

            if (!sessionSnap.exists()) {
                throw new Error('Attendance session not found');
            }

            const sessionData = sessionSnap.val();

            if (!sessionData.active) {
                throw new Error('This attendance session has ended');
            }

            const nowMs = Date.now();
            const sessionStart = sessionData.startTime;
            const timeLimit = sessionData.timeLimit || 10;
            const graceTime = sessionData.graceTime || 5;
            const timeLimitMs = timeLimit * 60 * 1000;
            const totalTimeMs = (timeLimit + graceTime) * 60 * 1000;
            const elapsed = nowMs - sessionStart;

            if (elapsed > totalTimeMs) {
                throw new Error('Attendance window has closed');
            }

            const status = elapsed <= timeLimitMs ? 'present' : 'late';

            attendanceRef = ref(db, 
                `attendance_sessions/${teacherId}/${department}/${classId}/${sessionId}/attendees/${student.uid}`
            );
            const attendeeSnap = await get(attendanceRef);

            if (attendeeSnap.exists()) {
                throw new Error('You have already marked your attendance for this session');
            }

            attendanceData = {
                name: student.name,
                studentNumber: student.studentNumber,
                scanTime: nowMs,
                status: status,
                faceVerified: true,
                faceConfidence: confidence,
                method: 'face_recognition'
            };
        }

        await set(attendanceRef, attendanceData);

        debug('✅ Attendance recorded successfully');

    } catch (error) {
        console.error('Error recording attendance:', error);
        throw error;
    }
}

/* ========================================
   UI FUNCTIONS
======================================== */

function showSuccessResult(student, confidence) {
    console.log('✅ Showing success result');
    
    cameraSection.style.display = 'none';
    resultsSection.style.display = 'block';
    successCard.style.display = 'block';
    errorCard.style.display = 'none';

    const statusText = userMode === 'teacher' ? 'Attendance Recorded' : 'Face Verified - Attendance Marked';

    document.getElementById('studentInfo').innerHTML = `
        <p><strong>${statusText}</strong></p>
        <p><strong>Name:</strong> <span>${student.name}</span></p>
        <p><strong>Student Number:</strong> <span>${student.studentNumber}</span></p>
        <p><strong>Time:</strong> <span>${new Date().toLocaleTimeString()}</span></p>
    `;

    document.getElementById('matchConfidence').innerHTML = `
        <p>Match Confidence: <strong>${confidence}%</strong></p>
    `;

    const resetBtn = document.querySelector('button[onclick="resetScan()"]');
    if (resetBtn && userMode === 'student') {
        resetBtn.style.display = 'none';
    }

    // ✅ FIX: For student mode, stop camera and redirect immediately
    if (userMode === 'student') {
        console.log('🎓 Student mode - stopping camera and preparing redirect...');
        
        // Stop camera immediately
        stopCamera();
        
        // Clear all session storage
        sessionStorage.removeItem('pendingQRData');
        sessionStorage.removeItem('verificationMessage');
        sessionStorage.removeItem('pendingReturnUrl');
        
        // Redirect after showing success message
        setTimeout(() => {
            console.log('✅ Redirecting student to classes-student.html');
            window.location.replace('classes-student.html');
        }, 1500);
    }
}

function showAlreadyRecordedResult(student) {
    console.log('ℹ️ Showing already marked result');
    
    cameraSection.style.display = 'none';
    resultsSection.style.display = 'block';
    successCard.style.display = 'block';
    errorCard.style.display = 'none';

    document.getElementById('studentInfo').innerHTML = `
        <p><strong>✅ Already Checked In!</strong></p>
        <p><strong>Name:</strong> <span>${student.name}</span></p>
        <p><strong>Student Number:</strong> <span>${student.studentNumber}</span></p>
        <p style="margin-top: 15px; color: #00d084; font-size: 14px;">📋 Your attendance has already been recorded for today. Have a great class!</p>
    `;

    document.getElementById('matchConfidence').innerHTML = `
        <p style="color: #666; font-size: 13px;">No need to scan again - you're all set! 👍</p>
    `;

    const resetBtn = document.querySelector('button[onclick="resetScan()"]');
    if (resetBtn && userMode === 'student') {
        resetBtn.style.display = 'none';
    }

    // ✅ FIX: For student mode, stop camera and redirect immediately
    if (userMode === 'student') {
        console.log('🎓 Student mode - already marked, preparing redirect...');
        
        // Stop camera immediately
        stopCamera();
        
        // Clear all session storage
        sessionStorage.removeItem('pendingQRData');
        sessionStorage.removeItem('verificationMessage');
        sessionStorage.removeItem('pendingReturnUrl');
        
        // Redirect after showing message
        setTimeout(() => {
            console.log('✅ Redirecting student to classes-student.html');
            window.location.replace('classes-student.html');
        }, 1500);
    }
}

function showErrorResult(message) {
    cameraSection.style.display = 'none';
    resultsSection.style.display = 'block';
    successCard.style.display = 'none';
    errorCard.style.display = 'block';

    document.getElementById('errorMessage').textContent = message;
}

function showStatus(type, message) {
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    statusMessage.textContent = message;
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

function showLoading(message) {
    loadingText.textContent = message;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function debug(message) {
    console.log(message);
    if (debugInfo) {
        const timestamp = new Date().toLocaleTimeString();
        debugInfo.innerHTML += `<div>[${timestamp}] ${message}</div>`;
        debugInfo.scrollTop = debugInfo.scrollHeight;
    }
}

/* ========================================
   NAVIGATION FUNCTIONS
======================================== */

window.goBack = function() {
    console.log('🔙 Go Back clicked');
    stopCamera();
    
    if (userMode === 'teacher') {
        const urlParams = new URLSearchParams(window.location.search);
        let department = urlParams.get('dept');
        
        if (department) {
            const departmentPageMap = {
                'IT': 'itd',
                'ITD': 'itd',
                'MD': 'md',
                'FASD': 'fasd',
                'TED': 'ted'
            };
            
            const pageName = departmentPageMap[department.toUpperCase()] || department.toLowerCase();
            window.location.href = `${pageName}.html`;
        } else {
            window.location.href = 'itd.html';
        }
    } else {
        console.log('✅ Redirecting student to classes-student.html');
        window.location.href = 'classes-student.html';
    }
};

window.retryFaceScan = function() {
    console.log('🔄 Retry Face Scan clicked');
    
    resultsSection.style.display = 'none';
    cameraSection.style.display = 'block';
    successCard.style.display = 'none';
    errorCard.style.display = 'none';
    
    setBackgroundState(null);
    setCameraFrameState(null);
    
    showStatus('info', 'Ready to scan. Position your face in the circle.');
    speakInstruction('Ready to scan. Position your face in the circle.', true);
    
    startCamera();
};

window.resetScan = function() {
    console.log('🔄 Reset Scan clicked');
    
    resultsSection.style.display = 'none';
    cameraSection.style.display = 'block';
    successCard.style.display = 'none';
    errorCard.style.display = 'none';
    
    setBackgroundState(null);
    setCameraFrameState(null);
    
    if (userMode === 'teacher') {
        showStatus('info', 'Ready to scan next student');
        speakInstruction('Ready for next scan', true);
    } else {
        console.log('✅ Redirecting student to classes-student.html');
        stopCamera();
        window.location.href = 'classes-student.html';
    }
};

/* ========================================
   EVENT LISTENERS
======================================== */

startScanBtn.addEventListener('click', startCamera);
stopScanBtn.addEventListener('click', () => {
    stopCamera();
    speakInstruction('Scanning stopped', true);
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    }
});

window.addEventListener('beforeunload', () => {
    console.log('🛑 Page unloading, stopping camera');
    stopCamera();
});

/* ========================================
   START APPLICATION
======================================== */

init();