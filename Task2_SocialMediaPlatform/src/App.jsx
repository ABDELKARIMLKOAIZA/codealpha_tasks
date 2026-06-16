import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3000/api";

function App() {
  const [currentUserId, setCurrentUserId] = useState(1);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [commentText, setCommentText] = useState({});

  async function loadData() {
    const usersResponse = await fetch(`${API}/users`);
    const postsResponse = await fetch(`${API}/posts`);

    const usersData = await usersResponse.json();
    const postsData = await postsResponse.json();

    setUsers(usersData);
    setPosts(postsData);
  }

  useEffect(() => {
    loadData();
  }, []);

  const currentUser = users.find((user) => user.id === currentUserId);

  function getUserById(id) {
    return users.find((user) => user.id === id);
  }

  async function handleAddPost(e) {
    e.preventDefault();

    if (newPost.trim() === "") return;

    await fetch(`${API}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUserId,
        content: newPost,
      }),
    });

    setNewPost("");
    loadData();
  }

  async function handleLike(postId) {
    await fetch(`${API}/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUserId,
      }),
    });

    loadData();
  }

  async function handleAddComment(postId) {
    const text = commentText[postId];

    if (!text || text.trim() === "") return;

    await fetch(`${API}/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUserId,
        text,
      }),
    });

    setCommentText({
      ...commentText,
      [postId]: "",
    });

    loadData();
  }

  async function handleDeletePost(postId) {
    const confirmDelete = window.confirm("Delete this post?");

    if (!confirmDelete) return;

    await fetch(`${API}/posts/${postId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentUserId,
      }),
    });

    loadData();
  }

  async function handleFollow(userId) {
    await fetch(`${API}/users/${userId}/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentUserId,
      }),
    });

    loadData();
  }

  if (!currentUser) {
    return <p>Loading...</p>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="logo">MiniSocial</h1>

        <div className="switch-user">
          <label>Logged in as</label>

          <select
            value={currentUserId}
            onChange={(e) => setCurrentUserId(Number(e.target.value))}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-card">
          <div className="avatar">{currentUser.avatar}</div>
          <h2>{currentUser.name}</h2>
          <p>@{currentUser.username}</p>
          <p>{currentUser.bio}</p>

          <div className="stats">
            <span>
              <strong>{currentUser.followers.length}</strong>
              Followers
            </span>

            <span>
              <strong>{currentUser.following.length}</strong>
              Following
            </span>
          </div>
        </div>
      </aside>

      <main className="feed">
        <h1>Social Media Platform</h1>

        <form className="post-form" onSubmit={handleAddPost}>
          <textarea
            placeholder="Write a new post..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          ></textarea>

          <button type="submit">Post</button>
        </form>

        {posts.map((post) => {
          const author = getUserById(post.userId);
          const liked = post.likes.includes(currentUserId);

          if (!author) return null;

          return (
            <article className="post" key={post.id}>
              <div className="post-header">
                <div className="avatar small">{author.avatar}</div>

                <div>
                  <h3>{author.name}</h3>
                  <p>
                    @{author.username} · {post.createdAt}
                  </p>
                </div>

                {post.userId === currentUserId && (
                  <button
                    className="delete-btn"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className="post-content">{post.content}</p>

              <div className="post-actions">
                <button
                  className={liked ? "liked" : ""}
                  onClick={() => handleLike(post.id)}
                >
                  ♥ {post.likes.length} Like
                </button>

                <span>{post.comments.length} comments</span>
              </div>

              <div className="comments">
                {post.comments.map((comment) => {
                  const commentUser = getUserById(comment.userId);

                  if (!commentUser) return null;

                  return (
                    <div className="comment" key={comment.id}>
                      <strong>@{commentUser.username}</strong> {comment.text}
                    </div>
                  );
                })}
              </div>

              <div className="comment-form">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText[post.id] || ""}
                  onChange={(e) =>
                    setCommentText({
                      ...commentText,
                      [post.id]: e.target.value,
                    })
                  }
                />

                <button type="button" onClick={() => handleAddComment(post.id)}>
                  Comment
                </button>
              </div>
            </article>
          );
        })}
      </main>

      <aside className="rightbar">
        <h2>Users</h2>

        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const isFollowing = currentUser.following.includes(user.id);

          return (
            <div className="user-card" key={user.id}>
              <div className="avatar small">{user.avatar}</div>

              <div className="user-info">
                <h3>{user.name}</h3>
                <p>@{user.username}</p>
                <p>{user.followers.length} followers</p>
              </div>

              {!isCurrentUser && (
                <button onClick={() => handleFollow(user.id)}>
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              )}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

export default App;