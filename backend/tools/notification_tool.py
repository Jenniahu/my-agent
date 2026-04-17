"""
通知工具 - 邮件和 Webhook
"""
import json
import os
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from tools.base import BaseTool


class NotificationTool(BaseTool):
    """
    通知工具 - 发送邮件和 Webhook 通知
    
    触发场景：
    - 用户要求发送邮件通知
    - 需要触发外部系统 Webhook
    - 主动推送消息给主人
    """
    
    @property
    def name(self):
        return 'send_notification'
    
    @property
    def description(self):
        return (
            '当需要发送邮件通知或触发 Webhook 时使用此工具。'
            '例如："发送邮件通知主人有新消息"、"触发Webhook通知外部系统"'
        )
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'type': {
                    'type': 'string',
                    'enum': ['email', 'webhook'],
                    'description': '通知类型：email(邮件) 或 webhook'
                },
                'recipient': {
                    'type': 'string',
                    'description': '邮件收件人地址（email类型时需要）'
                },
                'subject': {
                    'type': 'string',
                    'description': '邮件主题或通知标题'
                },
                'message': {
                    'type': 'string',
                    'description': '通知内容'
                },
                'webhook_url': {
                    'type': 'string',
                    'description': 'Webhook URL（webhook类型时需要）'
                },
                'priority': {
                    'type': 'string',
                    'enum': ['low', 'normal', 'high'],
                    'description': '优先级',
                    'default': 'normal'
                }
            },
            'required': ['type', 'subject', 'message']
        }
    
    def execute(self, args, owner):
        """执行通知发送"""
        notification_type = args.get('type')
        
        if notification_type == 'email':
            return self._send_email(args, owner)
        elif notification_type == 'webhook':
            return self._send_webhook(args)
        else:
            return json.dumps({
                'error': True,
                'message': f'未知的通知类型: {notification_type}'
            }, ensure_ascii=False)
    
    def _send_email(self, args, owner):
        """发送邮件"""
        recipient = args.get('recipient')
        subject = args.get('subject')
        message = args.get('message')
        priority = args.get('priority', 'normal')
        
        # 如果没有指定收件人，使用主人邮箱
        if not recipient and owner:
            recipient = getattr(owner, 'email', None)
        
        if not recipient:
            return json.dumps({
                'error': True,
                'message': '未指定收件人邮箱'
            }, ensure_ascii=False)
        
        # 从环境变量获取邮件配置
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.getenv('SMTP_USER')
        smtp_pass = os.getenv('SMTP_PASS')
        
        if not smtp_user or not smtp_pass:
            # 模拟发送成功（实际未配置）
            return json.dumps({
                'success': True,
                'type': 'email',
                'recipient': recipient,
                'subject': subject,
                'message': '邮件配置未设置，模拟发送成功。请配置 SMTP_HOST, SMTP_USER, SMTP_PASS 环境变量以启用真实邮件发送。',
                'simulated': True
            }, ensure_ascii=False)
        
        try:
            # 创建邮件
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = recipient
            msg['Subject'] = f"[{'高' if priority == 'high' else '中' if priority == 'normal' else '低'}优先级] {subject}"
            
            # 添加邮件正文
            body = f"""
{message}

---
此邮件由 AI 助手自动发送
发送时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            """
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            # 发送邮件
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            
            return json.dumps({
                'success': True,
                'type': 'email',
                'recipient': recipient,
                'subject': subject,
                'message': '邮件发送成功'
            }, ensure_ascii=False)
            
        except Exception as e:
            return json.dumps({
                'error': True,
                'type': 'email',
                'message': f'邮件发送失败: {str(e)}'
            }, ensure_ascii=False)
    
    def _send_webhook(self, args):
        """发送 Webhook 通知"""
        webhook_url = args.get('webhook_url')
        subject = args.get('subject')
        message = args.get('message')
        priority = args.get('priority', 'normal')
        
        if not webhook_url:
            return json.dumps({
                'error': True,
                'message': '未指定 Webhook URL'
            }, ensure_ascii=False)
        
        try:
            payload = {
                'title': subject,
                'message': message,
                'priority': priority,
                'timestamp': __import__('datetime').datetime.now().isoformat(),
                'source': 'ai-assistant'
            }
            
            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                return json.dumps({
                    'success': True,
                    'type': 'webhook',
                    'url': webhook_url,
                    'status_code': response.status_code,
                    'message': 'Webhook 触发成功'
                }, ensure_ascii=False)
            else:
                return json.dumps({
                    'error': True,
                    'type': 'webhook',
                    'url': webhook_url,
                    'status_code': response.status_code,
                    'message': f'Webhook 返回错误: {response.text}'
                }, ensure_ascii=False)
                
        except Exception as e:
            return json.dumps({
                'error': True,
                'type': 'webhook',
                'message': f'Webhook 调用失败: {str(e)}'
            }, ensure_ascii=False)
