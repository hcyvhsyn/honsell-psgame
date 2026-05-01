"use client";

import { useEffect, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import Modal from "./Modal";
import { useModals } from "@/lib/modals";
import LoginForm from "./auth/LoginForm";
import RegisterForm from "./auth/RegisterForm";
import ForgotPasswordForm from "./auth/ForgotPasswordForm";
import CartView, { type PsnOption } from "./CartView";

export default function AppModals() {
  const { active, open, close } = useModals();

  const handleAuthSuccess = () => {
    close();
    // Reload so server components (SiteHeader, etc.) re-render with the
    // newly authenticated session cookie.
    window.location.reload();
  };

  return (
    <>
      <Modal open={active === "login"} onClose={close} size="md">
        <LoginForm
          onSuccess={handleAuthSuccess}
          onSwitchToRegister={() => open("register")}
          onForgotPassword={() => open("forgot")}
        />
      </Modal>

      <Modal open={active === "register"} onClose={close} size="md">
        <RegisterForm
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={() => open("login")}
        />
      </Modal>

      <Modal open={active === "forgot"} onClose={close} size="md">
        <ForgotPasswordForm
          onSuccess={() => open("login")}
          onSwitchToLogin={() => open("login")}
        />
      </Modal>

      <Modal open={active === "cart"} onClose={close} size="xl">
        <CartModalBody
          onClose={close}
          onRequestLogin={() => open("login")}
        />
      </Modal>
    </>
  );
}

function CartModalBody({
  onClose,
  onRequestLogin,
}: {
  onClose: () => void;
  onRequestLogin: () => void;
}) {
  const [data, setData] = useState<{
    isAuthed: boolean;
    walletBalanceAzn: number;
    cashbackBalanceAzn: number;
    referralBalanceAzn: number;
    psnAccounts: PsnOption[];
    loyaltyCashbackPct: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (d: {
          user: {
            walletBalance: number;
            referralBalanceCents?: number;
            cashbackBalanceCents?: number;
          } | null;
          psnAccounts: PsnOption[];
          loyalty?: { cashbackPct: number; label: string } | null;
        }) => {
          if (cancelled) return;
          const refCent = d.user?.referralBalanceCents ?? 0;
          const cbCent = d.user?.cashbackBalanceCents ?? 0;
          setData({
            isAuthed: !!d.user,
            walletBalanceAzn: d.user ? d.user.walletBalance / 100 : 0,
            cashbackBalanceAzn: cbCent / 100,
            referralBalanceAzn: refCent / 100,
            psnAccounts: d.psnAccounts ?? [],
            loyaltyCashbackPct: d.loyalty?.cashbackPct ?? 0,
          });
        }
      )
      .catch(() => {
        if (cancelled) return;
        setData({
          isAuthed: false,
          walletBalanceAzn: 0,
          cashbackBalanceAzn: 0,
          referralBalanceAzn: 0,
          psnAccounts: [],
          loyaltyCashbackPct: 0,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 sm:p-7">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <ShoppingCart className="h-5 w-5 text-indigo-400" /> Səbətin
      </h2>

      {!data ? (
        <div className="grid place-items-center py-16 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <CartView
          isAuthed={data.isAuthed}
          walletBalanceAzn={data.walletBalanceAzn}
          cashbackBalanceAzn={data.cashbackBalanceAzn}
          referralBalanceAzn={data.referralBalanceAzn}
          psnAccounts={data.psnAccounts}
          loyaltyCashbackPct={data.loyaltyCashbackPct}
          onRequestLogin={onRequestLogin}
          onNavigate={onClose}
        />
      )}
    </div>
  );
}
