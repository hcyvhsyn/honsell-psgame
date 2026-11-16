import Image from "next/image";
import Link from "next/link";
import FooterBackToTop from "./FooterBackToTop";
import styles from "./SiteFooter.module.css";

const WHATSAPP_HREF = "https://wa.me/994702560509";
const PHONE_HREF = "tel:+994702560509";
const EMAIL = "info@honsell.site";

type FooterLink = { label: string; href: string; external?: boolean };

/**
 * Sütunlar. ⚠️ Mağaza əhatəsi PS-only-dir (lib/storeScope.ts) — yeni link əlavə edəndə
 * `isOpenStorePath` ilə açıq olduğunu yoxla, bağlı kateqoriyaya keçid vermə.
 */
const LINK_GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Mağaza",
    links: [
      { label: "PlayStation oyunları", href: "/oyunlar" },
      { label: "Endirimlər", href: "/endirimler" },
      { label: "PSN hədiyyə kartları", href: "/hediyye-kartlari" },
      { label: "Türkiyə PSN hesabı", href: "/hesab-acma" },
    ],
  },
  {
    title: "Abunəliklər",
    links: [
      { label: "PS Plus", href: "/ps-plus" },
      { label: "EA Play", href: "/ea-play" },
      { label: "Netflix", href: "/streaming/netflix" },
      { label: "Spotify Premium", href: "/music/spotify-premium" },
    ],
  },
  {
    title: "Kəşf et",
    links: [
      { label: "Reels", href: "/reels" },
      { label: "İcmallar", href: "/icma?tab=icmallar" },
      { label: "Bələdçilər", href: "/bilmeli-olduglarin" },
      { label: "Qazan (Referal)", href: "/qazan" },
    ],
  },
  {
    title: "Dəstək",
    links: [
      { label: "Tez verilən suallar", href: "/faq" },
      { label: "WhatsApp-da yaz", href: WHATSAPP_HREF, external: true },
      { label: "Bizə zəng et", href: PHONE_HREF, external: true },
      { label: "E-poçt göndər", href: `mailto:${EMAIL}`, external: true },
    ],
  },
  {
    title: "Honsell",
    links: [
      { label: "Haqqımızda", href: "/haqqimizda" },
      { label: "Müştəri rəyləri", href: "/reyler" },
      { label: "Hesabım", href: "/profile" },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Məxfilik siyasəti", href: "/mexfilik-siyaseti" },
  { label: "Geri qaytarma siyasəti", href: "/geri-qaytarma-siyaseti" },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  if (!link.external) return <Link href={link.href}>{link.label}</Link>;
  const isWeb = link.href.startsWith("http");
  return (
    <a href={link.href} {...(isWeb ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {link.label}
    </a>
  );
}

/**
 * Sayt footer-i: tünd bənövşəyi panel (hər iki temada eyni), brend + 5 sütun, hüquqi sətir,
 * Epoint ödəniş nişanı və altda solğun "HONSELL" su nişanı. Panelin kənarı navbar qabığı ilə
 * eyni xəttdədir (`--site-*` tokenləri).
 *
 * Performans: blur/daimi animasiya yoxdur; su nişanı loqo SVG-sinin CSS mask-ıdır (əlavə şəkil yox).
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={`honsell-site-footer ${styles.footer}`}>
      <div className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.top}>
            <div className={styles.brand}>
              <Link href="/" aria-label="Honsell ana səhifə" className={styles.logo}>
                <Image src="/honsell-logo.svg" alt="Honsell" width={168} height={29} />
              </Link>
              <p className={styles.tagline}>
                PlayStation oyunları, PS Plus, Netflix və Spotify abunəlikləri — hamısı bir yerdə.
              </p>
              <p className={styles.status}>
                <i aria-hidden />
                Hər gün 10:00–00:00 onlayn dəstək
              </p>
            </div>

            <nav className={styles.nav} aria-label="Footer naviqasiyası">
              {LINK_GROUPS.map((group) => (
                <div key={group.title} className={styles.group}>
                  <p className={styles.groupTitle}>{group.title}</p>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <FooterAnchor link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className={styles.bottom}>
            <div className={styles.legal}>
              <span>© {year} Honsell</span>
              {LEGAL_LINKS.map((link) => (
                <FooterAnchor key={link.label} link={link} />
              ))}
            </div>

            <div className={styles.actions}>
              <div className={styles.payment}>
                <span>Ödənişlər</span>
                <span className={styles.paymentChip} title="Ödəniş sistemi: Epoint">
                  <Image src="/payments/epoint.png" alt="Epoint" width={64} height={24} />
                </span>
              </div>
              <FooterBackToTop className={styles.toTop} labelClassName={styles.toTopLabel} />
            </div>
          </div>

          <p className={styles.company}>
            <span>Azərbaycan</span>
            <a href={PHONE_HREF}>+994 70 256 05 09</a>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>

          <div className={styles.watermark} aria-hidden>
            <span />
          </div>
        </div>
      </div>
    </footer>
  );
}
