/* Aidunlap Snowball · original Three.js chase-cam renderer (NetNet).
 * Genre inspiration only. No third-party models/textures/code.
 * Procedural snow / trees / rocks / cottages / vault. Three.js MIT (vendor/).
 */
(function (W) {
  'use strict';
  var T = W.THREE;
  if (!T) { W.SB3D = { ok: false, err: 'no THREE' }; return; }

  function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  function makeNoiseTex(size, seed, soft) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d'), img = ctx.createImageData(size, size), r = mulberry(seed|1);
    for (var i = 0; i < img.data.length; i += 4) {
      var n = soft ? (190 + r() * 55 + ((i>>2)%17)*0.4) : (r() * 255);
      img.data[i] = img.data[i+1] = img.data[i+2] = Math.min(255, n|0); img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 8; return tex;
  }

  function makeSnowNormal(size, seed) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d'), img = ctx.createImageData(size, size), r = mulberry(seed|7);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var i = (y * size + x) * 4;
      var nx = 128 + (r() - 0.5) * 70 + Math.sin(x*0.35)*8, ny = 128 + (r() - 0.5) * 70 + Math.cos(y*0.35)*8;
      img.data[i] = nx; img.data[i+1] = ny; img.data[i+2] = 220 + r()*35; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 8; return tex;
  }

  function makeSparkleTex(size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d'); ctx.clearRect(0,0,size,size);
    var r = mulberry(4242);
    for (var i = 0; i < 90; i++) {
      var x = r()*size, y = r()*size, rad = 0.6 + r()*1.8;
      var g = ctx.createRadialGradient(x,y,0,x,y,rad*3);
      g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.4,'rgba(200,230,255,0.35)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,rad*3,0,7); ctx.fill();
    }
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; return tex;
  }

  function buildAidunlap(scale) {
    var g = new T.Group();
    var skin = new T.MeshStandardMaterial({ color: 0xf2c9a5, roughness: 0.55 });
    var suit = new T.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.45, metalness: 0.2 });
    var suitS = new T.MeshStandardMaterial({ color: 0x121216, roughness: 0.5 });
    var hair = new T.MeshStandardMaterial({ color: 0x08080a, roughness: 0.35, metalness: 0.1 });
    var tie = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.45 });
    var gold = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.22 });
    var shirt = new T.MeshStandardMaterial({ color: 0xf7f3ec, roughness: 0.65 });
    function box(mat, w, h, d, x, y, z, rx, ry) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry;
      m.castShadow = true; g.add(m); return m;
    }
    box(suitS, 0.17*scale, 0.48*scale, 0.17*scale, -0.11*scale, 0.24*scale, 0);
    box(suitS, 0.17*scale, 0.48*scale, 0.17*scale, 0.11*scale, 0.24*scale, 0);
    box(suitS, 0.2*scale, 0.08*scale, 0.28*scale, -0.11*scale, 0.02*scale, 0.04*scale);
    box(suitS, 0.2*scale, 0.08*scale, 0.28*scale, 0.11*scale, 0.02*scale, 0.04*scale);
    box(suit, 0.44*scale, 0.58*scale, 0.26*scale, 0, 0.74*scale, 0);
    box(shirt, 0.18*scale, 0.3*scale, 0.05*scale, 0, 0.8*scale, 0.14*scale);
    box(tie, 0.07*scale, 0.3*scale, 0.04*scale, 0, 0.76*scale, 0.16*scale);
    box(gold, 0.13*scale, 0.035*scale, 0.035*scale, 0, 0.92*scale, 0.16*scale);
    var armL = box(suit, 0.12*scale, 0.44*scale, 0.12*scale, -0.32*scale, 0.72*scale, 0.02*scale, 0.35, 0);
    var armR = box(suit, 0.12*scale, 0.44*scale, 0.12*scale, 0.32*scale, 0.72*scale, 0.02*scale, 0.35, 0);
    g.userData.arms = [armL, armR];
    var head = new T.Mesh(new T.SphereGeometry(0.21*scale, 20, 14), skin);
    head.position.set(0, 1.18*scale, 0.02*scale); head.castShadow = true; g.add(head);
    var hairM = new T.Mesh(new T.SphereGeometry(0.225*scale, 18, 12, 0, Math.PI*2, 0, Math.PI*0.58), hair);
    hairM.position.set(0, 1.23*scale, -0.02*scale); hairM.scale.set(1.05, 0.95, 1.1); g.add(hairM);
    var slick = new T.Mesh(new T.BoxGeometry(0.3*scale, 0.04*scale, 0.12*scale), hair);
    slick.position.set(0, 1.28*scale, 0.12*scale); slick.rotation.x = -0.35; g.add(slick);
    box(hair, 0.26*scale, 0.028*scale, 0.05*scale, 0, 1.22*scale, 0.19*scale);
    var eyeM = new T.MeshStandardMaterial({ color: 0x111114, roughness: 0.3 });
    box(eyeM, 0.04*scale, 0.03*scale, 0.02*scale, -0.07*scale, 1.18*scale, 0.2*scale);
    box(eyeM, 0.04*scale, 0.03*scale, 0.02*scale, 0.07*scale, 1.18*scale, 0.2*scale);
    var smirk = new T.Mesh(new T.TorusGeometry(0.05*scale, 0.008*scale, 6, 10, Math.PI), new T.MeshStandardMaterial({ color: 0xb07060, roughness: 0.5 }));
    smirk.position.set(0.02*scale, 1.1*scale, 0.2*scale); smirk.rotation.x = Math.PI; smirk.rotation.z = -0.2; g.add(smirk);
    g.userData.scale = scale;
    return g;
  }

  function buildTree(rng, quality) {
    var g = new T.Group();
    var trunk = new T.Mesh(new T.CylinderGeometry(0.1, 0.16, 1.15, quality > 1 ? 8 : 5),
      new T.MeshStandardMaterial({ color: 0x3d2918, roughness: 0.92 }));
    trunk.position.y = 0.55; trunk.castShadow = true; g.add(trunk);
    var green = new T.MeshStandardMaterial({ color: 0x163528, roughness: 0.82 });
    var snowTip = new T.MeshStandardMaterial({ color: 0xeef5fc, roughness: 0.65, metalness: 0.05 });
    for (var i = 0; i < 4; i++) {
      var cone = new T.Mesh(new T.ConeGeometry(1.15 - i * 0.22, 1.35 - i * 0.12, quality > 1 ? 11 : 6), green);
      cone.position.y = 1.15 + i * 0.72; cone.castShadow = true; g.add(cone);
      var cap = new T.Mesh(new T.ConeGeometry(0.9 - i * 0.18, 0.22, quality > 1 ? 8 : 5), snowTip);
      cap.position.y = 1.7 + i * 0.72; g.add(cap);
    }
    g.scale.setScalar(0.65 + rng() * 1.05);
    g.rotation.y = rng() * 6.28;
    return g;
  }

  function buildRock(rng) {
    var geo = new T.IcosahedronGeometry(0.35 + rng() * 0.55, 0);
    var mat = new T.MeshStandardMaterial({ color: 0x5e6874, roughness: 0.95, flatShading: true });
    var m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    m.scale.set(0.75 + rng(), 0.45 + rng() * 0.55, 0.75 + rng());
    m.rotation.set(rng(), rng() * 6, rng());
    return m;
  }

  function buildCottage(rng, quality) {
    var g = new T.Group();
    var wood = new T.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.85 });
    var snowR = new T.MeshStandardMaterial({ color: 0xe8f0fa, roughness: 0.7 });
    var warm = new T.MeshStandardMaterial({ color: 0xffd090, emissive: 0xffa040, emissiveIntensity: 1.4, roughness: 0.4 });
    var body = new T.Mesh(new T.BoxGeometry(2.2, 1.4, 1.8), wood); body.position.y = 0.7; body.castShadow = true; body.receiveShadow = true; g.add(body);
    var roof = new T.Mesh(new T.ConeGeometry(1.7, 1.1, 4), snowR); roof.position.y = 1.9; roof.rotation.y = Math.PI/4; roof.castShadow = true; g.add(roof);
    var win = new T.Mesh(new T.BoxGeometry(0.45, 0.4, 0.05), warm); win.position.set(0, 0.85, 0.92); g.add(win);
    var win2 = win.clone(); win2.position.set(-0.55, 0.85, 0.92); g.add(win2);
    var win3 = win.clone(); win3.position.set(0.55, 0.85, 0.92); g.add(win3);
    if (quality > 0) {
      var pl = new T.PointLight(0xffb060, 0.7, 10, 2); pl.position.set(0, 1.0, 1.2); g.add(pl);
    }
    g.scale.setScalar(0.7 + rng() * 0.5);
    g.rotation.y = (rng() < 0.5 ? 0 : Math.PI) + (rng()-0.5)*0.2;
    return g;
  }

  function create(canvas, opts) {
    opts = opts || {};
    var quality = opts.quality == null ? ( /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 0 : 2 ) : opts.quality;
    var dprCap = quality === 0 ? 1.2 : quality === 1 ? 1.6 : 2;
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: quality > 0, powerPreference: 'high-performance', alpha: false, failIfMajorPerformanceCaveat: false });
    } catch (e) { return { ok: false, err: String(e) }; }
    renderer.setClearColor(0x040712);
    renderer.shadowMap.enabled = quality > 0;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    var scene = new T.Scene();
    scene.fog = new T.FogExp2(0x081428, 0.014);

    var camera = new T.PerspectiveCamera(55, 16 / 9, 0.15, 320);
    camera.position.set(0, 5, -9);

    var hemi = new T.HemisphereLight(0xa8d4ff, 0x121820, 0.5); scene.add(hemi);
    var sun = new T.DirectionalLight(0xd8ebff, 1.35); sun.position.set(-18, 42, 8);
    sun.castShadow = quality > 0;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
      sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
      sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
      sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02;
    }
    scene.add(sun); scene.add(sun.target);
    var moonL = new T.DirectionalLight(0x7a9dff, 0.4); moonL.position.set(28, 22, -18); scene.add(moonL);
    var ambFill = new T.AmbientLight(0x1a2438, 0.25); scene.add(ambFill);

    // sky dome
    var skyGeo = new T.SphereGeometry(280, 32, 16);
    var skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { top: { value: new T.Color(0x02060f) }, mid: { value: new T.Color(0x0a1a38) }, bot: { value: new T.Color(0x152848) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=normalize(vP).y*0.5+0.5; vec3 c=mix(bot,mid,smoothstep(0.0,0.45,h)); c=mix(c,top,smoothstep(0.45,1.0,h)); gl_FragColor=vec4(c,1.0); }'
    });
    scene.add(new T.Mesh(skyGeo, skyMat));

    // stars
    var starN = quality === 0 ? 200 : 600;
    var starPos = new Float32Array(starN * 3);
    var sr = mulberry(77);
    for (var si = 0; si < starN; si++) {
      var th = sr() * Math.PI * 2, ph = sr() * 0.9;
      starPos[si*3] = Math.sin(th) * Math.cos(ph) * 240;
      starPos[si*3+1] = 40 + Math.sin(ph) * 180;
      starPos[si*3+2] = Math.cos(th) * Math.cos(ph) * 240;
    }
    var starGeo = new T.BufferGeometry(); starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false })));

    // aurora ribbons
    function auroraRibbon(col, op, y, z, rotZ) {
      var m = new T.Mesh(new T.PlaneGeometry(260, 55, 1, 1), new T.MeshBasicMaterial({
        color: col, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending
      }));
      m.position.set(0, y, z); m.rotation.x = 0.12; m.rotation.z = rotZ || 0; scene.add(m); return m;
    }
    var aurora = auroraRibbon(0x2cff88, 0.2, 42, 90, 0.08);
    var aurora2 = auroraRibbon(0x2ad8ff, 0.14, 48, 110, -0.12);
    var aurora3 = auroraRibbon(0x88ffcc, 0.1, 36, 70, 0.2);

    // moon
    var moonMesh = new T.Mesh(new T.SphereGeometry(5.2, 28, 20), new T.MeshBasicMaterial({ color: 0xeef2fa }));
    moonMesh.position.set(48, 52, 110); scene.add(moonMesh);
    var moonGlow = new T.Mesh(new T.SphereGeometry(7.5, 16, 12), new T.MeshBasicMaterial({ color: 0xaabbff, transparent: true, opacity: 0.12, depthWrite: false }));
    moonGlow.position.copy(moonMesh.position); scene.add(moonGlow);

    // snow ground
    var snowMap = makeNoiseTex(512, 42, true); snowMap.repeat.set(48, 100);
    var snowN = makeSnowNormal(512, 99); snowN.repeat.set(48, 100);
    var groundMat = new T.MeshStandardMaterial({
      color: 0xeaf3ff, map: snowMap, normalMap: snowN, normalScale: new T.Vector2(0.7, 0.7),
      roughness: 0.78, metalness: 0.04, envMapIntensity: 0.4
    });
    var gSegW = quality > 1 ? 100 : (quality > 0 ? 60 : 36);
    var gSegL = quality > 1 ? 240 : (quality > 0 ? 140 : 80);
    var ground = new T.Mesh(new T.PlaneGeometry(90, 420, gSegW, gSegL), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 140); ground.receiveShadow = true;
    var pos = ground.geometry.attributes.position;
    var rg = mulberry(1234);
    for (var gi = 0; gi < pos.count; gi++) {
      var gx = pos.getX(gi), gz = pos.getY(gi);
      var h = Math.sin(gx * 0.12) * 0.4 + Math.cos(gz * 0.07) * 0.55 + Math.sin(gx*0.4+gz*0.2)*0.12 + (rg() - 0.5) * 0.12;
      if (Math.abs(gx) < 5.5) h *= 0.25; // flatter avenue
      pos.setZ(gi, h);
    }
    ground.geometry.computeVertexNormals();
    scene.add(ground);

    // sparkle overlay on snow
    var sparkTex = makeSparkleTex(128);
    sparkTex.repeat.set(30, 60);
    var sparkle = new T.Mesh(new T.PlaneGeometry(70, 300), new T.MeshBasicMaterial({
      map: sparkTex, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending
    }));
    sparkle.rotation.x = -Math.PI / 2; sparkle.position.set(0, 0.06, 100); scene.add(sparkle);

    // trail ribbon with groove
    var trailSeg = quality > 0 ? 48 : 24;
    var trailGeo = new T.PlaneGeometry(2.8, 70, 4, trailSeg);
    var trailMat = new T.MeshStandardMaterial({ color: 0xb8c8dc, roughness: 0.95, metalness: 0.02, transparent: true, opacity: 0.9, side: T.DoubleSide });
    var trail = new T.Mesh(trailGeo, trailMat); trail.rotation.x = -Math.PI / 2; trail.position.y = 0.05; trail.receiveShadow = true; scene.add(trail);
    // deepen groove
    var tp = trail.geometry.attributes.position;
    for (var ti0 = 0; ti0 < tp.count; ti0++) {
      var tx = tp.getX(ti0);
      tp.setZ(ti0, -0.12 * (1 - Math.min(1, Math.abs(tx) / 1.4)));
    }
    trail.geometry.computeVertexNormals();

    // scenery
    var decor = new T.Group(); scene.add(decor);
    var dr = mulberry(20261105);
    var nTree = quality === 0 ? 36 : 70;
    for (var ti = 0; ti < nTree; ti++) {
      var tree = buildTree(dr, quality);
      var side = dr() < 0.5 ? -1 : 1;
      tree.position.set(side * (5.8 + dr() * 14), 0, dr() * 300);
      decor.add(tree);
    }
    for (var ri = 0; ri < (quality === 0 ? 22 : 42); ri++) {
      var rock = buildRock(dr);
      rock.position.set((dr() - 0.5) * 28, 0.08, dr() * 300);
      if (Math.abs(rock.position.x) < 4.8) rock.position.x += (rock.position.x < 0 ? -5 : 5);
      decor.add(rock);
    }
    for (var ci = 0; ci < (quality === 0 ? 8 : 14); ci++) {
      var cot = buildCottage(dr, quality);
      var sideC = ci % 2 === 0 ? -1 : 1;
      cot.position.set(sideC * (8.5 + dr() * 4), 0, 18 + ci * 22 + dr() * 6);
      decor.add(cot);
    }
    // avenue lamps
    for (var li = 0; li < 18; li++) {
      var lamp = new T.Group();
      var pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 2.8, 6), new T.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.75, roughness: 0.3 }));
      pole.position.y = 1.4; lamp.add(pole);
      var arm = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.05), pole.material); arm.position.set(0.2, 2.7, 0); lamp.add(arm);
      var bulb = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), new T.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb14a, emissiveIntensity: 2.0, roughness: 0.25 }));
      bulb.position.set(0.4, 2.55, 0); lamp.add(bulb);
      if (quality > 0) {
        var pl = new T.PointLight(0xffb14a, 1.35, 16, 2); pl.position.copy(bulb.position); lamp.add(pl);
      }
      var sideL = li % 2 === 0 ? -1 : 1;
      lamp.position.set(sideL * 5.8, 0, 8 + li * 16);
      lamp.scale.x = sideL; // lamp arm toward avenue
      decor.add(lamp);
    }

    // distant mountains + ice ridges
    var mtMat = new T.MeshStandardMaterial({ color: 0x152038, roughness: 1, flatShading: true });
    var iceMat = new T.MeshStandardMaterial({ color: 0x9ecfff, roughness: 0.25, metalness: 0.55, transparent: true, opacity: 0.85, emissive: 0x224466, emissiveIntensity: 0.15 });
    for (var mi = 0; mi < 11; mi++) {
      var mt = new T.Mesh(new T.ConeGeometry(9 + (mi % 3) * 3.5, 16 + (mi % 4) * 5, 6), mtMat);
      mt.position.set(-50 + mi * 11, 5, 210 + (mi % 3) * 18); scene.add(mt);
      if (mi % 2 === 0) {
        var ice = new T.Mesh(new T.ConeGeometry(2.5, 6, 5), iceMat);
        ice.position.set(mt.position.x * 0.3, 3, 160 + mi * 8); scene.add(ice);
      }
    }

    // Vault Spire landmark
    var vault = new T.Group();
    var goldM = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.92, roughness: 0.22, emissive: 0x5a4010, emissiveIntensity: 0.35 });
    var spire = new T.Mesh(new T.ConeGeometry(2.4, 14, 6), goldM); spire.position.y = 8; spire.castShadow = true; vault.add(spire);
    var mid = new T.Mesh(new T.CylinderGeometry(2.0, 2.8, 3.5, 8), goldM); mid.position.y = 2.2; vault.add(mid);
    var base = new T.Mesh(new T.CylinderGeometry(3.0, 3.6, 1.6, 8), goldM); base.position.y = 0.8; vault.add(base);
    var door = new T.Mesh(new T.BoxGeometry(1.3, 2.0, 0.35), new T.MeshStandardMaterial({ color: 0x0a0a0a })); door.position.set(0, 1.3, 2.7); vault.add(door);
    for (var vi = 0; vi < 4; vi++) {
      var gem = new T.Mesh(new T.OctahedronGeometry(0.35), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.2 }));
      gem.position.set(Math.cos(vi*1.57)*2.4, 4.5 + vi*0.3, Math.sin(vi*1.57)*2.4); vault.add(gem);
    }
    var vLight = new T.PointLight(0xf5d77a, 3.2, 50, 2); vLight.position.set(0, 10, 0); vault.add(vLight);
    vault.position.set(0, 0, 1508); scene.add(vault);

    // player ball — layered PBR snow
    var ballMap = makeNoiseTex(256, 88, true);
    var ballN = makeSnowNormal(256, 201);
    var ballMat = new T.MeshStandardMaterial({
      color: 0xf6faff, map: ballMap, normalMap: ballN, normalScale: new T.Vector2(0.9, 0.9),
      roughness: 0.32, metalness: 0.08, emissive: 0xb8d4ff, emissiveIntensity: 0.18
    });
    var ball = new T.Mesh(new T.SphereGeometry(1, quality > 0 ? 48 : 20, quality > 0 ? 36 : 16), ballMat);
    ball.castShadow = true; ball.receiveShadow = true; scene.add(ball);
    var ballLight = new T.PointLight(0xffffff, 1.8, 16, 2); ball.add(ballLight); ballLight.position.set(0, 0.3, 0);
    var band = new T.Mesh(new T.TorusGeometry(0.94, 0.035, 10, 64), goldM);
    band.rotation.x = Math.PI / 2; ball.add(band);
    // contact blob shadow
    var blob = new T.Mesh(new T.CircleGeometry(1.1, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; scene.add(blob);
    // sparkle shell
    var shell = new T.Mesh(new T.SphereGeometry(1.02, 24, 16), new T.MeshBasicMaterial({
      map: sparkTex, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending
    }));
    ball.add(shell);

    var hero = buildAidunlap(0.55); ball.add(hero);

    var stuckRoot = new T.Group(); ball.add(stuckRoot);
    var stuckPool = [];

    var objRoot = new T.Group(); scene.add(objRoot);
    var objMap = {};

    // falling snow
    var pCount = quality === 0 ? 280 : 700;
    var pGeo = new T.BufferGeometry();
    var pPos = new Float32Array(pCount * 3);
    for (var pi = 0; pi < pCount; pi++) {
      pPos[pi*3] = (Math.random()-0.5)*50; pPos[pi*3+1] = Math.random()*28; pPos[pi*3+2] = Math.random()*220;
    }
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    var snowflakes = new T.Points(pGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false }));
    scene.add(snowflakes);

    // speed lines
    var slCount = 40;
    var slGeo = new T.BufferGeometry();
    var slPos = new Float32Array(slCount * 6);
    slGeo.setAttribute('position', new T.BufferAttribute(slPos, 3));
    var speedLines = new T.LineSegments(slGeo, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(speedLines);

    var shake = 0, flash = 0, spin = 0, fovKick = 0;
    var camTarget = new T.Vector3();
    var camPos = new T.Vector3(0, 5.5, -11);

    function matFor(k) {
      if (k === 'powder') return new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0xaaccff, emissiveIntensity: 0.22 });
      if (k === 'gold') return goldM;
      if (k === 'tbill') return new T.MeshStandardMaterial({ color: 0x9fc8a8, metalness: 0.45, roughness: 0.35 });
      if (k === 'net') return new T.MeshStandardMaterial({ color: 0xf5d77a, metalness: 0.75, roughness: 0.28, emissive: 0x664400, emissiveIntensity: 0.35 });
      if (k === 'dump') return new T.MeshStandardMaterial({ color: 0x5a1a1a, roughness: 0.75, emissive: 0xff5f6d, emissiveIntensity: 0.2 });
      if (k === 'rival') return new T.MeshStandardMaterial({ color: 0xc8d0dc, roughness: 0.4, metalness: 0.05 });
      if (k === 'vault') return goldM;
      return new T.MeshStandardMaterial({ color: 0xcccccc });
    }

    function meshFor(o) {
      var r = Math.max(0.15, o.r * 0.05);
      var m;
      if (o.k === 'dump') {
        m = new T.Mesh(new T.BoxGeometry(r*1.7, r*1.7, r*1.7), matFor(o.k));
      } else if (o.k === 'gold' || o.k === 'net') {
        m = new T.Mesh(new T.OctahedronGeometry(r * 1.1), matFor(o.k));
      } else if (o.k === 'tbill') {
        m = new T.Mesh(new T.BoxGeometry(r*1.8, r*0.3, r*1.1), matFor(o.k));
      } else if (o.k === 'rival') {
        m = new T.Mesh(new T.SphereGeometry(r, 16, 12), matFor(o.k));
      } else if (o.k === 'vault') {
        return null;
      } else {
        m = new T.Mesh(new T.SphereGeometry(r, 14, 10), matFor(o.k));
      }
      m.castShadow = true; m.userData.id = o.id; m.userData.k = o.k;
      return m;
    }

    function syncStuck(s) {
      while (stuckPool.length < (s.stuck || []).length) {
        var bit = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), matFor('powder'));
        stuckRoot.add(bit); stuckPool.push(bit);
      }
      for (var i = 0; i < stuckPool.length; i++) {
        var b = stuckPool[i], st = s.stuck[i];
        if (!st) { b.visible = false; continue; }
        b.visible = true;
        try { b.material = matFor(st.k === 'dump' ? 'dump' : st.k); } catch (e) {}
        var rad = 1.05;
        b.position.set(Math.sin(st.ang) * Math.cos(st.elev) * rad, Math.sin(st.elev) * rad, Math.cos(st.ang) * Math.cos(st.elev) * rad);
        b.scale.setScalar(st.k === 'dump' ? 1.4 : (st.k === 'gold' || st.k === 'net' ? 1.2 : 1));
      }
    }

    function syncObjs(s) {
      var seen = {};
      for (var i = 0; i < (s.objs || []).length; i++) {
        var o = s.objs[i]; if (o.hit || o.k === 'vault') continue;
        seen[o.id] = 1;
        var m = objMap[o.id];
        if (!m) { m = meshFor(o); if (!m) continue; objRoot.add(m); objMap[o.id] = m; }
        var wr = Math.max(0.15, o.r * 0.05);
        m.position.set(o.x, wr, o.z);
        m.rotation.y += 0.02;
      }
      Object.keys(objMap).forEach(function (id) {
        if (!seen[id]) { objRoot.remove(objMap[id]); delete objMap[id]; }
      });
      vault.position.set(0, 0, 1508);
      vault.visible = !!s.vaultAt || s.dist > 200;
    }

    function fit() {
      var r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      var dpr = Math.min(dprCap, W.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
      return true;
    }

    function applyState(s, now) {
      if (!s) return;
      var rad = Math.max(0.45, s.size * 0.05);
      ball.scale.setScalar(rad);
      ball.position.set(s.x, rad, s.dist);
      spin += (s.spd || 1) * 0.045;
      ball.rotation.x = spin;
      band.rotation.z = -spin * 0.3;
      shell.rotation.y = spin * 0.5;
      blob.position.set(s.x, 0.03, s.dist);
      blob.scale.setScalar(rad * 1.15);
      hero.position.set(0, 1.08, 0.05);
      hero.scale.setScalar(0.55 / Math.max(0.7, Math.sqrt(rad)));
      hero.rotation.y = Math.sin((now || 0) * 0.004) * 0.1;
      if (hero.userData.arms) {
        hero.userData.arms[0].rotation.x = 0.35 + Math.sin((now||0)*0.01)*0.15;
        hero.userData.arms[1].rotation.x = 0.35 - Math.sin((now||0)*0.01)*0.15;
      }
      trail.position.set(s.x, 0.04, s.dist - 10);
      trail.scale.set(Math.min(4.2, 0.9 + rad * 1.05), 1, 1 + Math.min(1.5, (s.spd||1)*0.08));
      sparkle.position.z = s.dist - 40;

      var back = 7.2 + rad * 1.35;
      var height = rad + 3.0 + Math.min(3.2, rad * 0.7);
      var want = new T.Vector3(s.x * 0.9, height, s.dist - back);
      camPos.lerp(want, 0.1);
      camTarget.set(s.x * 0.55, rad + 0.8, s.dist + 10 + rad);
      if (shake > 0.05) {
        camPos.x += (Math.random() - 0.5) * shake * 0.18;
        camPos.y += (Math.random() - 0.5) * shake * 0.12;
        shake *= 0.86;
      } else shake = 0;
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      if (fovKick > 0.05) { camera.fov = 55 + fovKick * 8; fovKick *= 0.9; camera.updateProjectionMatrix(); }
      else if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }

      sun.position.set(s.x - 18, 42, s.dist + 8);
      sun.target.position.set(s.x, 0, s.dist); sun.target.updateMatrixWorld();

      var arr = snowflakes.geometry.attributes.position.array;
      for (var i = 0; i < pCount; i++) {
        arr[i*3+1] -= 0.045 + (i % 5) * 0.012;
        arr[i*3] += Math.sin((now||0)*0.001 + i)*0.01;
        arr[i*3+2] -= 0.03 + (s.spd||1)*0.01;
        if (arr[i*3+1] < 0) { arr[i*3+1] = 16 + Math.random() * 10; arr[i*3] = s.x + (Math.random()-0.5)*36; arr[i*3+2] = s.dist + Math.random()*50; }
      }
      snowflakes.geometry.attributes.position.needsUpdate = true;

      // speed lines
      var spd = s.spd || 0;
      speedLines.material.opacity = Math.max(0, Math.min(0.55, (spd - 4) * 0.08));
      if (speedLines.material.opacity > 0.02) {
        var sla = speedLines.geometry.attributes.position.array;
        for (var li2 = 0; li2 < slCount; li2++) {
          var lx = s.x + (Math.random()-0.5)*rad*4;
          var ly = rad * (0.2 + Math.random()*1.6);
          var lz = s.dist - 1 - Math.random()*8;
          var len = 1.5 + Math.random()*3 + spd*0.15;
          sla[li2*6]=lx; sla[li2*6+1]=ly; sla[li2*6+2]=lz;
          sla[li2*6+3]=lx; sla[li2*6+4]=ly; sla[li2*6+5]=lz-len;
        }
        speedLines.geometry.attributes.position.needsUpdate = true;
      }

      aurora.rotation.z = Math.sin((now || 0) * 0.00025) * 0.18;
      aurora2.rotation.z = Math.cos((now || 0) * 0.0002) * 0.14;
      aurora3.material.opacity = 0.08 + Math.sin((now||0)*0.001)*0.04;
      ballMat.emissiveIntensity = 0.15 + Math.sin((now||0)*0.008)*0.06;

      syncObjs(s); syncStuck(s);
      if (s.fx > 10) { shake = Math.max(shake, s.fx > 18 ? 1.5 : 0.8); flash = s.vaulted ? 0.55 : 0.28; fovKick = Math.max(fovKick, 0.7); }
    }

    function render(s, now) {
      try {
        if (!fit() && !(canvas.width > 10)) return;
        applyState(s, now);
        if (flash > 0.02) { renderer.setClearColor(0xffffff); flash *= 0.82; }
        else renderer.setClearColor(0x040712);
        renderer.render(scene, camera);
      } catch (e) { if (!render._e) { console.warn('SB3D', e); render._e = 1; } }
    }

    function bump(kind) {
      if (kind === 'smash' || kind === 'crush') { shake = Math.max(shake, 1.3); fovKick = Math.max(fovKick, 0.8); }
      if (kind === 'vault') { shake = 1.8; flash = 0.7; fovKick = 1.2; }
      if (kind === 'pickup') shake = Math.max(shake, 0.4);
    }

    function setQuality(q) {
      quality = q; dprCap = q === 0 ? 1.2 : q === 1 ? 1.6 : 2;
      renderer.shadowMap.enabled = q > 0; fit();
    }

    fit();
    return { ok: true, render: render, fit: fit, bump: bump, setQuality: setQuality, renderer: renderer, scene: scene, camera: camera };
  }

  W.SB3D = { ok: true, create: create, makeNoiseTex: makeNoiseTex };
})(window);
