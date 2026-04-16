const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — grading script needs this
app.use(
    cors({
        origin: "*",
        methods: ["GET"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Health check — always include this
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.get("/api/classify", async (req, res) => {
    const { name } = req.query;

    // 422 — MUST run first before any other check
    if (Array.isArray(name) || (name !== undefined && typeof name !== "string")) {
        return res.status(422).json({
            status: "error",
            message: "name must be a string",
        });
    }

    // 400 — missing or empty
    if (name === undefined || name === null || name.trim() === "") {
        return res.status(400).json({
            status: "error",
            message: "Missing or empty name parameter",
        });
    }

    // 422 — name contains non-alphabetic characters
    if (!/^[a-zA-Z\s-]+$/.test(name.trim())) {
        return res.status(422).json({
            status: "error",
            message: "name must only contain alphabetic characters",
        });
    }

    try {
        const response = await axios.get("https://api.genderize.io", {
            params: { name: name.trim() },
            timeout: 8000,
            headers: {
                Accept: "application/json",
                "User-Agent": "hng14-stage0/1.0",
            },
        });

        const { gender, probability, count } = response.data;

        // Edge case — no prediction available
        if (!gender || gender === null || !count || count === 0) {
            return res.status(200).json({
                status: "error",
                message: "No prediction available for the provided name",
            });
        }

        const sample_size = count;
        const is_confident = probability >= 0.7 && sample_size >= 100;
        const processed_at = new Date().toISOString();

        return res.status(200).json({
            status: "success",
            data: {
                name: name.trim().toLowerCase(),
                gender,
                probability,
                sample_size,
                is_confident,
                processed_at,
            },
        });
    } catch (error) {
        console.error("Error:", error.message);

        // Genderize returned a non-2xx response
        if (error.response) {
            return res.status(502).json({
                status: "error",
                message: "Upstream API error",
            });
        }

        // Network timeout or no response
        if (error.request) {
            return res.status(502).json({
                status: "error",
                message: "Could not reach upstream API",
            });
        }

        // Everything else
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
        });
    }
});

// 404 — catch all unknown routes
app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: "Route not found",
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});