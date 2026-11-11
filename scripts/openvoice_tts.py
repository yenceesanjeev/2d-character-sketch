# Speak a list of lines with OpenVoice V2's stock English voices and write one WAV file per line.
# Run by src/rough/openvoice.mjs with the Python from .local/openvoice/venv. Everything happens on this
# machine: no request leaves it once the model has been downloaded.
#
#   python openvoice_tts.py jobs.json
#
# jobs.json is a list of {"id", "text", "speaker", "speed", "out"}. One line of JSON is printed per finished
# line, so the caller can show progress.
import json
import sys
import time


def main(path):
    with open(path, encoding="utf-8") as handle:
        jobs = json.load(handle)
    if not jobs:
        return
    # Imported here so a missing install fails with a clear message from the caller, not at import time.
    from melo.api import TTS

    model = TTS(language="EN", device="cpu")
    # The model keeps its speakers in its own settings object; a plain dictionary is easier to check against.
    speakers = dict(model.hps.data.spk2id)
    for job in jobs:
        if job["speaker"] not in speakers:
            raise SystemExit(f"OpenVoice has no stock voice named {job['speaker']}")
        started = time.time()
        model.tts_to_file(job["text"], speakers[job["speaker"]], job["out"], speed=float(job.get("speed", 1.0)), quiet=True)
        print(json.dumps({"id": job["id"], "seconds": round(time.time() - started, 2)}), flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
