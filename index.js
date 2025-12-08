const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database configuration (env-friendly for DevOps)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'loan_management'
};

let db;
let isMemoryMode = false;

// In-memory store for demo/testing when MySQL is unavailable
const memoryStore = {
  users: [],
  loans: [],
  repayments: []
};

// Initialize database connection and create basic tables
async function initDB() {
  try {
    db = await mysql.createConnection(dbConfig);

    // Users
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_admin TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Loans
    await db.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        term_months INT NOT NULL,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        decision_by INT DEFAULT NULL,
        decision_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Repayments
    await db.execute(`
      CREATE TABLE IF NOT EXISTS repayments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        loan_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      )
    `);

    console.log('Database connected and tables ensured');
  } catch (error) {
    console.warn('Database connection failed; using in-memory mode for demo:', error.message);
    isMemoryMode = true;
  }
}

// Helper: minimal auth simulation
async function getUserFromHeader(req) {
  const userId = req.header('X-User-Id');
  if (!userId) return null;
  
  if (isMemoryMode) {
    return memoryStore.users.find(u => u.id === parseInt(userId, 10)) || null;
  }
  
  const [rows] = await db.execute('SELECT id, name, email, is_admin FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
}

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- Auth: Register/Login (very basic, for demo) ---
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name,email,password required' });
  try {
    if (isMemoryMode) {
      if (memoryStore.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const id = (memoryStore.users.length > 0 ? Math.max(...memoryStore.users.map(u => u.id)) : 0) + 1;
      const user = { id, name, email, password, is_admin: 0, created_at: new Date().toISOString() };
      memoryStore.users.push(user);
      res.status(201).json({ id, name, email });
    } else {
      const [result] = await db.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password]);
      res.status(201).json({ id: result.insertId, name, email });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email,password required' });
  try {
    let user;
    if (isMemoryMode) {
      user = memoryStore.users.find(u => u.email === email && u.password === password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      // Return user without password
      res.json({ user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
    } else {
      const [rows] = await db.execute('SELECT id, name, email, is_admin FROM users WHERE email = ? AND password = ?', [email, password]);
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ user: rows[0] });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Loan application submission ---
app.post('/api/loans', async (req, res) => {
  try {
    const user = await getUserFromHeader(req);
    if (!user) return res.status(401).json({ error: 'Missing X-User-Id header for authentication' });

    const { amount, term_months } = req.body;
    if (!amount || !term_months) return res.status(400).json({ error: 'amount and term_months required' });

    // Simple validation example from roadmap
    if (amount <= 0 || amount > 1000000) return res.status(400).json({ error: 'Invalid loan amount' });

    if (isMemoryMode) {
      const id = (memoryStore.loans.length > 0 ? Math.max(...memoryStore.loans.map(l => l.id)) : 0) + 1;
      const loan = { id, user_id: user.id, amount, term_months, status: 'pending', decision_by: null, decision_at: null, created_at: new Date().toISOString() };
      memoryStore.loans.push(loan);
      res.status(201).json({ id, status: 'pending' });
    } else {
      const [result] = await db.execute(
        'INSERT INTO loans (user_id, amount, term_months) VALUES (?, ?, ?)',
        [user.id, amount, term_months]
      );
      res.status(201).json({ id: result.insertId, status: 'pending' });
    }
  } catch (err) {
    console.error('Create loan error:', err);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

// --- List loans (user or admin) ---
app.get('/api/loans', async (req, res) => {
  try {
    const user = await getUserFromHeader(req);
    const isAdminHeader = req.header('X-Admin') === 'true';

    if (!user && !isAdminHeader) return res.status(401).json({ error: 'Missing auth headers' });

    let rows;
    if (isMemoryMode) {
      if (isAdminHeader || user?.is_admin) {
        // Admin: all loans with applicant info
        rows = memoryStore.loans.map(loan => {
          const applicant = memoryStore.users.find(u => u.id === loan.user_id);
          return {
            ...loan,
            applicant_name: applicant?.name,
            applicant_email: applicant?.email
          };
        });
      } else {
        // User: only their loans
        rows = memoryStore.loans.filter(l => l.user_id === user.id);
      }
    } else {
      if (isAdminHeader || user?.is_admin) {
        [rows] = await db.execute('SELECT l.*, u.name as applicant_name, u.email as applicant_email FROM loans l JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC');
      } else {
        [rows] = await db.execute('SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('List loans error:', err);
    res.status(500).json({ error: 'Failed to list loans' });
  }
});

// --- Approve / Reject (admin) ---
app.post('/api/loans/:id/decision', async (req, res) => {
  try {
    const isAdminHeader = req.header('X-Admin') === 'true';
    const user = await getUserFromHeader(req);
    if (!isAdminHeader && !(user && user.is_admin)) return res.status(403).json({ error: 'Admin header required' });

    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const status = action === 'approve' ? 'approved' : 'rejected';
    const decisionBy = isAdminHeader ? null : user.id;

    if (isMemoryMode) {
      const loan = memoryStore.loans.find(l => l.id === parseInt(id, 10));
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      loan.status = status;
      loan.decision_by = decisionBy;
      loan.decision_at = new Date().toISOString();
      res.json({ id: loan.id, status });
    } else {
      const [result] = await db.execute('UPDATE loans SET status = ?, decision_by = ?, decision_at = NOW() WHERE id = ?', [status, decisionBy, id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Loan not found' });
      res.json({ id, status });
    }
  } catch (err) {
    console.error('Decision error:', err);
    res.status(500).json({ error: 'Failed to update decision' });
  }
});

// --- Record repayment ---
app.post('/api/loans/:id/repayment', async (req, res) => {
  try {
    const user = await getUserFromHeader(req);
    if (!user) return res.status(401).json({ error: 'Missing X-User-Id header for authentication' });

    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid repayment amount' });

    if (isMemoryMode) {
      const loan = memoryStore.loans.find(l => l.id === parseInt(id, 10));
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      if (loan.user_id !== user.id && !user.is_admin) return res.status(403).json({ error: 'Not authorized for this loan' });

      const repayId = (memoryStore.repayments.length > 0 ? Math.max(...memoryStore.repayments.map(r => r.id)) : 0) + 1;
      const repayment = { id: repayId, loan_id: parseInt(id, 10), amount, paid_at: new Date().toISOString() };
      memoryStore.repayments.push(repayment);
      res.status(201).json({ id: repayId, loan_id: id, amount });
    } else {
      // Ensure loan belongs to user (or admin)
      const [loans] = await db.execute('SELECT * FROM loans WHERE id = ?', [id]);
      const loan = loans[0];
      if (!loan) return res.status(404).json({ error: 'Loan not found' });
      if (loan.user_id !== user.id && !user.is_admin) return res.status(403).json({ error: 'Not authorized for this loan' });

      const [result] = await db.execute('INSERT INTO repayments (loan_id, amount) VALUES (?, ?)', [id, amount]);
      res.status(201).json({ id: result.insertId, loan_id: id, amount });
    }
  } catch (err) {
    console.error('Repayment error:', err);
    res.status(500).json({ error: 'Failed to record repayment' });
  }
});

// --- Get repayments for a loan ---
app.get('/api/loans/:id/repayments', async (req, res) => {
  try {
    const user = await getUserFromHeader(req);
    if (!user) return res.status(401).json({ error: 'Missing X-User-Id header for authentication' });

    const { id } = req.params;
    
    if (isMemoryMode) {
      const rows = memoryStore.repayments.filter(r => r.loan_id === parseInt(id, 10));
      res.json(rows);
    } else {
      const [rows] = await db.execute('SELECT * FROM repayments WHERE loan_id = ? ORDER BY paid_at DESC', [id]);
      res.json(rows);
    }
  } catch (err) {
    console.error('Get repayments error:', err);
    res.status(500).json({ error: 'Failed to fetch repayments' });
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Loan management server running on port ${PORT}`);
  });
}

startServer();
