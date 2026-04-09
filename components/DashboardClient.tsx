'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildSummary, getRecommendation } from '@/lib/analytics'
import { ExperimentRecord } from '@/lib/types'
import { RecommendationPanel } from '@/components/RecommendationPanel'
import { StatCard } from '@/components/StatCard'

function formatTime(dateString?: string) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function DashboardClient({ initialRecords }: { initialRecords: ExperimentRecord[] }) {
  const [records, setRecords] = useState<ExperimentRecord[]>(initialRecords)
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString())
  const [loading, setLoading] = useState(false)

  const summary = useMemo(() => buildSummary(records), [records])
  const recommendation = useMemo(() => getRecommendation(summary), [summary])
  const totalCount = records.length

  const refresh = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/records', { cache: 'no-store' })
      const data = await response.json()
      setRecords(data.records ?? [])
      setLastUpdated(new Date().toISOString())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="page-stack">
      <div className="hero compact-hero">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>实时统计与自动推荐</h1>
          <p>
            自动汇总 0%、1%、3%、4% NH₄Cl 组的精油得率，按当前样本实时生成推荐。
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={() => void refresh()} disabled={loading}>
            {loading ? '刷新中...' : '立即刷新'}
          </button>
          <span className="muted">最近更新：{formatTime(lastUpdated)}</span>
        </div>
      </div>

      <div className="grid stats-grid top-stats-grid">
        <StatCard label="总记录数" value={`${totalCount}`} helper="已提交的有效实验数据" />
        <StatCard label="当前推荐" value={recommendation.concentrationLabel} helper={recommendation.status} emphasis />
        <StatCard label="推荐可信度" value={recommendation.confidence} helper="基于样本量与波动性" />
      </div>

      <RecommendationPanel recommendation={recommendation} />

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>平均精油得率对比</h2>
            <p>纵坐标单位为 %，系统每 8 秒自动刷新一次。</p>
          </div>
        </div>
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={summary}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="concentrationLabel" />
              <YAxis />
              <Tooltip
  formatter={(value: any) => [
    `${Number(value ?? 0).toFixed(2)}%`,
    '平均得率'
  ]}
/>
              <Bar dataKey="mean" radius={[10, 10, 0, 0]}>
                {summary.map((item) => {
                  const active = recommendation.concentrationValue === item.concentrationValue
                  return <Cell key={item.concentrationValue} fill={active ? '#f59e0b' : '#84cc16'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>四组统计明细</h2>
            <p>重点比较平均得率、标准差、变异系数与样本量。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>盐浓度</th>
                <th>样本数 n</th>
                <th>平均得率 (%)</th>
                <th>标准差</th>
                <th>最小值</th>
                <th>最大值</th>
                <th>CV (%)</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <tr key={item.concentrationValue} className={recommendation.concentrationValue === item.concentrationValue ? 'row-highlight' : ''}>
                  <td>{item.concentrationLabel}</td>
                  <td>{item.count}</td>
                  <td>{item.mean}</td>
                  <td>{item.std}</td>
                  <td>{item.min}</td>
                  <td>{item.max}</td>
                  <td>{item.cv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
