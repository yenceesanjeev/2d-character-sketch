# Writing a sketch

A sketch is one file, `sketches/<name>.json`: a room, a cast, and a list of shots. Each shot is one camera framing that holds some lines or a silent beat. The tool times everything from the recordings, so you never write timestamps for speech.

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
| `set` | The room: `plain`, `home`, `park`, `office`, `table`, or the path of an SVG backdrop. Default `plain`. |
| `cast` | Character ids from screen left to screen right. Everyone stays in place for the whole sketch. |
| `shots` | The shots, in order. |
| `voice` | `say`, `openvoice`, `elevenlabs`, `sarvam` or `none`. The `--voice` option overrides it. |
| `language` | The language Sarvam speaks, such as `en-IN` or `hi-IN`. Default `en-IN`. Other engines ignore it. |
| `captions` | `true` always, `false` never, or `"auto"` (the default): only on lines with no recording. |

### Rooms

| `set` | What it is | People |
| --- | --- | --- |
| `plain` | An empty wall and floor | stand |
| `home` | A living room: sofa, window, lamp, plant | stand |
| `park` | Grass, a path, a bench, two trees | stand |
| `office` | An open office floor with desks | stand |
| `table` | A glass-walled meeting room | sit behind a table |
| `backdrops/x.svg` | Your own 960 × 540 SVG picture | stand |

For your own backdrop: keep the floor line near y = 400, since feet land near y = 480. Keep the band from y = 110 to y = 260 calm, since heads sit there. Use quieter colours than the characters. The strongest colours on screen should belong to people.

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
| `hold` | Seconds to stay after the last line. A shot with no lines must have it. |
| `acting` | Timed acting with no speech. See below. |
| `zoom` | A slow push in over the shot, as a scale: `1.1` is gentle, `1.25` is strong. |
| `end` | `"fade"` fades to black at the end of the shot. Use it on the last shot only. |

## A line

| Field | Meaning |
| --- | --- |
| `who` | The speaker's id. |
| `say` | The words, as they should be spoken. |
| `face` | The speaker's expression from this line on. It stays until changed. |
| `pose` | A pose held for this line only. The speaker returns to rest afterwards. |
| `to` | Who they are speaking to. Default: whoever spoke last, or the nearest person. |
| `look` | Where the speaker looks instead: an id, `camera`, `down` or `up`. An id or `camera` turns the head. `down` and `up` move the eyes and tip the head a little, which reads only in a `close` or `medium`. |
| `do` | A small action as the line starts. See the list below. |
| `reactions` | Other people's faces, changed just after the line starts: `{ "theo": "bored" }`. |
| `pause` | Seconds of silence after the line. Default 0.35. A longer pause before a punchline helps. |
| `audio` | A recording to use for this line in place of generated speech. |

Line ids are made for you: `s02-l01` is shot 2, line 1. The contact sheet and `plan.json` use them.

## Acting in a silent shot

Each `acting` entry is `{ "who": id, "at": seconds from the start of the shot, ... }` with any of `face`, `pose`, `look` and `do`. A pose set here stays until the shot ends. Silent reaction shots are where most of the comedy is, so use them: a `close` on the listener with `hold` 1.2 and one change of face.

## Vocabulary

**Expressions** (`face`, `reactions`, `resting`): `neutral`, `serene`, `happy`, `laugh`, `offer`, `smug`, `wink`, `defiant`, `skeptical`, `sideeye`, `eyeroll`, `thinking`, `stern`, `angry`, `annoyed`, `bored`, `tired`, `worried`, `sheepish`, `sad`, `pained`, `surprised`, `shocked`. Every character's sheet shows all of them.

**Poses** (`pose`): `rest`, `offer` (open palm up), `self` (points at own chest), `wave` (low flick: go on then), `shrug`, `thinker` (fist under chin), `point` (at someone), `temple` (rubbing it), `pinch` (bridge of nose), `phone` (lifts a phone to look at it), `sip` (from a mug), `cross` (arms crossed). `phone` and `sip` bring their own prop, so do not use them on a character whose file already `holds` one. Standing only: `pockets`. Seated only: `type`.

**Actions** (`do`): `nod`, `shake-head`, `eyeroll`, `lean-in`, `step-forward`, `half-rise` and `sit` (seated), `eyes-closed`, `eyes-open`.

**Automatic.** You do not direct these: listeners turn to whoever is speaking, speakers turn to whoever they address, everyone blinks and breathes, speakers shift on each phrase and now and then lift a hand, and listeners nod.

## Directing well

