import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Chat from "./Chat"; // <--- NO curly braces around Chat

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Chat />} />
            </Routes>
        </Router>
    );
}
