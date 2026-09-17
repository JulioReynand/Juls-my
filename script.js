// =========================================================
// JulMail — Frontend Logic
// Fetch ke backend Java (Spring Boot) — API key aman di server
// =========================================================

const API = "/api";

// DOM
const nameInput      = document.getElementById("nameInput");
const domainSelect   = document.getElementById("domainSelect");
const lifespanSelect = document.getElementById("lifespanSelect");
const createBtn      = document.getElementById("createBtn");
const refreshInboxBtn= document.getElementById("refreshInboxBtn");
const refreshDomainsBtn = document.getElementById("refreshDomainsBtn");
const inboxBox       = document.getElementById("inboxBox");
const inboxAddress   = document.getElementById("inboxAddress");
const copyBtn        = document.getElementById("copyBtn");
const timerEl        = document.getElementById("timer");
const emailList      = document.getElementById("emailList");
const counter        = document.getElementById("counter");
const modalOverlay   = document.getElementById("modalOverlay");
const modalSubject   = document.getElementById("modalSubject");
const modalMeta      = document.getElementById("modalMeta");
const modalBody      = document.getElementById("modalBody");
const closeModal     = document.getElementById("closeModal");
const toastEl        = document.getElementById("toast");

// State
let currentInbox = null;   // { id, address, expireAt }
let pollTimer = null;
let tickTimer = null;

// =========================================================
// Utilities
// =========================================================
function showToast(msg, duration = 2400) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function randomName() {
  const adjectives = ["cute","fluffy","sweet","kawaii","mochi","boba","pinky","bubbly","sunny","cosmic"];
  const nouns = ["panda","neko","bunny","bear","fox","cat","puppy","star","moon","cloud"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${a}${n}${num}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

// =========================================================
// Domains
// =========================================================
async function loadDomains() {
  try {
    const res = await fetch(`${API}/domains`);
    const data = await res.json();
    // API bisa balikin { data: [...] } atau { domains: [...] } atau array langsung
    const list = data?.data || data?.domains || data;
    if (!Array.isArray(list) || list.length === 0) throw new Error("Kosong");

    domainSelect.innerHTML = "";
    list.forEach(d => {
      const value = typeof d === "string" ? d : (d.domain || d.name);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = "@" + value;
      domainSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Gagal load domains:", e);
    showToast("⚠️ Gagal load domain");
    domainSelect.innerHTML = `<option value="">— gagal load —</option>`;
  }
}

// =========================================================
// Create Inbox
// =========================================================
async function createInbox() {
  const name = (nameInput.value.trim() || randomName()).replace(/[^a-z0-9._-]/gi, "");
  const domain = domainSelect.value;
  const lifespan = parseInt(lifespanSelect.value, 10);

  if (!domain) return showToast("⚠️ Pilih domain dulu");

  createBtn.disabled = true;
  createBtn.textContent = "⏳ Bikin...";

  try {
    const params = new URLSearchParams({ name, domain, lifespan });
    const res = await fetch(`${API}/inbox?${params}`, { method: "POST" });
    const data = await res.json();
    const d = data?.data || data;

    // Ambil id & address dari berbagai kemungkinan struktur
    const inboxId = d.id || d.inbox_id || d.inboxId;
    const address = d.address || d.email || `${name}@${domain}`;

    if (!inboxId) throw new Error("Response tidak valid");

    currentInbox = {
      id: inboxId,
      address,
      expireAt: Date.now() + lifespan * 1000
    };

    inboxBox.classList.remove("hidden");
    inboxAddress.textContent = address;
    nameInput.value = name;

    showToast("🎉 Inbox berhasil dibuat!");
    startTimer();
    startPolling();
    loadEmails();

  } catch (e) {
    console.error(e);
    showToast("❌ Gagal buat inbox");
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = "🎉 Buat Inbox";
  }
}

// =========================================================
// Timer countdown
// =========================================================
function startTimer() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!currentInbox) return;
    const sisa = Math.max(0, Math.floor((currentInbox.expireAt - Date.now()) / 1000));
    const m = String(Math.floor(sisa / 60)).padStart(2, "0");
    const s = String(sisa % 60).padStart(2, "0");
    timerEl.textContent = sisa > 0 ? `⏳ Sisa waktu: ${m}:${s}` : "⌛ Inbox expired";

    if (sisa === 0) {
      clearInterval(tickTimer);
      clearInterval(pollTimer);
    }
  }, 1000);
}

