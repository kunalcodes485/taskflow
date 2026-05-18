const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Task, Project, User } = require('../models');
const { auth, adminOnly } = require('../middleware/auth');

const taskIncludes = [
  { model: Project, attributes: ['id', 'name'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
];

// GET /api/tasks — Admin sees all, Member sees assigned only
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'Member') where.assigneeId = req.user.id;

    // Filters
    if (req.query.status) where.status = req.query.status;
    if (req.query.projectId) where.projectId = req.query.projectId;
    if (req.query.priority) where.priority = req.query.priority;

    // Overdue filter
    if (req.query.overdue === 'true') {
      where.dueDate = { [Op.lt]: new Date() };
      where.status = { [Op.ne]: 'Done' };
    }

    const tasks = await Task.findAll({ where, include: taskIncludes, order: [['dueDate', 'ASC']] });

    // Add computed overdue field
    const today = new Date().toISOString().split('T')[0];
    const enriched = tasks.map(t => {
      const plain = t.toJSON();
      plain.isOverdue = plain.status !== 'Done' && plain.dueDate < today;
      return plain;
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/dashboard — stats summary
router.get('/dashboard', auth, async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, { include: taskIncludes });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role === 'Member' && task.assigneeId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks — Admin only
router.post('/', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('projectId').notEmpty().withMessage('Project is required'),
  body('assigneeId').notEmpty().withMessage('Assignee is required'),
  body('dueDate').isDate().withMessage('Valid due date required'),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('status').optional().isIn(['Todo', 'In Progress', 'Done']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, description, projectId, assigneeId, dueDate, priority, status } = req.body;

    // Validate project & assignee exist
    const [project, assignee] = await Promise.all([
      Project.findByPk(projectId),
      User.findByPk(assigneeId),
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!assignee) return res.status(404).json({ error: 'Assignee not found' });

    const task = await Task.create({
      title, description, projectId, assigneeId,
      dueDate, priority: priority || 'Medium',
      status: status || 'Todo',
      createdById: req.user.id,
    });
    const full = await Task.findByPk(task.id, { include: taskIncludes });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id — Admin: full update | Member: status only
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role === 'Member') {
      // Members can only update their own task status
      if (task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (!req.body.status) return res.status(400).json({ error: 'Members can only update status' });
      await task.update({ status: req.body.status });
    } else {
      await task.update(req.body);
    }

    const updated = await Task.findByPk(task.id, { include: taskIncludes });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id — Admin only
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await task.destroy();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
