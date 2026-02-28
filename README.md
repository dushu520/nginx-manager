# Nginx Manager (WSL Node.js Edition)

A minimalist, web-based Nginx configuration managing dashboard optimized for WSL (Windows Subsystem for Linux) Node.js environments.

## Features

- **No Root Daemons Needed**: Safely executes Nginx configuration and `systemctl` commands through an innovative `sudo` wrapper tailored for WSL environments where strict group permissions can be tedious.
- **Auto-Directories & Testing Page**: When creating a Static/PHP site, it automatically spawns the project web directory and creates a dummy `index.html` to help you visually test whether routing works immediately.
- **1-Click PHP 8.3-fpm Integration**: Easily deploy PHP scripts alongside static files with essentially zero boilerplate.
- **Instant Port Proxying (Reverse Proxy)**: Pass traffic from Nginx to your backend Node.js applications with a single click.
- **Smart Link Visit**: Automatically parses Nginx config to get your listened port, supplying a fast-start `Visit Site` button.
- **Safe Directory Purge**: When deleting a site, Nginx Manager safely asks to delete the configuration files AND optionally the underlying web workspace directory.

## Prerequisite Environment Configuration

- Operating System: **Linux / WSL (Ubuntu)**
- Node.js >= 18.x
- Nginx >= 1.24
- PHP >= 8.3 (Optional, if you wish to run PHP mode)

## Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/nginx-manager.git
   cd nginx-manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup (.env)**
   By default, Nginx Manager will create auto-directories inside `/home/$USER/workspace/`. If you wish to change where directories go, edit the `.env` file:
   ```env
   WORKSPACE_DIR=/home/yufang/workspace/
   ```

4. **Start the Application**
   ```bash
   # Run in foreground
   node server.js

   # Run as a background process using nohup
   nohup node server.js > server.log 2>&1 &
   ```

## Usage

Visit **http://localhost:9999** in your browser to access the control panel.

- Create new websites with `Static / PHP` or `Proxy Target` configurations.
- Click on any existing element on the dashboard to review or edit its raw Nginx Server Block directly in the UI.

Enjoy!
