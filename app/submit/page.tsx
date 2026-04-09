import { SubmitForm } from '@/components/SubmitForm'

export default function SubmitPage() {
  return (
    <div className="page-stack">
      <div className="hero compact-hero">
        <div>
          <span className="eyebrow">Submit</span>
          <h1>实验数据录入</h1>
          <p>默认以 50.00 g 橘皮为实验基础，系统会自动计算精油得率。</p>
        </div>
      </div>
      <SubmitForm />
    </div>
  )
}
