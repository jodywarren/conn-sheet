import { state, saveState } from "./state.js";

export function bindOcrEvents() {
  const upload = document.getElementById("pagerUpload");
  const scanBtn = document.getElementById("scanPagerBtn");

  if (upload) {
    upload.addEventListener("change", handleScreenshotUpload);
  }

  if (scanBtn) {
    scanBtn.addEventListener("click", runOcrFromPreview);
  }
}

async function handleScreenshotUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const dataUrl = await fileToDataUrl(file);
  state.incident.pagerScreenshot = dataUrl;

  const preview = document.getElementById("pagerPreview");
  if (preview) {
    preview.src = dataUrl;
    preview.classList.remove("hidden");
  }

  setScanStatus("Screenshot loaded. Press Scan Screenshot.", "scan-idle");
  saveState();
}

async function runOcrFromPreview() {
  console.log("runOcrFromPreview started");

  if (!window.Tesseract) {
    setScanStatus("OCR library not loaded.", "scan-error");
    return;
  }

  if (!state.incident.pagerScreenshot) {
    setScanStatus("Upload a screenshot first.", "scan-error");
    return;
  }

  try {
    setScanStatus("Reading screenshot...", "scan-working");

    const result = await window.Tesseract.recognize(
      state.incident.pagerScreenshot,
      "eng",
      {
        logger: (msg) => {
          if (msg.status === "recognizing text" && typeof msg.progress === "number") {
            setScanStatus(
              `Reading screenshot... ${Math.round(msg.progress * 100)}%`,
              "scan-working"
            );
          }
        }
      }
    );

    const rawText = result?.data?.text || "";
    console.log("OCR RAW TEXT:", rawText);

    state.incident.pagerDetails = rawText;
    saveState();

    const pagerDetails = document.getElementById("pagerDetails");
    if (pagerDetails) {
      pagerDetails.value = rawText;
    }

    setScanStatus("Scan complete. OCR text loaded into Pager Details.", "scan-good");
  } catch (error) {
    console.error("OCR FAILED:", error);
    setScanStatus("Scan failed. Check screenshot or enter details manually.", "scan-error");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setScanStatus(message, className) {
  const target = document.getElementById("scanStatus");
  if (!target) return;

  target.textContent = message;
  target.className = `scan-status ${className}`;
}
