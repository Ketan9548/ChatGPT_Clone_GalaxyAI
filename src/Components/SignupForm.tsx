"use client";

import { useState } from "react";

export default function SignupForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) setMessage("Signup successful! Please login.");
      else setMessage(data.error || "Signup failed");
    } catch {
      setMessage("Error occurred");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        name="name"
        placeholder="Name"
        className="w-full p-2 rounded bg-gray-800"
        value={form.name}
        onChange={handleChange}
      />
      <input
        name="email"
        placeholder="Email"
        className="w-full p-2 rounded bg-gray-800"
        value={form.email}
        onChange={handleChange}
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        className="w-full p-2 rounded bg-gray-800"
        value={form.password}
        onChange={handleChange}
      />
      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 p-2 rounded"
        disabled={loading}
      >
        {loading ? "Signing up..." : "Sign Up"}
      </button>
      {message && <p className="text-sm text-center text-gray-400">{message}</p>}
    </form>
  );
}
