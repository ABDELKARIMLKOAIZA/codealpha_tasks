import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [mode, setMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [comments, setComments] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [memberEmail, setMemberEmail] = useState("");

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
  });

  const [commentText, setCommentText] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (token) {
      fetchMe();
      fetchProjects();
    }
  }, [token]);

  async function request(path, method = "GET", body = null) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong");
    }

    return data;
  }

  async function fetchMe() {
    try {
      const data = await request("/auth/me");
      setUser(data.user);
    } catch {
      logout();
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";

      const body =
        mode === "login"
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : authForm;

      const data = await request(path, "POST", body);

      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setProjects([]);
    setTasks([]);
    setMembers([]);
    setMemberEmail("");
    setSelectedProject(null);
    setSelectedTask(null);
  }

  async function fetchProjects() {
    try {
      const data = await request("/projects");
      setProjects(data.projects);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function fetchMembers(projectId) {
    try {
      const data = await request(`/projects/${projectId}/members`);
      setMembers(data.members);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createProject(e) {
    e.preventDefault();
    setMessage("");

    try {
      await request("/projects", "POST", projectForm);
      setProjectForm({ name: "", description: "" });
      fetchProjects();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addMember(e) {
    e.preventDefault();
    setMessage("");

    if (!selectedProject || !memberEmail.trim()) return;

    try {
      const data = await request(
        `/projects/${selectedProject.id}/members`,
        "POST",
        {
          email: memberEmail,
        }
      );

      setMemberEmail("");
      setMessage(data.message);
      fetchMembers(selectedProject.id);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function selectProject(project) {
    setSelectedProject(project);
    setSelectedTask(null);
    setMessage("");

    try {
      const tasksData = await request(`/projects/${project.id}/tasks`);
      setTasks(tasksData.tasks);

      const membersData = await request(`/projects/${project.id}/members`);
      setMembers(membersData.members);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    setMessage("");

    if (!selectedProject) return;

    try {
      await request(`/projects/${selectedProject.id}/tasks`, "POST", {
        title: taskForm.title,
        description: taskForm.description,
        assignedTo: taskForm.assignedTo ? Number(taskForm.assignedTo) : null,
      });

      setTaskForm({
        title: "",
        description: "",
        assignedTo: "",
      });

      selectProject(selectedProject);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateTaskStatus(taskId, status) {
    setMessage("");

    try {
      await request(`/tasks/${taskId}`, "PATCH", { status });
      selectProject(selectedProject);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTask(taskId) {
    setMessage("");

    try {
      await request(`/tasks/${taskId}`, "DELETE");
      setSelectedTask(null);
      selectProject(selectedProject);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function openTask(task) {
    setSelectedTask(task);
    setMessage("");

    try {
      const data = await request(`/tasks/${task.id}/comments`);
      setComments((prev) => ({
        ...prev,
        [task.id]: data.comments,
      }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addComment(e) {
    e.preventDefault();
    setMessage("");

    if (!selectedTask || !commentText.trim()) return;

    try {
      await request(`/tasks/${selectedTask.id}/comments`, "POST", {
        text: commentText,
      });

      setCommentText("");
      openTask(selectedTask);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const todoTasks = tasks.filter((task) => task.status === "todo");
  const progressTasks = tasks.filter((task) => task.status === "progress");
  const doneTasks = tasks.filter((task) => task.status === "done");

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-icon">PM</div>
            <div>
              <h1>TaskFlow</h1>
              <p>Project Management Tool</p>
            </div>
          </div>

          <div className="tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>

            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {mode === "register" && (
              <input
                type="text"
                placeholder="Full name"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm({ ...authForm, password: e.target.value })
              }
            />

            <button className="primary-btn" type="submit">
              {mode === "login" ? "Login" : "Create account"}
            </button>
          </form>

          {message && <p className="message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand small">
          <div className="brand-icon">PM</div>
          <div>
            <h1>TaskFlow</h1>
            <p>Workspace</p>
          </div>
        </div>

        <div className="user-box">
          <span>{user.name}</span>
          <small>{user.email}</small>
        </div>

        <form onSubmit={createProject} className="panel-form">
          <h3>New Project</h3>

          <input
            type="text"
            placeholder="Project name"
            value={projectForm.name}
            onChange={(e) =>
              setProjectForm({ ...projectForm, name: e.target.value })
            }
          />

          <textarea
            placeholder="Project description"
            value={projectForm.description}
            onChange={(e) =>
              setProjectForm({
                ...projectForm,
                description: e.target.value,
              })
            }
          />

          <button className="primary-btn" type="submit">
            Create Project
          </button>
        </form>

        <div className="project-list">
          <h3>Projects</h3>

          {projects.length === 0 && <p className="empty">No projects yet.</p>}

          {projects.map((project) => (
            <button
              key={project.id}
              className={
                selectedProject?.id === project.id
                  ? "project-item active"
                  : "project-item"
              }
              onClick={() => selectProject(project)}
            >
              <strong>{project.name}</strong>
              <span>{project.description || "No description"}</span>
            </button>
          ))}
        </div>

        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="main">
        {!selectedProject ? (
          <div className="welcome">
            <h2>Select or create a project</h2>
            <p>
              Manage projects, assign tasks, update progress and communicate
              inside task cards.
            </p>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h2>{selectedProject.name}</h2>
                <p>{selectedProject.description}</p>
              </div>

              <div className="project-meta">
                <span>{tasks.length} tasks</span>
              </div>
            </header>

            <section className="members-panel">
              <div>
                <h3>Project Members</h3>

                <div className="members-list">
                  {members.length === 0 && (
                    <span className="empty">No members yet.</span>
                  )}

                  {members.map((member) => (
                    <span key={member.id} className="member-badge">
                      {member.name}
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={addMember} className="member-form">
                <input
                  type="email"
                  placeholder="Add member by email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />

                <button className="primary-btn" type="submit">
                  Add Member
                </button>
              </form>
            </section>

            {message && <p className="message board-message">{message}</p>}

            <form onSubmit={createTask} className="task-form">
              <input
                type="text"
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Description"
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    description: e.target.value,
                  })
                }
              />

              <select
                value={taskForm.assignedTo}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    assignedTo: e.target.value,
                  })
                }
              >
                <option value="">Unassigned</option>

                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.email}
                  </option>
                ))}
              </select>

              <button className="primary-btn" type="submit">
                Add Task
              </button>
            </form>

            <section className="board">
              <Column
                title="To Do"
                tasks={todoTasks}
                status="todo"
                openTask={openTask}
                updateTaskStatus={updateTaskStatus}
                deleteTask={deleteTask}
              />

              <Column
                title="In Progress"
                tasks={progressTasks}
                status="progress"
                openTask={openTask}
                updateTaskStatus={updateTaskStatus}
                deleteTask={deleteTask}
              />

              <Column
                title="Done"
                tasks={doneTasks}
                status="done"
                openTask={openTask}
                updateTaskStatus={updateTaskStatus}
                deleteTask={deleteTask}
              />
            </section>
          </>
        )}
      </main>

      {selectedTask && (
        <aside className="task-details">
          <button className="close-btn" onClick={() => setSelectedTask(null)}>
            ×
          </button>

          <h2>{selectedTask.title}</h2>
          <p>{selectedTask.description || "No description"}</p>

          <div className="details-grid">
            <span>Status</span>
            <strong>{selectedTask.status}</strong>

            <span>Assigned to</span>
            <strong>{selectedTask.assignedName || "Not assigned"}</strong>

            <span>Created by</span>
            <strong>{selectedTask.createdByName || "Unknown"}</strong>
          </div>

          <div className="comments">
            <h3>Comments</h3>

            {(comments[selectedTask.id] || []).length === 0 && (
              <p className="empty">No comments yet.</p>
            )}

            {(comments[selectedTask.id] || []).map((comment) => (
              <div className="comment" key={comment.id}>
                <strong>{comment.userName}</strong>
                <p>{comment.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={addComment} className="comment-form">
            <textarea
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />

            <button className="primary-btn" type="submit">
              Add Comment
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}

function Column({
  title,
  tasks,
  status,
  openTask,
  updateTaskStatus,
  deleteTask,
}) {
  return (
    <div className="column">
      <div className="column-header">
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </div>

      {tasks.map((task) => (
        <div className="task-card" key={task.id}>
          <h4 onClick={() => openTask(task)}>{task.title}</h4>
          <p>{task.description || "No description"}</p>

          <div className="task-assigned">
            Assigned: {task.assignedName || "Unassigned"}
          </div>

          <div className="task-actions">
            {status !== "todo" && (
              <button onClick={() => updateTaskStatus(task.id, "todo")}>
                To Do
              </button>
            )}

            {status !== "progress" && (
              <button onClick={() => updateTaskStatus(task.id, "progress")}>
                Progress
              </button>
            )}

            {status !== "done" && (
              <button onClick={() => updateTaskStatus(task.id, "done")}>
                Done
              </button>
            )}

            <button className="danger" onClick={() => deleteTask(task.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}

      {tasks.length === 0 && <p className="empty">No tasks.</p>}
    </div>
  );
}

export default App;