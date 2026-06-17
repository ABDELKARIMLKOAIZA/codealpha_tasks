# codealpha_tasks
# Task 4: Real-Time Communication App

A real-time video conferencing and collaboration web application built with React, Node.js, Express, Socket.io, WebRTC, SQLite, and JWT authentication.

## Features

- User authentication with Register/Login
- Password hashing using bcryptjs
- JWT-based authentication
- Real-time chat using Socket.io
- Multi-user video calling using WebRTC
- Screen sharing
- Shared whiteboard for drawing/writing
- File sharing
- SQLite database for user storage
- Modern responsive UI

## Technologies Used

### Frontend
- React
- Vite
- Socket.io Client
- WebRTC API
- HTML Canvas API
- CSS3

### Backend
- Node.js
- Express.js
- Socket.io
- Multer
- SQLite
- bcryptjs
- JSON Web Token
- dotenv

## Project Structure

```txt
task4_realtime_communication_app/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Auth.jsx
│   │   ├── FileShare.jsx
│   │   ├── Whiteboard.jsx
│   │   ├── socket.js
│   │   └── App.css
│   └── package.json
│
├── server/
│   ├── routes/
│   │   └── auth.js
│   ├── uploads/
│   ├── database.js
│   ├── server.js
│   ├── task4.db
│   ├── .env
│   └── package.json
│
└── README.md

## Installation and Setup

### 1. Clone the repository

```bash
git clone <your-repository-link>
cd task4_realtime_communication_app

## API Endpoints

### Authentication

```txt
POST /api/auth/register
POST /api/auth/login
