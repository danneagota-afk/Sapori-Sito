-- FASE 2: modifiche catalogo protette; non abilita gli ordini.
begin;
create or replace function public.sr_catalog()
returns table(id integer, ro text, it text, price numeric, cat text, unit text, image text, desc_it text, desc_ro text, allergens text, availability text)
language sql stable security definer set search_path = '' as $$
 select p.id,p.ro,p.it,p.price,p.cat,p.unit,p.image,p.desc_it,p.desc_ro,p.allergens,
 case when p.stock-coalesce(r.qty,0)<=0 then 'unavailable' when p.stock-coalesce(r.qty,0)<=p.low then 'low' else 'available' end
 from public.sr_products p left join lateral (
 select sum(l.qty) qty from public.sr_order_lines l join public.sr_orders o on o.id=l.order_id
 where l.product_id=p.id and o.status in ('Da confermare','Confermata','In preparazione','Pronta')) r on true
 where p.active order by p.id;
$$;
revoke all on function public.sr_catalog() from public, anon, authenticated;
grant execute on function public.sr_catalog() to anon, authenticated;
create or replace function public.sr_save_product(p jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare pid integer; oldrow public.sr_products%rowtype; reserved numeric; v_stock numeric; v_price numeric; v_cost numeric; v_low numeric; v_image text; v_unit text; v_cat text; v_it text; v_ro text; v_active boolean;
begin
 if not exists(select 1 from public.sr_staff where user_id=auth.uid() and active and role in ('owner','manager')) then raise exception 'Accesso negato' using errcode='42501'; end if;
 if jsonb_typeof(p) <> 'object' then raise exception 'Dati non validi'; end if;
 pid := (p->>'id')::integer; v_stock := (p->>'stock')::numeric; v_price := (p->>'price')::numeric; v_cost := (p->>'cost')::numeric; v_low := (p->>'low')::numeric; v_image:=coalesce(p->>'image',''); v_unit:=p->>'unit'; v_cat:=p->>'cat'; v_it:=btrim(p->>'it'); v_ro:=btrim(p->>'ro'); v_active:=(p->>'active')::boolean;
 if v_it is null or v_ro is null or length(v_it) not between 1 and 200 or length(v_ro) not between 1 and 200 or v_unit is null or v_unit not in ('kg','buc') or v_cat is null or v_cat not in ('bakery','sweet','meat','deli','cheese') or v_active is null then raise exception 'Nome, categoria o unità non validi'; end if;
 if v_stock is null or v_price is null or v_cost is null or v_low is null or not (v_stock between 0 and 1000000 and v_price between 0.01 and 1000000 and v_cost between 0 and 1000000 and v_low between 0 and 1000000) or (v_unit='buc' and v_stock<>trunc(v_stock)) then raise exception 'Prezzo o quantità non validi'; end if;
 if length(v_image)>400000 or (v_image<>'' and v_image !~ '^assets/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$' and v_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' and v_image !~ '^https://[^[:space:]<>"'']+$') then raise exception 'Immagine non valida'; end if;
 if greatest(length(coalesce(p->>'descIt','')),length(coalesce(p->>'descRo','')),length(coalesce(p->>'allergens','')))>5000 then raise exception 'Descrizione troppo lunga'; end if;
 if pid is not null then
   select * into oldrow from public.sr_products where id=pid for update;
   if not found then raise exception 'Prodotto non trovato'; end if;
   if (p->>'updated_at') is null or oldrow.updated_at <> (p->>'updated_at')::timestamptz then raise exception 'Prodotto modificato da un altro operatore. Aggiorna i dati e riprova'; end if;
   if oldrow.unit<>v_unit and exists(select 1 from public.sr_order_lines where product_id=pid) then raise exception 'Unità non modificabile: prodotto presente negli ordini'; end if;
   select coalesce(sum(l.qty),0) into reserved from public.sr_order_lines l join public.sr_orders o on o.id=l.order_id where l.product_id=pid and o.status in ('Da confermare','Confermata','In preparazione','Pronta');
   if v_stock<reserved then raise exception 'Scorta inferiore alle prenotazioni'; end if;
   if not v_active and reserved>0 then raise exception 'Prodotto con prenotazioni attive'; end if;
   update public.sr_products set it=v_it,ro=v_ro,cat=v_cat,unit=v_unit,price=v_price,cost=v_cost,stock=v_stock,low=v_low,active=v_active,image=v_image,desc_it=coalesce(p->>'descIt',''),desc_ro=coalesce(p->>'descRo',''),allergens=coalesce(p->>'allergens',''),updated_at=now() where id=pid;
 else
   insert into public.sr_products(it,ro,cat,unit,price,cost,stock,low,active,image,desc_it,desc_ro,allergens) values(v_it,v_ro,v_cat,v_unit,v_price,v_cost,v_stock,v_low,v_active,v_image,coalesce(p->>'descIt',''),coalesce(p->>'descRo',''),coalesce(p->>'allergens','')) returning id into pid;
 end if;
 insert into public.sr_audit(actor,action,detail) values(auth.uid(),'product_saved',jsonb_build_object('id',pid,'price',v_price,'stock',v_stock,'active',v_active));
 return pid;
end $$;
revoke all on function public.sr_save_product(jsonb) from public, anon, authenticated;
grant execute on function public.sr_save_product(jsonb) to authenticated;
-- Verifiche di configurazione: gli accessi diretti restano in sola lettura.
do $$ begin
 if has_function_privilege('anon','public.sr_save_product(jsonb)','EXECUTE') or has_table_privilege('anon','public.sr_orders','SELECT') or has_table_privilege('authenticated','public.sr_products','UPDATE') then raise exception 'Permessi non sicuri'; end if;
end $$;
commit;
select 'SAPORI RUMENI — FASE 2 CATALOGO COMPLETATA' as esito, count(*) as prodotti from public.sr_products;
