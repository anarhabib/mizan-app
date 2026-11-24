export function bindFormDrawerViewport(drawer: HTMLDivElement | null) {
  const viewport = window.visualViewport;
  const body = drawer?.querySelector<HTMLElement>(
    "[data-slot=form-panel-body]",
  );
  if (!drawer || !body || !viewport) return;

  let frame = 0;

  const update = () => {
    frame = 0;

    // Fixed positioning uses the layout viewport. The keyboard can both
    // shrink and pan the visual viewport without resizing the layout.
    const unzoomed = viewport.scale === 1;
    const bottom = unzoomed
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0;
    drawer.style.setProperty("--form-drawer-bottom", `${bottom}px`);
    if (unzoomed) {
      drawer.style.setProperty("--form-drawer-height", `${viewport.height}px`);
    } else {
      drawer.style.removeProperty("--form-drawer-height");
    }

    const focused = document.activeElement;
    if (!unzoomed || !focused || !body.contains(focused)) return;

    // Adjust the form scroller only. Scrolling the document can pan the
    // visual viewport again and move the drawer out from under the input.
    const field = focused.getBoundingClientRect();
    const bounds = body.getBoundingClientRect();
    if (field.top < bounds.top) {
      body.scrollTop += field.top - bounds.top;
    } else if (field.bottom > bounds.bottom) {
      body.scrollTop += field.bottom - bounds.bottom;
    }
  };

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  update();
  viewport.addEventListener("resize", scheduleUpdate);
  viewport.addEventListener("scroll", scheduleUpdate);
  body.addEventListener("focusin", scheduleUpdate);

  return () => {
    viewport.removeEventListener("resize", scheduleUpdate);
    viewport.removeEventListener("scroll", scheduleUpdate);
    body.removeEventListener("focusin", scheduleUpdate);
    window.cancelAnimationFrame(frame);
    drawer.style.removeProperty("--form-drawer-bottom");
    drawer.style.removeProperty("--form-drawer-height");
  };
}
