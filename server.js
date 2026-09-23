const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// 可选加载本地 .env（不依赖 dotenv；云端请用平台环境变量）
(function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    });
  } catch (_) { /* ignore */ }
})();

// 【修复1】自动重定向 .htm → .html
const app = express();
app.use((req, res, next) => {
  if (req.path.endsWith('.htm')) {
    const newPath = req.path.replace('.htm', '.html');
    return res.redirect(newPath);
  }
  next();
});

// ===================== 基础配置 =====================
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/surveySystem';
const SESSION_SECRET = process.env.SESSION_SECRET || 'survey-system-secret';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || !!process.env.RENDER;

// Render / 反向代理后正确识别 HTTPS 与 host
app.set('trust proxy', 1);

/** 站点根地址：优先环境变量，其次根据请求动态生成 */
function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

const corsOrigin = process.env.BASE_URL
  ? process.env.BASE_URL.replace(/\/$/, '')
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session配置（须在 static 与业务路由之前）
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.get('/api/session', (req, res) => {
  res.json({
    loggedIn: !!req.session.userId,
    username: req.session.username || null
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/videos/health', express.static(path.join(__dirname, 'imga')));
app.use('/images/banners', express.static(path.join(__dirname, 'idea')));

const BANNER_DEFAULTS = {
  desc: '智绘青健 — 大学生全维度健康画像与精准服务平台',
  link: '/pages/register.html',
  linkText: '免费注册'
};

app.get('/api/banners', (req, res) => {
  try {
    const dir = path.join(__dirname, 'idea');
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f));
    files.sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));

    let metaMap = {};
    const configPath = path.join(dir, 'banners.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(config)) {
        config.forEach(item => {
          if (item && item.file) metaMap[item.file] = item;
        });
      }
    }

    const banners = files.map(f => {
      const meta = metaMap[f] || {};
      const title = meta.title || f.replace(/\.[^.]+$/, '');
      return {
        image: '/images/banners/' + encodeURIComponent(f),
        title,
        desc: meta.desc || BANNER_DEFAULTS.desc,
        link: meta.link || BANNER_DEFAULTS.link,
        linkText: meta.linkText || BANNER_DEFAULTS.linkText
      };
    });

    res.json({ success: true, banners });
  } catch (err) {
    console.error('读取轮播图失败：', err);
    res.json({ success: false, banners: [], message: err.message });
  }
});

const HEALTH_VIDEO_DESC = {
  '校园健康提升方案与需求建议篇': '了解校园健康服务体系，掌握大学生健康需求与提升路径。',
  '校园健康提升方案与需求建议篇 (2)': '续篇：深入解读校园健康管理方案与实践建议。',
  '生活习惯与身心健康篇': '规律作息、合理饮食与适度运动，构筑身心健康基础。',
  '生活习惯与身心健康篇 (2)': '续篇：从日常习惯入手，改善身心状态的实用方法。',
  '营养知识与健康素养科普篇横板': '科学营养知识科普，提升健康素养，助力全面发展。',
  '营养知识与健康素养科普篇竖版': '营养与健康素养要点解读，适合移动端观看学习。'
};

app.get('/api/health-videos', (req, res) => {
  try {
    const dir = path.join(__dirname, 'imga');
    const files = fs.readdirSync(dir).filter(f => /\.mp4$/i.test(f));
    const order = [
      '校园健康提升方案与需求建议篇.mp4',
      '校园健康提升方案与需求建议篇 (2).mp4',
      '生活习惯与身心健康篇.mp4',
      '生活习惯与身心健康篇 (2).mp4',
      '营养知识与健康素养科普篇竖版.mp4',
      '营养知识与健康素养科普篇横板.mp4'
    ];
    files.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'zh');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    const videos = files.map(f => {
      const title = f.replace(/\.mp4$/i, '');
      return {
        key: f,
        src: '/videos/health/' + encodeURIComponent(f),
        title,
        desc: HEALTH_VIDEO_DESC[title] || '智绘青健健康科普视频，助力大学生全维度健康管理。'
      };
    });
    res.json({ success: true, videos });
  } catch (err) {
    console.error('读取健康科普视频失败：', err);
    res.json({ success: false, videos: [], message: err.message });
  }
});

