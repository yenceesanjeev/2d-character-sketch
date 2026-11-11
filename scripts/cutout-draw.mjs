// Cutout drawing: the simple-shape cast accepted in D067, and the code that directs it through a scene.
// This file has no Node or browser dependencies, so the Studio composition page and the command-line
// tool both import it and draw identical frames. Look rules: .agents/skills/cutout-characters/SKILL.md.
import { builtIn, inserts, paint } from './cutout-sets.mjs';

// ---- Shared colours and drawing helpers ---------------------------------------------------------
const C = { white:'#ffffff', ink:'#2b2024', mouthLine:'#6b3324', mouth:'#5a231f', tongue:'#d0716a', teeth:'#fbf5e8' };
const EDGE = 1.8;
const shape = (fill, edge, d) => `<path fill="${fill}" stroke="${edge}" stroke-width="${EDGE}" stroke-linejoin="round" d="${d}"/>`;
const oval = (fill, edge, cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${edge}" stroke-width="${EDGE}"/>`;
const line = (color, width, d) => `<path fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;
const tube = (d, width, fill, edge) => line(edge, width+EDGE*2, d)+line(fill, width, d);
export const mix = (a, b, t) => a+(b-a)*t;
export const mixPoint = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const rad = degrees => degrees*Math.PI/180;
let serial = 0;

// ---- Mouth chart: the nine shapes Rhubarb measures from a recording, plus a held smirk --------
const open = (h, w = 13) => `M${-w} 1Q0 -10 ${w} 1Q${w-2} ${h} 0 ${h+1}Q${2-w} ${h} ${-w} 1Z`;
const teeth = (w = 11) => `<path fill="${C.teeth}" d="M${2-w} 0Q0 -8.5 ${w-2} 0L${w-3} 2.4Q0 -4.6 ${3-w} 2.4Z"/>`;
const cavity = (h, w) => shape(C.mouth, C.mouthLine, open(h, w));
export const mouths = {
  X:line(C.mouthLine, 3, 'M-11 0Q0 5 11 -1'),
  S:line(C.mouthLine, 3, 'M-11 2Q3 7 13 -4'),
  A:line(C.mouthLine, 3, 'M-10 0Q0 2 10 0'),
  J:line(C.mouthLine, 3, 'M-13 -3Q0 10 13 -3'),
  N:line(C.mouthLine, 3, 'M-10 3Q0 -4 10 3'),
  W:line(C.mouthLine, 3, 'M-11 1Q-5 -4 0 0Q5 4 11 -1'),
  B:shape(C.teeth, C.mouthLine, 'M-12 0Q0 -6 12 0Q0 7 -12 0Z'),
  C:cavity(9)+teeth()+`<ellipse cx="0" cy="7" rx="6" ry="2.6" fill="${C.tongue}"/>`,
  D:cavity(15, 13.5)+teeth(11.5)+`<ellipse cx="0" cy="11" rx="7" ry="3.6" fill="${C.tongue}"/>`,
  E:cavity(10, 9.5)+teeth(8),
  F:`<ellipse cx="0" cy="1" rx="5" ry="5.6" fill="${C.mouth}" stroke="${C.mouthLine}" stroke-width="1.6"/>`,
  G:shape(C.teeth, C.mouthLine, 'M-11 0Q0 -6 11 0L10 3.5Q0 -1 -10 3.5Z'),
  H:cavity(10)+teeth()+`<ellipse cx="0" cy="3" rx="6" ry="3" fill="${C.tongue}"/>`,
};

// ---- Expressions: only the lids and brows change. `near` is the eye closer to the camera --------
const brows = (lift = 0, tilt = 0, arch = 2.5) => ({ lift, tilt, arch });
const both = (lift, tilt, arch) => ({ near:brows(lift, tilt, arch), far:brows(lift, tilt, arch) });
export const expressions = {
  neutral:  { mouth:'X', ...both(0, 0, 2.5) },
  serene:   { mouth:'X', lid:.16, ...both(3, -1, 5) },
  happy:    { mouth:'J', eyes:'happy', ...both(4, -1, 5) },
  laugh:    { mouth:'D', eyes:'happy', ...both(6, -2, 6) },
  offer:    { mouth:'C', big:1.12, ...both(5, -2, 4) },
  smug:     { mouth:'S', lid:.34, near:brows(5, -1, 4), far:brows(2, 1, 3) },
  wink:     { mouth:'S', wink:true, near:brows(0, 1, 2), far:brows(5, -1, 4) },
  defiant:  { mouth:'S', lid:.24, slant:1.2, near:brows(6, -2, 4), far:brows(-2, 5, 0) },
  skeptical:{ mouth:'A', lid:.3, near:brows(7, -2, 5), far:brows(-3, 3, 0) },
  sideeye:  { mouth:'A', lid:.32, gaze:[6, 0], ...both(-1, 1, 0) },
  eyeroll:  { mouth:'A', lid:.1, gaze:[2, -7], ...both(5, -1, 3) },
  thinking: { mouth:'W', gaze:[5, -5], near:brows(6, -1, 4), far:brows(1, 0, 2) },
  stern:    { mouth:'A', lid:.3, slant:2.4, ...both(-3, 5, 0) },
  angry:    { mouth:'N', lid:.36, slant:4, ...both(-5, 8, 0) },
  annoyed:  { mouth:'A', lid:.45, ...both(-2, 2, 0) },
  bored:    { mouth:'A', lid:.5, ...both(0, 0, 0) },
  tired:    { mouth:'A', lid:.4, ...both(0, -3, 1) },
  worried:  { mouth:'A', big:1.06, ...both(4, -5, 1) },
  sheepish: { mouth:'W', gaze:[-4, 2], ...both(4, -5, 1) },
  sad:      { mouth:'N', lid:.22, gaze:[0, 3], ...both(3, -8, 0) },
  pained:   { mouth:'B', eyes:'squeeze', ...both(-2, 6, 0) },
  surprised:{ mouth:'F', eyes:'wide', ...both(8, -1, 5) },
  shocked:  { mouth:'D', eyes:'wide', big:1.1, ...both(9, -3, 4) },
};

// ---- Hair styles: a mass behind the head, a fringe over the forehead, optional strands and extras
export const hairStyles = {
  swept:  { rx:5, ry:47, fringe:'M-56 -72C-60 -152 60 -152 56 -76C52 -90 42 -100 28 -101C6 -102 -22 -98 -40 -86Q-50 -80 -56 -72Z',
            strands:'M-34 -104Q-10 -117 22 -108M-22 -116Q2 -126 30 -116', lift:[[14, -67, 26, 11, -10]] },
  part:   { rx:4, ry:45, fringe:'M-56 -72C-60 -150 60 -150 56 -76C54 -92 46 -102 30 -104C10 -106 -14 -105 -34 -96Q-48 -88 -56 -72Z',
            strands:'M-30 -98Q-27 -118 -16 -129M-12 -109Q8 -117 30 -111' },
  unkempt:{ rx:5, ry:46, fringe:'M-56 -80C-60 -150 60 -150 56 -82C50 -100 38 -110 22 -110C4 -112 -20 -110 -38 -100Q-50 -92 -56 -80Z',
            strands:'M-26 -117Q-6 -125 16 -119', lift:[[-20, -64, 6, 9, -34], [24, -65, 6, 8, 30]] },
  short:  { rx:3, ry:44, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'' },
  fluffy: { rx:8, ry:50, fringe:'M-58 -70C-62 -152 62 -152 58 -72C52 -88 44 -94 34 -89C24 -100 10 -100 2 -90C-8 -100 -24 -100 -32 -89C-42 -96 -52 -86 -58 -70Z',
            strands:'', lift:[[-24, -62, 22, 16, 0], [4, -70, 24, 17, 0], [30, -62, 20, 15, 0]] },
  long:   { rx:6, ry:47, long:true, fringe:'M-56 -72C-60 -152 60 -152 56 -76C52 -90 42 -100 28 -101C6 -102 -22 -98 -40 -86Q-50 -80 -56 -72Z', strands:'' },
  bun:    { rx:3, ry:44, bun:true, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'' },
  bald:   { rx:0, ry:0, bald:true, fringe:'', strands:'' },
};

// A body pose is where the near elbow and wrist go, and which hand drawing ends the arm.
export const NEAR = [-44, 18], FAR = [44, 18];
export const bodies = {
  lean: { elbow:[-72, 102], wrist:[-12, 124], hand:'loose' },   // forearms resting on the table
  offer:{ elbow:[-88, 72], wrist:[-104, 8], hand:'open' },      // open palm lifted beside him
  self: { elbow:[-80, 88], wrist:[-20, 58], hand:'point' },     // finger turned to his own chest
  wave: { elbow:[-88, 90], wrist:[-108, 56], hand:'open' },     // a low flick of the hand: go on, then
  shrug:{ elbow:[-84, 88], wrist:[-100, 46], hand:'open', far:{ elbow:[84, 88], wrist:[100, 46], hand:'open' } },
  type: { elbow:[-70, 100], wrist:[-25, 121], hand:'loose', far:{ elbow:[70, 100], wrist:[25, 121], hand:'loose' }, typing:true },
  thinker:{ elbow:[-58, 94], wrist:[-15, 17], hand:'loose', tilt:-5 },   // fist under the chin
  point:{ elbow:[-86, 62], wrist:[-122, 44], hand:'point' },    // pointing away, at someone else
  temple:{ elbow:[-80, 56], wrist:[-50, -58], hand:'loose' },   // rubbing his temple
  pinch:{ elbow:[-64, 68], wrist:[-8, -46], hand:'loose' },     // pinching the bridge of his nose
  phone:{ elbow:[-72, 88], wrist:[-44, 42], hand:'loose', prop:'phone' },
  sip:  { elbow:[-66, 86], wrist:[-22, 30], hand:'loose', prop:'mug' },
  hang: { elbow:[-58, 74], wrist:[-52, 126], hand:'loose', far:{ elbow:[58, 74], wrist:[52, 126], hand:'loose' } },   // standing, arms at his sides
  pockets:{ elbow:[-62, 80], wrist:[-42, 120], hand:'loose', far:{ elbow:[62, 80], wrist:[42, 120], hand:'loose' } },
  cross:{ elbow:[-64, 88], wrist:[16, 74], hand:'loose', far:{ elbow:[64, 88], wrist:[-16, 80], hand:'loose' } },
};
const props = {
  phone:`<rect x="-7" y="-31" width="14" height="25" rx="3" fill="#2f3238"/><rect x="-5" y="-28" width="10" height="17" rx="1.5" fill="#a9d6cf"/>`,
  mug:`<path fill="none" stroke="#b9b2a2" stroke-width="3" d="M8 -27q9 3 0 11"/><rect x="-8" y="-31" width="16" height="19" rx="3" fill="#ece7db" stroke="#b9b2a2" stroke-width="1.5"/>`,
  pen:`<path fill="none" stroke="#2f4f6c" stroke-width="3.4" stroke-linecap="round" d="M-3 -4L7 -36"/><path fill="none" stroke="#cfd4d8" stroke-width="3.4" stroke-linecap="round" d="M6.2 -33L7 -36"/>`,
};
export const REST_FAR = { elbow:[70, 102], wrist:[13, 124], hand:'loose' };
export const HEAD = 1.1; const CY = -58, EYE_Y = -62, EYE_W = 5.3, EYE_H = 7.4;
// The table edge a seated character sits behind, in the figure's own units.
export const table = `<path fill="#d5b47e" stroke="#8c7350" stroke-width="2" d="M-900 136Q0 126 900 136V158H-900Z"/><path fill="#bb9567" d="M-900 158H900V400H-900Z"/>`;

// ---- One character: everything below is the shared construction, coloured by its cast entry ------
export function kit(P) {
  const [R, RY] = P.head, style = hairStyles[P.style];

  // `turn` runs from -1 (facing screen left) through 0 (front) to 1 (facing screen right).
  function head({ turn = 0, look = 'neutral', mouth = 'X', gaze = [0, 0], lid, tilt = 0, bob = 0, brow:raise = 0 } = {}) {
    const yaw = rad(turn*65), s = Math.sin(yaw), c = Math.cos(yaw), facing = turn < 0 ? -1 : 1;
    const face = expressions[look], closed = lid ?? face.lid ?? 0, id = `head${serial++}`;
    const top = CY-RY, chin = CY+RY, jaw = s*5;
    const egg = `M0 ${top}C${R*.92} ${top} ${R} ${CY-32} ${R} ${CY-8}C${R} ${CY+30} ${R*.52+jaw} ${chin} ${jaw} ${chin}C${-R*.52+jaw} ${chin} ${-R} ${CY+30} ${-R} ${CY-8}C${-R} ${CY-32} ${-R*.92} ${top} 0 ${top}Z`;
    // A point on the ball, `degrees` round from the nose. `show` falls to 0 as it turns out of sight.
    const on = degrees => ({ x:R*.95*Math.sin(yaw+rad(degrees)), show:Math.cos(yaw+rad(degrees)) });
    const ear = degrees => { const p = on(degrees), x = R*Math.sin(yaw+rad(degrees));
      return { x, over:p.show > .12, gone:p.show < -.2, art:oval(P.skin, P.skinShade, x, CY+7, 8.5, 12) }; };
    const ears = [ear(-90), ear(90)].filter(item => !item.gone);
    const spots = [[turn < 0 ? -19 : 19, turn < 0 ? 1 : -1], [turn < 0 ? 19 : -19, turn < 0 ? -1 : 1]]
      .map(([degrees, inner]) => ({ ...on(degrees), degrees, inner })).filter(p => p.show >= .3);
    const eye = ({ x, show, degrees, inner }) => {
      const near = (degrees < 0) === (facing > 0) || Math.abs(turn) < .05, brows = (near ? face.near : face.far) ?? {};
      const glance = [gaze[0]+facing*(face.gaze?.[0] ?? 0), gaze[1]+(face.gaze?.[1] ?? 0)];
      const rx = EYE_W*Math.max(.55, show)*(face.big ?? 1), ry = EYE_H*(face.big ?? 1), cx = x+glance[0]*.6, cy = EYE_Y+glance[1]*.6;
      const browY = cy-ry-8-(face.eyes === 'wide' ? 3 : 0)-(brows.lift ?? 0)-raise, drop = inner*(brows.tilt ?? 0), span = 9.5*Math.max(.6, show);
      const brow = line(P.hair, 3.8, `M${cx-span} ${browY-drop}Q${cx} ${browY-(brows.arch ?? 2.5)} ${cx+span} ${browY+drop}`);
      const bags = P.tiredEyes ? line(P.skinShade, 2, `M${cx-6} ${cy+ry+3}Q${cx} ${cy+ry+6.5} ${cx+6} ${cy+ry+3}`) : '';
      if (closed >= .95 || face.wink && inner === 1) return line(C.ink, 2.8, `M${cx-rx-2} ${cy+1}Q${cx} ${cy+5} ${cx+rx+2} ${cy+1}`)+brow+bags;
      // Eyes that are not dots: closed in a smile, squeezed shut, or wide with the white showing.
      if (face.eyes === 'happy') return line(C.ink, 2.8, `M${cx-rx-2.5} ${cy+2}Q${cx} ${cy-6} ${cx+rx+2.5} ${cy+2}`)+brow+bags;
      if (face.eyes === 'squeeze') return line(C.ink, 2.8, `M${cx-inner*(rx+2.5)} ${cy-4.5}L${cx+inner*(rx+1.5)} ${cy}L${cx-inner*(rx+2.5)} ${cy+4.5}`)+brow+bags;
      if (face.eyes === 'wide') return `<ellipse cx="${cx}" cy="${cy}" rx="${rx+3.4}" ry="${ry+2.6}" fill="${C.white}" stroke="${C.ink}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="3.3" fill="${C.ink}"/>`+brow+bags;
      const lidY = cy-ry+2*ry*closed, cut = inner*(face.slant ?? 0)*(lid === undefined ? 1 : 0), clip = `eye${serial++}`;
      return `<clipPath id="${clip}"><path d="M${cx-rx-2} ${lidY-cut}L${cx+rx+2} ${lidY+cut}V${cy+ry+2}H${cx-rx-2}Z"/></clipPath>`+
        `<g clip-path="url(#${clip})"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.ink}"/>`+
        `<circle cx="${cx-rx*.3}" cy="${cy-ry*.36}" r="1.4" fill="${C.white}"/></g>`+brow+bags;
    };
    // Glasses sit on the same ball as the eyes: two lenses, a bridge and an arm back to the near ear.
    const frames = { rimless:['#d5dcdf', 1.6, 3, .2], thick:[C.ink, 3.4, 5, .1], steel:['#868d94', 2.2, 9, .14] }[P.glasses];
    let glasses = '';
    if (frames && spots.length) {
      const [colour, weight, corner, shine] = frames, lenses = spots.map(p => ({ x:p.x, w:11.5*Math.max(.6, p.show) })).sort((a, b) => a.x-b.x);
      glasses = lenses.map(lens => `<rect x="${lens.x-lens.w}" y="${EYE_Y-9}" width="${lens.w*2}" height="17" rx="${corner}" fill="${C.white}" fill-opacity="${shine}" stroke="${colour}" stroke-width="${weight}"/>`).join('');
      if (lenses.length === 2) glasses += line(colour, weight, `M${lenses[0].x+lenses[0].w} ${EYE_Y-2}H${lenses[1].x-lenses[1].w}`);
      const side = ears.find(item => item.over);
      if (side) { const lens = side.x < 0 ? lenses[0] : lenses.at(-1); glasses += line(colour, weight, `M${lens.x+Math.sign(side.x)*lens.w} ${EYE_Y-3}L${side.x} ${EYE_Y-1}`); }
    }
    const lift = (style.lift ?? []).map(([x, y, rx, ry, angle]) => `<ellipse cx="${x-s*6}" cy="${CY+y}" rx="${rx}" ry="${ry}" transform="rotate(${angle} ${x-s*6} ${CY+y})" fill="${P.hair}"/>`).join('');
    const long = style.long ? `<path fill="${P.hair}" d="M${-R-6} ${CY-12}V8Q${-R-6} 24 ${-R+12} 24H${R-12}Q${R+6} 24 ${R+6} 8V${CY-12}Z"/>` : '';
    const bun = style.bun ? `<circle cx="${-s*12}" cy="${CY-RY-9}" r="15" fill="${P.hair}"/>` : '';
    const back = style.bald ? '' : `${long}${bun}<ellipse cx="${-s*9}" cy="${CY-25}" rx="${R+style.rx}" ry="${style.ry}" fill="${P.hair}"/>${lift}`;
    const sides = fill => `<ellipse cx="${-facing*R}" cy="${CY-24}" rx="${7+50*Math.abs(s)}" ry="${40+6*Math.abs(s)}" fill="${fill}"/>`+
      `<ellipse cx="${facing*R}" cy="${CY-24}" rx="${Math.max(0, 7-26*Math.abs(s))}" ry="40" fill="${fill}"/>`;
    const grey = `grey${serial++}`;
    const streaks = ears.map(item => [-7, -1, 5].map((dx, n) => `M${item.x*.96+dx} ${CY-20+n*3}Q${item.x*.96+dx-1.5} ${CY-8} ${item.x*.96+dx+.5} ${CY+6}`).join('')).join('');
    const cover = style.bald ? '' : sides(P.hair)+(P.temple ? `<clipPath id="${grey}">${sides('#000')}</clipPath><g clip-path="url(#${grey})">${line(P.temple, 1.7, streaks)}</g>` : '');
    const fringe = style.bald ? '' : `<g transform="translate(${s*7} 0)"><path fill="${P.hair}" d="${style.fringe}"/>${style.strands ? line(P.strand, 2, style.strands) : ''}</g>`;
    const nose = oval(P.skin, P.skinShade, s*(R+1.5), -47, 6.2, 5.2);
    const lips = `<g transform="translate(${R*.74*Math.sin(yaw*.9)} -27) scale(${Math.max(.66, c)} 1)">${mouths[mouth]}</g>`;
    return `<g transform="translate(0 ${bob}) rotate(${tilt})">${back}${ears.filter(e => !e.over).map(e => e.art).join('')}`+
      `<clipPath id="${id}"><path d="${egg}" transform="translate(0 ${CY}) scale(1.04) translate(0 ${-CY})"/></clipPath>`+
      shape(P.skin, P.skinShade, egg)+`<g clip-path="url(#${id})">${cover}${fringe}</g>`+
      ears.filter(e => e.over).map(e => e.art).join('')+spots.map(eye).join('')+glasses+lips+nose+`</g>`;
  }

  // Hands: a mitten, an open hand and a pointing hand. Origin is the wrist; the hand points up.
  const nub = (x, y, len, turn, w = 5.6) => `<g transform="translate(${x} ${y}) rotate(${turn})">`+
    shape(P.skin, P.skinShade, `M${-w/2} 2V${-len}Q0 ${-len-w*.8} ${w/2} ${-len}V2Z`)+`</g>`;
  const mitt = oval(P.skin, P.skinShade, 0, -9, 10, 10.5);
  const hands = {
    loose:nub(-8, -8, 6, -62, 6)+mitt,
    open:nub(-8, -8, 8, -62, 6)+nub(-6.5, -15, 9, -16)+nub(-2.2, -17, 11, -5)+nub(2.4, -17, 10.5, 6)+nub(6.6, -15, 8, 17)+mitt,
    point:nub(-3, -15, 15, -3, 6)+nub(-8, -8, 5, -62, 6)+mitt+line(P.skinShade, 1.5, 'M1 -17Q5 -14 6 -9'),
  };
  // One curve from shoulder to wrist that bends at the elbow, ending in a hand drawing.
  function arm(shoulder, elbow, wrist, handName, prop) {
    const control = [elbow[0]*1.5-(shoulder[0]+wrist[0])*.25, elbow[1]*1.5-(shoulder[1]+wrist[1])*.25];
    const turn = Math.atan2(wrist[0]-control[0], control[1]-wrist[1])*180/Math.PI, f = P.sleeve;
    const a = mixPoint(shoulder, control, f), b = mixPoint(control, wrist, f), cuff = mixPoint(a, b, f);
    return tube(`M${shoulder}Q${control} ${wrist}`, 11.5, P.skin, P.skinShade)+`<g transform="translate(${wrist}) rotate(${turn}) scale(1.12)">${hands[handName]}${props[prop] ?? ''}</g>`+
      tube(`M${shoulder}Q${a} ${cuff}`, 18, P.top, P.topShade);
  }
  // `turn` slides the front of the clothing toward the side the character faces.
  function body(turn = 0, plain = false) {
    const x = turn*17, half = 15-Math.abs(turn)*4, w = P.waist, p = P.paunch ?? 0, clip = `body${serial++}`;
    const outline = `M-34 0C${-w} 3 ${-w-4-p} ${30+p*5} ${-w-p*.4} 130Q0 ${137+p*.6} ${w+p*.4} 130C${w+4+p} ${30+p*5} ${w} 3 34 0Q0 9 -34 0Z`;
    let inside = '';
    if (P.front === 'open') inside = shape(P.inner, P.innerShade, `M${x-half} -4Q${x} 16 ${x+half} -4L${x+half+6} 142H${x-half-6}Z`)+
      (P.mark ? `<path fill="${P.mark}" d="M${x+1} 54h9v5h-9zM${x-7} 60h9v5h-9zM${x-15} 66h9v5h-9z"/>` : '');
    if (P.front === 'shirt') {
      const grid = P.checks ? [...Array(11)].map((_, i) => `M${-70+i*14} -6V142`).join('')+[...Array(10)].map((_, i) => `M-80 ${8+i*14}H80`).join('') : '';
      inside = (grid ? `<path fill="none" stroke="${P.topShade}" stroke-width="1.3" opacity=".6" d="${grid}"/>` : '')+line(P.topShade, 2, `M${x} 8V140`)+
        [30, 56, 82, 108].map(y => `<circle cx="${x}" cy="${y}" r="1.7" fill="${P.topShade}"/>`).join('')+
        (P.lanyard ? line('#3f6f79', 2.6, `M${x-11} 1L${x} 60L${x+11} 1`)+`<rect x="${x-8}" y="59" width="16" height="21" rx="2.5" fill="#f4f4ee" stroke="#b3b8ae" stroke-width="1.3"/><path fill="#3f6f79" d="M${x-8} 63h16v4h-16z"/>` : '');
    }
    if (plain) inside = '';
    else if (P.front === 'hoodie') inside = shape(P.top, P.topShade, `M${x-22} 94Q${x} 86 ${x+22} 94L${x+27} 124H${x-27}Z`)+line('#f6f1fb', 2.4, `M${x-6} 6V32M${x+6} 6V27`);
    return shape(P.top, P.topShade, outline)+`<clipPath id="${clip}"><path d="${outline}"/></clipPath><g clip-path="url(#${clip})">${inside}</g>`;
  }
  const neck = shape(P.skin, P.skinShade, 'M-12 -12V8Q0 14 12 8V-12Z');
  const hood = P.front === 'hoodie' ? `<ellipse cx="0" cy="5" rx="33" ry="15" fill="${P.topShade}"/>` : '';
  const phones = P.headphones ? line('#33333b', 7, 'M-25 3Q0 30 25 3')+oval('#44444f', '#2a2a31', -27, 4, 8, 12)+oval('#44444f', '#2a2a31', 27, 4, 8, 12) : '';
  function legs(turn = 0) {
    const gap = 17-Math.abs(turn)*9, toe = turn*9;
    return [-1, 1].map(side => tube(`M${side*gap} 126V262`, 21, P.legs, P.legsShade)+oval(P.shoe, P.shoeShade, side*gap+toe+side*3, 270, 19, 9)).join('');
  }
  // The acting figure, seated behind a table or standing with legs. The near arm is the screen-left one.
  function figure({ elbow, wrist, hand, prop, far = REST_FAR, standing = false, turn = .55, look, mouth, gaze, lid, brow, tilt = 0, bob = 0, lean = 0, breath = 0 }) {
    // A soft shadow under the feet keeps a standing figure on the floor. Some people always hold something.
    const shadow = standing ? `<ellipse cx="0" cy="273" rx="46" ry="8" fill="#1d2420" opacity=".13"/>` : '', held = prop ?? P.holds?.[standing ? 'standing' : 'seated'];
    return `<g transform="rotate(${lean})">${shadow}${standing ? legs(turn) : ''}${hood}${neck}<g transform="translate(0 ${-breath})">${body(turn)}${phones}</g>${arm(FAR, far.elbow, far.wrist, far.hand)}${arm(NEAR, elbow, wrist, hand, held)}`+
      `<g transform="translate(0 ${-2-breath*1.4}) scale(${HEAD})">${head({ turn, look, mouth, gaze, lid, brow, tilt, bob })}</g></g>`;
  }
  // The same person from behind, for the near edge of someone else's shot.
  function behind() {
    const top = CY-RY, chin = CY+RY, id = `back${serial++}`;
    const egg = `M0 ${top}C${R*.92} ${top} ${R} ${CY-32} ${R} ${CY-8}C${R} ${CY+30} ${R*.52} ${chin} 0 ${chin}C${-R*.52} ${chin} ${-R} ${CY+30} ${-R} ${CY-8}C${-R} ${CY-32} ${-R*.92} ${top} 0 ${top}Z`;
    const long = style.long ? `<path fill="${P.hair}" d="M${-R-6} ${CY-12}V8Q${-R-6} 24 ${-R+12} 24H${R-12}Q${R+6} 24 ${R+6} 8V${CY-12}Z"/>` : '';
    const bun = style.bun ? `<circle cx="0" cy="${CY-RY-9}" r="15" fill="${P.hair}"/>` : '';
    const hair = style.bald ? '' : `<clipPath id="${id}"><path d="${egg}" transform="translate(0 ${CY}) scale(1.05) translate(0 ${-CY})"/></clipPath>`+
      `<g clip-path="url(#${id})"><ellipse cx="0" cy="${CY-20}" rx="${R+8}" ry="${RY*.92}" fill="${P.hair}"/></g>`;
    return `${hood}${neck}${body(0, true)}<g transform="translate(0 -2) scale(${HEAD})">`+
      (style.bald ? '' : `${long}${bun}<ellipse cx="0" cy="${CY-25}" rx="${R+style.rx}" ry="${style.ry}" fill="${P.hair}"/>`)+
      oval(P.skin, P.skinShade, -R, CY+7, 8.5, 12)+oval(P.skin, P.skinShade, R, CY+7, 8.5, 12)+shape(P.skin, P.skinShade, egg)+hair+`</g>`;
  }
  // A whole standing figure for the line-up on the cast sheet.
  function standing(turn, look = 'neutral', mouth = 'X') {
    const swing = 1-Math.abs(turn)*.55;
    const left = arm([-44*swing-4*turn, 18], [-58*swing, 74], [-52*swing, 126], 'loose');
    const right = arm([44*swing-4*turn, 18], [58*swing, 74], [52*swing, 126], 'loose');
    return `${turn > 0 ? right : left}${legs(turn)}${hood}${neck}${body(turn)}${phones}${turn > 0 ? left : right}<g transform="translate(0 -2) scale(${HEAD})">${head({ turn, look, mouth })}</g>`;
  }
  return { head, figure, standing, hands, behind, spec:P };
}

