/**
 * 24小时自动关键词采集系统
 * 从多个来源智能采集相关关键词，支持中英文
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const moment = require('moment-timezone');
const crypto = require('crypto');

// 关键词采集配置
const config = {
    timezone: 'Asia/Shanghai',
    
    // 核心种子关键词
    seedKeywords: [
        // 主要关键词
        'Telegram', '电报', 'TG', 'Telegram Bot', 'Telegram频道', 'Telegram群组',
        '电报机器人', '电报频道', '电报群组', 'TG机器人', 'TG频道', 'TG群组',
        
        // 功能相关
        'Telegram下载', 'Telegram客户端', 'Telegram网页版', 'Telegram桌面版',
        '电报下载', '电报客户端', '电报网页版', '电报桌面版',
        
        // 开发相关
        'Telegram API', 'Telegram SDK', 'Telegram开发', 'Bot开发',
        '电报API', '电报SDK', '电报开发', '机器人开发',
        
        // 资源相关
        'Telegram导航', 'Telegram资源', 'Telegram工具', 'Telegram主题',
        '电报导航', '电报资源', '电报工具', '电报主题',
        
        // 长尾关键词
        'Telegram使用教程', 'Telegram注册方法', 'Telegram汉化包',
        '电报使用教程', '电报注册方法', '电报汉化包'
    ],
    
    // 关键词来源配置
    sources: {
        // 百度相关搜索
        baiduSuggest: {
            enabled: true,
            endpoint: 'https://suggestion.baidu.com/su',
            weight: 0.3,
            dailyLimit: 1000
        },
        
        // 360搜索建议
        so360Suggest: {
            enabled: true,
            endpoint: 'https://sug.so.360.cn/suggest',
            weight: 0.2,
            dailyLimit: 500
        },
        
        // 搜狗搜索建议
        sogouSuggest: {
            enabled: true,
            endpoint: 'https://pb.sogou.com/suggestions.jsp',
            weight: 0.2,
            dailyLimit: 500
        },
        
        // 相关词扩展
        relatedTerms: {
            enabled: true,
            weight: 0.3,
            patterns: [
                '${keyword}教程', '${keyword}下载', '${keyword}使用',
                '${keyword}注册', '${keyword}安装', '${keyword}配置',
                '${keyword}官网', '${keyword}中文版', '${keyword}汉化',
                '如何使用${keyword}', '${keyword}怎么用', '${keyword}是什么',
                '${keyword}最新版', '${keyword}破解版', '${keyword}免费',
                '${keyword}推荐', '${keyword}大全', '${keyword}合集'
            ]
        }
    },
    
    // 关键词过滤规则
    filters: {
        minLength: 2,
        maxLength: 50,
        excludePatterns: [
            /^[0-9]+$/,           // 纯数字
            /^[a-zA-Z]$/,         // 单个字母
            /porn|sex|adult/i,    // 成人内容
            /illegal|hack|crack/i, // 非法内容
            /^\s*$/               // 空白
        ],
        mustContain: ['telegram', '电报', 'tg', 'bot', '机器人', '频道', '群组', '导航'],
        blacklist: ['色情', '赌博', '毒品', '暴力', '非法']
    },
    
    // 采集策略
    collection: {
        batchSize: 50,        // 批处理大小
        maxDaily: 5000,       // 每日最大采集数
        maxKeywords: 50000,   // 关键词库最大容量
        refreshInterval: 24,  // 刷新间隔（小时）
        priorityBoost: 1.5    // 优先级提升倍数
    }
};

class KeywordCollector {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.keywords = new Map(); // keyword -> {score, sources, timestamp, metadata}
        this.collectionStats = {
            totalCollected: 0,
            newKeywords: 0,
            duplicates: 0,
            filtered: 0,
            errors: [],
            sources: {}
        };
        this.log = [];
        
        this.ensureDirectories();
        this.loadExistingKeywords();
    }

    // 确保目录存在
    ensureDirectories() {
        const dirs = ['../data/keywords', '../logs', '../reports', '../cache'];
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

    // 加载现有关键词
    loadExistingKeywords() {
        try {
            const keywordFile = path.join(__dirname, '../data/keywords', 'keywords-database.json');
            if (fs.existsSync(keywordFile)) {
                const data = JSON.parse(fs.readFileSync(keywordFile, 'utf8'));
                
                // 转换数据结构
                if (data.keywords) {
                    Object.entries(data.keywords).forEach(([keyword, info]) => {
                        this.keywords.set(keyword, {
                            score: info.score || 1,
                            sources: info.sources || [],
                            timestamp: info.timestamp || new Date().toISOString(),
                            metadata: info.metadata || {},
                            lastUpdated: info.lastUpdated || new Date().toISOString()
                        });
                    });
                }
                
                this.logMessage(`📋 加载了 ${this.keywords.size} 个现有关键词`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载关键词数据失败: ${error.message}`, 'warning');
        }
    }

    // 保存关键词数据
    saveKeywordsDatabase() {
        try {
            const keywordFile = path.join(__dirname, '../data/keywords', 'keywords-database.json');
            
            const data = {
                metadata: {
                    lastUpdated: moment().tz(config.timezone).toISOString(),
                    totalKeywords: this.keywords.size,
                    collectionStats: this.collectionStats
                },
                keywords: Object.fromEntries(this.keywords)
            };
            
            fs.writeFileSync(keywordFile, JSON.stringify(data, null, 2));
            this.logMessage(`💾 保存了 ${this.keywords.size} 个关键词`, 'info');
        } catch (error) {
            this.logMessage(`❌ 保存关键词数据失败: ${error.message}`, 'error');
            this.collectionStats.errors.push(`保存失败: ${error.message}`);
        }
    }

    // 从百度获取搜索建议
    async collectFromBaidu(keyword) {
        const suggestions = [];
        
        try {
            const encodedKeyword = encodeURIComponent(keyword);
            const url = `${config.sources.baiduSuggest.endpoint}?wd=${encodedKeyword}&p=3&cb=window.bdsug&t=${Date.now()}`;
            
            const response = await this.makeHttpRequest(url);
            
            // 解析百度建议响应（JSONP格式）
            const jsonpMatch = response.match(/window\.bdsug\((.+)\)$/);
            if (jsonpMatch) {
                const data = JSON.parse(jsonpMatch[1]);
                if (data.s && Array.isArray(data.s)) {
                    suggestions.push(...data.s);
                }
            }
        } catch (error) {
            this.logMessage(`⚠️ 百度建议采集失败 (${keyword}): ${error.message}`, 'warning');
        }
        
        return suggestions.map(s => ({
            keyword: s,
            source: 'baidu-suggest',
            score: this.calculateScore(s, 'baidu-suggest')
        }));
    }

    // 从360搜索获取建议
    async collectFromSo360(keyword) {
        const suggestions = [];
        
        try {
            const encodedKeyword = encodeURIComponent(keyword);
            const url = `${config.sources.so360Suggest.endpoint}?word=${encodedKeyword}&src=chrome&from=chrome`;
            
            const response = await this.makeHttpRequest(url);
            const data = JSON.parse(response);
            
            if (data.result && Array.isArray(data.result)) {
                suggestions.push(...data.result.map(item => item.word || item));
            }
        } catch (error) {
            this.logMessage(`⚠️ 360搜索建议采集失败 (${keyword}): ${error.message}`, 'warning');
        }
        
        return suggestions.map(s => ({
            keyword: s,
            source: '360-suggest',
            score: this.calculateScore(s, '360-suggest')
        }));
    }

    // 从搜狗获取建议
    async collectFromSogou(keyword) {
        const suggestions = [];
        
        try {
            const encodedKeyword = encodeURIComponent(keyword);
            const url = `${config.sources.sogouSuggest.endpoint}?key=${encodedKeyword}&type=web&ori=cluster&n=10`;
            
            const response = await this.makeHttpRequest(url);
            
            // 解析搜狗JSONP响应
            const jsonpMatch = response.match(/window\.sogou\.sug\((.+)\)$/);
            if (jsonpMatch) {
                const data = JSON.parse(jsonpMatch[1]);
                if (data[1] && Array.isArray(data[1])) {
                    suggestions.push(...data[1]);
                }
            }
        } catch (error) {
            this.logMessage(`⚠️ 搜狗建议采集失败 (${keyword}): ${error.message}`, 'warning');
        }
        
        return suggestions.map(s => ({
            keyword: s,
            source: 'sogou-suggest',
            score: this.calculateScore(s, 'sogou-suggest')
        }));
    }

    // 生成相关词扩展
    generateRelatedTerms(keyword) {
        const relatedTerms = [];
        
        if (!config.sources.relatedTerms.enabled) {
            return relatedTerms;
        }
        
        config.sources.relatedTerms.patterns.forEach(pattern => {
            const expandedKeyword = pattern.replace('${keyword}', keyword);
            
            // 避免生成过长或重复的关键词
            if (expandedKeyword.length <= config.filters.maxLength && 
                expandedKeyword !== keyword) {
                relatedTerms.push({
                    keyword: expandedKeyword,
                    source: 'related-terms',
                    score: this.calculateScore(expandedKeyword, 'related-terms'),
                    baseKeyword: keyword
                });
            }
        });
        
        return relatedTerms;
    }

    // 计算关键词得分
    calculateScore(keyword, source) {
        let score = 1;
        
        // 基础长度得分
        const length = keyword.length;
        if (length >= 3 && length <= 8) {
            score += 2; // 优质长度
        } else if (length >= 9 && length <= 15) {
            score += 1; // 中等长度
        }
        
        // 包含核心词加分
        const coreTerms = ['telegram', '电报', 'tg', 'bot', '机器人', '频道', '群组'];
        const lowerKeyword = keyword.toLowerCase();
        coreTerms.forEach(term => {
            if (lowerKeyword.includes(term.toLowerCase())) {
                score += 3;
            }
        });
        
        // 来源权重
        const sourceWeights = {
            'baidu-suggest': 3,
            '360-suggest': 2,
            'sogou-suggest': 2,
            'related-terms': 1
        };
        
        score *= (sourceWeights[source] || 1);
        
        // 商业价值关键词加分
        const commercialTerms = ['下载', '注册', '教程', '使用', '官网', '最新', '免费'];
        commercialTerms.forEach(term => {
            if (keyword.includes(term)) {
                score += 1;
            }
        });
        
        return Math.round(score * 10) / 10; // 保留一位小数
    }

    // 过滤关键词
    filterKeyword(keyword) {
        const kw = keyword.trim();
        
        // 长度检查
        if (kw.length < config.filters.minLength || kw.length > config.filters.maxLength) {
            return false;
        }
        
        // 排除模式检查
        for (const pattern of config.filters.excludePatterns) {
            if (pattern.test(kw)) {
                return false;
            }
        }
        
        // 黑名单检查
        const lowerKw = kw.toLowerCase();
        for (const blackword of config.filters.blacklist) {
            if (lowerKw.includes(blackword)) {
                return false;
            }
        }
        
        // 必须包含检查
        const hasRequiredTerm = config.filters.mustContain.some(term => 
            lowerKw.includes(term.toLowerCase())
        );
        
        return hasRequiredTerm;
    }

    // HTTP请求封装
    makeHttpRequest(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.5',
                    'Cache-Control': 'no-cache'
                }
            };

            const client = urlObj.protocol === 'https:' ? https : require('http');
            
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

    // 批量采集关键词
    async collectKeywordsBatch(seedKeywords) {
        this.logMessage(`🚀 开始批量采集，种子关键词: ${seedKeywords.length} 个`, 'info');
        
        const allCollectedKeywords = [];
        let processed = 0;
        
        for (const seedKeyword of seedKeywords) {
            if (processed >= config.collection.maxDaily) {
                this.logMessage(`⚠️ 达到每日采集限制 (${config.collection.maxDaily})`, 'warning');
                break;
            }
            
            this.logMessage(`🔍 采集关键词: ${seedKeyword}`, 'info');
            
            try {
                // 从各个来源采集
                const collectionPromises = [];
                
                if (config.sources.baiduSuggest.enabled) {
                    collectionPromises.push(this.collectFromBaidu(seedKeyword));
                }
                
                if (config.sources.so360Suggest.enabled) {
                    collectionPromises.push(this.collectFromSo360(seedKeyword));
                }
                
                if (config.sources.sogouSuggest.enabled) {
                    collectionPromises.push(this.collectFromSogou(seedKeyword));
                }
                
                // 生成相关词
                if (config.sources.relatedTerms.enabled) {
                    const relatedTerms = this.generateRelatedTerms(seedKeyword);
                    collectionPromises.push(Promise.resolve(relatedTerms));
                }
                
                // 并发执行采集
                const results = await Promise.allSettled(collectionPromises);
                
                // 合并结果
                const keywordsFromSeed = [];
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                        keywordsFromSeed.push(...result.value);
                    } else if (result.status === 'rejected') {
                        this.logMessage(`⚠️ 采集源失败: ${result.reason.message}`, 'warning');
                    }
                });
                
                allCollectedKeywords.push(...keywordsFromSeed);
                processed++;
                
                // 避免请求过于频繁
                if (processed % 10 === 0) {
                    await this.delay(2000);
                }
                
            } catch (error) {
                this.logMessage(`❌ 采集失败 (${seedKeyword}): ${error.message}`, 'error');
                this.collectionStats.errors.push(`采集失败: ${seedKeyword} - ${error.message}`);
            }
        }
        
        return allCollectedKeywords;
    }

    // 处理和存储采集的关键词
    processCollectedKeywords(collectedKeywords) {
        this.logMessage(`📊 处理采集的关键词: ${collectedKeywords.length} 个`, 'info');
        
        collectedKeywords.forEach(item => {
            const { keyword, source, score, baseKeyword } = item;
            
            this.collectionStats.totalCollected++;
            
            // 过滤关键词
            if (!this.filterKeyword(keyword)) {
                this.collectionStats.filtered++;
                return;
            }
            
            // 检查是否已存在
            if (this.keywords.has(keyword)) {
                this.collectionStats.duplicates++;
                
                // 更新现有关键词信息
                const existing = this.keywords.get(keyword);
                existing.score = Math.max(existing.score, score);
                if (!existing.sources.includes(source)) {
                    existing.sources.push(source);
                }
                existing.lastUpdated = moment().tz(config.timezone).toISOString();
            } else {
                this.collectionStats.newKeywords++;
                
                // 添加新关键词
                this.keywords.set(keyword, {
                    score,
                    sources: [source],
                    timestamp: moment().tz(config.timezone).toISOString(),
                    lastUpdated: moment().tz(config.timezone).toISOString(),
                    metadata: {
                        baseKeyword: baseKeyword || null,
                        length: keyword.length,
                        hasChineseChars: /[\u4e00-\u9fff]/.test(keyword),
                        hasEnglishChars: /[a-zA-Z]/.test(keyword)
                    }
                });
            }
            
            // 统计来源
            if (!this.collectionStats.sources[source]) {
                this.collectionStats.sources[source] = 0;
            }
            this.collectionStats.sources[source]++;
        });
        
        this.logMessage(`✅ 处理完成: 新增 ${this.collectionStats.newKeywords} 个关键词`, 'info');
    }

    // 智能选择高价值关键词
    selectHighValueKeywords(limit = 100) {
        const sortedKeywords = Array.from(this.keywords.entries())
            .sort(([, a], [, b]) => b.score - a.score)
            .slice(0, limit);
        
        this.logMessage(`🎯 选择了 ${sortedKeywords.length} 个高价值关键词`, 'info');
        
        return sortedKeywords.map(([keyword, info]) => ({
            keyword,
            score: info.score,
            sources: info.sources,
            metadata: info.metadata
        }));
    }

    // 生成关键词报告
    generateCollectionReport() {
        const endTime = moment().tz(config.timezone);
        const duration = moment.duration(endTime.diff(this.startTime));
        
        const report = {
            meta: {
                timestamp: endTime.format('YYYY-MM-DD HH:mm:ss'),
                duration: duration.humanize(),
                timezone: config.timezone,
                reportType: '关键词采集报告'
            },
            
            summary: {
                totalKeywords: this.keywords.size,
                newKeywords: this.collectionStats.newKeywords,
                totalCollected: this.collectionStats.totalCollected,
                duplicates: this.collectionStats.duplicates,
                filtered: this.collectionStats.filtered,
                errors: this.collectionStats.errors.length
            },
            
            sources: Object.entries(this.collectionStats.sources).map(([source, count]) => ({
                source,
                count,
                percentage: `${((count / this.collectionStats.totalCollected) * 100).toFixed(2)}%`
            })),
            
            topKeywords: this.selectHighValueKeywords(50),
            
            analysis: {
                avgScore: this.calculateAverageScore(),
                scoreDistribution: this.getScoreDistribution(),
                languageDistribution: this.getLanguageDistribution(),
                lengthDistribution: this.getLengthDistribution()
            },
            
            recommendations: this.generateRecommendations(),
            
            nextCollection: endTime.clone().add(config.collection.refreshInterval, 'hours').format('YYYY-MM-DD HH:mm:ss')
        };
        
        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `keyword-collection-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 采集报告已保存: ${reportPath}`, 'info');
        return report;
    }

    // 计算平均得分
    calculateAverageScore() {
        if (this.keywords.size === 0) return 0;
        
        const totalScore = Array.from(this.keywords.values())
            .reduce((sum, info) => sum + info.score, 0);
        
        return (totalScore / this.keywords.size).toFixed(2);
    }

    // 获取得分分布
    getScoreDistribution() {
        const distribution = { low: 0, medium: 0, high: 0, premium: 0 };
        
        Array.from(this.keywords.values()).forEach(info => {
            if (info.score >= 10) distribution.premium++;
            else if (info.score >= 7) distribution.high++;
            else if (info.score >= 4) distribution.medium++;
            else distribution.low++;
        });
        
        return distribution;
    }

    // 获取语言分布
    getLanguageDistribution() {
        const distribution = { chinese: 0, english: 0, mixed: 0 };
        
        Array.from(this.keywords.values()).forEach(info => {
            const { hasChineseChars, hasEnglishChars } = info.metadata;
            if (hasChineseChars && hasEnglishChars) distribution.mixed++;
            else if (hasChineseChars) distribution.chinese++;
            else if (hasEnglishChars) distribution.english++;
        });
        
        return distribution;
    }

    // 获取长度分布
    getLengthDistribution() {
        const distribution = { short: 0, medium: 0, long: 0 };
        
        Array.from(this.keywords.values()).forEach(info => {
            const length = info.metadata.length;
            if (length <= 5) distribution.short++;
            else if (length <= 10) distribution.medium++;
            else distribution.long++;
        });
        
        return distribution;
    }

    // 生成优化建议
    generateRecommendations() {
        const recommendations = [];
        
        const scoreDistribution = this.getScoreDistribution();
        
        if (scoreDistribution.premium < this.keywords.size * 0.1) {
            recommendations.push('建议增加更多高价值关键词的采集');
        }
        
        if (scoreDistribution.low > this.keywords.size * 0.3) {
            recommendations.push('过多低价值关键词，建议优化过滤规则');
        }
        
        if (this.collectionStats.errors.length > 0) {
            recommendations.push('存在采集错误，建议检查网络连接和API限制');
        }
        
        if (this.keywords.size < 1000) {
            recommendations.push('关键词库偏小，建议扩展种子关键词');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('关键词采集系统运行良好，继续保持');
        }
        
        return recommendations;
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 主执行函数
    async run() {
        this.logMessage('🚀 24小时关键词采集系统启动', 'info');
        
        try {
            // 使用种子关键词进行采集
            const collectedKeywords = await this.collectKeywordsBatch(config.seedKeywords);
            
            // 处理采集的关键词
            this.processCollectedKeywords(collectedKeywords);
            
            // 保存关键词数据库
            this.saveKeywordsDatabase();
            
            // 生成报告
            const report = this.generateCollectionReport();
            
            // 输出统计
            this.logMessage('\n📊 关键词采集完成统计:', 'info');
            this.logMessage(`  关键词总数: ${report.summary.totalKeywords}`, 'info');
            this.logMessage(`  新增关键词: ${report.summary.newKeywords}`, 'info');
            this.logMessage(`  采集总数: ${report.summary.totalCollected}`, 'info');
            this.logMessage(`  重复关键词: ${report.summary.duplicates}`, 'info');
            this.logMessage(`  过滤关键词: ${report.summary.filtered}`, 'info');
            this.logMessage(`  平均得分: ${report.analysis.avgScore}`, 'info');
            this.logMessage(`  错误数量: ${report.summary.errors}`, 'info');
            this.logMessage(`  下次采集: ${report.nextCollection}`, 'info');
            
            return report;
            
        } catch (error) {
            this.logMessage(`❌ 关键词采集执行失败: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const collector = new KeywordCollector();
    collector.run()
        .then(report => {
            console.log('✅ 关键词采集执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 关键词采集执行失败:', error);
            process.exit(1);
        });
}

module.exports = KeywordCollector; 