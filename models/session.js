const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let Session;
try {
  Session = mongoose.model("Session");
} catch (error) {
  if (error.name === "MissingSchemaError") {
    const sessionSchema = new Schema({
      sessionId: { type: String, required: true, unique: true },
      participants: [
        {
          userId: { type: String, default: "" },
          name: { type: String, default: "" },
          socketId: { type: String, default: "" },
          photo: { type: String, default: "" },
          micOn: { type: Boolean, default: false },
          videoOn: { type: Boolean, default: false },
        },
      ],
      chat: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          photo: { type: String, default: "" },
          message: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      createdAt: { type: Date, default: Date.now, expires: "1d" }, // Sessions expire after 1 day
    });
    Session = mongoose.model("Session", sessionSchema);
  } else {
    throw error;
  }
}

module.exports = Session;