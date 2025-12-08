# 🚀 Quick Reference Guide

## Start the Application

```bash
cd /home/khalifa/Downloads/notes-app
npm install          # One-time: install dependencies
npm start            # Start server on port 3000
```

**Expected output:**
```
Loan management server running on port 3000
Database connection failed; using in-memory mode for demo
```

Open browser: **http://localhost:3000**

---

## API Quick Reference

### 1️⃣ Register User
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"pass123"}'
```
**Returns**: `{ "id": 1, "name": "Alice", "email": "alice@test.com" }`

### 2️⃣ Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"pass123"}'
```
**Returns**: `{ "user": { "id": 1, "name": "Alice", "email": "alice@test.com", "is_admin": 0 } }`

### 3️⃣ Apply for Loan
```bash
curl -X POST http://localhost:3000/api/loans \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"amount":100000,"term_months":24}'
```
**Returns**: `{ "id": 1, "status": "pending" }`

### 4️⃣ List Your Loans
```bash
curl -X GET http://localhost:3000/api/loans \
  -H "X-User-Id: 1"
```
**Returns**: `[ { "id": 1, "user_id": 1, "amount": 100000, "status": "pending", ... } ]`

### 5️⃣ View All Loans (Admin)
```bash
curl -X GET http://localhost:3000/api/loans \
  -H "X-Admin: true"
```
**Returns**: All loans with applicant info

### 6️⃣ Approve/Reject Loan (Admin)
```bash
curl -X POST http://localhost:3000/api/loans/1/decision \
  -H "Content-Type: application/json" \
  -H "X-Admin: true" \
  -d '{"action":"approve"}'
```
**Returns**: `{ "id": 1, "status": "approved" }`

### 7️⃣ Record Repayment
```bash
curl -X POST http://localhost:3000/api/loans/1/repayment \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"amount":5000}'
```
**Returns**: `{ "id": 1, "loan_id": 1, "amount": 5000 }`

### 8️⃣ View Repayment History
```bash
curl -X GET http://localhost:3000/api/loans/1/repayments \
  -H "X-User-Id: 1"
```
**Returns**: `[ { "id": 1, "loan_id": 1, "amount": 5000, "paid_at": "..." } ]`

### 9️⃣ Health Check
```bash
curl http://localhost:3000/health
```
**Returns**: `{ "status": "OK", "timestamp": "2025-12-08T..." }`

---

## NPM Scripts

```bash
npm start              # Start server
npm run dev            # Start with nodemon (auto-reload)
npm run lint           # Check code quality
npm run lint:fix       # Auto-fix linting issues
npm test               # Run Jest tests (when added)
npm run test:watch     # Watch mode for tests
```

---

## Key Files

| File | Purpose |
|------|---------|
| `index.js` | Express backend with 8 API endpoints |
| `public/index.html` | Web UI (register, login, loans, repayments) |
| `README_LOAN_MANAGEMENT.md` | Full documentation |
| `COMPLETION_CHECKLIST.md` | What was completed |
| `.eslintrc.json` | Code quality rules |
| `Dockerfile` | Docker multi-stage build |
| `docker-compose.yml` | Local dev (app + MySQL) |

---

## Authentication Headers

```bash
# For user endpoints (replace 1 with actual user ID)
-H "X-User-Id: 1"

# For admin endpoints
-H "X-Admin: true"
```

---

## Common Issues & Solutions

### ❌ "Cannot find module 'express'"
```bash
npm install
```

### ❌ "Port 3000 already in use"
```bash
lsof -i :3000              # Find process
kill -9 <PID>              # Kill process
# OR use different port
PORT=3001 npm start
```

### ❌ MySQL connection errors
✅ Normal! The app falls back to **in-memory mode** automatically

### ❌ Linting errors
```bash
npm run lint:fix           # Auto-fix issues
```

---

## Development Workflow

```bash
# 1. Start server
npm start

# 2. In another terminal, test endpoints
curl http://localhost:3000/health

# 3. Make code changes and save
# (Server auto-reloads if using: npm run dev)

# 4. Run linting before commit
npm run lint

# 5. Commit with standard message
git commit -m "feat: add repayment validation"
```

---

## Docker Commands

```bash
# Build image
docker build -t loan-app:latest .

# Run container
docker run -p 3000:3000 loan-app:latest

# Run with MySQL (compose)
docker-compose up -d

# View logs
docker logs <container-id>

# Stop
docker-compose down
```

---

## DevOps Checklist

- [x] Phase 1: Plan — Scope, architecture, error budget
- [x] Phase 2: Code — Git branches, commit standards, PR process
- [x] Phase 3: Build — Docker, environment variables, CI templates
- [ ] Phase 4: Test — Jest tests (ready to add)
- [ ] Phase 5: Deploy — Kubernetes manifests (ready to add)
- [ ] Phase 6: Monitor — Prometheus, Grafana (templates in README)

---

## Essential Links

- **API Docs**: Read `README_LOAN_MANAGEMENT.md`
- **What Changed**: Read `IMPLEMENTATION_SUMMARY.md`
- **DevOps Plan**: See `README_LOAN_MANAGEMENT.md` "DevOps Roadmap Progress"

---

**Happy coding! 🚀**
