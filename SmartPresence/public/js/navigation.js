// ======================================
// ✅ UNIVERSAL NAVIGATION + HEADER LOADER
// Works for Teacher, Student, Admin dashboards
// ======================================

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader(); 
  // Wait a tiny bit to ensure nav buttons are in DOM before attaching
  setTimeout(() => {
    initNavigation();
    highlightActiveNav();
  }, 200);
});


// =============================
// 🔄 Load Header HTML
// =============================
async function loadHeader() {
  try {
    const res = await fetch("./components/header.html");
    const html = await res.text();
    document.body.insertAdjacentHTML("afterbegin", html);

    // 🧠 After loading header, populate nav links
    const category = sessionStorage.getItem("category");
    const navLinks = document.getElementById("nav-links");

    if (!navLinks) return;

    let linksHTML = "";
if (category === "teacher") {
  linksHTML = `
    <a href="dashboard-teacher.html" class="nav-btn">
  <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3a1 1 0 00-1 1v16a1 1 0 001 1h18a1 1 0 001-1V4a1 1 0 00-1-1H3zm3 14v-5a1 1 0 011-1h2a1 1 0 011 1v5H6zm6 0v-8a1 1 0 011-1h2a1 1 0 011 1v8h-4zm6 0v-3a1 1 0 011-1h2a1 1 0 011 1v3h-4z"/>
  </svg>
  Dashboard
</a>
    <a href="classes-teacher.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 4h18a1 1 0 011 1v2H2V5a1 1 0 011-1zm0 6h18v2H3v-2zm0 6h18v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z"/>
      </svg>
      Classes
    </a>
    <a href="notification.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a7 7 0 00-7 7v4.586L3.707 17.88A1 1 0 004.414 19h15.172a1 1 0 00.707-1.707L19 13.586V9a7 7 0 00-7-7zM10 21a2 2 0 004 0h-4z"/>
      </svg>
      Notifications
    </a>
    <a href="profile.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.866 0-7 2.239-7 5v1h14v-1c0-2.761-3.134-5-7-5z"/>
      </svg>
      Profile
    </a>
  `;
} else if (category === "student") {
  linksHTML = `
    <a href="dashboard-student.html" class="nav-btn">
  <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3a1 1 0 00-1 1v16a1 1 0 001 1h18a1 1 0 001-1V4a1 1 0 00-1-1H3zm3 14v-5a1 1 0 011-1h2a1 1 0 011 1v5H6zm6 0v-8a1 1 0 011-1h2a1 1 0 011 1v8h-4zm6 0v-3a1 1 0 011-1h2a1 1 0 011 1v3h-4z"/>
  </svg>
  Dashboard
</a>

    <a href="classes-student.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 4h18a1 1 0 011 1v2H2V5a1 1 0 011-1zm0 6h18v2H3v-2zm0 6h18v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z"/>
      </svg>
      Classes
    </a>
    <a href="notification.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a7 7 0 00-7 7v4.586L3.707 17.88A1 1 0 004.414 19h15.172a1 1 0 00.707-1.707L19 13.586V9a7 7 0 00-7-7zM10 21a2 2 0 004 0h-4z"/>
      </svg>
      Notifications
    </a>
    <a href="profile.html" class="nav-btn">
      <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.866 0-7 2.239-7 5v1h14v-1c0-2.761-3.134-5-7-5z"/>
      </svg>
      Profile
    </a>
  `;
} else if (category === "admin") {
  linksHTML = `
    <a href="dashboard-admin.html" class="nav-btn">
  <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3a1 1 0 00-1 1v16a1 1 0 001 1h18a1 1 0 001-1V4a1 1 0 00-1-1H3zm3 14v-5a1 1 0 011-1h2a1 1 0 011 1v5H6zm6 0v-8a1 1 0 011-1h2a1 1 0 011 1v8h-4zm6 0v-3a1 1 0 011-1h2a1 1 0 011 1v3h-4z"/>
  </svg>
  Dashboard
</a>

    <button id="logoutBtn" class="nav-btn nav-link">
  <svg xmlns="http://www.w3.org/2000/svg" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zM20 3h-6v2h6v14h-6v2h6a2 2 0 002-2V5a2 2 0 00-2-2z"/>
  </svg>
  Logout
</button>
  `;
}
else {
      window.location.href = "login.html"; // redirect if no category
      return;
    }

    navLinks.innerHTML = linksHTML;
  } catch (err) {
    console.error("Error loading header:", err);
  }
}

// =============================
// 🧭 Main Navigation Function
// =============================
function initNavigation() {
  const verified = sessionStorage.getItem("verified") === "true";

  const observer = new MutationObserver(() => {
    const navBtns = document.querySelectorAll(".nav-btn");
    if (navBtns.length > 0) {
      observer.disconnect();
      attachNavigationEvents(navBtns, verified);
      highlightActiveNav();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// =============================
// ⚙️ Attach Click Events
// =============================
function attachNavigationEvents(navBtns) {
  navBtns.forEach((btn) => {
    const href = btn.getAttribute("href");
    if (!href) return; // ✅ Skip logout button

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const target = btn.getAttribute("href");

      // Always allow dashboard & profile
      if (target.includes("dashboard") || target.includes("profile.html")) {
        window.location.href = target;
        return;
      }

      // ✅ FIX: Read verification status dynamically on each click
      const verified = sessionStorage.getItem("verified") === "true";
      
      // 🐛 ADD THIS DEBUG LINE:
      console.log("Navigation check - verified:", verified, "raw value:", sessionStorage.getItem("verified"));

      // Block if not verified
      if (!verified) {
        showVerifyModal();
        return;
      }

      window.location.href = target;
    });
  });
}

// =============================
// 💬 Verification Modal
// =============================
function showVerifyModal() {
  if (document.querySelector("#verifyModal")) {
    document.querySelector("#verifyModal").classList.add("show");
    return;
  }

  fetch("./components/verify-modal.html")
    .then(res => res.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      const modal = document.querySelector("#verifyModal");
      const closeBtn = document.querySelector("#closeVerifyModal");
      modal.classList.add("show");
      closeBtn.addEventListener("click", () => modal.classList.remove("show"));
    });
}

// =============================
// 🌟 Highlight Active Page
// =============================
function highlightActiveNav() {
  const currentPage = window.location.pathname.split("/").pop();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const href = btn.getAttribute("href");
    if (!href) return; // ✅ Skip non-link buttons (Logout)

    if (currentPage === href || currentPage.includes(href.replace(".html", ""))) {
      btn.style.backgroundColor = "#FFD700";
      btn.style.color = "#006633";
      btn.style.fontWeight = "600";
      btn.style.borderRadius = "6px";
    } else {
      btn.style.backgroundColor = "";
      btn.style.color = "";
      btn.style.fontWeight = "";
      btn.style.borderRadius = "";
    }
  });
}

