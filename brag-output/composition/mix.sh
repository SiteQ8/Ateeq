#!/usr/bin/env bash
# Mixes the recitation, the narration and a few soft sounds into mix.m4a, padded to the video's length.
# Usage: bash mix.sh <total seconds>
set -euo pipefail
cd "$(dirname "$0")"
TOTAL="${1:-37.7}"

# The recitation of al-Hajj 29 (Maher Al-Muaiqly, from everyayah.com) starts 0.6 s into the video
# (RECITE_OFFSET in comp.html) and the narration 9.9 s in (AUDIO_OFFSET), a breath after the reciter
# ends, so every word lands where comp.html expects it. The sounds are Kenney's (CC0), timed to the
# motion:
#   18.97 the phone lands               impactSoft_medium_001
#   20.04, 22.80, 24.52, 26.18, 31.30  screen pushes   card-slide-1, quiet
#   32.78 the closing mark lands        impactSoft_medium_002
#   34.50 the App Store badge           impactBell_heavy_000
ffmpeg -y -hide_banner -loglevel error \
  -i recitation.mp3 -i ../narration.mp3 -i sfx/impactSoft_medium_001.ogg -i sfx/card-slide-1.ogg -i sfx/impactSoft_medium_002.ogg -i sfx/impactBell_heavy_000.ogg \
  -filter_complex "
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=600|600[r];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=9900|9900[v];
  [2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.45,adelay=18970|18970[s1];
  [3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.22,asplit=5[p1][p2][p3][p4][p5];
  [p1]adelay=20040|20040[q1];[p2]adelay=22800|22800[q2];[p3]adelay=24520|24520[q3];[p4]adelay=26180|26180[q4];[p5]adelay=31300|31300[q5];
  [4:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.4,adelay=32780|32780[s3];
  [5:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.5,adelay=34500|34500[s4];
  [r][v][s1][q1][q2][q3][q4][q5][s3][s4]amix=inputs=10:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB[out]" \
  -map "[out]" -t "$TOTAL" -c:a aac -b:a 192k mix.m4a
echo "wrote mix.m4a ($TOTAL s)"
