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
| `style` | Hair shape | `swept`, `part`, `unkempt`, `short`, `fluffy`, `long`, `bun`, `bald` (`short`) |
| `strand` | Thin highlight lines in the hair. Only `swept`, `part` and `unkempt` draw them. | hex (a lighter tone of `hair`) |
| `temple` | A few grey streaks at the sideburn | hex (none) |
| `head` | Head half-width and half-height | two numbers from 40 to 70 (`[49, 60]`) |
| `glasses` | Glasses | `rimless`, `thick`, `steel` (none) |
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
| `holds` | Something always in their hand, set separately for standing and seated | `{ "standing": "mug" }`, `{ "seated": "pen" }` or both keys. Props: `phone`, `mug`, `pen` |
| `voice` | Their voice. The `say` name must match a name from `sketch.mjs voices` exactly. | `{ "say": "Daniel", "elevenlabs": "<voice id>" }` |

`front` in practice: `tee` is a plain top. `shirt` adds a button line. `open` is a jacket, cardigan or overshirt over an inner tee. `hoodie` adds a hood, pocket and drawstrings. Every top ends at the hip, so a long coat comes out as a jacket.

A character who `holds` something keeps it in the gesturing hand in every pose. So `offer` holds the phone up, which reads well, and the `phone` and `sip` poses are for characters who do not already hold that prop.

## The look, and why

Everything is drawn by code, so the design is kept to what code draws well. Earlier attempts at illustrator-style detail failed. These are the rules that worked:

- **Head:** an egg that narrows to the chin, not a ball.
- **Eyes:** two dark dots, the same on everyone. Lids and brows carry the expression.
- **Nose:** one small button. **Mouth:** a line, or one of nine speech shapes.
- **Body:** slim, with noodle arms that bend as one curve and mitten hands.
- **Colour:** flat fills, each edged in a darker tone of itself. No black outlines.
- **Hair:** one smooth shape with a fringe. Volume comes from the silhouette, not from curls.

Looks that were tried and rejected, so do not steer back to them: detailed outlined cutouts ("too robotic"), white eyes that touch, round heads with wide bodies ("too chubby"), rings of curls, and dark collar shapes at the neck.

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

- **Top silhouette.** Does the hair read as hair in all four turns? Lumps on top can read as a crown.
- **Hair covers the head's edge.** No skin-coloured sliver between hair and background.
- **Side view.** The far ear should be hidden, and glasses should still sit on the nose.
- **Resting face.** The turnaround, the large head and the cast picture all wear it. Does it match the personality you were asked for?
- **Colour.** Can you tell the top from the skin and the hair at thumbnail size? Is the inner tee visible on an `open` top?
- **Expressions.** Scan the grid. Brows are drawn in the hair colour, so very pale hair on pale skin loses them.
- **Weight.** If the figure looks heavier than intended, lower `waist` or `paunch` by a little.
- **Cast.** In `characters/cast.png`, cover the faces. Can you still tell who is who?

## What a file cannot change

Hair styles, expressions, poses, hands and props are shared tables in `scripts/cutout-draw.mjs`. A new entry there is available to every character. Add one only when the user asks for it, then redraw every sheet to check that nothing else moved.
