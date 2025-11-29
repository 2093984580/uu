// 聊天室应用主逻辑
class ChatApp {
    constructor() {
        // DOM元素引用
        this.elements = {
            // 登录页面元素
            loginPage: document.getElementById('login-page'),
            chatPage: document.getElementById('chat-page'),
            nicknameInput: document.getElementById('nickname'),
            serverSelect: document.getElementById('server-select'),
            loginBtn: document.getElementById('login-btn'),
            loginError: document.getElementById('login-error'),
            
            // 聊天室页面元素
            currentUserName: document.getElementById('current-user-name'),
            currentUserAvatar: document.getElementById('current-user-avatar'),
            logoutBtn: document.getElementById('logout-btn'),
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            usersList: document.getElementById('users-list'),
            onlineCount: document.getElementById('online-count'),
            emojiBtn: document.getElementById('emoji-btn'),
            emojiPicker: document.getElementById('emoji-picker'),
            themeToggle: document.getElementById('theme-toggle')
        };
        
        // 应用状态
        this.state = {
            isConnected: false,
            isLoggedIn: false,
            currentUser: null,
            selectedServer: null,
            socket: null
        };
        
        // 初始化应用
        this.initialize();
    }
    
    // 初始化应用
    async initialize() {
        // 强制设置页面状态 - 确保登录页面显示，聊天室页面隐藏
        // 先移除所有可能的干扰类
        this.elements.loginPage.classList.remove('hidden');
        this.elements.loginPage.style.display = 'block';
        this.elements.loginPage.style.opacity = '1';
        
        // 确保聊天室页面完全隐藏
        this.elements.chatPage.classList.add('hidden');
        this.elements.chatPage.style.display = 'none';
        this.elements.chatPage.style.opacity = '0';
        
        // 加载配置
        await this.loadConfig();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 恢复用户偏好设置
        this.restoreUserPreferences();
        
        // 初始化表情选择器
        this.initEmojiPicker();
        
        console.log('应用初始化完成 - 登录页面已显示，聊天室页面已隐藏');
    }
    
    // 加载配置
    async loadConfig() {
        try {
            const servers = await AppConfig.loadServerConfig();
            this.populateServerSelect(servers);
        } catch (error) {
            console.error('初始化配置失败:', error);
        }
    }
    
