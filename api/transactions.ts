import { Handler } from '@netlify/functions';
import { Client, QueryResultRow } from 'pg';
import { getAuthContext } from '../lib/authHelper.js';
import { vercelWrapper } from '../lib/vercelWrapper.js';

const getConnectionString = () =>
  // Prefer pooled connection (PgBouncer) for serverless — avoids max_connections exhaustion
  process.env.NEON_POOLED_CONNECTION_STRING ||
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T extends QueryResultRow>(query: string, params: unknown[] = []) => {
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    // Authenticate — supports old JWT (admin/trial) and new Better Auth sessions (org_member)
    const auth = await getAuthContext(event);
    if (!auth) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const userType = auth.userType;
    // Route to the correct table/schema based on user type:
    //   trial       → public.trial_transactions  (shared sandbox, unchanged)
    //   admin       → public.transactions         (legacy admin, unchanged)
    //   org_member  → org_{slug}.transactions     (per-org isolated schema)
    //   super_admin → public.transactions         (full visibility — read-only by convention)
    const getTableName = (): string => {
      if (userType === 'trial') return 'trial_transactions';
      if (userType === 'org_member' && auth.orgSlug) {
        return `org_${auth.orgSlug.replace(/-/g, '_')}.transactions`;
      }
      return 'transactions'; // admin + super_admin → public schema
    };
    const tableName = getTableName();

    // Ensure trial_transactions table exists with updated schema
    if (userType === 'trial') {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS trial_transactions (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          category VARCHAR(20) NOT NULL CHECK (category IN ('Income', 'Expense', 'Transfer')),
          subcategory VARCHAR(100),
          sender VARCHAR(255),
          receiver VARCHAR(255),
          custodian VARCHAR(255),
          counterparty VARCHAR(255),
          remarks TEXT,
          amount DECIMAL(15, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ModifiedDate TIMESTAMP,
          IsDeleted CHAR(1) DEFAULT 'N'
        );
      `);
    }

    if (event.httpMethod === 'GET') {
      const { fromDate, toDate } = event.queryStringParameters ?? {};
      const filters: string[] = [];
      const params: unknown[] = [];

      if (fromDate) {
        params.push(fromDate);
        filters.push(`date >= $${params.length}`);
      }
      if (toDate) {
        params.push(toDate);
        filters.push(`date <= $${params.length}`);
      }

      const softDeleteFilter = `(IsDeleted IS NULL OR IsDeleted != 'Y')`;
      const whereClause = filters.length 
        ? `WHERE ${softDeleteFilter} AND ${filters.join(' AND ')}` 
        : `WHERE ${softDeleteFilter}`;
      
      // Return custodian/counterparty with COALESCE fallback for pre-migration data
      const result = await runQuery<{
        id: number;
        date: string;
        category: string;
        subcategory: string;
        sender: string;
        receiver: string;
        custodian: string;
        counterparty: string;
        remarks: string;
        amount: number;
        created_at: string;
        modifieddate: string;
      }>(
        `SELECT id, date, category, subcategory, sender, receiver,
                COALESCE(custodian, receiver) as custodian,
                COALESCE(counterparty, sender) as counterparty,
                remarks, amount, created_at, ModifiedDate as modifieddate
         FROM ${tableName}
         ${whereClause}
         ORDER BY date DESC, created_at DESC`,
        params
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows),
      };
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body is required.' }),
        };
      }

      const payload = JSON.parse(event.body);

      // Validate required fields
      const alwaysRequired = ['date', 'category', 'custodian', 'counterparty', 'amount', 'remarks'];
      for (const field of alwaysRequired) {
        if (!payload[field]) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: `${field} is required.` }),
          };
        }
      }
      if (payload.category !== 'Transfer' && !payload.subcategory) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'subcategory is required for Income/Expense.' }),
        };
      }

      // Compute sender/receiver from custodian/counterparty for backward compat
      const sender: string = payload.counterparty;
      const receiver: string = payload.custodian;

      const result = await runQuery(
        `INSERT INTO ${tableName} (date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, IsDeleted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'N')
         RETURNING id, date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, created_at`,
        [
          payload.date,
          payload.category,
          payload.subcategory || null,
          sender,
          receiver,
          payload.custodian,
          payload.counterparty,
          payload.remarks,
          payload.amount,
        ]
      );

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(result.rows[0]),
      };
    }

    if (event.httpMethod === 'PUT') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body is required.' }),
        };
      }

      const payload = JSON.parse(event.body);
      const { id, modifiedDate, ...transactionData } = payload;

      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Transaction id is required for editing.' }),
        };
      }

      const alwaysRequired = ['date', 'category', 'custodian', 'counterparty', 'amount'];
      for (const field of alwaysRequired) {
        if (!transactionData[field]) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: `${field} is required.` }),
          };
        }
      }
      if (transactionData.category !== 'Transfer' && !transactionData.subcategory) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'subcategory is required for Income/Expense.' }),
        };
      }

      if (!transactionData.remarks) {
        transactionData.remarks = '';
      }

      const sender: string = transactionData.counterparty;
      const receiver: string = transactionData.custodian;

      const timestampToUse = modifiedDate || new Date().toISOString().replace('T', ' ').replace('Z', '');

      const connectionString = getConnectionString();
      if (!connectionString) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database connection string is not configured.' }),
        };
      }

      const client = new Client({ connectionString });
      
      try {
        await client.connect();
        
        await client.query('BEGIN');

        await client.query(
          `UPDATE ${tableName} 
           SET IsDeleted = 'Y' 
           WHERE id = $1 AND (IsDeleted IS NULL OR IsDeleted != 'Y')`,
          [Number(id)]
        );

        const insertResult = await client.query(
          `INSERT INTO ${tableName} (date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, ModifiedDate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamp)
           RETURNING id, date, category, subcategory, sender, receiver, custodian, counterparty, remarks, amount, created_at, ModifiedDate as modifieddate`,
          [
            transactionData.date,
            transactionData.category,
            transactionData.subcategory || null,
            sender,
            receiver,
            transactionData.custodian,
            transactionData.counterparty,
            transactionData.remarks,
            transactionData.amount,
            timestampToUse,
          ]
        );

        await client.query('COMMIT');

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(insertResult.rows[0]),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
      }
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Transaction id is required.' }),
        };
      }

      await runQuery(
        `UPDATE ${tableName} SET IsDeleted = 'Y' WHERE id = $1 AND (IsDeleted IS NULL OR IsDeleted != 'Y')`,
        [Number(id)]
      );
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
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
