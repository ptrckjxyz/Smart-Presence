// Simple client-side router for top-right nav
const buttons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');

    // set active state
    buttons.forEach(b => b.classList.toggle('active', b === btn));

    // show selected page only
    pages.forEach(p => p.classList.toggle('visible', p.id === target));

    // for non-implemented pages, keep empty state
    if(target !== 'dashboard'){
      // No content for now
    }

    // handle logout placeholder
    if(target === 'logout'){
      // You can wire this to your auth flow later
      alert('Logout action not implemented yet.');
      // keep the user on Dashboard for now
      document.querySelector('[data-target="dashboard"]').click();
    }
  });
});
