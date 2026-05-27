#!/bin/bash
# Kiyo Demo Video · 产品演示视频合成
# BGM + 多语言 TTS slogan + Ken Burns 动态截图
set -e
cd "$(dirname "$0")"

ASSETS="../deck/assets"
OUT="Kiyo-Demo.mp4"
W=1920; H=1080; FPS=30

echo "=== Kiyo Demo Video Builder ==="
mkdir -p frames

# ─── Step 1: Title & Closing frames ───
echo "[1/5] Title & closing frames..."

ffmpeg -y -f lavfi -i "color=c=0x0A0A0A:s=${W}x${H}:d=1" \
  -vf "drawtext=text='Kiyo':fontsize=140:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-50,drawtext=text='AI Multi-Agent Music Creation':fontsize=32:fontcolor=0xFAFAFA@0.6:x=(w-text_w)/2:y=(h-text_h)/2+70" \
  -frames:v 1 frames/title.png 2>/dev/null

ffmpeg -y -f lavfi -i "color=c=0x0A0A0A:s=${W}x${H}:d=1" \
  -vf "drawtext=text='kiyo.wangyiyang.cc':fontsize=56:fontcolor=0xFAFAFA:x=(w-text_w)/2:y=(h-text_h)/2-20,drawtext=text='Start Creating Now':fontsize=28:fontcolor=0xFAFAFA@0.5:x=(w-text_w)/2:y=(h-text_h)/2+50" \
  -frames:v 1 frames/closing.png 2>/dev/null

echo "  done."

# ─── Step 2: Ken Burns segments ───
echo "[2/5] Ken Burns segments..."

ken_burns() {
  local input="$1" output="$2" dur="$3" dir="$4"
  local nf=$((dur * FPS))
  local zf
  if [ "$dir" = "in" ]; then
    zf="zoompan=z='1.0+0.08*on/${nf}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${nf}:s=${W}x${H}:fps=${FPS}"
  else
    zf="zoompan=z='1.08-0.08*on/${nf}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${nf}:s=${W}x${H}:fps=${FPS}"
  fi
  ffmpeg -y -i "$input" -vf "scale=2560:-1,crop=2560:1584:0:0,${zf}" \
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r $FPS "$output" 2>/dev/null
  echo "  ✓ $(basename $output) (${dur}s)"
}

static_seg() {
  local input="$1" output="$2" dur="$3"
  ffmpeg -y -loop 1 -i "$input" -t "$dur" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0A0A0A,fade=in:0:${FPS},fade=out:st=$(echo "$dur-1.5"|bc):d=1.5" \
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r $FPS "$output" 2>/dev/null
  echo "  ✓ $(basename $output) (${dur}s)"
}

static_seg frames/title.png   frames/seg0.mp4 5
ken_burns "$ASSETS/ui-homepage-dark.png"   frames/seg1.mp4 15 in
ken_burns "$ASSETS/ui-song-detail.png"     frames/seg2.mp4 14 out
ken_burns "$ASSETS/ui-lyrics-generate.png" frames/seg3.mp4 14 in
ken_burns "$ASSETS/ui-homepage-en.png"     frames/seg4.mp4 13 out
ken_burns "$ASSETS/ui-homepage-ja.png"     frames/seg5.mp4 13 in
ken_burns "$ASSETS/ui-songs-list.png"      frames/seg6.mp4 14 out
static_seg frames/closing.png frames/seg7.mp4 7

# Total: 5+15+14+14+13+13+14+7 = 95s

# ─── Step 3: Concat all segments ───
echo "[3/5] Concatenating..."
cat > frames/concat.txt << 'EOF'
file 'seg0.mp4'
file 'seg1.mp4'
file 'seg2.mp4'
file 'seg3.mp4'
file 'seg4.mp4'
file 'seg5.mp4'
file 'seg6.mp4'
file 'seg7.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i frames/concat.txt \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r $FPS \
  frames/video-raw.mp4 2>/dev/null
echo "  ✓ video-raw.mp4"

# ─── Step 4: Mix audio (BGM + TTS slogans at timestamps) ───
echo "[4/5] Mixing audio..."
# TTS placement: zh at 6s, en at 55s, ja at 70s
# BGM loops to cover full video, volume 0.4
# TTS volume 1.0

ffmpeg -y \
  -i frames/video-raw.mp4 \
  -stream_loop -1 -i audio/bgm.mp3 \
  -i audio/slogan-zh.mp3 \
  -i audio/slogan-en.mp3 \
  -i audio/slogan-ja.mp3 \
  -filter_complex "\
[1:a]atrim=0:95,asetpts=PTS-STARTPTS,volume=0.4,afade=in:st=0:d=1,afade=out:st=93:d=2[bgm];\
[2:a]adelay=6000|6000,volume=1.2[zh];\
[3:a]adelay=55000|55000,volume=1.2[en];\
[4:a]adelay=70000|70000,volume=1.2[ja];\
[bgm][zh][en][ja]amix=inputs=4:duration=first:normalize=0[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k -shortest \
  "$OUT" 2>/dev/null

echo "  ✓ $OUT"

# ─── Step 5: Verify ───
echo "[5/5] Verifying..."
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT"
echo ""
echo "=== Done! Output: $(pwd)/$OUT ==="
