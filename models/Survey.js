const mongoose = require('mongoose');

const SurveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [{
    type: { type: String, enum: ['single', 'multiple', 'text'], required: true },
    title: { type: String, required: true },
    options: { type: [String] } // 单选/多选选项
  }],
  shareLink: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Survey', SurveySchema);