const seoBody = document.getElementById("seoBody");
const seoBodyCount = document.getElementById("seoBodyCount");
const seoBodyWords = document.getElementById("seoBodyWords");
const seoBodyStatus = document.getElementById("seoBodyStatus");

seoBody.addEventListener("input", () => {
  const text = seoBody.value;
  const len = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  seoBodyCount.textContent = `${len}자`;
  seoBodyWords.textContent = `${words}단어`;
  seoBodyStatus.classList.remove("ok", "warn", "bad");
  if (len === 0) {
    seoBodyStatus.textContent = "";
  } else if (len >= 500) {
    seoBodyStatus.textContent = "SEO에 유리한 길이";
    seoBodyStatus.classList.add("ok");
  } else {
    seoBodyStatus.textContent = "조금 더 써보세요 (500자 권장)";
    seoBodyStatus.classList.add("warn");
  }
});
