import type { Coordinate, GeneratedMatch, MatchDefinition, MatchEvent, ReplayState, Team } from "./types";

function rng(seed: number) { let value=seed>>>0; return () => ((value=Math.imul(value^value>>>15,1|value),value^=value+Math.imul(value^value>>>7,61|value),((value^value>>>14)>>>0)/4294967296)); }
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const at=(event:MatchEvent)=>event.minute*60+event.second;
const playerPool=(team:Team,type:"shot"|"pass")=>team.starters.filter(player=>player.position!=="GK"&&(type!=="shot"||!/[CRL]?B|GK/.test(player.position)));
function activePoolAt(match:MatchDefinition,team:Team,minute:number,type:"shot"|"pass"){
  const ids=team.starters.map(player=>player.id);
  for(const event of match.confirmedEvents.filter(event=>event.teamId===team.id&&event.minute<=minute).sort((a,b)=>at(a)-at(b))){
    if(event.type==="red-card"&&event.playerId){const index=ids.indexOf(event.playerId);if(index>=0)ids.splice(index,1)}
    if(event.type==="substitution"&&event.playerId&&event.secondaryPlayerId){const index=ids.indexOf(event.playerId);if(index>=0)ids.splice(index,1,event.secondaryPlayerId)}
  }
  const players=[...team.starters,...team.substitutes].filter(player=>ids.includes(player.id)&&player.position!=="GK"&&(type!=="shot"||!/[CRL]?B|GK/.test(player.position)));
  return players.length?players:playerPool(team,type);
}

function generatedEvent(match:MatchDefinition,index:number,minute:number,second:number,type:MatchEvent["type"],teamId:string,playerId:string,random:()=>number,extra:Partial<MatchEvent>={}):MatchEvent {
  const attackingRight=(teamId===match.home.id)===(minute<46);
  const sx=type==="shot"?78+random()*20:18+random()*68;
  const start={x:attackingRight?sx:105-sx,y:5+random()*58};
  const end={x:type==="shot"?(attackingRight?105:0):clamp(start.x+(attackingRight?1:-1)*(8+random()*18),0,105),y:clamp(start.y+(random()-.5)*20,0,68)};
  return {id:`${match.id}-r-${index}`,matchId:match.id,period:minute<46?1:2,minute,second,displayMinute:`${minute}′`,type,teamId,playerId,start,end,commentary:"",dataStatus:"reconstructed",...extra};
}

const actionText=(event:MatchEvent,match:MatchDefinition)=>{
  const team=event.teamId===match.home.id?match.home:match.away;
  const player=[...team.starters,...team.substitutes].find(item=>item.id===event.playerId)?.shortName??team.shortName;
  if(event.type==="shot") return `${player} ${event.outcome==="saved"?"tests the goalkeeper with a controlled effort":event.outcome==="blocked"?"has an effort blocked in a crowded area":"shoots after the attack reaches the final third"}.`;
  if(event.type==="corner") return `${team.shortName} force a corner after sustained pressure down the flank.`;
  if(event.type==="foul") return `${player} concedes a foul as ${team.shortName} try to stop the transition.`;
  if(event.type==="yellow-card") return `${player} is booked following the reconstructed foul sequence.`;
  return `${team.shortName} circulate possession through ${player}, then shift the defensive block toward the ball.`;
};

function fillCategory(match:MatchDefinition,events:MatchEvent[],type:MatchEvent["type"],target:Record<string,number>,random:()=>number,indexRef:{value:number}) {
  for(const team of [match.home,match.away]){
    const existing=events.filter(event=>event.teamId===team.id&&(type==="shot"?(event.type==="shot"||event.type==="goal"):event.type===type)).length;
    for(let i=existing;i<(target[team.id]??0);i++){
      let minute=1+Math.floor(random()*88); while(events.some(e=>e.minute===minute&&Math.abs(e.second-Math.floor(random()*55))<4)) minute=1+Math.floor(random()*88);
      const pool=activePoolAt(match,team,minute,type==="shot"?"shot":"pass"); const player=pool[Math.floor(random()*pool.length)];
      const event=generatedEvent(match,indexRef.value++,minute,Math.floor(random()*55),type,team.id,player.id,random);
      event.commentary=actionText(event,match); events.push(event);
    }
  }
}

