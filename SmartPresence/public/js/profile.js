// js/profile.js
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// 🌥️ Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "drctbe4tj";
const CLOUDINARY_UPLOAD_PRESET = "smartpresence_upload";

// DOM elements
const profileNameEl = document.getElementById("profileName");
const profileImageEl = document.getElementById("profileImage");
const logoutBtn = document.getElementById("logoutBtn");
const verifyBtn = document.getElementById("verifyBtn");
const uploadPhotoInput = document.getElementById("uploadPhoto");

// Action buttons
const editInfoBtn = document.getElementById("editInfoBtn");
const changePassBtn = document.getElementById("changePassBtn");
const rightPanel = document.querySelector(".right-panel");

// Initial placeholders
profileNameEl.textContent = "Loading...";
profileImageEl.textContent = "?";

// Store current user data globally
let currentUserData = null;
let currentUserId = null;

// 🌥️ Direct upload to Cloudinary (no widget)
async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();
  return data.secure_url;
}

// 📸 Handle profile picture upload from main profile page (+ button)
if (uploadPhotoInput) {
  uploadPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUserId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      e.target.value = '';
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5000000) {
      showError('Image size must be less than 5MB');
      e.target.value = '';
      return;
    }

    try {
      // Show loading state
      const originalContent = profileImageEl.innerHTML;
      profileImageEl.innerHTML = '<div style="font-size: 12px;">Uploading...</div>';

      // Upload to Cloudinary
      const uploadedUrl = await uploadImageToCloudinary(file);

      // Update Firebase
      const updates = {
        profilePicture: uploadedUrl,
        updatedAt: new Date().toISOString()
      };

      await update(ref(db, `users/${currentUserId}`), updates);
      await update(ref(db, `verifiedUsers/${currentUserId}`), updates);

      // Update display immediately
      profileImageEl.innerHTML = `<img src="${uploadedUrl}" alt="Profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      
      // Update global data
      currentUserData.profilePicture = uploadedUrl;
      
      showSuccess("Profile picture updated successfully!");
      
    } catch (err) {
      console.error("Upload error:", err);
      showError("Failed to upload profile picture. Please try again.");
      
      // Restore original content on error
      if (currentUserData?.profilePicture) {
        profileImageEl.innerHTML = `<img src="${currentUserData.profilePicture}" alt="Profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        const firstname = currentUserData?.firstname?.trim() || "";
        const surname = currentUserData?.surname?.trim() || "";
        const initials = `${firstname.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?";
        profileImageEl.textContent = initials;
      }
    }
    
    // Reset file input
    e.target.value = '';
  });
}

// 🔐 Monitor auth state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUserId = user.uid;

  try {
    // Fetch user data from all possible paths
    const verifyRef = ref(db, `verificationRequests/${user.uid}`);
    const verifiedRef = ref(db, `verifiedUsers/${user.uid}`);
    const userRef = ref(db, `users/${user.uid}`);

    const [verifySnap, verifiedSnap, userSnap] = await Promise.all([
      get(verifyRef),
      get(verifiedRef),
      get(userRef),
    ]);

    const verifyData = verifySnap.exists() ? verifySnap.val() : {};
    const verifiedData = verifiedSnap.exists() ? verifiedSnap.val() : {};
    const userData = userSnap.exists() ? userSnap.val() : {};

    // Merge data (priority: verifiedUsers → verificationRequests → users)
    const data = { ...userData, ...verifyData, ...verifiedData };
    currentUserData = data;
    
    const firstname = data.firstname?.trim() || "";
    const surname = data.surname?.trim() || "";
    const fullName = `${firstname} ${surname}`.trim() || "Unnamed User";

    profileNameEl.textContent = fullName;
    
    // Display profile picture or initials
    if (data.profilePicture) {
      profileImageEl.innerHTML = `<img src="${data.profilePicture}" alt="Profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      const initials = `${firstname.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?";
      profileImageEl.textContent = initials;
    }

    // Determine verification status
    const verificationStatus = data.verificationStatus || "not_verified";

    // Store verification status in sessionStorage for navigation.js
    sessionStorage.setItem("verified", verificationStatus === "verified" ? "true" : "false");

    // Configure verify button
    verifyBtn.disabled = false;
    verifyBtn.classList.remove("pending", "verified", "rejected");

    if (verificationStatus === "verified") {
      verifyBtn.textContent = "VERIFIED";
      verifyBtn.disabled = true;
      verifyBtn.classList.add("verified");
      
      // Load subjects for both students and teachers
      loadUserSubjects(user.uid);
    } else if (verificationStatus === "pending") {
      verifyBtn.textContent = "VERIFICATION PENDING";
      verifyBtn.disabled = true;
      verifyBtn.classList.add("pending");
      
      rightPanel.innerHTML = `
        <h2 class="section-title">My Subjects</h2>
        <div class="subjects-container">
          <p class="no-subjects">Complete verification to view your subjects.</p>
        </div>
      `;
    } else if (verificationStatus === "rejected") {
      verifyBtn.textContent = "REJECTED - REVERIFY";
      verifyBtn.classList.add("rejected");
      verifyBtn.addEventListener("click", () => (window.location.href = "verify.html"));
      
      rightPanel.innerHTML = `
        <h2 class="section-title">My Subjects</h2>
        <div class="subjects-container">
          <p class="no-subjects">Complete verification to view your subjects.</p>
        </div>
      `;
    } else {
      verifyBtn.textContent = "VERIFY YOUR ACCOUNT";
      verifyBtn.addEventListener("click", () => (window.location.href = "verify.html"));
      
      rightPanel.innerHTML = `
        <h2 class="section-title">My Subjects</h2>
        <div class="subjects-container">
          <p class="no-subjects">Complete verification to view your subjects.</p>
        </div>
      `;
    }

    /* 📝 EDIT PERSONAL INFORMATION ---------------------------- */
    editInfoBtn.addEventListener("click", async () => {
      // Block if not verified
      if (verificationStatus !== "verified") {
        const verifyModal = document.getElementById("verifyModal");
        if (verifyModal) {
          verifyModal.style.display = "flex";
        } else {
          showError("⚠️ You must verify your account before editing your personal information.");
        }
        return;
      }

      // Fetch verified user info only
      const verifiedSnap = await get(ref(db, `verifiedUsers/${user.uid}`));
      const info = verifiedSnap.exists() ? verifiedSnap.val() : {};

      rightPanel.innerHTML = `
        <h2 class="section-title">Edit Information</h2>
        <form id="editInfoForm" class="edit-info-form">
          <label>Profile Picture</label>
          <div class="profile-pic-upload" style="margin-bottom: 15px;">
            <div id="previewContainer" style="margin-bottom: 10px;">
              ${info.profilePicture ? `<img id="previewImage" src="${info.profilePicture}" alt="Current" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; display: block;">` : '<div id="previewImage" style="width: 100px; height: 100px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 32px;">?</div>'}
            </div>
            <input type="file" id="editUploadInput" accept="image/*" style="display: none;">
            <button type="button" id="uploadProfilePicBtn" class="upload-btn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Upload New Picture</button>
            <span id="uploadStatus" style="margin-left: 10px; color: #666;"></span>
          </div>

          <label>Surname</label>
          <input type="text" id="editSurname" value="${info.surname || ""}" required>

          <label>First Name</label>
          <input type="text" id="editFirstname" value="${info.firstname || ""}" required>

          <label>Middle Name</label>
          <input type="text" id="editMiddlename" value="${info.middlename || ""}">

          <label>Age</label>
          <input type="number" id="editAge" value="${info.age || ""}" required>

          <label>Address</label>
          <input type="text" id="editAddress" value="${info.address || ""}" required>

          <label>Email</label>
          <input type="email" id="editEmail" value="${info.email || ""}" required>

          <label>Contact</label>
          <input type="text" id="editContact" value="${info.contact || ""}" required>

          <label>ID Number</label>
          <input type="text" id="editIdNumber" value="${info.idNumber || ""}" required>

          <div class="form-buttons">
            <button type="submit" class="save-btn">Save Changes</button>
            <button type="button" class="cancel-btn">Cancel</button>
          </div>
        </form>
      `;

      // Handle direct file upload in edit form
      let uploadedImageUrl = info.profilePicture || null;
      const editUploadInput = document.getElementById("editUploadInput");
      const uploadBtn = document.getElementById("uploadProfilePicBtn");

      uploadBtn.addEventListener("click", () => {
        editUploadInput.click();
      });

      editUploadInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
          document.getElementById("uploadStatus").innerHTML = "❌ Please select an image";
          document.getElementById("uploadStatus").style.color = "#f44336";
          return;
        }

        if (file.size > 5000000) {
          document.getElementById("uploadStatus").innerHTML = "❌ Image too large (max 5MB)";
          document.getElementById("uploadStatus").style.color = "#f44336";
          return;
        }

        try {
          const statusEl = document.getElementById("uploadStatus");
          statusEl.textContent = "Uploading...";
          statusEl.style.color = "#666";
          
          uploadedImageUrl = await uploadImageToCloudinary(file);
          
          statusEl.innerHTML = "✅ Image uploaded!";
          statusEl.style.color = "#4CAF50";
          
          // Update preview
          const previewContainer = document.getElementById("previewContainer");
          previewContainer.innerHTML = `<img id="previewImage" src="${uploadedImageUrl}" alt="New" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; display: block;">`;
          
        } catch (err) {
          console.error("Upload error:", err);
          const statusEl = document.getElementById("uploadStatus");
          statusEl.innerHTML = "❌ Upload failed";
          statusEl.style.color = "#f44336";
        }

        // Reset input
        e.target.value = '';
      });

      rightPanel.querySelector(".cancel-btn").addEventListener("click", () => window.location.reload());

      const form = document.getElementById("editInfoForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedData = {
          surname: document.getElementById("editSurname").value.trim(),
          firstname: document.getElementById("editFirstname").value.trim(),
          middlename: document.getElementById("editMiddlename").value.trim(),
          age: document.getElementById("editAge").value.trim(),
          address: document.getElementById("editAddress").value.trim(),
          email: document.getElementById("editEmail").value.trim(),
          contact: document.getElementById("editContact").value.trim(),
          idNumber: document.getElementById("editIdNumber").value.trim(),
          updatedAt: new Date().toISOString(),
        };

        // CRITICAL: Always preserve profile picture
        if (uploadedImageUrl) {
          updatedData.profilePicture = uploadedImageUrl;
        } else if (info.profilePicture) {
          updatedData.profilePicture = info.profilePicture;
        }

        try {
          // Update both locations
          await update(ref(db, `users/${user.uid}`), updatedData);
          await update(ref(db, `verifiedUsers/${user.uid}`), updatedData);
          
          showSuccess("Information updated successfully!", true);
        } catch (err) {
          console.error("Error updating info:", err);
          showError("Failed to update information. Please try again.");
        }
      });
    });

    /* 🔑 CHANGE PASSWORD ----------------------------- */
    changePassBtn.addEventListener("click", () => {
      rightPanel.innerHTML = `
        <h2 class="section-title">Change Password</h2>
        <form id="changePassForm" class="change-pass-form">
          <label>Current Password</label>
          <input type="password" id="currentPassword" required>

          <label>New Password</label>
          <input type="password" id="newPassword" required minlength="6">

          <label>Confirm New Password</label>
          <input type="password" id="confirmPassword" required minlength="6">

          <div class="form-buttons">
            <button type="submit" class="save-btn">Update Password</button>
            <button type="button" class="cancel-btn">Cancel</button>
          </div>
        </form>
      `;

      rightPanel.querySelector(".cancel-btn").addEventListener("click", () => window.location.reload());

      const form = document.getElementById("changePassForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPass = document.getElementById("currentPassword").value;
        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;

        if (newPass !== confirmPass) {
          showError("Passwords do not match!");
          return;
        }

        try {
          const cred = EmailAuthProvider.credential(user.email, currentPass);
          await reauthenticateWithCredential(user, cred);
          await updatePassword(user, newPass);
          showSuccess("Password updated successfully!", true);
        } catch (err) {
          console.error("Error updating password:", err);
          showError("Incorrect current password or session expired.");
        }
      });
    });

  } catch (error) {
    console.error("Error loading profile:", error);
    profileNameEl.textContent = "Error loading profile";
    profileImageEl.textContent = "?";
  }
});

