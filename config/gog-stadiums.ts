// คลังข้อมูลสนามของ GOG เอง (STEP 57, 58, 59)
// ---------------------------------------------------------------------------
// จงใจไม่พึ่งผู้ให้บริการข้อมูลฟุตบอลสำหรับส่วนนี้ เพราะสิ่งที่คนไทยอยากรู้ก่อนบิน
// คือ "ลงเครื่องแล้วไปสนามยังไง" ซึ่งไม่มีเจ้าไหนให้มาในรูปแบบที่ใช้ได้จริง
//
// ข้อมูลที่เขียนเองต้องแยกออกจากข้อมูลสถิติสด (STEP 59) — ไฟล์นี้คือชั้นเนื้อหา
// ที่ทีมงาน GOG ดูแลเอง แก้ได้โดยไม่กระทบชั้นข้อมูลจากผู้ให้บริการ
//
// ความจุสนามอ้างอิงตัวเลขที่สโมสรและหน่วยงานท้องถิ่นประกาศ ถือเป็นค่าประมาณ
// เพื่อวางแผน ไม่ใช่ตัวเลขที่นั่งขายจริงในแต่ละนัด

export type GogStadium = {
  /** ชื่อสนามตามที่ผู้ให้บริการส่งมา ใช้จับคู่กับ GOGFixture.venue.name */
  stadium: string;
  club: string;
  city: string;
  capacity: number;
  /** สนามบินที่คนไทยบินลงแล้วสะดวกที่สุด เรียงจากใกล้ไปไกล */
  nearestAirports: string[];
  nearestStation: string;
  localTransit: string;
  matchdayNotes: string;
  travelNotes: string;
};

