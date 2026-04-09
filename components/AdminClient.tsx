'use client'

import { useMemo, useState } from 'react'
import { buildSummary, getRecommendation } from '@/lib/analytics'
import { ExperimentRecord } from '@/lib/types'

export function AdminClient({ initialRecords }: { initialRecords: ExperimentRecord[] }) {
  const [password, setPassword] = useState('')
  const [records, setRecords] = useState(initialRecords)
  const [status, setStatus] = useState('')
  const [workingId, setWorkingId] = useState<string | null>(null)

  const summary = useMemo(() => buildSummary(records), [records])
  const recommendation = useMemo(() => getRecommendation(summary), [summary])

  const exportCsv = () => {
    const header = ['姓名', '学号', '小组', '日期', '盐浓度', '橘皮质量', '精油质量', '得率', '平行', '备注']
    const rows = records.map((record) => [
      record.name,
      record.student_id ?? '',
      record.group_no ?? '',
      record.experiment_date ?? '',
      record.salt_concentration,
      record.peel_mass,
      record.oil_mass,
      record.yield_percent,
      record.replicate_no ?? '',
      record.note ?? ''
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'experiment-records.csv')
    link.click()
    URL.revokeObjectURL(url)
  }

  const deleteRecord = async (id: string) => {
    setStatus('')
    setWorkingId(id)
    try {
      const response = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? '删除失败')
      setRecords((prev) => prev.filter((item) => item.id !== id))
      setStatus('删除成功。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '删除失败')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="hero compact-hero">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>管理员控制台</h1>
          <p>用于快速查看原始记录、导出 CSV 与删除误填数据。</p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={exportCsv}>
            导出 CSV
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="grid stats-grid top-stats-grid">
          <div className="stat-card">
            <p className="stat-label">当前推荐</p>
            <p className="stat-value">{recommendation.concentrationLabel}</p>
            <p className="stat-helper">{recommendation.reason}</p>
          </div>
          <label className="field">
            <span>管理员密码</span>
            <input
              type="password"
              placeholder="与 ADMIN_PASSWORD 保持一致"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        {status ? <p className="status-box">{status}</p> : null}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>原始数据记录</h2>
            <p>如需启用删除功能，请在 Vercel 与本地环境中配置 ADMIN_PASSWORD 与 SUPABASE_SERVICE_ROLE_KEY。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>日期</th>
                <th>盐浓度</th>
                <th>橘皮质量</th>
                <th>精油质量</th>
                <th>得率</th>
                <th>平行</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.experiment_date ?? '—'}</td>
                  <td>{record.salt_concentration}%</td>
                  <td>{record.peel_mass}</td>
                  <td>{record.oil_mass}</td>
                  <td>{record.yield_percent}%</td>
                  <td>{record.replicate_no ?? '—'}</td>
                  <td>{record.note ?? '—'}</td>
                  <td>
                    <button
                      className="button button-danger button-small"
                      disabled={!password || workingId === record.id}
                      onClick={() => void deleteRecord(record.id)}
                    >
                      {workingId === record.id ? '删除中...' : '删除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
