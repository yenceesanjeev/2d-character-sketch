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
  curious:  { mouth:'X', big:1.08, ...both(7, -1, 5) },   // a mild surprise: brows up, eyes a touch bigger, mouth closed
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
  // Added 2026-11-12 as a first batch to choose from. `fall` is how far down the side locks hang (22 is the
  // `long` length, 2 is the chin). `tail` is a ponytail behind the head, seen only as the head turns. `pig` is a
  // pair of pigtails that go round with the head. `block` is a squared top. `crest` is a ridge on a shaved head.
  afro:   { rx:17, ry:66, fringe:'M-58 -66C-62 -152 62 -152 58 -66C50 -92 36 -103 0 -104C-36 -103 -50 -92 -58 -66Z', strands:'' },
  receding:{ rx:2, ry:43, fringe:'M-56 -74C-60 -148 60 -148 56 -74C54 -94 46 -108 30 -113C20 -108 8 -104 0 -104C-8 -104 -20 -108 -30 -113C-46 -108 -54 -94 -56 -74Z', strands:'' },
  bangs:  { rx:6, ry:47, long:true, fringe:'M-57 -66C-61 -152 61 -152 57 -66L54 -85Q0 -93 -54 -85Z', strands:'' },
  bob:    { rx:8, ry:48, fall:-2, fringe:'M-57 -66C-61 -152 61 -152 57 -66L54 -85Q0 -93 -54 -85Z', strands:'' },
  lob:    { rx:7, ry:48, fall:8, fringe:'M-56 -72C-60 -152 60 -152 56 -76C52 -90 42 -100 28 -101C6 -102 -22 -98 -40 -86Q-50 -80 -56 -72Z', strands:'' },
  ponytail:{ rx:3, ry:44, tail:{ out:26, y:24, rx:13, ry:30 }, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'' },
  spiky:  { rx:3, ry:44, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'', lift:[[-30, -58, 7, 13, -8], [-15, -65, 7, 16, 8], [1, -68, 7, 18, 16], [17, -66, 7, 16, 24], [31, -59, 7, 13, 34]] },
  pigtails:{ rx:3, ry:44, pig:{ y:26, rx:12, ry:23 }, fringe:'M-57 -66C-61 -152 61 -152 57 -66L54 -85Q0 -93 -54 -85Z', strands:'' },
  buns:   { rx:3, ry:44, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'', lift:[[-35, -57, 12, 12, 0], [35, -57, 12, 12, 0]] },
  flattop:{ rx:2, ry:44, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'', block:{ w:44, top:30 } },
  mohawk: { rx:0, ry:0, crest:true, fringe:'', strands:'' },
  // A recently shaved head: close dots of new hair over the scalp, with no volume.
  stubble:{ rx:0, ry:0, dots:true, fringe:'M-56 -76C-60 -148 60 -148 56 -76C50 -94 40 -101 28 -101H-28C-40 -101 -50 -94 -56 -76Z', strands:'' },
  // A bare crown with hair left round the sides and back.
  balding:{ rx:8, ry:30, band:true, fringe:'', strands:'' },
  curtains:{ rx:5, ry:46, fringe:'M-56 -70C-60 -150 60 -150 56 -70C52 -90 30 -102 2 -112C-30 -102 -52 -90 -56 -70Z', strands:'M0 -112V-126' },
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
  // Added 2026-11-12 for gestures made while talking. `front` draws the near arm over the head, for a hand at the face.
  count1:{ elbow:[-86, 72], wrist:[-80, 4], hand:'one' },       // counting on fingers, hand up beside the head
  count2:{ elbow:[-86, 72], wrist:[-80, 4], hand:'two' },
  count3:{ elbow:[-86, 72], wrist:[-80, 4], hand:'three' },
  quotes:{ elbow:[-84, 62], wrist:[-76, -12], hand:'two', far:{ elbow:[84, 62], wrist:[76, -12], hand:'two' } },      // air quotes, fingers up
  quotes2:{ elbow:[-84, 64], wrist:[-76, -6], hand:'quote', far:{ elbow:[84, 64], wrist:[76, -6], hand:'quote' } },   // air quotes, fingers bent
  thumb:{ elbow:[-84, 84], wrist:[-76, 34], hand:'thumb' },     // thumbs up
  stop: { elbow:[-70, 74], wrist:[-58, 12], hand:'open' },      // palm out in front: hold on
  handsup:{ elbow:[-92, 54], wrist:[-100, -18], hand:'open', far:{ elbow:[92, 54], wrist:[100, -18], hand:'open' } },   // both hands up
  hello:{ elbow:[-92, 50], wrist:[-112, -26], hand:'open' },    // a raised wave
  hello2:{ elbow:[-92, 50], wrist:[-94, -32], hand:'open' },
  idea: { elbow:[-82, 58], wrist:[-76, -22], hand:'one' },      // one finger up: here is a thought
  pump: { elbow:[-86, 74], wrist:[-78, 6], hand:'fist' },       // a raised fist
  pump2:{ elbow:[-84, 82], wrist:[-74, 26], hand:'fist' },
  hips: { elbow:[-88, 84], wrist:[-54, 112], hand:'loose', far:{ elbow:[88, 84], wrist:[54, 112], hand:'loose' } },    // hands on hips
  scratch:{ elbow:[-88, 34], wrist:[-52, -104], hand:'loose', tilt:4 },   // scratching the back of the head
  clap: { elbow:[-68, 86], wrist:[-9, 52], hand:'open', far:{ elbow:[68, 86], wrist:[9, 52], hand:'open' } },
  clap2:{ elbow:[-74, 86], wrist:[-30, 54], hand:'open', far:{ elbow:[74, 86], wrist:[30, 54], hand:'open' } },
  beg:  { elbow:[-62, 86], wrist:[-7, 36], hand:'open', far:{ elbow:[62, 86], wrist:[7, 36], hand:'open' } },          // hands pressed together: please
  shh:  { elbow:[-62, 74], wrist:[-5, -6], hand:'one', front:true },      // a finger to the lips
  facepalm:{ elbow:[-66, 66], wrist:[-8, -34], hand:'open', front:true, tilt:5 },   // a hand over the face
  chinrub:{ elbow:[-60, 90], wrist:[-12, 14], hand:'loose', front:true },  // hand on the chin, in front
  carry:{ elbow:[-80, 98], wrist:[-94, 46], hand:'loose' },     // holding something up at chest height
  micup:{ elbow:[-70, 92], wrist:[-36, 44], hand:'loose' },   // a microphone held up under the chin, clear of the mouth
  show: { elbow:[-88, 66], wrist:[-100, 10], hand:'loose' },    // holding something out to be seen
  // Reaching toward another person, for moments two people share. Each comes twice: with the near arm (N) and
  // with the far arm (F), because which arm is on the partner's side depends on where they stand and how they are flipped.
  fiveN:{ elbow:[-84, 50], wrist:[-112, -28], hand:'open', far:{ elbow:[58, 74], wrist:[52, 126], hand:'loose' } },   fiveF:{ elbow:[-58, 74], wrist:[-52, 126], hand:'loose', far:{ elbow:[84, 50], wrist:[112, -28], hand:'open' } },
  shakeN:{ elbow:[-80, 80], wrist:[-116, 62], hand:'loose', far:{ elbow:[58, 74], wrist:[52, 126], hand:'loose' } },  shakeF:{ elbow:[-58, 74], wrist:[-52, 126], hand:'loose', far:{ elbow:[80, 80], wrist:[116, 62], hand:'loose' } },
  bumpN:{ elbow:[-80, 66], wrist:[-116, 40], hand:'fist', far:{ elbow:[58, 74], wrist:[52, 126], hand:'loose' } },    bumpF:{ elbow:[-58, 74], wrist:[-52, 126], hand:'loose', far:{ elbow:[80, 66], wrist:[116, 40], hand:'fist' } },
  giveN:{ elbow:[-80, 72], wrist:[-114, 48], hand:'open', far:{ elbow:[58, 74], wrist:[52, 126], hand:'loose' } },    giveF:{ elbow:[-58, 74], wrist:[-52, 126], hand:'loose', far:{ elbow:[80, 72], wrist:[114, 48], hand:'open' } },
};
export const props = {
  phone:`<rect x="-7" y="-31" width="14" height="25" rx="3" fill="#2f3238"/><rect x="-5" y="-28" width="10" height="17" rx="1.5" fill="#a9d6cf"/>`,
  mug:`<path fill="none" stroke="#b9b2a2" stroke-width="3" d="M8 -27q9 3 0 11"/><rect x="-8" y="-31" width="16" height="19" rx="3" fill="#ece7db" stroke="#b9b2a2" stroke-width="1.5"/>`,
  pen:`<path fill="none" stroke="#2f4f6c" stroke-width="3.4" stroke-linecap="round" d="M-3 -4L7 -36"/><path fill="none" stroke="#cfd4d8" stroke-width="3.4" stroke-linecap="round" d="M6.2 -33L7 -36"/>`,
  // Added 2026-11-12. Each is drawn at the wrist with the hand pointing up, like the three above.
  book:`<rect x="-13" y="-36" width="26" height="32" rx="2.5" fill="#b5533c" stroke="#8a3d2b" stroke-width="1.5"/><rect x="-13" y="-36" width="5" height="32" fill="#8a3d2b"/><rect x="-4" y="-29" width="13" height="4" rx="1" fill="#f1dfc0"/>`,
  clipboard:`<rect x="-14" y="-40" width="28" height="36" rx="3" fill="#b89a72" stroke="#8e7758" stroke-width="1.5"/><rect x="-11" y="-35" width="22" height="28" rx="1" fill="#f7f4ec"/><rect x="-6" y="-43" width="12" height="6" rx="2" fill="#8c9197"/><path stroke="#b9bfc4" stroke-width="1.6" d="M-8 -29H8M-8 -24H8M-8 -19H4"/>`,
  mic:`<rect x="-3.5" y="-26" width="7" height="24" rx="3" fill="#3a3d44"/><ellipse cx="0" cy="-33" rx="8" ry="9.5" fill="#70757d" stroke="#4b4f57" stroke-width="1.5"/><path stroke="#4b4f57" stroke-width="1" d="M-6 -36H6M-7 -32H7M-6 -28H6"/>`,
  cup:`<path fill="#f3efe6" stroke="#bdb5a4" stroke-width="1.5" d="M-9 -34H9L7 -8H-7Z"/><rect x="-10" y="-37" width="20" height="5" rx="2" fill="#6b4a3a"/><rect x="-8" y="-26" width="16" height="9" fill="#c9a37a"/>`,
  glass:`<path fill="#dcebee" fill-opacity=".75" stroke="#9fb4b9" stroke-width="1.5" d="M-8 -34H8L6 -8H-6Z"/><path fill="#8fc3d6" fill-opacity=".8" d="M-7 -24H7L6 -9H-6Z"/>`,
  bottle:`<rect x="-6" y="-30" width="12" height="24" rx="3.5" fill="#8fc3d6" fill-opacity=".85" stroke="#6ea0b3" stroke-width="1.5"/><rect x="-3" y="-38" width="6" height="9" rx="1.5" fill="#8fc3d6" stroke="#6ea0b3" stroke-width="1.5"/><rect x="-3.5" y="-41" width="7" height="4" rx="1.5" fill="#3f6fa3"/><rect x="-6" y="-22" width="12" height="7" fill="#f7f4ec"/>`,
  tablet:`<rect x="-15" y="-40" width="30" height="36" rx="3.5" fill="#2f3238"/><rect x="-12.5" y="-37" width="25" height="30" rx="1.5" fill="#a9d6cf"/>`,
  folder:`<path fill="#e0b64f" stroke="#b58f33" stroke-width="1.5" d="M-15 -36H-4L-1 -40H15V-6H-15Z"/><path stroke="#b58f33" stroke-width="1.5" d="M-15 -31H15"/>`,
  sandwich:`<path fill="#e3c08a" stroke="#b9945c" stroke-width="1.5" d="M-13 -22L0 -38L13 -22Z"/><path fill="#7fae5a" d="M-14 -22H14L12 -18H-12Z"/><path fill="#d9644a" d="M-12 -18H12L11 -15H-11Z"/><path fill="#e3c08a" stroke="#b9945c" stroke-width="1.5" d="M-13 -15H13L11 -8H-11Z"/>`,
  apple:`<circle cx="0" cy="-19" r="10.5" fill="#c9433a" stroke="#9c2f29" stroke-width="1.5"/><path fill="none" stroke="#6b4a2f" stroke-width="2" stroke-linecap="round" d="M0 -29Q1 -34 4 -36"/><ellipse cx="6" cy="-34" rx="5" ry="2.6" fill="#7fae5a" transform="rotate(-25 6 -34)"/>`,
  pizza:`<path fill="#f0c860" stroke="#c9963f" stroke-width="1.5" d="M-14 -34Q0 -41 14 -34L0 -4Z"/><path fill="none" stroke="#c9843f" stroke-width="4" stroke-linecap="round" d="M-13 -34Q0 -41 13 -34"/><circle cx="-3" cy="-26" r="3" fill="#c9433a"/><circle cx="5" cy="-22" r="2.6" fill="#c9433a"/><circle cx="0" cy="-15" r="2.4" fill="#c9433a"/>`,
  gift:`<rect x="-13" y="-30" width="26" height="24" rx="2" fill="#6a5acd" stroke="#4d419b" stroke-width="1.5"/><rect x="-3" y="-30" width="6" height="24" fill="#f0c94a"/><rect x="-13" y="-21" width="26" height="5" fill="#f0c94a"/><path fill="none" stroke="#f0c94a" stroke-width="3" stroke-linecap="round" d="M0 -30Q-10 -42 -9 -32M0 -30Q10 -42 9 -32"/>`,
  flowers:`<path fill="none" stroke="#5f8a4e" stroke-width="2.4" stroke-linecap="round" d="M0 -6V-26M-2 -8L-8 -26M2 -8L8 -26"/><circle cx="0" cy="-32" r="6" fill="#e8799a"/><circle cx="-10" cy="-30" r="5.5" fill="#f0c94a"/><circle cx="10" cy="-30" r="5.5" fill="#e06a4a"/><circle cx="0" cy="-32" r="2" fill="#f7e9b0"/><path fill="#e9dcc3" stroke="#bdb5a4" stroke-width="1.2" d="M-7 -16L7 -16L4 -3H-4Z"/>`,
  remote:`<rect x="-6" y="-36" width="12" height="32" rx="4" fill="#3a3d44"/><circle cx="0" cy="-30" r="2.4" fill="#c9433a"/><path stroke="#8c9197" stroke-width="2" stroke-linecap="round" d="M-2.5 -23H2.5M-2.5 -18H2.5M-2.5 -13H2.5"/>`,
  keys:`<circle cx="0" cy="-12" r="5.5" fill="none" stroke="#9aa0a6" stroke-width="2.2"/><path fill="none" stroke="#c9a84a" stroke-width="2.6" stroke-linecap="round" d="M2 -16L9 -31M9 -31L13 -29M7 -27L11 -25M-3 -16L-8 -30M-8 -30L-12 -28"/>`,
  card:`<rect x="-12" y="-30" width="24" height="16" rx="2.5" fill="#3f6fa3" stroke="#2f5580" stroke-width="1.5"/><rect x="-12" y="-26" width="24" height="3.5" fill="#22334a"/><rect x="-9" y="-19" width="9" height="2.5" rx="1" fill="#dfe8f1"/>`,
  trophy:`<path fill="#e0b64f" stroke="#b58f33" stroke-width="1.5" d="M-9 -40H9V-30Q9 -21 0 -20Q-9 -21 -9 -30Z"/><path fill="none" stroke="#b58f33" stroke-width="2.2" d="M-9 -37Q-16 -37 -15 -30Q-14 -25 -8 -26M9 -37Q16 -37 15 -30Q14 -25 8 -26"/><rect x="-2" y="-20" width="4" height="8" fill="#b58f33"/><rect x="-8" y="-12" width="16" height="6" rx="1.5" fill="#6b4a3a"/>`,
  sign:`<rect x="-2" y="-30" width="4" height="26" fill="#a3855f"/><rect x="-22" y="-58" width="44" height="30" rx="3" fill="#f7f4ec" stroke="#bdb5a4" stroke-width="1.5"/><path stroke="#8c9197" stroke-width="2.4" stroke-linecap="round" d="M-14 -48H14M-14 -40H8"/>`
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
    // Long hair falls in two locks beside the jaw and leaves the neck clear. One block under the chin read as a beard.
    // As the head turns, the lock on the side it faces narrows away and the one behind widens.
    const lock = side => { const width = side === facing ? (R*.56+6)*Math.max(0, 1-Math.abs(s)*1.8) : R*.56+6+Math.abs(s)*R*.5, o = side*(R+6)-s*6, i = o-side*width;
      return width < 6 ? '' : `<path fill="${P.hair}" d="M${o} ${CY-12}V${fall-16}Q${o} ${fall} ${(o+i)/2} ${fall}Q${i} ${fall} ${i} ${fall-14}V${CY-12}Z"/>`; };
    const fall = style.fall ?? 22, long = style.long || style.fall !== undefined ? lock(-1)+lock(1) : '';
    const tail = style.tail ? `<ellipse cx="${-s*(R+style.tail.out)}" cy="${CY+style.tail.y}" rx="${style.tail.rx}" ry="${style.tail.ry}" transform="rotate(${-s*14} ${-s*(R+style.tail.out)} ${CY+style.tail.y-style.tail.ry})" fill="${P.hair}"/>` : '';
    const bun = style.bun ? `<circle cx="${-s*12}" cy="${CY-RY-9}" r="15" fill="${P.hair}"/>` : '';
    const pig = style.pig ? [-105, 105].map(degrees => { const x = (R+10)*Math.sin(yaw+rad(degrees)); return `<ellipse cx="${x}" cy="${CY+style.pig.y}" rx="${style.pig.rx}" ry="${style.pig.ry}" transform="rotate(${-x*.14} ${x} ${CY+style.pig.y-style.pig.ry})" fill="${P.hair}"/>`; }).join('') : '';
    const block = style.block ? `<rect x="${-style.block.w-s*5}" y="${CY-RY-style.block.top+12}" width="${style.block.w*2}" height="${style.block.top+30}" rx="9" fill="${P.hair}"/>` : '';
    // A mohawk is one ridge over a shaved head: narrow from the front, long from the side.
    const crest = style.crest ? `<path fill="${P.hair}" d="M${-s*6-(10+Math.abs(s)*40)} ${CY-RY+16}Q${-s*6-(8+Math.abs(s)*30)} ${CY-RY-26} ${-s*6+Math.abs(s)*14} ${CY-RY-30}Q${-s*6+(9+Math.abs(s)*36)} ${CY-RY-24} ${-s*6+(10+Math.abs(s)*40)} ${CY-RY+16}Z"/>` : '';
    const band = `<ellipse cx="${-s*9}" cy="${CY-1}" rx="${R+style.rx}" ry="${style.ry}" fill="${P.hair}"/>`;
    const back = style.bald || style.dots ? '' : style.crest ? crest : style.band ? band : `${long}${tail}${pig}${block}${bun}<ellipse cx="${-s*9}" cy="${CY-25}" rx="${R+style.rx}" ry="${style.ry}" fill="${P.hair}"/>${lift}`;
    const sides = fill => `<ellipse cx="${-facing*R}" cy="${CY-24}" rx="${7+50*Math.abs(s)}" ry="${40+6*Math.abs(s)}" fill="${fill}"/>`+
      `<ellipse cx="${facing*R}" cy="${CY-24}" rx="${Math.max(0, 7-26*Math.abs(s))}" ry="40" fill="${fill}"/>`;
    const grey = `grey${serial++}`;
    const streaks = ears.map(item => [-7, -1, 5].map((dx, n) => `M${item.x*.96+dx} ${CY-20+n*3}Q${item.x*.96+dx-1.5} ${CY-8} ${item.x*.96+dx+.5} ${CY+6}`).join('')).join('');
    const low = `<ellipse cx="${-facing*R}" cy="${CY-3}" rx="${9+46*Math.abs(s)}" ry="${30+4*Math.abs(s)}" fill="${P.hair}"/><ellipse cx="${facing*R}" cy="${CY-3}" rx="${Math.max(0, 9-26*Math.abs(s))}" ry="30" fill="${P.hair}"/>`;
    // Stubble is a field of close dots over a faint tint of the hair colour, inside the same hairline as short hair.
    const dotsId = `dots${serial++}`, dotFill = `url(#${dotsId})`;
    const dotDefs = style.dots ? `<pattern id="${dotsId}" patternUnits="userSpaceOnUse" width="5.2" height="5.2"><circle cx="1.3" cy="1.3" r="1.15" fill="${P.hair}"/><circle cx="3.9" cy="3.9" r="1.15" fill="${P.hair}"/></pattern>` : '';
    const cover = style.bald ? '' : style.dots ? `${dotDefs}<clipPath id="${dotsId}s"><path d="${egg}"/></clipPath><clipPath id="${dotsId}h" clip-path="url(#${dotsId}s)"><path d="${style.fringe}" transform="translate(${s*7} 0)"/>${sides('#000')}</clipPath>`+
      `<g clip-path="url(#${dotsId}h)"><rect x="-95" y="-175" width="190" height="200" fill="${P.hair}" opacity=".13"/><rect x="-95" y="-175" width="190" height="200" fill="${dotFill}"/></g>` : style.band ? low : style.crest ? `<ellipse cx="${-s*6}" cy="${CY-RY+4}" rx="${10+Math.abs(s)*40}" ry="20" fill="${P.hair}"/>` : sides(P.hair)+(P.temple ? `<clipPath id="${grey}">${sides('#000')}</clipPath><g clip-path="url(#${grey})">${line(P.temple, 1.7, streaks)}</g>` : '');
    const fringe = style.bald ? '' : style.dots ? '' : `<g transform="translate(${s*7} 0)"><path fill="${P.hair}" d="${style.fringe}"/>${style.strands ? line(P.strand, 2, style.strands) : ''}</g>`;
    const nose = oval(P.skin, P.skinShade, s*(R+1.5), -47, 6.2, 5.2);
    const mx = R*.74*Math.sin(yaw*.9), squeeze = Math.max(.66, c);
    const lips = `<g transform="translate(${mx} -27) scale(${squeeze} 1)">${mouths[mouth]}</g>`;
    // Facial hair (2026-11-12). A beard covers the lower face inside the head's outline and leaves a patch of skin round
    // the mouth, so the mouth shapes stay readable. Stubble is the same area in close dots. A goatee is the chin only.
    const faceClip = `face${serial++}`, shadeId = `shade${serial++}`;
    const lower = `M-90 -40Q${mx} -30 90 -40V40H-90Z`, patch = `<ellipse cx="${mx}" cy="-25" rx="${17*squeeze}" ry="10.5" fill="${P.skin}"/>`;
    const beard = !P.beard ? '' : `<clipPath id="${faceClip}"><path d="${egg}"/></clipPath><g clip-path="url(#${faceClip})">`+
      (P.beard === 'stubble' ? `<pattern id="${shadeId}" patternUnits="userSpaceOnUse" width="5.2" height="5.2"><circle cx="1.3" cy="1.3" r="1.1" fill="${P.hair}"/><circle cx="3.9" cy="3.9" r="1.1" fill="${P.hair}"/></pattern><path d="${lower}" fill="${P.hair}" opacity=".12"/><path d="${lower}" fill="url(#${shadeId})"/>`
        : P.beard === 'goatee' ? `<ellipse cx="${mx*.92}" cy="-6" rx="${15*squeeze}" ry="15" fill="${P.hair}"/>${patch}`
        : `<path d="${lower}" fill="${P.hair}"/>${patch}`)+`</g>`;
    const tash = P.moustache ? `<g transform="translate(${mx} -37) scale(${squeeze} 1)"><path fill="${P.hair}" d="M-15 3Q-9 -6 0 -2Q9 -6 15 3Q8 1 0 2Q-8 1 -15 3Z"/></g>` : '';
    // Headwear sits over the hair: a beanie is a dome with a turned-up band, a cap is a lower dome with a peak on the side they face.
    const hatClip = `hat${serial++}`, hatFill = P.hatColour ?? '#4a5a6a', hatEdge = P.hatShade ?? '#3a4855';
    const dome = cut => `<clipPath id="${hatClip}"><path d="${egg}" transform="translate(0 ${CY}) scale(1.09) translate(0 ${-CY})"/></clipPath><g clip-path="url(#${hatClip})"><rect x="-90" y="-200" width="180" height="${200+cut}" fill="${hatFill}"/></g>`;
    const hat = P.hat === 'beanie' ? dome(-88)+`<rect x="${-R-6}" y="-99" width="${2*R+12}" height="13" rx="6" fill="${hatEdge}"/><circle cx="${-s*4}" cy="${CY-RY-9}" r="9" fill="${hatEdge}"/>`
      : P.hat === 'cap' ? dome(-92)+`<ellipse cx="${s*(R*.9)+(1-Math.abs(s))*0}" cy="-92" rx="${R*(.86-Math.abs(s)*.3)}" ry="7.5" fill="${hatEdge}"/><circle cx="${-s*4}" cy="${CY-RY-4}" r="3.5" fill="${hatEdge}"/>` : '';
    return `<g transform="translate(0 ${bob}) rotate(${tilt})">${back}${ears.filter(e => !e.over).map(e => e.art).join('')}`+
      `<clipPath id="${id}"><path d="${egg}" transform="translate(0 ${CY}) scale(1.04) translate(0 ${-CY})"/></clipPath>`+
      shape(P.skin, P.skinShade, egg)+`<g clip-path="url(#${id})">${cover}${fringe}</g>`+
      beard+ears.filter(e => e.over).map(e => e.art).join('')+hat+spots.map(eye).join('')+glasses+tash+lips+nose+`</g>`;
  }

  // Hands: a mitten, an open hand and a pointing hand. Origin is the wrist; the hand points up.
  const nub = (x, y, len, turn, w = 5.6) => `<g transform="translate(${x} ${y}) rotate(${turn})">`+
    shape(P.skin, P.skinShade, `M${-w/2} 2V${-len}Q0 ${-len-w*.8} ${w/2} ${-len}V2Z`)+`</g>`;
  const mitt = oval(P.skin, P.skinShade, 0, -9, 10, 10.5);
  const hands = {
    loose:nub(-8, -8, 6, -62, 6)+mitt,
    open:nub(-8, -8, 8, -62, 6)+nub(-6.5, -15, 9, -16)+nub(-2.2, -17, 11, -5)+nub(2.4, -17, 10.5, 6)+nub(6.6, -15, 8, 17)+mitt,
    point:nub(-3, -15, 15, -3, 6)+nub(-8, -8, 5, -62, 6)+mitt+line(P.skinShade, 1.5, 'M1 -17Q5 -14 6 -9'),
    // Counting hands, a fist, a thumbs up, and two bent fingers for air quotes.
    one:nub(-3, -15, 15, -3, 6)+nub(-8, -8, 5, -62, 6)+mitt+line(P.skinShade, 1.5, 'M1 -17Q5 -14 6 -9'),
    two:nub(-5, -15, 15, -9, 5.8)+nub(2, -16, 15, 7, 5.8)+nub(-8, -8, 5, -62, 6)+mitt+line(P.skinShade, 1.5, 'M5 -16Q8 -13 8 -8'),
    three:nub(-6, -15, 14, -13, 5.6)+nub(-1, -17, 15.5, -1, 5.6)+nub(4.5, -15.5, 14, 11, 5.6)+nub(-8, -8, 5, -62, 6)+mitt,
    quote:nub(-5, -15, 8, -9, 5.8)+nub(2, -16, 8, 7, 5.8)+nub(-8, -8, 5, -62, 6)+mitt+line(P.skinShade, 1.5, 'M5 -16Q8 -13 8 -8'),
    fist:nub(-8, -9, 4, -70, 6)+mitt+line(P.skinShade, 1.5, 'M-5 -17Q0 -15 5 -17M-3 -12H5'),
    thumb:nub(-7, -15, 14, -12, 6.6)+mitt+line(P.skinShade, 1.5, 'M-1 -15Q4 -13 6 -9M-1 -10H6'),
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
  // `stride` is where a walker is in their step, in radians: each foot lifts in turn. Undefined means standing still.
  function legs(turn = 0, stride) {
    const gap = 17-Math.abs(turn)*9, toe = turn*9;
    return [-1, 1].map(side => { const lift = stride === undefined ? 0 : Math.max(0, side*Math.sin(stride))*13, reach = stride === undefined ? 0 : side*Math.cos(stride)*5*Math.sign(turn || 1);
      return tube(`M${side*gap} 126L${side*gap+reach} ${262-lift}`, 21, P.legs, P.legsShade)+oval(P.shoe, P.shoeShade, side*gap+toe+side*3+reach, 270-lift, 19, 9); }).join('');
  }
  // Legs of someone sitting on a sofa or bench, seen from the front: the thighs point at the viewer, so each is
  // a rounded knee over the lap, with the shin hanging below it. Drawn over the body's hem. Feet land at y 238.
  function sitLegs(turn = 0) {
    const gap = 19-Math.abs(turn)*7, toe = turn*10;
    return [-1, 1].map(side => tube(`M${side*gap+toe*.4} 150V226`, 20, P.legs, P.legsShade)+oval(P.shoe, P.shoeShade, side*gap+toe+side*3, 238, 19, 9.5)).join('')+
      [-1, 1].map(side => oval(P.legs, P.legsShade, side*gap, 143, 15, 17)).join('');
  }
  // The acting figure: seated behind a table, standing with legs, or (sitting) on a seat with legs in view.
  // The near arm is the screen-left one.
  function figure({ elbow, wrist, hand, prop, farProp, far = REST_FAR, over = false, standing = false, sitting = false, stride, turn = .55, look, mouth, gaze, lid, brow, tilt = 0, bob = 0, lean = 0, breath = 0 }) {
    // A soft shadow under the feet keeps a standing figure on the floor. Some people always hold something.
    const shadow = standing ? `<ellipse cx="0" cy="${sitting ? 242 : 273}" rx="46" ry="8" fill="#1d2420" opacity=".13"/>` : '', held = prop ?? P.holds?.[standing && !sitting ? 'standing' : 'seated'];
    return `<g transform="rotate(${lean})">${shadow}${standing && !sitting ? legs(turn, stride) : ''}${hood}${neck}<g transform="translate(0 ${-breath})">${body(turn)}${phones}</g>${sitting ? sitLegs(turn) : ''}${arm(FAR, far.elbow, far.wrist, far.hand, farProp)}${over ? '' : arm(NEAR, elbow, wrist, hand, held)}`+
      `<g transform="translate(0 ${-2-breath*1.4}) scale(${HEAD})">${head({ turn, look, mouth, gaze, lid, brow, tilt, bob })}</g>${over ? arm(NEAR, elbow, wrist, hand, held) : ''}</g>`;
  }
  // The same person from behind, for the near edge of someone else's shot.
  function behind() {
    const top = CY-RY, chin = CY+RY, id = `back${serial++}`;
    const egg = `M0 ${top}C${R*.92} ${top} ${R} ${CY-32} ${R} ${CY-8}C${R} ${CY+30} ${R*.52} ${chin} 0 ${chin}C${-R*.52} ${chin} ${-R} ${CY+30} ${-R} ${CY-8}C${-R} ${CY-32} ${-R*.92} ${top} 0 ${top}Z`;
    const long = style.long || style.fall !== undefined ? `<path fill="${P.hair}" d="M${-R-6} ${CY-12}V8Q${-R-6} 24 ${-R+12} 24H${R-12}Q${R+6} 24 ${R+6} 8V${CY-12}Z"/>` : '';
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
    const snaps = [{ frame:0, state }], flickers = [], walks = [];
    for (const beat of beats) {
      const next = { ...state };
      if (beat.action === 'mood') next.look = moodLooks[beat.arg] ?? 'neutral';
      else if (beat.action === 'face' && expressions[beat.arg]) next.look = beat.arg;
      else if (beat.action === 'pose' && (bodies[beat.arg] || beat.arg === 'rest')) next.pose = beat.arg;
      else if (beat.action === 'rest' && mouths[beat.arg]) next.rest = beat.arg;
      else if (beat.action === 'mouth') next.rest = beatMouths[beat.arg] ?? null;
      else if (beat.action === 'hold') next.hold = props[beat.arg] ? beat.arg : null;
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
      // A walk slides the figure sideways from one offset to another over some frames, stepping as it goes.
      else if (beat.action === 'walk' && beat.arg) walks.push({ frame:beat.frame, from:beat.arg.from, to:beat.arg.to, frames:Math.max(1, beat.arg.frames) });
      state = next;
      if (beat.frame <= 0) snaps[0].state = state; else if (snaps.at(-1).frame === beat.frame) snaps.at(-1).state = state; else snaps.push({ frame:beat.frame, state });
    }
    // Timed eye acting owns the eyelids. The automatic blink is held off while a wink or closed eyes are on, and for
    // 14 frames either side, or a blink landing on a wink reads as both eyes closing (seen 2026-11-12).
    const calm = snaps.map((snap, i) => snap.state.look === 'wink' || snap.state.closed ? [snap.frame-14, (snaps[i+1]?.frame ?? Infinity)+14] : null).filter(Boolean);
    return { id, order, snaps, flickers, walks, calm, ...place(id), standing:!seated, speech:lines.filter(line => line.character === id) };
  });
}

