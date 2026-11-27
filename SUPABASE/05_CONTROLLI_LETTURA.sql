-- SOLO LETTURA: controlli dopo la migrazione, senza dati personali.
select 'prodotti' as controllo, count(*)::text as risultato from public.sr_products
union all select 'titolari attivi',count(*)::text from public.sr_staff where role='owner' and active
union all select 'ordini aperti (deve essere false al collaudo)',coalesce(data->>'open','false') from public.sr_settings where id=1
union all select 'anon può leggere ordini (deve essere false)',has_table_privilege('anon','public.sr_orders','SELECT')::text
union all select 'anon può scrivere prodotti (deve essere false)',has_table_privilege('anon','public.sr_products','UPDATE')::text
union all select 'anon può chiamare gestione ordini (deve essere false)',has_function_privilege('anon','public.sr_update_order(jsonb)','EXECUTE')::text
union all select 'anon può chiamare snapshot staff (deve essere false)',has_function_privilege('anon','public.sr_staff_snapshot()','EXECUTE')::text
union all select 'catalogo RPC anon disponibile (deve essere true)',has_function_privilege('anon','public.sr_catalog_v42()','EXECUTE')::text;
select c.relname,c.relrowsecurity as rls_attiva from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relname in ('sr_staff','sr_products','sr_settings','sr_orders','sr_order_lines','sr_payments','sr_audit','sr_notifications','sr_reviews','sr_records','sr_coupons','sr_mutations') order by c.relname;
