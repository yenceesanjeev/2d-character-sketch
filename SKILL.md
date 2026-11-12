---
name: 2d-character-sketch
description: Make simple 2D cartoon characters and short talking sketch videos, drawn entirely in code on this machine. Use when asked to design or build a cartoon character, draw a character sheet, make a character talk or say a line, animate a dialogue, turn an idea into a short script, direct a script the user already has, add captions, or make a short comedy sketch, skit, explainer or animatic with one or more characters. Produces PNG character sheets and MP4 videos with lip-synced speech and optional captions. Not for photoreal, 3D or AI-generated video.
---

# 2D character sketch

One tool, `scripts/sketch.mjs` in this skill's folder, does five jobs:

| Job | You write | You run | You get |
| --- | --- | --- | --- |
| Build a character | `characters/<id>.json` | `sheet` | `characters/<id>.sheet.png` |
| Make it talk | nothing | `say <id> "words"` | `out/say-<id>-<first words>/sketch.mp4` |
| Prepare a script | `sketches/<name>.json` | `script sketches/<name>.json` | The sketch as a readable script, with its estimated length |
| Make a sketch | `sketches/<name>.json` | `render sketches/<name>.json` | `out/<name>/sketch.mp4` |
| Add captions | `"captions": "pop"` in the sketch | `render`, or add `--captions pop` | The same video with the words on screen |

Every picture is flat shapes written as SVG by code, so a render costs nothing and the same input always gives the same video. A character is about ten lines of colours and choices. Eyes, mouths, hands, expressions and poses are shared by everyone, which is why any new character can act straight away.

## Before the first run

Run the check once. `SKILL` below means this skill's folder.

```sh
node SKILL/scripts/sketch.mjs doctor
```

It needs Node 20 or newer, `rsvg-convert` (from librsvg) and FFmpeg, and prints the install command for anything missing. Ask before installing software. There are no npm packages to install.

Run every command from the user's working folder, or add `--dir <folder>` anywhere after the command name. The tool reads and writes only these places there:

```
characters/   one <id>.json per character, and the sheets drawn from them
sketches/     one <name>.json per sketch
voice/        recordings, kept so an unchanged line is never generated twice
out/          one folder per render: sketch.mp4, contact-sheet.png, plan.json, run.json
```

A `--draft` render goes to its own folder, `out/<name>-draft/`, so it never replaces a full-size one. Rendering the same sketch again at the same size does replace the last one.

## Build a character

Read [references/character.md](references/character.md) first. It has the fields, the look rules and the faults to check for.

1. Write `characters/<id>.json`. Start from the example in the reference and change only what makes this person different.
2. Draw the sheet: `node SKILL/scripts/sketch.mjs sheet <id>`. With no id it draws every character.
3. **Open the PNG and look at it yourself.** Check the turnaround, the resting face and a few expressions against the checklist in the reference.
4. Fix and redraw until it reads well. Do several passes before showing anyone.
5. Show the sheet, and say what you changed and what is still weak.

With two or more characters, every `sheet` run also redraws `characters/cast.png`, everyone side by side. Use it to check they read as different people: different silhouette, hair and top colour.

## Make a character talk

```sh
node SKILL/scripts/sketch.mjs say mira "It identifies as tea." --face smug --pose offer
```

Options: `--face <expression>`, `--pose <pose>`, `--frame wide|medium|close`, `--set <room>`, `--draft`. The names are listed on the character's sheet and in [references/sketch.md](references/sketch.md). Use `--draft` while trying faces and poses, then run once without it for the clip you hand over. Each different line gets its own folder, named from its first words. Look at the `contact-sheet.png` in that folder before showing the video.

## Prepare the script

Read [references/script.md](references/script.md) first. Do this before any sketch, whichever way the request arrives:

- **The user gives an idea.** Turn it into a script, show it in the chat as a readable script, and ask for feedback with one pointed question. Revise until they say it is good. Build nothing before that.
- **The user gives a script.** Keep their words. Fill in the rest: cast, set, tone, pace, shots, faces, pauses and silent reactions. Say what you chose.

`node SKILL/scripts/sketch.mjs script sketches/<name>.json` prints any sketch file as a readable script with its estimated length. Show that, not the JSON. It works before the characters are built.

## Make a sketch with several characters

Read [references/sketch.md](references/sketch.md) first. It has the file format, the rooms, the framings, the acting vocabulary and the voice rules.

1. Prepare the script (above), then build each character and check `characters/cast.png`.
2. Write `sketches/<name>.json`: the room, the cast from left to right, and a list of shots. Each shot has a framing and its lines.
3. Render a draft, which is half size and fast: `node SKILL/scripts/sketch.mjs render sketches/<name>.json --draft`.
4. **Open `out/<name>-draft/contact-sheet.png` and look at it.** It has one picture per line. Check framing, faces and who is looking at whom.
5. Fix the sketch file and render the draft again. Do not change `scripts/` to fix one sketch.
6. Render full size (drop `--draft`) and give the user the video path.

