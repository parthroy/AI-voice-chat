require("dotenv").config({ path: ".env.local" });
const uuid = require("uuid");
const WebSocket = require("ws");

const path = require("path");
const fs = require("fs");
const https = require("https");
const express = require("express");
const http = require("http");
const util = require("util");
const { generateBotResponse } = require("./utils");

// Define APP
const app = express();
const port = process.env.PORT;
let CLIENT = null;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on("connection", function connection(ws, req) {
  console.log("WebSocket connection opened");

  ws.on("message", function (message) {
    try {
      console.log("Received message:", message.toString());
      const data = message.toString();
    } catch (error) {
      console.error(error);
    }
    // Handle the received message here
  });

  ws.on("close", function (code, reason) {
    console.log(
      "WebSocket connection closed (code: " + code + ", reason: " + reason + ")"
    );
  });
});

app.post("/sendMsg", (req, res) => {
  if (req.body.text) {
    generateBotResponse(req.body.text, "en");
    return res.status(200).json({ msg: "send text successfuly!" });
  }
  res.status(400).json({ msg: "Not valid text!" });
});

server.listen(port, () => {
  console.log("Running server on port %s", port);
});
