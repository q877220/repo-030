# 🚀 GitHub Pages 部署指南

## 📋 部署步骤

### 1. 创建 GitHub 仓库
1. 登录 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - Repository name: `telegram-navigation` (或您喜欢的名称)
   - Description: `一个全面的 Telegram 资源导航站，包含1000+精选资源`
   - 设置为 Public (免费用户需要公开仓库才能使用 GitHub Pages)
   - 不要勾选 "Add a README file"、"Add .gitignore"、"Choose a license"

### 2. 推送代码到 GitHub
在项目目录中运行以下命令：

```bash
# 配置 Git 用户信息（如果还没配置）
git config --global user.name "您的用户名"
git config --global user.email "您的邮箱"

# 添加远程仓库（替换为您的仓库地址）
git remote add origin https://github.com/您的用户名/telegram-navigation.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3. 启用 GitHub Pages
1. 在 GitHub 仓库页面，点击 "Settings" 标签
2. 在左侧菜单中找到 "Pages"
3. 在 "Source" 部分选择 "GitHub Actions"
4. 系统会自动检测并使用项目中的 `.github/workflows/pages.yml` 工作流

### 4. 等待部署完成
- 推送代码后，GitHub Actions 会自动开始构建和部署
- 可以在 "Actions" 标签页查看部署状态
- 通常需要 2-5 分钟完成部署

### 5. 访问您的网站
部署完成后，您的网站将可以通过以下地址访问：
```
https://您的用户名.github.io/telegram-navigation/
```

## 🔄 自动更新

项目配置了自动部署：
- 每次向 `main` 分支推送代码时，GitHub Pages 会自动更新
- 也可以在 Actions 页面手动触发部署

## 🛠️ 自定义域名（可选）

如果您有自己的域名：

1. 在仓库根目录创建 `CNAME` 文件：
   ```
   your-domain.com
   ```

2. 在域名 DNS 设置中添加 CNAME 记录：
   ```
   CNAME    www    您的用户名.github.io
   ```

3. 在 GitHub Pages 设置中添加自定义域名

## 📊 项目统计

当前项目包含：
- 📁 6 个主要分类
- 🔗 1000+ 精选资源链接
- 🎨 现代化响应式设计
- 🔍 实时搜索功能
- 📱 完美的移动端适配

## 🎯 功能特色

- ⚡ **快速搜索**: 支持实时搜索过滤
- 📱 **响应式设计**: 完美适配各种设备
- 🎨 **现代界面**: 渐变背景和毛玻璃效果
- 🔧 **易于维护**: 数据与代码分离
- 🚀 **性能优化**: 快速加载和流畅交互

## 📝 添加新资源

要添加新的资源链接，编辑 `data/resources.js` 文件：

```javascript
// 在对应分类的 items 数组中添加新项目
{
    title: "资源名称",
    url: "https://example.com",
    icon: "🔗",
    desc: "资源描述"
}
```

## 🤝 贡献

欢迎提交 Pull Request 来添加更多有用的 Telegram 资源！

## 📞 支持

如有问题，请创建 [Issue](https://github.com/您的用户名/telegram-navigation/issues)

---

🎉 **部署完成后，您将拥有一个功能完整的 Telegram 资源导航站！** 