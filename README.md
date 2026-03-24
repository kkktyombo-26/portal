# ⛪ Church Portal

A full-stack church community management portal with role-based access, bilingual support (English/Swahili), and a clean, calm design.

## Tech Stack
- **Backend:** Node.js + Express.js
- **Frontend:** Next.js 14 + Tailwind CSS
- **Database:** MySQL
- **Auth:** JWT tokens

## User Roles
| Role | Access |
|------|--------|
| Pastor | Full admin — manage all members, groups, announcements |
| Elder | Manage own group, broadcast to group |
| Group Leader | Manage own group, broadcast to group |
| Member | View announcements only |

## Setup

### 1. Database
```bash
mysql -u root -p < church_portal.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your credentials
npm run seed           # create tables + seed data
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set NEXT_PUBLIC_API_URL
npm run dev
```

## Demo Accounts
| Email | Password | Role |
|-------|----------|------|
| pastor@church.com | pastor123 | Pastor |
| elder@church.com | elder123 | Elder |
| choir@church.com | choir123 | Choir Leader |
| youth@church.com | youth123 | Youth Leader |
| mary@church.com | member123 | Member |

## Bilingual
Toggle between **English** and **Kiswahili** using the language switcher in the sidebar.
