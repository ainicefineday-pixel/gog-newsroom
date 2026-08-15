// state ที่จำค่าไว้ใน localStorage / sessionStorage
// ---------------------------------------------------------------------------
// เดิมแต่ละหน้าจออ่านค่าที่จำไว้ด้วย useEffect แล้ว setState ตอน mount ซึ่ง
// react-hooks/set-state-in-effect ห้ามไว้ เพราะทำให้ render ซ้อนรอบโดยไม่จำเป็น
// และมีจังหวะที่ effect ตัวเขียนวิ่งก่อนค่าที่กู้มาถูกใส่ ทับค่าที่จำไว้ด้วยค่าเริ่มต้น
//
// useSyncExternalStore แก้ทั้งสองเรื่อง: ฝั่งเซิร์ฟเวอร์คืนค่าเริ่มต้นเสมอ (HTML
// จึงตรงกันตอน hydrate) พอ hydrate เสร็จ React อ่าน snapshot ฝั่งเบราว์เซอร์
// ให้เอง ไม่ต้อง setState และไม่ต้องมี effect ตัวเขียนแยก เพราะ setter เขียนลง
// storage พร้อมกับแจ้งผู้ฟังในจังหวะเดียว
//
// ค่าถูกเก็บเป็น JSON เสมอ ค่าเก่าที่ไม่ใช่ JSON จะ parse ไม่ผ่านและตกไปใช้ค่าเริ่มต้น

import { useCallback, useSyncExternalStore } from "react";

type Area = "local" | "session";

const listeners = new Map<string, Set<() => void>>();

/** จำผลของ raw ล่าสุดไว้ เพราะ getSnapshot ต้องคืนค่าอ้างอิงเดิมถ้าข้อมูลไม่เปลี่ยน */
const parsed = new Map<string, { raw: string | null; value: unknown }>();

/** สำรองไว้ในหน่วยความจำเผื่อเบราว์เซอร์ปิด storage — ค่าที่ตั้งยังต้องอยู่จนกว่าจะปิดหน้า */
const memory = new Map<string, string>();

function storageOf(area: Area): Storage | null {
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // เบราว์เซอร์ปิด storage ไว้ — ใช้งานต่อได้ แค่ไม่จำข้ามการปิดหน้า
    return null;
  }
}

function readRaw(key: string, area: Area): string | null {
  try {
    const stored = storageOf(area)?.getItem(key);
    if (stored != null) return stored;
  } catch {
    // อ่านไม่ได้ก็ตกไปใช้ค่าที่จำไว้ในหน่วยความจำ
  }
  return memory.get(key) ?? null;
}

function emit(key: string) {
  listeners.get(key)?.forEach((notify) => notify());
}

function subscribe(key: string, notify: () => void) {
  let group = listeners.get(key);
  if (!group) {
    group = new Set();
    listeners.set(key, group);
  }
  group.add(notify);
  return () => {
    group.delete(notify);
    if (group.size === 0) listeners.delete(key);
  };
}

function readValue<T>(key: string, area: Area, fallback: T): T {
  const raw = readRaw(key, area);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      // ค่าที่จำไว้เสียหายก็เริ่มจากค่าเริ่มต้น
    }
  }
  parsed.set(key, { raw, value });
  return value;
}

/**
 * อ่าน/เขียนค่าที่จำไว้ใน storage โดยไม่ทำให้ HTML ฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ต่างกัน
 *
 * setter รับฟังก์ชันได้เหมือน useState และฟังก์ชันจะได้ค่าล่าสุดจาก storage เสมอ
 * ใช้แบบนั้นเมื่อค่าใหม่คำนวณจากค่าเดิม จะได้ไม่ทับค่าที่เพิ่งเปลี่ยนไปในรอบเดียวกัน
 *
 * @param key   คีย์ใน storage
 * @param fallback ค่าที่ใช้ตอนยังไม่เคยจำ หรือค่าที่จำไว้เสียหาย — ต้องเป็นค่าคงที่
 * @param area  จะจำข้ามแท็บและข้ามการปิดเบราว์เซอร์ (`local`) หรือเฉพาะแท็บนี้ (`session`)
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
  area: Area = "local",
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    useCallback((notify: () => void) => subscribe(key, notify), [key]),
    useCallback(() => readValue(key, area, fallback), [key, area, fallback]),
    useCallback(() => fallback, [fallback]),
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(readValue(key, area, fallback))
          : next;
      const raw = JSON.stringify(resolved);
      parsed.set(key, { raw, value: resolved });
      memory.set(key, raw);
      try {
        storageOf(area)?.setItem(key, raw);
      } catch {
        // จำข้ามการปิดหน้าไม่ได้ ก็ยังใช้ค่าในหน่วยความจำต่อได้
      }
      emit(key);
    },
    [key, area, fallback],
  );

  return [value, set];
}
