-- Köhnə media host-larını (cdn.honsell.store / cdn.honsell.site — DNS-də yoxdur)
-- öz proxy-mizə köçürür: https://honsell.site/cdn/<key> (app/cdn/[...key]/route.ts).
--
-- Data miqrasiyasıdır, sxem dəyişmir. `public` sxemindəki BÜTÜN mətn sütunlarını
-- (text/varchar, text[]/varchar[], json/jsonb) information_schema-dan tapır —
-- şəkil linki hansı cədvəldə olursa olsun düzəlir. İdempotentdir: ikinci dəfə
-- işləsə uyğun sətir tapmır.

DO $$
DECLARE
  c RECORD;
  new_base CONSTANT text := 'https://honsell.site/cdn';
  cond text;
  set_expr text;
  n bigint;
BEGIN
  FOR c IN
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name <> '_prisma_migrations'
      AND (
        data_type IN ('text', 'character varying', 'json', 'jsonb')
        OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar'))
      )
  LOOP
    cond := format(
      '(%1$I::text LIKE %2$L OR %1$I::text LIKE %3$L)',
      c.column_name, '%cdn.honsell.store/%', '%cdn.honsell.site/%'
    );

    IF c.data_type = 'ARRAY' THEN
      set_expr := format(
        'ARRAY(SELECT replace(replace(x, %2$L, %4$L), %3$L, %4$L) FROM unnest(%1$I) AS x)',
        c.column_name, 'https://cdn.honsell.store', 'https://cdn.honsell.site', new_base
      );
    ELSIF c.data_type IN ('json', 'jsonb') THEN
      set_expr := format(
        'replace(replace(%1$I::text, %2$L, %4$L), %3$L, %4$L)::%5$s',
        c.column_name, 'https://cdn.honsell.store', 'https://cdn.honsell.site', new_base, c.data_type
      );
    ELSE
      set_expr := format(
        'replace(replace(%1$I, %2$L, %4$L), %3$L, %4$L)',
        c.column_name, 'https://cdn.honsell.store', 'https://cdn.honsell.site', new_base
      );
    END IF;

    EXECUTE format('UPDATE %I SET %I = %s WHERE %s', c.table_name, c.column_name, set_expr, cond);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'media host: %.% → % sətir', c.table_name, c.column_name, n;
    END IF;
  END LOOP;
END $$;
