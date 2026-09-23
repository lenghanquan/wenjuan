const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema({
  survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  answers: [{
    questionId: { type: Number, required: true },
    answer: { type: mongoose.Schema.Types.Mixed, required: true } // 支持文本/数组（多选）/字符串（单选）
  }],
  userInfo: {
    age: { type: String }, // 答题人分类字段（示例：年龄）
    gender: { type: String } // 答题人分类字段（示例：性别）
  },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Response', ResponseSchema);