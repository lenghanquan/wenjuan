# 零成本上云部署指南（GitHub + MongoDB Atlas + Render）

本项目已支持环境变量，本地与云端均可运行。  
线上为**产品站**（创建/分享/填写问卷、健康科普）。质量检测相关代码仅保留在 `AI_SCI/` 供论文实验，不进入线上业务路径。

## 一、本地先验证

1. 启动本机 MongoDB
2. （可选）复制 `.env.example` 为 `.env` 并按需修改
3. 安装依赖并启动：

```bash
cd D:\问卷系统
npm install
npm start
```

打开：http://localhost:3000/

## 二、推到 GitHub（更新已有站点）

仓库：`https://github.com/lenghanquan/wenjuan.git`

在**仓库根目录**执行（不要嵌套 `wenjuan-修改版-发布包` 文件夹）：

```bash
cd D:\问卷系统
git add .
git status
git commit -m "deploy product site for survey share and data"
git push origin main
```

说明：

- `.gitignore` 已忽略 `node_modules`、`.env`、zip、发布包文件夹
- `imga/` 视频单文件需小于约 100MB（当前已满足）
- 推送后 Render 一般会自动重新部署；也可在控制台点 Manual Deploy

## 三、创建免费数据库（MongoDB Atlas）

1. 打开 https://www.mongodb.com/cloud/atlas 注册
2. 创建 **Free M0** 集群
3. Database Access：创建数据库用户（记住用户名密码）
4. Network Access：添加 `0.0.0.0/0`（允许任意 IP，演示够用）
5. Connect → Drivers → 复制连接串，例如：

```text
mongodb+srv://用户名:密码@cluster0.xxxxx.mongodb.net/surveySystem?retryWrites=true&w=majority
```

## 四、用 Render 免费部署

1. 打开 https://render.com ，用 GitHub 登录
2. New → **Web Service** → 选择本仓库 `lenghanquan/wenjuan`
3. 配置：

| 项 | 值 |
|----|-----|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free |

4. Environment 添加：

| Key | Value |
|-----|--------|
| `MONGODB_URI` | Atlas 连接串 |
| `SESSION_SECRET` | 一串随机字符 |
| `COOKIE_SECURE` | `true` |
| `BASE_URL` | 先空着，部署成功后再填 |

5. 部署成功后，复制 Render 网址（如 `https://xxx.onrender.com`）
6. 把 `BASE_URL` 设为该网址（不要末尾 `/`），再 **Manual Deploy** 一次

## 五、验收

- 打开 `BASE_URL` 看首页
- 注册 / 登录
- 创建健康评估，复制分享链接（应是公网地址）
- 手机或无痕窗口打开链接，提交答卷，后台能看到统计

## 注意

- 免费实例一段时间无人访问会休眠，下次打开可能要等 30～60 秒
- 本机开发不设 `BASE_URL` 时，会自动用请求的 host（或默认 localhost:3000）
- 不要把 `.env` 和真实密码提交到 GitHub
