import { afterEach, expect, it, vi } from "vitest";
import { bindFormDrawerViewport } from "./form-drawer-viewport";

afterEach(() => vi.unstubAllGlobals());

it("fits a panned visual viewport, scrolls the focused field, and cleans up on close", () => {
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
    scale: 1,
  });
  let fieldBottom = 250;
  const field = {
    getBoundingClientRect: () => ({
      top: fieldBottom - 44,
      bottom: fieldBottom,
    }),
  };
  const body = Object.assign(new EventTarget(), {
    contains: (element: unknown) => element === field,
    getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    scrollTop: 0,
  });
  const properties = new Map<string, string>();
  const drawer = {
    querySelector: () => body,
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
  };
  let frame: FrameRequestCallback;
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const cancelAnimationFrame = vi.fn();
  vi.stubGlobal("window", {
    innerHeight: 800,
    visualViewport: viewport,
    requestAnimationFrame,
    cancelAnimationFrame,
  });
  vi.stubGlobal("document", { activeElement: field });

  const cleanup = bindFormDrawerViewport(drawer as unknown as HTMLDivElement);
  expect(properties.get("--form-drawer-bottom")).toBe("0px");

  viewport.height = 340;
  viewport.offsetTop = 55;
  fieldBottom = 345;
  viewport.dispatchEvent(new Event("resize"));
  viewport.dispatchEvent(new Event("scroll"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  frame!(0);
  expect(properties.get("--form-drawer-bottom")).toBe("405px");
  expect(properties.get("--form-drawer-height")).toBe("340px");
  expect(body.scrollTop).toBe(45);

  fieldBottom = 280;
  viewport.height = 800;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event("resize"));
  frame!(0);
  expect(properties.get("--form-drawer-bottom")).toBe("0px");
  expect(properties.get("--form-drawer-height")).toBe("800px");
  expect(body.scrollTop).toBe(45);

  body.dispatchEvent(new Event("focusin"));
  cleanup?.();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(properties.size).toBe(0);
  requestAnimationFrame.mockClear();
  viewport.dispatchEvent(new Event("resize"));
  viewport.dispatchEvent(new Event("scroll"));
  body.dispatchEvent(new Event("focusin"));
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
