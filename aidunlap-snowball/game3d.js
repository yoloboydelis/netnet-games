/* Aidunlap Snowball · original Three.js chase-cam renderer (NetNet).
 * Inspiration only from snowball-roller genre. No third-party models/textures.
 * Procedural snow / trees / rocks / vault. Licenses: all code original; Three.js MIT (vendor/).
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
      var n = soft ? (r() * 40 + 200) : (r() * 255);
      img.data[i] = img.data[i+1] = img.data[i+2] = n; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; return tex;
  }

  function makeSnowNormal(size, seed) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d'), img = ctx.createImageData(size, size), r = mulberry(seed|7);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var i = (y * size + x) * 4;
      var nx = 128 + (r() - 0.5) * 50, ny = 128 + (r() - 0.5) * 50;
      img.data[i] = nx; img.data[i+1] = ny; img.data[i+2] = 255; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; return tex;
  }

  function buildAidunlap(scale) {
    var g = new T.Group();
    var skin = new T.MeshStandardMaterial({ color: 0xf2c9a5, roughness: 0.65 });
    var suit = new T.MeshStandardMaterial({ color: 0x26262c, roughness: 0.55, metalness: 0.15 });
    var suitS = new T.MeshStandardMaterial({ color: 0x17171b, roughness: 0.55 });
    var hair = new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.4 });
    var tie = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    var gold = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    var shirt = new T.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 });
    function box(mat, w, h, d, x, y, z) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    }
    // legs
    box(suitS, 0.18*scale, 0.45*scale, 0.18*scale, -0.12*scale, 0.22*scale, 0);
    box(suitS, 0.18*scale, 0.45*scale, 0.18*scale, 0.12*scale, 0.22*scale, 0);
    // torso
    box(suit, 0.42*scale, 0.55*scale, 0.24*scale, 0, 0.72*scale, 0);
    box(shirt, 0.16*scale, 0.28*scale, 0.05*scale, 0, 0.78*scale, 0.13*scale);
    box(tie, 0.07*scale, 0.28*scale, 0.04*scale, 0, 0.74*scale, 0.15*scale);
    box(gold, 0.12*scale, 0.03*scale, 0.03*scale, 0, 0.88*scale, 0.15*scale);
    // arms
    box(suit, 0.12*scale, 0.42*scale, 0.12*scale, -0.3*scale, 0.7*scale, 0);
    box(suit, 0.12*scale, 0.42*scale, 0.12*scale, 0.3*scale, 0.7*scale, 0);
    // head
    var head = new T.Mesh(new T.SphereGeometry(0.22*scale, 16, 12), skin); head.position.set(0, 1.15*scale, 0); head.castShadow = true; g.add(head);
    // slick hair
    var hairM = new T.Mesh(new T.SphereGeometry(0.23*scale, 16, 10, 0, Math.PI*2, 0, Math.PI*0.55), hair);
    hairM.position.set(0, 1.2*scale, -0.02*scale); g.add(hairM);
    // smug brow ridge
    box(hair, 0.28*scale, 0.03*scale, 0.06*scale, 0, 1.2*scale, 0.18*scale);
    g.userData.scale = scale;
    return g;
  }

  function buildTree(rng, quality) {
    var g = new T.Group();
    var trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 1.2, quality > 1 ? 8 : 5),
      new T.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 }));
    trunk.position.y = 0.6; trunk.castShadow = true; g.add(trunk);
    var green = new T.MeshStandardMaterial({ color: 0x1a3d28, roughness: 0.85 });
    var snowTip = new T.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.7 });
    for (var i = 0; i < 3; i++) {
      var cone = new T.Mesh(new T.ConeGeometry(1.1 - i * 0.25, 1.4 - i * 0.15, quality > 1 ? 10 : 6), green);
      cone.position.y = 1.3 + i * 0.85; cone.castShadow = true; g.add(cone);
      var cap = new T.Mesh(new T.ConeGeometry(0.85 - i * 0.2, 0.25, quality > 1 ? 8 : 5), snowTip);
      cap.position.y = 1.85 + i * 0.85; g.add(cap);
    }
    g.scale.setScalar(0.7 + rng() * 0.9);
    g.rotation.y = rng() * 6.28;
    return g;
  }

  function buildRock(rng) {
    var geo = new T.IcosahedronGeometry(0.4 + rng() * 0.5, 0);
    var mat = new T.MeshStandardMaterial({ color: 0x6a7380, roughness: 0.95, flatShading: true });
    var m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    m.scale.set(0.8 + rng(), 0.5 + rng() * 0.6, 0.8 + rng());
    m.rotation.set(rng(), rng() * 6, rng());
    return m;
  }


  function create(canvas, opts) {
    opts = opts || {};
    var quality = opts.quality == null ? ( /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 0 : 2 ) : opts.quality;
    var dprCap = quality === 0 ? 1.25 : quality === 1 ? 1.75 : 2;
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: quality > 0, powerPreference: 'high-performance', alpha: false });
    renderer.setClearColor(0x050814);
    renderer.shadowMap.enabled = quality > 0;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new T.Scene();
    scene.fog = new T.FogExp2(0x0a1528, 0.018);

    var camera = new T.PerspectiveCamera(52, 16 / 9, 0.1, 280);
    camera.position.set(0, 4, -8);

    // lights
    var hemi = new T.HemisphereLight(0x9ec9ff, 0x1a2030, 0.55); scene.add(hemi);
    var sun = new T.DirectionalLight(0xcfe6ff, 1.15); sun.position.set(-20, 40, 10);
    sun.castShadow = quality > 0;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
      sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
      sun.shadow.bias = -0.0003;
    }
    scene.add(sun);
    var moon = new T.DirectionalLight(0x88aaff, 0.35); moon.position.set(30, 25, -20); scene.add(moon);

    // aurora plane
    var auroraGeo = new T.PlaneGeometry(220, 60, 1, 1);
    var auroraMat = new T.MeshBasicMaterial({
      color: 0x39ff88, transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending
    });
    var aurora = new T.Mesh(auroraGeo, auroraMat); aurora.position.set(0, 38, 60); aurora.rotation.x = 0.15; scene.add(aurora);
    var aurora2 = aurora.clone(); aurora2.material = auroraMat.clone(); aurora2.material.color.setHex(0x38f5ff); aurora2.material.opacity = 0.12;
    aurora2.position.set(20, 42, 80); aurora2.rotation.z = 0.2; scene.add(aurora2);

    // moon disc
    var moonMesh = new T.Mesh(new T.SphereGeometry(4.5, 24, 16), new T.MeshBasicMaterial({ color: 0xe8eef8 }));
    moonMesh.position.set(40, 48, 90); scene.add(moonMesh);

    // snow ground (large repeating plane with normals)
    var snowMap = makeNoiseTex(256, 42, true); snowMap.repeat.set(40, 80);
    var snowN = makeSnowNormal(256, 99); snowN.repeat.set(40, 80);
    var groundMat = new T.MeshStandardMaterial({
      color: 0xe8f2ff, map: snowMap, normalMap: snowN, normalScale: new T.Vector2(0.55, 0.55),
      roughness: 0.82, metalness: 0.02
    });
    var ground = new T.Mesh(new T.PlaneGeometry(80, 400, quality > 1 ? 80 : 40, quality > 1 ? 200 : 80), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 120); ground.receiveShadow = true;
    // gentle hills
    var pos = ground.geometry.attributes.position;
    var rg = mulberry(1234);
    for (var gi = 0; gi < pos.count; gi++) {
      var gx = pos.getX(gi), gz = pos.getY(gi); // before rotate, y is z
      var h = Math.sin(gx * 0.15) * 0.35 + Math.cos(gz * 0.08) * 0.45 + (rg() - 0.5) * 0.15;
      pos.setZ(gi, h);
    }
    ground.geometry.computeVertexNormals();
    scene.add(ground);

    // trail ribbon (deformation feel)
    var trailGeo = new T.PlaneGeometry(2.2, 60, 1, 40);
    var trailMat = new T.MeshStandardMaterial({ color: 0xc5d4e8, roughness: 0.95, transparent: true, opacity: 0.85, side: T.DoubleSide });
    var trail = new T.Mesh(trailGeo, trailMat); trail.rotation.x = -Math.PI / 2; trail.position.y = 0.04; scene.add(trail);

    // scenery scatter (deterministic from fixed seed — visual only)
    var decor = new T.Group(); scene.add(decor);
    var dr = mulberry(20261105);
    for (var ti = 0; ti < (quality === 0 ? 28 : 55); ti++) {
      var tree = buildTree(dr, quality);
      var side = dr() < 0.5 ? -1 : 1;
      tree.position.set(side * (5.5 + dr() * 10), 0, dr() * 280);
      decor.add(tree);
    }
    for (var ri = 0; ri < (quality === 0 ? 18 : 36); ri++) {
      var rock = buildRock(dr);
      rock.position.set((dr() - 0.5) * 22, 0.1, dr() * 280);
      if (Math.abs(rock.position.x) < 4.5) rock.position.x += (rock.position.x < 0 ? -4 : 4);
      decor.add(rock);
    }
    // warm lamps along avenue
    for (var li = 0; li < 14; li++) {
      var lamp = new T.Group();
      var pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 2.6, 6), new T.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.35 }));
      pole.position.y = 1.3; lamp.add(pole);
      var bulb = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffb14a, emissiveIntensity: 1.6, roughness: 0.3 }));
      bulb.material.color.setHex(0xffe0a0);
      bulb.position.y = 2.55; lamp.add(bulb);
      if (quality > 0) {
        var pl = new T.PointLight(0xffb14a, 1.2, 14, 2); pl.position.y = 2.5; lamp.add(pl);
      }
      var sideL = li % 2 === 0 ? -1 : 1;
      lamp.position.set(sideL * 6.2, 0, 12 + li * 18);
      decor.add(lamp);
    }

    // distant mountains
    var mtMat = new T.MeshStandardMaterial({ color: 0x1a2438, roughness: 1, flatShading: true });
    for (var mi = 0; mi < 9; mi++) {
      var mt = new T.Mesh(new T.ConeGeometry(8 + (mi % 3) * 3, 14 + (mi % 4) * 4, 5), mtMat);
      mt.position.set(-40 + mi * 12, 4, 200 + (mi % 2) * 20); scene.add(mt);
    }

    // Vault Spire (NetNet gold) — landmark at GOAL
    var vault = new T.Group();
    var goldM = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.28, emissive: 0x5a4010, emissiveIntensity: 0.25 });
    var spire = new T.Mesh(new T.ConeGeometry(2.2, 12, 6), goldM); spire.position.y = 6; spire.castShadow = true; vault.add(spire);
    var base = new T.Mesh(new T.CylinderGeometry(2.6, 3.2, 2.2, 8), goldM); base.position.y = 1.1; vault.add(base);
    var door = new T.Mesh(new T.BoxGeometry(1.2, 1.8, 0.3), new T.MeshStandardMaterial({ color: 0x0a0a0a })); door.position.set(0, 1.2, 2.5); vault.add(door);
    var vLight = new T.PointLight(0xf5d77a, 2.5, 40, 2); vLight.position.set(0, 8, 0); vault.add(vLight);
    vault.position.set(0, 0, 1500 + 8);
    scene.add(vault);

    // player ball
    var ballMat = new T.MeshStandardMaterial({
      color: 0xf4f8ff, roughness: 0.35, metalness: 0.05,
      emissive: 0xb8d4ff, emissiveIntensity: 0.15
    });
    var ball = new T.Mesh(new T.SphereGeometry(1, quality > 0 ? 32 : 16, quality > 0 ? 24 : 12), ballMat);
    ball.castShadow = true; ball.receiveShadow = true; scene.add(ball);
    var ballLight = new T.PointLight(0xffffff, 1.4, 12, 2); ball.add(ballLight); ballLight.position.set(0, 0.2, 0);
    var band = new T.Mesh(new T.TorusGeometry(0.92, 0.04, 8, 48), new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 }));
    band.rotation.x = Math.PI / 2; ball.add(band);

    // aidunlap rider
    var hero = buildAidunlap(0.55); ball.add(hero);

    // stuck pickups on ball
    var stuckRoot = new T.Group(); ball.add(stuckRoot);
    var stuckPool = [];

    // world objects (synced from sim)
    var objRoot = new T.Group(); scene.add(objRoot);
    var objMap = {};

    // particles
    var pCount = quality === 0 ? 200 : 500;
    var pGeo = new T.BufferGeometry();
    var pPos = new Float32Array(pCount * 3);
    for (var pi = 0; pi < pCount; pi++) {
      pPos[pi*3] = (Math.random()-0.5)*40; pPos[pi*3+1] = Math.random()*25; pPos[pi*3+2] = Math.random()*200;
    }
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    var snowflakes = new T.Points(pGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.75, depthWrite: false }));
    scene.add(snowflakes);

    var shake = 0, flash = 0, spin = 0;
    var camTarget = new T.Vector3();
    var camPos = new T.Vector3(0, 5, -10);

    function matFor(k) {
      if (k === 'powder') return new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0xaaccff, emissiveIntensity: 0.2 });
      if (k === 'gold') return new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
      if (k === 'tbill') return new T.MeshStandardMaterial({ color: 0x9fc8a8, metalness: 0.4, roughness: 0.4 });
      if (k === 'net') return new T.MeshStandardMaterial({ color: 0xf5d77a, metalness: 0.7, roughness: 0.3, emissive: 0x664400, emissiveIntensity: 0.3 });
      if (k === 'dump') return new T.MeshStandardMaterial({ color: 0x5a1a1a, roughness: 0.8, emissive: 0xff5f6d, emissiveIntensity: 0.15 });
      if (k === 'rival') return new T.MeshStandardMaterial({ color: 0xa8b0c0, roughness: 0.45 });
      if (k === 'vault') return goldM;
      return new T.MeshStandardMaterial({ color: 0xcccccc });
    }

    function meshFor(o) {
      var r = Math.max(0.15, o.r * 0.05);
      var m;
      if (o.k === 'dump') {
        m = new T.Mesh(new T.BoxGeometry(r*1.6, r*1.6, r*1.6), matFor(o.k));
      } else if (o.k === 'vault') {
        m = vault; // shared landmark — positioned separately
        return null;
      } else {
        m = new T.Mesh(new T.SphereGeometry(r, 12, 10), matFor(o.k));
      }
      m.castShadow = true; m.userData.id = o.id; m.userData.k = o.k;
      return m;
    }

    function syncStuck(s) {
      while (stuckPool.length < (s.stuck || []).length) {
        var bit = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), matFor('powder'));
        stuckRoot.add(bit); stuckPool.push(bit);
      }
      for (var i = 0; i < stuckPool.length; i++) {
        var b = stuckPool[i], st = s.stuck[i];
        if (!st) { b.visible = false; continue; }
        b.visible = true; b.material = matFor(st.k === 'dump' ? 'dump' : st.k);
        var rad = 1.02;
        b.position.set(Math.sin(st.ang) * Math.cos(st.elev) * rad, Math.sin(st.elev) * rad, Math.cos(st.ang) * Math.cos(st.elev) * rad);
        b.scale.setScalar(st.k === 'dump' ? 1.3 : 1);
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
        m.scale.setScalar(1);
      }
      Object.keys(objMap).forEach(function (id) {
        if (!seen[id]) { objRoot.remove(objMap[id]); delete objMap[id]; }
      });
      // vault position from GOAL
      vault.position.set(0, 0, 1500 + 8);
      vault.visible = !!s.vaultAt || s.dist > 240;
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
      spin += s.spd * 0.04;
      ball.rotation.x = spin;
      // hero sits on top
      hero.position.set(0, 1.05, 0);
      hero.scale.setScalar(0.55 / Math.max(0.7, Math.sqrt(rad)));
      hero.rotation.y = Math.sin((now || 0) * 0.004) * 0.08;
      // trail behind
      trail.position.set(s.x, 0.05, s.dist - 8);
      trail.scale.set(Math.min(3.5, 0.8 + rad * 0.9), 1, 1);
      // camera chase
      var want = new T.Vector3(s.x * 0.85, rad + 2.8 + Math.min(2.5, rad * 0.6), s.dist - (6.5 + rad * 1.2));
      camPos.lerp(want, 0.08);
      camTarget.set(s.x * 0.5, rad + 0.6, s.dist + 8 + rad);
      if (shake > 0.05) {
        camPos.x += (Math.random() - 0.5) * shake * 0.15;
        camPos.y += (Math.random() - 0.5) * shake * 0.1;
        shake *= 0.88;
      } else shake = 0;
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      // sun follows
      sun.position.set(s.x - 20, 40, s.dist + 10);
      sun.target.position.set(s.x, 0, s.dist); sun.target.updateMatrixWorld();
      // snow particles drift
      var arr = snowflakes.geometry.attributes.position.array;
      for (var i = 0; i < pCount; i++) {
        arr[i*3+1] -= 0.04 + (i % 5) * 0.01;
        arr[i*3+2] -= 0.02;
        if (arr[i*3+1] < 0) { arr[i*3+1] = 18 + Math.random() * 8; arr[i*3] = s.x + (Math.random()-0.5)*30; arr[i*3+2] = s.dist + Math.random()*40; }
      }
      snowflakes.geometry.attributes.position.needsUpdate = true;
      snowflakes.position.z = 0;
      aurora.rotation.z = Math.sin((now || 0) * 0.0003) * 0.15;
      syncObjs(s); syncStuck(s);
      if (s.fx > 10) { shake = Math.max(shake, s.fx > 18 ? 1.4 : 0.7); flash = s.vaulted ? 0.5 : 0.25; }
    }

    function render(s, now) {
      try {
        if (!fit() && !(canvas.width > 10)) return;
        applyState(s, now);
        if (flash > 0.02) { renderer.setClearColor(0xffffff); flash *= 0.85; }
        else renderer.setClearColor(0x050814);
        renderer.render(scene, camera);
      } catch (e) { if (!render._e) { console.warn('SB3D', e); render._e = 1; } }
    }

    function bump(kind) {
      if (kind === 'smash' || kind === 'crush') shake = Math.max(shake, 1.2);
      if (kind === 'vault') { shake = 1.6; flash = 0.6; }
      if (kind === 'pickup') shake = Math.max(shake, 0.35);
    }

    function setQuality(q) {
      quality = q; dprCap = q === 0 ? 1.25 : q === 1 ? 1.75 : 2;
      renderer.shadowMap.enabled = q > 0; fit();
    }

    fit();
    return { ok: true, render: render, fit: fit, bump: bump, setQuality: setQuality, renderer: renderer, scene: scene, camera: camera };
  }

  W.SB3D = { ok: true, create: create, makeNoiseTex: makeNoiseTex };
})(window);
