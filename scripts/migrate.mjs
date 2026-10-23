import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function migrate(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(884811)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = new URL('../backend/migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(name,dir),'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
      if (prior.rowCount) {
        if (prior.rows[0].checksum !== checksum) throw new Error(`Migration ${name} wurde nach Anwendung verändert.`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
        await client.query('COMMIT');
      } catch(e) { await client.query('ROLLBACK'); throw e; }
    }
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    const role = process.env.ERP_DB_ROLE || 'erp_app';
    if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error('Ungültige Laufzeitrolle');
    if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) {
      await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON sales_order_fulfillment TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON service_quotes TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON service_quote_partners,service_quote_items,service_quote_schedules TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON service_quote_events,service_quote_decisions TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON sd_org_units,sd_sales_areas,sd_terms,sales_orders TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON sales_order_partners,sales_order_items,sales_order_schedules TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON sales_order_events TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON inventory_counts,inventory_count_lines TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON inventory_count_scopes,inventory_count_entries,inventory_count_preparations,inventory_count_movements TO "${role}"`);
      await client.query(`GRANT UPDATE(empty_confirmed_by,empty_confirmed_at) ON inventory_count_scopes TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON warehouse_areas,warehouse_racks,warehouse_bins,warehouse_transfers TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON warehouse_transfer_items,warehouse_bin_labels TO "${role}"`);
      await client.query(`GRANT SELECT ON warehouse_bin_balances,warehouse_bin_entries,warehouse_bin_openings TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON supplier_invoice_allocations,supplier_invoice_open_items TO "${role}"`);
      await client.query(`GRANT SELECT ON supplier_invoice_balances TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON supplier_invoice_reversals TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON supplier_invoices,supplier_invoice_imports TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON supplier_invoice_originals,supplier_invoice_scans TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON supplier_invoice_items TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON company_billing_profiles,partner_company_accounts,billing_requests,invoices,invoice_output_jobs TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON billing_request_lines,invoice_items,invoice_open_items,invoice_outputs TO "${role}"`);
      await client.query(`GRANT UPDATE ON partner_contacts,partner_addresses TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON business_number_series TO "${role}"`);
      await client.query(`GRANT SELECT ON schema_migrations TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON tenants,users,user_organizations,organizations,business_partners,technicians,number_ranges,documents,service_cases,tickets,dispatch_assignments,document_relations,idempotency_keys TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON audit_events TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON document_attachments,attachment_scans TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON sessions TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON approval_definitions,approval_instances,notification_outbox TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON partner_contacts,partner_addresses,ticket_comments,ticket_links,approval_decisions TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON service_calendars,sla_policies,service_contracts,technical_objects,case_objects,ticket_sla,technician_absences,field_visits,visit_technicians TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON currencies,products,price_conditions,service_orders,service_order_items TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON service_reports,time_entries,work_order_tasks,ticket_charges TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON work_timers TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON service_report_lines TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON company_codes,gl_accounts,fiscal_periods,journals,accounting_rules TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON supplier_data,order_requirements,order_requirement_items,purchase_requisitions,purchase_requisition_items,purchase_orders,purchase_order_items TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON material_inventory_settings,goods_receipts,stock_reservations TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON plants,storage_locations TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON goods_issues TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON goods_issue_items TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON goods_receipt_items TO "${role}"`);
      await client.query(`GRANT SELECT ON stock_balances,inventory_valuations TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON journal_entries TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON sla_events TO "${role}"`);
    }
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ERP_MIGRATION_URL) throw new Error('ERP_MIGRATION_URL fehlt. Keine Migration mit Laufzeitrolle.');
  await migrate(process.env.ERP_MIGRATION_URL);
  console.log('Migrationen geprüft und angewendet.');
}
