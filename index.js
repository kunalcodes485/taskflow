const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  logging: false,
});

// ─── USER ─────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('Admin', 'Member'), defaultValue: 'Member' },
}, { timestamps: true });

// ─── PROJECT ──────────────────────────────────────────
const Project = sequelize.define('Project', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  createdById: { type: DataTypes.UUID, allowNull: false },
}, { timestamps: true });

// ─── TASK ─────────────────────────────────────────────
const Task = sequelize.define('Task', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('Todo', 'In Progress', 'Done'), defaultValue: 'Todo' },
  priority: { type: DataTypes.ENUM('Low', 'Medium', 'High'), defaultValue: 'Medium' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false },
  projectId: { type: DataTypes.UUID, allowNull: false },
  assigneeId: { type: DataTypes.UUID, allowNull: false },
  createdById: { type: DataTypes.UUID, allowNull: false },
}, { timestamps: true });

// ─── COMMENT ──────────────────────────────────────────
const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  taskId: { type: DataTypes.UUID, allowNull: false },
  authorId: { type: DataTypes.UUID, allowNull: false },
}, { timestamps: true });

// ─── RELATIONSHIPS ────────────────────────────────────
Project.hasMany(Task, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Task.belongsTo(Project, { foreignKey: 'projectId' });

User.hasMany(Task, { foreignKey: 'assigneeId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

User.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

User.hasMany(Project, { foreignKey: 'createdById' });
Project.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

// Comment relationships
Task.hasMany(Comment, { foreignKey: 'taskId', onDelete: 'CASCADE' });
Comment.belongsTo(Task, { foreignKey: 'taskId' });
User.hasMany(Comment, { foreignKey: 'authorId' });
Comment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

module.exports = { sequelize, User, Project, Task, Comment };
