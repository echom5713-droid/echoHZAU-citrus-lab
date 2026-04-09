export type ExperimentRecord = {
  id: string
  created_at: string
  name: string
  student_id: string | null
  group_no: string | null
  experiment_date: string | null
  salt_concentration: number
  peel_mass: number
  oil_mass: number
  yield_percent: number
  replicate_no: number | null
  note: string | null
}

export type SummaryItem = {
  concentrationLabel: string
  concentrationValue: number
  count: number
  mean: number
  std: number
  min: number
  max: number
  cv: number
}

export type Recommendation = {
  concentrationValue: number | null
  concentrationLabel: string
  reason: string
  confidence: '低' | '中' | '高'
  status: '样本不足' | '趋势推荐' | '正式推荐'
}
