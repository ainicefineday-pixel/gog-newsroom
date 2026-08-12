"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createNoise3D } from "simplex-noise";
import { cn } from "@/lib/utils";

export function WavyBackground({
  children,
  className,
  containerClassName,
  colors = ["#e31b23", "#f6d32d", "#1c6b8d"],
  waveOpacity = 0.22,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveOpacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const noise = createNoise3D();
    let frame = 0,
      t = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(),
        dpr = devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const draw = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      context.fillStyle = "#050b12";
      context.fillRect(0, 0, w, h);
      context.globalAlpha = waveOpacity;
      colors.forEach((color, index) => {
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 34;
        for (let x = 0; x <= w; x += 8) {
          const y = h * 0.58 + noise(x / 500, index * 0.35, t) * 70;
          context.lineTo(x, y);
        }
        context.stroke();
      });
      context.globalAlpha = 1;
      t += 0.002;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [colors, waveOpacity]);
  return (
    <div className={cn("wavy-shell", containerClassName)}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className={cn("wavy-content", className)}>{children}</div>
    </div>
  );
}
