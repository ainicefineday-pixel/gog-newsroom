import { ReplayMatch } from "@/features/replay/replay-app";
import "../../replay.css";
export default async function MatchReplayPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <ReplayMatch matchId={slug}/>}
