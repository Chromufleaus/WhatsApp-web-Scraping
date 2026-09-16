const scanButton = document.getElementById("scanButton");
const selectAllButton = document.getElementById("selectAllButton");
const exportButton = document.getElementById("exportButton");
const chatList = document.getElementById("chatList");
const statusElement = document.getElementById("status");
const maxMessagesInput = document.getElementById("maxMessages");
const loadWaitSecondsInput = document.getElementById("loadWaitSeconds");
const exportImagesInput = document.getElementById("exportImages");
const imageWaitSecondsInput = document.getElementById("imageWaitSeconds");
const chatSearchInput = document.getElementById("chatSearch");
const clearSearchButton = document.getElementById("clearSearch");
const selectionMeta = document.getElementById("selectionMeta");
const resultsSection = document.getElementById("resultsSection");
const resultSummary = document.getElementById("resultSummary");

let chats = [];
let busy = false;
const selectedChatIds = new Set();
const liveResults = new Map();

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function getFilteredChats() {
  const query = normalizeSearch(chatSearchInput.value);
  if (!query) return chats;

  return chats.filter((chat) => {
    const haystack = normalizeSearch([
      chat.name,
      chat.community_name,
      chat.preview,
      chat.source_kind
    ].filter(Boolean).join(" "));
    return haystack.includes(query);
  });
}

function getSelectedIds() {
  return [...selectedChatIds].filter((id) => chats.some((chat) => chat.id === id));
}

function updateSelectionUi() {
  const visible = getFilteredChats();
  const selectedCount = getSelectedIds().length;
  const visibleSelected = visible.filter((chat) => selectedChatIds.has(chat.id)).length;
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length;

  selectionMeta.textContent = chatSearchInput.value.trim()
    ? `${selectedCount} dipilih · ${visible.length} hasil dari ${chats.length} chat`
    : `${selectedCount} dipilih · ${chats.length} chat`;

  selectAllButton.textContent = allVisibleSelected
    ? "Batalkan hasil"
    : chatSearchInput.value.trim()
      ? "Pilih hasil"
      : "Pilih semua";

  selectAllButton.disabled = busy || visible.length === 0;
  exportButton.disabled = busy || selectedCount === 0;
  chatSearchInput.disabled = busy || chats.length === 0;
  clearSearchButton.hidden = chatSearchInput.value.length === 0;
}

function setBusy(isBusy) {
  busy = isBusy;
  scanButton.disabled = isBusy;
  maxMessagesInput.disabled = isBusy;
  loadWaitSecondsInput.disabled = isBusy;
  exportImagesInput.disabled = isBusy;
  imageWaitSecondsInput.disabled = isBusy || !exportImagesInput.checked;
  updateSelectionUi();
}

async function getActiveWhatsAppTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://web.whatsapp.com/")) {
    throw new Error("Tab aktif bukan WhatsApp Web.");
  }

  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveWhatsAppTab();

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (_error) {
    throw new Error(
      "Ekstensi belum terhubung ke halaman. Muat ulang WhatsApp Web lalu coba lagi."
    );
  }
}

function renderChats() {
  chatList.replaceChildren();
  const items = getFilteredChats();

  if (chats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Belum ada daftar chat. Klik Pindai untuk memuat daftar.";
    chatList.appendChild(empty);
    updateSelectionUi();
    return;
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `Tidak ada chat yang cocok dengan “${chatSearchInput.value.trim()}”.`;
    chatList.appendChild(empty);
    updateSelectionUi();
    return;
  }

  for (const chat of items) {
    const label = document.createElement("label");
    label.className = "chat-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = chat.id;
    checkbox.checked = selectedChatIds.has(chat.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedChatIds.add(chat.id);
      else selectedChatIds.delete(chat.id);
      updateSelectionUi();
    });

    const textWrapper = document.createElement("span");
    textWrapper.className = "chat-main";

    const titleRow = document.createElement("span");
    titleRow.className = "chat-title-row";

    const name = document.createElement("span");
    name.className = "chat-name";
    // Tampilkan group Community sebagai "NAMA GROUP (NAMA KOMUNITAS)" agar tidak
    // ambigu bila ada beberapa group dalam satu Community.
    name.textContent = chat.community_name && chat.source_kind === "community_group"
      ? `${chat.name} (${chat.community_name})`
      : chat.name;
    titleRow.appendChild(name);

    if (chat.community_name) {
      const badge = document.createElement("span");
      badge.className = "community-badge";
      badge.textContent = "Community";
      titleRow.appendChild(badge);
    }

    const preview = document.createElement("span");
    preview.className = "chat-preview";
    const context = chat.community_name ? `Komunitas: ${chat.community_name}` : null;
    preview.textContent = [context, chat.preview || "Tanpa pratinjau"]
      .filter(Boolean)
      .join(" · ");

    textWrapper.append(titleRow, preview);
    label.append(checkbox, textWrapper);
    chatList.appendChild(label);
  }

  updateSelectionUi();
}

