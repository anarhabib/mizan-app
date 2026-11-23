import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { desktopColumns, packWidgets, widgetSpans } from "../layout";
import type { BusinessWidgetId } from "../preferences";
import "./dashboard-widget-grid.css";

export function DashboardWidgetGrid({
  widgets,
  renderWidget,
}: {
  widgets: BusinessWidgetId[];
  renderWidget: (widget: BusinessWidgetId) => ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const orderKey = widgets.join("/");
  const tabletSpans = widgetSpans(widgets, 2);
  const pairedSpans = widgetSpans(widgets, 2, true);
  const preferredDesktopColumns = desktopColumns(widgets);
  const desktopSpans = widgetSpans(widgets, preferredDesktopColumns);

  useLayoutEffect(() => {
    const element = grid.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const cards = Array.from(element.children) as HTMLElement[];
    const heights = new Map<Element, number>();
    let inlineSize: number | undefined;
    let lastLayout = "";

    const update = () => {
      const style = getComputedStyle(element);
      const mode = style.getPropertyValue("--widget-layout").trim();
      if (mode === "mobile") {
        delete element.dataset.packed;
        lastLayout = "";
        return;
      }
      const columns =
        style.getPropertyValue("--widget-columns").trim() === "3" ? 3 : 2;
      const placements = packWidgets(
        cards.map((card) => ({
          height: heights.get(card) ?? card.getBoundingClientRect().height,
          span: Number(card.style.getPropertyValue(`--${mode}-span`)),
        })),
        columns,
        parseFloat(style.columnGap),
      );
      const layout = JSON.stringify([mode, placements]);
      if (layout === lastLayout) return;
      lastLayout = layout;
      for (const [index, { column, top }] of placements.entries()) {
        cards[index].style.setProperty("--packed-column", String(column));
        cards[index].style.setProperty("--packed-offset", `${top}px`);
      }
      element.dataset.packed = mode;
    };

    delete element.dataset.packed;
    update();
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        if (entry.target === element) {
          const width = entry.contentRect.width;
          changed ||= inlineSize !== width;
          inlineSize = width;
        } else {
          const height =
            entry.borderBoxSize?.[0]?.blockSize ??
            entry.target.getBoundingClientRect().height;
          changed ||= heights.get(entry.target) !== height;
          heights.set(entry.target, height);
        }
      }
      if (changed && !frame) {
        // Apply offsets outside observer delivery, since they resize the grid.
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
      }
    });
    observer.observe(element);
    for (const card of cards) observer.observe(card, { box: "border-box" });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [orderKey]);

  return (
    <div className="dashboard-widget-container min-w-0">
      <div
        ref={grid}
        className="dashboard-widget-grid grid min-w-0 items-start gap-3"
        style={
          { "--desktop-columns": preferredDesktopColumns } as CSSProperties
        }
      >
        {widgets.map((widget, index) => (
          <div
            key={widget}
            className="min-w-0"
            style={
              {
                "--tablet-span": tabletSpans[index],
                "--paired-span": pairedSpans[index],
                "--desktop-span": desktopSpans[index],
              } as CSSProperties
            }
          >
            {renderWidget(widget)}
          </div>
        ))}
      </div>
    </div>
  );
}
