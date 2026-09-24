(() => {
  'use strict';

  const dock = document.querySelector('.unified-mobile-dock');
  if (!dock) return;

  const hiddenClass = 'is-scrolling-away';
  const show = () => dock.classList.remove(hiddenClass);

  show();
  globalThis.addEventListener('pageshow', show);
  globalThis.addEventListener('resize', show);
  dock.addEventListener('focusin', show);
  dock.addEventListener('pointerdown', show);
})();
