// The Conversation page: listen to the elder, ask the helper for a reply,
// speak it aloud as it arrives, then listen again.

// How long a quiet pause must last before we decide the elder has finished
// speaking. Longer means fewer interruptions mid-story.
const END_OF_TURN_MS = 1500;

// Extra time to wait when the words so far sound unfinished ("yeah, um…").
// The browser doesn't write down "um" or "uh", so a hesitation looks like silence.
const UNFINISHED_EXTRA_MS = 2000;

// Someone telling a longer story gets a longer pause before the companion
// answers (after this many words in a turn).
const STORY_WORDS = 12;
const STORY_PAUSE_MS = 2500;
const UNFINISHED_ENDINGS = [
  "yeah", "yes", "well", "so", "and", "but", "or", "because", "um", "uh", "er", "hmm",
  "let me", "i mean", "you know", "like", "the", "a", "an", "to", "of", "with", "about",
  "i", "i think", "i was", "it was", "that", "if", "when", "then",
];

// Sound meter: while the microphone hears the elder making sound ("um",
// a word Edge missed while restarting), the turn isn't over. But if there has
// been sound and no new words for this long, it's probably a TV or room noise.
const SOUND_WITHOUT_WORDS_MS = 6000;

// Testing switches in the address: &rate=1 sets the speaking pace, &meter=off
// turns off the sound meter (to compare how the voice sounds without it).
const params = new URLSearchParams(location.search);

// The first sentence of a reply is spoken as soon as it arrives, unless it is
// shorter than this many words: then it waits to be joined by the next one.
const SHORT_OPENING_WORDS = 8;

// Speaking pace (1 is normal). Slower made Edge's online voices sound choppy.
const SPEAKING_RATE = Number(params.get("rate")) || 1;

// Silence: after this long with no words, the companion gently checks in;
// after this much longer with still nothing, it says goodbye and turns the
// microphone off. (&idle=10000 in the address shortens both, for testing.)
const IDLE_CHECK_MS = Number(params.get("idle")) || 45000;
const IDLE_END_MS = params.get("idle") ? IDLE_CHECK_MS / 2 : 20000;
const FINAL_GOODBYE = "I'll let you go for now. It was good talking with you.";

// Sent to the companion in place of the elder's words after a long silence.
// Must match IDLE_NOTE in api/companion-instructions.js.
const IDLE_NOTE = "(They haven't said anything for a while.)";

// Said aloud when something goes wrong, or when it heard sound but no words.
const SORRY_STOP = "I'm sorry, I need to stop for now.";
const DIDNT_CATCH = "I didn't quite catch that. Could you say it again?";

// "Didn't catch that": sound lasting at least this long with no words, at most
// once in this long (so a cough or a door doesn't keep setting it off).
const SOUND_NO_WORDS_MS = 1200;

// Mumbling: the browser may guess words anyway. A short turn (a few words) it
// was this unsure about (0 to 1) gets "say it again" instead of a reply.
const LOW_CONFIDENCE = 0.5;
const SHORT_TURN_WORDS = 4;
const DIDNT_CATCH_GAP_MS = 30000;

const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const problemNote = document.getElementById("problem");
const orb = document.getElementById("orb");
const statusText = document.getElementById("status");
const debugLine = document.getElementById("debug");
const interruptHint = document.getElementById("interrupt-hint");
const debugMode = new URLSearchParams(location.search).has("debug");
// The family's questionnaire answers, saved for this visit by the questionnaire
// page. For testing, ?demo uses the fictionalized demo elder instead.
function loadAnswers() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("companionAnswers") || "null");
    if (saved && saved.name) return saved;
  } catch {
    // Storage unavailable: fall through.
  }
  if (params.has("demo") && typeof DEMO_ANSWERS !== "undefined") return DEMO_ANSWERS;
  return null;
}
const answers = loadAnswers();
const elderName = answers ? answers.name : "";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let history = [];       // the conversation so far: [{ role, content }]
let heardText = "";     // what the elder has said in this turn
let earlierText = "";   // words from before the browser restarted its listening, this turn
let confidences = [];   // how sure the browser was of each finished phrase, this turn
let earlierConfidences = [];
let micRestarts = 0;    // for the testing line: how often the browser restarted listening this turn
let endOfTurnTimer = null;
let listening = false;  // true while we want the microphone on
let stopping = false;   // true while the browser is still shutting the microphone off
let speaking = false;   // true while a reply is being spoken
let turnId = 0;         // changes on every turn, so a cancelled reply can't continue
let replyRequest = null; // lets a tap cancel the reply that is still arriving
let voice = null;
let currentSpeaker = null; // speaks the reply for the current turn
let timings = {};
let voiceNote = ""; // for the testing line: set when the voice had to be switched
let quietSince = 0;     // when the elder last said actual words (or the companion finished speaking)
let checkedIn = false;  // true once the companion has asked "are you still there?"