/* 📚 LOAD USER SUBJECTS/CLASSES (TEACHER OR STUDENT) ---------------------------- */
function loadUserSubjects(userId) {
  rightPanel.innerHTML = `
    <h2 class="section-title">My Subjects</h2>
    <div class="subjects-container">
      <p>Loading your subjects...</p>
    </div>
  `;

  const subjectsContainer = rightPanel.querySelector(".subjects-container");

  const classesRef = ref(db, `classes`);
  onValue(classesRef, (snapshot) => {
    const userClasses = [];
    
    if (!snapshot.exists()) {
      subjectsContainer.innerHTML = "<p class='no-subjects'>No classes found.</p>";
      return;
    }
    
    // Check if user is a teacher (has classes under their UID)
    if (snapshot.hasChild(userId)) {
      const teacherData = snapshot.child(userId).val();
      
      // Load all teacher's classes from all departments
      Object.keys(teacherData).forEach(deptKey => {
        const deptData = teacherData[deptKey];
        Object.keys(deptData).forEach(classKey => {
          const classData = deptData[classKey];
          userClasses.push({
            classId: classKey,
            sectionName: classData.sectionName || "Unnamed Section",
            subjectName: classData.subjectName || "No Subject",
            department: deptKey,
            schedule: classData.schedule || {},
            isTeacher: true,
            studentCount: classData.students ? Object.keys(classData.students).length : 0
          });
        });
      });
    }
    
    // Also check if user is a student (enrolled in any class)
    snapshot.forEach(teacherSnap => {
      teacherSnap.forEach(deptSnap => {
        deptSnap.forEach(classSnap => {
          const classData = classSnap.val();
          if (classData.students && classData.students[userId]) {
            userClasses.push({
              classId: classSnap.key,
              sectionName: classData.sectionName || "Unnamed Section",
              subjectName: classData.subjectName || "No Subject",
              teacherId: teacherSnap.key,
              department: deptSnap.key,
              schedule: classData.schedule || {},
              isTeacher: false
            });
          }
        });
      });
    });
    
    if (userClasses.length === 0) {
      subjectsContainer.innerHTML = "<p class='no-subjects'>You haven't created or joined any classes yet.</p>";
      return;
    }
    
    // Render classes
    subjectsContainer.innerHTML = "";
    userClasses.forEach(cls => {
      const classCard = document.createElement("div");
      classCard.classList.add("subject-card");
      
      // Format schedule
      let scheduleText = "No schedule set";
      if (cls.schedule && Object.keys(cls.schedule).length > 0) {
        const schedules = Object.values(cls.schedule).map(s => 
          `${s.day} ${s.startTime}-${s.endTime}`
        );
        scheduleText = schedules.join(", ");
      }
      
      // Determine which page to link to
      let linkUrl;
      if (cls.isTeacher) {
        linkUrl = `${cls.department}.html?classId=${cls.classId}`;
      } else {
        // For students, pass class info as URL parameters
        linkUrl = `classes-student.html?classId=${cls.classId}&teacherId=${cls.teacherId}&dept=${cls.department}`;
      }
      
      const roleText = cls.isTeacher 
        ? `<span class="role-badge teacher-badge">Teacher</span>${cls.studentCount ? ` • ${cls.studentCount} student${cls.studentCount !== 1 ? 's' : ''}` : ''}` 
        : '<span class="role-badge student-badge">Student</span>';
      
      classCard.innerHTML = `
        <div class="card-header">
          <h3>${cls.sectionName}</h3>
          ${roleText}
        </div>
        <p class="subject-name">${cls.subjectName}</p>
        <p class="department-info">${cls.department}</p>
        <p class="schedule-info">${scheduleText}</p>
        <button class="view-class-btn" onclick="window.location.href='${linkUrl}'">View ${cls.isTeacher ? 'Class' : 'Details'}</button>
      `;
      
      subjectsContainer.appendChild(classCard);
    });
    // Signal that subjects/content are rendered so entering animation can finish
    if (window.markContentReady) window.markContentReady();
  });
}

