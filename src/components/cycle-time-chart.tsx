import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { useMasterStore } from "@/store/master";

const SERIES: uPlot.Series[] = [
  { label: "time" },
  { label: "cycle (us)", stroke: "#1F6FEB", width: 1.5 },
  { label: "jitter (us)", stroke: "#F59E0B", width: 1.5 },
];

export function CycleTimeChart() {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const history = useMasterStore((s) => s.cycleHistory);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const options: uPlot.Options = {
      width: el.clientWidth || 800,
      height: el.clientHeight || 160,
      series: SERIES,
      scales: { x: { time: true } },
      legend: { show: true },
      cursor: { show: false },
    };
    const instance = new uPlot(options, [[], [], []], el);
    plot.current = instance;

    const resize = () => {
      const node = host.current;
      if (node) {
        instance.setSize({
          width: node.clientWidth || 800,
          height: node.clientHeight || 160,
        });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      instance.destroy();
      plot.current = null;
    };
  }, []);

  useEffect(() => {
    plot.current?.setData(
      [history.t, history.cycle, history.jitter] as uPlot.AlignedData,
      false,
    );
  }, [history]);

  return <div ref={host} className="h-full w-full" />;
}
