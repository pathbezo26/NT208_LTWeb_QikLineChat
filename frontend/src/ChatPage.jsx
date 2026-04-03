import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const username = sessionStorage.getItem("username");

  useEffect(() => {
    socket.emit("join", username);

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => socket.off("message");
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("chatMessage", input);
    setInput("");
  };

  return (
    <div style={{ width: "450px", margin: "50px auto" }}>
      <h2>Xin chào, {username}</h2>

      <div
        style={{
          border: "1px solid #ccc",
          height: "400px",
          overflowY: "auto",
          padding: "10px"
        }}
      >
        {messages.map((msg, index) => (
          <div key={index}>
            <b>{msg.user}:</b> {msg.text}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Nhập tin nhắn"
        style={{ width: "80%" }}
      />
      <button onClick={sendMessage}>Gửi</button>
    </div>
  );
}
