const storageKey = "anchor.prototype.v1";
const todayKey = new Date().toISOString().slice(0, 10);

const metrics = [
  { key: "sleepHours", label: "Sleep", unit: "h", max: 12, step: 0.5, target: 8, scoreMax: 20, good: 7, okay: 6 },
  { key: "movementMinutes", label: "Movement", unit: "m", max: 180, step: 5, target: 30, scoreMax: 20, good: 30, okay: 15 },
  { key: "mealsCount", label: "Meals", unit: "", max: 6, step: 1, target: 3, scoreMax: 15, good: 2, okay: 1 },
  { key: "outdoorMinutes", label: "Outdoors", unit: "m", max: 180, step: 5, target: 30, scoreMax: 10, good: 15, okay: 5 },
  { key: "socialMinutes", label: "Social", unit: "m", max: 240, step: 5, target: 45, scoreMax: 10, good: 20, okay: 5 },
  { key: "creativeMinutes", label: "Build time", unit: "m", max: 240, step: 5, target: 60, scoreMax: 10, good: 30, okay: 10 },
  {
    key: "screenHours",
    label: "Passive screen time",
    unit: "h",
    max: 16,
    step: 0.5,
    target: 8,
    scoreMax: 10,
    reverse: true,
    good: 2,
    okay: 4,
    help: "Only count escape-mode scrolling, YouTube, Netflix, gaming without enjoyment, or waiting for replies. Do not count work or intentional building time.",
  },
];

const moods = ["calm", "okay", "anxious", "sad", "angry", "numb", "lonely", "overwhelmed"];
const resets = ["20 pushups", "10-min walk", "cold face wash", "breathing timer", "clean room for 5 mins", "drink water", "eat something"];
const missions = [
  { title: "12-minute walk, no phone", reason: "For anxious energy and rumination.", mood: "anxious" },
  { title: "Text one friend", reason: "For isolation and low social contact.", mood: "lonely" },
  { title: "Go to a cafe or store", reason: "For numbness and too much indoor time.", mood: "numb" },
  { title: "20-minute run", reason: "For restless energy.", mood: "restless" },
  { title: "Shower + clean one surface", reason: "For sadness and shutdown.", mood: "sad" },
  { title: "Write facts vs stories", reason: "For overthinking loops.", mood: "overwhelmed" },
  { title: "Lift weights or do pushups", reason: "For low confidence and body activation.", mood: "low" },
  { title: "Regulate first, talk later", reason: "For relationship spirals.", mood: "relationship" },
];

const defaultState = {
  date: todayKey,
  selectedMood: "anxious",
  moodLogged: false,
  mood: null,
  intensity: 5,
  reason: "unknown",
  daily: {
    sleepHours: 0,
    movementMinutes: 0,
    mealsCount: 0,
    outdoorMinutes: 0,
    socialMinutes: 0,
    creativeMinutes: 0,
    screenHours: 0,
  },
  projectName: "AI assistant build",
  lastProjectDate: null,
  currentMission: 0,
  spiralStep: 0,
  selectedReset: "10-min walk",
  recheck: null,
  spiralLogs: [],
  relationshipLogs: [],
  eveningReview: null,
};