app.use(express.static('public', { index: false }));

// ===================== 数据模型 =====================
// User模型（修复 next is not a function）
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
const User = mongoose.model('User', UserSchema);

// Survey模型
const SurveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [{
    title: { type: String, required: true },
    type: { type: String, enum: ['single', 'multiple'], required: true },
    options: { type: [String], required: true },
    questionUniqueId: { type: String, default: uuidv4() },
    questionIndex: { type: Number }
  }],
  shareLink: { type: String, required: true, unique: true }
}, { timestamps: true });

SurveySchema.pre('save', function() {
  if (this.questions && this.questions.length > 0) {
    this.questions.forEach((q, index) => {
      q.questionIndex = index;
    });
  }
});
const Survey = mongoose.model('Survey', SurveySchema);

// Response模型
const ResponseSchema = new mongoose.Schema({
  survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  answers: [{
    questionId: { type: String, required: true },
    answer: { type: mongoose.Schema.Types.Mixed, required: true }
  }],
  userInfo: {
    gender: { type: String, enum: ['男', '女', '其他'] },
    age: { type: String, enum: ['18以下', '18-30', '31-45', '45以上'] }
  }
}, { timestamps: true });
const Response = mongoose.model('Response', ResponseSchema);

const VideoCommentSchema = new mongoose.Schema({
  videoKey: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  content: { type: String, required: true, maxlength: 500 }
}, { timestamps: true });
const VideoComment = mongoose.model('VideoComment', VideoCommentSchema);

const VideoFavoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoKey: { type: String, required: true },
  type: { type: String, enum: ['like', 'favorite'], required: true },
  videoTitle: { type: String, default: '' }
}, { timestamps: true });
VideoFavoriteSchema.index({ userId: 1, videoKey: 1, type: 1 }, { unique: true });
const VideoFavorite = mongoose.model('VideoFavorite', VideoFavoriteSchema);

// ===================== MongoDB连接 =====================
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000
})
.then(() => console.log('✅ MongoDB连接成功'))
.catch(err => console.error('❌ MongoDB连接失败：', err));

// 登录验证中间件
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) next();
  else res.redirect('/pages/login.html');
};

const requireLoginApi = (req, res, next) => {
  if (req.session.userId) next();
  else res.status(401).json({ success: false, message: '请先登录' });
};

// ===================== 注册接口 =====================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    await user.save();
    res.json({ success: true, message: '注册成功' });
  } catch (err) {
    console.error('注册报错：', err);
    res.json({ success: false, message: '注册失败：' + err.message });
  }
});

// ===================== 登录接口 =====================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: '用户不存在' });
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.json({ success: false, message: '密码错误' });
    
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.surveyChatContexts = {};
    req.session.surveyAnalyses = {};
    res.json({ success: true, message: '登录成功', username: user.username });
  } catch (err) {
    console.error('登录报错：', err);
    res.json({ success: false, message: '登录失败' });
  }
});

// ===================== 创建问卷 =====================
app.post('/api/createSurvey', isAuthenticated, async (req, res) => {
  try {
    console.log("创建问卷数据：", req.body);
    const { title, description, questions } = req.body;

    if (!title || !questions || questions.length === 0) {
      return res.json({ success: false, message: '标题或题目不能为空' });
    }

    const questionsWithUniqueId = questions.map((q, index) => ({
      ...q,
      questionUniqueId: uuidv4(),
      questionIndex: index
    }));

    const shareLink = `/pages/survey.html?id=${uuidv4()}`;
    const survey = new Survey({
      title,
      description,
      creator: req.session.userId,
      questions: questionsWithUniqueId,
      shareLink
    });

    await survey.save();
    const baseUrl = getBaseUrl(req);
    const fullShareLink = `${baseUrl}${shareLink}`;
    const qrCodeUrl = await QRCode.toDataURL(fullShareLink);
    res.json({ success: true, survey, shareLink: fullShareLink, qrCodeUrl });
  } catch (err) {
    console.error("创建问卷失败：", err);
    res.json({ success: false, message: '创建失败：' + err.message });
  }
});

