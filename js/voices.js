// Choosing the companion's voice, shared by the questionnaire ("Hear it")
// and the Conversation page.

// Mature-sounding voices, best first (Edge's "Natural" voices).
const PREFERRED_VOICES = {
  man: ["Guy", "Christopher", "Roger", "Eric", "Davis", "Andrew", "Brian", "Steffan"],
  woman: ["Jenny", "Aria", "Michelle", "Nancy", "Sara", "Emma", "Ava", "Jane"],
};

// Voices that run on the computer itself (no internet needed), by kind.
const LOCAL_VOICES = {
  man: ["David", "Mark", "George", "James"],
  woman: ["Zira", "Hazel", "Susan", "Heera"],
};

function englishVoices() {
  return speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
}

function voiceNamed(voices, part) {
  return voices.find((v) => v.name.toLowerCase().includes(part.toLowerCase()));
}

// The best voice of the chosen kind ("man" or "woman"). `requested` (part of
// a voice's name, from ?voice= in the address) wins when it exists.
function pickVoiceFor(kind, requested) {
  const voices = englishVoices();
  const natural = voices.filter((v) => /natural/i.test(v.name));
  const preferred = PREFERRED_VOICES[kind] || PREFERRED_VOICES.man;
  return (
    (requested && voiceNamed(voices, requested)) ||
    preferred.map((name) => voiceNamed(natural, name)).find(Boolean) ||
    natural.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang === "en-US" && /google/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices[0] ||
    null
  );
}

// A voice of the chosen kind that runs on the computer, for when an online voice fails.
function localVoiceFor(kind) {
  const local = englishVoices().filter((v) => v.localService);
  const names = LOCAL_VOICES[kind] || LOCAL_VOICES.man;
  return names.map((name) => voiceNamed(local, name)).find(Boolean) || local.find((v) => v.lang === "en-US") || local[0] || null;
}