function setStatus(message) {
  statusText.textContent = message;
}

// A note for the family member (not the elder) when something needs fixing.
function showProblem(message) {
  problemNote.textContent = message;
  problemNote.hidden = !message;
}

// The glowing orb: "listening", "thinking", "speaking", or null to hide it.
function setOrb(state) {
  orb.hidden = !state;
  orb.className = state ? `orb ${state}` : "orb";
}

function showDebug(text) {
  if (debugMode) {
    debugLine.hidden = false;
    debugLine.textContent = text;
  }
}

// ---- Choosing a voice ----

// The family's choice from the questionnaire ("man" or "woman"; Guy is the
// default man's voice). See js/voices.js. A voice can be tried out by adding
// ?voice=Name to the address.
const voiceKind = (answers && answers.voice) || "man";
const requestedVoice = params.get("voice");

function pickVoice() {
  voice = pickVoiceFor(voiceKind, requestedVoice);
}

if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice; // voices often load a moment later
}

// ---- Sound meter ----

let soundLevel = null;  // reads the microphone's current loudness, once set up
let recentLevels = [];  // loudness readings from the last 10 seconds of listening
let lastSound = 0;      // when the elder was last heard making sound
let meter = null;       // the meter's microphone, audio and timer, so it can be turned off
let soundStartedAt = 0; // when a stretch of sound with no words began
let lastDidntCatch = -Infinity;

// Ask for the microphone a second time, just to measure loudness. Speech
// recognition doesn't tell us about sounds it can't turn into words.
async function startSoundMeter() {
  if (soundLevel || !navigator.mediaDevices?.getUserMedia || params.get("meter") === "off") return;
  try {
    // Turning off call-style processing keeps Windows from switching the
    // speakers or headphones into a lower-quality "phone call" mode.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    soundLevel = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const x of samples) sum += x * x;
      return Math.sqrt(sum / samples.length);
    };
    meter = { stream, audio, timer: setInterval(checkForSound, 100) };
  } catch {
    soundLevel = null; // no meter: the page still works on words alone
  }
}

// Turn the meter's microphone off completely.
function stopSoundMeter() {
  if (meter) {
    clearInterval(meter.timer);
    meter.stream.getTracks?.().forEach((track) => track.stop());
    meter.audio.close?.();
  }
  meter = null;
  soundLevel = null;
  recentLevels = [];
}

function checkForSound() {
  if (!listening || stopping) return;
  const level = soundLevel();
  // The room's background level is the quietest moment in the last 10 seconds.
  // Speech has tiny gaps between words, so talking doesn't fool it, and it
  // adjusts by itself to a fan or a TV.
  recentLevels.push(level);
  if (recentLevels.length > 100) recentLevels.shift();
  const quietLevel = Math.min(...recentLevels);
  const makingSound = level > Math.max(quietLevel * 3, 0.01);
  if (!makingSound) {
    // After a stretch of sound with no words and then a pause, ask again.
    const soundLasted = lastSound - soundStartedAt;
    const pausedSince = performance.now() - lastSound;
    if (soundStartedAt && !heardText && soundLasted >= SOUND_NO_WORDS_MS && pausedSince > END_OF_TURN_MS) {
      soundStartedAt = 0;
      didntCatch();
    } else if (pausedSince > END_OF_TURN_MS) {
      soundStartedAt = 0;
    }
    return;
  }

  // Sound that lasts a while with no words at all: they spoke, but the browser
  // couldn't make it out.
  if (!heardText) {
    soundStartedAt ||= performance.now();
  }
  lastSound = performance.now();
  // Once the elder has started talking, sound keeps the turn open, up to a limit.
  const wordsRecently = performance.now() - timings.lastWord < SOUND_WITHOUT_WORDS_MS;
  if (heardText && wordsRecently) {
    clearTimeout(endOfTurnTimer);
    endOfTurnTimer = setTimeout(finishTurn, pauseFor(heardText));
  }
}

// ---- Listening ----

