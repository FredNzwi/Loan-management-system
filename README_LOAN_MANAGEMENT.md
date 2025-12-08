# Loan Management System – DevOps Roadmap Implementation

A production-ready Node.js/Express backend implementing a complete **Loan Management System** aligned with a comprehensive **DevOps roadmap** covering Phases 1–4 (Plan, Code, Build, Test, Deploy, Monitor).

---

## 📋 Project Overview

This project is a **DevOps learning exercise** that transforms a basic notes app into a loan management system with industry-standard practices:

### Core Features
- ✅ **Customer Registration & Login** (header-based auth)
- ✅ **Loan Application Submission** (with validation)
- ✅ **Loan Approval/Rejection Workflow** (admin role)
- ✅ **Repayment Tracking & History** (loan payments)
- ✅ **Admin Dashboard** (view all loans, applicants)
- ✅ **Health Check Endpoint** (monitoring readiness)
- ✅ **In-Memory Fallback Mode** (demo without MySQL)

---

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MySQL 8.0+ (optional; in-memory fallback for demo)
- **Frontend**: HTML/CSS/JavaScript with Bootstrap 5
- **Containerization**: Docker (multi-stage builds)

### Database Schema (3 Core Tables)

```sql
-- Users (customers and admins)
users:
  - id (PK)
  - name, email, password
  - is_admin (flag for role)
  - created_at

-- Loans (applications and decisions)
loans:
  - id (PK)
  - user_id (FK)
  - amount (DECIMAL)
  - term_months (INT)
  - status (ENUM: pending, approved, rejected)
  - decision_by, decision_at
  - created_at

-- Repayments (payment history)
repayments:
  - id (PK)
  - loan_id (FK)
  - amount, paid_at
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- (Optional) MySQL 8.0+
- (Optional) Docker & Docker Compose

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Server (In-Memory Mode)
```bash
npm start
# Output: Loan management server running on port 3000
```

The server automatically detects if MySQL is unavailable and falls back to **in-memory mode** for demo/testing.

### 3. Test the API
```bash
# Health check
curl http://localhost:3000/health

# Register a user
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@test.com","password":"pass123"}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"pass123"}'

# Apply for a loan (requires X-User-Id header)
curl -X POST http://localhost:3000/api/loans \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"amount":50000,"term_months":12}'

# List loans (as admin)
curl -X GET http://localhost:3000/api/loans \
  -H "X-Admin: true"
```

### 4. Access Web UI
Open your browser:
```
http://localhost:3000
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/register` — Register a new customer
- `POST /api/login` — Login (returns user info)

### Loans
- `POST /api/loans` — Submit loan application (requires `X-User-Id` header)
- `GET /api/loans` — List loans (user's or all if admin via `X-Admin: true`)
- `POST /api/loans/:id/decision` — Approve/reject loan (admin only)

### Repayments
- `POST /api/loans/:id/repayment` — Record a repayment
- `GET /api/loans/:id/repayments` — Get repayment history

### Health
- `GET /health` — Health check endpoint (for monitoring)

#### Authentication Headers
- `X-User-Id: <number>` — User ID for authenticated requests
- `X-Admin: true` — Admin mode (for demo/testing)

---

## 🔧 Environment Configuration

The server respects the following environment variables:

```bash
# Database Connection
DB_HOST=localhost          # MySQL host (default: localhost)
DB_USER=root              # MySQL user (default: root)
DB_PASSWORD=password      # MySQL password (default: password)
DB_NAME=loan_management   # Database name (default: loan_management)

# Server
PORT=3000                 # Server port (default: 3000)
```

**Example:**
```bash
export DB_HOST=mysql.example.com
export DB_USER=app_user
export DB_PASSWORD=secure_pass
export DB_NAME=loans_prod
npm start
```

If MySQL is unreachable, the server gracefully falls back to **in-memory mode** (suitable for development/demo).

---

## 📦 Project Structure

```
.
├── index.js                    # Main server & API routes
├── public/
│   └── index.html             # Frontend UI (register, login, loans, repayments)
├── package.json               # Dependencies & scripts
├── Dockerfile                 # Multi-stage build for production
├── docker-compose.yml         # Local dev environment (app + MySQL)
├── healthcheck.js             # Standalone health check script
├── README_LOAN_MANAGEMENT.md  # This file
└── README.md                  # Original notes-app README
```

---

## 🐳 Docker & Containerization

### Build Docker Image (Multi-Stage)
```bash
docker build -t loan-management:latest .
```

The `Dockerfile` uses a **multi-stage build**:
1. **Builder stage**: Install deps, build
2. **Production stage**: Minimal `node:18-alpine` image

### Run in Docker
```bash
docker run -p 3000:3000 \
  -e DB_HOST=mysql \
  -e DB_USER=app \
  -e DB_PASSWORD=secure \
  -e DB_NAME=loans \
  loan-management:latest
```

### Docker Compose (Local Dev + MySQL)
```bash
docker-compose up -d
```

This starts:
- **app**: Loan management backend on `localhost:3000`
- **mysql**: MySQL 8.0 on `localhost:3306`

Access the app: `http://localhost:3000`

---

## 🧪 Testing & Quality Assurance

### Run Tests
```bash
npm test                # Run all tests
npm run test:watch     # Watch mode
```

