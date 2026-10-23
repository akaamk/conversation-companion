// The family questionnaire: save the answers for this visit, then open the
// Conversation page. Nothing is sent anywhere until a conversation starts.

const form = document.getElementById("questionnaire");
const nameInput = document.getElementById("name");
const nameError = document.getElementById("name-error");

const FIELDS = ["name", "ageAndOrigin", "personality", "interests", "experiences", "holdBack", "communication", "upsetting"];

// For testing and the demo video: add ?demo to the address to fill in the
// fictionalized demo elder's answers.
if (new URLSearchParams(location.search).has("demo") && typeof DEMO_ANSWERS !== "undefined") {
  for (const field of FIELDS) {
    form.elements[field].value = DEMO_ANSWERS[field] || "";
  }
}

// If the family comes back to change something, show what they wrote before.
try {
  const saved = JSON.parse(sessionStorage.getItem("companionAnswers") || "null");
  if (saved && !form.elements.name.value) {
    for (const field of FIELDS) {
      form.elements[field].value = saved[field] || "";
    }
  }
} catch {
  // Nothing saved, or storage unavailable: start with an empty form.
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!nameInput.value.trim()) {
    nameError.hidden = false;
    nameInput.focus();
    return;
  }

  const answers = {};
  for (const field of FIELDS) {
    answers[field] = form.elements[field].value.trim();
  }
  sessionStorage.setItem("companionAnswers", JSON.stringify(answers));
  location.href = "/conversation.html";
});

nameInput.addEventListener("input", () => {
  nameError.hidden = true;
});