// How long to wait for more words, given what has been heard so far.
function pauseFor(text) {
  const words = text.toLowerCase().replace(/[^a-z' ]/g, " ").trim().split(/\s+/);
  const lastOne = words.slice(-1).join(" ");
  const lastTwo = words.slice(-2).join(" ");
  const sentenceEnded = /[.!?]$/.test(text.trim());
  const unfinished = !sentenceEnded && (UNFINISHED_ENDINGS.includes(lastOne) || UNFINISHED_ENDINGS.includes(lastTwo));
  const pause = words.length > STORY_WORDS ? STORY_PAUSE_MS : END_OF_TURN_MS;
  return unfinished ? pause + UNFINISHED_EXTRA_MS : pause;
}

// keepSilence: the silence clock keeps running (used after a turn that turned
// out to have no words, so empty results can't keep postponing the check-in).
function startListening({ keepSilence = false } = {}) {
  if (!keepSilence) quietSince = performance.now();
  heardText = "";
  soundStartedAt = 0;
  earlierText = "";
  confidences = [];
  earlierConfidences = [];
  micRestarts = 0;
  listening = true;
  speaking = false;
  interruptHint.hidden = true;
  setStatus("Listening…");
  setOrb("listening");
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

// Every half second, check how long it's been since the elder said anything.
setInterval(() => {
  if (!listening || stopping || heardText) return;
  if (performance.now() - quietSince > (checkedIn ? IDLE_END_MS : IDLE_CHECK_MS)) {
    onSilence();
  }
}, 500);

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

    // Collect everything heard so far in this turn. The browser sends a quick
    // first guess and later a cleaned-up final version; use the final version
    // where we have it and the first guess for the rest, so we never wait on it.
    // Each listening session starts a fresh list, so add what came before.
    let text = earlierText;
    for (let i = 0; i < event.results.length; i++) {
      text += " " + event.results[i][0].transcript;
    }
    // Edge sometimes reports a result with no words in a quiet room: ignore it.
    if (!text.trim() || text.trim() === heardText) {
      return;
    }
    heardText = text.trim();
    // Browsers report 0 when they don't know how sure they are; leave those out.
    confidences = earlierConfidences.concat(
      Array.from(event.results)
        .filter((result) => result.isFinal && result[0].confidence > 0)
        .map((result) => result[0].confidence)
    );
    timings.lastWord = performance.now();
    quietSince = timings.lastWord; // they're talking, so no silence check-in
    soundStartedAt = 0;

    // Each new bit of speech restarts the quiet-pause timer.
    clearTimeout(endOfTurnTimer);
    endOfTurnTimer = setTimeout(finishTurn, pauseFor(heardText));
  };

  // Problems the family needs to fix: say so plainly and stop.
  recognition.onerror = (event) => {
    const problems = {
      "not-allowed": "The microphone is blocked. Click the lock icon at the left of the address bar, set Microphone to Allow, then press Start.",
      "service-not-allowed": "The microphone is blocked. Click the lock icon at the left of the address bar, set Microphone to Allow, then press Start.",
      "audio-capture": "No microphone was found. Check that one is connected and turned on, then press Start.",
      network: "Listening needs an internet connection. Check the connection, then press Start.",
    };
    if (problems[event.error]) {
      endConversation();
      showProblem(problems[event.error]);
    } else if (event.error === "no-match" && listening) {
      didntCatch();
    }
  };

  // Edge often stops listening on its own after a short silence; restart if
  // we still want it on. Keep the words heard so far, and don't count the
  // restart gap as part of the elder's pause.
  recognition.onend = () => {
    const wasOurStop = stopping;
    stopping = false;
    if (listening) {
      if (!wasOurStop) {
        earlierText = heardText;
        earlierConfidences = confidences;
        micRestarts++;
        if (heardText) {
          clearTimeout(endOfTurnTimer);
          endOfTurnTimer = setTimeout(finishTurn, pauseFor(heardText));
        }
      }
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
    startListening({ keepSilence: true });
    return;
  }

  // Probably mumbling: a few words the browser wasn't sure about.
  const sureness = confidences.length ? Math.min(...confidences) : 1;
  timings.confidence = confidences.length ? sureness : null;
  const shortTurn = said.split(/\s+/).length <= SHORT_TURN_WORDS;
  if (shortTurn && sureness < LOW_CONFIDENCE && performance.now() - lastDidntCatch > DIDNT_CATCH_GAP_MS) {
    showDebug(`Heard: "${said}" (sure: ${sureness.toFixed(2)}), asked to say it again`);
    sayDidntCatch();
    return;
  }

  checkedIn = false;
  sendTurn(said);
}

// A long silence: first a gentle check-in from the companion; if there's
// still nothing after that, a short goodbye, and the microphone goes off.
function onSilence() {
  if (!listening || heardText) return;
  stopListening();
  if (checkedIn) {
    const speaker = sentenceSpeaker(++turnId, { endAfter: true, remember: false });
    currentSpeaker = speaker;
    speaker.add(FINAL_GOODBYE);
    speaker.finish();
  } else {
    checkedIn = true;
    sendTurn(IDLE_NOTE);
  }
}

// Heard sound but no words: gently ask them to say it again (not too often).
function didntCatch() {
  if (!listening || heardText || performance.now() - lastDidntCatch < DIDNT_CATCH_GAP_MS) return;
  stopListening();
  sayDidntCatch();
}

function sayDidntCatch() {
  lastDidntCatch = performance.now();
  const speaker = sentenceSpeaker(++turnId, { remember: false });
  currentSpeaker = speaker;
  speaker.add(DIDNT_CATCH);
  speaker.finish();
}

// The companion couldn't respond: say sorry, stop, and tell the family why.
function stopForProblem(message) {
  const speaker = sentenceSpeaker(++turnId, { endAfter: true, remember: false });
  currentSpeaker = speaker;
  speaker.onEnded = () => showProblem(message);
  speaker.add(SORRY_STOP);
  speaker.finish();
}

// Ends the conversation: microphone off (both the listening and the sound
// meter), orb hidden, and the big Start button back.
function endConversation() {
  const wasListening = listening;
  turnId++; // first, so nothing from the current turn carries on
  listening = false;
  speaking = false;
  speechSynthesis.cancel();
  clearTimeout(endOfTurnTimer);
  if (replyRequest) replyRequest.abort();
  // Only stop listening if it's on: stopping it when it's already off would
  // leave the page waiting for a "stopped" signal that never comes.
  if (recognition && wasListening) {
    stopping = true;
    try {
      recognition.stop();
    } catch {
      stopping = false;
    }
  }
  stopSoundMeter();
  setOrb(null);
  interruptHint.hidden = true;
  setStatus("");
  stopButton.hidden = true;
  startButton.hidden = false;
}

async function sendTurn(said) {
  const thisTurn = ++turnId;
  history.push({ role: "user", content: said });
  setStatus("Thinking…");
  setOrb("thinking");
  timings = { lastWord: timings.lastWord, sent: performance.now(), micRestarts, confidence: timings.confidence };
  voiceNote = "";
  showDebug(`Heard: "${said}"`);

  const speaker = sentenceSpeaker(thisTurn);
  currentSpeaker = speaker;
  replyRequest = new AbortController();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, history }),
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
      timings.firstText ??= performance.now();
      speaker.add(decoder.decode(value, { stream: true }));
    }
    speaker.finish();
  } catch (error) {
    if (thisTurn !== turnId) return; // interrupted on purpose
    const message = error instanceof TypeError
      ? "The companion couldn't be reached. Check the internet connection, then press Start."
      : `${error.message} Press Start to try again.`;
    stopForProblem(message);
  }
}

