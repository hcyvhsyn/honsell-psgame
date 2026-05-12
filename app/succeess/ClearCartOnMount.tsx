"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export default function ClearCartOnMount({ active }: { active: boolean }) {
  const { clear } = useCart();

  useEffect(() => {
    if (active) clear();
  }, [active, clear]);

  return null;
}
