import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';
import plansRoutes from './routes/plans.js';
import classesRoutes from './routes/classes.js';
import { auth } from './middleware/auth.js';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin:['http://localhost:3000'], credentials:true }));

// rate limit login
app.use('/api/login',rateLimit({windowMs:15*60*1000,max:100}));

app.use(cookieParser());
app.use(csrf({cookie:{httpOnly:true,sameSite:'strict',secure:false}}));

// expose csrf token to client via non-httpOnly cookie
app.use((req,res,next)=>{
  res.cookie('XSRF-TOKEN', req.csrfToken(), {sameSite:'strict'});
  next();
});

app.use(helmet());
app.use(express.json());

// API routes
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', adminRoutes);
app.use('/api', plansRoutes);
app.use('/api', classesRoutes);

// Protected pages (HTML) - must be before static middleware
['dashboard.html','schedule.html','profile.html','dashboard','schedule','profile'].forEach(route=>{
  app.get(route, auth, (req,res)=>{
    const file=route.replace('/','');
    res.sendFile(path.join(__dirname,'../', file.includes('.html')?file:`${file}.html`));
  });
});

// admin pages
import { adminOnly } from './middleware/admin.js';
['/admin.html','/clients.html','/trainers.html','/subscriptions.html','/admin','/clients','/trainers','/subscriptions'].forEach(route=>{
  app.get(route, adminOnly, (req,res)=>{
    const file=route.replace('/','');
    res.sendFile(path.join(__dirname,'../', file.includes('.html')?file:`${file}.html`));
  });
});

// Static public files (after protected routes so auth can intercept)
app.use(express.static(path.join(__dirname, '../')));

// Public pages
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../register.html')));

// Protected pages (pretty URLs)
const protectedRoutes = {
  '/profile': 'profile.html',
  '/dashboard': 'dashboard.html',
  '/schedule': 'schedule.html'
};

for (const [route, file] of Object.entries(protectedRoutes)) {
  app.get(route, auth, (req, res) => {
    res.sendFile(path.join(__dirname, `../${file}`));
  });
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on ' + PORT));
