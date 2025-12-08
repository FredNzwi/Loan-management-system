const request = require('supertest');

// Set test environment BEFORE any require
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'invalid-test-host-xyz';

describe('Loan Management System API', () => {
  let app;

  beforeAll(async () => {
    // Mock mysql2/promise to force in-memory mode
    jest.doMock('mysql2/promise', () => ({
      createConnection: jest.fn().mockRejectedValue(new Error('Test: Using in-memory mode'))
    }));

    // Now import the app after mocking
    app = require('../index');

    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    jest.unmock('mysql2/promise');
    jest.resetModules();
  });

  describe('POST /api/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'John Doe');
      expect(res.body).toHaveProperty('email', 'john@example.com');
    });

    it('should reject registration without name', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration without email', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Jane Doe',
          password: 'password123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration without password', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should prevent duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/register')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'pass123'
        });

      // Try duplicate
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Alice2',
          email: 'alice@example.com',
          password: 'pass456'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/already|registered|Email/i);
    });
  });

  describe('POST /api/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/register')
        .send({
          name: 'Login Test User',
          email: 'login@example.com',
          password: 'testpass123'
        });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'login@example.com',
          password: 'testpass123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email', 'login@example.com');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should require email for login', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          password: 'testpass123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should require password for login', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'login@example.com'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/loans', () => {
    let userId;

    beforeEach(async () => {
      // Register and get user ID
      const res = await request(app)
        .post('/api/register')
        .send({
          name: 'Loan Applicant',
          email: `applicant${Date.now()}@example.com`,
          password: 'pass123'
        });
      userId = res.body.id;
      expect(userId).toBeDefined();
    });

    it('should create a new loan application', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({
          amount: 50000,
          term_months: 12
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'pending');
    });

    it('should require X-User-Id header', async () => {
      const res = await request(app)
        .post('/api/loans')
        .send({
          amount: 50000,
          term_months: 12
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject loan without amount', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({
          term_months: 12
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject loan without term', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({
          amount: 50000
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject loan with negative amount', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({
          amount: -50000,
          term_months: 12
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject loan with zero term', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({
          amount: 50000,
          term_months: 0
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/loans', () => {
    let userId;

    beforeEach(async () => {
      // Register regular user
      const userRes = await request(app)
        .post('/api/register')
        .send({
          name: 'Regular User',
          email: `user${Date.now()}${Math.random()}@example.com`,
          password: 'pass123'
        });
      userId = userRes.body.id;
      expect(userId).toBeDefined();

      // Create some loans
      await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({ amount: 25000, term_months: 6 });

      await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({ amount: 50000, term_months: 12 });
    });

    it('should return user loans when user ID provided', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('X-User-Id', String(userId));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return all loans when admin flag provided', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('X-Admin', 'true');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/loans');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/loans/:id/decision', () => {
    let loanId;

    beforeEach(async () => {
      // Register user and create loan
      const userRes = await request(app)
        .post('/api/register')
        .send({
          name: 'Decision Test User',
          email: `decision${Date.now()}@example.com`,
          password: 'pass123'
        });

      const loanRes = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userRes.body.id))
        .send({ amount: 75000, term_months: 24 });

      loanId = loanRes.body.id;
      expect(loanId).toBeDefined();
    });

    it('should approve a loan with admin privilege', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/decision`)
        .set('X-Admin', 'true')
        .send({
          action: 'approve'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'approved');
    });

    it('should reject a loan with admin privilege', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/decision`)
        .set('X-Admin', 'true')
        .send({
          action: 'reject'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'rejected');
    });

    it('should deny non-admin users from making decisions', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/decision`)
        .set('X-User-Id', '1')
        .send({
          action: 'approve'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('should require valid action', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/decision`)
        .set('X-Admin', 'true')
        .send({
          action: 'invalid_action'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await request(app)
        .post('/api/loans/999999/decision')
        .set('X-Admin', 'true')
        .send({
          action: 'approve'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/loans/:id/repayment', () => {
    let loanId;
    let userId;

    beforeEach(async () => {
      // Register user, create and approve loan
      const userRes = await request(app)
        .post('/api/register')
        .send({
          name: 'Repayment Test User',
          email: `repay${Date.now()}@example.com`,
          password: 'pass123'
        });

      userId = userRes.body.id;

      const loanRes = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({ amount: 100000, term_months: 36 });

      loanId = loanRes.body.id;
      expect(loanId).toBeDefined();

      // Approve the loan
      await request(app)
        .post(`/api/loans/${loanId}/decision`)
        .set('X-Admin', 'true')
        .send({ action: 'approve' });
    });

    it('should record a repayment', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .set('X-User-Id', String(userId))
        .send({
          amount: 5000
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('amount', 5000);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .send({
          amount: 5000
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject repayment without amount', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .set('X-User-Id', String(userId))
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject repayment with negative amount', async () => {
      const res = await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .set('X-User-Id', String(userId))
        .send({
          amount: -1000
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await request(app)
        .post('/api/loans/999999/repayment')
        .set('X-User-Id', String(userId))
        .send({
          amount: 5000
        });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/loans/:id/repayments', () => {
    let loanId;
    let userId;

    beforeEach(async () => {
      // Register user and create loan
      const userRes = await request(app)
        .post('/api/register')
        .send({
          name: 'Get Repayments User',
          email: `getrepay${Date.now()}@example.com`,
          password: 'pass123'
        });
      userId = userRes.body.id;

      const loanRes = await request(app)
        .post('/api/loans')
        .set('X-User-Id', String(userId))
        .send({ amount: 100000, term_months: 36 });

      loanId = loanRes.body.id;
      expect(loanId).toBeDefined();

      // Add repayments
      await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .set('X-User-Id', String(userId))
        .send({ amount: 10000 });

      await request(app)
        .post(`/api/loans/${loanId}/repayment`)
        .set('X-User-Id', String(userId))
        .send({ amount: 5000 });
    });

    it('should retrieve repayments for a loan', async () => {
      const res = await request(app)
        .get(`/api/loans/${loanId}/repayments`)
        .set('X-User-Id', String(userId));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/loans/${loanId}/repayments`);

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await request(app)
        .get('/api/loans/999999/repayments')
        .set('X-User-Id', String(userId));

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('health status should be valid JSON', async () => {
      const res = await request(app)
        .get('/health');

      expect(() => JSON.stringify(res.body)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent route', async () => {
      const res = await request(app)
        .get('/api/nonexistent');

      expect(res.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const res = await request(app)
        .post('/api/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(res.statusCode).toBe(400);
    });
  });
});
