# Retrieval Ops Notes

- 阈值/分数域：前端与后端统一使用百分制 0-100；Qdrant score_threshold = threshold/100；返回 similarity 也是百分制。
- ID 规范：point_id = sha1(canonical_path#segment_index)，canonical_path 为绝对路径、反斜杠转 `/`。
- JSON schema：clip_results.json 记录 canonicalPath、hashId、mtime、segment{start,end,index}、clipMetadata{embeddings,tags,emotions,description}。
- 同步脚本：`python acceptance-service/../clip-service/sync_qdrant.py --collection video_assets_v2 --dry-run`（默认读取 clip_results.json，支持 --recreate）。
- 鉴权：clip-service 需 `Authorization: Bearer $CLIP_SERVICE_API_KEY`；验收服务需 `Authorization: Bearer $ACCEPT_API_KEY`。
- Playwright：`npm run test:pw`（需已启动前端及后端服务）。