/* 🎯 Reusable Modals for Success & Error --------------------- */
const successModal = document.getElementById("successModal");
const errorModal = document.getElementById("errorModal");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");
const successOkBtn = document.getElementById("successOkBtn");
const errorOkBtn = document.getElementById("errorOkBtn");

function showSuccess(message, reload = false) {
  successMessage.textContent = message;
  successModal.style.display = "flex";
  successOkBtn.onclick = () => {
    successModal.style.display = "none";
    if (reload) window.location.reload();
  };
}

function showError(message) {
  errorMessage.textContent = message;
  errorModal.style.display = "flex";
  errorOkBtn.onclick = () => (errorModal.style.display = "none");
}

/* 🚪 Logout (with confirmation modal) --------------------- */
const logoutModal = document.getElementById("logoutModal");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

logoutBtn.addEventListener("click", () => {
  logoutModal.style.display = "flex";
  document.body.classList.add("modal-open");
});

cancelLogout.addEventListener("click", () => {
  logoutModal.style.display = "none";
  document.body.classList.remove("modal-open");
});

// Close when clicking outside the modal box
logoutModal.addEventListener('click', (e) => {
  if (e.target === logoutModal) {
    logoutModal.style.display = 'none';
  }
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && logoutModal.style.display === 'flex') {
    logoutModal.style.display = 'none';
  }
});

confirmLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});