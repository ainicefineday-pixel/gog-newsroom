export type DataStatus = "confirmed" | "reconstructed" | "estimated";
export type Coordinate = { x: number; y: number };
export type EventType = "kickoff" | "pass" | "carry" | "cross" | "tackle" | "interception" | "recovery" | "foul" | "corner" | "offside" | "shot" | "save" | "goal" | "yellow-card" | "red-card" | "injury" | "substitution" | "half-time" | "second-half" | "full-time";

export interface Player { id: string; name: string; shortName: string; number?: number; position: string; captain?: boolean }
export interface Team { id: string; name: string; shortName: string; color: string; secondary: string; formation: string; starters: Player[]; substitutes: Player[] }
export interface DataSource { label: string; url: string }
export interface MatchEvent {
  id: string; matchId: string; period: 1 | 2; minute: number; second: number; displayMinute: string;
  type: EventType; teamId?: string; playerId?: string; secondaryPlayerId?: string; start?: Coordinate; end?: Coordinate;
  outcome?: "goal" | "saved" | "off-target" | "blocked" | "complete" | "incomplete"; xg?: number;
  commentary: string; dataStatus: DataStatus; sourceNote?: string;
}
export interface MatchStatistics {
  possession: Record<string, number>; shots: Record<string, number>; shotsOnTarget: Record<string, number>;
  corners: Record<string, number>; fouls: Record<string, number>; yellowCards: Record<string, number>; redCards: Record<string, number>;
  xg?: Record<string, number>; saves?: Record<string, number>;
}
export interface MatchDefinition {
  id: string; seed: number; date: string; competition: string; venue: string; home: Team; away: Team;
  finalScore: [number, number]; halfTimeScore: [number, number]; confirmedEvents: MatchEvent[];
  statistics: MatchStatistics; sources: DataSource[]; coverage: string;
}
export interface MovementFrame { time: number; players: Record<string, Coordinate>; ball: Coordinate; ballOwnerId?: string; eventId: string }
export interface MinuteReport { minute: number; displayMinute: string; commentary: string; dataStatus: DataStatus; eventIds: string[] }
export interface ChartDataPoint { minute: number; home: number; away: number }
export interface GeneratedMatch { definition: MatchDefinition; events: MatchEvent[]; minuteReports: MinuteReport[]; duration: number }
export interface ReplayState { time: number; score: [number, number]; active: Record<string, string[]>; cards: Record<string, "yellow" | "red">; currentEvent: MatchEvent }

