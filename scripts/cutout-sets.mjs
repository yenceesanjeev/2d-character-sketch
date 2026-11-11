// Cutout sets: the rooms, furniture, props and inserts the cutout cast is drawn into.
// Same rules as the characters: flat fills, a darker tone of the same colour for an edge, no black
// outlines. Rooms are quieter than people: lower contrast, less saturation, and nothing busy in the
// band where heads sit. Background rules: .agents/skills/cutout-characters/SKILL.md.
// No Node or browser dependencies. Units are the same 960 x 540 room units the Studio plan uses.

// The colours every room is drawn with. A project can change any of them in its own file
// (library/sets/cutout.json); `paint` below switches the rooms to those colours.
const DEFAULTS = {
  wall:'#ddd6c6', ceiling:'#d2cab8', glass:'#a9c3bf', glassLight:'#b9d0cb', mullion:'#93b0ac', beyond:'#9db9b4', floor:'#b9af9c', skirting:'#a69c88',
  chair:'#80958c', chairShade:'#6b8077', wood:'#dfc59d', woodEdge:'#c6a77b', woodPanel:'#b1916a', woodShade:'#9d7f5b',
  paper:'#f6f2e6', paperLine:'#cfc8b6', red:'#c9574a', metal:'#cdd2d5', metalShade:'#aab1b5', dark:'#414d4f', screen:'#b4c2c5', screenLine:'#9fb0b3',
  cabinWall:'#e4dac6', cabinShade:'#d5c9b1', window:'#f3ead2', windowLight:'#fbf5e4', frame:'#c2a981', leaf:'#7e9a6c', pot:'#a9795a', cabinet:'#9aa99a', cabinetShade:'#82917f',
  officeWall:'#e3ddce', officeFloor:'#c9c3b4', carpet:'#d3cdbf', desk:'#cbc4b3', deskShade:'#b5ae9d', plastic:'#d3d1c4', plasticShade:'#b7b5a7', water:'#93b5b9',
};
const C = { ...DEFAULTS };
export const defaultPalette = Object.freeze({ ...DEFAULTS });
export const palette = () => ({ ...C });
// Use a project's colours for everything drawn from here on. Anything it does not name, or names badly,
// keeps its default, so a damaged file can never stop a render.
export function paint(colours = {}) {
  for (const key of Object.keys(DEFAULTS)) C[key] = /^#[0-9a-f]{6}$/i.test(colours?.[key] ?? '') ? colours[key].toLowerCase() : DEFAULTS[key];
}
const rect = (x, y, w, h, fill, rx = 0, more = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${more}/>`;
const path = (fill, d, more = '') => `<path fill="${fill}" d="${d}"${more}/>`;
const edged = (_, edge) => ` stroke="${edge}" stroke-width="1.8" stroke-linejoin="round"`;
const strokes = (color, width, d, more = '') => `<path fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" d="${d}"${more}/>`;

// Where the table's near edge sits. Seated hands rest just above it; everything below is hidden.
export const TABLE_EDGE = 362;

// ---- Things that sit on the meeting table, drawn in front of whoever owns them ---------------------
const tableProps = {
  // The CEO's printout with its red-circled row, beside his hands.
  ch003:x => path(C.paper, `M${x+30} 361L${x+40} 345H${x+98}L${x+92} 361Z`, edged(1, C.paperLine))+
    strokes(C.paperLine, 1.3, `M${x+45} 349H${x+90}M${x+43} 353H${x+89}M${x+41} 357H${x+88}`)+
    `<ellipse cx="${x+64}" cy="353" rx="9" ry="3.4" fill="none" stroke="${C.red}" stroke-width="1.6"/>`,
  // The Manager's open laptop, seen from behind its lid, with his notepad and pen beside it.
  ch002:x => rect(x-33, 327, 66, 36, C.metal, 5, edged(1, C.metalShade))+`<circle cx="${x}" cy="344" r="4" fill="${C.metalShade}"/>`+
    path('#f3e9b8', `M${x-86} 361L${x-80} 348H${x-48}L${x-50} 361Z`, edged(1, '#cdbf85'))+strokes('#33506a', 3, `M${x-78} 352L${x-58} 357`),
  // Neel's earbud case.
  ch001:x => rect(x+42, 352, 16, 9, '#f1ede2', 4, edged(1, C.paperLine)),
};

// ---- The glass-walled meeting room ------------------------------------------------------------------
// `seats` is who is in frame and where: [{ id, x }]. Only their chairs and table things are drawn.
export function meeting(seats) {
  const mullions = [-330, -90, 150, 390, 630, 870, 1110, 1350].map(x => rect(x-3, 70, 6, 310, C.mullion)).join('');
  const monitors = [40, 205, 318, 545, 770, 930].map(x => rect(x, 300, 40, 26, C.beyond, 3)+rect(x+17, 326, 6, 10, C.beyond)).join('');
  const back = rect(-700, -400, 2400, 1500, C.wall)+rect(-700, -400, 2400, 470, C.ceiling)+rect(-700, 70, 2400, 310, C.glass)+
    // Life beyond the glass stays faint and below the line of the heads.
    rect(-700, 336, 2400, 44, C.beyond)+monitors+
    path(C.glassLight, 'M-700 122L1700 78V98L-700 148ZM-700 168L1700 140V150L-700 180Z', ' opacity=".6"')+mullions+rect(-700, 70, 2400, 6, C.mullion)+
    rect(-700, 380, 2400, 800, C.floor)+rect(-700, 380, 2400, 5, C.skirting)+
    seats.map(({ x }) => rect(x-62, 208, 124, 250, C.chair, 34, edged(1, C.chairShade))).join('')+
    // The table top is behind the cast, so hands rest on it. Its near edge and front are drawn in front.
    rect(-700, 338, 2400, TABLE_EDGE-338, C.wood);
  const front = rect(-700, TABLE_EDGE, 2400, 24, C.woodEdge)+rect(-700, TABLE_EDGE, 2400, 3, C.wood)+rect(-700, TABLE_EDGE+24, 2400, 700, C.woodPanel)+
    rect(-700, TABLE_EDGE+24, 2400, 4, C.woodShade, 0, ' opacity=".5"')+seats.map(({ id, x }) => tableProps[id]?.(x) ?? '').join('');
  return { back, front };
}

// ---- The cabin where people talk to the camera ---------------------------------------------------
export function cabin() {
  const leaves = strokes(C.leaf, 6, 'M1648 318Q1640 290 1622 282M1648 318Q1650 284 1668 274M1648 318Q1660 298 1680 300');
  const back = rect(900, -300, 1300, 1300, C.cabinWall)+rect(900, 420, 1300, 600, C.cabinShade)+
    rect(1556, 136, 138, 168, C.frame, 4)+rect(1563, 143, 124, 154, C.window)+path(C.windowLight, 'M1563 143H1640L1563 262Z')+rect(1622, 143, 6, 154, C.frame)+rect(1563, 216, 124, 6, C.frame)+
    rect(1316, 172, 66, 52, C.frame, 3)+rect(1322, 178, 54, 40, C.paper)+strokes(C.paperLine, 2, 'M1331 190H1366M1331 198H1360M1331 206H1352')+
    rect(1598, 336, 108, 130, C.cabinet, 4, edged(1, C.cabinetShade))+strokes(C.cabinetShade, 2.5, 'M1640 362H1664M1640 402H1664')+
    path(C.pot, 'M1632 316H1664L1660 338H1636Z')+leaves+
    rect(1390, 248, 124, 230, C.chair, 34, edged(1, C.chairShade));
  return { back, front:'' };
}

// ---- The open office floor, and what stands in front of the cast in each cutaway -------------------
const cutaways = {
  'CUT-SHEET':() => rect(64, 386, 496, 22, C.woodEdge, 3)+rect(64, 386, 496, 4, C.wood)+rect(86, 408, 14, 132, C.woodPanel)+rect(524, 408, 14, 132, C.woodPanel)+
    rect(252, 272, 170, 104, C.dark, 8)+rect(262, 282, 150, 82, '#e1e8dc')+strokes('#a9bda6', 1.6, 'M274 300H400M274 314H400M274 328H400M274 342H400M306 288V356M338 288V356M370 288V356')+
    rect(326, 376, 22, 10, C.dark)+rect(446, 374, 60, 10, C.plastic, 3, edged(1, C.plasticShade)),
  'CUT-PRINTER':() => rect(302, 320, 274, 88, C.plastic, 10, edged(1, C.plasticShade))+rect(336, 333, 168, 30, '#7c8c88', 4)+
    path(C.paper, 'M368 352H476L466 394H348Z', edged(1, C.paperLine))+`<circle cx="545" cy="347" r="7" fill="${C.red}"/>`+rect(320, 408, 238, 132, C.deskShade),
  'CUT-COOLER':() => path(C.water, 'M455 197Q434 197 432 217V282H517V217Q515 197 494 197Z', edged(1, '#7a9ea2'))+rect(425, 272, 101, 140, C.plastic, 8, edged(1, C.plasticShade))+
    rect(448, 288, 54, 38, '#7c8c88', 4)+rect(440, 412, 72, 128, C.plasticShade)+rect(190, 370, 87, 27, '#b9a273', 11)+rect(281, 367, 92, 30, '#84a08e', 12),
};
export function floor(staging) {
  const monitors = [196, 322, 468, 612, 756].map((x, n) => rect(x, 232, 46, 30, C.dark, 4)+rect(x+4, 236, 38, 22, C.screen)+
    strokes(C.screenLine, 1.4, `M${x+9} ${243+n%2}H${x+36}M${x+9} 250H${x+30}`)+rect(x+20, 262, 6, 8, C.dark)).join('');
  const back = rect(-200, -200, 1400, 1000, C.officeWall)+rect(-200, 0, 1400, 14, '#f0ebde')+[150, 400, 650].map(x => rect(x, 4, 150, 8, '#fbf8ee', 4)).join('')+
    rect(28, 58, 86, 62, C.paper, 3, edged(1, C.paperLine))+strokes(C.paperLine, 2, 'M40 74H100M40 86H96M40 98H84')+
    rect(-200, 300, 1400, 600, C.officeFloor)+path(C.carpet, 'M300 300H660L900 540H60Z')+
    rect(150, 268, 760, 12, C.desk, 3)+rect(160, 280, 740, 38, C.deskShade)+monitors+
    path(C.pot, 'M884 270H912L908 300H888Z')+strokes(C.leaf, 5, 'M898 270Q892 240 878 232M898 270Q900 236 914 226M898 270Q908 250 922 252');
  return { back, front:cutaways[staging]?.() ?? '' };
}

// ---- Inserts that fill the frame ---------------------------------------------------------------------
const type = (x, y, size, fill, text, weight = 400) => `<text x="${x}" y="${y}" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`;
export const inserts = {};   // The source project keeps its own full-frame inserts; none ship with the skill.

// The built-in rooms, by the set name the Studio plan uses. Any other set falls back to its own drawing.
export const builtIn = { meeting, cabin, floor };

// Every room, cutaway and insert by name, drawn without people, for Studio's Set screen: what to call it,
// the part of the room to show as [x, y, width, height], and how to draw it. The meeting room is shown with
// its three usual seats (the same places cutout-draw.mjs seats the leads) so its chairs and table things show.
const USUAL_SEATS = [{ id:'ch001', x:235 }, { id:'ch003', x:480 }, { id:'ch002', x:716 }];
const FULL = [0, 0, 960, 540];
export const catalogue = {
  meeting:{ label:'Meeting room', frame:FULL, draw:() => meeting(USUAL_SEATS) },
  cabin:{ label:'Cabin', frame:[1180, 96, 560, 315], draw:() => cabin() },
  floor:{ label:'Office floor', frame:FULL, draw:() => floor() },
  ...Object.fromEntries(Object.keys(cutaways).map(name => [name, { label:'Office-floor cutaway', frame:FULL, draw:() => floor(name) }])),
  ...Object.fromEntries(Object.keys(inserts).map(name => [name, { label:'Insert', frame:FULL, draw:() => ({ back:inserts[name](), front:'' }) }])),
};
