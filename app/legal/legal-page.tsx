// โครงหน้าเอกสารทางกฎหมาย ใช้ร่วมกันระหว่าง /terms และ /privacy
// ---------------------------------------------------------------------------
// ห่อด้วย .newsroom-shell ตัวเดียวกับหน้าอื่น เพราะ CSS ของท้ายเว็บผูกกับ
// ตัวเลือกลูกโดยตรง (.newsroom-shell > footer) และ <main> ก็รับความกว้าง
// 1440px จาก globals.css มาเองอยู่แล้ว หน้าเหล่านี้จึงกว้างเท่าหน้าอื่นเป๊ะ
//
// เป็น Server Component ล้วน ไม่มี state ไม่มี useEffect — หน้าเอกสารคงที่
// ไม่ควรลาก JS ก้อนใหญ่ของหน้าข่าวมาด้วย

import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/app/site-footer";
import { CONTACT_EMAIL, CONTACT_SOCIAL, LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_LABEL } from "@/config/contact";
import "@/app/legal/legal.css";

type LegalPageProps = {
  /** ใช้ทำ aria-current บนแถบนำทาง */
  current: "terms" | "privacy";
  title: string;
  thaiTitle: string;
  /** สรุปย่อภาษาไทยด้านบนสุด */
  summary: ReactNode;
  /** รายการหัวข้อ ต้องตรงกับ id ของ <LegalSection> ตามลำดับ */
  sections: { id: string; title: string }[];
  children: ReactNode;
};

export function LegalPage({ current, title, thaiTitle, summary, sections, children }: LegalPageProps) {
  return (
    <div className="newsroom-shell">
      <header className="site-header legal-header">
        <Link className="brand" href="/" aria-label="กลับหน้าแรก GOG Newsroom">
          <span className="brand-logo" aria-hidden="true" />
          <span>
            <b>GOG</b> NEWSROOM<small>GENIUS ON THE GROUND · DM ENGINE™</small>
          </span>
        </Link>
        <nav className="legal-nav" aria-label="เอกสารทางกฎหมาย">
          <Link href="/terms" aria-current={current === "terms" ? "page" : undefined}>
            Terms of Service
          </Link>
          <Link href="/privacy" aria-current={current === "privacy" ? "page" : undefined}>
            Privacy Policy
          </Link>
        </nav>
      </header>

      <main id="top" className="legal-main">
        <article className="legal-doc">
          <p className="legal-eyebrow">GOG NEWSROOM · LEGAL</p>
          <h1>{title}</h1>
          <p className="legal-thai-title">{thaiTitle}</p>
          <p className="legal-updated">
            Last updated: <time dateTime={LEGAL_LAST_UPDATED}>{LEGAL_LAST_UPDATED_LABEL}</time>
          </p>

          <div className="legal-summary">
            <h2>สรุปสั้น</h2>
            {summary}
          </div>

          <nav className="legal-toc" aria-label="สารบัญ">
            <h2>CONTENTS</h2>
            <ol>
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

type LegalSectionProps = {
  id: string;
  n: number;
  title: string;
  /** คำแปลหัวข้อภาษาไทย ช่วยให้ผู้อ่านไทยกวาดสายตาหาหัวข้อได้ */
  thai: string;
  children: ReactNode;
};

export function LegalSection({ id, n, title, thai, children }: LegalSectionProps) {
  return (
    <section id={id} className="legal-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>
        <span className="legal-num" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        {title}
        <em>{thai}</em>
      </h2>
      {children}
    </section>
  );
}

/**
 * แสดงอีเมลติดต่อ หรือป้าย TODO ถ้ายังไม่ได้กรอกใน config/contact.ts
 * จงใจให้เห็นชัดว่ายังไม่ได้ตั้งค่า จะได้ไม่ส่งให้ TikTok ตรวจทั้งที่ยังไม่มีช่องทางติดต่อ
 */
export function ContactEmail() {
  if (!CONTACT_EMAIL) {
    return (
      <span className="legal-todo">
        TODO — ยังไม่ได้ตั้งค่าอีเมลติดต่อ (กรอกที่ <code>config/contact.ts</code> → <code>CONTACT_EMAIL</code>)
      </span>
    );
  }
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

export function ContactBlock() {
  return (
    <ul>
      <li>
        Email: <ContactEmail />
      </li>
      <li>
        Public channel:{" "}
        <a href={CONTACT_SOCIAL} target="_blank" rel="noreferrer noopener">
          TikTok @footballgenius_official
        </a>
      </li>
      <li>
        Website:{" "}
        <Link href="/">
          GOG NEWSROOM
        </Link>
      </li>
    </ul>
  );
}
