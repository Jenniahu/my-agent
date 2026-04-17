"""
AI 服务类 - 处理 OpenAI 调用和工具集成
"""
import requests
import json
from config import Config
from services.tool_service import ToolService
from models import RequirementConfig


class AIService:
    """AI 服务类"""
    
    def __init__(self):
        self.api_key = Config.OPENAI_API_KEY
        self.base_url = Config.OPENAI_BASE_URL
        self.model = Config.OPENAI_MODEL
        self.tool_service = ToolService()
        
        print(f"\n🤖 AI 服务初始化")
        print(f"📡 API 地址: {self.base_url}")
        print(f"🔧 模型: {self.model}")
        print(f"🛠️  已加载工具: {', '.join(self.tool_service.list_tools())}\n")
    
    def chat(self, owner, messages, new_message):
        """
        处理对话，支持工具调用
        
        Args:
            owner: Owner 对象
            messages: 历史消息列表 (Message 对象)
            new_message: 新消息内容 (字符串)
        
        Returns:
            str: AI 回复内容
        """
        # 构建 OpenAI 消息格式
        openai_messages = self._build_messages(owner, messages, new_message)
        
        # 获取所有可用工具
        tools = self.tool_service.get_all_tools()
        
        print(f"\n[AI] 开始处理消息: {new_message[:50]}...")
        print(f"[AI] 上下文消息数: {len(openai_messages)}")
        print(f"[AI] 可用工具数: {len(tools)}")
        
        # 第一次调用 OpenAI
        response = self._call_openai(openai_messages, tools)
        
        # 检查是否需要调用工具
        if 'tool_calls' in response and response['tool_calls']:
            print(f"[AI] 检测到工具调用: {len(response['tool_calls'])} 个")
            
            tool_messages = []
            
            # 执行所有工具调用
            for tool_call in response['tool_calls']:
                tool_name = tool_call['function']['name']
                tool_args_str = tool_call['function']['arguments']
                
                try:
                    tool_args = json.loads(tool_args_str)
                except json.JSONDecodeError:
                    tool_args = {}
                
                print(f"[AI] 执行工具: {tool_name}({tool_args})")
                
                # 执行工具
                tool_result = self.tool_service.execute_tool(
                    tool_name, 
                    tool_args, 
                    owner
                )
                
                print(f"[AI] 工具结果: {tool_result[:100]}...")
                
                # 添加工具消息
                tool_messages.append({
                    'role': 'tool',
                    'tool_call_id': tool_call['id'],
                    'name': tool_name,
                    'content': tool_result
                })
            
            # 构建包含工具调用的消息
            assistant_message = {
                'role': 'assistant',
                'content': response.get('content'),
                'tool_calls': response['tool_calls']
            }
            
            # 第二次调用 OpenAI（附带工具结果）
            final_messages = openai_messages + [assistant_message] + tool_messages
            
            print(f"[AI] 第二次调用 OpenAI（附带工具结果）")
            final_response = self._call_openai(final_messages, tools=None)
            
            final_content = final_response.get('content', '抱歉，我遇到了一些问题')
            print(f"[AI] 最终回复: {final_content[:100]}...")
            
            return final_content
        
        # 无需工具调用，直接返回
        content = response.get('content', '你好！有什么可以帮你的吗？')
        print(f"[AI] 直接回复（无工具调用）: {content[:100]}...")
        
        return content
    
    def _build_messages(self, owner, history, new_message):
        """构建 OpenAI 消息格式"""
        # 构建基础系统提示词
        system_content = owner.ai_persona or f'你是 {owner.name} 的 AI 分身，友好、专业地回答访客的问题。'
        
        # 检查并注入需求收集策略
        strategy_prompt = self._get_requirement_strategy(owner.id)
        if strategy_prompt:
            system_content += f"\n\n{strategy_prompt}"
        
        messages = [
            {
                'role': 'system',
                'content': system_content
            }
        ]
        
        # 添加历史消息（保留最近 40 条）
        for msg in history[-40:]:  # 只取最近 40 条
            role = 'user' if msg.role == 'visitor' else 'assistant' if msg.role == 'ai' else 'assistant'
            messages.append({
                'role': role,
                'content': msg.content
            })
        
        # 添加新消息
        messages.append({
            'role': 'user',
            'content': new_message
        })
        
        return messages
    
    def _get_requirement_strategy(self, owner_id: str) -> str:
        """
        获取需求收集策略提示词
        
        Args:
            owner_id: 主人ID
        
        Returns:
            str: 策略提示词，如果未启用则返回空字符串
        """
        try:
            config = RequirementConfig.query.get(owner_id)
            
            # 如果配置不存在，创建默认配置（禁用状态）
            if not config:
                return ''
            
            # 如果未启用，返回空字符串
            if not config.enabled:
                return ''
            
            # 返回策略提示词
            return config.strategy_prompt or ''
        
        except Exception as e:
            print(f"[AI] 获取需求策略时出错: {str(e)}")
            return ''
    
    def _call_openai(self, messages, tools=None):
        """
        调用 OpenAI API
        
        Args:
            messages: 消息列表
            tools: 工具列表（可选）
        
        Returns:
            dict: OpenAI 响应（统一格式）
        """
        url = f"{self.base_url}/v1/chat/completions"
        
        payload = {
            'model': self.model,
            'messages': messages,
            'max_tokens': 1500,
            'temperature': 0.7
        }
        
        # 如果有工具，添加到请求中
        if tools:
            payload['tools'] = tools
            payload['tool_choice'] = 'auto'
        
        try:
            response = requests.post(
                url,
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                },
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                message = data['choices'][0]['message']
                
                # 返回统一格式
                result = {'content': message.get('content')}
                if message.get('tool_calls'):
                    result['tool_calls'] = message['tool_calls']
                
                return result
            else:
                print(f"❌ OpenAI API Error: {response.status_code} {response.text}")
                return {'content': '抱歉，AI 服务暂时不可用'}
        
        except requests.Timeout:
            print(f"❌ OpenAI API Timeout")
            return {'content': '抱歉，AI 服务响应超时'}
        
        except Exception as e:
            print(f"❌ OpenAI API Exception: {str(e)}")
            return {'content': '抱歉，AI 服务出现错误'}
