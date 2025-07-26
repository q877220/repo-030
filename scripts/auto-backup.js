/**
 * 自动备份系统
 * 定期备份网站内容、配置、日志等重要数据
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const moment = require('moment-timezone');
const crypto = require('crypto');

// 备份配置
const config = {
    timezone: 'Asia/Shanghai',
    backupDir: path.join(__dirname, '../backups'),
    
    // 备份策略
    retention: {
        daily: 7,     // 保留7天的每日备份
        weekly: 4,    // 保留4周的每周备份
        monthly: 6    // 保留6个月的每月备份
    },
    
    // 备份内容
    sources: [
        {
            name: 'website-content',
            path: '../',
            include: ['*.html', '*.css', '*.js', '*.xml', '*.txt', 'data/**/*'],
            exclude: ['node_modules/**', '.git/**', 'logs/**', 'backups/**', 'cache/**'],
            critical: true
        },
        {
            name: 'configuration',
            path: '../.github',
            include: ['**/*'],
            exclude: [],
            critical: true
        },
        {
            name: 'scripts',
            path: '../scripts',
            include: ['*.js', '*.json'],
            exclude: ['node_modules/**'],
            critical: true
        },
        {
            name: 'reports',
            path: '../reports',
            include: ['*.json', '*.md'],
            exclude: [],
            critical: false
        },
        {
            name: 'logs',
            path: '../logs',
            include: ['*.log', '*.json'],
            exclude: [],
            critical: false
        }
    ],

    // 压缩设置
    compression: {
        level: 6,     // 压缩级别 (0-9)
        method: 'gzip'
    }
};

class AutoBackup {
    constructor() {
        this.startTime = moment().tz(config.timezone);
        this.backupStats = {
            totalFiles: 0,
            totalSize: 0,
            compressedSize: 0,
            compressionRatio: 0,
            duration: 0,
            errors: [],
            warnings: []
        };
        this.log = [];
        
        this.ensureDirectories();
    }

