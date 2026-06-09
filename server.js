const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'brushpass-secret-2025';
const CCAM_TOKEN = process.env.COMPANYCAM_TOKEN || '';
const DB_PATH = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Data store ────────────────────────────────────────────────────────────────
let db = { users: [], jobs: [], bids: [] };

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
  db.users.push({
    id: 1, email: 'stephen@middletonpainting.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Stephen Vacante', role: 'admin', company: 'BrushPass',
    approved: true, createdAt: new Date().toISOString()
  });
  const crews = [
    { email: 'crew@profinish.com', password: 'crew123', name: 'Mike Torres', company: 'ProFinish Painting', rating: 5 },
    { email: 'crew@midsouth.com',  password: 'crew123', name: 'James Reed',  company: 'MidSouth Crews',    rating: 4 },
    { email: 'crew@truecoat.com',  password: 'crew123', name: 'Derek Hall',  company: 'TrueCoat Memphis',  rating: 4 },
  ];
  crews.forEach((c, i) => {
    db.users.push({ id: i + 2, email: c.email, password: bcrypt.hashSync(c.password, 10),
      name: c.name, role: 'contractor', company: c.company, rating: c.rating,
      approved: true, createdAt: new Date().toISOString() });
  });
  const jobData = [
    { title: 'Exterior repaint — full 2-story', customer: 'Henderson', neighborhood: 'Germantown', type: 'Exterior', price: 4200, startDate: '2025-06-23', deadline: '2025-06-14', status: 'open', scope: ['Prep and paint siding — front, right, and back', 'Prep and paint all trim and fascia', 'Caulk all penetrations', '2 coats throughout'], photos: [] },
    { title: 'Interior — master bed, living, kitchen', customer: 'Williams', neighborhood: 'East Memphis', type: 'Interior', price: 2800, startDate: '2025-06-19', deadline: '2025-06-13', status: 'open', scope: ['Prep and paint walls — master bedroom', 'Prep and paint walls — living room', 'Prep and paint walls and ceiling — kitchen', '2 coats on all surfaces'], photos: [] },
    { title: 'Deck stain + privacy fence', customer: 'Thweatt', neighborhood: 'Collierville', type: 'Deck / Fence', price: 1900, startDate: '2025-06-26', deadline: '2025-06-16', status: 'open', scope: ['Prep and stain deck — approx 400 SF', 'Prep and stain privacy fence — approx 120 LF', '1 coat stain over cleaned surface'], photos: [] },
    { title: 'Full exterior — trim and accents only', customer: 'Kowalski', neighborhood: 'Bartlett', type: 'Exterior', price: 3500, startDate: '2025-07-07', deadline: '2025-06-20', status: 'open', scope: ['Prep and paint trim, fascia, and soffits', 'Prep and paint front door and shutters', '2 coats on all painted surfaces'], photos: [] },
    { title: 'Interior — whole house repaint', customer: 'Patel', neighborhood: 'Cordova', type: 'Interior', price: 5100, startDate: '2025-07-14', deadline: '2025-06-22', status: 'open', scope: ['Prep and paint all walls — 4 bed, 2.5 bath', 'Prep and paint all ceilings', 'Prep and paint all doors and trim', '2 coats walls, 1 coat ceiling white'], photos: [] },
  ];
  jobData.forEach((j, i) => {
    db.jobs.push({ id: i + 1, ...j, postedAt: new Date().toISOString(), postedBy: 1 });
  });
  db.bids.push(
    { id: 1, jobId: 1, contractorId: 2, amount: 2940, note: 'Ready to start on confirmed date. 5-year warranty.', createdAt: new Date().toISOString() },
    { id: 2, jobId: 1, contractorId: 3, amount: 3100, note: 'Full crew of 3. Can complete in 2 days.', createdAt: new Date().toISOString() },
    { id: 3, jobId: 2, contractorId: 4, amount: 1960, note: 'Interior specialist. Can start Jun 19.', createdAt: new Date().toISOString() }
  );
  saveDb();
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
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
  if (!user.approved) return res.status(403).json({ error: 'Account pending approval' });
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

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// ── Jobs ──────────────────────────────────────────────────────────────────────
app.get('/api/jobs', authMiddleware, (req, res) => {
  const { type, status, q } = req.query;
  let jobs = [...db.jobs];
  if (type) jobs = jobs.filter(j => j.type === type);
  if (status) jobs = jobs.filter(j => j.status === status);
  if (q) { const lq = q.toLowerCase(); jobs = jobs.filter(j => (j.title + j.customer + j.neighborhood).toLowerCase().includes(lq)); }
  jobs = jobs.map(j => {
    const bids = db.bids.filter(b => b.jobId === j.id);
    const base = { ...j, bidCount: bids.length };
    if (req.user.role === 'contractor') {
      const { customer, ...pub } = base;
      return { ...pub, myBid: bids.find(b => b.contractorId === req.user.id) || null };
    }
    return { ...base, bids: bids.map(b => {
      const c = db.users.find(u => u.id === b.contractorId);
      return { ...b, contractorName: c?.name, contractorCompany: c?.company, contractorRating: c?.rating };
    })};
  });
  res.json(jobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)));
});

