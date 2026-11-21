/* NetNet Arcade shared template JS (UMD-lite, no deps).
 * NN.rng(seed)        deterministic PRNG (mulberry32). Same seed => same game for everyone. No chance vs. the house.
 * NN.daySeed(id)      seed for today's UTC "tape", so everyone plays the same level (skill-only).
 * NN.params()         ?seed=&vs=&n= from a challenge link
 * NN.end(opts)        result modal: score, share card (PNG), challenge link, demo leaderboard
 * NN.track(ev,data)   privacy-friendly analytics hook: localStorage + console unless an endpoint is configured
 * NN.forge(el,cfg)    Net Forge economics panel (SIMULATION: coin, bonding curve in wsNET, tax, reward jar)
 * NN.footer()         required footer line
 */
(function(g){
const NN={};
NN.cfg=Object.assign({game:"template",title:"NETNET GAME",color:"#38f5ff",unit:"pts",higherIsBetter:true},g.NN_GAME||{});
// ---------- deterministic RNG
NN.hash=s=>{let h=2166136261>>>0;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h};
NN.rng=seed=>{let a=(typeof seed==="number"?seed:NN.hash(seed))>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}};
NN.day=()=>new Date().toISOString().slice(0,10);
NN.daySeed=id=>NN.hash((id||NN.cfg.game)+":"+NN.day());
NN.params=()=>{const q=new URLSearchParams(location.search);return{seed:q.get("seed"),vs:q.get("vs")!=null?+q.get("vs"):null,n:q.get("n")}};
NN.seed=()=>{const p=NN.params();return p.seed?+p.seed:NN.daySeed()};
// ---------- analytics (OFF unless endpoint set). No cookies, no IDs beyond a random local id.
NN.ANALYTICS={endpoint:g.NN_ANALYTICS_ENDPOINT||null,provider:g.NN_ANALYTICS_PROVIDER||null};
NN.track=(ev,data)=>{const rec={ev,game:NN.cfg.game,t:Date.now(),d:data||{}};
 try{const k="nn_an_"+NN.cfg.game,a=JSON.parse(localStorage.getItem(k)||"[]");a.push(rec);localStorage.setItem(k,JSON.stringify(a.slice(-500)))}catch(e){}
 if(g.NN_ANALYTICS_DEBUG!==false)console.log("[NN.track]",ev,rec.d);
 const E=NN.ANALYTICS;if(!E.endpoint)return;
 try{if(E.provider==="plausible"&&g.plausible)g.plausible(ev,{props:Object.assign({game:NN.cfg.game},rec.d)});
 else if(E.provider==="goatcounter"&&g.goatcounter)g.goatcounter.count({path:NN.cfg.game+"/"+ev,event:true});
 else navigator.sendBeacon&&navigator.sendBeacon(E.endpoint,JSON.stringify(rec))}catch(e){}};
NN.stats=()=>{try{return JSON.parse(localStorage.getItem("nn_an_"+NN.cfg.game)||"[]")}catch(e){return[]}};
// ---------- leaderboard (DEMO: local + labelled demo rivals)
NN.board=(score)=>{const k="nn_best_"+NN.cfg.game,hb=NN.cfg.higherIsBetter;let best=+localStorage.getItem(k);
 if(!localStorage.getItem(k)||(hb?score>best:score<best)){localStorage.setItem(k,score);best=score}
 const r=NN.rng(NN.daySeed()+7),base=NN.cfg.demoBase||100,names=["demo_whale","demo_degen","demo_gm","demo_rwa","demo_bot?"];
 const rows=names.map(n=>({n,s:Math.round(base*(0.6+r()*0.9))}));rows.push({n:"you (best)",s:best,me:1});
 rows.sort((a,b)=>hb?b.s-a.s:a.s-b.s);return rows};
// ---------- share card
NN.card=(score,line)=>{const c=document.createElement("canvas");c.width=1080;c.height=1080;const x=c.getContext("2d"),col=NN.cfg.color;
 x.fillStyle="#070b16";x.fillRect(0,0,1080,1080);x.strokeStyle=col;x.lineWidth=16;x.strokeRect(40,40,1000,1000);
 x.fillStyle=col;x.font="bold 46px system-ui";x.textAlign="center";x.fillText("NETNET ARCADE",540,170);
 x.font="900 92px system-ui";x.fillText(NN.cfg.title,540,330);x.fillStyle="#fff";x.font="900 200px system-ui";x.fillText(String(score),540,620);
 x.fillStyle="#8b9bb8";x.font="40px system-ui";x.fillText(NN.cfg.unit+" · "+NN.day(),540,700);x.fillText(line||"Can you beat me?",540,800);
 x.font="30px system-ui";x.fillText("Skill only · same level for everyone · prototype",540,960);return c};
NN.challengeURL=score=>{const u=new URL(location.href);u.search="";u.searchParams.set("seed",NN.seed());u.searchParams.set("vs",score);return u.toString()};
NN.share=async(score,line)=>{const url=NN.challengeURL(score),text=NN.cfg.title+": I scored "+score+" "+NN.cfg.unit+". Beat me 👉";NN.track("share",{score});
 try{const blob=await new Promise(r=>NN.card(score,line).toBlob(r,"image/png"));const f=new File([blob],NN.cfg.game+".png",{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text,url});return"shared"}
  if(navigator.share){await navigator.share({text,url});return"shared"}}catch(e){if(e&&e.name==="AbortError")return"cancel"}
 try{await navigator.clipboard.writeText(text+" "+url);return"copied"}catch(e){prompt("Copy your challenge link:",url);return"prompt"}};
