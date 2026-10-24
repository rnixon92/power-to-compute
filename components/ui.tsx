"use client";

import { useEffect, useRef, useState } from "react";

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onChange} />;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size,
  label,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm";
  label: string;
}) {
  return (
    <div className={size ? `seg ${size}` : "seg"} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  hint?: React.ReactNode;
  onChange: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <div className="slider-top">
        <span>{label}</span>
        <b>{format(value)}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Delta({ value, digits = 1, suffix = "%" }: { value: number | null; digits?: number; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="delta muted">—</span>;
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1 L9 8 L1 8 Z" : "M5 9 L9 2 L1 2 Z"} fill="currentColor" />
      </svg>
      {Math.abs(value).toFixed(digits)}
      {suffix}
      <span className="sr">{up ? "up" : "down"}</span>
    </span>
  );
}

/** Eases a number toward its target so totals glide instead of jumping. */
export function useTween(target: number, ms = 320): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = Number.isFinite(from.current) ? from.current : target;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = origin + (target - origin) * eased;
      from.current = v;
      setValue(v);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);
  return value;
}

export function Tweened({ value, format }: { value: number | null; format: (v: number) => string }) {
  const v = useTween(value ?? NaN);
  if (value == null || !Number.isFinite(value)) return <>—</>;
  return <>{format(v)}</>;
}

export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
