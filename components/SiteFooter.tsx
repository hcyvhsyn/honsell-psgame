import Link from "next/link";

/**
 * Saytın ümumi footer-i. Ana səhifə və alt-səhifələrdə istifadə olunur.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-0 border-t border-white/5 bg-[#0B0B0E]">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-10">
          <p className="text-3xl font-black tracking-tight text-white">HONSELL</p>
          <nav className="flex flex-wrap items-center gap-6 text-sm text-zinc-300">
            <Link href="/playstation" className="hover:text-white transition">PlayStation</Link>
            <Link href="/streaming" className="hover:text-white transition">Streaming</Link>
            <Link href="/qazan" className="text-fuchsia-300 hover:text-fuchsia-200 transition">Qazan (Referal)</Link>
            <Link href="/haqqimizda" className="hover:text-white transition">Haqqımızda</Link>
            <Link href="/mexfilik-siyaseti" className="hover:text-white transition">Məxfilik siyasəti</Link>
            <Link href="/bilmeli-olduglarin" className="hover:text-white transition">Bələdçilər</Link>
            <Link href="/reyler" className="hover:text-white transition">Rəylər</Link>
          </nav>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 text-sm">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">PlayStation</p>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/oyunlar" className="hover:text-white transition">PS5 oyunları</Link></li>
              <li><Link href="/oyunlar" className="hover:text-white transition">PS4 oyunları</Link></li>
              <li><Link href="/endirimler" className="hover:text-white transition">Endirimli oyunlar</Link></li>
              <li><Link href="/oyunlar" className="hover:text-white transition">Yeni çıxan oyunlar</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Xidmətlər</p>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/ps-plus" className="hover:text-white transition">PS Plus Essential</Link></li>
              <li><Link href="/ps-plus" className="hover:text-white transition">PS Plus Extra</Link></li>
              <li><Link href="/ps-plus" className="hover:text-white transition">PS Plus Deluxe</Link></li>
              <li><Link href="/hesab-acma" className="hover:text-white transition">Türkiyə PSN hesabı</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Streaming</p>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/streaming/netflix" className="hover:text-white transition">Netflix</Link></li>
              <li><Link href="/streaming/hbo-max" className="hover:text-white transition">HBO Max</Link></li>
              <li><Link href="/streaming/gain" className="hover:text-white transition">Gain</Link></li>
              <li><Link href="/streaming/youtube" className="hover:text-white transition">YouTube Premium</Link></li>
              <li><Link href="/streaming/icmallar" className="hover:text-white transition">İcmallar</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hədiyyə Kartları</p>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/hediyye-kartlari" className="hover:text-white transition">TRY Wallet kartları</Link></li>
              <li><Link href="/hediyye-kartlari" className="hover:text-white transition">PSN top-up</Link></li>
              <li><Link href="/hediyye-kartlari" className="hover:text-white transition">PlayStation gift card</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Şirkət</p>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/haqqimizda" className="hover:text-white transition">Haqqımızda</Link></li>
              <li><Link href="/mexfilik-siyaseti" className="hover:text-white transition">Məxfilik siyasəti</Link></li>
              <li><Link href="/reyler" className="hover:text-white transition">Müştəri rəyləri</Link></li>
              <li><Link href="/#niye-biz" className="hover:text-white transition">Niyə biz?</Link></li>
              <li><Link href="/profile" className="hover:text-white transition">Hesabım</Link></li>
              <li><Link href="/cart" className="hover:text-white transition">Səbətim</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap gap-12 text-sm text-zinc-300">
            <div>
              <p className="mb-1 text-zinc-500">Telefon:</p>
              <p className="font-semibold text-white">+994 70 256 05 09</p>
            </div>
            <div>
              <p className="mb-1 text-zinc-500">Mail:</p>
              <p className="font-semibold text-white">info@honsell.store</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a href="#" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
            </a>
            <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <a href="#" aria-label="Telegram" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.086l-6.4 4.024-2.76-.86c-.6-.185-.615-.6.125-.89l10.736-4.135c.498-.184.935.114.825.86z"/></svg>
            </a>
            <a href="#" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a189a] text-white hover:bg-[#7b2cbf] transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
