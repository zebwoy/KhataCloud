import { Handler, HandlerEvent } from '@netlify/functions';

export function vercelWrapper(netlifyHandler: Handler) {
  return async (req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const queryStringParameters: Record<string, string> = {};
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        const val = req.query[key];
        queryStringParameters[key] = Array.isArray(val) ? val[0] : String(val || '');
      });
    }

    const headers: Record<string, string> = {};
    if (req.headers) {
      Object.keys(req.headers).forEach((key) => {
        const val = req.headers[key];
        headers[key] = Array.isArray(val) ? val[0] : String(val || '');
      });
    }

    let bodyStr = '';
    if (req.body) {
      bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const event: HandlerEvent = {
      rawUrl: req.url || '',
      rawQuery: req.url?.split('?')[1] || '',
      path: req.url?.split('?')[0] || '',
      httpMethod: req.method || 'GET',
      headers,
      multiValueHeaders: {},
      queryStringParameters,
      multiValueQueryStringParameters: {},
      body: bodyStr,
      isBase64Encoded: false,
    };

    try {
      const context = {};
      const result = await netlifyHandler(event, context as any, () => {});
      if (result) {
        if (result.headers) {
          Object.keys(result.headers).forEach((key) => {
            res.setHeader(key, String(result.headers![key]));
          });
        }
        res.status(result.statusCode).send(result.body);
      } else {
        res.status(500).json({ error: 'No response from handler' });
      }
    } catch (err: any) {
      console.error('Error in Vercel adapter:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  };
}
