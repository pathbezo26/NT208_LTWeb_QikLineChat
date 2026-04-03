import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!username.trim()) return;

    sessionStorage.setItem("username", username);

    // chuyển sang trang chat
    navigate("/chat");
  };

  return (
    <div style={{ width: "300px", margin: "100px auto" }}>
      <h2>Login Chat</h2>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Nhập username"
        style={{ width: "100%", padding: "10px" }}
      />

      <button
        onClick={handleLogin}
        style={{ marginTop: "10px", padding: "10px" }}
      >
        Vào Chat
      </button>
    </div>
  );
}
