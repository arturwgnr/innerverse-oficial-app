import { useEffect, useRef, useState } from "react";

// Swipeable/draggable (pointer events, works for touch and mouse alike) and
// auto-advancing. Pauses auto-advance while the user is actively dragging or
// has their pointer over it, resumes after.
//
// A plain tap must still reach a clickable child (e.g. a Link inside a
// slide). Pointer capture is only claimed once the pointer has actually
// moved past a small threshold, if it's claimed on pointerdown instead, the
// browser can route the matching mouseup/click to the track rather than the
// original target, silently swallowing every tap.
const DRAG_THRESHOLD = 6;

export function Carousel({ children, autoAdvanceMs = 6000 }) {
  const items = Array.isArray(children) ? children : [children];
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const dragState = useRef(null);
  const isDragging = useRef(false);
  const justDragged = useRef(false);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, autoAdvanceMs);
    return () => clearInterval(timer);
  }, [paused, items.length, autoAdvanceMs]);

  function goTo(i) {
    setIndex(((i % items.length) + items.length) % items.length);
  }

  function onPointerDown(e) {
    dragState.current = { startX: e.clientX, width: trackRef.current.offsetWidth, pointerId: e.pointerId };
    isDragging.current = false;
    setPaused(true);
  }

  function onPointerMove(e) {
    if (!dragState.current) return;
    const delta = e.clientX - dragState.current.startX;
    if (!isDragging.current && Math.abs(delta) > DRAG_THRESHOLD) {
      isDragging.current = true;
      e.currentTarget.setPointerCapture(dragState.current.pointerId);
    }
    if (isDragging.current) setDragX(delta);
  }

  function onPointerUp() {
    if (!dragState.current) return;
    if (isDragging.current) {
      const { width } = dragState.current;
      const threshold = width * 0.18;
      if (dragX < -threshold) goTo(index + 1);
      else if (dragX > threshold) goTo(index - 1);
      justDragged.current = true;
    }
    dragState.current = null;
    isDragging.current = false;
    setDragX(0);
    setPaused(false);
  }

  function onClickCapture(e) {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      justDragged.current = false;
    }
  }

  const translate = `calc(${-index * 100}% + ${dragX}px)`;

  return (
    <div
      className="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="carousel-track"
        style={{ transform: `translateX(${translate})`, transition: isDragging.current ? "none" : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {items.map((child, i) => (
          <div className="carousel-slide" key={i}>
            {child}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="carousel-dots">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`carousel-dot ${i === index ? "active" : ""}`}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
