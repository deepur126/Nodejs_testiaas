const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_REQUEST_BODY_SIZE = 1024 * 1024;
const sessions = new Map();

bootstrap();

const server = http.createServer(async (req, res) => {
  try {
    purgeExpiredSessions();

    const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
const sessions = new Map();

ensureDatabase();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method || 'GET';
    const cookies = parseCookies(req.headers.cookie || '');
    const session = cookies.sid ? sessions.get(cookies.sid) : null;
    const user = session ? getUserById(session.userId) : null;

    if (url.pathname.startsWith('/public/')) {
      return serveStatic(res, url.pathname.replace('/public/', ''));
    }

    if (method === 'GET' && url.pathname === '/') {
      return sendHtml(res, renderLayout(renderHomePage({
        errorMessage: url.searchParams.get('error') || '',
        successMessage: url.searchParams.get('success') || ''
      }), user));
      return serveStatic(req, res, url.pathname.replace('/public/', ''));
    }

    if (method === 'GET' && url.pathname === '/') {
      return sendPage(res, renderLayout(renderHomePage(url.searchParams.get('error')), user));
    }

    if (method === 'POST' && url.pathname === '/register') {
      const form = await parseForm(req);
      const validationError = validateRegistration(form);
      if (validationError) {
        return redirect(res, `/?error=${encodeURIComponent(validationError)}`);
      }

      const db = readDb();
      const email = normalizeEmail(form.email);
      if (db.users.some((candidate) => candidate.email === email)) {
        return redirect(res, '/?error=An account already exists for that email.');
      }

      const user = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email,
        passwordHash: hashPassword(form.password),
        createdAt: new Date().toISOString(),
        profile: buildProfile(form)
      };

      db.users.push(user);
      writeDb(db);
      return createSession(res, user.id, '/dashboard?success=Account created successfully.');
      const normalizedEmail = form.email.trim().toLowerCase();
      if (db.users.some((item) => item.email === normalizedEmail)) {
        return redirect(res, '/?error=Account already exists for that email.');
      }

      const userId = crypto.randomUUID();
      const userRecord = {
        id: userId,
        name: form.name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(form.password),
        profile: {
          monthlyIncomeTarget: Number(form.monthlyIncomeTarget || 0),
          monthlyBudgetTarget: Number(form.monthlyBudgetTarget || 0),
          notes: form.notes?.trim() || ''
        }
      };
      db.users.push(userRecord);
      writeDb(db);
      return createSession(res, userId);
    }

    if (method === 'POST' && url.pathname === '/login') {
      const form = await parseForm(req);
      const db = readDb();
      const email = normalizeEmail(form.email || '');
      const userRecord = db.users.find((candidate) => candidate.email === email);

      if (!userRecord || userRecord.passwordHash !== hashPassword(form.password || '')) {
        return redirect(res, '/?error=Invalid email or password.');
      }

      return createSession(res, userRecord.id, '/dashboard?success=Welcome back.');
      const normalizedEmail = (form.email || '').trim().toLowerCase();
      const found = db.users.find((item) => item.email === normalizedEmail);
      if (!found || found.passwordHash !== hashPassword(form.password || '')) {
        return redirect(res, '/?error=Invalid login details.');
      }
      return createSession(res, found.id);
    }

    if (method === 'GET' && url.pathname === '/dashboard') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
z
      const db = readDb();
      const month = sanitizeMonth(url.searchParams.get('month')) || currentMonth();
      const userTransactions = db.transactions
        .filter((item) => item.userId === user.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      const monthlyTransactions = userTransactions.filter((item) => item.month === month);
      const monthSummary = summarize(monthlyTransactions);
      const overallSummary = summarize(userTransactions);
      const monthlyRollup = buildMonthlyRollup(userTransactions);

      return sendHtml(res, renderLayout(renderDashboard({
        user,
        month,
        monthSummary,
        overallSummary,
        monthlyTransactions,
        monthlyRollup,
        insuranceCount: db.insuranceItems.filter((item) => item.userId === user.id).length,
        errorMessage: url.searchParams.get('error') || '',
        successMessage: url.searchParams.get('success') || ''
      }), user));
    }


    if (method === 'GET' && url.pathname === '/financial-items') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }

      const db = readDb();
      const items = db.insuranceItems
        .filter((item) => item.userId === user.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      return sendHtml(res, renderLayout(renderFinancialItemsPage({
        user,
        items,
        errorMessage: url.searchParams.get('error') || '',
        successMessage: url.searchParams.get('success') || ''
      }), user));
    }

    if (method === 'POST' && url.pathname === '/transactions') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError) {
        return redirectBackToDashboard(res, form.month, validationError, '');
      }

      const db = readDb();
      const userTransactions = db.transactions.filter((item) => item.userId === user.id);
      const month = url.searchParams.get('month') || currentMonth();
      const monthlyTransactions = userTransactions.filter((item) => item.month === month);
      const summary = summarize(monthlyTransactions);
      const errorMessage = url.searchParams.get('error') || '';
      return sendPage(res, renderLayout(renderDashboard(user, month, summary, monthlyTransactions, errorMessage), user));
    }

    if (method === 'POST' && url.pathname === '/transactions') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}&error=${encodeURIComponent(validationError)}`);
      }
      const db = readDb();
      db.transactions.push({
        id: crypto.randomUUID(),
        userId: user.id,
        month: form.month,
        type: form.type,
        category: form.category.trim(),
        amount: toMoney(form.amount),
        description: form.description.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      writeDb(db);
      return redirectBackToDashboard(res, form.month, '', 'Transaction saved.');
    }

    if (method === 'POST' && url.pathname === '/transactions/update') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError || !form.id) {
        return redirectBackToDashboard(res, form.month, validationError || 'Transaction not found.', '');
      }

      const db = readDb();
      const transaction = db.transactions.find((item) => item.id === form.id && item.userId === user.id);
      if (!transaction) {
        return redirectBackToDashboard(res, form.month, 'Transaction not found.', '');
      }

        amount: Number(form.amount),
        description: form.description.trim(),
        createdAt: new Date().toISOString()
      });
      writeDb(db);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}`);
    }

    if (method === 'POST' && url.pathname === '/transactions/update') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError || !form.id) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}&error=${encodeURIComponent(validationError || 'Transaction not found.')}`);
      }
      const db = readDb();
      const transaction = db.transactions.find((item) => item.id === form.id && item.userId === user.id);
      if (!transaction) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}&error=Transaction not found.`);
      }
      Object.assign(transaction, {
        month: form.month,
        type: form.type,
        category: form.category.trim(),
        amount: toMoney(form.amount),
        amount: Number(form.amount),
        description: form.description.trim(),
        updatedAt: new Date().toISOString()
      });
      writeDb(db);
      return redirectBackToDashboard(res, form.month, '', 'Transaction updated.');
    }

    if (method === 'POST' && url.pathname === '/transactions/delete') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const db = readDb();
      const beforeCount = db.transactions.length;
      db.transactions = db.transactions.filter((item) => !(item.id === form.id && item.userId === user.id));

      if (db.transactions.length === beforeCount) {
        return redirectBackToDashboard(res, form.month, 'Transaction not found.', '');
      }

      writeDb(db);
      return redirectBackToDashboard(res, form.month, '', 'Transaction deleted.');
    }

    if (method === 'POST' && url.pathname === '/insurance-items') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const validationError = validateInsuranceItem(form);
      if (validationError) {
        return redirectToFinancialItems(res, validationError, '');
      }

      const db = readDb();
      db.insuranceItems.push({
        id: crypto.randomUUID(),
        userId: user.id,
        policyType: form.policyType,
        companyName: form.companyName.trim(),
        amount: toMoney(form.amount),
        claimNumber: String(form.claimNumber || '').trim(),
        policyNumber: String(form.policyNumber || '').trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        notes: String(form.notes || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      writeDb(db);
      return redirectToFinancialItems(res, '', 'Financial item saved.');
    }

    if (method === 'POST' && url.pathname === '/insurance-items/update') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const validationError = validateInsuranceItem(form);
      if (validationError || !form.id) {
        return redirectToFinancialItems(res, validationError || 'Financial item not found.', '');
      }

      const db = readDb();
      const item = db.insuranceItems.find((entry) => entry.id === form.id && entry.userId === user.id);
      if (!item) {
        return redirectToFinancialItems(res, 'Financial item not found.', '');
      }

      Object.assign(item, {
        policyType: form.policyType,
        companyName: form.companyName.trim(),
        amount: toMoney(form.amount),
        claimNumber: String(form.claimNumber || '').trim(),
        policyNumber: String(form.policyNumber || '').trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        notes: String(form.notes || '').trim(),
        updatedAt: new Date().toISOString()
      });
      writeDb(db);
      return redirectToFinancialItems(res, '', 'Financial item updated.');
    }

    if (method === 'POST' && url.pathname === '/insurance-items/delete') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const db = readDb();
      const beforeCount = db.insuranceItems.length;
      db.insuranceItems = db.insuranceItems.filter((entry) => !(entry.id === form.id && entry.userId === user.id));
      if (db.insuranceItems.length === beforeCount) {
        return redirectToFinancialItems(res, 'Financial item not found.', '');
      }
      writeDb(db);
      return redirectToFinancialItems(res, '', 'Financial item deleted.');
    }

    if (method === 'POST' && url.pathname === '/profile') {
      const auth = requireUser(user, res);
      if (!auth) return;

      const form = await parseForm(req);
      const db = readDb();
      const dbUser = db.users.find((item) => item.id === user.id);
      dbUser.profile = buildProfile(form);
      dbUser.updatedAt = new Date().toISOString();
      writeDb(db);
      return redirectBackToDashboard(res, form.month, '', 'Financial details saved.');
    }

    if (method === 'POST' && url.pathname === '/logout') {
      if (cookies.sid) sessions.delete(cookies.sid);
      return redirect(res, '/?success=Logged out successfully.', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    }

    return sendNotFound(res);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}`);
    }

    if (method === 'POST' && url.pathname === '/profile') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const db = readDb();
      const dbUser = db.users.find((item) => item.id === user.id);
      dbUser.profile = {
        monthlyIncomeTarget: Number(form.monthlyIncomeTarget || 0),
        monthlyBudgetTarget: Number(form.monthlyBudgetTarget || 0),
        notes: form.notes?.trim() || ''
      };
      writeDb(db);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}`);
    }

    if (method === 'POST' && url.pathname === '/logout') {
      if (cookies.sid) {
        sessions.delete(cookies.sid);
      }
      res.writeHead(302, {
        'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0',
        Location: '/'
      });
      return res.end();
    }

    sendNotFound(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLayout(`<section class="card"><h1>Server error</h1><p>${escapeHtml(error.message)}</p></section>`));
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function bootstrap() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    writeDb({ users: [], transactions: [], insuranceItems: [] });
function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    writeDb({ users: [], transactions: [] });
  }
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, DB_PATH);
}

