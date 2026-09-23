(() => {
  'use strict';

  const gate = document.getElementById('age');
  const enter = document.getElementById('enter');
  const ageKey = 'kisaragi-age-verified';

  if (sessionStorage.getItem(ageKey) === '1') {
    gate.classList.add('hide');
    gate.setAttribute('aria-hidden', 'true');
    gate.inert = true;
  } else {
    const background = [...document.body.children].filter((element) => element !== gate && element.tagName !== 'SCRIPT');
    const prior = background.map((element) => ({
      element,
      inert: element.inert,
      aria: element.getAttribute('aria-hidden'),
    }));
    const overflow = document.body.style.overflow;
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    const focusable = [enter, gate.querySelector('a[href]')];
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    gate.addEventListener('keydown', trap);
    enter.focus({ preventScroll: true });
    enter.addEventListener('click', () => {
      sessionStorage.setItem(ageKey, '1');
      gate.classList.add('hide');
      gate.setAttribute('aria-hidden', 'true');
      gate.inert = true;
      gate.removeEventListener('keydown', trap);
      prior.forEach(({ element, inert, aria }) => {
        element.inert = inert;
        if (aria === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', aria);
      });
      document.body.style.overflow = overflow;
      document.getElementById('top').focus({ preventScroll: true });
    });
  }

  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('in');
    }),
    { threshold: 0.1 },
  );
  document.querySelectorAll('.section,.statement,.value').forEach((element) => observer.observe(element));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
})();
