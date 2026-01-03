// attendance-methods.js
// Handles QR Code and Facial Recognition attendance methods

let currentSelectedClassId = null;
let currentDepartment = null;

// Function to set the current class ID (called from classes.js)
export function setCurrentClassId(classId, dept = null) {
  currentSelectedClassId = classId;
  if (dept) {
    currentDepartment = dept;
  }
  console.log(`Class selected: ${classId}, Department: ${dept || currentDepartment}`);
}

// Initialize buttons after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const qrCodeBtn = document.getElementById("qrCodeBtn");
  const faceRecogBtn = document.getElementById("faceRecogBtn");

  // QR Code Attendance Handler
  if (qrCodeBtn) {
    qrCodeBtn.addEventListener("click", () => {
      if (!currentSelectedClassId) {
        showToast("Please select a class first");
        return;
      }

      // Get department
      const department = currentDepartment || detectDepartment();
      
      if (!department) {
        showToast("Unable to detect department. Please try again.");
        return;
      }
      
      console.log(`Navigating to QR attendance for ${department} - ${currentSelectedClassId}`);
      
      // Redirect to QR code page with class information
      window.location.href = `qr-attendance.html?dept=${encodeURIComponent(department)}&classId=${encodeURIComponent(currentSelectedClassId)}`;
    });
  }

  // Facial Recognition Attendance Handler
  if (faceRecogBtn) {
    faceRecogBtn.addEventListener("click", () => {
      if (!currentSelectedClassId) {
        showToast("Please select a class first");
        return;
      }

      // Get department
      const department = currentDepartment || detectDepartment();
      
      if (!department) {
        showToast("Unable to detect department. Please try again.");
        return;
      }
      
      console.log(`Navigating to Face Recognition for ${department} - ${currentSelectedClassId}`);
      
      // Redirect to facial recognition page with class information
      window.location.href = `face-recognition.html?dept=${encodeURIComponent(department)}&classId=${encodeURIComponent(currentSelectedClassId)}`;
    });
  }
});

// Detect department from filename or URL
function detectDepartment() {
  // First try to get from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deptFromUrl = urlParams.get('dept');
  if (deptFromUrl) {
    return deptFromUrl;
  }
  
  // Try to get from filename
  const fileName = window.location.pathname.split("/").pop().split(".")[0];
  
  // Map common page names to departments
  const departmentMap = {
    'dcit21': 'DCIT21',
    'dcit65': 'DCIT65',
    'bscs': 'BSCS',
    'bsit': 'BSIT',
    'it': 'IT',
    'cs': 'CS'
  };
  
  const lowerFileName = fileName.toLowerCase();
  
  // Check if filename matches any department code
  for (const [key, value] of Object.entries(departmentMap)) {
    if (lowerFileName.includes(key)) {
      return value;
    }
  }
  
  // Default to extracting uppercase part of filename
  const match = fileName.match(/[A-Z]{2,}/);
  return match ? match[0] : fileName.toUpperCase();
}

// Toast notification helper
function showToast(message = "Notification", duration = 3000) {
  let toast = document.querySelector(".toast");
  
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
    
    // Add toast styles if not already in CSS
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: #1e293b;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          opacity: 0;
          transition: all 0.3s ease;
          z-index: 10000;
          font-weight: 500;
          font-size: 0.95rem;
          max-width: 90%;
          text-align: center;
        }
        .toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .toast.success {
          background: #10b981;
        }
        .toast.error {
          background: #ef4444;
        }
        .toast.warning {
          background: #f59e0b;
        }
      `;
      document.head.appendChild(style);
    }
  }

  toast.textContent = message;
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// Export for use in other modules
export { showToast, detectDepartment };