- **Open wide** so the viewer learns who is where. Then cut closer.
- **Change the shot when something changes:** a new speaker of note, a punchline, a reaction. Six lines in one wide shot reads as a slideshow.
- **Punchlines land in a `close` or `medium`.** Follow with a silent reaction shot of the other person.
- **Give each line one idea:** a face or a pose, rarely both, never the same one twice in a row.
- **Keep lines short.** Under about fifteen words each. Long lines hold one framing for too long.
- **Keep sketches short.** Four to ten shots and under a minute is the range this has been tested in.

## Checklist for the contact sheet

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

<a id="voice"></a>

## Voice

Recordings are kept in `voice/` under a name made from the words, the voice and the engine. Rendering again reuses them. Changing a line's words makes a new recording for that line only, so a paid line is never charged twice.

Choose the engine with `--voice <engine>` or `"voice"` at the top of the sketch. Set each character's voice in their file, one entry per engine:

```json
"voice": { "say": "Daniel", "openvoice": "EN-BR", "elevenlabs": "<voice id>", "sarvam": "simran_en_customer" }
```

### Free

| Engine | Notes |
| --- | --- |
| `say` | Mac only, and the default there. Use the exact name `sketch.mjs voices` prints. Plain speaking voices that are usually installed: Samantha, Kathy, Karen and Moira (women), Daniel, Fred, Ralph and Albert (men). The list also has novelty voices such as Bells and Boing; avoid them unless asked. Without a setting, each character gets a different plain voice. |
| `openvoice` | Runs on this machine once installed. Voices: `EN-US`, `EN-BR`, `EN_INDIA`, `EN-AU`, `EN-Default`. Without a setting, characters take them in that order. It reads plain words only, in English. The first line after a restart takes longer while the model loads. |
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
| `elevenlabs` | `ELEVENLABS_API_KEY` | A voice id from the user's ElevenLabs voice library | The model defaults to `eleven_v4`. Set `"elevenlabsModel"` at the top of the sketch for another. Charged in credits, about one per character of text. |
| `sarvam` | `SARVAM_API_KEY` | A speaker name from [Sarvam's voice list](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices) | The model defaults to `bulbul:v4-flash` and the language to `en-IN`. Set `"sarvamModel"` or `"language"` (for example `"hi-IN"`) at the top of the sketch. Speaker names differ between models. Sarvam's price list on 2026-11-11 was ₹1 per 1,000 characters for `bulbul:v4-flash` and ₹3 for `bulbul:v3`, pay as you go. |

Steps for either one:

1. Use it only when the user asks for it.
2. **The key.** Run `doctor`. If it reports no key, ask the user to add it themselves: one line, `ELEVENLABS_API_KEY=...` or `SARVAM_API_KEY=...`, in a file named `.env.local` in the working folder, or in `~/.2d-character-sketch/keys.env` to cover every project. A key already in the environment also works. Do not ask them to paste the key into the chat, and do not write or print it yourself.
3. If the working folder is a git repository, `.env.local` must be listed in `.gitignore`. The tool stops and says so if it is not. Adding that line to `.gitignore` is something you can do.
4. Put a voice in each speaking character's file.
5. Run once without `--max-chars`. The tool stops and prints how many characters of text the missing lines would send. Nothing is sent.
6. Tell the user that number, and what it costs if you know their plan, and wait for a yes.
7. Run again with `--max-chars <that number or the user's limit>`. The tool sends only lines that have no recording yet, and stops if the provider refuses one. Lines already made are kept.
8. `run.json` records the characters sent, and the credits charged when the provider reports them.

Neither paid engine had been run end to end when this was written. Their refusals (no key, no voice, no cap, an unignored key file) were tested. Treat the first paid run as a test: one short line first, then check the recording.

**Mouth shapes.** With [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) on the PATH, or its location in the `RHUBARB` environment variable, mouths match the sounds spoken. Rhubarb is built for English, so for other languages expect approximate shapes. Without it the tool opens and closes the mouth with the loudness of the recording. That is in time with the voice but less exact, and the render prints a warning saying so.

## What a render leaves

| File | Use |
| --- | --- |
| `out/<name>/sketch.mp4` | The video: 1920 × 1080 at 24 frames a second. With `--draft` it is 960 × 540 and everything in this table is under `out/<name>-draft/`. |
| `out/<name>/contact-sheet.png` | The review picture. Look at it first. |
| `out/<name>/plan.json` | The frozen frame plan: every shot's frames, camera and acting, and every line's timing and mouth shapes. Read it to find out why something happened when it did. |
| `out/<name>/run.json` | The receipt: sizes, counts, voice engine, characters sent to a paid voice, warnings. |

The tool checks the finished video's frame count, size and sound against the plan, and fails loudly if they differ.
