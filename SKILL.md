---
name: 2d-character-sketch
description: Make simple 2D cartoon characters and short talking sketch videos, drawn entirely in code on this machine. Use when asked to design or build a cartoon character, draw a character sheet, make a character talk or say a line, animate a dialogue, turn an idea into a short script, direct a script the user already has, add captions, or make a short comedy sketch, skit, explainer, promo or animatic with one or more characters, in one room or several. Produces PNG character sheets and MP4 videos with lip-synced speech, optional captions, sound effects and music. Not for photoreal, 3D or AI-generated video.
---

# 2D character sketch

One tool, `scripts/sketch.mjs` in this skill's folder, does these jobs:

| Job | You write | You run | You get |
| --- | --- | --- | --- |
| Start from a ready character | nothing | `starters`, then `starters <id>` | `characters/starters.png`, then `characters/<id>.json` to change |
| Build a character | `characters/<id>.json` | `sheet` | `characters/<id>.sheet.png` |
| See every choice for a part | nothing | `options hair <id>`, `options face <id>`, `options props <id>`, `options rooms` | `characters/options-<kind>-<id>.png`, `characters/options-rooms.png` |
| Get the free sounds | nothing | `sounds` | `sfx/ding.wav` and eleven more |
| Make it talk | nothing | `say <id> "words"` | `out/say-<id>-<first words>/sketch.mp4` |
| Prepare a script | `sketches/<name>.json` | `script sketches/<name>.json` | The sketch as a readable script, with its estimated length |
| Make a sketch | `sketches/<name>.json` | `render sketches/<name>.json` | `out/<name>/sketch.mp4` |
| Add captions | `"captions": "pop"` in the sketch | `render`, or add `--captions pop` | The same video with the words on screen, and `captions.srt` beside it |
| Add sound | `"sound"` on a line or shot, `"music"` at the top | `render` | The same video with the sound mixed in |
| Check paid credit | nothing | `credits` | How many ElevenLabs credits the user's account has left |
| Show the stock gestures | nothing | `gestures <id>` | `out/gestures-<id>/`: a labelled reel of every gesture, a strip sheet and `gestures.json` |
| Show the stock reactions | nothing | `reactions <id>` | `out/reactions-<id>/`: a labelled reel of every reaction on that character, a strip sheet and `reactions.json` |

Every picture is flat shapes written as SVG by code, so a render costs nothing and the same input always gives the same video. A character is about ten lines of colours and choices. Eyes, mouths, hands, expressions and poses are shared by everyone, which is why any new character can act straight away.

## Before the first run

Run the check once. `SKILL` below means this skill's folder.

```sh
node SKILL/scripts/sketch.mjs doctor
```

It needs Node 20 or newer, `rsvg-convert` (from librsvg) and FFmpeg, and prints the install command for anything missing. It also reports Rhubarb Lip Sync, which a draft can do without and a finished video cannot: say so at the start if it is missing. With the user's yes, `bash SKILL/scripts/install-rhubarb.sh` installs it (an 87 MB download, about 90 MB kept) into `~/.2d-character-sketch/rhubarb`, where the tool finds it with no setting; from then on every new recording, from any voice, is matched to its sounds when it is made. Ask before installing software. There are no npm packages to install.

Run every command from the user's working folder, or add `--dir <folder>` anywhere after the command name. The tool reads and writes only these places there:

```
characters/   one <id>.json per character, and the sheets drawn from them
sketches/     one <name>.json per sketch
voice/        recordings, kept so an unchanged line is never generated twice; voice/received/ holds a paid reply until its take is saved
out/          one folder per render: sketch.mp4, contact-sheet.png, plan.json, run.json
```

A `--draft` render goes to its own folder, `out/<name>-draft/`, so it never replaces a full-size one. Rendering the same sketch again at the same size does replace the last one.

## Start every request this way

Do these before drawing anything. Each one is cheap now and expensive after a draft exists.

