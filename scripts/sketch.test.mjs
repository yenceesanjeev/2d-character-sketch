// Guards the two things the skill depends on in the shared drawing code: that a sketch compiles to a
// plan the drawing code accepts, and that each framing lands where the compiler means it to. The
// compiler undoes two adjustments cutout-draw.mjs makes to a camera; if those change, these fail.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bodies, createCast, createScene, hairStyles, poseOf, props } from './cutout-draw.mjs';
import { CAPTION_STYLES, captionSetting, captionSvg } from './captions.mjs';
import { GESTURES, MOMENTS, REACTIONS, character, check, compile, lipSync, readable, speak, suspect } from './sketch.mjs';

const specs = Object.fromEntries(['ann', 'ben'].map((id) => [id, character({ id }, `${id}.json`)]));
const line = { who: 'ann', say: 'One two three four.' };
// The part of the room the first frame of a one-shot sketch shows, read back from the drawn frame.
function shown(set, frame) {
  const plan = compile({ set, cast: ['ann', 'ben'], shots: [{ frame, on: 'ann', lines: [line] }] }, specs, {});
  const svg = createScene({ timeline: plan, kits: createCast(plan.cutout.cast) }).frame(0);
  const [, scale, x, y] = svg.match(/<g transform="scale\(([\d.e+-]+)\) translate\(([\d.e+-]+) ([\d.e+-]+)\)">/);
  return { left: -x, top: -y, width: 960 / scale };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} is not ${expected}`);

test('standing framings land where the compiler puts them', () => {
  // Ann stands at x 320 at scale 0.8; her head centre is 66 units above her mark, scaled.
  const head = 480 - 281 * 0.8 - 66 * 0.8;
  const wide = shown('plain', 'wide'), close = shown('plain', 'close'), medium = shown('plain', 'medium');
  near(wide.left, 0); near(wide.top, 0); near(wide.width, 960);
  near(close.width, 376); near(close.left, 320 - 188); near(close.top, head - 0.54 * 376 * 0.5625);
  near(medium.width, 448); near(medium.left, 320 - 224); near(medium.top, head - 0.36 * 448 * 0.5625);
});

test('seated framings land where the compiler puts them', () => {
  // Two people at the table sit 230 apart around the middle, drawn at three quarters size.
  const close = shown('table', 'close');
  near(close.width, 470 * 0.75); near(close.left, 365 - (470 * 0.75) / 2); near(close.top, 267 - 66 * 0.75 - 0.54 * 470 * 0.75 * 0.5625);
});

test('the plan covers the clock and keeps each line inside its shot', () => {
  const plan = compile({ cast: ['ann', 'ben'], shots: [
    { lines: [line, { who: 'ben', say: 'No.', face: 'smug', pose: 'shrug' }] },
    { frame: 'close', on: 'ben', hold: 1, acting: [{ who: 'ben', at: 0.2, face: 'wink' }] },
    { frame: 'group', on: ['ann', 'ben'], end: 'fade', lines: [{ who: 'ann', say: 'Fine.', do: 'nod' }] },
  ] }, specs, {});
  assert.equal(plan.cuts[0].from, 0);
  plan.cuts.forEach((cut, i) => { if (i) assert.equal(cut.from, plan.cuts[i - 1].to); });
  assert.equal(plan.frames, plan.cuts.at(-1).to);
  assert.deepEqual(plan.lines.map((item) => item.id), ['s01-l01', 's01-l02', 's03-l01']);
  for (const item of plan.lines) {
    const cut = plan.cuts.find((entry) => entry.id === item.id.slice(0, 3));
    assert.ok(item.startFrame >= cut.from && item.endFrame <= cut.to, `${item.id} leaves its shot`);
    assert.ok(item.cues.length > 0);
  }
  const scene = createScene({ timeline: plan, kits: createCast(plan.cutout.cast) });
  for (const clock of [0, Math.floor(plan.frames / 2), plan.frames - 1]) assert.match(scene.frame(clock), /^<rect/);
});

test('a bad sketch or character is refused with every problem listed', () => {
  assert.throws(() => check({ set: 'moon', cast: ['ann', 'zed'], shots: [{ frame: 'tight', lines: [{ who: 'ann', say: 'hi', face: 'glad' }] }, {}] }, specs),
    (error) => ['zed', 'moon', 'tight', 'glad', 'hold'].every((word) => error.message.includes(word)));
  assert.throws(() => character({ id: 'Bad One', style: 'mohawk', skin: 'red' }, 'bad.json'), /mohawk[\s\S]*|lowercase/);
});

test('captions show the words being said, in each style, and a bad setting is refused', () => {
  const lines = [{ character: 'ann', text: 'One two three. Four five six seven eight nine ten eleven twelve.', startFrame: 10, endFrame: 110 }];
  const names = { ann: 'Ann' }, draw = (value, clock) => captionSvg({ lines, clock, names, setting: captionSetting(value) });
  for (const style of Object.keys(CAPTION_STYLES)) assert.match(draw(style, 20), /<text/, style);
  assert.equal(draw('bar', 5), '', 'nothing before the line');
  assert.equal(draw('bar', 130), '', 'nothing once it has finished');
  assert.match(draw('bar', 20), /Ann:/);
  assert.doesNotMatch(draw({ style: 'bar', names: false }, 20), /Ann:/);
  // Pop shows a few words at a time, never two sentences together, and lights exactly one word.
  const early = draw('pop', 12), late = draw('pop', 105);
  assert.match(early, /ONE/); assert.doesNotMatch(early, /FOUR|TWELVE/);
  assert.match(late, /TWELVE/); assert.doesNotMatch(late, /ONE/);
  assert.equal(early.match(/#ffd84a/g).length, 1);
  // Top and bottom land in different halves of the 540-high frame.
  const y = (svg) => Number(svg.match(/<text x="480" y="([\d.]+)"/)[1]);
  assert.ok(y(draw({ style: 'box', position: 'top' }, 20)) < 150 && y(draw('box', 20)) > 400);
  assert.deepEqual([captionSetting(undefined).show, captionSetting(true).show, captionSetting(false).show, captionSetting('pop').show], ['auto', 'always', 'never', 'always']);
  assert.throws(() => captionSetting('neon'), /bar, box, outline, pop/);
  assert.throws(() => check({ cast: ['ann'], captions: { style: 'bar', position: 'left' }, pace: 'frantic', shots: [{ lines: [line] }] }, specs),
    (error) => ['position', 'frantic'].every((word) => error.message.includes(word)));
});

test('pace sets the gaps a sketch does not spell out', () => {
  const length = (pace) => compile({ cast: ['ann', 'ben'], pace, shots: [{ lines: [line, { who: 'ben', say: 'No.' }] }] }, specs, {}).frames;
  assert.ok(length('quick') < length(undefined) && length(undefined) < length('slow'));
  assert.equal(length('normal'), length(undefined));
  const fixed = (pace) => compile({ cast: ['ann'], pace, shots: [{ hold: 1, lines: [{ ...line, pause: 0.5 }] }] }, specs, {}).frames;
  assert.equal(fixed('quick'), fixed('slow'), 'a pause and hold that are written down are kept as written');
});

test('several scenes share one clock, each with its own room, and sounds land on their lines', () => {
  const sketch = { music: { file: 'sfx/theme.mp3', volume: 0.2 }, scenes: [
    { set: 'table', cast: ['ann', 'ben'], laptops: ['ann'], shots: [{ sound: { file: 'sfx/typing.wav', at: 0.2 }, lines: [{ ...line, face: 'smug' }] }] },
    { set: 'home', cast: ['ben'], shots: [{ lines: [{ who: 'ben', say: '[dry] No.', sound: 'sfx/laugh.wav', voice: 'say' }] }, { frame: 'close', hold: 1 }] },
  ] };
  const plan = compile(sketch, specs, {});
  assert.deepEqual(plan.cuts.map((cut) => [cut.id, cut.scene, cut.set]), [['s01', 0, 'meeting'], ['s02', 1, 'home'], ['s03', 1, 'home']]);
  plan.cuts.forEach((cut, i) => { if (i) assert.equal(cut.from, plan.cuts[i - 1].to); });
  assert.deepEqual(plan.lines.map((item) => item.id), ['s01-l01', 's02-l01']);
  assert.deepEqual(Object.keys(plan.cuts[1].cast), ['ben'], 'the second scene has only its own cast');
  assert.equal(plan.cuts[1].beats.find((beat) => beat.id === 'ben' && beat.action === 'face').arg, specs.ben.resting, 'a new scene starts from the resting face');
  const [typing, laugh] = plan.sounds;
  near(typing.at, 0.2);
  near(laugh.at, plan.lines[1].endFrame / plan.fps + 0.1);
  assert.deepEqual(plan.music, { file: 'sfx/theme.mp3', volume: 0.2 });
  // A delivery cue is not spoken, so it does not lengthen the line.
  assert.equal(plan.lines[1].endFrame - plan.lines[1].startFrame, compile({ cast: ['ben'], shots: [{ lines: [{ who: 'ben', say: 'No.' }] }] }, specs, {}).lines[0].endFrame - Math.round(0.5 * plan.fps));
  const scene = createScene({ timeline: plan, kits: createCast(plan.cutout.cast) });
  for (const clock of [0, plan.cuts[1].from, plan.frames - 1]) assert.match(scene.frame(clock), /^<rect/);
});

test('a bad scene, sound or line voice is refused', () => {
  assert.throws(() => check({ set: 'home', scenes: [{ set: 'park', cast: ['ann'], laptops: ['ann'], shots: [{ sound: { file: 'a.wav', at: -1 }, lines: [{ ...line, voice: 'elevenlabs', sound: { when: 'before' } }] }] }] }, specs),
    (error) => ['belongs inside each scene', 'scene 1: "laptops"', '"at"', 'free ones', '"file"', '"when"'].every((word) => error.message.includes(word)));
});

test('the readable script lists scenes, sounds and what a paid voice would be sent', async () => {
  const text = await readable('/nonexistent', { scenes: [{ set: 'home', cast: ['zed'], shots: [{ lines: [{ who: 'zed', say: '[dry] No way.', sound: 'sfx/laugh.wav' }] }] }, { cast: ['zed'], shots: [{ hold: 1 }] }] });
  for (const part of ['2 scenes', 'SCENE 1', 'SCENE 2', 'sfx/laugh.wav after the line', '13 characters', '2 words']) assert.ok(text.includes(part), `${part} is missing from:\n${text}`);
});

test('a recording that runs far longer than its words is flagged for listening', () => {
  // Measured on 2026-11-12: the good take of this line was 1.84 s; the two takes that said it twice were 3.28 and 3.60 s.
  const words = "[flat, not looking up] So, what's the big deal?";
  assert.deepEqual(suspect(words, 1.84, [[0, 0.2, 'X'], [0.2, 1.7, 'C'], [1.7, 1.84, 'X']]), []);
  assert.match(suspect(words, 3.28, []).join(), /per word/);
  assert.match(suspect(words, 3.6, [[0, 1.3, 'C'], [1.3, 2.0, 'X'], [2.0, 2.4, 'C'], [2.4, 3.0, 'X'], [3.0, 3.6, 'C']]).join(), /per word.*2 long silence/);
  assert.deepEqual(suspect('Say more.', 1.44, []), [], 'a short line said slowly is not flagged');
  assert.match(suspect('Say more.', 2.9, []).join(), /2 word/);
  assert.deepEqual(suspect('Alright… you have my attention. Even the voice?', 3.4, [[0, 0.6, 'C'], [0.6, 1.2, 'X'], [1.2, 3.4, 'C']]), [], 'a pause the words ask for is not flagged');
});

test('a stock reaction plays once, puts the face back, and the shot waits for it', () => {
  const beats = (plan, id) => plan.cuts[0].beats.filter((beat) => beat.id === id && beat.action === 'face').map((beat) => beat.arg);
  // In a silent shot with no hold, the shot lasts as long as the reaction.
  const silent = compile({ cast: ['ann'], shots: [{ frame: 'close', acting: [{ who: 'ann', at: 0.4, react: 'one-wink' }] }] }, specs, {});
  assert.deepEqual(beats(silent, 'ann'), [specs.ann.resting, 'serene', 'wink', 'serene', specs.ann.resting]);
  assert.ok(silent.frames / silent.fps >= 0.4 + REACTIONS['one-wink'].seconds);
  const wink = silent.cuts[0].beats.filter((beat) => beat.id === 'ann' && beat.action === 'face');
  assert.ok(wink[3].at - wink[2].at < 0.5, 'the wink is brief');
  // A wink held as a line's face is a known fault, so it is warned about.
  assert.match(compile({ cast: ['ann'], shots: [{ lines: [{ ...line, face: 'wink' }] }] }, specs, {}).warnings.join(), /one-wink/);
  // A listener reacts while the other person speaks, and ends on the face they had.
  const heard = compile({ cast: ['ann', 'ben'], shots: [{ lines: [{ ...line, reactions: { ben: 'eye-roll' } }] }] }, specs, {});
  assert.deepEqual(beats(heard, 'ben'), [specs.ben.resting, 'bored', 'eyeroll', 'bored', specs.ben.resting]);
  // On a line it is the speaker's, after the words, and the pause grows to hold it.
  const plain = compile({ cast: ['ann'], shots: [{ lines: [line] }] }, specs, {}), after = compile({ cast: ['ann'], shots: [{ lines: [{ ...line, react: 'small-nod' }] }] }, specs, {});
  assert.ok(after.frames > plain.frames);
  for (const [name, item] of Object.entries(REACTIONS)) assert.ok(item.steps.every(([at]) => at < item.seconds), name);
  assert.throws(() => check({ cast: ['ann'], shots: [{ acting: [{ who: 'ann', react: 'faint' }] }] }, specs), /stock reaction[\s\S]*one-wink/);
});

test('every stock reaction is described, uses known faces and poses, and fits its length', () => {
  const sketch = (name) => ({ cast: ['ann', 'ben'], shots: [{ frame: 'medium', on: 'ann', acting: [{ who: 'ann', at: 0.2, react: name }] }] });
  assert.ok(Object.keys(REACTIONS).length >= 30);
  for (const [name, item] of Object.entries(REACTIONS)) {
    assert.match(name, /^[a-z]+(-[a-z]+)*$/, name);
    assert.ok(item.note && item.group && ['mild', 'medium'].includes(item.size), name);
    const plan = compile(sketch(name), specs, {});   // check() inside refuses an unknown face, pose or action
    assert.ok(plan.frames / plan.fps >= 0.2 + item.seconds, `${name} is cut short`);
    assert.equal(plan.cuts[0].beats.filter((beat) => beat.id === 'ann' && beat.action === 'pose').at(-1)?.arg ?? 'rest', 'rest', `${name} leaves a pose up`);
    const eyes = plan.cuts[0].beats.filter((beat) => beat.id === 'ann' && beat.action.startsWith('eyes-')).at(-1)?.action ?? 'eyes-open';
    assert.equal(eyes, 'eyes-open', `${name} leaves the eyes shut`);
  }
});

test('lip sync is measured: a resting mouth on loud frames and an open mouth in silence are flagged', () => {
  const loud = Array(24).fill(0.8), silence = Array(24).fill(0);
  assert.deepEqual(lipSync([...loud, ...silence], [[0, 1, 'C'], [1, 2, 'X']]).why, []);
  assert.match(lipSync([...loud, ...silence], [[0, 0.4, 'C'], [0.4, 2, 'X']]).why.join(), /at rest for 5\d% of the loud part, 0\.5\d? s/);
  assert.match(lipSync([...loud, ...silence], [[0, 2, 'D']]).why.join(), /open for 100% of the silence/);
  // The same shapes slid half a second late: the voice starts on a shut mouth.
  assert.match(lipSync([...loud, ...silence], [[0, 0.5, 'X'], [0.5, 1.5, 'C'], [1.5, 2, 'X']]).why.join(), /at rest/);
});

test('a busy person keeps their pose and eyes down through the scene until given a look', () => {
  const plan = compile({ scenes: [{ cast: ['ann', 'ben'], busy: { ben: 'phone' }, shots: [
    { lines: [line, { who: 'ben', say: 'Mm.', pose: 'shrug' }] },
    { frame: 'medium', on: 'ben', acting: [{ who: 'ben', at: 0.3, react: 'glance-at-camera' }] },
  ] }] }, specs, {});
  const of = (cut, action) => plan.cuts[cut].beats.filter((beat) => beat.id === 'ben' && beat.action === action).map((beat) => beat.arg);
  assert.ok(of(0, 'look').every((look) => look === 'down'), 'he does not turn to Ann when she speaks, nor when he answers');
  assert.deepEqual(of(0, 'pose'), ['phone', 'shrug', 'phone'], 'after a gesture the phone comes back up');
  assert.deepEqual(of(1, 'pose'), ['phone']);
  assert.deepEqual(of(1, 'look'), ['down', 'camera', 'down'], 'a reaction returns him to the phone');
  assert.equal(plan.cuts[1].played, 'glance-at-camera');
  assert.ok(plan.cuts[1].peak > plan.cuts[1].from && plan.cuts[1].peak < plan.cuts[1].to);
  assert.throws(() => check({ cast: ['ann'], busy: { zed: 'juggle' }, shots: [{ hold: 1 }] }, specs), (error) => ['zed', 'juggle'].every((word) => error.message.includes(word)));
});

test('people sit on the sofa or bench, and a single never cuts the neighbour\'s face', () => {
  const scene = (set, frame) => compile({ set, cast: [{ id: 'ann', sit: true }, { id: 'ben', sit: true }], shots: [{ frame, on: 'ann', lines: [line] }] }, specs, {});
  const plan = scene('home', 'wide'), { ann, ben } = plan.cuts[0].cast;
  assert.ok(ann.sit && ben.sit);
  assert.equal(ben.x - ann.x, 230); assert.equal((ann.x + ben.x) / 2, 480);
  near(ann.y, 480 - 281 * 0.8 + 32 * 0.8);   // a sitter's feet are 32 units nearer the head, so the figure sits lower by that much
  assert.match(createScene({ timeline: plan, kits: createCast(plan.cutout.cast) }).frame(0), /^<rect/);
  // In a close or medium on Ann, Ben's head (60 units either side of him at this size) is wholly outside the frame or wholly inside it.
  for (const frame of ['close', 'medium']) for (const set of ['home', 'park']) {
    const made = scene(set, frame), [left, , width] = made.cuts[0].camera, other = made.cuts[0].cast.ben, shown = [left - width * 0.07, left - width * 0.07 + width * 1.14];   // the drawing code eases a single out by this much
    const head = [other.x - 48, other.x + 48], out = head[0] >= shown[1] || head[1] <= shown[0], inside = head[0] >= shown[0] && head[1] <= shown[1];
    assert.ok(out || inside, `${set} ${frame}: Ben's head ${head} is cut by the frame ${shown}`);
    assert.deepEqual(made.warnings, []);
  }
  assert.throws(() => check({ set: 'office', cast: [{ id: 'ann', sit: true }], shots: [{ hold: 1 }] }, specs), /nothing to sit on/);
  assert.throws(() => check({ set: 'park', cast: ['ann', 'ben', 'cat'].map((id) => ({ id, sit: true })), shots: [{ hold: 1 }] }, { ...specs, cat: specs.ann }), /seats 2/);
});