// ---- Directing a scene from a compiled Studio timeline --------------------------------------------
// The timeline gives the cut clock, who is in each cut with their marks, the camera, the recorded
// lines with mouth cues, and the cut sheet's beats (moods, looks, gestures). This turns those into
// cutout acting. Extra acting from the episode's cutout-acting.json is layered on top.
export const FPS = 24, W = 960, H = 540;
const SEATS = { ch001:235, ch003:480, ch002:716 }, WIDE_SEATS = { ch001:300, ch003:480, ch002:660 }, CHIN = 267, CABIN_CHIN = 300, FIG = .75;
const MIRRORED = new Set(['ch002']);   // drawn flipped at the table, so the Manager's near arm is on his own side
// Our own framings for the meeting room, as [left, top, width] in the room's units.
const cameras = { WIDE:[190, 110, 580], NEEL:[31, 136, 444], 'NEEL-CLOSE':[70, 143, 360], MGR:[475, 136, 444], 'MGR-CLOSE':[521, 143, 360],
  CEO:[258, 136, 444], 'CEO-CLOSE':[300, 143, 360] };
const moodLooks = { smug:'smug', savour:'smug', pained:'annoyed', puzzled:'skeptical', worried:'worried', tired:'tired', blank:'bored', deadpan:'bored', eager:'offer', neutral:'neutral', thinking:'thinking' };
const actionPoses = { 'palm-up':'offer', 'hand-up':'offer', elbows:'rest', 'hand-down':'rest', unthink:'rest', sit:'rest', shrug:'shrug', 'wave-through':'wave', type:'type',
  thinker:'thinker', point:'point', 'hands-pockets':'pockets', 'phone-up':'phone', sip:'sip', cross:'cross', 'rub-temple':'temple', 'pinch-nose':'pinch' };