function parseCookies(header) {
  return header.split(';').reduce((result, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (key) result[key] = decodeURIComponent(rest.join('='));
    return result;
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUserById(id) {
  const db = readDb();
  return db.users.find((item) => item.id === id) || null;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_REQUEST_BODY_SIZE) {
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const result = {};
      for (const [key, value] of params.entries()) result[key] = value;
      resolve(result);
    });
    req.on('error', reject);
  });
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function redirect(res, location, cookie) {
  const headers = { Location: location };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(302, headers);
  res.end();
}

function serveStatic(res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    return sendNotFound(res);
  }

  const contentType = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  }[path.extname(filePath)] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createSession(res, userId) {
  const sid = crypto.randomUUID();
  sessions.set(sid, { userId, createdAt: Date.now() });
  res.writeHead(302, {
    'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=86400`,
    Location: '/dashboard'
  });
  res.end();
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendPage(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderLayout('<section class="card"><h1>404</h1><p>Page not found.</p></section>'));
}

function requireUser(user, res) {
  if (!user) {
    redirect(res, '/?error=Please log in first.');
    return false;
  }
  return true;
}

function createSession(res, userId, location) {
  const sid = crypto.randomUUID();
  sessions.set(sid, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return redirect(res, location, `sid=${sid}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`);
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(sid);
  }
}