A mistake in a file stops the run with a list of every problem and the allowed values. Fix them all and run again.

## Captions

Captions put each line's words on screen. Without a setting they appear only on lines that have no recording. To caption every line, set `"captions"` at the top of the sketch to a style, or pass `--captions <style>` to `render` or `say`.

| Style | Look | Good for |
| --- | --- | --- |
| `bar` | A dark band across the screen, with the speaker's name | Drafts and reviews |
| `box` | A rounded dark box that hugs the words, with the name | Ordinary subtitles |
| `outline` | Bold white words with a dark edge, no background | Keeping the picture clear |
| `pop` | A few big words at a time, the current word in yellow | Short clips for phone feeds |

`"captions": { "style": "box", "position": "top", "names": false }` moves them to the top or drops the names. `--captions off` removes them. Check captions on the contact sheet: nothing should cover a face, and in a `close` the chin is near the bottom, so use `"position": "top"` there or a smaller style. Details are in [references/sketch.md](references/sketch.md#captions).

## Voice

Use the free default unless the user names another voice. They choose by saying so ("use OpenVoice", "use ElevenLabs", "use Sarvam"), and you pass `--voice <engine>`.

**Recommend ElevenLabs when the sketch should sound realistic.** The free voices read flatly, and delivery is most of what makes a line funny or believable. If the user wants a sketch that sounds like real people, or plans to publish it, say once that ElevenLabs is the voice to use for that, and that it is paid. Then let them choose. Do the staging and timing passes with a free voice first, so the paid voice is only generated for lines that are settled.

| Engine | Cost | When the user asks for it |
| --- | --- | --- |
| `say` | Free | The default on a Mac. Robotic, but good for timing. |
| `openvoice` | Free, local | Optional install of about 2 GB. Ask first, then run `bash SKILL/scripts/install-openvoice.sh`. Five English voices. The default away from a Mac once installed. |
| `elevenlabs` | Paid | The most realistic, and the one to recommend for a finished sketch. Needs the user's key and a voice id in each speaking character's file. |
| `sarvam` | Paid | Needs the user's key and a speaker in each speaking character's file. Indian English and ten Indian languages. |
| `none` | Free | Silent with captions and guessed mouth movement. |

A line can also name the user's own recording with `"audio": "path.wav"`.

Rules for the paid voices:

1. **The user adds the key, not you.** They put one line, `ELEVENLABS_API_KEY=...` or `SARVAM_API_KEY=...`, in `.env.local` in the working folder, or in `~/.2d-character-sketch/keys.env` to cover every project. Never ask for a key in the chat, never type one into a file, and never print one. `doctor` says whether a key was found and where.
2. **A key file inside a git repository must be ignored by git.** The tool refuses to use it otherwise and says what to add to `.gitignore`.
3. **Nothing is sent without a cap.** Run without `--max-chars` first. The tool prints how many characters of text it would send and sends nothing. Tell the user that number, wait for a yes, then pass `--max-chars <that number>`.

Details, prices and voice lists are in [references/sketch.md](references/sketch.md#voice).

## Rules

- Look at every sheet and contact sheet yourself before showing it. The tool checks that the files are valid. It cannot check that the picture is good.
- The sketch file is the source. To change the video, change the file and render again.
- Keep earlier renders unless the user says to delete them. To keep a version you have shown, save the next one under a new sketch name, for example `tea-v2.json`.
- Say plainly what is rough: the free voice, mouths that follow loudness, a framing you could not fix.
- Install nothing, and send nothing to a paid service, unless the user asked for it in this conversation.

## Limits

Say these up front if the request needs them:

- Characters stand or sit in place. Nobody walks, picks things up or touches anyone.
- No beards, moustaches, hats, long coats, dresses or skirts. Hair is one of eight styles and clothing is a top, trousers and shoes. When a request needs one of these, say so and offer the nearest thing, for example big hair and heavy brows for a beard.
- Five rooms are built in: `plain`, `home`, `park`, `office` and `table`. Any other place needs an SVG backdrop that you draw and name in `set`.
- Three props can be held: phone, mug and pen. Nothing else can be shown in a hand.
- One camera angle (front on). Framings crop and zoom the same flat drawing.
- Captions are in four built-in styles and one position for the whole sketch. When they change word by word, the timing is estimated from the letters in the line, not measured from the sound. The tool does not caption a video it did not make.
- Up to three characters frame cleanly. With more, close-ups show the neighbours' edges.
- A new hair style, pose, expression or room means editing the drawing code in `scripts/`. Do that only when the user asks for it.
