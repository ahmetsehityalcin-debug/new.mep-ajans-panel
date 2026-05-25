const PAGE_CONFIG = {
  faturali: {
    title: "Faturalı Siparişler",
    page: "faturali",
    nameKey: "musteri",
    fields: [
      ["tarih", "Tarih", "date"],
      ["musteri", "Müşteri Adı", "text"],
      ["urun", "Ürün", "text"],
      ["adet", "Adet", "number"],
      ["toplam_maliyet", "Toplam Maliyet", "number"],
      ["toplam_satis", "Toplam Satış", "number"],
      ["kdv_orani", "KDV Oranı", "select", ["10", "20"]],
      ["durum", "Durumu", "select", ["Üretimde", "Hazır", "Teslim Edildi"]],
      ["odeme_durumu", "Ödeme Durumu", "select", ["Ödendi", "Bekleniyor", "Kısmi Ödeme"]],
      ["fatura_durumu", "Fatura Durumu", "select", ["K", "X"]],
      ["notlar", "Açıklama", "textarea"]
    ],
    headers: ["Tarih", "Müşteri", "Ürün", "Adet", "Maliyet", "Satış", "KDV", "KDV Dahil", "Kâr", "Durum", "Ödeme", "Fatura", "Not", "İşlem"]
  },

  gelen: {
    title: "Gelen Faturalar",
    page: "gelen",
    nameKey: "firma",
    fields: [
      ["tarih", "Tarih", "date"],
      ["firma", "Firma", "text"],
      ["urun", "Ürün", "text"],
      ["adet", "Adet", "number"],
      ["toplam_tutar", "Toplam Tutar", "number"],
      ["kdv_orani", "KDV Oranı", "select", ["10", "20"]],
      ["durum", "Durumu", "select", ["Teslim Alındı", "Üretimde"]],
      ["odeme_durumu", "Ödeme Durumu", "select", ["Ödendi", "Ödenmedi"]],
      ["notlar", "Açıklama / Not", "textarea"]
    ],
    headers: ["Tarih", "Firma", "Ürün", "Adet", "Toplam Tutar", "KDV Dahil", "KDV", "Durum", "Ödeme", "Not", "İşlem"]
  },

  faturasiz: {
    title: "Faturasız Siparişler",
    page: "faturasiz",
    nameKey: "musteri",
    fields: [
      ["tarih", "Tarih", "date"],
      ["musteri", "Müşteri Adı", "text"],
      ["urun", "Ürün", "text"],
      ["adet", "Adet", "number"],
      ["toplam_maliyet", "Toplam Maliyet", "number"],
      ["toplam_satis", "Toplam Satış", "number"],
      ["durum", "Durumu", "select", ["Üretimde", "Hazır", "Teslim Edildi"]],
      ["odeme_durumu", "Ödeme Durumu", "select", ["Ödendi", "Bekleniyor", "Kısmi Ödeme"]],
      ["notlar", "Notlar", "textarea"]
    ],
    headers: ["Tarih", "Müşteri", "Ürün", "Adet", "Maliyet", "Toplam Satış", "Kâr", "Durum", "Ödeme", "Not", "İşlem"]
  }
};

let supabaseClient = null;
let PAGE_ROWS = {
  faturali: [],
  gelen: [],
  faturasiz: []
};

if (window.MEP_SUPABASE_URL && window.MEP_SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(
    window.MEP_SUPABASE_URL,
    window.MEP_SUPABASE_ANON_KEY
  );
}

const MONTHS = [
  ["01", "Ocak"], ["02", "Şubat"], ["03", "Mart"], ["04", "Nisan"],
  ["05", "Mayıs"], ["06", "Haziran"], ["07", "Temmuz"], ["08", "Ağustos"],
  ["09", "Eylül"], ["10", "Ekim"], ["11", "Kasım"], ["12", "Aralık"]
];

const money = value =>
  Number(value || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });

const today = () => new Date().toISOString().slice(0, 10);

const isUnpaid = row =>
  ["Bekleniyor", "Ödenmedi", "Kısmi Ödeme"].includes(row.odeme_durumu);

function calculate(row) {
  const cost = Number(row.toplam_maliyet || 0);
  const sale = Number(row.toplam_satis || 0);
  const incoming = Number(row.toplam_tutar || 0);
  const base = sale || incoming;
  const rate = Number(row.kdv_orani || 0);
  const vat = rate ? base * rate / 100 : Number(row.kdv_farki || 0);

  return {
    kar: sale - cost,
    kdv_farki: vat,
    kdv_dahil_toplam: base + vat
  };
}

