"""
Context Engineering 核心引擎
与现有 ai_service.py 集成
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum
import math
import time


class MessageRole(Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class RawMessage:
    """
    原始消息 - 从数据库 Message 模型转换

    与 models.py Message 表字段对应：
    - id → Message.id
    - session_id → Message.session_id
    - role → Message.role ('visitor'/'ai'/'owner')
    - content → Message.content
    - created_at → Message.created_at
    """
    id: str
    session_id: str
    role: str  # 'visitor', 'ai', 'owner' - 需要映射到 MessageRole
    content: str
    created_at: Any  # datetime
    metadata: Dict[str, Any] = None
    token_count: Optional[int] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ProcessedMessage:
    """加工后的消息"""
    role: MessageRole
    content: str
    source_id: str
    processing_log: List[str]
    priority_score: float


class ContextPolicy(ABC):
    """上下文策略基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        pass

    @abstractmethod
    def process(self, messages: List[RawMessage],
                context: Dict[str, Any]) -> List[ProcessedMessage]:
        pass

    def get_metrics(self) -> Dict[str, Any]:
        return {}


@dataclass
class TokenBudget:
    """Token 预算配置 - 适配 MiniMax-M2.5 模型"""
    max_total: int = 8000        # MiniMax-M2.5 上下文长度
    reserve_for_output: int = 1500
    reserve_for_system: int = 1000

    @property
    def available_for_history(self) -> int:
        return self.max_total - self.reserve_for_output - self.reserve_for_system


class TokenCounter:
    """
    Token 计数器

    使用 tiktoken 进行精确计数，支持 OpenAI 兼容格式
    """

    def __init__(self, model: str = "MiniMax-M2.5"):
        self.model = model
        # 使用 cl100k_base 编码（GPT-4 / MiniMax 兼容）
        try:
            import tiktoken
            self.encoder = tiktoken.get_encoding("cl100k_base")
        except ImportError:
            # 如果 tiktoken 未安装，使用简单的字符估算
            self.encoder = None

    def count(self, text: str) -> int:
        """计算文本的精确 token 数"""
        if self.encoder:
            return len(self.encoder.encode(text))
        # 备选：简单估算（中文字符按2个token，英文按1个token）
        import re
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        other_chars = len(text) - chinese_chars
        return chinese_chars * 2 + other_chars

    def count_messages(self, messages: List[Dict]) -> int:
        """
        计算消息列表的 token 数（包含 OpenAI 格式开销）

        参考 OpenAI 官方计算方式：
        - 每条消息固定开销：4 tokens
        - role 字段开销：1 token
        - content 按实际编码计算
        """
        overhead_per_message = 4
        total = 0

        for msg in messages:
            # 消息格式开销 + role + content
            total += overhead_per_message + 1 + self.count(msg.get('content', ''))

        return total


class ContextEngine:
    """
    上下文组装引擎

    使用示例（在 ai_service.py 中）：

        engine = ContextEngine(
            policies=[RecencyPolicy(), StructurePolicy()],
            budget=TokenBudget(),
            counter=TokenCounter()
        )

        result = engine.build(
            raw_messages=[RawMessage(...), ...],
            system_prompt=system_content,
            new_message=new_message
        )

        openai_messages = result["messages"]
    """

    def __init__(self,
                 policies: List[ContextPolicy],
                 budget: TokenBudget,
                 counter: TokenCounter):
        self.policies = policies
        self.budget = budget
        self.counter = counter
        self.decision_log = []

    def build(self,
              raw_messages: List[RawMessage],
              system_prompt: str,
              new_message: str,
              context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        构建上下文

        Returns:
            {
                "messages": [...],           # OpenAI 格式消息列表
                "token_count": int,          # 总 token 数
                "decision_log": [...],       # 决策日志（用于调试）
                "truncation_info": {...},    # 截断信息
                "metrics": {...}             # 性能指标
            }
        """
        context = context or {}
        self.decision_log = []

        # Step 1: 执行策略链
        processed = self._apply_policies(raw_messages, context)

        # Step 2: 计算综合优先级
        scored = self._calculate_scores(processed)

        # Step 3: 预算内选择
        selected, truncation_info = self._select_within_budget(
            scored, system_prompt, new_message
        )

        # Step 4: 格式化输出
        messages = self._format_messages(selected, system_prompt, new_message)

        return {
            "messages": messages,
            "token_count": self.counter.count_messages(messages),
            "decision_log": self.decision_log,
            "truncation_info": truncation_info,
            "metrics": {
                "total_raw": len(raw_messages),
                "total_selected": len(selected),
                "compression_ratio": len(selected) / len(raw_messages) if raw_messages else 0
            }
        }

    def _apply_policies(self, messages: List[RawMessage],
                       context: Dict) -> List[ProcessedMessage]:
        """应用策略链"""
        result = []

        for policy in self.policies:
            start = time.time()
            result = policy.process(messages, context)
            elapsed = (time.time() - start) * 1000

            self.decision_log.append({
                "step": policy.name,
                "version": policy.version,
                "elapsed_ms": round(elapsed, 2),
                "metrics": policy.get_metrics()
            })

        return result

    def _calculate_scores(self, processed: List[ProcessedMessage]) -> List[tuple]:
        """计算综合优先级分数"""
        # 简单平均（可扩展为加权）
        return [(p.priority_score, p) for p in processed]

    def _select_within_budget(self, scored: List[tuple],
                             system_prompt: str,
                             new_message: str) -> tuple:
        """预算内贪心选择"""
        available = self.budget.available_for_history
        available -= self.counter.count(new_message)

        # 按分数降序排序
        scored.sort(key=lambda x: x[0], reverse=True)

        selected = []
        used = 0

        for score, msg in scored:
            cost = self.counter.count(msg.content)
            if used + cost <= available:
                selected.append(msg)
                used += cost

        # 按时间顺序重新排序（保持对话连贯性）
        # 注意：这里简化处理，实际应保留原始顺序信息

        return selected, {
            "budget_available": available,
            "budget_used": used,
            "messages_selected": len(selected),
            "messages_dropped": len(scored) - len(selected)
        }

    def _format_messages(self, selected: List[ProcessedMessage],
                        system_prompt: str, new_message: str) -> List[Dict]:
        """格式化为 OpenAI 消息格式"""
        messages = [{"role": "system", "content": system_prompt}]

        for msg in selected:
            role = msg.role.value
            # 映射内部角色到 OpenAI 角色
            if role == 'user':
                openai_role = 'user'
            elif role == 'assistant':
                openai_role = 'assistant'
            else:
                openai_role = 'assistant'

            messages.append({
                "role": openai_role,
                "content": msg.content
            })

        messages.append({"role": "user", "content": new_message})

        return messages