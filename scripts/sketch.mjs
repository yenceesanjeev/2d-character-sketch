#!/usr/bin/env node
// 2D character sketches from the command line: character sheets, one talking character, and short
// multi-character sketch videos. The drawing is cutout-draw.mjs and cutout-sets.mjs beside this file;
// this file reads character and sketch files, times the lines, gets speech and mouth shapes, and turns
// frames into video. No browser and no npm packages: each frame is an SVG string, rsvg-convert makes it
// a picture and FFmpeg joins the pictures and mixes the sound.
//
//   node sketch.mjs doctor                         check the tools this needs
//   node sketch.mjs sheet [id ...]                 draw characters/<id>.sheet.png (all characters if none named)
//   node sketch.mjs say <id> "words" [options]     one character saying one line -> out/say-<id>-<first words>/sketch.mp4
//   node sketch.mjs render <sketch.json> [options] a whole sketch -> out/<name>/sketch.mp4 and a contact sheet
//   node sketch.mjs script <sketch.json>           print a sketch as a readable script with its estimated length
//   node sketch.mjs starters [id ...|all]           list the ready-made characters and picture them, or copy some into characters/
//   node sketch.mjs options hair|face|props [id]        every hair style, or every thing to hold, on one character -> characters/options-<kind>-<id>.png
//   node sketch.mjs options rooms                  every room, with two of the folder's characters in it -> characters/options-rooms.png
//   node sketch.mjs reactions <id> [name|group ...] a reel of the stock reactions on one character -> out/reactions-<id>/sketch.mp4,
//                                                  a strip per reaction on the contact sheet, and reactions.json
//   node sketch.mjs gestures <id> [name|group ...]  the same for the stock gestures made while talking
//   node sketch.mjs voices                         list the voices each engine offers
//   node sketch.mjs sounds [name ...]              make the free ready sounds (ding, pop, knock, typing, whoosh ...) as sfx/<name>.wav
//   node sketch.mjs credits                        ask ElevenLabs how many credits the user's account has left
//   node sketch.mjs sound "description" --seconds <n> --out sfx/<name>.mp3 [--kind music] [--max-credits <n>] [--replace]
//                                                  a sound effect or music from ElevenLabs, kept as a file (paid)
//   node sketch.mjs export <folder>                copy this skill, complete, to another folder
//
// Options: --dir <workspace> (default: current folder)   --draft (half size, faster, written to out/<name>-draft)
//          --voice say|openvoice|elevenlabs|sarvam|none
//          --max-chars <n>   the most characters of text a paid voice may be sent in this run
//          --retake <line id>[,<line id>]   record those lines again with the same words; the earlier takes go to voice/rejected/
//          --captions bar|box|outline|pop|auto|off   caption every line in that style (overrides the sketch)
//          --face <expression> --pose <pose> --frame wide|medium|close --set <room>   (say only)
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS, W, H, bodies, createCast, createScene, expressions, hairStyles, poseOf, props, table } from './cutout-draw.mjs';
import { builtIn } from './cutout-sets.mjs';
import { CAPTION_STYLES, captionCues, captionSetting, captionSvg, srt } from './captions.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = '0.16.0';
const sha = (input) => createHash('sha256').update(input).digest('hex');
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const onPath = (name) => (process.env.PATH ?? '').split(delimiter).some((dir) => dir && existsSync(join(dir, name)));
const INSTALL = {
  'rsvg-convert': 'Install librsvg (Mac: brew install librsvg. Debian/Ubuntu: apt install librsvg2-bin).',
  ffmpeg: 'Install FFmpeg (Mac: brew install ffmpeg. Debian/Ubuntu: apt install ffmpeg).',
  ffprobe: 'ffprobe comes with FFmpeg (Mac: brew install ffmpeg).',
};

// Run a program, optionally feeding it input, and return what it printed.
function run(command, args, input) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.once('error', (error) =>
      fail(error.code === 'ENOENT' ? new Error(`"${command}" is not installed. ${INSTALL[command] ?? ''}`) : error),
    );
    child.once('close', (code) =>
      code === 0 ? done(Buffer.concat(out)) : fail(new Error(`${command} failed: ${Buffer.concat(err).toString().slice(-400)}`)),
    );
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}
const png = (svg) => run('rsvg-convert', ['-f', 'png'], svg);

// ---- Characters -----------------------------------------------------------------------------------
const HEX = /^#[0-9a-f]{6}$/i;
const tone = (hex, by) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * by))).toString(16).padStart(2, '0')).join('');
const COLOURS = { skin: '#d0976a', hair: '#2b2024', top: '#6d7c8b', inner: '#f1f2ee', legs: '#4a4f5c', shoe: '#3a332f' };
const FRONTS = ['tee', 'shirt', 'open', 'hoodie'], GLASSES = ['rimless', 'thick', 'steel'], PROPS = Object.keys(props), BEARDS = ['full', 'goatee', 'stubble'], HATS = ['beanie', 'cap'];

// Check a character file and fill in everything it leaves out, so a file can be as short as an id and
// a few colours. Each "…Shade" edge colour defaults to a darker tone of its fill.
function character(raw, file) {
  const problems = [], spec = { ...raw };
  const bad = (text) => problems.push(text);
  spec.id = String(spec.id ?? basename(file, '.json'));
  if (!/^[a-z][a-z0-9-]*$/.test(spec.id)) bad(`id "${spec.id}" must be lowercase letters, digits and dashes, starting with a letter`);
  spec.name ??= spec.id;
  for (const [key, fallback] of Object.entries(COLOURS)) {
    spec[key] ??= fallback;
    if (!HEX.test(spec[key])) bad(`${key} "${spec[key]}" must be a colour like #7d8449`);
    else spec[key + 'Shade'] ??= tone(spec[key], 0.8);
  }
  for (const key of ['skinShade', 'topShade', 'innerShade', 'legsShade', 'shoeShade', 'strand', 'mark', 'temple', 'hatColour', 'hatShade'])
    if (spec[key] !== undefined && !HEX.test(spec[key])) bad(`${key} "${spec[key]}" must be a colour like #7d8449`);
  if (HEX.test(spec.hair)) spec.strand ??= tone(spec.hair, 1.5);
  spec.style ??= 'short';
  if (!hairStyles[spec.style]) bad(`style "${spec.style}" is not a hair style. Choose from: ${Object.keys(hairStyles).join(', ')}`);
  spec.front ??= 'tee';
  if (!FRONTS.includes(spec.front)) bad(`front "${spec.front}" must be one of: ${FRONTS.join(', ')}`);
  if (spec.glasses && !GLASSES.includes(spec.glasses)) bad(`glasses "${spec.glasses}" must be one of: ${GLASSES.join(', ')}`);
  if (spec.beard !== undefined && !BEARDS.includes(spec.beard)) bad(`beard "${spec.beard}" must be one of: ${BEARDS.join(', ')}`);
  if (spec.hat !== undefined && !HATS.includes(spec.hat)) bad(`hat "${spec.hat}" must be one of: ${HATS.join(', ')}`);
  if (spec.hat && HEX.test(spec.hatColour ?? '#4a5a6a')) { spec.hatColour ??= '#4a5a6a'; spec.hatShade ??= tone(spec.hatColour, 0.78); }
  spec.height ??= 1;
  if (!(spec.height >= 0.8 && spec.height <= 1.2)) bad('height must be between 0.8 (short) and 1.2 (tall); 1 is average');
  spec.head ??= [49, 60];
  if (!Array.isArray(spec.head) || spec.head.length !== 2 || spec.head.some((n) => !(n >= 40 && n <= 70))) bad('head must be [half-width, half-height], each between 40 and 70');
  spec.sleeve ??= 0.92;
  if (!(spec.sleeve >= 0.2 && spec.sleeve <= 1)) bad('sleeve must be between 0.2 (short) and 1 (to the wrist)');
  spec.waist ??= 54;
  if (!(spec.waist >= 44 && spec.waist <= 66)) bad('waist must be between 44 and 66');
  if (spec.paunch !== undefined && !(spec.paunch >= 0 && spec.paunch <= 8)) bad('paunch must be between 0 and 8');
  spec.resting ??= 'neutral';
  if (!expressions[spec.resting]) bad(`resting "${spec.resting}" is not an expression. Choose from: ${Object.keys(expressions).join(', ')}`);
  for (const [where, prop] of Object.entries(spec.holds ?? {}))
    if (!['standing', 'seated'].includes(where) || !PROPS.includes(prop)) bad(`holds can set "standing" or "seated" to one of: ${PROPS.join(', ')}`);
  if (problems.length) throw new Error(`${file}:\n  - ${problems.join('\n  - ')}`);
  return spec;
}

async function loadCharacters(workspace, only) {
  const folder = join(workspace, 'characters'), specs = {};
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith('.json')).sort();
  for (const name of names) {
    const spec = character(JSON.parse(await readFile(join(folder, name), 'utf8')), join('characters', name));
    specs[spec.id] = spec;
  }
  for (const id of only ?? []) if (!specs[id]) throw new Error(`There is no characters/${id}.json in ${workspace}. Characters here: ${Object.keys(specs).join(', ') || 'none yet'}.`);
  return only?.length ? Object.fromEntries(only.map((id) => [id, specs[id]])) : specs;
}

