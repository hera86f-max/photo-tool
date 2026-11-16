const mergeLayoutSelect = document.getElementById("mergeLayout");
const mergeSpacingInput = document.getElementById("mergeSpacing");
const mergeSpacingValue = document.getElementById("mergeSpacingValue");
const mergeBgColorInput = document.getElementById("mergeBgColor");
const mergeCropFillInput = document.getElementById("mergeCropFill");
const mergeGrid = document.getElementById("mergeGrid");
const mergeEmptyHint = document.getElementById("mergeEmptyHint");
const mergeBtn = document.getElementById("mergeBtn");
const mergeProgressBar = document.getElementById("mergeProgressBar");
const mergeStatusText = document.getElementById("mergeStatusText");
const mergeDownloadBtn = document.getElementById("mergeDownloadBtn");
const mergePreviewWrap = document.getElementById("mergePreviewWrap");
const mergePreviewImg = document.getElementById("mergePreviewImg");

const MAX_MERGE_PHOTOS = 6;
let mergeSelectedIds = [];

mergeSpacingInput.addEventListener("input", () => {
  mergeSpacingValue.textContent = `${mergeSpacingInput.value}px`;
});

function renderMergeGrid() {
  mergeGrid.innerHTML = "";
  mergeEmptyHint.style.display = photos.length ? "none" : "block";
  mergeSelectedIds = mergeSelectedIds.filter((id) => photos.some((p) => p.id === id));

  photos.forEach((photo) => {
    const item = document.createElement("div");
    item.className = "merge-thumb";
    const selectedIndex = mergeSelectedIds.indexOf(photo.id);
    if (selectedIndex !== -1) item.classList.add("selected");

    const img = document.createElement("img");
    img.src = photo.thumb;
    item.appendChild(img);

    if (selectedIndex !== -1) {
      const badge = document.createElement("span");
      badge.className = "merge-order-badge";
      badge.textContent = selectedIndex + 1;
      item.appendChild(badge);
    }

    item.addEventListener("click", () => {
      const idx = mergeSelectedIds.indexOf(photo.id);
      if (idx !== -1) {
        mergeSelectedIds.splice(idx, 1);
      } else {
        if (mergeSelectedIds.length >= MAX_MERGE_PHOTOS) {
          alert(`사진은 최대 ${MAX_MERGE_PHOTOS}장까지 합칠 수 있어요.`);
          return;
        }
        mergeSelectedIds.push(photo.id);
      }
      renderMergeGrid();
    });

    mergeGrid.appendChild(item);
  });
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "merge") renderMergeGrid();
  });
});

mergeBtn.addEventListener("click", async () => {
  if (mergeSelectedIds.length < 2) {
    alert("사진을 2장 이상 선택해 주세요.");
    return;
  }

  mergeBtn.disabled = true;
  mergeDownloadBtn.style.display = "none";
  mergePreviewWrap.style.display = "none";
  mergeProgressBar.style.width = "30%";
  mergeStatusText.textContent = "합치는 중...";

  const items = mergeSelectedIds.map((id) => {
    const photo = photos.find((p) => p.id === id);
    return { stored_name: photo.stored_name };
  });

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("items_json", JSON.stringify(items));
  formData.append("layout", mergeLayoutSelect.value);
  formData.append("spacing", mergeSpacingInput.value);
  formData.append("bg_color", mergeBgColorInput.value);
  formData.append("crop_fill", mergeCropFillInput.checked ? "1" : "0");

  try {
    const res = await fetch("/api/merge-photos", { method: "POST", body: formData });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const url = `/api/file/${data.session_id}/${data.merge_name}`;
    mergePreviewImg.src = url;
    mergePreviewWrap.style.display = "block";
    mergeDownloadBtn.href = url;
    mergeDownloadBtn.style.display = "inline-flex";
    mergeProgressBar.style.width = "100%";
    mergeStatusText.textContent = "완료";
  } catch (err) {
    mergeStatusText.textContent = "합치기 실패";
    mergeProgressBar.style.width = "0%";
  } finally {
    mergeBtn.disabled = false;
  }
});

renderMergeGrid();
