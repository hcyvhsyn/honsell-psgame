import { redirect } from "next/navigation";

// Filmlər və seriallar tək birləşik kataloqda toplanıb (/streaming/katalog).
// Köhnə link serial filtri ilə açılır.
export default function SeriesPage() {
  redirect("/streaming/katalog?kind=SERIES");
}
