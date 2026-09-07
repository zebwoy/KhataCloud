import { Handler } from '@netlify/functions';
import { Client } from 'pg';
import { getAuthContext } from './utils/authHelper';

const getConnectionString = () =>
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T>(query: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
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

    // Authenticate user from JWT token
    const auth = getAuthContext(event);
    if (!auth) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userType = auth.userType;
    const tableName = userType === 'trial' ? 'trial_saved_senders' : 'saved_senders';

    const type = event.queryStringParameters?.type;

    // Auto-heal table and column
    try {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          sender VARCHAR(255) UNIQUE NOT NULL,
          sender_type VARCHAR(50) DEFAULT 'general',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await runQuery(`
        ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT 'general'
      `);
    } catch {
      // Non-fatal
    }

    // GET - Fetch all saved senders
    if (event.httpMethod === 'GET') {
      try {
        let query = `SELECT DISTINCT sender FROM ${tableName}`;
        const params: unknown[] = [];
        if (type) {
          query += ` WHERE sender_type = $1`;
          params.push(type.trim());
        }
        query += ` ORDER BY sender ASC`;
        const result = await runQuery<{ sender: string }>(query, params);
        
        const senders = result.rows.map(row => row.sender);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(senders),
        };
      } catch (error) {
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
      const { sender, type: senderTypeInput } = payload;

      if (!sender || typeof sender !== 'string' || !sender.trim()) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Sender is required and must be a non-empty string.' }),
        };
      }

      const trimmedSender = sender.trim();
      const senderType = (typeof senderTypeInput === 'string' && senderTypeInput.trim()) ? senderTypeInput.trim() : 'general';

      try {
        await runQuery(
          `INSERT INTO ${tableName} (sender, sender_type) 
           VALUES ($1, $2) 
           ON CONFLICT (sender) DO UPDATE SET sender_type = EXCLUDED.sender_type`,
          [trimmedSender, senderType]
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Sender saved successfully.', sender: trimmedSender, type: senderType }),
        };
      } catch (error) {
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

export { handler };
