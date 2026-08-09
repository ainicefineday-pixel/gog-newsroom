export type FixtureStatus = "confirmed" | "provisional";

export type MuFixture = {
  matchday: number;
  kickoffUtc: string;
  home: string;
  away: string;
  stadium: string;
  city: string;
  status: FixtureStatus;
  broadcaster?: string;
};

type Venue = { stadium: string; city: string };

const VENUES: Record<string, Venue> = {
  "Manchester United": { stadium: "Old Trafford", city: "Manchester" },
  "Hull City": { stadium: "MKM Stadium", city: "Hull" },
  "Ipswich Town": { stadium: "Portman Road", city: "Ipswich" },
  Everton: { stadium: "Hill Dickinson Stadium", city: "Liverpool" },
  "Manchester City": { stadium: "Etihad Stadium", city: "Manchester" },
  Fulham: { stadium: "Craven Cottage", city: "London" },
  "Tottenham Hotspur": { stadium: "Tottenham Hotspur Stadium", city: "London" },
  "Leeds United": { stadium: "Elland Road", city: "Leeds" },
  "AFC Bournemouth": { stadium: "Vitality Stadium", city: "Bournemouth" },
  Chelsea: { stadium: "Stamford Bridge", city: "London" },
  "Aston Villa": { stadium: "Villa Park", city: "Birmingham" },
  Liverpool: { stadium: "Anfield", city: "Liverpool" },
  Brentford: { stadium: "Gtech Community Stadium", city: "London" },
  "Newcastle United": { stadium: "St James' Park", city: "Newcastle upon Tyne" },
  "Coventry City": { stadium: "Coventry Building Society Arena", city: "Coventry" },
  "Crystal Palace": { stadium: "Selhurst Park", city: "London" },
  Arsenal: { stadium: "Emirates Stadium", city: "London" },
  "Nottingham Forest": { stadium: "City Ground", city: "Nottingham" },
  Sunderland: { stadium: "Stadium of Light", city: "Sunderland" },
  "Brighton & Hove Albion": { stadium: "American Express Stadium", city: "Brighton" },
};

function fixture(
  matchday: number,
  kickoffUtc: string,
  home: string,
  away: string,
  status: FixtureStatus = "provisional",
  broadcaster?: string,
): MuFixture {
  const venue = VENUES[home];
  if (!venue) throw new Error(`Missing venue for ${home}`);
  return { matchday, kickoffUtc, home, away, ...venue, status, broadcaster };
}

export const PREMIER_LEAGUE_FIXTURE_SOURCE = "https://www.premierleague.com/en/news/4675130/all-of-manchester-uniteds-fixtures-for-202627-premier-league-season";
export const PREMIER_LEAGUE_TIME_SOURCE = "https://www.premierleague.com/en/news/4678381";
export const FIXTURE_DATA_UPDATED_AT = "2026-07-07T12:00:00Z";

// Provisional weekend kick-offs use the Premier League's published 15:00 UK
// placeholder. They remain clearly labelled until broadcast selections confirm them.
export const MU_PREMIER_LEAGUE_FIXTURES: readonly MuFixture[] = [
  fixture(1, "2026-08-22T11:30:00Z", "Hull City", "Manchester United", "confirmed", "TNT Sports"),
  fixture(2, "2026-08-30T15:30:00Z", "Manchester United", "Ipswich Town", "confirmed", "Sky Sports"),
  fixture(3, "2026-09-06T13:00:00Z", "Everton", "Manchester United", "confirmed", "Sky Sports"),
  fixture(4, "2026-09-13T15:30:00Z", "Manchester United", "Manchester City", "confirmed", "Sky Sports"),
  fixture(5, "2026-09-20T15:30:00Z", "Fulham", "Manchester United", "confirmed", "Sky Sports"),
  fixture(6, "2026-10-10T14:00:00Z", "Manchester United", "Tottenham Hotspur"),
  fixture(7, "2026-10-17T14:00:00Z", "Leeds United", "Manchester United"),
  fixture(8, "2026-10-24T14:00:00Z", "Manchester United", "AFC Bournemouth"),
  fixture(9, "2026-10-31T15:00:00Z", "Chelsea", "Manchester United"),
  fixture(10, "2026-11-07T15:00:00Z", "Manchester United", "Aston Villa"),
  fixture(11, "2026-11-21T15:00:00Z", "Liverpool", "Manchester United"),
  fixture(12, "2026-11-28T15:00:00Z", "Manchester United", "Brentford"),
  fixture(13, "2026-12-02T20:00:00Z", "Newcastle United", "Manchester United"),
  fixture(14, "2026-12-05T15:00:00Z", "Manchester United", "Coventry City"),
  fixture(15, "2026-12-12T15:00:00Z", "Crystal Palace", "Manchester United"),
  fixture(16, "2026-12-19T15:00:00Z", "Arsenal", "Manchester United"),
  fixture(17, "2026-12-26T15:00:00Z", "Manchester United", "Nottingham Forest"),
  fixture(18, "2026-12-30T20:00:00Z", "Manchester United", "Sunderland"),
  fixture(19, "2027-01-02T15:00:00Z", "Brighton & Hove Albion", "Manchester United"),
  fixture(20, "2027-01-06T20:00:00Z", "Manchester United", "Newcastle United"),
  fixture(21, "2027-01-16T15:00:00Z", "Aston Villa", "Manchester United"),
  fixture(22, "2027-01-23T15:00:00Z", "Manchester United", "Liverpool"),
  fixture(23, "2027-01-30T15:00:00Z", "Brentford", "Manchester United"),
  fixture(24, "2027-02-06T15:00:00Z", "Manchester United", "Chelsea"),
  fixture(25, "2027-02-10T20:00:00Z", "Manchester United", "Brighton & Hove Albion"),
  fixture(26, "2027-02-20T15:00:00Z", "Nottingham Forest", "Manchester United"),
  fixture(27, "2027-02-27T15:00:00Z", "Manchester United", "Arsenal"),
  fixture(28, "2027-03-03T20:00:00Z", "Sunderland", "Manchester United"),
  fixture(29, "2027-03-13T15:00:00Z", "Manchester United", "Everton"),
  fixture(30, "2027-03-20T15:00:00Z", "Manchester City", "Manchester United"),
  fixture(31, "2027-04-10T14:00:00Z", "Manchester United", "Hull City"),
  fixture(32, "2027-04-17T14:00:00Z", "Ipswich Town", "Manchester United"),
  fixture(33, "2027-04-24T14:00:00Z", "Manchester United", "Crystal Palace"),
  fixture(34, "2027-05-01T14:00:00Z", "Coventry City", "Manchester United"),
  fixture(35, "2027-05-08T14:00:00Z", "AFC Bournemouth", "Manchester United"),
  fixture(36, "2027-05-15T14:00:00Z", "Manchester United", "Leeds United"),
  fixture(37, "2027-05-23T14:00:00Z", "Tottenham Hotspur", "Manchester United"),
  fixture(38, "2027-05-30T15:00:00Z", "Manchester United", "Fulham"),
];
