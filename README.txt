=====================================
  TASKFLOW — TEAM TASK MANAGER
  Full-Stack Assignment | Ethara.AI
=====================================

LIVE URL:  https://taskflow-production-ac66.up.railway.app
GITHUB REPO: https://github.com/kunalcodes485/taskflow/tree/main 
TECH STACK:   Node.js + Express + PostgreSQL (Sequelize) + Vanilla JS + REST API 

--------------------------------------
PROJECT OVERVIEW
--------------------------------------
TaskFlow is a full-stack Team Task Manager web application with:
  - JWT-based authentication (Signup / Login)
  - Role-based access control (Admin / Member)
  - Project management with progress tracking
  - Task creation, assignment & status tracking
  - Dashboard with live stats (Total, Todo, In Progress, Done, Overdue)
  - Deployed on Railway with PostgreSQL

--------------------------------------
FEATURES
--------------------------------------
AUTHENTICATION
  - Secure signup & login with bcrypt password hashing
  - JWT tokens (7-day expiry) stored in localStorage
  - Auto-login on page refresh
  - Role selection at signup: Admin or Member

ROLE-BASED ACCESS CONTROL
  Admin:
    - Create, edit, delete projects
    - Create, assign, edit, delete tasks
    - View all tasks across all users
    - View all team members
    - Change user roles
  Member:
    - View only their assigned tasks
    - Update task status (Todo → In Progress → Done)
    - View team members

PROJECTS
  - CRUD operations (Admin only)
  - Each project shows task count and completion %
  - Progress bar visualization
  - Cascade delete (deletes all tasks in project)

TASKS
  - Full CRUD (Admin) / Status update only (Member)
  - Fields: Title, Description, Project, Assignee, Status, Priority, Due Date
  - Auto overdue detection (past due date + not Done)
  - Filter by status, project, search by keyword

DASHBOARD
  - Live stats: Total / Todo / In Progress / Done / Overdue
  - Recent tasks table
  - Personalized greeting

TEAM
  - List all registered users with roles and join dates

--------------------------------------
REST API ENDPOINTS
--------------------------------------
AUTH
  POST  /api/auth/signup     - Register new user
  POST  /api/auth/login      - Login & get token
  GET   /api/auth/me         - Get current user (protected)

PROJECTS
  GET   /api/projects        - List all projects
  GET   /api/projects/:id    - Get project with tasks
  POST  /api/projects        - Create project (Admin)
  PUT   /api/projects/:id    - Update project (Admin)
  DELETE /api/projects/:id   - Delete project (Admin)

TASKS
  GET   /api/tasks           - List tasks (filtered by role)
  GET   /api/tasks/dashboard - Stats summary
  GET   /api/tasks/:id       - Get single task
  POST  /api/tasks           - Create task (Admin)
  PUT   /api/tasks/:id       - Update task (Admin: full | Member: status only)
  DELETE /api/tasks/:id      - Delete task (Admin)

USERS
  GET   /api/users           - List all users
  GET   /api/users/:id       - User with tasks (Admin)
  PUT   /api/users/:id/role  - Change role (Admin)

--------------------------------------
DATABASE SCHEMA
--------------------------------------
Users:
  id (UUID, PK), name, email (unique), password (bcrypt),
  role (Admin|Member), createdAt, updatedAt

Projects:
  id (UUID, PK), name, description, createdById (FK→Users),
  createdAt, updatedAt

Tasks:
  id (UUID, PK), title, description,
  status (Todo|In Progress|Done),
  priority (Low|Medium|High),
  dueDate, projectId (FK→Projects, CASCADE),
  assigneeId (FK→Users), createdById (FK→Users),
  createdAt, updatedAt

--------------------------------------
LOCAL SETUP
--------------------------------------
Prerequisites: Node.js 18+, PostgreSQL

1. Clone the repo:
   git clone https://github.com/kunalcodes485/taskflow/tree/main

2. Install dependencies:
   npm install

3. Create .env file:
   cp .env.example .env
   # Edit .env with your database credentials

4. Start the server:
   npm run dev

5. Open frontend/index.html in browser
   (or serve it with: npx serve ../frontend)

--------------------------------------
RAILWAY DEPLOYMENT (step-by-step)
--------------------------------------
1. Push code to GitHub

2. Go to https://taskflow-production-ac66.up.railway.app → New Project → Deploy from GitHub

3. Select your repo → Deploy backend folder

4. Add PostgreSQL service:
   Railway Dashboard → New → Database → PostgreSQL

5. Set environment variables in Railway:
   DATABASE_URL = (auto-set by Railway when you link the DB)
   JWT_SECRET   = any_long_random_string_here
   NODE_ENV     = production

6. Railway auto-detects package.json and runs "npm start"

7. Get your Railway URL → update API_URL in frontend/index.html

8. Deploy frontend: Railway → New → Static Site → frontend folder
   OR just open frontend/index.html (it talks to your Railway API)

--------------------------------------
FOLDER STRUCTURE
--------------------------------------
taskflow/
├── backend/
│   ├── server.js           # Express app entry point
│   ├── package.json
│   ├── railway.toml        # Railway config
│   ├── .env.example        # Environment variables template
│   ├── .gitignore
│   ├── middleware/
│   │   └── auth.js         # JWT verification + role guard
│   ├── models/
│   │   └── index.js        # Sequelize models + relationships
│   └── routes/
│       ├── auth.js         # Signup, Login, Me
│       ├── projects.js     # Projects CRUD
│       ├── tasks.js        # Tasks CRUD + dashboard stats
│       └── users.js        # Team management
└── frontend/
    └── index.html          # Complete SPA frontend

--------------------------------------
VALIDATIONS IMPLEMENTED
--------------------------------------
- Email format validation
- Password minimum 6 characters
- Required field checks (title, project, assignee, due date)
- Unique email enforcement
- Role validation (Admin/Member only)
- Date validation on due dates
- Foreign key validation (project/user must exist)
- Members cannot access others' tasks (403)
- Members can only update status, not full task (403)

--------------------------------------
CONTACT
--------------------------------------
Submitted by: Kunal Gaikwad 
Email:        kunalgaikwad1009@gmail.com 
Date:         May 2026
