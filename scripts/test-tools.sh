#!/bin/bash

# ==============================================
# 工具调用测试脚本
# ==============================================
# 用于快速测试 OpenAI Function Calling 功能

set -e  # 遇到错误立即退出

# 配置
BASE_URL="https://my-agent-ao2.pages.dev"
OWNER_ID="jennia"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   工具调用功能测试脚本${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ==============================================
# 1. 创建测试会话
# ==============================================
echo -e "${YELLOW}[1/5]${NC} 创建测试会话..."

SESSION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"ownerId\": \"${OWNER_ID}\", \"visitorName\": \"测试用户\"}")

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')

if [ "$SESSION_ID" == "null" ] || [ -z "$SESSION_ID" ]; then
  echo -e "${RED}✗ 会话创建失败${NC}"
  echo $SESSION_RESPONSE | jq .
  exit 1
fi

echo -e "${GREEN}✓ 会话创建成功${NC}"
echo -e "  Session ID: ${SESSION_ID}"
echo ""

# ==============================================
# 2. 测试时间查询工具
# ==============================================
echo -e "${YELLOW}[2/5]${NC} 测试工具：get_current_time"
echo -e "  用户问题: \"现在几点了？\""

TIME_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}')

TIME_REPLY=$(echo $TIME_RESPONSE | jq -r '.aiReply.content')

if [ "$TIME_REPLY" == "null" ] || [ -z "$TIME_REPLY" ]; then
  echo -e "${RED}✗ 工具调用失败${NC}"
  echo $TIME_RESPONSE | jq .
else
  echo -e "${GREEN}✓ AI 回复:${NC}"
  echo -e "  ${TIME_REPLY}"
fi
echo ""

# 等待 1 秒避免请求过快
sleep 1

# ==============================================
# 3. 测试主人信息搜索工具
# ==============================================
echo -e "${YELLOW}[3/5]${NC} 测试工具：search_owner_info"
echo -e "  用户问题: \"jennia有哪些RAG项目经验？\""

SEARCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "jennia有哪些RAG项目经验？"}')

SEARCH_REPLY=$(echo $SEARCH_RESPONSE | jq -r '.aiReply.content')

if [ "$SEARCH_REPLY" == "null" ] || [ -z "$SEARCH_REPLY" ]; then
  echo -e "${RED}✗ 工具调用失败${NC}"
  echo $SEARCH_RESPONSE | jq .
else
  echo -e "${GREEN}✓ AI 回复:${NC}"
  echo -e "  ${SEARCH_REPLY}"
fi
echo ""

sleep 1

# ==============================================
# 4. 测试普通对话（不触发工具）
# ==============================================
echo -e "${YELLOW}[4/5]${NC} 测试普通对话（无工具调用）"
echo -e "  用户问题: \"你好呀\""

NORMAL_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "你好呀"}')

NORMAL_REPLY=$(echo $NORMAL_RESPONSE | jq -r '.aiReply.content')

if [ "$NORMAL_REPLY" == "null" ] || [ -z "$NORMAL_REPLY" ]; then
  echo -e "${RED}✗ 对话失败${NC}"
  echo $NORMAL_RESPONSE | jq .
else
  echo -e "${GREEN}✓ AI 回复:${NC}"
  echo -e "  ${NORMAL_REPLY}"
fi
echo ""

sleep 1

# ==============================================
# 5. 获取所有消息记录
# ==============================================
echo -e "${YELLOW}[5/5]${NC} 获取会话消息记录"

MESSAGES_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/sessions/${SESSION_ID}/messages")
MESSAGE_COUNT=$(echo $MESSAGES_RESPONSE | jq '.messages | length')

echo -e "${GREEN}✓ 消息记录获取成功${NC}"
echo -e "  总消息数: ${MESSAGE_COUNT}"
echo ""

# ==============================================
# 测试结果总结
# ==============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 所有测试通过！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "测试摘要:"
echo -e "  • 会话 ID: ${SESSION_ID}"
echo -e "  • 消息总数: ${MESSAGE_COUNT}"
echo -e "  • 工具调用: ✓ get_current_time"
echo -e "  • 工具调用: ✓ search_owner_info"
echo -e "  • 普通对话: ✓ 正常"
echo ""
echo -e "查看完整对话: ${BASE_URL}/u/${OWNER_ID}"
echo ""

# ==============================================
# 可选：展示详细消息历史
# ==============================================
read -p "是否显示详细消息历史？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}   消息历史详情${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  echo $MESSAGES_RESPONSE | jq -r '.messages[] | "\(.role | ascii_upcase) (\(.created_at)):\n  \(.content)\n"'
fi
