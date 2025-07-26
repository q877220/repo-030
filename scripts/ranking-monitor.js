/**
 * 24小时关键词排名监控系统
 * 自动监控关键词在各大搜索引擎的排名变化
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const moment = require('moment-timezone');
const cheerio = require('cheerio');

// 排名监控配置
const config = {
    timezone: 'Asia/Shanghai',
    siteUrl: 'https://q877220.github.io/repo-030',
    
    // 搜索引擎配置
    searchEngines: {
        baidu: {
            name: '百度',
            searchUrl: 'https://www.baidu.com/s',
            searchParam: 'wd',
            resultSelector: '.result.c-container',
            linkSelector: 'h3 a',
            titleSelector: 'h3 a',
            enabled: true,
            weight: 0.4,
            maxPages: 5,
            dailyLimit: 1000
        },
        
        google: {
            name: 'Google',
            searchUrl: 'https://www.google.com/search',
            searchParam: 'q',
            resultSelector: '.g',
            linkSelector: 'h3 a',
            titleSelector: 'h3',
            enabled: true,
            weight: 0.3,
            maxPages: 3,
            dailyLimit: 500
        },
        
        bing: {
            name: 'Bing',
            searchUrl: 'https://www.bing.com/search',
            searchParam: 'q',
            resultSelector: '.b_algo',
            linkSelector: 'h2 a',
            titleSelector: 'h2 a',
            enabled: true,
            weight: 0.2,
            maxPages: 3,
            dailyLimit: 500
        },
        
        so360: {
            name: '360搜索',
            searchUrl: 'https://www.so.com/s',
            searchParam: 'q',
            resultSelector: '.result',
            linkSelector: 'h3 a',
            titleSelector: 'h3 a',
            enabled: true,
            weight: 0.1,
            maxPages: 3,
            dailyLimit: 300
        }
    },
    
    // 监控策略
    monitoring: {
        topKeywords: 200,      // 监控关键词数量
        maxRankCheck: 50,      // 最大检查排名位置
        recheckInterval: 24,   // 重新检查间隔（小时）
        batchSize: 10,         // 批处理大小
        requestDelay: 3000,    // 请求间隔（毫秒）
        retryAttempts: 3       // 重试次数
    },
    
    // 排名分析
    analysis: {
        trendDays: 30,         // 趋势分析天数
        alertThreshold: 5,     // 排名变化警报阈值
        targetRankings: [1, 3, 5, 10, 20], // 目标排名位置
        competitorDomains: [   // 竞争对手域名
            'telegram.org',
            'web.telegram.org',
            't.me'
        ]
    }
};

class RankingMonitor {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.rankings = new Map(); // keyword -> {engine -> {rank, url, title, timestamp}}
        this.history = new Map();  // keyword -> [{timestamp, rankings}]
        this.keywords = [];
        this.monitoringStats = {
            totalChecks: 0,
            foundRankings: 0,
            notFound: 0,
            errors: [],
            engines: {},
            lastUpdate: null
        };
        this.log = [];
        
        this.ensureDirectories();
        this.loadKeywords();
        this.loadRankingHistory();
    }

    // 确保目录存在
    ensureDirectories() {
        const dirs = ['../data/rankings', '../data/keywords', '../logs', '../reports'];
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

    // 加载关键词
    loadKeywords() {
        try {
            const keywordFile = path.join(__dirname, '../data/keywords', 'keywords-database.json');
            if (fs.existsSync(keywordFile)) {
                const data = JSON.parse(fs.readFileSync(keywordFile, 'utf8'));
                
                // 选择高价值关键词进行监控
                if (data.keywords) {
                    const keywordEntries = Object.entries(data.keywords)
                        .sort(([, a], [, b]) => b.score - a.score)
                        .slice(0, config.monitoring.topKeywords);
                    
                    this.keywords = keywordEntries.map(([keyword, info]) => ({
                        keyword,
                        score: info.score,
                        sources: info.sources,
                        metadata: info.metadata
                    }));
                }
                
                this.logMessage(`📋 加载了 ${this.keywords.length} 个关键词进行排名监控`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载关键词失败: ${error.message}`, 'warning');
        }
    }

    // 加载排名历史
    loadRankingHistory() {
        try {
            const historyFile = path.join(__dirname, '../data/rankings', 'ranking-history.json');
            if (fs.existsSync(historyFile)) {
                const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                
                if (data.rankings) {
                    Object.entries(data.rankings).forEach(([keyword, rankings]) => {
                        this.rankings.set(keyword, rankings);
                    });
                }
                
                if (data.history) {
                    Object.entries(data.history).forEach(([keyword, history]) => {
                        this.history.set(keyword, history);
                    });
                }
                
                this.logMessage(`📊 加载了 ${this.rankings.size} 个关键词的排名历史`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载排名历史失败: ${error.message}`, 'warning');
        }
    }

    // 保存排名数据
    saveRankingData() {
        try {
            const historyFile = path.join(__dirname, '../data/rankings', 'ranking-history.json');
            
            const data = {
                metadata: {
                    lastUpdated: moment().tz(config.timezone).toISOString(),
                    totalKeywords: this.keywords.length,
                    monitoringStats: this.monitoringStats
                },
                rankings: Object.fromEntries(this.rankings),
                history: Object.fromEntries(this.history)
            };
            
            fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
            this.logMessage(`💾 保存了 ${this.rankings.size} 个关键词的排名数据`, 'info');
        } catch (error) {
            this.logMessage(`❌ 保存排名数据失败: ${error.message}`, 'error');
        }
    }

    // 搜索引擎查询
    async searchEngine(engine, keyword, page = 1) {
        const engineConfig = config.searchEngines[engine];
        if (!engineConfig || !engineConfig.enabled) {
            return null;
        }

        try {
            const searchQuery = `${keyword} site:${config.siteUrl.replace('https://', '')}`;
            const searchUrl = `${engineConfig.searchUrl}?${engineConfig.searchParam}=${encodeURIComponent(searchQuery)}&start=${(page - 1) * 10}`;
            
            this.logMessage(`🔍 搜索 ${engineConfig.name}: ${keyword} (第${page}页)`, 'info');
            
            const response = await this.makeHttpRequest(searchUrl, {
                'User-Agent': this.getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });
            
            return this.parseSearchResults(response, engineConfig, page);
            
        } catch (error) {
            this.logMessage(`❌ 搜索失败 ${engineConfig.name} (${keyword}): ${error.message}`, 'error');
            return null;
        }
    }

    // 解析搜索结果
    parseSearchResults(html, engineConfig, page) {
        const results = [];
        
        try {
            const $ = cheerio.load(html);
            
            $(engineConfig.resultSelector).each((index, element) => {
                const $element = $(element);
                const $link = $element.find(engineConfig.linkSelector);
                const $title = $element.find(engineConfig.titleSelector);
                
                if ($link.length > 0) {
                    let url = $link.attr('href');
                    const title = $title.text().trim();
                    
                    // 清理URL（处理各种格式）
                    if (url) {
                        // 百度URL清理
                        if (url.includes('baidu.com/link?url=')) {
                            const urlMatch = url.match(/url=([^&]+)/);
                            if (urlMatch) {
                                url = decodeURIComponent(urlMatch[1]);
                            }
                        }
                        
                        // Google URL清理
                        if (url.startsWith('/url?q=')) {
                            const urlMatch = url.match(/q=([^&]+)/);
                            if (urlMatch) {
                                url = decodeURIComponent(urlMatch[1]);
                            }
                        }
                        
                        // 检查是否是我们的网站
                        if (url.includes(config.siteUrl.replace('https://', ''))) {
                            const rank = (page - 1) * 10 + index + 1;
                            results.push({
                                rank,
                                url,
                                title,
                                page
                            });
                        }
                    }
                }
            });
            
        } catch (error) {
            this.logMessage(`⚠️ 解析搜索结果失败: ${error.message}`, 'warning');
        }
        
        return results;
    }

    // 监控单个关键词排名
    async monitorKeywordRanking(keywordInfo) {
        const { keyword } = keywordInfo;
        const currentRankings = {};
        
        this.logMessage(`📊 监控关键词排名: ${keyword}`, 'info');
        
        // 检查各个搜索引擎
        for (const [engineName, engineConfig] of Object.entries(config.searchEngines)) {
            if (!engineConfig.enabled) continue;
            
            this.monitoringStats.totalChecks++;
            
            try {
                let found = false;
                
                // 搜索多页结果
                for (let page = 1; page <= engineConfig.maxPages; page++) {
                    const results = await this.searchEngine(engineName, keyword, page);
                    
                    if (results && results.length > 0) {
                        // 找到最佳排名
                        const bestResult = results.sort((a, b) => a.rank - b.rank)[0];
                        
                        currentRankings[engineName] = {
                            rank: bestResult.rank,
                            url: bestResult.url,
                            title: bestResult.title,
                            page: bestResult.page,
                            timestamp: moment().tz(config.timezone).toISOString()
                        };
                        
                        this.monitoringStats.foundRankings++;
                        found = true;
                        
                        this.logMessage(`✅ 找到排名: ${keyword} 在 ${engineConfig.name} 第 ${bestResult.rank} 位`, 'info');
                        break;
                    }
                    
                    // 避免请求过于频繁
                    await this.delay(config.monitoring.requestDelay);
                }
                
                if (!found) {
                    this.monitoringStats.notFound++;
                    this.logMessage(`❌ 未找到排名: ${keyword} 在 ${engineConfig.name}`, 'warning');
                }
                
            } catch (error) {
                this.logMessage(`❌ 监控失败 ${engineName} (${keyword}): ${error.message}`, 'error');
                this.monitoringStats.errors.push(`${engineName}-${keyword}: ${error.message}`);
            }
            
            // 统计引擎数据
            if (!this.monitoringStats.engines[engineName]) {
                this.monitoringStats.engines[engineName] = { checked: 0, found: 0 };
            }
            this.monitoringStats.engines[engineName].checked++;
            if (currentRankings[engineName]) {
                this.monitoringStats.engines[engineName].found++;
            }
        }
        
        // 更新排名数据
        if (Object.keys(currentRankings).length > 0) {
            this.rankings.set(keyword, currentRankings);
            
            // 添加到历史记录
            if (!this.history.has(keyword)) {
                this.history.set(keyword, []);
            }
            
            const history = this.history.get(keyword);
            history.push({
                timestamp: moment().tz(config.timezone).toISOString(),
                rankings: { ...currentRankings }
            });
            
            // 保持历史记录在合理范围内
            if (history.length > 365) { // 保留一年的记录
                history.splice(0, history.length - 365);
            }
        }
        
        return currentRankings;
    }

    // 分析排名趋势
    analyzeRankingTrends(keyword) {
        const history = this.history.get(keyword);
        if (!history || history.length < 2) {
            return null;
        }
        
        const trends = {};
        const recentDays = config.analysis.trendDays;
        const cutoffDate = moment().subtract(recentDays, 'days');
        
        // 筛选最近的记录
        const recentHistory = history.filter(record => 
            moment(record.timestamp).isAfter(cutoffDate)
        );
        
        if (recentHistory.length < 2) {
            return null;
        }
        
        // 分析各个搜索引擎的趋势
        Object.keys(config.searchEngines).forEach(engine => {
            const engineData = recentHistory
                .map(record => record.rankings[engine])
                .filter(ranking => ranking && ranking.rank);
            
            if (engineData.length >= 2) {
                const firstRank = engineData[0].rank;
                const lastRank = engineData[engineData.length - 1].rank;
                const change = firstRank - lastRank; // 正数表示排名上升
                
                trends[engine] = {
                    firstRank,
                    lastRank,
                    change,
                    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
                    bestRank: Math.min(...engineData.map(d => d.rank)),
                    worstRank: Math.max(...engineData.map(d => d.rank)),
                    avgRank: Math.round(engineData.reduce((sum, d) => sum + d.rank, 0) / engineData.length)
                };
            }
        });
        
        return trends;
    }

    // 识别排名机会
    identifyRankingOpportunities() {
        const opportunities = [];
        
        Array.from(this.rankings.entries()).forEach(([keyword, rankings]) => {
            const trends = this.analyzeRankingTrends(keyword);
            
            Object.entries(rankings).forEach(([engine, ranking]) => {
                const opportunity = {
                    keyword,
                    engine,
                    currentRank: ranking.rank,
                    url: ranking.url,
                    opportunity: null,
                    priority: 'medium'
                };
                
                // 接近目标排名
                config.analysis.targetRankings.forEach(targetRank => {
                    if (ranking.rank > targetRank && ranking.rank <= targetRank + 3) {
                        opportunity.opportunity = `接近第${targetRank}位，当前第${ranking.rank}位`;
                        opportunity.priority = 'high';
                    }
                });
                
                // 排名下降趋势
                if (trends && trends[engine] && trends[engine].direction === 'down' && trends[engine].change < -5) {
                    opportunity.opportunity = `排名下降${Math.abs(trends[engine].change)}位，需要优化`;
                    opportunity.priority = 'urgent';
                }
                
                // 排名上升趋势
                if (trends && trends[engine] && trends[engine].direction === 'up' && trends[engine].change > 3) {
                    opportunity.opportunity = `排名上升${trends[engine].change}位，可继续优化`;
                    opportunity.priority = 'high';
                }
                
                if (opportunity.opportunity) {
                    opportunities.push(opportunity);
                }
            });
        });
        
        // 按优先级排序
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        opportunities.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
        
        return opportunities;
    }

    // 生成排名报告
    generateRankingReport() {
        const endTime = moment().tz(config.timezone);
        const duration = moment.duration(endTime.diff(this.startTime));
        
        // 计算总体统计
        const totalRankings = Array.from(this.rankings.values()).reduce((sum, rankings) => sum + Object.keys(rankings).length, 0);
        const avgRank = this.calculateAverageRank();
        const topRankings = this.getTopRankings(20);
        const opportunities = this.identifyRankingOpportunities();
        
        const report = {
            meta: {
                timestamp: endTime.format('YYYY-MM-DD HH:mm:ss'),
                duration: duration.humanize(),
                timezone: config.timezone,
                reportType: '关键词排名监控报告'
            },
            
            summary: {
                monitoredKeywords: this.keywords.length,
                totalRankings: totalRankings,
                foundRankings: this.monitoringStats.foundRankings,
                notFound: this.monitoringStats.notFound,
                averageRank: avgRank,
                errors: this.monitoringStats.errors.length
            },
            
            engines: Object.entries(this.monitoringStats.engines).map(([engine, stats]) => ({
                engine: config.searchEngines[engine].name,
                checked: stats.checked,
                found: stats.found,
                successRate: stats.checked > 0 ? `${((stats.found / stats.checked) * 100).toFixed(2)}%` : '0%'
            })),
            
            topRankings,
            opportunities: opportunities.slice(0, 50),
            
            performance: {
                top3Rankings: this.countRankingsByPosition(1, 3),
                top10Rankings: this.countRankingsByPosition(1, 10),
                top20Rankings: this.countRankingsByPosition(1, 20),
                beyondTop20: this.countRankingsByPosition(21, 100)
            },
            
            trends: this.analyzeTrendSummary(),
            recommendations: this.generateRankingRecommendations(),
            
            nextMonitoring: endTime.clone().add(config.monitoring.recheckInterval, 'hours').format('YYYY-MM-DD HH:mm:ss')
        };
        
        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `ranking-monitor-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 排名监控报告已保存: ${reportPath}`, 'info');
        return report;
    }

    // 计算平均排名
    calculateAverageRank() {
        const allRanks = [];
        
        Array.from(this.rankings.values()).forEach(rankings => {
            Object.values(rankings).forEach(ranking => {
                allRanks.push(ranking.rank);
            });
        });
        
        if (allRanks.length === 0) return 0;
        
        return (allRanks.reduce((sum, rank) => sum + rank, 0) / allRanks.length).toFixed(2);
    }

    // 获取最佳排名
    getTopRankings(limit = 20) {
        const allRankings = [];
        
        Array.from(this.rankings.entries()).forEach(([keyword, rankings]) => {
            Object.entries(rankings).forEach(([engine, ranking]) => {
                allRankings.push({
                    keyword,
                    engine: config.searchEngines[engine].name,
                    rank: ranking.rank,
                    url: ranking.url,
                    title: ranking.title
                });
            });
        });
        
        return allRankings
            .sort((a, b) => a.rank - b.rank)
            .slice(0, limit);
    }

    // 按排名位置统计
    countRankingsByPosition(minRank, maxRank) {
        let count = 0;
        
        Array.from(this.rankings.values()).forEach(rankings => {
            Object.values(rankings).forEach(ranking => {
                if (ranking.rank >= minRank && ranking.rank <= maxRank) {
                    count++;
                }
            });
        });
        
        return count;
    }

    // 分析趋势总结
    analyzeTrendSummary() {
        let upTrends = 0;
        let downTrends = 0;
        let stableTrends = 0;
        
        Array.from(this.rankings.keys()).forEach(keyword => {
            const trends = this.analyzeRankingTrends(keyword);
            if (trends) {
                Object.values(trends).forEach(trend => {
                    switch (trend.direction) {
                        case 'up': upTrends++; break;
                        case 'down': downTrends++; break;
                        case 'stable': stableTrends++; break;
                    }
                });
            }
        });
        
        return { upTrends, downTrends, stableTrends };
    }

    // 生成排名优化建议
    generateRankingRecommendations() {
        const recommendations = [];
        const opportunities = this.identifyRankingOpportunities();
        
        if (opportunities.filter(o => o.priority === 'urgent').length > 0) {
            recommendations.push('发现紧急排名问题，建议立即优化相关页面内容');
        }
        
        if (this.countRankingsByPosition(1, 10) < this.keywords.length * 0.1) {
            recommendations.push('前10名排名较少，建议加强页面SEO优化');
        }
        
        if (this.monitoringStats.notFound > this.monitoringStats.foundRankings) {
            recommendations.push('大量关键词未找到排名，建议增加内容相关性');
        }
        
        if (opportunities.filter(o => o.priority === 'high').length > 10) {
            recommendations.push('发现多个高价值优化机会，建议优先处理');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('排名监控正常，继续保持优化');
        }
        
        return recommendations;
    }

    // 获取随机User-Agent
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
        ];
        
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    // HTTP请求封装
    makeHttpRequest(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.5',
                    'Cache-Control': 'no-cache',
                    ...headers
                }
            };
            
            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 主执行函数
    async run() {
        this.logMessage('📊 24小时关键词排名监控系统启动', 'info');
        
        try {
            if (this.keywords.length === 0) {
                this.logMessage('⚠️ 没有找到关键词，请先运行关键词采集系统', 'warning');
                return null;
            }
            
            // 批量监控关键词排名
            this.logMessage(`🎯 开始监控 ${this.keywords.length} 个关键词`, 'info');
            
            let processed = 0;
            for (const keywordInfo of this.keywords) {
                if (processed >= config.monitoring.topKeywords) {
                    break;
                }
                
                await this.monitorKeywordRanking(keywordInfo);
                processed++;
                
                // 批次间延迟
                if (processed % config.monitoring.batchSize === 0) {
                    this.logMessage(`📊 已处理 ${processed} 个关键词，暂停片刻...`, 'info');
                    await this.delay(5000);
                }
            }
            
            // 保存排名数据
            this.saveRankingData();
            
            // 更新统计信息
            this.monitoringStats.lastUpdate = moment().tz(config.timezone).toISOString();
            
            // 生成报告
            const report = this.generateRankingReport();
            
            // 输出统计
            this.logMessage('\n📊 排名监控完成统计:', 'info');
            this.logMessage(`  监控关键词: ${report.summary.monitoredKeywords}`, 'info');
            this.logMessage(`  找到排名: ${report.summary.foundRankings}`, 'info');
            this.logMessage(`  未找到排名: ${report.summary.notFound}`, 'info');
            this.logMessage(`  平均排名: ${report.summary.averageRank}`, 'info');
            this.logMessage(`  前10排名: ${report.performance.top10Rankings}`, 'info');
            this.logMessage(`  优化机会: ${report.opportunities.length}`, 'info');
            this.logMessage(`  错误数量: ${report.summary.errors}`, 'info');
            this.logMessage(`  下次监控: ${report.nextMonitoring}`, 'info');
            
            return report;
            
        } catch (error) {
            this.logMessage(`❌ 排名监控执行失败: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const monitor = new RankingMonitor();
    monitor.run()
        .then(report => {
            console.log('✅ 排名监控执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 排名监控执行失败:', error);
            process.exit(1);
        });
}

module.exports = RankingMonitor; 