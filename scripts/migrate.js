import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  user: process.env.VITE_PG_USER,
  host: process.env.VITE_PG_HOST,
  database: process.env.VITE_PG_DATABASE,
  password: process.env.VITE_PG_PASSWORD,
  port: parseInt(process.env.VITE_PG_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Read migration files
    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql'));

    // Run each migration
    for (const file of sqlFiles) {
      const migrationName = file;
      
      // Check if migration has been run
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [migrationName]
      );

      if (rows.length === 0) {
        // Run migration
        const sql = await fs.readFile(join(migrationsDir, file), 'utf8');
        await client.query(sql);
        
        // Record migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationName]
        );
        
        console.log(`Executed migration: ${migrationName}`);
      } else {
        console.log(`Skipping migration: ${migrationName} (already executed)`);
      }
    }
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);