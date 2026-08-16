"use client";

// หน้าแอดมิน
// ---------------------------------------------------------------------------
// ล็อกอินด้วยชื่อผู้ใช้กับรหัสผ่าน แล้วแก้ของที่เคยต้องแก้ในโค้ดได้จากที่นี่
// ตั๋วอยู่ในคุกกี้ httpOnly หน้านี้จึงไม่เคยถือรหัสผ่านหรือความลับใด ๆ ไว้เลย
// รีเฟรชหน้าแล้วยังล็อกอินอยู่ เพราะคุกกี้ติดไปกับทุกคำขอเอง
//
// สิ่งที่แก้ได้ตอนนี้คือคลิปปักหมุดหน้าแรก ซึ่งเคยอยู่ในไฟล์ config แปลว่าเปลี่ยน
// ทีต้อง build แล้ว deploy ใหม่ ตอนนี้กดบันทึกแล้วมีผลทันที

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn, LogOut, Pin, RefreshCw, Save, Trash2 } from "lucide-react";

type FeaturedClip = {
  src: string;
  poster: string;
  title: string;
  description: string;
  durationSec: number;
  badge: string;
};

const EMPTY_CLIP: FeaturedClip = {
  src: "",
  poster: "",
  title: "",
  description: "",
  durationSec: 30,
  badge: "ปักหมุด",
};

