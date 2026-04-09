import Link from 'next/link'
import { buildSummary, getRecommendation } from '@/lib/analytics'
import { mockRecords } from '@/lib/mock-data'
import { getServerSupabase } from '@/lib/supabase'
import { StatCard } from '@/components/StatCard'
import { RecommendationPanel } from '@/components/RecommendationPanel'

async function getRecords() {
  const supabase = getServerSupabase()
  if (!supabase) return mockRecords
  const { data } = await supabase
    .from('experiment_records')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? mockRecords
}

export default async function HomePage() {
  const records = await getRecords()
  const summary = buildSummary(records)
  const recommendation = getRecommendation(summary)

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="eyebrow">Chemical Innovation Project</span>
          <h1>柑橘精油提取条件智能筛选系统</h1>
          <p>
            用于汇总 0%、1%、3%、4% 氯化铵条件下的提取数据，自动计算精油得率，并实时推荐后续抑菌实验所用的最佳盐浓度。
          </p>
          <div className="hero-actions">
            <Link href="/submit" className="button button-primary">
              开始录入数据
            </Link>
            <Link href="/dashboard" className="button button-secondary">
              查看实时统计
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-card-title">系统功能</p>
          <ul>
            <li>多人在线录入实验数据</li>
            <li>系统自动计算精油得率</li>
            <li>实时汇总四组结果并自动推荐</li>
            <li>支持实验记录导出与数据复核</li>
          </ul>
        </div>
      </section>

      <div className="grid stats-grid">
        <StatCard label="总记录数" value={`${records.length}`} helper="包含本地示例数据或 Supabase 正式数据" />
        <StatCard label="当前推荐浓度" value={recommendation.concentrationLabel} helper={recommendation.status} emphasis />
        <StatCard label="推荐可信度" value={recommendation.confidence} helper="由样本量与波动性共同决定" />
      </div>

      <RecommendationPanel recommendation={recommendation} />

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>快速说明</h2>
            <p>支持本地运行，也支持部署到 Vercel 与 Supabase 进行在线使用。</p>
          </div>
        </div>
        <div className="grid info-grid">
          <div className="info-card">
            <h3>录入维度</h3>
            <p>姓名、编号、盐浓度、橘皮质量、精油质量、平行编号、备注。</p>
          </div>
          <div className="info-card">
            <h3>推荐规则</h3>
            <p>优先比较平均得率；均值接近时，优先标准差更小的浓度组。</p>
          </div>
          <div className="info-card">
            <h3>数据策略</h3>
            <p>未配置 Supabase 时自动加载示例数据，确保页面可以正常浏览。</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>参赛成员</h2>
            <p>项目团队成员信息</p>
          </div>
        </div>
        <div className="grid info-grid">
          <div className="info-card member-card">
            <h3>QIN JIAN</h3>
            <p>覃剑</p>
          </div>
          <div className="info-card member-card">
            <h3>JIANG YUHAN</h3>
            <p>蒋禹涵</p>
          </div>
          <div className="info-card member-card">
            <h3>MA YUJIE</h3>
            <p>马于杰</p>
          </div>
        </div>
      </section>
    </div>
  )
}
