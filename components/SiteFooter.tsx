import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import styles from "./SiteFooter.module.css";

const WHATSAPP_HREF = "https://wa.me/994702560509";

const linkGroups = [
  {
    title: "Mağaza",
    links: [
      ["PlayStation oyunları", "/oyunlar"],
      ["Endirimdə olan oyunlar", "/endirimler"],
      ["PS Plus paketləri", "/ps-plus"],
      ["Streaming", "/streaming"],
    ],
  },
  {
    title: "Xidmətlər",
    links: [
      ["Hədiyyə kartları", "/hediyye-kartlari"],
      ["Türkiyə PSN hesabı", "/hesab-acma"],
      ["İcmallar", "/icma?tab=icmallar"],
      ["Qazan (Referal)", "/qazan"],
    ],
  },
  {
    title: "Dəstək",
    links: [
      ["Tez verilən suallar", "/faq"],
      ["Geri qaytarma", "/geri-qaytarma-siyaseti"],
      ["Məxfilik siyasəti", "/mexfilik-siyaseti"],
      ["Bələdçilər", "/bilmeli-olduglarin"],
    ],
  },
  {
    title: "Honsell",
    links: [
      ["Haqqımızda", "/haqqimizda"],
      ["Müştəri rəyləri", "/reyler"],
      ["Niyə biz?", "/#niye-biz"],
      ["Hesabım", "/profile"],
    ],
  },
] as const;

const mobileLinks = [
  ["Oyunlar", "/oyunlar"],
  ["PS Plus", "/ps-plus"],
  ["Streaming", "/streaming"],
  ["FAQ", "/faq"],
] as const;

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <span className={styles.ambientOne} aria-hidden />
      <span className={styles.ambientTwo} aria-hidden />

      <div className={styles.desktopFooter}>
        <section className={styles.cta} aria-label="Honsell dəstək">
          <div className={styles.ctaCopy}>
            <span className={styles.eyebrow}>
              <Sparkles aria-hidden />
              HONSELL DƏSTƏK
            </span>
            <h2>Növbəti seçimin bir mesaj uzaqdadır.</h2>
            <p>Oyun, paket və qiymət seçərkən komandamız sənə kömək edəcək.</p>
          </div>

          <div className={styles.ctaActions}>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.primaryAction}
            >
              <MessageCircle aria-hidden />
              WhatsApp-da yaz
              <ArrowUpRight aria-hidden />
            </a>
            <a href="mailto:info@honsell.store" className={styles.secondaryAction}>
              <Mail aria-hidden />
              E-poçt göndər
            </a>
          </div>
        </section>

        <div className={styles.mainGrid}>
          <div className={styles.brandColumn}>
            <Link href="/" aria-label="Honsell ana səhifə" className={styles.logoLink}>
              <Image
                src="/honsell-logo.svg"
                alt="Honsell"
                width={168}
                height={29}
                className="honsell-logo-img"
              />
            </Link>
            <p>Oyun, abunəlik və rəqəmsal xidmətlər üçün etibarlı ünvan.</p>

            <div className={styles.contactList}>
              <a href="tel:+994702560509">
                <Phone aria-hidden />
                +994 70 256 05 09
              </a>
              <a href="mailto:info@honsell.store">
                <Mail aria-hidden />
                info@honsell.store
              </a>
            </div>
          </div>

          <nav className={styles.linkGrid} aria-label="Footer naviqasiyası">
            {linkGroups.map((group) => (
              <div key={group.title} className={styles.linkGroup}>
                <p>{group.title}</p>
                <ul>
                  {group.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.trustStrip}>
          <span><Zap aria-hidden /> Ani rəqəmsal çatdırılma</span>
          <span><ShieldCheck aria-hidden /> Təhlükəsiz ödəniş</span>
          <span><Clock3 aria-hidden /> Hər gün 10:00–00:00 dəstək</span>
        </div>

        <div className={styles.legalRow}>
          <p>© {year} Honsell. Bütün hüquqlar qorunur.</p>
          <div>
            <Link href="/mexfilik-siyaseti">Məxfilik</Link>
            <Link href="/geri-qaytarma-siyaseti">Geri qaytarma</Link>
          </div>
        </div>
      </div>

      <div className={styles.mobileFooter}>
        <div className={styles.mobileTop}>
          <Link href="/" aria-label="Honsell ana səhifə">
            <Image
              src="/honsell-logo.svg"
              alt="Honsell"
              width={145}
              height={25}
              className="honsell-logo-img"
            />
          </Link>
          <span className={styles.mobileStatus}><i /> Onlayn dəstək</span>
        </div>

        <p className={styles.mobileTagline}>Rəqəmsal əyləncə, sadə və etibarlı.</p>

        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mobileWhatsapp}
        >
          <MessageCircle aria-hidden />
          WhatsApp-da bizə yaz
          <ArrowUpRight aria-hidden />
        </a>

        <nav className={styles.mobileLinks} aria-label="Footer naviqasiyası">
          {mobileLinks.map(([label, href]) => (
            <Link key={label} href={href}>{label}</Link>
          ))}
        </nav>

        <div className={styles.mobileContact}>
          <a href="tel:+994702560509">+994 70 256 05 09</a>
          <span aria-hidden>•</span>
          <a href="mailto:info@honsell.store">info@honsell.store</a>
        </div>

        <p className={styles.mobileLegal}>© {year} Honsell</p>
      </div>
    </footer>
  );
}
