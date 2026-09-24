(() => {
  'use strict';

  const gate = document.getElementById('ageGate');
  const enter = document.getElementById('enterSite');
  if (!gate || !enter) return;

  const storageKey = 'kisaragi-age-verified';
  const protectedNodes = () => [...document.querySelectorAll('[data-age-protected]')];
  const focusable = () => [...gate.querySelectorAll('button, [href]')].filter((element) => !element.hidden);
  let locked = false;

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const lock = () => {
    if (locked) return;
    locked = true;
    gate.hidden = false;
    protectedNodes().forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.add('age-gate-locked', 'has-open-modal');
    gate.addEventListener('keydown', trapFocus);
    requestAnimationFrame(() => focusable()[0]?.focus());
  };

  const release = ({focus = true} = {}) => {
    if (locked) gate.removeEventListener('keydown', trapFocus);
    locked = false;
    gate.hidden = true;
    protectedNodes().forEach((element) => {
      element.inert = false;
      element.removeAttribute('aria-hidden');
    });
    document.body.classList.remove('age-gate-locked', 'has-open-modal');
    if (focus) document.querySelector(document.body.dataset.ageFocusTarget || 'main')?.focus?.({preventScroll:true});
  };

  enter.addEventListener('click', () => {
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
    release();
  });

  let verified = false;
  try { verified = sessionStorage.getItem(storageKey) === '1'; } catch {}
  if (verified) release({focus:false});
  else lock();

  globalThis.KISARAGI_AGE_GATE = Object.freeze({
    initialized: true,
    isLocked: () => locked,
    lock,
    release,
  });
})();
