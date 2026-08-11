"use client";

// วงกลมแสดงความคืบหน้า
// ---------------------------------------------------------------------------
// API เหมือน AnimatedCircularProgressBar ของ Magic UI
// (value · gaugePrimaryColor · gaugeSecondaryColor) แต่เขียนเองเป็น SVG
// เพราะต้นฉบับใช้ utility class ของ Tailwind ทั้งก้อน ซึ่งไม่ตรงกับที่อื่นของเว็บนี้
//
// เพิ่ม indeterminate เข้ามาเอง และนี่คือเรื่องสำคัญที่สุดของไฟล์นี้:
//   งานที่รู้ความคืบหน้าจริง (การแปลข่าว) เท่านั้นที่ควรโชว์เปอร์เซ็นต์
//   งานที่ไม่รู้ว่าจะเสร็จเมื่อไหร่ (ยิง API ไปแล้วรออยู่) ต้องใช้วงหมุนแบบไม่มีเลข
//   ถ้าเอาเลขปลอมมาโชว์ให้ดูเหมือนมีความคืบหน้า คนจะเชื่อว่าเหลืออีก 40%
//   ทั้งที่จริงอาจค้างอยู่ที่เดิมหรือพังไปแล้ว

const SIZE = 100;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AnimatedCircularProgressBar({
  value = 0,
  min = 0,
  max = 100,
  gaugePrimaryColor = "#f13b2e",
  gaugeSecondaryColor = "rgba(255,255,255,.10)",
  indeterminate = false,
  label,
  className = "",
}: {
  value?: number;
  min?: number;
  max?: number;
  gaugePrimaryColor?: string;
  gaugeSecondaryColor?: string;
  /** ไม่รู้ว่าจะเสร็จเมื่อไหร่ — หมุนไปเรื่อย ๆ ไม่โชว์เปอร์เซ็นต์ */
  indeterminate?: boolean;
  /** ข้อความใต้ตัวเลข เช่น "กำลังแปล" */
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(Math.max(value, min), max);
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div
      className={`gauge${indeterminate ? " indeterminate" : ""} ${className}`.trim()}
      role="progressbar"
      aria-valuemin={indeterminate ? undefined : min}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-label={label ?? (indeterminate ? "กำลังทำงาน" : "ความคืบหน้า")}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={gaugeSecondaryColor} strokeWidth={STROKE}
        />
        <circle
          className="gauge-arc"
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={gaugePrimaryColor} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          // แบบไม่รู้ความคืบหน้าใช้ส่วนโค้งสั้นคงที่แล้วหมุนทั้งวง
          strokeDashoffset={indeterminate ? CIRCUMFERENCE * 0.75 : CIRCUMFERENCE * (1 - percent / 100)}
        />
      </svg>
      {!indeterminate && (
        <span className="gauge-value">{Math.round(percent)}<i>%</i></span>
      )}
      {label && <span className="gauge-label">{label}</span>}
    </div>
  );
}
