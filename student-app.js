// Simple client-side router for top-right nav (student version)
const buttons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');

        // set active state
        buttons.forEach(b => b.classList.toggle('active', b === btn));

        // show selected page only
        pages.forEach(p => p.classList.toggle('visible', p.id === target));

        // placeholder for future pages
        if (target !== 'dashboard') {
            // No content for now
        }

        // logout placeholder
        if (target === 'logout') {
            alert('Logout action not implemented yet.');
            document.querySelector('[data-target="dashboard"]').click();
        }
    });
});
