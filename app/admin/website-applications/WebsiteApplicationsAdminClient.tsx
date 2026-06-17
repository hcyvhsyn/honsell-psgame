"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type Application = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  contactMethod: string | null;
  businessName: string | null;
  websiteType: string;
  packageId: string | null;
  package: { id: string; name: string; priceRange: string } | null;
  budgetRange: string | null;
  hasLogo: boolean | null;
  hasDomain: boolean | null;
  hasHosting: boolean | null;
  projectBrief: string;
  existingWebsiteUrl: string | null;
  referenceWebsiteLinks: string | null;
  attachmentsUrl: string | null;
  requestedSections: unknown;
  languages: unknown;
  preferredStartDate: string | null;
  urgency: string | null;
  wantsCustomDesign: boolean | null;
  designStyle: string | null;
  contentStatus: string | null;
  selectedAddOns: unknown;
  estimatedPriceMin: string | number | null;
  estimatedPriceMax: string | number | null;
  estimateBreakdown: unknown;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AddOnLine = {
  addOnId: string;
  slug: string;
  name: string;
  pricingType: "FLAT" | "PER_UNIT";
  units: number;
  unitPrice: number | null;
  freeUnits: number | null;
  flatPrice: number | null;
  lineTotal: number;
  note?: string;
};

type EstimateBreakdown = {
  baseRange: [number, number] | null;
  complexityFactor: number | null;
  reasoning: string | null;
  source: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  CONTACTED: "Əlaqə saxlanıldı",
  PRICE_GIVEN: "Qiymət verildi",
  ACCEPTED: "Qəbul edildi",
  REJECTED: "Rədd edildi",
  COMPLETED: "Tamamlandı",
};

const STATUS_TONES: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-700 ring-blue-500/30",
  CONTACTED: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/30",
  PRICE_GIVEN: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
  ACCEPTED: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
  COMPLETED: "bg-violet-500/15 text-violet-700 ring-violet-500/30",
};

const WEBSITE_TYPE_LABELS: Record<string, string> = {
  BUSINESS: "Biznes / satış saytı",
  PORTFOLIO: "Portfolio / şəxsi brend",
  RESTAURANT: "Restaurant / kurs / xidmət",
  ECOMMERCE: "E-commerce",
  LANDING: "Landing page",
  OTHER: "Digər",
};

const URGENCY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Təcili",
  FLEXIBLE: "Çevik müddət",
};

const CONTENT_STATUS_LABELS: Record<string, string> = {
  READY: "Kontent hazırdır",
  PARTIAL: "Qismən hazırdır",
  NEED_HELP: "Kontent dəstəyi lazımdır",
};

const CONTACT_METHOD_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  CALL: "Telefon zəngi",
  EMAIL: "Email",
};

const LANGUAGE_LABELS: Record<string, string> = {
  AZ: "Azərbaycan",
  EN: "İngilis",
  RU: "Rus",
  TR: "Türk",
};

function fmtDateOnly(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("az-AZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("az-AZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function yesNo(v: boolean | null): string {
  if (v === true) return "Bəli";
  if (v === false) return "Xeyr";
  return "—";
}

function asList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((v) => String(v ?? "")).filter(Boolean) : [];
}

function asAddOnLines(raw: unknown): AddOnLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is AddOnLine =>
      Boolean(x) && typeof x === "object" && "addOnId" in (x as object),
  );
}

function asBreakdown(raw: unknown): EstimateBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    baseRange: Array.isArray(o.baseRange)
      ? (o.baseRange.slice(0, 2).map(Number) as [number, number])
      : null,
    complexityFactor:
      typeof o.complexityFactor === "number" ? o.complexityFactor : null,
    reasoning: typeof o.reasoning === "string" ? o.reasoning : null,
    source: typeof o.source === "string" ? o.source : null,
  };
}

