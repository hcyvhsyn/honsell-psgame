"use client";

import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Cake,
  Hash,
  CheckCircle2,
  Save,
  Lock,
} from "lucide-react";
import Select from "./Select";

type Initial = {
  email: string;
  name: string;
  phone: string;
  /** ISO yyyy-mm-dd, or "" if unset. */
  birthDate: string;
  /** "MALE" | "FEMALE" | "OTHER" | "". */
  gender: string;
  referralCode: string;
};

const GENDER_OPTIONS = [
  { value: "MALE", label: "Kişi" },
  { value: "FEMALE", label: "Qadın" },
];

export default function ProfileSettingsForm({ initial }: { initial: Initial }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [gender, setGender] = useState(initial.gender);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    name !== initial.name ||
    phone !== initial.phone ||
    birthDate !== initial.birthDate ||
    gender !== initial.gender;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        birthDate: birthDate || null,
        gender: gender || null,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Yadda saxlamaq alınmadı.");
      return;
    }

    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2200);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
    >
      {/* Section: identity */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Şəxsi məlumatlar
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Ad Soyad"
            icon={<User className="h-4 w-4" />}
            value={name}
            onChange={setName}
            placeholder="Ad Soyad"
            autoComplete="name"
          />
          <Field
            label="Telefon nömrəsi"
            icon={<Phone className="h-4 w-4" />}
            value={phone}
            onChange={setPhone}
            placeholder="+994 50 …"
            autoComplete="tel"
            type="tel"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
              <Cake className="h-3.5 w-3.5" /> Doğum tarixi
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
              <User className="h-3.5 w-3.5" /> Cinsiyət
            </label>
            <Select
              value={gender}
              onChange={setGender}
              options={GENDER_OPTIONS}
              placeholder="Cinsiyət seç"
              ariaLabel="Cinsiyət"
            />
          </div>
        </div>
      </div>

      {/* Section: read-only */}
      <div className="space-y-4 border-t border-zinc-800 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Sistem məlumatları
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnly
            label="E-poçt"
            icon={<Mail className="h-4 w-4" />}
            value={initial.email}
            note="Dəyişdirmək üçün dəstəyə müraciət et"
          />
          <ReadOnly
            label="Referal kodu"
            icon={<Hash className="h-4 w-4" />}
            value={initial.referralCode}
            mono
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <div className="text-xs">
          {error ? (
            <span className="rounded-md bg-red-500/10 px-2.5 py-1 text-red-300">
              {error}
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Yadda saxlandı
            </span>
          ) : dirty ? (
            <span className="text-zinc-500">Dəyişikliklər yadda saxlanılmayıb</span>
          ) : (
            <span className="text-zinc-600">Hər şey aktualdır</span>
          )}
        </div>

        <button
          type="submit"
          disabled={!dirty || busy}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {busy ? "Saxlanılır…" : "Yadda saxla"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}

function ReadOnly({
  label,
  icon,
  value,
  mono,
  note,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  mono?: boolean;
  note?: string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
        {icon} {label}
      </label>
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
        <span className={mono ? "font-mono tracking-widest" : ""}>{value}</span>
        <Lock className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      {note && <p className="mt-1 text-[11px] text-zinc-500">{note}</p>}
    </div>
  );
}