const beatMouths = { smile:'J', grin:'J', smirk:'S', flat:'A', open:'F' };
const openness = { X:0, A:.1, B:.3, C:.65, D:1, E:.6, F:.4, G:.3, H:.5 };
// Ease that arrives a touch past the target and comes back, like a real gesture.
export const settle = t => { const v = Math.max(0, Math.min(1, t))-1; return 1+2.2*v*v*v+1.2*v*v; };
const smooth = t => { const v = Math.max(0, Math.min(1, t)); return v*v*(3-2*v); };
export const MOVE = 8;   // frames a pose change takes
// A named pose for a seated or a standing figure. "rest" is hands on the table, or arms hanging.
export function poseOf(name, standing) {
  const pose = bodies[name === 'rest' ? (standing ? 'hang' : 'lean') : name] ?? bodies.lean;
  return { ...pose, far:pose.far ?? (standing ? bodies.hang.far : REST_FAR) };
}

// Read one cut's beats into a list of dated states per character.
function direct(cut, lines, extra, ids, place, seated, known) {
  const cabin = cut.set === 'cabin', meeting = cut.set === 'meeting';
  const home = id => cabin ? (id === 'ch002' ? -.3 : .3) : meeting ? (id === 'ch001' ? .5 : id === 'ch002' ? -.5 : 0) : 0;
  const toward = (id, target) => ids.includes(target) ? Math.sign(place(target).x-place(id).x)*.6 :
    SEATS[target] && SEATS[id] ? Math.sign(SEATS[target]-SEATS[id])*.6 : 0;
  return ids.map((id, order) => {
    const beats = cut.beats.filter(beat => beat.id === id).map(beat => ({ ...beat, frame:Math.round(beat.at*FPS) }));
    // In a shared shot, anyone without a directed look turns to whoever is speaking.
    if (ids.length > 1 && !beats.some(beat => beat.action === 'look')) {
      for (const line of lines) if (line.character !== id && ids.includes(line.character)) beats.push({ frame:Math.max(0, line.startFrame-cut.from), action:'look', arg:line.character });
    }
    // Acting added for this render sits on top of the cut sheet's beats.
    for (const item of (extra ?? []).filter(entry => entry.who === id)) {
      const line = item.line && lines.find(entry => entry.id === item.line);
      if (item.line && !line) continue;   // the line moved to another cut since the acting was written
      const frame = Math.max(0, (line ? line.startFrame-cut.from : 0)+Math.round(item.at*FPS));
      for (const [action, arg] of [['look', item.look], ['face', item.face], ['pose', item.pose], ['rest', item.mouth]]) if (arg) beats.push({ frame, action, arg });
    }
    beats.sort((a, b) => a.frame-b.frame);
    let state = { pose:'rest', look:'neutral', facing:home(id), down:false, up:false, rest:null, closed:false, rise:0, step:0, inward:0 };
    const snaps = [{ frame:0, state }], flickers = [];
    for (const beat of beats) {
      const next = { ...state };
      if (beat.action === 'mood') next.look = moodLooks[beat.arg] ?? 'neutral';
      else if (beat.action === 'face' && expressions[beat.arg]) next.look = beat.arg;
      else if (beat.action === 'pose' && (bodies[beat.arg] || beat.arg === 'rest')) next.pose = beat.arg;
      else if (beat.action === 'rest' && mouths[beat.arg]) next.rest = beat.arg;
      else if (beat.action === 'mouth') next.rest = beatMouths[beat.arg] ?? null;
      else if (beat.action === 'eyes-closed') next.closed = true;
      else if (beat.action === 'eyes-open') next.closed = false;
      else if (beat.action === 'half-rise') next.rise = -14;
      else if (beat.action === 'step-forward') next.step = 1;
      else if (beat.action === 'lean-in') next.inward = 4;
      else if (actionPoses[beat.action]) { next.pose = actionPoses[beat.action]; if (beat.action === 'sit') next.rise = 0; }
      else if (beat.action === 'look') {
        next.down = beat.arg === 'down' || beat.arg === 'screen'; next.up = beat.arg === 'up';
        if (known(beat.arg)) next.facing = toward(id, beat.arg);
        else if (beat.arg === 'camera' || beat.arg === 'crowd') next.facing = 0;
        else if (beat.arg === 'interviewer') next.facing = id === 'ch002' ? -.3 : .3;
        else if (next.down) next.facing = home(id)*.5;
      } else if (['nod', 'shake-head', 'eyeroll'].includes(beat.action)) flickers.push({ frame:beat.frame, kind:beat.action });
      state = next;
      if (beat.frame <= 0) snaps[0].state = state; else if (snaps.at(-1).frame === beat.frame) snaps.at(-1).state = state; else snaps.push({ frame:beat.frame, state });
    }
    return { id, order, snaps, flickers, ...place(id), standing:!seated, speech:lines.filter(line => line.character === id) };
  });
}

