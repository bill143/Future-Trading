import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatsCard({ title, value, subtitle, trend, icon: Icon, color = 'blue', size = 'normal' }) {
  const colorMap = {
    blue: {
      icon: 'text-brand-blue bg-brand-blue/10',
      value: 'text-white',
      trend: trend > 0 ? 'text-brand-green' : trend < 0 ? 'text-brand-red' : 'text-gray-400',
    },
    green: {
      icon: 'text-brand-green bg-brand-green/10',
      value: 'text-brand-green',
      trend: 'text-brand-green',
    },
    red: {
      icon: 'text-brand-red bg-brand-red/10',
      value: 'text-brand-red',
      trend: 'text-brand-red',
    },
    gold: {
      icon: 'text-brand-gold bg-brand-gold/10',
      value: 'text-brand-gold',
      trend: 'text-brand-gold',
    },
    purple: {
      icon: 'text-brand-purple bg-brand-purple/10',
      value: 'text-white',
      trend: 'text-brand-purple',
    },
  }

  const c = colorMap[color] || colorMap.blue

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div>
        <div className={`font-bold leading-none ${c.value} ${size === 'large' ? 'text-3xl' : 'text-2xl'}`}>
          {value}
        </div>
        {(subtitle || trend !== undefined) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend !== undefined && trend !== 0 && (
              trend > 0
                ? <TrendingUp size={12} className="text-brand-green" />
                : <TrendingDown size={12} className="text-brand-red" />
            )}
            {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