function clearResults() {
  liveResults.clear();
  resultSummary.replaceChildren();
  resultsSection.hidden = true;
}

function reasonLabel(reason) {
  const labels = {
    target_reached: "Target pesan tercapai.",
    dynamic_safety_limit: "Batas keselamatan internal tercapai sebelum target.",
    no_progress_timeout:
      "Tidak ada pesan baru setelah beberapa percobaan; mungkin awal chat sudah tercapai atau pemuatan terlalu lambat.",
    message_scroller_not_found: "Area scroll pesan tidak ditemukan.",
    initial_messages_only: "Hanya pesan yang sudah terlihat yang dapat dibaca.",
    export_error: "Chat gagal diekspor.",
    community_not_member: "Dilewati karena akun ini bukan anggota subgroup tersebut."
  };

  return labels[reason] || reason || "Proses selesai.";
}

function resultKey(result) {
  return result?.chat_id || [
    result?.chat_name || "unknown",
    result?.community_name || ""
  ].join("::");
}

function upsertResult(result) {
  if (!result?.chat_name) return;

  const key = resultKey(result);
  liveResults.set(key, {
    ...liveResults.get(key),
    ...result
  });
  renderResults();
}

function renderResults(finalResults = null) {
  if (Array.isArray(finalResults)) {
    liveResults.clear();
    for (const result of finalResults) {
      if (result?.chat_name) liveResults.set(resultKey(result), result);
    }
  }

  resultSummary.replaceChildren();

  for (const result of liveResults.values()) {
    const item = document.createElement("div");
    const requested = Number(result.requested_messages || 0);
    const captured = Number(result.captured_messages || 0);
    const status =
      result.status === "error"
        ? "error"
        : result.status === "skipped"
          ? "partial"
          : result.status === "complete" || (requested > 0 && captured >= requested)
            ? "complete"
            : "partial";

    item.className = `result-item ${status}`;

    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = result.community_name
      ? `${result.chat_name} · ${result.community_name}`
      : result.chat_name;

    const count = document.createElement("span");
    count.className = "result-count";

    if (result.stage === "opening") {
      count.textContent = "Membuka chat…";
    } else if (result.status === "skipped") {
      count.textContent = `Dilewati — ${result.error || "akun bukan anggota subgroup"}`;
    } else if (result.status === "error") {
      count.textContent = `Gagal — ${result.error || "kesalahan tidak diketahui"}`;
    } else {
      count.textContent = `${captured}/${requested || "?"} pesan berhasil ditangkap`;
    }

    const detail = document.createElement("span");
    detail.className = "result-detail";

    if (result.stage === "collecting") {
      detail.textContent = `Memuat pesan lama otomatis · langkah ${result.scroll_steps_used || 0}`;
    } else if (result.status !== "error") {
      const stepInfo = Number.isFinite(result.scroll_steps_used)
        ? ` · ${result.scroll_steps_used} langkah scroll`
        : "";
      detail.textContent = `${reasonLabel(result.stop_reason)}${stepInfo}`;
    } else {
      detail.textContent = reasonLabel("export_error");
    }

    const imageDetail = document.createElement("span");
    imageDetail.className = "result-detail";
    const detectedImages = Number(result.images_detected || 0);
    const exportedImages = Number(result.images_exported || 0);
    const highImages = Number(result.images_high_quality || 0);
    const readableImages = Number(result.images_readable || 0);
    const lowImages = Number(result.images_low_quality || 0);
    const failedImages = Number(result.images_failed || 0);
    const pendingImages = Number(result.images_pending || 0);

    if (detectedImages > 0 || result.image_export_enabled) {
      const parts = [`gambar ${exportedImages}/${detectedImages} tersimpan`];
      if (highImages > 0) parts.push(`${highImages} high`);
      if (readableImages > 0) parts.push(`${readableImages} readable`);
      if (lowImages > 0) parts.push(`${lowImages} low`);
      if (failedImages > 0) parts.push(`${failedImages} gagal`);
      if (pendingImages > 0) parts.push(`${pendingImages} menunggu`);
      imageDetail.textContent = parts.join(" · ");
    } else {
      imageDetail.textContent = "Tidak ada gambar terdeteksi.";
    }

    item.append(name, count, detail, imageDetail);
    resultSummary.appendChild(item);
  }

  resultsSection.hidden = liveResults.size === 0;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SCAN_PROGRESS") {
    const count = Number(message.discovered_chat_count || 0);
    const communityCount = Number(message.community_group_count || 0);
    const skipped = Number(message.announcements_skipped || 0);
    const passLabel = message.scan_pass === "community_detail"
      ? "detail Community"
      : message.scan_pass === "communities"
        ? "panel Communities"
        : message.scan_pass === "groups_verify"
          ? "verifikasi Groups"
          : message.scan_pass === "groups"
            ? "filter Groups"
            : message.scan_pass === "all"
              ? "filter All"
              : "sidebar";
    const detail = [
      communityCount > 0 ? `${communityCount} subgroup Community aktif` : null,
      skipped > 0 ? `${skipped} announcements dilewati` : null
    ].filter(Boolean).join(" · ");
    const suffix = detail ? ` (${detail})` : "";

    if (message.completed) {
      setStatus(`${count} chat ditemukan setelah scan dan verifikasi${suffix}.`);
    } else {
      setStatus(`Memindai ${passLabel}… ${count} chat ditemukan sementara${suffix}.`);
    }
    return undefined;
  }

  if (message?.type !== "EXPORT_PROGRESS") return undefined;

  upsertResult(message.result);

  const current = Number(message.current_chat_index || 0);
  const total = Number(message.total_chats || 0);
  const result = message.result || {};

  if (result.stage === "opening") {
    setStatus(`Mengekspor chat ${current}/${total}: membuka “${result.chat_name}”…`);
  } else if (result.stage === "collecting") {
    setStatus(
      `Mengekspor chat ${current}/${total}: “${result.chat_name}” — ${result.captured_messages}/${result.requested_messages} pesan.`
    );
  }

  return undefined;
});

