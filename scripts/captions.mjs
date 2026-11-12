// Captions: the words of the line being spoken, drawn on top of a frame. Our own code, with no
// dependencies. Studio's renderer and the 2d-character-sketch skill both use this one copy.
//
// A caption is a piece of SVG text added after the scene is drawn, so it sits over the picture and never
// moves with the camera. Nothing here knows what a word sounds like: when a line is too long for the
// screen it is split into parts, and each part is shown for a share of the line's time in proportion to
// its letters. That is close enough to read along with, and it is an estimate, not a measurement.
const FONT = 'Helvetica, Arial, sans-serif';
const INK = '#14181a';
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The built-in styles. `size` is the letter height in room units (the room is 960 wide), `across` the most
// letters in one row, `wide` the usual width of one letter as a share of its height (used to size the box).
export const CAPTION_STYLES = {
  bar: { label: 'Bar', note: 'A dark band across the screen with the speaker’s name.', size: 22, across: 62, rows: 2, gap: 28, names: true },
  box: { label: 'Box', note: 'A rounded dark box that hugs the words.', size: 24, across: 46, rows: 2, gap: 31, wide: 0.52, names: true },
  outline: { label: 'Outline', note: 'Bold white words with a dark edge and no background.', size: 28, across: 40, rows: 2, gap: 35, bold: true, names: false },
  pop: { label: 'Pop', note: 'A few big words at a time, the current word in yellow.', size: 46, across: 20, rows: 1, gap: 52, bold: true, upper: true, names: false },
};
export const CAPTION_SHOW = ['always', 'auto', 'never'];
export const CAPTION_POSITIONS = ['bottom', 'top'];

// Turn whatever a sketch or scene saved into one full setting, or say what is wrong with it.
// true / "always" -> always, in the bar style; false / "off" -> never; "auto" -> only lines with no
// recording; a style name -> always, in that style; or an object { style, show, names, position }.
export function captionSetting(value, fallbackShow = 'auto') {
  const styles = Object.keys(CAPTION_STYLES);
  let given = value;
  if (value === undefined || value === null) given = { show: fallbackShow };
  else if (value === true || value === 'always') given = { show: 'always' };
  else if (value === false || value === 'off' || value === 'never') given = { show: 'never' };
  else if (value === 'auto') given = { show: 'auto' };
  else if (typeof value === 'string') given = { style: value, show: 'always' };
  if (typeof given !== 'object' || Array.isArray(given)) throw new Error(`captions must be true, false, "auto", a style (${styles.join(', ')}) or { style, show, names, position }`);
  const setting = { style: given.style ?? 'bar', show: given.show ?? (given.style ? 'always' : fallbackShow), position: given.position ?? 'bottom' };
  if (!CAPTION_STYLES[setting.style]) throw new Error(`captions: style "${setting.style}" must be one of: ${styles.join(', ')}`);
  if (!CAPTION_SHOW.includes(setting.show)) throw new Error(`captions: show "${setting.show}" must be one of: ${CAPTION_SHOW.join(', ')}`);
  if (!CAPTION_POSITIONS.includes(setting.position)) throw new Error(`captions: position "${setting.position}" must be one of: ${CAPTION_POSITIONS.join(', ')}`);
  if (given.names !== undefined && typeof given.names !== 'boolean') throw new Error('captions: names must be true or false');
  setting.names = given.names ?? CAPTION_STYLES[setting.style].names;
  return setting;
}

// Split words into rows of at most `across` letters, then rows into screens of at most `rows` rows.
// Each screen remembers which words it holds, so it can be shown while those words are being said.
// A one-row style (pop) also starts a new screen after a full stop, so two sentences never share one.
function screens(words, across, rows) {
  const wide = (row) => row.reduce((sum, i) => sum + words[i].length + 1, -1);
  const lines = [[]];
  words.forEach((word, index) => {
    const row = lines.at(-1), ended = rows === 1 && row.length && /[.!?…]$/.test(words[row.at(-1)]);
    if (row.length && (ended || wide(row) + 1 + word.length > across)) lines.push([index]);
    else row.push(index);
  });
  const out = [];
  for (let i = 0; i < lines.length; i += rows) out.push(lines.slice(i, i + rows));
  // Two rows read better at about the same width than as a full row with one word left under it.
  return out.map((screen) => {
    if (screen.length !== 2) return screen;
    const all = screen.flat();
    let best = screen;
    for (let cut = 1; cut < all.length; cut++) {
      const pair = [all.slice(0, cut), all.slice(cut)];
      if (wide(pair[0]) <= across && wide(pair[1]) <= across && Math.abs(wide(pair[0]) - wide(pair[1])) < Math.abs(wide(best[0]) - wide(best[1]))) best = pair;
    }
    return best;
  });
}
// How long a word takes to say, roughly: its letters, and a breath after a full stop or comma.
const weight = (word) => word.length + 1 + (/[.!?…]$/.test(word) ? 4 : /[,;:—–]$/.test(word) ? 2 : 0);

