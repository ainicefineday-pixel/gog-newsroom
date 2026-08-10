export type LyricLine = {
  id: number;
  /** Shown as a chapter label when a new part of the track starts. */
  section?: string;
  /** Sung text, exactly as written. A line break splits a couplet. */
  en: string;
  /** Thai reading of the same couplet, not a word-for-word gloss. */
  th: string;
  /**
   * Seconds into the track, aligned from the recording itself. `null` means the
   * line is on the sheet but is not sung in this take, so it never highlights.
   * The in-app sync tool (?sync=1) can override any of these by hand.
   */
  time: number | null;
};

export const ANTHEM_TRACK = {
  // Routed through the Worker so the response supports HTTP range requests,
  // which iOS Safari requires before it will play anything.
  src: "/media/anthem.mp3",
  // ไฟล์ดิบเสิร์ฟตรงจาก assets — ใช้กับปุ่มดาวน์โหลด เพราะเบราว์เซอร์บางตัว
  // ไม่ยอมโหลดไฟล์จาก endpoint ที่ตอบ 206 เป็นหลัก
  downloadSrc: "/gog-anthem.mp3",
  downloadName: "GOG-anthem-genius-on-the-ground.mp3",
  title: "Genius on the Ground",
  subtitle: "After Hours Football · Live It Like a Local",
  durationSeconds: 357.72,
};

/**
 * ไฟล์เดียวแต่เป็นสองเพลงอัดต่อกันในเทคเดียว — เพลงที่สองเริ่มที่ 207.35 วินาที
 * (ท่อน "Live It Like a Local · Intro" ในเนื้อร้องด้านล่าง) แยกเป็นแทร็กให้
 * ปุ่มเพลงก่อนหน้า/ถัดไปกระโดดข้ามได้จริง โดยไม่ต้องแยกไฟล์
 */
export type AnthemTrack = {
  id: string;
  title: string;
  subtitle: string;
  startSeconds: number;
};

export const ANTHEM_TRACKS: readonly AnthemTrack[] = [
  { id: "gotg", title: "Genius on the Ground", subtitle: "After Hours Football", startSeconds: 0 },
  { id: "local", title: "Live It Like a Local", subtitle: "Smooth British Flow", startSeconds: 207.35 },
];

