# 论文提纲与中文摘要草稿（Applied Intelligence）

> 英文 Methods 见 `methods-draft-en.md`。数字请用真实 field 结果替换。

---

## 建议英文题目（可选）

**Multi-view Detection of Low-Quality and Synthetic Responses in Login-Free Campus Health Surveys with Portrait Bias Reduction**

中文对照：面向免登录校园健康问卷的低质量与合成答卷多视图检测及画像统计偏差抑制

---

## 中文摘要（草稿）

**【目的】** 针对通过分享链接/二维码开展的免登录校园健康问卷，研究如何在缺少账号锚点的条件下识别随机作答、直线作答、重复提交及合成答卷，并评估过滤后对群体画像统计偏差的抑制效果。  

**【方法】** 基于自研平台采集选项答卷及脱敏行为/批次元数据，构建答案视图、行为视图与批次弱传播视图，采用规则与孤立森林等基线及晚期融合；在稀疏人工标注下进一步训练随机森林并可选自训练半监督。通过在真实答卷上按 5%、10%、20% 注入合成污染开展消融实验。  

**【结果】** （待填：F1、画像 L1 偏差下降、排序保持率；对比单视图与融合。）  

**【结论】** 将检测与画像效用指标联合评估，可为校园匿名问卷的数据质量管理提供可部署的智能方法；注意力/蜜罐题仅作辅助，不足以单独对抗大模型生成答卷。  

**【关键词】** 问卷质量；异常检测；合成数据；多视图学习；健康画像；校园健康

---

## 英文 Abstract（skeleton）

**Purpose:** Detect low-quality and synthetic responses in login-free campus health surveys and quantify reduction of group-portrait statistical bias after filtering.  
**Methods:** Multi-view scoring (answer / behavior / batch) with late fusion; optional supervised/semi-supervised learning on sparse labels; controlled contamination at 5–20%.  
**Results:** [TBD from field runs].  
**Conclusion:** Coupling detection metrics with portrait bias yields an application-oriented evaluation aligned with real survey platforms.

---

## 章节结构

1. **Introduction** — 免登录问卷的噪声；画像被污染的后果；贡献三条  
2. **Related Work** — 问卷异常检测、bot/LLM 合成、差分隐私不在本文主线但可一笔  
3. **System & Data** — 智绘青健数据平面；伦理与脱敏  
4. **Method** — 三视图 + 融合 + 监督变体；评价指标（含 bias reduction）  
5. **Experiments** — 污染协议；消融；真实标注子集；误伤分析  
6. **Discussion** — 局限（单校、选择提、蜜罐对 LLM）；部署建议  
7. **Conclusion**

## 三条贡献（投稿信可用）

1. 面向**免登录校园健康问卷**的多视图质量检测框架，显式利用行为与同链批次弱信号。  
2. 将**群体画像统计偏差**作为与检测率并列的主指标，贴近平台真实输出。  
3. 开源可复现流水线（采集—标注—注入—消融—写回过滤）与脱敏部署实践。

## 给编辑的 Cover Letter 要点

- Hybrid journal；应用智能解决真实问卷质量问题  
- 数据含伦理与知情同意  
- 愿提供补充材料：消融表、图、数据集卡片（脱敏）
