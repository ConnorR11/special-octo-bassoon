import React, { useState } from "react"

import { LockKeyhole, LogIn, Mail } from "lucide-react"

import { supabase } from "../lib/supabase"


export default function Login() {

  const [email, setEmail] =
    useState("")

  const [password, setPassword] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState("")


  async function handleSubmit(event) {

    event.preventDefault()

    setError("")

    const cleanEmail =
      email.trim()

    if (!cleanEmail || !password) {

      setError(
        "Please enter your email address and password."
      )

      return
    }

    if (!supabase) {

      setError(
        "Supabase is not configured."
      )

      return
    }

    setLoading(true)

    const {
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (signInError) {

      setError(
        signInError.message ||
          "Unable to sign in."
      )
    }

    setLoading(false)
  }


  return (

    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f7fa",
        padding: 24,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 18px 50px rgba(0, 45, 73, 0.12)",
          overflow: "hidden",
          border: "1px solid #e5eaf0",
        }}
      >

        <div
          style={{
            background: "#002d49",
            color: "#fff",
            padding: "30px 32px",
          }}
        >

          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0877bd",
              fontSize: 20,
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            C
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 25,
              lineHeight: 1.2,
            }}
          >
            CRM
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "rgba(255,255,255,0.72)",
              fontSize: 13,
            }}
          >
            Home Improvements
          </p>

        </div>


        <form
          onSubmit={handleSubmit}
          style={{
            padding: 32,
          }}
        >

          <div
            style={{
              marginBottom: 24,
            }}
          >

            <h2
              style={{
                margin: 0,
                color: "#102a43",
                fontSize: 20,
              }}
            >
              Sign in
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#718096",
                fontSize: 13,
              }}
            >
              Sign in to access the CRM.
            </p>

          </div>


          {error && (

            <div
              style={{
                marginBottom: 18,
                padding: "11px 12px",
                borderRadius: 8,
                background: "#fff1f1",
                border: "1px solid #f2c4c4",
                color: "#9b2c2c",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}


          <label
            style={{
              display: "block",
              marginBottom: 16,
            }}
          >

            <span
              style={{
                display: "block",
                marginBottom: 7,
                color: "#334e68",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Email address
            </span>

            <div
              style={{
                position: "relative",
              }}
            >

              <Mail
                size={17}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#829ab1",
                }}
              />

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                autoFocus
                placeholder="you@company.co.uk"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 44,
                  padding: "0 12px 0 38px",
                  border: "1px solid #d9e2ec",
                  borderRadius: 8,
                  outline: "none",
                  fontSize: 14,
                  color: "#243b53",
                }}
              />

            </div>

          </label>


          <label
            style={{
              display: "block",
              marginBottom: 22,
            }}
          >

            <span
              style={{
                display: "block",
                marginBottom: 7,
                color: "#334e68",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Password
            </span>

            <div
              style={{
                position: "relative",
              }}
            >

              <LockKeyhole
                size={17}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#829ab1",
                }}
              />

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 44,
                  padding: "0 12px 0 38px",
                  border: "1px solid #d9e2ec",
                  borderRadius: 8,
                  outline: "none",
                  fontSize: 14,
                  color: "#243b53",
                }}
              />

            </div>

          </label>


          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 46,
              border: 0,
              borderRadius: 8,
              background: loading
                ? "#7aaed0"
                : "#0877bd",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading
                ? "default"
                : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >

            <LogIn size={17} />

            {loading
              ? "Signing in..."
              : "Sign in"}

          </button>

        </form>

      </div>

    </div>
  )
}