function cleanRowForDb(page, obj) {
  const c = calculate(obj);

  return {
    sayfa: page,
    tarih: obj.tarih || null,
    firma: obj.firma || null,
    musteri: obj.musteri || null,
    urun: obj.urun || null,
    adet: Number(obj.adet || 0),
    toplam_maliyet: Number(obj.toplam_maliyet || 0),
    toplam_satis: Number(obj.toplam_satis || 0),
    toplam_tutar: Number(obj.toplam_tutar || 0),
    kdv_dahil_toplam: Number(c.kdv_dahil_toplam || 0),
    kdv_farki: Number(c.kdv_farki || 0),
    kar: Number(c.kar || 0),
    durum: obj.durum || null,
    odeme_durumu: obj.odeme_durumu || null,
    fatura_durumu: obj.fatura_durumu || null,
    notlar: obj.notlar || null
  };
}

async function loadRows(page) {
  if (!supabaseClient) {
    const local = localStorage.getItem("mep_" + page);
    return local ? JSON.parse(local) : [];
  }

  const { data, error } = await supabaseClient
    .from("kayitlar")
    .select("*")
    .eq("sayfa", page)
    .order("tarih", { ascending: false });

  if (error) {
    alert("Veriler alınamadı: " + error.message);
    return [];
  }

  return data || [];
}

async function upsertRow(page, row, id = null) {
  const payload = cleanRowForDb(page, row);

  if (!supabaseClient) {
    const rows = await loadRows(page);
    const newRows = id
      ? rows.map(r => r.id === id ? { ...payload, id } : r)
      : [{ ...payload, id: crypto.randomUUID() }, ...rows];

    localStorage.setItem("mep_" + page, JSON.stringify(newRows));
    return true;
  }

  if (id) payload.id = id;

  const { error } = await supabaseClient.from("kayitlar").upsert(payload);

  if (error) {
    alert("Kayıt yapılamadı: " + error.message);
    return false;
  }

  return true;
}

async function deleteRow(page, id) {
  if (!confirm("Bu kayıt silinsin mi?")) return false;

  if (!supabaseClient) {
    const rows = await loadRows(page);
    localStorage.setItem("mep_" + page, JSON.stringify(rows.filter(r => r.id !== id)));
    return true;
  }

  const { error } = await supabaseClient.from("kayitlar").delete().eq("id", id);

  if (error) {
    alert("Silinemedi: " + error.message);
    return false;
  }

  return true;
}

function badge(value) {
  const v = value || "";
  let color = "blue";

  if (["Ödendi", "Teslim Edildi", "Teslim Alındı", "Hazır", "K"].includes(v)) color = "green";
  if (["Ödenmedi", "Bekleniyor", "X"].includes(v)) color = "red";
  if (["Üretimde", "Kısmi Ödeme"].includes(v)) color = "orange";

  return `<span class="badge ${color}">${v}</span>`;
}

function rowCells(page, row) {
  const c = calculate(row);

  if (page === "faturali") {
    return [
      row.tarih,
      row.musteri,
      row.urun,
      row.adet,
      money(row.toplam_maliyet),
      money(row.toplam_satis),
      money(c.kdv_farki),
      money(c.kdv_dahil_toplam),
      `<b class="${c.kar >= 0 ? "profit" : "loss"}">${money(c.kar)}</b>`,
      badge(row.durum),
      badge(row.odeme_durumu),
      badge(row.fatura_durumu),
      row.notlar || ""
    ];
  }

  if (page === "gelen") {
    return [
      row.tarih,
      row.firma,
      row.urun,
      row.adet,
      money(row.toplam_tutar),
      money(c.kdv_dahil_toplam),
      money(c.kdv_farki),
      badge(row.durum),
      badge(row.odeme_durumu),
      row.notlar || ""
    ];
  }

  return [
    row.tarih,
    row.musteri,
    row.urun,
    row.adet,
    money(row.toplam_maliyet),
    money(row.toplam_satis),
    `<b class="${c.kar >= 0 ? "profit" : "loss"}">${money(c.kar)}</b>`,
    badge(row.durum),
    badge(row.odeme_durumu),
    row.notlar || ""
  ];
}

