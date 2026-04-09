import { NextResponse } from 'next/server'
import { mockRecords } from '@/lib/mock-data'
import { getServerSupabase } from '@/lib/supabase'

function calculateYield(peelMass: number, oilMass: number) {
  return Number(((oilMass / peelMass) * 100).toFixed(3))
}

export async function GET() {
  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ records: mockRecords, mode: 'demo' })
  }

  const { data, error } = await supabase
    .from('experiment_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ records: data ?? [], mode: 'supabase' })
}

export async function POST(request: Request) {
  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json(
      { error: '未配置 Supabase 环境变量，请先填写 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY。' },
      { status: 500 }
    )
  }

  const body = await request.json()
  const peelMass = Number(body.peel_mass)
  const oilMass = Number(body.oil_mass)
  const saltConcentration = Number(body.salt_concentration)
  const replicateNo = Number(body.replicate_no)

  if (!body.name || !peelMass || !oilMass || ![0, 1, 3, 4].includes(saltConcentration)) {
    return NextResponse.json({ error: '请完整填写姓名、盐浓度、橘皮质量与精油质量。' }, { status: 400 })
  }

  const payload = {
    name: String(body.name),
    student_id: body.student_id ? String(body.student_id) : null,
    group_no: body.group_no ? String(body.group_no) : null,
    experiment_date: body.experiment_date ? String(body.experiment_date) : null,
    salt_concentration: saltConcentration,
    peel_mass: peelMass,
    oil_mass: oilMass,
    yield_percent: calculateYield(peelMass, oilMass),
    replicate_no: Number.isFinite(replicateNo) ? replicateNo : null,
    note: body.note ? String(body.note) : null
  }

  const { data, error } = await supabase.from('experiment_records').insert(payload).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data })
}
