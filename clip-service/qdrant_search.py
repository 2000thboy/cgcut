"""
Qdrant混合检索服务 - 在clip_server.py中集成
提供基于Qdrant的高性能向量检索 + MMR多样性算法
"""
import requests
from typing import List, Dict, Any, Optional
import numpy as np


class QdrantSearchService:
    """Qdrant混合检索服务"""

    def __init__(self, base_url: str = "http://127.0.0.1:6333", collection_name: str = "video_assets"):
        self.base_url = base_url
        self.collection_name = collection_name

    def search_by_vector(
        self,
        query_vector: List[float],
        top_k: int = 10,
        threshold: float = 0.0,
        filter_tags: Optional[List[str]] = None,
        filter_scene: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        向量检索（支持标签和场景过滤）

        Args:
            query_vector: CLIP查询向量
            top_k: 返回结果数量
            threshold: 相似度阈值（百分制 0-100），会自动转换为Qdrant原始范围
            filter_tags: 标签过滤列表
            filter_scene: 场景过滤关键词
        """
        # 阈值转换：外部使用百分制(0-100)，Qdrant使用0-1，需要除以100
        qdrant_threshold = threshold / 100.0 if threshold > 0 else 0.0

        # 构建过滤条件
        filter_conditions = []

        if filter_tags:
            # 标签过滤：tags字段包含任一指定标签
            tag_conditions = [
                {"key": "tags", "match": {"any": filter_tags}}
            ]
            filter_conditions.extend(tag_conditions)

        if filter_scene:
            # 场景过滤：description字段包含场景关键词
            filter_conditions.append({
                "key": "description",
                "match": {"text": filter_scene}
            })

        # 构建请求
        payload = {
            "vector": query_vector,
            "limit": top_k * 3,  # 过采样以支持后续MMR过滤
            "score_threshold": qdrant_threshold,  # 使用转换后的阈值
            "with_payload": True,
            "with_vector": True  # 需要向量用于MMR计算
        }

        if filter_conditions:
            payload["filter"] = {
                "should": filter_conditions  # OR条件
            }

        # 调用Qdrant API
        resp = requests.post(
            f"{self.base_url}/collections/{self.collection_name}/points/search",
            json=payload
        )
        resp.raise_for_status()

        results = resp.json()["result"]

        # 格式化返回结果
        formatted_results = []
        for item in results:
            payload = item["payload"]
            result = {
                "filePath": payload.get("filePath"),
                "shotId": payload.get("shotId"),
                "label": payload.get("label"),
                # 统一对外输出百分制相似度
                "similarity": round(item["score"] * 100, 2),
                "tags": payload.get("tags", []),
                "description": payload.get("description", ""),
                "duration": payload.get("duration", 5.0),
                "vector": item["vector"]  # 用于MMR计算
            }
            # 添加分片信息（如果存在）
            if "segment" in payload:
                result["segment"] = payload["segment"]
            formatted_results.append(result)

        return formatted_results

    def apply_mmr(
        self,
        candidates: List[Dict[str, Any]],
        query_vector: List[float],
        top_k: int = 10,
        lambda_param: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        应用MMR（Maximal Marginal Relevance）算法增强多样性

        Args:
            candidates: 候选结果列表
            query_vector: 查询向量
            top_k: 最终返回数量
            lambda_param: 相关性权重（0-1）
                         1.0 = 完全基于相关性
                         0.5 = 相关性和多样性平衡
                         0.0 = 完全基于多样性

        返回:
            多样性优化后的结果列表
        """
        if len(candidates) <= top_k:
            return candidates

        # 转换为numpy数组便于计算
        query_vec = np.array(query_vector)
        candidate_vecs = np.array([c["vector"] for c in candidates])

        # 已选择的结果
        selected = []
        selected_indices = []

        # 第一个结果：选择与query最相似的
        first_idx = 0  # candidates已按相似度排序
        selected.append(candidates[first_idx])
        selected_indices.append(first_idx)

        # 迭代选择剩余结果
        while len(selected) < top_k and len(selected) < len(candidates):
            best_score = -float('inf')
            best_idx = -1

            for i, candidate in enumerate(candidates):
                if i in selected_indices:
                    continue

                # 相似度已转为百分制，这里还原到0-1用于MMR计算
                relevance = candidate["similarity"] / 100.0

                # 计算与已选结果的最大相似度（多样性惩罚）
                max_similarity = 0.0
                for selected_idx in selected_indices:
                    sim = self._cosine_similarity(
                        candidate_vecs[i],
                        candidate_vecs[selected_idx]
                    )
                    max_similarity = max(max_similarity, sim)

                # MMR分数：相关性 - 多样性惩罚
                mmr_score = lambda_param * relevance - \
                    (1 - lambda_param) * max_similarity

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = i

            if best_idx != -1:
                selected.append(candidates[best_idx])
                selected_indices.append(best_idx)

        # 移除vector字段（前端不需要）
        for item in selected:
            item.pop("vector", None)

        return selected

    @staticmethod
    def _cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        """计算余弦相似度"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def hybrid_search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        threshold: float = 25.0,
        filter_tags: Optional[List[str]] = None,
        filter_scene: Optional[str] = None,
        enable_mmr: bool = True,
        mmr_lambda: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        混合检索：向量搜索 + 标签过滤 + MMR多样性

        这是主要的搜索接口，整合了所有优化策略
        """
        # 1. 向量检索（带过滤）
        candidates = self.search_by_vector(
            query_vector=query_vector,
            top_k=top_k,
            threshold=threshold,
            filter_tags=filter_tags,
            filter_scene=filter_scene
        )

        if not candidates:
            return []

        # 2. 应用MMR多样性算法
        if enable_mmr and len(candidates) > top_k:
            results = self.apply_mmr(
                candidates=candidates,
                query_vector=query_vector,
                top_k=top_k,
                lambda_param=mmr_lambda
            )
        else:
            # 不启用MMR，直接取top_k
            results = candidates[:top_k]
            for item in results:
                item.pop("vector", None)

        return results


# 全局实例
qdrant_service = QdrantSearchService()