// ---- Speaking ----

// For the ?debug testing line: where the time went between the elder's last
// word and the companion's first word.
function showTimings() {
  const seconds = (from, to) => ((to - from) / 1000).toFixed(1) + "s";
  showDebug(
    `Heard: "${history.length ? history[history.length - 1].content : ""}"\n` +
      `Waiting for the pause: ${seconds(timings.lastWord, timings.sent)} · ` +
      `Claude's first words: ${seconds(timings.sent, timings.firstText)} · ` +
      `Voice starting: ${seconds(timings.firstText, timings.voiceStart)} · ` +
      `Total: ${seconds(timings.lastWord, timings.voiceStart)} · ` +
      `Listening restarts: ${timings.micRestarts} · Sound meter: ${soundLevel ? "on" : "off"} · ` +
      `Sure of the words: ${timings.confidence == null ? "not reported" : timings.confidence.toFixed(2)}\n` +
      `Voice: ${timings.voiceName || "browser default"} at speed ${SPEAKING_RATE}${voiceNote}`
  );
}

// If a sentence hasn't started playing after this long, the voice is stuck.
const VOICE_STUCK_MS = 5000;

// Browsers can forget an utterance that is still waiting to play, and then
// never report that it finished. Holding on to each one prevents that.
const activeUtterances = new Set();

