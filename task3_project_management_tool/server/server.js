const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const initDB = require("./db");

const app = express();

const PORT = 5000;
const JWT_SECRET = "task3_secret_key";

let db;

app.use(cors());
app.use(express.json());

// ===================== HEALTH =====================

app.get("/", (req, res) => {
  res.json({
    message: "Task 3 Project Management API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend is working correctly with SQLite",
  });
});

// ===================== AUTH MIDDLEWARE =====================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// ===================== AUTH ROUTES =====================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await db.get(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    const newUser = {
      id: result.lastID,
      name,
      email,
    };

    const token = jwt.sign(newUser, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during registration",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.get(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const token = jwt.sign(safeUser, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during login",
    });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    user: req.user,
  });
});

// ===================== PROJECT ROUTES =====================

app.post("/api/projects", authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Project name is required",
      });
    }

    const result = await db.run(
      "INSERT INTO projects (name, description, ownerId) VALUES (?, ?, ?)",
      [name, description || "", req.user.id]
    );

    const projectId = result.lastID;

    await db.run(
      "INSERT INTO project_members (projectId, userId) VALUES (?, ?)",
      [projectId, req.user.id]
    );

    const project = await db.get(
      "SELECT * FROM projects WHERE id = ?",
      [projectId]
    );

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while creating project",
    });
  }
});

app.get("/api/projects", authMiddleware, async (req, res) => {
  try {
    const projects = await db.all(
      `
      SELECT projects.*
      FROM projects
      JOIN project_members
      ON projects.id = project_members.projectId
      WHERE project_members.userId = ?
      ORDER BY projects.createdAt DESC
      `,
      [req.user.id]
    );

    res.json({
      projects,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching projects",
    });
  }
});

app.get("/api/projects/:projectId/members", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    const project = await db.get(
      "SELECT * FROM projects WHERE id = ?",
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    const members = await db.all(
      `
      SELECT users.id, users.name, users.email
      FROM users
      JOIN project_members
      ON users.id = project_members.userId
      WHERE project_members.projectId = ?
      `,
      [projectId]
    );

    res.json({
      members,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching members",
    });
  }
});

app.post("/api/projects/:projectId/members", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const project = await db.get(
      "SELECT * FROM projects WHERE id = ?",
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (project.ownerId !== req.user.id) {
      return res.status(403).json({
        message: "Only the project owner can add members",
      });
    }

    const user = await db.get(
      "SELECT id, name, email FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found. The user must register first.",
      });
    }

    const existingMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [projectId, user.id]
    );

    if (existingMember) {
      return res.json({
        message: "User is already a member",
        member: user,
      });
    }

    await db.run(
      "INSERT INTO project_members (projectId, userId) VALUES (?, ?)",
      [projectId, user.id]
    );

    res.json({
      message: "Member added successfully",
      member: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while adding member",
    });
  }
});
// ===================== TASK ROUTES =====================

app.post("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { title, description, assignedTo } = req.body;

    const project = await db.get(
      "SELECT * FROM projects WHERE id = ?",
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Task title is required",
      });
    }

    if (assignedTo) {
      const assignedMember = await db.get(
        "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
        [projectId, assignedTo]
      );

      if (!assignedMember) {
        return res.status(400).json({
          message: "Assigned user must be a project member",
        });
      }
    }

    const result = await db.run(
      `
      INSERT INTO tasks (projectId, title, description, status, assignedTo, createdBy)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        projectId,
        title,
        description || "",
        "todo",
        assignedTo || null,
        req.user.id,
      ]
    );

    const task = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while creating task",
    });
  }
});

app.get("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    const project = await db.get(
      "SELECT * FROM projects WHERE id = ?",
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    const tasks = await db.all(
      `
      SELECT 
        tasks.*,
        assignedUser.name AS assignedName,
        assignedUser.email AS assignedEmail,
        creator.name AS createdByName
      FROM tasks
      LEFT JOIN users AS assignedUser
      ON tasks.assignedTo = assignedUser.id
      LEFT JOIN users AS creator
      ON tasks.createdBy = creator.id
      WHERE tasks.projectId = ?
      ORDER BY tasks.createdAt DESC
      `,
      [projectId]
    );

    res.json({
      tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching tasks",
    });
  }
});

app.patch("/api/tasks/:taskId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { title, description, status, assignedTo } = req.body;

    const task = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [task.projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    if (assignedTo) {
      const assignedMember = await db.get(
        "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
        [task.projectId, assignedTo]
      );

      if (!assignedMember) {
        return res.status(400).json({
          message: "Assigned user must be a project member",
        });
      }
    }

    await db.run(
      `
      UPDATE tasks
      SET 
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        assignedTo = ?
      WHERE id = ?
      `,
      [
        title || null,
        description !== undefined ? description : null,
        status || null,
        assignedTo !== undefined ? assignedTo : task.assignedTo,
        taskId,
      ]
    );

    const updatedTask = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );

    res.json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while updating task",
    });
  }
});

app.delete("/api/tasks/:taskId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);

    const task = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [task.projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    await db.run("DELETE FROM comments WHERE taskId = ?", [taskId]);
    await db.run("DELETE FROM tasks WHERE id = ?", [taskId]);

    res.json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while deleting task",
    });
  }
});

// ===================== COMMENT ROUTES =====================

app.post("/api/tasks/:taskId/comments", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { text } = req.body;

    const task = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [task.projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    if (!text) {
      return res.status(400).json({
        message: "Comment text is required",
      });
    }

    const result = await db.run(
      "INSERT INTO comments (taskId, userId, text) VALUES (?, ?, ?)",
      [taskId, req.user.id, text]
    );

    const comment = await db.get(
      `
      SELECT 
        comments.*,
        users.name AS userName,
        users.email AS userEmail
      FROM comments
      JOIN users
      ON comments.userId = users.id
      WHERE comments.id = ?
      `,
      [result.lastID]
    );

    res.status(201).json({
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while adding comment",
    });
  }
});

app.get("/api/tasks/:taskId/comments", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);

    const task = await db.get(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const currentMember = await db.get(
      "SELECT * FROM project_members WHERE projectId = ? AND userId = ?",
      [task.projectId, req.user.id]
    );

    if (!currentMember) {
      return res.status(403).json({
        message: "You are not a member of this project",
      });
    }

    const comments = await db.all(
      `
      SELECT 
        comments.*,
        users.name AS userName,
        users.email AS userEmail
      FROM comments
      JOIN users
      ON comments.userId = users.id
      WHERE comments.taskId = ?
      ORDER BY comments.createdAt ASC
      `,
      [taskId]
    );

    res.json({
      comments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching comments",
    });
  }
});

// ===================== START SERVER =====================

async function startServer() {
  try {
    db = await initDB();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log("SQLite database connected successfully");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();