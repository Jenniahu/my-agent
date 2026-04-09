"""
信息搜索工具
"""
import json
from tools.base import BaseTool


class SearchTool(BaseTool):
    """信息搜索工具"""
    
    @property
    def name(self):
        return 'search_owner_info'
    
    @property
    def description(self):
        return '搜索主人的专业技能、项目经验或服务信息。如果用户问到主人的技能、项目、经验等，请使用此工具。'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'keyword': {
                    'type': 'string',
                    'description': '搜索关键词，如 "RAG"、"workflow"、"AI应用"、"项目经验"等'
                }
            },
            'required': ['keyword']
        }
    
    def execute(self, args, owner):
        """执行信息搜索"""
        keyword = args.get('keyword', '').lower()
        
        # 模拟项目数据库（后续可改为真实数据库查询）
        mock_projects = [
            {
                'name': '客服知识库系统',
                'type': 'RAG',
                'year': 2024,
                'tech': ['Dify', 'Cloudflare D1', '向量数据库'],
                'description': '基于 RAG 技术的智能客服系统，支持文档上传、自动问答、上下文理解',
                'highlights': '提升客服效率 70%，准确率达 95%'
            },
            {
                'name': '审批自动化流程',
                'type': 'workflow',
                'year': 2024,
                'tech': ['n8n', 'API集成', 'Webhook'],
                'description': '企业流程自动化方案，支持多级审批、自动通知、数据同步',
                'highlights': '减少人工操作 80%，审批时间缩短 60%'
            },
            {
                'name': 'AI原生应用开发',
                'type': 'ai_native',
                'year': 2024,
                'tech': ['Hono', 'OpenAI', 'Function Calling'],
                'description': 'AI Agent 开发框架，支持工具调用、多轮对话、上下文管理',
                'highlights': '快速搭建 AI 应用，支持灵活扩展'
            },
            {
                'name': 'my-agent 个人助手平台',
                'type': 'ai_agent',
                'year': 2026,
                'tech': ['Python', 'Flask', 'SQLite', 'OpenAI'],
                'description': '基于 OpenAI Function Calling 的个人 AI 助手平台，支持工具调用、会话管理、人工接管',
                'highlights': '开源项目，支持自部署，数据可控'
            }
        ]
        
        # 过滤项目
        filtered = []
        for p in mock_projects:
            # 检查关键词是否匹配
            if (keyword in p['name'].lower() or 
                keyword in p['type'].lower() or 
                keyword in p['description'].lower() or
                any(keyword in tech.lower() for tech in p['tech'])):
                filtered.append(p)
        
        return json.dumps({
            'owner_name': owner.name,
            'owner_bio': owner.bio,
            'keyword': args.get('keyword'),
            'projects': filtered,
            'total': len(filtered),
            'message': f'找到 {len(filtered)} 个相关项目' if filtered else '没有找到相关项目，但我可以为您介绍主人的背景和专长'
        }, ensure_ascii=False)
