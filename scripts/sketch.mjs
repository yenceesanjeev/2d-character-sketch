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
//   node sketch.mjs voices                         list the free voices on this machine
//   node sketch.mjs export <folder>                copy this skill, complete, to another folder
//
// Options: --dir <workspace> (default: current folder)   --draft (half size, faster, written to out/<name>-draft)
//          --voice say|elevenlabs|none   --credits <max ElevenLabs credits for this run>
//          --face <expression> --pose <pose> --frame wide|medium|close --set <room>   (say only)
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS, W, H, bodies, createCast, createScene, expressions, hairStyles, poseOf, table } from './cutout-draw.mjs';
import { builtIn } from './cutout-sets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = '0.1.0';
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
const FRONTS = ['tee', 'shirt', 'open', 'hoodie'], GLASSES = ['rimless', 'thick', 'steel'], PROPS = ['phone', 'mug', 'pen'];

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
  for (const key of ['skinShade', 'topShade', 'innerShade', 'legsShade', 'shoeShade', 'strand', 'mark', 'temple'])
    if (spec[key] !== undefined && !HEX.test(spec[key])) bad(`${key} "${spec[key]}" must be a colour like #7d8449`);
  if (HEX.test(spec.hair)) spec.strand ??= tone(spec.hair, 1.5);
  spec.style ??= 'short';
  if (!hairStyles[spec.style]) bad(`style "${spec.style}" is not a hair style. Choose from: ${Object.keys(hairStyles).join(', ')}`);
  spec.front ??= 'tee';
  if (!FRONTS.includes(spec.front)) bad(`front "${spec.front}" must be one of: ${FRONTS.join(', ')}`);
  if (spec.glasses && !GLASSES.includes(spec.glasses)) bad(`glasses "${spec.glasses}" must be one of: ${GLASSES.join(', ')}`);
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
  const rest = spec.resting, names = Object.keys(expressions), poses = ['rest', ...Object.keys(bodies).filter((name) => !['lean', 'hang', 'type'].includes(name))];
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
    const x = 70 + i * 116;
    out += at(x, 1040, 0.5, kit.figure({ ...poseOf(name, true), standing: true, turn: 0.3, look: 'neutral', mouth: 'X' })) + label(x, 1210, name, 12.5);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1250" viewBox="0 0 1600 1250">${out}</svg>`;
}
// Everyone side by side, to check they read as different people.
function lineupSvg(specs, kits) {
  const ids = Object.keys(specs), width = Math.max(600, 120 + ids.length * 200);
  const figures = ids.map((id, i) => at(160 + i * 200, 250, 0.9, kits[id].standing(i % 2 ? -0.3 : 0.3, specs[id].resting, expressions[specs[id].resting].mouth)) + label(160 + i * 200, 540, `${specs[id].name} · ${id}`, 15, 700)).join('');
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
      // A sofa and a side table, below chin height.
      box(250, 300, 460, 120, '#a5b3a6', 26, ' stroke="#8b9a8c" stroke-width="1.8"') + box(232, 338, 496, 96, '#b3c0b3', 24, ' stroke="#8b9a8c" stroke-width="1.8"') +
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
      box(380, 330, 200, 12, '#b89a72', 3) + box(380, 352, 200, 12, '#b89a72', 3) + box(392, 364, 10, 40, '#8e7758') + box(558, 364, 10, 40, '#8e7758'),
    front: '',
  }),
};
Object.assign(builtIn, rooms);
// The name a sketch uses -> the name the drawing code knows, and whether people sit.
const SETS = { plain: ['plain', false], home: ['home', false], park: ['park', false], office: ['floor', false], table: ['meeting', true] };

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
const rhubarbPath = () => process.env.RHUBARB ?? (onPath('rhubarb') ? 'rhubarb' : null);
async function measure(wav) {
  const duration = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav])).toString());
  const rhubarb = rhubarbPath();
  if (rhubarb) {
    const data = JSON.parse((await run(rhubarb, ['-f', 'json', '--machineReadable', wav])).toString());
    return { duration, cues: data.mouthCues.map((cue) => [cue.start, cue.end, cue.value]), cuesFrom: 'rhubarb' };
  }
  return { duration, cues: await cuesFromLoudness(wav), cuesFrom: 'loudness' };
}

