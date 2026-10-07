-- Rollback for the Vectramind USD conversion (2026-10-07). Restores original INR state.
update public.billable_items set currency='INR', amount=64463, inr_value=null, exchange_rate=null, line_items='[]'::jsonb where id=20;
update public.billable_items set currency='INR', amount=64463, inr_value=null, exchange_rate=null, line_items='[]'::jsonb where id=26;
update public.billable_items set currency='INR', amount=65332.97, inr_value=null, exchange_rate=null, line_items='[{"amount":65332.97,"description":"Month 3 cost for Vectramind Instance "}]'::jsonb where id=34;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"amount":65333,"description":"Month 1 cost Zulekha"}]'::jsonb where id=35;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"amount":65333,"quantity":1,"description":"Month 4"}]'::jsonb where id=41;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"amount":65333,"quantity":1,"description":"Month 2"}]'::jsonb where id=42;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"unit":"month","amount":65333,"quantity":1,"description":"Instance 1 cost for August 2026"}]'::jsonb where id=46;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"unit":"month","amount":65333,"quantity":1,"description":"Instance 2 cost for August 2026"}]'::jsonb where id=47;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"unit":"month","amount":65333,"quantity":1,"description":"September"}]'::jsonb where id=51;
update public.billable_items set currency='INR', amount=65333, inr_value=null, exchange_rate=null, line_items='[{"rate":65333,"unit":"month","amount":65333,"quantity":1,"description":"September"}]'::jsonb where id=52;
