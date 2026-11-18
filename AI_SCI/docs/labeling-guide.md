# 答卷质量人工标注指南

用于 `quality-admin` 页面与双人一致性评估。

## 基本原则

1. **先看行为与注意力，再看选项内容。** 健康选项「看起来奇怪」不等于低质量。  
2. **合成数据**只来自实验注入（`isSynthetic`），人工不要把真人标成 synthetic。  
3. 拿不准就选 **uncertain**，不要硬标。  
4. 标注依据写进笔记（可记在 detectionReasons 之外的本地表格）。

## 决策树（简版）

```
注意力失败 或 蜜罐触发？
  ├─ 是 → 优先 low_quality（真人乱填/脚本）
  └─ 否 → 时长是否异常短（如 <0.5s/题）？
        ├─ 是 + 选项高度直线 → low_quality
        ├─ 是但选项有合理变化 → uncertain 或 normal（谨慎）
        └─ 否 → 同指纹/同哈希短时间多份？
              ├─ 是 → 重复提交倾向：除首份外标 low_quality
              └─ 否 → normal
```

## 与自动分数的关系

- 自动 `isSuspectedLowQuality` 只是**预筛**，人工可以推翻。  
- 标 `normal` 会清除可疑标记；标 `low_quality`/`synthetic` 会置可疑。  
- 论文应报告：自动 vs 人工一致率。

## 双人标注协议

1. 独立标注同一批 ID（互不可见）  
2. 冲突提交第三人裁决或开会  
3. 计算一致率 / Cohen's κ  
4. 最终标签写入系统（一人操作即可）

## 导出后抽查

```bash
python scripts/labeling_progress.py --in data/raw/field_xxx.json
```

关注：`unlabeled` 是否下降、`low_quality` 是否过少（<5% 时主实验仍靠合成污染）。