test('a paid reply is kept when its conversion fails, and the next run uses it instead of paying again', async (t) => {
  const { chmod, mkdtemp, readdir, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspace = await mkdtemp(join(tmpdir(), 'sketch-held-'));
  const bin = await mkdtemp(join(tmpdir(), 'sketch-bin-'));
  const saved = { fetch: globalThis.fetch, path: process.env.PATH, key: process.env.SARVAM_API_KEY };
  t.after(async () => {
    Object.assign(globalThis, { fetch: saved.fetch });
    process.env.PATH = saved.path;
    if (saved.key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = saved.key;
    await rm(workspace, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  });
  // A fifth of a second of silence as a 48 kHz, 16-bit mono WAV: what Sarvam sends back.
  const samples = 9600, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push(JSON.parse(options.body).text);
    return { ok: true, status: 200, json: async () => ({ audios: [wav.toString('base64')] }) };
  };
  process.env.SARVAM_API_KEY = 'test-key';
  const lines = [{ id: 's01-l01', who: 'ann', say: 'Hello there' }];
  const specs = { ann: { voice: { sarvam: 'anushka' } } };
  const options = { model: 'bulbul:v4-flash en-IN', maxChars: 100 };

  // First run: the reply arrives, then the conversion fails.
  await writeFile(join(bin, 'ffmpeg'), '#!/bin/sh\necho stopped >&2\nexit 1\n');
  await chmod(join(bin, 'ffmpeg'), 0o755);
  process.env.PATH = `${bin}:${saved.path}`;
  await assert.rejects(speak(workspace, lines, specs, 'sarvam', options), /ffmpeg failed/);
  assert.deepEqual(sent, ['Hello there']);
  assert.equal((await readdir(join(workspace, 'voice/received'))).length, 2, 'the reply and its note are held');

  // Second run: nothing is sent, even with no limit given, and the held reply becomes the take.
  process.env.PATH = saved.path;
  const { receipt: second, voiced } = await speak(workspace, lines, specs, 'sarvam', { ...options, maxChars: undefined });
  assert.deepEqual(sent, ['Hello there'], 'the line was not paid for twice');
  assert.deepEqual([second.generated, second.recovered, second.characters], [1, 1, 0]);
  assert.equal(voiced['s01-l01'].characters, 'Hello there'.length, 'the take still records what it cost');
  assert.deepEqual(await readdir(join(workspace, 'voice/received')), [], 'the held reply is cleared once saved');
  const { receipt: third } = await speak(workspace, lines, specs, 'sarvam', options);
  assert.deepEqual([third.generated, third.reused, sent.length], [0, 1, 1]);
});

test('every hair style draws from the front, three-quarter, side and behind', () => {
  assert.ok(Object.keys(hairStyles).length >= 20);
  for (const style of Object.keys(hairStyles)) {
    const kit = createCast({ one: character({ id: 'one', style }, 'one.json') }).one;
    for (const turn of [0, 0.55, 1, -1]) { const art = kit.head({ turn }); assert.ok(art.startsWith('<g') && !/NaN|undefined/.test(art), `${style} at turn ${turn}`); }
    assert.ok(!/NaN|undefined/.test(kit.behind()), `${style} from behind`);
  }
});

test('the starter cast is valid, and no two starters share a hair shape or a top colour', () => {
  const cast = JSON.parse(readFileSync(new URL('../starter-cast.json', import.meta.url), 'utf8'));
  assert.ok(cast.length >= 12);
  for (const item of cast) { const spec = character(item, `${item.id}.json`); assert.ok(spec.description && hairStyles[spec.style], item.id); assert.match(createCast({ one: spec }).one.standing(0.3), /^</); }
  for (const field of ['id', 'style', 'top', 'name']) assert.equal(new Set(cast.map((item) => item[field])).size, cast.length, `two starters share a ${field}`);
});

test('a gesture lands on its word, puts the arms back, and every stock gesture draws', () => {
  const poses = (plan, id) => plan.cuts[0].beats.filter((beat) => beat.id === id && beat.action === 'pose');
  const say = 'There are three problems. Cost, time, and Walt.';
  const plan = compile({ cast: ['ann', 'ben'], shots: [{ lines: [{ who: 'ann', say, gesture: { name: 'count-to-three', on: 'Cost' } }] }] }, specs, {});
  const made = poses(plan, 'ann'), spoken = plan.lines[0];
  assert.deepEqual(made.map((beat) => beat.arg), ['count1', 'count2', 'count3', 'rest']);
  const share = (made[0].at - spoken.startFrame / plan.fps) / ((spoken.endFrame - spoken.startFrame) / plan.fps);
  assert.ok(share > 0.4 && share < 0.62, `the count should start a little before "Cost", which is 55% of the way through; it started at ${share}`);
  for (const [name, item] of Object.entries(GESTURES)) {
    const one = compile({ cast: ['ann'], shots: [{ acting: [{ who: 'ann', at: 0.2, gesture: name }] }] }, specs, {});
    assert.equal(poses(one, 'ann').at(-1).arg, 'rest', `${name} leaves the arms up`);
    assert.ok(one.frames / one.fps >= 0.2 + item.seconds, `${name} is cut short`);
    const scene = createScene({ timeline: one, kits: createCast(one.cutout.cast) });
    for (let clock = 0; clock < one.frames; clock += 3) assert.ok(!/NaN|undefined/.test(scene.frame(clock)), `${name} at frame ${clock}`);
  }
  assert.match(compile({ cast: ['ann'], shots: [{ lines: [{ ...line, gesture: 'shh' }] }] }, specs, {}).warnings.join(), /covers ann's mouth/);
  assert.throws(() => check({ cast: ['ann'], shots: [{ lines: [{ ...line, gesture: { name: 'air-quotes', on: 'banana' } }] }] }, specs), /not in the line/);
});

test('people walk in, stay out once they have left, and two people can share a moment', () => {
  const plan = compile({ cast: ['ann', 'ben'], shots: [
    { acting: [{ who: 'ben', at: 0.4, enter: 'right' }], lines: [line] },
    { lines: [{ who: 'ben', say: 'Done.', moment: 'high-five', with: 'ann' }] },
    { acting: [{ who: 'ben', at: 0.2, exit: 'left' }] },
    { hold: 1 },
  ] }, specs, {});
  const walks = (cut) => plan.cuts[cut].beats.filter((beat) => beat.id === 'ben' && beat.action === 'walk').map((beat) => beat.arg);
  assert.ok(walks(0)[0].from > 300 && walks(0)[0].to === walks(0)[0].from, 'he waits out of frame on the right');
  assert.ok(walks(0)[1].from > 300 && walks(0)[1].to === 0, 'then walks to his place');
  assert.ok(plan.cuts[0].to / plan.fps >= 0.4 + walks(0)[1].frames / plan.fps, 'the shot waits for the walk');
  assert.ok(walks(2)[0].to < -600, 'he walks out past the left edge');
  assert.deepEqual(walks(3), [{ from: walks(2)[0].to, to: walks(2)[0].to, frames: 1 }], 'and is still out in the next shot');
  // The moment: both step toward each other, and each reaches with the arm on the other's side.
  const reach = (id) => plan.cuts[1].beats.find((beat) => beat.id === id && beat.action === 'pose' && beat.arg.startsWith('five')).arg;
  assert.deepEqual([reach('ann'), reach('ben')], ['fiveF', 'fiveF'], 'Ann is unflipped on the left and Ben is flipped on the right, so both use the far arm');
  const step = (id) => plan.cuts[1].beats.filter((beat) => beat.id === id && beat.action === 'walk').map((beat) => beat.arg.to);
  assert.ok(step('ann')[0] > 0 && step('ben')[0] < 0 && step('ann')[1] === 0, 'they step together and back');
  const scene = createScene({ timeline: plan, kits: createCast(plan.cutout.cast) });
  for (let clock = 0; clock < plan.frames; clock += 2) assert.ok(!/NaN|undefined/.test(scene.frame(clock)), `frame ${clock}`);
  assert.ok(Object.keys(MOMENTS).length >= 4);
  assert.throws(() => check({ set: 'home', cast: [{ id: 'ann', sit: true }, 'ben'], shots: [{ acting: [{ who: 'ben', moment: 'handshake', with: 'ann' }, { who: 'ann', enter: 'up' }] }] }, specs),
    (error) => ['both people standing', 'left', 'sitting'].every((word) => error.message.includes(word)));
});

test('things are held for a scene or picked up on a line, and every thing draws in a hand', () => {
  const plan = compile({ scenes: [{ set: 'kitchen', cast: ['ann', 'ben'], holding: { ann: 'cup' }, shots: [
    { lines: [line, { who: 'ben', say: 'Look.', hold: 'clipboard' }] }, { lines: [{ who: 'ben', say: 'Gone.', hold: 'none' }] },
  ] }] }, specs, {});
  const of = (cut, id, action) => plan.cuts[cut].beats.filter((beat) => beat.id === id && beat.action === action).map((beat) => beat.arg);
  assert.deepEqual(of(0, 'ann', 'hold'), ['cup']); assert.equal(of(0, 'ann', 'pose')[0], 'carry');
  assert.deepEqual(of(0, 'ben', 'hold'), ['clipboard']);
  assert.deepEqual(of(1, 'ben', 'hold'), ['clipboard', 'none'], 'he still has it at the start of the next shot, then puts it away');
  assert.equal(of(1, 'ben', 'pose').at(-1), 'rest');
  assert.equal(plan.cuts[0].set, 'kitchen');
  assert.ok(Object.keys(props).length >= 20);
  const kit = createCast({ one: specs.ann }).one;
  for (const name of Object.keys(props)) assert.ok(kit.figure({ ...poseOf('carry', true), prop: name, standing: true }).includes(props[name].slice(0, 30)), name);
  for (const name of Object.keys(bodies)) assert.ok(!/NaN|undefined/.test(kit.figure({ ...poseOf(name, true), over: poseOf(name, true).front, standing: true })), name);
  assert.throws(() => check({ cast: ['ann'], holding: { ann: 'sword' }, shots: [{ lines: [{ ...line, hold: 'shield' }] }] }, specs), (error) => ['sword', 'shield'].every((word) => error.message.includes(word)));
});

test('every room compiles and draws, a title card needs no lines, and looks and height are checked', () => {
  for (const set of ['plain', 'home', 'park', 'office', 'table', 'conference', 'terrace', 'kitchen', 'reception', 'cafe', 'corridor']) {
    const plan = compile({ set, cast: ['ann', 'ben'], shots: [{ lines: [line] }] }, specs, {});
    assert.ok(!/NaN|undefined/.test(createScene({ timeline: plan, kits: createCast(plan.cutout.cast) }).frame(0)), set);
  }
  const carded = compile({ cast: ['ann'], shots: [{ card: 'Three days later', sub: 'still waiting' }, { lines: [line] }] }, specs, {});
  assert.deepEqual(carded.cuts[0].card, { text: 'Three days later', sub: 'still waiting' });
  const shown = (carded.cuts[0].to - carded.cuts[0].from) / carded.fps;
  assert.ok(shown > 2.2 && shown < 2.4, `a card lasts 1.8 s after the half second every video opens with; this one lasted ${shown}`);
  assert.throws(() => check({ cast: ['ann'], shots: [{ card: 'Later', lines: [line] }] }, specs), /card shot has no lines/);
  // Looks: beards, a moustache and hats draw at every turn, and bad values are refused.
  for (const look of [{ beard: 'full', moustache: true }, { beard: 'goatee' }, { beard: 'stubble', hat: 'cap' }, { hat: 'beanie', hatColour: '#aa3344' }]) {
    const kit = createCast({ one: character({ id: 'one', ...look }, 'one.json') }).one;
    for (const turn of [0, 0.55, 1, -1]) assert.ok(!/NaN|undefined/.test(kit.head({ turn })), JSON.stringify(look));
  }
  assert.throws(() => character({ id: 'one', beard: 'viking', hat: 'crown', height: 2 }, 'one.json'), (error) => ['viking', 'crown', 'height'].every((word) => error.message.includes(word)));
  // Height: a taller person is the same drawing, larger, with their feet on the same floor.
  const tall = { ann: character({ id: 'ann', height: 1.2 }, 'ann.json'), ben: character({ id: 'ben', height: 0.8 }, 'ben.json') };
  const { ann, ben } = compile({ cast: ['ann', 'ben'], shots: [{ lines: [line] }] }, tall, {}).cuts[0].cast;
  near(ann.scale / ben.scale, 1.5); near(ann.y + 281 * ann.scale, ben.y + 281 * ben.scale);
});

test('a held thing moves to the other hand for a one-handed gesture, and a two-handed one is warned about', () => {
  const sketch = (gesture) => ({ scenes: [{ cast: ['ann'], holding: { ann: 'cup' }, shots: [{ lines: [{ ...line, gesture }] }] }] });
  const one = compile(sketch('count-one'), specs, {}), scene = createScene({ timeline: one, kits: createCast(one.cutout.cast) });
  const counting = one.cuts[0].beats.find((beat) => beat.action === 'pose' && beat.arg === 'count1'), frame = scene.frame(Math.round(counting.at * one.fps) + 10);
  assert.equal(frame.split(props.cup.slice(0, 40)).length - 1, 1, 'the cup is still drawn once, in the other hand, while she counts');
  assert.deepEqual(one.warnings, []);
  assert.match(compile(sketch('air-quotes'), specs, {}).warnings.join(), /uses both hands/);
  // Someone who walks in from "acting" has arrived before their own line starts; a stretched reaction lasts longer.
  const walked = compile({ cast: ['ann', 'ben'], shots: [{ acting: [{ who: 'ben', at: 0.2, enter: 'right' }], lines: [{ who: 'ben', say: 'Morning.' }] }] }, specs, {});
  const arrive = walked.cuts[0].beats.filter((beat) => beat.id === 'ben' && beat.action === 'walk').at(-1);
  assert.ok(walked.lines[0].startFrame / walked.fps >= arrive.at + arrive.arg.frames / walked.fps, 'he speaks after he arrives');
  assert.deepEqual(walked.warnings, []);
  const take = (stretch) => compile({ cast: ['ann'], shots: [{ acting: [{ who: 'ann', at: 0.2, react: 'double-take', stretch }] }] }, specs, {}).frames;
  assert.ok(take(1.5) > take(undefined));
});

test('a video call has square tiles, nobody looks at anyone, and each person is cropped to their own tile', () => {
  const four = { ...specs, cat: character({ id: 'cat' }, 'cat.json'), dan: character({ id: 'dan' }, 'dan.json') };
  const plan = compile({ set: 'call', cast: ['ann', 'ben', 'cat', 'dan'], shots: [
    { frame: 'wide', lines: [line, { who: 'ben', say: 'No.', to: 'ann' }] },
    { frame: 'medium', on: 'cat', lines: [{ who: 'cat', say: 'Me.' }] },
  ] }, four, {});
  const [gallery, solo] = plan.cuts;
  assert.equal(gallery.call.tiles.length, 4);
  for (const tile of gallery.call.tiles) { const [x, y, side] = tile.box; assert.ok(side > 150 && x >= 0 && y >= 0 && x + side <= 960 && y + side <= 540, 'each tile is one square inside the frame'); }
  for (const id of ['ann', 'ben', 'cat', 'dan']) { const [x, y, side] = gallery.cast[id].clip; assert.equal(gallery.cast[id].clip[2], gallery.cast[id].clip[3], 'cropped to a square'); assert.ok(gallery.cast[id].x > x && gallery.cast[id].x < x + side && gallery.cast[id].mirror === false); }
  const looks = gallery.beats.filter((beat) => beat.action === 'look').map((beat) => beat.arg);
  assert.ok(looks.length >= 4 && looks.every((look) => look === 'camera'), 'everyone looks at their own camera, even when spoken to');
  assert.deepEqual(gallery.call.tiles.filter((tile) => tile.speaking).map((tile) => tile.name), ['ann', 'ben']);
  // Even a look at someone written into the sketch, or a reaction that would turn to them, stays on the camera.
  const forced = compile({ set: 'call', cast: ['ann', 'ben'], shots: [{ frame: 'wide', lines: [{ ...line, look: 'ben', reactions: { ben: 'double-take' } }], acting: [{ who: 'ben', at: 0.1, look: 'ann' }, { who: 'ann', at: 0.2, react: 'deadpan' }] }] }, specs, {});
  assert.ok(forced.cuts[0].beats.filter((beat) => beat.action === 'look').every((beat) => ['camera', 'down', 'up'].includes(beat.arg)), 'no look at a person survives on a call');
  assert.deepEqual(solo.call.tiles.map((tile) => tile.name), ['cat']);
  assert.ok(solo.cast.ann.x < -1000 && Math.abs(solo.cast.cat.x - 480) < 1, 'in a single, everyone else is off the screen');
  assert.throws(() => check({ set: 'call', cast: ['ann', 'ben'], shots: [{ acting: [{ who: 'ann', moment: 'handshake', with: 'ben' }] }] }, specs), /different places/);
  assert.throws(() => check({ set: 'call', cast: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => id), shots: [{ hold: 1 }] }, Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => [id, specs.ann]))), /up to six/);
});

