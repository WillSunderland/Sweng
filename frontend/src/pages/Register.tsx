import { useState } from "react";
import { useNavigate } from "react-router-dom";
import eye from "../assets/closedEye.png";
import eyeOff from "../assets/openEye.png";
import { API_BASE_URL } from "../constants/apiConfig";

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const resolvedUsername = username.trim() || email.trim();
    if (!resolvedUsername) {
      setError("Username or email is required");
      return;
    }

    try {
      const registerRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resolvedUsername, email, password }),
      });

      if (!registerRes.ok) {
        const msg = await registerRes.text();
        throw new Error(msg || "Failed to register");
      }

      const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resolvedUsername, password }),
        credentials: "include",
      });

      if (!loginRes.ok) {
        const msg = await loginRes.text();
        throw new Error(msg || "Failed to login");
      }

      const data = await loginRes.json();
      const token = data.access ?? data.token;
      if (token) {
        localStorage.setItem("token", token);
      }
      navigate("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white w-[420px] p-8 rounded-2xl shadow-lg">
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="font-medium text-sm text-gray-600">USERNAME</label>
            <input
              type="text"
              placeholder="legal.professional"
              className="w-full mt-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="font-medium text-sm text-gray-600">EMAIL ADDRESS</label>
            <input
              type="email"
              placeholder="legal.professional@firm.com"
              className="w-full mt-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <label className="font-medium text-sm text-gray-600">PASSWORD</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="········"
              className="w-full mt-1 border rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {password.length > 0 && (
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 opacity-70 hover:opacity-100">
                <img src={showPassword ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="relative">
            <label className="font-medium text-sm text-gray-600">CONFIRM PASSWORD</label>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="········"
              className="w-full mt-1 border rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword.length > 0 && (
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-9 opacity-70 hover:opacity-100">
                <img src={showConfirm ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
              </button>
            )}
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition">
            Create Account
          </button>

          <div className="text-center text-sm text-gray-500">Already have an account?</div>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full border border-gray-300 hover:border-blue-500 hover:text-blue-600 py-3 rounded-lg font-medium transition"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
