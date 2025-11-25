import React, { useEffect, useRef, useState } from "react";
import beepFile from "./assets/beep.mp3";
import "./Chat.css"; // Ensure you created this file from Step 1

export default function Chat() {
    // Audio
    const beepSound = new Audio(beepFile);
    let beepInterval = null;

    // Refs for UI elements
    const ringBox = useRef(null);
    const callButton = useRef(null);
    const endCallBtn = useRef(null);
    const callStatus = useRef(null);
    const timer = useRef(null);

    // State
    const [peerConnection, setPeerConnection] = useState(null);
    const [dataChannel, setDataChannel] = useState(null);
    const [seconds, setSeconds] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [timerInterval, setTimerInterval] = useState(null);

    // =====================
    //    START CALL
    // =====================

    const startCall = async () => {
        // Logic requires this to be block, but we handle layout in CSS parent
        ringBox.current.style.display = "block"; 
        
        // Hide the start button when call starts to mimic the UI transition
        if(callButton.current) callButton.current.style.display = "none";

        callStatus.current.textContent = "Connecting...";
        startBeeping();
        await initOpenAIRealtime();
    };

    const startBeeping = () => {
        beepSound.play();
        beepInterval = setInterval(() => beepSound.play(), 3000);
    };

    const stopBeeping = () => {
        clearInterval(beepInterval);
    };

    // ======================
    //  TOOL FUNCTIONS
    // ======================

    const fns = {
        changeBackgroundColor: ({ color1, color2 }) => {
            // This will change the orb gradient dynamically based on AI response
            ringBox.current.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
            return { success: true, color1, color2 };
        },

        sendEmail: async ({ message }) => {
            try {
                await sendEmail(message);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    };

    // ======================
    // REALTIME INIT
    // ======================

    const initOpenAIRealtime = async () => {
        try {
            const tokenResponse = await fetch("http://localhost:5000/session");
            const data = await tokenResponse.json();
            const EPHEMERAL_KEY = data.client_secret.value;

            const pc = new RTCPeerConnection();
            setPeerConnection(pc);

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") {
                    stopBeeping();
                    setIsConnected(true);

                    callStatus.current.textContent = "Listening";
                    timer.current.style.display = "block";
                    startTimer();
                    endCallBtn.current.style.display = "flex"; // Changed to flex for centering
                }
            };

            // Audio receive
            const audioElement = document.createElement("audio");
            audioElement.autoplay = true;
            pc.ontrack = event => (audioElement.srcObject = event.streams[0]);

            // Audio send
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            pc.addTrack(mediaStream.getTracks()[0]);

            // Data channel
            const dc = pc.createDataChannel("response");
            setDataChannel(dc);

            dc.onopen = () => configureData(dc);

            dc.onmessage = async (ev) => {
                const msg = JSON.parse(ev.data);

                if (msg.type === "response.function_call_arguments.done") {
                    const fn = fns[msg.name];
                    if (fn) {
                        const result = await fn(JSON.parse(msg.arguments));
                        dc.send(JSON.stringify({
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: msg.call_id,
                                output: JSON.stringify(result)
                            }
                        }));
                    }
                }
            };

            // Offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const model = "gpt-4o-realtime-preview-2024-12-17";

            const sdpResponse = await fetch(
                `https://api.openai.com/v1/realtime?model=${model}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${EPHEMERAL_KEY}`,
                        "Content-Type": "application/sdp"
                    },
                    body: offer.sdp
                }
            );

            const answer = {
                type: "answer",
                sdp: await sdpResponse.text()
            };

            await pc.setRemoteDescription(answer);

        } catch (error) {
            console.error(error);
            endCall();
        }
    };

    // Send tools metadata
    const configureData = (dc) => {
        dc.send(JSON.stringify({
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                tools: [
                    {
                        type: "function",
                        name: "changeBackgroundColor",
                        description: "Changes color",
                        parameters: {
                            type: "object",
                            properties: {
                                color1: { type: "string" },
                                color2: { type: "string" }
                            },
                            required: ["color1", "color2"]
                        }
                    },
                    {
                        type: "function",
                        name: "sendEmail",
                        description: "Send email",
                        parameters: {
                            type: "object",
                            properties: {
                                message: { type: "string" }
                            },
                            required: ["message"]
                        }
                    }
                ]
            }
        }));
    };

    // ======================
    // TIMER
    // ======================

    const startTimer = () => {
        const interval = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);

        setTimerInterval(interval);
    };

    const stopTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        setSeconds(0);
    };

    const formatTime = (s) => {
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;

        return `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // ======================
    // END CALL
    // ======================

    const endCall = () => {
        stopBeeping();
        stopTimer();

        if (peerConnection) {
            peerConnection.close();
            setPeerConnection(null);
        }

        if (isConnected) {
            callStatus.current.textContent = `Duration: ${formatTime(seconds)}`;
            endCallBtn.current.style.display = "none";

            setTimeout(() => {
                ringBox.current.style.display = "none";
                callButton.current.style.display = "flex"; // Reset to flex
                callStatus.current.textContent = "";
            }, 3000);
        } else {
             // Handle case where call was cancelled before connection
            ringBox.current.style.display = "none";
            if(callButton.current) callButton.current.style.display = "flex";
        }

        setIsConnected(false);
    };

    // ======================
    // SEND EMAIL
    // ======================

    async function sendEmail(message) {
        await fetch("http://localhost:5000/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
    }

    // ======================
    // RENDER UI
    // ======================

    return (
        <div className="chat-container">
            {/* 1. The Glowing Orb Section (Hidden by default, toggled by ref) */}
            <div className="orb-container">
                <div 
                    ref={ringBox} 
                    className="orb" 
                    style={{ display: "none" }} // Logic controls this
                ></div>
                
                <div ref={callStatus} className="status-text">Ready to call</div>
                
                <div ref={timer} className="timer-text" style={{ display: "none" }}>
                    {formatTime(seconds)}
                </div>
            </div>

            {/* 2. The Controls (Buttons) */}
            <div className="controls">
                {/* Start Call Button (Mic Icon) */}
                <button ref={callButton} className="control-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                </button>

                {/* End Call Button (X Icon) - Hidden by default */}
                <button 
                    ref={endCallBtn} 
                    className="control-btn btn-end" 
                    style={{ display: "none" }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            {/* Event bindings preserved from your original code */}
            <div style={{ display: "none" }}>
                <span>
                    {useEffect(() => {
                        if (callButton.current) callButton.current.onclick = startCall;
                        if (endCallBtn.current) endCallBtn.current.onclick = endCall;
                    })}
                </span>
            </div>
        </div>
    );
}



// // ================================================
// // react native
// // =================================================
// import React, { useState, useRef } from "react";
// import beepFile from "./assets/beep.mp3";
// import "./Chat.css";

// // ==========================================================
// //   Chat Component (Single-file logic + UI, RN compatible)
// // ==========================================================

// export default function Chat() {
//   // ---------- UI STATE ----------
//   const [showOrb, setShowOrb] = useState(false);
//   const [showStart, setShowStart] = useState(true);
//   const [showEnd, setShowEnd] = useState(false);
//   const [status, setStatus] = useState("Ready to call");
//   const [showTimer, setShowTimer] = useState(false);
//   const [seconds, setSeconds] = useState(0);
//   const [orbColors, setOrbColors] = useState(["#444", "#222"]);

//   // ---------- LOGIC STATE ----------
//   const [pc, setPC] = useState(null);
//   const [dc, setDC] = useState(null);
//   const [connected, setConnected] = useState(false);

//   let timerHandle = useRef(null);
//   const beepSound = new Audio(beepFile);
//   let beepInterval = useRef(null);

//   // ==========================================================
//   //                 TIMER FUNCTIONS
//   // ==========================================================

//   const startTimer = () => {
//     timerHandle.current = setInterval(() => {
//       setSeconds((s) => s + 1);
//     }, 1000);
//   };

//   const stopTimer = () => {
//     clearInterval(timerHandle.current);
//     setSeconds(0);
//   };

//   const formatTime = (s) => {
//     const h = String(Math.floor(s / 3600)).padStart(2, "0");
//     const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
//     const sec = String(s % 60).padStart(2, "0");
//     return `${h}:${m}:${sec}`;
//   };

//   // ==========================================================
//   //                 BEEP FUNCTIONS
//   // ==========================================================

//   const startBeeping = () => {
//     beepSound.play();
//     beepInterval.current = setInterval(() => beepSound.play(), 3000);
//   };

//   const stopBeeping = () => {
//     clearInterval(beepInterval.current);
//   };

//   // ==========================================================
//   //       MAIN: INIT REALTIME + WEBRTC
//   // ==========================================================

//   const startCall = async () => {
//     setShowOrb(true);
//     setShowStart(false);
//     setStatus("Connecting...");

//     startBeeping();
//     await initOpenAIRealtime();
//   };

//   const initOpenAIRealtime = async () => {
//     try {
//       // Get ephemeral key
//       const token = await fetch("http://localhost:5000/session");
//       const data = await token.json();
//       const KEY = data.client_secret.value;

//       // Create RTCPeerConnection
//       const rtc = new RTCPeerConnection();
//       setPC(rtc);

//       // ----- Connection established -----
//       rtc.onconnectionstatechange = () => {
//         if (rtc.connectionState === "connected") {
//           stopBeeping();
//           setStatus("Listening");
//           setShowTimer(true);
//           setShowEnd(true);
//           setConnected(true);
//           startTimer();
//         }
//       };

//       // ----- Incoming Audio -----
//       rtc.ontrack = (ev) => {
//         // Web audio playback only
//         const audio = new Audio();
//         audio.srcObject = ev.streams[0];
//         audio.play();
//       };

//       // ----- Outgoing Audio -----
//       const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
//       rtc.addTrack(mic.getTracks()[0]);

//       // ----- Data Channel -----
//       const channel = rtc.createDataChannel("response");
//       setDC(channel);

//       channel.onopen = () => sendToolsMetadata(channel);

//       channel.onmessage = async (event) => {
//         const msg = JSON.parse(event.data);
//         if (msg.type === "response.function_call_arguments.done") {
//           const args = JSON.parse(msg.arguments);
//           const result = await handleFunction(msg.name, args);

//           channel.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "function_call_output",
//                 call_id: msg.call_id,
//                 output: JSON.stringify(result)
//               }
//             })
//           );
//         }
//       };

//       // ----- Create SDP Offer -----
//       const offer = await rtc.createOffer();
//       await rtc.setLocalDescription(offer);

//       const sdpResp = await fetch(
//         "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${KEY}`,
//             "Content-Type": "application/sdp"
//           },
//           body: offer.sdp
//         }
//       );

//       const answer = { type: "answer", sdp: await sdpResp.text() };
//       await rtc.setRemoteDescription(answer);
//     } catch (err) {
//       console.error(err);
//       endCall();
//     }
//   };

//   // ==========================================================
//   //                  TOOL HANDLERS
//   // ==========================================================

//   const handleFunction = async (name, args) => {
//     if (name === "changeBackgroundColor") {
//       setOrbColors([args.color1, args.color2]);
//       return { success: true };
//     }

//     if (name === "sendEmail") {
//       await sendEmail(args.message);
//       return { success: true };
//     }

//     return { success: false };
//   };

//   const sendToolsMetadata = (dc) => {
//     dc.send(
//       JSON.stringify({
//         type: "session.update",
//         session: {
//           modalities: ["text", "audio"],
//           tools: [
//             {
//               type: "function",
//               name: "changeBackgroundColor",
//               parameters: {
//                 type: "object",
//                 properties: {
//                   color1: { type: "string" },
//                   color2: { type: "string" }
//                 },
//                 required: ["color1", "color2"]
//               }
//             },
//             {
//               type: "function",
//               name: "sendEmail",
//               parameters: {
//                 type: "object",
//                 properties: {
//                   message: { type: "string" }
//                 },
//                 required: ["message"]
//               }
//             }
//           ]
//         }
//       })
//     );
//   };

//   // ==========================================================
//   //                  END CALL
//   // ==========================================================

//   const endCall = () => {
//     stopBeeping();
//     stopTimer();

//     if (pc) pc.close();

//     setPC(null);
//     setDC(null);

//     if (connected) {
//       setStatus(`Duration: ${formatTime(seconds)}`);
//       setShowEnd(false);

//       setTimeout(() => {
//         setShowOrb(false);
//         setShowStart(true);
//         setShowTimer(false);
//         setStatus("Ready to call");
//       }, 2500);
//     } else {
//       setShowOrb(false);
//       setShowStart(true);
//     }

//     setConnected(false);
//   };

//   // ==========================================================
//   //                  EMAIL SEND
//   // ==========================================================

//   const sendEmail = async (message) => {
//     await fetch("http://localhost:5000/send-email", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ message })
//     });
//   };

//   // ==========================================================
//   //                          UI
//   // ==========================================================

//   return (
//     <div className="chat-container">
//       {/* ORB + STATUS */}
//       <div className="orb-container">
//         {showOrb && (
//           <div
//             className="orb"
//             style={{
//               background: `linear-gradient(135deg, ${orbColors[0]}, ${orbColors[1]})`
//             }}
//           ></div>
//         )}

//         <div className="status-text">{status}</div>

//         {showTimer && (
//           <div className="timer-text">{formatTime(seconds)}</div>
//         )}
//       </div>

//       {/* BUTTONS */}
//       <div className="controls">
//         {showStart && (
//           <button className="control-btn" onClick={startCall}>
//             🎤
//           </button>
//         )}

//         {showEnd && (
//           <button className="control-btn btn-end" onClick={endCall}>
//             ❌
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }
