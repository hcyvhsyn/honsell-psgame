import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PsnAccountsRedirect() {
  redirect("/profile/profiles");
}
