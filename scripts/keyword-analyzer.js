/**
 * 智能关键词分析系统
 * 分析关键词表现，生成优化建议和策略
 */

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');

// 分析配置
const config = {
    timezone: 'Asia/Shanghai',
    
    // 分析指标权重
    weights: {
        searchVolume: 0.3,    // 搜索量权重
        competition: 0.2,     // 竞争度权重
        ranking: 0.3,         // 当前排名权重
        trend: 0.2           // 趋势权重
    },
    
    // 排名分级
    rankingTiers: {
        excellent: { min: 1, max: 3, score: 10 },
        good: { min: 4, max: 10, score: 7 },
        fair: { min: 11, max: 20, score: 5 },
        poor: { min: 21, max: 50, score: 3 },
        none: { min: 51, max: 100, score: 1 }
    },
    
    // 优化策略
    strategies: {
        highValue: {
            minScore: 8,
            actions: ['内容优化', '内链建设', '外链获取', '技术SEO']
        },
        mediumValue: {
            minScore: 5,
            actions: ['内容扩展', '页面优化', '用户体验改进']
        },
        lowValue: {
            minScore: 2,
            actions: ['长尾关键词开发', '内容创建', '基础优化']
        }
    },
    
    // 分析维度
    dimensions: {
        performance: ['排名表现', '流量潜力', '转化价值'],
        competition: ['竞争强度', '优化难度', '机会识别'],
        content: ['内容相关性', '页面质量', '用户意图匹配'],
        technical: ['页面速度', '移动友好', '结构化数据']
    }
};

class KeywordAnalyzer {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.keywords = new Map();
        this.rankings = new Map();
        this.analysis = new Map();
        this.opportunities = [];
        this.analysisStats = {
            totalKeywords: 0,
            analyzedKeywords: 0,
            highValueKeywords: 0,
            opportunities: 0,
            errors: []
        };
        this.log = [];
        
