import { useState } from "react";
<<<<<<< HEAD
import { useNavigate } from "react-router-dom";
import eye from "../assets/closedEye.png";
import eyeOff from "../assets/openEye.png";

export default function Login() {
  const navigate = useNavigate();
=======
import eye from "../assets/closedEye.png";
import eyeOff from "../assets/openEye.png";

type LoginProps = {
  onLogin: () => void;
  onCreateAccount: () => void;
};

export default function Login({ onLogin, onCreateAccount }: LoginProps) {
>>>>>>> abf7f1eaa (import login UI from old branch)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
<<<<<<< HEAD
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
=======
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
>>>>>>> abf7f1eaa (import login UI from old branch)
      });

      if (!res.ok) throw new Error("Invalid credentials");

      const data = await res.json();
<<<<<<< HEAD
      localStorage.setItem("token", data.token);
      navigate("/workspace");
=======

      localStorage.setItem("token", data.token);
      onLogin();

>>>>>>> abf7f1eaa (import login UI from old branch)
    } catch {
      setError("Email or password incorrect");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white w-[420px] p-8 rounded-2xl shadow-lg">
<<<<<<< HEAD
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleLogin} className="space-y-5">
=======

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
>>>>>>> abf7f1eaa (import login UI from old branch)
          <div>
            <div className="flex justify-between text-sm text-gray-600">
              <label className="font-medium">EMAIL ADDRESS</label>
            </div>

            <input
              type="email"
              placeholder="legal.professional@firm.com"
              className="w-full mt-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
<<<<<<< HEAD
              onChange={(e) => setEmail(e.target.value)}
=======
              onChange={e => setEmail(e.target.value)}
>>>>>>> abf7f1eaa (import login UI from old branch)
              required
            />
          </div>

<<<<<<< HEAD
          <div>
            <div className="flex justify-between text-sm text-gray-600">
              <label className="font-medium">PASSWORD</label>
              <span className="text-blue-600 cursor-pointer hover:underline">Forgot Password?</span>
=======
          {/* Password */}
          <div>
            <div className="flex justify-between text-sm text-gray-600">
              <label className="font-medium">PASSWORD</label>
              <span className="text-blue-600 cursor-pointer hover:underline">
                Forgot Password?
              </span>
>>>>>>> abf7f1eaa (import login UI from old branch)
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="········"
                className="w-full mt-1 border rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
<<<<<<< HEAD
                onChange={(e) => setPassword(e.target.value)}
=======
                onChange={e => setPassword(e.target.value)}
>>>>>>> abf7f1eaa (import login UI from old branch)
                required
              />

              {password.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                >
<<<<<<< HEAD
                  <img src={showPassword ? eyeOff : eye} alt="toggle password" className="w-5 h-5" />
=======
                  <img
                    src={showPassword ? eyeOff : eye}
                    alt="toggle password"
                    className="w-5 h-5"
                  />
>>>>>>> abf7f1eaa (import login UI from old branch)
                </button>
              )}
            </div>
          </div>

<<<<<<< HEAD
=======
          {/* Sign in button */}
>>>>>>> abf7f1eaa (import login UI from old branch)
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition">
            Sign In
          </button>

<<<<<<< HEAD
          <div className="text-center text-sm text-gray-500">Don’t have an account?</div>

          <button
            type="button"
            onClick={() => navigate("/register")}
=======
          {/* Create account */}
          <div className="text-center text-sm text-gray-500">
            Don’t have an account?
          </div>

          <button
            type="button"
            onClick={onCreateAccount}
>>>>>>> abf7f1eaa (import login UI from old branch)
            className="w-full border border-gray-300 hover:border-blue-500 hover:text-blue-600 py-3 rounded-lg font-medium transition"
          >
            Create Account
          </button>
<<<<<<< HEAD
=======

>>>>>>> abf7f1eaa (import login UI from old branch)
        </form>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> abf7f1eaa (import login UI from old branch)
