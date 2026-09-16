chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    return { ok: true, downloadId };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
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
