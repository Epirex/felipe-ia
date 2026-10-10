const ffmpegStatic = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');

const input = path.join(__dirname, 'public', 'audio', 'felipebienvenida.mp3');
const output = path.join(__dirname, 'public', 'audio', 'felipebienvenida.ogg');

console.log('Using ffmpeg from:', ffmpegStatic);
try {
  // Convert to OGG Opus with 24k bitrate (standard for voice notes)
  execSync(`"${ffmpegStatic}" -y -i "${input}" -c:a libopus -b:a 24k -vbr on -compression_level 10 "${output}"`, { stdio: 'inherit' });
  console.log('Conversion successful!');
} catch (e) {
  console.error('Conversion failed:', e);
}
