// 生成两段测试音频（临时用，验证播放器逻辑后删除）
import fs from 'node:fs';

function wav(path, seconds, freq) {
  const rate = 44100;
  const n = rate * seconds;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    // 简单的衰减正弦 + 一点泛音，别太难听
    const t = i / rate;
    const env = Math.min(1, t / 0.05) * Math.exp(-t / (seconds * 0.7));
    const v = Math.sin(2 * Math.PI * freq * t) * 0.35 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.1;
    const s = Math.max(-1, Math.min(1, v * env));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path, Buffer.concat([header, data]));
  console.log('wrote', path, ((44 + data.length) / 1024).toFixed(0) + ' KB');
}

wav('background_music/_test-tone-a.wav', 6, 440);
wav('background_music/_test-tone-b.wav', 6, 523);
