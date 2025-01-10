require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const connectDB = require("./config/connect");
const notFoundMiddleware = require("./middleware/notFoundMiddleware");
const errorHandlerMiddleware = require("./middleware/errorHandlerMiddleware");

const webRTCSignalingSocket = require("./controllers/sockets");
const Session = require("./models/session");

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.post("/create-session", async (req, res) => {
  try {
    const sessionId = Math.random().toString(36).substring(2, 9);
    const session = new Session({ sessionId, participants: [] });
    await session.save();
    res.json({ sessionId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/is-alive", async (req, res) => {
  try {
    const { sessionId } = req.query;
    const session = await Session.findOne({ sessionId });
    res.json({ isAlive: session });
  } catch (error) {
    console.log(error);
  }
});

app.use((req, res, next) => {
  req.io = io;
  return next();
});

webRTCSignalingSocket(io);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await connectDB();
    server.listen(3000, "0.0.0.0", () => {
      console.log("Server is running on port 3000");
    });
  } catch (error) {
    console.error(error);
  }
};

start();