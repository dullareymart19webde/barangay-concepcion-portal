# Barangay E-Certificate Portal: Online Request and Tracking System with SMS Notification

**Jurisdiction:** Barangay Concepcion, Valencia City, Province of Bukidnon, Philippines  
**Target Certifications:**
1. **Barangay Clearance** (Employment, Business, Police/NBI Clearance, Bank Requirement)
2. **Certificate of Residency** (Scholarships, BSU/Enrollment, Bank/Wallet, Proof of Address)
3. **Certificate of Indigency** (Hospital Aid, BPH Medical Assistance, DSWD AICS, PAO Legal Aid — 100% Free)

---

## 🌟 Key Highlights & Architecture

- **Backend:** Node.js (v18+) with Express.js organized in a modular MVC pattern (Controllers, Models, Routes, Middlewares, and Utilities).
- **Multi-Database Architecture (Cloud Native):**
  - **Active Cloud Database:** **Google Cloud Firestore** (Project: `brgy-concepcion-valencia`) configured with `serviceAccountKey.json`, real-time updates, and deployed production security rules ([`firestore.rules`](firestore.rules)).
  - **Local Development Fallback:** **SQLite** (`better-sqlite3`) for instant zero-config offline running.
  - **Enterprise LGU On-Premise:** Full **MySQL 8+** migration file provided in [`schema.sql`](schema.sql).
- **Philippine SMS Gateway Integration:**
  - Official **Semaphore API** (`https://api.semaphore.co/api/v4/messages`) integration.
  - Built-in **Local Simulation & Logger Mode** for offline development or testing without depleting real SMS credits. Formatted logs are stored in the database (`sms_logs`) and printed cleanly in the server terminal with Bisaya templates.
- **Frontend UI:** Responsive Tailwind CSS with Philippine Government Design System styling, Font Awesome 6, Chart.js analytics, and mobile optimization.
- **Official Print & PDF Generation:** Print-ready official A4 Philippine Barangay Certificate with Valencia City and Barangay Concepcion seals, council roster sidebar, subtle watermark, dry seal circle, and thumbmark box.
- **Defensive Security:**
  - Parameterized database queries to eliminate SQL injection.
  - Input sanitization against Cross-Site Scripting (XSS).
  - Strict Philippine mobile phone validation (`09XXXXXXXXX` / `+639XXXXXXXXX`).
  - Multer MIME type and 5MB size limit validation for ID uploads.
  - Bcrypt password hashing (10 rounds) and HTTP-only JWT session cookies.

---

## 📁 Folder & File Tree

```text
barangay-e-certificate-portal/
├── .env                          # Active environment configuration
├── .env.example                  # Environment configuration template
├── .gitignore                    # Version control ignore rules
├── package.json                  # Dependencies & execution scripts
├── README.md                     # Comprehensive documentation & guide
├── schema.sql                    # Full MySQL database migration & seed script
├── src/
│   ├── app.js                    # Express application setup, routes & error handling
│   ├── server.js                 # Server startup banner & port binding
│   ├── config/
│   │   └── database.js           # Database adapter (supports both MySQL & SQLite)
│   ├── controllers/
│   │   ├── adminController.js    # Staff auth, KPI analytics, request & SMS management
│   │   └── requestController.js  # Resident submission, tracking & QR generation
│   ├── middlewares/
│   │   ├── authMiddleware.js     # JWT token authentication & role verification
│   │   ├── errorHandler.js       # Centralized error & multer upload handling
│   │   ├── uploadMiddleware.js   # Multer file upload setup for valid IDs (5MB max)
│   │   └── validationMiddleware.js # XSS sanitization & PH phone validation
│   ├── models/
│   │   ├── Admin.js              # Admin staff accounts model
│   │   ├── Request.js            # Certificate applications & analytics model
│   │   ├── SmsLog.js             # Semaphore SMS audit logging model
│   │   └── StatusLog.js          # Request lifecycle audit trail model
│   ├── routes/
│   │   ├── adminRoutes.js        # Admin & staff API endpoints
│   │   └── requestRoutes.js      # Public resident submission & lookup endpoints
│   └── utils/
│       ├── controlNumber.js      # Unique BC-YYYYMMDD-XXXX generator & validator
│       ├── semaphore.js          # Semaphore SMS dispatcher & Bisaya templates
│       └── testRunner.js         # Automated end-to-end verification test suite
├── uploads/
│   └── valid_ids/                # Secure storage for resident uploaded IDs
└── public/
    ├── index.html                # Resident Landing Page & Requirements Guide
    ├── request.html              # Online Application Form with ID upload & Success Modal
    ├── track.html                # Dedicated 1-input Tracking Page with 4-stage Timeline
    ├── admin-login.html          # Administrative Staff Login with 1-click test fill
    ├── admin-dashboard.html      # Staff Management Dashboard with KPI Cards & Charts
    ├── certificate-template.html # Official A4 Print & PDF Certificate View
    ├── css/
    │   └── custom.css            # Custom typography, watermark, & print stylesheet
    ├── js/
    │   ├── admin-dashboard.js    # Dashboard metrics, tables, filters, and modals
    │   ├── request.js            # Form handling, validation, AJAX, and QR code
    │   └── track.js              # Tracking lookup, visual progress bar, and pickup notes
    └── images/
        ├── brgy-logo.png         # Official Barangay Concepcion Heraldic Seal
        ├── valencia-logo.png     # Official City of Valencia Heraldic Crest
        └── ph-seal.svg           # Great Seal of the Republic of the Philippines
```

