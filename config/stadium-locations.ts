export type StadiumLocation = {
  club: string;
  stadium: string;
  city: string;
  latitude: number;
  longitude: number;
  code: string;
};

// Coordinates identify the 20 host grounds in Manchester United's published
// 2026/27 Premier League fixture list.
export const STADIUM_LOCATIONS: readonly StadiumLocation[] = [
  { club: "Manchester United", stadium: "Old Trafford", city: "Manchester", latitude: 53.46311, longitude: -2.29139, code: "MU" },
  { club: "Hull City", stadium: "MKM Stadium", city: "Hull", latitude: 53.74616, longitude: -0.36755, code: "HUL" },
  { club: "Ipswich Town", stadium: "Portman Road", city: "Ipswich", latitude: 52.05495, longitude: 1.14468, code: "IPS" },
  { club: "Everton", stadium: "Hill Dickinson Stadium", city: "Liverpool", latitude: 53.42528, longitude: -3.00273, code: "EVE" },
  { club: "Manchester City", stadium: "Etihad Stadium", city: "Manchester", latitude: 53.48314, longitude: -2.20039, code: "MCI" },
  { club: "Fulham", stadium: "Craven Cottage", city: "London", latitude: 51.4749, longitude: -0.22162, code: "FUL" },
  { club: "Tottenham Hotspur", stadium: "Tottenham Hotspur Stadium", city: "London", latitude: 51.60432, longitude: -0.0664, code: "TOT" },
  { club: "Leeds United", stadium: "Elland Road", city: "Leeds", latitude: 53.77781, longitude: -1.57212, code: "LEE" },
  { club: "AFC Bournemouth", stadium: "Vitality Stadium", city: "Bournemouth", latitude: 50.73528, longitude: -1.83829, code: "BOU" },
  { club: "Chelsea", stadium: "Stamford Bridge", city: "London", latitude: 51.48167, longitude: -0.19096, code: "CHE" },
  { club: "Aston Villa", stadium: "Villa Park", city: "Birmingham", latitude: 52.50913, longitude: -1.88477, code: "AVL" },
  { club: "Liverpool", stadium: "Anfield", city: "Liverpool", latitude: 53.43082, longitude: -2.96083, code: "LIV" },
  { club: "Brentford", stadium: "Gtech Community Stadium", city: "London", latitude: 51.49082, longitude: -0.28865, code: "BRE" },
  { club: "Newcastle United", stadium: "St James' Park", city: "Newcastle upon Tyne", latitude: 54.97517, longitude: -1.62235, code: "NEW" },
  { club: "Coventry City", stadium: "Coventry Building Society Arena", city: "Coventry", latitude: 52.44806, longitude: -1.49556, code: "COV" },
  { club: "Crystal Palace", stadium: "Selhurst Park", city: "London", latitude: 51.39828, longitude: -0.08549, code: "CRY" },
  { club: "Arsenal", stadium: "Emirates Stadium", city: "London", latitude: 51.55489, longitude: -0.10844, code: "ARS" },
  { club: "Nottingham Forest", stadium: "City Ground", city: "Nottingham", latitude: 52.93992, longitude: -1.13272, code: "NFO" },
  { club: "Sunderland", stadium: "Stadium of Light", city: "Sunderland", latitude: 54.9144, longitude: -1.3882, code: "SUN" },
  { club: "Brighton & Hove Albion", stadium: "American Express Stadium", city: "Brighton", latitude: 50.86182, longitude: -0.08314, code: "BHA" },
] as const;
