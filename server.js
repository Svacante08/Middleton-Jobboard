const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'middleton-brushpass-secret-2025';
const DB_PATH = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory data store (persisted to JSON) ──────────────────────────────────
let db = {
  users: [],
  jobs: [],
  bids: []
};

function loadDb() {
  if (fs.existsSync(DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e) {}
  }
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function seed() {
  if (db.users.length) return;

  // Seed admin
  db.users.push({
    id: 1, email: 'stephen@middletonpainting.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Stephen Vacante', role: 'admin', company: 'Middleton Painting',
    approved: true, createdAt: new Date().toISOString()
  });

  // Seed contractors
  const crews = [
    { email: 'crew@profinish.com', password: 'crew123', name: 'Mike Torres', company: 'ProFinish Painting', rating: 5 },
    { email: 'crew@midsouth.com', password: 'crew123', name: 'James Reed', company: 'MidSouth Crews', rating: 4 },
    { email: 'crew@truecoat.com', password: 'crew123', name: 'Derek Hall', company: 'TrueCoat Memphis', rating: 4 },
  ];
  crews.forEach((c, i) => {
    db.users.push({
      id: i + 2, email: c.email,
      password: bcrypt.hashSync(c.password, 10),
      name: c.name, role: 'contractor', company: c.company,
      rating: c.rating, approved: true, createdAt: new Date().toISOString()
    });
  });

  // Seed jobs
  const jobData = [
    { title: 'Exterior repaint — full 2-story', customer: 'Henderson', neighborhood: 'Germantown', type: 'Exterior', price: 4200, startDate: '2025-06-23', deadline: '2025-06-14', status: 'open', scope: ['Prep and paint siding — front, right, and back', 'Prep and paint all trim and fascia', 'Caulk all penetrations and gaps', 'Prep and paint soffit — full perimeter', '2 coats throughout'] },
    { title: 'Interior — master bed, living, kitchen', customer: 'Williams', neighborhood: 'East Memphis', type: 'Interior', price: 2800, startDate: '2025-06-19', deadline: '2025-06-13', status: 'open', scope: ['Prep and paint walls — master bedroom', 'Prep and paint walls — living room', 'Prep and paint walls and ceiling — kitchen', 'Prep and paint all doors and trim', '2 coats on all surfaces'] },
    { title: 'Deck stain + privacy fence', customer: 'Thweatt', neighborhood: 'Collierville', type: 'Deck / Fence', price: 1900, startDate: '2025-06-26', deadline: '2025-06-16', status: 'open', scope: ['Prep and stain deck — approx 400 SF', 'Prep and stain privacy fence — approx 120 LF', 'Solid stain color per customer spec', '1 coat stain over cleaned surface'] },
    { title: 'Full exterior — trim and accents only', customer: 'Kowalski', neighborhood: 'Bartlett', type: 'Exterior', price: 3500, startDate: '2025-07-07', deadline: '2025-06-20', status: 'open', scope: ['Prep and paint trim, fascia, and soffits', 'Prep and paint front door and shutters', 'Prep and paint garage door', '2 coats on all painted surfaces'] },
    { title: 'Interior — whole house repaint', customer: 'Patel', neighborhood: 'Cordova', type: 'Interior', price: 5100, startDate: '2025-07-14', deadline: '2025-06-22', status: 'open', scope: ['Prep and paint all walls — 4 bed, 2.5 bath', 'Prep and paint all ceilings', 'Prep and paint all doors and trim', 'Prep and paint staircase railing and spindles', '2 coats walls, 1 coat ceiling white'] },
    { title: 'Cabinet repaint — kitchen and island', customer: 'Nguyen', neighborhood: 'Germantown', type: 'Cabinet', price: 2400, startDate: '2025-07-02', deadline: '2025-06-18', status: 'awarded', awardedTo: 2, scope: ['Remove all cabinet doors and hardware', 'Prep, sand, and prime cabinet boxes and doors', 'Paint all surfaces — 2 coats', 'Reinstall doors and hardware', 'Color: SW Alabaster'] },
  ];

  jobData.forEach((j, i) => {
    db.jobs.push({ id: i + 1, ...j, postedAt: new Date().toISOString(), postedBy: 1 });
  });

  // Seed some bids
  db.bids.push(
    { id: 1, jobId: 1, contractorId: 2, amount: 2940, note: 'Ready to start on the confirmed date. 5-year exterior paint warranty.', createdAt: new Date().toISOString() },
    { id: 2, jobId: 1, contractorId: 3, amount: 3100, note: 'Full crew of 3. Can complete in 2 days.', createdAt: new Date().toISOString() },
    { id: 3, jobId: 2, contractorId: 4, amount: 1960, note: 'Interior specialist. Can start Jun 19.', createdAt: new Date().toISOString() },
    { id: 4, jobId: 4, contractorId: 4, amount: 2450, note: 'Trim work only — tidy and efficient.', createdAt: new Date().toISOString() },
    { id: 5, jobId: 4, contractorId: 2, amount: 2625, note: 'Full exterior trim team available.', createdAt: new Date().toISOString() },
    { id: 6, jobId: 6, contractorId: 2, amount: 1680, note: 'Cabinet specialist crew. 3-day turnaround.', createdAt: new Date().toISOString() }
  );

  saveDb();
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.approved)
    return res.status(403).json({ error: 'Account pending approval' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, company: user.company }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company } });
});

