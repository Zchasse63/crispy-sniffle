-- P2-D: taxonomy-v1 keys the machine scrape produced data for
alter type public.equipment_key add value if not exists 'stepmill';
alter type public.equipment_key add value if not exists 'specialty_bars';
alter type public.equipment_key add value if not exists 'nordic_bench';
