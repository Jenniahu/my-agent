"""
时间查询工具
"""
import json
from datetime import datetime, timezone, timedelta
from tools.base import BaseTool


class TimeTool(BaseTool):
    """时间查询工具"""
    
    @property
    def name(self):
        return 'get_current_time'
    
    @property
    def description(self):
        return '获取当前时间（北京时间）'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {},
            'required': []
        }
    
    def execute(self, args, owner):
        """执行时间查询"""
        # 获取当前 UTC 时间
        now_utc = datetime.now(timezone.utc)
        # 转换为北京时间 (UTC+8)
        beijing_tz = timezone(timedelta(hours=8))
        now_beijing = now_utc.astimezone(beijing_tz)
        
        return json.dumps({
            'time': now_beijing.strftime('%Y-%m-%d %H:%M:%S'),
            'timezone': 'Asia/Shanghai',
            'timestamp': int(now_beijing.timestamp()),
            'weekday': ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][now_beijing.weekday()]
        }, ensure_ascii=False)
