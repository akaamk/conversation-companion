// The Conversation page: listen to the elder, ask the helper for a reply,
// speak it aloud, then listen again.

// How long a quiet pause must last before we decide the elder has finished
// speaking. Longer means fewer interruptions mid-story.
const END_OF_TURN_MS = 2500;

const startButton = document.getElementById("start");
const statusText = document.getElementById("status");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let history = [];       // the conversation so far: [{ role, content }]
let heardText = "";     // what the elder has said in this turn
let endOfTurnTimer = null;
let listening = false;  // true while we want the microphone on

function setStatus(message) {
  statusText.textContent = message;
}

// ---- Listening ----

function startListening() {
  heardText = "";
  listening = true;
  setStatus("Listening…");
  try {
    recognition.start();
  } catch {
    // Already started; nothing to do.
  }
}

function stopListening() {
  listening = false;
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
    if (!listening) {
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

    // Each new bit of speech restarts the quiet-pause timer.
    clearTimeout(endOfTurnTimer);
    endOfTurnTimer = setTimeout(finishTurn, END_OF_TURN_MS);
  };

  // Some browsers stop listening on their own after a while; restart if we still want it on.
  recognition.onend = () => {
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

  history.push({ role: "user", content: said });
  setStatus("Thinking…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "The companion couldn't respond.");
    }

    history.push({ role: "assistant", content: data.reply });
    speak(data.reply, startListening);
  } catch (error) {
    setStatus(error.message);
    startButton.hidden = false;
  }
}

// ---- Speaking ----

function speak(text, whenDone) {
  setStatus("Speaking…");
  speechSynthesis.cancel(); // never let replies pile up
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.onend = whenDone;
  speechSynthesis.speak(utterance);
}

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
