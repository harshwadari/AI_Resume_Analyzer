# Full Stack GenAI

A full-stack AI interview preparation app that helps users generate personalized interview reports from a resume, self description, and job description.

## Live Demo

Frontend: https://ai-resume-analyzer-gray-ten.vercel.app/

## Features

- User registration, login, logout, and protected routes
- Email OTP verification for new accounts
- Forgot/reset password flow
- Google OAuth login
- Resume PDF upload and parsing
- AI-generated interview report using Google GenAI
- Match score, strengths, technical questions, behavioral questions, skill gaps, and 5-day preparation plan
- Saved interview reports per authenticated user
- Contact form email support

## Tech Stack

**Frontend**
- React 19
- Vite
- React Router
- Axios
- Tailwind CSS / SCSS
- Lucide React icons

**Backend**
- Node.js
- Express
- MongoDB with Mongoose
- JWT authentication with httpOnly cookie support
- Passport Google OAuth
- Multer and pdf-parse for resume uploads
- Google GenAI
- Nodemailer / Brevo email support
- Zod validation

## Project Structure

```text
.
+-- Backend
|   +-- server.js
|   +-- package.json
|   +-- src
|       +-- app.js
|       +-- config
|       +-- controllers
|       +-- middlewares
|       +-- models
|       +-- Routes
|       +-- services
|       +-- utils
|       +-- validations
+-- Frontend
    +-- package.json
    +-- vite.config.js
    +-- src
        +-- app.routes.jsx
        +-- features
        +-- components
        +-- services
```
## Architecture

User → React Frontend → Express Backend → MongoDB

Resume PDF → PDF Parser → Google GenAI → Interview Report

Authentication → JWT + Google OAuth

## Setup

### Backend

```bash
cd Backend
npm install
npm run dev
```

The backend runs on `http://localhost:3000` by default.

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

The frontend runs on the Vite development URL, usually `http://localhost:5173`.

## Environment Variables

Create a `.env` file inside `Backend`:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_GEN_API_KEY=your_google_genai_api_key
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password

# Optional Brevo email config
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=your_sender_email
BREVO_FROM_NAME=PrepWise AI
```

Create a `.env` file inside `Frontend`:

```env
VITE_API_URL=http://localhost:3000
```

## Main API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/logout`
- `GET /api/auth/get-me`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/set-token`
- `POST /api/auth/contact`

### Interview

- `POST /api/interview`
- `GET /api/interview`
- `GET /api/interview/report/:interviewId`

## Scripts

Backend:

```bash
npm run dev
npm start
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