### Linting
```bash
npm run lint           # Check code style
npm run lint:fix       # Auto-fix issues
```

### Example Jest Test
```javascript
// test/register.test.js
describe('POST /api/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'pass123' });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
```

---

## 🔄 Git Workflow (Phase 2: Code)

### Branch Strategy
```
main
  ├── develop (integration branch)
  │   ├── feature/user-auth
  │   ├── feature/loan-application
  │   └── feature/admin-dashboard
```

### Commit Message Standards
```
feat: add loan approval workflow
fix: correct repayment validation
docs: update README with API examples
test: add integration tests for loans
chore: update dependencies
```

### Pull Request Process
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make commits with descriptive messages
3. Open PR to `develop`
4. Require ≥1 code review before merge
5. Auto-run CI checks (lint, tests, build)

---

## 🔨 CI/CD Pipeline (Phase 3: Build)

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: docker build -t loan-app:${{ github.sha }} .
```

### Pipeline Stages
1. **Install dependencies** → `npm install`
2. **Lint code** → `npm run lint` (ESLint)
3. **Run tests** → `npm test` (Jest)
4. **Build Docker image** → Multi-stage build
5. **Push to registry** (optional)

---

## 📊 Monitoring & Error Budget (Phase 4: Monitor)

### Error Budget Policy
- **Acceptable downtime**: 0.5% per month (~3.6 hours)
- **Response time SLA**: < 500ms (p95)
- **Availability target**: 99.5%

### Health Checks
```bash
# Kubernetes probe example
curl http://localhost:3000/health
# Response: { "status": "OK", "timestamp": "2025-12-08T..." }
```

### Logging
Structured logs are output to `stdout` for container orchestration:
```javascript
console.log('Database connected');
console.error('Error creating loan:', error);
```

### Future: Prometheus & Grafana
```bash
# Add metrics endpoint (not yet implemented)
GET /metrics  # Prometheus format
```

Then configure:
- **Prometheus** to scrape metrics
- **Grafana** dashboards for visualization
- **Alertmanager** for Slack/email alerts

---

## 🛠️ Development Workflow

### Install Dev Dependencies
```bash
npm install nodemon --save-dev  # Auto-restart on file changes
```

### Watch Mode
```bash
npm run dev
```

### Create a Test User & Loan
```bash
# 1. Register
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"pass123"}'
# Response: { "id": 1, ... }

# 2. Apply for loan (use returned user id)
curl -X POST http://localhost:3000/api/loans \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"amount":100000,"term_months":24}'
# Response: { "id": 1, "status": "pending" }

# 3. Approve as admin
curl -X POST http://localhost:3000/api/loans/1/decision \
  -H "Content-Type: application/json" \
  -H "X-Admin: true" \
  -d '{"action":"approve"}'
# Response: { "id": 1, "status": "approved" }

# 4. Record repayment
curl -X POST http://localhost:3000/api/loans/1/repayment \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"amount":5000}'
# Response: { "id": 1, "loan_id": 1, "amount": 5000 }

# 5. View repayment history
curl -X GET http://localhost:3000/api/loans/1/repayments \
  -H "X-User-Id: 1"
# Response: [{ "id": 1, "loan_id": 1, "amount": 5000, ... }]
```

---

## 🔐 Security Notes

⚠️ **This is a demo project. For production:**

1. **Replace header-based auth** with JWT tokens:
   ```javascript
   const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
   ```

2. **Hash passwords** with bcrypt:
   ```javascript
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

3. **Add input validation** (e.g., joi):
   ```javascript
   const schema = Joi.object({
     amount: Joi.number().positive().max(1000000).required(),
     term_months: Joi.number().positive().max(360).required()
   });
   ```

4. **Use HTTPS/TLS** in production
5. **Implement rate limiting** (express-rate-limit)
6. **Add CORS** (express-cors) with strict origins

---

## 🎯 DevOps Roadmap Progress

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Plan** | ✅ Done | Scope defined, error budget = 0.5%/month |
| **Phase 2: Code** | ✅ Done | Git workflow, branch strategy, commit standards |
| **Phase 3: Build** | 🔄 Partial | Docker done; GitHub Actions CI template needed |
| **Phase 4: Test** | 🔄 Partial | Jest scaffold exists; test suite needed |
| **Phase 5: Deploy** | 📝 Planned | Kubernetes manifests, Helm charts |
| **Phase 6: Monitor** | 📝 Planned | Prometheus, Grafana, Slack alerts |

### Next Steps
- [ ] Add Jest test suite (unit + integration tests)
- [ ] Implement GitHub Actions CI workflow
- [ ] Add Dockerfile (already present; needs review)
- [ ] Create K8s manifests for production deployment
- [ ] Integrate Prometheus/Grafana for observability
- [ ] Add Slack notification for CI/CD events

---

## 📚 References

- **DevOps Roadmap**: [https://roadmap.sh/devops](https://roadmap.sh/devops)
- **Express.js Docs**: [https://expressjs.com](https://expressjs.com)
- **Docker Best Practices**: [https://docs.docker.com](https://docs.docker.com)
- **GitHub Actions**: [https://github.com/features/actions](https://github.com/features/actions)

---

## 📄 License

MIT License. See LICENSE file for details.

---

**Last Updated**: December 2025  
**Maintained by**: DevOps Learning Community
