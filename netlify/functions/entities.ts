import { Handler } from '@netlify/functions';
import { Client } from 'pg';

const getConnectionString = () =>
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T>(query: string, params: unknown[] = []) => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Database connection string is not configured.');
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    return await client.query<T>(query, params);
  } finally {
    await client.end();
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface Entity {
  id: number;
  entity_name: string;
  entity_type: 'trustee' | 'donor' | 'vendor' | 'other';
  IsDeleted: string;
  ModifiedDate: string | null;
  IsTrial: string;
  created_at: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Get userType from query parameter or default to 'admin'
    const userType = event.queryStringParameters?.userType || 'admin';
    const isTrial = userType === 'trial' ? 'Y' : 'N';

    // Get entity type filter from query parameter (optional)
    // Supports: 'trustee', 'donor', 'vendor', 'other', 'counterparty' (all non-trustee)
    // Also supports legacy values: 'sender' (maps to non-trustee), 'receiver' (maps to trustee)
    const entityType = event.queryStringParameters?.entityType;

    if (event.httpMethod === 'GET') {
      let query = `
        SELECT id, entity_name, entity_type, IsDeleted, ModifiedDate, IsTrial, created_at
        FROM entities
        WHERE IsDeleted = 'N' AND IsTrial = $1
      `;
      const params: unknown[] = [isTrial];

      // Add entity_type filter if provided
      if (entityType) {
        if (entityType === 'trustee' || entityType === 'receiver') {
          // Fetch trustees (supports both new and legacy type names)
          query += ` AND entity_type IN ('trustee', 'receiver')`;
        } else if (entityType === 'counterparty' || entityType === 'sender') {
          // Fetch all non-trustee entities (donors, vendors, other)
          query += ` AND entity_type NOT IN ('trustee', 'receiver')`;
        } else if (['donor', 'vendor', 'other'].includes(entityType)) {
          query += ` AND entity_type = $2`;
          params.push(entityType);
        }
      }

      query += ` ORDER BY entity_name ASC`;

      const result = await runQuery<Entity>(query, params);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Error fetching entities:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to fetch entities' }),
    };
  }
};
