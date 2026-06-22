#!/usr/bin/env bash
#
# EGRESS QORUMASI — Next image optimizer keşi deploy-lər arası qorunmalıdır.
#
# Next şəkilləri bir dəfə Supabase-dən çəkib `.next/cache/images`-də saxlayır.
# Əgər deploy `rm -rf .next` edirsə və ya təmiz qovluğa `git clone` edirsə, bu
# keş itir → növbəti açılışda BÜTÜN şəkillər yenidən Supabase-dən çəkilir →
# egress partlayışı (qota dolur, şəkillər 402 olur). Bu skript build-i həmin
# keşi stabil bir yerə backup/restore edərək icra edir.
#
# İSTİFADƏ: deploy-da `npm run build` / `next build` ƏVƏZİNƏ bunu çağırın:
#     bash scripts/build-with-image-cache.sh
#
# Keş yeri NEXT_IMAGE_CACHE_DIR env ilə dəyişdirilə bilər (default: ~/.honsell-next-cache).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_BACKUP="${NEXT_IMAGE_CACHE_DIR:-$HOME/.honsell-next-cache}"
cd "$ROOT"

copy() {
  # rsync varsa onu, yoxdursa cp istifadə et
  if command -v rsync >/dev/null 2>&1; then rsync -a "$@"; else
    local src="${@: -2:1}" dst="${@: -1:1}"; mkdir -p "$dst"; cp -R "$src." "$dst" 2>/dev/null || true
  fi
}

# 1) Əvvəlki keşi geri qaytar (təmiz checkout-da .next olmaya bilər)
if [ -d "$CACHE_BACKUP" ]; then
  echo "→ image keşi bərpa olunur: $CACHE_BACKUP → .next/cache"
  mkdir -p .next/cache
  copy "$CACHE_BACKUP/" ".next/cache/"
fi

# 2) Build (Next mövcud .next/cache-i təkrar istifadə edir)
echo "→ next build..."
npm run build

# 3) Keşi stabil yerə backup et (növbəti deploy üçün)
if [ -d .next/cache ]; then
  echo "→ image keşi backup olunur: .next/cache → $CACHE_BACKUP"
  mkdir -p "$CACHE_BACKUP"
  copy "--delete" ".next/cache/" "$CACHE_BACKUP/"
fi

echo "✓ Build tamam — image optimizer keşi qorundu ($CACHE_BACKUP)."
