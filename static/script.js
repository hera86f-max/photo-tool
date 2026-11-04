const addBtn = document.getElementById("addBtn");
const fileInput = document.getElementById("fileInput");
const clearBtn = document.getElementById("clearBtn");
const countLabel = document.getElementById("countLabel");
const photoGrid = document.getElementById("photoGrid");
const emptyHint = document.getElementById("emptyHint");

const commonKeyword = document.getElementById("commonKeyword");
const applyKeywordBtn = document.getElementById("applyKeywordBtn");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");
const maxSideInput = document.getElementById("maxSide");
const outputFormatSelect = document.getElementById("outputFormat");
const borderEnable = document.getElementById("borderEnable");
const borderWidthInput = document.getElementById("borderWidth");
const borderColorInput = document.getElementById("borderColor");
const watermarkEnable = document.getElementById("watermarkEnable");
const watermarkTextInput = document.getElementById("watermarkText");
const watermarkPositionSelect = document.getElementById("watermarkPosition");
const watermarkSizeInput = document.getElementById("watermarkSize");
const watermarkColorInput = document.getElementById("watermarkColor");
const watermarkOpacityInput = document.getElementById("watermarkOpacity");
const watermarkOpacityValue = document.getElementById("watermarkOpacityValue");
const watermarkImageEnable = document.getElementById("watermarkImageEnable");
const watermarkImageFile = document.getElementById("watermarkImageFile");
const watermarkImagePositionSelect = document.getElementById("watermarkImagePosition");
const watermarkImageScaleInput = document.getElementById("watermarkImageScale");
const watermarkImageOpacityInput = document.getElementById("watermarkImageOpacity");
const watermarkImageOpacityValue = document.getElementById("watermarkImageOpacityValue");
const watermarkImagePreview = document.getElementById("watermarkImagePreview");

const pickFolderBtn = document.getElementById("pickFolderBtn");
const folderLabel = document.getElementById("folderLabel");
const startBtn = document.getElementById("startBtn");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const downloadBtn = document.getElementById("downloadBtn");

let sessionId = null;
let photos = [];
let dirHandle = null;

function setOverlayCorner(el, position, margin) {
  el.style.top = "auto";
  el.style.bottom = "auto";
  el.style.left = "auto";
  el.style.right = "auto";
  el.style.transform = "none";

  if (position === "top-left") {
    el.style.top = `${margin}px`;
    el.style.left = `${margin}px`;
  } else if (position === "top-right") {
    el.style.top = `${margin}px`;
    el.style.right = `${margin}px`;
  } else if (position === "bottom-left") {
    el.style.bottom = `${margin}px`;
    el.style.left = `${margin}px`;
  } else if (position === "center") {
    el.style.top = "50%";
    el.style.left = "50%";
    el.style.transform = "translate(-50%, -50%)";
  } else {
    el.style.bottom = `${margin}px`;
    el.style.right = `${margin}px`;
  }
}

function updateCardWatermark(photo) {
  if (!photo._thumbWrap) return;
  const w = photo._thumbWrap.clientWidth || 220;

  const text = watermarkTextInput.value.trim();
  if (watermarkEnable.checked && text) {
    const fontSize = Number(watermarkSizeInput.value) || 28;
    const previewFontSize = Math.max(9, Math.round(fontSize * (w / 1200)));
    photo._wmText.textContent = text;
    photo._wmText.style.display = "block";
    photo._wmText.style.fontSize = `${previewFontSize}px`;
    photo._wmText.style.color = watermarkColorInput.value;
    photo._wmText.style.opacity = (Number(watermarkOpacityInput.value) || 100) / 100;
    setOverlayCorner(photo._wmText, watermarkPositionSelect.value, Math.max(3, Math.round(previewFontSize / 2)));
  } else {
    photo._wmText.style.display = "none";
  }

  if (watermarkImageEnable.checked && watermarkImagePreview.naturalWidth && watermarkImagePreview.style.display !== "none") {
    const scalePercent = Number(watermarkImageScaleInput.value) || 15;
    const logoW = Math.max(4, Math.round(w * (scalePercent / 100)));
    photo._wmLogo.src = watermarkImagePreview.src;
    photo._wmLogo.style.display = "block";
    photo._wmLogo.style.width = `${logoW}px`;
    photo._wmLogo.style.height = "auto";
    photo._wmLogo.style.opacity = (Number(watermarkImageOpacityInput.value) || 100) / 100;
    setOverlayCorner(photo._wmLogo, watermarkImagePositionSelect.value, Math.max(3, Math.round(w * 0.02)));
  } else {
    photo._wmLogo.style.display = "none";
  }
}

