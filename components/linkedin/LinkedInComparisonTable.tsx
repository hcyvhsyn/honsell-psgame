import { Check, Minus } from "lucide-react";

type Row = {
  feature: string;
  career: string | boolean;
  business: string | boolean;
};

const ROWS: Row[] = [
  { feature: "Aylıq InMail mesajları", career: "5", business: "15" },
  { feature: "Kim profilinə baxıb (tarixçə)", career: "Son 90 gün", business: "Limitsiz" },
  { feature: "İş axtarış insights", career: true, business: true },
  { feature: "Maaş bandı məlumatı", career: true, business: true },
  { feature: "LinkedIn Learning kursları", career: true, business: true },
  { feature: "Open Profile", career: true, business: true },
  { feature: "Geniş axtarış filtri", career: false, business: true },
  { feature: "Şirkət böyümə insights", career: false, business: true },
  { feature: "Sənaye trend analizi", career: false, business: true },
  { feature: "Premium Profile rozetkası", career: true, business: true },
  { feature: "Kim üçün uyğundur?", career: "Karyera və iş axtarışı", business: "Networking və biznes" },
];

function Cell({ value, accent }: { value: string | boolean; accent: "career" | "business" }) {
  if (typeof value === "boolean") {
    return value ? (
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
          accent === "career" ? "bg-sky-500/15 text-sky-300" : "bg-blue-500/15 text-blue-300"
        }`}
      >
        <Check className="h-4 w-4" />
      </span>
    ) : (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-600">
        <Minus className="h-4 w-4" />
      </span>
    );
  }
  return <span className="text-sm font-semibold text-zinc-100">{value}</span>;
}

export default function LinkedInComparisonTable() {
  return (
    <section className="space-y-4">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Müqayisə</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Career vs Business
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Hər iki plan arasındakı fərqi tam aydın gör.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent">
              <tr className="border-b border-white/10">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Xüsusiyyət
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-sky-300">
                  Career
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-blue-300">
                  Business
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-white/5 transition hover:bg-white/[0.02] ${
                    i === ROWS.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-zinc-200">
                    {row.feature}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <Cell value={row.career} accent="career" />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <Cell value={row.business} accent="business" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
