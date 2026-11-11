// Guards the two things the skill depends on in the shared drawing code: that a sketch compiles to a
// plan the drawing code accepts, and that each framing lands where the compiler means it to. The
// compiler undoes two adjustments cutout-draw.mjs makes to a camera; if those change, these fail.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCast, createScene } from './cutout-draw.mjs';
import { character, check, compile } from './sketch.mjs';

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
