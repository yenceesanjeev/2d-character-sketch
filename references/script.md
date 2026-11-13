# Preparing the script

Do this before writing `sketches/<name>.json`. There are two starting points. An **idea** has to become words first. A **script** already has its words and needs direction: who, where, how fast, and where the silences go.

Either way the user approves a script they can read, never JSON. Show it in this shape, which is also what `sketch.mjs script` prints:

```
Tea
set: home · cast: mira, theo · tone: dry, underplayed · pace: normal · captions: bar (auto)
about 14.8 s · 4 shot(s) · 4 line(s) · 23 words
a paid voice would be sent 124 characters: about 124 ElevenLabs credits ($0.02 at the Starter plan's rate)

1. WIDE   0.0–8.0 s
     MIRA (happy, offer): I made you tea. It took four minutes and all of my patience.
     THEO (skeptical): This is coffee.
2. CLOSE on mira   8.0–10.7 s
     MIRA (smug): It identifies as tea.   [Theo: bored]
3. MEDIUM on theo   10.7–12.4 s   slow push in
     Theo, silent at 0.2 s: sideeye, looks at camera
       … hold 1.4 s
```

## From an idea

1. **Ask only what you cannot guess, in one message, three questions at most.** Useful ones: how long (default 30 seconds), who is in it (default two people), and the tone. If the idea already answers these, ask nothing and say what you assumed.
2. **Write one sentence that says what is funny or interesting**, for example "She insists the coffee is tea and he gives in." If you cannot write that sentence, the idea is not ready. Say so and offer two ways to sharpen it.
3. **Draft the script in the readable shape above**, in the chat. Follow the structure below and stay inside the word budget.
4. **Ask for feedback with one pointed question**, not "what do you think?". Ask about the weakest part: "The ending is the soft spot. Should Theo give in, or walk out?"
5. **Revise and show the whole script again.** Repeat until the user says it is good. Do not build characters or render before that.
6. Write the sketch file, then follow the sketch workflow in `SKILL.md`.

### Structure for a short sketch

| Part | Job | Share of the time |
| --- | --- | --- |
| Setup | Who and where, and one normal thing | first quarter |
| Turn | The odd thing arrives | one line |
| Escalation | The odd thing is defended or gets worse, one step at a time | the middle half |
| Punchline | The biggest version, said plainly | one line, then a silent reaction |
| Button | A last small beat after the laugh. Optional. | 2 to 3 seconds |

- One idea per sketch. A second joke belongs in a second sketch.
- Two people is easiest: one drives, one reacts. The reactor's silences carry as much as the lines.
- Lines of 15 words or fewer. Say them aloud in your head; cut any word that can go.
- Put the word that matters last in its line: "This is coffee", not "Coffee is what this is".
- A list is funnier as three items that get shorter each time. This was used in the sitcom script and has not been reviewed by a viewer.
- The characters can walk in and out, gesture, hold any of twenty-one things and share a handshake or a high five, but they cannot pick things up, sit down mid-scene or touch otherwise (see Limits in `SKILL.md`). Write jokes that live in words, faces and those moves.

### Word budget

Speech runs at about two and a half words a second, and a sketch needs silence too.

| Length | Spoken words | Shots | Lines |
| --- | --- | --- | --- |
| 15 s | 25 to 30 | 3 to 4 | 3 to 5 |
| 30 s | 50 to 60 | 5 to 8 | 6 to 10 |
| 60 s | 110 to 125 | 9 to 14 | 12 to 20 |

The longest sketch rendered so far is 104 seconds, about 280 words in five scenes. Past that is untested. Say so if asked for more.

## From a script

The words are the user's. **Do not rewrite them.** When they say "you pick" about the cast or anything else, pick, say what you picked in your first message, and carry on; do not wait. Fix spelling, because a speech engine reads a typo aloud exactly as written ("Aright", "beleive"), and say which words you fixed. Split a long speech into separate lines at its sentence breaks. Keep a written pause such as a leading "..." in the text and also give the line before it a `pause`, since voices differ in how much silence they add for it. If a line is too long for one shot or cannot be staged, say which and suggest a change, but keep their version until they agree.

Fill in everything else, and say what you chose:

