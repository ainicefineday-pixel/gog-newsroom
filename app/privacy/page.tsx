import type { Metadata } from "next";
import Link from "next/link";
import { ContactBlock, ContactEmail, LegalPage, LegalSection } from "@/app/legal/legal-page";

const title = "Privacy Policy | GOG NEWSROOM";
const description =
  "Privacy Policy for GOG NEWSROOM — what data the newsroom collects, how social platform integrations such as TikTok and YouTube are used, how information is stored and shared, and how to request deletion.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title,
    description,
    siteName: "GOG NEWSROOM",
    locale: "th_TH",
    type: "article",
    url: "/privacy",
    images: [{ url: "/og.png", alt: "GOG NEWSROOM" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const SECTIONS = [
  { id: "collect", title: "Information We Collect" },
  { id: "provided", title: "Information Users Provide" },
  { id: "automatic", title: "Automatically Collected Information" },
  { id: "cookies", title: "Cookies and Similar Technologies" },
  { id: "social", title: "Social Media Platform Integrations" },
  { id: "tiktok", title: "TikTok Data" },
  { id: "use", title: "How Information Is Used" },
  { id: "sharing", title: "Data Sharing" },
  { id: "processors", title: "Third-Party Services" },
  { id: "retention", title: "Data Retention" },
  { id: "security", title: "Data Security" },
  { id: "rights", title: "User Rights" },
  { id: "deletion", title: "Data Deletion Requests" },
  { id: "children", title: "Children's Privacy" },
  { id: "international", title: "International Data Processing" },
  { id: "changes", title: "Changes to This Privacy Policy" },
  { id: "contact", title: "Contact Information" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy Policy"
      thaiTitle="นโยบายความเป็นส่วนตัว GOG NEWSROOM"
      sections={SECTIONS}
      summary={
        <p>
          อ่านข่าวบน GOG NEWSROOM ได้โดย<strong>ไม่ต้องสมัครสมาชิกและไม่ต้องล็อกอิน</strong>{" "}
          เราไม่ตั้งคุกกี้ของตัวเอง ไม่ใช้ระบบวิเคราะห์ผู้ใช้ ไม่มีเครือข่ายโฆษณา และ
          <strong> ไม่เก็บข้อมูลผู้ใช้จาก TikTok</strong> — เราเรียกเฉพาะข้อมูลสาธารณะของคลิป
          (ชื่อคลิป ภาพปก ชื่อช่อง) ผ่าน oEmbed เท่านั้น ข้อมูลส่วนบุคคลจะถูกเก็บก็ต่อเมื่อคุณ
          กรอกส่งเอง เช่น ส่งคำขอจองบริการเดินทาง หรือสมัครเป็นพาร์ตเนอร์
        </p>
      }
    >
      <LegalSection id="collect" n={1} title="Information We Collect" thai="ข้อมูลที่เราเก็บ">
        <div className="legal-callout is-strong">
          GOG NEWSROOM has <strong>no user accounts and no login</strong>. Reading the newsroom, match centre,
          replay lab, data views and video shelf requires no registration and no personal information whatsoever.
        </div>
        <p>The Service handles three categories of information:</p>
        <ul>
          <li>
            <strong>Information you actively submit</strong> — only if you choose to use the travel booking enquiry
            or partner application features (section 2).
          </li>
          <li>
            <strong>Technical request information</strong> — standard web server and platform logs generated when
            any browser requests a page (section 3).
          </li>
          <li>
            <strong>Publicly available third-party content</strong> — news headlines, football statistics, public
            social posts and public video metadata collected for editorial purposes. This is published material
            about public figures, clubs and organisations, not information about visitors to this site.
          </li>
        </ul>
        <p>
          We do not collect biometric data, precise geolocation, contact lists, device identifiers for advertising,
          or payment card details. The Service processes no payments.
        </p>
      </LegalSection>

      <LegalSection id="provided" n={2} title="Information Users Provide" thai="ข้อมูลที่ผู้ใช้ส่งให้เราเอง">
        <p>
          These features are optional. If you never use them, we hold no personal information about you beyond the
          technical logs in section 3.
        </p>

        <h3>Travel booking enquiries</h3>
        <p>
          When you send an enquiry to an independent partner through the trip planner, we store the details you
          enter so the request can be delivered and tracked: your name, the contact detail you supply (such as an
          email address, phone number or LINE ID), the service date, the number of travellers, and any free-text
          message or note. A grouped request also stores the trip title, the related match, and your departure and
          return dates.
        </p>

        <h3>Partner listing applications</h3>
        <p>
          If you apply to be listed as a local partner (driver, guide, photographer, accommodation or restaurant),
          we store your display name, legal name, city and service areas, languages, biography, contact details
          (email, phone, LINE ID), service and vehicle details, and records relating to verification documents and
          listing status.
        </p>

        <h3>Saved trip plans</h3>
        <p>
          Trip plans you save are stored as an itinerary record with a title. Trip plans contain travel preferences
          and schedule details rather than identity information, unless you type personal details into a free-text
          field.
        </p>

        <h3>Editorial submissions</h3>
        <p>
          Adding video links to the newsroom is an editorial function protected by a bearer secret and is not
          available to the public. Submitted links are stored as public video metadata, not as personal data.
        </p>

        <div className="legal-callout">
          Please do not enter another person&rsquo;s personal details, or any sensitive information (health,
          religion, biometric or financial data), into free-text fields. The Service does not require it.
        </div>
      </LegalSection>

      <LegalSection id="automatic" n={3} title="Automatically Collected Information" thai="ข้อมูลที่เก็บอัตโนมัติ">
        <p>
          The Service runs on Cloudflare Workers. As with any website, requests generate technical records handled
          by the hosting platform, which may include IP address, user agent string, requested URL, referrer,
          timestamp, response status and approximate region derived from the network edge.
        </p>
        <p>
          Application logging (Cloudflare Workers Observability) is enabled to record invocation and error
          information so faults and abuse can be diagnosed. These records are operational, are not used to build
          profiles of readers, are not combined with any advertising identifier, and are not sold or shared for
          marketing.
        </p>
        <p>
          We do <strong>not</strong> operate any analytics SDK, tag manager, advertising pixel, session recorder,
          heatmap tool, or cross-site tracker on this Service.
        </p>
      </LegalSection>

      <LegalSection id="cookies" n={4} title="Cookies and Similar Technologies" thai="คุกกี้และเทคโนโลยีที่คล้ายกัน">
        <p>
          <strong>GOG NEWSROOM does not set any cookies of its own.</strong> There is no login session, no
          preference cookie, no analytics cookie and no advertising cookie issued by this Service.
        </p>
        <p>
          The Service does use your browser&rsquo;s <code>localStorage</code> for one purpose: remembering your
          playback and synchronisation preferences for the on-site anthem player. That information stays on your
          device, is never transmitted to our servers, and can be cleared at any time through your browser&rsquo;s
          site-data settings.
        </p>
        <p>
          Embedded third-party players are loaded <strong>only after you click play</strong>. Until you do, no
          YouTube or TikTok script, frame or cookie is loaded on the page. YouTube embeds use the privacy-enhanced{" "}
          <code>youtube-nocookie.com</code> domain. Once you start playback, the relevant platform may set its own
          cookies or local storage under its own privacy policy, over which we have no control.
        </p>
        <p>
          Map tiles are served by OpenStreetMap when you open a map view, which involves a request to their servers.
        </p>
      </LegalSection>

      <LegalSection id="social" n={5} title="Social Media Platform Integrations" thai="การเชื่อมต่อกับแพลตฟอร์มโซเชียล">
        <p>
          The Service integrates with several public platform interfaces for editorial purposes. None of these
          integrations involve logging in as a visitor, and none give us access to your personal social media
          account.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <caption>PLATFORM INTEGRATIONS AND WHAT THEY ACCESS</caption>
            <thead>
              <tr>
                <th scope="col">Platform</th>
                <th scope="col">What we access</th>
                <th scope="col">Visitor data involved</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">TikTok</th>
                <td>Public oEmbed metadata for a public video URL supplied by an editor; click-to-load embed player</td>
                <td>None</td>
              </tr>
              <tr>
                <th scope="row">YouTube</th>
                <td>
                  YouTube Data API v3 for public statistics of the publicly listed GOG channel and for public video
                  metadata; click-to-load <code>youtube-nocookie</code> embed
                </td>
                <td>None</td>
              </tr>
              <tr>
                <th scope="row">X (Twitter)</th>
                <td>
                  Optional collector for a fixed watchlist of public accounts, via an authorised provider or a lawful
                  public feed; stores public post text and public engagement counts
                </td>
                <td>None</td>
              </tr>
              <tr>
                <th scope="row">Facebook / Instagram</th>
                <td>Outbound profile links only — no API integration</td>
                <td>None</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The X collector operates only on publicly visible posts from a configured list of accounts. It does not
          attempt authentication bypass, CAPTCHA solving, private-data access or anti-bot evasion, and it is
          disabled entirely unless an authorised provider is configured.
        </p>
      </LegalSection>

      <LegalSection id="tiktok" n={6} title="TikTok Data" thai="ข้อมูลจาก TikTok">
        <div className="legal-callout is-strong">
          GOG NEWSROOM does <strong>not</strong> use TikTok Login, TikTok OAuth, or any TikTok API that returns user
          data. We hold <strong>no TikTok access tokens, no TikTok user identifiers, no TikTok profile
          information, no follower or friend lists, no direct messages, and no private TikTok content</strong>.
        </div>
        <p>
          Our only interaction with TikTok is the public{" "}
          <a href="https://developers.tiktok.com/doc/embed-videos" target="_blank" rel="noreferrer noopener">
            oEmbed and video embed
          </a>{" "}
          interface, which requires no key and no authorisation:
        </p>
        <ul>
          <li>
            <strong>What triggers it</strong> — a member of the editorial team pastes the URL of a public TikTok
            video into the newsroom. Visitors cannot trigger this.
          </li>
          <li>
            <strong>What is requested</strong> — the public oEmbed record for that URL.
          </li>
          <li>
            <strong>What is stored</strong> — the video ID, the public video URL, the video title, the public
            thumbnail URL and the public author name, so the clip can be listed without calling TikTok again on
            every page view.
          </li>
          <li>
            <strong>How it is used</strong> — solely to display a cover image and caption for a clip on the news
            page.
          </li>
          <li>
            <strong>Who it is shared with</strong> — nobody. This metadata is not sold, transferred, licensed or
            disclosed to any third party.
          </li>
          <li>
            <strong>How it is deleted</strong> — an editor can remove a clip at any time, which deletes the stored
            metadata record from our database. Requests to remove a specific clip can also be sent to the contact
            address in section 17.
          </li>
        </ul>
        <p>
          When a visitor clicks play, the clip is rendered in an official TikTok embed frame served directly by
          TikTok. From that moment TikTok may process data under its own privacy policy; we receive nothing back
          from that interaction and cannot see who watched what.
        </p>
        <p>
          If GOG NEWSROOM later adopts TikTok Login or any TikTok API that returns user data, this Privacy Policy
          will be updated to describe exactly what is received, how it is used, how long it is kept and how it can
          be deleted, before any such integration goes live.
        </p>
      </LegalSection>

      <LegalSection id="use" n={7} title="How Information Is Used" thai="เราใช้ข้อมูลอย่างไร">
        <p>Information is used only for the purpose it was provided or generated:</p>
        <ul>
          <li>
            <strong>Booking enquiry details</strong> — to pass your request to the specific partner you selected, to
            let that partner respond, and to keep a record of the request status.
          </li>
          <li>
            <strong>Partner application details</strong> — to verify an applicant, publish an approved public
            listing, and match travellers to suitable partners by city, date and party size.
          </li>
          <li>
            <strong>Technical logs</strong> — to operate, secure, debug and maintain the Service, and to detect
            abuse or automated attacks.
          </li>
          <li>
            <strong>Public editorial material</strong> — to produce the newsroom feed, Thai-language summaries,
            credibility scoring, daily digests and data views.
          </li>
        </ul>
        <p>
          We do not use your information for advertising, profiling, automated decision-making with legal effect, or
          sale to data brokers. We do not send marketing email.
        </p>
        <p>
          Public source material collected for editorial purposes may be processed by an automated language model to
          produce Thai-language summaries. Only public news content is sent for this processing — booking enquiries
          and partner application details are never sent to it.
        </p>
      </LegalSection>

      <LegalSection id="sharing" n={8} title="Data Sharing" thai="การเปิดเผยข้อมูล">
        <p>
          <strong>We do not sell, rent or trade personal information.</strong> Information is disclosed only in these
          situations:
        </p>
        <ul>
          <li>
            <strong>To the partner you contacted</strong> — a booking enquiry is shared with that specific partner so
            they can respond. Partner contact details are released to a traveller only after the partner accepts the
            request; likewise, your request is not broadcast to partners you did not select.
          </li>
          <li>
            <strong>To infrastructure and service providers</strong> — listed in section 9, acting on our behalf to
            host and operate the Service.
          </li>
          <li>
            <strong>Where required by law</strong> — to comply with a valid legal obligation, court order or lawful
            request from a competent authority, or to establish, exercise or defend legal claims.
          </li>
          <li>
            <strong>To protect the Service</strong> — where necessary to investigate or prevent fraud, abuse, or a
            security incident.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="processors" n={9} title="Third-Party Services" thai="ผู้ให้บริการภายนอก">
        <p>
          The Service depends on the following third parties. Each operates under its own privacy policy and terms.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <caption>SERVICE PROVIDERS AND DATA SOURCES</caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Cloudflare</th>
                <td>Hosting, edge network, application database (D1), platform logging</td>
              </tr>
              <tr>
                <th scope="row">Anthropic</th>
                <td>Automated Thai-language summarisation of public news content</td>
              </tr>
              <tr>
                <th scope="row">football-data.org · API-Football</th>
                <td>Fixtures, results, standings, line-ups and match statistics</td>
              </tr>
              <tr>
                <th scope="row">The Guardian Open Platform · NewsAPI · public RSS feeds</th>
                <td>Public news headlines and excerpts</td>
              </tr>
              <tr>
                <th scope="row">YouTube Data API · TikTok oEmbed</th>
                <td>Public video and channel metadata</td>
              </tr>
              <tr>
                <th scope="row">Open-Meteo · Frankfurter</th>
                <td>Weather forecasts and currency reference rates for trip planning</td>
              </tr>
              <tr>
                <th scope="row">OpenStreetMap</th>
                <td>Map tiles for stadium and travel views</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Calls to these providers are made by our server on our own behalf, not on yours, and do not carry your
          personal information — with the exception of map tiles and embedded players, which your browser requests
          directly once you open a map or press play.
        </p>
      </LegalSection>

      <LegalSection id="retention" n={10} title="Data Retention" thai="ระยะเวลาเก็บข้อมูล">
        <ul>
          <li>
            <strong>Booking enquiries</strong> — kept while the request is being handled and for a reasonable period
            afterwards as a record of the introduction, then deleted on request.
          </li>
          <li>
            <strong>Partner listings and verification records</strong> — kept while the listing is active. If a
            listing is withdrawn or rejected, the record is removed on request.
          </li>
          <li>
            <strong>Saved trip plans</strong> — kept until deleted.
          </li>
          <li>
            <strong>Editorial content</strong> — headlines, summaries, public post metadata, football statistics and
            derived metrics are retained as a historical archive so that trends and past coverage remain available.
          </li>
          <li>
            <strong>Platform and application logs</strong> — retained by Cloudflare according to its standard
            retention for the plan in use, then discarded.
          </li>
        </ul>
        <p>
          Where you ask us to delete personal information and we have no legal obligation to keep it, we will remove
          it as described in section 13.
        </p>
      </LegalSection>

      <LegalSection id="security" n={11} title="Data Security" thai="ความปลอดภัยของข้อมูล">
        <ul>
          <li>All traffic is served over HTTPS/TLS.</li>
          <li>
            Data is stored in Cloudflare D1 within Cloudflare&rsquo;s infrastructure and is not exposed publicly.
          </li>
          <li>
            API credentials are held as platform secrets, are never committed to the source repository, and are not
            exposed to the browser.
          </li>
          <li>
            Administrative and synchronisation endpoints that change data require a bearer secret and are unavailable
            until that secret is configured.
          </li>
          <li>
            Partner contact details are withheld from public listings and are released only when a booking request is
            accepted.
          </li>
          <li>The Service processes no payment card data.</li>
        </ul>
        <p>
          No method of transmission or storage is completely secure. While we take reasonable measures appropriate to
          the limited data we hold, we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection id="rights" n={12} title="User Rights" thai="สิทธิของเจ้าของข้อมูล">
        <p>
          Subject to applicable law, including the Thailand Personal Data Protection Act B.E. 2562 (2019), you have
          the right to:
        </p>
        <ul>
          <li>Access the personal information we hold about you and request a copy.</li>
          <li>Request correction of information that is inaccurate, incomplete or out of date.</li>
          <li>Request deletion of your personal information (section 13).</li>
          <li>Object to, or request restriction of, processing in certain circumstances.</li>
          <li>Withdraw consent where processing is based on consent, without affecting prior lawful processing.</li>
          <li>Request data portability where technically applicable.</li>
          <li>Lodge a complaint with the competent data protection authority.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us using the details in section 17. We may ask for information
          sufficient to confirm that the request relates to your own data.
        </p>
      </LegalSection>

      <LegalSection id="deletion" n={13} title="Data Deletion Requests" thai="การขอลบข้อมูล">
        <p>
          To request deletion, send a message to <ContactEmail /> with the subject{" "}
          <strong>&ldquo;Data deletion request&rdquo;</strong> and include:
        </p>
        <ul>
          <li>The name and contact detail you originally submitted, so we can locate the record.</li>
          <li>
            Which record you want removed — a booking enquiry, a partner listing, a saved trip plan, or an embedded
            clip.
          </li>
        </ul>
        <p>
          We aim to action verified deletion requests within <strong>30 days</strong> and will confirm once the
          records have been removed. Information we are legally required to keep, and anonymised or aggregated
          records that can no longer identify you, may be retained.
        </p>
        <p>
          Because we hold no TikTok user data, no login data and no advertising identifiers, there is nothing of that
          kind for us to delete. Content that has already been published by a third-party platform or news publisher
          must be removed through that platform or publisher directly.
        </p>
      </LegalSection>

      <LegalSection id="children" n={14} title="Children's Privacy" thai="ความเป็นส่วนตัวของเด็ก">
        <p>
          The Service is a general-audience football news publication and is not directed at children under 13. We do
          not knowingly collect personal information from children. Where consent from a parent or legal guardian is
          required under applicable law for a minor, that consent must be obtained before any information is
          submitted through the booking or partner features.
        </p>
        <p>
          If you believe a child has provided personal information to us, contact us using the details in section 17
          and we will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection id="international" n={15} title="International Data Processing" thai="การประมวลผลข้ามประเทศ">
        <p>
          GOG NEWSROOM is operated from Thailand, but the Service runs on a globally distributed edge network.
          Requests are served from the Cloudflare data centre closest to the visitor, and stored data is held within
          Cloudflare&rsquo;s infrastructure, which may be located outside Thailand.
        </p>
        <p>
          Third-party providers listed in section 9 operate in jurisdictions including the United States, the United
          Kingdom and the European Union. By using the Service you understand that information may be processed in
          these locations under the safeguards those providers maintain.
        </p>
      </LegalSection>

      <LegalSection id="changes" n={16} title="Changes to This Privacy Policy" thai="การเปลี่ยนแปลงนโยบายนี้">
        <p>
          We may update this Privacy Policy as the Service evolves. The current version is always published on this
          page, and the &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.
        </p>
        <p>
          Where a change materially affects how personal data is handled — in particular if a new social platform
          integration begins receiving user data — this policy will be updated before that change takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={17} title="Contact Information" thai="ช่องทางติดต่อ">
        <p>
          For privacy questions, data access requests, corrections, or deletion requests, contact GOG NEWSROOM at:
        </p>
        <ContactBlock />
        <p>
          We aim to respond to privacy enquiries within 30 days. See also our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>

      <p className="legal-foot-note">
        GOG NEWSROOM · GENIUS ON THE GROUND — independent supporter media, not affiliated with Manchester United
        Football Club. No user accounts · no first-party cookies · no advertising trackers · no TikTok user data.
      </p>
    </LegalPage>
  );
}
