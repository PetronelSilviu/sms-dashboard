**Full-Stack SMS & MMS Monitoring Dashboard**
This project is a comprehensive, full-stack solution for remotely monitoring SMS/MMS messages from multiple Android devices. It consists of a robust Android application and a real-time web dashboard, providing a centralized interface for all messaging activity.

Features
Real-Time Message Forwarding: Captures both SMS and MMS (including images) from Android phones the moment they arrive.

Centralized Web Dashboard: A clean, two-column web interface to view conversations from multiple phones in one place.

Permanent Storage: Uses a PostgreSQL database to permanently store all message history, which persists through server restarts.

Robust Android App: Built as a Foreground Service to ensure it runs reliably in the background 24/7 without being shut down by the phone's OS.

MMS Support: Handles image messages by uploading the media to the server and displaying it directly in the dashboard.

Latency Tester Integration: Can be configured to act as a data source for a DLR (Delivery Receipt) Latency Tester, providing highly accurate, on-device delivery timestamps.

Architecture
The system is composed of three main parts:

**Android Application**: A native Android app built with Kotlin. It runs as a persistent Foreground Service to listen for incoming SMS/MMS.

**Web Server**: A Node.js application built with Express and Socket.IO. It serves the web dashboard, handles file uploads for MMS, and communicates with the database.

**Database**: A PostgreSQL database hosted on Render for permanent message storage.

**Setup Instructions**
1. Backend Server & Database (Render)
Deploy the Server: Deploy the Node.js server code to a Render Web Service.

Create a Database: Create a free Postgres database on Render.

Set Environment Variables: In your Web Service's "Environment" tab, add the following environment variable:

DATABASE_URL: The "Internal Connection URL" provided by your Render Postgres database.

(Optional) Keep-Alive Service: To prevent the free Render service from sleeping, use a free service like cron-job.org to send a request to your primary URL (e.g., https://your-app-name.onrender.com) every 15 minutes.

**2. Android Application**
Update URLs: Open SmsForegroundService.kt and update the DASHBOARD_SERVER_URL to point to your Render service. If integrating with the latency tester, update that URL as well.

Generate a Signed APK: Use Android Studio's Build > Generate Signed Bundle / APK to create a private release key and build a signed release.apk.

Install and Run:

Install the app-release.apk on your Android phones.

Open the app once and grant all requested permissions (SMS, Notifications, Storage).

Tap the "Start SMS Listening Service" button. A permanent notification will appear, confirming the service is running.

For multiple phones: You will need to build a separate APK for each phone, changing the phoneId variable (e.g., "AT&T", "Verizon") in the code for each one.
