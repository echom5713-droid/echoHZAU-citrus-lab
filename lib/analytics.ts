import { ExperimentRecord, Recommendation, SummaryItem } from '@/lib/types'

const CONCENTRATIONS = [0, 1, 3, 4]

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function buildSummary(records: ExperimentRecord[]): SummaryItem[] {
  return CONCENTRATIONS.map((concentration) => {
    const values = records
      .filter((record) => Number(record.salt_concentration) === concentration)
      .map((record) => Number(record.yield_percent))
      .filter((value) => Number.isFinite(value))

    if (values.length === 0) {
      return {
        concentrationLabel: `${concentration}% NH₄Cl`,
        concentrationValue: concentration,
        count: 0,
        mean: 0,
        std: 0,
        min: 0,
        max: 0,
        cv: 0
      }
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const std = stdDev(values)
    return {
      concentrationLabel: `${concentration}% NH₄Cl`,
      concentrationValue: concentration,
      count: values.length,
      mean: round(mean, 3),
      std: round(std, 3),
      min: round(Math.min(...values), 3),
      max: round(Math.max(...values), 3),
      cv: mean === 0 ? 0 : round((std / mean) * 100, 2)
    }
  })
}

export function getRecommendation(summary: SummaryItem[]): Recommendation {
  const validGroups = summary.filter((item) => item.count >= 3)

  if (validGroups.length === 0) {
    return {
      concentrationValue: null,
      concentrationLabel: '暂不推荐',
      reason: '每组有效样本量不足 3 条，系统仅展示趋势，不给出最终推荐。',
      confidence: '低',
      status: '样本不足'
    }
  }

  const sorted = [...validGroups].sort((a, b) => b.mean - a.mean)
  const top = sorted[0]
  const second = sorted[1]

  if (!second) {
    return {
      concentrationValue: top.concentrationValue,
      concentrationLabel: top.concentrationLabel,
      reason: `当前仅有 ${top.concentrationLabel} 达到最低样本量要求，且平均得率为 ${top.mean}%。`,
      confidence: top.count >= 6 ? '中' : '低',
      status: top.count >= 6 ? '趋势推荐' : '样本不足'
    }
  }

  const delta = top.mean - second.mean
  const pick = delta >= 0.05 ? top : [top, second].sort((a, b) => a.std - b.std)[0]
  const confidence: Recommendation['confidence'] =
    pick.count >= 8 && pick.cv <= 12 ? '高' : pick.count >= 5 ? '中' : '低'
  const status: Recommendation['status'] = pick.count >= 6 ? '正式推荐' : '趋势推荐'

  const reason =
    delta >= 0.05
      ? `${pick.concentrationLabel} 的平均精油得率最高（${pick.mean}%），并已达到最低样本量要求。`
      : `${top.concentrationLabel} 与 ${second.concentrationLabel} 的平均得率接近，系统按波动性优先规则选择标准差更小的 ${pick.concentrationLabel}。`

  return {
    concentrationValue: pick.concentrationValue,
    concentrationLabel: pick.concentrationLabel,
    reason,
    confidence,
    status
  }
}
