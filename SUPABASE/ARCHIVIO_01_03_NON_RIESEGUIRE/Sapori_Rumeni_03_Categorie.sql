-- SAPORI RUMENI — V41: aggiornamento delle categorie (una volta sola).
-- Eseguire nel SQL Editor del progetto esistente. Non ricrea tabelle.
-- Non tocca prezzi, foto, quantità, ordini, account o impostazioni.
begin;
update public.sr_products p
set cat = 'sweet', updated_at = now()
from (values
  (0, 'Cozonac cu nucă', 'Cozonac con noci'),
  (2, 'Kürtős Colaci', 'Kürtős Colaci'),
  (3, 'Cuibi de viespi', 'Cuibi de viespi')
) as v(id, ro, it)
where p.id = v.id and p.cat = 'bakery'
  and (p.ro = v.ro or p.it = v.it);
commit;
-- Controllo finale: per il catalogo originale i tre prodotti devono avere cat = sweet.
select id, it as prodotto, cat as categoria
from public.sr_products where id in (0,2,3) order by id;
