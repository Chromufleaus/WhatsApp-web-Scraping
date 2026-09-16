chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "DOWNLOAD_JSON") {
    const filename = sanitizeDownloadPath(
      message.filename || `whatsapp-export-${Date.now()}.json`
    );
    const json = typeof message.json === "string" ? message.json : "{}";
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

    startDownload({
      url,
      filename,
      saveAs: message.saveAs === true
    }).then(sendResponse);

    return true;
  }

  if (message?.type === "DOWNLOAD_DATA_URL") {
    const filename = sanitizeDownloadPath(message.filename || "media/image.bin");
    const dataUrl = typeof message.dataUrl === "string" ? message.dataUrl : "";

    if (!dataUrl.startsWith("data:")) {
      sendResponse({ ok: false, error: "Data URL media tidak valid." });
      return undefined;
    }

    startDownload({
      url: dataUrl,
      filename,
      saveAs: false,
      conflictAction: message.overwrite === true ? "overwrite" : "uniquify"
    }).then(sendResponse);
    return true;
  }

  if (message?.type === "DOWNLOAD_FILE_URL") {
    const filename = sanitizeDownloadPath(message.filename || "export.zip");
    const url = typeof message.url === "string" ? message.url : "";

    if (!url) {
      sendResponse({ ok: false, error: "URL file unduhan tidak valid." });
      return undefined;
    }

    startDownload({
      url,
      filename,
      saveAs: false,
      conflictAction: message.overwrite === true ? "overwrite" : "uniquify"
    }).then(sendResponse);
    return true;
  }

  return undefined;
});

async function startDownload({ url, filename, saveAs, conflictAction = "uniquify" }) {
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs,
      conflictAction
    });

    // chrome.downloads.search mengembalikan filename absolut pada perangkat
    // pengguna. Ini memungkinkan JSON mencatat lokasi file sebenarnya bila
    // browser menyediakannya, tanpa menebak folder Downloads Windows/Linux/macOS.
    const item = await waitForDownloadItem(downloadId, 1_500);

    return {
      ok: true,
      downloadId,
      absolutePath: item?.filename || null,
      state: item?.state || null
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function waitForDownloadItem(downloadId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const items = await chrome.downloads.search({ id: downloadId });
      if (items?.[0]?.filename) return items[0];
    } catch (_error) {
      return null;
    }
    await sleep(80);
  }

  try {
    const items = await chrome.downloads.search({ id: downloadId });
    return items?.[0] || null;
  } catch (_error) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeDownloadPath(value) {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[<>:"|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+$/, "_")
        .slice(0, 120) || "_"
    )
    .join("/");

  return normalized.slice(0, 240) || `whatsapp-export-${Date.now()}`;
}