// A voice that runs on the computer itself, for when an online voice fails.
function localVoice() {
  return localVoiceFor(voiceKind);
}

// Symbols the voice would read aloud ("M asterisk A asterisk…"): remove them.
function speakable(text) {
  return text
    .replace(/[*_#`~|<>\[\]{}]/g, "")
    .replace(/&/g, " and ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
}

// Removes the elder's name where it's tacked on: "That's grand, George." becomes
// "That's grand." and a lone "George." disappears. A name inside a sentence stays.
// The very first reply may use the name in its greeting.
function withoutTackedOnName(text) {
  const firstReply = !history.some((message) => message.role === "assistant");
  if (!elderName || firstReply) return text;
  const name = elderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`(^|[.!?]\\s+)${name}([.!?])\\s*`, "g"), "$1")
    .replace(new RegExp(`,\\s*${name}([.!?])`, "g"), "$1");
}

// Collects the reply as it streams in and speaks each sentence as soon as
// it is complete. When the last sentence has been spoken, listening resumes.
// Options: endAfter ends the conversation once everything is spoken;
// remember: false keeps the words out of the conversation history.
function sentenceSpeaker(thisTurn, { endAfter = false, remember = true } = {}) {
  let rawReply = "";   // everything Claude wrote, for the testing line
  let pending = "";    // text not yet complete enough to speak
  let spoken = "";     // what the elder has actually heard so far
  const waiting = [];  // sentences handed to the voice but not yet finished
  let finished = false;
  let attempt = 0;     // goes up if the voice gets stuck and we start over
  let replyVoice = voice; // the voice for this reply; the next reply starts with the usual voice again
  let playing = false; // a sentence is being heard right now
  let lastVoiceActivity = 0;
  let watchdog = null;

  // Every second, check for sentences waiting while nothing has played for a while.
  function watchVoice() {
    clearInterval(watchdog);
    watchdog = setInterval(() => {
      if (thisTurn !== turnId || (finished && waiting.length === 0)) {
        clearInterval(watchdog);
      } else if (waiting.length > 0 && !playing && performance.now() - lastVoiceActivity > VOICE_STUCK_MS) {
        recoverFromStuckVoice();
      }
    }, 1000);
  }

  function say(sentence) {
    sentence = speakable(withoutTackedOnName(sentence));
    if (!sentence.trim()) return;
    if (!speaking) {
      speaking = true;
      setStatus("Speaking…");
      setOrb("speaking");
      interruptHint.hidden = false;
    }
    if (waiting.length === 0) {
      lastVoiceActivity = performance.now();
    }
    waiting.push(sentence);
    play(sentence);
    if (!watchdog) watchVoice();
  }

  function play(sentence) {
    const thisAttempt = attempt;
    const utterance = new SpeechSynthesisUtterance(sentence.trim());
    utterance.lang = "en-US";
    utterance.rate = SPEAKING_RATE;
    if (replyVoice) utterance.voice = replyVoice;
    activeUtterances.add(utterance);

    utterance.onstart = () => {
      if (thisTurn !== turnId || thisAttempt !== attempt) return;
      playing = true;
      lastVoiceActivity = performance.now();
      spoken += sentence;
      if (timings.voiceStart === undefined) {
        timings.voiceStart = performance.now();
        timings.voiceName = replyVoice ? replyVoice.name : "";
        showTimings();
      }
    };
    // A voice failure (not one we caused by cancelling) means trying another voice.
    utterance.onerror = (event) => {
      if (event && (event.error === "interrupted" || event.error === "canceled")) {
        utterance.onend();
      } else if (thisTurn === turnId && thisAttempt === attempt) {
        activeUtterances.delete(utterance);
        recoverFromStuckVoice();
      }
    };
    utterance.onend = () => {
      activeUtterances.delete(utterance);
      if (thisTurn !== turnId || thisAttempt !== attempt) return;
      playing = false;
      lastVoiceActivity = performance.now();
      waiting.shift();
      flush();
      maybeDone();
    };
    speechSynthesis.speak(utterance);
  }

  // If the voice fails: first try the same voice again (Edge's online voices
  // sometimes fail once right after being stopped), then a voice that runs on
  // the computer itself, just for this reply. After that, skip the reply.
  function recoverFromStuckVoice() {
    attempt++;
    playing = false;
    lastVoiceActivity = performance.now();
    speechSynthesis.cancel();
    const unspoken = waiting.splice(0);

    if (attempt === 1) {
      voiceNote = " (the voice didn't play; tried it again)";
    } else if (attempt === 2) {
      replyVoice = localVoice() || replyVoice;
      voiceNote = " (the online voice didn't play twice; used a voice on this computer for one reply)";
    } else {
      voiceNote = " (no voice would play; skipped a reply)";
      showDebug(voiceNote);
      finished = true;
      maybeDone();
      return;
    }
    showDebug(voiceNote);

    // A short wait gives the browser's voice a moment to reset.
    setTimeout(() => {
      if (thisTurn !== turnId) return;
      for (const sentence of unspoken) {
        waiting.push(sentence);
        play(sentence);
      }
      maybeDone();
    }, 400);
  }

  function maybeDone() {
    if (finished && waiting.length === 0 && thisTurn === turnId) {
      clearInterval(watchdog);
      if (debugMode && rawReply.trim()) {
        debugLine.textContent += `\nClaude wrote: "${rawReply.trim()}"`;
      }
      if (remember) {
        history.push({ role: "assistant", content: spoken.trim() || pending.trim() || "…" });
      }
      if (endAfter) {
        endConversation();
        api.onEnded?.();
      } else {
        startListening();
      }
    }
  }

  // Speak the first sentence as soon as it's complete, so the reply starts
  // quickly. After that, gather the rest while the voice is busy and speak it
  // in one longer stretch: fewer separate pieces sound much less robotic.
  // The companion ends its goodbye with [END]: never speak it, and end the
  // conversation once the goodbye has been said.
  function takeEndMarker() {
    if (/\[\s*END\s*\]/i.test(pending)) {
      pending = pending.replace(/\[\s*END\s*\]/gi, "");
      endAfter = true;
    }
  }

  function flush() {
    takeEndMarker();
    if (waiting.length > 0) {
      return; // still speaking; keep gathering
    }
    if (finished) {
      if (pending.trim()) {
        say(pending);
        pending = "";
      }
      return;
    }
    const match = pending.match(/^[\s\S]*[.!?…]["”’)]?(\s|$)/);
    if (!match) {
      return;
    }
    // A very short opening ("Hello, George!") spoken on its own sounds flat
    // and robotic, so wait for the next sentence and say them together.
    const nothingSaidYet = rawReply.length === pending.length;
    if (nothingSaidYet && match[0].trim().split(/\s+/).length < SHORT_OPENING_WORDS) {
      return;
    }
    say(match[0]);
    pending = pending.slice(match[0].length);
  }

  const api = {
    add(text) {
      rawReply += text;
      pending += text;
      flush();
    },
    finish() {
      finished = true;
      flush();
      if (waiting.length === 0 && !speaking) {
        // Nothing came back at all.
        if (thisTurn !== turnId) return;
        if (endAfter) {
          endConversation(); // only the end signal came back
        } else {
          stopForProblem("The companion didn't answer. Press Start to try again.");
        }
        return;
      }
      maybeDone();
    },
    heard() {
      return spoken;
    },
  };
  return api;
}

// ---- Tap to interrupt ----

document.addEventListener("click", (event) => {
  // Selecting text (for example, copying the testing line) is not a tap.
  const selectingText = window.getSelection && window.getSelection().toString() !== "";
  if (!speaking || event.target === startButton || event.target === stopButton || debugLine.contains(event.target) || selectingText) {
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

// ---- Voice warm-up ----

// Edge's natural voices are made online by Microsoft. A silent sample when
// Start is pressed opens that connection, so the first real reply doesn't
// sound rougher than the rest.
function warmUpVoice() {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance("Hello.");
  utterance.lang = "en-US";
  utterance.volume = 0;
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

// ---- Stop ----

// The small Stop button: end right away, with no goodbye.
stopButton.addEventListener("click", () => {
  endConversation();
});

// ---- Start ----

// Without answers there's no one to talk with yet: point the family back.
if (!answers) {
  startButton.hidden = true;
  document.getElementById("not-set-up").hidden = false;
}

startButton.addEventListener("click", () => {
  if (!SpeechRecognition) {
    showProblem("This browser can't listen yet. Please open this page in Microsoft Edge or Google Chrome.");
    return;
  }
  if (!recognition) {
    setUpRecognition();
  }
  history = [];
  checkedIn = false;
  showProblem("");
  startButton.hidden = true;
  stopButton.hidden = false;
  warmUpVoice();
  startSoundMeter();
  startListening();
});
