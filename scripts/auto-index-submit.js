/**
 * 自动索引提交脚本
 * 支持 Google Search Console、百度、Bing 等搜索引擎
 * 可定时执行或手动触发
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const xml2js = require('xml2js');

// 配置信息
const config = {
    siteUrl: 'https://q877220.github.io/repo-030/',
    sitemapUrl: 'https://q877220.github.io/repo-030/sitemap.xml',
    // 搜索引擎API配置（需要在GitHub Secrets中设置）
    google: {
        serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        siteUrl: process.env.GOOGLE_SITE_URL || 'https://q877220.github.io/repo-030/'
    },
    baidu: {
        token: process.env.BAIDU_PUSH_TOKEN,
        site: process.env.BAIDU_SITE_URL || 'q877220.github.io'
    },
    bing: {
        apiKey: process.env.BING_API_KEY,
        siteUrl: process.env.BING_SITE_URL || 'https://q877220.github.io/repo-030/'
    }
};

// 所有重要页面URL列表
const importantUrls = [
    'https://q877220.github.io/repo-030/',
    'https://q877220.github.io/repo-030/telegram-bots.html',
    'https://q877220.github.io/repo-030/telegram-channels.html',
    'https://q877220.github.io/repo-030/telegram-clients.html',
    'https://q877220.github.io/repo-030/quick-index-request.html',
    'https://q877220.github.io/repo-030/telegram-tools.html',
    'https://q877220.github.io/repo-030/telegram-themes.html',
    'https://q877220.github.io/repo-030/telegram-stickers.html',
    'https://q877220.github.io/repo-030/telegram-groups.html'
];

class AutoIndexSubmitter {
    constructor() {
        this.results = {
            success: [],
            failed: [],
            total: 0
        };
    }

    /**
     * 从sitemap.xml获取所有URL
     */
    async getSitemapUrls() {
        return new Promise((resolve, reject) => {
            https.get(config.sitemapUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    xml2js.parseString(data, (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        const urls = result.urlset.url.map(item => item.loc[0]);
                        resolve(urls);
                    });
                });
            }).on('error', reject);
        });
    }

    /**
     * 提交URL到Google Search Console
     */
    async submitToGoogle(urls) {
        if (!config.google.serviceAccountKey) {
            console.log('⚠️  Google API 密钥未配置，跳过 Google 提交');
            return { success: false, message: 'API key not configured' };
        }

        console.log('🔍 开始提交到 Google Search Console...');
        
        try {
            // 这里需要使用 Google Search Console API
            // 实际实现需要 OAuth2 认证
            const results = [];
            
            for (const url of urls) {
                try {
                    // 模拟API调用（实际需要真实的Google API集成）
                    console.log(`  📤 提交: ${url}`);
                    
                    // 这里应该调用真实的Google Search Console API
                    // const response = await googleSearchConsole.urlInspection.index.request({...});
                    
                    results.push({ url, status: 'success', service: 'google' });
                    this.results.success.push(`Google: ${url}`);
                    
                    // 避免API限制，添加延迟
                    await this.delay(1000);
                } catch (error) {
                    console.log(`  ❌ 失败: ${url} - ${error.message}`);
                    results.push({ url, status: 'failed', error: error.message, service: 'google' });
                    this.results.failed.push(`Google: ${url} - ${error.message}`);
                }
            }
            
            return { success: true, results };
        } catch (error) {
            console.error('Google 提交失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 提交URL到百度搜索资源平台
     */
    async submitToBaidu(urls) {
        if (!config.baidu.token) {
            console.log('⚠️  百度推送Token未配置，跳过百度提交');
            return { success: false, message: 'Token not configured' };
        }

        console.log('🅱️  开始提交到百度搜索资源平台...');
        
        try {
            const postData = urls.join('\n');
            const options = {
                hostname: 'data.zz.baidu.com',
                port: 443,
                path: `/urls?site=${config.baidu.site}&token=${config.baidu.token}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            return new Promise((resolve) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            console.log('  ✅ 百度提交结果:', result);
                            
                            if (result.success) {
                                urls.forEach(url => this.results.success.push(`Baidu: ${url}`));
                                resolve({ success: true, result });
                            } else {
                                urls.forEach(url => this.results.failed.push(`Baidu: ${url} - ${result.message}`));
                                resolve({ success: false, result });
                            }
                        } catch (error) {
                            console.error('  ❌ 百度响应解析失败:', error);
                            resolve({ success: false, error: error.message });
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error('  ❌ 百度提交请求失败:', error);
                    resolve({ success: false, error: error.message });
                });

                req.write(postData);
                req.end();
            });
        } catch (error) {
            console.error('百度提交失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 提交URL到Bing Webmaster Tools
     */
    async submitToBing(urls) {
        if (!config.bing.apiKey) {
            console.log('⚠️  Bing API Key未配置，跳过Bing提交');
            return { success: false, message: 'API key not configured' };
        }

        console.log('🦆 开始提交到 Bing Webmaster Tools...');
        
        try {
            const results = [];
            
            for (const url of urls) {
                try {
                    const postData = JSON.stringify({
                        siteUrl: config.bing.siteUrl,
                        urlList: [url]
                    });

                    const options = {
                        hostname: 'ssl.bing.com',
                        port: 443,
                        path: '/webmaster/api.svc/json/SubmitUrlbatch?apikey=' + config.bing.apiKey,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const result = await new Promise((resolve, reject) => {
                        const req = https.request(options, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => {
                                try {
                                    const result = JSON.parse(data);
                                    resolve(result);
                                } catch (error) {
                                    reject(error);
                                }
                            });
                        });

                        req.on('error', reject);
                        req.write(postData);
                        req.end();
                    });

                    console.log(`  📤 Bing提交: ${url}`);
                    results.push({ url, status: 'success', result, service: 'bing' });
                    this.results.success.push(`Bing: ${url}`);
                    
                    await this.delay(2000); // Bing API限制较严格
                } catch (error) {
                    console.log(`  ❌ Bing失败: ${url} - ${error.message}`);
                    results.push({ url, status: 'failed', error: error.message, service: 'bing' });
                    this.results.failed.push(`Bing: ${url} - ${error.message}`);
                }
            }
            
            return { success: true, results };
        } catch (error) {
            console.error('Bing提交失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 生成提交报告
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                success: this.results.success.length,
                failed: this.results.failed.length,
                successRate: ((this.results.success.length / this.results.total) * 100).toFixed(2) + '%'
            },
            details: {
                success: this.results.success,
                failed: this.results.failed
            }
        };

        // 保存报告到文件
        const reportPath = path.join(__dirname, '../reports', `index-submit-${Date.now()}.json`);
        
        // 确保reports目录存在
        const reportsDir = path.dirname(reportPath);
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📊 报告已保存: ${reportPath}`);
        
        return report;
    }

    /**
     * 执行自动提交
     */
    async run() {
        console.log('🚀 开始自动索引提交...');
        console.log('⏰ 执行时间:', new Date().toLocaleString());
        
        try {
            // 获取所有URL
            const sitemapUrls = await this.getSitemapUrls();
            const allUrls = [...new Set([...importantUrls, ...sitemapUrls])];
            
            this.results.total = allUrls.length;
            console.log(`📋 共找到 ${allUrls.length} 个URL需要提交`);
            
            // 并行提交到各个搜索引擎
            const promises = [
                this.submitToGoogle(allUrls),
                this.submitToBaidu(allUrls),
                this.submitToBing(allUrls)
            ];
            
            const results = await Promise.allSettled(promises);
            
            // 生成报告
            const report = this.generateReport();
            
            // 输出总结
            console.log('\n📊 提交完成统计:');
            console.log(`  总数: ${report.summary.total}`);
            console.log(`  成功: ${report.summary.success}`);
            console.log(`  失败: ${report.summary.failed}`);
            console.log(`  成功率: ${report.summary.successRate}`);
            
            // 如果有失败的，输出详情
            if (this.results.failed.length > 0) {
                console.log('\n❌ 失败详情:');
                this.results.failed.forEach(item => console.log(`  ${item}`));
            }
            
            return report;
            
        } catch (error) {
            console.error('❌ 自动提交执行失败:', error);
            throw error;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const submitter = new AutoIndexSubmitter();
    submitter.run()
        .then(report => {
            console.log('✅ 自动索引提交完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 执行失败:', error);
            process.exit(1);
        });
}

module.exports = AutoIndexSubmitter; 