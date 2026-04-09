import { Recommendation } from '@/lib/types'

export function RecommendationPanel({ recommendation }: { recommendation: Recommendation }) {
  return (
    <section className="panel recommendation-panel">
      <div className="pill-row">
        <span className="pill pill-strong">{recommendation.status}</span>
        <span className="pill">可信度：{recommendation.confidence}</span>
      </div>
      <h2 className="recommend-title">当前推荐浓度：{recommendation.concentrationLabel}</h2>
      <p className="recommend-body">{recommendation.reason}</p>
      <p className="recommend-note">
        规则：优先比较平均得率；若均值接近，则按标准差更小者优先。
      </p>
    </section>
  )
}
