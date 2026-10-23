-- Keep the pre-existing quotation output alongside the new customer credit.
-- The runner also records this exact ADD statement as a forward execution patch
-- for an unapplied 030, so existing quotation archives do not block that upgrade.
-- Applied 030 source and stored checksums remain unchanged.
ALTER TABLE document_attachments DROP CONSTRAINT document_attachments_document_type_check;
ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_document_type_check CHECK(document_type IN('RECORD','ORDER_CONFIRMATION','PURCHASE_ORDER','GOODS_RECEIPT','DELIVERY_NOTE','SERVICE_REPORT','EXTERNAL_PDF','INVOICE','QUOTATION','CREDIT_NOTE'));
