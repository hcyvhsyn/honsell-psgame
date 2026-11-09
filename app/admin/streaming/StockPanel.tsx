"use client";

import { useMemo, useState } from "react";
import { ClipboardPaste, Loader2, Plus, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { btn, inputCls, postStreaming } from "./adminUi";
import type { AdminStock } from "./streamingAdminModel";

type StockForm = { mail: string; password: string; cabinetName: string; pinCode: string; note: string };
const EMPTY: StockForm = { mail: "", password: "", cabinetName: "", pinCode: "", note: "" };

/** "mail;şifrə;kabinet;pin;qeyd" — `;`, TAB və ya `|` ayırıcı. Boş sətirlər atılır. */
function parseBulk(text: string): StockForm[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [mail = "", password = "", cabinetName = "", pinCode = "", ...rest] = line
        .split(/\t|;|\|/)
        .map((x) => x.trim());
      return { mail, password, cabinetName, pinCode, note: rest.join(" ").trim() };
    });
}

/**
 * Paylaşımlı planın hesab stoku. Stok plana görədir (müddətə görə deyil) — 1 ay da, 12 ay da
 * eyni hovuzdan verilir. Sifariş təsdiqində uyğun hesabı götür və burada «İstifadədə» işarələ.
 */
export default function StockPanel({
  platformCode,
  entries,
  onChanged,
}: {
  platformCode: string;
  entries: AdminStock[];
  onChanged: () => Promise<void>;
}) {
  const dialog = useDialog();
  const [form, setForm] = useState<StockForm>(EMPTY);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUsed, setShowUsed] = useState(false);

  const free = entries.filter((e) => !e.isUsed).length;
  const used = entries.length - free;
  const visible = showUsed ? entries : entries.filter((e) => !e.isUsed);
  const bulkRows = useMemo(() => parseBulk(bulkText), [bulkText]);
  const bulkBad = bulkRows.filter((r) => !r.mail || !r.password).length;

  async function addOne() {
    if (!form.mail.trim() || !form.password.trim()) {
      setError("Mail və şifrə tələb olunur.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await postStreaming({ action: "ADD_STOCK", platformCode, ...form });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setForm(EMPTY);
    await onChanged();
  }

  async function addBulk() {
    if (bulkRows.length === 0 || bulkBad > 0) return;
    setBusy(true);
    setError(null);
    const res = await postStreaming({ action: "ADD_STOCK_BULK", platformCode, rows: bulkRows });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBulkText("");
    setBulkOpen(false);
    await onChanged();
  }

  async function toggleUsed(e: AdminStock) {
    setRowBusy(e.id);
    const res = await postStreaming({ action: "TOGGLE_STOCK_USED", id: e.id, isUsed: !e.isUsed });
    setRowBusy(null);
    if (!res.ok) return void dialog.alert({ title: "Dəyişmədi", message: res.error, tone: "danger" });
    await onChanged();
  }

  async function remove(e: AdminStock) {
    const ok = await dialog.confirm({
      title: "Stoku sil?",
      message: <p>«{e.mail}»{e.cabinetName ? ` (${e.cabinetName})` : ""} silinsin?</p>,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setRowBusy(e.id);
    const res = await postStreaming({ action: "DELETE_STOCK", id: e.id });
    setRowBusy(null);
    if (!res.ok) return void dialog.alert({ title: "Silinmədi", message: res.error, tone: "danger" });
    await onChanged();
  }

  const field = (key: keyof StockForm, placeholder: string) => (
    <input
      value={form[key]}
      placeholder={placeholder}
      onChange={(e) => {
        setError(null);
        setForm((f) => ({ ...f, [key]: e.target.value }));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") addOne();
      }}
      className={`${inputCls} py-1.5`}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-700">{free} boşda</span>
        <span className="rounded bg-admin-chip2 px-2 py-0.5 text-zinc-600">{used} istifadədə</span>
        {free === 0 && <span className="text-amber-700">Boş hesab yoxdur — yeni sifarişə verməyə hesab qalmayıb.</span>}
      </div>

      {bulkOpen ? (
        <div className="space-y-2 rounded-lg border border-admin-line p-3">
          <p className="text-xs text-zinc-600">
            Hər sətir bir hesab: <span className="font-mono">mail;şifrə;kabinet;pin;qeyd</span> (TAB və ya | da olar). Kabinet,
            pin və qeyd ixtiyaridir.
          </p>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"hesab1@mail.com;Sifre123;Otaq 1;1234\nhesab1@mail.com;Sifre123;Otaq 2;5678"}
            className={`${inputCls} font-mono text-xs`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addBulk} disabled={busy || bulkRows.length === 0 || bulkBad > 0} className={btn.primary}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {bulkRows.length} hesab əlavə et
            </button>
            <button type="button" onClick={() => setBulkOpen(false)} className={btn.ghost}>
              Bağla
            </button>
            {bulkBad > 0 && <span className="text-xs text-rose-600">{bulkBad} sətirdə mail və ya şifrə yoxdur.</span>}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_1fr_auto]">
          {field("mail", "Mail")}
          {field("password", "Şifrə")}
          {field("cabinetName", "Kabinet adı")}
          {field("pinCode", "PIN")}
          {field("note", "Qeyd")}
          <div className="flex gap-1">
            <button type="button" onClick={addOne} disabled={busy} className={btn.primary} title="Əlavə et">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setBulkOpen(true)} className={btn.secondary} title="Toplu yapışdır">
              <ClipboardPaste className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {entries.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-admin-line">
          <div className="flex items-center justify-between border-b border-admin-line bg-admin-chip/50 px-3 py-1.5 text-[11px] text-zinc-500">
            <span>{showUsed ? "Bütün hesablar" : "Boşda olan hesablar"}</span>
            {used > 0 && (
              <button type="button" onClick={() => setShowUsed((v) => !v)} className="font-semibold text-violet-700 hover:underline">
                {showUsed ? "Yalnız boşda olanlar" : `İstifadədə olanları da göstər (${used})`}
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-zinc-500">Boş hesab yoxdur.</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {visible.map((e) => (
                <li key={e.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs ${e.isUsed ? "opacity-60" : ""}`}>
                  <span className="min-w-[160px] select-all font-mono text-zinc-900">{e.mail}</span>
                  <span className="min-w-[90px] select-all font-mono text-zinc-900">{e.password}</span>
                  {e.cabinetName && <span className="text-zinc-700">{e.cabinetName}</span>}
                  {e.pinCode && <span className="font-mono text-zinc-700">PIN {e.pinCode}</span>}
                  {e.note && <span className="text-zinc-500">{e.note}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleUsed(e)}
                      disabled={rowBusy === e.id}
                      title="Status dəyiş"
                      className={`rounded px-2 py-0.5 font-medium transition disabled:opacity-50 ${
                        e.isUsed
                          ? "bg-admin-chip2 text-zinc-600 hover:bg-admin-line2"
                          : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                      }`}
                    >
                      {rowBusy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : e.isUsed ? "İstifadədə" : "Boşda"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      disabled={rowBusy === e.id}
                      className="rounded p-1 text-zinc-500 hover:text-rose-600 disabled:opacity-50"
                      aria-label="Stoku sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
