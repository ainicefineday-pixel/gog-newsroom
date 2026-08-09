import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "GOG NEWSROOM | Manchester United News Intelligence";
const description = "ศูนย์ข่าวแมนเชสเตอร์ ยูไนเต็ดสำหรับแฟนบอลไทย คัดกรอง ตรวจสอบ และจัดอันดับทุกประเด็นสำคัญ";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/gog-logo-dark.png", shortcut: "/gog-logo-dark.png" },
    openGraph: {
      title,
      description,
      siteName: "GOG NEWSROOM",
      locale: "th_TH",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/gog-team.jpg`, width: 2048, height: 1152, alt: "GOG — Genius on the Ground" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/gog-team.jpg`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
