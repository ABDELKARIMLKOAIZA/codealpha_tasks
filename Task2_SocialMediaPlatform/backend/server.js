const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "db.json");

const initialData = {
  users: [
    {
      id: 1,
      name: "Karim Lkoaiza",
      username: "karim",
      bio: "Engineering student",
      avatar: "K",
      followers: [2],
      following: [2],
    },
    {
      id: 2,
      name: "Sara Benali",
      username: "sara",
      bio: "Frontend developer",
      avatar: "S",
      followers: [1],
      following: [1, 3],
    },
    {
      id: 3,
      name: "Anas Idrissi",
      username: "anas",
      bio: "Backend developer",
      avatar: "A",
      followers: [],
      following: [2],
    },
  ],
  posts: [
    {
      id: 1,
      userId: 2,
      content: "This is my first post on MiniSocial.",
      likes: [1],
      comments: [
        {
          id: 1,
          userId: 1,
          text: "Nice post!",
        },
      ],
      createdAt: "Today",
    },
    {
      id: 2,
      userId: 3,
      content: "Node.js and Express are good for backend APIs.",
      likes: [],
      comments: [],
      createdAt: "Today",
    },
  ],
};

async function readDb() {
  try {
    const data = await fs.readFile(dbPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

app.get("/", (req, res) => {
  res.send("MiniSocial backend is running");
});

app.get("/api/users", async (req, res) => {
  const db = await readDb();
  res.json(db.users);
});

app.get("/api/posts", async (req, res) => {
  const db = await readDb();
  res.json(db.posts);
});

app.post("/api/posts", async (req, res) => {
  const { userId, content } = req.body;

  if (!userId || !content || content.trim() === "") {
    return res.status(400).json({ message: "Invalid post data" });
  }

  const db = await readDb();

  const newPost = {
    id: Date.now(),
    userId,
    content,
    likes: [],
    comments: [],
    createdAt: new Date().toLocaleString(),
  };

  db.posts.unshift(newPost);
  await writeDb(db);

  res.status(201).json(newPost);
});

app.post("/api/posts/:id/like", async (req, res) => {
  const postId = Number(req.params.id);
  const { userId } = req.body;

  const db = await readDb();
  const post = db.posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter((id) => id !== userId);
  } else {
    post.likes.push(userId);
  }

  await writeDb(db);
  res.json(post);
});

app.post("/api/posts/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);
  const { userId, text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "Comment cannot be empty" });
  }

  const db = await readDb();
  const post = db.posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  const newComment = {
    id: Date.now(),
    userId,
    text,
  };

  post.comments.push(newComment);
  await writeDb(db);

  res.status(201).json(newComment);
});

app.post("/api/users/:id/follow", async (req, res) => {
  const targetUserId = Number(req.params.id);
  const { currentUserId } = req.body;

  if (targetUserId === currentUserId) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const db = await readDb();

  const currentUser = db.users.find((u) => u.id === currentUserId);
  const targetUser = db.users.find((u) => u.id === targetUserId);

  if (!currentUser || !targetUser) {
    return res.status(404).json({ message: "User not found" });
  }

  const alreadyFollowing = currentUser.following.includes(targetUserId);

  if (alreadyFollowing) {
    currentUser.following = currentUser.following.filter(
      (id) => id !== targetUserId
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id !== currentUserId
    );
  } else {
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);
  }

  await writeDb(db);

  res.json({ currentUser, targetUser });
});


app.delete("/api/posts/:id", async (req, res) => {
  const postId = Number(req.params.id);
  const { currentUserId } = req.body;

  const db = await readDb();

  const post = db.posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.userId !== currentUserId) {
    return res.status(403).json({ message: "You can delete only your own posts" });
  }

  db.posts = db.posts.filter((p) => p.id !== postId);

  await writeDb(db);

  res.json({ message: "Post deleted successfully" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});