// ===================== 获取问卷列表 =====================
app.get('/api/surveys', isAuthenticated, async (req, res) => {
  try {
    const surveys = await Survey.find({ creator: req.session.userId }).sort({ createdAt: -1 });
    const enriched = await Promise.all(surveys.map(async (s) => ({
      ...s.toObject(),
      responseCount: await Response.countDocuments({ survey: s._id })
    })));
    res.json({
      success: true,
      surveys: enriched,
      username: req.session.username || '用户'
    });
  } catch (err) {
    res.json({ success: false, message: '获取失败' });
  }
});

// ===================== 获取单份问卷 =====================
app.get('/api/survey/:id', async (req, res) => {
  try {
    const survey = await Survey.findOne({ shareLink: `/pages/survey.html?id=${req.params.id}` });
    if (!survey) return res.json({ success: false, message: '问卷不存在' });
    res.json({ success: true, survey });
  } catch (err) {
    res.json({ success: false, message: '获取失败' });
  }
});

// ===================== 提交答案 =====================
app.post('/api/submitResponse', async (req, res) => {
  try {
    const { surveyId, answers, userInfo } = req.body;
    const survey = await Survey.findOne({ shareLink: `/pages/survey.html?id=${surveyId}` });
    if (!survey) return res.json({ success: false, message: '问卷不存在' });

    const formattedAnswers = answers.map(ans => ({
      questionId: String(ans.questionUniqueId || ans.questionId),
      answer: ans.answer
    }));

    const response = new Response({
      survey: survey._id,
      answers: formattedAnswers,
      userInfo
    });

    await response.save();
    res.json({ success: true, message: '提交成功' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: '提交失败' });
  }
});

