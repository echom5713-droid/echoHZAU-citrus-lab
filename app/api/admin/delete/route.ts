import { NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const supabase = getAdminSupabase()

  if (!adminPassword || !supabase) {
    return NextResponse.json(
      { error: '删除功能未启用，请配置 ADMIN_PASSWORD 与 SUPABASE_SERVICE_ROLE_KEY。' },
      { status: 500 }
    )
  }

  const body = await request.json()

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: '管理员密码错误。' }, { status: 401 })
  }

  if (!body.id) {
    return NextResponse.json({ error: '缺少记录 ID。' }, { status: 400 })
  }

  const { error } = await supabase.from('experiment_records').delete().eq('id', String(body.id))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
