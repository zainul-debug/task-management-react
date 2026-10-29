
import { useEffect, useState } from "react";
import api from "./api";
import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskFilter, setTaskFilter] = useState("ALL");

  async function loadProjects() {
    try {
      const response = await api.get("/projects");

      setProjects(
        Array.isArray(response.data)
          ? response.data
          : response.data.data || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load projects."
      );
    }
  }

  async function loadTasks() {
    try {
      const response = await api.get("/tasks");
      setTasks(response.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load tasks."
      );
    }
  }

  async function loadUsers() {
    try {
      const response = await api.get("/users");
      setUsers(response.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load users."
      );
    }
  }

  useEffect(() => {
    if (user && localStorage.getItem("auth_token")) {
      setLoading(true);

      const loadInitialData = async () => {
        try {
          await Promise.all([
            loadProjects(),
            loadTasks(),
            ...(user.role === "admin" ? [loadUsers()] : []),
          ]);
        } finally {
          setLoading(false);
        }
      };

      loadInitialData();
    }
    // Run when the app initially loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = event.currentTarget;
    const email = form.email.value;
    const password = form.password.value;

    try {
      const response = await api.post("/login", { email, password });
      const data = response.data;

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);

      const requests = [
        api.get("/projects"),
        api.get("/tasks"),
      ];

      if (data.user.role === "admin") {
        requests.push(api.get("/users"));
      }

      const responses = await Promise.all(requests);
      const projectsResponse = responses[0];
      const tasksResponse = responses[1];

      setProjects(
        Array.isArray(projectsResponse.data)
          ? projectsResponse.data
          : projectsResponse.data.data || []
      );

      setTasks(
        Array.isArray(tasksResponse.data)
          ? tasksResponse.data
          : tasksResponse.data.data || []
      );

      if (data.user.role === "admin") {
        setUsers(responses[2].data.data || []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await api.post("/logout");
    } catch {
      // Clear local session even if the API logout request fails.
    }

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    setUser(null);
    setProjects([]);
    setTasks([]);
    setUsers([]);
    setSelectedProject(null);
    setError("");
  }

  function openProject(project) {
    setSelectedProject(project);
    setError("");
  }

  function goBack() {
    setSelectedProject(null);
    setError("");
  }

  const projectTasks = selectedProject
    ? tasks.filter(
        (task) =>
          Number(task.project_id) === Number(selectedProject.id)
      )
    : [];
      const taskStats = {
  total: projectTasks.length,
  pending: projectTasks.filter(
    (task) => task.status === "PENDING"
  ).length,
  inProgress: projectTasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length,
  done: projectTasks.filter(
    (task) => task.status === "DONE"
  ).length,
  overdue: projectTasks.filter(
    (task) => task.status === "OVERDUE"
  ).length,
};

const filteredTasks =
  taskFilter === "ALL"
    ? projectTasks
    : projectTasks.filter((task) => task.status === taskFilter);  


  async function handleStatusChange(taskId, newStatus) {
    setError("");

    try {
      const response = await api.put(`/tasks/${taskId}/status`, {
        status: newStatus,
      });

      const updatedTask = response.data.data;

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          Number(task.id) === Number(taskId)
            ? { ...task, ...(updatedTask || {}), status: newStatus }
            : task
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not update task status."
      );
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const taskData = {
      title: formData.get("title"),
      description: formData.get("description"),
      assigned_to: Number(formData.get("assigned_to")),
      priority: formData.get("priority"),
      due_date: formData.get("due_date"),
    };

    try {
      const response = await api.post(
        `/projects/${selectedProject.id}/tasks`,
        taskData
      );

      const newTask = response.data.data;

      setTasks((currentTasks) => [...currentTasks, newTask]);
      form.reset();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not create task. Check the form details and permissions."
      );
    }
  }

  if (!user) {
    return (
      <div className="app-container">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>Task Management System</h1>
          <p>Sign in to continue</p>

          {error && <p className="error-message">{error}</p>}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Task Management System</h1>
          <p>
            Welcome, {user.name || user.email} ({user.role})
          </p>
        </div>

        <button onClick={handleLogout}>Logout</button>
      </header>

      {error && <p className="error-message">{error}</p>}

      {selectedProject ? (
        <section className="content-section">
          <button className="back-button" onClick={goBack}>
            ← Back to Projects
          </button>

          <h2>{selectedProject.name}</h2>
          <p>{selectedProject.description || "Project task list"}</p>

          {user.role === "admin" && (
            <form
              onSubmit={handleCreateTask}
              className="create-task-form"
            >
              <h3>Create New Task</h3>

              <input
                type="text"
                name="title"
                placeholder="Task title"
                required
              />

              <textarea
                name="description"
                placeholder="Task description"
                rows="3"
              />

              <label htmlFor="assigned_to">Assign To</label>
              <select
                id="assigned_to"
                name="assigned_to"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select a user
                </option>

                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.email})
                  </option>
                ))}
              </select>

              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                defaultValue="MEDIUM"
                required
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>

              <label htmlFor="due_date">Due date</label>
              <input
                id="due_date"
                type="date"
                name="due_date"
                required
              />

              <button type="submit">Create Task</button>
            </form>
          )}

 
