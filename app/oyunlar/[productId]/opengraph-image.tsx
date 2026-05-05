import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

export const runtime = "nodejs";
export const alt = "Honsell PS Store — oyun";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { productId: string } }) {
  const [game, settings] = await Promise.all([
    prisma.game.findUnique({
      where: { productId: params.productId },
      select: {
        title: true,
        imageUrl: true,
        heroImageUrl: true,
        platform: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
      },
    }),
    getSettings(),
  ]);

  if (!game) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0A0A0F",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          Honsell PS Store
        </div>
      ),
      size
    );
  }

  const display = computeDisplayPrice(game, settings);
  const cover = game.heroImageUrl ?? game.imageUrl ?? null;
  const platforms = game.platform ? game.platform.split(",").join(" / ") : "PlayStation";
  const priceTag = `${display.finalAzn.toFixed(2)} ₼`;
  const oldPriceTag = display.originalAzn != null && display.discountPct
    ? `${display.originalAzn.toFixed(2)} ₼`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0A0F",
          color: "white",
          position: "relative",
        }}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              opacity: 0.45,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.65) 50%, rgba(10,10,15,0.85) 100%)",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#A78BFA",
              }}
            >
              HONSELL
            </div>
            <div
              style={{
                fontSize: 22,
                color: "#9CA3AF",
              }}
            >
              · PS Store Azərbaycan
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 26,
                color: "#A78BFA",
                fontWeight: 600,
              }}
            >
              {platforms}
            </div>
            <div
              style={{
                fontSize: 76,
                fontWeight: 900,
                lineHeight: 1.05,
                maxWidth: 1000,
              }}
            >
              {game.title.length > 70 ? game.title.slice(0, 67) + "…" : game.title}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              {oldPriceTag && (
                <div
                  style={{
                    fontSize: 36,
                    color: "#71717A",
                    textDecoration: "line-through",
                  }}
                >
                  {oldPriceTag}
                </div>
              )}
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: display.discountPct ? "#34D399" : "white",
                }}
              >
                {priceTag}
              </div>
              {display.discountPct && (
                <div
                  style={{
                    background: "#DC2626",
                    color: "white",
                    fontSize: 32,
                    fontWeight: 800,
                    padding: "6px 18px",
                    borderRadius: 12,
                  }}
                >
                  -{display.discountPct}%
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: 22,
                color: "#9CA3AF",
              }}
            >
              honsell.store
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
