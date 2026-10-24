/* NetNet aidunlap character pack v2 - an original cartoon mascot drawn 100% in code (no photos).
 Usage: NND.draw(ctx,x,y,h,{v:'dunlap',pose:'stand'|'run'|'win'|'fail'|'fly'|'flap',t:ms,flip:false})
 x,y = feet position, h = total height in px. Variants: dunlap, trader, banker, boss, bear.
 NND.hidpi(canvas) makes a fixed-size game canvas render crisp on retina screens (keeps logical width/height). */
(function(){
var C={k0:'#0a0a0a',k1:'#0d0d0d',ch:'#2a2a2a',gold:'#d4af37',lg:'#f5d77a',taupe:'#9a927c',white:'#f4f1ea',ink:'#07070a',skin:'#f2c9a5',skinS:'#d9a582'};
var V={
 dunlap:{suit:'#26262c',suitS:'#17171b',lapel:'#34343b',tie:'#0a0a0a',tieS:'#2a2a2a',shirt:C.white,pants:'#141417',hair:'slick',hc:'#0d0d0f',face:'smug',pocket:C.gold,skin:C.skin},
 trader:{suit:'#3a3a40',suitS:'#26262b',lapel:'#4a4a52',tie:C.gold,tieS:'#a8862a',shirt:'#dfe9f5',pants:'#2a2a2f',hair:'spiky',hc:'#6b4426',face:'grin',acc:'headset',skin:'#e8b892'},
 banker:{suit:'#6e6852',suitS:'#4f4a3a',lapel:'#857e64',tie:'#7a1f2b',tieS:'#561520',shirt:C.white,pants:'#4f4a3a',hair:'bald',hc:'#cfcac0',face:'glasses',acc:'bowtie',skin:'#f0c39f'},
 boss:{suit:'#1a1608',suitS:'#0d0b04',lapel:C.gold,tie:C.gold,tieS:'#a8862a',shirt:C.white,pants:'#120f05',hair:'silver',hc:'#e6e3dc',face:'beard',acc:'crown',pocket:C.lg,skin:'#eec29c'},
 bear:{suit:'#3a1414',suitS:'#260b0b',lapel:'#4e1c1c',tie:'#ff5f6d',tieS:'#c23a48',shirt:'#e5ddd0',pants:'#260b0b',hair:'bear',hc:'#6b3f24',face:'bear',skin:'#8a5634'}};
var ready=Promise.resolve();
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function draw(c,x,y,h,o){o=o||{};var v=V[o.v||'dunlap']||V.dunlap,t=(o.t||0)/1000,pose=o.pose||'stand',u=h/100,L=Math.max(1,2.4*u);
 function fs(f){c.fillStyle=f;c.fill();c.strokeStyle=C.ink;c.lineWidth=L;c.stroke()}
 c.save();c.translate(x,y);if(o.flip)c.scale(-1,1);c.lineCap='round';c.lineJoin='round';
 // ground shadow
 if(pose!=='fly'&&pose!=='flap'){c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(0,0,20*u,3.5*u,0,0,7);c.fill()}
 var ph=t*(pose==='run'?13:2),sw=pose==='run'?Math.sin(ph):0,bob=0,tilt=0;
 if(pose==='stand')bob=Math.sin(t*2.4)*0.8*u;
 if(pose==='run'){bob=-Math.abs(Math.sin(ph))*3*u;tilt=0.08}
 if(pose==='win')bob=-Math.abs(Math.sin(t*7))*6*u;
 if(pose==='fail')tilt=-0.35;
 if(pose==='fly'||pose==='flap'){tilt=0.12;bob=Math.sin(t*5)*1.5*u}
 c.translate(0,bob);c.translate(0,-22*u);c.rotate(tilt);c.translate(0,22*u);
 // legs
 function leg(sx,a){c.save();c.translate(sx,-24*u);c.rotate(a);rr(c,-4.6*u,-1*u,9.2*u,21*u,4*u);fs(v.pants);
  c.beginPath();c.ellipse(2.2*u,21*u,7*u,3.6*u,0,0,7);fs(C.k0);c.fillStyle='rgba(255,255,255,.25)';c.beginPath();c.ellipse(3.5*u,19.8*u,3*u,1*u,0,0,7);c.fill();c.restore()}
 var la=sw*0.7,ra=-sw*0.7;if(pose==='fly'||pose==='flap'){la=0.5;ra=0.25}if(pose==='win'){la=-0.12;ra=0.12}
 leg(-5.5*u,la);leg(5.5*u,ra);
 // arms
 var fA=0.25,bA=-0.25;
 if(pose==='run'){fA=-sw*1.0;bA=sw*1.0}
 if(pose==='win'){fA=-2.7+Math.sin(t*7)*0.15;bA=2.7-Math.sin(t*7)*0.15}
 if(pose==='fail'){fA=-1.9;bA=1.9}
 if(pose==='fly'){fA=-1.35;bA=1.2}
 if(pose==='flap'){var fl=Math.sin(t*16);fA=-1.2-fl*0.7;bA=1.2+fl*0.7}
 function arm(sx,a,front){c.save();c.translate(sx,-45*u);c.rotate(a);rr(c,-4*u,-2*u,8*u,19*u,4*u);fs(front?v.suit:v.suitS);
  c.fillStyle=v.shirt;c.fillRect(-3.4*u,15.5*u,6.8*u,2.6*u);if(v.pocket){c.fillStyle=C.gold;c.fillRect(-1*u,15.8*u,2*u,2*u)}
  c.beginPath();c.arc(0,21*u,4*u,0,7);fs(v.face==='bear'?v.skin:v.skin);c.restore()}
 arm(-11*u,bA,false);
 // torso
 c.beginPath();c.moveTo(-12*u,-48*u);c.quadraticCurveTo(-14*u,-30*u,-13*u,-21*u);c.quadraticCurveTo(0,-18*u,13*u,-21*u);c.quadraticCurveTo(14*u,-30*u,12*u,-48*u);c.quadraticCurveTo(0,-51*u,-12*u,-48*u);c.closePath();fs(v.suit);
 c.save();c.clip();c.fillStyle=v.suitS;c.fillRect(-14*u,-52*u,7*u,34*u);c.restore();
 // shirt V + tie
 c.beginPath();c.moveTo(-6.5*u,-49.5*u);c.lineTo(6.5*u,-49.5*u);c.lineTo(0,-33*u);c.closePath();fs(v.shirt);
 if(v.acc==='bowtie'){c.beginPath();c.moveTo(0,-46*u);c.lineTo(-6*u,-49.5*u);c.lineTo(-6*u,-42.5*u);c.closePath();c.moveTo(0,-46*u);c.lineTo(6*u,-49.5*u);c.lineTo(6*u,-42.5*u);c.closePath();fs(v.tie);c.beginPath();c.arc(0,-46*u,1.8*u,0,7);fs(v.tieS)}
 else{c.beginPath();c.moveTo(-2.2*u,-48.5*u);c.lineTo(2.2*u,-48.5*u);c.lineTo(1.4*u,-45.5*u);c.lineTo(3.2*u,-33*u);c.lineTo(0,-29.5*u);c.lineTo(-3.2*u,-33*u);c.lineTo(-1.4*u,-45.5*u);c.closePath();fs(v.tie);
  if(v.o!=='x'){c.strokeStyle=v.tieS;c.lineWidth=0.9*u;c.beginPath();c.moveTo(-1.6*u,-41*u);c.lineTo(2*u,-38*u);c.moveTo(-2.2*u,-36*u);c.lineTo(2.4*u,-33*u);c.stroke()}
  if(o.v==='dunlap'||!o.v){c.fillStyle=C.gold;c.fillRect(-3*u,-40.5*u,6*u,1.3*u)}}
 // lapels
 c.beginPath();c.moveTo(-7*u,-49.5*u);c.lineTo(-10.5*u,-43*u);c.lineTo(-7*u,-41.5*u);c.lineTo(-0.6*u,-30*u);c.closePath();fs(v.lapel);
 c.beginPath();c.moveTo(7*u,-49.5*u);c.lineTo(10.5*u,-43*u);c.lineTo(7*u,-41.5*u);c.lineTo(0.6*u,-30*u);c.closePath();fs(v.lapel);
 // buttons / pocket square / badge
 c.fillStyle=C.gold;c.beginPath();c.arc(0,-25.5*u,1.3*u,0,7);c.fill();
 if(v.pocket){c.beginPath();c.moveTo(5.5*u,-38*u);c.lineTo(10*u,-38*u);c.lineTo(9*u,-41.5*u);c.lineTo(7.8*u,-39.5*u);c.lineTo(6.6*u,-41.5*u);c.closePath();c.fillStyle=v.pocket;c.fill()}
 if(o.v==='trader'){rr(c,5*u,-39*u,6*u,4.2*u,1*u);fs(C.gold)}
 arm(11*u,fA,true);
 // HEAD
 c.save();c.translate(0,-67*u);var ht=pose==='fail'?-0.15:(pose==='win'?0.06*Math.sin(t*7):Math.sin(t*1.6)*0.03);c.rotate(ht);
 var HR=19*u;
 if(v.face==='bear'){ // bear head
  c.beginPath();c.arc(-13*u,-14*u,6*u,0,7);fs(v.hc);c.beginPath();c.arc(13*u,-14*u,6*u,0,7);fs(v.hc);
  c.fillStyle='#c48a6a';c.beginPath();c.arc(-13*u,-14*u,3*u,0,7);c.arc(13*u,-14*u,3*u,0,7);c.fill();
  c.beginPath();c.ellipse(0,0,HR*1.05,HR*0.95,0,0,7);fs(v.hc);
  c.beginPath();c.ellipse(0,6*u,9*u,6.5*u,0,0,7);fs('#c9a080');
  c.beginPath();c.ellipse(0,3*u,3.4*u,2.4*u,0,0,7);c.fillStyle=C.ink;c.fill();
  c.strokeStyle=C.ink;c.lineWidth=L*0.8;c.beginPath();c.moveTo(0,5*u);c.lineTo(0,8*u);c.moveTo(-3.5*u,10*u);c.quadraticCurveTo(0,7.5*u,3.5*u,10*u);c.stroke();
  // angry brows + eyes
  c.fillStyle=C.ink;c.beginPath();c.arc(-7*u,-3*u,2*u,0,7);c.arc(7*u,-3*u,2*u,0,7);c.fill();
  c.lineWidth=L*1.1;c.beginPath();c.moveTo(-11*u,-9*u);c.lineTo(-4*u,-6*u);c.moveTo(11*u,-9*u);c.lineTo(4*u,-6*u);c.stroke();
  c.restore();c.restore();return}
 // ears
 c.beginPath();c.ellipse(-HR*0.98,2*u,3.4*u,4.6*u,0,0,7);fs(v.skin);c.beginPath();c.ellipse(HR*0.98,2*u,3.4*u,4.6*u,0,0,7);fs(v.skin);
 // face
 c.beginPath();c.moveTo(-HR*0.95,-6*u);c.bezierCurveTo(-HR*1.02,10*u,-9*u,HR*1.0,0,HR*1.0);c.bezierCurveTo(9*u,HR*1.0,HR*1.02,10*u,HR*0.95,-6*u);c.bezierCurveTo(HR*0.9,-HR*1.05,-HR*0.9,-HR*1.05,-HR*0.95,-6*u);c.closePath();fs(v.skin);
 c.save();c.clip();c.fillStyle='rgba(120,60,30,.12)';c.beginPath();c.ellipse(-HR*0.9,4*u,7*u,HR,0,0,7);c.fill();c.restore();
 // cheeks
 c.fillStyle='rgba(230,120,100,.22)';c.beginPath();c.ellipse(-10*u,7*u,3.6*u,2.2*u,0,0,7);c.ellipse(10*u,7*u,3.6*u,2.2*u,0,0,7);c.fill();
 // hair
 c.lineWidth=L;c.strokeStyle=C.ink;
 if(v.hair==='slick'){
  c.beginPath();c.moveTo(-HR*1.0,-1*u);c.bezierCurveTo(-HR*1.2,-HR*1.5,HR*0.7,-HR*1.65,HR*1.04,-6*u);c.bezierCurveTo(HR*0.95,-HR*0.55,HR*0.3,-HR*0.75,-4*u,-HR*0.62);c.bezierCurveTo(-10*u,-HR*0.55,-HR*0.8,-8*u,-HR*0.86,0);c.closePath();fs(v.hc);
  c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=1.1*u;c.beginPath();c.moveTo(-12*u,-HR*0.75);c.quadraticCurveTo(0,-HR*1.3,14*u,-HR*0.7);c.moveTo(-9*u,-HR*0.62);c.quadraticCurveTo(2*u,-HR*1.05,13*u,-HR*0.5);c.moveTo(-14*u,-HR*0.5);c.quadraticCurveTo(-6*u,-HR*1.25,6*u,-HR*1.2);c.stroke();
  c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(-3*u,-HR*0.98,6*u,1.4*u,-0.15,0,7);c.fill()}
 else if(v.hair==='spiky'){c.beginPath();c.moveTo(-HR,0);var sp=[[-21,-12],[-16,-19],[-15,-27],[-7,-22],[-2,-30],[3,-22],[9,-28],[11,-19],[18,-20],[19,-8],[19,0]];c.lineTo(-18*u,-6*u);for(var i=0;i<sp.length;i++)c.lineTo(sp[i][0]*u,sp[i][1]*u);c.quadraticCurveTo(10*u,-12*u,-11*u,-9*u);c.closePath();fs(v.hc)}
 else if(v.hair==='bald'){c.beginPath();c.ellipse(-HR*0.88,-3*u,4.5*u,8*u,0.2,0,7);fs(v.hc);c.beginPath();c.ellipse(HR*0.88,-3*u,4.5*u,8*u,-0.2,0,7);fs(v.hc);
  c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.ellipse(-4*u,-HR*0.75,5*u,2*u,-0.3,0,7);c.fill()}
 else if(v.hair==='silver'){c.beginPath();c.moveTo(-HR*1.0,0);c.bezierCurveTo(-HR*1.1,-HR*1.3,HR*1.1,-HR*1.3,HR*1.0,0);c.bezierCurveTo(HR*0.8,-HR*0.6,-HR*0.8,-HR*0.6,-HR*1.0,0);c.closePath();fs(v.hc);
  c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1*u;c.beginPath();c.moveTo(-8*u,-HR*0.85);c.quadraticCurveTo(0,-HR*1.05,8*u,-HR*0.85);c.stroke()}
 // face features
 c.strokeStyle=C.ink;c.fillStyle=C.ink;var ex=6.8*u,ey=1*u;
 var blink=(pose==='stand'&&(t%3.7)<0.12);
 if(pose==='fail'){c.lineWidth=L;[-ex,ex].forEach(function(e){c.beginPath();c.moveTo(e-2.4*u,ey-2.4*u);c.lineTo(e+2.4*u,ey+2.4*u);c.moveTo(e+2.4*u,ey-2.4*u);c.lineTo(e-2.4*u,ey+2.4*u);c.stroke()});
  c.beginPath();c.ellipse(0,11*u,3*u,2.4*u,0,0,7);c.fill()}
 else{
  if(blink){c.lineWidth=L;c.beginPath();c.moveTo(-ex-2.6*u,ey);c.lineTo(-ex+2.6*u,ey);c.moveTo(ex-2.6*u,ey);c.lineTo(ex+2.6*u,ey);c.stroke()}
  else{[-ex,ex].forEach(function(e){c.fillStyle='#fff';c.beginPath();c.ellipse(e,ey,3*u,3.2*u,0,0,7);c.fill();c.fillStyle=C.ink;c.beginPath();c.arc(e+0.6*u,ey+0.5*u,1.9*u,0,7);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(e+1.3*u,ey-0.4*u,0.7*u,0,7);c.fill()});
   if(v.face==='smug'||v.face==='beard'){ // heavy half-lids = the calm, unflappable look
    c.fillStyle=v.skin;[-ex,ex].forEach(function(e){c.beginPath();c.rect(e-3.6*u,ey-4*u,7.2*u,3.6*u);c.fill()});
    c.lineWidth=L;c.beginPath();c.moveTo(-ex-3.2*u,ey-0.5*u);c.lineTo(-ex+3*u,ey-0.3*u);c.moveTo(ex-3*u,ey-0.3*u);c.lineTo(ex+3.2*u,ey-0.5*u);c.stroke()}}
  // brows
  c.lineWidth=L*1.15;c.strokeStyle=v.hair==='silver'||v.hair==='bald'?'#8d877c':C.ink;c.beginPath();
  if(v.face==='smug'){c.moveTo(-ex-3.5*u,-4.5*u);c.lineTo(-ex+3*u,-4*u);c.moveTo(ex-3*u,-5*u);c.quadraticCurveTo(ex+1*u,-7.5*u,ex+3.8*u,-6*u)}
  else{c.moveTo(-ex-3*u,-5.5*u);c.quadraticCurveTo(-ex,-7*u,-ex+3*u,-5.5*u);c.moveTo(ex-3*u,-5.5*u);c.quadraticCurveTo(ex,-7*u,ex+3*u,-5.5*u)}c.stroke();
  // glasses
  if(v.face==='glasses'){c.strokeStyle=C.gold;c.lineWidth=1.3*u;c.beginPath();c.arc(-ex,ey,4.4*u,0,7);c.moveTo(ex+4.4*u,ey);c.arc(ex,ey,4.4*u,0,7);c.moveTo(-ex+4.4*u,ey);c.lineTo(ex-4.4*u,ey);c.stroke();
   c.fillStyle='#8d877c';c.beginPath();c.moveTo(-6*u,9*u);c.quadraticCurveTo(0,6*u,6*u,9*u);c.quadraticCurveTo(0,11*u,-6*u,9*u);c.fill()}
  // mouth
  c.strokeStyle=C.ink;c.lineWidth=L*0.9;c.beginPath();
  if(pose==='win'||v.face==='grin'){c.moveTo(-5*u,10*u);c.quadraticCurveTo(0,16*u,5*u,10*u);c.closePath();c.fillStyle='#fff';c.fill();c.stroke()}
  else if(v.face==='smug'){c.moveTo(-4.5*u,11.5*u);c.quadraticCurveTo(1*u,12.8*u,5.5*u,9.5*u);c.stroke()}
  else if(v.face==='beard'){}
  else{c.moveTo(-3*u,11*u);c.quadraticCurveTo(0,12.5*u,3*u,11*u);c.stroke()}
  if(v.face==='beard'){c.beginPath();c.moveTo(-HR*0.9,4*u);c.bezierCurveTo(-HR*0.8,HR*1.2,HR*0.8,HR*1.2,HR*0.9,4*u);c.bezierCurveTo(HR*0.5,10*u,-HR*0.5,10*u,-HR*0.9,4*u);c.closePath();fs(v.hc);
   c.strokeStyle=C.ink;c.lineWidth=L*0.8;c.beginPath();c.moveTo(-3.5*u,11*u);c.quadraticCurveTo(1*u,12.5*u,4.5*u,10*u);c.stroke()}
 }
 // nose
 c.strokeStyle='rgba(120,60,30,.55)';c.lineWidth=1.2*u;c.beginPath();c.moveTo(0.5*u,3*u);c.quadraticCurveTo(2.2*u,6.5*u,-0.5*u,7*u);c.stroke();
 // accessories
 if(v.acc==='crown'){c.beginPath();c.moveTo(-10*u,-HR*0.92);c.lineTo(-11*u,-HR*1.45);c.lineTo(-5*u,-HR*1.12);c.lineTo(0,-HR*1.6);c.lineTo(5*u,-HR*1.12);c.lineTo(11*u,-HR*1.45);c.lineTo(10*u,-HR*0.92);c.closePath();fs(C.gold);
  c.fillStyle='#ff5f6d';c.beginPath();c.arc(0,-HR*1.1,1.5*u,0,7);c.fill();c.fillStyle=C.lg;c.fillRect(-9*u,-HR*1.02,18*u,1.2*u)}
 if(v.acc==='headset'){c.strokeStyle=C.ink;c.lineWidth=L*1.2;c.beginPath();c.arc(0,-2*u,HR*1.08,Math.PI*1.08,Math.PI*1.92);c.stroke();rr(c,-HR*1.2,-3*u,5*u,8*u,2*u);fs(C.ch);rr(c,HR*1.2-5*u,-3*u,5*u,8*u,2*u);fs(C.ch);
  c.strokeStyle=C.ch;c.lineWidth=1.3*u;c.beginPath();c.moveTo(-HR*1.1,4*u);c.quadraticCurveTo(-HR*0.9,13*u,-5*u,12*u);c.stroke();c.fillStyle=C.gold;c.beginPath();c.arc(-5*u,12*u,1.5*u,0,7);c.fill()}
 c.restore();c.restore()}
function panel(c,W,H,t1,t2){c.save();c.fillStyle='rgba(6,6,8,.72)';c.fillRect(0,0,W,H);
 var f="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",ts=Math.max(18,Math.min(30,W/18));c.font='800 '+ts+'px '+f;var tw=c.measureText(t1).width;c.font='500 '+Math.round(ts*0.5)+'px '+f;var sw=c.measureText(t2||'').width;
 var w=Math.min(W-24,Math.max(tw,sw)+56),h=ts*2.9,x=(W-w)/2,y=(H-h)/2;rr(c,x,y,w,h,14);var g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#1a1a1d');g.addColorStop(1,'#0e0e10');c.fillStyle=g;c.fill();c.strokeStyle='rgba(212,175,55,.7)';c.lineWidth=1.5;c.stroke();
 c.fillStyle=C.gold;c.fillRect(W/2-18,y+10,36,2);c.textAlign='center';c.textBaseline='middle';c.font='800 '+ts+'px '+f;var tg=c.createLinearGradient(0,y+h*0.25,0,y+h*0.55);tg.addColorStop(0,C.lg);tg.addColorStop(1,C.gold);c.fillStyle=tg;c.fillText(t1,W/2,y+h*0.42,w-24);
 c.font='500 '+Math.round(ts*0.5)+'px '+f;c.fillStyle=C.taupe;c.fillText(t2||'',W/2,y+h*0.74,w-24);c.restore()}
function badge(c,x,y,r,kind){ // RWA token icons, all drawn
 var K={gold:[C.gold,'Au'],tbill:['#9fc8a8','T'],estate:['#c9b48a','RE'],stock:['#8fb4e0','EQ'],net:[C.lg,'N'],dump:['#ff5f6d','▼']}[kind]||[C.taupe,'?'];
 c.save();c.translate(x,y);c.lineJoin='round';
 if(kind==='gold'){c.beginPath();c.moveTo(-r,r*0.5);c.lineTo(r,r*0.5);c.lineTo(r*0.65,-r*0.5);c.lineTo(-r*0.65,-r*0.5);c.closePath();var gr=c.createLinearGradient(0,-r*0.5,0,r*0.5);gr.addColorStop(0,C.lg);gr.addColorStop(1,'#a8862a');c.fillStyle=gr;c.fill();c.strokeStyle='rgba(60,40,0,.7)';c.lineWidth=Math.max(1,r*0.1);c.stroke();c.fillStyle='rgba(255,255,255,.45)';c.fillRect(-r*0.45,-r*0.35,r*0.9,r*0.14)}
 else{var g2=c.createRadialGradient(-r*0.35,-r*0.35,r*0.1,0,0,r);g2.addColorStop(0,'#fff');g2.addColorStop(0.25,K[0]);g2.addColorStop(1,K[0]);c.fillStyle=g2;c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=Math.max(1,r*0.12);c.stroke();
  c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=Math.max(0.6,r*0.06);c.beginPath();c.arc(0,0,r*0.78,0,7);c.stroke();
  c.fillStyle='#0a0a0a';c.font='800 '+Math.round(r*(K[1].length>1?0.8:1.1))+'px system-ui,-apple-system,Segoe UI,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(K[1],0,r*0.06)}
 c.restore()}
function avatar(size,v){var d=Math.min(2,window.devicePixelRatio||1),cv=document.createElement('canvas');cv.width=cv.height=size*d;cv.style.width=cv.style.height=size+'px';var c=cv.getContext('2d');c.scale(d,d);draw(c,size/2,size*0.98,size*0.95,{v:v});return cv}
function hidpi(cv){var d=Math.min(2,window.devicePixelRatio||1);if(d<=1||cv._nnd)return cv;var W=cv.width,H=cv.height,P=HTMLCanvasElement.prototype,wd=Object.getOwnPropertyDescriptor(P,'width'),hd=Object.getOwnPropertyDescriptor(P,'height');
 wd.set.call(cv,Math.round(W*d));hd.set.call(cv,Math.round(H*d));cv._nnd=d;
 Object.defineProperty(cv,'width',{get:function(){return W},set:function(n){W=n;wd.set.call(cv,Math.round(n*d));fix()},configurable:true});
 Object.defineProperty(cv,'height',{get:function(){return H},set:function(n){H=n;hd.set.call(cv,Math.round(n*d));fix()},configurable:true});
 var ctx=cv.getContext('2d'),st=ctx.setTransform.bind(ctx),rs=ctx.resetTransform&&ctx.resetTransform.bind(ctx);
 ctx.setTransform=function(a,b,cc,dd,e,f){if(typeof a==='object')return st(a);st(a*d,b*d,cc*d,dd*d,e*d,f*d)};ctx.resetTransform=function(){st(d,0,0,d,0,0)};
 function fix(){st(d,0,0,d,0,0);ctx.imageSmoothingQuality='high'}fix();return cv}
window.NND={ready:ready,draw:draw,badge:badge,avatar:avatar,hidpi:hidpi,panel:panel,colors:C,variants:Object.keys(V),poses:['stand','run','win','fail','fly','flap']};
})();
