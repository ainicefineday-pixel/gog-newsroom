// GOG KEY MOMENTS (STEP 45, 46)
// ---------------------------------------------------------------------------
// เลือกเหตุการณ์สำคัญจากเหตุการณ์ที่ผู้ให้บริการส่งมาจริง ๆ เท่านั้น
//
// จงใจเรียกว่า "จังหวะสำคัญ" ไม่ใช่ "จุดเปลี่ยนเกม" เพราะการจะบอกว่าเกมเปลี่ยน
// ต้องเทียบสถิติช่วงก่อน–หลังเหตุการณ์ ซึ่งแพ็กข้อมูลฟรียังไม่มี (STEP 46)
// พอมีข้อมูลรายช่วงเวลาเมื่อไหร่ค่อยยกระดับเป็น TURNING POINT

import type { GOGEvent, GOGFixture } from "@/services/football/types";

export type KeyMoment = {
  minute: number;
  type: GOGEvent["type"];
  teamName: string;
  playerName: string;
  headline: string;
  /** ทำไมถึงเลือกจังหวะนี้ — บอกกติกาที่ใช้ ไม่ใช่ความเห็นลอย ๆ */
  reason: string;
};

export function buildKeyMoments(fixture: GOGFixture, events: GOGEvent[]): KeyMoment[] {
  if (events.length === 0) return [];
  const teamName = (teamId: string) => (teamId === fixture.home.id ? fixture.home.shortName : fixture.away.shortName);
  const moments: KeyMoment[] = [];

  const goals = events.filter((event) => ["goal", "own_goal", "penalty"].includes(event.type));

  for (const event of events) {
    const base = { minute: event.minute, type: event.type, teamName: teamName(event.teamId), playerName: event.playerName };

    if (["goal", "own_goal", "penalty"].includes(event.type)) {
      const index = goals.indexOf(event);
      const isLate = event.minute >= 80;
      // ประตูใน 5 นาทีหลังประตูก่อนหน้า = จังหวะที่เกมพลิกเร็ว
      const previous = index > 0 ? goals[index - 1] : null;
      const quickResponse = previous !== null && event.minute - previous.minute <= 5 && previous.teamId !== event.teamId;
      moments.push({
        ...base,
        headline: `${base.teamName} ได้ประตูนาที ${event.minute}`,
        reason: isLate
          ? "ประตูช่วงท้ายเกม (นาที 80 ขึ้นไป)"
          : quickResponse
            ? "ตอบกลับเร็วภายใน 5 นาทีหลังเสียประตู"
            : "ประตูคือเหตุการณ์ที่เปลี่ยนสกอร์โดยตรง",
      });
      continue;
    }

    if (event.type === "red_card" || event.type === "second_yellow") {
      moments.push({ ...base, headline: `${base.teamName} เหลือ 10 คน นาที ${event.minute}`, reason: "ใบแดงทำให้จำนวนผู้เล่นไม่เท่ากัน" });
      continue;
    }

    if (event.type === "penalty_miss") {
      moments.push({ ...base, headline: `${base.teamName} ยิงจุดโทษไม่เข้า นาที ${event.minute}`, reason: "โอกาสทำประตูที่ชัดเจนที่สุดแต่ไม่ได้ประตู" });
    }
  }

  // การเปลี่ยนตัวไม่ถูกนับเป็นจังหวะสำคัญ เพราะยังพิสูจน์ผลกระทบด้วยข้อมูลไม่ได้ (STEP 45)
  return moments.sort((a, b) => a.minute - b.minute);
}