// Get a recording and mouth shapes for every line. Recordings are kept in voice/ under a name made from
// the words, the voice and the engine, so an unchanged line is never generated (or paid for) twice.
async function speak(workspace, lines, specs, engine, options) {
  const folder = join(workspace, 'voice'), installed = engine === 'say' ? await sayVoices() : [];
  const order = Object.keys(specs), receipt = { engine, generated: 0, reused: 0, credits: 0 };
  const voiceOf = (id) => {
    const saved = specs[id].voice?.[engine];
    if (engine === 'elevenlabs') {
      if (!saved) throw new Error(`characters/${id}.json needs "voice": { "elevenlabs": "<voice id>" } before ElevenLabs can speak for ${id}.`);
      return saved;
    }
    if (saved && !installed.some((voice) => voice.name === saved)) throw new Error(`"${saved}" is not a voice on this machine. Run "sketch.mjs voices" to list them.`);
    const usable = SAY_ORDER.filter((name) => installed.some((voice) => voice.name === name));
    return saved ?? usable[order.indexOf(id) % usable.length] ?? installed[0]?.name;
  };
  const jobs = [];
  for (const line of lines) {
    if (line.audio) {
      const source = resolve(workspace, line.audio);
      if (!existsSync(source)) throw new Error(`${line.id}: the recording ${line.audio} does not exist.`);
      jobs.push({ line, engine: 'file', voice: sha(await readFile(source)).slice(0, 12), source });
    } else if (engine !== 'none') jobs.push({ line, engine, voice: voiceOf(line.who) });
  }
  for (const job of jobs) job.stem = join(folder, sha([job.engine, job.voice, options.model, job.line.say].join('\n')).slice(0, 16));
  const missing = jobs.filter((job) => !existsSync(job.stem + '.json'));
  if (engine === 'elevenlabs') {
    const paid = missing.filter((job) => job.engine === 'elevenlabs'), need = paid.reduce((sum, job) => sum + job.line.say.length, 0);
    if (paid.length && !process.env.ELEVENLABS_API_KEY) throw new Error('Set ELEVENLABS_API_KEY in the environment to use ElevenLabs. Never write the key into a file.');
    if (paid.length && !(options.credits >= need))
      throw new Error(`${paid.length} line(s) need about ${need} ElevenLabs credits (one per character, an estimate). Ask the user, then pass --credits ${need} or more. Nothing was sent.`);
  }
  if (missing.length) await mkdir(folder, { recursive: true });
  for (const job of missing) {
    const wav = job.stem + '.wav', scratch = join(tmpdir(), `sketch-${process.pid}-${basename(job.stem)}`);
    let source = job.source, cost = null;
    if (job.engine === 'say') { source = scratch + '.aiff'; await run('say', ['-v', job.voice, '-o', source], job.line.say); }
    if (job.engine === 'elevenlabs') {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(job.voice)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(), 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.line.say, model_id: options.model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!response.ok) throw new Error(`ElevenLabs refused ${job.line.id} (${response.status}): ${(await response.text()).slice(0, 200)}. Lines already generated are kept.`);
      source = scratch + '.mp3'; cost = Number(response.headers.get('character-cost')) || job.line.say.length;
      await writeFile(source, Buffer.from(await response.arrayBuffer()));
    }
    await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-ac', '1', '-ar', '48000', wav]);
    if (source !== job.source) await rm(source, { force: true });
    await writeFile(job.stem + '.json', JSON.stringify({ engine: job.engine, voice: job.voice, text: job.line.say, credits: cost, ...(await measure(wav)) }, null, 2) + '\n');
    receipt.generated++; receipt.credits += cost ?? 0;
  }
  receipt.reused = jobs.length - missing.length;
  const voiced = {};
  for (const job of jobs) voiced[job.line.id] = { wav: job.stem + '.wav', ...JSON.parse(await readFile(job.stem + '.json', 'utf8')) };
  receipt.mouths = [...new Set(Object.values(voiced).map((item) => item.cuesFrom))];
  return { voiced, receipt };
}

