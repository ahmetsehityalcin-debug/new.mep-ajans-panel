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
let PAGE_ROWS = { faturali: [], gelen: [], faturasiz: [] };

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

})();
