import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // For large image uploads

// Database Connection
const { Pool } = pg;
const isInternalDB = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@db:5432');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' && !isInternalDB) ? { rejectUnauthorized: false } : false
});

// Test DB Connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// API Routes

// 1. Auth (Login)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (user && user.password_hash === password) { // TODO: Use real hashing in production
      // Return user without password
      const { password_hash, ...safeUser } = user;
      res.json(safeUser);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Transactions (Get All)
// 2. Transactions (Get All)
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY timestamp DESC');
    // Map snake_case to camelCase
    const mapped = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      imageUrl: row.image_url,
      status: row.status,
      amount: parseFloat(row.amount), // Ensure number
      taker: row.taker,
      controller: row.controller,
      superior: row.superior,
      orderDate: row.order_date,
      content: row.content,
      distribution: typeof row.distribution === 'string' ? JSON.parse(row.distribution) : row.distribution,
      notes: row.notes
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Transactions (Create)
app.post('/api/transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const transactions = req.body; // Expecting an array
    const inserted = [];

    for (const t of transactions) {
      const query = `
        INSERT INTO transactions (id, timestamp, image_url, status, amount, taker, controller, superior, order_date, content, distribution)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const values = [
        t.id,
        t.timestamp,
        t.imageUrl,
        t.status,
        t.amount,
        t.taker,
        t.controller,
        t.superior,
        t.orderDate,
        t.content,
        JSON.stringify(t.distribution)
      ];
      const result = await client.query(query, values);
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Transaction failed' });
  } finally {
    client.release();
  }
});

// 4. Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// 5. Update Transaction Status/Notes
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    // Only update status and notes for now
    await pool.query(
      'UPDATE transactions SET status = $1, notes = $2 WHERE id = $3',
      [status, notes || '', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// 6. Batch Delete Transactions
app.post('/api/transactions/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    await pool.query('DELETE FROM transactions WHERE id = ANY($1)', [ids]);
    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Batch delete failed' });
  }
});

// Debug Endpoint: List Available Models
app.get('/api/debug-models', async (req, res) => {
  try {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(API_URL);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. AI Analysis (Direct Fetch v1beta with Header)
app.post('/api/analyze', async (req, res) => {
  const { base64Image, mimeType } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
  }

  try {
    console.log("Analyzing with Google Gemini (Direct Fetch v1beta Header)...");

    // Using gemini-2.0-flash as confirmed by debug endpoint
    const MODEL = "gemini-2.0-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const requestBody = {
      contents: [{
        parts: [
          {
            text: `Analyze this WeChat screenshot containing an order form (下单表).
            
            CRITICAL INSTRUCTIONS:
            1. **Amount (金额)**: Look for numbers associated with "金额", "Total", "合计", or "¥".
               - If the text contains an equals sign "=" (e.g., "50*2=100"), YOU MUST take the number AFTER the "=".
               - If there is no "=", just take the number.
               - Return ONLY the number (e.g., 100.00).
            2. **Taker (接单人)**: Extract names strictly BETWEEN "接单" and the next section ('3' or "场控").
               - **Boundary**: You MUST include the name immediately before the '3'/"场控" marker. Do not stop early.
               - **Exclusion**: Do NOT include the name *after* the '3'/"场控" marker.
               - **Parentheses**: If a name contains text in parentheses (e.g. "Name (Note)" or "Name（Note）"), REMOVE the parentheses and the text inside them. Return ONLY the name (e.g. "Name").
               - **Format**: Join multiple takers with commas.
            3. **Controller (控号)**: Extract the name associated with "控号" or "Controller".
            4. **Superior (上级)**: Extract the name associated with "上级" or "Superior".
            5. **Order Date (日期)**: Extract the exact string content. If the text contains a newline (e.g. date\ntime), REPLACE the newline with a SPACE. Example: '11.9\n16:29' -> '11.9 16:29'. Preserve all other characters.
            6. **Content (内容)**: Summarize the order content briefly.

            Return JSON with keys: amount (number), taker (string), controller (string), superior (string), orderDate (string), content (string), orderId (string).
            ONLY return the JSON object, no markdown.`
          },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }]
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      throw new Error(`API Error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Clean markdown if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    const data = JSON.parse(jsonStr);

    res.json(data);
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    res.status(500).json({ error: "AI Analysis Failed: " + error.message });
  }
});

// Debug Endpoint: List Available Models
app.get('/api/debug-models', async (req, res) => {
  try {
    const PROXY_URL = "https://gemini-proxy.bbliu131.workers.dev";
    const API_URL = `${PROXY_URL}/v1beta/models?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(API_URL);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
