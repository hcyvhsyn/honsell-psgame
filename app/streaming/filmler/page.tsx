import { redirect } from "next/navigation";

// Filmlər və seriallar tək birləşik kataloqda toplanıb (/streaming/katalog).
// Köhnə link film filtri ilə açılır.
export default function FilmsPage() {
  redirect("/streaming/katalog?kind=MOVIE");
}
