/* Watercolour painting engine: every illustration is generated as SVG,
   glazed with displacement, pigment-edge and granulation filters. */
(function () {
  const W = 1200, H = 750;
  let PID = 'p';
  const f1 = n => Math.round(n * 10) / 10;
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = rng(1);

  const C = {
    orange: '#cf4f2c', orange2: '#e0703f', rose: '#e58f80', blush: '#f2c1b0',
    gold: '#eab54e', ochre: '#c98e3c', sienna: '#a9552f', brown: '#7d5137', sepia: '#56412f',
    sky: '#93bdd8', cerulean: '#5a92bb', ultra: '#3d5899', indigo: '#28304f', payne: '#46525f',
    sap: '#86a85a', olive: '#7d8a45', viridian: '#4e8a78', teal: '#37868c',
    purple: '#76489a', lav: '#b6a4d2', plum: '#7c3d5c', crimson: '#b23a3a',
    skin: '#f1c6a3', cheek: '#e99a84', hair: '#5b3a26', hairL: '#8a5a33',
    silver: '#a9b3bc', white: '#fffdf8', ink: '#3a2f2a', paper: '#fbf8f1'
  };

  /* ---------- geometry ---------- */
  function smooth(pts, closed = true) {
    const n = pts.length;
    const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return closed ? d + 'Z' : d;
  }
  function blob(cx, cy, rx, ry, j = 0.12, n = 11) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, k = 1 + (rnd() - 0.5) * 2 * j;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts);
  }
  // A filled band whose top edge runs through pts and whose bottom is at `bottom`.
  function band(pts, bottom = H + 60) {
    const d = smooth(pts, false);
    return d + `L${f1(pts[pts.length - 1][0])},${bottom}L${f1(pts[0][0])},${bottom}Z`;
  }
  function ridge(y, amp, step = 90, x0 = -60, x1 = W + 60) {
    const pts = [];
    for (let x = x0; x <= x1 + 1; x += step) pts.push([x, y - rnd() * amp]);
    return band(pts);
  }
  const rect = (x, y, w, h) => `M${f1(x)},${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
  // slightly hand-drawn rectangle
  function hrect(x, y, w, h, j = 2) {
    const r = () => (rnd() - 0.5) * j * 2;
    return `M${f1(x + r())},${f1(y + r())}L${f1(x + w + r())},${f1(y + r())}L${f1(x + w + r())},${f1(y + h + r())}L${f1(x + r())},${f1(y + h + r())}Z`;
  }
  const poly = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join('L') + 'Z';

  /* ---------- paint primitives ---------- */
  const F = n => `filter="url(#${PID}-${n})"`;
  const wash = (d, c, o = 0.8, f = 'wc') => `<path d="${d}" fill="${c}" fill-opacity="${o}" ${f ? F(f) : ''}/>`;
  const fig = (d, c, o = 0.92) => `<path d="${d}" fill="${c}" fill-opacity="${o}" ${F('fig')}/>`;
  const line = (d, c = C.ink, w = 2, o = 0.75, f = 'ink') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${o}" ${f ? F(f) : ''}/>`;
  const circ = (x, y, r, c, o = 0.85, f = 'wc') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${c}" fill-opacity="${o}" ${f ? F(f) : ''}/>`;
  const glow = (x, y, r, c, o = 0.7) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#${PID}-glow-${c.slice(1)})" opacity="${o}"/>`;
  const grad = new Set();
  function glowFill(c) { grad.add(c); }
  function glowAt(x, y, r, c, o = 0.7) { glowFill(c); return glow(x, y, r, c, o); }
  // soft blooms of colour, wet-in-wet
  function blooms(n, box, colors, rmin, rmax, o = 0.25) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = colors[Math.floor(rnd() * colors.length)];
      s += wash(blob(box[0] + rnd() * box[2], box[1] + rnd() * box[3], rmin + rnd() * (rmax - rmin), (rmin + rnd() * (rmax - rmin)) * 0.7, 0.25), c, o * (0.6 + rnd() * 0.6), 'soft');
    }
    return s;
  }
  let gradDefs = '';
  function lin(id, stops, x2 = 0, y2 = 1) {
    gradDefs += `<linearGradient id="${PID}-${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((s, i) => `<stop offset="${s[1] ?? i / (stops.length - 1)}" stop-color="${s[0]}" stop-opacity="${s[2] ?? 1}"/>`).join('')}</linearGradient>`;
    return `url(#${PID}-${id})`;
  }
  function brushStrokes(n, box, c, o = 0.35, len = [40, 160], w = [2, 5]) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = box[0] + rnd() * box[2], y = box[1] + rnd() * box[3], l = len[0] + rnd() * (len[1] - len[0]);
      s += `<path d="M${f1(x)},${f1(y)}q${f1(l / 2)},${f1((rnd() - 0.5) * 6)} ${f1(l)},0" stroke="${c}" stroke-width="${f1(w[0] + rnd() * (w[1] - w[0]))}" stroke-linecap="round" fill="none" stroke-opacity="${f1(o * (0.5 + rnd()))}" ${F('soft')}/>`;
    }
    return s;
  }

  function defs() {
    let g = '';
    grad.forEach(c => { g += `<radialGradient id="${PID}-glow-${c.slice(1)}"><stop offset="0" stop-color="${c}" stop-opacity="1"/><stop offset=".35" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; });
    return `<defs>
<filter id="${PID}-wc" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="${Math.floor(rnd() * 99)}" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="11" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feMorphology in="d" operator="erode" radius="2.2" result="er"/>
 <feComposite in="d" in2="er" operator="out" result="rim"/>
 <feGaussianBlur in="rim" stdDeviation="0.9" result="rimb"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4" result="g"/>
 <feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.25" result="ga"/>
 <feComposite in="d" in2="ga" operator="in" result="dg"/>
 <feMerge><feMergeNode in="dg"/><feMergeNode in="rimb"/><feMergeNode in="rimb"/></feMerge>
</filter>
<filter id="${PID}-soft" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feGaussianBlur in="d" stdDeviation="5"/>
</filter>
<filter id="${PID}-fig" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feMorphology in="d" operator="erode" radius="1.3" result="er"/>
 <feComposite in="d" in2="er" operator="out" result="rim"/>
 <feOffset in="d" dx="-5" dy="-4" result="off"/>
 <feComposite in="d" in2="off" operator="out" result="cres"/>
 <feFlood flood-color="#2b1d3a" flood-opacity=".28"/>
 <feComposite in2="cres" operator="in"/>
 <feGaussianBlur stdDeviation="1.6" result="shade"/>
 <feComposite in="shade" in2="d" operator="in" result="shadeIn"/>
 <feMorphology in="d" operator="dilate" radius="1.1" result="dil"/>
 <feComposite in="dil" in2="d" operator="out" result="ring"/>
 <feFlood flood-color="#4a3528" flood-opacity=".62"/>
 <feComposite in2="ring" operator="in" result="ln"/>
 <feDisplacementMap in="ln" in2="t" scale="2.5" xChannelSelector="G" yChannelSelector="R" result="lnw"/>
 <feMerge><feMergeNode in="d"/><feMergeNode in="rim"/><feMergeNode in="shadeIn"/><feMergeNode in="lnw"/></feMerge>
</filter>
<filter id="${PID}-ink" x="-10%" y="-10%" width="120%" height="120%">
 <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="5" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="${PID}-paper" x="0" y="0" width="100%" height="100%">
 <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" seed="2" result="n"/>
 <feDiffuseLighting in="n" lighting-color="#fff" surfaceScale="1.3" result="l"><feDistantLight azimuth="45" elevation="62"/></feDiffuseLighting>
</filter>
<filter id="${PID}-edge" x="-5%" y="-5%" width="110%" height="110%">
 <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="9" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="44" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feGaussianBlur in="d" stdDeviation="2.2"/>
</filter>
<mask id="${PID}-m"><rect width="${W}" height="${H}" fill="#000"/><rect x="34" y="30" width="${W - 68}" height="${H - 60}" rx="18" fill="#fff" ${F('edge')}/></mask>
${g}${gradDefs}
</defs>`;
  }

  const shadow = (x, y, r) => `<ellipse cx="${f1(x)}" cy="${f1(y + 2)}" rx="${f1(r)}" ry="${f1(r * .22)}" fill="#2b1d3a" fill-opacity=".22" ${F('soft')}/>`;
  /* ---------- figures (feet at x,y; local units; s = scale) ---------- */
  function face(x, y, r, opts = {}) {
    let s = fig(blob(x, y, r, r * 1.05, 0.04, 9), C.skin);
    s += circ(x - r * 0.45, y + r * 0.3, r * 0.22, C.cheek, 0.35, 'soft');
    s += circ(x + r * 0.45, y + r * 0.3, r * 0.22, C.cheek, 0.35, 'soft');
    s += circ(x - r * 0.33, y - r * 0.05, r * 0.09, C.ink, 0.85, null) + circ(x + r * 0.33, y - r * 0.05, r * 0.09, C.ink, 0.85, null);
    if (opts.mouth === 'o') s += circ(x, y + r * 0.45, r * 0.16, C.sienna, 0.8, null);
    else if (opts.mouth === 'worry') s += line(`M${x - r * 0.25},${y + r * 0.5}q${r * 0.25},${-r * 0.18} ${r * 0.5},0`, C.ink, 1.6, 0.8, null);
    else s += line(`M${x - r * 0.3},${y + r * 0.38}q${r * 0.3},${r * 0.3} ${r * 0.6},0`, C.ink, 1.6, 0.8, null);
    return s;
  }
  function daddy(x, y, s = 1, pose = 'worried', coat = '#566c8f') {
    let o = shadow(x, y, 40 * s) + `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig(hrect(-17, -92, 13, 90), C.indigo) + fig(hrect(4, -92, 13, 90), C.indigo);
    o += fig(blob(-12, -2, 13, 6, 0.1, 7), C.sepia) + fig(blob(12, -2, 13, 6, 0.1, 7), C.sepia);
    o += fig('M-28,-176C-34,-140 -36,-110 -36,-84L36,-84C36,-110 34,-140 28,-176C14,-182 -14,-182 -28,-176Z', coat);
    o += line('M0,-176L0,-90', C.ink, 1.3, 0.4);
    o += fig('M-9,-178L0,-160L9,-178Z', C.white);
    if (pose === 'worried') {
      o += fig('M-26,-172C-40,-150 -40,-130 -34,-122C-30,-140 -24,-165 -15,-188L-22,-192Z', coat);
      o += fig('M26,-172C40,-150 40,-130 34,-122C30,-140 24,-165 15,-188L22,-192Z', coat);
    } else if (pose === 'wave') {
      o += fig('M-26,-172C-34,-150 -36,-122 -34,-100L-26,-100C-26,-125 -22,-150 -18,-170Z', coat);
      o += fig('M26,-172C40,-180 48,-205 50,-225L42,-228C38,-210 32,-192 20,-178Z', coat) + fig(blob(47, -232, 7, 7, .1, 7), C.skin);
    } else if (pose === 'row') {
      o += fig('M-26,-172C-36,-160 -44,-140 -52,-128L-44,-122C-36,-136 -28,-150 -18,-164Z', coat);
      o += fig('M26,-172C36,-160 44,-140 52,-128L44,-122C36,-136 28,-150 18,-164Z', coat);
    } else {
      o += fig('M-26,-172C-34,-150 -36,-122 -34,-100L-26,-100C-26,-125 -22,-150 -18,-170Z', coat);
      o += fig('M26,-172C34,-150 36,-122 34,-100L26,-100C26,-125 22,-150 18,-170Z', coat);
    }
    o += face(0, -197, 19, { mouth: pose === 'worried' ? 'o' : '' });
    o += fig('M-19,-200C-22,-222 -8,-226 2,-224C14,-224 22,-216 19,-198C14,-208 4,-212 -6,-210C-12,-208 -16,-205 -19,-200Z', C.hair);
    if (pose === 'worried') o += fig(blob(-19, -188, 6, 6, .1, 7), C.skin) + fig(blob(19, -188, 6, 6, .1, 7), C.skin);
    if (pose === 'worried') o += line('M-12,-212q4,-4 8,-1M4,-213q4,-3 8,1', C.ink, 1.4, .7, null);
    return o + '</g>';
  }
  function oscar(x, y, s = 1, pose = 'stand', ball = true) {
    let o = shadow(x, y, 30 * s) + `<g transform="translate(${x},${y}) scale(${s})">`;
    if (pose === 'kick') {
      o += fig('M-10,-48L-14,-4L-4,-4L0,-46Z', C.skin) + fig('M4,-48C14,-40 26,-34 40,-34L40,-26C24,-24 10,-30 -2,-40Z', C.skin);
      o += fig(blob(-9, -2, 10, 5, .1, 7), C.crimson) + fig(blob(44, -30, 9, 6, .1, 7), C.crimson);
    } else {
      o += fig(hrect(-12, -48, 9, 46, 1), C.skin) + fig(hrect(3, -48, 9, 46, 1), C.skin);
      o += fig(hrect(-13, -20, 11, 16, 1), C.white) + fig(hrect(2, -20, 11, 16, 1), C.white);
      o += fig(blob(-8, -2, 10, 5, .1, 7), C.crimson) + fig(blob(8, -2, 10, 5, .1, 7), C.crimson);
    }
    o += fig(hrect(-16, -70, 32, 24, 1.5), C.indigo);
    o += fig('M-19,-114C-22,-100 -20,-82 -17,-68L17,-68C20,-82 22,-100 19,-114C8,-120 -8,-120 -19,-114Z', C.cerulean);
    o += fig(hrect(-5, -116, 10, 47, 0.5), C.white, 0.9);
    if (pose === 'cheer') {
      o += fig('M-17,-112C-28,-122 -32,-140 -32,-152L-24,-154C-24,-142 -20,-126 -12,-116Z', C.cerulean) + fig(blob(-29, -158, 6, 6, .1, 7), C.skin);
      o += fig('M17,-112C28,-122 32,-140 32,-152L24,-154C24,-142 20,-126 12,-116Z', C.cerulean) + fig(blob(29, -158, 6, 6, .1, 7), C.skin);
    } else if (pose === 'point') {
      o += fig('M-17,-112C-22,-96 -24,-84 -24,-72L-17,-72C-17,-84 -15,-96 -12,-110Z', C.cerulean);
      o += fig('M17,-112C30,-112 42,-118 52,-124L54,-117C42,-110 30,-104 15,-104Z', C.cerulean) + fig(blob(56, -121, 6, 5, .1, 7), C.skin);
    } else {
      o += fig('M-17,-112C-22,-96 -24,-84 -24,-72L-17,-72C-17,-84 -15,-96 -12,-110Z', C.cerulean) + fig(blob(-21, -70, 5, 5, .1, 7), C.skin);
      o += fig('M17,-112C22,-96 24,-84 24,-72L17,-72C17,-84 15,-96 12,-110Z', C.cerulean) + fig(blob(21, -70, 5, 5, .1, 7), C.skin);
    }
    o += face(0, -134, 16, { mouth: pose === 'cheer' ? 'o' : '' });
    o += fig('M-17,-136C-19,-156 -6,-158 2,-156C12,-156 19,-150 17,-134C12,-143 5,-146 -2,-144C-8,-148 -12,-142 -17,-136Z', C.hairL);
    o += '</g>';
    if (ball) o += football(pose === 'kick' ? x + 70 * s : x + 30 * s, pose === 'kick' ? y - 50 * s : y - 9 * s, 10 * s);
    return o;
  }
  function football(x, y, r) {
    let o = circ(x, y, r, C.white, 0.98, 'fig');
    o += `<path d="${poly([[x, y - r * .35], [x + r * .33, y - r * .1], [x + r * .2, y + r * .3], [x - r * .2, y + r * .3], [x - r * .33, y - r * .1]])}" fill="${C.ink}" fill-opacity=".8"/>`;
    return o;
  }
  function samuel(x, y, s = 1, pose = 'sword', roary = false) {
    let o = shadow(x, y, 28 * s) + `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig('M-16,-74C-30,-50 -32,-26 -30,-14L30,-14C30,-30 26,-56 14,-74Z', C.crimson, 0.85);
    o += fig(hrect(-10, -34, 8, 32, 1), C.payne) + fig(hrect(2, -34, 8, 32, 1), C.payne);
    o += fig(blob(-7, -2, 9, 5, .1, 7), C.sepia) + fig(blob(7, -2, 9, 5, .1, 7), C.sepia);
    o += fig('M-15,-78C-18,-62 -18,-44 -15,-30L15,-30C18,-44 18,-62 15,-78C6,-83 -6,-83 -15,-78Z', C.white);
    o += fig('M-3,-74h6v14h9v6h-9v20h-6v-20h-9v-6h9Z', C.crimson);
    if (pose === 'sword') {
      o += fig('M14,-76C24,-86 28,-98 30,-108L23,-110C21,-100 16,-90 8,-80Z', C.white) + fig(blob(27, -112, 5, 5, .1, 7), C.skin);
      o += fig('M25,-116L36,-170L41,-169L31,-115Z', C.ochre) + fig('M17,-120L39,-114L40,-109L18,-115Z', C.brown);
      o += fig('M-14,-76C-20,-66 -22,-56 -22,-48L-15,-48C-15,-56 -13,-64 -9,-72Z', C.white) + fig(blob(-19, -46, 4.5, 4.5, .1, 7), C.skin);
    } else if (pose === 'cheer') {
      o += fig('M-14,-76C-24,-86 -27,-98 -28,-110L-21,-111C-20,-100 -16,-90 -8,-80Z', C.white) + fig(blob(-25, -114, 5, 5, .1, 7), C.skin);
      o += fig('M14,-76C24,-86 27,-98 28,-110L21,-111C20,-100 16,-90 8,-80Z', C.white) + fig(blob(25, -114, 5, 5, .1, 7), C.skin);
    } else {
      o += fig('M-14,-76C-20,-66 -22,-56 -22,-48L-15,-48C-15,-56 -13,-64 -9,-72Z', C.white) + fig(blob(-19, -46, 4.5, 4.5, .1, 7), C.skin);
      o += fig('M14,-76C20,-66 22,-56 22,-48L15,-48C15,-56 13,-64 9,-72Z', C.white) + fig(blob(19, -46, 4.5, 4.5, .1, 7), C.skin);
    }
    o += fig('M-19,-102C-27,-84 -26,-66 -19,-56C-14,-60 -12,-66 -12,-72L12,-72C12,-66 14,-60 19,-56C26,-66 27,-84 19,-102Z', '#e7c35f');
    o += face(0, -96, 15, { mouth: 'o' });
    o += fig('M-15,-100C-12,-92 -6,-95 -2,-98C2,-94 8,-93 15,-100L15,-104L-15,-104Z', '#e7c35f');
    // colander helmet
    o += fig('M-18,-99C-19,-122 -8,-128 0,-128C8,-128 19,-122 18,-99Z', C.silver);
    o += fig('M-22,-101h44v5h-44Z', '#8d98a3');
    for (let i = 0; i < 9; i++) o += circ(-12 + (i % 5) * 6 + (i > 4 ? 3 : 0), -118 + (i > 4 ? 9 : 0), 1.3, C.payne, 0.8, null);
    o += fig('M-4,-128q4,-9 8,0', 'none', 0) + line('M-5,-127q5,-10 10,0', C.payne, 2, .8, null);
    if (roary) o += dino(26, -2, 0.55, C.sap);
    return o + '</g>';
  }
  function dino(x, y, s = 1, c = C.sap) {
    let o = `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig('M-40,-30C-30,-44 -6,-46 6,-40C14,-58 22,-70 36,-70C48,-70 54,-62 52,-54C48,-50 40,-52 34,-50C30,-44 30,-36 26,-28C22,-20 14,-16 6,-16L6,0L-2,0L-2,-14L-14,-14L-14,0L-22,0L-22,-18C-34,-20 -48,-22 -62,-28C-52,-28 -46,-28 -40,-30Z', c);
    o += circ(40, -62, 2, C.ink, .9, null);
    return o + '</g>';
  }
  function pinch(x, y, s = 1) {
    let o = shadow(x, y, 56 * s) + `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig('M-24,-180C-36,-130 -44,-60 -50,0L50,0C44,-60 36,-130 24,-180C10,-188 -10,-188 -24,-180Z', C.purple);
    o += line('M0,-178L-4,0', C.ink, 1.3, .35);
    o += fig('M-24,-176C-36,-160 -48,-146 -58,-138L-52,-130C-40,-140 -28,-150 -16,-164Z', C.purple);
    o += fig('M24,-176C36,-168 48,-160 60,-158L60,-150C46,-150 32,-156 18,-164Z', C.purple);
    o += face(0, -200, 18, { mouth: 'worry' });
    o += fig('M-20,-204C-28,-214 -26,-226 -16,-222C-12,-232 12,-232 16,-222C26,-226 28,-214 20,-204C18,-212 12,-216 0,-216C-12,-216 -18,-212 -20,-204Z', '#d7d2c8');
    o += `<circle cx="-7" cy="-202" r="6" fill="none" stroke="${C.ink}" stroke-width="1.8"/><circle cx="7" cy="-202" r="6" fill="none" stroke="${C.ink}" stroke-width="1.8"/>`;
    o += fig(blob(0, -238, 22, 6, .05, 9), C.indigo) + fig('M-14,-240C-14,-262 14,-262 14,-240Z', C.indigo);
    return o + '</g>';
  }

  /* ---------- scenery ---------- */
  const deckY = 400;
  function cableY(t) { return (1 - t) * (1 - t) * 172 + 2 * (1 - t) * t * 598 + t * t * 172; }
  function goldenGate(mode = 'full', glowC = null) {
    if (mode === 'none') return '';
    const col = C.orange;
    let s = '';
    const ghost = mode === 'ghost';
    const op = ghost ? 0.0 : 0.92;
    if (ghost) {
      const st = `fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" stroke-opacity=".55" ${F('ink')}`;
      s += `<path d="M150,${deckY}L1060,${deckY}" ${st}/>`;
      s += `<path d="M180,395Q300,300 380,172Q605,598 830,172Q910,300 1030,395" ${st}/>`;
      [380, 830].forEach(t => { s += `<path d="M${t - 18},470L${t - 16},166L${t + 16},166L${t + 18},470" ${st}/>`; });
      return s;
    }
    if (glowC) s += glowAt(605, 300, 520, glowC, .35);
    [380, 830].forEach(t => {
      s += wash(hrect(t - 24, 168, 15, 312, 1), col, op) + wash(hrect(t + 9, 168, 15, 312, 1), col, op);
      [176, 222, 284, 350, 452].forEach((yy, i) => { s += wash(hrect(t - 22, yy, 44, i === 0 ? 14 : 9, 1), col, op); });
      s += wash(hrect(t - 25, 162, 50, 9, 1), C.sienna, .6);
    });
    s += `<path d="M180,395Q300,300 380,172Q605,598 830,172Q910,300 1030,395" fill="none" stroke="${C.sienna}" stroke-width="4.5" stroke-opacity=".9" ${F('ink')}/>`;
    let sus = '';
    for (let x = 395; x < 830; x += 18) { const t = (x - 380) / 450; sus += `M${x},${f1(cableY(t))}L${x},${deckY}`; }
    for (let x = 200; x < 370; x += 18) { const t = (x - 180) / 200; sus += `M${x},${f1(395 - (395 - 172) * t * t * 0.95)}L${x},${deckY}`; }
    for (let x = 845; x < 1020; x += 18) { const t = (1030 - x) / 200; sus += `M${x},${f1(395 - (395 - 172) * t * t * 0.95)}L${x},${deckY}`; }
    s += `<path d="${sus}" stroke="${col}" stroke-width="1.4" stroke-opacity=".7" ${F('ink')}/>`;
    s += wash(hrect(130, deckY - 3, 950, 12, 1), col, op);
    s += wash(hrect(130, deckY + 8, 950, 5, 1), C.sienna, .5);
    return s;
  }
  // Bay view composition (used full-frame or nested in windows)
  function bay(o = {}) {
    const t = o.time || 'day';
    const skies = {
      day: [['#b9d6ea'], ['#dcebf2'], ['#f6efe2']],
      morning: [['#a9cbe3'], ['#d8e8ef'], ['#f8e8d6']],
      night: [['#151c3a'], ['#2a3566'], ['#4a4c7a']],
      dusk: [['#4a4f8a'], ['#c9879a'], ['#f2b37e']],
      dawn: [['#7c86c4'], ['#f0a8a0'], ['#ffd9a0']]
    }[t];
    let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${lin('sky' + t, skies)}"/>`;
    if (t === 'day' || t === 'morning') s += blooms(7, [0, 20, W, 230], [C.sky, C.white, C.lav], 60, 160, 0.35);
    if (t === 'dawn') { s += glowAt(605, 330, 380, '#ffd27a', .9); s += blooms(8, [0, 60, W, 260], [C.rose, C.gold, C.lav], 70, 180, 0.4); }
    if (t === 'dusk') s += blooms(6, [0, 80, W, 260], [C.rose, C.plum, C.gold], 70, 170, 0.35);
    if (t === 'night') { s += stars(70, [0, 0, W, 330]); }
    if (o.moon) s += glowAt(o.moon[0], o.moon[1], 120, '#fff3cf', .55) + circ(o.moon[0], o.moon[1], 34, '#fbf1d2', .95, 'wc');
    const hillA = t === 'night' ? C.indigo : (t === 'dusk' ? C.plum : C.olive);
    const hillB = t === 'night' ? '#20284a' : (t === 'dusk' ? '#5a3a63' : C.sap);
    // far Marin hills
    s += wash(band([[-60, 330], [80, 250], [200, 230], [300, 300], [360, 360], [420, 420]]), hillB, .55);
    s += wash(band([[-60, 340], [60, 300], [180, 285], [280, 330], [330, 380], [400, 430]]), hillA, .6);
    s += wash(band([[820, 430], [900, 360], [980, 320], [1080, 300], [1180, 280], [1260, 300]]), hillB, .55);
    s += wash(band([[860, 440], [950, 380], [1040, 350], [1150, 340], [1260, 350]]), hillA, .55);
    // water
    const wc = t === 'night' ? [['#1d2650'], ['#2a3a6a']] : t === 'dawn' ? [['#e9a98f'], ['#7f97c2']] : t === 'dusk' ? [['#b38196'], ['#3f4f86']] : [['#7fb0cc'], ['#4f86ad']];
    s += wash(rect(-40, 425, W + 80, 400), lin('water' + t, wc), .9, 'soft');
    s += brushStrokes(26, [0, 440, W, 300], t === 'night' ? '#8f9bd0' : C.white, .35, [50, 200], [2, 4]);
    if (o.moon) s += brushStrokes(14, [o.moon[0] - 70, 445, 140, 300], '#fbf1d2', .55, [20, 90], [3, 6]);
    if (t === 'dawn') s += brushStrokes(16, [520, 440, 170, 300], '#ffd27a', .6, [20, 90], [3, 7]);
    s += goldenGate(o.bridge || 'full', t === 'night' ? null : null);
    if (o.bridge === 'none' || o.bridge === 'ghost') {
      // truncated approach roads and an anxious queue of tiny cars
      s += wash(hrect(130, deckY - 3, 110, 10, 1), C.payne, .6) + wash(hrect(980, deckY - 3, 110, 10, 1), C.payne, .6);
      const cars = [C.crimson, C.gold, C.cerulean, C.white, C.sap, C.crimson];
      cars.forEach((c, i) => { s += wash(hrect(140 + i * 16, deckY - 10, 12, 7, .5), c, .9, 'fig'); s += wash(hrect(1074 - i * 16, deckY - 10, 12, 7, .5), cars[5 - i], .9, 'fig'); });
    }
    if (o.alcatraz) s += alcatraz(o.alcatraz[0], o.alcatraz[1], o.alcatraz[2] || 1, t === 'night');
    return s;
  }
  function stars(n, box) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = box[0] + rnd() * box[2], y = box[1] + rnd() * box[3], r = 0.8 + rnd() * 1.8;
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#fff6dc" opacity="${f1(0.5 + rnd() * 0.5)}"/>`;
    }
    return s;
  }
  function alcatraz(x, y, s = 1, night = false) {
    const rock = night ? '#0b0e22' : C.sepia, bld = night ? '#3b4270' : '#d8cdb8';
    let o = `<g transform="translate(${x},${y}) scale(${s})">`;
    o += wash('M-150,10C-120,-10 -90,-22 -40,-26C10,-30 70,-24 110,-12C130,-6 150,4 160,12Z', rock, .75);
    o += wash(hrect(-80, -62, 120, 40, 1), bld, .9) + wash(hrect(-60, -80, 70, 20, 1), bld, .85);
    o += wash(hrect(60, -110, 12, 86, 1), bld, .9) + wash('M56,-112L66,-128L76,-112Z', night ? '#262d52' : C.sienna, .9);
    if (night) {
      o += glowAt(66, -116, 30, '#ffe39a', .9);
      o += `<rect x="-38" y="-52" width="10" height="12" fill="#ffd36e"/>` + glowAt(-33, -46, 40, '#ffd36e', .8);
    } else {
      for (let i = 0; i < 6; i++) o += `<rect x="${-70 + i * 18}" y="-50" width="5" height="10" fill="${C.payne}" opacity=".6"/>`;
    }
    return o + '</g>';
  }
  function windowFrame(x, y, w, h, inner, wood = '#efe6d6') {
    const id = PID + '-win' + Math.floor(rnd() * 1e6);
    let s = `<clipPath id="${id}"><path d="${hrect(x, y, w, h, 1.5)}"/></clipPath>`;
    s += `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${inner}</svg></g>`;
    s += line(hrect(x, y, w, h, 1.5), wood, 14, .95, 'ink');
    s += line(`M${x + w / 2},${y}L${x + w / 2},${y + h}M${x},${y + h * 0.42}L${x + w},${y + h * 0.42}`, wood, 7, .9, 'ink');
    s += line(hrect(x - 7, y - 7, w + 14, h + 14, 1.5), C.ink, 1.5, .45);
    return s;
  }
  function curtain(x, y, w, h, c, side = 1) {
    let s = '';
    const folds = 5;
    for (let i = 0; i < folds; i++) {
      const xi = x + (w / folds) * i;
      s += wash(`M${xi},${y}C${xi + w / folds * .3},${y + h * .3} ${xi - w / folds * .2},${y + h * .7} ${xi + side * 6},${y + h}L${xi + w / folds + side * 6},${y + h}C${xi + w / folds * 1.1},${y + h * .6} ${xi + w / folds * .7},${y + h * .3} ${xi + w / folds},${y}Z`, c, .55 + (i % 2) * .2);
    }
    return s;
  }
  function room(wall = [['#f3d9b5'], ['#eec7a3']], floor = '#b57c52') {
    let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${C.paper}"/>`;
    s += wash(rect(-40, -40, W + 80, 640), lin('wall', wall), .85, 'soft');
    s += blooms(6, [0, 0, W, 560], [C.rose, C.gold, C.blush], 80, 200, .25);
    s += wash(band([[-60, 590], [300, 582], [700, 588], [1260, 580]]), floor, .7);
    s += brushStrokes(16, [0, 600, W, 150], C.sepia, .3, [80, 260], [2, 3]);
    return s;
  }
  function suitcase(x, y, w, h, c, open = false) {
    let s = '';
    if (open) s += wash(hrect(x + 4, y - h * .9, w - 8, h * .85, 3), c, .7) + wash(hrect(x + 14, y - h * .82, w - 28, h * .7, 2), C.white, .35);
    s += fig(`M${x},${y + 8}C${x - 4},${y + h * .6} ${x + 4},${y + h} ${x + 14},${y + h}L${x + w - 14},${y + h}C${x + w - 4},${y + h} ${x + w + 4},${y + h * .6} ${x + w},${y + 8}Z`, c);
    s += line(`M${x + 6},${y + 20}L${x + w - 6},${y + 20}`, C.ink, 1.5, .5);
    s += line(`M${x + w * .3},${y + 26}L${x + w * .3},${y + h - 6}M${x + w * .7},${y + 26}L${x + w * .7},${y + h - 6}`, C.ink, 1.2, .3);
    return s;
  }
  function laptop(x, y, w, screen) {
    const h = w * 0.62;
    let s = fig(hrect(x, y - h, w, h, 1.5), '#3d434c') + wash(hrect(x + 6, y - h + 6, w - 12, h - 14, 1), '#dfe8ef', .95, 'fig');
    s += screen;
    s += fig(`M${x - 18},${y}L${x + w + 18},${y}L${x + w + 8},${y + 10}L${x - 8},${y + 10}Z`, '#8a9099');
    return s;
  }
  function vhouse(x, y, w, h, c, trim = C.white) {
    let s = wash(hrect(x, y - h, w, h, 1.5), c, .85, 'fig');
    s += wash(poly([[x - 6, y - h], [x + w / 2, y - h - w * 0.45], [x + w + 6, y - h]]), trim === C.white ? C.sienna : trim, .8, 'fig');
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) s += wash(hrect(x + 10 + k * (w / 2 - 4), y - h + 16 + r * (h / 2.4), w / 2 - 22, h / 4, 1), trim, .85, null);
    s += wash(hrect(x + w * .35, y - h * .22, w * .3, h * .22, 1), C.sepia, .7, null);
    return s;
  }
  function lantern(x, y, r, c = C.crimson) {
    return glowAt(x, y, r * 3, '#ffcf6a', .5) + fig(blob(x, y, r, r * 1.15, .05, 9), c) + fig(hrect(x - r * .4, y - r * 1.25, r * .8, r * .25, .5), C.gold) + fig(hrect(x - r * .4, y + r * 1.05, r * .8, r * .25, .5), C.gold) + line(`M${x},${y + r * 1.3}L${x},${y + r * 1.9}`, C.gold, 1.5, .9, null);
  }
  function cookie(x, y, s = 1, rot = 0) {
    return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">` + fig('M-40,0C-40,-30 -10,-40 0,-20C10,-40 40,-30 40,0C30,14 10,10 0,4C-10,10 -30,14 -40,0Z', C.gold) + wash('M-30,-6C-26,-22 -10,-28 -2,-16', C.ochre, .5, 'soft') + '</g>';
  }
  function seaLion(x, y, s = 1, c = C.brown, flip = 1) {
    return `<g transform="translate(${x},${y}) scale(${s * flip},${s})">` +
      fig('M-60,0C-58,-26 -30,-40 0,-42C18,-60 34,-80 52,-80C66,-80 74,-70 72,-60C70,-52 60,-50 54,-48C52,-30 44,-12 30,0C40,6 50,8 56,4L50,14C34,16 20,10 10,6L-40,6C-50,10 -62,10 -72,4C-66,4 -62,2 -60,0Z', c) +
      circ(60, -68, 2.6, C.ink, .9, null) + line('M70,-60q8,-2 12,2M70,-58q8,2 12,6', C.ink, 1, .6, null) + '</g>';
  }
  function gull(x, y, s = 1) { return line(`M${x - 14 * s},${y}q${7 * s},${-8 * s} ${14 * s},0q${7 * s},${-8 * s} ${14 * s},0`, C.ink, 1.8, .7, null); }
  function rowboat(x, y, s = 1, c = C.sienna) {
    return `<g transform="translate(${x},${y}) scale(${s})">` + fig('M-110,-20L110,-20C100,0 80,14 60,16L-70,16C-90,12 -104,0 -110,-20Z', c) + line('M-104,-12L104,-12', C.gold, 2, .7) + '</g>';
  }
  function cabinet(x, y, w, h, inner) {
    let s = wash(hrect(x - 6, y + h, w + 12, 26, 1), C.sepia, .85, 'fig');
    s += inner;
    s += `<path d="${hrect(x, y, w, h, 1)}" fill="#cfe4ee" fill-opacity=".22" stroke="#e8f2f6" stroke-width="2" stroke-opacity=".7" ${F('ink')}/>`;
    s += `<path d="M${x + w * .2},${y + 10}L${x + w * .06},${y + h * .5}" stroke="#fff" stroke-width="5" stroke-opacity=".45" stroke-linecap="round" ${F('soft')}/>`;
    return s;
  }
  function bigBen(x, y, s = 1) {
    return `<g transform="translate(${x},${y}) scale(${s})">` + fig(hrect(-14, -150, 28, 150, 1), C.ochre) + fig(hrect(-17, -168, 34, 20, 1), C.ochre) + circ(0, -158, 8, C.white, .95, 'fig') + fig('M-17,-168L0,-205L17,-168Z', C.olive) + line('M0,-205L0,-218', C.ink, 1.5, .8) + '</g>';
  }
  function eiffel(x, y, s = 1) {
    return `<g transform="translate(${x},${y}) scale(${s})">` + fig('M-40,0C-24,-40 -10,-100 -4,-180L4,-180C10,-100 24,-40 40,0L26,0C18,-18 -18,-18 -26,0Z', '#8a6b4f') + fig(hrect(-22, -70, 44, 6, 1), '#6b513b') + line('M0,-180L0,-200', C.ink, 1.5, .8) + '</g>';
  }
  function pisa(x, y, s = 1) {
    let o = `<g transform="translate(${x},${y}) rotate(7) scale(${s})">` + fig(hrect(-20, -150, 40, 150, 1), '#f3eadb');
    for (let i = 1; i < 7; i++) o += line(`M-20,${-i * 21}L20,${-i * 21}`, C.sepia, 1.2, .5, null);
    return o + '</g>';
  }
  function cat(x, y, s = 1) {
    let o = `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig('M-160,0C-170,-120 -120,-240 0,-250C120,-240 170,-120 160,0Z', '#d98a45');
    o += fig('M-120,-200L-150,-330L-50,-240Z', '#d98a45') + fig('M120,-200L150,-330L50,-240Z', '#d98a45');
    o += fig('M-112,-215L-132,-295L-70,-240Z', C.blush, .7) + fig('M112,-215L132,-295L70,-240Z', C.blush, .7);
    o += fig(blob(-60, -150, 34, 24, .05, 9), '#e9d26a') + fig(blob(60, -150, 34, 24, .05, 9), '#e9d26a');
    o += fig(blob(-60, -150, 6, 20, .05, 9), C.ink) + fig(blob(60, -150, 6, 20, .05, 9), C.ink);
    o += fig('M-14,-100L14,-100L0,-86Z', C.rose);
    o += line('M-30,-90L-140,-110M-30,-82L-140,-80M30,-90L140,-110M30,-82L140,-80', C.ink, 1.6, .6);
    o += fig(blob(-120, -6, 60, 30, .08, 9), '#e39a58') + fig(blob(120, -6, 60, 30, .08, 9), '#e39a58');
    return o + '</g>';
  }
  function skeletonRex(x, y, s = 1) {
    const bone = '#f4ead6';
    let o = `<g transform="translate(${x},${y}) scale(${s})">`;
    o += line('M-110,-70C-60,-80 -10,-90 30,-96C60,-100 80,-110 96,-124', bone, 6, .95, 'ink');
    for (let i = 0; i < 9; i++) { const xx = -40 + i * 9; o += line(`M${xx},${-90 + i * -0.6}C${xx + 4},${-70} ${xx + 2},${-56} ${xx - 4},${-48}`, bone, 3.5, .95, 'ink'); }
    o += fig('M88,-120C96,-150 130,-156 150,-140C158,-132 156,-120 144,-118L120,-114C132,-110 140,-104 136,-98C120,-96 104,-100 92,-108Z', bone);
    o += circ(126, -136, 5, C.ink, .8, null);
    o += line('M-20,-76L-30,-30L-24,0M20,-86L10,-40L22,0M60,-104L70,-84', bone, 6, .95, 'ink');
    return o + '</g>';
  }
  function key(x, y, s = 1, rot = 0) {
    return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">` + glowAt(0, 0, 70, '#ffe7a0', .5) + `<circle cx="-40" cy="0" r="22" fill="none" stroke="${C.gold}" stroke-width="12" ${F('fig')}/>` + fig(hrect(-20, -6, 90, 12, 1), C.gold) + fig(hrect(50, 4, 10, 18, 1), C.gold) + fig(hrect(66, 4, 8, 14, 1), C.gold) + '</g>';
  }
  function cableCar(x, y, s = 1, rot = 0, riders = '') {
    let o = `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">`;
    o += fig(hrect(-150, -110, 300, 90, 2), '#8e2b2b');
    o += fig(hrect(-150, -70, 300, 18, 1), '#f0e1bf');
    o += fig('M-160,-110L160,-110L150,-128L-150,-128Z', '#5b2a26');
    for (let i = 0; i < 6; i++) o += wash(hrect(-138 + i * 48, -104, 36, 30, 1), '#f7e7b6', .9, null);
    o += fig(hrect(-160, -20, 320, 12, 1), C.sepia);
    o += circ(-100, -4, 12, C.ink, .8, 'fig') + circ(100, -4, 12, C.ink, .8, 'fig');
    o += `<text x="-40" y="-56" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="14" font-weight="700" fill="#5b2a26" letter-spacing="2">POWELL &amp; HYDE</text>` + riders;
    return o + '</g>';
  }
  function bigLou(x, y, s = 1) {
    let o = `<g transform="translate(${x},${y}) scale(${s})">`;
    o += fig('M-30,-170C-40,-130 -42,-100 -40,-80L40,-80C42,-100 40,-130 30,-170C14,-178 -14,-178 -30,-170Z', '#3d4a6b');
    o += face(0, -192, 21);
    o += fig('M-24,-180C-14,-176 -4,-184 0,-180C4,-184 14,-176 24,-180C18,-170 4,-172 0,-176C-4,-172 -18,-170 -24,-180Z', C.sepia);
    o += fig('M-24,-206L24,-206L20,-222L-20,-222Z', '#3d4a6b') + fig(hrect(-28, -208, 56, 5, 1), C.ink);
    return o + '</g>';
  }
  function plane(x, y, s = 1) {
    return `<g transform="translate(${x},${y}) scale(${s})">` + fig('M-40,0C-30,-6 30,-6 44,-2C48,0 44,4 40,4L-38,4Z', C.white) + fig('M-6,-2L-20,-22L-12,-22L10,-2Z', C.white) + fig('M-34,-2L-42,-14L-36,-14L-26,-2Z', C.white) + '</g>';
  }


  /* ---------- Oscar's maps ---------- */
  const SF = [[60, 790], [40, 600], [48, 420], [60, 330], [90, 300], [150, 285], [205, 282], [235, 278], [300, 268], [380, 276], [450, 282], [520, 276], [570, 270], [620, 285], [665, 292], [700, 282], [735, 290], [775, 315], [805, 350], [830, 395], [845, 440], [860, 500], [885, 560], [900, 640], [920, 790]];
  const MARIN = [[-40, -40], [470, -40], [470, 40], [430, 90], [380, 120], [330, 150], [290, 190], [255, 212], [215, 215], [160, 205], [100, 215], [40, 230], [-40, 240]];
  const EAST = [[1130, -40], [1240, -40], [1240, 790], [1100, 790], [1120, 500], [1110, 350], [1130, 200]];
  const P = {
    hotel: [735, 440], china: [775, 452], pier: [738, 296], lombard: [640, 352], coit: [780, 352],
    alc: [640, 192], gg: [229, 247], ferry: [838, 410], park: [260, 585], airport: [905, 790]
  };
  const ROUTES = {
    1: { pts: [[905, 790], [885, 660], [830, 540], [770, 476], [735, 440]], label: 'Taxi from the airport', at: [880, 600] },
    2: { pts: [P.hotel, P.gg], label: 'The view from Room 1937', at: [470, 330], dotted: true },
    3: { pts: [[735, 440], [768, 452], [760, 478], [722, 470], [735, 440]], label: 'Daddy’s dash to the gift shop', at: [560, 500] },
    4: { pts: [[735, 440], [700, 442], [672, 432], [660, 400], [655, 360], [650, 322], [646, 300]], label: 'Down Hyde Street by cable car', at: [470, 400] },
    5: { pts: [[646, 300], [690, 330], [735, 380], [760, 420], [775, 452]], label: 'Into Chinatown', at: [860, 470] },
    6: { pts: [[775, 452], [790, 410], [778, 368], [755, 330], [738, 296]], label: 'To Pier 39 and the sea lions', at: [800, 300] },
    7: { pts: [[738, 296], [715, 262], [680, 225], [648, 200]], label: 'Rowed out by moonlight', at: [720, 225] },
    8: { pts: [[648, 200], [640, 192]], label: 'Through the secret door', at: [540, 300], inset: 'door' },
    9: { pts: [[640, 192], [640, 192]], label: 'Tiny Samuel’s secret route', at: [540, 300], inset: 'pipes' },
    10: { pts: [[640, 192], [640, 192]], label: 'The control room', at: [540, 300], inset: 'control' },
    11: { pts: [[640, 200], [560, 222], [420, 240], [300, 248], [232, 247]], label: 'Taking the bridge home', at: [420, 205] }
  };
  function routePath(pts) { return pts.length > 2 ? smooth(pts, false) : `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`; }
  const label = (x, y, t, size = 22, c = C.ink, anchor = 'middle', style = 'Kalam, cursive', weight = 400) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${style}" font-size="${size}" font-weight="${weight}" fill="${c}" fill-opacity=".85">${t}</text>`;
  function mapScene(n) {
    let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="#9cc6d9"/>`;
    s += wash(rect(-40, -40, 360, 900), '#6f9fbf', .5, 'soft');
    s += blooms(10, [0, 0, W, H], [C.sky, C.cerulean, '#bfe0e8'], 80, 200, .35);
    s += brushStrokes(30, [0, 0, W, H], C.white, .3, [40, 140], [2, 3]);
    // land
    const land = '#efe2c4';
    s += wash(smooth(MARIN), '#c9d69a', .9) + wash(smooth(MARIN), C.sap, .25, 'soft');
    s += wash(smooth([[470, -40], [600, -40], [600, 0], [540, 40], [470, 40]]), '#c9d69a', .9);
    s += wash(smooth(EAST), '#e6d6b2', .9);
    s += wash(smooth(SF), land, .95);
    s += blooms(6, [80, 320, 760, 420], [C.gold, C.rose, C.sap], 60, 140, .18);
    // streets on the SF grid
    let grid = '';
    for (let x = 300; x < 900; x += 28) grid += `M${x},300L${x + 60},790`;
    for (let y = 330; y < 790; y += 28) grid += `M280,${y}L920,${y - 30}`;
    const cid = PID + '-sfclip';
    s += `<clipPath id="${cid}"><path d="${smooth(SF)}"/></clipPath><path d="${grid}" stroke="${C.sienna}" stroke-width="1" stroke-opacity=".22" clip-path="url(#${cid})" ${F('ink')}/>`;
    s += wash(hrect(70, 560, 410, 46, 2), C.sap, .7) + wash(blob(255, 320, 110, 38, .15), C.sap, .55);
    // islands
    s += wash(blob(590, 78, 58, 40, .2), '#c9d69a', .9) + wash(blob(P.alc[0], P.alc[1], 24, 11, .15), '#cdb89a', .95);
    s += wash(hrect(965, 236, 80, 58, 3), '#e6d6b2', .9) + wash(blob(1000, 330, 40, 24, .15), '#c9d69a', .9);
    // bay bridge
    s += line('M838,416L1000,332L1130,304', '#7f8b96', 5, .8);
    // golden gate (present on day 1 and day 11)
    if (n === 1 || n === 11) {
      s += line('M232,283L226,212', C.orange, 7, .95) + wash(hrect(222, 262, 14, 8, 1), C.sienna, .9, 'fig') + wash(hrect(220, 226, 14, 8, 1), C.sienna, .9, 'fig');
    } else {
      s += `<path d="M232,283L226,212" stroke="${C.orange}" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round" stroke-opacity=".8" fill="none"/>`;
      s += label(330, 236, 'MISSING!', 20, C.crimson, 'middle', 'Kalam, cursive', 700);
    }
    // landmarks
    const dot = (p, c = C.crimson) => circ(p[0], p[1], 6, c, .9, 'fig');
    s += dot(P.hotel, C.gold) + `<path d="M${P.hotel[0]},${P.hotel[1] - 16}l4,9l10,1l-7,7l2,10l-9,-5l-9,5l2,-10l-7,-7l10,-1Z" fill="${C.gold}" stroke="${C.ink}" stroke-width="1" stroke-opacity=".6"/>`;
    s += dot(P.china, C.crimson) + dot(P.pier, C.sienna) + dot(P.coit, C.payne) + dot(P.ferry, C.payne);
    s += line(`M${P.lombard[0] - 14},${P.lombard[1] - 14}q10,4 0,8q-10,4 0,8q10,4 0,8`, C.sienna, 2.4, .8, null);
    s += label(P.hotel[0] - 12, P.hotel[1] + 34, 'Grand Magnolia Hotel', 18, C.ink, 'end') + label(P.hotel[0] - 12, P.hotel[1] + 54, '(Nob Hill)', 15, C.payne, 'end');
    s += label(P.china[0] + 14, P.china[1] + 22, 'Chinatown', 18, C.ink, 'start');
    s += label(P.pier[0] + 14, P.pier[1] - 10, 'Pier 39', 18, C.ink, 'start');
    s += label(P.coit[0] + 14, P.coit[1] + 4, 'Coit Tower', 15, C.payne, 'start');
    s += label(P.ferry[0] + 14, P.ferry[1] + 6, 'Ferry Building', 15, C.payne, 'start');
    s += label(P.lombard[0] - 22, P.lombard[1] + 6, 'Lombard St', 15, C.payne, 'end');
    s += label(P.alc[0], P.alc[1] - 22, 'Alcatraz', 20, C.ink) + label(590, 84, 'Angel Island', 16, C.payne);
    s += label(275, 590, 'Golden Gate Park', 18, '#3d5a2c') + label(255, 326, 'Presidio', 16, '#3d5a2c');
    s += label(1005, 272, 'Treasure Island', 14, C.payne) + label(1180, 420, 'Oakland', 18, C.payne, 'end');
    s += label(180, 120, 'Marin', 22, '#3d5a2c') + label(120, 262, 'Golden Gate', 16, C.sienna);
    s += label(110, 470, 'Pacific', 26, '#2f5f80', 'middle', 'Fraunces, Georgia, serif') + label(110, 500, 'Ocean', 26, '#2f5f80', 'middle', 'Fraunces, Georgia, serif');
    s += label(1000, 110, 'San Francisco Bay', 26, '#2f5f80', 'middle', 'Fraunces, Georgia, serif');
    s += label(880, 690, '↓ to the airport (and England!)', 16, C.payne, 'end');
    // compass and scale
    s += `<g transform="translate(1090,640)">` + `<circle r="38" fill="${C.paper}" fill-opacity=".6" stroke="${C.ink}" stroke-opacity=".5"/>` + `<path d="M0,-34L7,0L0,34L-7,0Z" fill="${C.ink}" fill-opacity=".7"/><path d="M0,-34L7,0L-7,0Z" fill="${C.crimson}"/>` + label(0, -42, 'N', 18, C.ink) + '</g>';
    s += line('M960,712L1060,712M960,704L960,720M1060,704L1060,720', C.ink, 2, .7, null) + label(1010, 700, '1 mile', 15, C.ink);
    // routes: earlier days faint, today bold
    for (let d = 1; d <= n; d++) {
      const r = ROUTES[d], today = d === n;
      if (r.inset && !today) continue;
      const d0 = routePath(r.pts);
      if (today) {
        s += `<path d="${d0}" fill="none" stroke="${C.paper}" stroke-width="9" stroke-opacity=".8" stroke-linecap="round"/>`;
        s += `<path d="${d0}" fill="none" stroke="${C.crimson}" stroke-width="4.5" stroke-dasharray="${r.dotted ? '2 9' : '12 9'}" stroke-linecap="round" marker-end="url(#${PID}-arrow)" ${F('ink')}/>`;
      } else {
        s += `<path d="${d0}" fill="none" stroke="${C.payne}" stroke-width="2.5" stroke-dasharray="6 8" stroke-opacity=".5" stroke-linecap="round"/>`;
        const m = r.pts[Math.floor(r.pts.length / 2)];
        if (!r.dotted) s += `<circle cx="${m[0]}" cy="${m[1]}" r="11" fill="${C.paper}" stroke="${C.payne}" stroke-opacity=".6"/>` + label(m[0], m[1] + 5, String(d), 13, C.payne);
      }
    }
    gradDefs += `<marker id="${PID}-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="${C.crimson}"/></marker>`;
    const r = ROUTES[n];
    // inset: zoomed-in plan of the Rock
    if (r.inset) {
      const cx = 420, cy = 120, R = 92;
      s += line(`M${P.alc[0] - 20},${P.alc[1] - 6}L${cx + R * .8},${cy + R * .5}`, C.ink, 1.5, .5, null);
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#9cc6d9" stroke="${C.ink}" stroke-width="2" stroke-opacity=".6"/>`;
      s += wash(blob(cx, cy + 8, 78, 40, .1), '#cdb89a', .95);
      s += wash(hrect(cx - 50, cy - 12, 90, 40, 1), '#e8dcc6', .95, 'fig');
      if (r.inset === 'door') s += wash(hrect(cx - 6, cy + 8, 14, 20, 1), C.purple, .9, 'fig') + `<path d="M${cx + 70},${cy + 30}Q${cx + 40},${cy + 40} ${cx + 4},${cy + 22}" fill="none" stroke="${C.crimson}" stroke-width="3" stroke-dasharray="6 5" marker-end="url(#${PID}-arrow)"/>` + label(cx, cy - 26, '1937', 16, C.purple, 'middle', 'Kalam, cursive', 700);
      if (r.inset === 'pipes') s += `<path d="M${cx - 40},${cy + 22}C${cx - 30},${cy - 10} ${cx - 10},${cy + 26} ${cx},${cy}S${cx + 20},${cy - 6} ${cx + 30},${cy + 18}S${cx + 46},${cy - 4} ${cx + 30},${cy - 8}" fill="none" stroke="${C.crimson}" stroke-width="3" stroke-dasharray="4 4" marker-end="url(#${PID}-arrow)"/>` + label(cx - 44, cy + 44, 'cat!', 15, C.sienna) + label(cx + 34, cy - 18, 'key', 15, C.ochre, 'middle', 'Kalam, cursive', 700);
      if (r.inset === 'control') s += [[-20, C.crimson], [0, C.cerulean], [20, C.sap]].map(([dx, c]) => circ(cx + dx, cy + 6, 6, c, .95, 'fig')).join('') + label(cx, cy - 22, 'switches', 15, C.ink);
      s += label(cx, cy + R + 24, 'Inside the Rock', 18, C.ink);
    }
    if (n === 11) s += `<path d="${routePath(ROUTES[1].pts.slice().reverse())}" fill="none" stroke="${C.crimson}" stroke-width="4.5" stroke-dasharray="12 9" stroke-linecap="round" marker-end="url(#${PID}-arrow)" ${F('ink')}/>` + label(960, 560, 'Home!', 22, C.crimson, 'middle', 'Kalam, cursive', 700);
    // today's label
    s += `<g transform="translate(${r.at[0]},${r.at[1]})"><rect x="-6" y="-28" width="${r.label.length * 10.5 + 12}" height="38" rx="6" fill="${C.paper}" fill-opacity=".85"/>` + label(0, 0, r.label, 22, C.crimson, 'start', 'Kalam, cursive', 700) + '</g>';
    // cartouche
    s += `<g transform="translate(60,680)"><rect x="0" y="-36" width="300" height="52" rx="4" fill="${C.paper}" fill-opacity=".85" stroke="${C.ink}" stroke-opacity=".4"/>` + label(150, -3, `Oscar’s Map · Day ${n}`, 24, C.ink, 'middle', 'Fraunces, Georgia, serif', 600) + '</g>';
    return s;
  }

  /* ---------- the plates ---------- */
  const scenes = {
    1() { // the suitcases giggle
      let s = room([['#f2cfa8'], ['#e7b38e']]);
      s += glowAt(160, 300, 330, '#ffd88a', .75);
      s += windowFrame(700, 70, 420, 380, bay({ time: 'night', bridge: 'full', moon: [980, 120] }) + blooms(9, [0, 150, 1200, 500], ['#c9cde0', '#e6e3ea', '#aeb6d0'], 160, 320, .75));
      s += curtain(640, 40, 90, 520, C.plum, 1) + curtain(1095, 40, 90, 520, C.plum, -1);
      // lamp
      s += line('M150,590L150,260', C.sepia, 5, .9) + fig('M100,260L200,260L180,200L120,200Z', C.gold);
      // bed corner
      s += wash('M-40,470C80,455 260,460 330,480L340,640L-40,640Z', '#f4f1ea', .95, 'fig') + wash('M-40,500C80,490 240,492 330,506L336,560C200,546 80,548 -40,560Z', C.sky, .55);
      s += suitcase(430, 540, 200, 120, C.orange, true);
      s += suitcase(700, 560, 170, 100, C.teal, true);
      s += oscar(530, 560, 1.05, 'cheer', false);
      s += samuel(785, 575, 1.1, 'sword');
      s += football(610, 470, 12);
      s += daddy(330, 640, 1.15, 'worried');
      // flying socks & pants
      s += fig(blob(520, 250, 18, 9, .2, 7), C.gold) + fig(blob(860, 300, 16, 8, .2, 7), C.rose) + fig('M650,220l30,-6l4,14l-30,6Z', C.cerulean) + fig(blob(470, 330, 12, 7, .2, 7), C.sap);
      s += line('M520,380l-20,-30M545,372l0,-36M570,380l20,-30M760,400l-16,-28M790,392l0,-32M818,400l16,-28', C.ink, 2.2, .55);
      return s;
    },
    2() { // hide from Mummy
      let s = room([['#eef1ea'], ['#e3e3d0']], '#a8784f');
      s += windowFrame(560, 60, 460, 400, bay({ time: 'morning', bridge: 'none' }));
      s += curtain(500, 30, 110, 560, C.teal, 1) + curtain(990, 30, 110, 560, C.teal, -1);
      // feet poking out from the curtains
      s += fig(blob(530, 596, 13, 7, .1, 7), C.crimson) + fig(blob(556, 598, 13, 7, .1, 7), C.crimson);
      s += fig(blob(1028, 596, 11, 6, .1, 7), C.sepia) + fig(blob(1050, 598, 11, 6, .1, 7), C.sepia);
      s += fig('M1036,40C1030,22 1040,12 1052,12C1064,12 1072,22 1066,40Z', C.silver);
      s += line('M1044,8l-6,-12M1052,6l0,-14M1060,8l6,-12', C.ink, 1.6, .5);
      // desk & laptop
      s += fig(hrect(80, 470, 400, 22, 2), C.sienna) + fig(hrect(100, 492, 18, 120, 1), C.sienna) + fig(hrect(440, 492, 18, 120, 1), C.sienna);
      let screen = wash(hrect(166, 330, 228, 122, 1), '#f6e7d2', .9, null);
      screen += face(220, 392, 20) + fig('M198,392C192,360 206,352 220,352C236,352 248,362 242,394C240,380 232,370 220,370C208,370 200,380 198,392Z', '#6a4a2e');
      screen += fig('M196,430C200,416 240,416 244,430L246,452L194,452Z', C.rose);
      screen += face(330, 388, 18) + fig('M312,386C310,362 322,356 332,356C346,356 352,366 348,388C346,374 340,368 330,368C320,368 314,374 312,386Z', '#d9b56a');
      screen += fig('M308,424C312,412 348,412 352,424L354,452L306,452Z', C.lav);
      screen += face(288, 430, 12) + fig(blob(288, 419, 10, 5, .1, 7), C.blush);
      s += laptop(160, 470, 240, screen);
      s += daddy(560 - 10, 640, 1.1, 'wave');
      return s;
    },
    3() { // the nine o'clock meeting
      let s = room([['#e8e3ef'], ['#d9cfe4']], '#9b7656');
      s += windowFrame(820, 70, 300, 300, bay({ time: 'day', bridge: 'none' }));
      s += fig(hrect(90, 470, 420, 22, 2), C.sienna) + fig(hrect(110, 492, 18, 120, 1), C.sienna) + fig(hrect(470, 492, 18, 120, 1), C.sienna);
      let screen = wash(hrect(166, 330, 228, 122, 1), '#eef2f4', .9, null);
      screen += face(280, 384, 22) + fig('M256,388C250,350 270,342 282,342C300,342 314,354 306,390C302,372 294,362 280,364C268,364 260,374 256,388Z', C.ink);
      screen += fig('M244,432C250,416 310,416 316,432L320,452L240,452Z', '#3f4f6b');
      s += laptop(160, 470, 240, screen);
      // the tall version of Daddy: Samuel on Oscar's shoulders in Daddy's coat
      s += `<g transform="translate(600,640)">`;
      s += fig(hrect(-14, -40, 10, 38, 1), C.skin) + fig(hrect(4, -40, 10, 38, 1), C.skin) + fig(blob(-9, -2, 11, 6, .1, 7), C.crimson) + fig(blob(9, -2, 11, 6, .1, 7), C.crimson);
      s += fig('M-34,-290C-46,-220 -52,-120 -56,-36L56,-36C52,-120 46,-220 34,-290C14,-298 -14,-298 -34,-290Z', '#566c8f');
      s += line('M0,-290L0,-40', C.ink, 1.4, .4) + circ(-4, -200, 3, C.ink, .7, null) + circ(-4, -150, 3, C.ink, .7, null) + circ(-4, -100, 3, C.ink, .7, null);
      s += fig('M-32,-284C-52,-250 -60,-200 -60,-170L-48,-168C-46,-200 -38,-240 -24,-272Z', '#566c8f');
      s += fig('M32,-284C52,-262 70,-252 92,-250L92,-238C66,-238 46,-250 26,-266Z', '#566c8f') + fig(blob(98, -244, 7, 7, .1, 7), C.skin);
      s += face(0, -310, 17, { mouth: 'o' });
      s += fig('M-28,-322L28,-322L22,-332L-22,-332Z', C.indigo) + fig('M-18,-330C-18,-356 18,-356 18,-330Z', C.indigo);
      s += '</g>';
      // Daddy with magnifying glass, and the bolt
      s += daddy(930, 640, 1.05, 'stand');
      s += `<circle cx="990" cy="470" r="70" fill="#f7fbfc" fill-opacity=".85" stroke="${C.payne}" stroke-width="7" ${F('fig')}/>` + line('M1040,520L1080,580', C.sepia, 12, .95);
      s += fig('M960,462L1018,462L1018,478L960,478Z', C.orange) + fig(hrect(952, 452, 16, 36, 1), C.orange);
      s += `<text x="992" y="500" text-anchor="middle" font-family="Kalam, cursive" font-size="17" fill="${C.ink}">GG 1937</text>`;
      s += line('M720,330q20,-20 40,0M720,350q20,-20 40,0', C.ink, 1.6, .5);
      return s;
    },
    4() { // the cable car clue
      let s = bay({ time: 'day', bridge: 'none', alcatraz: [780, 500, .7] });
      // steep street from upper left to lower right
      s += wash('M-60,300L1260,700L1260,820L-60,820Z', '#c9b8a2', .9, 'wc');
      s += wash('M-60,360L1260,760L1260,820L-60,820Z', C.payne, .55, 'wc');
      s += line('M-60,394L1260,790', C.ink, 2, .5);
      // houses stepping down the hill
      const hc = [C.rose, C.sky, C.gold, C.sap, C.lav, C.blush];
      for (let i = 0; i < 6; i++) { const x = -20 + i * 120, y = 330 + i * 37; s += vhouse(x, y, 110, 190, hc[i]); }
      s += cableCar(760, 610, 1.15, 17, bigLou(-120, -14, .62) + daddy(10, -14, .55, 'worried') + oscar(70, -14, .6, 'point', false) + samuel(120, -14, .62, 'sword'));
      s += gull(300, 120, 1.2) + gull(360, 90, .9) + gull(1000, 160, 1);
      s += line('M640,420q10,-20 20,0q10,-20 20,0', C.gold, 3, .8);
      return s;
    },
    5() { // fortune cookies in Chinatown
      let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${lin('dusk5', [['#3e3f78'], ['#9c6a8e'], ['#f0ae7c']])}"/>`;
      s += blooms(6, [0, 0, W, 300], [C.rose, C.plum, C.gold], 80, 180, .35);
      // buildings with curved eaves
      const bc = ['#7b3b3b', '#3f6b5c', '#8f4a2f', '#4a4f7a', '#6d3a52'];
      for (let i = 0; i < 5; i++) {
        const x = -40 + i * 260, top = 120 + (i % 2) * 50;
        s += wash(hrect(x, top, 240, 640, 2), bc[i], .8);
        for (let f = 0; f < 3; f++) s += wash(`M${x - 20},${top + 40 + f * 150}Q${x + 120},${top + 70 + f * 150} ${x + 260},${top + 40 + f * 150}L${x + 240},${top + 60 + f * 150}L${x},${top + 60 + f * 150}Z`, f % 2 ? C.sap : C.crimson, .8);
        for (let f = 0; f < 3; f++) for (let k = 0; k < 3; k++) s += wash(hrect(x + 30 + k * 70, top + 80 + f * 150, 40, 50, 1), '#f6d48a', .55 + rnd() * .3, null);
      }
      // the bakery window
      s += glowAt(600, 520, 330, '#ffcf6a', .8);
      s += wash(hrect(420, 400, 360, 230, 2), '#ffe2a0', .95, 'fig');
      s += wash(hrect(400, 352, 400, 44, 2), '#2a1f2a', .92, 'fig') + `<text x="600" y="382" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="24" font-weight="700" fill="${C.gold}" letter-spacing="3">GOLDEN FORTUNE BAKERY</text>`;
      s += face(600, 490, 22) + fig('M574,486C570,456 590,448 602,448C618,448 630,458 626,488C622,472 612,466 600,466C588,466 578,474 574,486Z', C.ink) + fig('M566,540C572,518 628,518 634,540L640,600L560,600Z', C.cerulean);
      // lanterns strung across
      s += line('M-40,90Q300,220 640,110Q930,30 1240,140', C.ink, 1.5, .5);
      [[60, 128], [200, 172], [340, 190], [480, 162], [620, 116], [760, 82], [900, 80], [1040, 100], [1170, 128]].forEach(([x, y]) => { s += lantern(x, y + 22, 20); });
      s += wash(rect(-40, 640, W + 80, 140), '#5a4a5a', .85);
      s += oscar(330, 700, 1, 'point', true) + samuel(420, 708, 1.05, 'cheer');
      s += daddy(860, 712, 1.05, 'stand');
      // a heap of cookies in the window ledge
      s += cookie(470, 620, .7, -8) + cookie(530, 625, .7, 10) + cookie(680, 622, .7, -4) + cookie(740, 626, .7, 14) + cookie(600, 610, .8, 0);
      s += fig('M600,606l60,-30l6,10l-60,30Z', C.white) + line('M612,604l40,-20', C.crimson, 1.2, .7, null);
      return s;
    },
    6() { // the Admiral
      let s = bay({ time: 'day', bridge: 'none', alcatraz: [640, 470, 1.1] });
      // floats
      for (let i = 0; i < 3; i++) {
        const y = 560 + i * 70, x = 80 + i * 120;
        s += wash(hrect(x, y, 760 - i * 100, 34, 2), '#a88a63', .9, 'fig');
        for (let k = 0; k < 10; k++) s += line(`M${x + k * 70},${y + 2}L${x + k * 70 + 4},${y + 32}`, C.sepia, 1.2, .4, null);
      }
      s += seaLion(200, 560, .8, '#8a6143') + seaLion(420, 560, .7, '#6f4d36', -1) + seaLion(280, 630, .75, '#7c5a40', -1) + seaLion(700, 560, .6, '#8a6143');
      // the Admiral, very large and grand
      s += seaLion(520, 700, 1.7, '#5c4130');
      s += fig('M600,560L680,560L676,544C660,530 620,530 604,544Z', C.indigo) + fig(hrect(596, 556, 88, 9, 1), C.gold);
      // pier and family
      s += wash('M840,520L1260,500L1260,820L840,820Z', '#8b6e4f', .9);
      for (let k = 0; k < 6; k++) s += line(`M${860 + k * 70},${520 - k * 3}L${860 + k * 70},${820}`, C.sepia, 1.5, .5, null);
      s += oscar(930, 560, 1, 'point', true) + samuel(1010, 565, 1.05, 'sword');
      s += daddy(1120, 560, 1, 'worried');
      s += `<text x="660" y="470" font-family="Kalam, cursive" font-size="34" fill="${C.ink}" opacity=".7">ARK! ARK!</text>`;
      s += gull(220, 140) + gull(270, 170, .8) + gull(900, 120, 1.1);
      return s;
    },
    7() { // rowing out to The Rock
      let s = bay({ time: 'night', bridge: 'none', moon: [880, 140], alcatraz: [820, 455, 1.6] });
      // city lights left behind
      for (let i = 0; i < 60; i++) s += `<circle cx="${f1(rnd() * 360)}" cy="${f1(410 + rnd() * 20)}" r="${f1(1 + rnd() * 1.6)}" fill="#ffd98a" opacity="${f1(.5 + rnd() * .5)}"/>`;
      s += rowboat(420, 600, 1.2, '#7a3b2c');
      s += daddy(420, 600, .62, 'row', '#3c4a6a');
      s += line('M360,520L250,630M480,520L590,630', C.sepia, 4, .9);
      s += oscar(320, 590, .55, 'point', false) + samuel(520, 592, .55, 'sword');
      s += glowAt(330, 560, 70, '#fff1b0', .7);
      s += brushStrokes(10, [260, 620, 340, 40], '#c5cdf0', .5, [30, 90], [2, 3]);
      return s;
    },
    8() { // the Cabinet of Famous Things
      let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${lin('hall8', [['#1e1a3a'], ['#3a2f5c'], ['#4a3a5e']])}"/>`;
      for (let i = 0; i < 3; i++) { const x = 160 + i * 340; s += wash(`M${x},360L${x},170Q${x + 70},80 ${x + 140},170L${x + 140},360Z`, '#4e5f99', .7); s += glowAt(x + 70, 230, 160, '#bcd0ff', .35); }
      s += wash(rect(-40, 560, W + 80, 260), '#2c2340', .9);
      s += cabinet(80, 330, 170, 230, bigBen(165, 555, 1.25));
      s += cabinet(290, 360, 150, 200, eiffel(365, 555, 1));
      s += cabinet(860, 360, 150, 200, pisa(935, 555, 1.1));
      s += cabinet(1040, 420, 130, 140, skeletonRex(1080, 556, .55));
      // the pedestal with the bridge
      s += glowAt(640, 480, 220, '#ffcf8a', .55);
      s += wash(hrect(520, 520, 240, 120, 2), '#6b4a3a', .95, 'fig') + wash(blob(640, 510, 120, 20, .06, 11), C.crimson, .9, 'fig');
      s += `<g transform="translate(497,368) scale(.24)">${goldenGate('full')}</g>`;
      // the Professor and the Shrink-u-lator
      s += pinch(1000, 700, 1.15);
      s += glowAt(940, 530, 90, '#a6ff9a', .9) + fig(hrect(920, 518, 40, 22, 2), C.gold);
      s += `<path d="M920,530C820,560 720,600 640,640" stroke="#b6ff9e" stroke-width="10" stroke-opacity=".5" fill="none" ${F('soft')}/>`;
      s += samuel(600, 690, 1.15, 'sword');
      s += oscar(330, 712, 1, 'stand', true) + daddy(200, 720, 1.05, 'worried', '#455777');
      return s;
    },
    9() { // very small Samuel
      let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${lin('floor9', [['#3c3150'], ['#6f5a5a'], ['#b58a62']])}"/>`;
      for (let i = 0; i < 9; i++) s += wash(`M${600 + (i - 4.5) * 40},300L${600 + (i - 4.5) * 320},820L${600 + (i - 3.5) * 320},820L${600 + (i - 3.5) * 40},300Z`, i % 2 ? '#a77a52' : '#93683f', .75);
      s += wash(rect(-40, -40, W + 80, 340), '#3a3046', .85);
      s += wash('M60,300L60,170Q130,120 200,170L200,300Z', '#1f1a28', .95) + glowAt(130, 250, 80, '#6b5a9a', .4);
      s += cat(930, 470, 1.15);
      s += key(420, 640, 1.1, -12);
      s += skeletonRex(560, 690, 1.3);
      s += samuel(640, 545, .7, 'sword');
      s += line('M220,700q30,-20 60,0M250,730q30,-20 60,0', C.ink, 1.6, .4);
      return s;
    },
    10() { // Halloween code
      let s = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${lin('hall10', [['#241c3c'], ['#3d2d52'], ['#5a3e48']])}"/>`;
      // barred window with an orange Halloween moon
      s += windowFrame(820, 70, 260, 260, `<rect width="${W}" height="${H}" fill="#2a2450"/>` + glowAt(600, 360, 380, '#ffb35a', .8) + circ(600, 360, 220, '#f39a4a', .95));
      s += line('M880,70L880,330M950,70L950,330M1020,70L1020,330', '#2a2333', 8, .95);
      s += wash(rect(-40, 600, W + 80, 220), '#2a2133', .9);
      // console
      s += wash(hrect(80, 260, 520, 360, 3), '#4a5466', .95, 'fig');
      s += glowAt(340, 400, 260, '#7dffb0', .45);
      s += wash(hrect(120, 290, 440, 220, 2), '#0f2a22', .97, 'fig');
      const code = ['function grow(thing) {', '  for (let x of thing.parts) {', '    x.size = x.size − 1;', '    // fixed by Daddy:', '    x.size = x.size + 1;', '  }', '}'];
      code.forEach((t, i) => { s += `<text x="140" y="${328 + i * 27}" font-family="ui-monospace, Menlo, monospace" font-size="19" fill="${i === 2 ? '#ff8f7a' : '#9dffc4'}" ${i === 2 ? 'text-decoration="line-through"' : ''}>${t}</text>`; });
      for (let i = 0; i < 8; i++) s += circ(140 + i * 52, 560, 9, [C.crimson, C.gold, C.sap, C.cerulean][i % 4], .9, 'fig');
      // jack-o'-lanterns on the console
      [[140, 252], [520, 252]].forEach(([x, y]) => { s += glowAt(x, y - 10, 50, '#ffb35a', .7) + fig(blob(x, y - 20, 34, 26, .08, 11), C.orange2) + fig('M' + (x - 14) + ',' + (y - 28) + 'l8,-8l8,8ZM' + (x + 6) + ',' + (y - 28) + 'l8,-8l8,8ZM' + (x - 16) + ',' + (y - 12) + 'q16,10 32,0q-16,4 -32,0Z', '#3a2210') + fig(hrect(x - 4, y - 52, 8, 10, 1), C.sap); });
      s += daddy(380, 700, 1.15, 'stand', '#566c8f');
      s += oscar(700, 700, 1.05, 'kick', false);
      s += line('M760,640Q850,420 960,470', C.white, 2.5, .5, null);
      s += football(965, 470, 14);
      s += pinch(1060, 720, 1.05);
      s += glowAt(1000, 520, 50, '#a6ff9a', .8) + fig(hrect(985, 510, 36, 20, 2), C.gold);
      return s;
    },
    11() { // home again
      let s = bay({ time: 'dawn', bridge: 'full' });
      // fireboat fountains for the celebration
      [[300, 560], [900, 580]].forEach(([x, y]) => { s += `<path d="M${x},${y}C${x - 60},${y - 140} ${x - 140},${y - 160} ${x - 200},${y - 40}M${x},${y}C${x + 60},${y - 140} ${x + 140},${y - 160} ${x + 200},${y - 40}M${x},${y}L${x},${y - 200}" fill="none" stroke="#fff" stroke-width="7" stroke-opacity=".55" stroke-linecap="round" ${F('soft')}/>`; s += fig(hrect(x - 60, y - 6, 120, 26, 2), C.crimson) + fig(hrect(x - 20, y - 26, 40, 22, 1), C.white); });
      // confetti
      for (let i = 0; i < 70; i++) s += `<rect x="${f1(rnd() * W)}" y="${f1(rnd() * 360)}" width="5" height="9" fill="${[C.orange, C.gold, C.rose, C.sky, C.sap][i % 5]}" opacity=".75" transform="rotate(${f1(rnd() * 180)} ${f1(rnd() * W)} ${f1(rnd() * 360)})"/>`;
      s += plane(980, 110, 1.1) + line('M940,112Q700,140 520,128', C.white, 3, .6, 'soft');
      // a hill in the foreground with the family waving
      s += wash(band([[-60, 660], [200, 610], [420, 625], [600, 680], [800, 760]]), C.olive, .85);
      s += oscar(150, 640, .8, 'cheer', true) + samuel(230, 632, .85, 'sword') + daddy(320, 650, .85, 'wave');
      return s;
    },
    cover() {
      let s = bay({ time: 'morning', bridge: 'ghost', alcatraz: [720, 480, .8] });
      s += `<text x="605" y="330" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="120" fill="${C.orange}" opacity=".55">?</text>`;
      s += gull(260, 150, 1.2) + gull(320, 120, .9);
      return s;
    }
  };

  function paint(key, id) {
    PID = id || ('p' + key);
    rnd = rng(String(key).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    grad.clear(); gradDefs = '';
    const body = key.startsWith('map') ? mapScene(+key.slice(3)) : scenes[key]();
    const paperRect = "";
    gradDefs += `<radialGradient id="${PID}-light" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#fff6e0" stop-opacity="0"/><stop offset=".6" stop-color="#e9c9a0" stop-opacity=".18"/><stop offset="1" stop-color="#6b4a5a" stop-opacity=".55"/></radialGradient>`;
    const glaze = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#${PID}-light)" style="mix-blend-mode:multiply"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" preserveAspectRatio="xMidYMid meet">${defs()}<rect width="${W}" height="${H}" fill="${C.paper}"/><g mask="url(#${PID}-m)">${body}${glaze}</g>${paperRect}</svg>`;
  }
  window.Paint = { paint, W, H };
})();
