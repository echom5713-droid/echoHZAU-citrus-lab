'use client'

import { FormEvent, useMemo, useState } from 'react'

const concentrations = [0, 1, 3, 4]

export function SubmitForm() {
  const [form, setForm] = useState({
    name: '',
    student_id: '',
    group_no: '',
    experiment_date: new Date().toISOString().slice(0, 10),
    salt_concentration: '3',
    peel_mass: '50',
    oil_mass: '',
    replicate_no: '1',
    note: ''
  })
  const [status, setStatus] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const yieldPercent = useMemo(() => {
    const peelMass = Number(form.peel_mass)
    const oilMass = Number(form.oil_mass)
    if (!peelMass || !oilMass) return '—'
    return ((oilMass / peelMass) * 100).toFixed(3)
  }, [form.peel_mass, form.oil_mass])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')

    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? '提交失败')
      }

      setStatus(`提交成功：系统已记录该条数据，自动计算得率为 ${data.record.yield_percent}%`)
      setForm((prev) => ({
        ...prev,
        name: '',
        student_id: '',
        group_no: '',
        oil_mass: '',
        note: ''
      }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '提交失败，请检查环境变量或数据库设置。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="grid form-grid">
        <label className="field">
          <span>姓名 *</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label className="field">
          <span>学号 / 编号</span>
          <input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
        </label>
        <label className="field">
          <span>小组编号</span>
          <input value={form.group_no} onChange={(e) => setForm({ ...form, group_no: e.target.value })} />
        </label>
        <label className="field">
          <span>实验日期 *</span>
          <input type="date" value={form.experiment_date} onChange={(e) => setForm({ ...form, experiment_date: e.target.value })} required />
        </label>
        <label className="field">
          <span>盐浓度 *</span>
          <select value={form.salt_concentration} onChange={(e) => setForm({ ...form, salt_concentration: e.target.value })}>
            {concentrations.map((value) => (
              <option key={value} value={value}>
                {value}% NH₄Cl
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>橘皮质量 (g) *</span>
          <input type="number" min="0" step="0.01" value={form.peel_mass} onChange={(e) => setForm({ ...form, peel_mass: e.target.value })} required />
        </label>
        <label className="field">
          <span>精油质量 (g) *</span>
          <input type="number" min="0" step="0.001" value={form.oil_mass} onChange={(e) => setForm({ ...form, oil_mass: e.target.value })} required />
        </label>
        <label className="field">
          <span>平行编号</span>
          <select value={form.replicate_no} onChange={(e) => setForm({ ...form, replicate_no: e.target.value })}>
            <option value="1">平行 1</option>
            <option value="2">平行 2</option>
            <option value="3">平行 3</option>
          </select>
        </label>
        <label className="field field-wide">
          <span>备注</span>
          <textarea rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
      </div>

      <div className="submit-bar">
        <div>
          <p className="preview-label">系统预估得率</p>
          <p className="preview-value">{yieldPercent === '—' ? '—' : `${yieldPercent}%`}</p>
        </div>
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? '提交中...' : '提交实验数据'}
        </button>
      </div>

      {status ? <p className="status-box">{status}</p> : null}
    </form>
  )
}
