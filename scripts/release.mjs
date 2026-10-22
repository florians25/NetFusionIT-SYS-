import { provision } from './provision.mjs';
import { migrate } from './migrate.mjs';
await provision();await migrate(process.env.ERP_MIGRATION_URL);
console.log('Release-Migrationen abgeschlossen. Keine Entwicklungsbenutzer angelegt.');
