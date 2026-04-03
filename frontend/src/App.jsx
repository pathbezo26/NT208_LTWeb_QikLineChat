import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./App.css";

const socket = io("http://localhost:3000");

function App() {
  const [messages, setMessages] = useState([
    { user: "System", text: "Chào mừng bạn đến với phòng chat!" }
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const username = sessionStorage.getItem("username");

  useEffect(() => {
    // chưa login thì quay về login
    if (!username) {
      navigate("/");
      return;
    }

    socket.emit("join", username);

    const handleMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("message", handleMessage);

    return () => {
      socket.off("message", handleMessage);
    };
  }, [username, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    socket.emit("chatMessage", input);
    setInput("");
  };

  const logout = () => {
    sessionStorage.removeItem("username");
    navigate("/");
  };

  return (
    <div className="app">
      <div className="chat-box">
        <div className="header">
          <span className="dot"></span>
          <h3>Xin chào, {username}</h3>
          <button
            onClick={logout}
            style={{ marginLeft: "auto", padding: "5px 10px" }}
          >
            Logout
          </button>
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

export default App;
