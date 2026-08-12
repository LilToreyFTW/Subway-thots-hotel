import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RATE = 44100;
const output = path.resolve('public/assets/audio');
await mkdir(output, { recursive: true });
let seed = 0x51a7c0de;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1;
const clamp = (value) => Math.max(-1, Math.min(1, value));

function wav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples.length * 2, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => bytes.writeInt16LE(Math.round(clamp(sample) * 32767), 44 + index * 2));
  return bytes;
}

function render(seconds, sample) {
  const data = new Float32Array(Math.floor(seconds * RATE));
  for (let i = 0; i < data.length; i++) data[i] = sample(i / RATE, i, data.length);
  return data;
}

function engine({ seconds = 4, rpm = 52, load = .35 }) {
  let filtered = 0;
  return render(seconds, (t) => {
    const sweep = rpm * (1 + load * .22 * Math.sin(Math.PI * 2 * .12 * t));
    filtered += (noise() - filtered) * .04;
    const combustion = Math.sin(Math.PI * 2 * sweep * t) * .42 + Math.sin(Math.PI * 4 * sweep * t) * .19 + Math.sin(Math.PI * 6 * sweep * t) * .08;
    return combustion * (.72 + .08 * Math.sin(Math.PI * 2 * 7.2 * t)) + filtered * .09;
  });
}

function traffic() {
  let low = 0;
  return render(10, (t) => {
    low += (noise() - low) * .008;
    let pass = 0;
    for (const center of [1.4, 4.8, 8.1]) {
      const distance = (t - center) / .85;
      const envelope = Math.exp(-distance * distance * 2.2);
      pass += envelope * (Math.sin(Math.PI * 2 * (72 + distance * 18) * t) * .16 + low * .24);
    }
    const horn = t > 6.1 && t < 6.42 ? Math.sin(Math.PI * 2 * 392 * t) * Math.sin(Math.PI * (t - 6.1) / .32) * .12 : 0;
    return low * .12 + pass + horn;
  });
}

function city() {
  let rain = 0; let wind = 0;
  return render(12, (t) => {
    rain += (noise() - rain) * .16; wind += (noise() - wind) * .002;
    const rail = Math.sin(Math.PI * 2 * 46 * t) * (.025 + .02 * Math.sin(Math.PI * 2 * .08 * t));
    return rain * .12 + wind * .24 + rail;
  });
}

function footstep() {
  let body = 0;
  return render(.32, (t) => {
    const envelope = Math.exp(-t * 18);
    body += (noise() - body) * .18;
    return (Math.sin(Math.PI * 2 * 78 * t) * .5 + body * .42) * envelope;
  });
}

function voice(seedOffset, pitch) {
  seed ^= seedOffset;
  return render(1.35, (t) => {
    const phrase = Math.sin(Math.PI * Math.min(1, t / 1.25)) ** 1.2;
    const contour = pitch + 18 * Math.sin(Math.PI * 2 * 1.7 * t) + 7 * Math.sin(Math.PI * 2 * .47 * t);
    const glottal = Math.sin(Math.PI * 2 * contour * t) + .42 * Math.sin(Math.PI * 4 * contour * t) + .18 * Math.sin(Math.PI * 6 * contour * t);
    const syllables = .48 + .52 * Math.max(0, Math.sin(Math.PI * 2 * 3.1 * t));
    return glottal * phrase * syllables * .18 + noise() * phrase * .018;
  });
}

const assets = {
  'car-idle.wav': engine({ rpm: 48, load: .12 }),
  'car-acceleration.wav': engine({ rpm: 78, load: .8 }),
  'traffic-loop.wav': traffic(),
  'city-night-loop.wav': city(),
  'player-footstep.wav': footstep(),
  'player-breath.wav': voice(0x101, 92),
  'player-effort.wav': voice(0x202, 105),
  'npc-greeting-a.wav': voice(0x303, 138),
  'npc-greeting-b.wav': voice(0x404, 172),
  'npc-chatter-loop.wav': render(8, (t) => voiceSample(t)),
};
function voiceSample(t) {
  const active = (t % 2.6) < 1.1 ? Math.sin(Math.PI * (t % 2.6) / 1.1) : 0;
  return active * (Math.sin(Math.PI * 2 * (118 + 12 * Math.sin(t * 2.1)) * t) + .35 * Math.sin(Math.PI * 4 * 118 * t)) * .055;
}
for (const [name, samples] of Object.entries(assets)) {
  await writeFile(path.join(output, name), wav(samples));
  console.log(`${name} ${(samples.length / RATE).toFixed(2)}s`);
}
