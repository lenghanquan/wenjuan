# Applied Intelligence 投稿前检查表

## A. 科学贡献是否站得住

- [ ] 问题清晰：匿名校园问卷的低质量/合成响应 + **画像偏差**  
- [ ] 方法有增量：多视图（答案/行为/批次）± 监督/半监督，而非仅规则  
- [ ] 消融完整：单视图 / 组合 / 融合  
- [ ] 主指标含下游：`bias_reduction`、排序保持，不只 AUC/F1  
- [ ] 与相关工作对话：IRT/稳健 PCA、bot 检测、LLM 合成答卷  

## B. 数据与伦理

- [ ] 伦理批件编号可写进论文  
- [ ] 知情同意文案与系统一致  
- [ ] 仅哈希设备信号；原文未存 IP  
- [ ] 主实验数字来自 **field** 数据，不是 `make_demo_bundle`  
- [ ] 合成注入协议写清（比例、策略、随机种子）  

## C. 可复现材料

- [ ] `ablation_table.md` / `.json` 最终版  
- [ ] `figures/fig_f1_ablation.png`, `fig_bias_reduction.png`  
- [ ] `dataset_card.md`（由脚本生成）  
- [ ] 代码与脚本路径在论文 Data Availability / Supplementary  
- [ ] 固定随机种子与模型版本号（`modelVersion`）  

## D. 文稿

- [ ] Title / Abstract 强调 **applied intelligence + real campus setting**  
- [ ] Methods 基于 `methods-draft-en.md` 扩写  
- [ ] Limitations：单校、题型仅选择、蜜罐对 LLM 有限  
- [ ] 混合刊：录用后选 **Subscription**（无 APC）若你不需要 OA  

## E. 系统截图（可选附录）

- [ ] 填写同意勾选  
- [ ] 质量标注页  
- [ ] 画像页 quality 过滤前后对比  

## 投稿链接

- Journal: https://link.springer.com/journal/10489  
- 确认当前 Aims & Scope、模板与字数要求（以官网为准）
