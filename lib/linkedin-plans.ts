export type LinkedInPlanType = "CAREER" | "BUSINESS";

export type LinkedInVariant = {
  id: string;
  planType: LinkedInPlanType;
  durationMonths: number;
  priceAznCents: number;
  oldPriceAznCents: number | null;
  discountPercent: number | null;
  isPopular: boolean;
  title: string;
  imageUrl: string | null;
};

export type LinkedInPlanGroup = {
  planType: LinkedInPlanType;
  variants: LinkedInVariant[];
};

export const LINKEDIN_PLAN_LABELS: Record<LinkedInPlanType, string> = {
  CAREER: "LinkedIn Premium Career",
  BUSINESS: "LinkedIn Premium Business",
};

export const LINKEDIN_PLAN_TAGLINES: Record<LinkedInPlanType, string> = {
  CAREER:
    "İş axtaranlar, tələbələr və peşəkar inkişaf üçün — daha çox iş təklifi və profil görünürlüyü.",
  BUSINESS:
    "Sahibkarlar, satış komandaları və networking üçün — biznes insights və geniş əlaqə imkanı.",
};

export const LINKEDIN_PLAN_FEATURES: Record<LinkedInPlanType, string[]> = {
  CAREER: [
    "Aylıq InMail mesajları (5)",
    "Kim profilinə baxıb — son 90 gün",
    "Müraciət edən namizədlər siyahısında üst sırada",
    "LinkedIn Learning — bütün kurslar",
    "Job insights və maaş bandı məlumatı",
    "Open Profile — hər kəs sənə pulsuz yaza bilər",
  ],
  BUSINESS: [
    "Aylıq InMail mesajları (15)",
    "Kim profilinə baxıb — limitsiz tarix",
    "Geniş axtarış filtri (sənayə, şirkət ölçüsü)",
    "LinkedIn Learning — bütün kurslar",
    "Business insights — şirkət böyümə trendləri",
    "Premium Profile rozetkası — daha çox görünürlük",
  ],
};

export function groupVariantsByPlan(variants: LinkedInVariant[]): LinkedInPlanGroup[] {
  const buckets: Record<LinkedInPlanType, LinkedInVariant[]> = {
    CAREER: [],
    BUSINESS: [],
  };
  for (const v of variants) buckets[v.planType].push(v);

  (Object.keys(buckets) as LinkedInPlanType[]).forEach((k) => {
    buckets[k].sort((a, b) => a.durationMonths - b.durationMonths);
  });

  return [
    { planType: "CAREER", variants: buckets.CAREER },
    { planType: "BUSINESS", variants: buckets.BUSINESS },
  ];
}

export function discountPercent(oldCents: number | null, finalCents: number): number | null {
  if (oldCents == null || oldCents <= finalCents) return null;
  return Math.round(((oldCents - finalCents) / oldCents) * 100);
}
