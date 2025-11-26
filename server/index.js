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
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY timestamp DESC');
    res.json(result.rows);
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

// 4. AI Analysis (Via OpenRouter)
app.post('/api/analyze', async (req, res) => {
  const { base64Image, mimeType } = req.body;

  // Use OPENROUTER_API_KEY if available, otherwise fallback to GEMINI_API_KEY (if using direct)
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server missing API Key" });
  }

  try {
    const modelsToTry = [
      "qwen/qwen2.5-vl-72b-instruct", // Best for Chinese OCR
      "google/gemini-flash-1.5",
      "openai/gpt-4o-mini"
    ];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Trying model: ${model}...`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/bibiliuu/Gemini",
            "X-Title": "Muse Club Helper"
          },
          body: JSON.stringify({
            "model": model,
            "messages": [
              {
                "role": "user",
                "content": [
                  {
                    "type": "text",
                    "text": `Analyze this WeChat screenshot containing an order form (下单表).
                    Extract: Amount, Taker (all names before '3'), Controller, Superior, Order Date, Content.
                    Return JSON with keys: amount, taker, controller, superior, orderDate, content, orderId.
                    ONLY return the JSON object, no markdown.`
                  },
                  {
                    "type": "image_url",
                    "image_url": {
                      "url": `data:${mimeType};base64,${base64Image}`
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Model ${model} failed: ${errorText}`);
          lastError = new Error(`API Error: ${response.status} ${errorText}`);
          continue; // Try next model
        }

        const result = await response.json();
        const text = result.choices[0].message.content;

        // Clean markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
        const data = JSON.parse(jsonStr);

        return res.json(data); // Success! Return immediately.

      } catch (error) {
        console.warn(`Model ${model} error: ${error.message}`);
        lastError = error;
      }
    }

    // If all models failed
    throw lastError || new Error("All models failed");

  } catch (error) {
    console.error("AI Analysis Failed:", error);
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
