// DOM 元素
const searchInput = document.getElementById('searchInput');
let categories = [];
let linkCards = [];
const main = document.querySelector('.main');
const categoriesContainer = document.querySelector('.categories');

// 搜索功能
function performSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    let hasResults = false;
    
    // 清除之前的高亮
    clearHighlights();
    
    if (searchTerm === '') {
        // 如果搜索为空，显示所有内容
        showAllContent();
        removeNoResultsMessage();
        return;
    }
    
    categories.forEach(category => {
        let categoryHasVisibleCards = false;
        const categoryCards = category.querySelectorAll('.link-card');
        
        categoryCards.forEach(card => {
            const title = card.querySelector('h4').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            const categoryName = category.querySelector('h3').textContent.toLowerCase();
            
            const isMatch = title.includes(searchTerm) || 
                          description.includes(searchTerm) || 
                          categoryName.includes(searchTerm);
            
            if (isMatch) {
                card.classList.remove('hidden');
                categoryHasVisibleCards = true;
                hasResults = true;
                
                // 高亮匹配的文本
                highlightText(card, searchTerm);
            } else {
                card.classList.add('hidden');
            }
        });
        
        // 根据是否有可见卡片来显示/隐藏分类
        if (categoryHasVisibleCards) {
            category.classList.remove('hidden');
        } else {
            category.classList.add('hidden');
        }
    });
    
    // 处理无结果情况
    if (!hasResults) {
        showNoResultsMessage();
    } else {
        removeNoResultsMessage();
    }
}

// 显示所有内容
function showAllContent() {
    categories.forEach(category => {
        category.classList.remove('hidden');
        const categoryCards = category.querySelectorAll('.link-card');
        categoryCards.forEach(card => {
            card.classList.remove('hidden');
        });
    });
}

// 清除高亮
function clearHighlights() {
    document.querySelectorAll('.highlight').forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
    });
}

// 高亮匹配文本
function highlightText(element, searchTerm) {
    const textElements = element.querySelectorAll('h4, p');
    
    textElements.forEach(textElement => {
        const text = textElement.textContent;
        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        
        if (regex.test(text)) {
            const highlightedText = text.replace(regex, '<span class="highlight">$1</span>');
            textElement.innerHTML = highlightedText;
        }
    });
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 显示无结果消息
function showNoResultsMessage() {
    removeNoResultsMessage(); // 先移除已存在的消息
    
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'no-results';
    noResultsDiv.innerHTML = `
        <p>🔍 没有找到相关结果</p>
        <p>试试搜索其他关键词，比如 "机器人"、"客户端" 或 "频道"</p>
    `;
    
    main.appendChild(noResultsDiv);
}

// 移除无结果消息
function removeNoResultsMessage() {
    const existingMessage = document.querySelector('.no-results');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 搜索输入事件监听器
const debouncedSearch = debounce((e) => {
    performSearch(e.target.value);
}, 300);

searchInput.addEventListener('input', debouncedSearch);

// 搜索框焦点效果
searchInput.addEventListener('focus', () => {
    searchInput.parentElement.style.transform = 'scale(1.02)';
});

searchInput.addEventListener('blur', () => {
    searchInput.parentElement.style.transform = 'scale(1)';
});

// 键盘快捷键 - Ctrl/Cmd + K 快速聚焦到搜索框
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    
    // ESC 键清空搜索
    if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        performSearch('');
        searchInput.blur();
    }
});

// 链接卡片点击统计（可选）
linkCards.forEach(card => {
    card.addEventListener('click', (e) => {
        const title = card.querySelector('h4').textContent;
        console.log(`点击了链接: ${title}`);
        
        // 可以在这里添加统计代码或其他分析
        // 例如：analytics.track('link_click', { title: title });
    });
});

