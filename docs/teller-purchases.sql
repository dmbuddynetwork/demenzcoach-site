WITH arms(arm, variant, source) AS (VALUES ('website','a','teller_website'), ('funnel','b','teller_funnel')),
attribution AS (
 SELECT subscription_id,
 MAX(CASE WHEN key='campaign' THEN value END) AS campaign,
 MAX(CASE WHEN key='variant' THEN value END) AS variant,
 MAX(CASE WHEN key='source' THEN value END) AS source
 FROM subscriptions_metadata
 WHERE key IN ('campaign','variant','source')
 GROUP BY subscription_id
),
confirmed_charges AS (
 SELECT invoice_id, SUM(amount) AS charged_cents, SUM(amount_refunded) AS refunded_cents
 FROM charges WHERE paid=true AND status='succeeded' AND invoice_id IS NOT NULL
 GROUP BY invoice_id
),
paid AS (
 SELECT i.subscription_id, i.currency, i.amount_paid, c.refunded_cents
 FROM invoices i JOIN confirmed_charges c ON c.invoice_id=i.id
 WHERE i.paid=true AND i.status='paid' AND i.amount_paid>0 AND COALESCE(i.paid_out_of_band,false)=false
)
SELECT arms.arm, COUNT(DISTINCT paid.subscription_id) AS paid_subscriptions,
 COUNT(paid.subscription_id) AS paid_invoices,
 COALESCE(SUM(paid.amount_paid),0) AS gross_eur_cents,
 COALESCE(SUM(paid.refunded_cents),0) AS refunded_eur_cents,
 COUNT(DISTINCT CASE WHEN paid.refunded_cents>0 THEN paid.subscription_id END) AS subscriptions_with_refund
FROM arms LEFT JOIN attribution a ON a.campaign='teller_v1' AND a.variant=arms.variant AND a.source=arms.source
LEFT JOIN paid ON paid.subscription_id=a.subscription_id AND LOWER(paid.currency)='eur'
GROUP BY arms.arm ORDER BY arms.arm