function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function WebsiteApplicationsAdminClient() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const dialog = useDialog();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website-service-applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: applications.length };
    for (const a of applications) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }, [applications]);

  const open = openId ? applications.find((a) => a.id === openId) ?? null : null;

  useEffect(() => {
    setAdminNotesDraft(open?.adminNotes ?? "");
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(id: string, status: string) {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/website-service-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data.application } : a)),
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveNotes(id: string) {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/website-service-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesDraft }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data.application } : a)),
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function remove(a: Application) {
    const ok = await dialog.confirm({
      title: "Müraciəti sil?",
      message: (
        <p>
          <span className="font-medium text-zinc-800">«{a.fullName}»</span> tərəfindən
          göndərilən müraciət silinəcək.
        </p>
      ),
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/website-service-applications/${a.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setOpenId(null);
    load();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const filterOptions: { key: string; label: string }[] = [
    { key: "ALL", label: "Hamısı" },
    ...Object.entries(STATUS_LABELS).map(([k, label]) => ({ key: k, label })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((opt) => {
          const active = statusFilter === opt.key;
          const count = counts[opt.key] ?? 0;
          return (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-violet-600 text-white"
                  : "bg-admin-card text-zinc-700 ring-1 ring-admin-line hover:bg-admin-chip2",
              ].join(" ")}
            >
              <span>{opt.label}</span>
              <span className="rounded bg-admin-chip px-1.5 py-0.5 tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-admin-card text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Tarix</th>
              <th className="px-5 py-4 font-medium">Müştəri</th>
              <th className="px-5 py-4 font-medium">Sayt növü</th>
              <th className="px-5 py-4 font-medium">Paket</th>
              <th className="px-5 py-4 font-medium">Büdcə</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium text-right">Bax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                  Bu filtrə uyğun müraciət yoxdur.
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="cursor-pointer transition hover:bg-admin-chip"
                onClick={() => setOpenId(a.id)}
              >
                <td className="px-5 py-4 tabular-nums text-xs text-zinc-600">
                  {fmtDate(a.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="font-medium text-zinc-900">{a.fullName}</div>
                  <div className="text-xs text-zinc-500">{a.phone}</div>
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {WEBSITE_TYPE_LABELS[a.websiteType] ?? a.websiteType}
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {a.package?.name ?? <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {a.budgetRange ?? <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={[
                      "rounded px-2 py-1 text-[10px] font-semibold ring-1",
                      STATUS_TONES[a.status] ?? "bg-admin-chip text-zinc-700 ring-admin-line2",
                    ].join(" ")}
                  >
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(a.id);
                    }}
                    className="rounded bg-admin-chip px-3 py-1.5 text-xs text-zinc-800 hover:bg-admin-chip2"
                  >
                    Detallar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-3xl rounded-2xl border border-admin-line bg-admin-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-admin-line px-6 py-4">
              <div>
                <h3 className="text-lg font-bold">{open.fullName}</h3>
                <p className="text-xs text-zinc-500">
                  Müraciət #{open.id.slice(-8).toUpperCase()} · {fmtDate(open.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="rounded p-2 text-zinc-500 hover:bg-admin-chip hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <Section title="1. Müştəri məlumatları">
                <Field label="Ad soyad" value={open.fullName} />
                <Field label="Telefon" value={open.phone} />
                <Field label="Email" value={open.email ?? "—"} />
                <Field label="Biznes adı" value={open.businessName ?? "—"} />
                <Field
                  label="Üstün tutulan əlaqə"
                  value={
                    open.contactMethod
                      ? CONTACT_METHOD_LABELS[open.contactMethod] ?? open.contactMethod
                      : "—"
                  }
                />
              </Section>

              <Section title="2. Layihə məlumatları">
                <Field
                  label="Sayt növü"
                  value={WEBSITE_TYPE_LABELS[open.websiteType] ?? open.websiteType}
                />
                <Field
                  label="Layihə haqqında"
                  value={open.projectBrief}
                  multiline
                />
                <Field
                  label="Mövcud sayt"
                  value={open.existingWebsiteUrl ?? "—"}
                />
                <Field
                  label="Nümunə sayt linkləri"
                  value={open.referenceWebsiteLinks ?? "—"}
                  multiline
                />
                <Field
                  label="Fayl/qovluq linki"
                  value={open.attachmentsUrl ?? "—"}
                />
                <Field
                  label="İstədiyi sayt bölmələri"
                  value={
                    asList(open.requestedSections).length > 0
                      ? asList(open.requestedSections).join(", ")
                      : "—"
                  }
                />
                <Field
                  label="Sayt dilləri"
                  value={
                    asList(open.languages).length > 0
                      ? asList(open.languages)
                          .map((l) => LANGUAGE_LABELS[l] ?? l)
                          .join(", ")
                      : "—"
                  }
                />
                <Field
                  label="Başlama tarixi"
                  value={fmtDateOnly(open.preferredStartDate)}
                />
                <Field
                  label="Təcililik"
                  value={open.urgency ? URGENCY_LABELS[open.urgency] ?? open.urgency : "—"}
                />
              </Section>

              <Section title="3. Dizayn tələbləri">
                <Field label="Xüsusi dizayn istəyir?" value={yesNo(open.wantsCustomDesign)} />
                <Field label="Dizayn tərzi" value={open.designStyle ?? "—"} />
                <Field
                  label="Kontent vəziyyəti"
                  value={
                    open.contentStatus
                      ? CONTENT_STATUS_LABELS[open.contentStatus] ?? open.contentStatus
                      : "—"
                  }
                />
              </Section>

              <Section title="4. AI ilə hesablanmış qiymət (snapshot)">
                {(() => {
                  const min = numOrNull(open.estimatedPriceMin);
                  const max = numOrNull(open.estimatedPriceMax);
                  const lines = asAddOnLines(open.selectedAddOns);
                  const bd = asBreakdown(open.estimateBreakdown);
                  if (min === null && lines.length === 0 && !bd) {
                    return (
                      <p className="text-xs text-zinc-500">
                        Müştəri qiymət hesablamayıb.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {min !== null && (
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">
                            Təxmini ümumi
                          </div>
                          <div className="mt-0.5 text-lg font-bold text-zinc-900">
                            {min === max
                              ? `${min} AZN`
                              : `${min}–${max ?? min} AZN`}
                          </div>
                        </div>
                      )}
                      {bd && (
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:gap-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-zinc-500">
                            Baza × əmsal
                          </div>
                          <div className="text-zinc-900">
                            {bd.baseRange
                              ? `${bd.baseRange[0]}–${bd.baseRange[1]} AZN`
                              : "—"}{" "}
                            × {bd.complexityFactor?.toFixed(2) ?? "—"}{" "}
                            {bd.source === "fallback" && (
                              <span className="ml-1 text-[10px] text-amber-700">
                                (qaydalar)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {lines.length > 0 && (
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">
                            Əlavə xidmətlər
                          </div>
                          <ul className="mt-1.5 space-y-1 text-sm text-zinc-900">
                            {lines.map((l) => (
                              <li
                                key={l.addOnId}
                                className="flex items-center justify-between gap-3"
                              >
                                <span>
                                  {l.name}
                                  {l.pricingType === "PER_UNIT" &&
                                    l.units > 0 && (
                                      <span className="ml-1 text-xs text-zinc-500">
                                        ({l.units} ×{" "}
                                        {l.unitPrice ?? 0} AZN
                                        {l.freeUnits
                                          ? ` − ${l.freeUnits} pulsuz`
                                          : ""}
                                        )
                                      </span>
                                    )}
                                </span>
                                <span className="font-semibold">
                                  +{l.lineTotal} AZN
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {bd?.reasoning && (
                        <div className="rounded-lg bg-admin-card p-3 text-xs text-zinc-600">
                          <span className="font-semibold text-zinc-700">
                            AI qeydi:
                          </span>{" "}
                          {bd.reasoning}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Section>

              <Section title="5. Büdcə və paket">
                <Field
                  label="İstədiyi paket"
                  value={
                    open.package
                      ? `${open.package.name} (${open.package.priceRange})`
                      : "—"
                  }
                />
                <Field label="Büdcə aralığı" value={open.budgetRange ?? "—"} />
                <Field label="Hazır logo var?" value={yesNo(open.hasLogo)} />
                <Field label="Domen var?" value={yesNo(open.hasDomain)} />
                <Field label="Hosting var?" value={yesNo(open.hasHosting)} />
              </Section>

              <Section title="6. Əlavə qeydlər">
                <label className="block text-xs uppercase tracking-wide text-zinc-500">
                  Admin daxili qeydləri (müştəriyə görünmür)
                </label>
                <textarea
                  rows={4}
                  className="mt-2 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900"
                  value={adminNotesDraft}
                  onChange={(e) => setAdminNotesDraft(e.target.value)}
                  placeholder="Layihə ilə bağlı daxili qeydlər..."
                />
                <button
                  onClick={() => saveNotes(open.id)}
                  disabled={savingStatus || adminNotesDraft === (open.adminNotes ?? "")}
                  className="mt-3 rounded bg-admin-chip px-3 py-1.5 text-xs text-zinc-800 hover:bg-admin-chip2 disabled:opacity-50"
                >
                  Qeydləri yadda saxla
                </button>
              </Section>

              <Section title="7. Status idarəetməsi">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_LABELS).map(([k, label]) => {
                    const active = open.status === k;
                    return (
                      <button
                        key={k}
                        onClick={() => changeStatus(open.id, k)}
                        disabled={savingStatus || active}
                        className={[
                          "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition",
                          active
                            ? STATUS_TONES[k] ?? "bg-violet-600 text-white"
                            : "bg-admin-card text-zinc-700 ring-admin-line hover:bg-admin-chip2",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>

            <div className="flex items-center justify-between border-t border-admin-line px-6 py-4">
              <button
                onClick={() => remove(open)}
                className="inline-flex items-center gap-2 rounded text-xs text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Müraciəti sil
              </button>
              <button
                onClick={() => setOpenId(null)}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-800 hover:bg-admin-chip2"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-admin-line bg-admin-card p-5">
      <h4 className="mb-4 text-sm font-semibold text-zinc-800">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:gap-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={
          multiline
            ? "whitespace-pre-wrap text-sm text-zinc-900"
            : "text-sm text-zinc-900"
        }
      >
        {value}
      </div>
    </div>
  );
}
