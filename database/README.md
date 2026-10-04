# Database schema

Cerberus supports PostgreSQL and MySQL. Import the schema matching
`database.dialect` in `config.js` before starting the bot:

- PostgreSQL: `database/schema.sql`
- MySQL: `database/schema.mysql.sql`

Both files create the `warnings` table used by `src/database/models/Warning.ts`.
They can be run against the configured database more than once because the
table creation uses `IF NOT EXISTS`.

Alternatively, run `npm run db:migrate` to let Sequelize create the table.
