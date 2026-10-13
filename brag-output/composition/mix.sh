#!/usr/bin/env bash
# Mixes the recitation, the narration and the transition sounds into mix.m4a, padded to the video's length.
# Usage: bash mix.sh <total seconds>
set -euo pipefail
cd "$(dirname "$0")"
TOTAL="${1:-37.7}"

# The recitation of al-Hajj 29 (Maher Al-Muaiqly, from everyayah.com) starts 0.6 s into the video
# (RECITE_OFFSET in comp.html) and the narration 9.9 s in (AUDIO_OFFSET), a breath after the reciter
# ends, so every word lands where comp.html expects it. The three sounds were made for this video
# (ElevenLabs sound effects): an airy whoosh for every push, a longer swell for the phone's
# entrance, and a quiet shimmer when the name rises out of the verse. Each whoosh starts half a
# second before its motion so its swell peaks as the motion begins. Nothing hits, and nothing rings
# at the end.
#   10.65 shimmer: the name
#   17.77 long swell: the phone rises
#   19.54, 22.30, 24.02, 25.68, 30.80  whoosh: the screen pushes
#   31.77 whoosh, quieter: the phone leaves
ffmpeg -y -hide_banner -loglevel error \
  -i recitation.mp3 -i ../narration.mp3 -i sfx/whoosh.mp3 -i sfx/whoosh-long.mp3 -i sfx/shimmer.mp3 \
  -filter_complex "
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=600|600[r];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,adelay=9900|9900[v];
  [2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.42,asplit=6[w1][w2][w3][w4][w5][w6];
  [w1]adelay=19540|19540[a1];[w2]adelay=22300|22300[a2];[w3]adelay=24020|24020[a3];[w4]adelay=25680|25680[a4];[w5]adelay=30800|30800[a5];[w6]volume=0.7,adelay=31770|31770[a6];
  [3:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:1.8,afade=t=out:st=1.2:d=0.6,volume=0.34,adelay=17770|17770[b1];
  [4:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=2.2,adelay=10650|10650[c1];
  [r][v][a1][a2][a3][a4][a5][a6][b1][c1]amix=inputs=10:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB[out]" \
  -map "[out]" -t "$TOTAL" -c:a aac -b:a 192k mix.m4a
echo "wrote mix.m4a ($TOTAL s)"