function actorAt(kits, actor, at, cut, clock) {
  const index = actor.snaps.findLastIndex(snap => snap.frame <= at), now = actor.snaps[index], before = actor.snaps[index-1] ?? now;
  const t = index ? settle((at-now.frame)/MOVE) : 1, s = now.state, p = before.state, pose = poseOf(s.pose, actor.standing), from = poseOf(p.pose, actor.standing);
  const seconds = clock/FPS, flip = actor.flip ? -1 : 1;
  const line = actor.speech.find(item => cut.from+at >= item.startFrame && cut.from+at < item.endFrame);
  const cueOf = frame => { if (!line) return 'X'; const sec = (cut.from+frame-line.startFrame)/FPS; return line.cues.find(([start, end]) => sec >= start && sec < end)?.[2] ?? 'X'; };
  const cue = cueOf(at), voice = [-2, -1, 0, 1, 2].reduce((sum, d) => sum+openness[cueOf(at+d)], 0)/5;
  let facing = mix(p.facing, s.facing, t), bob = 1.8*voice, gaze = [0, s.down ? 5 : s.up ? -6 : 0];
  // Small unprompted life. A speaker shifts on each new phrase and now and then lifts a hand; listeners nod.
  const mine = actor.phrases.filter(mark => mark.who === actor.id && mark.frame <= at), heard = actor.phrases.findLast(mark => mark.who !== actor.id && mark.frame <= at);
  const sway = [0, 3, -2, 2.5, -3], since = mine.length ? at-mine.at(-1).frame : 99;
  const accent = mine.length ? mix(sway[(mine.length-1)%5], sway[mine.length%5], smooth(since/6)) : 0;
  const beat = mine.length >= 2 && mine.length%2 === 0 && s.pose === 'rest' && since < 16 ? Math.sin(Math.PI*since/16) : 0;
  if (heard && at-heard.frame < 10 && (heard.frame+actor.order)%3 !== 0) bob += 3*Math.sin(Math.PI*(at-heard.frame)/10);
  for (const flicker of actor.flickers) {
    const d = (at-flicker.frame)/FPS;
    if (d < 0) continue;
    if (flicker.kind === 'shake-head' && d < .72) facing += .24*Math.sin(4*Math.PI*d/.72)*Math.sin(Math.PI*d/.72);
    if (flicker.kind === 'nod' && d < .62) bob += 5*Math.sin(Math.PI*d/.62);
    if (flicker.kind === 'eyeroll' && d < .78) gaze = [gaze[0], gaze[1]-8*Math.sin(Math.PI*d/.78)];
  }
  const blink = (clock+actor.order*29+actor.id.charCodeAt(actor.id.length-1)*7)%79, lid = s.closed ? 1 : blink < 4 ? [.6, 1, 1, .6][blink] : s.down ? .4 : undefined;
  const tap = pose.typing ? 2.2*Math.sin(clock*1.7) : 0, lift = ['rest', 'type', 'pockets', 'cross'].includes(s.pose) ? 0 : 2.5*voice;
  const wrist = mixPoint(from.wrist, pose.wrist, t), farWrist = mixPoint(from.far.wrist, pose.far.wrist, t), half = !index || (at-now.frame)/MOVE >= .45;
  const rise = mix(p.rise, s.rise, t), step = mix(p.step, s.step, t), k = actor.k*(1+.06*step);
  const art = kits[actor.id].figure({
    standing:actor.standing, elbow:mixPoint(from.elbow, pose.elbow, t), wrist:[wrist[0]-8*beat, wrist[1]-lift+tap-18*beat], hand:beat > .3 ? 'open' : half ? pose.hand : from.hand, prop:half ? pose.prop : from.prop,
    far:{ elbow:mixPoint(from.far.elbow, pose.far.elbow, t), wrist:[farWrist[0], farWrist[1]-tap], hand:half ? pose.far.hand : from.far.hand },
    turn:flip*facing, look:s.look, lid, gaze, brow:line ? 2.2*voice : 0, mouth:cue === 'X' ? s.rest ?? expressions[s.look].mouth : cue,
    tilt:mix(from.tilt ?? 0, pose.tilt ?? 0, t)+accent+(s.down ? 4 : s.up ? -4 : 0)+1.4*(voice-.3)*(line ? 1 : 0)+.5*Math.sin(seconds*1.9+actor.order),
    lean:mix(p.inward, s.inward, t)*Math.sign(facing || 1)*flip+.45*Math.sin(seconds*1.2+1+actor.order*2), bob, breath:1.1*Math.sin(seconds*1.75+actor.order),
  });
  return `<g transform="translate(${actor.x} ${actor.y+rise+6*step}) scale(${flip*k} ${k})">${art}</g>`;
}

