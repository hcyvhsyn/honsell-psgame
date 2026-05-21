"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  Globe2,
  Languages,
  Layers3,
  Loader2,
  Mail,
  MessageCircle,
  Moon,
  Palette,
  PhoneCall,
  Server,
  Sparkles,
  Sun,
  UploadCloud,
  User,
  WalletCards,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const WEBSITE_TYPES: { value: string; label: string }[] = [
  { value: "BUSINESS", label: "Bizneslər üçün satış saytı" },
  { value: "PORTFOLIO", label: "Portfolio / şəxsi brend saytı" },
  { value: "RESTAURANT", label: "Restaurant / kurs / xidmət saytı" },
  { value: "ECOMMERCE", label: "E-commerce sayt" },
  { value: "LANDING", label: "Landing page" },
  { value: "OTHER", label: "Digər" },
];

const URGENCY: { value: string; label: string }[] = [
  { value: "NORMAL", label: "Normal müddət" },
  { value: "URGENT", label: "Təcili (mümkün qədər tez)" },
  { value: "FLEXIBLE", label: "Çevik — müddət önəmli deyil" },
];

const CONTENT_STATUS: { value: string; label: string }[] = [
  { value: "READY", label: "Mətn və şəkillər hazırdır" },
  { value: "PARTIAL", label: "Qismən hazırdır" },
  { value: "NEED_HELP", label: "Kontent dəstəyi lazımdır" },
];

const CONTACT_METHODS: { value: string; label: string }[] = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "CALL", label: "Telefon zəngi" },
  { value: "EMAIL", label: "Email" },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "AZ", label: "Azərbaycan" },
  { value: "EN", label: "İngilis" },
  { value: "RU", label: "Rus" },
  { value: "TR", label: "Türk" },
];

const BUDGETS = ["150–300 AZN", "300–600 AZN", "600–1000 AZN", "1000+ AZN", "Dəqiqləşməyib"];

const SECTION_SUGGESTIONS = [
  "Əsas / Ana səhifə",
  "Haqqımızda",
  "Xidmətlər",
  "Məhsullar",
  "Qiymətlər",
  "Bloq",
  "Əlaqə",
  "Rəylər",
  "FAQ",
];

const REQUIRED_FIELDS = [
  "Ad soyad",
  "WhatsApp nömrəsi",
  "Sayt növü",
  "Layihə haqqında qısa məlumat",
];

const MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "İyun",
  "İyul",
  "Avqust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

const WEEK_DAYS = ["B", "Be", "Ça", "Ç", "Ca", "C", "Ş"];

const LANGUAGES_ADDON_SLUG = "languages";

type ThemePreference = "" | "LIGHT" | "DARK" | "BOTH" | "NONE";

const THEME_PREFERENCE_LABELS: Record<Exclude<ThemePreference, "">, string> = {
  LIGHT: "Light dizayn istəyir",
  DARK: "Dark dizayn istəyir",
  BOTH: "Light və Dark rejim istəyir",
  NONE: "Light/Dark seçimi istəmir",
};

type AddOn = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  pricingType: "FLAT" | "PER_UNIT";
  flatPrice: string | number | null;
  freeUnits: number | null;
  unitPrice: string | number | null;
  unitLabel: string | null;
};

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  contactMethod: string;
  businessName: string;
  websiteType: string;
  budgetRange: string;
  hasLogo: "" | "yes" | "no";
  hasDomain: "" | "yes" | "no";
  hasHosting: "" | "yes" | "no";
  projectBrief: string;
  existingWebsiteUrl: string;
  referenceWebsiteLinks: string;
  attachmentsUrl: string;
  requestedSections: string[];
  languages: string[];
  selectedAddOnIds: string[];
  preferredStartDate: string;
  urgency: string;
  wantsCustomDesign: "" | "yes" | "no";
  themePreference: ThemePreference;
  designStyle: string;
  contentStatus: string;
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

