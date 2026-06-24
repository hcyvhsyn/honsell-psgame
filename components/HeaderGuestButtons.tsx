import { LogIn } from "lucide-react";
import Link from "next/link";

export default function HeaderGuestButtons() {
  return (
    <>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:text-white"
      >
        <LogIn className="h-4 w-4" />
        Daxil ol
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
      >
        Qeydiyyat
      </Link>
    </>
  );
}
