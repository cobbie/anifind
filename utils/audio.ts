
import type { Blob } from '@google/genai';

/**
 * Encodes a Uint8Array into a Base64 string.
 * This is a manual implementation to avoid external dependencies.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates a Blob object for the Gemini Live API from raw audio data.
 * @param data The raw audio data (Float32Array).
 * @returns A Blob object with base64 encoded data and the correct MIME type.
 */
export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Convert float to 16-bit PCM
    int16[i] = data[i] < 0 ? data[i] * 32768 : data[i] * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
