const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 用户数据模型定义
const UserSchema = new mongoose.Schema({
  // 用户名：必填、唯一
  username: { type: String, required: true, unique: true },
  // 密码：必填（存储加密后的密码）
  password: { type: String, required: true },
  // 邮箱：必填、唯一
  email: { type: String, required: true, unique: true },
  // 创建时间：默认当前时间
  createdAt: { type: Date, default: Date.now }
});

// 密码加密钩子（新版Mongoose兼容写法：移除next参数）
// 保存用户前自动加密密码，仅当密码字段修改时执行
UserSchema.pre('save', async function() {
  // 判断密码是否被修改（避免更新用户信息时重复加密）
  if (this.isModified('password')) {
    // 加密密码：盐值轮数10（越高越安全，速度越慢）
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// 密码验证方法（供登录时比对密码）
UserSchema.methods.comparePassword = async function(password) {
  // 比对明文密码和数据库中加密后的密码
  return await bcrypt.compare(password, this.password);
};

// 导出用户模型
module.exports = mongoose.model('User', UserSchema);