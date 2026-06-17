import { useEffect, useRef, useState } from "react";
import socket from "./socket";
import Whiteboard from "./Whiteboard";
import FileShare from "./FileShare";
import Auth from "./Auth";
import "./App.css";

function RemoteVideo({ stream, userId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="remote-video-card">
      <video ref={videoRef} autoPlay playsInline className="remote-video" />
      <p>Remote user: {userId}</p>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [mySocketId, setMySocketId] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const [remoteUsers, setRemoteUsers] = useState([]);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const peersRef = useRef({});
  const remoteStreamsRef = useRef({});
  const pendingCandidatesRef = useRef({});

  const iceServers = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username);
    }
  }, [currentUser]);

  const updateRemoteUsers = () => {
    const users = Object.entries(remoteStreamsRef.current).map(
      ([userId, stream]) => ({
        userId,
        stream,
      })
    );

    setRemoteUsers(users);
  };

  const getLocalMedia = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    setCameraOn(true);
    setMicOn(true);

    return stream;
  };

  const flushPendingCandidates = async (userId, peerConnection) => {
    const candidates = pendingCandidatesRef.current[userId] || [];

    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    pendingCandidatesRef.current[userId] = [];
  };

  const createPeerConnection = (targetUserId) => {
    if (peersRef.current[targetUserId]) {
      return peersRef.current[targetUserId];
    }

    const peerConnection = new RTCPeerConnection(iceServers);

    peersRef.current[targetUserId] = peerConnection;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("send-ice-candidate", {
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];

      remoteStreamsRef.current[targetUserId] = remoteStream;
      updateRemoteUsers();
    };

    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed"
      ) {
        delete peersRef.current[targetUserId];
        delete remoteStreamsRef.current[targetUserId];
        updateRemoteUsers();
      }
    };

    return peerConnection;
  };

  const callUser = async (targetUserId) => {
    const peerConnection = createPeerConnection(targetUserId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("send-offer", {
      targetUserId,
      offer,
    });
  };

  useEffect(() => {
    const handleConnect = () => {
      setMySocketId(socket.id);
    };

    const handleExistingUsers = async (users) => {
      for (const userId of users) {
        await callUser(userId);
      }
    };

    const handleUserJoined = (userId) => {
      setMessages((prev) => [
        ...prev,
        {
          type: "system",
          message: `New user joined the room: ${userId}`,
        },
      ]);
    };

    const handleReceiveOffer = async ({ fromUserId, offer }) => {
      await getLocalMedia();

      const peerConnection = createPeerConnection(fromUserId);

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      await flushPendingCandidates(fromUserId, peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("send-answer", {
        targetUserId: fromUserId,
        answer,
      });
    };

    const handleReceiveAnswer = async ({ fromUserId, answer }) => {
      const peerConnection = peersRef.current[fromUserId];

      if (!peerConnection) return;

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      await flushPendingCandidates(fromUserId, peerConnection);
    };

    const handleReceiveIceCandidate = async ({ fromUserId, candidate }) => {
      const peerConnection = peersRef.current[fromUserId];

      if (
        peerConnection &&
        peerConnection.remoteDescription &&
        peerConnection.remoteDescription.type
      ) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (!pendingCandidatesRef.current[fromUserId]) {
          pendingCandidatesRef.current[fromUserId] = [];
        }

        pendingCandidatesRef.current[fromUserId].push(candidate);
      }
    };

    const handleUserLeft = (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }

      delete remoteStreamsRef.current[userId];
      updateRemoteUsers();

      setMessages((prev) => [
        ...prev,
        {
          type: "system",
          message: `User left the room: ${userId}`,
        },
      ]);
    };

    const handleReceiveMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          type: "message",
          sender: data.sender,
          message: data.message,
        },
      ]);
    };

    socket.on("connect", handleConnect);
    socket.on("existing-users", handleExistingUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("receive-offer", handleReceiveOffer);
    socket.on("receive-answer", handleReceiveAnswer);
    socket.on("receive-ice-candidate", handleReceiveIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("receive-message", handleReceiveMessage);

    if (socket.connected) {
      setMySocketId(socket.id);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("receive-offer", handleReceiveOffer);
      socket.off("receive-answer", handleReceiveAnswer);
      socket.off("receive-ice-candidate", handleReceiveIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("receive-message", handleReceiveMessage);
    };
  }, []);

  const joinRoom = async () => {
    if (!roomId.trim() || !username.trim()) {
      alert("Enter your name and room ID");
      return;
    }

    try {
      await getLocalMedia();

      socket.emit("join-room", roomId);

      setJoined(true);
      setMessages([
        {
          type: "system",
          message: `You joined room: ${roomId}`,
        },
      ]);
    } catch (error) {
      console.error("Media error:", error);
      alert("Camera or microphone permission denied.");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    socket.emit("send-message", {
      roomId,
      message: `${username}: ${message}`,
    });

    setMessage("");
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    });
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setCameraOn(track.enabled);
    });
  };

  const replaceVideoTrackForAllPeers = (newVideoTrack) => {
    Object.values(peersRef.current).forEach((peerConnection) => {
      const sender = peerConnection
        .getSenders()
        .find((item) => item.track && item.track.kind === "video");

      if (sender) {
        sender.replaceTrack(newVideoTrack);
      }
    });
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      replaceVideoTrackForAllPeers(screenTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);
      setCameraOn(true);

      screenTrack.onended = async () => {
        const cameraStream = await getLocalMedia();
        const cameraTrack = cameraStream.getVideoTracks()[0];

        replaceVideoTrackForAllPeers(cameraTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream;
        }

        setScreenSharing(false);
      };
    } catch (error) {
      console.error("Screen sharing error:", error);
      alert("Screen sharing cancelled.");
    }
  };

  const leaveRoom = () => {
    Object.values(peersRef.current).forEach((peerConnection) => {
      peerConnection.close();
    });

    peersRef.current = {};
    remoteStreamsRef.current = {};
    pendingCandidatesRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setRemoteUsers([]);
    setJoined(false);
    setCameraOn(false);
    setMicOn(false);
    setScreenSharing(false);
    setRoomId("");
    setMessages([]);
  };

  const logout = () => {
    leaveRoom();

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setCurrentUser(null);
    setUsername("");
  };

  if (!currentUser) {
    return (
      <Auth
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setUsername(user.username);
        }}
      />
    );
  }

  return (
    <div className="app">
      <div className="main-card">
        <div className="top-bar">
          <div>
            <h1>Real-Time Communication App</h1>
            <p className="subtitle">
              Video conferencing, chat, whiteboard, file sharing and
              collaboration.
            </p>
          </div>

          <button onClick={logout} className="danger-btn">
            Logout
          </button>
        </div>

        {!joined ? (
          <div className="join-box">
            <h2>Join a Room</h2>

            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              type="text"
              placeholder="Room ID, example: room123"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <button onClick={joinRoom}>Join Room</button>
          </div>
        ) : (
          <div className="room-layout">
            <div className="room-info">
              <h2>Room: {roomId}</h2>
              <p>Your socket ID: {mySocketId}</p>
            </div>

            <div className="video-section">
              <h3>Video Conference</h3>

              <div className="video-grid">
                <div className="local-video-card">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="local-video"
                  />
                  <p>You: {username}</p>
                </div>

                {remoteUsers.map((user) => (
                  <RemoteVideo
                    key={user.userId}
                    userId={user.userId}
                    stream={user.stream}
                  />
                ))}
              </div>

              <div className="video-controls">
                <button onClick={toggleCamera}>
                  {cameraOn ? "Camera Off" : "Camera On"}
                </button>

                <button onClick={toggleMic}>
                  {micOn ? "Mute Mic" : "Unmute Mic"}
                </button>

                <button onClick={startScreenShare}>
                  {screenSharing ? "Sharing Screen" : "Share Screen"}
                </button>

                <button onClick={leaveRoom} className="danger-btn">
                  Leave Room
                </button>
              </div>
            </div>

            <Whiteboard roomId={roomId} />

            <FileShare roomId={roomId} username={username} />

            <div className="chat-box">
              <h3>Real-Time Chat</h3>

              <div className="messages">
                {messages.map((item, index) => (
                  <div
                    key={index}
                    className={
                      item.type === "system" ? "system-message" : "chat-message"
                    }
                  >
                    {item.message}
                  </div>
                ))}
              </div>

              <form onSubmit={sendMessage} className="message-form">
                <input
                  type="text"
                  placeholder="Write a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;