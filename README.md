# Telegram 导航站

一个精美的静态 Telegram 资源导航网站，帮助用户快速找到各种 Telegram 相关的资源和工具。

## 🌟 功能特色

- **🎨 现代化设计**: 采用渐变背景和毛玻璃效果，提供优雅的视觉体验
- **📱 响应式布局**: 完美适配桌面端、平板和移动设备
- **🔍 智能搜索**: 支持实时搜索过滤，可按标题、描述或分类名称搜索
- **⚡ 快速导航**: 按键盘快捷键 `Ctrl/Cmd + K` 快速聚焦搜索框
- **🎯 精准分类**: 将资源按照官方客户端、机器人、频道等类别精心分类
- **🌙 优化体验**: 包含回到顶部按钮、加载动画等细节优化

## 📦 项目结构

```
telegram-navigation/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # 交互脚本
└── README.md          # 项目说明
```

## 🚀 快速开始

1. **下载项目文件**
   - 下载所有文件到本地目录

2. **打开网站**
   - 直接在浏览器中打开 `index.html` 文件
   - 或者通过本地服务器运行（推荐）

3. **使用本地服务器运行**
   ```bash
   # 使用 Python 3
   python -m http.server 8000
   
   # 使用 Node.js (需要安装 http-server)
   npx http-server
   
   # 使用 PHP
   php -S localhost:8000
   ```

4. **访问网站**
   - 在浏览器中访问 `http://localhost:8000`

## 📚 资源分类

### 🔧 官方客户端
- **Telegram Web**: 浏览器版本，无需安装
- **Desktop 客户端**: Windows、Mac、Linux 桌面版
- **移动客户端**: iOS 和 Android 官方应用

### 🤖 实用机器人
- **BotFather**: 官方机器人创建工具
- **Stickers**: 表情包管理机器人
- **GIF**: GIF 动图搜索机器人
- 以及更多实用机器人...

### ⭐ 热门频道
- **Pavel Durov**: Telegram 创始人官方频道
- **Telegram**: 官方公告频道
- **Telegram Tips**: 使用技巧和功能介绍

### 👨‍💻 开发者工具
- **API 文档**: Telegram Bot API 官方文档
- **Bot 开发指南**: 机器人开发完整教程
- **官方博客**: 最新功能和更新资讯

### 👥 社区资源
- **主题分享**: 精美的 Telegram 主题合集
- **表情包合集**: 海量有趣的表情包资源
- **用户交流群**: Telegram 用户经验分享

## ⌨️ 键盘快捷键

- `Ctrl + K` (Windows/Linux) 或 `Cmd + K` (Mac): 快速聚焦搜索框
- `ESC`: 清空搜索内容并失焦搜索框

## 🎨 自定义配置

### 修改主题色彩
在 `styles.css` 文件中修改以下变量：

```css
/* 主渐变背景 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* 主色调 */
color: #667eea;

/* Telegram 品牌色 */
color: #0088cc;
```

### 添加新的资源链接
在 `index.html` 文件中找到相应的分类，按照现有格式添加新的链接卡片：

```html
<a href="你的链接地址" class="link-card" target="_blank">
    <div class="link-icon">🔗</div>
    <div class="link-content">
        <h4>链接标题</h4>
        <p>链接描述</p>
    </div>
</a>
```

### 添加新的分类
在 `categories` 容器中添加新的分类区块：

```html
<div class="category" data-category="new-category">
    <div class="category-header">
        <svg class="category-icon" viewBox="0 0 24 24">
            <!-- SVG 图标路径 -->
        </svg>
        <h3>新分类名称</h3>
    </div>
    <div class="links-grid">
        <!-- 链接卡片 -->
    </div>
</div>
```

## 🌐 部署

### GitHub Pages
1. 将项目文件上传到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择 main 分支作为源

### Netlify
1. 将项目文件夹拖拽到 Netlify 部署页面
2. 或连接 GitHub 仓库自动部署

### Vercel
1. 使用 Vercel CLI: `vercel --prod`
2. 或通过 Vercel 网站连接 GitHub 仓库

## 🛠️ 技术栈

- **HTML5**: 语义化标记
- **CSS3**: 现代样式特性（Grid、Flexbox、Filter 等）
- **JavaScript**: 原生 JS，无需框架依赖
- **SVG**: 矢量图标

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📞 联系

如果您有任何问题或建议，欢迎通过以下方式联系：

- 创建 [Issue](https://github.com/your-username/telegram-navigation/issues)
- 发送邮件到：your-email@example.com

## 🙏 致谢

- 感谢 [Telegram](https://telegram.org/) 提供优秀的即时通讯服务
- 感谢所有 Telegram 社区的贡献者们

---

⭐ 如果这个项目对您有帮助，请给它一个星标！ 