let state = loadState();
let timerId = null;
let timerRemaining = 20 * 60;

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(defaultState);

  try {
    const saved = JSON.parse(raw);
    if (saved.date !== todayKey) {
      return {
        ...structuredClone(defaultState),
        relationshipLogs: saved.relationshipLogs || [],
        spiralLogs: saved.spiralLogs || [],
        projectName: saved.projectName || defaultState.projectName,
        lastProjectDate: saved.lastProjectDate || null,
      };
    }
    return {
      ...structuredClone(defaultState),
      ...saved,
      daily: { ...defaultState.daily, ...(saved.daily || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDateLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function scoreMetric(metric) {
  const value = Number(state.daily[metric.key] || 0);
  const target = metric.target || metric.max;
  if (metric.reverse) {
    const ratio = clamp(1 - value / target, 0, 1);
    return Math.round(ratio * metric.scoreMax);
  }
  const ratio = clamp(value / target, 0, 1);
  return Math.round(ratio * metric.scoreMax);
}

function anchorScore() {
  const bodyScore = metrics.reduce((sum, metric) => sum + scoreMetric(metric), 0);
  return clamp(bodyScore + (state.moodLogged ? 5 : 0), 0, 100);
}

function metricStatus(metric) {
  const value = Number(state.daily[metric.key] || 0);
  if (metric.reverse) {
    if (value <= metric.good) return "okay";
    if (value <= metric.okay) return "watch";
    return "high";
  }
  if (value >= metric.good) return "okay";
  if (value >= metric.okay) return "watch";
  return "low";
}

function biggestRisk() {
  const ranked = metrics
    .map((metric) => {
      const possible = metric.scoreMax;
      const actual = scoreMetric(metric);
      return { metric, gap: possible - actual, status: metricStatus(metric) };
    })
    .sort((a, b) => b.gap - a.gap);

  return ranked[0];
}

function nextAction() {
  const risk = biggestRisk();
  if (!risk) return "Drink water, eat something small, then take a 10-minute walk.";

  const key = risk.metric.key;
  const actions = {
    sleepHours: "Keep decisions small today. Eat, move lightly, and protect bedtime.",
    movementMinutes: "Take a 10-minute walk before analyzing anything.",
    mealsCount: "Eat something with protein and drink water.",
    outdoorMinutes: "Go outside for 10 minutes with no phone.",
    socialMinutes: "Send one low-pressure message to a friend.",
    creativeMinutes: "Work on your own project for 20 minutes.",
    screenHours: "Break passive mode: shower, walk, meal, or message a friend.",
  };
  return actions[key] || "Choose one small stabilizing action.";
}

function scoreMessage(score) {
  if (score >= 80) return "Stable enough to think clearly.";
  if (score >= 60) return "Today needs grounding before interpretation.";
  if (score >= 40) return "Do body basics before relationship conclusions.";
  return "Stabilize first. Food, movement, water, then decide.";
}

function render() {
  renderShell();
  renderScore();
  renderMood();
  renderMetrics();
  renderMission();
  renderProject();
  renderSpiral();
  renderRelationship();
  renderEvening();
}

function renderShell() {
  document.querySelector("#todayLabel").textContent = formatDateLabel();
}

function renderScore() {
  const score = anchorScore();
  const risk = biggestRisk();
  const circumference = 351.86;
  const offset = circumference - (score / 100) * circumference;

  document.querySelector("#anchorScore").textContent = score;
  document.querySelector("#widgetScore").textContent = score;
  document.querySelector("#scoreRing").style.strokeDashoffset = offset;
  document.querySelector("#scoreRing").style.stroke = score < 45 ? "var(--risk)" : score < 70 ? "var(--warm)" : "var(--accent)";
  document.querySelector("#scoreMessage").textContent = scoreMessage(score);
  document.querySelector("#riskFactor").textContent = risk
    ? `Biggest risk factor: ${risk.metric.label.toLowerCase()} is ${risk.status}.`
    : "Log a few anchors to find the biggest risk factor.";

  const action = nextAction();
  document.querySelector("#nextAction").textContent = action;
  document.querySelector("#widgetAction").textContent = action.length > 34 ? action.slice(0, 34) + "..." : action;
  document.querySelector("#widgetStatus").textContent = score >= 70 ? "Stable" : score >= 45 ? "Needs grounding" : "Low";

  const widgetStatusGrid = document.querySelector("#widgetStatusGrid");
  widgetStatusGrid.innerHTML = "";
  ["movementMinutes", "mealsCount", "sleepHours", "socialMinutes", "screenHours"].forEach((key) => {
    const metric = metrics.find((item) => item.key === key);
    const pill = document.createElement("div");
    pill.className = "status-pill";
    pill.innerHTML = `<span>${metric.label}</span><strong>${metricStatus(metric)}</strong>`;
    widgetStatusGrid.append(pill);
  });
}

function renderMood() {
  const moodButtons = document.querySelector("#moodButtons");
  moodButtons.innerHTML = "";
  moods.forEach((mood) => {
    const button = document.createElement("button");
    button.className = `choice-button${state.selectedMood === mood ? " active" : ""}`;
    button.type = "button";
    button.textContent = mood;
    button.addEventListener("click", () => {
      state.selectedMood = mood;
      saveState();
      renderMood();
    });
    moodButtons.append(button);
  });

  document.querySelector("#intensityInput").value = state.intensity;
  document.querySelector("#intensityValue").textContent = state.intensity;
  document.querySelector("#reasonSelect").value = state.reason;
  document.querySelector("#checkinState").textContent = state.moodLogged ? `${state.mood}, ${state.intensity}/10` : "Not logged";
}

function renderMetrics() {
  const metricList = document.querySelector("#metricList");
  metricList.innerHTML = "";

  metrics.forEach((metric) => {
    const value = Number(state.daily[metric.key] || 0);
    const target = metric.target || metric.max;
    const percent = metric.reverse
      ? clamp((1 - value / target) * 100, 0, 100)
      : clamp((value / target) * 100, 0, 100);
    const valueLabel = metric.unit ? `${value}${metric.unit}` : `${value}`;
    const sliderMax = Math.max(metric.max, value + metric.step);

    const row = document.createElement("div");
    row.className = "metric";
    row.dataset.metricRow = metric.key;
    row.innerHTML = `
      <div class="metric-top">
        <span>${metric.label}</span>
        <strong data-metric-label="${metric.key}">${valueLabel} - ${metricStatus(metric)}</strong>
      </div>
      <div class="metric-track"><div class="metric-fill" data-metric-fill="${metric.key}" style="width: ${percent}%"></div></div>
      <div class="metric-controls">
        <button type="button" data-metric-minus="${metric.key}">-</button>
        <input aria-label="${metric.label}" type="range" min="0" max="${sliderMax}" step="${metric.step}" value="${value}" data-metric="${metric.key}" />
        <input aria-label="${metric.label} number" type="number" min="0" step="${metric.step}" value="${value}" data-metric-number="${metric.key}" />
        <button type="button" data-metric-plus="${metric.key}">+</button>
      </div>
      ${metric.help ? `<p class="metric-help">${metric.help}</p>` : ""}
    `;
    metricList.append(row);
  });
}

function updateMetricValue(key, value) {
  const metric = metrics.find((item) => item.key === key);
  const cleanValue = Math.max(0, Number.isFinite(value) ? value : 0);
  state.daily[key] = cleanValue;
  saveState();
  updateMetricRow(metric);
  renderScore();
  if (key === "creativeMinutes") renderProject();
}

function updateMetricRow(metric) {
  const value = Number(state.daily[metric.key] || 0);
  const target = metric.target || metric.max;
  const percent = metric.reverse
    ? clamp((1 - value / target) * 100, 0, 100)
    : clamp((value / target) * 100, 0, 100);
  const valueLabel = metric.unit ? `${value}${metric.unit}` : `${value}`;
  const label = document.querySelector(`[data-metric-label="${metric.key}"]`);
  const fill = document.querySelector(`[data-metric-fill="${metric.key}"]`);
  const range = document.querySelector(`[data-metric="${metric.key}"]`);
  const number = document.querySelector(`[data-metric-number="${metric.key}"]`);

  if (label) label.textContent = `${valueLabel} - ${metricStatus(metric)}`;
  if (fill) fill.style.width = `${percent}%`;
  if (range) {
    range.max = Math.max(metric.max, value + metric.step);
    range.value = value;
  }
  if (number) number.value = value;
}

function renderMission() {
  const mission = missions[state.currentMission % missions.length];
  document.querySelector("#missionTitle").textContent = mission.title;
  document.querySelector("#missionReason").textContent = mission.reason;
}

function localCoachInsight() {
  const score = anchorScore();
  const risk = biggestRisk();
  const mood = state.mood || state.selectedMood;
  const anxiousTrigger = state.relationshipLogs.at(-1)?.trigger;
  const base = score < 50
    ? "This looks like low stability, not a night for major conclusions."
    : "You have enough stability to act calmly, but keep the next step small.";

  const relationshipLine = anxiousTrigger
    ? `Your latest relationship trigger was "${anxiousTrigger}", so regulate before texting.`
    : "If this is relationship anxiety, regulate before you interpret it.";

  return `${base} Main pressure point: ${risk.metric.label.toLowerCase()} is ${risk.status}. Mood: ${mood}. ${relationshipLine} Do this now: ${nextAction()}`;
}

function renderProject() {
  document.querySelector("#projectNameInput").value = state.projectName;
  document.querySelector("#creativeInput").value = state.daily.creativeMinutes;
  document.querySelector("#creativeValue").textContent = state.daily.creativeMinutes;

  const gap = state.lastProjectDate ? daysBetween(state.lastProjectDate, todayKey) : 0;
  document.querySelector("#projectGap").textContent = `${gap} day${gap === 1 ? "" : "s"}`;
  document.querySelector("#projectOutput").textContent =
    gap >= 4
      ? `You have not worked on ${state.projectName} in ${gap} days. Your life needs forward motion.`
      : `Keep ${state.projectName} as proof your identity is bigger than today's anxiety.`;
}

function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((new Date(endDate) - new Date(startDate)) / oneDay));
}

function renderSpiral() {
  const stepper = document.querySelector("#spiralStepper");
  stepper.innerHTML = "";
  for (let index = 0; index < 5; index += 1) {
    const dot = document.createElement("div");
    dot.className = `step-dot${index <= state.spiralStep ? " active" : ""}`;
    stepper.append(dot);
  }

  document.querySelectorAll(".flow-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === state.spiralStep);
  });

  const choices = document.querySelector("#bodyResetChoices");
  choices.innerHTML = "";
  resets.forEach((reset) => {
    const button = document.createElement("button");
    button.className = `choice-button${state.selectedReset === reset ? " active" : ""}`;
    button.type = "button";
    button.textContent = reset;
    button.addEventListener("click", () => {
      state.selectedReset = reset;
      saveState();
      renderSpiral();
    });
    choices.append(button);
  });

  document.querySelector("#resetCount").textContent = state.spiralLogs.length;
  const list = document.querySelector("#spiralLogList");
  list.innerHTML = "";
  state.spiralLogs.slice(-5).reverse().forEach((log) => {
    const item = document.createElement("div");
    item.className = "log-item";
    item.innerHTML = `
      <strong>${log.recheck || "saved"} after ${log.action}</strong>
      <span>${log.fact || "No fact recorded"} / ${log.story || "No story recorded"}</span>
    `;
    list.append(item);
  });
  if (!state.spiralLogs.length) {
    list.innerHTML = `<p class="coach-output">No spiral logs yet. The first win is delaying reassurance by 20 minutes.</p>`;
  }
}

function renderRelationship() {
  document.querySelector("#relationshipIntensity").value = state.relationshipIntensity || 6;
  document.querySelector("#relationshipIntensityValue").textContent = state.relationshipIntensity || 6;
  document.querySelector("#relationshipLogCount").textContent = `${state.relationshipLogs.length} logs`;

  const list = document.querySelector("#relationshipLogList");
  list.innerHTML = "";
  state.relationshipLogs.slice(-5).reverse().forEach((log) => {
    const item = document.createElement("div");
    item.className = "log-item";
    item.innerHTML = `
      <strong>${log.trigger} - ${log.intensity}/10</strong>
      <span>Reassurance: ${log.reassuranceSought ? "asked" : "not asked"}; relief: ${log.reliefDuration}</span>
    `;
    list.append(item);
  });
  if (!state.relationshipLogs.length) {
    list.innerHTML = `<p class="coach-output">No relationship triggers logged today.</p>`;
  }

  document.querySelector("#relationshipPattern").textContent = relationshipPattern();
}

function relationshipPattern() {
  if (state.relationshipLogs.length < 3) {
    return "Log at least 3 triggers to begin pattern detection. The app will compare triggers against sleep, movement, passive screen time, and social contact.";
  }

  const commonTrigger = mode(state.relationshipLogs.map((log) => log.trigger));
  const risk = biggestRisk();
  return `Your anxiety is showing up most around "${commonTrigger}" while ${risk.metric.label.toLowerCase()} is ${risk.status}. Treat your state as evidence too.`;
}

function mode(values) {
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function renderEvening() {
  const score = anchorScore();
  const risk = biggestRisk();
  const output = state.eveningReview
    ? state.eveningReview.output
    : `Today was ${risk.metric.label.toLowerCase()}-${risk.status}. Tomorrow's best move: ${nextAction().toLowerCase()}`;
  document.querySelector("#eveningOutput").textContent = output;
  document.querySelector("#eveningSavedState").textContent = state.eveningReview ? "Saved" : "Draft";
  document.querySelector("#eveningOutput").dataset.score = score;
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });

  document.querySelector("#intensityInput").addEventListener("input", (event) => {
    state.intensity = Number(event.target.value);
    saveState();
    renderMood();
  });

  document.querySelector("#reasonSelect").addEventListener("change", (event) => {
    state.reason = event.target.value;
    saveState();
  });

  document.querySelector("#logMoodButton").addEventListener("click", () => {
    state.mood = state.selectedMood;
    state.moodLogged = true;
    saveState();
    document.querySelector("#moodOutput").textContent = `${capitalize(state.mood)} logged. Before you analyze it, do one body reset.`;
    render();
  });

  document.querySelector("#metricList").addEventListener("input", (event) => {
    const key = event.target.dataset.metric || event.target.dataset.metricNumber;
    if (!key) return;
    updateMetricValue(key, Number(event.target.value));
  });

  document.querySelector("#metricList").addEventListener("click", (event) => {
    const minus = event.target.dataset.metricMinus;
    const plus = event.target.dataset.metricPlus;
    const key = minus || plus;
    if (!key) return;
    const metric = metrics.find((item) => item.key === key);
    const step = metric.step;
    const direction = plus ? 1 : -1;
    updateMetricValue(key, Number(state.daily[key] || 0) + step * direction);
  });

  document.querySelector("#newMissionButton").addEventListener("click", () => {
    state.currentMission = (state.currentMission + 1) % missions.length;
    saveState();
    renderMission();
  });

  document.querySelector("#missionDoneButton").addEventListener("click", () => {
    const mission = missions[state.currentMission % missions.length];
    if (mission.title.includes("walk")) state.daily.movementMinutes = Math.max(state.daily.movementMinutes, 12);
    if (mission.title.includes("friend")) state.daily.socialMinutes = Math.max(state.daily.socialMinutes, 10);
    if (mission.title.includes("project")) state.daily.creativeMinutes = Math.max(state.daily.creativeMinutes, 20);
    saveState();
    render();
  });

  document.querySelector("#localCoachButton").addEventListener("click", () => {
    document.querySelector("#localCoachOutput").textContent = localCoachInsight();
  });

  document.querySelector("#creativeInput").addEventListener("input", (event) => {
    state.daily.creativeMinutes = Number(event.target.value);
    saveState();
    renderProject();
    renderScore();
  });

  document.querySelector("#saveProjectButton").addEventListener("click", () => {
    state.projectName = document.querySelector("#projectNameInput").value.trim() || "personal project";
    state.lastProjectDate = todayKey;
    saveState();
    render();
  });

  document.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.spiralStep = clamp(state.spiralStep + 1, 0, 4);
      saveState();
      renderSpiral();
    });
  });

  document.querySelector("#startTimerButton").addEventListener("click", startTimer);

  document.querySelectorAll("[data-recheck]").forEach((button) => {
    button.addEventListener("click", () => {
      state.recheck = button.dataset.recheck;
      const output = {
        lower: "This was a nervous-system spike, not necessarily relationship evidence.",
        same: "Stay regulated. One more body action before you decide what the story means.",
        worse: "Now write calmly or schedule a conversation. Do not accuse from panic.",
      };
      document.querySelector("#recheckOutput").textContent = output[state.recheck];
      document.querySelectorAll("[data-recheck]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelector("#saveSpiralButton").addEventListener("click", saveSpiralLog);

  document.querySelector("#relationshipIntensity").addEventListener("input", (event) => {
    state.relationshipIntensity = Number(event.target.value);
    saveState();
    renderRelationship();
  });

  document.querySelector("#saveRelationshipButton").addEventListener("click", saveRelationshipLog);
  document.querySelector("#buildMessageButton").addEventListener("click", buildMessage);
  document.querySelector("#saveEveningButton").addEventListener("click", saveEveningReview);
  document.querySelector("#doneActionButton").addEventListener("click", completeNextAction);
  document.querySelector("#resetDayButton").addEventListener("click", clearToday);
}

function setView(viewName) {
  const titles = {
    home: "Anchor Status",
    spiral: "Reset Flow",
    relationship: "Relationship Anxiety",
    evening: "Evening Review",
  };

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
  document.querySelector("#viewTitle").textContent = titles[viewName] || "Anchor";
}

function startTimer() {
  clearInterval(timerId);
  timerRemaining = 20 * 60;
  updateTimerDisplay();
  timerId = setInterval(() => {
    timerRemaining -= 1;
    updateTimerDisplay();
    if (timerRemaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      state.spiralStep = 4;
      saveState();
      renderSpiral();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60).toString().padStart(2, "0");
  const seconds = (timerRemaining % 60).toString().padStart(2, "0");
  document.querySelector("#timerDisplay").textContent = `${minutes}:${seconds}`;
}

function saveSpiralLog() {
  const log = {
    at: new Date().toISOString(),
    fear: document.querySelector("#fearInput").value.trim(),
    fact: document.querySelector("#factInput").value.trim(),
    story: document.querySelector("#storyInput").value.trim(),
    action: state.selectedReset,
    recheck: state.recheck || "not checked",
  };
  state.spiralLogs.push(log);
  state.spiralStep = 0;
  state.recheck = null;
  saveState();
  document.querySelector("#fearInput").value = "";
  document.querySelector("#factInput").value = "";
  document.querySelector("#storyInput").value = "";
  document.querySelector("#recheckOutput").textContent = "Choose the current state.";
  render();
}

function saveRelationshipLog() {
  const log = {
    at: new Date().toISOString(),
    trigger: document.querySelector("#relationshipTrigger").value,
    intensity: Number(document.querySelector("#relationshipIntensity").value),
    reassuranceSought: document.querySelector("#reassuranceSought").checked,
    reassuranceHelped: document.querySelector("#reassuranceHelped").checked,
    reliefDuration: document.querySelector("#reliefDuration").value,
    notes: document.querySelector("#relationshipNotes").value.trim(),
    stabilitySnapshot: { ...state.daily },
  };
  state.relationshipLogs.push(log);
  saveState();
  document.querySelector("#relationshipNotes").value = "";
  renderRelationship();
}

function buildMessage() {
  const raw = document.querySelector("#rawMessageInput").value.trim();
  const trigger = document.querySelector("#relationshipTrigger").value;
  const prefix = raw ? "I noticed I want to send something reactive. " : "";
  document.querySelector("#reframedMessage").textContent =
    `${prefix}I am feeling emotionally unsettled around ${trigger}. I do not want to control what you do, but I would like to talk about how we can rebuild closeness and emotional safety.`;
}

function saveEveningReview() {
  const helped = document.querySelector("#helpedInput").value.trim();
  const spiral = document.querySelector("#spiralCauseInput").value.trim();
  const tomorrow = document.querySelector("#tomorrowAnchorInput").value.trim() || nextAction();
  const risk = biggestRisk();
  const output = `Today was ${risk.metric.label.toLowerCase()}-${risk.status}. Tomorrow's best move: ${tomorrow}.`;
  state.eveningReview = { helped, spiral, tomorrow, output, at: new Date().toISOString() };
  saveState();
  renderEvening();
}

function completeNextAction() {
  const risk = biggestRisk();
  const key = risk.metric.key;
  const updates = {
    movementMinutes: 10,
    mealsCount: 1,
    outdoorMinutes: 10,
    socialMinutes: 10,
    creativeMinutes: 20,
    sleepHours: 0,
    screenHours: -0.5,
  };

  if (key === "screenHours") {
    state.daily.screenHours = Math.max(0, Number(state.daily.screenHours || 0) + updates.screenHours);
  } else {
    state.daily[key] = clamp(Number(state.daily[key] || 0) + updates[key], 0, metrics.find((metric) => metric.key === key).max);
  }
  saveState();
  render();
}

function clearToday() {
  state = {
    ...structuredClone(defaultState),
    relationshipLogs: state.relationshipLogs,
    spiralLogs: state.spiralLogs,
    projectName: state.projectName,
    lastProjectDate: state.lastProjectDate,
  };
  saveState();
  render();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

bindEvents();
render();

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works without offline install support.
    });
  });
}
