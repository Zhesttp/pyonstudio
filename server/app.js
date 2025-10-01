import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import { auth } from './middleware/auth.js';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true
}));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api', authRoutes);
app.use('/api', profileRoutes);

// Protected pages (HTML) - must be before static middleware
['/dashboard.html','/schedule.html','/profile.html','/dashboard','/schedule','/profile'].forEach(route=>{
  app.get(route, auth, (req,res)=>{
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
