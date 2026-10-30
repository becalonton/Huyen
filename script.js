(() => {
  'use strict';

  const viewport = document.querySelector('.carousel-viewport');
  const track = document.querySelector('.carousel-track');

  if (!viewport || !track) return;

  // Anime.js v4 is loaded from the CDN in index.html.
  const animeApi = window.anime;
  if (!animeApi || typeof animeApi.animate !== 'function') {
    console.error('Anime.js did not load. Check your internet connection and reload the page.');
    return;
  }
  const { animate } = animeApi;

  const originalBoards = Array.from(track.querySelectorAll('.board'));
  const boardCount = originalBoards.length;
  if (boardCount < 2) return;

  // Three sets let the carousel travel both directions and then snap to an
  // identical copy in the middle, without a visible jump.
  for (let set = 0; set < 2; set += 1) {
    originalBoards.forEach((board) => {
      const clone = board.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('aria-label');
      track.appendChild(clone);
    });
  }

  const allBoards = Array.from(track.querySelectorAll('.board'));
  const position = { x: 0 };
  let step = 0;
  let activeIndex = boardCount; // Start at the first board in the middle set.
  let isAnimating = false;
  let wheelAccumulator = 0;
  let pendingSteps = 0;
  let resizePending = false;

  const wheelThreshold = 180;
  const maxQueuedSteps = 0;

  function measureStep() {
    if (allBoards.length < 2) return 0;
    const first = allBoards[0].getBoundingClientRect();
    const second = allBoards[1].getBoundingClientRect();
    return second.left - first.left;
  }

  function renderPosition() {
    track.style.transform = `translate3d(${-position.x}px, 0, 0)`;
  }

  function normalizeIndexAfterLoop() {
    if (activeIndex >= boardCount * 2) {
      activeIndex -= boardCount;
    } else if (activeIndex < boardCount) {
      activeIndex += boardCount;
    }
  }

  function consumeQueuedStep() {
    if (isAnimating || pendingSteps === 0) return;
    const direction = Math.sign(pendingSteps);
    pendingSteps -= direction;
    move(direction);
  }

  function move(direction) {
    if (!direction || !step) return;

    if (isAnimating) {
      pendingSteps = Math.max(-maxQueuedSteps, Math.min(maxQueuedSteps, pendingSteps + direction));
      return;
    }

    isAnimating = true;
    activeIndex += direction;
    const targetX = activeIndex * step;

    animate(position, {
      x: targetX,
      duration: 360,
      ease: 'inOut(2)',
      onUpdate: renderPosition,
      onComplete: () => {
        // Rebase to the middle set. The cards at the old and new positions
        // are identical, so this instant adjustment is visually seamless.
        normalizeIndexAfterLoop();
        if (resizePending) {
          step = measureStep();
          resizePending = false;
        }
        position.x = activeIndex * step;
        renderPosition();
        isAnimating = false;
        consumeQueuedStep();
      }
    });
  }

  function handleWheel(event) {
    // Only vertical gestures operate the carousel; let horizontal gestures be ignored.
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();

    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 3;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= window.innerHeight;

    wheelAccumulator += delta;
    if (Math.abs(wheelAccumulator) >= wheelThreshold) {
      const direction = Math.sign(wheelAccumulator);
      wheelAccumulator = 0;
      move(direction > 0 ? 1 : -1);
    }
  }

  viewport.addEventListener('wheel', handleWheel, { passive: false });

  // Also support a finger swiping up/down on touch screens.
  let touchStart = null;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    touchStart = { x: event.clientX, y: event.clientY };
  });

  viewport.addEventListener('pointerup', (event) => {
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      move(dy < 0 ? 1 : -1);
    }
  });

  // Keyboard support: Down = next board, Up = previous board.
  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  });

  function setInitialPosition() {
    step = measureStep();
    position.x = activeIndex * step;
    renderPosition();
  }

  window.addEventListener('resize', () => {
    if (isAnimating) {
      resizePending = true;
      return;
    }
    step = measureStep();
    position.x = activeIndex * step;
    renderPosition();
  });

  // Wait one frame so responsive CSS dimensions are settled before measuring.
  requestAnimationFrame(setInitialPosition);


})();

// ==========================================
// FLOATING NAVIGATION — Anime.js v4
// ==========================================
(() => {
  'use strict';

  const tabs = document.querySelector('#tabs');
  const indicator = document.querySelector('#active-indicator');
  const buttons = Array.from(document.querySelectorAll('.tab'));
  const animeApi = window.anime;

  if (!tabs || !indicator || buttons.length === 0) return;
  if (!animeApi || typeof animeApi.animate !== 'function') {
    console.error('Anime.js v4 did not load. Check your internet connection.');
    return;
  }

  const { animate, utils } = animeApi;
  let activeButton = document.querySelector('.tab.active') || buttons[0];

  // Position the pill using coordinates relative to the tabs container.
  function getButtonPosition(button) {
    const tabsRect = tabs.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return {
      x: buttonRect.left - tabsRect.left,
      y: buttonRect.top - tabsRect.top,
      width: buttonRect.width,
      height: buttonRect.height
    };
  }

  function placeIndicator(button, animated = true) {
    const pos = getButtonPosition(button);

    if (animated) {
      // A tiny squeeze during travel gives the pill a soft, fluid feel.
      animate(indicator, {
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        duration: 680,
        ease: 'outExpo'
      });
    } else {
      utils.set(indicator, {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
        height: `${pos.height}px`
      });
    }
  }

  function selectTab(button) {
    if (button === activeButton) return;

    buttons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      if (selected) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });

    activeButton = button;
    placeIndicator(button, true);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => selectTab(button));
  });

  // Set correct initial location after layout has settled.
  requestAnimationFrame(() => placeIndicator(activeButton, false));

  // Keep the indicator aligned on resize or responsive layout changes.
  window.addEventListener('resize', () => {
    placeIndicator(activeButton, false);
  });
})();
