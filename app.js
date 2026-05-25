const PAGE_CONFIG = {
  faturali: {
    title: "Faturalı Siparişler",
    page: "faturali",
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
    headers: ["Tarih", "Müşteri Adı", "Ürün", "Adet", "Toplam Maliyet", "Toplam Satış", "KDV Farkı", "KDV Dahil Toplam", "Kâr", "Durumu", "Ödeme Durumu", "Fatura Durumu", "Açıklama", "İşlem"]
  },

  gelen: {
    title: "Gelen Faturalar",
    page: "gelen",
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
    headers: ["Tarih", "Firma", "Ürün", "Adet", "Toplam Tutar", "KDV Dahil Toplam", "KDV Farkı", "Durumu", "Ödeme Durumu", "Açıklama / Not", "İşlem"]
  },

  faturasiz: {
    title: "Faturasız Siparişler",
    page: "faturasiz",
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
    headers: ["Tarih", "Müşteri Adı", "Ürün", "Adet", "Toplam Maliyet", "Toplam Satış", "Kâr", "Durumu", "Ödeme Durumu", "Notlar", "İşlem"]
  }
};

let supabaseClient = null;

if (window.MEP_SUPABASE_URL && window.MEP_SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(
    window.MEP_SUPABASE_URL,
    window.MEP_SUPABASE_ANON_KEY
  );
}

const money = value =>
  Number(value || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });

const today = () => new Date().toISOString().slice(0, 10);

function calculate(row) {
  const cost = Number(row.toplam_maliyet || 0);
  const sale = Number(row.toplam_satis || 0);
  const total = Number(row.toplam_tutar || 0);
  const base = sale || total;

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
    .order("created_at", { ascending: false });

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

    if (id) {
      localStorage.setItem(
        "mep_" + page,
        JSON.stringify(rows.map(r => r.id === id ? { ...payload, id } : r))
      );
    } else {
      localStorage.setItem(
        "mep_" + page,
        JSON.stringify([{ ...payload, id: crypto.randomUUID() }, ...rows])
      );
    }

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
    localStorage.setItem(
      "mep_" + page,
      JSON.stringify(rows.filter(r => r.id !== id))
    );
    return true;
  }

  const { error } = await supabaseClient
    .from("kayitlar")
    .delete()
    .eq("id", id);

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
      `<b class="profit">${money(c.kar)}</b>`,
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
    `<b class="profit">${money(c.kar)}</b>`,
    badge(row.durum),
    badge(row.odeme_durumu),
    row.notlar || ""
  ];
}

function summaryHtml(page, rows) {
  let totalCost = 0;
  let totalSale = 0;
  let totalVat = 0;
  let totalProfit = 0;
  let totalInvoice = 0;
  let totalReceivable = 0;
  let totalDebt = 0;

  rows.forEach(r => {
    const c = calculate(r);

    totalCost += Number(r.toplam_maliyet || r.toplam_tutar || 0);
    totalSale += Number(r.toplam_satis || 0);
    totalVat += Number(c.kdv_farki || 0);
    totalProfit += Number(c.kar || 0);
    totalInvoice += Number(c.kdv_dahil_toplam || 0);

    const unpaid =
      r.odeme_durumu === "Bekleniyor" ||
      r.odeme_durumu === "Ödenmedi" ||
      r.odeme_durumu === "Kısmi Ödeme";

    if (unpaid && page === "faturali") {
      totalReceivable += Number(c.kdv_dahil_toplam || 0);
    }

    if (unpaid && page === "faturasiz") {
      totalReceivable += Number(r.toplam_satis || 0);
    }

    if (unpaid && page === "gelen") {
      totalDebt += Number(c.kdv_dahil_toplam || 0);
    }
  });

  let items = [];

  if (page === "gelen") {
    items = [
      ["Toplam Tutar", totalCost],
      ["KDV Farkı", totalVat],
      ["KDV Dahil Toplam", totalInvoice],
      ["Toplam Borç", totalDebt],
      ["Toplam Kayıt", rows.length]
    ];
  } else if (page === "faturali") {
    items = [
      ["Toplam Maliyet", totalCost],
      ["Toplam Satış", totalSale],
      ["Toplam Kâr", totalProfit],
      ["KDV Farkı", totalVat],
      ["Toplam Alacak", totalReceivable],
      ["Toplam Kayıt", rows.length]
    ];
  } else {
    items = [
      ["Toplam Maliyet", totalCost],
      ["Toplam Satış", totalSale],
      ["Toplam Kâr", totalProfit],
      ["Toplam Alacak", totalReceivable],
      ["Toplam Kayıt", rows.length]
    ];
  }

  return `<div class="summary">
    ${items.map(([label, value]) => `
      <div class="sum-item">
        <small>${label}</small>
        <strong>${label === "Toplam Kayıt" ? value : money(value)}</strong>
      </div>
    `).join("")}
  </div>`;
}
  let totalCost = 0;
  let totalSale = 0;
  let totalVat = 0;
  let totalProfit = 0;
  let totalInvoice = 0;

  rows.forEach(r => {
    const c = calculate(r);

    totalCost += Number(r.toplam_maliyet || r.toplam_tutar || 0);
    totalSale += Number(r.toplam_satis || 0);
    totalVat += Number(c.kdv_farki || 0);
    totalProfit += Number(c.kar || 0);
    totalInvoice += Number(c.kdv_dahil_toplam || 0);
  });

  const items = page === "gelen"
    ? [
        ["Toplam Tutar", totalCost],
        ["KDV Farkı", totalVat],
        ["KDV Dahil Toplam", totalInvoice],
        ["Toplam Kayıt", rows.length]
      ]
    : [
        ["Toplam Maliyet", totalCost],
        ["Toplam Satış", totalSale],
        ["Toplam Kâr", totalProfit],
        ["KDV Farkı", totalVat],
        ["Toplam Kayıt", rows.length]
      ];

  return `<div class="summary">
    ${items.map(([label, value]) => `
      <div class="sum-item">
        <small>${label}</small>
        <strong>${label === "Toplam Kayıt" ? value : money(value)}</strong>
      </div>
    `).join("")}
  </div>`;
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

    if (name === "kdv_orani") {
      input.value = row?.kdv_orani || "20";
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
      .slice(0, -1)
      .map(cell => String(cell ?? "").replace(/<[^>]+>/g, "").replaceAll(";", ","))
      .join(";")
  );

  const csv = ["\ufeff" + headers.join(";"), ...body].join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = config.title + ".csv";
  a.click();
}

