"""
代码执行/计算器工具 - 数据分析和计算
"""
import json
import math
import re
from tools.base import BaseTool


class CalculatorTool(BaseTool):
    """
    计算器工具 - 执行数学计算和简单数据分析
    
    触发场景：
    - 用户需要进行数学计算
    - 用户询问统计数据、百分比、增长率等
    - 用户需要单位换算
    """
    
    @property
    def name(self):
        return 'calculate'
    
    @property
    def description(self):
        return (
            '当用户需要数学计算、数据分析、单位换算时使用此工具。'
            '例如："计算 15% 的 2000 是多少"、"3的平方根"、"100华氏度等于多少摄氏度"'
        )
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'expression': {
                    'type': 'string',
                    'description': '数学表达式，支持 + - * / ^ sqrt log 等运算。例如："15% * 2000", "sqrt(16)", "(100 + 200) * 3"'
                }
            },
            'required': ['expression']
        }
    
    def execute(self, args, owner):
        """执行计算"""
        expression = args.get('expression', '')
        
        try:
            result = self._safe_eval(expression)
            return json.dumps({
                'expression': expression,
                'result': result,
                'formatted': f'{expression} = {result}',
                'success': True
            }, ensure_ascii=False)
        except Exception as e:
            return json.dumps({
                'expression': expression,
                'error': True,
                'message': f'计算错误: {str(e)}',
                'success': False
            }, ensure_ascii=False)
    
    def _safe_eval(self, expr):
        """安全计算表达式 - 只允许数学运算"""
        # 清理表达式
        expr = expr.lower().strip()
        
        # 替换常见表达式
        replacements = {
            '^': '**',
            '×': '*',
            '÷': '/',
            '的': '*',
            '百分之': '*0.01*',
            '%': '*0.01'
        }
        
        for old, new in replacements.items():
            expr = expr.replace(old, new)
        
        # 处理中文数字和单位换算
        expr = self._parse_chinese_numbers(expr)
        
        # 定义允许的函数和常量
        safe_dict = {
            'sqrt': math.sqrt,
            'pow': math.pow,
            'abs': abs,
            'round': round,
            'max': max,
            'min': min,
            'sum': sum,
            'len': len,
            'pi': math.pi,
            'e': math.e,
            'sin': math.sin,
            'cos': math.cos,
            'tan': math.tan,
            'log': math.log,
            'log10': math.log10,
            'ceil': math.ceil,
            'floor': math.floor
        }
        
        # 只允许数字、运算符、括号和允许的函数名
        allowed_pattern = r'^[\d\+\-\*\/\(\)\.\,\s\w]+$'
        if not re.match(allowed_pattern, expr):
            raise ValueError('表达式包含非法字符')
        
        # 安全执行
        result = eval(expr, {'__builtins__': {}}, safe_dict)
        return result
    
    def _parse_chinese_numbers(self, expr):
        """解析中文数字"""
        chinese_nums = {
            '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
            '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
            '百': '100', '千': '1000', '万': '10000', '亿': '100000000'
        }
        
        for cn, num in chinese_nums.items():
            expr = expr.replace(cn, num)
        
        return expr