---

## 🚀 Quick Start Guide

### 1. Installation
Clone or navigate to the project directory:
```bash
cd barangay-e-certificate-portal
npm install
```

### 2. Configure Environment (`.env`)
A `.env` file is already pre-configured for instant zero-setup execution. You can inspect or customize it:
```env
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Security
JWT_SECRET=barangay_concepcion_valencia_secure_jwt_token_2026_xyz

# Database: 'sqlite' (instant zero-config) or 'mysql'
DB_CLIENT=sqlite

# Semaphore SMS Gateway (use 'MOCK_DEV_KEY' for simulation mode)
SEMAPHORE_API_KEY=MOCK_DEV_KEY
SEMAPHORE_SENDER_NAME=BRGYCONCEP
SMS_SIMULATION_MODE=true
```

### 3. Run the Automated Test Suite
To verify all 10 core integration test cases (Submission, Control Number format, Tracking, Admin Auth, Status Update, SMS simulation, and Audit logs):
```bash
npm test
```

### 4. Start the Application
```bash
npm start
```
The server will start at: **`http://localhost:3000`**

---

## 👥 Administrative Accounts (Firebase Authentication)

Live accounts provisioned in **Google Firebase Authentication** (`brgy-concepcion-valencia`):

| Role | Official Email / Identifier | Password | Official Name |
| :--- | :--- | :--- | :--- |
| **Punong Barangay (Official)** | `concepcion66barangay@gmail.com` | `BarangayOfficial2026!` | Hon. Merlyn G. Antiga |
| **Barangay Admin** | `admin@barangayconcepcion.gov.ph` | `BarangayAdmin2026!` | Hon. Merlyn G. Antiga |
| **Barangay Secretary** | `secretary@barangayconcepcion.gov.ph` | `BarangaySecretary2026!` | Hon. Redin T. Butanas |

*Legacy / local test credentials (`admin` / `Admin@123` and `secretary` / `Secretary@123`) also remain available as a testing fallback.*

*Note: The login page at `/admin` features 1-click **Firebase Auth Auto-Fill** buttons for fast, frictionless access.*

---

## 🔍 Pre-Seeded Sample Tracking Numbers

You can test the resident tracking system immediately at **`http://localhost:3000/track`** using these pre-seeded reference numbers:

1. **`BC-20261012-7A12`** — Status: **Ready for Pickup** (Barangay Clearance for Employment)
2. **`BC-20261013-3F90`** — Status: **Processing** (Certificate of Indigency for Medical Aid)
3. **`BC-20261013-8D44`** — Status: **Pending Review** (Certificate of Residency for Scholarship)
4. **`BC-20261011-1B2C`** — Status: **Released** (Barangay Clearance for Police Clearance)
5. **`BC-20261010-9E55`** — Status: **Rejected** (Residency - with explicit rejection reason)

---

## 🗄️ MySQL Migration Guide

If deploying with MySQL / MariaDB instead of SQLite:
1. Ensure your MySQL server (e.g. XAMPP, MySQL Server) is running.
2. Import the schema script:
   ```bash
   mysql -u root -p < schema.sql
   ```
