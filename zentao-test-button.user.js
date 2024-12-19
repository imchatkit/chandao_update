// ==UserScript==
// @name         禅道测试按钮
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在禅道页面添加测试按钮
// @author       Your Name
// @match        *://*/index.php?*m=execution*
// @match        *://*/index.php?*m=project*
// @match        http://192.168.110.9:90/*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        #test-log-panel {
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 300px;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px;
            font-size: 12px;
            overflow-y: auto;
            z-index: 9999;
            display: block;
        }
        #test-btn {
            margin-left: 8px;
        }
    `);

    // 创建日志面板
    function createLogPanel() {
        const panel = document.createElement('div');
        panel.id = 'test-log-panel';
        document.body.appendChild(panel);
        return panel;
    }

    // 创建日志函数
    function log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log('[测试按钮]', logMessage);

        let panel = document.getElementById('test-log-panel');
        if (!panel) {
            panel = createLogPanel();
        }

        const logLine = document.createElement('div');
        logLine.textContent = logMessage;
        panel.appendChild(logLine);
        panel.scrollTop = panel.scrollHeight;
    }

    // 等待元素出现
    function waitForElement(selector, callback, maxAttempts = 50) {
        let attempts = 0;
        
        function check() {
            attempts++;
            const element = document.querySelector(selector);
            
            if (element) {
                log(`找到元素: ${selector}`);
                callback(element);
                return;
            }
            
            if (attempts < maxAttempts) {
                log(`等待元素 ${selector} (${attempts}/${maxAttempts})`);
                setTimeout(check, 200);
            } else {
                log(`未能找到元素 ${selector}`);
            }
        }
        
        check();
    }

    // 创建测试按钮
    function createTestButton() {
        log('尝试创建测试按钮');
        
        // 检查是否已存在按钮
        if (document.getElementById('test-btn')) {
            log('按钮已存在');
            return;
        }

        // 创建按钮
        const button = document.createElement('button');
        button.id = 'test-btn';
        button.className = 'btn btn-link toolbar-item';
        button.innerHTML = '<i class="icon icon-check"></i> Test按钮';
        
        // 添加点击事件
        button.onclick = function() {
            alert('测试按钮被点击了！');
        };

        return button;
    }

    // 尝试添加按钮到工具栏
    function tryAddButton() {
        log('开始查找工具栏位置');
        
        // 可能的工具栏选择器列表
        const toolbarSelectors = [
            '#mainContent .main-actions',
            '#mainContent .page-actions',
            '#mainContent .btn-toolbar',
            '#mainContent header .heading',
            '#mainContent .main-header .actions',
            '#toolbar .btn-toolbar'
        ];

        function addButtonToToolbar(toolbar) {
            const button = createTestButton();
            if (button) {
                toolbar.appendChild(button);
                log('按钮已添加到工具栏');
            }
        }

        // 遍历所有可能的工具栏位置
        for (const selector of toolbarSelectors) {
            waitForElement(selector, (toolbar) => {
                addButtonToToolbar(toolbar);
            });
        }
    }

    // 监听页面变化
    function setupMutationObserver() {
        log('设置页面监听');
        
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && 
                    (mutation.target.id === 'mainContent' || 
                     mutation.target.id === 'mainMenu')) {
                    log('检测到页面内容变化');
                    tryAddButton();
                }
            }
        });

        // 监听整个文档的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        log('页面监听已设置');
    }

    // 监听 AJAX 请求
    function setupAjaxListener() {
        log('设置 AJAX 监听');
        
        const originalXHR = unsafeWindow.XMLHttpRequest;
        unsafeWindow.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            
            xhr.open = function() {
                this._url = arguments[1];
                return originalOpen.apply(this, arguments);
            };
            
            xhr.send = function() {
                log(`发起AJAX请求: ${this._url}`);
                
                xhr.addEventListener('readystatechange', function() {
                    if (xhr.readyState === 4) {
                        log(`AJAX请求完成: ${this._url}`);
                        setTimeout(tryAddButton, 500);
                    }
                });
                
                return originalSend.apply(this, arguments);
            };
            
            return xhr;
        };
    }

    // 主函数
    function main() {
        log('脚本开始执行');
        
        // 设置监听器
        setupAjaxListener();
        setupMutationObserver();
        
        // 监听页面导航
        window.addEventListener('popstate', () => {
            log('检测到页面导航');
            setTimeout(tryAddButton, 500);
        });
        
        // 初始尝试添加按钮
        setTimeout(tryAddButton, 1000);
        
        // 页面加载完成后再次尝试
        window.addEventListener('load', () => {
            log('页面加载完成');
            tryAddButton();
        });
    }

    // 启动脚本
    main();
})();