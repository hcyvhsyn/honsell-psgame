// Sebet üçün biznes-qaydaları. Həm server (checkout API), həm client (CartView)
// eyni dəyəri istifadə etsin deyə ortaq saxlayırıq. Konstant olaraq qaldı:
// gələcəkdə adminə tənzimlənən etmək istəsək, Settings cədvəlinə köçürülə bilər.

/** Sifariş qəbul olunması üçün minimum sebet məbləği (AZN). */
export const MIN_CART_AZN = 5;

/** Eyni hədd qəpik (cent) vahidində — totalCents müqayisəsi üçün. */
export const MIN_CART_AZN_CENTS = MIN_CART_AZN * 100;