// ---- From a sketch file to a frame plan -------------------------------------------------------------
const FRAMES = ['wide', 'group', 'medium', 'close'], FIG = 0.75, SEAT_Y = 267;
const DOES = ['nod', 'shake-head', 'eyeroll', 'lean-in', 'step-forward', 'half-rise', 'sit', 'eyes-closed', 'eyes-open'];
const LOOKS = ['camera', 'down', 'up'];

// Check the whole sketch and report every problem at once.
function check(sketch, specs) {
  const problems = [], bad = (text) => problems.push(text);
  const ids = (sketch.cast ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.id));
  if (!ids.length) bad('"cast" must list at least one character id, left to right');
  for (const id of ids) if (!specs[id]) bad(`cast: there is no characters/${id}.json`);
  if (new Set(ids).size !== ids.length) bad('cast: a character is listed twice');
  const custom = typeof sketch.set === 'string' && sketch.set.endsWith('.svg');
  if (!custom && !SETS[sketch.set ?? 'plain']) bad(`set "${sketch.set}" must be one of: ${Object.keys(SETS).join(', ')}, or the path of an .svg backdrop`);
  if (!Array.isArray(sketch.shots) || !sketch.shots.length) bad('"shots" must list at least one shot');
  const who = (id, where) => { if (!ids.includes(id)) bad(`${where}: "${id}" is not in the cast (${ids.join(', ')})`); };
  const acting = (item, where) => {
    if (item.face && !expressions[item.face]) bad(`${where}: face "${item.face}" is not an expression. Choose from: ${Object.keys(expressions).join(', ')}`);
    if (item.pose && item.pose !== 'rest' && !bodies[item.pose]) bad(`${where}: pose "${item.pose}" is not a pose. Choose from: rest, ${Object.keys(bodies).join(', ')}`);
    if (item.do && !DOES.includes(item.do)) bad(`${where}: do "${item.do}" must be one of: ${DOES.join(', ')}`);
    const look = item.look ?? item.to;
    if (look && !LOOKS.includes(look) && !ids.includes(look)) bad(`${where}: "${look}" must be a cast id or one of: ${LOOKS.join(', ')}`);
  };
  (sketch.shots ?? []).forEach((shot, s) => {
    const where = `shot ${s + 1}`;
    if (shot.frame && !FRAMES.includes(shot.frame)) bad(`${where}: frame "${shot.frame}" must be one of: ${FRAMES.join(', ')}`);
    for (const id of [shot.on ?? []].flat()) who(id, `${where} "on"`);
    if (!shot.lines?.length && !(shot.hold > 0)) bad(`${where}: a shot with no lines needs "hold" (seconds)`);
    (shot.lines ?? []).forEach((line, l) => {
      const here = `${where}, line ${l + 1}`;
      who(line.who, here);
      if (!line.say?.trim()) bad(`${here}: "say" is empty`);
      acting(line, here);
      for (const [id, face] of Object.entries(line.reactions ?? {})) { who(id, `${here} reactions`); acting({ face }, `${here} reactions`); }
    });
    (shot.acting ?? []).forEach((item, a) => { who(item.who, `${where}, acting ${a + 1}`); acting(item, `${where}, acting ${a + 1}`); });
  });
  if (problems.length) throw new Error(`The sketch has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  return { ids, custom };
}
// Every spoken line in order, with a stable id: s02-l01 is shot 2, line 1.
const linesOf = (sketch) => sketch.shots.flatMap((shot, s) => (shot.lines ?? []).map((line, l) => ({ ...line, id: `s${String(s + 1).padStart(2, '0')}-l${String(l + 1).padStart(2, '0')}` })));

function compile(sketch, specs, voiced) {
  const { ids, custom } = check(sketch, specs);
  const [set, seated] = custom ? ['backdrop', false] : SETS[sketch.set ?? 'plain'];
  // Where everyone stands or sits: spread left to right in cast order unless the sketch places them.
  const gap = seated ? Math.min(230, 700 / Math.max(1, ids.length - 1)) : null, marks = {};
  sketch.cast.forEach((entry, i) => {
    const given = typeof entry === 'string' ? {} : entry;
    const x = given.x ?? (seated ? 480 + (i - (ids.length - 1) / 2) * gap : (W * (i + 1)) / (ids.length + 1)), scale = given.scale ?? (seated ? 1 : 0.8);
    marks[ids[i]] = { x, y: given.y ?? 480 - 281 * scale, scale, mirror: given.mirror ?? x > W / 2 };
  });
  const size = (id) => marks[id].scale * (seated ? FIG : 1), headY = (id) => (seated ? SEAT_Y : marks[id].y) - 66 * size(id);
  // The part of the room a shot shows, as [left, top, width]. The drawing code nudges some framings, so
  // the last two lines undo that nudge and the picture lands where this says.
  const camera = (kind, on) => {
    let view;
    if (kind === 'close' || kind === 'medium') {
      const id = on[0], width = (kind === 'close' ? 470 : seated ? 600 : 560) * size(id), height = (width * H) / W;
      view = [marks[id].x - width / 2, headY(id) - (kind === 'close' ? 0.54 : 0.36) * height, width];
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
  const cuts = [], lines = [], warnings = [], face = {}, looking = {};
  for (const id of ids) face[id] = specs[id].resting;
  let clock = 0, last = null;
  sketch.shots.forEach((shot, s) => {
    const cutId = `s${String(s + 1).padStart(2, '0')}`, from = Math.round(clock * FPS), start = from / FPS, beats = [];
    const beat = (id, time, action, arg) => beats.push({ id, at: Math.max(0, time - start), action, arg });
    const act = (item, time) => {
      if (item.face) { beat(item.who, time, 'face', item.face); face[item.who] = item.face; }
      if (item.pose) beat(item.who, time, 'pose', item.pose);
      if (item.look) { beat(item.who, time, 'look', item.look); looking[item.who] = item.look; }
      if (item.do) beat(item.who, time, item.do);
    };
    // A new shot starts from where the last one left everyone: same face, looking the same way.
    for (const id of ids) { beat(id, start, 'face', face[id]); if (looking[id]) beat(id, start, 'look', looking[id]); }
    clock = start + (s === 0 ? 0.5 : 0.25);
    const speakers = [];
    (shot.lines ?? []).forEach((line, l) => {
      const id = `${cutId}-l${String(l + 1).padStart(2, '0')}`, voice = voiced[id], duration = voice?.duration ?? estimate(line.say);
      const startFrame = Math.round(clock * FPS), endFrame = startFrame + Math.max(1, Math.round(duration * FPS)), time = startFrame / FPS;
      lines.push({ id, character: line.who, text: line.say, startFrame, endFrame, cues: voice?.cues ?? cuesFromText(line.say, duration), wav: voice?.wav ?? null });
      // The speaker turns to whoever they are talking to; everyone else turns to the speaker.
      const others = ids.filter((other) => other !== line.who);
      const nearest = [...others].sort((a, b) => Math.abs(marks[a].x - marks[line.who].x) - Math.abs(marks[b].x - marks[line.who].x))[0];
      const target = line.look ?? line.to ?? (last && last !== line.who ? last : nearest);
      act({ who: line.who, face: line.face, pose: line.pose, look: target, do: line.do }, time);
      for (const other of others) if (looking[other] !== 'camera' || target === other) act({ who: other, look: line.who }, time);
      for (const [other, reaction] of Object.entries(line.reactions ?? {})) act({ who: other, face: reaction }, time + 0.3);
      clock = endFrame / FPS;
      if (line.pose) beat(line.who, clock + 0.15, 'pose', 'rest');
      clock += line.pause ?? 0.35;
      last = line.who; speakers.push(line.who);
    });
    for (const item of shot.acting ?? []) act(item, start + (item.at ?? 0));
    clock += shot.hold ?? (shot.lines?.length ? 0.4 : 0);
    const to = Math.round(clock * FPS), kind = shot.frame ?? 'wide';
    const on = [shot.on ?? (kind === 'group' ? [...new Set(speakers)] : speakers[0] ?? shot.acting?.[0]?.who ?? ids[0])].flat();
    if (kind === 'group' && on.length < 2 && ids.length > 1) warnings.push(`${cutId}: a group frame with one person in it is framed like a medium shot. Name two or more in "on".`);
    cuts.push({ id: cutId, shot: cutId, from, to, set, staging: kind.toUpperCase(), cast: marks, camera: camera(kind === 'group' && on.length < 2 ? 'medium' : kind, on.length ? on : ids),
      backdrop: custom ? 'backdrop' : null, beats: beats.sort((a, b) => a.at - b.at), punches: [], move: shot.zoom ? { type: 'zoom', scale: shot.zoom } : null,
      angle: shot.end === 'fade' ? 'ending' : undefined, frame: kind, on });
    clock = to / FPS;
  });
  return { format: 'character-sketch-plan/1', title: sketch.title ?? '', fps: FPS, frames: cuts.at(-1).to, cast: ids.map((id) => ({ id, name: specs[id].name })), cuts, lines, warnings,
    cutout: { cast: Object.fromEntries(ids.map((id) => [id, specs[id]])) } };
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
function caption(plan, clock, specs) {
  const line = plan.lines.find((item) => clock >= item.startFrame && clock < item.endFrame + 6);
  if (!line) return '';
  const words = `${specs[line.character].name}: ${line.text}`.split(' '), rows = [''];
  for (const word of words) { if ((rows.at(-1) + ' ' + word).length > 62 && rows.length < 2) rows.push(word); else rows[rows.length - 1] = (rows.at(-1) + ' ' + word).trim(); }
  const top = H - 28 - rows.length * 28;
  return `<rect x="0" y="${top}" width="${W}" height="${H - top}" fill="#1d2420" opacity=".62"/>` +
    rows.map((row, i) => `<text x="${W / 2}" y="${top + 31 + i * 28}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#ffffff" text-anchor="middle">${esc(row)}</text>`).join('');
}

async function build(workspace, sketch, name, options) {
  const specs = await loadCharacters(workspace);
  const { custom } = check(sketch, specs);
  const engine = options.voice ?? sketch.voice ?? (process.platform === 'darwin' && onPath('say') ? 'say' : 'none');
  if (!['say', 'elevenlabs', 'none'].includes(engine)) throw new Error('voice must be say, elevenlabs or none');
  if (engine === 'say' && !(process.platform === 'darwin' && onPath('say'))) throw new Error('The "say" voice only exists on a Mac. Use --voice none, --voice elevenlabs, or give lines an "audio" file.');
  const model = sketch.elevenlabsModel ?? 'eleven_v4';
  const { voiced, receipt } = await speak(workspace, linesOf(sketch), specs, engine, { credits: options.credits, model });
  const plan = compile(sketch, specs, voiced);
  const out = join(workspace, 'out', options.draft ? name + '-draft' : name), size = options.draft ? [W, H] : [W * 2, H * 2];
  await mkdir(out, { recursive: true });
  const backdrop = custom ? 'data:image/svg+xml;base64,' + (await readFile(resolve(workspace, sketch.set))).toString('base64') : null;
  const scene = createScene({ timeline: plan, kits: createCast(plan.cutout.cast), asset: () => backdrop });
  const captions = sketch.captions ?? 'auto', silent = new Set(plan.lines.filter((line) => !line.wav).map((line) => line.id));
  const shown = captions === true ? plan : captions === false ? { lines: [] } : { lines: plan.lines.filter((line) => silent.has(line.id)) };
  const inner = (clock) => scene.frame(clock) + caption(shown, clock, specs);
  const frame = (clock) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="0 0 ${W} ${H}">${inner(clock)}</svg>`;

  // The contact sheet first: one picture per line (mid-line) and one per silent shot. Look at it before the video.
  const picks = plan.cuts.flatMap((cut) => {
    const own = plan.lines.filter((line) => line.startFrame >= cut.from && line.startFrame < cut.to);
    return own.length ? own.map((line) => ({ clock: spokenFrame(line), text: `${cut.id} ${cut.frame} · ${line.character}: ${line.text}` }))
      : [{ clock: Math.round((cut.from + cut.to) / 2), text: `${cut.id} ${cut.frame} · silent` }];
  });
  const shownPicks = picks.length > 24 ? picks.filter((_, i) => i % Math.ceil(picks.length / 24) === 0) : picks;
  const columns = Math.min(3, shownPicks.length), rows = Math.ceil(shownPicks.length / columns);
  const tiles = shownPicks.map((pick, i) => {
    const x = 16 + (i % columns) * 496, y = 16 + Math.floor(i / columns) * 312;
    return `<svg x="${x}" y="${y}" width="480" height="270" viewBox="0 0 ${W} ${H}">${inner(pick.clock)}</svg>` +
      label(x, y + 290, clip(`${(pick.clock / FPS).toFixed(1)}s  ${pick.text}`, 76), 13, 400, 'start');
  }).join('');
  const sheetSize = [16 + columns * 496, 16 + rows * 312];
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

  const spoken = plan.lines.filter((line) => line.wav);
  if (spoken.length) {
    const filters = spoken.map((line, i) => `[${i + 1}:a]aresample=48000,atrim=duration=${(line.endFrame - line.startFrame) / FPS},asetpts=PTS-STARTPTS,adelay=${line.startFrame * 2000}S:all=1[a${i}]`);
    filters.push(spoken.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${spoken.length}:normalize=0,apad=whole_dur=${duration},atrim=duration=${duration}[audio]`);
    await run('ffmpeg', ['-v', 'error', '-y', '-i', picture, ...spoken.flatMap((line) => ['-i', line.wav]), '-filter_complex', filters.join(';'),
      '-map', '0:v:0', '-map', '[audio]', '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', output]);
    await rm(picture);
  } else {
    await rm(output, { force: true });
    await cp(picture, output);
    await rm(picture);
  }
  const streams = JSON.parse((await run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate,nb_read_frames,duration', '-of', 'json', output])).toString()).streams;
  const video = streams.find((stream) => stream.codec_type === 'video'), audio = streams.find((stream) => stream.codec_type === 'audio');
  if (!video || Number(video.nb_read_frames) !== plan.frames || video.width !== size[0] || Boolean(audio) !== Boolean(spoken.length))
    throw new Error('The video does not match the plan (frame count, size or sound). Do not show it; render again.');
  if (silent.size && engine !== 'none') plan.warnings.push(`${silent.size} line(s) have no recording and play silent with captions.`);
  if (receipt.mouths?.includes('loudness')) plan.warnings.push('Mouth shapes follow loudness only. Install Rhubarb Lip Sync (or set RHUBARB to its path) for shapes that match the sounds.');
  // The saved plan names recordings relative to the workspace, so it can be shared without this machine's folders in it.
  await writeFile(join(out, 'plan.json'), JSON.stringify({ ...plan, lines: plan.lines.map((line) => ({ ...line, wav: line.wav && relative(workspace, line.wav) })) }, null, 2) + '\n');
  await writeFile(join(out, 'run.json'), JSON.stringify({ sketchSha256: sha(JSON.stringify(sketch)), toolSha256: sha(await readFile(fileURLToPath(import.meta.url))),
    frames: plan.frames, duration, size, cuts: plan.cuts.length, lines: plan.lines.length, voicedLines: spoken.length, voice: receipt, warnings: plan.warnings, streams }, null, 2) + '\n');
  console.log(`${plan.cuts.length} shot(s), ${plan.lines.length} line(s), ${duration.toFixed(1)} s, voice: ${engine}` +
    (engine === 'none' ? '' : ` (${receipt.generated} new, ${receipt.reused} reused${receipt.credits ? `, ${receipt.credits} credits` : ''})`));
  for (const warning of plan.warnings) console.log(`warning: ${warning}`);
  console.log(`look first: ${join(out, 'contact-sheet.png')}`);
  console.log(`video:      ${output}`);
}

// ---- Commands -----------------------------------------------------------------------------------------
async function doctor() {
  let ok = true;
  const [major] = process.versions.node.split('.').map(Number);
  const row = (good, name, note) => { console.log(`${good ? 'ok     ' : 'MISSING'}  ${name}${note ? '  ' + note : ''}`); };
  row(major >= 20, `node ${process.versions.node}`, major >= 20 ? '' : 'Node 20 or newer is needed.');
  ok &&= major >= 20;
  for (const tool of ['rsvg-convert', 'ffmpeg', 'ffprobe']) { const found = onPath(tool); row(found, tool, found ? '' : INSTALL[tool]); ok &&= found; }
  const voices = await sayVoices();
  console.log(`${voices.length ? 'ok     ' : 'no     '}  free voice (macOS say)${voices.length ? '' : '  Sketches render silent with captions, or use ElevenLabs or your own recordings.'}`);
  console.log(`${process.env.ELEVENLABS_API_KEY ? 'ok     ' : 'no     '}  ELEVENLABS_API_KEY${process.env.ELEVENLABS_API_KEY ? '  Paid; used only with --voice elevenlabs and --credits.' : '  Optional, paid.'}`);
  console.log(`${rhubarbPath() ? 'ok     ' : 'no     '}  Rhubarb Lip Sync${rhubarbPath() ? '' : '  Optional. Without it mouths follow loudness instead of the sounds spoken.'}`);
  if (!ok) throw new Error('Install what is marked MISSING, then run doctor again.');
}

function parse(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) rest.push(argv[i]);
    else if (argv[i] === '--draft') flags.draft = true;
    else flags[argv[i].slice(2)] = argv[++i];
  }
  if (flags.credits !== undefined) flags.credits = Number(flags.credits);
  return { flags, rest };
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

export { character, check, compile };

// Everything below runs only when this file is the program being run, not when a test imports it.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
const { flags, rest: [mode, ...args] } = parse(process.argv.slice(2));
const workspace = resolve(flags.dir ?? '.');
try {
  if (mode === 'doctor') await doctor();
  else if (mode === 'sheet') await sheets(workspace, args);
  else if (mode === 'voices') {
    const voices = await sayVoices();
    console.log(voices.length ? voices.filter((voice) => voice.locale.startsWith('en')).map((voice) => `${voice.name}  (${voice.locale})`).join('\n') + `\n${voices.length} voices in all languages; these are the English ones.` : 'No free voices here: the "say" voice needs a Mac.');
  } else if (mode === 'say' && args.length >= 2) {
    const [id, ...words] = args;
    await build(workspace, { title: `${id} says`, set: flags.set ?? 'plain', cast: [id], captions: 'auto',
      shots: [{ frame: flags.frame ?? 'medium', hold: 0.6, lines: [{ who: id, say: words.join(' '), face: flags.face, pose: flags.pose, look: 'camera' }] }] }, `say-${id}-${words.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 4).join('-') || 'line'}`, flags);
  } else if (mode === 'render' && args[0]) {
    const file = resolve(workspace, args[0]);
    await build(workspace, JSON.parse(await readFile(file, 'utf8')), basename(file, '.json'), flags);
  } else if (mode === 'export' && args[0]) {
    await exportSkill(args[0]);
  } else throw new Error('Usage: node sketch.mjs doctor | sheet [id ...] | say <id> "words" | render <sketch.json> | voices | export <folder>   (see the top of this file for options)');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
}
