import { Newsroom } from "../../newsroom";
import "../../replay.css";
import "../../replay-intelligence.css";
import "../../data-lab/data-lab.css";
import "../../data-lab/gog-data-theme.css";
export default async function MatchReplayPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <Newsroom initialView="replay" initialMatchId={slug}/>}
