"""
上下文策略实现
"""
import math
import re
from typing import List, Dict, Any
from services.context_engine import ContextPolicy, RawMessage, ProcessedMessage, MessageRole


class RecencyPolicy(ContextPolicy):
    """时间衰减策略

    评分逻辑：
    - 最新消息分数最高 (接近 1.0)
    - 早期消息分数按指数衰减
    - 公式: score = e^(-position_from_end / decay_half_life)

    示例（decay_half_life=10）:
    - 最新消息 (position=0): score = e^0 = 1.0
    - 10条前 (position=10): score = e^-1 ≈ 0.368
    - 20条前 (position=20): score = e^-2 ≈ 0.135
    """

    name = "recency"
    version = "1.0.0"

    def __init__(self, decay_half_life: int = 10):
        """
        Args:
            decay_half_life: 半衰期，表示多少条消息后分数衰减到一半
        """
        self.decay_half_life = decay_half_life

    def process(self, messages: List[RawMessage],
                context: Dict[str, Any]) -> List[ProcessedMessage]:
        if not messages:
            return []

        processed = []
        total = len(messages)

        for idx, msg in enumerate(messages):
            # 计算距离最新消息的位置
            position_from_end = total - idx - 1
            # 指数衰减公式
            score = math.exp(-position_from_end / self.decay_half_life)

            processed.append(ProcessedMessage(
                role=self._map_role(msg.role),
                content=msg.content,
                source_id=msg.id,
                processing_log=[f"{self.name}: score={score:.3f}, position={position_from_end}"],
                priority_score=score
            ))

        return processed

    def _map_role(self, role: str) -> MessageRole:
        """映射数据库角色到 MessageRole"""
        mapping = {
            'visitor': MessageRole.USER,
            'ai': MessageRole.ASSISTANT,
            'owner': MessageRole.ASSISTANT
        }
        return mapping.get(role, MessageRole.ASSISTANT)

    def get_metrics(self) -> Dict[str, Any]:
        return {"decay_half_life": self.decay_half_life}


class StructurePolicy(ContextPolicy):
    """对话结构策略

    识别消息中的结构性特征，给予额外加分：
    - 问题标记 (?/？): +0.2 分
    - 工具结果 ([工具结果]/tool_result): +0.3 分
    - 会话开始 (第一条消息): +0.1 分

    这些特征通常表示消息包含重要信息，应该优先保留。
    """

    name = "structure"
    version = "1.0.0"

    def process(self, messages: List[RawMessage],
                context: Dict[str, Any]) -> List[ProcessedMessage]:
        processed = []

        for idx, msg in enumerate(messages):
            tags = []
            boost = 0.0

            # 标记问题（包含问号）
            if '?' in msg.content or '？' in msg.content:
                tags.append("question")
                boost += 0.2

            # 标记工具调用相关（基于 content 中的特征）
            if '[工具结果]' in msg.content or 'tool_result' in str(msg.metadata):
                tags.append("tool_result")
                boost += 0.3

            # 标记代码块（可能包含重要技术信息）
            if '```' in msg.content:
                tags.append("code_block")
                boost += 0.15

            # 标记长消息（可能包含详细信息）
            if len(msg.content) > 200:
                tags.append("long_content")
                boost += 0.05

            # 会话开始
            if idx == 0:
                tags.append("start")
                boost += 0.1

            processed.append(ProcessedMessage(
                role=MessageRole.USER if msg.role == 'visitor' else MessageRole.ASSISTANT,
                content=msg.content,
                source_id=msg.id,
                processing_log=[f"{self.name}: tags={tags}, boost={boost:.2f}"],
                priority_score=min(1.0, boost)  # 最高不超过 1.0
            ))

        return processed


class DeduplicationPolicy(ContextPolicy):
    """语义去重策略（简化版）

    识别并降低重复内容的优先级：
    - 检测连续重复的消息
    - 检测相似度高的消息（简化实现：基于长度和内容特征）

    注意：这是简化实现，完整实现需要向量相似度计算
    """

    name = "deduplication"
    version = "1.0.0"

    def __init__(self, similarity_threshold: float = 0.8):
        self.similarity_threshold = similarity_threshold
        self._seen_hashes = set()

    def process(self, messages: List[RawMessage],
                context: Dict[str, Any]) -> List[ProcessedMessage]:
        processed = []
        self._seen_hashes = set()

        for idx, msg in enumerate(messages):
            # 计算内容指纹（简化：前50字符的哈希）
            content_fingerprint = self._get_fingerprint(msg.content)

            is_duplicate = content_fingerprint in self._seen_hashes
            if is_duplicate:
                penalty = 0.5  # 重复内容降权 50%
                tags = ["duplicate"]
            else:
                penalty = 0.0
                tags = ["unique"]
                self._seen_hashes.add(content_fingerprint)

            processed.append(ProcessedMessage(
                role=MessageRole.USER if msg.role == 'visitor' else MessageRole.ASSISTANT,
                content=msg.content,
                source_id=msg.id,
                processing_log=[f"{self.name}: tags={tags}, penalty={penalty}"],
                priority_score=max(0.0, 0.5 - penalty)  # 基础分 0.5，重复则降低
            ))

        return processed

    def _get_fingerprint(self, content: str) -> str:
        """生成内容指纹"""
        # 简化：取前50字符，去除标点和空格
        normalized = re.sub(r'[^\w\u4e00-\u9fff]', '', content[:50].lower())
        return normalized

    def get_metrics(self) -> Dict[str, Any]:
        return {
            "similarity_threshold": self.similarity_threshold,
            "unique_messages": len(self._seen_hashes)
        }
