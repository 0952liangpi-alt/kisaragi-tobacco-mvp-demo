(() => {
  'use strict';

  const dock = document.querySelector('.unified-mobile-dock');
  if (!dock) return;

  const hiddenClass = 'is-scrolling-away';
  let previousY = Math.max(globalThis.scrollY, 0);
  let frame = 0;
  let ready = false;

  const show = () => dock.classList.remove(hiddenClass);
  const syncWithPosition = () => {
    previousY = Math.max(globalThis.scrollY, 0);
    dock.classList.toggle(hiddenClass, previousY > 120);
  };

  const update = () => {
    frame = 0;
    const currentY = Math.max(globalThis.scrollY, 0);
    const delta = currentY - previousY;

    if (!ready) {
      previousY = currentY;
      return;
    }

    if (currentY <= 32 || delta < -3) show();
    else if (currentY > 120 && delta > 3) dock.classList.add(hiddenClass);

    previousY = currentY;
  };

  globalThis.addEventListener('scroll', () => {
    if (!frame) frame = globalThis.requestAnimationFrame(update);
  }, {passive: true});

  globalThis.addEventListener('resize', () => {
    syncWithPosition();
  });

  globalThis.addEventListener('pageshow', () => {
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(syncWithPosition));
  });
  dock.addEventListener('focusin', show);
  dock.addEventListener('pointerdown', show);

  globalThis.setTimeout(() => {
    ready = true;
    syncWithPosition();
  }, 350);
})();
