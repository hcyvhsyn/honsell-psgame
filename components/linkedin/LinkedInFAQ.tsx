import FaqAccordion from "@/components/FaqAccordion";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FALLBACK_FAQ: FaqItem[] = [
  {
    id: "activation",
    question: "Abunəlik necə aktivləşdirilir?",
    answer:
      "Səbətə əlavə edərkən LinkedIn hesabının email və şifrəsini daxil edirsən. Ödənişdən sonra admin sənin hesabına daxil olub Premium abunəliyini aktivləşdirir və hesabdan dərhal çıxır.",
  },
  {
    id: "credentials",
    question: "Email və şifrəm təhlükəsizdir?",
    answer:
      "Bəli. Hesab məlumatların yalnız Premium aktivləşdirməsi üçün istifadə olunur, şifrələnmiş şəkildə saxlanılır və proses bitdikdən sonra hesabından çıxış edirik. Aktivləşdirmədən sonra istəsən şifrəni dəyişə bilərsən.",
  },
  {
    id: "career-vs-business",
    question: "Career və Business arasında fərq nədir?",
    answer:
      "Career planı iş axtaranlar, tələbələr və karyera inkişafı üçündür. Business planı isə networking, biznes inkişafı və satış üçündür — daha çox InMail, geniş axtarış filtri və şirkət insights təqdim edir.",
  },
];

export default function LinkedInFAQ({ items }: { items?: FaqItem[] }) {
  const list = items && items.length > 0 ? items : FALLBACK_FAQ;

  return (
    <section className="space-y-6">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">FAQ</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Tez-tez verilən suallar
        </h2>
      </header>

      <div className="rounded-3xl border border-white/10 bg-zinc-950/80 px-5 shadow-2xl sm:px-8">
        <FaqAccordion items={list} />
      </div>
    </section>
  );
}
