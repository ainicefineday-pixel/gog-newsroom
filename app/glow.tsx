"use client";

// เอฟเฟกต์เรืองแสงสองแบบ
// ---------------------------------------------------------------------------
// GlowingEffect      — ขอบเรืองแสงตามตำแหน่งเมาส์ (แนวคิดจาก Aceternity UI)
// BackgroundGradient — ฮาโลไล่สีหมุนรอบการ์ดตลอดเวลา
//
// ทั้งคู่ทำด้วย CSS ไม่มี motion/react
//
// GlowingEffect ใช้ pointermove ตัวเดียวที่ window แล้วอัปเดตทุกการ์ดในรอบเดียว
// ไม่ใช่ผูก listener ต่อการ์ด เพราะต้องรู้ระยะห่างตอนเมาส์ยัง "ใกล้แต่ยังไม่ถึง"
// ซึ่ง listener ที่ผูกกับตัวการ์ดจะไม่ยิงเลย และหน่วงด้วย rAF ให้อัปเดตเฟรมละครั้ง
//
// ใช้ให้ถูกที่: BackgroundGradient คือป้าย "อันนี้พิเศษ" ถ้าใส่ทุกที่จะไม่เหลือความหมาย
// ในเว็บนี้จึงใส่แค่แพ็กเกจ GOG VISA UK กับหัวใจของระบบข่าว

import { useEffect, useRef, type ReactNode } from "react";

/** การ์ดทุกใบที่กำลังแสดงอยู่ พร้อมค่าที่ตั้งไว้ของแต่ละใบ */
const registry = new Set<{ element: HTMLElement; proximity: number; spread: number }>();
let frame = 0;
let pointer = { x: 0, y: 0 };
let listening = false;

function paint() {
  frame = 0;
  for (const entry of registry) {
    const rect = entry.element.getBoundingClientRect();
    const x = pointer.x - rect.left;
    const y = pointer.y - rect.top;
    // ระยะจากเมาส์ถึงขอบกล่องที่ใกล้ที่สุด — 0 เมื่ออยู่ในกล่อง
    const distance = Math.hypot(
      Math.max(rect.left - pointer.x, 0, pointer.x - rect.right),
      Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom),
    );
    const strength = distance > entry.proximity ? 0 : 1 - distance / entry.proximity;
    entry.element.style.setProperty("--glow-x", `${x}px`);
    entry.element.style.setProperty("--glow-y", `${y}px`);
    entry.element.style.setProperty("--glow-spread", `${entry.spread}px`);
    entry.element.style.setProperty("--glow-opacity", strength.toFixed(3));
  }
}

function onPointerMove(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY };
  if (!frame) frame = requestAnimationFrame(paint);
}

/**
 * วางไว้ในกล่องที่ position: relative แล้วขอบของกล่องนั้นจะเรืองตามเมาส์
 * spread คือรัศมีแสง proximity คือระยะที่เริ่มติด
 */
export function GlowingEffect({ spread = 130, proximity = 90, disabled = false }: {
  spread?: number;
  proximity?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (disabled) return;
    const host = ref.current?.parentElement;
    if (!host) return;
    // เมาส์อย่างเดียว — บนมือถือไม่มีตัวชี้ ใส่ไปก็ได้แค่กิน CPU
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const entry = { element: host, proximity, spread };
    registry.add(entry);
    if (!listening) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      listening = true;
    }
    return () => {
      registry.delete(entry);
      host.style.removeProperty("--glow-opacity");
      if (registry.size === 0 && listening) {
        window.removeEventListener("pointermove", onPointerMove);
        listening = false;
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
      }
    };
  }, [disabled, proximity, spread]);

  return <span className="glowing-effect" ref={ref} aria-hidden="true" />;
}

/**
 * ฮาโลไล่สีหมุนรอบกล่อง — ใช้กับของที่ต้องเด่นตลอดเวลา ไม่ต้องรอเมาส์
 * ครอบเนื้อหาไว้ข้างใน เหมือน BackgroundGradient ต้นฉบับ
 */
export function BackgroundGradient({ children, className = "", tone = "gold" }: {
  children: ReactNode;
  className?: string;
  tone?: "gold" | "red";
}) {
  return (
    <div className={`bg-gradient-glow tone-${tone} ${className}`.trim()}>
      {/* ตัวนอกเป็นหน้ากากรูปกรอบ ตัวในเป็นวงไล่สีที่หมุนอยู่ข้างหลังหน้ากาก
          แยกสองชั้นแทนการหมุนมุมของ conic-gradient ผ่าน @property
          เพราะถ้าเบราว์เซอร์ไม่รู้จัก @property ตัวแปรจะใช้ไม่ได้ทั้ง gradient
          กลายเป็นไม่มีพื้นหลังเลย = ขอบหายไปทั้งเส้น ไม่ใช่แค่ไม่หมุน
          วิธีนี้แย่ที่สุดคือไม่หมุน แต่เส้นขอบยังอยู่ */}
      <span className="bg-gradient-halo" aria-hidden="true">
        <i className="bg-gradient-spin" />
      </span>
      <div className="bg-gradient-inner">{children}</div>
    </div>
  );
}
