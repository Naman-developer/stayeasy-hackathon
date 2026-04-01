# StayEasy Deployment Guide (Phase 4)

## 1) Prerequisites
- Node.js 18+
- MongoDB Atlas cluster
- GitHub repo with `backend/` and `frontend/`

## 2) Environment Variables
Use these on backend host:

```env
PORT=5000
MONGO_URI=mongodb://namansingh:naman2810@ac-r8y6e3e-shard-00-00.6xbmzgl.mongodb.net:27017,ac-r8y6e3e-shard-00-01.6xbmzgl.mongodb.net:27017,ac-r8y6e3e-shard-00-02.6xbmzgl.mongodb.net:27017/stayeasy_mvp?ssl=true&replicaSet=atlas-q1dff3-shard-0&authSource=admin&appName=Cluster0
JWT_SECRET=<strong_secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=<your_frontend_url>
RAZORPAY_KEY_ID=<optional>
RAZORPAY_KEY_SECRET=<optional>
```

## 3) Backend Deploy (Render or Railway)

### Render
1. Create new **Web Service**.
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all environment variables.
6. Deploy and copy backend URL, e.g. `https://stayeasy-api.onrender.com`

### Railway
1. Create new project from repo.
2. Set service root to `backend`.
3. Add environment variables.
4. Start command: `npm start`
5. Deploy and copy backend URL.

## 4) Frontend Deploy (Vercel)
1. Import project on Vercel.
2. Root directory: `frontend`
3. Framework preset: `Other` (static site).
4. Build command: leave empty.
5. Output directory: `.`
6. Deploy.

## 5) Point Frontend to Backend
Update API base URL in frontend JS files from:
- `http://localhost:5000/api`

to production:
- `https://<your-backend-domain>/api`

Then redeploy frontend.

## 6) Seed Demo Data in Production/Local
From `backend/`:

```bash
npm run seed
```

## 7) Final Go-Live Check
- Open frontend URL.
- Run owner -> admin approval -> user search -> booking -> payment flow.
- Verify admin dashboard chart/tables load.
- Verify worker and hostel/parent pages open without auth errors.