exportImagesInput.addEventListener("change", () => {
  imageWaitSecondsInput.disabled = busy || !exportImagesInput.checked;
});

chatSearchInput.addEventListener("input", () => {
  renderChats();
});

clearSearchButton.addEventListener("click", () => {
  chatSearchInput.value = "";
  chatSearchInput.focus();
  renderChats();
});

scanButton.addEventListener("click", async () => {
  setBusy(true);
  clearResults();
  selectedChatIds.clear();
  chats = [];
  chatSearchInput.value = "";
  renderChats();
  setStatus(
    "Memindai daftar Chats (All & Groups). Cepat — tanpa membuka panel Communities…"
  );

  try {
    const response = await sendToContent({
      type: "SCAN_ALL_CHATS",
      options: {}
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Pemindaian gagal.");
    }

    chats = response.chats || [];
    renderChats();

    const scanStats = response.scan_stats || {};
    const extras = [
      scanStats.groups_filter_scanned ? "Groups dipindai" : null,
      scanStats.groups_verification_pass ? "verification pass selesai" : null,
      Number(scanStats.community_group_count || 0) > 0
        ? `${scanStats.community_group_count} subgroup Community total`
        : null,
      Number(scanStats.community_containers_removed || 0) > 0
        ? `${scanStats.community_containers_removed} container Community dibuang`
        : null,
      Number(scanStats.post_repair_merged_entries || 0) > 0
        ? `${scanStats.post_repair_merged_entries} duplikat pass digabung`
        : null,
      Number(scanStats.announcements_skipped || 0) > 0
        ? `${scanStats.announcements_skipped} announcements dilewati`
        : null
    ].filter(Boolean).join(" · ");

    setStatus(
      `${chats.length} chat ditemukan${extras ? ` · ${extras}` : ""}. Gunakan pencarian untuk menemukan chat dengan cepat.`
    );
  } catch (error) {
    chats = [];
    selectedChatIds.clear();
    renderChats();
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});

selectAllButton.addEventListener("click", () => {
  const visible = getFilteredChats();
  const allVisibleSelected = visible.length > 0 && visible.every((chat) => selectedChatIds.has(chat.id));

  for (const chat of visible) {
    if (allVisibleSelected) selectedChatIds.delete(chat.id);
    else selectedChatIds.add(chat.id);
  }

  renderChats();
});

exportButton.addEventListener("click", async () => {
  const chatIds = getSelectedIds();
  const maxMessages = Number.parseInt(maxMessagesInput.value, 10);
  const loadWaitSeconds = Number.parseInt(loadWaitSecondsInput.value, 10);
  const imageWaitSeconds = Number.parseInt(imageWaitSecondsInput.value, 10);

  if (chatIds.length === 0) {
    setStatus("Pilih setidaknya satu chat.", true);
    return;
  }

  if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 5000) {
    setStatus("Maksimum pesan harus antara 1 dan 5000.", true);
    return;
  }

  if (!Number.isInteger(loadWaitSeconds) || loadWaitSeconds < 1 || loadWaitSeconds > 30) {
    setStatus("Waktu tunggu muat harus antara 1 dan 30 detik.", true);
    return;
  }

  if (
    exportImagesInput.checked &&
    (!Number.isInteger(imageWaitSeconds) || imageWaitSeconds < 1 || imageWaitSeconds > 30)
  ) {
    setStatus("Waktu tunggu gambar harus antara 1 dan 30 detik.", true);
    return;
  }

  clearResults();
  setBusy(true);
  setStatus(`Mengekspor ${chatIds.length} chat. Jangan gunakan WhatsApp Web sementara…`);

  try {
    const response = await sendToContent({
      type: "EXPORT_SELECTED_CHATS",
      chatIds,
      options: {
        maxMessages,
        maxLoadWaitMs: loadWaitSeconds * 1000,
        exportImages: exportImagesInput.checked,
        imageLoadWaitMs: imageWaitSeconds * 1000
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Ekspor gagal.");
    }

    renderResults(response.chatResults || []);

    const failedCount = response.errors?.length || 0;
    const partialCount = (response.chatResults || []).filter(
      (result) => result.status === "partial"
    ).length;
    const notes = [];

    if (partialCount) notes.push(`${partialCount} chat belum mencapai target`);
    if (failedCount) notes.push(`${failedCount} chat gagal`);

    const suffix = notes.length ? ` ${notes.join(" dan ")}.` : "";
    const attemptedCount = Number(response.attemptedChats || chatIds.length);
    const imageText = exportImagesInput.checked
      ? ` ${Number(response.exportedImages || 0)}/${Number(response.detectedImages || 0)} gambar tersimpan` +
        ` (${Number(response.highQualityImages || 0)} high, ${Number(response.readableImages || 0)} readable, ${Number(response.lowQualityImages || 0)} low, ${Number(response.failedImages || 0)} gagal).`
      : "";
    const folderText = response.outputDirectory
      ? ` Folder: Downloads/${response.outputDirectory}.`
      : "";

    setStatus(
      `Selesai: ${attemptedCount} chat dicoba, ${response.exportedChats} berhasil dibaca, dan ${response.exportedMessages} pesan diekspor.${imageText}${suffix}${folderText}`
    );
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});

renderChats();
setBusy(false);
