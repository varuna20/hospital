# 🏥 Hospital eChanneling System v3

**Multi-hospital, multi-tenant** appointment & queue management with prescriptions, digital signage, WhatsApp, revenue tracking, and automated backups.

---

## ⚡ Quick Start

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env      # Edit MONGO_URI and JWT_SECRET
npm run seed               # Creates 2 demo hospitals + all accounts
npm run dev                # Starts on http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                # Opens http://localhost:5173
```

---

## 🔑 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | superadmin@echanneling.com | SuperAdmin@123 |
| City Medical — Admin | admin@citymedical.lk | Admin@123 |
| City Medical — Staff | staff@citymedical.lk | Staff@123 |
| City Medical — Doctor | amara@citymedical.lk | Doctor@123 |
| Lanka Surgical — Admin | admin@lankasurgical.lk | Admin@123 |
| Lanka Surgical — Staff | staff@lankasurgical.lk | Staff@123 |

---

## 🌐 URL Reference

| URL | Page | Access |
|-----|------|--------|
| `/` | Patient Booking (4-step) | Public |
| `/login` | Hospital selector + login | Public |
| `/queue-status/:token` | Live queue tracker | Patients |
| `/display/:hospitalId` | Hospital display (doctor list) | TV/Monitor |
| `/display/:hospitalId/:doctorId` | **Per-doctor room display** | TV/Monitor |
| `/prescription/print/:id` | Printable prescription | Doctor |
| `/super` | System overview | Super Admin |
| `/super/hospitals` | Manage all hospitals | Super Admin |
| `/super/revenue` | Global revenue | Super Admin |
| `/super/subscriptions` | Subscription plans | Super Admin |
| `/super/system` | Email / SMS / Backup | Super Admin |
| `/admin` | Hospital dashboard | Admin |
| `/admin/doctors` | Doctor management | Admin |
| `/admin/staff` | Staff management | Admin |
| `/admin/revenue` | Revenue breakdown | Admin |
| `/admin/media` | Logo + video upload | Admin |
| `/admin/settings` | Hospital settings | Admin |
| `/staff` | Reception dashboard | Staff |
| `/staff/queue` | Live queue control | Staff |
| `/staff/booking` | Manual booking | Staff |
| `/doctor` | Today's patients | Doctor |
| `/doctor/prescriptions` | Rx manager | Doctor |
| `/doctor/revenue` | My fees only | Doctor |

---

## ✅ Features

### Multi-Hospital
- Fully isolated data per hospital
- Per-hospital color theme → applied to entire UI
- Per-hospital logo (upload PNG/SVG/JPG)
- Per-hospital WhatsApp, payment, queue settings
- Super admin manages all hospitals from one portal

### Digital Signage Display
- Per-doctor room display at `/display/:hid/:docId`
- Hospital logo + name shown at top
- Animated number flip on queue change
- "GET READY" pulsing next-patient section
- Waiting room video (auto-stops when doctor arrives)
- Scrolling announcement ticker
- Live clock + date

### Queue Management
- Staff calls next patient (one click)
- Staff overrides today's session times
- Mark patients: Arrived / Absent / In-Progress / Complete
- Emergency cases jump to front of queue
- WhatsApp: turn alerts, booking confirmation, doctor arrival
- Real-time via Socket.IO (no page refresh needed)

### Prescriptions
- Full drug table: name, dosage, frequency, duration, route, instructions, quantity
- Previous visit history auto-loads when patient selected
- Customizable letterhead (logo, doctor name, qualifications, reg no.)
- Professional A4 print with confidential watermark
- Search by patient name or phone number
- Doctors see ONLY their own patients

### Revenue
- Hospital charge and doctor fee tracked separately on every appointment
- Hospital admin: full breakdown by doctor
- Doctor: sees only their own consultation fees
- Daily bar charts with hospital vs doctor comparison
- CSV export for Excel/Google Sheets
- Pending payment tracker
- Monthly auto-billing emails to hospitals (1st of month)

### Security
- Helmet.js HTTP security headers
- Rate limiting (API / auth / booking separately)
- NoSQL injection prevention (mongo-sanitize)
- JWT with 7-day expiry, bcryptjs cost-12 hashing
- Hospital data isolation (all queries scoped)
- Doctor data isolation (own patients only)
- CORS restricted to frontend URL

### Backup & Restore
- Scheduled daily backup (configurable time, default 1 AM)
- Manual trigger from Super Admin → System
- Download backup files as JSON
- One-click restore (with confirmation)
- Local disk or network path storage

---

## 🎨 Per-Hospital Theming

Colors flow automatically through the entire UI via CSS variables:

```
Admin Panel → Login Page → Display Screen → Prescriptions
```

Change colors: Admin → Settings → Theme  
Upload logo: Admin → Media

---

## 📱 WhatsApp Setup (Per Hospital)

1. Create Twilio account → https://console.twilio.com
2. Enable WhatsApp Sandbox (or buy production number)
3. Admin → Settings → WhatsApp:
   - Enable toggle
   - Enter Account SID, Auth Token, From number
   - Click "Send Test" to verify
4. Staff can send session summary to doctor with 📱 button

---

## 📺 Display Screen Setup

1. Open `/display/:hospitalId` on a waiting room TV
2. Auto-shows doctor selector, or redirects if 1 doctor
3. Per-doctor URL: find in Admin → Doctors (copy button on each card)
4. For waiting video: Admin → Media → Upload MP4 → Enable

---

## 💰 Revenue Model

```
Patient pays: Doctor Fee + Hospital Charge = Total
Hospital keeps: Hospital Charge
Doctor earns: Doctor Fee
Platform earns: Commission % from Hospital Revenue (per subscription plan)
```

---

## 📁 Project Structure

```
hospital-system/
├── backend/
│   ├── server.js              ← Express + Security + Socket.IO
│   ├── .env                   ← Your config (copy from .env.example)
│   ├── models/
│   │   ├── Hospital.js        ← Theme, logo, video, billing, WhatsApp
│   │   ├── User.js            ← All roles with hospital isolation
│   │   ├── Doctor.js          ← Profile, fees, schedule, today status
│   │   ├── Patient.js         ← Per-hospital patient records
│   │   ├── Appointment.js     ← Revenue captured at booking time
│   │   ├── Queue.js           ← Live queue state
│   │   ├── Prescription.js    ← Full Rx with drugs + letterhead
│   │   └── SystemSettings.js  ← Email, SMS, backup, subscription plans
│   ├── routes/               (17 route files)
│   ├── middleware/
│   │   └── auth.js            ← JWT + roles + hospital scope
│   ├── socket/
│   │   └── index.js           ← Hospital/doctor/display rooms
│   └── utils/
│       ├── whatsapp.js        ← 5 Twilio message templates
│       ├── backup.js          ← Scheduler + manual trigger
│       ├── billing.js         ← Monthly invoice emails
│       └── seed.js            ← 2 demo hospitals
│
└── frontend/
    └── src/
        ├── App.jsx            ← Router with all 20+ routes
        ├── context/           ← Auth, Theme (CSS vars), Socket
        ├── utils/             ← api.js, helpers.js
        └── pages/
            ├── LoginPage.jsx  ← Hospital picker + theme preview
            ├── display/       ← DisplayScreen, DoctorDisplay
            ├── patient/       ← Booking (4-step), QueueStatus
            ├── superadmin/    ← Dashboard, Hospitals, Revenue,
            │                     Subscriptions, System, HospitalManager
            ├── admin/         ← Dashboard, Doctors, Staff,
            │                     Revenue, Media, Settings
            ├── staff/         ← Dashboard, Queue, Booking
            └── doctor/        ← Dashboard, Prescriptions,
                                  PrescriptionForm, PrescriptionPrint,
                                  Revenue
```

---

## 🔧 Production Checklist

- [ ] Change `JWT_SECRET` to 32+ random chars in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS with SSL certificate (Let's Encrypt is free)
- [ ] Use MongoDB Atlas with IP whitelist + encryption at rest
- [ ] Set `FRONTEND_URL` to your actual domain
- [ ] Install PM2 for process management: `npm install -g pm2`
- [ ] Start with: `pm2 start server.js --name hospital-api`
- [ ] Set up nginx reverse proxy for frontend build
- [ ] Configure SMTP for billing emails

---

## 🐛 Troubleshooting

**"Cannot connect to MongoDB"**
→ Check `MONGO_URI` in `.env` | Start MongoDB: `mongod` or use Atlas

**"Port 5000 in use"**
→ Change `PORT=5001` in `.env`

**"Frontend can't reach backend"**
→ Vite proxies `/api` to port 5000 in dev — ensure backend is running

**npm install fails**
→ Node.js v18+ required: `node --version`
→ Try: `npm cache clean --force && npm install`

**WhatsApp test fails**
→ Check Twilio credentials | Verify WhatsApp Sandbox is enabled | Patient number must have WhatsApp
"# hospital" 