const label = (x, y, text, size = 14, weight = 400, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="#4a3b31" text-anchor="${anchor}">${esc(text)}</text>`;
const at = (x, y, scale, art) => `<g transform="translate(${x} ${y}) scale(${scale})">${art}</g>`;

// One character's sheet: turnaround, resting face, seated at a table, every expression, every pose.
function sheetSvg(spec, kit) {
  const rest = spec.resting, names = Object.keys(expressions), poses = ['rest', ...Object.keys(bodies).filter((name) => !['lean', 'hang', 'type', 'carry', 'micup', 'show'].includes(name) && !/[NF2]$/.test(name))];
  let out = `<rect width="1600" height="1250" fill="#f7f1e6"/>` + label(40, 46, `${spec.name} · ${spec.id}`, 26, 700, 'start') +
    (spec.description ? label(40, 72, spec.description, 15, 400, 'start') : '');
  [[0, 'front'], [0.55, 'three-quarter'], [1, 'side'], [-0.55, 'other way']].forEach(([turn, name], i) => {
    out += at(120 + i * 190, 262, 0.86, kit.standing(turn, rest, expressions[rest].mouth)) + label(120 + i * 190, 530, name);
  });
  out += at(930, 400, 1.75, kit.head({ turn: 0.5, look: rest, mouth: expressions[rest].mouth })) + label(930, 530, `at rest: ${rest}`, 14, 700);
  out += `<svg x="1090" y="96" width="470" height="356" viewBox="-300 -190 600 455">${kit.figure({ ...poseOf('offer', false), turn: 0.3, look: 'offer', mouth: 'C' })}${table}</svg>` + label(1325, 530, 'seated at a table');
  out += label(40, 590, `Expressions (${names.length}, shared by every character)`, 17, 700, 'start');
  names.forEach((name, i) => {
    const x = 96 + (i % 12) * 128, y = 700 + Math.floor(i / 12) * 132;
    out += at(x, y, 0.62, kit.head({ turn: 0.5, look: name, mouth: expressions[name].mouth })) + label(x, y + 36, name, 12.5);
  });
  out += label(40, 906, 'Poses (standing; "type" is for a seated character)', 17, 700, 'start');
  poses.forEach((name, i) => {
    const pose = poseOf(name, true), x = 70 + (i % 13) * 116, y = 1040 + Math.floor(i / 13) * 240;
    out += at(x, y, 0.5, kit.figure({ ...pose, over: pose.front, standing: true, turn: 0.3, look: 'neutral', mouth: 'X' })) + label(x, y + 152, name, 12.5);
  });
  const tall = 1250 + (Math.ceil(poses.length / 13) - 1) * 240;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${tall}" viewBox="0 0 1600 ${tall}">${out.replace('<rect width="1600" height="1250"', `<rect width="1600" height="${tall}"`)}</svg>`;
}
// Every choice for one part, drawn on one character, so a person can pick by looking: each hair style from the
// front, three-quarter and side. More kinds of part can be added to PARTS as they become choices.
const PARTS = {
  hair: { names: () => Object.keys(hairStyles), with: (spec, name) => ({ ...spec, style: name }) },
  props: { names: () => Object.keys(props) },
  face: { names: () => ['none', 'moustache', 'goatee', 'goatee + moustache', 'full', 'stubble', 'beanie', 'cap', 'cap + full'],
    with: (spec, name) => ({ ...spec, beard: BEARDS.find((kind) => name.includes(kind)), moustache: name.includes('moustache'), hat: HATS.find((kind) => name.includes(kind)), hatColour: spec.hatColour ?? '#4a5a6a', hatShade: spec.hatShade ?? '#3a4855' }) },
};
function propsSvg(spec) {
  const names = Object.keys(props), columns = 7, rows = Math.ceil(names.length / columns), width = 40 + columns * 220, height = 130 + rows * 250, kit = createCast({ one: spec }).one;
  const tiles = names.map((name, i) => at(140 + (i % columns) * 220, 220 + Math.floor(i / columns) * 250, 0.9, `<svg x="-130" y="-150" width="240" height="230" viewBox="-130 -150 240 230">${kit.figure({ ...poseOf(name === 'mic' ? 'micup' : 'carry', true), over: name === 'mic', prop: name, standing: true, turn: 0.3, look: 'neutral', mouth: 'X' })}</svg>`) +
    label(140 + (i % columns) * 220, 220 + Math.floor(i / columns) * 250 + 100, name, 15, 700)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7f1e6"/>` +
    label(40, 46, `${names.length} things to hold, on ${spec.name}`, 22, 700, 'start') + tiles + `</svg>`;
}
function roomsSvg(specs) {
  const names = Object.keys(SETS), columns = 3, rows = Math.ceil(names.length / columns), width = 40 + columns * 500, height = 80 + rows * 330, people = Object.keys(specs).slice(0, 2);
  const tiles = names.map((name, i) => {
    const sketch = { set: name, cast: people.length ? people : [], shots: [{ frame: 'wide', hold: 1 }] }, x = 40 + (i % columns) * 500, y = 70 + Math.floor(i / columns) * 330;
    const made = people.length ? compile(sketch, specs, {}) : null;
    if (made) callQueue = made.cuts.filter((cut) => cut.call).map((cut) => cut.call);
    const art = made ? createScene({ timeline: made, kits: createCast(specs) }).frame(0) : `${builtIn[SETS[name][0]]([]).back}${builtIn[SETS[name][0]]([]).front}`;
    return `<svg x="${x}" y="${y}" width="472" height="266" viewBox="0 0 ${W} ${H}">${art}</svg>` + label(x, y + 290, `${name}  ·  ${ROOM_NOTES[name]}`, 14, 600, 'start');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7f1e6"/>` +
    label(40, 44, `${names.length} rooms`, 22, 700, 'start') + tiles + `</svg>`;
}
function optionsSvg(kind, spec) {
  if (kind === 'props') return propsSvg(spec);
  const names = PARTS[kind].names(), columns = 5, rows = Math.ceil(names.length / columns), width = 40 + columns * 372, height = 90 + rows * 226;
  const tiles = names.map((name, i) => {
    const x = 40 + (i % columns) * 372, y = 86 + Math.floor(i / columns) * 226, kit = createCast({ one: PARTS[kind].with(spec, name) }).one;
    return [[0, 62], [0.55, 178], [1, 294]].map(([turn, dx]) => at(x + dx, y + 150, 0.9, kit.head({ turn, look: 'neutral', mouth: 'X' }))).join('') + label(x + 178, y + 196, name, 15, 700);
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7f1e6"/>` +
    label(40, 46, `${names.length} ${kind} choices, on ${spec.name}: front, three-quarter, side`, 22, 700, 'start') + tiles + `</svg>`;
}

// Everyone side by side, to check they read as different people.
function lineupSvg(specs, kits) {
  const ids = Object.keys(specs), width = Math.max(600, 120 + ids.length * 200);
  const figures = ids.map((id, i) => at(160 + i * 200, 250 + 273 * 0.9 * (1 - specs[id].height), 0.9 * specs[id].height, kits[id].standing(i % 2 ? -0.3 : 0.3, specs[id].resting, expressions[specs[id].resting].mouth)) + label(160 + i * 200, 540, `${specs[id].name} · ${id}`, 15, 700)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="580" viewBox="0 0 ${width} 580"><rect width="${width}" height="580" fill="#f7f1e6"/>${figures}</svg>`;
}

async function sheets(workspace, only) {
  const specs = await loadCharacters(workspace, only), ids = Object.keys(specs);
  if (!ids.length) throw new Error(`No character files in ${join(workspace, 'characters')}. Write characters/<id>.json first; see references/character.md.`);
  const kits = createCast(specs);
  for (const id of ids) {
    const file = join(workspace, 'characters', `${id}.sheet.png`);
    await writeFile(file, await png(sheetSvg(specs[id], kits[id])));
    console.log(file);
  }
  const all = await loadCharacters(workspace);
  if (Object.keys(all).length > 1) {
    const file = join(workspace, 'characters', 'cast.png');
    await writeFile(file, await png(lineupSvg(all, createCast(all))));
    console.log(file);
  }
}

// ---- Rooms ------------------------------------------------------------------------------------------
// Extra rooms for standing sketches, in the same 960 x 540 units and the same rules as the built-in
// ones: flat fills, quieter than the people, and nothing busy in the band where heads sit (y 110-260).
const box = (x, y, w, h, fill, rx = 0, more = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${more}/>`;
const rooms = {
  plain: () => ({ back: box(-600, -400, 2200, 1500, '#e6dfd0') + box(-600, 404, 2200, 700, '#cfc6b3') + box(-600, 404, 2200, 5, '#bdb39f'), front: '' }),
  home: () => ({
    back: box(-600, -400, 2200, 1500, '#e8dcc8') + box(-600, 404, 2200, 700, '#c2a985') + box(-600, 396, 2200, 9, '#d9ccb5') +
      // A window and two small pictures, all above the heads.
      box(388, 18, 184, 78, '#c9b596', 4) + box(395, 25, 170, 64, '#dfeae6') + `<path fill="#eef5f1" d="M395 25H470L420 89H395Z"/>` + box(477, 25, 6, 64, '#c9b596') +
      box(140, 30, 70, 54, '#c9b596', 3) + box(147, 37, 56, 40, '#d9c9a8') + box(752, 30, 70, 54, '#c9b596', 3) + box(759, 37, 56, 40, '#c7d3c2') +
      // A sofa and a side table, below chin height. The seat is at sitting height: its top is where a sitter's lap is.
      box(262, 290, 436, 150, '#a5b3a6', 26, ' stroke="#8b9a8c" stroke-width="1.8"') + box(226, 336, 52, 108, '#aebbae', 20, ' stroke="#8b9a8c" stroke-width="1.8"') + box(682, 336, 52, 108, '#aebbae', 20, ' stroke="#8b9a8c" stroke-width="1.8"') +
      box(268, 368, 424, 76, '#b3c0b3', 16, ' stroke="#8b9a8c" stroke-width="1.8"') +
      box(-20, 330, 96, 10, '#b89a72', 3) + box(-10, 340, 10, 76, '#a3855f') + box(56, 340, 10, 76, '#a3855f') +
      `<path fill="#e9d9a8" d="M10 296H46L54 330H2Z"/>` + box(880, 300, 60, 116, '#b89a72', 4, ' stroke="#a3855f" stroke-width="1.8"') +
      `<path fill="#a9795a" d="M894 276H926L922 300H898Z"/><path fill="none" stroke="#7e9a6c" stroke-width="6" stroke-linecap="round" d="M910 276Q902 248 886 240M910 276Q912 242 928 232M910 276Q922 256 940 258"/>` +
      `<ellipse cx="480" cy="470" rx="330" ry="46" fill="#d3bf9f"/>`,
    front: '',
  }),
  park: () => ({
    back: box(-600, -400, 2200, 1500, '#d6e6ea') + `<ellipse cx="170" cy="62" rx="70" ry="16" fill="#eaf2f3"/><ellipse cx="230" cy="52" rx="46" ry="14" fill="#eaf2f3"/><ellipse cx="720" cy="40" rx="80" ry="15" fill="#eaf2f3"/>` +
      `<path fill="#b9cfb4" d="M-600 330Q-200 270 200 318T960 300T1600 326V420H-600Z"/>` + box(-600, 380, 2200, 800, '#bdd0a3') + box(-600, 380, 2200, 6, '#adc294') +
      `<path fill="#dccfb2" d="M-600 452H1600V500H-600Z"/>` +
      // A tree at each edge, clear of where people stand, and a bench between them, below chin height.
      box(-28, 150, 26, 240, '#9a8266') + `<ellipse cx="-16" cy="96" rx="92" ry="84" fill="#9bb588"/>` + box(968, 170, 24, 220, '#9a8266') + `<ellipse cx="982" cy="120" rx="80" ry="74" fill="#a6bd92"/>` +
      box(352, 372, 12, 74, '#8e7758') + box(596, 372, 12, 74, '#8e7758') + box(340, 306, 280, 13, '#b89a72', 3) + box(340, 328, 280, 13, '#b89a72', 3) + box(332, 366, 296, 15, '#c2a47b', 4),
    front: '',
  }),
  // Work places, added 2026-11-12. Each keeps the band where heads sit (y 110 to 260) plain, puts its detail above the
  // heads, below the chins or at the edges, and has its floor line near y 400.
  conference: () => ({   // a talk on a stage: a screen above, banners at the sides, the audience's heads along the bottom
    back: box(-600, -400, 2200, 1500, '#dcd8e6') + box(300, 14, 360, 86, '#c3bdd6', 6) + box(308, 22, 344, 70, '#eceaf4', 3) +
      `<path stroke="#b7b0cf" stroke-width="5" stroke-linecap="round" d="M336 44H520M336 60H470M336 76H560"/>` +
      box(16, 120, 70, 284, '#b9b0d0', 4) + box(24, 132, 54, 40, '#cfc8e2', 3) + box(874, 120, 70, 284, '#b9b0d0', 4) + box(882, 132, 54, 40, '#cfc8e2', 3) +
      box(-600, 396, 2200, 800, '#b7a88f') + box(-600, 396, 2200, 8, '#cdbfa6') + box(-600, 470, 2200, 12, '#a39378'),
    front: [60, 190, 330, 470, 610, 750, 890].map((x, i) => `<ellipse cx="${x}" cy="${548 - (i % 2) * 6}" rx="46" ry="42" fill="#8f8a9c"/>`).join(''),
  }),
  terrace: () => ({   // an office roof terrace: sky, a pale skyline below chin height, a glass rail, decking and planters
    back: box(-600, -400, 2200, 1500, '#d3e5ee') + `<ellipse cx="760" cy="56" rx="90" ry="17" fill="#e8f1f4"/><ellipse cx="200" cy="74" rx="70" ry="14" fill="#e8f1f4"/><circle cx="880" cy="60" r="26" fill="#f4ecc8"/>` +
      [[-20, 300, 90], [90, 282, 70], [180, 310, 110], [320, 290, 60], [400, 305, 120], [550, 284, 80], [650, 300, 100], [770, 288, 70], [860, 306, 120]].map(([x, y, w]) => box(x, y, w, 110, '#c2d3db')).join('') +
      box(-600, 396, 2200, 800, '#cdbfa6') + [420, 446, 474, 504].map((y) => box(-600, y, 2200, 2, '#b9aa90')).join('') +
      box(-600, 332, 2200, 6, '#9fb0b6') + [60, 250, 440, 630, 820].map((x) => box(x, 332, 6, 66, '#9fb0b6')).join('') + box(-600, 338, 2200, 58, '#e3eef1', 0, ' fill-opacity=".45"') +
      box(-10, 356, 84, 48, '#a98f6f', 4) + `<ellipse cx="32" cy="344" rx="46" ry="26" fill="#8fb07c"/>` + box(886, 356, 84, 48, '#a98f6f', 4) + `<ellipse cx="928" cy="344" rx="46" ry="26" fill="#9bb888"/>`,
    front: '',
  }),
  kitchen: () => ({   // an office kitchen: cupboards above, a counter with a coffee machine below, a fridge at the edge
    back: box(-600, -400, 2200, 1500, '#e8e3d6') + [40, 250, 460, 670].map((x) => box(x, 14, 200, 84, '#cfc7b4', 5, ' stroke="#b9b09b" stroke-width="1.8"') + box(x + 92, 50, 16, 5, '#a59c86', 2)).join('') +
      box(-600, 396, 2200, 800, '#cfc8ba') + [0, 160, 320, 480, 640, 800].map((x) => box(x, 396, 2, 300, '#bdb5a6')).join('') +
      box(0, 322, 780, 12, '#ddd6c8', 3) + box(10, 334, 760, 70, '#b7ae9b') + [200, 390, 580].map((x) => box(x, 340, 3, 58, '#a59c86')).join('') +
      box(90, 276, 62, 46, '#55585f', 5) + box(100, 284, 42, 16, '#8c9197', 2) + box(112, 306, 18, 16, '#ece7db', 3) + box(600, 292, 34, 30, '#c9cdd0', 5) + box(612, 286, 10, 8, '#8c9197', 2) +
      box(824, 140, 116, 264, '#d5d9db', 8, ' stroke="#b3b9bc" stroke-width="1.8"') + box(824, 232, 116, 3, '#b3b9bc') + box(834, 170, 6, 40, '#9aa1a5', 3) + box(834, 250, 6, 60, '#9aa1a5', 3),
    front: '',
  }),
  reception: () => ({   // a lobby: a sign above, the front desk at one side, a plant at the other
    back: box(-600, -400, 2200, 1500, '#e4dfd3') + box(-600, 96, 2200, 4, '#d4cebf') + `<circle cx="430" cy="52" r="20" fill="#7fa3a0"/>` + box(462, 38, 90, 10, '#9fb8b5', 4) + box(462, 56, 62, 8, '#bccbc8', 4) +
      box(-600, 396, 2200, 800, '#c9c0af') + box(-600, 396, 2200, 6, '#d8d0c0') + `<ellipse cx="480" cy="472" rx="360" ry="40" fill="#bfb5a2"/>` +
      box(-30, 312, 250, 14, '#c9b596', 4) + box(-20, 326, 230, 84, '#a98f6f', 3) + box(-20, 326, 230, 6, '#977f61') + box(40, 280, 44, 32, '#55585f', 4) + box(56, 312, 12, 4, '#3d4046') +
      box(880, 330, 56, 74, '#b89a72', 5) + `<path fill="none" stroke="#7e9a6c" stroke-width="7" stroke-linecap="round" d="M908 330Q896 290 874 280M908 330Q910 286 932 270M908 330Q924 300 948 302"/>`,
    front: '',
  }),
  cafe: () => ({   // a coffee shop: menu boards above, a counter with a pastry case, hanging lamps
    back: box(-600, -400, 2200, 1500, '#ecdfcc') + [120, 400, 680].map((x) => box(x, 16, 200, 78, '#5d5248', 5) + `<path stroke="#c9bfae" stroke-width="3" stroke-linecap="round" d="M${x + 20} 38H${x + 150}M${x + 20} 54H${x + 110}M${x + 20} 70H${x + 170}"/>`).join('') +
      [60, 360, 640, 900].map((x) => box(x, -20, 2, 60, '#8e7758') + `<path fill="#d9a441" d="M${x - 16} 54Q${x} 30 ${x + 18} 54Z"/>`).join('') +
      box(-600, 396, 2200, 800, '#b99670') + [430, 462, 496].map((y) => box(-600, y, 2200, 2, '#a5835f')).join('') +
      box(120, 320, 720, 12, '#8e7758', 3) + box(130, 332, 700, 72, '#a98f6f') + box(130, 332, 700, 6, '#977f61') +
      box(560, 270, 200, 50, '#e6eef0', 6, ' fill-opacity=".8" stroke="#b3bdc0" stroke-width="1.8"') + `<circle cx="600" cy="302" r="10" fill="#d9a05a"/><circle cx="640" cy="302" r="10" fill="#c98a4a"/><circle cx="680" cy="302" r="10" fill="#e0b070"/><circle cx="720" cy="302" r="10" fill="#b5533c"/>` +
      box(190, 270, 56, 50, '#55585f', 5) + box(200, 280, 36, 14, '#8c9197', 2),
    front: '',
  }),
  corridor: () => ({   // an office corridor: a door at each side, a strip of carpet, lights above
    back: box(-600, -400, 2200, 1500, '#e0dcd2') + [180, 480, 780].map((x) => box(x - 50, 10, 100, 10, '#f3f0e6', 5)).join('') + box(-600, 300, 2200, 4, '#d0cabd') +
      box(-600, 396, 2200, 800, '#b8b2c2') + box(-600, 396, 2200, 8, '#cdc8d3') + box(-600, 440, 2200, 44, '#aaa3b7') +
      [[36, '#c3b59d'], [820, '#c3b59d']].map(([x, fill]) => box(x, 130, 104, 270, fill, 3, ' stroke="#a59880" stroke-width="2"') + box(x + 14, 148, 76, 60, '#dfeae6', 2) + `<circle cx="${x + 88}" cy="278" r="5" fill="#8c9197"/>`).join('') +
      box(440, 318, 80, 6, '#c9b596', 2) + box(456, 324, 6, 76, '#a98f6f') + box(498, 324, 6, 76, '#a98f6f') + box(462, 296, 36, 22, '#8fb07c', 8),
    front: '',
  }),
};
Object.assign(builtIn, rooms);
// "laptops": ["maya"] in a sketch or scene puts an open laptop, seen from behind its lid, on the table in
// front of each person named. Only the `table` room has a table to put it on.
let laptops = new Set();
// A video call. Each shot of a call has its own layout: the gallery of everyone, or one person's tile large.
// The drawing code asks for a room once per shot, in order, so the layouts wait here in that order.
let callQueue = [];
const CALL_WALLS = ['#a9b6c2', '#d8c8ae', '#b7c4b0', '#c9b6c9', '#c2bfae', '#aebccd'];
// Square tiles for n people: one, two or three in a row, then rows of two or three. Each is [left, top, side].
function callTiles(n) {
  const columns = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / columns), gap = 16;
  const side = Math.min((W - 40 - (columns - 1) * gap) / columns, (H - 40 - (rows - 1) * gap) / rows, 440);
  const top = (H - rows * side - (rows - 1) * gap) / 2;
  return Array.from({ length: n }, (_, i) => { const row = Math.floor(i / columns), inRow = Math.min(columns, n - row * columns);
    return [(W - inRow * side - (inRow - 1) * gap) / 2 + (i % columns) * (side + gap), top + row * (side + gap), side]; });
}
builtIn.call = () => {
  const layout = callQueue.shift() ?? { tiles: [] }, hole = ([x, y, side]) => `M${x + 10} ${y}h${side - 20}a10 10 0 0 1 10 10v${side - 20}a10 10 0 0 1 -10 10h${-(side - 20)}a10 10 0 0 1 -10 -10v${-(side - 20)}a10 10 0 0 1 10 -10Z`;
  const walls = layout.tiles.map(({ box: [x, y, side], wall }, i) => box(x, y, side, side, wall) + box(x, y + side * 0.72, side, side * 0.28, tone(wall, 0.9)) +
    (i % 3 === 0 ? box(x + side * 0.08, y + side * 0.08, side * 0.2, side * 0.15, tone(wall, 1.12), 3) : i % 3 === 1 ? box(x + side * 0.7, y + side * 0.1, side * 0.22, side * 0.04, tone(wall, 0.82)) + box(x + side * 0.74, y + side * 0.03, side * 0.05, side * 0.07, tone(wall, 0.75)) : `<circle cx="${x + side * 0.84}" cy="${y + side * 0.14}" r="${side * 0.06}" fill="${tone(wall, 1.12)}"/>`)).join('');
  // Everything outside the tiles is the dark screen, drawn in front, so each person is cropped by their own tile like a webcam.
  const frame = `<path fill="#1f2228" fill-rule="evenodd" d="M-600 -400H1600V1100H-600Z${layout.tiles.map(({ box: tile }) => hole(tile)).join('')}"/>`;
  const tags = layout.tiles.map(({ box: [x, y, side], name, speaking }) => (speaking ? `<path fill="none" stroke="#4fbf73" stroke-width="4" d="${hole([x, y, side])}"/>` : '') +
    `<rect x="${x + 10}" y="${y + side - 32}" width="${name.length * 8.4 + 18}" height="22" rx="5" fill="#000" fill-opacity=".5"/><text x="${x + 19}" y="${y + side - 16}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#fff">${name}</text>`).join('');
  return { back: box(-600, -400, 2200, 1500, '#1f2228') + walls, front: frame + tags };
};
const bareTable = builtIn.meeting;
builtIn.meeting = (seats) => {
  const room = bareTable(seats);
  const lids = seats.filter(({ id }) => laptops.has(id)).map(({ x }) => box(x - 33, 327, 66, 36, '#cdd2d5', 5, ' stroke="#aab1b5" stroke-width="1.8"') + `<circle cx="${x}" cy="344" r="4" fill="#aab1b5"/>`).join('');
  return { ...room, front: room.front + lids };
};
// The name a sketch uses -> the name the drawing code knows, and whether people sit.
const SETS = { plain: ['plain', false], home: ['home', false], park: ['park', false], office: ['floor', false], table: ['meeting', true],
  conference: ['conference', false], terrace: ['terrace', false], kitchen: ['kitchen', false], reception: ['reception', false], cafe: ['cafe', false], corridor: ['corridor', false], call: ['call', false] };
const ROOM_NOTES = { plain: 'An empty wall and floor', home: 'A living room with a sofa to sit on', park: 'Grass, a path and a bench to sit on', office: 'An open office floor with desks', table: 'A glass-walled meeting room; everyone sits at the table',
  conference: 'A talk on a stage, with a screen and an audience', terrace: 'An office roof terrace with a skyline', kitchen: 'An office kitchen with a coffee machine', reception: 'A lobby with a front desk', cafe: 'A coffee shop counter', corridor: 'An office corridor with doors', call: 'A video call: everyone in a square tile, looking at their own screen' };
// Rooms with something to sit on: the middle of the seat and how far apart two sitters are. `"sit": true` on a cast entry uses it.
const SEATING = { home: { middle: 480, gap: 230, most: 2, what: 'the sofa' }, park: { middle: 480, gap: 190, most: 2, what: 'the bench' } };

// ---- Speech and mouth shapes --------------------------------------------------------------------------
const SAY_ORDER = ['Samantha', 'Daniel', 'Karen', 'Fred', 'Moira', 'Ralph', 'Kathy', 'Albert'];
async function sayVoices() {
  if (process.platform !== 'darwin' || !onPath('say')) return [];
  const text = (await run('say', ['-v', '?'])).toString();
  return text.split('\n').map((row) => row.match(/^(.+?)\s+([a-z]{2}_[A-Z0-9]+)\s+#/)).filter(Boolean).map(([, name, locale]) => ({ name: name.trim(), locale }));
}
const estimate = (text) => Math.max(0.8, text.trim().split(/\s+/).length * 0.36 + 0.3);
// Mouth shapes guessed from the words alone, for a line with no recording: one open shape per syllable.
function cuesFromText(text, duration) {
  const words = text.trim().split(/\s+/), cycle = ['C', 'B', 'D', 'B', 'E', 'C', 'F', 'B'], parts = [];
  for (const word of words) {
    const syllables = Math.max(1, (word.match(/[aeiouy]+/gi) ?? []).length);
    for (let i = 0; i < syllables; i++) parts.push([1, cycle[parts.length % cycle.length]]);
    parts.push([/[.,;:!?…-]$/.test(word) ? 1.6 : 0.35, 'X']);
  }
  const total = parts.reduce((sum, [weight]) => sum + weight, 0), cues = [];
  let clock = 0;
  for (const [weight, shape] of parts) { const end = clock + (weight / total) * duration; cues.push([clock, end, shape]); clock = end; }
  return cues;
}
// Mouth shapes from how loud the recording is, 30 times a second. Rougher than Rhubarb: it opens and
// closes in time with the voice but does not know which sound is being made.
async function cuesFromLoudness(wav) {
  const pcm = await run('ffmpeg', ['-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 's16le', '-']);
  const step = Math.round(16000 / 30), levels = [];
  for (let start = 0; start + step * 2 <= pcm.length; start += step * 2) {
    let sum = 0;
    for (let i = 0; i < step; i++) { const v = pcm.readInt16LE(start + i * 2) / 32768; sum += v * v; }
    levels.push(Math.sqrt(sum / step));
  }
  const peak = [...levels].sort((a, b) => a - b)[Math.floor(levels.length * 0.95)] || 1;
  const shapes = levels.map((level) => { const v = level / peak; return v < 0.1 ? 'X' : v < 0.3 ? 'B' : v < 0.55 ? 'C' : v < 0.8 ? 'E' : 'D'; });
  for (let i = 1; i < shapes.length - 1; i++) if (shapes[i - 1] === shapes[i + 1] && shapes[i] !== shapes[i - 1]) shapes[i] = shapes[i - 1];   // no one-step flickers
  const cues = [];
  shapes.forEach((shape, i) => { if (cues.at(-1)?.[2] === shape) cues.at(-1)[1] = (i + 1) / 30; else cues.push([i / 30, (i + 1) / 30, shape]); });
  return cues;
}
// Rhubarb Lip Sync: RHUBARB if set, then the PATH, then the folder install-rhubarb.sh puts it in.
const rhubarbHome = () => process.env.RHUBARB_HOME ?? join(homedir(), '.2d-character-sketch', 'rhubarb');
const rhubarbPath = () => process.env.RHUBARB ?? (onPath('rhubarb') ? 'rhubarb' : existsSync(join(rhubarbHome(), 'ready')) ? join(rhubarbHome(), 'rhubarb') : null);
async function measure(wav) {
  const duration = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav])).toString());
  const rhubarb = rhubarbPath();
  if (rhubarb) {
    const data = JSON.parse((await run(rhubarb, ['-f', 'json', '--machineReadable', wav])).toString());
    return { duration, cues: data.mouthCues.map((cue) => [cue.start, cue.end, cue.value]), cuesFrom: 'rhubarb' };
  }
  return { duration, cues: await cuesFromLoudness(wav), cuesFrom: 'loudness' };
}

// API keys for the paid voices live in one file the user keeps: .env.local in the working folder. The
// skill ships .env.example, which names every key with its value left empty; it is copied to .env.local
// and the user fills in the values. A key already in the environment is used too, and so is
// ~/.2d-character-sketch/keys.env, which earlier versions wrote. The value is never printed, and a key
// file inside a git repository is refused unless git ignores it.
const KEY_NAMES = { elevenlabs: 'ELEVENLABS_API_KEY', sarvam: 'SARVAM_API_KEY' };
const keyFile = () => join(homedir(), '.2d-character-sketch', 'keys.env');
const keyHelp = (engine) => `No ${KEY_NAMES[engine]} was found. Copy ${join(HERE, '..', '.env.example')} to .env.local in the working folder (you can do that; it holds no key), make sure .gitignore lists .env.local, then ask the user to open .env.local and paste their key after "${KEY_NAMES[engine]}=". Do not ask them to paste the key into the chat.`;
async function findKey(workspace, name) {
  if (process.env[name]?.trim()) return { value: process.env[name].trim(), from: 'the environment' };
  for (const file of [join(workspace, '.env.local'), join(workspace, '.env'), keyFile()]) {
    const text = await readFile(file, 'utf8').catch(() => null);
    const row = text?.split('\n').map((line) => line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).find((match) => match?.[1] === name);
    const value = row?.[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!value) continue;
    if (file.startsWith(workspace)) {
      const inRepo = await run('git', ['-C', workspace, 'rev-parse', '--is-inside-work-tree']).then(() => true, () => false);
      const ignored = inRepo && (await run('git', ['-C', workspace, 'check-ignore', '-q', file]).then(() => true, () => false));
      if (inRepo && !ignored) throw new Error(`${file} holds ${name} but git does not ignore that file, so the key could be committed. Add "${basename(file)}" to .gitignore, then run again.`);
    }
    return { value, from: file };
  }
  return null;
}
// The free local voice: MeloTTS, the speech model of OpenVoice V2, installed by install-openvoice.sh.
const OPENVOICE_VOICES = ['EN-US', 'EN-BR', 'EN_INDIA', 'EN-AU', 'EN-Default'];
const openvoiceHome = () => process.env.OPENVOICE_HOME ?? join(homedir(), '.2d-character-sketch', 'openvoice');
const openvoiceReady = () => existsSync(join(openvoiceHome(), 'venv/bin/python')) && existsSync(join(openvoiceHome(), 'ready'));
const ENGINES = ['say', 'openvoice', 'elevenlabs', 'sarvam', 'none'];
const defaultEngine = () => (process.platform === 'darwin' && onPath('say') ? 'say' : openvoiceReady() ? 'openvoice' : 'none');

// Set a file aside in a "rejected" folder beside it, under a name that is not taken. A take that came
// back wrong is evidence of what the voice did, so it is kept, never deleted.
async function setAside(file) {
  const folder = join(dirname(file), 'rejected'), dot = basename(file).indexOf('.'), stem = basename(file).slice(0, dot), ext = basename(file).slice(dot);
  await mkdir(folder, { recursive: true });
  let n = 1;
  while (existsSync(join(folder, `${stem}-take${n}${ext}`))) n++;
  await rename(file, join(folder, `${stem}-take${n}${ext}`));
  return join(folder, `${stem}-take${n}${ext}`);
}
// Get a recording and mouth shapes for every line. Recordings are kept in voice/ under a name made from
// the words, the voice and the engine, so an unchanged line is never generated (or paid for) twice.
// A line can carry a delivery cue in square brackets, such as "[dry, unimpressed] This is coffee."
// ElevenLabs acts on it. The free voices would read it aloud, so they are given the words without it.
const spoken = (text) => text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
// What a paid run would cost, as far as it can be known before sending: ElevenLabs charges about one
// credit per character, and the account can say how many credits are left. Sarvam's price is per character.
// Prices read from elevenlabs.io/pricing on 2026-11-12: one credit per character of speech; the Starter
// plan is $6 a month for 30,000 credits, which is $0.20 per 1,000. Observed here the same day: 53
// characters cost 53 credits with eleven_v4.
const EL_USD_PER_1000 = 0.2;
const dollars = (credits) => `$${((credits / 1000) * EL_USD_PER_1000).toFixed(2)}`;
// How many credits the ElevenLabs account has left. Sends the key and nothing else.
async function elevenlabsBalance(key) {
  const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key.value }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`ElevenLabs would not report the balance (${response.status}): ${(await response.text()).slice(0, 160)}`);
  const plan = await response.json(), left = plan.character_limit - plan.character_count;
  if (!Number.isFinite(left)) throw new Error('ElevenLabs did not report a balance.');
  return { left, limit: plan.character_limit, tier: plan.tier ?? null };
}
async function costNote(engine, need, key) {
  if (engine === 'sarvam') return `At Sarvam's listed price for bulbul:v4-flash (Rs 1 per 1,000 characters, read 2026-11-11) that is about Rs ${(need / 1000).toFixed(2)}.`;
  let left = '';
  try {
    const balance = await elevenlabsBalance(key);
    left = ` The account has ${balance.left} of ${balance.limit} credits left in this period${balance.left < need ? `, which is NOT ENOUGH: ElevenLabs will refuse the run. A new key on the same account does not add credits; the account's plan has to change` : ''}.`;
  } catch { /* the estimate still stands without the balance */ }
  return `Estimated cost: about ${need} ElevenLabs credits at one credit per character, about ${dollars(need)} at the Starter plan's rate.${left} The exact charge is written to run.json afterwards.`;
}
async function speak(workspace, lines, specs, engine, options) {
  const folder = join(workspace, 'voice'), installed = engine === 'say' || lines.some((line) => line.voice === 'say') ? await sayVoices() : [];
  const order = Object.keys(specs), receipt = { engine, generated: 0, reused: 0, recovered: 0, characters: 0, credits: 0, rejected: [] };
  const paidName = { elevenlabs: 'ElevenLabs', sarvam: 'Sarvam' }[engine];
  const voiceOf = (id, engine) => {
    const saved = specs[id].voice?.[engine];
    if (engine === 'elevenlabs' && !saved) throw new Error(`characters/${id}.json needs "voice": { "elevenlabs": "<voice id>" } before ElevenLabs can speak for ${id}.`);
    if (engine === 'sarvam' && !saved) throw new Error(`characters/${id}.json needs "voice": { "sarvam": "<speaker>" } before Sarvam can speak for ${id}. Speakers are listed at https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices`);
    if (engine === 'elevenlabs' || engine === 'sarvam') return saved;
    if (engine === 'openvoice') {
      if (saved && !OPENVOICE_VOICES.includes(saved)) throw new Error(`"${saved}" is not an openvoice voice. Choose from: ${OPENVOICE_VOICES.join(', ')}`);
      return saved ?? OPENVOICE_VOICES[order.indexOf(id) % OPENVOICE_VOICES.length];
    }
    if (saved && !installed.some((voice) => voice.name === saved)) throw new Error(`"${saved}" is not a voice on this machine. Run "sketch.mjs voices" to list them.`);
    const usable = SAY_ORDER.filter((name) => installed.some((voice) => voice.name === name));
    return saved ?? usable[order.indexOf(id) % usable.length] ?? installed[0]?.name;
  };
  if (paidName) {
    const without = [...new Set(lines.filter((line) => !line.audio && !line.voice).map((line) => line.who))].filter((id) => !specs[id].voice?.[engine]);
    if (without.length) throw new Error(`${paidName} needs a voice for each speaking character, and ${without.join(' and ')} ${without.length > 1 ? 'have' : 'has'} none. Add "voice": { "${engine}": "<${engine === 'elevenlabs' ? 'voice id' : 'speaker'}>" } to ${without.map((id) => `characters/${id}.json`).join(' and ')}. ` +
      (engine === 'elevenlabs' ? 'Run "sketch.mjs voices" to list the voices on the user\'s ElevenLabs account with their ids, and let the user choose.' : 'Speakers are listed at https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices') + ' Nothing was sent.');
  }
  const jobs = [];
  for (const line of lines) {
    if (line.audio) {
      const source = resolve(workspace, line.audio);
      if (!existsSync(source)) throw new Error(`${line.id}: the recording ${line.audio} does not exist.`);
      jobs.push({ line, engine: 'file', voice: sha(await readFile(source)).slice(0, 12), source });
    } else if ((line.voice ?? engine) !== 'none') {
      // A line can ask for one of the free voices, so one robotic line can sit inside a paid sketch.
      const own = line.voice ?? engine;
      if (own === 'say' && !(process.platform === 'darwin' && onPath('say'))) throw new Error(`${line.id}: the "say" voice only exists on a Mac.`);
      jobs.push({ line, engine: own, voice: voiceOf(line.who, own) });
    }
  }
  // A free openvoice line at a speed other than 1 is kept under a name that includes the speed, so takes at 1 stay valid.
  const ovSpeed = options.openvoiceSpeed ?? 1;
  for (const job of jobs) job.stem = join(folder, sha([job.engine, job.voice, job.engine === engine ? options.model : '', job.line.say].join('\n') + (job.engine === 'openvoice' && ovSpeed !== 1 ? `\nspeed=${ovSpeed}` : '')).slice(0, 16));
  // --retake: the named lines get a new recording even though their words have not changed.
  const retake = options.retake ?? [], unknown = retake.filter((id) => !lines.some((line) => line.id === id));
  if (unknown.length) throw new Error(`--retake: there is no line ${unknown.join(', ')}. Line ids look like s03-l01 (shot 3, line 1); the contact sheet and the LISTEN list show them.`);
  const again = jobs.filter((job) => retake.includes(job.line.id) && existsSync(job.stem + '.json'));
  const fixed = again.find((job) => job.engine === 'file');
  if (fixed) throw new Error(`--retake: ${fixed.line.id} plays the user's own recording (${fixed.line.audio}), which the tool does not make. Replace that file instead.`);
  const missing = jobs.filter((job) => !existsSync(job.stem + '.json') || again.includes(job)), toMake = missing.filter((job) => job.engine === engine);
  const scratch = (job, ext) => join(tmpdir(), `sketch-${process.pid}-${basename(job.stem)}${ext}`);
  // A paid reply is held under the take's own name until it is converted and saved. If a run stops after paying
  // (ffmpeg failing, say), the next run uses the held reply and sends nothing for that line.
  const held = (job) => join(folder, 'received', basename(job.stem)), paidFor = (job) => existsSync(held(job) + '.json');
  const toSend = toMake.filter((job) => !paidFor(job));
  let key = null;
  if (paidName && toSend.length) {
    // Nothing is sent to a paid service until the key is found and the user's cap covers the text.
    const need = toSend.reduce((sum, job) => sum + job.line.say.length, 0), long = toSend.find((job) => job.line.say.length > 2500);
    if (long) throw new Error(`${long.line.id} is ${long.line.say.length} characters. Keep a line under 2500.`);
    key = await findKey(workspace, KEY_NAMES[engine]);
    if (!key) throw new Error(keyHelp(engine));
    if (!(options.maxChars >= need))
      throw new Error(`${again.length ? `Retaking ${again.map((job) => job.line.id).join(', ')}: the current recording stays in place until the new one is paid for. ` : ''}${toSend.length} line(s) would send ${need} characters of text to ${paidName}, which charges by the character. ${await costNote(engine, need, key)} Tell the user the number and the estimate, and after they agree pass --max-chars ${need} or more. No text was sent.`);
  }
  const local = missing.filter((job) => job.engine === 'openvoice');
  if (local.length) {
    if (!openvoiceReady()) throw new Error(`The openvoice voice is not installed in ${openvoiceHome()}. It is optional (about 2 GB). If the user wants it, run: bash ${join(HERE, 'install-openvoice.sh')}`);
    // One Python run speaks every missing line, so the model is loaded once.
    const list = scratch(local[0], '.jobs.json');
    await writeFile(list, JSON.stringify(local.map((job) => ({ id: job.line.id, text: spoken(job.line.say), speaker: job.voice, speed: ovSpeed, out: (job.made = scratch(job, '.ov.wav')) }))));
    await run(join(openvoiceHome(), 'venv/bin/python'), [join(HERE, 'openvoice_tts.py'), list]);
    await rm(list, { force: true });
  }
  if (missing.length) await mkdir(folder, { recursive: true });
  // Only now, with the key found and the cap agreed, are the old takes set aside.
  for (const job of again) { await setAside(job.stem + '.wav'); receipt.rejected.push({ line: job.line.id, kept: relative(workspace, await setAside(job.stem + '.json')) }); }
  for (const job of missing) {
    const wav = job.stem + '.wav';
    let source = job.source ?? job.made, cost = null, sentNow = 0;
    const paid = paidName && job.engine === engine;
    // Each paid reply is written to `received/` with a note of what it cost, before anything else can fail.
    const hold = async (audio, ext) => {
      await mkdir(join(folder, 'received'), { recursive: true });
      await writeFile(held(job) + ext, audio);
      await writeFile(held(job) + '.json', JSON.stringify({ line: job.line.id, ext, credits: cost, characters: job.line.say.length }) + '\n');
      sentNow = job.line.say.length;
      return held(job) + ext;
    };
    if (job.engine === 'say') { source = scratch(job, '.aiff'); await run('say', ['-v', job.voice, '-o', source], spoken(job.line.say)); }
    if (paid && paidFor(job)) {
      const note = JSON.parse(await readFile(held(job) + '.json', 'utf8'));
      source = held(job) + note.ext; cost = note.credits;
      receipt.recovered++;
    } else if (job.engine === 'elevenlabs') {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(job.voice)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': key.value, 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.line.say, model_id: options.model.split(' speed=')[0], voice_settings: { stability: 0.5, similarity_boost: 0.75, ...(options.model.includes(' speed=') ? { speed: Number(options.model.split(' speed=')[1]) } : {}) } }),
      });
      if (!response.ok) throw new Error(`ElevenLabs refused ${job.line.id} (${response.status}): ${(await response.text()).slice(0, 200)}. Lines already generated are kept.`);
      cost = Number(response.headers.get('character-cost')) || null;
      source = await hold(Buffer.from(await response.arrayBuffer()), '.mp3');
    } else if (job.engine === 'sarvam') {
      const [model, language] = options.model.split(' ');
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST', headers: { 'api-subscription-key': key.value, 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.line.say, language_code: language, model, speaker: job.voice, speech_sample_rate: 48000, output_audio_codec: 'wav' }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.audios?.[0]) throw new Error(`Sarvam refused ${job.line.id} (${response.status}): ${String(body?.error?.message ?? 'no audio came back').slice(0, 200)}. Lines already generated are kept.`);
      source = await hold(Buffer.from(body.audios[0], 'base64'), '.wav');
    }
    await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-ac', '1', '-ar', '48000', wav]);
    if (source !== job.source && !paid) await rm(source, { force: true });
    const sent = paid ? job.line.say.length : 0;
    await writeFile(job.stem + '.json', JSON.stringify({ engine: job.engine, voice: job.voice, text: job.line.say, characters: sent, credits: cost, ...(await measure(wav)) }, null, 2) + '\n');
    // The take is saved, so the held reply is no longer needed.
    if (paid) await Promise.all([rm(source, { force: true }), rm(held(job) + '.json', { force: true })]);
    // The receipt counts only what this run sent; a held reply was paid for by an earlier run.
    receipt.generated++; receipt.characters += sentNow; receipt.credits += sentNow ? (cost ?? 0) : 0;
  }
  receipt.reused = jobs.length - missing.length;
  // A take measured by loudness, before Rhubarb was available, is measured again now that it is. Nothing is sent or paid.
  receipt.remeasured = 0;
  if (rhubarbPath()) for (const job of jobs) {
    const saved = JSON.parse(await readFile(job.stem + '.json', 'utf8'));
    if (saved.cuesFrom !== 'loudness') continue;
    await writeFile(job.stem + '.json', JSON.stringify({ ...saved, ...(await measure(job.stem + '.wav')) }, null, 2) + '\n');
    receipt.remeasured++;
  }
  const voiced = {};
  for (const job of jobs) voiced[job.line.id] = { wav: job.stem + '.wav', ...JSON.parse(await readFile(job.stem + '.json', 'utf8')) };
  receipt.mouths = [...new Set(Object.values(voiced).map((item) => item.cuesFrom))];
  return { voiced, receipt };
}

// ---- From a sketch file to a frame plan -------------------------------------------------------------
const FRAMES = ['wide', 'group', 'medium', 'close'], FIG = 0.75, SEAT_Y = 267;
const DOES = ['nod', 'shake-head', 'eyeroll', 'lean-in', 'step-forward', 'half-rise', 'sit', 'eyes-closed', 'eyes-open'];
const LOOKS = ['camera', 'down', 'up'];
// How fast a sketch moves when a line or shot does not say: [seconds of silence after a line, seconds a shot stays after its last line].
const PACES = { quick: [0.18, 0.25], normal: [0.35, 0.4], slow: [0.6, 0.65] };

// A sketch is one scene (set, cast and shots at the top) or several, listed in "scenes". Each scene has
// its own room and cast; shots are numbered straight through, so line ids stay unique across scenes.
const scenesOf = (sketch) => (Array.isArray(sketch.scenes) ? sketch.scenes : [sketch]);
const idsOf = (scene) => (scene.cast ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.id));
const LINE_VOICES = ['say', 'openvoice', 'none'];
// A sound cue is a file name, or { file, volume, length } with "when" on a line or "at" on a shot.
const cueOf = (value) => (typeof value === 'string' ? { file: value } : value ?? {});
const cuesOf = (value) => (value === undefined ? [] : [value].flat().map(cueOf));

// Stock reactions: short, pre-timed performances any character can play, so a sketch names one instead
// of timing faces by hand. A face on its own is a pose that stays until something changes it, which is
// how a wink became closed eyes and a surprise became a stare. Each step is [seconds from the start, what
// changes]. "@" means "whatever it was before the reaction". All are mild on purpose.
// `group` and `size` sort them for a person choosing one: mild ones are the default, medium ones are for a
// moment the script clearly calls for. None uses a pose that only works standing or only seated.
// `peak` is the moment that shows the reaction best, for the contact sheet: the middle of its longest held step unless given.
const R = (group, size, seconds, note, steps, peak) => {
  const spans = steps.slice(0, -1).map(([at], i) => [steps[i + 1][0] - at, at + (steps[i + 1][0] - at) / 2]).sort((a, b) => Math.round((b[0] - a[0]) * 100));   // the earlier of two equal holds
  return { group, size, seconds, note, steps, peak: peak ?? spans[0]?.[1] ?? 0.2 };
};
const REACTIONS = {
  // Agreeing, warming to something
  'small-nod': R('agree', 'mild', 1.1, 'One nod with a softer face.', [[0, { face: 'serene' }], [0.1, { do: 'nod' }], [0.9, { face: '@' }]]),
  'nod-along': R('agree', 'mild', 1.7, 'Two unhurried nods, as if following along.', [[0.05, { do: 'nod' }], [0.85, { do: 'nod' }]]),
  'warm-smile': R('agree', 'mild', 1.4, 'A smile that arrives and fades.', [[0, { face: 'serene' }], [0.25, { face: 'happy' }], [1.0, { face: 'serene' }], [1.25, { face: '@' }]]),
  'chuckle': R('agree', 'medium', 1.5, 'A short laugh, then a smile.', [[0, { face: 'happy' }], [0.2, { face: 'laugh' }], [0.2, { do: 'nod' }], [0.7, { face: 'happy' }], [1.3, { face: '@' }]]),
  'ta-da': R('agree', 'mild', 1.5, 'Open palm and a smile: here it is.', [[0, { face: 'happy', pose: 'offer' }], [1.1, { pose: '@' }], [1.3, { face: '@' }]]),
  // Doubting
  'look-up-skeptical': R('doubt', 'mild', 1.9, 'Eyes down, then a slow doubtful look up. Stays doubtful.', [[0, { look: 'down' }], [0.55, { look: 'up', face: 'skeptical' }], [1.45, { look: '@' }]]),
  'side-eye': R('doubt', 'mild', 1.4, 'A sideways look, held for a second.', [[0, { face: 'sideeye' }], [1.1, { face: '@' }]]),
  'not-buying-it': R('doubt', 'mild', 2.2, 'Arms cross, one brow up.', [[0, { face: 'skeptical' }], [0.15, { pose: 'cross' }], [1.7, { pose: '@' }], [1.95, { face: '@' }]]),
  'slow-no': R('doubt', 'mild', 1.3, 'A small shake of the head with a flat face.', [[0, { face: 'bored' }], [0.15, { do: 'shake-head' }], [1.05, { face: '@' }]]),
  'slow-blink': R('doubt', 'mild', 1.2, 'One long blink: did I hear that right?', [[0.2, { do: 'eyes-closed' }], [0.7, { do: 'eyes-open' }]]),
  // Thinking
  'hmm': R('think', 'mild', 1.6, 'Eyes drift up while weighing it, then back.', [[0, { face: 'thinking' }], [0.2, { look: 'up' }], [1.1, { look: '@' }], [1.35, { face: '@' }]]),
  'thinking-it-over': R('think', 'mild', 2.2, 'Fist under the chin for a moment.', [[0, { face: 'thinking' }], [0.1, { pose: 'thinker' }], [1.7, { pose: '@' }], [1.95, { face: '@' }]]),
  // Surprised
  'small-surprise': R('surprise', 'mild', 1.3, 'Brows up and eyes a little wider for a moment. No open mouth.', [[0, { face: 'curious' }], [0.8, { face: '@' }]]),
  'double-take': R('surprise', 'mild', 1.9, 'Looks away, then back again with raised brows.', [[0, { look: 'down' }], [0.5, { look: '@' }], [0.8, { look: 'down' }], [1.1, { look: '@', face: 'curious' }], [1.7, { face: '@' }]]),
  'surprise': R('surprise', 'medium', 1.5, 'Wide eyes and an open mouth for half a second, settling to raised brows.', [[0, { face: 'surprised' }], [0.5, { face: 'curious' }], [1.2, { face: '@' }]], 0.25),
  // Annoyed, worn down
  'eye-roll': R('annoyed', 'mild', 1.4, 'Flat lids, eyes up and back down once, then as before.', [[0, { face: 'bored' }], [0.25, { face: 'eyeroll' }], [0.85, { face: 'bored' }], [1.15, { face: '@' }]]),
  'sigh': R('annoyed', 'mild', 1.6, 'Eyes close on a tired face, then open.', [[0, { face: 'tired' }], [0.15, { do: 'eyes-closed' }], [0.95, { do: 'eyes-open' }], [1.35, { face: '@' }]]),
  'rub-temple': R('annoyed', 'mild', 2.0, 'A hand to the temple, tired.', [[0, { face: 'tired' }], [0.1, { pose: 'temple' }], [1.5, { pose: '@' }], [1.75, { face: '@' }]]),
  'stern-look': R('annoyed', 'medium', 1.6, 'A hard look, held, then let go.', [[0, { face: 'stern' }], [1.3, { face: '@' }]]),
  'wave-off': R('annoyed', 'mild', 1.4, 'A low flick of the hand: go on then.', [[0, { face: 'bored' }], [0.1, { pose: 'wave' }], [0.9, { pose: '@' }], [1.15, { face: '@' }]]),
  // Awkward
  'sheepish-glance': R('awkward', 'mild', 1.6, 'Looks down, embarrassed, then back up.', [[0, { face: 'sheepish' }], [0.2, { look: 'down' }], [1.0, { look: '@' }], [1.35, { face: '@' }]]),
  'caught-out': R('awkward', 'mild', 1.7, 'A flicker of alarm that turns sheepish.', [[0, { face: 'curious' }], [0.4, { face: 'sheepish' }], [1.45, { face: '@' }]]),
  'shrug': R('awkward', 'mild', 1.4, 'Shoulders and palms up: no idea.', [[0, { face: 'sheepish' }], [0.1, { pose: 'shrug' }], [0.9, { pose: '@' }], [1.15, { face: '@' }]]),
  'wince': R('awkward', 'mild', 1.2, 'A quick wince that eases to a worried look.', [[0, { face: 'pained' }], [0.4, { face: 'worried' }], [0.95, { face: '@' }]]),
  // Low
  'deflate': R('sad', 'mild', 1.9, 'The face falls and the eyes drop. Stays sad.', [[0, { face: 'sad' }], [0.2, { look: 'down' }], [1.6, { look: '@' }]]),
  // To the camera
  'one-wink': R('camera', 'mild', 1.3, 'Looks at the camera with open eyes, winks once, carries on.', [[0, { look: 'camera', face: 'serene' }], [0.3, { face: 'wink' }], [0.7, { face: 'serene' }], [1.1, { look: '@', face: '@' }]]),
  'deadpan': R('camera', 'mild', 1.8, 'Turns to the camera with a flat face, holds, turns back.', [[0, { face: 'bored' }], [0.2, { look: 'camera' }], [1.5, { look: '@', face: '@' }]]),
  'glance-at-camera': R('camera', 'mild', 1.3, 'A look to the camera and back, face unchanged.', [[0, { look: 'camera' }], [1.0, { look: '@' }]]),
  'smug-to-camera': R('camera', 'mild', 1.8, 'Turns to the camera, pleased with themselves.', [[0, { look: 'camera' }], [0.25, { face: 'smug' }], [1.3, { face: '@' }], [1.5, { look: '@' }]]),
  // With a prop. The pose brings its own mug or phone, so not for a character whose file already holds something.
  'over-the-mug': R('prop', 'mild', 2.0, 'Lifts a mug and gives a sideways look over it.', [[0, { face: 'sideeye' }], [0.15, { pose: 'sip' }], [1.4, { pose: '@' }], [1.75, { face: '@' }]]),
  'check-phone': R('prop', 'mild', 2.1, 'Lifts a phone, looks down at it, puts it away.', [[0, { face: 'bored' }], [0.1, { pose: 'phone', look: 'down' }], [1.5, { pose: '@', look: '@' }], [1.85, { face: '@' }]]),
};

// Stock gestures: short arm performances for someone who is talking, the way stock reactions are for someone
// who is not. Each step is [seconds from the start, pose]; "@" is the pose they had before. A gesture never
// changes the face, so it can sit on any line. On a line it starts with a chosen word, or with the line.
const G = (group, seconds, note, steps) => ({ group, seconds, note, steps: steps.map(([at, pose]) => [at, { pose }]) });
const GESTURES = {
  // Counting and listing
  'count-one': G('count', 1.1, 'One finger up.', [[0, 'count1'], [0.9, '@']]),
  'count-two': G('count', 1.1, 'Two fingers up.', [[0, 'count2'], [0.9, '@']]),
  'count-three': G('count', 1.1, 'Three fingers up.', [[0, 'count3'], [0.9, '@']]),
  'count-to-three': G('count', 2.2, 'Counts one, two, three on the fingers.', [[0, 'count1'], [0.6, 'count2'], [1.2, 'count3'], [2.0, '@']]),
  // Making a point
  'air-quotes': G('point', 1.1, 'Both hands up, two fingers bending twice.', [[0, 'quotes'], [0.22, 'quotes2'], [0.44, 'quotes'], [0.66, 'quotes2'], [0.9, '@']]),
  'idea': G('point', 1.2, 'One finger raised: here is a thought.', [[0, 'idea'], [1.0, '@']]),
  'point-at': G('point', 1.0, 'Points at the person they are talking to.', [[0, 'point'], [0.8, '@']]),
  'me': G('point', 1.0, 'A finger turned to their own chest.', [[0, 'self'], [0.8, '@']]),
  'here-it-is': G('point', 1.1, 'An open palm lifted beside them.', [[0, 'offer'], [0.9, '@']]),
  'stop': G('point', 1.1, 'A palm held out: hold on.', [[0, 'stop'], [0.9, '@']]),
  // Feeling
  'thumbs-up': G('feel', 1.2, 'A thumbs up.', [[0, 'thumb'], [1.0, '@']]),
  'fist-pump': G('feel', 1.0, 'A raised fist pulled down once.', [[0, 'pump'], [0.3, 'pump2'], [0.55, 'pump'], [0.8, '@']]),
  'clap': G('feel', 1.3, 'Three claps.', [[0, 'clap2'], [0.18, 'clap'], [0.36, 'clap2'], [0.54, 'clap'], [0.72, 'clap2'], [0.9, 'clap'], [1.1, '@']]),
  'hands-up': G('feel', 1.3, 'Both hands up: not my fault.', [[0, 'handsup'], [1.1, '@']]),
  'shrug': G('feel', 1.0, 'Shoulders and palms up.', [[0, 'shrug'], [0.8, '@']]),
  'please': G('feel', 1.3, 'Hands pressed together.', [[0, 'beg'], [1.1, '@']]),
  'dismiss': G('feel', 0.9, 'A low flick of the hand.', [[0, 'wave'], [0.7, '@']]),
  // Greeting
  'wave-hello': G('greet', 1.4, 'A raised hand waving side to side.', [[0, 'hello'], [0.25, 'hello2'], [0.5, 'hello'], [0.75, 'hello2'], [1.0, 'hello'], [1.2, '@']]),
  // Attitude and thinking
  'hands-on-hips': G('stance', 1.8, 'Both hands on the hips, held.', [[0, 'hips'], [1.6, '@']]),
  'arms-crossed': G('stance', 1.8, 'Arms folded, held.', [[0, 'cross'], [1.6, '@']]),
  'scratch-head': G('stance', 1.5, 'A hand to the back of the head.', [[0, 'scratch'], [1.3, '@']]),
  'chin-rub': G('stance', 1.6, 'A hand on the chin.', [[0, 'chinrub'], [1.4, '@']]),
  // Hand at the face. These cover the mouth, so use them between lines, not on one.
  'shh': G('face', 1.3, 'A finger to the lips.', [[0, 'shh'], [1.1, '@']]),
  'facepalm': G('face', 1.6, 'A hand over the face.', [[0, 'facepalm'], [1.4, '@']]),
};
// Moments two people share. Both step toward each other until their hands can meet, reach, hold, and step back.
// `reach` is how far a hand goes from the body's middle in that pose, in the figure's own units.
const MOMENTS = {
  'high-five': { pose: 'five', reach: 126, hold: 0.35, note: 'They step together and slap raised palms.' },
  'handshake': { pose: 'shake', reach: 128, hold: 0.9, note: 'They step together and shake hands.' },
  'fist-bump': { pose: 'bump', reach: 128, hold: 0.4, note: 'They step together and touch fists.' },
  'hand-over': { pose: 'give', reach: 126, hold: 0.8, note: 'They step together, one holding something out and the other taking it. Nothing changes hands in the drawing.' },
};
const TWO_HANDED = Object.keys(GESTURES).filter((name) => GESTURES[name].steps.some(([, change]) => bodies[change.pose]?.far));
const gesturesOf = (value) => (value === undefined ? [] : [value].flat().map((item) => (typeof item === 'string' ? { name: item } : item ?? {})));

// Check the whole sketch and report every problem at once.
function check(sketch, specs) {
  const problems = [], bad = (text) => problems.push(text), many = sketch.scenes !== undefined;
  if (many) {
    if (!Array.isArray(sketch.scenes) || !sketch.scenes.length) bad('"scenes" must list at least one scene, each with its own "set", "cast" and "shots"');
    for (const field of ['set', 'cast', 'shots', 'laptops', 'busy', 'holding']) if (sketch[field] !== undefined) bad(`"${field}" belongs inside each scene when the sketch has "scenes"`);
  }
  if (sketch.pace !== undefined && !PACES[sketch.pace]) bad(`pace "${sketch.pace}" must be one of: ${Object.keys(PACES).join(', ')}`);
  try { captionSetting(sketch.captions); } catch (error) { bad(error.message); }
  const sound = (value, where, timing) => {
    for (const cue of cuesOf(value)) {
      if (typeof cue.file !== 'string' || !cue.file.trim()) bad(`${where}: a sound needs "file", the path of a sound file in the working folder`);
      if (cue.volume !== undefined && !(cue.volume > 0 && cue.volume <= 4)) bad(`${where}: sound "volume" must be a number above 0 and at most 4 (1 is the file as recorded)`);
      if (cue.length !== undefined && !(cue.length > 0)) bad(`${where}: sound "length" must be a number of seconds above 0`);
      if (timing === 'line' && cue.when !== undefined && !['after', 'with'].includes(cue.when)) bad(`${where}: sound "when" must be "after" (the default) or "with"`);
      if (timing === 'shot' && cue.at !== undefined && !(cue.at >= 0)) bad(`${where}: sound "at" must be seconds from the start of the shot, 0 or more`);
    }
  };
  if (sketch.music !== undefined) sound(sketch.music, 'music', 'music');
  let number = 0;
  const scenes = scenesOf(sketch).filter((scene) => scene && typeof scene === 'object').map((scene, n) => {
    const tag = many ? `scene ${n + 1}: ` : '', ids = idsOf(scene);
    if (!ids.length) bad(`${tag}"cast" must list at least one character id, left to right`);
    for (const id of ids) if (!specs[id]) bad(`${tag}cast: there is no characters/${id}.json`);
    if (new Set(ids).size !== ids.length) bad(`${tag}cast: a character is listed twice`);
    const custom = typeof scene.set === 'string' && scene.set.endsWith('.svg');
    if (!custom && !SETS[scene.set ?? 'plain']) bad(`${tag}set "${scene.set}" must be one of: ${Object.keys(SETS).join(', ')}, or the path of an .svg backdrop`);
    if (!Array.isArray(scene.shots) || !scene.shots.length) bad(`${tag}"shots" must list at least one shot`);
    const sitters = (scene.cast ?? []).filter((entry) => entry && typeof entry === 'object' && entry.sit).map((entry) => entry.id);
    if (sitters.length) {
      const seat = SEATING[scene.set ?? 'plain'];
      if (scene.set === 'table') bad(`${tag}"sit" is not needed at the table: everyone there sits already`);
      else if (!seat && !custom) bad(`${tag}"sit" needs a room with a seat: ${Object.keys(SEATING).join(' (sofa), ')} (bench), or your own backdrop with a seat drawn in it. There is nothing to sit on in "${scene.set ?? 'plain'}"`);
      else if (seat && sitters.length > seat.most) bad(`${tag}${seat.what} seats ${seat.most}; ${sitters.length} people are marked "sit"`);
    }
    if (scene.holding !== undefined) {
      if (!scene.holding || typeof scene.holding !== 'object' || Array.isArray(scene.holding)) bad(`${tag}"holding" must look like { "zoe": "book" }: a character id and the thing in their hand`);
      else for (const [id, thing] of Object.entries(scene.holding)) {
        if (!ids.includes(id)) bad(`${tag}holding: "${id}" is not in the cast (${ids.join(', ')})`);
        if (!PROPS.includes(thing)) bad(`${tag}holding: "${thing}" is not a prop. Choose from: ${PROPS.join(', ')}`);
      }
    }
    if (scene.set === 'call') {
      if (ids.length > 6) bad(`${tag}a call shows up to six people; this one has ${ids.length}`);
      if (sitters.length) bad(`${tag}"sit" does not apply on a call: everyone is shown from the chest up`);
      for (const shot of Array.isArray(scene.shots) ? scene.shots : []) for (const item of [...(shot.lines ?? []), ...(shot.acting ?? [])])
        if (item?.moment || item?.enter || item?.exit) bad(`${tag}people on a call are in different places, so "moment", "enter" and "exit" do not apply. To have someone join or leave, cut to a scene with a different cast`);
    }
    if (scene.busy !== undefined) {
      if (!scene.busy || typeof scene.busy !== 'object' || Array.isArray(scene.busy)) bad(`${tag}"busy" must look like { "sam": "phone" }: a character id and the pose they keep up`);
      else for (const [id, pose] of Object.entries(scene.busy)) {
        if (!ids.includes(id)) bad(`${tag}busy: "${id}" is not in the cast (${ids.join(', ')})`);
        if (!bodies[pose]) bad(`${tag}busy: "${pose}" is not a pose. Choose from: ${Object.keys(bodies).join(', ')}`);
      }
    }
    if (scene.laptops !== undefined) {
      if (!Array.isArray(scene.laptops)) bad(`${tag}"laptops" must be a list of character ids, such as ["maya"]`);
      else {
        if (scene.set !== 'table') bad(`${tag}"laptops" needs "set": "table", the only room with a table to put them on`);
        for (const id of scene.laptops) if (!ids.includes(id)) bad(`${tag}laptops: "${id}" is not in the cast (${ids.join(', ')})`);
      }
    }
    const who = (id, where) => { if (!ids.includes(id)) bad(`${where}: "${id}" is not in the cast (${ids.join(', ')})`); };
    const acting = (item, where) => {
      for (const g of gesturesOf(item.gesture)) {
        if (!GESTURES[g.name]) bad(`${where}: gesture "${g.name}" is not a stock gesture. Choose from: ${Object.keys(GESTURES).join(', ')}`);
        if (g.on !== undefined && item.say && !spoken(item.say).toLowerCase().includes(String(g.on).toLowerCase())) bad(`${where}: gesture "${g.name}" is set on the word "${g.on}", which is not in the line`);
        if (g.at !== undefined && !(g.at >= 0)) bad(`${where}: gesture "at" must be seconds, 0 or more`);
      }
      if (item.hold !== undefined && item.hold !== 'none' && !PROPS.includes(item.hold)) bad(`${where}: hold "${item.hold}" is not a prop. Choose from: none, ${PROPS.join(', ')}`);
      if (item.moment !== undefined) {
        if (!MOMENTS[item.moment]) bad(`${where}: moment "${item.moment}" is not one of: ${Object.keys(MOMENTS).join(', ')}`);
        if (!ids.includes(item.with) || item.with === item.who) bad(`${where}: a moment needs "with": the id of the other person in it`);
        else if (sitters.includes(item.who) || sitters.includes(item.with) || scene.set === 'table') bad(`${where}: a moment needs both people standing`);
      }
      for (const move of ['enter', 'exit']) if (item[move] !== undefined && !['left', 'right'].includes(item[move])) bad(`${where}: "${move}" must be "left" or "right", the side of the frame they walk ${move === 'enter' ? 'in from' : 'out by'}`);
      if ((item.enter || item.exit) && sitters.includes(item.who)) bad(`${where}: ${item.who} is sitting, and a sitter cannot walk in or out`);
      if (item.stretch !== undefined && !(item.stretch >= 0.5 && item.stretch <= 3)) bad(`${where}: "stretch" slows a reaction down or speeds it up, from 0.5 (twice as fast) to 3 (three times as slow)`);
      if (item.react !== undefined && !REACTIONS[item.react]) bad(`${where}: react "${item.react}" is not a stock reaction. Choose from: ${Object.keys(REACTIONS).join(', ')}`);
      if (item.face && !expressions[item.face]) bad(`${where}: face "${item.face}" is not an expression. Choose from: ${Object.keys(expressions).join(', ')}`);
      if (item.pose && item.pose !== 'rest' && !bodies[item.pose]) bad(`${where}: pose "${item.pose}" is not a pose. Choose from: rest, ${Object.keys(bodies).join(', ')}`);
      if (item.do && !DOES.includes(item.do)) bad(`${where}: do "${item.do}" must be one of: ${DOES.join(', ')}`);
      const look = item.look ?? item.to;
      if (look && !LOOKS.includes(look) && !ids.includes(look)) bad(`${where}: "${look}" must be a cast id or one of: ${LOOKS.join(', ')}`);
    };
    (Array.isArray(scene.shots) ? scene.shots : []).forEach((shot) => {
      const where = `${tag}shot ${++number}`;
      if (shot.frame && !FRAMES.includes(shot.frame)) bad(`${where}: frame "${shot.frame}" must be one of: ${FRAMES.join(', ')}`);
      for (const id of [shot.on ?? []].flat()) who(id, `${where} "on"`);
      if (shot.card !== undefined && (typeof shot.card !== 'string' || !shot.card.trim() || shot.lines?.length)) bad(`${where}: "card" is the words on a title card, and a card shot has no lines`);
      if (shot.card === undefined && !shot.lines?.length && !(shot.hold > 0) && !(shot.acting ?? []).some((item) => REACTIONS[item?.react] || gesturesOf(item?.gesture).length || item?.enter || item?.exit || item?.moment)) bad(`${where}: a shot with no lines needs "hold" (seconds), or a stock reaction in "acting"`);
      sound(shot.sound, where, 'shot');
      (shot.lines ?? []).forEach((line, l) => {
        const here = `${where}, line ${l + 1}`;
        who(line.who, here);
        if (!line.say?.trim()) bad(`${here}: "say" is empty`);
        if (line.voice !== undefined && !LINE_VOICES.includes(line.voice)) bad(`${here}: a line's own "voice" must be one of the free ones: ${LINE_VOICES.join(', ')}`);
        acting(line, here);
        sound(line.sound, here, 'line');
        for (const [id, face] of Object.entries(line.reactions ?? {})) { who(id, `${here} reactions`); acting(REACTIONS[face] ? { react: face } : { face }, `${here} reactions`); }
      });
      (shot.acting ?? []).forEach((item, a) => { who(item.who, `${where}, acting ${a + 1}`); acting(item, `${where}, acting ${a + 1}`); });
    });
    return { ids, custom };
  });
  if (problems.length) throw new Error(`The sketch has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  return { ...scenes[0], scenes };
}
// Every spoken line in order, with a stable id: s02-l01 is shot 2, line 1.
const linesOf = (sketch) => scenesOf(sketch).flatMap((scene) => scene.shots).flatMap((shot, s) => (shot.lines ?? []).map((line, l) => ({ ...line, id: `s${String(s + 1).padStart(2, '0')}-l${String(l + 1).padStart(2, '0')}` })));

function compile(sketch, specs, voiced) {
  const checked = check(sketch, specs).scenes, pace = PACES[sketch.pace ?? 'normal'];
  const cuts = [], lines = [], warnings = [], sounds = [], everyone = [];
  let clock = 0, number = 0;
  scenesOf(sketch).forEach((part, n) => {
  const { ids, custom } = checked[n];
  for (const id of ids) if (!everyone.includes(id)) everyone.push(id);
  const [set, seated] = custom ? ['backdrop', false] : SETS[part.set ?? 'plain'];
  // Where everyone stands or sits: spread left to right in cast order unless the sketch places them.
  const gap = seated ? Math.min(230, 700 / Math.max(1, ids.length - 1)) : null, marks = {};
  // People marked "sit" share the room's seat, in cast order; a sitting figure's feet are 32 units nearer its head than a standing one's.
  const seat = SEATING[part.set ?? 'plain'], sitting = part.cast.filter((entry) => typeof entry === 'object' && entry.sit).map((entry) => entry.id);
  part.cast.forEach((entry, i) => {
    const given = typeof entry === 'string' ? {} : entry, sit = Boolean(given.sit) && !seated, place = sitting.indexOf(ids[i]);
    const onSeat = sit && seat ? seat.middle + (place - (sitting.length - 1) / 2) * seat.gap : null;
    const x = given.x ?? onSeat ?? (seated ? 480 + (i - (ids.length - 1) / 2) * gap : (W * (i + 1)) / (ids.length + 1)), scale = given.scale ?? (seated ? 1 : 0.8 * specs[ids[i]].height);
    marks[ids[i]] = { x, y: given.y ?? 480 - 281 * scale + (sit ? 32 * scale : 0), scale, mirror: given.mirror ?? x > W / 2, ...(sit ? { sit: true } : {}) };
  });
  const size = (id) => marks[id].scale * (seated ? FIG : 1), headY = (id) => (seated ? SEAT_Y : marks[id].y) - 66 * size(id);
  // The part of the room a shot shows, as [left, top, width]. The drawing code nudges some framings, so
  // the last two lines undo that nudge and the picture lands where this says.
  const slices = [];
  const camera = (kind, on) => {
    let view;
    if (kind === 'close' || kind === 'medium') {
      const id = on[0], width = (kind === 'close' ? 470 : seated ? 600 : 560) * size(id), height = (width * H) / W;
      view = [marks[id].x - width / 2, headY(id) - (kind === 'close' ? 0.54 : 0.36) * height, width];
      // A neighbour's head is either wholly in a single or wholly out of it. A slice of a face at the frame edge is the
      // most repeated framing fault. So the frame slides sideways, by up to a fifth of its width, the shorter way; and
      // when someone on each side makes that impossible, it tightens to fit between them. Big hair counts as head.
      if (!seated) {
        const frac = kind === 'close' ? 0.54 : 0.36, others = ids.filter((name) => name !== id).map((name) => {
          const half = (specs[name].head[0] + Math.max(6, hairStyles[specs[name].style]?.rx ?? 6) + 6) * 1.1 * size(name);
          return { name, left: marks[name].x - half, right: marks[name].x + half, top: headY(name) - 70 * size(name), side: marks[name].x > marks[id].x ? 1 : -1 };
        });
        const cut = (frame) => others.filter((o) => !(o.right <= frame[0] || o.left >= frame[0] + frame[2] || o.top >= frame[1] + (frame[2] * H) / W || (o.left >= frame[0] + 8 && o.right <= frame[0] + frame[2] - 8)));
        for (const o of cut(view)) {
          const out = o.side > 0 ? o.left - 8 - (view[0] + width) : o.right + 8 - view[0], inside = o.side > 0 ? o.right + 8 - (view[0] + width) : o.left - 8 - view[0];
          const move = Math.abs(out) <= Math.abs(inside) ? out : inside;
          if (Math.abs(move) <= width * 0.2) view[0] += move;
        }
        if (cut(view).length) {
          const from = Math.max(marks[id].x - width, ...others.filter((o) => o.side < 0).map((o) => o.right + 8)), to = Math.min(marks[id].x + width, ...others.filter((o) => o.side > 0).map((o) => o.left - 8));
          if (to - from >= width * 0.72) { const tight = Math.min(width, to - from); view = [Math.max(from, Math.min(to - tight, marks[id].x - tight / 2)), headY(id) - frac * ((tight * H) / W), tight]; }
        }
        for (const o of cut(view)) slices.push(`${o.name}'s head is cut by the edge of a ${kind} on ${id}. Move them apart with "x" in the cast, or use a "group" frame.`);
      }
    } else {
      const group = kind === 'wide' ? ids : on, xs = group.map((id) => marks[id].x), span = Math.max(...xs) - Math.min(...xs);
      const width = kind === 'wide' && !seated ? W : Math.max(seated ? 580 : 520, span + (seated ? 300 : 360)), height = (width * H) / W;
      const middle = (Math.max(...xs) + Math.min(...xs)) / 2, heads = group.reduce((sum, id) => sum + headY(id), 0) / group.length;
      view = kind === 'wide' && !seated ? [0, 0, W] : [middle - width / 2, seated ? 273 - height / 2 : heads - 0.3 * height, width];
    }
    if (seated) return [view[0], view[1] - 70, view[2]];
    const inner = view[2] / 1.14;
    return inner < 800 ? [view[0] + inner * 0.07, view[1] - 32, inner] : view;
  };
  // A new scene starts everyone fresh: resting face, nobody mid-conversation.
  // "busy": { "sam": "phone" } keeps that pose up for the whole scene, with eyes down. A busy person does not turn
  // to whoever speaks, and speaks without looking up, until a line or acting entry gives them a look.
  // "holding": { "zoe": "book" } puts that thing in their hand for the scene, carried at chest height (a microphone near the mouth).
  const face = {}, looking = {}, held = { ...(part.holding ?? {}) }, carryPose = (thing) => (thing === 'mic' ? 'micup' : 'carry');
  const base = { ...Object.fromEntries(Object.entries(held).map(([id, thing]) => [id, carryPose(thing)])), ...(part.busy ?? {}) };
  for (const id of ids) face[id] = specs[id].resting;
  // On a call everyone looks at their own screen, which is the camera, and nobody turns to whoever speaks.
  const onCall = set === 'call', tiles = onCall ? callTiles(ids.length) : [];
  const webcam = (id, [x, y, side]) => { const scale = (side / 250) * 0.92; return { x: x + side / 2, y: y + side * 0.44 + 66 * scale, scale, mirror: false, clip: [x, y, side, side] }; };
  if (onCall) ids.forEach((id, i) => { looking[id] = 'camera'; marks[id] = webcam(id, tiles[i]); });
  for (const id of Object.keys(part.busy ?? {})) looking[id] = 'down';
  // Anyone whose first move in the scene is to walk in starts it out of frame, on that side.
  const away = {};
  for (const item of part.shots.flatMap((shot) => [...(shot.lines ?? []), ...[...(shot.acting ?? [])].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))])) {
    if (!item || away[item.who] !== undefined) continue;
    if (item.enter) away[item.who] = item.enter === 'left' ? -(marks[item.who].x + 170) : W - marks[item.who].x + 170;
    else if (item.exit) away[item.who] = null;
  }
  let last = null;
  part.shots.forEach((shot) => {
    const s = number++;
    const cutId = `s${String(s + 1).padStart(2, '0')}`, from = Math.round(clock * FPS), start = from / FPS, beats = [];
    const beat = (id, time, action, arg) => beats.push({ id, at: Math.max(0, time - start), action, arg });
    const act = (item, time) => {
      if (item.hold) { const thing = item.hold === 'none' ? null : item.hold; beat(item.who, time, 'hold', thing ?? 'none'); held[item.who] = thing; if (thing) base[item.who] = carryPose(thing); else if (!part.busy?.[item.who]) delete base[item.who]; beat(item.who, time, 'pose', base[item.who] ?? 'rest'); }
      if (item.face) { beat(item.who, time, 'face', item.face); face[item.who] = item.face; }
      if (item.pose) beat(item.who, time, 'pose', item.pose);
      // On a call nobody turns to another person, whatever the sketch says: such a look becomes a look at the camera.
      const look = item.look && onCall && !LOOKS.includes(item.look) ? 'camera' : item.look;
      if (look) { beat(item.who, time, 'look', look); looking[item.who] = look; }
      if (item.do) beat(item.who, time, item.do);
    };
    // Play a stock reaction: its steps become ordinary beats, with "@" filled in from the moment it starts.
    let busy = start, peak = null, played = null;
    const react = (id, name, time, stretch = 1) => {
      if (peak === null) { peak = Math.round((time + REACTIONS[name].peak * stretch) * FPS); played = name; }
      const was = { face: face[id], look: looking[id] ?? ids.find((other) => other !== id) ?? 'camera', pose: base[id] ?? 'rest' };
      for (const [at, change] of REACTIONS[name].steps) act({ who: id, ...Object.fromEntries(Object.entries(change).map(([key, value]) => [key, value === '@' ? was[key] : value])) }, time + at * stretch);
      busy = Math.max(busy, time + REACTIONS[name].seconds * stretch);
    };
    // Walk in from a side of the frame to their place, or out by a side. Someone who is out stays out in later shots.
    const arrives = {};
    const walk = (id, enter, side, time) => {
      const off = side === 'left' ? -(marks[id].x + 170) : W - marks[id].x + 170, frames = Math.round(Math.min(2.4, Math.max(0.9, Math.abs(off) / 300)) * FPS);
      beat(id, time, 'walk', enter ? { from: away[id] ?? off, to: 0, frames } : { from: 0, to: off, frames });
      away[id] = enter ? null : off;
      if (enter) beat(id, time + frames / FPS, 'look', looking[id] ?? ids.find((other) => other !== id) ?? 'camera');
      busy = Math.max(busy, time + frames / FPS + 0.2);
      if (enter) arrives[id] = time + frames / FPS;
    };
    // A shared moment: step in, reach with whichever arm is on the partner's side, hold, let go, step back.
    const moment = (a, b, name, time) => {
      const m = MOMENTS[name], apart = Math.abs(marks[a].x - marks[b].x), need = m.reach * (marks[a].scale + marks[b].scale), step = Math.max(0, (apart - need) / 2), frames = Math.max(8, Math.round((step / 260) * FPS));
      const t1 = time + frames / FPS, t2 = t1 + 0.38 + m.hold;
      for (const [id, other] of [[a, b], [b, a]]) {
        const toward = Math.sign(marks[other].x - marks[id].x), arm = (toward > 0) !== Boolean(marks[id].mirror) ? 'F' : 'N';
        beat(id, time, 'look', other);
        if (step > 4) { beat(id, time, 'walk', { from: 0, to: toward * step, frames }); beat(id, t2 + 0.2, 'walk', { from: toward * step, to: 0, frames }); }
        beat(id, t1 - 0.1, 'pose', m.pose + arm); beat(id, t2, 'pose', base[id] ?? 'rest');
        if (step > 4) beat(id, t2 + 0.2 + frames / FPS, 'look', other);
        looking[id] = other;
      }
      busy = Math.max(busy, t2 + 0.3 + (step > 4 ? frames / FPS : 0));
    };
    const moves = (item, time) => {
      if (item.moment) moment(item.who, item.with, item.moment, time); if (item.enter) walk(item.who, true, item.enter, time); if (item.exit) walk(item.who, false, item.exit, time); };
    for (const id of ids) if (away[id] !== null && away[id] !== undefined) beat(id, start, 'walk', { from: away[id], to: away[id], frames: 1 });
    // Play a stock gesture: only the arms move, and they go back to the pose they had.
    const gesture = (id, name, time) => {
      if (held[id] && TWO_HANDED.includes(name)) warnings.push(`${cutId}: ${id} is holding a ${held[id]}, and "${name}" uses both hands, so the ${held[id]} is not drawn while it plays. Use a one-handed gesture, or "hold": "none" in an earlier shot.`);
      for (const [at, change] of GESTURES[name].steps) beat(id, time + at, 'pose', change.pose === '@' ? base[id] ?? 'rest' : change.pose);
      busy = Math.max(busy, time + GESTURES[name].seconds);
    };
    // A new shot starts from where the last one left everyone: same face, looking the same way.
    for (const id of ids) { beat(id, start, 'face', face[id]); if (held[id]) beat(id, start, 'hold', held[id]); if (base[id]) beat(id, start, 'pose', base[id]); if (looking[id]) beat(id, start, 'look', looking[id]); }
    clock = start + (s === 0 ? 0.5 : 0.25);
    const walkedIn = (shot.acting ?? []).filter((item) => item.enter);
    for (const item of walkedIn) walk(item.who, true, item.enter, start + (item.at ?? 0));
    for (const cue of cuesOf(shot.sound)) sounds.push({ file: cue.file, at: start + (cue.at ?? 0), volume: cue.volume ?? 1, length: cue.length ?? null, from: cutId });
    const speakers = [];
    (shot.lines ?? []).forEach((line, l) => {
      const id = `${cutId}-l${String(l + 1).padStart(2, '0')}`, voice = voiced[id], duration = voice?.duration ?? estimate(spoken(line.say));
      if (arrives[line.who] > clock) clock = arrives[line.who] + 0.1;   // they finish walking in before they speak
      const startFrame = Math.round(clock * FPS), endFrame = startFrame + Math.max(1, Math.round(duration * FPS)), time = startFrame / FPS;
      lines.push({ id, character: line.who, text: line.say, startFrame, endFrame, cues: voice?.cues ?? cuesFromText(spoken(line.say), duration), wav: voice?.wav ?? null });
      for (const cue of cuesOf(line.sound)) sounds.push({ file: cue.file, at: cue.when === 'with' ? time : endFrame / FPS + 0.1, volume: cue.volume ?? 1, length: cue.length ?? null, from: id });
      // The speaker turns to whoever they are talking to; everyone else turns to the speaker.
      const others = ids.filter((other) => other !== line.who);
      const nearest = [...others].sort((a, b) => Math.abs(marks[a].x - marks[line.who].x) - Math.abs(marks[b].x - marks[line.who].x))[0];
      const absorbed = (who) => part.busy?.[who] && looking[who] === 'down';
      // On a call a look at another person means nothing: only camera, down and up are kept.
      const target = onCall ? (LOOKS.includes(line.look) ? line.look : 'camera') : line.look ?? line.to ?? (absorbed(line.who) ? 'down' : last && last !== line.who ? last : nearest);
      moves({ ...line, moment: undefined }, time);
      if (away[line.who]) warnings.push(`${id}: ${line.who} speaks while out of frame. Give them "enter" first, or it plays as a voice from off screen.`);
      act({ who: line.who, hold: line.hold, face: line.face, pose: line.pose, look: target, do: line.do }, time);
      if (!onCall) for (const other of others) if (!absorbed(other) && (looking[other] !== 'camera' || target === other)) act({ who: other, look: line.who }, time);
      // A gesture starts with the word it is set on, placed by how far through the line that word is, or 0.15 s in.
      for (const g of gesturesOf(line.gesture)) {
        const words = spoken(line.say), found = g.on === undefined ? -1 : words.toLowerCase().indexOf(String(g.on).toLowerCase());
        const when = g.at ?? (found >= 0 ? Math.max(0, duration * (found / Math.max(1, words.length)) - 0.12) : 0.15);
        gesture(line.who, g.name, time + when);
        if (GESTURES[g.name].group === 'face') warnings.push(`${id}: the "${g.name}" gesture covers ${line.who}'s mouth while they speak. Use it in a silent shot or on a listener.`);
      }
      for (const [other, reaction] of Object.entries(line.reactions ?? {})) { if (REACTIONS[reaction]) react(other, reaction, time + 0.3); else act({ who: other, face: reaction }, time + 0.3); }
      clock = endFrame / FPS;
      if (line.pose && !gesturesOf(line.gesture).length) beat(line.who, clock + 0.15, 'pose', base[line.who] ?? 'rest');
      if (line.face === 'wink') warnings.push(`${id}: "face": "wink" keeps one eye shut for the whole line and after it, which reads as closed eyes. Use "react": "one-wink" for a single wink.`);
      // A moment set on a line starts as the line ends.
      if (line.moment) { moment(line.who, line.with, line.moment, clock + 0.1); clock = Math.max(clock, busy - (line.pause ?? pace[0])); }
      // The speaker's own reaction plays as the line ends, and the pause makes room for it.
      if (line.react) react(line.who, line.react, clock);
      clock += Math.max(line.pause ?? pace[0], line.react ? REACTIONS[line.react].seconds : 0);
      last = line.who; speakers.push(line.who);
    });
    for (const item of shot.acting ?? []) { act(item, start + (item.at ?? 0)); moves(walkedIn.includes(item) ? { ...item, enter: undefined } : item, start + (item.at ?? 0)); if (item.react) react(item.who, item.react, start + (item.at ?? 0), item.stretch ?? 1); for (const g of gesturesOf(item.gesture)) gesture(item.who, g.name, start + (item.at ?? 0) + (g.at ?? 0)); }
    clock += shot.hold ?? (shot.card ? 1.8 : shot.lines?.length ? pace[1] : 0);
    clock = Math.max(clock, busy + 0.3);   // a shot never cuts away in the middle of a reaction
    // An arm or a head needs about a third of a second to move. A move started in a shot's last half second is cut off.
    for (const item of shot.acting ?? []) if (item.face === 'wink' && !(shot.acting ?? []).some((later) => later.who === item.who && later.face && later.face !== 'wink' && (later.at ?? 0) > (item.at ?? 0) && (later.at ?? 0) - (item.at ?? 0) <= 0.6)) warnings.push(`${cutId}: ${item.who}'s wink at ${item.at ?? 0} s is not ended within 0.6 s, so it reads as a closed eye. Use "react": "one-wink".`);
    for (const item of shot.acting ?? []) if ((item.pose || item.look) && clock - (start + (item.at ?? 0)) < 0.5) warnings.push(`${cutId}: ${item.who}'s ${item.pose ? 'pose' : 'look'} at ${item.at ?? 0} s starts less than half a second before the shot ends, so it is cut off mid-move. Lengthen "hold" or start it earlier.`);
    const to = Math.round(clock * FPS), kind = shot.frame ?? 'wide';
    const on = [shot.on ?? (kind === 'group' ? [...new Set(speakers)] : speakers[0] ?? shot.acting?.[0]?.who ?? ids[0])].flat();
    if (kind === 'group' && on.length < 2 && ids.length > 1) warnings.push(`${cutId}: a group frame with one person in it is framed like a medium shot. Name two or more in "on".`);
    slices.length = 0;
    // A call is always shown whole. A wide or group shot is the gallery, with a green edge on whoever speaks in it; a medium
    // or close is that one person's tile, large, with everyone else off the screen.
    let call = null, callCast = null;
    if (onCall) {
      const solo = (kind === 'medium' || kind === 'close') && on.length ? on[0] : null, big = [W / 2 - 250, 20, 500];
      call = { tiles: (solo ? [solo] : ids).map((id) => ({ box: solo ? big : tiles[ids.indexOf(id)], name: specs[id].name, wall: CALL_WALLS[ids.indexOf(id) % CALL_WALLS.length], speaking: !solo && speakers.includes(id) })) };
      if (solo) callCast = Object.fromEntries(ids.map((id) => [id, id === solo ? webcam(id, big) : { ...marks[id], x: -3000 }]));
    }
    cuts.push({ id: cutId, shot: cutId, scene: n, from, to, set, staging: kind.toUpperCase(), cast: callCast ?? marks, ...(call ? { call } : {}), camera: onCall ? [0, 0, W] : camera(kind === 'group' && on.length < 2 ? 'medium' : kind, on.length ? on : ids),
      backdrop: custom ? part.set : null, beats: beats.sort((a, b) => a.at - b.at), punches: [], move: shot.zoom ? { type: 'zoom', scale: shot.zoom } : null,
      angle: shot.end === 'fade' ? 'ending' : undefined, frame: kind, on, label: shot.label, ...(shot.card ? { card: { text: shot.card, sub: shot.sub ?? '' } } : {}), ...(peak !== null && !shot.lines?.length ? { peak: Math.min(to - 1, peak), played } : {}) });
    for (const text of slices) warnings.push(`${cutId}: ${text}`);
    clock = to / FPS;
  });
  });
  const music = sketch.music === undefined ? null : { file: cueOf(sketch.music).file, volume: cueOf(sketch.music).volume ?? 0.25 };
  return { format: 'character-sketch-plan/1', title: sketch.title ?? '', fps: FPS, frames: cuts.at(-1).to, cast: everyone.map((id) => ({ id, name: specs[id].name })), cuts, lines, sounds, music, warnings,
    cutout: { cast: Object.fromEntries(everyone.map((id) => [id, specs[id]])) } };
}

