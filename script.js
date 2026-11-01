
(() => {
  'use strict';

  // ==========================================
  // 1. ELEMENTS
  // ==========================================

  const viewport = document.querySelector('#carousel-viewport');
  const allCards = Array.from(document.querySelectorAll('.board'));
  const tabs = Array.from(document.querySelectorAll('.carousel-tab'));
  const tabContainer = document.querySelector('.carousel-tabs');

  const previousButton = document.querySelector('#previous');
  const nextButton = document.querySelector('#next');
  const currentIndexLabel = document.querySelector('#current-index');

  if (!viewport || !allCards.length) return;

  // ==========================================
  // 2. ANIME.JS
  // ==========================================

  const animeApi = window.anime;

  if (!animeApi || typeof animeApi.animate !== 'function') {
    console.error('Anime.js did not load. Check the CDN connection.');
    return;
  }

  const { animate } = animeApi;

  // ==========================================
  // 3. CAROUSEL STATE
  // ==========================================

  const state = {
    position: 0
  };

  let activeCards = [];
  let cardCount = 0;
  let step = 0;

  let activeAnimation = null;
  let wheelTimer = null;
  let wheelGestureActive = false;
  let wheelStartPosition = 0;
  let wheelDelta = 0;

  let drag = null;
  let suppressClick = false;

  let activeCategory = 'work';

  const WHEEL_IDLE_MS = 170;
  const WHEEL_SENSITIVITY = 2.2;
  const WHEEL_MIN_TRAVEL = 0.11;
  const WHEEL_SNAP_DURATION = 480;
  const SNAP_DURATION = 520;

  viewport.style.overscrollBehavior = 'contain';

  // ==========================================
  // 4. ANIMATION CONTROL
  // ==========================================

  function stopAnimation() {
    if (activeAnimation) {
      activeAnimation.pause();
      activeAnimation = null;
    }
  }

  function cancelWheelGesture() {
    if (wheelTimer !== null) {
      window.clearTimeout(wheelTimer);
    }

    wheelTimer = null;
    wheelGestureActive = false;
    wheelDelta = 0;
  }

  // ==========================================
  // 5. CATEGORY FILTERING
  // ==========================================

  function setCategory(category) {
    if (category === activeCategory && activeCards.length) {
      return;
    }

    stopAnimation();
    cancelWheelGesture();

    // End any active drag
    drag = null;
    viewport.classList.remove('is-dragging');

    activeCategory = category;

    // Filter boards by category
    activeCards = allCards.filter(card => {
      return card.dataset.category === category;
    });

    cardCount = activeCards.length;

    // Update visibility
    allCards.forEach(card => {
      const isVisible = card.dataset.category === category;

      card.hidden = !isVisible;

      // Reset hover zoom
      const surface = card.querySelector('.board-surface');

      if (surface) {
        surface.style.transform = 'scale(1)';
      }
    });

    if (!cardCount) {
      console.warn(`No boards found for category: ${category}`);
      return;
    }

    // Reset carousel
    state.position = 0;
    step = 0;

    // Update tabs
    if (tabContainer) {
      tabContainer.dataset.active = category;
    }

    tabs.forEach(tab => {
      const isActive = tab.dataset.category === category;

      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    // Recalculate dimensions and render
    measure();
  }

  // Tab click events
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setCategory(tab.dataset.category);
    });
  });

  // ==========================================
  // 6. MEASURE CARDS
  // ==========================================

  function measure() {
    if (!activeCards.length) return;

    const cardWidth = activeCards[0].getBoundingClientRect().width;

    const gapValue = getComputedStyle(document.documentElement)
      .getPropertyValue('--card-gap');

    const gap = Number.parseFloat(gapValue) || 0;

    step = cardWidth * 0.8 + gap;

    render();
  }

  // ==========================================
  // 7. INFINITE LOOP INDEX
  // ==========================================

  function nearestVirtualIndex(cardIndex) {
    return cardIndex +
      Math.round((state.position - cardIndex) / cardCount) * cardCount;
  }

  // ==========================================
  // 8. RENDER CAROUSEL
  // ==========================================

  function render() {
    if (!step || !cardCount) return;

    activeCards.forEach((card, index) => {

      const virtualIndex = nearestVirtualIndex(index);
      const distance = virtualIndex - state.position;

      const absoluteDistance = Math.min(Math.abs(distance), 1.6);

      const scale =
        1 - Math.min(absoluteDistance, 1) * 0.5;

      const opacity = Math.max(
        0,
        Math.min(1, 1 - Math.max(0, absoluteDistance - 1) * 2)
      );

      card.style.transform =
        `translate3d(calc(-50% + ${distance * step}px), -50%, 0) scale(${scale})`;

      card.style.opacity = String(opacity);

      card.style.zIndex =
        String(100 - Math.round(absoluteDistance * 10));

      card.setAttribute(
        'aria-current',
        Math.abs(distance) < 0.5 ? 'true' : 'false'
      );
    });

    // Update pagination
    const selected =
      ((Math.round(state.position) % cardCount) + cardCount) % cardCount;

    if (currentIndexLabel) {
      currentIndexLabel.textContent =
        String(selected + 1).padStart(2, '0');
    }

    const totalLabel = document.querySelector('.pagination-total');

    if (totalLabel) {
      totalLabel.textContent =
        String(cardCount).padStart(2, '0');
    }
  }

  // ==========================================
  // 9. CAROUSEL ANIMATION
  // ==========================================

  function animateTo(target, duration) {
    if (!cardCount) return;

    stopAnimation();

    const distance = Math.abs(target - state.position);

    activeAnimation = animate(state, {
      position: target,

      duration: duration ??
        Math.max(260, Math.min(760, SNAP_DURATION + distance * 65)),

      ease: 'out(3)',

      onUpdate: render,

      onComplete: () => {
        render();
        activeAnimation = null;
      }
    });
  }

  // ==========================================
  // 10. TRACKPAD / MOUSE WHEEL
  // ==========================================

  function finishWheelGesture() {
    if (!wheelGestureActive) return;

    const moved = state.position - wheelStartPosition;
    const nearestStart = Math.round(wheelStartPosition);

    let target = Math.round(state.position);

    if (
      Math.abs(moved) >= WHEEL_MIN_TRAVEL &&
      target === nearestStart &&
      Math.abs(state.position - nearestStart) >
        Math.abs(wheelStartPosition - nearestStart)
    ) {
      target = nearestStart + Math.sign(moved);
    }

    cancelWheelGesture();

    animateTo(target, WHEEL_SNAP_DURATION);
  }

  function handleWheel(event) {
    if (
      Math.abs(event.deltaY) < Math.abs(event.deltaX) ||
      drag ||
      !cardCount
    ) {
      return;
    }

    event.preventDefault();

    let delta = event.deltaY;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      delta *= 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      delta *= viewport.clientHeight;
    }

    if (!wheelGestureActive) {
      wheelGestureActive = true;
      wheelStartPosition = state.position;
      wheelDelta = 0;

      stopAnimation();
    }

    wheelDelta += delta;

    state.position =
      wheelStartPosition + (wheelDelta * WHEEL_SENSITIVITY) / step;

    render();

    if (wheelTimer !== null) {
      window.clearTimeout(wheelTimer);
    }

    wheelTimer = window.setTimeout(
      finishWheelGesture,
      WHEEL_IDLE_MS
    );
  }

  viewport.addEventListener('wheel', handleWheel, {
    passive: false
  });

  // ==========================================
  // 11. NEXT / PREVIOUS
  // ==========================================

  function goNext() {
    if (!cardCount) return;

    cancelWheelGesture();

    animateTo(Math.round(state.position) + 1);
  }

  function goPrevious() {
    if (!cardCount) return;

    cancelWheelGesture();

    animateTo(Math.round(state.position) - 1);
  }

  previousButton?.addEventListener('click', goPrevious);
  nextButton?.addEventListener('click', goNext);

  // ==========================================
  // 12. BOARD CLICK + HOVER ZOOM
  // ==========================================

  allCards.forEach(card => {

    const surface = card.querySelector('.board-surface');

    // Click board to bring it to center
    card.addEventListener('click', () => {
      if (suppressClick) return;

      const index = activeCards.indexOf(card);

      if (index === -1) return;

      cancelWheelGesture();

      const destination =
        index +
        Math.round((state.position - index) / cardCount) * cardCount;

      animateTo(destination);
    });

    if (!surface) return;

    // Hover zoom in
    card.addEventListener('pointerenter', event => {
      if (
        event.pointerType === 'touch' ||
        card.hidden
      ) {
        return;
      }

      animate(surface, {
        scale: 1.06,
        duration: 450,
        ease: 'out(3)'
      });
    });

    // Hover zoom out
    card.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;

      animate(surface, {
        scale: 1,
        duration: 400,
        ease: 'out(3)'
      });
    });
  });

  // ==========================================
  // 13. DRAG / TOUCH SWIPE
  // ==========================================

  viewport.addEventListener('pointerdown', event => {

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (event.target.closest('.carousel-controls')) {
      return;
    }

    if (!cardCount || !step) return;

    cancelWheelGesture();
    stopAnimation();

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      startPosition: state.position,
      moved: false
    };

    viewport.classList.add('is-dragging');

    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', event => {

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const now = performance.now();

    const elapsed = Math.max(1, now - drag.lastTime);

    const dxFromStart = event.clientX - drag.startX;

    if (Math.abs(dxFromStart) > 5) {
      drag.moved = true;
    }

    if (drag.moved) {

      drag.velocityX =
        (event.clientX - drag.lastX) / elapsed;

      state.position =
        drag.startPosition - dxFromStart / step;

      render();
    }

    drag.lastX = event.clientX;
    drag.lastTime = now;
  });

  function finishDrag(event) {

    if (!drag) return;

    if (event && event.pointerId !== drag.pointerId) {
      return;
    }

    const finishedDrag = drag;

    drag = null;

    viewport.classList.remove('is-dragging');

    if (!finishedDrag.moved) return;

    const dx =
      (event ? event.clientX : finishedDrag.lastX) -
      finishedDrag.startX;

    const momentum = Math.max(
      -1.1,
      Math.min(1.1, (-finishedDrag.velocityX * 190) / step)
    );

    let target = Math.round(state.position + momentum);

    if (
      Math.abs(dx) > 42 &&
      target === Math.round(finishedDrag.startPosition)
    ) {
      target =
        Math.round(finishedDrag.startPosition) +
        (dx < 0 ? 1 : -1);
    }

    suppressClick = true;

    window.setTimeout(() => {
      suppressClick = false;
    }, 100);

    animateTo(target, 560);
  }

  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
  viewport.addEventListener('lostpointercapture', finishDrag);

  // ==========================================
  // 14. KEYBOARD NAVIGATION
  // ==========================================

  window.addEventListener('keydown', event => {

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const tag = document.activeElement?.tagName;

    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT'
    ) {
      return;
    }

    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      goNext();

    } else if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      goPrevious();
    }
  });

  // ==========================================
  // 15. RESIZE
  // ==========================================

  window.addEventListener('resize', measure);

  // ==========================================
  // 16. INITIALIZE
  // ==========================================

  setCategory('work');

})();
