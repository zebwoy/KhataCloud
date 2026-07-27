import { Handler } from '@netlify/functions';
import { Client, QueryResultRow } from 'pg';
import { getAuthContext } from './_utils/authHelper.js';
import { vercelWrapper } from './_utils/vercelWrapper.js';

const getConnectionString = () =>
  // Prefer pooled connection (PgBouncer) for serverless — avoids max_connections exhaustion
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
  const client = new Client({ connectionString: getConnectionString() });
  try {
    await client.connect();
    const result = await client.query<T>(query, params);
    return result;
  } finally {
    await client.end();
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

const handler: Handler = async (event) => {
  try {
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    // Authenticate — supports old JWT (admin/trial) and new Better Auth sessions (org_member)
    const auth = await getAuthContext(event);
    if (!auth) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userType = auth.userType;
    // Route: trial → trial_saved_senders, org_member → org schema, admin → saved_senders
    const tableName = userType === 'trial'
      ? 'trial_saved_senders'
      : userType === 'org_member' && auth.orgSlug
        ? `org_${auth.orgSlug.replace(/-/g, '_')}.saved_senders`
        : 'saved_senders';

    // GET - Fetch all saved senders
    if (event.httpMethod === 'GET') {
      try {
        const result = await runQuery<{ sender: string }>(
          `SELECT DISTINCT sender FROM ${tableName} ORDER BY sender ASC`
        );
        
        const senders = result.rows.map(row => row.sender);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(senders),
        };
      } catch (error) {
        // If table doesn't exist, return empty array
        // The table will be created on first POST
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([]),
        };
      }
    }

    // POST - Add a new sender (if it doesn't exist)
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body is required.' }),
        };
      }

      const payload = JSON.parse(event.body);
      const { sender } = payload;

      if (!sender || typeof sender !== 'string' || !sender.trim()) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Sender is required and must be a non-empty string.' }),
        };
      }

      const trimmedSender = sender.trim();

      try {
        // Create table if it doesn't exist
        await runQuery(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            sender VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Try to insert the sender (will fail if already exists due to UNIQUE constraint)
        await runQuery(
          `INSERT INTO ${tableName} (sender) VALUES ($1) ON CONFLICT (sender) DO NOTHING`,
          [trimmedSender]
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Sender saved successfully.', sender: trimmedSender }),
        };
      } catch (error) {
        // If it's a unique constraint violation, that's fine - sender already exists
        if ((error as Error).message.includes('duplicate key') || (error as Error).message.includes('UNIQUE')) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Sender already exists.', sender: trimmedSender }),
          };
        }
        throw error;
      }
    }

    // DELETE - Remove a sender
    if (event.httpMethod === 'DELETE') {
      const sender = event.queryStringParameters?.sender;
      
      if (!sender) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Sender parameter is required.' }),
        };
      }

      try {
        await runQuery(`DELETE FROM ${tableName} WHERE sender = $1`, [sender.trim()]);
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Sender deleted successfully.' }),
        };
      } catch (error) {
        // If table doesn't exist, that's fine - nothing to delete
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Sender deleted successfully.' }),
        };
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed.' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};

export default vercelWrapper(handler);
