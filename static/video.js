const videoDurationInput = document.getElementById("videoDuration");
const videoDurationValue = document.getElementById("videoDurationValue");
const videoResolutionSelect = document.getElementById("videoResolution");
const videoMusicFile = document.getElementById("videoMusicFile");
const videoList = document.getElementById("videoList");
const videoEmptyHint = document.getElementById("videoEmptyHint");
const makeVideoBtn = document.getElementById("makeVideoBtn");
const videoProgressBar = document.getElementById("videoProgressBar");
const videoStatusText = document.getElementById("videoStatusText");
const videoDownloadBtn = document.getElementById("videoDownloadBtn");

const MAX_VIDEO_PHOTOS = 20;

videoDurationInput.addEventListener("input", () => {
  videoDurationValue.textContent = `${videoDurationInput.value}초`;
});

function renderVideoList() {
  videoList.innerHTML = "";
  videoEmptyHint.style.display = photos.length ? "none" : "block";

  photos.forEach((photo, idx) => {
    const row = document.createElement("div");
    row.className = "video-row";

    const thumb = document.createElement("img");
    thumb.className = "video-row-thumb";
    thumb.src = photo.thumb;
    row.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "video-row-info";

    const name = document.createElement("div");
    name.className = "filename";
    name.textContent = `${idx + 1}. ${photo.original_name}`;
    info.appendChild(name);

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.className = "video-caption-input";
    captionInput.placeholder = "자막 (선택, 비워두면 표시 안 함)";
    captionInput.value = photo._videoCaption || "";
    captionInput.addEventListener("input", () => {
      photo._videoCaption = captionInput.value;
    });
    info.appendChild(captionInput);

    row.appendChild(info);
    videoList.appendChild(row);
  });
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  if (btn.dataset.tab === "video") {
    btn.addEventListener("click", renderVideoList);
  }
});

makeVideoBtn.addEventListener("click", async () => {
  if (!photos.length) {
    alert('먼저 "사진 처리" 탭에서 사진을 추가해 주세요.');
    return;
  }
  if (photos.length > MAX_VIDEO_PHOTOS) {
    alert(`영상은 사진 최대 ${MAX_VIDEO_PHOTOS}장까지 가능해요. 사진 개수를 줄여주세요.`);
    return;
  }

  makeVideoBtn.disabled = true;
  videoDownloadBtn.style.display = "none";
  videoProgressBar.style.width = "15%";
  videoStatusText.textContent = "영상 만드는 중... (사진이 많으면 1~2분 정도 걸려요)";

  const items = photos.map((p) => ({
    stored_name: p.stored_name,
    caption: p._videoCaption || "",
  }));

  const formData = new FormData();
  formData.append("session_id", sessionId || "");
  formData.append("duration", videoDurationInput.value);
  formData.append("resolution", videoResolutionSelect.value);
  formData.append("items_json", JSON.stringify(items));
  if (videoMusicFile.files[0]) {
    formData.append("music", videoMusicFile.files[0]);
  }

  try {
    const res = await fetch("/api/make-video", { method: "POST", body: formData });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();
    videoDownloadBtn.href = `/api/file/${data.session_id}/${data.video_name}`;
    videoDownloadBtn.style.display = "inline-flex";
    videoProgressBar.style.width = "100%";
    videoStatusText.textContent = "완료! 다운로드 버튼을 눌러주세요";
  } catch (err) {
    videoStatusText.textContent = "영상 만들기 실패했어요. 사진 개수를 줄이거나 다시 시도해주세요";
    console.warn(err);
  } finally {
    makeVideoBtn.disabled = false;
  }
});
