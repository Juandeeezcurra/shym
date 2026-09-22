// Regenera migrations/0001_init.sql desde src/schema.js.
import fs from 'node:fs';
import { buildSchemaSql } from '../src/schema.js';
fs.writeFileSync(
  'migrations/0001_init.sql',
  '-- Shym: schema inicial. Generado desde src/schema.js\n\n' + buildSchemaSql()
);
console.log('migrations/0001_init.sql regenerado');