| You fill in | How to choose |
| --- | --- |
| `cast` | One character per speaker, left to right in the order they first speak in the whole script, and on the same sides in every scene. List the ones that still need building. |
| `set` | The room the script names, or the nearest built-in one. `plain` when place does not matter. Anything else needs a backdrop you draw. A script that moves between places becomes `scenes`, one per place, in the same file. |
| Sounds | Every sound the script names (a laugh track, typing, a door) becomes a `sound` on that line or shot. Say where each file will come from before building. See Sound in [sketch.md](sketch.md#sound). |
| Delivery cues | Only for ElevenLabs: one short bracketed cue at the start of each line, from the line's face and the tone. Add them before quoting the cost, since they count as characters. **A cue describes how the line sounds, never what the picture does:** `[rushed, defensive]` or `[too eager to sound convincing]`, not `[not looking up]`. The one line a paid voice spoke twice carried a picture direction in its cue. That link is a guess from one line, but picture directions belong in `face`, `look` and `pose` anyway. |
| `tone` | A few words in the user's terms: "dry, underplayed", "warm", "frantic". The tool only records it. You use it to choose everything below. |
| `pace` | `quick`, `normal` or `slow`. Sets the silence after each line and at the end of each shot where you write none. |
| Shots | Start `wide`. Cut closer when something changes. See "Directing well" in [sketch.md](sketch.md). |
| `face`, `pose`, `do` | One per line, from the vocabulary in [sketch.md](sketch.md). A stage direction in the script ("sighs", "to herself") becomes the nearest face, pose or look. Choose the smaller face when two would fit: "pauses, looks up" is `skeptical` with `look: up`, not `surprised`. |
| A direction the tool cannot do | "Camera slides over", "walks in", "hands her the phone". Tell the user before building what they get instead: a hard cut, a slow push in, a held prop. |
| `pause` | Write one only where the default is wrong. See below. |
| Silent shots | Add a `close` on the listener after the punchline, `hold` about 1.2. |
| `captions` | Leave on `auto` unless the user asked for captions. For a clip meant for a phone feed, suggest `pop`. |

Then run `node SKILL/scripts/sketch.mjs script sketches/<name>.json`, check the length against what was asked, and show that output with a short list of the choices you made. It works before the characters are built.

### Tone to settings

| Tone | Pace | Faces and poses | Pauses |
| --- | --- | --- | --- |
| Dry, deadpan | `slow` | Small: `neutral`, `skeptical`, `sideeye`, `bored`. Few poses. | Long before and after the punchline (0.8 to 1.2) |
| Warm, gentle | `normal` | `happy`, `sheepish`, `offer`, `nod` | Default |
| Frantic, farce | `quick` | Big and changing: `shocked`, `angry`, `shrug`, `point` | Nearly none, then one long one |
| Awkward | `slow` | `worried`, `sheepish`, `look: down` | After almost every line |
| Explainer | `normal` | `thinking`, `offer`, `point`; look at `camera` | Short, after each idea |

### Pauses

| Where | `pause` or `hold` |
| --- | --- |
| Ordinary back and forth | Leave it out: 0.35 at `normal` pace |
| An interruption or a fast reply | 0.1 on the line before |
| Before a punchline | 0.7 to 1.0 on the line before |
| After a punchline | A silent reaction shot, `hold` 1.2 |
| A question nobody answers | 1.2 to 1.6, in a `wide` |
| The last shot | `hold` 0.8 to 1.5, with `"end": "fade"` |

A pause is where the laugh goes. If the script reads flat, add silence before adding words.

## After a draft render

Watch for these and fix them in the sketch file:

- **Longer than asked.** The estimate is rough either way: the Mac voice has come in 13% under it, the `openvoice` voice 8% over (129 estimated, 140 rendered, at speed 1, on 2026-11-13), and a paid voice runs longer than the free one: one two-minute sketch grew by 14 seconds when it moved from the Mac voice to ElevenLabs. Cut a line; do not speed everything up. A small `"openvoiceSpeed"` such as 1.1 is fine when the user asks for slightly faster speech.
- **"The pacing seems slow."** Use the cheap levers first: `"pace": "quick"` and shorter `hold` on silent shots, keeping the pauses that set up a laugh. If it is still slow, the words are too many. Show the user the proposed cuts as a before and after table and wait for a yes, since the words are theirs. One promo went from 123 to 93 seconds this way, about 233 words to 190.
- **A long speech to camera.** A talking head past about twenty seconds was the first thing cut in the sitcom pilot (28 seconds to 19, at the user's request). Shorten it, or break it with a cut to someone listening.
- **A line holds one framing for more than about five seconds.** Split the line across two shots, or cut it.
- **The punchline is said in a `wide`.** Move it to a `close` or `medium`.
- **Two reactions in a row.** Keep the better one, unless the user's script asks for both; then give each its own shot and keep each short.
- **A face that looks startled or cute on an ordinary line.** Wide eyes and winks are the first thing a viewer objects to. Replace with a calm face and let the line do the work, or with a stock reaction (`small-surprise`, `one-wink`) that plays once and ends.
