# 真实校园数据采集与实验协议（方向一 → Applied Intelligence）

本文件把「demo 能跑」推进到「可写进论文的真实研究」。按周执行即可。

---

## 0. 目标样本量（最低可发表线）

| 用途 | 建议最低 | 更好 |
|------|----------|------|
| 真实答卷（干净主集） | **≥ 200** | ≥ 400 |
| 人工标注（normal / low_quality） | **≥ 100**（且两类都有） | ≥ 200，双人标注抽检 20% |
| 合成污染实验 | 在干净集上注入 5%/10%/20% | 同左 + 多种策略 |
| 注意力/蜜罐题 | 每份评估至少各 1 题 | 同左 |

没有伦理批件与知情同意，不要公开可识别的校园数据细节。

---

## 1. 第 1 周：伦理与工具就绪

- [ ] 向学院/学校提交伦理申请（健康问卷 + 脱敏技术元数据用于质量检测）
- [ ] 填写页已有同意勾选（系统已具备）；打印/截图留存
- [ ] 确认生产环境：`MONGODB_URI`、`SESSION_SECRET`、`QUALITY_HASH_SECRET`、`BASE_URL`
- [ ] 新建**正式研究用评估**（不要用早期无元数据的旧评估）
  - 普通健康题 8–15 题
  - **+1 注意力检查模板**
  - **+1 蜜罐题模板**
- [ ] 试填 3–5 份，在「质量标注」页确认能看到时长、批次、注意力结果

伦理陈述可参考 `ethics-notes.md`。

---

## 2. 第 2–3 周：招募与采集

### 传播方式

- 班级群 / 社团 / 课程二维码（记录大致传播渠道，写入论文 Setting）
- 同一 `shareId` 即可；若多渠道，可建多份评估或在 description 标注批次

### 操作规范

- [ ] 只分享**新评估**链接（保证元数据完整）
- [ ] 避免作者本人反复刷题污染（限流已开启，仍勿故意测爆）
- [ ] 每日导出一次备份：画像页「导出 JSON」或 `export_responses.py`
- [ ] 备份放到 `AI_SCI/data/raw/field_YYYYMMDD.json`（已 gitignore）

### 停止采集条件

达到目标 N，或伦理批准的窗口结束。

---

## 3. 第 3–4 周：人工标注（Ground Truth）

打开：`/pages/quality-admin.html?id=<评估MongoId>`

### 标签定义（必须统一）

| label | 含义 | 典型信号 |
|-------|------|----------|
| `normal` | 真实、可用 | 时长合理、选项有变化、注意力通过 |
| `low_quality` | 真实但低质 | 过快、严重直线作答、注意力失败、明显乱选 |
| `uncertain` | 吃不准 | 信号冲突；论文主实验可排除或单独敏感性分析 |
| `synthetic` | 仅实验注入 | 字段 `isSynthetic=true`，不要与真人低质混为一谈 |

### 标注流程

1. 筛选「未标注」→ 先标自动「疑似」的  
2. 再随机抽未疑似样本，避免只标差样本  
3. 第二标注者抽检 ≥20%，记录一致率（写入论文）  
4. 每周跑：`python scripts/labeling_progress.py --in data/raw/field_xxx.json`

细则见 `labeling-guide.md`。

---

## 4. 第 4–5 周：实验复现（真实数据）

```bash
cd AI_SCI
# 1) 导出或使用备份
python scripts/export_responses.py --survey-id <id>
# 或 --from-file data/raw/field_xxx.json

# 2) 标注进度与数据集卡片
python scripts/labeling_progress.py --in data/raw/field_xxx.json
python scripts/dataset_card.py --in data/raw/field_xxx.json

# 3) 构建训练/评估子集
python scripts/build_train_set.py --in data/raw/field_xxx.json

# 4) 污染 + 消融 + 图
python scripts/run_ablation.py --in data/raw/field_xxx.json --rates 0.05,0.1,0.2
python scripts/plot_ablation.py

# 5) 监督/半监督（依赖人工 label）
python scripts/detect_supervised.py --in data/synthetic/ablation_r0.2.json --semi
python scripts/eval_portrait_bias.py --data data/synthetic/ablation_r0.2.json --scores data/results/supervised_semi_scores.json

# 6) 可选：写回分数后，在画像页切换 quality=high 截图
python scripts/writeback_scores.py --scores data/results/multiview_scores.json
```

论文主表用**真实干净集 + 合成污染**；另做一表：仅人工 `low_quality` 检出情况（若标注量够）。

---

## 5. 第 5–6 周：写作与投稿

- [ ] 用 `docs/methods-draft-en.md` 扩成全文  
- [ ] 表：消融 F1 + 画像偏差（换真实数字）  
- [ ] 图：`data/results/figures/`  
- [ ] 对照 `docs/submission-checklist.md`  
- [ ] 选混合刊路径：*Applied Intelligence*（不选 OA 则无 APC）

---

## 6. 风险与应对

| 风险 | 应对 |
|------|------|
| 真实低质量太少 | 合成污染仍作主实验；人工标注作补充验证 |
| 元数据缺失的旧答卷 | 不进主集；只用新评估 |
| 标注不一致 | uncertain 独立；报告 Cohen's κ |
| Demo F1 虚高 | 投稿勿用 demo 数字；必须重跑 field 数据 |

---

## 7. 本周你只要做 3 件事

1. 交伦理 / 确认能否开做  
2. 创建带注意力+蜜罐的正式评估并开始收数  
3. 每收一批就导出到 `AI_SCI/data/raw/`
