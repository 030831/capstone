import { useState, useEffect } from 'react';
const PREFIX = 'neulbom:v1:';
export function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('neulbom-storage-error', { detail: { key } }));
    return false;
  }
}
export function usePersistentState(key, initial) {
  const [state, setState] = useState(() =>
    readStored(key, typeof initial === 'function' ? initial() : initial),
  );
  useEffect(() => {
    writeStored(key, state);
  }, [key, state]);
  return [state, setState];
}
export function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
  return true;
}
export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
