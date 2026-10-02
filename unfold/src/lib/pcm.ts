export function mixToMono(channels: ArrayLike<number>[]): Float32Array {
  if (channels.length === 0) return new Float32Array();
  const length = channels[0].length;
  const mixed = new Float32Array(length);
  if (channels.length === 1) {
    mixed.set(channels[0]);
    return mixed;
  }
  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[index] ?? 0;
    mixed[index] = sum / channels.length;
  }
  return mixed;
}

export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (input.length === 0 || fromRate <= 0 || toRate <= 0 || fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  const last = input.length - 1;
  for (let index = 0; index < length; index += 1) {
    const position = Math.min(index * ratio, last);
    const left = Math.floor(position);
    const frac = position - left;
    const a = input[left] ?? 0;
    const b = input[Math.min(left + 1, last)] ?? a;
    output[index] = a + (b - a) * frac;
  }
  return output;
}

export function toPcm16(samples: Float32Array): ArrayBuffer {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    output[index] = Math.round(value * 32767);
  }
  return output.buffer;
}

export function isAudible(samples: Float32Array, threshold = 0.005): boolean {
  for (let index = 0; index < samples.length; index += 1) {
    if (Math.abs(samples[index]) >= threshold) return true;
  }
  return false;
}
