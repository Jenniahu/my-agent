"""
网络搜索工具 - 实时信息查询（免费版，无需 API Key）
原理：通过爬虫方式获取搜索引擎结果，参考 https://github.com/bravekingzhang/search-engine-tool
"""
import json
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
from tools.base import BaseTool


class WebSearchTool(BaseTool):
    """
    网络搜索工具 - 免费获取实时信息
    
    触发场景：
    - 用户询问时事新闻、天气、股价等实时信息
    - 用户询问超出主人知识库范围的问题
    - 用户需要验证某个事实或获取最新数据
    """
    
    @property
    def name(self):
        return 'web_search'
    
    @property
    def description(self):
        return (
            '当用户询问实时信息（新闻、天气、股价、最新事件等）时使用此工具。'
            '例如："今天北京天气如何"、"最新的AI新闻"、"特斯拉股价"'
        )
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'query': {
                    'type': 'string',
                    'description': '搜索关键词，应该提取用户问题中的核心查询词'
                },
                'num_results': {
                    'type': 'integer',
                    'description': '返回结果数量（1-10）',
                    'default': 5,
                    'minimum': 1,
                    'maximum': 10
                }
            },
            'required': ['query']
        }
    
    def execute(self, args, owner):
        """执行网络搜索"""
        query = args.get('query', '')
        num_results = args.get('num_results', 5)
        
        try:
            return self._search_duckduckgo(query, num_results)
        except Exception as e:
            return json.dumps({
                'query': query,
                'error': True,
                'message': f'搜索失败: {str(e)}',
                'results': []
            }, ensure_ascii=False)
    
    def _search_duckduckgo(self, query, num_results):
        """
        DuckDuckGo 搜索 - 最友好，无需登录，反爬限制少
        """
        encoded_query = urllib.parse.quote(query)
        url = f'https://html.duckduckgo.com/html/?q={encoded_query}'
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.text, 'lxml')
        results = []
        
        # 解析搜索结果
        result_divs = soup.find_all('div', class_='result')
        
        for div in result_divs[:num_results]:
            try:
                # 提取标题和链接
                title_link = div.find('a', class_='result__a')
                if not title_link:
                    continue
                
                title = title_link.get_text(strip=True)
                href = title_link.get('href', '')
                
                # 处理 DuckDuckGo 的重定向链接
                if href.startswith('/l/'):
                    uddg_match = re.search(r'uddg=([^&]+)', href)
                    if uddg_match:
                        href = urllib.parse.unquote(uddg_match.group(1))
                
                # 提取摘要
                snippet_elem = div.find('a', class_='result__snippet')
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else ''
                
                results.append({
                    'title': title,
                    'snippet': snippet,
                    'url': href if href.startswith('http') else f'https://duckduckgo.com{href}',
                    'source': 'DuckDuckGo'
                })
            except Exception:
                continue
        
        return json.dumps({
            'query': query,
            'engine': 'duckduckgo',
            'total_results': len(results),
            'results': results,
            'message': f'找到 {len(results)} 条相关结果' if results else '未找到相关结果'
        }, ensure_ascii=False)