<h3>Task Overview</h3>

<div className="task-stats">
  <div className="stat-card">
    <span>Total Tasks</span>
    <h3>{taskStats.total}</h3>
  </div>

  <div className="stat-card">
    <span>Pending</span>
    <h3>{taskStats.pending}</h3>
  </div>

  <div className="stat-card">
    <span>In Progress</span>
    <h3>{taskStats.inProgress}</h3>
  </div>

  <div className="stat-card">
    <span>Completed</span>
    <h3>{taskStats.done}</h3>
  </div>

  <div className="stat-card">
    <span>Overdue</span>
    <h3>{taskStats.overdue}</h3>
  </div>
</div>

<h3>Tasks ({filteredTasks.length})</h3>

<label htmlFor="taskFilter">Filter tasks by status</label>
<select
  id="taskFilter"
  value={taskFilter}
  onChange={(event) => setTaskFilter(event.target.value)}
>
  <option value="ALL">All Tasks</option>
  <option value="PENDING">Pending</option>
  <option value="IN_PROGRESS">In Progress</option>
  <option value="DONE">Completed</option>
  <option value="OVERDUE">Overdue</option>
</select>


          {filteredTasks.length === 0 ? (
            <p>No tasks are available for this project.</p>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <h3>{task.title}</h3>
                  <p>
                    {task.description || "No description provided."}
                  </p>

                  <div className="task-details">

                <label>
                  <strong>Status:</strong>{" "}
                  <select
                    value={task.status}
                    disabled={task.status === "OVERDUE" && user.role !== "admin"}
                    onChange={(event) =>
                      handleStatusChange(task.id, event.target.value)
                    }
                  >
                    {task.status === "OVERDUE" ? (
                      <>
                        <option value="OVERDUE">Overdue</option>
                        {user.role === "admin" && (
                          <option value="DONE">Done</option>
                        )}
                      </>
                    ) : (
                      <>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                      </>
                    )}
                  </select>
                </label>


                    <span>
                      <strong>Priority:</strong> {task.priority}
                    </span>

                    <span>
                      <strong>Due:</strong>{" "}
                      {task.due_date || "Not set"}
                    </span>
                  </div>

                  {user.role === "admin" && task.user && (
                    <p>
                      <strong>Assigned to:</strong>{" "}
                      {task.user.name || task.user.email}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="content-section">
          <h2>Available Projects</h2>
          {loading && <p>Loading projects...</p>}

          <div className="project-grid">
            {projects.map((project) => (
              <button
                className="project-card"
                key={project.id}
                onClick={() => openProject(project)}
              >
                <h3>{project.name}</h3>
                <p>
                  {project.description || "No description available."}
                </p>
                <span>View Project →</span>
              </button>
            ))}
          </div>

          {!loading && projects.length === 0 && (
            <p>No projects are available.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
