# Building a character

A character is one small file, `characters/<id>.json`. The tool fills in anything you leave out, so the shortest valid file is `{ "id": "sam" }`. That draws a plain stand-in.

## Example

```json
{
  "id": "mira",
  "name": "Mira",
  "description": "Mustard cardigan over a white tee, long dark hair, round steel glasses.",
  "skin": "#c98f63",
  "hair": "#2a1f24",
  "style": "long",
  "glasses": "steel",
  "top": "#d3a23a",
  "front": "open",
  "inner": "#f3efe6",
  "sleeve": 0.9,
  "legs": "#3e4a66",
  "shoe": "#f1ebdf",
  "resting": "happy"
}
```

## Fields

Colours are six-digit hex, like `#7d8449`. Each fill has an edge colour named `<field>Shade` (for example `topShade`). Leave the shades out and the tool uses a darker tone of the fill.

| Field | What it sets | Values (default) |
| --- | --- | --- |
| `id` | The name used in sketch files and file names | lowercase letters, digits, dashes |
| `name` | The name shown on sheets and captions | any text (the id) |
| `description` | One line on the sheet, for people | any text |
| `skin` | Skin colour | hex (`#d0976a`) |
| `hair` | Hair and eyebrow colour | hex (`#2b2024`) |
| `style` | Hair shape. Run `sketch.mjs options hair <id>` to see every one on a character from three angles. | `swept`, `part`, `unkempt`, `short`, `fluffy`, `long`, `bun`, `bald`, and a first batch added 2026-11-12 that the user has not yet reviewed: `afro`, `receding`, `bangs`, `bob`, `lob`, `ponytail`, `spiky`, `pigtails`, `buns`, `flattop`, `mohawk`, `stubble` (a recently shaved head: close dots of new hair), `balding` (a bare crown with hair round the sides), `curtains` (`short`) |
| `strand` | Thin highlight lines in the hair. Only `swept`, `part` and `unkempt` draw them. | hex (a lighter tone of `hair`) |
| `temple` | A few grey streaks at the sideburn | hex (none) |
| `head` | Head half-width and half-height | two numbers from 40 to 70 (`[49, 60]`) |
| `glasses` | Glasses | `rimless`, `thick`, `steel` (none) |
| `beard` | Facial hair, in the hair colour. `full` covers the lower face and leaves a patch of skin round the mouth so the mouth still reads. `stubble` is the same area in close dots. `goatee` is the chin only. | `full`, `goatee`, `stubble` (none) |
| `moustache` | A moustache, with or without a beard | `true` (off) |
| `hat` | Headwear over the hair. A `cap` has its peak on the side they face. | `beanie`, `cap` (none) |
| `hatColour` | The hat's colour | hex (`#4a5a6a`) |
| `height` | How tall they are. The whole figure is drawn larger or smaller with its feet on the same floor. People sitting at the `table` are all drawn the same size. | 0.8 (short) to 1.2 (tall) (`1`) |
| `tiredEyes` | A small line under each eye | `true` (off) |
| `top` | Main clothing colour | hex (`#6d7c8b`) |
| `front` | What the top is | `tee`, `shirt`, `open`, `hoodie` (`tee`) |
| `inner` | What shows under an `open` top | hex (`#f1f2ee`) |
| `mark` | A small print on the inner tee of an `open` top | hex (none) |
| `checks` | A check pattern on a `shirt` | `true` (off) |
| `lanyard` | An ID badge on a `shirt` | `true` (off) |
| `headphones` | Headphones round the neck | `true` (off) |
| `sleeve` | How far the sleeve runs down the arm | 0.2 (short) to 1 (wrist) (`0.92`) |
| `waist` | Body width | 44 to 66 (`54`) |
| `paunch` | A slight belly | 0 to 8 (`0`) |
| `legs` | Trouser colour | hex (`#4a4f5c`) |
| `shoe` | Shoe colour | hex (`#3a332f`) |
| `resting` | The face they wear when nothing else is directed | any expression (`neutral`) |
| `holds` | Something always in their hand, set separately for standing and seated. For something held in one scene only, use `holding` in the sketch instead. | `{ "standing": "mug" }`, `{ "seated": "pen" }` or both keys. Things: `phone`, `mug`, `pen`, `book`, `clipboard`, `mic`, `cup`, `glass`, `bottle`, `tablet`, `folder`, `sandwich`, `apple`, `pizza`, `gift`, `flowers`, `remote`, `keys`, `card`, `trophy`, `sign` |
| `voice` | Their voice, one entry per engine you use. The `say` name must match a name from `sketch.mjs voices` exactly. | `{ "say": "Daniel", "openvoice": "EN-BR", "elevenlabs": "<voice id>", "sarvam": "<speaker>" }` |

