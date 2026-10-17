/* Baosu · English landing (REQ-066)
   One particle field, eight scenes. Scroll position picks the pair of scenes and the blend between them;
   the GPU does the morph. Raw WebGL 1, no external libraries (the server CSP allows only same-origin scripts). */
(function(){
  'use strict';
  var root = document.documentElement, body = document.body;
  root.classList.add('js');
  body.classList.add('is-loading', 'at-top');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 820;
  var TAU = Math.PI * 2;

  /* ---------- deterministic randomness ---------- */
  var seed = 20261017;
  function rand(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function gauss(){ var u = rand() || 1e-6, v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function dir(){ var u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u); return [s * Math.cos(th), u, s * Math.sin(th)]; }
  function rx(p, a){ var c = Math.cos(a), s = Math.sin(a); return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]]; }
  function ry(p, a){ var c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; }
  function rz(p, a){ var c = Math.cos(a), s = Math.sin(a); return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]]; }
  function lerp3(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function dist3(a, b){ var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }

  var N = small ? 12000 : 26000;
  var STARS = Math.round(N * 0.09);
  var M = N - STARS;

  /* w channel: fract = flow position (0 = no flow), +2 = warm highlight, -1 = background star */
  function W(flow, hl){ return (flow > 0 ? Math.min(.999, Math.max(.002, flow)) : 0) + (hl ? 2 : 0); }

  function Builder(){ this.a = new Float32Array(N * 4); this.i = 0; }
  Builder.prototype.put = function(p, w){ if (this.i >= M) return; var k = this.i * 4; this.a[k] = p[0]; this.a[k + 1] = p[1]; this.a[k + 2] = p[2]; this.a[k + 3] = w || 0; this.i++; };
  Builder.prototype.room = function(){ return M - this.i; };
  Builder.prototype.dust = function(r0, r1){ while (this.i < M){ var d = dir(), r = r0 + rand() * (r1 - r0); this.put([d[0] * r, d[1] * r, d[2] * r], 0); } };
  Builder.prototype.done = function(stars){ this.dust(2.2, 4.2); this.a.set(stars.subarray(M * 4), M * 4); return this.a; };
  /* distribute `count` particles along line segments by length × weight */
  Builder.prototype.segments = function(list, count){
    var total = 0; list.forEach(function(s){ s.len = dist3(s.a, s.b) * (s.weight || 1); total += s.len; });
    var self = this;
    list.forEach(function(s){
      var n = Math.round(count * s.len / total);
      for (var j = 0; j < n; j++){
        var u = rand(), p = lerp3(s.a, s.b, u), w = s.width || .01;
        p = [p[0] + gauss() * w, p[1] + gauss() * w, p[2] + gauss() * w];
        var flow = s.flow ? s.flow(p, u) : 0;
        self.put(p, W(flow, s.hl));
      }
    });
  };
  Builder.prototype.ball = function(c, r, count, hl, flow){ for (var j = 0; j < count; j++){ var d = dir(), k = r * Math.cbrt(rand()); this.put([c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k], W(flow || 0, hl)); } };
  Builder.prototype.shell = function(c, r, count, thick, hl){ for (var j = 0; j < count; j++){ var d = dir(), k = r + gauss() * thick; this.put([c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k], W(0, hl)); } };
  function polyline(pts, closed){ var out = []; for (var i = 0; i < pts.length - (closed ? 0 : 1); i++) out.push([pts[i], pts[(i + 1) % pts.length]]); return out; }

  /* ---------- scenes ---------- */
  function starField(){
    var a = new Float32Array(N * 4);
    for (var i = M; i < N; i++){ var k = i * 4; a[k] = (rand() - .5) * 18; a[k + 1] = (rand() - .5) * 11; a[k + 2] = -1.5 - rand() * 9; a[k + 3] = -1; }
    return a;
  }

  function nebula(stars){ var b = new Builder(); while (b.room()){ var d = dir(), r = 2.4 + rand() * 4.5; b.put([d[0] * r, d[1] * r, d[2] * r - 1.5], 0); } return b.done(stars); }

  function sceneCore(stars){
    var b = new Builder();
    b.shell([0, 0, 0], 1, Math.round(M * .5), .022, false);
    b.ball([0, 0, 0], .24, Math.round(M * .045), true);
    var n1 = Math.round(M * .18), n2 = Math.round(M * .1), j, a, p;
    for (j = 0; j < n1; j++){ a = rand() * TAU; var r1 = 1.55 + gauss() * .014; p = rz(rx([Math.cos(a) * r1, gauss() * .008, Math.sin(a) * r1], .42), .14); b.put(p, W(a / TAU, false)); }
    for (j = 0; j < n2; j++){ a = rand() * TAU; var r2 = 1.98 + gauss() * .01; p = rz(rx([Math.cos(a) * r2, gauss() * .006, Math.sin(a) * r2], -.28), -.32); b.put(p, W(rand() < .04 ? 0 : 1 - a / TAU, rand() < .03)); }
    while (b.room() > M * .02){ var d = dir(), r = 1.08 + Math.abs(gauss()) * .45; b.put([d[0] * r, d[1] * r, d[2] * r], 0); }
    return b.done(stars);
  }

  function sceneFragments(stars){
    var b = new Builder();
    var clusters = [
      {c: [-1.5, .7, .1], kind: 'box', s: [.42, .3, .34], rot: .5},
      {c: [1.25, 1.0, -.5], kind: 'ball', s: [.36]},
      {c: [.15, -1.05, .5], kind: 'disc', s: [.5], rot: .9},
      {c: [1.6, -.55, .35], kind: 'box', s: [.22, .38, .22], rot: -.4},
      {c: [-.95, -.75, -.7], kind: 'ball', s: [.26]},
      {c: [-.1, .35, -1.1], kind: 'disc', s: [.32], rot: -1.1}
    ];
    var per = Math.round(M * .66 / clusters.length);
    clusters.forEach(function(cl){
      for (var j = 0; j < per; j++){
        var p;
        if (cl.kind === 'box'){ p = [(rand() - .5) * 2 * cl.s[0], (rand() - .5) * 2 * cl.s[1], (rand() - .5) * 2 * cl.s[2]]; if (rand() < .6){ var ax = Math.floor(rand() * 3); p[ax] = (rand() < .5 ? -1 : 1) * cl.s[ax]; } p = ry(rx(p, cl.rot), cl.rot * .7); }
        else if (cl.kind === 'ball'){ var d = dir(), k = cl.s[0] * (rand() < .7 ? 1 + gauss() * .03 : Math.cbrt(rand())); p = [d[0] * k, d[1] * k, d[2] * k]; }
        else { var a = rand() * TAU, r = cl.s[0] * Math.sqrt(rand()); p = rx([Math.cos(a) * r, gauss() * .012, Math.sin(a) * r], cl.rot); }
        b.put([p[0] + cl.c[0] * .85, p[1] + cl.c[1] * .85, p[2] + cl.c[2] * .85], W(0, rand() < .035));
      }
    });
    while (b.room() > M * .02){ var d2 = dir(), r2 = .6 + rand() * 2.6; b.put([d2[0] * r2 * 1.2, d2[1] * r2 * .8, d2[2] * r2], 0); }
    return b.done(stars);
  }

  function bezier(p0, c, p1, t){ var u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1], u * u * p0[2] + 2 * u * t * c[2] + t * t * p1[2]]; }

  function sceneChannels(stars){
    var b = new Builder();
    var O = [0, 0, 0];
    var streams = [
      {p0: [-2.6, 2.3, -.4], c: [-1.5, 1.5, .2]},
      {p0: [-3.3, -.1, .7], c: [-1.7, -.3, .9]},
      {p0: [-2.5, -2.3, -.2], c: [-1.3, -1.6, -.6]}
    ];
    var per = Math.round(M * .18);
    streams.forEach(function(s){
      for (var j = 0; j < per; j++){
        var t = Math.pow(rand(), .85) * .97, p = bezier(s.p0, s.c, O, t), w = .1 * (1 - t) + .012;
        b.put([p[0] + gauss() * w, p[1] + gauss() * w, p[2] + gauss() * w], W(t, rand() < .02));
      }
    });
    b.shell(O, .62, Math.round(M * .17), .02, false);
    b.ball(O, .2, Math.round(M * .04), true);
    for (var j = 0, n = Math.round(M * .08); j < n; j++){ var a = rand() * TAU, r = .98 + gauss() * .012; b.put(rx([Math.cos(a) * r, gauss() * .006, Math.sin(a) * r], 1.2), W(a / TAU, false)); }
    while (b.room() > M * .02){ var d = dir(), rr = .8 + Math.abs(gauss()) * 1.4; b.put([d[0] * rr, d[1] * rr, d[2] * rr], 0); }
    return b.done(stars);
  }

  function sceneLayers(stars){
    var b = new Builder();
    var WX = 2.6, DZ = 1.6, Y = [1.3, .43, -.43, -1.3];
    function rect(y){ var x = WX / 2, z = DZ / 2; return polyline([[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]], true); }
    function grid(y, count, step){
      for (var j = 0; j < count; j++){
        var p;
        if (rand() < .5){ var zz = -DZ / 2 + Math.round(rand() * DZ / step) * step; p = [(rand() - .5) * WX, y, zz]; }
        else { var xx = -WX / 2 + Math.round(rand() * WX / step) * step; p = [xx, y, (rand() - .5) * DZ]; }
        b.put([p[0] + gauss() * .004, p[1] + gauss() * .004, p[2] + gauss() * .004], 0);
      }
    }
    function outline(y, count, hl, dashed){
      var segs = rect(y), per = Math.round(count / 4);
      segs.forEach(function(s){ for (var j = 0; j < per; j++){ var u = rand(); if (dashed && Math.floor(u * 22) % 2) continue; var p = lerp3(s[0], s[1], u); b.put([p[0], p[1] + gauss() * .004, p[2]], W(0, hl)); } });
    }
    outline(Y[0], M * .1, false, true);
    [-.85, 0, .85].forEach(function(x){ b.ball([x, Y[0] + .06, 0], .09, Math.round(M * .012), false); });
    grid(Y[1], Math.round(M * .19), .135); outline(Y[1], M * .06, true, false);
    grid(Y[2], Math.round(M * .19), .135); outline(Y[2], M * .06, true, false);
    grid(Y[3], Math.round(M * .08), .2); outline(Y[3], M * .045, false, false);
    b.ball([0, Y[3] + .05, 0], .14, Math.round(M * .02), false);
    var flowDown = function(p){ return (Y[0] + .1 - p[1]) / 2.2; };
    b.segments([
      {a: [-.85, Y[0], 0], b: [-.85, Y[3], 0], width: .006, flow: flowDown},
      {a: [0, Y[0], 0], b: [0, Y[3], 0], width: .006, flow: flowDown},
      {a: [.85, Y[0], 0], b: [.85, Y[3], 0], width: .006, flow: flowDown},
      {a: [-1.2, Y[1], .62], b: [-1.2, Y[2], .62], width: .005, flow: flowDown, hl: true},
      {a: [1.2, Y[1], -.62], b: [1.2, Y[2], -.62], width: .005, flow: flowDown, hl: true}
    ], Math.round(M * .12));
    while (b.room() > M * .02){ b.put([(rand() - .5) * 4.4, (rand() - .5) * 3.2, (rand() - .5) * 3], 0); }
    return b.done(stars);
  }

  function sceneRouting(stars){
    /* left to right: one input stream, a hub, three lanes. Top lane passes a model node,
       middle lane runs straight (no model), bottom lane passes a field gate. */
    var b = new Builder();
    function put(p, w){ b.put(ry(p, -.38), w); }
    var X0 = -2.5, X1 = 1.9, flow = function(x){ return (x - X0) / (X1 - X0); };
    var hub = [-.9, 0, 0];
    for (var j = 0, n = Math.round(M * .12); j < n; j++){ var u = rand(), p = lerp3([X0, 0, 0], hub, u), w = .05 * (1 - u) + .01; put([p[0], p[1] + gauss() * w, p[2] + gauss() * w], W(flow(p[0]), false)); }
    b.ball(ry(hub, -.38), .1, Math.round(M * .02), false);
    b.shell(ry(hub, -.38), .17, Math.round(M * .015), .008, false);
    var lanes = [{end: [1.65, 1.15, 0], c: [.1, 1.25, 0]}, {end: [1.9, 0, 0], c: [.4, 0, 0]}, {end: [1.65, -1.15, 0], c: [.1, -1.25, 0]}];
    lanes.forEach(function(l, k){
      for (var j = 0, n = Math.round(M * .15); j < n; j++){ var t = rand(), p = bezier(hub, l.c, l.end, t); put([p[0] + gauss() * .012, p[1] + gauss() * .012, p[2] + gauss() * .012], W(flow(p[0]), false)); }
      var mid = bezier(hub, l.c, l.end, .52);
      if (k === 0){ b.shell(ry(mid, -.38), .2, Math.round(M * .05), .012, false); b.ball(ry(mid, -.38), .07, Math.round(M * .01), false); }
      if (k === 2){ for (var i = 0, m = Math.round(M * .04); i < m; i++){ var a = rand() * TAU; put([mid[0] + gauss() * .006, mid[1] + Math.cos(a) * .22, mid[2] + Math.sin(a) * .22], W(0, true)); } }
      b.ball(ry(l.end, -.38), .12, Math.round(M * .035), true);
      b.shell(ry(l.end, -.38), .22, Math.round(M * .02), .008, false);
    });
    while (b.room() > M * .02){ b.put([(rand() - .5) * 5, (rand() - .5) * 3.6, (rand() - .5) * 2.4], 0); }
    return b.done(stars);
  }

  function sceneEvidence(stars){
    var b = new Builder();
    var PW = 1.5, PH = 2.0, x0 = -PW / 2, y0 = PH / 2, F = .3, rows = [];
    function place(p, w){ var q = rx(ry(p, .32), -.05); b.put(q, w); }
    var page = polyline([[x0, y0, 0], [x0 + PW - F, y0, 0], [x0 + PW, y0 - F, 0], [x0 + PW, -y0, 0], [x0, -y0, 0]], true)
      .concat(polyline([[x0 + PW - F, y0, 0], [x0 + PW - F, y0 - F, 0], [x0 + PW, y0 - F, 0]], false));
    var plen = 0; page.forEach(function(s){ plen += dist3(s[0], s[1]); });
    page.forEach(function(s){ var n = Math.round(M * .12 * dist3(s[0], s[1]) / plen); for (var j = 0; j < n; j++){ var p = lerp3(s[0], s[1], rand()); place([p[0] + gauss() * .004, p[1] + gauss() * .004, 0], 0); } });
    for (var j = 0, n = Math.round(M * .05); j < n; j++) place([x0 + .18 + rand() * .62, .7 + (rand() - .5) * .07, 0], 0);
    var HL = 6, words = [];
    for (var r = 0; r < 14; r++){
      var y = .48 - r * .098, limit = r === 13 ? .55 : (r === HL ? 1.02 : .78 + rand() * .36), x = 0;
      while (x < limit){ var len = .05 + rand() * .17; if (x + len > limit) len = limit - x; words.push({x: x0 + .18 + x, y: y, len: len, hl: r === HL}); x += len + .04; }
      rows.push(y);
    }
    var tl = 0; words.forEach(function(w){ tl += w.len * (w.hl ? 2.2 : 1); });
    words.forEach(function(w){ var c = Math.round(M * .44 * w.len * (w.hl ? 2.2 : 1) / tl); for (var k = 0; k < c; k++){ var u = rand(); place([w.x + u * w.len, w.y + gauss() * .007, 0], W(w.hl ? (w.x + u * w.len - x0) / PW : 0, w.hl)); } });
    var hy = rows[HL], lc = [x0 + .18 + 1.0, hy, .02], lr = .23;
    for (j = 0, n = Math.round(M * .07); j < n; j++){ var a = rand() * TAU; place([lc[0] + Math.cos(a) * lr + gauss() * .005, lc[1] + Math.sin(a) * lr + gauss() * .005, lc[2]], 0); }
    var hs = [lc[0] + lr * .72, lc[1] - lr * .72, lc[2]], he = [hs[0] + .22, hs[1] - .22, lc[2]];
    for (j = 0, n = Math.round(M * .025); j < n; j++){ var p2 = lerp3(hs, he, rand()); place([p2[0] + gauss() * .014, p2[1] + gauss() * .014, p2[2]], 0); }
    for (j = 0, n = Math.round(M * .06); j < n; j++){ var u2 = rand(), bx = lc[0] + lr + u2 * 2.6; place([bx, hy + u2 * u2 * .35 + gauss() * .004, u2 * .3], W(u2, true)); }
    while (b.room() > M * .02){ b.put([(rand() - .5) * 4.4, (rand() - .5) * 3.4, (rand() - .5) * 2.6 - .4], 0); }
    return b.done(stars);
  }

  function sceneShield(stars){
    var b = new Builder();
    var t = (1 + Math.sqrt(5)) / 2;
    var V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    function norm(p){ var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }
    var verts = V.map(norm), cache = {}, faces = [];
    function mid(i, j){ var key = i < j ? i + '_' + j : j + '_' + i; if (cache[key] === undefined){ cache[key] = verts.length; verts.push(norm(lerp3(verts[i], verts[j], .5))); } return cache[key]; }
    Fc.forEach(function(f){ var a = mid(f[0], f[1]), c = mid(f[1], f[2]), d = mid(f[2], f[0]); faces.push([f[0], a, d], [f[1], c, a], [f[2], d, c], [a, c, d]); });
    var edges = {}, list = [];
    faces.forEach(function(f){ [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function(e){ var k = Math.min(e[0], e[1]) + '_' + Math.max(e[0], e[1]); if (!edges[k]){ edges[k] = 1; list.push(e); } }); });
    var R = 1.38, per = Math.max(1, Math.round(M * .42 / list.length));
    list.forEach(function(e){ var live = rand() < .3; for (var j = 0; j < per; j++){ var u = rand(), p = norm(lerp3(verts[e[0]], verts[e[1]], u)), k = R + gauss() * .005; b.put([p[0] * k, p[1] * k, p[2] * k], W(live ? u : 0, false)); } });
    var pv = Math.round(M * .07 / verts.length);
    verts.forEach(function(v){ b.ball([v[0] * R, v[1] * R, v[2] * R], .028, pv, true); });
    b.shell([0, 0, 0], .5, Math.round(M * .17), .015, false);
    b.ball([0, 0, 0], .16, Math.round(M * .035), true);
    b.shell([0, 0, 0], 1.95, Math.round(M * .09), .14, false);
    return b.done(stars);
  }

  function sceneMark(stars){
    var b = new Builder();
    var S = 320, cA = document.createElement('canvas'), cB = document.createElement('canvas');
    cA.width = cA.height = cB.width = cB.height = S;
    var A = cA.getContext('2d'), B = cB.getContext('2d');
    [A, B].forEach(function(g){ g.scale(S / 64, S / 64); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff'; });
    A.lineWidth = 1.6; A.stroke(new Path2D('M17 15h24l7 7v26H17z')); A.stroke(new Path2D('M41 15v8h8'));
    A.lineWidth = 2; A.stroke(new Path2D('M23 28h15M23 35h10'));
    B.lineWidth = 1.8; B.stroke(new Path2D('M47 42a9 9 0 1 1-18 0a9 9 0 1 1 18 0'));
    B.lineWidth = 3.4; B.stroke(new Path2D('M44.5 48.5 51 55'));
    B.lineWidth = 1.8; B.stroke(new Path2D('m34.5 42 2.5 2.5 5-6'));
    function pixels(g){ var d = g.getImageData(0, 0, S, S).data, out = []; for (var y = 0; y < S; y += 1) for (var x = 0; x < S; x += 1) if (d[(y * S + x) * 4 + 3] > 110) out.push([x, y]); return out; }
    var pa = pixels(A), pb = pixels(B), sc = 2.05 / S;
    function emit(list, count, hl){ for (var j = 0; j < count && list.length; j++){ var q = list[Math.floor(rand() * list.length)]; b.put([(q[0] + rand() - S / 2) * sc, -(q[1] + rand() - S / 2) * sc, gauss() * .02], W(hl ? (q[0] / S) : 0, hl)); } }
    emit(pa, Math.round(M * .5), false);
    emit(pb, Math.round(M * .3), true);
    while (b.room() > M * .02){ var d = dir(), r = 1.6 + Math.abs(gauss()) * 1.4; b.put([d[0] * r, d[1] * r * .7, d[2] * r * .6 - .6], 0); }
    return b.done(stars);
  }

  /* per-scene camera: tilt, spin speed, face-front lock, distance, screen shift */
  var CAM = [
    {rx: .2, spin: .1, lock: 0, dist: 5.1, sx: .26, sy: .02},
    {rx: .12, spin: .045, lock: 0, dist: 4.7, sx: .3, sy: 0},
    {rx: .1, spin: 0, lock: .9, dist: 4.6, sx: .3, sy: 0},
    {rx: .4, spin: .07, lock: 0, dist: 5.6, sx: .3, sy: 0},
    {rx: .04, spin: 0, lock: .85, dist: 5.6, sx: .2, sy: .04},
    {rx: .05, spin: 0, lock: 1, dist: 4.4, sx: -.34, sy: 0},
    {rx: .22, spin: .12, lock: 0, dist: 4.7, sx: .32, sy: 0},
    {rx: 0, spin: 0, lock: 1, dist: 4.6, sx: .3, sy: .04}
  ];
  if (small) CAM.forEach(function(c){ c.sx = 0; c.sy = .42; c.dist += .4; });

  /* ---------- WebGL ---------- */
  var canvas = document.querySelector('.field');
  var gl = null;
  try { gl = canvas.getContext('webgl', {alpha: false, antialias: false, depth: false, powerPreference: 'high-performance'}); } catch (e) { gl = null; }

  var VS = [
    'attribute vec4 aFrom;attribute vec4 aTo;attribute vec4 aSeed;',
    'uniform float uMix,uTime,uAspect,uDist,uPx,uMorph,uDrift;uniform vec2 uShift,uRot,uPointer;',
    'varying vec3 vCol;varying float vA;',
    'vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}',
    'vec3 rotX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}',
    'float pulse(float w){float fp=fract(w);if(fp<0.001)return 0.0;float x=fract(fp-uTime*0.16);return smoothstep(0.0,0.03,x)*(1.0-smoothstep(0.03,0.13,x));}',
    'void main(){',
    ' float t=clamp(uMix*1.5-aSeed.w*0.5,0.0,1.0);t=t*t*(3.0-2.0*t);',
    ' float star=step(aFrom.w,-0.5);',
    ' vec3 p=mix(aFrom.xyz,aTo.xyz,t);',
    ' p+=aSeed.xyz*sin(3.14159*t)*uMorph*(1.0-star);',
    ' p+=0.016*uDrift*vec3(sin(uTime*0.7+aSeed.x*40.0),sin(uTime*0.6+aSeed.y*40.0),sin(uTime*0.8+aSeed.z*40.0));',
    ' float hl=(1.0-star)*mix(step(1.5,aFrom.w),step(1.5,aTo.w),t);',
    ' float pu=(1.0-star)*mix(pulse(aFrom.w),pulse(aTo.w),t);',
    ' if(star>0.5){p=rotY(p,uPointer.x*0.06);p=rotX(p,uPointer.y*0.04);}else{p=rotY(p,uRot.y);p=rotX(p,uRot.x);}',
    ' float depth=uDist-p.z;',
    ' if(depth<0.35){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;vCol=vec3(0.0);vA=0.0;return;}',
    ' float f=2.1/depth*min(1.0,uAspect*1.3);',
    ' gl_Position=vec4(p.x*f/uAspect+uShift.x,p.y*f+uShift.y,0.0,1.0);',
    ' float size=uPx*(0.55+aSeed.w*0.95)*(1.0+hl*0.55+pu*1.6)/depth;',
    ' if(star>0.5)size=uPx*(0.6+aSeed.w*1.2)/depth*1.6;',
    ' gl_PointSize=max(size,1.0);',
    ' vec3 cool=mix(vec3(0.40,0.53,1.0),vec3(0.88,0.93,1.0),aSeed.w);',
    ' vCol=mix(cool,vec3(1.0,0.70,0.40),hl)+vec3(1.0,0.86,0.66)*pu;',
    ' float fade=clamp(1.45-(depth-uDist)*0.42,0.18,1.0);',
    ' vA=(star>0.5?0.5:(0.62+hl*0.3))*fade;',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float;varying vec3 vCol;varying float vA;',
    'void main(){vec2 d=gl_PointCoord-0.5;float r2=dot(d,d)*4.0;if(r2>1.0)discard;',
    ' float a=(exp(-r2*5.5)*0.92+exp(-r2*1.6)*0.1)*(1.0-r2);',
    ' gl_FragColor=vec4(vCol*a*vA,1.0);}'
  ].join('\n');

  function compile(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

  var prog, U = {}, bufFrom, bufTo, scenes = [], intro = null;
  function initGL(){
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['uMix', 'uTime', 'uAspect', 'uDist', 'uPx', 'uMorph', 'uDrift', 'uShift', 'uRot', 'uPointer'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
    var seeds = new Float32Array(N * 4);
    for (var i = 0; i < N; i++){ var d = dir(), r = .4 + rand() * .8; seeds[i * 4] = d[0] * r; seeds[i * 4 + 1] = d[1] * r; seeds[i * 4 + 2] = d[2] * r; seeds[i * 4 + 3] = rand(); }
    function attr(name, data, usage){ var buf = gl.createBuffer(), loc = gl.getAttribLocation(prog, name); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, usage); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); return buf; }
    attr('aSeed', seeds, gl.STATIC_DRAW);
    bufFrom = attr('aFrom', scenes[0], gl.DYNAMIC_DRAW);
    bufTo = attr('aTo', scenes[0], gl.DYNAMIC_DRAW);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(4 / 255, 6 / 255, 11 / 255, 1);
  }
  var loadedPair = '';
  function upload(a, b, key){
    if (key === loadedPair) return;
    loadedPair = key;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufFrom); gl.bufferSubData(gl.ARRAY_BUFFER, 0, a);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufTo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b);
  }

  var DPR = 1, CW = 1, CH = 1;
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
    CW = window.innerWidth; CH = window.innerHeight;
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    measure();
  }

  /* ---------- scroll → scene progress ---------- */
  var chapters = [].slice.call(document.querySelectorAll('.chapter'));
  var anchors = [];
  function measure(){
    var vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
    anchors = chapters.map(function(el, i){
      var top = el.getBoundingClientRect().top + window.scrollY;
      var a = i === 0 ? 0 : top + el.offsetHeight / 2 - vh / 2;
      return Math.max(0, Math.min(max, a));
    });
  }
  function smooth(e0, e1, x){ var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  function targetProgress(){
    var y = window.scrollY, last = anchors.length - 1;
    if (y <= anchors[0]) return 0;
    if (y >= anchors[last]) return last;
    for (var k = 0; k < last; k++){
      if (y < anchors[k + 1]){ var f = (y - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]); return k + smooth(.12, .88, f); }
    }
    return last;
  }

  /* ---------- UI state ---------- */
  var railItems = [].slice.call(document.querySelectorAll('.rail li'));
  var navLinks = [].slice.call(document.querySelectorAll('.nav-pill a'));
  var navMap = {0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 3, 7: 3};
  var progressBar = document.querySelector('.progress i');
  var layerSection = document.getElementById('architecture');
  var layerItems = [].slice.call(document.querySelectorAll('.layers li'));
  var current = -1;
  function setCurrent(k){
    if (k === current) return;
    current = k;
    railItems.forEach(function(li, i){ li.classList.toggle('on', i === k); });
    navLinks.forEach(function(a, i){ a.classList.toggle('on', navMap[k] === i); });
    body.classList.toggle('side-right', chapters[k] && chapters[k].classList.contains('chapter-right'));
  }
  function onScroll(){
    var y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.setProperty('--p', (y / max).toFixed(4));
    body.classList.toggle('at-top', y < 40);
    var r = layerSection.getBoundingClientRect(), vh = window.innerHeight;
    var local = (vh * .7 - r.top) / Math.max(1, r.height * .7);
    var lit = Math.floor(local * 5);
    layerItems.forEach(function(li, i){ li.classList.toggle('on', i < lit); });
    target = targetProgress();
    setCurrent(Math.round(target));
  }

  var io = new IntersectionObserver(function(entries){ entries.forEach(function(e){ if (e.isIntersecting) e.target.classList.add('in'); }); }, {threshold: .22});
  chapters.forEach(function(c){ io.observe(c); });

  /* ---------- motion toggle & pointer ---------- */
  var paused = reduce;
  var ptr = [0, 0], ptrGoal = [0, 0];
  if (!reduce && window.matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove', function(e){ ptrGoal[0] = e.clientX / window.innerWidth * 2 - 1; ptrGoal[1] = e.clientY / window.innerHeight * 2 - 1; }, {passive: true});
  }

  /* ---------- loop ---------- */
  var target = 0, prog_ = 0, clock = 0, last = 0, spinAcc = .6;
  function camAt(p){
    var i = Math.max(0, Math.min(CAM.length - 1, Math.floor(p))), j = Math.min(CAM.length - 1, i + 1), f = p - i, a = CAM[i], b = CAM[j], o = {};
    for (var k in a) o[k] = a[k] + (b[k] - a[k]) * f;
    return o;
  }
  function frame(now){
    requestAnimationFrame(frame);
    if (document.hidden) { last = 0; return; }
    var dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
    if (!paused) clock += dt;
    prog_ += (target - prog_) * (reduce ? 1 : 1 - Math.exp(-dt * 3.2));
    if (Math.abs(target - prog_) < 1e-4) prog_ = target;
    ptr[0] += (ptrGoal[0] - ptr[0]) * (1 - Math.exp(-dt * 2.5));
    ptr[1] += (ptrGoal[1] - ptr[1]) * (1 - Math.exp(-dt * 2.5));

    var cam = camAt(prog_);
    if (!paused) spinAcc += dt * cam.spin * (1 - cam.lock);
    if (cam.lock > 0){ var goal = Math.round(spinAcc / TAU) * TAU; spinAcc += (goal - spinAcc) * Math.min(1, cam.lock * dt * 2.2); }
    var sway = paused ? 0 : Math.sin(clock * .35) * .07 * cam.lock;

    var last_ = scenes.length - 1, i = Math.min(last_ - 1, Math.floor(prog_)), mix = Math.min(1, prog_ - i);
    if (intro){
      var it = Math.min(1, (now - intro.t0) / intro.dur);
      upload(intro.from, scenes[0], 'intro');
      mix = 1 - Math.pow(1 - it, 3);
      if (it >= 1 && prog_ < .001) intro = null;
      else if (it >= 1) { intro = null; }
    } else {
      upload(scenes[i], scenes[i + 1], i + '>' + (i + 1));
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uTime, clock);
    gl.uniform1f(U.uAspect, CW / CH);
    gl.uniform1f(U.uDist, cam.dist);
    gl.uniform1f(U.uPx, 9.5 * DPR * Math.max(.8, Math.min(1.3, CH / 900)) * (small ? 1.15 : 1));
    gl.uniform1f(U.uMorph, reduce ? 0 : (intro ? .9 : .5));
    gl.uniform1f(U.uDrift, reduce ? 0 : 1);
    gl.uniform2f(U.uShift, cam.sx + ptr[0] * .012, cam.sy - ptr[1] * .012);
    gl.uniform2f(U.uRot, cam.rx + ptr[1] * .1, spinAcc + sway + ptr[0] * .16);
    gl.uniform2f(U.uPointer, ptr[0], ptr[1]);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  /* ---------- boot ---------- */
  var count = document.querySelector('.loader-count'), bar = document.querySelector('.loader-bar i');
  var bootStart = performance.now(), ready = false;
  function tickLoader(now){
    var p = Math.min(1, (now - bootStart) / (reduce ? 300 : 1300));
    if (!ready) p = Math.min(p, .9);
    count.textContent = String(Math.round(p * 100)).padStart(3, '0');
    bar.style.setProperty('--load', p.toFixed(3));
    if (p >= 1){ finishLoad(); return; }
    requestAnimationFrame(tickLoader);
  }
  function finishLoad(){
    body.classList.remove('is-loading');
    body.classList.add('loaded');
    chapters[0].classList.add('in');
    if (gl && !reduce) intro = {from: scenes.nebula, t0: performance.now(), dur: 2600};
  }
  requestAnimationFrame(tickLoader);

  window.addEventListener('resize', function(){ resize(); onScroll(); });
  window.addEventListener('scroll', onScroll, {passive: true});
  window.addEventListener('load', function(){ measure(); onScroll(); });

  setTimeout(function(){
    try {
      if (!gl) throw new Error('WebGL unavailable');
      var stars = starField();
      scenes = [sceneCore(stars), sceneFragments(stars), sceneChannels(stars), sceneLayers(stars), sceneRouting(stars), sceneEvidence(stars), sceneShield(stars), sceneMark(stars)];
      scenes.nebula = nebula(stars);
      initGL();
      resize(); onScroll();
      prog_ = target;
      requestAnimationFrame(frame);
    } catch (err) {
      root.classList.add('no-webgl');
      resize(); onScroll();
      if (window.console) console.warn('Baosu field disabled:', err && err.message);
    }
    ready = true;
  }, 30);
})();
