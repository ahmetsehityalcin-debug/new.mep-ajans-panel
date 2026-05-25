const PAGE_CONFIG = {
  faturali: {
    title: "Faturalı Siparişler",
    page: "faturali"
  },
  gelen: {
    title: "Gelen Faturalar",
    page: "gelen"
  },
  faturasiz: {
    title: "Faturasız Siparişler",
    page: "faturasiz"
  }
};

let currentPage = "faturali";

function money(v) {
  return Number(v || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });
}

function getData(page) {
  return JSON.parse(localStorage.getItem("mep_" + page) || "[]");
}

function setData(page, data) {
  localStorage.setItem("mep_" + page, JSON.stringify(data));
}

function calculateKDV(toplam, oran) {
  return (Number(toplam || 0) * Number(oran || 0)) / 100;
}

function renderPage(page) {
  currentPage = page;

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  document.getElementById("btn-" + page).classList.add("active");

  const rows = getData(page);

  const container = document.getElementById("table-area");

  let totalSales = 0;
  let totalProfit = 0;
  let totalKDV = 0;
  let totalDebt = 0;

  rows.forEach(r => {
    totalSales += Number(r.toplam_satis || 0);
    totalProfit += Number(r.kar || 0);
    totalKDV += Number(r.kdv_farki || 0);

    if (r.odeme_durumu !== "Ödendi") {
      totalDebt += Number(r.toplam_satis || 0);
    }
  });

  container.innerHTML = `
    <div class="top-bar">
      <button onclick="openModal()">+ Yeni Kayıt Ekle</button>

      <select id="monthFilter" onchange="renderPage(currentPage)">
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

      <label>
        <input type="checkbox" id="onlyDebt" onchange="renderPage(currentPage)">
        Ödenmeyenleri Göster
      </label>
    </div>

    <table>
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Müşteri</th>
          <th>Ürün</th>
          <th>Toplam Satış</th>
          <th>KDV</th>
          <th>KDV Dahil</th>
          <th>Kâr</th>
          <th>Ödeme</th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.tarih}</td>
            <td>${r.musteri}</td>
            <td>${r.urun}</td>
            <td>${money(r.toplam_satis)}</td>
            <td>${money(r.kdv_farki)}</td>
            <td>${money(Number(r.toplam_satis) + Number(r.kdv_farki))}</td>
            <td>${money(r.kar)}</td>
            <td>${r.odeme_durumu}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="summary">
      <div>Toplam Satış: ${money(totalSales)}</div>
      <div>Toplam Kâr: ${money(totalProfit)}</div>
      <div>Toplam KDV: ${money(totalKDV)}</div>
      <div>Toplam Alacak: ${money(totalDebt)}</div>
    </div>
  `;
}

function openModal() {
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function saveRecord() {
  const tarih = document.getElementById("tarih").value;
  const musteri = document.getElementById("musteri").value;
  const urun = document.getElementById("urun").value;
  const toplam_satis = Number(document.getElementById("toplam_satis").value);
  const toplam_maliyet = Number(document.getElementById("toplam_maliyet").value);
  const kdv_orani = Number(document.getElementById("kdv_orani").value);

  const kdv_farki = calculateKDV(toplam_satis, kdv_orani);

  const kar = toplam_satis - toplam_maliyet;

  const odeme_durumu = document.getElementById("odeme_durumu").value;

  const row = {
    tarih,
    musteri,
    urun,
    toplam_satis,
    toplam_maliyet,
    kdv_farki,
    kar,
    odeme_durumu
  };

  const data = getData(currentPage);

  data.push(row);

  setData(currentPage, data);

  closeModal();

  renderPage(currentPage);
}

window.onload = () => {
  renderPage("faturali");
};