        this.ensureDirectories();
        this.loadData();
    }

    // 确保目录存在
    ensureDirectories() {
        const dirs = ['../data/analysis', '../data/keywords', '../data/rankings', '../reports'];
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

    // 加载数据
    loadData() {
        this.loadKeywords();
        this.loadRankings();
        this.loadPreviousAnalysis();
    }

    // 加载关键词数据
    loadKeywords() {
        try {
            const keywordFile = path.join(__dirname, '../data/keywords', 'keywords-database.json');
            if (fs.existsSync(keywordFile)) {
                const data = JSON.parse(fs.readFileSync(keywordFile, 'utf8'));
                
                if (data.keywords) {
                    Object.entries(data.keywords).forEach(([keyword, info]) => {
                        this.keywords.set(keyword, {
                            score: info.score || 1,
                            sources: info.sources || [],
                            metadata: info.metadata || {},
                            timestamp: info.timestamp
                        });
                    });
                }
                
                this.logMessage(`📋 加载了 ${this.keywords.size} 个关键词数据`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载关键词数据失败: ${error.message}`, 'warning');
        }
    }

    // 加载排名数据
    loadRankings() {
        try {
            const rankingFile = path.join(__dirname, '../data/rankings', 'ranking-history.json');
            if (fs.existsSync(rankingFile)) {
                const data = JSON.parse(fs.readFileSync(rankingFile, 'utf8'));
                
                if (data.rankings) {
                    Object.entries(data.rankings).forEach(([keyword, rankings]) => {
                        this.rankings.set(keyword, rankings);
                    });
                }
                
                this.logMessage(`📊 加载了 ${this.rankings.size} 个关键词排名数据`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载排名数据失败: ${error.message}`, 'warning');
        }
    }

    // 加载历史分析
    loadPreviousAnalysis() {
        try {
            const analysisFile = path.join(__dirname, '../data/analysis', 'keyword-analysis.json');
            if (fs.existsSync(analysisFile)) {
                const data = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
                
                if (data.analysis) {
                    Object.entries(data.analysis).forEach(([keyword, analysis]) => {
                        this.analysis.set(keyword, analysis);
                    });
                }
                
                this.logMessage(`🔍 加载了 ${this.analysis.size} 个关键词分析`, 'info');
            }
        } catch (error) {
            this.logMessage(`⚠️ 加载分析数据失败: ${error.message}`, 'warning');
        }
    }

    // 分析单个关键词
    analyzeKeyword(keyword) {
        const keywordInfo = this.keywords.get(keyword);
        const rankings = this.rankings.get(keyword);
        
        if (!keywordInfo) {
            return null;
        }

        const analysis = {
            keyword,
            timestamp: moment().tz(config.timezone).toISOString(),
            
            // 基础信息
            basicInfo: {
                score: keywordInfo.score,
                sources: keywordInfo.sources,
                length: keyword.length,
                language: this.detectLanguage(keyword),
                category: this.categorizeKeyword(keyword)
            },
            
            // 排名分析
            rankingAnalysis: this.analyzeRankings(keyword, rankings),
            
            // 竞争分析
            competitionAnalysis: this.analyzeCompetition(keyword),
            
            // 机会分析
            opportunityAnalysis: this.analyzeOpportunities(keyword, rankings),
            
            // 优化建议
            recommendations: this.generateRecommendations(keyword, keywordInfo, rankings),
            
            // 综合评分
            overallScore: 0
        };

        // 计算综合评分
        analysis.overallScore = this.calculateOverallScore(analysis);
        
        return analysis;
    }

    // 检测关键词语言
    detectLanguage(keyword) {
        const chineseRegex = /[\u4e00-\u9fff]/;
        const englishRegex = /[a-zA-Z]/;
        
        const hasChinese = chineseRegex.test(keyword);
        const hasEnglish = englishRegex.test(keyword);
        
        if (hasChinese && hasEnglish) return 'mixed';
        if (hasChinese) return 'chinese';
        if (hasEnglish) return 'english';
        return 'other';
    }

    // 关键词分类
    categorizeKeyword(keyword) {
        const categories = {
            brand: ['telegram', '电报', 'tg'],
            product: ['bot', '机器人', '频道', '群组', 'channel', 'group'],
            feature: ['下载', 'download', '注册', 'register', '使用', 'use'],
            tutorial: ['教程', 'tutorial', '怎么', 'how', '如何'],
            commercial: ['官网', '最新', '免费', 'free', 'official', 'latest']
        };
        
        const lowerKeyword = keyword.toLowerCase();
        
        for (const [category, terms] of Object.entries(categories)) {
            if (terms.some(term => lowerKeyword.includes(term.toLowerCase()))) {
                return category;
            }
        }
        
        return 'general';
    }

    // 排名分析
    analyzeRankings(keyword, rankings) {
        if (!rankings) {
            return {
                hasRankings: false,
                engines: [],
                bestRank: null,
                avgRank: null,
                rankingScore: 0
            };
        }

        const engineRankings = Object.entries(rankings).map(([engine, ranking]) => ({
            engine,
            rank: ranking.rank,
            url: ranking.url,
            tier: this.getRankingTier(ranking.rank)
        }));

        const ranks = engineRankings.map(r => r.rank);
        const bestRank = Math.min(...ranks);
        const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
        const rankingScore = this.calculateRankingScore(bestRank, avgRank);

        return {
            hasRankings: true,
            engines: engineRankings,
            bestRank,
            avgRank: Math.round(avgRank),
            rankingScore,
            distribution: this.getRankingDistribution(ranks)
        };
    }

    // 获取排名等级
    getRankingTier(rank) {
        for (const [tier, config] of Object.entries(config.rankingTiers)) {
            if (rank >= config.min && rank <= config.max) {
                return { tier, score: config.score };
            }
        }
        return { tier: 'none', score: 0 };
    }

    // 计算排名得分
    calculateRankingScore(bestRank, avgRank) {
        const bestTier = this.getRankingTier(bestRank);
        const avgTier = this.getRankingTier(avgRank);
        
        return Math.round((bestTier.score + avgTier.score) / 2);
    }

    // 排名分布分析
    getRankingDistribution(ranks) {
        const distribution = {
            top3: ranks.filter(r => r <= 3).length,
            top10: ranks.filter(r => r <= 10).length,
            top20: ranks.filter(r => r <= 20).length,
            beyond20: ranks.filter(r => r > 20).length
        };
        
        const total = ranks.length;
        return {
            counts: distribution,
            percentages: {
                top3: `${((distribution.top3 / total) * 100).toFixed(1)}%`,
                top10: `${((distribution.top10 / total) * 100).toFixed(1)}%`,
                top20: `${((distribution.top20 / total) * 100).toFixed(1)}%`,
                beyond20: `${((distribution.beyond20 / total) * 100).toFixed(1)}%`
            }
        };
    }

    // 竞争分析
    analyzeCompetition(keyword) {
        // 基于关键词特征估算竞争度
        const competitionFactors = {
            length: keyword.length,
            containsBrand: /telegram|电报|tg/i.test(keyword),
            isCommercial: /下载|官网|最新|免费/i.test(keyword),
            isLongTail: keyword.length > 15 || keyword.split(/\s+/).length > 3
        };

        let competitionScore = 5; // 基础竞争度

        // 品牌词竞争激烈
        if (competitionFactors.containsBrand) competitionScore += 3;
        
        // 商业词竞争激烈
        if (competitionFactors.isCommercial) competitionScore += 2;
        
        // 长尾词竞争较小
        if (competitionFactors.isLongTail) competitionScore -= 2;
        
        // 短词竞争激烈
        if (competitionFactors.length <= 4) competitionScore += 2;

        competitionScore = Math.max(1, Math.min(10, competitionScore));

        return {
            score: competitionScore,
            level: this.getCompetitionLevel(competitionScore),
            factors: competitionFactors,
            difficulty: this.getOptimizationDifficulty(competitionScore)
        };
    }

    // 获取竞争等级
    getCompetitionLevel(score) {
        if (score >= 8) return 'high';
        if (score >= 6) return 'medium';
        if (score >= 4) return 'low';
        return 'very_low';
    }

    // 获取优化难度
    getOptimizationDifficulty(competitionScore) {
        const difficulties = {
            1: 'very_easy',
            2: 'very_easy', 
            3: 'easy',
            4: 'easy',
            5: 'medium',
            6: 'medium',
            7: 'hard',
            8: 'hard',
            9: 'very_hard',
            10: 'very_hard'
        };
        
        return difficulties[competitionScore] || 'medium';
    }

    // 机会分析
    analyzeOpportunities(keyword, rankings) {
        const opportunities = [];
        
        if (!rankings) {
            opportunities.push({
                type: 'new_ranking',
                priority: 'high',
                description: '关键词尚未获得排名，存在新排名机会',
                actions: ['创建相关内容', '优化页面标题', '增加内链']
            });
            
            return { count: opportunities.length, opportunities };
        }

        // 分析各引擎排名机会
        Object.entries(rankings).forEach(([engine, ranking]) => {
            const rank = ranking.rank;
            
            // 接近首页机会
            if (rank > 10 && rank <= 15) {
                opportunities.push({
                    type: 'first_page',
                    priority: 'high',
                    engine,
                    currentRank: rank,
                    description: `在${engine}接近首页，当前第${rank}位`,
                    actions: ['优化页面内容', '增加相关内链', '改进用户体验']
                });
            }
            
            // 前三机会
            if (rank > 3 && rank <= 6) {
                opportunities.push({
                    type: 'top_three',
                    priority: 'medium',
                    engine,
                    currentRank: rank,
                    description: `在${engine}有冲击前三的潜力，当前第${rank}位`,
                    actions: ['提升页面权威性', '优化用户信号', '增强内容深度']
                });
            }
        });

        return {
            count: opportunities.length,
            opportunities
        };
    }

    // 生成优化建议
    generateRecommendations(keyword, keywordInfo, rankings) {
        const recommendations = [];
        const priority = this.getKeywordPriority(keywordInfo.score, rankings);
        
        // 基于优先级生成建议
        switch (priority) {
            case 'high':
                recommendations.push(
                    '这是高价值关键词，建议投入重点资源优化',
                    '创建专门的着陆页面，深度优化内容',
                    '建立相关的内链网络，提升页面权重',
                    '考虑外链建设，提升域名权威性'
                );
                break;
                
            case 'medium':
                recommendations.push(
                    '具有一定优化价值，建议适度投入',
                    '优化现有页面内容，提升相关性',
                    '改进页面用户体验和加载速度',
                    '增加相关的长尾关键词覆盖'
                );
                break;
                
            case 'low':
                recommendations.push(
                    '优化成本相对较高，建议长期规划',
                    '通过长尾关键词策略间接优化',
                    '关注内容质量，自然提升相关性',
                    '定期监控排名变化，寻找机会'
                );
                break;
        }

        // 基于排名情况的建议
        if (rankings) {
            const avgRank = Object.values(rankings).reduce((sum, r) => sum + r.rank, 0) / Object.keys(rankings).length;
            
            if (avgRank <= 20) {
                recommendations.push('当前排名良好，重点维护和微调优化');
            } else {
                recommendations.push('排名较低，需要系统性的SEO优化');
            }
        }

        return {
            priority,
            actions: recommendations,
            timeline: this.getOptimizationTimeline(priority),
            resources: this.getRequiredResources(priority)
        };
    }

    // 获取关键词优先级
    getKeywordPriority(score, rankings) {
        let priorityScore = score;
        
        if (rankings) {
            const bestRank = Math.min(...Object.values(rankings).map(r => r.rank));
            if (bestRank <= 10) priorityScore += 3;
            else if (bestRank <= 20) priorityScore += 2;
            else if (bestRank <= 30) priorityScore += 1;
        }
        
        if (priorityScore >= 8) return 'high';
        if (priorityScore >= 5) return 'medium';
        return 'low';
    }

    // 获取优化时间线
    getOptimizationTimeline(priority) {
        const timelines = {
            high: '1-3个月',
            medium: '3-6个月',
            low: '6-12个月'
        };
        
        return timelines[priority] || '3-6个月';
    }

    // 获取所需资源
    getRequiredResources(priority) {
        const resources = {
            high: ['专业SEO团队', '内容创作', '技术优化', '外链建设'],
            medium: ['内容优化', '页面改进', '基础SEO'],
            low: ['内容维护', '长期监控', '机会跟踪']
        };
        
        return resources[priority] || resources.medium;
    }

    // 计算综合评分
    calculateOverallScore(analysis) {
        let score = 0;
        
        // 基础得分
        score += analysis.basicInfo.score * 0.3;
        
        // 排名得分
        if (analysis.rankingAnalysis.hasRankings) {
            score += analysis.rankingAnalysis.rankingScore * 0.4;
        }
        
        // 竞争度调整
        const competitionAdjustment = {
            'very_low': 1.2,
            'low': 1.1,
            'medium': 1.0,
            'high': 0.9,
            'very_high': 0.8
        };
        
        score *= competitionAdjustment[analysis.competitionAnalysis.level] || 1.0;
        
        // 机会加分
        score += analysis.opportunityAnalysis.count * 0.5;
        
        return Math.round(score * 10) / 10;
    }

    // 识别高价值机会
    identifyHighValueOpportunities() {
        const opportunities = [];
        
        Array.from(this.analysis.entries()).forEach(([keyword, analysis]) => {
            // 高得分但排名不佳
            if (analysis.overallScore >= 7 && analysis.rankingAnalysis.hasRankings) {
                const avgRank = analysis.rankingAnalysis.avgRank;
                if (avgRank > 10) {
                    opportunities.push({
                        keyword,
                        type: 'underperforming_high_value',
                        score: analysis.overallScore,
                        currentRank: avgRank,
                        potential: 'high',
                        description: '高价值关键词表现不佳，优化潜力巨大'
                    });
                }
            }
            
            // 接近突破的关键词
            if (analysis.rankingAnalysis.hasRankings) {
                const bestRank = analysis.rankingAnalysis.bestRank;
                if (bestRank > 10 && bestRank <= 15) {
                    opportunities.push({
                        keyword,
                        type: 'breakthrough_potential',
                        score: analysis.overallScore,
                        currentRank: bestRank,
                        potential: 'medium',
                        description: '接近首页突破，短期优化可见效'
                    });
                }
            }
            
            // 新关键词机会
            if (!analysis.rankingAnalysis.hasRankings && analysis.basicInfo.score >= 5) {
                opportunities.push({
                    keyword,
                    type: 'new_opportunity',
                    score: analysis.overallScore,
                    currentRank: null,
                    potential: 'medium',
                    description: '高潜力新关键词，适合内容创建'
                });
            }
        });
        
        // 按潜力和得分排序
        opportunities.sort((a, b) => {
            const potentialOrder = { high: 3, medium: 2, low: 1 };
            const aPotential = potentialOrder[a.potential] || 1;
            const bPotential = potentialOrder[b.potential] || 1;
            
            if (aPotential !== bPotential) {
                return bPotential - aPotential;
            }
            
            return b.score - a.score;
        });
        
        return opportunities;
    }

    // 保存分析结果
    saveAnalysisResults() {
        try {
            const analysisFile = path.join(__dirname, '../data/analysis', 'keyword-analysis.json');
            
            const data = {
                metadata: {
                    lastUpdated: moment().tz(config.timezone).toISOString(),
                    totalKeywords: this.analysisStats.totalKeywords,
                    analyzedKeywords: this.analysisStats.analyzedKeywords,
                    stats: this.analysisStats
                },
                analysis: Object.fromEntries(this.analysis),
                opportunities: this.opportunities
            };
            
            fs.writeFileSync(analysisFile, JSON.stringify(data, null, 2));
            this.logMessage(`💾 保存了 ${this.analysis.size} 个关键词分析结果`, 'info');
        } catch (error) {
            this.logMessage(`❌ 保存分析结果失败: ${error.message}`, 'error');
        }
    }

    // 生成分析报告
    generateAnalysisReport() {
        const endTime = moment().tz(config.timezone);
        const duration = moment.duration(endTime.diff(this.startTime));
        
        // 统计分析结果
        const scoreDistribution = this.getScoreDistribution();
        const categoryDistribution = this.getCategoryDistribution();
        const opportunityTypes = this.getOpportunityTypes();
        
        const report = {
            meta: {
                timestamp: endTime.format('YYYY-MM-DD HH:mm:ss'),
                duration: duration.humanize(),
                timezone: config.timezone,
                reportType: '关键词智能分析报告'
            },
            
            summary: {
                totalKeywords: this.analysisStats.totalKeywords,
                analyzedKeywords: this.analysisStats.analyzedKeywords,
                highValueKeywords: this.analysisStats.highValueKeywords,
                identifiedOpportunities: this.opportunities.length,
                averageScore: this.calculateAverageScore()
            },
            
            distribution: {
                scores: scoreDistribution,
                categories: categoryDistribution,
                opportunities: opportunityTypes
            },
            
            topKeywords: this.getTopKeywords(20),
            highValueOpportunities: this.opportunities.slice(0, 30),
            
            insights: {
                strengths: this.identifyStrengths(),
                weaknesses: this.identifyWeaknesses(),
                quickWins: this.identifyQuickWins(),
                longTermOpportunities: this.identifyLongTermOpportunities()
            },
            
            recommendations: {
                immediate: this.getImmediateRecommendations(),
                shortTerm: this.getShortTermRecommendations(),
                longTerm: this.getLongTermRecommendations()
            },
            
            nextAnalysis: endTime.clone().add(7, 'days').format('YYYY-MM-DD HH:mm:ss')
        };
        
        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `keyword-analysis-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 分析报告已保存: ${reportPath}`, 'info');
        return report;
    }

    // 获取得分分布
    getScoreDistribution() {
        const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
        
        Array.from(this.analysis.values()).forEach(analysis => {
            const score = analysis.overallScore;
            if (score >= 8) distribution.excellent++;
            else if (score >= 6) distribution.good++;
            else if (score >= 4) distribution.fair++;
            else distribution.poor++;
        });
        
        return distribution;
    }

    // 获取分类分布
    getCategoryDistribution() {
        const distribution = {};
        
        Array.from(this.analysis.values()).forEach(analysis => {
            const category = analysis.basicInfo.category;
            distribution[category] = (distribution[category] || 0) + 1;
        });
        
        return distribution;
    }

    // 获取机会类型分布
    getOpportunityTypes() {
        const distribution = {};
        
        this.opportunities.forEach(opp => {
            distribution[opp.type] = (distribution[opp.type] || 0) + 1;
        });
        
        return distribution;
    }

    // 计算平均得分
    calculateAverageScore() {
        if (this.analysis.size === 0) return 0;
        
        const totalScore = Array.from(this.analysis.values())
            .reduce((sum, analysis) => sum + analysis.overallScore, 0);
        
        return (totalScore / this.analysis.size).toFixed(2);
    }

    // 获取顶级关键词
    getTopKeywords(limit = 20) {
        return Array.from(this.analysis.entries())
            .sort(([, a], [, b]) => b.overallScore - a.overallScore)
            .slice(0, limit)
            .map(([keyword, analysis]) => ({
                keyword,
                score: analysis.overallScore,
                category: analysis.basicInfo.category,
                bestRank: analysis.rankingAnalysis.bestRank,
                opportunities: analysis.opportunityAnalysis.count
            }));
    }

    // 识别优势
    identifyStrengths() {
        const strengths = [];
        
        const excellentKeywords = Array.from(this.analysis.values())
            .filter(a => a.overallScore >= 8).length;
        
        if (excellentKeywords > 0) {
            strengths.push(`拥有 ${excellentKeywords} 个高价值关键词`);
        }
        
        const topRankings = Array.from(this.analysis.values())
            .filter(a => a.rankingAnalysis.bestRank && a.rankingAnalysis.bestRank <= 10).length;
        
        if (topRankings > 0) {
            strengths.push(`${topRankings} 个关键词已进入前10名`);
        }
        
        return strengths;
    }

    // 识别弱点
    identifyWeaknesses() {
        const weaknesses = [];
        
        const noRankings = Array.from(this.analysis.values())
            .filter(a => !a.rankingAnalysis.hasRankings).length;
        
        if (noRankings > this.analysis.size * 0.3) {
            weaknesses.push(`${noRankings} 个关键词尚未获得排名`);
        }
        
        const poorPerformers = Array.from(this.analysis.values())
            .filter(a => a.overallScore < 4).length;
        
        if (poorPerformers > 0) {
            weaknesses.push(`${poorPerformers} 个关键词表现不佳`);
        }
        
        return weaknesses;
    }

    // 识别快速见效机会
    identifyQuickWins() {
        return this.opportunities
            .filter(opp => opp.type === 'breakthrough_potential')
            .slice(0, 10)
            .map(opp => `${opp.keyword} - ${opp.description}`);
    }

    // 识别长期机会
    identifyLongTermOpportunities() {
        return this.opportunities
            .filter(opp => opp.type === 'new_opportunity')
            .slice(0, 10)
            .map(opp => `${opp.keyword} - ${opp.description}`);
    }

    // 获取即时建议
    getImmediateRecommendations() {
        return [
            '优化排名11-15位的关键词，争取进入首页',
            '为高价值无排名关键词创建专门内容',
            '改进现有页面的用户体验和加载速度'
        ];
    }

    // 获取短期建议
    getShortTermRecommendations() {
        return [
            '建立系统的内链结构，提升页面权重',
            '扩展长尾关键词覆盖，提高流量多样性',
            '优化页面标题和描述，提高点击率'
        ];
    }

    // 获取长期建议
    getLongTermRecommendations() {
        return [
            '建设高质量外链，提升域名权威性',
            '持续创建深度内容，覆盖更多关键词',
            '建立品牌知名度，提升直接搜索量'
        ];
    }

    // 主执行函数
    async run() {
        this.logMessage('🧠 智能关键词分析系统启动', 'info');
        
        try {
            if (this.keywords.size === 0) {
                this.logMessage('⚠️ 没有找到关键词数据，请先运行关键词采集系统', 'warning');
                return null;
            }
            
            this.analysisStats.totalKeywords = this.keywords.size;
            
            // 分析所有关键词
            this.logMessage(`🔍 开始分析 ${this.keywords.size} 个关键词`, 'info');
            
            for (const keyword of this.keywords.keys()) {
                const analysis = this.analyzeKeyword(keyword);
                if (analysis) {
                    this.analysis.set(keyword, analysis);
                    this.analysisStats.analyzedKeywords++;
                    
                    if (analysis.overallScore >= 7) {
                        this.analysisStats.highValueKeywords++;
                    }
                }
            }
            
            // 识别机会
            this.opportunities = this.identifyHighValueOpportunities();
            this.analysisStats.opportunities = this.opportunities.length;
            
            // 保存分析结果
            this.saveAnalysisResults();
            
            // 生成报告
            const report = this.generateAnalysisReport();
            
            // 输出统计
            this.logMessage('\n📊 关键词分析完成统计:', 'info');
            this.logMessage(`  总关键词: ${report.summary.totalKeywords}`, 'info');
            this.logMessage(`  已分析: ${report.summary.analyzedKeywords}`, 'info');
            this.logMessage(`  高价值关键词: ${report.summary.highValueKeywords}`, 'info');
            this.logMessage(`  识别机会: ${report.summary.identifiedOpportunities}`, 'info');
            this.logMessage(`  平均得分: ${report.summary.averageScore}`, 'info');
            this.logMessage(`  下次分析: ${report.nextAnalysis}`, 'info');
            
            return report;
            
        } catch (error) {
            this.logMessage(`❌ 关键词分析执行失败: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const analyzer = new KeywordAnalyzer();
    analyzer.run()
        .then(report => {
            console.log('✅ 关键词分析执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 关键词分析执行失败:', error);
            process.exit(1);
        });
}

module.exports = KeywordAnalyzer; 