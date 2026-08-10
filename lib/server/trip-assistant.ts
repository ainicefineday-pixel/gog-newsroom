// ASK GOG — ผู้ช่วยปรับทริปด้วย Claude (STEP 39)
// ---------------------------------------------------------------------------
// จุดต่างจากแชตบอตทั่วไป: ผู้ช่วยตัวนี้ต้อง "แก้ทริปจริง" ไม่ใช่ตอบเป็นข้อความเฉย ๆ
// จึงบังคับให้คืนคำสั่งเปลี่ยนแปลงแบบมีโครงสร้าง (structured outputs) แล้วให้ฝั่งเว็บ
// เอาไปใช้กับ state ของตัวเอง — โมเดลไม่ได้แตะฐานข้อมูลเอง
//
// ผู้ช่วยเลือกได้เฉพาะตัวเลือกที่ระบบมีจริง (ส่งรายการไปให้ในพรอมป์ต) จึงแนะนำ
// โรงแรม/ไฟลต์ที่ไม่มีอยู่จริงไม่ได้

import type { RuntimeEnv } from "@/lib/server/database";

const MODEL = "claude-opus-5";
const TIMEOUT_MS = 120_000;

export type AssistantPatch = {
  budget?: "saver" | "comfort" | "premium";
  length?: 5 | 8;
  travellers?: number;
  flightId?: string;
  hotelId?: string;
  /** id ของสถานที่ที่อยากให้ตัดออกจากแผน */
  removePlaceIds?: string[];
  /** id ของสถานที่ที่อยากให้เพิ่มเข้าไป */
  addPlaceIds?: string[];
};

export type AssistantReply = {
  reply: string;
  changed: string[];
  patch: AssistantPatch;
};

const PATCH_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    changed: { type: "array", items: { type: "string" } },
    patch: {
      type: "object",
      properties: {
        budget: { type: "string", enum: ["saver", "comfort", "premium"] },
        length: { type: "integer", enum: [5, 8] },
        travellers: { type: "integer" },
        flightId: { type: "string" },
        hotelId: { type: "string" },
        removePlaceIds: { type: "array", items: { type: "string" } },
        addPlaceIds: { type: "array", items: { type: "string" } },
      },
      required: [],
      additionalProperties: false,
    },
  },
  required: ["reply", "changed", "patch"],
  additionalProperties: false,
} as const;

const SYSTEM = [
  "You are GOG's football-travel concierge for Thai supporters travelling from Bangkok to England.",
  "You edit the traveller's trip rather than only replying: express every change as a patch.",
  "Only use ids that appear in the supplied catalogue. Never invent hotels, flights, or places.",
  "Leave a field out of the patch when it should not change. An empty patch is valid.",
  "Write reply and changed in Thai, short and concrete. Never promise live availability or guaranteed prices.",
].join(" ");

export async function askTripAssistant(
  env: RuntimeEnv,
  input: { question: string; trip: unknown; catalogue: unknown },
): Promise<AssistantReply | { error: string }> {
  if (!env.ANTHROPIC_API_KEY) return { error: "assistant_not_configured" };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || MODEL,
      max_tokens: 8_000,
      output_config: { effort: "low", format: { type: "json_schema", schema: PATCH_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          `คำขอของผู้เดินทาง: ${input.question}`,
          `ทริปปัจจุบัน: ${JSON.stringify(input.trip)}`,
          `ตัวเลือกที่ระบบมี: ${JSON.stringify(input.catalogue)}`,
        ].join("\n\n"),
      }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return { error: `claude_${response.status}` };
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  // ต่อทุก text block — โมเดลที่คิดก่อนตอบแบ่งผลลัพธ์ได้หลายก้อน
  const text = (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  if (!text) return { error: "empty_reply" };
  try {
    return JSON.parse(text) as AssistantReply;
  } catch {
    return { error: "unreadable_reply" };
  }
}
