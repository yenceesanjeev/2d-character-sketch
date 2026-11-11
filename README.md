# 2d-character-sketch

An agent skill that makes simple 2D cartoon characters and short talking sketch videos. Everything is drawn by code on your own machine, so a render costs nothing and the same input always gives the same video.

![A four-shot sketch with two characters](examples/tea.gif)

Ask your coding agent for any of these and it follows the skill:

- "Build me a character: a tired barista with a green apron." You get a character sheet.
- "Make her say: we are out of oat milk." You get a short lip-synced clip.
- "Add a customer and make a four-shot sketch in the park." You get a 1920 × 1080 video.

The preview above was rendered from [examples/sketches/tea.json](examples/sketches/tea.json). It is a silent GIF; the rendered video has speech.

## What a character is

A character is one small JSON file of colours and choices. Eyes, mouths, hands, 23 expressions and 13 poses are shared by every character, so a new one can act straight away.

```json
{
  "id": "mira",
  "name": "Mira",
  "skin": "#c98f63",
  "hair": "#2a1f24",
  "style": "long",
  "glasses": "steel",
  "top": "#d3a23a",
  "front": "open",
  "resting": "happy"
}
```

![Mira's character sheet](examples/characters/mira.sheet.png)

## What a sketch is

A sketch is one JSON file: a room, a cast, and a list of shots. Each shot has a framing and its lines. You never write timestamps; the tool times everything from the recordings.

```json
{
  "set": "home",
  "cast": ["mira", "theo"],
  "shots": [
    { "frame": "wide", "lines": [
      { "who": "mira", "say": "I made you tea.", "face": "happy", "pose": "offer" },
      { "who": "theo", "say": "This is coffee.", "face": "skeptical" }
    ] },
    { "frame": "close", "on": "mira", "lines": [
      { "who": "mira", "say": "It identifies as tea.", "face": "smug" }
    ] }
  ]
}
```

Every render also writes a contact sheet, one picture per line, which the agent checks before showing you the video.

![Contact sheet for the example sketch](examples/out/tea/contact-sheet.png)

## Install

You need Node 20 or newer, FFmpeg and `rsvg-convert` (from librsvg). There are no npm packages.

```sh
# Mac
brew install ffmpeg librsvg
# Debian or Ubuntu
sudo apt install ffmpeg librsvg2-bin
```

Then clone this repository into your agent's skills folder.

```sh
# Claude Code, for every project
git clone https://github.com/yenceesanjeev/2d-character-sketch ~/.claude/skills/2d-character-sketch

# or for one project (Claude Code)
git clone https://github.com/yenceesanjeev/2d-character-sketch .claude/skills/2d-character-sketch

# or for agents that read .agents/skills (for example Codex)
git clone https://github.com/yenceesanjeev/2d-character-sketch .agents/skills/2d-character-sketch
```

Check the setup:

```sh
node ~/.claude/skills/2d-character-sketch/scripts/sketch.mjs doctor
```

## Use it without an agent

The skill is a set of instructions plus one command-line tool, and the tool works on its own. From this repository:

```sh
node scripts/sketch.mjs sheet --dir examples                    # draw every character sheet
node scripts/sketch.mjs say theo "This is coffee." --dir examples
node scripts/sketch.mjs render sketches/tea.json --dir examples  # the sketch above
```

Add `--draft` for a fast half-size render. The file formats are documented in [references/character.md](references/character.md) and [references/sketch.md](references/sketch.md).

## Voice

The default is free. Tell your agent which voice to use ("use OpenVoice", "use ElevenLabs", "use Sarvam") and it switches.

**For a sketch that should sound realistic, use ElevenLabs.** The free voices read flatly, and delivery is most of what makes a line land. A good order of work is to settle the lines and timing with a free voice, then generate the ElevenLabs voice once.

| Engine | Cost | Notes |
| --- | --- | --- |
| macOS `say` | Free | The default on a Mac. Robotic, but good for timing. |
| OpenVoice | Free, local | Optional install of about 2 GB (`bash scripts/install-openvoice.sh`, needs [uv](https://docs.astral.sh/uv/)). Five English voices from MeloTTS, the speech model of OpenVoice V2. |
| ElevenLabs | Paid | The most realistic. Needs your API key and a voice id per character. |
| Sarvam | Paid | Needs your API key and a speaker per character. Indian English and ten Indian languages. |
| None | Free | Lines play silent with captions. |
| Your own recordings | Free | Name an audio file on any line. |

For a paid voice, put your key in a file named `.env.local` in your working folder (and list that file in `.gitignore`), or in `~/.2d-character-sketch/keys.env` to cover every project:

```
ELEVENLABS_API_KEY=your-key
SARVAM_API_KEY=your-key
```

The tool never prints a key, refuses a key file that git is not ignoring, and sends nothing to a paid service until you pass a cap on the characters of text it may send (`--max-chars`). Recordings are kept, so an unchanged line is never charged twice.

Mouth shapes match the spoken sounds when [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) is installed. Without it, mouths open and close with the loudness of the recording.

You are responsible for the licence terms of whichever voice you use, including the system voices on your computer, before you publish a video.

## Limits

- Characters stand or sit in place. Nobody walks, picks things up or touches anyone.
- No beards, moustaches, hats, long coats, dresses or skirts. Hair is one of eight styles.
- Five rooms are built in: `plain`, `home`, `park`, `office` and `table`. Any other place needs an SVG backdrop that you supply.
- Three props can be held: phone, mug and pen.
- One camera angle. Framings crop and zoom the same flat drawing.
- Up to three characters frame cleanly.
- The ElevenLabs and Sarvam paths have not been run end to end; only their safety checks were tested. Treat your first paid run as a test and start with one short line.
- Tested on macOS only so far.

## Files

| Path | What it is |
| --- | --- |
| `SKILL.md` | What the agent reads first: the three workflows and the rules |
| `references/` | The character fields and the sketch file format |
| `scripts/sketch.mjs` | The command-line tool |
| `scripts/cutout-draw.mjs`, `scripts/cutout-sets.mjs` | The drawing code: characters, expressions, poses and rooms |
| `scripts/install-openvoice.sh`, `scripts/openvoice_tts.py` | The optional free local voice: its installer and the script that speaks |
| `scripts/sketch.test.mjs` | Tests. Run them with `node --test scripts/sketch.test.mjs` |
| `version.json` | Which snapshot this is |
| `examples/` | Two characters, one sketch and their rendered output |

## Where this comes from

The drawing code is developed inside a private sitcom production tool, and this repository is a snapshot exported from it. Some names in the drawing code's comments (a meeting room's usual seats, for example) refer to that project. They do not affect the skill.

Because the files under `scripts/` and `references/` are replaced by each new export, please open an issue before sending a pull request that changes them. Accepted changes are applied at the source and arrive here in the next release.

## Licence

[MIT](LICENSE)