// ---------- result modal
NN.end=({score,line,detail})=>{const p=NN.params(),hb=NN.cfg.higherIsBetter;NN.track("end",{score,vs:p.vs});
 let m=document.getElementById("nn-modal");if(!m){m=document.createElement("div");m.id="nn-modal";m.className="nn-modal";document.body.appendChild(m)}
 let vs="";if(p.vs!=null){const win=hb?score>p.vs:score<p.vs;vs='<div class="nn-chal">'+(win?"🏆 You beat the challenge ("+p.vs+")!":"Challenge: "+p.vs+" · not yet, run it back")+"</div>";NN.track("challenge_result",{win})}
 const rows=NN.board(score).map((r,i)=>'<tr class="'+(r.me?"me":"")+'"><td>#'+(i+1)+"</td><td>"+r.n+'</td><td style="text-align:right">'+r.s+"</td></tr>").join("");
 m.innerHTML='<div class="box"><div class="nn-sub">'+NN.cfg.title+'</div><div class="nn-big">'+score+'</div><div class="nn-sub">'+NN.cfg.unit+(detail?" · "+detail:"")+"</div>"+vs+
 '<div class="nn-row"><button class="nn-btn" id="nn-share">Challenge a friend</button><button class="nn-btn ghost" id="nn-again">Play again</button></div><div id="nn-msg" class="nn-sub"></div>'+
 '<h3 style="margin:12px 0 4px;font-size:14px">Today\'s board <span class="nn-sim">DEMO</span></h3><table class="nn-lb">'+rows+"</table></div>";
 m.classList.add("on");document.getElementById("nn-again").onclick=()=>{m.classList.remove("on");NN.track("restart");NN.onRestart&&NN.onRestart()};
 document.getElementById("nn-share").onclick=async()=>{const r=await NN.share(score,line);document.getElementById("nn-msg").textContent=r==="copied"?"Challenge link copied!":r==="shared"?"Shared!":""}};
// ---------- Net Forge economics panel (SIMULATION)
NN.forge=(el,c)=>{c=Object.assign({coin:"$GAME",supply:10e6,curveSupply:8e6,target:50000,tax:5,netnet:1,jar:20000,low:5000},c||{});
 const price=s=>c.target*2/c.curveSupply*(s/c.curveSupply); // linear curve, wsNET per coin; sum = target at curveSupply
 const sold=c.curveSupply*0.42,raised=c.target*Math.pow(sold/c.curveSupply,2),creator=c.tax-c.netnet-1;
 el.innerHTML='<h3>NET FORGE · '+c.coin+' <span class="nn-sim">SIMULATION</span></h3><p class="nn-sub" style="font-size:13px">How this cabinet\'s own coin <b>would</b> work on Net Forge. Nothing launched, illustrative numbers.</p>'+
 '<div class="nn-kv"><span>Max supply</span><b>'+(c.supply/1e6)+'M (hard cap)</b></div>'+
 '<div class="nn-kv"><span>Bonding curve (quoted in wsNET)</span><b>'+(sold/1e6).toFixed(2)+'M sold · '+Math.round(raised).toLocaleString()+' / '+c.target.toLocaleString()+' wsNET</b></div>'+
 '<div style="height:10px;background:#1b2944;border-radius:6px;overflow:hidden;margin:6px 0"><div style="height:100%;width:'+(raised/c.target*100).toFixed(1)+'%;background:var(--c)"></div></div>'+
 '<div class="nn-kv"><span>Spot price</span><b>'+price(sold).toFixed(6)+' wsNET</b></div>'+
 '<div class="nn-kv"><span>At graduation</span><b>50% → LP (burned) · 50% → 12h buyback & burn</b></div>'+
 '<div class="nn-kv"><span>Transfer tax (cap 5%)</span><b>'+c.tax+'%: NetNet '+c.netnet+'% · jar 1% · creator '+creator+'%</b></div>'+
 '<div class="nn-kv"><span>Reward jar (finite)</span><b>'+c.jar.toLocaleString()+' '+c.coin+' · refills from creator share below '+c.low.toLocaleString()+'</b></div>'+
 '<p class="nn-sub" style="font-size:12px;margin:8px 0 0">The split within the 5% cap besides NetNet\'s 1% is our assumption. Prizes pay from the jar only for skill scores. Not an offer, not financial advice.</p>'};
NN.footer=()=>{const f=document.createElement("footer");f.className="nn-foot";f.innerHTML='Prototype for the NetNet community &amp; devs, feedback welcome · Play money only · <a href="../">More cabinets</a>';document.body.appendChild(f)};
NN.boot=()=>{NN.track("view",{ref:document.referrer?new URL(document.referrer).host:"",challenge:NN.params().vs!=null});
 addEventListener("pagehide",()=>NN.track("leave",{ms:Math.round(performance.now())}))};
g.NN=NN;if(typeof module!=="undefined")module.exports=NN;
})(typeof window!=="undefined"?window:globalThis);
