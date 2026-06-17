# Anasayfa Konversiya Roadmap — Honsell PS Store

> Məqsəd: Anasayfanı satış maşınına çevirmək. Strategiya — kodda artıq mövcud olan, amma
> anasayfada görünməyən aktivləri (endirimlər, rəylər, kolleksiyalar) ön plana çıxarmaq +
> dijital satışda klassik etiraz olan "etibar" problemini sosial sübutla sındırmaq.

**Hazırkı vəziyyət:** Hero banner → Abunə paketləri → Çox satanlar → Platformalar → Niyə Biz → FAQ → Referral
**Əsas problem:** Endirimlər, müştəri rəyləri və kolleksiyalar ayrı səhifələrdə "gizlənib", anasayfaya çıxmayıb.

---

## 🎯 Şimal ulduzu metrikası
- **Konversiya nisbəti** (ziyarətçi → sifariş)
- **Orta səbət dəyəri (AOV)**
- **Təkrar alış nisbəti**

Hər mərhələdən sonra bu 3 rəqəmi ölç.

---

## FAZA 0 — Ölçmə altyapısı (1-2 gün) · ÖNKOŞUL
Bunsuz heç nəyin işlədiyini bilməyəcəyik.
- [ ] Event tracking qur (hero klik, "səbətə əlavə", checkout başlama/bitmə)
- [ ] Anasayfa bölmələrinə görə klik izləmə (hansı bölmə satır?)
- [ ] Funnel: anasayfa → məhsul → səbət → ödəniş drop-off harada?

---

## FAZA 1 — Sürətli qələbələr (1 həftə) · ƏN YÜKSƏK ROI
Mövcud datanı anasayfaya bağlamaq. Kod minimaldır, təsir böyükdür.

### 1.1 🔥 Endirim karuseli anasayfaya
- `/endirimler` datasını anasayfaya karusel kimi gətir
- Qiymət üstündən xətt + endirim faizi badge (`-70%`)
- "Hamısına bax →" CTA `/endirimler`-ə
- **Təsir:** Yüksək · **Səy:** Aşağı (data hazırdır)

### 1.2 ⭐ Trust zolağı (hero altında)
- "12,000+ uğurlu sifariş · 4.9★ · Anında çatdırılma"
- Real rəqəmlər DB-dən (sifariş sayı, orta reytinq)
- **Təsir:** Yüksək · **Səy:** Aşağı

### 1.3 💬 Müştəri rəyləri anasayfada
- `ReviewCard` komponenti hazırdır — ən yaxşı 3-6 rəyi anasayfaya çıxar
- Ad + ulduz + qısa mətn + "təsdiqlənmiş alıcı" badge
- **Təsir:** Yüksək · **Səy:** Aşağı

### 1.4 🎯 Hero banner-i təklifə yönəlt
- "Honsell-ə xoş gəldiniz" yox → "PS Plus Deluxe -40%, 19 AZN-dən"
- Hər banner-də konkret qiymət + CTA
- **Təsir:** Orta-Yüksək · **Səy:** Aşağı (kontent dəyişikliyi)

---

## FAZA 2 — Aciliyyat və kəşfiyyat (2-3 həftə)

### 2.1 ⏱ Countdown / aciliyyat
- Endirim kampaniyalarına "bu qiymət X saat qalır" sayğacı
- Stok/limit göstəricisi ("son 3 ədəd" tipli, uyğun məhsullarda)
- **Təsir:** Yüksək · **Səy:** Orta

### 2.2 📚 Kolleksiyaları anasayfaya
- `/kolleksiyalar` datasını anasayfaya bölmə kimi gətir
- "RPG sevənlər", "PS5 eksklüzivləri", "Ən ucuz oyunlar"
- **Təsir:** Orta · **Səy:** Aşağı (data hazırdır)

### 2.3 🔔 Canlı satış bildirişləri
- "Bakıdan biri 5 dəq əvvəl PS Plus aldı" pop-up
- Real sifariş datasından (anonimləşdirilmiş)
- **Təsir:** Orta-Yüksək · **Səy:** Orta

### 2.4 👀 "Son baxılanlar"
- localStorage-dan istifadəçinin son baxdığı məhsullar
- **Təsir:** Orta · **Səy:** Aşağı

---

## FAZA 3 — AOV və təkrar satış (3-4 həftə)

### 3.1 📦 Bundle / paket təklifləri
- "PS Plus + oyun", "Netflix + Spotify" birlikdə endirimlə
- Səbətdə "bunu da əlavə et" cross-sell
- **Təsir:** Yüksək (AOV) · **Səy:** Orta-Yüksək

### 3.2 🎁 İlk alış kuponu + e-mail toplama
- Qeydiyyat/e-mail müqabilində ilk alışa endirim
- E-mail bazası = gələcəkdə pulsuz remarketing kanalı
- **Təsir:** Yüksək (uzunmüddət) · **Səy:** Orta

### 3.3 🤝 Referral CTA-nı yuxarı çıxar
- Hazırda ən aşağıdadır, az adam görür
- Hero-ya yaxın və ya sticky bar kimi
- **Təsir:** Orta · **Səy:** Aşağı

### 3.4 🧠 Personalizasiya ("Sənə uyğun")
- Favoritlər + baxış tarixçəsinə görə tövsiyə
- AI chat (mövcud `AskAiFloat`) datasından istifadə
- **Təsir:** Orta-Yüksək · **Səy:** Yüksək

---

## FAZA 4 — Loyallıq və uzunmüddət (davamlı)

### 4.1 🏆 Loyallıq / cashback proqramı
- Hər alışdan bal → növbəti alışda endirim
- **Təsir:** Yüksək (LTV) · **Səy:** Yüksək

### 4.2 📰 News/məqalə anasayfada
- `showOnHome` flag artıq var — SEO + nişanlanma üçün
- **Təsir:** Aşağı-Orta (əsasən SEO) · **Səy:** Aşağı

### 4.3 🔁 Tərk edilmiş səbət remarketing
- E-mail/bildiriş ilə yarımçıq səbət xatırlatması
- **Təsir:** Yüksək · **Səy:** Yüksək

---

## Prioritet matrisi (qısa)

| Tapşırıq | Təsir | Səy | Faza |
|---|---|---|---|
| Endirim karuseli | 🔴 Yüksək | 🟢 Aşağı | 1 |
| Trust zolağı | 🔴 Yüksək | 🟢 Aşağı | 1 |
| Müştəri rəyləri | 🔴 Yüksək | 🟢 Aşağı | 1 |
| Hero təklifə yönəlmə | 🟡 Orta-Yüksək | 🟢 Aşağı | 1 |
| Countdown/aciliyyat | 🔴 Yüksək | 🟡 Orta | 2 |
| Canlı satış bildirişi | 🟡 Orta-Yüksək | 🟡 Orta | 2 |
| Kolleksiyalar | 🟡 Orta | 🟢 Aşağı | 2 |
| Bundle təklifləri | 🔴 Yüksək (AOV) | 🟡 Orta | 3 |
| İlk alış kuponu | 🔴 Yüksək | 🟡 Orta | 3 |
| Tərk edilmiş səbət | 🔴 Yüksək | 🔴 Yüksək | 4 |

---

## Tövsiyə olunan başlanğıc
**Faza 1-dən başla.** Hamısı mövcud datadan istifadə edir, 1 həftəyə sığar və ən böyük
təsiri verər. Ölçməni (Faza 0) paralel qur ki, nəyin işlədiyini görəsən.
