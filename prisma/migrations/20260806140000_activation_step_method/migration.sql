-- Aktivləşdirmə addımlarına ÜSUL (method) sütunu.
--
-- Səbəb: addımlar public-də 1→N ardıcıl axın kimi göstərilirdi, halbuki onlar
-- alternativ üsullardır (konsol / mobil tətbiq / brauzer). Nömrələnmiş vahid
-- siyahı müştəriyə "altı addımın hamısını et" mesajı verirdi — səhv.
--
-- Nullable saxlanılır: `method` boş olan sətirlər üçün UI qruplaşdırma etmir və
-- köhnə davranışa (tək siyahı) düşür, yəni mövcud məzmun pozulmur.
ALTER TABLE "ActivationStep"
  ADD COLUMN IF NOT EXISTS "method" TEXT;

-- Tab-ların sırası scope içində sortOrder-lə təyin olunur; sorğu həmişə
-- scope + isActive + sortOrder üzrə gedir, ona görə mövcud indeks kifayətdir.
