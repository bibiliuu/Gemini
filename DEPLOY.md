# 🚀 How to Deploy Updates

Whenever you make changes to the code (visuals, bug fixes, etc.), follow these 3 steps:

## Step 1: Build Locally (Mac)
Open your terminal in the project folder and run:
```bash
npm run build
```
*(This compiles your code into the `dist` folder).*

## Step 2: Push to GitHub
Upload your changes and the built files:
```bash
git add .
git commit -m "Describe your changes here"
git push
```

## Step 3: Update Server
SSH into your AliCloud server and restart the app:
```bash
ssh root@<YOUR_SERVER_IP>

cd gemini-app
git pull
./setup.sh
```

---
**That's it!** The update will be live in seconds.
