require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
app.use(cors());
app.use(express.json());

// ── DATABASE ──────────────────────────────────────────
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { rejectUnauthorized: false },
  },
  logging: false,
});

// ── MODELS ────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('Admin', 'Member'), defaultValue: 'Member' },
});

const Project = sequelize.define('Project', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  createdById: { type: DataTypes.UUID },
});

const Task = sequelize.define('Task', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('Todo', 'In Progress', 'Done'), defaultValue: 'Todo' },
  priority: { type: DataTypes.ENUM('Low', 'Medium', 'High'), defaultValue: 'Medium' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false },
  projectId: { type: DataTypes.UUID },
  assigneeId: { type: DataTypes.UUID },
  createdById: { type: DataTypes.UUID },
});

// ── RELATIONSHIPS ─────────────────────────────────────
Project.hasMany(Task, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Task.belongsTo(Project, { foreignKey: 'projectId' });
User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });
User.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });
User.hasMany(Project, { foreignKey: 'createdById' });
Project.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

// ── MIDDLEWARE ────────────────────────────────────────
const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ── HEALTH CHECK ────────────────────────────────────
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/health', (req, res) => res.json({ status: 'TaskFlow API running ✅' }));
// ── AUTH ROUTES ───────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 characters' });
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: role || 'Member' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, (req, res) => {
  const { id, name, email, role } = req.user;
  res.json({ id, name, email, role });
});

// ── PROJECT ROUTES ────────────────────────────────────
app.get('/api/projects', auth, async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: Task, attributes: ['id', 'status'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(projects);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id', auth, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: Task, include: [{ model: User, as: 'assignee', attributes: ['id', 'name', 'role'] }] },
      ],
    });
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', auth, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const project = await Project.create({ name, description, createdById: req.user.id });
    res.status(201).json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', auth, adminOnly, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    await project.update(req.body);
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:id', auth, adminOnly, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    await project.destroy();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TASK ROUTES ───────────────────────────────────────
const taskIncludes = [
  { model: Project, attributes: ['id', 'name'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
];

app.get('/api/tasks/dashboard', auth, async (req, res) => {
  try {
    const where = req.user.role === 'Member' ? { assigneeId: req.user.id } : {};
    const today = new Date().toISOString().split('T')[0];
    const [total, todo, inProgress, done, overdue] = await Promise.all([
      Task.count({ where }),
      Task.count({ where: { ...where, status: 'Todo' } }),
      Task.count({ where: { ...where, status: 'In Progress' } }),
      Task.count({ where: { ...where, status: 'Done' } }),
      Task.count({ where: { ...where, status: { [Op.ne]: 'Done' }, dueDate: { [Op.lt]: today } } }),
    ]);
    res.json({ total, todo, inProgress, done, overdue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'Member') where.assigneeId = req.user.id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.projectId) where.projectId = req.query.projectId;
    const tasks = await Task.findAll({ where, include: taskIncludes, order: [['dueDate', 'ASC']] });
    const today = new Date().toISOString().split('T')[0];
    const enriched = tasks.map(t => {
      const plain = t.toJSON();
      plain.isOverdue = plain.status !== 'Done' && plain.dueDate < today;
      return plain;
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, { include: taskIncludes });
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'Member' && task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', auth, adminOnly, async (req, res) => {
  try {
    const { title, description, projectId, assigneeId, dueDate, priority, status } = req.body;
    if (!title || !projectId || !assigneeId || !dueDate) return res.status(400).json({ error: 'Required fields missing' });
    const task = await Task.create({
      title, description, projectId, assigneeId, dueDate,
      priority: priority || 'Medium',
      status: status || 'Todo',
      createdById: req.user.id,
    });
    const full = await Task.findByPk(task.id, { include: taskIncludes });
    res.status(201).json(full);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'Member') {
      if (task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      await task.update({ status: req.body.status });
    } else {
      await task.update(req.body);
    }
    const updated = await Task.findByPk(task.id, { include: taskIncludes });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    await task.destroy();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── USER ROUTES ───────────────────────────────────────
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'createdAt'], order: [['name', 'ASC']] });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'name', 'email', 'role', 'createdAt'] });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Database synced');
  app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
}).catch(e => console.error('❌ DB Error:', e.message));