async function renderPage(page) {
  const config = PAGE_CONFIG[page];
  const container = document.querySelector("#page-" + page);
  let rows = await loadRows(page);

  container.innerHTML = `
    <div class="page-head">
      <h1>${config.title}</h1>
      <div class="tools">
      <select class="month-filter">
  <option value="">Tüm Aylar</option>
  <option value="01">Ocak</option>
  <option value="02">Şubat</option>
  <option value="03">Mart</option>
  <option value="04">Nisan</option>
  <option value="05">Mayıs</option>
  <option value="06">Haziran</option>
  <option value="07">Temmuz</option>
  <option value="08">Ağustos</option>
  <option value="09">Eylül</option>
  <option value="10">Ekim</option>
  <option value="11">Kasım</option>
  <option value="12">Aralık</option>
</select>

<select class="payment-filter">
  <option value="">Tüm Ödemeler</option>
  <option value="Ödendi">Ödendi</option>
  <option value="Bekleniyor">Bekleniyor</option>
  <option value="Ödenmedi">Ödenmedi</option>
  <option value="Kısmi Ödeme">Kısmi Ödeme</option>
</select>

<label class="only-unpaid-wrap">
  <input type="checkbox" class="only-unpaid" />
  Ödenmeyenleri Göster
</label>
        <button class="btn btn-red add-btn">+ Yeni Kayıt Ekle</button>
        <button class="btn btn-light export-btn">Excel'e Aktar</button>
        <input class="search" placeholder="Ara..." />
      </div>
    </div>

    <div class="card table-wrap">
      <table>
        <thead>
          <tr>${config.headers.map(h => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="summary-wrap"></div>

    <div class="modal">
      <div class="modal-box">
        <h2 class="modal-title">Yeni Kayıt Ekle</h2>

        <div class="form-grid">
          ${config.fields.map(fieldHtml).join("")}
        </div>

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

  function draw() {
    const q = search.value.toLowerCase().trim();

    const selectedMonth = monthFilter.value;
const selectedPayment = paymentFilter.value;
const showOnlyUnpaid = onlyUnpaid.checked;

const filtered = rows.filter(r => {
  const textMatch = JSON.stringify(r).toLowerCase().includes(q);

  const rowMonth = r.tarih ? r.tarih.slice(5, 7) : "";
  const monthMatch = !selectedMonth || rowMonth === selectedMonth;

  const paymentMatch = !selectedPayment || r.odeme_durumu === selectedPayment;

  const unpaidMatch =
    !showOnlyUnpaid ||
    r.odeme_durumu === "Bekleniyor" ||
    r.odeme_durumu === "Ödenmedi" ||
    r.odeme_durumu === "Kısmi Ödeme";

  return textMatch && monthMatch && paymentMatch && unpaidMatch;
});

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

    summary.innerHTML = summaryHtml(page, filtered);
  }

  draw();

  container.querySelector(".add-btn").onclick = () => openModal(container, config);
  container.querySelector(".close-btn").onclick = () => closeModal(container);
  container.querySelector(".export-btn").onclick = () => exportCsv(config, rows);
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
    closeModal(container);
    draw();
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

Object.keys(PAGE_CONFIG).forEach(renderPage);
