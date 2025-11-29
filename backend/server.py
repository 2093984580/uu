# 首先导入并应用eventlet猴子补丁，必须在导入其他模块之前
import eventlet
eventlet.monkey_patch()

# 然后导入其他模块
from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
import uuid
from datetime import datetime

# 创建Flask应用实例
app = Flask(__name__, static_folder='../frontend', static_url_path='/')
app.config['SECRET_KEY'] = 'secret!'

# 初始化SocketIO
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# 存储连接的用户信息
connected_users = {}
# 存储已登录的昵称，用于验证唯一性
active_nicknames = set()

# 根路由，提供index.html
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

# 提供静态文件
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('../frontend', path)

# 处理WebSocket连接事件
@socketio.on('connect')
def handle_connect():
    # 为每个连接生成唯一ID
    client_id = str(uuid.uuid4())[:8]
    connected_users[request.sid] = {'client_id': client_id, 'nickname': None, 'is_logged_in': False}
    emit('connection_established', {'client_id': client_id})
    print(f"客户端连接: {client_id}")

# 处理用户登录事件
@socketio.on('login')
def handle_login(data):
    nickname = data.get('nickname')
    server_address = data.get('server_address')
    
    # 检查昵称是否已被使用
    if nickname in active_nicknames:
        emit('login_error', {'message': '该昵称已被使用，请选择其他昵称'})
        return
    
    # 更新用户信息
    user_info = connected_users.get(request.sid)
    if user_info:
        user_info['nickname'] = nickname
        user_info['server_address'] = server_address
        user_info['is_logged_in'] = True
        active_nicknames.add(nickname)
        
        # 加入聊天室
        join_room('main_chat_room')
        
        # 通知当前用户登录成功
        emit('login_success', {'nickname': nickname})
        
        # 广播用户加入消息
        emit('user_joined', {
            'nickname': nickname,
            'message': f'{nickname} 加入了聊天室'
        }, room='main_chat_room')
        
        # 更新所有用户的在线列表
        update_online_users_list()
        
        print(f"用户 {nickname} 登录成功")

# 处理用户登出事件
@socketio.on('logout')
def handle_logout():
    user_info = connected_users.get(request.sid)
    if user_info and user_info['is_logged_in']:
        nickname = user_info['nickname']
        
        # 从活跃昵称集合中移除
        active_nicknames.discard(nickname)
        
        # 离开聊天室
        leave_room('main_chat_room')
        
        # 广播用户离开消息
        emit('user_left', {
            'nickname': nickname,
            'message': f'{nickname} 离开了聊天室'
        }, room='main_chat_room')
        
        # 更新用户信息
        user_info['is_logged_in'] = False
        user_info['nickname'] = None
        
        # 更新所有用户的在线列表
        update_online_users_list()
        
        print(f"用户 {nickname} 登出")

# 处理发送消息事件
@socketio.on('send_message')
def handle_message(data):
    user_info = connected_users.get(request.sid)
    if user_info and user_info['is_logged_in']:
        message = data.get('message', '')
        message_type = data.get('type', 'text')
        
        # 检查@命令
        processed_message = process_message(message, user_info['nickname'])
        
        # 构造消息对象
        chat_message = {
            'sender': user_info['nickname'],
            'message': processed_message['content'],
            'type': processed_message.get('type', message_type),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'command_data': processed_message.get('command_data')
        }
        
        # 广播消息到聊天室
        emit('new_message', chat_message, room='main_chat_room')
        
        print(f"消息从 {user_info['nickname']}: {message}")

# 处理WebSocket断开连接事件
@socketio.on('disconnect')
def handle_disconnect():
    user_info = connected_users.pop(request.sid, None)
    if user_info and user_info['is_logged_in']:
        nickname = user_info['nickname']
        active_nicknames.discard(nickname)
        
        # 广播用户离开消息
        emit('user_left', {
            'nickname': nickname,
            'message': f'{nickname} 离开了聊天室'
        }, room='main_chat_room')
        
        # 更新所有用户的在线列表
        update_online_users_list()
        
        print(f"用户 {nickname} 断开连接")
    elif user_info:
        print(f"未登录客户端断开连接: {user_info['client_id']}")

# 处理消息中的@命令
def process_message(message, sender_nickname):
    print(f"处理消息: '{message}' 来自 {sender_nickname}")
    result = {'content': message, 'type': 'text'}
    
    # 检查是否是@命令
    if message.startswith('@'):
        # 首先检查是否是@电影命令，并且命令和URL之间没有空格
        if message.lower().startswith('@电影'):
            print("检测到@电影命令")
            # 提取URL部分（去掉@电影前缀）
            url = message[3:].strip()
            if url:
                content = url
                print(f"@电影命令包含URL: '{content}'")
                result = {
                    'content': f'[电影链接] {content}',
                    'type': 'movie',
                    'command_data': {'url': content}
                }
                print(f"@电影命令处理成功: {result}")
                return result
            else:
                print("@电影命令缺少URL参数")
                result['content'] = "@电影命令需要提供电影URL，请使用格式: @电影 电影链接"
                result['type'] = 'text'
                return result
        
        # 处理其他@命令
        parts = message.split(' ', 1)
        print(f"命令解析: parts={parts}")
        
        # 处理其他@命令（如@川小农）
        if len(parts) >= 2:
            command = parts[0].lower()
            content = parts[1]
            print(f"命令: {command}, 内容: '{content}'")
            
            # 处理@川小农命令
            if command == '@川小农' and content.strip():
                result = {
                    'content': f'[AI对话] {content}',
                    'type': 'ai',
                    'command_data': {'question': content}
                }
            
            # 处理@其他用户命令
            elif content.strip():
                result['content'] = message
                result['type'] = 'mention'
    
    print(f"消息处理结果: {result}")
    return result

# 更新在线用户列表
def update_online_users_list():
    online_users = list(active_nicknames)
    emit('update_users_list', {'users': online_users}, room='main_chat_room')

# 主函数，启动服务器
if __name__ == '__main__':
    # 获取本机IP地址
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except:
        local_ip = '127.0.0.1'
    
    print(f"服务器启动在 http://{local_ip}:5000")
    print(f"WebSocket服务可用在 http://{local_ip}:5000/socket.io/")
    
    # 启动SocketIO服务器
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