// =========================================================
// Load Emails
// =========================================================
async function loadEmails() {
  if (!currentInbox) return;
  try {
    const res = await fetch(`${API}/inbox/${currentInbox.id}/mails`);
    const data = await res.json();
    const list = data?.data || data?.mails || data;

    if (!Array.isArray(list) || list.length === 0) {
      emailList.innerHTML = `
        <div class="empty">
          <span class="big">📭</span>
          <p>Belum ada surat nih… sabar ya 💗</p>
        </div>`;
      counter.textContent = "0";
      return;
    }

    counter.textContent = list.length;
    emailList.innerHTML = list.map(m => {
      const id = m.id || m.mail_id || m.mailId;
      const from = m.from || m.sender || "-";
      const subject = m.subject || "(Tanpa Subjek)";
      const preview = (m.text || m.preview || m.snippet || "").slice(0, 80);
      const date = formatDate(m.date || m.created_at || m.received_at);

      return `
        <div class="email-item" data-id="${escapeHtml(id)}">
          <div class="email-info">
            <div class="email-from">📨 ${escapeHtml(from)}</div>
            <div class="email-subject">${escapeHtml(subject)}</div>
            <div class="email-preview">${escapeHtml(preview)}… • ${escapeHtml(date)}</div>
          </div>
          <div class="email-actions">
            <button class="icon-btn danger" title="Hapus">🗑️</button>
          </div>
        </div>`;
    }).join("");

    // Attach handlers
    emailList.querySelectorAll(".email-item").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".icon-btn.danger")) return;
        openEmail(el.dataset.id);
      });
      el.querySelector(".icon-btn.danger")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteEmail(el.dataset.id);
      });
    });

  } catch (e) {
    console.error("Gagal load emails:", e);
  }
}

// =========================================================
// Open Email Detail
// =========================================================
async function openEmail(mailId) {
  if (!currentInbox) return;
  try {
    const res = await fetch(`${API}/inbox/${currentInbox.id}/mail/${mailId}`);
    const data = await res.json();
    const m = data?.data || data;

    modalSubject.textContent = m.subject || "(Tanpa Subjek)";
    modalMeta.innerHTML = `
      <div>📨 <b>Dari:</b> ${escapeHtml(m.from || m.sender || "-")}</div>
      <div>🎯 <b>Ke:</b> ${escapeHtml(m.to || currentInbox.address)}</div>
      <div>🕐 <b>Tanggal:</b> ${escapeHtml(formatDate(m.date || m.created_at))}</div>
    `;

    if (m.html) {
      modalBody.innerHTML = `<iframe sandbox srcdoc="${escapeHtml(m.html)}"></iframe>`;
    } else {
      modalBody.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(m.text || m.body || "(kosong)")}</pre>`;
    }

    modalOverlay.classList.remove("hidden");
  } catch (e) {
    console.error(e);
    showToast("❌ Gagal buka email");
  }
}

// =========================================================
// Delete Email
// =========================================================
async function deleteEmail(mailId) {
  if (!currentInbox) return;
  if (!confirm("Hapus email ini?")) return;
  try {
    await fetch(`${API}/inbox/${currentInbox.id}/mail/${mailId}`, { method: "DELETE" });
    showToast("🗑️ Email dihapus");
    loadEmails();
  } catch (e) {
    showToast("❌ Gagal hapus email");
  }
}

// =========================================================
// Polling
// =========================================================
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(loadEmails, 5000); // tiap 5 detik
}

// =========================================================
// Event Listeners
// =========================================================
createBtn.addEventListener("click", createInbox);
refreshInboxBtn.addEventListener("click", () => {
  if (!currentInbox) return showToast("⚠️ Bikin inbox dulu");
  loadEmails();
  showToast("🔄 Refreshed!");
});
refreshDomainsBtn.addEventListener("click", () => {
  loadDomains();
  showToast("🔄 Domain di-refresh");
});

copyBtn.addEventListener("click", async () => {
  if (!currentInbox) return;
  try {
    await navigator.clipboard.writeText(currentInbox.address);
    showToast("📋 Alamat dicopy!");
    copyBtn.textContent = "✅ Copied";
    setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
  } catch {
    showToast("❌ Gagal copy");
  }
});

closeModal.addEventListener("click", () => modalOverlay.classList.add("hidden"));
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add("hidden");
});

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createInbox();
});

// =========================================================
// Init
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
  loadDomains();
  nameInput.value = randomName();
});