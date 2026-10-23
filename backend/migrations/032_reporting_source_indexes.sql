-- Reporting selects an explicitly authorized company and preserves original
-- line allocations before applying customer/product/date filters.
CREATE INDEX invoice_company_posting ON invoices(tenant_id,company_id,posting_date) WHERE sealed;
CREATE INDEX customer_credit_company_posting ON customer_credit_memos(tenant_id,company_id,posting_date) WHERE sealed;
CREATE INDEX direct_issue_company_posting ON goods_issues(tenant_id,company_id,posting_date) WHERE sealed AND sales_order_id IS NOT NULL;
