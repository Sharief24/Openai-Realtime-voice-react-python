# Openai-Realtime-voice-react-python
A realtime voice interaction demo using OpenAI’s voice models with a React frontend and Python backend.
OpenAI Realtime Voice – React + Python

A realtime voice interaction demo using OpenAI’s voice models powered by a React frontend and Python backend.

🚀 Features

Live voice interaction using OpenAI Realtime API

React frontend for capturing microphone & playing AI responses

Python Flask backend for session creation

CORS configured for local development

Simple and clean structure for quick integration

📁 Project Structure
frontend/   → React application (UI + audio logic)
backend/    → Python Flask server (OpenAI session API)

🔧 Backend Setup (Python)
1. Install dependencies
pip install -r requirements.txt

2. Create .env file
OPENAI_API_KEY=your_api_key_here

3. Start the backend
python app.py


Server runs at:

http://localhost:5000

🎨 Frontend Setup (React)

Inside frontend/:

npm install
npm start


Runs at:

http://localhost:3000

🔗 API Endpoints
GET /session

Creates and returns an OpenAI realtime session.

POST /send-email

Returns a success response (email logic disabled).

📦 Requirements

Backend dependencies:

flask

flask-cors

python-dotenv

requests

Preview:
<img width="1070" height="739" alt="image" src="https://github.com/user-attachments/assets/0562ebe5-90cf-4d5c-8419-a30e2f921f5d" />
<img width="743" height="605" alt="image" src="https://github.com/user-attachments/assets/1e36249a-2235-45d5-914d-18159584b4f1" />


