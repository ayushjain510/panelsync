# 📋 PanelSync

**PanelSync** is a full-stack scheduling and notification platform designed to manage student groups, presentation panels, mentors, and scheduled sessions.

## ✨ Features

- 👥 Manage student groups and mentors
- 📅 Schedule presentation/panel slots
- 📧 Send email notifications
- 🔐 Admin authentication
- 📊 Dashboard for managing schedules
- 💾 MongoDB-based data storage

## 🛠️ Tech Stack

**Frontend:** React, Vite  
**Backend:** Node.js, Express.js  
**Database:** MongoDB  
**Authentication:** JWT  
**Email:** Resend

## 📁 Project Structure

```text
PanelSync/
├── client/     # React frontend
├── server/     # Express backend
└── README.md
```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ayushjain510/PanelSync.git
cd PanelSync
```

### 2. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 3. Configure environment variables

Create `server/.env`:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/panelsync
JWT_SECRET=your-secret-key
ADMIN_PASSWORD=your-admin-password
RESEND_API_KEY=your-resend-api-key
MAIL_FROM="PanelSync <onboarding@resend.dev>"
```

### 4. Run the project

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

Then open the Vite URL shown in the terminal.

## Email Notifications

PanelSync uses **Resend** to send scheduled notification emails. For production use, configure a verified sending domain in Resend.

## Author

**Ayush Jain**  
Computer Science Engineering — Woxsen University, Hyderabad

