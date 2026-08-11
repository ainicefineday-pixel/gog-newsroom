"use client";

// เทอร์มินัลจำลอง + ป้ายวิ่ง
// ---------------------------------------------------------------------------
// โครงเดียวกับ Terminal / TypingAnimation / AnimatedSpan และ Marquee ของ Magic UI
// แต่ทำด้วย CSS ล้วน ไม่มี motion/react และไม่มี setInterval พิมพ์ทีละตัวอักษร
//   - พิมพ์ดีดใช้ steps() กับความกว้าง ทำให้เบราว์เซอร์คุมเฟรมเอง
//   - บรรทัดถัดไปโผล่ด้วย animation-delay ไม่ต้องตั้งเวลาใน JS
// ผลคือไม่มี timer ค้างเวลาผู้ใช้สลับแท็บ และไม่กิน CPU ตอนเลื่อนพ้นจอ

import type { ReactNode } from "react";

export function Terminal({ title = "gog-newsroom", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="terminal">
      <header className="terminal-bar">
        <i /><i /><i />
        <span>{title}</span>
      </header>
      {/* log ของเครื่องจริง อ่านทีเดียวจบดีกว่าถูกอ่านทีละบรรทัดตามจังหวะแอนิเมชัน */}
      <div className="terminal-body" role="status" aria-live="polite">{children}</div>
    </div>
  );
}

/** บรรทัดที่พิมพ์ทีละตัว — delay หน่วยวินาที */
export function TypingAnimation({ children, delay = 0, className = "" }: {
  children: string;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      className={`terminal-line typing ${className}`.trim()}
      style={{
        animationDelay: `${delay}s, ${delay}s`,
        // steps เท่าจำนวนตัวอักษร ทำให้เคอร์เซอร์หยุดพอดีทุกตัว
        ["--chars" as string]: `${children.length}`,
      }}
    >
      {children}
    </span>
  );
}

/** บรรทัดที่โผล่มาทั้งบรรทัด ใช้กับผลลัพธ์ที่ไม่ต้องดูเหมือนคนพิมพ์ */
export function AnimatedSpan({ children, delay = 0, tone = "ok" }: {
  children: ReactNode;
  delay?: number;
  tone?: "ok" | "info" | "warn";
}) {
  return (
    <span className={`terminal-line reveal ${tone}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </span>
  );
}

/**
 * ป้ายวิ่ง — ทำสำเนาสองชุดต่อกันเพื่อให้วนไม่มีรอยต่อ
 * หยุดเมื่อเอาเมาส์ชี้ เพราะถ้าอ่านชื่อแหล่งข่าวไม่ทันแล้วมันวิ่งหนี คือใช้งานไม่ได้จริง
 */
export function Marquee({ children, reverse = false, duration = 34 }: {
  children: ReactNode;
  reverse?: boolean;
  duration?: number;
}) {
  return (
    <div className={`marquee${reverse ? " reverse" : ""}`}>
      {[0, 1].map((copy) => (
        <div className="marquee-track" key={copy} aria-hidden={copy === 1} style={{ animationDuration: `${duration}s` }}>
          {children}
        </div>
      ))}
    </div>
  );
}
