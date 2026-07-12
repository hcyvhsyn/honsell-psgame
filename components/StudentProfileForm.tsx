"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Building2,
  Layers,
  IdCard,
  UploadCloud,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import Select from "./Select";
import { uploadStudentCard } from "@/lib/uploadImageClient";
import {
  STUDENT_COURSE_OPTIONS,
  STUDENT_CARD_ACCEPT,
  STUDENT_STATUS_DISPLAY,
  type StudentVerificationStatus,
} from "@/lib/studentShared";

export type StudentInitial = {
  isStudent: boolean;
  universityId: string | null;
  course: string | null;
  hasCard: boolean;
  verificationStatus: StudentVerificationStatus;
  rejectionReason: string | null;
};

type University = { id: string; name: string; shortName: string | null };

const COURSE_OPTIONS = STUDENT_COURSE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

export default function StudentProfileForm({
  initial,
  universities,
  cardViewUrl,
}: {
  initial: StudentInitial;
  universities: University[];
  /** Mövcud kart üçün signed baxış URL-i (varsa). */
  cardViewUrl: string | null;
}) {
  const router = useRouter();

  const [isStudent, setIsStudent] = useState(initial.isStudent);
  const [universityId, setUniversityId] = useState(initial.universityId ?? "");
  const [course, setCourse] = useState(initial.course ?? "");

  // Kart vəziyyəti.
  const [preview, setPreview] = useState<string | null>(
    initial.hasCard ? cardViewUrl : null,
  );
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [cardRemoved, setCardRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const uniOptions = universities.map((u) => ({
    value: u.id,
    label: u.shortName ? `${u.name} (${u.shortName})` : u.name,
  }));

  const cardDirty = uploadedKey !== null || cardRemoved;

  const dirty =
    isStudent !== initial.isStudent ||
    universityId !== (initial.universityId ?? "") ||
    course !== (initial.course ?? "") ||
    cardDirty;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // eyni faylı təkrar seçməyə imkan ver
    if (!file) return;

    setCardError(null);
    if (!STUDENT_CARD_ACCEPT.split(",").includes(file.type)) {
      setCardError("Yalnız JPG, PNG və ya WEBP formatı qəbul olunur.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCardError("Fayl ölçüsü 10MB-dan böyük olmamalıdır.");
      return;
    }

    setUploading(true);
    const res = await uploadStudentCard(file);
    setUploading(false);
    if (!res.ok) {
      setCardError(res.error || "Yükləmə alınmadı.");
      return;
    }
    setUploadedKey(res.key);
    setCardRemoved(false);
    setPreview(URL.createObjectURL(file));
  }

  function removeCard() {
    setUploadedKey(null);
    setPreview(null);
    setCardRemoved(true);
    setCardError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || busy || uploading) return;
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      isStudent,
      universityId: universityId || null,
      course: course || null,
    };
    if (uploadedKey) payload.studentCardKey = uploadedKey;
    else if (cardRemoved) payload.studentCardKey = null;

    const res = await fetch("/api/profile/student", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Yadda saxlamaq alınmadı.");
      return;
    }

    // Yeni açar artıq saxlanıldı — dirty flag-ləri sıfırla.
    setUploadedKey(null);
    setCardRemoved(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2200);
    router.refresh(); // profil tamamlama warning-i yenilənsin
  }

  const showStatus =
    initial.isStudent && initial.verificationStatus !== "NOT_SUBMITTED";

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-zinc-200 bg-white/92 p-6 shadow-[0_28px_72px_-56px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/12 text-indigo-700 ring-1 ring-indigo-300/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/40">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Tələbə məlumatları</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Tələbəsənsə, təsdiq üçün məlumatlarını əlavə et.
          </p>
        </div>
      </div>

      {/* Status lövhəsi */}
      {showStatus && <StatusBanner status={initial.verificationStatus} reason={initial.rejectionReason} />}

      {/* Toggle: Tələbəsən? */}
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <GraduationCap className="h-4 w-4 text-indigo-500" />
          Tələbəsən?
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isStudent}
          onClick={() => setIsStudent((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isStudent ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isStudent ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>

      {/* Açılan sahələr — smooth grid-rows animasiyası */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isStudent ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 pt-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                  <Building2 className="h-3.5 w-3.5" /> Universitet
                </label>
                <Select
                  value={universityId}
                  onChange={setUniversityId}
                  options={uniOptions}
                  placeholder="Universitet seç"
                  ariaLabel="Universitet"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                  <Layers className="h-3.5 w-3.5" /> Neçənci kursda oxuyursan?
                </label>
                <Select
                  value={course}
                  onChange={setCourse}
                  options={COURSE_OPTIONS}
                  placeholder="Kurs seç"
                  ariaLabel="Kurs"
                />
              </div>
            </div>

            {/* Tələbə kartı */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                <IdCard className="h-3.5 w-3.5" /> Tələbə kartı
              </label>
              <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-500">
                Tələbə statusunun təsdiqlənməsi üçün tələbə kartının ön tərəfinin
                aydın şəklini yüklə. (JPG, PNG, WEBP — maks. 10MB)
              </p>

              <input
                ref={fileRef}
                type="file"
                accept={STUDENT_CARD_ACCEPT}
                onChange={onPickFile}
                className="hidden"
              />

              {preview ? (
                <div className="flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Tələbə kartı"
                    className="h-24 w-40 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" />
                      )}
                      Şəkli dəyiş
                    </button>
                    <button
                      type="button"
                      onClick={removeCard}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Sil
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-6 text-sm text-zinc-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" /> Şəkil yüklə
                    </>
                  )}
                </button>
              )}

              {cardError && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{cardError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="text-xs">
          {error ? (
            <span className="rounded-md bg-red-50 px-2.5 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Yadda saxlandı
            </span>
          ) : dirty ? (
            <span className="text-zinc-500 dark:text-zinc-500">Dəyişikliklər yadda saxlanılmayıb</span>
          ) : (
            <span className="text-zinc-600 dark:text-zinc-600">Hər şey aktualdır</span>
          )}
        </div>

        <button
          type="submit"
          disabled={!dirty || busy || uploading}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {busy ? "Saxlanılır…" : "Yadda saxla"}
        </button>
      </div>
    </form>
  );
}

function StatusBanner({
  status,
  reason,
}: {
  status: StudentVerificationStatus;
  reason: string | null;
}) {
  const info = STUDENT_STATUS_DISPLAY[status];
  const tone = info.tone;

  const styles =
    tone === "success"
      ? "border-emerald-300/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
      : tone === "error"
        ? "border-rose-300/80 bg-rose-50/95 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
        : "border-amber-300/80 bg-amber-50/95 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100";

  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : Clock;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-semibold">{info.label}</p>
        <p className="text-[13px] opacity-90">{info.description}</p>
        {status === "REJECTED" && reason && (
          <p className="text-[13px] opacity-90">Səbəb: {reason}</p>
        )}
      </div>
    </div>
  );
}
