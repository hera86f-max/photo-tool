const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}Tab`).classList.add("active");
  });
});

const emojiCategories = document.getElementById("emojiCategories");
const emojiGrid = document.getElementById("emojiGrid");
const emojiSearch = document.getElementById("emojiSearch");
const toast = document.getElementById("toast");

let activeCategory = Object.keys(EMOJI_DATA)[0];
const FAVORITES_CATEGORY = "자주 쓰는";
const USAGE_KEY = "blogTool_emojiUsage";

const emojiNameIndex = new Map();
Object.values(EMOJI_DATA).forEach((list) => {
  list.forEach(([emoji, name]) => {
    if (!emojiNameIndex.has(emoji)) emojiNameIndex.set(emoji, name);
  });
});

function loadUsage() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY)) || {};
  } catch (err) {
    return {};
  }
}

function recordUsage(emoji) {
  try {
    const data = loadUsage();
    data[emoji] = (data[emoji] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch (err) {
    // 저장 공간을 쓸 수 없는 환경일 수 있음
  }
}

function getFrequentList() {
  const usage = loadUsage();
  const entries = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (!entries.length) return EMOJI_DATA[FAVORITES_CATEGORY];
  return entries.map(([emoji]) => [emoji, emojiNameIndex.get(emoji) || emoji]);
}

function listForCategory(cat) {
  return cat === FAVORITES_CATEGORY ? getFrequentList() : EMOJI_DATA[cat];
}

function renderCategories() {
  emojiCategories.innerHTML = "";
  Object.keys(EMOJI_DATA).forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "emoji-cat-btn" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      emojiSearch.value = "";
      renderCategories();
      renderGrid(listForCategory(cat));
    });
    emojiCategories.appendChild(btn);
  });
}

function renderGrid(list) {
  emojiGrid.innerHTML = "";
  list.forEach(([emoji, name]) => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.textContent = emoji;
    btn.title = name;
    btn.addEventListener("click", () => copyEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
  if (window.twemoji) twemoji.parse(emojiGrid, { folder: "svg", ext: ".svg" });
}

async function copyEmoji(emoji) {
  try {
    await navigator.clipboard.writeText(emoji);
  } catch (err) {
    // 클립보드 접근이 막힌 환경일 수 있음
  }
  recordUsage(emoji);
  if (activeCategory === FAVORITES_CATEGORY) renderGrid(getFrequentList());

  toast.textContent = `복사됨: ${emoji}`;
  if (window.twemoji) twemoji.parse(toast, { folder: "svg", ext: ".svg" });
  toast.classList.add("show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 1200);
}

emojiSearch.addEventListener("input", () => {
  const q = emojiSearch.value.trim();
  if (!q) {
    renderGrid(listForCategory(activeCategory));
    return;
  }
  const matched = [];
  Object.values(EMOJI_DATA).forEach((list) => {
    list.forEach((entry) => {
      if (entry[1].includes(q) && !matched.includes(entry)) matched.push(entry);
    });
  });
  renderGrid(matched);
});

renderCategories();
renderGrid(listForCategory(activeCategory));
if (window.twemoji) twemoji.parse(document.body, { folder: "svg", ext: ".svg" });
