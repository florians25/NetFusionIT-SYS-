ALTER TABLE report_variants DROP CONSTRAINT report_variants_report_check;
ALTER TABLE report_variants ADD CONSTRAINT report_variants_report_check CHECK(report IN('ORDERS','PIPELINE','AGING','PURCHASING','DELIVERY_RELIABILITY','STOCK','MOVEMENTS','TICKET_SLA','SERVICE_TIME'));
CREATE INDEX report_receipts_posting ON goods_receipts(tenant_id,company_id,posting_date,id) WHERE sealed;
CREATE INDEX report_issues_posting ON goods_issues(tenant_id,company_id,posting_date,id) WHERE sealed;
CREATE INDEX report_time_started ON time_entries(tenant_id,started_at,ticket_id);
CREATE INDEX report_charge_recorded ON audit_events(tenant_id,document_id,(details->>'entryId'),created_at) WHERE action='TICKET_CHARGE_RECORDED';
