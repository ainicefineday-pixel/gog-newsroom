"use client";

// AURORA TEXT — ตัวอักษรไล่สีที่เคลื่อนช้า ๆ
// ---------------------------------------------------------------------------
// API เหมือน AuroraText ของ Magic UI (children · className · colors · speed)
// แต่ผูกกับ CSS ของโปรเจกต์เองแทนที่จะดึง registry เข้ามา
// เพราะทั้งเว็บนี้เขียน CSS มือทั้งหมด ไม่ได้ใช้ utility class ของ Tailwind ใน JSX
// ถ้าดึง registry มาจะได้คอมโพเนนต์ที่พึ่ง animate-aurora ซึ่ง config นี้ไม่มี
//
// ต่างจากต้นฉบับตรงที่ไม่ซ้อนชั้นไล่สีทับตัวอักษรที่ซ่อนไว้ แต่ทาไล่สีลงบน
// ตัวอักษรจริงเลย เพราะพาดหัวข่าวในเว็บนี้ยาวหลายบรรทัดและถูกตัดด้วย
// -webkit-line-clamp การครอบด้วย inline-block ที่ซ้อนสองชั้นทำให้ทั้งการตัดบรรทัด
// และการขึ้นบรรทัดใหม่พังทันที ส่วนการอ่านออกเสียงยังปกติเพราะเป็นตัวอักษรจริง

import { memo, type ReactNode } from "react";

/** โทนประจำ GOG — แดงปีศาจไปทอง ไม่ใช่ม่วง-ฟ้าแบบตัวอย่างต้นทาง */
const GOG_AURORA = ["#f13b2e", "#d9aa49", "#f0cc78", "#da291c"];

export const AuroraText = memo(function AuroraText({
  children,
  className = "",
  colors = GOG_AURORA,
  speed = 1,
}: {
  children: ReactNode;
  className?: string;
  colors?: string[];
  /** เร่ง/ชะลอรอบไล่สี — 1 คือ 10 วินาทีต่อรอบ */
  speed?: number;
}) {
  return (
    <span
      className={`aurora-text ${className}`.trim()}
      style={{
        // ปิดท้ายด้วยสีแรกอีกครั้ง เพื่อให้วนกลับมาบรรจบกันโดยไม่กระตุก
        backgroundImage: `linear-gradient(135deg, ${colors.join(", ")}, ${colors[0]})`,
        animationDuration: `${10 / (speed || 1)}s`,
      }}
    >
      {children}
    </span>
  );
});
