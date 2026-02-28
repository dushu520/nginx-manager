# Nginx 管理控制台 (WSL Node.js 特制版)

一款极致简约、基于 Web 浏览器的 Nginx 配置文件管理面板。专为在 WSL (Windows Subsystem for Linux) 与 Node.js 混合开发环境下提供丝滑的反向代理/静态托管服务而优化。

## 功能特性

- **特派守护进程**: 摆脱繁杂的 Unix 鉴权组配置，内置基于密码流转的高特权 `sudo` 执行器。
- **自动搭建工作区间**: 创建 `静态页面/PHP` 站点时，除了配置文件，系统会自动生成该站点的源码主目录 (默认于 `~/workspace/`) 以及一张用于验证测试的 `index.html`。
- **一键配置 PHP 8.3-fpm**: 无须手写晦涩难懂的 FastCGI 规则，提供复选框一键支持 PHP 集成并与 Socket 绑定。
- **反向代理秒上手**: 拦截本地域名并将 HTTP 流量透传给前端的 Vite 开发机器或者后端的 Node.js 应用。
- **智能“快速访问”链接**: 自动读取配置文件提取监听端口号（如 80 或 3000），为你提供 "访问站点" 一键直达。
- **安全的智能清洗删库**: 当你需要删除一个站点时，提供二次安全防呆校验：可选择性连同项目源码根目录一起进行“全包围销毁安全清理”。

## 环境与依赖支持

- 操作系统: **Linux / WSL (Ubuntu)**
- 服务端: Node.js >= 18.x
- 服务器后端: Nginx >= 1.24
- PHP-FPM: PHP >= 8.3 (用于可选的纯 PHP 站点渲染)

## 安装与快速启动

1. **获取项目代码**
   ```bash
   git clone https://github.com/Yufang-T/nginx-manager.git
   cd nginx-manager
   ```

2. **安装工程依赖**
   ```bash
   npm install
   ```

3. **配置通用环境变量 (.env)**
   如果需要修改默认静态项目与 PHP 站点的全局父目录，请修改同目录下 `.env` 配置文件即可：
   ```env
   WORKSPACE_DIR=/home/yufang/workspace/
   ```

4. **启动服务总线**
   推荐使用挂载后台的形式启动你的管理员面板：
   ```bash
   nohup node server.js > server.log 2>&1 &
   ```

## 开始使用

程序启动后，在浏览器地址栏打开: **http://localhost:9999**

- 在主界面可以整体观察并干预 Nginx 服务的生命周期 (启动/停止/重启/平滑重载)。
- 列表左侧映射着存在于 `sites-available` 的现有站点，点击右侧拨动开关则自动化地通过 `sites-enabled` 提供软连接启用状态切换。
- 点击添加按钮（`+`），立刻利用表单部署你的业务！
