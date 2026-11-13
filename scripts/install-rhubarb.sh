#!/usr/bin/env bash
# Install Rhubarb Lip Sync for sketch.mjs. Run it only when the user asks.
#
# What it is: a free program (MIT licence, by Daniel Wolf) that listens to a recording and picks a mouth
# shape for each sound. With it, every line's mouth matches what is said; without it, mouths only open and
# close with the volume. It is not part of this skill, because it is a separate program built for each system.
# What it costs: an 87 MB download from the project's GitHub releases; about 90 MB is kept, mostly its speech models.
# Where it goes: $RHUBARB_HOME, or ~/.2d-character-sketch/rhubarb. sketch.mjs looks there by itself.
# Delete that folder to remove it.
#
#   bash install-rhubarb.sh
set -euo pipefail
VERSION=1.14.0
TARGET="${RHUBARB_HOME:-$HOME/.2d-character-sketch/rhubarb}"
case "$(uname -s)" in
  Darwin) KIND=macOS; SIZE=86870942; SHA=f991deacac6c973a14a4431a16a58b842f436531e120cfaea142c87c0d3ab4c5 ;;
  Linux)  KIND=Linux; SIZE=87225003; SHA= ;;
  *) echo "On Windows, download Rhubarb-Lip-Sync-$VERSION-Windows.zip from https://github.com/DanielSWolf/rhubarb-lip-sync/releases and set RHUBARB to rhubarb.exe inside it."; exit 1 ;;
esac
# The macOS build is for Intel chips. An Apple-silicon Mac runs it through Rosetta, which the user installs.
if [ "$KIND" = macOS ] && [ "$(uname -m)" = arm64 ] && ! arch -x86_64 /usr/bin/true 2>/dev/null; then
  echo "This Mac needs Rosetta to run Rhubarb. Ask the user to run: softwareupdate --install-rosetta"; exit 1
fi
command -v curl >/dev/null || { echo 'This needs "curl".'; exit 1; }
command -v unzip >/dev/null || { echo 'This needs "unzip".'; exit 1; }

NAME="Rhubarb-Lip-Sync-$VERSION-$KIND"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
echo "Downloading $NAME.zip (87 MB) from github.com/DanielSWolf/rhubarb-lip-sync"
curl -fL --progress-bar -o "$WORK/$NAME.zip" "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v$VERSION/$NAME.zip"
# Check the file is the published one before running anything from it.
GOT=$(wc -c < "$WORK/$NAME.zip" | tr -d ' ')
[ "$GOT" = "$SIZE" ] || { echo "The download is $GOT bytes, not the published $SIZE. Nothing was installed."; exit 1; }
if [ -n "$SHA" ]; then
  SUM=$(shasum -a 256 "$WORK/$NAME.zip" | cut -d' ' -f1)
  [ "$SUM" = "$SHA" ] || { echo "The download's checksum does not match the one recorded for $VERSION. Nothing was installed."; exit 1; }
fi
unzip -q "$WORK/$NAME.zip" -d "$WORK"

# Keep the program, the speech models it reads from res/, and its licence. The rest (editor plug-ins, tests)
# is not needed here.
rm -rf "$TARGET"; mkdir -p "$TARGET"
cp -R "$WORK/$NAME/rhubarb" "$WORK/$NAME/res" "$WORK/$NAME/LICENSE.md" "$TARGET/"
[ "$KIND" = macOS ] && xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null || true

# Prove it works: a half-second test tone must come back as mouth shapes.
command -v ffmpeg >/dev/null && {
  ffmpeg -v error -y -f lavfi -i "sine=frequency=220:duration=0.5" "$WORK/test.wav"
  "$TARGET/rhubarb" -f json --machineReadable "$WORK/test.wav" 2>/dev/null | grep -q mouthCues || { echo "Rhubarb did not run. The install is not usable."; exit 1; }
}
"$TARGET/rhubarb" --version
date > "$TARGET/ready"
echo "Done. sketch.mjs finds it in $TARGET without any setting."
