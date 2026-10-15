import "./style.css";

/*
 * GOOGLE SHEETS SETUP
 * 1. Put the sale number in one cell (A1 unless you change `cell`).
 * 2. Share the sheet as "Anyone with the link — Viewer".
 * 3. Paste the full sheet URL into `sheetUrl` below.
 *
 * For Vercel, set VITE_SHEET_URL instead of pasting it here.
 * A page link can also override it: ?sheet=YOUR_SHEET_URL&cell=A1&interval=5
 */
const CONFIG = {
  sheetUrl: "https://docs.google.com/spreadsheets/d/1Shvj9TC6_QLr1zyjzdrhoEmftQscijvPnqU5brWPcDM/edit?usp=sharing#gid=0",
  cell: "A1",
  refreshSeconds: 5,
  fallbackValue: 11,
};

const query = new URLSearchParams(window.location.search);
const settings = {
  sheetUrl: query.get("sheet") || import.meta.env.VITE_SHEET_URL || CONFIG.sheetUrl,
  cell: query.get("cell") || import.meta.env.VITE_SHEET_CELL || CONFIG.cell,
  refreshSeconds: Math.max(
    5,
    Number(query.get("interval")) ||
      Number(import.meta.env.VITE_REFRESH_SECONDS) ||
      CONFIG.refreshSeconds,
  ),
};

const number3d = document.querySelector("#number3d");
const numberReflection = document.querySelector("#numberReflection");
const connection = document.querySelector("#connection");
const connectionText = document.querySelector("#connectionText");
const fullscreenButton = document.querySelector("#fullscreenButton");
const fullscreenLabel = document.querySelector("#fullscreenLabel");
let displayedValue = null;

function formatValue(value) {
  const raw = String(value ?? "").trim();
  const numeric = Number(raw.replace(/,/g, ""));

  if (raw !== "" && Number.isFinite(numeric)) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(numeric);
  }

  return raw || "0";
}

function renderNumber(value) {
  const formatted = formatValue(value);
  if (formatted === displayedValue) return;
  displayedValue = formatted;

  number3d.classList.add("number-3d--changing");

  window.setTimeout(() => {
    number3d.replaceChildren();

    const face = document.createElement("span");
    face.className = "number-3d__face";
    face.textContent = formatted;
    number3d.append(face);

    const back = document.createElement("span");
    back.className = "number-3d__back";
    back.textContent = formatted;
    back.setAttribute("aria-hidden", "true");
    number3d.append(back);

    number3d.setAttribute("aria-label", formatted);
    numberReflection.textContent = formatted;
    number3d.classList.remove("number-3d--changing");
  }, 260);
}

function getSheetId(url) {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}

function getSheetName(url) {
  try {
    return new URL(url).searchParams.get("sheet") || "";
  } catch {
    return "";
  }
}

function getSheetGid(url) {
  try {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return hash.get("gid") || parsed.searchParams.get("gid") || "";
  } catch {
    return "";
  }
}

function fetchSheetValue() {
  const sheetId = getSheetId(settings.sheetUrl);
  if (!sheetId) {
    setConnection("preview", "Preview data");
    return;
  }

  const callbackName = `saleSheet${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const params = new URLSearchParams({
    tqx: `out:json;responseHandler:${callbackName}`,
    range: settings.cell,
  });
  const sheetName = getSheetName(settings.sheetUrl);
  const gid = getSheetGid(settings.sheetUrl);
  if (sheetName) params.set("sheet", sheetName);
  if (gid) params.set("gid", gid);

  const script = document.createElement("script");
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    delete window[callbackName];
    script.remove();
  };

  window[callbackName] = (data) => {
    try {
      if (data?.status !== "ok") {
        const reason =
          data?.errors?.[0]?.detailed_message ||
          data?.errors?.[0]?.message ||
          "Sheet unavailable";
        throw new Error(reason);
      }

      const cell = data.table?.rows?.[0]?.c?.[0];
      if (!cell || (cell.v == null && cell.f == null)) {
        setConnection("live", `Waiting · ${settings.cell}`);
        return;
      }

      renderNumber(cell.f ?? cell.v);
      setConnection("live", `Live · ${settings.cell}`);
    } catch (error) {
      console.error(error);
      setConnection("error", "Sheet unavailable");
    } finally {
      finish();
    }
  };

  script.async = true;
  script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params}`;
  script.onerror = () => {
    console.error("Google Sheet could not be loaded.");
    setConnection("error", "Sheet unavailable");
    finish();
  };

  const timer = window.setTimeout(() => {
    console.error("Google Sheet request timed out.");
    setConnection("error", "Sheet unavailable");
    finish();
  }, 12000);

  document.head.append(script);
}

function setConnection(state, message) {
  connection.dataset.state = state;
  connectionText.textContent = message;
}

function isFullscreen() {
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  );
}

function updateFullscreenButton() {
  const active = isFullscreen();
  fullscreenButton.dataset.active = String(active);
  fullscreenButton.setAttribute(
    "aria-label",
    active ? "Exit fullscreen" : "Enter fullscreen",
  );
  fullscreenButton.title = active ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenLabel.textContent = active ? "Exit" : "Fullscreen";
}

async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const exit =
        document.exitFullscreen?.bind(document) ||
        document.webkitExitFullscreen?.bind(document);
      await exit?.();
    } else {
      const root = document.documentElement;
      const enter =
        root.requestFullscreen?.bind(root) ||
        root.webkitRequestFullscreen?.bind(root);
      await enter?.();
    }
  } catch (error) {
    console.error("Fullscreen mode could not be changed.", error);
  }
}

fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
updateFullscreenButton();

renderNumber(CONFIG.fallbackValue);
fetchSheetValue();

if (settings.sheetUrl) {
  window.setInterval(fetchSheetValue, settings.refreshSeconds * 1000);
}