// ===================== 【完全修复】统计接口 =====================
app.get('/api/stats/:surveyId', isAuthenticated, async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.surveyId);
    if (!survey) return res.json({ success: false, message: '问卷不存在' });

    const responses = await Response.find({ survey: survey._id });
    const totalRespondents = responses.length;

    // 用户统计
    const userCategory = {
      gender: { "男": 0, "女": 0, "其他": 0 },
      age: { "18以下": 0, "18-30": 0, "31-45": 0, "45以上": 0 }
    };

    // 题目统计初始化
    const questionStats = survey.questions.map((q, idx) => {
      const optionData = {};
      q.options.forEach(opt => {
        optionData[opt] = { count: 0, percentage: 0 };
      });
      return {
        questionId: q.questionUniqueId,
        questionTitle: q.title,
        question: q.title,
        questionType: q.type,
        options: q.options,
        optionData: optionData,
        total: 0
      };
    });

    // 统计所有答案
    responses.forEach(r => {
      // 用户画像
      const g = r.userInfo?.gender || "其他";
      userCategory.gender[g]++;

      const a = r.userInfo?.age || "18以下";
      userCategory.age[a]++;

      // 题目答案
      r.answers.forEach(ans => {
        const q = questionStats.find(s => s.questionId === ans.questionId);
        if (!q) return;

        if (q.questionType === "single") {
          if (q.optionData[ans.answer]) {
            q.optionData[ans.answer].count++;
            q.total++;
          }
        }

        if (q.questionType === "multiple" && Array.isArray(ans.answer)) {
          ans.answer.forEach(o => {
            if (q.optionData[o]) q.optionData[o].count++;
          });
          q.total++;
        }
      });
    });

    // 计算百分比
    questionStats.forEach(q => {
      const base = q.total || 1;
      Object.keys(q.optionData).forEach(opt => {
        q.optionData[opt].percentage = ((q.optionData[opt].count / base) * 100).toFixed(1);
      });
    });

    // 加入性别、年龄统计（前端能正常显示）
    questionStats.push({
      questionId: "gender_total",
      questionTitle: "用户性别分布",
      question: "用户性别分布",
      questionType: "single",
      options: ["男", "女", "其他"],
      optionData: {
        "男": { count: userCategory.gender["男"], percentage: (userCategory.gender["男"] / (totalRespondents || 1) * 100).toFixed(1) },
        "女": { count: userCategory.gender["女"], percentage: (userCategory.gender["女"] / (totalRespondents || 1) * 100).toFixed(1) },
        "其他": { count: userCategory.gender["其他"], percentage: (userCategory.gender["其他"] / (totalRespondents || 1) * 100).toFixed(1) }
      },
      total: totalRespondents
    });

    questionStats.push({
      questionId: "age_total",
      questionTitle: "用户年龄分布",
      question: "用户年龄分布",
      questionType: "single",
      options: ["18以下", "18-30", "31-45", "45以上"],
      optionData: {
        "18以下": { count: userCategory.age["18以下"], percentage: (userCategory.age["18以下"] / (totalRespondents || 1) * 100).toFixed(1) },
        "18-30": { count: userCategory.age["18-30"], percentage: (userCategory.age["18-30"] / (totalRespondents || 1) * 100).toFixed(1) },
        "31-45": { count: userCategory.age["31-45"], percentage: (userCategory.age["31-45"] / (totalRespondents || 1) * 100).toFixed(1) },
        "45以上": { count: userCategory.age["45以上"], percentage: (userCategory.age["45以上"] / (totalRespondents || 1) * 100).toFixed(1) }
      },
      total: totalRespondents
    });

    res.json({
      success: true,
      totalRespondents: totalRespondents,
      questionStats: questionStats,
      rawResponses: responses
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "统计失败" });
  }
});

