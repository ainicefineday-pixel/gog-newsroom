import type { Metadata } from "next";
import Link from "next/link";
import { ContactBlock, LegalPage, LegalSection } from "@/app/legal/legal-page";

const title = "Terms of Service | GOG NEWSROOM";
const description =
  "Terms of Service for GOG NEWSROOM — a Thai-language Manchester United newsroom that curates, summarises and analyses publicly available football news, data and social content.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title,
    description,
    siteName: "GOG NEWSROOM",
    locale: "th_TH",
    type: "article",
    url: "/terms",
    images: [{ url: "/og.png", alt: "GOG NEWSROOM" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "service", title: "Description of Service" },
  { id: "editorial", title: "News and Editorial Content" },
  { id: "third-party", title: "Third-Party Sources and Links" },
  { id: "ip", title: "Intellectual Property" },
  { id: "responsibilities", title: "User Responsibilities" },
  { id: "prohibited", title: "Prohibited Uses" },
  { id: "accuracy", title: "Accuracy and Availability of Information" },
  { id: "warranties", title: "Disclaimer of Warranties" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "service-changes", title: "Changes to the Service" },
  { id: "terms-changes", title: "Changes to These Terms" },
  { id: "governing", title: "Governing Terms" },
  { id: "contact", title: "Contact Information" },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of Service"
      thaiTitle="ข้อกำหนดการใช้งาน GOG NEWSROOM"
      sections={SECTIONS}
      summary={
        <p>
          GOG NEWSROOM เป็นสื่อข่าวอิสระของแฟนแมนเชสเตอร์ ยูไนเต็ดชาวไทย
          เรานำเสนอเฉพาะพาดหัวและสรุปสั้นพร้อมลิงก์กลับไปยังต้นฉบับเสมอ
          <strong> ไม่ได้สังกัดหรือได้รับการรับรองจากสโมสรแมนเชสเตอร์ ยูไนเต็ด</strong>{" "}
          เครื่องหมายการค้า ตราสโมสร และเนื้อหาข่าวทั้งหมดยังเป็นของเจ้าของเดิม
          การใช้งานเว็บไซต์นี้ถือว่าคุณยอมรับข้อกำหนดด้านล่าง
        </p>
      }
    >
      <LegalSection id="acceptance" n={1} title="Acceptance of Terms" thai="การยอมรับข้อกำหนด">
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to and use of GOG NEWSROOM (the
          &ldquo;Service&rdquo;), including all pages, feeds, data views and tools published under this website. By
          accessing or using the Service, you agree to be bound by these Terms.
        </p>
        <p>
          If you do not agree with any part of these Terms, please discontinue use of the Service. No account
          registration or login is required to read the Service, and these Terms apply to every visitor.
        </p>
      </LegalSection>

      <LegalSection id="service" n={2} title="Description of Service" thai="ลักษณะของบริการ">
        <p>
          GOG NEWSROOM is an independent, Thai-language digital newsroom focused on Manchester United Football
          Club. The Service collects publicly available material, organises it, and presents it for Thai-speaking
          supporters. Its main components are:
        </p>
        <ul>
          <li>
            <strong>Newsroom feed</strong> — headlines gathered from public RSS feeds and licensed news APIs,
            grouped into stories, scored for source credibility, and summarised in Thai.
          </li>
          <li>
            <strong>Match centre and fixtures</strong> — schedules, results, standings and match statistics
            supplied by third-party football data providers.
          </li>
          <li>
            <strong>Tactical Replay Lab</strong> — deterministic, illustrative reconstructions of selected matches
            built from published aggregate statistics and confirmed event anchors. These reconstructions are{" "}
            <strong>not official tracking data</strong> and are labelled as such within the Service.
          </li>
          <li>
            <strong>Player intelligence and data views</strong> — derived metrics computed from third-party
            provider data, presented with confidence indicators.
          </li>
          <li>
            <strong>Video shelf</strong> — links to publicly available YouTube and TikTok clips selected by the
            editorial team, embedded only after you choose to play them.
          </li>
          <li>
            <strong>Trip planner and partner network</strong> — travel planning tools for supporters visiting
            matches, and a directory of independent local service providers who have applied to be listed.
          </li>
        </ul>
        <p>
          The Service is provided free of charge for personal, non-commercial use. Some components depend on
          third-party API keys; where a data provider is unavailable or not configured, the Service displays a
          clearly marked demonstration or unavailable state rather than presenting unverified figures as fact.
        </p>
      </LegalSection>

      <LegalSection id="editorial" n={3} title="News and Editorial Content" thai="เนื้อหาข่าวและบทบรรณาธิการ">
        <p>
          GOG NEWSROOM does not republish full articles. For each story the Service stores and displays only a
          headline, a short excerpt or summary, verification metadata, and a link back to the original source.
          Readers are directed to the original publisher to read the complete article.
        </p>
        <p>
          Thai-language summaries, suggested angles and daily digests may be generated with the assistance of
          automated language models operating on the collected source material. Editorial judgement, source
          selection and credibility scoring remain the responsibility of GOG NEWSROOM. Automated summarisation can
          introduce errors; where a summary and the original source conflict, <strong>the original source
          prevails</strong>.
        </p>
        <p>
          Content marked as reconstructed, illustrative, unverified or demonstration data must not be presented or
          relied upon as confirmed fact. Transfer rumours, speculation and aggregated reports are labelled with a
          credibility indicator and remain the claims of the originating publisher.
        </p>
      </LegalSection>

      <LegalSection id="third-party" n={4} title="Third-Party Sources and Links" thai="แหล่งข่าวและลิงก์ภายนอก">
        <p>
          The Service aggregates and links to material published by independent third parties, including news
          organisations, football data providers, social platforms and public information services. GOG NEWSROOM
          does not control, endorse, or assume responsibility for third-party content, and inclusion of a source
          does not imply any partnership between that source and GOG NEWSROOM.
        </p>
        <p>
          When you follow an outbound link or play an embedded video, you leave the Service and the terms and
          privacy practices of that third party apply. Third-party embeds are loaded only after you actively choose
          to play them.
        </p>
        <p>
          Source availability changes over time. A publisher may block automated access, change its feed, or
          withdraw content; in those cases the Service reports the source as unavailable rather than substituting
          unverified material.
        </p>
      </LegalSection>

      <LegalSection id="ip" n={5} title="Intellectual Property" thai="ทรัพย์สินทางปัญญา">
        <div className="legal-callout">
          GOG NEWSROOM is an independent supporter-run publication. It is{" "}
          <strong>not affiliated with, endorsed by, sponsored by, or officially connected to Manchester United
          Football Club</strong>, the Premier League, or any other club, competition or governing body.
        </div>
        <p>
          All third-party trademarks, club names, crests, logos, player likenesses, broadcast marks, article text,
          photographs, video and other source material remain the exclusive property of their respective owners.
          They appear on the Service for the purpose of news reporting, identification and commentary only.
        </p>
        <p>
          The original elements of the Service — including its interface design, layout, source code, Thai-language
          editorial writing, credibility model, derived metrics, and the GOG NEWSROOM and DM ENGINE™ names and
          marks — belong to GOG NEWSROOM and its creators and may not be copied, reproduced or reused without
          permission.
        </p>
        <p>
          If you own rights in material presented on the Service and believe it has been used improperly, contact
          us using the details in section 14 and we will review and, where appropriate, remove or amend the
          material.
        </p>
      </LegalSection>

      <LegalSection id="responsibilities" n={6} title="User Responsibilities" thai="ความรับผิดชอบของผู้ใช้">
        <p>By using the Service you agree that:</p>
        <ul>
          <li>You will use the Service for lawful, personal and non-commercial purposes.</li>
          <li>
            You will verify information against the linked original source before relying on it, republishing it, or
            making any decision based on it.
          </li>
          <li>
            Any information you submit — for example a travel booking enquiry or a partner listing application — is
            accurate, is yours to provide, and does not include another person&rsquo;s details without their consent.
          </li>
          <li>
            You are responsible for your own arrangements with any independent partner, supplier or travel provider
            you contact through the Service. GOG NEWSROOM introduces parties and does not act as agent, tour
            operator, broker or guarantor for either side.
          </li>
          <li>You will respect the intellectual property rights of GOG NEWSROOM and of all third-party sources.</li>
        </ul>
      </LegalSection>

      <LegalSection id="prohibited" n={7} title="Prohibited Uses" thai="การใช้งานที่ห้าม">
        <p>You must not:</p>
        <ul>
          <li>
            Scrape, harvest, mirror, or systematically extract content or data from the Service, or use it to build
            a competing dataset or product.
          </li>
          <li>
            Republish substantial portions of the Service&rsquo;s editorial output, derived metrics or reconstructions
            without attribution and permission.
          </li>
          <li>
            Interfere with the Service&rsquo;s operation — including attempts to overload, disrupt, probe, or gain
            unauthorised access to any part of the Service, its APIs, its database, or its underlying
            infrastructure.
          </li>
          <li>
            Bypass or attempt to bypass any authentication, rate limit, access control or protective measure,
            including the bearer-token protection on administrative and synchronisation endpoints.
          </li>
          <li>
            Submit false, misleading or fraudulent booking enquiries or partner applications, or impersonate any
            person or organisation.
          </li>
          <li>
            Use the Service to publish or transmit unlawful, defamatory, harassing, hateful or infringing material.
          </li>
          <li>
            Remove, obscure or alter any attribution, source link, credibility indicator, or data-status label
            (confirmed, reconstructed, unverified or demonstration).
          </li>
          <li>
            Use the Service, or content obtained from it, in a way that suggests official endorsement by Manchester
            United Football Club or any other rights holder.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="accuracy" n={8} title="Accuracy and Availability of Information" thai="ความถูกต้องและความพร้อมใช้งาน">
        <p>
          The Service refreshes automatically on a scheduled basis and depends entirely on the availability and
          correctness of third-party sources. Football data is frequently delayed, revised, or corrected after
          publication, and news reporting may be updated or retracted by the originating publisher.
        </p>
        <p>
          GOG NEWSROOM makes reasonable efforts to label the provenance and confidence of what it shows, but does
          not warrant that any headline, statistic, fixture, price estimate, travel figure or derived metric is
          complete, current or accurate. Nothing on the Service constitutes professional, financial, legal, travel,
          immigration or ticketing advice.
        </p>
        <p>
          The Service is provided on an as-available basis and may be unavailable, interrupted or degraded due to
          maintenance, provider outages, infrastructure faults, or circumstances beyond our control. No uptime or
          continuity is guaranteed.
        </p>
      </LegalSection>

      <LegalSection id="warranties" n={9} title="Disclaimer of Warranties" thai="ข้อจำกัดการรับประกัน">
        <p>
          To the fullest extent permitted by applicable law, the Service and all content, data, tools and materials
          made available through it are provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>,
          without warranty of any kind, whether express, implied or statutory.
        </p>
        <p>
          GOG NEWSROOM expressly disclaims all implied warranties of merchantability, fitness for a particular
          purpose, accuracy, non-infringement, and uninterrupted or error-free operation. No advice or information
          obtained from the Service creates any warranty not expressly stated in these Terms.
        </p>
      </LegalSection>

      <LegalSection id="liability" n={10} title="Limitation of Liability" thai="ข้อจำกัดความรับผิด">
        <p>
          To the fullest extent permitted by applicable law, GOG NEWSROOM and its creators, contributors and
          operators shall not be liable for any indirect, incidental, special, consequential, exemplary or punitive
          damages, or for any loss of profits, revenue, data, goodwill or opportunity, arising out of or connected
          with your use of, or inability to use, the Service.
        </p>
        <p>
          This includes, without limitation, losses arising from reliance on published news, statistics, price
          estimates, fixture times or travel information; from third-party content, links or embeds; from service
          interruption or data loss; and from any dealings or arrangements you enter into with an independent
          partner or supplier introduced through the Service.
        </p>
        <p>
          Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under
          applicable law.
        </p>
      </LegalSection>

      <LegalSection id="service-changes" n={11} title="Changes to the Service" thai="การเปลี่ยนแปลงบริการ">
        <p>
          GOG NEWSROOM is under active development. We may add, modify, suspend or discontinue any feature, data
          source, view or endpoint at any time, with or without notice, including removing a data provider or
          retiring a tool. We may also impose limits on certain features or restrict access to parts of the Service.
        </p>
      </LegalSection>

      <LegalSection id="terms-changes" n={12} title="Changes to These Terms" thai="การเปลี่ยนแปลงข้อกำหนดนี้">
        <p>
          We may revise these Terms from time to time. The revised version takes effect when it is published on this
          page, and the &ldquo;Last updated&rdquo; date at the top will be changed accordingly. Material changes will
          be reflected in that date, and your continued use of the Service after publication constitutes acceptance
          of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection id="governing" n={13} title="Governing Terms" thai="กฎหมายและเงื่อนไขที่ใช้บังคับ">
        <p>
          GOG NEWSROOM is operated from Thailand and is intended primarily for a Thai-speaking audience. These Terms
          are governed by and construed in accordance with the laws of the Kingdom of Thailand, without regard to
          conflict of law principles. Personal data handling is described separately in our{" "}
          <Link href="/privacy">Privacy Policy</Link> and is intended to align with the Thailand Personal Data
          Protection Act B.E. 2562 (2019).
        </p>
        <p>
          If any provision of these Terms is held to be invalid or unenforceable, that provision will be limited or
          severed to the minimum extent necessary, and the remaining provisions will remain in full force. Our
          failure to enforce any right or provision is not a waiver of it.
        </p>
        <p>
          These Terms, together with the Privacy Policy, constitute the entire agreement between you and GOG
          NEWSROOM in relation to the Service.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={14} title="Contact Information" thai="ช่องทางติดต่อ">
        <p>
          For questions about these Terms, rights enquiries, corrections, or takedown requests, contact GOG
          NEWSROOM at:
        </p>
        <ContactBlock />
        <p>
          Please include the page URL and, for a correction or takedown request, the specific headline or item
          concerned so that we can locate it quickly.
        </p>
      </LegalSection>

      <p className="legal-foot-note">
        GOG NEWSROOM · GENIUS ON THE GROUND — independent supporter media, not affiliated with Manchester United
        Football Club. Article copyright remains with the original publishers. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
