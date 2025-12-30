// ======================================
// ✅ UNIVERSAL NAVIGATION + HEADER LOADER
// Works for Teacher, Student, Admin dashboards
// ======================================

// Expose a helper early so page scripts can signal when dynamic content is ready
if (!window.markContentReady) {
  window.markContentReady = function () {
    try { window.dispatchEvent(new Event('content-ready')); } catch (e) { /* ignore */ }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader(); 
  // Ensure consistent fade timing across all pages by setting an inline transition
  // This overrides per-page stylesheet rules and matches the dashboard timing
  try {
    document.documentElement.style.transition = 'opacity 0.04s ease-in-out';
    document.body.style.transition = 'opacity 0.04s ease-in-out';
  } catch (e) { /* ignore */ }

  // Wait a tiny bit to ensure nav buttons are in DOM before attaching
  setTimeout(() => {
    // Animate page content entry to mirror dashboard (longer fade while content loads)
    performPageEnterAnimation();
    initNavigation();
    highlightActiveNav();
  }, 200);
});


// =============================
// 🔄 Load Header HTML
// =============================
async function loadHeader() {
  try {
    // Skip injecting the global header on pages that manage their own UI
    const currentPage = window.location.pathname.split('/').pop();
    const pagesToSkipHeader = [
      'face-recognition.html',
      'qr-attendance.html',
      'qr-scanner-student.html',
      'scan-attendance.html'
    ];
    if (pagesToSkipHeader.includes(currentPage)) return;
    // Remove existing topbar header ONLY (not card headers)
    const existingHeader = document.querySelector("header.topbar");
    if (existingHeader) {
      existingHeader.remove();
    }

    const res = await fetch("./components/header.html");
    const html = await res.text();
    document.body.insertAdjacentHTML("afterbegin", html);

    // Ensure the topbar header has the animation class
    const newHeader = document.querySelector("header.topbar");
    if (newHeader) {
      newHeader.classList.add("animate-header");
    }

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
    // Attach click handlers immediately to avoid missing clicks
    attachNavigationEvents(document.querySelectorAll('.nav-btn'));
  } catch (err) {
    console.error("Error loading header:", err);
  }
}

// =============================
// 🧭 Main Navigation Function
// =============================

// Animate page entry with a longer fade (mirrors dashboard where content loads during fade)
function performPageEnterAnimation() {
  const pages = document.querySelectorAll('.page');
  pages.forEach((page) => {
    if (!page.classList.contains('visible')) return; // only animate pages meant to be visible

    // Start hidden but take layout space
    page.classList.remove('visible');
    page.classList.add('entering');

    // Trigger the opacity transition on the next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        page.classList.add('entering-active');
      });
    });

    // The visual duration we want to preserve (matches CSS 0.65s)
    const visualDuration = 650;
    // Maximum wait to avoid locking UI if load never fires
    const maxWait = 1200;

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      page.classList.remove('entering', 'entering-active');
      page.classList.add('visible');
      // cleanup listeners
      window.removeEventListener('load', onLoad);
      window.removeEventListener('content-ready', onContentReady);
      clearTimeout(timeoutId);
    };

    const onLoad = () => {
      // ensure we keep the visual for at least a short moment so transition is perceivable
      setTimeout(finish, Math.max(0, visualDuration - 100));
    };

    const onContentReady = () => {
      // content-ready means page script finished populating dynamic content
      setTimeout(finish, Math.max(0, visualDuration - 100));
    };

    window.addEventListener('load', onLoad, { once: true });
    window.addEventListener('content-ready', onContentReady, { once: true });

    // Fallback timeout in case neither event fires
    const timeoutId = setTimeout(() => {
      finish();
    }, maxWait);
  });

  // Helper for pages to signal when they've finished loading dynamic content
  if (!window.markContentReady) {
    window.markContentReady = function() {
      window.dispatchEvent(new Event('content-ready'));
    };
  }
}

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
    if (btn.dataset.navAttached === 'true') return;
    const href = btn.getAttribute("href");
    if (!href) return; // ✅ Skip logout button

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const target = btn.getAttribute("href");

      // Always allow dashboard & profile with fade transition
      if (target.includes("dashboard") || target.includes("profile.html")) {
        navigateWithFade(target);
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

      navigateWithFade(target);
    });
    btn.dataset.navAttached = 'true';
  });
}

// =============================
// 🎬 Navigate with Fade Transition
// =============================
function navigateWithFade(target) {
  const body = document.body;
  
  // Add fade-out class
  body.classList.add("page-transitioning");
  // Wait for CSS transition duration (read from computed style). Fallback to dashboard timing (40ms)
  let timeoutMs = 40;
  try {
    const computed = window.getComputedStyle(body).transitionDuration || '0.04s';
    // transitionDuration may contain comma-separated values
    const durations = computed.split(',').map(s => s.trim()).map(s => {
      if (s.endsWith('ms')) return parseFloat(s);
      if (s.endsWith('s')) return parseFloat(s) * 1000;
      return parseFloat(s) * 1000;
    });
    timeoutMs = Math.max(...durations, 40);
  } catch (err) {
    console.warn('Unable to compute transition duration, using default', err);
  }

  setTimeout(() => {
    window.location.href = target;
  }, timeoutMs);
}

// Expose for inline handlers and legacy code
try { window.navigateWithFade = navigateWithFade; } catch (e) { /* ignore */ }

// =============================
//  Verification Modal
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

// =============================
// 🔁 Global Delegated Nav Click Handler (fallback)
// Ensures fade transitions work even if individual listeners weren't attached yet
// =============================
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  const href = btn.getAttribute('href');
  if (!href) return; // skip non-links
  e.preventDefault();

  const target = href;
  if (target.includes('dashboard') || target.includes('profile.html')) {
    navigateWithFade(target);
    return;
  }

  const verified = sessionStorage.getItem('verified') === 'true';
  console.log('Delegated nav click - target:', target, 'verified:', verified);
  if (!verified) {
    showVerifyModal();
    return;
  }
  navigateWithFade(target);
}, true);
