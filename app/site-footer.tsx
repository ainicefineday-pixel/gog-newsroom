// ท้ายเว็บที่ใช้ร่วมกันทุกหน้า
// ---------------------------------------------------------------------------
// เดิมมาร์กอัปชุดนี้ฝังอยู่กลาง newsroom.tsx พอเพิ่มหน้า /terms กับ /privacy
// ที่ต้องมีท้ายเว็บชุดเดียวกัน จึงย้ายออกมาเป็นคอมโพเนนต์เดียวให้เรียกใช้ร่วมกัน
// ไม่ก็อปซ้ำ — สไตล์ยังเป็นตัวเดิมทุกบรรทัด (`.newsroom-shell > footer` ใน globals.css)
// ต้องอยู่ใต้ .newsroom-shell เสมอ ไม่งั้นตัวเลือกลูกโดยตรงไม่ทำงาน

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand">
        <span className="brand-logo" aria-hidden="true" />
        <div>
          <b>GOG NEWSROOM</b>
          <small>GENIUS ON THE GROUND | ภารกิจบุกถิ่นผี</small>
        </div>
      </div>
      <p>
        นำเสนอเฉพาะพาดหัวและสรุปสั้นเพื่อการติดตามข่าว · ลิขสิทธิ์บทความเป็นของแหล่งข่าวต้นฉบับ
        <strong>ระบบโดย DM ENGINE™</strong>
      </p>
      <div>
        <span>
          <i /> ระบบออนไลน์
        </span>
        <nav className="footer-legal" aria-label="เอกสารทางกฎหมาย">
          <Link href="/terms">ข้อกำหนดการใช้งาน</Link>
          <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
        </nav>
        <a href="#top">กลับด้านบน ↑</a>
      </div>
    </footer>
  );
}
