import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, onValue, get, set, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const classList = document.getElementById("classList");
const studentPanel = document.getElementById("studentPanel");
const studentList = document.getElementById("studentList");
const panelTitle = document.getElementById("panelTitle");
const panelSchedule = document.getElementById("panelSchedule");
const panelClassCode = document.getElementById("panelClassCode");
const joinClassBtn = document.getElementById("addClassBtn");
const qrScannerBtn = document.getElementById("qrScannerBtn");
const excuseLetterBtn = document.getElementById("excuseLetterBtn");

let currentUser = null;
let currentClassData = null;

// Local notify helper: use global showToast if available, otherwise create a simple toast fallback
function notify(message, type) {
    if (typeof window.showToast === 'function') {
        try { window.showToast(message, type); return; } catch (e) { console.error('notify showToast error', e); }
    }
    let toast = document.querySelector('.global-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'global-toast';
        document.body.appendChild(toast);
        const style = document.createElement('style');
        style.textContent = `
            .global-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%) translateY(100px); padding: 0.9rem 1.2rem; border-radius: 10px; color: #fff; font-weight:600; z-index:20000; opacity:0; transition: all .28s ease; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
            .global-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
            .global-toast.success { background: #16a34a; }
            .global-toast.error { background: #dc2626; }
            .global-toast.info { background: #0ea5e9; }
            .global-toast.default { background: #1e293b; }
        `;
        document.head.appendChild(style);
    }
    toast.textContent = message;
    toast.className = 'global-toast show ' + (type || 'default');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

const joinClassModal = document.getElementById("joinClassModal");
const classCodeInput = document.getElementById("classCodeInput");
const cancelJoin = document.getElementById("cancelJoin");
const confirmJoin = document.getElementById("confirmJoin");

// Show confirmation modal for joining class
function showJoinConfirmation(classData, classId, teacherId, dept) {
    let modal = document.getElementById("joinConfirmModal");
    
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "joinConfirmModal";
        modal.classList.add("modal-overlay");
        modal.innerHTML = `
            <div class="modal-box">
                <h4>Join Class</h4>
                <p id="joinConfirmMessage"></p>
                <div class="modal-actions">
                    <button id="cancelJoinConfirm" class="cancel-btn">Cancel</button>
                    <button id="confirmJoinConfirm" class="confirm-btn">Join Class</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("show");
            }
        });
    }

    const messageEl = modal.querySelector("#joinConfirmMessage");
    messageEl.textContent = `Do you want to join ${classData.sectionName} - ${classData.subjectName}?`;

    modal.classList.add("show");

    const cancelBtn = modal.querySelector("#cancelJoinConfirm");
    const confirmBtn = modal.querySelector("#confirmJoinConfirm");

    // Remove old listeners
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancelBtn);
    confirmBtn.replaceWith(newConfirmBtn);

    newCancelBtn.onclick = () => {
        modal.classList.remove("show");
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
    };

    newConfirmBtn.onclick = async () => {
        try {
            const studentRef = ref(db, `classes/${teacherId}/${dept}/${classId}/students/${currentUser.uid}`);

            const userInfoSnap = await get(ref(db, `verifiedUsers/${currentUser.uid}`));
            let studentName = "Unnamed Student";
            let studentNumber = "N/A";
            
            if (userInfoSnap.exists()) {
                const info = userInfoSnap.val();
                studentName = `${info.firstname} ${info.surname}`;
                studentNumber = info.idNumber || "N/A";
            }

            await set(studentRef, {
                name: studentName,
                studentNumber: studentNumber,
                uid: currentUser.uid
            });

            notify(`Successfully joined ${classData.sectionName} - ${classData.subjectName}!`, 'success');
            modal.classList.remove("show");
            loadJoinedClasses();
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
            console.error(err);
            notify("Unable to join this class. Please try again.", 'error');
        }
    };
}

// 🔐 Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadJoinedClasses();

        // Auto-open class from profile or shared link
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for direct class opening from profile (classId, teacherId, dept)
        const classId = urlParams.get("classId");
        const teacherId = urlParams.get("teacherId");
        const dept = urlParams.get("dept");
        
        // Or check for auto-join via shared link (class, teacher, dept)
        const linkClassId = urlParams.get("class");
        const linkTeacherId = urlParams.get("teacher");
        const linkDept = urlParams.get("dept");

        // If opening directly from profile
        if (classId && teacherId && dept) {
            console.log("Opening class directly from profile:", { classId, teacherId, dept });
            
            // Wait for classes to load in sidebar, then highlight and open
            const maxAttempts = 50; // 5 seconds max
            let attempt = 0;
            const openClassInterval = setInterval(() => {
                attempt++;
                const classItems = document.querySelectorAll(".class-item");
                
                if (classItems.length > 0) {
                    clearInterval(openClassInterval);
                    
                    // Get class data
                    const classRef = ref(db, `classes/${teacherId}/${dept}/${classId}`);
                    get(classRef).then((snapshot) => {
                        if (snapshot.exists()) {
                            const classData = snapshot.val();
                            
                            // Find and highlight the matching class item in sidebar
                            let found = false;
                            classItems.forEach(item => {
                                // Check if this item matches our class
                                const sectionName = item.querySelector(".section-name")?.textContent.trim();
                                const subjectName = item.querySelector(".subject-name")?.textContent.trim();
                                
                                if (sectionName === classData.sectionName && subjectName === classData.subjectName) {
                                    // Remove active class from all items
                                    document.querySelectorAll(".class-item").forEach(i => i.classList.remove("active"));
                                    // Mark this item as active
                                    item.classList.add("active");
                                    found = true;
                                }
                            });
                            
                            // Open the class
                            openStudentClass(classId, classData.sectionName, classData.subjectName, teacherId, dept);
                            // Clear URL parameters
                            window.history.replaceState({}, document.title, window.location.pathname);
                        } else {
                            notify("Class not found.", 'error');
                            window.history.replaceState({}, document.title, window.location.pathname);
                        }
                    }).catch(error => {
                        console.error("Error loading class:", error);
                        notify("Error loading class.", 'error');
                        window.history.replaceState({}, document.title, window.location.pathname);
                    });
                } else if (attempt > maxAttempts) {
                    clearInterval(openClassInterval);
                    console.error("Timeout waiting for classes to load");
                    notify("Timeout loading classes.", 'error');
                }
            }, 100);
        }
        // If auto-joining via shared link
        else if (linkClassId && linkTeacherId && linkDept) {
            try {
                const classPath = `classes/${linkTeacherId}/${linkDept}/${linkClassId}`;
                const classRef = ref(db, classPath);
                const classSnap = await get(classRef);

                if (!classSnap.exists()) {
                    notify("Class not found from shared link.", 'error');
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    // Check if already joined
                    const alreadyJoined = classSnap.val().students && classSnap.val().students[currentUser.uid];
                    
                    if (alreadyJoined) {
                        notify("You have already joined this class.", 'info');
                        window.history.replaceState({}, document.title, window.location.pathname);
                    } else {
                        // Show confirmation modal
                        showJoinConfirmation(classSnap.val(), linkClassId, linkTeacherId, linkDept);
                    }
                }
            } catch (err) {
                console.error(err);
                notify("Unable to join this class. Permission denied or invalid link.", 'error');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        if (joinClassBtn) {
            joinClassBtn.addEventListener("click", () => {
                const currentParams = new URLSearchParams(window.location.search);
                const hasAutoJoinParams = currentParams.get("class") && currentParams.get("teacher") && currentParams.get("dept");
                
                if (!hasAutoJoinParams) {
                    classCodeInput.value = "";
                    joinClassModal.classList.add("show");
                }
            });
        }

        if (cancelJoin) {
            cancelJoin.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                joinClassModal.classList.remove("show");
                classCodeInput.value = "";
            });
        }

        if (confirmJoin) {
            confirmJoin.addEventListener("click", async () => {
                const code = classCodeInput.value.trim();
                if (!code) return notify("Please enter a class code.", 'error');

                const classesRef = ref(db, `classes`);
                const snapshot = await get(classesRef);

                let found = false;

                for (const [teacherId, teacherSnapData] of Object.entries(snapshot.val() || {})) {
                    for (const [deptKey, deptSnap] of Object.entries(teacherSnapData)) {
                        for (const [classKey, classData] of Object.entries(deptSnap)) {

                            if (classKey === code) {
                                found = true;

                                const studentRef = ref(
                                    db,
                                    `classes/${teacherId}/${deptKey}/${classKey}/students/${currentUser.uid}`
                                );

                                const userInfoSnap = await get(ref(db, `verifiedUsers/${currentUser.uid}`));
                                let studentName = "Unnamed Student";
                                let studentNumber = "N/A";
                                
                                if (userInfoSnap.exists()) {
                                    const info = userInfoSnap.val();
                                    studentName = `${info.firstname} ${info.surname}`;
                                    studentNumber = info.idNumber || "N/A";
                                }

                                await set(studentRef, {
                                    name: studentName,
                                    studentNumber: studentNumber,
                                    uid: currentUser.uid
                                });

                                notify(`Joined ${classData.sectionName} - ${classData.subjectName}`, 'success');
                                loadJoinedClasses();
                                break;
                            }
                        }
                        if (found) break;
                    }
                    if (found) break;
                }

                if (!found) notify("Class code not found.", 'error');
                joinClassModal.classList.remove("show");
                classCodeInput.value = "";
            });
        }

        if (joinClassModal) {
            joinClassModal.addEventListener("click", (e) => {
                if (e.target === joinClassModal) {
                    joinClassModal.classList.remove("show");
                    classCodeInput.value = "";
                }
            });
        }

    } else {
        window.location.href = "login.html";
    }
});

// QR Scanner button click
if (qrScannerBtn) {
    qrScannerBtn.addEventListener("click", () => {
        if (!currentClassData) {
            notify("Please select a class first.", 'error');
            return;
        }
        
        const params = new URLSearchParams({
            classId: currentClassData.classId,
            teacherId: currentClassData.teacherId,
            dept: currentClassData.department
        });
        window.location.href = `qr-scanner-student.html?${params.toString()}`;
    });
}

// Excuse Letter button click
if (excuseLetterBtn) {
    excuseLetterBtn.addEventListener("click", () => {
        if (!currentClassData) {
            notify("Please select a class first.", 'error');
            return;
        }
        showExcuseLetterModal();
    });
}

// Show Leave Class Modal
function showLeaveClassModal(sectionName, subjectName, teacherId, department, classId) {
    let modal = document.getElementById("leaveClassModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "leaveClassModal";
        modal.classList.add("modal-overlay");
        modal.innerHTML = `
            <div class="modal-box leave-class-modal">
                <h4>Leave Class</h4>
                <p id="leaveClassMessage">Are you sure you want to leave this class?</p>
                <div class="warning-message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                        <path d="M12 2L2 19.5h20L12 2z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        <path d="M12 9v4M12 17h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>You will lose access to all class materials and attendance records.</span>
                </div>
                <div class="modal-actions">
                    <button id="cancelLeave" class="cancel-btn">Cancel</button>
                    <button id="confirmLeave" class="danger-btn">Leave Class</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("show");
            }
        });
    }

    // Update message with class details
    const messageEl = modal.querySelector("#leaveClassMessage");
    messageEl.textContent = `Are you sure you want to leave ${sectionName} - ${subjectName}?`;

    modal.classList.add("show");

    const cancelBtn = modal.querySelector("#cancelLeave");
    const confirmBtn = modal.querySelector("#confirmLeave");

    // Remove old event listeners by cloning
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancelBtn);
    confirmBtn.replaceWith(newConfirmBtn);

    newCancelBtn.onclick = () => {
        modal.classList.remove("show");
    };

    newConfirmBtn.onclick = async () => {
        const studentRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}`);
        try {
            await set(studentRef, null);
            notify(`You have left ${sectionName} - ${subjectName}`, 'success');
            modal.classList.remove("show");
            studentPanel.classList.remove("visible");
            studentPanel.classList.add("hidden");
            currentClassData = null;
            loadJoinedClasses();
        } catch (err) {
            console.error(err);
            notify("Failed to leave class. Try again.", 'error');
        }
    };
}

// Show Excuse Letter Upload Modal
function showExcuseLetterModal() {
    let modal = document.getElementById("excuseLetterModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "excuseLetterModal";
        modal.classList.add("modal-overlay");
        modal.innerHTML = `
            <div class="modal-box excuse-modal">
                <h4>Submit Excuse Letter</h4>
                <p>Upload your excuse letter for teacher approval</p>
                
                <label style="display:block; margin-bottom:8px; font-weight:500; color:#333;">Select Date:</label>
                <input type="date" id="excuseDate" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #ccc; font-family:'Poppins', sans-serif;">
                
                <label style="display:block; margin-bottom:8px; font-weight:500; color:#333;">Reason:</label>
                <textarea id="excuseReason" placeholder="Enter your reason..." style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #ccc; font-family:'Poppins', sans-serif; min-height:80px; resize:vertical;"></textarea>
                
                <label style="display:block; margin-bottom:8px; font-weight:500; color:#333;">Upload Letter (Image/PDF):</label>
                <input type="file" id="excuseFile" accept="image/*,application/pdf" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #ccc; font-family:'Poppins', sans-serif;">
                
                <div class="modal-actions">
                    <button id="cancelExcuse" class="cancel-btn">Cancel</button>
                    <button id="submitExcuse" class="confirm-btn">Submit</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("show");
            }
        });
    }

    modal.classList.add("show");

    const cancelBtn = modal.querySelector("#cancelExcuse");
    const submitBtn = modal.querySelector("#submitExcuse");
    const dateInput = modal.querySelector("#excuseDate");
    const reasonInput = modal.querySelector("#excuseReason");
    const fileInput = modal.querySelector("#excuseFile");

    cancelBtn.onclick = () => {
        modal.classList.remove("show");
    };

    submitBtn.onclick = async () => {
        // Prevent duplicate submissions
        if (submitBtn.disabled) return;
        
        const date = dateInput.value;
        const reason = reasonInput.value.trim();
        const file = fileInput.files[0];

        if (!date) {
            notify("Please select a date.", 'error');
            return;
        }
        if (!reason) {
            notify("Please enter a reason.", 'error');
            return;
        }
        if (!file) {
            notify("Please upload a letter.", 'error');
            return;
        }

        // Disable button to prevent double submissions
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Submitting...";

        try {
            // Convert file to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const fileData = e.target.result;
                    
                    // Get student info
                    const userInfoSnap = await get(ref(db, `verifiedUsers/${currentUser.uid}`));
                    let studentName = "Unnamed Student";
                    let studentNumber = "N/A";
                    
                    if (userInfoSnap.exists()) {
                        const info = userInfoSnap.val();
                        studentName = `${info.firstname} ${info.surname}`;
                        studentNumber = info.idNumber || "N/A";
                    }

                    // Create excuse letter request - goes directly to teacher (status: pending_teacher)
                    const excuseRef = push(ref(db, 'excuseLetters'));
                    await set(excuseRef, {
                        studentId: currentUser.uid,
                        studentName: studentName,
                        studentNumber: studentNumber,
                        classId: currentClassData.classId,
                        className: `${currentClassData.sectionName} - ${currentClassData.subjectName}`,
                        teacherId: currentClassData.teacherId,
                        department: currentClassData.department,
                        date: date,
                        reason: reason,
                        fileData: fileData,
                        fileName: file.name,
                        fileType: file.type,
                        status: 'pending_teacher',
                        submittedAt: Date.now(),
                        approvedAt: null,
                        approvedBy: null,
                        rejectedAt: null,
                        rejectionReason: null
                    });

                    // Send notification to teacher
                    const notificationRef = push(ref(db, `notifications/${currentClassData.teacherId}`));
                    await set(notificationRef, {
                        title: 'New Excuse Letter',
                        message: `${studentName} submitted an excuse letter for ${date} in ${currentClassData.sectionName} - ${currentClassData.subjectName}`,
                        type: 'excuse_letter',
                        timestamp: Date.now(),
                        read: false,
                        excuseId: excuseRef.key,
                        studentId: currentUser.uid,
                        classId: currentClassData.classId,
                        department: currentClassData.department
                    });

                    notify("Excuse letter submitted successfully! Awaiting teacher approval.", 'success');
                    modal.classList.remove("show");
                    
                    // Clear form
                    dateInput.value = "";
                    reasonInput.value = "";
                    fileInput.value = "";
                } catch (error) {
                    console.error("Error submitting excuse letter:", error);
                    notify("Error submitting excuse letter. Please try again.", 'error');
                } finally {
                    // Re-enable button
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error reading file:", error);
            notify("Error reading file. Please try again.", 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    };
}

// 📦 Load all classes student joined
function loadJoinedClasses() {
    const classesRef = ref(db, `classes`);
    onValue(classesRef, (snapshot) => {
        classList.innerHTML = "";
        snapshot.forEach(teacherSnap => {
            teacherSnap.forEach(deptSnap => {
                deptSnap.forEach(classSnap => {
                    const classData = classSnap.val();
                    if (classData.students && classData.students[currentUser.uid]) {
                        renderClassItem(
                            classSnap.key,
                            classData.sectionName,
                            classData.subjectName,
                            teacherSnap.key,
                            deptSnap.key
                        );
                    }
                });
            });
        });
    });
}

// 🎨 Render class in sidebar
function renderClassItem(classId, sectionName, subjectName, teacherId, department) {
    // Signal that initial dynamic content has been rendered (if navigation helper exists)
    if (window.markContentReady) window.markContentReady();
    const item = document.createElement("div");
    item.classList.add("class-item");
    item.innerHTML = `
        <div class="class-info">
            <strong class="section-name">${sectionName || "Unnamed Section"}</strong><br>
            <small class="subject-name">${subjectName || "No Subject"}</small>
        </div>
    `;
    item.addEventListener("click", () => {
        document.querySelectorAll(".class-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        openStudentClass(classId, sectionName, subjectName, teacherId, department);
    });
    classList.appendChild(item);
}

// 👩‍🏫 Open student's attendance for selected class
async function openStudentClass(classId, sectionName, subjectName, teacherId, department) {
    currentClassData = {
        classId,
        sectionName,
        subjectName,
        teacherId,
        department
    };

    studentPanel.classList.remove("hidden");
    studentPanel.classList.add("visible");
    panelTitle.textContent = `${sectionName} - ${subjectName}`;
    
    const classRef = ref(db, `classes/${teacherId}/${department}/${classId}`);
    get(classRef).then((snapshot) => {
        if (snapshot.exists()) {
            const classData = snapshot.val();
            
            if (classData.schedule) {
                const scheduleArray = Object.values(classData.schedule);
                if (scheduleArray.length > 0) {
                    const scheduleText = scheduleArray.map(s => 
                        `${s.day} ${s.startTime}-${s.endTime}`
                    ).join(", ");
                    panelSchedule.textContent = `Schedule: ${scheduleText}`;
                    panelSchedule.style.display = "inline-block";
                } else {
                    panelSchedule.style.display = "none";
                }
            } else {
                panelSchedule.style.display = "none";
            }
            
            panelClassCode.textContent = `Class Code: ${classId}`;
            panelClassCode.style.display = "block";
        }
    });

    studentList.innerHTML = "<p>Loading your attendance...</p>";

    const existingBtn = studentPanel.querySelector(".leave-class-btn");
    if (existingBtn) existingBtn.remove();

    let leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave Class";
    leaveBtn.classList.add("leave-class-btn");
    leaveBtn.style.cssText = `
        background: #dc2626;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 20px;
        margin: 15px 0;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 14px;
    `;
    leaveBtn.addEventListener("mouseenter", () => {
        leaveBtn.style.background = "#b91c1c";
    });
    leaveBtn.addEventListener("mouseleave", () => {
        leaveBtn.style.background = "#dc2626";
    });
    leaveBtn.addEventListener("click", () => {
        showLeaveClassModal(sectionName, subjectName, teacherId, department, classId);
    });

    studentPanel.appendChild(leaveBtn);

    loadStudentAttendance(teacherId, department, classId);
}

// Load student attendance
async function loadStudentAttendance(teacherId, department, classId) {
    console.log('Loading attendance for:', { teacherId, department, classId, studentId: currentUser.uid });
    
    try {
        const attendanceRef = ref(db, `attendance/${teacherId}/${department}/${classId}`);
        const attendanceSnap = await get(attendanceRef);
        
        console.log('Attendance snapshot exists:', attendanceSnap.exists());
        
        const allDates = attendanceSnap.val();
        
        const studentRecords = {};
        
        if (allDates) {
            Object.keys(allDates).forEach(date => {
                const dateData = allDates[date];
                if (dateData[currentUser.uid]) {
                    studentRecords[date] = dateData[currentUser.uid];
                    console.log(`Found record for ${date}:`, dateData[currentUser.uid]);
                }
            });
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        try {
            const sessionsRef = ref(db, `attendance_sessions/${teacherId}/${department}/${classId}`);
            const sessionsSnap = await get(sessionsRef);
            
            console.log('Sessions snapshot exists:', sessionsSnap.exists());
            
            if (sessionsSnap.exists()) {
                const sessions = sessionsSnap.val();
                
                for (const [sessionId, sessionData] of Object.entries(sessions)) {
                    console.log('Checking session:', sessionId, sessionData);
                    
                    if (sessionData.attendees && sessionData.attendees[currentUser.uid]) {
                        const attendeeData = sessionData.attendees[currentUser.uid];
                        
                        console.log('Found student in session:', attendeeData);
                        
                        if (!studentRecords[today]) {
                            studentRecords[today] = {
                                status: attendeeData.status,
                                timestamp: attendeeData.scanTime || attendeeData.timestamp,
                                method: attendeeData.method || 'qr_scan',
                                faceVerified: attendeeData.faceVerified || false,
                                sessionId: sessionId,
                                pending: true
                            };
                        }
                    }
                }
            }
        } catch (sessionError) {
            console.error('Error loading active sessions:', sessionError);
        }

        console.log('Final student records:', studentRecords);

        if (Object.keys(studentRecords).length === 0) {
            studentList.innerHTML = "<p style='padding: 20px; text-align: center; color: #6b7280;'>No attendance records yet.</p>";
            return;
        }

        studentList.innerHTML = `
            <table class="attendance-table" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Date</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Status</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Method</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Time</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        const tbody = studentList.querySelector("tbody");

        let totalClasses = 0;
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let excusedCount = 0;

        Object.keys(studentRecords).sort().reverse().forEach(date => {
            totalClasses++;
            const record = studentRecords[date];
            const status = record.status || "unknown";
            
            if (status === "present") presentCount++;
            else if (status === "late") lateCount++;
            else if (status === "absent") absentCount++;
            else if (status === "excused") excusedCount++;

            let method = "Manual";
            if (record.method === "qr_scan") method = "QR Code";
            else if (record.method === "face_recognition") method = "Face Recognition";
            else if (record.markedBy === "student") method = "QR/Face";
            else if (record.markedBy === "teacher") method = "Manual";
            
            if (record.faceVerified) {
                method += " ✓";
            }
            
            if (record.pending) {
                method += " (Pending)";
            }

            let timeStr = "-";
            if (record.timestamp) {
                const time = new Date(record.timestamp);
                timeStr = time.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }

            let statusClass = status.toLowerCase();
            let displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

            const row = document.createElement("tr");
            row.style.borderBottom = "1px solid #e5e7eb";
            row.innerHTML = `
                <td style="padding: 12px;">${date}</td>
                <td style="padding: 12px;"><span class="status-badge ${statusClass}" style="
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 500;
                    ${status === 'present' ? 'background: #d1fae5; color: #065f46;' : ''}
                    ${status === 'late' ? 'background: #fef3c7; color: #92400e;' : ''}
                    ${status === 'absent' ? 'background: #fee2e2; color: #991b1b;' : ''}
                    ${status === 'excused' ? 'background: #e0e7ff; color: #3730a3;' : ''}
                ">${displayStatus}</span></td>
                <td style="padding: 12px;">${method}</td>
                <td style="padding: 12px;">${timeStr}</td>
            `;
            tbody.appendChild(row);
        });

        const attended = presentCount + excusedCount;
        const percentage = totalClasses ? Math.round((attended / totalClasses) * 100) : 0;
        
        const existingSummary = studentPanel.querySelector(".attendance-summary");
        if (existingSummary) existingSummary.remove();
        
        const summary = document.createElement("div");
        summary.classList.add("attendance-summary");
        summary.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        summary.innerHTML = `
            <p style="margin: 0 0 15px 0; font-size: 18px;"><strong>Your Attendance: ${percentage}%</strong> (${attended}/${totalClasses} classes)</p>
            <div class="attendance-breakdown" style="display: flex; gap: 15px; flex-wrap: wrap;">
                <span class="stat present" style="padding: 8px 16px; background: #d1fae5; color: #065f46; border-radius: 8px; font-size: 14px; font-weight: 500;">Present: ${presentCount}</span>
                <span class="stat late" style="padding: 8px 16px; background: #fef3c7; color: #92400e; border-radius: 8px; font-size: 14px; font-weight: 500;">Late: ${lateCount}</span>
                <span class="stat absent" style="padding: 8px 16px; background: #fee2e2; color: #991b1b; border-radius: 8px; font-size: 14px; font-weight: 500;">Absent: ${absentCount}</span>
                ${excusedCount > 0 ? `<span class="stat excused" style="padding: 8px 16px; background: #e0e7ff; color: #3730a3; border-radius: 8px; font-size: 14px; font-weight: 500;">Excused: ${excusedCount}</span>` : ''}
            </div>
        `;
        studentPanel.insertBefore(summary, studentList);
        
    } catch (error) {
        console.error('Error loading student attendance:', error);
        studentList.innerHTML = `<p style='padding: 20px; text-align: center; color: #dc2626;'>Error loading attendance: ${error.message}</p>`;
    }
}