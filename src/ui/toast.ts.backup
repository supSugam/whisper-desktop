export function showToast(msg: string) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'toast-notification';
  el.innerText = msg;
  
  // Inline styles for simplicity, could serve class via CSS
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '20px',
    zIndex: '9999',
    fontSize: '12px',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s',
  });

  document.body.appendChild(el);
  
  // Trigger reflow
  el.getBoundingClientRect();
  el.style.opacity = '1';

  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 2000);
}
