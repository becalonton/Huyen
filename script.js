(() => {
  'use strict';
  
  import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  // Paste your actual Firebase web configuration here.
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };

  






  const viewport = document.querySelector('#carousel-viewport');
  const cards = Array.from(document.querySelectorAll('.board'));
  const previousButton = document.querySelector('#previous');
  const nextButton = document.querySelector('#next');
  const currentIndexLabel = document.querySelector('#current-index');

  if (!viewport || !cards.length) return;

  const animeApi = window.anime;
  if (!animeApi || typeof animeApi.animate !== 'function') {
    console.error('Anime.js did not load. Check the CDN connection.');
    return;
  }
  const { animate } = animeApi;

  const state = { position: 0 };
  const cardCount = cards.length;
  let step = 0;
  let activeAnimation = null;
  let wheelTimer = null;
  let wheelGestureActive = false;
  let wheelStartPosition = 0;
  let wheelDelta = 0;
  let drag = null;
  let suppressClick = false;

  const WHEEL_IDLE_MS = 170;
  const WHEEL_SENSITIVITY = 2.2;
  const WHEEL_MIN_TRAVEL = 0.11;
  const WHEEL_SNAP_DURATION = 480;
  const SNAP_DURATION = 520;

  viewport.style.overscrollBehavior = 'contain';

  function measure() {
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gapValue = getComputedStyle(document.documentElement).getPropertyValue('--card-gap');
    const gap = Number.parseFloat(gapValue) || 0;
    step = cardWidth + gap;
    render();
  }

  function nearestVirtualIndex(cardIndex) {
    return cardIndex + Math.round((state.position - cardIndex) / cardCount) * cardCount;
  }

  function render() {
    if (!step) return;

    cards.forEach((card, index) => {
      const virtualIndex = nearestVirtualIndex(index);
      const distance = virtualIndex - state.position;
      const absoluteDistance = Math.min(Math.abs(distance), 1.6);
      const scale = 1 - Math.min(absoluteDistance, 1) * 0.3;
      const opacity = Math.max(0, Math.min(1, 1 - Math.max(0, absoluteDistance - 1) * 2));

      card.style.transform = `translate3d(calc(-50% + ${distance * step}px), -50%, 0) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(100 - Math.round(absoluteDistance * 10));
      card.setAttribute('aria-current', Math.abs(distance) < 0.5 ? 'true' : 'false');
    });

    const selected = ((Math.round(state.position) % cardCount) + cardCount) % cardCount;
    if (currentIndexLabel) currentIndexLabel.textContent = String(selected + 1).padStart(2, '0');
  }

  function stopAnimation() {
    if (activeAnimation) {
      activeAnimation.pause();
      activeAnimation = null;
    }
  }

  function animateTo(target, duration) {
    stopAnimation();
    const distance = Math.abs(target - state.position);
    activeAnimation = animate(state, {
      position: target,
      duration: duration ?? Math.max(260, Math.min(760, SNAP_DURATION + distance * 65)),
      ease: 'out(3)',
      onUpdate: render,
      onComplete: () => {
        render();
        activeAnimation = null;
      }
    });
  }

  function cancelWheelGesture() {
    if (wheelTimer !== null) window.clearTimeout(wheelTimer);
    wheelTimer = null;
    wheelGestureActive = false;
    wheelDelta = 0;
  }

  function finishWheelGesture() {
    if (!wheelGestureActive) return;
    const moved = state.position - wheelStartPosition;
    const nearestStart = Math.round(wheelStartPosition);
    let target = Math.round(state.position);

    if (Math.abs(moved) >= WHEEL_MIN_TRAVEL &&
        target === nearestStart &&
        Math.abs(state.position - nearestStart) > Math.abs(wheelStartPosition - nearestStart)) {
      target = nearestStart + Math.sign(moved);
    }

    cancelWheelGesture();
    animateTo(target, WHEEL_SNAP_DURATION);
  }

  function handleWheel(event) {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) || drag) return;
    event.preventDefault();

    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= viewport.clientHeight;

    if (!wheelGestureActive) {
      wheelGestureActive = true;
      wheelStartPosition = state.position;
      wheelDelta = 0;
      stopAnimation();
    }

    wheelDelta += delta;
    state.position = wheelStartPosition + (wheelDelta * WHEEL_SENSITIVITY) / step;
    render();

    if (wheelTimer !== null) window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(finishWheelGesture, WHEEL_IDLE_MS);
  }

  viewport.addEventListener('wheel', handleWheel, { passive: false });

  function goNext() {
    cancelWheelGesture();
    animateTo(Math.round(state.position) + 1);
  }

  function goPrevious() {
    cancelWheelGesture();
    animateTo(Math.round(state.position) - 1);
  }

  cards.forEach((card, index) => {
    const surface = card.querySelector('.board-surface');

    card.addEventListener('click', () => {
      if (suppressClick) return;
      cancelWheelGesture();
      const destination = index + Math.round((state.position - index) / cardCount) * cardCount;
      animateTo(destination);
    });

    if (surface) {
      card.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        animate(surface, { scale: 1.055, duration: 360, ease: 'out(3)' });
      });
      card.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch') return;
        animate(surface, { scale: 1, duration: 320, ease: 'out(3)' });
      });
    }
  });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.carousel-controls')) return;

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

  viewport.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    const dxFromStart = event.clientX - drag.startX;
    if (Math.abs(dxFromStart) > 5) drag.moved = true;

    if (drag.moved) {
      drag.velocityX = (event.clientX - drag.lastX) / elapsed;
      state.position = drag.startPosition - dxFromStart / step;
      render();
    }
    drag.lastX = event.clientX;
    drag.lastTime = now;
  });

  function finishDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const finishedDrag = drag;
    drag = null;
    viewport.classList.remove('is-dragging');
    if (!finishedDrag.moved) return;

    const dx = (event ? event.clientX : finishedDrag.lastX) - finishedDrag.startX;
    const momentum = Math.max(-1.1, Math.min(1.1, (-finishedDrag.velocityX * 190) / step));
    let target = Math.round(state.position + momentum);

    if (Math.abs(dx) > 42 && target === Math.round(finishedDrag.startPosition)) {
      target = Math.round(finishedDrag.startPosition) + (dx < 0 ? 1 : -1);
    }

    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 100);
    animateTo(target, 560);
  }

  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
  viewport.addEventListener('lostpointercapture', finishDrag);

  previousButton?.addEventListener('click', goPrevious);
  nextButton?.addEventListener('click', goNext);

  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      goNext();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      goPrevious();
    }
  });

  window.addEventListener('resize', measure);
  measure();
})();
