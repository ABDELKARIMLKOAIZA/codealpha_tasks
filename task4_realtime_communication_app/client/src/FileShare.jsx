import { useEffect, useState } from "react";
import socket from "./socket";

function FileShare({ roomId, username }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const handleReceiveFile = (fileData) => {
      setFiles((prev) => [fileData, ...prev]);
    };

    socket.on("receive-file", handleReceiveFile);

    return () => {
      socket.off("receive-file", handleReceiveFile);
    };
  }, []);

  const uploadFile = async () => {
    if (!selectedFile) {
      alert("Choose a file first");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      const fileData = {
        originalName: data.originalName,
        fileUrl: data.fileUrl,
        sender: username,
        sharedAt: new Date().toLocaleTimeString(),
      };

      socket.emit("file-shared", {
        roomId,
        fileData,
      });

      setSelectedFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      alert("File upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-section">
      <h3>File Sharing</h3>

      <div className="file-upload-box">
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />

        <button onClick={uploadFile} disabled={uploading}>
          {uploading ? "Uploading..." : "Share File"}
        </button>
      </div>

      <div className="shared-files">
        {files.length === 0 ? (
          <p className="no-files">No files shared yet.</p>
        ) : (
          files.map((file, index) => (
            <div key={index} className="file-card">
              <div>
                <strong>{file.originalName}</strong>
                <p>
                  Shared by {file.sender} at {file.sharedAt}
                </p>
              </div>

              <a href={file.fileUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FileShare;