type Estimate = {
  baseRange: [number, number];
  complexityFactor: number;
  reasoning: string;
  addOnLines: AddOnLine[];
  addOnsTotal: number;
  total: { min: number; max: number };
  source: "ai" | "fallback";
};

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatAddOnPrice(a: AddOn): string {
  if (a.pricingType === "FLAT") {
    const p = toNum(a.flatPrice);
    return p !== null ? `+${p} AZN` : "";
  }
  const u = toNum(a.unitPrice);
  const free = a.freeUnits ?? 0;
  const label = a.unitLabel ?? "vahid";
  if (u === null) return "";
  return free > 0
    ? `${free} ${label} pulsuz, sonra +${u} AZN/${label}`
    : `+${u} AZN/${label}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, monthIndex: month - 1, day };
}

function formatDateLabel(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  return `${parsed.day} ${MONTHS[parsed.monthIndex]} ${parsed.year}`;
}

function getThemePreferenceLabel(value: ThemePreference) {
  return value ? THEME_PREFERENCE_LABELS[value] : "";
}

export default function WebsiteApplicationFormClient() {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    email: "",
    contactMethod: "",
    businessName: "",
    websiteType: "",
    budgetRange: "",
    hasLogo: "",
    hasDomain: "",
    hasHosting: "",
    projectBrief: "",
    existingWebsiteUrl: "",
    referenceWebsiteLinks: "",
    attachmentsUrl: "",
    requestedSections: [],
    languages: [],
    selectedAddOnIds: [],
    preferredStartDate: "",
    urgency: "",
    wantsCustomDesign: "",
    themePreference: "",
    designStyle: "",
    contentStatus: "",
  });
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const [showErrors, setShowErrors] = useState(false);

  const fieldErrors = useMemo(() => {
    return {
      fullName: form.fullName.trim().length < 2,
      phone: form.phone.trim().length < 6,
      websiteType: !form.websiteType,
      projectBrief: form.projectBrief.trim().length < 10,
    };
  }, [form.fullName, form.phone, form.websiteType, form.projectBrief]);

  useEffect(() => {
    let active = true;
    fetch("/api/website-add-ons")
      .then((r) => (r.ok ? r.json() : { addOns: [] }))
      .then((d) => {
        if (active) setAddOns(d.addOns ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const languagesAddOn = useMemo(
    () => addOns.find((a) => a.slug === LANGUAGES_ADDON_SLUG) ?? null,
    [addOns],
  );
  // FLAT add-on-lar müştəri seçə bilər; PER_UNIT add-on (languages) avtomatik
  // dil seçicisindən doldurulur, ona görə siyahıdan kənar tuturuq.
  const selectableAddOns = useMemo(
    () => addOns.filter((a) => a.pricingType === "FLAT"),
    [addOns],
  );

  const grouped = useMemo(() => {
    const out = new Map<string, AddOn[]>();
    for (const a of selectableAddOns) {
      const key = a.category ?? "Digər";
      const list = out.get(key) ?? [];
      list.push(a);
      out.set(key, list);
    }
    return Array.from(out.entries());
  }, [selectableAddOns]);

  const canSubmit = useMemo(() => {
    return (
      form.fullName.trim().length >= 2 &&
      form.phone.trim().length >= 6 &&
      form.websiteType &&
      form.projectBrief.trim().length >= 10
    );
  }, [form]);

  const canEstimate = useMemo(() => {
    return Boolean(form.websiteType) && form.projectBrief.trim().length >= 10;
  }, [form.websiteType, form.projectBrief]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (estimate) setEstimate(null);
  }

  function toggleSection(label: string) {
    setForm((prev) => {
      const has = prev.requestedSections.includes(label);
      return {
        ...prev,
        requestedSections: has
          ? prev.requestedSections.filter((s) => s !== label)
          : [...prev.requestedSections, label],
      };
    });
  }

  function toggleLanguage(code: string) {
    setForm((prev) => {
      const has = prev.languages.includes(code);
      return {
        ...prev,
        languages: has
          ? prev.languages.filter((l) => l !== code)
          : [...prev.languages, code],
      };
    });
    if (estimate) setEstimate(null);
  }

  function toggleAddOn(id: string) {
    setForm((prev) => {
      const has = prev.selectedAddOnIds.includes(id);
      return {
        ...prev,
        selectedAddOnIds: has
          ? prev.selectedAddOnIds.filter((x) => x !== id)
          : [...prev.selectedAddOnIds, id],
      };
    });
    if (estimate) setEstimate(null);
  }

  function buildSelectedAddOnsPayload(): { addOnId: string; units: number }[] {
    const out: { addOnId: string; units: number }[] = form.selectedAddOnIds.map(
      (id) => ({ addOnId: id, units: 1 }),
    );
    if (languagesAddOn && form.languages.length > 0) {
      out.push({ addOnId: languagesAddOn.id, units: form.languages.length });
    }
    return out;
  }

  async function runEstimate() {
    if (!canEstimate || estimating) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch(
        "/api/website-service-applications/estimate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteType: form.websiteType,
            projectBrief: form.projectBrief.trim(),
            contentStatus: form.contentStatus || null,
            urgency: form.urgency || null,
            wantsCustomDesign: form.wantsCustomDesign || null,
            hasLogo: form.hasLogo || null,
            hasDomain: form.hasDomain || null,
            hasHosting: form.hasHosting || null,
            languages: form.languages,
            selectedAddOns: buildSelectedAddOnsPayload(),
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEstimateError(String(data.error ?? "Qiymət hesablanmadı."));
        return;
      }
      const data: Estimate = await res.json();
      setEstimate(data);
    } catch {
      setEstimateError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setEstimating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!canSubmit) {
      setShowErrors(true);
      const firstInvalid = (Object.keys(fieldErrors) as (keyof typeof fieldErrors)[]).find(
        (k) => fieldErrors[k],
      );
      if (firstInvalid) {
        const el = document.querySelector<HTMLElement>(
          `[data-field="${firstInvalid}"]`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus();
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const themePreferenceNote = getThemePreferenceLabel(form.themePreference);
      const designStyle = [
        form.designStyle.trim(),
        themePreferenceNote ? `Rəng rejimi: ${themePreferenceNote}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        contactMethod: form.contactMethod || null,
        businessName: form.businessName.trim(),
        websiteType: form.websiteType,
        budgetRange: form.budgetRange,
        hasLogo: form.hasLogo || null,
        hasDomain: form.hasDomain || null,
        hasHosting: form.hasHosting || null,
        projectBrief: form.projectBrief.trim(),
        existingWebsiteUrl: form.existingWebsiteUrl.trim(),
        referenceWebsiteLinks: form.referenceWebsiteLinks.trim(),
        attachmentsUrl: form.attachmentsUrl.trim(),
        requestedSections: form.requestedSections,
        languages: form.languages,
        selectedAddOns: buildSelectedAddOnsPayload(),
        preferredStartDate: form.preferredStartDate || null,
        urgency: form.urgency || null,
        wantsCustomDesign: form.wantsCustomDesign || null,
        designStyle,
        contentStatus: form.contentStatus || null,
        estimate: estimate ?? null,
      };
      const res = await fetch("/api/website-service-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(String(data.error ?? "Müraciət göndərilmədi. Yenidən cəhd edin."));
        return;
      }
      setSuccess(true);
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-[24px] border border-emerald-200 bg-white/90 p-8 text-center shadow-[0_30px_80px_-58px_rgba(16,185,129,0.5)] dark:border-emerald-500/30 dark:bg-emerald-500/5">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-xl font-bold text-zinc-950 dark:text-white">
          Müraciətiniz qəbul edildi
        </h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Komandamız layihənizi incələyib sizinlə WhatsApp üzərindən əlaqə
          saxlayacaq.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/xidmetler/website"
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Xidmət səhifəsinə qayıt
          </Link>
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:from-violet-500 hover:to-fuchsia-500"
          >
            Ana səhifə
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <RequiredGuide />

      <FormSection
        title="Müştəri məlumatları"
        hint="Sizinlə əlaqə üçün lazımdır."
        icon={User}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Ad soyad"
            name="fullName"
            value={form.fullName}
            onChange={(v) => update("fullName", v)}
            required
            helper="Sizə necə müraciət edək?"
            invalid={showErrors && fieldErrors.fullName}
            icon={User}
          />
          <TextField
            label="Telefon nömrəsi (WhatsApp)"
            name="phone"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="+994 50 123 45 67"
            required
            helper="Əsas geri dönüş bu nömrəyə ediləcək."
            invalid={showErrors && fieldErrors.phone}
            icon={PhoneCall}
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={(v) => update("email", v)}
            placeholder="ad@nümunə.az"
            helper="Email yoxdursa boş saxlaya bilərsiniz."
            icon={Mail}
          />
          <TextField
            label="Biznes / şirkət adı"
            value={form.businessName}
            onChange={(v) => update("businessName", v)}
            helper="Şirkət adı, brend adı və ya şəxsi layihə adı."
            icon={BadgeCheck}
          />
        </div>
        <SelectField
          label="Əlaqə üçün üstün tutduğunuz üsul"
          value={form.contactMethod}
          onChange={(v) => update("contactMethod", v)}
          options={CONTACT_METHODS}
          placeholder="Seçim et"
          helper="Seçməsəniz, WhatsApp üzərindən yazacağıq."
          icon={MessageCircle}
        />
      </FormSection>

      <FormSection
        title="Layihə məlumatları"
        hint="Necə bir sayt hazırlayacağıq?"
        icon={ClipboardList}
      >
        <SelectField
          label="Sayt növü"
          name="websiteType"
          value={form.websiteType}
          onChange={(v) => update("websiteType", v)}
          options={WEBSITE_TYPES}
          placeholder="Seçim et"
          required
          helper="Dəqiq bilmirsinizsə ən yaxın olan seçimi edin."
          invalid={showErrors && fieldErrors.websiteType}
          icon={Layers3}
        />
        <TextAreaField
          label="Layihə haqqında qısa məlumat"
          name="projectBrief"
          value={form.projectBrief}
          onChange={(v) => update("projectBrief", v)}
          rows={5}
          placeholder="Məsələn: restoran üçün menyu, şəkillər və WhatsApp sifariş düyməsi olan sayt istəyirəm..."
          required
          helper="Ən azı 1-2 cümlə yazın: nə satırsınız, kimə satırsınız, saytdan nə gözləyirsiniz."
          invalid={showErrors && fieldErrors.projectBrief}
          icon={FileText}
        />
        <TextField
          label="Mövcud sayt linki (yenidən dizayn halında)"
          value={form.existingWebsiteUrl}
          onChange={(v) => update("existingWebsiteUrl", v)}
          placeholder="https://"
          helper="Hazır saytınız yoxdursa boş saxlayın."
          icon={Globe2}
        />
        <TextAreaField
          label="Bəyəndiyiniz nümunə sayt linkləri"
          value={form.referenceWebsiteLinks}
          onChange={(v) => update("referenceWebsiteLinks", v)}
          rows={3}
          placeholder="Hər sətrə bir link və ya vergüllə ayırın"
          helper="Rəng, quruluş və ya hiss olaraq bəyəndiyiniz nümunələr kifayətdir."
          icon={Sparkles}
        />
        <TextField
          label="Fayl/qovluq linki (logo, brendinq sənədləri)"
          value={form.attachmentsUrl}
          onChange={(v) => update("attachmentsUrl", v)}
          placeholder="Google Drive, Dropbox və s. linki"
          helper="Logo, şəkil və kataloq varsa link olaraq əlavə edin."
          icon={UploadCloud}
        />
        <div>
          <FieldHeading label="Sayt dilləri" icon={Languages} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {languagesAddOn
              ? formatAddOnPrice(languagesAddOn)
              : "Bir və ya bir neçə dil seçin."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = form.languages.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleLanguage(opt.value)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-violet-500 text-white"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-violet-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldHeading label="İstədiyiniz sayt bölmələri" icon={Layers3} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Saytda olmasını istədiyiniz bölmələri seçin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SECTION_SUGGESTIONS.map((label) => {
              const active = form.requestedSections.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleSection(label)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-violet-500 text-white"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-violet-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Layihənin təcililik vəziyyəti"
            value={form.urgency}
            onChange={(v) => update("urgency", v)}
            options={URGENCY}
            placeholder="Seçim et"
            helper="Təcili layihələrdə komanda əvvəlcə müddəti dəqiqləşdirəcək."
            icon={CircleAlert}
          />
          <DateField
            label="İstənilən başlama tarixi"
            value={form.preferredStartDate}
            onChange={(v) => update("preferredStartDate", v)}
            helper="Tarix dəqiq deyilsə boş saxlaya bilərsiniz."
            icon={CalendarDays}
          />
        </div>
      </FormSection>

      {selectableAddOns.length > 0 && (
        <FormSection
          title="Əlavə xidmətlər"
          hint="Saytda olmasını istədiyiniz əlavə funksiyaları seçin — qiymət dərhal görünür."
          icon={Wand2}
        >
          <div className="space-y-5">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                  {cat}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {items.map((a) => {
                    const active = form.selectedAddOnIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAddOn(a.id)}
                        className={[
                          "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                          active
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-zinc-200 bg-white/70 hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700",
                        ].join(" ")}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
                            {a.name}
                          </span>
                          {a.description && (
                            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                              {a.description}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-violet-700 dark:text-violet-300">
                          {formatAddOnPrice(a)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      <FormSection title="Dizayn tələbləri" hint="Saytın görünüşü və üslubu." icon={Palette}>
        <ThemePreferenceField
          value={form.themePreference}
          onChange={(v) => update("themePreference", v)}
        />
        <YesNoField
          label="Xüsusi dizayn istəyirsiniz?"
          value={form.wantsCustomDesign}
          onChange={(v) => update("wantsCustomDesign", v)}
          hint="Xüsusi dizayn sıfırdan brendinizə uyğun görünüş deməkdir. 'Xeyr' seçsəniz, hazır struktur üzərindən daha sürətli variant təklif edə bilərik."
        />
        <TextField
          label="Dizayn tərzi (məs: minimal, korporativ, rəngarəng)"
          value={form.designStyle}
          onChange={(v) => update("designStyle", v)}
          helper="Məsələn: premium, sadə, klinika üslubu, restoran üslubu, tünd rənglər."
          icon={Palette}
        />
        <SelectField
          label="Kontent vəziyyəti (mətn və şəkillər)"
          value={form.contentStatus}
          onChange={(v) => update("contentStatus", v)}
          options={CONTENT_STATUS}
          placeholder="Seçim et"
          helper="Kontent hazır deyilsə, mətn və vizual struktur üçün ayrıca dəstək planlayaq."
          icon={FileText}
        />
      </FormSection>

      <FormSection
        title="Büdcə və hazırlıq"
        hint="Sizə uyğun təklif hazırlamağa kömək edir."
        icon={WalletCards}
      >
        <SelectField
          label="Büdcə aralığı"
          value={form.budgetRange}
          onChange={(v) => update("budgetRange", v)}
          options={BUDGETS.map((b) => ({ value: b, label: b }))}
          placeholder="Seçim et"
          helper="Dəqiq büdcə yoxdursa 'Dəqiqləşməyib' seçin."
          icon={WalletCards}
        />
        <DomainHostingExplainer />
        <div className="grid gap-4 sm:grid-cols-3">
          <YesNoField
            label="Hazır logo var?"
            value={form.hasLogo}
            onChange={(v) => update("hasLogo", v)}
            hint="Logo faylınız yoxdursa problem deyil, sadəcə bizə bildirin."
          />
          <YesNoField
            label="Domen var?"
            value={form.hasDomain}
            onChange={(v) => update("hasDomain", v)}
            hint="Domen sayt ünvanıdır. Məsələn: honsell.az."
          />
          <YesNoField
            label="Hosting var?"
            value={form.hasHosting}
            onChange={(v) => update("hasHosting", v)}
            hint="Hosting saytın internetdə işləməsi üçün server yeridir."
          />
        </div>
      </FormSection>

      <EstimateCard
        canEstimate={canEstimate}
        estimating={estimating}
        estimate={estimate}
        error={estimateError}
        onRun={runEstimate}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {showErrors && !canSubmit && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Qırmızı çərçivə ilə işarələnmiş məcburi sahələri doldurun.</span>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Forma göndərildikdən sonra komandamız WhatsApp üzərindən əlaqə
          saxlayacaq.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(124,58,237,0.7)] transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Göndərilir...
            </>
          ) : (
            "Müraciəti göndər"
          )}
        </button>
      </div>
    </form>
  );
}

function RequiredGuide() {
  return (
    <section className="rounded-[22px] border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-300/15 dark:bg-sky-400/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-black uppercase tracking-[0.16em] text-sky-800 dark:text-sky-200">
          Doldurulması vacibdir
        </span>
        {REQUIRED_FIELDS.map((field) => (
          <span
            key={field}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-sky-900 ring-1 ring-sky-200 dark:bg-white/10 dark:text-sky-100 dark:ring-white/10"
          >
            <Check className="h-3 w-3" />
            {field}
          </span>
        ))}
      </div>
    </section>
  );
}

function ThemePreferenceField({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  const options: {
    value: ThemePreference;
    label: string;
    text: string;
    icon: LucideIcon;
    tone: "amber" | "violet" | "sky" | "emerald";
  }[] = [
    {
      value: "LIGHT",
      label: "Light istəyirəm",
      text: "Açıq fonlu sayt. Katalog, korporativ və çox mətnli səhifələr üçün rahatdır.",
      icon: Sun,
      tone: "amber",
    },
    {
      value: "DARK",
      label: "Dark istəyirəm",
      text: "Tünd fonlu sayt. Premium, texnologiya və vizual təsir istəyən brendlərə yaraşır.",
      icon: Moon,
      tone: "violet",
    },
    {
      value: "BOTH",
      label: "Hər ikisi olsun",
      text: "Saytda Light/Dark dəyişmə düyməsi olsun, istifadəçi özü seçsin.",
      icon: Sparkles,
      tone: "sky",
    },
    {
      value: "NONE",
      label: "Lazım deyil",
      text: "Bir əsas görünüş kifayətdir. Layihəyə uyğun rejimi biz seçək.",
      icon: Palette,
      tone: "emerald",
    },
  ];

  return (
    <div>
      <FieldHeading label="Light / Dark rejimi" icon={Sun} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const active = value === option.value;
          const Icon = option.icon;
          const toneClass = {
            amber:
              "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/10 dark:text-amber-200",
            emerald:
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200",
            sky:
              "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/15 dark:bg-sky-400/10 dark:text-sky-200",
            violet:
              "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/15 dark:bg-violet-400/10 dark:text-violet-200",
          }[option.tone];

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(active ? "" : option.value)}
              aria-pressed={active}
              className={[
                "group relative rounded-2xl border p-4 text-left transition",
                toneClass,
                active
                  ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-white dark:ring-violet-300 dark:ring-offset-zinc-950"
                  : "hover:-translate-y-0.5 hover:shadow-lg",
              ].join(" ")}
            >
              <span className="flex items-start gap-3 pr-7">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-300">
                    {option.text}
                  </span>
                </span>
              </span>
              {active && (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white dark:bg-violet-300 dark:text-violet-950">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DomainHostingExplainer() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoTile
        icon={Globe2}
        title="Domen"
        text="Sayt ünvanıdır: sizinbrend.az kimi. Yoxdursa, uyğun ad seçməyə kömək edirik."
        tone="sky"
      />
      <InfoTile
        icon={Server}
        title="Hosting"
        text="Saytın işlədiyi server yeridir. Hazır deyilsə, layihəyə uyğun variant təklif edirik."
        tone="emerald"
      />
    </div>
  );
}

function InfoTile({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  tone: "amber" | "emerald" | "sky" | "violet";
}) {
  const toneClass = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/10 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200",
    sky:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/15 dark:bg-sky-400/10 dark:text-sky-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/15 dark:bg-violet-400/10 dark:text-violet-200",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <p className="text-sm font-black">{title}</p>
      </div>
      <p className="mt-1.5 text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-300">
        {text}
      </p>
    </div>
  );
}

function EstimateCard({
  canEstimate,
  estimating,
  estimate,
  error,
  onRun,
}: {
  canEstimate: boolean;
  estimating: boolean;
  estimate: Estimate | null;
  error: string | null;
  onRun: () => void;
}) {
  return (
    <section className="rounded-[22px] border border-violet-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(245,243,255,0.9))] p-6 shadow-[0_24px_70px_-58px_rgba(124,58,237,0.55)] dark:border-violet-500/30 dark:bg-[linear-gradient(135deg,rgba(76,29,149,0.28),rgba(112,26,117,0.18))]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950 dark:text-white">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            Təxmini qiyməti hesabla
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            Yazdığınız layihə məlumatına və seçimlərinizə əsasən təxmini aralıq hesablanır.
            Final qiymət danışıqdan sonra təsdiqlənir.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!canEstimate || estimating}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estimating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Hesablayır...
            </>
          ) : (
            "Təxmini qiyməti göstər"
          )}
        </button>
      </div>

      {!canEstimate && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          Hesablama üçün sayt növünü seçin və layihə məlumatını doldurun (ən azı
          bir neçə cümlə).
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {estimate && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-white/80 p-5 ring-1 ring-violet-200 dark:bg-zinc-950/60 dark:ring-violet-500/20">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Təxmini ümumi qiymət
            </p>
            <p className="mt-1 text-3xl font-black text-zinc-950 dark:text-white">
              {estimate.total.min === estimate.total.max
                ? `${estimate.total.min} AZN`
                : `${estimate.total.min}–${estimate.total.max} AZN`}
            </p>
            {estimate.source === "fallback" && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                * Avtomatik hesablama əlçatan olmadığı üçün qiymət qaydalarla aparıldı.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white/70 p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Detallar
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center justify-between gap-3">
                <span>
                  Baza ({estimate.baseRange[0]}–{estimate.baseRange[1]} AZN) ×
                  əmsal {estimate.complexityFactor.toFixed(2)}
                </span>
                <span className="font-semibold text-zinc-950 dark:text-white">
                  {Math.round(estimate.baseRange[0] * estimate.complexityFactor)}–
                  {Math.round(estimate.baseRange[1] * estimate.complexityFactor)} AZN
                </span>
              </li>
              {estimate.addOnLines.map((line) => (
                <li
                  key={line.addOnId}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {line.name}
                    {line.pricingType === "PER_UNIT" && line.units > 0 && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        ({line.units} × {line.unitPrice} AZN
                        {line.freeUnits ? ` − ${line.freeUnits} pulsuz` : ""})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-zinc-950 dark:text-white">
                    +{line.lineTotal} AZN
                  </span>
                </li>
              ))}
              {estimate.addOnLines.length === 0 && (
                <li className="text-xs text-zinc-500 dark:text-zinc-500">
                  Əlavə xidmət seçilməyib.
                </li>
              )}
            </ul>
          </div>

          {estimate.reasoning && (
            <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <p className="font-semibold text-zinc-800 dark:text-zinc-300">Qiymət qeydi</p>
              <p className="mt-1">{estimate.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FormSection({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-200 pt-7 dark:border-zinc-800">
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-400/10 dark:text-violet-200 dark:ring-violet-300/20">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-black text-zinc-950 dark:text-white">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldHeading({
  label,
  required,
  icon: Icon,
}: {
  label: string;
  required?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
      {Icon && <Icon className="h-4 w-4 text-violet-600 dark:text-violet-300" />}
      <span>{label}</span>
      {required && <RequiredPill />}
    </span>
  );
}

function RequiredPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-rose-700 ring-1 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20">
      Vacib
    </span>
  );
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="sr-only">{children}</p>;
}

function FieldError() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
      <CircleAlert className="h-3.5 w-3.5" />
      Bu məcburi sahəni doldurun.
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  name,
  helper,
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  name?: string;
  helper?: string;
  required?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <label className="block">
      <FieldHeading label={label} required={required} icon={icon} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-field={name}
        aria-invalid={invalid || undefined}
        required={required}
        className={[
          "mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-600",
          invalid ? "border-rose-500" : "border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      />
      {helper && <FieldHelp>{helper}</FieldHelp>}
      {invalid && <FieldError />}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  invalid,
  name,
  helper,
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  invalid?: boolean;
  name?: string;
  helper?: string;
  required?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <label className="block">
      <FieldHeading label={label} required={required} icon={icon} />
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-field={name}
        aria-invalid={invalid || undefined}
        required={required}
        className={[
          "mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-600",
          invalid ? "border-rose-500" : "border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      />
      {helper && <FieldHelp>{helper}</FieldHelp>}
      {invalid && <FieldError />}
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  helper,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseIsoDate(value);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(parsed?.year ?? now.getFullYear(), parsed?.monthIndex ?? now.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    const first = new Date(year, month, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [cursor]);

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function pick(day: number) {
    onChange(toIsoDate(cursor.getFullYear(), cursor.getMonth(), day));
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <FieldHeading label={label} icon={icon} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-zinc-950 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      >
        <span className={value ? "" : "text-zinc-400 dark:text-zinc-600"}>
          {value ? formatDateLabel(value) : "Tarix seç"}
        </span>
        <CalendarDays className="h-4 w-4 text-violet-500" />
      </button>
      {helper && <FieldHelp>{helper}</FieldHelp>}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(100%,330px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
              aria-label="Əvvəlki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-black text-zinc-950 dark:text-white">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
              aria-label="Növbəti ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
            {WEEK_DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const iso = toIsoDate(cursor.getFullYear(), cursor.getMonth(), day);
              const active = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(day)}
                  className={[
                    "grid h-9 place-items-center rounded-lg text-sm font-bold transition",
                    active
                      ? "bg-violet-600 text-white"
                      : "text-zinc-700 hover:bg-violet-50 dark:text-zinc-200 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  name,
  helper,
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  name?: string;
  helper?: string;
  required?: boolean;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <FieldHeading label={label} required={required} icon={icon} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-field={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-sm font-semibold text-zinc-950 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:bg-zinc-950 dark:text-white",
          invalid ? "border-rose-500" : "border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      >
        <span className={selected ? "" : "text-zinc-400 dark:text-zinc-600"}>
          {selected?.label ?? placeholder ?? "Seçim et"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-violet-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {helper && <FieldHelp>{helper}</FieldHelp>}
      {invalid && <FieldError />}

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-950"
        >
          <button
            type="button"
            onClick={() => pick("")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-400 transition hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-white/10"
          >
            {placeholder ?? "Seçim et"}
            {!value && <Check className="h-4 w-4 text-violet-500" />}
          </button>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(opt.value)}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                  active
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10",
                ].join(" ")}
              >
                {opt.label}
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (v: "" | "yes" | "no") => void;
  hint?: string;
}) {
  return (
    <div>
      <FieldHeading label={label} />
      {hint && <FieldHelp>{hint}</FieldHelp>}
      <div className="mt-2 grid grid-cols-3 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => onChange(value === "yes" ? "" : "yes")}
          className={[
            "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
            value === "yes"
              ? "bg-violet-500 text-white"
              : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
          ].join(" ")}
        >
          Bəli
        </button>
        <button
          type="button"
          onClick={() => onChange(value === "no" ? "" : "no")}
          className={[
            "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
            value === "no"
              ? "bg-violet-500 text-white"
              : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
          ].join(" ")}
        >
          Xeyr
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          className={[
            "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
            value === ""
              ? "bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-white"
              : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
          ].join(" ")}
        >
          Bilmirəm
        </button>
      </div>
    </div>
  );
}