// The caption for one frame, as SVG, or '' when nobody is speaking.
//   lines   [{ character, text, startFrame, endFrame }]   the spoken lines, in frames
//   clock   the frame being drawn
//   names   { characterId: 'Name' }   used when the setting shows names
//   setting what captionSetting() returned
export function captionSvg({ lines, clock, names = {}, setting, width = 960, height = 540 }) {
  const style = CAPTION_STYLES[setting?.style ?? 'bar'], position = setting?.position ?? 'bottom';
  // A caption stays for a quarter of a second after its line, unless the next line has already begun.
  const line = lines.findLast((item) => item.text && clock >= item.startFrame && clock < item.endFrame + 6);
  if (!line) return '';
  const said = String(line.text).replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!said.length) return '';
  const name = (setting?.names ?? style.names) ? (names[line.character] ?? line.character) : null;
  // The name leads the first screen and counts toward its width, but takes no speaking time.
  const words = name ? [`${name}:`, ...said] : said, lead = name ? 1 : 0;
  const all = screens(words, style.across, style.rows);
  const total = said.reduce((sum, word) => sum + weight(word), 0);
  const progress = Math.min(0.9999, Math.max(0, (clock - line.startFrame) / Math.max(1, line.endFrame - line.startFrame)));
  let passed = 0, current = words.length - 1;
  for (let i = lead; i < words.length; i++) { passed += weight(words[i]); if (passed / total > progress) { current = i; break; } }
  const screen = all.find((rows) => rows.at(-1).at(-1) >= current) ?? all.at(-1);

  const shown = (i) => esc(style.upper ? words[i].toUpperCase() : words[i]);
  const lettersWide = (row) => row.reduce((sum, i) => sum + words[i].length + 1, -1);
  const baseline = (row) => (position === 'top' ? 30 + style.size + row * style.gap : height - 30 - (screen.length - 1 - row) * style.gap);
  const text = (row, i, attributes, inner) =>
    `<text x="${width / 2}" y="${baseline(i)}" font-family="${FONT}" font-size="${style.size}"${style.bold ? ' font-weight="700"' : ''} text-anchor="middle" ${attributes}>${inner}</text>`;
  const plain = (row) => row.map((i) => (i < lead ? `<tspan font-weight="700">${shown(i)}</tspan>` : shown(i))).join(' ');

  if (setting?.style === 'outline' || setting?.style === 'pop') {
    // No background, so the letters carry a thick dark edge. paint-order draws the edge first and the
    // letter over it, which keeps the letter its full weight.
    const edge = Math.round(style.size * 0.22);
    return screen.map((row, i) => {
      const lit = row.map((w) => (setting.style === 'pop' && w === current ? `<tspan fill="#ffd84a">${shown(w)}</tspan>` : shown(w))).join(' ');
      return text(row, i, `fill="#ffffff" stroke="${INK}" stroke-width="${edge}" stroke-linejoin="round" paint-order="stroke"`, lit);
    }).join('');
  }
  if (setting?.style === 'box') {
    const letters = Math.max(...screen.map(lettersWide)), boxWidth = Math.min(width - 40, letters * style.size * style.wide + 44);
    const top = baseline(0) - style.size - 8, boxHeight = (screen.length - 1) * style.gap + style.size + 26;
    return `<rect x="${(width - boxWidth) / 2}" y="${top}" width="${boxWidth}" height="${boxHeight}" rx="10" fill="${INK}" opacity=".84"/>` +
      screen.map((row, i) => text(row, i, 'fill="#ffffff"', plain(row))).join('');
  }
  // The bar: a band the full width of the screen.
  const top = baseline(0) - style.size - 9, band = (screen.length - 1) * style.gap + style.size + 9 + 19;
  const [y, tall] = position === 'top' ? [0, top + band] : [top, height - top];
  return `<rect x="0" y="${y}" width="${width}" height="${tall}" fill="#1d2420" opacity=".62"/>` + screen.map((row, i) => text(row, i, 'fill="#ffffff"', plain(row))).join('');
}
