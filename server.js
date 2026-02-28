const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
require('dotenv').config();

const app = express();
const PORT = 9999;
const PASSWORD = '123123';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/home/yufang/workspace/';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const execAsync = util.promisify(exec);

// Execute command with sudo
const execSudo = async (cmd) => {
    try {
        const { stdout, stderr } = await execAsync(`echo "${PASSWORD}" | sudo -S ${cmd}`);
        return { success: true, stdout, stderr };
    } catch (error) {
        return { success: false, error: error.message, stderr: error.stderr };
    }
};

const SITES_AVAILABLE = '/etc/nginx/sites-available';
const SITES_ENABLED = '/etc/nginx/sites-enabled';

// Enable sudo to write to files
const writeSudo = async (filepath, content) => {
    // Escape content for bash
    // Write to a temporary file first, then use sudo cp
    const tempFile = path.join(__dirname, 'temp.conf');
    fs.writeFileSync(tempFile, content);
    const result = await execSudo(`cp ${tempFile} ${filepath}`);
    fs.unlinkSync(tempFile);
    return result;
}

// 1. Get Service Status
app.get('/api/status', async (req, res) => {
    const nginxStatus = await execSudo('systemctl is-active nginx');
    const phpStatus = await execSudo('systemctl is-active php8.3-fpm');

    res.json({
        nginx: nginxStatus.stdout.trim() === 'active',
        php: phpStatus.stdout.trim() === 'active'
    });
});

// 2. Control Services
app.post('/api/service/:action', async (req, res) => {
    const { action } = req.params;
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'reload' || action === 'restart') {
        const testRes = await execSudo('nginx -t');
        if (!testRes.success) {
            return res.status(400).json({ error: 'Nginx config test failed', details: testRes.stderr });
        }
    }

    const result = await execSudo(`systemctl ${action} nginx`);
    if (result.success) {
        res.json({ message: `Nginx ${action}ed successfully` });
    } else {
        res.status(500).json({ error: `Failed to ${action} Nginx`, details: result.stderr });
    }
});

