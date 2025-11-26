# 🚀 Deployment Guide: AliCloud/Tencent Cloud HK (Docker)

This guide explains how to deploy the Gemini project to a VPS (Virtual Private Server) in Hong Kong using Docker. This method is cost-effective, bypasses the GFW for AI calls, and keeps data private.

## ✅ Prerequisites

1.  **Server**: A VPS in Hong Kong (AliCloud "Lightweight Application Server" or Tencent Cloud "Lighthouse").
    -   **OS**: Ubuntu 22.04 LTS or 24.04 LTS (Recommended).
    -   **Specs**: 1 CPU, 2GB RAM is sufficient.
2.  **Domain (Optional)**: A domain name pointing to your server's IP address.
3.  **Gemini API Key**: Your Google AI Studio API key.

## 🛠️ Step-by-Step Deployment

### 1. Connect to your Server
Open your terminal and SSH into your server:
```bash
ssh root@<YOUR_SERVER_IP>
```

### 2. Upload Project Files
You can use `scp` or `git` to get your files onto the server.
**Option A: Git (Recommended)**
```bash
# On the server
git clone <YOUR_GITHUB_REPO_URL> gemini-app
cd gemini-app
```

**Option B: SCP (Upload from local)**
```bash
# On your local machine
scp -r . root@<YOUR_SERVER_IP>:~/gemini-app
```

### 3. Run the Setup Script
I have included a `setup.sh` script that automates Docker installation and deployment.

```bash
# On the server, inside gemini-app folder
chmod +x setup.sh
./setup.sh
```

**What the script does:**
1.  Installs Docker & Docker Compose (if missing).
2.  Asks for your **Gemini API Key**.
3.  Builds the application container.
4.  Starts the Database (Postgres) and App containers.
5.  Runs database migrations automatically.

### 4. Access Your App
Open your browser and visit:
`http://<YOUR_SERVER_IP>:3000`

## ⚙️ Configuration Details

### Database
-   **Internal**: Uses a self-hosted PostgreSQL container.
-   **Data Persistence**: Data is stored in a Docker volume `postgres_data`, so it survives restarts.
-   **Connection**: The app connects via `postgres://postgres:postgres@db:5432/gemini_db`.

### Environment Variables
The `setup.sh` script creates a `.env` file for you. If you need to change it later:
```bash
nano .env
# Edit GEMINI_API_KEY=...
```
Then restart: `docker compose up -d`

## 🔄 Updating the App
When you push changes to GitHub, update your server:

```bash
cd gemini-app
git pull
docker compose up -d --build
```

## 🛡️ Security Note (Production)
Currently, the app runs on port 3000 over HTTP. For a production environment, it is highly recommended to:
1.  Use **Nginx** as a reverse proxy (Port 80 -> 3000).
2.  Set up **SSL (HTTPS)** using Let's Encrypt (Certbot).
