document.getElementById('hamburger')?.addEventListener('click', () => {
  document.querySelector('.nav-links')?.classList.toggle('open');
});

// If arriving via #mode-design or #mode-baseline anchor, pre-select that mode
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash;
  if (hash === '#mode-baseline' && typeof setMode === 'function') {
    document.querySelector('input[name="mode"][value="baseline"]')?.click();
    document.getElementById('mode-card')?.scrollIntoView({behavior:'smooth', block:'start'});
  } else if (hash === '#mode-design' && typeof setMode === 'function') {
    document.getElementById('mode-card')?.scrollIntoView({behavior:'smooth', block:'start'});
  }
});
