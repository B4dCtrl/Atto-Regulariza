-- Limpar dados de seed (executar APÓS a migração anterior se quiser começar do zero)
-- Comentado por padrão. Descomente e execute se quiser remover dados de demo.

-- DELETE FROM public.messages WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%Apto%' OR name LIKE '%Casa%');
-- DELETE FROM public.documents WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%Apto%' OR name LIKE '%Casa%');
-- DELETE FROM public.process_stages WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%Apto%' OR name LIKE '%Casa%');
-- DELETE FROM public.properties WHERE name LIKE '%Apto%' OR name LIKE '%Casa%' OR name LIKE '%Lote%' OR name LIKE '%Sala%' OR name LIKE '%Galpão%' OR name LIKE '%Terreno%';
