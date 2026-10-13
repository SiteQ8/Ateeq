#!/usr/bin/env bash
# Mixes the narration with a few soft sounds into mix.m4a, padded to the video's length.
# Usage: bash mix.sh <total seconds>
set -euo pipefail
cd "$(dirname "$0")"
TOTAL="${1:-23.72}"

# The narration file starts 3.4 s into the video (AUDIO_OFFSET in comp.html), after the verse
# has had the screen to itself, so every word lands where comp.html expects it. The sounds are
# Kenney's (CC0), timed to the motion:
#   0.55  the verse settles             impactSoft_medium_002, quiet
#   7.63  the phone lands               impactSoft_medium_001
#   8.58, 11.44, 13.04, 14.72  screen pushes   card-slide-1, quiet
#   19.00 the closing mark lands        impactSoft_medium_002
#   20.40 the App Store badge           impactBell_heavy_000
ffmpeg -y -hide_banner -loglevel error \
  -i ../narration.mp3 -i sfx/impactSoft_medium_001.ogg -i sfx/card-slide-1.ogg -i sfx/impactSoft_medium_002.ogg -i sfx/impactBell_heavy_000.ogg \
  -filter_complex "
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=3400|3400[v];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.45,adelay=7630|7630[s1];
  [2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.22,asplit=4[p1][p2][p3][p4];
  [p1]adelay=8580|8580[q1];[p2]adelay=11440|11440[q2];[p3]adelay=13040|13040[q3];[p4]adelay=14720|14720[q4];
  [3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.4,asplit=2[o1][o2];
  [o1]volume=0.75,adelay=550|550[s0];[o2]adelay=19000|19000[s3];
  [4:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.5,adelay=20400|20400[s4];
  [v][s0][s1][q1][q2][q3][q4][s3][s4]amix=inputs=9:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB[out]" \
  -map "[out]" -t "$TOTAL" -c:a aac -b:a 192k mix.m4a
echo "wrote mix.m4a ($TOTAL s)"