export const GOG_STADIUMS: readonly GogStadium[] = [
  {
    stadium: "Old Trafford",
    club: "Manchester United",
    city: "Manchester",
    capacity: 74_310,
    nearestAirports: ["MAN"],
    nearestStation: "Old Trafford (Metrolink) หรือ Manchester Piccadilly แล้วต่อรถราง",
    localTransit: "รถราง Metrolink สาย Altrincham ลงป้าย Old Trafford เดินต่อ 8–10 นาที",
    matchdayNotes: "เข้าประตูก่อนเตะอย่างน้อย 75 นาที · หลังเกมรถรางแน่นมาก รอ 20–30 นาทีสบายกว่าเบียดออกทันที",
    travelNotes: "พักย่าน Northern Quarter หรือ Deansgate เดินทางสะดวกที่สุด · จากสนามบิน MAN เข้าเมืองด้วยรถไฟราว 20 นาที",
  },
  {
    stadium: "Etihad Stadium",
    club: "Manchester City",
    city: "Manchester",
    capacity: 53_400,
    nearestAirports: ["MAN"],
    nearestStation: "Etihad Campus (Metrolink)",
    localTransit: "Metrolink สาย Ashton ลงป้าย Etihad Campus เดินต่อ 5 นาที",
    matchdayNotes: "ดาร์บี้แมนเชสเตอร์ตั๋วหายากที่สุดของฤดูกาล ต้องวางแผนล่วงหน้าหลายเดือน",
    travelNotes: "อยู่คนละฝั่งเมืองกับโอลด์ แทรฟฟอร์ด แต่พักใจกลางเมืองไปได้ทั้งสองสนาม",
  },
  {
    stadium: "Anfield",
    club: "Liverpool",
    city: "Liverpool",
    capacity: 61_000,
    nearestAirports: ["MAN", "LPL"],
    nearestStation: "Liverpool Lime Street แล้วต่อรถบัส",
    localTransit: "รถบัสสาย 26/27 จากใจกลางเมือง ราว 20 นาที",
    matchdayNotes: "บรรยากาศก่อนเกมที่ Anfield ขึ้นชื่อเรื่องเสียงร้องประสาน ควรเข้าสนามเร็วกว่าปกติ",
    travelNotes: "จากแมนเชสเตอร์นั่งรถไฟราว 50 นาที ไป-กลับในวันเดียวได้สบาย",
  },
  {
    stadium: "Elland Road",
    club: "Leeds United",
    city: "Leeds",
    capacity: 37_600,
    nearestAirports: ["MAN", "LBA"],
    nearestStation: "Leeds",
    localTransit: "รถบัสรับส่งวันแข่งจากใจกลางเมือง หรือเดิน 35–40 นาที",
    matchdayNotes: "คู่กับแมนยูคือศึก War of the Roses บรรยากาศดุที่สุดคู่หนึ่งของอังกฤษ",
    travelNotes: "จากแมนเชสเตอร์นั่งรถไฟราว 1 ชั่วโมง เหมาะกับทริปไป-กลับในวันเดียว",
  },
  {
    stadium: "Emirates Stadium",
    club: "Arsenal",
    city: "London",
    capacity: 60_700,
    nearestAirports: ["LHR", "LGW"],
    nearestStation: "Arsenal (Piccadilly line) หรือ Finsbury Park",
    localTransit: "รถไฟใต้ดิน Piccadilly line ลงสถานี Arsenal เดิน 5 นาที",
    matchdayNotes: "สถานี Arsenal ปิดทางเข้าออกบางทิศหลังเกม เดินไป Finsbury Park เร็วกว่า",
    travelNotes: "พักโซน Kings Cross หรือ Islington เดินทางไปสนามสะดวกที่สุด",
  },
  {
    stadium: "Stamford Bridge",
    club: "Chelsea",
    city: "London",
    capacity: 40_300,
    nearestAirports: ["LHR", "LGW"],
    nearestStation: "Fulham Broadway (District line)",
    localTransit: "District line ลง Fulham Broadway เดิน 5 นาที",
    matchdayNotes: "สนามอยู่กลางย่านที่อยู่อาศัย ที่จอดรถแทบไม่มี ใช้รถไฟใต้ดินเท่านั้น",
    travelNotes: "อยู่ทางตะวันตกของลอนดอน เดินทางจากฮีทโธรว์สะดวกกว่าสนามอื่นในเมือง",
  },
  {
    stadium: "Tottenham Hotspur Stadium",
    club: "Tottenham Hotspur",
    city: "London",
    capacity: 62_850,
    nearestAirports: ["LHR", "LGW", "STN"],
    nearestStation: "White Hart Lane หรือ Seven Sisters",
    localTransit: "รถไฟ Overground ลง White Hart Lane เดิน 5 นาที",
    matchdayNotes: "สนามใหม่ที่สุดในลีก มีระบบจ่ายเงินแบบไร้เงินสดทั้งสนาม เตรียมบัตรไปให้พร้อม",
    travelNotes: "อยู่ทางเหนือของลอนดอน ไกลจากย่านท่องเที่ยวหลัก เผื่อเวลาเดินทางเพิ่ม",
  },
  {
    stadium: "Craven Cottage",
    club: "Fulham",
    city: "London",
    capacity: 29_600,
    nearestAirports: ["LHR", "LGW"],
    nearestStation: "Putney Bridge (District line)",
    localTransit: "District line ลง Putney Bridge เดินเลียบแม่น้ำเทมส์ 15 นาที",
    matchdayNotes: "สนามเก่าแก่ริมแม่น้ำ ความจุน้อย ตั๋วทีมเยือนจำกัดมาก",
    travelNotes: "ทางเดินเลียบแม่น้ำก่อนเกมสวยที่สุดแห่งหนึ่งในลอนดอน เผื่อเวลาถ่ายรูป",
  },
  {
    stadium: "Gtech Community Stadium",
    club: "Brentford",
    city: "London",
    capacity: 17_250,
    nearestAirports: ["LHR"],
    nearestStation: "Brentford หรือ Kew Bridge",
    localTransit: "รถไฟจาก London Waterloo ลง Brentford เดิน 10 นาที",
    matchdayNotes: "ความจุน้อยที่สุดในลีก ตั๋วหายากเป็นพิเศษสำหรับทีมเยือน",
    travelNotes: "ใกล้ฮีทโธรว์มาก เหมาะกับนัดที่ลงเครื่องแล้วไปสนามเลย",
  },
  {
    stadium: "Selhurst Park",
    club: "Crystal Palace",
    city: "London",
    capacity: 25_500,
    nearestAirports: ["LGW", "LHR"],
    nearestStation: "Selhurst หรือ Norwood Junction",
    localTransit: "รถไฟจาก London Victoria หรือ London Bridge ราว 20 นาที",
    matchdayNotes: "เสียงเชียร์ดังที่สุดแห่งหนึ่งของลีกเมื่อเทียบกับความจุ",
    travelNotes: "อยู่ทางใต้ของลอนดอน ใกล้สนามบินแกตวิกมากกว่าฮีทโธรว์",
  },
  {
    stadium: "St James' Park",
    club: "Newcastle United",
    city: "Newcastle upon Tyne",
    capacity: 52_300,
    nearestAirports: ["NCL", "MAN"],
    nearestStation: "Newcastle Central แล้วเดิน 15 นาที",
    localTransit: "รถไฟใต้ดิน Tyne and Wear Metro ลง St James",
    matchdayNotes: "สนามอยู่กลางเมืองพอดี เดินจากสถานีรถไฟถึงสนามได้เลย",
    travelNotes: "จากแมนเชสเตอร์นั่งรถไฟราว 2 ชั่วโมงครึ่ง ควรค้างคืนแทนไป-กลับวันเดียว",
  },
  {
    stadium: "Villa Park",
    club: "Aston Villa",
    city: "Birmingham",
    capacity: 42_600,
    nearestAirports: ["BHX", "MAN"],
    nearestStation: "Witton หรือ Aston",
    localTransit: "รถไฟจาก Birmingham New Street ราว 10 นาที",
    matchdayNotes: "สนามคลาสสิกที่ยังคงอัฒจันทร์เดิมไว้หลายฝั่ง บรรยากาศแบบอังกฤษดั้งเดิม",
    travelNotes: "เบอร์มิงแฮมอยู่กึ่งกลางระหว่างแมนเชสเตอร์กับลอนดอน ไปได้จากทั้งสองเมือง",
  },
  {
    stadium: "City Ground",
    club: "Nottingham Forest",
    city: "Nottingham",
    capacity: 30_400,
    nearestAirports: ["EMA", "MAN"],
    nearestStation: "Nottingham แล้วเดิน 20 นาที",
    localTransit: "เดินเลียบแม่น้ำเทรนต์จากใจกลางเมือง",
    matchdayNotes: "สนามริมแม่น้ำเทรนต์ อยู่ตรงข้ามสนามของน็อตส์ เคาน์ตี้ที่เก่าแก่ที่สุดในโลก",
    travelNotes: "จากแมนเชสเตอร์นั่งรถไฟราว 2 ชั่วโมง",
  },
  {
    stadium: "Hill Dickinson Stadium",
    club: "Everton",
    city: "Liverpool",
    capacity: 52_800,
    nearestAirports: ["MAN", "LPL"],
    nearestStation: "Sandhills แล้วต่อรถบัสรับส่ง",
    localTransit: "Merseyrail ลง Sandhills มีรถรับส่งวันแข่ง",
    matchdayNotes: "สนามใหม่ริมแม่น้ำเมอร์ซีย์ ย้ายมาจากกูดิสัน พาร์ค",
    travelNotes: "ไปพร้อมทริปแอนฟิลด์ได้ในเมืองเดียวกัน",
  },
  {
    stadium: "American Express Stadium",
    club: "Brighton & Hove Albion",
    city: "Brighton",
    capacity: 31_800,
    nearestAirports: ["LGW", "LHR"],
    nearestStation: "Falmer",
    localTransit: "รถไฟจาก Brighton ลง Falmer เดินถึงสนามเลย",
    matchdayNotes: "สนามอยู่นอกเมือง รถไฟหลังเกมแน่นมาก ควรเผื่อเวลาอย่างน้อย 1 ชั่วโมง",
    travelNotes: "ไบรท์ตันเป็นเมืองริมทะเล เหมาะกับทริปพักค้างคืนมากกว่าไป-กลับ",
  },
  {
    stadium: "Vitality Stadium",
    club: "AFC Bournemouth",
    city: "Bournemouth",
    capacity: 11_300,
    nearestAirports: ["LHR", "BOH"],
    nearestStation: "Pokesdown หรือ Bournemouth",
    localTransit: "เดินจาก Pokesdown ราว 15 นาที",
    matchdayNotes: "ความจุน้อยมาก ตั๋วทีมเยือนได้จัดสรรไม่ถึงพันใบในหลายนัด",
    travelNotes: "จากลอนดอนนั่งรถไฟราว 2 ชั่วโมง เมืองชายทะเลเหมาะกับพักค้างคืน",
  },
  {
    stadium: "MKM Stadium",
    club: "Hull City",
    city: "Hull",
    capacity: 25_400,
    nearestAirports: ["MAN", "LBA"],
    nearestStation: "Hull Paragon Interchange",
    localTransit: "เดินจากสถานีราว 25–35 นาที หรือใช้รถบัส",
    matchdayNotes: "สนามอยู่ในสวนสาธารณะ West Park เดินจากเมืองได้",
    travelNotes: "จากแมนเชสเตอร์นั่งรถไฟราว 2 ชั่วโมง 15 นาที บางเที่ยวต้องเปลี่ยนขบวนที่ลีดส์",
  },
  {
    stadium: "Portman Road",
    club: "Ipswich Town",
    city: "Ipswich",
    capacity: 30_300,
    nearestAirports: ["STN", "LHR"],
    nearestStation: "Ipswich แล้วเดิน 10 นาที",
    localTransit: "เดินจากสถานีรถไฟถึงสนามได้เลย",
    matchdayNotes: "สนามอยู่ใจกลางเมือง เดินจากสถานีสะดวกที่สุดสนามหนึ่งในลีก",
    travelNotes: "จากลอนดอน Liverpool Street นั่งรถไฟราว 1 ชั่วโมง 10 นาที",
  },
  {
    stadium: "Coventry Building Society Arena",
    club: "Coventry City",
    city: "Coventry",
    capacity: 32_600,
    nearestAirports: ["BHX", "MAN"],
    nearestStation: "Coventry Arena",
    localTransit: "รถไฟจาก Coventry ลง Coventry Arena ถึงสนามเลย",
    matchdayNotes: "สนามอยู่นอกเมือง มีที่จอดรถเยอะกว่าสนามอื่นในลีก",
    travelNotes: "อยู่ใกล้เบอร์มิงแฮม รวมทริปกับวิลลา พาร์คได้",
  },
  {
    stadium: "Stadium of Light",
    club: "Sunderland",
    city: "Sunderland",
    capacity: 48_700,
    nearestAirports: ["NCL", "MAN"],
    nearestStation: "Stadium of Light (Tyne and Wear Metro)",
    localTransit: "Metro จากนิวคาสเซิลราว 25 นาที ลงหน้าสนามเลย",
    matchdayNotes: "สนามใหญ่ที่สุดแห่งหนึ่งนอกลอนดอนกับแมนเชสเตอร์ เสียงเชียร์ดังมาก",
    travelNotes: "รวมทริปกับนิวคาสเซิลได้ในทริปเดียว อยู่ห่างกันแค่ 25 นาที",
  },
];

const BY_STADIUM = new Map(GOG_STADIUMS.map((entry) => [entry.stadium.toLowerCase(), entry]));

/** หาคู่มือสนามจากชื่อที่ผู้ให้บริการส่งมา — ไม่มีก็คืน null ไม่เดา */
export function gogStadium(name: string | null | undefined) {
  if (!name) return null;
  return BY_STADIUM.get(name.toLowerCase()) ?? null;
}
