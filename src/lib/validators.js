function bad(field, message, code = 'INVALID_FIELD') {
  return { field, message, code };
}

export function normalizeString(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export function validateLoginInput(body) {
  const role = normalizeString(body.role, 20);
  const username = normalizeString(body.username, 60);
  const password = String(body.password || '');
  const errors = [];
  if (!['student','teacher','admin'].includes(role)) errors.push(bad('role', '角色不正确'));
  if (!username) errors.push(bad('username', '请输入账号'));
  if (!password) errors.push(bad('password', '请输入密码'));
  return { ok: errors.length === 0, value: { role, username, password }, errors };
}

export function validatePasswordChange(body) {
  // 兼容前端两种字段命名：old_password / oldPassword、new_password / newPassword。
  const oldPassword = String(body.old_password ?? body.oldPassword ?? '');
  const newPassword = String(body.new_password ?? body.newPassword ?? '');
  const confirmPassword = String(body.confirm_password ?? body.confirmPassword ?? '');
  const errors = [];
  if (!oldPassword) errors.push(bad('old_password', '请输入当前密码'));
  if (newPassword.length < 6) errors.push(bad('new_password', '新密码至少 6 位'));
  if (newPassword.length > 72) errors.push(bad('new_password', '新密码过长'));
  if (confirmPassword && newPassword !== confirmPassword) errors.push(bad('confirm_password', '两次输入的新密码不一致'));
  return { ok: errors.length === 0, value: { oldPassword, newPassword }, errors };
}

export function validateRecordPayload(payload) {
  const errors = [];
  if (!payload.student_name || String(payload.student_name).length > 40) errors.push(bad('student_name', '学生姓名缺失或过长'));
  if (![0,1,3,4].includes(Number(payload.nh4cl_concentration))) errors.push(bad('nh4cl_concentration', 'NH₄Cl 浓度只能为 0%、1%、3%、4%'));
  if (!(Number(payload.peel_mass) > 0 && Number(payload.peel_mass) <= 1000)) errors.push(bad('peel_mass', '橘皮质量不合理'));
  if (!(Number(payload.oil_mass) >= 0 && Number(payload.oil_mass) <= 20)) errors.push(bad('oil_mass', '精油质量不合理'));
  if (Number(payload.inhibition_zone_diameter) < 0 || Number(payload.inhibition_zone_diameter) > 60) errors.push(bad('inhibition_zone_diameter', '抑菌圈直径不合理'));
  if (payload.class_name && String(payload.class_name).length > 80) errors.push(bad('class_name', '班级名称过长'));
  return { ok: errors.length === 0, errors };
}

export function errorResponse(errors) {
  return {
    ok: false,
    error: {
      code: errors[0]?.code || 'VALIDATION_ERROR',
      message: errors.map(e => e.message).join('；'),
      fields: errors
    }
  };
}