// 3. Get Sites List
app.get('/api/sites', async (req, res) => {
    try {
        const availableRes = await execSudo(`ls ${SITES_AVAILABLE}`);
        const enabledRes = await execSudo(`ls ${SITES_ENABLED}`);

        let available = [];
        let enabled = [];

        if (availableRes.success && availableRes.stdout) {
            available = availableRes.stdout.trim().split('\n').filter(Boolean);
        }
        if (enabledRes.success && enabledRes.stdout) {
            enabled = enabledRes.stdout.trim().split('\n').filter(Boolean);
        }

        const sites = available.map(name => ({
            name,
            enabled: enabled.includes(name)
        }));

        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get Site Config
app.get('/api/sites/:name', async (req, res) => {
    const { name } = req.params;
    const result = await execSudo(`cat ${path.join(SITES_AVAILABLE, name)}`);
    if (result.success) {
        res.json({ content: result.stdout });
    } else {
        res.status(404).json({ error: 'Site not found' });
    }
});

// 5. Create or Update Site Config
const saveSite = async (req, res, isUpdate = false) => {
    // We now use `name` from params or body, but we need to strip `.conf` to get the clean base name for paths
    let { name } = req.params || req.body;
    name = req.body.name || name; // Ensure we get it from body on POST

    let { content, type, domain, port, rootPath, phpEnabled } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Extract base name for directory creation
    const baseName = name.replace(/\.conf$/, '');

    // Generate content if not raw
    if (type === 'proxy') {
        content = `server {
    listen ${req.body.listenPort || 80};
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}`;
    } else if (type === 'static') {
        content = `server {
    listen ${req.body.listenPort || 80};
    server_name ${domain};
    root ${rootPath || path.join(WORKSPACE_DIR, name)};
    index index.html index.htm index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    ${phpEnabled ? `location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
    }` : ''}
}`;
    }

    if (!content) return res.status(400).json({ error: 'Content is required' });

    const filepath = path.join(SITES_AVAILABLE, name);

    // Check if exists when creating
    if (!isUpdate) {
        const check = await execSudo(`ls ${filepath}`);
        if (check.success) {
            return res.status(400).json({ error: 'Site already exists' });
        }

        // Ensure workspace directory exists for static/php sites
        if (type === 'static') {
            const siteDir = rootPath || path.join(WORKSPACE_DIR, baseName);
            await execSudo(`mkdir -p ${siteDir}`);
            await execSudo(`chown -R yufang:yufang ${siteDir}`);

            // Generate a default index.html for testing
            const testPageContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>欢迎访问 ${baseName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; color: #333; margin: 0; }
        .container { background: #fff; padding: 50px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 650px; margin: 0 auto; }
        h1 { color: #1890ff; font-size: 2.5em; margin-bottom: 20px; }
        .icon { font-size: 4em; margin-bottom: 20px; }
        p { font-size: 1.2em; line-height: 1.6; color: #555; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 0.9em; }
        code { background: #f4f4f4; padding: 4px 8px; border-radius: 4px; color: #d63384; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚀</div>
        <h1>构建成功！</h1>
        <p>恭喜，此站点 <b>${baseName}</b> 已经成功由 Nginx 解析并运行。</p>
        <p>这是系统自动生成的默认测试页面，你可以将你的前端打包文件 (例如 Vite 构建生成的 <code>dist</code> 文件夹内的内容) 替换掉 <code>~/workspace/${baseName}</code> 目录下的这个文件。</p>
        <div class="footer">Nginx 管理控制台 (WSL Edition) 提供强力驱动</div>
    </div>
</body>
</html>`;
            const indexFilePath = path.join(siteDir, 'index.html');
            await writeSudo(indexFilePath, testPageContent);
            await execSudo(`chown yufang:yufang ${indexFilePath}`);
        }
    }

    const writeRes = await writeSudo(filepath, content);
    if (!writeRes.success) {
        return res.status(500).json({ error: 'Failed to write config', details: writeRes.stderr });
    }

    // Auto-enable when creating a new site
    if (!isUpdate) {
        const enabledPath = path.join(SITES_ENABLED, name);
        await execSudo(`ln -s ${filepath} ${enabledPath}`);
        await execSudo('systemctl reload nginx');
    }

    res.json({ message: 'Site saved successfully' });
};

app.post('/api/sites', (req, res) => saveSite(req, res, false));
app.put('/api/sites/:name', (req, res) => saveSite(req, res, true));

// 6. Delete Site
app.delete('/api/sites/:name', async (req, res) => {
    const { name } = req.params;
    const { deleteFolder } = req.body;

    // Remove symlink if exists
    await execSudo(`rm -f ${path.join(SITES_ENABLED, name)}`);

    // Remove config file
    const removeRes = await execSudo(`rm -f ${path.join(SITES_AVAILABLE, name)}`);

    if (removeRes.success) {
        // Optionally delete the workspace directory if requested
        if (deleteFolder) {
            const baseName = name.replace(/\.conf$/, '');
            const siteDir = path.join(WORKSPACE_DIR, baseName);
            // Added check to ensure we only delete within workspace for safety
            if (siteDir.startsWith(WORKSPACE_DIR)) {
                await execSudo(`rm -rf ${siteDir}`);
            }
        }

        // Reload nginx to reflect changes
        await execSudo('systemctl reload nginx');
        res.json({ message: 'Site deleted' });
    } else {
        res.status(500).json({ error: 'Failed to delete site', details: removeRes.stderr });
    }
});

// 7. Toggle Site (Enable/Disable)
app.post('/api/sites/:name/toggle', async (req, res) => {
    const { name } = req.params;
    const { enable } = req.body;

    const availablePath = path.join(SITES_AVAILABLE, name);
    const enabledPath = path.join(SITES_ENABLED, name);

    if (enable) {
        // Enable: create symlink
        const lnRes = await execSudo(`ln -s ${availablePath} ${enabledPath}`);
        if (!lnRes.success) return res.status(500).json({ error: 'Failed to enable site', details: lnRes.stderr });
    } else {
        // Disable: remove symlink
        const rmRes = await execSudo(`rm -f ${enabledPath}`);
        if (!rmRes.success) return res.status(500).json({ error: 'Failed to disable site', details: rmRes.stderr });
    }

    // Always test conf before reloading
    const testRes = await execSudo('nginx -t');
    if (!testRes.success) {
        // Rollback
        if (enable) {
            await execSudo(`rm -f ${enabledPath}`);
        } else {
            await execSudo(`ln -s ${availablePath} ${enabledPath}`);
        }
        return res.status(400).json({ error: 'Nginx config test failed. Operation rolled back.', details: testRes.stderr });
    }

    const reloadRes = await execSudo('systemctl reload nginx');
    if (reloadRes.success) {
        res.json({ message: `Site ${enable ? 'enabled' : 'disabled'} successfully` });
    } else {
        res.status(500).json({ error: 'Failed to reload Nginx', details: reloadRes.stderr });
    }
});

app.listen(PORT, () => {
    console.log(`Nginx Manager running at http://localhost:${PORT}`);
});
