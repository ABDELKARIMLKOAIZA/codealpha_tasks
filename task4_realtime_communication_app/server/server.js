require("dotenv").config();
const authRoutes = require("./routes/auth");
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.json({
    originalName: req.file.originalname,
    filename: req.file.filename,
    fileUrl: `http://localhost:5000/uploads/${req.file.filename}`,
  });
});

app.get("/", (req, res) => {
  res.send("Task 4 backend is running");
});

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    const room = io.sockets.adapter.rooms.get(roomId);
    const usersInRoom = room ? Array.from(room).filter((id) => id !== socket.id) : [];

    socket.emit("existing-users", usersInRoom);

    socket.to(roomId).emit("user-joined", socket.id);

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("send-message", ({ roomId, message }) => {
    io.to(roomId).emit("receive-message", {
      message,
      sender: socket.id,
    });
  });

    socket.on("draw", ({ roomId, drawData }) => {
    socket.to(roomId).emit("receive-draw", drawData);
  });

  socket.on("clear-whiteboard", (roomId) => {
    socket.to(roomId).emit("whiteboard-cleared");
  });
  socket.on("file-shared", ({ roomId, fileData }) => {
  io.to(roomId).emit("receive-file", fileData);
});

  socket.on("send-offer", ({ targetUserId, offer }) => {
    io.to(targetUserId).emit("receive-offer", {
      fromUserId: socket.id,
      offer,
    });
  });

  socket.on("send-answer", ({ targetUserId, answer }) => {
    io.to(targetUserId).emit("receive-answer", {
      fromUserId: socket.id,
      answer,
    });
  });

  socket.on("send-ice-candidate", ({ targetUserId, candidate }) => {
    io.to(targetUserId).emit("receive-ice-candidate", {
      fromUserId: socket.id,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    if (socket.roomId) {
      socket.to(socket.roomId).emit("user-left", socket.id);
    }
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});