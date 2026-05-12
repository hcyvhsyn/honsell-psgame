import { redirect } from "next/navigation";

export default function SuccessAliasPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value != null) {
      query.set(key, value);
    }
  }
  redirect(`/succeess${query.size ? `?${query.toString()}` : ""}`);
}
