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
import trainerRoutes from './routes/trainer.js';
import { auth } from './middleware/auth.js';
import { pool } from './db.js';
import fs from 'fs';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Clean up orphaned photos on startup
async function cleanupOrphanedPhotos() {
  try {
    const trainersDir = path.join(__dirname, '../trainers');
    if (!fs.existsSync(trainersDir)) {
      return;
    }

    const client = await pool.connect();
    try {
      // Get all photo URLs from database
      const result = await client.query('SELECT photo_url FROM trainers WHERE photo_url IS NOT NULL');
      const usedPhotos = new Set(result.rows.map(row => row.photo_url));
      
      // Get all files in trainers directory
      const files = fs.readdirSync(trainersDir);
      
      // Delete files that are not in database
      let deletedCount = 0;
      for (const file of files) {
        const photoUrl = `/trainers/${file}`;
        if (!usedPhotos.has(photoUrl)) {
          const filePath = path.join(trainersDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted orphaned photo: ${file}`);
            deletedCount++;
          } catch (error) {
            console.error(`Error deleting orphaned photo ${file}:`, error);
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} orphaned photos`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error during photo cleanup:', error);
  }
}

app.use(cors({ origin:['http://localhost:3000', 'http://127.0.0.1:3000'], credentials:true }));

// rate limit login
app.use('/api/login',rateLimit({windowMs:15*60*1000,max:100}));

app.use(cookieParser());
app.use(csrf({cookie:{httpOnly:true,sameSite:'strict',secure:false}}));

// expose csrf token to client via non-httpOnly cookie
app.use((req,res,next)=>{
  res.cookie('XSRF-TOKEN', req.csrfToken(), {sameSite:'strict'});
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(express.json());

// API routes
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', adminRoutes);
app.use('/api', plansRoutes);
app.use('/api', classesRoutes);
app.use('/api/trainer', trainerRoutes);

// Protected pages (HTML) - must be before static middleware
['dashboard.html','schedule.html','profile.html','dashboard','schedule','profile'].forEach(route=>{
  app.get(route, auth, (req,res)=>{
    const file=route.replace('/','');
    res.sendFile(path.join(__dirname,'../', file.includes('.html')?file:`${file}.html`));
  });
});

// admin pages
import { adminOnly, trainerOnly } from './middleware/admin.js';

// Trainer schedule page - protected for trainers only
app.get('/trainer_schedule.html', trainerOnly, (req, res) => {
  res.sendFile(path.join(__dirname, '../trainer_schedule.html'));
});
['/admin.html','/clients.html','/trainers.html','/subscriptions.html','/admin_classes.html','/admin','/clients','/trainers','/subscriptions','/admin_classes'].forEach(route=>{
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
app.listen(PORT, async () => {
  console.log('Server started on ' + PORT);
  // Clean up orphaned photos on startup
  await cleanupOrphanedPhotos();
});