function getUserById(id) {
  return readDb().users.find((user) => user.id === id) || null;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password) {
  return crypto.pbkdf2Sync(String(password), 'financeflow-local-salt', 100000, 64, 'sha512').toString('hex');
}

function buildProfile(form) {
  return {
    monthlyIncomeTarget: Math.max(0, toMoney(form.monthlyIncomeTarget || 0)),
    monthlyBudgetTarget: Math.max(0, toMoney(form.monthlyBudgetTarget || 0)),
    notes: String(form.notes || '').trim()
  };
}

function validateRegistration(form) {
  if (!String(form.name || '').trim()) return 'Name is required.';
  if (!normalizeEmail(form.email).match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'A valid email is required.';
  if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters long.';
function serveStatic(req, res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    return sendNotFound(res);
  }
  const ext = path.extname(filePath);
  const types = { '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function validateRegistration(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (!form.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'A valid email is required.';
  if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

function validateTransaction(form) {
  if (!sanitizeMonth(form.month)) return 'Month is required in YYYY-MM format.';
  if (!['income', 'expense'].includes(form.type)) return 'Type must be income or expense.';
  if (!String(form.category || '').trim()) return 'Category is required.';
  if (!String(form.description || '').trim()) return 'Description is required.';
  if (!/^\d{4}-\d{2}$/.test(form.month || '')) return 'Month is required in YYYY-MM format.';
  if (!['income', 'expense'].includes(form.type)) return 'Type must be income or expense.';
  if (!form.category?.trim()) return 'Category is required.';
  if (!form.description?.trim()) return 'Description is required.';
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
  return '';
}

function validateInsuranceItem(form) {
  if (!['term', 'life', 'health', 'motor', 'property'].includes(String(form.policyType || ''))) return 'Please choose a valid insurance type.';
  if (!String(form.companyName || '').trim()) return 'Company name is required.';
  if (!String(form.startDate || '').match(/^\d{4}-\d{2}-\d{2}$/)) return 'Start date is required.';
  if (!String(form.endDate || '').match(/^\d{4}-\d{2}-\d{2}$/)) return 'End date is required.';
  if (String(form.endDate) < String(form.startDate)) return 'End date cannot be earlier than start date.';
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
  return '';
}

function sanitizeMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function toMoney(value) {
  return Number(Number(value).toFixed(2));
}

function summarize(transactions) {
  return transactions.reduce((summary, item) => {
    if (item.type === 'income') summary.income += item.amount;
    if (item.type === 'expense') summary.expense += item.amount;
    summary.balance = summary.income - summary.expense;
    return summary;
  }, { income: 0, expense: 0, balance: 0 });
}

function buildMonthlyRollup(transactions) {
  const months = new Map();
  for (const item of transactions) {
    if (!months.has(item.month)) months.set(item.month, []);
    months.get(item.month).push(item);
  }

  return [...months.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, items]) => ({ month, ...summarize(items), count: items.length }));
}

function redirectBackToDashboard(res, month, errorMessage, successMessage) {
  const targetMonth = sanitizeMonth(month) || currentMonth();
  const query = new URLSearchParams({ month: targetMonth });
  if (errorMessage) query.set('error', errorMessage);
  if (successMessage) query.set('success', successMessage);
  return redirect(res, `/dashboard?${query.toString()}`);
}

function renderLayout(content, user = null) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FinanceFlow</title>
    <link rel="stylesheet" href="/public/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div>
        <span class="brand">FinanceFlow</span>
        <p class="tagline">Finance starter app for later IaC hosting with Ansible, Terraform, Docker, or DevOps pipelines.</p>
      </div>
      ${user ? `<form method="post" action="/logout"><button class="ghost-button" type="submit">Logout</button></form>` : '<span class="badge">Local JSON DB</span>'}
    </header>
    <main>${content}</main>
  </body>
</html>`;
}

function renderHomePage({ errorMessage, successMessage }) {
  return `
    <section class="hero-grid">
      <section class="card intro-card">
        <p class="eyebrow">Simple Node.js website</p>
        <h1>Manage user accounts and track monthly earnings from one dashboard.</h1>
        <p>Create a new account with your name and email, then log in to manage financial details, earnings, and expenditure month by month.</p>
        ${renderMessage(errorMessage, 'error')}
        ${renderMessage(successMessage, 'success')}
        <ul class="feature-list">
          <li>New user signup with local persistence</li>
          <li>Existing user login with secure hashed passwords</li>
          <li>Monthly dashboard with income, expense, and balance</li>
          <li>Edit or delete saved transactions later</li>
        </ul>
      </section>

      <section class="auth-column">
        <section class="card">
          <h2>Existing user login</h2>
          <form method="post" action="/login" class="stack">
            <label>Email<input type="email" name="email" placeholder="you@example.com" required /></label>
            <label>Password<input type="password" name="password" placeholder="••••••••" required /></label>
            <button type="submit">Login</button>
          </form>
        </section>

        <section class="card">
          <h2>Create account</h2>
          <form method="post" action="/register" class="stack">
            <label>Full name<input type="text" name="name" placeholder="Aman Kumar" required /></label>
            <label>Email<input type="email" name="email" placeholder="aman@example.com" required /></label>
            <label>Password<input type="password" name="password" minlength="6" required /></label>
            <label>Monthly income target<input type="number" step="0.01" min="0" name="monthlyIncomeTarget" value="0" /></label>
            <label>Monthly budget target<input type="number" step="0.01" min="0" name="monthlyBudgetTarget" value="0" /></label>
            <label>Financial notes<textarea name="notes" rows="3" placeholder="Savings goals, EMI reminders, or account notes"></textarea></label>
            <button type="submit">Create account</button>
          </form>
        </section>
      </section>
    </section>`;
}

function redirectToFinancialItems(res, errorMessage, successMessage) {
  const query = new URLSearchParams();
  if (errorMessage) query.set('error', errorMessage);
  if (successMessage) query.set('success', successMessage);
  const suffix = query.toString();
  return redirect(res, `/financial-items${suffix ? `?${suffix}` : ''}`);
}

function renderDashboard({ user, month, monthSummary, overallSummary, monthlyTransactions, monthlyRollup, insuranceCount, errorMessage, successMessage }) {
  const profile = user.profile || {};
  const transactionRows = monthlyTransactions.length
    ? monthlyTransactions.map((item) => `
      <tr>
        <td>${escapeHtml(item.category)}</td>
        <td><span class="pill ${item.type}">${escapeHtml(item.type)}</span></td>
        <td>$${item.amount.toFixed(2)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${formatDate(item.updatedAt || item.createdAt)}</td>
function summarize(transactions) {
  return transactions.reduce((acc, item) => {
    if (item.type === 'income') acc.income += item.amount;
    if (item.type === 'expense') acc.expense += item.amount;
    acc.balance = acc.income - acc.expense;
    return acc;
  }, { income: 0, expense: 0, balance: 0 });
}

function renderLayout(content, user = null) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>FinanceFlow</title>
      <link rel="stylesheet" href="/public/styles.css" />
    </head>
    <body>
      <header class="topbar">
        <div>
          <span class="brand">FinanceFlow</span>
          <p class="tagline">Simple Node.js finance portal for future IaC hosting workflows.</p>
        </div>
        ${user ? `<form method="post" action="/logout"><button class="ghost-button" type="submit">Logout</button></form>` : '<span class="badge">Local JSON DB</span>'}
      </header>
      <main>${content}</main>
    </body>
  </html>`;
}

function renderHomePage(errorMessage) {
  return `
    <section class="hero">
      <div class="intro card">
        <h1>Login or create your account</h1>
        <p>New users can create an account with name and email, and existing users can log in to access a month-wise financial dashboard.</p>
        ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
      </div>
      <div class="auth-grid">
        <section class="card">
          <h2>Existing user login</h2>
          <form method="post" action="/login" class="stack">
            <label>Email<input type="email" name="email" required /></label>
            <label>Password<input type="password" name="password" required /></label>
            <button type="submit">Login</button>
          </form>
        </section>
        <section class="card">
          <h2>New user signup</h2>
          <form method="post" action="/register" class="stack">
            <label>Full name<input type="text" name="name" required /></label>
            <label>Email<input type="email" name="email" required /></label>
            <label>Password<input type="password" name="password" minlength="6" required /></label>
            <label>Monthly income target<input type="number" step="0.01" name="monthlyIncomeTarget" value="0" /></label>
            <label>Monthly budget target<input type="number" step="0.01" name="monthlyBudgetTarget" value="0" /></label>
            <label>Financial notes<textarea name="notes" rows="3" placeholder="Savings goal, loan reminder, etc."></textarea></label>
            <button type="submit">Create account</button>
          </form>
        </section>
      </div>
    </section>`;
}

function renderDashboard(user, month, summary, transactions, errorMessage) {
  const transactionRows = transactions.length ? transactions.map((item) => `
      <tr>
        <td>${escapeHtml(item.month)}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>$${item.amount.toFixed(2)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>
          <details>
            <summary>Edit</summary>
            <form method="post" action="/transactions/update" class="stack compact-form">
              <input type="hidden" name="id" value="${item.id}" />
              <label>Month<input type="month" name="month" value="${item.month}" required /></label>
              <label>Type
                <select name="type">
                  <option value="income" ${item.type === 'income' ? 'selected' : ''}>Income</option>
                  <option value="expense" ${item.type === 'expense' ? 'selected' : ''}>Expense</option>
                </select>
              </label>
              <label>Category<input type="text" name="category" value="${escapeHtml(item.category)}" required /></label>
              <label>Amount<input type="number" step="0.01" min="0.01" name="amount" value="${item.amount}" required /></label>
              <label>Description<input type="text" name="description" value="${escapeHtml(item.description)}" required /></label>
              <div class="form-actions">
                <button type="submit">Save changes</button>
              </div>
            </form>
            <form method="post" action="/transactions/delete" class="inline-delete">
              <input type="hidden" name="id" value="${item.id}" />
              <input type="hidden" name="month" value="${item.month}" />
              <button type="submit" class="danger-button">Delete</button>
            </form>
          </details>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6">No transactions saved for this month yet.</td></tr>';

  const monthlyCards = monthlyRollup.length
    ? monthlyRollup.map((entry) => `
      <article class="mini-stat">
        <h3>${escapeHtml(entry.month)}</h3>
        <p>Income: <strong>$${entry.income.toFixed(2)}</strong></p>
        <p>Expense: <strong>$${entry.expense.toFixed(2)}</strong></p>
        <p>Balance: <strong>$${entry.balance.toFixed(2)}</strong></p>
        <p>Transactions: <strong>${entry.count}</strong></p>
      </article>`).join('')
    : '<p class="muted">No monthly history yet. Add your first transaction below.</p>';

  return `
    <section class="dashboard-shell">
      <section class="card wide hero-panel">
        <div class="section-title">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1>Welcome, ${escapeHtml(user.name)}</h1>
            <p>Monitor one month at a time while keeping your full financial details stored in one place.</p>
            ${renderMessage(errorMessage, 'error')}
            ${renderMessage(successMessage, 'success')}
          </div>
          <form method="get" action="/dashboard" class="inline-form">
            <label>Month view<input type="month" name="month" value="${month}" /></label>
            <button type="submit">Load month</button>
          </form>
        </div>
        <div class="stats-grid">
          ${renderStatCard('This month income', monthSummary.income, 'income')}
          ${renderStatCard('This month expense', monthSummary.expense, 'expense')}
          ${renderStatCard('This month balance', monthSummary.balance, 'balance')}
          ${renderStatCard('Overall balance', overallSummary.balance, 'neutral')}
              <label>Amount<input type="number" step="0.01" name="amount" value="${item.amount}" required /></label>
              <label>Description<input type="text" name="description" value="${escapeHtml(item.description)}" required /></label>
              <button type="submit">Save changes</button>
            </form>
          </details>
        </td>
      </tr>`).join('') : '<tr><td colspan="6">No transactions saved for this month yet.</td></tr>';

  return `
    <section class="dashboard-grid">
      <section class="card wide">
        <div class="section-title">
          <div>
            <h1>Welcome, ${escapeHtml(user.name)}</h1>
            <p>Track monthly earnings and expenditure from a single place.</p>
            ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
          </div>
          <form method="get" action="/dashboard" class="inline-form">
            <label>Month view<input type="month" name="month" value="${month}" /></label>
            <button type="submit">Load</button>
          </form>
        </div>
        <div class="stats">
          <article class="stat income"><span>Income</span><strong>$${summary.income.toFixed(2)}</strong></article>
          <article class="stat expense"><span>Expense</span><strong>$${summary.expense.toFixed(2)}</strong></article>
          <article class="stat balance"><span>Balance</span><strong>$${summary.balance.toFixed(2)}</strong></article>
        </div>
      </section>

      <section class="card">
        <h2>Add transaction</h2>
        <form method="post" action="/transactions" class="stack">
          <label>Month<input type="month" name="month" value="${month}" required /></label>
          <label>Type
            <select name="type">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label>Category<input type="text" name="category" placeholder="Salary, Groceries, Rent" required /></label>
          <label>Amount<input type="number" step="0.01" min="0.01" name="amount" required /></label>
          <label>Description<input type="text" name="description" placeholder="Salary payment or grocery spend" required /></label>
          <label>Category<input type="text" name="category" placeholder="Salary, Food, Rent" required /></label>
          <label>Amount<input type="number" step="0.01" name="amount" required /></label>
          <label>Description<input type="text" name="description" placeholder="Monthly salary / grocery bill" required /></label>
          <button type="submit">Save transaction</button>
        </form>
      </section>

      <section class="card">
        <h2>Financial details</h2>
        <form method="post" action="/profile" class="stack">
          <a class="text-link" href="/financial-items">Open financial items page (${insuranceCount} saved)</a>
          <input type="hidden" name="month" value="${month}" />
          <label>Monthly income target<input type="number" step="0.01" min="0" name="monthlyIncomeTarget" value="${profile.monthlyIncomeTarget || 0}" /></label>
          <label>Monthly budget target<input type="number" step="0.01" min="0" name="monthlyBudgetTarget" value="${profile.monthlyBudgetTarget || 0}" /></label>
          <label>Financial notes<textarea name="notes" rows="5">${escapeHtml(profile.notes || '')}</textarea></label>
          <input type="hidden" name="month" value="${month}" />
          <label>Monthly income target<input type="number" step="0.01" name="monthlyIncomeTarget" value="${user.profile?.monthlyIncomeTarget || 0}" /></label>
          <label>Monthly budget target<input type="number" step="0.01" name="monthlyBudgetTarget" value="${user.profile?.monthlyBudgetTarget || 0}" /></label>
          <label>Financial notes<textarea name="notes" rows="4">${escapeHtml(user.profile?.notes || '')}</textarea></label>
          <button type="submit">Save financial details</button>
        </form>
      </section>

      <section class="card wide">
        <h2>Monthly overview</h2>
        <div class="mini-stat-grid">${monthlyCards}</div>
      </section>

      <section class="card wide">
        <h2>Transactions for ${escapeHtml(month)}</h2>
        <table>
          <thead>
            <tr><th>Category</th><th>Type</th><th>Amount</th><th>Description</th><th>Updated</th><th>Actions</th></tr>
        <h2>Transaction history</h2>
        <table>
          <thead>
            <tr><th>Month</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th><th>Edit</th></tr>
          </thead>
          <tbody>${transactionRows}</tbody>
        </table>
      </section>
    </section>`;
}

function renderStatCard(label, amount, tone) {
  return `<article class="stat ${tone}"><span>${escapeHtml(label)}</span><strong>$${amount.toFixed(2)}</strong></article>`;
}

function renderMessage(message, type) {
  if (!message) return '';
  return `<p class="message ${type}">${escapeHtml(message)}</p>`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function renderFinancialItemsPage({ user, items, errorMessage, successMessage }) {
  const rows = items.length
    ? items.map((item) => `
      <tr>
        <td>${escapeHtml(capitalize(item.policyType))}</td>
        <td>${escapeHtml(item.companyName)}</td>
        <td>${escapeHtml(item.policyNumber || '-')}</td>
        <td>${escapeHtml(item.claimNumber || '-')}</td>
        <td>$${item.amount.toFixed(2)}</td>
        <td>${escapeHtml(item.startDate)} → ${escapeHtml(item.endDate)}</td>
        <td>
          <details>
            <summary>Edit</summary>
            <form method="post" action="/insurance-items/update" class="stack compact-form">
              <input type="hidden" name="id" value="${item.id}" />
              ${renderInsuranceFormFields(item)}
              <button type="submit">Save financial item</button>
            </form>
            <form method="post" action="/insurance-items/delete" class="inline-delete">
              <input type="hidden" name="id" value="${item.id}" />
              <button type="submit" class="danger-button">Delete</button>
            </form>
          </details>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7">No financial items saved yet.</td></tr>';

  return `
    <section class="dashboard-shell">
      <section class="card wide hero-panel">
        <div class="section-title">
          <div>
            <p class="eyebrow">Financial items</p>
            <h1>Insurance and policy details for ${escapeHtml(user.name)}</h1>
            <p>Store term, life, health, motor, and property insurance details with company name, dates, amount, and claim number.</p>
            ${renderMessage(errorMessage, 'error')}
            ${renderMessage(successMessage, 'success')}
          </div>
          <a class="ghost-link" href="/dashboard">Back to dashboard</a>
        </div>
      </section>

      <section class="card">
        <h2>Add financial item</h2>
        <form method="post" action="/insurance-items" class="stack">
          ${renderInsuranceFormFields()}
          <button type="submit">Save financial item</button>
        </form>
      </section>

      <section class="card wide">
        <h2>Saved insurance / financial items</h2>
        <table>
          <thead>
            <tr><th>Type</th><th>Company</th><th>Policy #</th><th>Claim #</th><th>Amount</th><th>Coverage dates</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </section>`;
}

function renderInsuranceFormFields(item = {}) {
  const policyType = item.policyType || 'term';
  return `
    <label>Insurance type
      <select name="policyType">
        <option value="term" ${policyType === 'term' ? 'selected' : ''}>Term</option>
        <option value="life" ${policyType === 'life' ? 'selected' : ''}>Life</option>
        <option value="health" ${policyType === 'health' ? 'selected' : ''}>Health</option>
        <option value="motor" ${policyType === 'motor' ? 'selected' : ''}>Motor</option>
        <option value="property" ${policyType === 'property' ? 'selected' : ''}>Property</option>
      </select>
    </label>
    <label>Company name<input type="text" name="companyName" value="${escapeHtml(item.companyName || '')}" required /></label>
    <label>Policy number<input type="text" name="policyNumber" value="${escapeHtml(item.policyNumber || '')}" /></label>
    <label>Claim number<input type="text" name="claimNumber" value="${escapeHtml(item.claimNumber || '')}" /></label>
    <label>Amount<input type="number" step="0.01" min="0.01" name="amount" value="${item.amount || ''}" required /></label>
    <label>Start date<input type="date" name="startDate" value="${escapeHtml(item.startDate || '')}" required /></label>
    <label>End date<input type="date" name="endDate" value="${escapeHtml(item.endDate || '')}" required /></label>
    <label>Notes<textarea name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea></label>`;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
