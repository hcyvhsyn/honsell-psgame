import { redirect } from "next/navigation";

// İcmallar artıq Honsell İcması (/icma) altındakı "İcmallar" tabında yaşayır.
// Köhnə link və bukmarklar pozulmasın deyə bu route /icma-ya yönləndirir.
export default function StreamingReviewsRedirect() {
  redirect("/icma?tab=icmallar");
}
