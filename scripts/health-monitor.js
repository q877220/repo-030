/**
 * 24小时健康监控系统
 * 监控网站可用性、性能指标、索引状态等
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const moment = require('moment-timezone');

// 监控配置
const config = {
    timezone: 'Asia/Shanghai',
    baseUrl: 'https://q877220.github.io/repo-030',
    
    // 监控目标
    endpoints: [
        { url: '/', name: '首页', critical: true, timeout: 10000 },
        { url: '/telegram-bots.html', name: '机器人大全', critical: true, timeout: 8000 },
        { url: '/telegram-channels.html', name: '频道大全', critical: true, timeout: 8000 },
        { url: '/telegram-tools.html', name: '工具大全', critical: false, timeout: 8000 },
        { url: '/telegram-themes.html', name: '主题大全', critical: false, timeout: 8000 },
        { url: '/telegram-stickers.html', name: '表情包大全', critical: false, timeout: 8000 },
        { url: '/quick-index-request.html', name: '快速索引工具', critical: false, timeout: 8000 },
        { url: '/batch-index-monitor.html', name: '批量索引监控', critical: false, timeout: 8000 },
        { url: '/sitemap.xml', name: '网站地图', critical: true, timeout: 5000 },
        { url: '/robots.txt', name: 'Robots文件', critical: false, timeout: 5000 }
    ],
    
    // 性能阈值
    thresholds: {
        responseTime: 5000,    // 响应时间阈值（毫秒）
        availability: 99.0,    // 可用性阈值（百分比）
        errorRate: 1.0,       // 错误率阈值（百分比）
        contentSize: 1024     // 最小内容大小（字节）
    },

    // 自愈配置
    recovery: {
        maxRetries: 3,        // 最大重试次数
        retryDelay: 30000,    // 重试间隔（毫秒）
        escalationThreshold: 5, // 升级阈值
        cooldownPeriod: 300000  // 冷却期（毫秒）
    }
};

class HealthMonitor {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.healthStats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            availability: 100,
            lastCheckTime: null,
            issues: [],
            recoveryActions: []
        };
        this.responseTimeHistory = [];
        this.log = [];
        
        this.ensureDirectories();
    }

    // 确保目录存在
    ensureDirectories() {
        const dirs = ['../logs', '../reports', '../backups', '../cache'];
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
        
        // 保存关键日志到文件
        if (level === 'error' || level === 'warning') {
            const logFile = path.join(__dirname, '../logs', `health-monitor-${moment().format('YYYY-MM-DD')}.log`);
            fs.appendFileSync(logFile, logEntry + '\n');
        }
    }

    // 检查单个端点
    async checkEndpoint(endpoint) {
        const fullUrl = config.baseUrl + endpoint.url;
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const url = new URL(fullUrl);
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'GET',
                timeout: endpoint.timeout,
                headers: {
                    'User-Agent': 'Health-Monitor/1.0 (24h-Auto-System)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.5',
                    'Cache-Control': 'no-cache'
                }
            };

            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const result = {
                        endpoint: endpoint.name,
                        url: fullUrl,
                        status: res.statusCode,
                        responseTime,
                        contentLength: data.length,
                        success: res.statusCode >= 200 && res.statusCode < 400,
                        timestamp: moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss'),
                        headers: res.headers,
                        critical: endpoint.critical
                    };

                    // 额外检查
                    if (result.success) {
                        // 检查内容大小
                        if (data.length < config.thresholds.contentSize) {
                            result.success = false;
                            result.error = `内容过小 (${data.length} bytes)`;
                        }
                        
                        // 检查关键内容
                        if (endpoint.url.endsWith('.html')) {
                            if (!data.includes('<title>') || !data.includes('Telegram')) {
                                result.success = false;
                                result.error = '关键内容缺失';
                            }
                        }
                    }

                    resolve(result);
                });
            });

            req.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                resolve({
                    endpoint: endpoint.name,
                    url: fullUrl,
                    status: 0,
                    responseTime,
                    success: false,
                    error: error.message,
                    timestamp: moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss'),
                    critical: endpoint.critical
                });
            });

            req.on('timeout', () => {
                req.destroy();
                const responseTime = Date.now() - startTime;
                resolve({
                    endpoint: endpoint.name,
                    url: fullUrl,
                    status: 0,
                    responseTime,
                    success: false,
                    error: `超时 (>${endpoint.timeout}ms)`,
                    timestamp: moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss'),
                    critical: endpoint.critical
                });
            });

            req.end();
        });
    }

    // 执行全面健康检查
    async performHealthCheck() {
        this.logMessage('🏥 开始执行健康检查', 'info');
        
        const results = [];
        let totalResponseTime = 0;
        let successCount = 0;

        // 并发检查所有端点
        const checkPromises = config.endpoints.map(endpoint => this.checkEndpoint(endpoint));
        const checkResults = await Promise.all(checkPromises);

        for (const result of checkResults) {
            results.push(result);
            this.healthStats.totalChecks++;
            
            if (result.success) {
                successCount++;
                this.healthStats.successfulChecks++;
                totalResponseTime += result.responseTime;
                this.logMessage(`✅ ${result.endpoint}: ${result.status} (${result.responseTime}ms)`, 'info');
            } else {
                this.healthStats.failedChecks++;
                const level = result.critical ? 'error' : 'warning';
                this.logMessage(`❌ ${result.endpoint}: ${result.error || result.status} (${result.responseTime}ms)`, level);
                
                // 记录问题
                this.healthStats.issues.push({
                    endpoint: result.endpoint,
                    error: result.error || `HTTP ${result.status}`,
                    timestamp: result.timestamp,
                    critical: result.critical
                });

                // 如果是关键端点失败，启动自愈
                if (result.critical) {
                    await this.initiateRecovery(result);
                }
            }

            // 检查响应时间
            if (result.responseTime > config.thresholds.responseTime) {
                this.logMessage(`⚠️ ${result.endpoint} 响应时间过长: ${result.responseTime}ms`, 'warning');
            }
        }

        // 更新统计信息
        if (successCount > 0) {
            this.healthStats.averageResponseTime = Math.round(totalResponseTime / successCount);
        }
        
        this.healthStats.availability = (this.healthStats.successfulChecks / this.healthStats.totalChecks * 100).toFixed(2);
        this.healthStats.lastCheckTime = moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');

        // 保存响应时间历史
        this.responseTimeHistory.push({
            timestamp: Date.now(),
            averageResponseTime: this.healthStats.averageResponseTime,
            availability: parseFloat(this.healthStats.availability)
        });

        // 保持历史记录在合理范围内
        if (this.responseTimeHistory.length > 100) {
            this.responseTimeHistory = this.responseTimeHistory.slice(-50);
        }

        return {
            summary: {
                total: results.length,
                success: successCount,
                failed: results.length - successCount,
                criticalIssues: results.filter(r => !r.success && r.critical).length
            },
            results,
            stats: this.healthStats
        };
    }

    // 启动自愈程序
    async initiateRecovery(failedCheck) {
        this.logMessage(`🔧 启动自愈程序: ${failedCheck.endpoint}`, 'info');
        
        const recoveryAction = {
            endpoint: failedCheck.endpoint,
            startTime: moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss'),
            attempts: 0,
            success: false,
            actions: []
        };

        // 等待一段时间后重试
        for (let attempt = 1; attempt <= config.recovery.maxRetries; attempt++) {
            recoveryAction.attempts = attempt;
            this.logMessage(`🔄 自愈尝试 ${attempt}/${config.recovery.maxRetries}: ${failedCheck.endpoint}`, 'info');
            
            // 等待重试间隔
            if (attempt > 1) {
                await this.delay(config.recovery.retryDelay);
            }

            // 重新检查端点
            const endpoint = config.endpoints.find(e => e.name === failedCheck.endpoint);
            if (endpoint) {
                const retryResult = await this.checkEndpoint(endpoint);
                
                if (retryResult.success) {
                    recoveryAction.success = true;
                    recoveryAction.actions.push(`重试成功 (尝试 ${attempt})`);
                    this.logMessage(`✅ 自愈成功: ${failedCheck.endpoint}`, 'info');
                    break;
                } else {
                    recoveryAction.actions.push(`重试失败 (尝试 ${attempt}): ${retryResult.error}`);
                    this.logMessage(`❌ 自愈尝试 ${attempt} 失败: ${retryResult.error}`, 'warning');
                }
            }
        }

        // 如果自愈失败，记录并可能触发更高级的恢复措施
        if (!recoveryAction.success) {
            this.logMessage(`🚨 自愈失败: ${failedCheck.endpoint}，可能需要人工干预`, 'error');
            recoveryAction.actions.push('自愈失败，已记录待人工处理');
            
            // 这里可以触发更高级的恢复措施，如：
            // - 发送紧急通知
            // - 启动备用系统
            // - 自动回滚到上一个版本
            await this.escalateIssue(failedCheck);
        }

        recoveryAction.endTime = moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');
        this.healthStats.recoveryActions.push(recoveryAction);

        return recoveryAction;
    }

    // 问题升级处理
    async escalateIssue(issue) {
        this.logMessage(`🚨 问题升级: ${issue.endpoint}`, 'error');
        
        // 创建问题报告
        const escalationReport = {
            timestamp: moment().tz(config.timezone).format('YYYY-MM-DD HH:mm:ss'),
            issue: issue,
            severity: issue.critical ? 'CRITICAL' : 'WARNING',
            impact: issue.critical ? '影响核心功能' : '影响次要功能',
            recommendedActions: [
                '检查服务器状态',
                '验证DNS解析',
                '检查CDN配置',
                '查看GitHub Pages状态'
            ]
        };

        // 保存升级报告
        const reportPath = path.join(__dirname, '../reports', `escalation-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(escalationReport, null, 2));
        
        this.logMessage(`📋 升级报告已保存: ${reportPath}`, 'info');
        
        return escalationReport;
    }

    // 生成健康报告
    generateHealthReport() {
        const currentTime = moment().tz(config.timezone);
        const uptime = moment.duration(currentTime.diff(this.startTime)).humanize();
        
        // 计算趋势
        const recentHistory = this.responseTimeHistory.slice(-10);
        const trend = this.calculateTrend(recentHistory);

        const report = {
            meta: {
                timestamp: currentTime.format('YYYY-MM-DD HH:mm:ss'),
                uptime: uptime,
                timezone: config.timezone,
                reportType: '健康监控报告'
            },
            
            overview: {
                systemStatus: this.getSystemStatus(),
                availability: `${this.healthStats.availability}%`,
                averageResponseTime: `${this.healthStats.averageResponseTime}ms`,
                totalChecks: this.healthStats.totalChecks,
                issueCount: this.healthStats.issues.length,
                lastCheckTime: this.healthStats.lastCheckTime
            },

            performance: {
                responseTimeTrend: trend.responseTime,
                availabilityTrend: trend.availability,
                slowestEndpoints: this.getSlowEndpoints(),
                fastestEndpoints: this.getFastEndpoints()
            },

            issues: {
                critical: this.healthStats.issues.filter(i => i.critical),
                warnings: this.healthStats.issues.filter(i => !i.critical),
                recentRecoveries: this.healthStats.recoveryActions.slice(-5)
            },

            recommendations: this.generateRecommendations(),
            
            nextActions: {
                nextHealthCheck: currentTime.clone().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                maintenanceWindow: currentTime.clone().add(1, 'day').hour(2).format('YYYY-MM-DD HH:mm:ss')
            }
        };

        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `health-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 健康报告已生成: ${reportPath}`, 'info');
        return report;
    }

    // 获取系统状态
    getSystemStatus() {
        const criticalIssues = this.healthStats.issues.filter(i => i.critical).length;
        const availability = parseFloat(this.healthStats.availability);

        if (criticalIssues > 0) {
            return 'CRITICAL';
        } else if (availability < config.thresholds.availability) {
            return 'DEGRADED';
        } else if (this.healthStats.issues.length > 0) {
            return 'WARNING';
        }
        return 'HEALTHY';
    }

    // 计算趋势
    calculateTrend(history) {
        if (history.length < 2) {
            return { responseTime: 'STABLE', availability: 'STABLE' };
        }

        const recent = history.slice(-3);
        const earlier = history.slice(-6, -3);

        const recentAvgRT = recent.reduce((sum, h) => sum + h.averageResponseTime, 0) / recent.length;
        const earlierAvgRT = earlier.reduce((sum, h) => sum + h.averageResponseTime, 0) / earlier.length;

        const recentAvgAvail = recent.reduce((sum, h) => sum + h.availability, 0) / recent.length;
        const earlierAvgAvail = earlier.reduce((sum, h) => sum + h.availability, 0) / earlier.length;

        return {
            responseTime: recentAvgRT > earlierAvgRT * 1.1 ? 'DEGRADING' : 
                         recentAvgRT < earlierAvgRT * 0.9 ? 'IMPROVING' : 'STABLE',
            availability: recentAvgAvail > earlierAvgAvail + 1 ? 'IMPROVING' :
                         recentAvgAvail < earlierAvgAvail - 1 ? 'DEGRADING' : 'STABLE'
        };
    }

    // 获取最慢端点
    getSlowEndpoints() {
        return this.responseTimeHistory
            .filter(h => h.averageResponseTime > 0)
            .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
            .slice(0, 3);
    }

    // 获取最快端点
    getFastEndpoints() {
        return this.responseTimeHistory
            .filter(h => h.averageResponseTime > 0)
            .sort((a, b) => a.averageResponseTime - b.averageResponseTime)
            .slice(0, 3);
    }

    // 生成建议
    generateRecommendations() {
        const recommendations = [];
        
        if (this.healthStats.averageResponseTime > config.thresholds.responseTime) {
            recommendations.push('考虑优化页面加载速度，减少资源大小');
        }
        
        if (parseFloat(this.healthStats.availability) < config.thresholds.availability) {
            recommendations.push('检查服务器稳定性，考虑增加冗余');
        }
        
        if (this.healthStats.issues.length > 0) {
            recommendations.push('及时处理已发现的问题，避免影响扩大');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('系统运行良好，继续保持监控');
        }
        
        return recommendations;
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 主执行函数
    async run() {
        this.logMessage('🏥 24小时健康监控系统启动', 'info');
        
        try {
            // 执行健康检查
            const checkResult = await this.performHealthCheck();
            
            // 生成报告
            const healthReport = this.generateHealthReport();
            
            // 输出总结
            this.logMessage('\n📊 健康检查完成:', 'info');
            this.logMessage(`  系统状态: ${healthReport.overview.systemStatus}`, 'info');
            this.logMessage(`  可用性: ${healthReport.overview.availability}`, 'info');
            this.logMessage(`  平均响应时间: ${healthReport.overview.averageResponseTime}`, 'info');
            this.logMessage(`  问题数量: ${healthReport.overview.issueCount}`, 'info');
            this.logMessage(`  下次检查: ${healthReport.nextActions.nextHealthCheck}`, 'info');

            return healthReport;

        } catch (error) {
            this.logMessage(`❌ 健康监控执行异常: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const monitor = new HealthMonitor();
    monitor.run()
        .then(report => {
            console.log('✅ 健康监控执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 健康监控执行失败:', error);
            process.exit(1);
        });
}

module.exports = HealthMonitor; 