export function reconstructMatch(match:MatchDefinition,seed=match.seed):GeneratedMatch {
  const random=rng(seed),events=match.confirmedEvents.map(event=>({...event})),index={value:0};
  fillCategory(match,events,"shot",match.statistics.shots,random,index);
  for(const team of [match.home,match.away]){
    const shots=events.filter(e=>e.teamId===team.id&&(e.type==="shot"||e.type==="goal")).sort((a,b)=>at(a)-at(b));
    const onTarget=match.statistics.shotsOnTarget[team.id]; let fixed=shots.filter(e=>e.outcome==="goal"||e.outcome==="saved").length;
    for(const shot of shots){ if(shot.outcome) continue; shot.outcome=fixed<onTarget?"saved":random()<.45?"blocked":"off-target"; if(shot.outcome==="saved")fixed++; }
    const targetXg=match.statistics.xg?.[team.id];
    if(targetXg!==undefined){ const fixedXg=shots.reduce((sum,e)=>sum+(e.xg??0),0); const missing=shots.filter(e=>e.xg===undefined); let remaining=Math.max(.01,targetXg-fixedXg); missing.forEach((shot,i)=>{const left=missing.length-i; const value=i===missing.length-1?remaining:Math.min(remaining-.01*(left-1),.02+random()*.11); shot.xg=Number(value.toFixed(2)); remaining=Number((remaining-shot.xg).toFixed(2));}); }
  }
  fillCategory(match,events,"corner",match.statistics.corners,random,index);
  fillCategory(match,events,"foul",match.statistics.fouls,random,index);
  fillCategory(match,events,"yellow-card",match.statistics.yellowCards,random,index);
  // One possession action every minute gives the animation and report a shared, continuous backbone.
  for(let minute=0;minute<=90;minute++){
    if(events.some(event=>event.minute===minute&&!["half-time","full-time"].includes(event.type)))continue;
    const possession=random()<(match.statistics.possession[match.home.id]/100)?match.home:match.away;
    const pool=activePoolAt(match,possession,minute,"pass"),player=pool[Math.floor(random()*pool.length)];
    const event=generatedEvent(match,index.value++,minute,15+Math.floor(random()*35),random()<.18?"carry":"pass",possession.id,player.id,random,{outcome:"complete"});
    event.commentary=actionText(event,match);events.push(event);
  }
  events.sort((a,b)=>at(a)-at(b)||a.id.localeCompare(b.id));
  const minuteReports=Array.from({length:91},(_,minute)=>{
    const list=events.filter(event=>event.minute===minute),anchor=list.find(event=>event.dataStatus==="confirmed")??list[0];
    return {minute,displayMinute:minute===0?"00′":`${minute}′`,commentary:anchor?.commentary??`${match.home.shortName} and ${match.away.shortName} reset their shapes around the ball.`,dataStatus:anchor?.dataStatus??"reconstructed",eventIds:list.map(event=>event.id)};
  });
  const generated={definition:match,events,minuteReports,duration:90*60}; validateMatch(generated); return generated;
}

export function stateAt(match:GeneratedMatch,time:number):ReplayState{
  const events=match.events.filter(event=>at(event)<=time);
  const active:Record<string,string[]>={
    [match.definition.home.id]:match.definition.home.starters.map(player=>player.id),
    [match.definition.away.id]:match.definition.away.starters.map(player=>player.id),
  };
  const cards:Record<string,"yellow"|"red">={};
  const score:[number,number]=[0,0];
  for(const event of events){ if(event.type==="goal"&&event.teamId)score[event.teamId===match.definition.home.id?0:1]++; if(event.type==="yellow-card"&&event.playerId)cards[event.playerId]="yellow"; if(event.type==="red-card"&&event.playerId){cards[event.playerId]="red"; active[event.teamId!]=active[event.teamId!].filter(id=>id!==event.playerId);} if(event.type==="substitution"&&event.playerId&&event.secondaryPlayerId){active[event.teamId!]=active[event.teamId!].filter(id=>id!==event.playerId).concat(event.secondaryPlayerId);} }
  return {time,score,active,cards,currentEvent:events.at(-1)??match.events[0]};
}

