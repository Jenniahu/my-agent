"""
工具服务类 - 自动加载和管理工具
"""
import importlib
import os
import json
from pathlib import Path


class ToolService:
    """工具服务类"""
    
    def __init__(self):
        self.tools = {}
        self._load_tools()
    
    def _load_tools(self):
        """自动加载 tools/ 目录下的所有工具"""
        tools_dir = Path(__file__).parent.parent / 'tools'
        
        # 遍历所有 *_tool.py 文件
        for file in tools_dir.glob('*_tool.py'):
            module_name = file.stem  # 如 'time_tool'
            
            try:
                # 动态导入模块
                module = importlib.import_module(f'tools.{module_name}')
                
                # 获取工具类（约定：类名为 XxxTool）
                # 例如：time_tool.py → TimeTool
                class_name = ''.join(word.capitalize() for word in module_name.split('_'))
                tool_class = getattr(module, class_name, None)
                
                if tool_class is None:
                    print(f"⚠️  警告：{module_name}.py 中未找到 {class_name} 类")
                    continue
                
                # 实例化工具
                tool_instance = tool_class()
                self.tools[tool_instance.name] = tool_instance
                
                print(f"✅ 加载工具: {tool_instance.name}")
            
            except Exception as e:
                print(f"❌ 加载工具 {module_name} 失败: {str(e)}")
    
    def get_all_tools(self):
        """获取所有工具的定义（OpenAI 格式）"""
        return [tool.to_openai_format() for tool in self.tools.values()]
    
    def execute_tool(self, tool_name, args, owner):
        """
        执行指定工具
        
        Args:
            tool_name: 工具名称
            args: 工具参数
            owner: Owner 对象
        
        Returns:
            str: JSON 字符串格式的结果
        """
        if tool_name not in self.tools:
            return json.dumps({
                'error': True,
                'message': f'Unknown tool: {tool_name}'
            }, ensure_ascii=False)
        
        try:
            tool = self.tools[tool_name]
            return tool.execute(args, owner)
        except Exception as e:
            return json.dumps({
                'error': True,
                'message': f'Tool execution failed: {str(e)}'
            }, ensure_ascii=False)
    
    def list_tools(self):
        """列出所有已加载的工具"""
        return list(self.tools.keys())