function updatePreview() {
  photos.forEach(updateCardWatermark);
}

const supportsFolderPicker = "showDirectoryPicker" in window;
if (!supportsFolderPicker) {
  pickFolderBtn.disabled = true;
  pickFolderBtn.title = "Chrome, Edge 브라우저에서만 폴더 지정이 가능합니다";
  folderLabel.textContent = "폴더 지정 미지원 브라우저 (ZIP 다운로드를 사용하세요)";
}

pickFolderBtn.addEventListener("click", async () => {
  try {
    dirHandle = await window.showDirectoryPicker();
    folderLabel.textContent = `저장 폴더: ${dirHandle.name}`;
  } catch (err) {
    // 사용자가 선택을 취소한 경우
  }
});

function updateCount() {
  countLabel.textContent = `추가된 사진: ${photos.length}장`;
  emptyHint.style.display = photos.length ? "none" : "block";
}

function renderCard(photo) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = photo.id;

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumb-wrap";

  const img = document.createElement("img");
  img.className = "thumb";
  img.src = photo.thumb;
  thumbWrap.appendChild(img);

  const wmText = document.createElement("div");
  wmText.className = "wm-overlay wm-text-overlay";
  thumbWrap.appendChild(wmText);

  const wmLogo = document.createElement("img");
  wmLogo.className = "wm-overlay wm-logo-overlay";
  thumbWrap.appendChild(wmLogo);

  card.appendChild(thumbWrap);
  photo._thumbWrap = thumbWrap;
  photo._wmText = wmText;
  photo._wmLogo = wmLogo;

  const filename = document.createElement("div");
  filename.className = "filename";
  filename.textContent = photo.original_name;
  card.appendChild(filename);

  const keywordInput = document.createElement("input");
  keywordInput.className = "keyword-input";
  keywordInput.placeholder = "키워드";
  keywordInput.value = photo.keyword;
  keywordInput.addEventListener("input", () => {
    photo.keyword = keywordInput.value;
  });
  card.appendChild(keywordInput);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const nukiBtn = document.createElement("button");
  nukiBtn.className = "nuki-toggle";
  nukiBtn.textContent = "누끼 제거";
  nukiBtn.addEventListener("click", () => {
    photo.nuki = !photo.nuki;
    nukiBtn.classList.toggle("active", photo.nuki);
  });
  actions.appendChild(nukiBtn);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    photos = photos.filter((p) => p.id !== photo.id);
    card.remove();
    updateCount();
    updatePreview();
  });
  actions.appendChild(removeBtn);

  card.appendChild(actions);
  photo._keywordInput = keywordInput;
  photo._nukiBtn = nukiBtn;
  photoGrid.appendChild(card);
}

addBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  if (!fileInput.files.length) return;

  const formData = new FormData();
  if (sessionId) formData.append("session_id", sessionId);
  for (const file of fileInput.files) formData.append("photos", file);

  statusText.textContent = "업로드 중...";
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    sessionId = data.session_id;

    for (const item of data.items) {
      const photo = {
        id: item.id,
        stored_name: item.stored_name,
        original_name: item.original_name,
        base_name: item.base_name,
        thumb: item.thumb,
        keyword: commonKeyword.value || "",
        nuki: false,
      };
      photos.push(photo);
      renderCard(photo);
    }
    updateCount();
    updatePreview();
    statusText.textContent = "";
  } catch (err) {
    statusText.textContent = "업로드 실패";
  }
  fileInput.value = "";
});

clearBtn.addEventListener("click", () => {
  photos = [];
  photoGrid.innerHTML = "";
  updateCount();
  updatePreview();
  downloadBtn.style.display = "none";
  progressBar.style.width = "0%";
  statusText.textContent = "";
});

applyKeywordBtn.addEventListener("click", () => {
  const value = commonKeyword.value;
  for (const photo of photos) {
    photo.keyword = value;
    photo._keywordInput.value = value;
  }
});

qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = `${qualitySlider.value}%`;
});

watermarkOpacityInput.addEventListener("input", () => {
  watermarkOpacityValue.textContent = `${watermarkOpacityInput.value}%`;
  updatePreview();
});

