import Image from 'next/image'
import Link from 'next/link'

const links = [
  { href: '/', label: '首页' },
  { href: '/submit', label: '数据录入' },
  { href: '/dashboard', label: '实时统计' },
  { href: '/admin', label: '管理员' }
]

export function NavBar() {
  return (
    <header className="nav-shell">
      <div className="container nav-inner">
        <div>
          <div className="brand">echoHZAU-citrus-lab</div>
          <div className="brand-sub">柑橘精油提取条件智能筛选系统</div>
        </div>

        <div className="nav-right">
          <nav className="nav-links" aria-label="主导航">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="school-badge" aria-label="华中农业大学">
            <Image src="/hzau-logo.png" alt="华中农业大学校徽" width={48} height={48} className="school-badge-logo" />
            <div className="school-badge-text">
              <span>华中农业大学</span>
              <span>College of Chemistry</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
