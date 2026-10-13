#!/usr/bin/env bash
# Mixes the recitation, the narration and a few soft sounds into mix.m4a, padded to the video's length.
# Usage: bash mix.sh <total seconds>
set -euo pipefail
cd "$(dirname "$0")"
TOTAL="${1:-32.92}"

# The recitation of al-Hajj 29 (Mishary Alafasy, from everyayah.com) starts 0.6 s into the video
# (RECITE_OFFSET in comp.html) and the narration 12.6 s in (AUDIO_OFFSET), after the reciter has
# finished, so every word lands where comp.html expects it. The sounds are Kenney's (CC0), timed
# to the motion:
#   16.83 the phone lands               impactSoft_medium_001
#   17.78, 20.64, 22.24, 23.92  screen pushes   card-slide-1, quiet
#   28.20 the closing mark lands        impactSoft_medium_002
#   29.60 the App Store badge           impactBell_heavy_000
ffmpeg -y -hide_banner -loglevel error \
  -i recitation.mp3 -i ../narration.mp3 -i sfx/impactSoft_medium_001.ogg -i sfx/card-slide-1.ogg -i sfx/impactSoft_medium_002.ogg -i sfx/impactBell_heavy_000.ogg \
  -filter_complex "
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=600|600[r];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=12600|12600[v];
  [2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.45,adelay=16830|16830[s1];
  [3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.22,asplit=4[p1][p2][p3][p4];
  [p1]adelay=17780|17780[q1];[p2]adelay=20640|20640[q2];[p3]adelay=22240|22240[q3];[p4]adelay=23920|23920[q4];
  [4:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.4,adelay=28200|28200[s3];
  [5:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.5,adelay=29600|29600[s4];
  [r][v][s1][q1][q2][q3][q4][s3][s4]amix=inputs=9:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB[out]" \
  -map "[out]" -t "$TOTAL" -c:a aac -b:a 192k mix.m4a
echo "wrote mix.m4a ($TOTAL s)"