    // 确保备份目录存在
    ensureDirectories() {
        if (!fs.existsSync(config.backupDir)) {
            fs.mkdirSync(config.backupDir, { recursive: true });
        }
        
        // 创建分类目录
        ['daily', 'weekly', 'monthly', 'emergency'].forEach(type => {
            const typeDir = path.join(config.backupDir, type);
            if (!fs.existsSync(typeDir)) {
                fs.mkdirSync(typeDir, { recursive: true });
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

    // 获取文件信息
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile()
            };
        } catch (error) {
            return null;
        }
    }

    // 扫描源目录
    async scanSource(source) {
        const sourcePath = path.resolve(__dirname, source.path);
        this.logMessage(`📂 扫描源目录: ${source.name} (${sourcePath})`, 'info');
        
        const files = [];
        
        if (!fs.existsSync(sourcePath)) {
            this.logMessage(`⚠️ 源目录不存在: ${sourcePath}`, 'warning');
            this.backupStats.warnings.push(`源目录不存在: ${source.name}`);
            return files;
        }

        try {
            const scanDirectory = async (dirPath, relativePath = '') => {
                const items = await fs.readdir(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativeFilePath = path.join(relativePath, item).replace(/\\/g, '/');
                    
                    // 检查排除规则
                    const isExcluded = source.exclude.some(pattern => {
                        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                        return regex.test(relativeFilePath);
                    });
                    
                    if (isExcluded) {
                        continue;
                    }
                    
                    const fileInfo = await this.getFileInfo(fullPath);
                    if (!fileInfo) continue;
                    
                    if (fileInfo.isDirectory) {
                        await scanDirectory(fullPath, relativeFilePath);
                    } else if (fileInfo.isFile) {
                        // 检查包含规则
                        const isIncluded = source.include.length === 0 || source.include.some(pattern => {
                            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                            return regex.test(relativeFilePath);
                        });
                        
                        if (isIncluded) {
                            files.push({
                                fullPath,
                                relativePath: relativeFilePath,
                                size: fileInfo.size,
                                mtime: fileInfo.mtime
                            });
                        }
                    }
                }
            };
            
            await scanDirectory(sourcePath);
            
        } catch (error) {
            this.logMessage(`❌ 扫描源目录失败: ${source.name} - ${error.message}`, 'error');
            this.backupStats.errors.push(`扫描失败: ${source.name} - ${error.message}`);
        }
        
        this.logMessage(`📊 找到 ${files.length} 个文件 (${source.name})`, 'info');
        return files;
    }

    // 创建备份压缩包
    async createBackupArchive(backupType, allFiles) {
        const timestamp = moment().tz(config.timezone).format('YYYY-MM-DD_HH-mm-ss');
        const backupFileName = `backup_${backupType}_${timestamp}.zip`;
        const backupPath = path.join(config.backupDir, backupType, backupFileName);
        
        this.logMessage(`📦 创建备份压缩包: ${backupFileName}`, 'info');
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(backupPath);
            const archive = archiver('zip', {
                zlib: { level: config.compression.level }
            });
            
            let totalFiles = 0;
            let totalSize = 0;
            
            output.on('close', () => {
                const compressedSize = archive.pointer();
                const compressionRatio = totalSize > 0 ? ((totalSize - compressedSize) / totalSize * 100).toFixed(2) : 0;
                
                this.backupStats.totalFiles = totalFiles;
                this.backupStats.totalSize = totalSize;
                this.backupStats.compressedSize = compressedSize;
                this.backupStats.compressionRatio = compressionRatio;
                
                this.logMessage(`✅ 备份创建完成: ${this.formatFileSize(compressedSize)} (压缩率: ${compressionRatio}%)`, 'info');
                
                resolve({
                    filePath: backupPath,
                    fileName: backupFileName,
                    size: compressedSize,
                    checksum: this.calculateChecksum(backupPath)
                });
            });
            
            output.on('error', reject);
            archive.on('error', reject);
            
            archive.on('entry', (entry) => {
                totalFiles++;
                totalSize += entry.stats.size;
            });
            
            archive.pipe(output);
            
            // 添加文件到压缩包
            for (const source of config.sources) {
                const sourceFiles = allFiles[source.name] || [];
                const sourcePath = path.resolve(__dirname, source.path);
                
                for (const file of sourceFiles) {
                    try {
                        const archivePath = `${source.name}/${file.relativePath}`;
                        archive.file(file.fullPath, { name: archivePath });
                    } catch (error) {
                        this.logMessage(`⚠️ 添加文件失败: ${file.relativePath} - ${error.message}`, 'warning');
                        this.backupStats.warnings.push(`添加文件失败: ${file.relativePath}`);
                    }
                }
            }
            
            // 添加备份元数据
            const metadata = {
                timestamp: moment().tz(config.timezone).toISOString(),
                backupType,
                sources: config.sources.map(s => ({
                    name: s.name,
                    fileCount: allFiles[s.name] ? allFiles[s.name].length : 0,
                    critical: s.critical
                })),
                system: {
                    hostname: require('os').hostname(),
                    platform: process.platform,
                    nodeVersion: process.version
                }
            };
            
            archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-metadata.json' });
            
            archive.finalize();
        });
    }

    // 计算文件校验和
    calculateChecksum(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            this.logMessage(`⚠️ 计算校验和失败: ${error.message}`, 'warning');
            return null;
        }
    }

    // 清理旧备份
    async cleanupOldBackups() {
        this.logMessage('🧹 开始清理旧备份', 'info');
        
        for (const [type, retentionDays] of Object.entries(config.retention)) {
            const typeDir = path.join(config.backupDir, type);
            if (!fs.existsSync(typeDir)) continue;
            
            try {
                const files = await fs.readdir(typeDir);
                const backupFiles = files
                    .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
                    .map(file => ({
                        name: file,
                        path: path.join(typeDir, file),
                        mtime: fs.statSync(path.join(typeDir, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                // 保留指定数量的备份，删除多余的
                const toDelete = backupFiles.slice(retentionDays);
                
                for (const backup of toDelete) {
                    await fs.remove(backup.path);
                    this.logMessage(`🗑️ 删除旧备份: ${backup.name}`, 'info');
                }
                
                if (toDelete.length > 0) {
                    this.logMessage(`📊 清理了 ${toDelete.length} 个旧备份 (${type})`, 'info');
                }
                
            } catch (error) {
                this.logMessage(`❌ 清理备份失败 (${type}): ${error.message}`, 'error');
                this.backupStats.errors.push(`清理备份失败: ${type}`);
            }
        }
    }

    // 验证备份完整性
    async verifyBackup(backupInfo) {
        this.logMessage(`🔍 验证备份完整性: ${backupInfo.fileName}`, 'info');
        
        try {
            // 检查文件是否存在
            if (!fs.existsSync(backupInfo.filePath)) {
                throw new Error('备份文件不存在');
            }
            
            // 检查文件大小
            const stats = await fs.stat(backupInfo.filePath);
            if (stats.size !== backupInfo.size) {
                throw new Error(`文件大小不匹配: 期望 ${backupInfo.size}, 实际 ${stats.size}`);
            }
            
            // 验证校验和
            if (backupInfo.checksum) {
                const actualChecksum = this.calculateChecksum(backupInfo.filePath);
                if (actualChecksum !== backupInfo.checksum) {
                    throw new Error('文件校验和不匹配');
                }
            }
            
            this.logMessage(`✅ 备份验证通过: ${backupInfo.fileName}`, 'info');
            return true;
            
        } catch (error) {
            this.logMessage(`❌ 备份验证失败: ${backupInfo.fileName} - ${error.message}`, 'error');
            this.backupStats.errors.push(`备份验证失败: ${error.message}`);
            return false;
        }
    }

    // 确定备份类型
    determineBackupType() {
        const now = moment().tz(config.timezone);
        const isManual = process.env.OPERATION_MODE === 'manual';
        const isEmergency = process.env.OPERATION_MODE === 'emergency';
        
        if (isEmergency) {
            return 'emergency';
        }
        
        if (isManual) {
            return 'daily';
        }
        
        // 每月1号创建月度备份
        if (now.date() === 1 && now.hour() === 2) {
            return 'monthly';
        }
        
        // 每周一创建周度备份
        if (now.day() === 1 && now.hour() === 2) {
            return 'weekly';
        }
        
        // 默认创建日度备份
        return 'daily';
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 生成备份报告
    generateBackupReport(backupInfo, backupType) {
        const endTime = moment().tz(config.timezone);
        const duration = moment.duration(endTime.diff(this.startTime));
        
        this.backupStats.duration = duration.asSeconds();
        
        const report = {
            meta: {
                timestamp: endTime.format('YYYY-MM-DD HH:mm:ss'),
                backupType,
                duration: duration.humanize(),
                timezone: config.timezone
            },
            
            backup: {
                fileName: backupInfo.fileName,
                filePath: backupInfo.filePath,
                size: this.formatFileSize(backupInfo.size),
                checksum: backupInfo.checksum
            },
            
            statistics: {
                totalFiles: this.backupStats.totalFiles,
                originalSize: this.formatFileSize(this.backupStats.totalSize),
                compressedSize: this.formatFileSize(this.backupStats.compressedSize),
                compressionRatio: `${this.backupStats.compressionRatio}%`,
                duration: `${this.backupStats.duration.toFixed(2)}秒`
            },
            
            sources: config.sources.map(source => ({
                name: source.name,
                critical: source.critical,
                status: this.backupStats.errors.some(e => e.includes(source.name)) ? 'ERROR' : 'SUCCESS'
            })),
            
            issues: {
                errors: this.backupStats.errors,
                warnings: this.backupStats.warnings
            },
            
            nextBackup: {
                daily: endTime.clone().add(1, 'day').hour(2).minute(0).format('YYYY-MM-DD HH:mm:ss'),
                weekly: endTime.clone().add(1, 'week').day(1).hour(2).minute(0).format('YYYY-MM-DD HH:mm:ss'),
                monthly: endTime.clone().add(1, 'month').date(1).hour(2).minute(0).format('YYYY-MM-DD HH:mm:ss')
            }
        };
        
        // 保存报告
        const reportPath = path.join(__dirname, '../reports', `backup-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logMessage(`📊 备份报告已保存: ${reportPath}`, 'info');
        return report;
    }

    // 主执行函数
    async run() {
        this.logMessage('💾 自动备份系统启动', 'info');
        
        try {
            // 确定备份类型
            const backupType = this.determineBackupType();
            this.logMessage(`📋 备份类型: ${backupType}`, 'info');
            
            // 扫描所有源目录
            const allFiles = {};
            for (const source of config.sources) {
                allFiles[source.name] = await this.scanSource(source);
            }
            
            // 创建备份
            const backupInfo = await this.createBackupArchive(backupType, allFiles);
            
            // 验证备份
            const isValid = await this.verifyBackup(backupInfo);
            if (!isValid) {
                throw new Error('备份验证失败');
            }
            
            // 清理旧备份
            await this.cleanupOldBackups();
            
            // 生成报告
            const report = this.generateBackupReport(backupInfo, backupType);
            
            // 输出总结
            this.logMessage('\n📊 备份完成统计:', 'info');
            this.logMessage(`  备份文件: ${report.backup.fileName}`, 'info');
            this.logMessage(`  文件大小: ${report.backup.size}`, 'info');
            this.logMessage(`  文件数量: ${report.statistics.totalFiles}`, 'info');
            this.logMessage(`  压缩率: ${report.statistics.compressionRatio}`, 'info');
            this.logMessage(`  耗时: ${report.statistics.duration}`, 'info');
            this.logMessage(`  错误: ${report.issues.errors.length}`, 'info');
            this.logMessage(`  警告: ${report.issues.warnings.length}`, 'info');
            
            return report;
            
        } catch (error) {
            this.logMessage(`❌ 备份执行失败: ${error.message}`, 'error');
            throw error;
        }
    }
}

// 直接执行
if (require.main === module) {
    const backup = new AutoBackup();
    backup.run()
        .then(report => {
            console.log('✅ 自动备份执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 自动备份执行失败:', error);
            process.exit(1);
        });
}

module.exports = AutoBackup; 