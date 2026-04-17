"""
待办事项/日历工具 - 任务管理
"""
import json
from datetime import datetime, timedelta
from tools.base import BaseTool


class TodoTool(BaseTool):
    """
    待办事项管理工具 - 记录和管理任务
    
    触发场景：
    - 用户要求记录待办事项
    - 用户询问待办列表
    - 用户需要设置提醒
    
    注意：此工具需要数据库支持，当前使用内存存储，后续可接入真实数据库
    """
    
    # 内存存储（实际项目中应该使用数据库）
    _todos = {}
    
    @property
    def name(self):
        return 'manage_todo'
    
    @property
    def description(self):
        return (
            '当用户需要记录待办事项、查看任务列表、标记任务完成时使用此工具。'
            '例如："帮我记录待办：明天下午3点开会"、"查看我的待办事项"、"完成任务1"'
        )
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'action': {
                    'type': 'string',
                    'enum': ['add', 'list', 'complete', 'delete'],
                    'description': '操作类型：add(添加)、list(列表)、complete(完成)、delete(删除)'
                },
                'content': {
                    'type': 'string',
                    'description': '待办事项内容（add操作时需要）'
                },
                'todo_id': {
                    'type': 'string',
                    'description': '待办事项ID（complete或delete操作时需要）'
                },
                'due_date': {
                    'type': 'string',
                    'description': '截止日期，格式：YYYY-MM-DD 或 "明天"、"下周一"等相对时间'
                }
            },
            'required': ['action']
        }
    
    def execute(self, args, owner):
        """执行待办管理"""
        action = args.get('action')
        owner_id = owner.id if owner else 'default'
        
        # 初始化用户的待办列表
        if owner_id not in self._todos:
            self._todos[owner_id] = []
        
        if action == 'add':
            return self._add_todo(owner_id, args)
        elif action == 'list':
            return self._list_todos(owner_id)
        elif action == 'complete':
            return self._complete_todo(owner_id, args)
        elif action == 'delete':
            return self._delete_todo(owner_id, args)
        else:
            return json.dumps({
                'error': True,
                'message': f'未知操作: {action}'
            }, ensure_ascii=False)
    
    def _add_todo(self, owner_id, args):
        """添加待办事项"""
        content = args.get('content', '')
        due_date_str = args.get('due_date', '')
        
        if not content:
            return json.dumps({
                'error': True,
                'message': '待办事项内容不能为空'
            }, ensure_ascii=False)
        
        # 解析日期
        due_date = self._parse_date(due_date_str)
        
        todo = {
            'id': f'todo_{len(self._todos[owner_id]) + 1}',
            'content': content,
            'due_date': due_date,
            'created_at': datetime.now().isoformat(),
            'completed': False
        }
        
        self._todos[owner_id].append(todo)
        
        return json.dumps({
            'success': True,
            'action': 'add',
            'todo': todo,
            'message': f'已添加待办事项: {content}'
        }, ensure_ascii=False)
    
    def _list_todos(self, owner_id):
        """列出待办事项"""
        todos = self._todos[owner_id]
        
        # 分离已完成和未完成
        pending = [t for t in todos if not t['completed']]
        completed = [t for t in todos if t['completed']]
        
        return json.dumps({
            'success': True,
            'action': 'list',
            'pending': pending,
            'completed': completed,
            'total': len(todos),
            'pending_count': len(pending),
            'message': f'共有 {len(pending)} 个待办事项，{len(completed)} 个已完成'
        }, ensure_ascii=False)
    
    def _complete_todo(self, owner_id, args):
        """标记待办完成"""
        todo_id = args.get('todo_id', '')
        
        for todo in self._todos[owner_id]:
            if todo['id'] == todo_id:
                todo['completed'] = True
                todo['completed_at'] = datetime.now().isoformat()
                return json.dumps({
                    'success': True,
                    'action': 'complete',
                    'todo': todo,
                    'message': f'已完成: {todo["content"]}'
                }, ensure_ascii=False)
        
        return json.dumps({
            'error': True,
            'message': f'未找到待办事项: {todo_id}'
        }, ensure_ascii=False)
    
    def _delete_todo(self, owner_id, args):
        """删除待办事项"""
        todo_id = args.get('todo_id', '')
        
        for i, todo in enumerate(self._todos[owner_id]):
            if todo['id'] == todo_id:
                deleted = self._todos[owner_id].pop(i)
                return json.dumps({
                    'success': True,
                    'action': 'delete',
                    'deleted': deleted,
                    'message': f'已删除: {deleted["content"]}'
                }, ensure_ascii=False)
        
        return json.dumps({
            'error': True,
            'message': f'未找到待办事项: {todo_id}'
        }, ensure_ascii=False)
    
    def _parse_date(self, date_str):
        """解析日期字符串"""
        if not date_str:
            return None
        
        today = datetime.now()
        
        # 处理相对时间
        if date_str == '今天':
            return today.strftime('%Y-%m-%d')
        elif date_str == '明天':
            return (today + timedelta(days=1)).strftime('%Y-%m-%d')
        elif date_str == '后天':
            return (today + timedelta(days=2)).strftime('%Y-%m-%d')
        elif date_str == '下周':
            return (today + timedelta(days=7)).strftime('%Y-%m-%d')
        
        # 尝试解析标准格式
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return date_str
        except ValueError:
            pass
        
        return None