`front` in practice: `tee` is a plain top. `shirt` adds a button line. `open` is a jacket, cardigan or overshirt over an inner tee. `hoodie` adds a hood, pocket and drawstrings. Every top ends at the hip, so a long coat comes out as a jacket.

A character who `holds` something keeps it in the gesturing hand in every pose. So `offer` holds the phone up, which reads well, and the `phone` and `sip` poses are for characters who do not already hold that prop.

## The starters

`starter-cast.json` in the skill folder holds twelve characters: Zoe (afro), Mei (bob, glasses), Lena (long with a fringe), Nora (shoulder length), Tess (ponytail), Kofi (flat top), Raj (stubble), Walt (balding, grey, glasses), Theo (centre part), Kai (spiky, headphones), Pippa (pigtails) and Omar (receding, greying). `sketch.mjs starters` draws them in a row as `characters/starters.png`; `starters <id>` or `starters all` copies them in and never overwrites a file that is already there. They are examples of telling people apart by outline first: different hair shape, then height and build, then facial hair, then top colour. Their heights run from 0.88 to 1.12. `options face <id>` draws every beard, moustache and hat on a character, the way `options hair <id>` does for hair.

## The look, and why

Everything is drawn by code, so the design is kept to what code draws well. Earlier attempts at illustrator-style detail failed. These are the rules that worked:

- **Head:** an egg that narrows to the chin, not a ball.
- **Eyes:** two dark dots, the same on everyone. Lids and brows carry the expression.
- **Nose:** one small button. **Mouth:** a line, or one of nine speech shapes.
- **Body:** slim, with noodle arms that bend as one curve and mitten hands.
- **Colour:** flat fills, each edged in a darker tone of itself. No black outlines.
- **Hair:** one smooth shape with a fringe. Volume comes from the silhouette, not from curls.

Looks that were tried and rejected, so do not steer back to them: detailed outlined cutouts ("too robotic"), white eyes that touch, round heads with wide bodies ("too chubby"), rings of curls, dark collar shapes at the neck, and long hair drawn as one block under the chin ("it looks like a beard"). Long hair now falls in two locks beside the jaw and leaves the neck clear.

## Making characters different from each other

Only a few things vary, so choose them on purpose:

1. **Silhouette first.** Hair style is the strongest signal. Give each character in a sketch a different one.
2. **One strong top colour each**, far apart from the others: one warm, one cool, one dark. Keep trousers and shoes quiet.
3. **One accessory at most:** glasses, headphones, a lanyard, or a held mug.
4. **Body:** the range is narrow on purpose. `waist` 50 is slim and 60 is broad, and `paunch` adds a slight belly. An `open` top hides most of both, so use `tee`, `shirt` or `hoodie` on a character who should look heavy. Nobody can be drawn very large.
5. **Resting face** is personality: `serene`, `skeptical`, `tired`, `defiant`, `happy`.
6. **Skin and hair** need clear contrast with each other and with the top, or the head merges into the body.

## Checklist for the sheet

Open `characters/<id>.sheet.png` and check each of these. They all caught real faults.

- **Top silhouette.** Does the hair read as hair in all four turns? Lumps on top can read as a crown, and a bun has been read as a turban. Shrink the sheet to the size of a face in a wide shot and name what you see; if it is not plainly hair, pick another style.
- **Hair covers the head's edge.** No skin-coloured sliver between hair and background.
- **Nothing dark under the chin.** Hair, a hood or a dark inner top directly below the jaw can read as a beard. The neck should show.
- **Side view.** The far ear should be hidden, and glasses should still sit on the nose.
- **Resting face.** The turnaround, the large head and the cast picture all wear it. Does it match the personality you were asked for?
- **Colour.** Can you tell the top from the skin and the hair at thumbnail size? Is the inner tee visible on an `open` top?
- **Resting face.** `happy` draws the eyes as closed arcs and `smug`, `bored` and `tired` half close them. As a resting face these made a character look asleep when speaking to the camera. Prefer `neutral` or `serene` at rest unless the half-closed look is the character.
- **Expressions.** Scan the grid. Brows are drawn in the hair colour, so very pale hair on pale skin loses them.
- **Weight.** If the figure looks heavier than intended, lower `waist` or `paunch` by a little.
- **Cast.** In `characters/cast.png`, cover the faces. Can you still tell who is who?

## What a file cannot change

Hair styles, expressions, poses, hands and props are shared tables in `scripts/cutout-draw.mjs`. A new entry there is available to every character. Add one only when the user asks for it, then redraw every sheet to check that nothing else moved.
