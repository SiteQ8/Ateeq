#!/usr/bin/env bash
# Mixes the narration with a few soft sounds into mix.m4a, padded to the video's length.
# Usage: bash mix.sh <total seconds>
set -euo pipefail
cd "$(dirname "$0")"
TOTAL="${1:-21.12}"

# The narration file starts 0.8 s into the video (AUDIO_OFFSET in comp.html), so every
# word lands where comp.html expects it. The sounds are Kenney's (CC0), timed to the motion:
#   5.03  the phone lands            impactSoft_medium_001
#   5.98, 8.84, 10.44, 12.12  screen pushes   card-slide-1, quiet
#   16.40 the closing mark lands     impactSoft_medium_002
#   17.80 the App Store badge        impactBell_heavy_000
ffmpeg -y -hide_banner -loglevel error \
  -i ../narration.mp3 -i sfx/impactSoft_medium_001.ogg -i sfx/card-slide-1.ogg -i sfx/impactSoft_medium_002.ogg -i sfx/impactBell_heavy_000.ogg \
  -filter_complex "
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=800|800[v];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.45,adelay=5030|5030[s1];
  [2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.22,asplit=4[p1][p2][p3][p4];
  [p1]adelay=5980|5980[q1];[p2]adelay=8840|8840[q2];[p3]adelay=10440|10440[q3];[p4]adelay=12120|12120[q4];
  [3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.4,adelay=16400|16400[s3];
  [4:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.5,adelay=17800|17800[s4];
  [v][s1][q1][q2][q3][q4][s3][s4]amix=inputs=8:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB[out]" \
  -map "[out]" -t "$TOTAL" -c:a aac -b:a 192k mix.m4a
echo "wrote mix.m4a ($TOTAL s)"