export function AdminClient() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [configured, setConfigured] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [studioUrl, setStudioUrl] = useState("");
  const [studioNote, setStudioNote] = useState("");
  const [clip, setClip] = useState<FeaturedClip>(EMPTY_CLIP);
  const [clipNote, setClipNote] = useState("");
  const [hasClip, setHasClip] = useState(false);

  // เขียนเป็นลูกโซ่ promise ไม่ใช่ async/await ในตัว effect เอง — ตัวตรวจโค้ดของ
  // React ห้ามเรียก setState แบบซิงโครนัสจากใน effect เพราะทำให้เรนเดอร์ซ้อนกัน
  const loadSession = useCallback(() => {
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then((session: { signedIn?: boolean; username?: string; configured?: boolean }) => {
        setConfigured(Boolean(session.configured));
        setState(session.signedIn ? "in" : "out");
        if (session.signedIn) setUsername(session.username ?? "");
      })
      .catch(() => setState("out"));
  }, []);

  const loadClip = useCallback(() => {
    fetch("/api/featured-clip")
      .then((response) => response.json())
      .then((payload: { clip?: FeaturedClip | null }) => {
        setClip(payload.clip ?? EMPTY_CLIP);
        setHasClip(Boolean(payload.clip));
      })
      .catch(() => undefined);
  }, []);

  const loadStudio = useCallback(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((payload: { studioUrl?: string }) => setStudioUrl(payload.studioUrl ?? ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadSession();
    loadClip();
    loadStudio();
  }, [loadSession, loadClip, loadStudio]);

  const saveStudio = (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStudioNote("");
    fetch("/api/site-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studioUrl }),
    })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) =>
        setStudioNote(
          response.ok ? "บันทึกแล้ว — เมนูจะพาไปที่อยู่ใหม่ทันที" : (payload.message ?? "บันทึกไม่สำเร็จ"),
        ),
      )
      .catch(() => setStudioNote("ต่อกับเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setBusy(false));
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      setPassword("");
      setState("in");
    } catch {
      setError("ต่อกับเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setState("out");
    setPassword("");
  };

  const saveClip = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setClipNote("");
    try {
      const response = await fetch("/api/featured-clip", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(clip),
      });
      const payload = await response.json();
      setClipNote(
        response.ok ? "บันทึกแล้ว — หน้าแรกเปลี่ยนทันที" : (payload.message ?? "บันทึกไม่สำเร็จ"),
      );
      if (response.ok) setHasClip(true);
    } catch {
      setClipNote("ต่อกับเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const removeClip = () => {
    setBusy(true);
    setClipNote("");
    fetch("/api/featured-clip", { method: "DELETE" })
      .then((response) => {
        setClipNote(response.ok ? "เอาคลิปปักหมุดออกแล้ว" : "เอาออกไม่สำเร็จ");
        if (response.ok) {
          setClip(EMPTY_CLIP);
          setHasClip(false);
        }
      })
      .catch(() => setClipNote("ต่อกับเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setBusy(false));
  };

  const field = (key: keyof FeaturedClip) => ({
    value: String(clip[key] ?? ""),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setClip((prev) => ({
        ...prev,
        [key]: key === "durationSec" ? Number(event.target.value) : event.target.value,
      })),
  });

  return (
    <main className="admin-page">
      <Link href="/" className="gc-page-back">
        <ArrowLeft size={13} aria-hidden="true" />กลับหน้าข่าว
      </Link>

      <div className="admin-head">
        <span className="eyebrow">ADMIN</span>
        <h1>ห้องควบคุม</h1>
      </div>

      {state === "loading" && <p className="gc-page-note">กำลังตรวจสิทธิ์…</p>}

      {state === "out" && (
        <form className="admin-card admin-login" onSubmit={signIn}>
          <h2>เข้าสู่ระบบ</h2>
          {!configured && (
            <p className="admin-warn">
              ยังไม่ได้ตั้งบัญชีแอดมินบนเซิร์ฟเวอร์ — ตั้ง ADMIN_USERNAME และ ADMIN_PASSWORD ก่อน
            </p>
          )}
          <label>
            ชื่อผู้ใช้
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          <label>
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error !== "" && <p className="admin-error">{error}</p>}
          <button type="submit" className="admin-submit" disabled={busy}>
            <LogIn size={13} aria-hidden="true" />
            {busy ? "กำลังตรวจ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      )}

      {state === "in" && (
        <>
          <div className="admin-card admin-who">
            <span>
              เข้าสู่ระบบในชื่อ <b>{username}</b>
            </span>
            <button type="button" className="admin-ghost" onClick={() => void signOut()}>
              <LogOut size={12} aria-hidden="true" />ออกจากระบบ
            </button>
          </div>

          <form className="admin-card" onSubmit={saveClip}>
            <h2>
              <Pin size={14} aria-hidden="true" />คลิปปักหมุดหน้าแรก
            </h2>
            <p className="admin-hint">
              แก้ตรงนี้แล้วมีผลกับหน้าแรกทันที ไม่ต้อง deploy ใหม่ — ลิงก์วิดีโอใส่ได้ทั้ง
              เส้นทางในเว็บนี้ (เช่น <code>/featured/gog-featured.mp4</code>) และลิงก์ภายนอกที่เป็น
              https
            </p>

            <label>
              หัวข้อ
              <input {...field("title")} required maxLength={200} />
            </label>
            <label>
              คำอธิบาย
              <textarea rows={2} {...field("description")} maxLength={500} />
            </label>
            <label>
              ลิงก์วิดีโอ
              <input {...field("src")} required placeholder="/featured/gog-featured.mp4" />
            </label>
            <label>
              ลิงก์ภาพปก
              <input {...field("poster")} required placeholder="/featured/gog-featured.jpg" />
            </label>
            <div className="admin-row">
              <label>
                ความยาว (วินาที)
                <input type="number" min={1} max={3600} {...field("durationSec")} required />
              </label>
              <label>
                ป้าย
                <input {...field("badge")} maxLength={40} />
              </label>
            </div>

            {clipNote !== "" && <p className="admin-note">{clipNote}</p>}

            <div className="admin-actions">
              <button type="submit" className="admin-submit" disabled={busy}>
                <Save size={13} aria-hidden="true" />บันทึก
              </button>
              {hasClip && (
                <button
                  type="button"
                  className="admin-ghost"
                  disabled={busy}
                  onClick={() => removeClip()}
                >
                  <Trash2 size={12} aria-hidden="true" />เอาออกจากหน้าแรก
                </button>
              )}
              <button type="button" className="admin-ghost" onClick={() => loadClip()}>
                <RefreshCw size={12} aria-hidden="true" />โหลดค่าล่าสุด
              </button>
            </div>
          </form>

          <form className="admin-card" onSubmit={saveStudio}>
            <h2>ที่อยู่ของสตูดิโอ GROUND CALL</h2>
            <p className="admin-hint">
              สตูดิโอเป็นคนละแอปคนละเครื่อง เมนู Admin บนหน้าข่าวจะพาไปที่อยู่นี้ ย้ายเครื่องหรือ
              ขึ้นโดเมนจริงเมื่อไหร่ก็แก้ตรงนี้ ไม่ต้อง deploy ใหม่
            </p>
            <label>
              ที่อยู่ (ไม่ต้องมี / ท้าย)
              <input
                value={studioUrl}
                onChange={(event) => setStudioUrl(event.target.value)}
                placeholder="http://localhost:3003"
                required
              />
            </label>
            {studioNote !== "" && <p className="admin-note">{studioNote}</p>}
            <div className="admin-actions">
              <button type="submit" className="admin-submit" disabled={busy}>
                <Save size={13} aria-hidden="true" />บันทึก
              </button>
              {studioUrl !== "" && (
                <a
                  className="admin-ghost"
                  href={`${studioUrl}/login`}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดหน้าเข้าสู่ระบบสตูดิโอ
                </a>
              )}
            </div>
          </form>

          <div className="admin-card">
            <h2>ทางลัด</h2>
            <div className="admin-links">
              <Link href="/ground-call">คลิปที่เผยแพร่แล้ว</Link>
              <Link href="/">หน้าข่าว</Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