// 平滑滚动到顶部功能
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 添加回到顶部按钮
function createBackToTopButton() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '↑';
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(102, 126, 234, 0.9);
        color: white;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    `;
    
    backToTopBtn.addEventListener('click', scrollToTop);
    document.body.appendChild(backToTopBtn);
    
    // 滚动时显示/隐藏按钮
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.visibility = 'visible';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.visibility = 'hidden';
        }
    });
}

// 生成页面内容
function generatePageContent() {
    if (typeof telegramResources === 'undefined') {
        console.error('资源数据未加载');
        return;
    }
    
    categoriesContainer.innerHTML = '';
    
    Object.keys(telegramResources).forEach(categoryKey => {
        const categoryData = telegramResources[categoryKey];
        
        // 创建分类容器
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.setAttribute('data-category', categoryKey);
        
        // 创建分类标题
        const headerDiv = document.createElement('div');
        headerDiv.className = 'category-header';
        
        const iconSvg = document.createElement('svg');
        iconSvg.className = 'category-icon';
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.innerHTML = `<path fill="currentColor" d="${categoryData.icon}"/>`;
        
        const titleH3 = document.createElement('h3');
        titleH3.textContent = categoryData.title;
        
        headerDiv.appendChild(iconSvg);
        headerDiv.appendChild(titleH3);
        
        // 创建链接网格
        const linksGrid = document.createElement('div');
        linksGrid.className = 'links-grid';
        
        categoryData.items.forEach(item => {
            const linkCard = document.createElement('a');
            linkCard.className = 'link-card';
            linkCard.href = item.url;
            linkCard.target = '_blank';
            
            const iconDiv = document.createElement('div');
            iconDiv.className = 'link-icon';
            iconDiv.textContent = item.icon;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'link-content';
            
            const titleH4 = document.createElement('h4');
            titleH4.textContent = item.title;
            
            const descP = document.createElement('p');
            descP.textContent = item.desc;
            
            contentDiv.appendChild(titleH4);
            contentDiv.appendChild(descP);
            
            linkCard.appendChild(iconDiv);
            linkCard.appendChild(contentDiv);
            
            linksGrid.appendChild(linkCard);
        });
        
        categoryDiv.appendChild(headerDiv);
        categoryDiv.appendChild(linksGrid);
        
        categoriesContainer.appendChild(categoryDiv);
    });
    
    // 更新DOM引用
    categories = document.querySelectorAll('.category');
    linkCards = document.querySelectorAll('.link-card');
    
    // 为新的链接卡片添加点击事件监听器
    linkCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const title = card.querySelector('h4').textContent;
            console.log(`点击了链接: ${title}`);
        });
    });
    
    console.log(`✅ 已加载 ${categories.length} 个分类，共 ${linkCards.length} 个资源`);
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 生成页面内容
    generatePageContent();
    
    // 创建回到顶部按钮
    createBackToTopButton();
    
    // 为搜索框添加占位符提示
    const searchTips = [
        '搜索 Telegram 资源...',
        '试试搜索 "机器人"',
        '查找 "客户端"',
        '寻找 "频道"',
        '搜索 "工具"'
    ];
    
    let tipIndex = 0;
    setInterval(() => {
        if (document.activeElement !== searchInput) {
            searchInput.placeholder = searchTips[tipIndex];
            tipIndex = (tipIndex + 1) % searchTips.length;
        }
    }, 3000);
    
    // 添加页面加载动画
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
    
    console.log('🚀 Telegram 导航站已加载完成！');
    console.log('💡 提示：按 Ctrl/Cmd + K 快速搜索，按 ESC 清空搜索');
});

// 添加服务工作器支持（PWA 功能，可选）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 这里可以注册 Service Worker 来支持离线访问
        // navigator.serviceWorker.register('/sw.js');
    });
}

// 错误处理
window.addEventListener('error', (e) => {
    console.error('页面发生错误:', e.error);
});

// 导出函数供其他脚本使用
window.TelegramNav = {
    search: performSearch,
    clearSearch: () => {
        searchInput.value = '';
        performSearch('');
    },
    scrollToTop: scrollToTop
}; 