// ===================== 视频评论 =====================
app.get('/api/video-comments', async (req, res) => {
  try {
    const { videoKey } = req.query;
    if (!videoKey) {
      return res.json({ success: false, message: '缺少 videoKey' });
    }
    const comments = await VideoComment.find({ videoKey })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      comments: comments.map(c => ({
        id: c._id,
        username: c.username,
        content: c.content,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    console.error('获取视频评论失败：', err);
    res.json({ success: false, comments: [], message: err.message });
  }
});

app.post('/api/video-comments', requireLoginApi, async (req, res) => {
  try {
    const { videoKey, content } = req.body;
    const trimmed = (content || '').trim();
    if (!videoKey) {
      return res.json({ success: false, message: '缺少 videoKey' });
    }
    if (!trimmed) {
      return res.json({ success: false, message: '评论内容不能为空' });
    }
    if (trimmed.length > 500) {
      return res.json({ success: false, message: '评论内容不能超过 500 字' });
    }
    const comment = await VideoComment.create({
      videoKey,
      userId: req.session.userId,
      username: req.session.username || '用户',
      content: trimmed
    });
    res.json({
      success: true,
      comment: {
        id: comment._id,
        username: comment.username,
        content: comment.content,
        createdAt: comment.createdAt
      }
    });
  } catch (err) {
    console.error('发表评论失败：', err);
    res.json({ success: false, message: '发表失败：' + err.message });
  }
});

// ===================== 视频喜欢/收藏 =====================
app.get('/api/video-favorites', requireLoginApi, async (req, res) => {
  try {
    const items = await VideoFavorite.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .lean();
    const likes = items.filter(i => i.type === 'like').map(formatFavoriteItem);
    const favorites = items.filter(i => i.type === 'favorite').map(formatFavoriteItem);
    res.json({ success: true, likes, favorites });
  } catch (err) {
    console.error('获取视频收藏失败：', err);
    res.json({ success: false, likes: [], favorites: [], message: err.message });
  }
});

app.get('/api/video-favorites/status', requireLoginApi, async (req, res) => {
  try {
    const { videoKey } = req.query;
    if (!videoKey) {
      return res.json({ success: false, message: '缺少 videoKey' });
    }
    const items = await VideoFavorite.find({
      userId: req.session.userId,
      videoKey
    }).lean();
    res.json({
      success: true,
      liked: items.some(i => i.type === 'like'),
      favorited: items.some(i => i.type === 'favorite')
    });
  } catch (err) {
    res.json({ success: false, liked: false, favorited: false, message: err.message });
  }
});

app.post('/api/video-favorites/toggle', requireLoginApi, async (req, res) => {
  try {
    const { videoKey, type, title } = req.body;
    if (!videoKey || !['like', 'favorite'].includes(type)) {
      return res.json({ success: false, message: '参数无效' });
    }
    const existing = await VideoFavorite.findOne({
      userId: req.session.userId,
      videoKey,
      type
    });
    if (existing) {
      await existing.deleteOne();
      return res.json({ success: true, active: false, type });
    }
    await VideoFavorite.create({
      userId: req.session.userId,
      videoKey,
      type,
      videoTitle: title || videoKey.replace(/\.[^.]+$/, '')
    });
    res.json({ success: true, active: true, type });
  } catch (err) {
    console.error('切换视频收藏失败：', err);
    res.json({ success: false, message: '操作失败：' + err.message });
  }
});

function formatFavoriteItem(item) {
  return {
    videoKey: item.videoKey,
    videoTitle: item.videoTitle || item.videoKey.replace(/\.[^.]+$/, ''),
    createdAt: item.createdAt
  };
}

// ===================== 登出 =====================
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/pages/login.html');
});

// ===================== 删除问卷 =====================
app.delete('/api/surveys/:id', isAuthenticated, async (req, res) => {
  try {
    await Survey.deleteOne({ _id: req.params.id, creator: req.session.userId });
    await Response.deleteMany({ survey: req.params.id });
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.json({ success: false, message: '删除失败' });
  }
});

// ===================== 注销账号 =====================
app.delete('/api/account', isAuthenticated, async (req, res) => {
  try {
    const surveys = await Survey.find({ creator: req.session.userId });
    const ids = surveys.map(s => s._id);
    await Response.deleteMany({ survey: { $in: ids } });
    await Survey.deleteMany({ creator: req.session.userId });
    await VideoComment.deleteMany({ userId: req.session.userId });
    await VideoFavorite.deleteMany({ userId: req.session.userId });
    await User.findByIdAndDelete(req.session.userId);
    req.session.destroy();
    res.json({ success: true, message: '注销成功' });
  } catch (err) {
    res.json({ success: false, message: '注销失败' });
  }
});

// ===================== AI 接口 =====================
const localAI = new OpenAI({ apiKey: 'none', baseURL: 'http://localhost:11434/v1' });
app.post('/api/ai/analyze', isAuthenticated, async (req, res) => {
  res.json({ success: true, aiAnalysis: 'AI 正在维护，暂不可用' });
});
app.post('/api/ai/chat', isAuthenticated, async (req, res) => {
  res.json({ success: true, reply: 'AI 正在维护，暂不可用' });
});
app.post('/api/ai/clearChat', isAuthenticated, (req, res) => {
  res.json({ success: true, message: '清空成功' });
});

// ===================== 启动服务 =====================
app.listen(PORT, () => {
  const local = `http://localhost:${PORT}`;
  console.log(`✅ 服务器启动：${local}`);
  console.log(`✅ 首页：${local}/`);
  console.log(`✅ 智绘青健 · 登录页：${local}/pages/login.html`);
  if (process.env.BASE_URL) {
    console.log(`✅ 对外地址 BASE_URL：${process.env.BASE_URL.replace(/\/$/, '')}`);
  }
});
