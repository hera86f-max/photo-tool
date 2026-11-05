const pushedAdTabs = new Set();

function pushAdForTab(tabName) {
  if (pushedAdTabs.has(tabName)) return;
  const panel = document.getElementById(`${tabName}Tab`);
  if (!panel) return;
  const ins = panel.querySelector(".adsbygoogle");
  if (!ins) return;

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    pushedAdTabs.add(tabName);
  } catch (err) {
    console.warn("광고 로드 실패", err);
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => pushAdForTab(btn.dataset.tab));
});

const initialActiveBtn = document.querySelector(".tab-btn.active");
if (initialActiveBtn) {
  pushAdForTab(initialActiveBtn.dataset.tab);
}
