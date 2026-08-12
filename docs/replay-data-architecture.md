# GOG Replay Data Architecture

## Automated pipeline

Cloudflare Cron (10 minutes) → provider adapters → raw snapshots in D1 → entity resolution → validation → canonical match/player records → Replay API → GOG indices and branded exports.

## Source policy

- Tier A: Manchester United and Premier League official squad, fixtures, lineups and match facts.
- Tier B: licensed/API match providers such as football-data.org for schedules, results and status.
- Tier C: FPL public dataset for availability, position, price, form and gameweek aggregates.
- Training reference only: StatsBomb Open Data for learning event-model priors. Never present its unrelated historical matches as current Manchester United facts.
- Editorial corroboration: reputable match reports for incidents absent from structured feeds.

Every stored value requires `provider`, `source_url`, `observed_at`, `effective_at`, `confidence`, and `data_status`. Conflicts remain visible; estimated and reconstructed values never overwrite confirmed facts.

## D1 entities to add

- `players`, `player_aliases`, `player_source_ids`, `player_snapshots`
- `matches`, `lineups`, `match_events_raw`, `match_events_canonical`
- `player_match_stats`, `team_match_stats`, `availability`
- `metric_definitions`, `metric_values`, `sync_runs`, `validation_issues`

Use append-only snapshots. A canonical view selects the newest highest-tier non-conflicting observation.

## GOG interpretation layer

Publish percentile-based, position-adjusted signals with minimum-minute thresholds:

- GOG Control: possession value, progression, retention under pressure.
- GOG Threat: shot quality, box arrival, chance contribution.
- GOG Resistance: duel survival, pressure escape, turnover cost.
- GOG Momentum: rolling match-window territorial and chance pressure.
- GOG Reliability: availability, sample size and performance variance.

Each card must show cohort, minutes, season, last update, formula version and confirmed/reconstructed status.

## Runtime schedule

- Every 10 minutes: live fixture status, scores, news and provider health.
- Match window every 1–2 minutes when a supported live provider is configured.
- Nightly: full player/squad snapshots, aliases and validation audit.
- After full time: freeze confirmed anchors, rebuild Replay, calculate indices and publish branded cards.
- Weekly: backfill missing player metadata and review unresolved identity conflicts.
