// The Conversation page: listen to the elder, ask the helper for a reply,
// speak it aloud sentence by sentence, then listen again.

// How long a quiet pause must last before we decide the elder has finished
// speaking. Longer means fewer interruptions mid-story.
const END_OF_TURN_MS = 2000;

// Speaking pace: a little slower than normal (1 is normal).
const SPEAKING_RATE = 0.9;

const startButton = document.getElementById("start");
const statusText = document.getElementById("status");
const debugLine = document.getElementById("debug");
const debugMode = new URLSearchParams(location.search).has("debug");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let history = [];       // the conversation so far: [{ role, content }]
let heardText = "";     // what the elder has said in this turn
let endOfTurnTimer = null;
let listening = false;  // true while we want the microphone on
let stopping = false;   // true while the browser is still shutting the microphone off
let speaking = false;   // true while a reply is being spoken
let turnId = 0;         // changes on every turn, so a cancelled reply can't continue
let replyRequest = null; // lets a tap cancel the reply that is still arriving
let voice = null;
let currentSpeaker = null; // speaks the reply for the current turn
let timings = {};

function setStatus(message) {
  statusText.textContent = message;
}

function showDebug(text) {
  if (debugMode) {
    debugLine.hidden = false;
    debugLine.textContent = text;
  }
}

// ---- Choosing a voice ----

// Mature-sounding male voices, best first (Edge's "Natural" voices).
const PREFERRED_VOICES = ["Christopher", "Roger", "Guy", "Eric", "Davis", "Andrew", "Brian", "Steffan"];

// A voice can be tried out by adding ?voice=Name to the address.
const requestedVoice = new URLSearchParams(location.search).get("voice");

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const named = (part) => voices.find((v) => v.name.toLowerCase().includes(part.toLowerCase()));
  const naturalNamed = (part) =>
    voices.find((v) => /natural/i.test(v.name) && v.name.toLowerCase().includes(part.toLowerCase()));

  voice =
    (requestedVoice && named(requestedVoice)) ||
    PREFERRED_VOICES.map(naturalNamed).find(Boolean) ||
    voices.find((v) => v.lang === "en-US" && /natural/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US" && /google/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices[0] ||
    null;
}

if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice; // voices often load a moment later
}

// ---- Listening ----

function startListening() {
  heardText = "";
  listening = true;
  speaking = false;
  setStatus("Listening…");
  if (stopping) {
    return; // the microphone restarts once the old session has fully ended
  }
  try {
    recognition.start();
  } catch {
    // Already started; nothing to do.
  }
}

function stopListening() {
  listening = false;
  stopping = true;
  clearTimeout(endOfTurnTimer);
  recognition.stop();
}

function setUpRecognition() {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    // The browser can deliver one last copy of what it heard after we stop
    // listening. Ignore it, or it would be treated as the elder speaking again.
    if (!listening || stopping) {
      return;
    }

    // Collect every finished phrase heard so far in this turn.
    let finalText = "";
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript + " ";
      }
    }
    heardText = finalText.trim();
    timings.lastWord = performance.now();

    // Each new bit of speech restarts the quiet-pause timer.
    clearTimeout(endOfTurnTimer);
    endOfTurnTimer = setTimeout(finishTurn, END_OF_TURN_MS);
  };

  // Some browsers stop listening on their own after a while; restart if we still want it on.
  recognition.onend = () => {
    stopping = false;
    if (listening) {
      try {
        recognition.start();
      } catch {
        // Ignore: it may already be restarting.
      }
    }
  };
}

// ---- One turn of the conversation ----

async function finishTurn() {
  const said = heardText;
  stopListening();

  if (!said) {
    startListening();
    return;
  }

  const thisTurn = ++turnId;
  history.push({ role: "user", content: said });
  setStatus("Thinking…");
  timings.sent = performance.now();
  showDebug(`Heard: "${said}"`);

  const speaker = sentenceSpeaker(thisTurn);
  currentSpeaker = speaker;
  replyRequest = new AbortController();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
      signal: replyRequest.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "The companion couldn't respond.");
    }

    // Read the reply as it arrives and hand it to the speaker piece by piece.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (thisTurn !== turnId) return; // interrupted
      speaker.add(decoder.decode(value, { stream: true }));
    }
    speaker.finish();
  } catch (error) {
    if (thisTurn !== turnId) return; // interrupted on purpose
    setStatus(error.message);
    startButton.hidden = false;
  }
}

// ---- Speaking ----

// Collects the reply as it streams in and speaks each sentence as soon as
// it is complete. When the last sentence has been spoken, listening resumes.
function sentenceSpeaker(thisTurn) {
  let pending = "";   // text not yet spoken
  let spoken = "";    // what the elder has actually heard so far
  let queued = 0;     // sentences waiting to be spoken
  let finished = false;

  function say(sentence) {
    if (!sentence.trim()) return;
    if (!speaking) {
      speaking = true;
      setStatus("Speaking…");
      timings.firstSpoken = performance.now();
      showDebug(
        `Heard: "${history[history.length - 1].content}" · pause ${(END_OF_TURN_MS / 1000).toFixed(1)}s · first words after ${((timings.firstSpoken - timings.sent) / 1000).toFixed(1)}s · voice ${voice ? voice.name : "default"}`
      );
    }
    queued++;
    const utterance = new SpeechSynthesisUtterance(sentence.trim());
    utterance.lang = "en-US";
    utterance.rate = SPEAKING_RATE;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (thisTurn === turnId) spoken += sentence;
    };
    utterance.onend = () => {
      queued--;
      maybeDone();
    };
    speechSynthesis.speak(utterance);
  }

  function maybeDone() {
    if (finished && queued === 0 && thisTurn === turnId) {
      history.push({ role: "assistant", content: spoken.trim() || pending.trim() });
      startListening();
    }
  }

  return {
    add(text) {
      pending += text;
      // Speak every complete sentence; keep the unfinished end for later.
      const match = pending.match(/^[\s\S]*[.!?…]["”’)]?(\s|$)/);
      if (match) {
        say(match[0]);
        pending = pending.slice(match[0].length);
      }
    },
    finish() {
      finished = true;
      if (pending.trim()) {
        say(pending);
        pending = "";
      }
      if (queued === 0 && !speaking) {
        // Nothing came back at all.
        setStatus("The companion couldn't respond.");
        startButton.hidden = false;
        return;
      }
      maybeDone();
    },
    heard() {
      return spoken;
    },
  };
}

// ---- Tap to interrupt ----

document.addEventListener("click", (event) => {
  if (!speaking || event.target === startButton) {
    return;
  }
  const heardSoFar = currentSpeaker ? currentSpeaker.heard() : "";
  turnId++; // stops the current reply from continuing
  if (replyRequest) replyRequest.abort();
  speechSynthesis.cancel();
  // Remember only what the elder actually heard before they interrupted.
  if (heardSoFar.trim()) {
    history.push({ role: "assistant", content: heardSoFar.trim() + " …" });
  }
  startListening();
});

// ---- Start ----

startButton.addEventListener("click", () => {
  if (!SpeechRecognition) {
    setStatus("Please open this page in Chrome or Edge to talk with the companion.");
    return;
  }
  if (!recognition) {
    setUpRecognition();
  }
  history = [];
  startButton.hidden = true;
  startListening();
});