const FORMATIONS:Record<string,Coordinate[]>={"4-2-3-1":[{x:7,y:34},{x:25,y:10},{x:22,y:27},{x:22,y:41},{x:25,y:58},{x:43,y:27},{x:43,y:41},{x:63,y:12},{x:61,y:34},{x:63,y:56},{x:82,y:34}],"4-3-3":[{x:7,y:34},{x:24,y:9},{x:21,y:27},{x:21,y:41},{x:24,y:59},{x:44,y:18},{x:40,y:34},{x:44,y:50},{x:72,y:11},{x:80,y:34},{x:72,y:57}],"3-4-2-1":[{x:7,y:34},{x:22,y:17},{x:19,y:34},{x:22,y:51},{x:43,y:8},{x:40,y:28},{x:40,y:40},{x:43,y:60},{x:64,y:23},{x:64,y:45},{x:82,y:34}]};
export function positionsAt(match:GeneratedMatch,time:number){const state=stateAt(match,time),event=state.currentEvent,result:Record<string,Coordinate>={}; for(const [ti,team] of [match.definition.home,match.definition.away].entries()){const template=FORMATIONS[team.formation]??FORMATIONS["4-2-3-1"],ids=state.active[team.id]; ids.forEach((id,i)=>{const base=template[Math.min(i,template.length-1)],away=ti===1,phase=Math.sin(time/8+i*1.7),ballShift=((event.end?.x??52.5)-52.5)*.17; result[id]={x:clamp((away?105-base.x:base.x)+ballShift+(i?phase*1.4:0),2,103),y:clamp((away?68-base.y:base.y)+Math.cos(time/7+i)*1.1,2,66)};});} const progress=clamp((time-at(event))/Math.max(1,(match.events[match.events.indexOf(event)+1]?at(match.events[match.events.indexOf(event)+1]):time+10)-at(event)),0,1); const start=event.start??{x:52.5,y:34},end=event.end??start; return {players:result,ball:{x:start.x+(end.x-start.x)*progress,y:start.y+(end.y-start.y)*progress}};}

export function liveStats(match:GeneratedMatch,time:number){const result:Record<string,Record<string,number>>={};for(const team of [match.definition.home,match.definition.away])result[team.id]={shots:0,onTarget:0,corners:0,fouls:0,yellow:0,red:0,xg:0}; for(const event of match.events){if(at(event)>time||!event.teamId)continue;const row=result[event.teamId];if(event.type==="shot"||event.type==="goal"){row.shots++;row.xg+=event.xg??0;if(event.outcome==="goal"||event.outcome==="saved")row.onTarget++;}if(event.type==="corner")row.corners++;if(event.type==="foul")row.fouls++;if(event.type==="yellow-card")row.yellow++;if(event.type==="red-card")row.red++;}return result;}
export function chartSeries(match:GeneratedMatch){return Array.from({length:91},(_,minute)=>{const stats=liveStats(match,minute*60+59),home=match.definition.home.id,away=match.definition.away.id;return {minute,home:Number(stats[home].xg.toFixed(2)),away:Number(stats[away].xg.toFixed(2))};});}

export function validateMatch(match:GeneratedMatch){const errors:string[]=[];const final=stateAt(match,match.duration);if(final.score.join("-")!==match.definition.finalScore.join("-"))errors.push("final score");for(const team of [match.definition.home,match.definition.away]){const stats=liveStats(match,match.duration),id=team.id;if(stats[id].shots!==match.definition.statistics.shots[id])errors.push(`${id} shots`);if(stats[id].onTarget!==match.definition.statistics.shotsOnTarget[id])errors.push(`${id} on target`);if(stats[id].corners!==match.definition.statistics.corners[id])errors.push(`${id} corners`);if(stats[id].fouls!==match.definition.statistics.fouls[id])errors.push(`${id} fouls`);if(stats[id].yellow!==match.definition.statistics.yellowCards[id])errors.push(`${id} yellow`);if(stats[id].red!==match.definition.statistics.redCards[id])errors.push(`${id} red`);const xg=match.definition.statistics.xg?.[id];if(xg!==undefined&&Math.abs(stats[id].xg-xg)>.001)errors.push(`${id} xg`);}if(match.minuteReports.length!==91)errors.push("minute reports");if(errors.length)throw new Error(`Invalid reconstruction: ${errors.join(", ")}`);return true;}
