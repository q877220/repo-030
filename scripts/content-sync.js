/**
 * 内容同步系统
 * 检测内容变化、同步更新、触发相关操作
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const moment = require('moment-timezone');
const xml2js = require('xml2js');

// 同步配置
const config = {
    timezone: 'Asia/Shanghai',
    
    // 监控的文件
    watchedFiles: [
        { path: '../index.html', priority: 'critical', type: 'page' },
        { path: '../telegram-bots.html', priority: 'high', type: 'page' },
        { path: '../telegram-channels.html', priority: 'high', type: 'page' },
        { path: '../telegram-tools.html', priority: 'high', type: 'page' },
        { path: '../telegram-themes.html', priority: 'high', type: 'page' },
        { path: '../telegram-stickers.html', priority: 'high', type: 'page' },
        { path: '../quick-index-request.html', priority: 'medium', type: 'tool' },
        { path: '../batch-index-monitor.html', priority: 'medium', type: 'tool' },
        { path: '../sitemap.xml', priority: 'critical', type: 'config' },
        { path: '../robots.txt', priority: 'medium', type: 'config' },
        { path: '../data/resources.js', priority: 'high', type: 'data' },
        { path: '../styles.css', priority: 'medium', type: 'asset' },
        { path: '../script.js', priority: 'medium', type: 'asset' }
    ],

    // 内容检查规则
    contentRules: {
        html: {
            requiredElements: ['<title>', '<meta name="description"', '<h1>', '<h2>'],
            forbiddenPatterns: ['console.log', 'debugger', 'TODO:', 'FIXME:'],
            encoding: 'utf-8'
        },
        xml: {
            wellFormed: true,
            encoding: 'utf-8'
        },
        js: {
            syntaxCheck: true,
            forbiddenPatterns: ['console.log', 'debugger', 'alert(']
        },
        css: {
            syntaxCheck: true
        }
    },

    // 同步策略
    sync: {
        intervalMinutes: 30,     // 检查间隔
        changeThreshold: 0.1,    // 变化阈值（百分比）
        batchSize: 5,           // 批处理大小
        maxRetries: 3           // 最大重试次数
    }
};

class ContentSync {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.contentHashes = new Map();
        this.changeHistory = [];
        this.syncStats = {
            totalFiles: 0,
            changedFiles: 0,
            errors: [],
            warnings: [],
            lastSyncTime: null
        };
        this.log = [];
        
        this.ensureDirectories();
        this.loadPreviousHashes();
    }

    // 确保目录存在
    ensureDirectories() {
        const dirs = ['../logs', '../reports', '../cache'];
        dirs.forEach(dir => {
            const fullPath = path.join(__dirname, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    // 记录日志
    logMessage(message, level = 'info') {
        const timestamp = moment().tz(config.timezone).format('HH:mm:ss');
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logEntry);
        this.log.push({ timestamp, level, message });
    }

    // 加载之前的文件哈希
    loadPreviousHashes() {
        try {
            const hashFile = path.join(__dirname, '../cache', 'content-hashes.json');
            if (fs.existsSync(hashFile)) {
                const hashes = JSON.parse(fs.readFileSync(hashFile, 'utf8'));
                this.contentHashes = new Map(Object.entries(hashes));
                this.logMessage(`📋 加载了 ${this.contentHashes.size} 个文件的哈希记录`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载哈希记录失败: ${error.message}`, 'warning');
            this.syncStats.warnings.push(`加载哈希记录失败: ${error.message}`);
        }
    }

    // 保存文件哈希
    saveContentHashes() {
        try {
            const hashFile = path.join(__dirname, '../cache', 'content-hashes.json');
            const hashObject = Object.fromEntries(this.contentHashes);
            fs.writeFileSync(hashFile, JSON.stringify(hashObject, null, 2));
            this.logMessage(`💾 保存了 ${this.contentHashes.size} 个文件的哈希记录`, 'info');
        } catch (error) {
            this.logMessage(`❌ 保存哈希记录失败: ${error.message}`, 'error');
            this.syncStats.errors.push(`保存哈希记录失败: ${error.message}`);
        }
    }

    // 计算文件哈希
    calculateFileHash(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const content = fs.readFileSync(filePath);
            const hash = crypto.createHash('sha256');
            hash.update(content);
            return hash.digest('hex');
        } catch (error) {
            this.logMessage(`⚠️ 计算文件哈希失败: ${filePath} - ${error.message}`, 'warning');
            return null;
        }
    }

    // 验证内容质量
    async validateContent(filePath, fileInfo) {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf8');
        const issues = [];
        
        try {
            switch (ext) {
                case '.html':
                    // 检查必需元素
                    const htmlRules = config.contentRules.html;
                    for (const required of htmlRules.requiredElements) {
                        if (!content.includes(required)) {
                            issues.push(`缺少必需元素: ${required}`);
                        }
                    }
                    
                    // 检查禁止模式
                    for (const forbidden of htmlRules.forbiddenPatterns) {
                        if (content.includes(forbidden)) {
                            issues.push(`包含禁止内容: ${forbidden}`);
                        }
                    }
                    
                    // 检查基本HTML结构
                    if (!content.includes('<html') || !content.includes('</html>')) {
                        issues.push('HTML结构不完整');
                    }
                    break;

                case '.xml':
                    // 检查XML格式
                    try {
                        await xml2js.parseStringPromise(content);
                    } catch (xmlError) {
                        issues.push(`XML格式错误: ${xmlError.message}`);
                    }
                    break;

                case '.js':
                    // 基本语法检查
                    const jsRules = config.contentRules.js;
                    for (const forbidden of jsRules.forbiddenPatterns) {
                        if (content.includes(forbidden)) {
                            issues.push(`包含不推荐内容: ${forbidden}`);
                        }
                    }
                    
                    // 检查是否有明显语法错误
                    const openBraces = (content.match(/\{/g) || []).length;
                    const closeBraces = (content.match(/\}/g) || []).length;
                    if (openBraces !== closeBraces) {
                        issues.push('大括号不匹配');
                    }
                    break;

                case '.css':
                    // 检查CSS语法
                    const openBrackets = (content.match(/\{/g) || []).length;
                    const closeBrackets = (content.match(/\}/g) || []).length;
                    if (openBrackets !== closeBrackets) {
                        issues.push('CSS大括号不匹配');
                    }
                    break;
            }
            
            // 检查文件大小
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                issues.push('文件为空');
            } else if (stats.size > 10 * 1024 * 1024) { // 10MB
                issues.push('文件过大');
            }
            
        } catch (error) {
            issues.push(`内容验证失败: ${error.message}`);
        }
        
        return issues;
    }

    // 检查单个文件
    async checkFile(fileConfig) {
        const filePath = path.resolve(__dirname, fileConfig.path);
        const fileName = path.basename(filePath);
        
        this.syncStats.totalFiles++;
        
        if (!fs.existsSync(filePath)) {
            this.logMessage(`⚠️ 文件不存在: ${fileName}`, 'warning');
            this.syncStats.warnings.push(`文件不存在: ${fileName}`);
            return null;
        }

        // 计算当前哈希
        const currentHash = this.calculateFileHash(filePath);
        if (!currentHash) {
            this.syncStats.errors.push(`无法计算哈希: ${fileName}`);
            return null;
        }

        // 比较哈希
        const previousHash = this.contentHashes.get(filePath);
        const hasChanged = previousHash !== currentHash;
        
        if (hasChanged) {
            this.syncStats.changedFiles++;
            this.logMessage(`🔄 检测到变化: ${fileName}`, 'info');
            
            // 验证内容质量
            const validationIssues = this.validateContent(filePath, fileConfig);
            
            const changeInfo = {
                file: fileName,
                path: filePath,
                type: fileConfig.type,
                priority: fileConfig.priority,
                previousHash,
                currentHash,
                timestamp: moment().tz(config.timezone).toISOString(),
                validationIssues,
                isValid: validationIssues.length === 0
            };
            
            // 记录变化
            this.changeHistory.push(changeInfo);
            
            // 更新哈希
            this.contentHashes.set(filePath, currentHash);
            
            // 根据优先级处理
            await this.handleContentChange(changeInfo);
            
            return changeInfo;
        } else {
            this.logMessage(`✅ 无变化: ${fileName}`, 'info');
            return null;
        }
    }

    // 处理内容变化
    async handleContentChange(changeInfo) {
        this.logMessage(`🔧 处理内容变化: ${changeInfo.file} (${changeInfo.priority})`, 'info');
        
        // 如果有验证问题，记录警告
        if (changeInfo.validationIssues.length > 0) {
            this.logMessage(`⚠️ 内容质量问题: ${changeInfo.file}`, 'warning');
            changeInfo.validationIssues.forEach(issue => {
                this.logMessage(`  - ${issue}`, 'warning');
                this.syncStats.warnings.push(`${changeInfo.file}: ${issue}`);
            });
        }
        
        // 根据文件类型和优先级执行不同操作
        const actions = [];
        
        switch (changeInfo.priority) {
            case 'critical':
                actions.push('immediate-index-submit');
                actions.push('cache-clear');
                actions.push('health-check');
                break;
                
            case 'high':
                actions.push('scheduled-index-submit');
                actions.push('cache-clear');
                break;
                
            case 'medium':
                actions.push('batch-index-submit');
                break;
        }
        
        // 特殊文件类型处理
        switch (changeInfo.type) {
            case 'config':
                actions.push('sitemap-update');
                break;
                
            case 'data':
                actions.push('content-regeneration');
                break;
        }
        
        // 执行操作
        for (const action of actions) {
            try {
                await this.executeAction(action, changeInfo);
            } catch (error) {
                this.logMessage(`❌ 执行操作失败: ${action} - ${error.message}`, 'error');
                this.syncStats.errors.push(`操作失败: ${action} - ${error.message}`);
            }
        }
    }

    // 执行具体操作
    async executeAction(action, changeInfo) {
        this.logMessage(`⚡ 执行操作: ${action} (${changeInfo.file})`, 'info');
        
        switch (action) {
            case 'immediate-index-submit':
                // 立即提交索引
                this.logMessage(`📤 立即提交索引: ${changeInfo.file}`, 'info');
                // 这里会调用索引提交脚本
                break;
                
            case 'scheduled-index-submit':
                // 安排索引提交
                this.logMessage(`📅 安排索引提交: ${changeInfo.file}`, 'info');
                break;
                
            case 'batch-index-submit':
                // 批量索引提交
                this.logMessage(`📦 添加到批量提交队列: ${changeInfo.file}`, 'info');
                break;
                
            case 'cache-clear':
                // 清理缓存
                this.logMessage(`🧹 清理缓存: ${changeInfo.file}`, 'info');
                break;
                
            case 'health-check':
                // 触发健康检查
                this.logMessage(`🏥 触发健康检查: ${changeInfo.file}`, 'info');
                break;
                
            case 'sitemap-update':
                // 更新站点地图
                this.logMessage(`🗺️ 站点地图可能需要更新`, 'info');
                break;
                
            case 'content-regeneration':
                // 内容重新生成
                this.logMessage(`🔄 内容数据已更新，可能需要重新生成页面`, 'info');
                break;
        }
    }

    // 检测外部资源变化
    async checkExternalResources() {
        this.logMessage('🌐 检查外部资源状态', 'info');
        
        const externalResources = [
            { name: 'GitHub Pages', url: 'https://q877220.github.io/repo-030/' },
            { name: 'Sitemap', url: 'https://q877220.github.io/repo-030/sitemap.xml' }
        ];
        
        for (const resource of externalResources) {
            try {
                const isAccessible = await this.checkUrlAccessibility(resource.url);
                if (isAccessible) {
                    this.logMessage(`✅ ${resource.name} 可访问`, 'info');
                } else {
                    this.logMessage(`❌ ${resource.name} 不可访问`, 'error');
                    this.syncStats.errors.push(`外部资源不可访问: ${resource.name}`);
                }
            } catch (error) {
                this.logMessage(`⚠️ 检查 ${resource.name} 失败: ${error.message}`, 'warning');
                this.syncStats.warnings.push(`外部资源检查失败: ${resource.name}`);
            }
        }
    }

    // 检查URL可访问性
    checkUrlAccessibility(url) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname,
                method: 'HEAD',
                timeout: 10000
            };
            
            const req = https.request(options, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            
            req.end();
        });
    }

    // 生成同步报告
    generateSyncReport() {
        const endTime = moment().tz(config.timezone);
        const duration = moment.duration(endTime.diff(this.startTime));
        
        const report = {
            meta: {
                timestamp: endTime.format('YYYY-MM-DD HH:mm:ss'),
                duration: duration.humanize(),
                timezone: config.timezone,
                reportType: '内容同步报告'
            },
            
            summary: {
                totalFiles: this.syncStats.totalFiles,
                changedFiles: this.syncStats.changedFiles,
                changeRate: this.syncStats.totalFiles > 0 ? 
                    `${((this.syncStats.changedFiles / this.syncStats.totalFiles) * 100).toFixed(2)}%` : '0%',
                errors: this.syncStats.errors.length,
                warnings: this.syncStats.warnings.length
            },
            
            changes: this.changeHistory.map(change => ({
                file: change.file,
                type: change.type,
                priority: change.priority,
                timestamp: change.timestamp,
                isValid: change.isValid,
                issues: change.validationIssues.length
            })),
            
            contentQuality: {
                validFiles: this.changeHistory.filter(c => c.isValid).length,
                invalidFiles: this.changeHistory.filter(c => !c.isValid).length,
                qualityScore: this.changeHistory.length > 0 ? 
                    `${((this.changeHistory.filter(c => c.isValid).length / this.changeHistory.length) * 100).toFixed(2)}%` : 'N/A'
            },
            
            issues: {
                errors: this.syncStats.errors,
                warnings: this.syncStats.warnings
            },
            
            recommendations: this.generateRecommendations(),
            
            nextSync: endTime.clone().add(config.sync.intervalMinutes, 'minutes').format('YYYY-MM-DD HH:mm:ss')
        };
        
        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `content-sync-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 同步报告已保存: ${reportPath}`, 'info');
        return report;
    }

    // 生成建议
    generateRecommendations() {
        const recommendations = [];
        
        if (this.syncStats.changedFiles > this.syncStats.totalFiles * 0.5) {
            recommendations.push('大量文件发生变化，建议执行完整的索引提交');
        }
        
        if (this.syncStats.errors.length > 0) {
            recommendations.push('发现内容错误，建议立即修复');
        }
        
        if (this.changeHistory.some(c => !c.isValid)) {
            recommendations.push('部分文件存在质量问题，建议检查内容');
        }
        
        if (this.changeHistory.some(c => c.priority === 'critical')) {
            recommendations.push('关键文件发生变化，建议立即执行健康检查');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('内容同步正常，继续监控');
        }
        
        return recommendations;
    }

    // 主执行函数
    async run() {
        this.logMessage('🔄 内容同步系统启动', 'info');
        
        try {
            // 检查所有监控文件
            this.logMessage(`📋 开始检查 ${config.watchedFiles.length} 个文件`, 'info');
            
            const changes = [];
            for (const fileConfig of config.watchedFiles) {
                const change = await this.checkFile(fileConfig);
                if (change) {
                    changes.push(change);
                }
            }
            
            // 检查外部资源
            await this.checkExternalResources();
            
            // 保存哈希记录
            this.saveContentHashes();
            
            // 更新同步时间
            this.syncStats.lastSyncTime = moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');
            
            // 生成报告
            const report = this.generateSyncReport();
            
            // 输出总结
            this.logMessage('\n📊 内容同步完成统计:', 'info');
            this.logMessage(`  检查文件: ${report.summary.totalFiles}`, 'info');
            this.logMessage(`  变化文件: ${report.summary.changedFiles}`, 'info');
            this.logMessage(`  变化率: ${report.summary.changeRate}`, 'info');
            this.logMessage(`  内容质量: ${report.contentQuality.qualityScore}`, 'info');
            this.logMessage(`  错误: ${report.summary.errors}`, 'info');
            this.logMessage(`  警告: ${report.summary.warnings}`, 'info');
            this.logMessage(`  下次同步: ${report.nextSync}`, 'info');
            
            return report;
            
        } catch (error) {
            this.logMessage(`❌ 内容同步执行失败: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const sync = new ContentSync();
    sync.run()
        .then(report => {
            console.log('✅ 内容同步执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 内容同步执行失败:', error);
            process.exit(1);
        });
}

module.exports = ContentSync; 