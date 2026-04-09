#!/bin/bash

# my-agent Python 后端启动脚本

echo "================================"
echo "my-agent Python 后端"
echo "================================"
echo ""

# 检查是否在 backend 目录
if [ ! -f "app.py" ]; then
    echo "❌ 错误: 请在 backend 目录下运行此脚本"
    echo "   cd backend && bash start.sh"
    exit 1
fi

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: Python 3 未安装"
    echo "   请访问 https://www.python.org/ 下载安装"
    exit 1
fi

# 检查依赖是否安装
echo "📦 检查依赖..."
if ! python3 -c "import flask" 2>/dev/null; then
    echo "⚠️  依赖未安装，开始安装..."
    pip3 install -r requirements.txt || {
        echo "❌ 依赖安装失败"
        exit 1
    }
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已安装"
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  警告: .env 文件不存在"
    echo "   正在从 .env.example 创建..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请编辑填入你的 OpenAI API Key"
    echo ""
    read -p "是否现在编辑 .env 文件? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
fi

echo ""
echo "🚀 启动服务器..."
echo ""

# 启动服务
python3 app.py
