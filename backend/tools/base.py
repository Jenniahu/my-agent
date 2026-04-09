"""
工具基类
"""
import json
from abc import ABC, abstractmethod


class BaseTool(ABC):
    """工具基类，所有工具必须继承此类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称（必须实现）"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述（必须实现）"""
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> dict:
        """工具参数（JSON Schema 格式，必须实现）"""
        pass
    
    @abstractmethod
    def execute(self, args: dict, owner) -> str:
        """
        执行工具（必须实现）
        
        Args:
            args: 工具参数
            owner: Owner 对象
        
        Returns:
            str: JSON 字符串格式的结果
        """
        pass
    
    def to_openai_format(self) -> dict:
        """转换为 OpenAI Function Calling 格式"""
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters
            }
        }
