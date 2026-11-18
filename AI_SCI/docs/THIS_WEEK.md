# 本周行动清单（打印贴墙上）

> 系统与实验代码已就绪。本周只做人与数据的事。

## 今天

1. 重启服务：`node server.js`
2. 登录 → **创建健康评估**
3. 添加普通题后，点：
   - `+ 注意力检查模板`
   - `+ 蜜罐题模板`
4. 手机扫码自己试填 1 次
5. 打开 **质量标注**，确认能看到时长 / 注意力结果
6. 打开 `ethics-application-zh.md`，把【】换成你的姓名单位，准备交伦理

## 本周

- [ ] 伦理申请提交（正文：`ethics-application-zh.md`；同意书：`informed-consent-zh.md`）
- [ ] 用 `recruitment-zh.md` 在 1 个班级/社团发出链接，目标先收 **50** 份
- [ ] 每夜导出 JSON 到 `AI_SCI/data/raw/field_日期.json`
- [ ] 用质量标注页标完这 50 份（参照 `labeling-guide.md`）
- [ ] 有空可改 `paper-outline-zh.md` 里的作者信息，不必等收完数再开写 Introduction

## 收满 50 份后立刻跑

```powershell
cd AI_SCI
.\scripts\run_field_pipeline.ps1 -InputJson .\data\raw\field_日期.json
```

看 `data/results/labeling_progress.json` 里：

- `ready_for_ablation_clean_base`
- `ready_for_supervised`

## 不要做

- 不要再用早期无元数据的旧评估做主实验  
- 不要把 demo 的 F1=1.0 写进投稿稿  
- 不要跳过知情同意勾选去「偷偷」采哈希数据  

详细协议：`real-study-protocol.md`
