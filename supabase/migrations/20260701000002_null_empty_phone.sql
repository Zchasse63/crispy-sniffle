-- Audit fix (LOW): a seed row stored '' for an unknown phone instead of null,
-- violating the unknown-stays-null rule (an empty string reads as "present" to
-- any "phone is not null" query). Normalize any empty-string phone to null.
update public.gyms set phone = null where phone = '';