function applyFilters(page, rows, filters) {
  return rows.filter(row => {
    const q = filters.search.toLowerCase().trim();
    const selectedMonth = filters.month;
    const selectedPayment = filters.payment;
    const onlyUnpaid = filters.onlyUnpaid;

    const nameKey = PAGE_CONFIG[page].nameKey;
    const name = String(row[nameKey] || "").toLowerCase();
    const fullText = JSON.stringify(row).toLowerCase();

    const searchMatch = !q || name.includes(q) || fullText.includes(q);
    const rowMonth = row.tarih ? String(row.tarih).slice(5, 7) : "";
    const monthMatch = !selectedMonth || rowMonth === selectedMonth;
    const paymentMatch = !selectedPayment || row.odeme_durumu === selectedPayment;
    const unpaidMatch = !onlyUnpaid || isUnpaid(row);

    return searchMatch && monthMatch && paymentMatch && unpaidMatch;
  });
}

function totalsFor(page, rows) {
  const t = {
    count: rows.length,
    cost: 0,
    sale: 0,
    profit: 0,
    vat: 0,
    vatIncluded: 0,
    receivable: 0,
    debt: 0
  };

  rows.forEach(row => {
    const c = calculate(row);

    if (page === "gelen") {
      t.cost += Number(row.toplam_tutar || 0);
      t.vat += c.kdv_farki;
      t.vatIncluded += c.kdv_dahil_toplam;
      if (isUnpaid(row)) t.debt += c.kdv_dahil_toplam;
      return;
    }

    t.cost += Number(row.toplam_maliyet || 0);
    t.sale += Number(row.toplam_satis || 0);
    t.profit += c.kar;

    if (page === "faturali") {
      t.vat += c.kdv_farki;
      t.vatIncluded += c.kdv_dahil_toplam;
      if (isUnpaid(row)) t.receivable += c.kdv_dahil_toplam;
    }

    if (page === "faturasiz") {
      if (isUnpaid(row)) t.receivable += Number(row.toplam_satis || 0);
    }
  });

  return t;
}

function vatPanelHtml(selectedMonth) {
  const faturaliRows = selectedMonth
    ? PAGE_ROWS.faturali.filter(r => r.tarih && r.tarih.slice(5, 7) === selectedMonth)
    : PAGE_ROWS.faturali;

  const gelenRows = selectedMonth
    ? PAGE_ROWS.gelen.filter(r => r.tarih && r.tarih.slice(5, 7) === selectedMonth)
    : PAGE_ROWS.gelen;

  const faturasizRows = selectedMonth
    ? PAGE_ROWS.faturasiz.filter(r => r.tarih && r.tarih.slice(5, 7) === selectedMonth)
    : PAGE_ROWS.faturasiz;

  const faturaliTotal = totalsFor("faturali", faturaliRows);
  const gelenTotal = totalsFor("gelen", gelenRows);
  const faturasizTotal = totalsFor("faturasiz", faturasizRows);

  const payableVat = faturaliTotal.vat - gelenTotal.vat;
  const monthName = selectedMonth
    ? MONTHS.find(m => m[0] === selectedMonth)?.[1]
    : "Tüm Aylar";

  return `
    <div class="kdv-panel">
      <div class="kdv-title">
        <strong>${monthName} KDV ve Genel Durum</strong>
        <span>Faturalı sipariş KDV - Gelen fatura KDV = Ödenecek KDV</span>
      </div>

      <div class="summary mini">
        <div class="sum-item">
          <small>Alınan KDV</small>
          <strong>${money(faturaliTotal.vat)}</strong>
        </div>
        <div class="sum-item">
          <small>Ödenen KDV</small>
          <strong>${money(gelenTotal.vat)}</strong>
        </div>
        <div class="sum-item">
          <small>Devlete Ödenecek KDV</small>
          <strong class="${payableVat >= 0 ? "loss" : "profit"}">${money(payableVat)}</strong>
        </div>
        <div class="sum-item">
          <small>Faturalı Kâr</small>
          <strong>${money(faturaliTotal.profit)}</strong>
        </div>
        <div class="sum-item">
          <small>Faturasız Kâr</small>
          <strong>${money(faturasizTotal.profit)}</strong>
        </div>
      </div>
    </div>
  `;
}

