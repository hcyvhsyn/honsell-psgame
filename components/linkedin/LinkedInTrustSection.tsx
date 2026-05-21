import { Lock, ShieldCheck, UserCircle2, Zap } from "lucide-react";

const ITEMS = [
  {
    icon: UserCircle2,
    title: "Öz hesabına aktivləşdirilir",
    text: "Abunəlik birbaşa sənin LinkedIn profilinə qoşulur — bizim qondarma hesabımız yoxdur.",
  },
  {
    icon: Lock,
    title: "Məlumatların təhlükəsiz saxlanılır",
    text: "Səbətə əlavə edərkən LinkedIn email və şifrəni daxil edirsən — yalnız Premium aktivləşdirməsi üçün istifadə olunur və şifrələnmiş şəkildə saxlanılır.",
  },
  {
    icon: ShieldCheck,
    title: "Rəsmi LinkedIn abunəliyi",
    text: "Tam funksional Premium — InMail, insights, LinkedIn Learning və bütün xüsusiyyətlər aktiv.",
  },
  {
    icon: Zap,
    title: "Sürətli aktivləşdirmə",
    text: "İş saatları daxilində 1-3 saat ərzində Premium statusu hesabında görəcəksən.",
  },
];

export default function LinkedInTrustSection() {
  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent p-6 shadow-2xl sm:p-8">
      <header className="mb-6 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          Təhlükəsiz və şəffaf
        </span>
        <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
          Necə işləyir?
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          Aktivləşdirmə tamamilə sənin öz hesabın üzərindən aparılır — heç bir paylaşılan hesab,
          heç bir gizli şərt yoxdur.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-emerald-400/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
              <Icon className="h-5 w-5 text-emerald-300" />
            </span>
            <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
