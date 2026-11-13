# Writing a sketch

A sketch is one file, `sketches/<name>.json`: a room, a cast, and a list of shots, or several [scenes](#several-rooms-scenes) that each have their own. Each shot is one camera framing that holds some lines or a silent beat. The tool times everything from the recordings, so you never write timestamps for speech.

## Example

```json
{
  "title": "Tea",
  "set": "home",
  "cast": ["mira", "theo"],
  "shots": [
    { "frame": "wide", "lines": [
      { "who": "mira", "say": "I made you tea. It took four minutes and all of my patience.", "face": "happy", "pose": "offer" },
      { "who": "theo", "say": "This is coffee.", "face": "skeptical" }
    ] },
    { "frame": "close", "on": "mira", "lines": [
      { "who": "mira", "say": "It identifies as tea.", "face": "smug", "reactions": { "theo": "bored" } }
    ] },
    { "frame": "medium", "on": "theo", "hold": 1.4, "zoom": 1.12, "acting": [
      { "who": "theo", "at": 0.2, "face": "sideeye", "look": "camera" },
      { "who": "theo", "at": 0.7, "pose": "sip" }
    ] },
    { "frame": "group", "on": ["mira", "theo"], "end": "fade", "lines": [
      { "who": "theo", "say": "Fine. Good tea.", "face": "tired", "do": "nod", "reactions": { "mira": "laugh" } }
    ] }
  ]
}
```

Render it with `node SKILL/scripts/sketch.mjs render sketches/tea.json --draft`, then look at `out/tea-draft/contact-sheet.png`.

## Top level

| Field | Meaning |
| --- | --- |
| `title` | A name for the record. Optional. |
| `set` | The room: `plain`, `home`, `park`, `office`, `table`, `conference`, `terrace`, `kitchen`, `reception`, `cafe`, `corridor`, `call`, or the path of an SVG backdrop. Default `plain`. See [Rooms](#rooms). |
| `cast` | Character ids from screen left to screen right. Everyone stays in place for the whole scene. An entry can be an object instead of an id: `{ "id": "sam", "sit": true }` seats them on the room's sofa or bench, and `x`, `y`, `scale` and `mirror` place them by hand. |
| `shots` | The shots, in order. |
| `voice` | `say`, `openvoice`, `elevenlabs`, `sarvam` or `none`. The `--voice` option overrides it. |
| `language` | The language Sarvam speaks, such as `en-IN` or `hi-IN`. Default `en-IN`. Other engines ignore it. |
| `captions` | `"auto"` (the default): only on lines with no recording. `true` always, `false` never. Or a style, which captions every line: `"bar"`, `"box"`, `"outline"`, `"pop"`. See [Captions](#captions). |
| `pace` | `quick`, `normal` (the default) or `slow`. The silence after a line and at the end of a shot, wherever the line or shot does not give its own: 0.18 and 0.25 seconds, 0.35 and 0.4, or 0.6 and 0.65. |
| `tone` | A few words on how it should feel, such as "dry, underplayed". The tool only records it. See [script.md](script.md). |
| `laptops` | Character ids who get an open laptop on the table in front of them, such as `["maya", "theo"]`. Only with `"set": "table"`. The `type` pose then reads as working on it. |
| `holding` | Things in people's hands for the whole scene, as `{ "omar": "cup" }`. The thing is carried at chest height, out to one side where it can be seen; a `mic` is held under the chin, clear of the mouth. One thing per person: a pose or reaction that brings its own (`phone`, `sip`, `check-phone`) moves the held thing to the other hand meanwhile. Things: `phone`, `mug`, `pen`, `book`, `clipboard`, `mic`, `cup`, `glass`, `bottle`, `tablet`, `folder`, `sandwich`, `apple`, `pizza`, `gift`, `flowers`, `remote`, `keys`, `card`, `trophy`, `sign`. |
| `busy` | People occupied for the whole scene, as `{ "sam": "phone" }`: a character id and the pose they keep up. Useful poses: `phone`, `sip`, `cross`, and `type` at the table. Their eyes stay down, they do not turn to whoever speaks, and they speak without looking up. A `look` on one of their lines, or a stock reaction, lifts their eyes; a reaction puts them back afterwards. After a gesture on a line the busy pose returns. |
| `scenes` | A list of scenes, in place of `set`, `cast`, `laptops`, `busy` and `shots` at the top. See [Several rooms](#several-rooms-scenes). |
| `music` | A sound file played under the whole video: `"sfx/theme.mp3"` or `{ "file": ..., "volume": 0.2 }`. Default volume 0.25. It fades out with the video. See [Sound](#sound). |

### Several rooms: scenes

When the script moves between places, list scenes. Each scene has its own `set`, `cast`, `laptops`, `holding`, `busy` and `shots`. Everything else (`title`, `tone`, `pace`, `captions`, `voice`, `music`) stays at the top and covers the whole video.

```json
{
  "title": "Pitch",
  "pace": "normal",
  "scenes": [
    { "set": "table", "cast": ["maya", "dev"], "laptops": ["maya", "dev"], "shots": [
      { "frame": "wide", "lines": [{ "who": "maya", "say": "You could even make a sitcom." }] }
    ] },
    { "set": "home", "cast": ["maya", "dev"], "shots": [
      { "frame": "wide", "lines": [{ "who": "maya", "say": "Like this one.", "pause": 2.6, "sound": { "file": "sfx/laugh.wav", "length": 2.6, "volume": 0.6 } }] }
    ] }
  ]
}
```

- The cut between scenes is a hard cut. Nothing slides or dissolves.
- A scene can have a different cast, or the same people placed differently. Keep each person on the same side of the screen in every scene unless the script moves them.
- Each scene starts fresh: everyone at their resting face. Set the face on the first line if the mood carries over.
- Shots are numbered straight through the whole file, so the second scene's first line might be `s04-l01`.
- To return to a room, write another scene with the same `set`.

### Rooms

| `set` | What it is | People |
| --- | --- | --- |
| `plain` | An empty wall and floor | stand |
| `home` | A living room: sofa, window, lamp, plant | stand, or up to two sit on the sofa |
| `park` | Grass, a path, a bench, two trees | stand, or up to two sit on the bench |
| `conference` | A talk on a stage: a screen above, banners, the audience's heads along the bottom | stand |
| `terrace` | An office roof terrace: sky, a pale skyline, a glass rail, decking, planters | stand |
| `kitchen` | An office kitchen: cupboards, a counter with a coffee machine, a fridge | stand |
| `reception` | A lobby: a sign above, the front desk at one side, a plant | stand |
| `cafe` | A coffee shop: menu boards, a counter with a pastry case, hanging lamps | stand |
| `corridor` | An office corridor: a door at each side, carpet, a small table | stand |
| `call` | A video call: square tiles on a dark screen, one person in each | shown from the chest up, looking at their own camera |
| `office` | An open office floor with desks | stand |
| `table` | A glass-walled meeting room | sit behind a table |
| `backdrops/x.svg` | Your own 960 × 540 SVG picture | stand |

**Sitting.** `"sit": true` on a cast entry sits that person on the sofa or bench, facing front with their knees and feet in view and their hands in their lap. Sitters share the seat in cast order, 230 units apart on the sofa and 190 on the bench; standing people in the same scene keep their usual places, so give them an `x` clear of the seat. A sitter uses the seated arm poses, so `type` works and `pockets` does not. In your own backdrop, `sit` draws the same figure wherever you place it: draw the seat's top edge about 128 × scale below the `y` you give, which is lap height.

A `medium` or `close` on one of two people sharing a seat slides sideways so the other's face is wholly out of frame, or wholly in. That leaves the subject off-centre. To frame both, use `group`.

For your own backdrop: keep the floor line near y = 400, since feet land near y = 480. Keep the band from y = 110 to y = 260 calm, since heads sit there. Use quieter colours than the characters. The strongest colours on screen should belong to people.

Rules for drawing a backdrop, from the sitcom these characters were made for. The first five fixed faults that were seen there; the rest are common practice.

1. **Same construction as the cast.** Flat fills, each edged in a slightly darker tone of itself. No black outlines, no gradients.
2. **Keep the head band empty.** Wall furniture goes above the heads or between people. Nothing may touch a head's outline in any framing.
3. **Draw only what the shot shows.** An empty chair beside a speaker reads as a missing person.
4. **Ground everyone.** Standing figures get a soft shadow from the tool. Give them a floor to stand on, not a blank field.
5. **Three layers in your head.** Things behind people, people, things in front of people. A backdrop file is only the back layer, so nothing in it can overlap a body.
6. **A prop belongs to someone and to the story.** One or two things per person, not a cluttered room.
7. **Spend the strongest colour once,** on the thing the scene is about.
8. **Few words.** Background paper, boards and screens show lines, not text. A short sign such as "ON AIR" is the limit.
9. **Depth without perspective.** Overlap, smaller size and paler, greyer tones for what is farther away. No vanishing points.
10. **One light direction** across every backdrop in a video.
11. **Check every framing** on the contact sheet: the wide, each medium, each close. Nothing important at the frame edge.

**A video call** is the `call` room. Two rules come from the user (2026-11-13) and the room follows both without being told:

- **Tiles are square.** Portrait tiles were tried first and corrected.
- **Nobody looks at anyone else.** On a call people look at their own screen. Everyone faces the camera, a listener does not turn to whoever speaks, and a speaker does not turn to whoever they address. Do not add `to` or a `look` at another person in a call.

```json
{ "set": "call", "cast": ["omar", "zoe", "kai", "nora"], "shots": [
  { "frame": "wide", "lines": [{ "who": "omar", "say": "Morning all. Quick updates, please." }] },
  { "frame": "medium", "on": "zoe", "lines": [{ "who": "zoe", "say": "Two things. Both are blocked." }] },
  { "frame": "wide", "lines": [{ "who": "kai", "say": "You are on mute.", "reactions": { "nora": "eye-roll" } }] }
] }
```

- `wide` or `group` is the gallery: every person in their own square tile, up to six, with a name tag and a green edge round whoever speaks in that shot. One to three people sit in a row; four in two rows of two; five or six in rows of three.
- `medium` or `close` on someone is their tile alone, large. A silent one needs `on`.
- Each person is cropped to their tile at the chest, like a webcam, so `height`, `sit` and `laptops` do nothing. Gestures and reactions work; a hand raised wide may leave the tile.
- People on a call are in different places: `moment`, `enter` and `exit` are refused. For someone to join or leave, start a new scene with a different cast.
- There is no shared screen in the built-in room. For a call with a slide or a board above the tiles, draw your own backdrop: put square tiles along the bottom, place each person at their tile's centre with `"mirror": false`, and give every line `"look": "camera"`.

To place people yourself, write a cast entry as `{ "id": "mira", "x": 300, "scale": 0.8 }`. The room is 960 wide. Standing people default to scale 0.8 and are spaced evenly: one person at x 480, two at 320 and 640, three at 240, 480 and 720, four at 192, 384, 576 and 768. A standing figure is about 120 wide at that scale.

Where the furniture is, so you can stand people clear of it or in front of it:

| Room | Things and their x range |
| --- | --- |
| `home` | sofa 232 to 728, side table with lamp left of 76, plant and cabinet right of 880 |
| `park` | bench 380 to 580, a tree at each edge (left of 80, right of 900) |
| `office` | a row of desks and monitors 150 to 910, behind everyone |
| `table` | the table runs the full width; each person gets a chair |

## A shot

| Field | Meaning |
| --- | --- |
| `frame` | `wide` (the whole room, head to foot), `group` (fitted across the people in `on`, usually cropping at the knee), `medium` (one person, waist up), `close` (one face). Default `wide`. |
| `on` | Who the framing is on: an id, or a list for `group`. Default: the shot's first speaker. |
| `lines` | The lines spoken in this shot, in order. |
| `hold` | Seconds to stay after the last line. Default 0.4, or what `pace` sets. A shot with no lines must have it. |
| `acting` | Timed acting with no speech. See below. |
| `zoom` | A slow push in over the shot, as a scale: `1.1` is gentle, `1.25` is strong. |
| `end` | `"fade"` fades to black at the end of the shot. Use it on the last shot only. |

## A line

| Field | Meaning |
| --- | --- |
| `who` | The speaker's id. |
| `say` | The words, as they should be spoken. With ElevenLabs, a short delivery cue in square brackets at the start directs the emotion: `"[dry, unimpressed] This is coffee."` One cue per line, a few plain words. The free voices and captions skip it. A cue counts toward the characters sent. |
| `face` | The speaker's expression from this line on. It stays until changed. |
| `pose` | A pose held for this line only. The speaker returns to rest afterwards. |
| `to` | Who they are speaking to. Default: whoever spoke last, or the nearest person. |
| `look` | Where the speaker looks instead: an id, `camera`, `down` or `up`. An id or `camera` turns the head. `down` and `up` move the eyes and tip the head a little, which reads only in a `close` or `medium`. `down` also brings the head round to face front, so a look from `down` to `camera` is only the eyes lifting. For a turn the viewer can see, have them look at another person first. |
| `do` | A small action as the line starts. See the list below. |
| `reactions` | Other people's faces, changed just after the line starts: `{ "theo": "bored" }`. A [stock reaction](#stock-reactions) name plays that reaction instead: `{ "theo": "eye-roll" }`. |
| `react` | A [stock reaction](#stock-reactions) the speaker plays as the line ends. The pause after the line is made long enough for it. |
| `pause` | Seconds of silence after the line. Default 0.35, or what `pace` sets. A longer pause before a punchline helps. |
| `hold` | Something appears in the speaker's hand as the line starts and stays until changed. It pops in, so change it on the first line of a shot, where the cut hides the change: any of the things under `holding`. `"hold": "none"` puts it away. Also works in `acting`. |
| `audio` | A recording to use for this line in place of generated speech. |
| `voice` | A free voice for this line alone: `say`, `openvoice` or `none`. The rest of the sketch keeps its engine. Use it for one robotic line inside a paid sketch. |
| `sound` | A sound file that plays just after the line: `"sfx/laugh.wav"`, or `{ "file": ..., "when": "with", "volume": 0.6, "length": 2.6 }`. See [Sound](#sound). |

Line ids are made for you: `s02-l01` is shot 2, line 1. The contact sheet and `plan.json` use them.

## Sound

**Ready sounds.** `node SKILL/scripts/sketch.mjs sounds` makes these in `sfx/` at no cost, the same every time: `ding` (a bright bell), `pop`, `beep`, `error` (a low double buzz), `buzz` (a phone vibrating), `knock`, `click`, `typing` (three seconds), `whoosh`, `tada` (three rising notes), `fail` (two falling notes) and `doorbell`. `sounds ding knock` makes only those. They are formulas FFmpeg turns into sound, so they are plain; a laugh, a crowd or a real door needs a recording or the paid command below. Their levels were measured, not heard.

Sounds are files in the working folder, by convention under `sfx/`. The tool mixes them under the voices at the times below. A full-size render stops if a file is missing. A draft carries on without it and warns, so you can place a sound in the sketch while the user decides where it comes from.

| Where | Starts | Fields |
| --- | --- | --- |
| A line's `sound` | 0.1 seconds after the line ends, or with the line when `"when": "with"` | `file`, `when`, `volume`, `length` |
| A shot's `sound` | `at` seconds after the shot starts (default 0) | `file`, `at`, `volume`, `length` |
| The sketch's `music` | The first frame, to the last | `file`, `volume` |

`volume` multiplies the file's own level: 1 leaves it alone, 0.5 halves it. `length` cuts the sound after that many seconds with a 0.4 second fade; without it the whole file plays, into the next shot if it is long. A line or shot takes one sound or a list of them.

A sound does not make room for itself. A laugh after a punchline needs a `pause` on that line about as long as the laugh, or the next line talks over it.

Starting levels that have worked: a laugh at 0.6, typing at 0.9, music at 0.2. These were set from loudness readings, not by ear, so ask the user to listen. When sounds are mixed in, the tool puts a limiter on the mix so that a loud effect cannot clip; typing once peaked at full scale.

A laugh track made by layering speech voices saying "ha ha" was called "creepy". Ask for a real-sounding one: "A large studio audience laughs warmly, heard from a distance, then it dies down. No speech, no music."

To make a sound with ElevenLabs (paid, and only when the user asks):

```sh
node SKILL/scripts/sketch.mjs sound "Two people typing on laptop keyboards in a quiet office, soft key clicks. No speech, no music." --seconds 4 --out sfx/typing.mp3
```

It prints an estimate and the account's balance and sends nothing. After the user agrees, add `--max-credits <n>`. A file that already exists is never made again unless you add `--replace`, which keeps the earlier file in `sfx/rejected/` once the new one has arrived. Describe the sound plainly and end with what to leave out ("No speech, no music"). `--kind music` asks for instrumental music of 3 to 300 seconds instead, which ElevenLabs gives only to paid plans.

Prices: ElevenLabs' documentation gave 40 credits per second of sound effect and its pricing page gave 900 credits per minute of music (both read 2026-11-12). Observed here that day: a 3 second laugh and a 4 second typing sound cost 70 credits together, well under the estimate. ElevenLabs makes music only on a paid plan. On a free plan the `sound` command checks the plan first, says so, sends nothing and exits normally, so the sketch can go ahead without music or with a music file the user provides. No music request has succeeded here yet.

## Title cards

A shot can be words on a plain dark card, for a title, a jump in time or an ending:

```json
{ "card": "Launch day", "sub": "9:02 am", "sound": "sfx/ding.wav" }
{ "card": "Three days later" }
```

It lasts 1.8 seconds unless you give `hold`. `sub` is a smaller second line. A card has no lines and shows nobody, but it still sits inside a scene, so put it in the scene before or after the jump. Keep the words short: they wrap at 24 letters a row.

## Timed acting in a shot

A shot can have `acting` whether or not it has lines. Each `acting` entry is `{ "who": id, "at": seconds from the start of the shot, ... }` with any of `face`, `pose`, `look` and `do`. A pose set here stays until the shot ends. An arm takes a third of a second to move and a head about the same to turn, so anything started in the last half second of a shot is cut off mid-move; the tool warns when that happens. Make the shot longer or start the move earlier. Silent reaction shots are where most of the comedy is, so use them: a `close` on the listener with `hold` 1.2 and one change of face.

## Stock reactions

A stock reaction is a short, pre-timed performance that any character can play and that finishes by itself. Use one wherever you would otherwise set a face and then need a second entry to undo it.

| Group | `react` | Size | Length | What happens |
| --- | --- | --- | --- | --- |
| Agreeing, warming to something | `small-nod` | mild | 1.1 s | One nod with a softer face. |
| Agreeing, warming to something | `nod-along` | mild | 1.7 s | Two unhurried nods, as if following along. |
| Agreeing, warming to something | `warm-smile` | mild | 1.4 s | A smile that arrives and fades. |
| Agreeing, warming to something | `chuckle` | medium | 1.5 s | A short laugh, then a smile. |
| Agreeing, warming to something | `ta-da` | mild | 1.5 s | Open palm and a smile: here it is. |
| Doubting | `look-up-skeptical` | mild | 1.9 s | Eyes down, then a slow doubtful look up. Stays doubtful. |
| Doubting | `side-eye` | mild | 1.4 s | A sideways look, held for a second. |
| Doubting | `not-buying-it` | mild | 2.2 s | Arms cross, one brow up. |
| Doubting | `slow-no` | mild | 1.3 s | A small shake of the head with a flat face. |
| Doubting | `slow-blink` | mild | 1.2 s | One long blink: did I hear that right? |
| Thinking | `hmm` | mild | 1.6 s | Eyes drift up while weighing it, then back. |
| Thinking | `thinking-it-over` | mild | 2.2 s | Fist under the chin for a moment. |
| Surprised | `small-surprise` | mild | 1.3 s | Brows up and eyes a little wider for a moment. No open mouth. |
| Surprised | `double-take` | mild | 1.9 s | Looks away, then back again with raised brows. |
| Surprised | `surprise` | medium | 1.5 s | Wide eyes and an open mouth for half a second, settling to raised brows. |
| Annoyed or worn down | `eye-roll` | mild | 1.4 s | Flat lids, eyes up and back down once, then as before. |
| Annoyed or worn down | `sigh` | mild | 1.6 s | Eyes close on a tired face, then open. |
| Annoyed or worn down | `rub-temple` | mild | 2 s | A hand to the temple, tired. |
| Annoyed or worn down | `stern-look` | medium | 1.6 s | A hard look, held, then let go. |
| Annoyed or worn down | `wave-off` | mild | 1.4 s | A low flick of the hand: go on then. |
| Awkward | `sheepish-glance` | mild | 1.6 s | Looks down, embarrassed, then back up. |
| Awkward | `caught-out` | mild | 1.7 s | A flicker of alarm that turns sheepish. |
| Awkward | `shrug` | mild | 1.4 s | Shoulders and palms up: no idea. |
| Awkward | `wince` | mild | 1.2 s | A quick wince that eases to a worried look. |
| Low | `deflate` | mild | 1.9 s | The face falls and the eyes drop. Stays sad. |
| To the camera | `one-wink` | mild | 1.2 s | Looks at the camera, winks once, carries on. |
| To the camera | `deadpan` | mild | 1.8 s | Turns to the camera with a flat face, holds, turns back. |
| To the camera | `glance-at-camera` | mild | 1.3 s | A look to the camera and back, face unchanged. |
| To the camera | `smug-to-camera` | mild | 1.8 s | Turns to the camera, pleased with themselves. |
| With a prop | `over-the-mug` | mild | 2 s | Lifts a mug and gives a sideways look over it. |
| With a prop | `check-phone` | mild | 2.1 s | Lifts a phone, looks down at it, puts it away. |

There are 31. Every one puts the pose back and opens the eyes again. All but two put the face back as well: `look-up-skeptical` leaves the character `skeptical` and `deflate` leaves them `sad`, because those are changes of mood. `mild` is the default choice. `medium` is for a moment the script clearly calls for. The two prop reactions bring their own mug or phone, so do not use them on a character whose file already `holds` something.

Three places take one:

```json
{ "who": "maya", "say": "But more on that later.", "look": "camera", "react": "one-wink" }
{ "who": "maya", "say": "It's basically free.", "reactions": { "dev": "eye-roll" } }
{ "frame": "close", "on": "dev", "acting": [{ "who": "dev", "at": 0.3, "react": "look-up-skeptical" }] }
```

- On a line, `react` is the speaker's and starts as the line ends.
- In `reactions`, it is a listener's and starts 0.3 seconds into the line, while the other person is still talking.
- In `acting`, it starts `at` that many seconds into the shot. A silent shot with a reaction needs no `hold`; the shot lasts until the reaction has finished.

In `acting`, `"stretch": 1.5` plays a reaction that much slower, for "a slow double take"; 0.5 to 3. A shot never cuts away in the middle of a reaction. `node SKILL/scripts/sketch.mjs reactions <id> --draft` renders every reaction on one character as a labelled reel. Add names or groups to render a few: `reactions maya doubt one-wink`. Beside the video it writes a contact sheet with one strip of seven frames per reaction, and `reactions.json`, which lists each reaction with its group, size, length, description and where it sits in the reel. If the folder has a second character, they stand out of frame so that a look to the camera shows as a turn of the head.

Most are deliberately mild, because every note so far on a reaction has been "too much". The timings were set by reading those strips, not by watching at speed, so treat a user's note on one as a reason to change the table in `scripts/sketch.mjs`. Faces change in a single frame; only head turns, nods and arm moves are eased.

## Stock gestures

A stock gesture is to someone talking what a stock reaction is to someone listening: a short, pre-timed movement of the arms that ends by itself. It never changes the face, so it sits on any line.

| Group | `gesture` | Length | What the arms do |
| --- | --- | --- | --- |
| Counting | `count-one` | 1.1 s | One finger up. |
| Counting | `count-two` | 1.1 s | Two fingers up. |
| Counting | `count-three` | 1.1 s | Three fingers up. |
| Counting | `count-to-three` | 2.2 s | Counts one, two, three on the fingers. |
| Making a point | `air-quotes` | 1.1 s | Both hands up, two fingers bending twice. |
| Making a point | `idea` | 1.2 s | One finger raised: here is a thought. |
| Making a point | `point-at` | 1 s | Points at the person they are talking to. |
| Making a point | `me` | 1 s | A finger turned to their own chest. |
| Making a point | `here-it-is` | 1.1 s | An open palm lifted beside them. |
| Making a point | `stop` | 1.1 s | A palm held out: hold on. |
| Feeling | `thumbs-up` | 1.2 s | A thumbs up. |
| Feeling | `fist-pump` | 1 s | A raised fist pulled down once. |
| Feeling | `clap` | 1.3 s | Three claps. |
| Feeling | `hands-up` | 1.3 s | Both hands up: not my fault. |
| Feeling | `shrug` | 1 s | Shoulders and palms up. |
| Feeling | `please` | 1.3 s | Hands pressed together. |
| Feeling | `dismiss` | 0.9 s | A low flick of the hand. |
| Greeting | `wave-hello` | 1.4 s | A raised hand waving side to side. |
| Stance and thinking | `hands-on-hips` | 1.8 s | Both hands on the hips, held. |
| Stance and thinking | `arms-crossed` | 1.8 s | Arms folded, held. |
| Stance and thinking | `scratch-head` | 1.5 s | A hand to the back of the head. |
| Stance and thinking | `chin-rub` | 1.6 s | A hand on the chin. |
| Hand at the face | `shh` | 1.3 s | A finger to the lips. |
| Hand at the face | `facepalm` | 1.6 s | A hand over the face. |

There are 24. Put one on a line, and say which word it lands on:

```json
{ "who": "zoe", "say": "There are three problems. Cost, time, and Walt.", "gesture": { "name": "count-to-three", "on": "Cost" } }
{ "who": "raj", "say": "He said it was, quote, fine.", "gesture": { "name": "air-quotes", "on": "fine" } }
{ "who": "walt", "say": "I heard that.", "gesture": "hands-on-hips" }
```

- **Holding something.** A one-handed gesture works while the person holds a thing: the thing moves to their other hand for the gesture. A gesture that needs both hands (`air-quotes`, `clap`, `hands-up`, `shrug`, `please`, `hands-on-hips`, `arms-crossed`) leaves nowhere for it, so it is not drawn while the gesture plays, and the tool warns. Pick a one-handed gesture for someone with a coffee.
- **A list spoken slowly.** `count-to-three` takes 2.2 seconds whatever the line does. When the line says the numbers, give each its own gesture so each lands on its word: `"gesture": [{ "name": "count-one", "on": "One" }, { "name": "count-two", "on": "Two" }, { "name": "count-three", "on": "Three" }]`.
- `"on"` is a word in the line. The gesture starts just before it, placed by how far through the line the word is. That is an estimate, not a measurement of the recording, so check the strip. On a two-sentence line in the free `openvoice` voice, air quotes set on the last sentence's second word landed after the speech had ended; one word earlier put them inside it. With ElevenLabs the estimate was about a second late: the user saw air quotes set on "everything" miss the word. **To land a gesture on a word exactly, measure the word in the recording and use `"at"`:** a speech-to-text tool with word times (Whisper) put "everything" at 1.22 to 1.82 s, and `"at": 1.0` made the fingers bend on it. Start about 0.2 s before the word, since the arms take a third of a second to rise.
- **In a `medium`, use gestures made at head height.** `point-at` (and other chest-height arms) can fall below the bottom of a waist-up frame and not show at all, as seen on 2026-11-13. `air-quotes`, `stop`, `idea`, counting and `fist-pump` show.
- Without `"on"` the gesture starts as the line does. `"at"` gives seconds from the start of the line instead.
- A line takes one gesture or a list. In `acting`, `{ "who": id, "at": seconds, "gesture": name }` plays one in a silent shot or on a listener.
- The two in the last group put a hand in front of the mouth. The tool warns if one is set on a spoken line.
- One gesture on the word that matters does more than one on every line. People whose hands never stop read as frantic.

`node SKILL/scripts/sketch.mjs gestures <id> --draft` renders every gesture on one character as a labelled reel with a strip sheet and `gestures.json`, the same way `reactions` does.

## Walking in and out

Someone can walk into the frame to their place, or out of it:

```json
{ "frame": "wide", "acting": [{ "who": "walt", "at": 0.4, "enter": "right" }], "lines": [ ... ] }
{ "frame": "wide", "acting": [{ "who": "walt", "at": 0.3, "exit": "left" }] }
```

- `enter` and `exit` take `left` or `right`, the side of the frame. In `acting`, the walk starts at `at`; other people's lines carry on over it, and the walker's own first line waits until they have arrived. On a line, the speaker walks in as they start talking.
- Anyone whose first move in a scene is `enter` is out of frame from the start of that scene. After `exit` they stay out, in later shots too, until they `enter` again.
- The walk takes about one to two and a half seconds, depending on how far they have to go, and the shot waits for it.
- Use a `wide` so the walk is in view. A person walks with a simple step and a bob, facing the way they go. They cannot walk toward or away from the camera, sit down or stand up.
- Sitters cannot walk. A line spoken by someone who is out of frame gets a warning.

## Moments two people share

Two standing people can do something together. Both step toward each other until their hands can meet, reach, hold, and step back to their places.

| `moment` | What happens |
| --- | --- |
| `high-five` | They step together and slap raised palms. |
| `handshake` | They step together and shake hands. |
| `fist-bump` | They step together and touch fists. |
| `hand-over` | They step together, one holding something out and the other taking it. Nothing changes hands in the drawing. |

```json
{ "who": "zoe", "say": "We did it.", "moment": "high-five", "with": "raj" }
{ "frame": "wide", "acting": [{ "who": "raj", "at": 0.4, "moment": "handshake", "with": "zoe" }] }
```

Two people of very different `height` can do these, but the taller one reaches down and it looks awkward; prefer pairs within about 0.1 of each other. On a line the moment starts as the line ends. Show it in a `wide` or a `group` on the two of them. Each lasts about two seconds. In `hand-over` nothing actually changes hands: one holds an arm out and the other reaches. Not for sitters or the table room.

## Vocabulary

**A wink is a reaction, not a face.** `"face": "wink"` keeps one eye shut until another face replaces it, which a viewer described as "the eyes keep getting closed". Use `"react": "one-wink"`: open eyes, a wink of 0.4 seconds, open eyes. The tool warns about a held wink. The automatic blink is held off around a wink and around `eyes-closed`, because a blink landing on a wink read as "both eyes closed". A half-lidded face such as `smug` or `bored` just before or after a wink also reads as eyes closing, so the stock wink goes through `serene`.

**Expressions** (`face`, `reactions`, `resting`): `neutral`, `serene`, `happy`, `laugh`, `offer`, `smug`, `wink`, `defiant`, `skeptical`, `sideeye`, `eyeroll`, `thinking`, `stern`, `angry`, `annoyed`, `bored`, `tired`, `worried`, `curious` (a mild surprise: brows up, mouth closed), `sheepish`, `sad`, `pained`, `surprised`, `shocked`. Every character's sheet shows all of them.

**Poses for gestures.** Each stock gesture is built from arm poses that can also be used directly as a `pose`: `count1`, `count2`, `count3`, `quotes`, `thumb`, `stop`, `handsup`, `hello`, `idea`, `pump`, `hips`, `scratch`, `clap`, `beg`, `shh`, `facepalm`, `chinrub`. Prefer the gesture, which times itself and puts the arms back.

**Poses** (`pose`): `rest`, `offer` (open palm up), `self` (points at own chest), `wave` (low flick: go on then), `shrug`, `thinker` (fist under chin), `point` (at someone), `temple` (rubbing it), `pinch` (bridge of nose), `phone` (lifts a phone to look at it), `sip` (from a mug), `cross` (arms crossed). `phone` and `sip` bring their own prop, so do not use them on a character whose file already `holds` one. Standing only: `pockets`. Seated only: `type`.

**Actions** (`do`): `nod`, `shake-head`, `eyeroll`, `lean-in`, `step-forward`, `half-rise` and `sit` (seated), `eyes-closed`, `eyes-open`.

**Automatic.** You do not direct these: listeners turn to whoever is speaking, speakers turn to whoever they address, everyone blinks and breathes, speakers shift on each phrase and now and then lift a hand, and listeners nod.

## Directing well

- **Open wide** so the viewer learns who is where. Then cut closer.
- **Change the shot when something changes:** a new speaker of note, a punchline, a reaction. Six lines in one wide shot reads as a slideshow.
- **Punchlines land in a `close` or `medium`.** Follow with a silent reaction shot of the other person.
- **Cut to the listener while the line is still going.** The directed cut the user called "So much better" was built on reactions: restrained faces, coverage chosen by who is reacting, and beats placed on the spoken words. Put a line in a shot framed `on` the listener, or give the listener a stock reaction in `reactions`.
- **Keep a neighbour out of the edge of a single.** In a `medium` or `close`, another person's face is either fully in frame or fully out. If a slice shows, move them apart with `x` in the cast, or use `group`.
- **Small acting needs a close shot.** In a `wide` a head is about 25 pixels tall on a phone, and an eye-roll there does not register.
- **Keep the speaking mouth clear.** A raised arm, a mug, a phone or a laptop lid in front of a talking mouth has been a fault more than once. Check the `point` pose points toward the listener, not away.
- **A look to the camera is brief, comes after the odd line, and is rationed.** Use `glance-at-camera` or `deadpan`. This is the sitcom's proposed style, not yet approved by the user.
- **Give each line one idea:** a face or a pose, rarely both, never the same one twice in a row.
- **Keep lines short.** Under about fifteen words each. Long lines hold one framing for too long.
- **Keep faces small.** `neutral`, `serene`, `skeptical`, `sideeye`, `thinking`, `smug` and `bored` carry most lines. `shocked`, `surprised`, `laugh` and `wink` read as unnatural on an ordinary line; a viewer flagged both a wide-eyed reaction and a wink in the first long sketch. Use them once, where the script clearly calls for it.
- **Keep sketches short.** Four to ten shots and under a minute is the range with the most testing. The longest rendered so far is 104 seconds in five scenes.

## Checklist for the contact sheet

The contact sheet shows one frame per line and one per silent shot. A silent shot that plays a stock reaction is pictured at the height of the reaction and labelled with its name, and no picture is taken on a blink. It still shows one settled frame. A fault in the movement between two poses does not show there. For any shot with a pose change or a turn you are unsure of, look at the frames in a row: `ffmpeg -ss <seconds> -t 1 -i out/<name>-draft/sketch.mp4 -vf "fps=12,scale=320:-1,tile=6x2" -frames:v 1 strip.png`.

Open the render's `contact-sheet.png`. There is one picture per line and one per silent shot.

- **Is the speaker in frame**, with a mouth that is open or moving?
- **Is anyone cut off** at the frame edge, or a neighbour's edge poking into a single? Space the cast further apart with `x`. Two people at 285 and 690 keeps mediums clean and still leaves `group` tighter than `wide`.
- **Does each face match the line?** A happy face on a complaint is usually a missing `face`.
- **Are people looking at each other?** If not, set `to` or `look`.
- **Do two shots in a row look the same?** Change the framing or cut one.
- **Does a room object touch a head outline?** Move the person with `x`.

The picture for each line is taken at an open mouth near the middle of the line. A closed mouth there means the line has no sound or no mouth shapes, so check the render's warnings.

The contact sheet cannot show movement or timing. For `do` actions, pose changes and pauses, pull a strip of frames from the video and look at that. This takes twelve frames in a row starting at second 4.5:

```sh
ffmpeg -v error -y -ss 4.5 -i out/<name>-draft/sketch.mp4 -frames:v 1 -vf "scale=320:-1,tile=6x2" strip.png
```

Check pauses before punchlines, and that silent shots are long enough to read (about 1.2 seconds) and not longer.

<a id="captions"></a>

## Captions

Captions are drawn over the finished picture, so they stay in place when the camera moves.

| Style | Look | Rows | Speaker's name |
| --- | --- | --- | --- |
| `bar` | A dark band the full width of the screen | up to 2 | shown |
| `box` | A rounded dark box that hugs the words | up to 2 | shown |
| `outline` | Bold white words with a dark edge | up to 2 | not shown |
| `pop` | A few big capital words at a time, the word being said in yellow | 1 | not shown |

Write a style name to caption every line, or an object to change more:

```json
"captions": { "style": "box", "show": "always", "position": "top", "names": false }
```

| Field | Values |
| --- | --- |
| `style` | `bar` (the default), `box`, `outline`, `pop` |
| `show` | `always`, `never`, or `auto`: only lines with no recording. Default `always` when you name a style. |
| `position` | `bottom` (the default) or `top` |
| `names` | `true` or `false`. The default depends on the style. |
| `length` | `full` (the default) or `short`: one row of a few words at a time, which is easier to follow on long lines. |

`--captions <style>`, `--captions auto` or `--captions off` on `render` and `say` overrides the sketch for one run, so you can try a style without editing the file.

- **A long line is shown in parts.** Each part stays up for a share of the line's time in proportion to its letters. The same estimate picks the yellow word in `pop`. It follows the voice closely on short lines and can drift by a word or two on long ones, so keep lines short when using `pop`.
- Words in square brackets are not shown.
- **Every render also writes `captions.srt`** beside the video: one entry per screen of captions, split by the sketch's caption setting (style, `length`, `names`) and timed the same way. It is written even with `--captions off`, so the picture can stay clean while a site such as YouTube shows the words. It is the same estimate as the drawn captions, so check it against a line with long pauses.
- **Check the contact sheet.** In a `close` the chin and collar are near the bottom of the frame, so bottom captions can sit over them. Use `"position": "top"` for a sketch that is mostly close-ups.
- `outline` and `pop` were checked with librsvg 2.60. If the dark edge covers the letters, your librsvg is too old to draw the edge underneath them (`rsvg-convert --version`); use `bar` or `box`.

<a id="voice"></a>

## Voice

Recordings are kept in `voice/` under a name made from the words, the voice and the engine. Rendering again reuses them. Changing a line's words makes a new recording for that line only, so a paid line is never charged twice. A paid reply is written to `voice/received/` as soon as it arrives and removed once its take is saved. If a run stops in between (ffmpeg failing, say), the next run uses the held reply, sends nothing for that line, needs no `--max-chars` for it, and says how many replies it recovered on its first line of output.

Choose the engine with `--voice <engine>` or `"voice"` at the top of the sketch. Set each character's voice in their file, one entry per engine:

```json
"voice": { "say": "Daniel", "openvoice": "EN-BR", "elevenlabs": "<voice id>", "sarvam": "simran_en_customer" }
```

### Free

| Engine | Notes |
| --- | --- |
| `say` | Mac only, and the default there. Use the exact name `sketch.mjs voices` prints. Plain speaking voices that are usually installed: Samantha, Kathy, Karen and Moira (women), Daniel, Fred, Ralph and Albert (men). The list also has novelty voices such as Bells and Boing; avoid them unless asked. Without a setting, each character gets a different plain voice. |
| `openvoice` | Runs on this machine once installed. Voices: `EN-US`, `EN-BR`, `EN_INDIA`, `EN-AU`, `EN-Default`. Without a setting, characters take them in that order. It reads plain words only, in English. The first line after a restart takes longer while the model loads. `"openvoiceSpeed"` at the top of the sketch, from 0.8 to 1.3 (default 1), sets the speaking rate; a new speed makes new recordings, at no cost. On 2026-11-13, 1.1 took a 30-line sketch from 118.0 to 111.6 seconds; the user had asked for "slightly faster". |
| `none` | Silent, with captions. Durations are estimated from word count and mouths are guessed from syllables. Good for checking staging quickly. |
| `"audio"` on a line | Any recording FFmpeg can read. Use this for another speech tool or a real voice. |

**Installing openvoice.** It is optional. Only install it when the user asks, and tell them first that it downloads about 2 GB and takes several minutes. It needs [uv](https://docs.astral.sh/uv/).

```sh
bash SKILL/scripts/install-openvoice.sh
```

It installs MeloTTS, the speech model OpenVoice V2 is built on, into `~/.2d-character-sketch/openvoice` with its own Python, speaks a test line, and only then marks itself ready. Set `OPENVOICE_HOME` to use another folder. Delete the folder to remove it. `doctor` shows whether it is ready.

### Paid

| Engine | Key name | Voice setting | Notes |
| --- | --- | --- | --- |
| `elevenlabs` | `ELEVENLABS_API_KEY` | A voice id from the user's ElevenLabs voice library | The most realistic voice here, and the one to recommend when a sketch should sound like real people. The model defaults to `eleven_v4`. Set `"elevenlabsModel"` at the top of the sketch for another. `"elevenlabsSpeed"` there, from 0.7 to 1.2, is sent to ElevenLabs as the speaking speed, and a new speed makes new recordings, which are paid for again. **The default model, `eleven_v4`, ignores it:** on 2026-11-12 speeds 1.0, 1.1 and 1.2 each returned a 2.16 second take of the same line, three paid takes for no change. Do not use it to shorten a v4 sketch. To tighten pace, use `"pace": "quick"`, shorter pauses, or cut words. Charged in credits, one per character of text including delivery cues (observed 2026-11-12: 53 characters, 53 credits). The pricing page that day listed a free plan of 10,000 credits a month with no commercial licence, and Starter at $6 a month for 30,000 credits, which is $0.20 per 1,000. |
| `sarvam` | `SARVAM_API_KEY` | A speaker name from [Sarvam's voice list](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices) | The model defaults to `bulbul:v4-flash` and the language to `en-IN`. Set `"sarvamModel"` or `"language"` (for example `"hi-IN"`) at the top of the sketch. Speaker names differ between models. Sarvam's price list on 2026-11-11 was ₹1 per 1,000 characters for `bulbul:v4-flash` and ₹3 for `bulbul:v3`, pay as you go. |

A good order of work: settle the lines, staging and timing with a free voice, then generate the paid voice once. Changing a line's words after that pays for that line again.

Steps for either one:

1. Use it only when the user asks for it.
2. **The key and the balance, before any drawing.** Run `doctor`. If it reports no key, copy `SKILL/.env.example` to `.env.local` in the working folder (the example names each key and holds none), then ask the user to open `.env.local` and paste their key after the `=` on its line. A key already in the environment also works, and so does `~/.2d-character-sketch/keys.env` from earlier versions. For ElevenLabs then run `credits`, which sends the key and nothing else and prints the credits left. If that is less than the `script` command says the sketch needs, tell the user now. A new key made on the same account has the same balance; the plan on that account has to change. A key already in the environment also works. Do not ask them to paste the key into the chat, and do not write or print it yourself.
3. If the key file is inside a git repository, it must be listed in `.gitignore`. The tool stops and says so if it is not. Adding that line to `.gitignore` is something you can do.
4. Put a voice in each speaking character's file. For ElevenLabs, run `voices`: with the key in place it lists every voice on the account as id, name, kind and a few words about it. Show the user the names and let them choose; you copy the ids. The tool names every character still missing one.
5. Run once without `--max-chars`. The tool stops and prints how many characters of text the missing lines would send and an estimated cost. For ElevenLabs it also asks the account how many credits are left. No line of text is sent.
6. Tell the user that number and the estimate in money, and wait for a yes.
7. **One line first.** Send the sketch's shortest line by itself: `say <id> "<the line exactly as written, cue included>" --voice elevenlabs --max-chars <its length>`. Check the charge and the recording's length. `render` then reuses that recording, because a take is kept under its exact text, voice and model, so the test line is not paid for twice.
8. Run `render` with `--max-chars <that number or the user's limit>`. The tool sends only lines that have no recording yet, and stops if the provider refuses one. Lines already made are kept.
9. `run.json` records the characters sent, and the credits charged when the provider reports them.
10. **Read the `LISTEN` list** the render prints, also kept as `listen` in `run.json`. See below.

On ElevenLabs' free plan, voices from its Voice Library are refused (error 402); use its premade voices. The free plan also carries no commercial licence, which matters for a video that promotes something. Say both before a paid run on a free account.

ElevenLabs was first run end to end on 2026-11-12: a 53 character test line, then two sound effects. Delivery cues were not read aloud. Whether a cue changes the delivery has not been judged by ear. Sarvam has not been run; only its refusals (no key, no voice, no cap, an unignored key file) were tested. In a new project treat the first paid run as a test: one short line first, then check the charge and the recording's length.

**Lip sync.** A mouth that is shut while the voice is loud, or moving in a silence, is the first thing that makes a video look amateur. Every render prints a `LIP SYNC` line and keeps the detail in `run.json` under `lipSync`:

| It reports | Meaning | What to do |
| --- | --- | --- |
| Lines matched to the sounds | Rhubarb read the recording and chose a mouth shape for each sound | Nothing |
| Lines following loudness only | Rhubarb was not found, so the mouth opens and closes with the volume | Fine for a draft. Before anything is called finished, run `install-rhubarb.sh` (ask the user first) or set `RHUBARB` to a copy they have, and render again. Existing recordings are measured again automatically, at no cost: on 2026-11-13, 30 ElevenLabs takes were matched this way without sending anything. |
| Lines guessed from the words | The line has no recording, so the mouth is timed from syllable counts | Record the line, or accept it only in a silent captioned draft |
| A flagged line | The mouth is at rest for more than 15% of the loud frames or for 0.3 seconds at a stretch, or open for more than half of the silent frames | Tell the user to watch that line. Usual causes: a recording replaced by hand without its `.json`, or a user's own `audio` file with noise under the speech. |

A full-size render with any line that is not matched to the sounds says `NOT READY TO SHOW AS FINISHED`. Pass that on; do not call the video done. Measured on 2026-11-12: across 20 ElevenLabs and 21 Mac-voice recordings read by Rhubarb, no loud frame had a resting mouth for more than 0.04 seconds. Rhubarb is built for English; in other languages its shapes are approximate, and this check can only confirm the mouth moves when there is sound.

**Recordings to listen to.** A generated voice can put more in a recording than the words: on 2026-11-12 ElevenLabs spoke the five-word line "So, what's the big deal?" twice in one take, and did it again when asked a second time. Pictures do not show this and an agent cannot hear it, so every render measures each generated recording and lists the doubtful ones under `LISTEN`:

| Sign | Flagged when | What was measured that day |
| --- | --- | --- |
| Slow for its words | A line of four or more words runs over 0.6 seconds per word | 19 good takes ran 0.28 to 0.51; the two doubled takes 0.66 and 0.72 |
| A very short line that runs long | Under four words and more than twice its estimated length | not seen yet; a guard for short lines |
| An unexplained silence | More silences of 0.45 seconds or longer inside the recording than pause marks (`, . ? ! … ; : -`) in the words | the doubled takes had a 0.7 second gap |

A flag means "play this one", not "this is wrong". Tell the user the line ids and words.

**If a speech-to-text tool is already on the machine, transcribe the takes.** It does not replace the user's ear, but it can show whether a flagged take holds extra or repeated words. On 2026-11-13 a local Whisper model (`small.en`, through faster-whisper) transcribed all 30 ElevenLabs takes of one sketch. The four flagged takes held exactly their words, and were slow from delivery: a pause after "Great!", a drawn-out "Hypothetically?", a laugh before "It hallucinated!". Compare words loosely: Whisper writes numbers as digits ("47" for "forty seven") and mishears names ("auto" for "Otto"). Install nothing for this without asking.

**Replacing a take.** A recording is kept under its exact text, voice and model, so an unchanged line is reused forever, good or bad. There are two ways to get a new one:

| The take is wrong because | Do this | Why |
| --- | --- | --- |
| Words are repeated, added or garbled | Shorten or remove the line's delivery cue, or reword the line, and render again | The same text returned the same fault on the next try (47 credits for nothing on 2026-11-12). Without the cue the next take was right. New text makes a new recording by itself. |
| The delivery is off but the words are right, and the user wants another try at the same text | `render <sketch> --voice elevenlabs --retake s03-l01 --max-chars <n>` | Records only that line again. Several ids are separated by commas. |

Before either one, tell the user the cost: that line's characters, cue included. Run without `--max-chars` to have the tool print it. With `--retake`, the current recording stays in place until the cap is agreed, then moves to `voice/rejected/` as `<name>-take1.wav` and `.json`; `run.json` lists it under `voice.rejected`. A line that plays the user's own `audio` file cannot be retaken. Short lines with a delivery cue may be most at risk of repeats; that is a guess from one line and three takes.

**Mouth shapes.** With [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) installed, mouths match the sounds spoken. The tool looks for it in `RHUBARB` (a path), then on the PATH, then in `~/.2d-character-sketch/rhubarb` (or `RHUBARB_HOME`), which is where `bash SKILL/scripts/install-rhubarb.sh` puts it. The script downloads the official 1.14.0 release (87 MB), checks its size (and on a Mac its SHA-256), keeps the program, its speech models and licence (about 90 MB), and proves it on a test tone. The Mac build is for Intel chips and runs on Apple silicon through Rosetta; the script stops and says so if Rosetta is missing. Run it only with the user's yes. Rhubarb is built for English, so for other languages expect approximate shapes. Without it the tool opens and closes the mouth with the loudness of the recording. That is in time with the voice but less exact, and the render prints a warning saying so.

## What a render leaves

| File | Use |
| --- | --- |
| `out/<name>/sketch.mp4` | The video: 1920 × 1080 at 24 frames a second. With `--draft` it is 960 × 540 and everything in this table is under `out/<name>-draft/`. |
| `out/<name>/contact-sheet.png` | The review picture. Look at it first. |
| `out/<name>/plan.json` | The frozen frame plan: every shot's frames, camera and acting, and every line's timing and mouth shapes. Read it to find out why something happened when it did. |
| `out/<name>/captions.srt` | Every spoken line as a subtitle file, timed like the drawn captions. Upload it with the video to a site that shows its own captions. |
| `out/<name>/run.json` | The receipt: sizes, counts of scenes, shots, lines and sounds, voice engine, characters sent to a paid voice, credits charged, warnings. |

The tool checks the finished video's frame count, size and sound against the plan, and fails loudly if they differ.
