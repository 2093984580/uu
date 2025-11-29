// 应用配置模块
const AppConfig = {
    // 配置文件路径
    configFilePath: '../config/server_config.json',
    
    // 缓存的服务器列表
    serverList: [],
    
    // 加载服务器配置
    loadServerConfig: async function() {
        try {
            // 尝试从配置文件加载服务器列表
            const response = await fetch(this.configFilePath);
            if (response.ok) {
                const data = await response.json();
                this.serverList = data.servers || [];
                return this.serverList;
            } else {
                // 如果配置文件加载失败，使用默认服务器
                console.warn('配置文件加载失败，使用默认服务器');
                this.serverList = [
                    {
                        name: '默认服务器',
                        address: window.location.origin
                    }
                ];
                return this.serverList;
            }
        } catch (error) {
            console.error('加载配置文件出错:', error);
            // 使用默认服务器
            this.serverList = [
                {
                    name: '默认服务器',
                    address: window.location.origin
                }
            ];
            return this.serverList;
        }
    },
    
    // 获取服务器列表
    getServerList: function() {
        return this.serverList;
    },
    
    // 根据地址获取服务器信息
    getServerByAddress: function(address) {
        return this.serverList.find(server => server.address === address);
    },
    
    // WebSocket连接配置
    webSocket: {
        // Socket.IO自动处理WebSocket连接
        // 这里可以添加其他WebSocket相关配置
    },
    
    // 表情列表
    emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
        '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
        '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪',
        '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
        '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
        '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
        '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧',
        '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
        '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠',
        '🤬', '😈', '👿', '💩', '🤡', '👹', '👺', '💀',
        '👻', '👽', '🤖', '🎃', '😺', '😸', '😹', '😻',
        '😼', '😽', '🙀', '😿', '😾', '👍', '👎', '👌',
        '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
        '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛'
    ],
    
    // 应用状态存储键名
    storageKeys: {
        THEME: 'dapai_chat_theme',
        LAST_NICKNAME: 'dapai_chat_nickname',
        LAST_SERVER: 'dapai_chat_server'
    },
    
    // 本地存储操作函数
    storage: {
        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('存储数据失败:', error);
            }
        },
        
        get: function(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.error('读取数据失败:', error);
                return defaultValue;
            }
        },
        
        remove: function(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('删除数据失败:', error);
            }
        }
    }
};

// 导出配置对象
window.AppConfig = AppConfig;