app.post('/api/register', (req, res) => {
  const { email, password, name, company } = req.body;
  if (!email || !password || !name || !company) return res.status(400).json({ error: 'All fields required' });
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'Email already registered' });
  const user = { id: Date.now(), email, password: bcrypt.hashSync(password, 10), name, company, role: 'contractor', approved: false, rating: 0, createdAt: new Date().toISOString() };
  db.users.push(user);
  saveDb();
  res.json({ message: 'Account created. Awaiting admin approval.' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// ── Jobs routes ───────────────────────────────────────────────────────────────
app.get('/api/jobs', authMiddleware, (req, res) => {
  const { type, status, q } = req.query;
  let jobs = [...db.jobs];
  if (type) jobs = jobs.filter(j => j.type === type);
  if (status) jobs = jobs.filter(j => j.status === status);
  if (q) { const lq = q.toLowerCase(); jobs = jobs.filter(j => (j.title + j.customer + j.neighborhood).toLowerCase().includes(lq)); }

  // Attach bid counts; contractors don't see customer names
  jobs = jobs.map(j => {
    const bids = db.bids.filter(b => b.jobId === j.id);
    const base = { ...j, bidCount: bids.length };
    if (req.user.role === 'contractor') {
      const { customer, ...pub } = base;
      const myBid = bids.find(b => b.contractorId === req.user.id);
      return { ...pub, myBid: myBid || null };
    }
    return { ...base, bids: bids.map(b => {
      const contractor = db.users.find(u => u.id === b.contractorId);
      return { ...b, contractorName: contractor?.name, contractorCompany: contractor?.company, contractorRating: contractor?.rating };
    })};
  });

  res.json(jobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)));
});

app.get('/api/jobs/:id', authMiddleware, (req, res) => {
  const job = db.jobs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const bids = db.bids.filter(b => b.jobId === job.id).map(b => {
    const contractor = db.users.find(u => u.id === b.contractorId);
    return { ...b, contractorName: contractor?.name, contractorCompany: contractor?.company, contractorRating: contractor?.rating };
  });
  res.json({ ...job, bids });
});

app.post('/api/jobs', authMiddleware, adminOnly, (req, res) => {
  const { title, customer, neighborhood, type, price, startDate, deadline, scope } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price required' });
  const job = { id: Date.now(), title, customer, neighborhood, type, price: parseInt(price), startDate, deadline, scope: Array.isArray(scope) ? scope : [scope], status: 'open', postedAt: new Date().toISOString(), postedBy: req.user.id };
  db.jobs.push(job);
  saveDb();
  res.json(job);
});

app.patch('/api/jobs/:id', authMiddleware, adminOnly, (req, res) => {
  const idx = db.jobs.findIndex(j => j.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.jobs[idx] = { ...db.jobs[idx], ...req.body };
  saveDb();
  res.json(db.jobs[idx]);
});

app.delete('/api/jobs/:id', authMiddleware, adminOnly, (req, res) => {
  db.jobs = db.jobs.filter(j => j.id !== parseInt(req.params.id));
  db.bids = db.bids.filter(b => b.jobId !== parseInt(req.params.id));
  saveDb();
  res.json({ ok: true });
});

// ── Bids routes ───────────────────────────────────────────────────────────────
app.post('/api/jobs/:id/bids', authMiddleware, (req, res) => {
  if (req.user.role !== 'contractor') return res.status(403).json({ error: 'Contractors only' });
  const jobId = parseInt(req.params.id);
  const job = db.jobs.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'awarded') return res.status(400).json({ error: 'Job already awarded' });
  const existing = db.bids.find(b => b.jobId === jobId && b.contractorId === req.user.id);
  if (existing) return res.status(409).json({ error: 'You already have a bid on this job' });
  const { amount, note } = req.body;
  if (!amount || amount < 100) return res.status(400).json({ error: 'Invalid bid amount' });
  const bid = { id: Date.now(), jobId, contractorId: req.user.id, amount: parseInt(amount), note: note || '', createdAt: new Date().toISOString() };
  db.bids.push(bid);
  saveDb();
  res.json(bid);
});

app.post('/api/jobs/:id/award/:bidId', authMiddleware, adminOnly, (req, res) => {
  const jobIdx = db.jobs.findIndex(j => j.id === parseInt(req.params.id));
  if (jobIdx === -1) return res.status(404).json({ error: 'Job not found' });
  const bid = db.bids.find(b => b.id === parseInt(req.params.bidId));
  if (!bid) return res.status(404).json({ error: 'Bid not found' });
  const contractor = db.users.find(u => u.id === bid.contractorId);
  db.jobs[jobIdx].status = 'awarded';
  db.jobs[jobIdx].awardedTo = bid.contractorId;
  db.jobs[jobIdx].awardedToName = contractor?.name;
  db.jobs[jobIdx].awardedBidId = bid.id;
  db.jobs[jobIdx].awardedAmount = bid.amount;
  saveDb();
  res.json(db.jobs[jobIdx]);
});

// ── Admin: users ──────────────────────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  res.json(db.users.map(({ password: _, ...u }) => u));
});

app.patch('/api/admin/users/:id/approve', authMiddleware, adminOnly, (req, res) => {
  const user = db.users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.approved = true;
  saveDb();
  res.json({ ok: true });
});

// ── Serve frontend ────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

loadDb();
seed();
app.listen(PORT, '0.0.0.0', () => console.log(`BrushPass running on port ${PORT}`));
