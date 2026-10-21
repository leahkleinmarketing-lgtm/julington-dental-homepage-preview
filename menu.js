(() => {
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-navigation');
  if (!button || !nav) return;

  const mobile = window.matchMedia('(max-width: 780px)');
  const label = button.querySelector('.menu-label');
  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  function setOpen(open) {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    label.textContent = open ? 'Close' : 'Menu';
    nav.toggleAttribute('data-open', open);
  }

  button.addEventListener('click', () => setOpen(!isOpen()));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (mobile.matches && isOpen() && !nav.contains(event.target) && !button.contains(event.target)) {
      setOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
})();
