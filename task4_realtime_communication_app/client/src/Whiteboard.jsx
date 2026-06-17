import { useEffect, useRef, useState } from "react";
import socket from "./socket";

function Whiteboard({ roomId }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(3);

  const getCanvasPosition = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawLine = ({ x0, y0, x1, y1, color, lineWidth }) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const startDrawing = (event) => {
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPosition(event);
  };

  const draw = (event) => {
    if (!isDrawingRef.current) return;

    const currentPoint = getCanvasPosition(event);

    const drawData = {
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: currentPoint.x,
      y1: currentPoint.y,
      color,
      lineWidth,
    };

    drawLine(drawData);

    socket.emit("draw", {
      roomId,
      drawData,
    });

    lastPointRef.current = currentPoint;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    socket.emit("clear-whiteboard", roomId);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const handleReceiveDraw = (drawData) => {
      drawLine(drawData);
    };

    const handleClearWhiteboard = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("receive-draw", handleReceiveDraw);
    socket.on("whiteboard-cleared", handleClearWhiteboard);

    return () => {
      socket.off("receive-draw", handleReceiveDraw);
      socket.off("whiteboard-cleared", handleClearWhiteboard);
    };
  }, []);

  return (
    <div className="whiteboard-section">
      <h3>Shared Whiteboard</h3>

      <div className="whiteboard-tools">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <select
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
        >
          <option value="2">Thin</option>
          <option value="4">Medium</option>
          <option value="7">Thick</option>
        </select>

        <button onClick={clearBoard} className="danger-btn">
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width="900"
        height="400"
        className="whiteboard-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
}

export default Whiteboard;