test('Rhubarb is found in the folder install-rhubarb.sh fills, with no setting, and only once it is marked ready', async () => {
  const { mkdtempSync, writeFileSync: write, rmSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { join: joinPath } = await import('node:path');
  const { tmpdir: temp } = await import('node:os');
  const home = mkdtempSync(joinPath(temp(), 'rhubarb-home-'));
  const doctor = () => {
    const env = { ...process.env, RHUBARB_HOME: home, PATH: '/usr/bin:/bin' };
    delete env.RHUBARB;
    const out = spawnSync(process.execPath, [new URL('./sketch.mjs', import.meta.url).pathname, 'doctor'], { env, encoding: 'utf8' });
    return (out.stdout + out.stderr).split('\n').find((row) => row.includes('Rhubarb Lip Sync')) ?? '';
  };
  try {
    write(joinPath(home, 'rhubarb'), '#!/bin/sh\n', { mode: 0o755 });
    assert.match(doctor(), /^no .*install-rhubarb\.sh/);
    write(joinPath(home, 'ready'), 'now\n');
    assert.match(doctor(), /^ok /);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('a subtitle file holds the same screens as the drawn captions, in order, without cues or names unless asked', async () => {
  const { captionCues, srt } = await import('./captions.mjs');
  const lines = [
    { character: 'ann', text: '[dry] Nobody finishes everything. It is making it up.', startFrame: 24, endFrame: 96 },
    { character: 'ben', text: 'All of them?', startFrame: 100, endFrame: 130 },
  ];
  const short = captionCues({ lines, names: { ann: 'Ann' }, setting: captionSetting({ style: 'box', names: false, length: 'short' }), fps: 24 });
  assert.ok(short.length >= 3, 'a long line is split into short screens');
  assert.ok(short.every((cue) => !cue.text.includes('[') && !cue.text.includes('Ann')));
  assert.equal(short[0].start, 1);
  for (let i = 1; i < short.length; i++) assert.ok(short[i].start >= short[i - 1].end - 1e-9, 'entries never overlap');
  assert.ok(short.at(-2).end <= 100 / 24 + 1e-9, 'a line\'s last screen ends by the time the next line starts');
  assert.equal(short.at(-1).text, 'All of them?');
  const named = captionCues({ lines, names: { ann: 'Ann' }, setting: captionSetting('bar'), fps: 24 });
  assert.match(named[0].text, /^Ann: /);
  assert.match(srt(short), /^1\n00:00:01,000 --> 00:00:0\d,\d{3}\nNobody/);
});