1. **Read the request against [Limits](#limits) and say what will differ.** A camera that slides, someone walking, a prop that is not built in: tell the user what they will get instead, in the same message as your plan. Do not leave it for the end.
2. **List the sounds.** If the script names a laugh track, typing, a door or music, say where each will come from: a file the user has, one made by ElevenLabs (paid), or left out. For an ElevenLabs sound quote up to 40 credits a second; the ones made so far cost about 10. Name the sound in the sketch straight away: a draft renders without a file that does not exist yet and says so. See [Sound](#sound).
3. **If the user named a paid voice, check the money first.** Run `node SKILL/scripts/sketch.mjs credits`. It sends the key and nothing else, and prints the credits left. Then run `script` on the sketch file as soon as it exists: it prints how many characters a paid voice would be sent and the cost in dollars. If the balance is short, say so now. A new key on the same account does not add credits. Run `voices` too: with a key it lists the voices on the user's account with their ids, so the user can pick one per character by name. **If there is no key yet, do not stop.** Set up `.env.local` (see Voice), ask for the key and the voice choices in your first message, and carry on to a free-voice draft: put `"voice": "elevenlabs"` in the sketch file and draft with `--voice say`.
4. **Give the cost in money, not only in characters.** "About 1,600 credits, roughly $0.32 on the Starter plan" is an answer. "1,588 characters" is not.

## Build a character

Read [references/character.md](references/character.md) first. It has the fields, the look rules and the faults to check for.

**Offer the starters first.** Twelve ready characters ship with the skill, designed as a group so no two share a hair shape or a top colour. `node SKILL/scripts/sketch.mjs starters` lists them and draws them side by side; `starters zoe raj` copies those two into `characters/`, where you rename and recolour them like any other. When the user has not described anyone, show the line-up and let them pick. Build from scratch when they have described someone the starters do not fit.

1. Write `characters/<id>.json`. Start from the example in the reference and change only what makes this person different.
2. Draw the sheet: `node SKILL/scripts/sketch.mjs sheet <id>`. With no id it draws every character.
3. **Open the PNG and look at it yourself.** Check the turnaround, the resting face and a few expressions against the checklist in the reference. Then name what each part looks like to someone who has not read the file. A bun has been mistaken for a turban; if a part could be read as something else, change it.
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
- **The user gives a script.** Keep their words. Fill in the rest: cast, rooms, tone, pace, shots, faces, pauses, sounds and silent reactions. Say what you chose.

**Keep faces small.** Use the calm expressions for most lines and save `shocked`, `surprised`, `laugh` and `wink` for a moment the script clearly asks for. Big faces on ordinary lines are the most common note from a viewer.

**Give people something to do with their hands and feet.** Three kinds of ready movement, all in [references/sketch.md](references/sketch.md): 24 stock gestures for someone talking (`"gesture": { "name": "air-quotes", "on": "fine" }` lands it on a word), walking in and out of frame (`"enter": "left"`, `"exit": "right"`), and four moments two people share (`"moment": "high-five", "with": "raj"`). When a script says "she walks in", "counting on his fingers" or "they shake hands", use these. Use them sparingly: one gesture on the line that matters.

**For a reaction, use a stock reaction before timing faces by hand.** A `face` is a pose that stays until something changes it, so a `wink` becomes closed eyes and a `surprised` becomes a stare. A stock reaction is a short performance that ends by itself. There are 31 in nine groups (agreeing, doubting, thinking, surprised, annoyed, awkward, low, to the camera, with a prop), such as `one-wink`, `look-up-skeptical`, `small-surprise`, `deadpan`, `eye-roll`, `not-buying-it`, `sheepish-glance` and `small-nod`. Write `"react": "one-wink"` on a line, in `acting`, or as a listener's entry in `reactions`. See [references/sketch.md](references/sketch.md#stock-reactions).

`node SKILL/scripts/sketch.mjs script sketches/<name>.json` prints any sketch file as a readable script with its estimated length. Show that, not the JSON. It works before the characters are built.

## Make a sketch with several characters

Read [references/sketch.md](references/sketch.md) first. It has the file format, the rooms, the framings, the acting vocabulary and the voice rules.

1. Prepare the script (above), then build each character and check `characters/cast.png`.
2. Write `sketches/<name>.json`: the room, the cast from left to right, and a list of shots. Each shot has a framing and its lines. **When the script moves between places, use `"scenes"`:** one file, each scene with its own room and cast. Do not write one file per room and join them yourself. **When the script puts people on a couch or a bench,** use `home` or `park` and `{ "id": "sam", "sit": true }` in the cast. **For a Zoom or video call, use `"set": "call"`:** everyone gets a square tile and looks at their own camera, never at each other. Both are the user's rules. **When someone carries something** ("holding a coffee", "with a clipboard", "speaks into a microphone"), use `"holding": { "omar": "cup" }` in the scene, or `"hold": "clipboard"` on the line where it appears. **For a jump in time or place, use a title card:** a shot that is `{ "card": "Three days later" }`. **When someone is occupied for a whole scene** ("Sam is on his phone", "she is typing"), use `"busy": { "sam": "phone" }` in that scene: the pose stays up, the eyes stay down, and they do not look up when spoken to.
3. Render a draft, which is half size and fast: `node SKILL/scripts/sketch.mjs render sketches/<name>.json --draft`.
4. **Open `out/<name>-draft/contact-sheet.png` and look at it.** It has one picture per line. Check framing, faces and who is looking at whom.
5. Fix the sketch file and render the draft again. Do not change `scripts/` to fix one sketch. If the request needs something the tool cannot draw, stop and tell the user the nearest thing it can do, and let them choose between that and a change to the tool.
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

`"captions": { "style": "box", "position": "top", "names": false }` moves them to the top or drops the names. `--captions off` removes them. Check captions on the contact sheet: nothing should cover a face, and in a `close` the chin is near the bottom, so use `"position": "top"` there or a smaller style. Every render also writes `out/<name>/captions.srt`, a subtitle file of every spoken line, split and timed like the drawn captions, whether or not captions are on the picture. Upload it beside the video to a site that shows its own captions, such as YouTube; render with `--captions off` first if the words should not be drawn twice. Details are in [references/sketch.md](references/sketch.md#captions).

## Sound

A sketch can play sound files under the voices. The tool mixes them in; it does not invent them.

| Where | What you write | When it plays |
| --- | --- | --- |
| On a line | `"sound": "sfx/laugh.wav"` | Just after the line ends. `{ "file": ..., "when": "with" }` starts it with the line. |
| On a shot | `"sound": { "file": "sfx/typing.wav", "at": 0.5 }` | That many seconds into the shot |
| Top of the sketch | `"music": { "file": "sfx/theme.mp3", "volume": 0.2 }` | Under the whole video, faded out at the end |

Every sound takes `"volume"` (1 is the file as recorded) and `"length"` in seconds, which cuts it there with a short fade. A laugh after a line needs room: give that line a `"pause"` about as long as the laugh.

Where the file comes from:

- **The ready sounds.** `node SKILL/scripts/sketch.mjs sounds` makes twelve short sounds in `sfx/`, free and with no download: `ding`, `pop`, `beep`, `error`, `buzz`, `knock`, `click`, `typing`, `whoosh`, `tada`, `fail`, `doorbell`. They are simple tones and noise. Use them first. There is no laugh among them.
- **The user's own file.** Any format FFmpeg reads. Free.
- **ElevenLabs.** `node SKILL/scripts/sketch.mjs sound "A sitcom studio audience laughs warmly, then it dies down. No speech, no music." --seconds 3 --out sfx/laugh.mp3`. It prints an estimate and sends nothing until you pass `--max-credits`, the same rule as paid voices. A sound that exists is not made again; `--replace` makes a new one and keeps the old in `sfx/rejected/`. Add `--kind music` for music. ElevenLabs makes music only on a paid plan: on a free plan the command says so, sends nothing, and the sketch renders without music.

You cannot hear. After a render, say that sound levels are unchecked by ear and ask the user to listen once.

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

**Emotion with ElevenLabs.** Before the paid run, give each line a short delivery cue in square brackets at the start of `say`, chosen from the line's face and the sketch's tone: `"[dry, unimpressed] This is coffee."` Free voices and captions skip the cue.

A line can also name the user's own recording with `"audio": "path.wav"`, or ask for a free voice on that line alone with `"voice": "say"`, which is how one robotic line sits inside an ElevenLabs sketch.

Rules for the paid voices:

1. **The key lives in `.env.local` in the working folder, and the user types it there, not you.** If the file is missing, copy `SKILL/.env.example` to `.env.local` yourself (it holds no key) and add `.env.local` to `.gitignore`. Then ask the user to open it and paste their key after `ELEVENLABS_API_KEY=` or `SARVAM_API_KEY=`. Never ask for a key in the chat, never type one into a file, and never print one. `doctor` says whether a key was found and where.
2. **A key file inside a git repository must be ignored by git.** The tool refuses to use it otherwise and says what to add to `.gitignore`.
3. **Nothing is sent without a cap.** Run without `--max-chars` first. The tool prints how many characters of text it would send and an estimated cost, and sends no text. Tell the user both, wait for a yes, then pass `--max-chars <that number>`.
4. **Send one short line first.** Render a one-line `say` with the paid voice, check the charge and the length of the recording, then run the rest.
5. **Read the `LIP SYNC` line after every render.** Bad lip sync is the first thing that makes a video look amateur. A finished video needs every line "matched to the sounds", which needs Rhubarb Lip Sync. If the line says `NOT READY TO SHOW AS FINISHED`, tell the user why and what fixes it; do not hand the video over as done. Tell them to watch any line it flags.
6. **Read the `LISTEN` list after every render with a generated voice.** A paid voice has said a short line twice inside one recording, and you cannot hear that. The tool measures each recording and lists any that run too long for their words or hold a silence the words do not explain. Tell the user exactly which lines to play.
7. **When a take is wrong, change something before paying again.** Asking for the same text again has returned the same fault. If speech is repeated or has extra words, shorten or remove that line's delivery cue first; the changed text makes a new recording by itself. Use `--retake <line id>` only when the words and cue should stay exactly as they are. Either way, tell the user what the line costs (its characters) before sending. The tool keeps the earlier take in `voice/rejected/`.

Details, prices and voice lists are in [references/sketch.md](references/sketch.md#voice).

## Before you call a video finished

These come from review rounds on real videos made with these characters. Each one is a fault that reached the user.

1. **Render again after your last edit, and read the first line of the output.** An edit made after a passing draft once broke every render, and a full render once came out in the free voice when the paid one was meant. The first line names the voice engine and how many lines were new or reused.
2. **Lip sync:** every line "matched to the sounds", no line flagged. See Voice.
3. **Doubled or extra speech:** pass on the `LISTEN` list.
4. **Faces:** look at every close and medium on the contact sheet and ask of each face, "would a person hold this for the whole line?" Wide eyes, a wink, a laugh or closed eyes held through a line is a fault. So is a resting face with closed or half-closed eyes on someone who talks to the camera.
5. **Frame edges:** in each medium and close, another person's face must be fully in or fully out. A slice of a neighbour's face at the edge is the most repeated framing fault. The tool slides a single sideways to avoid it and warns when it cannot; a single that has slid has its subject off-centre, so check it still looks intended.
6. **Mouths in view:** no arm, prop, laptop or caption covers a speaking mouth. A held microphone sits under the chin by design.
7. **Moves that finish and can be seen:** no pose or look starts in the last half second of a shot (the tool warns), and any gesture, walk or reaction you rely on is checked on a frame strip, because the contact sheet shows one frame per shot.
8. **Small screen:** shrink the contact sheet to phone width (`ffmpeg -i contact-sheet.png -vf scale=360:-1 small.png`). Acting you cannot read there belongs in a closer shot.
9. **Sound:** every sound file exists and is placed, and you have said that you cannot hear the mix.

A render that passes every check can still be a bad video. The checks find faults; they do not find quality. Say what you think is weak.

The user reviews by watching at full speed and gives notes by time code ("0:20 reaction", "1:38 wink"). To find the moment, read `plan.json`: each entry in `lines` has `startFrame` and `endFrame`, and each shot is an entry in `cuts` with `from` and `to`, all in frames at 24 a second. Fix the line named, then check the shots before and after it still match: a change of place, clothing or prop carries forward until the script moves on.

## Rules

- Look at every sheet and contact sheet yourself before showing it. The tool checks that the files are valid. It cannot check that the picture is good.
- You cannot hear. Say so with every video, pass on the tool's `LIP SYNC` and `LISTEN` reports, and ask the user to play the video once before it is called finished.
- The sketch file is the source. To change the video, change the file and render again.
- Never delete a recording or sound that came back wrong. `--retake` and `--replace` set it aside in a `rejected` folder.
- Keep earlier renders unless the user says to delete them. To keep a version you have shown, save the next one under a new sketch name, for example `tea-v2.json`.
- Say plainly what is rough: the free voice, mouths that follow loudness, a framing you could not fix.
- Install nothing, and send nothing to a paid service, unless the user asked for it in this conversation.

## Limits

Say these up front if the request needs them:

- People can walk into and out of the frame sideways, and two standing people can high-five, shake hands, bump fists or hand something over. Nobody walks toward the camera, picks things up, hugs, or sits down or gets up during a scene. People can sit in three places: at the `table`, on the sofa in `home` and on the bench in `park`, two to a seat. For the sofa and bench, write `"sit": true` on their cast entry. Anywhere else they stand.
- A change of room is a hard cut. The camera cannot slide, pan or follow anyone; within a shot it can only push in slowly (`zoom`).
- Sound effects and music are files. The tool mixes them in but makes none itself, except by asking ElevenLabs, which is paid.
- No long coats, dresses, skirts, headscarves or wide-brimmed hats. Hair is one of twenty-two styles, there are three beards, a moustache, a beanie and a cap (`options hair <id>` and `options face <id>` draw them all), and clothing is a top, trousers and shoes. When a request needs something that is not drawn, say so and offer the nearest thing.
- Twelve rooms are built in: `plain`, `home`, `park`, `office`, `table`, `conference`, `terrace`, `kitchen`, `reception`, `cafe`, `corridor` and `call` (`options rooms` draws them all). Any other place needs an SVG backdrop that you draw and name in `set`.
- Twenty-one things can be held (`options props <id>` draws them all), one per person at a time. Nothing is picked up from a surface or put down on one: a thing appears in the hand and goes. At the `table`, `"laptops"` puts an open laptop in front of the people it names, and the `type` pose reads as working on it.
- One camera angle (front on). Framings crop and zoom the same flat drawing.
- Captions are in four built-in styles and one position for the whole sketch. When they change word by word, the timing is estimated from the letters in the line, not measured from the sound. The tool does not caption a video it did not make.
- One paid voice engine per sketch. A single line can switch to a free voice, not to another paid one.
- The longest sketch rendered so far is 104 seconds across five scenes. Say so if asked for much more.
- Up to three characters frame cleanly. With more, close-ups show the neighbours' edges.
- There are 31 stock reactions, most of them mild. A bigger or different one is hand-timed with `acting`, or added to the table in `scripts/sketch.mjs` when the user asks.
- Lip sync is only as good as the mouth data. Without Rhubarb Lip Sync installed, mouths follow loudness, which is not good enough for a finished video.
- A new hair style, pose, expression or room means editing the drawing code in `scripts/`. Do that only when the user asks for it.
