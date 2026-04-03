import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "../App.css";

const socket = io("http://localhost:3000");

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { user: "System", text: "Chào mừng bạn đến với phòng chat!" }
  ]);
  const [input, setInput] = useState("");
  const username = localStorage.getItem("username") || "Guest";
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.emit("join", username);

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => socket.off("message");
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("chatMessage", input);
    setInput("");
  };

  return (
    <div className="app">
      <div className="chat-box">
        <div className="header">
          <span className="dot"></span>
          <h3>Phòng Trực Tuyến - {username}</h3>
        </div>

        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={msg.user === username ? "my-msg" : "other-msg"}
            >
              <b>{msg.user === username ? "Bạn" : msg.user}:</b> {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef}></div>
        </div>

        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Soạn tin nhắn..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Gửi</button>
        </div>
      </div>
    </div>
  );
}
