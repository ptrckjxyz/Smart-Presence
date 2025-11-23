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

    // Keep placeholders
    document.getElementById("totalAbsences").textContent = absences;
    document.getElementById("totalLates").textContent = lates;

    // Placeholder attendance log
    document.getElementById("logsTableBody").innerHTML =
      `<tr><td colspan="3" style="text-align:center;">No attendance records yet</td></tr>`;

  } catch (error) {
    console.error("Error loading student dashboard:", error);
  }
}

// Load stats when the page loads
loadStudentStats();
