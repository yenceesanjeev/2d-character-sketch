#!/usr/bin/env bash
# Optional: install the free local "openvoice" voice for sketch.mjs. Run it only when the user asks.
#
# What it installs: MeloTTS, the speech model OpenVoice V2 is built on (MIT licence, by MyShell), in its
# own Python 3.9 environment, with five stock English voices. Nothing is sent anywhere when it speaks.
# What it costs: about 2 GB of disk and several minutes of downloads. It needs "uv" (https://docs.astral.sh/uv/).
# Where it goes: $OPENVOICE_HOME, or ~/.2d-character-sketch/openvoice. Delete that folder to remove it.
#
#   bash install-openvoice.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${OPENVOICE_HOME:-$HOME/.2d-character-sketch/openvoice}"
MELO_COMMIT=209145371cff8fc3bd60d7be902ea69cbdb7965a
command -v uv >/dev/null || { echo 'This needs "uv". Install it from https://docs.astral.sh/uv/ and run this again.'; exit 1; }
command -v git >/dev/null || { echo 'This needs "git".'; exit 1; }
mkdir -p "$TARGET" && cd "$TARGET"
rm -f ready
echo "Installing into $TARGET"

[ -d venv ] || uv venv --python 3.9 venv
PY="$TARGET/venv/bin/python"
if [ ! -d MeloTTS ]; then git clone --quiet https://github.com/myshell-ai/MeloTTS.git MeloTTS; fi
git -C MeloTTS checkout --quiet "$MELO_COMMIT"

# The versions below are the set that was seen to work. setuptools is held back because an older audio
# library still imports pkg_resources.
uv pip install --python "$PY" "setuptools<81" "torch==2.8.0" "torchaudio==2.8.0" "numpy==1.26.4"
uv pip install --python "$PY" -e ./MeloTTS
uv pip install --python "$PY" --upgrade "boto3" "botocore" "setuptools<81"
# The full Japanese dictionary is a 526 MB download that English speech never uses. Without the "unidic"
# package the model falls back to the small dictionary it already has.
uv pip uninstall --python "$PY" unidic || true
"$PY" - <<'PYTHON'
import nltk, sys, os
target = os.path.join(sys.prefix, "nltk_data")
for name in ("averaged_perceptron_tagger_eng", "averaged_perceptron_tagger", "cmudict"):
    nltk.download(name, download_dir=target, quiet=True)
PYTHON

# Speak one line. The first run also downloads the English voice model (a few hundred MB).
mkdir -p test
printf '[{"id":"test","text":"The local voice is ready.","speaker":"EN-US","speed":1.0,"out":"%s"}]' "$TARGET/test/ready.wav" > test/jobs.json
"$PY" "$HERE/openvoice_tts.py" test/jobs.json
[ -s test/ready.wav ] || { echo "The test line was not spoken. The install is not usable."; exit 1; }
date > ready
echo "Done. Use it with:  --voice openvoice"