    // 填充服务器选择下拉框
    populateServerSelect(servers) {
        const select = this.elements.serverSelect;
        select.innerHTML = '';
        
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.address;
            option.textContent = server.name;
            select.appendChild(option);
        });
        
        // 恢复上次选择的服务器
        const lastServer = AppConfig.storage.get(AppConfig.storageKeys.LAST_SERVER);
        if (lastServer && servers.some(s => s.address === lastServer)) {
            select.value = lastServer;
        }
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 登录按钮点击事件
        this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        
        // 回车登录
        this.elements.nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        // 登出按钮点击事件
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
        
        // 发送消息按钮点击事件
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // 回车发送消息
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 表情按钮点击事件
        this.elements.emojiBtn.addEventListener('click', () => {
            this.elements.emojiPicker.classList.toggle('hidden');
        });
        
        // 点击其他地方关闭表情选择器
        document.addEventListener('click', (e) => {
            if (!this.elements.emojiBtn.contains(e.target) && !this.elements.emojiPicker.contains(e.target)) {
                this.elements.emojiPicker.classList.add('hidden');
            }
        });
        
        // 主题切换按钮
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // 窗口关闭事件，尝试优雅断开连接
        window.addEventListener('beforeunload', () => {
            if (this.state.isLoggedIn) {
                this.handleLogout(true);
            }
        });
    }
    
    // 初始化表情选择器
    initEmojiPicker() {
        const picker = this.elements.emojiPicker;
        picker.innerHTML = '';
        
        AppConfig.emojis.forEach(emoji => {
            const emojiElement = document.createElement('div');
            emojiElement.className = 'emoji';
            emojiElement.textContent = emoji;
            emojiElement.addEventListener('click', () => {
                this.elements.messageInput.value += emoji;
                this.elements.messageInput.focus();
                picker.classList.add('hidden');
            });
            picker.appendChild(emojiElement);
        });
    }
    
    // 恢复用户偏好设置
    restoreUserPreferences() {
        // 恢复主题设置
        const savedTheme = AppConfig.storage.get(AppConfig.storageKeys.THEME, 'light');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            this.elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        // 恢复上次使用的昵称
        const lastNickname = AppConfig.storage.get(AppConfig.storageKeys.LAST_NICKNAME);
        if (lastNickname) {
            this.elements.nicknameInput.value = lastNickname;
        }
    }
    
    // 切换主题
    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        AppConfig.storage.set(AppConfig.storageKeys.THEME, isDark ? 'dark' : 'light');
        
        // 更新主题按钮图标
        this.elements.themeToggle.innerHTML = isDark 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    }
    
    // 处理登录
    handleLogin() {
        const nickname = this.elements.nicknameInput.value.trim();
        const serverAddress = this.elements.serverSelect.value;
        
        // 验证输入
        if (!nickname) {
            this.showLoginError('请输入昵称');
            return;
        }
        
        if (!serverAddress) {
            this.showLoginError('请选择服务器地址');
            return;
        }
        
        // 隐藏错误信息
        this.hideLoginError();
        
        // 保存用户偏好
        AppConfig.storage.set(AppConfig.storageKeys.LAST_NICKNAME, nickname);
        AppConfig.storage.set(AppConfig.storageKeys.LAST_SERVER, serverAddress);
        
        // 连接WebSocket服务器
        this.connectToServer(serverAddress, nickname);
    }
    
    // 连接到Socket.IO服务器
    connectToServer(serverAddress, nickname) {
        try {
            // 确保使用正确的服务器地址格式
            const url = serverAddress;
            
            // 初始化Socket.IO连接
            console.log('尝试连接到服务器:', url);
            this.state.socket = io(url, {
                transports: ['websocket', 'polling'],  // 支持轮询作为备用
                reconnectionAttempts: 3,
                reconnectionDelay: 1000,
                timeout: 20000  // 增加超时时间
            });
            
            // 设置Socket事件监听器
            this.setupSocketListeners();
            
            // 存储当前状态
            this.state.selectedServer = serverAddress;
            this.state.currentUser = {
                nickname: nickname,
                avatar: this.generateAvatarText(nickname)
            };
            
        } catch (error) {
            console.error('连接服务器失败:', error);
            this.showLoginError('连接服务器失败，请检查服务器地址和网络连接');
        }
    }
    
    // 设置Socket事件监听器
    setupSocketListeners() {
        const socket = this.state.socket;
        
        // 连接建立
        socket.on('connect', () => {
            console.log('WebSocket连接已建立');
            this.state.isConnected = true;
            
            // 发送登录请求
            socket.emit('login', {
                nickname: this.state.currentUser.nickname,
                server_address: this.state.selectedServer
            });
        });
        
        // 登录成功
        socket.on('login_success', (data) => {
            console.log('登录成功:', data);
            this.state.isLoggedIn = true;
            
            // 更新界面显示当前用户信息
            this.elements.currentUserName.textContent = this.state.currentUser.nickname;
            this.elements.currentUserAvatar.textContent = this.state.currentUser.avatar;
            
            // 确保聊天室页面只在登录成功后显示
            // 强制隐藏登录页面
            this.elements.loginPage.classList.add('hidden');
            this.elements.loginPage.style.display = 'none';
            this.elements.loginPage.style.opacity = '0';
            
            // 短暂延迟后强制显示聊天室页面
            setTimeout(() => {
                this.elements.chatPage.classList.remove('hidden');
                this.elements.chatPage.style.display = 'block';
                this.elements.chatPage.style.opacity = '1';
                // 聚焦到消息输入框
                this.elements.messageInput.focus();
                console.log('登录成功 - 聊天室页面已显示');
            }, 100);
        });
        
        // 登录错误
        socket.on('login_error', (data) => {
            console.error('登录失败:', data);
            this.showLoginError(data.message || '登录失败，请重试');
            this.disconnectFromServer();
        });
        
        // 新消息
        socket.on('new_message', (data) => {
            this.displayMessage(data);
        });
        
        // 用户加入
        socket.on('user_joined', (data) => {
            this.displaySystemMessage(data.message);
        });
        
        // 用户离开
        socket.on('user_left', (data) => {
            this.displaySystemMessage(data.message);
        });
        
        // 更新在线用户列表
        socket.on('update_users_list', (data) => {
            this.updateUsersList(data.users);
        });
        
        // 连接断开
        socket.on('disconnect', (reason) => {
            console.log('WebSocket连接已断开:', reason);
            this.state.isConnected = false;
            this.state.isLoggedIn = false;
            
            // 如果不是主动断开，显示错误信息
            if (!this.state.isDisconnecting) {
                this.showLoginError('与服务器的连接已断开，请重新登录');
                this.elements.chatPage.classList.add('hidden');
                this.elements.loginPage.classList.remove('hidden');
            }
            
            this.state.isDisconnecting = false;
        });
        
        // 连接错误
        socket.on('connect_error', (error) => {
            console.error('WebSocket连接错误:', error);
            this.showLoginError('无法连接到服务器，请检查服务器地址');
            this.disconnectFromServer();
        });
    }
    
    // 处理登出
    handleLogout(isBeforeUnload = false) {
        console.log('处理登出请求');
        // 无论何种情况，先强制重置状态
        this.state.isLoggedIn = false;
        this.state.isDisconnecting = true;
        
        if (this.state.socket) {
            // 发送登出请求
            this.state.socket.emit('logout');
            
            // 断开连接
            setTimeout(() => {
                this.disconnectFromServer();
                
                // 如果不是页面关闭，更新UI
                if (!isBeforeUnload) {
                    this.updateLogoutUI();
                }
            }, 500);
        } else {
            // 直接更新UI
            this.updateLogoutUI();
        }
    }
    
    // 更新登出后的UI状态
    updateLogoutUI() {
        console.log('更新登出UI - 显示登录页面，隐藏聊天室页面');
        // 强制隐藏聊天室页面
        this.elements.chatPage.classList.add('hidden');
        this.elements.chatPage.style.display = 'none';
        this.elements.chatPage.style.opacity = '0';
        
        // 强制显示登录页面
        this.elements.loginPage.classList.remove('hidden');
        this.elements.loginPage.style.display = 'block';
        this.elements.loginPage.style.opacity = '1';
        
        // 清空输入框和消息
        this.elements.messageInput.value = '';
        this.clearMessages();
    }
    
    // 断开与服务器的连接
    disconnectFromServer() {
        if (this.state.socket) {
            this.state.socket.disconnect();
            this.state.socket = null;
        }
        this.state.isConnected = false;
    }
    
    // 发送消息
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message || !this.state.isLoggedIn || !this.state.socket) {
            return;
        }
        
        // 直接发送原始消息，让服务器端处理命令解析
        this.state.socket.emit('send_message', {
            message: message
        });
        
        // 清空输入框
        this.elements.messageInput.value = '';
    }
    
    // 显示消息
    displayMessage(data) {
        const messagesContainer = this.elements.chatMessages;
        const isCurrentUser = data.sender === this.state.currentUser.nickname;
        
        // 创建消息元素
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${this.generateAvatarText(data.sender)}</div>
                <span class="message-user">${data.sender}</span>
                <span class="message-time">${this.formatTime(data.timestamp)}</span>
            </div>
            <div class="message-content ${data.type}">
                ${this.formatMessageContent(data.message, data.type, data.command_data)}
            </div>
        `;
        
        // 添加到消息容器
        messagesContainer.appendChild(messageElement);
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    // 显示系统消息
    displaySystemMessage(message) {
        const messagesContainer = this.elements.chatMessages;
        
        const systemMessageElement = document.createElement('div');
        systemMessageElement.className = 'system-message';
        systemMessageElement.innerHTML = `<p>${message}</p>`;
        
        messagesContainer.appendChild(systemMessageElement);
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    // 更新在线用户列表
    updateUsersList(users) {
        const usersList = this.elements.usersList;
        usersList.innerHTML = '';
        
        // 更新在线用户数量
        this.elements.onlineCount.textContent = `(${users.length})`;
        
        // 按字母顺序排序用户列表
        users.sort();
        
        users.forEach(nickname => {
            const isCurrentUser = nickname === this.state.currentUser.nickname;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="user-item">
                    <div class="user-item-avatar">${this.generateAvatarText(nickname)}</div>
                    <span class="user-item-name">${nickname} ${isCurrentUser ? '(你)' : ''}</span>
                    <span class="status-indicator online"></span>
                </div>
            `;
            
            usersList.appendChild(li);
        });
    }
    
    // 格式化消息内容
    formatMessageContent(message, type, command_data) {
        // 添加调试日志
        console.log('formatMessageContent调用:', { message, type, command_data });
        // 转义HTML特殊字符
        let formatted = this.escapeHtml(message);
        
        // 根据消息类型进行特殊处理
        switch (type) {
            case 'mention':
                // 高亮@用户名
                formatted = formatted.replace(/@(\w+)/g, '<span class="mention-highlight">@$1</span>');
                break;
            case 'movie':
                if (command_data && command_data.url) {
                    console.log('处理电影类型消息，URL:', command_data.url);
                    // 创建解析URL
                    const parserBaseUrl = 'https://jx.playerjy.com/?url=';
                    const parsedUrl = parserBaseUrl + encodeURIComponent(command_data.url);
                    
                    // 创建iframe，大小为400*400
                    const iframeHtml = `
                        <div class="movie-player">
                            <iframe 
                                src="${parsedUrl}" 
                                width="400" 
                                height="400" 
                                frameborder="0" 
                                allowfullscreen 
                                title="电影播放器"
                            ></iframe>
                        </div>
                    `;
                    
                    // 移除原始URL部分，只保留@电影命令和iframe
                    console.log('生成iframe HTML:', iframeHtml);
                    const messageWithoutUrl = message.replace(command_data.url, '').trim();
                    formatted = this.escapeHtml(messageWithoutUrl) + iframeHtml;
                }
                break;
            case 'ai':
                // AI消息可以添加特殊样式
                break;
        }
        
        // 对于普通文本消息，转换URL为可点击的链接
        if (type !== 'movie') {
            formatted = this.linkifyUrls(formatted);
        }
        
        return formatted;
    }
    
    // 将URL转换为可点击的链接
    linkifyUrls(text) {
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    
    // 转义HTML特殊字符
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    // 生成头像文本（取昵称的前两个字符）
    generateAvatarText(nickname) {
        return nickname.substring(0, 2).toUpperCase();
    }
    
    // 滚动到消息区域底部
    scrollToBottom() {
        const messagesContainer = this.elements.chatMessages;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // 清空消息区域
    clearMessages() {
        const messagesContainer = this.elements.chatMessages;
        // 保留欢迎消息
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage.cloneNode(true));
        }
    }
    
    // 显示登录错误
    showLoginError(message) {
        const errorElement = this.elements.loginError;
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    // 隐藏登录错误
    hideLoginError() {
        const errorElement = this.elements.loginError;
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

// 当页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化聊天应用
    window.chatApp = new ChatApp();
});