app.get('/api/jobs/:id', authMiddleware, (req, res) => {
  const job = db.jobs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Not found' });
  const bids = db.bids.filter(b => b.jobId === job.id).map(b => {
    const c = db.users.find(u => u.id === b.contractorId);
    return { ...b, contractorName: c?.name, contractorCompany: c?.company, contractorRating: c?.rating };
  });
  res.json({ ...job, bids });
});

app.post('/api/jobs', authMiddleware, adminOnly, (req, res) => {
  const { title, customer, neighborhood, type, price, startDate, deadline, scope } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price required' });
  const job = { id: Date.now(), title, customer, neighborhood, type, price: parseInt(price), startDate, deadline,
    scope: Array.isArray(scope) ? scope : [scope].filter(Boolean), status: 'open', photos: [],
    postedAt: new Date().toISOString(), postedBy: req.user.id };
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

// ── Photos ────────────────────────────────────────────────────────────────────
// Store photo URLs directly on the job (base64 or URLs from CompanyCam)
app.post('/api/jobs/:id/photos', authMiddleware, (req, res) => {
  const job = db.jobs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Not found' });
  const { url, caption, source } = req.body;
  if (!url) return res.status(400).json({ error: 'Photo URL required' });
  if (!job.photos) job.photos = [];
  const photo = { id: Date.now(), url, caption: caption || '', source: source || 'upload', uploadedBy: req.user.id, uploadedAt: new Date().toISOString() };
  job.photos.push(photo);
  saveDb();
  res.json(photo);
});

app.delete('/api/jobs/:id/photos/:photoId', authMiddleware, adminOnly, (req, res) => {
  const job = db.jobs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Not found' });
  job.photos = (job.photos || []).filter(p => p.id !== parseInt(req.params.photoId));
  saveDb();
  res.json({ ok: true });
});

// ── CompanyCam proxy ──────────────────────────────────────────────────────────
app.get('/api/companycam/projects', authMiddleware, (req, res) => {
  const token = CCAM_TOKEN || req.headers['x-companycam-token'];
  if (!token) return res.status(400).json({ error: 'No CompanyCam token configured' });
  const options = {
    hostname: 'api.companycam.com', path: '/v2/projects?per_page=50', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  };
  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'CompanyCam error' }); }
    });
  });
  proxyReq.on('error', () => res.status(500).json({ error: 'CompanyCam connection failed' }));
  proxyReq.end();
});

app.get('/api/companycam/projects/:projectId/photos', authMiddleware, (req, res) => {
  const token = CCAM_TOKEN || req.headers['x-companycam-token'];
  if (!token) return res.status(400).json({ error: 'No CompanyCam token configured' });
  const options = {
    hostname: 'api.companycam.com', path: `/v2/projects/${req.params.projectId}/photos?per_page=100`, method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  };
  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'CompanyCam error' }); }
    });
  });
  proxyReq.on('error', () => res.status(500).json({ error: 'CompanyCam connection failed' }));
  proxyReq.end();
});

// ── Bids ──────────────────────────────────────────────────────────────────────
app.post('/api/jobs/:id/bids', authMiddleware, (req, res) => {
  if (req.user.role !== 'contractor') return res.status(403).json({ error: 'Contractors only' });
  const jobId = parseInt(req.params.id);
  const job = db.jobs.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (job.status === 'awarded') return res.status(400).json({ error: 'Job already awarded' });
  if (db.bids.find(b => b.jobId === jobId && b.contractorId === req.user.id))
    return res.status(409).json({ error: 'You already bid on this job' });
  const { amount, note } = req.body;
  if (!amount || amount < 100) return res.status(400).json({ error: 'Invalid bid amount' });
  const bid = { id: Date.now(), jobId, contractorId: req.user.id, amount: parseInt(amount), note: note || '', createdAt: new Date().toISOString() };
  db.bids.push(bid);
  saveDb();
  res.json(bid);
});

app.post('/api/jobs/:id/award/:bidId', authMiddleware, adminOnly, (req, res) => {
  const jobIdx = db.jobs.findIndex(j => j.id === parseInt(req.params.id));
  if (jobIdx === -1) return res.status(404).json({ error: 'Not found' });
  const bid = db.bids.find(b => b.id === parseInt(req.params.bidId));
  if (!bid) return res.status(404).json({ error: 'Bid not found' });
  const contractor = db.users.find(u => u.id === bid.contractorId);
  db.jobs[jobIdx] = { ...db.jobs[jobIdx], status: 'awarded', awardedTo: bid.contractorId, awardedToName: contractor?.name, awardedBidId: bid.id, awardedAmount: bid.amount };
  saveDb();
  res.json(db.jobs[jobIdx]);
});

// ── Admin users ───────────────────────────────────────────────────────────────
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

// ── CompanyCam token config (admin) ──────────────────────────────────────────
app.post('/api/admin/companycam-token', authMiddleware, adminOnly, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  process.env.COMPANYCAM_TOKEN = token;
  res.json({ ok: true, message: 'CompanyCam token set for this session. Add COMPANYCAM_TOKEN env var in Railway to persist.' });
});

app.get('/api/admin/companycam-status', authMiddleware, adminOnly, (req, res) => {
  res.json({ configured: !!(CCAM_TOKEN || process.env.COMPANYCAM_TOKEN) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

loadDb();
seed();
app.listen(PORT, '0.0.0.0', () => console.log(`BrushPass running on port ${PORT}`));