// Two songs recorded back to back in one take. Timings were aligned against a
// Whisper transcript of the master, so they follow the vocal rather than the
// page. The take condenses its ending into repeated G.O.G tags, which is why the
// closing bridge and final chorus of the second song carry no time.
export const ANTHEM_LYRICS: readonly LyricLine[] = [
  { id: 1, section: "Intro", en: "Mm...", th: "อืม...", time: null },
  { id: 2, en: "G.O.G.", th: "จี.โอ.จี.", time: 0.16 },
  { id: 3, en: "Genius on the Ground.", th: "อัจฉริยะที่ลงไปยืนอยู่ตรงนั้น", time: 5.74 },
  { id: 4, en: "Yeah.", th: "เย่", time: 8.22 },

  { id: 5, section: "Verse 1", en: "Touch down, city after dark,\nRain on the window, follow the lights,", th: "ลงถึงเมืองตอนฟ้ามืดสนิท\nฝนเกาะกระจก ไล่ตามแสงไฟไป", time: 12.20 },
  { id: 6, en: "Got nowhere else that I wanna be,\nFootball weekend calling me.", th: "ไม่มีที่ไหนที่อยากอยู่มากกว่านี้แล้ว\nสุดสัปดาห์ของลูกหนังเรียกหาเราอยู่", time: 16.34 },
  { id: 7, en: "Backstreet coffee, morning train,\nNew destination, different game,", th: "กาแฟร้านซอกซอย รถไฟเที่ยวเช้า\nปลายทางใหม่ เกมใหม่ที่ไม่เหมือนเดิม", time: 20.94 },
  { id: 8, en: "No velvet rope, no tourist show,\nWe see the places the locals know.", th: "ไม่มีเชือกกั้นวีไอพี ไม่มีทัวร์จัดฉาก\nเราไปที่ที่คนท้องถิ่นเขาไปกัน", time: 26.24 },

  { id: 9, section: "Pre-Chorus", en: "Take me closer,\nI wanna feel it,", th: "พาฉันเข้าไปใกล้กว่านี้\nฉันอยากสัมผัสมันจริงๆ", time: 31.22 },
  { id: 10, en: "Not through a screen,\nI wanna live it.", th: "ไม่ใช่ผ่านหน้าจอ\nฉันอยากใช้ชีวิตอยู่กับมัน", time: 34.76 },
  { id: 11, en: "City to city,\nround after round,", th: "จากเมืองสู่เมือง\nนัดแล้วนัดเล่า", time: 37.02 },
  { id: 12, en: "That's how we move\nwhen we're on the ground.", th: "นี่แหละวิธีเคลื่อนที่ของเรา\nตอนที่เราลงไปอยู่ตรงนั้นจริงๆ", time: 39.38 },

  { id: 13, section: "Chorus", en: "Genius on the Ground,\ncome and ride with me,", th: "Genius on the Ground\nมาไปด้วยกันสิ", time: 42.50 },
  { id: 14, en: "From Manchester\nthrough the Premier League.", th: "ออกจากแมนเชสเตอร์\nลุยยาวทั่วพรีเมียร์ลีก", time: 44.58 },
  { id: 15, en: "G.O.G,\nwe're where you wanna be,", th: "จี.โอ.จี.\nเราอยู่ในที่ที่นายอยากอยู่", time: 47.92 },
  { id: 16, en: "Football Genius,\nliving locally.", th: "Football Genius\nใช้ชีวิตแบบคนที่นั่น", time: 50.06 },
  { id: 17, en: "One more city,\none more night,", th: "อีกหนึ่งเมือง\nอีกหนึ่งค่ำคืน", time: 52.22 },
  { id: 18, en: "One more story\nunder those lights.", th: "อีกหนึ่งเรื่องราว\nใต้แสงไฟสนามนั้น", time: 55.12 },
  { id: 19, en: "Genius on the Ground,", th: "Genius on the Ground", time: 58.28 },
  { id: 20, en: "We don't just watch it,\nwe live it now.", th: "เราไม่ได้แค่นั่งดู\nเราลงไปใช้ชีวิตกับมัน", time: 59.70 },

  { id: 21, section: "Post-Chorus", en: "G.O.G...", th: "จี.โอ.จี...", time: 66.44 },
  { id: 22, en: "On the ground.", th: "อยู่ตรงนั้น ตรงพื้นสนาม", time: 66.82 },
  { id: 23, en: "G.O.G...", th: "จี.โอ.จี...", time: 68.98 },
  { id: 24, en: "Football Genius.", th: "Football Genius", time: 72.22 },

  { id: 25, section: "Verse 2", en: "Late-night streets and an early start,\nFootball running through the heart,", th: "ถนนดึกดื่นกับการตื่นแต่เช้ามืด\nลูกหนังไหลเวียนอยู่ในหัวใจ", time: 74.08 },
  { id: 26, en: "Window seat with a coffee cold,\nEvery city got a story untold.", th: "ที่นั่งริมหน้าต่างกับกาแฟที่เย็นชืด\nทุกเมืองมีเรื่องที่ยังไม่มีใครเล่า", time: 79.06 },
  { id: 27, en: "Old Trafford sitting in the rain,\nManchester calling out my name,", th: "โอลด์ แทรฟฟอร์ดตั้งตระหง่านกลางสายฝน\nแมนเชสเตอร์เรียกชื่อฉันอยู่", time: 84.14 },
  { id: 28, en: "But tomorrow there's another road,\nAnother place that feels like home.", th: "แต่พรุ่งนี้ยังมีอีกเส้นทาง\nอีกที่หนึ่งที่รู้สึกเหมือนบ้าน", time: 88.72 },

  { id: 29, section: "Pre-Chorus", en: "Take me closer,\nI wanna feel it,", th: "พาฉันเข้าไปใกล้กว่านี้\nฉันอยากสัมผัสมันจริงๆ", time: 93.88 },
  { id: 30, en: "Not through a screen,\nI wanna live it.", th: "ไม่ใช่ผ่านหน้าจอ\nฉันอยากใช้ชีวิตอยู่กับมัน", time: 97.56 },
  { id: 31, en: "City to city,\nround after round,", th: "จากเมืองสู่เมือง\nนัดแล้วนัดเล่า", time: 100.10 },
  { id: 32, en: "That's how we move\nwhen we're on the ground.", th: "นี่แหละวิธีเคลื่อนที่ของเรา\nตอนที่เราลงไปอยู่ตรงนั้นจริงๆ", time: 101.98 },

  { id: 33, section: "Chorus", en: "Genius on the Ground,\ncome and ride with me,", th: "Genius on the Ground\nมาไปด้วยกันสิ", time: 105.32 },
  { id: 34, en: "From Manchester\nthrough the Premier League.", th: "ออกจากแมนเชสเตอร์\nลุยยาวทั่วพรีเมียร์ลีก", time: 107.98 },
  { id: 35, en: "G.O.G,\nwe're where you wanna be,", th: "จี.โอ.จี.\nเราอยู่ในที่ที่นายอยากอยู่", time: 109.84 },
  { id: 36, en: "Football Genius,\nliving locally.", th: "Football Genius\nใช้ชีวิตแบบคนที่นั่น", time: 113.14 },
  { id: 37, en: "One more city,\none more night,", th: "อีกหนึ่งเมือง\nอีกหนึ่งค่ำคืน", time: 115.30 },
  { id: 38, en: "One more story\nunder those lights.", th: "อีกหนึ่งเรื่องราว\nใต้แสงไฟสนามนั้น", time: 118.08 },
  { id: 39, en: "Genius on the Ground,", th: "Genius on the Ground", time: 120.92 },
  { id: 40, en: "We don't just watch it,\nwe live it now.", th: "เราไม่ได้แค่นั่งดู\nเราลงไปใช้ชีวิตกับมัน", time: 123.56 },

  { id: 41, section: "Break — Rhodes + Bass", en: "G.O.G...", th: "จี.โอ.จี...", time: 125.68 },
  { id: 42, en: "Manchester.", th: "แมนเชสเตอร์", time: 128.74 },
  { id: 43, en: "Old Trafford.", th: "โอลด์ แทรฟฟอร์ด", time: 132.70 },
  { id: 44, en: "Genius on the Ground.", th: "Genius on the Ground", time: null },

  { id: 45, section: "Rap — Laid-Back UK Flow", en: "Look—", th: "ฟังนะ—", time: 136.40 },
  { id: 46, en: "Window down,\nrain coming in,", th: "เปิดกระจกลง\nฝนสาดเข้ามา", time: 136.48 },
  { id: 47, en: "New postcode,\nnew weekend.", th: "รหัสไปรษณีย์ใหม่\nสุดสัปดาห์ใหม่", time: 138.66 },
  { id: 48, en: "No guidebook,\nwe know that route,", th: "ไม่ต้องพึ่งไกด์บุ๊ก\nเรารู้เส้นทางนั้นดี", time: 140.28 },
  { id: 49, en: "Where to eat,\nwhere to walk,\nwhere the locals hang out.", th: "กินที่ไหน\nเดินตรงไหน\nคนท้องถิ่นเขาไปรวมตัวกันที่ไหน", time: 142.04 },
  { id: 50, en: "Train platform,\nfresh white kicks,", th: "ชานชาลารถไฟ\nรองเท้าขาวคู่ใหม่เอี่ยม", time: 145.46 },
  { id: 51, en: "Phone on five,\nstill catching that trip.", th: "แบตเหลือห้าเปอร์เซ็นต์\nแต่ก็ยังไปต่อ", time: 147.50 },
  { id: 52, en: "From Manchester,\nthen we're gone again,", th: "ออกจากแมนเชสเตอร์\nแล้วก็ไปต่อกันอีกแล้ว", time: 149.56 },
  { id: 53, en: "Saturday football\nwith a couple good friends.", th: "บอลวันเสาร์\nกับเพื่อนดีๆ อีกสองสามคน", time: 152.14 },
  { id: 54, en: "No VIP,\nI don't need that scene,", th: "ไม่เอาวีไอพี\nฉันไม่ต้องการโลกแบบนั้น", time: 155.10 },
  { id: 55, en: "Give me real life\nand the Premier League.", th: "ขอแค่ชีวิตจริงๆ\nกับพรีเมียร์ลีกก็พอ", time: 158.20 },
  { id: 56, en: "Close to the pitch,\nclose to the town,", th: "ใกล้ผืนสนาม\nใกล้ตัวเมือง", time: 160.28 },
  { id: 57, en: "That's G.O.G —", th: "นั่นแหละ จี.โอ.จี.", time: 162.74 },
  { id: 58, en: "Genius on the Ground.", th: "Genius on the Ground", time: 166.06 },

  { id: 59, section: "Bridge", en: "Maybe it's more than ninety minutes,", th: "บางทีมันอาจมากกว่าเก้าสิบนาที", time: 173.34 },
  { id: 60, en: "Maybe it's everything around it.", th: "บางทีมันคือทุกอย่างที่อยู่รอบๆ เกมนั้น", time: 175.50 },
  { id: 61, en: "The road,\nthe rain,\nthe people,\nthe city.", th: "เส้นทาง\nสายฝน\nผู้คน\nและเมืองนั้น", time: 181.57 },
  { id: 62, en: "That's football to me.", th: "สำหรับฉัน ฟุตบอลคือแบบนี้แหละ", time: 185.11 },

  { id: 63, section: "Final Chorus", en: "Genius on the Ground,\ncome and ride with me,", th: "Genius on the Ground\nมาไปด้วยกันสิ", time: 188.67 },
  { id: 64, en: "Every weekend,\nanother city.", th: "ทุกสุดสัปดาห์\nอีกหนึ่งเมืองใหม่", time: 191.59 },
  { id: 65, en: "G.O.G,\nwe're where you wanna be,", th: "จี.โอ.จี.\nเราอยู่ในที่ที่นายอยากอยู่", time: null },
  { id: 66, en: "Football Genius,\nliving locally.", th: "Football Genius\nใช้ชีวิตแบบคนที่นั่น", time: 196.21 },
  { id: 67, en: "Manchester nights,\nthen we're outbound", th: "ค่ำคืนในแมนเชสเตอร์\nแล้วเราก็ออกเดินทางต่อ", time: 203.81 },

  { id: 68, section: "Live It Like a Local · Intro", en: "G.O.G...", th: "จี.โอ.จี...", time: 207.35 },
  { id: 69, en: "Genius on the Ground.", th: "Genius on the Ground", time: null },
  { id: 70, en: "From Manchester...\nTo every ground.", th: "จากแมนเชสเตอร์...\nสู่ทุกสนาม", time: 211.69 },
  { id: 71, en: "Come see the game\nfrom where we stand.", th: "มาดูเกมนี้\nจากจุดที่เรายืนอยู่", time: 214.15 },

  { id: 72, section: "Verse 1 — Smooth", en: "Rain on the road,\nlights coming down,", th: "ฝนโปรยลงบนถนน\nแสงไฟทอดลงมา", time: 220.17 },
  { id: 73, en: "Saturday calling\nall over town.", th: "วันเสาร์ส่งเสียงเรียก\nไปทั่วทั้งเมือง", time: 222.53 },
  { id: 74, en: "No distant view,\nno watching from home,", th: "ไม่ใช่มุมมองไกลๆ\nไม่ใช่การนั่งดูอยู่ที่บ้าน", time: 224.83 },
  { id: 75, en: "we take you closer\nto where football belongs.", th: "เราพานายเข้าไปใกล้\nที่ที่ฟุตบอลมันควรอยู่", time: 227.25 },
  { id: 76, en: "From Manchester nights\nto the morning train,", th: "จากค่ำคืนในแมนเชสเตอร์\nสู่รถไฟเที่ยวเช้า", time: 231.03 },
  { id: 77, en: "another ground,\nanother game.", th: "อีกหนึ่งสนาม\nอีกหนึ่งเกม", time: 233.39 },
  { id: 78, en: "Side by side,\nwhere the real stories grow,", th: "เคียงบ่าเคียงไหล่\nในที่ที่เรื่องจริงมันก่อตัวขึ้น", time: 235.77 },
  { id: 79, en: "Genius on the Ground,\nwe go where locals go.", th: "Genius on the Ground\nเราไปในที่ที่คนท้องถิ่นไป", time: 238.33 },

  { id: 80, section: "Pre-Chorus", en: "Closer to the touchline,\ncloser to the sound,", th: "ใกล้เส้นข้างสนามเข้าไปอีก\nใกล้เสียงนั้นเข้าไปอีก", time: 241.17 },
  { id: 81, en: "Every week,\nanother town.", th: "ทุกสัปดาห์\nอีกหนึ่งเมือง", time: 245.79 },
  { id: 82, en: "This is football\nfrom the ground.", th: "นี่คือฟุตบอล\nที่มองจากพื้นสนามจริงๆ", time: 248.37 },

  { id: 83, section: "Chorus", en: "Genius on the Ground,\nGenius on the Ground,", th: "Genius on the Ground\nGenius on the Ground", time: 250.79 },
  { id: 84, en: "Feel the Premier League\nfrom the edge of the ground.", th: "สัมผัสพรีเมียร์ลีก\nจากขอบสนามตรงนั้น", time: 254.65 },
  { id: 85, en: "G.O.G,\ncome follow me,", th: "จี.โอ.จี.\nตามมาสิ", time: 257.15 },
  { id: 86, en: "Football Genius,\nwhere you wanna be.", th: "Football Genius\nในที่ที่นายอยากอยู่", time: 259.45 },
  { id: 87, en: "Manchester United,\nOld Trafford lights,", th: "แมนเชสเตอร์ ยูไนเต็ด\nแสงไฟโอลด์ แทรฟฟอร์ด", time: 262.65 },
  { id: 88, en: "From Manchester\nacross the Premier League nights.", th: "จากแมนเชสเตอร์\nข้ามค่ำคืนทั่วพรีเมียร์ลีก", time: 265.15 },
  { id: 89, en: "G.O.G,\nGenius on the Ground,", th: "จี.โอ.จี.\nGenius on the Ground", time: 267.87 },
  { id: 90, en: "Live it like a local,\nright here, right now.", th: "ใช้ชีวิตแบบคนที่นั่น\nตรงนี้ เดี๋ยวนี้", time: 271.23 },

  { id: 91, section: "Instrumental — Piano + Bass", en: "G.O.G...", th: "จี.โอ.จี...", time: null },
  { id: 92, en: "Football Genius...", th: "Football Genius...", time: null },
  { id: 93, en: "Genius on the Ground.", th: "Genius on the Ground", time: 277.03 },

  { id: 94, section: "Rap — Smooth British Flow", en: "Touch down Manchester,\nrain on the glass,", th: "ถึงแมนเชสเตอร์\nฝนเกาะกระจก", time: 284.35 },
  { id: 95, en: "Train to the ground,\nlet the whole city pass.", th: "นั่งรถไฟไปสนาม\nปล่อยให้ทั้งเมืองไหลผ่านตา", time: 285.51 },
  { id: 96, en: "Not just a ticket,\nnot just a seat,", th: "ไม่ใช่แค่ตั๋วใบหนึ่ง\nไม่ใช่แค่ที่นั่งหนึ่งที่", time: 287.47 },
  { id: 97, en: "We take you where the city\nand the football meet.", th: "เราพานายไปยังจุดที่เมือง\nกับฟุตบอลมาบรรจบกัน", time: 290.31 },
  { id: 98, en: "Local pub,\nlocal road,", th: "ผับประจำย่าน\nถนนประจำถิ่น", time: 293.15 },
  { id: 99, en: "Local stories\nthat the cameras never show.", th: "เรื่องเล่าของคนที่นั่น\nที่กล้าไม่เคยจับภาพ", time: 295.29 },
  { id: 100, en: "From the tunnel to the touchline,\nboots on the ground,", th: "จากอุโมงค์ทางเข้าถึงเส้นข้างสนาม\nลงไปเหยียบพื้นจริง", time: 297.55 },
  { id: 101, en: "Different city every weekend,\nwe're moving around.", th: "เปลี่ยนเมืองทุกสุดสัปดาห์\nเราเคลื่อนที่ไปเรื่อย", time: 301.03 },
  { id: 102, en: "Premier League,\nnorth to south,", th: "พรีเมียร์ลีก\nจากเหนือจรดใต้", time: 304.59 },
  { id: 103, en: "Football Genius,\nword of mouth.", th: "Football Genius\nบอกกันปากต่อปาก", time: 306.13 },
  { id: 104, en: "Manchester United,\nOld Trafford glow,", th: "แมนเชสเตอร์ ยูไนเต็ด\nแสงเรืองของโอลด์ แทรฟฟอร์ด", time: 307.93 },
  { id: 105, en: "G.O.G —\nwe go where locals go.", th: "จี.โอ.จี.\nเราไปในที่ที่คนท้องถิ่นไป", time: 310.89 },
  { id: 106, en: "No tourist view,\nwe're closer than that,", th: "ไม่ใช่มุมนักท่องเที่ยว\nเราใกล้กว่านั้นเยอะ", time: 314.25 },
  { id: 107, en: "Real football culture\nfrom wherever we're at.", th: "วัฒนธรรมฟุตบอลของจริง\nจากทุกที่ที่เราไปยืนอยู่", time: 317.29 },
  { id: 108, en: "One game,\none city,\none story to know,", th: "หนึ่งเกม\nหนึ่งเมือง\nหนึ่งเรื่องที่ต้องรู้", time: 319.71 },
  { id: 109, en: "Genius on the Ground —\nthis is how we go.", th: "Genius on the Ground\nเราไปกันแบบนี้แหละ", time: 322.63 },

  { id: 110, section: "Bridge — Deep Vocal", en: "Closer to the game.", th: "ใกล้เกมเข้าไปอีก", time: null },
  { id: 111, en: "Closer to the city.", th: "ใกล้เมืองนั้นเข้าไปอีก", time: null },
  { id: 112, en: "Closer to the people.", th: "ใกล้ผู้คนเข้าไปอีก", time: null },
  { id: 113, en: "G.O.G.", th: "จี.โอ.จี.", time: 330.31 },
  { id: 114, en: "Genius on the Ground.", th: "Genius on the Ground", time: null },

  { id: 115, section: "Final Chorus", en: "Genius on the Ground,\nGenius on the Ground,", th: "Genius on the Ground\nGenius on the Ground", time: null },
  { id: 116, en: "Feel the Premier League\nfrom the edge of the ground.", th: "สัมผัสพรีเมียร์ลีก\nจากขอบสนามตรงนั้น", time: null },
  { id: 117, en: "G.O.G,\ncome follow me,", th: "จี.โอ.จี.\nตามมาสิ", time: 344.05 },
  { id: 118, en: "Football Genius,\nwhere you wanna be.", th: "Football Genius\nในที่ที่นายอยากอยู่", time: null },
  { id: 119, en: "Manchester United,\nOld Trafford lights,", th: "แมนเชสเตอร์ ยูไนเต็ด\nแสงไฟโอลด์ แทรฟฟอร์ด", time: null },
  { id: 120, en: "Then another city\non another night.", th: "แล้วก็อีกเมืองหนึ่ง\nในอีกค่ำคืนหนึ่ง", time: null },
  { id: 121, en: "From Manchester\nacross the Premier League,", th: "จากแมนเชสเตอร์\nข้ามไปทั่วพรีเมียร์ลีก", time: null },
  { id: 122, en: "G.O.G —\nfootball underneath your feet.", th: "จี.โอ.จี.\nฟุตบอลอยู่ใต้ฝ่าเท้าเรานี่เอง", time: 344.05 },
  { id: 123, en: "Genius on the Ground.", th: "Genius on the Ground", time: 346.29 },
  { id: 124, en: "G.O.G.", th: "จี.โอ.จี.", time: null },

  { id: 125, section: "Outro — Solo Piano", en: "Every city.", th: "ทุกเมือง", time: null },
  { id: 126, en: "Like a local.", th: "แบบคนที่นั่น", time: null },
  { id: 127, en: "Genius on the Ground.", th: "Genius on the Ground", time: 351.43 },
] as const;
