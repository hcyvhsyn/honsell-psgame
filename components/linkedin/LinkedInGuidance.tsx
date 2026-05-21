import { Briefcase, GraduationCap, Lightbulb } from "lucide-react";

const CAREER_FOR = [
  "İş axtaranlar",
  "Tələbələr və yeni məzunlar",
  "Freelancer-lər",
  "Profilini gücləndirmək istəyənlər",
  "Daha yaxşı iş təklifləri və karyera fürsətləri axtaranlar",
];

const BUSINESS_FOR = [
  "Biznes sahibləri",
  "Founder-lər və startap qurucuları",
  "Satış və biznes inkişafı mütəxəssisləri",
  "Peşəkar network-ü genişləndirmək istəyənlər",
  "Daha güclü biznes insights və profil görünürlüyü axtaranlar",
];

export default function LinkedInGuidance() {
  return (
    <section className="space-y-6">
      <header className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
          <Lightbulb className="h-3.5 w-3.5" />
          Hansı planı seçim?
        </p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Sənə uyğun olanı tap
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          İki sadə sual cavabla — sənin üçün doğru plan aydın olacaq.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <article className="rounded-3xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-transparent p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-400/30 bg-sky-500/10">
              <GraduationCap className="h-6 w-6 text-sky-300" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Career</p>
              <h3 className="mt-0.5 text-xl font-black text-white">İş axtarışı və karyera</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Əgər məqsədin yeni iş tapmaq, peşəkar profilini gücləndirmək və ya öyrənməyə davam etməkdirsə —{" "}
            <span className="font-bold text-sky-200">Career</span> sənin üçündür.
          </p>
          <ul className="mt-4 space-y-2">
            {CAREER_FOR.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-600/15 via-indigo-600/5 to-transparent p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-500/35 bg-blue-500/10">
              <Briefcase className="h-6 w-6 text-blue-300" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Business</p>
              <h3 className="mt-0.5 text-xl font-black text-white">Networking və biznes</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Əgər biznesini böyütmək, satış imkanlarını artırmaq və ya peşəkar əlaqələrini genişləndirmək istəyirsənsə —{" "}
            <span className="font-bold text-blue-200">Business</span> sənin üçündür.
          </p>
          <ul className="mt-4 space-y-2">
            {BUSINESS_FOR.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