// Signs that a generated recording holds more than its words, such as the line spoken twice. A paid
// voice did this on 2026-11-12: a five-word line came back 3.3 s long with the phrase repeated after a
// silence. Nobody here can hear, so these are measured: seconds per word (good takes ran 0.28 to 0.51, the
// doubled ones 0.66 and 0.72), a very short line running far past its estimate, and a long silence inside
// the recording that no pause mark in the words explains. A flag means "listen to this", not "this is wrong".
function suspect(text, duration, cues) {
  const words = spoken(text), count = words.split(' ').filter(Boolean).length, why = [];
  if (count >= 4 && duration / count > 0.6) why.push(`${(duration / count).toFixed(2)} s per word (usual is under 0.55)`);
  if (count < 4 && duration > 2 * estimate(words)) why.push(`${duration.toFixed(1)} s for ${count} word(s)`);
  const gaps = (cues ?? []).filter(([from, to, shape]) => shape === 'X' && to - from >= 0.45 && from > 0.15 && to < duration - 0.15);
  const marks = (words.slice(0, -1).match(/[,.?!…;:-]/g) ?? []).length;
  if (gaps.length > marks) why.push(`${gaps.length} long silence(s) inside it and ${marks} pause mark(s) in the words`);
  return why;
}

// Lip sync, measured. A mouth that is shut while the voice is loud, or flapping in a silence, is the
// first thing that makes a video look amateur, and nobody here can hear it. So each recording's loudness
// is read frame by frame and set against the mouth shape drawn on that frame.
async function loudnessOf(wav) {
  const pcm = await run('ffmpeg', ['-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 's16le', '-']);
  const step = Math.round(16000 / FPS), levels = [];
  for (let start = 0; start + step * 2 <= pcm.length; start += step * 2) {
    let sum = 0;
    for (let i = 0; i < step; i++) { const v = pcm.readInt16LE(start + i * 2) / 32768; sum += v * v; }
    levels.push(Math.sqrt(sum / step));
  }
  const peak = [...levels].sort((a, b) => a - b)[Math.floor(levels.length * 0.95)] || 1;
  return levels.map((level) => Math.min(1, level / peak));
}
const OPENNESS = { X: 0, A: 0.1, B: 0.3, C: 0.65, D: 1, E: 0.6, F: 0.4, G: 0.3, H: 0.5 };
// levels: loudness per frame, 0 to 1. cues: [start, end, shape] in seconds. Returns what share of the loud
// frames have a resting mouth, the longest such stretch, and what share of the silent frames have an open one.
function lipSync(levels, cues) {
  const shapeAt = (frame) => cues.find(([from, to]) => (frame + 0.5) / FPS >= from && (frame + 0.5) / FPS < to)?.[2] ?? 'X';
  let loud = 0, shut = 0, run = 0, longest = 0, quiet = 0, open = 0;
  levels.forEach((level, frame) => {
    const shape = shapeAt(frame);
    if (level >= 0.3) { loud++; if (shape === 'X') { shut++; run++; longest = Math.max(longest, run); } else run = 0; } else run = 0;
    if (level < 0.05) { quiet++; if (OPENNESS[shape] >= 0.5) open++; }
  });
  const result = { shutWhileLoud: loud ? +(shut / loud).toFixed(2) : 0, longestShut: +(longest / FPS).toFixed(2), openWhileSilent: quiet ? +(open / quiet).toFixed(2) : 0, why: [] };
  if (result.longestShut >= 0.3 || result.shutWhileLoud > 0.15) result.why.push(`mouth at rest for ${Math.round(result.shutWhileLoud * 100)}% of the loud part, ${result.longestShut} s at a stretch`);
  if (quiet >= 8 && result.openWhileSilent > 0.5) result.why.push(`mouth open for ${Math.round(result.openWhileSilent * 100)}% of the silence`);
  return result;
}

// The frame of a line to show on the contact sheet: the open mouth nearest the middle, so a pause
// between two sentences is not mistaken for a line nobody speaks.
const OPEN = { C: 1, D: 1, E: 1, H: 1 };
function spokenFrame(line) {
  const middle = (line.endFrame - line.startFrame) / FPS / 2, centre = (cue) => (cue[0] + cue[1]) / 2;
  const best = line.cues.filter((cue) => OPEN[cue[2]]).sort((a, b) => Math.abs(centre(a) - middle) - Math.abs(centre(b) - middle))[0];
  return Math.min(line.endFrame - 1, line.startFrame + Math.round((best ? centre(best) : middle) * FPS));
}
const clip = (text, length) => (text.length > length ? text.slice(0, length - 1) + '…' : text);

// ---- Drawing and assembling -----------------------------------------------------------------------------
async function build(workspace, sketch, name, options) {
  const specs = await loadCharacters(workspace);
  check(sketch, specs);
  const engine = options.voice ?? sketch.voice ?? defaultEngine();
  if (!ENGINES.includes(engine)) throw new Error(`voice must be one of: ${ENGINES.join(', ')}`);
  if (engine === 'say' && !(process.platform === 'darwin' && onPath('say'))) throw new Error('The "say" voice only exists on a Mac. Use --voice none, openvoice, elevenlabs or sarvam, or give lines an "audio" file.');
  // What else decides how a line sounds, so it is part of the name a recording is kept under.
  // "elevenlabsSpeed": 0.7 to 1.2 (1 is normal). It is part of the model text, so a new speed makes new recordings.
  const pace11 = sketch.elevenlabsSpeed ?? 1;
  if (!(pace11 >= 0.7 && pace11 <= 1.2)) throw new Error('"elevenlabsSpeed" must be a number from 0.7 to 1.2');
  // "openvoiceSpeed": 0.8 to 1.3 (1 is normal), the free local voice's speaking rate. A new speed makes new recordings, at no cost.
  const paceOv = sketch.openvoiceSpeed ?? 1;
  if (!(paceOv >= 0.8 && paceOv <= 1.3)) throw new Error('"openvoiceSpeed" must be a number from 0.8 to 1.3');
  const model = engine === 'elevenlabs' ? (sketch.elevenlabsModel ?? 'eleven_v4') + (pace11 === 1 ? '' : ` speed=${pace11}`) : engine === 'sarvam' ? `${sketch.sarvamModel ?? 'bulbul:v4-flash'} ${sketch.language ?? 'en-IN'}` : '';
  const { voiced, receipt } = await speak(workspace, linesOf(sketch), specs, engine, { maxChars: options['max-chars'], model, openvoiceSpeed: paceOv, retake: String(options.retake ?? '').split(',').map((id) => id.trim()).filter(Boolean) });
  const plan = compile(sketch, specs, voiced);
  // Generated speech that may hold extra or repeated words. The user's own recordings are left alone.
  const listen = plan.lines.map((line) => ({ line, take: voiced[line.id] })).filter(({ take }) => take && ['elevenlabs', 'sarvam'].includes(take.engine))
    .map(({ line, take }) => ({ id: line.id, text: spoken(line.text), seconds: take.duration, why: suspect(line.text, take.duration, take.cues), file: relative(workspace, take.wav) })).filter((item) => item.why.length);
  // Lip sync: where each line's mouth shapes came from, and whether they sit on the sound.
  const sync = { rhubarb: 0, loudness: 0, guessed: 0, flagged: [] };
  for (const line of plan.lines) {
    const take = voiced[line.id];
    if (!take) { sync.guessed++; continue; }
    sync[take.cuesFrom === 'rhubarb' ? 'rhubarb' : 'loudness']++;
    const result = lipSync(await loudnessOf(take.wav), take.cues);
    if (result.why.length) sync.flagged.push({ id: line.id, text: spoken(line.text), ...result });
  }
  const out = join(workspace, 'out', options.draft ? name + '-draft' : name), size = options.draft ? [W, H] : [W * 2, H * 2];
  await mkdir(out, { recursive: true });
  // Each scene has its own room. A backdrop is read once; the laptops are set just before a scene's rooms are drawn.
  const backdrops = {}, kits = createCast(plan.cutout.cast);
  for (const cut of plan.cuts) if (cut.backdrop && !backdrops[cut.backdrop]) {
    const file = resolve(workspace, cut.backdrop);
    if (!existsSync(file)) throw new Error(`The backdrop ${cut.backdrop} does not exist.`);
    backdrops[cut.backdrop] = 'data:image/svg+xml;base64,' + (await readFile(file)).toString('base64');
  }
  const stages = scenesOf(sketch).map((part, n) => {
    laptops = new Set(part.laptops ?? []);
    callQueue = plan.cuts.filter((cut) => cut.scene === n && cut.call).map((cut) => cut.call);
    return createScene({ timeline: { ...plan, cuts: plan.cuts.filter((cut) => cut.scene === n) }, kits, asset: (name) => backdrops[name] });
  });
  const scene = { frame: (clock) => stages[plan.cuts.find((cut) => clock >= cut.from && clock < cut.to)?.scene ?? stages.length - 1].frame(clock) };
  // Sound effects and music are files the sketch names. They are mixed under the voices at the times the plan gives.
  const effects = [...plan.sounds, ...(plan.music ? [{ ...plan.music, at: 0, length: plan.frames / FPS, music: true }] : [])];
  for (const effect of effects) {
    effect.path = resolve(workspace, effect.file);
    if (!existsSync(effect.path)) {
      if (!options.draft) throw new Error(`The sound ${effect.file} does not exist in ${workspace}. Make or add the file, or take the sound out of the sketch.`);
      plan.warnings.push(`The sound ${effect.file} does not exist yet, so this draft plays without it. A full-size render will stop until the file is there.`);
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) if (!existsSync(effects[i].path)) effects.splice(i, 1);
  // Captions sit on top of the finished picture. "auto" captions only the lines that have no recording.
  const setting = captionSetting(options.captions ?? sketch.captions), silent = new Set(plan.lines.filter((line) => !line.wav).map((line) => line.id));
  const captioned = setting.show === 'always' ? plan.lines : setting.show === 'never' ? [] : plan.lines.filter((line) => silent.has(line.id));
  const names = Object.fromEntries(Object.entries(specs).map(([id, spec]) => [id, spec.name]));
  const tag = (clock) => { const text = plan.cuts.find((cut) => clock >= cut.from && clock < cut.to)?.label; return text ? `<rect x="24" y="22" width="${24 + text.length * 11.5}" height="40" rx="8" fill="#1d2420" opacity=".82"/>` + `<text x="36" y="49" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#f7f1e6">${text}</text>` : ''; };
  // A title card fills the frame: big words in the middle, split into rows, with an optional smaller line under them.
  const cardSvg = (card) => {
    const rows = card.text.split(/\s+/).reduce((made, word) => { if ((made.at(-1) + ' ' + word).trim().length <= 24) made[made.length - 1] = (made.at(-1) + ' ' + word).trim(); else made.push(word); return made; }, ['']);
    const top = H / 2 - (rows.length - 1) * 34 - (card.sub ? 20 : 0), text = (y, words, size, weight, fill) => `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${words.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    return `<rect width="${W}" height="${H}" fill="#2b2f36"/><rect x="${W / 2 - 40}" y="${top - 74}" width="80" height="6" rx="3" fill="#e0a02f"/>` +
      rows.map((row, i) => text(top + i * 68 + 18, row, 58, 700, '#f7f1e6')).join('') + (card.sub ? text(top + rows.length * 68 + 6, card.sub, 26, 400, '#c9c4b8') : '');
  };
  const cardAt = (clock) => plan.cuts.find((cut) => clock >= cut.from && clock < cut.to)?.card;
  const inner = (clock) => (cardAt(clock) ? cardSvg(cardAt(clock)) : scene.frame(clock) + captionSvg({ lines: captioned, clock, names, setting }) + tag(clock));
  const frame = (clock) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="0 0 ${W} ${H}">${inner(clock)}</svg>`;

  // The contact sheet first: one picture per line (mid-line) and one per silent shot. Look at it before the video.
  const picks = plan.cuts.flatMap((cut) => {
    const own = plan.lines.filter((line) => line.startFrame >= cut.from && line.startFrame < cut.to);
    return own.length ? own.map((line) => ({ clock: spokenFrame(line), text: `${cut.id} ${cut.frame} · ${line.character}: ${spoken(line.text)}` }))
      : [{ clock: cut.peak ?? Math.round((cut.from + cut.to) / 2), text: cut.card ? `${cut.id} card · ${cut.card.text}` : `${cut.id} ${cut.frame} · silent${cut.played ? `, ${cut.played}` : ''}` }];
  });
  // Everyone blinks on a fixed clock (see cutout-draw.mjs). A picture taken on a blink shows closed eyes that are not in the acting.
  const blinking = (clock, cut) => Object.keys(cut.cast).some((id, order) => (clock + order * 29 + id.charCodeAt(id.length - 1) * 7) % 79 < 4);
  for (const pick of picks) { const cut = plan.cuts.find((item) => pick.clock >= item.from && pick.clock < item.to); while (cut && blinking(pick.clock, cut) && pick.clock + 1 < cut.to) pick.clock++; }
  const shownPicks = picks.length > 24 ? picks.filter((_, i) => i % Math.ceil(picks.length / 24) === 0) : picks;
  let columns = Math.min(3, shownPicks.length), rows = Math.ceil(shownPicks.length / columns), sheetSize = [16 + columns * 496, 16 + rows * 312];
  let tiles = shownPicks.map((pick, i) => {
    const x = 16 + (i % columns) * 496, y = 16 + Math.floor(i / columns) * 312;
    return `<svg x="${x}" y="${y}" width="480" height="270" viewBox="0 0 ${W} ${H}">${inner(pick.clock)}</svg>` +
      label(x, y + 290, clip(`${(pick.clock / FPS).toFixed(1)}s  ${pick.text}`, 76), 13, 400, 'start');
  }).join('');
  if (options.strips) {
    // A reel of reactions: one row per shot, seven frames across it, so each performance can be read as a strip.
    columns = 7; rows = plan.cuts.length; sheetSize = [16 + columns * 248, 16 + rows * 176];
    tiles = plan.cuts.map((cut, r) => Array.from({ length: columns }, (_, c) => {
      const clock = Math.min(cut.to - 1, cut.from + Math.round(options.strips.lead * FPS + (c / (columns - 1)) * options.strips.length(cut) * FPS));
      return `<svg x="${16 + c * 248}" y="${16 + r * 176}" width="240" height="135" viewBox="0 0 ${W} ${H}">${scene.frame(clock)}</svg>`;
    }).join('') + label(16, 16 + r * 176 + 154, options.strips.text(cut), 13, 600, 'start')).join('');
  }
  await writeFile(join(out, 'contact-sheet.png'), await png(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetSize[0]}" height="${sheetSize[1]}"><rect width="100%" height="100%" fill="#f7f1e6"/>${tiles}</svg>`));

  // Every frame, eight at a time, straight into FFmpeg.
  const picture = join(out, 'picture.mp4'), output = join(out, 'sketch.mp4'), duration = plan.frames / FPS;
  const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), picture],
    { stdio: ['pipe', 'ignore', 'pipe'] });
  let complaint = '';
  encoder.stderr.on('data', (chunk) => { complaint += chunk; });
  const closed = new Promise((done, fail) => {
    encoder.once('error', (error) => fail(error.code === 'ENOENT' ? new Error(`"ffmpeg" is not installed. ${INSTALL.ffmpeg}`) : error));
    encoder.once('close', (code) => (code === 0 ? done() : fail(new Error('FFmpeg could not encode the frames: ' + complaint.slice(0, 300)))));
  });
  encoder.stdin.on('error', () => {});
  for (let first = 0; first < plan.frames; first += 8) {
    const batch = await Promise.all(Array.from({ length: Math.min(8, plan.frames - first) }, (_, i) => png(frame(first + i))));
    for (const image of batch) if (!encoder.stdin.write(image)) await new Promise((drained) => encoder.stdin.once('drain', drained));
  }
  encoder.stdin.end();
  await closed;

  const talking = plan.lines.filter((line) => line.wav);
  if (talking.length || effects.length) {
    const same = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
    const filters = talking.map((line, i) => `[${i + 1}:a]aresample=48000,atrim=duration=${(line.endFrame - line.startFrame) / FPS},asetpts=PTS-STARTPTS,${same},adelay=${line.startFrame * 2000}S:all=1[a${i}]`);
    effects.forEach((effect, i) => {
      // A sound with a length is cut there and faded out; music fades out with the video.
      const cut = effect.length ? `atrim=duration=${effect.length},afade=t=out:st=${Math.max(0, effect.length - (effect.music ? 1 : 0.4)).toFixed(2)}:d=${effect.music ? 1 : 0.4},` : '';
      filters.push(`[${talking.length + i + 1}:a]${same},${cut}volume=${effect.volume},adelay=${Math.round(effect.at * 1000)}:all=1[e${i}]`);
    });
    const count = talking.length + effects.length;
    filters.push(talking.map((_, i) => `[a${i}]`).join('') + effects.map((_, i) => `[e${i}]`).join('') + `amix=inputs=${count}:normalize=0,${effects.length ? 'alimiter=limit=0.89:level=false,' : ''}apad=whole_dur=${duration},atrim=duration=${duration}[audio]`);
    await run('ffmpeg', ['-v', 'error', '-y', '-i', picture, ...talking.flatMap((line) => ['-i', line.wav]), ...effects.flatMap((effect) => ['-i', effect.path]), '-filter_complex', filters.join(';'),
      '-map', '0:v:0', '-map', '[audio]', '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', output]);
    await rm(picture);
  } else {
    await rm(output, { force: true });
    await cp(picture, output);
    await rm(picture);
  }
  const streams = JSON.parse((await run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate,nb_read_frames,duration', '-of', 'json', output])).toString()).streams;
  const video = streams.find((stream) => stream.codec_type === 'video'), audio = streams.find((stream) => stream.codec_type === 'audio');
  if (!video || Number(video.nb_read_frames) !== plan.frames || video.width !== size[0] || Boolean(audio) !== Boolean(talking.length || effects.length))
    throw new Error('The video does not match the plan (frame count, size or sound). Do not show it; render again.');
  if (plan.frames / FPS > 180) plan.warnings.push('This is over three minutes. The longest render checked so far is under two.');
  if (silent.size && engine !== 'none') plan.warnings.push(`${silent.size} line(s) have no recording and play silent with captions.`);
  // The saved plan names recordings relative to the workspace, so it can be shared without this machine's folders in it.
  await writeFile(join(out, 'plan.json'), JSON.stringify({ ...plan, lines: plan.lines.map((line) => ({ ...line, wav: line.wav && relative(workspace, line.wav) })), sounds: plan.sounds.map(({ path, ...sound }) => sound) }, null, 2) + '\n');
  // A subtitle file of every spoken line, whether or not captions are drawn on the picture, split and timed the
  // way the drawn captions are. Upload it beside the video to a site that shows its own captions.
  const subtitles = join(out, 'captions.srt'), cues = captionCues({ lines: plan.lines, names, setting, fps: FPS });
  if (cues.length) await writeFile(subtitles, srt(cues)); else await rm(subtitles, { force: true });
  await writeFile(join(out, 'run.json'), JSON.stringify({ sketchSha256: sha(JSON.stringify(sketch)), toolSha256: sha(await readFile(fileURLToPath(import.meta.url))),
    frames: plan.frames, duration, size, captions: setting, scenes: stages.length, cuts: plan.cuts.length, lines: plan.lines.length, voicedLines: talking.length, sounds: effects.length, voice: receipt, listen, lipSync: sync, warnings: plan.warnings, streams }, null, 2) + '\n');
  console.log(`${stages.length > 1 ? `${stages.length} scenes, ` : ''}${plan.cuts.length} shot(s), ${plan.lines.length} line(s),${effects.length ? ` ${effects.length} sound(s),` : ''} ${duration.toFixed(1)} s, voice: ${engine}` +
    (engine === 'none' ? '' : ` (${receipt.generated} new, ${receipt.reused} reused${receipt.recovered ? `, ${receipt.recovered} from replies already paid for` : ''}${receipt.characters ? `, ${receipt.characters} characters sent` : ''}${receipt.credits ? `, ${receipt.credits} credits charged` : ''})`));
  for (const warning of plan.warnings) console.log(`warning: ${warning}`);
  if (plan.lines.length) {
    const rough = sync.loudness + sync.guessed;
    console.log(`LIP SYNC: ${sync.rhubarb} line(s) with mouths matched to the sounds${sync.loudness ? `, ${sync.loudness} following loudness only` : ''}${sync.guessed ? `, ${sync.guessed} guessed from the words (no recording)` : ''}.` +
      (rough ? (options.draft ? ' Fine for a draft.' : ' NOT READY TO SHOW AS FINISHED: rough lip sync is the first thing that makes a video look amateur.') : ''));
    if (sync.loudness) console.log(`  Loudness only opens and closes the mouth with the volume. ${rhubarbPath() ? '' : `Rhubarb Lip Sync is not installed. With the user's yes, run: bash ${join(HERE, 'install-rhubarb.sh')} (an 87 MB download), or set RHUBARB to a copy they have. Then render again: existing recordings are measured again at no cost.`}`);
    for (const item of sync.flagged) console.log(`  ${item.id}  "${clip(item.text, 50)}": ${item.why.join('; ')}. Watch this line.`);
  }
  for (const item of receipt.rejected) console.log(`retake: ${item.line} was recorded again. The earlier take is kept as ${item.kept}`);
  if (listen.length) console.log(`LISTEN: ${listen.length} recording(s) may hold repeated or extra speech. You cannot hear them, so tell the user which lines to play:`);
  for (const item of listen) console.log(`  ${item.id}  "${clip(item.text, 60)}"  ${item.seconds.toFixed(2)} s: ${item.why.join('; ')}  (${item.file})`);
  if (listen.length) console.log(`  If one is wrong, change or drop its [delivery cue] and render again; to record the same words again, add --retake ${listen.map((item) => item.id).join(',')}`);
  console.log(`look first: ${join(out, 'contact-sheet.png')}`);
  console.log(`video:      ${output}`);
  if (cues.length) console.log(`subtitles:  ${subtitles}  (${cues.length} caption(s); the timing within a line is estimated from its letters)`);
}

// ---- Commands -----------------------------------------------------------------------------------------
async function doctor(workspace) {
  let ok = true;
  const [major] = process.versions.node.split('.').map(Number);
  const row = (good, name, note) => { console.log(`${good ? 'ok     ' : 'MISSING'}  ${name}${note ? '  ' + note : ''}`); };
  row(major >= 20, `node ${process.versions.node}`, major >= 20 ? '' : 'Node 20 or newer is needed.');
  ok &&= major >= 20;
  for (const tool of ['rsvg-convert', 'ffmpeg', 'ffprobe']) { const found = onPath(tool); row(found, tool, found ? '' : INSTALL[tool]); ok &&= found; }
  const voices = await sayVoices();
  console.log(`${voices.length ? 'ok     ' : 'no     '}  free voice (macOS say)${voices.length ? '' : '  Sketches render silent with captions, or use ElevenLabs or your own recordings.'}`);
  console.log(`${openvoiceReady() ? 'ok     ' : 'no     '}  free local voice (openvoice)${openvoiceReady() ? '' : '  Optional, about 2 GB. Install only if the user asks: bash scripts/install-openvoice.sh'}`);
  for (const [engine, name] of Object.entries(KEY_NAMES)) {
    const key = await findKey(workspace, name).catch((error) => ({ problem: error.message }));
    console.log(`${key?.value ? 'ok     ' : 'no     '}  ${name}${key?.value ? `  found in ${key.from}. Paid; used only with --voice ${engine} and --max-chars.` : key?.problem ? '  ' + key.problem : '  Optional, paid. Goes in .env.local in the working folder; start from .env.example in the skill folder.'}`);
  }
  console.log(`${rhubarbPath() ? 'ok     ' : 'no     '}  Rhubarb Lip Sync${rhubarbPath() ? '' : `  Needed for a finished video. Without it mouths only open and close with the volume, which looks amateur. Ask the user, then run: bash ${join(HERE, 'install-rhubarb.sh')}`}`);
  if (!ok) throw new Error('Install what is marked MISSING, then run doctor again.');
}

function parse(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) rest.push(argv[i]);
    else if (argv[i] === '--draft') flags.draft = true;
    else if (argv[i] === '--replace') flags.replace = true;
    else flags[argv[i].slice(2)] = argv[++i];
  }
  if (flags.credits !== undefined) flags['max-chars'] ??= flags.credits;   // the first release's name for the same cap
  if (flags['max-chars'] !== undefined) flags['max-chars'] = Number(flags['max-chars']);
  return { flags, rest };
}

// A sketch as a script a person can read and comment on, with how long it should run. Lengths are
// estimated from word counts, so the real video differs by a little once the lines are recorded.
// Characters that have no file yet are allowed here, so a script can be reviewed before anyone is drawn.
async function readable(workspace, sketch) {
  const specs = await loadCharacters(workspace), parts = scenesOf(sketch);
  const ids = [...new Set(parts.flatMap((part) => idsOf(part ?? {})))], undrawn = ids.filter((id) => id && !specs[id]);
  for (const id of undrawn) specs[id] = character({ id }, `${id}.json`);
  const plan = compile(sketch, specs, {}), seconds = (frames) => (frames / FPS).toFixed(1);
  const words = plan.lines.reduce((sum, line) => sum + spoken(line.text).split(/\s+/).length, 0), setting = captionSetting(sketch.captions);
  const sent = linesOf(sketch).filter((line) => !line.audio && !line.voice).reduce((sum, line) => sum + line.say.length, 0);
  const acted = (item) => [item.hold && (item.hold === 'none' ? 'puts it away' : `holds a ${item.hold}`), item.moment && `${item.moment} with ${item.with}`, item.enter && `walks in from the ${item.enter}`, item.exit && `walks out to the ${item.exit}`, item.react && `plays ${item.react}`, ...gesturesOf(item.gesture).map((g) => `${g.name}${g.on ? ` on "${g.on}"` : ''}`), item.face, item.pose, item.do, item.look && `looks ${item.look === 'camera' ? 'at camera' : item.look}`].filter(Boolean).join(', ');
  const heard = (value, timing) => cuesOf(value).map((cue) => `       ♪ ${cue.file}${timing === 'line' ? (cue.when === 'with' ? ' with the line' : ' after the line') : ` at ${cue.at ?? 0} s`}`);
  const room = (part) => [`set: ${part.set ?? 'plain'}`, `cast: ${(part.cast ?? []).map((entry) => (typeof entry === 'string' ? entry : `${entry?.id}${entry?.sit ? ' (sitting)' : ''}`)).join(', ')}`, part.laptops?.length && `laptops: ${part.laptops.join(', ')}`, part.holding && `holding: ${Object.entries(part.holding).map(([id, thing]) => `${id} (${thing})`).join(', ')}`, part.busy && `busy: ${Object.entries(part.busy).map(([id, pose]) => `${id} (${pose})`).join(', ')}`].filter(Boolean).join(' · ');
  const out = [sketch.title ?? '(untitled)', [parts.length === 1 && room(parts[0]), sketch.tone && `tone: ${sketch.tone}`, `pace: ${sketch.pace ?? 'normal'}`,
    `captions: ${setting.show === 'never' ? 'off' : `${setting.style} (${setting.show})`}`, sketch.music && `music: ${cueOf(sketch.music).file}`].filter(Boolean).join(' · '),
    `about ${seconds(plan.frames)} s · ${parts.length > 1 ? `${parts.length} scenes · ` : ''}${plan.cuts.length} shot(s) · ${plan.lines.length} line(s) · ${words} words`,
    `a paid voice would be sent ${sent} characters: about ${sent} ElevenLabs credits (${dollars(sent)} at the Starter plan's rate)`, ''];
  let s = 0;
  parts.forEach((part, n) => {
    if (parts.length > 1) out.push(`SCENE ${n + 1} · ${room(part)}`);
    for (const shot of part.shots) {
      const cut = plan.cuts[s++];
      out.push(`${s}. ${shot.card ? 'TITLE CARD' : cut.frame.toUpperCase()}${shot.card || cut.frame === 'wide' ? '' : ` on ${cut.on.join(' and ')}`}   ${seconds(cut.from)}–${seconds(cut.to)} s${shot.zoom ? '   slow push in' : ''}${shot.end === 'fade' ? '   fade out' : ''}`);
      if (shot.card) out.push(`     CARD: ${shot.card}${shot.sub ? `  /  ${shot.sub}` : ''}`);
      out.push(...heard(shot.sound, 'shot'));
      for (const line of shot.lines ?? []) {
        const note = acted({ face: line.face, pose: line.pose, do: line.do, react: line.react, gesture: line.gesture, enter: line.enter, exit: line.exit, moment: line.moment, with: line.with, hold: line.hold }), reactions = Object.entries(line.reactions ?? {}).map(([id, face]) => `${specs[id]?.name ?? id}: ${face}`).join(', ');
        out.push(`     ${(specs[line.who]?.name ?? line.who).toUpperCase()}${note ? ` (${note})` : ''}${line.voice ? ` {${line.voice} voice}` : ''}: ${line.say}${reactions ? `   [${reactions}]` : ''}`);
        out.push(...heard(line.sound, 'line'));
        if (line.pause !== undefined) out.push(`       … pause ${line.pause} s`);
      }
      for (const item of shot.acting ?? []) out.push(`     ${specs[item.who]?.name ?? item.who}, ${shot.lines?.length ? '' : 'silent '}at ${item.at ?? 0} s: ${acted(item)}`);
      if (shot.hold) out.push(`       … hold ${shot.hold} s`);
    }
    if (parts.length > 1) out.push('');
  });
  if (undrawn.length) out.push('', `No character file yet for: ${undrawn.join(', ')}. Build them before rendering.`);
  for (const warning of plan.warnings) out.push(`warning: ${warning}`);
  return out.join('\n');
}

// Ready sounds made on this machine: each is a formula FFmpeg turns into a short WAV, so they cost nothing, need no
// download and are the same every time. They are simple tones and noise. A laugh or a real door cannot be made this way.
const SOUND_PACK = {
  ding: [1.0, 'A bright bell: a right answer, an idea, a notification.', '0.5*sin(2*PI*1318*t)*exp(-5*t)+0.25*sin(2*PI*2637*t)*exp(-7*t)'],
  pop: [0.2, 'A short pop: something appears.', '0.7*sin(2*PI*(700-2200*t)*t)*exp(-26*t)'],
  beep: [0.2, 'One plain beep.', '0.4*sin(2*PI*880*t)*min(1,t*80)*min(1,(0.2-t)*60)'],
  error: [0.5, 'A low double buzz: wrong, denied.', '(0.32*sin(2*PI*150*t)+0.18*sin(2*PI*300*t)+0.1*sin(2*PI*450*t))*(lt(t,0.2)+gt(t,0.27))*min(1,(0.5-t)*40)'],
  buzz: [1.3, 'A phone vibrating on a table, twice.', '0.45*sin(2*PI*140*t)*(1+0.3*sin(2*PI*33*t))*lt(mod(t,0.65),0.4)'],
  knock: [0.8, 'Three knocks on a door.', '0.9*sin(2*PI*120*t)*exp(-45*mod(t,0.22))*lt(t,0.66)'],
  click: [0.08, 'One click: a mouse, a switch.', '0.8*(random(0)*2-1)*exp(-130*t)'],
  typing: [3.0, 'Keyboard typing, three seconds.', '0.5*(random(0)*2-1)*exp(-95*mod(t+0.05*sin(7*t),0.14))'],
  whoosh: [0.6, 'A quick rush of air: a cut, a swipe, someone passing.', '0.6*(random(0)*2-1)*sin(PI*t/0.6)*sin(PI*t/0.6)'],
  tada: [1.2, 'Three rising notes: a small win.', '0.38*sin(2*PI*523*t)*lt(t,0.15)+0.38*sin(2*PI*659*t)*between(t,0.15,0.3)+0.42*sin(2*PI*784*t)*gt(t,0.3)*exp(-3*(t-0.3))'],
  fail: [1.1, 'Two falling notes: it did not work.', '0.4*sin(2*PI*392*t)*lt(t,0.3)*min(1,t*60)+0.4*sin(2*PI*277*t)*gte(t,0.3)*exp(-2.4*(t-0.3))'],
  doorbell: [1.5, 'A two-note doorbell.', '0.42*sin(2*PI*659*t)*lt(t,0.45)*exp(-2*t)+0.42*sin(2*PI*523*t)*gte(t,0.45)*exp(-2.4*(t-0.45))'],
};
async function soundPack(workspace, wanted) {
  const unknown = wanted.filter((name) => !SOUND_PACK[name]);
  if (unknown.length) throw new Error(`There is no ready sound called ${unknown.join(', ')}. Choose from: ${Object.keys(SOUND_PACK).join(', ')}`);
  const folder = join(workspace, 'sfx');
  await mkdir(folder, { recursive: true });
  for (const [name, [seconds, note, formula]] of Object.entries(SOUND_PACK)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const file = join(folder, `${name}.wav`), filter = name === 'whoosh' ? ',highpass=f=500,lowpass=f=3500' : name === 'typing' || name === 'click' ? ',highpass=f=1200' : '';
    if (!existsSync(file)) await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc=${formula.replaceAll(',', '\\,')}:s=48000:d=${seconds}`, '-af', `volume=0.9${filter}`, '-ac', '1', file]);
    console.log(`sfx/${name}.wav`.padEnd(18) + `${seconds} s  ${note}`);
  }
  console.log('Name one in a sketch with "sound". None of these is a laugh: for an audience laugh use a file of the user\'s or the paid "sound" command.');
}

// Ask ElevenLabs to make a sound effect or a piece of music from a description, and keep it as a file a
// sketch can name. Paid, so it follows the same rule as the voices: an estimate first, nothing sent
// without a cap. Sound effects are documented at 40 credits a second (docs read 2026-11-12); the two made
// here that day cost 70 credits for 7 seconds, so the estimate is an upper figure. Music is listed at 900
// credits a minute and needs a paid plan; on a free account this stops before sending and says what to do.
async function makeSound(workspace, flags, words) {
  const text = words.join(' ').trim(), file = flags.out && resolve(workspace, flags.out), seconds = Number(flags.seconds), music = flags.kind === 'music';
  if (!text || !file || !(seconds > 0)) throw new Error('Usage: node sketch.mjs sound "what it sounds like" --seconds <n> --out sfx/<name>.mp3 [--kind music] [--max-credits <n>]');
  if (flags.kind !== undefined && !['effect', 'music'].includes(flags.kind)) throw new Error('--kind must be effect (the default) or music');
  if (music ? seconds < 3 || seconds > 300 : seconds < 0.5 || seconds > 30) throw new Error(music ? 'Music must be 3 to 300 seconds.' : 'A sound effect must be 0.5 to 30 seconds.');
  if (existsSync(file) && !flags.replace) { console.log(`${flags.out} already exists, so nothing was sent. To make it again add --replace (the current one is kept in a "rejected" folder beside it), or choose another name.`); return; }
  const key = await findKey(workspace, KEY_NAMES.elevenlabs);
  if (!key) throw new Error(keyHelp('elevenlabs'));
  const need = Math.ceil(music ? seconds * 15 : seconds * 40), cap = Number(flags['max-credits']);
  const account = await elevenlabsBalance(key).catch(() => null);
  // ElevenLabs makes music only for paid plans. Say so before sending anything, and give the ways forward.
  const noMusic = `ElevenLabs makes music only on a paid plan, and this account is on the free plan, so no music was made and nothing was charged. The sketch still renders without it. To have music: give a music file of your own as "music" in the sketch, or upgrade the ElevenLabs plan and run this again.`;
  if (music && account?.tier === 'free') { console.log(noMusic + ' Nothing was sent.'); return; }
  if (!(cap >= need)) {
    const balance = account ? ` The account has ${account.left} of ${account.limit} credits left${account.left < need ? ', which is NOT ENOUGH' : ''}.` : '';
    throw new Error(`This would ask ElevenLabs for ${seconds} s of ${music ? 'music' : 'sound'}: up to about ${need} credits (${dollars(need)} at the Starter plan's rate).${balance}${music ? ' Music needs a paid ElevenLabs plan.' : ''} Tell the user, and after they agree pass --max-credits ${need} or more. Nothing was sent.`);
  }
  const response = await fetch(music ? 'https://api.elevenlabs.io/v1/music' : 'https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST', headers: { 'xi-api-key': key.value, 'content-type': 'application/json' },
    body: JSON.stringify(music ? { prompt: text, music_length_ms: Math.round(seconds * 1000), force_instrumental: true } : { text, duration_seconds: seconds, prompt_influence: 0.5 }),
  });
  if (music && response.status === 402) { console.log(noMusic); return; }
  if (!response.ok) throw new Error(`ElevenLabs refused the ${music ? 'music' : 'sound'} (${response.status}): ${(await response.text()).slice(0, 240)}. Nothing was saved.`);
  await mkdir(dirname(file), { recursive: true });
  const audio = Buffer.from(await response.arrayBuffer());
  // The earlier sound is set aside only once its replacement has arrived.
  if (existsSync(file)) { console.log(`The earlier ${flags.out} is kept as ${relative(workspace, await setAside(file))}`); if (existsSync(file + '.json')) await setAside(file + '.json'); }
  await writeFile(file, audio);
  const cost = Number(response.headers.get('character-cost')) || null;
  await writeFile(file + '.json', JSON.stringify({ made: 'elevenlabs', kind: music ? 'music' : 'effect', text, seconds, credits: cost }, null, 2) + '\n');
  console.log(`made ${flags.out}${cost ? `, ${cost} credits charged` : ''}. Name it in a sketch with "sound" or "music".`);
}

// Copy the skill, complete, to another folder. The links to the drawing code become real files, the
// source project's own full-frame inserts are left out, and version.json says which snapshot this is.
async function exportSkill(target) {
  const to = resolve(target), setsPath = join(to, 'scripts/cutout-sets.mjs');
  await cp(resolve(HERE, '..'), to, { recursive: true, dereference: true });
  const sets = await readFile(setsPath, 'utf8'), start = sets.indexOf('export const inserts = {'), end = sets.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('export: the inserts table in cutout-sets.mjs was not found, so nothing was stripped. Check the copy before sharing it.');
  await writeFile(setsPath, sets.slice(0, start) + 'export const inserts = {};   // The source project keeps its own full-frame inserts; none ship with the skill.' + sets.slice(end + 3));
  const commit = await run('git', ['-C', HERE, 'rev-parse', '--short', 'HEAD']).then((out) => out.toString().trim(), () => null);
  await writeFile(join(to, 'version.json'), JSON.stringify({ version: VERSION, exported: new Date().toISOString().slice(0, 10), sourceCommit: commit }, null, 2) + '\n');
  console.log(`Copied version ${VERSION} of the skill to ${to}`);
}

export { GESTURES, MOMENTS, REACTIONS, character, check, compile, lipSync, loudnessOf, readable, speak, suspect };

// Everything below runs only when this file is the program being run, not when a test imports it.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
const { flags, rest: [mode, ...args] } = parse(process.argv.slice(2));
const workspace = resolve(flags.dir ?? '.');
try {
  if (mode === 'doctor') await doctor(workspace);
  else if (mode === 'sheet') await sheets(workspace, args);
  else if (mode === 'voices') {
    const voices = await sayVoices();
    console.log('say (free, Mac): ' + (voices.length ? voices.filter((voice) => voice.locale.startsWith('en')).map((voice) => voice.name).join(', ') + `. English ones shown; ${voices.length} in all languages.` : 'not available here.'));
    console.log(`openvoice (free, local): ${openvoiceReady() ? OPENVOICE_VOICES.join(', ') : 'not installed. Optional: bash scripts/install-openvoice.sh'}`);
    const key = await findKey(workspace, KEY_NAMES.elevenlabs).catch(() => null);
    const listed = key && await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key.value }, signal: AbortSignal.timeout(10000) }).then((response) => (response.ok ? response.json() : null), () => null);
    if (listed?.voices?.length) {
      console.log(`elevenlabs (paid): ${listed.voices.length} voice(s) on this account. Put the id in "voice": { "elevenlabs": "<id>" }. Only the key was sent.`);
      for (const voice of listed.voices) console.log(`  ${voice.voice_id}  ${voice.name}${voice.category ? `  (${voice.category})` : ''}${voice.labels ? '  ' + ['gender', 'age', 'accent', 'description'].map((field) => voice.labels[field]).filter(Boolean).join(', ') : ''}`);
      console.log('  On the free plan only "premade" voices can be used through the API.');
    } else console.log(`elevenlabs (paid): ${key ? 'the account\'s voices could not be listed just now.' : 'no key yet, so the account\'s voices cannot be listed.'} A voice id is the short code beside a voice at https://elevenlabs.io/app/voice-library or under "My Voices".`);
    console.log('sarvam (paid): speakers are listed at https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices');
    console.log('captions: ' + Object.entries(CAPTION_STYLES).map(([id, style]) => `${id} (${style.note.replace(/\.$/, '')})`).join('; '));
  } else if (mode === 'script' && args[0]) {
    console.log(await readable(workspace, JSON.parse(await readFile(resolve(workspace, args[0]), 'utf8'))));
  } else if (mode === 'say' && args.length >= 2) {
    const [id, ...words] = args;
    await build(workspace, { title: `${id} says`, set: flags.set ?? 'plain', cast: [id], captions: 'auto',
      shots: [{ frame: flags.frame ?? 'medium', hold: 0.6, lines: [{ who: id, say: words.join(' '), face: flags.face, pose: flags.pose, look: 'camera' }] }] }, `say-${id}-${words.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 4).join('-') || 'line'}`, flags);
  } else if (mode === 'render' && args[0]) {
    const file = resolve(workspace, args[0]);
    await build(workspace, JSON.parse(await readFile(file, 'utf8')), basename(file, '.json'), flags);
  } else if (mode === 'starters') {
    // Ready-made characters that ship with the skill, designed as a group so no two share a hair shape or top colour.
    const all = JSON.parse(await readFile(join(HERE, '..', 'starter-cast.json'), 'utf8')), folder = join(workspace, 'characters');
    const wanted = args.includes('all') ? all.map((item) => item.id) : args, unknown = wanted.filter((id) => !all.some((item) => item.id === id));
    if (unknown.length) throw new Error(`There is no starter called ${unknown.join(', ')}. Choose from: ${all.map((item) => item.id).join(', ')}, or "all".`);
    await mkdir(folder, { recursive: true });
    if (!wanted.length) {
      for (const item of all) console.log(`${item.id.padEnd(7)} ${item.description}`);
      const specs = Object.fromEntries(all.map((item) => [item.id, character(item, `${item.id}.json`)]));
      await writeFile(join(folder, 'starters.png'), await png(lineupSvg(specs, createCast(specs))));
      console.log(`${all.length} starter characters, pictured in ${join(folder, 'starters.png')}`);
      console.log('Copy some into this folder with: sketch.mjs starters <id> [<id> ...]   or   sketch.mjs starters all');
    } else for (const id of wanted) {
      const file = join(folder, `${id}.json`);
      if (existsSync(file)) { console.log(`characters/${id}.json already exists and was left alone.`); continue; }
      await writeFile(file, JSON.stringify(all.find((item) => item.id === id), null, 2) + '\n');
      console.log(`characters/${id}.json  (change anything you like; run "sheet ${id}" to see it)`);
    }
  } else if (mode === 'options' && args[0] === 'rooms') {
    const specs = await loadCharacters(workspace), file = join(workspace, 'characters', 'options-rooms.png');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await png(roomsSvg(specs)));
    for (const name of Object.keys(SETS)) console.log(`${name.padEnd(11)} ${ROOM_NOTES[name]}`);
    console.log(file);
  } else if (mode === 'options') {
    const [kind, id] = args, specs = await loadCharacters(workspace), spec = specs[id ?? Object.keys(specs)[0]];
    if (!PARTS[kind]) throw new Error(`Usage: node sketch.mjs options ${Object.keys(PARTS).join('|')} [character id]   or   options rooms`);
    if (!spec) throw new Error(id ? `There is no characters/${id}.json` : 'options needs a character to draw on: build one first.');
    const file = join(workspace, 'characters', `options-${kind}-${spec.id}.png`);
    await writeFile(file, await png(optionsSvg(kind, spec)));
    console.log(`${PARTS[kind].names().length} ${kind} choices: ${PARTS[kind].names().join(', ')}`);
    console.log(file);
  } else if (mode === 'reactions' || mode === 'gestures') {
    // One silent shot per stock reaction or gesture, labelled, on one character: a reel to watch and choose from.
    const table = mode === 'reactions' ? REACTIONS : GESTURES, key = mode === 'reactions' ? 'react' : 'gesture';
    const everyone = await loadCharacters(workspace), id = args[0] ?? Object.keys(everyone)[0];
    if (!id) throw new Error(`${mode} needs a character: node sketch.mjs ${mode} <id>`);
    if (!everyone[id]) throw new Error(`There is no characters/${id}.json`);
    const only = args.slice(1), names = Object.keys(table).filter((name) => !only.length || only.includes(name) || only.includes(table[name].group));
    if (!names.length) throw new Error(`Nothing in ${mode} is called ${only.join(', ')}. Groups: ${[...new Set(Object.values(table).map((item) => item.group))].join(', ')}`);
    const about = (name) => [table[name].group, table[name].size, `${table[name].seconds} s`].filter(Boolean).join(', ');
    for (const name of names) console.log(`${table[name].group.padEnd(9)} ${name.padEnd(18)} ${(table[name].size ?? '').padEnd(7)} ${table[name].seconds} s  ${table[name].note}`);
    // Each shot starts from the resting face, turned to a second person standing out of frame when there is
    // one, so a look to the camera shows as a turn and one entry's ending does not colour the next.
    const out = `${mode}-${id}`, lead = 0.6, other = Object.keys(everyone).find((name) => name !== id);
    const fresh = { who: id, at: 0, face: everyone[id].resting, ...(other ? { look: mode === 'reactions' ? other : 'camera' } : {}) };
    await build(workspace, { title: `Stock ${mode} on ${id}`, set: 'plain', cast: other && mode === 'reactions' ? [{ id, x: 480 }, { id: other, x: 1500 }] : [id], captions: false,
      shots: names.map((name) => ({ frame: 'medium', on: id, label: name, acting: [fresh, { who: id, at: lead, [key]: name }], hold: table[name].seconds + 1.2 })) }, out,
      { ...flags, voice: 'none', strips: { lead, length: (cut) => table[cut.label].seconds, text: (cut) => `${cut.label}  ·  ${about(cut.label)}  ·  ${table[cut.label].note}` } });
    // The catalogue as data, with where each entry sits in the reel, for a page that lists them.
    const folder = join(workspace, 'out', flags.draft ? out + '-draft' : out), plan = JSON.parse(await readFile(join(folder, 'plan.json'), 'utf8'));
    await writeFile(join(folder, `${mode}.json`), JSON.stringify(plan.cuts.map((cut) => ({ name: cut.label, group: table[cut.label].group, ...(table[cut.label].size ? { size: table[cut.label].size } : {}), seconds: table[cut.label].seconds,
      note: table[cut.label].note, reelStart: +(cut.from / FPS).toFixed(3), reelEnd: +(cut.to / FPS).toFixed(3) })), null, 2) + '\n');
    console.log(`catalogue:  ${join(folder, `${mode}.json`)}`);
  } else if (mode === 'sounds') {
    await soundPack(workspace, args);
  } else if (mode === 'credits') {
    const key = await findKey(workspace, KEY_NAMES.elevenlabs);
    if (!key) console.log(keyHelp('elevenlabs'));
    else { const b = await elevenlabsBalance(key); console.log(`ElevenLabs key from ${key.from}: ${b.left} of ${b.limit} credits left in this period${b.tier ? `, plan "${b.tier}"` : ''}. About ${dollars(1000)} per 1,000 credits at the Starter plan's rate. Only the key was sent.`); }
  } else if (mode === 'sound' && args.length) {
    await makeSound(workspace, flags, args);
  } else if (mode === 'export' && args[0]) {
    await exportSkill(args[0]);
  } else throw new Error('Usage: node sketch.mjs doctor | sheet [id ...] | say <id> "words" | render <sketch.json> | script <sketch.json> | voices | sounds [name ...] | starters [id ...] | options hair [id] | reactions [id] | gestures [id] | credits | sound "description" --seconds <n> --out <file> | export <folder>   (SKILL.md and references/sketch.md in the skill folder explain each)');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
}