3. Update `.env`:
   ```env
   DB_CLIENT=mysql
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_mysql_password
   DB_NAME=barangay_concepcion_db
   DB_PORT=3306
   ```
4. Restart the server: `npm start`.

---

## 📱 Semaphore SMS Gateway Integration

When `SMS_SIMULATION_MODE=true` (or when using `MOCK_DEV_KEY`), every event simulates dispatch by:
1. Formatting the exact Philippine mobile number (e.g. converting `+639...` or `639...` to `09XXXXXXXXX`).
2. Printing an ASCII notification box in the terminal showing recipient, message, and timestamp.
3. Saving a permanent log record in the `sms_logs` table with status `MOCK_SENT`.

### Live Deployment with Semaphore
To activate live Philippine SMS dispatch:
1. Register an account at [Semaphore.co](https://semaphore.co).
2. Generate an API Key from your Semaphore dashboard.
3. Update `.env`:
   ```env
   SEMAPHORE_API_KEY=your_actual_semaphore_api_key
   SEMAPHORE_SENDER_NAME=BRGYCONCEP
   SMS_SIMULATION_MODE=false
   ```
4. All messages will now be dispatched live to Philippine carriers (Globe, Smart, DITO, TNT, TM).

### Bisaya Message Formats Implemented
- **On Submit:**
  > *"Maayong adlaw [Name]! Nadawat ang imong request para sa [Cert Type]. Imong Control No: [BC-XXXX]. I-track kini sa atong portal. Salamat! - Brgy. Concepcion"*
- **On Ready for Pickup:**
  > *"Maayong adlaw [Name]! Andam na alang sa pickup ang imong [Cert Type] (Control No: [BC-XXXX]) sa Barangay Concepcion Hall. Palihug dala ug 1 valid ID ug CTC. Office hours: 8AM-5PM (Mon-Fri). Salamat!"*
- **On Rejection:**
  > *"Maayong adlaw [Name]! Ang imong request para sa [Cert Type] (Control No: [BC-XXXX]) wala ma-aprobahan. Rason: [Remarks]. - Brgy. Concepcion"*

---

## 🌐 API Reference

### Public Resident Endpoints
- `POST /api/requests` — Submit online certificate request (multipart/form-data with `validId` upload).
- `GET /api/track/:controlNumber` — Query live tracking status, stage progress, and audit trail.
- `GET /api/requests/:controlNumber` — Fetch full request record for document printing.

### Admin & Staff Endpoints (Protected by JWT)
- `POST /api/admin/login` — Authenticate and receive JWT cookie & token.
- `POST /api/admin/logout` — Invalidate session.
- `GET /api/admin/me` — Current authenticated staff profile.
- `GET /api/admin/overview` — KPI metrics & certificate category distribution.
- `GET /api/admin/requests` — Filterable and paginated list of requests.
- `GET /api/admin/requests/:id` — Full details modal payload with uploaded ID.
- `PUT /api/admin/requests/:id/status` — Update status, record audit trail, and trigger SMS.
- `POST /api/admin/sms/send` — Manual SMS dispatch with pre-filled templates.
- `GET /api/admin/sms-logs` — Paginated history of all SMS dispatches.

---

## 🖨️ Document Print & PDF Generation

Visit **`/admin/print/:controlNumber`** (e.g. `http://localhost:3000/admin/print/BC-20261012-7A12`):
- Perfectly formatted to **A4 Portrait** with legal margins.
- Proper official legal phrasing customized for Barangay Clearance, Certificate of Residency, and Certificate of Indigency.
- Includes Punong Barangay and Secretary signature lines, thumbmark box, and dry seal placement.
- Automatically hides all navigation and buttons when pressing **Ctrl + P** / Print.

---

## 🏛️ Barangay Jurisdiction Information
- **Barangay:** Barangay Concepcion
- **City:** Valencia City
- **Province:** Bukidnon (Region X - Northern Mindanao)
- **Barangay Hall Address:** Purok 3, Barangay Concepcion, Valencia City, Bukidnon
- **Office Hours:** Monday to Friday, 8:00 AM – 5:00 PM
- **Hotlines:** 0917-828-4567 / (088) 828-1234

