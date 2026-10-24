import N from './src/sims.bundle.js';
const game='penthouse-pilot',g=N.games[game],seed=N.seedFor(game);
// greedy bot: flap when below target and falling
const s=g.create(seed),log=[[0,1]];g.input(s,1);let last=0;
while(!s.done&&s.tick<g.maxTicks){const o=s.cols.find(o=>o.x+o.w>g.BX-g.HR);const tgt=o?o.c+o.gap*0.22:300;
 if(s.y>tgt&&s.vy>0&&s.tick-last>=6){log.push([s.tick,1]);g.input(s,1);last=s.tick}
 g.step(s);if(s.tick>=g.maxTicks)s.done=true}
const v=N.verify({game,week:N.weekId(),seed,log,wallMs:s.tick/g.tps*1000,claimed:g.score(s)});
if(!v.ok||s.gates<20){console.log('FAIL pilot');process.exit(1)}
console.log('pilot full run',s.tick,'gates',s.gates,'score',g.score(s),v.ok,v.reasons, 'flaps',log.length);