watermarkImageOpacityInput.addEventListener("input", () => {
  watermarkImageOpacityValue.textContent = `${watermarkImageOpacityInput.value}%`;
  updatePreview();
});

[watermarkEnable, watermarkPositionSelect, watermarkImageEnable, watermarkImagePositionSelect].forEach((el) => {
  el.addEventListener("change", updatePreview);
});
[watermarkTextInput, watermarkSizeInput, watermarkColorInput, watermarkImageScaleInput].forEach((el) => {
  el.addEventListener("input", updatePreview);
});

watermarkImageFile.addEventListener("change", async () => {
  if (!watermarkImageFile.files[0]) {
    watermarkImagePreview.style.display = "none";
    return;
  }
  watermarkImageEnable.checked = true;
  try {
    const dataUrl = await readFileAsDataURL(watermarkImageFile.files[0]);
    watermarkImagePreview.src = dataUrl;
    watermarkImagePreview.style.display = "inline-block";
    watermarkImagePreview.onload = updatePreview;
  } catch (err) {
    console.warn("로고 미리보기 실패", err);
  }
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

startBtn.addEventListener("click", async () => {
  if (!photos.length) {
    alert("먼저 사진을 추가해 주세요.");
    return;
  }

  startBtn.disabled = true;
  downloadBtn.style.display = "none";
  progressBar.style.width = "10%";
  statusText.textContent = "처리 중... (배경 제거를 포함하면 다소 걸릴 수 있어요)";

  let watermarkImageData = "";
  if (watermarkImageEnable.checked && watermarkImageFile.files[0]) {
    try {
      watermarkImageData = await readFileAsDataURL(watermarkImageFile.files[0]);
    } catch (err) {
      console.warn("로고 이미지를 읽지 못했습니다", err);
    }
  }

  const payload = {
    session_id: sessionId,
    quality: Number(qualitySlider.value),
    max_side: maxSideInput.value ? Number(maxSideInput.value) : null,
    output_format: outputFormatSelect.value,
    border_enabled: borderEnable.checked,
    border_width: borderWidthInput.value ? Number(borderWidthInput.value) : 0,
    border_color: borderColorInput.value,
    watermark_enabled: watermarkEnable.checked,
    watermark_text: watermarkTextInput.value,
    watermark_position: watermarkPositionSelect.value,
    watermark_size: watermarkSizeInput.value ? Number(watermarkSizeInput.value) : 28,
    watermark_color: watermarkColorInput.value,
    watermark_opacity: Number(watermarkOpacityInput.value),
    watermark_image_enabled: watermarkImageEnable.checked && !!watermarkImageData,
    watermark_image_data: watermarkImageData,
    watermark_image_position: watermarkImagePositionSelect.value,
    watermark_image_scale: watermarkImageScaleInput.value ? Number(watermarkImageScaleInput.value) : 15,
    watermark_image_opacity: Number(watermarkImageOpacityInput.value),
    items: photos.map((p) => ({
      id: p.id,
      stored_name: p.stored_name,
      base_name: p.base_name,
      keyword: p.keyword,
      nuki: p.nuki,
    })),
  };

  try {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    downloadBtn.href = `/api/download/${data.session_id}`;
    downloadBtn.style.display = "inline-flex";

    if (dirHandle && data.results && data.results.length) {
      await saveResultsToFolder(data.session_id, data.results);
    }

    progressBar.style.width = "100%";
    if (data.errors && data.errors.length) {
      statusText.textContent = `완료 (오류 ${data.errors.length}건)`;
      console.warn(data.errors);
    } else {
      statusText.textContent = dirHandle ? "폴더에 저장 완료" : "완료";
    }
  } catch (err) {
    statusText.textContent = "처리 중 오류가 발생했습니다";
  } finally {
    startBtn.disabled = false;
  }
});

async function saveResultsToFolder(sid, filenames) {
  for (let i = 0; i < filenames.length; i++) {
    const name = filenames[i];
    statusText.textContent = `폴더에 저장 중... (${i + 1}/${filenames.length})`;
    try {
      const res = await fetch(`/api/file/${sid}/${encodeURIComponent(name)}`);
      const blob = await res.blob();
      const fileHandle = await dirHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      console.warn(`${name} 저장 실패`, err);
    }
  }
}

updateCount();
updatePreview();
