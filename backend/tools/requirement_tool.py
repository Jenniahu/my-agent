"""
需求收集工具
"""
import json
import uuid
import requests
from datetime import datetime
from .base import BaseTool
from models import db, Requirement, RequirementConfig
from config import Config


class RequirementTool(BaseTool):
    """需求收集工具"""
    
    @property
    def name(self) -> str:
        return "save_requirement"
    
    @property
    def description(self) -> str:
        return """保存访客提出的功能需求或改进建议。
当访客提到想要某个功能、提出改进建议或反馈问题时，使用此工具记录需求。
需要收集：功能描述、使用场景、优先级。"""
    
    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "feature_desc": {
                    "type": "string",
                    "description": "功能描述，具体描述访客想要的功能是什么"
                },
                "use_case": {
                    "type": "string",
                    "description": "使用场景，说明这个功能会在什么情况下使用，解决什么问题"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "优先级，high=高优先级, medium=中等优先级, low=低优先级"
                },
                "session_id": {
                    "type": "string",
                    "description": "当前会话ID"
                },
                "message_id": {
                    "type": "string",
                    "description": "触发此需求的消息ID"
                }
            },
            "required": ["feature_desc", "session_id", "message_id"]
        }
    
    def execute(self, args: dict, owner) -> str:
        """
        执行需求保存
        
        Args:
            args: 工具参数
            owner: Owner 对象
        
        Returns:
            str: JSON 字符串格式的结果
        """
        try:
            # 验证必要参数
            feature_desc = args.get('feature_desc', '').strip()
            session_id = args.get('session_id', '').strip()
            message_id = args.get('message_id', '').strip()
            
            if not feature_desc:
                return json.dumps({
                    'success': False,
                    'error': '功能描述不能为空'
                })
            
            if not session_id or not message_id:
                return json.dumps({
                    'success': False,
                    'error': '会话ID和消息ID不能为空'
                })
            
            use_case = args.get('use_case', '').strip()
            priority = args.get('priority', 'medium')
            
            # 验证优先级
            if priority not in ['low', 'medium', 'high']:
                priority = 'medium'
            
            # 相似需求检测 - 使用 LLM 语义去重
            is_duplicate, existing_id = self._check_duplicate_with_llm(
                owner.id, feature_desc
            )
            existing_requirement = None
            if is_duplicate and existing_id:
                existing_requirement = Requirement.query.filter_by(
                    id=existing_id, owner_id=owner.id
                ).first()
            
            if existing_requirement:
                # 更新现有需求
                existing_requirement.mention_count += 1
                
                # 如果新提供的信息更完整，更新字段
                if use_case and not existing_requirement.use_case:
                    existing_requirement.use_case = use_case
                if priority != 'medium' and existing_requirement.priority == 'medium':
                    existing_requirement.priority = priority
                
                existing_requirement.updated_at = datetime.utcnow()
                db.session.commit()
                
                return json.dumps({
                    'success': True,
                    'action': 'updated',
                    'requirement_id': existing_requirement.id,
                    'mention_count': existing_requirement.mention_count,
                    'message': f'需求已记录（第 {existing_requirement.mention_count} 次提及）'
                })
            else:
                # 创建新需求
                requirement = Requirement(
                    id=str(uuid.uuid4()),
                    owner_id=owner.id,
                    session_id=session_id,
                    message_id=message_id,
                    feature_desc=feature_desc,
                    use_case=use_case,
                    priority=priority,
                    status='pending',
                    mention_count=1
                )
                db.session.add(requirement)
                db.session.commit()
                
                return json.dumps({
                    'success': True,
                    'action': 'created',
                    'requirement_id': requirement.id,
                    'mention_count': 1,
                    'message': '新需求已记录'
                })
        
        except Exception as e:
            db.session.rollback()
            return json.dumps({
                'success': False,
                'error': f'保存需求时出错: {str(e)}'
            })
    
    def _check_duplicate_with_llm(self, owner_id: str, feature_desc: str):
        """
        使用 LLM 语义检测是否存在重复需求

        Args:
            owner_id: 主人ID
            feature_desc: 功能描述

        Returns:
            tuple: (is_duplicate: bool, matched_id: str | None)
        """
        try:
            # 获取该主人所有未拒绝的需求
            requirements = Requirement.query.filter(
                Requirement.owner_id == owner_id,
                Requirement.status != 'rejected'
            ).all()

            if not requirements:
                return (False, None)

            # 构建索引表字符串
            index_lines = []
            for req in requirements:
                use_case_snippet = (req.use_case or '')[:50]
                index_lines.append(f"{req.id}: {req.feature_desc} | {use_case_snippet}")
            index_str = '\n'.join(index_lines)

            # 构造去重 prompt
            system_prompt = (
                "你是一个需求去重助手。给定一条新需求和一个已有需求列表，"
                "判断新需求是否与列表中某条需求语义相同或高度相似（即本质上是同一个需求，"
                "即使措辞不同）。"
                "请返回 JSON 格式：{\"duplicate\": true/false, \"matched_id\": \"id或null\"}"
            )
            user_prompt = (
                f"新需求：{feature_desc}\n\n"
                f"已有需求列表（格式：id: 功能描述 | 使用场景）：\n{index_str}\n\n"
                "请判断新需求是否与已有需求重复，返回 JSON。"
            )

            # 发起 HTTP 请求
            headers = {
                'Authorization': f'Bearer {Config.OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            }
            payload = {
                'model': Config.OPENAI_MODEL,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'max_tokens': 100,
                'temperature': 0
            }

            response = requests.post(
                f'{Config.OPENAI_BASE_URL}/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=10
            )
            response.raise_for_status()

            result_text = response.json()['choices'][0]['message']['content'].strip()

            # 提取 JSON（处理可能包含 markdown 代码块的情况）
            if '```' in result_text:
                result_text = result_text.split('```')[1]
                if result_text.startswith('json'):
                    result_text = result_text[4:]

            result = json.loads(result_text)
            is_duplicate = result.get('duplicate', False)
            matched_id = result.get('matched_id') or None

            return (bool(is_duplicate), matched_id)

        except Exception as e:
            # 异常时降级返回 (False, None)，不阻断主流程
            print(f"[LLM 去重] 调用失败，降级处理: {e}")
            return (False, None)