function actorAt(kits, actor, at, cut, clock) {
  const index = actor.snaps.findLastIndex(snap => snap.frame <= at), now = actor.snaps[index], before = actor.snaps[index-1] ?? now;
  const upright = actor.standing && !actor.sitting;   // someone sitting on a sofa uses the seated arm poses, hands in the lap
  const t = index ? settle((at-now.frame)/MOVE) : 1, s = now.state, p = before.state, pose = poseOf(s.pose, upright), from = poseOf(p.pose, upright);
  const seconds = clock/FPS, flip = actor.flip ? -1 : 1;
  const line = actor.speech.find(item => cut.from+at >= item.startFrame && cut.from+at < item.endFrame);
  const cueOf = frame => { if (!line) return 'X'; const sec = (cut.from+frame-line.startFrame)/FPS; return line.cues.find(([start, end]) => sec >= start && sec < end)?.[2] ?? 'X'; };
  const cue = cueOf(at), voice = [-2, -1, 0, 1, 2].reduce((sum, d) => sum+openness[cueOf(at+d)], 0)/5;
  let facing = mix(p.facing, s.facing, t), bob = 1.8*voice, gaze = [0, s.down ? 5 : s.up ? -6 : 0];
  // Where a walk has got to: before the first one starts the figure waits at its starting offset, which may be out of frame.
  let shift = 0, stride;
  for (const walk of actor.walks ?? []) {
    if (at < walk.frame) { if (walk === actor.walks[0]) shift = walk.from; break; }
    const done = Math.min(1, (at-walk.frame)/walk.frames);
    shift = mix(walk.from, walk.to, smooth(done));
    if (done < 1 && walk.from !== walk.to) { const steps = Math.max(2, Math.round(Math.abs(walk.to-walk.from)/85)); stride = done*steps*Math.PI; facing = Math.sign(walk.to-walk.from)*.8; bob += 3.5*Math.abs(Math.sin(stride)); }
  }
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
  const blink = (clock+actor.order*29+actor.id.charCodeAt(actor.id.length-1)*7)%79, steady = actor.calm?.some(([from, to]) => at >= from && at <= to), lid = s.closed ? 1 : blink < 4 && !steady ? [.6, 1, 1, .6][blink] : s.down ? .4 : undefined;
  const tap = pose.typing ? 2.2*Math.sin(clock*1.7) : 0, lift = ['rest', 'type', 'pockets', 'cross'].includes(s.pose) ? 0 : 2.5*voice;
  // Someone holding a thing who needs that hand, for a gesture or for a pose that brings its own prop, carries the
  // thing in the other hand meanwhile. If the pose uses both hands, the thing is not drawn until the hands are free.
  const CARRY_FAR = { elbow:[80, 98], wrist:[94, 46], hand:'loose' };
  const shifted = (made, name, hold) => { const busy = hold && (made.hand !== 'loose' || (made.prop && made.prop !== hold)) && !['carry', 'micup', 'show'].includes(name), own = Boolean(bodies[name]?.far);
    return busy ? { ...made, far:own ? made.far : CARRY_FAR, farProp:own ? undefined : hold, nearProp:made.prop } : { ...made, farProp:undefined, nearProp:made.prop ?? hold ?? undefined }; };
  const poseH = shifted(pose, s.pose, s.hold), fromH = shifted(from, p.pose, p.hold);
  const wrist = mixPoint(from.wrist, pose.wrist, t), farWrist = mixPoint(fromH.far.wrist, poseH.far.wrist, t), half = !index || (at-now.frame)/MOVE >= .45;
  const rise = mix(p.rise, s.rise, t), step = mix(p.step, s.step, t), k = actor.k*(1+.06*step);
  const art = kits[actor.id].figure({
    standing:actor.standing, sitting:actor.sitting, stride, elbow:mixPoint(from.elbow, pose.elbow, t), wrist:[wrist[0]-8*beat, wrist[1]-lift+tap-18*beat], hand:beat > .3 && !s.hold ? 'open' : half ? pose.hand : from.hand, prop:half ? poseH.nearProp : fromH.nearProp, farProp:half ? poseH.farProp : fromH.farProp,
    far:{ elbow:mixPoint(fromH.far.elbow, poseH.far.elbow, t), wrist:[farWrist[0], farWrist[1]-tap], hand:half ? poseH.far.hand : fromH.far.hand }, over:Boolean(half ? pose.front : from.front),
    turn:flip*facing, look:s.look, lid, gaze, brow:line ? 2.2*voice : 0, mouth:cue === 'X' ? s.rest ?? expressions[s.look].mouth : cue,
    tilt:mix(from.tilt ?? 0, pose.tilt ?? 0, t)+accent+(s.down ? 4 : s.up ? -4 : 0)+1.4*(voice-.3)*(line ? 1 : 0)+.5*Math.sin(seconds*1.9+actor.order),
    lean:mix(p.inward, s.inward, t)*Math.sign(facing || 1)*flip+.45*Math.sin(seconds*1.2+1+actor.order*2), bob, breath:1.1*Math.sin(seconds*1.75+actor.order),
  });
  const drawn = `<g transform="translate(${actor.x+shift} ${actor.y+rise+6*step}) scale(${flip*k} ${k})">${art}</g>`;
  // A mark can carry a box the figure is cropped to, as [left, top, width, height]: a webcam tile on a video call.
  if (!actor.clip) return drawn;
  const box = `crop${serial++}`, [bx, by, bw, bh] = actor.clip;
  return `<clipPath id="${box}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10"/></clipPath><g clip-path="url(#${box})">${drawn}</g>`;
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
      return { x:mark.x, y:mark.y+2*mark.scale, k:mark.scale, flip:Boolean(mark.mirror), sitting:Boolean(mark.sit), clip:mark.clip }; };
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
