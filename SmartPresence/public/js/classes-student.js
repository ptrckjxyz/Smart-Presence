import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const classList = document.getElementById("classList");
const studentPanel = document.getElementById("studentPanel");
const studentList = document.getElementById("studentList");
const panelTitle = document.getElementById("panelTitle");
const joinClassBtn = document.getElementById("addClassBtn"); // "Join Class"

let currentUser = null;

// ===== Join Class Modal HTML =====
const modalHTML = `
<div id="joinClassModal" class="modal-overlay">
  <div class="modal-box">
    <h4>Join a Class</h4>
    <p>Enter the class code provided by your teacher:</p>
    <input type="text" id="classCodeInput" placeholder="Class Code" style="width:100%; padding:8px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc;">
    <div class="modal-actions">
      <button id="cancelJoin" class="cancel-btn">Cancel</button>
      <button id="confirmJoin" class="confirm-btn">Join</button>
    </div>
  </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

const joinClassModal = document.getElementById("joinClassModal");
const classCodeInput = document.getElementById("classCodeInput");
const cancelJoin = document.getElementById("cancelJoin");
const confirmJoin = document.getElementById("confirmJoin");

// 🔐 Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadJoinedClasses();

        // -----------------------------------------------------------
        // 🔧 FIXED: Auto-join via shared link (Permission Denied fix)
        // -----------------------------------------------------------
        const urlParams = new URLSearchParams(window.location.search);
        const linkClassId = urlParams.get("class");
        const teacherId = urlParams.get("teacher");
        const dept = urlParams.get("dept");

        if (linkClassId && teacherId && dept) {
            try {
                const classPath = `classes/${teacherId}/${dept}/${linkClassId}`;
                const classRef = ref(db, classPath);
                const classSnap = await get(classRef);

                if (!classSnap.exists()) {
                    alert("Class not found from shared link.");
                } else {
                    const studentRef = ref(db, `${classPath}/students/${currentUser.uid}`);

                    await set(studentRef, {
                        name: currentUser.displayName || "Unnamed Student",
                        uid: currentUser.uid
                    });

                    alert(
                        `Successfully joined ${classSnap.val().sectionName} - ${classSnap.val().subjectName} via shared link!`
                    );

                    loadJoinedClasses();
                }
            } catch (err) {
                console.error(err);
                alert("Unable to join this class. Permission denied or invalid link.");
            }
        }

        // ➕ Open modal on click
        joinClassBtn.addEventListener("click", () => {
            if (!linkClassId) {
                classCodeInput.value = "";
                joinClassModal.classList.add("show");
            }
        });

        // Cancel modal
        cancelJoin.addEventListener("click", () => {
            joinClassModal.classList.remove("show");
        });

        // Join class via code
        confirmJoin.addEventListener("click", async () => {
            const code = classCodeInput.value.trim();
            if (!code) return alert("Please enter a class code.");

            const classesRef = ref(db, `classes`);
            const snapshot = await get(classesRef);

            let found = false;

            // Loop through teachers, departments, classes
            for (const [teacherId, teacherSnapData] of Object.entries(snapshot.val() || {})) {
                for (const [deptKey, deptSnap] of Object.entries(teacherSnapData)) {
                    for (const [classKey, classData] of Object.entries(deptSnap)) {

                        if (classKey === code) {
                            found = true;

                            const studentRef = ref(
                                db,
                                `classes/${teacherId}/${deptKey}/${classKey}/students/${currentUser.uid}`
                            );

                            // Fetch verified student name
                            const userInfoSnap = await get(ref(db, `verifiedUsers/${currentUser.uid}`));
                            let studentName = "Unnamed Student";
                            if (userInfoSnap.exists()) {
                                const info = userInfoSnap.val();
                                studentName = `${info.firstname} ${info.surname}`;
                            }

                            await set(studentRef, {
                                name: studentName,
                                uid: currentUser.uid
                            });

                            alert(`Joined ${classData.sectionName} - ${classData.subjectName}`);
                            loadJoinedClasses();
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }

            if (!found) alert("Class code not found.");
            joinClassModal.classList.remove("show");
        });

        joinClassModal.addEventListener("click", (e) => {
            if (e.target === joinClassModal) joinClassModal.classList.remove("show");
        });

    } else {
        window.location.href = "login.html";
    }
});

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
function openStudentClass(classId, sectionName, subjectName, teacherId, department) {
    studentPanel.classList.remove("hidden");
    studentPanel.classList.add("visible");
    panelTitle.textContent = `${sectionName} - ${subjectName}`;
    studentList.innerHTML = "<p>Loading your attendance...</p>";

    // Add Leave Class button
    let leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave Class";
    leaveBtn.classList.add("leave-class-btn");
    leaveBtn.style.margin = "10px 0";
    leaveBtn.addEventListener("click", async () => {
        const confirmLeave = confirm(`Are you sure you want to leave ${sectionName} - ${subjectName}?`);
        if (!confirmLeave) return;

        const studentRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}`);
        try {
            await set(studentRef, null); // Remove student from class
            alert(`You have left ${sectionName} - ${subjectName}`);
            studentPanel.classList.remove("visible");
            studentPanel.classList.add("hidden");
            loadJoinedClasses(); // Refresh class list
        } catch (err) {
            console.error(err);
            alert("Failed to leave class. Try again.");
        }
    });

    // Remove any existing leave button before appending
    const existingBtn = studentPanel.querySelector(".leave-class-btn");
    if (existingBtn) existingBtn.remove();
    studentPanel.appendChild(leaveBtn);

    const attendanceRef = ref(db, `classes/${teacherId}/${department}/${classId}/students/${currentUser.uid}/attendance`);
    onValue(attendanceRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            studentList.innerHTML = "<p>No attendance records yet.</p>";
            return;
        }

        studentList.innerHTML = `
            <table class="attendance-table">
                <thead>
                    <tr><th>Date</th><th>Status</th><th>Evidence</th></tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        const tbody = studentList.querySelector("tbody");

        let totalClasses = 0;
        let attended = 0;

        Object.keys(data).sort().forEach(date => {
            totalClasses++;
            const record = data[date];
            const status = record.status;
            if (status === "present" || status === "excused") attended++;

            const evidence = record.evidenceUrl
                ? `<a href="${record.evidenceUrl}" target="_blank">View</a>`
                : "-";

            let displayStatus = status;
            if (status === "excuse_pending") displayStatus = "Excuse Pending";
            if (status === "absent_rejected") displayStatus = "Absent (Rejected)";

            const row = document.createElement("tr");
            row.innerHTML = `<td>${date}</td><td>${displayStatus}</td><td>${evidence}</td>`;
            tbody.appendChild(row);
        });

        const percentage = totalClasses ? Math.round((attended / totalClasses) * 100) : 0;
        const summary = document.createElement("p");
        summary.classList.add("attendance-summary");
        summary.textContent = `Your Attendance: ${percentage}%`;
        studentPanel.prepend(summary);
    });
}
