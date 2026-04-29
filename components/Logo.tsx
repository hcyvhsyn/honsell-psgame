import Image from "next/image";
import Link from "next/link";

export default function Logo({
  href = "/",
  height = 24,
  className = "",
  priority = false,
}: {
  /** When set, wraps the logo in a link. Pass `null` to render without a link. */
  href?: string | null;
  /** Pixel height of the logo. Width auto-scales from the SVG aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  // SVG intrinsic size: 168 × 29. Keep the ratio when next/image reserves space
  // so the layout doesn't reflow on load.
  const ASPECT = 168 / 29;
  const img = (
    <Image
      src="/honsell-logo.svg"
      alt="Honsell"
      height={height}
      width={Math.round(height * ASPECT)}
      priority={priority}
      className={className}
    />
  );

  if (href === null) return img;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Honsell">
      {img}
    </Link>
  );
}
