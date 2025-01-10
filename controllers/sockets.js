const Session = require("../models/session");

const webRTCSignalingSocket = (io) => {
    io.on("connection", (socket) => {
        console.log("userConnected:", socket.id);

        // Event: Prepare Session
        socket.on("prepare-session", async ({ sessionId, userId }) => {
            console.log(`user ${userId} is preparing session ${sessionId}`);
            if (sessionId) {
                socket.join(sessionId);
                console.log(`user ${userId} joined session ${sessionId}`);

                const session = await findSessionById(sessionId);
                if (session) {
                    socket.emit("session-info", {
                        participants: session.participants,
                    });
                } else {
                    socket.emit("error", { message: "Session not found" });
                }

                socket.on("disconnect", async () => {
                    console.log(`user ${userId} disconnected`);
                    await handleUserDisconnect(sessionId, userId, socket.id);
                });
            } else {
                console.log(`user ${userId} is not found in session ${sessionId}`);
                socket.emit("error", { message: "Session not found" });
            }
        });

        // Event: Join Session
        socket.on("join-session", async ({ sessionId, userId, name, photo, micOn, videoOn }) => {
            console.log(`user ${userId} is joining session ${sessionId}`);
            const session = await findSessionById(sessionId);
            if (session) {
                await addOrUpdateParticipant(session, userId, name, photo, micOn, videoOn, socket.id);
                socket.join(sessionId);
                console.log(`user ${userId} joined session ${sessionId}`);
                io.to(sessionId).emit("new-participant",
                    session.participants?.find((i) => i.userId === userId)
                );
                socket.emit("session-info", { participants: session.participants });
            } else {
                console.log(`user ${userId} is not found in session ${sessionId}`);
                socket.emit("error", { message: "Session not found" });
            }
        });

        // Event: Get Current Room Info
        socket.on("current-room", async ({ sessionId }) => {
            const session = await findSessionById(sessionId);
            if (session) {
                socket.emit("current-room-info", {
                    participants: session.participants,
                    chat: session.chat,
                });
            } else {
                socket.emit("error", { message: "Session not found" });
            }
        });

        // Event: Send Offer (WebRTC)
        socket.on("send-offer", ({ sessionId, offer, toUserId }) => {
            console.log(`offer sent from ${socket.id} to ${toUserId}`);
            socket.to(toUserId).emit("receive-offer", { offer, fromUserId: socket.id });
        });

        // Event: Send Answer (WebRTC)
        socket.on("send-answer", ({ sessionId, answer, toUserId }) => {
            console.log(`answer sent from ${socket.id} to ${toUserId}`);
            socket.to(toUserId).emit("receive-answer", { answer, fromUserId: socket.id });
        });

        // Event: Send ICE Candidate (WebRTC)
        socket.on("send-ice-candidate", ({ sessionId, candidate, toUserId }) => {
            console.log(`ICE candidate sent from ${socket.id} to ${toUserId}`);
            socket.to(toUserId).emit("receive-ice-candidate", { candidate, fromUserId: socket.id });
        });

        // Event: Hang Up (End Call)
        socket.on("hang-up", async ({ sessionId, userId }) => {
            console.log(`user ${userId} hung up in session ${sessionId}`);
            await handleUserDisconnect(sessionId, userId, socket.id);
            socket.emit("call-ended");
        });

        // Event: Toggle Microphone
        socket.on("toggle-mic", async ({ sessionId, userId, micOn }) => {
            const session = await findSessionById(sessionId);
            if (session) {
                await updateParticipant(session, userId, { micOn });
                io.to(sessionId).emit("participant-updated", session.participants.find((p) => p.userId === userId));
            }
        });

        // Event: Toggle Video
        socket.on("toggle-video", async ({ sessionId, userId, videoOn }) => {
            const session = await findSessionById(sessionId);
            if (session) {
                await updateParticipant(session, userId, { videoOn });
                io.to(sessionId).emit("participant-updated", session.participants.find((p) => p.userId === userId));
            }
        });

        // Event: Send Message
        socket.on("send-message", async ({ sessionId, userId, message }) => {
            const session = await findSessionById(sessionId);
            if (session) {
                const participant = session.participants.find((p) => p.userId === userId);
                if (participant) {
                    const chatMessage = {
                        userId,
                        name: participant.name,
                        photo: participant.photo,
                        message,
                        timestamp: new Date(),
                    };
                    session.chat.push(chatMessage);
                    await session.save();
                    io.to(sessionId).emit("new-message", chatMessage);
                }
            }
        });

        // Event: Leave Session
        socket.on("leave-session", async ({ sessionId, userId }) => {
            await handleUserDisconnect(sessionId, userId, socket.id);
        });

        // Event: Disconnect
        socket.on("disconnect", async () => {
            console.log(`user disconnected: ${socket.id}`);
            // Handle user disconnect logic here if needed
        });
    });

    // Helper function to find a session by ID
    const findSessionById = async (sessionId) => {
        return await Session.findOne({ sessionId });
    };

    // Helper function to add or update a participant in a session
    const addOrUpdateParticipant = async (session, userId, name, photo, micOn, videoOn, socketId) => {
        const existingParticipant = session.participants.findIndex(
            (p) => p.userId === userId
        );
        if (existingParticipant !== -1) {
            session.participants[existingParticipant] = {
                ...session.participants[existingParticipant],
                name: name || session.participants[existingParticipant].name,
                photo: photo || session.participants[existingParticipant].photo,
                micOn: micOn || session.participants[existingParticipant].micOn,
                videoOn: videoOn || session.participants[existingParticipant].videoOn,
                socketId: socketId,
            };
        } else {
            const participant = {
                userId,
                name,
                photo,
                micOn,
                videoOn,
                socketId: socketId,
            };
            session.participants.push(participant);
        }
        await session.save();
    };

    // Helper function to update a participant's properties
    const updateParticipant = async (session, userId, updates) => {
        const participant = session.participants.find((p) => p.userId === userId);
        if (participant) {
            Object.assign(participant, updates);
            await session.save();
        }
    };

    // Helper function to handle user disconnect
    const handleUserDisconnect = async (sessionId, userId, socketId) => {
        const session = await findSessionById(sessionId);
        if (session) {
            const participantIndex = session.participants.findIndex((p) => p.userId === userId);
            if (participantIndex !== -1) {
                const [participant] = session.participants.splice(participantIndex, 1);
                await session.save();
                io.to(sessionId).emit("participant-left", participant);
            }
        }
    };
};

module.exports = webRTCSignalingSocket;