// Build a scene once, then ask it for any frame. The same code runs in Node and in the Studio page.
export function createScene({ timeline, acting = {}, kits, asset = name => name }) {
  const partners = { ch001:'ch002', ch002:'ch001', ch003:'ch002' };
  // The rooms take the project's colours, which travel in the plan beside the cast.
  paint(timeline.cutout?.sets);
  const setups = timeline.cuts.map(cut => {
    const lines = timeline.lines.filter(line => line.startFrame >= cut.from && line.startFrame < cut.to);
    if (cut.insert) return { cut, insert:(inserts[cut.insert] ?? inserts['INSERT-EMAIL'])(kits.ch003?.spec.skin, kits.ch003?.spec.skinShade) };
    const meeting = cut.set === 'meeting', cabin = cut.set === 'cabin', seated = meeting || cabin;
    const ids = Object.keys(cut.cast).filter(id => kits[id]), seats = cut.staging === 'WIDE' ? WIDE_SEATS : SEATS;
    const tuned = meeting && cameras[cut.staging] && ids.every(id => seats[id] && Math.abs(cut.cast[id].x-SEATS[id]) < 2);
    const place = id => { const mark = cut.cast[id];
      if (cabin) return { x:1452, y:CABIN_CHIN, k:FIG, flip:MIRRORED.has(id) };
      if (tuned) return { x:seats[id], y:CHIN, k:FIG, flip:MIRRORED.has(id) };
      if (meeting) return { x:mark.x, y:CHIN, k:FIG*mark.scale, flip:MIRRORED.has(id) !== Boolean(mark.mirror) };
      return { x:mark.x, y:mark.y+2*mark.scale, k:mark.scale, flip:Boolean(mark.mirror) }; };
    const actors = direct(cut, lines, acting[cut.id], ids, place, seated, id => Boolean(kits[id]));
    // Where each new phrase starts: the line's start and the end of every pause inside it.
    const phrases = lines.flatMap(line => [0, ...line.cues.filter(([start, end, shape]) => shape === 'X' && end-start > .14 && start > .05).map(([, end]) => end)]
      .map(seconds => ({ who:line.character, frame:line.startFrame-cut.from+Math.round(seconds*FPS) }))).sort((a, b) => a.frame-b.frame);
    for (const actor of actors) actor.phrases = phrases;
    // Outside the meeting room the plan's own framing is used. Singles are eased out a little, because these
    // heads sit lower on the body than the earlier rig's did.
    const [cx, cy, cw] = cut.camera, eased = cw < 800 ? [cx-cw*.07, cy+32, cw*1.14] : cut.camera;
    const camera = cabin ? [ids[0] === 'ch002' ? 1202 : 1302, 162, 400] : tuned ? cameras[cut.staging] : meeting ? [cx, cy+70, cw] : eased;
    // A built-in room is drawn in the cutout style. Any other set uses the drawing registered for it.
    const room = meeting ? builtIn.meeting(actors.map(({ id, x }) => ({ id, x }))) : cabin ? builtIn.cabin() : builtIn[cut.set] ? builtIn[cut.set](cut.staging) :
      { back:cut.backdrop ? `<image href="${asset(cut.backdrop)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : '', front:'' };
    // An over-the-shoulder single shows the back of whoever is being spoken to, on the side the speaker faces.
    let overlay = '';
    if ((cut.angle === 'dirty-left' || cut.angle === 'dirty-right') && actors.length) {
      const lead = actors.find(actor => lines.some(line => line.character === actor.id)) ?? actors[0];
      const wanted = [cut.beats.find(beat => beat.id === lead.id && beat.action === 'look' && kits[beat.arg])?.arg, partners[lead.id], 'x5', 'x2', 'x0'];
      const partner = wanted.find(id => id && kits[id] && !ids.includes(id)), facing = lead.snaps[0].state.facing;
      const right = facing ? facing > 0 : cut.angle === 'dirty-right';
      if (partner) overlay = `<g transform="translate(${right ? W-80 : 80} 514) scale(1.85)">${kits[partner].behind()}</g>`;
    }
    return { cut, actors:[...actors].sort((a, b) => a.y-b.y || a.order-b.order), camera, back:room.back, front:room.front, overlay };
  });
  return { frames:timeline.frames, cuts:setups.length,
    cutAt(clock) { return setups.find(item => clock >= item.cut.from && clock < item.cut.to)?.cut; },
    frame(clock) {
      const setup = setups.find(item => clock >= item.cut.from && clock < item.cut.to);
      if (!setup) throw new RangeError(`No cut holds frame ${clock}.`);
      const { cut } = setup, at = clock-cut.from, seconds = at/FPS;
      const ground = `<rect width="${W}" height="${H}" fill="#dfd9cb"/>`;
      if (setup.insert) return ground+setup.insert;
      const hit = cut.punches.findLastIndex(punch => seconds >= punch.at), punch = cut.punches[hit];
      const zoom = punch ? mix(cut.punches[hit-1]?.scale ?? 1, punch.scale, punch.duration ? smooth((seconds-punch.at)/punch.duration) : 1) :
        cut.move?.type === 'zoom' ? mix(1, cut.move.scale, smooth(at/Math.max(1, cut.to-cut.from-1))) : 1;
      const figures = setup.actors.map(actor => actorAt(kits, actor, at, cut, clock)).join('');
      const fade = cut.angle === 'ending' ? smooth((clock-cut.to+14)/13) : 0;
      return ground+`<g transform="translate(${W/2} 170) scale(${zoom}) translate(${-W/2} -170)"><g transform="scale(${W/setup.camera[2]}) translate(${-setup.camera[0]} ${-setup.camera[1]})">`+
        `${setup.back}${figures}${setup.front}</g>${setup.overlay}</g>`+(fade > 0 ? `<rect width="${W}" height="${H}" fill="#151917" opacity="${fade}"/>` : '');
    } };
}

// A stand-in look for anyone without a character file, so a render never fails for a missing drawing.
export function fallbackSpec(id, index = 0) {
  const tops = [['#6d7c8b', '#55636f'], ['#846956', '#684f3f'], ['#748a72', '#5a6e59'], ['#946e7e', '#765663'], ['#796a89', '#5f536d']][index%5];
  return { id, name:id, skin:'#d0976a', skinShade:'#b0784d', hair:'#2b2024', strand:'#463a3d', style:'short', head:[49, 60], top:tops[0], topShade:tops[1], front:'shirt',
    sleeve:.92, waist:54, legs:'#5a5d66', legsShade:'#44474f', shoe:'#3a332f', shoeShade:'#231e1b', resting:'neutral' };
}
export const createCast = specs => Object.fromEntries(Object.entries(specs).map(([id, spec]) => [id, kit(spec)]));
