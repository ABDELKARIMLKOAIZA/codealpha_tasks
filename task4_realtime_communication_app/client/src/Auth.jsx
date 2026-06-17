import { useState } from "react";

function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = isLogin
      ? "http://localhost:5000/api/auth/login"
      : "http://localhost:5000/api/auth/register";

    const body = isLogin
      ? { email, password }
      : { username, email, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Authentication failed");
        return;
      }

      if (isLogin) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onAuthSuccess(data.user);
      } else {
        alert("Account created successfully. Now login.");
        setIsLogin(true);
        setUsername("");
        setPassword("");
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert("Server error");
    }
  };

  return (
    <div className="app">
      <div className="auth-card">
        <h1>{isLogin ? "Login" : "Create Account"}</h1>
        <p className="subtitle">
          Secure access to the real-time communication app.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        <button
          className="switch-auth-btn"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin
            ? "No account? Create one"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

export default Auth;