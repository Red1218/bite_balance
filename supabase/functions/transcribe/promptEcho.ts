const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// gpt-4o-transcribe returns (part of) its prompt when the clip has no speech.
// Echo = 4+ words that all appear, in order, inside the prompt; real short
// answers like "dal" or "two idli" are never dropped.
// ponytail: an echo with extra words tacked on still gets through; add fuzzy
// matching only if that shows up on device.
export const isPromptEcho = (text: string, prompt: string) => {
  const t = norm(text);
  return t.split(' ').length >= 4 && norm(prompt).includes(t);
};
