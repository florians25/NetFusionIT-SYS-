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
      await client.query(`GRANT SELECT,INSERT,UPDATE ON tenants,users,user_organizations,organizations,business_partners,technicians,number_ranges,documents,service_cases,tickets,dispatch_assignments,document_relations,idempotency_keys TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON audit_events TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON sessions TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON approval_definitions,approval_instances,notification_outbox TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON partner_contacts,partner_addresses,ticket_comments,ticket_links,approval_decisions TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON service_calendars,sla_policies,service_contracts,technical_objects,case_objects,ticket_sla,technician_absences,field_visits,visit_technicians TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT,UPDATE ON currencies,products,price_conditions,service_orders,service_order_items TO "${role}"`);
      await client.query(`GRANT SELECT,INSERT ON sla_events TO "${role}"`);
    }
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ERP_MIGRATION_URL) throw new Error('ERP_MIGRATION_URL fehlt. Keine Migration mit Laufzeitrolle.');
  await migrate(process.env.ERP_MIGRATION_URL);
  console.log('Migrationen geprüft und angewendet.');
}