function customerDebtHtml(page, rows) {
  const config = PAGE_CONFIG[page];
  const nameKey = config.nameKey;
  const map = {};

  rows.forEach(row => {
    if (!isUnpaid(row)) return;

    const name = row[nameKey] || "İsimsiz";
    const c = calculate(row);

    if (!map[name]) map[name] = 0;

    if (page === "faturali") map[name] += c.kdv_dahil_toplam;
    if (page === "faturasiz") map[name] += Number(row.toplam_satis || 0);
    if (page === "gelen") map[name] += c.kdv_dahil_toplam;
  });

  const list = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (!list.length) return "";

  const title = page === "gelen" ? "Firma Bazlı Borç Özeti" : "Müşteri Bazlı Alacak Özeti";

  return `
    <div class="cari-card">
      <h3>${title}</h3>
      ${list.map(([name, total]) => `
        <div class="cari-row">
          <span>${name}</span>
          <strong>${money(total)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function summaryHtml(page, rows, selectedMonth) {
  const t = totalsFor(page, rows);

  let items = [];

  if (page === "faturali") {
    items = [
      ["Toplam Maliyet", t.cost],
      ["Toplam Satış", t.sale],
      ["KDV Dahil Toplam", t.vatIncluded],
      ["Toplam Kâr", t.profit],
      ["KDV Farkı", t.vat],
      ["Toplam Alacak", t.receivable],
      ["Kayıt", t.count]
    ];
  }

  if (page === "faturasiz") {
    items = [
      ["Toplam Maliyet", t.cost],
      ["Toplam Satış", t.sale],
      ["Toplam Kâr", t.profit],
      ["Toplam Alacak", t.receivable],
      ["Kayıt", t.count]
    ];
  }

  if (page === "gelen") {
    items = [
      ["Toplam Tutar", t.cost],
      ["KDV Dahil Toplam", t.vatIncluded],
      ["KDV Farkı", t.vat],
      ["Toplam Borç", t.debt],
      ["Kayıt", t.count]
    ];
  }

  return `
    ${vatPanelHtml(selectedMonth)}
    <div class="summary">
      ${items.map(([label, value]) => `
        <div class="sum-item">
          <small>${label}</small>
          <strong>${label === "Kayıt" ? value : money(value)}</strong>
        </div>
      `).join("")}
    </div>
    ${customerDebtHtml(page, rows)}
  `;
}

function fieldHtml(field) {
  const [name, label, type = "text", options = []] = field;

  if (type === "select") {
    return `<label class="field">
      <span>${label}</span>
      <select name="${name}">
        ${options.map(o => `<option value="${o}">${name === "kdv_orani" ? "%" + o : o}</option>`).join("")}
      </select>
    </label>`;
  }

  if (type === "textarea") {
    return `<label class="field field-wide">
      <span>${label}</span>
      <textarea name="${name}" rows="3"></textarea>
    </label>`;
  }

  return `<label class="field">
    <span>${label}</span>
    <input name="${name}" type="${type}" />
  </label>`;
}

function openModal(container, config, row = null) {
  const modal = container.querySelector(".modal");
  modal.classList.add("active");
  modal.dataset.editId = row?.id || "";
  modal.querySelector(".modal-title").textContent = row ? "Kaydı Düzenle" : "Yeni Kayıt Ekle";

  config.fields.forEach(([name, , type]) => {
    const input = modal.querySelector(`[name="${name}"]`);
    if (!input) return;

    if (name === "kdv_orani") {
      input.value = row?.kdv_orani || "20";
    } else if (name === "odeme_durumu") {
      input.value = row?.odeme_durumu || (config.page === "gelen" ? "Ödenmedi" : "Bekleniyor");
    } else {
      input.value = row?.[name] ?? (type === "date" ? today() : "");
    }
  });
}

function closeModal(container) {
  const modal = container.querySelector(".modal");
  modal.classList.remove("active");
  modal.dataset.editId = "";
}

function getFormValues(container, config) {
  const obj = {};

  config.fields.forEach(([name, , type]) => {
    const input = container.querySelector(`[name="${name}"]`);
    obj[name] = type === "number" ? Number(input.value || 0) : input.value;
  });

  return obj;
}

function exportCsv(config, rows) {
  const headers = config.headers.filter(h => h !== "İşlem");

  const body = rows.map(row =>
    rowCells(config.page, row)
      .map(cell => String(cell ?? "").replace(/<[^>]+>/g, "").replaceAll(";", ","))
      .join(";")
  );

  const csv = ["\ufeff" + headers.join(";"), ...body].join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = config.title + ".csv";
  a.click();
}

function monthOptionsHtml() {
  return `
    <option value="">Tüm Aylar</option>
    ${MONTHS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
  `;
}

function paymentOptionsHtml(page) {
  const options = page === "gelen"
    ? ["Ödendi", "Ödenmedi"]
    : ["Ödendi", "Bekleniyor", "Kısmi Ödeme"];

  return `
    <option value="">Tüm Ödemeler</option>
    ${options.map(x => `<option value="${x}">${x}</option>`).join("")}
  `;
}

async function renderPage(page) {
  const config = PAGE_CONFIG[page];
  const container = document.querySelector("#page-" + page);

  PAGE_ROWS[page] = await loadRows(page);
  let rows = PAGE_ROWS[page];

  container.innerHTML = `
    <div class="page-head">
      <h1>${config.title}</h1>
      <div class="tools">
        <input class="search" placeholder="${page === "gelen" ? "Firma adı ara..." : "Müşteri adı ara..."}" />

        <select class="month-filter">${monthOptionsHtml()}</select>
        <select class="payment-filter">${paymentOptionsHtml(page)}</select>

        <label class="only-unpaid-wrap">
          <input type="checkbox" class="only-unpaid" />
          Ödenmeyenleri Göster
        </label>

        <button class="btn btn-red add-btn">+ Yeni Kayıt</button>
        <button class="btn btn-light export-btn">Excel'e Aktar</button>
      </div>
    </div>

    <div class="summary-wrap"></div>

    <div class="card table-wrap">
      <table>
        <thead>
          <tr>${config.headers.map(h => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="modal">
      <div class="modal-box">
        <h2 class="modal-title">Yeni Kayıt Ekle</h2>
        <div class="form-grid">${config.fields.map(fieldHtml).join("")}</div>
        <div class="modal-actions">
          <button class="btn btn-light close-btn">Vazgeç</button>
          <button class="btn btn-red save-btn">Kaydet</button>
        </div>
      </div>
    </div>
  `;

  const tbody = container.querySelector("tbody");
  const summary = container.querySelector(".summary-wrap");
  const search = container.querySelector(".search");
  const monthFilter = container.querySelector(".month-filter");
  const paymentFilter = container.querySelector(".payment-filter");
  const onlyUnpaid = container.querySelector(".only-unpaid");

  function currentFilters() {
    return {
      search: search.value || "",
      month: monthFilter.value || "",
      payment: paymentFilter.value || "",
      onlyUnpaid: onlyUnpaid.checked
    };
  }

  function draw() {
    const filters = currentFilters();
    const filtered = applyFilters(page, rows, filters);

    tbody.innerHTML = filtered.map(row => `
      <tr>
        ${rowCells(page, row).map(cell => `<td>${cell ?? ""}</td>`).join("")}
        <td>
          <div class="actions">
            <button class="icon-btn edit-btn" data-id="${row.id}">✎</button>
            <button class="icon-btn del-btn" data-id="${row.id}">🗑</button>
          </div>
        </td>
      </tr>
    `).join("");

    summary.innerHTML = summaryHtml(page, filtered, filters.month);
  }

  draw();

  container.querySelector(".add-btn").onclick = () => openModal(container, config);
  container.querySelector(".close-btn").onclick = () => closeModal(container);
  container.querySelector(".export-btn").onclick = () => exportCsv(config, applyFilters(page, rows, currentFilters()));

  search.oninput = draw;
  monthFilter.onchange = draw;
  paymentFilter.onchange = draw;
  onlyUnpaid.onchange = draw;

  container.querySelector(".save-btn").onclick = async () => {
    const obj = getFormValues(container, config);
    const editId = container.querySelector(".modal").dataset.editId || null;

    const ok = await upsertRow(page, obj, editId);
    if (!ok) return;

    rows = await loadRows(page);
    PAGE_ROWS[page] = rows;
    closeModal(container);
    draw();

    Object.keys(PAGE_CONFIG).forEach(p => {
      if (p !== page) {
        const el = document.querySelector("#page-" + p);
        if (el && el.innerHTML) {
          renderPage(p);
        }
      }
    });
  };

  tbody.onclick = async event => {
    const id = event.target.dataset.id;
    if (!id) return;

    if (event.target.classList.contains("edit-btn")) {
      const row = rows.find(r => r.id === id);
      openModal(container, config, row);
    }

    if (event.target.classList.contains("del-btn")) {
      const ok = await deleteRow(page, id);
      if (!ok) return;

      rows = await loadRows(page);
      PAGE_ROWS[page] = rows;
      draw();
    }
  };
}

document.querySelectorAll(".nav").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".nav").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));

    button.classList.add("active");
    document.querySelector("#page-" + button.dataset.page).classList.add("active");
  };
});

(async function init() {
  await Promise.all(Object.keys(PAGE_CONFIG).map(async page => {
    PAGE_ROWS[page] = await loadRows(page);
  }));

  Object.keys(PAGE_CONFIG).forEach(renderPage);
})();
