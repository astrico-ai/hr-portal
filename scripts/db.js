require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.REACT_APP_PG_USER,
  host: process.env.REACT_APP_PG_HOST,
  database: process.env.REACT_APP_PG_DATABASE,
  password: process.env.REACT_APP_PG_PASSWORD,
  port: parseInt(process.env.REACT_APP_PG_PORT || '5432'),
});

async function initializeDatabase() {
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    await pool.query(schema);
    console.log('Database schema created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase(); 